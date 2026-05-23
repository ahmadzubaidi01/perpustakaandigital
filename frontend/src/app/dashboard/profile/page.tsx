'use client';

import { useState } from 'react';
import { User, Mail, Phone, Lock, Save, BookOpen, MapPin } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { usersAPI } from '@/lib/api';
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
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [saving, setSaving] = useState(false);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('full_name', profileForm.full_name);
      if (profileForm.phone_number !== undefined) {
        formData.append('phone_number', profileForm.phone_number);
      }
      if (profileForm.class_name !== undefined) {
        formData.append('class_name', profileForm.class_name);
      }
      const res = await usersAPI.updateProfile(formData);
      setUser({ ...user!, ...res.data.data });
      toast.success('Profil berhasil diperbarui');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Gagal memperbarui profil');
    } finally {
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
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <PageHeader
        title="Profil Saya"
        description="Kelola informasi profil personal dan keamanan akun Anda."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column - Card Profile Overview */}
        <div className="md:col-span-1 space-y-6">
          <Card hoverable={false} className="p-6 flex flex-col items-center text-center">
            <div className="w-24 h-24 rounded-2xl flex items-center justify-center text-3xl font-extrabold bg-primary-100 text-primary-600 dark:bg-primary-950/40 dark:text-primary-400 shrink-0 shadow-inner mb-4 transition-transform hover:scale-105 duration-300">
              {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            
            <h3 className="text-lg font-bold text-foreground leading-tight">{user?.full_name}</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-3 break-all">{user?.email_address}</p>
            
            <Badge variant={user?.user_role === 'super_admin' ? 'danger' : 'primary'} className="mb-4">
              {getDynamicRoleLabel(user)}
            </Badge>

            {/* School / Region Details if they exist */}
            {(user?.school || user?.district || user?.regency || user?.student_id_number) && (
              <div className="w-full pt-4 border-t border-border text-left space-y-3 text-xs text-muted-foreground">
                {user.student_id_number && (
                  <div className="flex justify-between items-center bg-muted/50 p-2 rounded-lg">
                    <span className="font-semibold text-foreground">NISN:</span>
                    <span className="font-mono bg-background px-1.5 py-0.5 rounded border border-border">{user.student_id_number}</span>
                  </div>
                )}
                {user.school && (
                  <div className="flex items-start gap-2">
                    <BookOpen size={14} className="mt-0.5 text-primary-500 shrink-0" />
                    <div>
                      <div className="font-semibold text-foreground">Sekolah</div>
                      <div className="text-[11px] leading-tight">{user.school.school_name}</div>
                    </div>
                  </div>
                )}
                {(user.district || user.regency) && (
                  <div className="flex items-start gap-2">
                    <MapPin size={14} className="mt-0.5 text-primary-500 shrink-0" />
                    <div>
                      <div className="font-semibold text-foreground">Wilayah</div>
                      <div className="text-[11px] leading-tight">
                        {[user.district?.district_name, user.regency?.regency_name].filter(Boolean).join(', ')}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* Right Column - Form Tabs */}
        <div className="md:col-span-2 space-y-6">
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
            <Card hoverable={false} className="p-6">
              <form onSubmit={handleProfileSave} className="space-y-4">
                <Input
                  label="Nama Lengkap"
                  leftIcon={<User size={18} />}
                  value={profileForm.full_name}
                  onChange={(e) => setProfileForm(p => ({ ...p, full_name: e.target.value }))}
                  required
                />
                
                <Input
                  label="Alamat Email (Terkunci)"
                  leftIcon={<Mail size={18} />}
                  value={user?.email_address || ''}
                  disabled
                  helperText="Alamat email tidak dapat diubah demi alasan keamanan."
                />
                
                <Input
                  label="Nomor Telepon"
                  leftIcon={<Phone size={18} />}
                  value={profileForm.phone_number}
                  onChange={(e) => setProfileForm(p => ({ ...p, phone_number: e.target.value }))}
                  placeholder="Contoh: 08123456789"
                />

                {user?.user_role === 'student_member' && (
                  <Input
                    label="Kelas"
                    value={profileForm.class_name}
                    onChange={(e) => setProfileForm(p => ({ ...p, class_name: e.target.value }))}
                    placeholder="Contoh: XII IPA 1"
                  />
                )}

                <div className="pt-4 border-t border-border flex justify-end">
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
              </form>
            </Card>
          ) : (
            <Card hoverable={false} className="p-6">
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
          )}
        </div>
      </div>
    </div>
  );
}

