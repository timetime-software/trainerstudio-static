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
const DEFAULT_INPUT_PATH = path.join(SCRIPT_DIR, 'data/exercises.ndjson');
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

type LocalVideoSlugs = {
  defaultSlugs: Set<string>;
  sourceSlugs: Set<string>;
};

function cdnUrlFor(cdnBaseUrl: string, cdnslug: string, variant: 'default' | 'source'): string {
  return `${cdnBaseUrl.replace(/\/+$/, '')}/libraries/tsl26/${cdnslug}/${variant}/${cdnslug}.mp4`;
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function findLocalVideoSlugs(libraryRoot: string): Promise<LocalVideoSlugs> {
  const defaultSlugs = new Set<string>();
  const sourceSlugs = new Set<string>();
  const entries = await fs.readdir(libraryRoot, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === 'references') {
      continue;
    }

    const defaultPath = path.join(libraryRoot, entry.name, 'default', `${entry.name}.mp4`);
    const sourcePath = path.join(libraryRoot, entry.name, 'source', `${entry.name}.mp4`);
    if (await pathExists(defaultPath)) defaultSlugs.add(entry.name);
    if (await pathExists(sourcePath)) sourceSlugs.add(entry.name);
  }

  return { defaultSlugs, sourceSlugs };
}

function syncExerciseMedia(exercise: PublicExerciseDocument, localVideoSlugs: LocalVideoSlugs, cdnBaseUrl: string): boolean {
  const cdnslug = cdnSlugFor(exercise);
  if (!cdnslug) {
    return false;
  }

  const linkedMedia: ExerciseMedia[] = [];
  if (localVideoSlugs.defaultSlugs.has(cdnslug)) {
    linkedMedia.push({
      type: 'video',
      url: cdnUrlFor(cdnBaseUrl, cdnslug, 'default'),
      source: 'uploaded',
    });
  }
  if (localVideoSlugs.sourceSlugs.has(cdnslug)) {
    linkedMedia.push({
      type: 'video',
      url: cdnUrlFor(cdnBaseUrl, cdnslug, 'source'),
      source: 'source',
    });
  }
  if (linkedMedia.length === 0) {
    return false;
  }

  const media = Array.isArray(exercise.media) ? exercise.media : [];
  const nextMedia = [
    ...linkedMedia,
    ...media.filter((item) => !linkedMedia.some((linked) => linked.url === item?.url)),
  ];

  const changed = JSON.stringify(media) !== JSON.stringify(nextMedia);
  if (changed) {
    exercise.media = nextMedia;
  }

  return changed;
}

async function readExercises(inputPath: string): Promise<PublicExerciseDocument[]> {
  const raw = (await fs.readFile(inputPath, 'utf8')).trim();
  if (!raw) return [];
  return raw.startsWith('[')
    ? JSON.parse(raw) as PublicExerciseDocument[]
    : raw.split('\n').filter(Boolean).map((line) => JSON.parse(line.replace(/,\s*$/, '')) as PublicExerciseDocument);
}

async function writeExercises(inputPath: string, exercises: PublicExerciseDocument[], dryRun: boolean): Promise<void> {
  if (dryRun) return;
  await fs.writeFile(inputPath, `${exercises.map((exercise) => JSON.stringify(exercise)).join('\n')}\n`);
}

async function main(): Promise<void> {
  const inputPath = path.resolve(getArgValue('input') ?? process.env.TSL26_SYNC_INPUT ?? DEFAULT_INPUT_PATH);
  const libraryRoot = path.resolve(getArgValue('library-root') ?? process.env.TSL26_LIBRARY_ROOT ?? DEFAULT_LIBRARY_ROOT);
  const cdnBaseUrl = getArgValue('cdn-base-url') ?? process.env.TSL26_CDN_BASE_URL ?? DEFAULT_CDN_BASE_URL;
  const dryRun = hasFlag('dry-run') || process.env.DRY_RUN === 'true' || process.env.DRY_RUN === '1';

  const parsed = await readExercises(inputPath);
  if (!Array.isArray(parsed)) {
    throw new Error('Input must contain public exercise documents');
  }

  const localVideoSlugs = await findLocalVideoSlugs(libraryRoot);
  const changed = parsed.filter((exercise) => syncExerciseMedia(exercise, localVideoSlugs, cdnBaseUrl));

  await writeExercises(inputPath, parsed, dryRun);

  console.log(`Default CDN videos found: ${localVideoSlugs.defaultSlugs.size}`);
  console.log(`Source CDN videos found: ${localVideoSlugs.sourceSlugs.size}`);
  console.log(`${dryRun ? '[DRY RUN] Would update' : 'Updated'} exercises: ${changed.length}`);
  for (const exercise of changed.slice(0, 20)) {
    const cdnslug = cdnSlugFor(exercise);
    console.log(`- ${exercise.id} ${cdnslug}`);
  }
  if (changed.length > 20) {
    console.log(`... ${changed.length - 20} more`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
