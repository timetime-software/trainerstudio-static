#!/usr/bin/env node

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { basename, dirname, join, relative, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');
const LIBRARY_ROOT = join(REPO_ROOT, 'libraries/tsl26');
const TOOL_ROOT = __dirname;

const DEFAULT_ENDPOINT = 'https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks';
const DEFAULT_MODEL = 'dreamina-seedance-2-0-260128';
const DEFAULT_CDN_BASE_URL = 'https://cdn.trainerstudio.com';
const DEFAULT_INPUT = join(TOOL_ROOT, 'data/exercises.json');
const DEFAULT_CLIPS_DIR = LIBRARY_ROOT;
const DEFAULT_OUTPUT = join(TOOL_ROOT, 'source/ark-style-tasks.ndjson');
const DEFAULT_REFERENCE_IMAGES = [
  join(LIBRARY_ROOT, 'references/man.png'),
  join(LIBRARY_ROOT, 'references/man2.png'),
];

const DEFAULT_PROMPT = [
  'Transform [Video 1] into a polished TrainerStudio exercise demonstration using the visual style, lighting, body silhouette, clean studio background, and fitness reference look from [Image 1] and [Image 2].',
  'Preserve the original exercise movement, camera framing, tempo, and full-body visibility from [Video 1].',
  'Keep the subject anatomically consistent, avoid adding text, logos, captions, watermarks, extra people, equipment not present in the source exercise, or distracting background objects.',
  'The output should be a silent, seamless 4-second exercise clip suitable for a public fitness exercise library.',
].join(' ');

function parseArgs(argv) {
  const args = {
    clipsDir: DEFAULT_CLIPS_DIR,
    input: DEFAULT_INPUT,
    cdnBaseUrl: DEFAULT_CDN_BASE_URL,
    endpoint: DEFAULT_ENDPOINT,
    model: DEFAULT_MODEL,
    output: DEFAULT_OUTPUT,
    referenceImages: [...DEFAULT_REFERENCE_IMAGES],
    prompt: DEFAULT_PROMPT,
    duration: 4,
    ratio: '16:9',
    limit: null,
    ids: null,
    overwriteOutput: false,
    dryRun: false,
    generateAudio: false,
    watermark: false,
  };

  for (const arg of argv) {
    const [key, rawValue] = arg.split('=');
    const value = rawValue ?? '';

    if (key === '--input') args.input = resolve(value);
    else if (key === '--clips-dir') args.clipsDir = resolve(value);
    else if (key === '--cdn-base-url') args.cdnBaseUrl = value.replace(/\/+$/, '');
    else if (key === '--endpoint') args.endpoint = value;
    else if (key === '--model') args.model = value;
    else if (key === '--output') args.output = resolve(value);
    else if (key === '--reference-images') {
      args.referenceImages = value.split(',').map((path) => resolve(path.trim())).filter(Boolean);
    } else if (key === '--prompt') args.prompt = value;
    else if (key === '--prompt-file') args.prompt = readFileSync(resolve(value), 'utf8').trim();
    else if (key === '--duration') args.duration = Number(value);
    else if (key === '--ratio') args.ratio = value;
    else if (key === '--limit') args.limit = Number(value);
    else if (key === '--ids') args.ids = new Set(value.split(',').map((id) => id.trim()).filter(Boolean));
    else if (key === '--overwrite-output') args.overwriteOutput = true;
    else if (key === '--dry-run') args.dryRun = true;
    else if (key === '--generate-audio') args.generateAudio = true;
    else if (key === '--watermark') args.watermark = true;
    else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function toPublicCdnUrl(localPath, cdnBaseUrl) {
  const absolutePath = resolve(localPath);
  const relativePath = relative(REPO_ROOT, absolutePath);

  if (relativePath.startsWith('..')) {
    throw new Error(`Path must be inside repository: ${localPath}`);
  }

  return `${cdnBaseUrl}/${relativePath.split('/').map(encodeURIComponent).join('/')}`;
}

function walkMp4Files(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name === 'references') continue;

    const entryPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'default') continue;
      files.push(...walkMp4Files(entryPath));
    }
    else if (entry.isFile() && entry.name.endsWith('.mp4')) files.push(entryPath);
  }

  return files.sort();
}

