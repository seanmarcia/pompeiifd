import { memo, useState } from "react";
import "./FeatureCard.css";
import ImageModal from "./ImageModal";

const FeatureCard = memo(({ feature, onNavigateToSheet }) => {
  const photoLink = import.meta.env.VITE_PHOTO_LINK || "";
  const [modalImage, setModalImage] = useState(null);

  const handleNextImage = () => {
    if (modalImage && feature.photos && modalImage.index < feature.photos.length - 1) {
      const nextIndex = modalImage.index + 1
      const photo = feature.photos[nextIndex]
      setModalImage({
        src: `${photoLink}${photo}`,
        alt: `Photo ${nextIndex + 1} of sheet ${feature.SHEET} - ${photo}`,
        index: nextIndex
      })
    }
  }

  const handlePrevImage = () => {
    if (modalImage && modalImage.index > 0) {
      const prevIndex = modalImage.index - 1
      const photo = feature.photos[prevIndex]
      setModalImage({
        src: `${photoLink}${photo}`,
        alt: `Photo ${prevIndex + 1} of sheet ${feature.SHEET} - ${photo}`,
        index: prevIndex
      })
    }
  }

  // Helper function to format date
  const formatDate = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Helper to render field if it exists
  const renderField = (label, value) => {
    if (value === null || value === undefined || value === "") return null;
    return (
      <div className="field">
        <span className="field-label">{label}:</span>
        <span className="field-value">{value}</span>
      </div>
    );
  };

  // Helper to render contiguous relationship with clickable sheet numbers
  const renderContiguousRelationship = (text) => {
    if (!text) return null;

    // Match patterns like (6083), (6084) or "oven 6083", "mill 6085", etc.
    // This regex matches 4+ digit numbers that are either in parentheses or follow a space
    const parts = [];
    let lastIndex = 0;
    const regex = /(\((\d{4,})\)|(?:^|\s)(\d{4,})(?=\s|,|\.|$))/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }

      // Extract the sheet number (either from group 2 for parentheses or group 3 for standalone)
      const sheetNumber = match[2] || match[3];
      const fullMatch = match[0];

      // Check if there's a leading space that should be preserved
      const leadingSpace =
        fullMatch.startsWith(" ") && !fullMatch.startsWith("(") ? " " : "";

      if (leadingSpace) {
        parts.push(leadingSpace);
      }

      // Add the clickable sheet number
      parts.push(
        <a
          key={`sheet-${match.index}`}
          href={`#sheet-${sheetNumber}`}
          className="sheet-link"
          onClick={(e) => {
            e.preventDefault();
            if (onNavigateToSheet) {
              onNavigateToSheet(sheetNumber);
            }
          }}
        >
          {fullMatch.includes("(") ? `(${sheetNumber})` : sheetNumber}
        </a>
      );

      lastIndex = regex.lastIndex;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  return (
    <article className="feature-card" id={`sheet-${feature.SHEET}`}>
      {/* Location and Header Section */}
      <div className="card-header">
        <div className="location-info">
          <h2 className="sheet-number">Sheet {feature.SHEET}</h2>
          <div className="location-details">
            {feature.REGION && (
              <span className="location-tag">Region {feature.REGION}</span>
            )}
            {feature.INSULA && (
              <span className="location-tag">Insula {feature.INSULA}</span>
            )}
            {feature.ENTRANCE && (
              <span className="location-tag">Entrance {feature.ENTRANCE}</span>
            )}
          </div>
        </div>
        <div className="meta-info">
          {renderField("Recorder", feature.RECORDER_ID)}
          {renderField("Researcher", feature.RESEARCHER_ID)}
          {feature.SHEET_DATE &&
            renderField("Date", formatDate(feature.SHEET_DATE))}
          {renderField("Season", feature.SEASON)}
        </div>
      </div>

      {/* Space and Feature Information */}
      <div className="details-section">
        <h3>Details</h3>
        <div className="details-grid">
          {renderField("Structure", feature.STRUCTURE_ID)}
          {renderField("Sheet Type", feature.SHEET_TYPE_ID)}
          {renderField("Space", feature.SPACE_NUMBER)}
          {renderField("Feature Type", feature.FEATURE_TYPE_ID)}
          {renderField("Category", feature.CATEGORY_ID)}
          {renderField("Space Type", feature.SPACE_TYPE_ID)}
          {renderField("Gate", feature.GATE_ID)}
          {renderField("Usage", feature.USAGE_ID)}
          {renderField("Negative Feature", feature.NEGATIVE_FEATURE)}
          {renderField("Minority Report", feature.MINORITY_REPORT)}
        </div>
      </div>

      {/* Description */}
      {feature.DESCRIPTION && (
        <div className="description-section">
          <h3>Description</h3>
          <p className="description-text">{feature.DESCRIPTION}</p>
        </div>
      )}

      {/* Contiguous Relationship */}
      {feature.CONTIGUOUS_RELATIONSHIP && (
        <div className="relationship-section">
          <h3>Contiguous Relationship</h3>
          <p className="relationship-text">
            {renderContiguousRelationship(feature.CONTIGUOUS_RELATIONSHIP)}
          </p>
        </div>
      )}

      {/* Photos */}
      {feature.photos && feature.photos.length > 0 && (
        <div className="photos-section">
          <h3>Photos</h3>
          <div className="photos-grid">
            {feature.photos.map((photo, index) => (
              <div key={index} className="photo-item">
                <img
                  src={`${photoLink}${photo}`}
                  alt={`Photo ${index + 1} of sheet ${feature.SHEET}`}
                  onClick={() => setModalImage({
                    src: `${photoLink}${photo}`,
                    alt: `Photo ${index + 1} of sheet ${feature.SHEET} - ${photo}`,
                    index: index
                  })}
                  onError={(e) => {
                    e.target.style.display = "none";
                    e.target.nextSibling.style.display = "flex";
                  }}
                />
                <div className="photo-placeholder" style={{ display: "none" }}>
                  <span>📷</span>
                  <span className="photo-name">{photo}</span>
                </div>
              </div>
            ))}
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
        hasNext={modalImage && feature.photos && modalImage.index < feature.photos.length - 1}
        hasPrev={modalImage && modalImage.index > 0}
        currentIndex={modalImage?.index || 0}
        totalImages={feature.photos?.length || 0}
      />

      {/* Archive Information */}
      <div className="archive-section">
        <h3>Archive Information</h3>
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
      </div>
    </article>
  );
});

FeatureCard.displayName = "FeatureCard";

export default FeatureCard;
