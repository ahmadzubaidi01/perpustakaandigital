'use client';

import { useState, useCallback, useEffect } from 'react';
import { Package, AlertTriangle, QrCode, Camera, X, CheckCircle, Loader2, Search, RefreshCw, Trash2, Eye, BarChart3 } from 'lucide-react';
import { inventoryAPI, qrAPI } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import toast from 'react-hot-toast';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { Tabs } from '@/components/ui/Tabs';
import { DataTable, DataTableColumn } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { QrScanner } from '@/components/ui/QrScanner';

type TabType = 'scanner' | 'anomalies' | 'audit';

export default function InventoryPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabType>('scanner');

  const tabItems = [
    { key: 'scanner', label: 'QR Scanner & Stok', icon: QrCode },
    { key: 'anomalies', label: 'Anomali Stok', icon: AlertTriangle },
    { key: 'audit', label: 'Audit Inventaris', icon: BarChart3 },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Manajemen Inventaris" description="Kelola stok buku fisik, QR code, dan audit inventaris perpustakaan." />
      <Tabs activeKey={activeTab} onChange={(key) => setActiveTab(key as TabType)} items={tabItems} className="w-full" />
      <div className="mt-6">
        {activeTab === 'scanner' && <ScannerStockTab />}
        {activeTab === 'anomalies' && <AnomaliesTab />}
        {activeTab === 'audit' && <AuditTab />}
      </div>
    </div>
  );
}

