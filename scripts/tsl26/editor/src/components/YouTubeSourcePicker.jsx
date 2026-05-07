import React, { useEffect, useRef, useState } from 'react';
import { Clock } from 'lucide-react';

export function YouTubeSourcePicker({ youtubeId, onCapture }) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    if (!youtubeId || !containerRef.current) return undefined;

    let cancelled = false;
    let pollHandle = null;

    function pollTime() {
      const t = playerRef.current?.getCurrentTime?.();
      if (typeof t === 'number') setCurrentTime(t);
      pollHandle = window.setTimeout(pollTime, 250);
    }

    function createPlayer() {
      if (cancelled || !containerRef.current) return;
      containerRef.current.innerHTML = '';
      const target = document.createElement('div');
      target.style.width = '100%';
      target.style.height = '100%';
      containerRef.current.appendChild(target);
      playerRef.current = new window.YT.Player(target, {
        videoId: youtubeId,
        width: '100%',
        height: '100%',
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onReady: () => {
            pollTime();
          },
        },
      });
    }

    if (window.YT?.Player) {
      createPlayer();
    } else {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previous?.();
        createPlayer();
      };
      if (!document.querySelector('script[data-yt-iframe-api]')) {
        const script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        script.dataset.ytIframeApi = '1';
        document.head.appendChild(script);
      }
    }

    return () => {
      cancelled = true;
      if (pollHandle) window.clearTimeout(pollHandle);
      try { playerRef.current?.destroy?.(); } catch { /* noop */ }
      playerRef.current = null;
    };
  }, [youtubeId]);

  function capture() {
    const value = playerRef.current?.getCurrentTime?.();
    if (typeof value === 'number') onCapture(Number(value.toFixed(2)));
  }

  return (
    <div className="ytPicker">
      <div className="ytPlayer" ref={containerRef} />
      <div className="ytPickerControls">
        <span className="ytTime">
          <Clock size={14} /> {currentTime.toFixed(2)}s
        </span>
        <button type="button" onClick={capture}>
          Usar este instante como inicio
        </button>
      </div>
    </div>
  );
}
