'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Pencil, Loader2, Image as ImageIcon, Lock } from 'lucide-react';
import { usersAPI, regionsAPI } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import toast from 'react-hot-toast';

// Reusable UI components
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';

export default function EditUserPage() {
  const router = useRouter();
  const params = useParams();
  const userId = Number(params.user_id);
  const { user: currentUser } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form Fields
  const [fullName, setFullName] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [userRole, setUserRole] = useState('');
  const [accountStatus, setAccountStatus] = useState('active');
  const [studentIdNumber, setStudentIdNumber] = useState('');
  const [className, setClassName] = useState('');

  // Regions Data
  const [regencies, setRegencies] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);
  const [schools, setSchools] = useState<any[]>([]);

  // Selected region IDs
  const [selectedRegencyId, setSelectedRegencyId] = useState<string>('');
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>('');
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('');
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Initialize Role Options based on Logged-in User RBAC
  const getRoleOptions = () => {
    const role = currentUser?.user_role || '';
    if (role === 'super_admin') {
      return [
        { value: 'super_admin', label: 'Super Admin' },
        { value: 'regency_admin', label: 'Admin Kabupaten' },
        { value: 'district_admin', label: 'Admin Kecamatan' },
        { value: 'school_admin', label: 'Admin Sekolah' },
        { value: 'student_member', label: 'Siswa' }
      ];
    } else if (role === 'regency_admin') {
      return [
        { value: 'regency_admin', label: 'Admin Kabupaten' },
        { value: 'district_admin', label: 'Admin Kecamatan' },
        { value: 'school_admin', label: 'Admin Sekolah' },
        { value: 'student_member', label: 'Siswa' }
      ];
    } else if (role === 'district_admin') {
      return [
        { value: 'district_admin', label: 'Admin Kecamatan' },
        { value: 'school_admin', label: 'Admin Sekolah' },
        { value: 'student_member', label: 'Siswa' }
      ];
    } else if (role === 'school_admin') {
      return [
        { value: 'student_member', label: 'Siswa' }
      ];
    }
    return [];
  };

  // Fetch target user data and regions on mount
  useEffect(() => {
    if (!userId) return;

    const init = async () => {
      try {
        setLoading(true);
        // Load target user details
        const res = await usersAPI.get(userId);
        const u = res.data.data;
        if (!u) throw new Error('User not found');

        setFullName(u.full_name || '');
        setEmailAddress(u.email_address || '');
        setPhoneNumber(u.phone_number || '');
        setUserRole(u.user_role || '');
        setAccountStatus(u.account_status || 'active');
        setStudentIdNumber(u.student_id_number || '');
        setClassName(u.class_name || '');

        if (u.profile_photo_url) {
          setPhotoPreview(u.profile_photo_url.startsWith('http') ? u.profile_photo_url : `http://localhost:5000${u.profile_photo_url}`);
        }

        if (u.regency_id) setSelectedRegencyId(u.regency_id.toString());
        if (u.district_id) setSelectedDistrictId(u.district_id.toString());
        if (u.school_id) setSelectedSchoolId(u.school_id.toString());

        // Fetch Regencies for super_admin
        if (currentUser?.user_role === 'super_admin') {
          const regRes = await regionsAPI.listRegencies();
          setRegencies(regRes.data.data || []);
        }
      } catch (err: any) {
        toast.error(err.response?.data?.message || 'Gagal memuat detail pengguna');
        router.push('/dashboard/users');
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [userId, currentUser, router]);

  // Fetch Districts when Regency changes (handles both initialization and manual changes)
  useEffect(() => {
    const regencyId = currentUser?.user_role === 'super_admin' ? selectedRegencyId : currentUser?.regency_id;
    if (!regencyId) {
      setDistricts([]);
      setSchools([]);
      return;
    }

    regionsAPI.listDistricts({ regency_id: regencyId })
      .then((res) => {
        setDistricts(res.data.data || []);
      })
      .catch(() => {});
  }, [selectedRegencyId, currentUser]);

  // Fetch Schools when District changes
  useEffect(() => {
    const districtId = ['super_admin', 'regency_admin'].includes(currentUser?.user_role || '') 
      ? selectedDistrictId 
      : currentUser?.district_id;

    if (!districtId) {
      setSchools([]);
      return;
    }

    regionsAPI.listSchools({ district_id: districtId })
      .then((res) => {
        setSchools(res.data.data || []);
      })
      .catch(() => {});
  }, [selectedDistrictId, currentUser]);

  // Photo Handling
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setProfilePhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName || !userRole || !accountStatus) {
      toast.error('Harap isi semua field utama yang bertanda bintang (*)');
      return;
    }

    if (userRole === 'student_member') {
      if (!studentIdNumber) {
        toast.error('Nomor Induk Siswa (NIS) wajib diisi untuk siswa.');
        return;
      }
      if (!className) {
        toast.error('Nama kelas wajib diisi untuk siswa.');
        return;
      }
    }

    // Regional checks
    if (userRole !== 'super_admin') {
      const finalReg = currentUser?.regency_id || selectedRegencyId;
      if (!finalReg) {
        toast.error('Kabupaten wajib dipilih.');
        return;
      }

      if (['district_admin', 'school_admin', 'student_member'].includes(userRole)) {
        const finalDist = currentUser?.district_id || selectedDistrictId;
        if (!finalDist) {
          toast.error('Kecamatan wajib dipilih.');
          return;
        }
      }

      if (['school_admin', 'student_member'].includes(userRole)) {
        const finalSchool = currentUser?.school_id || selectedSchoolId;
        if (!finalSchool) {
          toast.error('Sekolah wajib dipilih.');
          return;
        }
      }
    }

    setSaving(true);

    try {
      const formData = new FormData();
      formData.append('full_name', fullName.trim());
      formData.append('user_role', userRole);
      formData.append('account_status', accountStatus);
      formData.append('phone_number', phoneNumber ? phoneNumber.trim() : '');
      
      if (userRole === 'student_member') {
        formData.append('student_id_number', studentIdNumber.trim());
        formData.append('class_name', className.trim());
      } else {
        formData.append('student_id_number', '');
        formData.append('class_name', '');
      }

      // Appending regional constraints
      if (userRole !== 'super_admin') {
        const regVal = currentUser?.regency_id ? currentUser.regency_id.toString() : selectedRegencyId;
        formData.append('regency_id', regVal || '');

        if (['district_admin', 'school_admin', 'student_member'].includes(userRole)) {
          const distVal = currentUser?.district_id ? currentUser.district_id.toString() : selectedDistrictId;
          formData.append('district_id', distVal || '');
        } else {
          formData.append('district_id', '');
        }

        if (['school_admin', 'student_member'].includes(userRole)) {
          const schoolVal = currentUser?.school_id ? currentUser.school_id.toString() : selectedSchoolId;
          formData.append('school_id', schoolVal || '');
        } else {
          formData.append('school_id', '');
        }
      } else {
        formData.append('regency_id', '');
        formData.append('district_id', '');
        formData.append('school_id', '');
      }

      if (profilePhoto) {
        formData.append('profile_photo', profilePhoto);
      }

      await usersAPI.update(userId, formData);
      toast.success('Pengguna berhasil diperbarui!');
      router.push('/dashboard/users');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal memperbarui pengguna');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  // Determine what regional selectors should be active / visible
  const isRegencyVisible = userRole !== 'super_admin' && currentUser?.user_role === 'super_admin';
  const isDistrictVisible = userRole !== 'super_admin' && ['district_admin', 'school_admin', 'student_member'].includes(userRole) && ['super_admin', 'regency_admin'].includes(currentUser?.user_role || '');
  const isSchoolVisible = userRole !== 'super_admin' && ['school_admin', 'student_member'].includes(userRole) && ['super_admin', 'regency_admin', 'district_admin'].includes(currentUser?.user_role || '');

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => router.push('/dashboard/users')} title="Kembali ke Daftar Pengguna">
          <ArrowLeft size={16} />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-[var(--heading)]">Edit Pengguna</h1>
          <p className="text-sm mt-1 text-[var(--text-muted)]">Perbarui profil, peranan, atau status akun pengguna</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Side: Avatar/Photo Upload */}
        <Card hoverable={false} className="space-y-4 flex flex-col items-center justify-center py-8 p-6">
          <div className="relative group w-32 h-32 rounded-full overflow-hidden border border-border flex items-center justify-center bg-muted">
            {photoPreview ? (
              <img src={photoPreview} alt="Preview Avatar" className="w-full h-full object-cover" />
            ) : (
              <ImageIcon size={40} className="text-muted-foreground/50" />
            )}
          </div>
          <div className="text-center">
            <p className="text-xs font-semibold mb-2 text-[var(--heading)]">Foto Profil (Opsional)</p>
            <input type="file" accept="image/*" onChange={handlePhotoChange} id="avatar-upload" className="hidden" />
            <label htmlFor="avatar-upload" className="inline-flex items-center justify-center font-medium h-8 px-3 text-xs rounded-md border border-border bg-transparent text-foreground hover:bg-secondary active:scale-[0.98] transition-all cursor-pointer">
              Pilih Foto
            </label>
          </div>
        </Card>

        {/* Right Side: Form Fields */}
        <Card hoverable={false} className="md:col-span-2 space-y-6 p-6!">
          <h3 className="text-lg font-bold flex items-center gap-2 border-b pb-3 border-border text-[var(--heading)]">
            <Pencil size={20} className="text-primary" /> Perbarui Data
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Nama Lengkap *"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nama Lengkap"
              required
            />

            <Input
              label="Alamat Email"
              type="email"
              value={emailAddress}
              disabled
              rightIcon={<Lock size={12} />}
              helperText="Email bersifat unik dan dikunci untuk keamanan database."
              title="Alamat email tidak dapat diubah"
            />

            <Input
              label="Nomor Telepon"
              type="text"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="0812XXXXXXXX"
            />

            <Select
              label="Role Pengguna *"
              value={userRole}
              onChange={(e) => setUserRole(e.target.value)}
              required
            >
              {getRoleOptions().map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </Select>

            <Select
              label="Status Akun *"
              value={accountStatus}
              onChange={(e) => setAccountStatus(e.target.value)}
              required
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </Select>
          </div>

          {/* Regional Settings */}
          {userRole && userRole !== 'super_admin' && (
            <div className="space-y-4 pt-4 border-t border-border">
              <h4 className="text-sm font-bold uppercase tracking-wider text-[var(--heading)]">Batasan Regional</h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {isRegencyVisible ? (
                  <Select
                    label="Kabupaten *"
                    value={selectedRegencyId}
                    onChange={(e) => setSelectedRegencyId(e.target.value)}
                    required
                  >
                    <option value="">Pilih Kabupaten</option>
                    {regencies.map((r) => <option key={r.regency_id} value={r.regency_id}>{r.regency_name}</option>)}
                  </Select>
                ) : currentUser?.user_role !== 'super_admin' && selectedRegencyId ? (
                  <Input
                    label="Kabupaten"
                    type="text"
                    disabled
                    value={currentUser?.regency?.regency_name || selectedRegencyId}
                  />
                ) : null}

                {isDistrictVisible ? (
                  <Select
                    label="Kecamatan *"
                    value={selectedDistrictId}
                    onChange={(e) => setSelectedDistrictId(e.target.value)}
                    required
                  >
                    <option value="">Pilih Kecamatan</option>
                    {districts.map((d) => <option key={d.district_id} value={d.district_id}>{d.district_name}</option>)}
                  </Select>
                ) : currentUser?.user_role !== 'super_admin' && currentUser?.user_role !== 'regency_admin' && selectedDistrictId ? (
                  <Input
                    label="Kecamatan"
                    type="text"
                    disabled
                    value={currentUser?.district?.district_name || selectedDistrictId}
                  />
                ) : null}

                {isSchoolVisible ? (
                  <Select
                    label="Sekolah *"
                    value={selectedSchoolId}
                    onChange={(e) => setSelectedSchoolId(e.target.value)}
                    required
                  >
                    <option value="">Pilih Sekolah</option>
                    {schools.map((s) => <option key={s.school_id} value={s.school_id}>{s.school_name}</option>)}
                  </Select>
                ) : currentUser?.user_role === 'school_admin' && selectedSchoolId ? (
                  <Input
                    label="Sekolah"
                    type="text"
                    disabled
                    value={currentUser?.school?.school_name || selectedSchoolId}
                  />
                ) : null}
              </div>
            </div>
          )}

          {/* Student Fields */}
          {userRole === 'student_member' && (
            <div className="space-y-4 pt-4 border-t border-border">
              <h4 className="text-sm font-bold uppercase tracking-wider text-[var(--heading)]">Detail Data Siswa</h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Nomor Induk Siswa (NIS) *"
                  type="text"
                  value={studentIdNumber}
                  onChange={(e) => setStudentIdNumber(e.target.value)}
                  placeholder="Masukkan NIS"
                  required
                />

                <Input
                  label="Kelas *"
                  type="text"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  placeholder="Contoh: XII IPA 1"
                  required
                />
              </div>
            </div>
          )}

          {/* Submit Actions */}
          <div className="flex justify-end gap-3 pt-6 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/dashboard/users')}
              disabled={saving}
            >
              Batal
            </Button>
            <Button
              type="submit"
              isLoading={saving}
            >
              Perbarui Pengguna
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
