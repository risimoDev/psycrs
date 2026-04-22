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

function StarRow() {
  return (
    <div className="flex gap-0.5 mb-4">
      {[...Array(5)].map((_, i) => (
        <svg key={i} width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className="text-accent">
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

function TextCard({ review }: { review: Review }) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-foreground/8 bg-surface p-5 select-none transition-all duration-200 hover:border-accent/20 hover:shadow-lg hover:shadow-accent/5">
      {/* Quote mark */}
      <svg className="mb-3 text-accent/30" width="28" height="20" viewBox="0 0 28 20" fill="currentColor">
        <path d="M0 20V12.5C0 5.833 3.333 1.667 10 0l1.5 2.5C8.667 3.667 7 5.833 7 8.5H12V20H0ZM16 20V12.5C16 5.833 19.333 1.667 26 0l1.5 2.5C24.667 3.667 23 5.833 23 8.5H28V20H16Z" />
      </svg>

      <StarRow />

      {review.text && (
        <p className="flex-1 text-[13.5px] leading-relaxed text-foreground/70 line-clamp-6">
          {review.text}
        </p>
      )}

      <div className="mt-5 flex items-center gap-3 border-t border-foreground/6 pt-4">
        <Initials name={review.name} />
        <div>
          <p className="text-[13px] font-semibold text-foreground">{review.name}</p>
          {review.role && <p className="text-[11px] text-muted mt-0.5">{review.role}</p>}
        </div>
      </div>
    </div>
  );
}

function ImageCard({ review }: { review: Review }) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const src = `${API_BASE}${review.imageUrl}`;

  if (errored) return <TextCard review={review} />;

  return (
    <div className="flex h-full flex-col rounded-2xl border border-foreground/8 bg-surface overflow-hidden select-none transition-all duration-200 hover:border-accent/20 hover:shadow-lg hover:shadow-accent/5">
      {/* Image */}
      <div className="relative w-full overflow-hidden" style={{ aspectRatio: '3/4' }}>
        {!loaded && (
          <div className="absolute inset-0 bg-foreground/5 animate-pulse" />
        )}
        <img
          src={src}
          alt={`Отзыв от ${review.name}`}
          className={`w-full h-full object-cover pointer-events-none transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          loading="lazy"
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
        />
      </div>

      {/* Footer */}
      <div className="px-4 py-3 flex items-center gap-2.5 border-t border-foreground/6">
        <Initials name={review.name} />
        <div>
          <p className="text-[13px] font-semibold text-foreground">{review.name}</p>
          {review.role && <p className="text-[11px] text-muted mt-0.5">{review.role}</p>}
        </div>
      </div>
    </div>
  );
}

function ReviewCard({ review }: { review: Review }) {
  if (review.imageUrl) return <ImageCard review={review} />;
  return <TextCard review={review} />;
}

export function ReviewCarousel() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
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
