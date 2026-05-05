import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

type I18nShardEntry = {
  index: number;
  id: string;
  name_es?: string;
  instructions_es?: string[];
  category_es?: string;
  equipment_es?: string;
  primaryMuscles_es?: string[];
  secondaryMuscles_es?: string[];
};

type PublicExerciseDocument = {
  id: string;
  name: string;
  category?: string;
  equipment?: string;
  primaryMuscles?: string[];
  secondaryMuscles?: string[];
  instructions?: string[];
  i18n?: {
    name?: Record<string, string>;
    category?: Record<string, string>;
    equipment?: Record<string, string>;
    primaryMuscles?: Record<string, string[]>;
    secondaryMuscles?: Record<string, string[]>;
    instructions?: Record<string, string[]>;
  };
  [key: string]: unknown;
};

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_INPUT_PATH = path.join(SCRIPT_DIR, 'data/exercises.json');
const DEFAULT_SHARDS_DIR = path.join(SCRIPT_DIR, 'source/i18n-shards');

function getArgValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  const exactIndex = process.argv.indexOf(`--${name}`);

  if (exactIndex !== -1) {
    return process.argv[exactIndex + 1];
  }

  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match?.slice(prefix.length);
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await fs.readFile(filePath, 'utf8')) as T;
}

function ensureArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw new Error(`${label} must be an array of strings`);
  }

  return value;
}

function ensureString(value: unknown, label: string): string {
  if (typeof value !== 'string') {
    throw new Error(`${label} must be a string`);
  }

  return value;
}

async function main(): Promise<void> {
  const inputPath = path.resolve(getArgValue('input') ?? process.env.MYPTHUB_I18N_INPUT ?? DEFAULT_INPUT_PATH);
  const outputPath = path.resolve(getArgValue('output') ?? process.env.MYPTHUB_I18N_OUTPUT ?? inputPath);
  const shardsDir = path.resolve(getArgValue('shards-dir') ?? process.env.MYPTHUB_I18N_SHARDS_DIR ?? DEFAULT_SHARDS_DIR);

  const documents = await readJson<PublicExerciseDocument[]>(inputPath);
  if (!Array.isArray(documents)) {
    throw new Error('Input JSON must be an array');
  }

  const shardFiles = (await fs.readdir(shardsDir)).filter((fileName) => /^shard-\d+\.es\.json$/.test(fileName)).sort();
  if (shardFiles.length === 0) {
    throw new Error(`No shard-XX.es.json files found in ${shardsDir}`);
  }

  const byId = new Map(documents.map((document) => [document.id, document]));
  let applied = 0;

  for (const shardFile of shardFiles) {
    const shardPath = path.join(shardsDir, shardFile);
    const entries = await readJson<I18nShardEntry[]>(shardPath);

    if (!Array.isArray(entries)) {
      throw new Error(`${shardPath} must contain an array`);
    }

    for (const entry of entries) {
      const document = byId.get(entry.id);
      if (!document) {
        throw new Error(`${shardPath} contains unknown exercise id ${entry.id}`);
      }

      if (documents[entry.index]?.id !== entry.id) {
        throw new Error(`${shardPath} index/id mismatch at index ${entry.index}: ${entry.id}`);
      }

      document.i18n = document.i18n ?? {};
      document.i18n.name = { ...(document.i18n.name ?? {}), es: ensureString(entry.name_es, `${entry.id}.name_es`) };
      document.i18n.instructions = {
        ...(document.i18n.instructions ?? {}),
        es: ensureArray(entry.instructions_es, `${entry.id}.instructions_es`),
      };
      document.i18n.category = { ...(document.i18n.category ?? {}), es: ensureString(entry.category_es, `${entry.id}.category_es`) };

      if (entry.equipment_es !== undefined && entry.equipment_es !== '') {
        document.i18n.equipment = { ...(document.i18n.equipment ?? {}), es: ensureString(entry.equipment_es, `${entry.id}.equipment_es`) };
      }

      document.i18n.primaryMuscles = {
        ...(document.i18n.primaryMuscles ?? {}),
        es: ensureArray(entry.primaryMuscles_es, `${entry.id}.primaryMuscles_es`),
      };

      if (entry.secondaryMuscles_es !== undefined) {
        document.i18n.secondaryMuscles = {
          ...(document.i18n.secondaryMuscles ?? {}),
          es: ensureArray(entry.secondaryMuscles_es, `${entry.id}.secondaryMuscles_es`),
        };
      }

      applied += 1;
    }
  }

  if (applied !== documents.length) {
    throw new Error(`Applied ${applied} translations, expected ${documents.length}`);
  }

  await fs.writeFile(outputPath, `${JSON.stringify(documents, null, 2)}\n`, 'utf8');
  console.log(`Applied ${applied} Spanish i18n entries to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
