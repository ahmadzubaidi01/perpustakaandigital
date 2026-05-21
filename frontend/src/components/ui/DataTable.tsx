import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { TableSkeleton } from './Skeleton';
import { EmptyState } from './EmptyState';
import { Inbox, ChevronUp, ChevronDown, ArrowUpDown } from 'lucide-react';

export interface DataTableColumn {
  key: string;
  label: string;
  render?: (value: any, row: any, index: number) => React.ReactNode;
  headerClassName?: string;
  cellClassName?: string;
  sortable?: boolean;
}

export interface DataTableProps {
  columns: DataTableColumn[];
  data: any[];
  loading?: boolean;
  emptyIcon?: React.ComponentType<any>;
  emptyTitle?: string;
  emptyDescription?: string;
  rowKey?: string;
  skeletonRows?: number;
  onRowClick?: (row: any) => void;
  stickyHeader?: boolean;
  onSort?: (key: string, order: 'ASC' | 'DESC') => void;
}

export const DataTable: React.FC<DataTableProps> = ({
  columns,
  data,
  loading = false,
  emptyIcon = Inbox,
  emptyTitle = 'Tidak ada data',
  emptyDescription,
  rowKey = 'id',
  skeletonRows = 5,
  onRowClick,
  stickyHeader = false,
  onSort,
}) => {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('ASC');

  const handleSort = (key: string) => {
    if (!onSort) return;
    let nextOrder: 'ASC' | 'DESC' = 'ASC';
    if (sortKey === key && sortOrder === 'ASC') {
      nextOrder = 'DESC';
    }
    setSortKey(key);
    setSortOrder(nextOrder);
    onSort(key, nextOrder);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {/* Desktop skeleton */}
        <div className="hidden md:block">
          <TableSkeleton rows={skeletonRows} />
        </div>
        {/* Mobile card skeleton */}
        <div className="block md:hidden space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="p-5 rounded-2xl border border-border bg-card space-y-3 animate-pulse">
              <div className="h-5 bg-secondary rounded-lg w-2/3" />
              <div className="h-px bg-border my-2" />
              <div className="flex justify-between"><div className="h-4 bg-secondary rounded w-1/4" /><div className="h-4 bg-secondary rounded w-1/3" /></div>
              <div className="flex justify-between"><div className="h-4 bg-secondary rounded w-1/4" /><div className="h-4 bg-secondary rounded w-1/2" /></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data || !data.length) {
    return (
      <EmptyState
        icon={emptyIcon}
        title={emptyTitle}
        description={emptyDescription}
      />
    );
  }

  return (
    <div className="w-full">
      {/* ── Desktop Tabular Layout (>= 768px) ── */}
      <div className={cn(
        "hidden md:block overflow-x-auto rounded-2xl border border-border bg-card shadow-sm",
        stickyHeader && "max-h-[600px] overflow-y-auto"
      )}>
        <table className="w-full border-collapse text-left table-auto">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              {columns.map((col) => {
                const isSortActive = sortKey === col.key;
                return (
                  <th
                    key={col.key}
                    onClick={() => col.sortable && handleSort(col.key)}
                    className={cn(
                      'px-5 py-4 text-xs font-bold uppercase tracking-wider select-none transition-colors duration-200',
                      'text-muted-foreground',
                      stickyHeader && 'sticky top-0 z-10 shadow-xs',
                      col.sortable && 'cursor-pointer hover:bg-secondary hover:text-foreground',
                      col.headerClassName
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span>{col.label}</span>
                      {col.sortable && onSort && (
                        <span className="shrink-0 text-muted-foreground">
                          {!isSortActive ? (
                            <ArrowUpDown size={13} className="opacity-60" />
                          ) : sortOrder === 'ASC' ? (
                            <ChevronUp size={13} className="text-primary" />
                          ) : (
                            <ChevronDown size={13} className="text-primary" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.map((row, idx) => (
              <tr
                key={row[rowKey] ?? idx}
                onClick={() => onRowClick?.(row)}
                className={cn(
                  'transition-all duration-200 bg-card hover:bg-secondary/40',
                  onRowClick && 'cursor-pointer active:bg-secondary'
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      'px-5 py-4 text-sm text-foreground align-middle font-medium truncate max-w-[240px]',
                      col.cellClassName
                    )}
                  >
                    {col.render ? col.render(row[col.key], row, idx) : (row[col.key] ?? '-')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Mobile Grid Card Fallback (< 768px) ── */}
      <div className="block md:hidden space-y-4">
        {data.map((row, idx) => (
          <div
            key={row[rowKey] ?? idx}
            onClick={() => onRowClick?.(row)}
            className={cn(
              'p-5 rounded-2xl bg-card border border-border shadow-xs hover:shadow-md transition-all duration-300 space-y-4',
              onRowClick && 'cursor-pointer active:scale-[0.99] active:bg-secondary/50'
            )}
          >
            <div className="space-y-3">
              {columns.map((col, cIdx) => {
                const renderedVal = col.render ? col.render(row[col.key], row, idx) : (row[col.key] ?? '-');
                const isPrimary = cIdx === 0;

                if (isPrimary) {
                  return (
                    <div key={col.key} className="border-b border-border pb-3 mb-1">
                      <span className="text-[10px] font-bold text-primary uppercase tracking-wider block mb-1">
                        {col.label}
                      </span>
                      <div className="text-base font-bold text-foreground leading-snug break-words">
                        {renderedVal}
                      </div>
                    </div>
                  );
                }

                // If it is the last item and matches an action set, render it full width at the bottom
                const isActions = col.key.toLowerCase().includes('action') || col.label.toLowerCase().includes('aksi');
                if (isActions) {
                  return (
                    <div key={col.key} className="pt-2 border-t border-border mt-3 flex justify-end gap-2">
                      {renderedVal}
                    </div>
                  );
                }

                return (
                  <div key={col.key} className="flex justify-between items-start gap-4 text-xs">
                    <span className="font-bold text-muted-foreground tracking-wide uppercase shrink-0">
                      {col.label}
                    </span>
                    <div className="font-medium text-foreground text-right break-all">
                      {renderedVal}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

DataTable.displayName = 'DataTable';
