'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../../lib/auth-store';
import { Button } from '../../../components/button';

export default function RegisterPage() {
  const router = useRouter();
  const register = useAuthStore((s) => s.register);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('Пароли не совпадают');
      return;
    }

    if (password.length < 8) {
      setError('Пароль должен содержать минимум 8 символов');
      return;
    }

    setLoading(true);
    try {
      await register(email, password);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка регистрации');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Decorative side panel — desktop only */}
      <div className="hidden lg:flex lg:w-[45%] relative items-center justify-center bg-warm/40 grain overflow-hidden">
        <div className="relative z-10 max-w-sm px-10 text-center">
          <p className="font-heading text-3xl font-bold leading-snug">
            Начните обучение<br />уже сегодня
          </p>
          <p className="mt-4 text-sm text-muted leading-relaxed">
            Создайте аккаунт и получите доступ к видеоурокам.
          </p>
        </div>
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 60% 60% at 50% 60%, rgba(166,124,82,0.06) 0%, transparent 70%)',
          }}
        />
      </div>

      {/* Form */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <Link href="/" className="font-heading text-lg font-bold text-foreground mb-10 block">
            Psyho<span className="text-accent">Course</span>
          </Link>

          <h1 className="font-heading text-2xl font-bold text-foreground">Создать аккаунт</h1>
          <p className="mt-1.5 text-sm text-muted">Введите данные для регистрации</p>

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

            <Button type="submit" loading={loading} fullWidth size="lg" className="mt-2">
              Зарегистрироваться
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted">
            Уже есть аккаунт?{' '}
            <Link href="/auth/login" className="text-accent hover:underline">
              Войти
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
