import React from 'react';
import { cn } from '@/lib/utils';
import { SlidersHorizontal } from 'lucide-react';

export interface FilterBarProps extends React.FormHTMLAttributes<HTMLFormElement> {
  children: React.ReactNode;
  showIcon?: boolean;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  className,
  showIcon = true,
  children,
  ...props
}) => {
  return (
    <form
      className={cn(
        'flex flex-col lg:flex-row items-stretch lg:items-center gap-3 w-full',
        className
      )}
      {...props}
    >
      {showIcon && (
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground shrink-0 select-none">
          <SlidersHorizontal size={16} />
          <span>Filter:</span>
        </div>
      )}
      <div className="flex flex-col sm:flex-row flex-1 items-stretch sm:items-center gap-3">
        {children}
      </div>
    </form>
  );
};

FilterBar.displayName = 'FilterBar';
