'use client';

import { useEffect, useState } from 'react';
import { Book, School, Users, History, Activity, Globe } from 'lucide-react';
import { dashboardAPI } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { StatsCard } from '@/components/ui/StatsCard';
import { DataTable } from '@/components/ui/DataTable';
import { Skeleton } from '@/components/ui/Skeleton';

interface DashboardData {
  total_books: number;
  total_schools: number;
  total_students: number;
  total_borrowings: number;
  active_borrowings: number;
  online_users: number;
  region_analytics: any[];
  recent_audit_logs: any[];
}

export default function SuperAdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardAPI.superAdmin()
      .then((res) => {
        setData(res.data.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const stats = data ? [
    { label: 'Total Buku', value: data.total_books, icon: Book, gradient: 'pink' as const },
    { label: 'Total Sekolah', value: data.total_schools, icon: School, gradient: 'blue' as const },
    { label: 'Total Anggota', value: data.total_students, icon: Users, gradient: 'green' as const },
    { label: 'Total Sirkulasi', value: data.total_borrowings, icon: History, gradient: 'yellow' as const },
    { label: 'Peminjaman Aktif', value: data.active_borrowings, icon: Activity, gradient: 'pink' as const },
    { label: 'Sesi Online', value: data.online_users, icon: Globe, gradient: 'blue' as const },
  ] : [];

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl">
      <PageHeader
        title="Dashboard Eksekutif"
        description="Ringkasan metrik performa sirkulasi dan distribusi sekolah se-nasional."
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="rect" className="h-24 w-full rounded-2xl" />
          ))
        ) : (
          stats.map((stat) => (
            <StatsCard
              key={stat.label}
              label={stat.label}
              value={stat.value}
              icon={stat.icon}
              gradient={stat.gradient}
            />
          ))
        )}
      </div>

      {/* Recent Audit Logs */}
      <Card hoverable={false} className="p-6">
        <h3 className="text-base font-bold text-foreground mb-4">Log Audit Aktivitas Sistem</h3>
        <DataTable
          columns={[
            {
              key: 'action_type',
              label: 'Aktivitas',
              render: (val) => {
                const map: Record<string, 'success' | 'danger' | 'primary'> = {
                  INSERT: 'success',
                  UPDATE: 'primary',
                  DELETE: 'danger',
                };
                return <Badge variant={map[val] || 'primary'}>{val}</Badge>;
              },
            },
            {
              key: 'table_name',
              label: 'Entitas Modifikasi',
              render: (val) => <span className="font-mono text-xs text-muted-foreground">{val}</span>,
            },
            {
              key: 'performed_by',
              label: 'Pelaku Aksi',
              render: (val) => <span className="font-medium text-foreground">{val?.full_name || 'Sistem Otomatis'}</span>,
            },
            {
              key: 'created_at',
              label: 'Tenggat Waktu',
              render: (val) => (
                <span className="text-xs text-muted-foreground">
                  {new Date(val).toLocaleString('id-ID', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </span>
              ),
            },
          ]}
          data={data?.recent_audit_logs || []}
          loading={loading}
          rowKey="id"
          emptyIcon={Activity}
          emptyTitle="Log Audit Bersih"
          emptyDescription="Belum ada aktivitas modifikasi data (tambah, edit, hapus) dalam basis data saat ini."
        />
      </Card>
    </div>
  );
}

