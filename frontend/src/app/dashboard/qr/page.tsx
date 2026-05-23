'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { QrCode, Camera, X, CheckCircle, Loader2, Download, List, Scan, Plus, Book } from 'lucide-react';
import { qrAPI, booksAPI, borrowingsAPI } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';

// Reusable UI components
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Tabs } from '@/components/ui/Tabs';
import { Pagination } from '@/components/ui/Pagination';
import { DataTable, DataTableColumn } from '@/components/ui/DataTable';
import { QrScanner } from '@/components/ui/QrScanner';

type TabType = 'scan' | 'generate' | 'list';

export default function QRPage() {
  const { user } = useAuthStore();
  const isAdmin = ['super_admin', 'regency_admin', 'district_admin', 'school_admin'].includes(user?.user_role || '');

  const [activeTab, setActiveTab] = useState<TabType>('scan');

  const tabItems = [
    { key: 'scan', label: 'Scanner QR', icon: Scan },
    ...(isAdmin ? [{ key: 'generate', label: 'Generator QR', icon: Plus }] : []),
    { key: 'list', label: 'Daftar QR', icon: List },
  ];

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl">
      <PageHeader
        title="Manajemen QR Code"
        description="Pindai kode untuk sirkulasi buku, atau buat QR code cetak untuk buku fisik baru."
      />

      {/* Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as TabType)}
        items={tabItems}
        className="w-full"
      />

      <div className="mt-6">
        {activeTab === 'scan' && <ScannerTab />}
        {activeTab === 'generate' && isAdmin && <GeneratorTab />}
        {activeTab === 'list' && <QRListTab />}
      </div>
    </div>
  );
}

function ScannerTab() {
  const { user } = useAuthStore();
  const isAdmin = ['super_admin', 'regency_admin', 'district_admin', 'school_admin'].includes(user?.user_role || '');

  const [scanning, setScanning] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const handleScan = async (payload: string) => {
    if (loading) return;
    setLoading(true);
    setScanning(false); // Stop after successful scan
    try {
      let latitude: number | undefined;
      let longitude: number | undefined;
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
        );
        latitude = pos.coords.latitude;
        longitude = pos.coords.longitude;
      } catch { /* GPS unavailable */ }

      const res = await qrAPI.scan({
        qr_payload: payload,
        scan_type: 'verification',
        latitude,
        longitude,
      });
      setResult(res.data.data);
      
      if (res.data.data?.was_reactivated) {
        toast.success('Buku hilang berhasil dipulihkan menjadi aktif!');
      } else {
        toast.success('QR Code berhasil diverifikasi!');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Payload QR Code tidak valid');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleStudentBorrow = async (bookQrId: number) => {
    setActionLoading(true);
    try {
      await borrowingsAPI.create({ book_qr_id: bookQrId });
      toast.success('Pengajuan peminjaman berhasil dikirim! Menunggu persetujuan admin.');
      setResult(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Terjadi kesalahan saat mengajukan peminjaman');
    } finally {
      setActionLoading(false);
    }
  };

  const startHtml5Scanner = () => {
    setScanning(true);
    setResult(null);
  };

  const stopScanner = () => {
    setScanning(false);
  };

  const handleManualScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    handleScan(manualInput.trim());
    setManualInput('');
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Scanner Control */}
      <Card hoverable={false} className="p-6 flex flex-col justify-between">
        <div>
          <h3 className="text-base font-bold text-foreground mb-2">Pindai Buku via Kamera</h3>
          <p className="text-xs text-muted-foreground mb-6">Arahkan QR Code pada buku ke kamera untuk memverifikasi ketersediaan atau memperbarui status buku.</p>

          {scanning ? (
            <div className="space-y-4">
              <QrScanner onScanSuccess={handleScan} onClose={stopScanner} />
            </div>
          ) : (
            <div className="text-center py-10 border border-dashed border-border rounded-xl bg-muted/20">
              <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-primary-100 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400">
                <Camera size={32} />
              </div>
              <p className="text-sm font-semibold text-foreground">Kamera Nonaktif</p>
              <p className="text-xs text-muted-foreground mt-1 mb-6 max-w-xs mx-auto">Izinkan akses kamera browser Anda untuk mulai memindai secara langsung.</p>
              <Button onClick={startHtml5Scanner} variant="primary" size="md" leftIcon={<Camera size={18} />}>
                Aktifkan Kamera
              </Button>
            </div>
          )}
        </div>

        {/* Manual Input Form */}
        <div className="mt-6 pt-6 border-t border-border">
          <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Verifikasi Manual (Payload Data)
          </label>
          <form onSubmit={handleManualScan} className="flex gap-2">
            <Input
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="Tempel string payload QR di sini..."
              containerClassName="flex-grow"
              required
            />
            <Button type="submit" variant="primary" disabled={loading} className="shrink-0">
              {loading ? <Loader2 size={18} className="animate-spin" /> : <QrCode size={18} />}
            </Button>
          </form>
        </div>
      </Card>

      {/* Scan Results Display */}
      <Card hoverable={false} className="p-6">
        <h3 className="text-base font-bold text-foreground mb-4">Detail Hasil Pindaian</h3>

        {loading ? (
          <div className="text-center py-16">
            <Loader2 size={40} className="animate-spin text-primary-600 mx-auto mb-4" />
            <p className="text-sm font-medium text-foreground">Menghubungi Server...</p>
            <p className="text-xs text-muted-foreground mt-1">Memproses tanda tangan enkripsi QR code...</p>
          </div>
        ) : result ? (
          <div className="space-y-5 animate-fade-in">
            <div className="flex items-center gap-3 p-4 rounded-xl border border-emerald-200/50 dark:border-emerald-900/30 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300">
              <CheckCircle size={24} className="text-emerald-500 shrink-0" />
              <div>
                <p className="text-sm font-bold">Autentikasi Valid</p>
                <p className="text-xs opacity-90">Buku fisik terdaftar secara resmi di pangkalan data.</p>
              </div>
            </div>

            {result.book && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-muted/40 border border-border">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Judul Buku</span>
                  <p className="text-base font-bold text-foreground mt-0.5 leading-snug">{result.book.book_title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{result.book.author_name} ({result.book.publisher_name || 'Tanpa Penerbit'})</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3.5 rounded-xl bg-muted/40 border border-border">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Nomor Seri QR</span>
                    <span className="text-xs font-mono font-bold text-foreground mt-1 block">{result.book_qr?.qr_serial_number}</span>
                  </div>
                  <div className="p-3.5 rounded-xl bg-muted/40 border border-border">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Status Unit</span>
                    <Badge
                      variant={
                        result.book_qr?.qr_status === 'active' ? 'success' :
                        result.book_qr?.qr_status === 'borrowed' ? 'info' :
                        result.book_qr?.qr_status === 'maintenance' ? 'warning' :
                        result.book_qr?.qr_status === 'inactive' ? 'neutral' : 'danger'
                      }
                      className="mt-1"
                    >
                      {
                        result.book_qr?.qr_status === 'active' ? 'Tersedia' :
                        result.book_qr?.qr_status === 'borrowed' ? 'Dipinjam' :
                        result.book_qr?.qr_status === 'maintenance' ? 'Perawatan' :
                        result.book_qr?.qr_status === 'damaged' ? 'Rusak' :
                        result.book_qr?.qr_status === 'lost' ? 'Hilang' :
                        result.book_qr?.qr_status === 'inactive' ? 'Tidak Tersedia' : result.book_qr?.qr_status
                      }
                    </Badge>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-muted/40 border border-border flex justify-between items-center text-xs">
                  <div>
                    <span className="text-muted-foreground block">Stok Total Buku:</span>
                    <span className="text-sm font-bold text-foreground">{result.book.total_stock} Unit</span>
                  </div>
                  <div className="text-right">
                    <span className="text-muted-foreground block">Stok Tersedia di Rak:</span>
                    <span className="text-sm font-bold text-primary-600 dark:text-primary-400">{result.book.available_stock} Unit</span>
                  </div>
                </div>

                {!isAdmin && (
                  <div className="pt-2">
                    {result.book_qr?.qr_status === 'active' ? (
                      <div className="flex justify-center">
                        <Button
                          onClick={() => handleStudentBorrow(result.book_qr?.book_qr_id)}
                          disabled={actionLoading}
                          variant="primary"
                          className="w-full"
                          leftIcon={actionLoading ? <Loader2 size={16} className="animate-spin" /> : <Book size={16} />}
                        >
                          Ajukan Peminjaman
                        </Button>
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl border border-red-200/50 dark:border-red-900/30 bg-red-50/50 dark:bg-red-950/20 text-red-800 dark:text-red-300 text-center text-xs font-semibold">
                        Buku tidak tersedia untuk dipinjam (Status: {
                          result.book_qr?.qr_status === 'borrowed' ? 'Dipinjam' : 
                          result.book_qr?.qr_status === 'maintenance' ? 'Perawatan' :
                          result.book_qr?.qr_status === 'damaged' ? 'Rusak' :
                          result.book_qr?.qr_status === 'lost' ? 'Hilang' :
                          result.book_qr?.qr_status === 'inactive' ? 'Tidak Tersedia' : result.book_qr?.qr_status
                        })
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-16 border border-dashed border-border rounded-xl">
            <QrCode size={48} className="text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-sm font-medium text-foreground">Menunggu Pindaian</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">Hasil verifikasi, nama peminjam terakhir, dan status sirkulasi unit buku akan tampil di panel ini.</p>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ===================== GENERATOR TAB ===================== */
function GeneratorTab() {
  const [books, setBooks] = useState<any[]>([]);
  const [selectedBookId, setSelectedBookId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [customSerial, setCustomSerial] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [searchBook, setSearchBook] = useState('');

  useEffect(() => {
    booksAPI.list({ limit: 100, sort_by: 'book_title', sort_order: 'ASC' })
      .then((r) => setBooks(r.data.data || []))
      .catch(() => {});
  }, []);

  const filteredBooks = books.filter(b =>
    b.book_title.toLowerCase().includes(searchBook.toLowerCase()) ||
    b.book_code?.toLowerCase().includes(searchBook.toLowerCase())
  );

  const handleGenerate = async () => {
    if (!selectedBookId) {
      toast.error('Silakan pilih buku terlebih dahulu');
      return;
    }
    if (quantity < 1 || quantity > 50) {
      toast.error('Jumlah pembuatan QR berkisar dari 1 sampai 50 per transaksi');
      return;
    }

    setLoading(true);
    try {
      const res = await qrAPI.generate({ book_id: Number(selectedBookId), quantity, custom_serial: customSerial.trim() || undefined });
      setResults(res.data.data || []);
      toast.success(`${quantity} unit QR code berhasil dibuat!`);
      setCustomSerial('');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal generate QR Code');
    } finally {
      setLoading(false);
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
      toast.error('Gagal mengunduh QR Code');
    }
  };

  const selectedBook = books.find(b => b.book_id.toString() === selectedBookId);

  return (
    <div className="space-y-6">
      <Card hoverable={false} className="p-6">
        <h3 className="text-base font-bold text-foreground mb-2">Generator Batch QR Code</h3>
        <p className="text-xs text-muted-foreground mb-6">Pilih buku katalog untuk dicetak kode fisiknya. Setiap kode mewakili satu salinan (unit) buku fisik.</p>

        <div className="space-y-5">
          {/* Book Search and Select list */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Cari Katalog Buku</label>
            <Input
              value={searchBook}
              onChange={(e) => setSearchBook(e.target.value)}
              placeholder="Ketik judul buku atau kode ISBN..."
            />
            
            <div className="border border-border rounded-lg max-h-48 overflow-y-auto bg-card">
              {filteredBooks.length > 0 ? (
                <div className="divide-y divide-border">
                  {filteredBooks.map((b) => (
                    <button
                      key={b.book_id}
                      type="button"
                      onClick={() => setSelectedBookId(b.book_id.toString())}
                      className={`w-full text-left px-4 py-2.5 text-xs transition-colors flex items-center justify-between ${
                        selectedBookId === b.book_id.toString()
                          ? 'bg-primary-50 dark:bg-primary-950/20 text-primary-600 dark:text-primary-400 font-bold'
                          : 'text-foreground hover:bg-muted/40'
                      }`}
                    >
                      <span className="truncate pr-4">{b.book_title}</span>
                      <span className="font-mono text-muted-foreground text-[10px] shrink-0">{b.book_code || 'No-Code'}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-xs text-muted-foreground">Katalog buku tidak ditemukan.</div>
              )}
            </div>
          </div>

          {selectedBook && (
            <div className="flex items-center gap-3 p-4 bg-primary-50/50 dark:bg-primary-950/20 border border-primary-100 dark:border-primary-900/30 rounded-xl">
              <Book className="text-primary-600 dark:text-primary-400 shrink-0" size={20} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground truncate">{selectedBook.book_title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Penulis: {selectedBook.author_name} · Stok Aktif: {selectedBook.total_stock} Unit</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end pt-2">
            <Input
              label="Nomor Seri Kustom (Opsional)"
              placeholder="Contoh: BUKU-XYZ-01"
              value={customSerial}
              onChange={(e) => {
                setCustomSerial(e.target.value);
              }}
              helperText="Jika jumlah > 1, nomor seri kustom akan otomatis di-increment (diurutkan)."
            />
            <Input
              label="Jumlah Kopi (QR) yang Dibuat"
              type="number"
              min={1}
              max={50}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              helperText="Setiap nomor seri QR code berlaku eksklusif untuk satu salinan fisik."
            />
            <Button
              onClick={handleGenerate}
              disabled={loading || !selectedBookId}
              variant="primary"
              size="md"
              className="w-full"
              leftIcon={loading ? <Loader2 size={16} className="animate-spin" /> : <QrCode size={16} />}
            >
              {loading ? 'Menghasilkan...' : 'Generate Unit QR'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Generated QR Results */}
      {results.length > 0 && (
        <Card hoverable={false} className="p-6">
          <div className="flex items-center justify-between mb-4 border-b border-border pb-3">
            <h3 className="text-base font-bold text-foreground">QR Code Hasil Pembuatan</h3>
            <span className="text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400 px-2 py-0.5 rounded-full font-semibold">
              {results.length} Unit Sukses
            </span>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {results.map((qr: any) => (
              <div
                key={qr.book_qr_id}
                className="p-4 rounded-xl border border-border bg-muted/20 flex flex-col items-center justify-between space-y-3"
              >
                <div className="w-24 h-24 flex items-center justify-center rounded-lg bg-white p-2 border border-border shadow-inner">
                  <QRCodeSVG
                    value={JSON.stringify({
                      uuid: qr.qr_uuid,
                      serial: qr.qr_serial_number,
                      book_id: qr.book_id,
                      type: 'book_qr',
                      version: 1,
                    })}
                    size={80}
                    fgColor="#1e3a8a" // dark blue
                    level="H"
                  />
                </div>
                <div className="text-center w-full">
                  <p className="text-[10px] font-mono font-bold text-muted-foreground truncate">{qr.qr_serial_number}</p>
                  <Badge variant="success" className="mt-1">aktif</Badge>
                </div>
                <Button
                  onClick={() => handleDownloadQr(qr.book_qr_id)}
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  leftIcon={<Download size={12} />}
                >
                  Unduh PNG
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ===================== QR LIST TAB ===================== */
function QRListTab() {
  const [qrs, setQrs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchQrs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await qrAPI.list({ page, limit: 15, sort_by: 'created_at', sort_order: 'DESC' });
      setQrs(res.data.data || []);
      setTotalPages(res.data.metadata?.pagination?.total_pages || 1);
    } catch {
      toast.error('Gagal memuat daftar QR Code');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchQrs();
  }, [fetchQrs]);

  const qrStatusBadge = (status: string) => {
    const map: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'neutral' | 'primary'> = {
      active: 'success',
      borrowed: 'info',
      maintenance: 'warning',
      damaged: 'danger',
      lost: 'danger',
      inactive: 'neutral',
    };
    const label: Record<string, string> = {
      active: 'Tersedia',
      borrowed: 'Dipinjam',
      maintenance: 'Perawatan',
      damaged: 'Rusak',
      lost: 'Hilang',
      inactive: 'Tidak Tersedia',
    };
    return <Badge variant={map[status] || 'neutral'}>{label[status] || status}</Badge>;
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
      toast.error('Gagal mengunduh QR Code');
    }
  };

  const columns: DataTableColumn[] = [
    {
      key: 'qr_serial_number',
      label: 'Serial QR',
      render: (val) => (
        <span className="font-mono text-xs font-bold text-foreground">
          {val}
        </span>
      ),
    },
    {
      key: 'book_title',
      label: 'Buku Terkait',
      render: (_, row) => (
        <div className="max-w-[200px] sm:max-w-xs md:max-w-md">
          <p className="text-xs font-bold text-foreground truncate">{row.book?.book_title || '-'}</p>
          <p className="text-[10px] text-muted-foreground truncate">{row.book?.author_name || '-'}</p>
        </div>
      ),
    },
    {
      key: 'qr_status',
      label: 'Status Unit',
      render: (val) => qrStatusBadge(val),
    },
    {
      key: 'actions',
      label: 'Aksi',
      render: (_, row) => (
        <Button
          onClick={(e) => {
            e.stopPropagation();
            handleDownloadQr(row.book_qr_id);
          }}
          variant="outline"
          size="sm"
          title="Unduh QR Code"
          leftIcon={<Download size={14} />}
        >
          Unduh
        </Button>
      ),
    },
  ];

  return (
    <Card hoverable={false} className="p-6">
      <h3 className="text-base font-bold text-foreground mb-4">Database QR Code Terdaftar</h3>

      <DataTable
        columns={columns}
        data={qrs}
        loading={loading}
        rowKey="book_qr_id"
        emptyIcon={QrCode}
        emptyTitle="Belum Ada QR Code Terbit"
        emptyDescription="Koleksi barcode buku fisik Anda akan tampil di daftar ini setelah admin sekolah menerbitkan unit buku."
      />

      {qrs.length > 0 && (
        <div className="mt-4">
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}
    </Card>
  );
}

