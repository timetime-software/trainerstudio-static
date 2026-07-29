// Seed del lote 2026-07-29: 10 ejercicios mas buscados en produccion que
// devuelven 0 resultados Y que ademas no existen en el dataset.
//
// Origen de la seleccion: eventos `PublicExerciseSearched` con
// `data.resultsCount: 0` en la Mongo de produccion desde el 23-may-2026,
// agregados por termino, sumadas todas las variantes de tecleo y erratas de
// cada concepto, y filtrados contra `data/exercises.ndjson`.
//
// Respecto al lote anterior se aplica un filtro extra: se descartan los
// terminos que SI tienen ejercicio en el catalogo y fallan por sinonimo
// (`almeja` -> clamshell, `espinales` -> hyperextensions, `vuelos laterales` ->
// elevaciones laterales, `caminadora` -> cinta, `drop jump` -> depth jump).
// Esos van a DEMAND_BACKLOG.md como trabajo de backend, no de contenido.
//
// Mismo contrato y mecanica que seed-batch-2026-07-28.mjs: crea SOLO las
// entradas que no existan ya (idempotente por cdnslug). Se crean SIN media: la
// referencia de video y la generacion del clip default se hacen despues con el
// pipeline de video (ver README "Ark Style Tasks"). Se marcan con
// metadata.batch para poder filtrarlas en el editor ("Lote 2026-07-29"); ese
// campo se descarta en build:public (no llega a MongoDB).
//
//   node seed-batch-2026-07-29.mjs            # aplica los cambios
//   node seed-batch-2026-07-29.mjs --dry-run  # solo informa

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { identityKeyForSlug, idForIdentityKey } from './exercise-ids.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, 'data', 'exercises.ndjson');
const DRY = process.argv.includes('--dry-run');
const BATCH = '2026-07-29';

