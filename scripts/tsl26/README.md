# TrainerStudio Exercise Library Pipeline

Este proyecto construye la libreria oficial de ejercicios de TrainerStudio.
La idea operativa es:

1. Mantener un JSON de trabajo con todos los datos necesarios de cada ejercicio.
2. Usar IA para revisar textos, traducciones y clasificacion.
3. Usar IA de video para generar clips finales a partir de videos o imagenes de
   referencia.
4. Generar desde esa fuente un JSON publico, bien formado e importable en
   MongoDB.

La fuente de la verdad es `scripts/tsl26/data/exercises.ndjson`. Cada linea es
un ejercicio completo e independiente. Ese archivo debe contener nombres,
traducciones, instrucciones, clasificacion, media, slugs CDN, estado de revision
y metadata de trabajo.

`scripts/tsl26/data/exercises-public.json` y
`scripts/tsl26/data/exercises-public.ndjson` son salidas derivadas. No se editan
a mano: se reconstruyen con `npm run build:public` y son los unicos archivos que
deben importarse en MongoDB.

`scripts/tsl26/classification-reference.mjs` contiene los valores permitidos
para los modelos y para el editor. Cualquier agente de IA que revise ejercicios
debe usar esos enums como contrato:

- `LEVEL_VALUES`
- `CATEGORY_VALUES`
- `DETAILED_MUSCLE_GROUP_VALUES`
- `MOVEMENT_PATTERN_VALUES`
- `FORCE_TYPE_VALUES`
- `MECHANIC_VALUES`
- `LATERALITY_VALUES`
- `EQUIPMENT_VALUES`

Si falta un valor, se actualiza primero `classification-reference.mjs` y despues
se revisan los scripts/editor que consumen esos valores. No conviene introducir
etiquetas libres directamente en `exercises.ndjson`.

## Flujo Canonico

```text
fuentes externas / editor
  -> data/exercises.ndjson
  -> revision IA de textos + clasificacion usando classification-reference.mjs
  -> videos source en libraries/tsl26/<cdnslug>/source/
  -> videos IA default en libraries/tsl26/<cdnslug>/default/
  -> npm run videos:sync-data
  -> npm run build:public
  -> data/exercises-public.json
  -> subir desde el panel de admin
  -> MongoDB publicExercises
```

Reglas importantes:

- `data/exercises.ndjson` puede contener ejercicios incompletos, videos source,
  referencias YouTube, notas internas y metadata de revision.
- `data/exercises-public.json` solo debe contener ejercicios publicables, con
  video `default` final en CDN/local library.
- MongoDB se carga solo desde `data/exercises-public.json`.
- `classification-reference.mjs` es la referencia de valores validos para IA,
  editor, prompts y build publico.

## Contrato del Ejercicio

Cada ejercicio de `data/exercises.ndjson` debe mantener, como minimo:

- `id`: identificador opaco estilo Mongo ObjectId, estable.
- `cdnslug`: slug estable para carpeta/CDN/editor.
- `name`, `instructions`, `i18n.name`, `i18n.instructions`.
- `category`, `level`, `force`, `mechanic`, `equipment`.
- `primaryMuscles`, `secondaryMuscles`.
- `classification.primaryMuscles`, `classification.secondaryMuscles`,
  `classification.movementPattern`, `classification.forceType`,
  `classification.mechanic`, `classification.laterality`,
  `classification.equipment`.
- `media`: referencias YouTube/source/default/imagenes disponibles.
- `metadata.identityKey = "trainerstudio:<cdnslug>"`.

Los campos top-level (`force`, `mechanic`, `equipment`, `primaryMuscles`,
`secondaryMuscles`) deben estar alineados con `classification.*`. El build
publico conserva el documento publico, recalcula media final y anade labels i18n
derivadas de `classification-reference.mjs`.

## Editor y Revision con IA

El editor local vive en `scripts/tsl26/editor` y se arranca con:

```bash
cd /Users/iagolast/Workspace/trainerstudio-static/scripts/tsl26
npm run editor
```

