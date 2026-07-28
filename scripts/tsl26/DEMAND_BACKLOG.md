# Backlog de ejercicios por demanda de búsquedas

Actualizado: **28-jul-2026**. Sustituye a la versión anterior (lista manual del
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

Siguiente paso:

```bash
cd scripts/tsl26
# 1) añadir referencia de YouTube a cada uno desde el editor
npm run editor
# 2) clip source de 4s
npm run videos:clips -- --ids=bayesian_curl,suitcase_carry,tandem_stance_hold,dragon_flag,spanish_squat,lateral_pogo_hops,negative_pull_up,seal_row,hand_release_push_up,triple_hop
# 3) default con Ark + descarga + sync
npm run videos:style-tasks  -- --ids=<mismos> --overwrite-output
npm run videos:style-status -- --poll --download --ids=<mismos>
npm run videos:sync-data
```

`ARK_API_KEY` ya no se pasa a mano: vive en `.env.local` (gitignored, permisos
600) y los scripts `videos:style-*` la cargan con `--env-file-if-exists`.

## Siguientes candidatos (demanda menor, ya verificados como inexistentes)

Para el próximo lote, sin necesidad de repetir el análisis:

`scapular_depression` (depresión escapular, 8) · `cable_step_up` (step up en
polea, 6) · `wall_push_up` (push ups pared, 5) · `tibial_rotations`
(rotaciones tibiales, 5) · `hang_pull` (5) · `meadows_row` (3)

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
- **2026-07-28** (10): recién creado, sin media.

## Leyenda de estado de media

- `DEFAULT`: ya tiene vídeo final publicable. Nada que hacer.
- `SOURCE`: tiene clip source de 4s → solo falta pasar Ark para el `default`.
- `EMPTY`: existe la entrada pero sin media → falta añadir una referencia
  (YouTube o vídeo source) antes de poder generar nada.
