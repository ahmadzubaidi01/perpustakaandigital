'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Users, Search, Plus, Pencil, Trash } from 'lucide-react';
import { usersAPI } from '@/lib/api';
import toast from 'react-hot-toast';

// Reusable UI components
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge, AccountStatusBadge } from '@/components/ui/Badge';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { DataTable } from '@/components/ui/DataTable';

const roleLabels: Record<string, string> = {
  super_admin: 'Super Admin',
  regency_admin: 'Admin Kabupaten',
  district_admin: 'Admin Kecamatan',
  school_admin: 'Admin Sekolah',
  student_member: 'Siswa',
};

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: 15, sort_by: 'created_at', sort_order: 'DESC' };
      if (search) params.search = search;
      if (roleFilter) params.user_role = roleFilter;
      const res = await usersAPI.list(params);
      setUsers(res.data.data || []);
      setTotalPages(res.data.metadata?.pagination?.total_pages || 1);
    } catch {
      toast.error('Gagal memuat pengguna');
    } finally {
      setLoading(false);
    }
  }, [page, search, roleFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Hapus pengguna "${name}"?`)) return;
    try {
      await usersAPI.delete(id);
      toast.success('Pengguna dihapus');
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal menghapus');
    }
  };

  const columns = [
    {
      key: 'full_name',
      label: 'Nama',
      render: (val: string, row: any) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 bg-[var(--color-primary-100)] text-[var(--color-primary-600)] dark:bg-[var(--color-primary-900)]/40 dark:text-[var(--color-primary-400)]">
            {row.full_name?.charAt(0)?.toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-bold text-[var(--heading)]">{row.full_name}</p>
            {row.student_id_number && (
              <p className="text-xs text-[var(--text-muted)] mt-0.5">NIS: {row.student_id_number}</p>
            )}
          </div>
        </div>
      )
    },
    {
      key: 'email_address',
      label: 'Email',
    },
    {
      key: 'user_role',
      label: 'Role',
      render: (val: string) => (
        <Badge variant="primary">{roleLabels[val] || val}</Badge>
      )
    },
    {
      key: 'school',
      label: 'Sekolah',
      render: (val: any) => val?.school_name || '-'
    },
    {
      key: 'account_status',
      label: 'Status',
      render: (val: string) => (
        <AccountStatusBadge status={val} />
      )
    },
    {
      key: 'actions',
      label: 'Aksi',
      render: (val: any, row: any) => (
        <div className="flex gap-1.5">
          <Link
            href={`/dashboard/users/${row.user_id}`}
            className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-border bg-transparent text-foreground hover:bg-secondary hover:text-primary active:scale-[0.98] transition-all"
            title="Edit Pengguna"
          >
            <Pencil size={14} />
          </Link>
          <Button
            variant="danger"
            size="sm"
            className="h-8 w-8 p-0!"
            onClick={() => handleDelete(row.user_id, row.full_name)}
            title="Hapus Pengguna"
          >
            <Trash size={14} />
          </Button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Pengguna"
        description="Kelola semua akun pengguna"
        action={
          <Link href="/dashboard/users/create" className="inline-flex items-center gap-1.5 h-10 px-4 text-sm font-semibold rounded-lg bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 transition-all">
            <Plus size={18} />
            Tambah Pengguna
          </Link>
        }
      />

      <Card hoverable={false} className="p-4!">
        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Cari nama, email, NIS..."
            leftIcon={<Search size={18} />}
            containerClassName="flex-1"
          />
          <Select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            containerClassName="sm:max-w-[200px]"
          >
            <option value="">Semua Role</option>
            {Object.entries(roleLabels).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      <DataTable
        columns={columns}
        data={users}
        loading={loading}
        emptyIcon={Users}
        emptyTitle="Belum ada pengguna"
        rowKey="user_id"
      />

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}

