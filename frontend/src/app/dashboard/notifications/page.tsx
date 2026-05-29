'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Check, CheckCheck, Trash, Inbox, AlertTriangle, AlertCircle, Info, Calendar, MessageSquare, ArrowRight } from 'lucide-react';
import { notificationsAPI } from '@/lib/api';
import { useNotificationStore } from '@/lib/store';
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
  admin_message: {
    bg: 'bg-indigo-50 dark:bg-indigo-950/20',
    text: 'text-indigo-600 dark:text-indigo-400',
    border: 'border-l-indigo-500',
    icon: MessageSquare,
  },
  borrowing_event: {
    bg: 'bg-sky-50 dark:bg-sky-950/20',
    text: 'text-sky-600 dark:text-sky-400',
    border: 'border-l-sky-500',
    icon: Info,
  },
  return_event: {
    bg: 'bg-teal-50 dark:bg-teal-950/20',
    text: 'text-teal-600 dark:text-teal-400',
    border: 'border-l-teal-500',
    icon: CheckCheck,
  },
  stock_anomaly: {
    bg: 'bg-orange-50 dark:bg-orange-950/20',
    text: 'text-orange-600 dark:text-orange-400',
    border: 'border-l-orange-500',
    icon: AlertTriangle,
  },
  inventory_mismatch: {
    bg: 'bg-rose-50 dark:bg-rose-950/20',
    text: 'text-rose-600 dark:text-rose-400',
    border: 'border-l-rose-500',
    icon: AlertCircle,
  }
};

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<any[]>([]);
  const { unreadCount, setUnreadCount, decrementUnread } = useNotificationStore();
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
      decrementUnread();
      fetchNotifications();
    } catch {
      toast.error('Gagal menandai notifikasi telah dibaca.');
    }
  };

  const markAllRead = async () => {
    try {
      await notificationsAPI.markAllRead();
      toast.success('Semua notifikasi telah ditandai dibaca');
      setUnreadCount(0);
      fetchNotifications();
    } catch {
      toast.error('Gagal menandai semua notifikasi.');
    }
  };

  // Keep delete function for future API calls, but we will not render the button
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
                onClick={() => {
                  if (!n.is_read) markRead(n.notification_id);
                  if (n.notification_type === 'admin_message') {
                    router.push('/dashboard/chat');
                  }
                }}
                className={`flex items-start gap-4 p-4 border-l-4 transition-all duration-200 group ${
                  n.is_read 
                    ? 'opacity-70 border-l-muted-foreground/30 bg-muted/10 hover:bg-muted/30 hover:opacity-100' 
                    : `${theme.border} bg-card shadow-sm hover:shadow-md cursor-pointer`
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
                      <span className="w-2 h-2 rounded-full bg-primary shrink-0 animate-pulse" />
                    )}
                  </div>
                  <p className={`mt-1.5 leading-relaxed ${n.is_read ? 'text-xs text-muted-foreground' : 'text-sm text-foreground/90 font-medium'}`}>
                    {n.notification_message}
                  </p>
                  <div className="flex items-center justify-between mt-3">
                    <p className="text-[10px] text-muted-foreground/60 font-medium tracking-wide">
                      {new Date(n.created_at).toLocaleString('id-ID', {
                        dateStyle: 'long',
                        timeStyle: 'short',
                      })}
                    </p>
                    {n.notification_type === 'admin_message' && (
                      <div className="flex items-center text-[10px] font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                        Buka Chat <ArrowRight size={12} className="ml-1" />
                      </div>
                    )}
                  </div>
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

