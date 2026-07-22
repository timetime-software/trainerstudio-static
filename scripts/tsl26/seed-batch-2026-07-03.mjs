// Seed del lote 2026-07-03: ejercicios pedidos manualmente.
// Mismo contrato y mecanica que seed-batch-2026-06-26.mjs: crea SOLO las entradas
// que no existan ya (idempotente por cdnslug). Se crean SIN media: la referencia
// de video y la generacion del clip default se hacen despues con el pipeline de
// video (ver README "Ark Style Tasks"). Se marcan con metadata.batch para poder
// filtrarlas en el editor ("Lote 2026-07-03"); ese campo se descarta en
// build:public (no llega a MongoDB).
//
//   node seed-batch-2026-07-03.mjs            # aplica los cambios
//   node seed-batch-2026-07-03.mjs --dry-run  # solo informa

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { identityKeyForSlug, idForIdentityKey } from './exercise-ids.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, 'data', 'exercises.ndjson');
const DRY = process.argv.includes('--dry-run');
const BATCH = '2026-07-03';

const DEFS = [
  {
    slug: 'bear_press',
    name: { en: 'Bear Press', es: 'Press de Oso' },
    aliases: ['Bear Press', 'Press de Oso', 'Sots Press', 'Press Sots', 'Kettlebell Bear Press', 'Press de Oso con Kettlebell'],
    level: 'expert',
    category: 'strength',
    pm: ['shoulders'], sm: ['triceps', 'upper_traps', 'quadriceps', 'abs'],
    movementPattern: ['vertical_push'], forceType: ['push'], mechanic: ['compound'],
    laterality: ['bilateral'], equipment: ['kettlebell'],
    instr: {
      en: [
        '1) Hold a kettlebell in each hand in the front rack position, resting against your shoulders. Set your feet slightly wider than shoulder-width with your toes turned out a little.',
        '2) Sit your hips straight down into a deep squat, keeping your chest tall, spine long and heels flat on the floor. Stay at the bottom of the squat. This is your starting position.',
        '3) Without standing up, press both kettlebells straight overhead until your arms are fully extended, keeping your torso upright.',
        '4) Lower the kettlebells back to the rack under control, still holding the deep squat. Repeat for the recommended repetitions, then stand up.',
      ],
      es: [
        '1) Sujeta una kettlebell en cada mano en posición de rack frontal, apoyadas contra los hombros. Coloca los pies algo más anchos que los hombros con las puntas ligeramente hacia fuera.',
        '2) Baja la cadera recta hacia abajo a una sentadilla profunda, manteniendo el pecho alto, la columna larga y los talones apoyados en el suelo. Quédate en el fondo de la sentadilla. Esta es tu posición de partida.',
        '3) Sin levantarte, empuja ambas kettlebells por encima de la cabeza hasta estirar del todo los brazos, manteniendo el torso erguido.',
        '4) Baja las kettlebells al rack con control, sin salir de la sentadilla profunda. Repite las repeticiones indicadas y después incorpórate.',
      ],
    },
  },
  {
    slug: 'hypopressive',
    name: { en: 'Hypopressive Abdominals', es: 'Abdominales Hipopresivos' },
    aliases: ['Hypopressive Abdominals', 'Abdominales Hipopresivos', 'Hipopresivo', 'Hypopressive', 'Low Pressure Fitness', 'Gimnasia Abdominal Hipopresiva'],
    level: 'intermediate',
    category: 'strength',
    pm: ['transverse'], sm: ['obliques', 'serratus', 'abs'],
    movementPattern: ['isolation'], forceType: ['isometric'], mechanic: ['isolation'],
    laterality: ['bilateral'], equipment: ['bodyweight'],
    instr: {
      en: [
        '1) Stand tall with your feet hip-width apart, knees slightly bent and your weight shifted slightly forward. Lengthen your spine and gently draw your chin back. This is your starting position.',
        '2) Breathe in slowly and fully through your nose, then exhale all the air out through your mouth until your lungs feel empty.',
        '3) Holding your breath with empty lungs, open your ribs as if you were going to inhale but without letting air in. This suction naturally draws your belly and pelvic floor up and in.',
        '4) Hold the rib opening and abdominal suction for about 10 seconds, then release, breathe normally, and recover before the next repetition.',
      ],
      es: [
        '1) Ponte de pie con los pies a la anchura de las caderas, las rodillas ligeramente flexionadas y el peso algo adelantado. Alarga la columna y lleva suavemente el mentón hacia atrás. Esta es tu posición de partida.',
        '2) Inspira despacio y por completo por la nariz y después expulsa todo el aire por la boca hasta vaciar los pulmones.',
        '3) Manteniendo la apnea con los pulmones vacíos, abre las costillas como si fueras a inspirar pero sin dejar entrar aire. Esa succión eleva de forma natural el abdomen y el suelo pélvico hacia dentro y hacia arriba.',
        '4) Mantén la apertura costal y la succión abdominal unos 10 segundos, luego relaja, respira con normalidad y recupérate antes de la siguiente repetición.',
      ],
    },
  },
  {
    slug: 'cable_face_pull',
    name: { en: 'Cable Face Pull', es: 'Face Pull en Polea' },
    aliases: ['Cable Face Pull', 'Face Pull en Polea', 'Face Pull con Cable', 'Rope Face Pull', 'Jalón a la Cara en Polea'],
    level: 'beginner',
    category: 'strength',
    pm: ['rear_delts'], sm: ['mid_traps', 'rhomboids', 'rotator_cuff'],
    movementPattern: ['horizontal_pull'], forceType: ['pull'], mechanic: ['isolation'],
    laterality: ['bilateral'], equipment: ['cable'],
    instr: {
      en: [
        '1) Attach a rope to a cable pulley set at about face height. Grab an end in each hand with a neutral grip and step back until the cable is taut, arms extended. This is your starting position.',
        '2) Keeping your torso upright and core braced, pull the rope toward your face by driving your elbows high and out to the sides.',
        '3) As you pull, separate your hands and rotate them back so the rope ends pass beside your ears, squeezing your rear delts and upper back.',
        '4) Extend your arms to return the weight under control without letting your shoulders roll forward. Repeat for the recommended repetitions.',
      ],
      es: [
        '1) Engancha una cuerda a una polea a la altura de la cara aproximadamente. Coge un extremo con cada mano en agarre neutro y retrocede hasta tensar el cable, con los brazos estirados. Esta es tu posición de partida.',
        '2) Manteniendo el torso erguido y el core firme, tira de la cuerda hacia la cara llevando los codos altos y abiertos hacia los lados.',
        '3) Mientras tiras, separa las manos y gíralas hacia atrás para que los extremos de la cuerda pasen junto a las orejas, apretando los deltoides posteriores y la espalda alta.',
        '4) Estira los brazos para devolver el peso con control sin dejar que los hombros se vayan hacia delante. Repite las repeticiones indicadas.',
      ],
    },
  },
  {
    slug: 'farmers_carry',
    name: { en: "Farmer's Carry", es: 'Paseo del Granjero' },
    aliases: ["Farmer's Carry", 'Paseo del Granjero', 'Farmer Carry', 'Farmer Walk', 'Transporte del Granjero', 'Caminata del Granjero'],
    level: 'beginner',
    category: 'strength',
    pm: ['grip'], sm: ['forearm_flexors', 'upper_traps', 'abs'],
    movementPattern: ['carry'], forceType: ['isometric'], mechanic: ['compound'],
    laterality: ['bilateral'], equipment: ['dumbbell'],
    instr: {
      en: [
        '1) Place a heavy dumbbell on each side of your feet. Hinge at the hips with a flat back and grab one in each hand.',
        '2) Stand up tall with the dumbbells at your sides, shoulders pulled back, chest up and core braced. This is your starting position.',
        '3) Walk forward with short, controlled steps, keeping your torso upright and the dumbbells from swinging.',
        '4) Cover the recommended distance or time, then hinge at the hips to set the dumbbells down under control.',
      ],
      es: [
        '1) Coloca una mancuerna pesada a cada lado de los pies. Flexiona la cadera con la espalda recta y coge una con cada mano.',
        '2) Incorpórate del todo con las mancuernas a los costados, los hombros atrás, el pecho alto y el core firme. Esta es tu posición de partida.',
        '3) Camina hacia delante con pasos cortos y controlados, manteniendo el torso erguido y evitando que las mancuernas se balanceen.',
        '4) Recorre la distancia o el tiempo indicados y después flexiona la cadera para dejar las mancuernas en el suelo con control.',
      ],
    },
  },
  {
    slug: 'nordic_curl',
    name: { en: 'Nordic Hamstring Curl', es: 'Curl Nórdico' },
    aliases: ['Nordic Hamstring Curl', 'Curl Nórdico', 'Nordic Curl', 'Curl Nórdico de Isquiotibiales', 'Russian Curl', 'Curl Ruso'],
    level: 'expert',
    category: 'strength',
    pm: ['hamstrings'], sm: ['glutes', 'calves', 'lower_back'],
    movementPattern: ['isolation'], forceType: ['pull'], mechanic: ['isolation'],
    laterality: ['bilateral'], equipment: ['bodyweight'],
    instr: {
      en: [
        '1) Kneel on a pad with your torso upright and have a partner hold your ankles firmly, or anchor your heels under a fixed support.',
        '2) Brace your core and squeeze your glutes so your body forms a straight line from knees to head. This is your starting position.',
        '3) Keeping your hips extended, lower your torso toward the floor as slowly as you can, resisting with your hamstrings the whole way down.',
        '4) When you can no longer control the descent, catch yourself with your hands, then push off just enough to help your hamstrings pull you back to the start. Repeat for the recommended repetitions.',
      ],
      es: [
        '1) Arrodíllate sobre una colchoneta con el torso erguido y pide a un compañero que te sujete firmemente los tobillos, o fija los talones bajo un apoyo estable.',
        '2) Activa el core y aprieta los glúteos para que el cuerpo forme una línea recta de las rodillas a la cabeza. Esta es tu posición de partida.',
        '3) Manteniendo la cadera extendida, baja el torso hacia el suelo lo más despacio posible, resistiendo con los isquiotibiales durante todo el descenso.',
        '4) Cuando ya no puedas controlar la bajada, amortigua con las manos y después empuja lo justo para ayudar a los isquiotibiales a subir de nuevo al inicio. Repite las repeticiones indicadas.',
      ],
    },
  },
  {
    slug: 'turkish_get_up',
    name: { en: 'Turkish Get-Up', es: 'Levantada Turca' },
    aliases: ['Turkish Get-Up', 'Levantada Turca', 'TGU', 'Get-Up', 'Levantamiento Turco', 'Turkish Get Up con Kettlebell'],
    level: 'expert',
    category: 'strength',
    pm: ['shoulders'], sm: ['abs', 'obliques', 'glutes', 'quadriceps'],
    movementPattern: ['lunge', 'vertical_push'], forceType: ['mixed'], mechanic: ['compound'],
    laterality: ['unilateral'], equipment: ['kettlebell'],
    instr: {
      en: [
        '1) Lie on your back and press a kettlebell straight up with one arm, that same-side knee bent and foot flat. Keep your eyes on the bell and your other arm out on the floor. This is your starting position.',
        '2) Roll onto your free forearm and then your hand, sit up tall, and drive through your bent leg to lift your hips off the floor.',
        '3) Sweep your straight leg back into a kneeling lunge, come upright, then stand up fully, keeping the kettlebell locked out overhead the whole time.',
        '4) Reverse each step precisely to return to the floor, keeping your arm vertical. Complete the recommended repetitions, then switch sides.',
      ],
      es: [
        '1) Túmbate boca arriba y empuja una kettlebell recta hacia arriba con un brazo, con la rodilla del mismo lado flexionada y el pie apoyado. Mantén la mirada en la kettlebell y el otro brazo extendido en el suelo. Esta es tu posición de partida.',
        '2) Gira sobre el antebrazo libre y luego sobre la mano, siéntate erguido y empuja con la pierna flexionada para elevar la cadera del suelo.',
        '3) Lleva la pierna estirada hacia atrás a una posición de zancada arrodillada, ponte erguido y después incorpórate del todo, manteniendo la kettlebell bloqueada por encima de la cabeza todo el tiempo.',
        '4) Deshaz cada paso con precisión para volver al suelo, manteniendo el brazo vertical. Completa las repeticiones indicadas y cambia de lado.',
      ],
    },
  },
  {
    slug: 'landmine_press',
    name: { en: 'Landmine Press', es: 'Press con Landmine' },
    aliases: ['Landmine Press', 'Press con Landmine', 'Press de Hombro con Landmine', 'Half-Kneeling Landmine Press', 'Standing Landmine Press'],
    level: 'intermediate',
    category: 'strength',
    pm: ['shoulders'], sm: ['triceps', 'upper_chest', 'serratus', 'abs'],
    movementPattern: ['vertical_push'], forceType: ['push'], mechanic: ['compound'],
    laterality: ['unilateral'], equipment: ['landmine'],
    instr: {
      en: [
        '1) Load one end of a barbell into a landmine anchor. Stand facing the anchor and clean the free end up to the front of one shoulder, holding it with that hand. This is your starting position.',
        '2) Set your feet shoulder-width apart, brace your core and keep your chest up with a slight forward lean into the bar.',
        '3) Press the bar up and forward until your arm is fully extended, following the natural arc of the landmine.',
        '4) Lower the bar back to your shoulder under control without letting your torso twist. Repeat for the recommended repetitions, then switch sides.',
      ],
      es: [
        '1) Introduce un extremo de una barra en un anclaje landmine. Colócate de frente al anclaje y sube el extremo libre hasta el frente de un hombro, sujetándolo con esa mano. Esta es tu posición de partida.',
        '2) Coloca los pies a la anchura de los hombros, activa el core y mantén el pecho alto con una ligera inclinación hacia la barra.',
        '3) Empuja la barra hacia arriba y adelante hasta estirar del todo el brazo, siguiendo el arco natural del landmine.',
        '4) Baja la barra al hombro con control sin dejar que el torso rote. Repite las repeticiones indicadas y cambia de lado.',
      ],
    },
  },
  {
    slug: 'dumbbell_romanian_deadlift',
    name: { en: 'Dumbbell Romanian Deadlift', es: 'Peso Muerto Rumano con Mancuernas' },
    aliases: ['Dumbbell Romanian Deadlift', 'Peso Muerto Rumano con Mancuernas', 'DB RDL', 'Romanian Deadlift con Mancuernas', 'Peso Muerto Rumano', 'RDL con Mancuernas'],
    level: 'beginner',
    category: 'strength',
    pm: ['hamstrings'], sm: ['glutes', 'lower_back', 'forearm_flexors'],
    movementPattern: ['hinge'], forceType: ['pull'], mechanic: ['compound'],
    laterality: ['bilateral'], equipment: ['dumbbell'],
    instr: {
      en: [
        '1) Stand tall with a dumbbell in each hand in front of your thighs, palms facing you, feet hip-width apart and knees softly bent. This is your starting position.',
        '2) Keeping your back flat and chest up, push your hips back and hinge forward, letting the dumbbells slide down close to your legs.',
        '3) Lower until you feel a stretch in your hamstrings, keeping your spine neutral and the dumbbells near your shins.',
        '4) Drive your hips forward to stand back up, squeezing your glutes at the top. Repeat for the recommended repetitions.',
      ],
      es: [
        '1) Ponte de pie con una mancuerna en cada mano frente a los muslos, con las palmas hacia ti, los pies a la anchura de las caderas y las rodillas ligeramente flexionadas. Esta es tu posición de partida.',
        '2) Manteniendo la espalda recta y el pecho alto, lleva la cadera hacia atrás y flexiona el tronco hacia delante, dejando que las mancuernas se deslicen pegadas a las piernas.',
        '3) Baja hasta notar un estiramiento en los isquiotibiales, manteniendo la columna neutra y las mancuernas cerca de las espinillas.',
        '4) Empuja la cadera hacia delante para incorporarte, apretando los glúteos arriba. Repite las repeticiones indicadas.',
      ],
    },
  },
  {
    slug: 'jefferson_curl',
    name: { en: 'Jefferson Curl', es: 'Jefferson Curl' },
    aliases: ['Jefferson Curl', 'Curl Jefferson', 'Jefferson Curl con Mancuerna', 'Spinal Flexion Curl', 'Enrollamiento Jefferson'],
    level: 'intermediate',
    category: 'stretching',
    pm: ['lower_back'], sm: ['hamstrings', 'glutes', 'abs'],
    movementPattern: ['hinge'], forceType: ['pull'], mechanic: ['isolation'],
    laterality: ['bilateral'], equipment: ['dumbbell'],
    instr: {
      en: [
        '1) Stand on a low box or bench holding a light dumbbell with both hands, arms hanging in front of you and feet together with legs straight. This is your starting position.',
        '2) Tuck your chin and slowly roll your spine down one vertebra at a time, letting the dumbbell hang toward your feet.',
        '3) Keep your legs as straight as comfortable and continue rounding forward until you feel a deep stretch along your spine and hamstrings.',
        '4) Reverse the movement by restacking your spine from the bottom up until you are standing tall again. Repeat for the recommended repetitions with light, controlled loads only.',
      ],
      es: [
        '1) Ponte de pie sobre un cajón o banco bajo sujetando una mancuerna ligera con ambas manos, los brazos colgando al frente y los pies juntos con las piernas estiradas. Esta es tu posición de partida.',
        '2) Mete el mentón y enrolla la columna despacio, vértebra a vértebra, dejando que la mancuerna caiga hacia los pies.',
        '3) Mantén las piernas lo más estiradas que te resulte cómodo y sigue redondeando hacia delante hasta notar un estiramiento profundo en la columna y los isquiotibiales.',
        '4) Deshaz el movimiento recolocando la columna de abajo hacia arriba hasta quedar erguido de nuevo. Repite las repeticiones indicadas usando siempre cargas ligeras y controladas.',
      ],
    },
  },
  {
    slug: 'kettlebell_clean_and_press',
    name: { en: 'Kettlebell Clean and Press', es: 'Clean and Press con Kettlebell' },
    aliases: ['Kettlebell Clean and Press', 'Clean and Press con Kettlebell', 'Cargada y Press con Kettlebell', 'KB Clean and Press', 'Clean & Press con Kettlebell'],
    level: 'intermediate',
    category: 'strength',
    pm: ['shoulders'], sm: ['glutes', 'hamstrings', 'traps', 'triceps', 'quadriceps'],
    movementPattern: ['hinge', 'vertical_push'], forceType: ['mixed'], mechanic: ['compound'],
    laterality: ['unilateral'], equipment: ['kettlebell'],
    instr: {
      en: [
        '1) Place a kettlebell on the floor between your feet, which are about shoulder-width apart. Hinge at the hips with a flat back and grip the handle with one hand. This is your starting position.',
        '2) Drive through your hips and legs to pull the kettlebell up close to your body, guiding it around your wrist to land softly in the front rack against your shoulder.',
        '3) With the kettlebell racked and your core braced, press it straight overhead until your arm is fully extended.',
        '4) Lower the kettlebell back to the rack, then hinge to return it to the floor. Repeat for the recommended repetitions, then switch sides.',
      ],
      es: [
        '1) Coloca una kettlebell en el suelo entre los pies, que estarán a la anchura de los hombros. Flexiona la cadera con la espalda recta y agarra el asa con una mano. Esta es tu posición de partida.',
        '2) Empuja con caderas y piernas para tirar de la kettlebell pegada al cuerpo, guiándola alrededor de la muñeca para recibirla suavemente en el rack frontal contra el hombro.',
        '3) Con la kettlebell en el rack y el core firme, empújala recta por encima de la cabeza hasta estirar del todo el brazo.',
        '4) Baja la kettlebell al rack y luego flexiona la cadera para devolverla al suelo. Repite las repeticiones indicadas y cambia de lado.',
      ],
    },
  },
];

