'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAuthStore } from '../lib/auth-store';
import { useThemeStore } from '../lib/theme-store';

function ThemeToggle() {
  const { theme, toggle } = useThemeStore();
  return (
    <button
      onClick={toggle}
      className="flex h-9 w-9 items-center justify-center rounded-md text-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground"
      aria-label={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
    >
      {theme === 'dark' ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}

export function Header() {
  const { isAuthenticated, user, logout } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Отслеживаем скролл для изменения стиля хедера
  if (typeof window !== 'undefined') {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useState(() => {
      const handler = () => setScrolled(window.scrollY > 20);
      window.addEventListener('scroll', handler, { passive: true });
      return () => window.removeEventListener('scroll', handler);
    });
  }

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'border-b border-foreground/5 bg-background/90 backdrop-blur-xl shadow-sm shadow-foreground/[0.02]' : 'bg-transparent'}`}>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="font-heading text-xl font-bold tracking-wide text-foreground"
          aria-label="PsyhoCourse"
        >
          Psyho<span className="text-accent">Course</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-2 sm:flex" aria-label="Основная навигация">
          {isAuthenticated ? (
            <>
              <Link
                href="/course"
                className="rounded px-3 py-2 text-sm font-medium text-foreground/70 transition-colors hover:text-foreground hover:bg-foreground/5"
              >
                Курс
              </Link>
              {user?.role === 'admin' && (
                <Link
                  href="/admin/dashboard"
                  className="rounded px-3 py-2 text-sm font-medium text-foreground/70 transition-colors hover:text-foreground hover:bg-foreground/5"
                >
                  Админ
                </Link>
              )}
              <ThemeToggle />
              <span className="ml-1 text-xs text-foreground/40 font-body max-w-[140px] truncate">
                {user?.email}
              </span>
              <button
                onClick={() => logout()}
                className="rounded px-3 py-2 text-sm font-medium text-foreground/50 transition-colors hover:text-foreground hover:bg-foreground/5"
              >
                Выйти
              </button>
            </>
          ) : (
            <>
              <Link
                href="/#program"
                className="rounded px-3 py-2 text-sm font-medium text-foreground/70 transition-colors hover:text-foreground hover:bg-foreground/5"
              >
                Программа
              </Link>
              <Link
                href="/subscribe"
                className="rounded px-3 py-2 text-sm font-medium text-foreground/70 transition-colors hover:text-foreground hover:bg-foreground/5"
              >
                Подписка
              </Link>
              <ThemeToggle />
              <Link
                href="/auth/login"
                className="rounded px-4 py-2 text-sm font-medium text-foreground/70 transition-colors hover:text-foreground"
              >
                Войти
              </Link>
              <Link
                href="/auth/register"
                className="rounded bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/85"
              >
                Начать
              </Link>
            </>
          )}
        </nav>

        {/* Mobile hamburger */}
        <div className="flex items-center gap-2 sm:hidden">
          <ThemeToggle />
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="flex h-9 w-9 items-center justify-center rounded text-foreground/70"
            aria-label="Меню"
          >
            {mobileOpen ? (
              <svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none">
                <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <nav className="border-t border-foreground/5 bg-background px-4 pb-4 pt-2 sm:hidden" aria-label="Мобильная навигация">
          <div className="flex flex-col gap-1">
            {isAuthenticated ? (
              <>
                <Link
                  href="/course"
                  onClick={() => setMobileOpen(false)}
                  className="rounded px-3 py-2.5 text-sm font-medium text-foreground/70 transition-colors hover:bg-foreground/5"
                >
                  Курс
                </Link>
                {user?.role === 'admin' && (
                  <Link
                    href="/admin/dashboard"
                    onClick={() => setMobileOpen(false)}
                    className="rounded px-3 py-2.5 text-sm font-medium text-foreground/70 transition-colors hover:bg-foreground/5"
                  >
                    Админ-панель
                  </Link>
                )}
                <div className="my-1 h-px bg-foreground/5" />
                <span className="px-3 py-1 text-xs text-foreground/40 font-body">{user?.email}</span>
                <button
                  onClick={() => { logout(); setMobileOpen(false); }}
                  className="rounded px-3 py-2.5 text-left text-sm font-medium text-foreground/50 transition-colors hover:bg-foreground/5"
                >
                  Выйти
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/#program"
                  onClick={() => setMobileOpen(false)}
                  className="rounded px-3 py-2.5 text-sm font-medium text-foreground/70 transition-colors hover:bg-foreground/5"
                >
                  Программа
                </Link>
                <Link
                  href="/subscribe"
                  onClick={() => setMobileOpen(false)}
                  className="rounded px-3 py-2.5 text-sm font-medium text-foreground/70 transition-colors hover:bg-foreground/5"
                >
                  Подписка
                </Link>
                <div className="my-1 h-px bg-foreground/5" />
                <Link
                  href="/auth/login"
                  onClick={() => setMobileOpen(false)}
                  className="rounded px-3 py-2.5 text-sm font-medium text-foreground/70 transition-colors hover:bg-foreground/5"
                >
                  Войти
                </Link>
                <Link
                  href="/auth/register"
                  onClick={() => setMobileOpen(false)}
                  className="rounded bg-accent px-3 py-2.5 text-center text-sm font-medium text-white transition-colors hover:bg-accent/85"
                >
                  Начать обучение
                </Link>
              </>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
