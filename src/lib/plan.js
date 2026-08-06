/* ========================================================================
   Turns the P-LOD GeoJSON snapshot into ready-to-draw SVG geometry.

   The snapshot is WGS 84 lon/lat (see scripts/fetch-plan.mjs). Pompeii spans
   about 1.3 km, so a plate carrée projection with the longitude axis scaled by
   cos(latitude) is accurate to well under a metre across the site — no need for
   a projection library.

   Everything is precomputed once at load: path strings, bounding boxes for
   zooming, and label anchors.
   ======================================================================== */

const TARGET_WIDTH = 1000;

/** Walks any GeoJSON coordinate nesting depth. */
function eachPoint(coordinates, visit) {
  if (typeof coordinates[0] === "number") {
    visit(coordinates);
    return;
  }
  for (const child of coordinates) eachPoint(child, visit);
}

/** Polygon and MultiPolygon both reduce to a flat list of rings. */
function ringsOf(geometry) {
  return geometry.type === "MultiPolygon"
    ? geometry.coordinates.flat()
    : geometry.coordinates;
}

/**
 * Area-weighted centroid of the largest ring — a reasonable label anchor for
 * blocks that are mostly convex. Falls back to the bbox centre if the ring is
 * degenerate.
 */
function labelAnchor(rings, bbox) {
  let largest = null;
  let largestArea = -1;

  for (const ring of rings) {
    let area = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      area += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    }
    area = Math.abs(area / 2);
    if (area > largestArea) {
      largestArea = area;
      largest = ring;
    }
  }

  if (!largest || largestArea === 0) {
    return [bbox.x + bbox.width / 2, bbox.y + bbox.height / 2];
  }

  let twiceArea = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = largest.length - 1; i < largest.length; j = i++) {
    const cross = largest[j][0] * largest[i][1] - largest[i][0] * largest[j][1];
    twiceArea += cross;
    cx += (largest[j][0] + largest[i][0]) * cross;
    cy += (largest[j][1] + largest[i][1]) * cross;
  }
  if (twiceArea === 0) {
    return [bbox.x + bbox.width / 2, bbox.y + bbox.height / 2];
  }
  return [cx / (3 * twiceArea), cy / (3 * twiceArea)];
}

/**
 * Projects the snapshot into SVG user units, north up, origin top-left.
 * Returns null for anything unusable so callers can fall back to the schematic.
 */
export function projectPlan(collection) {
  const features = collection?.features;
  if (!Array.isArray(features) || features.length === 0) return null;

  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;

  for (const feature of features) {
    if (!feature.geometry) continue;
    eachPoint(feature.geometry.coordinates, ([lon, lat]) => {
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    });
  }
  if (!Number.isFinite(minLon) || !Number.isFinite(minLat)) return null;

  const kx = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const spanX = (maxLon - minLon) * kx;
  const spanY = maxLat - minLat;
  if (spanX <= 0 || spanY <= 0) return null;

  const scale = TARGET_WIDTH / spanX;
  const height = spanY * scale;

  // Latitude increases northward, SVG y increases downward — hence the flip.
  const project = ([lon, lat]) => [
    (lon - minLon) * kx * scale,
    height - (lat - minLat) * scale,
  ];

  const build = (feature) => {
    const rings = ringsOf(feature.geometry).map((ring) => ring.map(project));

    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const ring of rings) {
      for (const [x, y] of ring) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
    const bbox = { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };

    const path = rings
      .map(
        (ring) =>
          `M${ring
            .map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`)
            .join("L")}Z`
      )
      .join("");

    return {
      id: feature.properties.id,
      label: feature.properties.label,
      path,
      bbox,
      anchor: labelAnchor(rings, bbox),
    };
  };

  let city = null;
  const regions = new Map();
  const insulae = new Map();

  for (const feature of features) {
    if (!feature.geometry) continue;
    const { level, id } = feature.properties ?? {};
    if (!id) continue;
    const shape = build(feature);

    if (level === "city") city = shape;
    else if (level === "region") regions.set(id, shape);
    else if (level === "insula") {
      const dot = id.indexOf(".");
      if (dot === -1) continue;
      insulae.set(id, {
        ...shape,
        regionKey: id.slice(0, dot),
        insulaKey: id.slice(dot + 1),
      });
    }
  }

  if (regions.size === 0 && insulae.size === 0) return null;

  // Grouped for cheap per-region rendering when zoomed in.
  const insulaeByRegion = new Map();
  for (const shape of insulae.values()) {
    if (!insulaeByRegion.has(shape.regionKey)) {
      insulaeByRegion.set(shape.regionKey, []);
    }
    insulaeByRegion.get(shape.regionKey).push(shape);
  }

  /*
   * The regiones are markedly concave — I wraps around IX, VII around the
   * Forum — so a polygon centroid can land outside the shape or visually
   * inside a neighbour. Anchoring the numeral on the mean of the region's own
   * insula footprints puts it among the blocks that actually belong to it.
   * Regions with no excavated blocks keep the polygon centroid.
   */
  for (const [regionKey, shapes] of insulaeByRegion) {
    const region = regions.get(regionKey);
    if (!region || shapes.length === 0) continue;
    let totalArea = 0;
    let x = 0;
    let y = 0;
    for (const shape of shapes) {
      const area = Math.max(shape.bbox.width * shape.bbox.height, 1);
      totalArea += area;
      x += shape.anchor[0] * area;
      y += shape.anchor[1] * area;
    }
    if (totalArea > 0) region.anchor = [x / totalArea, y / totalArea];
  }

  return {
    viewBox: { width: TARGET_WIDTH, height },
    bbox: { x: 0, y: 0, width: TARGET_WIDTH, height },
    city,
    regions,
    insulae,
    insulaeByRegion,
    attribution: collection.attribution ?? "",
    retrieved: collection.source?.retrieved ?? "",
  };
}

/** Grows a bbox to an aspect ratio and pads it, for zoom targets. */
export function fitBox(bbox, aspect, pad = 0.12) {
  const padX = bbox.width * pad;
  const padY = bbox.height * pad;
  let x = bbox.x - padX;
  let y = bbox.y - padY;
  let width = bbox.width + padX * 2;
  let height = bbox.height + padY * 2;

  if (width / height < aspect) {
    const target = height * aspect;
    x -= (target - width) / 2;
    width = target;
  } else {
    const target = width / aspect;
    y -= (target - height) / 2;
    height = target;
  }
  return { x, y, width, height };
}
