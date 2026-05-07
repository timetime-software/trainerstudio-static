#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '../..');
const DEFAULT_LIBRARY_ROOT = path.join(REPO_ROOT, 'libraries/tsl26');

function getArgValue(name) {
  const inline = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (inline) return inline.slice(name.length + 3);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function pickInputVariant(libraryRoot, slug, mode) {
  const defaultMp4 = path.join(libraryRoot, slug, 'default', `${slug}.mp4`);
  const sourceMp4 = path.join(libraryRoot, slug, 'source', `${slug}.mp4`);
  if (mode === 'default') return defaultMp4;
  if (mode === 'source') return sourceMp4;
  return { auto: true, defaultMp4, sourceMp4 };
}

async function resolveInput(libraryRoot, slug, mode) {
  const picked = pickInputVariant(libraryRoot, slug, mode);
  if (picked && picked.auto) {
    if (await pathExists(picked.defaultMp4)) return picked.defaultMp4;
    if (await pathExists(picked.sourceMp4)) return picked.sourceMp4;
    return null;
  }
  return (await pathExists(picked)) ? picked : null;
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with ${code}: ${stderr.trim().split('\n').slice(-3).join(' | ')}`));
    });
  });
}

async function extractThumbnail(inputPath, outputPath, timeSeconds, height) {
  const args = [
    '-y',
    '-ss', String(timeSeconds),
    '-i', inputPath,
    '-frames:v', '1',
    '-vf', `scale=-2:${height}`,
    outputPath,
  ];
  await runFfmpeg(args);
}

async function main() {
  const libraryRoot = path.resolve(getArgValue('library-root') ?? DEFAULT_LIBRARY_ROOT);
  const mode = getArgValue('from') ?? 'default';
  const timeSeconds = Number(getArgValue('time') ?? 1.5);
  const height = Number(getArgValue('height') ?? 480);
  const limit = getArgValue('limit') ? Number(getArgValue('limit')) : Infinity;
  const onlySlugs = (getArgValue('slugs') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const overwrite = hasFlag('overwrite');
  const dryRun = hasFlag('dry-run');

  if (!['auto', 'source', 'default'].includes(mode)) {
    throw new Error(`--from must be one of auto|source|default (got ${mode})`);
  }

  const entries = await fs.readdir(libraryRoot, { withFileTypes: true });
  const slugs = entries
    .filter((entry) => entry.isDirectory() && entry.name !== 'references')
    .map((entry) => entry.name)
    .filter((slug) => onlySlugs.length === 0 || onlySlugs.includes(slug))
    .sort();

  let processed = 0;
  let skippedExisting = 0;
  let skippedNoInput = 0;
  let generated = 0;
  let failed = 0;

  for (const slug of slugs) {
    if (processed >= limit) break;
    processed += 1;

    const outputPath = path.join(libraryRoot, slug, 'thumbnail.png');
    if (!overwrite && (await pathExists(outputPath))) {
      skippedExisting += 1;
      continue;
    }

    const inputPath = await resolveInput(libraryRoot, slug, mode);
    if (!inputPath) {
      skippedNoInput += 1;
      continue;
    }

    if (dryRun) {
      console.log(`[DRY RUN] ${slug}: ${inputPath} -> ${outputPath}`);
      generated += 1;
      continue;
    }

    try {
      await extractThumbnail(inputPath, outputPath, timeSeconds, height);
      generated += 1;
      if (generated % 50 === 0) {
        console.log(`Generated ${generated} thumbnails so far...`);
      }
    } catch (error) {
      failed += 1;
      console.warn(`! ${slug}: ${error.message}`);
    }
  }

  console.log('---');
  console.log(`Library root: ${libraryRoot}`);
  console.log(`Mode: ${mode} | time=${timeSeconds}s | height=${height}px`);
  console.log(`Slugs scanned: ${processed}`);
  console.log(`Generated: ${generated}`);
  console.log(`Skipped (already exists): ${skippedExisting}`);
  console.log(`Skipped (no input video): ${skippedNoInput}`);
  if (failed > 0) console.log(`Failed: ${failed}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
