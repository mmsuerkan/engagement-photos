import { useState, useEffect } from 'react'
import './UploadProgress.css'

interface UploadItem {
  id: string
  fileName: string
  progress: number
  status: 'pending' | 'uploading' | 'success' | 'error'
  error?: string
}

interface UploadProgressProps {
  uploads: UploadItem[]
  onRetry: (id: string) => void
  onClose: () => void
}

export function UploadProgress({ uploads, onRetry, onClose }: UploadProgressProps) {
  const [isMinimized, setIsMinimized] = useState(false)
  
  const activeUploads = uploads.filter(u => u.status === 'uploading' || u.status === 'pending')
  const failedUploads = uploads.filter(u => u.status === 'error')
  
  const totalProgress = uploads.length > 0
    ? uploads.reduce((sum, u) => sum + u.progress, 0) / uploads.length
    : 0

  useEffect(() => {
    // Tüm yüklemeler tamamlandıysa 3 saniye sonra kapat
    if (uploads.length > 0 && activeUploads.length === 0 && failedUploads.length === 0) {
      const timer = setTimeout(() => {
        onClose()
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [uploads.length, activeUploads.length, failedUploads.length, onClose])

  if (uploads.length === 0) return null

  return (
    <div className={`upload-progress-container ${isMinimized ? 'minimized' : ''}`}>
      <div className="upload-progress-header" onClick={() => setIsMinimized(!isMinimized)}>
        <div className="upload-progress-title">
          <span className="upload-icon">📤</span>
          <span>
            {activeUploads.length > 0
              ? `${activeUploads.length} dosya yükleniyor...`
              : failedUploads.length > 0
              ? `${failedUploads.length} dosya başarısız`
              : 'Yükleme tamamlandı!'
            }
          </span>
        </div>
        <div className="upload-progress-actions">
          <button className="minimize-btn" onClick={(e) => {
            e.stopPropagation()
            setIsMinimized(!isMinimized)
          }}>
            {isMinimized ? '🔼' : '🔽'}
          </button>
          {activeUploads.length === 0 && (
            <button className="close-btn" onClick={(e) => {
              e.stopPropagation()
              onClose()
            }}>
              ✕
            </button>
          )}
        </div>
      </div>

      {!isMinimized && (
        <div className="upload-progress-body">
          <div className="overall-progress">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${totalProgress}%` }}
              />
            </div>
            <span className="progress-text">{Math.round(totalProgress)}%</span>
          </div>

          <div className="upload-list">
            {uploads.map(upload => (
              <div key={upload.id} className={`upload-item ${upload.status}`}>
                <div className="upload-item-info">
                  <span className="file-name">{upload.fileName}</span>
                  {upload.status === 'uploading' && (
                    <span className="upload-speed">%{upload.progress}</span>
                  )}
                  {upload.status === 'error' && (
                    <span className="error-message">{upload.error || 'Yükleme başarısız'}</span>
                  )}
                </div>
                <div className="upload-item-progress">
                  {upload.status === 'uploading' && (
                    <div className="item-progress-bar">
                      <div
                        className="item-progress-fill"
                        style={{ width: `${upload.progress}%` }}
                      />
                    </div>
                  )}
                  {upload.status === 'success' && <span className="success-icon">✅</span>}
                  {upload.status === 'error' && (
                    <button
                      className="retry-btn"
                      onClick={() => onRetry(upload.id)}
                      title="Tekrar dene"
                    >
                      🔄
                    </button>
                  )}
                  {upload.status === 'pending' && <span className="pending-icon">⏳</span>}
                </div>
              </div>
            ))}
          </div>

          {failedUploads.length > 0 && activeUploads.length === 0 && (
            <div className="upload-actions">
              <button
                className="retry-all-btn"
                onClick={() => failedUploads.forEach(u => onRetry(u.id))}
              >
                Tümünü Tekrar Dene
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}