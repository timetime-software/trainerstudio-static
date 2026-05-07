import { createHash } from 'node:crypto';

export function cdnSlugFor(exercise) {
  return exercise?.cdnslug || exercise?.cdnSlug || null;
}

export function identityKeyForSlug(slug) {
  if (!slug) return null;
  return `trainerstudio:${slug}`;
}

export function idForIdentityKey(identityKey) {
  return createHash('sha256').update(String(identityKey)).digest('hex').slice(0, 24);
}

export function exerciseIdentifierKeys(exercise) {
  const keys = [
    exercise?.id,
    exercise?.metadata?.identityKey,
    cdnSlugFor(exercise),
  ];

  return new Set(keys.filter(Boolean).map(String));
}

export function matchesExerciseIdentifier(exercise, identifier) {
  if (!identifier) return false;
  return exerciseIdentifierKeys(exercise).has(String(identifier));
}

export function findExerciseByIdentifier(exercises, identifier) {
  return exercises.find((exercise) => matchesExerciseIdentifier(exercise, identifier));
}
