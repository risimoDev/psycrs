'use client';

import { useEffect, useRef, useCallback, useState, type MutableRefObject } from 'react';
import Hls from 'hls.js';

interface DrmConfig {
  mode: 'clearkey' | 'widevine';
  dashUrl: string;
  clearKeys?: Record<string, string>;
  widevineUrl?: string;
}

interface VideoPlayerProps {
  src: string;
  lessonId?: string;
  initialPosition?: number;
  onProgress?: (progress: number, currentTime: number, duration: number) => void;
  drm?: DrmConfig;
}

/* ─── Форматирование времени ─── */
function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Initialize Shaka Player for DRM playback (DASH+CENC) */
async function initShakaPlayer(
  video: HTMLVideoElement,
  drm: DrmConfig,
  initialPosition?: number,
  seekedRef?: MutableRefObject<boolean>,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shaka = (await import('shaka-player')) as any;
  shaka.polyfill.installAll();

  if (!shaka.Player.isBrowserSupported()) {
    throw new Error('Shaka Player not supported');
  }

  const player = new shaka.Player();
  await player.attach(video);

  if (drm.mode === 'clearkey' && drm.clearKeys) {
    player.configure({ drm: { clearKeys: drm.clearKeys } });
  } else if (drm.mode === 'widevine' && drm.widevineUrl) {
    player.configure({ drm: { servers: { 'com.widevine.alpha': drm.widevineUrl } } });
  }

  await player.load(drm.dashUrl);

  if (initialPosition && initialPosition > 0 && seekedRef && !seekedRef.current) {
    video.currentTime = initialPosition;
    seekedRef.current = true;
  }

  video.play().catch(() => {});
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (video as any).__shakaPlayer = player;
}

/** Initialize hls.js for standard HLS playback */
function initHlsPlayer(
  video: HTMLVideoElement,
  src: string,
  initialPosition: number | undefined,
  seekedRef: MutableRefObject<boolean>,
  hlsRef: MutableRefObject<Hls | null>,
  destroyHls: () => void,
): void {
  if (Hls.isSupported()) {
    const hls = new Hls({ maxBufferLength: 30, maxMaxBufferLength: 60, enableWorker: true });
    hls.loadSource(src);
    hls.attachMedia(video);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      if (initialPosition && initialPosition > 0 && !seekedRef.current) {
        video.currentTime = initialPosition;
        seekedRef.current = true;
      }
      video.play().catch(() => {});
    });

    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR: hls.startLoad(); break;
          case Hls.ErrorTypes.MEDIA_ERROR: hls.recoverMediaError(); break;
          default: destroyHls(); break;
        }
      }
    });

    hlsRef.current = hls;
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = src;
    video.addEventListener('loadedmetadata', () => {
      if (initialPosition && initialPosition > 0 && !seekedRef.current) {
        video.currentTime = initialPosition;
        seekedRef.current = true;
      }
      video.play().catch(() => {});
    });
  }
}

/* ─── Иконки плеера ─── */
function PlaySvg() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6.5 4.12c0-1.1 1.2-1.78 2.13-1.2l12.13 7.88c.86.56.86 1.84 0 2.4L8.63 21.08c-.93.58-2.13-.1-2.13-1.2V4.12z" />
    </svg>
  );
}

function PauseSvg() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <rect x="5" y="3" width="5" height="18" rx="1.5" />
      <rect x="14" y="3" width="5" height="18" rx="1.5" />
    </svg>
  );
}

function VolumeSvg({ muted, volume }: { muted: boolean; volume: number }) {
  if (muted || volume === 0) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" opacity="0.8" />
        <line x1="23" y1="9" x2="17" y2="15" />
        <line x1="17" y1="9" x2="23" y2="15" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" opacity="0.8" />
      {volume > 0.5 && <path d="M19.07 4.93a10 10 0 010 14.14" />}
      <path d="M15.54 8.46a5 5 0 010 7.07" />
    </svg>
  );
}

function FullscreenSvg({ isFs }: { isFs: boolean }) {
  if (isFs) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" />
    </svg>
  );
}

function SettingsSvg() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}

function PipSvg() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <rect x="12" y="9" width="8" height="6" rx="1" fill="currentColor" opacity="0.3" />
    </svg>
  );
}

