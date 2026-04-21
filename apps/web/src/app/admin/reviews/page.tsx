'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi, type AdminReview } from '../../../lib/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export default function ReviewsPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'reviews'],
    queryFn: () => adminApi.reviews(1, 100),
  });

  const deleteMut = useMutation({
    mutationFn: adminApi.deleteReview,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'reviews'] }),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-2xl font-semibold text-foreground">Отзывы</h1>
        <button
          onClick={() => { setShowCreate(!showCreate); setEditingId(null); }}
          className="px-4 py-2 text-sm font-body bg-accent text-background rounded hover:bg-accent/90 transition-colors"
        >
          {showCreate ? 'Отмена' : '+ Добавить отзыв'}
        </button>
      </div>

      {showCreate && (
        <ReviewForm
          onDone={() => { setShowCreate(false); queryClient.invalidateQueries({ queryKey: ['admin', 'reviews'] }); }}
        />
      )}

      {isLoading ? (
        <p className="text-foreground/50 font-body text-sm">Загрузка...</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data?.items.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              isEditing={editingId === review.id}
              onEdit={() => setEditingId(editingId === review.id ? null : review.id)}
              onDelete={() => {
                if (confirm(`Удалить отзыв от "${review.name}"?`)) {
                  deleteMut.mutate(review.id);
                }
              }}
              onDone={() => {
                setEditingId(null);
                queryClient.invalidateQueries({ queryKey: ['admin', 'reviews'] });
              }}
            />
          ))}
        </div>
      )}

      {data?.items.length === 0 && !isLoading && (
        <p className="text-foreground/30 font-body text-sm text-center py-12">Отзывов пока нет. Добавьте первый.</p>
      )}
    </div>
  );
}

/* ─── Review Form ─── */
function ReviewForm({ review, onDone }: { review?: AdminReview; onDone: () => void }) {
  const [name, setName] = useState(review?.name ?? '');
  const [role, setRole] = useState(review?.role ?? '');
  const [text, setText] = useState(review?.text ?? '');
  const [order, setOrder] = useState(review?.order ?? 0);
  const [isVisible, setIsVisible] = useState(review?.isVisible ?? true);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (review) {
        await adminApi.updateReview(review.id, { name, role: role || undefined, text: text || undefined, order, isVisible });
      } else {
        await adminApi.createReview({ name, role: role || undefined, text: text || undefined, order, isVisible });
      }
      onDone();
    } catch {
      alert('Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  }

  const inputClass = 'w-full bg-foreground/5 border border-foreground/10 rounded px-3 py-2 text-sm text-foreground font-body placeholder:text-foreground/30 focus:outline-none focus:border-accent/50';

  return (
    <form onSubmit={handleSubmit} className="mb-6 bg-foreground/[0.02] border border-foreground/10 rounded-lg p-5 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs text-foreground/50 mb-1">Имя *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Анна К." className={inputClass} required />
        </div>
        <div>
          <label className="block text-xs text-foreground/50 mb-1">Роль / профессия</label>
          <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Психолог" className={inputClass} />
        </div>
      </div>
      <div>
        <label className="block text-xs text-foreground/50 mb-1">Текст отзыва</label>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Текст отзыва..." className={inputClass} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="block text-xs text-foreground/50 mb-1">Порядок</label>
          <input type="number" value={order} onChange={(e) => setOrder(Number(e.target.value))} className={inputClass} />
        </div>
        <div className="flex items-end gap-2 pb-1">
          <label className="flex items-center gap-2 text-sm text-foreground/70 cursor-pointer">
            <input type="checkbox" checked={isVisible} onChange={(e) => setIsVisible(e.target.checked)} className="accent-accent" />
            Видимый
          </label>
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-accent text-background rounded hover:bg-accent/90 disabled:opacity-50">
          {saving ? 'Сохранение...' : review ? 'Обновить' : 'Создать'}
        </button>
      </div>
    </form>
  );
}

/* ─── Review Card ─── */
function ReviewCard({
  review,
  isEditing,
  onEdit,
  onDelete,
  onDone,
}: {
  review: AdminReview;
  isEditing: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onDone: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await adminApi.uploadReviewImage(review.id, file);
      queryClient.invalidateQueries({ queryKey: ['admin', 'reviews'] });
    } catch {
      alert('Ошибка загрузки изображения');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  if (isEditing) {
    return <ReviewForm review={review} onDone={onDone} />;
  }

  return (
    <div className="border border-foreground/10 rounded-lg overflow-hidden bg-foreground/[0.02]">
      {/* Image area */}
      <div className="relative aspect-[4/3] bg-foreground/5 flex items-center justify-center">
        {review.imageUrl ? (
          <img
            src={`${API_BASE}${review.imageUrl}`}
            alt={review.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="text-foreground/20 text-center">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="mx-auto mb-2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <p className="text-xs">Нет изображения</p>
          </div>
        )}

        {/* Upload overlay */}
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="absolute inset-0 bg-black/0 hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 hover:opacity-100"
        >
          <span className="text-white text-xs font-medium bg-black/60 px-3 py-1.5 rounded">
            {uploading ? 'Загрузка...' : 'Загрузить фото'}
          </span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleImageUpload}
          className="hidden"
        />

        {/* Visibility badge */}
        {!review.isVisible && (
          <span className="absolute top-2 left-2 bg-red-500/80 text-white text-[10px] px-2 py-0.5 rounded">
            Скрыт
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-sm text-foreground">{review.name}</p>
            {review.role && <p className="text-xs text-foreground/50">{review.role}</p>}
          </div>
          <span className="text-[10px] text-foreground/30 font-mono shrink-0">#{review.order}</span>
        </div>
        {review.text && (
          <p className="text-xs text-foreground/60 mt-2 line-clamp-3 italic">&ldquo;{review.text}&rdquo;</p>
        )}

        <div className="flex gap-2 mt-3 pt-3 border-t border-foreground/5">
          <button onClick={onEdit} className="text-xs text-accent hover:text-accent/80">Редактировать</button>
          <button onClick={onDelete} className="text-xs text-red-400 hover:text-red-300">Удалить</button>
        </div>
      </div>
    </div>
  );
}
