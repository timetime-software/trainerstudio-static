# Backlog de ejercicios por demanda de búsquedas

Actualizado: **29-jul-2026**. Sustituye a la versión anterior (lista manual del
equipo, 10-may → 22-jun).

## Fuente de datos

Ya no hace falta pedir la lista al equipo: la demanda se mide directamente en la
Mongo de producción, con la skill `mongodb-prod-readonly` del repo
`trainerstudio`.

Cada búsqueda en la librería pública emite un evento `PublicExerciseSearched` en
la colección `events`, con `data.query` (el texto tecleado) y
`data.resultsCount`. Las búsquedas que devuelven cero son `resultsCount: 0`.

```js
// top de términos sin resultados
db.events.aggregate([
  { $match: { type: 'PublicExerciseSearched', 'data.resultsCount': 0,
              occurredAt: { $gte: ISODate('2026-05-23') } } },
  { $project: { q: { $trim: { input: { $toLower: '$data.query' } } } } },
  { $match: { q: { $nin: [null, ''] } } },
  { $group: { _id: '$q', n: { $sum: 1 } } },
  { $sort: { n: -1 } },
], { allowDiskUse: true });
```

Dos avisos al leer esos datos:

- **Ventana temporal.** El buscador con Atlas Search (sinónimos + fuzzy +
  autocomplete) entró en producción el **22-may-2026**
  (`5f11b0fe7`, `e9011bcc8`, `cb77d5b0d` en `trainerstudio`). Los ceros
  anteriores a esa fecha son de otro motor y no sirven para decidir nada.
- **Ruido de tecleo.** El buscador dispara un evento por pulsación, así que la
  mayoría de términos son prefijos a medio escribir (`estoca`, `leg exte`,
  `puente de gl`). Hay que quedarse con el término terminal de cada cadena antes
  de contar demanda, o se cuentan 8 veces las mismas 8 pulsaciones.

## Hallazgo principal: casi ningún cero es un ejercicio que falte

Medido sobre los últimos 14 días: **197.534 búsquedas, 38.812 sin resultados
(19,6 %)**. Ese 19,6 % se reparte así (términos con n≥3):

| Longitud del término | % de los ceros |
| --- | --- |
| 1 carácter | **77,9 %** |
| 7+ caracteres | 12,3 % |
| 4-6 caracteres | 6,5 % |
| 2 caracteres | 1,9 % |
| 3 caracteres | 1,5 % |

El catálogo tiene 3.488 ejercicios y cubre prácticamente todo lo que se busca.
Los ceros vienen, por orden de volumen, de estos tres problemas — todos de
**backend**, no de contenido:

### 1. Búsquedas de 1 carácter → siempre 0 resultados (77,9 % de los ceros)

En `public-exercises.repository.ts`, la rama de autocomplete descarta los tokens
de menos de 2 caracteres (`query.split(/\s+/).filter((t) => t.length >= 2)`)
porque el índice tiene `minGrams: 2`. Con un solo carácter esa rama queda vacía y
ninguna de las otras ramas (`text` con sinónimos, `text` en inglés, fuzzy) casa
un prefijo suelto. Resultado: **la primera pulsación de toda búsqueda devuelve
lista vacía**. Los términos top son literalmente `p` (3.608), `c` (1.886),
`e` (1.449), `r` (1.400), `b` (1.384).

Arreglo: bajar `minGrams` a 1 en el índice de Atlas, o no ejecutar la búsqueda
hasta el segundo carácter.

### 2. Los sinónimos no aplican mientras escribes

La colección de sinónimos está desplegada y es correcta, pero Atlas solo la
aplica a **palabras completas**. El autocomplete, en cambio, solo mira
`i18n.name.<idioma>`, no los sinónimos. Por eso:

| Término | Sin resultados |
| --- | --- |
| `estoca` | 212 |
| `estocada` (completo) | **0** |

`estocada` está en el seed (`lunge-estocada-zancada`) y funciona perfectamente
una vez tecleada entera; lo que falla es todo el camino hasta ahí. Lo mismo con
`copenhague` (9) frente a `copenhagen` (0).

Arreglo: expandir sinónimos también en la rama de autocomplete, o indexar los
sinónimos como campo autocompletable.

### 3. Sinónimos que faltan o están mal mapeados

Casos concretos detectados, todos vivos a día de hoy:

- **`caminadora` (125) / `trotadora` (17)** — LatAm para cinta de correr. No hay
  ninguna entrada de sinónimo; en el catálogo está como "Carrera en cinta".
