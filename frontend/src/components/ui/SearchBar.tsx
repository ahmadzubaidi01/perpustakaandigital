import React from 'react';
import { Search } from 'lucide-react';
import { Input, InputProps } from './Input';
import { cn } from '@/lib/utils';

export type SearchBarProps = Omit<InputProps, 'leftIcon'>;

export const SearchBar = React.forwardRef<HTMLInputElement, SearchBarProps>(
  ({ className, placeholder = 'Cari...', ...props }, ref) => {
    return (
      <div className="relative w-full">
        <Search
          size={18}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 pointer-events-none"
        />
        <Input
          ref={ref}
          placeholder={placeholder}
          className={cn('pl-10!', className)}
          {...props}
        />
      </div>
    );
  }
);

SearchBar.displayName = 'SearchBar';