Desde el editor se pueden revisar ejercicios, ajustar clasificacion y lanzar
revision con agentes IA. Los prompts del editor incluyen los valores permitidos
de `classification-reference.mjs` para evitar etiquetas fuera de contrato.

Cuando un agente revise un ejercicio, debe devolver exactamente el JSON completo
del ejercicio, preservando `id`, `cdnslug`, media y metadata salvo que esten
claramente malformados.

La salida servible vive en `libraries/tsl26`:

```text
tsl26/
  references/            # imagenes de referencia publicas
  <cdnslug>/source/      # clip original normalizado de 4s
    <cdnslug>.mp4
  <cdnslug>/default/     # clip transformado final, cuando exista
    <cdnslug>.mp4
```

## Layout Relevante

`references/` y `<cdnslug>/{source,default}` son el resultado que deberia quedar
estable para CDN:

- `references/*.png`: imagenes publicas para aplicar estilo.
- `<cdnslug>/source/<cdnslug>.mp4`: clip original normalizado, sin audio y de 4s,
  usado como `reference_video` para la API de IA.
- `<cdnslug>/default/<cdnslug>.mp4`: clip transformado final con el estilo de
  TrainerStudio, cuando ya exista.

El tooling, la metadata y los intermedios de generacion viven fuera de
`libraries`, en `scripts/tsl26`.

La metadata vive en `scripts/tsl26/data/exercises.ndjson`. Ese archivo es la
fuente de la verdad para nombres, traducciones, clasificacion, media, notas y
metadata de trabajo. Cada linea contiene un ejercicio completo e independiente.
Cada ejercicio incluye `cdnslug`, generado desde el nombre en ingles en lowercase
y con underscores. Si dos ejercicios comparten el mismo nombre, el slug recibe un
sufijo numerico (`_2`, `_3`, ...) para evitar colisiones en CDN.

`data/exercises-public.json` es una salida derivada e importable, generada desde
`data/exercises.ndjson` con `npm run build:public`: solo contiene ejercicios con
`default/<cdnslug>.mp4`, con media CDN final y sin campos internos.

Cada ejercicio tiene dos identificadores distintos:

- `id`: opaco, estilo Mongo ObjectId de 24 caracteres hexadecimales. Se deriva de
  `metadata.identityKey` para que el mismo ejercicio reconstruido desde un dump
  vuelva a tener el mismo id.
- `cdnslug`: slug unico, user-friendly y estable para carpetas/CDN/editor, por
  ejemplo `barbell_bench_press`.

La identidad canonica interna es `metadata.identityKey = "trainerstudio:<cdnslug>"`.
No usar ids publicos derivados de proveedores externos.

## Clips Fuente

Generar todos los clips disponibles en `scripts/tsl26/data/exercises.ndjson`:

```bash
cd /Users/iagolast/Workspace/trainerstudio-static/scripts/tsl26
npm run videos:clips
```

Por defecto el script:

- lee `scripts/tsl26/data/exercises.ndjson`
- detecta el primer video YouTube de cada ejercicio
- descarga el MP4 fuente en `scripts/tsl26/.workspace/videos`
- recorta desde el segundo `1`
- genera `4` segundos
- elimina el audio
- escala a `480` px de alto
- escribe el resultado en `libraries/tsl26/<cdnslug>/source/<cdnslug>.mp4`

Opciones utiles:

```bash
npm run videos:clips -- --limit=10
npm run videos:clips -- --ids=barbell_bench_press,wide_grip_pull_ups
npm run videos:clips -- --overwrite
npm run videos:clips -- --start=1 --duration=4 --height=480
```

Ejemplo de salida:

```text
libraries/tsl26/barbell_bench_press/source/barbell_bench_press.mp4
libraries/tsl26/wide_grip_pull_ups/source/wide_grip_pull_ups.mp4
```

Los 5 clips iniciales ya generados y subidos al CDN son:

```text
barbell_bench_press
barbell_squats
barbell_deadlifts
wide_grip_pull_ups
standing_bicep_curls
```

