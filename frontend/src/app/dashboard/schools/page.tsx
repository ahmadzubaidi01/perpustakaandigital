'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { School, Plus, Pencil, Trash } from 'lucide-react';
import { regionsAPI } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import toast from 'react-hot-toast';

// Reusable UI components
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { DataTable } from '@/components/ui/DataTable';
import { SearchBar } from '@/components/ui/SearchBar';

export default function SchoolsPage() {
  const [schools, setSchools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const { user } = useAuthStore();

  const isDistrictAdminOrHigher = ['super_admin', 'regency_admin', 'district_admin'].includes(user?.user_role || '');
  const isRegencyAdminOrHigher = ['super_admin', 'regency_admin'].includes(user?.user_role || '');

  const fetchSchools = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: 15, sort_by: 'created_at', sort_order: 'DESC' };
      if (search) params.search = search;
      const res = await regionsAPI.listSchools(params);
      setSchools(res.data.data || []);
      setTotalPages(res.data.metadata?.pagination?.total_pages || 1);
    } catch { 
      toast.error('Gagal memuat sekolah'); 
    } finally { 
      setLoading(false); 
    }
  }, [page, search]);

  useEffect(() => { 
    fetchSchools(); 
  }, [fetchSchools]);

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus sekolah "${name}"?`)) return;
    try {
      await regionsAPI.deleteSchool(id);
      toast.success('Sekolah berhasil dihapus');
      fetchSchools();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal menghapus sekolah');
    }
  };

  const columns = [
    {
      key: 'school_name',
      label: 'Nama Sekolah',
      render: (val: string, row: any) => (
        <div>
          <p className="text-sm font-bold text-foreground">{row.school_name}</p>
          {row.school_address && <p className="text-xs text-muted-foreground mt-0.5">{row.school_address}</p>}
        </div>
      )
    },
    {
      key: 'district',
      label: 'Kecamatan',
      render: (val: any) => val?.district_name || '-'
    },
    {
      key: 'regency',
      label: 'Kabupaten',
      render: (val: any) => val?.regency_name || '-'
    },
    {
      key: 'school_status',
      label: 'Status',
      render: (val: string) => (
        <Badge variant={val === 'active' ? 'success' : 'danger'}>
          {val === 'active' ? 'Aktif' : 'Nonaktif'}
        </Badge>
      )
    },
    ...(isDistrictAdminOrHigher ? [{
      key: 'actions',
      label: 'Aksi',
      render: (val: any, row: any) => (
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          <Link href={`/dashboard/schools/${row.school_id}`}>
            <Button variant="outline" size="sm" title="Edit Sekolah">
              <Pencil size={14} />
            </Button>
          </Link>
          {isRegencyAdminOrHigher && (
            <Button 
              variant="danger"
              size="sm"
              onClick={() => handleDelete(row.school_id, row.school_name)} 
              title="Hapus Sekolah"
            >
              <Trash size={14} />
            </Button>
          )}
        </div>
      )
    }] : [])
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Sekolah"
        description="Kelola data sekolah dan batasan wilayahnya"
        action={
          isDistrictAdminOrHigher && (
            <Link href="/dashboard/schools/create">
              <Button variant="primary" leftIcon={<Plus size={18} />}>
                Tambah Sekolah
              </Button>
            </Link>
          )
        }
      />

      <Card hoverable={false} className="p-4">
        <SearchBar 
          value={search} 
          onChange={(e) => { setSearch(e.target.value); setPage(1); }} 
          placeholder="Cari sekolah..." 
        />
      </Card>

      <DataTable
        columns={columns}
        data={schools}
        loading={loading}
        emptyIcon={School}
        emptyTitle="Belum ada sekolah"
        rowKey="school_id"
      />

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
