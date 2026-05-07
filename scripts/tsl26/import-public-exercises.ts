import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoClient, ObjectId } from 'mongodb';

type PublicExerciseDocument = {
  id: string;
  name: string;
  libraryId?: unknown;
  createdAt?: Date;
  updatedAt?: Date;
  [key: string]: unknown;
};

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_INPUT_PATH = path.join(SCRIPT_DIR, 'data/exercises.json');
const DEFAULT_MONGODB_URI = 'mongodb://localhost:27017/trainerStudioDB';
const DEFAULT_DATABASE_NAME = 'trainerStudioDB';
const DEFAULT_BATCH_SIZE = 500;

function getArgValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  const exactIndex = process.argv.indexOf(`--${name}`);

  if (exactIndex !== -1) {
    return process.argv[exactIndex + 1];
  }

  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match?.slice(prefix.length);
}

function getBooleanOption(name: string, envName: string): boolean {
  const exactIndex = process.argv.indexOf(`--${name}`);
  const nextArg = exactIndex !== -1 ? process.argv[exactIndex + 1] : undefined;
  const argValue = exactIndex !== -1 && nextArg && !nextArg.startsWith('--') ? nextArg : getArgValue(name);
  const value = argValue ?? process.env[envName];
  return exactIndex !== -1 && (!nextArg || nextArg.startsWith('--')) ? true : value === 'true' || value === '1';
}

function getRequiredObjectId(value: string | undefined, label: string): ObjectId {
  if (!value || !ObjectId.isValid(value)) {
    throw new Error(`${label} must be a valid Mongo ObjectId`);
  }

  return new ObjectId(value);
}

async function readExercises(inputPath: string): Promise<PublicExerciseDocument[]> {
  const content = await fs.readFile(inputPath, 'utf8');
  const parsed = JSON.parse(content);

  if (!Array.isArray(parsed)) {
    throw new Error('Input JSON must be an array of public exercise documents');
  }

  return parsed;
}

function normalizeExercise(exercise: PublicExerciseDocument, libraryId: ObjectId, now: Date): PublicExerciseDocument {
  if (!exercise.id || typeof exercise.id !== 'string') {
    throw new Error(`Exercise is missing a string id: ${JSON.stringify(exercise).slice(0, 300)}`);
  }

  if (!exercise.name || typeof exercise.name !== 'string') {
    throw new Error(`Exercise ${exercise.id} is missing a string name`);
  }

  return {
    ...exercise,
    libraryId,
    updatedAt: now,
    createdAt: exercise.createdAt ?? now,
  };
}

async function main(): Promise<void> {
  const inputPath = path.resolve(getArgValue('input') ?? process.env.MYPTHUB_IMPORT_INPUT ?? DEFAULT_INPUT_PATH);
  const libraryId = getRequiredObjectId(getArgValue('library-id') ?? process.env.MYPTHUB_IMPORT_LIBRARY_ID, 'libraryId');
  const mongodbUri = getArgValue('mongodb-uri') ?? process.env.MONGODB_URI ?? DEFAULT_MONGODB_URI;
  const databaseName = getArgValue('database') ?? process.env.MONGODB_DB_NAME ?? DEFAULT_DATABASE_NAME;
  const batchSize = Number(getArgValue('batch-size') ?? process.env.MYPTHUB_IMPORT_BATCH_SIZE ?? DEFAULT_BATCH_SIZE);
  const dryRun = getBooleanOption('dry-run', 'DRY_RUN');

  const client = new MongoClient(mongodbUri);

  try {
    await client.connect();
    const db = client.db(databaseName);

    const library = await db.collection('libraries').findOne({ _id: libraryId });
    if (!library) {
      throw new Error(`Library not found in ${databaseName}.libraries: ${libraryId.toHexString()}`);
    }

    const rawExercises = await readExercises(inputPath);
    const now = new Date();
    const exercises = rawExercises.map((exercise) => normalizeExercise(exercise, libraryId, now));

    const duplicateIds = exercises
      .map((exercise) => exercise.id)
      .filter((id, index, ids) => ids.indexOf(id) !== index);

    if (duplicateIds.length > 0) {
      throw new Error(`Input contains duplicate exercise ids: ${[...new Set(duplicateIds)].slice(0, 10).join(', ')}`);
    }

    console.log(`Input: ${inputPath}`);
    console.log(`MongoDB: ${mongodbUri}`);
    console.log(`Database: ${databaseName}`);
    console.log(`Library: ${library.name ?? libraryId.toHexString()} (${libraryId.toHexString()})`);
    console.log(`Exercises: ${exercises.length}`);

    if (dryRun) {
      const existing = await db.collection('publicExercises').countDocuments({ id: { $in: exercises.map((exercise) => exercise.id) } });
      console.log(`[DRY RUN] Would upsert ${exercises.length} exercises (${existing} already exist by id).`);
      return;
    }

    let upserted = 0;
    let matched = 0;
    let modified = 0;

    for (let index = 0; index < exercises.length; index += batchSize) {
      const batch = exercises.slice(index, index + batchSize);
      const result = await db.collection('publicExercises').bulkWrite(
        batch.map((exercise) => {
          const { createdAt, ...exerciseUpdate } = exercise;

          return {
            updateOne: {
              filter: { id: exercise.id },
              update: { $set: exerciseUpdate, $setOnInsert: { createdAt: createdAt ?? now } },
              upsert: true,
            },
          };
        }),
        { ordered: false },
      );

      upserted += result.upsertedCount;
      matched += result.matchedCount;
      modified += result.modifiedCount;
      console.log(`Processed ${Math.min(index + batch.length, exercises.length)}/${exercises.length}`);
    }

    const inLibrary = await db.collection('publicExercises').countDocuments({ libraryId });
    console.log(`Imported. upserted=${upserted}, matched=${matched}, modified=${modified}, totalInLibrary=${inLibrary}`);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
