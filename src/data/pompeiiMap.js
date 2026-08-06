/* ========================================================================
   Schematic plan of Pompeii.

   The survey data records addresses only (Region.Insula.Entrance) — there
   are no coordinates in features.json — so this file hand-encodes the
   *approximate* topography of the excavated city: the circuit wall, the
   three main axes, the gates, and the nine regiones in roughly their real
   relative positions and sizes.

   It is a navigational diagram, not a survey plan. Insula-level geometry is
   deliberately schematic (see InsulaGrid) because block outlines are not
   part of the dataset.
   ======================================================================== */

export const VIEWBOX = { width: 1000, height: 640 };

/** Circuit wall, clockwise from Porta Marina. */
export const CITY_WALL = [
  [95, 400],
  [85, 330],
  [105, 258],
  [140, 200],
  [230, 150],
  [330, 115],
  [455, 95],
  [580, 100],
  [700, 115],
  [790, 130],
  [870, 175],
  [930, 250],
  [940, 330],
  [900, 430],
  [830, 520],
  [700, 560],
  [550, 570],
  [400, 555],
  [270, 520],
  [170, 470],
];

/** The main axes, drawn as guide lines so the regiones read as city blocks. */
export const STREETS = [
  {
    name: "Via delle Terme · della Fortuna · di Nola",
    short: "Via di Nola",
    points: [
      [128, 232],
      [462, 196],
      [790, 140],
    ],
    labelAt: [600, 160],
    labelAngle: -9,
  },
  {
    name: "Via dell'Abbondanza",
    short: "Via dell'Abbondanza",
    points: [
      [250, 400],
      [470, 360],
      [930, 258],
    ],
    labelAt: [640, 306],
    labelAngle: -12,
  },
  {
    name: "Via del Vesuvio · Via Stabiana",
    short: "Via Stabiana",
    points: [
      [455, 95],
      [462, 196],
      [430, 365],
      [400, 555],
    ],
    labelAt: [446, 470],
    labelAngle: 84,
  },
  {
    name: "Via di Nocera",
    short: "Via di Nocera",
    points: [
      [700, 310],
      [830, 520],
    ],
    labelAt: [782, 432],
    labelAngle: 58,
  },
];

export const GATES = [
  { name: "Porta Marina", at: [95, 400], anchor: "end" },
  { name: "Porta Ercolano", at: [140, 200], anchor: "end" },
  { name: "Porta Vesuvio", at: [455, 95], anchor: "middle" },
  { name: "Porta di Nola", at: [790, 130], anchor: "middle" },
  { name: "Porta Sarno", at: [930, 250], anchor: "start" },
  { name: "Porta Nocera", at: [830, 520], anchor: "start" },
  { name: "Porta di Stabia", at: [400, 555], anchor: "middle" },
];

export const LANDMARKS = [
  { name: "Forum", at: [243, 424] },
  { name: "Theatres", at: [332, 478] },
  { name: "Amphitheatre", at: [862, 402] },
];

/**
 * The nine regiones. `points` are the schematic block outlines; `labelAt` is
 * where the numeral sits; `blurb` gives a researcher a quick orientation cue.
 */
export const REGIONS = [
  {
    id: "I",
    points: [
      [430, 365],
      [700, 310],
      [830, 520],
      [700, 560],
      [550, 570],
      [400, 555],
    ],
    labelAt: [566, 452],
    blurb: "South-central — House of the Menander, Via dell'Abbondanza south",
  },
  {
    id: "II",
    points: [
      [700, 310],
      [930, 255],
      [940, 330],
      [900, 430],
      [830, 520],
    ],
    labelAt: [846, 350],
    blurb: "Southeast — Amphitheatre, Great Palaestra, Praedia of Julia Felix",
  },
  {
    id: "III",
    points: [
      [700, 155],
      [790, 140],
      [870, 175],
      [930, 250],
      [700, 310],
    ],
    labelAt: [796, 232],
    blurb: "East, above Via dell'Abbondanza — largely unexcavated",
  },
  {
    id: "IV",
    points: [
      [640, 166],
      [790, 140],
      [700, 115],
      [640, 105],
    ],
    labelAt: [692, 133],
    blurb: "Northeast — almost entirely unexcavated",
  },
  {
    id: "V",
    points: [
      [462, 196],
      [640, 166],
      [640, 105],
      [580, 100],
      [455, 95],
    ],
    labelAt: [548, 145],
    blurb: "North, above Via di Nola — House of the Silver Wedding",
  },
  {
    id: "VI",
    points: [
      [128, 232],
      [462, 196],
      [455, 95],
      [330, 115],
      [230, 150],
      [140, 200],
    ],
    labelAt: [288, 170],
    blurb: "Northwest quarter — House of the Faun, Porta Ercolano necropolis",
  },
  {
    id: "VII",
    points: [
      [128, 232],
      [462, 196],
      [430, 365],
      [255, 402],
      [95, 400],
      [85, 330],
      [105, 258],
    ],
    labelAt: [266, 292],
    blurb: "Centre-west — Stabian Baths, Forum Baths, Via dell'Abbondanza north",
  },
  {
    id: "VIII",
    points: [
      [255, 402],
      [430, 365],
      [400, 555],
      [270, 520],
      [170, 470],
      [95, 400],
    ],
    labelAt: [268, 452],
    blurb: "Southwest — the Forum, Basilica, Theatres, Triangular Forum",
  },
  {
    id: "IX",
    points: [
      [462, 196],
      [700, 155],
      [700, 310],
      [430, 365],
    ],
    labelAt: [572, 262],
    blurb: "Centre-east — Central Baths, House of the Centenary",
  },
];

/** Canonical order used for lists and legends. */
export const REGION_ORDER = [
  "I",
  "II",
  "III",
  "IV",
  "V",
  "VI",
  "VII",
  "VIII",
  "IX",
];

/**
 * Records whose REGION is not one of the nine numerals. In this dataset those
 * are extramural sites — suburban villas and necropolis tombs — entered with
 * ad-hoc numeric codes. They are grouped under one pseudo-region so they stay
 * reachable from the map instead of being silently dropped.
 */
export const SUBURBAN_ID = "Suburban";

export const SUBURBAN_REGION = {
  id: SUBURBAN_ID,
  label: "Outside the walls",
  blurb:
    "Suburban villas and necropolis tombs recorded with non-standard region codes",
};

const NUMERALS = new Set(REGION_ORDER);

/** Which map region a record belongs to. */
export function regionKeyOf(feature) {
  const raw = feature.REGION == null ? "" : String(feature.REGION).trim();
  return NUMERALS.has(raw) ? raw : SUBURBAN_ID;
}

export function isSuburban(regionKey) {
  return regionKey === SUBURBAN_ID;
}

/** Human label for a region key. */
export function regionLabel(regionKey) {
  return isSuburban(regionKey)
    ? SUBURBAN_REGION.label
    : `Region ${regionKey}`;
}

export function regionBlurb(regionKey) {
  if (isSuburban(regionKey)) return SUBURBAN_REGION.blurb;
  return REGIONS.find((r) => r.id === regionKey)?.blurb ?? "";
}

export function pointsToPath(points) {
  return points.map(([x, y]) => `${x},${y}`).join(" ");
}

export function polyline(points) {
  return points.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ");
}
