function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

export function snapshotExercise(exercise) {
  return JSON.parse(JSON.stringify(exercise || {}));
}

function diffExerciseFields(before, after, path = []) {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  const key = path.join('.') || '(root)';

  if (Array.isArray(before) || Array.isArray(after)) {
    return [{ key, before, after }];
  }

  if (!isPlainObject(before) || !isPlainObject(after)) {
    return [{ key, before, after }];
  }

  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  return keys.flatMap((field) => diffExerciseFields(before[field], after[field], [...path, field]));
}

function formatDiffValue(value) {
  if (value === undefined) return 'undefined';
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  if (!text) return '""';
  return text.length > 180 ? `${text.slice(0, 177)}...` : text;
}

export function formatExerciseDiff(before, after) {
  const changes = diffExerciseFields(before, after);
  if (!changes.length) return 'Review diff\nNo JSON changes detected for this exercise.';
  return [
    `Review diff\n${changes.length} changed field${changes.length === 1 ? '' : 's'}:`,
    ...changes.map((change) => `- ${change.key}: ${formatDiffValue(change.before)} -> ${formatDiffValue(change.after)}`),
  ].join('\n');
}