/* ═══════════ QR Scanner & Stock Management Tab ═══════════ */
function ScannerStockTab() {
  const [scanning, setScanning] = useState(false);
  const [continuous, setContinuous] = useState(true);
  const [manualQr, setManualQr] = useState('');
  const [loading, setLoading] = useState(false);
  const [traceResult, setTraceResult] = useState<any>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [notes, setNotes] = useState('');
  const [sessionScans, setSessionScans] = useState<any[]>([]);

  const startScanner = () => {
    setScanning(true);
    setTraceResult(null);
  };

  const stopScanner = () => {
    setScanning(false);
  };

  const handleScan = async (payload: string) => {
    setLoading(true);
    try {
      // First scan the QR to get the book_qr_id
      const scanRes = await qrAPI.scan({ qr_payload: payload, scan_type: 'inventory' });
      const bookQrId = scanRes.data.data?.book_qr?.book_qr_id;
      if (!bookQrId) throw new Error('QR Code tidak valid atau tidak terdaftar');
      
      // Then get full traceability
      const traceRes = await inventoryAPI.getQrTrace(bookQrId);
      const traceData = traceRes.data.data;
      setTraceResult(traceData);

      // Prepend to session scans list (prevent duplicate list nodes)
      setSessionScans((prev) => {
        const filtered = prev.filter((item) => item.book_qr_id !== traceData.book_qr_id);
        return [traceData, ...filtered];
      });

      toast.success(`Berhasil dipindai: ${traceData.book?.book_title || 'Unit Buku'}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Gagal memproses QR');
    } finally {
      setLoading(false);
    }
  };

  const handleManualScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualQr.trim()) return;
    handleScan(manualQr.trim());
    setManualQr('');
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!traceResult?.book_qr_id) return;
    setStatusUpdating(true);
    try {
      await inventoryAPI.markQrStatus(traceResult.book_qr_id, newStatus, notes || undefined);
      toast.success(`Status berhasil diubah ke ${newStatus}`);
      // Refresh trace
      const traceRes = await inventoryAPI.getQrTrace(traceResult.book_qr_id);
      const updatedData = traceRes.data.data;
      setTraceResult(updatedData);

      // Synchronize in the session logs list as well
      setSessionScans((prev) =>
        prev.map((item) => (item.book_qr_id === updatedData.book_qr_id ? updatedData : item))
      );

      setNotes('');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal mengubah status');
    } finally {
      setStatusUpdating(false);
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, 'success' | 'danger' | 'warning' | 'neutral'> = {
      active: 'success', damaged: 'danger', lost: 'danger', inactive: 'warning',
    };
    return <Badge variant={map[status] || 'neutral'}>{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scanner */}
        <Card hoverable={false} className="p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-base font-bold text-foreground">Pindai QR untuk Inventaris</h3>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="continuous-scan-toggle"
                checked={continuous}
                onChange={(e) => setContinuous(e.target.checked)}
                className="w-4 h-4 text-primary rounded-sm border-border bg-card cursor-pointer focus:ring-primary"
              />
              <label htmlFor="continuous-scan-toggle" className="text-xs font-semibold text-muted-foreground cursor-pointer select-none">
                Pindai Terus-menerus
              </label>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mb-6">Pindai QR buku untuk melihat riwayat lengkap dan mengelola status unit.</p>

          {scanning ? (
            <div className="space-y-4">
              <QrScanner
                continuous={continuous}
                onScanSuccess={(decodedText) => {
                  handleScan(decodedText);
                  if (!continuous) {
                    setScanning(false);
                  }
                }}
                onClose={stopScanner}
              />
            </div>
          ) : (
            <>
              <div className="text-center py-10 border border-dashed border-border rounded-xl bg-muted/20 mb-4">
                <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center bg-primary/10 text-primary">
                  <Camera size={28} />
                </div>
                <p className="text-sm font-semibold text-foreground mb-4">Pindai QR Buku</p>
                <Button onClick={startScanner} variant="primary" size="md" leftIcon={<Camera size={16} />}>
                  Aktifkan Kamera
                </Button>
              </div>
              <div className="pt-4 border-t border-border">
                <form onSubmit={handleManualScan} className="flex gap-2">
                  <Input value={manualQr} onChange={(e) => setManualQr(e.target.value)} placeholder="Payload QR..." containerClassName="flex-grow" />
                  <Button type="submit" variant="primary" className="shrink-0"><QrCode size={18} /></Button>
                </form>
              </div>
            </>
          )}
        </Card>

        {/* Trace Result */}
        <Card hoverable={false} className="p-6">
          <h3 className="text-base font-bold text-foreground mb-4">Detail & Traceability</h3>

          {loading ? (
            <div className="text-center py-16">
              <Loader2 size={40} className="animate-spin text-primary mx-auto mb-4" />
              <p className="text-sm font-medium">Memuat data...</p>
            </div>
          ) : traceResult ? (
            <div className="space-y-4 animate-fade-in">
              {/* Book Info */}
              <div className="p-4 rounded-xl bg-muted/40 border border-border">
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Buku</span>
                <p className="text-sm font-bold text-foreground mt-0.5">{traceResult.book?.book_title || '-'}</p>
                <p className="text-xs text-muted-foreground">{traceResult.book?.book_code || '-'}</p>
              </div>

              {/* QR Info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-muted/40 border border-border">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">Serial QR</span>
                  <span className="text-xs font-mono font-bold text-foreground mt-1 block">{traceResult.qr_serial_number}</span>
                </div>
                <div className="p-3 rounded-xl bg-muted/40 border border-border">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">Status</span>
                  <div className="mt-1">{statusBadge(traceResult.qr_status)}</div>
                </div>
              </div>

              {/* Status Actions */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Ubah Status</p>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Catatan (opsional)..." />
                <div className="flex flex-wrap gap-2">
                  {traceResult.qr_status !== 'active' && (
                    <Button variant="success" size="sm" onClick={() => handleStatusChange('active')} disabled={statusUpdating}>
                      <CheckCircle size={14} className="mr-1" /> Aktifkan
                    </Button>
                  )}
                  {traceResult.qr_status !== 'damaged' && (
                    <Button variant="outline" size="sm" onClick={() => handleStatusChange('damaged')} disabled={statusUpdating}>
                      <AlertTriangle size={14} className="mr-1" /> Rusak
                    </Button>
                  )}
                  {traceResult.qr_status !== 'lost' && (
                    <Button variant="danger" size="sm" onClick={() => handleStatusChange('lost')} disabled={statusUpdating}>
                      <X size={14} className="mr-1" /> Hilang
                    </Button>
                  )}
                </div>
              </div>

              {/* Recent borrowings */}
              {traceResult.borrowings && traceResult.borrowings.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Riwayat Peminjaman Terakhir</p>
                  {traceResult.borrowings.slice(0, 5).map((b: any) => (
                    <div key={b.borrowing_id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 border border-border text-xs">
                      <div className="flex flex-col">
                        <span className="font-semibold text-foreground">{b.borrower?.full_name || '-'}</span>
                        {(b.borrower?.student_id_number || b.borrower?.class_name) && (
                          <span className="text-[10px] text-muted-foreground mt-0.5">
                            {b.borrower?.student_id_number ? `NISN: ${b.borrower.student_id_number}` : ''}
                            {b.borrower?.student_id_number && b.borrower?.class_name ? ' • ' : ''}
                            {b.borrower?.class_name ? `Kelas: ${b.borrower.class_name}` : ''}
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-primary font-bold mt-0.5">{b.borrowing_code}</span>
                      </div>
                      <Badge variant={b.borrowing_status === 'returned' ? 'success' : b.borrowing_status === 'borrowed' ? 'primary' : 'warning'}>
                        {b.borrowing_status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-16 border border-dashed border-border rounded-xl">
              <Package size={48} className="text-muted-foreground/40 mx-auto mb-4" />
              <p className="text-sm font-medium text-foreground">Menunggu Pindaian</p>
              <p className="text-xs text-muted-foreground mt-1">Detail stok, riwayat sirkulasi, dan opsi manajemen akan muncul di sini.</p>
            </div>
          )}
        </Card>
      </div>

      {/* Session Scans List */}
      {sessionScans.length > 0 && (
        <Card hoverable={false} className="p-6 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Sesi Pemindaian Aktif ({sessionScans.length} item)
            </h3>
            <Button variant="outline" size="sm" onClick={() => setSessionScans([])}>
              Hapus Sesi
            </Button>
          </div>
          <div className="overflow-x-auto border border-border rounded-xl bg-card">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-muted/40 border-b border-border font-bold text-muted-foreground">
                  <th className="p-3">Buku</th>
                  <th className="p-3">Serial QR</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sessionScans.map((item) => (
                  <tr key={item.book_qr_id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-3 font-semibold text-foreground">
                      {item.book?.book_title || '-'}
                      <span className="text-[10px] text-muted-foreground block font-mono mt-0.5">{item.book?.book_code || '-'}</span>
                    </td>
                    <td className="p-3 font-mono text-primary font-bold">{item.qr_serial_number}</td>
                    <td className="p-3">{statusBadge(item.qr_status)}</td>
                    <td className="p-3 text-right">
                      <Button variant="outline" size="sm" onClick={() => setTraceResult(item)}>
                        Tampilkan Detail
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ═══════════ Stock Anomalies Tab ═══════════ */
function AnomaliesTab() {
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAnomalies = useCallback(async () => {
    setLoading(true);
    try {
      const res = await inventoryAPI.getAnomalies();
      setAnomalies(res.data.data || []);
    } catch { toast.error('Gagal memuat data anomali'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAnomalies(); }, [fetchAnomalies]);

  const columns: DataTableColumn[] = [
    { key: 'book_title', label: 'Buku', render: (val) => <span className="font-semibold text-foreground">{val}</span> },
    { key: 'book_code', label: 'Kode', render: (val) => <span className="font-mono text-xs text-primary font-bold">{val}</span> },
    { key: 'total_stock', label: 'Total Stok' },
    { key: 'total_qr_count', label: 'Total QR' },
    { key: 'lost_count', label: 'Hilang', render: (val) => val > 0 ? <Badge variant="danger">{val}</Badge> : <span className="text-muted-foreground">0</span> },
    { key: 'damaged_count', label: 'Rusak', render: (val) => val > 0 ? <Badge variant="warning">{val}</Badge> : <span className="text-muted-foreground">0</span> },
    { key: 'anomaly_type', label: 'Tipe', render: (val) => (
      <Badge variant="danger">{val === 'qr_count_mismatch' ? 'QR ≠ Stok' : 'Inkonsistensi'}</Badge>
    )},
  ];

  return (
    <Card hoverable={false} className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-foreground">Anomali Stok Terdeteksi</h3>
        <Button variant="outline" size="sm" onClick={fetchAnomalies} leftIcon={<RefreshCw size={14} />}>Refresh</Button>
      </div>
      <DataTable
        columns={columns} data={anomalies} loading={loading} rowKey="book_id"
        emptyIcon={CheckCircle} emptyTitle="Tidak Ada Anomali" emptyDescription="Semua stok buku sesuai dengan jumlah QR code."
      />
    </Card>
  );
}

/* ═══════════ Audit Tab ═══════════ */
function AuditTab() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleRunAudit = async () => {
    setRunning(true);
    try {
      const res = await inventoryAPI.runAudit();
      setResult(res.data.data);
      toast.success('Audit inventaris selesai!');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal menjalankan audit');
    } finally {
      setRunning(false);
    }
  };

  const handleInitialize = async () => {
    if (!confirm('Inisialisasi stok dari nol akan menyinkronkan ulang seluruh stok buku. Lanjutkan?')) return;
    setRunning(true);
    try {
      const res = await inventoryAPI.initializeStock();
      setResult(res.data.data);
      toast.success('Inisialisasi stok selesai!');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal menginisialisasi');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card hoverable={false} className="p-6 text-center">
        <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-primary/10 text-primary">
          <BarChart3 size={32} />
        </div>
        <h3 className="text-base font-bold text-foreground mb-2">Audit Inventaris</h3>
        <p className="text-xs text-muted-foreground mb-6">Sinkronkan seluruh stok buku dengan data QR code yang terdaftar.</p>
        <Button variant="primary" size="md" onClick={handleRunAudit} disabled={running}
          leftIcon={running ? <Loader2 size={16} className="animate-spin" /> : <BarChart3 size={16} />}>
          {running ? 'Memproses...' : 'Jalankan Audit'}
        </Button>
      </Card>

      <Card hoverable={false} className="p-6 text-center">
        <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-amber-100 dark:bg-amber-950/30 text-amber-600">
          <RefreshCw size={32} />
        </div>
        <h3 className="text-base font-bold text-foreground mb-2">Inisialisasi dari Nol</h3>
        <p className="text-xs text-muted-foreground mb-6">Reset dan hitung ulang stok berdasarkan data QR code aktif dan peminjaman.</p>
        <Button variant="outline" size="md" onClick={handleInitialize} disabled={running}
          leftIcon={running ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}>
          {running ? 'Memproses...' : 'Inisialisasi Stok'}
        </Button>
      </Card>

      {result && (
        <Card hoverable={false} className="p-6 md:col-span-2 animate-fade-in">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle size={24} className="text-emerald-500" />
            <h3 className="text-base font-bold text-foreground">Hasil Audit</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-muted/40 border border-border">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">Buku Disinkronkan</span>
              <span className="text-2xl font-bold text-primary mt-1 block">{result.synced_books || result.initialized_books || 0}</span>
            </div>
            <div className="p-4 rounded-xl bg-muted/40 border border-border">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">Anomali Ditemukan</span>
              <span className="text-2xl font-bold text-foreground mt-1 block">{result.anomalies?.length || 0}</span>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
