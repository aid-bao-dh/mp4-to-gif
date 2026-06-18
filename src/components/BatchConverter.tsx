import React, { useState } from 'react'
import { 
  UploadCloud, 
  Download, 
  RefreshCw, 
  Trash2, 
  Info, 
  CheckCircle2, 
  Sliders,
  Files
} from 'lucide-react'
import { getImageDimensions } from '../utils/media'
import Pica from 'pica'

const pica = Pica({ features: ['js', 'wasm', 'ww'] })

interface TabComponentProps {
  ffmpegRef: React.MutableRefObject<any>;
  processing: boolean;
  setProcessing: (p: boolean) => void;
  progress: number;
  setProgress: (p: number) => void;
}

interface ImageFile {
  file: File
  id: string
  width: number
  height: number
  status: 'pending' | 'processing' | 'done' | 'error'
  resultSize?: number
  resultURL?: string
}

type ConvertFormat = 'webp' | 'jpeg' | 'png'
type AspectRatioPreset = 'original' | '1:1' | '16:9' | '9:16' | '4:3' | 'custom'

const getConvertedDimensions = (
  width: number,
  height: number,
  settings: {
    resizeMode: 'scale' | 'fixed'
    scale: number
    fixedWidth: number
    fixedHeight: number
    aspectRatio: AspectRatioPreset
    fixedFit: 'crop' | 'stretch'
  }
) => {
  if (settings.resizeMode === 'fixed') {
    const destW = settings.fixedWidth
    const destH = settings.fixedHeight
    
    if (settings.fixedFit === 'crop') {
      const targetRatio = destW / destH
      const currentRatio = width / height
      let sw = width
      let sh = height
      
      if (currentRatio > targetRatio) {
        sw = height * targetRatio
        sh = height
      } else {
        sw = width
        sh = width / targetRatio
      }
      return { sw, sh, destW, destH }
    } else {
      return { sw: width, sh: height, destW, destH }
    }
  } else {
    let sw = width
    let sh = height
    
    if (settings.aspectRatio !== 'original') {
      let targetRatio = 1
      if (settings.aspectRatio === '16:9') targetRatio = 16 / 9
      else if (settings.aspectRatio === '9:16') targetRatio = 9 / 16
      else if (settings.aspectRatio === '4:3') targetRatio = 4 / 3
      
      const currentRatio = width / height
      if (currentRatio > targetRatio) {
        sw = height * targetRatio
        sh = height
      } else {
        sw = width
        sh = width / targetRatio
      }
    }
    
    const destW = Math.max(1, Math.floor((sw * settings.scale) / 100))
    const destH = Math.max(1, Math.floor((sh * settings.scale) / 100))
    
    return { sw, sh, destW, destH }
  }
}

