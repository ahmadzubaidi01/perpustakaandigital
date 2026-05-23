'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Pencil, Trash2, Book, QrCode, Loader2, Download, Plus } from 'lucide-react';
import { booksAPI, qrAPI, getMediaUrl } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';

// Reusable UI components
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { BookStatusBadge } from '@/components/ui/Badge';

export default function BookDetailPage() {
  const router = useRouter();
  const params = useParams();
  const bookId = Number(params.book_id);
  const { user } = useAuthStore();
  const isAdmin = ['super_admin', 'regency_admin', 'district_admin', 'school_admin'].includes(user?.user_role || '');

  const [book, setBook] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [genQty, setGenQty] = useState(1);
  const [customSerial, setCustomSerial] = useState('');
  const [generating, setGenerating] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);

  const fetchBook = async () => {
    setLoading(true);
    try {
      const res = await booksAPI.get(bookId);
      setBook(res.data.data);
    } catch {
      toast.error('Gagal memuat data buku');
      router.push('/dashboard/books');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBook(); }, [bookId]);

  const handleDelete = async () => {
    if (!confirm('Apakah Anda yakin ingin menghapus buku ini?')) return;
    setDeleting(true);
    try {
      await booksAPI.delete(bookId);
      toast.success('Buku berhasil dihapus');
      router.push('/dashboard/books');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal menghapus buku');
    } finally {
      setDeleting(false);
    }
  };

  const handleGenerateQr = async () => {
    if (genQty < 1) return;
    setGenerating(true);
    try {
      await qrAPI.generate({ book_id: bookId, quantity: genQty, custom_serial: customSerial.trim() || undefined });
      toast.success(`${genQty} QR code berhasil dibuat!`);
      setCustomSerial('');
      setShowGenerate(false);
      fetchBook();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal membuat QR');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadQr = async (qrId: number) => {
    try {
      const res = await qrAPI.download(qrId);
      const { qr_data_url, qr_serial_number } = res.data.data;
      const link = document.createElement('a');
      link.href = qr_data_url;
      link.download = `QR-${qr_serial_number}.png`;
      link.click();
    } catch {
      toast.error('Gagal mengunduh QR');
    }
  };

  const handleStatusChange = async (qrId: number, status: string) => {
    try {
      await qrAPI.updateStatus(qrId, status);
      toast.success('Status QR berhasil diperbarui!');
      fetchBook();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal memperbarui status QR');
    }
  };

  const handleDeleteQr = async (qrId: number, serial: string) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus QR code dengan serial ${serial}?`)) return;
    try {
      await qrAPI.delete(qrId);
      toast.success('QR code berhasil dihapus!');
      fetchBook();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal menghapus QR code');
    }
  };

  const qrStatusBadge = (status: string) => {
    const classMap: Record<string, string> = {
      active: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
      borrowed: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400',
      maintenance: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
      damaged: 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400',
      lost: 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400',
      inactive: 'bg-[var(--muted)] text-[var(--text-secondary)]'
    };
    const labelMap: Record<string, string> = {
      active: 'Tersedia',
      borrowed: 'Dipinjam',
      maintenance: 'Perawatan',
      damaged: 'Rusak',
      lost: 'Hilang',
      inactive: 'Tidak Tersedia'
    };
    return <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full ${classMap[status] || 'bg-[var(--muted)] text-[var(--text-secondary)]'}`}>{labelMap[status] || status}</span>;
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!book) return null;

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => router.push('/dashboard/books')} title="Kembali ke Koleksi">
            <ArrowLeft size={16} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-[var(--heading)]">Detail Buku</h1>
            <p className="text-sm mt-1 text-[var(--text-muted)]">{book.book_code}</p>
          </div>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Link
              href={`/dashboard/books/${bookId}/edit`}
              className="inline-flex items-center justify-center font-medium h-10 px-4 text-sm rounded-lg border border-border bg-transparent text-foreground hover:bg-secondary active:scale-[0.98] transition-all gap-2"
            >
              <Pencil size={16} /> Edit
            </Link>
            <Button variant="danger" onClick={handleDelete} isLoading={deleting} leftIcon={<Trash2 size={16} />}>
              Hapus
            </Button>
          </div>
        )}
      </div>

      {/* Book Info Card */}
      <Card hoverable={false} className="p-6">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Cover */}
          <div className="w-full md:w-48 aspect-[3/4] rounded-xl overflow-hidden flex-shrink-0 bg-muted">
            {book.cover_image_url ? (
              <img src={getMediaUrl(book.cover_image_url)} alt={book.book_title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Book size={48} className="text-muted-foreground/50" />
              </div>
            )}
          </div>

          {/* Details */}
          <div className="flex-1 space-y-4">
            <div>
              <h2 className="text-xl font-bold text-[var(--heading)]">{book.book_title}</h2>
              <p className="text-sm mt-1 text-[var(--text-muted)]">{book.author_name}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <BookStatusBadge status={book.book_status} />
              {book.category && (
                <span className="inline-flex items-center justify-center text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary">
                  {book.category.category_name}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-xs uppercase font-semibold text-[var(--text-muted)]">Penerbit</p>
                <p className="text-sm font-bold text-[var(--heading)]">{book.publisher_name || '-'}</p>
              </div>
              <div>
                <p className="text-xs uppercase font-semibold text-[var(--text-muted)]">Tahun</p>
                <p className="text-sm font-bold text-[var(--heading)]">{book.publication_year || '-'}</p>
              </div>
              <div>
                <p className="text-xs uppercase font-semibold text-[var(--text-muted)]">ISBN</p>
                <p className="text-sm font-mono font-bold text-[var(--heading)]">{book.isbn_code || '-'}</p>
              </div>
              <div>
                <p className="text-xs uppercase font-semibold text-[var(--text-muted)]">Rak</p>
                <p className="text-sm font-bold text-[var(--heading)]">{book.rack_location || '-'}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg text-center bg-muted">
                <p className="text-xs uppercase font-semibold text-[var(--text-muted)]">Total</p>
                <p className="text-xl font-bold text-[var(--heading)]">{book.total_stock}</p>
              </div>
              <div className="p-3 rounded-lg text-center bg-muted">
                <p className="text-xs uppercase font-semibold text-[var(--text-muted)]">Tersedia</p>
                <p className="text-xl font-bold text-success">{book.available_stock}</p>
              </div>
              <div className="p-3 rounded-lg text-center bg-muted">
                <p className="text-xs uppercase font-semibold text-[var(--text-muted)]">Dipinjam</p>
                <p className="text-xl font-bold text-destructive">{book.borrowed_stock}</p>
              </div>
            </div>

            {book.book_description && (
              <div>
                <p className="text-xs uppercase font-semibold mb-1 text-[var(--text-muted)]">Deskripsi</p>
                <p className="text-sm text-[var(--foreground)]">{book.book_description}</p>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* QR Codes */}
      <Card hoverable={false} className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[var(--heading)] flex items-center gap-2">
            <QrCode size={20} />
            QR Codes ({book.qr_codes?.length || 0})
          </h2>
          {isAdmin && (
            <Button size="sm" onClick={() => setShowGenerate(!showGenerate)} leftIcon={<Plus size={16} />}>
              Generate QR
            </Button>
          )}
        </div>

        {/* Generate QR inline */}
        {showGenerate && (
          <div className="p-4 rounded-xl mb-4 flex flex-col md:flex-row items-end gap-3 bg-[var(--accent)] border border-border">
            <Input
              label="Nomor Seri Kustom (Opsional)"
              placeholder="Contoh: BUKU-XYZ-01"
              value={customSerial}
              onChange={(e) => {
                setCustomSerial(e.target.value);
              }}
              containerClassName="flex-1"
            />
            <Input
              label="Jumlah QR"
              type="number"
              min={1}
              max={50}
              value={genQty}
              onChange={(e) => setGenQty(Number(e.target.value))}
              containerClassName="w-32"
            />
            <Button onClick={handleGenerateQr} isLoading={generating} leftIcon={<QrCode size={16} />}>
              Generate
            </Button>
          </div>
        )}

        {/* QR Grid */}
        {book.qr_codes?.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 stagger-children">
            {book.qr_codes.map((qr: any) => (
              <div key={qr.book_qr_id} className="p-4 rounded-xl text-center space-y-3 flex flex-col justify-between bg-muted border border-border">
                <div className="space-y-3">
                  <div className="mx-auto w-24 h-24 flex items-center justify-center rounded-lg bg-white p-2 border border-border shadow-xs">
                    <QRCodeSVG
                      value={JSON.stringify({ uuid: qr.qr_uuid, serial: qr.qr_serial_number, book_id: bookId, type: 'book_qr', version: 1 })}
                      size={80}
                      fgColor="#1E40AF"
                      level="H"
                    />
                  </div>
                  <p className="text-xs font-mono truncate text-[var(--text-secondary)]">{qr.qr_serial_number}</p>
                  
                  <div className="flex flex-col items-center gap-1.5 w-full">
                    {isAdmin ? (
                      <Select
                        value={qr.qr_status}
                        onChange={(e) => handleStatusChange(qr.book_qr_id, e.target.value)}
                        className="py-1 px-2 text-xs h-8! pr-8! w-full"
                      >
                        <option value="active">Tersedia (Active)</option>
                        <option value="borrowed">Dipinjam (Borrowed)</option>
                        <option value="maintenance">Perawatan (Maintenance)</option>
                        <option value="damaged">Rusak (Damaged)</option>
                        <option value="lost">Hilang (Lost)</option>
                        <option value="inactive">Tidak Tersedia (Inactive)</option>
                      </Select>
                    ) : (
                      qrStatusBadge(qr.qr_status)
                    )}

                    {qr.qr_status === 'borrowed' || (qr.qr_status === 'active' && qr.borrowings && qr.borrowings.length > 0) ? (
                      (() => {
                        const b = qr.borrowings?.[0];
                        const borrowerText = b?.borrower
                          ? `${b.borrower.full_name} (NISN: ${b.borrower.student_id_number || '-'} • Kelas: ${b.borrower.class_name || '-'})`
                          : 'Siswa';
                        return (
                          <span 
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30 w-full justify-center truncate" 
                            title={`Dipinjam: ${borrowerText}`}
                          >
                            Dipinjam: {b?.borrower?.full_name || 'Siswa'}
                          </span>
                        );
                      })()
                    ) : qr.qr_status === 'active' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30 w-full justify-center">
                        Tersedia
                      </span>
                    ) : qr.qr_status === 'maintenance' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30 w-full justify-center">
                        Perawatan
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400 border border-red-100 dark:border-red-900/30 w-full justify-center">
                        {qr.qr_status === 'damaged' ? 'Rusak' : qr.qr_status === 'lost' ? 'Hilang' : 'Tidak Tersedia'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleDownloadQr(qr.book_qr_id)}
                    leftIcon={<Download size={14} />}
                    title="Unduh"
                  >
                    Unduh
                  </Button>
                  {isAdmin && (
                    <Button
                      variant="danger"
                      size="sm"
                      className="h-8 w-8 p-0!"
                      onClick={() => handleDeleteQr(qr.book_qr_id, qr.qr_serial_number)}
                      title="Hapus"
                    >
                      <Trash2 size={14} />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center rounded-xl bg-[var(--card)] border border-dashed border-border">
            <QrCode size={40} className="text-muted-foreground/30 mb-2" />
            <p className="text-sm text-[var(--text-muted)]">Belum ada QR code untuk buku ini</p>
          </div>
        )}
      </Card>

      {/* Reviews */}
      {book.reviews?.length > 0 && (
        <Card hoverable={false} className="p-6">
          <h2 className="text-lg font-bold mb-4 text-[var(--heading)]">Ulasan ({book.reviews.length})</h2>
          <div className="space-y-3">
            {book.reviews.map((review: any) => (
              <div key={review.review_id} className="p-3 rounded-lg bg-muted border border-border">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-bold text-[var(--heading)]">{review.user?.full_name || 'Anonim'}</p>
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <span key={i} className="text-sm" style={{ color: i < review.rating_score ? 'var(--color-warning-500)' : 'var(--text-placeholder)' }}>★</span>
                    ))}
                  </div>
                </div>
                {review.review_text && <p className="text-sm text-[var(--text-secondary)]">{review.review_text}</p>}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
