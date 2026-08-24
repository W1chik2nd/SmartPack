import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  recognizeClothing,
  createUploadSession,
  fetchUploadedPhoto,
  endUploadSession,
  listWardrobeItems,
  deleteWardrobeItem,
  wardrobePhotoUrl,
  type WardrobeItem,
} from "../api";
import { toDataUrl } from "../lib/image";
import { useLang } from "../i18n/useLang";
import {
  confirmDeleteMessage,
  unreachableHostMessage,
} from "../i18n/strings";
import "./Wardrobe.css";

/** 正在识别中的临时卡片:还没落库,所以没有真实 id。 */
type PendingItem = {
  tempId: string;
  photo: string;
  status: string;
};

function isMobileDevice(): boolean {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/**
 * 判断当前访问地址手机能不能连上。二维码内容 = 当前地址,
 * 所以从 localhost 或 VPN 虚拟网卡打开时,扫码必然打不开页面。
 * 返回 false 表示地址可用;文案本身走 i18n(见 strings.ts)。
 */
function isUnreachableHost(hostname: string): boolean {
  if (hostname === "localhost" || hostname === "127.0.0.1") return true;
  // 198.18/19.x 是 VPN/代理(Clash、Surge 等)的虚拟网卡;
  // 169.254.x 是没拿到 DHCP 的自分配地址。两者手机都不可达。
  return /^198\.1[89]\./.test(hostname) || /^169\.254\./.test(hostname);
}

/** 手绘感 T 恤线稿,对应线框图里的占位图形。 */
function TShirtSketch() {
  return (
    <svg viewBox="0 0 100 90" className="wardrobe-sketch" aria-hidden="true">
      <path
        d="M30 12 L42 6 Q50 15 58 6 L70 12 L87 27 L74 39 L71 32 L72 76 Q50 84 28 76 L29 32 L26 39 L13 27 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

type Props = {
  onBack: () => void;
};

export default function Wardrobe({ onBack }: Props) {
  const { lang, t } = useLang();
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState("");
  const [qrHint, setQrHint] = useState<string | null>(null);
  const [uploadToken, setUploadToken] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 从后端拉真实衣柜(之前是写死的示例数据,刷新就丢)。
  useEffect(() => {
    listWardrobeItems()
      .then(({ items }) => setItems(items))
      .catch((err) =>
        setLoadError(err instanceof Error ? err.message : t("wardrobeLoadFailed"))
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once
  }, []);

  // 二维码弹出后持续轮询:收到一张就识别一张,但**不关闭弹窗**,
  // 这样手机上那一页可以接着拍第二、第三张(之前收到就关,会话也被销毁,
  // 手机再拍会报“上传链接已失效”)。要停就点关闭按钮。
  useEffect(() => {
    if (!uploadToken) return;
    let stopped = false;
    const timer = setInterval(async () => {
      if (stopped) return;
      const { image } = await fetchUploadedPhoto(uploadToken).catch(() => ({
        image: null,
      }));
      if (!image || stopped) return;
      recognizeAndAdd(image);
    }, 1500);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [uploadToken]);

  async function handleCameraClick() {
    if (isMobileDevice()) {
      // 手机:直接调起相机(input capture)。
      fileInputRef.current?.click();
      return;
    }
    // 电脑:先创建一次性上传会话,二维码指向带 token 的上传页。
    // 手机凭 token 直传照片,不需要在手机上登录。
    const { hostname, origin } = window.location;
    if (isUnreachableHost(hostname)) {
      setQrHint(unreachableHostMessage(lang, hostname));
      setQrUrl("");
      setQrDataUrl("blocked"); // 只为撑开弹窗展示提示
      return;
    }
    setQrHint(null);
    const { uploadToken } = await createUploadSession();
    const url = `${origin}/?upload=${uploadToken}`;
    setUploadToken(uploadToken);
    setQrUrl(url);
    setQrDataUrl(await QRCode.toDataURL(url, { width: 220, margin: 1 }));
  }

  /**
   * 收到照片(本机选的或手机传来的)后:先占位显示,识别落库后并入正式列表。
   * 识别在后端完成并入库,所以成功后拿到的是带 id 的正式单品。
   */
  async function recognizeAndAdd(dataUrl: string) {
    const tempId = `p${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setPending((prev) => [
      ...prev,
      { tempId, photo: dataUrl, status: t("wardrobeRecognizing") },
    ]);
    try {
      const { item } = await recognizeClothing(dataUrl);
      setPending((prev) => prev.filter((p) => p.tempId !== tempId));
      setItems((prev) => [item, ...prev]);
      setLoadError(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t("wardrobeRecognizeFailed");
      // 认不出衣物(拍到水杯之类)时,后端不入库,前端也要把占位卡片撤掉,
      // 否则会留下一张全是“未知”的空卡片。
      setPending((prev) => prev.filter((p) => p.tempId !== tempId));
      setLoadError(message);
    }
  }

  async function handlePhotoSelected(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    try {
      recognizeAndAdd(await toDataUrl(file));
    } catch (err) {
      // 压缩阶段就失败(图片过大/无法读取),直接提示,不进占位列表。
      setLoadError(err instanceof Error ? err.message : t("wardrobePhotoFailed"));
    }
  }

  /** 删除单品(卡片上的删除按钮)。 */
  async function handleDelete(id: string, title: string) {
    if (!confirm(confirmDeleteMessage(lang, title))) return;
    const snapshot = items;
    // 先本地移除,失败再回滚,省一次列表请求。
    setItems((prev) => prev.filter((w) => w.id !== id));
    try {
      await deleteWardrobeItem(id);
    } catch (err) {
      setItems(snapshot);
      setLoadError(err instanceof Error ? err.message : t("wardrobeDeleteFailed"));
    }
  }

  return (
    <main className="wardrobe">
      <div className="wardrobe-backbar">
        <button type="button" className="wardrobe-back" onClick={onBack}>
          ‹ {t("backToHome")}
        </button>
      </div>

      <header className="wardrobe-header">
        <h1 className="wardrobe-title">{t("wardrobeTitle")}</h1>
        <button
          className="wardrobe-camera"
          onClick={handleCameraClick}
          aria-label={t("wardrobeAddPhoto")}
          title={t("wardrobeAddPhoto")}
        >
          <svg viewBox="0 0 32 32" aria-hidden="true">
            <rect
              x="3"
              y="9"
              width="26"
              height="19"
              rx="3"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            />
            <path
              d="M11 9 L13 4 L19 4 L21 9"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            <circle
              cx="16"
              cy="18"
              r="5.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            />
          </svg>
        </button>
      </header>

      {loadError && <p className="wardrobe-error">{loadError}</p>}

      <section className="wardrobe-grid" aria-label={t("wardrobeMine")}>
        {/* 正在识别的占位卡片:还没落库 */}
        {pending.map((p) => (
          <article key={p.tempId} className="wardrobe-cell">
            <img className="wardrobe-photo" src={p.photo} alt="" />
            <span className="wardrobe-pending">{p.status}</span>
          </article>
        ))}

        {items.map((item) => (
          <article key={item.id} className="wardrobe-cell">
            <span className="wardrobe-count">×{item.count}</span>
            <button
              className="wardrobe-delete"
              onClick={() => handleDelete(item.id, item.title)}
              aria-label={`${t("wardrobeDelete")} ${item.title}`}
              title={t("wardrobeDelete")}
            >
              ✕
            </button>
            {item.hasPhoto ? (
              <img
                className="wardrobe-photo"
                src={wardrobePhotoUrl(item.id)}
                alt={item.title}
              />
            ) : (
              <TShirtSketch />
            )}
            {/* 大标题:颜色+版型+品类,如“黄色宽松外套” */}
            <span className="wardrobe-item-title">{item.title}</span>
            {/* 细节以标签形式简要呈现;完整细节存在库里供 AI 分析 */}
            <span className="wardrobe-item-meta">
              {[item.subtype || item.category, item.fit, item.material]
                .filter(Boolean)
                .join(" · ")}
            </span>
            {/* details 只存库供 AI 搭配分析,不在卡片上展示 */}
          </article>
        ))}

        {items.length === 0 && pending.length === 0 && !loadError && (
          <article className="wardrobe-cell wardrobe-empty">
            <p>{t("wardrobeEmpty")}</p>
            <p className="wardrobe-empty-hint">{t("wardrobeEmptyHint")}</p>
          </article>
        )}
      </section>

      {/* 手机拍照入口:capture 直接调起后置相机 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="wardrobe-file"
        onChange={(e) => handlePhotoSelected(e.target.files)}
        aria-hidden="true"
        tabIndex={-1}
      />

      {/* 电脑端:扫码弹窗 */}
      {qrDataUrl && (
        <div
          className="wardrobe-qr-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={t("wardrobeQrDialog")}
        >
          <div className="wardrobe-qr-card">
            {qrHint ? (
              <p className="wardrobe-qr-warn">{qrHint}</p>
            ) : (
              <>
                <img src={qrDataUrl} alt={t("wardrobeQrAlt")} />
                <p>{t("wardrobeQrText")}</p>
                <p className="wardrobe-qr-waiting">{t("wardrobeQrWaiting")}</p>
                <code className="wardrobe-qr-url">{qrUrl}</code>
                <p className="wardrobe-qr-note">{t("wardrobeQrNote")}</p>
              </>
            )}
            <button
              className="wardrobe-qr-close"
              onClick={() => {
                // 会话现在支持连拍,所以要显式结束,不能只靠 TTL 过期。
                if (uploadToken) endUploadSession(uploadToken).catch(() => {});
                setQrDataUrl(null);
                setUploadToken(null); // 同时停掉轮询
              }}
            >
              {t("close")}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