const BatchConverter: React.FC<TabComponentProps> = ({
  ffmpegRef,
  processing,
  setProcessing,
  progress,
  setProgress
}) => {
  const [images, setImages] = useState<ImageFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [settings, setSettings] = useState({
    format: 'webp' as ConvertFormat,
    quality: 80, // for webp and jpeg
    resizeMode: 'scale' as 'scale' | 'fixed',
    scale: 100, // %
    fixedWidth: 800,
    fixedHeight: 800,
    aspectRatio: 'original' as AspectRatioPreset,
    fixedFit: 'crop' as 'crop' | 'stretch'
  })
  const [zipURL, setZipURL] = useState<string>('')
  const [zipSize, setZipSize] = useState<number>(0)

  const calculateHeightFromWidth = (width: number, ratio: string): number => {
    if (ratio === '1:1') return width
    if (ratio === '16:9') return Math.round(width * 9 / 16)
    if (ratio === '9:16') return Math.round(width * 16 / 9)
    if (ratio === '4:3') return Math.round(width * 3 / 4)
    return width
  }

  const handleWidthChange = (w: number) => {
    setSettings(p => {
      const newH = p.aspectRatio !== 'original' && p.aspectRatio !== 'custom' 
        ? calculateHeightFromWidth(w, p.aspectRatio) 
        : p.fixedHeight
      return { ...p, fixedWidth: w, fixedHeight: newH }
    })
    setZipURL('')
  }

  const handleAspectRatioChange = (ratio: string) => {
    setSettings(p => {
      let newH = p.fixedHeight
      const newRatio = ratio as AspectRatioPreset
      if (ratio !== 'original' && ratio !== 'custom') {
        newH = calculateHeightFromWidth(p.fixedWidth, ratio)
      }
      return { ...p, aspectRatio: newRatio, fixedHeight: newH }
    })
    setZipURL('')
  }

  const handleFilesChange = async (files: File[]) => {
    if (files.length > 0) {
      const newImages: ImageFile[] = []
      for (const file of files) {
        if (!file.type.startsWith('image/')) {
          alert(`Tệp ${file.name} không phải là hình ảnh hợp lệ.`)
          continue
        }
        const dim = await getImageDimensions(file)
        newImages.push({
          file,
          id: Math.random().toString(36).substring(2, 9),
          width: dim.width,
          height: dim.height,
          status: 'pending'
        })
      }
      setImages(prev => [...prev, ...newImages])
      setZipURL('')
      setZipSize(0)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files || [])
    await handleFilesChange(files)
  }

  const removeImage = (id: string) => {
    setImages(prev => prev.filter(img => img.id !== id))
    setZipURL('')
    setZipSize(0)
  }

  const clearAll = () => {
    setImages([])
    setZipURL('')
    setZipSize(0)
  }

  const convertImages = async () => {
    if (images.length === 0) return
    setProcessing(true)
    setProgress(5)

    try {
      // 1. Tải động JSZip từ CDN
      setProgress(10)
      const cdnUrl = 'https://cdn.jsdelivr.net/npm/jszip/+esm'
      const module = await import(/* @vite-ignore */ cdnUrl)
      const JSZip = module.default
      const zip = new JSZip()

      setProgress(20)
      const totalImages = images.length
      const updatedImages = [...images]

      for (let i = 0; i < totalImages; i++) {
        const item = updatedImages[i]
        
        // Cập nhật trạng thái item thành 'processing'
        setImages(prev => prev.map(img => img.id === item.id ? { ...img, status: 'processing' } : img))
        
        // Vẽ ảnh lên canvas để chuyển đổi định dạng
        const blob = await new Promise<Blob | null>((resolve) => {
          const img = new Image()
          img.onload = async () => {
            const { sw, sh, destW, destH } = getConvertedDimensions(
              img.naturalWidth,
              img.naturalHeight,
              settings
            )
            const canvas = document.createElement('canvas')
            canvas.width = destW
            canvas.height = destH
            
            try {
              const sx = (img.naturalWidth - sw) / 2
              const sy = (img.naturalHeight - sh) / 2
              
              let sourceElement: HTMLImageElement | HTMLCanvasElement = img
              
              const cropCanvas = document.createElement('canvas')
              cropCanvas.width = sw
              cropCanvas.height = sh
              const cropCtx = cropCanvas.getContext('2d')
              if (cropCtx) {
                cropCtx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)
                sourceElement = cropCanvas
              }
              
              await pica.resize(sourceElement, canvas, {
                quality: 3
              })
              
              let mimeType = 'image/webp'
              if (settings.format === 'jpeg') mimeType = 'image/jpeg'
              else if (settings.format === 'png') mimeType = 'image/png'

              canvas.toBlob((b) => resolve(b), mimeType, settings.quality / 100)
            } catch (err) {
              console.error(err)
              resolve(null)
            }
          }
          img.onerror = () => resolve(null)
          img.src = URL.createObjectURL(item.file)
        })

        if (blob) {
          const fileName = item.file.name.substring(0, item.file.name.lastIndexOf('.')) + `.${settings.format}`
          zip.file(fileName, blob)
          
          setImages(prev => prev.map(img => img.id === item.id ? { 
            ...img, 
            status: 'done', 
            resultSize: blob.size,
            resultURL: URL.createObjectURL(blob)
          } : img))
        } else {
          setImages(prev => prev.map(img => img.id === item.id ? { ...img, status: 'error' } : img))
        }

        // Cập nhật tiến độ tổng quan
        const currentProgress = 20 + Math.round(((i + 1) / totalImages) * 60)
        setProgress(currentProgress)
      }

      setProgress(85)
      // 2. Tạo tệp zip
      const content = await zip.generateAsync({ type: 'blob' })
      setZipURL(URL.createObjectURL(content))
      setZipSize(content.size)
      setProgress(100)
    } catch (err) {
      console.error(err)
      alert('Đã xảy ra lỗi trong quá trình chuyển đổi hàng loạt.')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="editor-grid fade-in">
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Files size={20} color="var(--accent)" />
            <h3 style={{ margin: 0 }}>Danh sách ảnh cần chuyển đổi ({images.length})</h3>
          </div>
          {images.length > 0 && (
            <button className="button button-secondary" onClick={clearAll} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} disabled={processing}>
              Xóa tất cả
            </button>
          )}
        </div>

        {images.length === 0 ? (
          <label 
            className={`upload-zone ${isDragging ? 'dragging' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{ minHeight: '300px' }}
          >
            <div className="upload-icon-wrapper">
              <UploadCloud size={48} strokeWidth={1.5} color="var(--accent)" />
            </div>
            <div style={{ marginTop: '1rem' }}>
              <h3>Chọn các hình ảnh cần chuyển đổi</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                Kéo thả nhiều tệp JPG, PNG, WEBP vào đây
              </p>
            </div>
            <input type="file" accept="image/*" multiple onChange={(e) => handleFilesChange(Array.from(e.target.files || []))} style={{ display: 'none' }} />
          </label>
        ) : (
          <div>
            <div className="file-list" style={{ maxHeight: '350px', overflowY: 'auto', paddingRight: '4px' }}>
              {images.map((img) => (
                <div key={img.id} className="file-item" style={{ borderColor: img.status === 'done' ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-color)' }}>
                  <div className="file-info">
                    <div className="file-name" style={{ fontWeight: 600 }}>{img.file.name}</div>
                    <div className="file-meta">
                      {(() => {
                        const { destW, destH } = getConvertedDimensions(img.width, img.height, settings);
                        const isChanged = img.width !== destW || img.height !== destH;
                        return isChanged ? (
                          `${img.width}x${img.height} → ${destW}x${destH}`
                        ) : (
                          `${img.width}x${img.height}`
                        );
                      })()}
                      {` • ${(img.file.size / 1024).toFixed(0)} KB`}
                      {img.status === 'processing' && <span style={{ color: 'var(--accent-light)', marginLeft: '10px' }}>⏳ Đang chuyển đổi...</span>}
                      {img.status === 'done' && img.resultSize && (
                        <span style={{ color: '#10b981', marginLeft: '10px', fontWeight: 600 }}>
                          ✓ Xong ({(img.resultSize / 1024).toFixed(0)} KB)
                        </span>
                      )}
                      {img.status === 'error' && <span style={{ color: '#ef4444', marginLeft: '10px' }}>✗ Lỗi</span>}
                    </div>
                  </div>
                  <div className="file-actions">
                    {img.status === 'done' && img.resultURL && (
                      <a href={img.resultURL} download={img.file.name.substring(0, img.file.name.lastIndexOf('.')) + `.${settings.format}`} className="action-btn" title="Tải về ảnh này" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                        <Download size={16} />
                      </a>
                    )}
                    <button className="action-btn delete" onClick={() => removeImage(img.id)} title="Xóa" disabled={processing}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <label 
              className={`upload-zone ${isDragging ? 'dragging' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              style={{ padding: '1.5rem', minHeight: 'auto', borderStyle: 'dashed', marginTop: '1.5rem' }}
            >
              <UploadCloud size={24} color="var(--accent)" />
              <span>Thêm ảnh hoặc kéo thả thêm tệp vào đây</span>
              <input type="file" accept="image/*" multiple onChange={(e) => handleFilesChange(Array.from(e.target.files || []))} style={{ display: 'none' }} />
            </label>
          </div>
        )}
      </div>

      <div className="card controls-panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
          <Sliders size={20} color="var(--accent)" />
          <h3 style={{ margin: 0 }}>Cấu hình chuyển đổi</h3>
        </div>

        {images.length > 0 && (
          <>
            {/* Resize Mode Selector */}
            <div className="input-group">
              <label>Chế độ kích thước</label>
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <button
                  type="button"
                  className={`preset-btn ${settings.resizeMode === 'scale' ? 'active' : ''}`}
                  style={{ flex: 1, padding: '0.5rem 0' }}
                  onClick={() => {
                    setSettings(p => ({ ...p, resizeMode: 'scale' }))
                    setZipURL('')
                  }}
                  disabled={processing}
                >
                  Tỉ lệ (%)
                </button>
                <button
                  type="button"
                  className={`preset-btn ${settings.resizeMode === 'fixed' ? 'active' : ''}`}
                  style={{ flex: 1, padding: '0.5rem 0' }}
                  onClick={() => {
                    setSettings(p => ({ ...p, resizeMode: 'fixed' }))
                    setZipURL('')
                  }}
                  disabled={processing}
                >
                  Kích thước cố định (px)
                </button>
              </div>
            </div>

            {settings.resizeMode === 'scale' ? (
              <>
                {/* Scale Option */}
                <div className="input-group" style={{ marginTop: '1rem' }}>
                  <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Tỉ lệ kích thước (Scale)</span>
                    <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{settings.scale}%</span>
                  </label>
                  <input 
                    type="range" 
                    min="1" 
                    max="100" 
                    step="1" 
                    value={settings.scale} 
                    onChange={(e) => {
                      setSettings(p => ({ ...p, scale: parseInt(e.target.value) }))
                      setZipURL('')
                    }}
                    disabled={processing}
                  />
                </div>

                {/* Aspect Ratio Option */}
                <div className="input-group" style={{ marginTop: '1rem' }}>
                  <label>Tỉ lệ khung hình (Aspect Ratio)</label>
                  <select
                    value={settings.aspectRatio}
                    onChange={(e) => {
                      setSettings(p => ({ ...p, aspectRatio: e.target.value as AspectRatioPreset }))
                      setZipURL('')
                    }}
                    disabled={processing}
                  >
                    <option value="original">Giữ nguyên tỉ lệ gốc</option>
                    <option value="1:1">Vuông (1:1)</option>
                    <option value="16:9">Ngang (16:9)</option>
                    <option value="9:16">Dọc (9:16)</option>
                    <option value="4:3">Cổ điển (4:3)</option>
                  </select>
                </div>
              </>
            ) : (
              <>
                {/* Aspect Ratio Selector for Fixed Mode */}
                <div className="input-group" style={{ marginTop: '1rem' }}>
                  <label>Tỉ lệ khung hình (Aspect Ratio)</label>
                  <select
                    value={settings.aspectRatio === 'original' ? 'custom' : settings.aspectRatio}
                    onChange={(e) => handleAspectRatioChange(e.target.value)}
                    disabled={processing}
                  >
                    <option value="1:1">Vuông (1:1)</option>
                    <option value="16:9">Ngang (16:9)</option>
                    <option value="9:16">Dọc (9:16)</option>
                    <option value="4:3">Cổ điển (4:3)</option>
                    <option value="custom">Tự chọn (Tự nhập cả Rộng & Cao)</option>
                  </select>
                </div>

                {/* Width & Height inputs */}
                <div style={{ display: 'flex', gap: '12px', marginTop: '1rem' }}>
                  <div className="input-group" style={{ flex: 1 }}>
                    <label>Chiều rộng (px)</label>
                    <input
                      type="number"
                      min="1"
                      max="10000"
                      value={settings.fixedWidth}
                      onChange={(e) => {
                        const val = Math.max(1, parseInt(e.target.value) || 1)
                        handleWidthChange(val)
                      }}
                      disabled={processing}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div className="input-group" style={{ flex: 1 }}>
                    <label>Chiều cao (px)</label>
                    <input
                      type="number"
                      min="1"
                      max="10000"
                      value={settings.fixedHeight}
                      onChange={(e) => {
                        const val = Math.max(1, parseInt(e.target.value) || 1)
                        setSettings(p => ({ ...p, fixedHeight: val }))
                        setZipURL('')
                      }}
                      disabled={processing || (settings.aspectRatio !== 'original' && settings.aspectRatio !== 'custom')}
                      style={{ 
                        width: '100%',
                        opacity: (settings.aspectRatio !== 'original' && settings.aspectRatio !== 'custom') ? 0.6 : 1,
                        cursor: (settings.aspectRatio !== 'original' && settings.aspectRatio !== 'custom') ? 'not-allowed' : 'auto'
                      }}
                      title={(settings.aspectRatio !== 'original' && settings.aspectRatio !== 'custom') ? "Chiều cao tự động tính theo tỉ lệ. Chọn 'Tự chọn' để tự nhập." : ""}
                    />
                  </div>
                </div>

                {/* Fit Mode dropdown */}
                <div className="input-group" style={{ marginTop: '1rem' }}>
                  <label>Kiểu khớp kích thước (Fit Mode)</label>
                  <select
                    value={settings.fixedFit}
                    onChange={(e) => {
                      setSettings(p => ({ ...p, fixedFit: e.target.value as 'crop' | 'stretch' }))
                      setZipURL('')
                    }}
                    disabled={processing}
                  >
                    <option value="crop">Cắt ảnh từ tâm (Center Crop - Không méo)</option>
                    <option value="stretch">Kéo giãn vừa khít (Stretch - Méo ảnh)</option>
                  </select>
                </div>
              </>
            )}

            <div className="input-group" style={{ marginTop: '1rem' }}>
              <label>Định dạng đầu ra (Target Format)</label>
              <select 
                value={settings.format} 
                onChange={(e) => {
                  setSettings(p => ({ ...p, format: e.target.value as ConvertFormat }))
                  setZipURL('')
                }}
                disabled={processing}
              >
                <option value="webp">WEBP (Khuyên dùng - Dung lượng nhỏ nhất)</option>
                <option value="png">PNG (Không nén giảm chất lượng - Giữ trong suốt)</option>
                <option value="jpeg">JPEG (Phổ biến rộng rãi)</option>
              </select>
            </div>

            {settings.format !== 'png' && (
              <div className="input-group" style={{ marginTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <label>Chất lượng nén (Quality)</label>
                  <span style={{ color: 'var(--accent-light)', fontWeight: 600 }}>{settings.quality}%</span>
                </div>
                <input 
                  type="range" 
                  min="1" 
                  max="100" 
                  step="1" 
                  value={settings.quality} 
                  onChange={(e) => setSettings(p => ({ ...p, quality: parseInt(e.target.value) }))}
                  disabled={processing}
                />
              </div>
            )}

            <div style={{ marginTop: 'auto', paddingTop: '1.5rem' }}>
              {zipURL ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#10b981', marginBottom: '0.5rem' }}>
                    <CheckCircle2 size={20} />
                    <span style={{ fontWeight: 600 }}>Chuyển đổi hoàn tất!</span>
                  </div>
                  
                  <a 
                    href={zipURL} 
                    download={`converted-images-${settings.format}.zip`}
                    className="button" 
                    style={{ width: '100%' }}
                  >
                    <Download size={18} />
                    Tải về tệp .ZIP ({(zipSize / 1024).toFixed(0)} KB)
                  </a>

                  <button 
                    onClick={convertImages} 
                    disabled={processing} 
                    className="button button-secondary"
                    style={{ width: '100%' }}
                  >
                    <RefreshCw size={18} />
                    Chuyển đổi lại
                  </button>
                </div>
              ) : (
                <button 
                  onClick={convertImages} 
                  disabled={processing} 
                  className="button" 
                  style={{ width: '100%' }}
                >
                  {processing ? (
                    <>
                      <RefreshCw className="animate-spin" size={18} />
                      Đang chuyển đổi {progress}%...
                    </>
                  ) : (
                    <>
                      <Download size={18} />
                      Bắt đầu chuyển đổi hàng loạt
                    </>
                  )}
                </button>
              )}
            </div>
          </>
        )}

        {images.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.5, textAlign: 'center', padding: '2rem' }}>
            <Info size={24} style={{ marginBottom: '0.5rem' }} />
            <p>Tải ảnh lên ở khung bên trái để bắt đầu thiết lập</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default BatchConverter
