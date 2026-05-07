import react from '@vitejs/plugin-react';
import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import {
  CATEGORY_VALUES,
  DETAILED_MUSCLE_GROUP_VALUES,
  EQUIPMENT_VALUES,
  FORCE_TYPE_VALUES,
  LATERALITY_VALUES,
  LEVEL_VALUES,
  MECHANIC_VALUES,
  MOVEMENT_PATTERN_VALUES,
} from '../classification-reference.mjs';
import { cdnSlugFor, findExerciseByIdentifier } from '../exercise-ids.mjs';
import { proposeExerciseChanges } from './lib-server/reviewer.mjs';

const editorDir = path.dirname(fileURLToPath(import.meta.url));
const toolDir = path.resolve(editorDir, '..');
const repoRoot = path.resolve(toolDir, '../..');
const workspaceRoot = path.join(toolDir, '.workspace');
const ndjsonPath = path.join(toolDir, 'data/exercises.ndjson');
const libraryRoot = path.join(repoRoot, 'libraries/tsl26');
const envPath = path.join(editorDir, '.env');
const arkTasksPath = path.join(workspaceRoot, 'ark/style-tasks.ndjson');
const arkTaskStatusPath = path.join(workspaceRoot, 'ark/style-task-status.ndjson');
const reviewJobsDir = path.join(workspaceRoot, 'editor-review-jobs');
const syncMediaArgs = ['--experimental-strip-types', 'sync-cdn-media.ts'];
let syncMediaQueue = Promise.resolve();
let exerciseWriteQueue = Promise.resolve();
const reviewJobs = new Map();
const reviewQueue = [];
let activeReviewJobs = 0;
const reviewConcurrency = Number(process.env.EDITOR_REVIEW_CONCURRENCY) || 2;

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

async function readLocalEnv() {
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

async function runCommand(command, args, extraEnv = {}, options = {}) {
  const localEnv = await readLocalEnv();
  return new Promise((resolve) => {
    const startedAt = Date.now();
    let settled = false;
    const child = spawn(command, args, {
      cwd: toolDir,
      env: { ...process.env, ...localEnv, ...extraEnv },
    });
    let output = '';
    const timeout = options.timeoutMs
      ? setTimeout(() => {
        if (settled) return;
        settled = true;
        child.kill('SIGTERM');
        resolve({
          ok: false,
          code: null,
          output: `${output}\nTimed out after ${Math.round(options.timeoutMs / 1000)}s: ${command} ${args.slice(0, 4).join(' ')}`,
          elapsedMs: Date.now() - startedAt,
        });
      }, options.timeoutMs)
      : null;

    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      output += chunk.toString();
    });
    if (options.stdin) {
      child.stdin.write(options.stdin);
      child.stdin.end();
    }
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      resolve({ ok: code === 0, code, output, elapsedMs: Date.now() - startedAt });
    });
    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      resolve({ ok: false, code: null, output: error.message, elapsedMs: Date.now() - startedAt });
    });
  });
}

async function saveReviewJob(job) {
  await fs.mkdir(reviewJobsDir, { recursive: true });
  const snapshot = {
    id: job.id,
    provider: job.provider,
    exerciseId: job.exerciseId,
    exerciseName: job.exerciseName,
    status: job.status,
    ok: job.ok,
    code: job.code,
    output: job.output,
    error: job.error || null,
    pid: job.pid || null,
    startedAt: job.startedAt || null,
    finishedAt: job.finishedAt || null,
    elapsedMs: job.elapsedMs || 0,
    context: job.context || null,
  };
  await fs.writeFile(path.join(reviewJobsDir, `${job.id}.json`), JSON.stringify(snapshot, null, 2));
}

async function readReviewJobs() {
  await fs.mkdir(reviewJobsDir, { recursive: true });
  const names = await fs.readdir(reviewJobsDir).catch(() => []);
  const persisted = await Promise.all(names.filter((name) => name.endsWith('.json')).map(async (name) => {
    try {
      return JSON.parse(await fs.readFile(path.join(reviewJobsDir, name), 'utf8'));
    } catch {
      return null;
    }
  }));
  return persisted
    .filter(Boolean)
    .map((job) => {
      const live = reviewJobs.get(job.id);
      return live || (job.status === 'running' ? { ...job, status: 'failed', ok: false, error: 'Server restarted while job was running' } : job);
    })
    .sort((a, b) => String(b.startedAt || b.id).localeCompare(String(a.startedAt || a.id)));
}

