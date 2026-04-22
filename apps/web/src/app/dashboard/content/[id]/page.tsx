'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contentApi, videoApi, API_BASE, type ContentItem } from '../../../../lib/api';
import { VideoPlayer } from '../../../../components/video-player';
import { PdfViewer } from '../../../../components/pdf-viewer';
import { CheckIcon } from '../../../../components/icons';

// ─── Helpers ──────────────────────────────────────────────

function getDurationLabel(seconds: number | null) {
  if (!seconds) return null;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h} ч ${rem} мин` : `${h} ч`;
}

const CONTENT_TYPE_LABELS: Record<ContentItem['contentType'], string> = {
  lecture: 'Видео лекция',
  affirmation: 'Аффирмация',
  article_pdf: 'Статья',
};

// ─── Viewed toggle ────────────────────────────────────────

function ViewedToggle({
  contentId,
  isViewed,
}: {
  contentId: string;
  isViewed: boolean;
}) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (viewed: boolean) => contentApi.markViewed(contentId, viewed),
    onSuccess: (result) => {
      // Update single item cache
      queryClient.setQueryData<ContentItem>(['content', 'item', contentId], (old) =>
        old ? { ...old, isMarkedViewed: result.isMarkedViewed } : old,
      );
      // Invalidate list cache so the card badge updates on back-navigation
      queryClient.invalidateQueries({ queryKey: ['content'] });
    },
  });

  return (
    <button
      onClick={() => mutation.mutate(!isViewed)}
      disabled={mutation.isPending}
      className={`flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-sm font-medium font-body transition-all duration-200 ${
        isViewed
          ? 'border-accent/30 bg-accent/8 text-accent'
          : 'border-foreground/10 bg-foreground/[0.03] text-foreground/60 hover:border-foreground/20 hover:text-foreground'
      } ${mutation.isPending ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`flex h-5 w-5 items-center justify-center rounded-full border transition-all duration-200 ${
          isViewed ? 'border-accent bg-accent' : 'border-foreground/20'
        }`}
      >
        {isViewed && <CheckIcon size={11} className="text-white" />}
      </span>
      {isViewed ? 'Просмотрено' : 'Отметить просмотренным'}
    </button>
  );
}

// ─── Video content ────────────────────────────────────────

function VideoContent({ item }: { item: ContentItem }) {
  const { data: playback, isLoading, isError } = useQuery({
    queryKey: ['playback', item.id],
    queryFn: () => videoApi.requestPlayback(item.id),
    staleTime: 10 * 60 * 1000, // token TTL is 15m, keep fresh for 10m
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="aspect-video w-full rounded-2xl bg-foreground/5 animate-pulse flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (isError || !playback) {
    return (
      <div className="aspect-video w-full rounded-2xl bg-foreground/5 flex items-center justify-center">
        <p className="text-foreground/30 text-sm font-body">Не удалось загрузить видео</p>
      </div>
    );
  }

  // The API returns relative paths — prefix with API origin so HLS.js and Shaka
  // resolve requests against the API server, not the Next.js frontend.
  const absoluteSrc = `${API_BASE}${playback.playbackUrl}`;
  const absoluteDrm = playback.drm
    ? {
        ...playback.drm,
        dashUrl: `${API_BASE}${playback.drm.dashUrl}`,
        ...(playback.drm.widevineUrl
          ? { widevineUrl: `${API_BASE}${playback.drm.widevineUrl}` }
          : {}),
      }
    : undefined;

  return (
    <div className="overflow-hidden rounded-2xl bg-black">
      <VideoPlayer
        src={absoluteSrc}
        lessonId={item.id}
        drm={absoluteDrm}
      />
    </div>
  );
}

// ─── PDF content (protected) ──────────────────────────────

function PdfContent({ item }: { item: ContentItem }) {
  const hasArticle = !!(item.articleId || item.pdfUrl);

  const { data: tokenData, isLoading, isError, refetch } = useQuery({
    queryKey: ['article-token', item.id],
    queryFn: () => contentApi.requestArticleToken(item.id),
    // Token is NOT single-use anymore — allow reuse for the 30-min TTL window.
    // Cache for 25 min so we get a fresh token before it expires.
    staleTime: 25 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    enabled: hasArticle,
    retry: 1,
  });

  if (!hasArticle) {
    return (
      <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-8 text-center">
        <svg className="h-12 w-12 mx-auto text-foreground/20 mb-3" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
        </svg>
        <p className="text-foreground/40 font-body text-sm">Файл не прикреплён к этому уроку</p>
        <p className="text-xs text-muted mt-1">Обратитесь к администратору</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl bg-foreground/[0.03] border border-foreground/10 py-20">
        <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
        <p className="text-sm font-body text-foreground/40">Загрузка статьи…</p>
      </div>
    );
  }

  if (isError || !tokenData?.token) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl bg-foreground/[0.03] border border-foreground/10 py-16 px-8 text-center">
        <p className="text-sm font-body text-foreground/40">Не удалось загрузить статью</p>
        <button onClick={() => refetch()} className="text-sm text-accent hover:underline font-body">
          Попробовать снова
        </button>
      </div>
    );
  }

  const pdfUrl = `${API_BASE}/articles/read?token=${encodeURIComponent(tokenData.token)}`;

  return <PdfViewer url={pdfUrl} title={item.title} />;
}

