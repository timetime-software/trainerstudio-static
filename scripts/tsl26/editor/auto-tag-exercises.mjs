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
const ndjsonPath = path.join(toolDir, 'data/exercises.ndjson');
const envPath = path.join(editorDir, '.env');

function parseArgs(argv) {
  const out = { ids: [], all: false, limit: null, unreviewed: false, dryRun: false, provider: 'openai', model: '', instructions: '', concurrency: 1, untagged: false };
  for (const arg of argv.slice(2)) {
    if (arg === '--all') out.all = true;
    else if (arg === '--unreviewed') out.unreviewed = true;
    else if (arg === '--untagged') out.untagged = true;
    else if (arg === '--dry-run') out.dryRun = true;
    else if (arg.startsWith('--ids=')) out.ids.push(...arg.slice(6).split(',').map((id) => id.trim()).filter(Boolean));
    else if (arg.startsWith('--limit=')) out.limit = Number(arg.slice(8));
    else if (arg.startsWith('--provider=')) out.provider = arg.slice(11);
    else if (arg.startsWith('--model=')) out.model = arg.slice(8);
    else if (arg.startsWith('--instructions=')) out.instructions = arg.slice(15);
    else if (arg.startsWith('--concurrency=')) out.concurrency = Math.max(1, Number(arg.slice(14)) || 1);
    else if (arg === '--help' || arg === '-h') out.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return out;
}

function printHelp() {
  console.log(`Usage: node auto-tag-exercises.mjs [options]

Auto-tags exercises in data/exercises.ndjson via the same OpenAI review the editor
uses ("propose_changes" tool). All proposed fields are applied automatically.

Selection (combine as needed):
  --ids=a,b,c       Apply to specific exercise ids / cdnslugs / identityKeys
  --all             Apply to every exercise in the NDJSON
  --untagged        Filter to exercises missing classification fields
  --unreviewed      Filter to exercises without metadata.reviewed=true
  --limit=N         Cap the number of exercises processed

Behavior:
  --provider=NAME   "openai" (default) or "anthropic"
  --model=ID        Override default model (gpt-5-mini / claude-sonnet-4-6)
  --instructions=S  Extra reviewer instructions appended to the prompt
  --concurrency=N   Parallel API calls (default 1)
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

function isUntagged(exercise) {
  const classification = exercise?.classification || {};
  const missingTopLevel = !exercise.category || !exercise.level || !exercise.force || !exercise.mechanic || !exercise.equipment;
  const missingMuscles = !Array.isArray(exercise.primaryMuscles) || exercise.primaryMuscles.length === 0;
  const missingClassification = !Array.isArray(classification.movementPattern) || classification.movementPattern.length === 0
    || !Array.isArray(classification.laterality) || classification.laterality.length === 0;
  return missingTopLevel || missingMuscles || missingClassification;
}

function selectExercises(exercises, options) {
  let pool = exercises;
  if (options.ids.length) {
    pool = options.ids
      .map((id) => findExerciseByIdentifier(exercises, id))
      .filter(Boolean);
    if (pool.length !== options.ids.length) {
      const found = new Set(pool.map((e) => e.id));
      const missing = options.ids.filter((id) => !findExerciseByIdentifier(exercises, id));
      console.warn(`! Could not find ${missing.length} requested ids: ${missing.join(', ')}`);
    }
  } else if (!options.all && !options.unreviewed && !options.untagged) {
    throw new Error('Select exercises with --ids=..., --all, --unreviewed, or --untagged. Use --help for details.');
  }
  if (options.unreviewed) pool = pool.filter((e) => !e?.metadata?.reviewed);
  if (options.untagged) pool = pool.filter(isUntagged);
  if (options.limit) pool = pool.slice(0, options.limit);
  return pool;
}

function summarizePatch(patch) {
  if (!patch) return '(no changes)';
  return Object.keys(patch).join(', ') || '(no changes)';
}

async function tagOne(exercise, options, apiKeys) {
  const result = await proposeExerciseChanges({
    exercise,
    instructions: options.instructions,
    provider: options.provider,
    apiKeys,
    models: { openai: options.model, anthropic: options.model },
  });
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
  const targets = selectExercises(exercises, options);
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
