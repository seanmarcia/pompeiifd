/* ========================================================================
   Shareable, back-button-friendly app state in the URL hash.

   The hash (rather than the path) keeps deep links working on GitHub Pages,
   which serves the app as a static file with no rewrite rules.

   Example: #view=browse&region=VI&insula=2&q=oven&sort=sheet&page=3
   ======================================================================== */

import { EMPTY_FILTERS } from "./features";

export const DEFAULT_STATE = {
  view: "map", // "map" | "browse"
  region: "",
  insula: "",
  sheet: "", // sheet to scroll to / focus after load
  sort: "address",
  page: 1,
  ...EMPTY_FILTERS,
};

const BOOL_KEYS = new Set(["photosOnly"]);
const NUM_KEYS = new Set(["page"]);

export function parseHash(hash = window.location.hash) {
  const params = new URLSearchParams(hash.replace(/^#\/?/, ""));
  const state = { ...DEFAULT_STATE };
  for (const [name, value] of params) {
    if (!(name in DEFAULT_STATE)) continue;
    if (BOOL_KEYS.has(name)) state[name] = value === "1" || value === "true";
    else if (NUM_KEYS.has(name)) state[name] = Math.max(1, Number(value) || 1);
    else state[name] = value;
  }
  // region and insula double as both map position and list filter
  if (state.view === "map") state.page = 1;
  return state;
}

export function stateToHash(state) {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(state)) {
    if (!(name in DEFAULT_STATE)) continue;
    if (value === DEFAULT_STATE[name]) continue;
    if (value === "" || value === false || value == null) continue;
    params.set(name, BOOL_KEYS.has(name) ? "1" : String(value));
  }
  const query = params.toString();
  return query ? `#${query}` : "#";
}

/** Writes state to the URL. `replace` avoids stacking history for keystrokes. */
export function pushState(state, { replace = false } = {}) {
  const hash = stateToHash(state);
  const url = `${window.location.pathname}${window.location.search}${hash}`;
  if (replace) window.history.replaceState(null, "", url);
  else window.history.pushState(null, "", url);
}

export function absoluteUrlFor(state) {
  return `${window.location.origin}${window.location.pathname}${stateToHash(
    state
  )}`;
}
