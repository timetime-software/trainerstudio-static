import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { labelForValue, labelsForValues } from './classification-reference.mjs';

type ExerciseMedia = {
  type?: string;
  url?: string;
  thumbnailUrl?: string;
  source?: string;
  [key: string]: unknown;
};

type SourceExerciseDocument = {
  id: string;
  cdnslug?: string;
  cdnSlug?: string;
  name: string;
  media?: ExerciseMedia[];
  images?: string[];
  metadata?: unknown;
  source?: unknown;
  [key: string]: unknown;
};

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '../..');
const DEFAULT_INPUT_PATH = path.join(SCRIPT_DIR, 'data/exercises.json');
const DEFAULT_OUTPUT_PATH = path.join(SCRIPT_DIR, 'data/exercises-public.json');
const DEFAULT_LIBRARY_ROOT = path.join(REPO_ROOT, 'libraries/tsl26');
const DEFAULT_CDN_BASE_URL = 'https://cdn.trainerstudio.com';
const LIBRARY_PREFIX = 'libraries/tsl26';

function getArgValue(name: string): string | undefined {
  const inline = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (inline) return inline.slice(name.length + 3);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function cdnSlugFor(exercise: SourceExerciseDocument): string | undefined {
  return exercise.cdnslug ?? exercise.cdnSlug;
}

function defaultVideoUrl(cdnBase: string, slug: string): string {
  return `${cdnBase.replace(/\/+$/, '')}/${LIBRARY_PREFIX}/${slug}/default/${slug}.mp4`;
}

function thumbnailUrl(cdnBase: string, slug: string): string {
  return `${cdnBase.replace(/\/+$/, '')}/${LIBRARY_PREFIX}/${slug}/thumbnail.png`;
}

function enumI18nFor(exercise: SourceExerciseDocument): Record<string, unknown> {
  const i18n: Record<string, unknown> = {};

  if (typeof exercise.category === 'string' && exercise.category) {
    i18n.category = {
      en: labelForValue(exercise.category, 'en'),
      es: labelForValue(exercise.category, 'es'),
    };
  }

  if (typeof exercise.equipment === 'string' && exercise.equipment) {
    i18n.equipment = {
      en: labelForValue(exercise.equipment, 'en'),
      es: labelForValue(exercise.equipment, 'es'),
    };
  }

  if (Array.isArray(exercise.primaryMuscles)) {
    i18n.primaryMuscles = {
      en: labelsForValues(exercise.primaryMuscles, 'en'),
      es: labelsForValues(exercise.primaryMuscles, 'es'),
    };
  }

  if (Array.isArray(exercise.secondaryMuscles)) {
    i18n.secondaryMuscles = {
      en: labelsForValues(exercise.secondaryMuscles, 'en'),
      es: labelsForValues(exercise.secondaryMuscles, 'es'),
    };
  }

  return i18n;
}

function buildPublicExercise(
  exercise: SourceExerciseDocument,
  cdnBase: string,
  hasThumbnail: boolean,
): SourceExerciseDocument {
  const slug = cdnSlugFor(exercise)!;
  const videoUrl = defaultVideoUrl(cdnBase, slug);
  const thumbUrl = hasThumbnail ? thumbnailUrl(cdnBase, slug) : undefined;

  const media: ExerciseMedia[] = [
    {
      type: 'video',
      url: videoUrl,
      ...(thumbUrl ? { thumbnailUrl: thumbUrl } : {}),
      source: 'uploaded',
    },
    ...(thumbUrl
      ? [{ type: 'image', url: thumbUrl, source: 'uploaded' } as ExerciseMedia]
      : []),
  ];

  const {
    cdnslug: _cdnslug,
    cdnSlug: _cdnSlug,
    metadata: _metadata,
    source: _source,
    ...rest
  } = exercise;

  const sourceI18n = rest.i18n && typeof rest.i18n === 'object' ? rest.i18n as Record<string, unknown> : {};

  return {
    ...rest,
    i18n: {
      ...sourceI18n,
      ...enumI18nFor(exercise),
    },
    images: thumbUrl ? [thumbUrl] : [],
    media,
  };
}

type BuildReport = {
  total: number;
  withDefault: number;
  withoutDefault: number;
  withoutSlug: number;
  withThumbnail: number;
  withoutThumbnail: number;
};

async function main(): Promise<void> {
  const inputPath = path.resolve(getArgValue('input') ?? DEFAULT_INPUT_PATH);
  const outputPath = path.resolve(getArgValue('output') ?? DEFAULT_OUTPUT_PATH);
  const ndjsonPath = outputPath.replace(/\.json$/i, '.ndjson');
  const libraryRoot = path.resolve(getArgValue('library-root') ?? DEFAULT_LIBRARY_ROOT);
  const cdnBase = getArgValue('cdn-base-url') ?? DEFAULT_CDN_BASE_URL;

  const raw = JSON.parse(await fs.readFile(inputPath, 'utf8')) as SourceExerciseDocument[];
  if (!Array.isArray(raw)) {
    throw new Error('Input JSON must be an array of public exercise documents');
  }

  const report: BuildReport = {
    total: raw.length,
    withDefault: 0,
    withoutDefault: 0,
    withoutSlug: 0,
    withThumbnail: 0,
    withoutThumbnail: 0,
  };

  const publicExercises: SourceExerciseDocument[] = [];

  for (const exercise of raw) {
    const slug = cdnSlugFor(exercise);
    if (!slug) {
      report.withoutSlug += 1;
      continue;
    }

    const defaultMp4 = path.join(libraryRoot, slug, 'default', `${slug}.mp4`);
    if (!(await pathExists(defaultMp4))) {
      report.withoutDefault += 1;
      continue;
    }
    report.withDefault += 1;

    const thumbnailPath = path.join(libraryRoot, slug, 'thumbnail.png');
    const hasThumbnail = await pathExists(thumbnailPath);
    if (hasThumbnail) report.withThumbnail += 1;
    else report.withoutThumbnail += 1;

    publicExercises.push(buildPublicExercise(exercise, cdnBase, hasThumbnail));
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(publicExercises, null, 2)}\n`);
  await fs.writeFile(
    ndjsonPath,
    `${publicExercises.map((exercise) => JSON.stringify(exercise)).join('\n')}\n`,
  );

  console.log(`Input: ${inputPath}`);
  console.log(`Output: ${outputPath}`);
  console.log(`NDJSON: ${ndjsonPath}`);
  console.log(`Library root: ${libraryRoot}`);
  console.log(`CDN: ${cdnBase}`);
  console.log('---');
  console.log(`Total in source: ${report.total}`);
  console.log(`Kept (with default video): ${report.withDefault}`);
  console.log(`Skipped (no default video): ${report.withoutDefault}`);
  if (report.withoutSlug > 0) console.log(`Skipped (no cdnslug): ${report.withoutSlug}`);
  console.log(`Of those kept: thumbnail=${report.withThumbnail}, missing thumbnail=${report.withoutThumbnail}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
