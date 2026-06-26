import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AlertTriangle, Check, ChevronLeft, ChevronRight, EyeOff, FileImage, FileVideo, LoaderCircle, Pause, Play, Save, Scissors, Search, Sparkles, Star, Trash2 } from 'lucide-react';
import {
  CATEGORY_VALUES,
  DETAILED_MUSCLE_GROUP_VALUES,
  EQUIPMENT_VALUES,
  FORCE_TYPE_VALUES,
  LATERALITY_VALUES,
  LEVEL_VALUES,
  MECHANIC_VALUES,
  MOVEMENT_PATTERN_VALUES,
} from '../../classification-reference.mjs';
import { MultiSelectField, SelectField } from './components/ComboFields.jsx';
import { ReviewProposalModal } from './components/ReviewProposalModal.jsx';
import { ReviewSection } from './components/ReviewSection.jsx';
import { YouTubeSourcePicker } from './components/YouTubeSourcePicker.jsx';
import { buildPatchFromProposal } from './lib/reviewPatch.js';
import { useReviewProposal } from './lib/useReviewProposal.js';
import { WORKFLOW_STAGES, cdnSlugFor, defaultIndicatorFor, findExerciseByIdentifier, updateExercise, workflowStage } from './lib/exercise.js';
import {
  extractYoutubeId,
  extractYoutubeStart,
  firstImage,
  firstVideo,
  formatTime,
  hasDefaultVideo,
  isVideoUrl,
  refreshUrl,
  videoBySource,
  youtubeIdFromExercise,
} from './lib/media.js';
import { asLines, fromLines } from './lib/text.js';
import './styles.css';

const emptyStatus = { sourceClip: false, defaultClip: false, downloadedOriginals: [], arkTask: null };
const AI_VIDEO_MAX_ATTEMPTS = 90;
const AI_VIDEO_POLL_INTERVAL_MS = 10000;
const AI_VIDEO_TYPICAL_ATTEMPT = 19;

function estimateAiVideoPercent(attempt) {
  if (!attempt || attempt < 1) return 0;
  if (attempt >= AI_VIDEO_TYPICAL_ATTEMPT) {
    return Math.min(99, Math.round(95 + (attempt - AI_VIDEO_TYPICAL_ATTEMPT) * 0.5));
  }
  return Math.round((attempt / AI_VIDEO_TYPICAL_ATTEMPT) * 95);
}
const PENDING_AI_TASK_STATUSES = new Set(['created', 'queued', 'running']);

function idFromUrl() {
  return new URLSearchParams(window.location.search).get('id') || '';
}

