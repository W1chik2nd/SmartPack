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
  /** Option id that opens the free-text box, when this field offers one. */
  otherId?: string;
  otherValue?: string;
  otherMax?: number;
  otherLabel?: string;
  onOtherChange?: (value: string) => void;
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
  otherId,
  otherValue,
  otherMax,
  otherLabel,
  onOtherChange,
}: Props) {
  const { lang } = useLang();
  const otherPicked = otherId != null && selected.includes(otherId);

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

      {/* Only rendered once "other" is picked. An always-visible box would
          invite text that gets discarded the moment the option is unchecked. */}
      {otherPicked && (
        <div className="option-other">
          <label className="option-other-label" htmlFor={`q-${name}-other`}>
            {otherLabel}
          </label>
          <input
            id={`q-${name}-other`}
            type="text"
            maxLength={otherMax}
            value={otherValue ?? ""}
            onChange={(e) => onOtherChange?.(e.target.value)}
            autoFocus
          />
        </div>
      )}
    </fieldset>
  );
}
