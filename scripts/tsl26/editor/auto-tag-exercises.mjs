#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findExerciseByIdentifier } from '../exercise-ids.mjs';
import { proposeExerciseChanges } from './lib-server/reviewer.mjs';
import { updateExercise } from './src/lib/exercise.js';
import { buildPatchFromProposal } from './src/lib/reviewPatch.js';

const editorDir = path.dirname(fileURLToPath(import.meta.url));
const toolDir = path.resolve(editorDir, '..');
const repoRoot = path.resolve(toolDir, '../..');
const ndjsonPath = path.join(toolDir, 'data/exercises.ndjson');
const libraryRoot = path.join(repoRoot, 'libraries/tsl26');
const envPath = path.join(editorDir, '.env');

function parseArgs(argv) {
  const out = { ids: [], all: false, limit: null, includeReviewed: false, dryRun: false, provider: 'openai', model: '', instructions: '', concurrency: 1, untagged: false, hasDefault: false, retries: 4 };
  for (const arg of argv.slice(2)) {
    if (arg === '--all') out.all = true;
    else if (arg === '--include-reviewed') out.includeReviewed = true;
    else if (arg === '--untagged') out.untagged = true;
    else if (arg === '--has-default') out.hasDefault = true;
    else if (arg === '--dry-run') out.dryRun = true;
    else if (arg.startsWith('--ids=')) out.ids.push(...arg.slice(6).split(',').map((id) => id.trim()).filter(Boolean));
    else if (arg.startsWith('--limit=')) out.limit = Number(arg.slice(8));
    else if (arg.startsWith('--provider=')) out.provider = arg.slice(11);
    else if (arg.startsWith('--model=')) out.model = arg.slice(8);
    else if (arg.startsWith('--instructions=')) out.instructions = arg.slice(15);
    else if (arg.startsWith('--concurrency=')) out.concurrency = Math.max(1, Number(arg.slice(14)) || 1);
    else if (arg.startsWith('--retries=')) out.retries = Math.max(0, Number(arg.slice(10)) || 0);
    else if (arg === '--help' || arg === '-h') out.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return out;
}

function printHelp() {
  console.log(`Usage: node auto-tag-exercises.mjs [options]

Auto-tags exercises in data/exercises.ndjson via the same OpenAI review the editor
uses ("propose_changes" tool). All proposed fields are applied automatically.

Exercises with metadata.reviewed=true are skipped by default (already validated).

Selection (combine as needed):
  --ids=a,b,c        Apply to specific exercise ids / cdnslugs / identityKeys
  --all              Apply to every exercise in the NDJSON
  --has-default      Filter to exercises with a default video file on disk
  --untagged         Filter to exercises missing classification fields
  --include-reviewed Also process exercises marked metadata.reviewed=true
  --limit=N          Cap the number of exercises processed

Behavior:
  --provider=NAME   "openai" (default) or "anthropic"
  --model=ID        Override default model (gpt-5-mini / claude-sonnet-4-6)
  --instructions=S  Extra reviewer instructions appended to the prompt
  --concurrency=N   Parallel API calls (default 1)
  --retries=N       Retry transient errors (429/5xx) per call (default 4)
  --dry-run         Print proposed patches but do not write the NDJSON

Reads OPENAI_API_KEY / ANTHROPIC_API_KEY from ${path.relative(process.cwd(), envPath)} or process.env.
`);
}

async function readEnvFile() {
  const raw = await fs.readFile(envPath, 'utf8').catch(() => '');
  return Object.fromEntries(
    raw
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const index = line.indexOf('=');
        return [line.slice(0, index), line.slice(index + 1).replace(/^["']|["']$/g, '')];
      }),
  );
}

async function readExercises() {
  const raw = await fs.readFile(ndjsonPath, 'utf8');
  return raw.split('\n').filter(Boolean).map((line) => JSON.parse(line));
}

async function writeExercises(exercises) {
  await fs.writeFile(ndjsonPath, `${exercises.map((exercise) => JSON.stringify(exercise)).join('\n')}\n`);
}

async function readDefaultSlugs() {
  const entries = await fs.readdir(libraryRoot, { withFileTypes: true }).catch(() => []);
  const slugs = new Set();
  await Promise.all(entries.filter((e) => e.isDirectory()).map(async (entry) => {
    const slug = entry.name;
    try {
      await fs.access(path.join(libraryRoot, slug, 'default', `${slug}.mp4`));
      slugs.add(slug);
    } catch {}
  }));
  return slugs;
}

function exerciseHasDefaultOnDisk(exercise, defaultSlugs) {
  const slug = exercise?.cdnslug || exercise?.cdnSlug;
  return Boolean(slug && defaultSlugs.has(slug));
}

function isTransientError(error) {
  const status = error?.status ?? error?.response?.status;
  if (status === 429) return true;
  if (typeof status === 'number' && status >= 500 && status < 600) return true;
  const code = error?.code || error?.cause?.code || '';
  return ['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_SOCKET'].includes(code);
}

async function withRetry(fn, retries) {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= retries || !isTransientError(error)) throw error;
      const baseMs = 1000 * Math.pow(2, attempt);
      const jitter = Math.floor(Math.random() * 500);
      await new Promise((resolve) => setTimeout(resolve, baseMs + jitter));
      attempt += 1;
    }
  }
}

