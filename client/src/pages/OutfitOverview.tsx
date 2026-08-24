import { useEffect, useState } from "react";
import {
  getOutfitPlan,
  weather,
  type OutfitDay,
  type OutfitPiece,
  type OutfitPlan,
  type Weather,
} from "../api";
import { SCENARIO_LABELS } from "../i18n/strings";
import { useLang } from "../i18n/useLang";
import OutfitPieceVisual from "../components/OutfitPieceVisual";

type Props = { onBack: () => void; tripPlanId?: string };

function PieceVisual({ piece, compact = false }: { piece: OutfitPiece; compact?: boolean }) {
  return <OutfitPieceVisual piece={piece} compact={compact} />;
}

function MiniOutfit({ day }: { day: OutfitDay }) {
  const clothes = day.pieces.filter((piece) =>
    piece.kind === "top" || piece.kind === "bottom"
  );
  const accessory = day.pieces.find((piece) => piece.kind === "accessory");
  return (
    <span className="dress-mini-stack" aria-hidden="true">
      <span className="dress-mini-clothes">
        {clothes.map((piece) => (
          <PieceVisual key={piece.id} piece={piece} compact />
        ))}
      </span>
      {accessory && <PieceVisual piece={accessory} compact />}
    </span>
  );
}

export default function OutfitOverview({ onBack, tripPlanId }: Props) {
  const { lang, t } = useLang();
  const [plan, setPlan] = useState<OutfitPlan | null>(null);
  const [wx, setWx] = useState<Weather | null>(null);
  const [wxError, setWxError] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [error, setError] = useState(false);

  useEffect(() => {
    getOutfitPlan(tripPlanId)
      .then(({ plan: next }) => {
        setPlan(next);
        weather(next.lat, next.lon).then(setWx).catch(() => setWxError(true));
      })
      .catch(() => setError(true));
  }, [tripPlanId]);

  const locale = lang === "zh" ? "zh-CN" : "en-GB";
  const fmtDate = (iso: string, short = false) => {
    const [year, month, day] = iso.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString(locale, {
      month: short ? "numeric" : "short",
      day: "numeric",
      ...(short ? {} : { weekday: "short" }),
    });
  };

  if (error) {
    return (
      <main className="dress-page dress-state">
        <button type="button" className="dress-back" onClick={onBack}>‹ {t("backToHome")}</button>
        <p role="alert">{t("outfitLoadFailed")}</p>
      </main>
    );
  }

  if (!plan) {
    return <main className="dress-page dress-state">{t("outfitLoading")}</main>;
  }

  const activeDay = plan.days[activeIndex];
  const activeAccessory = activeDay.pieces.find((piece) => piece.kind === "accessory");
  const activeGarments = activeDay.pieces.filter((piece) => piece.kind !== "accessory");
  const scenario = SCENARIO_LABELS[plan.scenario]?.[lang] ?? plan.scenario;
  const dayLabel = lang === "zh" ? `第${activeDay.dayNumber}天` : `Day ${activeDay.dayNumber}`;
  const incompleteWardrobe = activeDay.pieces.some((piece) => !piece.wardrobeItemId);
  const move = (step: number) => {
    setActiveIndex((index) => (index + step + plan.days.length) % plan.days.length);
  };

  return (
    <main className="dress-page">
      <header className="dress-head">
        <div>
          <button type="button" className="dress-back" onClick={onBack}>‹ {t("backToHome")}</button>
          <h1>{t("outfitOverviewTitle")}</h1>
        </div>
        <span className="dress-day-badge">{dayLabel} / {plan.days.length}</span>
      </header>

      <div className="dress-layout">
        <aside className="dress-context" aria-label={t("outfitTripContext")}>
          <section className="dress-destination">
            <span>{t("outfitDestination")}</span>
            <strong>{plan.destination}</strong>
            {plan.destinationDetail && <small>{plan.destinationDetail}</small>}
            <dl>
              <div><dt>{t("outfitDate")}</dt><dd>{fmtDate(plan.startDate, true)} – {fmtDate(plan.endDate, true)}</dd></div>
              <div><dt>{t("outfitScene")}</dt><dd>{scenario}</dd></div>
            </dl>
          </section>

          <section className="dress-weather" aria-label={t("destinationWeatherToday")}>
            <span className="dress-weather-mark" aria-hidden="true" />
            <div>
              <strong>{wx ? `${Math.round(wx.tempC)}°C` : "—"}</strong>
              <small>{wx?.condition ?? (wxError ? t("weatherUnavailable") : t("weatherLoading"))}</small>
            </div>
          </section>

          <section className="dress-itinerary">
            <h2>{t("outfitItineraryOverview")}</h2>
            <div className="dress-table-head" aria-hidden="true">
              <span>{t("outfitDate")}</span><span>{t("outfitPlace")}</span><span>{t("outfitScene")}</span>
            </div>
            <div className="dress-table-body">
              {plan.days.map((day, index) => (
                <button
                  type="button"
                  className={index === activeIndex ? "is-active" : ""}
                  key={day.id}
                  onClick={() => setActiveIndex(index)}
                  aria-pressed={index === activeIndex}
                >
                  <span>{fmtDate(day.date, true)}</span><span>{lang === "zh" ? day.place : day.placeEn || day.place}</span><span>{SCENARIO_LABELS[day.scene]?.[lang] ?? day.scene}</span>
                </button>
              ))}
            </div>
          </section>
        </aside>

        <section className="dress-featured" aria-label={t("outfitSelectedDay")}>
          <header>
            <p>{dayLabel} · {fmtDate(activeDay.date)} · {lang === "zh" ? activeDay.place : activeDay.placeEn || activeDay.place}</p>
            <h2>{scenario}</h2>
          </header>
          <div className="dress-outfit-stage">
            <button type="button" className="dress-switch prev" onClick={() => move(-1)} aria-label={t("outfitPreviousDay")}>‹</button>
            <div className="dress-stack">
              {activeGarments.map((piece) => (
                <figure key={piece.id}>
                  <PieceVisual piece={piece} />
                  <figcaption>{lang === "zh" ? piece.label : piece.labelEn}</figcaption>
                </figure>
              ))}
            </div>
            {activeAccessory && (
              <figure className="dress-featured-accessory">
                <PieceVisual piece={activeAccessory} />
                <figcaption>{lang === "zh" ? activeAccessory.label : activeAccessory.labelEn}</figcaption>
              </figure>
            )}
            <button type="button" className="dress-switch next" onClick={() => move(1)} aria-label={t("outfitNextDay")}>›</button>
          </div>
          <p className="dress-note">
            {incompleteWardrobe ? t("outfitSuggestedPieces") : t("outfitFromWardrobe")}
          </p>
        </section>

        <aside className="dress-days" aria-label={t("outfitDailyOverview")}>
          <h2>{t("outfitDailyOverview")}</h2>
          <div className="dress-day-grid">
            {plan.days.map((day, index) => (
              <button
                type="button"
                key={day.id}
                className={index === activeIndex ? "is-active" : ""}
                onClick={() => setActiveIndex(index)}
                aria-pressed={index === activeIndex}
              >
                <span className="dress-card-title">{lang === "zh" ? `第${day.dayNumber}天` : `Day ${day.dayNumber}`}</span>
                <MiniOutfit day={day} />
                <span className="dress-card-date">{fmtDate(day.date, true)}</span>
              </button>
            ))}
          </div>
        </aside>
      </div>
    </main>
  );
}