function App() {
  const [exercises, setExercises] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [query, setQuery] = useState('');
  const [stageFilters, setStageFilters] = useState(() => new Set());
  const [batchFilter, setBatchFilter] = useState('');
  const [mediaVariant, setMediaVariant] = useState('default');
  const [status, setStatus] = useState(emptyStatus);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState('');
  const [aiJobs, setAiJobs] = useState({});
  const [log, setLog] = useState('');
  const [paths, setPaths] = useState({});
  const [librarySlugs, setLibrarySlugs] = useState([]);
  const [defaultSlugs, setDefaultSlugs] = useState(() => new Set());
  const [sourceSlugs, setSourceSlugs] = useState(() => new Set());
  const [libraryRelation, setLibraryRelation] = useState(null);
  const [editorTab, setEditorTab] = useState('main');
  const [arkApiKey, setArkApiKey] = useState(() => localStorage.getItem('tsl26.arkApiKey') || '');
  const [anthropicApiKey, setAnthropicApiKey] = useState(() => localStorage.getItem('tsl26.anthropicApiKey') || '');
  const [openaiApiKey, setOpenaiApiKey] = useState(() => localStorage.getItem('tsl26.openaiApiKey') || '');
  const [reviewInstructions, setReviewInstructions] = useState(() => localStorage.getItem('tsl26.reviewInstructions') || '');
  const review = useReviewProposal({ apiKeys: { anthropic: anthropicApiKey, openai: openaiApiKey } });
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
  const [syncPlaying, setSyncPlaying] = useState(false);
  const [syncTime, setSyncTime] = useState(0);
  const [syncDuration, setSyncDuration] = useState(0);
  const [sourceMode, setSourceMode] = useState('ai');
  const [defaceMode, setDefaceMode] = useState(() => localStorage.getItem('tsl26.defaceMode') || 'blur');
  const [defaceThresh, setDefaceThresh] = useState(() => Number(localStorage.getItem('tsl26.defaceThresh')) || 0.1);
  const [defaceMaskScale, setDefaceMaskScale] = useState(() => Number(localStorage.getItem('tsl26.defaceMaskScale')) || 1);
  const [defaceMosaicSize, setDefaceMosaicSize] = useState(() => Number(localStorage.getItem('tsl26.defaceMosaicSize')) || 20);
  const [defacePasses, setDefacePasses] = useState(() => Number(localStorage.getItem('tsl26.defacePasses')) || 1);
  const [defaceKeepOriginal, setDefaceKeepOriginal] = useState(() => localStorage.getItem('tsl26.defaceKeepOriginal') === 'true');
  const [defaceOpen, setDefaceOpen] = useState(false);
  const [reviewJobs, setReviewJobs] = useState([]);
  const [reviewQueueMeta, setReviewQueueMeta] = useState({ active: 0, queued: 0, concurrency: 2 });
  const sourceVideoRef = useRef(null);
  const defaultVideoRef = useRef(null);
  const suppressSyncRef = useRef(false);
  const selectedIdRef = useRef(selectedId);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  async function loadExercises(preferredId = idFromUrl()) {
    const data = await fetch('/api/exercises')
      .then((res) => res.json())
    const slugs = data.librarySlugs || [];
    const queryExercise = findExerciseByIdentifier(data.exercises, preferredId);
    const firstLibraryExercise = data.exercises.find((exercise) => slugs[0] && (exercise.cdnslug || exercise.cdnSlug) === slugs[0]);
    setExercises(data.exercises);
    setSelectedId(queryExercise?.id || firstLibraryExercise?.id || data.exercises[0]?.id || '');
    setLibrarySlugs(slugs);
    setLibraryRelation(data.libraryRelation || null);
    setPaths({ ndjsonPath: data.ndjsonPath });
    return data;
  }

  useEffect(() => {
    loadExercises();
  }, []);

  async function refreshReviewJobs() {
    const res = await fetch('/api/review/jobs');
    if (!res.ok) return;
    const data = await res.json();
    setReviewJobs(data.jobs || []);
    setReviewQueueMeta({ active: data.active || 0, queued: data.queued || 0, concurrency: data.concurrency || 2 });
  }

  useEffect(() => {
    let cancelled = false;
    async function pollReviewJobs() {
      if (cancelled) return;
      await refreshReviewJobs();
    }
    pollReviewJobs();
    const interval = setInterval(pollReviewJobs, 2000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    function nextSetIfChanged(prev, list) {
      if (prev.size === list.length && list.every((slug) => prev.has(slug))) return prev;
      return new Set(list);
    }
    async function refreshInventory() {
      try {
        const res = await fetch('/api/library/inventory');
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setDefaultSlugs((prev) => nextSetIfChanged(prev, data.defaultSlugs || []));
        setSourceSlugs((prev) => nextSetIfChanged(prev, data.sourceSlugs || []));
      } catch {}
    }
    refreshInventory();
    const interval = setInterval(refreshInventory, 4000);
    return () => { cancelled = true; clearInterval(interval); };
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
      const exercise = findExerciseByIdentifier(exercises, id);
      if (exercise) {
        setSelectedId(exercise.id);
      }
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [exercises]);

  async function refreshStatus(id = selected?.id) {
    if (!id) return;
    const res = await fetch(`/api/media/status?id=${encodeURIComponent(id)}`);
    const data = await res.json();
    const nextStatus = data.status || emptyStatus;
    if (id === selectedIdRef.current) {
      setStatus(nextStatus);
    }
    return nextStatus;
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
    const hasSourceAlready = Boolean(videoBySource(selected, 'source')) || Boolean(selected.metadata?.sourceClip?.youtubeId);
    setSourceMode(hasSourceAlready ? 'ai' : 'youtube');
    setDefaceOpen(false);
    setSyncPlaying(false);
    setSyncTime(0);
    setSyncDuration(0);
  }, [selected?.id]);

  const stageOf = useMemo(() => {
    const map = new Map();
    for (const exercise of exercises) {
      const slug = exercise.cdnslug || exercise.cdnSlug;
      const hasSource = (slug && sourceSlugs.has(slug)) || Boolean(videoBySource(exercise, 'source'));
      const hasDefault = (slug && defaultSlugs.has(slug)) || hasDefaultVideo(exercise);
      map.set(exercise.id, workflowStage(exercise, { hasSource, hasDefault }));
    }
    return map;
  }, [defaultSlugs, exercises, sourceSlugs]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const libraryOrder = new Map(librarySlugs.map((slug, index) => [slug, index]));
    return exercises.filter((exercise) => {
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
      const matchesStage = stageFilters.size === 0 || stageFilters.has(stageOf.get(exercise.id));
      const matchesBatch = !batchFilter || exercise.metadata?.batch === batchFilter;
      return matchesTerm && matchesStage && matchesBatch;
    }).sort((a, b) => {
      const aSlug = a.cdnslug || a.cdnSlug;
      const bSlug = b.cdnslug || b.cdnSlug;
      const aOrder = libraryOrder.has(aSlug) ? libraryOrder.get(aSlug) : Number.MAX_SAFE_INTEGER;
      const bOrder = libraryOrder.has(bSlug) ? libraryOrder.get(bSlug) : Number.MAX_SAFE_INTEGER;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [batchFilter, exercises, librarySlugs, query, stageFilters, stageOf]);

  const stageCounts = useMemo(() => {
    const counts = {};
    for (const exercise of exercises) {
      if (batchFilter && exercise.metadata?.batch !== batchFilter) continue;
      const stage = stageOf.get(exercise.id);
      counts[stage] = (counts[stage] || 0) + 1;
    }
    return counts;
  }, [batchFilter, exercises, stageOf]);

  function toggleStageFilter(key) {
    setStageFilters((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const batches = useMemo(() => {
    const set = new Set();
    for (const exercise of exercises) {
      const batch = exercise.metadata?.batch;
      if (batch) set.add(String(batch));
    }
    return [...set].sort().reverse();
  }, [exercises]);

  const options = useMemo(() => ({
    categories: CATEGORY_VALUES,
    levels: LEVEL_VALUES,
    forces: FORCE_TYPE_VALUES,
    mechanics: MECHANIC_VALUES,
    equipment: EQUIPMENT_VALUES,
    muscles: DETAILED_MUSCLE_GROUP_VALUES,
    movementPatterns: MOVEMENT_PATTERN_VALUES,
    laterality: LATERALITY_VALUES,
    classificationEquipment: EQUIPMENT_VALUES,
  }), []);

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

  function setVideoInvalid(exercise, invalid) {
    patchExercise(exercise.id, {
      metadata: {
        defaultVideoInvalid: invalid,
        defaultVideoInvalidAt: invalid ? new Date().toISOString() : null,
        // Flagging a bad video sends it back to the queue, so it is no longer "OK".
        ...(invalid ? { reviewed: false, reviewedAt: null } : {}),
      },
    });
  }

  async function save() {
    setSaving(true);
    setLog('');
    try {
      const data = await persistExercises(exercises);
      setDirty(false);
      setLog(`Saved ${data.count} exercises\n${paths.ndjsonPath}`);
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

  async function runExerciseReview(reviewAgent) {
    if (dirty) {
      setLog('Guarda los cambios pendientes antes de pedir un review.');
      return;
    }
    if (!selected?.id) return;
    await review.requestProposal({
      exerciseId: selected.id,
      instructions: reviewInstructions,
      provider: reviewAgent,
    });
  }

  function applyReviewProposal() {
    if (!review.proposal) return;
    const patch = buildPatchFromProposal(selected, review.proposal, review.selectedFields);
    if (patch) patchSelected(patch);
    review.dismissProposal();
  }

  async function enqueueReviewIds(ids, reviewAgent) {
    if (dirty) {
      setLog('Save pending changes before launching review jobs.');
      return;
    }
    setRunning(`Queueing ${ids.length} ${reviewAgent} review${ids.length === 1 ? '' : 's'}`);
    setLog('');
    try {
      const res = await fetch('/api/review/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, reviewAgent }),
      });
      const data = await res.json();
      const output = data.output || data.error || JSON.stringify(data, null, 2);
      if (!res.ok) {
        setLog(output);
        return;
      }
      setLog(`Queued ${data.count || 0} review job${data.count === 1 ? '' : 's'}.`);
      await refreshReviewJobs();
      setDirty(false);
    } finally {
      await refreshStatus();
      setRunning('');
    }
  }

  function updateSyncMetrics() {
    const videos = [sourceVideoRef.current, defaultVideoRef.current].filter(Boolean);
    const durations = videos.map((videoElement) => videoElement.duration).filter(Number.isFinite);
    const currentTimes = videos.map((videoElement) => videoElement.currentTime).filter(Number.isFinite);
    setSyncDuration(durations.length ? Math.max(...durations) : 0);
    setSyncTime(currentTimes.length ? currentTimes[0] : 0);
    setSyncPlaying(videos.some((videoElement) => !videoElement.paused));
  }

  function syncFromVideo(event) {
    if (suppressSyncRef.current) return;
    const origin = event.currentTarget;
    const peers = [sourceVideoRef.current, defaultVideoRef.current].filter((videoElement) => videoElement && videoElement !== origin);
    suppressSyncRef.current = true;
    for (const peer of peers) {
      if (Number.isFinite(origin.currentTime) && Math.abs(peer.currentTime - origin.currentTime) > 0.25) {
        peer.currentTime = origin.currentTime;
      }
      if (Number.isFinite(origin.playbackRate) && peer.playbackRate !== origin.playbackRate) {
        peer.playbackRate = origin.playbackRate;
      }
      if (origin.paused && !peer.paused) {
        peer.pause();
      } else if (!origin.paused && peer.paused) {
        peer.play().catch(() => {});
      }
    }
    window.setTimeout(() => {
      suppressSyncRef.current = false;
    }, 0);
    updateSyncMetrics();
  }

  function setSynchronizedPlayback(shouldPlay) {
    const videos = [sourceVideoRef.current, defaultVideoRef.current].filter(Boolean);
    suppressSyncRef.current = true;
    for (const videoElement of videos) {
      if (shouldPlay) videoElement.play().catch(() => {});
      else videoElement.pause();
    }
    window.setTimeout(() => {
      suppressSyncRef.current = false;
    }, 0);
    setSyncPlaying(shouldPlay);
  }

  function seekSynchronizedVideos(value) {
    const nextTime = Number(value);
    if (!Number.isFinite(nextTime)) return;
    suppressSyncRef.current = true;
    for (const videoElement of [sourceVideoRef.current, defaultVideoRef.current].filter(Boolean)) {
      videoElement.currentTime = nextTime;
    }
    window.setTimeout(() => {
      suppressSyncRef.current = false;
    }, 0);
    setSyncTime(nextTime);
  }

  async function deleteDefaultVideo() {
    setRunning('Borrando default');
    setLog('');
    try {
      const res = await fetch('/api/media/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete-default', id: selected.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.output || 'Delete default failed');
      if (data.exercise) {
        setExercises((current) => current.map((exercise) => (exercise.id === selected.id ? data.exercise : exercise)));
      }
      setDirty(false);
      setDefaultSlugs((current) => {
        const next = new Set(current);
        next.delete(selected.cdnslug || selected.cdnSlug);
        return next;
      });
      setMediaRefreshKey(Date.now());
      setLog(data.output || 'Default eliminado.');
    } catch (error) {
      setLog(error.message);
    } finally {
      await refreshStatus(selected.id);
      setRunning('');
    }
  }

  async function generateThumbnail() {
    setRunning('Generando thumbnail');
    setLog('');
    try {
      const res = await fetch('/api/media/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate-thumbnail', id: selected.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.output || 'Thumbnail generation failed');
      setMediaRefreshKey(Date.now());
      setLog(data.output || 'Thumbnail generado desde el video default.');
    } catch (error) {
      setLog(error.message);
    } finally {
      await refreshStatus(selected.id);
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
    setDefaceOpen(false);
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
    if (/downloaded=true|Reminder: run `npm run videos:sync-data`/i.test(output)) return 'downloaded';
    if (/: succeeded/i.test(output)) return 'succeeded';
    if (/: failed|: cancelled|: expired|Ark request failed|No created tasks to poll/i.test(output)) return 'failed';
    if (/Missing ARK_API_KEY/i.test(output)) return 'failed';
    return null;
  }

  function setAiJob(id, patch) {
    setAiJobs((current) => ({
      ...current,
      [id]: {
        ...(current[id] || {}),
        id,
        ...patch,
      },
    }));
  }

  function trimJobLog(value) {
    return value.split('\n\n').slice(-8).join('\n\n');
  }

  async function runAiVideoJob(id, options = {}) {
    if (!id) return;
    if (aiJobs[id]?.status === 'running') return;

    const pollOnly = options.pollOnly === true;
    const maxAttempts = AI_VIDEO_MAX_ATTEMPTS;
    const intervalMs = AI_VIDEO_POLL_INTERVAL_MS;
    let outputLog = '';
    let terminal = null;

    setAiJob(id, {
      status: 'running',
      label: pollOnly ? 'Continuando polling de IA' : 'Generando video con IA',
      attempt: 0,
      maxAttempts,
      log: '',
      error: null,
      startedAt: new Date().toISOString(),
      finishedAt: null,
    });
    if (id === selectedIdRef.current) setLog('');

    try {
      const initialStatus = await refreshStatus(id);
      let forceCreate = !pollOnly && !initialStatus?.defaultClip && !PENDING_AI_TASK_STATUSES.has(initialStatus?.arkTask?.status);

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        setAiJob(id, { attempt });

        const res = await fetch('/api/media/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: pollOnly ? 'generate-default' : 'generate-ai-video',
            id,
            forceCreate,
            arkApiKey: arkApiKey.trim() || undefined,
          }),
        });
        forceCreate = false;

        const data = await res.json();
        const chunk = data.output || data.error || JSON.stringify(data, null, 2);
        const entry = `[intento ${attempt}/${maxAttempts}]\n${chunk}`;
        outputLog = trimJobLog(outputLog ? `${outputLog}\n\n${entry}` : entry);
        setAiJob(id, { log: outputLog });
        if (id === selectedIdRef.current) setLog(outputLog);

        const latestStatus = await refreshStatus(id);
        terminal = terminalVideoState(chunk);
        if (terminal === 'downloaded' || terminal === 'failed' || latestStatus?.defaultClip) break;

        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, intervalMs));
        }
      }

      const finalStatus = await refreshStatus(id);
      const failed = terminal === 'failed' || (!finalStatus?.defaultClip && terminal !== 'downloaded');
      setAiJob(id, {
        status: failed ? 'failed' : 'done',
        label: failed ? 'Falló la generación IA' : 'Default generado',
        error: failed ? 'La generación no terminó correctamente. Revisa el log.' : null,
        finishedAt: new Date().toISOString(),
      });
    } catch (error) {
      const message = error.message || String(error);
      setAiJob(id, {
        status: 'failed',
        label: 'Falló la generación IA',
        error: message,
        log: trimJobLog(outputLog ? `${outputLog}\n\n${message}` : message),
        finishedAt: new Date().toISOString(),
      });
      if (id === selectedIdRef.current) setLog(message);
    }
  }

  useEffect(() => {
    const taskStatus = status.arkTask?.status;
    if (!selected?.id || status.defaultClip || !PENDING_AI_TASK_STATUSES.has(taskStatus)) return;
    if (aiJobs[selected.id]?.status === 'running') return;
    runAiVideoJob(selected.id, { pollOnly: true });
  }, [arkApiKey, selected?.id, status.arkTask?.status, status.defaultClip]);

  function generateAiVideo() {
    return runAiVideoJob(selected.id);
  }

  if (!selected) return <main className="loading">Loading exercises...</main>;

  const selectedIndex = filtered.findIndex((exercise) => exercise.id === selected.id);
  const previousExercise = selectedIndex > 0 ? filtered[selectedIndex - 1] : null;
  const nextExercise = selectedIndex >= 0 && selectedIndex < filtered.length - 1 ? filtered[selectedIndex + 1] : null;
  const video = firstVideo(selected);
  const localDefault = status.defaultClip ? { type: 'video', url: status.defaultUrl, source: 'uploaded' } : null;
  const localSource = status.sourceClip ? { type: 'video', url: status.sourceUrl, source: 'source' } : null;
  const sourceVideo = localSource || videoBySource(selected, 'source');
  const defaultVideo = localDefault || videoBySource(selected, 'uploaded');
  const sourceVideoUrl = refreshUrl(sourceVideo?.url, mediaRefreshKey);
  const defaultVideoUrl = refreshUrl(defaultVideo?.url, mediaRefreshKey);
  const hasComparisonVideo = isVideoUrl(sourceVideoUrl) || isVideoUrl(defaultVideoUrl);
  const variantVideo = mediaVariant === 'default'
    ? (localDefault || videoBySource(selected, 'uploaded') || localSource)
    : (localSource || localDefault || videoBySource(selected, 'source'));
  const previewVideo = variantVideo || video;
  const previewVideoUrl = refreshUrl(previewVideo?.url, mediaRefreshKey);
  const image = firstImage(selected);
  const aiTaskStatus = status.arkTask?.error ? 'failed' : status.arkTask?.status || null;
  const selectedAiJob = aiJobs[selected.id] || null;
  const selectedAiRunning = selectedAiJob?.status === 'running';
  const selectedBusy = Boolean(running) || selectedAiRunning;
  const activeAiJobCount = Object.values(aiJobs).filter((job) => job?.status === 'running').length;
  const taskStatusLabels = {
    created: 'Tarea creada',
    queued: 'En cola',
    running: 'Procesando',
    succeeded: 'Completado',
    failed: 'Fallido',
    cancelled: 'Cancelado',
    expired: 'Expirado',
  };
  const aiEstimatedPercent = selectedAiRunning ? estimateAiVideoPercent(selectedAiJob?.attempt) : 0;
  const defaultState = status.defaultClip ? 'Listo' : selectedAiRunning ? `Generando ${aiEstimatedPercent}%` : taskStatusLabels[aiTaskStatus] || 'Pendiente';
  const defaultStateClass = status.defaultClip ? 'ready' : selectedAiRunning || ['created', 'queued', 'running'].includes(aiTaskStatus) ? 'working' : 'missing';
  const sourceState = status.sourceClip ? 'Listo' : 'Falta source';
  const liveHasSource = Boolean(sourceVideo);
  const liveHasDefault = Boolean(defaultVideo);
  const videoInvalid = selected.metadata?.defaultVideoInvalid === true;
  const isReviewed = selected.metadata?.reviewed === true;
  const workflowSteps = [
    { key: 'source', label: 'Buscar fuente', state: liveHasSource ? 'done' : 'current' },
    {
      key: 'video',
      label: 'Generar vídeo IA',
      state: videoInvalid ? 'warn' : liveHasDefault ? 'done' : liveHasSource ? 'current' : 'todo',
    },
    {
      key: 'review',
      label: 'Revisar y OK',
      state: isReviewed ? 'done' : videoInvalid || !liveHasDefault ? 'todo' : 'current',
    },
  ];
  const selectedSlug = selected.cdnslug || selected.cdnSlug;
  const selectedHasFolder = selectedSlug ? librarySlugs.includes(selectedSlug) : false;
  const relationIssues = (libraryRelation?.orphanFolders?.length || 0) + (libraryRelation?.missingFolders?.length || 0) + (libraryRelation?.duplicateSlugs?.length || 0);
  const reviewJobCounts = reviewJobs.reduce((counts, job) => {
    counts[job.status] = (counts[job.status] || 0) + 1;
    return counts;
  }, {});
  const visibleReviewJobs = reviewJobs.slice(0, 8);

  return (
    <main className="app">
      <aside className="sidebar">
        <div className="sidebarHeader">
          <div className="toolbar">
            <div className="search">
              <Search size={16} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search exercises" />
            </div>
            <div className="stageFilters" role="group" aria-label="Filtrar por estado del flujo">
              {WORKFLOW_STAGES.map((stage) => (
                <button
                  key={stage.key}
                  type="button"
                  className={stageFilters.has(stage.key) ? 'stageChip active' : 'stageChip'}
                  aria-pressed={stageFilters.has(stage.key)}
                  onClick={() => toggleStageFilter(stage.key)}
                >
                  <span className={`defaultDot ${stage.dot}`} />
                  {stage.label}
                  <span className="stageChipCount">{stageCounts[stage.key] || 0}</span>
                </button>
              ))}
              {stageFilters.size > 0 && (
                <button type="button" className="stageChip clear" onClick={() => setStageFilters(new Set())}>
                  Limpiar
                </button>
              )}
            </div>
            {batches.length > 0 && (
              <select value={batchFilter} onChange={(event) => setBatchFilter(event.target.value)}>
                <option value="">Todos los lotes</option>
                {batches.map((batch) => (
                  <option key={batch} value={batch}>{`Lote ${batch}`}</option>
                ))}
              </select>
            )}
          </div>
          <div className="count">
            {filtered.length} / {exercises.length} · {librarySlugs.length} folders
            {activeAiJobCount > 0 && <span className="aiJobCount"> · {activeAiJobCount} generando</span>}
            {relationIssues > 0 && <span className="relationWarning"> · {relationIssues} relation issues</span>}
          </div>
        </div>
        <div className="list">
          {filtered.map((exercise) => {
            const defaultIndicator = defaultIndicatorFor(exercise, defaultSlugs);
            const rowAiJob = aiJobs[exercise.id];
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
                    {rowAiJob?.status === 'running' && <LoaderCircle size={13} className="rowSpinner" aria-label={rowAiJob.label || 'Generando'} />}
                    {rowAiJob?.status === 'failed' && <AlertTriangle size={13} className="warningIcon" title={rowAiJob.error || rowAiJob.label || 'Falló la generación'} />}
                    {exercise.metadata?.batch && <span className="newBadge" title={`Lote ${exercise.metadata.batch}`}>{exercise.metadata.batch}</span>}
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
              className={videoInvalid ? 'review flagged' : 'review'}
              title="Marcar el vídeo como malo para regenerarlo"
              onClick={() => setVideoInvalid(selected, !videoInvalid)}
              disabled={!liveHasDefault && !videoInvalid}
            >
              <AlertTriangle size={17} /> {videoInvalid ? 'A revisar' : 'Revisar vídeo'}
            </button>
            <button
              className={isReviewed ? 'review reviewed' : 'review'}
              title="Aprobar el vídeo y marcar el ejercicio como listo"
              onClick={() => setReviewed(selected, !isReviewed)}
              disabled={!liveHasDefault && !isReviewed}
            >
              <Check size={17} /> {isReviewed ? 'OK ✓' : 'Dar OK'}
            </button>
            <button className="primary" onClick={save} disabled={!dirty || saving}>
              <Save size={17} /> {saving ? 'Saving' : dirty ? 'Save' : 'Saved'}
            </button>
          </div>
        </div>

        <ol className="workflowStepper" aria-label="Flujo del ejercicio">
          {workflowSteps.map((step, index) => (
            <li key={step.key} className={`workflowStep ${step.state}`}>
              <span className="workflowStepDot">{step.state === 'done' ? <Check size={13} /> : step.state === 'warn' ? <AlertTriangle size={13} /> : index + 1}</span>
              <span className="workflowStepLabel">{step.label}</span>
            </li>
          ))}
        </ol>

        {hasComparisonVideo ? (
          <section className="comparePanel" aria-label="Source and default video comparison">
            <div className="syncControls">
              <button type="button" onClick={() => setSynchronizedPlayback(!syncPlaying)}>
                {syncPlaying ? <Pause size={15} /> : <Play size={15} />}
              </button>
              <span>{formatTime(syncTime)}</span>
              <input
                type="range"
                min="0"
                max={syncDuration || 4}
                step="0.05"
                value={Math.min(syncTime, syncDuration || 4)}
                onChange={(event) => seekSynchronizedVideos(event.target.value)}
              />
              <span>{formatTime(syncDuration || 4)}</span>
            </div>

            <div className="compareGrid">
              <div className="compareItem">
                <div className="compareHeader">
                  <strong>Source</strong>
                  <span className={status.sourceClip ? 'state ready' : 'state missing'}>{sourceState}</span>
                </div>
                <div className="mediaBox compact withOverlay">
                  {isVideoUrl(sourceVideoUrl) ? (
                    <>
                      <video
                        key={sourceVideoUrl}
                        ref={sourceVideoRef}
                        src={sourceVideoUrl}
                        controls
                        playsInline
                        onLoadedMetadata={updateSyncMetrics}
                        onPlay={syncFromVideo}
                        onPause={syncFromVideo}
                        onSeeked={syncFromVideo}
                        onRateChange={syncFromVideo}
                        onTimeUpdate={syncFromVideo}
                      />
                      <button
                        type="button"
                        className={defaceOpen ? 'defaceToggle active' : 'defaceToggle'}
                        title="Anonimizar caras del source"
                        aria-label="Anonimizar caras del source"
                        aria-expanded={defaceOpen}
                        onClick={() => setDefaceOpen((open) => !open)}
                        disabled={selectedBusy || !status.sourceClip}
                      >
                        <EyeOff size={15} />
                      </button>
                      {defaceOpen && (
                        <div className="defacePanel">
                          <div className="defaceControls">
                            <label>
                              <span>Modo</span>
                              <select value={defaceMode} onChange={(event) => setDefaceMode(event.target.value)}>
                                <option value="blur">Blur</option>
                                <option value="solid">Sólido</option>
                                <option value="mosaic">Mosaico</option>
                              </select>
                            </label>
                            <label title="Umbral de detección. Más bajo = detecta más caras">
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
                                <span>Mosaico px</span>
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
                            <label title="Número de pasadas. Más pasadas = reanaliza el resultado">
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
                              <span>Backup</span>
                            </label>
                            <button
                              type="button"
                              className="primary"
                              onClick={applyDeface}
                              disabled={selectedBusy || !status.sourceClip}
                            >
                              <EyeOff size={14} /> Aplicar
                            </button>
                          </div>
                          <p className="defaceHint">
                            Sobrescribe el source local. Si quedan caras, sube <code>mask-scale</code>, baja <code>threshold</code> o usa más pasadas.
                          </p>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="emptyMedia">No source</div>
                  )}
                </div>
              </div>

              <div className="compareItem">
                <div className="compareHeader">
                  <strong>Default</strong>
                  <div className="compareHeaderActions">
                    <span className={`state ${defaultStateClass}`}>{defaultState}</span>
                    <button
                      type="button"
                      className="inlineIconAction"
                      title="Generar thumbnail desde el video default"
                      onClick={generateThumbnail}
                      disabled={selectedBusy || !status.defaultClip}
                    >
                      <FileImage size={14} />
                      <span>Thumbnail</span>
                    </button>
                    <button
                      type="button"
                      className="iconDanger"
                      title="Borrar default local y quitarlo de la metadata"
                      onClick={deleteDefaultVideo}
                      disabled={selectedBusy || (!status.defaultClip && !hasDefaultVideo(selected))}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="mediaBox compact">
                  {isVideoUrl(defaultVideoUrl) ? (
                    <video
                      key={defaultVideoUrl}
                      ref={defaultVideoRef}
                      src={defaultVideoUrl}
                      controls
                      playsInline
                      onLoadedMetadata={updateSyncMetrics}
                      onPlay={syncFromVideo}
                      onPause={syncFromVideo}
                      onSeeked={syncFromVideo}
                      onRateChange={syncFromVideo}
                      onTimeUpdate={syncFromVideo}
                    />
                  ) : (
                    <div className="emptyMedia">No default</div>
                  )}
                </div>
              </div>
            </div>
          </section>
        ) : (
          <div className="mediaBox">
            {isVideoUrl(previewVideoUrl) ? (
              <video key={previewVideoUrl} src={previewVideoUrl} controls playsInline />
            ) : previewVideoUrl ? (
              <iframe key={previewVideoUrl} src={previewVideoUrl} allow="autoplay; encrypted-media; picture-in-picture" />
            ) : image?.url || image?.thumbnailUrl ? (
              <img src={image.thumbnailUrl || image.url} />
            ) : (
              <div className="emptyMedia">No media</div>
            )}
          </div>
        )}

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

        <div className="sourceTabs" role="tablist">
          <button
            role="tab"
            aria-selected={sourceMode === 'youtube'}
            className={sourceMode === 'youtube' ? 'sourceTab active' : 'sourceTab'}
            onClick={() => setSourceMode('youtube')}
          >
            <Search size={14} /> 1 · Buscar vídeo fuente
          </button>
          <button
            role="tab"
            aria-selected={sourceMode === 'ai'}
            className={sourceMode === 'ai' ? 'sourceTab active' : 'sourceTab'}
            onClick={() => setSourceMode('ai')}
          >
            <Sparkles size={14} /> 2 · Generar con IA
          </button>
        </div>

        {sourceMode === 'ai' && (
          <div className="actions">
            <button title="Muestra el prompt y payload que se enviarian para crear el task" onClick={() => run('preview-source-task', 'Previewing task')} disabled={selectedBusy}>
              <Play size={16} /> Previsualizar task
            </button>
            <button className="primary" title="Descarga source si hace falta, crea o reutiliza la tarea de IA, consulta el estado, descarga el resultado y sincroniza el default" onClick={generateAiVideo} disabled={selectedBusy}>
              {selectedAiRunning ? <LoaderCircle size={16} className="buttonSpinner" /> : <Sparkles size={16} />} {selectedAiRunning ? 'Generando' : 'Generar video con IA'}
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
                  disabled={savingClip || selectedBusy}
                >
                  <Scissors size={16} /> {savingClip ? 'Guardando' : 'Guardar como source'}
                </button>
              </div>
            </>
          )}
        </div>
        )}

        {running && <div className="running"><FileVideo size={16} /> {running}...</div>}
        {selectedAiJob && (
          <div className={`running aiJob ${selectedAiJob.status}`}>
            <div className="aiJobHeader">
              {selectedAiRunning ? <LoaderCircle size={16} className="buttonSpinner" /> : <FileVideo size={16} />}
              <span>{selectedAiJob.label}</span>
              {selectedAiRunning && (
                <small>
                  {aiEstimatedPercent}% · {selectedAiJob.attempt || 0}/{selectedAiJob.maxAttempts || AI_VIDEO_MAX_ATTEMPTS}
                </small>
              )}
            </div>
            {selectedAiRunning && (
              <div className="aiJobProgress" role="progressbar" aria-valuenow={aiEstimatedPercent} aria-valuemin={0} aria-valuemax={100}>
                <div className="aiJobProgressBar" style={{ width: `${aiEstimatedPercent}%` }} />
              </div>
            )}
          </div>
        )}
        {(selectedAiJob?.log || log) && <pre className="log">{selectedAiJob?.log || log}</pre>}
        <div className="reviewQueue">
          <div className="reviewQueueHeader">
            <strong>Review jobs</strong>
            <span>
              {reviewQueueMeta.active} running · {reviewQueueMeta.queued} queued · {reviewJobCounts.applied || 0} applied · {reviewJobCounts.failed || 0} failed
            </span>
          </div>
          <div className="reviewQueueActions">
            <button type="button" onClick={() => enqueueReviewIds(filtered.map((exercise) => exercise.id), 'codex')} disabled={selectedBusy || dirty || !filtered.length}>
              <Sparkles size={14} /> Review filtered Codex
            </button>
            <button type="button" onClick={() => enqueueReviewIds(filtered.map((exercise) => exercise.id), 'claude')} disabled={selectedBusy || dirty || !filtered.length}>
              <Sparkles size={14} /> Review filtered Claude
            </button>
            <button type="button" onClick={refreshReviewJobs}>
              Refresh
            </button>
          </div>
          {visibleReviewJobs.length > 0 && (
            <div className="reviewJobList">
              {visibleReviewJobs.map((job) => (
                <div key={job.id} className={`reviewJob ${job.status}`}>
                  <span className="reviewJobStatus">{job.status}</span>
                  <button type="button" onClick={() => selectExercise(job.exerciseId)}>
                    {job.exerciseName || job.exerciseId}
                  </button>
                  <small>{job.provider}</small>
                  <button type="button" onClick={() => setLog(job.output || job.error || '')}>Log</button>
                </div>
              ))}
            </div>
          )}
        </div>
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
                <SelectField label="Category" value={selected.category} options={options.categories} onChange={(category) => patchSelected({ category })} />
                <SelectField label="Level" value={selected.level} options={options.levels} onChange={(level) => patchSelected({ level })} />
              </div>
              <div className="split">
                <SelectField label="Force" value={selected.force} options={options.forces} onChange={(force) => patchSelected({ force, classification: { forceType: force ? [force] : [] } })} />
                <SelectField label="Mechanic" value={selected.mechanic} options={options.mechanics} onChange={(mechanic) => patchSelected({ mechanic, classification: { mechanic: mechanic ? [mechanic] : [] } })} />
              </div>
              <SelectField label="Equipment" value={selected.equipment} options={options.equipment} onChange={(equipment) => patchSelected({ equipment, classification: { equipment: equipment ? [equipment] : [] } })} />
              <MultiSelectField label="Primary muscles" value={selected.primaryMuscles} options={options.muscles} onChange={(primaryMuscles) => patchSelected({ primaryMuscles, classification: { primaryMuscles } })} />
              <MultiSelectField label="Secondary muscles" value={selected.secondaryMuscles} options={options.muscles} onChange={(secondaryMuscles) => patchSelected({ secondaryMuscles, classification: { secondaryMuscles } })} />
              <MultiSelectField label="Movement pattern" value={selected.classification?.movementPattern} options={options.movementPatterns} onChange={(movementPattern) => patchSelected({ classification: { movementPattern } })} />
              <MultiSelectField label="Laterality" value={selected.classification?.laterality} options={options.laterality} onChange={(laterality) => patchSelected({ classification: { laterality } })} />
              <MultiSelectField label="Classification equipment" value={selected.classification?.equipment} options={options.classificationEquipment} onChange={(equipment) => {
                const primaryEquipment = equipment.find((item) => item !== 'bodyweight') || equipment[0] || '';
                patchSelected({ equipment: primaryEquipment, classification: { equipment } });
              }} />
            </div>

            <ReviewSection
              instructions={reviewInstructions}
              onInstructionsChange={(value) => {
                setReviewInstructions(value);
                localStorage.setItem('tsl26.reviewInstructions', value);
              }}
              onReview={runExerciseReview}
              status={review.status}
              disabled={selectedBusy || dirty}
              apiKeys={{ anthropic: anthropicApiKey, openai: openaiApiKey }}
            />
            <div className="editorSection">
              <h2>Status flags</h2>
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
                  onChange={(event) => setVideoInvalid(selected, event.target.checked)}
                />
                Revisar vídeo (regenerar default)
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
            <label>
              Anthropic API key (Claude review)
              <input
                type="password"
                value={anthropicApiKey}
                onChange={(event) => {
                  setAnthropicApiKey(event.target.value);
                  localStorage.setItem('tsl26.anthropicApiKey', event.target.value);
                }}
                placeholder="sk-ant-..."
              />
            </label>
            <label>
              OpenAI API key (Codex review)
              <input
                type="password"
                value={openaiApiKey}
                onChange={(event) => {
                  setOpenaiApiKey(event.target.value);
                  localStorage.setItem('tsl26.openaiApiKey', event.target.value);
                }}
                placeholder="sk-..."
              />
            </label>
            <p className="hint">Stored only in this browser. Server fallback: scripts/tsl26/editor/.env (ARK_API_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY).</p>
          </div>
        )}
      </section>
      {review.proposal && (
        <ReviewProposalModal
          proposal={review.proposal}
          currentExercise={selected}
          selectedFields={review.selectedFields}
          onToggleField={review.toggleField}
          onCancel={review.dismissProposal}
          onApply={applyReviewProposal}
        />
      )}
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
