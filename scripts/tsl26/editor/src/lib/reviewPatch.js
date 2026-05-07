export function mergePatchPath(target, dottedPath, value) {
  const segments = dottedPath.split('.');
  const next = { ...target };
  let cursor = next;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    cursor[segment] = cursor[segment] && typeof cursor[segment] === 'object' && !Array.isArray(cursor[segment])
      ? { ...cursor[segment] }
      : {};
    cursor = cursor[segment];
  }
  cursor[segments[segments.length - 1]] = value;
  return next;
}

export function getValueAtPath(source, dottedPath) {
  return dottedPath.split('.').reduce((acc, segment) => (acc == null ? acc : acc[segment]), source);
}

export function formatValueForDiff(value) {
  if (value == null) return '';
  if (Array.isArray(value)) return value.join('\n');
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

export function deepMergeForPatch(base, override) {
  if (Array.isArray(override) || override == null || typeof override !== 'object') return override;
  const baseObject = base && typeof base === 'object' && !Array.isArray(base) ? base : {};
  const out = { ...baseObject };
  for (const [key, value] of Object.entries(override)) {
    out[key] = deepMergeForPatch(baseObject[key], value);
  }
  return out;
}

export function buildPatchFromProposal(selectedExercise, proposal, selectedFields) {
  const patch = proposal?.patch || {};
  let nextPatch = {};
  for (const [fieldPath, value] of Object.entries(patch)) {
    if (!selectedFields[fieldPath]) continue;
    nextPatch = mergePatchPath(nextPatch, fieldPath, value);
  }
  if (Object.keys(nextPatch).length === 0) return null;
  if (typeof nextPatch.name === 'string') {
    nextPatch = mergePatchPath(nextPatch, 'i18n.name.en', nextPatch.name);
  }
  if (Array.isArray(nextPatch.instructions)) {
    nextPatch = mergePatchPath(nextPatch, 'i18n.instructions.en', nextPatch.instructions);
  }
  if (typeof nextPatch.force === 'string') {
    nextPatch = mergePatchPath(nextPatch, 'classification.forceType', nextPatch.force ? [nextPatch.force] : []);
  }
  if (typeof nextPatch.mechanic === 'string') {
    nextPatch = mergePatchPath(nextPatch, 'classification.mechanic', nextPatch.mechanic ? [nextPatch.mechanic] : []);
  }
  if (typeof nextPatch.equipment === 'string' && !nextPatch.classification?.equipment) {
    nextPatch = mergePatchPath(nextPatch, 'classification.equipment', nextPatch.equipment ? [nextPatch.equipment] : []);
  }
  if (Array.isArray(nextPatch.primaryMuscles) && !nextPatch.classification?.primaryMuscles) {
    nextPatch = mergePatchPath(nextPatch, 'classification.primaryMuscles', nextPatch.primaryMuscles);
  }
  if (Array.isArray(nextPatch.secondaryMuscles) && !nextPatch.classification?.secondaryMuscles) {
    nextPatch = mergePatchPath(nextPatch, 'classification.secondaryMuscles', nextPatch.secondaryMuscles);
  }
  if (nextPatch.i18n) nextPatch.i18n = deepMergeForPatch(selectedExercise.i18n, nextPatch.i18n);
  if (nextPatch.classification) nextPatch.classification = deepMergeForPatch(selectedExercise.classification, nextPatch.classification);
  return nextPatch;
}
