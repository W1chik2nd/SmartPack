import type { PackingPlan } from "../api";

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
};

/** Vertical slider (sketch: 丰富造型 at top · 精简出行 at bottom). */
function BalanceSlider({
  balance,
  onBalance,
}: {
  balance: number;
  onBalance: (n: number) => void;
}) {
  return (
    <aside className="pk-slider">
      <span className="pk-slider-cap pk-slider-top">丰富造型</span>
      <input
        className="pk-range"
        type="range"
        min={0}
        max={100}
        step={1}
        value={balance}
        onChange={(e) => onBalance(Number(e.target.value))}
        aria-label="打包偏好:精简出行 到 丰富造型"
        aria-valuetext={
          balance >= 67 ? "丰富造型" : balance <= 33 ? "精简出行" : "均衡"
        }
      />
      <span className="pk-slider-cap pk-slider-bottom">精简出行</span>
    </aside>
  );
}

/** The checklist (sketch: 打包清单, grouped by 类目 with tickable rows). */
function Checklist({
  plan,
  checked,
  onToggle,
}: {
  plan: PackingPlan;
  checked: Record<string, boolean>;
  onToggle: (id: string) => void;
}) {
  return (
    <section className="pk-list" aria-label="打包清单">
      <h1 className="pk-list-title">打包清单</h1>
      {plan.categories.map((cat) => (
        <div className="pk-cat" key={cat.id}>
          <h2 className="pk-cat-title">{cat.title}</h2>
          <ul className="pk-cat-items">
            {cat.items.map((item) => (
              <li key={item.id}>
                <label className="pk-row">
                  <input
                    type="checkbox"
                    checked={!!checked[item.id]}
                    onChange={() => onToggle(item.id)}
                  />
                  <span className="pk-row-label">{item.label}</span>
                  <span className="pk-row-reuse" title="复用次数">
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

/** 重要物品提醒 box: non-clothing must-brings, ID / passport first (US 7.x). */
function Essentials({
  plan,
  checked,
  onToggle,
}: {
  plan: PackingPlan;
  checked: Record<string, boolean>;
  onToggle: (id: string) => void;
}) {
  return (
    <section className="pk-essentials" aria-label="重要物品提醒">
      <h2 className="pk-essentials-title">重要物品提醒</h2>
      <ul className="pk-essentials-items">
        {plan.essentials.map((e) => (
          <li key={e.id}>
            <label className="pk-row">
              <input
                type="checkbox"
                checked={!!checked[e.id]}
                onChange={() => onToggle(e.id)}
              />
              <span className="pk-row-label">{e.label}</span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** 核心单品 cards: the most-reused hero pieces the whole plan leans on
    (sketch: T-shirt cards with 复用次数:n / 核心单品). US 6.2, 1.3. */
function CorePieces({ plan }: { plan: PackingPlan }) {
  return (
    <section className="pk-core" aria-label="核心单品">
      <div className="pk-core-grid">
        {plan.corePieces.map((piece) => (
          <article className="pk-core-card" key={piece.id}>
            {/* Geometric garment mark, drawn in CSS — decorative (§8) */}
            <div className="pk-core-icon" aria-hidden="true" />
            <p className="pk-core-reuse">
              复用次数:<strong>{piece.reuse}</strong>
            </p>
            <p className="pk-core-name">{piece.label}</p>
            <p className="pk-core-tag">核心单品</p>
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
}: LayoutProps) {
  return (
    <div className="pk-page">
      <BalanceSlider balance={balance} onBalance={onBalance} />

      <div className="pk-main">
        <header className="pk-header">
          <p className="pk-eyebrow">Minimal Luggage Plan</p>
          {plan && <p className="pk-summary">{plan.summary}</p>}
          <p className="pk-progress" aria-live="polite">
            已打包 {packedCount} / {totalItems}
            {loading && <span className="pk-loading"> · 更新中…</span>}
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
