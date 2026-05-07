#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, renameSync, copyFileSync, unlinkSync, statSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { cdnSlugFor, matchesExerciseIdentifier } from './exercise-ids.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');
const LIBRARY_ROOT = join(REPO_ROOT, 'libraries/tsl26');
const TOOL_ROOT = __dirname;
const DEFAULT_INPUT = join(TOOL_ROOT, 'data/exercises.ndjson');

function parseArgs(argv) {
  const args = {
    input: DEFAULT_INPUT,
    ids: null,
    slugs: null,
    all: false,
    thresh: 0.2,
    maskScale: 1.5,
    replaceWith: 'blur',
    mosaicSize: 20,
    passes: 1,
    keepOriginal: false,
    continueOnError: false,
  };

  for (const arg of argv) {
    const [key, rawValue] = arg.split('=');
    const value = rawValue ?? '';

    if (key === '--input') args.input = resolve(value);
    else if (key === '--ids') args.ids = new Set(value.split(',').map((id) => id.trim()).filter(Boolean));
    else if (key === '--slugs') args.slugs = new Set(value.split(',').map((slug) => slug.trim()).filter(Boolean));
    else if (key === '--all') args.all = true;
    else if (key === '--thresh') args.thresh = Number(value);
    else if (key === '--mask-scale') args.maskScale = Number(value);
    else if (key === '--replace') args.replaceWith = value;
    else if (key === '--mosaic-size') args.mosaicSize = Number(value);
    else if (key === '--passes') args.passes = Number(value);
    else if (key === '--keep-original') args.keepOriginal = true;
    else if (key === '--continue-on-error') args.continueOnError = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (!args.ids && !args.slugs && !args.all) {
    throw new Error('Provide --ids=..., --slugs=..., or --all');
  }
  if (!['blur', 'solid', 'mosaic', 'none', 'img'].includes(args.replaceWith)) {
    throw new Error(`Invalid --replace value: ${args.replaceWith}`);
  }
  if (!Number.isFinite(args.passes) || args.passes < 1 || args.passes > 8) {
    throw new Error(`Invalid --passes value: ${args.passes} (expected 1-8)`);
  }

  return args;
}

function loadExercises(input) {
  const raw = readFileSync(input, 'utf8').trim();
  if (raw.startsWith('[')) return JSON.parse(raw);
  return raw.split('\n').filter(Boolean).map((line) => JSON.parse(line.replace(/,\s*$/, '')));
}

function resolveDefaceCommand() {
  const candidates = [
    process.env.DEFACE_BIN,
    'deface',
    join(process.env.HOME || '', '.local/bin/deface'),
    '/usr/local/bin/deface',
    '/opt/homebrew/bin/deface',
  ].filter(Boolean);

  for (const candidate of candidates) {
    const result = spawnSync(candidate, ['--version'], { stdio: 'ignore' });
    if (result.status === 0) return candidate;
  }
  return null;
}

function defaceVideo({ command, input, output, thresh, maskScale, replaceWith, mosaicSize }) {
  mkdirSync(dirname(output), { recursive: true });
  const args = [
    '--thresh', String(thresh),
    '--mask-scale', String(maskScale),
    '--replacewith', replaceWith,
    '--keep-audio',
    '-o', output,
    input,
  ];
  if (replaceWith === 'mosaic') {
    args.splice(args.indexOf('--keep-audio'), 0, '--mosaicsize', String(mosaicSize));
  }
  return spawnSync(command, args, { stdio: 'inherit' });
}

function processSlug({ slug, options, command }) {
  const sourceDir = join(LIBRARY_ROOT, slug, 'source');
  const sourcePath = join(sourceDir, `${slug}.mp4`);
  if (!existsSync(sourcePath)) {
    console.log(`[skip] ${slug}: source video not found at ${sourcePath}`);
    return { slug, ok: false, reason: 'missing-source' };
  }

  const sizeBefore = statSync(sourcePath).size;
  if (options.keepOriginal) {
    const backupPath = join(sourceDir, `${slug}.original.mp4`);
    if (!existsSync(backupPath)) copyFileSync(sourcePath, backupPath);
  }

  let currentInput = sourcePath;
  const tmpOutputs = [];
  for (let pass = 1; pass <= options.passes; pass += 1) {
    const tmpOutput = join(sourceDir, `${slug}.deface.pass${pass}.mp4`);
    if (existsSync(tmpOutput)) unlinkSync(tmpOutput);
    tmpOutputs.push(tmpOutput);

    console.log(`[deface] ${slug}: pass ${pass}/${options.passes} (mode=${options.replaceWith}, thresh=${options.thresh}, mask=${options.maskScale})`);
    const result = defaceVideo({
      command,
      input: currentInput,
      output: tmpOutput,
      thresh: options.thresh,
      maskScale: options.maskScale,
      replaceWith: options.replaceWith,
      mosaicSize: options.mosaicSize,
    });

    if (result.status !== 0 || !existsSync(tmpOutput)) {
      tmpOutputs.forEach((path) => { if (existsSync(path)) unlinkSync(path); });
      console.log(`[fail] ${slug}: deface exited with status ${result.status} on pass ${pass}`);
      return { slug, ok: false, reason: `exit-${result.status}-pass-${pass}` };
    }

    currentInput = tmpOutput;
  }

  renameSync(currentInput, sourcePath);
  tmpOutputs.slice(0, -1).forEach((path) => { if (existsSync(path)) unlinkSync(path); });

  const sizeAfter = statSync(sourcePath).size;
  console.log(`[done] ${slug}: replaced source after ${options.passes} pass(es) (${sizeBefore} -> ${sizeAfter} bytes)`);
  return { slug, ok: true, sizeBefore, sizeAfter, passes: options.passes };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const command = resolveDefaceCommand();
  if (!command) {
    console.error('deface CLI not found. Install with: pip install --user deface');
    console.error('(or set DEFACE_BIN to the absolute path of the deface binary).');
    process.exit(127);
  }
  console.log(`[setup] using deface at ${command}`);

  const exercises = loadExercises(options.input);
  const targetSlugs = new Set();

  if (options.all) {
    for (const exercise of exercises) {
      const slug = cdnSlugFor(exercise);
      if (slug) targetSlugs.add(slug);
    }
  } else {
    for (const exercise of exercises) {
      const slug = cdnSlugFor(exercise);
      if (!slug) continue;
      if (options.ids && [...options.ids].some((id) => matchesExerciseIdentifier(exercise, id))) targetSlugs.add(slug);
      if (options.slugs?.has(slug)) targetSlugs.add(slug);
    }
    if (options.slugs) {
      for (const slug of options.slugs) targetSlugs.add(slug);
    }
  }

  if (targetSlugs.size === 0) {
    console.error('No matching slugs to process.');
    process.exit(1);
  }

  const results = [];
  for (const slug of targetSlugs) {
    try {
      results.push(processSlug({ slug, options, command }));
    } catch (error) {
      console.log(`[error] ${slug}: ${error.message}`);
      results.push({ slug, ok: false, reason: error.message });
      if (!options.continueOnError) break;
    }
  }

  const okCount = results.filter((r) => r.ok).length;
  const failCount = results.length - okCount;
  console.log(`\n[summary] processed=${results.length} ok=${okCount} failed=${failCount}`);
  if (failCount > 0 && !options.continueOnError) process.exit(1);
}

main();
