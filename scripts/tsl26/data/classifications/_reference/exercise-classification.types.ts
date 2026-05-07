/**
 * Exercise Classification Types
 *
 * Sistema de clasificación de ejercicios con 3 niveles de detalle muscular
 * y campos adicionales para análisis de entrenamiento.
 */

// =============================================================================
// MÚSCULOS - NIVEL 1: SIMPLE (8 grupos)
// Para UI de clientes y filtros básicos
// =============================================================================

export enum SimpleMuscleGroup {
  CHEST = 'chest',
  BACK = 'back',
  SHOULDERS = 'shoulders',
  ARMS = 'arms',
  CORE = 'core',
  GLUTES = 'glutes',
  LEGS = 'legs',
  NECK = 'neck',
}

// =============================================================================
// MÚSCULOS - NIVEL 2: ESTÁNDAR (18 grupos)
// Para filtros de entrenadores y gráficos generales
// =============================================================================

export enum StandardMuscleGroup {
  CHEST = 'chest',
  LATS = 'lats',
  UPPER_BACK = 'upper_back',
  LOWER_BACK = 'lower_back',
  FRONT_DELTS = 'front_delts',
  SIDE_DELTS = 'side_delts',
  REAR_DELTS = 'rear_delts',
  BICEPS = 'biceps',
  TRICEPS = 'triceps',
  FOREARMS = 'forearms',
  ABS = 'abs',
  OBLIQUES = 'obliques',
  GLUTES = 'glutes',
  HIP_FLEXORS = 'hip_flexors',
  QUADRICEPS = 'quadriceps',
  HAMSTRINGS = 'hamstrings',
  CALVES = 'calves',
  NECK = 'neck',
}

// =============================================================================
// MÚSCULOS - NIVEL 3: DETALLADO (55 grupos)
// Para análisis profundo y clasificación precisa por IA
// =============================================================================

export enum DetailedMuscleGroup {
  // === PECHO ===
  CHEST = 'chest', // Pecho general
  UPPER_CHEST = 'upper_chest', // Pectoral superior (clavicular)
  LOWER_CHEST = 'lower_chest', // Pectoral inferior (esternal)

  // === ESPALDA ===
  LATS = 'lats', // Dorsales
  TRAPS = 'traps', // Trapecio general
  UPPER_TRAPS = 'upper_traps', // Trapecio superior
  MID_TRAPS = 'mid_traps', // Trapecio medio
  LOWER_TRAPS = 'lower_traps', // Trapecio inferior
  RHOMBOIDS = 'rhomboids', // Romboides
  LOWER_BACK = 'lower_back', // Erectores espinales
  TERES = 'teres', // Redondo mayor/menor

  // === HOMBROS ===
  SHOULDERS = 'shoulders', // Deltoides general
  FRONT_DELTS = 'front_delts', // Deltoides anterior
  SIDE_DELTS = 'side_delts', // Deltoides lateral
  REAR_DELTS = 'rear_delts', // Deltoides posterior
  ROTATOR_CUFF = 'rotator_cuff', // Manguito rotador

  // === BRAZOS ===
  BICEPS = 'biceps', // Bíceps braquial
  BICEPS_LONG_HEAD = 'biceps_long_head', // Cabeza larga del bíceps
  BICEPS_SHORT_HEAD = 'biceps_short_head', // Cabeza corta del bíceps
  BRACHIALIS = 'brachialis', // Braquial
  TRICEPS = 'triceps', // Tríceps general
  TRICEPS_LONG_HEAD = 'triceps_long_head', // Cabeza larga del tríceps
  TRICEPS_LATERAL_HEAD = 'triceps_lateral_head', // Cabeza lateral
  TRICEPS_MEDIAL_HEAD = 'triceps_medial_head', // Cabeza medial
  FOREARM_FLEXORS = 'forearm_flexors', // Flexores del antebrazo
  FOREARM_EXTENSORS = 'forearm_extensors', // Extensores del antebrazo
  GRIP = 'grip', // Agarre (fuerza de mano)

