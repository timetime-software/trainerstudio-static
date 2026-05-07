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

const editorDir = path.dirname(fileURLToPath(import.meta.url));
const toolDir = path.resolve(editorDir, '..');
const repoRoot = path.resolve(toolDir, '../..');
const workspaceRoot = path.join(toolDir, '.workspace');
const ndjsonPath = path.join(toolDir, 'data/exercises.ndjson');
const libraryRoot = path.join(repoRoot, 'libraries/tsl26');
const envPath = path.join(editorDir, '.env');
const arkTasksPath = path.join(workspaceRoot, 'ark/style-tasks.ndjson');
const arkTaskStatusPath = path.join(workspaceRoot, 'ark/style-task-status.ndjson');
const syncMediaArgs = ['--experimental-strip-types', 'sync-cdn-media.ts'];
let syncMediaQueue = Promise.resolve();
const reviewJobs = new Map();

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

async function startCommandJob(command, args, extraEnv = {}, options = {}) {
  const localEnv = await readLocalEnv();
  const jobId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const startedAt = Date.now();
  const job = {
    id: jobId,
    command,
    args,
    context: options.context || null,
    ok: null,
    code: null,
    status: 'running',
    output: `$ ${command} ${args.filter((arg) => arg !== '-').join(' ')}\n`,
    startedAt,
    elapsedMs: 0,
  };
  reviewJobs.set(jobId, job);

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
      elapsedMs: Date.now() - startedAt,
    });
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
  });
  child.stderr.on('data', (chunk) => {
    job.output += chunk.toString();
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

  setTimeout(() => reviewJobs.delete(jobId), 30 * 60 * 1000);
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

async function persistExercises(exercises) {
  await fs.writeFile(ndjsonPath, `${exercises.map((exercise) => JSON.stringify(exercise)).join('\n')}\n`);
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

  const exercises = await readExercises();
  const index = exercises.findIndex((exercise) => findExerciseByIdentifier([exercise], id));
  if (index < 0) throw new Error(`Exercise not found after review: ${id}`);

  exercises[index] = reviewed;
  await persistExercises(exercises);
  return reviewed;
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

async function runExerciseReviewAgent(provider, exercise) {
  if (!['codex', 'claude'].includes(provider)) {
    throw new Error(`Unknown review agent: ${provider}`);
  }

  const prompt = buildExerciseReviewPrompt(exercise, provider);
  const finalizeReview = async (job) => {
    if (!job.ok) return job;
    try {
      const rawOutput = String(job.output || '').replace(/^\$ .*\n/, '');
      const reviewed = await applyReviewedExercise(exercise.id, rawOutput);
      return {
        ...job,
        reviewed,
        output: `Applied reviewed JSON for ${exercise.id}.\n\n${rawOutput}`.trim(),
      };
    } catch (error) {
      return {
        ...job,
        ok: false,
        code: job.code ?? 1,
        output: `${job.output}\n\nFailed to apply reviewed JSON: ${error.message}`,
      };
    }
  };
  const job = provider === 'codex'
    ? await startCommandJob('codex', [
      'exec',
      '--cd',
      repoRoot,
      '--sandbox',
      'read-only',
      '-',
    ], {}, { stdin: prompt, timeoutMs: 180000, context: { exerciseId: exercise.id }, onFinish: finalizeReview })
    : await startCommandJob('claude', [
      '--print',
      '--tools',
      '',
      '--output-format',
      'text',
      prompt,
    ], {}, { timeoutMs: 180000, context: { exerciseId: exercise.id }, onFinish: finalizeReview });

  return {
    ok: true,
    jobId: job.id,
    output: `${provider} exercise review started for ${exercise.id}\nJob: ${job.id}`,
  };
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
          const job = reviewJobs.get(jobId);
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
            result = await runExerciseReviewAgent(reviewAgent || 'codex', exercise);
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
