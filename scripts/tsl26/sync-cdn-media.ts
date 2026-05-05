import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

type ExerciseMedia = {
  type?: string;
  url?: string;
  thumbnailUrl?: string;
  source?: string;
  [key: string]: unknown;
};

type PublicExerciseDocument = {
  id: string;
  cdnslug?: string;
  cdnSlug?: string;
  media?: ExerciseMedia[];
  [key: string]: unknown;
};

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '../..');
const DEFAULT_INPUT_PATH = path.join(SCRIPT_DIR, 'data/exercises.json');
const DEFAULT_NDJSON_PATH = path.join(SCRIPT_DIR, 'data/exercises.ndjson');
const DEFAULT_LIBRARY_ROOT = path.join(REPO_ROOT, 'libraries/tsl26');
const DEFAULT_CDN_BASE_URL = 'https://cdn.trainerstudio.com';

function getArgValue(name: string): string | undefined {
  const inline = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (inline) {
    return inline.slice(name.length + 3);
  }

  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function cdnSlugFor(exercise: PublicExerciseDocument): string | undefined {
  return exercise.cdnslug ?? exercise.cdnSlug;
}

function cdnUrlFor(cdnBaseUrl: string, cdnslug: string): string {
  return `${cdnBaseUrl.replace(/\/+$/, '')}/libraries/tsl26/${cdnslug}/default/${cdnslug}.mp4`;
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function findFinalVideoSlugs(libraryRoot: string): Promise<Set<string>> {
  const slugs = new Set<string>();
  const entries = await fs.readdir(libraryRoot, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === 'references') {
      continue;
    }

    const videoPath = path.join(libraryRoot, entry.name, 'default', `${entry.name}.mp4`);
    if (await pathExists(videoPath)) {
      slugs.add(entry.name);
    }
  }

  return slugs;
}

function syncExerciseMedia(exercise: PublicExerciseDocument, finalVideoSlugs: Set<string>, cdnBaseUrl: string): boolean {
  const cdnslug = cdnSlugFor(exercise);
  if (!cdnslug || !finalVideoSlugs.has(cdnslug)) {
    return false;
  }

  const cdnUrl = cdnUrlFor(cdnBaseUrl, cdnslug);
  const media = Array.isArray(exercise.media) ? exercise.media : [];
  const nextMedia = [
    {
      type: 'video',
      url: cdnUrl,
      source: 'uploaded',
    },
    ...media.filter((item) => item?.url !== cdnUrl),
  ];

  const changed = JSON.stringify(media) !== JSON.stringify(nextMedia);
  if (changed) {
    exercise.media = nextMedia;
  }

  return changed;
}

async function writeJson(inputPath: string, exercises: PublicExerciseDocument[], dryRun: boolean): Promise<void> {
  if (dryRun) {
    return;
  }

  await fs.writeFile(inputPath, `${JSON.stringify(exercises, null, 2)}\n`);
}

async function writeNdjson(ndjsonPath: string, exercises: PublicExerciseDocument[], dryRun: boolean): Promise<void> {
  if (dryRun || !(await pathExists(ndjsonPath))) {
    return;
  }

  await fs.writeFile(ndjsonPath, `${exercises.map((exercise) => JSON.stringify(exercise)).join('\n')}\n`);
}

async function main(): Promise<void> {
  const inputPath = path.resolve(getArgValue('input') ?? process.env.TSL26_SYNC_INPUT ?? DEFAULT_INPUT_PATH);
  const ndjsonPath = path.resolve(getArgValue('ndjson') ?? process.env.TSL26_SYNC_NDJSON ?? DEFAULT_NDJSON_PATH);
  const libraryRoot = path.resolve(getArgValue('library-root') ?? process.env.TSL26_LIBRARY_ROOT ?? DEFAULT_LIBRARY_ROOT);
  const cdnBaseUrl = getArgValue('cdn-base-url') ?? process.env.TSL26_CDN_BASE_URL ?? DEFAULT_CDN_BASE_URL;
  const dryRun = hasFlag('dry-run') || process.env.DRY_RUN === 'true' || process.env.DRY_RUN === '1';

  const parsed = JSON.parse(await fs.readFile(inputPath, 'utf8'));
  if (!Array.isArray(parsed)) {
    throw new Error('Input JSON must be an array of public exercise documents');
  }

  const finalVideoSlugs = await findFinalVideoSlugs(libraryRoot);
  const changed = parsed.filter((exercise) => syncExerciseMedia(exercise, finalVideoSlugs, cdnBaseUrl));

  await writeJson(inputPath, parsed, dryRun);
  await writeNdjson(ndjsonPath, parsed, dryRun);

  console.log(`Final CDN videos found: ${finalVideoSlugs.size}`);
  console.log(`${dryRun ? '[DRY RUN] Would update' : 'Updated'} exercises: ${changed.length}`);
  for (const exercise of changed.slice(0, 20)) {
    const cdnslug = cdnSlugFor(exercise);
    console.log(`- ${exercise.id} ${cdnslug}: ${cdnUrlFor(cdnBaseUrl, cdnslug ?? '')}`);
  }
  if (changed.length > 20) {
    console.log(`... ${changed.length - 20} more`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
