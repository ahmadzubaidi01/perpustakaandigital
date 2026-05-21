import React from 'react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export interface TabItem {
  key: string;
  label: string;
  icon?: React.ComponentType<any>;
}

export interface TabsProps {
  items: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({ items, activeKey, onChange, className }) => {
  return (
    <div
      className={cn(
        'flex gap-1 overflow-x-auto mb-6 border-b border-border',
        'scrollbar-none',
        className
      )}
      style={{ scrollbarWidth: 'none' }}
    >
      {items.map((item) => {
        const isActive = item.key === activeKey;
        return (
          <button
            key={item.key}
            onClick={() => onChange(item.key)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium',
              'transition-colors duration-200 relative whitespace-nowrap',
              'cursor-pointer bg-transparent border-none shrink-0 outline-none',
              isActive
                ? 'text-primary font-semibold'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {item.icon && <item.icon size={16} />}
            {item.label}
            {isActive && (
              <motion.span
                layoutId="activeTabIndicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-primary"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
};

Tabs.displayName = 'Tabs';
