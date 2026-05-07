import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findExerciseByIdentifier } from './exercise-ids.mjs';

type ClassificationOutputItem = {
  id: string;
  level?: 'beginner' | 'intermediate' | 'expert';
  classification: {
    primaryMuscles: string[];
    secondaryMuscles?: string[];
    movementPattern: string[];
    forceType: string[];
    mechanic: string[];
    laterality?: string[];
    equipment: string[];
  };
  legacy?: {
    force?: string;
    mechanic?: string;
    equipment?: string;
    primaryMuscles?: string[];
    secondaryMuscles?: string[];
  };
  _notes?: string;
};

type SourceExerciseDocument = {
  id: string;
  name: string;
  force?: string;
  level?: string;
  mechanic?: string;
  equipment?: string;
  primaryMuscles?: string[];
  secondaryMuscles?: string[];
  classification?: Record<string, unknown>;
  i18n?: Record<string, any>;
  [key: string]: unknown;
};

const VALID_DETAILED_MUSCLES = new Set([
  'chest','upper_chest','lower_chest','lats','traps','upper_traps','mid_traps','lower_traps','rhomboids','lower_back','teres',
  'shoulders','front_delts','side_delts','rear_delts','rotator_cuff',
  'biceps','biceps_long_head','biceps_short_head','brachialis','triceps','triceps_long_head','triceps_lateral_head','triceps_medial_head',
  'forearm_flexors','forearm_extensors','grip',
  'abs','upper_abs','lower_abs','obliques','transverse','serratus',
  'glutes','glute_med','glute_min','hip_flexors','adductors','abductors',
  'quadriceps','vastus_lateralis','vastus_medialis','rectus_femoris',
  'hamstrings','biceps_femoris','semitendinosus','semimembranosus',
  'calves','gastrocnemius','soleus','tibialis','peroneals',
  'neck','neck_flexors','neck_extensors',
]);

const VALID_MOVEMENT_PATTERNS = new Set([
  'horizontal_push','horizontal_pull','vertical_push','vertical_pull',
  'squat','hinge','lunge','carry','rotation','anti_rotation','isolation',
]);

const VALID_FORCE_TYPES = new Set(['push','pull','isometric','mixed']);
const VALID_MECHANICS = new Set(['compound','isolation']);
const VALID_LATERALITIES = new Set(['bilateral','unilateral','alternating']);
const VALID_LEVELS = new Set(['beginner','intermediate','expert']);
const VALID_EQUIPMENT = new Set([
  'bodyweight','barbell','dumbbell','kettlebell','cable','machine','smith_machine','resistance_band',
  'medicine_ball','slam_ball','suspension','rings','box','pull_up_bar','bench','foam_roller',
  'stability_ball','bosu','landmine','trap_bar','ez_bar','rope','battle_ropes','sled',
  'rowing_machine','bike','treadmill','elliptical','other',
]);

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_PATH = path.join(SCRIPT_DIR, 'data/exercises.json');
const NDJSON_PATH = path.join(SCRIPT_DIR, 'data/exercises.ndjson');
const BATCHES_DIR = path.join(SCRIPT_DIR, 'data/classifications');

function validateEnum(values: string[], valid: Set<string>, label: string, errors: string[], id: string): void {
  for (const value of values) {
    if (!valid.has(value)) errors.push(`${id}.${label}: invalid value '${value}'`);
  }
}

function validateItem(item: ClassificationOutputItem): string[] {
  const errors: string[] = [];
  if (!item.id) errors.push('missing id');
  const c = item.classification;
  if (!c) {
    errors.push(`${item.id}: missing classification`);
    return errors;
  }
  validateEnum(c.primaryMuscles ?? [], VALID_DETAILED_MUSCLES, 'classification.primaryMuscles', errors, item.id);
  validateEnum(c.secondaryMuscles ?? [], VALID_DETAILED_MUSCLES, 'classification.secondaryMuscles', errors, item.id);
  validateEnum(c.movementPattern ?? [], VALID_MOVEMENT_PATTERNS, 'classification.movementPattern', errors, item.id);
  validateEnum(c.forceType ?? [], VALID_FORCE_TYPES, 'classification.forceType', errors, item.id);
  validateEnum(c.mechanic ?? [], VALID_MECHANICS, 'classification.mechanic', errors, item.id);
  validateEnum(c.laterality ?? [], VALID_LATERALITIES, 'classification.laterality', errors, item.id);
  validateEnum(c.equipment ?? [], VALID_EQUIPMENT, 'classification.equipment', errors, item.id);
  if (item.level && !VALID_LEVELS.has(item.level)) errors.push(`${item.id}: invalid level '${item.level}'`);
  if (!c.primaryMuscles?.length) errors.push(`${item.id}: primaryMuscles must be non-empty`);
  if (!c.movementPattern?.length) errors.push(`${item.id}: movementPattern must be non-empty`);
  if (!c.forceType?.length) errors.push(`${item.id}: forceType must be non-empty`);
  if (!c.mechanic?.length) errors.push(`${item.id}: mechanic must be non-empty`);
  if (!c.equipment?.length) errors.push(`${item.id}: equipment must be non-empty`);
  return errors;
}