function isUntagged(exercise) {
  const classification = exercise?.classification || {};
  const missingTopLevel = !exercise.category || !exercise.level || !exercise.force || !exercise.mechanic || !exercise.equipment;
  const missingMuscles = !Array.isArray(exercise.primaryMuscles) || exercise.primaryMuscles.length === 0;
  const missingClassification = !Array.isArray(classification.movementPattern) || classification.movementPattern.length === 0
    || !Array.isArray(classification.laterality) || classification.laterality.length === 0;
  return missingTopLevel || missingMuscles || missingClassification;
}

function selectExercises(exercises, options, defaultSlugs) {
  let pool = exercises;
  if (options.ids.length) {
    pool = options.ids
      .map((id) => findExerciseByIdentifier(exercises, id))
      .filter(Boolean);
    if (pool.length !== options.ids.length) {
      const missing = options.ids.filter((id) => !findExerciseByIdentifier(exercises, id));
      console.warn(`! Could not find ${missing.length} requested ids: ${missing.join(', ')}`);
    }
  } else if (!options.all && !options.untagged && !options.hasDefault) {
    throw new Error('Select exercises with --ids=..., --all, --has-default, or --untagged. Use --help for details.');
  }
  if (options.hasDefault) pool = pool.filter((e) => exerciseHasDefaultOnDisk(e, defaultSlugs));
  if (options.untagged) pool = pool.filter(isUntagged);
  if (!options.includeReviewed) {
    const before = pool.length;
    pool = pool.filter((e) => !e?.metadata?.reviewed);
    const skipped = before - pool.length;
    if (skipped > 0) console.log(`Skipping ${skipped} exercise${skipped === 1 ? '' : 's'} already marked metadata.reviewed=true (use --include-reviewed to override).`);
  }
  if (options.limit) pool = pool.slice(0, options.limit);
  return pool;
}

function summarizePatch(patch) {
  if (!patch) return '(no changes)';
  return Object.keys(patch).join(', ') || '(no changes)';
}

async function tagOne(exercise, options, apiKeys) {
  const result = await withRetry(() => proposeExerciseChanges({
    exercise,
    instructions: options.instructions,
    provider: options.provider,
    apiKeys,
    models: { openai: options.model, anthropic: options.model },
  }), options.retries);
  const proposal = { provider: options.provider, exerciseId: exercise.id, patch: result.patch || {}, rationale: result.rationale || {} };
  const selectedFields = Object.fromEntries(Object.keys(proposal.patch).map((key) => [key, true]));
  const patch = buildPatchFromProposal(exercise, proposal, selectedFields);
  if (!patch) return { exercise, proposal, patch: null, updated: exercise };
  const updated = updateExercise(exercise, patch);
  return { exercise, proposal, patch, updated };
}

async function runWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function next() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      try {
        results[index] = await worker(items[index], index);
      } catch (error) {
        results[index] = { error };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => next()));
  return results;
}

async function main() {
  const options = parseArgs(process.argv);
  if (options.help) {
    printHelp();
    return;
  }

  const localEnv = await readEnvFile();
  const apiKeys = {
    openai: process.env.OPENAI_API_KEY || localEnv.OPENAI_API_KEY || '',
    anthropic: process.env.ANTHROPIC_API_KEY || localEnv.ANTHROPIC_API_KEY || '',
  };

  const exercises = await readExercises();
  const defaultSlugs = options.hasDefault ? await readDefaultSlugs() : new Set();
  const targets = selectExercises(exercises, options, defaultSlugs);
  if (!targets.length) {
    console.log('No exercises matched the selection.');
    return;
  }

  console.log(`Auto-tagging ${targets.length} exercise${targets.length === 1 ? '' : 's'} via ${options.provider}${options.dryRun ? ' (dry-run)' : ''}...`);

  const exerciseIndex = new Map(exercises.map((exercise, index) => [exercise.id, index]));
  let written = 0;
  let pendingFlush = 0;

  const flush = async () => {
    if (options.dryRun || pendingFlush === 0) return;
    await writeExercises(exercises);
    pendingFlush = 0;
  };

  const results = await runWithConcurrency(targets, options.concurrency, async (target, index) => {
    const label = `[${index + 1}/${targets.length}] ${target.name || target.id}`;
    try {
      const { proposal, patch, updated } = await tagOne(target, options, apiKeys);
      if (!patch) {
        console.log(`${label} — no changes proposed`);
        return { ok: true, target, patch: null };
      }
      console.log(`${label} — patched: ${summarizePatch(proposal.patch)}`);
      if (!options.dryRun) {
        const slot = exerciseIndex.get(target.id);
        if (slot != null) {
          exercises[slot] = updated;
          pendingFlush += 1;
          written += 1;
          if (pendingFlush >= 5) await flush();
        }
      }
      return { ok: true, target, patch };
    } catch (error) {
      console.error(`${label} — FAILED: ${error.message}`);
      return { ok: false, target, error };
    }
  });

  await flush();

  const failed = results.filter((r) => r && !r.ok).length;
  const noChange = results.filter((r) => r?.ok && !r.patch).length;
  const changed = results.length - failed - noChange;
  console.log(`Done. changed=${changed} unchanged=${noChange} failed=${failed}${options.dryRun ? ' (dry-run, no file written)' : ` written=${written}`}`);
  if (failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
