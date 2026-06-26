import { hasDefaultVideo } from './media.js';

export function cdnSlugFor(exercise) {
  return exercise?.cdnslug || exercise?.cdnSlug || '';
}

export function exerciseMatchesIdentifier(exercise, identifier) {
  if (!identifier) return false;
  return [exercise?.id, exercise?.metadata?.identityKey, cdnSlugFor(exercise)]
    .filter(Boolean)
    .map(String)
    .includes(String(identifier));
}

export function findExerciseByIdentifier(exercises, identifier) {
  return exercises.find((exercise) => exerciseMatchesIdentifier(exercise, identifier));
}

// Linear workflow each exercise moves through: source clip → AI video → review/OK,
// plus a "recheck" escape hatch when a generated video is flagged as bad.
export const WORKFLOW_STAGES = [
  { key: 'no-source', label: 'Sin fuente', dot: 'missingDefault' },
  { key: 'needs-video', label: 'Falta vídeo IA', dot: 'hasDefault pendingSync' },
  { key: 'needs-review', label: 'Por revisar', dot: 'hasDefault' },
  { key: 'recheck', label: 'Revisar vídeo', dot: 'invalidDefault' },
  { key: 'done', label: 'OK', dot: 'validated' },
];

export function workflowStage(exercise, { hasSource, hasDefault }) {
  if (exercise?.metadata?.defaultVideoInvalid) return 'recheck';
  if (exercise?.metadata?.reviewed) return 'done';
  if (hasDefault) return 'needs-review';
  if (hasSource) return 'needs-video';
  return 'no-source';
}

export function defaultIndicatorFor(exercise, defaultSlugSet) {
  if (exercise?.metadata?.defaultVideoInvalid) {
    return { className: 'invalidDefault', label: 'Default invalid' };
  }
  if (exercise?.metadata?.reviewed) {
    return { className: 'validated', label: 'Validated' };
  }
  const slug = cdnSlugFor(exercise);
  const fileExists = slug && defaultSlugSet?.has(slug);
  if (fileExists) {
    return { className: 'hasDefault', label: 'Default ready (file on disk)' };
  }
  if (hasDefaultVideo(exercise)) {
    return { className: 'hasDefault pendingSync', label: 'Default in JSON but file missing' };
  }
  return { className: 'missingDefault', label: 'Missing default' };
}

export function updateExercise(exercise, patch) {
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
