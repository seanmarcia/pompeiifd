import { useEffect, useMemo, useRef, useState } from "react";

import "./MapView.css";
import {
  CITY_WALL,
  GATES,
  LANDMARKS,
  REGIONS,
  STREETS,
  SUBURBAN_ID,
  SUBURBAN_REGION,
  VIEWBOX,
  isSuburban,
  pointsToPath,
  polyline,
  regionBlurb,
  regionLabel,
} from "../data/pompeiiMap";
import { UNKNOWN } from "../lib/features";
import { fitBox } from "../lib/plan";

/* ------------------------------------------------------------------ zooming */

function bboxOf(points, pad = 40) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const x = Math.min(...xs) - pad;
  const y = Math.min(...ys) - pad;
  return {
    x,
    y,
    width: Math.max(...xs) + pad - x,
    height: Math.max(...ys) + pad - y,
  };
}

/** Grows a box to the map's aspect ratio so the zoom never distorts. */
function fitAspect(box) {
  const aspect = VIEWBOX.width / VIEWBOX.height;
  let { x, y, width, height } = box;
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

const FULL_VIEW = { x: 0, y: 0, width: VIEWBOX.width, height: VIEWBOX.height };

const easeInOut = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/** Tweens the SVG viewBox — CSS can't transition the attribute. */
function useViewBoxTween(target) {
  const [box, setBox] = useState(target);
  const fromRef = useRef(target);
  const frameRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")
      .matches;

    if (
      reduced ||
      (from.x === target.x &&
        from.y === target.y &&
        from.width === target.width)
    ) {
      fromRef.current = target;
      setBox(target);
      return undefined;
    }

    const duration = 520;
    let start = null;
    const step = (now) => {
      if (start === null) start = now;
      const t = Math.min(1, (now - start) / duration);
      const e = easeInOut(t);
      const next = {
        x: from.x + (target.x - from.x) * e,
        y: from.y + (target.y - from.y) * e,
        width: from.width + (target.width - from.width) * e,
        height: from.height + (target.height - from.height) * e,
      };
      setBox(next);
      fromRef.current = next;
      if (t < 1) frameRef.current = requestAnimationFrame(step);
      else fromRef.current = target;
    };
    frameRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target]);

  return box;
}

/* ------------------------------------------------------------------- helpers */

/** sqrt scale keeps the sparsely-recorded regions visible. */
function shadeFor(count, max) {
  if (!count) return 0;
  return 0.16 + 0.72 * Math.sqrt(count / max);
}

