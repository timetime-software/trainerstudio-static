#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LIBRARY_ROOT = join(__dirname, '..');

const DEFAULT_INPUT = join(LIBRARY_ROOT, 'exercises.json');
const DEFAULT_SOURCE_DIR = join(LIBRARY_ROOT, 'source/videos');
const DEFAULT_CLIPS_DIR = join(LIBRARY_ROOT, 'videos/clips');

function parseArgs(argv) {
  const args = {
    input: DEFAULT_INPUT,
    sourceDir: DEFAULT_SOURCE_DIR,
    clipsDir: DEFAULT_CLIPS_DIR,
    start: 1,
    duration: 4,
    height: 480,
    limit: null,
    ids: null,
    overwrite: false,
    keepSource: true,
  };

  for (const arg of argv) {
    const [key, rawValue] = arg.split('=');
    const value = rawValue ?? '';

    if (key === '--input') args.input = resolve(value);
    else if (key === '--source-dir') args.sourceDir = resolve(value);
    else if (key === '--clips-dir') args.clipsDir = resolve(value);
    else if (key === '--start') args.start = Number(value);
    else if (key === '--duration') args.duration = Number(value);
    else if (key === '--height') args.height = Number(value);
    else if (key === '--limit') args.limit = Number(value);
    else if (key === '--ids') args.ids = new Set(value.split(',').map((id) => id.trim()).filter(Boolean));
    else if (key === '--overwrite') args.overwrite = true;
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

  run('python3', [
    '-m',
    'yt_dlp',
    '-f',
    'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]/best[height<=480]',
    '--merge-output-format',
    'mp4',
    '-o',
    sourcePath.replace(/\.mp4$/, '.%(ext)s'),
    `https://www.youtube.com/watch?v=${youtubeId}`,
  ]);
}

function buildClip(sourcePath, clipPath, args) {
  if (existsSync(clipPath) && !args.overwrite) return;

  mkdirSync(dirname(clipPath), { recursive: true });

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
    clipPath,
  ]);
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  ensureTool('python3', ['-m', 'yt_dlp', '--version']);
  ensureTool('ffmpeg', ['-version']);

  const exercises = loadExercises(args.input);
  let candidates = exercises
    .map((exercise) => ({ exercise, media: findYouTubeMedia(exercise) }))
    .filter(({ media }) => media);

  if (args.ids) {
    candidates = candidates.filter(({ exercise }) => args.ids.has(exercise.id));
  }

  if (args.limit) {
    candidates = candidates.slice(0, args.limit);
  }

  console.log(`Found ${candidates.length} exercises with YouTube video`);

  let processed = 0;
  for (const { exercise, media } of candidates) {
    const youtubeId = extractYouTubeId(media.url);
    const basename = `${exercise.id}_${safeName(exercise.name)}`;
    const sourcePath = join(args.sourceDir, `${basename}_source.mp4`);
    const clipPath = join(args.clipsDir, `${basename}_${args.duration}s_h${args.height}_silent.mp4`);

    console.log(`[${processed + 1}/${candidates.length}] ${exercise.id} ${exercise.name}`);
    downloadSourceVideo(youtubeId, sourcePath, args.overwrite);
    buildClip(sourcePath, clipPath, args);
    processed++;
  }

  console.log(`Done: ${processed} clips in ${args.clipsDir}`);
}

main();
