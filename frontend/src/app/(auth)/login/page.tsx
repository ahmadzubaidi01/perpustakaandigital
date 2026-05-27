'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { BookOpen, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { authAPI } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

// Reusable UI components
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!email.trim()) errs.email = 'Email wajib diisi';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Format email tidak valid';
    if (!password) errs.password = 'Password wajib diisi';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const res = await authAPI.login({ email_address: email, password });
      const { user, tokens } = res.data.data;
      login(user, tokens.access_token, tokens.refresh_token);
      toast.success(`Selamat datang, ${user.full_name}!`);

      // Redirect based on role
      const roleRoutes: Record<string, string> = {
        super_admin: '/dashboard/super-admin',
        regency_admin: '/dashboard/regency-admin',
        district_admin: '/dashboard/district-admin',
        school_admin: '/dashboard/school-admin',
        student_member: '/dashboard/student',
      };
      router.push(roleRoutes[user.user_role] || '/dashboard');
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Login gagal';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md animate-fade-in px-4 z-10">
      {/* Logo & Title */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 shadow-lg bg-linear-to-tr from-primary to-primary/80 text-primary-foreground shadow-primary/20">
          <BookOpen size={30} className="stroke-[2.5]" />
        </div>
        <h1 className="text-2xl font-black tracking-tight text-foreground">E-PUSTAKA</h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Masuk ke akun Anda untuk melanjutkan
        </p>
      </div>

      {/* Login Card */}
      <Card hoverable={false} className="p-8">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email */}
          <Input
            id="email"
            label="Email"
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setErrors({}); }}
            placeholder="nama@email.com"
            error={errors.email}
            leftIcon={<Mail size={18} />}
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
          />

          {/* Password */}
          <Input
            id="password"
            label="Password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => { setPassword(e.target.value); setErrors({}); }}
            placeholder="Masukkan password"
            error={errors.password}
            leftIcon={<Lock size={18} />}
            rightIcon={
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="p-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer bg-transparent border-none outline-none flex items-center justify-center"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            }
            autoComplete="current-password"
          />

          {/* Forgot password */}
          <div className="flex justify-end">
            <Link
              href="/forgot-password"
              className="text-xs font-semibold text-primary hover:underline"
            >
              Lupa password?
            </Link>
          </div>

          {/* Submit */}
          <Button
            type="submit"
            isLoading={loading}
            size="lg"
            className="w-full mt-2"
          >
            Masuk
          </Button>
        </form>
        {/* Admin contact notice */}
        <div className="pt-4 mt-6 border-t border-border text-center">
          <p className="text-sm text-muted-foreground">
            Belum memiliki akun? Silakan hubungi admin perpustakaan sekolah Anda untuk mendaftarkan akun baru.
          </p>
        </div>
      </Card>

      {/* Footer */}
      <p className="text-center text-xs text-muted-foreground mt-8">
        © {new Date().getFullYear()} E-PUSTAKA. All rights reserved.
      </p>
    </div>
  );
}
