import { useEffect, useState } from "react";
import { me, setToken, logout, type Credentials, type User } from "./api";
import { LangProvider, useLang } from "./i18n/useLang";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Questionnaire from "./pages/Questionnaire";
import Home from "./pages/index";
import TripPlanner from "./pages/TripPlanner";
import Wardrobe from "./pages/Wardrobe";
import PhoneUpload from "./pages/PhoneUpload";
import PackingList from "./pages/PackingList";

type Route =
  | "landing"
  | "login"
  | "register"
  | "questionnaire"
  | "home"
  | "trips"
  | "wardrobe"
  | "packing";

/** ?upload=<token> 是手机扫码进来的上传页,免登录。 */
const uploadToken = new URLSearchParams(window.location.search).get("upload");

function Shell() {
  const { lang, setLang, t } = useLang();
  const [route, setRoute] = useState<Route>("landing");
  const [user, setUser] = useState<User | null>(null);
  // Step-1 credentials live only in memory while the questionnaire is open;
  // nothing is persisted anywhere until /api/register succeeds.
  const [pendingCreds, setPendingCreds] = useState<Credentials | null>(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    // 手机上传页不需要登录态,跳过 me() 免得白等一次请求。
    if (uploadToken) {
      setBooting(false);
      return;
    }
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

  // One toggle for the whole app; the stored value survives refresh/redirect.
  const langToggle = (
    <button
      className="nav-link nav-lang"
      onClick={() => setLang(lang === "en" ? "zh" : "en")}
      aria-label={lang === "en" ? "切换到中文" : "Switch to English"}
    >
      {lang === "en" ? "中文" : "EN"}
    </button>
  );

  if (booting) return null;

  // 手机扫码进来的上传页:免登录,优先于其他路由。
  if (uploadToken) {
    return <PhoneUpload uploadToken={uploadToken} />;
  }

  // 落地页是满屏铺版,不显示顶部导航;语言切换单独浮在角上。
  if (route === "landing") {
    return (
      <>
        <div className="landing-lang">{langToggle}</div>
        <Landing onEnter={() => setRoute("login")} />
      </>
    );
  }

  return (
    <>
      <nav className="nav">
        <button
          className="nav-brand"
          onClick={() => setRoute(user ? "home" : "landing")}
        >
          SmartPack
        </button>
        <div className="nav-actions">
          {langToggle}
          {user ? (
            <>
              <button
                className="nav-link"
                onClick={() => setRoute(route === "packing" ? "home" : "packing")}
              >
                {route === "packing" ? "Home" : "Packing List"}
              </button>
              <span className="nav-user">{user.name}</span>
              <button className="nav-link" onClick={handleSignOut}>
                {t("navSignOut")}
              </button>
            </>
          ) : (
            <>
              <button className="nav-link" onClick={() => setRoute("login")}>
                {t("navSignIn")}
              </button>
              <button className="nav-link" onClick={() => setRoute("register")}>
                {t("navCreateAccount")}
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
      {route === "home" && user && (
        <Home
          user={user}
          onOpenTrips={() => setRoute("trips")}
          onOpenWardrobe={() => setRoute("wardrobe")}
          onOpenPacking={() => setRoute("packing")}
        />
      )}
      {route === "trips" && user && (
        <TripPlanner user={user} onBack={() => setRoute("home")} />
      )}
      {route === "wardrobe" && user && (
        <Wardrobe onBack={() => setRoute("home")} />
      )}
      {route === "packing" && user && <PackingList />}
    </>
  );
}

export default function App() {
  return (
    <LangProvider>
      <Shell />
    </LangProvider>
  );
}
