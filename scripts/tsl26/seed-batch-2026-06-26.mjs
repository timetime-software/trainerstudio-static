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
