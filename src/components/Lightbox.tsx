import { useEffect, useState } from 'react'
import CloseIcon from '@mui/icons-material/Close'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import './Lightbox.css'

interface Photo {
  id: string
  fileName: string
  downloadURL: string
  thumbnailURL?: string
  uploadedAt: Date | { seconds: number; nanoseconds: number } | any
  storagePath?: string
  thumbnailStoragePath?: string
  fileType?: string
}

interface LightboxProps {
  photo: Photo | null
  photos: Photo[]
  isOpen: boolean
  onClose: () => void
  onNavigate: (photo: Photo) => void
}

export function Lightbox({ photo, photos, isOpen, onClose, onNavigate }: LightboxProps) {
  const [imageLoaded, setImageLoaded] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen || !photo) return

      const currentIndex = photos.findIndex(p => p.id === photo.id)
      
      switch (e.key) {
        case 'Escape':
          onClose()
          break
        case 'ArrowLeft':
          if (currentIndex > 0) {
            onNavigate(photos[currentIndex - 1])
          }
          break
        case 'ArrowRight':
          if (currentIndex < photos.length - 1) {
            onNavigate(photos[currentIndex + 1])
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, photo, photos, onClose, onNavigate])

  useEffect(() => {
    setImageLoaded(false)
  }, [photo])

  if (!isOpen || !photo) return null

  const currentIndex = photos.findIndex(p => p.id === photo.id)
  const hasPrevious = currentIndex > 0
  const hasNext = currentIndex < photos.length - 1

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div className="lightbox-overlay" onClick={handleBackdropClick}>
      <button className="lightbox-close" onClick={onClose}>
        <CloseIcon />
      </button>

      {hasPrevious && (
        <button
          className="lightbox-nav lightbox-prev"
          onClick={() => onNavigate(photos[currentIndex - 1])}
        >
          <ChevronLeftIcon />
        </button>
      )}

      {hasNext && (
        <button
          className="lightbox-nav lightbox-next"
          onClick={() => onNavigate(photos[currentIndex + 1])}
        >
          <ChevronRightIcon />
        </button>
      )}

      <div className="lightbox-content">
        {photo.fileType?.startsWith('video/') ? (
          <video
            src={photo.downloadURL}
            controls
            autoPlay
            className="lightbox-media"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <>
            {!imageLoaded && (
              <div className="lightbox-loading">
                <div className="spinner"></div>
              </div>
            )}
            <TransformWrapper
              initialScale={1}
              minScale={0.5}
              maxScale={4}
              centerOnInit={true}
              doubleClick={{
                disabled: false,
                step: 2
              }}
              panning={{
                disabled: false,
                velocityDisabled: false
              }}
              pinch={{
                disabled: false
              }}
              wheel={{
                disabled: false,
                step: 0.2
              }}
            >
              <TransformComponent>
                <img
                  src={photo.downloadURL}
                  alt={photo.fileName}
                  className={`lightbox-media ${imageLoaded ? 'loaded' : ''}`}
                  onLoad={() => setImageLoaded(true)}
                  onClick={(e) => e.stopPropagation()}
                  style={{ 
                    maxWidth: '90vw', 
                    maxHeight: '80vh',
                    objectFit: 'contain'
                  }}
                />
              </TransformComponent>
            </TransformWrapper>
          </>
        )}
        
        <div className="lightbox-info">
          <p className="lightbox-date">
            {(() => {
              let date;
              if (photo.uploadedAt instanceof Date) {
                date = photo.uploadedAt;
              } else if (photo.uploadedAt && typeof photo.uploadedAt === 'object' && 'seconds' in photo.uploadedAt) {
                // Firestore timestamp
                date = new Date(photo.uploadedAt.seconds * 1000);
              } else if (photo.uploadedAt) {
                date = new Date(photo.uploadedAt);
              } else {
                return '';
              }
              
              return isNaN(date.getTime()) ? '' : date.toLocaleDateString('tr-TR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              });
            })()}
          </p>
        </div>
      </div>
    </div>
  )
}