async function restoreReviewQueue() {
  const jobs = await readReviewJobs();
  for (const job of jobs) {
    if (job.status === 'running') {
      job.status = 'failed';
      job.ok = false;
      job.error = 'Server restarted while job was running';
      await saveReviewJob(job);
    } else if (job.status === 'queued' && job.context?.exercise) {
      reviewJobs.set(job.id, job);
      if (!reviewQueue.includes(job.id)) reviewQueue.push(job.id);
    }
  }
  void processReviewQueue();
}

async function startCommandJob(command, args, extraEnv = {}, options = {}) {
  const localEnv = await readLocalEnv();
  const jobId = options.job?.id || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const startedAt = Date.now();
  const job = options.job || {
    id: jobId,
    provider: options.provider || command,
    exerciseId: options.exerciseId || null,
    exerciseName: options.exerciseName || '',
    ok: null,
    code: null,
    output: '',
    elapsedMs: 0,
  };
  Object.assign(job, {
    command,
    args,
    context: options.context || job.context || null,
    status: 'running',
    output: `${job.output || ''}${options.displayCommand || `$ ${command} ${args.filter((arg) => arg !== '-').join(' ')}`}\n`,
    startedAt,
  });
  reviewJobs.set(jobId, job);
  await saveReviewJob(job);

  const child = spawn(command, args, {
    cwd: toolDir,
    env: { ...process.env, ...localEnv, ...extraEnv },
  });
  job.pid = child.pid;

  const finish = async (patch) => {
    if (job.status !== 'running') return;
    const nextPatch = options.onFinish ? await options.onFinish({ ...job, ...patch }) : patch;
    Object.assign(job, patch, {
      ...nextPatch,
      status: 'done',
      finishedAt: new Date().toISOString(),
      elapsedMs: Date.now() - startedAt,
    });
    if (job.ok) job.status = 'applied';
    if (!job.ok) job.status = 'failed';
    await saveReviewJob(job);
    options.onSettled?.(job);
  };

  const timeout = options.timeoutMs
    ? setTimeout(() => {
      if (job.status !== 'running') return;
      child.kill('SIGTERM');
      void finish({
        ok: false,
        code: null,
        output: `${job.output}\nTimed out after ${Math.round(options.timeoutMs / 1000)}s.`,
      });
    }, options.timeoutMs)
    : null;

  child.stdout.on('data', (chunk) => {
    job.output += chunk.toString();
    void saveReviewJob(job);
  });
  child.stderr.on('data', (chunk) => {
    job.output += chunk.toString();
    void saveReviewJob(job);
  });
  if (options.stdin) {
    child.stdin.write(options.stdin);
    child.stdin.end();
  }
  child.on('close', (code) => {
    if (timeout) clearTimeout(timeout);
    void finish({ ok: code === 0, code });
  });
  child.on('error', (error) => {
    if (timeout) clearTimeout(timeout);
    void finish({ ok: false, code: null, output: `${job.output}\n${error.message}` });
  });

  return job;
}

async function runCommandJsonLines(command, args) {
  const localEnv = await readLocalEnv();
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: toolDir,
      env: { ...process.env, ...localEnv },
    });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('close', (code) => {
      resolve({ ok: code === 0, code, stdout, stderr });
    });
    child.on('error', (error) => {
      resolve({ ok: false, code: null, stdout, stderr: error.message });
    });
  });
}

async function runQueuedSyncMedia(extraEnv = {}) {
  const run = () => runCommand('node', syncMediaArgs, extraEnv);
  const result = syncMediaQueue.then(run, run);
  syncMediaQueue = result.catch(() => {});
  return result;
}

async function runDefaultPollFlow(id, extraEnv = {}) {
  const results = [];
  const pollResult = await runCommand('node', ['poll-ark-style-tasks.mjs', `--ids=${id}`, '--once', '--download'], extraEnv);
  results.push({ command: 'node', args: ['poll-ark-style-tasks.mjs', `--ids=${id}`, '--once', '--download'], ...pollResult });
  if (pollResult.ok) {
    const syncResult = await runQueuedSyncMedia(extraEnv);
    results.push({ command: 'node', args: syncMediaArgs, ...syncResult });
  }
  return commandSequenceResult(results);
}

async function runAiVideoFlow(id, extraEnv = {}, options = {}) {
  const results = [];

  const pushResult = async (command, args) => {
    const result = await runCommand(command, args, extraEnv);
    results.push({ command, args, ...result });
    return result;
  };

  const downloadResult = await pushResult('node', ['download-youtube-clips.mjs', `--ids=${id}`]);
  if (!downloadResult.ok) return commandSequenceResult(results);

  const createArgs = ['create-ark-style-tasks.mjs', `--ids=${id}`];
  if (options.forceCreate) createArgs.push('--overwrite-output');
  const createResult = await pushResult('node', createArgs);
  if (!createResult.ok || /failed=[1-9]\d*|Ark request failed/i.test(createResult.output)) {
    return commandSequenceResult(results, false);
  }

  const pollResult = await pushResult('node', ['poll-ark-style-tasks.mjs', `--ids=${id}`, '--once', '--download']);
  if (!pollResult.ok || /No created tasks to poll|: failed|: cancelled|: expired/i.test(pollResult.output)) {
    return commandSequenceResult(results, false);
  }

  const syncResult = await runQueuedSyncMedia(extraEnv);
  results.push({ command: 'node', args: syncMediaArgs, ...syncResult });
  return commandSequenceResult(results);
}

