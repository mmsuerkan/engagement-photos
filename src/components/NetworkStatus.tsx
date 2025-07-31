import { useState, useEffect } from 'react'
import './NetworkStatus.css'

export function NetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [connectionSpeed, setConnectionSpeed] = useState<'fast' | 'slow' | 'offline'>('fast')
  const [showNotification, setShowNotification] = useState(false)
  
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      setShowNotification(true)
      setTimeout(() => setShowNotification(false), 3000)
    }
    
    const handleOffline = () => {
      setIsOnline(false)
      setConnectionSpeed('offline')
      setShowNotification(true)
    }
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    // Bağlantı hızını kontrol et
    const checkConnectionSpeed = async () => {
      if (!navigator.onLine) {
        setConnectionSpeed('offline')
        return
      }
      
      try {
        const startTime = Date.now()
        // Küçük bir test görüntüsü indir
        await fetch('https://www.google.com/favicon.ico', { cache: 'no-cache' })
        const endTime = Date.now()
        const duration = endTime - startTime
        
        // 500ms'den fazla sürüyorsa yavaş bağlantı
        setConnectionSpeed(duration > 500 ? 'slow' : 'fast')
      } catch {
        setConnectionSpeed('slow')
      }
    }
    
    // İlk kontrol
    checkConnectionSpeed()
    
    // Her 30 saniyede bir kontrol et
    const interval = setInterval(checkConnectionSpeed, 30000)
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(interval)
    }
  }, [])
  
  if (!showNotification && connectionSpeed !== 'slow' && connectionSpeed !== 'offline') {
    return null
  }
  
  return (
    <div className={`network-status ${connectionSpeed}`}>
      <div className="network-status-content">
        {connectionSpeed === 'offline' ? (
          <>
            <span className="network-icon">📵</span>
            <span className="network-message">İnternet bağlantısı yok</span>
          </>
        ) : connectionSpeed === 'slow' ? (
          <>
            <span className="network-icon">🐌</span>
            <span className="network-message">Yavaş internet bağlantısı - Yüklemeler uzun sürebilir</span>
          </>
        ) : isOnline && showNotification ? (
          <>
            <span className="network-icon">✅</span>
            <span className="network-message">İnternet bağlantısı tekrar sağlandı</span>
          </>
        ) : null}
      </div>
    </div>
  )
}