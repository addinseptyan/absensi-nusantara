"""Agent absensi SMKS Nusantara: menarik data dari mesin ZKTeco K20 lalu mengirimnya ke web.
Hanya koneksi KELUAR ke web; tidak ada port yang dibuka. Perintah dibatasi daftar tetap (whitelist)."""
import json
import os
import socket
import sys
import time
import traceback
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests
from dotenv import load_dotenv
from zk import ZK

VERSION = "0.1.0"
HERE = Path(__file__).parent
load_dotenv(HERE / ".env")

WEB_URL = os.environ["WEB_URL"].rstrip("/")
TOKEN = os.environ["AGENT_TOKEN"]
POLL = int(os.getenv("POLL_SECONDS", "30"))
TZ = timezone(timedelta(hours=float(os.getenv("TZ_OFFSET_HOURS", "7"))))
STATE_FILE = HERE / "agent_state.json"
BATCH = 2000

_logbuf: list[dict] = []


def log(level: str, message: str, **context):
    print(f"{datetime.now(TZ):%H:%M:%S} [{level}] {message}", flush=True)
    if level in ("info", "warning", "error"):
        _logbuf.append({"level": level, "message": message[:1900], "context": context or None})
        del _logbuf[:-50]


def api(path: str, payload: dict) -> dict:
    r = requests.post(f"{WEB_URL}{path}", json=payload, timeout=60,
                      headers={"Authorization": f"Bearer {TOKEN}"})
    r.raise_for_status()
    return r.json()


def load_state() -> dict:
    try:
        return json.loads(STATE_FILE.read_text())
    except Exception:
        return {"ran": {}}


def save_state(st: dict):
    STATE_FILE.write_text(json.dumps(st))


# ---------------------------------------------------------------- mesin
class DeviceError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code, self.message = code, message


def explain(e: Exception) -> DeviceError:
    text = str(e).lower()
    if isinstance(e, DeviceError):
        return e
    if isinstance(e, requests.RequestException):  # harus dicek sebelum OSError
        return DeviceError("WEB_ERROR", f"Gagal menghubungi web: {e}")
    if "unauthenticated" in text or "password" in text:
        return DeviceError("COMMKEY_WRONG", "Comm Key mesin salah atau mesin menolak koneksi. Cek menu Comm > Comm Key di mesin.")
    if isinstance(e, (socket.timeout, TimeoutError, ConnectionError, OSError)) or "timed out" in text or "can't reach" in text or "network" in text:
        return DeviceError("DEVICE_UNREACHABLE", "Mesin tidak merespons. Cek apakah mesin menyala, kabel LAN terpasang, dan IP/port benar.")
    return DeviceError("DEVICE_ERROR", f"{type(e).__name__}: {e}")


def connect(cfg: dict):
    zk = ZK(cfg["ip"], port=cfg["port"], timeout=cfg["timeout"], password=cfg.get("commKey", 0))
    try:
        return zk.connect()
    except Exception as e:
        raise explain(e)


def with_device(cfg: dict, fn):
    conn = connect(cfg)
    try:
        return fn(conn)
    except Exception as e:
        raise explain(e)
    finally:
        try:
            conn.enable_device()
        except Exception:
            pass
        try:
            conn.disconnect()
        except Exception:
            pass


def to_iso(ts: datetime) -> str:
    return ts.replace(tzinfo=TZ).isoformat()  # pyzk memberi jam lokal mesin tanpa zona


# ---------------------------------------------------------------- sync
def do_sync(cfg: dict, last_log_at: str | None, trigger: str) -> dict:
    try:
        def read(conn):
            conn.disable_device()  # cegah mesin menulis saat dibaca
            return conn.get_attendance()

        records = with_device(cfg, read)
        since = None
        if last_log_at:  # hanya ambil data baru (tumpang tindih 2 hari agar aman)
            since = datetime.fromisoformat(last_log_at.replace("Z", "+00:00")) - timedelta(days=2)
        rows = []
        for r in records:
            iso = to_iso(r.timestamp)
            if since and datetime.fromisoformat(iso) < since:
                continue
            rows.append({"pin": str(r.user_id), "ts": iso, "verify": r.status, "state": r.punch})

        run_id, new_total = None, 0
        chunks = [rows[i:i + BATCH] for i in range(0, len(rows), BATCH)] or [[]]
        for i, chunk in enumerate(chunks):
            res = api("/api/agent/logs", {"syncRunId": run_id, "trigger": trigger, "logs": chunk,
                                          "final": i == len(chunks) - 1})
            run_id, new_total = res["syncRunId"], new_total + res["new"]
        log("info", f"Sync selesai: {len(rows)} data dikirim, {new_total} baru.")
        return {"fetched": len(rows), "new": new_total, "totalOnDevice": len(records), "syncRunId": run_id}
    except Exception as e:
        err = explain(e)
        log("error", f"Sync gagal [{err.code}] {err.message}")
        try:
            api("/api/agent/logs", {"trigger": trigger, "logs": [], "error": {"code": err.code, "message": err.message}})
        except Exception:
            log("error", "Gagal melapor error sync ke web.")
        raise err


