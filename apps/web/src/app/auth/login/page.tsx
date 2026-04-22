'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../../lib/auth-store';
import { Button } from '../../../components/button';

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка авторизации');
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
            Добро пожаловать<br />обратно
          </p>
          <p className="mt-4 text-sm text-muted leading-relaxed">
            Продолжайте обучение с того места, где остановились.
          </p>
        </div>
        {/* Декоративный градиент */}
        <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 60% at 50% 60%, rgba(166,124,82,0.06) 0%, transparent 70%)' }} />
      </div>

      {/* Форма */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <Link href="/" className="font-heading text-lg font-bold text-foreground mb-10 block">
            Psyho<span className="text-accent">Course</span>
          </Link>

          <h1 className="font-heading text-2xl font-bold text-foreground">
            Вход в аккаунт
          </h1>
          <p className="mt-1.5 text-sm text-muted">Введите свои данные для входа</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {error && (
              <div className="bg-red-500/8 border border-red-500/20 text-red-500 dark:text-red-400 rounded-lg px-4 py-3 text-sm">
                {error}
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

            <div>
              <label htmlFor="password" className="block text-[15px] text-foreground/70 mb-1.5">
                Пароль
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-transparent border border-foreground/10 rounded-lg px-4 py-3.5 text-foreground text-[15px] placeholder:text-foreground/25 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all"
                placeholder="••••••••"
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Вход...' : 'Войти'}
            </Button>
          </form>

          <p className="text-center text-sm text-muted mt-8">
            Нет аккаунта?{' '}
            <Link href="/auth/register" className="text-accent hover:text-accent/80 transition-colors font-medium">
              Зарегистрироваться
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
