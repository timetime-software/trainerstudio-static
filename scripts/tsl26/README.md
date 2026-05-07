# TSL26 CDN / Ark POC

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

La metadata vive en `scripts/tsl26/data/exercises.json` y
`scripts/tsl26/data/exercises.ndjson`. Cada ejercicio incluye `cdnslug`, generado
desde el nombre en ingles en lowercase y con underscores. Si dos ejercicios
comparten el mismo nombre, el slug lleva el `sourceId` como sufijo para evitar
colisiones en CDN.

## Clips Fuente

Generar todos los clips disponibles en `scripts/tsl26/data/exercises.json`:

```bash
cd /Users/iagolast/Workspace/trainerstudio-static/scripts/tsl26
npm run videos:clips
```

Por defecto el script:

- lee `scripts/tsl26/data/exercises.json`
- detecta el primer video YouTube de cada ejercicio
- descarga el MP4 fuente en `scripts/tsl26/source/videos`
- recorta desde el segundo `1`
- genera `4` segundos
- elimina el audio
- escala a `480` px de alto
- escribe el resultado en `libraries/tsl26/<cdnslug>/source/<cdnslug>.mp4`

Opciones utiles:

```bash
npm run videos:clips -- --limit=10
npm run videos:clips -- --ids=mypthub_196,mypthub_942
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
npm run videos:style-tasks -- --ids=mypthub_196,mypthub_942
npm run videos:style-tasks -- --reference-images=/abs/ref1.png,/abs/ref2.png
npm run videos:style-tasks -- --prompt-file=/abs/prompt.txt
npm run videos:style-tasks -- --cdn-base-url=https://cdn.trainerstudio.com
npm run videos:style-tasks -- --overwrite-output
```

El script escribe las respuestas en:

```text
scripts/tsl26/source/ark-style-tasks.ndjson
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
npm run videos:sync-json
```

Este paso antepone en `scripts/tsl26/data/exercises.json` y
`scripts/tsl26/data/exercises.ndjson` el video final servido desde:

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
- Los logs `scripts/tsl26/source/ark-style-*.ndjson` son salida operativa local y
  estan ignorados por Git.
- Para repetir pruebas, usar `--overwrite-output`; si no, el script considera ya
  procesado cualquier `clipUrl` presente en `ark-style-tasks.ndjson`.
- Las URLs firmadas de resultado de Ark expiran; descargar cuanto antes con
  `videos:style-status --download`.

## Scripts Disponibles

```bash
npm run videos:clips
npm run videos:style-tasks
npm run videos:style-status
npm run videos:sync-json
npm run transform
npm run i18n:apply
npm run library:ensure
npm run import
```

El dataset contiene 1203 ejercicios. En la ultima comprobacion local, 833 tenian
un video de YouTube detectable en `media`.

## Importar en MongoDB

Regla operativa: la libreria oficial de MongoDB se carga solo desde
`data/exercises-public.json`.

No importar `data/exercises.json` directamente en la libreria oficial. Ese archivo
es el dataset de trabajo completo: incluye ejercicios traducidos y etiquetados,
pero tambien ejercicios que solo tienen video `source` y todavia no tienen video
`default` publicable.

Antes de importar, comprobar los conteos esperados:

```bash
node - <<'NODE'
const fs = require('fs');
for (const p of ['data/exercises-public.json', 'data/exercises.json']) {
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
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

Crear o recuperar una libreria por nombre:

```bash
cd /Users/iagolast/Workspace/trainerstudio-static/scripts/tsl26
npm run library:ensure -- --name="TrainerStudio official" --mongodb-uri=mongodb://localhost:27017/trainerStudioDB --database=trainerStudioDB
```

El comando imprime el `_id` de la libreria. Usar ese valor para validar o importar
los ejercicios:

```bash
npm run import -- --input=data/exercises-public.json --library-id=<libraryId> --mongodb-uri=mongodb://localhost:27017/trainerStudioDB --database=trainerStudioDB --dry-run
npm run import -- --input=data/exercises-public.json --library-id=<libraryId> --mongodb-uri=mongodb://localhost:27017/trainerStudioDB --database=trainerStudioDB
```

Si se importo `data/exercises.json` por error, limpiar primero los documentos de
esa libreria que no esten en `data/exercises-public.json` y despues reimportar
`data/exercises-public.json`.
