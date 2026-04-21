'use client';

import { useQuery } from '@tanstack/react-query';
import { tariffApi, type PublicTariff } from '../lib/api';
import { Button } from './button';
import { CheckIcon } from './icons';
import Link from 'next/link';

function formatPrice(kopecks: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(kopecks / 100);
}

function periodLabel(period: string): string {
  switch (period) {
    case 'month': return '/ месяц';
    case 'year': return '/ год';
    case 'lifetime': return 'навсегда';
    default: return `/ ${period}`;
  }
}

function TariffCard({ tariff }: { tariff: PublicTariff }) {
  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-8 transition-all duration-200 ${
        tariff.isPopular
          ? 'border-accent/50 bg-accent/5 shadow-lg shadow-accent/10'
          : 'border-foreground/10 bg-foreground/[0.02]'
      }`}
    >
      {tariff.isPopular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-background tracking-wide">
            Популярный
          </span>
        </div>
      )}

      <h3 className="font-heading text-xl font-semibold text-foreground">{tariff.title}</h3>
      {tariff.description && (
        <p className="mt-1 text-sm text-muted">{tariff.description}</p>
      )}

      <div className="mt-6 flex items-end gap-2">
        <span className="font-heading text-4xl font-bold text-foreground">
          {formatPrice(tariff.price)}
        </span>
        <span className="mb-1 text-sm text-muted">{periodLabel(tariff.period)}</span>
      </div>

      {tariff.oldPrice && (
        <p className="mt-1 text-sm text-muted line-through">{formatPrice(tariff.oldPrice)}</p>
      )}

      <ul className="mt-6 flex-1 space-y-3">
        {tariff.features.map((feature, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm text-foreground/80">
            <CheckIcon size={16} className="mt-0.5 shrink-0 text-accent" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <Link href="/auth/register" className="mt-8 block">
        <Button variant={tariff.isPopular ? 'primary' : 'outline'} fullWidth>
          Начать обучение
        </Button>
      </Link>
    </div>
  );
}

export function DynamicPricingSection() {
  const { data: tariffs, isLoading } = useQuery<PublicTariff[]>({
    queryKey: ['tariffs', 'public'],
    queryFn: tariffApi.getAll,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading || !tariffs?.length) {
    // Fallback static card while loading
    return (
      <div className="mx-auto max-w-sm animate-pulse rounded-2xl border border-foreground/10 bg-foreground/5 h-80" />
    );
  }

  return (
    <div
      className={`grid gap-6 ${
        tariffs.length === 1
          ? 'max-w-sm mx-auto'
          : tariffs.length === 2
          ? 'max-w-2xl mx-auto grid-cols-1 sm:grid-cols-2'
          : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
      }`}
    >
      {tariffs.map((tariff) => (
        <TariffCard key={tariff.id} tariff={tariff} />
      ))}
    </div>
  );
}
