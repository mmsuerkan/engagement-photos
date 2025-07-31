import { useState, useEffect, useRef, useCallback } from 'react'
import { ref, uploadBytes, getDownloadURL, uploadBytesResumable } from 'firebase/storage'
import { collection, addDoc, onSnapshot, orderBy, query, doc, deleteDoc, limit, startAfter, DocumentSnapshot, serverTimestamp } from 'firebase/firestore'
import { storage, db } from './lib/firebase'
import DeleteIcon from '@mui/icons-material/Delete'
import DownloadIcon from '@mui/icons-material/Download'
import { coupleNames } from './config/names'
import { compressImage, generateThumbnail } from './utils/imageCompression'
import { Lightbox } from './components/Lightbox'
import { ConfirmDialog } from './components/ConfirmDialog'
import { UploadProgress } from './components/UploadProgress'
import { NetworkStatus } from './components/NetworkStatus'
import { PhotoPlaceholder } from './components/PhotoPlaceholder'
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

interface UploadItem {
  id: string
  fileName: string
  progress: number
  status: 'pending' | 'uploading' | 'success' | 'error'
  error?: string
  file?: File
  retryCount?: number
}

const PHOTOS_PER_PAGE = 20 // Daha hızlı ilk yükleme için azaltıldı

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
  const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([])
  const galleryRef = useRef<HTMLDivElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const uploadTasksRef = useRef<Map<string, any>>(new Map())

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
      { 
        threshold: 0.1,
        rootMargin: '50% 0px' // Viewport'un %50 altından yüklemeye başla
      }
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

    const newUploads: UploadItem[] = Array.from(files).map((file, index) => ({
      id: `${Date.now()}-${index}`,
      fileName: file.name,
      progress: 0,
      status: 'pending' as const,
      file
    }))

    setUploadQueue(prev => [...prev, ...newUploads])
    setUploading(true)
    
    // Dosyaları sırayla yükle
    for (const uploadItem of newUploads) {
      await uploadFile(uploadItem)
    }
    
    setUploading(false)
    event.target.value = ''
  }

  const uploadFile = async (uploadItem: UploadItem, isRetry = false) => {
    if (!uploadItem.file) return

    // Yükleme başladı
    setUploadQueue(prev => 
      prev.map(item => 
        item.id === uploadItem.id 
          ? { ...item, status: 'uploading', progress: 0 }
          : item
      )
    )

    try {
      const timestamp = Date.now()
      let fileToUpload = uploadItem.file
      let thumbnailFile: File | null = null
      
      // Görsel ise sıkıştır
      if (uploadItem.file.type.startsWith('image/')) {
        fileToUpload = await compressImage(uploadItem.file)
        thumbnailFile = await generateThumbnail(uploadItem.file)
      }
      
      const fileName = `${timestamp}-${uploadItem.file.name}`
      const storageRef = ref(storage, `photos/${fileName}`)
      
      // Ana dosyayı yükle (progress takibi ile)
      const uploadTask = uploadBytesResumable(storageRef, fileToUpload)
      
      // Task'ı sakla (iptal edebilmek için)
      uploadTasksRef.current.set(uploadItem.id, uploadTask)
      
      await new Promise<void>((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100
            setUploadQueue(prev => 
              prev.map(item => 
                item.id === uploadItem.id 
                  ? { ...item, progress: Math.round(progress) }
                  : item
              )
            )
          },
          (error) => {
            reject(error)
          },
          () => {
            resolve()
          }
        )
      })
      
      const downloadURL = await getDownloadURL(storageRef)
      
      // Thumbnail varsa yükle
      let thumbnailURL: string | undefined
      let thumbnailStoragePath: string | undefined
      if (thumbnailFile) {
        const thumbnailName = `${timestamp}-thumb-${uploadItem.file.name}`
        const thumbnailRef = ref(storage, `thumbnails/${thumbnailName}`)
        await uploadBytes(thumbnailRef, thumbnailFile)
        thumbnailURL = await getDownloadURL(thumbnailRef)
        thumbnailStoragePath = `thumbnails/${thumbnailName}`
      }
      
      const docRef = await addDoc(collection(db, 'photos'), {
        fileName: uploadItem.file.name,
        downloadURL,
        thumbnailURL,
        uploadedAt: serverTimestamp(),
        storagePath: `photos/${fileName}`,
        thumbnailStoragePath,
        fileType: uploadItem.file.type
      })
      
      // Yeni fotoğrafı state'in başına ekle
      const newPhoto: Photo = {
        id: docRef.id,
        fileName: uploadItem.file.name,
        downloadURL,
        thumbnailURL,
        uploadedAt: new Date(),
        storagePath: `photos/${fileName}`,
        thumbnailStoragePath,
        fileType: uploadItem.file.type
      }
      setPhotos(prevPhotos => [newPhoto, ...prevPhotos])
      
      // Başarılı olarak işaretle
      setUploadQueue(prev => 
        prev.map(item => 
          item.id === uploadItem.id 
            ? { ...item, status: 'success', progress: 100 }
            : item
        )
      )
      
      // Task'ı temizle
      uploadTasksRef.current.delete(uploadItem.id)
      
    } catch (error: any) {
      console.error('Upload error:', error)
      
      // Hata durumunda
      const errorMessage = error.code === 'storage/unauthorized' 
        ? 'Yetki hatası'
        : error.code === 'storage/canceled'
        ? 'İptal edildi'
        : error.code === 'storage/retry-limit-exceeded'
        ? 'Çok fazla deneme'
        : 'Yükleme başarısız'
      
      setUploadQueue(prev => 
        prev.map(item => 
          item.id === uploadItem.id 
            ? { 
                ...item, 
                status: 'error', 
                error: errorMessage,
                retryCount: (item.retryCount || 0) + (isRetry ? 1 : 0)
              }
            : item
        )
      )
      
      // Task'ı temizle
      uploadTasksRef.current.delete(uploadItem.id)
      
      // Otomatik yeniden deneme (max 3 kez)
      if (!isRetry && (!uploadItem.retryCount || uploadItem.retryCount < 3)) {
        setTimeout(() => {
          handleRetryUpload(uploadItem.id)
        }, 2000)
      }
    }
  }

  const handleRetryUpload = (uploadId: string) => {
    const uploadItem = uploadQueue.find(item => item.id === uploadId)
    if (uploadItem && uploadItem.file) {
      uploadFile(uploadItem, true)
    }
  }

  const handleCloseUploadProgress = () => {
    setUploadQueue([])
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
                    <PhotoPlaceholder
                      src={photo.downloadURL}
                      thumbnailSrc={photo.thumbnailURL}
                      alt={photo.fileName}
                      isVideo={photo.fileType?.startsWith('video/')}
                      onClick={photo.fileType?.startsWith('video/') ? undefined : () => handlePhotoClick(photo)}
                      onVideoClick={photo.fileType?.startsWith('video/') ? (e) => {
                        e.stopPropagation()
                        handleVideoClick(photo.id, e)
                      } : undefined}
                    />
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

      <NetworkStatus />

      <UploadProgress
        uploads={uploadQueue}
        onRetry={handleRetryUpload}
        onClose={handleCloseUploadProgress}
      />
    </div>
  )
}

export default App
