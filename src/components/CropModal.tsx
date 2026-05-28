import React, { useState, useRef, useEffect } from 'react'
import { X, Crop as CropIcon } from 'lucide-react'

interface CropModalProps {
  imageSrc: string
  fileName: string
  onClose: () => void
  onCropComplete: (croppedFile: File) => void
}

interface CropState {
  x: number  // % from left
  y: number  // % from top
  w: number  // % width
  h: number  // % height
}

const CropModal: React.FC<CropModalProps> = ({
  imageSrc,
  fileName,
  onClose,
  onCropComplete
}) => {
  const [crop, setCrop] = useState<CropState>({ x: 10, y: 10, w: 80, h: 80 })
  const [aspect, setAspect] = useState<number | undefined>(undefined)
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  // Reset crop khi thay đổi aspect ratio
  const handleAspectChange = (newAspect: number | undefined) => {
    setAspect(newAspect)
    if (imgRef.current) {
      const rect = imgRef.current.getBoundingClientRect()
      const newCrop = getCenterAspectCrop(newAspect, rect.width, rect.height)
      setCrop(newCrop)
    }
  }

  const getCenterAspectCrop = (aspectRatio: number | undefined, rectWidth: number, rectHeight: number): CropState => {
    if (aspectRatio === undefined) {
      return { x: 10, y: 10, w: 80, h: 80 }
    }
    
    // aspectRatio = width / height
    let w = 80
    // Đổi tỉ lệ phần trăm dựa trên kích thước pixel container
    let h = (w * rectWidth) / (rectHeight * aspectRatio)
    
    if (h > 80) {
      h = 80
      w = (h * rectHeight * aspectRatio) / rectWidth
    }
    
    return {
      x: (100 - w) / 2,
      y: (100 - h) / 2,
      w,
      h
    }
  }

  // Khởi tạo crop khi ảnh load xong
  const handleImageLoad = () => {
    if (imgRef.current) {
      const rect = imgRef.current.getBoundingClientRect()
      setCrop(getCenterAspectCrop(aspect, rect.width, rect.height))
    }
  }

  // Cập nhật lại crop khi đổi kích thước màn hình
  useEffect(() => {
    const handleResize = () => {
      if (imgRef.current) {
        const rect = imgRef.current.getBoundingClientRect()
        setCrop(getCenterAspectCrop(aspect, rect.width, rect.height))
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [aspect])

  const startDrag = (e: React.MouseEvent | React.TouchEvent, action: 'move' | 'tl' | 'tr' | 'bl' | 'br') => {
    e.preventDefault()
    if (!containerRef.current || !imgRef.current) return

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

    const initialCrop = { ...crop }
    const rect = imgRef.current.getBoundingClientRect()

    const handleMouseMove = (moveEvent: MouseEvent | TouchEvent) => {
      const curX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX
      const curY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY

      // Tính toán delta %
      const dx = ((curX - clientX) / rect.width) * 100
      const dy = ((curY - clientY) / rect.height) * 100

      let newCrop = { ...initialCrop }

      if (action === 'move') {
        newCrop.x = Math.max(0, Math.min(100 - initialCrop.w, initialCrop.x + dx))
        newCrop.y = Math.max(0, Math.min(100 - initialCrop.h, initialCrop.y + dy))
      } else {
        // Thay đổi kích thước
        if (action === 'br') {
          newCrop.w = Math.max(5, Math.min(100 - initialCrop.x, initialCrop.w + dx))
          newCrop.h = Math.max(5, Math.min(100 - initialCrop.y, initialCrop.h + dy))
        } else if (action === 'bl') {
          const targetX = Math.max(0, Math.min(initialCrop.x + initialCrop.w - 5, initialCrop.x + dx))
          newCrop.w = initialCrop.x + initialCrop.w - targetX
          newCrop.x = targetX
          newCrop.h = Math.max(5, Math.min(100 - initialCrop.y, initialCrop.h + dy))
        } else if (action === 'tr') {
          newCrop.w = Math.max(5, Math.min(100 - initialCrop.x, initialCrop.w + dx))
          const targetY = Math.max(0, Math.min(initialCrop.y + initialCrop.h - 5, initialCrop.y + dy))
          newCrop.h = initialCrop.y + initialCrop.h - targetY
          newCrop.y = targetY
        } else if (action === 'tl') {
          const targetX = Math.max(0, Math.min(initialCrop.x + initialCrop.w - 5, initialCrop.x + dx))
          newCrop.w = initialCrop.x + initialCrop.w - targetX
          newCrop.x = targetX
          const targetY = Math.max(0, Math.min(initialCrop.y + initialCrop.h - 5, initialCrop.y + dy))
          newCrop.h = initialCrop.y + initialCrop.h - targetY
          newCrop.y = targetY
        }

        // Áp dụng Aspect Ratio cố định
        if (aspect !== undefined) {
          const containerAspect = rect.width / rect.height
          
          if (action === 'br' || action === 'tr') {
            // Cân chỉnh theo chiều rộng thay đổi
            newCrop.h = (newCrop.w * containerAspect) / aspect
          } else {
            // Cân chỉnh theo chiều rộng thay đổi (phía bên trái)
            newCrop.h = (newCrop.w * containerAspect) / aspect
          }

          // Giới hạn biên dưới
          if (newCrop.y + newCrop.h > 100) {
            newCrop.h = 100 - newCrop.y
            newCrop.w = (newCrop.h * aspect) / containerAspect
            if (action === 'tl' || action === 'bl') {
              newCrop.x = initialCrop.x + initialCrop.w - newCrop.w
            }
          }
        }
      }

      setCrop(newCrop)
    }

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('touchmove', handleMouseMove)
      document.removeEventListener('touchend', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('touchmove', handleMouseMove)
    document.addEventListener('touchend', handleMouseUp)
  }

  const executeCrop = () => {
    if (!imgRef.current) return

    try {
      const img = imgRef.current
      const canvas = document.createElement('canvas')
      
      const scaleX = img.naturalWidth / 100
      const scaleY = img.naturalHeight / 100

      const cropX = crop.x * scaleX
      const cropY = crop.y * scaleY
      const cropW = crop.w * scaleX
      const cropH = crop.h * scaleY

      canvas.width = cropW
      canvas.height = cropH

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        alert('Không thể tạo context canvas.')
        return
      }

      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'

      ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH)

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            alert('Lỗi tạo ảnh cắt.')
            return
          }
          const croppedFile = new File([blob], fileName, { type: 'image/png' })
          onCropComplete(croppedFile)
          onClose()
        },
        'image/png',
        1.0
      )
    } catch (err) {
      console.error(err)
      alert('Lỗi khi cắt ảnh.')
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CropIcon size={18} color="var(--accent-light)" />
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Cắt hình ảnh</h3>
          </div>
          <button 
            onClick={onClose} 
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            title="Đóng"
          >
            <X size={20} />
          </button>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem' }}>Chọn tỉ lệ cắt (Aspect Ratio):</label>
          <div className="preset-buttons">
            <button className={`preset-btn ${aspect === undefined ? 'active' : ''}`} onClick={() => handleAspectChange(undefined)}>Tự do</button>
            <button className={`preset-btn ${aspect === 1 ? 'active' : ''}`} onClick={() => handleAspectChange(1)}>1:1 (Vuông)</button>
            <button className={`preset-btn ${aspect === 16/9 ? 'active' : ''}`} onClick={() => handleAspectChange(16/9)}>16:9 (Ngang)</button>
            <button className={`preset-btn ${aspect === 9/16 ? 'active' : ''}`} onClick={() => handleAspectChange(9/16)}>9:16 (Dọc)</button>
            <button className={`preset-btn ${aspect === 4/3 ? 'active' : ''}`} onClick={() => handleAspectChange(4/3)}>4:3</button>
          </div>
        </div>

        <div className="crop-area-wrapper" ref={containerRef}>
          <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%', overflow: 'hidden' }}>
            <img
              ref={imgRef}
              src={imageSrc}
              alt="Cắt ảnh"
              onLoad={handleImageLoad}
              style={{ display: 'block', maxHeight: '350px', maxWidth: '100%', objectFit: 'contain', userSelect: 'none', pointerEvents: 'none' }}
            />
            {/* Hộp Cắt Ảnh (Crop Box overlay) */}
            <div 
              style={{
                position: 'absolute',
                left: `${crop.x}%`,
                top: `${crop.y}%`,
                width: `${crop.w}%`,
                height: `${crop.h}%`,
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.65)',
                border: '2px dashed var(--accent-light)',
                cursor: 'move',
                zIndex: 10,
                boxSizing: 'border-box'
              }}
              onMouseDown={(e) => startDrag(e, 'move')}
              onTouchStart={(e) => startDrag(e, 'move')}
            >
              {/* Corner handles */}
              <div 
                style={{ position: 'absolute', left: '-6px', top: '-6px', width: '12px', height: '12px', background: '#fff', border: '2px solid var(--accent)', borderRadius: '50%', cursor: 'nwse-resize' }}
                onMouseDown={(e) => { e.stopPropagation(); startDrag(e, 'tl') }}
                onTouchStart={(e) => { e.stopPropagation(); startDrag(e, 'tl') }}
              />
              <div 
                style={{ position: 'absolute', right: '-6px', top: '-6px', width: '12px', height: '12px', background: '#fff', border: '2px solid var(--accent)', borderRadius: '50%', cursor: 'nesw-resize' }}
                onMouseDown={(e) => { e.stopPropagation(); startDrag(e, 'tr') }}
                onTouchStart={(e) => { e.stopPropagation(); startDrag(e, 'tr') }}
              />
              <div 
                style={{ position: 'absolute', left: '-6px', bottom: '-6px', width: '12px', height: '12px', background: '#fff', border: '2px solid var(--accent)', borderRadius: '50%', cursor: 'nesw-resize' }}
                onMouseDown={(e) => { e.stopPropagation(); startDrag(e, 'bl') }}
                onTouchStart={(e) => { e.stopPropagation(); startDrag(e, 'bl') }}
              />
              <div 
                style={{ position: 'absolute', right: '-6px', bottom: '-6px', width: '12px', height: '12px', background: '#fff', border: '2px solid var(--accent)', borderRadius: '50%', cursor: 'nwse-resize' }}
                onMouseDown={(e) => { e.stopPropagation(); startDrag(e, 'br') }}
                onTouchStart={(e) => { e.stopPropagation(); startDrag(e, 'br') }}
              />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '0.5rem' }}>
          <button className="button button-secondary" onClick={onClose} style={{ padding: '0.5rem 1.2rem', fontSize: '0.9rem' }}>
            Hủy
          </button>
          <button className="button" onClick={executeCrop} style={{ padding: '0.5rem 1.5rem', fontSize: '0.9rem' }}>
            <CropIcon size={16} />
            Cắt ảnh ngay
          </button>
        </div>
      </div>
    </div>
  )
}

export default CropModal
