import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { labelForValue } from '../../../classification-reference.mjs';

function toOptionLabel(value) {
  return labelForValue(value);
}

export function SelectField({ label, value, options, onChange, allowBlank = true }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const filtered = options.filter((option) => toOptionLabel(option).toLowerCase().includes(query.trim().toLowerCase()));

  function choose(option) {
    onChange(option);
    setOpen(false);
    setQuery('');
  }

  return (
    <div className="comboField">
      <span>{label}</span>
      <button type="button" className="comboButton" onClick={() => setOpen((current) => !current)}>
        {value ? toOptionLabel(value) : 'Select value'}
      </button>
      {open && (
        <div className="comboMenu">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" autoFocus />
          <div className="comboOptions">
            {allowBlank && (
              <button type="button" className={!value ? 'comboOption selected' : 'comboOption'} onClick={() => choose('')}>
                <span>none</span>
                {!value && <Check size={14} />}
              </button>
            )}
            {filtered.map((option) => (
              <button
                type="button"
                key={option}
                className={value === option ? 'comboOption selected' : 'comboOption'}
                onClick={() => choose(option)}
              >
                <span>{toOptionLabel(option)}</span>
                {value === option && <Check size={14} />}
              </button>
            ))}
            {!filtered.length && <div className="emptyOptions">No matches</div>}
          </div>
        </div>
      )}
    </div>
  );
}

export function MultiSelectField({ label, value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = Array.isArray(value) ? value : [];
  const selectedSet = new Set(selected);
  const filtered = options.filter((option) => toOptionLabel(option).toLowerCase().includes(query.trim().toLowerCase()));

  function toggle(option) {
    if (selectedSet.has(option)) {
      onChange(selected.filter((item) => item !== option));
    } else {
      onChange([...selected, option]);
    }
  }

  return (
    <div className="comboField">
      <span>{label}</span>
      <button type="button" className="comboButton" onClick={() => setOpen((current) => !current)}>
        {selected.length ? selected.map(toOptionLabel).join(', ') : 'Select values'}
      </button>
      {open && (
        <div className="comboMenu">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" autoFocus />
          <div className="comboOptions">
            {filtered.map((option) => (
              <button
                type="button"
                key={option}
                className={selectedSet.has(option) ? 'comboOption selected' : 'comboOption'}
                onClick={() => toggle(option)}
              >
                <span>{toOptionLabel(option)}</span>
                {selectedSet.has(option) && <Check size={14} />}
              </button>
            ))}
            {!filtered.length && <div className="emptyOptions">No matches</div>}
          </div>
        </div>
      )}
    </div>
  );
}
