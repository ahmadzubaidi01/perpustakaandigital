import React from 'react';
import { cn } from '@/lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'gradient-pink' | 'gradient-blue' | 'gradient-green' | 'gradient-yellow';
  hoverable?: boolean;
}

const gradientStyles: Record<string, string> = {
  'gradient-pink': 'bg-linear-to-br from-pink-500 to-rose-600 text-white border-none shadow-md shadow-pink-500/10',
  'gradient-blue': 'bg-linear-to-br from-indigo-500 to-blue-600 text-white border-none shadow-md shadow-indigo-500/10',
  'gradient-green': 'bg-linear-to-br from-emerald-500 to-teal-600 text-white border-none shadow-md shadow-emerald-500/10',
  'gradient-yellow': 'bg-linear-to-br from-amber-500 to-orange-600 text-white border-none shadow-md shadow-amber-500/10',
};

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', hoverable = true, children, ...props }, ref) => {
    const isGradient = variant !== 'default';

    return (
      <div
        ref={ref}
        className={cn(
          'rounded-2xl transition-all duration-300 border border-border bg-card text-card-foreground p-6',
          isGradient
            ? cn(
                gradientStyles[variant],
                'relative overflow-hidden',
                hoverable && 'hover:-translate-y-0.5 hover:shadow-lg',
              )
            : cn(
                'shadow-sm',
                hoverable && 'hover:border-muted-foreground/30 hover:shadow-md hover:-translate-y-0.5',
              ),
          className
        )}
        {...props}
      >
        {isGradient && (
          <>
            <div className="absolute -bottom-6 -right-6 w-28 h-28 rounded-full bg-white/10 pointer-events-none" />
            <div className="absolute -bottom-2 right-14 w-20 h-20 rounded-full bg-white/5 pointer-events-none" />
          </>
        )}
        {isGradient ? <div className="relative z-10">{children}</div> : children}
      </div>
    );
  }
);

Card.displayName = 'Card';