function commandSequenceResult(results, ok = results.every((result) => result.ok)) {
  return {
    ok,
    code: ok ? 0 : (results.at(-1)?.code ?? 1),
    elapsedMs: results.reduce((total, result) => total + result.elapsedMs, 0),
    output: results.map((result) => `$ ${result.command} ${result.args.join(' ')}\n${result.output}`.trim()).join('\n\n'),
  };
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function fileVersion(filePath) {
  const stat = await fs.stat(filePath).catch(() => null);
  return stat ? String(Math.round(stat.mtimeMs)) : null;
}

async function readNdjson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8').catch(() => '');
  return raw
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

async function readExercises() {
  return readNdjson(ndjsonPath);
}

function taskIdFromRecord(record) {
  return record?.taskId ?? record?.task?.id ?? record?.task?.task_id ?? record?.task?.data?.id ?? record?.task?.data?.task_id ?? null;
}

function isYoutubeMedia(item) {
  return item?.source === 'youtube'
    || /(?:youtube\.com|youtu\.be|img\.youtube\.com)/i.test(item?.url || item?.thumbnailUrl || '');
}

function exerciseWithSourceClip(exercise, { youtubeId, title, channel, start, duration }) {
  const thumbnail = `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
  const media = Array.isArray(exercise.media) ? exercise.media : [];
  return {
    ...exercise,
    media: [
      ...media.filter((item) => !isYoutubeMedia(item)),
      {
        type: 'video',
        source: 'youtube',
        url: `https://www.youtube.com/embed/${youtubeId}?autoplay=1`,
        thumbnailUrl: thumbnail,
      },
      { type: 'image', source: 'youtube', url: thumbnail },
    ],
    images: [thumbnail],
    metadata: {
      ...(exercise.metadata || {}),
      sourceClip: {
        youtubeId,
        title: title || null,
        channel: channel || null,
        start,
        duration,
        updatedAt: new Date().toISOString(),
      },
    },
  };
}

async function withExerciseWrite(fn) {
  const result = exerciseWriteQueue.then(fn, fn);
  exerciseWriteQueue = result.catch(() => {});
  return result;
}

async function persistExercises(exercises) {
  return withExerciseWrite(() => fs.writeFile(ndjsonPath, `${exercises.map((exercise) => JSON.stringify(exercise)).join('\n')}\n`));
}

function extractJsonObject(output) {
  const text = String(output || '').trim();
  if (!text) throw new Error('Review agent returned empty output');

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() || text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  if (!candidate || !candidate.startsWith('{')) {
    throw new Error('Review agent did not return a JSON object');
  }
  return JSON.parse(candidate);
}

async function applyReviewedExercise(id, rawOutput) {
  const reviewed = extractJsonObject(rawOutput);
  if (reviewed.id !== id) {
    throw new Error(`Review agent returned id ${reviewed.id || '(missing)'} instead of ${id}`);
  }

  return withExerciseWrite(async () => {
    const exercises = await readExercises();
    const index = exercises.findIndex((exercise) => findExerciseByIdentifier([exercise], id));
    if (index < 0) throw new Error(`Exercise not found after review: ${id}`);

    exercises[index] = reviewed;
    await fs.writeFile(ndjsonPath, `${exercises.map((exercise) => JSON.stringify(exercise)).join('\n')}\n`);
    return reviewed;
  });
}

function normalizeYouTubeResult(item) {
  const id = item?.id || item?.url;
  if (!id || !/^[a-zA-Z0-9_-]{11}$/.test(id)) return null;
  return {
    id,
    title: item.title || id,
    channel: item.channel || item.uploader || '',
    duration: Number(item.duration) || null,
    thumbnail: item.thumbnail || item.thumbnails?.at(-1)?.url || `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
    url: `https://www.youtube.com/watch?v=${id}`,
    embedUrl: `https://www.youtube.com/embed/${id}`,
  };
}

