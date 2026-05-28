import Link from 'next/link';
import { Laugh, Smile, Users, User } from 'lucide-react';
import { PublicLayout } from '@/components/layouts/PublicLayout';

export default function HomePage() {
  return (
    <PublicLayout>
      <div className="flex flex-col">
        {/* Hero Section */}
        <section
          className="relative flex-1 flex flex-col justify-center min-h-[70vh] px-6 lg:px-20 py-24 bg-cover bg-center"
          style={{ backgroundImage: `url('/hero_background.png')` }}
        >
          {/* Soft glassmorphism/gradient overlay for background readability */}
          <div className="absolute inset-0 bg-background/90 z-0" />

          <div className="max-w-5xl w-full mx-auto relative z-10 text-left">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-tight text-foreground mb-3">
              Welcome to <span className="text-primary">E-PUSTAKA</span>
            </h1>
            <p className="text-lg sm:text-xl font-semibold text-muted-foreground mb-8 max-w-xl">
              Sistem Informasi Perpustakaan Digital
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-4 max-w-xs sm:max-w-none">
              <Link
                href="/login"
                className="w-full sm:w-56 text-center font-bold bg-primary hover:bg-primary/95 text-primary-foreground py-3.5 px-6 rounded-xl shadow-lg shadow-primary/10 transition-all text-sm tracking-wider active:scale-[0.98]"
              >
                MASUK KE PERPUSTAKAAN
              </Link>
            </div>
          </div>
        </section>

        {/* Stats Row Section */}
        <section className="bg-accent border-y border-border py-16 px-6 lg:px-20">
          <div className="max-w-6xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { value: '51', icon: Laugh, label: 'Siswa Aktif' },
              { value: '44', icon: Smile, label: 'Kunjungan Hari Ini' },
              { value: '95', icon: Users, label: 'Total Anggota' },
              { value: '2', icon: User, label: 'Admin Standby' },
            ].map((stat, i) => (
              <div
                key={i}
                className="bg-card border border-border rounded-2xl p-6 flex flex-col items-center justify-center text-center shadow-xs hover:shadow-md transition-all duration-305"
              >
                {/* Circular Icon */}
                <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4 shadow-sm">
                  <stat.icon size={26} />
                </div>
                {/* Value */}
                <p className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">{stat.value}</p>
                <p className="text-xs text-muted-foreground font-semibold mt-1.5 uppercase tracking-wider">{stat.label}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}
