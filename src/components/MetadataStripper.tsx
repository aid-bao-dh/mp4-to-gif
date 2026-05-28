import React, { useState } from 'react'
import { 
  UploadCloud, 
  Download, 
  RefreshCw, 
  Trash2, 
  Info, 
  CheckCircle2, 
  Sliders, 
  AlertTriangle,
  MapPin,
  Camera,
  Calendar,
  Settings,
  EyeOff,
  Image as ImageIcon
} from 'lucide-react'

interface TabComponentProps {
  ffmpegRef: React.MutableRefObject<any>;
  processing: boolean;
  setProcessing: (p: boolean) => void;
  progress: number;
  setProgress: (p: number) => void;
}

interface MetadataInfo {
  make?: string
  model?: string
  dateTaken?: string
  exposureTime?: string
  aperture?: string
  iso?: string
  focalLength?: string
  lensModel?: string
  software?: string
  latitude?: number
  longitude?: number
  hasMetadata: boolean
}

type ExportFormat = 'jpeg' | 'png' | 'webp'

const MetadataStripper: React.FC<TabComponentProps> = ({
  processing,
  setProcessing,
  progress,
  setProgress
}) => {
  const [file, setFile] = useState<File | null>(null)
  const [previewURL, setPreviewURL] = useState<string>('')
  const [isDragging, setIsDragging] = useState(false)
  const [loadingMetadata, setLoadingMetadata] = useState(false)
  const [metadata, setMetadata] = useState<MetadataInfo | null>(null)

  const [exportFormat, setExportFormat] = useState<ExportFormat>('jpeg')
  const [quality, setQuality] = useState<number>(90)

  const [resultURL, setResultURL] = useState<string>('')
  const [resultSize, setResultSize] = useState<number>(0)
  const [resultName, setResultName] = useState<string>('')

  const handleFileChange = async (selectedFile: File) => {
    if (!selectedFile) return
    if (!selectedFile.type.startsWith('image/')) {
      alert('Tệp được chọn không phải là hình ảnh hợp lệ.')
      return
    }

    setFile(selectedFile)
    const url = URL.createObjectURL(selectedFile)
    setPreviewURL(url)
    setMetadata(null)
    setResultURL('')
    setResultSize(0)
    setResultName('')
    
    // Đọc thông tin EXIF
    await parseMetadata(selectedFile)
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
    if (files.length > 0) {
      await handleFileChange(files[0])
    }
  }

  const removeFile = () => {
    if (previewURL) URL.revokeObjectURL(previewURL)
    if (resultURL) URL.revokeObjectURL(resultURL)
    setFile(null)
    setPreviewURL('')
    setMetadata(null)
    setResultURL('')
    setResultSize(0)
    setResultName('')
  }

  const parseMetadata = async (imgFile: File) => {
    setLoadingMetadata(true)
    try {
      // Tải động exifr từ CDN
      const cdnUrl = 'https://cdn.jsdelivr.net/npm/exifr/dist/lite.esm.js'
      const module = await import(/* @vite-ignore */ cdnUrl)
      const exifr = module.default || module

      const rawData = await exifr.parse(imgFile)
      
      if (!rawData) {
        setMetadata({ hasMetadata: false })
        return
      }

      // Format Exposure Time
      let exposure = ''
      if (rawData.ExposureTime !== undefined) {
        const exp = rawData.ExposureTime
        exposure = exp < 1 ? `1/${Math.round(1 / exp)}s` : `${exp}s`
      }

      // Check GPS
      let lat: number | undefined = undefined
      let lng: number | undefined = undefined
      if (rawData.latitude !== undefined && rawData.longitude !== undefined) {
        lat = rawData.latitude
        lng = rawData.longitude
      } else {
        // Dự phòng: Thử tìm tọa độ qua hàm gps riêng của exifr để đảm bảo
        try {
          const gpsData = await exifr.gps(imgFile)
          if (gpsData && gpsData.latitude !== undefined && gpsData.longitude !== undefined) {
            lat = gpsData.latitude
            lng = gpsData.longitude
          }
        } catch (e) {
          console.log('Không thể lấy GPS qua exifr.gps():', e)
        }
      }

      const dateStr = rawData.DateTimeOriginal || rawData.CreateDate || rawData.ModifyDate
      let formattedDate = ''
      if (dateStr) {
        if (dateStr instanceof Date) {
          formattedDate = dateStr.toLocaleString('vi-VN')
        } else {
          formattedDate = String(dateStr)
        }
      }

      // Kiểm tra xem có bất kỳ dữ liệu nào tồn tại
      const hasData = !!(
        rawData.Make || 
        rawData.Model || 
        formattedDate || 
        exposure || 
        rawData.FNumber || 
        rawData.ISO || 
        rawData.FocalLength || 
        rawData.LensModel || 
        rawData.Software || 
        lat !== undefined
      )

      setMetadata({
        make: rawData.Make,
        model: rawData.Model,
        dateTaken: formattedDate,
        exposureTime: exposure,
        aperture: rawData.FNumber ? `f/${rawData.FNumber}` : undefined,
        iso: rawData.ISO ? String(rawData.ISO) : undefined,
        focalLength: rawData.FocalLength ? `${rawData.FocalLength} mm` : undefined,
        lensModel: rawData.LensModel,
        software: rawData.Software,
        latitude: lat,
        longitude: lng,
        hasMetadata: hasData
      })

    } catch (err) {
      console.error('Lỗi khi đọc EXIF metadata:', err)
      setMetadata({ hasMetadata: false })
    } finally {
      setLoadingMetadata(false)
    }
  }

  const stripMetadata = async () => {
    if (!file) return
    setProcessing(true)
    setProgress(15)

    try {
      setProgress(40)
      const blob = await new Promise<Blob | null>((resolve) => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          canvas.width = img.naturalWidth
          canvas.height = img.naturalHeight
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            resolve(null)
            return
          }
          ctx.drawImage(img, 0, 0)
          
          let mimeType = 'image/jpeg'
          if (exportFormat === 'png') mimeType = 'image/png'
          else if (exportFormat === 'webp') mimeType = 'image/webp'

          canvas.toBlob((b) => resolve(b), mimeType, quality / 100)
        }
        img.onerror = () => resolve(null)
        img.src = URL.createObjectURL(file)
      })

      setProgress(80)
      if (blob) {
        const ext = exportFormat
        const originalName = file.name
        const dotIndex = originalName.lastIndexOf('.')
        const baseName = dotIndex !== -1 ? originalName.substring(0, dotIndex) : originalName
        const cleanedName = `${baseName}-stripped.${ext}`

        if (resultURL) URL.revokeObjectURL(resultURL)
        setResultURL(URL.createObjectURL(blob))
        setResultSize(blob.size)
        setResultName(cleanedName)
        setProgress(100)
      } else {
        alert('Không thể vẽ hình ảnh lên Canvas để loại bỏ siêu dữ liệu.')
      }
    } catch (err) {
      console.error(err)
      alert('Đã xảy ra lỗi trong quá trình xóa siêu dữ liệu.')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="editor-grid fade-in">
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <EyeOff size={20} color="var(--accent)" />
            <h3 style={{ margin: 0 }}>Đọc & Xóa thông tin EXIF ảnh</h3>
          </div>
          {file && (
            <button className="button button-secondary" onClick={removeFile} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} disabled={processing}>
              Chọn ảnh khác
            </button>
          )}
        </div>

        {!file ? (
          <div>
            <label 
              className={`upload-zone ${isDragging ? 'dragging' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              style={{ minHeight: '260px' }}
            >
              <div className="upload-icon-wrapper">
                <UploadCloud size={48} strokeWidth={1.5} color="var(--accent)" />
              </div>
              <div style={{ marginTop: '1rem' }}>
                <h3>Chọn ảnh để phân tích & làm sạch</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                  Hỗ trợ kéo thả các định dạng JPEG, PNG, WEBP, HEIC
                </p>
              </div>
              <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])} style={{ display: 'none' }} />
            </label>

            <div style={{
              marginTop: '2rem',
              padding: '1.2rem',
              background: 'rgba(255, 255, 255, 0.02)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
            }}>
              <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.5rem', color: 'var(--accent-light)' }}>
                <Info size={16} />
                EXIF Metadata là gì và tại sao cần xóa?
              </h4>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                Khi bạn chụp một bức ảnh bằng smartphone hoặc máy ảnh cơ, tệp tin sẽ tự động lưu kèm các siêu dữ liệu ẩn (EXIF). 
                Thông tin này có thể chứa <strong>tọa độ vị trí GPS chính xác nơi bạn chụp</strong>, hãng máy ảnh, ống kính, và thời gian chi tiết. 
                Khi bạn chia sẻ ảnh trên MXH hoặc gửi trực tuyến, các thông tin nhạy cảm này có thể bị lộ. 
                <br />
                <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>
                  Công cụ này giúp vẽ lại ảnh trên Canvas để loại bỏ 100% dữ liệu nhị phân EXIF ẩn này một cách tuyệt đối an toàn và bảo mật ngay tại trình duyệt của bạn.
                </span>
              </p>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  <strong>Tên tệp:</strong> {file.name} <br />
                  <strong>Dung lượng:</strong> {(file.size / 1024).toFixed(1)} KB
                </div>
                <div className="preview-img-wrapper" style={{ height: '300px', width: '100%' }}>
                  <img src={previewURL} alt="Xem trước ảnh gốc" />
                </div>
              </div>

              <div>
                <h4 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Camera size={16} color="var(--accent-light)" />
                  Siêu dữ liệu EXIF đọc được
                </h4>

                {loadingMetadata ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '2rem 0', color: 'var(--text-muted)' }}>
                    <RefreshCw className="animate-spin" size={16} />
                    Đang giải nén thông tin EXIF nhị phân...
                  </div>
                ) : metadata ? (
                  metadata.hasMetadata ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <table style={{ 
                        width: '100%', 
                        borderCollapse: 'collapse', 
                        fontSize: '0.85rem', 
                        background: 'rgba(255, 255, 255, 0.01)', 
                        border: '1px solid var(--border-color)', 
                        borderRadius: 'var(--radius-sm)',
                        overflow: 'hidden'
                      }}>
                        <tbody>
                          {metadata.make && (
                            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '8px 12px', color: 'var(--text-muted)', width: '40%' }}>Hãng máy ảnh</td>
                              <td style={{ padding: '8px 12px', fontWeight: 500 }}>{metadata.make}</td>
                            </tr>
                          )}
                          {metadata.model && (
                            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>Mẫu máy ảnh</td>
                              <td style={{ padding: '8px 12px', fontWeight: 500 }}>{metadata.model}</td>
                            </tr>
                          )}
                          {metadata.dateTaken && (
                            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>Thời gian chụp</td>
                              <td style={{ padding: '8px 12px', fontWeight: 500 }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <Calendar size={12} />
                                  {metadata.dateTaken}
                                </span>
                              </td>
                            </tr>
                          )}
                          {metadata.exposureTime && (
                            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>Tốc độ màn trập</td>
                              <td style={{ padding: '8px 12px', fontWeight: 500 }}>{metadata.exposureTime}</td>
                            </tr>
                          )}
                          {metadata.aperture && (
                            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>Khẩu độ</td>
                              <td style={{ padding: '8px 12px', fontWeight: 500 }}>{metadata.aperture}</td>
                            </tr>
                          )}
                          {metadata.iso && (
                            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>Độ nhạy sáng ISO</td>
                              <td style={{ padding: '8px 12px', fontWeight: 500 }}>{metadata.iso}</td>
                            </tr>
                          )}
                          {metadata.focalLength && (
                            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>Tiêu cự</td>
                              <td style={{ padding: '8px 12px', fontWeight: 500 }}>{metadata.focalLength}</td>
                            </tr>
                          )}
                          {metadata.lensModel && (
                            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>Ống kính (Lens)</td>
                              <td style={{ padding: '8px 12px', fontWeight: 500 }}>{metadata.lensModel}</td>
                            </tr>
                          )}
                          {metadata.software && (
                            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>Phần mềm xử lý</td>
                              <td style={{ padding: '8px 12px', fontWeight: 500 }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <Settings size={12} />
                                  {metadata.software}
                                </span>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>

                      {metadata.latitude !== undefined && metadata.longitude !== undefined && (
                        <div style={{
                          padding: '0.75rem',
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          borderRadius: 'var(--radius-sm)',
                          marginTop: '0.5rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ef4444', fontWeight: 600, fontSize: '0.85rem' }}>
                            <AlertTriangle size={16} />
                            ⚠️ Phát hiện định vị vị trí GPS nhạy cảm!
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            Tọa độ: {metadata.latitude.toFixed(6)}, {metadata.longitude.toFixed(6)}
                          </div>
                          <a 
                            href={`https://www.google.com/maps?q=${metadata.latitude},${metadata.longitude}`} 
                            target="_blank" 
                            rel="noreferrer" 
                            style={{ 
                              fontSize: '0.8rem', 
                              color: 'var(--accent-light)', 
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              gap: '4px',
                              textDecoration: 'underline',
                              alignSelf: 'flex-start'
                            }}
                          >
                            <MapPin size={12} />
                            Xem chi tiết vị trí trên bản đồ Google Maps
                          </a>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ 
                      padding: '1.5rem', 
                      background: 'rgba(16, 185, 129, 0.05)', 
                      border: '1px solid rgba(16, 185, 129, 0.2)', 
                      borderRadius: 'var(--radius-md)', 
                      color: '#10b981',
                      fontSize: '0.85rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                        <CheckCircle2 size={16} />
                        Ảnh này an toàn (Sạch EXIF)
                      </div>
                      <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                        Không tìm thấy bất kỳ thông tin EXIF nhạy cảm hoặc định vị GPS nào trong tệp ảnh này. 
                        Bạn có thể trực tiếp chia sẻ ảnh này mà không cần lo lắng về quyền riêng tư.
                      </p>
                    </div>
                  )
                ) : null}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="card controls-panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
          <Sliders size={20} color="var(--accent)" />
          <h3 style={{ margin: 0 }}>Cấu hình đầu ra</h3>
        </div>

        {file && (
          <>
            <div className="input-group">
              <label>Định dạng ảnh sau khi làm sạch</label>
              <select 
                value={exportFormat} 
                onChange={(e) => {
                  setExportFormat(e.target.value as ExportFormat)
                  setResultURL('')
                }}
                disabled={processing}
              >
                <option value="jpeg">JPEG (Khuyên dùng - Ảnh chụp thực tế)</option>
                <option value="png">PNG (Giữ độ trong suốt - Kích thước lớn)</option>
                <option value="webp">WEBP (Tối ưu hóa dung lượng tốt nhất)</option>
              </select>
            </div>

            {exportFormat !== 'png' && (
              <div className="input-group">
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <label>Chất lượng nén (Quality)</label>
                  <span style={{ color: 'var(--accent-light)', fontWeight: 600 }}>{quality}%</span>
                </div>
                <input 
                  type="range" 
                  min="30" 
                  max="100" 
                  step="5" 
                  value={quality} 
                  onChange={(e) => {
                    setQuality(parseInt(e.target.value))
                    setResultURL('')
                  }}
                  disabled={processing}
                />
              </div>
            )}

            <div style={{ marginTop: 'auto', paddingTop: '1.5rem' }}>
              {resultURL ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    gap: '8px', 
                    color: '#10b981', 
                    background: 'rgba(16, 185, 129, 0.05)',
                    padding: '8px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid rgba(16, 185, 129, 0.2)'
                  }}>
                    <CheckCircle2 size={16} />
                    <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Đã xóa sạch Metadata EXIF!</span>
                  </div>

                  <a 
                    href={resultURL} 
                    download={resultName}
                    className="button" 
                    style={{ width: '100%' }}
                  >
                    <Download size={18} />
                    Tải ảnh sạch về ({(resultSize / 1024).toFixed(1)} KB)
                  </a>

                  <button 
                    onClick={stripMetadata} 
                    disabled={processing} 
                    className="button button-secondary"
                    style={{ width: '100%' }}
                  >
                    <RefreshCw size={18} />
                    Xử lý lại
                  </button>
                </div>
              ) : (
                <button 
                  onClick={stripMetadata} 
                  disabled={processing} 
                  className="button" 
                  style={{ width: '100%' }}
                >
                  {processing ? (
                    <>
                      <RefreshCw className="animate-spin" size={18} />
                      Đang xử lý {progress}%...
                    </>
                  ) : (
                    <>
                      <EyeOff size={18} />
                      Xóa Metadata & Tải về
                    </>
                  )}
                </button>
              )}
            </div>
          </>
        )}

        {!file && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.5, textAlign: 'center', padding: '2rem' }}>
            <Info size={24} style={{ marginBottom: '0.5rem' }} />
            <p>Tải ảnh lên ở khung bên trái để hiển thị tùy chọn làm sạch</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default MetadataStripper
