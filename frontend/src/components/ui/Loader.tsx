import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { motion, HTMLMotionProps } from 'framer-motion';

export interface LoaderProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
  label?: string;
  children?: React.ReactNode;
}

const sizeClasses = {
  sm: 'w-6 h-6',
  md: 'w-10 h-10',
  lg: 'w-16 h-16',
};

const iconSizes = {
  sm: 16,
  md: 24,
  lg: 36,
};

export const Loader: React.FC<LoaderProps> = ({
  className,
  size = 'md',
  fullScreen = false,
  label,
  ...props
}) => {
  const content = (
    <div className="flex flex-col items-center justify-center gap-3">
      <div className="relative flex items-center justify-center">
        {/* Glow effect */}
        <div
          className={cn(
            'absolute inset-0 rounded-full bg-primary/20 blur-md animate-pulse-glow',
            sizeClasses[size]
          )}
        />
        <Loader2
          size={iconSizes[size]}
          className="text-primary animate-spin relative z-10 stroke-[2.5]"
        />
      </div>
      {label && (
        <span className="text-sm font-medium text-muted-foreground animate-pulse">
          {label}
        </span>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={cn(
          'fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md',
          className
        )}
        {...props}
      >
        {content}
      </motion.div>
    );
  }

  return (
    <motion.div
      className={cn('flex items-center justify-center p-4', className)}
      {...props}
    >
      {content}
    </motion.div>
  );
};

Loader.displayName = 'Loader';
