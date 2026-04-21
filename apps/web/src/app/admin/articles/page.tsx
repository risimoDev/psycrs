'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../../lib/api';
import { Button } from '../../../components/button';

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function ArticlesPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [page, setPage] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'articles', page],
    queryFn: () => adminApi.articles(page, 20),
  });

  const deleteMut = useMutation({
    mutationFn: adminApi.deleteArticle,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'articles'] }),
    onError: (err: Error) => setError(err.message || 'Не удалось удалить статью'),
  });

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Допустимы только PDF файлы');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setUploading(true);
    setUploadProgress(`Загрузка: ${file.name} (${formatBytes(file.size)})`);
    setError('');

    try {
      await adminApi.uploadArticle(file);
      queryClient.invalidateQueries({ queryKey: ['admin', 'articles'] });
      setUploadProgress('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-2xl font-semibold text-foreground">Статьи PDF</h1>
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            onChange={handleUpload}
            className="hidden"
          />
          <Button
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? 'Загрузка...' : '+ Загрузить PDF'}
          </Button>
        </div>
      </div>

      {uploadProgress && (
        <p className="text-sm text-muted-foreground mb-4 animate-pulse">{uploadProgress}</p>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
          <button onClick={() => setError('')} className="ml-2 underline">закрыть</button>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-0 divide-y divide-border text-sm">
          {/* Header */}
          <div className="col-span-4 grid grid-cols-[1fr_auto_auto_auto] px-4 py-3 bg-muted/40 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <span>Файл</span>
            <span className="w-28 text-right pr-6">Размер</span>
            <span className="w-28 text-right pr-6">Уроков</span>
            <span className="w-24 text-right pr-4">Действия</span>
          </div>

          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="col-span-4 grid grid-cols-[1fr_auto_auto_auto] px-4 py-3 animate-pulse">
                <div className="h-4 w-48 rounded bg-muted/60" />
                <div className="w-28 text-right pr-6 h-4 rounded bg-muted/60" />
                <div className="w-28 text-right pr-6" />
                <div className="w-24 text-right pr-4" />
              </div>
            ))
          ) : data?.items.length === 0 ? (
            <div className="col-span-4 px-4 py-12 text-center text-muted-foreground">
              PDF статьи не загружены
            </div>
          ) : (
            data?.items.map((article) => (
              <div
                key={article.id}
                className="col-span-4 grid grid-cols-[1fr_auto_auto_auto] items-center px-4 py-3 hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* PDF icon */}
                  <div className="shrink-0 flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/10">
                    <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{article.originalName}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(article.createdAt).toLocaleDateString('ru-RU', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
                <span className="w-28 text-right pr-6 text-muted-foreground tabular-nums">
                  {formatBytes(article.size)}
                </span>
                <span className="w-28 text-right pr-6 text-muted-foreground tabular-nums">
                  {article.lessonCount}
                </span>
                <div className="w-24 text-right pr-4">
                  <button
                    onClick={() => {
                      if (confirm(`Удалить "${article.originalName}"?`)) {
                        deleteMut.mutate(article.id);
                      }
                    }}
                    disabled={deleteMut.isPending}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                  >
                    Удалить
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            ← Назад
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Вперёд →
          </Button>
        </div>
      )}
    </div>
  );
}