function plural(n, word) {
  return `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;
}

function insulae(n) {
  return `${n.toLocaleString()} ${n === 1 ? "insula" : "insulae"}`;
}

/* ---------------------------------------------------------------- city plan */

function CityPlan({ index, activeRegion, onPickRegion }) {
  const counts = useMemo(() => {
    const map = new Map();
    for (const region of index.regions) map.set(region.key, region.count);
    return map;
  }, [index]);

  const max = Math.max(1, ...[...counts.values()]);

  const target = useMemo(() => {
    if (!activeRegion || isSuburban(activeRegion)) return FULL_VIEW;
    const region = REGIONS.find((r) => r.id === activeRegion);
    if (!region) return FULL_VIEW;
    return fitAspect(bboxOf(region.points, 46));
  }, [activeRegion]);

  const box = useViewBoxTween(target);
  const zoomed = Boolean(activeRegion) && !isSuburban(activeRegion);

  return (
    <svg
      className={`city-plan ${zoomed ? "zoomed" : ""}`}
      viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`}
      role="group"
      aria-label="Schematic plan of Pompeii — select a region"
    >
      <defs>
        <pattern
          id="unexcavated"
          width="7"
          height="7"
          patternTransform="rotate(45)"
          patternUnits="userSpaceOnUse"
        >
          <line x1="0" y1="0" x2="0" y2="7" className="hatch-line" />
        </pattern>
      </defs>

      <polygon className="city-wall" points={pointsToPath(CITY_WALL)} />

      {/* Region fills first, then the streets on top, then the labels — the
          streets are what make the blocks read as city blocks. */}
      {REGIONS.map((region) => {
        const count = counts.get(region.id) ?? 0;
        const isActive = activeRegion === region.id;
        const dimmed = zoomed && !isActive;
        return (
          <g
            key={region.id}
            className={`region ${isActive ? "active" : ""} ${
              dimmed ? "dimmed" : ""
            } ${count ? "" : "empty"}`}
            role="button"
            tabIndex={0}
            aria-label={`Region ${region.id}, ${plural(count, "record")}`}
            onClick={() => onPickRegion(isActive ? "" : region.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onPickRegion(isActive ? "" : region.id);
              }
            }}
          >
            <polygon
              className="region-fill"
              points={pointsToPath(region.points)}
              style={{ fillOpacity: shadeFor(count, max) }}
            />
            {!count && (
              <polygon
                className="region-hatch"
                points={pointsToPath(region.points)}
                fill="url(#unexcavated)"
              />
            )}
            <polygon
              className="region-stroke"
              points={pointsToPath(region.points)}
            />
          </g>
        );
      })}

      {STREETS.map((street) => (
        <path key={street.name} className="street" d={polyline(street.points)} />
      ))}

      {STREETS.map((street) => (
        <text
          key={`label-${street.name}`}
          className="street-label"
          x={street.labelAt[0]}
          y={street.labelAt[1]}
          transform={`rotate(${street.labelAngle} ${street.labelAt[0]} ${street.labelAt[1]})`}
        >
          {street.short}
        </text>
      ))}

      {/* Numerals sit above the streets; pointer-events pass through to the
          region group beneath so the whole block stays clickable. */}
      {REGIONS.map((region) => {
        const count = counts.get(region.id) ?? 0;
        const dimmed = zoomed && activeRegion !== region.id;
        return (
          <g
            key={`label-${region.id}`}
            className={`region-label ${dimmed ? "dimmed" : ""} ${
              count ? "" : "empty"
            }`}
          >
            <text
              className="region-numeral"
              x={region.labelAt[0]}
              y={region.labelAt[1]}
            >
              {region.id}
            </text>
            <text
              className="region-count"
              x={region.labelAt[0]}
              y={region.labelAt[1] + 21}
            >
              {count ? count.toLocaleString() : "no records"}
            </text>
          </g>
        );
      })}

      {LANDMARKS.map((landmark) => (
        <g key={landmark.name} className="landmark">
          <circle cx={landmark.at[0]} cy={landmark.at[1]} r="4" />
          <text x={landmark.at[0]} y={landmark.at[1] - 9}>
            {landmark.name}
          </text>
        </g>
      ))}

      {GATES.map((gate) => (
        <g key={gate.name} className="gate">
          <circle cx={gate.at[0]} cy={gate.at[1]} r="3.5" />
          <text
            x={gate.at[0] + (gate.anchor === "end" ? -9 : gate.anchor === "start" ? 9 : 0)}
            y={gate.at[1] + (gate.anchor === "middle" ? -11 : 4)}
            textAnchor={gate.anchor}
          >
            {gate.name}
          </text>
        </g>
      ))}

      <g className="compass" transform="translate(58, 118)">
        <path d="M0 26 L0 -18 M0 -18 L-6 -8 M0 -18 L6 -8" />
        <text y="-24">N</text>
      </g>
    </svg>
  );
}

/* ------------------------------------------------- surveyed plan (real geometry) */

/**
 * The stage is a fixed 8:5 box rather than the plan's own 2.4:1 proportions.
 * The whole city letterboxes slightly at that ratio, but zooming to a tall
 * region (VIII, II) then fills the frame instead of stranding it in a wide
 * strip. Must match the aspect-ratio on .city-plan.surveyed in the stylesheet.
 */
const STAGE_ASPECT = 8 / 5;