  // === CORE ===
  ABS = 'abs', // Recto abdominal general
  UPPER_ABS = 'upper_abs', // Abs superiores
  LOWER_ABS = 'lower_abs', // Abs inferiores
  OBLIQUES = 'obliques', // Oblicuos (interno + externo)
  TRANSVERSE = 'transverse', // Transverso abdominal
  SERRATUS = 'serratus', // Serrato anterior

  // === GLÚTEOS / CADERA ===
  GLUTES = 'glutes', // Glúteo mayor
  GLUTE_MED = 'glute_med', // Glúteo medio
  GLUTE_MIN = 'glute_min', // Glúteo menor
  HIP_FLEXORS = 'hip_flexors', // Flexores de cadera (psoas, ilíaco)
  ADDUCTORS = 'adductors', // Aductores
  ABDUCTORS = 'abductors', // Abductores (TFL)

  // === PIERNAS ===
  QUADRICEPS = 'quadriceps', // Cuádriceps general
  VASTUS_LATERALIS = 'vastus_lateralis', // Vasto lateral
  VASTUS_MEDIALIS = 'vastus_medialis', // Vasto medial (VMO)
  RECTUS_FEMORIS = 'rectus_femoris', // Recto femoral
  HAMSTRINGS = 'hamstrings', // Isquiotibiales general
  BICEPS_FEMORIS = 'biceps_femoris', // Bíceps femoral
  SEMITENDINOSUS = 'semitendinosus', // Semitendinoso
  SEMIMEMBRANOSUS = 'semimembranosus', // Semimembranoso
  CALVES = 'calves', // Gemelos + sóleo general
  GASTROCNEMIUS = 'gastrocnemius', // Gemelos
  SOLEUS = 'soleus', // Sóleo
  TIBIALIS = 'tibialis', // Tibial anterior
  PERONEALS = 'peroneals', // Peroneos

  // === CUELLO ===
  NECK = 'neck', // Cuello general
  NECK_FLEXORS = 'neck_flexors', // Flexores del cuello
  NECK_EXTENSORS = 'neck_extensors', // Extensores del cuello
}

// =============================================================================
// MAPEOS ENTRE NIVELES
// =============================================================================

