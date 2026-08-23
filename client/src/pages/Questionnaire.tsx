import { useState, type FormEvent } from "react";
import { register, setToken, type Credentials, type User } from "../api";
import { useLang } from "../i18n/useLang";

type Props = {
  credentials: Credentials;
  onAuthed: (user: User) => void;
  onBack: () => void;
};

// Style options mirror the "Dressing Preference Learning" feature
// (docs/personas-and-user-stories.md, US 2.x): the answer seeds the
// recommendation engine's first profile. Stored value stays English (it is
// data, not UI); the label shown follows the current language.
const STYLES: { value: string; zh: string }[] = [
  { value: "Business", zh: "商务" },
  { value: "Casual", zh: "休闲" },
  { value: "Streetwear", zh: "街头" },
  { value: "Minimalist", zh: "极简" },
  { value: "Outdoor", zh: "户外" },
  { value: "Elegant", zh: "优雅" },
];

/**
 * Sign-up step 2 of 2: the style questionnaire. Submitting this form is what
 * actually creates the account — credentials from step 1 plus these answers
 * go to /api/register in a single call. Leaving before submitting means no
 * account, by design.
 */
export default function Questionnaire({ credentials, onAuthed, onBack }: Props) {
  const { lang, t } = useLang();
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [style, setStyle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);

  function fail(message: string) {
    setError(message);
    setShake(true);
    setTimeout(() => setShake(false), 500);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { token, user } = await register(credentials, {
        name,
        age: Number(age),
        heightCm: Number(heightCm),
        weightKg: Number(weightKg),
        style,
      });
      setToken(token);
      onAuthed(user);
    } catch (err) {
      fail(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-visual" aria-hidden="true">
        <img src="/auth-visual.jpeg" alt="" />
      </div>

      <div className="auth-panel">
        <div className="auth-headline">
          <p className="auth-step">{t("step2")}</p>
          <h1>{t("quizTitle")}</h1>
          <p>{t("quizSubtitle")}</p>
        </div>

        <form
          className={`auth-card${shake ? " shake" : ""}`}
          onSubmit={handleSubmit}
          aria-busy={busy}
        >
          {error && (
            <div className="error-banner" role="alert">
              {error}
            </div>
          )}

          <div className="field">
            <label htmlFor="q-name">{t("name")}</label>
            <input
              id="q-name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="q-age">{t("age")}</label>
            <input
              id="q-age"
              type="number"
              inputMode="numeric"
              min={1}
              max={120}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              required
            />
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="q-height">{t("heightCm")}</label>
              <input
                id="q-height"
                type="number"
                inputMode="decimal"
                min={1}
                step="0.1"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="q-weight">{t("weightKg")}</label>
              <input
                id="q-weight"
                type="number"
                inputMode="decimal"
                min={1}
                step="0.1"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                required
              />
            </div>
          </div>

          <fieldset className="field style-options">
            <legend>{t("preferredStyle")}</legend>
            {STYLES.map((option) => (
              <label
                key={option.value}
                className={`style-option${style === option.value ? " selected" : ""}`}
              >
                <input
                  type="radio"
                  name="style"
                  value={option.value}
                  checked={style === option.value}
                  onChange={() => setStyle(option.value)}
                  required
                />
                {lang === "zh" ? option.zh : option.value}
              </label>
            ))}
          </fieldset>

          <button className="btn-primary" type="submit" disabled={busy}>
            {busy ? t("creating") : t("finishCreate")}
          </button>

          <div className="auth-switch">
            <button type="button" onClick={onBack}>
              {t("backToAccount")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
