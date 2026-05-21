'use client';

import { useEffect, useState } from 'react';
import { FileText, Plus, Pencil, Trash, Check, X } from 'lucide-react';
import { categoriesAPI } from '@/lib/api';
import toast from 'react-hot-toast';

// Reusable UI components
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);

  const fetch = () => {
    setLoading(true);
    categoriesAPI.list()
      .then((r) => setCategories(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetch();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await categoriesAPI.create({ category_name: newName.trim() });
      setNewName('');
      toast.success('Kategori dibuat');
      fetch();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id: number) => {
    if (!editName.trim()) return;
    try {
      await categoriesAPI.update(id, { category_name: editName.trim() });
      setEditId(null);
      toast.success('Kategori diperbarui');
      fetch();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal');
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Hapus kategori "${name}"?`)) return;
    try {
      await categoriesAPI.delete(id);
      toast.success('Kategori dihapus');
      fetch();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <PageHeader
        title="Kategori Buku"
        description="Kelola kategori untuk mengorganisir koleksi"
      />

      <Card hoverable={false} className="p-4">
        <form onSubmit={handleCreate} className="flex gap-3">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nama kategori baru..."
            containerClassName="flex-1"
          />
          <Button type="submit" variant="primary" isLoading={saving} className="shrink-0">
            <Plus size={16} /> Tambah
          </Button>
        </form>
      </Card>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="rect" className="h-14 w-full" />
          ))}
        </div>
      ) : categories.length ? (
        <div className="space-y-3 stagger-children">
          {categories.map((c) => (
            <div
              key={c.category_id}
              className="flex items-center gap-3 p-3 border border-border bg-card rounded-xl shadow-xs"
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10 text-primary shrink-0"
              >
                <FileText size={18} />
              </div>
              {editId === c.category_id ? (
                <div className="flex-1 flex gap-2 items-center">
                  <Input 
                    value={editName} 
                    onChange={(e) => setEditName(e.target.value)} 
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleUpdate(c.category_id);
                      if (e.key === 'Escape') setEditId(null);
                    }} 
                    className="flex-1"
                    autoFocus 
                  />
                  <Button 
                    type="button"
                    size="icon"
                    variant="success"
                    onClick={() => handleUpdate(c.category_id)}
                    title="Simpan"
                  >
                    <Check size={16} />
                  </Button>
                  <Button 
                    type="button"
                    size="icon"
                    variant="danger"
                    onClick={() => setEditId(null)}
                    title="Batal"
                  >
                    <X size={16} />
                  </Button>
                </div>
              ) : (
                <>
                  <span className="flex-1 text-sm font-semibold text-foreground truncate">
                    {c.category_name}
                  </span>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline"
                      size="icon"
                      onClick={() => { setEditId(c.category_id); setEditName(c.category_name); }} 
                      title="Edit Kategori"
                    >
                      <Pencil size={15} />
                    </Button>
                    <Button 
                      variant="danger"
                      size="icon"
                      onClick={() => handleDelete(c.category_id, c.category_name)} 
                      title="Hapus Kategori"
                    >
                      <Trash size={15} />
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={FileText} title="Belum ada kategori" />
      )}
    </div>
  );
}
