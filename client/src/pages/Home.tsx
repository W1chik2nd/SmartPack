import { useEffect, useState } from "react";
import { weather, type User, type Weather } from "../api";
import ChatWidget from "../components/ChatWidget";

type Props = {
  user: User;
};

// Placeholder navigation targets. Wire real routes here as the pages land.
// TODO: replace with real navigation once wardrobe/trips/profile pages exist.
const TODO_LINKS = {
  weather: () => {},
  checklist: () => {},
  dates: () => {},
  outfit: () => {},
  itinerary: () => {},
  wardrobe: () => {},
  trips: () => {},
  profile: () => {},
};

function greetingFor(hour: number): string {
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function Home({ user }: Props) {
  const [now, setNow] = useState(new Date());
  const [wx, setWx] = useState<Weather | null>(null);
  const [wxError, setWxError] = useState(false);

  // Live clock: half-minute ticks keep date, time, and greeting current.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Weather: try browser geolocation, fall back to the server's default city.
  useEffect(() => {
    const load = (lat?: number, lon?: number) =>
      weather(lat, lon)
        .then(setWx)
        .catch(() => setWxError(true));
    if (!navigator.geolocation) {
      load();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => load(pos.coords.latitude, pos.coords.longitude),
      () => load(),
      { timeout: 5_000 }
    );
  }, []);

  const dateLong = now.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const timeShort = now.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="home dashboard">
      <ChatWidget />

      {/* Greeting bar */}
      <header className="dash-greeting">
        <h1>
          {greetingFor(now.getHours())}, {user.name}.
        </h1>
        <p>
          {dateLong} · {timeShort}
        </p>
      </header>

      <div className="dash-layout">
        {/* Left: today card, laid out after the wireframe */}
        <section className="today-card" aria-label="Today">
          <div className="today-header">
            <button className="today-dates" onClick={TODO_LINKS.dates}>
              Upcoming · {dateLong} <span aria-hidden="true">›</span>
            </button>
            <span className="today-location">Location</span>
          </div>

          <div className="today-body">
            <div className="today-left">
              <button className="today-weather" onClick={TODO_LINKS.weather}>
                <h2>Today's Weather</h2>
                {wx ? (
                  <p className="weather-reading">
                    {Math.round(wx.tempC)}°C
                    <span className="weather-cond">{wx.condition}</span>
                  </p>
                ) : (
                  <p className="weather-reading weather-pending">
                    {wxError ? "Unavailable" : "Loading…"}
                  </p>
                )}
                <span className="card-arrow" aria-hidden="true">›</span>
              </button>

              <button className="today-checklist" onClick={TODO_LINKS.checklist}>
                <h2>Checklist</h2>
                <span className="check-mark" aria-hidden="true" />
                <span className="card-arrow" aria-hidden="true">›</span>
              </button>
            </div>

            <button className="today-outfit" onClick={TODO_LINKS.outfit}>
              <h2>Today's Outfit</h2>
              {/* Geometric garment drawing (shirt + trousers), CSS only */}
              <span className="outfit-figure" aria-hidden="true">
                <span className="outfit-shirt" />
                <span className="outfit-trousers" />
              </span>
              <span className="card-arrow" aria-hidden="true">›</span>
            </button>

            <button className="today-itinerary" onClick={TODO_LINKS.itinerary}>
              <h2>Itinerary</h2>
              <span className="itinerary-timeline" aria-hidden="true" />
              <span className="card-arrow" aria-hidden="true">›</span>
            </button>
          </div>
        </section>

        {/* Right: primary navigation tiles */}
        <nav className="dash-nav" aria-label="Sections">
          <button onClick={TODO_LINKS.wardrobe}>
            <span className="nav-tile-mark red" aria-hidden="true" />
            Digital Wardrobe
          </button>
          <button onClick={TODO_LINKS.trips}>
            <span className="nav-tile-mark yellow" aria-hidden="true" />
            Trip Planner
          </button>
          <button onClick={TODO_LINKS.profile}>
            <span className="nav-tile-mark blue" aria-hidden="true" />
            My Profile
          </button>
        </nav>
      </div>

      <footer className="footer">
        SmartPack — an AI scenario wardrobe. Sections open detailed pages as
        they are built.
      </footer>
    </div>
  );
}
