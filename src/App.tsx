import { useState, useEffect, useRef } from 'react'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'
import { 
  Video, 
  Layers, 
  UploadCloud, 
  Rocket, 
  Download, 
  RefreshCw, 
  Trash2, 
  ChevronUp, 
  ChevronDown,
  Info,
  CheckCircle2,
  FileVideo,
  Settings2,
  Image as ImageIcon
} from 'lucide-react'

// Types
interface VideoSettings {
  start: number
  end: number
  width: number
  fps: number
  duration: number
}

interface MergeFile {
  file: File
  width: number
  height: number
  id: string
}

type AppTab = 'video-to-gif' | 'gif-merger' | 'images-to-gif'
type AspectRatio = 'original' | '1:1' | '16:9' | '9:16' | 'custom'
type FitMode = 'contain' | 'cover'

function App() {
  const [loaded, setLoaded] = useState(false)
  const [activeTab, setActiveTab] = useState<AppTab>('video-to-gif')
  
  // Video to GIF states
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoURL, setVideoURL] = useState<string>('')
  const [settings, setSettings] = useState<VideoSettings>({
    start: 0,
    end: 0,
    width: 640,
    fps: 10,
    duration: 0
  })

  // GIF Merger states
  const [mergeFiles, setMergeFiles] = useState<MergeFile[]>([])
  const [mergeSettings, setMergeSettings] = useState({
    aspectRatio: 'original' as AspectRatio,
    fitMode: 'contain' as FitMode,
    customWidth: 640,
    customHeight: 640
  })

  // Images to GIF states
  const [imageFiles, setImageFiles] = useState<MergeFile[]>([])
  const [imageSettings, setImageSettings] = useState({
    fps: 2,
    aspectRatio: 'original' as AspectRatio,
    fitMode: 'contain' as FitMode,
    customWidth: 640,
    customHeight: 640
  })
  
  // Common states
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [resultURL, setResultURL] = useState<string>('')

  const ffmpegRef = useRef(new FFmpeg())
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    if (!window.crossOriginIsolated) {
      console.warn('Cross-Origin Isolation is not enabled.')
    }

    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'
    const ffmpeg = ffmpegRef.current
    
    ffmpeg.on('log', ({ message }) => console.log(message))
    ffmpeg.on('progress', ({ progress }) => setProgress(Math.round(progress * 100)))

    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    })
    setLoaded(true)
  }

  // --- Helpers ---
  const getImageDimensions = (file: File): Promise<{width: number, height: number}> => {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight })
        URL.revokeObjectURL(url)
      }
      img.onerror = () => {
        resolve({ width: 640, height: 640 }) // Default fallback
        URL.revokeObjectURL(url)
      }
      img.src = url
    })
  }

  // --- Handlers for Video to GIF ---
  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) {
      setVideoFile(file)
      setVideoURL(URL.createObjectURL(file))
      setResultURL('')
      setProgress(0)
    }
  }

  const handleVideoLoad = () => {
    if (videoRef.current) {
      const duration = videoRef.current.duration
      setSettings(prev => ({
        ...prev,
        end: duration,
        duration: duration,
        width: videoRef.current?.videoWidth || 640
      }))
    }
  }

  const convertToGif = async () => {
    if (!videoFile) return
    setProcessing(true)
    setProgress(0)
    const ffmpeg = ffmpegRef.current
    try {
      await ffmpeg.writeFile('input.mp4', await fetchFile(videoFile))
      const filter = `fps=${settings.fps},scale=${settings.width}:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`
      await ffmpeg.exec(['-ss', settings.start.toString(), '-to', settings.end.toString(), '-i', 'input.mp4', '-vf', filter, 'output.gif'])
      const data = await ffmpeg.readFile('output.gif')
      setResultURL(URL.createObjectURL(new Blob([(data as any).buffer], { type: 'image/gif' })))
    } catch (e) { alert('Lỗi chuyển đổi') } finally { setProcessing(false) }
  }

  // --- Handlers for GIF Merger ---
  const handleMergeFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (files.length > 0) {
      const newMergeFiles: MergeFile[] = []
      for (const file of files) {
        const dim = await getImageDimensions(file)
        newMergeFiles.push({
          file,
          width: dim.width,
          height: dim.height,
          id: Math.random().toString(36).substr(2, 9)
        })
      }
      setMergeFiles(prev => [...prev, ...newMergeFiles])
      setResultURL('')
    }
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
    } catch (e) { console.error(e); alert('Lỗi khi gộp') } finally { setProcessing(false) }
  }

  // --- Handlers for Images to GIF ---
  const handleImageFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (files.length > 0) {
      const newFiles: MergeFile[] = []
      for (const file of files) {
        const dim = await getImageDimensions(file)
        newFiles.push({
          file,
          width: dim.width,
          height: dim.height,
          id: Math.random().toString(36).substr(2, 9)
        })
      }
      setImageFiles(prev => [...prev, ...newFiles])
      setResultURL('')
    }
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
    } catch (e) { console.error(e); alert('Lỗi khi ghép ảnh') } finally { setProcessing(false) }
  }

  const formatTime = (s: number) => `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}.${Math.floor((s%1)*10)}`

  return (
    <div className="app-container">
      <header className="fade-in">
        <h1>GIF Studio Pro</h1>
        <p className="subtitle">Công cụ xử lý GIF tối ưu, chuyển đổi và gộp tệp mượt mà.</p>
      </header>

      <div className="tabs fade-in">
        <button 
          className={`tab-btn ${activeTab === 'video-to-gif' ? 'active' : ''}`} 
          onClick={() => {setActiveTab('video-to-gif'); setResultURL('')}}
        >
          <Video size={18} />
          Video sang GIF
        </button>
        <button 
          className={`tab-btn ${activeTab === 'gif-merger' ? 'active' : ''}`} 
          onClick={() => {setActiveTab('gif-merger'); setResultURL('')}}
        >
          <Layers size={18} />
          Gộp nhiều GIF
        </button>
        <button 
          className={`tab-btn ${activeTab === 'images-to-gif' ? 'active' : ''}`} 
          onClick={() => {setActiveTab('images-to-gif'); setResultURL('')}}
        >
          <ImageIcon size={18} />
          Ảnh sang GIF
        </button>
      </div>

      {!loaded ? (
        <div className="card" style={{ textAlign: 'center' }}>
          <RefreshCw className="animate-spin" style={{ margin: '0 auto 1rem' }} />
          <p>Đang tải FFmpeg WASM...</p>
        </div>
      ) : (
        <>
          {activeTab === 'video-to-gif' ? (
            !videoFile ? (
              <div className="card fade-in">
                <label className="upload-zone">
                  <div className="upload-icon-wrapper">
                    <UploadCloud size={48} strokeWidth={1.5} color="var(--accent)" />
                  </div>
                  <div style={{ marginTop: '1rem' }}>
                    <h3>Chọn video MP4</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.5rem' }}>Hoặc kéo thả tệp vào đây</p>
                  </div>
                  <input type="file" accept="video/mp4" onChange={handleVideoFileChange} style={{ display: 'none' }} />
                </label>
              </div>
            ) : (
              <div className="editor-grid fade-in">
                <div className="card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                    <FileVideo size={20} color="var(--accent)" />
                    <h3 style={{ margin: 0 }}>Preview & Cắt</h3>
                  </div>
                  <div className="video-preview-wrapper" style={{ margin: '1rem 0' }}>
                    <video ref={videoRef} src={videoURL} controls onLoadedMetadata={handleVideoLoad} />
                  </div>
                  <div className="input-group">
                    <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Phạm vi thời gian</span>
                      <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{formatTime(settings.start)} - {formatTime(settings.end)}</span>
                    </label>
                    <input type="range" min="0" max={settings.duration} step="0.1" value={settings.start} onChange={e => setSettings(p => ({...p, start: parseFloat(e.target.value)}))} />
                    <input type="range" min="0" max={settings.duration} step="0.1" value={settings.end} onChange={e => setSettings(p => ({...p, end: parseFloat(e.target.value)}))} />
                  </div>
                </div>
                <div className="card controls-panel">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                    <Settings2 size={20} color="var(--accent)" />
                    <h3 style={{ margin: 0 }}>Cấu hình</h3>
                  </div>
                  <div className="settings-row">
                    <div className="input-group">
                      <label>Chiều rộng (px)</label>
                      <input type="number" value={settings.width} onChange={e => setSettings(p => ({...p, width: parseInt(e.target.value)||0}))} />
                    </div>
                    <div className="input-group">
                      <label>Tốc độ (FPS)</label>
                      <select value={settings.fps} onChange={e => setSettings(p => ({...p, fps: parseInt(e.target.value)}))}>
                        <option value="10">10 FPS</option>
                        <option value="15">15 FPS</option>
                        <option value="24">24 FPS</option>
                      </select>
                    </div>
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
                          <a href={resultURL} download="result.gif" className="button" style={{ flex: 1 }}>
                            <Download size={18} />
                            Tải xuống
                          </a>
                          <button onClick={() => {setVideoFile(null); setResultURL('')}} className="button button-secondary">
                            <RefreshCw size={18} />
                            Làm lại
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={convertToGif} disabled={processing} className="button" style={{ width: '100%' }}>
                        {processing ? (
                          <>
                            <RefreshCw className="animate-spin" size={18} />
                            Đang xử lý {progress}%...
                          </>
                        ) : (
                          <>
                            <Rocket size={18} />
                            Chuyển đổi ngay
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          ) : activeTab === 'gif-merger' ? (
            /* GIF Merger Tab Enhanced with Lucide */
            <div className="editor-grid fade-in">
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                  <Layers size={20} color="var(--accent)" />
                  <h3 style={{ margin: 0 }}>Danh sách GIF ({mergeFiles.length})</h3>
                </div>
                <div className="file-list">
                  {mergeFiles.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>
                      <p>Chưa có tệp nào được chọn</p>
                    </div>
                  ) : (
                    mergeFiles.map((f, i) => (
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
                    ))
                  )}
                </div>
                <label className="button button-secondary" style={{ width: '100%', marginTop: '1.5rem', cursor: 'pointer' }}>
                  <UploadCloud size={18} />
                  Thêm tệp GIF
                  <input type="file" accept="image/gif" multiple onChange={handleMergeFilesChange} style={{ display: 'none' }} />
                </label>
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
          ) : (
            /* Images to GIF Tab */
            <div className="editor-grid fade-in">
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                  <ImageIcon size={20} color="var(--accent)" />
                  <h3 style={{ margin: 0 }}>Danh sách Ảnh ({imageFiles.length})</h3>
                </div>
                <div className="file-list">
                  {imageFiles.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>
                      <p>Chưa có tệp nào được chọn</p>
                    </div>
                  ) : (
                    imageFiles.map((f, i) => (
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
                    ))
                  )}
                </div>
                <label className="button button-secondary" style={{ width: '100%', marginTop: '1.5rem', cursor: 'pointer' }}>
                  <UploadCloud size={18} />
                  Thêm ảnh (JPG, PNG...)
                  <input type="file" accept="image/*" multiple onChange={handleImageFilesChange} style={{ display: 'none' }} />
                </label>
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
          )}
        </>
      )}

      {processing && !resultURL && (
        <div className="progress-container fade-in" style={{ marginTop: '1.5rem' }}>
          <div className="progress-bar" style={{ width: `${progress}%` }}></div>
        </div>
      )}

      <footer style={{ marginTop: 'auto', padding: '2rem 0', textAlign: 'center', opacity: 0.5, fontSize: '0.8rem' }}>
        Built with FFmpeg.wasm • ✨ 100% Client-side & Secure
      </footer>
    </div>
  )
}

export default App
