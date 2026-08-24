import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { scenarios, type Scenario, type User } from "../api";
import { useLang } from "../i18n/useLang";
import { SCENARIO_LABELS } from "../i18n/strings";

type Props = {
  user: User;
  onBack: () => void;
  /** 选好场景后进入行程设置页(地图 + 日历),带上场景 id。 */
  onPickScenario: (scenario: string) => void;
  /** 选好场景后进入行程计划页,带上场景 id。 */
  onPlanTrip: (scenario: string) => void;
};

/**
 * Trip Planner:场景选择页(从主页的 Trip Planner 磁贴进入)。
 * 顶部一句「你将要去…」,下面一排可横向滚动的场景卡片(通勤 / 旅行 / 出差 …),
 * 每张卡片上方是场景图片,底部左下角是场景名。
 * 场景列表由后端 /api/scenarios 提供(AGENTS.md §3),前端只负责展示。
 *
 * 循环滚动:把列表克隆三份首尾相接,初始停在中间那一份。左右都能无限循环。
 * 关键点(为了滚动稳定、不出虚影):归位只在滚动停下后做,绝不在惯性滚动进行中
 * 改 scrollLeft(那会和浏览器惯性/吸附打架,产生抖动虚影);箭头翻页则先把位置
 * 归到中间份再走一格,保证左右两个方向永远有余量,不会卡死。纯展示逻辑,留在前端。
 */
