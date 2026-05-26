'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';

export default function ReactQueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5,    // Cache valid for 5 minutes
        gcTime: 1000 * 60 * 10,      // Garbage collection after 10 minutes
        refetchOnWindowFocus: false, // Avoid excessive refetching on window focus
        retry: 1,                    // Limit retry attempts
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
