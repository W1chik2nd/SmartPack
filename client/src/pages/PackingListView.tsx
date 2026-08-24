import type { PackingPlan } from "../api";
import { useLang } from "../i18n/useLang";
import { useLocalizedValues } from "../hooks/useLocalizedValues";

// Presentational layer for the packing-list screen. Pure props in, markup out —
// no data fetching or business logic (that stays in PackingList.tsx and, for
// the real rules, on the server per AGENTS.md §3).

type LayoutProps = {
  balance: number;
  onBalance: (n: number) => void;
  plan: PackingPlan | null;
  loading: boolean;
  error: string | null;
  checked: Record<string, boolean>;
  onToggle: (id: string) => void;
  totalItems: number;
  packedCount: number;
  onBack: () => void;
};

/** Vertical slider (sketch: variety at top · pack light at bottom). */
function BalanceSlider({
  balance,
  onBalance,
}: {
  balance: number;
  onBalance: (n: number) => void;
}) {
  const { t } = useLang();
  return (
    <aside className="pk-slider">
      <span className="pk-slider-cap pk-slider-top">{t("pkVariety")}</span>
      <input
        className="pk-range"
        type="range"
        min={0}
        max={100}
        step={1}
        value={balance}
        onChange={(e) => onBalance(Number(e.target.value))}
        aria-label={t("pkSliderLabel")}
        aria-valuetext={
          balance >= 67
            ? t("pkVariety")
            : balance <= 33
              ? t("pkLight")
              : t("pkBalanced")
        }
      />
      <span className="pk-slider-cap pk-slider-bottom">{t("pkLight")}</span>
    </aside>
  );
}

/** The checklist (sketch: packing list grouped by category, tickable rows). */
function Checklist({
  plan,
  checked,
  onToggle,
}: {
  plan: PackingPlan;
  checked: Record<string, boolean>;
  onToggle: (id: string) => void;
}) {
  const { lang, t } = useLang();
  const categoryTitles = useLocalizedValues(
    plan.categories.map((cat) => ({ zh: cat.title, en: cat.titleEn })),
    lang
  );
  const itemLabels = useLocalizedValues(
    plan.categories.flatMap((cat) => cat.items.map((item) => ({ zh: item.label, en: item.labelEn }))),
    lang
  );
  let itemLabelIndex = 0;
  const nextItemLabel = () => itemLabels[itemLabelIndex++];
  return (
    <section className="pk-list" aria-label={t("pkListTitle")}>
      <h1 className="pk-list-title">{t("pkListTitle")}</h1>
      {plan.categories.map((cat) => (
        <div className="pk-cat" key={cat.id}>
          <h2 className="pk-cat-title">
            {categoryTitles[plan.categories.indexOf(cat)]}
          </h2>
          <ul className="pk-cat-items">
            {cat.items.map((item) => (
              <li key={item.id}>
                <label className="pk-row">
                  <input
                    type="checkbox"
                    checked={!!checked[item.id]}
                    onChange={() => onToggle(item.id)}
                  />
                  <span className="pk-row-label">
                    {nextItemLabel()}
                    {(item.quantity || item.daysUsed || item.wardrobeGap) && (
                      <span className="pk-row-meta">
                        {item.quantity && item.quantity > 1 && (
                          <span>{t("pkQuantity")} ×{item.quantity}</span>
                        )}
                        {item.daysUsed && (
                          <span>{t("pkDays")} {item.daysUsed.join(" / ")}</span>
                        )}
                        {item.wardrobeGap && (
                          <span className="pk-gap">{t("pkWardrobeGap")}</span>
                        )}
                      </span>
                    )}
                  </span>
                  <span className="pk-row-reuse" title={t("pkReuse")}>
                    ×{item.reuse}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

/** Don't-forget box: non-clothing must-brings, ID / passport first (US 7.x). */
function Essentials({
  plan,
  checked,
  onToggle,
}: {
  plan: PackingPlan;
  checked: Record<string, boolean>;
  onToggle: (id: string) => void;
}) {
  const { lang, t } = useLang();
  const essentialLabels = useLocalizedValues(
    plan.essentials.map((item) => ({ zh: item.label, en: item.labelEn })),
    lang
  );
  return (
    <section className="pk-essentials" aria-label={t("pkEssentials")}>
      <h2 className="pk-essentials-title">{t("pkEssentials")}</h2>
      <ul className="pk-essentials-items">
        {plan.essentials.map((e) => (
          <li key={e.id}>
            <label className="pk-row">
              <input
                type="checkbox"
                checked={!!checked[e.id]}
                onChange={() => onToggle(e.id)}
              />
              <span className="pk-row-label">
                {essentialLabels[plan.essentials.indexOf(e)]}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Core-piece cards: the most-reused hero pieces the whole plan leans on
    (sketch: T-shirt cards with reuse count / core piece). US 6.2, 1.3. */
function CorePieces({ plan }: { plan: PackingPlan }) {
  const { lang, t } = useLang();
  const coreLabels = useLocalizedValues(
    plan.corePieces.map((piece) => ({ zh: piece.label, en: piece.labelEn })),
    lang
  );
  return (
    <section className="pk-core" aria-label={t("pkCore")}>
      <div className="pk-core-grid">
        {plan.corePieces.map((piece) => (
          <article className="pk-core-card" key={piece.id}>
            {/* Geometric garment mark, drawn in CSS — decorative (§8) */}
            <div className="pk-core-icon" aria-hidden="true" />
            <p className="pk-core-reuse">
              {t("pkReuse")}:<strong>{piece.reuse}</strong>
            </p>
            <p className="pk-core-name">
              {coreLabels[plan.corePieces.indexOf(piece)]}
            </p>
            <p className="pk-core-tag">{t("pkCoreTag")}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function PackingLayout({
  balance,
  onBalance,
  plan,
  loading,
  error,
  checked,
  onToggle,
  totalItems,
  packedCount,
  onBack,
}: LayoutProps) {
  const { lang, t } = useLang();
  return (
    <div className="pk-page">
      <BalanceSlider balance={balance} onBalance={onBalance} />

      <div className="pk-main">
        <div className="pk-backbar">
          <button type="button" className="pk-back" onClick={onBack}>
            ‹ {t("backToHome")}
          </button>
        </div>

        <header className="pk-header">
          <p className="pk-eyebrow">{t("pkEyebrow")}</p>
          {plan && (
            <p className="pk-summary">
              {lang === "zh" ? plan.summary : plan.summaryEn}
            </p>
          )}
          <p className="pk-progress" aria-live="polite">
            {t("pkPacked")} {packedCount} / {totalItems}
            {loading && <span className="pk-loading"> · {t("pkUpdating")}</span>}
          </p>
        </header>

        {error && (
          <div className="error-banner" role="alert">
            {error}
          </div>
        )}

        {plan && (
          <div className="pk-body">
            <Checklist plan={plan} checked={checked} onToggle={onToggle} />
            <div className="pk-side">
              <Essentials plan={plan} checked={checked} onToggle={onToggle} />
              <CorePieces plan={plan} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
