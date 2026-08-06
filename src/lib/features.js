/* ========================================================================
   Feature indexing, addressing, search and filtering.

   Everything here is pure so it can be memoized cheaply — the dataset is
   ~5,000 records and gets re-filtered on every keystroke.
   ======================================================================== */

import { regionKeyOf, REGION_ORDER, SUBURBAN_ID } from "../data/pompeiiMap";

export const UNKNOWN = "—";

/** Trimmed string, or UNKNOWN for null/blank. */
function key(value) {
  const s = value == null ? "" : String(value).trim();
  return s === "" ? UNKNOWN : s;
}

/**
 * Canonical Pompeian address: Region.Insula.Entrance (e.g. "VI.2.6").
 * Missing parts are dropped rather than rendered as empty segments.
 */
export function addressOf(feature) {
  const parts = [feature.REGION, feature.INSULA, feature.ENTRANCE]
    .map((v) => (v == null ? "" : String(v).trim()))
    .filter((v) => v !== "");
  return parts.length ? parts.join(".") : "Unlocated";
}

/** Sort comparator that puts numbers in numeric order and UNKNOWN last. */
export function compareKeys(a, b) {
  if (a === UNKNOWN) return 1;
  if (b === UNKNOWN) return -1;
  const na = Number.parseFloat(a);
  const nb = Number.parseFloat(b);
  const aNum = !Number.isNaN(na);
  const bNum = !Number.isNaN(nb);
  if (aNum && bNum) return na - nb;
  if (aNum) return -1;
  if (bNum) return 1;
  return a.localeCompare(b);
}

function compareRegions(a, b) {
  if (a === SUBURBAN_ID) return 1;
  if (b === SUBURBAN_ID) return -1;
  return REGION_ORDER.indexOf(a) - REGION_ORDER.indexOf(b);
}

/**
 * Builds the Region → Insula → Entrance tree the map navigates, plus the
 * distinct-value lists the filter bar needs.
 *
 * Returns plain arrays (already sorted) so components can render directly.
 */
