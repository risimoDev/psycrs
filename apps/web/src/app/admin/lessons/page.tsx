'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi, type AdminLesson, type AdminVideo } from '../../../lib/api';
import { Button } from '../../../components/button';

function LessonForm({
  initial,
  onSubmit,
  onCancel,
  loading,
  error,
}: {
  initial?: AdminLesson;
  onSubmit: (data: {
    title: string;
    slug: string;
    description?: string;
    videoId: string;
    order: number;
    module: number;
    duration?: number;
    isPublished: boolean;
  }) => void;
  onCancel: () => void;
  loading: boolean;
  error?: string;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [videoId, setVideoId] = useState(initial?.videoId ?? '');
  const [order, setOrder] = useState(initial?.order ?? 0);
  const [module, setModule] = useState(initial?.module ?? 1);
  const [duration, setDuration] = useState<number | ''>(initial?.duration ?? '');
  const [isPublished, setIsPublished] = useState(initial?.isPublished ?? false);

  const { data: videosData } = useQuery({
    queryKey: ['admin', 'videos', 'ready'],
    queryFn: () => adminApi.videos(1, 100, 'ready'),
  });

  function autoSlug(val: string) {
    return val
      .toLowerCase()
      .replace(/[а-яё]/g, (c) => {
        const map: Record<string, string> = {
          'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'zh','з':'z','и':'i',
          'й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t',
          'у':'u','ф':'f','х':'h','ц':'ts','ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'',
          'э':'e','ю':'yu','я':'ya',
        };
        return map[c] ?? c;
      })
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          title,
          slug,
          description: description || undefined,
          videoId,
          order,
          module,
          duration: duration !== '' ? Number(duration) : undefined,
          isPublished,
        });
      }}
      className="space-y-4 bg-surface border border-foreground/10 rounded-lg p-5"
    >
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-sm text-red-400 font-body">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-xs font-body text-muted mb-1">Название урока *</label>
          <input
            required
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (!initial) setSlug(autoSlug(e.target.value));
            }}
            placeholder="Например: Введение в когнитивную психологию"
            className="w-full bg-background border border-foreground/10 rounded px-3 py-2 text-sm text-foreground font-body focus:outline-none focus:border-accent/50"
          />
        </div>

        <div>
          <label className="block text-xs font-body text-muted mb-1">Slug *</label>
          <input
            required
            pattern="[a-z0-9-]+"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="vvedenie-v-kognitivnuyu-psihologiyu"
            className="w-full bg-background border border-foreground/10 rounded px-3 py-2 text-foreground focus:outline-none focus:border-accent/50 font-mono text-xs"
          />
          <p className="text-[10px] text-muted mt-0.5">Только латиница, цифры и дефисы</p>
        </div>

        <div>
          <label className="block text-xs font-body text-muted mb-1">Видео *</label>
          <div className="flex gap-2">
            <select
              value={videoId}
              onChange={(e) => setVideoId(e.target.value)}
              className="flex-1 bg-background border border-foreground/10 rounded px-3 py-2 text-sm text-foreground font-body focus:outline-none focus:border-accent/50"
            >
              <option value="">— Выберите видео —</option>
              {videosData?.items.map((v: AdminVideo) => (
                <option key={v.id} value={v.id}>
                  {v.originalName} ({v.id.slice(0, 8)}...)
                </option>
              ))}
            </select>
            <input
              value={videoId}
              onChange={(e) => setVideoId(e.target.value)}
              placeholder="или ID"
              className="w-32 bg-background border border-foreground/10 rounded px-3 py-2 text-xs text-foreground font-mono focus:outline-none focus:border-accent/50"
            />
          </div>
        </div>

        <div className="col-span-2">
          <label className="block text-xs font-body text-muted mb-1">Описание</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Краткое описание урока..."
            className="w-full bg-background border border-foreground/10 rounded px-3 py-2 text-sm text-foreground font-body focus:outline-none focus:border-accent/50 resize-none"
          />
        </div>

        <div>
          <label className="block text-xs font-body text-muted mb-1">Модуль</label>
          <input
            type="number"
            min={1}
            value={module}
            onChange={(e) => setModule(Number(e.target.value))}
            className="w-full bg-background border border-foreground/10 rounded px-3 py-2 text-sm text-foreground font-body focus:outline-none focus:border-accent/50"
          />
        </div>

        <div>
          <label className="block text-xs font-body text-muted mb-1">Порядок в модуле</label>
          <input
            type="number"
            min={0}
            value={order}
            onChange={(e) => setOrder(Number(e.target.value))}
            className="w-full bg-background border border-foreground/10 rounded px-3 py-2 text-sm text-foreground font-body focus:outline-none focus:border-accent/50"
          />
        </div>

        <div>
          <label className="block text-xs font-body text-muted mb-1">Длительность (сек)</label>
          <input
            type="number"
            min={0}
            value={duration}
            onChange={(e) => setDuration(e.target.value === '' ? '' : Number(e.target.value))}
            placeholder="1200"
            className="w-full bg-background border border-foreground/10 rounded px-3 py-2 text-sm text-foreground font-body focus:outline-none focus:border-accent/50"
          />
        </div>

        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isPublished}
              onChange={(e) => setIsPublished(e.target.checked)}
              className="w-4 h-4 rounded border-foreground/20 text-accent focus:ring-accent/50"
            />
            <span className="text-sm font-body text-foreground">Опубликован</span>
          </label>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" size="sm" disabled={loading || !videoId}>
          {loading ? 'Сохранение...' : initial ? 'Обновить урок' : 'Создать урок'}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Отмена
        </Button>
      </div>
    </form>
  );
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function LessonsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [mutError, setMutError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'lessons', page],
    queryFn: () => adminApi.lessons(page, 50),
  });

  const createMut = useMutation({
    mutationFn: adminApi.createLesson,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'lessons'] });
      setShowCreate(false);
      setMutError('');
    },
    onError: (err: Error) => setMutError(err.message || 'Не удалось создать урок'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...rest }: { id: string } & Parameters<typeof adminApi.updateLesson>[1]) =>
      adminApi.updateLesson(id, rest),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'lessons'] });
      setEditingId(null);
      setMutError('');
    },
    onError: (err: Error) => setMutError(err.message || 'Не удалось обновить урок'),
  });

  const deleteMut = useMutation({
    mutationFn: adminApi.deleteLesson,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'lessons'] }),
    onError: (err: Error) => setMutError(err.message || 'Не удалось удалить урок'),
  });

  const togglePublish = useMutation({
    mutationFn: ({ id, isPublished }: { id: string; isPublished: boolean }) =>
      adminApi.updateLesson(id, { isPublished }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'lessons'] }),
  });

  const groupedLessons = data?.items.reduce(
    (acc, lesson) => {
      const mod = lesson.module ?? 1;
      if (!acc[mod]) acc[mod] = [];
      acc[mod].push(lesson);
      return acc;
    },
    {} as Record<number, AdminLesson[]>,
  ) ?? {};

  const sortedModules = Object.keys(groupedLessons).map(Number).sort((a, b) => a - b);
  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-foreground">Уроки</h1>
          {data && (
            <p className="text-sm text-muted font-body mt-1">
              Всего: {data.total} уроков в {sortedModules.length} модулях
            </p>
          )}
        </div>
        <Button size="sm" onClick={() => { setShowCreate(true); setEditingId(null); setMutError(''); }}>
          + Новый урок
        </Button>
      </div>

      {showCreate && (
        <div className="mb-6">
          <LessonForm
            onSubmit={(d) => createMut.mutate(d)}
            onCancel={() => { setShowCreate(false); setMutError(''); }}
            loading={createMut.isPending}
            error={mutError}
          />
        </div>
      )}

      {isLoading ? (
        <p className="text-muted font-body text-sm">Загрузка...</p>
      ) : (
        <>
          {sortedModules.map((mod) => (
            <div key={mod} className="mb-6">
              <h2 className="font-heading text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                <span className="w-7 h-7 rounded bg-accent/15 text-accent text-xs font-bold flex items-center justify-center">
                  {mod}
                </span>
                Модуль {mod}
                <span className="text-xs text-muted font-normal font-body ml-1">
                  ({groupedLessons[mod]?.length ?? 0} уроков)
                </span>
              </h2>

              <div className="border border-foreground/10 rounded-lg overflow-hidden">
                <table className="w-full text-sm font-body">
                  <thead>
                    <tr className="bg-foreground/5 border-b border-foreground/10">
                      <th className="text-left px-4 py-2.5 text-muted font-medium w-12">#</th>
                      <th className="text-left px-4 py-2.5 text-muted font-medium">Название</th>
                      <th className="text-left px-4 py-2.5 text-muted font-medium w-24">Длит.</th>
                      <th className="text-left px-4 py-2.5 text-muted font-medium w-24">Статус</th>
                      <th className="text-right px-4 py-2.5 text-muted font-medium w-40">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(groupedLessons[mod] ?? [])
                      .sort((a, b) => a.order - b.order)
                      .map((lesson) => (
                        <tr key={lesson.id} className="border-b border-foreground/5 last:border-0">
                          {editingId === lesson.id ? (
                            <td colSpan={5} className="p-4">
                              <LessonForm
                                initial={lesson}
                                onSubmit={(d) => updateMut.mutate({ id: lesson.id, ...d })}
                                onCancel={() => { setEditingId(null); setMutError(''); }}
                                loading={updateMut.isPending}
                                error={mutError}
                              />
                            </td>
                          ) : (
                            <>
                              <td className="px-4 py-3 text-foreground/40">{lesson.order}</td>
                              <td className="px-4 py-3">
                                <div className="text-foreground font-medium">{lesson.title}</div>
                                {lesson.description && (
                                  <div className="text-xs text-muted mt-0.5 truncate max-w-[400px]">
                                    {lesson.description}
                                  </div>
                                )}
                                <div className="text-[10px] text-foreground/30 font-mono mt-0.5">
                                  /{lesson.slug}{lesson.videoId ? ` · video:${lesson.videoId.slice(0, 8)}` : ''}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-muted">{formatDuration(lesson.duration)}</td>
                              <td className="px-4 py-3">
                                <button
                                  onClick={() =>
                                    togglePublish.mutate({
                                      id: lesson.id,
                                      isPublished: !lesson.isPublished,
                                    })
                                  }
                                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer ${
                                    lesson.isPublished
                                      ? 'text-green-500 bg-green-500/10 hover:bg-green-500/20'
                                      : 'text-foreground/40 bg-foreground/5 hover:bg-foreground/10'
                                  }`}
                                >
                                  {lesson.isPublished ? 'Опубликован' : 'Черновик'}
                                </button>
                              </td>
                              <td className="px-4 py-3 text-right space-x-2">
                                <button
                                  onClick={() => {
                                    setEditingId(lesson.id);
                                    setShowCreate(false);
                                    setMutError('');
                                  }}
                                  className="text-accent hover:text-accent/80 text-xs"
                                >
                                  Изменить
                                </button>
                                <button
                                  onClick={() => {
                                    if (confirm(`Удалить урок "${lesson.title}"?`)) {
                                      deleteMut.mutate(lesson.id);
                                    }
                                  }}
                                  className="text-red-400 hover:text-red-300 text-xs"
                                >
                                  Удалить
                                </button>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {data?.items.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted font-body mb-4">Нет созданных уроков</p>
              <Button size="sm" onClick={() => setShowCreate(true)}>
                Создать первый урок
              </Button>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i + 1}
                  onClick={() => setPage(i + 1)}
                  className={`px-3 py-1 text-sm rounded font-body transition-colors ${
                    page === i + 1
                      ? 'bg-accent text-background'
                      : 'text-muted hover:text-foreground hover:bg-foreground/5'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
