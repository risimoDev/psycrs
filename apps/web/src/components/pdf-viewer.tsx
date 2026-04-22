'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface PdfViewerProps {
  /** Fully-qualified URL with the article token in the query string. */
  url: string;
  title: string;
}

// ─── Icons ────────────────────────────────────────────────

function ChevronLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function ZoomIn() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  );
}

function ZoomOut() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  );
}

// ─── Main component ───────────────────────────────────────

export function PdfViewer({ url, title }: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderTaskRef = useRef<any>(null);

  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [naturalScale, setNaturalScale] = useState(1.0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRenderingPage, setIsRenderingPage] = useState(false);
  const [isError, setIsError] = useState(false);

  // ── Load PDF (one fetch = full ArrayBuffer, no range requests needed) ──
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setIsError(false);
    pdfRef.current = null;
    setNumPages(0);
    setCurrentPage(1);

    async function load() {
      try {
        // Dynamic import keeps the ~800 kB pdf.js out of the initial bundle
        const pdfjsLib = await import('pdfjs-dist');

        // pdfjs-dist v4.x ships ESM workers (.mjs). Use jsDelivr which mirrors
        // every npm release — this is more reliable than cdnjs for new patch versions.
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

        // Fetch entire PDF as ArrayBuffer — single request, no streaming
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buffer = await res.arrayBuffer();
        if (cancelled) return;

        const pdfDoc = await pdfjsLib.getDocument({ data: buffer }).promise;
        if (cancelled) { pdfDoc.destroy(); return; }

        // Calculate a "fit-width" scale from the first page
        const page = await pdfDoc.getPage(1);
        const viewport = page.getViewport({ scale: 1 });
        const containerWidth = containerRef.current?.clientWidth ?? 700;
        const fitScale = Math.min((containerWidth - 32) / viewport.width, 2.0);

        pdfRef.current = pdfDoc;
        setNaturalScale(fitScale);
        setScale(fitScale);
        setNumPages(pdfDoc.numPages);
        setIsLoading(false);
      } catch {
        if (!cancelled) setIsError(true);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [url]);

  // ── Render current page to canvas ──────────────────────
  const renderPage = useCallback(
    async (pageNum: number, pageScale: number) => {
      const pdf = pdfRef.current;
      const canvas = canvasRef.current;
      if (!pdf || !canvas) return;

      // Cancel any in-flight render task to avoid torn frames
      if (renderTaskRef.current) {
        try { renderTaskRef.current.cancel(); } catch { /* ignore */ }
        renderTaskRef.current = null;
      }

      setIsRenderingPage(true);
      try {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: pageScale });

        const devicePixelRatio = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
        canvas.width = Math.round(viewport.width * devicePixelRatio);
        canvas.height = Math.round(viewport.height * devicePixelRatio);
        canvas.style.width = `${Math.round(viewport.width)}px`;
        canvas.style.height = `${Math.round(viewport.height)}px`;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);

        const task = page.render({ canvasContext: ctx, viewport });
        renderTaskRef.current = task;
        await task.promise;
      } catch (err: unknown) {
        // RenderingCancelledException is expected when we cancel — ignore
        if (err instanceof Error && err.name === 'RenderingCancelledException') return;
      } finally {
        setIsRenderingPage(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!isLoading && pdfRef.current) {
      renderPage(currentPage, scale);
    }
  }, [currentPage, scale, isLoading, renderPage]);

  // ── Controls ────────────────────────────────────────────
  const prevPage = () => setCurrentPage((p) => Math.max(1, p - 1));
  const nextPage = () => setCurrentPage((p) => Math.min(numPages, p + 1));
  const zoomIn = () => setScale((s) => Math.min(s + 0.25, 4.0));
  const zoomOut = () => setScale((s) => Math.max(s - 0.25, 0.5));
  const resetZoom = () => setScale(naturalScale);

  // ── Loading state ───────────────────────────────────────
  if (isLoading && !isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl bg-foreground/[0.03] border border-foreground/10 py-20">
        <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
        <p className="text-sm font-body text-foreground/40">Загрузка статьи…</p>
      </div>
    );
  }

  // ── Error state ─────────────────────────────────────────
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl bg-foreground/[0.03] border border-foreground/10 py-16 px-8 text-center">
        <svg className="h-10 w-10 text-foreground/20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
        </svg>
        <p className="text-sm font-body text-foreground/40">Не удалось загрузить статью</p>
        <p className="text-xs font-body text-foreground/25">Попробуйте обновить страницу</p>
      </div>
    );
  }

  // ── Viewer ──────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className="rounded-2xl border border-foreground/10 bg-[#1a1a1a] overflow-hidden"
      // Prevent right-click on the canvas
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.07] bg-black/30 px-3 py-2">
        {/* Page navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={prevPage}
            disabled={currentPage <= 1}
            className="flex h-7 w-7 items-center justify-center rounded-md text-white/50 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Предыдущая страница"
          >
            <ChevronLeft />
          </button>
          <span className="min-w-[72px] text-center text-xs font-body text-white/50 tabular-nums">
            {currentPage} / {numPages}
          </span>
          <button
            onClick={nextPage}
            disabled={currentPage >= numPages}
            className="flex h-7 w-7 items-center justify-center rounded-md text-white/50 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Следующая страница"
          >
            <ChevronRight />
          </button>
        </div>

        {/* Title (truncated) */}
        <span className="hidden sm:block flex-1 text-center text-xs font-body text-white/30 truncate px-3 select-none">
          {title}
        </span>

        {/* Zoom controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={zoomOut}
            disabled={scale <= 0.5}
            className="flex h-7 w-7 items-center justify-center rounded-md text-white/50 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Уменьшить"
          >
            <ZoomOut />
          </button>
          <button
            onClick={resetZoom}
            className="min-w-[48px] text-center rounded-md px-2 py-1 text-xs font-body font-medium text-white/50 transition-colors hover:bg-white/10 hover:text-white tabular-nums"
            title="Сбросить масштаб"
          >
            {Math.round(scale / naturalScale * 100)}%
          </button>
          <button
            onClick={zoomIn}
            disabled={scale >= 4.0}
            className="flex h-7 w-7 items-center justify-center rounded-md text-white/50 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Увеличить"
          >
            <ZoomIn />
          </button>
        </div>
      </div>

      {/* Canvas viewport */}
      <div className="overflow-auto" style={{ maxHeight: 'min(78vh, 860px)' }}>
        {/* Print protection overlay */}
        <style>{`@media print { .pdf-viewer-canvas-wrap { display: none !important; } }`}</style>
        <div className="pdf-viewer-canvas-wrap flex justify-center p-4 select-none">
          <div className="relative">
            <canvas
              ref={canvasRef}
              className="shadow-2xl shadow-black/40"
              style={{ display: 'block', userSelect: 'none' }}
            />
            {/* Dim overlay while a new page renders to avoid flicker */}
            {isRenderingPage && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded">
                <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom navigation (convenient for long PDFs) */}
      {numPages > 1 && (
        <div className="flex items-center justify-center gap-3 border-t border-white/[0.07] bg-black/20 py-2">
          <button
            onClick={prevPage}
            disabled={currentPage <= 1}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-body font-medium text-white/40 transition-colors hover:bg-white/8 hover:text-white disabled:opacity-25 disabled:cursor-not-allowed"
          >
            <ChevronLeft /> Назад
          </button>
          <span className="text-xs font-body text-white/25 tabular-nums">
            {currentPage} из {numPages}
          </span>
          <button
            onClick={nextPage}
            disabled={currentPage >= numPages}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-body font-medium text-white/40 transition-colors hover:bg-white/8 hover:text-white disabled:opacity-25 disabled:cursor-not-allowed"
          >
            Вперёд <ChevronRight />
          </button>
        </div>
      )}
    </div>
  );
}