Validacion rapida de CDN:

```bash
curl -I https://cdn.trainerstudio.com/libraries/tsl26/barbell_bench_press/source/barbell_bench_press.mp4
```

## Ark Style Tasks

Una tarea envia:

- 2 imagenes de referencia publicas en CDN.
- 1 video de referencia publico en CDN por cada clip original.
- `duration: 4`
- `ratio: "16:9"`
- `generate_audio: false`
- `watermark: false`

Las referencias por defecto son:

```text
https://cdn.trainerstudio.com/libraries/tsl26/references/man.png
https://cdn.trainerstudio.com/libraries/tsl26/references/man2.png
```

El prompt por defecto es unico para todas las tareas. Pide mantener exactamente
el movimiento, timing, encuadre y duracion del video original, cambiando solo el
aspecto visual al entrenador ilustrado de las referencias sobre fondo blanco. En
cada tarea solo cambia la URL `video_url` del clip en
`libraries/tsl26/<cdnslug>/source/<cdnslug>.mp4`.

Validar payload:

```bash
cd /Users/iagolast/Workspace/trainerstudio-static/scripts/tsl26
npm run videos:style-tasks -- --dry-run --ids=barbell_squats --overwrite-output
```

Crear tareas reales:

```bash
ARK_API_KEY='...' npm run videos:style-tasks -- --ids=barbell_squats,barbell_deadlifts --overwrite-output
```

Opciones utiles:

```bash
npm run videos:style-tasks -- --ids=barbell_bench_press,wide_grip_pull_ups
npm run videos:style-tasks -- --reference-images=/abs/ref1.png,/abs/ref2.png
npm run videos:style-tasks -- --prompt-file=/abs/prompt.txt
npm run videos:style-tasks -- --cdn-base-url=https://cdn.trainerstudio.com
npm run videos:style-tasks -- --overwrite-output
```

El script escribe las respuestas en:

```text
scripts/tsl26/.workspace/ark/style-tasks.ndjson
```

Cada linea guarda el `clipUrl`, las imagenes de referencia, el payload enviado y
la respuesta de Ark para poder reconciliar los resultados despues. Si Ark rechaza
un clip, el error se guarda con `status: "create_failed"` y el batch continua.

## Estado y Descarga

Consultar estado y descargar resultados completados:

```bash
ARK_API_KEY='...' npm run videos:style-status -- --once --ids=barbell_squats,barbell_deadlifts
ARK_API_KEY='...' npm run videos:style-status -- --poll --download --ids=barbell_squats,barbell_deadlifts
```

Cuando una tarea termina con `status: "succeeded"` y devuelve una URL de video,
`--download` guarda el resultado en:

```text
libraries/tsl26/<cdnslug>/default/<cdnslug>.mp4
```

Despues de descargar videos finales, actualizar la metadata antes de importar:

```bash
npm run videos:sync-data
```

Este paso antepone en `scripts/tsl26/data/exercises.ndjson` el video final
servido desde:

```text
https://cdn.trainerstudio.com/libraries/tsl26/<cdnslug>/default/<cdnslug>.mp4
```

El script de estado tambien imprime este recordatorio cuando descarga algun
video con `--download`.

El resultado de Ark puede venir a 720p aunque el source sea 480p. En la prueba
real `barbell_squats` descargo:

```text
libraries/tsl26/barbell_squats/default/barbell_squats.mp4
1280x720, 4.041667s
```

## Aprendido en la POC

- `barbell_squats` creo tarea correctamente: `cgt-20260505224622-9xqhn`.
- `barbell_deadlifts` creo tarea correctamente y quedo `running` en la ultima
  comprobacion de la sesion.
- `standing_bicep_curls` fue rechazado por Ark antes de crear tarea:
  `InputVideoSensitiveContentDetected.PrivacyInformation`. El mensaje dice que
  el video de entrada puede contener una persona real. El script ahora registra
  ese fallo y continua con el batch.
