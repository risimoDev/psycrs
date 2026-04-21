'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../../lib/api';
import { Button } from '../../../components/button';

const SETTING_GROUPS = [
  {
    title: 'Основные',
    fields: [
      { key: 'site_name', label: 'Название сайта', type: 'text' },
      { key: 'site_description', label: 'Описание сайта', type: 'text' },
      { key: 'support_email', label: 'Email поддержки', type: 'email' },
      { key: 'telegram_link', label: 'Ссылка на Telegram', type: 'url' },
    ],
  },
  {
    title: 'Курс',
    fields: [
      { key: 'course_title', label: 'Название курса', type: 'text' },
      { key: 'course_description', label: 'Описание курса', type: 'textarea' },
      { key: 'sequential_view', label: 'Поочерёдный просмотр уроков', type: 'toggle' },
    ],
  },
  {
    title: 'Оплата',
    fields: [
      { key: 'subscription_price', label: 'Стоимость подписки (₽/мес)', type: 'number' },
      { key: 'currency', label: 'Валюта', type: 'text' },
    ],
  },
  {
    title: 'SEO',
    fields: [
      { key: 'meta_title', label: 'Meta Title', type: 'text' },
      { key: 'meta_description', label: 'Meta Description', type: 'textarea' },
    ],
  },
];

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: adminApi.getSettings,
  });

  useEffect(() => {
    if (data) setFormData(data);
  }, [data]);

  const updateMut = useMutation({
    mutationFn: adminApi.updateSettings,
    onSuccess: (result) => {
      queryClient.setQueryData(['admin', 'settings'], result);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  function handleChange(key: string, value: string) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    updateMut.mutate(formData);
  }

  if (isLoading) {
    return <p className="text-muted font-body text-sm">Загрузка настроек...</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-2xl font-semibold text-foreground">Настройки</h1>
        <div className="flex items-center gap-3">
          {saved && (
            <span className="text-sm text-accent font-body flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Сохранено
            </span>
          )}
          {updateMut.isError && (
            <span className="text-sm text-red-400 font-body">
              Ошибка: {updateMut.error instanceof Error ? updateMut.error.message : 'Не удалось сохранить'}
            </span>
          )}
          <Button size="sm" onClick={handleSave} disabled={updateMut.isPending}>
            {updateMut.isPending ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </div>
      </div>

      <div className="space-y-8">
        {SETTING_GROUPS.map((group) => (
          <div key={group.title} className="bg-surface border border-foreground/10 rounded-lg p-6">
            <h2 className="font-heading text-lg font-semibold text-foreground mb-4">{group.title}</h2>
            <div className="space-y-4">
              {group.fields.map((field) => (
                <div key={field.key}>
                  <label className="block text-xs font-body text-muted mb-1.5">{field.label}</label>
                  {field.type === 'toggle' ? (
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData[field.key] === 'true'}
                        onChange={(e) => handleChange(field.key, e.target.checked ? 'true' : 'false')}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-foreground/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent" />
                      <span className="ms-3 text-sm font-body text-foreground/60">
                        {formData[field.key] === 'true' ? 'Включено' : 'Выключено'}
                      </span>
                    </label>
                  ) : field.type === 'textarea' ? (
                    <textarea
                      value={formData[field.key] ?? ''}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                      rows={3}
                      className="w-full bg-background border border-foreground/10 rounded px-3 py-2 text-sm text-foreground font-body focus:outline-none focus:border-accent/50 resize-none"
                    />
                  ) : (
                    <input
                      type={field.type}
                      value={formData[field.key] ?? ''}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                      className="w-full bg-background border border-foreground/10 rounded px-3 py-2 text-sm text-foreground font-body focus:outline-none focus:border-accent/50"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
