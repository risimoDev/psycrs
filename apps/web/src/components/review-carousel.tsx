'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface Review {
  id: string;
  name: string;
  role: string | null;
  text: string | null;
  imageUrl: string | null;
}

export function ReviewCarousel() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const speedRef = useRef(0.5);
  const pausedRef = useRef(false);
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const scrollStartRef = useRef(0);
  const dragMovedRef = useRef(false);

  useEffect(() => {
    fetch(`${API_BASE}/reviews`)
      .then((r) => r.json())
      .then((data: Review[]) => setReviews(data))
      .catch(() => {});
  }, []);

  // Infinite auto-scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || reviews.length === 0) return;

    function animate() {
      if (!el) return;
      if (!pausedRef.current && !isDraggingRef.current) {
        el.scrollLeft += speedRef.current;
        const halfWidth = el.scrollWidth / 3;
        if (el.scrollLeft >= halfWidth * 2) {
          el.scrollLeft -= halfWidth;
        }
        if (el.scrollLeft <= 0) {
          el.scrollLeft += halfWidth;
        }
      }
      animRef.current = requestAnimationFrame(animate);
    }

    // Start from the middle set
    el.scrollLeft = el.scrollWidth / 3;
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [reviews]);

  // Mouse drag handlers
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

  const scroll = useCallback((direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = 380;
    el.scrollBy({ left: direction === 'right' ? amount : -amount, behavior: 'smooth' });
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
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-background to-transparent" />

      {/* Navigation arrows */}
      <button
        onClick={() => scroll('left')}
        className="absolute left-2 top-1/2 z-20 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-surface/90 border border-foreground/10 text-foreground/60 shadow-md backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity hover:text-foreground hover:border-accent/30"
        aria-label="Предыдущий отзыв"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="15 18 9 12 15 6" /></svg>
      </button>
      <button
        onClick={() => scroll('right')}
        className="absolute right-2 top-1/2 z-20 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-surface/90 border border-foreground/10 text-foreground/60 shadow-md backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity hover:text-foreground hover:border-accent/30"
        aria-label="Следующий отзыв"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="9 6 15 12 9 18" /></svg>
      </button>

      <div
        ref={scrollRef}
        className="flex gap-6 overflow-x-auto py-2 touch-pan-x"
        style={{ scrollbarWidth: 'none', cursor: 'grab', WebkitOverflowScrolling: 'touch' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {tripled.map((review, i) => (
          <div
            key={`${review.id}-${i}`}
            className="flex-shrink-0 w-[280px] sm:w-[320px]"
            onClickCapture={(e) => { if (dragMovedRef.current) e.preventDefault(); }}
          >
            {review.imageUrl ? (
              <div className="rounded-2xl border border-foreground/5 bg-surface overflow-hidden card-shadow hover:shadow-lg transition-shadow select-none">
                <img
                  src={`${API_BASE}${review.imageUrl}`}
                  alt={`Отзыв от ${review.name}`}
                  className="w-full aspect-[4/5] object-cover pointer-events-none"
                  loading="lazy"
                  draggable={false}
                />
                <div className="px-5 py-4">
                  <p className="text-sm font-medium text-foreground">{review.name}</p>
                  {review.role && (
                    <p className="text-xs text-muted mt-0.5">{review.role}</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-foreground/5 bg-surface p-6 h-full select-none card-shadow hover:shadow-lg transition-shadow">
                <div className="mb-4 flex gap-0.5">
                  {[...Array(5)].map((_, j) => (
                    <svg key={j} width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-accent/70">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  ))}
                </div>
                {review.text && (
                  <p className="text-[13px] leading-relaxed text-muted">
                    {review.text}
                  </p>
                )}
                <div className="mt-5 pt-4 border-t border-foreground/5">
                  <p className="text-sm font-medium">{review.name}</p>
                  {review.role && <p className="text-xs text-muted mt-0.5">{review.role}</p>}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
