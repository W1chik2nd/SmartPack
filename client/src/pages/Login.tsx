import { useState, type FormEvent } from "react";
import { login, setToken, type User } from "../api";

type Props = {
  onAuthed: (user: User) => void;
  onSwitch: () => void;
};

export default function Login({ onAuthed, onSwitch }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { token, user } = await login(email, password);
      setToken(token);
      onAuthed(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-headline">
        <h1>Sign in to SmartPack</h1>
        <p>Your wardrobe, your trips, one plan.</p>
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
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button className="btn-primary" type="submit" disabled={busy}>
          {busy ? "Signing In…" : "Sign In"}
        </button>

        <div className="auth-switch">
          Don&apos;t have an account?{" "}
          <button type="button" onClick={onSwitch}>
            Create yours now.
          </button>
        </div>
      </form>
    </div>
  );
}
