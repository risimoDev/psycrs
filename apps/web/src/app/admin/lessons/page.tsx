'use client';

import { useState, useRef, useEffect, type ChangeEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi, API_BASE, type AdminLesson, type AdminVideo, type AdminArticle, type ContentType } from '../../../lib/api';
import { Button } from '../../../components/button';
import { LessonPlaceholder } from '../../../components/lesson-placeholder';

const CONTENT_TYPES: { value: ContentType; label: string }[] = [
  { value: 'lecture', label: 'Видео лекция' },
  { value: 'affirmation', label: 'Аффирмация' },
  { value: 'article_pdf', label: 'Статья (PDF)' },
];

function contentTypeLabel(ct: ContentType): string {
  return CONTENT_TYPES.find((t) => t.value === ct)?.label ?? ct;
}

function contentTypeBadge(ct: ContentType) {
  const colors: Record<ContentType, string> = {
    lecture: 'bg-blue-500/10 text-blue-400',
    affirmation: 'bg-purple-500/10 text-purple-400',
    article_pdf: 'bg-amber-500/10 text-amber-400',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[ct] ?? ''}`}>
      {contentTypeLabel(ct)}
    </span>
  );
}

interface LessonFormData {
  title: string;
  slug: string;
  description: string;
  contentType: ContentType;
  videoId: string;
  articleId: string;
  pdfUrl: string;
  order: number;
  duration: number | '';
  isPublished: boolean;
  thumbnailFile: File | null;
}

function LessonForm({
  initial,
  onSubmit,
  onCancel,
  loading,
  error,
}: {
  initial?: AdminLesson;
  onSubmit: (data: LessonFormData) => void;
  onCancel: () => void;
  loading: boolean;
  error?: string;
}) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [contentType, setContentType] = useState<ContentType>(initial?.contentType ?? 'lecture');
  const [videoId, setVideoId] = useState(initial?.videoId ?? '');
  const [articleId, setArticleId] = useState(initial?.articleId ?? '');
  const [pdfUrl, _setPdfUrl] = useState(initial?.pdfUrl ?? '');
  const [order, setOrder] = useState(initial?.order ?? 0);
  const [duration, setDuration] = useState<number | ''>(initial?.duration ?? '');
  const [isPublished, setIsPublished] = useState(initial?.isPublished ?? false);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clean up object URL on unmount or when new file is chosen
  useEffect(() => {
    return () => { if (thumbnailPreview && thumbnailPreview.startsWith('blob:')) URL.revokeObjectURL(thumbnailPreview); };
  }, [thumbnailPreview]);

  function handleThumbnailChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    if (thumbnailPreview && thumbnailPreview.startsWith('blob:')) URL.revokeObjectURL(thumbnailPreview);
    setThumbnailFile(file);
    setThumbnailPreview(URL.createObjectURL(file));
  }

  const { data: videosData } = useQuery({
    queryKey: ['admin', 'videos', 'ready'],
    queryFn: () => adminApi.videos(1, 100, 'ready'),
  });

  const { data: articlesData } = useQuery({
    queryKey: ['admin', 'articles', 'all'],
    queryFn: () => adminApi.articles(1, 100),
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

  const needsVideo = contentType === 'lecture' || contentType === 'affirmation';
  const needsPdf = contentType === 'article_pdf';

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ title, slug, description, contentType, videoId, articleId, pdfUrl, order, duration, isPublished, thumbnailFile });
      }}
      className="space-y-4 bg-surface border border-foreground/10 rounded-lg p-5"
    >
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-sm text-red-400 font-body">{error}</p>
        </div>
      )}

      {/* Тип контента */}
      <div>
        <label className="block text-xs font-body text-muted mb-2">Тип контента *</label>
        <div className="flex gap-2 flex-wrap">
          {CONTENT_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setContentType(t.value)}
              className={`px-4 py-2 rounded-lg text-sm font-body transition-colors border ${
                contentType === t.value
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-foreground/10 text-foreground/60 hover:border-foreground/20'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-xs font-body text-muted mb-1">Название *</label>
          <input
            required
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (!initial) setSlug(autoSlug(e.target.value));
            }}
            placeholder={
              contentType === 'lecture' ? 'Введение в когнитивную психологию' :
              contentType === 'affirmation' ? 'Утренняя аффирмация уверенности' :
              'Схема когнитивных искажений'
            }
            className="w-full bg-background border border-foreground/10 rounded px-3 py-2 text-sm text-foreground font-body focus:outline-none focus:border-accent/50"
          />
        </div>

        <div>
          <label className="block text-xs font-body text-muted mb-1">Адрес страницы (slug) *</label>
          <input
            required
            pattern="[a-z0-9-]+"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="vvedenie-v-psihologiyu"
            className="w-full bg-background border border-foreground/10 rounded px-3 py-2 text-foreground focus:outline-none focus:border-accent/50 font-mono text-xs"
          />
          <p className="text-[10px] text-muted mt-0.5">Латиница, цифры, дефисы</p>
        </div>

        <div>
          <label className="block text-xs font-body text-muted mb-1">Порядок</label>
          <input
            type="number"
            min={0}
            value={order}
            onChange={(e) => setOrder(Number(e.target.value))}
            className="w-full bg-background border border-foreground/10 rounded px-3 py-2 text-sm text-foreground font-body focus:outline-none focus:border-accent/50"
          />
        </div>

        <div className="col-span-2">
          <label className="block text-xs font-body text-muted mb-1">Описание</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Краткое описание..."
            className="w-full bg-background border border-foreground/10 rounded px-3 py-2 text-sm text-foreground font-body focus:outline-none focus:border-accent/50 resize-none"
          />
        </div>

        {/* Видео — для лекций и аффирмаций */}
        {needsVideo && (
          <>
            <div className="col-span-2">
              <label className="block text-xs font-body text-muted mb-1">Видео *</label>
              <div className="flex gap-2">
                <select
                  value={videoId}
                  onChange={(e) => setVideoId(e.target.value)}
                  className="flex-1 bg-background border border-foreground/10 rounded px-3 py-2 text-sm text-foreground font-body focus:outline-none focus:border-accent/50"
                >
                  <option value="">— Выберите из загруженных —</option>
                  {videosData?.items.map((v: AdminVideo) => (
                    <option key={v.id} value={v.id}>
                      {v.originalName} ({v.id.slice(0, 8)}…)
                    </option>
                  ))}
                </select>
                <input
                  value={videoId}
                  onChange={(e) => setVideoId(e.target.value)}
                  placeholder="или ID вручную"
                  className="w-36 bg-background border border-foreground/10 rounded px-3 py-2 text-xs text-foreground font-mono focus:outline-none focus:border-accent/50"
                />
              </div>
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
          </>
        )}

        {/* PDF статья — выбор из загруженных */}
        {needsPdf && (
          <div className="col-span-2">
            <label className="block text-xs font-body text-muted mb-1">Статья PDF *</label>
            <select
              required={needsPdf}
              value={articleId}
              onChange={(e) => setArticleId(e.target.value)}
              className="w-full bg-background border border-foreground/10 rounded px-3 py-2 text-sm text-foreground font-body focus:outline-none focus:border-accent/50"
            >
              <option value="">— Выберите статью —</option>
              {articlesData?.items.map((a: AdminArticle) => (
                <option key={a.id} value={a.id}>
                  {a.originalName}
                </option>
              ))}
            </select>
            {articlesData?.items.length === 0 && (
              <p className="text-[11px] text-amber-400 mt-1">
                Нет загруженных PDF. Сначала загрузите статью в разделе{' '}
                <a href="/admin/articles" className="underline">Статьи PDF</a>.
              </p>
            )}
          </div>
        )}

        <div className="col-span-2 flex items-center">
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

        {/* Превью */}
        <div className="col-span-2">
          <label className="block text-xs font-body text-muted mb-2">Превью</label>
          <div className="flex items-start gap-3">
            {/* Preview image or placeholder */}
            <div className="relative flex-shrink-0 h-20 w-20 rounded-lg overflow-hidden border border-foreground/10 bg-foreground/5">
              {thumbnailPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumbnailPreview} alt="" className="h-full w-full object-cover" />
              ) : initial?.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`${API_BASE}${initial.thumbnailUrl}`} alt="" className="h-full w-full object-cover" />
              ) : initial ? (
                <LessonPlaceholder id={initial.id} className="h-full w-full" />
              ) : (
                <div className="h-full w-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-foreground/20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 20.25h18A.75.75 0 0021.75 19.5V4.5A.75.75 0 0021 3.75H3A.75.75 0 002.25 4.5v15A.75.75 0 003 20.25z" />
                  </svg>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 rounded border border-foreground/15 text-xs font-body text-foreground/70 hover:border-accent/40 hover:text-foreground transition-colors"
              >
                {thumbnailFile ? thumbnailFile.name : 'Выбрать изображение'}
              </button>
              {(thumbnailFile || initial?.thumbnailUrl) && (
                <button
                  type="button"
                  onClick={() => { setThumbnailFile(null); setThumbnailPreview(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                  className="text-[11px] text-red-400/70 hover:text-red-400 font-body text-left"
                >
                  Удалить превью
                </button>
              )}
              <p className="text-[10px] text-muted">JPG, PNG, WebP. Рекомендуется 1:1 или 16:9</p>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="hidden"
            onChange={handleThumbnailChange}
          />
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" size="sm" disabled={loading || (needsVideo && !videoId) || (needsPdf && !articleId)}>
          {loading ? 'Сохранение...' : initial ? 'Обновить' : 'Создать'}
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
    mutationFn: async (d: LessonFormData) => {
      const lesson = await adminApi.createLesson({
        title: d.title,
        slug: d.slug,
        description: d.description || undefined,
        contentType: d.contentType,
        videoId: d.videoId || undefined,
        articleId: d.articleId || undefined,
        pdfUrl: d.pdfUrl || undefined,
        order: d.order,
        duration: d.duration !== '' ? Number(d.duration) : undefined,
        isPublished: d.isPublished,
      });
      if (d.thumbnailFile) {
        await adminApi.uploadLessonThumbnail(lesson.id, d.thumbnailFile);
      }
      return lesson;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'lessons'] });
      setShowCreate(false);
      setMutError('');
    },
    onError: (err: Error) => setMutError(err.message || 'Не удалось создать урок'),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, ...d }: { id: string } & LessonFormData) => {
      const lesson = await adminApi.updateLesson(id, {
        title: d.title,
        slug: d.slug,
        description: d.description || undefined,
        contentType: d.contentType,
        videoId: d.videoId || undefined,
        articleId: d.articleId || null,
        pdfUrl: d.pdfUrl || undefined,
        order: d.order,
        duration: d.duration !== '' ? Number(d.duration) : undefined,
        isPublished: d.isPublished,
      });
      if (d.thumbnailFile) {
        await adminApi.uploadLessonThumbnail(id, d.thumbnailFile);
      }
      return lesson;
    },
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
      const ct = lesson.contentType ?? 'lecture';
      if (!acc[ct]) acc[ct] = [];
      acc[ct].push(lesson);
      return acc;
    },
    {} as Record<string, AdminLesson[]>,
  ) ?? {};

  const typeOrder: string[] = ['lecture', 'affirmation', 'article_pdf'];
  const presentTypes = typeOrder.filter((t) => groupedLessons[t]?.length);
  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-foreground">Уроки</h1>
          {data && (
            <p className="text-sm text-muted font-body mt-1">
              Всего: {data.total} — лекций: {groupedLessons['lecture']?.length ?? 0}, аффирмаций: {groupedLessons['affirmation']?.length ?? 0}, статей: {groupedLessons['article_pdf']?.length ?? 0}
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
          {presentTypes.map((ct) => (
            <div key={ct} className="mb-8">
              <h2 className="font-heading text-base font-semibold text-foreground mb-3 flex items-center gap-2">
                {contentTypeBadge(ct as ContentType)}
                <span className="text-xs text-muted font-normal font-body">
                  ({groupedLessons[ct]?.length ?? 0} шт.)
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
                    {(groupedLessons[ct] ?? [])
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
                                  /{lesson.slug}
                                  {lesson.videoId ? ` · video:${lesson.videoId.slice(0, 8)}` : ''}
                                  {lesson.pdfUrl ? ` · pdf` : ''}
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
                                    if (confirm(`Удалить "${lesson.title}"?`)) {
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
