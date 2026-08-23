import { useEffect, useState } from "react";
import { me, setToken, logout, type Credentials, type User } from "./api";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Questionnaire from "./pages/Questionnaire";
import Home from "./pages/Home";

type Route = "landing" | "login" | "register" | "questionnaire" | "home";

export default function App() {
  const [route, setRoute] = useState<Route>("landing");
  const [user, setUser] = useState<User | null>(null);
  // Step-1 credentials live only in memory while the questionnaire is open;
  // nothing is persisted anywhere until /api/register succeeds.
  const [pendingCreds, setPendingCreds] = useState<Credentials | null>(null);
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
    setPendingCreds(null);
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
    setRoute("landing");
  }

  if (booting) return null;

  // 落地页是满屏铺版,不显示顶部导航。
  if (route === "landing") {
    return <Landing onEnter={() => setRoute("login")} />;
  }

  return (
    <>
      <nav className="nav">
        <button className="nav-brand" onClick={() => setRoute(user ? "home" : "landing")}>
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
        <Register
          onContinue={(creds) => {
            setPendingCreds(creds);
            setRoute("questionnaire");
          }}
          onSwitch={() => setRoute("login")}
        />
      )}
      {route === "questionnaire" && pendingCreds && (
        <Questionnaire
          credentials={pendingCreds}
          onAuthed={handleAuthed}
          onBack={() => setRoute("register")}
        />
      )}
      {route === "home" && user && <Home user={user} />}
    </>
  );
}