// ─── Page ─────────────────────────────────────────────────

export default function ContentPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const router = useRouter();

  const { data: item, isLoading, isError, error  } = useQuery({
    queryKey: ['content', 'item', id],
    queryFn: () => contentApi.getById(id),
    staleTime: 30_000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
        <div className="h-6 w-24 bg-foreground/5 rounded animate-pulse mb-8" />
        <div className="aspect-video w-full rounded-2xl bg-foreground/5 animate-pulse mb-6" />
        <div className="h-7 w-2/3 bg-foreground/5 rounded animate-pulse" />
      </div>
    );
  }

  if (isError || !item) {
    const message = error instanceof Error ? error.message : '';
    
    // Ошибка подписки/авторизации
    if (message.toLowerCase().includes('subscription') || 
        message.toLowerCase().includes('forbidden') ||
        message.toLowerCase().includes('active')) {
      return (
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-20 text-center">
          <p className="text-foreground/40 font-body text-sm mb-4">
            Для доступа к этому материалу нужна активная подписка
          </p>
          <button
            onClick={() => router.push('/dashboard')}
            className="text-sm text-accent hover:underline font-body"
          >
            ← В личный кабинет
          </button>
        </div>
      );
    }
    if (!item) return null;
    // Материал не найден
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-20 text-center">
        <p className="text-foreground/40 font-body text-sm mb-4">Материал не найден или снят с публикации</p>
        <button
          onClick={() => router.back()}
          className="text-sm text-accent hover:underline font-body"
        >
          ← Назад
        </button>
      </div>
    );
  }

  const isPdf = item.contentType === 'article_pdf';
  const duration = getDurationLabel(item.duration);

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8 sm:py-10">
      {/* Breadcrumb */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-foreground/40 hover:text-foreground font-body mb-6 transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Личный кабинет
      </Link>

      {/* Meta */}
      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <span className="text-xs font-medium font-body uppercase tracking-wider text-foreground/40">
          {CONTENT_TYPE_LABELS[item.contentType]}
        </span>
        {duration && (
          <>
            <span className="h-3 w-px bg-foreground/15" />
            <span className="text-xs font-body text-foreground/40">{duration}</span>
          </>
        )}
      </div>

      {/* Title */}
      <h1 className="font-heading text-2xl sm:text-3xl font-bold text-foreground mb-6 leading-tight">
        {item.title}
      </h1>

      {/* Content area */}
      <div className="mb-6">
        {isPdf ? (
          <PdfContent item={item} />
        ) : (
          <VideoContent item={item} />
        )}
      </div>

      {/* Description */}
      {item.description && (
        <p className="text-[15px] leading-relaxed text-foreground/70 font-body mb-6">
          {item.description}
        </p>
      )}

      {/* Divider */}
      <div className="h-px bg-foreground/5 mb-6" />

      {/* Viewed toggle */}
      <ViewedToggle contentId={id} isViewed={item.isMarkedViewed} />
    </div>
  );
}
