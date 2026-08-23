import { useState, type FormEvent } from "react";
import { register, setToken, type Credentials, type User } from "../api";

type Props = {
  credentials: Credentials;
  onAuthed: (user: User) => void;
  onBack: () => void;
};

// Style options mirror the "Dressing Preference Learning" feature
// (docs/personas-and-user-stories.md, US 2.x): the answer seeds the
// recommendation engine's first profile.
const STYLES = [
  "Business",
  "Casual",
  "Streetwear",
  "Minimalist",
  "Outdoor",
  "Elegant",
];

/**
 * Sign-up step 2 of 2: the style questionnaire. Submitting this form is what
 * actually creates the account — credentials from step 1 plus these answers
 * go to /api/register in a single call. Leaving before submitting means no
 * account, by design.
 */
export default function Questionnaire({ credentials, onAuthed, onBack }: Props) {
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
          <p className="auth-step">Step 2 of 2</p>
          <h1>Tell us about yourself</h1>
          <p>
            SmartPack tailors every outfit to you. Complete this to finish
            creating your account.
          </p>
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
            <label htmlFor="q-name">Name</label>
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
            <label htmlFor="q-age">Age</label>
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
              <label htmlFor="q-height">Height (cm)</label>
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
              <label htmlFor="q-weight">Weight (kg)</label>
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
            <legend>Preferred style</legend>
            {STYLES.map((option) => (
              <label
                key={option}
                className={`style-option${style === option ? " selected" : ""}`}
              >
                <input
                  type="radio"
                  name="style"
                  value={option}
                  checked={style === option}
                  onChange={() => setStyle(option)}
                  required
                />
                {option}
              </label>
            ))}
          </fieldset>

          <button className="btn-primary" type="submit" disabled={busy}>
            {busy ? "Creating Account…" : "Finish & Create Account"}
          </button>

          <div className="auth-switch">
            <button type="button" onClick={onBack}>
              Back to account details.
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
