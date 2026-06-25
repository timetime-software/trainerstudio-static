#!/usr/bin/env node
/**
 * Genera imágenes de ingredientes sobre fondo blanco con la API de OpenAI (gpt-image-1)
 * y las guarda siguiendo la convención libraries/foods/<libreria>/<id>/<variante>/<N>.jpg
 *
 * La API key NUNCA se escribe en disco: se lee de la variable de entorno OPENAI_API_KEY.
 *
 * Modo individual:
 *   OPENAI_API_KEY=... node scripts/generate-food-image.mjs --name "Tomate" --desc "Tomato" --id <id>
 *   OPENAI_API_KEY=... node scripts/generate-food-image.mjs --name "Tomate" --out /tmp/tomate.jpg
 *
 * Modo batch (lee el CSV id,name,description,...):
 *   OPENAI_API_KEY=... node scripts/generate-food-image.mjs --csv ~/Downloads/bedca-foods.csv --from 1 --count 4
 *
 * Flags:
 *   --csv       Ruta a un CSV con cabecera id,name,description,... → modo batch.
 *   --from      Índice 1-based de la primera fila de datos a generar (default: 1).
 *   --count     Cuántas filas generar (default: todas desde --from).
 *   --force     Regenera aunque el fichero ya exista (batch). Por defecto se saltan.
 *   --name      Nombre del alimento (modo individual).
 *   --desc      Descripción/nombre en inglés (ayuda a identificar el alimento).
 *   --prompt    Prompt completo a medida (override del prompt genérico).
 *   --id        ID del alimento → ruta libraries/foods/<libreria>/<id>/<variante>/<N>.jpg
 *   --out       Ruta de salida explícita (ignora --id). Útil para staging/pruebas.
 *   --library   Librería (default: bedca-v1)
 *   --variant   Variante (default: default)
 *   --index     Índice del fichero (default: 0)
 *   --size      Tamaño (default: 1024x1024)
 *   --quality   low|medium|high (default: high)
 */

import { writeFile, mkdir, readFile, access } from "node:fs/promises";
import { dirname, resolve } from "node:path";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token?.startsWith("--")) continue;
    const key = token.replace(/^--/, "");
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      args[key] = true; // flag booleano (ej. --force)
    } else {
      args[key] = next;
      i++;
    }
  }
  return args;
}

/** Parser CSV mínimo que respeta comillas dobles y comas/saltos dentro de campos. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/**
 * Prompt GENÉRICO para cualquier tipo de ingrediente. No prescribe la forma:
 * deja que el modelo elija la presentación más natural y reconocible según el alimento.
 */
function buildPrompt(name, description) {
  const desc = (description ?? "").trim();
  const subject =
    desc && desc.toLowerCase() !== (name ?? "").trim().toLowerCase()
      ? `${name} (${desc})`
      : name;
  return [
    `Minimalist professional product photograph of ${subject}, a single food ingredient,`,
    "shown as ONE clean, simple item in its most natural and recognizable form:",
    "a whole fruit/vegetable/food as a single whole piece;",
    "a liquid (oil, milk, juice, wine) in one simple clear glass or glass bottle;",
    "a powder, flour, sugar, sauce, cream or paste as one small neat mound;",
    "a cut of meat or fish as one fresh piece.",
    "Centered on a pure seamless white background (#FFFFFF) with generous empty negative space around it.",
    "Soft, even, diffused studio lighting with a subtle natural soft shadow directly beneath.",
    "Photorealistic, high detail, sharp focus, natural colors, clean and minimal.",
    "Slight 3/4 top-down angle, the subject filling about 55% of a square frame.",
    "Exactly one single subject — no extra pieces, no cut slices, no garnish, no accompaniments.",
    "No text, no labels, no logos, no brand, no packaging, no props, no hands, no cutlery.",
  ].join(" ");
}

