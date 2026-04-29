'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { authApi } from '../../../lib/api';
import { Button } from '../../../components/button';
import { BackButton } from '../../../components/back-button';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const res = await authApi.forgotPassword(email);
      setSuccess(res.message);
      setEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка запроса');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Декоративная боковая панель — только десктоп */}
      <div className="hidden lg:flex lg:w-[45%] relative items-center justify-center bg-warm/40 grain overflow-hidden">
        <div className="relative z-10 max-w-sm px-10 text-center">
          <p className="font-heading text-3xl font-bold leading-snug">
            Восстановление<br />пароля
          </p>
          <p className="mt-4 text-sm text-muted leading-relaxed">
            Введите email, указанный при регистрации, и мы отправим вам ссылку для сброса пароля.
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

          <h1 className="font-heading text-2xl font-bold text-foreground">
            Забыли пароль?
          </h1>
          <p className="mt-1.5 text-sm text-muted">Введите email для восстановления доступа</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {error && (
              <div className="bg-red-500/8 border border-red-500/20 text-red-500 dark:text-red-400 rounded-lg px-4 py-3 text-sm">
                {error}
              </div>
            )}

            {success && (
              <div className="bg-green-500/8 border border-green-500/20 text-green-600 dark:text-green-400 rounded-lg px-4 py-3 text-sm">
                {success}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-[15px] text-foreground/70 mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-transparent border border-foreground/10 rounded-lg px-4 py-3.5 text-foreground text-[15px] placeholder:text-foreground/25 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all"
                placeholder="your@email.com"
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Отправка...' : 'Отправить ссылку'}
            </Button>
          </form>

          <p className="text-center text-sm text-muted mt-8">
            Вспомнили пароль?{' '}
            <Link href="/auth/login" className="text-accent hover:text-accent/80 transition-colors font-medium">
              Войти
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
