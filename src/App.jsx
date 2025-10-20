import { useState, useEffect, useMemo } from "react";
import "./App.css";
import FeatureCard from "./components/FeatureCard";
import Login from "./components/Login";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [features, setFeatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Check authentication on mount
  useEffect(() => {
    const authStatus = sessionStorage.getItem("isAuthenticated");
    if (authStatus === "true") {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    sessionStorage.removeItem("isAuthenticated");
    setIsAuthenticated(false);
    setSearchTerm("");
    setCurrentPage(1);
  };

  useEffect(() => {
    // Load the features.json data
    // Use import.meta.env.BASE_URL to work with GitHub Pages
    const baseUrl = import.meta.env.BASE_URL || "/";
    fetch(`${baseUrl}features.json`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        // Remove duplicate sheets - keep first occurrence of each SHEET
        const seenSheets = new Set();
        const uniqueFeatures = data.filter((feature) => {
          if (!feature.SHEET || seenSheets.has(feature.SHEET)) {
            return false;
          }
          seenSheets.add(feature.SHEET);
          return true;
        });
        setFeatures(uniqueFeatures);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error loading features:", error);
        setLoading(false);
      });
  }, []);

  // Memoize filtered features for better performance
  const filteredFeatures = useMemo(() => {
    if (searchTerm.trim() === "") {
      return features;
    }
    const searchLower = searchTerm.toLowerCase();
    return features.filter((feature) => {
      return (
        feature.SHEET?.toLowerCase().includes(searchLower) ||
        feature.REGION?.toLowerCase().includes(searchLower) ||
        feature.INSULA?.toLowerCase().includes(searchLower) ||
        feature.ENTRANCE?.toLowerCase().includes(searchLower) ||
        feature.DESCRIPTION?.toLowerCase().includes(searchLower) ||
        feature.SPACE_NUMBER?.toLowerCase().includes(searchLower)
      );
    });
  }, [searchTerm, features]);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredFeatures.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentFeatures = filteredFeatures.slice(startIndex, endIndex);

  const goToPage = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Navigate to a specific sheet (handles pagination)
  const navigateToSheet = (sheetNumber) => {
    // Find the sheet in filtered features
    const sheetIndex = filteredFeatures.findIndex(
      (f) => f.SHEET === sheetNumber
    );

    if (sheetIndex === -1) {
      // Sheet not found in current filtered results
      alert(
        `Sheet ${sheetNumber} not found in current results. Try clearing your search.`
      );
      return;
    }

    // Calculate which page the sheet is on
    const targetPage = Math.ceil((sheetIndex + 1) / itemsPerPage);

    if (targetPage !== currentPage) {
      // Navigate to the correct page first
      setCurrentPage(targetPage);
      // Wait for render, then scroll to the element
      setTimeout(() => {
        const element = document.getElementById(`sheet-${sheetNumber}`);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
          element.classList.add("highlight");
          setTimeout(() => element.classList.remove("highlight"), 2000);
        }
      }, 100);
    } else {
      // Already on the right page, just scroll
      const element = document.getElementById(`sheet-${sheetNumber}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        element.classList.add("highlight");
        setTimeout(() => element.classList.remove("highlight"), 2000);
      }
    }
  };

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 7;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 4) {
        for (let i = 1; i <= 5; i++) pages.push(i);
        pages.push("...");
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 3) {
        pages.push(1);
        pages.push("...");
        for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push("...");
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push("...");
        pages.push(totalPages);
      }
    }
    return pages;
  };

  if (loading) {
    return (
      <div className="loading">
        <h2>Loading Pompeii Survey Data...</h2>
      </div>
    );
  }

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div>
            <h1>Pompeii Food and Drink Research</h1>
            <p className="subtitle">Archaeological Survey Data</p>
          </div>
          <button onClick={handleLogout} className="logout-button">
            Sign Out
          </button>
        </div>
        <div className="search-container">
          <input
            type="text"
            placeholder="Search by sheet, location, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <div className="search-info">
            Showing {filteredFeatures.length} unique{" "}
            {filteredFeatures.length === 1 ? "location" : "locations"}
            {features.length !== filteredFeatures.length &&
              ` (filtered from ${features.length})`}
          </div>
        </div>
      </header>

      <main className="features-container">
        {filteredFeatures.length === 0 ? (
          <div className="no-results">
            <p>No features found matching "{searchTerm}"</p>
          </div>
        ) : (
          <>
            <div className="pagination-info">
              Page {currentPage} of {totalPages} • Showing {startIndex + 1}-
              {Math.min(endIndex, filteredFeatures.length)} of{" "}
              {filteredFeatures.length}
            </div>

            {currentFeatures.map((feature) => (
              <FeatureCard
                key={feature.FEATURE_ID}
                feature={feature}
                onNavigateToSheet={navigateToSheet}
              />
            ))}

            {totalPages > 1 && (
              <div className="pagination">
                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="pagination-btn"
                >
                  ← Previous
                </button>

                <div className="pagination-numbers">
                  {getPageNumbers().map((page, index) =>
                    page === "..." ? (
                      <span
                        key={`ellipsis-${index}`}
                        className="pagination-ellipsis"
                      >
                        ...
                      </span>
                    ) : (
                      <button
                        key={page}
                        onClick={() => goToPage(page)}
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
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="pagination-btn"
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App;
