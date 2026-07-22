import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { identityKeyForSlug, idForIdentityKey } from './exercise-ids.mjs';

type TrainerizeTag = { type: string; name: string };

type TrainerizeMediaVariant = {
  videoToken?: string;
  loopVideoToken?: string;
  videoUrls?: Record<string, string | null>;
  loopVideoUrls?: Record<string, string | null>;
  thumbnailUrls?: Record<string, string | null>;
};

type TrainerizeMedia = {
  type?: string;
  token?: string;
  loopVideoToken?: string;
  videoUrl?: Record<string, string | null>;
  loopVideoUrl?: Record<string, string | null>;
  thumbnailUrl?: Record<string, string | null>;
  audioUrl?: string | null;
  default?: TrainerizeMediaVariant | null;
  female?: TrainerizeMediaVariant | null;
};

type TrainerizeExercise = {
  id: number;
  name: string;
  alternateName?: string;
  description?: string;
  type?: string;
  recordType?: string;
  media?: TrainerizeMedia;
  videoType?: string;
  videoUrl?: string;
  videoMobileUrl?: Record<string, string | null>;
  videoStatus?: string;
  numPhotos?: number;
  tags?: TrainerizeTag[];
  version?: string;
};

type ExerciseDocument = Record<string, unknown> & {
  id: string;
  cdnslug: string;
  name: string;
  metadata?: Record<string, unknown>;
};

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ENDPOINT = 'https://api.trainerize.com/v03/exercise/search';
const DEFAULT_DATA_PATH = path.join(SCRIPT_DIR, 'data/exercises.ndjson');
const DEFAULT_REPORT_PATH = path.join(SCRIPT_DIR, '.workspace/import/trainerize-import.report.json');
const PAGE_SIZE = 100;

const MUSCLE_MAP: Record<string, string[]> = {
  abductors: ['abductors'],
  abs: ['abs'],
  adductors: ['adductors'],
  bicep: ['biceps'],
  calves: ['calves'],
  chestInner: ['chest'],
  chestLower: ['lower_chest'],
  chestMid: ['chest'],
  chestUpper: ['upper_chest'],
  forearms: ['forearm_flexors', 'forearm_extensors'],
  glutes: ['glutes'],
  hamstrings: ['hamstrings'],
  hipFlexors: ['hip_flexors'],
  lats: ['lats'],
  lowerBack: ['lower_back'],
  middleBack: ['rhomboids', 'mid_traps'],
  neck: ['neck'],
  obliques: ['obliques'],
  quads: ['quadriceps'],
  shoulderFront: ['front_delts'],
  shoulderRear: ['rear_delts'],
  shoulderSide: ['side_delts'],
  traps: ['traps'],
  triceps: ['triceps'],
};

const EQUIPMENT_MAP: Record<string, string[]> = {
  balanceBoard: ['other'],
  bands: ['resistance_band'],
  barbell: ['barbell'],
  battlingRope: ['battle_ropes'],
  bench: ['bench'],
  bodyWeight: ['bodyweight'],
  bosu: ['bosu'],
  bosuBall: ['bosu'],
  box: ['box'],
  cable: ['cable'],
  dumbbell: ['dumbbell'],
  ezBar: ['ez_bar'],
  foamRoller: ['foam_roller'],
  exerciseBall: ['stability_ball'],
  kettlebells: ['kettlebell'],
  jumpRope: ['rope'],
  lacrosseBall: ['other'],
  landmine: ['landmine'],
  machine: ['machine'],
  mat: ['other'],
  medicineBall: ['medicine_ball'],
  miniband: ['resistance_band'],
  plate: ['other'],
  pullUpBar: ['pull_up_bar'],
  rings: ['rings'],
  rope: ['rope'],
  ropes: ['battle_ropes'],
  sandBag: ['other'],
  sled: ['sled'],
  sliders: ['other'],
  smithMachine: ['smith_machine'],
  stabilityBall: ['stability_ball'],
  step: ['box'],
  suspension: ['suspension'],
  superband: ['resistance_band'],
  swissBall: ['stability_ball'],
  treadmill: ['treadmill'],
  weightPlate: ['other'],
};

