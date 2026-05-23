'use client';

import { useEffect, useState, useCallback } from 'react';
import { History, Check, RotateCcw, Trash2, Download } from 'lucide-react';
import { borrowingsAPI, regionsAPI } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import toast from 'react-hot-toast';

// Reusable UI components
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { DataTable, DataTableColumn } from '@/components/ui/DataTable';
import { Select } from '@/components/ui/Select';

export default function BorrowingsPage() {
  const { user } = useAuthStore();
  const isAdmin = ['super_admin', 'regency_admin', 'district_admin', 'school_admin'].includes(user?.user_role || '');

  const [borrowings, setBorrowings] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Regional filters state
  const [regencies, setRegencies] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);
  const [schools, setSchools] = useState<any[]>([]);

  const [selectedRegency, setSelectedRegency] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedSchool, setSelectedSchool] = useState('');

  const isSuperAdmin = user?.user_role === 'super_admin';
  const isRegencyAdmin = user?.user_role === 'regency_admin';
  const isDistrictAdmin = user?.user_role === 'district_admin';

  const canDelete = ['super_admin', 'regency_admin', 'district_admin'].includes(user?.user_role || '');

  // Reset selectedIds when filter/page changes to prevent actions on off-screen rows
  useEffect(() => {
    setSelectedIds([]);
  }, [page, statusFilter, selectedRegency, selectedDistrict, selectedSchool]);

  // Load initial dropdown data based on roles
  useEffect(() => {
    if (isSuperAdmin) {
      regionsAPI.listRegencies()
        .then((res) => setRegencies(res.data.data || []))
        .catch(() => toast.error('Gagal memuat daftar kabupaten'));
    } else if (isRegencyAdmin && user?.regency_id) {
      regionsAPI.listDistricts({ regency_id: user.regency_id })
        .then((res) => setDistricts(res.data.data || []))
        .catch(() => toast.error('Gagal memuat daftar kecamatan'));
    } else if (isDistrictAdmin && user?.district_id) {
      regionsAPI.listSchools({ district_id: user.district_id })
        .then((res) => setSchools(res.data.data || []))
        .catch(() => toast.error('Gagal memuat daftar sekolah'));
    }
  }, [user, isSuperAdmin, isRegencyAdmin, isDistrictAdmin]);

  // Load districts when regency changes (Super Admin only)
  useEffect(() => {
    if (isSuperAdmin) {
      if (selectedRegency) {
        regionsAPI.listDistricts({ regency_id: Number(selectedRegency) })
          .then((res) => setDistricts(res.data.data || []))
          .catch(() => toast.error('Gagal memuat daftar kecamatan'));
      } else {
        setDistricts([]);
        setSchools([]);
      }
      setSelectedDistrict('');
      setSelectedSchool('');
    }
  }, [selectedRegency, isSuperAdmin]);

  // Load schools when district changes (Super Admin and Regency Admin)
  useEffect(() => {
    if (isSuperAdmin || isRegencyAdmin) {
      if (selectedDistrict) {
        regionsAPI.listSchools({ district_id: Number(selectedDistrict) })
          .then((res) => setSchools(res.data.data || []))
          .catch(() => toast.error('Gagal memuat daftar sekolah'));
      } else {
        setSchools([]);
      }
      setSelectedSchool('');
    }
  }, [selectedDistrict, isSuperAdmin, isRegencyAdmin]);

  const handleRegencyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedRegency(e.target.value);
    setPage(1);
  };
  const handleDistrictChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedDistrict(e.target.value);
    setPage(1);
  };
  const handleSchoolChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedSchool(e.target.value);
    setPage(1);
  };

  const fetchBorrowings = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: 15, sort_by: 'created_at', sort_order: 'DESC' };
      if (statusFilter) params.borrowing_status = statusFilter;

      // Apply regional parameter filters
      if (selectedSchool) params.school_id = selectedSchool;
      else if (selectedDistrict) params.district_id = selectedDistrict;
      else if (selectedRegency) params.regency_id = selectedRegency;

      const res = await borrowingsAPI.list(params);
      setBorrowings(res.data.data || []);
      setTotalPages(res.data.metadata?.pagination?.total_pages || 1);
    } catch {
      toast.error('Gagal memuat data peminjaman');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, selectedRegency, selectedDistrict, selectedSchool]);

  useEffect(() => {
    fetchBorrowings();
  }, [fetchBorrowings]);

  const handleAction = async (id: number, action: 'approve' | 'return' | 'extend') => {
    try {
      if (action === 'approve') await borrowingsAPI.approve(id);
      else if (action === 'return') await borrowingsAPI.return(id);
      else await borrowingsAPI.extend(id);
      toast.success('Berhasil!');
      fetchBorrowings();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Apakah Anda yakin ingin menghapus transaksi peminjaman ini secara permanen dari basis data? Tindakan ini tidak dapat dibatalkan.')) return;
    try {
      await borrowingsAPI.delete(id);
      toast.success('Transaksi peminjaman berhasil dihapus');
      fetchBorrowings();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal menghapus transaksi');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Apakah Anda yakin ingin menghapus ${selectedIds.length} transaksi peminjaman terpilih secara permanen? Tindakan ini tidak dapat dibatalkan.`)) return;
    
    try {
      await borrowingsAPI.bulkDelete(selectedIds);
      toast.success('Transaksi peminjaman terpilih berhasil dihapus');
      setSelectedIds([]);
      fetchBorrowings();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal menghapus transaksi terpilih');
    }
  };

  const handleExport = async () => {
    const loadingToast = toast.loading('Mengekspor data...');
    try {
      const params: any = { limit: 5000, sort_by: 'created_at', sort_order: 'DESC' };
      if (statusFilter) params.borrowing_status = statusFilter;
      if (selectedSchool) params.school_id = selectedSchool;
      else if (selectedDistrict) params.district_id = selectedDistrict;
      else if (selectedRegency) params.regency_id = selectedRegency;

      const res = await borrowingsAPI.list(params);
      const list = res.data.data || [];

      if (list.length === 0) {
        toast.dismiss(loadingToast);
        toast.error('Tidak ada data untuk diekspor');
        return;
      }

      // Convert to CSV
      const headers = ['No', 'Kode Peminjaman', 'Judul Buku', 'Peminjam', 'NISN', 'Kelas', 'Status', 'Tanggal Pinjam', 'Tenggat', 'Tanggal Kembali', 'Denda'];
      const csvRows = [headers.join(',')];

      list.forEach((row: any, index: number) => {
        const no = index + 1;
        const code = `"${row.borrowing_code || ''}"`;
        const bookTitle = `"${(row.book_qr?.book?.book_title || '').replace(/"/g, '""')}"`;
        const borrower = `"${(row.borrower?.full_name || '').replace(/"/g, '""')}"`;
        const nisn = `"${row.borrower?.student_id_number || ''}"`;
        const className = `"${row.borrower?.class_name || ''}"`;
        const status = `"${row.borrowing_status || ''}"`;
        const borrowDate = row.borrowed_at ? `"${new Date(row.borrowed_at).toLocaleString('id-ID')}"` : '""';
        const dueDate = row.due_date ? `"${new Date(row.due_date).toLocaleString('id-ID')}"` : '""';
        const returnDate = row.returned_at ? `"${new Date(row.returned_at).toLocaleString('id-ID')}"` : '""';
        const penalty = row.late_penalty_amount || 0;

        const rowValues = [no, code, bookTitle, borrower, nisn, className, status, borrowDate, dueDate, returnDate, penalty];
        csvRows.push(rowValues.join(','));
      });

      const csvContent = '\uFEFF' + csvRows.join('\n'); // Add BOM for Excel UTF-8 support
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `riwayat_peminjaman_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.dismiss(loadingToast);
      toast.success('Data berhasil diekspor ke CSV!');
    } catch {
      toast.dismiss(loadingToast);
      toast.error('Gagal mengekspor data');
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { variant: 'warning' | 'info' | 'primary' | 'success' | 'danger' | 'neutral'; label: string }> = {
      pending: { variant: 'warning', label: 'Menunggu' },
      approved: { variant: 'info', label: 'Disetujui' },
      borrowed: { variant: 'primary', label: 'Dipinjam' },
      returned: { variant: 'success', label: 'Dikembalikan' },
      late: { variant: 'danger', label: 'Terlambat' },
      cancelled: { variant: 'neutral', label: 'Dibatalkan' },
    };
    const s = map[status] || { variant: 'neutral' as const, label: status };
    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  const columns: DataTableColumn[] = [
    ...(isSuperAdmin
      ? [
          {
            key: 'checkbox',
            label: (
              <input
                type="checkbox"
                className="rounded border-border text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                checked={borrowings.length > 0 && borrowings.every((b) => selectedIds.includes(b.borrowing_id))}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  if (e.target.checked) {
                    setSelectedIds((prev) => {
                      const pageIds = borrowings.map((b) => b.borrowing_id);
                      const combined = Array.from(new Set([...prev, ...pageIds]));
                      return combined;
                    });
                  } else {
                    setSelectedIds((prev) => {
                      const pageIds = borrowings.map((b) => b.borrowing_id);
                      return prev.filter((id) => !pageIds.includes(id));
                    });
                  }
                }}
              />
            ),
            render: (_: any, row: any) => (
              <input
                type="checkbox"
                className="rounded border-border text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                checked={selectedIds.includes(row.borrowing_id)}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  if (e.target.checked) {
                    setSelectedIds((prev) => [...prev, row.borrowing_id]);
                  } else {
                    setSelectedIds((prev) => prev.filter((id) => id !== row.borrowing_id));
                  }
                }}
              />
            ),
          },
        ]
      : []),
    {
      key: 'number',
      label: 'No',
      render: (_, __, index) => (
        <span className="text-xs text-muted-foreground font-semibold">
          {index + 1 + (page - 1) * 15}
        </span>
      ),
    },
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
              <div className="flex flex-col">
                <span className="font-semibold text-foreground">
                  {row.borrower?.full_name || '-'}
                </span>
                {(row.borrower?.student_id_number || row.borrower?.class_name) && (
                  <span className="text-[10px] text-muted-foreground mt-0.5">
                    {row.borrower?.student_id_number ? `NISN: ${row.borrower.student_id_number}` : ''}
                    {row.borrower?.student_id_number && row.borrower?.class_name ? ' • ' : ''}
                    {row.borrower?.class_name ? `Kelas: ${row.borrower.class_name}` : ''}
                  </span>
                )}
              </div>
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
          {val ? new Date(val).toLocaleString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
        </span>
      ),
    },
    {
      key: 'due_date',
      label: 'Tenggat',
      render: (val) => (
        <span className="text-muted-foreground">
          {val ? new Date(val).toLocaleString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
        </span>
      ),
    },
    {
      key: 'returned_at',
      label: 'Dikembalikan Pada',
      render: (val) => (
        <span className="text-muted-foreground">
          {val ? new Date(val).toLocaleString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
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
                {canDelete && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleDelete(row.borrowing_id)}
                    title="Hapus Riwayat"
                  >
                    <Trash2 size={14} />
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
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <PageHeader
          title="Peminjaman"
          description={isAdmin ? 'Kelola semua transaksi peminjaman' : 'Riwayat peminjaman Anda'}
        />
        {isAdmin && (
          <div className="flex gap-2 sm:self-end">
            {isSuperAdmin && selectedIds.length > 0 && (
              <Button
                variant="danger"
                leftIcon={<Trash2 size={16} />}
                onClick={handleBulkDelete}
              >
                Hapus Terpilih ({selectedIds.length})
              </Button>
            )}
            <Button
              variant="outline"
              leftIcon={<Download size={16} />}
              onClick={handleExport}
              disabled={loading || borrowings.length === 0}
            >
              Ekspor CSV
            </Button>
          </div>
        )}
      </div>

      {/* Cascading Region Dropdown Filters */}
      {isAdmin && (isSuperAdmin || isRegencyAdmin || isDistrictAdmin) && (
        <Card hoverable={false} className="p-4">
          <h3 className="text-sm font-bold mb-3 text-foreground">Filter Wilayah Kerja</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {isSuperAdmin && (
              <Select
                label="Kabupaten"
                value={selectedRegency}
                onChange={handleRegencyChange}
                options={[
                  { label: '— Semua Kabupaten —', value: '' },
                  ...regencies.map((r) => ({ label: r.regency_name, value: r.regency_id })),
                ]}
              />
            )}

            {(isSuperAdmin || isRegencyAdmin) && (
              <Select
                label="Kecamatan"
                value={selectedDistrict}
                onChange={handleDistrictChange}
                disabled={isSuperAdmin && !selectedRegency}
                options={[
                  { label: '— Semua Kecamatan —', value: '' },
                  ...districts.map((d) => ({ label: d.district_name, value: d.district_id })),
                ]}
              />
            )}

            {(isSuperAdmin || isRegencyAdmin || isDistrictAdmin) && (
              <Select
                label="Sekolah"
                value={selectedSchool}
                onChange={handleSchoolChange}
                disabled={(isSuperAdmin || isRegencyAdmin) && !selectedDistrict}
                options={[
                  { label: '— Semua Sekolah —', value: '' },
                  ...schools.map((s) => ({ label: s.school_name, value: s.school_id })),
                ]}
              />
            )}
          </div>
        </Card>
      )}

      {/* Filter Status */}
      <Card hoverable={false} className="p-4">
        <div className="flex flex-wrap gap-2">
          {[
            { key: '', label: 'Semua' },
            { key: 'pending', label: 'Menunggu' },
            { key: 'approved', label: 'Disetujui' },
            { key: 'borrowed', label: 'Dipinjam' },
            { key: 'late', label: 'Terlambat' },
            { key: 'returned', label: 'Dikembalikan' },
            { key: 'cancelled', label: 'Dibatalkan' },
          ].map((item) => (
            <Button
              key={item.key}
              variant={statusFilter === item.key ? 'primary' : 'outline'}
              size="sm"
              onClick={() => {
                setStatusFilter(item.key);
                setPage(1);
              }}
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
