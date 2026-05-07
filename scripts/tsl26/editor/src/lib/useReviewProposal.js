import { useEffect, useRef, useState } from 'react';

export function useReviewProposal({ apiKeys }) {
  const [proposal, setProposal] = useState(null);
  const [selectedFields, setSelectedFields] = useState({});
  const [status, setStatus] = useState({ phase: 'idle', provider: null, startedAt: 0, elapsedMs: 0, error: '' });
  const tickRef = useRef(null);

  useEffect(() => () => clearInterval(tickRef.current), []);

  function startTimer(provider, startedAt) {
    setStatus({ phase: 'loading', provider, startedAt, elapsedMs: 0, error: '' });
    clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      setStatus((prev) => prev.phase === 'loading' ? { ...prev, elapsedMs: Date.now() - prev.startedAt } : prev);
    }, 250);
  }

  function stopTimer(patch) {
    clearInterval(tickRef.current);
    setStatus((prev) => ({ ...prev, ...patch }));
  }

  async function requestProposal({ exerciseId, instructions, provider }) {
    if (!exerciseId) return;
    setProposal(null);
    setSelectedFields({});
    const startedAt = Date.now();
    startTimer(provider, startedAt);
    try {
      const response = await fetch('/api/review/propose', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKeys.anthropic ? { 'x-anthropic-api-key': apiKeys.anthropic } : {}),
          ...(apiKeys.openai ? { 'x-openai-api-key': apiKeys.openai } : {}),
        },
        body: JSON.stringify({ id: exerciseId, instructions, provider }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        stopTimer({ phase: 'error', error: data.error || `Request failed (${response.status})`, elapsedMs: Date.now() - startedAt });
        return;
      }
      const patch = data.patch || {};
      const initialSelection = Object.fromEntries(Object.keys(patch).map((key) => [key, true]));
      setProposal({ provider, exerciseId: data.exerciseId, patch, rationale: data.rationale || {} });
      setSelectedFields(initialSelection);
      stopTimer({ phase: 'ready', elapsedMs: Date.now() - startedAt });
    } catch (error) {
      stopTimer({ phase: 'error', error: error.message || String(error), elapsedMs: Date.now() - startedAt });
    }
  }

  function dismissProposal() {
    setProposal(null);
    setSelectedFields({});
    setStatus({ phase: 'idle', provider: null, startedAt: 0, elapsedMs: 0, error: '' });
  }

  function toggleField(fieldPath, checked) {
    setSelectedFields((current) => ({ ...current, [fieldPath]: checked }));
  }

  return {
    proposal,
    selectedFields,
    status,
    requestProposal,
    dismissProposal,
    toggleField,
  };
}
