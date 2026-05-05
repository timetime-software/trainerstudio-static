# TSL26

Biblioteca publica de ejercicios preparada para publicarse desde el CDN
`trainerstudio-static`.

La convencion de esta carpeta es separar salida servible de tooling:

```text
tsl26/
  exercises.json         # dataset principal que consumira TrainerStudio
  exercises.ndjson       # mismo dataset en NDJSON para procesos batch/import
  videos/                # assets finales publicables en CDN
    clips/               # clips normalizados de 4s, h480, sin audio
  scripts/               # scripts locales para preparar o regenerar assets
  source/                # fuentes/intermedios que no son el contrato publico
    videos/              # MP4 fuente descargados de YouTube
    i18n-shards/         # shards usados para construir traducciones
    *.report.json        # reportes de transformacion/calidad
```

## Contrato Publico

Los archivos a primer nivel y `videos/clips` son el resultado que deberia quedar
estable para CDN:

- `exercises.json`: array de ejercicios transformados al formato publico.
- `exercises.ndjson`: version linea-a-linea del mismo dataset.
- `videos/clips/*.mp4`: clips normalizados que luego podran pasar por la API de IA
  para convertirlos al formato propio de TrainerStudio.

Todo lo que vive en `scripts/` o `source/` se considera tooling o material
intermedio.

## Generar Clips

Requisitos:

```bash
python3 -m pip install --user yt-dlp
ffmpeg -version
```

Generar todos los clips disponibles en `exercises.json`:

```bash
cd /Users/iagolast/Workspace/trainerstudio-static/libraries/tsl26
npm run videos:clips
```

Por defecto el script:

- lee `exercises.json`
- detecta el primer video YouTube de cada ejercicio
- descarga el MP4 fuente en `source/videos`
- recorta desde el segundo `1`
- genera `4` segundos
- elimina el audio
- escala a `480` px de alto
- escribe el resultado en `videos/clips`

Opciones utiles:

```bash
npm run videos:clips -- --limit=10
npm run videos:clips -- --ids=mypthub_196,mypthub_942
npm run videos:clips -- --overwrite
npm run videos:clips -- --start=1 --duration=4 --height=480
```

Ejemplo de salida:

```text
videos/clips/mypthub_196_barbell-bench-press_4s_h480_silent.mp4
videos/clips/mypthub_942_wide-grip-pull-ups_4s_h480_silent.mp4
```

## Scripts Disponibles

```bash
npm run videos:clips
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