function buildExerciseReviewPrompt(exercise, provider) {
  const allowedValues = {
    categories: CATEGORY_VALUES,
    levels: LEVEL_VALUES,
    forceTypes: FORCE_TYPE_VALUES,
    mechanics: MECHANIC_VALUES,
    equipment: EQUIPMENT_VALUES,
    muscles: DETAILED_MUSCLE_GROUP_VALUES,
    movementPatterns: MOVEMENT_PATTERN_VALUES,
    laterality: LATERALITY_VALUES,
  };

  return [
    'You are reviewing one exercise JSON record in the TrainerStudio static exercise database.',
    '',
    'Task:',
    '- Return exactly one JSON object: the fully revised exercise record.',
    '- Do not edit files. Do not call tools. Do not include Markdown, comments, explanations, code fences, or a summary.',
    `- Preserve the same id: "${exercise.id}".`,
    '- Keep id, cdnslug/cdnSlug, media, images, aliases, source clip metadata, default video metadata, and existing CDN references intact unless they are clearly malformed.',
    '- Make the English name/instructions and Spanish i18n name/instructions natural, clear, and exercise-specific.',
    '- Remove Spanglish or literal machine-translation artifacts from Spanish text.',
    '- Ensure top-level category, level, force, mechanic, equipment, primaryMuscles, secondaryMuscles and classification.* are coherent with the exercise.',
    '- Use only the allowed classification values listed below.',
    '- Keep top-level force/mechanic/equipment aligned with classification.forceType/mechanic/equipment.',
    '- Do not put a muscle in both primaryMuscles and secondaryMuscles.',
    '- Keep the same object shape unless a field needs correction.',
    `- This was launched from the editor via ${provider}.`,
    '',
    'Allowed classification values:',
    JSON.stringify(allowedValues, null, 2),
    '',
    'Exercise to review:',
    JSON.stringify(exercise, null, 2),
  ].join('\n');
}

function startQueuedReviewJob(job) {
  const exercise = job.context.exercise;
  const provider = job.provider;
  const prompt = buildExerciseReviewPrompt(exercise, provider);
  const finalizeReview = async (finishedJob) => {
    if (!finishedJob.ok) return finishedJob;
    try {
      const rawOutput = String(finishedJob.output || '').replace(/^\$ .*\n/, '');
      const reviewed = await applyReviewedExercise(exercise.id, rawOutput);
      return {
        ...finishedJob,
        reviewed,
        output: `Applied reviewed JSON for ${exercise.id}.\n\n${rawOutput}`.trim(),
      };
    } catch (error) {
      return {
        ...finishedJob,
        ok: false,
        code: finishedJob.code ?? 1,
        error: error.message,
        output: `${finishedJob.output}\n\nFailed to apply reviewed JSON: ${error.message}`,
      };
    }
  };
  const onSettled = () => {
    activeReviewJobs = Math.max(0, activeReviewJobs - 1);
    void processReviewQueue();
  };

  activeReviewJobs += 1;
  if (provider === 'codex') {
    void startCommandJob('codex', [
      'exec',
      '--cd',
      repoRoot,
      '--sandbox',
      'read-only',
      '-',
    ], {}, {
      job,
      stdin: prompt,
      timeoutMs: 180000,
      context: job.context,
      onFinish: finalizeReview,
      onSettled,
      displayCommand: `$ codex exercise review ${exercise.id}`,
    });
  } else {
    void startCommandJob('claude', [
      '--print',
      '--tools',
      '',
      '--output-format',
      'text',
      prompt,
    ], {}, {
      job,
      timeoutMs: 180000,
      context: job.context,
      onFinish: finalizeReview,
      onSettled,
      displayCommand: `$ claude exercise review ${exercise.id}`,
    });
  }
}

async function processReviewQueue() {
  while (activeReviewJobs < reviewConcurrency && reviewQueue.length) {
    const jobId = reviewQueue.shift();
    const job = reviewJobs.get(jobId);
    if (!job || job.status !== 'queued') continue;
    startQueuedReviewJob(job);
  }
}

async function enqueueExerciseReview(provider, exercise) {
  if (!['codex', 'claude'].includes(provider)) {
    throw new Error(`Unknown review agent: ${provider}`);
  }

  const job = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    provider,
    exerciseId: exercise.id,
    exerciseName: exercise.name || exercise.id,
    status: 'queued',
    ok: null,
    code: null,
    output: `${provider} exercise review queued for ${exercise.name || exercise.id}\n`,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    elapsedMs: 0,
    context: { exerciseId: exercise.id, exercise },
  };
  reviewJobs.set(job.id, job);
  reviewQueue.push(job.id);
  await saveReviewJob(job);
  void processReviewQueue();
  return job;
}

async function enqueueExerciseReviews(provider, exercises) {
  const jobs = [];
  for (const exercise of exercises) {
    jobs.push(await enqueueExerciseReview(provider, exercise));
  }
  return jobs;
}

