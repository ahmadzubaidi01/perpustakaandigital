'use client';

import { useEffect, useState, useCallback } from 'react';
import { History, Check, RotateCcw } from 'lucide-react';
import { borrowingsAPI } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import toast from 'react-hot-toast';

// Reusable UI components
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { DataTable, DataTableColumn } from '@/components/ui/DataTable';

export default function BorrowingsPage() {
  const { user } = useAuthStore();
  const isAdmin = ['super_admin', 'regency_admin', 'district_admin', 'school_admin'].includes(user?.user_role || '');

  const [borrowings, setBorrowings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchBorrowings = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: 15, sort_by: 'created_at', sort_order: 'DESC' };
      if (statusFilter) params.borrowing_status = statusFilter;
      const res = await borrowingsAPI.list(params);
      setBorrowings(res.data.data || []);
      setTotalPages(res.data.metadata?.pagination?.total_pages || 1);
    } catch { toast.error('Gagal memuat data peminjaman'); }
    finally { setLoading(false); }
  }, [page, statusFilter]);

  useEffect(() => { fetchBorrowings(); }, [fetchBorrowings]);

  const handleAction = async (id: number, action: 'approve' | 'return' | 'extend') => {
    try {
      if (action === 'approve') await borrowingsAPI.approve(id);
      else if (action === 'return') await borrowingsAPI.return(id);
      else await borrowingsAPI.extend(id);
      toast.success('Berhasil!');
      fetchBorrowings();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Gagal'); }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { variant: 'warning' | 'info' | 'primary' | 'success' | 'danger' | 'neutral'; label: string }> = {
      pending: { variant: 'warning', label: 'Menunggu' },
      approved: { variant: 'info', label: 'Disetujui' },
      borrowed: { variant: 'primary', label: 'Dipinjam' },
      reserved: { variant: 'info', label: 'Dipesan' },
      returned: { variant: 'success', label: 'Dikembalikan' },
      late: { variant: 'danger', label: 'Terlambat' },
      cancelled: { variant: 'neutral', label: 'Dibatalkan' },
    };
    const s = map[status] || { variant: 'neutral' as const, label: status };
    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  const columns: DataTableColumn[] = [
    {
      key: 'borrowing_code',
      label: 'Kode',
      render: (val) => (
        <span className="text-xs font-mono font-bold text-primary">
          {val}
        </span>
      ),
    },
    {
      key: 'book_title',
      label: 'Buku',
      render: (_, row) => (
        <span className="font-semibold text-foreground">
          {row.book_qr?.book?.book_title || '-'}
        </span>
      ),
    },
    ...(isAdmin
      ? [
          {
            key: 'borrower',
            label: 'Peminjam',
            render: (_: any, row: any) => (
              <span className="text-muted-foreground">
                {row.borrower?.full_name || '-'}
              </span>
            ),
          },
        ]
      : []),
    {
      key: 'borrowing_status',
      label: 'Status',
      render: (val) => statusBadge(val),
    },
    {
      key: 'borrowed_at',
      label: 'Tanggal Pinjam',
      render: (val) => (
        <span className="text-muted-foreground">
          {val ? new Date(val).toLocaleDateString('id-ID') : '-'}
        </span>
      ),
    },
    {
      key: 'due_date',
      label: 'Tenggat',
      render: (val) => (
        <span className="text-muted-foreground">
          {val ? new Date(val).toLocaleDateString('id-ID') : '-'}
        </span>
      ),
    },
    {
      key: 'late_penalty_amount',
      label: 'Denda',
      render: (val) =>
        val > 0 ? (
          <Badge variant="danger">Rp{Number(val).toLocaleString()}</Badge>
        ) : (
          <span className="text-muted-foreground/60">-</span>
        ),
    },
    ...(isAdmin
      ? [
          {
            key: 'actions',
            label: 'Aksi',
            render: (_: any, row: any) => (
              <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                {row.borrowing_status === 'pending' && (
                  <Button
                    variant="success"
                    size="sm"
                    onClick={() => handleAction(row.borrowing_id, 'approve')}
                    title="Setujui"
                  >
                    <Check size={14} />
                  </Button>
                )}
                {(row.borrowing_status === 'borrowed' || row.borrowing_status === 'late') && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleAction(row.borrowing_id, 'return')}
                    title="Kembalikan"
                  >
                    <RotateCcw size={14} />
                  </Button>
                )}
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Peminjaman"
        description={isAdmin ? 'Kelola semua transaksi peminjaman' : 'Riwayat peminjaman Anda'}
      />

      {/* Filter */}
      <Card hoverable={false} className="p-4">
        <div className="flex flex-wrap gap-2">
          {[
            { key: '', label: 'Semua' },
            { key: 'pending', label: 'Menunggu' },
            { key: 'borrowed', label: 'Dipinjam' },
            { key: 'late', label: 'Terlambat' },
            { key: 'returned', label: 'Dikembalikan' },
            { key: 'cancelled', label: 'Dibatalkan' },
          ].map((item) => (
            <Button
              key={item.key}
              variant={statusFilter === item.key ? 'primary' : 'outline'}
              size="sm"
              onClick={() => { setStatusFilter(item.key); setPage(1); }}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </Card>

      {/* Table */}
      <DataTable
        columns={columns}
        data={borrowings}
        loading={loading}
        rowKey="borrowing_id"
        emptyIcon={History}
        emptyTitle="Belum ada peminjaman"
        emptyDescription="Riwayat peminjaman akan muncul di sini jika ada transaksi aktif"
      />

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
