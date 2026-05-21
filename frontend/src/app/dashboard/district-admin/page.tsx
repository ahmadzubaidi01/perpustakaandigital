'use client';

import { useEffect, useState } from 'react';
import { School, Book, History, Activity } from 'lucide-react';
import { dashboardAPI } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { StatsCard } from '@/components/ui/StatsCard';
import { DataTable } from '@/components/ui/DataTable';
import { Skeleton } from '@/components/ui/Skeleton';

export default function DistrictAdminDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardAPI.districtAdmin()
      .then((res) => setData(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const stats = data ? [
    { label: 'Total Sekolah', value: data.total_schools, icon: School, gradient: 'pink' as const },
    { label: 'Total Buku', value: data.total_books, icon: Book, gradient: 'blue' as const },
    { label: 'Total Peminjaman', value: data.total_borrowings, icon: History, gradient: 'green' as const },
  ] : [];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Dashboard Kecamatan"
        description="Ringkasan perpustakaan tingkat kecamatan"
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
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

      {/* Schools Activity */}
      <Card hoverable={false} className="p-6">
        <h2 className="text-lg font-bold mb-4 text-foreground">Sekolah di Kecamatan</h2>
        <DataTable
          columns={[
            {
              key: 'school_name',
              label: 'Sekolah',
              render: (_, row) => (
                <span className="font-semibold text-foreground">
                  {row.school?.school_name || '-'}
                </span>
              ),
            },
            {
              key: 'book_count',
              label: 'Jumlah Buku',
              render: (_, row) => (
                <span className="text-muted-foreground font-medium">
                  {row.dataValues?.book_count || 0}
                </span>
              ),
            },
            {
              key: 'total_available',
              label: 'Stok Tersedia',
              render: (_, row) => (
                <span className="text-muted-foreground font-medium">
                  {row.dataValues?.total_available || 0}
                </span>
              ),
            },
          ]}
          data={data?.school_activity || []}
          loading={loading}
          rowKey="school_id"
          emptyIcon={Activity}
          emptyTitle="Belum ada data"
          emptyDescription="Daftar sekolah di kecamatan ini akan muncul di sini jika data sudah dimasukkan"
        />
      </Card>
    </div>
  );
}
