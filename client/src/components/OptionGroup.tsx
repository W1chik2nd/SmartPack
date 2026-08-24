import type { ProfileOption } from "../api";
import { useLang } from "../i18n/useLang";

type Props = {
  /** Field key, used to build stable input names and ids. */
  name: string;
  legend: string;
  options: ProfileOption[];
  /** Selected option ids. Single-choice groups pass at most one. */
  selected: string[];
  multiple: boolean;
  onToggle: (id: string) => void;
  /** Short helper line under the legend, e.g. "Pick any that apply". */
  hint?: string;
};

/**
 * Flat selectable blocks for the questionnaire's choice fields. Radios for
 * single choice, checkboxes for multi — the native control stays in the DOM
 * (visually inside the block) so keyboard and screen-reader behaviour and
 * grouping come from the platform instead of ARIA reimplementation.
 */
export default function OptionGroup({
  name,
  legend,
  options,
  selected,
  multiple,
  onToggle,
  hint,
}: Props) {
  const { lang } = useLang();

  return (
    <fieldset className="field style-options">
      <legend>{legend}</legend>
      {hint && <p className="option-hint">{hint}</p>}
      {options.map((option) => {
        const checked = selected.includes(option.id);
        return (
          <label
            key={option.id}
            className={`style-option${checked ? " selected" : ""}`}
          >
            <input
              type={multiple ? "checkbox" : "radio"}
              name={name}
              value={option.id}
              checked={checked}
              onChange={() => onToggle(option.id)}
            />
            {lang === "zh" ? option.zh : option.en}
          </label>
        );
      })}
    </fieldset>
  );
}
