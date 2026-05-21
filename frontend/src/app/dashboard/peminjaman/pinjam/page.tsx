'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, QrCode, Camera, X, CheckCircle, Loader2, UserCheck, BookOpen, AlertTriangle, ArrowRight } from 'lucide-react';
import { borrowingsAPI } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import toast from 'react-hot-toast';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { QrScanner } from '@/components/ui/QrScanner';

interface StudentResult {
  user_id: number;
  full_name: string;
  student_id_number: string | null;
  class_name: string | null;
  email_address: string;
  profile_photo_url: string | null;
  member_qr_uuid: string | null;
  school_id: number | null;
  school?: { school_id: number; school_name: string } | null;
  active_borrowing_count: number;
}

export default function PinjamBukuPage() {
  const { user } = useAuthStore();

  // Step 1: Search student
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<StudentResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentResult | null>(null);

  // Step 2: Scan book QR
  const [scanning, setScanning] = useState(false);
  const [manualQr, setManualQr] = useState('');
  const [qrPayload, setQrPayload] = useState('');
  const scannerRef = useRef<any>(null);

  // Step 3: Result
  const [borrowing, setBorrowing] = useState(false);
  const [result, setResult] = useState<any>(null);

  const searchStudents = useCallback(async () => {
    if (!searchQuery || searchQuery.length < 2) return;
    setSearchLoading(true);
    try {
      const res = await borrowingsAPI.searchStudent(searchQuery);
      setSearchResults(res.data.data || []);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal mencari siswa');
    } finally {
      setSearchLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 2) searchStudents();
      else setSearchResults([]);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery, searchStudents]);

  const handleScanSuccess = (decodedText: string) => {
    setQrPayload(decodedText);
    setScanning(false);
    if (selectedStudent) {
      handleBorrow(decodedText);
    }
  };

  const handleManualQr = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualQr.trim()) return;
    const payload = manualQr.trim();
    setQrPayload(payload);
    setManualQr('');
    if (selectedStudent) {
      handleBorrow(payload);
    }
  };

  const handleBorrow = async (codeToUse?: string) => {
    const code = codeToUse || qrPayload;
    if (!selectedStudent || !code) return;
    setBorrowing(true);
    try {
      const res = await borrowingsAPI.quickBorrow({
        student_id: selectedStudent.user_id,
        qr_payload: code,
      });
      setResult(res.data.data);
      toast.success('Peminjaman berhasil!');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal meminjamkan buku');
      setQrPayload(''); // Clear QR on failure to let them try again
    } finally {
      setBorrowing(false);
    }
  };

  // Auto-submit borrowing when both student and QR payload are present
  useEffect(() => {
    if (selectedStudent && qrPayload && !borrowing && !result) {
      handleBorrow();
    }
  }, [selectedStudent, qrPayload, borrowing, result]);

  const startScanner = () => {
    setScanning(true);
  };

  const resetAll = () => {
    setSelectedStudent(null);
    setQrPayload('');
    setResult(null);
    setSearchQuery('');
    setSearchResults([]);
    setScanning(false);
  };

  // Show success state
  if (result) {
    return (
      <div className="space-y-6 animate-fade-in max-w-3xl">
        <PageHeader title="Pinjam Buku" description="Peminjaman berhasil dicatat" />
        <Card hoverable={false} className="p-8 text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={40} className="text-emerald-500" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Peminjaman Berhasil!</h2>
          <p className="text-sm text-muted-foreground mb-6">Transaksi telah dicatat dan stok diperbarui secara otomatis.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left mb-8">
            <div className="p-4 rounded-xl bg-muted/40 border border-border">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Kode Peminjaman</span>
              <span className="text-sm font-mono font-bold text-primary mt-1 block">{result.borrowing?.borrowing_code}</span>
            </div>
            <div className="p-4 rounded-xl bg-muted/40 border border-border">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Buku</span>
              <span className="text-sm font-bold text-foreground mt-1 block">{result.book_title}</span>
            </div>
            <div className="p-4 rounded-xl bg-muted/40 border border-border">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Peminjam</span>
              <span className="text-sm font-bold text-foreground mt-1 block">{result.student_name}</span>
            </div>
            <div className="p-4 rounded-xl bg-muted/40 border border-border">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Tenggat Kembali</span>
              <span className="text-sm font-bold text-foreground mt-1 block">
                {result.due_date ? new Date(result.due_date).toLocaleDateString('id-ID', { dateStyle: 'long' }) : '-'}
              </span>
            </div>
          </div>

          <Button variant="primary" size="md" onClick={resetAll} leftIcon={<BookOpen size={16} />}>
            Pinjamkan Buku Lain
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl">
      <PageHeader title="Pinjam Buku" description="Cari siswa kemudian pindai QR buku untuk memulai peminjaman cepat." />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Step 1: Search Student */}
        <Card hoverable={false} className="p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary text-sm font-bold">1</div>
            <h3 className="text-base font-bold text-foreground">Cari Siswa</h3>
          </div>

          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Nama siswa, NIS, atau email..."
            leftIcon={searchLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            containerClassName="mb-4"
          />

          {/* Selected student card */}
          {selectedStudent ? (
            <div className="flex items-center gap-3 p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-900/30 rounded-xl">
              <div className="w-10 h-10 rounded-xl bg-linear-to-br from-primary to-primary/80 text-primary-foreground flex items-center justify-center text-sm font-bold shrink-0">
                {selectedStudent.full_name?.charAt(0)?.toUpperCase() || 'S'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground truncate">{selectedStudent.full_name}</p>
                <p className="text-xs text-muted-foreground">
                  {selectedStudent.class_name || 'Tanpa kelas'} · NIS: {selectedStudent.student_id_number || '-'}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={selectedStudent.active_borrowing_count > 0 ? 'warning' : 'success'}>
                    {selectedStudent.active_borrowing_count} aktif
                  </Badge>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => { setSelectedStudent(null); setSearchQuery(''); }}>
                <X size={14} />
              </Button>
            </div>
          ) : (
            <div className="border border-border rounded-xl max-h-64 overflow-y-auto bg-card">
              {searchResults.length > 0 ? (
                <div className="divide-y divide-border">
                  {searchResults.map((s) => (
                    <button
                      key={s.user_id}
                      type="button"
                      onClick={() => { setSelectedStudent(s); setSearchResults([]); }}
                      className="w-full text-left px-4 py-3 text-sm transition-colors hover:bg-muted/40 flex items-center gap-3"
                    >
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                        {s.full_name?.charAt(0)?.toUpperCase() || 'S'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{s.full_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{s.class_name || 'Tanpa kelas'} · {s.student_id_number || 'Tanpa NIS'}</p>
                      </div>
                      <Badge variant={s.active_borrowing_count > 0 ? 'warning' : 'success'}>
                        {s.active_borrowing_count} pinjam
                      </Badge>
                    </button>
                  ))}
                </div>
              ) : searchQuery.length >= 2 && !searchLoading ? (
                <div className="p-6 text-center text-sm text-muted-foreground">Tidak ditemukan siswa.</div>
              ) : (
                <div className="p-6 text-center text-sm text-muted-foreground">Ketik minimal 2 karakter untuk mencari...</div>
              )}
            </div>
          )}
        </Card>

        {/* Step 2: Scan Book QR */}
        <Card hoverable={false} className="p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary text-sm font-bold">2</div>
            <h3 className="text-base font-bold text-foreground">Pindai QR Buku</h3>
          </div>

          {qrPayload ? (
            <div className="flex items-center gap-3 p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-900/30 rounded-xl mb-4">
              <CheckCircle size={20} className="text-emerald-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground">QR Tervalidasi</p>
                <p className="text-xs text-muted-foreground font-mono truncate">{qrPayload.substring(0, 60)}...</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setQrPayload('')}>
                <X size={14} />
              </Button>
            </div>
          ) : scanning ? (
            <div className="space-y-4">
              <QrScanner onScanSuccess={handleScanSuccess} onClose={() => setScanning(false)} />
            </div>
          ) : (
            <div className="text-center py-8 border border-dashed border-border rounded-xl bg-muted/20 mb-4">
              <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center bg-primary/10 text-primary">
                <Camera size={28} />
              </div>
              <p className="text-sm font-semibold text-foreground mb-1">Pindai QR Code Buku</p>
              <p className="text-xs text-muted-foreground mb-4 max-w-xs mx-auto">Arahkan kamera ke QR code pada buku fisik.</p>
              <Button onClick={startScanner} variant="primary" size="md" leftIcon={<Camera size={16} />}>
                Aktifkan Kamera
              </Button>
            </div>
          )}

          {!qrPayload && !scanning && (
            <div className="pt-4 border-t border-border">
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Input Manual</label>
              <form onSubmit={handleManualQr} className="flex gap-2">
                <Input
                  value={manualQr}
                  onChange={(e) => setManualQr(e.target.value)}
                  placeholder="Tempel payload QR..."
                  containerClassName="flex-grow"
                />
                <Button type="submit" variant="primary" className="shrink-0">
                  <QrCode size={18} />
                </Button>
              </form>
            </div>
          )}
        </Card>
      </div>

      {/* Step 3: Confirm */}
      {selectedStudent && qrPayload && (
        <Card hoverable={false} className="p-6 border-2 border-primary/20">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <UserCheck size={24} className="text-primary shrink-0" />
              <div>
                <p className="text-sm font-bold text-foreground">
                  Pinjamkan buku ke <span className="text-primary">{selectedStudent.full_name}</span>?
                </p>
                <p className="text-xs text-muted-foreground">
                  Kelas: {selectedStudent.class_name || '-'} · Peminjaman aktif: {selectedStudent.active_borrowing_count}
                </p>
              </div>
            </div>
            <Button
              variant="primary"
              size="md"
              onClick={() => handleBorrow()}
              disabled={borrowing}
              leftIcon={borrowing ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
            >
              {borrowing ? 'Memproses...' : 'Konfirmasi Peminjaman'}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