async function latestArkTask(exercise) {
  const cdnslug = cdnSlugFor(exercise);
  const id = exercise?.id;
  if (!cdnslug && !id) return null;

  const matchesExercise = (record) => [id, exercise?.metadata?.identityKey, cdnslug].filter(Boolean).includes(record?.id) || record?.cdnslug === cdnslug;
  const created = (await readNdjson(arkTasksPath)).filter(matchesExercise).at(-1);
  const statuses = (await readNdjson(arkTaskStatusPath)).filter(matchesExercise);
  const createdTaskId = taskIdFromRecord(created);
  const latestStatus = (
    createdTaskId
      ? statuses.filter((record) => taskIdFromRecord(record) === createdTaskId)
      : statuses
  ).at(-1);
  const taskId = createdTaskId || taskIdFromRecord(latestStatus);

  if (!created && !latestStatus && !taskId) return null;

  return {
    taskId,
    status: latestStatus?.status || created?.status || null,
    createdAt: created?.createdAt || null,
    checkedAt: latestStatus?.checkedAt || null,
    downloaded: latestStatus?.downloaded === true,
    resultVideoUrl: latestStatus?.resultVideoUrl || null,
    error: created?.error?.message || null,
  };
}

async function mediaStatus(exercise) {
  const cdnslug = cdnSlugFor(exercise);
  if (!cdnslug) return {};

  const sourcePath = path.join(libraryRoot, cdnslug, 'source', `${cdnslug}.mp4`);
  const defaultPath = path.join(libraryRoot, cdnslug, 'default', `${cdnslug}.mp4`);
  const sourceOriginals = await fs.readdir(path.join(workspaceRoot, 'videos')).catch(() => []);
  const originalPrefixes = [exercise.id, exercise.metadata?.identityKey, cdnslug].filter(Boolean);
  const sourceVersion = await fileVersion(sourcePath);
  const defaultVersion = await fileVersion(defaultPath);
  const sourceQuery = `variant=source&slug=${encodeURIComponent(cdnslug)}${sourceVersion ? `&v=${sourceVersion}` : ''}`;
  const defaultQuery = `variant=default&slug=${encodeURIComponent(cdnslug)}${defaultVersion ? `&v=${defaultVersion}` : ''}`;

  return {
    sourceClip: await pathExists(sourcePath),
    defaultClip: await pathExists(defaultPath),
    sourceUrl: `/api/library/video?${sourceQuery}`,
    defaultUrl: `/api/library/video?${defaultQuery}`,
    sourcePath: path.relative(repoRoot, sourcePath),
    defaultPath: path.relative(repoRoot, defaultPath),
    downloadedOriginals: sourceOriginals.filter((name) => originalPrefixes.some((prefix) => name.startsWith(`${prefix}_`))),
    arkTask: await latestArkTask(exercise),
  };
}

async function deleteDefaultVideoForExercise(id) {
  const exercises = await readExercises();
  const exercise = findExerciseByIdentifier(exercises, id);
  const cdnslug = cdnSlugFor(exercise);
  if (!exercise || !cdnslug) {
    throw new Error(`Exercise not found or missing cdnslug: ${id}`);
  }

  const defaultPath = path.join(libraryRoot, cdnslug, 'default', `${cdnslug}.mp4`);
  const existed = await pathExists(defaultPath);
  await fs.rm(defaultPath, { force: true });
  await fs.rmdir(path.dirname(defaultPath)).catch(() => {});

  const defaultCdnPath = `/libraries/tsl26/${cdnslug}/default/${cdnslug}.mp4`;
  const updatedExercise = {
    ...exercise,
    media: (Array.isArray(exercise.media) ? exercise.media : []).filter((item) => !(
      item?.type === 'video' &&
      item?.source === 'uploaded' &&
      String(item?.url || '').includes(defaultCdnPath)
    )),
  };
  const nextExercises = exercises.map((item) => (item.id === exercise.id ? updatedExercise : item));
  await persistExercises(nextExercises);

  return {
    ok: true,
    output: `${existed ? 'Deleted' : 'Default file not found'}: ${path.relative(repoRoot, defaultPath)}\nUpdated exercises NDJSON metadata.`,
    exercise: updatedExercise,
  };
}

async function generateThumbnailForExercise(id) {
  const exercises = await readExercises();
  const exercise = findExerciseByIdentifier(exercises, id);
  const cdnslug = cdnSlugFor(exercise);
  if (!exercise || !cdnslug) {
    throw new Error(`Exercise not found or missing cdnslug: ${id}`);
  }

  const defaultPath = path.join(libraryRoot, cdnslug, 'default', `${cdnslug}.mp4`);
  if (!(await pathExists(defaultPath))) {
    throw new Error(`Default video not found: ${path.relative(repoRoot, defaultPath)}`);
  }

  return runCommand('node', [
    'generate-thumbnails.mjs',
    '--from=default',
    `--slugs=${cdnslug}`,
    '--overwrite',
  ]);
}

