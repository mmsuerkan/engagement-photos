import { useState, useEffect, useRef, useCallback } from 'react'
import { ref, uploadBytes, getDownloadURL, listAll } from 'firebase/storage'
import { collection, addDoc, onSnapshot, orderBy, query, doc, deleteDoc, limit, startAfter, DocumentSnapshot, serverTimestamp, getDocs } from 'firebase/firestore'
import { storage, db } from './lib/firebase'
import DeleteIcon from '@mui/icons-material/Delete'
import DownloadIcon from '@mui/icons-material/Download'
import { coupleNames } from './config/names'
import { compressImage, generateThumbnail } from './utils/imageCompression'
import { Lightbox } from './components/Lightbox'
import { ConfirmDialog } from './components/ConfirmDialog'
import JSZip from 'jszip'
import './App.css'

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

const PHOTOS_PER_PAGE = 30

function App() {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null)
  const [initialLoading, setInitialLoading] = useState(true)
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; photo: Photo | null }>({
    isOpen: false,
    photo: null
  })
  const [downloading, setDownloading] = useState(false)
  const galleryRef = useRef<HTMLDivElement>(null)
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
        let fileToUpload = file
        let thumbnailFile: File | null = null
        
        // Görsel ise sıkıştır
        if (file.type.startsWith('image/')) {
          fileToUpload = await compressImage(file)
          thumbnailFile = await generateThumbnail(file)
        }
        
        const fileName = `${timestamp}-${file.name}`
        const storageRef = ref(storage, `photos/${fileName}`)
        
        // Ana dosyayı yükle
        await uploadBytes(storageRef, fileToUpload)
        const downloadURL = await getDownloadURL(storageRef)
        
        // Thumbnail varsa yükle
        let thumbnailURL: string | undefined
        let thumbnailStoragePath: string | undefined
        if (thumbnailFile) {
          const thumbnailName = `${timestamp}-thumb-${file.name}`
          const thumbnailRef = ref(storage, `thumbnails/${thumbnailName}`)
          await uploadBytes(thumbnailRef, thumbnailFile)
          thumbnailURL = await getDownloadURL(thumbnailRef)
          thumbnailStoragePath = `thumbnails/${thumbnailName}`
        }
        
        const docRef = await addDoc(collection(db, 'photos'), {
          fileName: file.name,
          downloadURL,
          thumbnailURL,
          uploadedAt: serverTimestamp(),
          storagePath: `photos/${fileName}`,
          thumbnailStoragePath,
          fileType: file.type
        })
        
        // Yeni fotoğrafı state'in başına ekle
        const newPhoto: Photo = {
          id: docRef.id,
          fileName: file.name,
          downloadURL,
          thumbnailURL,
          uploadedAt: new Date(),
          storagePath: `photos/${fileName}`,
          thumbnailStoragePath,
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

  const handleDeletePhoto = (photo: Photo) => {
    setConfirmDialog({ isOpen: true, photo })
  }

  const handleDownloadPhoto = (photo: Photo) => {
    const link = document.createElement('a')
    link.href = photo.downloadURL
    link.download = photo.fileName
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const confirmDelete = async () => {
    const photo = confirmDialog.photo
    if (!photo) return

    setConfirmDialog({ isOpen: false, photo: null })
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

  const downloadAllPhotos = async () => {
    setDownloading(true)
    
    try {
      // Tüm fotoğrafları Firestore'dan al
      const allPhotosQuery = query(
        collection(db, 'photos'), 
        orderBy('uploadedAt', 'desc')
      )
      const snapshot = await getDocs(allPhotosQuery)
      const allPhotos = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data()
      })) as Photo[]

      if (allPhotos.length === 0) {
        alert('İndirilecek fotoğraf bulunamadı!')
        return
      }

      const zip = new JSZip()
      let downloadedCount = 0

      for (const photo of allPhotos) {
        try {
          // CORS sorununu aşmak için mode: 'no-cors' kullan
          const response = await fetch(photo.downloadURL, {
            method: 'GET',
            mode: 'cors',
            headers: {
              'Accept': '*/*',
            }
          })
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
          }
          
          const blob = await response.blob()
          
          // Dosya uzantısını al
          const fileExtension = photo.fileName.split('.').pop() || 'jpg'
          const fileName = `${photo.fileName.replace(/\.[^/.]+$/, '')}.${fileExtension}`
          
          zip.file(fileName, blob)
          downloadedCount++
          console.log(`İndirildi: ${fileName}`)
        } catch (error) {
          console.error(`Fotoğraf indirilemedi: ${photo.fileName}`, error)
          
          // Alternatif olarak direkt link açma deneyelim
          try {
            const link = document.createElement('a')
            link.href = photo.downloadURL
            link.download = photo.fileName
            link.target = '_blank'
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
          } catch (linkError) {
            console.error('Link ile de indirilemedi:', linkError)
          }
        }
      }

      if (downloadedCount === 0) {
        alert('CORS sorunu nedeniyle ZIP oluşturulamadı. Her fotoğraf ayrı ayrı indirilmeye çalışılıyor...')
        
        // Her fotoğrafı ayrı ayrı indir
        allPhotos.forEach(photo => {
          const link = document.createElement('a')
          link.href = photo.downloadURL
          link.download = photo.fileName
          link.target = '_blank'
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
        })
        return
      }

      // ZIP dosyasını oluştur ve indir
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(zipBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${coupleNames.bride}-${coupleNames.groom}-nisan-fotolari.zip`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      alert(`${downloadedCount} fotoğraf başarıyla ZIP olarak indirildi!`)
    } catch (error) {
      console.error('İndirme hatası:', error)
      alert('Fotoğraflar indirilirken hata oluştu!')
    } finally {
      setDownloading(false)
    }
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

  const handlePhotoClick = (photo: Photo) => {
    setSelectedPhoto(photo)
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
        
        <div className="gallery" ref={galleryRef}>
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
                  <div className="photo-wrapper" onClick={() => handlePhotoClick(photo)}>
                    {photo.fileType?.startsWith('video/') ? (
                      <video 
                        src={photo.thumbnailURL || photo.downloadURL} 
                        preload="metadata"
                        muted
                        playsInline
                        loop
                        style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleVideoClick(photo.id, e)
                        }}
                        onError={(e) => {
                          console.error('Video error:', e);
                        }}
                      />
                    ) : (
                      <img 
                        src={photo.thumbnailURL || photo.downloadURL} 
                        alt={photo.fileName}
                        loading="lazy"
                        style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
                      />
                    )}
                    <div className="photo-overlay">
                      <div className="photo-actions">
                        <button 
                          className="download-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDownloadPhoto(photo)
                          }}
                          title="Fotoğrafı indir"
                        >
                          <DownloadIcon sx={{ color: '#27ae60', fontSize: 24 }} />
                        </button>
                        <button 
                          className="delete-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeletePhoto(photo)
                          }}
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

      <Lightbox
        photo={selectedPhoto}
        photos={photos}
        isOpen={!!selectedPhoto}
        onClose={() => setSelectedPhoto(null)}
        onNavigate={setSelectedPhoto}
      />

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title="Fotoğrafı Sil"
        message="Bu fotoğrafı kalıcı olarak silmek istediğinizden emin misiniz?"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDialog({ isOpen: false, photo: null })}
      />
    </div>
  )
}

export default App
