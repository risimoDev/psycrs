'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { subscriptionApi } from '../../../lib/api';
import { useAuthStore } from '../../../lib/auth-store';
import { Button } from '../../../components/button';
import { Header } from '../../../components/header';
import { Footer } from '../../../components/footer';

export default function PaymentResultPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();
  const [checkCount, setCheckCount] = useState(0);

  const { data: subStatus, refetch } = useQuery({
    queryKey: ['subscription', 'status'],
    queryFn: subscriptionApi.getStatus,
    enabled: isAuthenticated,
    refetchInterval: checkCount < 10 ? 3000 : false, // Poll every 3s for 30s
  });

  useEffect(() => {
    if (subStatus?.status === 'active') return;
    const timer = setInterval(() => {
      setCheckCount((c) => c + 1);
      refetch();
    }, 3000);
    if (checkCount >= 10) clearInterval(timer);
    return () => clearInterval(timer);
  }, [checkCount, subStatus, refetch]);

  const isActive = subStatus?.status === 'active' || subStatus?.status === 'grace_period';
  const isPending = !isActive && checkCount < 10;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted font-body">Загрузка...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md text-center">
          {isActive ? (
            <>
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-accent/15 flex items-center justify-center">
                <svg className="w-8 h-8 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="font-heading text-2xl font-bold text-foreground mb-2">
                Оплата прошла успешно!
              </h1>
              <p className="text-muted font-body mb-6">
                Ваша подписка активирована. Теперь вам доступны все уроки курса.
              </p>
              <Button onClick={() => router.push('/dashboard')}>
                Начать обучение
              </Button>
            </>
          ) : isPending ? (
            <>
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-foreground/5 flex items-center justify-center">
                <svg className="w-8 h-8 text-muted animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
              <h1 className="font-heading text-2xl font-bold text-foreground mb-2">
                Проверяем оплату...
              </h1>
              <p className="text-muted font-body">
                Пожалуйста, подождите. Это может занять несколько секунд.
              </p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/10 flex items-center justify-center">
                <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h1 className="font-heading text-2xl font-bold text-foreground mb-2">
                Оплата не подтверждена
              </h1>
              <p className="text-muted font-body mb-6">
                Мы не получили подтверждение оплаты. Если средства были списаны, свяжитесь с поддержкой.
              </p>
              <div className="flex gap-3 justify-center">
                <Button onClick={() => router.push('/subscribe')}>
                  Попробовать снова
                </Button>
                <Button variant="outline" onClick={() => router.push('/')}>
                  На главную
                </Button>
              </div>
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