function applyToExercise(exercise: SourceExerciseDocument, item: ClassificationOutputItem): void {
  const equipment = item.classification.equipment;
  const primaryEquipment = equipment.find((value) => value !== 'bodyweight') ?? equipment[0] ?? '';

  exercise.classification = {
    primaryMuscles: item.classification.primaryMuscles,
    secondaryMuscles: item.classification.secondaryMuscles ?? [],
    movementPattern: item.classification.movementPattern,
    forceType: item.classification.forceType,
    mechanic: item.classification.mechanic,
    laterality: item.classification.laterality ?? ['bilateral'],
    equipment,
  };

  if (item.level) exercise.level = item.level;

  exercise.force = item.classification.forceType[0] ?? '';
  exercise.mechanic = item.classification.mechanic[0] ?? '';
  exercise.equipment = primaryEquipment;
  exercise.primaryMuscles = item.classification.primaryMuscles;
  exercise.secondaryMuscles = item.classification.secondaryMuscles ?? [];
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');

  const entries = await fs.readdir(BATCHES_DIR);
  const outputFiles = entries.filter((entry) => /^batch-\d+\.output\.json$/.test(entry)).sort();

  if (outputFiles.length === 0) {
    throw new Error(`No batch output files found in ${BATCHES_DIR}`);
  }

  const allItems: ClassificationOutputItem[] = [];
  const allErrors: string[] = [];

  for (const file of outputFiles) {
    const filePath = path.join(BATCHES_DIR, file);
    const items = JSON.parse(await fs.readFile(filePath, 'utf8')) as ClassificationOutputItem[];
    if (!Array.isArray(items)) {
      throw new Error(`${file}: must be a JSON array`);
    }
    for (const item of items) {
      const errors = validateItem(item);
      if (errors.length > 0) {
        allErrors.push(...errors.map((error) => `[${file}] ${error}`));
      } else {
        allItems.push(item);
      }
    }
  }

  if (allErrors.length > 0) {
    console.error(`Validation errors (${allErrors.length}):`);
    for (const error of allErrors.slice(0, 50)) console.error(`  - ${error}`);
    if (allErrors.length > 50) console.error(`  ... ${allErrors.length - 50} more`);
    if (!dryRun) process.exitCode = 1;
    if (!dryRun) return;
  }

  const data = JSON.parse(await fs.readFile(SOURCE_PATH, 'utf8')) as SourceExerciseDocument[];
  let applied = 0;
  const missing: string[] = [];
  const seen = new Set<string>();

  for (const item of allItems) {
    if (seen.has(item.id)) {
      console.warn(`Duplicate id ${item.id} across batches, keeping last`);
    }
    seen.add(item.id);
    const exercise = findExerciseByIdentifier(data, item.id);
    if (!exercise) {
      missing.push(item.id);
      continue;
    }
    applyToExercise(exercise, item);
    applied += 1;
  }

  console.log(`Files merged: ${outputFiles.length}`);
  console.log(`Items applied: ${applied}`);
  if (missing.length > 0) console.log(`Missing in source: ${missing.length} (${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '...' : ''})`);

  if (dryRun) {
    console.log('[DRY RUN] Source files NOT written.');
    return;
  }

  await fs.writeFile(SOURCE_PATH, `${JSON.stringify(data, null, 2)}\n`);
  await fs.writeFile(NDJSON_PATH, `${data.map((exercise) => JSON.stringify(exercise)).join('\n')}\n`);
  console.log(`Wrote: ${SOURCE_PATH}`);
  console.log(`Wrote: ${NDJSON_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
