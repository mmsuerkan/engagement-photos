import imageCompression from 'browser-image-compression'

export interface CompressionOptions {
  maxSizeMB?: number
  maxWidthOrHeight?: number
  useWebWorker?: boolean
  fileType?: string
}

export async function compressImage(
  file: File, 
  options: CompressionOptions = {}
): Promise<File> {
  const defaultOptions = {
    maxSizeMB: 2,
    maxWidthOrHeight: 2560,
    useWebWorker: true,
    fileType: file.type,
    initialQuality: 0.9,
    ...options
  }

  try {
    const compressedFile = await imageCompression(file, defaultOptions)
    console.log(`Sıkıştırma: ${(file.size / 1024 / 1024).toFixed(2)}MB → ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`)
    return compressedFile
  } catch (error) {
    console.error('Görsel sıkıştırma hatası:', error)
    return file
  }
}

export async function generateThumbnail(
  file: File,
  maxSize: number = 400
): Promise<File> {
  const thumbnailOptions = {
    maxSizeMB: 0.3,
    maxWidthOrHeight: maxSize,
    useWebWorker: true,
    fileType: 'image/jpeg',
    initialQuality: 0.8
  }

  try {
    const thumbnail = await imageCompression(file, thumbnailOptions)
    return thumbnail
  } catch (error) {
    console.error('Thumbnail oluşturma hatası:', error)
    return file
  }
}