import React from 'react';
import { cn } from '@/lib/utils';

export interface SelectOption {
  label: string;
  value: string | number;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options?: SelectOption[];
  containerClassName?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, helperText, options, children, containerClassName, ...props }, ref) => {
    return (
      <div className={cn('flex flex-col w-full', containerClassName)}>
        {label && (
          <label htmlFor={props.id} className="input-label">
            {label}
          </label>
        )}
        <select
          ref={ref}
          className={cn(
            'input-field pr-9 cursor-pointer appearance-none bg-no-repeat bg-[position:right_10px_center] bg-[length:16px]',
            "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")]",
            error && 'input-error',
            className
          )}
          {...props}
        >
          {options
            ? options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))
            : children}
        </select>
        {error && (
          <span className="input-error-text">{error}</span>
        )}
        {!error && helperText && (
          <span className="text-xs text-muted-foreground mt-1.5">{helperText}</span>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
