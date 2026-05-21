'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, School, Plus } from 'lucide-react';
import { regionsAPI } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import toast from 'react-hot-toast';

// Reusable UI components
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { PageHeader } from '@/components/ui/PageHeader';

export default function CreateSchoolPage() {
  const router = useRouter();
  const { user: currentUser } = useAuthStore();

  const [loading, setLoading] = useState(false);
  const [fetchingRegions, setFetchingRegions] = useState(false);

  // Form Fields
  const [schoolName, setSchoolName] = useState('');
  const [schoolAddress, setSchoolAddress] = useState('');

  // Regions Data
  const [regencies, setRegencies] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);

  // Selected region IDs
  const [selectedRegencyId, setSelectedRegencyId] = useState<string>('');
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>('');

  const isSuperAdmin = currentUser?.user_role === 'super_admin';
  const isRegencyAdmin = currentUser?.user_role === 'regency_admin';
  const isDistrictAdmin = currentUser?.user_role === 'district_admin';

  // Redirect if unauthorized
  useEffect(() => {
    if (currentUser && !['super_admin', 'regency_admin', 'district_admin'].includes(currentUser.user_role)) {
      toast.error('Anda tidak memiliki akses untuk menambah sekolah');
      router.push('/dashboard/schools');
    }
  }, [currentUser, router]);

  // Prepopulate locked regional values from currentUser
  useEffect(() => {
    if (!currentUser) return;

    if (currentUser.regency_id) {
      setSelectedRegencyId(currentUser.regency_id.toString());
    }
    if (currentUser.district_id) {
      setSelectedDistrictId(currentUser.district_id.toString());
    }
  }, [currentUser]);

  // Fetch Regencies (Only if super_admin)
  useEffect(() => {
    if (isSuperAdmin) {
      setFetchingRegions(true);
      regionsAPI.listRegencies()
        .then((res) => setRegencies(res.data.data || []))
        .catch(() => toast.error('Gagal memuat data kabupaten'))
        .finally(() => setFetchingRegions(false));
    }
  }, [isSuperAdmin]);

  // Fetch Districts when Regency changes
  useEffect(() => {
    const regencyId = isSuperAdmin ? selectedRegencyId : currentUser?.regency_id;
    if (!regencyId) {
      setDistricts([]);
      return;
    }

    // Only load districts if the user is super_admin or regency_admin
    // (district_admins have their district_id locked and don't need selection)
    if (isSuperAdmin || isRegencyAdmin) {
      setFetchingRegions(true);
      regionsAPI.listDistricts({ regency_id: regencyId })
        .then((res) => {
          setDistricts(res.data.data || []);
          if (isSuperAdmin) {
            // Reset selected district if we switched regency manually
            setSelectedDistrictId('');
          }
        })
        .catch(() => toast.error('Gagal memuat data kecamatan'))
        .finally(() => setFetchingRegions(false));
    }
  }, [selectedRegencyId, currentUser, isSuperAdmin, isRegencyAdmin]);

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!schoolName.trim() || !schoolAddress.trim()) {
      toast.error('Harap isi nama sekolah dan alamat lengkap.');
      return;
    }

    const finalDistrictId = isDistrictAdmin ? currentUser?.district_id?.toString() : selectedDistrictId;
    const finalRegencyId = (isDistrictAdmin || isRegencyAdmin) ? currentUser?.regency_id?.toString() : selectedRegencyId;

    if (!finalDistrictId) {
      toast.error('Kecamatan wajib dipilih.');
      return;
    }

    setLoading(true);

    try {
      const payload: any = {
        school_name: schoolName.trim(),
        school_address: schoolAddress.trim(),
        district_id: parseInt(finalDistrictId, 10),
      };

      if (finalRegencyId) {
        payload.regency_id = parseInt(finalRegencyId, 10);
      }

      await regionsAPI.createSchool(payload);
      toast.success('Sekolah berhasil ditambahkan!');
      router.push('/dashboard/schools');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal menambahkan sekolah');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          onClick={() => router.push('/dashboard/schools')}
          variant="outline"
          size="sm"
          leftIcon={<ArrowLeft size={16} />}
        />
        <PageHeader
          title="Tambah Sekolah Baru"
          description="Tambahkan instansi sekolah baru ke dalam wilayah koordinasi Anda"
        />
      </div>

      <Card hoverable={false} className="space-y-6">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <School size={20} className="text-primary" />
          <span className="text-lg font-bold text-foreground">Informasi Sekolah</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            label="Nama Sekolah *"
            type="text"
            value={schoolName}
            onChange={(e) => setSchoolName(e.target.value)}
            placeholder="Contoh: SMA Negeri 1 Banyuwangi"
            required
            disabled={loading}
          />

          <div className="flex flex-col w-full">
            <label className="input-label">Alamat Lengkap *</label>
            <textarea
              value={schoolAddress}
              onChange={(e) => setSchoolAddress(e.target.value)}
              placeholder="Masukkan jalan, RT/RW, dan desa/kelurahan..."
              className="input-field min-h-[100px] py-2"
              style={{ resize: 'vertical' }}
              required
              disabled={loading}
            />
          </div>

          {/* Regional Settings */}
          <div className="space-y-4 pt-4 border-t border-border">
            <h4 className="text-sm font-bold uppercase tracking-wider text-foreground">Cakupan Wilayah</h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Regency Input/Select */}
              {isSuperAdmin ? (
                <Select
                  label="Kabupaten *"
                  value={selectedRegencyId}
                  onChange={(e) => setSelectedRegencyId(e.target.value)}
                  required
                  disabled={loading || fetchingRegions}
                  options={[
                    { label: 'Pilih Kabupaten', value: '' },
                    ...regencies.map((r) => ({ label: r.regency_name, value: r.regency_id }))
                  ]}
                />
              ) : currentUser?.regency?.regency_name ? (
                <Input
                  label="Kabupaten"
                  type="text"
                  disabled
                  className="cursor-not-allowed opacity-60"
                  value={currentUser.regency.regency_name}
                />
              ) : null}

              {/* District Input/Select */}
              {isSuperAdmin || isRegencyAdmin ? (
                <Select
                  label="Kecamatan *"
                  value={selectedDistrictId}
                  onChange={(e) => setSelectedDistrictId(e.target.value)}
                  required
                  disabled={loading || fetchingRegions || (!selectedRegencyId && isSuperAdmin)}
                  options={[
                    { label: 'Pilih Kecamatan', value: '' },
                    ...districts.map((d) => ({ label: d.district_name, value: d.district_id }))
                  ]}
                />
              ) : currentUser?.district?.district_name ? (
                <Input
                  label="Kecamatan"
                  type="text"
                  disabled
                  className="cursor-not-allowed opacity-60"
                  value={currentUser.district.district_name}
                />
              ) : null}
            </div>
          </div>

          {/* Submit Actions */}
          <div className="flex justify-end gap-3 pt-6 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/dashboard/schools')}
              disabled={loading}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={loading}
              leftIcon={<Plus size={16} />}
            >
              Tambah Sekolah
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