export const detailedToStandard: Record<DetailedMuscleGroup, StandardMuscleGroup> = {
  // Pecho
  [DetailedMuscleGroup.CHEST]: StandardMuscleGroup.CHEST,
  [DetailedMuscleGroup.UPPER_CHEST]: StandardMuscleGroup.CHEST,
  [DetailedMuscleGroup.LOWER_CHEST]: StandardMuscleGroup.CHEST,

  // Espalda
  [DetailedMuscleGroup.LATS]: StandardMuscleGroup.LATS,
  [DetailedMuscleGroup.TRAPS]: StandardMuscleGroup.UPPER_BACK,
  [DetailedMuscleGroup.UPPER_TRAPS]: StandardMuscleGroup.UPPER_BACK,
  [DetailedMuscleGroup.MID_TRAPS]: StandardMuscleGroup.UPPER_BACK,
  [DetailedMuscleGroup.LOWER_TRAPS]: StandardMuscleGroup.UPPER_BACK,
  [DetailedMuscleGroup.RHOMBOIDS]: StandardMuscleGroup.UPPER_BACK,
  [DetailedMuscleGroup.LOWER_BACK]: StandardMuscleGroup.LOWER_BACK,
  [DetailedMuscleGroup.TERES]: StandardMuscleGroup.LATS,

  // Hombros
  [DetailedMuscleGroup.SHOULDERS]: StandardMuscleGroup.FRONT_DELTS,
  [DetailedMuscleGroup.FRONT_DELTS]: StandardMuscleGroup.FRONT_DELTS,
  [DetailedMuscleGroup.SIDE_DELTS]: StandardMuscleGroup.SIDE_DELTS,
  [DetailedMuscleGroup.REAR_DELTS]: StandardMuscleGroup.REAR_DELTS,
  [DetailedMuscleGroup.ROTATOR_CUFF]: StandardMuscleGroup.REAR_DELTS,

  // Brazos
  [DetailedMuscleGroup.BICEPS]: StandardMuscleGroup.BICEPS,
  [DetailedMuscleGroup.BICEPS_LONG_HEAD]: StandardMuscleGroup.BICEPS,
  [DetailedMuscleGroup.BICEPS_SHORT_HEAD]: StandardMuscleGroup.BICEPS,
  [DetailedMuscleGroup.BRACHIALIS]: StandardMuscleGroup.BICEPS,
  [DetailedMuscleGroup.TRICEPS]: StandardMuscleGroup.TRICEPS,
  [DetailedMuscleGroup.TRICEPS_LONG_HEAD]: StandardMuscleGroup.TRICEPS,
  [DetailedMuscleGroup.TRICEPS_LATERAL_HEAD]: StandardMuscleGroup.TRICEPS,
  [DetailedMuscleGroup.TRICEPS_MEDIAL_HEAD]: StandardMuscleGroup.TRICEPS,
  [DetailedMuscleGroup.FOREARM_FLEXORS]: StandardMuscleGroup.FOREARMS,
  [DetailedMuscleGroup.FOREARM_EXTENSORS]: StandardMuscleGroup.FOREARMS,
  [DetailedMuscleGroup.GRIP]: StandardMuscleGroup.FOREARMS,

  // Core
  [DetailedMuscleGroup.ABS]: StandardMuscleGroup.ABS,
  [DetailedMuscleGroup.UPPER_ABS]: StandardMuscleGroup.ABS,
  [DetailedMuscleGroup.LOWER_ABS]: StandardMuscleGroup.ABS,
  [DetailedMuscleGroup.OBLIQUES]: StandardMuscleGroup.OBLIQUES,
  [DetailedMuscleGroup.TRANSVERSE]: StandardMuscleGroup.ABS,
  [DetailedMuscleGroup.SERRATUS]: StandardMuscleGroup.ABS,

  // Glúteos / Cadera
  [DetailedMuscleGroup.GLUTES]: StandardMuscleGroup.GLUTES,
  [DetailedMuscleGroup.GLUTE_MED]: StandardMuscleGroup.GLUTES,
  [DetailedMuscleGroup.GLUTE_MIN]: StandardMuscleGroup.GLUTES,
  [DetailedMuscleGroup.HIP_FLEXORS]: StandardMuscleGroup.HIP_FLEXORS,
  [DetailedMuscleGroup.ADDUCTORS]: StandardMuscleGroup.HIP_FLEXORS,
  [DetailedMuscleGroup.ABDUCTORS]: StandardMuscleGroup.GLUTES,

  // Piernas
  [DetailedMuscleGroup.QUADRICEPS]: StandardMuscleGroup.QUADRICEPS,
  [DetailedMuscleGroup.VASTUS_LATERALIS]: StandardMuscleGroup.QUADRICEPS,
  [DetailedMuscleGroup.VASTUS_MEDIALIS]: StandardMuscleGroup.QUADRICEPS,
  [DetailedMuscleGroup.RECTUS_FEMORIS]: StandardMuscleGroup.QUADRICEPS,
  [DetailedMuscleGroup.HAMSTRINGS]: StandardMuscleGroup.HAMSTRINGS,
  [DetailedMuscleGroup.BICEPS_FEMORIS]: StandardMuscleGroup.HAMSTRINGS,
  [DetailedMuscleGroup.SEMITENDINOSUS]: StandardMuscleGroup.HAMSTRINGS,
  [DetailedMuscleGroup.SEMIMEMBRANOSUS]: StandardMuscleGroup.HAMSTRINGS,
  [DetailedMuscleGroup.CALVES]: StandardMuscleGroup.CALVES,
  [DetailedMuscleGroup.GASTROCNEMIUS]: StandardMuscleGroup.CALVES,
  [DetailedMuscleGroup.SOLEUS]: StandardMuscleGroup.CALVES,
  [DetailedMuscleGroup.TIBIALIS]: StandardMuscleGroup.CALVES,
  [DetailedMuscleGroup.PERONEALS]: StandardMuscleGroup.CALVES,

  // Cuello
  [DetailedMuscleGroup.NECK]: StandardMuscleGroup.NECK,
  [DetailedMuscleGroup.NECK_FLEXORS]: StandardMuscleGroup.NECK,
  [DetailedMuscleGroup.NECK_EXTENSORS]: StandardMuscleGroup.NECK,
};

