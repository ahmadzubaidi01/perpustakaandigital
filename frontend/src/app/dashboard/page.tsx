'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { Loader } from '@/components/ui/Loader';

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading } = useAuthStore();

  useEffect(() => {
    if (isLoading) return;
    if (!user) { router.replace('/login'); return; }

    const routes: Record<string, string> = {
      super_admin: '/dashboard/super-admin',
      regency_admin: '/dashboard/regency-admin',
      district_admin: '/dashboard/district-admin',
      school_admin: '/dashboard/school-admin',
      student_member: '/dashboard/student',
    };

    router.replace(routes[user.user_role] || '/dashboard/student');
  }, [user, isLoading, router]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader label="Mengarahkan ke dashboard..." />
    </div>
  );
}
