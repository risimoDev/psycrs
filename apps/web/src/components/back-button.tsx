'use client';

import { usePathname, useRouter } from 'next/navigation';

interface BackButtonProps {
  className?: string;
}

export function BackButton({ className = '' }: BackButtonProps) {
  const router = useRouter();
  const pathname = usePathname();

  if (pathname === '/') return null;

  return (
    <button
      onClick={() => router.back()}
      className={[
        'inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground',
        className,
      ].join(' ')}
      aria-label="Назад"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
      Назад
    </button>
  );
}
