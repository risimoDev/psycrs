'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { reviewsApi, type PublicReview } from '../lib/api';
import { useAuthStore } from '../lib/auth-store';
import { Button } from './button';

function StarRow({ rating = 5 }: { rating?: number }) {
  return (
    <div className="flex gap-0.5 mb-4">
      {[...Array(5)].map((_, i) => (
        <svg key={i} width="13" height="13" viewBox="0 0 24 24" fill={i < rating ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" className="text-accent">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </div>
  );
}

function Initials({ name }: { name: string }) {
  const letters = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[12px] font-semibold text-accent font-heading">
      {letters}
    </div>
  );
}

function ReviewCard({ review }: { review: PublicReview }) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-foreground/8 bg-surface p-5 select-none transition-all duration-200 hover:border-accent/20 hover:shadow-lg hover:shadow-accent/5">
      <svg className="mb-3 text-accent/30" width="28" height="20" viewBox="0 0 28 20" fill="currentColor">
        <path d="M0 20V12.5C0 5.833 3.333 1.667 10 0l1.5 2.5C8.667 3.667 7 5.833 7 8.5H12V20H0ZM16 20V12.5C16 5.833 19.333 1.667 26 0l1.5 2.5C24.667 3.667 23 5.833 23 8.5H28V20H16Z" />
      </svg>

      <StarRow rating={review.rating} />

      {review.text && (
        <p className="flex-1 text-[13.5px] leading-relaxed text-foreground/70 line-clamp-6">
          {review.text}
        </p>
      )}

      <div className="mt-5 flex items-center gap-3 border-t border-foreground/6 pt-4">
        <Initials name={review.name} />
        <div>
          <p className="text-[13px] font-semibold text-foreground">{review.name}</p>
        </div>
      </div>
    </div>
  );
}

/* ─── Review Modal ─── */
function ReviewModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [rating, setRating] = useState(5);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!isAuthenticated) {
      router.push('/auth/login?next=/');
      return;
    }
    if (text.length < 10) {
      setError('Отзыв должен содержать минимум 10 символов');
      return;
    }
    setLoading(true);
    try {
      await reviewsApi.create({ name, text, rating });
      setSuccess('Отзыв отправлен на модерацию. После одобрения вы сможете забрать подарок в личном кабинете!');
      setName('');
      setText('');
      setRating(5);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка отправки отзыва');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md bg-surface border border-foreground/10 rounded-2xl p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading text-xl font-bold">Оставить отзыв</h3>
          <button onClick={onClose} className="text-muted hover:text-foreground transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {!isAuthenticated && (
          <div className="bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-lg px-4 py-3 text-sm mb-4">
            Для оставления отзыва необходимо <button onClick={() => { onClose(); router.push('/auth/login?next=/'); }} className="underline font-semibold">авторизоваться</button>
          </div>
        )}

        {success ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-green-500/10 flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-500"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <p className="text-foreground font-medium mb-1">Спасибо!</p>
            <p className="text-sm text-muted">{success}</p>
            <button onClick={onClose} className="mt-4 px-4 py-2 text-sm bg-accent text-background rounded hover:bg-accent/90 transition-colors">
              Закрыть
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-500/8 border border-red-500/20 text-red-500 dark:text-red-400 rounded-lg px-4 py-3 text-sm">{error}</div>
            )}

            <div>
              <label className="block text-xs text-muted mb-1">Ваше имя</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full bg-foreground/5 border border-foreground/10 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent/50"
                placeholder="Анна К."
              />
            </div>

            <div>
              <label className="block text-xs text-muted mb-1">Оценка</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" onClick={() => setRating(n)} className="p-1">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill={n <= rating ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" className="text-accent">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs text-muted mb-1">Ваш отзыв</label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                required
                rows={4}
                minLength={10}
                className="w-full bg-foreground/5 border border-foreground/10 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent/50 resize-none"
                placeholder="Поделитесь вашим опытом..."
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-accent text-background text-sm font-medium rounded-lg hover:bg-accent/90 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Отправка...' : 'Отправить на модерацию'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

