import { useState, useEffect } from 'react'
import './PhotoPlaceholder.css'

interface PhotoPlaceholderProps {
  src: string
  thumbnailSrc?: string
  alt: string
  onLoad?: () => void
  onError?: () => void
  isVideo?: boolean
  onClick?: (e: React.MouseEvent) => void
  onVideoClick?: (e: React.MouseEvent<HTMLVideoElement>) => void
}

export function PhotoPlaceholder({ 
  src, 
  thumbnailSrc, 
  alt, 
  onLoad,
  onError,
  isVideo = false,
  onClick,
  onVideoClick
}: PhotoPlaceholderProps) {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [currentSrc, setCurrentSrc] = useState(thumbnailSrc || src)
  
  useEffect(() => {
    // Önce thumbnail'i yükle, sonra full görüntüyü
    if (thumbnailSrc && !imageLoaded) {
      const img = new Image()
      img.src = thumbnailSrc
      img.onload = () => {
        setCurrentSrc(thumbnailSrc)
        // Thumbnail yüklendikten sonra full görüntüyü preload et
        const fullImg = new Image()
        fullImg.src = src
        fullImg.onload = () => {
          setCurrentSrc(src)
          setImageLoaded(true)
          onLoad?.()
        }
      }
    }
  }, [src, thumbnailSrc, imageLoaded, onLoad])
  
  const handleImageLoad = () => {
    setImageLoaded(true)
    onLoad?.()
  }
  
  const handleImageError = () => {
    setImageError(true)
    onError?.()
  }
  
  if (isVideo) {
    return (
      <div className="photo-placeholder video-placeholder">
        <video 
          src={currentSrc}
          preload="metadata"
          muted
          playsInline
          loop
          className={`placeholder-media ${imageLoaded ? 'loaded' : ''}`}
          onLoadedData={handleImageLoad}
          onError={handleImageError}
          onClick={onVideoClick}
          style={{ cursor: 'pointer' }}
        />
        {!imageLoaded && !imageError && (
          <div className="placeholder-skeleton">
            <div className="skeleton-shimmer"></div>
            <span className="loading-text">Video yükleniyor...</span>
          </div>
        )}
        {imageError && (
          <div className="placeholder-error">
            <span className="error-icon">🎬</span>
            <span className="error-text">Video yüklenemedi</span>
          </div>
        )}
      </div>
    )
  }
  
  return (
    <div className="photo-placeholder" onClick={onClick}>
      <img 
        src={currentSrc}
        alt={alt}
        className={`placeholder-image ${imageLoaded ? 'loaded' : ''}`}
        onLoad={handleImageLoad}
        onError={handleImageError}
        loading="lazy"
        style={{ cursor: 'pointer' }}
      />
      {!imageLoaded && !imageError && (
        <div className="placeholder-skeleton">
          <div className="skeleton-shimmer"></div>
          <span className="loading-text">Fotoğraf yükleniyor...</span>
        </div>
      )}
      {imageError && (
        <div className="placeholder-error">
          <span className="error-icon">🖼️</span>
          <span className="error-text">Görüntü yüklenemedi</span>
        </div>
      )}
    </div>
  )
}