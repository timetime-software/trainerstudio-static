/**
 * Muscle Groups Data - Static list with translations
 *
 * 57 muscle groups based on DetailedMuscleGroup enum
 * Organized with category (general/specific) and parent relationships
 */

export interface MuscleGroupData {
  id: string;
  category: 'general' | 'specific';
  parentId?: string;
  translations: {
    es: string;
    en: string;
  };
}

export const MUSCLE_GROUPS_DATA: MuscleGroupData[] = [
  // === GENERALES (15 zonas) ===
  { id: 'chest', category: 'general', translations: { es: 'Pecho', en: 'Chest' } },
  { id: 'back', category: 'general', translations: { es: 'Espalda', en: 'Back' } },
  { id: 'shoulders', category: 'general', translations: { es: 'Hombros', en: 'Shoulders' } },
  { id: 'lats', category: 'general', translations: { es: 'Dorsales', en: 'Lats' } },
  { id: 'traps', category: 'general', translations: { es: 'Trapecios', en: 'Traps' } },
  { id: 'biceps', category: 'general', translations: { es: 'Bíceps', en: 'Biceps' } },
  { id: 'triceps', category: 'general', translations: { es: 'Tríceps', en: 'Triceps' } },
  { id: 'forearms', category: 'general', translations: { es: 'Antebrazos', en: 'Forearms' } },
  { id: 'abs', category: 'general', translations: { es: 'Abdominales', en: 'Abs' } },
  { id: 'obliques', category: 'general', translations: { es: 'Oblicuos', en: 'Obliques' } },
  { id: 'glutes', category: 'general', translations: { es: 'Glúteos', en: 'Glutes' } },
  { id: 'quadriceps', category: 'general', translations: { es: 'Cuádriceps', en: 'Quadriceps' } },
  { id: 'hamstrings', category: 'general', translations: { es: 'Isquiotibiales', en: 'Hamstrings' } },
  { id: 'calves', category: 'general', translations: { es: 'Pantorrillas', en: 'Calves' } },
  { id: 'neck', category: 'general', translations: { es: 'Cuello', en: 'Neck' } },

  // === ESPECÍFICOS (~40 músculos detallados) ===

  // Pecho
  { id: 'upper_chest', category: 'specific', parentId: 'chest', translations: { es: 'Pecho superior', en: 'Upper Chest' } },
  { id: 'lower_chest', category: 'specific', parentId: 'chest', translations: { es: 'Pecho inferior', en: 'Lower Chest' } },

  // Hombros
  { id: 'front_delts', category: 'specific', parentId: 'shoulders', translations: { es: 'Deltoides anterior', en: 'Front Delts' } },
  { id: 'side_delts', category: 'specific', parentId: 'shoulders', translations: { es: 'Deltoides lateral', en: 'Side Delts' } },
  { id: 'rear_delts', category: 'specific', parentId: 'shoulders', translations: { es: 'Deltoides posterior', en: 'Rear Delts' } },
  { id: 'rotator_cuff', category: 'specific', parentId: 'shoulders', translations: { es: 'Manguito rotador', en: 'Rotator Cuff' } },

  // Trapecios
  { id: 'upper_traps', category: 'specific', parentId: 'traps', translations: { es: 'Trapecio superior', en: 'Upper Traps' } },
  { id: 'mid_traps', category: 'specific', parentId: 'traps', translations: { es: 'Trapecio medio', en: 'Mid Traps' } },
  { id: 'lower_traps', category: 'specific', parentId: 'traps', translations: { es: 'Trapecio inferior', en: 'Lower Traps' } },

  // Espalda
  { id: 'rhomboids', category: 'specific', parentId: 'back', translations: { es: 'Romboides', en: 'Rhomboids' } },
  { id: 'teres', category: 'specific', parentId: 'back', translations: { es: 'Redondo', en: 'Teres' } },
  { id: 'lower_back', category: 'specific', parentId: 'back', translations: { es: 'Lumbar', en: 'Lower Back' } },

  // Bíceps
  { id: 'biceps_long_head', category: 'specific', parentId: 'biceps', translations: { es: 'Bíceps cabeza larga', en: 'Biceps Long Head' } },
  { id: 'biceps_short_head', category: 'specific', parentId: 'biceps', translations: { es: 'Bíceps cabeza corta', en: 'Biceps Short Head' } },
  { id: 'brachialis', category: 'specific', parentId: 'biceps', translations: { es: 'Braquial', en: 'Brachialis' } },

  // Tríceps
  { id: 'triceps_long_head', category: 'specific', parentId: 'triceps', translations: { es: 'Tríceps cabeza larga', en: 'Triceps Long Head' } },
  { id: 'triceps_lateral_head', category: 'specific', parentId: 'triceps', translations: { es: 'Tríceps cabeza lateral', en: 'Triceps Lateral Head' } },
  { id: 'triceps_medial_head', category: 'specific', parentId: 'triceps', translations: { es: 'Tríceps cabeza medial', en: 'Triceps Medial Head' } },

  // Antebrazos
  { id: 'forearm_flexors', category: 'specific', parentId: 'forearms', translations: { es: 'Flexores del antebrazo', en: 'Forearm Flexors' } },
  { id: 'forearm_extensors', category: 'specific', parentId: 'forearms', translations: { es: 'Extensores del antebrazo', en: 'Forearm Extensors' } },
  { id: 'grip', category: 'specific', parentId: 'forearms', translations: { es: 'Agarre', en: 'Grip' } },

  // Abdominales
  { id: 'upper_abs', category: 'specific', parentId: 'abs', translations: { es: 'Abs superiores', en: 'Upper Abs' } },
  { id: 'lower_abs', category: 'specific', parentId: 'abs', translations: { es: 'Abs inferiores', en: 'Lower Abs' } },
  { id: 'transverse', category: 'specific', parentId: 'abs', translations: { es: 'Transverso', en: 'Transverse' } },
  { id: 'serratus', category: 'specific', parentId: 'abs', translations: { es: 'Serrato', en: 'Serratus' } },

  // Glúteos/Cadera
  { id: 'glute_med', category: 'specific', parentId: 'glutes', translations: { es: 'Glúteo medio', en: 'Glute Med' } },
  { id: 'glute_min', category: 'specific', parentId: 'glutes', translations: { es: 'Glúteo menor', en: 'Glute Min' } },
  { id: 'psoas', category: 'specific', parentId: 'glutes', translations: { es: 'Psoas', en: 'Psoas' } },
  { id: 'hip_flexors', category: 'specific', parentId: 'glutes', translations: { es: 'Flexores de cadera', en: 'Hip Flexors' } },
  { id: 'adductors', category: 'specific', parentId: 'glutes', translations: { es: 'Aductores', en: 'Adductors' } },
  { id: 'abductors', category: 'specific', parentId: 'glutes', translations: { es: 'Abductores', en: 'Abductors' } },

  // Cuádriceps
  { id: 'rectus_femoris', category: 'specific', parentId: 'quadriceps', translations: { es: 'Recto femoral', en: 'Rectus Femoris' } },
  { id: 'vastus_lateralis', category: 'specific', parentId: 'quadriceps', translations: { es: 'Vasto lateral', en: 'Vastus Lateralis' } },
  { id: 'vastus_medialis', category: 'specific', parentId: 'quadriceps', translations: { es: 'Vasto medial / Vasto interno', en: 'Vastus Medialis' } },
  { id: 'it_band', category: 'specific', parentId: 'quadriceps', translations: { es: 'Cintilla iliotibial', en: 'IT Band' } },

  // Isquiotibiales
  { id: 'biceps_femoris', category: 'specific', parentId: 'hamstrings', translations: { es: 'Bíceps femoral', en: 'Biceps Femoris' } },
  { id: 'semitendinosus', category: 'specific', parentId: 'hamstrings', translations: { es: 'Semitendinoso', en: 'Semitendinosus' } },
  { id: 'semimembranosus', category: 'specific', parentId: 'hamstrings', translations: { es: 'Semimembranoso', en: 'Semimembranosus' } },

  // Pantorrillas
  { id: 'gastrocnemius', category: 'specific', parentId: 'calves', translations: { es: 'Gastrocnemio', en: 'Gastrocnemius' } },
  { id: 'soleus', category: 'specific', parentId: 'calves', translations: { es: 'Sóleo', en: 'Soleus' } },
  { id: 'tibialis', category: 'specific', parentId: 'calves', translations: { es: 'Tibial', en: 'Tibialis' } },
  { id: 'peroneals', category: 'specific', parentId: 'calves', translations: { es: 'Peroneos', en: 'Peroneals' } },

  // Cuello
  { id: 'neck_flexors', category: 'specific', parentId: 'neck', translations: { es: 'Flexores del cuello', en: 'Neck Flexors' } },
  { id: 'neck_extensors', category: 'specific', parentId: 'neck', translations: { es: 'Extensores del cuello', en: 'Neck Extensors' } },
];