/* ─── Review Section (carousel + CTA) ─── */
export function ReviewSection() {
  const [showModal, setShowModal] = useState(false);

  return (
    <div>
      <ReviewCarousel />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 mt-8 text-center">
        <p className="text-sm text-muted mb-3">Оставьте свой отзыв и получите рабочую тетрадь по тревожности</p>
        <Button onClick={() => setShowModal(true)}>Оставить отзыв</Button>
      </div>
      {showModal && <ReviewModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
export function ReviewCarousel() {
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const pausedRef = useRef(false);
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const scrollStartRef = useRef(0);
  const dragMovedRef = useRef(false);

  useEffect(() => {
    reviewsApi
      .getPublic()
      .then((data) => setReviews(data))
      .catch(() => {});

    const interval = setInterval(() => {
      reviewsApi
        .getPublic()
        .then((data) => setReviews(data))
        .catch(() => {});
    }, 30_000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || reviews.length === 0) return;

    function animate() {
      if (!el) return;
      if (!pausedRef.current && !isDraggingRef.current) {
        el.scrollLeft += 0.5;
        const halfWidth = el.scrollWidth / 3;
        if (el.scrollLeft >= halfWidth * 2) el.scrollLeft -= halfWidth;
        if (el.scrollLeft <= 0) el.scrollLeft += halfWidth;
      }
      animRef.current = requestAnimationFrame(animate);
    }

    el.scrollLeft = el.scrollWidth / 3;
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [reviews]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const el = scrollRef.current;
    if (!el) return;
    isDraggingRef.current = true;
    dragMovedRef.current = false;
    dragStartXRef.current = e.clientX;
    scrollStartRef.current = el.scrollLeft;
    el.setPointerCapture(e.pointerId);
    el.style.cursor = 'grabbing';
    el.style.userSelect = 'none';
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    const dx = e.clientX - dragStartXRef.current;
    if (Math.abs(dx) > 3) dragMovedRef.current = true;
    el.scrollLeft = scrollStartRef.current - dx;
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    const el = scrollRef.current;
    if (!el) return;
    isDraggingRef.current = false;
    el.releasePointerCapture(e.pointerId);
    el.style.cursor = 'grab';
    el.style.userSelect = '';
  }, []);

  const scroll = useCallback((dir: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: dir === 'right' ? 360 : -360, behavior: 'smooth' });
  }, []);

  if (reviews.length === 0) return null;

  const tripled = [...reviews, ...reviews, ...reviews];

  return (
    <div
      className="relative group"
      onMouseEnter={() => { pausedRef.current = true; }}
      onMouseLeave={() => { pausedRef.current = false; }}
    >
      {/* Fade edges */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-gradient-to-l from-background to-transparent" />

      {/* Nav arrows */}
      {['left', 'right'].map((dir) => (
        <button
          key={dir}
          onClick={() => scroll(dir as 'left' | 'right')}
          className={`absolute ${dir === 'left' ? 'left-3' : 'right-3'} top-1/2 z-20 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-surface/95 border border-foreground/10 text-foreground/50 shadow-md backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all hover:text-foreground hover:border-accent/30 hover:shadow-accent/10`}
          aria-label={dir === 'left' ? 'Назад' : 'Вперёд'}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            {dir === 'left'
              ? <polyline points="15 18 9 12 15 6" />
              : <polyline points="9 6 15 12 9 18" />}
          </svg>
        </button>
      ))}

      {/* Track */}
      <div
        ref={scrollRef}
        className="flex items-stretch gap-5 overflow-x-auto py-3 px-4 touch-pan-x"
        style={{ scrollbarWidth: 'none', cursor: 'grab' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {tripled.map((review, i) => (
          <div
            key={`${review.id}-${i}`}
            className="flex-shrink-0 w-[270px] sm:w-[300px]"
            onClickCapture={(e) => { if (dragMovedRef.current) e.preventDefault(); }}
          >
            <ReviewCard review={review} />
          </div>
        ))}
      </div>
    </div>
  );
}