/* ─── Основной компонент ─── */
export function VideoPlayer({ src, initialPosition, onProgress, drm }: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const lastReportRef = useRef(0);
  const seekedRef = useRef(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isSeeking, setIsSeeking] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  const destroyHls = useCallback(() => {
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    const video = videoRef.current;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const shaka = video && (video as any).__shakaPlayer;
    if (shaka) { shaka.destroy(); /* eslint-disable-next-line @typescript-eslint/no-explicit-any */ (video as any).__shakaPlayer = null; }
  }, []);

  // Загрузка видео
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    destroyHls();
    seekedRef.current = false;
    lastReportRef.current = 0;

    if (drm?.dashUrl) {
      initShakaPlayer(video, drm, initialPosition, seekedRef).catch(() => {
        initHlsPlayer(video, src, initialPosition, seekedRef, hlsRef, destroyHls);
      });
      return destroyHls;
    }
    initHlsPlayer(video, src, initialPosition, seekedRef, hlsRef, destroyHls);
    return destroyHls;
  }, [src, drm, destroyHls, initialPosition]);

  // Прогресс
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !onProgress) return;
    const handleTimeUpdate = () => {
      const now = Date.now();
      if (now - lastReportRef.current < 5000) return;
      lastReportRef.current = now;
      if (video.duration > 0) {
        const pct = Math.min(100, Math.round((video.currentTime / video.duration) * 100));
        onProgress(pct, video.currentTime, video.duration);
      }
    };
    const handleEnded = () => { if (video.duration > 0) onProgress(100, video.duration, video.duration); };
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);
    return () => { video.removeEventListener('timeupdate', handleTimeUpdate); video.removeEventListener('ended', handleEnded); };
  }, [onProgress]);

  // Синхронизация состояния видео → UI
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTime = () => {
      if (!isSeeking) setCurrentTime(video.currentTime);
      setDuration(video.duration || 0);
      // Буфер
      if (video.buffered.length > 0) {
        setBuffered(video.buffered.end(video.buffered.length - 1));
      }
    };
    const onVolChange = () => { setVolume(video.volume); setIsMuted(video.muted); };

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('timeupdate', onTime);
    video.addEventListener('volumechange', onVolChange);
    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('volumechange', onVolChange);
    };
  }, [isSeeking]);

  // Автоскрытие контролов
  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    clearTimeout(hideTimerRef.current);
    if (isPlaying) {
      hideTimerRef.current = setTimeout(() => setShowControls(false), 3000);
    }
  }, [isPlaying]);

  useEffect(() => { resetHideTimer(); }, [isPlaying, resetHideTimer]);

  // Fullscreen change
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Клавиатурные клавиши
  useEffect(() => {
    const video = videoRef.current;
    const container = containerRef.current;
    if (!video || !container) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key) {
        case ' ':
        case 'k': e.preventDefault(); video.paused ? video.play() : video.pause(); break;
        case 'ArrowLeft': e.preventDefault(); video.currentTime = Math.max(0, video.currentTime - 10); break;
        case 'ArrowRight': e.preventDefault(); video.currentTime = Math.min(video.duration, video.currentTime + 10); break;
        case 'ArrowUp': e.preventDefault(); video.volume = Math.min(1, video.volume + 0.1); break;
        case 'ArrowDown': e.preventDefault(); video.volume = Math.max(0, video.volume - 0.1); break;
        case 'm': e.preventDefault(); video.muted = !video.muted; break;
        case 'f': e.preventDefault(); toggleFullscreen(); break;
      }
      resetHideTimer();
    };

    container.addEventListener('keydown', handleKey);
    return () => container.removeEventListener('keydown', handleKey);
  }, [resetHideTimer]);

  /* ─── Действия ─── */
  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    v.paused ? v.play() : v.pause();
    resetHideTimer();
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
  };

  const handleVolumeChange = (val: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = val;
    v.muted = val === 0;
  };

  const handleSeek = (val: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = val;
    setCurrentTime(val);
  };

  const toggleFullscreen = () => {
    const c = containerRef.current;
    if (!c) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      c.requestFullscreen();
    }
  };

  const togglePip = async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await v.requestPictureInPicture();
      }
    } catch { /* PiP not supported */ }
  };

  const changeRate = (rate: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = rate;
    setPlaybackRate(rate);
    setShowSettings(false);
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className="group/player relative w-full aspect-video bg-black rounded-xl overflow-hidden select-none focus:outline-none"
      tabIndex={0}
      onMouseMove={resetHideTimer}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Видео */}
      <video
        ref={videoRef}
        className="w-full h-full cursor-pointer"
        playsInline
        controlsList="nodownload"
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
      />

      {/* Нажатие по центру — большая кнопка play */}
      {!isPlaying && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/15 backdrop-blur-md transition-transform hover:scale-105 active:scale-95">
            <PlaySvg />
          </div>
        </button>
      )}

      {/* Градиент снизу */}
      <div
        className={`absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/80 via-black/30 to-transparent transition-opacity duration-300 pointer-events-none ${showControls ? 'opacity-100' : 'opacity-0'}`}
      />

      {/* Контролы */}
      <div
        className={`absolute inset-x-0 bottom-0 px-4 pb-3 pt-8 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        {/* Прогрессбар */}
        <div
          className="group/seekbar relative h-1 w-full cursor-pointer rounded-full bg-white/20 mb-3 hover:h-1.5 transition-all"
          onPointerDown={(e) => {
            setIsSeeking(true);
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            handleSeek(pct * duration);
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!isSeeking) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            handleSeek(pct * duration);
          }}
          onPointerUp={() => setIsSeeking(false)}
        >
          {/* Буфер */}
          <div className="absolute inset-y-0 left-0 rounded-full bg-white/15" style={{ width: `${bufferedPct}%` }} />
          {/* Прогресс */}
          <div className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${progress}%` }} />
          {/* Ползунок */}
          <div
            className="absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-accent shadow-md shadow-black/30 opacity-0 group-hover/seekbar:opacity-100 transition-opacity"
            style={{ left: `${progress}%`, transform: `translate(-50%, -50%)` }}
          />
        </div>

        {/* Нижняя строка контролов */}
        <div className="flex items-center gap-2 text-white">
          {/* Play/Pause */}
          <button onClick={togglePlay} className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-white/10 transition-colors" aria-label={isPlaying ? 'Пауза' : 'Воспроизвести'}>
            {isPlaying ? <PauseSvg /> : <PlaySvg />}
          </button>

          {/* Звук */}
          <div className="flex items-center gap-1.5 group/vol">
            <button onClick={toggleMute} className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-white/10 transition-colors" aria-label={isMuted ? 'Включить звук' : 'Выключить звук'}>
              <VolumeSvg muted={isMuted} volume={volume} />
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={(e) => handleVolumeChange(Number(e.target.value))}
              className="w-0 overflow-hidden group-hover/vol:w-16 transition-all duration-200 accent-accent h-1 cursor-pointer"
              aria-label="Громкость"
            />
          </div>

          {/* Время */}
          <span className="text-xs tabular-nums text-white/70 ml-1">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          <div className="flex-1" />

          {/* Скорость */}
          <div className="relative">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="flex h-8 items-center gap-1 rounded-md px-2 text-xs hover:bg-white/10 transition-colors"
              aria-label="Настройки"
            >
              {playbackRate !== 1 && <span className="text-accent text-[11px] font-medium">{playbackRate}x</span>}
              <SettingsSvg />
            </button>

            {showSettings && (
              <div className="absolute bottom-full right-0 mb-2 rounded-lg bg-black/90 backdrop-blur-xl border border-white/10 p-1.5 min-w-[120px]">
                <p className="text-[10px] text-white/40 uppercase tracking-wider px-2.5 pt-1 pb-1.5">Скорость</p>
                {[0.5, 0.75, 1, 1.25, 1.5, 2].map((r) => (
                  <button
                    key={r}
                    onClick={() => changeRate(r)}
                    className={`block w-full text-left rounded-md px-2.5 py-1.5 text-xs transition-colors ${
                      playbackRate === r ? 'bg-accent/20 text-accent' : 'text-white/80 hover:bg-white/10'
                    }`}
                  >
                    {r === 1 ? 'Обычная' : `${r}x`}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* PiP */}
          <button onClick={togglePip} className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-white/10 transition-colors" aria-label="Картинка в картинке">
            <PipSvg />
          </button>

          {/* Fullscreen */}
          <button onClick={toggleFullscreen} className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-white/10 transition-colors" aria-label={isFullscreen ? 'Выйти из полноэкранного' : 'Полный экран'}>
            <FullscreenSvg isFs={isFullscreen} />
          </button>
        </div>
      </div>
    </div>
  );
}
