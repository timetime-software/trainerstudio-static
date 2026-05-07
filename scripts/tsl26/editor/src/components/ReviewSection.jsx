import React from 'react';
import { LoaderCircle, Sparkles } from 'lucide-react';

export function ReviewSection({
  instructions,
  onInstructionsChange,
  onReview,
  status,
  disabled,
  apiKeys,
}) {
  const isLoading = status.phase === 'loading';
  const elapsedSeconds = Math.max(0, Math.round((status.elapsedMs || 0) / 100) / 10);
  const missingClaudeKey = !apiKeys.anthropic;
  const missingCodexKey = !apiKeys.openai;

  return (
    <div className="editorSection">
      <h2>Review</h2>
      <label>
        Instructions for the agent <small>(optional)</small>
        <textarea
          rows={2}
          value={instructions}
          onChange={(event) => onInstructionsChange(event.target.value)}
          placeholder="ej. solo arregla la traduccion al espanol, o reclasifica musculos"
          disabled={isLoading}
        />
      </label>
      <div className="actions">
        <button
          type="button"
          title={
            missingCodexKey
              ? 'Falta OPENAI_API_KEY en Settings'
              : disabled
                ? 'Guarda los cambios pendientes antes de pedir review'
                : 'Pide a GPT que proponga cambios. No se aplica nada hasta que aceptes.'
          }
          onClick={() => onReview('codex')}
          disabled={disabled || isLoading || missingCodexKey}
        >
          {isLoading && status.provider === 'codex' ? <LoaderCircle size={16} className="spin" /> : <Sparkles size={16} />}
          Codex review
        </button>
        <button
          type="button"
          title={
            missingClaudeKey
              ? 'Falta ANTHROPIC_API_KEY en Settings'
              : disabled
                ? 'Guarda los cambios pendientes antes de pedir review'
                : 'Pide a Claude que proponga cambios. No se aplica nada hasta que aceptes.'
          }
          onClick={() => onReview('claude')}
          disabled={disabled || isLoading || missingClaudeKey}
        >
          {isLoading && status.provider === 'claude' ? <LoaderCircle size={16} className="spin" /> : <Sparkles size={16} />}
          Claude review
        </button>
      </div>
      <ReviewStatusBanner status={status} elapsedSeconds={elapsedSeconds} />
    </div>
  );
}

function ReviewStatusBanner({ status, elapsedSeconds }) {
  if (status.phase === 'idle') return null;
  if (status.phase === 'loading') {
    const providerLabel = status.provider === 'codex' ? 'GPT' : 'Claude';
    return (
      <div className="reviewStatus loading">
        <LoaderCircle size={14} className="spin" />
        <span>Pidiendo a {providerLabel}... {elapsedSeconds.toFixed(1)}s</span>
      </div>
    );
  }
  if (status.phase === 'error') {
    return (
      <div className="reviewStatus error">
        <strong>Error:</strong> <span>{status.error}</span>
      </div>
    );
  }
  if (status.phase === 'ready') {
    return (
      <div className="reviewStatus ready">
        <span>Propuesta lista en {elapsedSeconds.toFixed(1)}s — revisa y aplica en el modal.</span>
      </div>
    );
  }
  return null;
}
