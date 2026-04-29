'use client';

import { useState, type FormEvent, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { authApi } from '../../../lib/api';
import { Button } from '../../../components/button';
import { BackButton } from '../../../components/back-button';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password !== confirm) {
      setError('Пароли не совпадают');
      return;
    }

    if (password.length < 8) {
      setError('Пароль должен содержать минимум 8 символов');
      return;
    }

    if (!token) {
      setError('Недействительная или отсутствующая ссылка восстановления');
      return;
    }

    setLoading(true);

    try {
      const res = await authApi.resetPassword(token, password);
      setSuccess(res.message);
      setTimeout(() => {
        router.push('/auth/login');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка запроса');
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="w-full max-w-sm">
        <div className="bg-red-500/8 border border-red-500/20 text-red-500 dark:text-red-400 rounded-lg px-4 py-3 text-sm mb-6">
          Недействительная ссылка восстановления пароля.
        </div>
        <Link href="/auth/forgot-password" className="text-accent hover:text-accent/80 transition-colors font-medium text-sm">
          Запросить новую ссылку
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="font-heading text-2xl font-bold text-foreground">
        Новый пароль
      </h1>
      <p className="mt-1.5 text-sm text-muted">Придумайте новый пароль для входа в аккаунт</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        {error && (
          <div className="bg-red-500/8 border border-red-500/20 text-red-500 dark:text-red-400 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-500/8 border border-green-500/20 text-green-600 dark:text-green-400 rounded-lg px-4 py-3 text-sm">
            {success} Перенаправляем на страницу входа...
          </div>
        )}

        <div>
          <label htmlFor="password" className="block text-[15px] text-foreground/70 mb-1.5">
            Новый пароль
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-transparent border border-foreground/10 rounded-lg px-4 py-3.5 text-foreground text-[15px] placeholder:text-foreground/25 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all"
            placeholder="Минимум 8 символов"
          />
        </div>

        <div>
          <label htmlFor="confirm" className="block text-[15px] text-foreground/70 mb-1.5">
            Подтвердите пароль
          </label>
          <input
            id="confirm"
            type="password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full bg-transparent border border-foreground/10 rounded-lg px-4 py-3.5 text-foreground text-[15px] placeholder:text-foreground/25 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all"
            placeholder="Повторите пароль"
          />
        </div>

        <Button type="submit" className="w-full" disabled={loading || !!success}>
          {loading ? 'Сохранение...' : 'Сохранить пароль'}
        </Button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex bg-background">
      {/* Декоративная боковая панель — только десктоп */}
      <div className="hidden lg:flex lg:w-[45%] relative items-center justify-center bg-warm/40 grain overflow-hidden">
        <div className="relative z-10 max-w-sm px-10 text-center">
          <p className="font-heading text-3xl font-bold leading-snug">
            Создайте<br />новый пароль
          </p>
          <p className="mt-4 text-sm text-muted leading-relaxed">
            Введите новый пароль и подтвердите его, чтобы восстановить доступ к аккаунту.
          </p>
        </div>
        <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 60% at 50% 60%, rgba(166,124,82,0.06) 0%, transparent 70%)' }} />
      </div>

      {/* Форма */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <Link href="/" className="font-heading text-lg font-bold text-foreground mb-4 block">
            Psyho<span className="text-accent">Course</span>
          </Link>
          <BackButton className="mb-6 -ml-2" />

          <Suspense fallback={
            <div className="w-full max-w-sm">
              <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
            </div>
          }>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
