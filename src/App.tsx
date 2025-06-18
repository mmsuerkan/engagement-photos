import { useState, useEffect } from 'react'
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { collection, addDoc, onSnapshot, orderBy, query, doc, deleteDoc } from 'firebase/firestore'
import { storage, db } from './lib/firebase'
import './App.css'

interface Photo {
  id: string
  fileName: string
  downloadURL: string
  uploadedAt: any
  storagePath?: string
}

function App() {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    const q = query(collection(db, 'photos'), orderBy('uploadedAt', 'desc'))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const photosData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Photo[]
      setPhotos(photosData)
    })

    return () => unsubscribe()
  }, [])

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
        
        await addDoc(collection(db, 'photos'), {
          fileName: file.name,
          downloadURL,
          uploadedAt: new Date(),
          storagePath: `photos/${fileName}`
        })
      } catch (error) {
        console.error('Upload error:', error)
      }
    }
    
    setUploading(false)
    event.target.value = ''
  }

  const handleDeletePhoto = async (photo: Photo) => {
    if (!confirm('Bu fotoğrafı silmek istediğinizden emin misiniz?')) return

    setDeleting(photo.id)
    
    try {
      // Firestore'dan sil
      await deleteDoc(doc(db, 'photos', photo.id))
      
      // Storage'dan sil
      if (photo.storagePath) {
        const storageRef = ref(storage, photo.storagePath)
        await deleteObject(storageRef)
      }
    } catch (error) {
      console.error('Delete error:', error)
      alert('Fotoğraf silinirken hata oluştu!')
    }
    
    setDeleting(null)
  }

  return (
    <div className="app">
      <div className="hero-section">
        <div className="hero-content">
          <div className="couple-names">
            <h1 className="bride-name">Ecem</h1>
            <div className="heart-divider">💕</div>
            <h1 className="groom-name">Mert</h1>
          </div>
          <p className="event-title">Nişan Anıları</p>
          <p className="event-date">Özel Anlarımızı Paylaşın</p>
        </div>
        <div className="upload-section">
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileUpload}
            disabled={uploading}
            id="photo-upload"
            style={{ display: 'none' }}
          />
          <label htmlFor="photo-upload" className="upload-btn">
            <span className="upload-icon">📷</span>
            <span className="upload-text">
              {uploading ? 'Yükleniyor...' : 'Fotoğraf Paylaş'}
            </span>
            {uploading && <div className="upload-progress"></div>}
          </label>
          <p className="upload-hint">
            Birden fazla fotoğraf seçebilirsiniz
          </p>
        </div>
      </div>

      <div className="gallery-section">
        <div className="gallery-header">
          <h2>Anı Galerisi</h2>
          <div className="photo-count">
            {photos.length > 0 && (
              <span>{photos.length} fotoğraf</span>
            )}
          </div>
        </div>
        
        <div className="gallery">
          {photos.map((photo, index) => (
            <div key={photo.id} className="photo-item" style={{ animationDelay: `${index * 0.1}s` }}>
              <div className="photo-wrapper">
                <img src={photo.downloadURL} alt={photo.fileName} />
                <div className="photo-overlay">
                  <button 
                    className="delete-btn"
                    onClick={() => handleDeletePhoto(photo)}
                    disabled={deleting === photo.id}
                    title="Fotoğrafı sil"
                  >
                    {deleting === photo.id ? (
                      <div className="spinner"></div>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                        <line x1="10" y1="11" x2="10" y2="17"/>
                        <line x1="14" y1="11" x2="14" y2="17"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
          
          {photos.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">📸</div>
              <h3>Henüz fotoğraf yok</h3>
              <p>Bu özel günün anılarını paylaşmaya başlayın!</p>
            </div>
          )}
        </div>
      </div>

      <div className="footer">
        <p>💕 Ecem & Mert'in Nişan Anıları 💕</p>
        <p className="footer-note">Sevgiyle paylaşılan her an değerlidir</p>
      </div>
    </div>
  )
}

export default App
