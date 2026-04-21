'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi, type AdminTariff } from '../../../lib/api';
import { Button } from '../../../components/button';

interface TariffFormData {
  title: string;
  description: string;
  price: number;
  oldPrice: number | '';
  period: string;
  features: string;
  isActive: boolean;
  isPopular: boolean;
  order: number;
}

function TariffForm({
  initial,
  onSubmit,
  onCancel,
  loading,
  error,
}: {
  initial?: AdminTariff;
  onSubmit: (data: TariffFormData) => void;
  onCancel: () => void;
  loading: boolean;
  error?: string;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [price, setPrice] = useState<number>(initial ? initial.price / 100 : 0);
  const [oldPrice, setOldPrice] = useState<number | ''>(initial?.oldPrice ? initial.oldPrice / 100 : '');
  const [period, setPeriod] = useState(initial?.period ?? 'month');
  const [features, setFeatures] = useState(initial?.features.join('\n') ?? '');
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [isPopular, setIsPopular] = useState(initial?.isPopular ?? false);
  const [order, setOrder] = useState(initial?.order ?? 0);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ title, description, price, oldPrice, period, features, isActive, isPopular, order });
      }}
      className="bg-foreground/5 border border-foreground/10 rounded-lg p-5 space-y-4 mb-6"
    >
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-sm text-red-400 font-body">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-foreground/50 mb-1 font-body">Название *</label>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-transparent border border-foreground/10 rounded px-3 py-2 text-sm text-foreground font-body focus:outline-none focus:border-accent/40"
          />
        </div>
        <div>
          <label className="block text-xs text-foreground/50 mb-1 font-body">Период</label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="w-full bg-background border border-foreground/10 rounded px-3 py-2 text-sm text-foreground font-body focus:outline-none focus:border-accent/40"
          >
            <option value="month">Месяц</option>
            <option value="2month">2 месяца</option>
            <option value="3month">3 месяца</option>
            <option value="year">Год</option>
            <option value="lifetime">Навсегда</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs text-foreground/50 mb-1 font-body">Описание</label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full bg-transparent border border-foreground/10 rounded px-3 py-2 text-sm text-foreground font-body focus:outline-none focus:border-accent/40"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs text-foreground/50 mb-1 font-body">Цена (₽) *</label>
          <input
            required
            type="number"
            min={0}
            step={0.01}
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
            className="w-full bg-transparent border border-foreground/10 rounded px-3 py-2 text-sm text-foreground font-body focus:outline-none focus:border-accent/40"
          />
        </div>
        <div>
          <label className="block text-xs text-foreground/50 mb-1 font-body">Старая цена (₽)</label>
          <input
            type="number"
            min={0}
            step={0.01}
            value={oldPrice}
            onChange={(e) => setOldPrice(e.target.value === '' ? '' : Number(e.target.value))}
            className="w-full bg-transparent border border-foreground/10 rounded px-3 py-2 text-sm text-foreground font-body focus:outline-none focus:border-accent/40"
          />
        </div>
        <div>
          <label className="block text-xs text-foreground/50 mb-1 font-body">Порядок</label>
          <input
            type="number"
            min={0}
            value={order}
            onChange={(e) => setOrder(Number(e.target.value))}
            className="w-full bg-transparent border border-foreground/10 rounded px-3 py-2 text-sm text-foreground font-body focus:outline-none focus:border-accent/40"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-foreground/50 mb-1 font-body">
          Опции (по одной на строку)
        </label>
        <textarea
          rows={4}
          value={features}
          onChange={(e) => setFeatures(e.target.value)}
          placeholder="Доступ ко всем урокам&#10;Поддержка куратора&#10;..."
          className="w-full bg-transparent border border-foreground/10 rounded px-3 py-2 text-sm text-foreground font-body focus:outline-none focus:border-accent/40 resize-none"
        />
      </div>

      <div className="flex gap-6">
        <label className="flex items-center gap-2 text-sm font-body text-foreground/70 cursor-pointer">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="accent-accent"
          />
          Активен
        </label>
        <label className="flex items-center gap-2 text-sm font-body text-foreground/70 cursor-pointer">
          <input
            type="checkbox"
            checked={isPopular}
            onChange={(e) => setIsPopular(e.target.checked)}
            className="accent-accent"
          />
          Популярный
        </label>
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" loading={loading} size="sm">
          {initial ? 'Сохранить' : 'Создать'}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Отмена
        </Button>
      </div>
    </form>
  );
}

