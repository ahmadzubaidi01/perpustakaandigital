import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import AuthProvider from "@/components/providers/AuthProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";

export const metadata: Metadata = {
  title: "Perpustakaan Digital — Sistem Manajemen Perpustakaan",
  description: "Sistem manajemen perpustakaan digital lintas platform untuk sekolah di Indonesia. Kelola buku, peminjaman, dan QR code dengan mudah.",
  keywords: "perpustakaan, digital, sekolah, peminjaman, buku, QR code, manajemen",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AuthProvider>
            {children}
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: 'var(--card)',
                  color: 'var(--foreground)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  fontSize: '14px',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)'
                },
                success: {
                  iconTheme: { primary: 'var(--success)', secondary: 'transparent' },
                },
                error: {
                  iconTheme: { primary: 'var(--destructive)', secondary: 'transparent' },
                },
              }}
            />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
