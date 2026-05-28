import React, { useState, useRef, useEffect } from 'react'
import { X, Pipette, Sliders } from 'lucide-react'

interface ColorKeyModalProps {
  imageSrc: string
  fileName: string
  onClose: () => void
  onComplete: (processedFile: File) => void
}

interface RGB {
  r: number
  g: number
  b: number
}

const ColorKeyModal: React.FC<ColorKeyModalProps> = ({
  imageSrc,
  fileName,
  onClose,
  onComplete
}) => {
  const [selectedColor, setSelectedColor] = useState<RGB | null>(null)
  const [tolerance, setTolerance] = useState<number>(30)
  const [feather, setFeather] = useState<number>(10)
  const imgRef = useRef<HTMLImageElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Khởi chạy: tự động lấy màu ở góc trên cùng bên trái (0,0) làm màu nền mặc định
  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const tempCanvas = document.createElement('canvas')
      tempCanvas.width = img.naturalWidth
      tempCanvas.height = img.naturalHeight
      const ctx = tempCanvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(img, 0, 0)
        const pixel = ctx.getImageData(0, 0, 1, 1).data
        setSelectedColor({
          r: pixel[0],
          g: pixel[1],
          b: pixel[2]
        })
      }
    }
    img.src = imageSrc
  }, [imageSrc])

  // Vẽ lại ảnh lên canvas với kênh alpha được xử lý theo màu đã chọn, tolerance và feather
  useEffect(() => {
    if (!selectedColor) return
    const img = imgRef.current
    const canvas = canvasRef.current
    if (!img || !canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Đảm bảo canvas khớp kích thước tự nhiên của ảnh
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight

    // Vẽ ảnh gốc lên
    ctx.drawImage(img, 0, 0)

    // Xử lý dữ liệu điểm ảnh (Pixel Data)
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imgData.data

    const { r: tr, g: tg, b: tb } = selectedColor

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]

      // Khoảng cách Euclide giữa màu hiện tại và màu cần xóa
      const dist = Math.sqrt(
        Math.pow(r - tr, 2) +
        Math.pow(g - tg, 2) +
        Math.pow(b - tb, 2)
      )

      // Giới hạn mềm (Feathering)
      const minLimit = Math.max(0, tolerance - feather)
      const maxLimit = tolerance + feather

      if (dist <= minLimit) {
        data[i + 3] = 0 // Trong suốt hoàn toàn
      } else if (dist >= maxLimit) {
        // Giữ nguyên độ trong suốt gốc
      } else {
        // Nội suy mượt mà độ trong suốt alpha từ 0 đến 255
        const ratio = (dist - minLimit) / (maxLimit - minLimit)
        data[i + 3] = Math.round(ratio * 255)
      }
    }

    ctx.putImageData(imgData, 0, 0)
  }, [selectedColor, tolerance, feather])

  // Lấy màu khi người dùng click/tap vào một khu vực trên ảnh preview
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    // Tỉ lệ scale giữa kích thước hiển thị (CSS) và kích thước thực tế (Canvas resolution)
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height

    const clickX = Math.floor((e.clientX - rect.left) * scaleX)
    const clickY = Math.floor((e.clientY - rect.top) * scaleY)

    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = canvas.width
    tempCanvas.height = canvas.height
    const tempCtx = tempCanvas.getContext('2d')
    if (tempCtx && imgRef.current) {
      // Đọc màu gốc từ ảnh chứ không đọc từ canvas đang bị xóa dở dang
      tempCtx.drawImage(imgRef.current, 0, 0)
      const pixel = tempCtx.getImageData(clickX, clickY, 1, 1).data
      setSelectedColor({
        r: pixel[0],
        g: pixel[1],
        b: pixel[2]
      })
    }
  }

  const handleSave = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          alert('Lỗi xuất ảnh xóa nền.')
          return
        }
        const processedFile = new File([blob], fileName.substring(0, fileName.lastIndexOf('.')) + '-no-bg.png', {
          type: 'image/png'
        })
        onComplete(processedFile)
        onClose()
      },
      'image/png',
      1.0
    )
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-content" style={{ maxWidth: '600px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Pipette size={18} color="var(--accent-light)" />
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Xóa nền Logo / Đơn sắc</h3>
          </div>
          <button 
            onClick={onClose} 
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            title="Đóng"
          >
            <X size={20} />
          </button>
        </div>

        {/* Ẩn thẻ img này đi, chỉ dùng làm reference để đọc ảnh gốc */}
        <img
          ref={imgRef}
          src={imageSrc}
          alt="Original Source"
          style={{ display: 'none' }}
          crossOrigin="anonymous"
          onLoad={handleImageLoad} // Cần thiết để đảm bảo canvas render khi ảnh hoàn thành tải
        />

        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
          💡 Hệ thống đã tự động chọn màu nền ở góc trên bên trái. Bạn có thể **click/tap thẳng vào bất kì vùng màu nào** trên ảnh bên dưới để xóa màu đó.
        </div>

        <div className="crop-area-wrapper" style={{ cursor: 'crosshair', background: 'repeating-conic-gradient(#202025 0% 25%, #151518 0% 50%) 50% / 20px 20px' }}>
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            style={{ maxWidth: '100%', maxHeight: '320px', display: 'block', objectFit: 'contain' }}
          />
        </div>

        {selectedColor && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '0.85rem' }}>Màu đang xóa:</span>
              <div 
                style={{ 
                  width: '24px', 
                  height: '24px', 
                  borderRadius: '4px', 
                  backgroundColor: `rgb(${selectedColor.r}, ${selectedColor.g}, ${selectedColor.b})`,
                  border: '1px solid var(--text-main)',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.5)'
                }} 
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                RGB({selectedColor.r}, {selectedColor.g}, {selectedColor.b})
              </span>
            </div>

            <div className="input-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Sliders size={14} />
                  <span>Độ nhạy xóa màu (Tolerance)</span>
                </label>
                <span style={{ color: 'var(--accent-light)', fontWeight: 600 }}>{tolerance}</span>
              </div>
              <input
                type="range"
                min="5"
                max="150"
                step="1"
                value={tolerance}
                onChange={(e) => setTolerance(parseInt(e.target.value))}
              />
            </div>

            <div className="input-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Sliders size={14} />
                  <span>Độ mờ viền (Feather / Edge Smoothing)</span>
                </label>
                <span style={{ color: 'var(--accent-light)', fontWeight: 600 }}>{feather}</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                step="1"
                value={feather}
                onChange={(e) => setFeather(parseInt(e.target.value))}
              />
            </div>
          </div>
        )}


        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '0.5rem' }}>
          <button className="button button-secondary" onClick={onClose} style={{ padding: '0.5rem 1.2rem', fontSize: '0.9rem' }}>
            Hủy
          </button>
          <button className="button" onClick={handleSave} style={{ padding: '0.5rem 1.5rem', fontSize: '0.9rem' }}>
            Áp dụng xóa nền
          </button>
        </div>
      </div>
    </div>
  )

  function handleImageLoad() {
    // Trực quan hóa cập nhật lại canvas
    if (imgRef.current && canvasRef.current) {
      const img = imgRef.current
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      if (ctx) {
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        ctx.drawImage(img, 0, 0)
      }
    }
  }
}

export default ColorKeyModal
