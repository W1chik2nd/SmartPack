import { useLang } from "../i18n/useLang";

type Props = {
  onEnter: () => void;
};

/**
 * 落地页(未登录用户打开网站看到的第一屏)。
 * 满屏浅青背景 + 世界地图剪影,行李箱插画放在右下角,
 * 箭头形状的「继续旅程」按钮点击后进入登录/注册。
 * 图片从 /public 加载:换成真实素材只需替换同名文件。
 */
export default function Landing({ onEnter }: Props) {
  const { t } = useLang();
  return (
    <main className="landing">
      {/* 世界地图作背景铺满 */}
      <img className="landing-map" src="/world-map.svg" alt="" aria-hidden="true" />

      {/* 品牌标题 */}
      <div className="landing-hero">
        <h1 className="landing-title">
          <span className="landing-logo" aria-hidden="true" />
          {t("brandName")}
        </h1>
        <p className="landing-tagline">{t("landingTagline")}</p>
      </div>

      {/* 右下角行李箱,箭头按钮叠在箱子左侧。 */}
      <div className="landing-luggage">
        <img className="landing-suitcase" src="/suitcase.svg" alt="" />
        <button className="landing-enter" onClick={onEnter}>
          {t("landingEnter")}
        </button>
      </div>
    </main>
  );
}
