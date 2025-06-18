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
      <div className="header">
        <h1>📸 Nişan Fotoğrafları</h1>
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
            {uploading ? '⏳ Yükleniyor...' : '📤 Fotoğraf Yükle'}
          </label>
        </div>
      </div>

      <div className="gallery">
        {photos.map((photo) => (
          <div key={photo.id} className="photo-item">
            <img src={photo.downloadURL} alt={photo.fileName} />
            <button 
              className="delete-btn"
              onClick={() => handleDeletePhoto(photo)}
              disabled={deleting === photo.id}
            >
              {deleting === photo.id ? '⏳' : '🗑️'}
            </button>
          </div>
        ))}
        {photos.length === 0 && (
          <p className="no-photos">Henüz fotoğraf yüklenmemiş 📱</p>
        )}
      </div>
    </div>
  )
}

export default App
