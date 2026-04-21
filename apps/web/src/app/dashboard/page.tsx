'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { subscriptionApi, contentApi, paymentApi, type ContentItem, type ContentType } from '../../lib/api';
import { Button } from '../../components/button';
import { CheckIcon } from '../../components/icons';

// ─── Types & constants ────────────────────────────────────

type TabId = ContentType;

interface Tab {
  id: TabId;
  label: string;
  icon: string;
}

const TABS: Tab[] = [
  { id: 'lecture', label: 'Видео лекции', icon: '🎓' },
  { id: 'affirmation', label: 'Аффирмации', icon: '✨' },
  { id: 'article_pdf', label: 'Статьи', icon: '📄' },
];

// ─── Helpers ──────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function getDurationLabel(seconds: number | null) {
  if (!seconds) return null;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h} ч ${rem} мин` : `${h} ч`;
}

// ─── Skeleton ─────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="aspect-square rounded-2xl bg-foreground/5 animate-pulse" />
  );
}

// ─── Content card ─────────────────────────────────────────

function ContentCard({ item }: { item: ContentItem }) {
  const isPdf = item.contentType === 'article_pdf';
  const duration = getDurationLabel(item.duration);

  return (
    <Link
      href={`/dashboard/content/${item.id}`}
      className="group relative flex aspect-square flex-col justify-end overflow-hidden rounded-2xl bg-surface border border-foreground/[0.07] p-4 transition-all duration-300 hover:border-accent/30 hover:shadow-lg hover:shadow-foreground/5 hover:-translate-y-0.5"
    >
      {/* Background texture */}
      <div
        className="pointer-events-none absolute inset-0 grain opacity-60"
        style={{
          background: isPdf
            ? 'radial-gradient(ellipse 80% 80% at 20% 80%, rgba(61,107,79,0.07) 0%, transparent 60%)'
            : 'radial-gradient(ellipse 80% 80% at 80% 20%, rgba(166,124,82,0.07) 0%, transparent 60%)',
        }}
      />

      {/* Type icon */}
      <span className="absolute top-4 left-4 text-2xl select-none">
        {isPdf ? '📄' : item.contentType === 'affirmation' ? '✨' : '🎓'}
      </span>

      {/* Viewed badge */}
      {item.isMarkedViewed && (
        <span className="absolute top-4 right-4 flex h-6 w-6 items-center justify-center rounded-full bg-accent/15">
          <CheckIcon size={13} className="text-accent" />
        </span>
      )}

      {/* Info */}
      <div className="relative z-10">
        {duration && (
          <p className="mb-1.5 text-[11px] font-medium tracking-wide text-foreground/40 font-body uppercase">
            {duration}
          </p>
        )}
        <h3 className="text-[15px] font-semibold leading-snug text-foreground font-heading line-clamp-3 group-hover:text-accent transition-colors">
          {item.title}
        </h3>
      </div>
    </Link>
  );
}

// ─── Content grid ─────────────────────────────────────────

function ContentGrid({ type }: { type: TabId }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['content', type],
    queryFn: () => contentApi.list(type),
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="py-16 text-center">
        <p className="text-foreground/40 font-body text-sm">Не удалось загрузить материалы</p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-foreground/30 font-body text-sm">Материалы ещё не добавлены</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
      {data.map((item) => (
        <ContentCard key={item.id} item={item} />
      ))}
    </div>
  );
}

// ─── No-subscription state ────────────────────────────────

function NoSubscription() {
  const payMut = useMutation({
    mutationFn: paymentApi.create,
    onSuccess: (data) => {
      window.location.href = data.confirmationUrl;
    },
  });

  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div
        className="mb-6 flex h-16 w-16 items-center justify-center rounded-full"
        style={{ background: 'rgba(166,124,82,0.08)' }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-accent" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>
      <h2 className="font-heading text-xl font-semibold text-foreground mb-2">
        Ваша подписка неактивна
      </h2>
      <p className="text-sm text-muted font-body max-w-xs mb-8">
        Для доступа к материалам курса оформите подписку
      </p>
      {payMut.isError && (
        <p className="text-sm text-red-400 mb-4">Не удалось создать платёж. Попробуйте ещё раз.</p>
      )}
      <Button size="lg" loading={payMut.isPending} onClick={() => payMut.mutate()}>
        Выбрать тариф
      </Button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<TabId>('lecture');

  const { data: subscription, isLoading } = useQuery({
    queryKey: ['subscription', 'status'],
    queryFn: subscriptionApi.getStatus,
    staleTime: 60_000,
  });

  const hasAccess =
    subscription &&
    (subscription.status === 'active' || subscription.status === 'grace_period');

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-10">

      {/* Page header */}
      <div className="mb-8">
        <div className="accent-line mb-4" />
        <h1 className="font-heading text-2xl sm:text-3xl font-bold text-foreground">
          Личный кабинет
        </h1>

        {/* Subscription status badge */}
        {!isLoading && subscription && (
          <div className="mt-3 inline-flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${
                hasAccess ? 'bg-green-400' : 'bg-foreground/20'
              }`}
            />
            <span className="text-sm font-body text-foreground/60">
              {hasAccess
                ? `Подписка активна до ${formatDate(subscription.currentPeriodEnd!)}`
                : 'Подписка неактивна'}
              {subscription.status === 'grace_period' && (
                <span className="ml-2 text-yellow-500 text-xs">(льготный период)</span>
              )}
            </span>
          </div>
        )}
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
        </div>
      )}

      {/* No subscription */}
      {!isLoading && !hasAccess && <NoSubscription />}

      {/* Content with active subscription */}
      {!isLoading && hasAccess && (
        <>
          {/* Tabs */}
          <div className="flex gap-1 mb-6 p-1 bg-foreground/[0.04] rounded-xl w-fit">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium font-body transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-background text-foreground shadow-sm shadow-foreground/10'
                    : 'text-foreground/50 hover:text-foreground'
                }`}
              >
                <span className="text-base leading-none">{tab.icon}</span>
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Grid */}
          <ContentGrid type={activeTab} />
        </>
      )}
    </div>
  );
}