- **`vuelos laterales` (70)** — el sinónimo `aperturas-cristos-vuelos` mapea
  `vuelos` → `aperturas` / `cristos` / `fly` (aperturas de pecho). Pero "vuelos
  laterales" es elevación lateral de hombro, no apertura de pecho: la expansión
  lleva la búsqueda al músculo equivocado y no casa nada. Hace falta una entrada
  propia para `vuelos laterales` → `elevaciones laterales`.
- **`calentamiento` (132) / `elongacion` / `movilidad articular` / `activación`**
  — búsquedas por *tipo de bloque*, no por ejercicio. Hoy no hay forma de
  buscarlas.
- **`hiit` (47) / `tabata` / `emom` / `amrap` / `cluster` / `drop set` /
  `descanso`** — igual: metodología, no ejercicios.
- **`dorsalera`, `sural`, `espinales`, `almeja`, `serrucho`, `lagartijas`,
  `sillón`, `camilla`, `soga`, `medball`** — regionalismos de equipamiento y
  musculatura sin sinónimo.
- **`hiptrust` / `hip trhus` / `hip trush` / `hipthrus`** — el fuzzy no cubre
  errores en palabras pegadas. Conviene añadir las variantes al seed.

Comprobados uno a uno contra `publicExercises` de producción el 29-jul-2026: el
ejercicio destino existe, está publicado y tiene nombre en español, así que el
único trabajo pendiente es la entrada de sinónimo.

| Término | Ceros | Destino en producción | Nombre ES publicado |
| --- | --- | --- | --- |
| `espinales` / `espinal` | 102 | `Hyperextensions (Back Extensions)` | Hiperextensiones de espalda |
| `vuelos laterales` | 390 | familia `Lateral Raise` | Elevación lateral… |
| `drop jump` | 121 | `Depth Jump Leap`, `Linear Depth Jump` | Salto en profundidad… |
| `soga` / `saltos a la soga` | 22 | `Skipping` | Comba (Saltar a la Cuerda) |
| `multisaltos` | 44 | `Hurdle Hops` | Saltos sobre vallas |

`drop jump` es el caso más caro de los cinco: 121 ceros y el ejercicio existe
publicado y traducido. **No se ha creado entrada nueva a propósito** — "drop
jump" y "depth jump" son el mismo ejercicio en la literatura y crear un
`drop_jump` duplicaría `linear_depth_jump`. Es sinónimo, no contenido.

`almeja` (30) es un caso distinto de los anteriores: hay 6 variantes de
`clamshell` en `data/exercises.ndjson`, pero **ninguna está publicada** (ninguna
tiene `default`) y además ninguna tiene `i18n.name.es`. Ahí no falta un sinónimo
ni un ejercicio: falta pasar por Ark y traducir. Mismo cuello de botella que la
sección final.

### 4. Familia `iso *` — el mayor clúster por volumen

`iso hold` (192), `iso push` (145), y detrás `iso split`, `iso back squat`,
`iso hold split`, `iso wall`, `iso push up`… Es una convención de nombres para
variantes isométricas de ejercicios que ya existen (`squat_hold`,
`dead_bug_iso_hold`, `hamstring_bridge_iso_hold`). **No son ejercicios nuevos**,
es un prefijo que el buscador no entiende.

Pendiente de decidir: sinónimo `iso` → `isométrico` / `isometric` / `hold`, o
convención de nombre en el catálogo. Ojo: el patrón parece concentrado en pocos
clientes, así que conviene confirmar el alcance antes de invertir.

> Nota de arquitectura: el campo `aliases` de `exercises.ndjson` **no es
> buscable**. El índice de Atlas solo cubre `name` y `i18n.name.{en,es,it,fr,pt}`
> (`ALL_NAME_PATHS`). Los alias sirven de documentación interna; para que un
> término encuentre un ejercicio hay que meterlo en
> `public-exercise-synonyms.seed.ts` del backend.

## Lote 2026-07-28 — los 10 que sí faltaban

Tras filtrar todo lo anterior, estos son los términos más buscados con cero
resultados que además **no existen en `data/exercises.ndjson`**. Creados con
`seed-batch-2026-07-28.mjs` (idempotente por `cdnslug`), con textos y
traducciones completas en EN/ES/IT/FR/PT y clasificación según
`classification-reference.mjs`. Se crean **sin media**.

