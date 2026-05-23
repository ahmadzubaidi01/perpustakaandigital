'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Upload, Book } from 'lucide-react';
import { booksAPI, categoriesAPI, regionsAPI } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import toast from 'react-hot-toast';

// Reusable UI components
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { PageHeader } from '@/components/ui/PageHeader';

export default function CreateBookPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [schools, setSchools] = useState<any[]>([]);
  const [loadingSchools, setLoadingSchools] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [form, setForm] = useState({
    book_title: '',
    author_name: '',
    publisher_name: '',
    isbn_code: '',
    publication_year: '',
    category_id: '',
    total_stock: '1',
    book_description: '',
    rack_location: '',
    school_id: '',
  });
  const [coverFile, setCoverFile] = useState<File | null>(null);

  const isHighLevelAdmin = !!user && ['super_admin', 'regency_admin', 'district_admin'].includes(user.user_role);

  useEffect(() => {
    categoriesAPI.list().then((r) => setCategories(r.data.data || [])).catch(() => {});

    if (isHighLevelAdmin) {
      setLoadingSchools(true);
      regionsAPI.listSchools({ limit: 100 })
        .then((r) => {
          setSchools(r.data.data || []);
        })
        .catch(() => {
          toast.error('Gagal memuat daftar sekolah');
        })
        .finally(() => {
          setLoadingSchools(false);
        });
    }
  }, [user, isHighLevelAdmin]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error('Ukuran file foto maksimal 2MB');
        return;
      }
      setCoverFile(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.book_title.trim() || !form.author_name.trim()) {
      toast.error('Judul dan Penulis wajib diisi');
      return;
    }

    if (isHighLevelAdmin && !form.school_id) {
      toast.error('Sekolah wajib dipilih');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('book_title', form.book_title);
      formData.append('author_name', form.author_name);
      if (form.publisher_name) formData.append('publisher_name', form.publisher_name);
      if (form.isbn_code) formData.append('isbn_code', form.isbn_code);
      if (form.publication_year) formData.append('publication_year', form.publication_year);
      if (form.category_id) formData.append('category_id', form.category_id);
      if (form.total_stock) formData.append('total_stock', form.total_stock);
      if (form.book_description) formData.append('book_description', form.book_description);
      if (form.rack_location) formData.append('rack_location', form.rack_location);
      if (form.school_id) formData.append('school_id', form.school_id);
      if (coverFile) formData.append('cover_image', coverFile);

      await booksAPI.create(formData);
      toast.success('Buku berhasil ditambahkan!');
      router.push('/dashboard/books');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal menambahkan buku');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Button
          onClick={() => router.back()}
          variant="outline"
          size="sm"
          leftIcon={<ArrowLeft size={16} />}
        />
        <PageHeader
          title="Tambah Buku Baru"
          description="Isi informasi buku untuk menambahkan ke koleksi"
        />
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Cover Image */}
        <Card hoverable={false} className="p-5">
          <h2 className="text-lg font-bold mb-4 text-foreground">Sampul Buku</h2>
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <div className="w-32 h-44 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center bg-muted border-2 border-dashed border-muted-foreground/30">
              {preview ? (
                <img src={preview} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <Book size={36} className="text-muted-foreground/40" />
              )}
            </div>
            <div className="flex-1 text-center sm:text-left">
              <label className="inline-flex items-center gap-2 px-4 h-10 text-sm font-semibold rounded-lg border border-border bg-card text-foreground hover:bg-muted transition-all cursor-pointer">
                <Upload size={16} /> Pilih Gambar
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} className="hidden" />
              </label>
              <p className="text-xs mt-2 text-muted-foreground">Format: JPG, PNG, WebP. Maks: 2MB</p>
            </div>
          </div>
        </Card>

        {/* Book Info */}
        <Card hoverable={false} className="p-6 space-y-4">
          <h2 className="text-lg font-bold mb-2 text-foreground">Informasi Buku</h2>

          {isHighLevelAdmin && (
            <Select
              label="Sekolah *"
              name="school_id"
              value={form.school_id}
              onChange={handleChange}
              disabled={loadingSchools}
              required
              options={[
                { label: '— Pilih Sekolah —', value: '' },
                ...schools.map((s: any) => ({ label: s.school_name, value: s.school_id }))
              ]}
            />
          )}

          <Input
            label="Judul Buku *"
            name="book_title"
            value={form.book_title}
            onChange={handleChange}
            placeholder="Masukkan judul buku"
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Penulis *"
              name="author_name"
              value={form.author_name}
              onChange={handleChange}
              placeholder="Nama penulis"
              required
            />
            <Input
              label="Penerbit"
              name="publisher_name"
              value={form.publisher_name}
              onChange={handleChange}
              placeholder="Nama penerbit"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="ISBN"
              name="isbn_code"
              value={form.isbn_code}
              onChange={handleChange}
              placeholder="978-xxx-xxx"
            />
            <Input
              label="Tahun Terbit"
              name="publication_year"
              type="number"
              value={form.publication_year}
              onChange={handleChange}
              placeholder="2026"
            />
            <Select
              label="Kategori"
              name="category_id"
              value={form.category_id}
              onChange={handleChange}
              options={[
                { label: '— Pilih Kategori —', value: '' },
                ...categories.map((c: any) => ({ label: c.category_name, value: c.category_id }))
              ]}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Jumlah Stok"
              name="total_stock"
              type="number"
              min="0"
              value={form.total_stock}
              onChange={handleChange}
            />
            <Input
              label="Lokasi Rak"
              name="rack_location"
              value={form.rack_location}
              onChange={handleChange}
              placeholder="A-01"
            />
          </div>

          <div className="flex flex-col w-full">
            <label className="input-label">Deskripsi</label>
            <textarea
              name="book_description"
              value={form.book_description}
              onChange={handleChange}
              placeholder="Deskripsi singkat tentang buku..."
              className="input-field min-h-[100px] py-2"
              rows={4}
              style={{ resize: 'vertical' }}
            />
          </div>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            Batal
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={loading}
            leftIcon={<Save size={20} />}
          >
            Simpan Buku
          </Button>
        </div>
      </form>
    </div>
  );
}
