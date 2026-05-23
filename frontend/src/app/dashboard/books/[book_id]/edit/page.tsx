'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Save, Upload, Book as BookIcon } from 'lucide-react';
import { booksAPI, categoriesAPI, regionsAPI, getMediaUrl } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import toast from 'react-hot-toast';

// Reusable UI components
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { PageHeader } from '@/components/ui/PageHeader';
import { Loader } from '@/components/ui/Loader';

export default function EditBookPage() {
  const router = useRouter();
  const params = useParams();
  const bookId = Number(params.book_id);

  const { user } = useAuthStore();
  const isHighLevelAdmin = !!user && ['super_admin', 'regency_admin', 'district_admin'].includes(user.user_role);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [schools, setSchools] = useState<any[]>([]);
  const [loadingSchools, setLoadingSchools] = useState(false);
  const [schoolName, setSchoolName] = useState<string>('');
  const [preview, setPreview] = useState<string | null>(null);
  const [form, setForm] = useState({
    book_title: '',
    author_name: '',
    publisher_name: '',
    isbn_code: '',
    publication_year: '',
    category_id: '',
    total_stock: '0',
    book_description: '',
    rack_location: '',
    book_status: '',
    school_id: '',
  });
  const [coverFile, setCoverFile] = useState<File | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [bookRes, catRes] = await Promise.all([
          booksAPI.get(bookId),
          categoriesAPI.list(),
        ]);
        const book = bookRes.data.data;
        setCategories(catRes.data.data || []);
        setSchoolName(book.school?.school_name || '—');
        setForm({
          book_title: book.book_title || '',
          author_name: book.author_name || '',
          publisher_name: book.publisher_name || '',
          isbn_code: book.isbn_code || '',
          publication_year: book.publication_year?.toString() || '',
          category_id: book.category_id?.toString() || '',
          total_stock: book.total_stock?.toString() || '0',
          book_description: book.book_description || '',
          rack_location: book.rack_location || '',
          book_status: book.book_status || '',
          school_id: book.school_id?.toString() || '',
        });
        if (book.cover_image_url) {
          setPreview(getMediaUrl(book.cover_image_url));
        }

        // Fetch schools if regional admin
        const currentUser = useAuthStore.getState().user;
        const isHigh = !!currentUser && ['super_admin', 'regency_admin', 'district_admin'].includes(currentUser.user_role);
        if (isHigh) {
          setLoadingSchools(true);
          try {
            const r = await regionsAPI.listSchools({ limit: 100 });
            setSchools(r.data.data || []);
          } catch {
            toast.error('Gagal memuat daftar sekolah');
          } finally {
            setLoadingSchools(false);
          }
        }
      } catch {
        toast.error('Gagal memuat data buku');
        router.push('/dashboard/books');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [bookId]);

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

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('book_title', form.book_title);
      formData.append('author_name', form.author_name);
      formData.append('publisher_name', form.publisher_name);
      formData.append('isbn_code', form.isbn_code);
      if (form.publication_year) formData.append('publication_year', form.publication_year);
      if (form.category_id) formData.append('category_id', form.category_id);
      formData.append('total_stock', form.total_stock);
      formData.append('book_description', form.book_description);
      formData.append('rack_location', form.rack_location);
      if (form.book_status) formData.append('book_status', form.book_status);
      if (form.school_id) formData.append('school_id', form.school_id);
      if (coverFile) formData.append('cover_image', coverFile);

      await booksAPI.update(bookId, formData);
      toast.success('Buku berhasil diperbarui!');
      router.push(`/dashboard/books/${bookId}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal memperbarui buku');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader size="lg" />
      </div>
    );
  }

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
          title="Edit Buku"
          description="Perbarui informasi buku"
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
                <BookIcon size={36} className="text-muted-foreground/40" />
              )}
            </div>
            <div className="flex-1 text-center sm:text-left">
              <label className="inline-flex items-center gap-2 px-4 h-10 text-sm font-semibold rounded-lg border border-border bg-card text-foreground hover:bg-muted transition-all cursor-pointer">
                <Upload size={16} /> Ganti Gambar
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} className="hidden" />
              </label>
              <p className="text-xs mt-2 text-muted-foreground">Format: JPG, PNG, WebP. Maks: 2MB</p>
            </div>
          </div>
        </Card>

        {/* Book Info */}
        <Card hoverable={false} className="p-6 space-y-4">
          <h2 className="text-lg font-bold mb-2 text-foreground">Informasi Buku</h2>

          {isHighLevelAdmin ? (
            <Select
              label="Sekolah *"
              name="school_id"
              value={form.school_id}
              onChange={handleChange}
              disabled={loadingSchools}
              required
              options={[
                { label: '— Pilih Sekolah —', value: '' },
                ...schools.map((s: any) => ({ label: s.school_name, value: s.school_id.toString() }))
              ]}
            />
          ) : (
            schoolName && (
              <Input
                label="Sekolah"
                value={schoolName}
                disabled
                className="opacity-60 cursor-not-allowed"
              />
            )
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
            <Select
              label="Status"
              name="book_status"
              value={form.book_status}
              onChange={handleChange}
              options={[
                { label: 'Tersedia', value: 'available' },
                { label: 'Perawatan', value: 'maintenance' },
                { label: 'Rusak', value: 'damaged' },
                { label: 'Hilang', value: 'lost' }
              ]}
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
            isLoading={saving}
            leftIcon={<Save size={20} />}
          >
            Simpan Perubahan
          </Button>
        </div>
      </form>
    </div>
  );
}
