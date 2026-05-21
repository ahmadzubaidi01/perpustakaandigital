'use client';

import { Star, Heart } from 'lucide-react';
import Link from 'next/link';

// Reusable UI components
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';

export default function ReviewsPage() {
  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <PageHeader
        title="Ulasan & Favorit"
        description="Lihat ulasan buku katalog dan kelola daftar bacaan favorit Anda."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <Link href="/dashboard/books" className="group block outline-none">
          <Card hoverable={true} className="flex flex-col items-center justify-center text-center gap-4 p-8 min-h-[220px] transition-all duration-300">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-amber-50 dark:bg-amber-950/20 text-amber-500 transition-transform duration-300 group-hover:scale-105 shrink-0 shadow-inner">
              <Star size={30} className="fill-amber-500" />
            </div>
            <div>
              <p className="text-base font-bold text-foreground">Beri Ulasan Buku</p>
              <p className="text-xs text-muted-foreground mt-1.5 max-w-xs mx-auto leading-relaxed">
                Tulis rating bintang dan kritik membangun untuk buku-buku katalog yang telah Anda baca.
              </p>
            </div>
          </Card>
        </Link>
        
        <Link href="/dashboard/books" className="group block outline-none">
          <Card hoverable={true} className="flex flex-col items-center justify-center text-center gap-4 p-8 min-h-[220px] transition-all duration-300">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-red-50 dark:bg-red-950/20 text-red-500 transition-transform duration-300 group-hover:scale-105 shrink-0 shadow-inner">
              <Heart size={30} className="fill-red-500" />
            </div>
            <div>
              <p className="text-base font-bold text-foreground">Koleksi Favorit Saya</p>
              <p className="text-xs text-muted-foreground mt-1.5 max-w-xs mx-auto leading-relaxed">
                Simpan dan kelola katalog buku pilihan yang ingin Anda baca di masa depan.
              </p>
            </div>
          </Card>
        </Link>
      </div>
    </div>
  );
}

