import React from 'react';
import { cn } from '@/lib/utils';
import { Info, CheckCircle2, AlertTriangle, AlertCircle, X } from 'lucide-react';
import { motion, AnimatePresence, HTMLMotionProps } from 'framer-motion';

export interface AlertProps extends Omit<HTMLMotionProps<'div'>, 'title' | 'children'> {
  variant?: 'info' | 'success' | 'warning' | 'danger';
  title?: string;
  onClose?: () => void;
  isOpen?: boolean;
  children?: React.ReactNode;
}

const variantStyles = {
  info: 'bg-info/10 border-info/30 text-info [&_svg]:text-info',
  success: 'bg-success/10 border-success/30 text-success [&_svg]:text-success',
  warning: 'bg-warning/10 border-warning/30 text-warning [&_svg]:text-warning',
  danger: 'bg-destructive/10 border-destructive/30 text-destructive [&_svg]:text-destructive',
};

const icons = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: AlertCircle,
};

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = 'info', title, onClose, isOpen = true, children, ...props }, ref) => {
    const Icon = icons[variant];

    return (
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={ref}
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              'flex gap-3.5 p-4 rounded-xl border text-sm relative overflow-hidden',
              variantStyles[variant],
              className
            )}
            {...props}
          >
            <Icon size={18} className="shrink-0 mt-0.5" />
            <div className="flex-1">
              {title && <h5 className="font-semibold mb-1 leading-none text-current">{title}</h5>}
              <div className={cn('text-current/90 leading-normal', title && 'text-xs')}>{children}</div>
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 text-current/60 hover:text-current hover:bg-current/10 p-1 rounded-md transition-colors h-fit cursor-pointer"
                aria-label="Tutup"
              >
                <X size={16} />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    );
  }
);

Alert.displayName = 'Alert';
