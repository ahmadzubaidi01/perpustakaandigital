import React from 'react';
import { cn } from '@/lib/utils';

type GradientVariant = 'pink' | 'blue' | 'green' | 'yellow';

export interface StatsCardProps {
  label: string;
  value: string | number;
  icon: React.ComponentType<any>;
  gradient: GradientVariant;
  className?: string;
}

const gradientStyles: Record<GradientVariant, string> = {
  pink: 'from-pink-500 to-rose-500 text-white border-none',
  blue: 'from-blue-500 to-indigo-600 text-white border-none',
  green: 'from-emerald-500 to-teal-600 text-white border-none',
  yellow: 'from-amber-500 to-orange-600 text-white border-none',
};

export const StatsCard: React.FC<StatsCardProps> = ({
  label,
  value,
  icon: Icon,
  gradient,
  className,
}) => {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl p-4 sm:p-5 lg:p-6',
        'bg-linear-to-br',
        'transition-all duration-350 hover:-translate-y-1 hover:shadow-lg',
        'shadow-md',
        gradientStyles[gradient],
        className
      )}
    >
      {/* Decorative circles */}
      <div className="absolute -bottom-6 -right-6 w-28 h-28 rounded-full bg-white/15 pointer-events-none" />
      <div className="absolute -bottom-2 right-14 w-20 h-20 rounded-full bg-white/10 pointer-events-none" />

      <div className="relative z-10 flex items-center gap-3 sm:gap-4">
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0 backdrop-blur-sm">
          <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider opacity-90 leading-tight break-words">
            {label}
          </p>
          <p className="text-xl sm:text-2xl font-black mt-0.5 leading-none">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
        </div>
      </div>
    </div>
  );
};

StatsCard.displayName = 'StatsCard';
