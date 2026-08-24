import {
  WARDROBE_FILTER_OPTIONS,
  type WardrobeFilterId,
} from "../lib/wardrobe-filter";
import { wardrobeFilterCountMessage } from "../i18n/dynamic-strings";
import { useLang } from "../i18n/useLang";
import "./WardrobeFilter.css";

type Props = {
  value: WardrobeFilterId;
  visibleCount: number;
  totalCount: number;
  onChange: (value: WardrobeFilterId) => void;
};

export default function WardrobeFilter({
  value,
  visibleCount,
  totalCount,
  onChange,
}: Props) {
  const { lang, t } = useLang();

  return (
    <div className="wardrobe-filter-wrap">
      <label className="wardrobe-filter">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 5h18l-7 8v5l-4 2v-7L3 5Z" />
        </svg>
        <span>{t("wardrobeFilter")}</span>
        <select
          value={value}
          onChange={(event) => onChange(event.target.value as WardrobeFilterId)}
          aria-label={t("wardrobeFilterAria")}
        >
          {WARDROBE_FILTER_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {t(option.labelKey)}
            </option>
          ))}
        </select>
      </label>
      <span className="wardrobe-filter-count" aria-live="polite">
        {wardrobeFilterCountMessage(lang, visibleCount, totalCount)}
      </span>
    </div>
  );
}
