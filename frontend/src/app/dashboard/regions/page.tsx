'use client';

import { useEffect, useState, useCallback } from 'react';
import { MapPin, Plus, Pencil, Trash } from 'lucide-react';
import { regionsAPI } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

// Reusable UI components
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';

export default function RegionsPage() {
  const { user } = useAuthStore();
  const isSuperAdmin = user?.user_role === 'super_admin';
  const isRegencyAdmin = user?.user_role === 'regency_admin';
  const canManageRegencies = isSuperAdmin;
  const canManageDistricts = isSuperAdmin || isRegencyAdmin;

  const [regencies, setRegencies] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRegency, setSelectedRegency] = useState<number | null>(null);

  // Modals state
  const [showRegencyModal, setShowRegencyModal] = useState(false);
  const [showDistrictModal, setShowDistrictModal] = useState(false);
  const [editingData, setEditingData] = useState<any>(null);
  const [formData, setFormData] = useState({ name: '' });
  const [saving, setSaving] = useState(false);

  const selectedRegencyName = regencies.find(r => r.regency_id === selectedRegency)?.regency_name || '';

  const fetchRegencies = useCallback(async () => {
    try {
      const r = await regionsAPI.listRegencies();
      const data = r.data.data || [];
      setRegencies(data);
      // Auto-select for regency admins (API will only return their own regency)
      if (isRegencyAdmin && data.length === 1) {
        setSelectedRegency(data[0].regency_id);
      }
    } catch {
      toast.error('Gagal memuat kabupaten');
    } finally {
      setLoading(false);
    }
  }, [isRegencyAdmin]);

  const fetchDistricts = useCallback(async (regencyId: number) => {
    try {
      const r = await regionsAPI.listDistricts({ regency_id: regencyId });
      setDistricts(r.data.data || []);
    } catch {
      toast.error('Gagal memuat kecamatan');
    }
  }, []);

  useEffect(() => {
    fetchRegencies();
  }, [fetchRegencies]);

  useEffect(() => {
    if (selectedRegency) {
      fetchDistricts(selectedRegency);
    } else {
      setDistricts([]);
    }
  }, [selectedRegency, fetchDistricts]);

  // Regency Handlers
  const handleSaveRegency = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    setSaving(true);
    try {
      if (editingData) {
        await regionsAPI.updateRegency(editingData.regency_id, { regency_name: formData.name });
        toast.success('Kabupaten diperbarui');
      } else {
        await regionsAPI.createRegency({ regency_name: formData.name });
        toast.success('Kabupaten ditambahkan');
      }
      setShowRegencyModal(false);
      fetchRegencies();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal menyimpan kabupaten');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRegency = async (id: number) => {
    if (!confirm('Hapus kabupaten ini?')) return;
    try {
      await regionsAPI.deleteRegency(id);
      toast.success('Kabupaten dihapus');
      if (selectedRegency === id) setSelectedRegency(null);
      fetchRegencies();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal menghapus kabupaten');
    }
  };

  // District Handlers
  const handleSaveDistrict = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !selectedRegency) return;
    setSaving(true);
    try {
      if (editingData) {
        await regionsAPI.updateDistrict(editingData.district_id, { district_name: formData.name });
        toast.success('Kecamatan diperbarui');
      } else {
        await regionsAPI.createDistrict({ district_name: formData.name, regency_id: selectedRegency });
        toast.success('Kecamatan ditambahkan');
      }
      setShowDistrictModal(false);
      fetchDistricts(selectedRegency);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal menyimpan kecamatan');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDistrict = async (id: number) => {
    if (!confirm('Hapus kecamatan ini?')) return;
    try {
      await regionsAPI.deleteDistrict(id);
      toast.success('Kecamatan dihapus');
      if (selectedRegency) fetchDistricts(selectedRegency);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal menghapus kecamatan');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Wilayah"
        description="Kelola hierarki kabupaten dan kecamatan"
      />

      <div className={cn("grid grid-cols-1 gap-6 transition-all duration-300", selectedRegency ? "lg:grid-cols-2" : "max-w-xl mx-auto")}>
        {/* Regency List */}
        <Card hoverable={false} className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-foreground">Kabupaten / Kota</h2>
            {canManageRegencies && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => { setEditingData(null); setFormData({ name: '' }); setShowRegencyModal(true); }}
              >
                <Plus size={16} /> Tambah
              </Button>
            )}
          </div>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : regencies.length ? (
            <div className="space-y-3">
              {regencies.map((r) => {
                const isSelected = selectedRegency === r.regency_id;
                return (
                  <div
                    key={r.regency_id}
                    className={cn(
                      "flex items-center gap-2 p-3 rounded-xl transition-all duration-200 border",
                      isSelected ? "bg-primary/10 border-primary/40" : "bg-card border-border"
                    )}
                  >
                    <button
                      onClick={() => setSelectedRegency(isSelected ? null : r.regency_id)}
                      className="flex-1 flex items-center gap-3 text-left w-full bg-transparent border-none cursor-pointer outline-none"
                    >
                      <MapPin
                        size={18}
                        className={isSelected ? 'text-primary' : 'text-muted-foreground'}
                      />
                      <span className="text-sm font-semibold text-foreground">
                        {r.regency_name}
                      </span>
                    </button>
                    {canManageRegencies && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => { setEditingData(r); setFormData({ name: r.regency_name }); setShowRegencyModal(true); }}
                          title="Edit"
                        >
                          <Pencil size={15} />
                        </Button>
                        <Button
                          variant="danger"
                          size="icon"
                          onClick={() => handleDeleteRegency(r.regency_id)}
                          title="Hapus"
                        >
                          <Trash size={15} />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState icon={MapPin} title="Belum ada kabupaten" />
          )}
        </Card>

        {/* District List */}
        {selectedRegency && (
          <Card hoverable={false} className="p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-foreground">Kecamatan — {selectedRegencyName}</h2>
              {canManageDistricts && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => { setEditingData(null); setFormData({ name: '' }); setShowDistrictModal(true); }}
                >
                  <Plus size={16} /> Tambah
                </Button>
              )}
            </div>
            {districts.length ? (
              <div className="space-y-3">
                {districts.map((d) => (
                  <div
                    key={d.district_id}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border bg-muted/40"
                  >
                    <div className="flex items-center gap-3">
                      <MapPin size={16} className="text-primary" />
                      <span className="text-sm font-semibold text-foreground">
                        {d.district_name}
                      </span>
                    </div>
                    {canManageDistricts && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => { setEditingData(d); setFormData({ name: d.district_name }); setShowDistrictModal(true); }}
                          title="Edit"
                        >
                          <Pencil size={15} />
                        </Button>
                        <Button
                          variant="danger"
                          size="icon"
                          onClick={() => handleDeleteDistrict(d.district_id)}
                          title="Hapus"
                        >
                          <Trash size={15} />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={MapPin} title="Belum ada kecamatan" />
            )}
          </Card>
        )}
      </div>

      {/* Regency Modal */}
      <Modal
        isOpen={showRegencyModal}
        onClose={() => setShowRegencyModal(false)}
        title={editingData ? 'Edit Kabupaten' : 'Tambah Kabupaten'}
      >
        <form onSubmit={handleSaveRegency} className="space-y-4">
          <Input
            label="Nama Kabupaten / Kota"
            value={formData.name}
            onChange={(e) => setFormData({ name: e.target.value })}
            placeholder="Masukkan nama kabupaten"
            required
            autoFocus
          />
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="secondary" onClick={() => setShowRegencyModal(false)}>
              Batal
            </Button>
            <Button type="submit" variant="primary" isLoading={saving}>
              Simpan
            </Button>
          </div>
        </form>
      </Modal>

      {/* District Modal */}
      <Modal
        isOpen={showDistrictModal}
        onClose={() => setShowDistrictModal(false)}
        title={editingData ? 'Edit Kecamatan' : 'Tambah Kecamatan'}
      >
        <form onSubmit={handleSaveDistrict} className="space-y-4">
          <Input
            label="Nama Kecamatan"
            value={formData.name}
            onChange={(e) => setFormData({ name: e.target.value })}
            placeholder="Masukkan nama kecamatan"
            required
            autoFocus
          />
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="secondary" onClick={() => setShowDistrictModal(false)}>
              Batal
            </Button>
            <Button type="submit" variant="primary" isLoading={saving}>
              Simpan
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
