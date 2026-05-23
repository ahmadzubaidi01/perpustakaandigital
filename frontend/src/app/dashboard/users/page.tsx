'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Users, Search, Plus, Pencil, Trash, Upload, Download, X, Loader2 } from 'lucide-react';
import { usersAPI, regionsAPI } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
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

const getDynamicRoleLabel = (u: any): string => {
  if (!u) return '';
  if (u.user_role === 'school_admin' && u.school?.school_name) {
    return `Admin ${u.school.school_name}`;
  }
  if (u.user_role === 'regency_admin' && u.regency?.regency_name) {
    return `Admin ${u.regency.regency_name}`;
  }
  if (u.user_role === 'district_admin' && u.district?.district_name) {
    return `Admin Kecamatan ${u.district.district_name}`;
  }
  return roleLabels[u.user_role] || u.user_role || '';
};

export default function UsersPage() {
  const { user: currentUser } = useAuthStore();
  const [schoolSearchQuery, setSchoolSearchQuery] = useState('');
  const [schoolsSearchResults, setSchoolsSearchResults] = useState<any[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<any | null>(null);
  const [searchingSchools, setSearchingSchools] = useState(false);

  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Bulk import states
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<any>(null);
  const [importing, setImporting] = useState(false);

  const handleDownloadTemplate = async (format: 'csv' | 'xlsx') => {
    try {
      const res = await usersAPI.importTemplate(format);
      const blob = new Blob([res.data], {
        type: format === 'xlsx' 
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
          : 'text/csv'
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `template_import_pengguna.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      toast.error('Gagal mengunduh template');
    }
  };

  const handleSchoolSearch = async (query: string) => {
    setSchoolSearchQuery(query);
    if (!query.trim()) {
      setSchoolsSearchResults([]);
      return;
    }
    setSearchingSchools(true);
    try {
      const params: any = { search: query, limit: 10 };
      if (currentUser?.user_role === 'regency_admin') {
        params.regency_id = currentUser.regency_id;
      } else if (currentUser?.user_role === 'district_admin') {
        params.district_id = currentUser.district_id;
      }
      const res = await regionsAPI.listSchools(params);
      setSchoolsSearchResults(res.data.data || []);
    } catch {
      toast.error('Gagal mencari sekolah');
    } finally {
      setSearchingSchools(false);
    }
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile) return;
    
    const isSchoolRequired = currentUser?.user_role && ['super_admin', 'regency_admin', 'district_admin'].includes(currentUser.user_role);
    if (isSchoolRequired && !selectedSchool) {
      toast.error('Silakan cari dan pilih sekolah tujuan terlebih dahulu');
      return;
    }

    setImporting(true);
    setImportResult(null);
    const formData = new FormData();
    formData.append('file', importFile);
    if (selectedSchool) {
      formData.append('school_id', String(selectedSchool.school_id));
    }
    try {
      const res = await usersAPI.import(formData);
      setImportResult(res.data.data);
      if (res.data.data.success_count > 0) {
        toast.success(`Berhasil mengimport ${res.data.data.success_count} pengguna!`);
        fetchUsers();
      } else {
        toast.error('Gagal mengimport pengguna. Silakan periksa detail kesalahan.');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal mengimport file');
    } finally {
      setImporting(false);
    }
  };

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
              <p className="text-xs text-[var(--text-muted)] mt-0.5">NISN: {row.student_id_number}</p>
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
      render: (val: string, row: any) => (
        <Badge variant="primary">{getDynamicRoleLabel(row)}</Badge>
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
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="md"
              onClick={() => setIsImportModalOpen(true)}
              leftIcon={<Upload size={16} />}
            >
              Import Pengguna
            </Button>
            <Link href="/dashboard/users/create" className="inline-flex items-center gap-1.5 h-10 px-4 text-sm font-semibold rounded-lg bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 transition-all">
              <Plus size={18} />
              Tambah Pengguna
            </Link>
          </div>
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
            placeholder="Cari nama, email, NISN..."
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

      {/* Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-fade-in">
          <Card hoverable={false} className="w-full max-w-lg p-6 relative border border-border shadow-xl bg-card max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => {
                setIsImportModalOpen(false);
                setImportFile(null);
                setImportResult(null);
                setSchoolSearchQuery('');
                setSchoolsSearchResults([]);
                setSelectedSchool(null);
              }}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <Upload className="text-primary" size={20} />
              <h3 className="text-lg font-bold text-foreground">Import Pengguna Bulk</h3>
            </div>
            
            <p className="text-xs text-muted-foreground mb-4">
              Import banyak akun sekaligus menggunakan file CSV atau Excel (.xlsx/.xls) sesuai format template resmi.
            </p>

            <div className="p-4 rounded-xl bg-muted/40 border border-border mb-6">
              <p className="text-xs font-bold text-foreground">Unduh Template Import</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 mb-3">Gunakan template ini untuk menyusun data pengguna dengan benar sesuai urutan kolom.</p>
              <div className="flex gap-2">
                <Button type="button" onClick={() => handleDownloadTemplate('csv')} variant="outline" size="sm" leftIcon={<Download size={14} />}>
                  Template CSV
                </Button>
                <Button type="button" onClick={() => handleDownloadTemplate('xlsx')} variant="outline" size="sm" leftIcon={<Download size={14} />}>
                  Template XLSX (Excel)
                </Button>
              </div>
            </div>

            <form onSubmit={handleImportSubmit} className="space-y-4">
              {currentUser?.user_role && ['super_admin', 'regency_admin', 'district_admin'].includes(currentUser.user_role) && (
                <div className="space-y-2 relative">
                  <label className="text-xs font-bold text-foreground">Sekolah Tujuan (Wajib)</label>
                  
                  {selectedSchool ? (
                    <div className="flex items-center justify-between p-3 rounded-xl border border-primary/20 bg-[var(--color-primary-100)]/10 dark:bg-[var(--color-primary-900)]/20">
                      <div>
                        <p className="text-xs font-bold text-foreground">{selectedSchool.school_name}</p>
                        <p className="text-[10px] text-[var(--text-muted)]">ID Sekolah: {selectedSchool.school_id}</p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 px-2.5 text-xs font-bold"
                        onClick={() => setSelectedSchool(null)}
                      >
                        Ubah
                      </Button>
                    </div>
                  ) : (
                    <div className="relative">
                      <Input
                        value={schoolSearchQuery}
                        onChange={(e) => handleSchoolSearch(e.target.value)}
                        placeholder="Ketik nama sekolah untuk mencari..."
                        leftIcon={<Search size={16} />}
                        className="text-xs"
                      />
                      
                      {/* Search Results Dropdown */}
                      {schoolSearchQuery.trim() !== '' && (
                        <div className="absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-card border border-border rounded-xl shadow-lg divide-y divide-border">
                          {searchingSchools ? (
                            <div className="p-3 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                              <Loader2 size={12} className="animate-spin text-primary" />
                              Mencari...
                            </div>
                          ) : schoolsSearchResults.length > 0 ? (
                            schoolsSearchResults.map((school) => (
                              <button
                                key={school.school_id}
                                type="button"
                                onClick={() => setSelectedSchool(school)}
                                className="w-full text-left px-4 py-2.5 text-xs hover:bg-muted/40 transition-colors flex flex-col gap-0.5"
                              >
                                <span className="font-bold text-foreground">{school.school_name}</span>
                                <span className="text-[10px] text-muted-foreground">Kec. {school.district?.district_name || '-'} • Kab. {school.regency?.regency_name || '-'}</span>
                              </button>
                            ))
                          ) : (
                            <div className="p-3 text-center text-xs text-muted-foreground">Sekolah tidak ditemukan</div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="border border-dashed border-border rounded-xl p-6 text-center bg-muted/10 hover:bg-muted/20 transition-colors">
                <input
                  type="file"
                  id="import-file-input"
                  accept=".csv,.xlsx,.xls"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    if (file && file.size > 10 * 1024 * 1024) {
                      toast.error('Ukuran dokumen maksimal 10MB');
                      return;
                    }
                    setImportFile(file);
                  }}
                  className="hidden"
                />
                <label htmlFor="import-file-input" className="cursor-pointer block">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
                    <Upload size={22} />
                  </div>
                  <span className="text-sm font-semibold text-foreground">
                    {importFile ? importFile.name : 'Pilih File Excel/CSV'}
                  </span>
                  <span className="text-xs text-muted-foreground block mt-1">
                    {importFile ? `${(importFile.size / 1024).toFixed(1)} KB` : 'Seret file ke sini atau klik untuk mencari'}
                  </span>
                </label>
              </div>

              {importFile && !importResult && (
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={() => setImportFile(null)}
                    disabled={importing}
                  >
                    Batal
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    disabled={importing}
                    leftIcon={importing && <Loader2 className="animate-spin" size={16} />}
                  >
                    {importing ? 'Mengimport...' : 'Jalankan Import'}
                  </Button>
                </div>
              )}
            </form>

            {importResult && (
              <div className="mt-6 space-y-4 animate-fade-in">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30">
                    <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 block">Selesai/Sukses</span>
                    <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1 block">
                      {importResult.success_count}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30">
                    <span className="text-[10px] uppercase font-bold text-red-600 dark:text-red-400 block">Gagal/Error</span>
                    <span className="text-2xl font-bold text-red-700 dark:text-red-300 mt-1 block">
                      {importResult.error_count}
                    </span>
                  </div>
                </div>

                {importResult.errors && importResult.errors.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Detail Kesalahan Baris</p>
                    <div className="max-h-40 overflow-y-auto border border-border rounded-xl divide-y divide-border bg-card">
                      {importResult.errors.map((err: any, idx: number) => (
                        <div key={idx} className="p-2.5 flex gap-2 text-xs">
                          <span className="font-bold text-red-500 shrink-0">Baris {err.row}:</span>
                          <span className="text-muted-foreground">{err.error}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end">
                  <Button
                    onClick={() => {
                      setIsImportModalOpen(false);
                      setImportFile(null);
                      setImportResult(null);
                    }}
                    variant="primary"
                    size="md"
                  >
                    Tutup
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

