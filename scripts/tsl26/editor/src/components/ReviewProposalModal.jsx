import React from 'react';
import { formatValueForDiff, getValueAtPath } from '../lib/reviewPatch.js';

export function ReviewProposalModal({ proposal, currentExercise, selectedFields, onToggleField, onCancel, onApply }) {
  const entries = Object.entries(proposal.patch || {});
  const selectedCount = entries.filter(([fieldPath]) => selectedFields[fieldPath]).length;
  const providerLabel = proposal.provider === 'codex' ? 'Codex' : 'Claude';

  return (
    <div className="modalOverlay" role="dialog" aria-modal="true">
      <div className="modal reviewModal">
        <div className="modalHeader">
          <strong>{providerLabel} proposal</strong>
          <span className="hint">
            {entries.length} field{entries.length === 1 ? '' : 's'} changed · {selectedCount} selected
          </span>
          <button type="button" className="ghost" onClick={onCancel}>Close</button>
        </div>
        {entries.length === 0 ? (
          <div className="reviewDiffList"><p className="hint">El agente no propuso cambios.</p></div>
        ) : (
          <div className="reviewDiffList">
            {entries.map(([fieldPath, proposedValue]) => (
              <ReviewDiffRow
                key={fieldPath}
                fieldPath={fieldPath}
                proposedValue={proposedValue}
                currentValue={getValueAtPath(currentExercise, fieldPath)}
                rationale={proposal.rationale?.[fieldPath]}
                checked={!!selectedFields[fieldPath]}
                onToggle={(value) => onToggleField(fieldPath, value)}
              />
            ))}
          </div>
        )}
        <div className="modalFooter">
          <button type="button" className="ghost" onClick={onCancel}>Cancel</button>
          <button type="button" onClick={onApply} disabled={selectedCount === 0}>
            Apply {selectedCount} field{selectedCount === 1 ? '' : 's'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReviewDiffRow({ fieldPath, proposedValue, currentValue, rationale, checked, onToggle }) {
  return (
    <div className="reviewDiffRow">
      <label className="reviewDiffHeader">
        <input type="checkbox" checked={checked} onChange={(event) => onToggle(event.target.checked)} />
        <code>{fieldPath}</code>
      </label>
      {rationale && <p className="reviewDiffRationale">{rationale}</p>}
      <div className="reviewDiffPanels">
        <div className="reviewDiffPanel current">
          <div className="reviewDiffPanelLabel">Current</div>
          <pre>{formatValueForDiff(currentValue)}</pre>
        </div>
        <div className="reviewDiffPanel proposed">
          <div className="reviewDiffPanelLabel">Proposed</div>
          <pre>{formatValueForDiff(proposedValue)}</pre>
        </div>
      </div>
    </div>
  );
}
