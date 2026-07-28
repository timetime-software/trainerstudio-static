// Seed del lote 2026-07-28: los 10 ejercicios mas buscados en produccion que
// devuelven 0 resultados Y que ademas no existen en el dataset.
//
// Origen de la seleccion: eventos `PublicExerciseSearched` con
// `data.resultsCount: 0` en la Mongo de produccion, agregados por termino y
// filtrados contra `data/exercises.ndjson` para descartar los que ya existen
// (esos son un problema de sinonimos o de publicacion, no de catalogo).
// Ver DEMAND_BACKLOG.md para el analisis completo y el resto de buckets.
//
// Mismo contrato y mecanica que seed-batch-2026-07-03.mjs: crea SOLO las
// entradas que no existan ya (idempotente por cdnslug). Se crean SIN media: la
// referencia de video y la generacion del clip default se hacen despues con el
// pipeline de video (ver README "Ark Style Tasks"). Se marcan con
// metadata.batch para poder filtrarlas en el editor ("Lote 2026-07-28"); ese
// campo se descarta en build:public (no llega a MongoDB).
//
//   node seed-batch-2026-07-28.mjs            # aplica los cambios
//   node seed-batch-2026-07-28.mjs --dry-run  # solo informa

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { identityKeyForSlug, idForIdentityKey } from './exercise-ids.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, 'data', 'exercises.ndjson');
const DRY = process.argv.includes('--dry-run');
const BATCH = '2026-07-28';

