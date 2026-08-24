import { useEffect, useState, type FormEvent } from "react";
import {
  profileOptions,
  updateProfile,
  type ProfileField,
  type ProfileOption,
  type ProfileUpdate,
  type User,
} from "../api";
import { useLang } from "../i18n/useLang";
import PersonalColorGuide from "../components/PersonalColorGuide";

type Props = { user: User; onBack: () => void; onSaved: (user: User) => void };
type Avatar = "woman" | "man";
type Draft = {
  name: string;
  gender: string;
  age: string;
  height: string;
  weight: string;
  bust: string;
  waist: string;
  hip: string;
  bodyType: string;
  seasonColorType: string;
  wearFeelOther: string;
  travelHabitsOther: string;
};

function avatarForGender(gender: string | null): Avatar | null {
  if (gender === "male") return "man";
  if (gender === "female") return "woman";
  return null;
}

function AvatarArt({ variant }: { variant: Avatar }) {
  return (
    <img
      className="profile-avatar-image"
      src={variant === "man" ? "/profile-male.jpg" : "/profile-female.jpg"}
      alt=""
    />
  );
}

export default function Profile({ user, onBack, onSaved }: Props) {
  const { lang, t } = useLang();
  const [fields, setFields] = useState<ProfileField[] | null>(null);
  const [draft, setDraft] = useState<Draft>({
    name: user.name,
    gender: user.gender ?? "",
    age: user.age?.toString() ?? "",
    height: user.heightCm?.toString() ?? "",
    weight: user.weightKg?.toString() ?? "",
    bust: user.bustCm?.toString() ?? "",
    waist: user.waistCm?.toString() ?? "",
    hip: user.hipCm?.toString() ?? "",
    bodyType: user.bodyType ?? "",
    seasonColorType: user.seasonColorType ?? "",
    wearFeelOther: user.wearFeelOther ?? "",
    travelHabitsOther: user.travelHabitsOther ?? "",
  });
  const [styles, setStyles] = useState(user.stylePrefs);
  const [wearFeel, setWearFeel] = useState(user.wearFeel);
  const [travelHabits, setTravelHabits] = useState(user.travelHabits);
  const [notice, setNotice] = useState<"saved" | "error" | "options" | null>(null);
  const [colorGuideOpen, setColorGuideOpen] = useState(false);
  const avatar = avatarForGender(draft.gender);

  useEffect(() => {
    profileOptions()
      .then(({ fields: current }) => setFields(current))
      .catch(() => setNotice("options"));
  }, []);

  const field = (key: string) => fields?.find((item) => item.key === key);
  const options = (key: string) => field(key)?.options ?? [];
  const optionLabel = (option: ProfileOption) => lang === "zh" ? option.zh : option.en;
  const otherId = (key: string) => field(key)?.otherId;

  const measurements = [
    { key: "age", apiKey: "age", label: t("profileAge"), unit: "" },
    { key: "height", apiKey: "heightCm", label: t("profileHeight"), unit: "cm" },
    { key: "weight", apiKey: "weightKg", label: t("profileWeight"), unit: "kg" },
    { key: "bust", apiKey: "bustCm", label: t("profileBust"), unit: "cm" },
    { key: "waist", apiKey: "waistCm", label: t("profileWaist"), unit: "cm" },
    { key: "hip", apiKey: "hipCm", label: t("profileHip"), unit: "cm" },
  ] as const;

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setNotice(null);
  }

  function toggle(
    list: string[],
    value: string,
    setter: (next: string[]) => void,
    key: "wearFeel" | "travelHabits" | "stylePrefs"
  ) {
    const other = otherId(key);
    let next: string[];
    if (list.includes(value)) next = list.filter((item) => item !== value);
    else if (value === other) next = [value];
    else next = [...list.filter((item) => item !== other), value];
    setter(next);
    if (key === "wearFeel" && !next.includes(other ?? "")) update("wearFeelOther", "");
    if (key === "travelHabits" && !next.includes(other ?? "")) update("travelHabitsOther", "");
    setNotice(null);
  }

  function optionalNumber(key: keyof Pick<Draft, "bust" | "waist" | "hip">) {
    return draft[key] ? Number(draft[key]) : undefined;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const payload: ProfileUpdate = {
      name: draft.name.trim(),
      gender: draft.gender,
      age: Number(draft.age),
      heightCm: Number(draft.height),
      weightKg: Number(draft.weight),
      stylePrefs: styles,
      wearFeel,
      travelHabits,
    };
    const optional = {
      bustCm: optionalNumber("bust"),
      waistCm: optionalNumber("waist"),
      hipCm: optionalNumber("hip"),
      bodyType: draft.bodyType || undefined,
      seasonColorType: draft.seasonColorType || undefined,
      wearFeelOther: draft.wearFeelOther.trim() || undefined,
      travelHabitsOther: draft.travelHabitsOther.trim() || undefined,
    };
    for (const [key, value] of Object.entries(optional)) {
      if (value !== undefined) payload[key] = value;
    }

    try {
      const { user: updated } = await updateProfile(payload);
      onSaved(updated);
      setNotice("saved");
    } catch {
      setNotice("error");
    }
  }

  function preference(
    key: "stylePrefs" | "wearFeel" | "travelHabits",
    title: string,
    number: string,
    selected: string[],
    setter: (next: string[]) => void
  ) {
    const other = otherId(key);
    const otherValue = key === "wearFeel" ? draft.wearFeelOther : draft.travelHabitsOther;
    return (
      <details open>
        <summary><span>{title}</span><b>{number}</b></summary>
        <div className="preference-options">
          {options(key).map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={selected.includes(option.id)}
              onClick={() => toggle(selected, option.id, setter, key)}
            >
              {optionLabel(option)}
            </button>
          ))}
        </div>
        {other && selected.includes(other) && key !== "stylePrefs" && (
          <label className="profile-choice-other">
            <span>{t("otherPlaceholder")}</span>
            <input
              value={otherValue}
              maxLength={field(key)?.otherMax}
              onChange={(event) => update(
                key === "wearFeel" ? "wearFeelOther" : "travelHabitsOther",
                event.target.value
              )}
            />
          </label>
        )}
      </details>
    );
  }

  return (
    <main className="profile-page">
      <header className="profile-heading">
        <button className="profile-back" type="button" onClick={onBack}>
          <span aria-hidden="true">←</span> {t("backToHome")}
        </button>
        <div>
          <p className="profile-kicker">SmartPack / 03</p>
          <h1>{t("profileTitle")}</h1>
        </div>
      </header>

      <form className="profile-board" onSubmit={handleSubmit}>
        <aside className="profile-identity">
          <fieldset className="avatar-picker">
            <legend>{t("profileAvatar")}</legend>
            <div className="avatar-stage">
              {avatar && <AvatarArt variant={avatar} />}
            </div>
          </fieldset>

          <label className="profile-text-field">
            <span>{t("profileNickname")}</span>
            <input required value={draft.name} onChange={(event) => update("name", event.target.value)} autoComplete="name" />
          </label>
          <label className="profile-text-field">
            <span>{t("profileGender")}</span>
            <select required value={draft.gender} onChange={(event) => update("gender", event.target.value)}>
              <option value=""></option>
              {options("gender").map((option) => (
                <option key={option.id} value={option.id}>{optionLabel(option)}</option>
              ))}
            </select>
          </label>
        </aside>

        <section className="profile-details">
          <div className="profile-section-head">
            <span className="section-number">01</span>
            <div>
              <h2>{t("profileMeasurements")}</h2>
              <p>{t("profileMeasurementsHint")}</p>
            </div>
          </div>

          <div className="measurement-grid">
            {measurements.map((item) => {
              const spec = field(item.apiKey);
              return (
                <label key={item.key} className="measurement-field">
                  <span>{item.label}</span>
                  <span className="measurement-input">
                    <input
                      type="number"
                      inputMode={spec?.kind === "int" ? "numeric" : "decimal"}
                      min={spec?.min}
                      max={spec?.max}
                      step={spec?.kind === "int" ? 1 : 0.1}
                      required={spec?.required}
                      value={draft[item.key]}
                      onChange={(event) => update(item.key, event.target.value)}
                    />
                    <b>{item.unit}</b>
                  </span>
                </label>
              );
            })}
            <label className="measurement-field body-type-field">
              <span>{t("profileBodyType")}</span>
              <select value={draft.bodyType} onChange={(event) => update("bodyType", event.target.value)}>
                <option value=""></option>
                {options("bodyType").map((option) => (
                  <option key={option.id} value={option.id}>{optionLabel(option)}</option>
                ))}
              </select>
            </label>
          </div>

          <fieldset className="season-picker">
            <legend>{t("profileSeasonType")}</legend>
            <div>
              {options("seasonColorType").map((option) => (
                <button key={option.id} type="button" aria-pressed={draft.seasonColorType === option.id} onClick={() => update("seasonColorType", draft.seasonColorType === option.id ? "" : option.id)}>
                  {optionLabel(option)}
                </button>
              ))}
            </div>
            <button type="button" className="season-help-button" onClick={() => setColorGuideOpen(true)}>
              不知道自己的四季型？做照片分析问卷 →
            </button>
          </fieldset>

          <div className="preference-stack">
            {preference("stylePrefs", t("profileStylePreferences"), "02", styles, setStyles)}
            {preference("wearFeel", t("profileWearFeel"), "03", wearFeel, setWearFeel)}
            {preference("travelHabits", t("profileTravelHabits"), "04", travelHabits, setTravelHabits)}
          </div>

          <div className="profile-actions">
            <p className={notice ? "is-visible" : ""} role="status">
              {notice === "saved" ? t("profileSaved") : notice === "options" ? t("optionsLoadError") : notice === "error" ? t("profileSaveFailed") : ""}
            </p>
            <button className="profile-submit" type="submit" disabled={!fields}>{t("profileFinish")}</button>
          </div>
        </section>
      </form>
      {colorGuideOpen && (
        <PersonalColorGuide
          onClose={() => setColorGuideOpen(false)}
          onSeasonDetected={(season) => {
            update("seasonColorType", season);
            setColorGuideOpen(false);
          }}
        />
      )}
    </main>
  );
}
