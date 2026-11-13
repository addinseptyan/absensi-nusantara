# Memasang agent absensi agar berjalan otomatis setiap PC menyala (tanpa jendela, tanpa perlu login).
# Cara pakai: klik kanan PowerShell > Run as administrator, lalu:
#   cd C:\absensi-agent
#   powershell -ExecutionPolicy Bypass -File .\install-agent.ps1
# Untuk melepas: powershell -ExecutionPolicy Bypass -File .\install-agent.ps1 -Remove
param([switch]$Remove)
$ErrorActionPreference = "Stop"
$TaskName = "AbsensiAgent"

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) { Write-Host "Jalankan PowerShell sebagai Administrator." -ForegroundColor Red; exit 1 }

if ($Remove) {
    Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
    Write-Host "Tugas $TaskName dihapus." -ForegroundColor Green
    exit 0
}

$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not (Test-Path "$dir\agent.py")) { Write-Host "agent.py tidak ada di $dir" -ForegroundColor Red; exit 1 }
if (-not (Test-Path "$dir\.env")) { Write-Host "File .env belum ada. Salin .env.example menjadi .env lalu isi WEB_URL dan AGENT_TOKEN." -ForegroundColor Red; exit 1 }

$py = (Get-Command python -ErrorAction SilentlyContinue).Source
if (-not $py) { Write-Host "Python tidak ditemukan." -ForegroundColor Red; exit 1 }
$pyw = Join-Path (Split-Path $py) "pythonw.exe"
if (-not (Test-Path $pyw)) { $pyw = $py }

& $py -c "import zk, requests, dotenv" 2>$null
if ($LASTEXITCODE -ne 0) { Write-Host "Paket belum terpasang. Jalankan dulu: python -m pip install -r requirements.txt" -ForegroundColor Red; exit 1 }

Write-Host "PASTIKAN agent yang berjalan manual (jendela Command Prompt) sudah ditutup dengan Ctrl+C." -ForegroundColor Yellow
$user = "$env:USERDOMAIN\$env:USERNAME"
$secure = Read-Host "Kata sandi Windows untuk akun $user (tidak ditampilkan)" -AsSecureString
$plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
if (-not $plain) {
    Write-Host "Akun Windows tanpa kata sandi tidak bisa menjalankan tugas saat belum login. Beri kata sandi pada akun ini dulu, lalu ulangi." -ForegroundColor Red
    exit 1
}

$action = New-ScheduledTaskAction -Execute $pyw -Argument "agent.py" -WorkingDirectory $dir
$trigger = New-ScheduledTaskTrigger -AtStartup
$trigger.Delay = "PT1M"   # tunggu 1 menit agar jaringan siap
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
    -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -User $user -Password $plain -RunLevel Limited -Force | Out-Null

# PC jangan tidur / hibernasi agar sync 08:00 dan 15:00 tidak terlewat
powercfg /change standby-timeout-ac 0 | Out-Null
powercfg /change hibernate-timeout-ac 0 | Out-Null
powercfg /change disk-timeout-ac 0 | Out-Null
powercfg /hibernate off | Out-Null

Start-ScheduledTask -TaskName $TaskName
Write-Host ""
Write-Host "Selesai. Agent berjalan di latar belakang dan otomatis menyala setiap PC hidup." -ForegroundColor Green
Write-Host "Cek: halaman Kesehatan sistem di web harus menunjukkan agent Online (versi 0.3.0)."
Write-Host "Log lokal: $dir\agent.log"
