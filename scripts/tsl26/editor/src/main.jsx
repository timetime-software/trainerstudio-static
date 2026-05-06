import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Clock, EyeOff, FileVideo, Play, Save, Scissors, Search, Sparkles, Star } from 'lucide-react';
import './styles.css';

const emptyStatus = { sourceClip: false, defaultClip: false, downloadedOriginals: [], arkTask: null };

function asLines(value) {
  return Array.isArray(value) ? value.join('\n') : '';
}

function fromLines(value) {
  return value.split('\n').map((line) => line.trim()).filter(Boolean);
}

function uniqueOptions(exercises, getter) {
  return [...new Set(exercises.flatMap((exercise) => getter(exercise) || []).filter((value) => String(value || '').trim()))].sort();
}

function toOptionLabel(value) {
  return String(value).replace(/_/g, ' ');
}

function SelectField({ label, value, options, onChange, allowBlank = true }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const filtered = options.filter((option) => toOptionLabel(option).toLowerCase().includes(query.trim().toLowerCase()));

  function choose(option) {
    onChange(option);
    setOpen(false);
    setQuery('');
  }

  return (
    <div className="comboField">
      <span>{label}</span>
      <button type="button" className="comboButton" onClick={() => setOpen((current) => !current)}>
        {value ? toOptionLabel(value) : 'Select value'}
      </button>
      {open && (
        <div className="comboMenu">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
            autoFocus
          />
          <div className="comboOptions">
            {allowBlank && (
              <button
                type="button"
                className={!value ? 'comboOption selected' : 'comboOption'}
                onClick={() => choose('')}
              >
                <span>none</span>
                {!value && <Check size={14} />}
              </button>
            )}
            {filtered.map((option) => (
              <button
                type="button"
                key={option}
                className={value === option ? 'comboOption selected' : 'comboOption'}
                onClick={() => choose(option)}
              >
                <span>{toOptionLabel(option)}</span>
                {value === option && <Check size={14} />}
              </button>
            ))}
            {!filtered.length && <div className="emptyOptions">No matches</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function MultiSelectField({ label, value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = Array.isArray(value) ? value : [];
  const selectedSet = new Set(selected);
  const filtered = options.filter((option) => toOptionLabel(option).toLowerCase().includes(query.trim().toLowerCase()));

  function toggle(option) {
    if (selectedSet.has(option)) {
      onChange(selected.filter((item) => item !== option));
    } else {
      onChange([...selected, option]);
    }
  }

  return (
    <div className="comboField">
      <span>{label}</span>
      <button type="button" className="comboButton" onClick={() => setOpen((current) => !current)}>
        {selected.length ? selected.map(toOptionLabel).join(', ') : 'Select values'}
      </button>
      {open && (
        <div className="comboMenu">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
            autoFocus
          />
          <div className="comboOptions">
            {filtered.map((option) => (
              <button
                type="button"
                key={option}
                className={selectedSet.has(option) ? 'comboOption selected' : 'comboOption'}
                onClick={() => toggle(option)}
              >
                <span>{toOptionLabel(option)}</span>
                {selectedSet.has(option) && <Check size={14} />}
              </button>
            ))}
            {!filtered.length && <div className="emptyOptions">No matches</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function mediaFor(exercise) {
  const media = Array.isArray(exercise?.media) ? exercise.media : [];
  const images = Array.isArray(exercise?.images) ? exercise.images.map((url) => ({ type: 'image', url })) : [];
  return [...media, ...images].filter((item) => item?.url);
}

function firstVideo(exercise) {
  return mediaFor(exercise).find((item) => item.type === 'video' || item.url.includes('youtube.com/embed') || item.url.endsWith('.mp4'));
}

function videoBySource(exercise, source) {
  return mediaFor(exercise).find((item) => item.type === 'video' && item.source === source);
}

function firstImage(exercise) {
  return mediaFor(exercise).find((item) => item.type === 'image' || item.thumbnailUrl || /\.(png|jpe?g|webp)$/i.test(item.url));
}

function hasDefaultVideo(exercise) {
  return mediaFor(exercise).some((item) => item.type === 'video' && item.source === 'uploaded');
}

function defaultIndicatorFor(exercise) {
  if (exercise?.metadata?.defaultVideoInvalid) {
    return { className: 'invalidDefault', label: 'Default invalid' };
  }
  if (exercise?.metadata?.reviewed) {
    return { className: 'validated', label: 'Validated' };
  }
  if (hasDefaultVideo(exercise)) {
    return { className: 'hasDefault', label: 'Default ready' };
  }
  return { className: 'missingDefault', label: 'Missing default' };
}

function updateExercise(exercise, patch) {
  return {
    ...exercise,
    ...patch,
    i18n: {
      ...exercise.i18n,
      ...(patch.i18n || {}),
    },
    classification: {
      ...exercise.classification,
      ...(patch.classification || {}),
    },
    metadata: {
      ...exercise.metadata,
      ...(patch.metadata || {}),
    },
  };
}

function isYoutubeMedia(item) {
  return item?.source === 'youtube' || /(?:youtube\.com|youtu\.be|img\.youtube\.com)/i.test(item?.url || item?.thumbnailUrl || '');
}

function extractYoutubeId(input) {
  if (!input) return '';
  const trimmed = String(input).trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/(?:youtube\.com\/(?:embed\/|watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
  return match?.[1] || '';
}

function extractYoutubeStart(input) {
  if (!input) return null;
  const match = String(input).match(/[?&](?:t|start)=([0-9]+(?:\.[0-9]+)?)(?:s|$|&)/i);
  return match ? Number(match[1]) : null;
}

function youtubeIdFromExercise(exercise) {
  const stored = exercise?.metadata?.sourceClip?.youtubeId;
  if (stored) return stored;
  const media = mediaFor(exercise).find((item) => isYoutubeMedia(item));
  return extractYoutubeId(media?.url || media?.thumbnailUrl || '');
}

function YouTubeSourcePicker({ youtubeId, onCapture }) {
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

function idFromUrl() {
  return new URLSearchParams(window.location.search).get('id') || '';
}

function App() {
  const [exercises, setExercises] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [mediaVariant, setMediaVariant] = useState('default');
  const [status, setStatus] = useState(emptyStatus);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState('');
  const [log, setLog] = useState('');
  const [paths, setPaths] = useState({});
  const [librarySlugs, setLibrarySlugs] = useState([]);
  const [libraryRelation, setLibraryRelation] = useState(null);
  const [editorTab, setEditorTab] = useState('main');
  const [arkApiKey, setArkApiKey] = useState(() => localStorage.getItem('tsl26.arkApiKey') || '');
  const [ytInput, setYtInput] = useState('');
  const [ytId, setYtId] = useState('');
  const [ytTitle, setYtTitle] = useState('');
  const [ytChannel, setYtChannel] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [clipStart, setClipStart] = useState(0);
  const [clipDuration, setClipDuration] = useState(4);
  const [savingClip, setSavingClip] = useState(false);
  const [mediaRefreshKey, setMediaRefreshKey] = useState(0);
  const [sourceMode, setSourceMode] = useState('ai');
  const [defaceMode, setDefaceMode] = useState(() => localStorage.getItem('tsl26.defaceMode') || 'solid');
  const [defaceThresh, setDefaceThresh] = useState(() => Number(localStorage.getItem('tsl26.defaceThresh')) || 0.15);
  const [defaceMaskScale, setDefaceMaskScale] = useState(() => Number(localStorage.getItem('tsl26.defaceMaskScale')) || 2);
  const [defaceMosaicSize, setDefaceMosaicSize] = useState(() => Number(localStorage.getItem('tsl26.defaceMosaicSize')) || 20);
  const [defacePasses, setDefacePasses] = useState(() => Number(localStorage.getItem('tsl26.defacePasses')) || 1);
  const [defaceKeepOriginal, setDefaceKeepOriginal] = useState(() => localStorage.getItem('tsl26.defaceKeepOriginal') === 'true');

  async function loadExercises(preferredId = idFromUrl()) {
    const data = await fetch('/api/exercises')
      .then((res) => res.json())
    const slugs = data.librarySlugs || [];
    const queryExercise = data.exercises.find((exercise) => exercise.id === preferredId);
    const firstLibraryExercise = data.exercises.find((exercise) => slugs[0] && (exercise.cdnslug || exercise.cdnSlug) === slugs[0]);
    setExercises(data.exercises);
    setSelectedId(queryExercise?.id || firstLibraryExercise?.id || data.exercises[0]?.id || '');
    setLibrarySlugs(slugs);
    setLibraryRelation(data.libraryRelation || null);
    setPaths({ jsonPath: data.jsonPath, ndjsonPath: data.ndjsonPath });
    return data;
  }

  useEffect(() => {
    loadExercises();
  }, []);

  const selected = exercises.find((exercise) => exercise.id === selectedId) || exercises[0];

  function selectExercise(id, replace = false) {
    if (!id || id === selectedId) return;
    setSelectedId(id);
    const url = new URL(window.location.href);
    url.searchParams.set('id', id);
    window.history[replace ? 'replaceState' : 'pushState']({}, '', url);
  }

  useEffect(() => {
    if (!selected?.id) return;
    const urlId = idFromUrl();
    if (urlId !== selected.id) {
      selectExercise(selected.id, true);
    }
  }, [selected?.id]);

  useEffect(() => {
    function handlePopState() {
      const id = idFromUrl();
      if (id && exercises.some((exercise) => exercise.id === id)) {
        setSelectedId(id);
      }
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [exercises]);

  async function refreshStatus(id = selected?.id) {
    if (!id) return;
    const res = await fetch(`/api/media/status?id=${encodeURIComponent(id)}`);
    const data = await res.json();
    setStatus(data.status || emptyStatus);
  }

  useEffect(() => {
    if (!selected?.id) return;
    refreshStatus(selected.id);
  }, [selected?.id, running]);

  useEffect(() => {
    if (!selected?.id) return;
    const stored = selected.metadata?.sourceClip;
    const id = stored?.youtubeId || youtubeIdFromExercise(selected) || '';
    setYtId(id);
    setYtTitle(stored?.title || '');
    setYtChannel(stored?.channel || '');
    setYtInput(id ? `https://www.youtube.com/watch?v=${id}` : '');
    setClipStart(Number.isFinite(stored?.start) ? stored.start : 0);
    setClipDuration(Number.isFinite(stored?.duration) ? stored.duration : 4);
    setSearchQuery('');
    setSearchResults([]);
    setSourceMode('ai');
  }, [selected?.id]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const libraryOrder = new Map(librarySlugs.map((slug, index) => [slug, index]));
    const librarySlugSet = new Set(librarySlugs);
    return exercises.filter((exercise) => {
      const slug = exercise.cdnslug || exercise.cdnSlug;
      const haystack = [
        exercise.id,
        exercise.cdnslug,
        exercise.name,
        exercise.i18n?.name?.es,
        exercise.category,
        exercise.equipment,
        ...(exercise.primaryMuscles || []),
        ...(exercise.aliases || []),
      ].join(' ').toLowerCase();
      const matchesTerm = !term || haystack.includes(term);
      const matchesFilter =
        filter === 'all' ||
        (filter === 'priority' && exercise.priority === true) ||
        (filter === 'invalidDefault' && exercise.metadata?.defaultVideoInvalid === true) ||
        (filter === 'library' && librarySlugSet.has(slug)) ||
        (filter === 'notInLibrary' && !librarySlugSet.has(slug)) ||
        (filter === 'missingFolder' && slug && !librarySlugSet.has(slug)) ||
        (filter === 'youtube' && firstVideo(exercise)?.url?.includes('youtube')) ||
        (filter === 'missingDefault' && !exercise.media?.some((item) => item.source === 'uploaded')) ||
        (filter === 'reviewed' && exercise.metadata?.reviewed === true) ||
        (filter === 'pendingReview' && exercise.metadata?.reviewed !== true) ||
        (filter === 'inactive' && exercise.isActive === false);
      return matchesTerm && matchesFilter;
    }).sort((a, b) => {
      const aSlug = a.cdnslug || a.cdnSlug;
      const bSlug = b.cdnslug || b.cdnSlug;
      const aOrder = libraryOrder.has(aSlug) ? libraryOrder.get(aSlug) : Number.MAX_SAFE_INTEGER;
      const bOrder = libraryOrder.has(bSlug) ? libraryOrder.get(bSlug) : Number.MAX_SAFE_INTEGER;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [exercises, filter, librarySlugs, query]);

  const options = useMemo(() => ({
    categories: uniqueOptions(exercises, (exercise) => [exercise.category]),
    levels: uniqueOptions(exercises, (exercise) => [exercise.level]),
    forces: uniqueOptions(exercises, (exercise) => [exercise.force]),
    mechanics: uniqueOptions(exercises, (exercise) => [exercise.mechanic]),
    equipment: uniqueOptions(exercises, (exercise) => [exercise.equipment]),
    muscles: uniqueOptions(exercises, (exercise) => [...(exercise.primaryMuscles || []), ...(exercise.secondaryMuscles || [])]),
    movementPatterns: uniqueOptions(exercises, (exercise) => exercise.classification?.movementPattern),
    laterality: uniqueOptions(exercises, (exercise) => exercise.classification?.laterality),
    classificationEquipment: uniqueOptions(exercises, (exercise) => exercise.classification?.equipment),
  }), [exercises]);

  function patchSelected(patch) {
    setExercises((current) => current.map((exercise) => (exercise.id === selected.id ? updateExercise(exercise, patch) : exercise)));
    setDirty(true);
  }

  function patchExercise(id, patch) {
    setExercises((current) => current.map((exercise) => (exercise.id === id ? updateExercise(exercise, patch) : exercise)));
    setDirty(true);
  }

  function setReviewed(exercise, reviewed) {
    patchExercise(exercise.id, {
      metadata: {
        reviewed,
        reviewedAt: reviewed ? new Date().toISOString() : null,
      },
    });
  }

  async function save() {
    setSaving(true);
    setLog('');
    try {
      const data = await persistExercises(exercises);
      setDirty(false);
      setLog(`Saved ${data.count} exercises\n${paths.jsonPath}\n${paths.ndjsonPath}`);
    } catch (error) {
      setLog(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function persistExercises(nextExercises) {
    const res = await fetch('/api/exercises', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exercises: nextExercises }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Save failed');
    return data;
  }

  async function run(action, label, extras = {}) {
    setRunning(label);
    setLog('');
    try {
      const res = await fetch('/api/media/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, id: selected.id, arkApiKey: arkApiKey.trim() || undefined, ...extras }),
      });
      const data = await res.json();
      setLog(data.output || data.error || JSON.stringify(data, null, 2));
    } finally {
      await refreshStatus();
      setRunning('');
    }
  }

  function applyDeface() {
    localStorage.setItem('tsl26.defaceMode', defaceMode);
    localStorage.setItem('tsl26.defaceThresh', String(defaceThresh));
    localStorage.setItem('tsl26.defaceMaskScale', String(defaceMaskScale));
    localStorage.setItem('tsl26.defaceMosaicSize', String(defaceMosaicSize));
    localStorage.setItem('tsl26.defacePasses', String(defacePasses));
    localStorage.setItem('tsl26.defaceKeepOriginal', String(defaceKeepOriginal));
    return run('deface-source', 'Difuminando caras del source', {
      defaceOptions: {
        replaceWith: defaceMode,
        thresh: defaceThresh,
        maskScale: defaceMaskScale,
        mosaicSize: defaceMosaicSize,
        passes: defacePasses,
        keepOriginal: defaceKeepOriginal,
      },
    });
  }

  function loadFromUrlInput() {
    const id = extractYoutubeId(ytInput);
    if (!id) {
      setLog(`Could not parse YouTube id from: ${ytInput}`);
      return;
    }
    const start = extractYoutubeStart(ytInput);
    setYtId(id);
    setYtTitle('');
    setYtChannel('');
    if (start != null) setClipStart(start);
  }

  function pickSearchResult(item) {
    if (!item?.id) return;
    setYtId(item.id);
    setYtTitle(item.title || '');
    setYtChannel(item.channel || '');
    setYtInput(`https://www.youtube.com/watch?v=${item.id}`);
  }

  async function runYoutubeSearch() {
    const term = (searchQuery.trim() || `${selected.name} exercise demonstration`).trim();
    if (!term) return;
    setSearching(true);
    setLog('');
    try {
      const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(term)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Search failed');
      setSearchResults(data.results || []);
      if (!data.results?.length) setLog('No videos found.');
      else if (!ytId) pickSearchResult(data.results[0]);
    } catch (error) {
      setLog(error.message);
    } finally {
      setSearching(false);
    }
  }

  async function saveSourceClip() {
    if (!ytId) {
      setLog('Selecciona un video de YouTube primero.');
      return;
    }
    const start = Number(clipStart);
    const duration = Number(clipDuration);
    if (!Number.isFinite(start) || start < 0) {
      setLog('Inicio inválido.');
      return;
    }
    if (!Number.isFinite(duration) || duration <= 0 || duration > 30) {
      setLog('Duración inválida (0 < duración <= 30).');
      return;
    }

    setSavingClip(true);
    setRunning('Guardando recorte como source');
    setLog('');
    try {
      const res = await fetch('/api/source-clip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selected.id,
          youtubeId: ytId,
          start,
          duration,
          title: ytTitle || null,
          channel: ytChannel || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.output || 'Source clip failed');

      setExercises((current) => current.map((exercise) => (
        exercise.id === selected.id ? data.exercise : exercise
      )));
      setDirty(false);
      await refreshStatus(selected.id);
      setMediaRefreshKey(Date.now());
      setMediaVariant('source');
      setSourceMode('ai');
      setLog([
        data.output || '',
        `Source clip guardado: ${ytId} @ ${start}s (${duration}s)`,
      ].filter(Boolean).join('\n\n'));
    } catch (error) {
      setLog(error.message);
    } finally {
      setSavingClip(false);
      setRunning('');
    }
  }

  function terminalVideoState(output) {
    if (/downloaded=true|Reminder: run `npm run videos:sync-json`/i.test(output)) return 'downloaded';
    if (/: succeeded/i.test(output)) return 'succeeded';
    if (/: failed|: cancelled|: expired|Ark request failed|No created tasks to poll/i.test(output)) return 'failed';
    if (/Missing ARK_API_KEY/i.test(output)) return 'failed';
    return null;
  }

  async function generateAiVideo() {
    setRunning('Generando video con IA');
    setLog('');

    const maxAttempts = 24;
    const intervalMs = 5000;
    let outputLog = '';

    try {
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        const res = await fetch('/api/media/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'generate-ai-video', id: selected.id, arkApiKey: arkApiKey.trim() || undefined }),
        });
        const data = await res.json();
        const chunk = data.output || data.error || JSON.stringify(data, null, 2);
        outputLog += `${attempt === 1 ? '' : '\n\n'}[intento ${attempt}/${maxAttempts}]\n${chunk}`;
        setLog(outputLog);

        await refreshStatus(selected.id);

        const terminal = terminalVideoState(chunk);
        if (terminal === 'downloaded' || terminal === 'failed') break;
        if (attempt < maxAttempts) await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
    } finally {
      await refreshStatus();
      setRunning('');
    }
  }

  if (!selected) return <main className="loading">Loading exercises...</main>;

  const selectedIndex = filtered.findIndex((exercise) => exercise.id === selected.id);
  const previousExercise = selectedIndex > 0 ? filtered[selectedIndex - 1] : null;
  const nextExercise = selectedIndex >= 0 && selectedIndex < filtered.length - 1 ? filtered[selectedIndex + 1] : null;
  const video = firstVideo(selected);
  const localDefault = status.defaultClip ? { type: 'video', url: status.defaultUrl, source: 'uploaded' } : null;
  const localSource = status.sourceClip ? { type: 'video', url: status.sourceUrl, source: 'source' } : null;
  const variantVideo = mediaVariant === 'default'
    ? (localDefault || videoBySource(selected, 'uploaded') || localSource)
    : (localSource || localDefault || videoBySource(selected, 'source'));
  const previewVideo = variantVideo || video;
  const previewVideoUrl = previewVideo?.url?.startsWith('/api/library/video')
    ? `${previewVideo.url}${previewVideo.url.includes('?') ? '&' : '?'}r=${mediaRefreshKey}`
    : previewVideo?.url;
  const image = firstImage(selected);
  const aiTaskStatus = status.arkTask?.error ? 'failed' : status.arkTask?.status || null;
  const taskStatusLabels = {
    created: 'Tarea creada',
    queued: 'En cola',
    running: 'Procesando',
    succeeded: 'Completado',
    failed: 'Fallido',
    cancelled: 'Cancelado',
    expired: 'Expirado',
  };
  const defaultState = status.defaultClip ? 'Listo' : running === 'Generando video con IA' ? 'Generando' : taskStatusLabels[aiTaskStatus] || 'Pendiente';
  const defaultStateClass = status.defaultClip ? 'ready' : running === 'Generando video con IA' || ['created', 'queued', 'running'].includes(aiTaskStatus) ? 'working' : 'missing';
  const sourceState = status.sourceClip ? 'Listo' : 'Falta source';
  const selectedSlug = selected.cdnslug || selected.cdnSlug;
  const selectedHasFolder = selectedSlug ? librarySlugs.includes(selectedSlug) : false;
  const relationIssues = (libraryRelation?.orphanFolders?.length || 0) + (libraryRelation?.missingFolders?.length || 0) + (libraryRelation?.duplicateSlugs?.length || 0);

  return (
    <main className="app">
      <aside className="sidebar">
        <div className="sidebarHeader">
          <div className="toolbar">
            <div className="search">
              <Search size={16} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search exercises" />
            </div>
            <select value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="all">All</option>
              <option value="priority">Priority</option>
              <option value="invalidDefault">Default invalid</option>
              <option value="library">In library</option>
              <option value="notInLibrary">Not in library</option>
              <option value="missingFolder">Missing folder</option>
              <option value="youtube">YouTube</option>
              <option value="missingDefault">Missing default</option>
              <option value="pendingReview">Pending review</option>
              <option value="reviewed">Reviewed</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="count">
            {filtered.length} / {exercises.length} · {librarySlugs.length} folders
            {relationIssues > 0 && <span className="relationWarning"> · {relationIssues} relation issues</span>}
          </div>
        </div>
        <div className="list">
          {filtered.map((exercise) => {
            const defaultIndicator = defaultIndicatorFor(exercise);
            return (
              <button
                className={exercise.id === selected.id ? 'row active' : 'row'}
                key={exercise.id}
                onClick={() => selectExercise(exercise.id)}
              >
                <span className="rowTop">
                  <span className="rowTitle">
                    <span
                      className={`defaultDot ${defaultIndicator.className}`}
                      title={defaultIndicator.label}
                      aria-label={defaultIndicator.label}
                    />
                    <strong>{exercise.name}</strong>
                  </span>
                  <span className="badges">
                    {exercise.priority === true && <Star size={13} className="priorityIcon" />}
                    {exercise.metadata?.defaultVideoInvalid === true && <AlertTriangle size={13} className="warningIcon" />}
                    {librarySlugs.includes(exercise.cdnslug || exercise.cdnSlug) && <span title="In library">L</span>}
                    {(exercise.cdnslug || exercise.cdnSlug) && !librarySlugs.includes(exercise.cdnslug || exercise.cdnSlug) && <AlertTriangle size={13} className="warningIcon" />}
                    {exercise.metadata?.reviewed && <Check size={13} />}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="preview">
        <div className="previewHeader">
          <div>
            <h1>{selected.i18n?.name?.es || selected.name}</h1>
            <p>{selected.name} · {selected.category} · {selected.equipment || 'no equipment'}</p>
            <p className={selectedHasFolder ? 'relationLine ok' : 'relationLine warning'}>
              {selectedSlug || 'sin cdnslug'} {selectedHasFolder ? '· carpeta asociada' : '· falta carpeta 1:1'}
            </p>
          </div>
          <div className="headerActions">
            <div className="stepActions">
              <button
                title="Previous exercise"
                onClick={() => previousExercise && selectExercise(previousExercise.id)}
                disabled={!previousExercise}
              >
                <ChevronLeft size={17} />
              </button>
              <span>{selectedIndex >= 0 ? selectedIndex + 1 : '-'} / {filtered.length}</span>
              <button
                title="Next exercise"
                onClick={() => nextExercise && selectExercise(nextExercise.id)}
                disabled={!nextExercise}
              >
                <ChevronRight size={17} />
              </button>
            </div>
            <button
              className={selected.metadata?.reviewed ? 'review reviewed' : 'review'}
              onClick={() => setReviewed(selected, selected.metadata?.reviewed !== true)}
            >
              <Check size={17} /> {selected.metadata?.reviewed ? 'Reviewed' : 'Mark reviewed'}
            </button>
            <button className="primary" onClick={save} disabled={!dirty || saving}>
              <Save size={17} /> {saving ? 'Saving' : dirty ? 'Save' : 'Saved'}
            </button>
          </div>
        </div>

        <div className="mediaToolbar" aria-label="Video variant">
          <button
            className={mediaVariant === 'source' ? 'active' : ''}
            onClick={() => setMediaVariant('source')}
            disabled={!status.sourceClip && !videoBySource(selected, 'source')}
          >
            Original
          </button>
          <button
            className={mediaVariant === 'default' ? 'active' : ''}
            onClick={() => setMediaVariant('default')}
            disabled={!status.defaultClip && !videoBySource(selected, 'uploaded')}
          >
            Default
          </button>
        </div>

        <div className="mediaBox">
          {previewVideoUrl?.endsWith('.mp4') || previewVideoUrl?.startsWith('/api/library/video') ? (
            <video key={previewVideoUrl} src={previewVideoUrl} controls playsInline />
          ) : previewVideoUrl ? (
            <iframe key={previewVideoUrl} src={previewVideoUrl} allow="autoplay; encrypted-media; picture-in-picture" />
          ) : image?.url || image?.thumbnailUrl ? (
            <img src={image.thumbnailUrl || image.url} />
          ) : (
            <div className="emptyMedia">No media</div>
          )}
        </div>

        <div className="statusGrid" aria-label="Media status">
          <div>
            <strong>Source video</strong>
            <span className={status.sourceClip ? 'state ready' : 'state missing'}>{sourceState}</span>
          </div>
          <div className="primaryStatus">
            <strong>Default generado</strong>
            <span className={`state ${defaultStateClass}`}>{defaultState}</span>
            {status.arkTask?.taskId && <small>Task ID: {status.arkTask.taskId}</small>}
          </div>
          <div>
            <strong>Originales</strong>
            <span>{status.downloadedOriginals?.length || 0} descargados</span>
          </div>
        </div>

        <details className="defacePanel">
          <summary><EyeOff size={14} /> Anonimizar source (caras)</summary>
          <div className="defaceControls">
            <label>
              <span>Modo</span>
              <select value={defaceMode} onChange={(event) => setDefaceMode(event.target.value)}>
                <option value="blur">Blur (gaussiano)</option>
                <option value="solid">Sólido (negro)</option>
                <option value="mosaic">Mosaico</option>
              </select>
            </label>
            <label title="Umbral de detección. Más bajo = detecta más caras (incluye falsos positivos)">
              <span>Threshold</span>
              <input
                type="number"
                step="0.05"
                min="0.05"
                max="1"
                value={defaceThresh}
                onChange={(event) => setDefaceThresh(Number(event.target.value))}
              />
            </label>
            <label title="Escala de la máscara. Más alto = cubre más área alrededor de la cara">
              <span>Mask scale</span>
              <input
                type="number"
                step="0.1"
                min="1"
                max="3"
                value={defaceMaskScale}
                onChange={(event) => setDefaceMaskScale(Number(event.target.value))}
              />
            </label>
            {defaceMode === 'mosaic' && (
              <label>
                <span>Mosaico (px)</span>
                <input
                  type="number"
                  step="1"
                  min="5"
                  max="80"
                  value={defaceMosaicSize}
                  onChange={(event) => setDefaceMosaicSize(Number(event.target.value))}
                />
              </label>
            )}
            <label title="Número de pasadas. Más pasadas = el detector reanaliza el resultado y aplica blur extra a lo que aún quede">
              <span>Pasadas</span>
              <input
                type="number"
                step="1"
                min="1"
                max="4"
                value={defacePasses}
                onChange={(event) => setDefacePasses(Number(event.target.value))}
              />
            </label>
            <label className="defaceCheckbox" title="Guarda una copia del source antes de sobrescribirlo">
              <input
                type="checkbox"
                checked={defaceKeepOriginal}
                onChange={(event) => setDefaceKeepOriginal(event.target.checked)}
              />
              <span>Backup .original.mp4</span>
            </label>
            <button
              type="button"
              className="primary"
              onClick={applyDeface}
              disabled={Boolean(running) || !status.sourceClip}
            >
              <EyeOff size={14} /> Aplicar
            </button>
          </div>
          <p className="defaceHint">
            Sobrescribe <code>libraries/tsl26/&lt;slug&gt;/source/&lt;slug&gt;.mp4</code>. Si el detector deja escapar caras, sube
            <code>mask-scale</code>, baja <code>threshold</code>, prueba <strong>solid</strong> o usa varias pasadas.
          </p>
        </details>

        <div className="sourceTabs" role="tablist">
          <button
            role="tab"
            aria-selected={sourceMode === 'ai'}
            className={sourceMode === 'ai' ? 'sourceTab active' : 'sourceTab'}
            onClick={() => setSourceMode('ai')}
          >
            <Sparkles size={14} /> Generar con IA
          </button>
          <button
            role="tab"
            aria-selected={sourceMode === 'youtube'}
            className={sourceMode === 'youtube' ? 'sourceTab active' : 'sourceTab'}
            onClick={() => setSourceMode('youtube')}
          >
            <Search size={14} /> Buscar video fuente
          </button>
        </div>

        {sourceMode === 'ai' && (
          <div className="actions">
            <button title="Muestra el prompt y payload que se enviarian para crear el task" onClick={() => run('preview-source-task', 'Previewing task')} disabled={Boolean(running)}>
              <Play size={16} /> Previsualizar task
            </button>
            <button className="primary" title="Descarga source si hace falta, crea o reutiliza la tarea de IA, consulta el estado, descarga el resultado y sincroniza el default" onClick={generateAiVideo} disabled={Boolean(running)}>
              <Sparkles size={16} /> Generar video con IA
            </button>
          </div>
        )}

        {sourceMode === 'youtube' && (
        <div className="ytSourcePanel">
          <div className="ytSourceHeader">
            <div>
              <strong>Recorte desde YouTube</strong>
              <span>Pega una URL o busca un video, marca el inicio y guarda el recorte como source.</span>
            </div>
            {selected.metadata?.sourceClip?.youtubeId && (
              <small className="ytSourceCurrent">
                Actual: {selected.metadata.sourceClip.youtubeId} @ {selected.metadata.sourceClip.start ?? 0}s · {selected.metadata.sourceClip.duration ?? 4}s
              </small>
            )}
          </div>

          <div className="ytSourceInputs">
            <div className="ytSourceRow">
              <div className="search">
                <input
                  value={ytInput}
                  onChange={(event) => setYtInput(event.target.value)}
                  placeholder="https://www.youtube.com/watch?v=... o ID de 11 caracteres"
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') loadFromUrlInput();
                  }}
                />
              </div>
              <button onClick={loadFromUrlInput} disabled={Boolean(running)}>
                Cargar
              </button>
            </div>
            <div className="ytSourceRow">
              <div className="search">
                <Search size={16} />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={`Buscar: ${selected.name} exercise demonstration`}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') runYoutubeSearch();
                  }}
                />
              </div>
              <button onClick={runYoutubeSearch} disabled={searching || Boolean(running)}>
                <Search size={16} /> {searching ? 'Buscando' : 'Buscar'}
              </button>
            </div>
          </div>

          {searchResults.length > 0 && (
            <div className="ytSearchResults">
              {searchResults.map((item) => (
                <button
                  key={item.id}
                  className={ytId === item.id ? 'ytResult active' : 'ytResult'}
                  onClick={() => pickSearchResult(item)}
                >
                  <img src={item.thumbnail} alt="" />
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.channel || item.id}{item.duration ? ` · ${Math.round(item.duration / 60)} min` : ''}</small>
                  </span>
                </button>
              ))}
            </div>
          )}

          {ytId && (
            <>
              <YouTubeSourcePicker youtubeId={ytId} onCapture={(value) => setClipStart(value)} />
              <div className="clipForm">
                <label>
                  Inicio (s)
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={clipStart}
                    onChange={(event) => setClipStart(Number(event.target.value))}
                  />
                </label>
                <label>
                  Duración (s)
                  <input
                    type="number"
                    min="0.5"
                    max="30"
                    step="0.5"
                    value={clipDuration}
                    onChange={(event) => setClipDuration(Number(event.target.value))}
                  />
                </label>
                <button
                  className="primary"
                  onClick={saveSourceClip}
                  disabled={savingClip || Boolean(running)}
                >
                  <Scissors size={16} /> {savingClip ? 'Guardando' : 'Guardar como source'}
                </button>
              </div>
            </>
          )}
        </div>
        )}

        {running && <div className="running"><FileVideo size={16} /> {running}...</div>}
        {log && <pre className="log">{log}</pre>}
      </section>

      <section className="editor">
        <div className="tabs">
          <button className={editorTab === 'main' ? 'tab active' : 'tab'} onClick={() => setEditorTab('main')}>Main</button>
          <button className={editorTab === 'translations' ? 'tab active' : 'tab'} onClick={() => setEditorTab('translations')}>Translations</button>
          <button className={editorTab === 'settings' ? 'tab active' : 'tab'} onClick={() => setEditorTab('settings')}>Settings</button>
        </div>

        {editorTab === 'main' && (
          <>
            <div className="editorSection">
              <h2>English source</h2>
              <label>
                Name
                <input value={selected.name || ''} onChange={(event) => patchSelected({ name: event.target.value, i18n: { name: { ...selected.i18n?.name, en: event.target.value } } })} />
              </label>
              <label>
                Instructions
                <textarea className="tall" value={asLines(selected.instructions)} onChange={(event) => patchSelected({ instructions: fromLines(event.target.value), i18n: { instructions: { ...selected.i18n?.instructions, en: fromLines(event.target.value) } } })} />
              </label>
            </div>

            <div className="editorSection">
              <h2>Classification</h2>
              <label>
                CDN slug
                <input value={selected.cdnslug || ''} onChange={(event) => patchSelected({ cdnslug: event.target.value })} />
              </label>
              <div className="split">
                <SelectField label="Category" value={selected.category} options={options.categories} onChange={(category) => patchSelected({ category, i18n: { category: { ...selected.i18n?.category, en: category } } })} />
                <SelectField label="Level" value={selected.level} options={options.levels} onChange={(level) => patchSelected({ level })} />
              </div>
              <div className="split">
                <SelectField label="Force" value={selected.force} options={options.forces} onChange={(force) => patchSelected({ force, classification: { forceType: force ? [force] : [] } })} />
                <SelectField label="Mechanic" value={selected.mechanic} options={options.mechanics} onChange={(mechanic) => patchSelected({ mechanic, classification: { mechanic: mechanic ? [mechanic] : [] } })} />
              </div>
              <SelectField label="Equipment" value={selected.equipment} options={options.equipment} onChange={(equipment) => patchSelected({ equipment, i18n: { equipment: { ...selected.i18n?.equipment, en: equipment } } })} />
              <MultiSelectField label="Primary muscles" value={selected.primaryMuscles} options={options.muscles} onChange={(primaryMuscles) => patchSelected({ primaryMuscles, classification: { primaryMuscles } })} />
              <MultiSelectField label="Secondary muscles" value={selected.secondaryMuscles} options={options.muscles} onChange={(secondaryMuscles) => patchSelected({ secondaryMuscles, classification: { secondaryMuscles } })} />
              <MultiSelectField label="Movement pattern" value={selected.classification?.movementPattern} options={options.movementPatterns} onChange={(movementPattern) => patchSelected({ classification: { movementPattern } })} />
              <MultiSelectField label="Laterality" value={selected.classification?.laterality} options={options.laterality} onChange={(laterality) => patchSelected({ classification: { laterality } })} />
              <MultiSelectField label="Classification equipment" value={selected.classification?.equipment} options={options.classificationEquipment} onChange={(equipment) => patchSelected({ classification: { equipment } })} />
            </div>

            <div className="editorSection">
              <h2>Review</h2>
              <label className="check">
                <input type="checkbox" checked={selected.isActive !== false} onChange={(event) => patchSelected({ isActive: event.target.checked })} />
                Active
              </label>
              <label className="check">
                <input type="checkbox" checked={selected.priority === true} onChange={(event) => patchSelected({ priority: event.target.checked })} />
                Priority
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={selected.metadata?.defaultVideoInvalid === true}
                  onChange={(event) => patchSelected({
                    metadata: {
                      defaultVideoInvalid: event.target.checked,
                      defaultVideoInvalidAt: event.target.checked ? new Date().toISOString() : null,
                    },
                  })}
                />
                Regenerate default
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={selected.metadata?.reviewed === true}
                  onChange={(event) => setReviewed(selected, event.target.checked)}
                />
                Metadata reviewed
              </label>
              <label>
                Review notes
                <textarea
                  value={selected.metadata?.notes || ''}
                  onChange={(event) => patchSelected({ metadata: { notes: event.target.value } })}
                  placeholder="Optional internal notes"
                />
              </label>
            </div>
          </>
        )}

        {editorTab === 'translations' && (
          <div className="editorSection">
            <h2>Spanish translation</h2>
            <label>
              Name
              <input value={selected.i18n?.name?.es || ''} onChange={(event) => patchSelected({ i18n: { name: { ...selected.i18n?.name, es: event.target.value } } })} />
            </label>
            <label>
              Category
              <input value={selected.i18n?.category?.es || ''} onChange={(event) => patchSelected({ i18n: { category: { ...selected.i18n?.category, es: event.target.value } } })} />
            </label>
            <label>
              Equipment
              <input value={selected.i18n?.equipment?.es || ''} onChange={(event) => patchSelected({ i18n: { equipment: { ...selected.i18n?.equipment, es: event.target.value } } })} />
            </label>
            <label>
              Instructions
              <textarea className="tall" value={asLines(selected.i18n?.instructions?.es)} onChange={(event) => patchSelected({ i18n: { instructions: { ...selected.i18n?.instructions, es: fromLines(event.target.value) } } })} />
            </label>
          </div>
        )}

        {editorTab === 'settings' && (
          <div className="editorSection">
            <h2>Local settings</h2>
            <label>
              ARK API key
              <input
                type="password"
                value={arkApiKey}
                onChange={(event) => {
                  setArkApiKey(event.target.value);
                  localStorage.setItem('tsl26.arkApiKey', event.target.value);
                }}
                placeholder="Stored in this browser only"
              />
            </label>
            <p className="hint">You can also set it in scripts/tsl26/editor/.env as ARK_API_KEY=...</p>
          </div>
        )}
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
