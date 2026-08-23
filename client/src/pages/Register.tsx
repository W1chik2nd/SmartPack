import { useState, type FormEvent } from "react";
import { checkEmail, type Credentials } from "../api";

type Props = {
  onContinue: (credentials: Credentials) => void;
  onSwitch: () => void;
};

/**
 * Sign-up step 1 of 2: account credentials only. Nothing is sent to the
 * database here — the account is created in one call after the style
 * questionnaire (step 2), so an abandoned sign-up stores nothing.
 */
export default function Register({ onContinue, onSwitch }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
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

    // The confirm field never leaves the browser, so this is the one check
    // that belongs here. All other rules (password length, email format,
    // duplicates) are enforced by the API — the trust boundary — and its
    // error messages are shown as-is.
    if (password !== confirm) {
      fail("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      // Fail fast on taken/invalid emails so users don't fill the
      // questionnaire for nothing. Creates no account.
      await checkEmail(email);
      onContinue({ email, password });
    } catch (err) {
      fail(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      {/* Left visual panel; hidden on mobile (auth.css). Decorative only,
          so the image carries no alt text for screen readers. */}
      <div className="auth-visual" aria-hidden="true">
        <img src="/auth-visual.jpeg" alt="" />
      </div>

      <div className="auth-panel">
        <div className="auth-headline">
          <p className="auth-step">Step 1 of 2</p>
          <h1>Create your SmartPack account</h1>
          <p>One account. Every outfit. Every trip.</p>
        </div>

        <form
          className={`auth-card${shake ? " shake" : ""}`}
          onSubmit={handleSubmit}
          aria-busy={busy}
        >
          {/* role="alert" makes screen readers announce failures immediately */}
          {error && (
            <div className="error-banner" role="alert">
              {error}
            </div>
          )}

          <div className="field">
            <label htmlFor="reg-email">Email</label>
            <input
              id="reg-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="reg-password">Password</label>
            <input
              id="reg-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby="reg-password-hint"
              required
            />
            <p className="field-hint" id="reg-password-hint">
              At least 8 characters.
            </p>
          </div>

          <div className="field">
            <label htmlFor="reg-confirm">Confirm Password</label>
            <input
              id="reg-confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>

          <button className="btn-primary" type="submit" disabled={busy}>
            {busy ? "Checking…" : "Continue"}
          </button>

          <div className="auth-switch">
            Already have an account?{" "}
            <button type="button" onClick={onSwitch}>
              Sign in.
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
