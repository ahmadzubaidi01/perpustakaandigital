import React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  containerClassName?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', label, error, helperText, containerClassName, leftIcon, rightIcon, ...props }, ref) => {
    return (
      <div className={cn('flex flex-col w-full', containerClassName)}>
        {label && (
          <label htmlFor={props.id} className="input-label">
            {label}
          </label>
        )}
        <div className="relative flex items-center w-full">
          {leftIcon && (
            <div className="absolute left-3.5 text-muted-foreground/60 flex items-center justify-center pointer-events-none">
              {leftIcon}
            </div>
          )}
          <input
            type={type}
            ref={ref}
            className={cn(
              'input-field',
              leftIcon && 'pl-10!',
              rightIcon && 'pr-10!',
              error && 'input-error',
              className
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3.5 text-muted-foreground/60 flex items-center justify-center">
              {rightIcon}
            </div>
          )}
        </div>
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

Input.displayName = 'Input';
