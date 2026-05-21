import React from 'react';
import { cn } from '@/lib/utils';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'rect' | 'circle';
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className,
  variant = 'rect',
  ...props
}) => {
  const variantStyles: Record<string, string> = {
    text: 'h-4 w-3/4 rounded',
    rect: 'h-16 rounded-2xl',
    circle: 'w-10 h-10 rounded-full',
  };

  return (
    <div
      className={cn(
        'animate-shimmer bg-muted',
        variantStyles[variant],
        className
      )}
      {...props}
    />
  );
};

export const TableSkeleton = ({ rows = 5 }: { rows?: number }) => {
  return (
    <div className="space-y-2.5 w-full">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} variant="rect" className="w-full h-12 rounded-xl" />
      ))}
    </div>
  );
};

export const GridSkeleton = ({ cards = 8, itemClassName = 'h-64' }: { cards?: number; itemClassName?: string }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 w-full">
      {Array.from({ length: cards }).map((_, i) => (
        <Skeleton key={i} variant="rect" className={itemClassName} />
      ))}
    </div>
  );
};
