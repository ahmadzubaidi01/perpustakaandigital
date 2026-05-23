'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Book, History, Star, BookOpen, Clock, ArrowRight } from 'lucide-react';
import { booksAPI, borrowingsAPI, getMediaUrl } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/Badge';

export default function StudentDashboard() {
  const { user } = useAuthStore();
  const [recentBooks, setRecentBooks] = useState<any[]>([]);
  const [activeBorrowings, setActiveBorrowings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      booksAPI.list({ limit: 6, sort_by: 'created_at', sort_order: 'DESC' }),
      borrowingsAPI.list({ user_id: user?.user_id, limit: 20 }),
    ])
      .then(([booksRes, borrowingsRes]) => {
        setRecentBooks(booksRes.data.data || []);
        const borrowingsList = borrowingsRes.data.data || [];
        const activeList = borrowingsList.filter((b: any) =>
          ['pending', 'approved', 'borrowed', 'late'].includes(b.borrowing_status)
        ).slice(0, 5);
        setActiveBorrowings(activeList);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.user_id]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome */}
      <Card
        hoverable={false}
        className="p-6 border-l-4 border-l-primary"
      >
        <h1 className="text-xl font-bold text-foreground">
          Selamat datang, {user?.full_name?.split(' ')[0]}! 👋
        </h1>
        <p className="text-sm mt-1 text-muted-foreground">
          {user?.school?.school_name || 'Perpustakaan Digital'} — {user?.class_name || 'Anggota'}
        </p>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Cari Buku', href: '/dashboard/books', icon: Book, color: 'var(--primary)' },
          { label: 'Scan QR', href: '/dashboard/qr', icon: BookOpen, color: 'var(--ring)' },
          { label: 'Peminjaman', href: '/dashboard/borrowings', icon: History, color: 'var(--success)' },
          { label: 'Favorit', href: '/dashboard/reviews', icon: Star, color: 'var(--warning)' },
        ].map((action) => (
          <Link key={action.href} href={action.href}>
            <Card
              className="flex flex-col items-center justify-center text-center gap-2 p-5 cursor-pointer hover:-translate-y-1 hover:shadow-md transition-all duration-300"
            >
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center bg-muted"
              >
                <action.icon size={22} style={{ color: action.color }} />
              </div>
              <span className="text-sm font-semibold text-foreground">{action.label}</span>
            </Card>
          </Link>
        ))}
      </div>

      {/* Active Borrowings */}
      <Card hoverable={false} className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-foreground">Peminjaman Aktif</h2>
          <Link href="/dashboard/borrowings" className="text-xs font-semibold flex items-center gap-1 hover:underline text-primary">
            Lihat Semua <ArrowRight size={14} />
          </Link>
        </div>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} variant="rect" className="h-16 w-full" />
            ))}
          </div>
        ) : activeBorrowings.length ? (
          <div className="space-y-3">
            {activeBorrowings.map((b: any) => (
              <div
                key={b.borrowing_id}
                className="flex items-center gap-4 p-3 rounded-xl border border-border bg-card"
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center bg-muted shrink-0"
                >
                  <Book size={20} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{b.book_qr?.book?.book_title || 'Unknown'}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                    <Clock size={12} />
                    Tenggat: {b.due_date ? new Date(b.due_date).toLocaleString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                  </p>
                </div>
                <Badge
                  variant={
                    b.borrowing_status === 'late' ? 'danger' :
                    b.borrowing_status === 'pending' ? 'warning' :
                    b.borrowing_status === 'approved' ? 'info' : 'success'
                  }
                >
                  {
                    b.borrowing_status === 'late' ? 'Terlambat' :
                    b.borrowing_status === 'pending' ? 'Menunggu Admin' :
                    b.borrowing_status === 'approved' ? 'Disetujui' : 'Dipinjam'
                  }
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={BookOpen} title="Belum ada peminjaman aktif" />
        )}
      </Card>

      {/* Recent Books */}
      <Card hoverable={false} className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-foreground">Buku Terbaru</h2>
          <Link href="/dashboard/books" className="text-xs font-semibold flex items-center gap-1 hover:underline text-primary">
            Lihat Semua <ArrowRight size={14} />
          </Link>
        </div>
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} variant="rect" className="h-48 w-full" />
            ))}
          </div>
        ) : recentBooks.length ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {recentBooks.map((book: any) => (
              <Link key={book.book_id} href={`/dashboard/books/${book.book_id}`} className="group">
                <div
                  className="aspect-[3/4] rounded-xl overflow-hidden mb-2 border border-border bg-card transition-all duration-300 group-hover:border-muted-foreground/30 shadow-sm"
                >
                  {book.cover_image_url ? (
                    <img
                      src={getMediaUrl(book.cover_image_url)}
                      alt={book.book_title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Book size={32} className="text-muted-foreground/60" />
                    </div>
                  )}
                </div>
                <p className="text-xs font-bold text-foreground truncate">{book.book_title}</p>
                <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                  {book.author_name}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState icon={Book} title="Belum ada buku" />
        )}
      </Card>
    </div>
  );
}
