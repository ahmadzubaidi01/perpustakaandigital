'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BookOpen, ShieldAlert } from 'lucide-react';

// Reusable UI components
import { Card } from '@/components/ui/Card';

export default function RegisterPage() {
  const router = useRouter();

  useEffect(() => {
    // Immediate redirect to login
    router.replace('/login');
  }, [router]);

  return (
    <div className="w-full max-w-md animate-fade-in px-4 py-8 z-10">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 shadow-lg bg-linear-to-tr from-primary to-primary/80 text-primary-foreground shadow-primary/20">
          <BookOpen size={30} className="stroke-[2.5]" />
        </div>
        <h1 className="text-2xl font-black tracking-tight text-foreground">Daftar Akun</h1>
        <p className="text-sm text-muted-foreground mt-1.5">Pendaftaran akun dinonaktifkan</p>
      </div>

      <Card hoverable={false} className="p-8 flex flex-col items-center text-center space-y-4">
        <ShieldAlert size={48} className="text-warning-500 mb-2" />
        <h3 className="text-lg font-bold text-foreground">Pendaftaran Dinonaktifkan</h3>
        <p className="text-sm text-muted-foreground">
          Pendaftaran akun baru secara mandiri telah dinonaktifkan. Silakan hubungi admin perpustakaan sekolah Anda untuk mendapatkan akun baru.
        </p>
        <div className="w-full pt-4 border-t border-border">
          <Link href="/login" className="inline-flex items-center justify-center w-full font-bold text-primary hover:underline">
            Kembali ke Login
          </Link>
        </div>
      </Card>
    </div>
  );
}
