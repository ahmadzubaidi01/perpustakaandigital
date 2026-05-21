'use client';

import { useState, useEffect } from 'react';
import { QrCode, Camera, X, CheckCircle, Loader2, RotateCcw, AlertTriangle } from 'lucide-react';
import { borrowingsAPI } from '@/lib/api';
import toast from 'react-hot-toast';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { QrScanner } from '@/components/ui/QrScanner';

export default function PengembalianPage() {
  const [scanning, setScanning] = useState(false);
  const [manualQr, setManualQr] = useState('');
  const [qrPayload, setQrPayload] = useState('');
  const [returning, setReturning] = useState(false);
  const [result, setResult] = useState<any>(null);

  const startScanner = () => {
    setScanning(true);
    setResult(null);
    setQrPayload('');
  };

  const stopScanner = () => {
    setScanning(false);
  };

  const handleManualQr = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualQr.trim()) return;
    processReturn(manualQr.trim());
    setManualQr('');
  };

  const processReturn = async (payload: string) => {
    setQrPayload(payload);
    setReturning(true);
    try {
      const res = await borrowingsAPI.quickReturn({ qr_payload: payload });
      setResult(res.data.data);
      toast.success('Pengembalian berhasil!');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal memproses pengembalian');
      setResult({ error: true, message: err.response?.data?.message || 'Gagal memproses pengembalian' });
    } finally {
      setReturning(false);
    }
  };

  const resetAll = () => {
    setQrPayload('');
    setResult(null);
    setScanning(false);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <PageHeader title="Pengembalian Buku" description="Pindai QR buku untuk memproses pengembalian secara otomatis." />

      {/* Scanner Card */}
      <Card hoverable={false} className="p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <RotateCcw size={18} />
          </div>
          <h3 className="text-base font-bold text-foreground">Pindai QR Code Buku</h3>
        </div>

        {scanning ? (
          <div className="space-y-4">
            <QrScanner onScanSuccess={(decodedText) => { setScanning(false); processReturn(decodedText); }} onClose={stopScanner} />
          </div>
        ) : returning ? (
          <div className="text-center py-16">
            <Loader2 size={40} className="animate-spin text-primary mx-auto mb-4" />
            <p className="text-sm font-medium text-foreground">Memproses Pengembalian...</p>
            <p className="text-xs text-muted-foreground mt-1">Menghitung denda dan memperbarui stok...</p>
          </div>
        ) : !result ? (
          <>
            <div className="text-center py-10 border border-dashed border-border rounded-xl bg-muted/20 mb-4">
              <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-primary/10 text-primary">
                <Camera size={32} />
              </div>
              <p className="text-sm font-semibold text-foreground mb-1">Pindai Buku untuk Pengembalian</p>
              <p className="text-xs text-muted-foreground mb-5 max-w-xs mx-auto">
                Sistem akan otomatis menemukan peminjaman aktif dan memproses pengembalian beserta perhitungan denda.
              </p>
              <Button onClick={startScanner} variant="primary" size="md" leftIcon={<Camera size={16} />}>
                Aktifkan Kamera
              </Button>
            </div>

            <div className="pt-4 border-t border-border">
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Input Manual</label>
              <form onSubmit={handleManualQr} className="flex gap-2">
                <Input
                  value={manualQr}
                  onChange={(e) => setManualQr(e.target.value)}
                  placeholder="Tempel payload QR buku..."
                  containerClassName="flex-grow"
                />
                <Button type="submit" variant="primary" className="shrink-0">
                  <QrCode size={18} />
                </Button>
              </form>
            </div>
          </>
        ) : null}
      </Card>

      {/* Result Card */}
      {result && !result.error && (
        <Card hoverable={false} className="p-8 text-center animate-fade-in">
          <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={40} className="text-emerald-500" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Pengembalian Berhasil!</h2>
          <p className="text-sm text-muted-foreground mb-6">Buku telah dikembalikan dan stok diperbarui otomatis.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left mb-6">
            <div className="p-4 rounded-xl bg-muted/40 border border-border">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Buku</span>
              <span className="text-sm font-bold text-foreground mt-1 block">{result.book_title}</span>
            </div>
            <div className="p-4 rounded-xl bg-muted/40 border border-border">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Peminjam</span>
              <span className="text-sm font-bold text-foreground mt-1 block">{result.borrower?.full_name || '-'}</span>
              <span className="text-xs text-muted-foreground">{result.borrower?.class_name || ''}</span>
            </div>
            <div className="p-4 rounded-xl bg-muted/40 border border-border">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Kode Peminjaman</span>
              <span className="text-sm font-mono font-bold text-primary mt-1 block">{result.borrowing?.borrowing_code}</span>
            </div>
            <div className="p-4 rounded-xl bg-muted/40 border border-border">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Denda</span>
              {result.penalty_amount > 0 ? (
                <Badge variant="danger" className="mt-1">Rp {Number(result.penalty_amount).toLocaleString()}</Badge>
              ) : (
                <Badge variant="success" className="mt-1">Tidak ada denda</Badge>
              )}
            </div>
          </div>

          <Button variant="primary" size="md" onClick={resetAll} leftIcon={<RotateCcw size={16} />}>
            Kembalikan Buku Lain
          </Button>
        </Card>
      )}

      {/* Error state */}
      {result?.error && (
        <Card hoverable={false} className="p-8 text-center animate-fade-in">
          <div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-950/30 flex items-center justify-center mx-auto mb-6">
            <AlertTriangle size={40} className="text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Gagal Memproses</h2>
          <p className="text-sm text-muted-foreground mb-6">{result.message}</p>
          <Button variant="primary" size="md" onClick={resetAll} leftIcon={<RotateCcw size={16} />}>
            Coba Lagi
          </Button>
        </Card>
      )}
    </div>
  );
}
