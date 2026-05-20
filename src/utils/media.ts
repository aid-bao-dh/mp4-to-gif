export const getVideoDimensions = (file: File): Promise<{width: number, height: number, duration: number}> => {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      resolve({ width: video.videoWidth, height: video.videoHeight, duration: video.duration })
      URL.revokeObjectURL(url)
    }
    video.onerror = () => {
      resolve({ width: 640, height: 360, duration: 0 }) // Fallback
      URL.revokeObjectURL(url)
    }
    video.src = url
  })
}

export const getImageDimensions = (file: File): Promise<{width: number, height: number}> => {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
      URL.revokeObjectURL(url)
    }
    img.onerror = () => {
      resolve({ width: 640, height: 640 }) // Fallback
      URL.revokeObjectURL(url)
    }
    img.src = url
  })
}
