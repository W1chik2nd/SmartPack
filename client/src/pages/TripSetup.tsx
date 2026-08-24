import { useEffect, useState, type FormEvent } from "react";
import {
  generateTripPlan,
  getTripPlan,
  searchPlaces,
  type Place,
  type TripGenerationEstimate,
  type TripPlan,
  type User,
} from "../api";
import MapView from "../components/MapView";
import DateRangePicker, { type DateRange } from "../components/DateRangePicker";
import { useLang } from "../i18n/useLang";
import { SCENARIO_LABELS } from "../i18n/strings";

// 行程设置页(线框图 2):左边地图 + 下方搜索框,右边日历 + 下方日期条。
// 从场景卡片点进来,带着 scenario id。
//
// 这一页只做展示和收集输入(AGENTS.md §3):地点搜索走 /api/places 由服务端
// 代理第三方,保存走 /api/trip-plans 落库。前端不含任何业务规则。

type Props = {
  user: User;
  /** 从哪张场景卡片进来的(commute / travel / business / …)。 */
  scenario: string;
  onBack: () => void;
  /** 保存成功后回主页;主页会显示这条新行程。 */
  onSaved: () => void;
};

/** 中英都按"年月日"读得通的日期显示。 */
function formatDay(iso: string, lang: "en" | "zh"): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (lang === "zh") return `${y} 年 ${m} 月 ${d} 日`;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** 区间跨了几晚。同一天是 0,显示成"当天往返"。 */
function nightsBetween(range: DateRange): number {
  const start = new Date(`${range.start}T00:00:00Z`).getTime();
  const end = new Date(`${range.end}T00:00:00Z`).getTime();
  return Math.round((end - start) / 86_400_000);
}

type GenerationProgress = {
  planId: string;
  status: TripPlan["generationStatus"];
  estimate: TripGenerationEstimate;
  error: string | null;
};

