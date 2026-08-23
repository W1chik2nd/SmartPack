import { useEffect, useState } from "react";
import { me, setToken, logout, type User } from "./api";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/Home";

type Route = "login" | "register" | "home";

export default function App() {
  const [route, setRoute] = useState<Route>("login");
  const [user, setUser] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    me()
      .then(({ user }) => {
        setUser(user);
        setRoute("home");
      })
      .catch(() => setToken(null))
      .finally(() => setBooting(false));
  }, []);

  function handleAuthed(u: User) {
    setUser(u);
    setRoute("home");
  }

  async function handleSignOut() {
    try {
      await logout();
    } catch {
      // token may already be invalid; proceed with local sign-out
    }
    setToken(null);
    setUser(null);
    setRoute("login");
  }

  if (booting) return null;

  return (
    <>
      <nav className="nav">
        <button className="nav-brand" onClick={() => setRoute(user ? "home" : "login")}>
          SmartPack
        </button>
        <div className="nav-actions">
          {user ? (
            <>
              <span className="nav-user">{user.name}</span>
              <button className="nav-link" onClick={handleSignOut}>
                Sign Out
              </button>
            </>
          ) : (
            <>
              <button className="nav-link" onClick={() => setRoute("login")}>
                Sign In
              </button>
              <button className="nav-link" onClick={() => setRoute("register")}>
                Create Account
              </button>
            </>
          )}
        </div>
      </nav>

      {route === "login" && (
        <Login onAuthed={handleAuthed} onSwitch={() => setRoute("register")} />
      )}
      {route === "register" && (
        <Register onAuthed={handleAuthed} onSwitch={() => setRoute("login")} />
      )}
      {route === "home" && user && <Home user={user} />}
    </>
  );
}
