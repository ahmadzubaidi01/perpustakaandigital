import React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'success' | 'danger' | 'warning' | 'info' | 'neutral';
}

const variantStyles: Record<string, string> = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  danger: 'bg-destructive/10 text-destructive',
  warning: 'bg-warning/10 text-warning',
  info: 'bg-info/10 text-info',
  neutral: 'bg-secondary text-muted-foreground',
};

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'neutral', children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full',
          variantStyles[variant],
          className
        )}
        {...props}
      >
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

// Book status helper
export const BookStatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, BadgeProps['variant']> = {
    available: 'success',
    borrowed: 'warning',
    damaged: 'danger',
    lost: 'danger',
    maintenance: 'neutral',
  };
  const label: Record<string, string> = {
    available: 'Tersedia',
    borrowed: 'Dipinjam',
    damaged: 'Rusak',
    lost: 'Hilang',
    maintenance: 'Perawatan',
  };
  return <Badge variant={map[status] || 'neutral'}>{label[status] || status}</Badge>;
};

// Account status helper
export const AccountStatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, 'success' | 'neutral' | 'danger'> = {
    active: 'success',
    inactive: 'neutral',
    suspended: 'danger',
  };
  const label: Record<string, string> = {
    active: 'Aktif',
    inactive: 'Nonaktif',
    suspended: 'Ditangguhkan',
  };
  return <Badge variant={map[status] || 'neutral'}>{label[status] || status}</Badge>;
};
