'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { useAuthStore } from '../../lib/auth-store';
import { BackButton } from '../../components/back-button';

const NAV_ITEMS = [
  { href: '/admin/dashboard', label: 'Дашборд' },
  { href: '/admin/lessons', label: 'Уроки' },
  { href: '/admin/videos', label: 'Видео' },
  { href: '/admin/articles', label: 'Статьи PDF' },
  { href: '/admin/reviews', label: 'Отзывы' },
  { href: '/admin/tariffs', label: 'Тарифы' },
  { href: '/admin/users', label: 'Пользователи' },
  { href: '/admin/subscriptions', label: 'Подписки' },
  { href: '/admin/settings', label: 'Настройки' },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/auth/login');
    }
  }, [isLoading, isAuthenticated, router]);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-foreground/50 font-body">Загрузка...</p>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-background border-b border-foreground/10 flex items-center px-4">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 text-foreground/60 hover:text-foreground"
          aria-label="Меню"
        >
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            {sidebarOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
        <Link href="/" className="font-heading text-lg font-semibold text-foreground ml-3">
          Psyho<span className="text-accent">Admin</span>
        </Link>
      </div>

      {/* Overlay (mobile) */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 w-60 border-r border-foreground/10 flex flex-col shrink-0 bg-background
        transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `.trim()}>
        <div className="h-14 lg:h-16 flex items-center px-5 border-b border-foreground/10 gap-3">
          <Link href="/" className="font-heading text-lg font-semibold text-foreground">
            Psyho<span className="text-accent">Admin</span>
          </Link>
          <BackButton />
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  block px-3 py-2.5 rounded text-sm font-body transition-colors
                  ${isActive
                    ? 'bg-accent/15 text-accent font-medium'
                    : 'text-foreground/60 hover:text-foreground hover:bg-foreground/5'}
                `.trim()}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-foreground/10">
          <p className="text-xs text-foreground/40 font-body truncate">{user?.email}</p>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-auto pt-14 lg:pt-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 lg:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
