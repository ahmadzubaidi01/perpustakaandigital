'use client';

import { useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { BookOpen, Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { authAPI } from '@/lib/api';

// Reusable UI components
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Email wajib diisi');
      return;
    }

    setLoading(true);
    try {
      await authAPI.forgotPassword(email);
      setSent(true);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal mengirim email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md animate-fade-in px-4 z-10">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 shadow-lg bg-linear-to-tr from-primary to-primary/80 text-primary-foreground shadow-primary/20">
          <BookOpen size={30} className="stroke-[2.5]" />
        </div>
        <h1 className="text-2xl font-black tracking-tight text-foreground">Lupa Password</h1>
        <p className="text-sm text-muted-foreground mt-1.5 font-medium">Masukkan email untuk reset password</p>
      </div>

      <Card hoverable={false} className="p-8">
        {sent ? (
          <div className="text-center py-4">
            <CheckCircle size={48} className="mx-auto mb-4 text-success" />
            <h2 className="text-lg font-bold text-foreground mb-2">Email Terkirim!</h2>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              Jika akun dengan email tersebut terdaftar, kami telah mengirimkan link reset password.
            </p>
            <Link href="/login" className="block w-full">
              <Button type="button" className="w-full">
                Kembali ke Login
              </Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              id="email"
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@email.com"
              leftIcon={<Mail size={18} />}
              autoCapitalize="none"
              autoCorrect="off"
              required
            />

            <Button type="submit" isLoading={loading} className="w-full mt-2" size="lg">
              Kirim Link Reset
            </Button>
          </form>
        )}

        <div className="mt-6 text-center">
          <Link href="/login" className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-primary hover:underline">
            <ArrowLeft size={14} /> Kembali ke Login
          </Link>
        </div>
      </Card>
    </div>
  );
}