| # | Slug | Nombre | Demanda |
| --- | --- | --- | --- |
| 1 | `bayesian_curl` | Bayesian Curl / Curl Bayesiano | 65 |
| 2 | `suitcase_carry` | Suitcase Carry / Paseo del Maletín | 36 |
| 3 | `tandem_stance_hold` | Tandem Stance Hold / Equilibrio en Tándem | 31 |
| 4 | `dragon_flag` | Dragon Flag / Bandera Dragón | 29 |
| 5 | `spanish_squat` | Spanish Squat / Sentadilla Española | 26 |
| 6 | `lateral_pogo_hops` | Lateral Pogo Hops / Saltos Pogo Laterales | 18 |
| 7 | `negative_pull_up` | Negative Pull-Up / Dominada Negativa | 14 |
| 8 | `seal_row` | Seal Row / Remo Seal | 14 |
| 9 | `hand_release_push_up` | Hand Release Push-Up / Flexión con Manos Liberadas | 12 |
| 10 | `triple_hop` | Triple Hop / Triple Salto a una Pierna | 8 |

Se marcan con `metadata.batch = "2026-07-28"`: en el editor hay filtro **"Lote
2026-07-28"**. Ese campo se descarta en `build:public` (no llega a MongoDB).
Completado el 29-jul con source, default de Ark, miniaturas y sync a CDN.

## Lote 2026-07-29 — los 10 siguientes

Mismo análisis repetido el 29-jul sobre la ventana completa desde el 23-may
(**58.860 términos distintos, 175.752 búsquedas sin resultados**), con dos
diferencias de método respecto al lote anterior:

1. **La demanda se agrega por concepto, no por cadena tecleada.** `serrat` (22),
   `serrucho` (17), `serratus` (16), `serrato` (10) y `serratu` (9) son la misma
   búsqueda; contarlas por separado escondía el concepto en el puesto 40 y suma
   148 al juntarlas.
2. **Se descarta todo término cuyo ejercicio ya exista publicado**, aunque la
   búsqueda devuelva cero. Eso saca de la lista a `drop jump` (121),
   `vuelos laterales` (390), `espinales` (102), `multisaltos` (44) y `soga` (22),
   que van a la sección de sinónimos. Es la razón de que el nº 1 de este lote
   tenga menos volumen bruto que varios términos descartados.

Creados con `seed-batch-2026-07-29.mjs` (idempotente por `cdnslug`), con textos
y traducciones completas en EN/ES/IT/FR/PT y clasificación validada contra
`classification-reference.mjs`. Se crean **sin media**.

| # | Slug | Nombre | Demanda |
| --- | --- | --- | --- |
| 1 | `serratus_wall_slide` | Serratus Wall Slide / Deslizamiento en Pared para el Serrato | 148 |
| 2 | `high_hang_snatch` | High Hang Snatch / Arrancada desde Suspensión Alta | 103 |
| 3 | `scapular_depression` | Scapular Depression / Depresión Escapular | 74 |
| 4 | `banded_psoas_march` | Banded Psoas March / Marcha de Psoas con Banda | 61 |
| 5 | `cable_step_up` | Cable Step-Up / Step Up en Polea | 26 |
| 6 | `hang_pull` | Hang Pull / Tirón desde Suspensión | 19 |
| 7 | `wall_push_up` | Wall Push-Up / Flexión en Pared | 19 |
| 8 | `tibialis_raise` | Tibialis Raise / Elevación de Tibial Anterior | 8 |
| 9 | `reverse_nordic_curl` | Reverse Nordic Curl / Curl Nórdico Inverso | 5 |
| 10 | `meadows_row` | Meadows Row / Remo Meadows | 3 |

Consume 5 de los 6 candidatos que quedaban apuntados del lote anterior. El
sexto, `tibial_rotations` (rotaciones tibiales, 5), se sustituye por
`tibialis_raise`: mismo músculo, más demanda y es el ejercicio canónico; las
rotaciones tibiales son una progresión de rehab que encaja mejor como variante.

Se marcan con `metadata.batch = "2026-07-29"`. El desplegable de lotes del
editor se construye solo con los valores de `metadata.batch` presentes en el
dataset (`editor/src/main.jsx:903`), así que **"Lote 2026-07-29" aparece sin
tocar código**.

Siguiente paso:

```bash
cd scripts/tsl26
# 1) añadir referencia de YouTube a cada uno desde el editor
npm run editor
# 2) clip source de 4s
npm run videos:clips -- --ids=serratus_wall_slide,high_hang_snatch,scapular_depression,banded_psoas_march,cable_step_up,hang_pull,wall_push_up,tibialis_raise,reverse_nordic_curl,meadows_row
# 3) default con Ark + descarga + sync
npm run videos:style-tasks  -- --ids=<mismos> --overwrite-output
npm run videos:style-status -- --poll --download --ids=<mismos>
npm run videos:sync-data
```