export const standardToSimple: Record<StandardMuscleGroup, SimpleMuscleGroup> = {
  [StandardMuscleGroup.CHEST]: SimpleMuscleGroup.CHEST,
  [StandardMuscleGroup.LATS]: SimpleMuscleGroup.BACK,
  [StandardMuscleGroup.UPPER_BACK]: SimpleMuscleGroup.BACK,
  [StandardMuscleGroup.LOWER_BACK]: SimpleMuscleGroup.BACK,
  [StandardMuscleGroup.FRONT_DELTS]: SimpleMuscleGroup.SHOULDERS,
  [StandardMuscleGroup.SIDE_DELTS]: SimpleMuscleGroup.SHOULDERS,
  [StandardMuscleGroup.REAR_DELTS]: SimpleMuscleGroup.SHOULDERS,
  [StandardMuscleGroup.BICEPS]: SimpleMuscleGroup.ARMS,
  [StandardMuscleGroup.TRICEPS]: SimpleMuscleGroup.ARMS,
  [StandardMuscleGroup.FOREARMS]: SimpleMuscleGroup.ARMS,
  [StandardMuscleGroup.ABS]: SimpleMuscleGroup.CORE,
  [StandardMuscleGroup.OBLIQUES]: SimpleMuscleGroup.CORE,
  [StandardMuscleGroup.GLUTES]: SimpleMuscleGroup.GLUTES,
  [StandardMuscleGroup.HIP_FLEXORS]: SimpleMuscleGroup.GLUTES,
  [StandardMuscleGroup.QUADRICEPS]: SimpleMuscleGroup.LEGS,
  [StandardMuscleGroup.HAMSTRINGS]: SimpleMuscleGroup.LEGS,
  [StandardMuscleGroup.CALVES]: SimpleMuscleGroup.LEGS,
  [StandardMuscleGroup.NECK]: SimpleMuscleGroup.NECK,
};

const SIMPLE_MUSCLE_ALIASES: Record<string, SimpleMuscleGroup> = {
  abdominal: SimpleMuscleGroup.CORE,
  abdominals: SimpleMuscleGroup.CORE,
  abdominales: SimpleMuscleGroup.CORE,
  'middle back': SimpleMuscleGroup.BACK,
  middle_back: SimpleMuscleGroup.BACK,
  quads: SimpleMuscleGroup.LEGS,
  psoas: SimpleMuscleGroup.GLUTES,
  it_band: SimpleMuscleGroup.LEGS,
};

// Helper: Detailed -> Simple (directo)
export const detailedToSimple = (detailed: DetailedMuscleGroup): SimpleMuscleGroup => {
  return standardToSimple[detailedToStandard[detailed]];
};

export function normalizeMuscleToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '_');
}

export function toSimpleMuscleGroup(value: string): SimpleMuscleGroup | undefined {
  const normalized = normalizeMuscleToken(value);

  if ((Object.values(SimpleMuscleGroup) as string[]).includes(normalized)) {
    return normalized as SimpleMuscleGroup;
  }

  if ((Object.values(StandardMuscleGroup) as string[]).includes(normalized)) {
    return standardToSimple[normalized as StandardMuscleGroup];
  }

  if ((Object.values(DetailedMuscleGroup) as string[]).includes(normalized)) {
    return detailedToSimple(normalized as DetailedMuscleGroup);
  }

  return SIMPLE_MUSCLE_ALIASES[normalized];
}

