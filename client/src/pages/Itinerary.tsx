// 行程计划页 —— 左:总行程图(每天一个节点);右:选中那天的逐点行程。
// 中间竖线上的 ⟨⟩ 开关可以收起左栏(照手绘稿)。
//
// 数据全部来自后端 /api/itinerary/trips(AGENTS.md §3);这里只做展示、
// 选中哪一天、收起/展开这类纯 UI 状态。
// TODO: 现在后端在没有行程时会补一份演示数据;接上 AI 行程生成后去掉。
import { useEffect, useState } from "react";
import { itineraryTrips, type Trip, type User } from "../api";
import TripSpine from "../components/TripSpine";
import DayPlan from "../components/DayPlan";
import { useLang } from "../i18n/useLang";

type Props = {
  user: User;
  /** 从场景选择页进来时带上选中的场景 id。 */
  scenario?: string;
  onBack: () => void;
};

export default function Itinerary({ scenario, onBack }: Props) {
  const { lang, t } = useLang();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [activeDayId, setActiveDayId] = useState<string>("");
  const [collapsed, setCollapsed] = useState(false);
  const [provider, setProvider] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    itineraryTrips(scenario)
      .then(({ trips, photoProvider }) => {
        const first = trips[0] ?? null;
        setTrip(first);
        setActiveDayId(first?.days[0]?.id ?? "");
        setProvider(photoProvider);
      })
      .catch(() => setError(t("itineraryError")));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once
  }, []);

  const activeDay = trip?.days.find((d) => d.id === activeDayId) ?? null;
  const title = trip ? (lang === "zh" ? trip.title : trip.titleEn) : "";

  return (
    <div className="itinerary-page">
      <header className="itin-head">
        <div className="itin-head-left">
          <button type="button" className="itin-back" onClick={onBack}>
            ‹ {t("backToHome")}
          </button>
          <h1 className="itin-title">{title || t("itineraryTitle")}</h1>
          {trip && (
            <p className="itin-subtitle">
              {trip.departLabel} {t("departs")} · {trip.days.length} × Day
            </p>
          )}
        </div>
        {provider && (
          <span className="itin-photo-source">
            {t("photoSource")}: {provider}
          </span>
        )}
      </header>

      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}

      {!trip && !error && <p className="itin-subtitle">{t("itineraryLoading")}</p>}

      {trip && trip.days.length === 0 && (
        <p className="itin-subtitle">{t("itineraryEmpty")}</p>
      )}

      {trip && trip.days.length > 0 && (
        <div className={`itin-layout${collapsed ? " is-collapsed" : ""}`}>
          <TripSpine
            trip={trip}
            activeDayId={activeDayId}
            onPickDay={setActiveDayId}
          />

          <div className="itin-divider">
            <button
              type="button"
              className="itin-toggle"
              aria-expanded={!collapsed}
              aria-label={collapsed ? t("expandOverview") : t("collapseOverview")}
              onClick={() => setCollapsed((v) => !v)}
            >
              {collapsed ? "›" : "‹"}
            </button>
          </div>

          {activeDay && <DayPlan day={activeDay} />}
        </div>
      )}
    </div>
  );
}
