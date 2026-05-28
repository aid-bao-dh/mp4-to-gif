import React, { useState } from 'react'
import { fetchFile } from '@ffmpeg/util'
import { 
  UploadCloud, 
  Download, 
  RefreshCw, 
  ChevronUp, 
  ChevronDown, 
  Trash2, 
  Info, 
  CheckCircle2, 
  Settings2,
  Image as ImageIcon
} from 'lucide-react'
import { getImageDimensions } from '../utils/media'

interface TabComponentProps {
  ffmpegRef: React.MutableRefObject<any>;
  processing: boolean;
  setProcessing: (p: boolean) => void;
  progress: number;
  setProgress: (p: number) => void;
}

interface MergeFile {
  file: File
  width: number
  height: number
  id: string
}

type AspectRatio = 'original' | '1:1' | '16:9' | '9:16' | 'custom'
type FitMode = 'contain' | 'cover'

const ImagesToGif: React.FC<TabComponentProps> = ({
  ffmpegRef,
  processing,
  setProcessing,
  progress,
  setProgress
}) => {
  const [imageFiles, setImageFiles] = useState<MergeFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [imageSettings, setImageSettings] = useState({
    fps: 2,
    aspectRatio: 'original' as AspectRatio,
    fitMode: 'contain' as FitMode,
    customWidth: 640,
    customHeight: 640
  })
  const [resultURL, setResultURL] = useState<string>('')

  const handleImageFilesChange = async (files: File[]) => {
    if (files.length > 0) {
      const newFiles: MergeFile[] = []
      for (const file of files) {
        if (!file.type.startsWith('image/')) {
          alert(`Tệp ${file.name} không phải là hình ảnh hợp lệ.`)
          continue
        }
        const dim = await getImageDimensions(file)
        newFiles.push({
          file,
          width: dim.width,
          height: dim.height,
          id: Math.random().toString(36).substring(2, 9)
        })
      }
      setImageFiles(prev => [...prev, ...newFiles])
      setResultURL('')
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
    await handleImageFilesChange(files)
  }

  const removeImageFile = (id: string) => setImageFiles(prev => prev.filter(f => f.id !== id))

  const moveImageFile = (index: number, direction: 'up' | 'down') => {
    const newFiles = [...imageFiles]
    const target = direction === 'up' ? index - 1 : index + 1
    if (target >= 0 && target < newFiles.length) {
      [newFiles[index], newFiles[target]] = [newFiles[target], newFiles[index]]
      setImageFiles(newFiles)
    }
  }

  const createGifFromImages = async () => {
    if (imageFiles.length < 1) return
    setProcessing(true)
    setProgress(0)
    const ffmpeg = ffmpegRef.current

    try {
      let targetW = 640
      let targetH = 640

      if (imageSettings.aspectRatio === 'original') {
        targetW = imageFiles[0].width
        targetH = imageFiles[0].height
      } else if (imageSettings.aspectRatio === '1:1') {
        targetW = 600; targetH = 600;
      } else if (imageSettings.aspectRatio === '16:9') {
        targetW = 640; targetH = 360;
      } else if (imageSettings.aspectRatio === '9:16') {
        targetW = 360; targetH = 640;
      } else if (imageSettings.aspectRatio === 'custom') {
        targetW = imageSettings.customWidth || 640
        targetH = imageSettings.customHeight || 640
      }

      targetW = Math.floor(targetW / 2) * 2
      targetH = Math.floor(targetH / 2) * 2

      for (let i = 0; i < imageFiles.length; i++) {
        const ext = imageFiles[i].file.name.split('.').pop() || 'png'
        await ffmpeg.writeFile(`img${i}.${ext}`, await fetchFile(imageFiles[i].file))
      }

      const args = []
      const duration = 1 / imageSettings.fps

      for (let i = 0; i < imageFiles.length; i++) {
        const ext = imageFiles[i].file.name.split('.').pop() || 'png'
        args.push('-loop', '1', '-t', duration.toString(), '-i', `img${i}.${ext}`)
      }

      let filter = ''
      for (let i = 0; i < imageFiles.length; i++) {
        if (imageSettings.fitMode === 'contain') {
          filter += `[${i}:v]scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease,pad=${targetW}:${targetH}:(ow-iw)/2:(oh-ih)/2,setsar=1/1,fps=${imageSettings.fps},setpts=PTS-STARTPTS[v${i}]; `
        } else {
          filter += `[${i}:v]scale=${targetW}:${targetH}:force_original_aspect_ratio=increase,crop=${targetW}:${targetH},setsar=1/1,fps=${imageSettings.fps},setpts=PTS-STARTPTS[v${i}]; `
        }
      }
      
      for (let i = 0; i < imageFiles.length; i++) filter += `[v${i}]`
      filter += `concat=n=${imageFiles.length}:v=1:a=0,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`

      args.push('-filter_complex', filter, 'img_out.gif')

      await ffmpeg.exec(args)
      const data = await ffmpeg.readFile('img_out.gif')
      setResultURL(URL.createObjectURL(new Blob([(data as any).buffer], { type: 'image/gif' })))
    } catch (e) { 
      console.error(e)
      alert('Lỗi khi ghép ảnh') 
    } finally { 
      setProcessing(false) 
    }
  }

  return (
    <div className="editor-grid fade-in">
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
          <ImageIcon size={20} color="var(--accent)" />
          <h3 style={{ margin: 0 }}>Danh sách Ảnh ({imageFiles.length})</h3>
        </div>
        
        {imageFiles.length === 0 ? (
          <label 
            className={`upload-zone ${isDragging ? 'dragging' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{ minHeight: '280px' }}
          >
            <div className="upload-icon-wrapper">
              <UploadCloud size={48} strokeWidth={1.5} color="var(--accent)" />
            </div>
            <div style={{ marginTop: '1rem' }}>
              <h3>Chọn các hình ảnh</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.5rem' }}>Hoặc kéo thả nhiều ảnh vào đây</p>
            </div>
            <input type="file" accept="image/*" multiple onChange={(e) => handleImageFilesChange(Array.from(e.target.files || []))} style={{ display: 'none' }} />
          </label>
        ) : (
          <div>
            <div className="file-list" style={{ maxHeight: '300px', overflowY: 'auto', paddingRight: '4px' }}>
              {imageFiles.map((f, i) => (
                <div key={f.id} className="file-item">
                  <div className="file-info">
                    <div className="file-name">{f.file.name}</div>
                    <div className="file-meta">
                      <Info size={12} style={{ marginRight: '4px' }} />
                      {f.width}x{f.height} • {(f.file.size/1024).toFixed(0)} KB
                    </div>
                  </div>
                  <div className="file-actions">
                    <button className="action-btn" onClick={() => moveImageFile(i, 'up')} disabled={i === 0} title="Di chuyển lên">
                      <ChevronUp size={16} />
                    </button>
                    <button className="action-btn" onClick={() => moveImageFile(i, 'down')} disabled={i === imageFiles.length - 1} title="Di chuyển xuống">
                      <ChevronDown size={16} />
                    </button>
                    <button className="action-btn delete" onClick={() => removeImageFile(f.id)} title="Xóa">
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
              <input type="file" accept="image/*" multiple onChange={(e) => handleImageFilesChange(Array.from(e.target.files || []))} style={{ display: 'none' }} />
            </label>
          </div>
        )}
      </div>

      <div className="card controls-panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
          <Settings2 size={20} color="var(--accent)" />
          <h3 style={{ margin: 0 }}>Cấu hình Ghép</h3>
        </div>
        
        <div className="input-group">
          <label>Tốc độ (FPS)</label>
          <select value={imageSettings.fps} onChange={e => setImageSettings(p => ({...p, fps: parseInt(e.target.value)}))}>
            <option value="1">1 FPS (1 giây/ảnh)</option>
            <option value="2">2 FPS (0.5 giây/ảnh)</option>
            <option value="5">5 FPS (0.2 giây/ảnh)</option>
            <option value="10">10 FPS (0.1 giây/ảnh)</option>
          </select>
        </div>

        <div className="input-group" style={{ marginTop: '1rem' }}>
          <label>Tỉ lệ khung hình (Ratio)</label>
          <select value={imageSettings.aspectRatio} onChange={e => setImageSettings(p => ({...p, aspectRatio: e.target.value as AspectRatio}))}>
            <option value="original">Theo ảnh đầu tiên</option>
            <option value="1:1">Vuông (1:1)</option>
            <option value="16:9">Ngang (16:9)</option>
            <option value="9:16">Dọc (9:16)</option>
            <option value="custom">Tùy chỉnh (Manual)</option>
          </select>
        </div>

        {imageSettings.aspectRatio === 'custom' && (
          <div className="settings-row fade-in" style={{ marginTop: '1rem' }}>
            <div className="input-group">
              <label>Width</label>
              <input type="number" value={imageSettings.customWidth} onChange={e => setImageSettings(p => ({...p, customWidth: parseInt(e.target.value)||0}))} />
            </div>
            <div className="input-group">
              <label>Height</label>
              <input type="number" value={imageSettings.customHeight} onChange={e => setImageSettings(p => ({...p, customHeight: parseInt(e.target.value)||0}))} />
            </div>
          </div>
        )}

        <div className="input-group" style={{ marginTop: '1rem' }}>
          <label>Chế độ khớp khung hình</label>
          <select value={imageSettings.fitMode} onChange={e => setImageSettings(p => ({...p, fitMode: e.target.value as FitMode}))}>
            <option value="contain">Chứa toàn bộ (Contain)</option>
            <option value="cover">Lấp đầy (Cover/Crop)</option>
          </select>
        </div>

        <div style={{ marginTop: 'auto' }}>
          {resultURL ? (
            <div style={{ textAlign: 'center' }} className="fade-in">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#10b981', marginBottom: '1rem' }}>
                <CheckCircle2 size={20} />
                <span style={{ fontWeight: 600 }}>Hoàn tất!</span>
              </div>
              <img src={resultURL} style={{ maxWidth: '100%', borderRadius: '8px', border: '1px solid var(--border-color)' }} />
              <div style={{ display: 'flex', gap: '12px', marginTop: '1.5rem' }}>
                <a href={resultURL} download="merged_images.gif" className="button" style={{ flex: 1 }}>
                  <Download size={18} />
                  Tải xuống
                </a>
                <button onClick={() => {setImageFiles([]); setResultURL('')}} className="button button-secondary">
                  <RefreshCw size={18} />
                  Làm lại
                </button>
              </div>
            </div>
          ) : (
            <button onClick={createGifFromImages} disabled={processing || imageFiles.length < 1} className="button" style={{ width: '100%' }}>
              {processing ? (
                <>
                  <RefreshCw className="animate-spin" size={18} />
                  Đang ghép {progress}%...
                </>
              ) : (
                <>
                  <ImageIcon size={18} />
                  Bắt đầu ghép
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default ImagesToGif
