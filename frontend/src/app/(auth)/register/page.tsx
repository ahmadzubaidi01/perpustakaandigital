'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { BookOpen, Mail, Lock, Eye, EyeOff, User, Phone, Hash } from 'lucide-react';
import { authAPI } from '@/lib/api';

// Reusable UI components
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ full_name: '', email_address: '', password: '', confirm_password: '', phone_number: '', student_id_number: '', class_name: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const update = (field: string, value: string) => {
    setForm((p) => ({ ...p, [field]: value }));
    setErrors((p) => {
      const n = { ...p };
      delete n[field];
      return n;
    });
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.full_name.trim()) errs.full_name = 'Nama lengkap wajib diisi';
    if (!form.email_address.trim()) errs.email_address = 'Email wajib diisi';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email_address)) errs.email_address = 'Format email tidak valid';
    if (!form.password) errs.password = 'Password wajib diisi';
    else if (form.password.length < 8) errs.password = 'Minimal 8 karakter';
    if (form.password !== form.confirm_password) errs.confirm_password = 'Password tidak cocok';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      await authAPI.register({
        full_name: form.full_name,
        email_address: form.email_address,
        password: form.password,
        phone_number: form.phone_number || null,
        student_id_number: form.student_id_number || null,
        class_name: form.class_name || null,
      });
      toast.success('Registrasi berhasil! Silakan login.');
      router.push('/login');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Registrasi gagal');
    } finally {
      setLoading(false);
    }
  };

  const renderField = ({ id, label, icon: Icon, type = 'text', placeholder, required = false }: any) => {
    const isPassword = id === 'password' || id === 'confirm_password';
    return (
      <Input
        key={id}
        id={id}
        label={`${label}${required ? ' *' : ''}`}
        type={isPassword ? (showPassword ? 'text' : 'password') : type}
        value={(form as any)[id]}
        onChange={(e) => update(id, e.target.value)}
        placeholder={placeholder}
        error={errors[id]}
        leftIcon={<Icon size={18} />}
        rightIcon={
          isPassword ? (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer bg-transparent border-none outline-none flex items-center justify-center"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          ) : undefined
        }
        autoCapitalize={id === 'email_address' || isPassword ? 'none' : undefined}
        autoCorrect={id === 'email_address' || isPassword ? 'off' : undefined}
      />
    );
  };

  return (
    <div className="w-full max-w-md animate-fade-in px-4 py-8 z-10">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 shadow-lg bg-linear-to-tr from-primary to-primary/80 text-primary-foreground shadow-primary/20">
          <BookOpen size={30} className="stroke-[2.5]" />
        </div>
        <h1 className="text-2xl font-black tracking-tight text-foreground">Daftar Akun</h1>
        <p className="text-sm text-muted-foreground mt-1.5">Buat akun untuk mulai meminjam buku</p>
      </div>

      <Card hoverable={false} className="p-8">
        <form onSubmit={handleSubmit} className="space-y-4">
          {renderField({ id: "full_name", label: "Nama Lengkap", icon: User, placeholder: "Masukkan nama lengkap", required: true })}
          {renderField({ id: "email_address", label: "Email", icon: Mail, type: "email", placeholder: "nama@email.com", required: true })}
          <div className="grid grid-cols-2 gap-3">
            {renderField({ id: "student_id_number", label: "NISN", icon: Hash, placeholder: "Nomor induk" })}
            {renderField({ id: "class_name", label: "Kelas", icon: Hash, placeholder: "Contoh: XII IPA 1" })}
          </div>
          {renderField({ id: "phone_number", label: "No. Telepon", icon: Phone, placeholder: "08xxxxxxxxxx" })}
          {renderField({ id: "password", label: "Password", icon: Lock, placeholder: "Minimal 8 karakter", required: true })}
          {renderField({ id: "confirm_password", label: "Konfirmasi Password", icon: Lock, placeholder: "Ulangi password", required: true })}

          <Button type="submit" isLoading={loading} size="lg" className="w-full mt-6">
            Daftar
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Sudah punya akun?{' '}
          <Link href="/login" className="font-bold text-primary hover:underline">
            Masuk
          </Link>
        </p>
      </Card>
    </div>
  );
}
