import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Check, FileVideo, Play, Save, Search, Sparkles } from 'lucide-react';
import './styles.css';

const emptyStatus = { sourceClip: false, defaultClip: false, downloadedOriginals: [], arkTask: null };

function asLines(value) {
  return Array.isArray(value) ? value.join('\n') : '';
}

function fromLines(value) {
  return value.split('\n').map((line) => line.trim()).filter(Boolean);
}

function uniqueOptions(exercises, getter) {
  return [...new Set(exercises.flatMap((exercise) => getter(exercise) || []).filter((value) => String(value || '').trim()))].sort();
}

function toOptionLabel(value) {
  return String(value).replace(/_/g, ' ');
}

function SelectField({ label, value, options, onChange, allowBlank = true }) {
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
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
            autoFocus
          />
          <div className="comboOptions">
            {allowBlank && (
              <button
                type="button"
                className={!value ? 'comboOption selected' : 'comboOption'}
                onClick={() => choose('')}
              >
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

function MultiSelectField({ label, value, options, onChange }) {
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
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
            autoFocus
          />
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

function mediaFor(exercise) {
  const media = Array.isArray(exercise?.media) ? exercise.media : [];
  const images = Array.isArray(exercise?.images) ? exercise.images.map((url) => ({ type: 'image', url })) : [];
  return [...media, ...images].filter((item) => item?.url);
}

function firstVideo(exercise) {
  return mediaFor(exercise).find((item) => item.type === 'video' || item.url.includes('youtube.com/embed') || item.url.endsWith('.mp4'));
}

function firstImage(exercise) {
  return mediaFor(exercise).find((item) => item.type === 'image' || item.thumbnailUrl || /\.(png|jpe?g|webp)$/i.test(item.url));
}

function hasDefaultVideo(exercise) {
  return mediaFor(exercise).some((item) => item.type === 'video' && item.source === 'uploaded');
}

function defaultIndicatorFor(exercise) {
  if (exercise?.metadata?.reviewed) {
    return { className: 'validated', label: 'Validated' };
  }
  if (hasDefaultVideo(exercise)) {
    return { className: 'hasDefault', label: 'Default ready' };
  }
  return { className: 'missingDefault', label: 'Missing default' };
}

function updateExercise(exercise, patch) {
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

function App() {
  const [exercises, setExercises] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [status, setStatus] = useState(emptyStatus);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState('');
  const [log, setLog] = useState('');
  const [paths, setPaths] = useState({});
  const [librarySlugs, setLibrarySlugs] = useState([]);
  const [editorTab, setEditorTab] = useState('main');
  const [arkApiKey, setArkApiKey] = useState(() => localStorage.getItem('tsl26.arkApiKey') || '');

  useEffect(() => {
    fetch('/api/exercises')
      .then((res) => res.json())
      .then((data) => {
        const slugs = data.librarySlugs || [];
        const firstLibraryExercise = data.exercises.find((exercise) => slugs[0] && (exercise.cdnslug || exercise.cdnSlug) === slugs[0]);
        setExercises(data.exercises);
        setSelectedId(firstLibraryExercise?.id || data.exercises[0]?.id || '');
        setLibrarySlugs(slugs);
        setPaths({ jsonPath: data.jsonPath, ndjsonPath: data.ndjsonPath });
      });
  }, []);

  const selected = exercises.find((exercise) => exercise.id === selectedId) || exercises[0];

  async function refreshStatus(id = selected?.id) {
    if (!id) return;
    const res = await fetch(`/api/media/status?id=${encodeURIComponent(id)}`);
    const data = await res.json();
    setStatus(data.status || emptyStatus);
  }

  useEffect(() => {
    if (!selected?.id) return;
    refreshStatus(selected.id);
  }, [selected?.id, running]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const libraryOrder = new Map(librarySlugs.map((slug, index) => [slug, index]));
    return exercises.filter((exercise) => {
      const haystack = [
        exercise.id,
        exercise.cdnslug,
        exercise.name,
        exercise.i18n?.name?.es,
        exercise.category,
        exercise.equipment,
        ...(exercise.primaryMuscles || []),
        ...(exercise.aliases || []),
      ].join(' ').toLowerCase();
      const matchesTerm = !term || haystack.includes(term);
      const matchesFilter =
        filter === 'all' ||
        (filter === 'library' && libraryOrder.has(exercise.cdnslug || exercise.cdnSlug)) ||
        (filter === 'notInLibrary' && !libraryOrder.has(exercise.cdnslug || exercise.cdnSlug)) ||
        (filter === 'youtube' && firstVideo(exercise)?.url?.includes('youtube')) ||
        (filter === 'missingDefault' && !exercise.media?.some((item) => item.source === 'uploaded')) ||
        (filter === 'reviewed' && exercise.metadata?.reviewed === true) ||
        (filter === 'pendingReview' && exercise.metadata?.reviewed !== true) ||
        (filter === 'inactive' && exercise.isActive === false);
      return matchesTerm && matchesFilter;
    }).sort((a, b) => {
      const aSlug = a.cdnslug || a.cdnSlug;
      const bSlug = b.cdnslug || b.cdnSlug;
      const aOrder = libraryOrder.has(aSlug) ? libraryOrder.get(aSlug) : Number.MAX_SAFE_INTEGER;
      const bOrder = libraryOrder.has(bSlug) ? libraryOrder.get(bSlug) : Number.MAX_SAFE_INTEGER;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [exercises, filter, librarySlugs, query]);

  const options = useMemo(() => ({
    categories: uniqueOptions(exercises, (exercise) => [exercise.category]),
    levels: uniqueOptions(exercises, (exercise) => [exercise.level]),
    forces: uniqueOptions(exercises, (exercise) => [exercise.force]),
    mechanics: uniqueOptions(exercises, (exercise) => [exercise.mechanic]),
    equipment: uniqueOptions(exercises, (exercise) => [exercise.equipment]),
    muscles: uniqueOptions(exercises, (exercise) => [...(exercise.primaryMuscles || []), ...(exercise.secondaryMuscles || [])]),
    movementPatterns: uniqueOptions(exercises, (exercise) => exercise.classification?.movementPattern),
    laterality: uniqueOptions(exercises, (exercise) => exercise.classification?.laterality),
    classificationEquipment: uniqueOptions(exercises, (exercise) => exercise.classification?.equipment),
  }), [exercises]);

  function patchSelected(patch) {
    setExercises((current) => current.map((exercise) => (exercise.id === selected.id ? updateExercise(exercise, patch) : exercise)));
    setDirty(true);
  }

  function patchExercise(id, patch) {
    setExercises((current) => current.map((exercise) => (exercise.id === id ? updateExercise(exercise, patch) : exercise)));
    setDirty(true);
  }

  function setReviewed(exercise, reviewed) {
    patchExercise(exercise.id, {
      metadata: {
        reviewed,
        reviewedAt: reviewed ? new Date().toISOString() : null,
      },
    });
  }

  async function save() {
    setSaving(true);
    setLog('');
    try {
      const res = await fetch('/api/exercises', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exercises }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setDirty(false);
      setLog(`Saved ${data.count} exercises\n${paths.jsonPath}\n${paths.ndjsonPath}`);
    } catch (error) {
      setLog(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function run(action, label) {
    setRunning(label);
    setLog('');
    try {
      const res = await fetch('/api/media/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, id: selected.id, arkApiKey: arkApiKey.trim() || undefined }),
      });
      const data = await res.json();
      setLog(data.output || data.error || JSON.stringify(data, null, 2));
    } finally {
      await refreshStatus();
      setRunning('');
    }
  }

  function terminalVideoState(output) {
    if (/downloaded=true|Reminder: run `npm run videos:sync-json`/i.test(output)) return 'downloaded';
    if (/: succeeded/i.test(output)) return 'succeeded';
    if (/: failed|: cancelled|: expired|Ark request failed|No created tasks to poll/i.test(output)) return 'failed';
    if (/Missing ARK_API_KEY/i.test(output)) return 'failed';
    return null;
  }

  async function generateAiVideo() {
    setRunning('Generando video con IA');
    setLog('');

    const maxAttempts = 24;
    const intervalMs = 5000;
    let outputLog = '';

    try {
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        const res = await fetch('/api/media/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'generate-ai-video', id: selected.id, arkApiKey: arkApiKey.trim() || undefined }),
        });
        const data = await res.json();
        const chunk = data.output || data.error || JSON.stringify(data, null, 2);
        outputLog += `${attempt === 1 ? '' : '\n\n'}[intento ${attempt}/${maxAttempts}]\n${chunk}`;
        setLog(outputLog);

        await refreshStatus(selected.id);

        const terminal = terminalVideoState(chunk);
        if (terminal === 'downloaded' || terminal === 'failed') break;
        if (attempt < maxAttempts) await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
    } finally {
      await refreshStatus();
      setRunning('');
    }
  }

  if (!selected) return <main className="loading">Loading exercises...</main>;

  const video = firstVideo(selected);
  const image = firstImage(selected);
  const aiTaskStatus = status.arkTask?.error ? 'failed' : status.arkTask?.status || null;
  const taskStatusLabels = {
    created: 'Tarea creada',
    queued: 'En cola',
    running: 'Procesando',
    succeeded: 'Completado',
    failed: 'Fallido',
    cancelled: 'Cancelado',
    expired: 'Expirado',
  };
  const defaultState = status.defaultClip ? 'Listo' : running === 'Generando video con IA' ? 'Generando' : taskStatusLabels[aiTaskStatus] || 'Pendiente';
  const defaultStateClass = status.defaultClip ? 'ready' : running === 'Generando video con IA' || ['created', 'queued', 'running'].includes(aiTaskStatus) ? 'working' : 'missing';
  const sourceState = status.sourceClip ? 'Listo' : 'Falta source';

  return (
    <main className="app">
      <aside className="sidebar">
        <div className="toolbar">
          <div className="search">
            <Search size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search exercises" />
          </div>
          <select value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="all">All</option>
            <option value="library">In library</option>
            <option value="notInLibrary">Not in library</option>
            <option value="youtube">YouTube</option>
            <option value="missingDefault">Missing default</option>
            <option value="pendingReview">Pending review</option>
            <option value="reviewed">Reviewed</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div className="count">{filtered.length} / {exercises.length} · {librarySlugs.length} folders</div>
        <div className="list">
          {filtered.map((exercise) => {
            const defaultIndicator = defaultIndicatorFor(exercise);
            return (
              <button
                className={exercise.id === selected.id ? 'row active' : 'row'}
                key={exercise.id}
                onClick={() => setSelectedId(exercise.id)}
              >
                <span className="rowTop">
                  <span className="rowTitle">
                    <span
                      className={`defaultDot ${defaultIndicator.className}`}
                      title={defaultIndicator.label}
                      aria-label={defaultIndicator.label}
                    />
                    <strong>{exercise.name}</strong>
                  </span>
                  <span className="badges">
                    {librarySlugs.includes(exercise.cdnslug || exercise.cdnSlug) && <span title="In library">L</span>}
                    {exercise.metadata?.reviewed && <Check size={13} />}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="preview">
        <div className="previewHeader">
          <div>
            <h1>{selected.i18n?.name?.es || selected.name}</h1>
            <p>{selected.name} · {selected.category} · {selected.equipment || 'no equipment'}</p>
          </div>
          <div className="headerActions">
            <button
              className={selected.metadata?.reviewed ? 'review reviewed' : 'review'}
              onClick={() => setReviewed(selected, selected.metadata?.reviewed !== true)}
            >
              <Check size={17} /> {selected.metadata?.reviewed ? 'Reviewed' : 'Mark reviewed'}
            </button>
            <button className="primary" onClick={save} disabled={!dirty || saving}>
              <Save size={17} /> {saving ? 'Saving' : dirty ? 'Save' : 'Saved'}
            </button>
          </div>
        </div>

        <div className="mediaBox">
          {video?.url?.endsWith('.mp4') ? (
            <video src={video.url} controls playsInline />
          ) : video?.url ? (
            <iframe src={video.url} allow="autoplay; encrypted-media; picture-in-picture" />
          ) : image?.url || image?.thumbnailUrl ? (
            <img src={image.thumbnailUrl || image.url} />
          ) : (
            <div className="emptyMedia">No media</div>
          )}
        </div>

        <div className="statusGrid" aria-label="Media status">
          <div>
            <strong>Source video</strong>
            <span className={status.sourceClip ? 'state ready' : 'state missing'}>{sourceState}</span>
          </div>
          <div className="primaryStatus">
            <strong>Default generado</strong>
            <span className={`state ${defaultStateClass}`}>{defaultState}</span>
            {status.arkTask?.taskId && <small>Task ID: {status.arkTask.taskId}</small>}
          </div>
          <div>
            <strong>Originales</strong>
            <span>{status.downloadedOriginals?.length || 0} descargados</span>
          </div>
        </div>

        <div className="actions">
          <button title="Muestra el prompt y payload que se enviarian para crear el task" onClick={() => run('preview-source-task', 'Previewing task')} disabled={Boolean(running)}>
            <Play size={16} /> Previsualizar task
          </button>
          <button className="primary" title="Descarga source si hace falta, crea o reutiliza la tarea de IA, consulta el estado, descarga el resultado y sincroniza el default" onClick={generateAiVideo} disabled={Boolean(running)}>
            <Sparkles size={16} /> Generar video con IA
          </button>
        </div>

        {running && <div className="running"><FileVideo size={16} /> {running}...</div>}
        {log && <pre className="log">{log}</pre>}
      </section>

      <section className="editor">
        <div className="tabs">
          <button className={editorTab === 'main' ? 'tab active' : 'tab'} onClick={() => setEditorTab('main')}>Main</button>
          <button className={editorTab === 'translations' ? 'tab active' : 'tab'} onClick={() => setEditorTab('translations')}>Translations</button>
          <button className={editorTab === 'settings' ? 'tab active' : 'tab'} onClick={() => setEditorTab('settings')}>Settings</button>
        </div>

        {editorTab === 'main' && (
          <>
            <div className="editorSection">
              <h2>English source</h2>
              <label>
                Name
                <input value={selected.name || ''} onChange={(event) => patchSelected({ name: event.target.value, i18n: { name: { ...selected.i18n?.name, en: event.target.value } } })} />
              </label>
              <label>
                Instructions
                <textarea className="tall" value={asLines(selected.instructions)} onChange={(event) => patchSelected({ instructions: fromLines(event.target.value), i18n: { instructions: { ...selected.i18n?.instructions, en: fromLines(event.target.value) } } })} />
              </label>
            </div>

            <div className="editorSection">
              <h2>Classification</h2>
              <label>
                CDN slug
                <input value={selected.cdnslug || ''} onChange={(event) => patchSelected({ cdnslug: event.target.value })} />
              </label>
              <div className="split">
                <SelectField label="Category" value={selected.category} options={options.categories} onChange={(category) => patchSelected({ category, i18n: { category: { ...selected.i18n?.category, en: category } } })} />
                <SelectField label="Level" value={selected.level} options={options.levels} onChange={(level) => patchSelected({ level })} />
              </div>
              <div className="split">
                <SelectField label="Force" value={selected.force} options={options.forces} onChange={(force) => patchSelected({ force, classification: { forceType: force ? [force] : [] } })} />
                <SelectField label="Mechanic" value={selected.mechanic} options={options.mechanics} onChange={(mechanic) => patchSelected({ mechanic, classification: { mechanic: mechanic ? [mechanic] : [] } })} />
              </div>
              <SelectField label="Equipment" value={selected.equipment} options={options.equipment} onChange={(equipment) => patchSelected({ equipment, i18n: { equipment: { ...selected.i18n?.equipment, en: equipment } } })} />
              <MultiSelectField label="Primary muscles" value={selected.primaryMuscles} options={options.muscles} onChange={(primaryMuscles) => patchSelected({ primaryMuscles, classification: { primaryMuscles } })} />
              <MultiSelectField label="Secondary muscles" value={selected.secondaryMuscles} options={options.muscles} onChange={(secondaryMuscles) => patchSelected({ secondaryMuscles, classification: { secondaryMuscles } })} />
              <MultiSelectField label="Movement pattern" value={selected.classification?.movementPattern} options={options.movementPatterns} onChange={(movementPattern) => patchSelected({ classification: { movementPattern } })} />
              <MultiSelectField label="Laterality" value={selected.classification?.laterality} options={options.laterality} onChange={(laterality) => patchSelected({ classification: { laterality } })} />
              <MultiSelectField label="Classification equipment" value={selected.classification?.equipment} options={options.classificationEquipment} onChange={(equipment) => patchSelected({ classification: { equipment } })} />
            </div>

            <div className="editorSection">
              <h2>Review</h2>
              <label className="check">
                <input type="checkbox" checked={selected.isActive !== false} onChange={(event) => patchSelected({ isActive: event.target.checked })} />
                Active
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={selected.metadata?.reviewed === true}
                  onChange={(event) => setReviewed(selected, event.target.checked)}
                />
                Metadata reviewed
              </label>
              <label>
                Review notes
                <textarea
                  value={selected.metadata?.notes || ''}
                  onChange={(event) => patchSelected({ metadata: { notes: event.target.value } })}
                  placeholder="Optional internal notes"
                />
              </label>
            </div>
          </>
        )}

        {editorTab === 'translations' && (
          <div className="editorSection">
            <h2>Spanish translation</h2>
            <label>
              Name
              <input value={selected.i18n?.name?.es || ''} onChange={(event) => patchSelected({ i18n: { name: { ...selected.i18n?.name, es: event.target.value } } })} />
            </label>
            <label>
              Category
              <input value={selected.i18n?.category?.es || ''} onChange={(event) => patchSelected({ i18n: { category: { ...selected.i18n?.category, es: event.target.value } } })} />
            </label>
            <label>
              Equipment
              <input value={selected.i18n?.equipment?.es || ''} onChange={(event) => patchSelected({ i18n: { equipment: { ...selected.i18n?.equipment, es: event.target.value } } })} />
            </label>
            <label>
              Instructions
              <textarea className="tall" value={asLines(selected.i18n?.instructions?.es)} onChange={(event) => patchSelected({ i18n: { instructions: { ...selected.i18n?.instructions, es: fromLines(event.target.value) } } })} />
            </label>
          </div>
        )}

        {editorTab === 'settings' && (
          <div className="editorSection">
            <h2>Local settings</h2>
            <label>
              ARK API key
              <input
                type="password"
                value={arkApiKey}
                onChange={(event) => {
                  setArkApiKey(event.target.value);
                  localStorage.setItem('tsl26.arkApiKey', event.target.value);
                }}
                placeholder="Stored in this browser only"
              />
            </label>
            <p className="hint">You can also set it in scripts/tsl26/editor/.env as ARK_API_KEY=...</p>
          </div>
        )}
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
