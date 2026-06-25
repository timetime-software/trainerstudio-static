# foods/

Librerías de **imágenes de alimentos** (dominio nutrición), separadas de las
librerías de ejercicios que viven planas en `libraries/`.

## Convención de rutas

```
libraries/foods/<libreria-vX>/<id>/<variante>/<N>.jpg
```

| Nivel        | Qué es                          | Ejemplo        |
|--------------|---------------------------------|----------------|
| `<libreria>` | Fuente de datos, versionada     | `bedca-v1`     |
| `<id>`       | **ID de la librería de origen** | `1234` (BEDCA) |
| `<variante>` | Estado/ángulo de la imagen      | `default`      |
| `<N>.jpg`    | Imagen numerada desde 0         | `0.jpg`        |

Mismo patrón que las librerías de ejercicios (`<entidad>/<variante>/<N>.jpg`),
así el `mapping.json` y el pipeline a CDN funcionan igual.

URL pública resultante:

```
https://cdn.trainerstudio.com/libraries/foods/bedca-v1/1234/default/0.jpg
```

## Decisiones

- **La carpeta es el ID de origen (BEDCA), no el nombre.** El ID es inmutable;
  el nombre del alimento cambia/traduce. El nombre legible vive en la base de
  datos, no en el path.
- **`bedca-v1`** = primera librería de alimentos. El sufijo `-vX` permite
  regenerar todo el set sin romper URLs cacheadas.
- **Se mantiene el nivel `<variante>` (`default/`)** aunque hoy haya 1 imagen por
  alimento: deja la puerta abierta a variantes (`raw/`, `cooked/`, `plated/`...)
  sin migrar nada y mantiene la simetría con las librerías de ejercicios.
