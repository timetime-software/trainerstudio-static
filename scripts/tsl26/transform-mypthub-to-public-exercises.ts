import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

type MediaType = 'image' | 'video' | 'gif' | 'link';
type MediaSource = 'youtube' | 'vimeo' | 'uploaded' | 'external';

type ExerciseMedia = {
  type: MediaType;
  url?: string;
  thumbnailUrl?: string;
  source?: MediaSource;
};

type ExerciseClassification = {
  primaryMuscles: string[];
  secondaryMuscles: string[];
  movementPattern: string[];
  forceType: string[];
  mechanic: string[];
  laterality: string[];
  equipment: string[];
};

type PublicExerciseDocument = {
  id: string;
  cdnslug: string;
  name: string;
  force: string;
  level: string;
  mechanic: string;
  equipment: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  category: string;
  images: string[];
  isActive: boolean;
  libraryId?: string;
  i18n: {
    name: { en: string };
    category: { en: string };
    equipment?: { en: string };
    primaryMuscles: { en: string[] };
    secondaryMuscles?: { en: string[] };
    instructions: { en: string[] };
  };
  classification: ExerciseClassification;
  media: ExerciseMedia[];
  source: 'mypthub';
  sourceId: string;
  aliases: string[];
};

type TransformReport = {
  inputPath: string;
  outputPath: string;
  totalRows: number;
  transformed: number;
  skipped: Array<{ row: number; id: string; name: string; reason: string }>;
  unmappedMuscles: Record<string, number>;
  unmappedEquipment: Record<string, number>;
  media: {
    youtubeVideos: number;
    imagesFromYoutubeThumbnail: number;
    withoutMedia: number;
  };
};

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_INPUT_PATH = path.join(SCRIPT_DIR, 'source/mypthub-exercises.csv');
const DEFAULT_OUTPUT_PATH = path.join(SCRIPT_DIR, 'data/exercises.json');

const MUSCLE_MAP: Record<string, string[]> = {
  Abdominals: ['abs'],
  Abductors: ['abductors'],
  'Achilles Tendon': ['calves'],
  Adductors: ['adductors'],
  Biceps: ['biceps'],
  Calves: ['calves'],
  Chest: ['chest'],
  Fingers: ['grip'],
  Forearms: ['forearm_flexors', 'forearm_extensors'],
  'Full Body': ['abs', 'glutes', 'quadriceps', 'hamstrings', 'chest', 'lats', 'shoulders'],
  Glutes: ['glutes'],
  Groin: ['adductors'],
  Hamstrings: ['hamstrings'],
  'Hip Flexor': ['hip_flexors'],
  Lats: ['lats'],
  'Lower Back': ['lower_back'],
  'Middle Back': ['rhomboids', 'mid_traps'],
  Neck: ['neck'],
  Obliques: ['obliques'],
  Quadriceps: ['quadriceps'],
  'Rotator Cuff': ['rotator_cuff'],
  Shoulders: ['shoulders'],
  Traps: ['traps'],
  Triceps: ['triceps'],
};

const EQUIPMENT_MAP: Record<string, string[]> = {
  Bands: ['resistance_band'],
  Bar: ['barbell'],
  Barbell: ['barbell'],
  Bench: ['bench'],
  'Body Only': ['bodyweight'],
  BOSU: ['bosu'],
  Box: ['box'],
  Cable: ['cable'],
  Dumbbell: ['dumbbell'],
  'E-Z Curl Bar': ['ez_bar'],
  'Exercise Ball': ['stability_ball'],
  'Foam Roll': ['foam_roller'],
  Kettlebells: ['kettlebell'],
  Machine: ['machine'],
  'Medicine Ball': ['medicine_ball'],
  None: ['bodyweight'],
  Other: ['other'],
  Pole: ['other'],
  Ropes: ['battle_ropes'],
  Sandbag: ['other'],
  'Spin Bike': ['bike'],
  Step: ['box'],
  TRX: ['suspension'],
  Tyre: ['other'],
  Wall: ['other'],
  'Weight Plate': ['other'],
};