# ---------------------------------------------------------------- perintah (whitelist)
def cmd_test_connection(cfg, _):
    def f(c):
        return {"serial": c.get_serialnumber(), "firmware": c.get_firmware_version(), "deviceTime": c.get_time().isoformat()}
    return with_device(cfg, f)


def cmd_fetch_users(cfg, _):
    def f(c):
        return {"users": [{"pin": str(u.user_id), "name": u.name, "privilege": u.privilege, "card": u.card} for u in c.get_users()]}
    return with_device(cfg, f)


def cmd_sync_time(cfg, _):
    def f(c):
        c.set_time(datetime.now(TZ).replace(tzinfo=None))
        return {"deviceTime": c.get_time().isoformat()}
    return with_device(cfg, f)


def cmd_diagnose(cfg, _):
    steps = []

    def step(name, fn):
        try:
            detail = fn()
            steps.append({"name": name, "ok": True, "detail": detail})
            return True
        except Exception as e:
            steps.append({"name": name, "ok": False, "detail": explain(e).message})
            return False

    step("Agent hidup", lambda: f"versi {VERSION}")

    def tcp():
        t0 = time.time()
        with socket.create_connection((cfg["ip"], cfg["port"]), timeout=cfg["timeout"]):
            pass
        return f"{cfg['ip']}:{cfg['port']} terbuka ({int((time.time() - t0) * 1000)} ms)"

    if not step("Port mesin terbuka", tcp):
        return {"steps": steps}
    holder = {}

    def auth():
        holder["c"] = connect(cfg)
        return "terhubung ke mesin"

    if not step("Autentikasi", auth):
        return {"steps": steps}
    c = holder["c"]
    try:
        step("Baca jam mesin", lambda: _clock(c))
        step("Baca daftar user", lambda: f"{len(c.get_users())} user")
        step("Baca log absen", lambda: f"{len(c.get_attendance())} log di mesin")
    finally:
        try:
            c.disconnect()
        except Exception:
            pass
    return {"steps": steps}


def _clock(c):
    dev = c.get_time()
    diff = int((datetime.now(TZ).replace(tzinfo=None) - dev).total_seconds())
    note = "OK" if abs(diff) < 120 else f"MELENCENG {diff} detik, jalankan perintah sync_time"
    return f"{dev:%Y-%m-%d %H:%M:%S} (selisih dari PC: {diff} dtk, {note})"


def run_command(cmd: dict, hb: dict):
    cfg, ctype = hb["device"], cmd["type"]
    log("info", f"Menjalankan perintah #{cmd['id']} {ctype}")
    try:
        if not cfg:
            raise DeviceError("NO_DEVICE", "Agent belum dihubungkan ke mesin di web.")
        if ctype == "sync_now":
            result = do_sync(cfg, hb["lastLogAt"], "manual")
        else:
            result = {"test_connection": cmd_test_connection, "fetch_users": cmd_fetch_users,
                      "sync_time": cmd_sync_time, "diagnose": cmd_diagnose}[ctype](cfg, cmd.get("payload"))
        api(f"/api/agent/commands/{cmd['id']}/result", {"status": "success", "result": result})
    except Exception as e:
        err = explain(e)
        api(f"/api/agent/commands/{cmd['id']}/result", {"status": "failed", "errorMessage": f"[{err.code}] {err.message}"})


# ---------------------------------------------------------------- jadwal
def run_due_schedules(hb: dict, state: dict):
    if not hb["device"] or not hb["device"]["active"]:
        return
    now = datetime.now(timezone.utc).astimezone(TZ)
    today = now.date().isoformat()
    for sch in hb["schedules"]:
        key = str(sch["id"])
        if now.isoweekday() not in sch["weekdays"] or state["ran"].get(key) == today:
            continue
        if time.time() < state.get("retry", {}).get(key, 0):  # jeda sebelum mencoba ulang setelah gagal
            continue
        h, m = map(int, sch["runAt"].split(":"))
        if now >= now.replace(hour=h, minute=m, second=0, microsecond=0):  # juga mengejar jadwal yang terlewat
            log("info", f"Menjalankan sync terjadwal {sch['runAt']}")
            try:
                do_sync(hb["device"], hb["lastLogAt"], "schedule")
            except DeviceError:
                state.setdefault("retry", {})[key] = time.time() + 600  # coba lagi 10 menit kemudian
            else:
                state["ran"][key] = today
            save_state(state)


def main():
    log("info", f"Agent v{VERSION} mulai. Web: {WEB_URL}")
    state = load_state()
    while True:
        try:
            logs, _logbuf[:] = list(_logbuf), []
            hb = api("/api/agent/heartbeat", {"version": VERSION, "logs": logs})
            for cmd in hb["commands"]:
                run_command(cmd, hb)
            run_due_schedules(hb, state)
        except requests.RequestException as e:
            log("warning", f"Tidak bisa menghubungi web: {e}")
        except Exception:
            log("error", "Error tak terduga: " + traceback.format_exc()[-800:])
        time.sleep(POLL)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