- Los logs `scripts/tsl26/.workspace/ark/*.ndjson` son salida operativa local y
  estan ignorados por Git junto con el resto de `scripts/tsl26/.workspace`.
- Para repetir pruebas, usar `--overwrite-output`; si no, el script considera ya
  procesado cualquier `clipUrl` presente en `ark-style-tasks.ndjson`.
- Las URLs firmadas de resultado de Ark expiran; descargar cuanto antes con
  `videos:style-status --download`.

## Scripts Disponibles

```bash
npm run videos:clips
npm run videos:style-tasks
npm run videos:style-status
npm run videos:sync-data
npm run transform
npm run library:ensure
npm run build:public
npm run import
```

El dataset contiene 1203 ejercicios. En la ultima comprobacion local, 833 tenian
un video de YouTube detectable en `media`.

## Importar en MongoDB

Flujo actual: para cargar la libreria solo hay que **generar el JSON publico** y
**subirlo desde el panel de admin**. Ya no hace falta correr un import contra
MongoDB desde este repo.

```bash
cd /Users/iagolast/Workspace/trainerstudio-static/scripts/tsl26
npm run build:public
# -> data/exercises-public.json  (este es el archivo que se sube desde admin)
```

Regla operativa: la libreria oficial de MongoDB se carga solo desde
`data/exercises-public.json`.

No subir `data/exercises.ndjson` directamente. Ese archivo es el dataset de
trabajo completo: incluye ejercicios traducidos y etiquetados, pero tambien
ejercicios que solo tienen video `source` y todavia no tienen video `default`
publicable.

El pipeline no tiene pasos auxiliares de shards de traduccion ni batches de
clasificacion. Cualquier correccion de traduccion o clasificacion debe aplicarse
directamente en `data/exercises.ndjson`; la salida publica se reconstruye con
`build:public`.

`build:public` lee `data/exercises.ndjson`, conserva los ids opacos y escribe
`data/exercises-public.json` / `data/exercises-public.ndjson` solo con ejercicios
que tienen video `default` en `libraries/tsl26`.

Antes de importar, comprobar los conteos esperados:

```bash
node - <<'NODE'
const fs = require('fs');
function readData(p) {
  const raw = fs.readFileSync(p, 'utf8').trim();
  return raw.startsWith('[') ? JSON.parse(raw) : raw.split('\n').filter(Boolean).map(JSON.parse);
}
for (const p of ['data/exercises-public.json', 'data/exercises.ndjson']) {
  const data = readData(p);
  console.log(p, {
    total: data.length,
    classified: data.filter((e) => e.classification).length,
    es: data.filter((e) => e.i18n?.name?.es).length,
    default: data.filter((e) => JSON.stringify(e).includes('/default/')).length,
    source: data.filter((e) => JSON.stringify(e).includes('/source/')).length,
  });
}
NODE
```

El input correcto debe tener el mismo numero en `total`, `classified`, `es` y
`default`, y `source: 0`. Si `source` es mayor que cero, se esta mirando el
archivo equivocado para importar a MongoDB.

Con los conteos correctos, subir `data/exercises-public.json` desde el panel de
admin. Ese es el unico paso de carga.

### Import directo (heredado, opcional)

Existe todavia un import por CLI contra MongoDB para uso local/manual. Ya no es
el flujo recomendado (se usa el panel de admin), pero se mantiene por si hace
falta:

```bash
cd /Users/iagolast/Workspace/trainerstudio-static/scripts/tsl26
# crear/recuperar libreria por nombre (imprime el _id)
npm run library:ensure -- --name="TrainerStudio official" --mongodb-uri=mongodb://localhost:27017/trainerStudioDB --database=trainerStudioDB
# importar usando ese library-id
npm run import -- --input=data/exercises-public.json --library-id=<libraryId> --mongodb-uri=mongodb://localhost:27017/trainerStudioDB --database=trainerStudioDB --dry-run
npm run import -- --input=data/exercises-public.json --library-id=<libraryId> --mongodb-uri=mongodb://localhost:27017/trainerStudioDB --database=trainerStudioDB
```