/**
 * The real excavated plan, from the P-LOD snapshot. Insulae are drawn as their
 * actual footprints, so the gaps between them read as the street grid — P-LOD
 * has street entities but no street geometry, and none is needed.
 */
function SurveyedPlan({
  plan,
  properties,
  index,
  activeRegion,
  activeInsula,
  entranceCounts,
  hoveredAddress,
  onHoverAddress,
  onPickRegion,
  onPickInsula,
  onOpenAddress,
}) {
  const counts = useMemo(() => {
    const map = new Map();
    for (const region of index.regions) {
      for (const insula of region.insulae) {
        map.set(`${region.key}.${insula.key}`, insula.count);
      }
    }
    return map;
  }, [index]);

  const max = Math.max(1, ...counts.values());

  const target = useMemo(() => {
    if (activeRegion && activeInsula) {
      const shape = plan.insulae.get(`${activeRegion}.${activeInsula}`);
      // Enough margin to see the neighbouring blocks, but close enough that
      // individual address footprints and their numbers stay legible.
      if (shape) return fitBox(shape.bbox, STAGE_ASPECT, 0.35);
    }
    if (activeRegion) {
      const shape = plan.regions.get(activeRegion);
      if (shape) return fitBox(shape.bbox, STAGE_ASPECT, 0.06);
    }
    return fitBox(plan.bbox, STAGE_ASPECT, 0.02);
  }, [plan, activeRegion, activeInsula]);

  const box = useViewBoxTween(target);
  const zoomed = Boolean(
    activeRegion && (plan.regions.has(activeRegion) || activeInsula)
  );

  // Insula numbers are only legible once a single region fills the frame.
  const labelled = zoomed ? plan.insulaeByRegion.get(activeRegion) ?? [] : [];

  // Address footprints are drawn only for the open insula — at region scale
  // they would be an unreadable mosaic.
  const addresses =
    activeInsula && properties
      ? properties.byInsula.get(`${activeRegion}.${activeInsula}`) ?? []
      : [];

  return (
    <svg
      className={`city-plan surveyed ${zoomed ? "zoomed" : ""}`}
      viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`}
      role="group"
      aria-label="Plan of excavated Pompeii — select a region or insula"
    >
      {plan.city && <path className="city-outline" d={plan.city.path} />}

      {[...plan.regions.values()].map((region) => {
        const isActive = activeRegion === region.id;
        return (
          <path
            key={region.id}
            className={`region-area ${isActive ? "active" : ""} ${
              zoomed && !isActive ? "dimmed" : ""
            }`}
            d={region.path}
            role="button"
            tabIndex={0}
            aria-label={`Region ${region.id}, ${plural(
              index.region(region.id)?.count ?? 0,
              "record"
            )}`}
            onClick={() => onPickRegion(isActive ? "" : region.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onPickRegion(isActive ? "" : region.id);
              }
            }}
          />
        );
      })}

      {[...plan.insulae.values()].map((shape) => {
        const count = counts.get(shape.id) ?? 0;
        const isActive =
          activeRegion === shape.regionKey && activeInsula === shape.insulaKey;
        const dimmed = zoomed && activeRegion !== shape.regionKey;

        // No survey records here — show the block, but don't invite a click.
        if (!count) {
          return (
            <path
              key={shape.id}
              className={`insula-shape empty ${dimmed ? "dimmed" : ""}`}
              d={shape.path}
            />
          );
        }

        return (
          <path
            key={shape.id}
            className={`insula-shape ${isActive ? "active" : ""} ${
              dimmed ? "dimmed" : ""
            }`}
            d={shape.path}
            style={{ fillOpacity: shadeFor(count, max) }}
            role="button"
            tabIndex={0}
            aria-label={`Insula ${shape.id}, ${plural(count, "record")}`}
            onClick={() => onPickInsula(shape.regionKey, shape.insulaKey)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onPickInsula(shape.regionKey, shape.insulaKey);
              }
            }}
          >
            <title>{`${shape.label ?? shape.id} — ${plural(
              count,
              "record"
            )}`}</title>
          </path>
        );
      })}

      {addresses.map((shape) => {
        const count = entranceCounts?.get(shape.entranceKey) ?? 0;
        const hovered = hoveredAddress === shape.entranceKey;
        return (
          <path
            key={`prop-${shape.id}`}
            className={`property-shape ${count ? "" : "no-records"} ${
              hovered ? "hovered" : ""
            }`}
            d={shape.path}
            role={count ? "button" : undefined}
            tabIndex={count ? 0 : undefined}
            aria-label={
              count
                ? `${shape.id}, ${plural(count, "record")}`
                : undefined
            }
            onMouseEnter={() => onHoverAddress?.(shape.entranceKey)}
            onMouseLeave={() => onHoverAddress?.(null)}
            onFocus={() => onHoverAddress?.(shape.entranceKey)}
            onBlur={() => onHoverAddress?.(null)}
            onClick={count ? () => onOpenAddress?.(shape.entranceKey) : undefined}
            onKeyDown={
              count
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onOpenAddress?.(shape.entranceKey);
                    }
                  }
                : undefined
            }
          >
            <title>
              {count
                ? `${shape.id} — ${plural(count, "record")}`
                : `${shape.id} — no survey records`}
            </title>
          </path>
        );
      })}

      {addresses.map((shape) => {
        const count = entranceCounts?.get(shape.entranceKey) ?? 0;
        if (!count) return null;
        return (
          <text
            key={`plabel-${shape.id}`}
            className="property-numeral"
            x={shape.anchor[0]}
            y={shape.anchor[1]}
            style={{ fontSize: box.width / 62 }}
          >
            {shape.entranceKey}
          </text>
        );
      })}

      {!zoomed &&
        [...plan.regions.values()].map((region) => (
          <text
            key={`label-${region.id}`}
            className="region-numeral surveyed"
            x={region.anchor[0]}
            y={region.anchor[1]}
          >
            {region.id}
          </text>
        ))}

      {labelled.map((shape) => {
        const count = counts.get(shape.id) ?? 0;
        // The open insula's own number would collide with the address numbers.
        if (addresses.length > 0 && shape.insulaKey === activeInsula) {
          return null;
        }
        return (
          <text
            key={`ilabel-${shape.id}`}
            className={`insula-numeral ${count ? "" : "empty"}`}
            x={shape.anchor[0]}
            y={shape.anchor[1]}
            /* Sized from the visible span so it renders at a near-constant
               pixel size at every zoom level. */
            style={{ fontSize: box.width / 44 }}
          >
            {shape.insulaKey}
          </text>
        );
      })}

      <g
        className="compass"
        transform={`translate(${box.x + box.width * 0.055} ${
          box.y + box.height * 0.16
        }) scale(${box.width / plan.viewBox.width})`}
      >
        <path d="M0 26 L0 -18 M0 -18 L-6 -8 M0 -18 L6 -8" />
        <text y="-24">N</text>
      </g>
    </svg>
  );
}

/* ------------------------------------------------------- structure type-ahead */

function StructureFinder({ structures, onPick }) {
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return structures
      .filter((s) => s.name.toLowerCase().includes(q))
      .slice(0, 12);
  }, [query, structures]);

  return (
    <div className="structure-finder">
      <label htmlFor="structure-finder-input">Jump to a named structure</label>
      <input
        id="structure-finder-input"
        type="search"
        value={query}
        placeholder="House of the Tragic Poet, Garum Shop…"
        onChange={(e) => setQuery(e.target.value)}
        autoComplete="off"
      />
      {query.trim().length >= 2 && (
        <ul className="structure-results">
          {matches.length === 0 && (
            <li className="structure-empty">
              No structure matches “{query.trim()}”
            </li>
          )}
          {matches.map((structure) => (
            <li key={structure.name}>
              <button type="button" onClick={() => onPick(structure)}>
                <span className="structure-name">{structure.name}</span>
                <span className="structure-meta">
                  {isSuburban(structure.regionKey)
                    ? "outside the walls"
                    : `${structure.regionKey}${
                        structure.insulaKey === UNKNOWN
                          ? ""
                          : `.${structure.insulaKey}`
                      }`}{" "}
                  · {structure.count}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- side panel */

function CityPanel({ index, onPickRegion, onPickStructure, onBrowseAll }) {
  const suburban = index.regions.find((r) => isSuburban(r.key));
  const numbered = index.regions.filter((r) => !isSuburban(r.key));

  return (
    <>
      <p className="panel-lede">
        Pick a region on the plan — or from the list — to see its insulae, then
        an insula to reach individual addresses and survey sheets.
      </p>

      <StructureFinder
        structures={index.structures}
        onPick={onPickStructure}
      />

      <h3 className="panel-heading">Regions</h3>
      <ul className="region-list">
        {numbered.map((region) => (
          <li key={region.key}>
            <button type="button" onClick={() => onPickRegion(region.key)}>
              <span className="region-list-id">{region.key}</span>
              <span className="region-list-body">
                <span className="region-list-count">
                  {plural(region.count, "record")} ·{" "}
                  {insulae(region.insulae.length)}
                </span>
                <span className="region-list-blurb">
                  {regionBlurb(region.key)}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {suburban && (
        <>
          <h3 className="panel-heading">Beyond the walls</h3>
          <button
            type="button"
            className="suburban-card"
            onClick={() => onPickRegion(SUBURBAN_ID)}
          >
            <strong>{SUBURBAN_REGION.label}</strong>
            <span>{plural(suburban.count, "record")}</span>
            <span className="suburban-note">
              {SUBURBAN_REGION.blurb}. Original region codes:{" "}
              {suburban.rawCodes.join(", ")}.
            </span>
          </button>
        </>
      )}

      <button type="button" className="panel-action" onClick={onBrowseAll}>
        Browse all {index.total.toLocaleString()} records as a list →
      </button>
    </>
  );
}

function RegionPanel({ region, plan, onPickInsula, onBrowse }) {
  const max = Math.max(1, ...region.insulae.map((i) => i.count));

  // Insulae P-LOD has not digitised (or that carry a mistyped number) have no
  // footprint on the plan, so this list stays their way in.
  const unmapped = plan
    ? region.insulae.filter(
        (insula) => !plan.insulae.has(`${region.key}.${insula.key}`)
      )
    : [];

  return (
    <>
      <p className="panel-lede">{regionBlurb(region.key)}</p>
      <p className="panel-stat">
        {plural(region.count, "record")} · {insulae(region.insulae.length)} ·{" "}
        {plural(region.photoCount, "photo")}
      </p>

      {isSuburban(region.key) && (
        <p className="panel-note">
          These records sit outside the excavated street grid, so their region
          codes ({region.rawCodes.join(", ")}) are not Pompeian numerals. The
          insula values below are reproduced as recorded.
        </p>
      )}

      <h3 className="panel-heading">
        Insulae
        <span className="panel-hint">
          {plan
            ? "listed by number — or click a block on the plan"
            : "arranged by number — block sizes show record counts, not ground plan"}
        </span>
      </h3>
      <div className="insula-grid">
        {region.insulae.map((insula) => {
          const mapped =
            !plan || plan.insulae.has(`${region.key}.${insula.key}`);
          return (
            <button
              key={insula.key}
              type="button"
              className={`insula-block ${mapped ? "" : "unmapped"}`}
              style={{ "--fill": shadeFor(insula.count, max) }}
              onClick={() => onPickInsula(insula.key)}
              title={
                [
                  mapped ? null : "Not on the plan",
                  insula.structures.slice(0, 6).join(" · ") || null,
                ]
                  .filter(Boolean)
                  .join(" — ") || undefined
              }
            >
              <span className="insula-key">
                {insula.key === UNKNOWN ? "no insula" : insula.key}
              </span>
              <span className="insula-count">{insula.count}</span>
            </button>
          );
        })}
      </div>

      {unmapped.length > 0 && (
        <p className="panel-footnote">
          Not drawn on the plan:{" "}
          {unmapped
            .map((i) => (i.key === UNKNOWN ? "no insula recorded" : i.key))
            .join(", ")}{" "}
          — P-LOD has no footprint for {unmapped.length === 1 ? "it" : "these"}.
          Still browsable from the list above.
        </p>
      )}

      <button type="button" className="panel-action" onClick={onBrowse}>
        {isSuburban(region.key)
          ? `Browse all ${region.count.toLocaleString()} records outside the walls`
          : `Browse all ${region.count.toLocaleString()} records in ${regionLabel(
              region.key
            )}`}{" "}
        →
      </button>
    </>
  );
}

function InsulaPanel({
  region,
  insula,
  properties,
  hoveredAddress,
  onHoverAddress,
  onOpenEntrance,
  onBrowse,
}) {
  const drawn = properties?.byAddress;
  const undrawn = drawn
    ? insula.entrances.filter(
        (entrance) => !drawn.has(`${region.key}.${insula.key}.${entrance.key}`)
      )
    : [];

  return (
    <>
      <p className="panel-stat">
        {plural(insula.count, "record")} ·{" "}
        {plural(insula.entrances.length, "entrance")} ·{" "}
        {plural(insula.photoCount, "photo")}
      </p>

      {insula.structures.length > 0 && (
        <p className="panel-lede">
          <strong>Named structures:</strong> {insula.structures.join(" · ")}
        </p>
      )}

      <h3 className="panel-heading">
        Entrances
        <span className="panel-hint">
          {drawn
            ? "each is one street address — hover to locate it on the plan"
            : "each is one street address in Region.Insula.Entrance form"}
        </span>
      </h3>
      <ul className="entrance-list">
        {insula.entrances.map((entrance) => (
          <li key={entrance.key}>
            <button
              type="button"
              className={
                hoveredAddress === entrance.key ? "entrance-hovered" : ""
              }
              onMouseEnter={() => onHoverAddress?.(entrance.key)}
              onMouseLeave={() => onHoverAddress?.(null)}
              onClick={() => onOpenEntrance(entrance.key)}
            >
              <span className="entrance-address">
                {entrance.key === UNKNOWN
                  ? `${region.key}.${insula.key} · no entrance recorded`
                  : entrance.address}
              </span>
              <span className="entrance-body">
                {entrance.structures.length > 0 && (
                  <span className="entrance-structure">
                    {entrance.structures.join(" · ")}
                  </span>
                )}
                {entrance.usages.length > 0 && (
                  <span className="entrance-usage">
                    {entrance.usages.join(" · ")}
                  </span>
                )}
              </span>
              <span className="entrance-count">
                {entrance.count}
                {entrance.photoCount > 0 && (
                  <span className="entrance-photos">
                    📷 {entrance.photoCount}
                  </span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {drawn && undrawn.length > 0 && (
        <p className="panel-footnote">
          {undrawn.length === insula.entrances.length
            ? "None of these addresses"
            : `${undrawn.length} of these addresses`}{" "}
          {undrawn.length === 1 ? "has" : "have"} no footprint in P-LOD, so{" "}
          {undrawn.length === 1 ? "it is" : "they are"} not outlined on the
          plan. The records are unaffected.
        </p>
      )}

      <button type="button" className="panel-action" onClick={onBrowse}>
        Browse all {insula.count.toLocaleString()} records in {region.key}.
        {insula.key} →
      </button>
    </>
  );
}

/* ------------------------------------------------------------------- export */

const MapView = ({
  index,
  plan,
  properties,
  regionKey,
  insulaKey,
  onNavigate,
  onOpenRecords,
}) => {
  const region = regionKey ? index.region(regionKey) : null;
  const insula = region && insulaKey ? index.insula(regionKey, insulaKey) : null;

  // Shared so the plan and the entrance list highlight the same address.
  const [hoveredAddress, setHoveredAddress] = useState(null);

  const entranceCounts = useMemo(() => {
    if (!insula) return null;
    return new Map(insula.entrances.map((e) => [e.key, e.count]));
  }, [insula]);

  const crumbs = [
    { label: "Pompeii", onClick: () => onNavigate({ region: "", insula: "" }) },
  ];
  if (region) {
    crumbs.push({
      label: regionLabel(region.key),
      onClick: () => onNavigate({ region: region.key, insula: "" }),
    });
  }
  if (insula) {
    crumbs.push({
      label: insula.key === UNKNOWN ? "No insula recorded" : `Insula ${insula.key}`,
      onClick: null,
    });
  }

  return (
    <section className="map-view">
      <nav className="breadcrumbs" aria-label="Map location">
        {crumbs.map((crumb, i) => (
          <span key={crumb.label} className="crumb">
            {i > 0 && <span className="crumb-sep" aria-hidden="true">›</span>}
            {crumb.onClick ? (
              <button type="button" onClick={crumb.onClick}>
                {crumb.label}
              </button>
            ) : (
              <span aria-current="page">{crumb.label}</span>
            )}
          </span>
        ))}
      </nav>

      <div className="map-layout">
        <div className="map-stage">
          {plan ? (
            <SurveyedPlan
              plan={plan}
              properties={properties}
              index={index}
              activeRegion={regionKey}
              activeInsula={insulaKey}
              entranceCounts={entranceCounts}
              hoveredAddress={hoveredAddress}
              onHoverAddress={setHoveredAddress}
              onPickRegion={(key) => onNavigate({ region: key, insula: "" })}
              onPickInsula={(pickedRegion, pickedInsula) =>
                onNavigate({ region: pickedRegion, insula: pickedInsula })
              }
              onOpenAddress={(entrance) =>
                onOpenRecords({
                  region: regionKey,
                  insula: insulaKey,
                  entrance,
                })
              }
            />
          ) : (
            <CityPlan
              index={index}
              activeRegion={regionKey}
              onPickRegion={(key) => onNavigate({ region: key, insula: "" })}
            />
          )}
          <p className="map-caption">
            {plan ? (
              <>
                Excavated plan of Pompeii. Insula footprints and region outlines
                from{" "}
                <a
                  href="https://p-lod.org/"
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  Pompeii Linked Open Data
                </a>{" "}
                (CC-BY), derived from the Pompeii Bibliography and Mapping
                Project{plan.retrieved ? ` · snapshot ${plan.retrieved}` : ""}.
                Region outlines include unexcavated ground.
              </>
            ) : (
              <>
                Schematic plan — the surveyed plan could not be loaded. The wall
                circuit, main axes and gates are placed approximately and region
                outlines are diagrammatic.
              </>
            )}
          </p>
        </div>

        <aside className="map-panel">
          {!region && (
            <CityPanel
              index={index}
              onPickRegion={(key) => onNavigate({ region: key, insula: "" })}
              onPickStructure={(structure) =>
                onOpenRecords({
                  region: structure.regionKey,
                  insula: structure.insulaKey,
                  q: structure.name,
                })
              }
              onBrowseAll={() => onOpenRecords({})}
            />
          )}
          {region && !insula && (
            <RegionPanel
              region={region}
              plan={plan}
              onPickInsula={(key) =>
                onNavigate({ region: region.key, insula: key })
              }
              onBrowse={() => onOpenRecords({ region: region.key })}
            />
          )}
          {region && insula && (
            <InsulaPanel
              region={region}
              insula={insula}
              properties={properties}
              hoveredAddress={hoveredAddress}
              onHoverAddress={setHoveredAddress}
              onOpenEntrance={(entranceKey) =>
                onOpenRecords({
                  region: region.key,
                  insula: insula.key,
                  entrance: entranceKey,
                })
              }
              onBrowse={() =>
                onOpenRecords({ region: region.key, insula: insula.key })
              }
            />
          )}
        </aside>
      </div>
    </section>
  );
};

export default MapView;
