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
