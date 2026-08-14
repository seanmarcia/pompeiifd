# Pompeii Food and Drink Research - Survey Data Webapp

A React/Vite web application for browsing archaeological survey data from Pompeii food and drink research.

## Features

- 🗺️ **Map-first navigation** — the real excavated plan of Pompeii; click any
  insula to zoom to it, then pick an individual street address from its
  actual footprint on the plan
- 🏛️ **Jump to a named structure** — type-ahead over every named building in the
  survey (House of the Tragic Poet, Garum Shop, …)
- 🔍 **Full-text search** across description, address, structure, usage,
  category, space/feature type, recorder and researcher; multiple words narrow
- 🎛️ **Faceted filters** — region → insula → entrance cascade, plus usage,
  category, space type, feature type, sheet type, season and photos-only
- ↕️ **Sorting** by address, sheet number, record date or photo count
- 📋 **Scannable record list** — collapsed one-line rows that expand in place
- 🔗 **Shareable deep links** — every view and record has a URL, and the browser
  back button works
- ⌨️ `/` focuses search, `Esc` clears it
- 📷 Photo galleries with a keyboard-navigable lightbox
- 📚 Archive information for physical records

## Setup

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Installation

1. Clone or download this repository
2. Install dependencies:

   ```bash
   npm install
   ```

3. Configure the photo link environment variable:

   - Copy `.env.example` to `.env`
   - Set `VITE_PHOTO_LINK` to your photo server URL

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and set:

   ```
   VITE_PHOTO_LINK=https://your-photo-server.com/images/
   ```

4. Ensure `features.json` is in the `public` folder

5. `public/pompeii-plan.geojson` and `public/pompeii-properties.geojson` are
   committed, so no extra step is needed. To refresh them from P-LOD:

   ```bash
   npm run plan:fetch
   ```

### Running the Application

