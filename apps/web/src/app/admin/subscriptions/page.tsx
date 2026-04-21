'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi, type AdminSubscription } from '../../../lib/api';

const STATUS_OPTIONS = [
  { value: '', label: 'Все' },
  { value: 'active', label: 'Активные' },
  { value: 'grace_period', label: 'Grace period' },
  { value: 'expired', label: 'Истекшие' },
  { value: 'cancelled', label: 'Отменённые' },
];

const statusLabels: Record<string, string> = {
  active: 'Активна',
  grace_period: 'Grace',
  expired: 'Истекла',
  cancelled: 'Отменена',
};

const statusColors: Record<string, string> = {
  active: 'bg-green-500/15 text-green-400',
  grace_period: 'bg-yellow-500/15 text-yellow-400',
  expired: 'bg-red-500/15 text-red-400',
  cancelled: 'bg-foreground/5 text-foreground/40',
};

export default function SubscriptionsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'subscriptions', page, statusFilter],
    queryFn: () => adminApi.subscriptions(page, 20, statusFilter || undefined),
  });

  const cancelMut = useMutation({
    mutationFn: adminApi.cancelSubscription,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'subscriptions'] }),
  });

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  return (
    <div>
      <h1 className="font-heading text-2xl font-semibold text-foreground mb-6">Подписки</h1>

      {/* Filter */}
      <div className="flex gap-2 mb-6">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => { setStatusFilter(opt.value); setPage(1); }}
            className={`px-3 py-1.5 text-xs rounded font-body transition-colors ${
              statusFilter === opt.value
                ? 'bg-accent text-background'
                : 'text-foreground/50 hover:text-foreground bg-foreground/5'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-foreground/50 font-body text-sm">Загрузка...</p>
      ) : (
        <>
          <div className="border border-foreground/10 rounded-lg overflow-hidden">
            <table className="w-full text-sm font-body">
              <thead>
                <tr className="bg-foreground/5 border-b border-foreground/10">
                  <th className="text-left px-4 py-3 text-foreground/50 font-medium">Пользователь</th>
                  <th className="text-left px-4 py-3 text-foreground/50 font-medium">Статус</th>
                  <th className="text-left px-4 py-3 text-foreground/50 font-medium">Действует до</th>
                  <th className="text-left px-4 py-3 text-foreground/50 font-medium">Retry</th>
                  <th className="text-right px-4 py-3 text-foreground/50 font-medium">Действия</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((sub: AdminSubscription) => (
                  <tr key={sub.id} className="border-b border-foreground/5 last:border-0">
                    <td className="px-4 py-3 text-foreground">{sub.user.email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs ${statusColors[sub.status] ?? ''}`}>
                        {statusLabels[sub.status] ?? sub.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-foreground/60">{formatDate(sub.currentPeriodEnd)}</td>
                    <td className="px-4 py-3 text-foreground/40">{sub.retryCount}</td>
                    <td className="px-4 py-3 text-right">
                      {(sub.status === 'active' || sub.status === 'grace_period') && (
                        <button
                          onClick={() => {
                            if (confirm(`Отменить подписку для ${sub.user.email}?`)) {
                              cancelMut.mutate(sub.id);
                            }
                          }}
                          disabled={cancelMut.isPending}
                          className="text-red-400 hover:text-red-300 text-xs"
                        >
                          Отменить
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-foreground/40 font-body">
              Всего: {data?.total}
            </p>
            {totalPages > 1 && (
              <div className="flex gap-2">
                {Array.from({ length: totalPages }, (_, i) => (
                  <button
                    key={i + 1}
                    onClick={() => setPage(i + 1)}
                    className={`px-3 py-1 text-sm rounded font-body transition-colors ${
                      page === i + 1
                        ? 'bg-accent text-background'
                        : 'text-foreground/50 hover:text-foreground hover:bg-foreground/5'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
