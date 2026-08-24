import { useEffect, useState } from "react";
import {
  me,
  setToken,
  logout,
  listTripPlans,
  type AssistantClientAction,
  type AssistantPage,
  type Credentials,
  type TripPlan,
  type User,
} from "./api";
import { LangProvider, useLang } from "./i18n/useLang";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Questionnaire from "./pages/Questionnaire";
import Home from "./pages/index";
import TripPlanner from "./pages/TripPlanner";
import Itinerary from "./pages/Itinerary";
import Wardrobe from "./pages/Wardrobe";
import PhoneUpload from "./pages/PhoneUpload";
import PackingList from "./pages/PackingList";
import TripSetup from "./pages/TripSetup";
import Profile from "./pages/Profile";
import OutfitOverview from "./pages/OutfitOverview";
import TripWeather from "./pages/TripWeather";
import ChatWidget from "./components/ChatWidget";

type Route =
  | "landing"
  | "login"
  | "register"
  | "questionnaire"
  | "home"
  | "trips"
  | "tripSetup"
  | "itinerary"
  | "wardrobe"
  | "profile"
  | "packing"
  | "outfit"
  | "weather";

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
  // 从场景卡片带过来的出行目的:行程设置页(地图+日历)和行程计划页都用它。
  const [scenario, setScenario] = useState<string | undefined>(undefined);
  const [itineraryId, setItineraryId] = useState<string | undefined>(undefined);
  const [packingTripPlanId, setPackingTripPlanId] = useState<string | undefined>(
    undefined
  );
  const [outfitTripPlanId, setOutfitTripPlanId] = useState<string | undefined>(
    undefined
  );
  const [retryPlan, setRetryPlan] = useState<TripPlan | null>(null);
  const [weatherTripPlanId, setWeatherTripPlanId] = useState<string | null>(null);

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

  // This app uses in-memory routes, so the browser does not reset scroll as
  // it would after a normal navigation. Every page must still open at its top.
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [route]);

  function handleAuthed(u: User) {
    setUser(u);
    setPendingCreds(null);
    setRoute("home");
  }

  const assistantRoutes: Record<AssistantPage, Route> = {
    home: "home",
    trips: "trips",
    tripSetup: "tripSetup",
    itinerary: "itinerary",
    wardrobe: "wardrobe",
    profile: "profile",
    packing: "packing",
  };

  function openLatestPackingPlan() {
    void listTripPlans().then(({ plans }) => {
      const latest = plans.find((plan) => Boolean(plan.itineraryId));
      if (!latest) {
        setRoute("home");
        return;
      }
      setPackingTripPlanId(latest.id);
      setRoute("packing");
    });
  }

  function handleAssistantActions(actions: AssistantClientAction[]) {
    for (const action of actions) {
      if (action.type === "profileUpdated") setUser(action.user);
      if (action.type === "navigate") {
        if (action.scenario) setScenario(action.scenario);
        if (action.page === "packing") openLatestPackingPlan();
        else setRoute(assistantRoutes[action.page]);
      }
      if (action.type === "tripCreated") setRoute("home");
      if (action.type === "packingChanged") {
        const current = JSON.parse(
          sessionStorage.getItem("smartpack_packing_checked") ?? "{}"
        ) as Record<string, boolean>;
        for (const id of action.checked ?? []) current[id] = true;
        for (const id of action.unchecked ?? []) current[id] = false;
        sessionStorage.setItem("smartpack_packing_checked", JSON.stringify(current));
        if (action.balance !== undefined) {
          sessionStorage.setItem("smartpack_packing_balance", String(action.balance));
        }
        openLatestPackingPlan();
      }
    }
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
              {/* No section jump links in the nav: sections are reached from
                  the dashboard tiles, each page has its own back button. */}
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

      {user && <ChatWidget onActions={handleAssistantActions} />}

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
          onOpenTrips={() => {
            setRetryPlan(null);
            setRoute("trips");
          }}
          onRetryTrip={(plan) => {
            setRetryPlan(plan);
            setScenario(plan.scenario);
            setItineraryId(undefined);
            setRoute("tripSetup");
          }}
          onOpenWardrobe={() => setRoute("wardrobe")}
          onOpenItinerary={(id) => {
            setScenario("travel");
            setItineraryId(id);
            setRoute("itinerary");
          }}
          onOpenPacking={(tripPlanId) => {
            setPackingTripPlanId(tripPlanId);
            setRoute("packing");
          }}
          onOpenWeather={(tripPlanId) => {
            setWeatherTripPlanId(tripPlanId);
            setRoute("weather");
          }}
          onOpenProfile={() => setRoute("profile")}
          onOpenOutfit={(tripPlanId) => {
            setOutfitTripPlanId(tripPlanId);
            setRoute("outfit");
          }}
        />
      )}
      {route === "trips" && user && (
        <TripPlanner
          user={user}
          onBack={() => setRoute("home")}
          onPickScenario={(id) => {
            setRetryPlan(null);
            setScenario(id);
            setItineraryId(undefined);
            setRoute("tripSetup");
          }}
        />
      )}
      {route === "tripSetup" && user && scenario && (
        <TripSetup
          user={user}
          scenario={scenario}
          retryPlan={retryPlan}
          onBack={() => {
            setRetryPlan(null);
            setRoute(retryPlan ? "home" : "trips");
          }}
          onSaved={() => {
            setRetryPlan(null);
            setRoute("home");
          }}
        />
      )}
      {route === "itinerary" && user && (
        <Itinerary
          user={user}
          scenario={scenario}
          tripId={itineraryId}
          onBack={() => setRoute("home")}
        />
      )}
      {route === "wardrobe" && user && (
        <Wardrobe onBack={() => setRoute("home")} />
      )}
      {route === "profile" && user && (
        <Profile
          user={user}
          onBack={() => setRoute("home")}
          onSaved={(updated) => setUser(updated)}
        />
      )}
      {route === "packing" && user && packingTripPlanId && (
        <PackingList
          tripPlanId={packingTripPlanId}
          onBack={() => setRoute("home")}
        />
      )}
      {route === "outfit" && user && (
        <OutfitOverview
          tripPlanId={outfitTripPlanId}
          onBack={() => setRoute("home")}
        />
      )}
      {route === "weather" && user && weatherTripPlanId && (
        <TripWeather
          tripPlanId={weatherTripPlanId}
          onBack={() => setRoute("home")}
        />
      )}
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
