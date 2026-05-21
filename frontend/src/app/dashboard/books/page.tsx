'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Search, Plus, Book } from 'lucide-react';
import { booksAPI, categoriesAPI } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import toast from 'react-hot-toast';

// Reusable UI components
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { BookStatusBadge } from '@/components/ui/Badge';
import { TableSkeleton, GridSkeleton } from '@/components/ui/Skeleton';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { DataTable } from '@/components/ui/DataTable';

export default function BooksPage() {
  const { user } = useAuthStore();
  const isAdmin = ['super_admin', 'regency_admin', 'district_admin', 'school_admin'].includes(user?.user_role || '');

  const [books, setBooks] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  const fetchBooks = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: 12, sort_by: 'created_at', sort_order: 'DESC' };
      if (search) params.search = search;
      if (categoryFilter) params.category_id = categoryFilter;
      if (statusFilter) params.book_status = statusFilter;
      const res = await booksAPI.list(params);
      setBooks(res.data.data || []);
      setTotalPages(res.data.metadata?.pagination?.total_pages || 1);
    } catch {
      toast.error('Gagal memuat buku');
    } finally {
      setLoading(false);
    }
  }, [page, search, categoryFilter, statusFilter]);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  useEffect(() => {
    categoriesAPI
      .list()
      .then((r) => setCategories(r.data.data || []))
      .catch(() => {});
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchBooks();
  };

  const columns = [
    {
      key: 'book_title',
      label: 'Judul',
      render: (val: string, row: any) => (
        <Link href={`/dashboard/books/${row.book_id}`} className="font-bold text-[var(--heading)] hover:text-[var(--color-primary-600)] hover:underline">
          {row.book_title}
        </Link>
      )
    },
    {
      key: 'author_name',
      label: 'Penulis',
    },
    {
      key: 'category',
      label: 'Kategori',
      render: (val: any) => val?.category_name || '-'
    },
    {
      key: 'book_status',
      label: 'Status',
      render: (val: string) => (
        <BookStatusBadge status={val} />
      )
    },
    {
      key: 'stock',
      label: 'Stok',
      render: (val: any, row: any) => (
        <span className="text-sm font-semibold text-[var(--text-secondary)]">
          {row.available_stock}/{row.total_stock}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Koleksi Buku"
        description="Jelajahi dan kelola koleksi perpustakaan"
        action={
          isAdmin && (
            <Link href="/dashboard/books/create" className="inline-flex items-center justify-center font-medium h-10 px-4 text-sm rounded-lg bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 transition-all gap-1.5">
              <Plus size={18} />
              Tambah Buku
            </Link>
          )
        }
      />

      {/* Filters */}
      <Card hoverable={false} className="p-4!">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari judul, penulis, ISBN..."
            leftIcon={<Search size={18} />}
            containerClassName="flex-1"
          />
          <Select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            containerClassName="sm:max-w-[200px]"
          >
            <option value="">Semua Kategori</option>
            {categories.map((c: any) => (
              <option key={c.category_id} value={c.category_id}>
                {c.category_name}
              </option>
            ))}
          </Select>
          <Select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            containerClassName="sm:max-w-[160px]"
          >
            <option value="">Semua Status</option>
            <option value="available">Tersedia</option>
            <option value="borrowed">Dipinjam</option>
            <option value="reserved">Dipesan</option>
            <option value="maintenance">Perawatan</option>
          </Select>
          <div className="flex gap-1">
            <Button
              type="button"
              variant={viewMode === 'grid' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setViewMode('grid')}
            >
              Grid
            </Button>
            <Button
              type="button"
              variant={viewMode === 'table' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setViewMode('table')}
            >
              Tabel
            </Button>
          </div>
        </form>
      </Card>

      {/* Books List */}
      {loading ? (
        viewMode === 'grid' ? (
          <GridSkeleton cards={12} itemClassName="aspect-[3/5]" />
        ) : (
          <TableSkeleton rows={12} />
        )
      ) : books.length ? (
        viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 stagger-children">
            {books.map((book) => (
              <Link key={book.book_id} href={`/dashboard/books/${book.book_id}`} className="group">
                <Card hoverable className="p-0! overflow-hidden h-full flex flex-col justify-between">
                  <div
                    className="aspect-[3/4] overflow-hidden relative"
                    style={{ background: 'var(--muted)' }}
                  >
                    {book.cover_image_url ? (
                      <img
                        src={
                          book.cover_image_url.startsWith('http')
                            ? book.cover_image_url
                            : `http://localhost:5000${book.cover_image_url.startsWith('/') ? '' : '/'}${book.cover_image_url}`
                        }
                        alt={book.book_title}
                        className="w-full h-full object-cover transition-all duration-500 group-hover:scale-110"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Book size={36} style={{ color: 'var(--text-placeholder)' }} />
                      </div>
                    )}
                  </div>
                  <div className="p-3 border-t flex-1 flex flex-col justify-between" style={{ borderColor: 'var(--border)' }}>
                    <div>
                      <p
                        className="text-sm font-bold truncate transition-colors group-hover:text-[var(--color-primary-600)]"
                        style={{ color: 'var(--heading)' }}
                      >
                        {book.book_title}
                      </p>
                      <p className="text-xs truncate mb-2" style={{ color: 'var(--text-secondary)' }}>
                        {book.author_name}
                      </p>
                    </div>
                    <div className="flex items-center justify-between mt-auto">
                      <BookStatusBadge status={book.book_status} />
                      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        {book.available_stock}/{book.total_stock}
                      </span>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={books}
            loading={loading}
            emptyIcon={Book}
            emptyTitle="Belum ada buku"
            rowKey="book_id"
          />
        )
      ) : (
        <EmptyState
          icon={Book}
          title="Belum ada buku"
          description="Tambahkan buku pertama ke koleksi perpustakaan"
        />
      )}

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}

