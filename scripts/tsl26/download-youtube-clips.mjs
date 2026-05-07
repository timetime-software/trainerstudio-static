#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, unlinkSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { createHash } from 'crypto';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { cdnSlugFor as explicitCdnSlugFor, findExerciseByIdentifier, matchesExerciseIdentifier } from './exercise-ids.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');
const LIBRARY_ROOT = join(REPO_ROOT, 'libraries/tsl26');
const TOOL_ROOT = __dirname;
const WORKSPACE_ROOT = join(TOOL_ROOT, '.workspace');

const DEFAULT_INPUT = join(TOOL_ROOT, 'data/exercises.json');
const DEFAULT_SOURCE_DIR = join(WORKSPACE_ROOT, 'videos');
const DEFAULT_CLIPS_DIR = LIBRARY_ROOT;
const DEFAULT_MANIFEST = join(WORKSPACE_ROOT, 'manifests/source-video-manifest.json');

function parseArgs(argv) {
  const args = {
    input: DEFAULT_INPUT,
    sourceDir: DEFAULT_SOURCE_DIR,
    clipsDir: DEFAULT_CLIPS_DIR,
    manifest: DEFAULT_MANIFEST,
    start: 1,
    duration: 4,
    height: 480,
    limit: null,
    ids: null,
    shardIndex: null,
    shardTotal: null,
    overwrite: false,
    continueOnError: false,
    keepSource: true,
    youtubeId: null,
  };

  for (const arg of argv) {
    const [key, rawValue] = arg.split('=');
    const value = rawValue ?? '';

    if (key === '--input') args.input = resolve(value);
    else if (key === '--source-dir') args.sourceDir = resolve(value);
    else if (key === '--clips-dir') args.clipsDir = resolve(value);
    else if (key === '--manifest') args.manifest = resolve(value);
    else if (key === '--start') args.start = Number(value);
    else if (key === '--duration') args.duration = Number(value);
    else if (key === '--height') args.height = Number(value);
    else if (key === '--limit') args.limit = Number(value);
    else if (key === '--ids') args.ids = new Set(value.split(',').map((id) => id.trim()).filter(Boolean));
    else if (key === '--youtube-id') args.youtubeId = value.trim();
    else if (key === '--shard') {
      const [rawIndex, rawTotal] = value.split('/').map(Number);
      if (!Number.isInteger(rawIndex) || !Number.isInteger(rawTotal) || rawIndex < 1 || rawTotal < 1 || rawIndex > rawTotal) {
        throw new Error(`Invalid shard: ${value}. Expected --shard=N/M with 1 <= N <= M.`);
      }
      args.shardIndex = rawIndex;
      args.shardTotal = rawTotal;
    }
    else if (key === '--overwrite') args.overwrite = true;
    else if (key === '--continue-on-error') args.continueOnError = true;
    else if (key === '--no-keep-source') args.keepSource = false;
    else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${command} exited with status ${result.status}`);
  }
}

function extractYouTubeId(url) {
  if (!url) return null;

  const match = url.match(
    /(?:youtube\.com\/(?:embed\/|watch\?v=|shorts\/)|youtu\.be\/)([^"&?/\s]{11})/i,
  );

  return match?.[1] ?? null;
}

function safeName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function cdnSlugFor(exercise) {
  return explicitCdnSlugFor(exercise) || safeName(exercise.i18n?.name?.en || exercise.name || exercise.id);
}

function findYouTubeMedia(exercise) {
  const media = Array.isArray(exercise.media) ? exercise.media : [];
  return media.find((item) => item?.type === 'video' && extractYouTubeId(item.url));
}

function loadExercises(input) {
  const raw = readFileSync(input, 'utf8').trim();
  if (raw.startsWith('[')) return JSON.parse(raw);
  return raw.split('\n').filter(Boolean).map((line) => JSON.parse(line.replace(/,\s*$/, '')));
}

function ensureTool(name, args) {
  const result = spawnSync(name, args, { stdio: 'ignore' });
  if (result.status !== 0) {
    throw new Error(`Required tool not available: ${name} ${args.join(' ')}`);
  }
}

function downloadSourceVideo(youtubeId, sourcePath, overwrite) {
  if (existsSync(sourcePath) && !overwrite) return;

  mkdirSync(dirname(sourcePath), { recursive: true });
  const sourceDir = dirname(sourcePath);
  const tempStem = sourcePath.replace(/\.mp4$/, `.download-${process.pid}`);
  const tempOutput = `${tempStem}.%(ext)s`;
  const tempMp4 = `${tempStem}.mp4`;

  for (const file of readdirSync(sourceDir)) {
    if (file.startsWith(`${tempStem.split('/').at(-1)}.`) || file.startsWith(`${tempStem.split('/').at(-1)}.f`)) {
      rmSync(join(sourceDir, file), { force: true });
    }
  }

  run('python3', [
    '-m',
    'yt_dlp',
    '--force-overwrites',
    '--no-continue',
    '-f',
    'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]/best[height<=480]',
    '--merge-output-format',
    'mp4',
    '-o',
    tempOutput,
    `https://www.youtube.com/watch?v=${youtubeId}`,
  ]);

  if (!existsSync(tempMp4)) {
    throw new Error(`Downloaded source was not created: ${tempMp4}`);
  }
  if (existsSync(sourcePath) && overwrite) unlinkSync(sourcePath);
  renameSync(tempMp4, sourcePath);
}

