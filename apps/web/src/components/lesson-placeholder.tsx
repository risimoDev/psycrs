'use client';

/**
 * Deterministic SVG placeholder for lessons without a thumbnail.
 * The shapes, positions, and colour accent are derived from the lesson ID,
 * so each lesson always renders the same unique pattern.
 */

// Site palette — warm amber / forest-green accent tones
const PALETTES = [
  { bg: '#1a1208', shapes: ['#c8944a', '#a67c52', '#7a5c38', '#e8b87a'] },
  { bg: '#0e1a14', shapes: ['#4a8c6a', '#3d6b4f', '#2a4f38', '#6ab890'] },
  { bg: '#130d1a', shapes: ['#8a5cbf', '#6b4a9a', '#4d3673', '#b07de0'] },
  { bg: '#1a0e0e', shapes: ['#c05050', '#943838', '#6e2828', '#e07878'] },
  { bg: '#0d1420', shapes: ['#4a6e9a', '#385478', '#264060', '#7aaad0'] },
];

/** Lightweight xorshift32 PRNG seeded from a string */
function prng(seed: string) {
  let state = 0;
  for (let i = 0; i < seed.length; i++) {
    state ^= seed.charCodeAt(i) << (i % 24);
    state = (state ^ (state >>> 13)) | 0;
    state = (state ^ (state << 17)) | 0;
    state = (state ^ (state >>> 5)) | 0;
  }
  if (state === 0) state = 1;

  return {
    next(): number {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      return ((state >>> 0) / 4294967296);
    },
    int(min: number, max: number): number {
      return Math.floor(this.next() * (max - min + 1)) + min;
    },
    pick<T>(arr: T[]): T {
      return arr[Math.floor(this.next() * arr.length)] as T;
    },
  };
}

interface Props {
  id: string;
  className?: string;
}

export function LessonPlaceholder({ id, className = '' }: Props) {
  const rng = prng(id);

  const palette = PALETTES[rng.int(0, PALETTES.length - 1)]!
  const W = 400;
  const H = 400;

  // ── Generate shapes ───────────────────────────────────
  type Shape =
    | { kind: 'circle'; cx: number; cy: number; r: number; fill: string; opacity: number }
    | { kind: 'ring'; cx: number; cy: number; r: number; stroke: string; sw: number; opacity: number }
    | { kind: 'line'; x1: number; y1: number; x2: number; y2: number; stroke: string; sw: number; opacity: number }
    | { kind: 'rect'; x: number; y: number; w: number; h: number; rx: number; fill: string; opacity: number; rotate: number };

  const shapes: Shape[] = [];

  // 2-3 large soft circles (blobs)
  const blobCount = rng.int(2, 3);
  for (let i = 0; i < blobCount; i++) {
    shapes.push({
      kind: 'circle',
      cx: rng.int(-40, W + 40),
      cy: rng.int(-40, H + 40),
      r: rng.int(80, 180),
      fill: rng.pick(palette.shapes),
      opacity: rng.next() * 0.12 + 0.04,
    });
  }

  // 2-4 rings
  const ringCount = rng.int(2, 4);
  for (let i = 0; i < ringCount; i++) {
    shapes.push({
      kind: 'ring',
      cx: rng.int(20, W - 20),
      cy: rng.int(20, H - 20),
      r: rng.int(30, 120),
      stroke: rng.pick(palette.shapes),
      sw: rng.int(1, 3),
      opacity: rng.next() * 0.25 + 0.08,
    });
  }

  // 3-5 diagonal lines
  const lineCount = rng.int(3, 5);
  for (let i = 0; i < lineCount; i++) {
    const x1 = rng.int(-20, W + 20);
    const y1 = rng.int(-20, H + 20);
    const len = rng.int(80, 280);
    const angle = rng.next() * Math.PI * 2;
    shapes.push({
      kind: 'line',
      x1,
      y1,
      x2: x1 + Math.cos(angle) * len,
      y2: y1 + Math.sin(angle) * len,
      stroke: rng.pick(palette.shapes),
      sw: rng.int(1, 2),
      opacity: rng.next() * 0.2 + 0.06,
    });
  }

  // 1-3 rotated rectangles
  const rectCount = rng.int(1, 3);
  for (let i = 0; i < rectCount; i++) {
    const w = rng.int(30, 110);
    const h = rng.int(20, 80);
    shapes.push({
      kind: 'rect',
      x: rng.int(20, W - 20) - w / 2,
      y: rng.int(20, H - 20) - h / 2,
      w,
      h,
      rx: rng.int(4, 16),
      fill: rng.pick(palette.shapes),
      opacity: rng.next() * 0.12 + 0.04,
      rotate: rng.int(-45, 45),
    });
  }

  // Shuffle shapes for layering
  for (let i = shapes.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    const tmp = shapes[i]!;
    shapes[i] = shapes[j]!;
    shapes[j] = tmp;
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect width={W} height={H} fill={palette.bg} />
      {shapes.map((s, i) => {
        if (s.kind === 'circle') {
          return (
            <circle
              key={i}
              cx={s.cx}
              cy={s.cy}
              r={s.r}
              fill={s.fill}
              opacity={s.opacity}
            />
          );
        }
        if (s.kind === 'ring') {
          return (
            <circle
              key={i}
              cx={s.cx}
              cy={s.cy}
              r={s.r}
              fill="none"
              stroke={s.stroke}
              strokeWidth={s.sw}
              opacity={s.opacity}
            />
          );
        }
        if (s.kind === 'line') {
          return (
            <line
              key={i}
              x1={s.x1}
              y1={s.y1}
              x2={s.x2}
              y2={s.y2}
              stroke={s.stroke}
              strokeWidth={s.sw}
              opacity={s.opacity}
              strokeLinecap="round"
            />
          );
        }
        if (s.kind === 'rect') {
          return (
            <rect
              key={i}
              x={s.x}
              y={s.y}
              width={s.w}
              height={s.h}
              rx={s.rx}
              fill={s.fill}
              opacity={s.opacity}
              transform={`rotate(${s.rotate} ${s.x + s.w / 2} ${s.y + s.h / 2})`}
            />
          );
        }
        return null;
      })}
      {/* Vignette overlay for depth */}
      <radialGradient id={`vg-${id}`} cx="50%" cy="50%" r="70%">
        <stop offset="0%" stopColor="transparent" />
        <stop offset="100%" stopColor="#000000" stopOpacity="0.45" />
      </radialGradient>
      <rect width={W} height={H} fill={`url(#vg-${id})`} />
    </svg>
  );
}
