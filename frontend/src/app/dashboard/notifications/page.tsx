'use client';

import { useEffect, useState } from 'react';
import { Bell, Check, CheckCheck, Trash, Inbox, AlertTriangle, AlertCircle, Info, Calendar } from 'lucide-react';
import { notificationsAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';

interface NotificationTheme {
  bg: string;
  text: string;
  border: string;
  icon: React.ComponentType<any>;
}

const typeThemes: Record<string, NotificationTheme> = {
  due_reminder: {
    bg: 'bg-amber-50 dark:bg-amber-950/20',
    text: 'text-amber-600 dark:text-amber-400',
    border: 'border-l-amber-500',
    icon: Calendar,
  },
  late_warning: {
    bg: 'bg-red-50 dark:bg-red-950/20',
    text: 'text-red-600 dark:text-red-400',
    border: 'border-l-red-500',
    icon: AlertCircle,
  },
  availability_notice: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/20',
    text: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-l-emerald-500',
    icon: Bell,
  },
  school_announcement: {
    bg: 'bg-blue-50 dark:bg-blue-950/20',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-l-blue-500',
    icon: Info,
  },
  system_alert: {
    bg: 'bg-rose-50 dark:bg-rose-950/20',
    text: 'text-rose-600 dark:text-rose-400',
    border: 'border-l-rose-500',
    icon: AlertTriangle,
  },
  account_verification: {
    bg: 'bg-purple-50 dark:bg-purple-950/20',
    text: 'text-purple-600 dark:text-purple-400',
    border: 'border-l-purple-500',
    icon: Check,
  },
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const params: any = { limit: 50, sort_by: 'created_at', sort_order: 'DESC' };
      if (filter === 'unread') params.is_read = false;
      const res = await notificationsAPI.list(params);
      setNotifications(res.data.data || []);
      setUnreadCount(res.data.metadata?.unread_count || 0);
    } catch (err) {
      toast.error('Gagal mengambil daftar notifikasi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [filter]);

  const markRead = async (id: number) => {
    try {
      await notificationsAPI.markRead(id);
      fetchNotifications();
    } catch {
      toast.error('Gagal menandai notifikasi telah dibaca.');
    }
  };

  const markAllRead = async () => {
    try {
      await notificationsAPI.markAllRead();
      toast.success('Semua notifikasi telah ditandai dibaca');
      fetchNotifications();
    } catch {
      toast.error('Gagal menandai semua notifikasi.');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await notificationsAPI.delete(id);
      toast.success('Notifikasi berhasil dihapus');
      fetchNotifications();
    } catch {
      toast.error('Gagal menghapus notifikasi.');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Notifikasi Saya"
          description={`${unreadCount} pesan belum dibaca.`}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={markAllRead}
          disabled={unreadCount === 0}
          leftIcon={<CheckCheck size={16} />}
          className="self-start sm:self-auto"
        >
          Tandai Semua Dibaca
        </Button>
      </div>

      <div className="flex gap-2 border-b border-border pb-4">
        <Button
          size="sm"
          variant={filter === 'all' ? 'primary' : 'ghost'}
          onClick={() => setFilter('all')}
        >
          Semua Notifikasi
        </Button>
        <Button
          size="sm"
          variant={filter === 'unread' ? 'primary' : 'ghost'}
          onClick={() => setFilter('unread')}
          className="relative"
        >
          Belum Dibaca
          {unreadCount > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-red-500 text-white leading-none">
              {unreadCount}
            </span>
          )}
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} variant="rect" className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : notifications.length ? (
        <div className="space-y-3 stagger-children">
          {notifications.map((n) => {
            const theme = typeThemes[n.notification_type] || typeThemes.school_announcement;
            const Icon = theme.icon;
            
            return (
              <Card
                key={n.notification_id}
                hoverable={!n.is_read}
                className={`flex items-start gap-4 p-4 border-l-4 transition-all duration-200 ${
                  n.is_read 
                    ? 'opacity-60 border-l-muted-foreground/30 bg-muted/20' 
                    : `${theme.border} bg-card shadow-sm hover:shadow-md`
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${theme.bg}`}>
                  <Icon size={18} className={theme.text} />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-foreground leading-snug">
                      {n.notification_title}
                    </p>
                    {!n.is_read && (
                      <span className="w-2 h-2 rounded-full bg-primary-600 shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {n.notification_message}
                  </p>
                  <p className="text-[10px] text-muted-foreground/60 mt-2 font-mono">
                    {new Date(n.created_at).toLocaleString('id-ID', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </p>
                </div>
                
                <div className="flex gap-2 shrink-0 self-center">
                  {!n.is_read && (
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => markRead(n.notification_id)}
                      title="Tandai dibaca"
                      className="h-8 w-8 rounded-lg"
                    >
                      <Check size={14} />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDelete(n.notification_id)}
                    title="Hapus"
                    className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg"
                  >
                    <Trash size={14} />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={Inbox}
          title="Tidak ada notifikasi"
          description={filter === 'unread' ? 'Semua notifikasi Anda sudah dibaca!' : 'Kotak masuk notifikasi Anda saat ini kosong.'}
        />
      )}
    </div>
  );
}