function clipIdFromPath(filePath) {
  return basename(filePath, '.mp4');
}

function loadExercisesBySlug(input) {
  if (!existsSync(input)) return new Map();

  const exercises = JSON.parse(readFileSync(input, 'utf8'));
  if (!Array.isArray(exercises)) return new Map();

  return new Map(
    exercises
      .filter((exercise) => exercise?.cdnslug || exercise?.cdnSlug)
      .map((exercise) => [exercise.cdnslug || exercise.cdnSlug, exercise]),
  );
}

function loadExistingOutput(output) {
  if (!existsSync(output)) return new Set();

  return new Set(
    readFileSync(output, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line))
      .map((row) => row.clipUrl)
      .filter(Boolean),
  );
}

function listClips(args) {
  const files = walkMp4Files(args.clipsDir);
  const exercisesBySlug = loadExercisesBySlug(args.input);

  let clips = files.filter((localPath) => localPath.split('/').includes('source')).map((localPath) => {
    const cdnslug = clipIdFromPath(localPath);
    const exercise = exercisesBySlug.get(cdnslug);

    return {
      id: exercise?.id ?? cdnslug,
      cdnslug,
      localPath,
      url: toPublicCdnUrl(localPath, args.cdnBaseUrl),
    };
  });

  if (args.ids) {
    clips = clips.filter((clip) => args.ids.has(clip.id) || args.ids.has(clip.cdnslug));
  }

  if (args.limit) {
    clips = clips.slice(0, args.limit);
  }

  return clips;
}

function buildPayload(args, referenceImageUrls, clipUrl) {
  return {
    model: args.model,
    content: [
      {
        type: 'text',
        text: args.prompt,
      },
      ...referenceImageUrls.map((url) => ({
        type: 'image_url',
        image_url: { url },
        role: 'reference_image',
      })),
      {
        type: 'video_url',
        video_url: { url: clipUrl },
        role: 'reference_video',
      },
    ],
    generate_audio: args.generateAudio,
    ratio: args.ratio,
    duration: args.duration,
    watermark: args.watermark,
  };
}

async function createTask(args, payload) {
  const apiKey = process.env.ARK_API_KEY;
  if (!apiKey) {
    throw new Error('Missing ARK_API_KEY environment variable');
  }

  const response = await fetch(args.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!response.ok) {
    throw new Error(`Ark request failed with ${response.status}: ${text}`);
  }

  return body;
}

function appendOutput(output, record) {
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(record)}\n`, { flag: 'a' });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.referenceImages.length !== 2) {
    throw new Error('Expected exactly two reference images. Use --reference-images=/path/one.png,/path/two.png');
  }

  for (const image of args.referenceImages) {
    if (!existsSync(image)) throw new Error(`Reference image does not exist: ${image}`);
  }

  const referenceImageUrls = args.referenceImages.map((image) => toPublicCdnUrl(image, args.cdnBaseUrl));
  const clips = listClips(args);
  const existingClipUrls = args.overwriteOutput ? new Set() : loadExistingOutput(args.output);
  const pendingClips = clips.filter((clip) => !existingClipUrls.has(clip.url));

  console.log(`Found ${clips.length} clip(s), ${pendingClips.length} pending`);
  console.log(`Reference images: ${referenceImageUrls.join(', ')}`);

  if (args.dryRun) {
    const sampleClip = pendingClips[0];
    if (!sampleClip) {
      console.log('No pending clips to preview');
      return;
    }

    console.log(JSON.stringify(buildPayload(args, referenceImageUrls, sampleClip.url), null, 2));
    return;
  }

  let processed = 0;
  for (const clip of pendingClips) {
    const payload = buildPayload(args, referenceImageUrls, clip.url);
    console.log(`[${processed + 1}/${pendingClips.length}] ${clip.id} ${basename(clip.localPath)}`);
    const task = await createTask(args, payload);
    appendOutput(args.output, {
      createdAt: new Date().toISOString(),
      id: clip.id,
      cdnslug: clip.cdnslug,
      clipUrl: clip.url,
      referenceImageUrls,
      payload,
      task,
    });
    processed++;
  }

  console.log(`Done: ${processed} task(s). Output: ${args.output}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