// `demand` = nº de busquedas con 0 resultados desde el 23-may-2026 (fecha en la
// que entro en produccion el buscador con Atlas Search), sumando todas las
// variantes y errores tipograficos del termino.
const DEFS = [
  {
    slug: 'bayesian_curl',
    demand: 65,
    name: {
      en: 'Bayesian Curl',
      es: 'Curl Bayesiano',
      it: 'Curl bayesiano',
      fr: 'Curl bayésien',
      pt: 'Rosca bayesiana',
    },
    aliases: [
      'Bayesian Curl', 'Curl Bayesiano', 'Curl Bayesian', 'Bayesian Cable Curl',
      'Curl de Bíceps en Polea por Detrás', 'Curl bayesiano', 'Curl bayésien', 'Rosca bayesiana',
    ],
    level: 'intermediate',
    category: 'strength',
    pm: ['biceps'], sm: ['biceps_long_head', 'brachialis', 'forearm_flexors'],
    movementPattern: ['isolation'], forceType: ['pull'], mechanic: ['isolation'],
    laterality: ['unilateral'], equipment: ['cable'],
    instr: {
      en: [
        '1) Set a cable pulley to the lowest position and attach a single handle. Grab it with one hand and walk forward until the cable pulls your arm behind your torso. This is your starting position.',
        '2) Stand in a split stance with your chest up and your working arm hanging behind your body, elbow straight and shoulder stretched.',
        '3) Keeping your upper arm fixed behind you, curl the handle up toward your shoulder by bending only your elbow.',
        '4) Lower the handle under control back to the stretched position without letting your elbow drift forward. Repeat for the recommended repetitions, then switch sides.',
      ],
      es: [
        '1) Coloca la polea en la posición más baja y engancha un agarre individual. Cógelo con una mano y camina hacia delante hasta que el cable lleve el brazo por detrás del torso. Esta es tu posición de partida.',
        '2) Colócate en paso adelantado con el pecho alto y el brazo que trabaja colgando por detrás del cuerpo, el codo estirado y el hombro en estiramiento.',
        '3) Manteniendo el brazo fijo por detrás, flexiona solo el codo para subir el agarre hacia el hombro.',
        '4) Baja el agarre con control hasta la posición de estiramiento sin dejar que el codo se adelante. Repite las repeticiones indicadas y cambia de lado.',
      ],
      it: [
        '1) Imposta la puleggia nella posizione più bassa e collega una maniglia singola. Afferrala con una mano e cammina in avanti finché il cavo non porta il braccio dietro il busto. Questa è la posizione di partenza.',
        '2) Mettiti in appoggio con un piede avanti, il petto alto e il braccio che lavora che pende dietro il corpo, gomito disteso e spalla in allungamento.',
        '3) Mantenendo il braccio fermo dietro di te, fletti solo il gomito per portare la maniglia verso la spalla.',
        '4) Riporta la maniglia in basso in modo controllato fino alla posizione di allungamento, senza lasciare che il gomito avanzi. Ripeti per le ripetizioni consigliate, poi cambia lato.',
      ],
      fr: [
        "1) Réglez la poulie en position basse et fixez une poignée simple. Saisissez-la d'une main et avancez jusqu'à ce que le câble amène votre bras derrière le buste. C'est votre position de départ.",
        '2) Placez-vous en fente légère, poitrine haute, le bras qui travaille pendant derrière le corps, coude tendu et épaule en étirement.',
        '3) En gardant le bras fixe derrière vous, fléchissez uniquement le coude pour remonter la poignée vers l\'épaule.',
        "4) Redescendez la poignée en contrôle jusqu'à la position d'étirement sans laisser le coude avancer. Répétez le nombre de répétitions recommandé, puis changez de côté.",
      ],
      pt: [
        '1) Coloque a polia na posição mais baixa e prenda uma pega individual. Segure-a com uma mão e avance até o cabo levar o braço para trás do tronco. Esta é a posição inicial.',
        '2) Fique em passo afastado com o peito alto e o braço que trabalha pendurado atrás do corpo, cotovelo esticado e ombro em alongamento.',
        '3) Mantendo o braço fixo atrás de si, flita apenas o cotovelo para subir a pega em direção ao ombro.',
        '4) Desça a pega de forma controlada até à posição de alongamento sem deixar o cotovelo avançar. Repita as repetições recomendadas e mude de lado.',
      ],
    },
  },
  {
    slug: 'suitcase_carry',
    demand: 36,
    name: {
      en: 'Suitcase Carry',
      es: 'Paseo del Maletín',
      it: 'Camminata della valigia',
      fr: 'Marche de la valise',
      pt: 'Caminhada da mala',
    },
    aliases: [
      'Suitcase Carry', 'Paseo del Maletín', 'Transporte del Maletín', 'Caminata del Maletín',
      'Suitcase Walk', 'Camminata della valigia', 'Marche de la valise', 'Caminhada da mala',
    ],
    level: 'beginner',
    category: 'strength',
    pm: ['obliques'], sm: ['grip', 'abs', 'upper_traps', 'glute_med'],
    movementPattern: ['carry'], forceType: ['isometric'], mechanic: ['compound'],
    laterality: ['unilateral'], equipment: ['dumbbell'],
    instr: {
      en: [
        '1) Place a heavy dumbbell beside one foot. Hinge at the hips with a flat back and grip it with the hand on that side.',
        '2) Stand up tall with the dumbbell hanging at your side, shoulders level, chest up and core braced. This is your starting position.',
        '3) Walk forward with short, controlled steps, resisting the pull of the weight so your torso stays upright and does not lean to either side.',
        '4) Cover the recommended distance or time, set the dumbbell down under control, then repeat holding it in the other hand.',
      ],
      es: [
        '1) Coloca una mancuerna pesada junto a un pie. Flexiona la cadera con la espalda recta y agárrala con la mano de ese lado.',
        '2) Incorpórate del todo con la mancuerna colgando al costado, los hombros nivelados, el pecho alto y el core firme. Esta es tu posición de partida.',
        '3) Camina hacia delante con pasos cortos y controlados, resistiendo el tirón del peso para que el torso quede erguido y no se incline hacia ningún lado.',
        '4) Recorre la distancia o el tiempo indicados, deja la mancuerna en el suelo con control y repite sujetándola con la otra mano.',
      ],
      it: [
        '1) Posiziona un manubrio pesante accanto a un piede. Inclina il busto in avanti facendo perno sulle anche, con la schiena piatta, e afferralo con la mano di quel lato.',
        '2) Alzati in piedi con il manubrio che pende lungo il fianco, le spalle allineate, il petto alto e il core attivo. Questa è la posizione di partenza.',
        '3) Cammina in avanti con passi corti e controllati, resistendo alla trazione del peso in modo che il busto resti eretto e non si inclini da nessun lato.',
        "4) Copri la distanza o il tempo consigliati, appoggia il manubrio a terra in modo controllato e ripeti tenendolo con l'altra mano.",
      ],
      fr: [
        "1) Placez un haltère lourd à côté d'un pied. Penchez le buste à partir des hanches en gardant le dos plat et saisissez-le avec la main de ce côté.",
        "2) Redressez-vous complètement, l'haltère pendant le long du corps, les épaules au même niveau, la poitrine haute et le gainage actif. C'est votre position de départ.",
        '3) Avancez par petits pas contrôlés en résistant à la traction de la charge pour que le buste reste droit et ne penche d\'aucun côté.',
        "4) Parcourez la distance ou la durée recommandée, reposez l'haltère au sol en contrôle, puis recommencez en le tenant dans l'autre main.",
      ],
      pt: [
        '1) Coloque um haltere pesado ao lado de um pé. Incline o tronco a partir das ancas, com as costas direitas, e segure-o com a mão desse lado.',
        '2) Levante-se por completo com o haltere pendurado ao lado do corpo, os ombros nivelados, o peito alto e o core ativo. Esta é a posição inicial.',
        '3) Caminhe em frente com passos curtos e controlados, resistindo à tração do peso para que o tronco fique direito e não incline para nenhum lado.',
        '4) Percorra a distância ou o tempo recomendados, pouse o haltere no chão de forma controlada e repita segurando-o com a outra mão.',
      ],
    },
  },
  {
    slug: 'tandem_stance_hold',
    demand: 31,
    name: {
      en: 'Tandem Stance Hold',
      es: 'Equilibrio en Tándem',
      it: 'Equilibrio in tandem',
      fr: 'Équilibre en tandem',
      pt: 'Equilíbrio em tandem',
    },
    aliases: [
      'Tandem Stance Hold', 'Equilibrio en Tándem', 'Postura en Tándem', 'Apoyo en Tándem',
      'Tandem Balance', 'Marcha en Tándem', 'Equilibrio in tandem', 'Équilibre en tandem', 'Equilíbrio em tandem',
    ],
    level: 'beginner',
    category: 'strength',
    pm: ['peroneals'], sm: ['tibialis', 'calves', 'glute_med', 'abs'],
    movementPattern: ['isolation'], forceType: ['isometric'], mechanic: ['compound'],
    laterality: ['unilateral'], equipment: ['bodyweight'],
    instr: {
      en: [
        '1) Stand tall next to a wall or rail you can touch if you lose your balance. Fix your gaze on a point in front of you. This is your starting position.',
        '2) Place one foot directly in front of the other so the heel of the front foot touches the toes of the back foot, as if standing on a line.',
        '3) Let go of the support, keep your arms relaxed at your sides and hold the position, correcting any wobble with small ankle adjustments.',
        '4) Hold for the recommended time, then switch which foot is in front and repeat.',
      ],
      es: [
        '1) Ponte de pie junto a una pared o barra que puedas tocar si pierdes el equilibrio. Fija la mirada en un punto delante de ti. Esta es tu posición de partida.',
        '2) Coloca un pie justo delante del otro, de modo que el talón del pie adelantado toque los dedos del pie de atrás, como si estuvieras sobre una línea.',
        '3) Suelta el apoyo, deja los brazos relajados a los costados y mantén la posición, corrigiendo los desequilibrios con pequeños ajustes del tobillo.',
        '4) Aguanta el tiempo indicado y después cambia el pie que va delante y repite.',
      ],
      it: [
        '1) Mettiti in piedi accanto a un muro o a una sbarra che puoi toccare se perdi l\'equilibrio. Fissa lo sguardo su un punto davanti a te. Questa è la posizione di partenza.',
        '2) Metti un piede esattamente davanti all\'altro, in modo che il tallone del piede avanti tocchi le dita del piede dietro, come se fossi su una linea.',
        '3) Lascia il sostegno, tieni le braccia rilassate lungo i fianchi e mantieni la posizione, correggendo le oscillazioni con piccoli aggiustamenti della caviglia.',
        '4) Mantieni per il tempo consigliato, poi cambia il piede davanti e ripeti.',
      ],
      fr: [
        "1) Tenez-vous debout à côté d'un mur ou d'une barre que vous pouvez toucher si vous perdez l'équilibre. Fixez un point devant vous. C'est votre position de départ.",
        '2) Placez un pied juste devant l\'autre, le talon du pied avant touchant les orteils du pied arrière, comme si vous étiez sur une ligne.',
        '3) Lâchez l\'appui, laissez les bras détendus le long du corps et maintenez la position en corrigeant les oscillations par de petits ajustements de la cheville.',
        '4) Tenez la durée recommandée, puis changez de pied avant et répétez.',
      ],
      pt: [
        '1) Fique de pé junto a uma parede ou barra em que possa tocar se perder o equilíbrio. Fixe o olhar num ponto à sua frente. Esta é a posição inicial.',
        '2) Coloque um pé mesmo à frente do outro, com o calcanhar do pé da frente a tocar nos dedos do pé de trás, como se estivesse sobre uma linha.',
        '3) Solte o apoio, mantenha os braços relaxados ao lado do corpo e aguente a posição, corrigindo as oscilações com pequenos ajustes do tornozelo.',
        '4) Mantenha durante o tempo recomendado e depois troque o pé da frente e repita.',
      ],
    },
  },
  {
    slug: 'dragon_flag',
    demand: 29,
    name: {
      en: 'Dragon Flag',
      es: 'Bandera Dragón',
      it: 'Dragon flag',
      fr: 'Dragon flag',
      pt: 'Bandeira do dragão',
    },
    aliases: [
      'Dragon Flag', 'Bandera Dragón', 'Bandera del Dragón', 'Dragon Flags',
      'Bandeira do dragão', 'Bandiera del drago',
    ],
    level: 'expert',
    category: 'strength',
    pm: ['abs'], sm: ['lower_abs', 'obliques', 'hip_flexors', 'lower_back'],
    movementPattern: ['anti_rotation'], forceType: ['isometric'], mechanic: ['compound'],
    laterality: ['bilateral'], equipment: ['bench'],
    instr: {
      en: [
        '1) Lie face up on a bench and reach back to grip its edge firmly behind your head with both hands. This is your starting position.',
        '2) Brace your core and squeeze your glutes, then drive your legs up until your body is stacked almost vertically, supported only on your upper back and shoulders.',
        '3) Keeping your body rigid in one straight line from shoulders to feet, lower yourself slowly toward the bench without letting your hips bend or your lower back arch.',
        '4) Stop just before you touch the bench, then pull back up to the vertical position. Repeat for the recommended repetitions.',
      ],
      es: [
        '1) Túmbate boca arriba en un banco y agarra con firmeza el borde por detrás de la cabeza con ambas manos. Esta es tu posición de partida.',
        '2) Activa el core y aprieta los glúteos; después sube las piernas hasta que el cuerpo quede casi vertical, apoyado solo en la espalda alta y los hombros.',
        '3) Manteniendo el cuerpo rígido en una línea recta de hombros a pies, desciende despacio hacia el banco sin dejar que la cadera se flexione ni que la zona lumbar se arquee.',
        '4) Detente justo antes de tocar el banco y vuelve a subir a la posición vertical. Repite las repeticiones indicadas.',
      ],
      it: [
        '1) Sdraiati supino su una panca e afferra saldamente il bordo dietro la testa con entrambe le mani. Questa è la posizione di partenza.',
        '2) Attiva il core e stringi i glutei, poi porta le gambe in alto finché il corpo non è quasi verticale, appoggiato solo sulla parte alta della schiena e sulle spalle.',
        '3) Mantenendo il corpo rigido in linea retta dalle spalle ai piedi, scendi lentamente verso la panca senza piegare le anche né inarcare la zona lombare.',
        '4) Fermati appena prima di toccare la panca, poi risali alla posizione verticale. Ripeti per le ripetizioni consigliate.',
      ],
      fr: [
        '1) Allongez-vous sur le dos sur un banc et agrippez fermement son bord derrière la tête avec les deux mains. C\'est votre position de départ.',
        '2) Gainez le tronc et serrez les fessiers, puis montez les jambes jusqu\'à ce que le corps soit presque vertical, en appui uniquement sur le haut du dos et les épaules.',
        '3) En gardant le corps rigide et aligné des épaules aux pieds, descendez lentement vers le banc sans fléchir les hanches ni creuser le bas du dos.',
        '4) Arrêtez-vous juste avant de toucher le banc, puis remontez à la verticale. Répétez le nombre de répétitions recommandé.',
      ],
      pt: [
        '1) Deite-se de barriga para cima num banco e agarre com firmeza a borda atrás da cabeça com as duas mãos. Esta é a posição inicial.',
        '2) Ative o core e aperte os glúteos; depois suba as pernas até o corpo ficar quase vertical, apoiado apenas na parte alta das costas e nos ombros.',
        '3) Mantendo o corpo rígido numa linha reta dos ombros aos pés, desça devagar em direção ao banco sem deixar as ancas dobrarem nem a zona lombar arquear.',
        '4) Pare mesmo antes de tocar no banco e volte a subir à posição vertical. Repita as repetições recomendadas.',
      ],
    },
  },
  {
    slug: 'spanish_squat',
    demand: 26,
    name: {
      en: 'Spanish Squat',
      es: 'Sentadilla Española',
      it: 'Squat spagnolo',
      fr: 'Squat espagnol',
      pt: 'Agachamento espanhol',
    },
    aliases: [
      'Spanish Squat', 'Sentadilla Española', 'Sentadilla Espanola', 'Spanish Squat con Banda',
      'Squat spagnolo', 'Squat espagnol', 'Agachamento espanhol',
    ],
    level: 'beginner',
    category: 'strength',
    pm: ['quadriceps'], sm: ['vastus_medialis', 'rectus_femoris', 'glutes'],
    movementPattern: ['squat'], forceType: ['push'], mechanic: ['compound'],
    laterality: ['bilateral'], equipment: ['resistance_band'],
    instr: {
      en: [
        '1) Loop a heavy resistance band around a solid anchor at knee height and step into it so the band wraps behind both knees. This is your starting position.',
        '2) Walk back until the band is tight and stand with your feet hip-width apart, chest up and arms in front of you for balance.',
        '3) Let the band pull your knees back as you sit straight down, keeping your shins vertical and your torso upright rather than leaning forward.',
        '4) Push through both feet to stand back up, squeezing your quadriceps at the top. Repeat for the recommended repetitions.',
      ],
      es: [
        '1) Pasa una banda elástica fuerte alrededor de un anclaje sólido a la altura de las rodillas y métete dentro para que la banda quede por detrás de ambas rodillas. Esta es tu posición de partida.',
        '2) Retrocede hasta tensar la banda y colócate con los pies a la anchura de las caderas, el pecho alto y los brazos al frente para equilibrarte.',
        '3) Deja que la banda lleve las rodillas hacia atrás mientras bajas recto, manteniendo las tibias verticales y el torso erguido en lugar de inclinarte hacia delante.',
        '4) Empuja con ambos pies para subir de nuevo, apretando los cuádriceps arriba. Repite las repeticiones indicadas.',
      ],
      it: [
        '1) Fai passare una banda elastica robusta attorno a un ancoraggio solido all\'altezza delle ginocchia ed entraci dentro in modo che la banda passi dietro entrambe le ginocchia. Questa è la posizione di partenza.',
        '2) Indietreggia finché la banda non è in tensione e mettiti con i piedi alla larghezza delle anche, il petto alto e le braccia in avanti per equilibrarti.',
        '3) Lascia che la banda porti indietro le ginocchia mentre scendi dritto, mantenendo le tibie verticali e il busto eretto invece di inclinarti in avanti.',
        '4) Spingi con entrambi i piedi per risalire, contraendo i quadricipiti in alto. Ripeti per le ripetizioni consigliate.',
      ],
      fr: [
        "1) Passez une bande élastique résistante autour d'un ancrage solide à hauteur des genoux et entrez dedans pour que la bande passe derrière les deux genoux. C'est votre position de départ.",
        '2) Reculez jusqu\'à mettre la bande en tension et placez-vous pieds écartés à la largeur des hanches, poitrine haute et bras devant vous pour l\'équilibre.',
        '3) Laissez la bande tirer vos genoux vers l\'arrière pendant que vous descendez à la verticale, en gardant les tibias verticaux et le buste droit plutôt que penché en avant.',
        '4) Poussez dans les deux pieds pour vous relever en contractant les quadriceps en haut. Répétez le nombre de répétitions recommandé.',
      ],
      pt: [
        '1) Passe uma banda elástica forte à volta de um ponto de fixação sólido à altura dos joelhos e entre nela para que a banda fique atrás dos dois joelhos. Esta é a posição inicial.',
        '2) Recue até a banda ficar em tensão e coloque-se com os pés à largura das ancas, o peito alto e os braços à frente para se equilibrar.',
        '3) Deixe a banda puxar os joelhos para trás enquanto desce a direito, mantendo as tíbias verticais e o tronco direito em vez de se inclinar para a frente.',
        '4) Empurre com os dois pés para voltar a subir, contraindo os quadríceps em cima. Repita as repetições recomendadas.',
      ],
    },
  },
  {
    slug: 'lateral_pogo_hops',
    demand: 18,
    name: {
      en: 'Lateral Pogo Hops',
      es: 'Saltos Pogo Laterales',
      it: 'Saltelli pogo laterali',
      fr: 'Sautillements pogo latéraux',
      pt: 'Saltos pogo laterais',
    },
    aliases: [
      'Lateral Pogo Hops', 'Saltos Pogo Laterales', 'Pogo Lateral', 'Pogos Laterales',
      'Side to Side Pogo Hops', 'Saltelli pogo laterali', 'Sautillements pogo latéraux', 'Saltos pogo laterais',
    ],
    level: 'intermediate',
    category: 'plyometrics',
    pm: ['calves'], sm: ['gastrocnemius', 'soleus', 'peroneals', 'glute_med'],
    movementPattern: ['squat'], forceType: ['push'], mechanic: ['compound'],
    laterality: ['bilateral'], equipment: ['bodyweight'],
    instr: {
      en: [
        '1) Stand tall with your feet together, knees almost straight and your weight on the balls of your feet. This is your starting position.',
        '2) Keep your ankles stiff and your torso upright, with your arms bent at your sides to help you balance.',
        '3) Hop sideways a short distance, landing on the balls of both feet and spending as little time as possible on the ground.',
        '4) Rebound immediately back in the opposite direction, keeping the rhythm quick and springy. Repeat for the recommended repetitions or time.',
      ],
      es: [
        '1) Ponte de pie con los pies juntos, las rodillas casi estiradas y el peso en la parte anterior de los pies. Esta es tu posición de partida.',
        '2) Mantén los tobillos rígidos y el torso erguido, con los brazos flexionados a los costados para ayudarte a equilibrar.',
        '3) Salta lateralmente una distancia corta y cae sobre la parte anterior de ambos pies, pasando el menor tiempo posible en el suelo.',
        '4) Rebota inmediatamente en la dirección contraria, manteniendo un ritmo rápido y elástico. Repite las repeticiones o el tiempo indicados.',
      ],
      it: [
        '1) Mettiti in piedi con i piedi uniti, le ginocchia quasi distese e il peso sull\'avampiede. Questa è la posizione di partenza.',
        '2) Mantieni le caviglie rigide e il busto eretto, con le braccia piegate lungo i fianchi per aiutarti a stare in equilibrio.',
        '3) Saltella lateralmente per una breve distanza e atterra sull\'avampiede di entrambi i piedi, restando a terra il meno possibile.',
        '4) Rimbalza subito nella direzione opposta, mantenendo un ritmo rapido ed elastico. Ripeti per le ripetizioni o il tempo consigliati.',
      ],
      fr: [
        "1) Tenez-vous debout, pieds joints, genoux presque tendus et poids sur l'avant des pieds. C'est votre position de départ.",
        '2) Gardez les chevilles rigides et le buste droit, les bras fléchis le long du corps pour vous aider à garder l\'équilibre.',
        '3) Sautez latéralement sur une courte distance et atterrissez sur l\'avant des deux pieds en restant au sol le moins longtemps possible.',
        '4) Rebondissez immédiatement dans la direction opposée en gardant un rythme rapide et élastique. Répétez le nombre de répétitions ou la durée recommandée.',
      ],
      pt: [
        '1) Fique de pé com os pés juntos, os joelhos quase esticados e o peso na parte da frente dos pés. Esta é a posição inicial.',
        '2) Mantenha os tornozelos rígidos e o tronco direito, com os braços fletidos ao lado do corpo para o ajudar a equilibrar.',
        '3) Salte lateralmente uma distância curta e aterre sobre a parte da frente dos dois pés, passando o menos tempo possível no chão.',
        '4) Volte a saltar de imediato na direção oposta, mantendo um ritmo rápido e elástico. Repita as repetições ou o tempo recomendados.',
      ],
    },
  },
  {
    slug: 'negative_pull_up',
    demand: 14,
    name: {
      en: 'Negative Pull-Up',
      es: 'Dominada Negativa',
      it: 'Trazione negativa',
      fr: 'Traction négative',
      pt: 'Elevação negativa',
    },
    aliases: [
      'Negative Pull-Up', 'Dominada Negativa', 'Dominadas Negativas', 'Dominada Excéntrica',
      'Eccentric Pull-Up', 'Trazione negativa', 'Traction négative', 'Elevação negativa',
    ],
    level: 'beginner',
    category: 'strength',
    pm: ['lats'], sm: ['biceps', 'mid_traps', 'rhomboids', 'rear_delts'],
    movementPattern: ['vertical_pull'], forceType: ['pull'], mechanic: ['compound'],
    laterality: ['bilateral'], equipment: ['pull_up_bar'],
    instr: {
      en: [
        '1) Set a box or bench under a pull-up bar so you can step up and reach the top position without jumping.',
        '2) Grip the bar with an overhand grip slightly wider than your shoulders and step up until your chin is above the bar, chest close to it. This is your starting position.',
        '3) Take your feet off the box and hold the top position for a moment, keeping your shoulders pulled down and your core braced.',
        '4) Lower yourself as slowly as you can until your arms are fully extended, then step back onto the box to reset. Repeat for the recommended repetitions.',
      ],
      es: [
        '1) Coloca un cajón o banco bajo una barra de dominadas para poder subir y alcanzar la posición alta sin saltar.',
        '2) Agarra la barra en pronación algo más ancho que los hombros y súbete hasta que la barbilla quede por encima de la barra, con el pecho cerca. Esta es tu posición de partida.',
        '3) Retira los pies del cajón y mantén la posición alta un momento, con los hombros hacia abajo y el core firme.',
        '4) Baja lo más despacio que puedas hasta estirar del todo los brazos y vuelve a subirte al cajón para recolocarte. Repite las repeticiones indicadas.',
      ],
      it: [
        '1) Posiziona un box o una panca sotto una sbarra per trazioni in modo da poter salire e raggiungere la posizione alta senza saltare.',
        '2) Afferra la sbarra con presa prona poco più larga delle spalle e sali finché il mento non supera la sbarra, con il petto vicino. Questa è la posizione di partenza.',
        '3) Togli i piedi dal box e mantieni la posizione alta per un istante, con le spalle basse e il core attivo.',
        '4) Scendi il più lentamente possibile fino a distendere completamente le braccia, poi risali sul box per ripartire. Ripeti per le ripetizioni consigliate.',
      ],
      fr: [
        '1) Placez une box ou un banc sous une barre de traction pour pouvoir monter et atteindre la position haute sans sauter.',
        '2) Saisissez la barre en pronation, un peu plus large que les épaules, et montez jusqu\'à ce que le menton dépasse la barre, poitrine proche. C\'est votre position de départ.',
        '3) Retirez les pieds de la box et tenez la position haute un instant, épaules basses et gainage actif.',
        '4) Descendez le plus lentement possible jusqu\'à tendre complètement les bras, puis remontez sur la box pour repartir. Répétez le nombre de répétitions recommandé.',
      ],
      pt: [
        '1) Coloque um caixote ou banco por baixo de uma barra de elevações para poder subir e alcançar a posição alta sem saltar.',
        '2) Agarre a barra em pronação, um pouco mais afastado do que os ombros, e suba até o queixo ficar acima da barra, com o peito perto. Esta é a posição inicial.',
        '3) Retire os pés do caixote e aguente a posição alta por um momento, com os ombros para baixo e o core ativo.',
        '4) Desça o mais devagar possível até esticar completamente os braços e volte a subir para o caixote para recomeçar. Repita as repetições recomendadas.',
      ],
    },
  },
  {
    slug: 'seal_row',
    demand: 14,
    name: {
      en: 'Seal Row',
      es: 'Remo Seal',
      it: 'Seal row',
      fr: 'Seal row',
      pt: 'Remada seal',
    },
    aliases: [
      'Seal Row', 'Remo Seal', 'Remo Tumbado en Banco', 'Barbell Seal Row',
      'Remo Foca', 'Remada seal',
    ],
    level: 'intermediate',
    category: 'strength',
    pm: ['mid_traps'], sm: ['lats', 'rhomboids', 'rear_delts', 'biceps'],
    movementPattern: ['horizontal_pull'], forceType: ['pull'], mechanic: ['compound'],
    laterality: ['bilateral'], equipment: ['barbell'],
    instr: {
      en: [
        '1) Set a bench high enough on solid blocks that a loaded barbell can hang underneath without touching the floor.',
        '2) Lie face down on the bench with your chest supported and your legs relaxed, then reach down and grip the barbell slightly wider than shoulder-width. This is your starting position.',
        '3) Keeping your chest flat on the bench, pull the bar up to the underside of the bench by driving your elbows back and squeezing your shoulder blades together.',
        '4) Lower the bar under control until your arms are fully extended, without lifting your chest off the bench. Repeat for the recommended repetitions.',
      ],
      es: [
        '1) Coloca un banco lo bastante alto sobre soportes sólidos para que una barra cargada quede colgando debajo sin tocar el suelo.',
        '2) Túmbate boca abajo en el banco con el pecho apoyado y las piernas relajadas; después baja las manos y agarra la barra algo más ancho que los hombros. Esta es tu posición de partida.',
        '3) Manteniendo el pecho pegado al banco, tira de la barra hacia la parte inferior del banco llevando los codos atrás y juntando las escápulas.',
        '4) Baja la barra con control hasta estirar del todo los brazos, sin despegar el pecho del banco. Repite las repeticiones indicadas.',
      ],
      it: [
        '1) Posiziona una panca abbastanza in alto su supporti solidi in modo che un bilanciere carico possa restare sospeso sotto senza toccare il pavimento.',
        '2) Sdraiati a pancia in giù sulla panca con il petto appoggiato e le gambe rilassate, poi abbassa le mani e afferra il bilanciere poco più largo delle spalle. Questa è la posizione di partenza.',
        '3) Mantenendo il petto aderente alla panca, tira il bilanciere verso la parte inferiore della panca portando indietro i gomiti e avvicinando le scapole.',
        '4) Abbassa il bilanciere in modo controllato fino a distendere completamente le braccia, senza staccare il petto dalla panca. Ripeti per le ripetizioni consigliate.',
      ],
      fr: [
        "1) Installez un banc suffisamment haut sur des supports solides pour qu'une barre chargée puisse pendre en dessous sans toucher le sol.",
        '2) Allongez-vous à plat ventre sur le banc, poitrine en appui et jambes relâchées, puis descendez les mains et saisissez la barre un peu plus large que les épaules. C\'est votre position de départ.',
        '3) En gardant la poitrine collée au banc, tirez la barre vers le dessous du banc en ramenant les coudes en arrière et en resserrant les omoplates.',
        '4) Redescendez la barre en contrôle jusqu\'à tendre complètement les bras, sans décoller la poitrine du banc. Répétez le nombre de répétitions recommandé.',
      ],
      pt: [
        '1) Coloque um banco suficientemente alto sobre apoios sólidos para que uma barra carregada possa ficar suspensa por baixo sem tocar no chão.',
        '2) Deite-se de barriga para baixo no banco com o peito apoiado e as pernas relaxadas; depois desça as mãos e agarre a barra um pouco mais afastado do que os ombros. Esta é a posição inicial.',
        '3) Mantendo o peito encostado ao banco, puxe a barra até à parte de baixo do banco levando os cotovelos para trás e juntando as omoplatas.',
        '4) Desça a barra de forma controlada até esticar completamente os braços, sem descolar o peito do banco. Repita as repetições recomendadas.',
      ],
    },
  },
  {
    slug: 'hand_release_push_up',
    demand: 12,
    name: {
      en: 'Hand Release Push-Up',
      es: 'Flexión con Manos Liberadas',
      it: 'Piegamento con rilascio delle mani',
      fr: 'Pompe avec décollement des mains',
      pt: 'Flexão com libertação das mãos',
    },
    aliases: [
      'Hand Release Push-Up', 'Flexión con Manos Liberadas', 'Hand Release Push Up',
      'Flexión con Despegue de Manos', 'Lagartija con Manos Liberadas',
      'Piegamento con rilascio delle mani', 'Pompe avec décollement des mains', 'Flexão com libertação das mãos',
    ],
    level: 'intermediate',
    category: 'strength',
    pm: ['chest'], sm: ['triceps', 'front_delts', 'abs'],
    movementPattern: ['horizontal_push'], forceType: ['push'], mechanic: ['compound'],
    laterality: ['bilateral'], equipment: ['bodyweight'],
    instr: {
      en: [
        '1) Start in a high plank with your hands under your shoulders, body in a straight line from head to heels and core braced. This is your starting position.',
        '2) Bend your elbows and lower your whole body until your chest and thighs rest on the floor.',
        '3) Lift both hands off the floor for a moment, keeping your body still and your neck neutral.',
        '4) Place your hands back down and press through them to push your body back up to the plank in one piece. Repeat for the recommended repetitions.',
      ],
      es: [
        '1) Empieza en plancha alta con las manos bajo los hombros, el cuerpo en línea recta de la cabeza a los talones y el core firme. Esta es tu posición de partida.',
        '2) Flexiona los codos y baja todo el cuerpo hasta apoyar el pecho y los muslos en el suelo.',
        '3) Despega ambas manos del suelo un instante, manteniendo el cuerpo quieto y el cuello neutro.',
        '4) Vuelve a apoyar las manos y empuja con ellas para subir el cuerpo entero a la plancha en bloque. Repite las repeticiones indicadas.',
      ],
      it: [
        '1) Parti in plank alto con le mani sotto le spalle, il corpo in linea retta dalla testa ai talloni e il core attivo. Questa è la posizione di partenza.',
        '2) Piega i gomiti e abbassa tutto il corpo finché petto e cosce non appoggiano a terra.',
        '3) Solleva entrambe le mani dal pavimento per un istante, mantenendo il corpo fermo e il collo neutro.',
        '4) Riappoggia le mani e spingi per riportare il corpo in plank in un unico blocco. Ripeti per le ripetizioni consigliate.',
      ],
      fr: [
        "1) Placez-vous en planche haute, mains sous les épaules, corps aligné de la tête aux talons et gainage actif. C'est votre position de départ.",
        '2) Fléchissez les coudes et descendez tout le corps jusqu\'à poser la poitrine et les cuisses au sol.',
        '3) Décollez les deux mains du sol un instant, en gardant le corps immobile et la nuque neutre.',
        '4) Reposez les mains et poussez dessus pour remonter le corps d\'un seul bloc en planche. Répétez le nombre de répétitions recommandé.',
      ],
      pt: [
        '1) Comece em prancha alta com as mãos por baixo dos ombros, o corpo numa linha reta da cabeça aos calcanhares e o core ativo. Esta é a posição inicial.',
        '2) Flita os cotovelos e desça o corpo todo até apoiar o peito e as coxas no chão.',
        '3) Levante as duas mãos do chão por um instante, mantendo o corpo imóvel e o pescoço neutro.',
        '4) Volte a apoiar as mãos e empurre para subir o corpo inteiro até à prancha num só bloco. Repita as repetições recomendadas.',
      ],
    },
  },
  {
    slug: 'triple_hop',
    demand: 8,
    name: {
      en: 'Triple Hop',
      es: 'Triple Salto a una Pierna',
      it: 'Triplo balzo su una gamba',
      fr: 'Triple bond sur une jambe',
      pt: 'Triplo salto a uma perna',
    },
    aliases: [
      'Triple Hop', 'Triple Salto a una Pierna', 'Triple Hop Test', 'Triple Salto Unipodal',
      'Triple Hop for Distance', 'Triplo balzo su una gamba', 'Triple bond sur une jambe', 'Triplo salto a uma perna',
    ],
    level: 'expert',
    category: 'plyometrics',
    pm: ['quadriceps'], sm: ['glutes', 'hamstrings', 'calves', 'abs'],
    movementPattern: ['lunge'], forceType: ['push'], mechanic: ['compound'],
    laterality: ['unilateral'], equipment: ['bodyweight'],
    instr: {
      en: [
        '1) Stand on one leg behind a starting line with your knee slightly bent and your arms back, ready to swing. This is your starting position.',
        '2) Swing your arms forward and hop as far as you can, landing on the same leg with a soft knee.',
        '3) Without stopping, use the landing to rebound straight into a second hop, then a third, keeping each contact short and balanced.',
        '4) Stick the final landing and hold it for two seconds under control. Complete the recommended repetitions, then switch legs.',
      ],
      es: [
        '1) Ponte de pie sobre una pierna detrás de una línea de salida, con la rodilla ligeramente flexionada y los brazos atrás, listos para impulsarte. Esta es tu posición de partida.',
        '2) Lleva los brazos hacia delante y salta lo más lejos que puedas, cayendo sobre la misma pierna con la rodilla blanda.',
        '3) Sin detenerte, aprovecha la caída para encadenar un segundo salto y después un tercero, manteniendo cada contacto corto y equilibrado.',
        '4) Fija la última caída y mantenla dos segundos con control. Completa las repeticiones indicadas y cambia de pierna.',
      ],
      it: [
        '1) Mettiti in piedi su una gamba dietro una linea di partenza, con il ginocchio leggermente piegato e le braccia indietro, pronte a slanciarsi. Questa è la posizione di partenza.',
        '2) Porta le braccia in avanti e salta il più lontano possibile, atterrando sulla stessa gamba con il ginocchio morbido.',
        '3) Senza fermarti, sfrutta l\'atterraggio per concatenare un secondo balzo e poi un terzo, mantenendo ogni contatto breve ed equilibrato.',
        '4) Blocca l\'ultimo atterraggio e mantienilo due secondi in controllo. Completa le ripetizioni consigliate, poi cambia gamba.',
      ],
      fr: [
        '1) Tenez-vous sur une jambe derrière une ligne de départ, genou légèrement fléchi et bras en arrière, prêts à s\'élancer. C\'est votre position de départ.',
        '2) Lancez les bras vers l\'avant et bondissez le plus loin possible, en atterrissant sur la même jambe avec le genou souple.',
        '3) Sans vous arrêter, utilisez la réception pour enchaîner un deuxième bond puis un troisième, en gardant chaque contact bref et équilibré.',
        '4) Bloquez la dernière réception et tenez-la deux secondes en contrôle. Effectuez le nombre de répétitions recommandé, puis changez de jambe.',
      ],
      pt: [
        '1) Fique de pé sobre uma perna atrás de uma linha de partida, com o joelho ligeiramente fletido e os braços atrás, prontos a impulsionar. Esta é a posição inicial.',
        '2) Leve os braços à frente e salte o mais longe que conseguir, aterrando sobre a mesma perna com o joelho solto.',
        '3) Sem parar, aproveite a aterragem para encadear um segundo salto e depois um terceiro, mantendo cada contacto curto e equilibrado.',
        '4) Fixe a última aterragem e aguente dois segundos com controlo. Complete as repetições recomendadas e mude de perna.',
      ],
    },
  },
];

const LANGS = ['en', 'es', 'it', 'fr', 'pt'];

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
      name: Object.fromEntries(LANGS.map((l) => [l, def.name[l]])),
      instructions: Object.fromEntries(LANGS.map((l) => [l, def.instr[l]])),
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
toAdd.forEach((d) => console.log(`  + ${d.slug} (demanda: ${d.demand} busquedas sin resultados)`));

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
