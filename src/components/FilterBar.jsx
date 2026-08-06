import { useState } from "react";
import "./FilterBar.css";
import { SORTS, UNKNOWN, countActiveFilters } from "../lib/features";
import { REGION_ORDER, SUBURBAN_ID, SUBURBAN_REGION } from "../data/pompeiiMap";

/** Labels for the chips summarising what is currently filtered. */
const CHIP_LABELS = {
  region: "Region",
  insula: "Insula",
  entrance: "Entrance",
  category: "Category",
  usage: "Usage",
  spaceType: "Space type",
  featureType: "Feature type",
  sheetType: "Sheet type",
  season: "Season",
  photosOnly: "Has photos",
};

function Select({ name, label, value, options, onChange, disabled }) {
  return (
    <label className="filter-field">
      <span>{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(name, e.target.value)}
      >
        <option value="">All</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label ?? option.value}
            {option.count == null ? "" : ` (${option.count})`}
          </option>
        ))}
      </select>
    </label>
  );
}

const FilterBar = ({
  index,
  facets,
  filters,
  onFilterChange,
  onReset,
  sort,
  onSortChange,
  resultCount,
  totalCount,
}) => {
  const activeCount = countActiveFilters(filters);
  const [expanded, setExpanded] = useState(false);

  // Region → Insula → Entrance cascade, driven by the same index the map uses.
  const regionOptions = [
    ...REGION_ORDER.filter((id) => index.region(id)).map((id) => ({
      value: id,
      label: `Region ${id}`,
      count: index.region(id).count,
    })),
    ...(index.region(SUBURBAN_ID)
      ? [
          {
            value: SUBURBAN_ID,
            label: SUBURBAN_REGION.label,
            count: index.region(SUBURBAN_ID).count,
          },
        ]
      : []),
  ];

  const region = filters.region ? index.region(filters.region) : null;
  const insulaOptions = (region?.insulae ?? []).map((insula) => ({
    value: insula.key,
    label: insula.key === UNKNOWN ? "Not recorded" : `Insula ${insula.key}`,
    count: insula.count,
  }));

  const insula =
    region && filters.insula
      ? region.insulae.find((i) => i.key === filters.insula)
      : null;
  const entranceOptions = (insula?.entrances ?? []).map((entrance) => ({
    value: entrance.key,
    label: entrance.key === UNKNOWN ? "Not recorded" : entrance.address,
    count: entrance.count,
  }));

  return (
    <div className="filter-bar">
      <div className="filter-primary">
        <div className="filter-search">
          <span className="filter-search-icon" aria-hidden="true">
            🔍
          </span>
          <label htmlFor="feature-search" className="visually-hidden">
            Search survey records
          </label>
          <input
            id="feature-search"
            type="search"
            placeholder="Search text, address, structure, usage…  (press /)"
            value={filters.q}
            onChange={(e) => onFilterChange("q", e.target.value)}
          />
        </div>

        <label className="filter-sort">
          <span className="visually-hidden">Sort records by</span>
          <select value={sort} onChange={(e) => onSortChange(e.target.value)}>
            {Object.entries(SORTS).map(([key, { label }]) => (
              <option key={key} value={key}>
                Sort: {label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className={`filter-toggle ${expanded ? "open" : ""}`}
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          Filters
          {activeCount > 0 && <span className="filter-badge">{activeCount}</span>}
          <span aria-hidden="true">{expanded ? "▴" : "▾"}</span>
        </button>
      </div>

      {expanded && (
        <div className="filter-fields">
          <Select
            name="region"
            label="Region"
            value={filters.region}
            options={regionOptions}
            onChange={onFilterChange}
          />
          <Select
            name="insula"
            label="Insula"
            value={filters.insula}
            options={insulaOptions}
            onChange={onFilterChange}
            disabled={!filters.region}
          />
          <Select
            name="entrance"
            label="Entrance"
            value={filters.entrance}
            options={entranceOptions}
            onChange={onFilterChange}
            disabled={!filters.insula}
          />
          <Select
            name="usage"
            label="Usage"
            value={filters.usage}
            options={facets.usage}
            onChange={onFilterChange}
          />
          <Select
            name="category"
            label="Category"
            value={filters.category}
            options={facets.category}
            onChange={onFilterChange}
          />
          <Select
            name="spaceType"
            label="Space type"
            value={filters.spaceType}
            options={facets.spaceType}
            onChange={onFilterChange}
          />
          <Select
            name="featureType"
            label="Feature type"
            value={filters.featureType}
            options={facets.featureType}
            onChange={onFilterChange}
          />
          <Select
            name="sheetType"
            label="Sheet type"
            value={filters.sheetType}
            options={facets.sheetType}
            onChange={onFilterChange}
          />
          <Select
            name="season"
            label="Season"
            value={filters.season}
            options={facets.season}
            onChange={onFilterChange}
          />
          <label className="filter-check">
            <input
              type="checkbox"
              checked={filters.photosOnly}
              onChange={(e) => onFilterChange("photosOnly", e.target.checked)}
            />
            <span>Only records with photos</span>
          </label>
        </div>
      )}

      <div className="filter-status">
        <span className="filter-count">
          <strong>{resultCount.toLocaleString()}</strong> of{" "}
          {totalCount.toLocaleString()} records
        </span>

        {Object.entries(CHIP_LABELS).map(([name, label]) => {
          const value = filters[name];
          if (!value) return null;
          return (
            <button
              key={name}
              type="button"
              className="filter-chip"
              onClick={() =>
                onFilterChange(name, typeof value === "boolean" ? false : "")
              }
            >
              {label}
              {typeof value === "boolean" ? "" : `: ${value}`}
              <span aria-hidden="true">×</span>
              <span className="visually-hidden">remove filter</span>
            </button>
          );
        })}

        {filters.q && (
          <button
            type="button"
            className="filter-chip"
            onClick={() => onFilterChange("q", "")}
          >
            “{filters.q}”<span aria-hidden="true">×</span>
            <span className="visually-hidden">clear search</span>
          </button>
        )}

        {(activeCount > 0 || filters.q) && (
          <button type="button" className="filter-clear" onClick={onReset}>
            Clear all
          </button>
        )}
      </div>
    </div>
  );
};

export default FilterBar;
