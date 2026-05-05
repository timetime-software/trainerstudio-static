#!/usr/bin/env node

import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { pipeline } from 'stream/promises';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');
const LIBRARY_ROOT = join(REPO_ROOT, 'libraries/tsl26');
const DEFAULT_ENDPOINT = 'https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks';
const DEFAULT_INPUT = join(__dirname, 'source/ark-style-tasks.ndjson');
const DEFAULT_OUTPUT = join(__dirname, 'source/ark-style-task-status.ndjson');

function parseArgs(argv) {
  const args = {
    input: DEFAULT_INPUT,
    output: DEFAULT_OUTPUT,
    endpoint: DEFAULT_ENDPOINT,
    ids: null,
    download: false,
    once: false,
    poll: false,
    intervalMs: 10000,
    maxPolls: 180,
  };

  for (const arg of argv) {
    const [key, rawValue] = arg.split('=');
    const value = rawValue ?? '';

    if (key === '--input') args.input = resolve(value);
    else if (key === '--output') args.output = resolve(value);
    else if (key === '--endpoint') args.endpoint = value.replace(/\/+$/, '');
    else if (key === '--ids') args.ids = new Set(value.split(',').map((id) => id.trim()).filter(Boolean));
    else if (key === '--download') args.download = true;
    else if (key === '--once') args.once = true;
    else if (key === '--poll') args.poll = true;
    else if (key === '--interval-ms') args.intervalMs = Number(value);
    else if (key === '--max-polls') args.maxPolls = Number(value);
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function readRecords(input) {
  if (!existsSync(input)) return [];

  return readFileSync(input, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function latestRecordKey(record) {
  return record.cdnslug ?? record.id ?? taskIdFromRecord(record);
}

function latestCreatedRecords(records) {
  const byKey = new Map();

  for (const record of records) {
    const key = latestRecordKey(record);
    if (!key) continue;
    byKey.set(key, record);
  }

  return [...byKey.values()];
}

function appendOutput(output, record) {
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(record)}\n`, { flag: 'a' });
}

function taskIdFromRecord(record) {
  return record.taskId ?? record.task?.id ?? record.task?.task_id ?? record.task?.data?.id ?? record.task?.data?.task_id ?? null;
}

function statusFromTask(task) {
  return task?.status ?? task?.data?.status ?? task?.task?.status ?? null;
}

function resultVideoUrlFromTask(task) {
  return (
    task?.content?.video_url ??
    task?.content?.video?.url ??
    task?.content?.[0]?.video_url?.url ??
    task?.data?.content?.video_url ??
    task?.data?.content?.video?.url ??
    task?.data?.content?.[0]?.video_url?.url ??
    task?.result?.video_url ??
    task?.result?.video?.url ??
    task?.output?.video_url ??
    task?.output?.video?.url ??
    null
  );
}

function isTerminalStatus(status) {
  return ['succeeded', 'failed', 'cancelled', 'expired'].includes(status);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getTask(args, taskId) {
  const apiKey = process.env.ARK_API_KEY;
  if (!apiKey) throw new Error('Missing ARK_API_KEY environment variable');

  const response = await fetch(`${args.endpoint}/${taskId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(`Ark status request failed with ${response.status}: ${text}`);
  }

  return body;
}

async function downloadUrl(url, outputPath) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed with ${response.status}: ${url}`);

  mkdirSync(dirname(outputPath), { recursive: true });
  await pipeline(response.body, createWriteStream(outputPath));
}

async function handleRecord(args, record) {
  const taskId = taskIdFromRecord(record);
  if (!taskId) return { skipped: true, reason: 'missing taskId', record };

  const task = await getTask(args, taskId);
  const status = statusFromTask(task);
  const resultVideoUrl = resultVideoUrlFromTask(task);
  const outputPath = join(LIBRARY_ROOT, record.cdnslug, 'default', `${record.cdnslug}.mp4`);

  const statusRecord = {
    checkedAt: new Date().toISOString(),
    id: record.id,
    cdnslug: record.cdnslug,
    taskId,
    status,
    resultVideoUrl,
    outputPath: resultVideoUrl ? outputPath : null,
    task,
  };

  if (args.download && status === 'succeeded' && resultVideoUrl) {
    await downloadUrl(resultVideoUrl, outputPath);
    statusRecord.downloaded = true;
  }

  appendOutput(args.output, statusRecord);
  return statusRecord;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const records = latestCreatedRecords(readRecords(args.input).filter((record) => record.status === 'created')).filter((record) => {
    if (!args.ids) return true;
    return args.ids.has(record.id) || args.ids.has(record.cdnslug) || args.ids.has(taskIdFromRecord(record));
  });

  if (records.length === 0) {
    console.log('No created tasks to poll');
    return;
  }

  const shouldPoll = args.poll && !args.once;
  for (let attempt = 1; attempt <= (shouldPoll ? args.maxPolls : 1); attempt++) {
    let pending = 0;

    for (const record of records) {
      const result = await handleRecord(args, record);
      if (!isTerminalStatus(result.status)) pending++;
      console.log(`${record.cdnslug}: ${result.status ?? result.reason}`);
    }

    if (!shouldPoll || pending === 0) return;
    console.log(`Pending tasks: ${pending}. Poll ${attempt}/${args.maxPolls}`);
    await sleep(args.intervalMs);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
