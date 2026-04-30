'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '../../lib/auth-store';
import { useThemeStore } from '../../lib/theme-store';
import { BackButton } from '../../components/back-button';

function ThemeToggle() {
  const { theme, toggle } = useThemeStore();
  return (
    <button
      onClick={toggle}
      className="flex h-9 w-9 items-center justify-center rounded-md text-foreground/50 transition-colors hover:bg-foreground/5 hover:text-foreground"
      aria-label={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
    >
      {theme === 'dark' ? (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      ) : (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, isLoading, user, logout } = useAuthStore();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/auth/login?next=/dashboard');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-30 h-14 border-b border-foreground/5 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="font-heading text-lg font-bold text-foreground">
              Psyho<span className="text-accent">Course</span>
            </Link>
            <BackButton />
          </div>

          <div className="flex items-center gap-1">
            <ThemeToggle />
            {user?.role === 'admin' && (
              <Link
                href="/admin/dashboard"
                className="hidden sm:flex items-center rounded px-3 py-1.5 text-xs font-medium text-foreground/50 transition-colors hover:bg-foreground/5 hover:text-foreground font-body"
              >
                Админка
              </Link>
            )}
            <span className="hidden sm:block text-xs text-foreground/30 font-body mx-2 max-w-[160px] truncate">
              {user?.email}
            </span>
            <button
              onClick={() => { logout(); }}
              className="rounded px-3 py-1.5 text-xs font-medium text-foreground/50 transition-colors hover:bg-foreground/5 hover:text-foreground font-body"
            >
              Выйти
            </button>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
