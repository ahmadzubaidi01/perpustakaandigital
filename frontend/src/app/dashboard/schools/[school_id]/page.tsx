'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, School, Pencil } from 'lucide-react';
import { regionsAPI } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import toast from 'react-hot-toast';

// Reusable UI components
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { PageHeader } from '@/components/ui/PageHeader';
import { Loader } from '@/components/ui/Loader';

export default function EditSchoolPage() {
  const router = useRouter();
  const params = useParams();
  const schoolId = Number(params.school_id);
  const { user: currentUser } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form Fields
  const [schoolName, setSchoolName] = useState('');
  const [schoolAddress, setSchoolAddress] = useState('');
  const [schoolStatus, setSchoolStatus] = useState('active');

  // Read-only region details
  const [districtName, setDistrictName] = useState('');
  const [regencyName, setRegencyName] = useState('');

  // Redirect if unauthorized
  useEffect(() => {
    if (currentUser && !['super_admin', 'regency_admin', 'district_admin'].includes(currentUser.user_role)) {
      toast.error('Anda tidak memiliki akses untuk mengubah data sekolah');
      router.push('/dashboard/schools');
    }
  }, [currentUser, router]);

  // Fetch school details on mount
  useEffect(() => {
    if (!schoolId) return;

    const fetchSchoolDetails = async () => {
      try {
        setLoading(true);
        const res = await regionsAPI.getSchool(schoolId);
        const s = res.data.data;
        if (!s) throw new Error('Sekolah tidak ditemukan');

        setSchoolName(s.school_name || '');
        setSchoolAddress(s.school_address || '');
        setSchoolStatus(s.school_status || 'active');
        setDistrictName(s.district?.district_name || '-');
        setRegencyName(s.regency?.regency_name || '-');
      } catch (err: any) {
        toast.error(err.response?.data?.message || 'Gagal memuat detail sekolah');
        router.push('/dashboard/schools');
      } finally {
        setLoading(false);
      }
    };

    fetchSchoolDetails();
  }, [schoolId, router]);

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!schoolName.trim() || !schoolAddress.trim() || !schoolStatus) {
      toast.error('Harap isi semua field utama yang bertanda bintang (*)');
      return;
    }

    setSaving(true);

    try {
      const payload = {
        school_name: schoolName.trim(),
        school_address: schoolAddress.trim(),
        school_status: schoolStatus,
      };

      await regionsAPI.updateSchool(schoolId, payload);
      toast.success('Sekolah berhasil diperbarui!');
      router.push('/dashboard/schools');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal memperbarui sekolah');
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
          title="Edit Sekolah"
          description="Perbarui data instansi sekolah dan status aktifnya"
        />
      </div>

      <Card hoverable={false} className="space-y-6">
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <School size={20} className="text-primary" />
          <span className="text-lg font-bold text-foreground">Perbarui Data Sekolah</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            label="Nama Sekolah *"
            type="text"
            value={schoolName}
            onChange={(e) => setSchoolName(e.target.value)}
            placeholder="Nama Sekolah"
            required
            disabled={saving}
          />

          <div className="flex flex-col w-full">
            <label className="input-label">Alamat Lengkap *</label>
            <textarea
              value={schoolAddress}
              onChange={(e) => setSchoolAddress(e.target.value)}
              placeholder="Alamat Lengkap Sekolah"
              className="input-field min-h-[100px] py-2"
              style={{ resize: 'vertical' }}
              required
              disabled={saving}
            />
          </div>

          <Select
            label="Status Sekolah *"
            value={schoolStatus}
            onChange={(e) => setSchoolStatus(e.target.value)}
            required
            disabled={saving}
            options={[
              { label: 'Active', value: 'active' },
              { label: 'Inactive', value: 'inactive' }
            ]}
          />

          {/* Regional Constraints (Read-only) */}
          <div className="space-y-4 pt-4 border-t border-border">
            <h4 className="text-sm font-bold uppercase tracking-wider text-foreground">Wilayah Administratif (Terkunci)</h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Kabupaten"
                type="text"
                disabled
                className="cursor-not-allowed opacity-60"
                value={regencyName}
              />
              <Input
                label="Kecamatan"
                type="text"
                disabled
                className="cursor-not-allowed opacity-60"
                value={districtName}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Cakupan kabupaten dan kecamatan dikunci setelah sekolah terdaftar untuk menjaga integritas database relasional regional.
            </p>
          </div>

          {/* Submit Actions */}
          <div className="flex justify-end gap-3 pt-6 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/dashboard/schools')}
              disabled={saving}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={saving}
              leftIcon={<Pencil size={16} />}
            >
              Simpan Perubahan
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
