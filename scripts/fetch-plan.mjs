#!/usr/bin/env node
/**
 * Fetches a pinned snapshot of the Pompeii city plan from Pompeii Linked Open
 * Data (P-LOD) and writes it to public/pompeii-plan.geojson.
 *
 *   npm run plan:fetch
 *
 * We snapshot rather than call the API at runtime because P-LOD warns that
 * "data entry is ongoing and the content here will frequently change" — a
 * research tool should not have its map shift under it between page loads.
 * Re-run this deliberately when you want to take a newer snapshot.
 *
 * P-LOD's identifiers line up exactly with how this survey addresses records:
 *   r6        → Region VI
 *   r6-i12    → Insula VI.12
 *   r6-i12-p2 → VI.12.2  (a "property" is a street-door address)
 *
 * Only regions and insulae are fetched here; property-level polygons are
 * another ~1.1 MB and nothing in the UI needs them yet.
 *
 * Data © the P-LOD contributors, CC-BY. Geometry originates with the Pompeii
 * Bibliography and Mapping Project (PBMP) and the Pompeii Artistic Landscape
 * Project (PALP). See https://p-lod.org/
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const API = "https://api.p-lod.org";
const OUT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "pompeii-plan.geojson"
);

const NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"];

/** "r6" → "VI"; "r6-i12" → "VI.12" */
function idFromUrn(urn) {
  const local = urn.replace("urn:p-lod:id:", "");
  const match = /^r(\d+)(?:-i(.+))?$/.exec(local);
  if (!match) return null;
  const numeral = NUMERALS[Number(match[1]) - 1];
  if (!numeral) return null;
  return match[2] ? `${numeral}.${match[2]}` : numeral;
}

async function get(pathname) {
  const response = await fetch(`${API}${pathname}`);
  if (!response.ok) {
    throw new Error(`GET ${pathname} → HTTP ${response.status}`);
  }
  return response.json();
}

/** Strips the constant z ordinate and rounds to ~10cm precision. */
function trim(coordinates) {
  if (typeof coordinates[0] === "number") {
    const [x, y] = coordinates;
    return [Math.round(x * 1e6) / 1e6, Math.round(y * 1e6) / 1e6];
  }
  return coordinates.map(trim);
}

function toFeature(level, id, label, geometry) {
  return {
    type: "Feature",
    properties: { level, id, ...(label ? { label } : {}) },
    geometry: { type: geometry.type, coordinates: trim(geometry.coordinates) },
  };
}

const features = [];
const skipped = [];

// 1. the walled city outline
const city = await get("/geojson/pompeii");
if (city?.geometry) {
  features.push(toFeature("city", "pompeii", "Pompeii", city.geometry));
} else {
  skipped.push("city outline");
}

// 2. the nine regiones (includes unexcavated ground, which is informative)
const regions = await get("/spatial-children/pompeii");
for (const node of regions) {
  if (node.type !== "urn:p-lod:id:region") continue;
  const id = idFromUrn(node.urn);
  const geometry = node.geojson ? JSON.parse(node.geojson).geometry : null;
  if (!id || !geometry) {
    skipped.push(node.urn);
    continue;
  }
  features.push(toFeature("region", id, node.label, geometry));
}

// 3. every insula, in one request
const insulae = await get("/instances-of/insula");
for (const node of insulae) {
  const id = idFromUrn(node.urn);
  const geometry = node.geojson ? JSON.parse(node.geojson).geometry : null;
  if (!id || !geometry) {
    skipped.push(node.urn);
    continue;
  }
  features.push(toFeature("insula", id, node.label, geometry));
}

const collection = {
  type: "FeatureCollection",
  attribution:
    "Pompeii Linked Open Data (P-LOD), CC-BY. Geometry from the Pompeii " +
    "Bibliography and Mapping Project (PBMP) and the Pompeii Artistic " +
    "Landscape Project (PALP). https://p-lod.org/",
  source: {
    api: API,
    endpoints: [
      "/geojson/pompeii",
      "/spatial-children/pompeii",
      "/instances-of/insula",
    ],
    retrieved: new Date().toISOString().slice(0, 10),
    crs: "EPSG:4326 (WGS 84 lon/lat); source z ordinate dropped",
  },
  features,
};

fs.writeFileSync(OUT, `${JSON.stringify(collection)}\n`);

const counts = features.reduce((acc, f) => {
  acc[f.properties.level] = (acc[f.properties.level] ?? 0) + 1;
  return acc;
}, {});

console.log(`Wrote ${path.relative(process.cwd(), OUT)}`);
console.log(
  `  ${Object.entries(counts)
    .map(([level, n]) => `${n} ${level}`)
    .join(", ")}  (${(fs.statSync(OUT).size / 1024).toFixed(0)} kB)`
);
if (skipped.length) {
  console.log(`  no geometry for ${skipped.length}: ${skipped.join(", ")}`);
}