function buildExercise(def) {
  const identityKey = identityKeyForSlug(def.slug);
  return {
    priority: false,
    id: idForIdentityKey(identityKey),
    cdnslug: def.slug,
    name: def.name.en,
    force: def.forceType[0],
    level: def.level,
    mechanic: def.mechanic[0],
    equipment: def.equipment[0],
    primaryMuscles: def.pm,
    secondaryMuscles: def.sm,
    instructions: def.instr.en,
    category: def.category,
    images: [],
    isActive: true,
    i18n: {
      name: { en: def.name.en, es: def.name.es },
      instructions: { en: def.instr.en, es: def.instr.es },
    },
    classification: {
      primaryMuscles: def.pm,
      secondaryMuscles: def.sm,
      movementPattern: def.movementPattern,
      forceType: def.forceType,
      mechanic: def.mechanic,
      laterality: def.laterality,
      equipment: def.equipment,
    },
    media: [],
    aliases: def.aliases,
    metadata: {
      defaultVideoInvalid: false,
      defaultVideoInvalidAt: null,
      identityKey,
      batch: BATCH,
    },
  };
}

const existing = fs.readFileSync(DATA, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
const existingSlugs = new Set(existing.map((e) => e.cdnslug));

const toAdd = DEFS.filter((d) => !existingSlugs.has(d.slug));
const skipped = DEFS.filter((d) => existingSlugs.has(d.slug));

console.log(`Definiciones: ${DEFS.length}`);
console.log(`Ya existen (saltadas): ${skipped.length}${skipped.length ? ' -> ' + skipped.map((s) => s.slug).join(', ') : ''}`);
console.log(`Nuevas a anadir: ${toAdd.length}`);
toAdd.forEach((d) => console.log(`  + ${d.slug}`));

if (!toAdd.length) {
  console.log('Nada que anadir.');
  process.exit(0);
}

if (DRY) {
  console.log('\n--dry-run: no se escribe nada.');
  process.exit(0);
}

const lines = toAdd.map((d) => JSON.stringify(buildExercise(d)));
fs.appendFileSync(DATA, lines.join('\n') + '\n');
console.log(`\nAnadidas ${toAdd.length} entradas a ${path.relative(process.cwd(), DATA)}`);
