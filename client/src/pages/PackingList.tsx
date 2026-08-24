import { useEffect, useMemo, useRef, useState } from "react";
import { getPackingPlan, type PackingPlan } from "../api";
import PackingLayout from "./PackingListView";

// The packing-list screen (sketch: 打包清单 + 造型/精简 slider + 重要物品提醒
// + 核心单品 cards). All packing logic is on the server (AGENTS.md §3); this
// screen only renders the plan, tracks which items the user has ticked off,
// and sends the slider value back to regenerate. Serves US 6.1–6.3 and 7.1.

/** Debounce the slider so dragging doesn't fire a request per pixel. */
function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export default function PackingList() {
  // 0 = 精简出行 (pack lightest) · 100 = 丰富造型 (most variety). The sketch draws
  // the slider vertically with 丰富造型 on top, so the visual top is 100.
  const [balance, setBalance] = useState(50);
  const debouncedBalance = useDebounced(balance, 250);

  const [plan, setPlan] = useState<PackingPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Ticked-off items, keyed by item/essential id. Purely local UI state — the
  // checklist is a "don't forget" aid, not persisted server data (US 7.1).
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  // Guards against out-of-order responses when the slider moves quickly.
  const reqId = useRef(0);

  useEffect(() => {
    const id = ++reqId.current;
    setLoading(true);
    getPackingPlan(debouncedBalance)
      .then(({ plan }) => {
        if (id !== reqId.current) return;
        setPlan(plan);
        setError(null);
      })
      .catch((err) => {
        if (id !== reqId.current) return;
        setError(err instanceof Error ? err.message : "Failed to load plan.");
      })
      .finally(() => {
        if (id === reqId.current) setLoading(false);
      });
  }, [debouncedBalance]);

  const totalItems = useMemo(
    () =>
      plan ? plan.categories.reduce((n, c) => n + c.items.length, 0) : 0,
    [plan]
  );

  function toggle(id: string) {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const packedCount = useMemo(
    () => Object.values(checked).filter(Boolean).length,
    [checked]
  );

  return (
    <PackingLayout
      balance={balance}
      onBalance={setBalance}
      plan={plan}
      loading={loading}
      error={error}
      checked={checked}
      onToggle={toggle}
      totalItems={totalItems}
      packedCount={packedCount}
    />
  );
}
