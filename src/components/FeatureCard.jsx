import { memo, useEffect, useId, useState } from "react";
import "./FeatureCard.css";
import ImageModal from "./ImageModal";

/** The export stores these flags as T/F; spell them out when displaying. */
function flagLabel(value) {
  if (value === "T") return "Yes";
  if (value === "F") return "No";
  return value;
}

/** Trimmed first sentence(s) of the description, for the collapsed row. */
function snippet(text, limit = 190) {
  if (!text) return "";
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= limit) return clean;
  const cut = clean.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 120 ? lastSpace : limit)}…`;
}

const FeatureCard = memo(
  ({
    feature,
    onNavigateToSheet,
    onCopyLink,
    isKnownSheet,
    expanded: controlledExpanded,
    onToggle,
  }) => {
    const photoLink = import.meta.env.VITE_PHOTO_LINK || "";
    const [modalImage, setModalImage] = useState(null);
    const [copied, setCopied] = useState(false);
    const bodyId = useId();

    const expanded = controlledExpanded;
    const photos = feature.photos ?? [];

    useEffect(() => {
      if (!copied) return undefined;
      const timer = setTimeout(() => setCopied(false), 1600);
      return () => clearTimeout(timer);
    }, [copied]);

    const handleNextImage = () => {
      if (modalImage && modalImage.index < photos.length - 1) {
        const nextIndex = modalImage.index + 1;
        const photo = photos[nextIndex];
        setModalImage({
          src: `${photoLink}${photo}`,
          alt: `Photo ${nextIndex + 1} of sheet ${feature.SHEET} - ${photo}`,
          index: nextIndex,
        });
      }
    };

    const handlePrevImage = () => {
      if (modalImage && modalImage.index > 0) {
        const prevIndex = modalImage.index - 1;
        const photo = photos[prevIndex];
        setModalImage({
          src: `${photoLink}${photo}`,
          alt: `Photo ${prevIndex + 1} of sheet ${feature.SHEET} - ${photo}`,
          index: prevIndex,
        });
      }
    };

    const formatDate = (dateString) => {
      if (!dateString) return null;
      const date = new Date(dateString);
      if (Number.isNaN(date.getTime())) return dateString;
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    };

    const renderField = (label, value) => {
      if (value === null || value === undefined || value === "") return null;
      return (
        <div className="field">
          <span className="field-label">{label}:</span>
          <span className="field-value">{value}</span>
        </div>
      );
    };

    /**
     * Renders sheet cross-references in the relationship text as links.
     *
     * Recorders wrote sheet references as 4-digit numbers, usually in
     * parentheses — "(6211)". Shorter numbers in this text are room and space
     * numbers within the structure, so they must NOT be linked even when they
     * happen to coincide with a sheet number. Candidates are additionally
     * checked against the real sheet list, which drops the ~38 four-digit
     * numbers that are measurements rather than references.
     */
    const renderContiguousRelationship = (text) => {
      if (!text) return null;

      const parts = [];
      let lastIndex = 0;
      const regex = /(\((\d{4,})\)|(?:^|\s)(\d{4,})(?=\s|,|\.|$))/g;
      let match;

      while ((match = regex.exec(text)) !== null) {
        const sheetNumber = match[2] || match[3];

        // Not a sheet in this dataset — leave the number as plain text.
        if (isKnownSheet && !isKnownSheet(sheetNumber)) continue;

        if (match.index > lastIndex) {
          parts.push(text.substring(lastIndex, match.index));
        }

        const fullMatch = match[0];
        const leadingSpace =
          fullMatch.startsWith(" ") && !fullMatch.startsWith("(") ? " " : "";

        if (leadingSpace) parts.push(leadingSpace);

        parts.push(
          <a
            key={`sheet-${match.index}`}
            href={`#sheet=${sheetNumber}`}
            className="sheet-link"
            title={`Go to sheet ${sheetNumber}`}
            onClick={(e) => {
              e.preventDefault();
              onNavigateToSheet?.(sheetNumber);
            }}
          >
            {fullMatch.includes("(") ? `(${sheetNumber})` : sheetNumber}
          </a>
        );

        lastIndex = regex.lastIndex;
      }

      if (lastIndex < text.length) parts.push(text.substring(lastIndex));

      return parts.length > 0 ? parts : text;
    };

    const handleCopy = async () => {
      const url = onCopyLink?.(feature);
      if (!url) return;
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
      } catch {
        // Clipboard can be unavailable (insecure context, denied permission).
        window.prompt("Copy this link to the record:", url);
      }
    };

    const summaryTags = [
      feature.SHEET_TYPE_ID,
      feature.USAGE_ID,
      feature.SPACE_TYPE_ID,
      feature.FEATURE_TYPE_ID,
    ].filter(Boolean);

    // "Undetermined" is a placeholder, not a name — it only adds noise here.
    const structureName =
      feature.STRUCTURE_ID && feature.STRUCTURE_ID !== "Undetermined"
        ? feature.STRUCTURE_ID
        : null;

    return (
      <article
        className={`feature-card ${expanded ? "expanded" : ""}`}
        id={`sheet-${feature.SHEET}`}
      >
        {/* Collapsed summary — the whole row toggles the detail */}
        <div className="card-summary">
          <button
            type="button"
            className="summary-main"
            aria-expanded={expanded}
            aria-controls={bodyId}
            onClick={() => onToggle?.(feature.SHEET)}
          >
            <span className="summary-address-block">
              <span className="summary-address">
                {feature._address ?? feature.SHEET}
              </span>
              <span className="summary-sheet">Sheet {feature.SHEET}</span>
            </span>

            <span className="summary-body">
              {structureName && (
                <span className="summary-structure">{structureName}</span>
              )}
              {feature.NEGATIVE_FEATURE === "T" && (
                <span className="summary-flag">Negative feature</span>
              )}
              {summaryTags.length > 0 && (
                <span className="summary-tags">
                  {summaryTags.map((tag, i) => (
                    <span key={`${tag}-${i}`} className="summary-tag">
                      {tag}
                    </span>
                  ))}
                </span>
              )}
              {!expanded && feature.DESCRIPTION && (
                <span className="summary-snippet">
                  {snippet(feature.DESCRIPTION)}
                </span>
              )}
            </span>

            <span className="summary-side">
              {photos.length > 0 && (
                <span className="summary-photos">📷 {photos.length}</span>
              )}
              {feature.SEASON && (
                <span className="summary-season">{feature.SEASON}</span>
              )}
              <span className="summary-chevron" aria-hidden="true">
                {expanded ? "▴" : "▾"}
              </span>
            </span>
          </button>

          <button
            type="button"
            className="summary-copy"
            onClick={handleCopy}
            title="Copy a direct link to this record"
          >
            {copied ? "Copied" : "Link"}
          </button>
        </div>

        {expanded && (
          <div className="card-body" id={bodyId}>
            <div className="meta-info">
              {renderField("Recorder", feature.RECORDER_ID)}
              {renderField("Researcher", feature.RESEARCHER_ID)}
              {feature.SHEET_DATE &&
                renderField("Date", formatDate(feature.SHEET_DATE))}
              {renderField("Season", feature.SEASON)}
            </div>

            <div className="details-section">
              <h3>Details</h3>
              <div className="details-grid">
                {renderField("Structure", feature.STRUCTURE_ID)}
                {renderField("Sheet Type", feature.SHEET_TYPE_ID)}
                {renderField("Space", feature.SPACE_NUMBER)}
                {renderField("Feature Type", feature.FEATURE_TYPE_ID)}
                {renderField("Category", feature.CATEGORY_ID)}
                {renderField("Space Type", feature.SPACE_TYPE_ID)}
                {renderField("Usage", feature.USAGE_ID)}
                {renderField(
                  "Negative Feature",
                  flagLabel(feature.NEGATIVE_FEATURE)
                )}
                {renderField(
                  "Minority Report",
                  flagLabel(feature.MINORITY_REPORT)
                )}
              </div>
            </div>

            {feature.DESCRIPTION && (
              <div className="description-section">
                <h3>Description</h3>
                <p className="description-text">{feature.DESCRIPTION}</p>
              </div>
            )}

            {feature.CONTIGUOUS_RELATIONSHIP && (
              <div className="relationship-section">
                <h3>Contiguous Relationship</h3>
                <p className="relationship-text">
                  {renderContiguousRelationship(
                    feature.CONTIGUOUS_RELATIONSHIP
                  )}
                </p>
              </div>
            )}

            {photos.length > 0 && (
              <div className="photos-section">
                <h3>
                  Photos <span className="count-badge">{photos.length}</span>
                </h3>
                <div className="photos-grid">
                  {photos.map((photo, index) => {
                    const openModal = () =>
                      setModalImage({
                        src: `${photoLink}${photo}`,
                        alt: `Photo ${index + 1} of sheet ${
                          feature.SHEET
                        } - ${photo}`,
                        index,
                      });
                    return (
                      <div
                        key={index}
                        className="photo-item"
                        role="button"
                        tabIndex={0}
                        aria-label={`View photo ${index + 1} of sheet ${
                          feature.SHEET
                        }`}
                        onClick={openModal}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openModal();
                          }
                        }}
                      >
                        <img
                          src={`${photoLink}${photo}`}
                          alt={`Photo ${index + 1} of sheet ${feature.SHEET}`}
                          loading="lazy"
                          onError={(e) => {
                            e.target.style.display = "none";
                            e.target.nextSibling.style.display = "flex";
                          }}
                        />
                        <div
                          className="photo-placeholder"
                          style={{ display: "none" }}
                        >
                          <span>📷</span>
                          <span className="photo-name">{photo}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <ImageModal
              isOpen={!!modalImage}
              imageSrc={modalImage?.src}
              imageAlt={modalImage?.alt}
              onClose={() => setModalImage(null)}
              onNext={handleNextImage}
              onPrev={handlePrevImage}
              hasNext={!!modalImage && modalImage.index < photos.length - 1}
              hasPrev={!!modalImage && modalImage.index > 0}
              currentIndex={modalImage?.index || 0}
              totalImages={photos.length}
            />

            <details className="archive-section">
              <summary>Archive information</summary>
              <div className="archive-grid">
                {renderField("Photographer", feature.PHOTOGRAPHER_ID)}
                {renderField("BW Roll", feature.BW_ROLL)}
                {renderField("Color Roll", feature.COLOR_ROLL)}
                {renderField("Digital Image", feature.DIGITAL_IMAGE)}
                {renderField("Videographer", feature.VIDEOGRAPHER_ID)}
                {renderField("File Number", feature.FILE_NUMBER)}
                {renderField("Tape Number", feature.TAPE_NUMBER)}
                {renderField("Time Count", feature.TIME_COUNT)}
                {renderField("Artist", feature.ARTIST_ID)}
              </div>
              {feature.VIDEO_COMMENTS && (
                <div className="video-comments">
                  <span className="field-label">Video Comments:</span>
                  <p>{feature.VIDEO_COMMENTS}</p>
                </div>
              )}
            </details>
          </div>
        )}
      </article>
    );
  }
);

FeatureCard.displayName = "FeatureCard";

export default FeatureCard;
