import react from '@vitejs/plugin-react';
import { spawn } from 'node:child_process';
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

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function mediaStatus(exercise) {
  const cdnslug = exercise?.cdnslug || exercise?.cdnSlug;
  if (!cdnslug) return {};

  const sourcePath = path.join(libraryRoot, cdnslug, 'source', `${cdnslug}.mp4`);
  const defaultPath = path.join(libraryRoot, cdnslug, 'default', `${cdnslug}.mp4`);
  const sourceOriginals = await fs.readdir(path.join(toolDir, 'source/videos')).catch(() => []);

  return {
    sourceClip: await pathExists(sourcePath),
    defaultClip: await pathExists(defaultPath),
    sourcePath: path.relative(repoRoot, sourcePath),
    defaultPath: path.relative(repoRoot, defaultPath),
    downloadedOriginals: sourceOriginals.filter((name) => name.startsWith(`${exercise.id}_`)),
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
            const librarySlugs = (await fs.readdir(libraryRoot, { withFileTypes: true }).catch(() => []))
              .filter((entry) => entry.isDirectory() && entry.name !== 'references')
              .map((entry) => entry.name)
              .sort();
            send(res, 200, {
              exercises,
              librarySlugs,
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

            await fs.writeFile(jsonPath, `${JSON.stringify(payload.exercises, null, 2)}\n`);
            await fs.writeFile(ndjsonPath, `${payload.exercises.map((exercise) => JSON.stringify(exercise)).join('\n')}\n`);
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

      server.middlewares.use('/api/media/action', async (req, res) => {
        try {
          if (req.method !== 'POST') {
            send(res, 405, { error: 'Method not allowed' });
            return;
          }

          const { action, id, overwrite, arkApiKey } = JSON.parse(await readBody(req));
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
