#!/usr/bin/env node

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { basename, dirname, join, relative, resolve } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import { cdnSlugFor, matchesExerciseIdentifier } from './exercise-ids.mjs';

function sha256OfFile(localPath) {
  return createHash('sha256').update(readFileSync(localPath)).digest('hex');
}

function dedupeKey(clipUrl, sha256) {
  return `${clipUrl}::${sha256 || ''}`;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');
const LIBRARY_ROOT = join(REPO_ROOT, 'libraries/tsl26');
const TOOL_ROOT = __dirname;
const WORKSPACE_ROOT = join(TOOL_ROOT, '.workspace');

const DEFAULT_ENDPOINT = 'https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks';
const DEFAULT_MODEL = 'dreamina-seedance-2-0-260128';
const DEFAULT_CDN_BASE_URL = 'https://cdn.trainerstudio.com';
const DEFAULT_INPUT = join(TOOL_ROOT, 'data/exercises.json');
const DEFAULT_CLIPS_DIR = LIBRARY_ROOT;
const DEFAULT_OUTPUT = join(WORKSPACE_ROOT, 'ark/style-tasks.ndjson');
const DEFAULT_REFERENCE_IMAGES = [
  join(LIBRARY_ROOT, 'references/man.png'),
  join(LIBRARY_ROOT, 'references/man2.png'),
];

const DEFAULT_PROMPT = [
  'Restyle [Video 1] into the TrainerStudio visual style shown in [Image 1] and [Image 2].',
  'The result must be exactly the same exercise demonstration as the original video: preserve the movement, repetitions, timing, body pose sequence, camera angle, framing, crop, scale, and 4-second duration from [Video 1].',
  'Only change the visual appearance. Replace the real athlete with the illustrated trainer character from the reference images, keeping a consistent coach identity, clean fitness illustration style, crisp outlines, simplified anatomy, and smooth vector-like shading.',
  'Important: the athlete\'s face in [Video 1] is intentionally blurred or pixelated for privacy. Do NOT preserve the blur, mosaic, or any anonymization artifact in the output. The trainer in the result must have a clear, fully visible illustrated face that matches the coach identity from [Image 1] and [Image 2] — same hairstyle, beard, skin tone, and facial features as the reference character.',
  'Use a clean pure white background matching the references. Keep the trainer centered and fully visible.',
  'Do not add text, labels, logos, captions, watermarks, extra people, extra props, gym backgrounds, decorative elements, or equipment that is not necessary for the original exercise movement.',
  'Remove or neutralize any visible brand marks from the source video or generated illustration, including sportswear logos, shoe logos, sock logos, equipment brands, and small trademark details such as Nike swooshes.',
  'The output must be silent, seamless, instructional, and suitable for a public exercise CDN.',
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
      .filter((exercise) => cdnSlugFor(exercise))
      .map((exercise) => [cdnSlugFor(exercise), exercise]),
  );
}

function loadExistingOutput(output) {
  if (!existsSync(output)) return new Set();

  return new Set(
    readFileSync(output, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line))
      .filter((row) => row.status === 'created')
      .map((row) => dedupeKey(row.clipUrl, row.sourceSha256))
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
      exercise,
      localPath,
      url: toPublicCdnUrl(localPath, args.cdnBaseUrl),
      sourceSha256: sha256OfFile(localPath),
    };
  });

  if (args.ids) {
    clips = clips.filter((clip) => (
      args.ids.has(clip.id) ||
      args.ids.has(clip.cdnslug) ||
      [...args.ids].some((id) => matchesExerciseIdentifier(clip.exercise, id))
    ));
  }

  if (args.limit) {
    clips = clips.slice(0, args.limit);
  }

  return clips;
}

