import React, { useState } from "react";
import { fetchFile } from "@ffmpeg/util";
import { UploadCloud, Download, RefreshCw, Info, CheckCircle2, Sliders, Sparkles, Crop, Pipette } from "lucide-react";
import { getImageDimensions } from "../utils/media";
import Pica from "pica";
import CropModal from "./CropModal";
import ColorKeyModal from "./ColorKeyModal";

const pica = Pica({ features: ["js", "wasm", "ww"] });

interface TabComponentProps {
  ffmpegRef: React.MutableRefObject<any>;
  processing: boolean;
  setProcessing: (p: boolean) => void;
  progress: number;
  setProgress: (p: number) => void;
}

const ImageOptimizer: React.FC<TabComponentProps> = ({ ffmpegRef, processing, setProcessing, progress, setProgress }) => {
  const [optFile, setOptFile] = useState<File | null>(null);
  const [optURL, setOptURL] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [isColorKeyModalOpen, setIsColorKeyModalOpen] = useState(false);

  const [optDimensions, setOptDimensions] = useState({ width: 0, height: 0 });
  const [optSettings, setOptSettings] = useState({
    scale: 80, // %
    quality: 80, // % (only for JPG/WEBP)
    fps: 0, // 0 = keep original, for GIF
    colors: 128, // for GIF
    format: "original" as "original" | "webp" | "jpeg" | "png",
    pngMode: "lossy" as "lossless" | "lossy",
  });
  const [optResultURL, setOptResultURL] = useState<string>("");
  const [optResultSize, setOptResultSize] = useState<number>(0);

  const isOptFileGif = optFile ? optFile.type === "image/gif" || optFile.name.endsWith(".gif") : false;
  const isOptFilePng = optFile ? optFile.type === "image/png" || optFile.name.endsWith(".png") : false;
  const isOptPngOutput = optFile ? optSettings.format === "png" || (optSettings.format === "original" && isOptFilePng) : false;

  const handleOptFileChange = async (file: File | undefined) => {
    if (file) {
      setOptFile(file);
      setOptURL(URL.createObjectURL(file));
      setOptResultURL("");
      setOptResultSize(0);
      setProgress(0);

      const dim = await getImageDimensions(file);
      setOptDimensions(dim);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (file.type.startsWith("image/")) {
        await handleOptFileChange(file);
      } else {
        alert("Vui lòng kéo thả tệp hình ảnh hợp lệ.");
      }
    }
  };

  const handleCropComplete = async (croppedFile: File) => {
    setOptFile(croppedFile);
    setOptURL(URL.createObjectURL(croppedFile));
    setOptResultURL("");
    setOptResultSize(0);
    setProgress(0);

    const dim = await getImageDimensions(croppedFile);
    setOptDimensions(dim);
  };

  const handleColorKeyComplete = async (processedFile: File) => {
    setOptFile(processedFile);
    setOptURL(URL.createObjectURL(processedFile));
    setOptResultURL("");
    setOptResultSize(0);
    setProgress(0);

    setOptSettings((prev) => ({
      ...prev,
      format: "png",
    }));

    const dim = await getImageDimensions(processedFile);
    setOptDimensions(dim);
  };

  const optimizeNormalImage = async () => {
    if (!optFile) return;
    try {
      setProgress(20);
      const img = new Image();
      const objectURL = URL.createObjectURL(optFile);

      img.onload = async () => {
        setProgress(50);
        const canvas = document.createElement("canvas");

        const newW = Math.max(1, Math.floor((optDimensions.width * optSettings.scale) / 100));
        const newH = Math.max(1, Math.floor((optDimensions.height * optSettings.scale) / 100));

        canvas.width = newW;
        canvas.height = newH;

        try {
          setProgress(60);
          
          const srcCanvas = document.createElement("canvas");
          srcCanvas.width = img.naturalWidth || optDimensions.width;
          srcCanvas.height = img.naturalHeight || optDimensions.height;
          const srcCtx = srcCanvas.getContext("2d");
          if (!srcCtx) {
            throw new Error("Không thể tạo context cho source canvas");
          }
          srcCtx.drawImage(img, 0, 0);

          await pica.resize(srcCanvas, canvas, {
            quality: 3,
          });
          setProgress(80);

          let mimeType = optFile.type;
          if (optSettings.format === "webp") mimeType = "image/webp";
          else if (optSettings.format === "jpeg") mimeType = "image/jpeg";
          else if (optSettings.format === "png") mimeType = "image/png";

          canvas.toBlob(
            (blob) => {
              if (blob) {
                setProgress(100);
                setOptResultSize(blob.size);
                setOptResultURL(URL.createObjectURL(blob));
              } else {
                alert("Lỗi tạo ảnh tối ưu");
              }
              URL.revokeObjectURL(objectURL);
              setProcessing(false);
            },
            mimeType,
            optSettings.quality / 100,
          );
        } catch (err) {
          console.error(err);
          alert("Lỗi tối ưu ảnh bằng pica");
          URL.revokeObjectURL(objectURL);
          setProcessing(false);
        }
      };

      img.onerror = () => {
        alert("Lỗi tải ảnh");
        URL.revokeObjectURL(objectURL);
        setProcessing(false);
      };

      img.src = objectURL;
    } catch (err) {
      console.error(err);
      alert("Lỗi tối ưu ảnh");
      setProcessing(false);
    }
  };

  const optimizeGif = async () => {
    if (!optFile) return;
    const ffmpeg = ffmpegRef.current;
    try {
      setProgress(10);
      await ffmpeg.writeFile("opt_input.gif", await fetchFile(optFile));
      setProgress(30);

      let newW = Math.max(2, Math.floor((optDimensions.width * optSettings.scale) / 100));
      newW = Math.floor(newW / 2) * 2;

      const fpsFilter = optSettings.fps > 0 ? `fps=${optSettings.fps},` : "";
      const filter = `${fpsFilter}scale=${newW}:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=${optSettings.colors}[p];[s1][p]paletteuse`;

      await ffmpeg.exec(["-i", "opt_input.gif", "-vf", filter, "opt_output.gif"]);
      setProgress(90);

      const data = await ffmpeg.readFile("opt_output.gif");
      const blob = new Blob([(data as any).buffer], { type: "image/gif" });

      setOptResultSize(blob.size);
      setOptResultURL(URL.createObjectURL(blob));
      setProgress(100);
    } catch (err) {
      console.error(err);
      alert("Lỗi tối ưu ảnh GIF");
    } finally {
      setProcessing(false);
    }
  };

  const optimizePngViaFfmpeg = async () => {
    if (!optFile) return;
    const ffmpeg = ffmpegRef.current;
    try {
      setProgress(10);
      await ffmpeg.writeFile("opt_input.png", await fetchFile(optFile));
      setProgress(30);

      let newW = Math.max(2, Math.floor((optDimensions.width * optSettings.scale) / 100));
      newW = Math.floor(newW / 2) * 2;

      const scaleFilter = `scale=${newW}:-1:flags=lanczos`;

      if (optSettings.pngMode === "lossy") {
        const filter = `${scaleFilter},split[s0][s1];[s0]palettegen=max_colors=256[p];[s1][p]paletteuse`;
        await ffmpeg.exec(["-i", "opt_input.png", "-vf", filter, "opt_output.png"]);
      } else {
        await ffmpeg.exec(["-i", "opt_input.png", "-vf", scaleFilter, "-compression_level", "9", "opt_output.png"]);
      }
      setProgress(90);

      const data = await ffmpeg.readFile("opt_output.png");
      const blob = new Blob([(data as any).buffer], { type: "image/png" });

      setOptResultSize(blob.size);
      setOptResultURL(URL.createObjectURL(blob));
      setProgress(100);
    } catch (err) {
      console.error(err);
      alert("Lỗi tối ưu ảnh PNG bằng FFmpeg");
    } finally {
      setProcessing(false);
    }
  };

  const optimizeImage = async () => {
    if (!optFile) return;
    setProcessing(true);
    setProgress(0);

    if (isOptFileGif) {
      await optimizeGif();
    } else if (isOptPngOutput) {
      await optimizePngViaFfmpeg();
    } else {
      await optimizeNormalImage();
    }
  };

  return (
    <div className="editor-grid fade-in">
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "1rem" }}>
          <Sparkles size={20} color="var(--accent)" />
          <h3 style={{ margin: 0 }}>So sánh dung lượng</h3>
        </div>

        {!optFile ? (
          <label className={`upload-zone ${isDragging ? "dragging" : ""}`} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} style={{ minHeight: "300px" }}>
            <div className="upload-icon-wrapper">
              <UploadCloud size={48} strokeWidth={1.5} color="var(--accent)" />
            </div>
            <div style={{ marginTop: "1rem" }}>
              <h3>Chọn ảnh gốc (PNG, JPG, WEBP hoặc GIF)</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginTop: "0.5rem" }}>Hoặc kéo thả hình ảnh vào đây để bắt đầu</p>
            </div>
            <input type="file" accept="image/*" onChange={(e) => handleOptFileChange(e.target.files?.[0])} style={{ display: "none" }} />
          </label>
        ) : (
          <div>
            <div className="compare-container">
              {/* Before */}
              <div className="compare-box">
                <span className="badge-label before">Ảnh Gốc</span>
                <div className="preview-img-wrapper">
                  <img src={optURL} alt="Original preview" />
                </div>

                <div className="image-tools-row">
                  <button type="button" className="tool-btn" onClick={() => setIsCropModalOpen(true)} disabled={processing} title="Cắt ảnh">
                    <Crop size={14} />
                    Cắt ảnh
                  </button>
                  <button type="button" className="tool-btn primary-tool" onClick={() => setIsColorKeyModalOpen(true)} disabled={processing || isOptFileGif} title={isOptFileGif ? "Không hỗ trợ xóa nền tệp GIF" : "Xóa nền đơn sắc của Logo/Icon"}>
                    <Pipette size={14} />
                    Xóa nền Logo
                  </button>
                </div>

                <div className="compare-info" style={{ marginTop: "0.5rem" }}>
                  <div className="file-name" style={{ maxWidth: "180px" }}>
                    {optFile.name}
                  </div>
                  <div className="compare-size">{(optFile.size / 1024).toFixed(1)} KB</div>
                  <div className="file-meta">
                    {optDimensions.width}x{optDimensions.height}
                  </div>
                </div>
              </div>

              {/* After */}
              <div className="compare-box optimized">
                <span className="badge-label after">Ảnh Tối Ưu</span>
                {optResultURL && (
                  <div className="saving-badge" style={{ backgroundColor: optResultSize > optFile.size ? "#ef4444" : "#10b981", boxShadow: optResultSize > optFile.size ? "0 4px 12px rgba(239, 68, 68, 0.4)" : "0 4px 12px rgba(16, 185, 129, 0.4)" }}>
                    {optResultSize > optFile.size ? "+" : "-"}
                    {Math.abs(((optResultSize - optFile.size) / optFile.size) * 100).toFixed(0)}%
                  </div>
                )}
                <div className="preview-img-wrapper">
                  {optResultURL ? <img src={optResultURL} alt="Optimized preview" /> : <div style={{ color: "var(--text-muted)", fontSize: "0.9rem", textAlign: "center", padding: "1rem" }}>{processing ? "Đang tối ưu hóa ảnh..." : "Thiết lập thông số bên phải và nhấn nút Tối ưu ngay"}</div>}
                </div>
                <div className="compare-info">
                  {optResultURL ? (
                    <>
                      <div className="file-name" style={{ maxWidth: "180px" }}>
                        {optFile.name.substring(0, optFile.name.lastIndexOf(".")) + (optSettings.format === "original" ? optFile.name.substring(optFile.name.lastIndexOf(".")) : `.${optSettings.format}`)}
                      </div>
                      <div className="compare-size" style={{ color: "#10b981" }}>
                        {(optResultSize / 1024).toFixed(1)} KB
                      </div>
                      <div className="file-meta">
                        {Math.max(1, Math.floor((optDimensions.width * optSettings.scale) / 100))}x{Math.max(1, Math.floor((optDimensions.height * optSettings.scale) / 100))}
                      </div>
                    </>
                  ) : (
                    <div style={{ opacity: 0.5 }}>Chưa có kết quả</div>
                  )}
                </div>
              </div>
            </div>

            {optResultURL && optResultSize > optFile.size && (
              <div
                style={{
                  marginTop: "1.5rem",
                  padding: "1rem",
                  background: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid rgba(239, 68, 68, 0.2)",
                  borderRadius: "var(--radius-md)",
                  display: "flex",
                  gap: "10px",
                  alignItems: "flex-start",
                  fontSize: "0.875rem",
                  color: "#fca5a5",
                  textAlign: "left",
                }}
              >
                <Info size={18} style={{ flexShrink: 0, marginTop: "2px", color: "#f87171" }} />
                <div>
                  <strong>Lưu ý:</strong> Định dạng PNG nén không tổn hao (lossless) mặc định của trình duyệt thường có dung lượng lớn hơn ảnh gốc đã được tối ưu hóa. Hãy thử chuyển <strong>Định dạng đầu ra thành WEBP hoặc JPEG</strong> để giảm dung lượng tốt nhất.
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: "12px", marginTop: "1.5rem" }}>
              <button
                onClick={() => {
                  setOptFile(null);
                  setOptURL("");
                  setOptResultURL("");
                  setOptResultSize(0);
                }}
                className="button button-secondary"
                style={{ flex: 1 }}
                disabled={processing}
              >
                Chọn ảnh khác
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="card controls-panel">
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "1rem" }}>
          <Sliders size={20} color="var(--accent)" />
          <h3 style={{ margin: 0 }}>Cấu hình Tối ưu</h3>
        </div>

        {optFile && (
          <>
            {/* Scale Option */}
            <div className="input-group">
              <label style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Tỉ lệ kích thước (Scale)</span>
                <span style={{ color: "var(--accent)", fontWeight: 600 }}>{optSettings.scale}%</span>
              </label>
              <input type="range" min="1" max="100" step="1" value={optSettings.scale} onChange={(e) => setOptSettings((p) => ({ ...p, scale: parseInt(e.target.value) }))} disabled={processing} />
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                Kích thước mới: {Math.max(1, Math.floor((optDimensions.width * optSettings.scale) / 100))} x {Math.max(1, Math.floor((optDimensions.height * optSettings.scale) / 100))} px
              </span>
            </div>

            {/* Check if GIF */}
            {isOptFileGif ? (
              <>
                {/* GIF FPS Option */}
                <div className="input-group" style={{ marginTop: "1rem" }}>
                  <label>Tốc độ khung hình (FPS)</label>
                  <select value={optSettings.fps} onChange={(e) => setOptSettings((p) => ({ ...p, fps: parseInt(e.target.value) }))} disabled={processing}>
                    <option value="0">Giữ nguyên FPS</option>
                    <option value="5">5 FPS</option>
                    <option value="10">10 FPS</option>
                    <option value="12">12 FPS</option>
                    <option value="15">15 FPS</option>
                    <option value="20">20 FPS</option>
                  </select>
                </div>

                {/* GIF Color Palette Count Option */}
                <div className="input-group" style={{ marginTop: "1rem" }}>
                  <label style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>Số màu bảng màu (Palette)</span>
                    <span style={{ color: "var(--accent)", fontWeight: 600 }}>{optSettings.colors} màu</span>
                  </label>
                  <select value={optSettings.colors} onChange={(e) => setOptSettings((p) => ({ ...p, colors: parseInt(e.target.value) }))} disabled={processing}>
                    <option value="256">256 màu (Chất lượng nhất)</option>
                    <option value="128">128 màu</option>
                    <option value="64">64 màu</option>
                    <option value="32">32 màu</option>
                    <option value="16">16 màu (Dung lượng siêu nhỏ)</option>
                  </select>
                </div>
              </>
            ) : (
              <>
                {/* Output Format */}
                <div className="input-group" style={{ marginTop: "1rem" }}>
                  <label>Định dạng đầu ra (Format)</label>
                  <select value={optSettings.format} onChange={(e) => setOptSettings((p) => ({ ...p, format: e.target.value as any }))} disabled={processing}>
                    <option value="original">Giữ nguyên định dạng gốc</option>
                    <option value="webp">WEBP (Khuyên dùng - tối ưu nhất)</option>
                    <option value="jpeg">JPEG (Phổ biến)</option>
                    <option value="png">PNG (Trong suốt)</option>
                  </select>
                  {optFile && isOptFilePng && optSettings.format === "original" && <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px" }}>💡 Sử dụng bộ giải mã FFmpeg để nén tối ưu ảnh PNG.</span>}
                </div>

                {/* PNG specific controls */}
                {isOptPngOutput ? (
                  <div className="input-group" style={{ marginTop: "1rem" }}>
                    <label>Phương thức nén PNG</label>
                    <select value={optSettings.pngMode} onChange={(e) => setOptSettings((p) => ({ ...p, pngMode: e.target.value as any }))} disabled={processing}>
                      <option value="lossy">Nén có tổn hao (PNG-8, tương tự TinyPNG - Khuyên dùng)</option>
                      <option value="lossless">Nén không tổn hao (PNG-24, chất lượng tối đa)</option>
                    </select>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px", display: "block" }}>
                      {optSettings.pngMode === "lossy" ? "💡 Giảm dung lượng tới 70-80% bằng cách giảm màu sắc (256 màu), bảo toàn độ trong suốt." : "💡 Giữ nguyên chất lượng ảnh tuyệt đối, nén sâu bằng thuật toán zlib-9."}
                    </span>
                  </div>
                ) : (
                  /* Quality Option - Only for JPG and WEBP */
                  optSettings.format !== "png" && (
                    <div className="input-group" style={{ marginTop: "1rem" }}>
                      <label style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>Chất lượng nén (Quality)</span>
                        <span style={{ color: "var(--accent)", fontWeight: 600 }}>{optSettings.quality}%</span>
                      </label>
                      <input type="range" min="1" max="100" step="1" value={optSettings.quality} onChange={(e) => setOptSettings((p) => ({ ...p, quality: parseInt(e.target.value) }))} disabled={processing} />
                    </div>
                  )
                )}
              </>
            )}

            <div style={{ marginTop: "auto", paddingTop: "1.5rem" }}>
              {optResultURL ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", color: "#10b981", marginBottom: "0.5rem" }}>
                    <CheckCircle2 size={20} />
                    <span style={{ fontWeight: 600 }}>Tối ưu hoàn tất!</span>
                  </div>

                  <a href={optResultURL} download={optFile.name.substring(0, optFile.name.lastIndexOf(".")) + (optSettings.format === "original" ? optFile.name.substring(optFile.name.lastIndexOf(".")) : `.${optSettings.format}`)} className="button" style={{ width: "100%" }}>
                    <Download size={18} />
                    Tải xuống ảnh
                  </a>

                  <button onClick={optimizeImage} disabled={processing} className="button button-secondary" style={{ width: "100%" }}>
                    <RefreshCw size={18} />
                    Tối ưu lại
                  </button>
                </div>
              ) : (
                <button onClick={optimizeImage} disabled={processing} className="button" style={{ width: "100%" }}>
                  {processing ? (
                    <>
                      <RefreshCw className="animate-spin" size={18} />
                      Đang xử lý {progress}%...
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} />
                      Tối ưu ngay
                    </>
                  )}
                </button>
              )}
            </div>
          </>
        )}

        {!optFile && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", opacity: 0.5, textAlign: "center", padding: "2rem" }}>
            <Info size={24} style={{ marginBottom: "0.5rem" }} />
            <p>Hãy tải ảnh lên trước để bắt đầu cấu hình tối ưu</p>
          </div>
        )}
      </div>

      {isCropModalOpen && optFile && <CropModal imageSrc={optURL} fileName={optFile.name} onClose={() => setIsCropModalOpen(false)} onCropComplete={handleCropComplete} />}

      {isColorKeyModalOpen && optFile && <ColorKeyModal imageSrc={optURL} fileName={optFile.name} onClose={() => setIsColorKeyModalOpen(false)} onComplete={handleColorKeyComplete} />}
    </div>
  );
};

export default ImageOptimizer;