async function readLibrarySlugs() {
  return (await fs.readdir(libraryRoot, { withFileTypes: true }).catch(() => []))
    .filter((entry) => entry.isDirectory() && entry.name !== 'references')
    .map((entry) => entry.name)
    .sort();
}

async function readLibraryInventory() {
  const librarySlugs = await readLibrarySlugs();
  const defaultSlugs = [];
  const sourceSlugs = [];
  await Promise.all(librarySlugs.map(async (slug) => {
    const [hasDefault, hasSource] = await Promise.all([
      pathExists(path.join(libraryRoot, slug, 'default', `${slug}.mp4`)),
      pathExists(path.join(libraryRoot, slug, 'source', `${slug}.mp4`)),
    ]);
    if (hasDefault) defaultSlugs.push(slug);
    if (hasSource) sourceSlugs.push(slug);
  }));
  return { librarySlugs, defaultSlugs: defaultSlugs.sort(), sourceSlugs: sourceSlugs.sort() };
}

function buildLibraryRelation(exercises, librarySlugs) {
  const exercisesBySlug = new Map();
  const duplicateSlugs = [];

  for (const exercise of exercises) {
    const slug = cdnSlugFor(exercise);
    if (!slug) continue;
    const matches = exercisesBySlug.get(slug) || [];
    matches.push({ id: exercise.id, name: exercise.name });
    exercisesBySlug.set(slug, matches);
  }

  for (const [slug, matches] of exercisesBySlug.entries()) {
    if (matches.length > 1) duplicateSlugs.push({ slug, exercises: matches });
  }

  const librarySlugSet = new Set(librarySlugs);
  return {
    folders: librarySlugs.length,
    matchedFolders: librarySlugs.filter((slug) => exercisesBySlug.has(slug)).length,
    exerciseSlugs: exercisesBySlug.size,
    missingFolders: [...exercisesBySlug.keys()].filter((slug) => !librarySlugSet.has(slug)).sort(),
    orphanFolders: librarySlugs.filter((slug) => !exercisesBySlug.has(slug)),
    duplicateSlugs,
  };
}

