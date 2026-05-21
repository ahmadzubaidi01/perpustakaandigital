import React from 'react';

export interface AuthLayoutProps {
  children: React.ReactNode;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  return (
    <div
      className="min-h-screen w-full relative flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-background text-foreground"
    >
      {/* Decorative background orbs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div
          className="absolute -top-32 -left-32 w-80 h-80 rounded-full opacity-20 blur-[100px] animate-pulse bg-primary"
          style={{ animationDuration: '8s' }}
        />
        <div
          className="absolute -bottom-32 -right-32 w-80 h-80 rounded-full opacity-15 blur-[100px] animate-pulse bg-success"
          style={{ animationDuration: '10s' }}
        />
        <div
          className="absolute top-1/3 right-1/4 w-64 h-64 rounded-full opacity-10 blur-[100px] animate-pulse bg-info"
          style={{ animationDuration: '12s' }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full flex items-center justify-center">
        {children}
      </div>
    </div>
  );
};