function elapsedLabel(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

export default function TripSetup({ user, scenario, onBack, onSaved }: Props) {
  const { lang, t } = useLang();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [place, setPlace] = useState<Place | null>(null);
  const [range, setRange] = useState<DateRange | null>(null);
  const [agenda, setAgenda] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [generation, setGeneration] = useState<GenerationProgress | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // 没选地点时地图停在一个能看出是世界地图的位置,而不是空白海面。
  const center = place
    ? { lat: place.lat, lon: place.lon }
    : { lat: 30, lon: 20 };

  const isGenerating =
    generation?.status === "pending" || generation?.status === "processing";

  useEffect(() => {
    if (!isGenerating) return;
    const timer = window.setInterval(
      () => setElapsedSeconds((seconds) => seconds + 1),
      1_000
    );
    return () => window.clearInterval(timer);
  }, [isGenerating]);

  useEffect(() => {
    if (!generation || !isGenerating) return;
    const planId = generation.planId;
    let active = true;
    let timer: number;

    async function poll() {
      try {
        const { plan, estimate } = await getTripPlan(planId);
        if (!active) return;
        setGeneration({
          planId,
          status: plan.generationStatus,
          estimate,
          error: plan.generationError,
        });
        if (plan.generationStatus === "pending" || plan.generationStatus === "processing") {
          timer = window.setTimeout(poll, 2_500);
        }
      } catch {
        if (active) timer = window.setTimeout(poll, 4_000);
      }
    }

    timer = window.setTimeout(poll, 2_500);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [generation?.planId, isGenerating]);

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setError(null);
    try {
      const { places } = await searchPlaces(q, lang);
      setResults(places);
      // 搜到就直接定位到最匹配的那个(第一条),地图立刻跳过去并打点,
      // 不用再点一下列表。列表仍然留着,同名地点(如多个"北京")可以换选。
      if (places.length > 0) {
        setPlace(places[0]);
      }
    } catch (err: any) {
      // 透出后端的真实原因(未登录 / 上游 502 / 校验),而不是一律"搜索失败",
      // 否则排障时看不出卡在哪一环。
      setError(err?.message ?? t("placeSearchFailed"));
      setResults(null);
    } finally {
      setSearching(false);
    }
  }

  // 从列表里换选另一个地点:定位过去并收起列表。
  function choosePlace(p: Place) {
    setPlace(p);
    setResults(null);
  }

  async function handleSave() {
    if (!place || !range) {
      setError(t("needPlaceAndDates"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { plan, estimate } = await generateTripPlan({
        scenario,
        placeName: place.name,
        placeDetail: place.detail,
        lat: place.lat,
        lon: place.lon,
        startDate: range.start,
        endDate: range.end,
        notes: agenda,
      });
      setElapsedSeconds(0);
      setGeneration({
        planId: plan.id,
        status: plan.generationStatus,
        estimate,
        error: plan.generationError,
      });
      return;
    } catch (err: any) {
      setError(err?.message ?? t("saveTripFailed"));
    } finally {
      setSaving(false);
    }
  }

  const scenarioLabel = SCENARIO_LABELS[scenario]?.[lang] ?? scenario;
  const nights = range ? nightsBetween(range) : 0;

  return (
    <div className="tripsetup">
      <header className="tripsetup-head">
        <button type="button" className="tripsetup-back" onClick={onBack}>
          ‹ {t("backToScenarios")}
        </button>
        <p className="tripsetup-eyebrow">
          {scenarioLabel} · {user.name}
        </p>
        <h1 className="tripsetup-title">{t("tripSetupTitle")}</h1>
      </header>

      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      <div className="tripsetup-grid">
        {/* 左列:地图 + 搜索框 */}
        <section className="tripsetup-col">
          <div className="tripsetup-panel">
            <MapView
              center={center}
              zoom={place ? 9 : 2}
              marker={place}
              label={t("mapLabel")}
            />
          </div>

          <form className="tripsetup-bar" onSubmit={handleSearch}>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchPlace")}
              aria-label={t("searchPlace")}
            />
            <button type="submit" disabled={searching} aria-label={t("searchAction")}>
              {searching ? "…" : "⌕"}
            </button>
          </form>

          {/* 搜索结果:选中一条就定位地图并收起列表。 */}
          {results && (
            <ul className="tripsetup-results">
              {results.length === 0 && (
                <li className="tripsetup-empty">{t("noPlaces")}</li>
              )}
              {results.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className={place?.id === p.id ? "is-selected" : ""}
                    aria-pressed={place?.id === p.id}
                    onClick={() => choosePlace(p)}
                  >
                    <strong>{p.name}</strong>
                    {p.detail && <span>{p.detail}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 右列:日历 + 日期条 */}
        <section className="tripsetup-col">
          <div className="tripsetup-panel">
            <DateRangePicker
              value={range}
              onChange={(r) => {
                setRange(r);
              }}
            />
          </div>

          <div className="tripsetup-bar tripsetup-dates">
            <button
              type="button"
              className="tripsetup-clear"
              onClick={() => setRange(null)}
              disabled={!range}
              aria-label={t("clearDates")}
            >
              ✕
            </button>
            <p aria-live="polite">
              {range ? (
                <>
                  {formatDay(range.start, lang)}
                  {nights > 0 && <> — {formatDay(range.end, lang)}</>}
                  <span className="tripsetup-nights">
                    {nights > 0 ? `${nights} ${t("nights")}` : t("sameDay")}
                  </span>
                </>
              ) : (
                t("noDates")
              )}
            </p>
          </div>
        </section>
      </div>

      <section className="tripsetup-agenda">
        <div>
          <p className="tripsetup-agenda-kicker">{t("tripAgendaKicker")}</p>
          <h2>{t("tripAgendaTitle")}</h2>
          <p>{t("tripAgendaHint")}</p>
        </div>
        <textarea
          value={agenda}
          onChange={(event) => setAgenda(event.target.value)}
          maxLength={1200}
          placeholder={t("tripAgendaPlaceholder")}
          aria-label={t("tripAgendaTitle")}
        />
      </section>

      {generation && (
        <div
          className={`tripsetup-queued is-${generation.status}`}
          role={generation.status === "failed" ? "alert" : "status"}
          aria-live="polite"
        >
          <div>
            <strong>
              {isGenerating
                ? t("tripQueuedTitle")
                : generation.status === "completed"
                  ? t("tripReadyTitle")
                  : t("tripGenerationFailedHome")}
            </strong>
            {isGenerating ? (
              <>
                <p className="tripsetup-estimate">
                  {t("tripEstimateLabel")} · {Math.ceil(generation.estimate.minSeconds / 60)}–
                  {Math.ceil(generation.estimate.maxSeconds / 60)} {t("tripMinutesShort")}
                </p>
                <p>
                  {elapsedSeconds > generation.estimate.maxSeconds
                    ? t("tripEstimateExceeded")
                    : t("tripEstimateHint")}
                </p>
                <p className="tripsetup-elapsed">
                  {t("tripElapsedLabel")} <time>{elapsedLabel(elapsedSeconds)}</time>
                </p>
              </>
            ) : generation.status === "completed" ? (
              <p>{t("tripReadyMessage")}</p>
            ) : (
              <p>{generation.error ?? t("saveTripFailed")}</p>
            )}
          </div>
          <span className="tripsetup-status-mark" aria-hidden="true">
            {isGenerating ? "AI" : generation.status === "completed" ? "✓" : "!"}
          </span>
        </div>
      )}

      <div className="tripsetup-actions">
        <button
          type="button"
          className="tripsetup-save"
          onClick={generation ? onSaved : handleSave}
          disabled={saving || isGenerating}
        >
          {isGenerating
            ? t("tripQueuedButton")
            : generation?.status === "completed"
              ? t("tripViewPlan")
              : generation?.status === "failed"
                ? t("backToHome")
                : saving
              ? t("generatingTrip")
              : t("generateTrip")}
        </button>
        {isGenerating && (
          <button type="button" className="tripsetup-home" onClick={onSaved}>
            {t("backToHome")}
          </button>
        )}
        {!generation && (
          <p className="tripsetup-agent-note" aria-live="polite">
            {saving ? t("tripAgentWorking") : t("tripAgentNote")}
          </p>
        )}
      </div>
    </div>
  );
}
