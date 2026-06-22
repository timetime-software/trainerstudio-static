# Backlog de ejercicios por demanda de búsquedas (10-may → 22-jun 2026)

Origen: lista del equipo a partir de búsquedas reales en el buscador. "Demanda" =
nº de búsquedas (orientativa). Este documento traduce esa lista a acciones
concretas sobre el pipeline de `scripts/tsl26`.

Rama: `feat/exercise-demand-backlog`.

## Qué se ha hecho en esta rama

- Se han **creado 25 entradas nuevas** en `data/exercises.ndjson` (clasificación
  completa según `classification-reference.mjs`, traducciones EN/ES, aliases),
  vía `seed-demand-exercises.mjs` (idempotente). Se crean **sin media**: la
  referencia de vídeo y la generación del clip se hacen en el paso de vídeo.
- Total dataset: 1204 → 1229 ejercicios.

Las nuevas entradas ya son **buscables en el editor** y quedan **encoladas** para
generación de vídeo. Se marcan con `metadata.status = "new"`: en el editor visual
hay un filtro **"Nuevos / WIP"** y un badge `NEW` en la lista para revisarlas de
un vistazo. Ese flag se descarta en `build:public` (no llega a MongoDB); borrarlo
o cambiarlo cuando el ejercicio esté terminado. Lo que NO se ha hecho aquí es la generación de vídeo en sí
(descarga de YouTube + Ark), porque requiere `ARK_API_KEY`, es asíncrona y
commitea binarios grandes: es el paso supervisado descrito abajo.

## Leyenda de estado de media

- `DEFAULT`: ya tiene vídeo final publicable. Nada que hacer.
- `SOURCE`: tiene clip source de 4s → solo falta pasar Ark para el `default`.
- `EMPTY`: existe la entrada pero sin media → falta añadir una referencia
  (YouTube o vídeo source) antes de poder generar nada.

## Bucket 1 — Listos para Ark (solo falta `default`)

Tienen clip `source`. Generar el vídeo con estilo TrainerStudio y descargarlo:

```bash
cd scripts/tsl26
ARK_API_KEY='...' npm run videos:style-tasks -- --ids=glute_ham_raise_machine,glute_ham_raise_895,seated_banded_hamstring_curls,bodyweight_depth_jumps,lateral_bounds,arm_circles,prone_hip_circles,dead_bug,pallof_press_with_rotation,banded_monster_walks,sandbag_good_mornings,trx_good_mornings,banded_good_mornings,seated_good_mornings,banded_russian_twists,cable_russian_twists,elliptical_trainer --overwrite-output
ARK_API_KEY='...' npm run videos:style-status -- --poll --download --ids=glute_ham_raise_machine,glute_ham_raise_895,seated_banded_hamstring_curls,bodyweight_depth_jumps,lateral_bounds,arm_circles,prone_hip_circles,dead_bug,pallof_press_with_rotation,banded_monster_walks,sandbag_good_mornings,trx_good_mornings,banded_good_mornings,seated_good_mornings,banded_russian_twists,cable_russian_twists,elliptical_trainer
npm run videos:sync-data
```

Cubre demanda de: dead bug (391), monster walk (183), good morning (131),
pallof rotation, russian twist, drop jump (bodyweight_depth_jumps),
multisaltos (lateral_bounds), CARS (arm_circles), movilidad cadera
(prone_hip_circles), curl/isquios (glute_ham_raise_*), elíptica.

## Bucket 2 — Falta referencia de vídeo, luego clip + Ark

Entradas `EMPTY` (las 25 nuevas + entradas previas sin media). Para cada una hay
que añadir primero una referencia de YouTube en `media` (o subir un vídeo
source), después generar clip y vídeo final:

```bash
cd scripts/tsl26
# 1) añadir youtube ref en data/exercises.ndjson (manual / editor)
# 2) generar clip source de 4s desde el youtube
npm run videos:clips -- --ids=<slug1>,<slug2>,...
# 3) generar el default con Ark + descargar + sync (igual que el Bucket 1)
```

Slugs (separados por bucket lógico):

**Nuevos creados en esta rama (25):**
`nordic_hamstring_curl, hamstring_bridge, pogo_jumps, hip_hinge,
deceleration_drill, hollow_hold, hollow_rock, countermovement_jump,
copenhagen_plank, landing_mechanics_drill, bird_dog, cable_katana_press,
step_down, devil_press, animal_flow, ankle_dorsiflexion_mobilization,
thoracic_rotation, shoulder_cars, diaphragmatic_breathing_360, codman_pendulum,
short_foot_activation, cat_cow, sciatic_nerve_floss, wall_ball, cossack_squat`

**Ya existían pero sin media (conviene completarlas):**
`glute_ham_raise, wall_sit, linear_depth_jump, incline_push_up_depth_jump,
frog_hops, hurdle_hops, lateral_cone_hops, single_leg_hop_progression,
alternate_leg_diagonal_bound, stomach_vacuum, bear_crawl_sled_drags,
banded_hip_opener`

## Bucket 3 — Ya cubiertos (default existente)

Nada que hacer, ya devuelven vídeo: `pallof_press`, `russian_twist_with_dumbbell`,
`russian_twist_with_medicine_ball`, `barbell_good_mornings`, `shoulder_circles`,
`standing_hip_circles`, `crab_walks`.

## Notas

- `stomach_vacuum` se mapea a "hipopresivos" como aproximación (vacío abdominal);
  no es exactamente lo mismo. Valorar si el equipo quiere una entrada dedicada
  `hypopressives`.
- `cable_katana_press` (katana) y `pallof_press` cubren ambos antirrotación en
  polea; se mantienen separados porque el equipo busca "katana" por nombre.
- Tras generar vídeos: `npm run build:public` y `npm run import` para publicar en
  MongoDB (solo entran ejercicios con `default`).
