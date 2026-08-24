import { useRef, useState } from "react";
import "./PersonalColorGuide.css";

type Props = { onClose: () => void };

export default function PersonalColorGuide({ onClose }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [photoName, setPhotoName] = useState("");

  return (
    <div className="color-guide-overlay" role="presentation" onMouseDown={onClose}>
      <section
        className="color-guide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="color-guide-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="color-guide-header">
          <div>
            <p className="color-guide-kicker">PERSONAL COLOR ANALYSIS</p>
            <h2 id="color-guide-title">不知道自己的四季型？</h2>
          </div>
          <button type="button" className="color-guide-close" onClick={onClose} aria-label="关闭问卷">×</button>
        </header>
        <div className="color-guide-content">
          <p className="color-guide-intro">上传一张真人照片，按照下面的专业要求进行个人色彩分析，再回来选择最适合你的四季型。</p>
          <label className="color-guide-upload">
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              onChange={(event) => setPhotoName(event.target.files?.[0]?.name ?? "")}
            />
            <strong aria-hidden="true">＋</strong>
            <span>{photoName || "上传真人照片"}</span>
            <small>{photoName ? "照片已选择" : "建议正面、素颜、自然光，避免滤镜"}</small>
          </label>
          <div className="color-guide-prompt">
            <p>请根据我上传的真人照片，对我的个人色彩（Personal Color Analysis）进行专业分析。</p>
            <ul>
              <li>判断肤色冷暖调（冷皮 / 暖皮 / 中性），判断色彩季型（春夏秋冬四季型）</li>
              <li>分析肤色明度、肤色饱和度、五官对比度、头发与瞳孔颜色</li>
              <li>给出最适合我的服装颜色、妆容颜色、口红色号方向、发色方向</li>
              <li>判断配饰金属（银色 / 金色），给出最显白和最容易显脏显黑的颜色</li>
              <li>最后总结：“我的整体气质关键词”</li>
            </ul>
          </div>
          <p className="color-guide-note">请以专业形象顾问 + 高级时尚造型师的视角，输出专业、具体、视觉化、不要模糊描述。</p>
        </div>
        <footer className="color-guide-footer">
          <button type="button" className="color-guide-secondary" onClick={onClose}>返回选择</button>
          <button type="button" className="color-guide-primary" onClick={() => inputRef.current?.click()}>
            {photoName ? "重新上传照片" : "选择照片"} <span aria-hidden="true">→</span>
          </button>
        </footer>
      </section>
    </div>
  );
}