const LEGACY_MUSCLE_MAP: Record<string, string> = {
  Abdominals: 'abdominals',
  Abductors: 'abductors',
  'Achilles Tendon': 'calves',
  Adductors: 'adductors',
  Biceps: 'biceps',
  Calves: 'calves',
  Chest: 'chest',
  Fingers: 'forearms',
  Forearms: 'forearms',
  'Full Body': 'full body',
  Glutes: 'glutes',
  Groin: 'adductors',
  Hamstrings: 'hamstrings',
  'Hip Flexor': 'hip flexors',
  Lats: 'lats',
  'Lower Back': 'lower back',
  'Middle Back': 'middle back',
  Neck: 'neck',
  Obliques: 'obliques',
  Quadriceps: 'quadriceps',
  'Rotator Cuff': 'shoulders',
  Shoulders: 'shoulders',
  Traps: 'traps',
  Triceps: 'triceps',
};

const CATEGORY_MAP: Record<string, string> = {
  cardio: 'cardio',
  stretch: 'stretching',
  weight: 'strength',
};

function getArgValue(name: string): string | undefined {
  const inline = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (inline) {
    return inline.slice(name.length + 3);
  }

  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function getOption(name: string, fallback: string): string {
  const envName = `MYPTHUB_TRANSFORM_${name.replace(/-/g, '_').toUpperCase()}`;
  return getArgValue(name) ?? process.env[envName] ?? fallback;
}

function parseCsv(content: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const next = content[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (char !== '\r') {
      cell += char;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  const [headers, ...dataRows] = rows;
  if (!headers?.length) {
    return [];
  }

  return dataRows
    .filter((dataRow) => dataRow.some((value) => value.trim().length > 0))
    .map((dataRow) => Object.fromEntries(headers.map((header, index) => [header, dataRow[index] ?? ''])));
}

function splitPipe(value: string | undefined): string[] {
  return (value ?? '')
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean);
}

function slugifyEnglishName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function countUnmapped(counter: Record<string, number>, value: string): void {
  counter[value] = (counter[value] ?? 0) + 1;
}

function mapMuscles(values: string[], unmapped: Record<string, number>): string[] {
  return unique(
    values.flatMap((value) => {
      const mapped = MUSCLE_MAP[value];
      if (!mapped) {
        countUnmapped(unmapped, value);
        return [];
      }
      return mapped;
    }),
  );
}

function mapLegacyMuscles(values: string[]): string[] {
  return unique(values.map((value) => LEGACY_MUSCLE_MAP[value]).filter(Boolean));
}

function mapEquipment(values: string[], unmapped: Record<string, number>): string[] {
  const mapped = unique(
    values.flatMap((value) => {
      const result = EQUIPMENT_MAP[value];
      if (!result) {
        countUnmapped(unmapped, value);
        return [];
      }
      return result;
    }),
  );

  return mapped.length > 0 ? mapped : ['other'];
}

function normalizeLegacyEquipment(values: string[]): string {
  if (values.length === 0) {
    return '';
  }

  return values[0].trim().toLowerCase();
}

function instructionsFromDescription(value: string): string[] {
  const lines = value
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.length > 0 ? lines : [];
}

function movementPatternFor(row: Record<string, string>, primaryMuscles: string[]): string[] {
  const name = row.name.toLowerCase();
  const exerciseType = row.exercise_type.toLowerCase();

  if (exerciseType === 'stretch') return ['isolation'];
  if (exerciseType === 'cardio') return ['carry'];
  if (/\b(squat|leg press|step|lunge)\b/.test(name)) return ['squat'];
  if (/\b(deadlift|hinge|hip thrust|bridge|good morning)\b/.test(name)) return ['hinge'];
  if (/\b(lunge|split squat)\b/.test(name)) return ['lunge'];
  if (/\b(row)\b/.test(name)) return ['horizontal_pull'];
  if (/\b(pull|chin|lat pulldown)\b/.test(name)) return ['vertical_pull'];
  if (/\b(press|push|dip|fly|flye)\b/.test(name)) return primaryMuscles.includes('shoulders') ? ['vertical_push'] : ['horizontal_push'];
  if (/\b(curl|extension|raise|shrug|calf)\b/.test(name)) return ['isolation'];
  if (primaryMuscles.some((muscle) => ['abs', 'obliques', 'transverse'].includes(muscle))) return ['anti_rotation'];

  return ['isolation'];
}

function forceTypeFor(row: Record<string, string>, movementPattern: string[]): string[] {
  const name = row.name.toLowerCase();
  const exerciseType = row.exercise_type.toLowerCase();

  if (exerciseType === 'stretch' || /\b(hold|plank|stretch|pose)\b/.test(name)) return ['isometric'];
  if (movementPattern.some((pattern) => pattern.includes('pull') || pattern === 'hinge')) return ['pull'];
  if (movementPattern.some((pattern) => pattern.includes('push') || pattern === 'squat' || pattern === 'lunge')) return ['push'];
  if (exerciseType === 'cardio') return ['mixed'];

  return ['mixed'];
}

function mechanicFor(row: Record<string, string>, movementPattern: string[]): string[] {
  const exerciseType = row.exercise_type.toLowerCase();
  if (exerciseType === 'stretch') return ['isolation'];
  return movementPattern.some((pattern) => ['squat', 'hinge', 'lunge', 'horizontal_push', 'horizontal_pull', 'vertical_push', 'vertical_pull'].includes(pattern))
    ? ['compound']
    : ['isolation'];
}

function lateralityFor(row: Record<string, string>): string[] {
  const name = row.name.toLowerCase();
  if (/\b(alternate|alternating)\b/.test(name)) return ['alternating'];
  if (/\b(single|one arm|one leg|single arm|single leg)\b/.test(name)) return ['unilateral'];
  return ['bilateral'];
}

function mediaFor(row: Record<string, string>): ExerciseMedia[] {
  const media: ExerciseMedia[] = [];
  const videoId = row.video_id.trim();
  const videoType = row.video_type.trim().toLowerCase();
  const videoUrl = row.full_video_url.trim();
  const thumbnailUrl = row.full_video_image_url.trim();

  if (videoType === 'youtube' && videoId) {
    media.push({
      type: 'video',
      url: videoUrl || `https://www.youtube.com/embed/${videoId}`,
      thumbnailUrl: thumbnailUrl || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      source: 'youtube',
    });
  } else if (videoUrl) {
    media.push({
      type: 'video',
      url: videoUrl,
      thumbnailUrl: thumbnailUrl || undefined,
      source: 'external',
    });
  }

  if (thumbnailUrl) {
    media.push({
      type: 'image',
      url: thumbnailUrl,
      source: videoType === 'youtube' ? 'youtube' : 'external',
    });
  }

  return media;
}

function transformRow(row: Record<string, string>, report: TransformReport, rowNumber: number, libraryId?: string): PublicExerciseDocument | null {
  const id = row.id.trim();
  const name = row.name.trim();
  if (!id || !name) {
    report.skipped.push({ row: rowNumber, id, name, reason: 'missing id or name' });
    return null;
  }

  const rawPrimaryMuscles = splitPipe(row.main_muscle_worked || row.muscle_type);
  const rawSecondaryMuscles = splitPipe(row.other_muscles);
  const primaryMuscles = mapMuscles(rawPrimaryMuscles, report.unmappedMuscles);
  const secondaryMuscles = mapMuscles(rawSecondaryMuscles, report.unmappedMuscles).filter((muscle) => !primaryMuscles.includes(muscle));

  if (primaryMuscles.length === 0) {
    report.skipped.push({ row: rowNumber, id, name, reason: 'no mappable primary muscles' });
    return null;
  }

  const rawEquipment = splitPipe(row.equipment);
  const equipment = mapEquipment(rawEquipment, report.unmappedEquipment);
  const instructions = instructionsFromDescription(row.description_text);
  const category = CATEGORY_MAP[row.exercise_type.trim().toLowerCase()] ?? 'strength';
  const movementPattern = movementPatternFor(row, primaryMuscles);
  const forceType = forceTypeFor(row, movementPattern);
  const mechanic = mechanicFor(row, movementPattern);
  const media = mediaFor(row);

  if (media.some((item) => item.type === 'video' && item.source === 'youtube')) report.media.youtubeVideos += 1;
  if (media.some((item) => item.type === 'image' && item.source === 'youtube')) report.media.imagesFromYoutubeThumbnail += 1;
  if (media.length === 0) report.media.withoutMedia += 1;

  const legacyPrimaryMuscles = mapLegacyMuscles(rawPrimaryMuscles);
  const legacySecondaryMuscles = mapLegacyMuscles(rawSecondaryMuscles).filter((muscle) => !legacyPrimaryMuscles.includes(muscle));

  return {
    id: `mypthub_${id}`,
    cdnslug: slugifyEnglishName(name),
    name,
    force: forceType[0] ?? '',
    level: 'beginner',
    mechanic: mechanic[0] ?? '',
    equipment: normalizeLegacyEquipment(rawEquipment),
    primaryMuscles: legacyPrimaryMuscles,
    secondaryMuscles: legacySecondaryMuscles,
    instructions,
    category,
    images: media.filter((item) => item.type === 'image' && item.url).map((item) => item.url as string),
    isActive: row.status.trim().toLowerCase() === 'live',
    ...(libraryId ? { libraryId } : {}),
    i18n: {
      name: { en: name },
      category: { en: category },
      ...(rawEquipment[0] ? { equipment: { en: rawEquipment[0] } } : {}),
      primaryMuscles: { en: legacyPrimaryMuscles },
      ...(legacySecondaryMuscles.length > 0 ? { secondaryMuscles: { en: legacySecondaryMuscles } } : {}),
      instructions: { en: instructions },
    },
    classification: {
      primaryMuscles,
      secondaryMuscles,
      movementPattern,
      forceType,
      mechanic,
      laterality: lateralityFor(row),
      equipment,
    },
    media,
    source: 'mypthub',
    sourceId: id,
    aliases: splitPipe(row.aliases),
  };
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function ensureUniqueCdnSlugs(documents: PublicExerciseDocument[]): void {
  const counts = new Map<string, number>();

  for (const document of documents) {
    counts.set(document.cdnslug, (counts.get(document.cdnslug) ?? 0) + 1);
  }

  for (const document of documents) {
    if ((counts.get(document.cdnslug) ?? 0) > 1) {
      document.cdnslug = `${document.cdnslug}_${document.sourceId}`;
    }
  }
}

async function main(): Promise<void> {
  const inputPath = path.resolve(getOption('input', DEFAULT_INPUT_PATH));
  const outputPath = path.resolve(getOption('output', DEFAULT_OUTPUT_PATH));
  const reportPath = path.resolve(getOption('report', path.join(SCRIPT_DIR, 'source/mypthub-public-exercises.report.json')));
  const ndjsonPath = outputPath.replace(/\.json$/i, '.ndjson');
  const libraryId = getArgValue('library-id') ?? process.env.MYPTHUB_TRANSFORM_LIBRARY_ID;

  const content = await fs.readFile(inputPath, 'utf8');
  const rows = parseCsv(content);
  const report: TransformReport = {
    inputPath,
    outputPath,
    totalRows: rows.length,
    transformed: 0,
    skipped: [],
    unmappedMuscles: {},
    unmappedEquipment: {},
    media: {
      youtubeVideos: 0,
      imagesFromYoutubeThumbnail: 0,
      withoutMedia: 0,
    },
  };

  const documents = rows
    .map((row, index) => transformRow(row, report, index + 2, libraryId))
    .filter((document): document is PublicExerciseDocument => document !== null);

  ensureUniqueCdnSlugs(documents);
  report.transformed = documents.length;

  await writeJson(outputPath, documents);
  await fs.writeFile(ndjsonPath, `${documents.map((document) => JSON.stringify(document)).join('\n')}\n`, 'utf8');
  await writeJson(reportPath, report);

  console.log(`Transformed ${documents.length}/${rows.length} My PT Hub exercises`);
  console.log(`JSON: ${outputPath}`);
  console.log(`NDJSON: ${ndjsonPath}`);
  console.log(`Report: ${reportPath}`);

  if (Object.keys(report.unmappedMuscles).length > 0 || Object.keys(report.unmappedEquipment).length > 0) {
    console.warn('There are unmapped values. Check the report before importing.');
  }

  if (report.skipped.length > 0) {
    console.warn(`Skipped ${report.skipped.length} rows. Check the report before importing.`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
