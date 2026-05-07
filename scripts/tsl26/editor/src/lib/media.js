export function mediaFor(exercise) {
  const media = Array.isArray(exercise?.media) ? exercise.media : [];
  const images = Array.isArray(exercise?.images) ? exercise.images.map((url) => ({ type: 'image', url })) : [];
  return [...media, ...images].filter((item) => item?.url);
}

export function firstVideo(exercise) {
  return mediaFor(exercise).find((item) => item.type === 'video' || item.url.includes('youtube.com/embed') || item.url.endsWith('.mp4'));
}

export function videoBySource(exercise, source) {
  return mediaFor(exercise).find((item) => item.type === 'video' && item.source === source);
}

export function firstImage(exercise) {
  return mediaFor(exercise).find((item) => item.type === 'image' || item.thumbnailUrl || /\.(png|jpe?g|webp)$/i.test(item.url));
}

export function hasDefaultVideo(exercise) {
  return mediaFor(exercise).some((item) => item.type === 'video' && item.source === 'uploaded');
}

export function isVideoUrl(url) {
  return url?.endsWith('.mp4') || url?.startsWith('/api/library/video');
}

export function refreshUrl(url, refreshKey) {
  if (!url?.startsWith('/api/library/video')) return url;
  return `${url}${url.includes('?') ? '&' : '?'}r=${refreshKey}`;
}

export function isYoutubeMedia(item) {
  return item?.source === 'youtube' || /(?:youtube\.com|youtu\.be|img\.youtube\.com)/i.test(item?.url || item?.thumbnailUrl || '');
}

export function extractYoutubeId(input) {
  if (!input) return '';
  const trimmed = String(input).trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/(?:youtube\.com\/(?:embed\/|watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
  return match?.[1] || '';
}

export function extractYoutubeStart(input) {
  if (!input) return null;
  const match = String(input).match(/[?&](?:t|start)=([0-9]+(?:\.[0-9]+)?)(?:s|$|&)/i);
  return match ? Number(match[1]) : null;
}

export function youtubeIdFromExercise(exercise) {
  const stored = exercise?.metadata?.sourceClip?.youtubeId;
  if (stored) return stored;
  const media = mediaFor(exercise).find((item) => isYoutubeMedia(item));
  return extractYoutubeId(media?.url || media?.thumbnailUrl || '');
}

export function formatTime(seconds) {
  const value = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const minutes = Math.floor(value / 60);
  const rest = Math.floor(value % 60).toString().padStart(2, '0');
  return `${minutes}:${rest}`;
}
