#!/usr/bin/env node

/**
 * Downloads all public exercise images from external sources and organizes them
 * into the CDN folder structure: libraries/{library-slug}/{exercise-id}/default/{filename}
 *
 * Also generates mapping.json for the URL migration script.
 *
 * Usage: node scripts/download-images.mjs <exported-exercises.json>
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const LIBRARY_MAP = {
  '6846e73a2afa9500082de3b8': 'free-exercise-db-v1',
  '6916f7f24fea5f2e587871d3': 'fitdb-v1',
};

const CDN_BASE = 'https://cdn.trainerstudio.com';
const CONCURRENCY = 20;

async function downloadFile(url, destPath) {
  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      mkdirSync(dirname(destPath), { recursive: true });
      writeFileSync(destPath, buffer);
      return true;
    } catch (err) {
      if (attempt === maxRetries) {
        console.error(`FAILED (${attempt}/${maxRetries}): ${url} — ${err.message}`);
        return false;
      }
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

function getFileName(imageUrl) {
  const parts = imageUrl.split('/');
  return parts[parts.length - 1];
}

async function processInBatches(items, batchSize, fn) {
  let completed = 0;
  const total = items.length;
  const results = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
    completed += batch.length;
    if (completed % 100 === 0 || completed === total) {
      console.log(`Progress: ${completed}/${total}`);
    }
  }
  return results;
}

async function main() {
  const inputFile = process.argv[2];
  if (!inputFile) {
    console.error('Usage: node scripts/download-images.mjs <exported-exercises.json>');
    process.exit(1);
  }

  const rawLines = readFileSync(inputFile, 'utf-8').trim().split('\n');

  // Handle JSONL (one object per line, possibly with trailing comma) or JSON array
  let exercises;
  if (rawLines[0].startsWith('[')) {
    exercises = JSON.parse(rawLines.join('\n'));
  } else {
    exercises = rawLines.map((line) => JSON.parse(line.replace(/,\s*$/, '')));
  }

  console.log(`Loaded ${exercises.length} exercises`);

  const mapping = {};
  const downloadTasks = [];

  for (const exercise of exercises) {
    const libraryOid = exercise.libraryId?.$oid || exercise.libraryId;
    const librarySlug = LIBRARY_MAP[libraryOid];
    if (!librarySlug) {
      console.warn(`Unknown library ID: ${libraryOid} for exercise ${exercise.id}`);
      continue;
    }

    const images = exercise.images || [];
    for (const imageUrl of images) {
      const fileName = getFileName(imageUrl);
      const cdnPath = `libraries/${librarySlug}/${exercise.id}/default/${fileName}`;
      const destPath = join(ROOT, cdnPath);

      mapping[imageUrl] = `${CDN_BASE}/${cdnPath}`;

      if (!existsSync(destPath)) {
        downloadTasks.push({ url: imageUrl, destPath, cdnPath });
      }
    }
  }

  console.log(`${downloadTasks.length} images to download (${Object.keys(mapping).length} total mappings)`);

  let succeeded = 0;
  let failed = 0;

  await processInBatches(downloadTasks, CONCURRENCY, async (task) => {
    const ok = await downloadFile(task.url, task.destPath);
    if (ok) succeeded++;
    else failed++;
    return ok;
  });

  console.log(`\nDone: ${succeeded} downloaded, ${failed} failed`);

  const mappingPath = join(ROOT, 'mapping.json');
  writeFileSync(mappingPath, JSON.stringify(mapping, null, 2));
  console.log(`Mapping written to ${mappingPath} (${Object.keys(mapping).length} entries)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
