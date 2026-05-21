import React from 'react';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  containerClassName?: string;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, error, containerClassName, id, ...props }, ref) => {
    const fallbackId = React.useId();
    const uniqueId = id || fallbackId;

    return (
      <div className={cn('flex flex-col gap-1.5', containerClassName, className)}>
        <label
          htmlFor={uniqueId}
          className={cn(
            'flex items-center gap-3 cursor-pointer select-none group',
            props.disabled && 'cursor-not-allowed opacity-60'
          )}
        >
          <div className="relative flex items-center justify-center">
            <input
              type="checkbox"
              ref={ref}
              id={uniqueId}
              className="peer sr-only"
              {...props}
            />
            <div
              className={cn(
                'w-5 h-5 rounded-md border border-border bg-card transition-all duration-200',
                'flex items-center justify-center',
                'peer-focus-visible:ring-2 peer-focus-visible:ring-primary/20 peer-focus-visible:border-primary',
                'peer-checked:bg-primary peer-checked:border-primary peer-checked:text-primary-foreground',
                'group-hover:border-muted-foreground/30 peer-checked:group-hover:border-primary/90',
                'peer-checked:[&_svg]:scale-100',
                error && 'border-destructive group-hover:border-destructive/90 peer-checked:bg-destructive peer-checked:border-destructive'
              )}
            >
              <Check
                size={14}
                className="scale-0 transition-transform duration-200 stroke-[3] text-primary-foreground"
              />
            </div>
          </div>
          {label && (
            <span className="text-sm font-medium text-foreground select-none">
              {label}
            </span>
          )}
        </label>
        {error && (
          <span className="text-xs text-destructive mt-0.5 pl-8">{error}</span>
        )}
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';
