// Seed del lote 2026-06-26: ejercicios pedidos manualmente.
// Mismo contrato y mecanica que seed-demand-exercises.mjs: crea SOLO las entradas
// que no existan ya (idempotente por cdnslug). Se crean SIN media: la referencia
// de video y la generacion del clip default se hacen despues con el pipeline de
// video (ver README "Ark Style Tasks"). Se marcan con metadata.batch para poder
// filtrarlas en el editor ("Lote 2026-06-26"); ese campo se descarta en
// build:public (no llega a MongoDB).
//
//   node seed-batch-2026-06-26.mjs            # aplica los cambios
//   node seed-batch-2026-06-26.mjs --dry-run  # solo informa

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { identityKeyForSlug, idForIdentityKey } from './exercise-ids.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, 'data', 'exercises.ndjson');
const DRY = process.argv.includes('--dry-run');
const BATCH = '2026-06-26';

const DEFS = [
  {
    slug: 'australian_pull_up',
    name: { en: 'Australian Pull-Up', es: 'Dominada Australiana' },
    aliases: ['Australian Pull-Up', 'Dominada Australiana', 'Inverted Row', 'Bodyweight Row', 'Remo Invertido', 'Remo Australiano'],
    level: 'beginner',
    category: 'strength',
    pm: ['lats'], sm: ['rhomboids', 'biceps', 'rear_delts'],
    movementPattern: ['horizontal_pull'], forceType: ['pull'], mechanic: ['compound'],
    laterality: ['bilateral'], equipment: ['pull_up_bar'],
    instr: {
      en: [
        '1) Set a bar at about waist height in a rack or Smith machine. Lie underneath it and grab it with an overhand grip slightly wider than shoulder-width.',
        '2) Hang from the bar with your arms straight, heels on the floor and your body in a straight line from head to heels. Brace your core and squeeze your glutes. This is your starting position.',
        '3) Pull your chest toward the bar by driving your elbows down and back, squeezing your shoulder blades together. Keep your body rigid throughout.',
        '4) Pause when your chest is close to the bar, then lower under control to full arm extension. Repeat for the recommended repetitions.',
      ],
      es: [
        '1) Coloca una barra a la altura de la cintura aproximadamente en un rack o máquina Smith. Túmbate debajo y agárrala en pronación, algo más ancho que los hombros.',
        '2) Cuélgate de la barra con los brazos estirados, los talones en el suelo y el cuerpo en línea recta de la cabeza a los pies. Activa el core y aprieta los glúteos. Esta es tu posición de partida.',
        '3) Lleva el pecho hacia la barra tirando con los codos hacia abajo y atrás, juntando las escápulas. Mantén el cuerpo rígido durante todo el movimiento.',
        '4) Haz una pausa cuando el pecho esté cerca de la barra y baja con control hasta estirar del todo los brazos. Repite las repeticiones indicadas.',
      ],
    },
  },
  {
    slug: 'trx_triceps_extension',
    name: { en: 'TRX Triceps Extension', es: 'Extensión de Tríceps en TRX' },
    aliases: ['TRX Triceps Extension', 'Extensión de Tríceps en TRX', 'Tríceps en TRX', 'TRX Triceps Press', 'Suspension Triceps Extension'],
    level: 'intermediate',
    category: 'strength',
    pm: ['triceps'], sm: ['shoulders', 'abs'],
    movementPattern: ['isolation'], forceType: ['push'], mechanic: ['isolation'],
    laterality: ['bilateral'], equipment: ['suspension'],
    instr: {
      en: [
        '1) Shorten the TRX straps and face away from the anchor point. Grab a handle in each hand and extend your arms straight out in front of you at head height, palms facing down.',
        '2) Lean forward onto the straps so your body is at an angle with your weight on your hands. Keep your core braced and your body in a straight line. This is your starting position.',
        '3) Bend only at the elbows to lower your head behind your hands, keeping your upper arms still and pointing forward.',
        '4) Press through the triceps to extend your elbows and return to the starting position. Repeat for the recommended repetitions. Walk your feet back to make it harder, forward to make it easier.',
      ],
      es: [
        '1) Acorta las cintas del TRX y colócate de espaldas al punto de anclaje. Agarra un mango en cada mano y extiende los brazos al frente a la altura de la cabeza, con las palmas hacia abajo.',
        '2) Inclínate hacia delante apoyándote en las cintas, con el cuerpo en ángulo y el peso sobre las manos. Mantén el core firme y el cuerpo en línea recta. Esta es tu posición de partida.',
        '3) Flexiona solo los codos para bajar la cabeza por detrás de las manos, manteniendo los brazos quietos y apuntando hacia delante.',
        '4) Empuja con los tríceps para estirar los codos y volver a la posición de partida. Repite las repeticiones indicadas. Retrasa los pies para hacerlo más difícil o adelántalos para hacerlo más fácil.',
      ],
    },
  },
  {
    slug: 'dumbbell_snatch',
    name: { en: 'Dumbbell Snatch', es: 'Arrancada con Mancuerna' },
    aliases: ['Dumbbell Snatch', 'Arrancada con Mancuerna', 'Arrancadas con Mancuernas', 'Single Arm Dumbbell Snatch', 'DB Snatch', 'Snatch con Mancuerna'],
    level: 'intermediate',
    category: 'strength',
    pm: ['shoulders'], sm: ['glutes', 'hamstrings', 'traps', 'quadriceps'],
    movementPattern: ['hinge', 'vertical_push'], forceType: ['mixed'], mechanic: ['compound'],
    laterality: ['unilateral'], equipment: ['dumbbell'],
    instr: {
      en: [
        '1) Place a dumbbell on the floor between your feet, which are about shoulder-width apart. Hinge at the hips and bend the knees to grab it with one hand, keeping your back flat and chest up. This is your starting position.',
        '2) Drive explosively through your legs and hips to extend your body, pulling the dumbbell straight up close to your torso as you generate power from the floor.',
        '3) As the dumbbell reaches chest height, flip your wrist and punch your hand up to catch it overhead with a locked-out arm, dropping slightly into a quarter squat.',
        '4) Stand fully upright with the dumbbell stable overhead, then lower it under control back to the floor. Repeat for the recommended repetitions, then switch sides.',
      ],
      es: [
        '1) Coloca una mancuerna en el suelo entre los pies, que estarán a la anchura de los hombros. Flexiona caderas y rodillas para cogerla con una mano, manteniendo la espalda recta y el pecho alto. Esta es tu posición de partida.',
        '2) Empuja de forma explosiva con piernas y caderas para extender el cuerpo, tirando de la mancuerna hacia arriba pegada al torso mientras generas potencia desde el suelo.',
        '3) Cuando la mancuerna llegue a la altura del pecho, gira la muñeca y empuja la mano hacia arriba para recibirla por encima de la cabeza con el brazo bloqueado, bajando ligeramente a una media sentadilla.',
        '4) Incorpórate del todo con la mancuerna estable sobre la cabeza y bájala con control hasta el suelo. Repite las repeticiones indicadas y cambia de lado.',
      ],
    },
  },

  // --- 10 básicos de TRX (suspensión) ---
  {
    slug: 'trx_squats',
    name: { en: 'TRX Squat', es: 'Sentadilla en TRX' },
    aliases: ['TRX Squat', 'Sentadilla en TRX', 'TRX Squats', 'Sentadillas en TRX', 'Suspension Squat'],
    level: 'beginner',
    category: 'strength',
    pm: ['quadriceps'], sm: ['glutes', 'hamstrings'],
    movementPattern: ['squat'], forceType: ['push'], mechanic: ['compound'],
    laterality: ['bilateral'], equipment: ['suspension'],
    instr: {
      en: [
        '1) Face the anchor and hold a handle in each hand at chest height, arms bent and feet shoulder-width apart. Lean back slightly so the straps are taut. This is your starting position.',
        '2) Sit your hips back and down into a squat, keeping your chest up and your weight in your heels, letting the straps support your balance.',
        '3) Lower until your thighs are about parallel to the floor, with your knees tracking over your toes.',
        '4) Drive through your heels to stand back up, squeezing your glutes at the top. Repeat for the recommended repetitions.',
      ],
      es: [
        '1) Colócate de frente al anclaje y sujeta un mango en cada mano a la altura del pecho, con los brazos flexionados y los pies a la anchura de los hombros. Inclínate ligeramente hacia atrás para tensar las cintas. Esta es tu posición de partida.',
        '2) Lleva la cadera atrás y abajo a una sentadilla, manteniendo el pecho alto y el peso en los talones, dejando que las cintas te ayuden con el equilibrio.',
        '3) Baja hasta que los muslos queden más o menos paralelos al suelo, con las rodillas alineadas sobre los pies.',
        '4) Empuja con los talones para incorporarte, apretando los glúteos arriba. Repite las repeticiones indicadas.',
      ],
    },
  },
  {
    slug: 'trx_reverse_lunge',
    name: { en: 'TRX Reverse Lunge', es: 'Zancada Inversa en TRX' },
    aliases: ['TRX Reverse Lunge', 'Zancada Inversa en TRX', 'TRX Lunge', 'Zancada en TRX', 'Suspension Reverse Lunge'],
    level: 'beginner',
    category: 'strength',
    pm: ['quadriceps'], sm: ['glutes', 'hamstrings'],
    movementPattern: ['lunge'], forceType: ['push'], mechanic: ['compound'],
    laterality: ['unilateral'], equipment: ['suspension'],
    instr: {
      en: [
        '1) Face the anchor and hold a handle in each hand at chest height, standing tall on both feet. This is your starting position.',
        '2) Step one foot back and lower into a lunge, bending both knees until the front thigh is about parallel to the floor and the back knee hovers just above the ground.',
        '3) Keep your torso upright and use the straps lightly for balance, not to pull yourself up.',
        '4) Drive through the front heel to return to standing. Repeat for the recommended repetitions, then switch legs.',
      ],
      es: [
        '1) Colócate de frente al anclaje y sujeta un mango en cada mano a la altura del pecho, de pie sobre ambos pies. Esta es tu posición de partida.',
        '2) Da un paso atrás con un pie y baja a una zancada, flexionando ambas rodillas hasta que el muslo adelantado quede casi paralelo al suelo y la rodilla de atrás quede justo encima del suelo.',
        '3) Mantén el torso erguido y usa las cintas solo para equilibrarte, no para tirar de ti.',
        '4) Empuja con el talón adelantado para volver de pie. Repite las repeticiones indicadas y cambia de pierna.',
      ],
    },
  },
  {
    slug: 'trx_hamstring_curl',
    name: { en: 'TRX Hamstring Curl', es: 'Curl de Isquios en TRX' },
    aliases: ['TRX Hamstring Curl', 'Curl de Isquios en TRX', 'TRX Leg Curl', 'Curl Femoral en TRX', 'Suspension Hamstring Curl'],
    level: 'intermediate',
    category: 'strength',
    pm: ['hamstrings'], sm: ['glutes', 'calves'],
    movementPattern: ['isolation'], forceType: ['pull'], mechanic: ['isolation'],
    laterality: ['bilateral'], equipment: ['suspension'],
    instr: {
      en: [
        '1) Lie on your back with the straps shortened and place your heels into the foot cradles, legs straight and hips on the floor.',
        '2) Lift your hips off the floor so your body forms a straight line from shoulders to heels. This is your starting position.',
        '3) Bend your knees to pull your heels toward your glutes, keeping your hips high throughout.',
        '4) Slowly straighten your legs back to the start without letting your hips drop. Repeat for the recommended repetitions.',
      ],
      es: [
        '1) Túmbate boca arriba con las cintas acortadas y coloca los talones en los estribos, con las piernas estiradas y la cadera en el suelo.',
        '2) Eleva la cadera del suelo hasta que el cuerpo forme una línea recta de los hombros a los talones. Esta es tu posición de partida.',
        '3) Flexiona las rodillas para llevar los talones hacia los glúteos, manteniendo la cadera alta en todo momento.',
        '4) Estira las piernas despacio para volver al inicio sin dejar caer la cadera. Repite las repeticiones indicadas.',
      ],
    },
  },
  {
    slug: 'trx_hip_press',
    name: { en: 'TRX Hip Press', es: 'Puente de Glúteos en TRX' },
    aliases: ['TRX Hip Press', 'Puente de Glúteos en TRX', 'TRX Glute Bridge', 'Hip Bridge en TRX', 'Suspension Hip Press'],
    level: 'beginner',
    category: 'strength',
    pm: ['glutes'], sm: ['hamstrings', 'lower_back'],
    movementPattern: ['hinge'], forceType: ['pull'], mechanic: ['compound'],
    laterality: ['bilateral'], equipment: ['suspension'],
    instr: {
      en: [
        '1) Lie on your back with your heels resting in the foot cradles, legs bent and arms by your sides.',
        '2) Press your heels down into the cradles and brace your core. This is your starting position.',
        '3) Drive your hips up toward the ceiling by squeezing your glutes until your body forms a straight line from knees to shoulders.',
        '4) Pause at the top, then lower your hips under control. Repeat for the recommended repetitions.',
      ],
      es: [
        '1) Túmbate boca arriba con los talones apoyados en los estribos, las piernas flexionadas y los brazos a los lados.',
        '2) Presiona los talones contra los estribos y activa el core. Esta es tu posición de partida.',
        '3) Eleva la cadera hacia el techo apretando los glúteos hasta que el cuerpo forme una línea recta de las rodillas a los hombros.',
        '4) Haz una pausa arriba y baja la cadera con control. Repite las repeticiones indicadas.',
      ],
    },
  },
  {
    slug: 'trx_bicep_curl',
    name: { en: 'TRX Bicep Curl', es: 'Curl de Bíceps en TRX' },
    aliases: ['TRX Bicep Curl', 'Curl de Bíceps en TRX', 'TRX Biceps Curl', 'Bíceps en TRX', 'Suspension Bicep Curl'],
    level: 'beginner',
    category: 'strength',
    pm: ['biceps'], sm: ['forearm_flexors', 'shoulders'],
    movementPattern: ['isolation'], forceType: ['pull'], mechanic: ['isolation'],
    laterality: ['bilateral'], equipment: ['suspension'],
    instr: {
      en: [
        '1) Face the anchor and hold a handle in each hand with palms facing up and arms extended. Lean back with your body straight and heels on the floor. This is your starting position.',
        '2) Keeping your elbows high and fixed in place, curl your body up by bending only at the elbows, bringing your hands toward your forehead.',
        '3) Squeeze your biceps at the top without letting your elbows drop.',
        '4) Slowly extend your arms to lower back to the start. Repeat for the recommended repetitions. Walk your feet forward to make it harder.',
      ],
      es: [
        '1) Colócate de frente al anclaje y sujeta un mango en cada mano con las palmas hacia arriba y los brazos estirados. Inclínate hacia atrás con el cuerpo recto y los talones en el suelo. Esta es tu posición de partida.',
        '2) Manteniendo los codos altos y fijos, sube el cuerpo flexionando solo los codos y llevando las manos hacia la frente.',
        '3) Aprieta los bíceps arriba sin dejar caer los codos.',
        '4) Estira los brazos despacio para volver al inicio. Repite las repeticiones indicadas. Adelanta los pies para hacerlo más difícil.',
      ],
    },
  },
  {
    slug: 'trx_single_arm_row',
    name: { en: 'TRX Single-Arm Row', es: 'Remo a Una Mano en TRX' },
    aliases: ['TRX Single-Arm Row', 'Remo a Una Mano en TRX', 'TRX Single Arm Row', 'Remo Unilateral en TRX', 'Suspension Single Arm Row'],
    level: 'intermediate',
    category: 'strength',
    pm: ['lats'], sm: ['rhomboids', 'biceps', 'rear_delts'],
    movementPattern: ['horizontal_pull'], forceType: ['pull'], mechanic: ['compound'],
    laterality: ['unilateral'], equipment: ['suspension'],
    instr: {
      en: [
        '1) Hold one handle with a single hand and face the anchor. Walk your feet forward and lean back with your arm extended, body straight from head to heels. This is your starting position.',
        '2) Brace your core to resist rotation, keeping your hips and shoulders square to the floor.',
        '3) Pull your chest up toward the hand by driving your elbow back and squeezing your shoulder blade.',
        '4) Lower under control to full arm extension. Repeat for the recommended repetitions, then switch sides.',
      ],
      es: [
        '1) Sujeta un mango con una sola mano de frente al anclaje. Adelanta los pies e inclínate hacia atrás con el brazo estirado y el cuerpo recto de la cabeza a los talones. Esta es tu posición de partida.',
        '2) Activa el core para resistir la rotación, manteniendo caderas y hombros paralelos al suelo.',
        '3) Lleva el pecho hacia la mano tirando del codo hacia atrás y juntando la escápula.',
        '4) Baja con control hasta estirar el brazo del todo. Repite las repeticiones indicadas y cambia de lado.',
      ],
    },
  },
  {
    slug: 'trx_y_raise',
    name: { en: 'TRX Y Raise', es: 'Elevación en Y en TRX' },
    aliases: ['TRX Y Raise', 'Elevación en Y en TRX', 'TRX Y Fly', 'Vuelo en Y en TRX', 'Suspension Y Raise'],
    level: 'intermediate',
    category: 'strength',
    pm: ['shoulders'], sm: ['lower_traps', 'rear_delts'],
    movementPattern: ['vertical_pull'], forceType: ['pull'], mechanic: ['isolation'],
    laterality: ['bilateral'], equipment: ['suspension'],
    instr: {
      en: [
        '1) Face the anchor and hold a handle in each hand, arms extended overhead in a Y shape with palms facing in. Lean back with your body straight and heels on the floor. This is your starting position.',
        '2) Keeping your arms straight, pull your body up by raising your hands up and out, forming a wide Y above your head.',
        '3) Squeeze your shoulder blades and lower traps at the top, keeping your core tight.',
        '4) Lower slowly back to the start without arching your lower back. Repeat for the recommended repetitions.',
      ],
      es: [
        '1) Colócate de frente al anclaje y sujeta un mango en cada mano, con los brazos estirados por encima de la cabeza en forma de Y y las palmas mirándose. Inclínate hacia atrás con el cuerpo recto y los talones en el suelo. Esta es tu posición de partida.',
        '2) Con los brazos estirados, sube el cuerpo elevando las manos hacia arriba y afuera, formando una Y amplia sobre la cabeza.',
        '3) Aprieta las escápulas y el trapecio inferior arriba, manteniendo el core firme.',
        '4) Baja despacio al inicio sin arquear la zona lumbar. Repite las repeticiones indicadas.',
      ],
    },
  },
  {
    slug: 'trx_face_pull',
    name: { en: 'TRX Face Pull', es: 'Face Pull en TRX' },
    aliases: ['TRX Face Pull', 'Face Pull en TRX', 'Jalón a la Cara en TRX', 'TRX Reverse Fly', 'Suspension Face Pull'],
    level: 'beginner',
    category: 'strength',
    pm: ['rear_delts'], sm: ['mid_traps', 'rhomboids'],
    movementPattern: ['horizontal_pull'], forceType: ['pull'], mechanic: ['isolation'],
    laterality: ['bilateral'], equipment: ['suspension'],
    instr: {
      en: [
        '1) Face the anchor and hold a handle in each hand at eye level with palms facing down. Lean back with your body straight and heels on the floor. This is your starting position.',
        '2) Keeping your upper arms high, pull your body up by drawing the handles toward your face, splitting your hands apart as you go.',
        '3) Squeeze your rear delts and upper back at the end of the pull, with your elbows wide.',
        '4) Extend your arms to lower back to the start under control. Repeat for the recommended repetitions.',
      ],
      es: [
        '1) Colócate de frente al anclaje y sujeta un mango en cada mano a la altura de los ojos, con las palmas hacia abajo. Inclínate hacia atrás con el cuerpo recto y los talones en el suelo. Esta es tu posición de partida.',
        '2) Manteniendo los brazos altos, sube el cuerpo llevando los mangos hacia la cara y separando las manos a la vez.',
        '3) Aprieta los deltoides posteriores y la espalda alta al final del tirón, con los codos abiertos.',
        '4) Estira los brazos para volver al inicio con control. Repite las repeticiones indicadas.',
      ],
    },
  },
  {
    slug: 'trx_plank',
    name: { en: 'TRX Plank', es: 'Plancha en TRX' },
    aliases: ['TRX Plank', 'Plancha en TRX', 'TRX Suspended Plank', 'Plancha Suspendida en TRX', 'Suspension Plank'],
    level: 'beginner',
    category: 'strength',
    pm: ['abs'], sm: ['transverse', 'shoulders'],
    movementPattern: ['anti_rotation'], forceType: ['isometric'], mechanic: ['isolation'],
    laterality: ['bilateral'], equipment: ['suspension'],
    instr: {
      en: [
        '1) Place both feet into the foot cradles and get onto your forearms in a face-down plank position, with the straps hanging below the anchor.',
        '2) Lift your hips so your body forms a straight line from head to heels, shoulders directly over your elbows. This is your starting position.',
        '3) Brace your core and squeeze your glutes, keeping your hips level and avoiding any sag or pike.',
        '4) Hold for the recommended time, breathing steadily. Lower your knees to rest.',
      ],
      es: [
        '1) Coloca ambos pies en los estribos y apóyate sobre los antebrazos en posición de plancha boca abajo, con las cintas colgando bajo el anclaje.',
        '2) Eleva la cadera hasta que el cuerpo forme una línea recta de la cabeza a los talones, con los hombros justo encima de los codos. Esta es tu posición de partida.',
        '3) Activa el core y aprieta los glúteos, manteniendo la cadera nivelada y sin dejarla caer ni elevarla.',
        '4) Aguanta el tiempo indicado respirando de forma constante. Baja las rodillas para descansar.',
      ],
    },
  },
  {
    slug: 'trx_pike',
    name: { en: 'TRX Pike', es: 'Pike en TRX' },
    aliases: ['TRX Pike', 'Pike en TRX', 'TRX Jackknife', 'Navaja en TRX', 'Suspension Pike'],
    level: 'intermediate',
    category: 'strength',
    pm: ['abs'], sm: ['hip_flexors', 'shoulders'],
    movementPattern: ['anti_rotation'], forceType: ['mixed'], mechanic: ['isolation'],
    laterality: ['bilateral'], equipment: ['suspension'],
    instr: {
      en: [
        '1) Place both feet into the foot cradles and get into a push-up plank with your hands under your shoulders and body in a straight line. This is your starting position.',
        '2) Keeping your legs straight, brace your core and lift your hips toward the ceiling, rolling the straps forward as your body folds into an inverted V.',
        '3) Bring your hips as high as you can over your shoulders, keeping your back flat.',
        '4) Lower your hips under control back to the plank without letting your lower back sag. Repeat for the recommended repetitions.',
      ],
      es: [
        '1) Coloca ambos pies en los estribos y ponte en posición de plancha de flexión con las manos bajo los hombros y el cuerpo en línea recta. Esta es tu posición de partida.',
        '2) Con las piernas estiradas, activa el core y eleva la cadera hacia el techo, dejando que las cintas rueden hacia delante mientras el cuerpo forma una V invertida.',
        '3) Lleva la cadera lo más alto posible por encima de los hombros, manteniendo la espalda recta.',
        '4) Baja la cadera con control hasta la plancha sin dejar caer la zona lumbar. Repite las repeticiones indicadas.',
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
