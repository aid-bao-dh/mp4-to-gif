import React, { useState } from 'react'
import { fetchFile } from '@ffmpeg/util'
import { 
  Layers, 
  UploadCloud, 
  Download, 
  RefreshCw, 
  ChevronUp, 
  ChevronDown, 
  Trash2, 
  Info, 
  CheckCircle2, 
  Settings2 
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

const GifMerger: React.FC<TabComponentProps> = ({
  ffmpegRef,
  processing,
  setProcessing,
  progress,
  setProgress
}) => {
  const [mergeFiles, setMergeFiles] = useState<MergeFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [mergeSettings, setMergeSettings] = useState({
    aspectRatio: 'original' as AspectRatio,
    fitMode: 'contain' as FitMode,
    customWidth: 640,
    customHeight: 640
  })
  const [resultURL, setResultURL] = useState<string>('')

  const handleMergeFilesChange = async (files: File[]) => {
    if (files.length > 0) {
      const newMergeFiles: MergeFile[] = []
      for (const file of files) {
        const isGif = file.type === 'image/gif' || file.name.endsWith('.gif')
        if (!isGif) {
          alert(`Tệp ${file.name} không phải là tệp GIF hợp lệ.`)
          continue
        }
        const dim = await getImageDimensions(file)
        newMergeFiles.push({
          file,
          width: dim.width,
          height: dim.height,
          id: Math.random().toString(36).substring(2, 9)
        })
      }
      setMergeFiles(prev => [...prev, ...newMergeFiles])
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
    await handleMergeFilesChange(files)
  }

  const removeMergeFile = (id: string) => setMergeFiles(prev => prev.filter(f => f.id !== id))

  const moveMergeFile = (index: number, direction: 'up' | 'down') => {
    const newFiles = [...mergeFiles]
    const target = direction === 'up' ? index - 1 : index + 1
    if (target >= 0 && target < newFiles.length) {
      [newFiles[index], newFiles[target]] = [newFiles[target], newFiles[index]]
      setMergeFiles(newFiles)
    }
  }

  const mergeGifs = async () => {
    if (mergeFiles.length < 2) return
    setProcessing(true)
    setProgress(0)
    const ffmpeg = ffmpegRef.current

    try {
      // 1. Determine Target Dimensions
      let targetW = 640
      let targetH = 640

      if (mergeSettings.aspectRatio === 'original') {
        targetW = mergeFiles[0].width
        targetH = mergeFiles[0].height
      } else if (mergeSettings.aspectRatio === '1:1') {
        targetW = 600; targetH = 600;
      } else if (mergeSettings.aspectRatio === '16:9') {
        targetW = 640; targetH = 360;
      } else if (mergeSettings.aspectRatio === '9:16') {
        targetW = 360; targetH = 640;
      } else if (mergeSettings.aspectRatio === 'custom') {
        targetW = mergeSettings.customWidth || 640
        targetH = mergeSettings.customHeight || 640
      }

      targetW = Math.floor(targetW / 2) * 2
      targetH = Math.floor(targetH / 2) * 2

      // 2. Write Files
      for (let i = 0; i < mergeFiles.length; i++) {
        await ffmpeg.writeFile(`i${i}.gif`, await fetchFile(mergeFiles[i].file))
      }

      // 3. Build Filter
      let filter = ''
      for (let i = 0; i < mergeFiles.length; i++) {
        if (mergeSettings.fitMode === 'contain') {
          filter += `[${i}:v]scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease,pad=${targetW}:${targetH}:(ow-iw)/2:(oh-ih)/2,setsar=1/1,fps=10,setpts=PTS-STARTPTS[v${i}]; `
        } else {
          filter += `[${i}:v]scale=${targetW}:${targetH}:force_original_aspect_ratio=increase,crop=${targetW}:${targetH},setsar=1/1,fps=10,setpts=PTS-STARTPTS[v${i}]; `
        }
      }
      for (let i = 0; i < mergeFiles.length; i++) filter += `[v${i}]`
      filter += `concat=n=${mergeFiles.length}:v=1:a=0,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`

      const args = []
      for (let i = 0; i < mergeFiles.length; i++) args.push('-i', `i${i}.gif`)
      args.push('-filter_complex', filter, 'm.gif')

      await ffmpeg.exec(args)
      const data = await ffmpeg.readFile('m.gif')
      setResultURL(URL.createObjectURL(new Blob([(data as any).buffer], { type: 'image/gif' })))
    } catch (e) { 
      console.error(e)
      alert('Lỗi khi gộp tệp GIF') 
    } finally { 
      setProcessing(false) 
    }
  }

  return (
    <div className="editor-grid fade-in">
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
          <Layers size={20} color="var(--accent)" />
          <h3 style={{ margin: 0 }}>Danh sách GIF ({mergeFiles.length})</h3>
        </div>
        
        {mergeFiles.length === 0 ? (
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
              <h3>Chọn các tệp GIF</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.5rem' }}>Hoặc kéo thả nhiều tệp GIF vào đây</p>
            </div>
            <input type="file" accept="image/gif" multiple onChange={(e) => handleMergeFilesChange(Array.from(e.target.files || []))} style={{ display: 'none' }} />
          </label>
        ) : (
          <div>
            <div className="file-list" style={{ maxHeight: '300px', overflowY: 'auto', paddingRight: '4px' }}>
              {mergeFiles.map((f, i) => (
                <div key={f.id} className="file-item">
                  <div className="file-info">
                    <div className="file-name">{f.file.name}</div>
                    <div className="file-meta">
                      <Info size={12} style={{ marginRight: '4px' }} />
                      {f.width}x{f.height} • {(f.file.size/1024).toFixed(0)} KB
                    </div>
                  </div>
                  <div className="file-actions">
                    <button className="action-btn" onClick={() => moveMergeFile(i, 'up')} disabled={i === 0} title="Di chuyển lên">
                      <ChevronUp size={16} />
                    </button>
                    <button className="action-btn" onClick={() => moveMergeFile(i, 'down')} disabled={i === mergeFiles.length - 1} title="Di chuyển xuống">
                      <ChevronDown size={16} />
                    </button>
                    <button className="action-btn delete" onClick={() => removeMergeFile(f.id)} title="Xóa">
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
              <span>Thêm GIF hoặc kéo thả thêm tệp vào đây</span>
              <input type="file" accept="image/gif" multiple onChange={(e) => handleMergeFilesChange(Array.from(e.target.files || []))} style={{ display: 'none' }} />
            </label>
          </div>
        )}
      </div>

      <div className="card controls-panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
          <Settings2 size={20} color="var(--accent)" />
          <h3 style={{ margin: 0 }}>Cấu hình Gộp</h3>
        </div>
        
        <div className="input-group">
          <label>Tỉ lệ khung hình (Ratio)</label>
          <select value={mergeSettings.aspectRatio} onChange={e => setMergeSettings(p => ({...p, aspectRatio: e.target.value as AspectRatio}))}>
            <option value="original">Theo GIF đầu tiên</option>
            <option value="1:1">Vuông (1:1)</option>
            <option value="16:9">Ngang (16:9)</option>
            <option value="9:16">Dọc (9:16)</option>
            <option value="custom">Tùy chỉnh (Manual)</option>
          </select>
        </div>

        {mergeSettings.aspectRatio === 'custom' && (
          <div className="settings-row fade-in" style={{ marginTop: '1rem' }}>
            <div className="input-group">
              <label>Width</label>
              <input type="number" value={mergeSettings.customWidth} onChange={e => setMergeSettings(p => ({...p, customWidth: parseInt(e.target.value)||0}))} />
            </div>
            <div className="input-group">
              <label>Height</label>
              <input type="number" value={mergeSettings.customHeight} onChange={e => setMergeSettings(p => ({...p, customHeight: parseInt(e.target.value)||0}))} />
            </div>
          </div>
        )}

        <div className="input-group" style={{ marginTop: '1rem' }}>
          <label>Chế độ khớp khung hình</label>
          <select value={mergeSettings.fitMode} onChange={e => setMergeSettings(p => ({...p, fitMode: e.target.value as FitMode}))}>
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
                <a href={resultURL} download="merged.gif" className="button" style={{ flex: 1 }}>
                  <Download size={18} />
                  Tải xuống
                </a>
                <button onClick={() => {setMergeFiles([]); setResultURL('')}} className="button button-secondary">
                  <RefreshCw size={18} />
                  Làm lại
                </button>
              </div>
            </div>
          ) : (
            <button onClick={mergeGifs} disabled={processing || mergeFiles.length < 2} className="button" style={{ width: '100%' }}>
              {processing ? (
                <>
                  <RefreshCw className="animate-spin" size={18} />
                  Đang gộp {progress}%...
                </>
              ) : (
                <>
                  <Layers size={18} />
                  Bắt đầu gộp
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default GifMerger
