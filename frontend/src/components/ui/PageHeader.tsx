import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  action,
  breadcrumbs,
  className,
}) => {
  return (
    <div className={cn('space-y-3 pb-1', className)}>
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1.5 text-sm">
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <React.Fragment key={crumb.label}>
                {idx > 0 && <ChevronRight size={14} className="text-[var(--text-placeholder)]" />}
                {crumb.href && !isLast ? (
                  <Link
                    href={crumb.href}
                    className="text-[var(--color-primary-600)] hover:underline font-medium"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-[var(--text-muted)]">{crumb.label}</span>
                )}
              </React.Fragment>
            );
          })}
        </nav>
      )}

      {/* Title row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-0.5">
          <h1 className="text-xl font-semibold tracking-tight text-[var(--heading)]">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-[var(--text-muted)]">{description}</p>
          )}
        </div>

        {action && (
          <div className="flex items-center gap-3 shrink-0">
            {action}
          </div>
        )}
      </div>
    </div>
  );
};

PageHeader.displayName = 'PageHeader';