async function exists(p) {
  try { await access(p); return true; } catch { return false; }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function generate({ apiKey, prompt, outPath, size, quality, label }, retries = 4) {
  console.log(`→ Generando ${label} (${size}, quality=${quality})...`);
  for (let attempt = 0; ; attempt++) {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt,
        n: 1,
        size,
        quality,
        output_format: "jpeg",
        background: "opaque",
      }),
    });
    if (res.ok) {
      const json = await res.json();
      const b64 = json?.data?.[0]?.b64_json;
      if (!b64) throw new Error(`Respuesta inesperada: ${JSON.stringify(json).slice(0, 400)}`);
      await mkdir(dirname(outPath), { recursive: true });
      await writeFile(outPath, Buffer.from(b64, "base64"));
      console.log(`✓ ${outPath}`);
      return;
    }
    const text = await res.text();
    // 429 (rate limit) y 5xx → reintento con backoff exponencial
    if ((res.status === 429 || res.status >= 500) && attempt < retries) {
      const wait = Math.min(30000, 2000 * 2 ** attempt);
      console.warn(`· ${res.status} en ${label}, reintento ${attempt + 1}/${retries} en ${wait}ms`);
      await sleep(wait);
      continue;
    }
    throw new Error(`API ${res.status}: ${text}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) { console.error("✗ Falta OPENAI_API_KEY en el entorno."); process.exit(1); }

  const library = args.library ?? "bedca-v1";
  const variant = args.variant ?? "default";
  const index = args.index ?? "0";
  const size = args.size ?? "1024x1024";
  const quality = args.quality ?? "high";

  const outFor = (id) =>
    resolve(`libraries/foods/${library}/${id}/${variant}/${index}.jpg`);

  // ----- Modo batch -----
  if (args.csv) {
    const rows = parseCsv(await readFile(resolve(args.csv), "utf8"));
    const header = rows[0].map((h) => h.trim());
    const idx = (k) => header.indexOf(k);
    const data = rows.slice(1);
    const from = Math.max(1, parseInt(args.from ?? "1", 10));
    const count = args.count ? parseInt(args.count, 10) : data.length - (from - 1);
    const concurrency = Math.max(1, parseInt(args.concurrency ?? "6", 10));
    const slice = data.slice(from - 1, from - 1 + count);

    console.log(
      `Batch: filas ${from}..${from + slice.length - 1} de ${data.length} (concurrency=${concurrency})`,
    );

    let done = 0;
    let skipped = 0;
    const failures = [];
    let cursor = 0;
    async function worker() {
      while (cursor < slice.length) {
        const r = slice[cursor++];
        const id = r[idx("id")];
        const name = r[idx("name")];
        const desc = r[idx("description")];
        const outPath = outFor(id);
        if (!args.force && (await exists(outPath))) { skipped++; continue; }
        try {
          await generate({
            apiKey, prompt: buildPrompt(name, desc), outPath, size, quality,
            label: `"${name}"`,
          });
          done++;
        } catch (err) {
          const msg = err.message ?? String(err);
          failures.push({ id, name, error: msg });
          console.error(`✗ FALLO "${name}" (${id}): ${msg}`);
        }
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(concurrency, slice.length) }, worker),
    );

    console.log(`\nResumen: generadas=${done}, saltadas=${skipped}, fallos=${failures.length}`);
    if (failures.length) {
      console.log("Fallos (relanza el batch para reintentarlos):");
      for (const f of failures) console.log(`  - ${f.name} (${f.id}): ${f.error}`);
    }
    return;
  }

  // ----- Modo individual -----
  if (!args.name) { console.error('✗ Falta --name o --csv.'); process.exit(1); }
  let outPath;
  if (args.out) outPath = resolve(args.out);
  else if (args.id) outPath = outFor(args.id);
  else { console.error("✗ Indica --id o --out."); process.exit(1); }

  const prompt = args.prompt ?? buildPrompt(args.name, args.desc);
  await generate({ apiKey, prompt, outPath, size, quality, label: `"${args.name}"` });
}

main().catch((err) => { console.error("✗", err.message ?? err); process.exit(1); });
