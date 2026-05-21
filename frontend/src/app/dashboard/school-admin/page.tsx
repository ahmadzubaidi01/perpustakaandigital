'use client';

import { useEffect, useState } from 'react';
import { Book, History, Users, BookOpen, TrendingUp, Clock, Activity } from 'lucide-react';
import { dashboardAPI } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { StatsCard } from '@/components/ui/StatsCard';
import { DataTable } from '@/components/ui/DataTable';
import { Skeleton } from '@/components/ui/Skeleton';

export default function SchoolAdminDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardAPI.schoolAdmin()
      .then((res) => setData(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const stats = data ? [
    { label: 'Total Buku', value: data.total_books, icon: Book, gradient: 'pink' as const },
    { label: 'Buku Tersedia', value: data.available_books, icon: BookOpen, gradient: 'blue' as const },
    { label: 'Sedang Dipinjam', value: data.borrowed_books, icon: History, gradient: 'green' as const },
    { label: 'Peminjaman Hari Ini', value: data.daily_borrowings, icon: TrendingUp, gradient: 'yellow' as const },
    { label: 'Pengembalian Hari Ini', value: data.daily_returns, icon: Clock, gradient: 'pink' as const },
  ] : [];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Dashboard Sekolah"
        description="Ringkasan perpustakaan sekolah Anda"
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} variant="rect" className="h-[104px]" />
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Popular Books */}
        <Card hoverable={false} className="p-6">
          <h2 className="text-lg font-bold mb-4 text-foreground">Buku Populer</h2>
          <DataTable
            columns={[
              {
                key: 'rank',
                label: 'Peringkat',
                render: (_, __, idx) => (
                  <span className="text-sm font-bold text-primary">
                    #{idx !== undefined ? idx + 1 : '-'}
                  </span>
                ),
                headerClassName: 'w-[80px]',
                cellClassName: 'text-center',
              },
              {
                key: 'book_title',
                label: 'Judul Buku',
                render: (_, row) => (
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">
                      {row.book_qr?.book?.book_title || 'Unknown'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {row.book_qr?.book?.author_name || '-'}
                    </p>
                  </div>
                ),
              },
              {
                key: 'borrow_count',
                label: 'Peminjaman',
                render: (_, row) => (
                  <Badge variant="primary">
                    {(row.borrow_count ?? row.dataValues?.borrow_count ?? 0)}x
                  </Badge>
                ),
                headerClassName: 'w-[100px]',
                cellClassName: 'text-right',
              },
            ]}
            data={data?.popular_books || []}
            loading={loading}
            rowKey="book_id"
            emptyIcon={Activity}
            emptyTitle="Belum ada data"
            emptyDescription="Data buku populer akan muncul di sini setelah ada peminjaman"
          />
        </Card>

        {/* Top Borrowers */}
        <Card hoverable={false} className="p-6">
          <h2 className="text-lg font-bold mb-4 text-foreground">Peminjam Teraktif</h2>
          <DataTable
            columns={[
              {
                key: 'borrower',
                label: 'Anggota',
                render: (borrower) => (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shadow-inner shrink-0">
                      {borrower?.full_name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">
                        {borrower?.full_name || 'Unknown'}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        Kelas: {borrower?.class_name || '-'}
                      </p>
                    </div>
                  </div>
                ),
              },
              {
                key: 'borrow_count',
                label: 'Jumlah Pinjam',
                render: (_, row) => (
                  <Badge variant="success">
                    {(row.borrow_count ?? row.dataValues?.borrow_count ?? 0)} buku
                  </Badge>
                ),
                headerClassName: 'w-[130px]',
                cellClassName: 'text-right',
              },
            ]}
            data={data?.top_borrowers || []}
            loading={loading}
            rowKey="borrower_id"
            emptyIcon={Users}
            emptyTitle="Belum ada data"
            emptyDescription="Data peminjam teraktif akan muncul di sini setelah ada peminjaman"
          />
        </Card>
      </div>
    </div>
  );
}