function buildClip(sourcePath, clipPath, args) {
  if (existsSync(clipPath) && !args.overwrite) return;

  mkdirSync(dirname(clipPath), { recursive: true });
  const tempClipPath = `${clipPath}.tmp-${process.pid}.mp4`;
  if (existsSync(tempClipPath)) unlinkSync(tempClipPath);

  run('ffmpeg', [
    '-y',
    '-ss',
    String(args.start),
    '-i',
    sourcePath,
    '-t',
    String(args.duration),
    '-vf',
    `scale=-2:${args.height}`,
    '-an',
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '20',
    '-movflags',
    '+faststart',
    tempClipPath,
  ]);

  if (existsSync(clipPath) && args.overwrite) {
    unlinkSync(clipPath);
  }
  renameSync(tempClipPath, clipPath);
}

function writeManifest(manifestPath, records) {
  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(
    manifestPath,
    `${JSON.stringify(
      {
        library: 'tsl26',
        generatedAt: new Date().toISOString(),
        total: records.length,
        records,
      },
      null,
      2,
    )}\n`,
  );
}

function probeClip(clipPath) {
  if (!existsSync(clipPath)) return null;
  const result = spawnSync('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration,size',
    '-of',
    'default=nw=1',
    clipPath,
  ], { encoding: 'utf8' });
  const hash = createHash('sha256').update(readFileSync(clipPath)).digest('hex').slice(0, 12);
  return {
    hash,
    probe: result.status === 0 ? result.stdout.trim().replace(/\n/g, ' ') : 'ffprobe failed',
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  ensureTool('python3', ['-m', 'yt_dlp', '--version']);
  ensureTool('ffmpeg', ['-version']);

  const exercises = loadExercises(args.input);
  let candidates;

  if (args.youtubeId) {
    if (!/^[a-zA-Z0-9_-]{11}$/.test(args.youtubeId)) {
      throw new Error(`Invalid YouTube id: ${args.youtubeId}`);
    }
    if (!args.ids || args.ids.size !== 1) {
      throw new Error('--youtube-id requires exactly one --ids value.');
    }
    const targetId = [...args.ids][0];
    const exercise = findExerciseByIdentifier(exercises, targetId);
    if (!exercise) {
      throw new Error(`Exercise not found: ${targetId}`);
    }
    candidates = [{
      exercise,
      media: {
        type: 'video',
        source: 'youtube',
        url: `https://www.youtube.com/embed/${args.youtubeId}`,
      },
    }];
  } else {
    candidates = exercises
      .map((exercise) => ({ exercise, media: findYouTubeMedia(exercise) }))
      .filter(({ media }) => media);

    if (args.ids) {
      candidates = candidates.filter(({ exercise }) => [...args.ids].some((id) => matchesExerciseIdentifier(exercise, id)));
    }
  }

  if (args.shardTotal) {
    candidates = candidates.filter((_, index) => index % args.shardTotal === args.shardIndex - 1);
  }

  if (args.limit) {
    candidates = candidates.slice(0, args.limit);
  }

  console.log(`Found ${candidates.length} exercises with YouTube video${args.shardTotal ? ` in shard ${args.shardIndex}/${args.shardTotal}` : ''}`);

  const manifestRecords = candidates.map(({ exercise, media }) => {
    const youtubeId = extractYouTubeId(media.url);
    const cdnSlug = cdnSlugFor(exercise);
    const basename = `${exercise.id}_${safeName(exercise.name)}`;
    const sourcePath = join(args.sourceDir, `${basename}_source.mp4`);
    const clipPath = join(args.clipsDir, cdnSlug, 'source', `${cdnSlug}.mp4`);

    return {
      id: exercise.id,
      name: exercise.name,
      cdnslug: cdnSlug,
      youtubeId,
      youtubeUrl: media.url,
      sourcePath,
      clipPath,
      sourceDownloaded: existsSync(sourcePath),
      clipBuilt: existsSync(clipPath),
      lastProcessedAt: null,
      error: null,
    };
  });

  writeManifest(args.manifest, manifestRecords);

  let processed = 0;
  for (const record of manifestRecords) {
    const { id, name, youtubeId, sourcePath, clipPath } = record;

    console.log(`[${processed + 1}/${candidates.length}] ${id} ${name}`);
    try {
      const clipExisted = existsSync(clipPath);
      downloadSourceVideo(youtubeId, sourcePath, args.overwrite);
      buildClip(sourcePath, clipPath, args);
      const clipInfo = probeClip(clipPath);
      const verb = clipExisted && !args.overwrite ? 'Reused clip' : 'Wrote clip';
      console.log(`${verb}: ${clipPath}${clipInfo ? ` (${clipInfo.probe} sha256=${clipInfo.hash})` : ''}`);
      record.error = null;
    } catch (error) {
      record.error = error instanceof Error ? error.message : String(error);
      console.error(`Failed: ${id} ${name}: ${record.error}`);
      if (!args.continueOnError) {
        throw error;
      }
    } finally {
      record.sourceDownloaded = existsSync(sourcePath);
      record.clipBuilt = existsSync(clipPath);
      record.lastProcessedAt = new Date().toISOString();
      writeManifest(args.manifest, manifestRecords);
      processed++;
    }
  }

  console.log(`Done: ${processed} clips in ${args.clipsDir}`);
}

main();
