'use client';

import Link from 'next/link';
import { HandCoins, RotateCcw, ArrowRight, BookOpen, QrCode, ShieldAlert } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { useAuthStore } from '@/lib/store';

export default function PeminjamanHubPage() {
  const { user } = useAuthStore();

  return (
    <div className="animate-fade-in space-y-8">
      <PageHeader
        title="Sistem Peminjaman & Pengembalian"
        description="Kelola transaksi sirkulasi buku perpustakaan secara cepat menggunakan QR scanner terintegrasi."
      />

      {/* Greeting Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-linear-to-r from-indigo-600 via-purple-600 to-pink-600 p-8 text-white shadow-xl">
        <div className="absolute right-0 top-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        
        <div className="relative z-10 max-w-2xl">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-xs font-semibold backdrop-blur-md mb-4">
            <QrCode size={12} /> Mode Scanner Cepat Aktif
          </span>
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Halo, {user?.full_name || 'Petugas'}!
          </h2>
          <p className="mt-2 text-white/90 text-sm md:text-base font-medium leading-relaxed">
            Selamat datang di hub sirkulasi digital. Dari sini Anda dapat memproses peminjaman buku untuk siswa atau memproses pengembalian buku yang telah dipinjam hanya dengan memindai kode QR buku.
          </p>
        </div>
      </div>

      {/* Main Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pinjam Card */}
        <Link 
          href="/dashboard/peminjaman/pinjam"
          className="group relative flex flex-col justify-between p-8 bg-card border border-border rounded-3xl shadow-xs transition-all duration-350 hover:shadow-xl hover:shadow-indigo-500/5 hover:-translate-y-1.5 overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-bl-full transition-all duration-350 group-hover:scale-110" />
          <div>
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-xs transition-transform duration-350 group-hover:scale-110">
              <HandCoins size={28} />
            </div>
            <h3 className="text-xl font-bold text-foreground mt-6 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
              Peminjaman Buku Cepat
            </h3>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              Cari profil siswa menggunakan nama, nomor ID, atau kartu anggota QR, lalu pindai kode QR buku untuk menyelesaikan proses peminjaman dalam satu ketukan.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 mt-8">
            Mulai Peminjaman <ArrowRight size={14} className="transition-transform duration-350 group-hover:translate-x-1.5" />
          </div>
        </Link>

        {/* Kembalian Card */}
        <Link 
          href="/dashboard/peminjaman/pengembalian"
          className="group relative flex flex-col justify-between p-8 bg-card border border-border rounded-3xl shadow-xs transition-all duration-350 hover:shadow-xl hover:shadow-pink-500/5 hover:-translate-y-1.5 overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/5 rounded-bl-full transition-all duration-350 group-hover:scale-110" />
          <div>
            <div className="w-14 h-14 rounded-2xl bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 flex items-center justify-center shadow-xs transition-transform duration-350 group-hover:scale-110">
              <RotateCcw size={28} />
            </div>
            <h3 className="text-xl font-bold text-foreground mt-6 group-hover:text-pink-600 dark:group-hover:text-pink-400 transition-colors">
              Pengembalian Buku Cepat
            </h3>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              Pindai kode QR buku yang dikembalikan untuk mencari detail transaksi aktif secara otomatis, menghitung denda keterlambatan (jika ada), dan memproses pengembalian secara instan.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-pink-600 dark:text-pink-400 mt-8">
            Proses Pengembalian <ArrowRight size={14} className="transition-transform duration-350 group-hover:translate-x-1.5" />
          </div>
        </Link>
      </div>

      {/* Guide/Information Section */}
      <div className="p-6 bg-accent/40 border border-border rounded-2xl flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
          <ShieldAlert size={20} />
        </div>
        <div>
          <h4 className="text-sm font-bold text-foreground">Panduan Cepat Penggunaan Scanner</h4>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Pastikan browser Anda diizinkan untuk mengakses kamera perangkat guna memindai kode QR secara langsung. Jika kamera bermasalah atau tidak tersedia, Anda tetap dapat mengetikkan kode QR / UUID buku secara manual pada kolom input pencarian di dalam masing-masing halaman peminjaman atau pengembalian.
          </p>
        </div>
      </div>
    </div>
  );
}
