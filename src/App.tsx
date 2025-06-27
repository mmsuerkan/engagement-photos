import { useState, useEffect, useRef, useCallback } from 'react'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { collection, addDoc, onSnapshot, orderBy, query, doc, deleteDoc, limit, startAfter, DocumentSnapshot } from 'firebase/firestore'
import { storage, db } from './lib/firebase'
import DeleteIcon from '@mui/icons-material/Delete'
import { coupleNames } from './config/names'
import './App.css'

interface Photo {
  id: string
  fileName: string
  downloadURL: string
  uploadedAt: Date
  storagePath?: string
  fileType?: string
}

const PHOTOS_PER_PAGE = 10

function App() {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null)
  const [initialLoading, setInitialLoading] = useState(true)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadMoreRef = useRef<HTMLDivElement>(null)

  const loadPhotos = useCallback(async (isInitial = false) => {
    if (loading || (!hasMore && !isInitial)) return

    setLoading(true)
    
    try {
      let q
      if (isInitial || !lastDoc) {
        q = query(
          collection(db, 'photos'), 
          orderBy('uploadedAt', 'desc'),
          limit(PHOTOS_PER_PAGE)
        )
      } else {
        q = query(
          collection(db, 'photos'), 
          orderBy('uploadedAt', 'desc'),
          startAfter(lastDoc),
          limit(PHOTOS_PER_PAGE)
        )
      }

      const snapshot = await new Promise<any>((resolve) => {
        const unsubscribe = onSnapshot(q, (snap) => {
          resolve(snap)
          unsubscribe()
        })
      })

      const newPhotos = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data()
      })) as Photo[]

      if (isInitial) {
        setPhotos(newPhotos)
      } else {
        setPhotos(prev => [...prev, ...newPhotos])
      }

      setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null)
      setHasMore(snapshot.docs.length === PHOTOS_PER_PAGE)
      
      console.log(`Loaded ${newPhotos.length} photos, total: ${isInitial ? newPhotos.length : photos.length + newPhotos.length}`)
    } catch (error) {
      console.error('Error loading photos:', error)
    } finally {
      setLoading(false)
      if (isInitial) setInitialLoading(false)
    }
  }, [loading, hasMore, lastDoc, photos.length])

  useEffect(() => {
    loadPhotos(true)
  }, [])

  useEffect(() => {
    document.title = `${coupleNames.bride} & ${coupleNames.groom} - Nişan Anıları`
  }, [])

  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect()

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadPhotos()
        }
      },
      { threshold: 0.1 }
    )

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current)
    }

    return () => {
      if (observerRef.current) observerRef.current.disconnect()
    }
  }, [loadPhotos, hasMore, loading])

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) return

    setUploading(true)
    
    for (const file of Array.from(files)) {
      try {
        const timestamp = Date.now()
        const fileName = `${timestamp}-${file.name}`
        const storageRef = ref(storage, `photos/${fileName}`)
        
        await uploadBytes(storageRef, file)
        const downloadURL = await getDownloadURL(storageRef)
        
        const docRef = await addDoc(collection(db, 'photos'), {
          fileName: file.name,
          downloadURL,
          uploadedAt: new Date(),
          storagePath: `photos/${fileName}`,
          fileType: file.type
        })
        
        // Yeni fotoğrafı state'in başına ekle
        const newPhoto: Photo = {
          id: docRef.id,
          fileName: file.name,
          downloadURL,
          uploadedAt: new Date(),
          storagePath: `photos/${fileName}`,
          fileType: file.type
        }
        setPhotos(prevPhotos => [newPhoto, ...prevPhotos])
      } catch (error) {
        console.error('Upload error:', error)
      }
    }
    
    setUploading(false)
    event.target.value = ''
  }

  const handleDeletePhoto = async (photo: Photo) => {
    if (!confirm('Bu dosyayı silmek istediğinizden emin misiniz?')) return

    setDeleting(photo.id)
    
    try {
      // Sadece Firestore'dan sil (Storage'da dosya kalacak)
      await deleteDoc(doc(db, 'photos', photo.id))
      
      // State'den fotoğrafı kaldır
      setPhotos(prevPhotos => prevPhotos.filter(p => p.id !== photo.id))
    } catch (error) {
      console.error('Delete error:', error)
      alert('Dosya silinirken hata oluştu!')
    }
    
    setDeleting(null)
  }

  const handleVideoClick = (_photoId: string, event: React.MouseEvent<HTMLVideoElement>) => {
    event.stopPropagation()
    const video = event.target as HTMLVideoElement
    
    if (video.paused) {
      video.play().catch(console.error)
    } else {
      video.pause()
    }
  }

  return (
    <div className="app">
      <div className="hero-section">
        <div className="hero-content">
          <div className="couple-names">
            <h1 className="bride-name">{coupleNames.bride}</h1>
            <div className="heart-divider">💕</div>
            <h1 className="groom-name">{coupleNames.groom}</h1>
          </div>
          <p className="event-title">Nişan Anıları</p>
          <p className="event-date">Özel Anlarımızı Paylaşın</p>
        </div>
        <div className="upload-section">
          <input
            type="file"
            multiple
            accept="image/*,video/*"
            onChange={handleFileUpload}
            disabled={uploading}
            id="photo-upload"
            style={{ display: 'none' }}
          />
          <label htmlFor="photo-upload" className="upload-btn">
            <span className="upload-icon">📷</span>
            <span className="upload-text">
              {uploading ? 'Yükleniyor...' : 'Fotoğraf/Video Paylaş'}
            </span>
            {uploading && <div className="upload-progress"></div>}
          </label>
          <p className="upload-hint">
            Birden fazla fotoğraf ve video seçebilirsiniz
          </p>
        </div>
      </div>

      <div className="gallery-section">
        <div className="gallery-header">
          <h2>Anı Galerisi</h2>
          <div className="photo-count">
            {photos.length > 0 && (
              <span>{photos.length} dosya</span>
            )}
          </div>
        </div>
        
        <div className="gallery">
          {initialLoading ? (
            <div className="skeleton-grid">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="skeleton-item">
                  <div className="skeleton-shimmer"></div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {photos.map((photo, index) => (
                <div key={photo.id} className="photo-item" style={{ animationDelay: `${index * 0.05}s` }}>
                  <div className="photo-wrapper">
                    {photo.fileType?.startsWith('video/') ? (
                      <video 
                        src={photo.downloadURL} 
                        preload="metadata"
                        muted
                        playsInline
                        loop
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onClick={(e) => handleVideoClick(photo.id, e)}
                        onError={(e) => {
                          console.error('Video error:', e);
                        }}
                      />
                    ) : (
                      <img 
                        src={photo.downloadURL} 
                        alt={photo.fileName}
                        loading="lazy"
                      />
                    )}
                    <div className="photo-overlay">
                      <button 
                        className="delete-btn"
                        onClick={() => handleDeletePhoto(photo)}
                        disabled={deleting === photo.id}
                        title="Dosyayı sil"
                      >
                        {deleting === photo.id ? (
                          <div className="spinner"></div>
                        ) : (
                          <DeleteIcon sx={{ color: '#e74c3c', fontSize: 24 }} />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              
              {photos.length === 0 && !loading && (
                <div className="empty-state">
                  <div className="empty-icon">📸</div>
                  <h3>Henüz dosya yok</h3>
                  <p>Bu özel günün anılarını paylaşmaya başlayın!</p>
                </div>
              )}
            </>
          )}
          
          {hasMore && !initialLoading && (
            <div ref={loadMoreRef} className="load-more-trigger">
              {loading && (
                <div className="loading-indicator">
                  <div className="spinner"></div>
                  <span>Daha fazla yükleniyor...</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="footer">
        <p>💕 {coupleNames.bride} & {coupleNames.groom}'nın Nişan Anıları 💕</p>
        <p className="footer-note">Sevgiyle paylaşılan her an değerlidir</p>
      </div>
    </div>
  )
}

export default App
