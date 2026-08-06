import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import FeatureCard from "./components/FeatureCard";
import FilterBar from "./components/FilterBar";
import Login from "./components/Login";
import MapView from "./components/MapView";
import {
  EMPTY_FILTERS,
  UNKNOWN,
  applyFilters,
  buildIndex,
  countActiveFilters,
  decorate,
  distinctValues,
  sortFeatures,
} from "./lib/features";
import { regionLabel } from "./data/pompeiiMap";
import { projectPlan } from "./lib/plan";
import {
  DEFAULT_STATE,
  absoluteUrlFor,
  parseHash,
  pushState,
  stateToHash,
} from "./lib/urlState";

const PAGE_SIZE = 50;

const FILTER_KEYS = Object.keys(EMPTY_FILTERS);

function pickFilters(state) {
  return Object.fromEntries(FILTER_KEYS.map((key) => [key, state[key]]));
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => sessionStorage.getItem("isAuthenticated") === "true"
  );
  const [features, setFeatures] = useState([]);
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [state, setState] = useState(() => parseHash());
  const [expandedSheets, setExpandedSheets] = useState(() => new Set());
  const [pendingSheet, setPendingSheet] = useState(null);
  const [notice, setNotice] = useState("");
  const [isHeaderCompact, setIsHeaderCompact] = useState(false);

  const historyMode = useRef("push");

  /* ------------------------------------------------------------ data load */

  useEffect(() => {
    if (!isAuthenticated) return;
    const baseUrl = import.meta.env.BASE_URL || "/";
    let cancelled = false;

    fetch(`${baseUrl}features.json`)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((data) => {
        if (cancelled) return;
        // Keep the first record for each sheet number; drop sheet-less rows.
        const seen = new Set();
        const unique = data.filter((feature) => {
          if (!feature.SHEET || seen.has(feature.SHEET)) return false;
          seen.add(feature.SHEET);
          return true;
        });
        setFeatures(decorate(unique));
        setLoading(false);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("Error loading features:", error);
        setLoadError(error.message);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  // The city plan is a separate, optional fetch: if it fails the map falls back
  // to the hand-drawn schematic rather than disappearing.
  useEffect(() => {
    if (!isAuthenticated) return;
    const baseUrl = import.meta.env.BASE_URL || "/";
    let cancelled = false;

    fetch(`${baseUrl}pompeii-plan.geojson`)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((collection) => {
        if (cancelled) return;
        setPlan(projectPlan(collection));
      })
      .catch((error) => {
        console.warn(
          "Surveyed plan unavailable, using schematic map:",
          error.message
        );
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  /* -------------------------------------------------------- derived data */

  const index = useMemo(
    () => buildIndex(features),
    [features]
  );

  const facets = useMemo(
    () => ({
      category: distinctValues(features, "CATEGORY_ID"),
      usage: distinctValues(features, "USAGE_ID"),
      spaceType: distinctValues(features, "SPACE_TYPE_ID"),
      featureType: distinctValues(features, "FEATURE_TYPE_ID"),
      sheetType: distinctValues(features, "SHEET_TYPE_ID"),
      season: distinctValues(features, "SEASON"),
    }),
    [features]
  );

  const filters = useMemo(() => pickFilters(state), [state]);

  const results = useMemo(() => {
    const filtered = applyFilters(features, filters);
    return sortFeatures(filtered, state.sort);
  }, [features, filters, state.sort]);

  const resultsRef = useRef(results);
  resultsRef.current = results;

  // Used to decide which numbers in relationship text are real cross-references.
  const sheetNumbers = useMemo(
    () => new Set(features.map((feature) => feature.SHEET)),
    [features]
  );
  const isKnownSheet = useCallback(
    (sheetNumber) => sheetNumbers.has(sheetNumber),
    [sheetNumbers]
  );

  const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const currentPage = Math.min(state.page, totalPages);
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const pageFeatures = results.slice(startIndex, startIndex + PAGE_SIZE);

  /* --------------------------------------------------------- URL <-> state */

  const update = useCallback((patch, { replace = false } = {}) => {
    historyMode.current = replace ? "replace" : "push";
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  useEffect(() => {
    const hash = stateToHash(state);
    const current = window.location.hash || "#";
    if (hash === current) return;
    pushState(state, { replace: historyMode.current === "replace" });
  }, [state]);

  useEffect(() => {
    const onPopState = () => {
      historyMode.current = "replace";
      setState(parseHash());
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  /* ------------------------------------------------------------- chrome */

  useEffect(() => {
    const onScroll = () => setIsHeaderCompact(window.scrollY > 90);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // "/" focuses search, Escape clears it — standard for data browsers.
  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = e.target.tagName;
      const typing =
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if (e.key === "/" && !typing) {
        e.preventDefault();
        update({ view: "browse" }, { replace: true });
        requestAnimationFrame(() =>
          document.getElementById("feature-search")?.focus()
        );
      }
      if (e.key === "Escape" && e.target.id === "feature-search") {
        update({ q: "", page: 1 }, { replace: true });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [update]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  /* ------------------------------------------------------ sheet targeting */

  const revealSheet = useCallback(
    (sheetNumber, { replace = false } = {}) => {
      const position = resultsRef.current.findIndex(
        (feature) => feature.SHEET === sheetNumber
      );

      if (position === -1) {
        // Outside the current filters: clear them rather than refusing to move.
        const exists = features.some(
          (feature) => feature.SHEET === sheetNumber
        );
        if (!exists) {
          setNotice(`Sheet ${sheetNumber} is not in this dataset.`);
          return;
        }
        setNotice(`Cleared filters to reach sheet ${sheetNumber}.`);
        update(
          {
            ...EMPTY_FILTERS,
            view: "browse",
            sheet: sheetNumber,
            page: 1,
          },
          { replace }
        );
      } else {
        update(
          {
            view: "browse",
            sheet: sheetNumber,
            page: Math.floor(position / PAGE_SIZE) + 1,
          },
          { replace }
        );
      }
      setPendingSheet(sheetNumber);
    },
    [features, update]
  );

  // A deep link such as #sheet=6083 opens that record once the data is in.
  const deepLinkDone = useRef(false);
  useEffect(() => {
    if (deepLinkDone.current || loading || !features.length) return;
    deepLinkDone.current = true;
    if (state.sheet) revealSheet(state.sheet, { replace: true });
  }, [loading, features.length, state.sheet, revealSheet]);

  // Once the target sheet is on the rendered page, expand and scroll to it.
  useEffect(() => {
    if (!pendingSheet) return;
    if (!pageFeatures.some((feature) => feature.SHEET === pendingSheet)) return;

    setExpandedSheets((prev) => new Set(prev).add(pendingSheet));
    const id = pendingSheet;
    setPendingSheet(null);

    requestAnimationFrame(() => {
      const element = document.getElementById(`sheet-${id}`);
      if (!element) return;
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      element.classList.add("highlight");
      setTimeout(() => element.classList.remove("highlight"), 2000);
    });
  }, [pendingSheet, pageFeatures]);

  /* ----------------------------------------------------------- handlers */

  const handleLogin = () => setIsAuthenticated(true);

  const handleLogout = () => {
    sessionStorage.removeItem("isAuthenticated");
    setIsAuthenticated(false);
    setFeatures([]);
    setLoading(true);
    deepLinkDone.current = false;
    setState({ ...DEFAULT_STATE });
  };

  const handleFilterChange = useCallback(
    (name, value) => {
      const patch = { [name]: value, page: 1, sheet: "" };
      // Narrowing the region invalidates any insula/entrance chosen under it.
      if (name === "region") Object.assign(patch, { insula: "", entrance: "" });
      if (name === "insula") patch.entrance = "";
      update(patch, { replace: name === "q" });
    },
    [update]
  );

  const handleReset = useCallback(
    () => update({ ...EMPTY_FILTERS, page: 1, sheet: "" }),
    [update]
  );

  const goToPage = useCallback(
    (page) => {
      update({ page });
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [update]
  );

  const toggleSheet = useCallback((sheetNumber) => {
    setExpandedSheets((prev) => {
      const next = new Set(prev);
      if (next.has(sheetNumber)) next.delete(sheetNumber);
      else next.add(sheetNumber);
      return next;
    });
  }, []);

  // Read state through a ref so the callback stays stable — otherwise every
  // card on the page re-renders whenever any part of the state changes.
  const stateRef = useRef(state);
  stateRef.current = state;

  const copyLinkFor = useCallback(
    (feature) =>
      absoluteUrlFor({
        ...stateRef.current,
        view: "browse",
        sheet: feature.SHEET,
      }),
    []
  );

  const handleMapNavigate = useCallback(
    ({ region, insula }) => update({ region, insula, entrance: "", page: 1 }),
    [update]
  );

  const handleOpenRecords = useCallback(
    ({ region = "", insula = "", entrance = "", q } = {}) =>
      update({
        ...EMPTY_FILTERS,
        view: "browse",
        region,
        insula,
        entrance,
        ...(q === undefined ? {} : { q }),
        page: 1,
        sheet: "",
      }),
    [update]
  );

  /* ------------------------------------------------------------ rendering */

  if (!isAuthenticated) return <Login onLogin={handleLogin} />;

  if (loading) {
    return (
      <div className="loading">
        <div className="loading-spinner" />
        <h2>Loading Pompeii Survey Data…</h2>
        <p>Roughly 5,000 records — this can take a moment on a slow link.</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="loading">
        <h2>Could not load the survey data</h2>
        <p>{loadError}</p>
        <button
          type="button"
          className="pagination-btn"
          onClick={() => window.location.reload()}
        >
          Try again
        </button>
      </div>
    );
  }

  const activeFilterCount = countActiveFilters(filters);
  const locationLabel = state.region
    ? [
        regionLabel(state.region),
        state.insula && state.insula !== UNKNOWN ? `Insula ${state.insula}` : "",
        state.entrance && state.entrance !== UNKNOWN
          ? `Entrance ${state.entrance}`
          : "",
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  const pageNumbers = buildPageNumbers(currentPage, totalPages);
  const allPageExpanded =
    pageFeatures.length > 0 &&
    pageFeatures.every((feature) => expandedSheets.has(feature.SHEET));

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <header className={`app-header ${isHeaderCompact ? "compact" : ""}`}>
        <div className="header-inner">
          <div className="title-block">
            <span className="title-mark" aria-hidden="true">
              🏛️
            </span>
            <div>
              <h1>Pompeii Food and Drink Research</h1>
              <p className="subtitle">Archaeological Survey Data</p>
            </div>
          </div>

          <div className="header-controls">
            <nav className="view-tabs" aria-label="View">
              <button
                type="button"
                className={state.view === "map" ? "active" : ""}
                aria-current={state.view === "map" ? "page" : undefined}
                onClick={() => update({ view: "map" })}
              >
                🗺️ Map
              </button>
              <button
                type="button"
                className={state.view === "browse" ? "active" : ""}
                aria-current={state.view === "browse" ? "page" : undefined}
                onClick={() => update({ view: "browse" })}
              >
                📋 Records
                <span className="tab-count">
                  {results.length.toLocaleString()}
                </span>
              </button>
            </nav>

            {locationLabel && (
              <span className="header-location">{locationLabel}</span>
            )}

            <button
              type="button"
              onClick={handleLogout}
              className="logout-button"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {notice && (
        <div className="notice" role="status">
          {notice}
        </div>
      )}

      <main id="main">
        {state.view === "map" ? (
          <MapView
            index={index}
            plan={plan}
            regionKey={state.region}
            insulaKey={state.insula}
            onNavigate={handleMapNavigate}
            onOpenRecords={handleOpenRecords}
          />
        ) : (
          <div className="features-container">
            <FilterBar
              index={index}
              facets={facets}
              filters={filters}
              onFilterChange={handleFilterChange}
              onReset={handleReset}
              sort={state.sort}
              onSortChange={(sort) => update({ sort, page: 1 })}
              resultCount={results.length}
              totalCount={features.length}
            />

            {results.length === 0 ? (
              <div className="no-results">
                <p>No records match the current search and filters.</p>
                {(activeFilterCount > 0 || filters.q) && (
                  <button
                    type="button"
                    className="pagination-btn"
                    onClick={handleReset}
                  >
                    Clear search and filters
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="list-toolbar">
                  <span className="pagination-info">
                    {startIndex + 1}–
                    {Math.min(startIndex + PAGE_SIZE, results.length)} of{" "}
                    {results.length.toLocaleString()} · page {currentPage} of{" "}
                    {totalPages}
                  </span>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() =>
                      setExpandedSheets((prev) => {
                        const next = new Set(prev);
                        for (const feature of pageFeatures) {
                          if (allPageExpanded) next.delete(feature.SHEET);
                          else next.add(feature.SHEET);
                        }
                        return next;
                      })
                    }
                  >
                    {allPageExpanded ? "Collapse all" : "Expand all"}
                  </button>
                </div>

                <div className="feature-list">
                  {pageFeatures.map((feature) => (
                    <FeatureCard
                      key={feature.FEATURE_ID ?? feature.SHEET}
                      feature={feature}
                      expanded={expandedSheets.has(feature.SHEET)}
                      onToggle={toggleSheet}
                      onNavigateToSheet={revealSheet}
                      onCopyLink={copyLinkFor}
                      isKnownSheet={isKnownSheet}
                    />
                  ))}
                </div>

                {totalPages > 1 && (
                  <nav className="pagination" aria-label="Pagination">
                    <button
                      type="button"
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="pagination-btn"
                    >
                      ← Previous
                    </button>

                    <div className="pagination-numbers">
                      {pageNumbers.map((page, i) =>
                        page === "..." ? (
                          <span
                            key={`ellipsis-${i}`}
                            className="pagination-ellipsis"
                          >
                            …
                          </span>
                        ) : (
                          <button
                            type="button"
                            key={page}
                            onClick={() => goToPage(page)}
                            aria-current={
                              currentPage === page ? "page" : undefined
                            }
                            className={`pagination-number ${
                              currentPage === page ? "active" : ""
                            }`}
                          >
                            {page}
                          </button>
                        )
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="pagination-btn"
                    >
                      Next →
                    </button>
                  </nav>
                )}
              </>
            )}
          </div>
        )}
      </main>

      {isHeaderCompact && (
        <button
          type="button"
          className="to-top"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          title="Back to top"
        >
          ↑<span className="visually-hidden">Back to top</span>
        </button>
      )}
    </div>
  );
}

function buildPageNumbers(currentPage, totalPages) {
  const pages = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
    return pages;
  }
  if (currentPage <= 4) {
    for (let i = 1; i <= 5; i++) pages.push(i);
    pages.push("...", totalPages);
  } else if (currentPage >= totalPages - 3) {
    pages.push(1, "...");
    for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1, "...");
    for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
    pages.push("...", totalPages);
  }
  return pages;
}

export default App;
