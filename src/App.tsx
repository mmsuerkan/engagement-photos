import { useState, useEffect } from 'react'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { collection, addDoc, onSnapshot, orderBy, query } from 'firebase/firestore'
import { storage, db } from './lib/firebase'
import './App.css'

interface Photo {
  id: string
  fileName: string
  downloadURL: string
  uploadedAt: any
}

function App() {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [uploading, setUploading] = useState(false)

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
          uploadedAt: new Date()
        })
      } catch (error) {
        console.error('Upload error:', error)
      }
    }
    
    setUploading(false)
    event.target.value = ''
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
