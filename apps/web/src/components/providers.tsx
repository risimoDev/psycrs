'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';
import { useThemeStore } from '../lib/theme-store';
import { useAuthStore } from '../lib/auth-store';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      retry: 1,
    },
  },
});

function ThemeInitializer() {
  const init = useThemeStore((s) => s.init);
  useEffect(() => {
    init();
  }, [init]);
  return null;
}

function AuthInitializer() {
  const initAuth = useAuthStore((s) => s.init);
  useEffect(() => {
    initAuth();
  }, [initAuth]);
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeInitializer />
      <AuthInitializer />
      {children}
    </QueryClientProvider>
  );
}
