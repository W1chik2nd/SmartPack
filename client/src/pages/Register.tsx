import { useState, type FormEvent } from "react";
import { register, setToken, type User } from "../api";

type Props = {
  onAuthed: (user: User) => void;
  onSwitch: () => void;
};

export default function Register({ onAuthed, onSwitch }: Props) {
  const [name, setName] = useState("");
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

    if (password.length < 8) {
      fail("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      fail("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const { token, user } = await register(email, name, password);
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
      <div className="auth-headline">
        <h1>Create your SmartPack account</h1>
        <p>One account. Every outfit. Every trip.</p>
      </div>

      <form
        className={`auth-card${shake ? " shake" : ""}`}
        onSubmit={handleSubmit}
      >
        {error && <div className="error-banner">{error}</div>}

        <div className="field">
          <label htmlFor="reg-name">Name</label>
          <input
            id="reg-name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

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
            required
          />
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
          {busy ? "Creating Account…" : "Create Account"}
        </button>

        <div className="auth-switch">
          Already have an account?{" "}
          <button type="button" onClick={onSwitch}>
            Sign in.
          </button>
        </div>
      </form>
    </div>
  );
}
