# Clasificación de Ejercicios TSL26

## Objetivo

Re-clasificar correctamente los **276 ejercicios** que ya tienen vídeo `default/<slug>.mp4` (vídeo final con la imagen de marca de TrainerStudio). El clasificador heurístico que se usó al transformar el CSV es ruidoso (todo `beginner`, rows clasificados como `squat`, curls con `forceType=mixed`, etc.). Necesitamos clasificación correcta antes de exponer la library.

## Fuentes de verdad

Los enums y reglas viven en el repo del backend (`../trainerstudio`):

- `backend/src/routes/exercises/types/exercise-classification.types.ts` — define `DetailedMuscleGroup` (55 músculos), `MovementPattern`, `ForceType`, `Mechanic`, `Laterality`, `Equipment`.
- `backend/src/routes/muscle-list/data/muscle-groups.data.ts` — traducciones canónicas EN/ES y la jerarquía `general → specific` (con `parentId`).

Los archivos están copiados en `scripts/tsl26/data/classifications/_reference/` para que los agentes los tengan a mano sin salir del proyecto.

## Sistema de niveles musculares

3 niveles, de más general a más específico:

| Nivel | Nombre | Cantidad | Uso |
|---|---|---|---|
| 1 | `SimpleMuscleGroup` | 8 | UI de cliente, filtros básicos |
| 2 | `StandardMuscleGroup` | 18 | Filtros de entrenadores |
| 3 | `DetailedMuscleGroup` | 55 | **Clasificación que debemos rellenar** |

`classification.primaryMuscles[]` y `classification.secondaryMuscles[]` se rellenan en **nivel detallado**. Los niveles superiores se derivan automáticamente por el backend con `toStandardMuscles()` / `toSimpleMuscles()`.

## Reglas de clasificación

Para cada ejercicio el agente debe devolver:

```jsonc
{
  "id": "e1d4c1fc5356e05d76b42e77",
  "level": "beginner|intermediate|expert",
  "classification": {
    "primaryMuscles": ["..."],     // 1-2 motores principales (DetailedMuscleGroup)
    "secondaryMuscles": ["..."],   // 0-3 sinergistas (DetailedMuscleGroup), no repetir primary
    "movementPattern": ["..."],    // 1 (a veces 2) MovementPattern
    "forceType": ["..."],          // 1 ForceType (push, pull, isometric, mixed)
    "mechanic": ["..."],           // ["compound"] o ["isolation"]
    "laterality": ["..."],         // ["bilateral"], ["unilateral"] o ["alternating"]
    "equipment": ["..."]           // 1+ Equipment
  },
  "i18n": {
    "primaryMuscles": { "en": ["..."], "es": ["..."] },
    "secondaryMuscles": { "en": ["..."], "es": ["..."] },
    "equipment": { "en": "Dumbbell", "es": "Mancuerna" }
  },
  "legacy": {
    "force": "pull",          // 1 valor: derivado de classification.forceType
    "mechanic": "compound",   // 1 valor: derivado de classification.mechanic
    "equipment": "dumbbell",  // 1 valor: primer Equipment
    "primaryMuscles": ["..."],   // strings legibles, mismos que i18n.primaryMuscles.en
    "secondaryMuscles": ["..."]  // strings legibles
  }
}
```

### Heurísticas críticas (las que falla el script actual)

- **Rows / pulls** son `forceType=pull` y patrón `horizontal_pull` o `vertical_pull`, NO `squat`.
- **Curls / extensions** son `forceType=push` (extensiones) o `pull` (curls de bíceps/femorales), `mechanic=isolation`, patrón `isolation`.
- **Hamstring curl machine** = `pull` + `isolation`, primary `hamstrings` (puede añadirse `biceps_femoris` si la cámara lo enfatiza).
- **Hip thrust / glute bridge / good morning / deadlift** = `forceType=pull`, patrón `hinge`.
- **Press / push-up / dip** = `forceType=push`, patrón según ángulo: banca = `horizontal_push`, militar = `vertical_push`.
- **Squat / lunge / step-up / leg press** = `forceType=push`, patrón `squat` o `lunge`.
- **Plank / hold** = `forceType=isometric`, patrón `anti_rotation` o `isolation` según corresponda.
- **Carry / farmer walk** = `forceType=mixed`, patrón `carry`.
- **Single leg / one arm / single arm** => `laterality=unilateral`.
- **Alternating** (en el nombre) => `laterality=alternating`.
- Resto => `laterality=bilateral`.

