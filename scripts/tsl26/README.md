# TSL26

Biblioteca publica de ejercicios preparada para publicarse desde el CDN
`trainerstudio-static`.

La salida servible vive en `libraries/tsl26`:

```text
tsl26/
  references/            # imagenes de referencia publicas
  <cdnslug>/source/      # clip original normalizado de 4s
    <cdnslug>.mp4
  <cdnslug>/default/     # clip transformado final, cuando exista
    <cdnslug>.mp4
```

## Contrato Publico

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

## Generar Clips

Requisitos:

```bash
python3 -m pip install --user yt-dlp
ffmpeg -version
```

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

## Crear Tareas de Estilo con Ark

Una vez que los clips de 4s estan en `<cdnslug>/source` y publicados en el CDN,
se pueden crear tareas de transformacion enviando:

- 2 imagenes de referencia publicas en CDN.
- 1 video de referencia publico en CDN por cada clip original.

Las referencias por defecto son:

```text
https://cdn.trainerstudio.com/libraries/tsl26/references/man.png
https://cdn.trainerstudio.com/libraries/tsl26/references/man2.png
```

Validar el payload sin llamar a la API:

```bash
cd /Users/iagolast/Workspace/trainerstudio-static/scripts/tsl26
npm run videos:style-tasks -- --dry-run --limit=1
```

Crear tareas reales:

```bash
export ARK_API_KEY=...
npm run videos:style-tasks -- --limit=10
```

El prompt por defecto es unico para todas las tareas. Pide mantener exactamente
el movimiento, timing, encuadre y duracion del video original, cambiando solo el
aspecto visual al entrenador ilustrado de las referencias sobre fondo blanco. En
cada tarea solo cambia la URL `video_url` del clip en
`libraries/tsl26/<cdnslug>/source/<cdnslug>.mp4`.

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

Consultar estado y descargar resultados completados:

```bash
npm run videos:style-status -- --once
npm run videos:style-status -- --poll --download
```

Cuando una tarea termina con `status: "succeeded"` y devuelve una URL de video,
`--download` guarda el resultado en:

```text
libraries/tsl26/<cdnslug>/default/<cdnslug>.mp4
```

## Scripts Disponibles

```bash
npm run videos:clips
npm run videos:style-tasks
npm run videos:style-status
npm run transform
npm run i18n:apply
npm run import
```

`videos:clips` es el flujo actual para CDN. El resto de scripts vienen del import
original de My PT Hub y se conservan para poder regenerar el dataset o validar
importaciones si hace falta.

## Estado Actual

El dataset contiene 1203 ejercicios. En la ultima comprobacion local, 833 tenian
un video de YouTube detectable en `media`.

No se ha ejecutado todavia la descarga completa de esos 833 clips; solo se ha
validado el flujo con `mypthub_196` y `mypthub_942`.
