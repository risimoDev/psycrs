'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation } from '@tanstack/react-query';
import { tariffApi, paymentApi, promoApi, type PublicTariff, type PromoValidationResult } from '../../lib/api';
import { useAuthStore } from '../../lib/auth-store';
import { Header } from '../../components/header';
import { Footer } from '../../components/footer';
import { Button } from '../../components/button';

const PERIOD_LABELS: Record<string, string> = {
  month: 'в месяц',
  '2month': 'за 2 месяца',
  '3month': 'за 3 месяца',
  year: 'в год',
  lifetime: 'навсегда',
};

function formatPrice(kopecks: number): string {
  const rubles = kopecks / 100;
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(rubles);
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4 text-accent shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function calcDiscountedPrice(tariffPrice: number, promo: PromoValidationResult): number {
  if (promo.type === 'trial') return 100;
  if (promo.type === 'fixed') return Math.max(0, tariffPrice - promo.value);
  if (promo.type === 'percent') return Math.max(0, tariffPrice - Math.round(tariffPrice * promo.value / 100));
  return tariffPrice;
}

function TariffCard({ tariff, promoResult, onSelect, loading }: {
  tariff: PublicTariff;
  promoResult: PromoValidationResult | null;
  onSelect: (id: string) => void;
  loading: boolean;
}) {
  const periodLabel = PERIOD_LABELS[tariff.period] ?? tariff.period;

  const discountedPrice = promoResult ? calcDiscountedPrice(tariff.price, promoResult) : tariff.price;
  const hasDiscount = promoResult && discountedPrice !== tariff.price;
  const discountAmount = tariff.price - discountedPrice;

  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-6 transition-all duration-200 ${
        tariff.isPopular
          ? 'border-accent bg-accent/5 shadow-lg shadow-accent/10'
          : 'border-foreground/10 bg-surface hover:border-foreground/20'
      }`}
    >
      {tariff.isPopular && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <span className="bg-accent text-background text-xs font-semibold px-3 py-1 rounded-full font-body">
            Популярный
          </span>
        </div>
      )}

      <div className="mb-4">
        <h3 className="font-heading text-xl font-bold text-foreground">{tariff.title}</h3>
        {tariff.description && (
          <p className="mt-1 text-sm text-muted font-body">{tariff.description}</p>
        )}
      </div>

      <div className="mb-6">
        <div className="flex items-end gap-2">
          <span className={`font-heading text-3xl font-bold ${hasDiscount ? 'text-accent' : 'text-foreground'}`}>
            {formatPrice(discountedPrice)}
          </span>
          <span className="text-sm text-muted font-body pb-0.5">{periodLabel}</span>
        </div>
        {hasDiscount && (
          <p className="mt-1 text-sm text-foreground/40 line-through font-body">
            {formatPrice(tariff.price)}
          </p>
        )}
        {!hasDiscount && tariff.oldPrice && (
          <p className="mt-1 text-sm text-foreground/40 line-through font-body">
            {formatPrice(tariff.oldPrice)}
          </p>
        )}
        {promoResult?.type === 'trial' && promoResult.trialDays && (
          <p className="mt-2 text-xs text-accent font-body font-medium">
            Тестовый доступ: {promoResult.trialDays} дн. за 1 ₽, далее — {formatPrice(tariff.price)}
          </p>
        )}
        {promoResult?.type === 'fixed' && hasDiscount && (
          <p className="mt-2 text-xs text-accent font-body font-medium">
            Скидка {formatPrice(discountAmount)}
          </p>
        )}
        {promoResult?.type === 'percent' && hasDiscount && (
          <p className="mt-2 text-xs text-accent font-body font-medium">
            Скидка {promoResult.value}%
          </p>
        )}
      </div>

      {tariff.features.length > 0 && (
        <ul className="space-y-2 mb-8 flex-1">
          {tariff.features.map((f, i) => (
            <li key={i} className="flex items-start gap-2 text-sm font-body text-foreground/70">
              <CheckIcon />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      )}

      <Button
        fullWidth
        variant={tariff.isPopular ? 'primary' : 'outline'}
        loading={loading}
        onClick={() => onSelect(tariff.id)}
        className="mt-auto"
      >
        {promoResult?.type === 'trial' ? 'Начать тестовый доступ' : 'Оплатить'}
      </Button>
    </div>
  );
}

export default function SubscribePage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();
  const [payError, setPayError] = useState('');
  const [promoInput, setPromoInput] = useState('');
  const [promoResult, setPromoResult] = useState<PromoValidationResult | null>(null);
  const [promoError, setPromoError] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);

  const { data: tariffs, isLoading: tariffsLoading } = useQuery({
    queryKey: ['tariffs', 'public'],
    queryFn: tariffApi.getAll,
    staleTime: 60_000,
  });

  const payMut = useMutation({
    mutationFn: (tariffId: string) => paymentApi.create(tariffId, promoResult ? promoInput.trim() : undefined),
    onSuccess: (data) => {
      window.location.href = data.confirmationUrl;
    },
    onError: (err: Error) => {
      setPayError(err.message || 'Не удалось создать платёж. Попробуйте ещё раз.');
    },
  });

  async function handleApplyPromo() {
    const code = promoInput.trim();
    if (!code) return;
    setPromoLoading(true);
    setPromoError('');
    setPromoResult(null);
    try {
      // Use first tariff price for validation (all tariffs share same promo logic)
      const price = tariffs?.[0]?.price ?? 0;
      const result = await promoApi.validate(code, price);
      setPromoResult(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Промокод не найден';
      setPromoError(msg);
    } finally {
      setPromoLoading(false);
    }
  }

  function handleClearPromo() {
    setPromoInput('');
    setPromoResult(null);
    setPromoError('');
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    router.replace('/auth/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1 px-4 py-12 sm:py-16">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="accent-line mx-auto mb-4" />
            <h1 className="font-heading text-3xl sm:text-4xl font-bold text-foreground mb-3">
              Выберите тариф
            </h1>
            <p className="text-muted font-body max-w-md mx-auto">
              Получите доступ ко всем урокам курса. Выберите подходящий план и оплатите через ЮКассу.
            </p>
          </div>

          {/* Promo code */}
          <div className="max-w-md mx-auto mb-8">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={promoInput}
                  onChange={(e) => {
                    setPromoInput(e.target.value.toUpperCase());
                    if (promoResult) { setPromoResult(null); setPromoError(''); }
                  }}
                  placeholder="Промокод"
                  className="w-full rounded-lg border border-foreground/20 bg-surface px-4 py-2.5 text-sm font-body text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30"
                />
                {promoResult && (
                  <button
                    onClick={handleClearPromo}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-foreground text-lg leading-none"
                    type="button"
                  >
                    ×
                  </button>
                )}
              </div>
              <Button
                variant={promoResult ? 'primary' : 'outline'}
                onClick={handleApplyPromo}
                loading={promoLoading}
                disabled={!promoInput.trim()}
              >
                {promoResult ? 'Применён' : 'Применить'}
              </Button>
            </div>
            {promoError && (
              <p className="mt-2 text-xs text-red-400 font-body">{promoError}</p>
            )}
            {promoResult && (
              <p className="mt-2 text-xs text-accent font-body font-medium">
                {promoResult.type === 'trial'
                  ? `Тестовый доступ: ${promoResult.trialDays} дней за 1 ₽`
                  : promoResult.type === 'percent'
                  ? `Скидка ${promoResult.value}% применена`
                  : `Скидка ${formatPrice(promoResult.discountAmount)} применена`
                }
              </p>
            )}
          </div>

          {/* Error */}
          {payError && (
            <div className="mb-6 max-w-md mx-auto p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400 font-body text-center">
              {payError}
            </div>
          )}

          {/* Tariff cards */}
          {tariffsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-2xl border border-foreground/10 bg-surface h-72 animate-pulse" />
              ))}
            </div>
          ) : !tariffs || tariffs.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-muted font-body">Тарифы временно недоступны. Попробуйте позже.</p>
            </div>
          ) : (
            <div className={`grid gap-6 ${
              tariffs.length === 1 ? 'max-w-sm mx-auto' :
              tariffs.length === 2 ? 'sm:grid-cols-2 max-w-2xl mx-auto' :
              'sm:grid-cols-2 lg:grid-cols-3'
            }`}>
              {tariffs.map((tariff) => (
                <TariffCard
                  key={tariff.id}
                  tariff={tariff}
                  promoResult={promoResult}
                  onSelect={(id) => payMut.mutate(id)}
                  loading={payMut.isPending}
                />
              ))}
            </div>
          )}

          {/* Trial terms */}
          {promoResult?.type === 'trial' && (
            <div className="max-w-2xl mx-auto mt-8 p-4 bg-accent/5 border border-accent/20 rounded-lg text-sm font-body text-foreground/70">
              <p className="font-semibold text-foreground mb-1">Условия тестового доступа</p>
              <p>При активации тестового доступа с вашей карты списывается 1 ₽. По истечении тестового периода ({promoResult.trialDays} дн.) с сохранённой карты будет автоматически списана полная стоимость подписки. Вы можете отменить подписку до окончания тестового периода в личном кабинете.</p>
            </div>
          )}

          {/* Back link */}
          <p className="text-center mt-10 text-sm text-muted font-body">
            <Link href="/dashboard" className="text-accent hover:underline">
              ← Вернуться в личный кабинет
            </Link>
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
