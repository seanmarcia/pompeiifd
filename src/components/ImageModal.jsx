import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import './ImageModal.css'

const ImageModal = ({ isOpen, imageSrc, imageAlt, onClose, onNext, onPrev, hasNext, hasPrev, currentIndex, totalImages }) => {
  useEffect(() => {
    const handleKeyboard = (e) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowRight' && hasNext) {
        onNext()
      } else if (e.key === 'ArrowLeft' && hasPrev) {
        onPrev()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyboard)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleKeyboard)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose, onNext, onPrev, hasNext, hasPrev])

  if (!isOpen) return null

  const modalContent = (
    <div className="image-modal-overlay" onClick={onClose}>
      <div className="image-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="image-modal-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        
        {hasPrev && (
          <button 
            className="image-modal-nav image-modal-prev" 
            onClick={onPrev}
            aria-label="Previous image"
          >
            ‹
          </button>
        )}
        
        <img 
          src={imageSrc} 
          alt={imageAlt}
          className="image-modal-img"
        />
        
        {hasNext && (
          <button 
            className="image-modal-nav image-modal-next" 
            onClick={onNext}
            aria-label="Next image"
          >
            ›
          </button>
        )}
        
        <div className="image-modal-caption">
          {imageAlt}
          {totalImages > 1 && (
            <span className="image-modal-counter">
              {currentIndex + 1} / {totalImages}
            </span>
          )}
        </div>
      </div>
      <div className="image-modal-hint">
        {totalImages > 1 ? 'Use arrow keys or click arrows to navigate • ' : ''}
        Press ESC or click outside to close
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}

export default ImageModal
