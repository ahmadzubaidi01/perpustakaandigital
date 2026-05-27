'use client';

import { useState, useRef, useEffect } from 'react';
import { User, Mail, Phone, Lock, Save, BookOpen, MapPin, Image as ImageIcon, Shield, Hash } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { usersAPI, getMediaUrl } from '@/lib/api';
import toast from 'react-hot-toast';

// Reusable UI components
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { Tabs } from '@/components/ui/Tabs';

export default function ProfilePage() {
  const { user, setUser } = useAuthStore();
  const [tab, setTab] = useState<'profile' | 'password'>('profile');
  const [profileForm, setProfileForm] = useState({
    full_name: user?.full_name || '',
    phone_number: user?.phone_number || '',
    class_name: user?.class_name || '',
  });

  // Set default values when user is loaded/hydrated
  useEffect(() => {
    if (user) {
      setProfileForm({
        full_name: user.full_name || '',
        phone_number: user.phone_number || '',
        class_name: user.class_name || '',
      });
    }
  }, [user]);

  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [saving, setSaving] = useState(false);

  // Profile image upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setProfilePhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('full_name', profileForm.full_name.trim());
      if (profileForm.phone_number !== undefined) {
        formData.append('phone_number', profileForm.phone_number.trim());
      }
      if (profileForm.class_name !== undefined) {
        formData.append('class_name', profileForm.class_name.trim());
      }
      if (profilePhoto) {
        formData.append('profile_photo', profilePhoto);
      }

      await usersAPI.updateProfile(formData);
      
      toast.success('Profil berhasil diperbarui! Memuat ulang halaman...');
      // Force reload page to refresh headers, avatars, and avoid frontend state synchronization mismatch
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal memperbarui profil');
      setSaving(false);
    }
  };

  const handlePasswordSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error('Password baru dan konfirmasi password tidak cocok');
      return;
    }
    if (passwordForm.new_password.length < 8) {
      toast.error('Password minimal 8 karakter');
      return;
    }
    setSaving(true);
    try {
      await usersAPI.changePassword({
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });
      toast.success('Password berhasil diubah');
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal mengubah password');
    } finally {
      setSaving(false);
    }
  };

  const getDynamicRoleLabel = (u: any): string => {
    if (!u) return '';
    if (u.user_role === 'school_admin' && u.school?.school_name) {
      return `Admin ${u.school.school_name}`;
    }
    if (u.user_role === 'regency_admin' && u.regency?.regency_name) {
      return `Admin ${u.regency.regency_name}`;
    }
    if (u.user_role === 'district_admin' && u.district?.district_name) {
      return `Admin Kecamatan ${u.district.district_name}`;
    }
    const roleLabelsMap: Record<string, string> = {
      super_admin: 'Super Admin',
      regency_admin: 'Admin Kabupaten',
      district_admin: 'Admin Kecamatan',
      school_admin: 'Admin Sekolah',
      student_member: 'Anggota Siswa',
    };
    return roleLabelsMap[u.user_role] || u.user_role || '';
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      <PageHeader
        title="Profil Saya"
        description="Kelola informasi profil personal dan keamanan akun Anda."
      />

      <Tabs
        activeKey={tab}
        onChange={(key) => setTab(key as 'profile' | 'password')}
        items={[
          { key: 'profile', label: 'Informasi Profil', icon: User },
          { key: 'password', label: 'Keamanan & Sandi', icon: Lock },
        ]}
        className="w-full"
      />

      {tab === 'profile' ? (
        <form onSubmit={handleProfileSave} className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left Side: Avatar Upload/Card Display */}
          <Card hoverable={false} className="space-y-4 flex flex-col items-center justify-center py-8 p-6">
            <div className="relative group w-32 h-32 rounded-full overflow-hidden border border-border flex items-center justify-center bg-muted">
              {photoPreview ? (
                <img src={photoPreview} alt="Preview Avatar" className="w-full h-full object-cover" />
              ) : user?.profile_photo_url ? (
                <img src={getMediaUrl(user.profile_photo_url)} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="text-4xl font-extrabold text-primary-600 dark:text-primary-400">
                  {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                </div>
              )}
            </div>
            
            <div className="text-center">
              <p className="text-xs font-semibold mb-2 text-[var(--heading)]">Foto Profil (Ubah)</p>
              <input 
                type="file" 
                accept="image/*" 
                onChange={handlePhotoChange} 
                ref={fileInputRef} 
                className="hidden" 
                id="profile-avatar-upload"
              />
              <label 
                htmlFor="profile-avatar-upload" 
                className="inline-flex items-center justify-center font-medium h-8 px-3 text-xs rounded-md border border-border bg-transparent text-foreground hover:bg-secondary active:scale-[0.98] transition-all cursor-pointer"
              >
                Pilih Foto
              </label>
            </div>

            <div className="w-full pt-4 border-t border-border text-left space-y-1">
              <h3 className="text-sm font-bold text-center text-foreground leading-tight">{user?.full_name}</h3>
              <p className="text-xs text-center text-muted-foreground mt-1 mb-2 break-all">{user?.email_address}</p>
              <div className="flex justify-center">
                <Badge variant={user?.user_role === 'super_admin' ? 'danger' : 'primary'}>
                  {getDynamicRoleLabel(user)}
                </Badge>
              </div>
            </div>
          </Card>

          {/* Right Side: Form Inputs */}
          <Card hoverable={false} className="md:col-span-2 p-8">
            <h3 className="text-lg font-bold text-foreground mb-6">Ubah Informasi Pengguna</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Nama Lengkap *"
                  leftIcon={<User size={18} />}
                  value={profileForm.full_name}
                  onChange={(e) => setProfileForm(p => ({ ...p, full_name: e.target.value }))}
                  required
                />
                
                <Input
                  label="Nomor Telepon"
                  leftIcon={<Phone size={18} />}
                  value={profileForm.phone_number}
                  onChange={(e) => setProfileForm(p => ({ ...p, phone_number: e.target.value }))}
                  placeholder="Contoh: 08123456789"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Alamat Email (Terkunci)"
                  leftIcon={<Mail size={18} />}
                  value={user?.email_address || ''}
                  disabled
                  helperText="Email terkunci demi alasan keamanan."
                />

                <Input
                  label="Role Pengguna (Terkunci)"
                  leftIcon={<Shield size={18} />}
                  value={getDynamicRoleLabel(user)}
                  disabled
                />
              </div>

              {user?.user_role === 'student_member' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Nomor Induk Siswa Nasional / NISN (Terkunci)"
                    leftIcon={<Hash size={18} />}
                    value={user?.student_id_number || 'Tidak Ada NISN'}
                    disabled
                  />

                  <Input
                    label="Kelas *"
                    leftIcon={<BookOpen size={18} />}
                    value={profileForm.class_name}
                    onChange={(e) => setProfileForm(p => ({ ...p, class_name: e.target.value }))}
                    placeholder="Contoh: XII IPA 1"
                    required
                  />
                </div>
              )}

              {/* Regional Hierarchies */}
              {user?.user_role !== 'super_admin' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-border">
                  <Input
                    label="Kabupaten (Terkunci)"
                    leftIcon={<MapPin size={16} />}
                    value={user?.regency?.regency_name || '-'}
                    disabled
                  />

                  <Input
                    label="Kecamatan (Terkunci)"
                    leftIcon={<MapPin size={16} />}
                    value={user?.district?.district_name || '-'}
                    disabled
                  />

                  <Input
                    label="Sekolah / Unit (Terkunci)"
                    leftIcon={<BookOpen size={16} />}
                    value={user?.school?.school_name || '-'}
                    disabled
                  />
                </div>
              )}

              <div className="pt-6 border-t border-border flex justify-end">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  isLoading={saving}
                  leftIcon={<Save size={18} />}
                >
                  Simpan Perubahan
                </Button>
              </div>
            </div>
          </Card>
        </form>
      ) : (
        <div className="max-w-xl mx-auto">
          <Card hoverable={false} className="p-8">
            <h3 className="text-lg font-bold text-foreground mb-6">Ubah Sandi Keamanan</h3>
            <form onSubmit={handlePasswordSave} className="space-y-4">
              <Input
                label="Password Saat Ini"
                type="password"
                leftIcon={<Lock size={18} />}
                value={passwordForm.current_password}
                onChange={(e) => setPasswordForm(p => ({ ...p, current_password: e.target.value }))}
                required
              />
              
              <Input
                label="Password Baru"
                type="password"
                leftIcon={<Lock size={18} />}
                value={passwordForm.new_password}
                onChange={(e) => setPasswordForm(p => ({ ...p, new_password: e.target.value }))}
                placeholder="Minimal 8 karakter"
                required
                helperText="Sandi baru harus terdiri dari minimal 8 karakter."
              />
              
              <Input
                label="Konfirmasi Password Baru"
                type="password"
                leftIcon={<Lock size={18} />}
                value={passwordForm.confirm_password}
                onChange={(e) => setPasswordForm(p => ({ ...p, confirm_password: e.target.value }))}
                required
              />

              <div className="pt-4 border-t border-border flex justify-end">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  isLoading={saving}
                  leftIcon={<Lock size={18} />}
                >
                  Perbarui Password
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}

