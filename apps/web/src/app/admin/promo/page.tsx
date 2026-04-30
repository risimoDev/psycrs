'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi, type PromoCode } from '../../../lib/api';

const TYPE_LABELS: Record<string, string> = {
  fixed: 'Фиксированная',
  percent: 'Процент',
  trial: 'Тестовый доступ',
};

function formatPrice(kopecks: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(kopecks / 100);
}

function formatDate(date: string | null): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function PromoCodesPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  // Create form state
  const [newCode, setNewCode] = useState('');
  const [newType, setNewType] = useState<'fixed' | 'percent' | 'trial'>('percent');
  const [newValue, setNewValue] = useState('');
  const [newMaxUses, setNewMaxUses] = useState('');
  const [newExpiresAt, setNewExpiresAt] = useState('');
  const [createError, setCreateError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'promo-codes'],
    queryFn: () => adminApi.promoCodes(1, 100),
  });

  const createMut = useMutation({
    mutationFn: adminApi.createPromoCode,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'promo-codes'] });
      setShowCreate(false);
      setNewCode('');
      setNewType('percent');
      setNewValue('');
      setNewMaxUses('');
      setNewExpiresAt('');
      setCreateError('');
    },
    onError: (err: Error) => {
      setCreateError(err.message || 'Ошибка создания');
    },
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      adminApi.updatePromoCode(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'promo-codes'] });
    },
    onError: (err: Error) => {
      alert(err.message || 'Ошибка обновления');
    },
  });

  const deleteMut = useMutation({
    mutationFn: adminApi.deletePromoCode,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'promo-codes'] });
    },
    onError: (err: Error) => {
      alert(err.message || 'Ошибка удаления');
    },
  });

  function handleCreate() {
    if (!newCode.trim() || !newValue) {
      setCreateError('Заполните все обязательные поля');
      return;
    }

    createMut.mutate({
      code: newCode.trim().toUpperCase(),
      type: newType,
      value: parseInt(newValue, 10),
      maxUses: newMaxUses ? parseInt(newMaxUses, 10) : null,
      expiresAt: newExpiresAt || null,
    });
  }

  const items: PromoCode[] = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold text-foreground">Промокоды</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-4 py-2 bg-accent text-background rounded-lg text-sm font-semibold hover:bg-accent/90 transition-colors"
        >
          {showCreate ? 'Отмена' : '+ Создать промокод'}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-surface border border-foreground/10 rounded-xl p-6 space-y-4">
          {createError && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
              {createError}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Код *</label>
              <input
                type="text"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                placeholder="PROMO2024"
                className="w-full rounded-lg border border-foreground/20 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Тип *</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as 'fixed' | 'percent' | 'trial')}
                className="w-full rounded-lg border border-foreground/20 bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
              >
                <option value="percent">Процент</option>
                <option value="fixed">Фиксированная сумма</option>
                <option value="trial">Тестовый доступ</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                {newType === 'percent' ? 'Процент (1-100)' : newType === 'fixed' ? 'Сумма (копейки)' : 'Дней теста'} *
              </label>
              <input
                type="number"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder={newType === 'percent' ? '20' : newType === 'fixed' ? '50000' : '7'}
                className="w-full rounded-lg border border-foreground/20 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Макс. использований</label>
              <input
                type="number"
                value={newMaxUses}
                onChange={(e) => setNewMaxUses(e.target.value)}
                placeholder="Без ограничений"
                className="w-full rounded-lg border border-foreground/20 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Дата окончания</label>
              <input
                type="datetime-local"
                value={newExpiresAt}
                onChange={(e) => setNewExpiresAt(e.target.value)}
                className="w-full rounded-lg border border-foreground/20 bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
              />
            </div>
          </div>
          <button
            onClick={handleCreate}
            disabled={createMut.isPending}
            className="px-6 py-2 bg-accent text-background rounded-lg text-sm font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50"
          >
            {createMut.isPending ? 'Создание...' : 'Создать'}
          </button>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-surface rounded-xl animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted">Промокоды не созданы</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((promo) => (
            <div
              key={promo.id}
              className={`flex items-center gap-4 rounded-xl border p-4 transition-colors ${
                promo.isActive ? 'border-foreground/10 bg-surface' : 'border-foreground/5 bg-surface/50 opacity-60'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-heading font-bold text-foreground text-lg">{promo.code}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    promo.type === 'trial' ? 'bg-accent/10 text-accent' :
                    promo.type === 'percent' ? 'bg-blue-500/10 text-blue-400' :
                    'bg-green-500/10 text-green-400'
                  }`}>
                    {TYPE_LABELS[promo.type]}
                  </span>
                  {!promo.isActive && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 font-medium">
                      Неактивен
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted mt-1">
                  {promo.type === 'percent' && `Скидка ${promo.value}%`}
                  {promo.type === 'fixed' && `Скидка ${formatPrice(promo.value)}`}
                  {promo.type === 'trial' && `${promo.value} дн. тестового доступа`}
                  {' · '}
                  Использован {promo.usedCount}{promo.maxUses ? ` / ${promo.maxUses}` : ' (∞)'}
                  {promo.expiresAt && ` · До ${formatDate(promo.expiresAt)}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleMut.mutate({ id: promo.id, isActive: !promo.isActive })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    promo.isActive
                      ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                      : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                  }`}
                >
                  {promo.isActive ? 'Отключить' : 'Включить'}
                </button>
                <button
                  onClick={() => {
                    if (confirm('Удалить промокод?')) deleteMut.mutate(promo.id);
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-foreground/5 text-foreground/50 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                >
                  Удалить
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
