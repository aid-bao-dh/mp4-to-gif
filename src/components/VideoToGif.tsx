import React, { useState, useRef } from 'react'
import { fetchFile } from '@ffmpeg/util'
import { 
  UploadCloud, 
  Rocket, 
  Download, 
  RefreshCw, 
  CheckCircle2, 
  FileVideo, 
  Settings2 
} from 'lucide-react'

interface TabComponentProps {
  ffmpegRef: React.MutableRefObject<any>;
  processing: boolean;
  setProcessing: (p: boolean) => void;
  progress: number;
  setProgress: (p: number) => void;
}

interface VideoSettings {
  start: number
  end: number
  width: number
  fps: number
  duration: number
}

const VideoToGif: React.FC<TabComponentProps> = ({
  ffmpegRef,
  processing,
  setProcessing,
  progress,
  setProgress
}) => {
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoURL, setVideoURL] = useState<string>('')
  const [isDragging, setIsDragging] = useState(false)
  const [settings, setSettings] = useState<VideoSettings>({
    start: 0,
    end: 0,
    width: 640,
    fps: 10,
    duration: 0
  })
  const [resultURL, setResultURL] = useState<string>('')
  const videoRef = useRef<HTMLVideoElement>(null)

  const handleVideoFileChange = (file: File | undefined) => {
    if (file) {
      setVideoFile(file)
      setVideoURL(URL.createObjectURL(file))
      setResultURL('')
      setProgress(0)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      if (file.type === 'video/mp4' || file.name.endsWith('.mp4')) {
        handleVideoFileChange(file)
      } else {
        alert('Vui lòng kéo thả tệp video MP4 hợp lệ.')
      }
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
    const ffmpeg = ffmpegRef.current
    setProcessing(true)
    setProgress(0)

    try {
      setProgress(10)
      await ffmpeg.writeFile('input.mp4', await fetchFile(videoFile))
      setProgress(30)

      const startStr = settings.start.toString()
      const durationStr = (settings.end - settings.start).toString()
      const width = Math.floor(settings.width / 2) * 2

      await ffmpeg.exec([
        '-ss', startStr,
        '-t', durationStr,
        '-i', 'input.mp4',
        '-vf', `fps=${settings.fps},scale=${width}:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`,
        '-f', 'gif',
        'output.gif'
      ])

      setProgress(90)
      const data = await ffmpeg.readFile('output.gif')
      setResultURL(URL.createObjectURL(new Blob([(data as any).buffer], { type: 'image/gif' })))
      setProgress(100)
    } catch (e) {
      console.error(e)
      alert('Lỗi chuyển đổi video')
    } finally {
      setProcessing(false)
    }
  }

  const formatTime = (s: number) => `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}.${Math.floor((s%1)*10)}`

  return (
    !videoFile ? (
      <div className="card fade-in">
        <label 
          className={`upload-zone ${isDragging ? 'dragging' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="upload-icon-wrapper">
            <UploadCloud size={48} strokeWidth={1.5} color="var(--accent)" />
          </div>
          <div style={{ marginTop: '1rem' }}>
            <h3>Chọn video MP4</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.5rem' }}>Hoặc kéo thả tệp vào đây</p>
          </div>
          <input type="file" accept="video/mp4" onChange={(e) => handleVideoFileChange(e.target.files?.[0])} style={{ display: 'none' }} />
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
  )
}

export default VideoToGif