export function expandSimpleMuscleGroupFilter(value: string): string[] {
  const simple = toSimpleMuscleGroup(value);

  if (!simple) {
    return [normalizeMuscleToken(value)];
  }

  const standard = Object.values(StandardMuscleGroup).filter((muscle) => standardToSimple[muscle] === simple);
  const detailed = Object.values(DetailedMuscleGroup).filter((muscle) => detailedToSimple(muscle) === simple);
  const aliases = Object.entries(SIMPLE_MUSCLE_ALIASES)
    .filter(([, simpleMuscle]) => simpleMuscle === simple)
    .map(([alias]) => alias);

  return [...new Set([simple, ...standard, ...detailed, ...aliases])];
}

// =============================================================================
// PATRÓN DE MOVIMIENTO
// =============================================================================

export enum MovementPattern {
  // Tren superior
  HORIZONTAL_PUSH = 'horizontal_push', // Press banca, flexiones
  HORIZONTAL_PULL = 'horizontal_pull', // Remo
  VERTICAL_PUSH = 'vertical_push', // Press militar
  VERTICAL_PULL = 'vertical_pull', // Dominadas

  // Tren inferior
  SQUAT = 'squat', // Sentadilla y variantes
  HINGE = 'hinge', // Peso muerto, hip thrust
  LUNGE = 'lunge', // Zancadas

  // Otros
  CARRY = 'carry', // Farmer walks
  ROTATION = 'rotation', // Rotacionales (leñador)
  ANTI_ROTATION = 'anti_rotation', // Pallof press
  ISOLATION = 'isolation', // Aislamiento (curl, extensiones)
}

// =============================================================================
// TIPO DE FUERZA
// =============================================================================

export enum ForceType {
  PUSH = 'push', // Empuje
  PULL = 'pull', // Tirón
  ISOMETRIC = 'isometric', // Estático
  MIXED = 'mixed', // Combinado (ej: clean & jerk)
}

// =============================================================================
// MECÁNICA
// =============================================================================

export enum Mechanic {
  COMPOUND = 'compound', // Multiarticular
  ISOLATION = 'isolation', // Monoarticular
}

// =============================================================================
// LATERALIDAD
// =============================================================================

export enum Laterality {
  BILATERAL = 'bilateral', // Dos lados a la vez
  UNILATERAL = 'unilateral', // Un lado
  ALTERNATING = 'alternating', // Alternando
}

// =============================================================================
// EQUIPAMIENTO
// =============================================================================

export enum Equipment {
  BODYWEIGHT = 'bodyweight',
  BARBELL = 'barbell',
  DUMBBELL = 'dumbbell',
  KETTLEBELL = 'kettlebell',
  CABLE = 'cable',
  MACHINE = 'machine',
  SMITH_MACHINE = 'smith_machine',
  RESISTANCE_BAND = 'resistance_band',
  MEDICINE_BALL = 'medicine_ball',
  SLAM_BALL = 'slam_ball',
  SUSPENSION = 'suspension', // TRX
  RINGS = 'rings',
  BOX = 'box',
  PULL_UP_BAR = 'pull_up_bar',
  BENCH = 'bench',
  FOAM_ROLLER = 'foam_roller',
  STABILITY_BALL = 'stability_ball',
  BOSU = 'bosu',
  LANDMINE = 'landmine',
  TRAP_BAR = 'trap_bar',
  EZ_BAR = 'ez_bar',
  ROPE = 'rope',
  BATTLE_ROPES = 'battle_ropes',
  SLED = 'sled',
  ROWING_MACHINE = 'rowing_machine',
  BIKE = 'bike',
  TREADMILL = 'treadmill',
  ELLIPTICAL = 'elliptical',
  OTHER = 'other',
}

// =============================================================================
// MEDIA
// =============================================================================

export type MediaType = 'image' | 'video' | 'gif' | 'link';

export type MediaSource = 'youtube' | 'vimeo' | 'uploaded' | 'external';

export interface ExerciseMedia {
  type: MediaType;
  url?: string;
  key?: string; // Internal storage key for uploaded media
  thumbnailUrl?: string; // Para videos/gifs
  isPrimary?: boolean; // Deprecated: usar orden del array (primer elemento = principal)
  source?: MediaSource;
}

// =============================================================================
// CLASIFICACIÓN COMPLETA DEL EJERCICIO
// =============================================================================

