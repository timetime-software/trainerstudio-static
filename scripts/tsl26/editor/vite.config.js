import react from '@vitejs/plugin-react';
import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const editorDir = path.dirname(fileURLToPath(import.meta.url));
const toolDir = path.resolve(editorDir, '..');
const repoRoot = path.resolve(toolDir, '../..');
const jsonPath = path.join(toolDir, 'data/exercises.json');
const ndjsonPath = path.join(toolDir, 'data/exercises.ndjson');
const libraryRoot = path.join(repoRoot, 'libraries/tsl26');
const envPath = path.join(editorDir, '.env');
const arkTasksPath = path.join(toolDir, 'source/ark-style-tasks.ndjson');
const arkTaskStatusPath = path.join(toolDir, 'source/ark-style-task-status.ndjson');

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

async function runCommand(command, args, extraEnv = {}) {
  const localEnv = await readLocalEnv();
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn(command, args, {
      cwd: toolDir,
      env: { ...process.env, ...localEnv, ...extraEnv },
    });
    let output = '';

    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.on('close', (code) => {
      resolve({ ok: code === 0, code, output, elapsedMs: Date.now() - startedAt });
    });
    child.on('error', (error) => {
      resolve({ ok: false, code: null, output: error.message, elapsedMs: Date.now() - startedAt });
    });
  });
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

async function runCommandSequence(steps, extraEnv = {}) {
  const results = [];
  for (const step of steps) {
    const result = await runCommand(step.command, step.args, extraEnv);
    results.push({ ...step, ...result });
    if (!result.ok) break;
  }

  return {
    ok: results.every((result) => result.ok),
    code: results.at(-1)?.code ?? 0,
    elapsedMs: results.reduce((total, result) => total + result.elapsedMs, 0),
    output: results.map((result) => `$ ${result.command} ${result.args.join(' ')}\n${result.output}`.trim()).join('\n\n'),
  };
}

async function runAiVideoFlow(id, extraEnv = {}) {
  const results = [];

  const pushResult = async (command, args) => {
    const result = await runCommand(command, args, extraEnv);
    results.push({ command, args, ...result });
    return result;
  };

  const downloadResult = await pushResult('node', ['download-youtube-clips.mjs', `--ids=${id}`]);
  if (!downloadResult.ok) return commandSequenceResult(results);

  const createResult = await pushResult('node', ['create-ark-style-tasks.mjs', `--ids=${id}`]);
  if (!createResult.ok || /failed=[1-9]\d*|Ark request failed/i.test(createResult.output)) {
    return commandSequenceResult(results, false);
  }

  const pollResult = await pushResult('node', ['poll-ark-style-tasks.mjs', `--ids=${id}`, '--once', '--download']);
  if (!pollResult.ok || /No created tasks to poll|: failed|: cancelled|: expired/i.test(pollResult.output)) {
    return commandSequenceResult(results, false);
  }

  await pushResult('node', ['--experimental-strip-types', 'sync-cdn-media.ts']);
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
  await fs.writeFile(jsonPath, `${JSON.stringify(exercises, null, 2)}\n`);
  await fs.writeFile(ndjsonPath, `${exercises.map((exercise) => JSON.stringify(exercise)).join('\n')}\n`);
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

async function latestArkTask(exercise) {
  const cdnslug = exercise?.cdnslug || exercise?.cdnSlug;
  const id = exercise?.id;
  if (!cdnslug && !id) return null;

  const matchesExercise = (record) => record?.id === id || record?.cdnslug === cdnslug;
  const created = (await readNdjson(arkTasksPath)).filter(matchesExercise).at(-1);
  const statuses = (await readNdjson(arkTaskStatusPath)).filter(matchesExercise);
  const latestStatus = statuses.at(-1);
  const taskId = taskIdFromRecord(latestStatus) || taskIdFromRecord(created);

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
  const cdnslug = exercise?.cdnslug || exercise?.cdnSlug;
  if (!cdnslug) return {};

  const sourcePath = path.join(libraryRoot, cdnslug, 'source', `${cdnslug}.mp4`);
  const defaultPath = path.join(libraryRoot, cdnslug, 'default', `${cdnslug}.mp4`);
  const sourceOriginals = await fs.readdir(path.join(toolDir, 'source/videos')).catch(() => []);
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
    downloadedOriginals: sourceOriginals.filter((name) => name.startsWith(`${exercise.id}_`)),
    arkTask: await latestArkTask(exercise),
  };
}

async function readLibrarySlugs() {
  return (await fs.readdir(libraryRoot, { withFileTypes: true }).catch(() => []))
    .filter((entry) => entry.isDirectory() && entry.name !== 'references')
    .map((entry) => entry.name)
    .sort();
}

function buildLibraryRelation(exercises, librarySlugs) {
  const exercisesBySlug = new Map();
  const duplicateSlugs = [];

  for (const exercise of exercises) {
    const slug = exercise.cdnslug || exercise.cdnSlug;
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
            const exercises = JSON.parse(await fs.readFile(jsonPath, 'utf8'));
            const librarySlugs = await readLibrarySlugs();
            send(res, 200, {
              exercises,
              librarySlugs,
              libraryRelation: buildLibraryRelation(exercises, librarySlugs),
              jsonPath: path.relative(repoRoot, jsonPath),
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

      server.middlewares.use('/api/media/status', async (req, res) => {
        try {
          const url = new URL(req.url, 'http://localhost');
          const id = url.searchParams.get('id');
          const exercises = JSON.parse(await fs.readFile(jsonPath, 'utf8'));
          const exercise = exercises.find((item) => item.id === id);
          send(res, 200, { status: await mediaStatus(exercise) });
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

          const exercises = JSON.parse(await fs.readFile(jsonPath, 'utf8'));
          const exercise = exercises.find((item) => item.id === id);
          if (!exercise) return send(res, 404, { error: `Exercise not found: ${id}` });

          const result = await runCommand('node', [
            'download-youtube-clips.mjs',
            `--ids=${id}`,
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
          const nextExercises = exercises.map((item) => (item.id === id ? updated : item));
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

          const { action, id, overwrite, arkApiKey, defaceOptions } = JSON.parse(await readBody(req));
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
            result = await runCommand('node', ['--experimental-strip-types', 'sync-cdn-media.ts']);
          } else if (action === 'generate-default') {
            result = await runCommandSequence([
              { command: 'node', args: ['poll-ark-style-tasks.mjs', `--ids=${id}`, '--once', '--download'] },
              { command: 'node', args: ['--experimental-strip-types', 'sync-cdn-media.ts'] },
            ], extraEnv);
          } else if (action === 'generate-ai-video') {
            result = await runAiVideoFlow(id, extraEnv);
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
