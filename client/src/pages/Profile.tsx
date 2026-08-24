import { useState, type FormEvent } from "react";
import { updateProfile, type User } from "../api";
import { useLang } from "../i18n/useLang";

type Props = { user: User; onBack: () => void; onSaved: (user: User) => void };
type Avatar = "woman" | "man";
type Draft = {
  nickname: string;
  gender: string;
  height: string;
  weight: string;
  chest: string;
  waist: string;
  hips: string;
  bodyType: string;
  season: string;
};

function avatarForGender(gender: string | null): Avatar | null {
  if (gender === "man" || gender === "male" || gender === "男") return "man";
  if (gender === "woman" || gender === "female" || gender === "女") return "woman";
  return null;
}

function AvatarArt({ variant }: { variant: Avatar }) {
  return (
    <img
      className="profile-avatar-image"
      src={variant === "man" ? "/profile-male.svg" : "/profile-female.svg"}
      alt=""
    />
  );
}

export default function Profile({ user, onBack, onSaved }: Props) {
  const { lang, t } = useLang();
  const [draft, setDraft] = useState<Draft>({
    nickname: user.name,
    gender: user.gender ?? "",
    height: user.heightCm?.toString() ?? "",
    weight: user.weightKg?.toString() ?? "",
    chest: user.chestCm?.toString() ?? "",
    waist: user.waistCm?.toString() ?? "",
    hips: user.hipsCm?.toString() ?? "",
    bodyType: user.bodyType ?? "",
    season: user.season ?? "",
  });
  const [styles, setStyles] = useState<string[]>(user.stylePreferences ?? []);
  const [temperature, setTemperature] = useState(user.temperature ?? "");
  const [packingHabits, setPackingHabits] = useState<string[]>(user.packingHabits ?? []);
  const [notice, setNotice] = useState<"saved" | "error" | null>(null);
  const avatar = avatarForGender(draft.gender);

  const measurements = [
    { key: "height", label: t("profileHeight"), unit: "cm" },
    { key: "weight", label: t("profileWeight"), unit: "kg" },
    { key: "chest", label: t("profileChest"), unit: "cm" },
    { key: "waist", label: t("profileWaist"), unit: "cm" },
    { key: "hips", label: t("profileHips"), unit: "cm" },
  ] as const;
  const styleOptions = [
    ["minimal", "极简", "Minimal"],
    ["business", "商务", "Business"],
    ["casual", "休闲", "Casual"],
    ["street", "街头", "Streetwear"],
    ["outdoor", "户外", "Outdoor"],
    ["elegant", "优雅", "Elegant"],
  ];
  const temperatureOptions = [
    ["cold", "怕冷", "Runs cold"],
    ["average", "正常", "Average"],
    ["warm", "怕热", "Runs warm"],
  ];
  const packingOptions = [
    ["light", "轻装优先", "Pack light"],
    ["variety", "造型优先", "More variety"],
    ["essentials", "总带必需品", "Always-bring list"],
  ];
  const seasons = [
    ["spring", "春", "Spring"],
    ["summer", "夏", "Summer"],
    ["autumn", "秋", "Autumn"],
    ["winter", "冬", "Winter"],
  ];

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setNotice(null);
  }

  function toggle(list: string[], value: string, setter: (next: string[]) => void) {
    setter(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
    setNotice(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      const { user: updated } = await updateProfile({
        name: draft.nickname,
        gender: draft.gender,
        heightCm: draft.height ? Number(draft.height) : null,
        weightKg: draft.weight ? Number(draft.weight) : null,
        chestCm: draft.chest ? Number(draft.chest) : null,
        waistCm: draft.waist ? Number(draft.waist) : null,
        hipsCm: draft.hips ? Number(draft.hips) : null,
        bodyType: draft.bodyType,
        season: draft.season,
        stylePreferences: styles,
        temperature,
        packingHabits,
      });
      onSaved(updated);
      setNotice("saved");
    } catch {
      setNotice("error");
    }
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
              {avatar ? (
                <>
                  <AvatarArt variant={avatar} />
                  <span className="avatar-caption">
                    {avatar === "man" ? t("profileMaleAvatar") : t("profileFemaleAvatar")}
                  </span>
                </>
              ) : (
                <span className="avatar-empty">{t("profileChoose")}</span>
              )}
            </div>
          </fieldset>

          <label className="profile-text-field">
            <span>{t("profileNickname")}</span>
            <input value={draft.nickname} onChange={(event) => update("nickname", event.target.value)} autoComplete="nickname" />
          </label>
          <label className="profile-text-field">
            <span>{t("profileGender")}</span>
            <select
              value={draft.gender}
              onChange={(event) => {
                const value = event.target.value;
                update("gender", value);
              }}
            >
              <option value="">—</option>
              <option value="woman">{t("profileWoman")}</option>
              <option value="man">{t("profileMan")}</option>
              <option value="other">{t("profileOther")}</option>
              <option value="private">{t("profilePrivate")}</option>
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
            {measurements.map((field) => (
              <label key={field.key} className="measurement-field">
                <span>{field.label}</span>
                <span className="measurement-input">
                  <input type="number" inputMode="decimal" min="1" step="0.1" value={draft[field.key]} onChange={(event) => update(field.key, event.target.value)} />
                  <b>{field.unit}</b>
                </span>
              </label>
            ))}
            <label className="measurement-field body-type-field">
              <span>{t("profileBodyType")}</span>
              <select value={draft.bodyType} onChange={(event) => update("bodyType", event.target.value)}>
                <option value="">{t("profileChoose")}</option>
                <option value="straight">{t("profileStraight")}</option>
                <option value="triangle">{t("profileTriangle")}</option>
                <option value="inverted">{t("profileInverted")}</option>
                <option value="hourglass">{t("profileHourglass")}</option>
              </select>
            </label>
          </div>

          <fieldset className="season-picker">
            <legend>{t("profileSeasonType")}</legend>
            <div>
              {seasons.map(([value, zh, en]) => (
                <button key={value} type="button" aria-pressed={draft.season === value} className={draft.season === value ? "is-active" : ""} onClick={() => update("season", value)}>
                  {lang === "zh" ? zh : en}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="preference-stack">
            <details open>
              <summary><span>{t("profileStylePreferences")}</span><b>02</b></summary>
              <div className="preference-options">
                {styleOptions.map(([value, zh, en]) => (
                  <button key={value} type="button" aria-pressed={styles.includes(value)} onClick={() => toggle(styles, value, setStyles)}>{lang === "zh" ? zh : en}</button>
                ))}
              </div>
            </details>
            {temperature && (
              <details open>
                <summary><span>{t("profileTemperature")}</span><b>03</b></summary>
                <div className="preference-options">
                  {temperatureOptions.map(([value, zh, en]) => (
                    <button key={value} type="button" aria-pressed={temperature === value} onClick={() => { setTemperature(value); setNotice(null); }}>{lang === "zh" ? zh : en}</button>
                  ))}
                </div>
              </details>
            )}
            {packingHabits.length > 0 && (
              <details open>
                <summary><span>{t("profilePackingHabits")}</span><b>04</b></summary>
                <div className="preference-options">
                  {packingOptions.map(([value, zh, en]) => (
                    <button key={value} type="button" aria-pressed={packingHabits.includes(value)} onClick={() => toggle(packingHabits, value, setPackingHabits)}>{lang === "zh" ? zh : en}</button>
                  ))}
                </div>
              </details>
            )}
          </div>

          <div className="profile-actions">
            <p className={notice ? "is-visible" : ""} role="status">
              {notice === "saved" ? t("profileSaved") : notice === "error" ? t("profileSaveFailed") : ""}
            </p>
            <button className="profile-submit" type="submit">{t("profileFinish")}</button>
          </div>
        </section>
      </form>
    </main>
  );
}
