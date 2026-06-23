// Seed de ejercicios pedidos por el equipo a partir de la demanda real de
// busquedas (10-may -> 22-jun 2026). Crea SOLO las entradas que no existian en
// el catalogo. Las entradas se crean sin media: la referencia de video
// (YouTube/source) y la generacion del clip default se hacen despues con el
// pipeline de video (ver README "Ark Style Tasks").
//
// Es idempotente: no duplica un cdnslug que ya este en data/exercises.ndjson.
//
//   node seed-demand-exercises.mjs            # aplica los cambios
//   node seed-demand-exercises.mjs --dry-run  # solo informa

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { identityKeyForSlug, idForIdentityKey } from './exercise-ids.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, 'data', 'exercises.ndjson');
const DRY = process.argv.includes('--dry-run');

// Cada definicion es minima: el resto del contrato se completa abajo.
// classification.* es el contrato canonico; los campos top-level se derivan de el.
const DEFS = [
  {
    slug: 'nordic_hamstring_curl',
    name: { en: 'Nordic Hamstring Curl', es: 'Curl Nordico de Isquios' },
    aliases: ['Nordic Curl', 'Curl Nordico', 'Curl Nordico de Isquios'],
    level: 'expert',
    category: 'strength',
    pm: ['hamstrings'], sm: ['glutes', 'calves'],
    movementPattern: ['isolation'], forceType: ['pull'], mechanic: ['isolation'],
    laterality: ['bilateral'], equipment: ['bodyweight'],
    instr: {
      en: [
        '1) Kneel upright on a pad with your ankles fixed under a sturdy anchor or held by a partner. Keep your hips, torso and head in a straight line.',
        '2) Brace your core and squeeze your glutes. Slowly lower your torso toward the floor, resisting with your hamstrings for as long as possible.',
        '3) When you can no longer control the descent, catch yourself with your hands in a push-up position.',
        '4) Push off the floor just enough to return to the start using your hamstrings, and repeat for the recommended repetitions.',
      ],
      es: [
        '1) Arrodillate erguido sobre una colchoneta con los tobillos fijados bajo un anclaje firme o sujetos por un companero. Manten caderas, torso y cabeza alineados.',
        '2) Activa el core y aprieta los gluteos. Baja el torso despacio hacia el suelo resistiendo con los isquiotibiales todo lo que puedas.',
        '3) Cuando ya no puedas controlar el descenso, amortigua la caida con las manos en posicion de flexion.',
        '4) Empuja del suelo lo justo para volver al inicio usando los isquiotibiales y repite las repeticiones indicadas.',
      ],
    },
  },
  {
    slug: 'hamstring_bridge',
    name: { en: 'Hamstring Bridge', es: 'Puente de Isquios' },
    aliases: ['Puente de Isquios', 'Hamstring Bridge', 'Long Lever Bridge'],
    level: 'beginner',
    category: 'strength',
    pm: ['hamstrings'], sm: ['glutes', 'lower_back'],
    movementPattern: ['hinge'], forceType: ['pull'], mechanic: ['compound'],
    laterality: ['bilateral'], equipment: ['bodyweight'],
    instr: {
      en: [
        '1) Lie on your back with your legs almost straight and only your heels on the floor, far enough away that your knees are slightly bent.',
        '2) Dig your heels down and drive your hips toward the ceiling, feeling the work in your hamstrings rather than your lower back.',
        '3) Pause at the top with hips fully extended, then lower under control.',
        '4) Repeat for the recommended repetitions, keeping the load on the hamstrings throughout.',
      ],
      es: [
        '1) Tumbate boca arriba con las piernas casi estiradas y solo los talones en el suelo, lo bastante lejos para que las rodillas queden ligeramente flexionadas.',
        '2) Clava los talones y eleva la cadera hacia el techo, sintiendo el trabajo en los isquiotibiales y no en la zona lumbar.',
        '3) Manten una pausa arriba con la cadera totalmente extendida y baja con control.',
        '4) Repite las repeticiones indicadas manteniendo la tension en los isquiotibiales.',
      ],
    },
  },
  {
    slug: 'pogo_jumps',
    name: { en: 'Pogo Jumps', es: 'Saltos Pogo' },
    aliases: ['Pogo Jumps', 'Pogos', 'Saltos Pogo'],
    level: 'beginner',
    category: 'plyometrics',
    pm: ['calves'], sm: ['quadriceps', 'tibialis'],
    movementPattern: ['squat'], forceType: ['push'], mechanic: ['compound'],
    laterality: ['bilateral'], equipment: ['bodyweight'],
    instr: {
      en: [
        '1) Stand tall with feet hip-width apart and a slight bend in the knees, keeping the body stiff like a spring.',
        '2) Bounce off the balls of your feet using mainly the ankles, keeping the knees almost straight and the contact time as short as possible.',
        '3) Land softly on the balls of your feet and immediately rebound into the next jump.',
        '4) Continue for the recommended repetitions or time, staying springy and rhythmic.',
      ],
      es: [
        '1) Ponte de pie con los pies a la anchura de las caderas y una ligera flexion de rodillas, manteniendo el cuerpo rigido como un muelle.',
        '2) Rebota con la punta de los pies usando sobre todo los tobillos, manteniendo las rodillas casi estiradas y el tiempo de contacto lo mas corto posible.',
        '3) Aterriza suave sobre los metatarsos y rebota de inmediato al siguiente salto.',
        '4) Continua las repeticiones o el tiempo indicado, manteniendo el ritmo elastico.',
      ],
    },
  },
  {
    slug: 'hip_hinge',
    name: { en: 'Hip Hinge', es: 'Bisagra de Cadera' },
    aliases: ['Hip Hinge', 'Bisagra de Cadera', 'Patron de Bisagra'],
    level: 'beginner',
    category: 'strength',
    pm: ['glutes'], sm: ['hamstrings', 'lower_back'],
    movementPattern: ['hinge'], forceType: ['pull'], mechanic: ['compound'],
    laterality: ['bilateral'], equipment: ['bodyweight'],
    instr: {
      en: [
        '1) Stand with feet hip-width apart, knees soft and core braced. You can hold a dowel along your spine to feel a neutral back.',
        '2) Push your hips straight back, hinging at the hip while keeping your back flat and shins fairly vertical.',
        '3) Lower until you feel a stretch in your hamstrings, with your torso leaning forward and the hips behind your heels.',
        '4) Drive your hips forward to stand tall, squeezing your glutes at the top. Repeat for the recommended repetitions.',
      ],
      es: [
        '1) Ponte de pie con los pies a la anchura de las caderas, rodillas blandas y core activado. Puedes apoyar un palo en la espalda para sentir la posicion neutra.',
        '2) Lleva la cadera hacia atras flexionando desde la cadera, manteniendo la espalda recta y las tibias casi verticales.',
        '3) Baja hasta notar el estiramiento en los isquiotibiales, con el torso inclinado y la cadera por detras de los talones.',
        '4) Empuja la cadera hacia delante para incorporarte, apretando los gluteos arriba. Repite las repeticiones indicadas.',
      ],
    },
  },
  {
    slug: 'deceleration_drill',
    name: { en: 'Deceleration Drill', es: 'Ejercicio de Desaceleracion' },
    aliases: ['Deceleration', 'Desaceleracion', 'Deceleracion'],
    level: 'intermediate',
    category: 'plyometrics',
    pm: ['quadriceps'], sm: ['glutes', 'hamstrings'],
    movementPattern: ['squat'], forceType: ['mixed'], mechanic: ['compound'],
    laterality: ['bilateral'], equipment: ['bodyweight'],
    instr: {
      en: [
        '1) Start by jogging or striding forward over a few steps to build a little momentum.',
        '2) On the chosen line, plant both feet and sink into a quarter-squat to absorb the force, keeping knees tracking over the toes.',
        '3) Hold the braked position for a beat with a stable, athletic stance and the chest up.',
        '4) Reset and repeat, progressively increasing entry speed as your control improves.',
      ],
      es: [
        '1) Empieza trotando o dando varias zancadas hacia delante para coger algo de inercia.',
        '2) En la linea marcada, planta ambos pies y baja a una media sentadilla para absorber la fuerza, con las rodillas alineadas sobre los pies.',
        '3) Manten un instante la posicion de frenado en una postura atletica y estable, con el pecho alto.',
        '4) Reinicia y repite, aumentando poco a poco la velocidad de entrada a medida que mejora tu control.',
      ],
    },
  },
  {
    slug: 'hollow_hold',
    name: { en: 'Hollow Hold', es: 'Hollow Hold' },
    aliases: ['Hollow Hold', 'Hollow Body Hold', 'Plancha Hueca'],
    level: 'beginner',
    category: 'strength',
    pm: ['abs'], sm: ['transverse', 'hip_flexors'],
    movementPattern: ['anti_rotation'], forceType: ['isometric'], mechanic: ['isolation'],
    laterality: ['bilateral'], equipment: ['bodyweight'],
    instr: {
      en: [
        '1) Lie on your back and press your lower back firmly into the floor by tilting your pelvis.',
        '2) Lift your shoulder blades and legs off the floor, reaching your arms overhead and pointing your toes.',
        '3) Hold this dish-shaped position, keeping the lower back glued to the ground and ribs down.',
        '4) Maintain for the recommended time, then relax. Bend the knees or lower the arms to make it easier.',
      ],
      es: [
        '1) Tumbate boca arriba y presiona la zona lumbar firmemente contra el suelo inclinando la pelvis.',
        '2) Despega del suelo los omoplatos y las piernas, estirando los brazos por encima de la cabeza y con las puntas de los pies estiradas.',
        '3) Manten esta postura ahuecada, con la zona lumbar pegada al suelo y las costillas hacia dentro.',
        '4) Aguanta el tiempo indicado y relaja. Flexiona las rodillas o baja los brazos para hacerlo mas facil.',
      ],
    },
  },
  {
    slug: 'hollow_rock',
    name: { en: 'Hollow Rock', es: 'Hollow Rock' },
    aliases: ['Hollow Rock', 'Balanceo Hueco'],
    level: 'intermediate',
    category: 'strength',
    pm: ['abs'], sm: ['transverse', 'hip_flexors'],
    movementPattern: ['anti_rotation'], forceType: ['mixed'], mechanic: ['isolation'],
    laterality: ['bilateral'], equipment: ['bodyweight'],
    instr: {
      en: [
        '1) Get into a hollow body position: lower back pressed down, shoulders and legs off the floor, arms overhead.',
        '2) Keeping that rigid banana shape, rock back and forth using momentum from your shoulders and hips.',
        '3) Do not let the lower back arch or the legs drop as you rock.',
        '4) Continue rocking for the recommended repetitions, staying tight throughout.',
      ],
      es: [
        '1) Adopta la posicion hollow: zona lumbar pegada al suelo, hombros y piernas elevados y brazos por encima de la cabeza.',
        '2) Manteniendo esa forma rigida de platano, balancea el cuerpo adelante y atras con el impulso de hombros y caderas.',
        '3) No dejes que la zona lumbar se arquee ni que las piernas caigan durante el balanceo.',
        '4) Continua balanceandote las repeticiones indicadas, manteniendo la tension.',
      ],
    },
  },
  {
    slug: 'countermovement_jump',
    name: { en: 'Countermovement Jump', es: 'Salto con Contramovimiento' },
    aliases: ['CMJ', 'Countermovement Jump', 'Salto con Contramovimiento'],
    level: 'beginner',
    category: 'plyometrics',
    pm: ['quadriceps'], sm: ['glutes', 'calves'],
    movementPattern: ['squat'], forceType: ['push'], mechanic: ['compound'],
    laterality: ['bilateral'], equipment: ['bodyweight'],
    instr: {
      en: [
        '1) Stand tall with feet hip-width apart and hands on your hips or ready to swing.',
        '2) Dip quickly into a quarter squat as you swing your arms back, then immediately reverse the movement.',
        '3) Explode upward jumping as high as possible, fully extending hips, knees and ankles.',
        '4) Land softly with bent knees to absorb the impact. Reset and repeat for the recommended repetitions.',
      ],
      es: [
        '1) Ponte de pie con los pies a la anchura de las caderas y las manos en la cintura o listas para impulsar.',
        '2) Baja rapido a una media sentadilla llevando los brazos atras y, sin pausa, invierte el movimiento.',
        '3) Salta hacia arriba con la maxima altura posible, extendiendo por completo cadera, rodillas y tobillos.',
        '4) Aterriza suave con las rodillas flexionadas para absorber el impacto. Reinicia y repite las repeticiones indicadas.',
      ],
    },
  },
  {
    slug: 'copenhagen_plank',
    name: { en: 'Copenhagen Plank', es: 'Plancha Copenhague' },
    aliases: ['Copenhagen Plank', 'Plancha Copenhague', 'Copenhagen Side Plank'],
    level: 'intermediate',
    category: 'strength',
    pm: ['adductors'], sm: ['obliques', 'abs'],
    movementPattern: ['anti_rotation'], forceType: ['isometric'], mechanic: ['isolation'],
    laterality: ['unilateral'], equipment: ['bench'],
    instr: {
      en: [
        '1) Lie on your side and place the inside of your top foot or shin on a bench, with the bottom leg below it.',
        '2) Rise onto your bottom forearm and lift your hips so your body forms a straight line, supported by the top leg on the bench.',
        '3) Squeeze your top inner thigh to keep the hips high, bracing your core and avoiding any sag.',
        '4) Hold for the recommended time, then switch sides. Bend the bottom leg up for an easier version.',
      ],
      es: [
        '1) Tumbate de lado y apoya la cara interna del pie o la espinilla de la pierna de arriba sobre un banco, con la pierna de abajo por debajo.',
        '2) Sube al antebrazo de abajo y eleva la cadera hasta formar una linea recta con el cuerpo, apoyado en la pierna de arriba sobre el banco.',
        '3) Aprieta la cara interna del muslo superior para mantener la cadera alta, con el core activo y sin dejar caer la pelvis.',
        '4) Aguanta el tiempo indicado y cambia de lado. Flexiona la pierna de abajo para una version mas facil.',
      ],
    },
  },
  {
    slug: 'landing_mechanics_drill',
    name: { en: 'Landing Mechanics Drill', es: 'Ejercicio de Aterrizaje' },
    aliases: ['Landing', 'Aterrizaje', 'Mecanica de Aterrizaje'],
    level: 'beginner',
    category: 'plyometrics',
    pm: ['quadriceps'], sm: ['glutes', 'hamstrings'],
    movementPattern: ['squat'], forceType: ['mixed'], mechanic: ['compound'],
    laterality: ['bilateral'], equipment: ['box'],
    instr: {
      en: [
        '1) Stand on top of a low box with feet hip-width apart.',
        '2) Step off the box and drop straight down, landing on both feet at the same time.',
        '3) Absorb the landing by sitting into a soft athletic squat, knees tracking over the toes and chest up.',
        '4) Hold the landing for a beat, stand up and repeat for the recommended repetitions.',
      ],
      es: [
        '1) Ponte de pie sobre un cajon bajo con los pies a la anchura de las caderas.',
        '2) Da un paso fuera del cajon y dejate caer recto hacia abajo, aterrizando con ambos pies a la vez.',
        '3) Absorbe el aterrizaje sentandote en una sentadilla atletica suave, con las rodillas alineadas sobre los pies y el pecho alto.',
        '4) Manten el aterrizaje un instante, incorporate y repite las repeticiones indicadas.',
      ],
    },
  },
  {
    slug: 'bird_dog',
    name: { en: 'Bird Dog', es: 'Bird Dog' },
    aliases: ['Bird Dog', 'Perro de Muestra', 'Cuadrupedia Contralateral'],
    level: 'beginner',
    category: 'strength',
    pm: ['lower_back'], sm: ['glutes', 'abs'],
    movementPattern: ['anti_rotation'], forceType: ['isometric'], mechanic: ['isolation'],
    laterality: ['alternating'], equipment: ['bodyweight'],
    instr: {
      en: [
        '1) Get on all fours with hands under shoulders and knees under hips, spine neutral and core braced.',
        '2) Reach one arm straight forward and the opposite leg straight back until both are level with the torso.',
        '3) Keep your hips and shoulders square to the floor, avoiding any rotation or lower-back arching.',
        '4) Return under control and switch to the other side. Repeat for the recommended repetitions.',
      ],
      es: [
        '1) Ponte a cuatro patas con las manos bajo los hombros y las rodillas bajo las caderas, columna neutra y core activado.',
        '2) Extiende un brazo recto al frente y la pierna contraria recta hacia atras hasta alinearlos con el torso.',
        '3) Manten las caderas y los hombros paralelos al suelo, evitando rotar o arquear la zona lumbar.',
        '4) Vuelve con control y cambia de lado. Repite las repeticiones indicadas.',
      ],
    },
  },
  {
    slug: 'cable_katana_press',
    name: { en: 'Cable Katana Anti-Rotation Press', es: 'Katana en Polea (Antirrotacion)' },
    aliases: ['Katana', 'Antirotacion en Polea', 'Cable Katana'],
    level: 'intermediate',
    category: 'strength',
    pm: ['obliques'], sm: ['abs', 'transverse'],
    movementPattern: ['anti_rotation'], forceType: ['isometric'], mechanic: ['isolation'],
    laterality: ['unilateral'], equipment: ['cable'],
    instr: {
      en: [
        '1) Set a cable to shoulder height and stand side-on, gripping the handle with both hands close to that shoulder.',
        '2) Step away to load the cable, feet shoulder-width apart and core braced against the pull.',
        '3) Press the handle diagonally across and down toward the opposite hip, resisting the cable trying to rotate you.',
        '4) Return slowly to the shoulder and repeat for the recommended repetitions, then switch sides.',
      ],
      es: [
        '1) Coloca la polea a la altura del hombro y situate de lado, sujetando el agarre con ambas manos cerca de ese hombro.',
        '2) Separate para tensar el cable, con los pies a la anchura de los hombros y el core firme frente a la traccion.',
        '3) Empuja el agarre en diagonal hacia abajo en direccion a la cadera contraria, resistiendo el cable que intenta rotarte.',
        '4) Vuelve despacio al hombro y repite las repeticiones indicadas; luego cambia de lado.',
      ],
    },
  },
  {
    slug: 'step_down',
    name: { en: 'Step Down', es: 'Step Down (Escalon Controlado)' },
    aliases: ['Step Down', 'Escalon Controlado', 'Bajada de Escalon'],
    level: 'beginner',
    category: 'strength',
    pm: ['quadriceps'], sm: ['glutes', 'abductors'],
    movementPattern: ['lunge'], forceType: ['push'], mechanic: ['compound'],
    laterality: ['unilateral'], equipment: ['box'],
    instr: {
      en: [
        '1) Stand on top of a low box or step on one leg, with the other foot hanging off the edge.',
        '2) Slowly bend the standing knee to lower the free heel toward the floor, keeping the knee aligned over the foot.',
        '3) Lightly tap the heel down without shifting your weight onto it, keeping control on the working leg.',
        '4) Drive back up through the standing leg to the start. Repeat for the recommended repetitions, then switch sides.',
      ],
      es: [
        '1) Ponte de pie sobre un cajon bajo o escalon apoyado en una pierna, con el otro pie por fuera del borde.',
        '2) Flexiona despacio la rodilla de apoyo para bajar el talon libre hacia el suelo, manteniendo la rodilla alineada sobre el pie.',
        '3) Roza el talon en el suelo sin trasladarle el peso, manteniendo el control en la pierna que trabaja.',
        '4) Empuja de vuelta arriba con la pierna de apoyo. Repite las repeticiones indicadas y cambia de lado.',
      ],
    },
  },
  {
    slug: 'devil_press',
    name: { en: 'Devil Press', es: 'Devil Press' },
    aliases: ['Devil Press', 'Devil Presses'],
    level: 'expert',
    category: 'strength',
    pm: ['shoulders'], sm: ['glutes', 'hamstrings', 'chest'],
    movementPattern: ['vertical_push'], forceType: ['mixed'], mechanic: ['compound'],
    laterality: ['bilateral'], equipment: ['dumbbell'],
    instr: {
      en: [
        '1) Stand over two dumbbells on the floor, feet shoulder-width apart.',
        '2) Drop into a burpee: place the dumbbells down, jump or step your feet back and lower your chest to the floor.',
        '3) Push up, jump your feet in and, with a flat back, swing both dumbbells from the floor overhead in one explosive movement.',
        '4) Lock the dumbbells out overhead, then return them to the floor and repeat for the recommended repetitions.',
      ],
      es: [
        '1) Colocate de pie sobre dos mancuernas en el suelo, con los pies a la anchura de los hombros.',
        '2) Baja en burpee: apoya las mancuernas, lleva o salta con los pies atras y baja el pecho al suelo.',
        '3) Empuja hacia arriba, recoge los pies y, con la espalda recta, eleva ambas mancuernas del suelo hasta encima de la cabeza en un movimiento explosivo.',
        '4) Bloquea las mancuernas arriba, devuelvelas al suelo y repite las repeticiones indicadas.',
      ],
    },
  },
  {
    slug: 'animal_flow',
    name: { en: 'Animal Flow', es: 'Animal Flow' },
    aliases: ['Animal Flow', 'Flow Animal'],
    level: 'intermediate',
    category: 'strength',
    pm: ['abs'], sm: ['shoulders', 'glutes'],
    movementPattern: ['isolation'], forceType: ['mixed'], mechanic: ['compound'],
    laterality: ['bilateral'], equipment: ['bodyweight'],
    instr: {
      en: [
        '1) Start in a beast position: on all fours with knees hovering just off the floor and a flat back.',
        '2) Flow into an ape or crab reach by transferring weight smoothly between hands and feet.',
        '3) Move continuously between ground-based positions, keeping the core engaged and movements controlled.',
        '4) Continue the flow for the recommended time, breathing steadily throughout.',
      ],
      es: [
        '1) Empieza en posicion beast: a cuatro apoyos con las rodillas a un palmo del suelo y la espalda recta.',
        '2) Fluye hacia una transicion de mono o cangrejo trasladando el peso de forma suave entre manos y pies.',
        '3) Encadena posiciones en el suelo de forma continua, manteniendo el core activo y los movimientos controlados.',
        '4) Continua el flow el tiempo indicado, respirando de forma constante.',
      ],
    },
  },
  {
    slug: 'ankle_dorsiflexion_mobilization',
    name: { en: 'Ankle Dorsiflexion Mobilization', es: 'Movilizacion en Dorsiflexion de Tobillo' },
    aliases: ['Dorsiflexion de Tobillo', 'Ankle Dorsiflexion', 'Knee to Wall'],
    level: 'beginner',
    category: 'stretching',
    pm: ['calves'], sm: ['soleus', 'tibialis'],
    movementPattern: ['isolation'], forceType: ['isometric'], mechanic: ['isolation'],
    laterality: ['unilateral'], equipment: ['bodyweight'],
    instr: {
      en: [
        '1) Kneel in a half-kneeling position facing a wall, with the front foot a few centimetres from the wall.',
        '2) Keeping the heel flat on the floor, drive the front knee forward over the toes toward the wall.',
        '3) Touch the knee to the wall if you can, feeling a stretch at the front of the ankle, then return.',
        '4) Repeat for the recommended repetitions, moving the foot back as your range improves, then switch sides.',
      ],
      es: [
        '1) Colocate en posicion de medio arrodillado frente a una pared, con el pie adelantado a unos centimetros de ella.',
        '2) Manteniendo el talon pegado al suelo, lleva la rodilla adelantada hacia delante por encima de los dedos en direccion a la pared.',
        '3) Toca la pared con la rodilla si puedes, notando el estiramiento en la parte delantera del tobillo, y vuelve.',
        '4) Repite las repeticiones indicadas, alejando el pie a medida que ganas rango, y cambia de lado.',
      ],
    },
  },
  {
    slug: 'thoracic_rotation',
    name: { en: 'Thoracic Rotation', es: 'Rotacion Toracica' },
    aliases: ['Rotacion Toracica', 'Expansion Toracica', 'Thoracic Rotation', 'Open Book'],
    level: 'beginner',
    category: 'stretching',
    pm: ['obliques'], sm: ['lats', 'mid_traps'],
    movementPattern: ['rotation'], forceType: ['isometric'], mechanic: ['isolation'],
    laterality: ['alternating'], equipment: ['bodyweight'],
    instr: {
      en: [
        '1) Lie on your side with hips and knees bent to 90 degrees and both arms stretched out in front, palms together.',
        '2) Keeping the knees stacked and on the floor, open the top arm up and over toward the other side, following your hand with your eyes.',
        '3) Let the upper back rotate until the top shoulder approaches the floor, feeling the chest open.',
        '4) Return slowly and repeat for the recommended repetitions, then switch sides.',
      ],
      es: [
        '1) Tumbate de lado con caderas y rodillas flexionadas a 90 grados y ambos brazos estirados al frente, palmas juntas.',
        '2) Manteniendo las rodillas juntas y apoyadas, abre el brazo de arriba hacia el otro lado siguiendo la mano con la mirada.',
        '3) Deja que la espalda alta rote hasta que el hombro de arriba se acerque al suelo, notando como se abre el pecho.',
        '4) Vuelve despacio y repite las repeticiones indicadas; luego cambia de lado.',
      ],
    },
  },
  {
    slug: 'shoulder_cars',
    name: { en: 'Shoulder CARS', es: 'CARS de Hombro' },
    aliases: ['Shoulder CARS', 'CARS de Hombro', 'Circunduccion de Hombro'],
    level: 'beginner',
    category: 'stretching',
    pm: ['shoulders'], sm: ['rotator_cuff'],
    movementPattern: ['isolation'], forceType: ['isometric'], mechanic: ['isolation'],
    laterality: ['unilateral'], equipment: ['bodyweight'],
    instr: {
      en: [
        '1) Stand tall with the core braced. Raise one arm in front of you with the thumb pointing up.',
        '2) Slowly sweep the arm overhead, rotating the shoulder to its end range without shrugging or arching.',
        '3) Continue the circle behind you, turning the palm out, then bring the arm down and around back to the start.',
        '4) Move slowly and deliberately through the largest pain-free circle. Repeat for the recommended repetitions, then switch sides.',
      ],
      es: [
        '1) Ponte erguido con el core activo. Eleva un brazo al frente con el pulgar hacia arriba.',
        '2) Lleva el brazo despacio por encima de la cabeza rotando el hombro hasta su rango final, sin encoger ni arquear.',
        '3) Continua el circulo por detras girando la palma hacia fuera y baja el brazo rodeando hasta volver al inicio.',
        '4) Muevete lento y controlado por el circulo mas amplio posible sin dolor. Repite las repeticiones indicadas y cambia de lado.',
      ],
    },
  },
  {
    slug: 'diaphragmatic_breathing_360',
    name: { en: '360 Diaphragmatic Breathing', es: 'Respiracion 360' },
    aliases: ['Respiracion 360', '360 Breathing', 'Respiracion Diafragmatica'],
    level: 'beginner',
    category: 'stretching',
    pm: ['transverse'], sm: ['abs'],
    movementPattern: ['isolation'], forceType: ['isometric'], mechanic: ['isolation'],
    laterality: ['bilateral'], equipment: ['bodyweight'],
    instr: {
      en: [
        '1) Lie on your back with knees bent, or sit tall. Wrap your hands around your lower ribs.',
        '2) Inhale slowly through the nose, aiming to expand the ribcage in all directions: front, sides and back.',
        '3) Feel your hands pushed outward as the lower ribs widen, keeping the shoulders and neck relaxed.',
        '4) Exhale fully and let the ribs draw back in. Repeat for the recommended breaths.',
      ],
      es: [
        '1) Tumbate boca arriba con las rodillas flexionadas, o sientate erguido. Rodea las costillas inferiores con las manos.',
        '2) Inhala despacio por la nariz buscando expandir la caja toracica en todas direcciones: delante, lados y espalda.',
        '3) Nota como las manos se separan al ensancharse las costillas inferiores, manteniendo hombros y cuello relajados.',
        '4) Exhala por completo y deja que las costillas vuelvan a cerrarse. Repite las respiraciones indicadas.',
      ],
    },
  },
  {
    slug: 'codman_pendulum',
    name: { en: 'Codman Pendulum', es: 'Pendulo de Codman' },
    aliases: ['Pendulo de Codman', 'Pendulo', 'Codman Pendulum'],
    level: 'beginner',
    category: 'stretching',
    pm: ['shoulders'], sm: ['rotator_cuff'],
    movementPattern: ['isolation'], forceType: ['isometric'], mechanic: ['isolation'],
    laterality: ['unilateral'], equipment: ['bodyweight'],
    instr: {
      en: [
        '1) Stand and lean forward, supporting your non-working hand on a table or bench. Let the working arm hang relaxed toward the floor.',
        '2) Using gentle movement of your body, not your shoulder muscles, let the arm swing in small forward-and-back arcs.',
        '3) Progress to side-to-side swings and then small circles, keeping the shoulder loose and pain-free.',
        '4) Continue for the recommended time, then switch sides.',
      ],
      es: [
        '1) De pie, inclinate hacia delante apoyando la mano que no trabaja en una mesa o banco. Deja el brazo a trabajar colgando relajado hacia el suelo.',
        '2) Con un suave movimiento del cuerpo, no de los musculos del hombro, deja que el brazo oscile en pequenos arcos adelante y atras.',
        '3) Progresa a balanceos laterales y luego a pequenos circulos, manteniendo el hombro suelto y sin dolor.',
        '4) Continua el tiempo indicado y cambia de lado.',
      ],
    },
  },
  {
    slug: 'short_foot_activation',
    name: { en: 'Short Foot Activation', es: 'Activacion del Arco del Pie' },
    aliases: ['Activacion del Arco del Pie', 'Short Foot', 'Arco del Pie'],
    level: 'beginner',
    category: 'stretching',
    pm: ['tibialis'], sm: ['calves'],
    movementPattern: ['isolation'], forceType: ['isometric'], mechanic: ['isolation'],
    laterality: ['unilateral'], equipment: ['bodyweight'],
    instr: {
      en: [
        '1) Sit or stand with the foot flat on the floor and weight spread across the big toe, little toe and heel.',
        '2) Without curling the toes, draw the ball of the foot toward the heel to raise the arch and shorten the foot.',
        '3) Hold the lifted arch for a few seconds, keeping the toes long and flat.',
        '4) Relax and repeat for the recommended repetitions, then switch sides.',
      ],
      es: [
        '1) Sentado o de pie con el pie plano en el suelo y el peso repartido entre el dedo gordo, el menique y el talon.',
        '2) Sin doblar los dedos, acerca la base de los dedos hacia el talon para elevar el arco y acortar el pie.',
        '3) Manten el arco elevado unos segundos, con los dedos largos y planos.',
        '4) Relaja y repite las repeticiones indicadas; luego cambia de pie.',
      ],
    },
  },
  {
    slug: 'cat_cow',
    name: { en: 'Cat-Cow', es: 'Gato-Camello' },
    aliases: ['Cat-Cow', 'Gato-Camello', 'Cat Camel'],
    level: 'beginner',
    category: 'stretching',
    pm: ['lower_back'], sm: ['abs'],
    movementPattern: ['isolation'], forceType: ['isometric'], mechanic: ['isolation'],
    laterality: ['bilateral'], equipment: ['bodyweight'],
    instr: {
      en: [
        '1) Get on all fours with hands under shoulders and knees under hips.',
        '2) Inhale and drop your belly, lifting your chest and tailbone into the cow position.',
        '3) Exhale and round your spine toward the ceiling, tucking your chin and tailbone into the cat position.',
        '4) Flow smoothly between the two with your breath for the recommended repetitions.',
      ],
      es: [
        '1) Ponte a cuatro patas con las manos bajo los hombros y las rodillas bajo las caderas.',
        '2) Inhala y deja caer el abdomen, elevando el pecho y el coxis en la posicion de camello.',
        '3) Exhala y redondea la columna hacia el techo, metiendo la barbilla y el coxis en la posicion de gato.',
        '4) Encadena ambas posiciones de forma fluida acompanando la respiracion, las repeticiones indicadas.',
      ],
    },
  },
  {
    slug: 'sciatic_nerve_floss',
    name: { en: 'Sciatic Nerve Floss', es: 'Neurodinamia del Ciatico' },
    aliases: ['Neurodinamia Ciatico', 'Sciatic Nerve Floss', 'Movilizacion Neural del Ciatico'],
    level: 'beginner',
    category: 'stretching',
    pm: ['hamstrings'], sm: ['calves'],
    movementPattern: ['isolation'], forceType: ['isometric'], mechanic: ['isolation'],
    laterality: ['unilateral'], equipment: ['bodyweight'],
    instr: {
      en: [
        '1) Sit tall on a chair with one leg ready to move and hands resting on your thighs.',
        '2) Simultaneously extend the knee straight while looking up and pulling the toes toward you, then reverse.',
        '3) As you bend the knee back down, tuck the chin to the chest, gliding the nerve back and forth.',
        '4) Move smoothly without forcing into pain. Repeat for the recommended repetitions, then switch sides.',
      ],
      es: [
        '1) Sientate erguido en una silla con una pierna lista para moverse y las manos sobre los muslos.',
        '2) A la vez, estira la rodilla mientras miras hacia arriba y llevas la punta del pie hacia ti; luego invierte.',
        '3) Al flexionar de nuevo la rodilla, lleva la barbilla al pecho, deslizando el nervio adelante y atras.',
        '4) Muevete de forma suave sin forzar hasta el dolor. Repite las repeticiones indicadas y cambia de lado.',
      ],
    },
  },
  {
    slug: 'wall_ball',
    name: { en: 'Wall Ball', es: 'Wall Ball' },
    aliases: ['Wall Ball', 'Wall Balls', 'Lanzamiento a Pared'],
    level: 'beginner',
    category: 'strength',
    pm: ['quadriceps'], sm: ['shoulders', 'glutes'],
    movementPattern: ['squat'], forceType: ['mixed'], mechanic: ['compound'],
    laterality: ['bilateral'], equipment: ['medicine_ball'],
    instr: {
      en: [
        '1) Stand facing a wall holding a medicine ball at chest height, feet shoulder-width apart.',
        '2) Drop into a full squat, keeping the chest up and the ball in front of you.',
        '3) Drive up explosively and throw the ball at a high target on the wall as you extend.',
        '4) Catch the ball on the way down and flow straight into the next squat for the recommended repetitions.',
      ],
      es: [
        '1) Ponte de pie frente a una pared sujetando un balon medicinal a la altura del pecho, con los pies a la anchura de los hombros.',
        '2) Baja a una sentadilla completa manteniendo el pecho alto y el balon por delante.',
        '3) Sube de forma explosiva y lanza el balon a un punto alto de la pared al extenderte.',
        '4) Recoge el balon al bajar y encadena directamente la siguiente sentadilla, las repeticiones indicadas.',
      ],
    },
  },
  {
    slug: 'cossack_squat',
    name: { en: 'Cossack Squat', es: 'Sentadilla Cosaca' },
    aliases: ['Cossack Squat', 'Sentadilla Cosaca'],
    level: 'intermediate',
    category: 'strength',
    pm: ['adductors'], sm: ['quadriceps', 'glutes'],
    movementPattern: ['lunge'], forceType: ['push'], mechanic: ['compound'],
    laterality: ['unilateral'], equipment: ['bodyweight'],
    instr: {
      en: [
        '1) Stand with feet much wider than shoulder-width, toes pointing slightly out.',
        '2) Shift your weight onto one leg and sit down into a deep squat on that side, keeping the other leg straight with the toes up.',
        '3) Keep the chest up and the heel of the bent leg flat, feeling a stretch in the straight inner thigh.',
        '4) Push back to the centre and shift to the other side. Repeat for the recommended repetitions.',
      ],
      es: [
        '1) Ponte de pie con los pies bastante mas anchos que los hombros y las puntas ligeramente hacia fuera.',
        '2) Traslada el peso a una pierna y baja a una sentadilla profunda por ese lado, manteniendo la otra pierna estirada con la punta del pie arriba.',
        '3) Manten el pecho alto y el talon de la pierna flexionada apoyado, notando el estiramiento en la cara interna de la pierna estirada.',
        '4) Empuja de vuelta al centro y cambia de lado. Repite las repeticiones indicadas.',
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
      // Lote de ideacion: fecha en que se concibieron. El editor permite filtrar
      // por lote ("Lote 2026-06-22"). Se descarta en build:public (no llega a
      // MongoDB).
      batch: '2026-06-22',
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
