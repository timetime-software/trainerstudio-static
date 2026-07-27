#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cdnSlugFor, matchesExerciseIdentifier } from './exercise-ids.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '../..');
const DEFAULT_INPUT = path.join(SCRIPT_DIR, 'data/exercises.ndjson');
const DEFAULT_LIBRARY_ROOT = path.join(REPO_ROOT, 'libraries/tsl26');
const DEFAULT_DOWNLOAD_ROOT = path.join(SCRIPT_DIR, '.workspace/videos/trainerize');
const DEFAULT_MANIFEST = path.join(SCRIPT_DIR, '.workspace/manifests/source-anonymization-full.json');

function parseArgs(argv) {
  const options = {
    input: DEFAULT_INPUT,
    libraryRoot: DEFAULT_LIBRARY_ROOT,
    downloadRoot: DEFAULT_DOWNLOAD_ROOT,
    manifest: DEFAULT_MANIFEST,
    concurrency: 2,
    thresh: 0.1,
    maskScale: 1,
    replaceWith: 'blur',
    passes: 1,
    limit: null,
    ids: null,
    reprocess: false,
  };

  for (const arg of argv) {
    const [key, rawValue = ''] = arg.split('=');
    if (key === '--input') options.input = path.resolve(rawValue);
    else if (key === '--library-root') options.libraryRoot = path.resolve(rawValue);
    else if (key === '--download-root') options.downloadRoot = path.resolve(rawValue);
    else if (key === '--manifest') options.manifest = path.resolve(rawValue);
    else if (key === '--concurrency') options.concurrency = Number(rawValue);
    else if (key === '--thresh') options.thresh = Number(rawValue);
    else if (key === '--mask-scale') options.maskScale = Number(rawValue);
    else if (key === '--replace') options.replaceWith = rawValue;
    else if (key === '--passes') options.passes = Number(rawValue);
    else if (key === '--limit') options.limit = Number(rawValue);
    else if (key === '--ids') options.ids = new Set(rawValue.split(',').map((value) => value.trim()).filter(Boolean));
    else if (key === '--reprocess') options.reprocess = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (!Number.isInteger(options.concurrency) || options.concurrency < 1 || options.concurrency > 8) {
    throw new Error('--concurrency must be an integer between 1 and 8');
  }
  if (!['blur', 'solid', 'mosaic', 'none'].includes(options.replaceWith)) throw new Error(`Invalid replacement: ${options.replaceWith}`);
  if (!Number.isInteger(options.passes) || options.passes < 1 || options.passes > 8) throw new Error('--passes must be between 1 and 8');
  return options;
}

async function readExercises(input) {
  const raw = (await fs.readFile(input, 'utf8')).trim();
  if (!raw) return [];
  return raw.startsWith('[')
    ? JSON.parse(raw)
    : raw.split('\n').filter(Boolean).map((line) => JSON.parse(line.replace(/,\s*$/, '')));
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

async function writeJsonAtomic(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp-${process.pid}`;
  await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await fs.rename(temporary, filePath);
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    const append = (chunk) => { output = `${output}${chunk}`.slice(-12000); };
    child.stdout.on('data', append);
    child.stderr.on('data', append);
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(output);
      else reject(new Error(`${command} exited with ${code}: ${output.slice(-2000)}`));
    });
  });
}

async function ensureTool(command, args) {
  await run(command, args).catch(() => { throw new Error(`Required tool is unavailable: ${command}`); });
}

function trainerizeVideos(exercise) {
  const byVariant = new Map();
  for (const item of exercise.media ?? []) {
    if (item?.type !== 'video' || item?.provider !== 'trainerize' || !item?.url) continue;
    const variant = item.providerVariant === 'female' ? 'female' : 'default';
    byVariant.set(variant, item.url);
  }
  return byVariant;
}

function youtubeUrl(exercise) {
  for (const item of exercise.media ?? []) {
    if (item?.type !== 'video' || item?.source !== 'youtube') continue;
    const id = String(item.url ?? '').match(/(?:embed\/|watch\?v=|shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/)?.[1];
    if (id) return `https://www.youtube.com/watch?v=${id}`;
  }
  return null;
}

function safeName(name) {
  return String(name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function originalDownloadsByExercise(exercises, downloadRoot) {
  const files = existsSync(downloadRoot)
    ? requireDirectoryNames(downloadRoot).filter((name) => name.endsWith('_source.mp4'))
    : [];
  const result = new Map();
  for (const exercise of exercises) {
    const exact = files.filter((name) => name.startsWith(`${exercise.id}_`));
    if (exact.length === 1) {
      result.set(exercise.id, path.join(downloadRoot, exact[0]));
      continue;
    }
    const suffix = `_${safeName(exercise.name)}_source.mp4`;
    const byName = files.filter((name) => name.endsWith(suffix));
    if (byName.length === 1) result.set(exercise.id, path.join(downloadRoot, byName[0]));
  }
  return result;
}

function requireDirectoryNames(directory) {
  try {
    return [...new Set(requireDirectoryNames.cache.get(directory) ?? [])];
  } catch {
    return [];
  }
}
requireDirectoryNames.cache = new Map();

function sourcePathFor(options, slug, suffix = '') {
  return path.join(options.libraryRoot, slug, 'source', `${slug}${suffix}.mp4`);
}

function buildTargets(exercises, options, originalDownloads) {
  const targets = [];
  for (const exercise of exercises) {
    const slug = cdnSlugFor(exercise);
    if (!slug) continue;
    if (options.ids && ![...options.ids].some((id) => matchesExerciseIdentifier(exercise, id))) continue;
    const defaultSourcePath = sourcePathFor(options, slug);
    const variants = trainerizeVideos(exercise);
    const defaultUrl = variants.get('default');
    const femaleUrl = variants.get('female');

    if (defaultUrl || femaleUrl) {
      const primaryVariant = defaultUrl ? 'default' : 'female';
      const primaryUrl = defaultUrl ?? femaleUrl;
      const primaryVariants = defaultUrl && femaleUrl === defaultUrl ? ['default', 'female'] : [primaryVariant];
      targets.push({
        key: `${exercise.id}:primary`,
        exerciseId: exercise.id,
        trainerizeId: exercise.metadata?.source?.exerciseId ?? null,
        name: exercise.name,
        slug,
        variants: primaryVariants,
        sourceKind: 'trainerize',
        url: primaryUrl,
        originalPath: null,
        outputPath: defaultSourcePath,
      });
      if (defaultUrl && femaleUrl && femaleUrl !== defaultUrl) {
        targets.push({
          key: `${exercise.id}:female`,
          exerciseId: exercise.id,
          trainerizeId: exercise.metadata?.source?.exerciseId ?? null,
          name: exercise.name,
          slug,
          variants: ['female'],
          sourceKind: 'trainerize',
          url: femaleUrl,
          originalPath: null,
          outputPath: sourcePathFor(options, slug, '.female'),
        });
      }
      continue;
    }

    const originalPath = originalDownloads.get(exercise.id) ?? null;
    const remoteYoutubeUrl = youtubeUrl(exercise);
    if (existsSync(defaultSourcePath) && (originalPath || remoteYoutubeUrl)) {
      targets.push({
        key: `${exercise.id}:local`,
        exerciseId: exercise.id,
        trainerizeId: null,
        name: exercise.name,
        slug,
        variants: ['local'],
        sourceKind: 'youtube',
        url: remoteYoutubeUrl,
        originalPath,
        outputPath: defaultSourcePath,
      });
    }
  }
  return options.limit ? targets.slice(0, options.limit) : targets;
}

function downloadPathFor(target, options) {
  if (target.sourceKind === 'youtube') {
    return path.join(options.downloadRoot, 'youtube', String(target.exerciseId), 'original.mp4');
  }
  const providerId = target.trainerizeId ?? target.exerciseId;
  const variant = target.variants.length > 1 ? 'shared' : target.variants[0];
  return path.join(options.downloadRoot, String(providerId), `${variant}.mp4`);
}

async function downloadOriginal(target, options) {
  if (target.originalPath && await pathExists(target.originalPath)) return target.originalPath;
  const destination = downloadPathFor(target, options);
  if (await pathExists(destination)) return destination;
  await fs.mkdir(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.tmp-${process.pid}-${Date.now()}`;
  let downloadedPath = temporary;
  try {
    if (target.sourceKind === 'youtube') {
      if (!target.url) throw new Error(`YouTube URL is missing for ${target.slug}`);
      downloadedPath = `${temporary}.mp4`;
      await run('python3', [
        '-m', 'yt_dlp', '--force-overwrites', '--no-continue',
        '-f', 'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]/best[height<=480]',
        '--merge-output-format', 'mp4', '-o', downloadedPath, target.url,
      ]);
    } else {
      await run('curl', [
        '--silent', '--show-error', '--fail', '--location',
        '--retry', '4', '--retry-all-errors', '--connect-timeout', '30',
        '--output', temporary, target.url,
      ]);
    }
    await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1', downloadedPath]);
    await fs.rename(downloadedPath, destination);
    return destination;
  } catch (error) {
    await fs.rm(temporary, { force: true });
    if (downloadedPath !== temporary) await fs.rm(downloadedPath, { force: true });
    throw error;
  }
}

async function anonymize(input, output, options) {
  await fs.mkdir(path.dirname(output), { recursive: true });
  const temporary = `${output}.anonymized.tmp-${process.pid}-${Date.now()}.mp4`;
  let currentInput = input;
  const passOutputs = [];
  try {
    for (let pass = 1; pass <= options.passes; pass += 1) {
      const passOutput = pass === options.passes ? temporary : `${temporary}.pass${pass}.mp4`;
      passOutputs.push(passOutput);
      await run('deface', [
        '--thresh', String(options.thresh),
        '--mask-scale', String(options.maskScale),
        '--replacewith', options.replaceWith,
        '--ffmpeg-config', '{"codec":"libx264","macro_block_size":1}',
        '--keep-audio', '-o', passOutput, currentInput,
      ]);
      currentInput = passOutput;
    }
    await fs.rename(temporary, output);
  } finally {
    await Promise.all(passOutputs.map(async (filePath) => {
      if (filePath !== output) await fs.rm(filePath, { force: true }).catch(() => {});
    }));
  }
}

async function fingerprint(filePath) {
  const stat = await fs.stat(filePath);
  const hash = createHash('sha256').update(await fs.readFile(filePath)).digest('hex').slice(0, 16);
  return { size: stat.size, sha256: hash };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await Promise.all([
    ensureTool('curl', ['--version']),
    ensureTool('ffmpeg', ['-version']),
    ensureTool('ffprobe', ['-version']),
    ensureTool('deface', ['--version']),
  ]);

  const exercises = await readExercises(options.input);
  requireDirectoryNames.cache.set(
    path.join(SCRIPT_DIR, '.workspace/videos'),
    await fs.readdir(path.join(SCRIPT_DIR, '.workspace/videos')).catch(() => []),
  );
  const originalDownloads = originalDownloadsByExercise(exercises, path.join(SCRIPT_DIR, '.workspace/videos'));
  const targets = buildTargets(exercises, options, originalDownloads);
  const previous = await readJson(options.manifest, { records: {} });
  const manifest = {
    version: 1,
    updatedAt: new Date().toISOString(),
    settings: {
      preserveOriginalDuration: true,
      preserveOriginalResolution: true,
      preserveOriginalAudio: true,
      replaceWith: options.replaceWith,
      thresh: options.thresh,
      maskScale: options.maskScale,
      passes: options.passes,
    },
    total: targets.length,
    records: previous.records ?? {},
  };
  let manifestQueue = Promise.resolve();
  const persist = () => {
    manifest.updatedAt = new Date().toISOString();
    manifestQueue = manifestQueue.then(() => writeJsonAtomic(options.manifest, manifest));
    return manifestQueue;
  };

  let nextIndex = 0;
  let completed = 0;
  let skipped = 0;
  let failed = 0;
  console.log(`[setup] targets=${targets.length} concurrency=${options.concurrency} mode=${options.replaceWith} thresh=${options.thresh} mask=${options.maskScale} passes=${options.passes}`);

  async function worker(workerId) {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= targets.length) return;
      const target = targets[index];
      const existing = manifest.records[target.key];
      if (!options.reprocess && existing?.status === 'done' && await pathExists(target.outputPath)) {
        skipped += 1;
        console.log(`[${index + 1}/${targets.length}] [skip] ${target.slug} (${target.variants.join('+')})`);
        continue;
      }

      console.log(`[${index + 1}/${targets.length}] [worker ${workerId}] ${target.slug} (${target.variants.join('+')})`);
      manifest.records[target.key] = { ...target, status: 'running', startedAt: new Date().toISOString(), error: null };
      await persist();
      try {
        const input = await downloadOriginal(target, options);
        await anonymize(input, target.outputPath, options);
        const file = await fingerprint(target.outputPath);
        manifest.records[target.key] = {
          ...target,
          status: 'done',
          finishedAt: new Date().toISOString(),
          file,
          error: null,
        };
        completed += 1;
        console.log(`[done] ${target.slug} (${file.size} bytes, ${file.sha256})`);
      } catch (error) {
        failed += 1;
        manifest.records[target.key] = {
          ...target,
          status: 'failed',
          finishedAt: new Date().toISOString(),
          error: error instanceof Error ? error.message : String(error),
        };
        console.error(`[fail] ${target.slug}: ${manifest.records[target.key].error}`);
      }
      await persist();
    }
  }

  await persist();
  await Promise.all(Array.from({ length: options.concurrency }, (_, index) => worker(index + 1)));
  await manifestQueue;
  console.log(`[summary] total=${targets.length} completed=${completed} skipped=${skipped} failed=${failed}`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
