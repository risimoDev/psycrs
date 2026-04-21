'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('Unhandled error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-xs">
        <div className="h-10 w-10 rounded-full bg-red-500/8 flex items-center justify-center mb-5">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-red-500/70"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
        </div>
        <h1 className="text-xl font-heading font-bold text-foreground">
          Что-то пошло не так
        </h1>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          Произошла непредвиденная ошибка. Попробуйте обновить страницу.
        </p>
        <button
          onClick={reset}
          className="mt-6 inline-flex items-center gap-2 bg-accent text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-accent/90 transition-colors shadow-sm shadow-accent/20"
        >
          Попробовать снова
        </button>
      </div>
    </div>
  );
}
