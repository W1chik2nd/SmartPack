import { useRef, useState } from "react";
import { analyzePersonalColor } from "../api";
import { toDataUrl } from "../lib/image";
import "./PersonalColorGuide.css";

type Props = { onClose: () => void; onSeasonDetected: (season: string) => void };

export default function PersonalColorGuide({ onClose, onSeasonDetected }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [photoName, setPhotoName] = useState("");
  const [image, setImage] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function selectPhoto(file: File | undefined) {
    if (!file) return;
    setError("");
    setAnalysis("");
    try {
      setImage(await toDataUrl(file));
      setPhotoName(file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "无法读取图片");
    }
  }

  async function startAnalysis() {
    if (!image) return;
    setBusy(true);
    setError("");
    try {
      const result = await analyzePersonalColor(image);
      setAnalysis(result.analysis);
      if (result.season) onSeasonDetected(result.season);
    } catch (err) {
      setError(err instanceof Error ? err.message : "分析失败，请稍后重试");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="color-guide-overlay" role="presentation" onMouseDown={onClose}>
      <section className="color-guide" role="dialog" aria-modal="true" aria-labelledby="color-guide-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="color-guide-header">
          <div><p className="color-guide-kicker">PERSONAL COLOR ANALYSIS</p><h2 id="color-guide-title">不知道自己的四季型？</h2></div>
          <button type="button" className="color-guide-close" onClick={onClose} aria-label="关闭问卷">×</button>
        </header>
        <div className="color-guide-content">
          <p className="color-guide-intro">上传一张真人照片，让专业形象顾问分析你的个人色彩，再回来选择最适合的四季型。</p>
          <label className="color-guide-upload">
            <input ref={inputRef} type="file" accept="image/*" onChange={(event) => selectPhoto(event.target.files?.[0])} />
            {image ? <img src={image} alt="待分析的真人照片预览" /> : <strong aria-hidden="true">＋</strong>}
            <span>{photoName || "上传真人照片"}</span>
            <small>{photoName ? "照片已选择，可以开始分析" : "建议正面、素颜、自然光，避免滤镜"}</small>
          </label>
          {!analysis && <div className="color-guide-prompt">
            <p>分析将覆盖：</p>
            <ul>
              <li>肤色冷暖调与春夏秋冬四季型</li><li>肤色明度、饱和度、五官对比度、头发与瞳孔颜色</li>
              <li>服装、妆容、口红色号、发色与配饰金属方向</li><li>最显白、最容易显脏显黑的颜色，以及整体气质关键词</li>
            </ul>
          </div>}
          {error && <p className="color-guide-error" role="alert">{error}</p>}
          {analysis && <div className="color-guide-result" role="status"><h3>你的个人色彩分析</h3><p>{analysis}</p></div>}
          <p className="color-guide-note">AI 分析会受照片光线和屏幕色差影响，重要造型决策可结合线下布诊复核。</p>
        </div>
        <footer className="color-guide-footer">
          <button type="button" className="color-guide-secondary" onClick={onClose}>返回选择</button>
          {image && <button type="button" className="color-guide-secondary" onClick={() => inputRef.current?.click()} disabled={busy}>重新上传</button>}
          <button type="button" className="color-guide-primary" disabled={!image || busy} onClick={image ? startAnalysis : () => inputRef.current?.click()}>
            {busy ? "正在分析…" : image ? "开始专业分析 →" : "选择照片 →"}
          </button>
        </footer>
      </section>
    </div>
  );
}
