export function asLines(value) {
  return Array.isArray(value) ? value.join('\n') : '';
}

export function fromLines(value) {
  return value.split('\n').map((line) => line.trim()).filter(Boolean);
}
