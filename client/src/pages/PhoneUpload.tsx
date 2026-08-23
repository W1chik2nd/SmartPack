import { useEffect, useRef, useState } from "react";
import { uploadSessionPhoto } from "../api";
import { toDataUrl } from "../lib/image";
import "./PhoneUpload.css";

type Status = "ready" | "uploading" | "done" | "error";

/**
 * 手机扫码后打开的上传页。
 * 故意不需要登录:URL 里的 uploadToken 就是凭证,
 * 这正是免去“在手机上重新登录”的关键。
 * 打开即自动调起相机,拍完直传,电脑那边轮询收到。
 * 同一个 token 可以连续传多张,直到电脑关闭二维码弹窗。
 */
export default function PhoneUpload({ uploadToken }: { uploadToken: string }) {
  const [status, setStatus] = useState<Status>("ready");
  const [error, setError] = useState<string | null>(null);
  const [sentCount, setSentCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 打开页面就直接弹相机,省一次点击。
  useEffect(() => {
    fileInputRef.current?.click();
  }, []);

  async function handleFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setStatus("uploading");
    setError(null);
    try {
      await uploadSessionPhoto(uploadToken, await toDataUrl(file));
      setSentCount((n) => n + 1);
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
      setStatus("error");
    }
  }

  return (
    <main className="phone-upload">
      <h1 className="phone-upload-title">SmartPack 拍照上传</h1>

      {status === "ready" && (
        <p className="phone-upload-text">正在调起相机…若没反应,点下面的按钮。</p>
      )}
      {status === "uploading" && (
        <p className="phone-upload-text">上传中…</p>
      )}
      {status === "done" && (
        <>
          <p className="phone-upload-ok">✓ 已传 {sentCount} 张到电脑</p>
          <p className="phone-upload-text">
            可以接着拍下一件,电脑上会逐张识别。拍完在电脑上关掉二维码即可。
          </p>
        </>
      )}
      {status === "error" && <p className="phone-upload-err">{error}</p>}

      <button
        className="phone-upload-btn"
        onClick={() => fileInputRef.current?.click()}
      >
        {status === "done" ? "再拍一张" : "拍照"}
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="phone-upload-file"
        onChange={(e) => handleFile(e.target.files)}
        aria-hidden="true"
        tabIndex={-1}
      />
    </main>
  );
}