function compactText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function truncateText(value, maxLength) {
  const text = compactText(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3).trimEnd()}...`;
}

function listText(values) {
  if (!Array.isArray(values)) return '';
  return values.map(compactText).filter(Boolean).join(', ');
}

function exerciseContextFor(exercise) {
  if (!exercise) return '';

  const name = compactText(exercise.name);
  const equipment = compactText(exercise.equipment);
  const primaryMuscles = listText(exercise.primaryMuscles);
  const secondaryMuscles = listText(exercise.secondaryMuscles);
  const instructions = Array.isArray(exercise.instructions)
    ? truncateText(exercise.instructions.slice(0, 4).join(' '), 1200)
    : '';

  const details = [
    name ? `Exercise name: ${name}.` : '',
    equipment ? `Expected equipment: ${equipment}.` : '',
    primaryMuscles ? `Primary muscles: ${primaryMuscles}.` : '',
    secondaryMuscles ? `Secondary muscles: ${secondaryMuscles}.` : '',
    instructions ? `Exercise instructions summary: ${instructions}` : '',
  ].filter(Boolean);

  if (!details.length) return '';

  return [
    'Exercise context for disambiguation only.',
    ...details,
    'Use this context only as a guide when [Video 1] is ambiguous. Do not invent or alter movement, equipment, props, range of motion, timing, camera angle, framing, or visible body positions from this text when it conflicts with [Video 1]. [Video 1] is the source of truth.',
  ].join(' ');
}

function buildPayload(args, referenceImageUrls, clip) {
  const exerciseContext = exerciseContextFor(clip.exercise);
  const prompt = [args.prompt, exerciseContext].filter(Boolean).join(' ');

  return {
    model: args.model,
    content: [
      {
        type: 'text',
        text: prompt,
      },
      ...referenceImageUrls.map((url) => ({
        type: 'image_url',
        image_url: { url },
        role: 'reference_image',
      })),
      {
        type: 'video_url',
        video_url: { url: clip.url },
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
    const error = new Error(`Ark request failed with ${response.status}: ${text}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }

  return body;
}

function taskIdFromResponse(task) {
  return task?.id ?? task?.task_id ?? task?.data?.id ?? task?.data?.task_id ?? null;
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
  const existingTaskKeys = args.overwriteOutput ? new Set() : loadExistingOutput(args.output);
  const pendingClips = clips.filter((clip) => !existingTaskKeys.has(dedupeKey(clip.url, clip.sourceSha256)));

  console.log(`Found ${clips.length} clip(s), ${pendingClips.length} pending`);
  console.log(`Reference images: ${referenceImageUrls.join(', ')}`);

  if (args.dryRun) {
    const sampleClip = pendingClips[0];
    if (!sampleClip) {
      console.log('No pending clips to preview');
      return;
    }

    console.log(JSON.stringify(buildPayload(args, referenceImageUrls, sampleClip), null, 2));
    return;
  }

  let processed = 0;
  let failed = 0;
  for (const clip of pendingClips) {
    const payload = buildPayload(args, referenceImageUrls, clip);
    console.log(`[${processed + 1}/${pendingClips.length}] ${clip.id} ${basename(clip.localPath)}`);
    try {
      const task = await createTask(args, payload);
      const taskId = taskIdFromResponse(task);
      appendOutput(args.output, {
        createdAt: new Date().toISOString(),
        status: 'created',
        id: clip.id,
        cdnslug: clip.cdnslug,
        clipUrl: clip.url,
        sourceSha256: clip.sourceSha256,
        referenceImageUrls,
        payload,
        taskId,
        statusUrl: taskId ? `${args.endpoint}/${taskId}` : null,
        task,
      });
    } catch (error) {
      failed++;
      appendOutput(args.output, {
        createdAt: new Date().toISOString(),
        status: 'create_failed',
        id: clip.id,
        cdnslug: clip.cdnslug,
        clipUrl: clip.url,
        sourceSha256: clip.sourceSha256,
        referenceImageUrls,
        payload,
        error: {
          message: error.message,
          httpStatus: error.status ?? null,
          body: error.body ?? null,
        },
      });
      console.error(error.message);
    }
    processed++;
  }

  console.log(`Done: ${processed} clip(s), failed=${failed}. Output: ${args.output}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