export interface ExerciseClassification {
  // Músculos (nivel detallado - obligatorio al menos primaryMuscles)
  primaryMuscles: DetailedMuscleGroup[];
  secondaryMuscles?: DetailedMuscleGroup[];

  // Clasificación de movimiento
  movementPattern: MovementPattern[];
  forceType: ForceType[];
  mechanic: Mechanic[];
  laterality?: Laterality[];

  // Equipamiento
  equipment: Equipment[];

  // Media (nuevo campo, retrocompatible)
  media?: ExerciseMedia[];
}

// =============================================================================
// HELPERS PARA DERIVAR NIVELES
// =============================================================================

/**
 * Convierte músculos detallados a nivel estándar (sin duplicados)
 */
export function toStandardMuscles(detailed: DetailedMuscleGroup[]): StandardMuscleGroup[] {
  const standard = detailed.map((m) => detailedToStandard[m]);
  return [...new Set(standard)];
}

/**
 * Convierte músculos detallados a nivel simple (sin duplicados)
 */
export function toSimpleMuscles(detailed: DetailedMuscleGroup[]): SimpleMuscleGroup[] {
  const simple = detailed.map((m) => detailedToSimple(m));
  return [...new Set(simple)];
}

// =============================================================================
// HELPER PARA MEDIA CON FALLBACK LEGACY
// =============================================================================

interface LegacyMediaFields {
  videoLink?: string;
  image?: string;
  thumbnail?: string;
  images?: string[];
}

/**
 * Obtiene el media principal para thumbnail.
 * Prioridad:
 * 1. Thumbnail legacy (si existe)
 * 2. Primera imagen/gif del array media[]
 * 3. Fallback a campos legacy (image, images[])
 */
export function getPrimaryMedia(media: ExerciseMedia[] | undefined, legacy: LegacyMediaFields): ExerciseMedia | null {
  // 1. Si hay thumbnail legacy, usarlo como imagen principal
  if (legacy.thumbnail) {
    return {
      type: 'image',
      url: legacy.thumbnail,
      source: 'uploaded',
    };
  }

  // 2. Si hay media[] v2, usar la primera imagen/gif
  if (media?.length) {
    const firstImageOrGif = media.find((m) => m.type === 'image' || m.type === 'gif');
    if (firstImageOrGif) {
      return firstImageOrGif;
    }
    // Si solo hay videos, retornar el primero
    return media[0];
  }

  // 3. Fallback a campos legacy
  if (legacy.image) {
    return {
      type: 'image',
      url: legacy.image,
      thumbnailUrl: legacy.thumbnail,
      source: 'uploaded',
    };
  }

  if (legacy.images?.[0]) {
    return {
      type: 'image',
      url: legacy.images[0],
      source: 'external',
    };
  }

  if (legacy.videoLink) {
    return {
      type: 'video',
      url: legacy.videoLink,
      source: legacy.videoLink.includes('youtube') ? 'youtube' : 'external',
    };
  }

  return null;
}

/**
 * Obtiene todos los media, combinando nuevo formato con legacy.
 * El orden del array determina prioridad (primer elemento = principal).
 */
export function getAllMedia(media: ExerciseMedia[] | undefined, legacy: LegacyMediaFields): ExerciseMedia[] {
  if (media?.length) {
    return media;
  }

  const result: ExerciseMedia[] = [];

  if (legacy.videoLink) {
    result.push({
      type: 'video',
      url: legacy.videoLink,
      source: legacy.videoLink.includes('youtube') ? 'youtube' : legacy.videoLink.includes('vimeo') ? 'vimeo' : 'external',
    });
  }

  if (legacy.image) {
    result.push({
      type: 'image',
      url: legacy.image,
      thumbnailUrl: legacy.thumbnail,
      source: 'uploaded',
    });
  }

  if (legacy.images?.length) {
    legacy.images.forEach((img) => {
      // Evitar duplicar si ya existe como legacy.image
      if (img !== legacy.image) {
        result.push({
          type: 'image',
          url: img,
          source: 'external',
        });
      }
    });
  }

  return result;
}