function formatPrice(kopecks: number) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(kopecks / 100);
}

export default function TariffsPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'tariffs'],
    queryFn: () => adminApi.tariffs(1, 50),
  });

  const createMut = useMutation({
    mutationFn: (d: TariffFormData) =>
      adminApi.createTariff({
        title: d.title,
        description: d.description || undefined,
        price: Math.round(d.price * 100),
        oldPrice: d.oldPrice !== '' ? Math.round(Number(d.oldPrice) * 100) : undefined,
        period: d.period,
        features: d.features.split('\n').map((s) => s.trim()).filter(Boolean),
        isActive: d.isActive,
        isPopular: d.isPopular,
        order: d.order,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'tariffs'] });
      setShowCreate(false);
      setFormError('');
    },
    onError: (e) => setFormError(e instanceof Error ? e.message : 'Ошибка'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data: d }: { id: string; data: TariffFormData }) =>
      adminApi.updateTariff(id, {
        title: d.title,
        description: d.description || undefined,
        price: Math.round(d.price * 100),
        oldPrice: d.oldPrice !== '' ? Math.round(Number(d.oldPrice) * 100) : null,
        period: d.period,
        features: d.features.split('\n').map((s) => s.trim()).filter(Boolean),
        isActive: d.isActive,
        isPopular: d.isPopular,
        order: d.order,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'tariffs'] });
      setEditingId(null);
      setFormError('');
    },
    onError: (e) => setFormError(e instanceof Error ? e.message : 'Ошибка'),
  });

  const deleteMut = useMutation({
    mutationFn: adminApi.deleteTariff,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'tariffs'] }),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-2xl font-semibold text-foreground">Тарифы</h1>
        <Button
          size="sm"
          onClick={() => { setShowCreate(!showCreate); setEditingId(null); setFormError(''); }}
        >
          {showCreate ? 'Отмена' : '+ Добавить'}
        </Button>
      </div>

      {showCreate && (
        <TariffForm
          onSubmit={(d) => createMut.mutate(d)}
          onCancel={() => { setShowCreate(false); setFormError(''); }}
          loading={createMut.isPending}
          error={formError}
        />
      )}

      {isLoading ? (
        <p className="text-foreground/50 font-body text-sm">Загрузка...</p>
      ) : (
        <div className="space-y-3">
          {data?.items.map((tariff: AdminTariff) => (
            <div key={tariff.id}>
              {editingId === tariff.id ? (
                <TariffForm
                  initial={tariff}
                  onSubmit={(d) => updateMut.mutate({ id: tariff.id, data: d })}
                  onCancel={() => { setEditingId(null); setFormError(''); }}
                  loading={updateMut.isPending}
                  error={formError}
                />
              ) : (
                <div className="border border-foreground/10 rounded-lg p-4 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-heading font-semibold text-foreground">{tariff.title}</span>
                      {tariff.isPopular && (
                        <span className="text-xs bg-accent/15 text-accent px-1.5 py-0.5 rounded">Популярный</span>
                      )}
                      {!tariff.isActive && (
                        <span className="text-xs bg-foreground/10 text-foreground/40 px-1.5 py-0.5 rounded">Неактивен</span>
                      )}
                    </div>
                    <p className="text-sm text-foreground/50 font-body mt-0.5">
                      {formatPrice(tariff.price)}{tariff.period !== 'lifetime' ? ` / ${tariff.period}` : ' навсегда'}
                      {tariff.features.length > 0 && ` · ${tariff.features.length} опций`}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => { setEditingId(tariff.id); setShowCreate(false); setFormError(''); }}>
                      Изменить
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-400 border-red-500/20 hover:border-red-500/40"
                      onClick={() => {
                        if (confirm(`Удалить тариф "${tariff.title}"?`)) deleteMut.mutate(tariff.id);
                      }}
                    >
                      Удалить
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {data?.items.length === 0 && (
            <p className="text-foreground/30 text-sm font-body text-center py-8">
              Тарифы не добавлены
            </p>
          )}
        </div>
      )}
    </div>
  );
}