### Nivel (level)

- `beginner`: bodyweight básicos, máquinas guiadas, isolation con peso ligero.
- `intermediate`: barbell/dumbbell compounds estándar, requiere técnica.
- `expert`: olympic lifts (clean, snatch, jerk), pistol squat, muscle-up, handstand push-up, deadlift sumo pesado, etc.

### Equipment

Mapeo recomendado de `equipment` legacy del CSV → enum:

| Legacy CSV | Equipment enum |
|---|---|
| Bands | `resistance_band` |
| Bar / Barbell | `barbell` |
| Bench | `bench` |
| Body Only / None | `bodyweight` |
| BOSU | `bosu` |
| Box / Step | `box` |
| Cable | `cable` |
| Dumbbell | `dumbbell` |
| E-Z Curl Bar | `ez_bar` |
| Exercise Ball | `stability_ball` |
| Foam Roll | `foam_roller` |
| Kettlebells | `kettlebell` |
| Machine | `machine` |
| Medicine Ball | `medicine_ball` |
| Ropes | `battle_ropes` |
| Spin Bike | `bike` |
| TRX | `suspension` |

Si el ejercicio requiere un banco para apoyarse pero el equipo principal es mancuerna, añadir ambos: `["dumbbell", "bench"]`.

### Traducciones (i18n)

Tomar las traducciones EN/ES literalmente de `MUSCLE_GROUPS_DATA` en `muscle-groups.data.ts`. No improvisar. Para equipment usar el formato natural en cada idioma (p.ej. `Dumbbell` / `Mancuerna`, `Resistance Band` / `Banda de resistencia`).

## Workflow

1. **Generar batches** (este paso ya está hecho automáticamente):
   - Script: `npm run classify:batches`
   - Lee `data/exercises.json`, filtra los que tienen `default/` en disco, divide en batches de 25.
   - Escribe `data/classifications/batch-NN.input.json` con los datos de entrada (id, name, instructions EN, classification actual, video URL).

2. **Cada subagente clasifica un batch**:
   - Input: `data/classifications/batch-NN.input.json`
   - Reglas: este README + archivos de referencia en `data/classifications/_reference/`.
   - Output: `data/classifications/batch-NN.output.json` con un array de los objetos descritos arriba.

3. **Merge final** (un solo paso):
   - Script: `npm run classify:merge`
   - Lee todos los `batch-*.output.json`, aplica los cambios a `data/exercises.json` y `data/exercises.ndjson` (matching por `id`).
   - Reporta IDs cubiertos / faltantes.

4. **Regenerar JSON public + reimportar**:
   ```bash
   npm run build:public
   npm run import -- --library-id=<oid> --input=data/exercises-public.json
   ```

## Reglas para los subagentes

- **Solo modifican** los campos especificados arriba, nunca tocan instructions, name, ni media.
- **Validan enums**: cualquier valor fuera del enum se considera error (el merge lo rechaza).
- **No tienen acceso a vídeo**, usan nombre + instrucciones + conocimiento de fitness para clasificar.
- **Si dudan**, eligen la opción más conservadora (mecánica simple, equipo más común) y dejan una nota en `_notes` por ejercicio dentro del output.
- Mantienen `secondaryMuscles` corto y relevante (no añadir "abs" en cada ejercicio).
- Devuelven el output con el mismo orden que el input.