// `demand` = nº de busquedas con 0 resultados desde el 23-may-2026 (fecha en la
// que entro en produccion el buscador con Atlas Search), sumando todas las
// variantes, prefijos y erratas del concepto.
const DEFS = [
  {
    slug: 'serratus_wall_slide',
    demand: 148,
    name: {
      en: 'Serratus Wall Slide',
      es: 'Deslizamiento en Pared para el Serrato',
      it: 'Scivolamento al muro per il dentato',
      fr: 'Glissé au mur pour le dentelé',
      pt: 'Deslizamento na parede para o serrátil',
    },
    aliases: [
      'Serratus Wall Slide', 'Deslizamiento en Pared para el Serrato', 'Serrato en Pared',
      'Serratus Slide', 'Wall Slide Serrato', 'Scivolamento al muro per il dentato',
      'Glissé au mur pour le dentelé', 'Deslizamento na parede para o serrátil',
    ],
    level: 'beginner',
    category: 'strength',
    pm: ['serratus'], sm: ['lower_traps', 'front_delts', 'rotator_cuff', 'abs'],
    movementPattern: ['vertical_push'], forceType: ['push'], mechanic: ['isolation'],
    laterality: ['bilateral'], equipment: ['bodyweight'],
    instr: {
      en: [
        '1) Stand about half a step away from a wall and place both forearms on it, elbows at shoulder height and shoulder-width apart, palms facing each other. This is your starting position.',
        '2) Tuck your ribs down and press your forearms firmly into the wall so your shoulder blades wrap around your ribcage.',
        '3) Keeping that pressure, slide your forearms up the wall until your arms are overhead, letting your shoulder blades rotate upward and travel with the movement.',
        '4) Slide back down under control to shoulder height without letting your lower back arch. Repeat for the recommended repetitions.',
      ],
      es: [
        '1) Colócate a medio paso de una pared y apoya los dos antebrazos en ella, con los codos a la altura de los hombros y separados a la anchura de estos, las palmas enfrentadas. Esta es tu posición de partida.',
        '2) Lleva las costillas hacia abajo y empuja los antebrazos con firmeza contra la pared para que las escápulas se abracen a la caja torácica.',
        '3) Sin dejar de empujar, desliza los antebrazos por la pared hasta llevar los brazos por encima de la cabeza, permitiendo que las escápulas roten hacia arriba y acompañen el movimiento.',
        '4) Baja deslizando con control hasta la altura de los hombros sin arquear la zona lumbar. Repite las repeticiones indicadas.',
      ],
      it: [
        '1) Mettiti a mezzo passo da un muro e appoggia entrambi gli avambracci, con i gomiti all\'altezza delle spalle e alla loro larghezza, i palmi uno di fronte all\'altro. Questa è la posizione di partenza.',
        '2) Porta le costole verso il basso e spingi con decisione gli avambracci contro il muro, in modo che le scapole avvolgano la gabbia toracica.',
        '3) Mantenendo quella spinta, fai scivolare gli avambracci lungo il muro fino a portare le braccia sopra la testa, lasciando che le scapole ruotino verso l\'alto e accompagnino il movimento.',
        '4) Scendi scivolando in controllo fino all\'altezza delle spalle senza inarcare la zona lombare. Ripeti per le ripetizioni consigliate.',
      ],
      fr: [
        "1) Placez-vous à un demi-pas d'un mur et posez-y les deux avant-bras, coudes à hauteur d'épaules et écartés de la largeur des épaules, paumes face à face. C'est votre position de départ.",
        '2) Rentrez les côtes vers le bas et poussez fermement les avant-bras contre le mur pour que les omoplates enveloppent la cage thoracique.',
        '3) En gardant cette pression, faites glisser les avant-bras le long du mur jusqu\'à amener les bras au-dessus de la tête, en laissant les omoplates tourner vers le haut et accompagner le mouvement.',
        '4) Redescendez en glissant, en contrôle, jusqu\'à hauteur d\'épaules sans cambrer le bas du dos. Répétez le nombre de répétitions recommandé.',
      ],
      pt: [
        '1) Coloque-se a meio passo de uma parede e apoie nela os dois antebraços, com os cotovelos à altura dos ombros e afastados à largura destes, as palmas viradas uma para a outra. Esta é a posição inicial.',
        '2) Leve as costelas para baixo e empurre os antebraços com firmeza contra a parede para que as omoplatas abracem a caixa torácica.',
        '3) Sem deixar de empurrar, deslize os antebraços pela parede até levar os braços acima da cabeça, permitindo que as omoplatas rodem para cima e acompanhem o movimento.',
        '4) Desça a deslizar com controlo até à altura dos ombros sem arquear a zona lombar. Repita as repetições recomendadas.',
      ],
    },
  },
  {
    slug: 'high_hang_snatch',
    demand: 103,
    name: {
      en: 'High Hang Snatch',
      es: 'Arrancada desde Suspensión Alta',
      it: 'Strappo dalla sospensione alta',
      fr: 'Arraché depuis suspension haute',
      pt: 'Arranco a partir de suspensão alta',
    },
    aliases: [
      'High Hang Snatch', 'Arrancada desde Suspensión Alta', 'Arrancada Colgante Alta',
      'High Hang Power Snatch', 'Snatch desde Suspensión Alta', 'Strappo dalla sospensione alta',
      'Arraché depuis suspension haute', 'Arranco a partir de suspensão alta',
    ],
    level: 'expert',
    category: 'strength',
    pm: ['quadriceps'], sm: ['glutes', 'hamstrings', 'traps', 'shoulders', 'lower_back', 'calves'],
    movementPattern: ['vertical_pull'], forceType: ['mixed'], mechanic: ['compound'],
    laterality: ['bilateral'], equipment: ['barbell'],
    instr: {
      en: [
        '1) Stand tall holding a barbell at hip height with a wide snatch grip, feet hip-width apart and arms straight. This is your starting position.',
        '2) Push your hips back a few centimetres until the bar reaches the top of your thighs, keeping your chest up, your back flat and the bar close to your body.',
        '3) Extend your hips, knees and ankles explosively to drive the bar upward, then pull yourself under it by shrugging and punching your arms straight overhead.',
        '4) Receive the bar locked out over the middle of your feet in a partial squat, stand up under control, then return the bar to hip height for the next repetition.',
      ],
      es: [
        '1) Ponte de pie sujetando una barra a la altura de la cadera con agarre ancho de arrancada, los pies a la anchura de la cadera y los brazos estirados. Esta es tu posición de partida.',
        '2) Lleva la cadera atrás unos centímetros hasta que la barra llegue a la parte alta de los muslos, con el pecho alto, la espalda recta y la barra pegada al cuerpo.',
        '3) Extiende cadera, rodillas y tobillos de forma explosiva para impulsar la barra hacia arriba y, sin pausa, métete debajo encogiendo los hombros y estirando los brazos por encima de la cabeza.',
        '4) Recibe la barra bloqueada sobre la mitad del pie en una sentadilla parcial, incorpórate con control y devuelve la barra a la altura de la cadera para la siguiente repetición.',
      ],
      it: [
        '1) Mettiti in piedi con un bilanciere all\'altezza delle anche, presa larga da strappo, piedi alla larghezza delle anche e braccia distese. Questa è la posizione di partenza.',
        '2) Porta le anche indietro di qualche centimetro finché il bilanciere non arriva alla parte alta delle cosce, con il petto alto, la schiena piatta e il bilanciere vicino al corpo.',
        '3) Estendi anche, ginocchia e caviglie in modo esplosivo per spingere il bilanciere verso l\'alto, poi infilati sotto scrollando le spalle e distendendo le braccia sopra la testa.',
        '4) Ricevi il bilanciere bloccato sopra la metà del piede in un mezzo squat, alzati in controllo e riporta il bilanciere all\'altezza delle anche per la ripetizione successiva.',
      ],
      fr: [
        "1) Tenez-vous debout, une barre à hauteur de hanches avec une prise large d'arraché, pieds à la largeur des hanches et bras tendus. C'est votre position de départ.",
        '2) Reculez les hanches de quelques centimètres jusqu\'à ce que la barre atteigne le haut des cuisses, poitrine haute, dos plat et barre près du corps.',
        '3) Étendez hanches, genoux et chevilles de façon explosive pour propulser la barre vers le haut, puis passez sous la barre en haussant les épaules et en tendant les bras au-dessus de la tête.',
        '4) Recevez la barre bloquée au-dessus du milieu des pieds en demi-squat, redressez-vous en contrôle, puis ramenez la barre à hauteur de hanches pour la répétition suivante.',
      ],
      pt: [
        '1) Fique de pé segurando uma barra à altura das ancas com pega larga de arranco, os pés à largura das ancas e os braços esticados. Esta é a posição inicial.',
        '2) Leve as ancas atrás alguns centímetros até a barra chegar à parte alta das coxas, com o peito alto, as costas direitas e a barra junto ao corpo.',
        '3) Estenda ancas, joelhos e tornozelos de forma explosiva para impulsionar a barra para cima e, sem pausa, passe por baixo dela encolhendo os ombros e esticando os braços acima da cabeça.',
        '4) Receba a barra bloqueada sobre o meio do pé num agachamento parcial, levante-se com controlo e devolva a barra à altura das ancas para a repetição seguinte.',
      ],
    },
  },
  {
    slug: 'scapular_depression',
    demand: 74,
    name: {
      en: 'Scapular Depression',
      es: 'Depresión Escapular',
      it: 'Depressione scapolare',
      fr: 'Dépression scapulaire',
      pt: 'Depressão escapular',
    },
    aliases: [
      'Scapular Depression', 'Depresión Escapular', 'Descenso Escapular', 'Scap Depression',
      'Depresión de Escápulas', 'Depressione scapolare', 'Dépression scapulaire', 'Depressão escapular',
    ],
    level: 'beginner',
    category: 'strength',
    pm: ['lower_traps'], sm: ['lats', 'mid_traps', 'teres', 'rhomboids'],
    movementPattern: ['vertical_pull'], forceType: ['pull'], mechanic: ['isolation'],
    laterality: ['bilateral'], equipment: ['pull_up_bar', 'bodyweight'],
    instr: {
      en: [
        '1) Hang from a pull-up bar with an overhand grip, arms fully straight and shoulders relaxed up toward your ears. This is your starting position.',
        '2) Brace your core and keep your legs still so the movement comes only from your shoulder blades.',
        '3) Without bending your elbows, pull your shoulder blades down and back to lift your body a few centimetres.',
        '4) Hold the bottom of the shoulder blades for one second, then relax slowly back into the passive hang. Repeat for the recommended repetitions.',
      ],
      es: [
        '1) Cuélgate de una barra de dominadas con agarre prono, los brazos completamente estirados y los hombros relajados hacia las orejas. Esta es tu posición de partida.',
        '2) Activa el core y mantén las piernas quietas para que el movimiento salga solo de las escápulas.',
        '3) Sin flexionar los codos, lleva las escápulas hacia abajo y atrás para elevar el cuerpo unos centímetros.',
        '4) Mantén las escápulas abajo un segundo y relaja despacio hasta volver a la suspensión pasiva. Repite las repeticiones indicadas.',
      ],
      it: [
        '1) Appenditi a una sbarra per trazioni con presa prona, braccia completamente distese e spalle rilassate verso le orecchie. Questa è la posizione di partenza.',
        '2) Attiva il core e tieni ferme le gambe, in modo che il movimento parta solo dalle scapole.',
        '3) Senza piegare i gomiti, porta le scapole verso il basso e indietro per sollevare il corpo di qualche centimetro.',
        '4) Mantieni le scapole in basso per un secondo, poi rilascia lentamente fino a tornare alla sospensione passiva. Ripeti per le ripetizioni consigliate.',
      ],
      fr: [
        '1) Suspendez-vous à une barre de traction en prise pronation, bras complètement tendus et épaules relâchées vers les oreilles. C\'est votre position de départ.',
        '2) Gainez le tronc et gardez les jambes immobiles pour que le mouvement vienne uniquement des omoplates.',
        '3) Sans plier les coudes, tirez les omoplates vers le bas et vers l\'arrière pour soulever le corps de quelques centimètres.',
        '4) Tenez les omoplates basses une seconde, puis relâchez lentement pour revenir à la suspension passive. Répétez le nombre de répétitions recommandé.',
      ],
      pt: [
        '1) Pendure-se numa barra de dominadas com pega pronada, os braços completamente esticados e os ombros relaxados em direção às orelhas. Esta é a posição inicial.',
        '2) Ative o core e mantenha as pernas paradas para que o movimento venha apenas das omoplatas.',
        '3) Sem dobrar os cotovelos, puxe as omoplatas para baixo e para trás para elevar o corpo alguns centímetros.',
        '4) Aguente com as omoplatas em baixo durante um segundo e relaxe devagar até voltar à suspensão passiva. Repita as repetições recomendadas.',
      ],
    },
  },
  {
    slug: 'banded_psoas_march',
    demand: 61,
    name: {
      en: 'Banded Psoas March',
      es: 'Marcha de Psoas con Banda',
      it: 'Marcia dello psoas con elastico',
      fr: 'Marche du psoas avec élastique',
      pt: 'Marcha do psoas com banda',
    },
    aliases: [
      'Banded Psoas March', 'Marcha de Psoas con Banda', 'Psoas March', 'Marcha de Psoas',
      'Marcha de Flexores de Cadera', 'Marcia dello psoas con elastico',
      'Marche du psoas avec élastique', 'Marcha do psoas com banda',
    ],
    level: 'beginner',
    category: 'strength',
    pm: ['hip_flexors'], sm: ['abs', 'transverse', 'quadriceps', 'glutes'],
    movementPattern: ['isolation'], forceType: ['pull'], mechanic: ['isolation'],
    laterality: ['alternating'], equipment: ['resistance_band'],
    instr: {
      en: [
        '1) Anchor a resistance band low behind you, loop it around both feet and lie on your back with your hips and knees bent to ninety degrees. This is your starting position.',
        '2) Press your lower back into the floor and brace your abs so your pelvis stays flat throughout the set.',
        '3) Keeping one knee pulled toward your chest against the band, push the other leg away until it is almost straight, without letting your back arch off the floor.',
        '4) Pull that leg back to ninety degrees and repeat on the other side, alternating legs for the recommended repetitions.',
      ],
      es: [
        '1) Ancla una banda elástica baja por detrás de ti, pásala por los dos pies y túmbate boca arriba con caderas y rodillas flexionadas a noventa grados. Esta es tu posición de partida.',
        '2) Pega la zona lumbar al suelo y activa los abdominales para que la pelvis se mantenga fija durante toda la serie.',
        '3) Manteniendo una rodilla llevada hacia el pecho contra la banda, empuja la otra pierna hasta casi estirarla, sin dejar que la espalda se despegue del suelo.',
        '4) Recoge esa pierna de nuevo a noventa grados y repite con la otra, alternando piernas durante las repeticiones indicadas.',
      ],
      it: [
        '1) Ancora un elastico in basso dietro di te, passalo intorno a entrambi i piedi e sdraiati supino con anche e ginocchia flesse a novanta gradi. Questa è la posizione di partenza.',
        '2) Schiaccia la zona lombare a terra e attiva gli addominali in modo che il bacino resti fermo per tutta la serie.',
        '3) Mantenendo un ginocchio tirato verso il petto contro l\'elastico, spingi l\'altra gamba fino quasi a distenderla, senza far staccare la schiena dal pavimento.',
        '4) Richiama quella gamba a novanta gradi e ripeti con l\'altra, alternando le gambe per le ripetizioni consigliate.',
      ],
      fr: [
        '1) Ancrez un élastique en position basse derrière vous, passez-le autour des deux pieds et allongez-vous sur le dos, hanches et genoux fléchis à quatre-vingt-dix degrés. C\'est votre position de départ.',
        '2) Plaquez le bas du dos au sol et gainez les abdominaux pour que le bassin reste immobile pendant toute la série.',
        '3) En gardant un genou ramené vers la poitrine contre l\'élastique, poussez l\'autre jambe jusqu\'à la tendre presque complètement, sans laisser le dos se décoller du sol.',
        '4) Ramenez cette jambe à quatre-vingt-dix degrés et répétez de l\'autre côté, en alternant les jambes pour le nombre de répétitions recommandé.',
      ],
      pt: [
        '1) Fixe uma banda elástica em posição baixa atrás de si, passe-a à volta dos dois pés e deite-se de costas com ancas e joelhos fletidos a noventa graus. Esta é a posição inicial.',
        '2) Encoste a zona lombar ao chão e ative os abdominais para que a bacia fique fixa durante toda a série.',
        '3) Mantendo um joelho puxado em direção ao peito contra a banda, empurre a outra perna até quase a esticar, sem deixar as costas descolarem do chão.',
        '4) Recolha essa perna de novo a noventa graus e repita com a outra, alternando as pernas durante as repetições recomendadas.',
      ],
    },
  },
  {
    slug: 'cable_step_up',
    demand: 26,
    name: {
      en: 'Cable Step-Up',
      es: 'Step Up en Polea',
      it: 'Step up ai cavi',
      fr: 'Montée sur banc à la poulie',
      pt: 'Step up na polia',
    },
    aliases: [
      'Cable Step-Up', 'Step Up en Polea', 'Subida al Cajón en Polea', 'Cable Step Up',
      'Step Up con Cable', 'Step up ai cavi', 'Montée sur banc à la poulie', 'Step up na polia',
    ],
    level: 'intermediate',
    category: 'strength',
    pm: ['quadriceps'], sm: ['glutes', 'hamstrings', 'calves', 'abs'],
    movementPattern: ['lunge'], forceType: ['push'], mechanic: ['compound'],
    laterality: ['unilateral'], equipment: ['cable', 'box'],
    instr: {
      en: [
        '1) Set a cable pulley to the lowest position and attach a belt around your hips or grab a handle in each hand. Place a box in front of the machine, between you and the pulley.',
        '2) Stand facing the machine with the cable under tension and place one whole foot on the box, chest up. The cable pulls you down and forward. This is your starting position.',
        '3) Drive through the heel of the foot on the box to stand up on top of it, resisting the downward pull of the cable and keeping your hips level.',
        '4) Lower yourself under control until the trailing foot touches the floor, without letting the cable drag you toward the machine. Complete the recommended repetitions, then switch legs.',
      ],
      es: [
        '1) Coloca la polea en la posición más baja y engancha un cinturón a la cadera o sujeta un agarre en cada mano. Sitúa un cajón delante de la máquina, entre tú y la polea.',
        '2) Colócate de frente a la máquina con el cable en tensión y apoya todo un pie sobre el cajón, con el pecho alto. El cable tira de ti hacia abajo y hacia delante. Esta es tu posición de partida.',
        '3) Empuja con el talón del pie que está en el cajón para subir encima, resistiendo el tirón del cable hacia abajo y manteniendo la cadera nivelada.',
        '4) Baja con control hasta que el pie de atrás toque el suelo, sin dejar que el cable te arrastre hacia la máquina. Completa las repeticiones indicadas y cambia de pierna.',
      ],
      it: [
        '1) Imposta la puleggia nella posizione più bassa e aggancia una cintura ai fianchi o impugna una maniglia per mano. Posiziona un box davanti alla macchina, tra te e la puleggia.',
        '2) Mettiti di fronte alla macchina con il cavo in tensione e appoggia tutto un piede sul box, con il petto alto. Il cavo ti tira verso il basso e in avanti. Questa è la posizione di partenza.',
        '3) Spingi con il tallone del piede appoggiato sul box per salirci sopra, resistendo alla trazione del cavo verso il basso e mantenendo il bacino allineato.',
        '4) Scendi in controllo finché il piede dietro non tocca terra, senza lasciare che il cavo ti trascini verso la macchina. Completa le ripetizioni consigliate, poi cambia gamba.',
      ],
      fr: [
        '1) Réglez la poulie en position basse et fixez une ceinture autour des hanches ou tenez une poignée dans chaque main. Placez une box devant la machine, entre vous et la poulie.',
        '2) Placez-vous face à la machine, câble sous tension, et posez tout un pied sur la box, poitrine haute. Le câble vous tire vers le bas et vers l\'avant. C\'est votre position de départ.',
        '3) Poussez dans le talon du pied posé sur la box pour monter dessus, en résistant à la traction du câble vers le bas et en gardant le bassin horizontal.',
        '4) Redescendez en contrôle jusqu\'à ce que le pied arrière touche le sol, sans laisser le câble vous entraîner vers la machine. Effectuez le nombre de répétitions recommandé, puis changez de jambe.',
      ],
      pt: [
        '1) Coloque a polia na posição mais baixa e prenda um cinto à volta das ancas ou segure uma pega em cada mão. Coloque um caixote à frente da máquina, entre si e a polia.',
        '2) Fique de frente para a máquina com o cabo em tensão e apoie um pé inteiro sobre o caixote, com o peito alto. O cabo puxa-o para baixo e para a frente. Esta é a posição inicial.',
        '3) Empurre com o calcanhar do pé que está no caixote para subir para cima dele, resistindo à tração do cabo para baixo e mantendo as ancas niveladas.',
        '4) Desça com controlo até o pé de trás tocar no chão, sem deixar que o cabo o arraste em direção à máquina. Complete as repetições recomendadas e mude de perna.',
      ],
    },
  },
  {
    slug: 'hang_pull',
    demand: 19,
    name: {
      en: 'Hang Pull',
      es: 'Tirón desde Suspensión',
      it: 'Tirata dalla sospensione',
      fr: 'Tirage depuis suspension',
      pt: 'Puxada a partir de suspensão',
    },
    aliases: [
      'Hang Pull', 'Tirón desde Suspensión', 'Hang Snatch Pull', 'Tirón Colgante',
      'Hang High Pull', 'Tirata dalla sospensione', 'Tirage depuis suspension', 'Puxada a partir de suspensão',
    ],
    level: 'intermediate',
    category: 'strength',
    pm: ['upper_traps'], sm: ['hamstrings', 'glutes', 'quadriceps', 'lower_back', 'forearm_flexors'],
    movementPattern: ['vertical_pull'], forceType: ['pull'], mechanic: ['compound'],
    laterality: ['bilateral'], equipment: ['barbell'],
    instr: {
      en: [
        '1) Stand holding a barbell at hip height with a wide grip, feet hip-width apart, chest up and arms straight. This is your starting position.',
        '2) Push your hips back and let the bar slide down your thighs to just above the knees, keeping your back flat and your shoulders over the bar.',
        '3) Extend your hips, knees and ankles explosively and keep pulling with your traps so the bar travels straight up the front of your body.',
        '4) Let the bar come back down along the same path and reset at the knees before the next repetition. Repeat for the recommended repetitions.',
      ],
      es: [
        '1) Ponte de pie sujetando una barra a la altura de la cadera con agarre ancho, los pies a la anchura de la cadera, el pecho alto y los brazos estirados. Esta es tu posición de partida.',
        '2) Lleva la cadera atrás y deja que la barra baje por los muslos hasta justo por encima de las rodillas, con la espalda recta y los hombros por delante de la barra.',
        '3) Extiende cadera, rodillas y tobillos de forma explosiva y sigue tirando con los trapecios para que la barra suba pegada al cuerpo.',
        '4) Deja que la barra vuelva a bajar por el mismo camino y recolócate a la altura de las rodillas antes de la siguiente repetición. Repite las repeticiones indicadas.',
      ],
      it: [
        '1) Mettiti in piedi con un bilanciere all\'altezza delle anche, presa larga, piedi alla larghezza delle anche, petto alto e braccia distese. Questa è la posizione di partenza.',
        '2) Porta le anche indietro e lascia scendere il bilanciere lungo le cosce fino a poco sopra le ginocchia, con la schiena piatta e le spalle davanti al bilanciere.',
        '3) Estendi anche, ginocchia e caviglie in modo esplosivo e continua a tirare con i trapezi, in modo che il bilanciere salga rasente al corpo.',
        '4) Lascia scendere il bilanciere lungo lo stesso percorso e riposizionati all\'altezza delle ginocchia prima della ripetizione successiva. Ripeti per le ripetizioni consigliate.',
      ],
      fr: [
        "1) Tenez-vous debout avec une barre à hauteur de hanches en prise large, pieds à la largeur des hanches, poitrine haute et bras tendus. C'est votre position de départ.",
        '2) Reculez les hanches et laissez la barre glisser le long des cuisses jusqu\'à juste au-dessus des genoux, dos plat et épaules en avant de la barre.',
        '3) Étendez hanches, genoux et chevilles de façon explosive et continuez à tirer avec les trapèzes pour que la barre monte au plus près du corps.',
        '4) Laissez la barre redescendre par le même trajet et repositionnez-vous à hauteur des genoux avant la répétition suivante. Répétez le nombre de répétitions recommandé.',
      ],
      pt: [
        '1) Fique de pé segurando uma barra à altura das ancas com pega larga, os pés à largura das ancas, o peito alto e os braços esticados. Esta é a posição inicial.',
        '2) Leve as ancas atrás e deixe a barra descer pelas coxas até um pouco acima dos joelhos, com as costas direitas e os ombros à frente da barra.',
        '3) Estenda ancas, joelhos e tornozelos de forma explosiva e continue a puxar com os trapézios para que a barra suba junto ao corpo.',
        '4) Deixe a barra voltar a descer pelo mesmo trajeto e reposicione-se à altura dos joelhos antes da repetição seguinte. Repita as repetições recomendadas.',
      ],
    },
  },
  {
    slug: 'wall_push_up',
    demand: 19,
    name: {
      en: 'Wall Push-Up',
      es: 'Flexión en Pared',
      it: 'Piegamento al muro',
      fr: 'Pompe au mur',
      pt: 'Flexão na parede',
    },
    aliases: [
      'Wall Push-Up', 'Flexión en Pared', 'Flexiones de Pared', 'Wall Push Up',
      'Push Up en Pared', 'Lagartijas en Pared', 'Piegamento al muro', 'Pompe au mur', 'Flexão na parede',
    ],
    level: 'beginner',
    category: 'strength',
    pm: ['chest'], sm: ['front_delts', 'triceps', 'serratus', 'abs'],
    movementPattern: ['horizontal_push'], forceType: ['push'], mechanic: ['compound'],
    laterality: ['bilateral'], equipment: ['bodyweight'],
    instr: {
      en: [
        '1) Stand about an arm\'s length from a wall and place your hands on it slightly wider than shoulder-width, at chest height. This is your starting position.',
        '2) Step your feet back until your body forms a straight line from head to heels, with your core braced and your glutes squeezed.',
        '3) Bend your elbows to lower your chest toward the wall, keeping your elbows at about forty-five degrees from your torso.',
        '4) Push the wall away to return to the start without letting your hips sag or your head drop forward. Repeat for the recommended repetitions.',
      ],
      es: [
        '1) Colócate a la distancia de un brazo de una pared y apoya las manos en ella algo más separadas que la anchura de los hombros, a la altura del pecho. Esta es tu posición de partida.',
        '2) Retrasa los pies hasta que el cuerpo forme una línea recta de la cabeza a los talones, con el core activo y los glúteos apretados.',
        '3) Flexiona los codos para acercar el pecho a la pared, manteniendo los codos a unos cuarenta y cinco grados respecto al torso.',
        '4) Empuja la pared para volver al inicio sin dejar caer la cadera ni adelantar la cabeza. Repite las repeticiones indicadas.',
      ],
      it: [
        '1) Mettiti a distanza di un braccio da un muro e appoggia le mani poco più larghe delle spalle, all\'altezza del petto. Questa è la posizione di partenza.',
        '2) Arretra i piedi finché il corpo non forma una linea retta dalla testa ai talloni, con il core attivo e i glutei contratti.',
        '3) Piega i gomiti per avvicinare il petto al muro, mantenendo i gomiti a circa quarantacinque gradi rispetto al busto.',
        '4) Spingi il muro per tornare alla posizione di partenza senza far cedere le anche né portare la testa in avanti. Ripeti per le ripetizioni consigliate.',
      ],
      fr: [
        "1) Placez-vous à une longueur de bras d'un mur et posez-y les mains un peu plus large que les épaules, à hauteur de poitrine. C'est votre position de départ.",
        '2) Reculez les pieds jusqu\'à ce que le corps forme une ligne droite de la tête aux talons, gainage actif et fessiers serrés.',
        '3) Fléchissez les coudes pour rapprocher la poitrine du mur, en gardant les coudes à environ quarante-cinq degrés du buste.',
        '4) Poussez sur le mur pour revenir au départ sans laisser les hanches s\'affaisser ni la tête partir en avant. Répétez le nombre de répétitions recommandé.',
      ],
      pt: [
        '1) Coloque-se à distância de um braço de uma parede e apoie as mãos nela um pouco mais afastadas do que a largura dos ombros, à altura do peito. Esta é a posição inicial.',
        '2) Recue os pés até o corpo formar uma linha reta da cabeça aos calcanhares, com o core ativo e os glúteos contraídos.',
        '3) Dobre os cotovelos para aproximar o peito da parede, mantendo os cotovelos a cerca de quarenta e cinco graus em relação ao tronco.',
        '4) Empurre a parede para voltar ao início sem deixar as ancas caírem nem a cabeça avançar. Repita as repetições recomendadas.',
      ],
    },
  },
  {
    slug: 'tibialis_raise',
    demand: 8,
    name: {
      en: 'Tibialis Raise',
      es: 'Elevación de Tibial Anterior',
      it: 'Sollevamento del tibiale',
      fr: 'Élévation du tibial antérieur',
      pt: 'Elevação do tibial anterior',
    },
    aliases: [
      'Tibialis Raise', 'Elevación de Tibial Anterior', 'Elevación de Punta de Pie',
      'Tibialis Anterior Raise', 'Tibial Raise', 'Dorsiflexión de Tobillo',
      'Sollevamento del tibiale', 'Élévation du tibial antérieur', 'Elevação do tibial anterior',
    ],
    level: 'beginner',
    category: 'strength',
    pm: ['tibialis'], sm: ['peroneals', 'calves'],
    movementPattern: ['isolation'], forceType: ['pull'], mechanic: ['isolation'],
    laterality: ['bilateral'], equipment: ['bodyweight'],
    instr: {
      en: [
        '1) Stand with your back against a wall and walk your feet out about thirty centimetres, heels on the floor and legs straight. This is your starting position.',
        '2) Keep your glutes and shoulders in contact with the wall and your weight on your heels.',
        '3) Pull your toes and the balls of your feet up toward your shins as high as you can, keeping your heels planted.',
        '4) Lower your feet back to the floor slowly, taking around two seconds, and repeat for the recommended repetitions.',
      ],
      es: [
        '1) Ponte de espaldas a una pared y adelanta los pies unos treinta centímetros, con los talones en el suelo y las piernas estiradas. Esta es tu posición de partida.',
        '2) Mantén los glúteos y los hombros en contacto con la pared y el peso sobre los talones.',
        '3) Sube las puntas de los pies y los metatarsos hacia las espinillas todo lo que puedas, sin despegar los talones.',
        '4) Baja los pies al suelo despacio, en unos dos segundos, y repite las repeticiones indicadas.',
      ],
      it: [
        '1) Mettiti con la schiena contro un muro e porta i piedi in avanti di circa trenta centimetri, con i talloni a terra e le gambe distese. Questa è la posizione di partenza.',
        '2) Mantieni glutei e spalle a contatto con il muro e il peso sui talloni.',
        '3) Solleva le punte dei piedi e gli avampiedi verso gli stinchi il più possibile, senza staccare i talloni.',
        '4) Riporta i piedi a terra lentamente, in circa due secondi, e ripeti per le ripetizioni consigliate.',
      ],
      fr: [
        "1) Placez-vous dos à un mur et avancez les pieds d'environ trente centimètres, talons au sol et jambes tendues. C'est votre position de départ.",
        '2) Gardez les fessiers et les épaules en contact avec le mur et le poids sur les talons.',
        '3) Relevez les orteils et l\'avant du pied vers les tibias le plus haut possible, sans décoller les talons.',
        '4) Redescendez les pieds au sol lentement, en environ deux secondes, et répétez le nombre de répétitions recommandé.',
      ],
      pt: [
        '1) Fique de costas para uma parede e avance os pés cerca de trinta centímetros, com os calcanhares no chão e as pernas esticadas. Esta é a posição inicial.',
        '2) Mantenha os glúteos e os ombros em contacto com a parede e o peso sobre os calcanhares.',
        '3) Levante as pontas dos pés e o antepé em direção às canelas o máximo que conseguir, sem descolar os calcanhares.',
        '4) Baixe os pés ao chão devagar, em cerca de dois segundos, e repita as repetições recomendadas.',
      ],
    },
  },
  {
    slug: 'reverse_nordic_curl',
    demand: 5,
    name: {
      en: 'Reverse Nordic Curl',
      es: 'Curl Nórdico Inverso',
      it: 'Nordic curl inverso',
      fr: 'Nordic curl inversé',
      pt: 'Nordic curl invertido',
    },
    aliases: [
      'Reverse Nordic Curl', 'Curl Nórdico Inverso', 'Nórdico Inverso', 'Reverse Nordic',
      'Kneeling Quad Extension', 'Nordic curl inverso', 'Nordic curl inversé', 'Nordic curl invertido',
    ],
    level: 'intermediate',
    category: 'strength',
    pm: ['quadriceps'], sm: ['rectus_femoris', 'hip_flexors', 'abs'],
    movementPattern: ['isolation'], forceType: ['push'], mechanic: ['isolation'],
    laterality: ['bilateral'], equipment: ['bodyweight'],
    instr: {
      en: [
        '1) Kneel on a mat with your knees hip-width apart, feet flat behind you and your body upright from knees to head. This is your starting position.',
        '2) Squeeze your glutes and brace your abs so your hips stay extended and your lower back does not arch.',
        '3) Lean backward slowly by opening only your knees, keeping the straight line from knees to shoulders, until you feel a strong stretch in the front of your thighs.',
        '4) Pull yourself back up with your quadriceps to the upright position without breaking at the hips. Repeat for the recommended repetitions.',
      ],
      es: [
        '1) Arrodíllate sobre una colchoneta con las rodillas a la anchura de la cadera, los empeines apoyados detrás y el cuerpo erguido de rodillas a cabeza. Esta es tu posición de partida.',
        '2) Aprieta los glúteos y activa los abdominales para que la cadera quede extendida y la zona lumbar no se arquee.',
        '3) Inclínate hacia atrás despacio abriendo solo las rodillas, manteniendo la línea recta de rodillas a hombros, hasta notar un estiramiento fuerte en la parte anterior del muslo.',
        '4) Vuelve a subir con la fuerza del cuádriceps hasta la posición erguida sin flexionar la cadera. Repite las repeticiones indicadas.',
      ],
      it: [
        '1) Inginocchiati su un tappetino con le ginocchia alla larghezza delle anche, i collo-piedi appoggiati dietro e il corpo eretto dalle ginocchia alla testa. Questa è la posizione di partenza.',
        '2) Contrai i glutei e attiva gli addominali in modo che le anche restino estese e la zona lombare non si inarchi.',
        '3) Inclinati indietro lentamente aprendo solo le ginocchia, mantenendo la linea retta da ginocchia a spalle, finché non senti un forte allungamento sulla parte anteriore della coscia.',
        '4) Risali con la forza dei quadricipiti fino alla posizione eretta senza piegare le anche. Ripeti per le ripetizioni consigliate.',
      ],
      fr: [
        '1) Mettez-vous à genoux sur un tapis, genoux écartés de la largeur des hanches, cous-de-pied posés derrière et corps droit des genoux à la tête. C\'est votre position de départ.',
        '2) Serrez les fessiers et gainez les abdominaux pour que les hanches restent en extension et que le bas du dos ne se cambre pas.',
        '3) Penchez-vous lentement vers l\'arrière en ouvrant seulement les genoux, en gardant la ligne droite des genoux aux épaules, jusqu\'à sentir un fort étirement à l\'avant des cuisses.',
        '4) Remontez avec la force des quadriceps jusqu\'à la position droite, sans casser au niveau des hanches. Répétez le nombre de répétitions recommandé.',
      ],
      pt: [
        '1) Ajoelhe-se sobre um colchão com os joelhos à largura das ancas, os peitos do pé apoiados atrás e o corpo direito dos joelhos à cabeça. Esta é a posição inicial.',
        '2) Contraia os glúteos e ative os abdominais para que as ancas fiquem estendidas e a zona lombar não arqueie.',
        '3) Incline-se para trás devagar abrindo apenas os joelhos, mantendo a linha reta dos joelhos aos ombros, até sentir um alongamento forte na parte da frente das coxas.',
        '4) Volte a subir com a força do quadríceps até à posição direita sem fletir as ancas. Repita as repetições recomendadas.',
      ],
    },
  },
  {
    slug: 'meadows_row',
    demand: 3,
    name: {
      en: 'Meadows Row',
      es: 'Remo Meadows',
      it: 'Rematore Meadows',
      fr: 'Rowing Meadows',
      pt: 'Remada Meadows',
    },
    aliases: [
      'Meadows Row', 'Remo Meadows', 'Remo Landmine a una Mano', 'Landmine Meadows Row',
      'Meadow Row', 'Rematore Meadows', 'Rowing Meadows', 'Remada Meadows',
    ],
    level: 'intermediate',
    category: 'strength',
    pm: ['lats'], sm: ['rhomboids', 'mid_traps', 'rear_delts', 'biceps', 'forearm_flexors'],
    movementPattern: ['horizontal_pull'], forceType: ['pull'], mechanic: ['compound'],
    laterality: ['unilateral'], equipment: ['landmine', 'barbell'],
    instr: {
      en: [
        '1) Wedge one end of a barbell into a landmine or a corner and load plates on the free end. Stand side-on to the bar in a staggered stance, with the foot closest to it forward.',
        '2) Hinge at the hips with a flat back and grab the end of the bar with the hand furthest from it, resting your free forearm on your front thigh. This is your starting position.',
        '3) Pull the bar up and back toward your hip, driving your elbow past your ribs and letting your shoulder blade travel with the movement.',
        '4) Lower the bar under control until your lat is fully stretched, without rotating your torso. Complete the recommended repetitions, then switch sides.',
      ],
      es: [
        '1) Encaja un extremo de una barra en un landmine o en una esquina y carga discos en el extremo libre. Colócate de lado a la barra en paso adelantado, con el pie más cercano a ella por delante.',
        '2) Flexiona la cadera con la espalda recta y agarra el extremo de la barra con la mano más alejada, apoyando el antebrazo libre sobre el muslo adelantado. Esta es tu posición de partida.',
        '3) Tira de la barra hacia arriba y atrás en dirección a la cadera, llevando el codo por detrás de las costillas y dejando que la escápula acompañe el movimiento.',
        '4) Baja la barra con control hasta estirar del todo el dorsal, sin rotar el torso. Completa las repeticiones indicadas y cambia de lado.',
      ],
      it: [
        '1) Incastra un\'estremità di un bilanciere in un landmine o in un angolo e carica i dischi sull\'estremità libera. Mettiti di lato al bilanciere con un piede avanti, quello più vicino alla barra.',
        '2) Fletti le anche con la schiena piatta e afferra l\'estremità del bilanciere con la mano più lontana, appoggiando l\'avambraccio libero sulla coscia avanzata. Questa è la posizione di partenza.',
        '3) Tira il bilanciere verso l\'alto e indietro in direzione dell\'anca, portando il gomito oltre le costole e lasciando che la scapola accompagni il movimento.',
        '4) Abbassa il bilanciere in controllo fino ad allungare completamente il gran dorsale, senza ruotare il busto. Completa le ripetizioni consigliate, poi cambia lato.',
      ],
      fr: [
        "1) Calez une extrémité d'une barre dans un landmine ou dans un angle et chargez des disques sur l'extrémité libre. Placez-vous de côté par rapport à la barre, en fente légère, le pied le plus proche devant.",
        '2) Penchez-vous à partir des hanches, dos plat, et saisissez l\'extrémité de la barre avec la main la plus éloignée, l\'avant-bras libre posé sur la cuisse avant. C\'est votre position de départ.',
        '3) Tirez la barre vers le haut et vers l\'arrière en direction de la hanche, en amenant le coude au-delà des côtes et en laissant l\'omoplate accompagner le mouvement.',
        '4) Redescendez la barre en contrôle jusqu\'à étirer complètement le grand dorsal, sans faire tourner le buste. Effectuez le nombre de répétitions recommandé, puis changez de côté.',
      ],
      pt: [
        '1) Encaixe uma extremidade de uma barra num landmine ou num canto e carregue discos na extremidade livre. Coloque-se de lado para a barra em passo afastado, com o pé mais próximo dela à frente.',
        '2) Flita as ancas com as costas direitas e segure a extremidade da barra com a mão mais afastada, apoiando o antebraço livre sobre a coxa da frente. Esta é a posição inicial.',
        '3) Puxe a barra para cima e para trás em direção à anca, levando o cotovelo para além das costelas e deixando a omoplata acompanhar o movimento.',
        '4) Desça a barra com controlo até alongar completamente o grande dorsal, sem rodar o tronco. Complete as repetições recomendadas e mude de lado.',
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
