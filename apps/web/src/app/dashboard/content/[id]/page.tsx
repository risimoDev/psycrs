'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contentApi, videoApi, type ContentItem } from '../../../../lib/api';
import { VideoPlayer } from '../../../../components/video-player';
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

  return (
    <div className="overflow-hidden rounded-2xl bg-black">
      <VideoPlayer
        src={playback.playbackUrl}
        lessonId={item.id}
        drm={playback.drm}
      />
    </div>
  );
}

// ─── PDF content ──────────────────────────────────────────

function PdfContent({ item }: { item: ContentItem }) {
  if (!item.pdfUrl) {
    return (
      <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-8 text-center">
        <p className="text-foreground/30 font-body text-sm">Файл не прикреплён</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Inline preview */}
      <div className="rounded-2xl overflow-hidden border border-foreground/10 bg-foreground/[0.02]">
        <iframe
          src={item.pdfUrl}
          className="w-full"
          style={{ height: 'min(70vh, 720px)', border: 'none' }}
          title={item.title}
        />
      </div>
      {/* Download fallback */}
      <a
        href={item.pdfUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 text-sm font-medium font-body text-accent hover:underline"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        Скачать PDF
      </a>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────

export default function ContentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const { data: item, isLoading, isError } = useQuery({
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
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-20 text-center">
        <p className="text-foreground/40 font-body text-sm mb-4">Материал не найден</p>
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
