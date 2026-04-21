'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../../lib/api';
import { Button } from '../../../components/button';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  uploading: { label: 'Загрузка', color: 'text-yellow-500 bg-yellow-500/10' },
  processing: { label: 'Обработка', color: 'text-blue-400 bg-blue-400/10' },
  ready: { label: 'Готово', color: 'text-green-500 bg-green-500/10' },
  error: { label: 'Ошибка', color: 'text-red-400 bg-red-400/10' },
};

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function VideosPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [error, setError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'videos', page, statusFilter],
    queryFn: () => adminApi.videos(page, 20, statusFilter),
    refetchInterval: 5000, // Poll for processing status updates
  });

  const deleteMut = useMutation({
    mutationFn: adminApi.deleteVideo,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'videos'] }),
    onError: (err: Error) => setError(err.message || 'Не удалось удалить видео'),
  });

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadProgress(`Загрузка: ${file.name} (${formatBytes(file.size)})`);
    setError('');

    try {
      await adminApi.uploadVideo(file);
      queryClient.invalidateQueries({ queryKey: ['admin', 'videos'] });
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
        <h1 className="font-heading text-2xl font-semibold text-foreground">Видео</h1>
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleUpload}
            className="hidden"
          />
          <Button
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? 'Загрузка...' : '+ Загрузить видео'}
          </Button>
        </div>
      </div>

      {/* Upload progress */}
      {uploadProgress && (
        <div className="mb-4 p-3 bg-accent/10 border border-accent/20 rounded-lg flex items-center gap-3">
          <svg className="w-5 h-5 text-accent animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm font-body text-foreground">{uploadProgress}</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center justify-between">
          <p className="text-sm text-red-400 font-body">{error}</p>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-300">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        {[
          { value: undefined, label: 'Все' },
          { value: 'ready', label: 'Готовые' },
          { value: 'processing', label: 'В обработке' },
          { value: 'error', label: 'С ошибкой' },
        ].map((f) => (
          <button
            key={f.label}
            onClick={() => { setStatusFilter(f.value); setPage(1); }}
            className={`px-3 py-1.5 text-xs font-body rounded-lg transition-colors ${
              statusFilter === f.value
                ? 'bg-accent text-white'
                : 'text-muted hover:text-foreground hover:bg-foreground/5'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-muted font-body text-sm">Загрузка...</p>
      ) : (
        <>
          <div className="border border-foreground/10 rounded-lg overflow-hidden">
            <table className="w-full text-sm font-body">
              <thead>
                <tr className="bg-foreground/5 border-b border-foreground/10">
                  <th className="text-left px-4 py-3 text-muted font-medium">Файл</th>
                  <th className="text-left px-4 py-3 text-muted font-medium">ID</th>
                  <th className="text-left px-4 py-3 text-muted font-medium">Статус</th>
                  <th className="text-left px-4 py-3 text-muted font-medium">Размер</th>
                  <th className="text-left px-4 py-3 text-muted font-medium">Дата</th>
                  <th className="text-right px-4 py-3 text-muted font-medium">Действия</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted">
                      Нет загруженных видео
                    </td>
                  </tr>
                )}
                {data?.items.map((video) => {
                  const status = STATUS_LABELS[video.status] ?? { label: 'Неизвестно', color: 'text-muted bg-foreground/5' };
                  return (
                    <tr key={video.id} className="border-b border-foreground/5 last:border-0">
                      <td className="px-4 py-3">
                        <div className="text-foreground truncate max-w-[200px]">{video.originalName}</div>
                        <div className="text-xs text-muted">{video.filename}</div>
                      </td>
                      <td className="px-4 py-3">
                        <code className="text-xs text-muted bg-foreground/5 px-1.5 py-0.5 rounded select-all">
                          {video.id.slice(0, 8)}...
                        </code>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${status.color}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted">{formatBytes(video.size)}</td>
                      <td className="px-4 py-3 text-muted">
                        {new Date(video.createdAt).toLocaleDateString('ru-RU')}
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <button
                          onClick={() => navigator.clipboard.writeText(video.id)}
                          className="text-accent hover:text-accent/80 text-xs"
                          title="Копировать ID"
                        >
                          Копировать ID
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Удалить видео "${video.originalName}"?`)) {
                              deleteMut.mutate(video.id);
                            }
                          }}
                          className="text-red-400 hover:text-red-300 text-xs"
                        >
                          Удалить
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

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