function getArgValue(name: string): string | undefined {
  const inline = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (inline) return inline.slice(name.length + 3);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function slugify(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_') || 'exercise';
}

function tagsOf(exercise: TrainerizeExercise, type: string): string[] {
  return unique((exercise.tags ?? []).filter((tag) => tag.type === type).map((tag) => tag.name));
}

function mapValues(values: string[], mapping: Record<string, string[]>, unmapped: Set<string>): string[] {
  return unique(values.flatMap((value) => {
    const mapped = mapping[value];
    if (!mapped) unmapped.add(value);
    return mapped ?? [];
  }));
}

function movementPatterns(exercise: TrainerizeExercise): string[] {
  const tags = tagsOf(exercise, 'movement');
  const mapped = unique(tags.flatMap((tag) => ({
    antiExtensionCore: ['anti_rotation'],
    antiRotationCore: ['anti_rotation'],
    hipDominant: ['hinge'],
    horizontalPull: ['horizontal_pull'],
    horizontalPush: ['horizontal_push'],
    kneeDominant: ['squat'],
    verticalPull: ['vertical_pull'],
    verticalPush: ['vertical_push'],
  } satisfies Record<string, string[]>)[tag] ?? []));

  if (mapped.length > 0) return mapped;
  const name = exercise.name.toLowerCase();
  if (/\b(lunge|split squat)\b/.test(name)) return ['lunge'];
  if (/\b(squat|leg press|step[ -]?up)\b/.test(name)) return ['squat'];
  if (/\b(deadlift|hinge|hip thrust|bridge|good morning)\b/.test(name)) return ['hinge'];
  if (/\b(carry|walk)\b/.test(name)) return ['carry'];
  if (/\b(rotation|twist)\b/.test(name)) return ['rotation'];
  return ['isolation'];
}

function laterality(exercise: TrainerizeExercise): string[] {
  const movements = new Set(tagsOf(exercise, 'movement'));
  if (movements.has('alternating')) return ['alternating'];
  if (movements.has('uniLateral') || movements.has('contraLateral')) return ['unilateral'];
  if (movements.has('biLateral')) return ['bilateral'];
  const name = exercise.name.toLowerCase();
  if (/\b(alternating|alternate)\b/.test(name)) return ['alternating'];
  if (/\b(single|one[ -](arm|leg)|unilateral)\b/.test(name)) return ['unilateral'];
  return ['bilateral'];
}

function forceTypes(exercise: TrainerizeExercise, patterns: string[]): string[] {
  const mapped = unique(tagsOf(exercise, 'force').map((tag) => ({ push: 'push', pull: 'pull', static: 'isometric' })[tag] ?? ''));
  if (mapped.length > 0) return mapped;
  if (patterns.some((value) => value.includes('pull') || value === 'hinge')) return ['pull'];
  if (patterns.some((value) => value.includes('push') || value === 'squat' || value === 'lunge')) return ['push'];
  return ['mixed'];
}

function category(exercise: TrainerizeExercise): string {
  const recordType = exercise.recordType?.toLowerCase() ?? '';
  const movements = new Set(tagsOf(exercise, 'movement'));
  if (recordType.includes('cardio')) return 'cardio';
  if (recordType.includes('stretch') || movements.has('staticStretches')) return 'stretching';
  if (movements.has('explosive')) return 'plyometrics';
  return 'strength';
}

function firstUrl(...groups: Array<Record<string, string | null> | undefined>): string | undefined {
  const preferredKeys = ['fhd', 'hd', 'sd', 'hls', 'hlshd', 'hlssd', 'mobile'];
  for (const group of groups) {
    for (const key of preferredKeys) {
      const value = group?.[key];
      if (value) return value;
    }
  }
  return undefined;
}

function mediaItemsForVariant(
  variantName: 'default' | 'female',
  variant: TrainerizeMediaVariant | null | undefined,
  fallback?: { video?: string; thumbnail?: string },
): Array<Record<string, unknown>> {
  if (!variant && !fallback?.video && !fallback?.thumbnail) return [];
  const video = firstUrl(variant?.loopVideoUrls, variant?.videoUrls) ?? fallback?.video;
  const thumbnail = firstUrl(variant?.thumbnailUrls) ?? fallback?.thumbnail;
  const providerMetadata = {
    provider: 'trainerize',
    providerVariant: variantName,
    presenterGender: variantName === 'female' ? 'female' : 'male',
  };
  return [
    ...(video ? [{ type: 'video', url: video, ...(thumbnail ? { thumbnailUrl: thumbnail } : {}), source: 'external', ...providerMetadata }] : []),
    ...(thumbnail ? [{ type: 'image', url: thumbnail, source: 'external', ...providerMetadata }] : []),
  ];
}

function mediaFor(exercise: TrainerizeExercise): Array<Record<string, unknown>> {
  const fallback = {
    video: firstUrl(exercise.media?.loopVideoUrl, exercise.media?.videoUrl, exercise.videoMobileUrl)
      ?? (exercise.videoUrl || undefined),
    thumbnail: firstUrl(exercise.media?.thumbnailUrl),
  };
  return [
    ...mediaItemsForVariant('default', exercise.media?.default, fallback),
    ...mediaItemsForVariant('female', exercise.media?.female),
  ];
}

function instructionsFor(description: string | undefined): string[] {
  return (description ?? '').split(/\n+/).map((line) => line.trim()).filter(Boolean);
}

function sourceIdOf(document: ExerciseDocument): string | undefined {
  const source = document.metadata?.source;
  if (!source || typeof source !== 'object') return undefined;
  const value = (source as Record<string, unknown>).exerciseId;
  return value === undefined ? undefined : String(value);
}

function uniqueSlug(base: string, trainerizeId: number, used: Set<string>): string {
  if (!used.has(base)) return base;
  const candidate = `${base}_trainerize_${trainerizeId}`;
  if (!used.has(candidate)) return candidate;
  let index = 2;
  while (used.has(`${candidate}_${index}`)) index += 1;
  return `${candidate}_${index}`;
}

function transform(
  exercise: TrainerizeExercise,
  cdnslug: string,
  unmappedMuscles: Set<string>,
  unmappedEquipment: Set<string>,
): ExerciseDocument {
  const primaryMuscles = mapValues(tagsOf(exercise, 'mainMuscle'), MUSCLE_MAP, unmappedMuscles);
  const equipment = mapValues(tagsOf(exercise, 'equipment'), EQUIPMENT_MAP, unmappedEquipment);
  const normalizedEquipment = equipment.length > 0 ? equipment : ['other'];
  const patterns = movementPatterns(exercise);
  const forces = forceTypes(exercise, patterns);
  const mechanics = unique(tagsOf(exercise, 'mechanics').map((value) => value === 'compound' ? 'compound' : value === 'isolation' ? 'isolation' : ''));
  const normalizedMechanics = mechanics.length > 0 ? mechanics : [patterns.some((value) => value !== 'isolation') ? 'compound' : 'isolation'];
  const levelTag = tagsOf(exercise, 'level')[0];
  const level = levelTag === 'advanced' ? 'expert' : ['beginner', 'intermediate'].includes(levelTag) ? levelTag : 'beginner';
  const instructions = instructionsFor(exercise.description);
  const media = mediaFor(exercise);
  const images = media.filter((item) => item.type === 'image').map((item) => String(item.url));
  const aliases = unique([exercise.name, exercise.alternateName ?? '']);
  const identityKey = identityKeyForSlug(cdnslug) as string;

  return {
    priority: false,
    id: idForIdentityKey(identityKey),
    cdnslug,
    name: exercise.name.trim(),
    force: forces[0],
    level,
    mechanic: normalizedMechanics[0],
    equipment: normalizedEquipment.find((value) => value !== 'bodyweight') ?? normalizedEquipment[0],
    primaryMuscles,
    secondaryMuscles: [],
    instructions,
    category: category(exercise),
    images,
    isActive: exercise.videoStatus !== 'deleted',
    i18n: {
      name: { en: exercise.name.trim() },
      instructions: { en: instructions },
    },
    classification: {
      primaryMuscles,
      secondaryMuscles: [],
      movementPattern: patterns,
      forceType: forces,
      mechanic: normalizedMechanics,
      laterality: laterality(exercise),
      equipment: normalizedEquipment,
    },
    media,
    aliases,
    metadata: {
      identityKey,
      source: {
        provider: 'trainerize',
        exerciseId: exercise.id,
        endpoint: ENDPOINT,
        version: exercise.version ?? null,
        exerciseType: exercise.type ?? null,
        recordType: exercise.recordType ?? null,
        originalTags: exercise.tags ?? [],
        mediaToken: exercise.media?.token || null,
        loopVideoToken: exercise.media?.loopVideoToken || null,
        mediaVariants: {
          default: exercise.media?.default ?? null,
          female: exercise.media?.female ?? null,
        },
      },
    },
  };
}

async function fetchPage(token: string, start: number): Promise<{ exercises: TrainerizeExercise[]; total: number }> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          phrase: '',
          start,
          count: PAGE_SIZE,
          filters: { equipment: [], level: [], mainMuscle: [], mechanics: [], movement: [], source: [] },
          sortby: 'name',
        }),
      });
      if (!response.ok) throw new Error(`Trainerize returned HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
      return await response.json() as { exercises: TrainerizeExercise[]; total: number };
    } catch (error) {
      lastError = error;
      if (attempt < 4) await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
  throw lastError;
}

async function fetchAll(token: string): Promise<TrainerizeExercise[]> {
  const all: TrainerizeExercise[] = [];
  let total = Number.POSITIVE_INFINITY;
  for (let start = 0; start < total; start += PAGE_SIZE) {
    const page = await fetchPage(token, start);
    total = page.total;
    all.push(...page.exercises);
    console.log(`Trainerize: ${Math.min(all.length, total)}/${total}`);
    if (page.exercises.length === 0) break;
  }
  const byId = new Map(all.map((exercise) => [String(exercise.id), exercise]));
  if (byId.size !== total) throw new Error(`Expected ${total} unique Trainerize exercises, received ${byId.size}`);
  return [...byId.values()];
}

async function readNdjson(filePath: string): Promise<ExerciseDocument[]> {
  const raw = (await fs.readFile(filePath, 'utf8')).trim();
  if (!raw) return [];
  return raw.split('\n').filter(Boolean).map((line) => JSON.parse(line) as ExerciseDocument);
}

async function main(): Promise<void> {
  const token = process.env.TRAINERIZE_TOKEN;
  if (!token) throw new Error('Set TRAINERIZE_TOKEN in the environment. The token is never written to disk.');
  const dataPath = path.resolve(getArgValue('data') ?? DEFAULT_DATA_PATH);
  const reportPath = path.resolve(getArgValue('report') ?? DEFAULT_REPORT_PATH);
  const dryRun = hasFlag('dry-run');
  const existing = await readNdjson(dataPath);
  const scraped = await fetchAll(token);
  const usedSlugs = new Set(existing.map((document) => document.cdnslug));
  const existingBySourceId = new Map(existing.filter((document) => sourceIdOf(document)).map((document) => [sourceIdOf(document) as string, document]));
  const unmappedMuscles = new Set<string>();
  const unmappedEquipment = new Set<string>();
  let added = 0;
  let updated = 0;

  for (const exercise of scraped) {
    if (!exercise.id || !exercise.name?.trim()) throw new Error(`Malformed Trainerize exercise: ${JSON.stringify(exercise).slice(0, 300)}`);
    const current = existingBySourceId.get(String(exercise.id));
    const cdnslug = current?.cdnslug ?? uniqueSlug(slugify(exercise.name), exercise.id, usedSlugs);
    const document = transform(exercise, cdnslug, unmappedMuscles, unmappedEquipment);
    usedSlugs.add(cdnslug);
    if (current) {
      const index = existing.indexOf(current);
      existing[index] = document;
      updated += 1;
    } else {
      existing.push(document);
      added += 1;
    }
  }

  const duplicateIds = existing.map((item) => item.id).filter((id, index, ids) => ids.indexOf(id) !== index);
  const duplicateSlugs = existing.map((item) => item.cdnslug).filter((slug, index, slugs) => slugs.indexOf(slug) !== index);
  if (duplicateIds.length || duplicateSlugs.length) throw new Error(`Merge produced duplicate ids/slugs: ids=${duplicateIds.length}, slugs=${duplicateSlugs.length}`);

  const report = {
    endpoint: ENDPOINT,
    scraped: scraped.length,
    existingBefore: existing.length - added,
    added,
    updated,
    totalAfter: existing.length,
    withVideo: scraped.filter((exercise) => mediaFor(exercise).some((item) => item.type === 'video')).length,
    withThumbnail: scraped.filter((exercise) => mediaFor(exercise).some((item) => item.type === 'image')).length,
    unmappedMuscles: [...unmappedMuscles].sort(),
    unmappedEquipment: [...unmappedEquipment].sort(),
    dryRun,
  };

  if (!dryRun) {
    await fs.mkdir(path.dirname(dataPath), { recursive: true });
    await fs.writeFile(dataPath, `${existing.map((document) => JSON.stringify(document)).join('\n')}\n`, 'utf8');
  }
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