export function buildIndex(features) {
  const regions = new Map();
  const structures = new Map();

  for (const feature of features) {
    const regionKey = regionKeyOf(feature);
    const insulaKey = key(feature.INSULA);
    const entranceKey = key(feature.ENTRANCE);
    const photos = feature.photos?.length ?? 0;

    let region = regions.get(regionKey);
    if (!region) {
      region = {
        key: regionKey,
        count: 0,
        photoCount: 0,
        rawCodes: new Set(),
        insulae: new Map(),
      };
      regions.set(regionKey, region);
    }
    region.count += 1;
    region.photoCount += photos;
    if (regionKey === SUBURBAN_ID) region.rawCodes.add(key(feature.REGION));

    let insula = region.insulae.get(insulaKey);
    if (!insula) {
      insula = {
        key: insulaKey,
        regionKey,
        count: 0,
        photoCount: 0,
        structures: new Set(),
        entrances: new Map(),
      };
      region.insulae.set(insulaKey, insula);
    }
    insula.count += 1;
    insula.photoCount += photos;

    let entrance = insula.entrances.get(entranceKey);
    if (!entrance) {
      entrance = {
        key: entranceKey,
        regionKey,
        insulaKey,
        address: [regionKey, insulaKey, entranceKey]
          .filter((p) => p !== UNKNOWN)
          .join("."),
        count: 0,
        photoCount: 0,
        structures: new Set(),
        usages: new Set(),
      };
      insula.entrances.set(entranceKey, entrance);
    }
    entrance.count += 1;
    entrance.photoCount += photos;

    const structure = feature.STRUCTURE_ID?.trim();
    if (structure && structure !== "Undetermined") {
      insula.structures.add(structure);
      entrance.structures.add(structure);

      let record = structures.get(structure);
      if (!record) {
        record = { name: structure, count: 0, locations: new Map() };
        structures.set(structure, record);
      }
      record.count += 1;
      const locationId = `${regionKey}|${insulaKey}`;
      const location = record.locations.get(locationId) ?? {
        regionKey,
        insulaKey,
        count: 0,
      };
      location.count += 1;
      record.locations.set(locationId, location);
    }
    const usage = feature.USAGE_ID?.trim();
    if (usage) entrance.usages.add(usage);
  }

  // Freeze into sorted arrays.
  const regionList = [...regions.values()]
    .sort((a, b) => compareRegions(a.key, b.key))
    .map((region) => ({
      ...region,
      rawCodes: [...region.rawCodes].sort(compareKeys),
      insulae: [...region.insulae.values()]
        .sort((a, b) => compareKeys(a.key, b.key))
        .map((insula) => ({
          ...insula,
          structures: [...insula.structures].sort(),
          entrances: [...insula.entrances.values()]
            .sort((a, b) => compareKeys(a.key, b.key))
            .map((entrance) => ({
              ...entrance,
              structures: [...entrance.structures].sort(),
              usages: [...entrance.usages].sort(),
            })),
        })),
    }));

  const byKey = new Map(regionList.map((r) => [r.key, r]));

  // A named structure ("House of the Tragic Poet") occasionally appears under
  // more than one address; the busiest one is used as its map location.
  const structureList = [...structures.values()]
    .map((record) => {
      const locations = [...record.locations.values()].sort(
        (a, b) => b.count - a.count
      );
      return {
        name: record.name,
        count: record.count,
        regionKey: locations[0].regionKey,
        insulaKey: locations[0].insulaKey,
        locationCount: locations.length,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    regions: regionList,
    structures: structureList,
    region: (regionKey) => byKey.get(regionKey) ?? null,
    insula: (regionKey, insulaKey) =>
      byKey.get(regionKey)?.insulae.find((i) => i.key === insulaKey) ?? null,
    total: features.length,
  };
}

/** Distinct values of a field, sorted, for the filter dropdowns. */
export function distinctValues(features, field) {
  const counts = new Map();
  for (const feature of features) {
    const value = feature[field]?.trim?.() ?? feature[field];
    if (value == null || value === "") continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => compareKeys(a[0], b[0]))
    .map(([value, count]) => ({ value, count }));
}

/* ------------------------------------------------------------------ search */

/**
 * Fields the free-text search covers. The old version only looked at sheet,
 * region, insula, entrance, description and space number — so searching for a
 * structure ("House of the Tragic Poet") or a usage ("bakery") found nothing.
 */
const SEARCH_FIELDS = [
  "SHEET",
  "REGION",
  "INSULA",
  "ENTRANCE",
  "STRUCTURE_ID",
  "SPACE_NUMBER",
  "SHEET_TYPE_ID",
  "FEATURE_TYPE_ID",
  "CATEGORY_ID",
  "SPACE_TYPE_ID",
  "USAGE_ID",
  "DESCRIPTION",
  "CONTIGUOUS_RELATIONSHIP",
  "RECORDER_ID",
  "RESEARCHER_ID",
  "SEASON",
];

/**
 * Placeholders the export left behind for SQL NULL. Rendering "\N" as a
 * description confuses readers, so they are normalised away on load.
 */
const NULL_MARKERS = new Set(["\\N", "NULL", "N/A"]);

function clean(feature) {
  const out = {};
  for (const [name, value] of Object.entries(feature)) {
    if (typeof value !== "string") {
      out[name] = value;
      continue;
    }
    const trimmed = value.trim();
    out[name] = trimmed === "" || NULL_MARKERS.has(trimmed) ? null : trimmed;
  }
  return out;
}

/** Attaches the derived fields the UI reads on every render. */
export function decorate(rawFeatures) {
  return rawFeatures.map((raw) => {
    const feature = clean(raw);
    const haystack = SEARCH_FIELDS.map((f) => feature[f] ?? "")
      .join(" ")
      .toLowerCase();
    return {
      ...feature,
      _address: addressOf(feature),
      _regionKey: regionKeyOf(feature),
      _insulaKey: key(feature.INSULA),
      _entranceKey: key(feature.ENTRANCE),
      _photoCount: feature.photos?.length ?? 0,
      _search: `${haystack} ${addressOf(feature).toLowerCase()}`,
    };
  });
}

export const EMPTY_FILTERS = {
  q: "",
  region: "",
  insula: "",
  entrance: "",
  category: "",
  usage: "",
  spaceType: "",
  featureType: "",
  sheetType: "",
  season: "",
  photosOnly: false,
};

const FILTER_TO_FIELD = {
  category: "CATEGORY_ID",
  usage: "USAGE_ID",
  spaceType: "SPACE_TYPE_ID",
  featureType: "FEATURE_TYPE_ID",
  sheetType: "SHEET_TYPE_ID",
  season: "SEASON",
};

export function countActiveFilters(filters) {
  let n = 0;
  for (const [name, value] of Object.entries(filters)) {
    if (name === "q") continue;
    if (value === true || (typeof value === "string" && value !== "")) n += 1;
  }
  return n;
}

export function applyFilters(features, filters) {
  const terms = filters.q
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 0);

  return features.filter((feature) => {
    if (filters.region && feature._regionKey !== filters.region) return false;
    if (filters.insula && feature._insulaKey !== filters.insula) return false;
    if (filters.entrance && feature._entranceKey !== filters.entrance) {
      return false;
    }
    if (filters.photosOnly && feature._photoCount === 0) return false;

    for (const [name, field] of Object.entries(FILTER_TO_FIELD)) {
      const wanted = filters[name];
      if (wanted && (feature[field] ?? "") !== wanted) return false;
    }

    // Every term must match somewhere — lets "oven VI" narrow usefully.
    for (const term of terms) {
      if (!feature._search.includes(term)) return false;
    }
    return true;
  });
}

export const SORTS = {
  address: {
    label: "Address (Region.Insula.Entrance)",
    compare: (a, b) =>
      compareRegions(a._regionKey, b._regionKey) ||
      compareKeys(a._insulaKey, b._insulaKey) ||
      compareKeys(a._entranceKey, b._entranceKey) ||
      compareKeys(a.SHEET, b.SHEET),
  },
  sheet: {
    label: "Sheet number",
    compare: (a, b) => compareKeys(a.SHEET, b.SHEET),
  },
  newest: {
    label: "Newest recorded first",
    compare: (a, b) =>
      String(b.SHEET_DATE ?? "").localeCompare(String(a.SHEET_DATE ?? "")),
  },
  oldest: {
    label: "Oldest recorded first",
    compare: (a, b) =>
      String(a.SHEET_DATE ?? "").localeCompare(String(b.SHEET_DATE ?? "")),
  },
  photos: {
    label: "Most photos first",
    compare: (a, b) => b._photoCount - a._photoCount,
  },
};

export function sortFeatures(features, sortKey) {
  const sort = SORTS[sortKey] ?? SORTS.address;
  return [...features].sort(sort.compare);
}
