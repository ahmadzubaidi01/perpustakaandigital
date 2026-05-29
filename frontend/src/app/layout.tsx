import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import AuthProvider from "@/components/providers/AuthProvider";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import ReactQueryProvider from "@/components/providers/ReactQueryProvider";

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
    <html lang="id" suppressHydrationWarning data-scroll-behavior="smooth">
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <ReactQueryProvider>
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
          </ReactQueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
