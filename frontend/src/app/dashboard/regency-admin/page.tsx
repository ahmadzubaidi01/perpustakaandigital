'use client';

import { useEffect, useState } from 'react';
import { School, MapPin, Book, History, Activity } from 'lucide-react';
import { dashboardAPI } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { StatsCard } from '@/components/ui/StatsCard';
import { DataTable } from '@/components/ui/DataTable';
import { Skeleton } from '@/components/ui/Skeleton';

export default function RegencyAdminDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardAPI.regencyAdmin()
      .then((res) => setData(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const stats = data ? [
    { label: 'Total Sekolah', value: data.total_schools, icon: School, gradient: 'pink' as const },
    { label: 'Total Kecamatan', value: data.total_districts, icon: MapPin, gradient: 'blue' as const },
    { label: 'Total Katalog Buku', value: data.total_books, icon: Book, gradient: 'green' as const },
    { label: 'Total Sirkulasi', value: data.total_borrowings, icon: History, gradient: 'yellow' as const },
  ] : [];

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl">
      <PageHeader
        title="Dashboard Kabupaten"
        description="Ringkasan dan analitik sirkulasi perpustakaan tingkat Kabupaten."
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-6 stagger-children">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
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

      {/* District Activity */}
      <Card hoverable={false} className="p-6">
        <h3 className="text-base font-bold text-foreground mb-4">Metrik Distribusi per Kecamatan</h3>
        <DataTable
          columns={[
            {
              key: 'district_name',
              label: 'Nama Kecamatan',
              render: (_, row) => (
                <span className="font-semibold text-foreground">
                  {row.district?.district_name || '-'}
                </span>
              ),
            },
            {
              key: 'school_count',
              label: 'Jumlah Lembaga Sekolah',
              render: (_, row) => (
                <span className="text-muted-foreground font-medium">
                  {row.dataValues?.school_count || 0} unit
                </span>
              ),
            },
          ]}
          data={data?.district_activity || []}
          loading={loading}
          rowKey="district_id"
          emptyIcon={Activity}
          emptyTitle="Data Kecamatan Kosong"
          emptyDescription="Belum ada kecamatan dengan sekolah terdaftar dalam wilayah kabupaten ini."
        />
      </Card>
    </div>
  );
}