Start the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:5173/`

### Building for Production

Build the application:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Data Structure

The application expects `features.json` in the `public` folder with the following structure:

```json
[
  {
    "FEATURE_ID": "16781",
    "SHEET": "6083",
    "SHEET_DATE": "2011-06-30 00:00:00.000",
    "RECORDER_ID": "Linda Baxter",
    "RESEARCHER_ID": "Sera Baker",
    "SEASON": "2011",
    "REGION": "VI",
    "INSULA": "2",
    "ENTRANCE": "6",
    "STRUCTURE_ID": null,
    "SHEET_TYPE_ID": "Feature",
    "SPACE_NUMBER": "Preparation room",
    "DESCRIPTION": "...",
    "CONTIGUOUS_RELATIONSHIP": "...",
    "photos": ["photo1.jpg", "photo2.gif"],
    ...
  }
]
```

## Navigation model

Records are addressed the way Pompeii itself is: **Region.Insula.Entrance**
(e.g. `VI.3.3`). The app builds that hierarchy from the data on load and uses it
for both the map and the filter cascade.

The map uses **real excavated geometry**. `public/pompeii-plan.geojson` is a
pinned snapshot of the walled circuit, the nine region outlines and 107 insula
footprints, fetched from [Pompeii Linked Open Data](https://p-lod.org/) (P-LOD):

```bash
npm run plan:fetch      # re-take the snapshot (scripts/fetch-plan.mjs)
```

P-LOD's identifiers line up exactly with how this survey addresses records —
`r6` → Region VI, `r6-i12` → Insula VI.12, `r6-i12-p2` → VI.12.2 — so no
matching heuristics are involved. The snapshot is committed rather than fetched
live because P-LOD warns that "data entry is ongoing and the content here will
frequently change," and a research tool's map should not shift between page
loads. Re-run `plan:fetch` deliberately.

Insulae are drawn as their true footprints, which means the gaps between them
read as the street grid; P-LOD has street entities but no street geometry, and
none is needed. Region outlines include unexcavated ground — that is why
Regions III, IV and northern V render as largely empty shapes.

A second file, `public/pompeii-properties.geojson` (539 kB, 81 kB gzipped),
holds 1,161 **property** footprints — individual street addresses. It is fetched
lazily, on the first region selection, so the city view never pays for it.
Opening an insula outlines each address inside it; hovering links the plan to
the entrance list in both directions, and clicking one opens its records.

**Coverage.** Measure geometry, not entities: many P-LOD ids exist with a null
`geojson`, so an entity count overstates what can actually be drawn.

| Level | Our addresses drawn | Records on a real footprint |
| --- | --- | --- |
| Insula | 89 / 96 | 4,409 / 4,588 — 96.1% |
| Property | 530 / 771 | 3,347 / 4,581 — 73.1% |

The insula-level gaps are `VII.9` (89 records) and `VI.1` (82) — real insulae
P-LOD has not yet digitised — plus 8 records under mistyped insula numbers
(`VIII.12`, `IV.15`, `IX.0`, `IX.4536`, `VI.6.8`).

Nothing becomes unreachable. Insulae and addresses without a footprint are
flagged in the panel, footnoted, and still browsable from the lists there. The
316 extramural records have no geometry anywhere, since they lie outside the
walls — P-LOD has a `villa-of-the-mysteries` entity but no polygon for it.

`src/data/pompeiiMap.js` keeps a hand-drawn schematic plan as a **fallback**,
used only if the snapshot fails to load. It encodes the wall, main axes, gates
and approximate region outlines; the caption says so when it is in use.

Records whose `REGION` is not one of the nine numerals (codes `0`, `10`–`13`,
`99`, or blank) are extramural — suburban villas and necropolis tombs. They are
grouped under a pseudo-region, "Outside the walls", with their original codes
shown rather than being dropped.

### Attribution

The plan data is CC-BY. `public/pompeii-plan.geojson` carries an `attribution`
member, and the map caption credits P-LOD and PBMP on screen. Keep both if you
change the map. Note that P-LOD's own repositories are inconsistent about
licensing (`p-lod-csv` is CC0, `p-lod-data` has no LICENSE file) — worth
confirming with the maintainers before wider redistribution.

### URL state

All state lives in the URL hash, so links survive a reload and work on GitHub
Pages without rewrite rules:

```
#view=browse&region=VI&insula=3&q=oven&sort=sheet&page=2
#sheet=6083            → opens that record, clearing filters if needed
```

## Component Structure

### `App.jsx`

Loads and normalises the data, owns the URL-backed state, and switches between
the map and record-list views.

### `components/MapView.jsx`

The plan plus the drill-down panel. `SurveyedPlan` draws the real geometry and
`CityPlan` the schematic fallback; both tween the SVG `viewBox` to the selected
region or insula, honouring `prefers-reduced-motion`. Insulae are clickable
directly from the whole-city view, so reaching one is a single click.

### `components/FilterBar.jsx`

Search, sort, the facet grid and the active-filter chips.

### `components/FeatureCard.jsx`

One record. Collapsed it shows address, sheet number, structure, type tags and a
description snippet; expanded it adds details, full description, contiguous
relationships (with clickable sheet cross-references), photos and archive data.

### `lib/features.js`

Pure helpers: address formatting, the region/insula/entrance index, facet
extraction, search, filtering and sorting. Also normalises the export's leftover
`\N` null markers.

### `lib/plan.js`

`projectPlan` projects the P-LOD snapshot into SVG user units (plate carrée with the longitude
axis scaled by cos(latitude) — sub-metre accurate over 1.3 km), precomputing
path strings, bounding boxes for zooming, and label anchors. Region numerals are
anchored on the mean of the region's own insula footprints, because the regiones
are concave enough that a polygon centroid can land inside a neighbour.

`projectProperties` reuses that same transform for the address layer — deriving
a second projection from the properties' own extent would misalign the two.
About 50 addresses have more than one polygon (a property on separate parcels);
those are merged into one multi-subpath shape rather than dropping a part.

Labels and stroke widths are scaled from the visible span (or use
`vector-effect: non-scaling-stroke`) so they hold a constant on-screen size from
whole-city down to a single doorway.

### `lib/urlState.js`

Parses and serialises the hash.

### `scripts/fetch-plan.mjs`

Takes the P-LOD snapshot. Four API calls: `/geojson/pompeii`,
`/spatial-children/pompeii`, `/instances-of/insula`, `/instances-of/property`.
Writes `pompeii-plan.geojson` and `pompeii-properties.geojson`.

## Data notes

The survey export has a few quirks the UI handles deliberately:

- 34 records have the literal string `\N` (a SQL `NULL` marker) as their
  description; these are normalised to empty.
- `NEGATIVE_FEATURE` and `MINORITY_REPORT` are mostly `T`/`F`, displayed as
  Yes/No, with a badge on the row when a negative feature is flagged.
- In `CONTIGUOUS_RELATIONSHIP`, sheet cross-references are 4-digit numbers,
  usually parenthesised — `(6211)`. Shorter numbers are room/space numbers
  within the structure and are deliberately **not** linked even when they
  coincide with a sheet number. Candidates are also checked against the real
  sheet list.
- `STRUCTURE_ID` of `Undetermined` is treated as absent in summaries and in the
  structure finder.

## Environment Variables

| Variable              | Description               | Example                       |
| --------------------- | ------------------------- | ----------------------------- |
| `VITE_PHOTO_LINK`     | Base URL for photo images | `https://photos.example.com/` |
| `VITE_AUTH_USERNAME`  | Sign-in username          | `admin`                       |
| `VITE_AUTH_PASSWORD`  | Sign-in password          | `pompeii2025`                 |

> **Note on the sign-in gate:** the credentials are compiled into the client
> bundle and checked in the browser, so it deters casual visitors but is not
> access control — anyone can read them from the built JavaScript, and
> `features.json` is served as a plain static file. Put the site behind real
> server-side auth if the data is not meant to be public.

## Customization

### Styling

- `src/index.css` - Design tokens (palette, type, shadows) and global styles
- `src/App.css` - App shell, header, pagination
- `src/components/MapView.css` - Map plan and drill-down panel
- `src/components/FilterBar.css` - Search, facets and chips
- `src/components/FeatureCard.css` - Record rows and expanded detail

### Icons

`public/favicon.svg` is the source of truth — a thermopolium counter drawn in
plan, with its dolia (the sunken storage jars), in the app's Pompeian red and
parchment. A plan view rather than a perspective one, to match the map.

`favicon.ico` (16/32/48), `favicon-96.png` and `apple-touch-icon.png` are
rasterised from it and committed. If you change the SVG, re-render them at those
sizes with any tool; the touch icon is deliberately full-bleed square with the
motif inset, because iOS applies its own rounded mask and would otherwise round
the corners twice.

### Colors

The app uses an archaeological theme with brown/terra cotta colors:

- Primary: `#8b4513` (Saddle Brown)
- Secondary: `#d4a574` (Tan)
- Accents: `#a0522d` (Sienna)

## Technologies Used

- **React 19** - UI library
- **Vite** - Build tool and dev server
- **CSS3** - Styling with CSS Grid and Flexbox
- **ESLint** - Code linting

## License

[Add your license information here]

## Contact

[Add your contact information here]
