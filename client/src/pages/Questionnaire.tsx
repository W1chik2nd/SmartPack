import { useEffect, useState, type FormEvent } from "react";
import {
  profileOptions,
  register,
  setToken,
  type Credentials,
  type Profile,
  type ProfileField,
  type User,
} from "../api";
import OptionGroup from "../components/OptionGroup";
import { useLang } from "../i18n/useLang";
import { STRINGS, type StringKey } from "../i18n/strings";

type Props = {
  credentials: Credentials;
  onAuthed: (user: User) => void;
  onBack: () => void;
};

/** Numeric/text inputs keep their raw string until submit; choices keep ids. */
type TextState = Record<string, string>;
type ChoiceState = Record<string, string[]>;

const NUMERIC_KINDS: ProfileField["kind"][] = ["int", "decimal"];

/**
 * Sign-up step 2 of 2: the profile questionnaire. Submitting this form is what
 * actually creates the account — credentials from step 1 plus these answers go
 * to /api/register in a single call. Leaving before submitting means no
 * account, by design.
 *
 * The field list and every option come from GET /api/profile-options
 * (AGENTS.md §3): this page renders the catalog and collects answers, it does
 * not own them. Only name/age/height/weight are required; the rest improve
 * personalization (US 2.1–2.3) and never block sign-up.
 */
export default function Questionnaire({ credentials, onAuthed, onBack }: Props) {
  const { t } = useLang();
  const [fields, setFields] = useState<ProfileField[] | null>(null);
  const [text, setText] = useState<TextState>({});
  const [choices, setChoices] = useState<ChoiceState>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  // First click on an incomplete form only warns; the second submits.
  const [warned, setWarned] = useState(false);

  useEffect(() => {
    profileOptions()
      .then((r) => setFields(r.fields))
      .catch(() => setError(t("optionsLoadError")));
    // t is stable for a given language; the catalog is language-neutral, so
    // fetching once on mount is correct.
  }, []);

  function fail(message: string) {
    setError(message);
    setShake(true);
    setTimeout(() => setShake(false), 500);
  }

  function setValue(key: string, value: string) {
    setText((prev) => ({ ...prev, [key]: value }));
  }

  function toggleChoice(field: ProfileField, id: string) {
    setChoices((prev) => {
      const current = prev[field.key] ?? [];
      if (field.kind === "single") {
        // Re-picking the selected radio clears it: these fields are optional,
        // so there must be a way back to "not answered".
        return { ...prev, [field.key]: current[0] === id ? [] : [id] };
      }
      return {
        ...prev,
        [field.key]: current.includes(id)
          ? current.filter((v) => v !== id)
          : [...current, id],
      };
    });
  }

  function answered(field: ProfileField): boolean {
    if (field.kind === "single" || field.kind === "multi") {
      return (choices[field.key] ?? []).length > 0;
    }
    return (text[field.key] ?? "").trim().length > 0;
  }

  function buildProfile(list: ProfileField[]): Profile {
    const profile: Profile = {};
    for (const field of list) {
      if (!answered(field)) continue;
      if (field.kind === "multi") {
        profile[field.key] = choices[field.key];
      } else if (field.kind === "single") {
        profile[field.key] = choices[field.key][0];
      } else if (NUMERIC_KINDS.includes(field.kind)) {
        profile[field.key] = Number(text[field.key]);
      } else {
        profile[field.key] = text[field.key].trim();
      }
    }
    return profile;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!fields) return;
    setError(null);

    // Required fields are enforced by the browser (required attr) and the
    // server. This check is only about the optional ones: an incomplete
    // profile is allowed, but not silently — warn once, submit on the retry.
    if (!warned && fields.some((f) => !answered(f))) {
      setWarned(true);
      return;
    }

    setBusy(true);
    try {
      const { token, user } = await register(credentials, buildProfile(fields));
      setToken(token);
      onAuthed(user);
    } catch (err) {
      fail(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setBusy(false);
    }
  }

  // Field labels are UI copy, so they stay in the client's string table; the
  // server sends language-neutral keys and option labels for both languages.
  // A key with no string yet falls back to the key itself: the server owns the
  // catalog, so it can ship a new question before this table catches up, and
  // that must degrade to an ugly label — never a crash that blocks sign-up.
  const label = (key: string) =>
    key in STRINGS ? t(key as StringKey) : key;

  function numberInput(field: ProfileField) {
    return (
      <div className="field" key={field.key}>
        <label htmlFor={`q-${field.key}`}>
          {label(field.key)}
          {!field.required && (
            <span className="field-optional"> ({t("optionalMark")})</span>
          )}
        </label>
        <input
          id={`q-${field.key}`}
          type="number"
          inputMode={field.kind === "int" ? "numeric" : "decimal"}
          min={field.min}
          max={field.max}
          step={field.kind === "int" ? 1 : 0.1}
          value={text[field.key] ?? ""}
          onChange={(e) => setValue(field.key, e.target.value)}
          required={field.required}
        />
      </div>
    );
  }

  const byKey = (key: string) => fields?.find((f) => f.key === key);
  const measurementKeys = ["bustCm", "waistCm", "hipCm"];
  const choiceFields =
    fields?.filter((f) => f.kind === "single" || f.kind === "multi") ?? [];

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

          {fields && (
            <>
              <p className="form-section">{t("requiredSection")}</p>

              <div className="field">
                <label htmlFor="q-name">{label("name")}</label>
                <input
                  id="q-name"
                  type="text"
                  autoComplete="name"
                  maxLength={byKey("name")?.max}
                  value={text.name ?? ""}
                  onChange={(e) => setValue("name", e.target.value)}
                  required
                />
              </div>

              {numberInput(byKey("age")!)}

              <div className="field-row">
                {numberInput(byKey("heightCm")!)}
                {numberInput(byKey("weightKg")!)}
              </div>

              <p className="form-section">{t("optionalSection")}</p>

              <div className="field-row field-row-3">
                {measurementKeys.map((key) => {
                  const field = byKey(key);
                  return field ? numberInput(field) : null;
                })}
              </div>

              {choiceFields.map((field) => (
                <OptionGroup
                  key={field.key}
                  name={field.key}
                  legend={`${label(field.key)} (${t("optionalMark")})`}
                  options={field.options ?? []}
                  selected={choices[field.key] ?? []}
                  multiple={field.kind === "multi"}
                  onToggle={(id) => toggleChoice(field, id)}
                  hint={field.kind === "multi" ? t("pickMultiple") : undefined}
                />
              ))}
            </>
          )}

          <button className="btn-primary" type="submit" disabled={busy || !fields}>
            {busy ? t("creating") : t("finishCreate")}
          </button>

          {/* Sits directly under the button: it explains what that click did.
              role="status" announces it without stealing focus. */}
          {warned && (
            <p className="incomplete-warning" role="status">
              {t("incompleteWarning")}
            </p>
          )}

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
