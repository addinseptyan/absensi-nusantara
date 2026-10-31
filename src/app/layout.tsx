import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

// className (bukan hanya variable) memasang font langsung, sehingga menang atas
// aturan `font-family: Arial` bawaan template di globals.css.
const font = Plus_Jakarta_Sans({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
   title: { default: "Absensi Nusantara", template: "%s | Absensi Nusantara" },
   description: "Manajemen kehadiran siswa dan guru SMKS Nusantara Banyuwangi",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0f766e" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
   return (
      <html lang="id" className={font.className}>
         <body className="antialiased">
            {children}
            <Toaster richColors closeButton position="top-center" toastOptions={{ style: { fontFamily: "inherit" } }} />
         </body>
      </html>
   );
}