`ARK_API_KEY` ya no se pasa a mano: vive en `.env.local` (gitignored, permisos
600) y los scripts `videos:style-*` la cargan con `--env-file-if-exists`.

## Siguientes candidatos (demanda menor, ya verificados como inexistentes)

Para el próximo lote, sin necesidad de repetir el análisis. Comprobados contra
`data/exercises.ndjson` el 29-jul: no hay ninguna entrada que los cubra.

`hip_lock` (24, jerga de preparación física: `sl rdl to a frame hip lock`) ·
`tibial_rotations` (rotaciones tibiales, 5) · `shrimp_squat` · `pendlay_row` ·
`kroc_row` · `kelso_shrug` (2) · `peterson_step_up` (1)

Los cinco últimos tienen demanda casi nula pero son ejercicios estándar que
cualquier catálogo serio debería cubrir; sirven de relleno cuando la demanda
medida ya no dé para 10.

**Aviso para el próximo análisis:** la demanda por contenido está agotándose. En
la ventana de dos meses ya no queda ningún concepto ausente con más de ~150
ceros, y los tres buckets de arriba (1 carácter, sinónimos que no aplican al
teclear, sinónimos sin mapear) concentran el grueso del 19,6 % de búsquedas
fallidas. El siguiente lote rendirá menos que arreglar `minGrams` o publicar
sinónimos.

## Cuello de botella real: pasar Ark, no crear ejercicios

Medido el 27-jul-2026 sobre disco (`libraries/tsl26/<slug>/{source,default}`):

| Origen | Ejercicios | Con `source` | Con `default` |
| --- | --- | --- | --- |
| Importados de Trainerize | 2.226 | 2.216 | **0** |
| Resto (propios + legacy) | 1.262 | 886 | 349 |
| **Total** | **3.488** | **3.102** | **349** |

`build:public` solo deja pasar los que tienen `default/<slug>.mp4`. Es decir:
**3.139 ejercicios ya escritos y clasificados no son publicables por no haber
pasado por Ark**, y 2.216 de ellos ya tienen el clip source anonimizado listo
para enviar.

Cuidado con una comparación engañosa: `publicExercises` en producción tiene
2.722 documentos, pero **solo 349 llevan vídeo de este pipeline**. Los otros
2.373 son el import legacy con imágenes estáticas
(`libraries/free-exercise-db-v1/…`). Restar 3.488 − 2.722 y llamarlo "lo que
falta" es incorrecto.

Consecuencia práctica: **hay mucho más valor en pasar por Ark lo que ya está
escrito que en escribir ejercicios nuevos.** Varios términos que aparecían con
cero resultados en el histórico (`bird dog`, `pogo`, `dead bug`, `wall ball`,
`katana`, `monster walk`) dejaron de fallar en cuanto se publicó su vídeo, sin
tocar una línea de texto.

Comprobar el hueco:

```bash
cd scripts/tsl26
npm run build:public   # imprime kept (con default) / skipped (sin default)
```

## Por qué los lotes nuevos nacen sin media

Los ejercicios importados de un proveedor (Trainerize) traen URL de vídeo en
`metadata.source`, y de ahí salen los `source` descargados y anonimizados con
`npm run videos:anonymize-sources`.

Los lotes creados a mano (`seed-batch-*.mjs`) no tienen proveedor aguas arriba:
no hay nada que descargar ni anonimizar. Por eso nacen con `media: []` y hay que
añadirles una referencia de YouTube desde el editor antes de poder generar el
clip. Es esperado, no un fallo del seed.

## Estado de los lotes anteriores

- **2026-06-22** (25 entradas, demanda del equipo): creadas, con vídeo.
- **2026-06-23** (10): completo, revisado por humano.
- **2026-06-26** (13, TRX): completo con default + thumbnails.
- **2026-07-03** (10): 5 con clip source, 5 aún sin media
  (`nordic_curl`, `turkish_get_up`, `landmine_press`, `jefferson_curl`,
  `kettlebell_clean_and_press`).
- **2026-07-28** (10): completo, los 10 con `default` + thumbnail y sincronizados
  al CDN el 29-jul. Pendiente solo el OK humano.
- **2026-07-29** (10): creados y con clip `source` de los 10. Falta pasar Ark.

## Leyenda de estado de media

- `DEFAULT`: ya tiene vídeo final publicable. Nada que hacer.
- `SOURCE`: tiene clip source de 4s → solo falta pasar Ark para el `default`.
- `EMPTY`: existe la entrada pero sin media → falta añadir una referencia
  (YouTube o vídeo source) antes de poder generar nada.
