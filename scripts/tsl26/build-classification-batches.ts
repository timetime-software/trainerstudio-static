import * as fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

type SourceExerciseDocument = {
  id: string;
  cdnslug?: string;
  cdnSlug?: string;
  name: string;
  instructions?: string[];
  equipment?: string;
  primaryMuscles?: string[];
  secondaryMuscles?: string[];
  classification?: Record<string, unknown>;
  level?: string;
  i18n?: Record<string, unknown>;
  [key: string]: unknown;
};

type BatchInputItem = {
  id: string;
  name: string;
  instructions: string[];
  legacyEquipmentRaw?: string;
  legacyPrimaryMuscles?: string[];
  legacySecondaryMuscles?: string[];
  currentClassification?: Record<string, unknown>;
  currentLevel?: string;
  defaultVideoUrl: string;
};

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '../..');
const SOURCE_PATH = path.join(SCRIPT_DIR, 'data/exercises.json');
const LIBRARY_ROOT = path.join(REPO_ROOT, 'libraries/tsl26');
const BATCHES_DIR = path.join(SCRIPT_DIR, 'data/classifications');
const CDN_BASE = 'https://cdn.trainerstudio.com';

function getArgValue(name: string): string | undefined {
  const inline = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (inline) return inline.slice(name.length + 3);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function cdnSlugFor(exercise: SourceExerciseDocument): string | undefined {
  return exercise.cdnslug ?? exercise.cdnSlug;
}

async function main(): Promise<void> {
  const batchSize = Number(getArgValue('batch-size') ?? 25);

  const data = JSON.parse(await fs.readFile(SOURCE_PATH, 'utf8')) as SourceExerciseDocument[];
  const withDefault = data.filter((exercise) => {
    const slug = cdnSlugFor(exercise);
    if (!slug) return false;
    return existsSync(path.join(LIBRARY_ROOT, slug, 'default', `${slug}.mp4`));
  });

  withDefault.sort((a, b) => a.id.localeCompare(b.id));

  await fs.mkdir(BATCHES_DIR, { recursive: true });

  const totalBatches = Math.ceil(withDefault.length / batchSize);
  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex += 1) {
    const slice = withDefault.slice(batchIndex * batchSize, (batchIndex + 1) * batchSize);
    const batchItems: BatchInputItem[] = slice.map((exercise) => {
      const slug = cdnSlugFor(exercise)!;
      return {
        id: exercise.id,
        name: exercise.name,
        instructions: exercise.instructions ?? [],
        legacyEquipmentRaw: exercise.equipment,
        legacyPrimaryMuscles: exercise.primaryMuscles ?? [],
        legacySecondaryMuscles: exercise.secondaryMuscles ?? [],
        currentClassification: exercise.classification,
        currentLevel: exercise.level,
        defaultVideoUrl: `${CDN_BASE}/libraries/tsl26/${slug}/default/${slug}.mp4`,
      };
    });

    const batchNumber = String(batchIndex + 1).padStart(2, '0');
    const filePath = path.join(BATCHES_DIR, `batch-${batchNumber}.input.json`);
    await fs.writeFile(filePath, `${JSON.stringify(batchItems, null, 2)}\n`);
  }

  console.log(`Total exercises with default video: ${withDefault.length}`);
  console.log(`Batch size: ${batchSize}`);
  console.log(`Batches written: ${totalBatches}`);
  console.log(`Output dir: ${BATCHES_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