function exerciseEditorPlugin() {
  return {
    name: 'exercise-file-editor',
    configureServer(server) {
      void restoreReviewQueue();
      server.middlewares.use('/api/exercises', async (req, res) => {
        try {
          if (req.method === 'GET') {
            const exercises = await readExercises();
            const librarySlugs = await readLibrarySlugs();
            send(res, 200, {
              exercises,
              librarySlugs,
              libraryRelation: buildLibraryRelation(exercises, librarySlugs),
              ndjsonPath: path.relative(repoRoot, ndjsonPath),
            });
            return;
          }

          if (req.method === 'POST') {
            const payload = JSON.parse(await readBody(req));
            if (!Array.isArray(payload.exercises)) {
              send(res, 400, { error: 'Expected { exercises: [...] }' });
              return;
            }

            await persistExercises(payload.exercises);
            send(res, 200, { ok: true, count: payload.exercises.length });
            return;
          }

          send(res, 405, { error: 'Method not allowed' });
        } catch (error) {
          send(res, 500, { error: error.message });
        }
      });

      server.middlewares.use('/api/library/inventory', async (req, res) => {
        try {
          send(res, 200, await readLibraryInventory());
        } catch (error) {
          send(res, 500, { error: error.message });
        }
      });

      server.middlewares.use('/api/media/status', async (req, res) => {
        try {
          const url = new URL(req.url, 'http://localhost');
          const id = url.searchParams.get('id');
          const exercises = await readExercises();
          const exercise = findExerciseByIdentifier(exercises, id);
          send(res, 200, { status: await mediaStatus(exercise) });
        } catch (error) {
          send(res, 500, { error: error.message });
        }
      });

      server.middlewares.use('/api/review/status', async (req, res) => {
        try {
          const url = new URL(req.url, 'http://localhost');
          const jobId = url.searchParams.get('jobId');
          const job = reviewJobs.get(jobId) || (await readReviewJobs()).find((item) => item.id === jobId);
          if (!job) {
            send(res, 404, { error: `Review job not found: ${jobId}` });
            return;
          }
          send(res, 200, {
            id: job.id,
            status: job.status,
            ok: job.ok,
            code: job.code,
            output: job.output,
            elapsedMs: job.status === 'running' ? Date.now() - job.startedAt : job.elapsedMs,
            pid: job.pid,
          });
        } catch (error) {
          send(res, 500, { error: error.message });
        }
      });

      server.middlewares.use('/api/review/propose', async (req, res) => {
        try {
          if (req.method !== 'POST') {
            send(res, 405, { error: 'Method not allowed' });
            return;
          }
          const body = JSON.parse(await readBody(req));
          const { id, instructions = '', provider = 'claude' } = body || {};
          if (!id) {
            send(res, 400, { error: 'Missing exercise id' });
            return;
          }
          const exercises = await readExercises();
          const exercise = findExerciseByIdentifier(exercises, id);
          if (!exercise) {
            send(res, 404, { error: `Exercise not found: ${id}` });
            return;
          }
          const localEnv = await readLocalEnv();
          const apiKeys = {
            anthropic: req.headers['x-anthropic-api-key'] || localEnv.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY || '',
            openai: req.headers['x-openai-api-key'] || localEnv.OPENAI_API_KEY || process.env.OPENAI_API_KEY || '',
          };
          const models = {
            anthropic: req.headers['x-anthropic-model'] || localEnv.REVIEW_ANTHROPIC_MODEL || '',
            openai: req.headers['x-openai-model'] || localEnv.REVIEW_OPENAI_MODEL || '',
          };
          const result = await proposeExerciseChanges({ exercise, instructions, provider, apiKeys, models });
          send(res, 200, { ok: true, exerciseId: exercise.id, ...result });
        } catch (error) {
          send(res, 500, { error: error.message });
        }
      });

      server.middlewares.use('/api/review/jobs', async (req, res) => {
        try {
          if (req.method === 'GET') {
            send(res, 200, { jobs: await readReviewJobs(), active: activeReviewJobs, queued: reviewQueue.length, concurrency: reviewConcurrency });
            return;
          }

          if (req.method === 'POST') {
            const { ids, reviewAgent = 'codex' } = JSON.parse(await readBody(req));
            const requestedIds = Array.isArray(ids) ? ids : [];
            if (!requestedIds.length) {
              send(res, 400, { error: 'Expected { ids: [...] }' });
              return;
            }

            const exercises = await readExercises();
            const selectedExercises = requestedIds.map((id) => findExerciseByIdentifier(exercises, id)).filter(Boolean);
            const jobs = await enqueueExerciseReviews(reviewAgent, selectedExercises);
            send(res, 200, { ok: true, jobs, count: jobs.length });
            return;
          }

          send(res, 405, { error: 'Method not allowed' });
        } catch (error) {
          send(res, 500, { error: error.message });
        }
      });

      server.middlewares.use('/api/youtube/search', async (req, res) => {
        try {
          const url = new URL(req.url, 'http://localhost');
          const query = url.searchParams.get('q')?.trim();
          if (!query) {
            send(res, 400, { error: 'Missing search query' });
            return;
          }

          const result = await runCommandJsonLines('python3', [
            '-m',
            'yt_dlp',
            '--dump-json',
            '--flat-playlist',
            `ytsearch12:${query}`,
          ]);
          if (!result.ok) {
            send(res, 500, { error: result.stderr || 'YouTube search failed' });
            return;
          }

          const results = result.stdout
            .split('\n')
            .filter(Boolean)
            .map((line) => {
              try {
                return normalizeYouTubeResult(JSON.parse(line));
              } catch {
                return null;
              }
            })
            .filter(Boolean);

          send(res, 200, { results });
        } catch (error) {
          send(res, 500, { error: error.message });
        }
      });

      server.middlewares.use('/api/source-clip', async (req, res) => {
        try {
          if (req.method !== 'POST') {
            send(res, 405, { error: 'Method not allowed' });
            return;
          }

          const { id, youtubeId, start, duration = 4, title, channel } = JSON.parse(await readBody(req));
          if (!id) return send(res, 400, { error: 'Missing exercise id' });
          if (!/^[a-zA-Z0-9_-]{11}$/.test(youtubeId || '')) {
            return send(res, 400, { error: 'Expected valid youtubeId (11 chars)' });
          }
          const startSeconds = Number(start);
          const durationSeconds = Number(duration);
          if (!Number.isFinite(startSeconds) || startSeconds < 0) {
            return send(res, 400, { error: 'Expected start >= 0' });
          }
          if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > 30) {
            return send(res, 400, { error: 'Expected 0 < duration <= 30' });
          }

          const exercises = await readExercises();
          const exercise = findExerciseByIdentifier(exercises, id);
          if (!exercise) return send(res, 404, { error: `Exercise not found: ${id}` });

          const result = await runCommand('node', [
            'download-youtube-clips.mjs',
            `--ids=${exercise.id}`,
            `--youtube-id=${youtubeId}`,
            `--start=${startSeconds}`,
            `--duration=${durationSeconds}`,
            '--overwrite',
          ]);

          if (!result.ok) {
            send(res, 500, { error: 'Source clip build failed', output: result.output });
            return;
          }

          const updated = exerciseWithSourceClip(exercise, {
            youtubeId,
            title,
            channel,
            start: startSeconds,
            duration: durationSeconds,
          });
          const nextExercises = exercises.map((item) => (item.id === exercise.id ? updated : item));
          await persistExercises(nextExercises);

          send(res, 200, {
            ok: true,
            output: result.output,
            exercise: updated,
            sourceClip: updated.metadata.sourceClip,
          });
        } catch (error) {
          send(res, 500, { error: error.message });
        }
      });

      server.middlewares.use('/api/library/video', async (req, res) => {
        try {
          const url = new URL(req.url, 'http://localhost');
          const slug = url.searchParams.get('slug');
          const variant = url.searchParams.get('variant');
          if (!slug || !['source', 'default'].includes(variant) || !/^[a-zA-Z0-9_-]+$/.test(slug)) {
            send(res, 400, { error: 'Expected valid slug and variant' });
            return;
          }

          const videoPath = path.join(libraryRoot, slug, variant, `${slug}.mp4`);
          if (!(await pathExists(videoPath))) {
            send(res, 404, { error: 'Video not found' });
            return;
          }

          res.statusCode = 200;
          res.setHeader('Content-Type', 'video/mp4');
          res.setHeader('Cache-Control', 'no-store');
          createReadStream(videoPath).pipe(res);
        } catch (error) {
          send(res, 500, { error: error.message });
        }
      });

      server.middlewares.use('/api/media/action', async (req, res) => {
        try {
          if (req.method !== 'POST') {
            send(res, 405, { error: 'Method not allowed' });
            return;
          }

          const { action, id, overwrite, forceCreate, arkApiKey, defaceOptions, reviewAgent } = JSON.parse(await readBody(req));
          const extraEnv = arkApiKey ? { ARK_API_KEY: arkApiKey } : {};
          if (!id) {
            send(res, 400, { error: 'Missing exercise id' });
            return;
          }

          let result;
          if (action === 'download-youtube') {
            result = await runCommand('node', ['download-youtube-clips.mjs', `--ids=${id}`, ...(overwrite ? ['--overwrite'] : [])]);
          } else if (action === 'generate-source-task') {
            result = await runCommand('node', ['create-ark-style-tasks.mjs', `--ids=${id}`], extraEnv);
          } else if (action === 'preview-source-task') {
            result = await runCommand('node', ['create-ark-style-tasks.mjs', `--ids=${id}`, '--dry-run']);
          } else if (action === 'sync-default') {
            result = await runQueuedSyncMedia(extraEnv);
          } else if (action === 'generate-default') {
            result = await runDefaultPollFlow(id, extraEnv);
          } else if (action === 'generate-ai-video') {
            result = await runAiVideoFlow(id, extraEnv, { forceCreate: forceCreate === true });
          } else if (action === 'delete-default') {
            result = await deleteDefaultVideoForExercise(id);
          } else if (action === 'generate-thumbnail') {
            result = await generateThumbnailForExercise(id);
          } else if (action === 'review-exercise') {
            const exercises = await readExercises();
            const exercise = findExerciseByIdentifier(exercises, id);
            if (!exercise) {
              send(res, 404, { error: `Exercise not found: ${id}` });
              return;
            }
            const job = await enqueueExerciseReview(reviewAgent || 'codex', exercise);
            result = {
              ok: true,
              jobId: job.id,
              output: `${job.provider} exercise review queued for ${exercise.name || exercise.id}\nJob: ${job.id}`,
            };
          } else if (action === 'deface-source') {
            const args = ['deface-source-video.mjs', `--ids=${id}`];
            if (defaceOptions) {
              if (defaceOptions.replaceWith) args.push(`--replace=${defaceOptions.replaceWith}`);
              if (Number.isFinite(defaceOptions.thresh)) args.push(`--thresh=${defaceOptions.thresh}`);
              if (Number.isFinite(defaceOptions.maskScale)) args.push(`--mask-scale=${defaceOptions.maskScale}`);
              if (Number.isFinite(defaceOptions.mosaicSize)) args.push(`--mosaic-size=${defaceOptions.mosaicSize}`);
              if (Number.isFinite(defaceOptions.passes)) args.push(`--passes=${defaceOptions.passes}`);
              if (defaceOptions.keepOriginal) args.push('--keep-original');
            }
            result = await runCommand('node', args);
          } else {
            send(res, 400, { error: `Unknown action: ${action}` });
            return;
          }

          send(res, result.ok ? 200 : 500, result);
        } catch (error) {
          send(res, 500, { error: error.message });
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), exerciseEditorPlugin()],
});
