import { useState, useEffect, useRef } from 'react'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL } from '@ffmpeg/util'
import { 
  Video, 
  Layers, 
  RefreshCw, 
  Image as ImageIcon,
  Sparkles
} from 'lucide-react'

// Component Imports
import VideoToGif from './components/VideoToGif'
import GifMerger from './components/GifMerger'
import ImagesToGif from './components/ImagesToGif'
import ImageOptimizer from './components/ImageOptimizer'

type AppTab = 'video-to-gif' | 'gif-merger' | 'images-to-gif' | 'image-optimizer'

function App() {
  const [loaded, setLoaded] = useState(false)
  const [activeTab, setActiveTab] = useState<AppTab>('video-to-gif')
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  
  const ffmpegRef = useRef<FFmpeg | null>(null)

  useEffect(() => {
    loadFFmpeg()
  }, [])

  const loadFFmpeg = async () => {
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'
    const ffmpeg = new FFmpeg()
    ffmpegRef.current = ffmpeg

    ffmpeg.on('log', ({ message }) => {
      console.log(message)
    })

    ffmpeg.on('progress', ({ progress: p }) => {
      setProgress(Math.round(p * 100))
    })

    try {
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      })
      setLoaded(true)
    } catch (err) {
      console.error('Lỗi khi tải thư viện FFmpeg:', err)
      alert('Không thể tải thư viện xử lý FFmpeg. Vui lòng kiểm tra kết nối mạng hoặc thử lại bằng trình duyệt khác.')
    }
  }

  return (
    <div className="app-container">
      <header className="fade-in">
        <h1>GIF Studio Pro</h1>
        <p className="subtitle">Công cụ xử lý GIF tối ưu, chuyển đổi và gộp tệp mượt mà.</p>
      </header>

      <div className="tabs fade-in">
        <button 
          className={`tab-btn ${activeTab === 'video-to-gif' ? 'active' : ''}`} 
          onClick={() => setActiveTab('video-to-gif')}
          disabled={processing}
          title={processing ? 'Đang xử lý, vui lòng đợi...' : ''}
        >
          <Video size={18} />
          Video sang GIF
        </button>
        <button 
          className={`tab-btn ${activeTab === 'gif-merger' ? 'active' : ''}`} 
          onClick={() => setActiveTab('gif-merger')}
          disabled={processing}
          title={processing ? 'Đang xử lý, vui lòng đợi...' : ''}
        >
          <Layers size={18} />
          Gộp nhiều GIF
        </button>
        <button 
          className={`tab-btn ${activeTab === 'images-to-gif' ? 'active' : ''}`} 
          onClick={() => setActiveTab('images-to-gif')}
          disabled={processing}
          title={processing ? 'Đang xử lý, vui lòng đợi...' : ''}
        >
          <ImageIcon size={18} />
          Ảnh sang GIF
        </button>
        <button 
          className={`tab-btn ${activeTab === 'image-optimizer' ? 'active' : ''}`} 
          onClick={() => setActiveTab('image-optimizer')}
          disabled={processing}
          title={processing ? 'Đang xử lý, vui lòng đợi...' : ''}
        >
          <Sparkles size={18} />
          Tối ưu ảnh
        </button>
      </div>

      {!loaded ? (
        <div className="card" style={{ textAlign: 'center' }}>
          <RefreshCw className="animate-spin" style={{ margin: '0 auto 1rem' }} />
          <p>Đang tải FFmpeg WASM...</p>
        </div>
      ) : (
        <>
          {activeTab === 'video-to-gif' && (
            <VideoToGif
              ffmpegRef={ffmpegRef}
              processing={processing}
              setProcessing={setProcessing}
              progress={progress}
              setProgress={setProgress}
            />
          )}

          {activeTab === 'gif-merger' && (
            <GifMerger
              ffmpegRef={ffmpegRef}
              processing={processing}
              setProcessing={setProcessing}
              progress={progress}
              setProgress={setProgress}
            />
          )}

          {activeTab === 'images-to-gif' && (
            <ImagesToGif
              ffmpegRef={ffmpegRef}
              processing={processing}
              setProcessing={setProcessing}
              progress={progress}
              setProgress={setProgress}
            />
          )}

          {activeTab === 'image-optimizer' && (
            <ImageOptimizer
              ffmpegRef={ffmpegRef}
              processing={processing}
              setProcessing={setProcessing}
              progress={progress}
              setProgress={setProgress}
            />
          )}
        </>
      )}

      {processing && (
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
