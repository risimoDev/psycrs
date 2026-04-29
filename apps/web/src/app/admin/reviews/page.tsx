'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi, type UserReview } from '../../../lib/api';

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400',
    approved: 'bg-green-500/15 text-green-600 dark:text-green-400',
    rejected: 'bg-red-500/15 text-red-500 dark:text-red-400',
  };
  const labels: Record<string, string> = {
    pending: 'На модерации',
    approved: 'Одобрен',
    rejected: 'Отклонён',
  };
  return (
    <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded ${styles[status] ?? styles.pending}`}>
      {labels[status] ?? status}
    </span>
  );
}

export default function ReviewsPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [uploadingPdf, setUploadingPdf] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'reviews'],
    queryFn: () => adminApi.reviews(1, 500),
  });

  const approveMut = useMutation({
    mutationFn: adminApi.approveReview,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'reviews'] }),
  });

  const rejectMut = useMutation({
    mutationFn: adminApi.rejectReview,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'reviews'] }),
  });

  const filtered = (data?.items ?? []).filter((r: UserReview) => {
    if (filter === 'all') return true;
    return r.status === filter;
  });

  const counts = {
    all: data?.items.length ?? 0,
    pending: (data?.items ?? []).filter((r: UserReview) => r.status === 'pending').length,
    approved: (data?.items ?? []).filter((r: UserReview) => r.status === 'approved').length,
    rejected: (data?.items ?? []).filter((r: UserReview) => r.status === 'rejected').length,
  };

  async function handleUploadGiftPdf(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPdf(true);
    try {
      await adminApi.uploadGiftPdf(file);
      alert('PDF подарка загружен');
    } catch {
      alert('Ошибка загрузки PDF');
    } finally {
      setUploadingPdf(false);
      e.target.value = '';
    }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <h1 className="font-heading text-2xl font-semibold text-foreground">Модерация отзывов</h1>
        <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 text-sm font-body bg-accent text-background rounded hover:bg-accent/90 transition-colors">
          {uploadingPdf ? 'Загрузка...' : 'Загрузить PDF подарка'}
          <input type="file" accept=".pdf,application/pdf" className="hidden" onChange={handleUploadGiftPdf} />
        </label>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        {(['all', 'pending', 'approved', 'rejected'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded transition-colors ${
              filter === f ? 'bg-accent text-background' : 'bg-foreground/5 text-foreground/60 hover:text-foreground'
            }`}
          >
            {f === 'all' ? 'Все' : f === 'pending' ? 'На модерации' : f === 'approved' ? 'Одобрены' : 'Отклонённые'} ({counts[f]})
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-foreground/50 font-body text-sm">Загрузка...</p>
      ) : filtered.length === 0 ? (
        <p className="text-foreground/30 font-body text-sm text-center py-12">
          {filter === 'all' ? 'Отзывов пока нет.' : 'Нет отзывов с выбранным статусом.'}
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((review: UserReview) => (
            <div key={review.id} className="border border-foreground/10 rounded-lg p-4 bg-foreground/[0.02]">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm text-foreground">{review.name}</span>
                    <StatusBadge status={review.status} />
                  </div>
                  <p className="text-xs text-foreground/40">{review.user?.email ?? '—'}</p>
                </div>
                <span className="text-[11px] text-foreground/30 shrink-0">
                  {new Date(review.createdAt).toLocaleDateString('ru-RU')}
                </span>
              </div>

              <p className="text-sm text-foreground/70 mb-3">&ldquo;{review.text}&rdquo;</p>

              {review.status === 'pending' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => approveMut.mutate(review.id)}
                    disabled={approveMut.isPending}
                    className="px-3 py-1.5 text-xs bg-green-500/10 text-green-600 dark:text-green-400 rounded hover:bg-green-500/20 transition-colors"
                  >
                    Одобрить
                  </button>
                  <button
                    onClick={() => rejectMut.mutate(review.id)}
                    disabled={rejectMut.isPending}
                    className="px-3 py-1.5 text-xs bg-red-500/10 text-red-500 dark:text-red-400 rounded hover:bg-red-500/20 transition-colors"
                  >
                    Отклонить
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