export default function TripPlanner({
  user,
  onBack,
  onPickScenario,
  onPlanTrip,
}: Props) {
  const { lang, t } = useLang();
  const [items, setItems] = useState<Scenario[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const trackRef = useRef<HTMLUListElement>(null);
  // 单份列表的滚动周期(一份宽度 + 份间空隙),由真实 DOM 测量得出。
  const periodRef = useRef(0);
  // 滚动停止后归位的防抖定时器。
  const idleTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    scenarios()
      .then(({ scenarios }) => setItems(scenarios))
      .catch(() => setError(t("tripLoadError")));
    return () => {
      if (idleTimer.current !== undefined) clearTimeout(idleTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once
  }, []);

  // 预解码所有场景图:提前把图片解码进缓存,避免滚入视野的那一刻才临时解码卡顿。
  // img.decode() 在解码完成前不阻塞,失败(如缺图)也无所谓,静默忽略即可。
  useEffect(() => {
    if (!items) return;
    for (const s of items) {
      const img = new Image();
      img.src = s.image;
      img.decode().catch(() => {});
    }
  }, [items]);

  // 列表渲染后测量一份的滚动周期,并把起点定位到中间那一份。
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track || !items || items.length === 0) return;
    const first = track.children[0] as HTMLElement | undefined;
    const nextCopy = track.children[items.length] as HTMLElement | undefined;
    if (!first || !nextCopy) return;
    // 同一场景在相邻两份中的左边距之差 = 精确的单份周期(含 flex gap)。
    periodRef.current = nextCopy.offsetLeft - first.offsetLeft;
    track.scrollLeft = periodRef.current;
  }, [items]);

  // 把当前位置用取模映射回中间份的等价位置。三份内容一致,所以这一步在视觉上
  // 不可见。只在"没有正在进行的平滑滚动"时直接赋值才安全,故仅供箭头/空闲归位调用。
  function recenter() {
    const track = trackRef.current;
    const period = periodRef.current;
    if (!track || period === 0) return;
    // 目标:把 scrollLeft 落到 [period, 2*period) 区间内的等价点。
    const mod = ((track.scrollLeft % period) + period) % period;
    const target = mod + period;
    if (Math.abs(target - track.scrollLeft) > 0.5) {
      track.scrollLeft = target;
    }
  }

  // 滚动进行中不动它——只在停下 120ms 后归位,避免与惯性/吸附打架产生虚影。
  // 同时打上 is-scrolling 类,滚动期间关掉卡片 hover 的逐帧重绘(见 styles.css)。
  // 例外:快接近物理边缘时(长距离猛滑,空闲归位来不及),立即平移一个周期。
  // 三份内容完全一致,±period 的跳变在视觉上不可见,却避免了撞墙急停。
  function handleScroll() {
    const track = trackRef.current;
    if (track) {
      track.classList.add("is-scrolling");
      const period = periodRef.current;
      if (period > 0) {
        const max = track.scrollWidth - track.clientWidth;
        if (track.scrollLeft < period * 0.25) {
          track.scrollLeft += period;
        } else if (track.scrollLeft > max - period * 0.25) {
          track.scrollLeft -= period;
        }
      }
    }
    if (idleTimer.current !== undefined) clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => {
      recenter();
      trackRef.current?.classList.remove("is-scrolling");
    }, 120);
  }

  // 左右箭头:先把位置归到中间份(保证两个方向都有余量、不会卡在边界),
  // 再平滑滚动一张卡片的距离。归位是瞬时且不可见的,用户只看到平滑的一格移动。
  function scrollByCards(dir: -1 | 1) {
    const track = trackRef.current;
    if (!track || !items || items.length === 0) return;
    recenter();
    const step = periodRef.current / items.length;
    track.scrollBy({ left: dir * step, behavior: "smooth" });
  }

  // 单张卡片。clone 份仅供视觉循环,对屏幕阅读器/键盘隐藏,只有中间的真实份可达。
  function card(s: Scenario, copy: number) {
    const isClone = copy !== 1;
    // 场景名按当前语言显示;后端只发 id,文案在前端 i18n 表里。
    const label = SCENARIO_LABELS[s.id]?.[lang] ?? s.label;
    return (
      <li key={`${copy}-${s.id}`} aria-hidden={isClone || undefined}>
        <button
          type="button"
          className={`scenario-card${selected === s.id ? " is-selected" : ""}`}
          aria-pressed={selected === s.id}
          tabIndex={isClone ? -1 : undefined}
          onClick={() => {
            // 点卡片只做选中;选好后下方出现两个入口(行程设置 / 行程计划)。
            setSelected(s.id);
          }}
        >
          {/* 图片区:图片加载失败时留下纯色占位块,不影响卡片结构 */}
          <span className="scenario-image" aria-hidden="true">
            <img
              src={s.image}
              alt=""
              decoding="async"
              draggable={false}
              onError={(e) => {
                e.currentTarget.style.visibility = "hidden";
              }}
            />
          </span>
          <span className="scenario-label">{label}</span>
        </button>
      </li>
    );
  }

  return (
    <div className="scenarios">
      <header className="scenarios-head">
        <button type="button" className="scenarios-back" onClick={onBack}>
          ‹ {t("backToHome")}
        </button>
        <p className="scenarios-eyebrow">
          {t("tripHello")}, {user.name}
        </p>
        <h1 className="scenarios-title">{t("tripGoingTo")}</h1>
      </header>

      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}

      {/* 轨道 + 左右翻页箭头。三份克隆首尾相接,配合 handleScroll 实现无限循环。 */}
      <div className="scenario-viewport">
        <button
          type="button"
          className="scenario-arrow scenario-arrow-prev"
          aria-label={t("prevScenario")}
          onClick={() => scrollByCards(-1)}
        >
          ‹
        </button>

        <ul
          className="scenario-track"
          aria-label={t("pickScenario")}
          ref={trackRef}
          onScroll={handleScroll}
        >
          {items &&
            [0, 1, 2].flatMap((copy) => items.map((s) => card(s, copy)))}
        </ul>

        <button
          type="button"
          className="scenario-arrow scenario-arrow-next"
          aria-label={t("nextScenario")}
          onClick={() => scrollByCards(1)}
        >
          ›
        </button>
      </div>

      {/* 选中场景后才出现:两个入口 —— 设目的地和日期(地图+日历)/ 规划行程。 */}
      {selected && (
        <div className="scenarios-actions">
          <button
            type="button"
            className="scenarios-continue"
            onClick={() => onPickScenario(selected)}
          >
            {t("continueToSetup")} ›
          </button>
          <button
            type="button"
            className="scenarios-continue"
            onClick={() => onPlanTrip(selected)}
          >
            {t("continueToItinerary")} ›
          </button>
        </div>
      )}
    </div>
  );
}
