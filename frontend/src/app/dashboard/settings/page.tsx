'use client';

import { useEffect, useState } from 'react';
import { Save, Settings2, Info, Trash2, RefreshCw } from 'lucide-react';
import { settingsAPI } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import toast from 'react-hot-toast';

// Reusable UI components
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';

export default function SettingsPage() {
  const { user } = useAuthStore();
  const [form, setForm] = useState({
    max_borrow_days: 14,
    max_books_per_student: 3,
    penalty_rate_per_day: 1000,
    allow_extensions: true,
    max_extensions: 1,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  const handleCleanup = async () => {
    const confirm = window.confirm(
      'Apakah Anda yakin ingin menghapus seluruh foto buku, profil, dan QR code yang tidak digunakan di server?\n\nTindakan ini aman dan hanya akan menghapus file usang yang tidak terhubung dengan data aktif perpustakaan.'
    );
    if (!confirm) return;

    setCleaning(true);
    try {
      const res = await settingsAPI.cleanup();
      const { deleted_files_count, formatted_space_saved } = res.data.data;
      toast.success(
        `Pembersihan selesai! Berhasil menghapus ${deleted_files_count} file tidak terpakai, menghemat ${formatted_space_saved} penyimpanan.`
      );
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal melakukan pembersihan file server.');
    } finally {
      setCleaning(false);
    }
  };

  useEffect(() => {
    settingsAPI.get(user?.school_id || undefined)
      .then((res) => {
        const d = res.data.data;
        if (d) {
          setForm({
            max_borrow_days: d.max_borrow_days,
            max_books_per_student: d.max_books_per_student,
            penalty_rate_per_day: Number(d.penalty_rate_per_day),
            allow_extensions: d.allow_extensions,
            max_extensions: d.max_extensions,
          });
        }
      })
      .catch(() => {
        toast.error('Gagal memuat konfigurasi pengaturan.');
      })
      .finally(() => setLoading(false));
  }, [user?.school_id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await settingsAPI.update(form, user?.school_id || undefined);
      toast.success('Pengaturan sirkulasi berhasil disimpan');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal menyimpan pengaturan');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-3xl">
        <PageHeader
          title="Pengaturan Sirkulasi"
          description="Konfigurasi aturan peminjaman dan denda sirkulasi buku."
        />
        <Card hoverable={false} className="p-6 space-y-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton variant="text" className="h-4 w-1/4" />
              <Skeleton variant="text" className="h-3 w-1/2" />
              <Skeleton variant="rect" className="h-10 w-48" />
            </div>
          ))}
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <PageHeader
        title="Pengaturan Sirkulasi"
        description="Konfigurasi aturan peminjaman, denda, dan perpanjangan buku di sekolah Anda."
      />

      <div className="grid grid-cols-1 gap-6">
        <Card hoverable={false} className="p-6">
          <div className="flex items-center gap-3 pb-4 mb-6 border-b border-border">
            <div className="p-2 bg-primary-100 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 rounded-lg">
              <Settings2 size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Kebijakan Peminjaman Buku</h3>
              <p className="text-xs text-muted-foreground">Sesuaikan parameter sirkulasi agar sesuai dengan kebijakan perpustakaan sekolah.</p>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Batas Hari Peminjaman"
                type="number"
                min={1}
                value={form.max_borrow_days}
                onChange={(e) => setForm(p => ({ ...p, max_borrow_days: Number(e.target.value) }))}
                helperText="Jumlah hari maksimal siswa dapat menyimpan buku yang dipinjam."
                required
              />

              <Input
                label="Batas Maksimal Buku"
                type="number"
                min={1}
                value={form.max_books_per_student}
                onChange={(e) => setForm(p => ({ ...p, max_books_per_student: Number(e.target.value) }))}
                helperText="Jumlah buku maksimal yang dapat dipinjam siswa secara bersamaan."
                required
              />

              <Input
                label="Tarif Denda Harian (Rp)"
                type="number"
                min={0}
                value={form.penalty_rate_per_day}
                onChange={(e) => setForm(p => ({ ...p, penalty_rate_per_day: Number(e.target.value) }))}
                helperText="Denda keterlambatan per hari untuk setiap buku yang terlambat dikembalikan."
                required
              />

              {form.allow_extensions && (
                <Input
                  label="Batas Maksimal Perpanjangan"
                  type="number"
                  min={1}
                  value={form.max_extensions}
                  onChange={(e) => setForm(p => ({ ...p, max_extensions: Number(e.target.value) }))}
                  helperText="Frekuensi maksimal siswa diperbolehkan memperpanjang satu transaksi peminjaman."
                  required
                />
              )}
            </div>

            <div className="flex items-start justify-between p-4 bg-muted/30 rounded-xl border border-border/80">
              <div className="space-y-0.5 pr-4">
                <label className="text-sm font-semibold text-foreground">Izinkan Perpanjangan Mandiri</label>
                <p className="text-xs text-muted-foreground">Mengizinkan anggota untuk memperpanjang tenggat waktu peminjaman secara mandiri melalui aplikasi.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={form.allow_extensions}
                onClick={() => setForm(p => ({ ...p, allow_extensions: !p.allow_extensions }))}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer outline-none border-none shrink-0 ${
                  form.allow_extensions ? 'bg-primary-600' : 'bg-muted-foreground/30'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all shadow-sm ${
                    form.allow_extensions ? 'left-6' : 'left-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-start gap-2.5 bg-blue-50 dark:bg-blue-950/20 text-blue-800 dark:text-blue-300 p-3.5 rounded-lg text-xs leading-relaxed border border-blue-200/50 dark:border-blue-900/30">
              <Info size={16} className="shrink-0 mt-0.5" />
              <span>
                <strong>Catatan:</strong> Perubahan aturan sirkulasi ini hanya akan berlaku untuk transaksi peminjaman baru yang dibuat setelah pengaturan ini disimpan. Transaksi peminjaman yang sedang berjalan akan tetap mengikuti aturan lama.
              </span>
            </div>

            <div className="pt-6 border-t border-border flex justify-end">
              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={saving}
                leftIcon={<Save size={18} />}
              >
                Simpan Konfigurasi
              </Button>
            </div>
          </form>
        </Card>

        <Card hoverable={false} className="p-6">
          <div className="flex items-center gap-3 pb-4 mb-6 border-b border-border">
            <div className="p-2 bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-lg">
              <Trash2 size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Pemeliharaan Penyimpanan Server</h3>
              <p className="text-xs text-muted-foreground">Kelola dan bersihkan file media serta QR code usang di server.</p>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-sm text-foreground/80 leading-relaxed">
              Sistem akan memindai seluruh direktori penyimpanan cover buku, foto profil, dan gambar QR code di server. Seluruh file fisik yang tidak lagi terikat dengan data aktif apa pun di database (termasuk yang berasal dari data yang telah dihapus) akan dibersihkan secara permanen untuk membebaskan ruang penyimpanan.
            </p>

            <div className="flex items-start gap-2.5 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 p-3.5 rounded-lg text-xs leading-relaxed border border-amber-200/50 dark:border-amber-900/30">
              <Info size={16} className="shrink-0 mt-0.5" />
              <span>
                <strong>Perhatian:</strong> Tindakan ini bersifat permanen dan akan langsung mengeksekusi penghapusan fisik di server filesystem. Pastikan data penting Anda telah tersinkronisasi.
              </span>
            </div>

            <div className="pt-4 flex justify-start">
              <Button
                type="button"
                variant="danger"
                size="md"
                isLoading={cleaning}
                onClick={handleCleanup}
                leftIcon={<Trash2 size={18} />}
              >
                {cleaning ? 'Membersihkan...' : 'Bersihkan File Tidak Digunakan'}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

