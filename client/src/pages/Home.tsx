import type { User } from "../api";

type Props = {
  user: User;
  onNext: () => void;
};

export default function Home({ user, onNext }: Props) {
  return (
    <div className="home">
      <section className="hero">
        <p className="eyebrow">Welcome back, {user.name}</p>
        <h1>
          No thinking required.
          <br />
          Nothing packed wrong.
        </h1>
        <p className="sub">
          Leave the itinerary to the weather. Leave the outfits and luggage to
          AI. Your scenario wardrobe is getting ready.
        </p>
        {/* 临时入口:先直达衣柜页,后续换成正式导航 */}
        <button className="hero-next" onClick={onNext}>
          下一步:我的衣柜 →
        </button>
      </section>

      <section className="feature-grid">
        <div className="feature-card">
          {/* Geometric markers (square/circle/triangle), not pictograms —
              shapes are drawn in CSS and carry no text for screen readers */}
          <div className="icon" aria-hidden="true" />
          <h3>Daily Outfits</h3>
          <p>
            A complete, ready-to-wear outfit every morning, matched to today's
            weather and your own wardrobe.
          </p>
        </div>
        <div className="feature-card">
          <div className="icon" aria-hidden="true" />
          <h3>Trip Planning</h3>
          <p>
            Enter a destination and itinerary; get day-by-day outfits for
            meetings, commutes, and dinners — plus a minimal luggage plan.
          </p>
        </div>
        <div className="feature-card">
          <div className="icon" aria-hidden="true" />
          <h3>Smart Reminders</h3>
          <p>
            Forecast changes before departure? SmartPack tells you exactly what
            to add or remove, down to the umbrella.
          </p>
        </div>
      </section>

      <footer className="footer">
        SmartPack — an AI scenario wardrobe. This home page is a placeholder;
        features are under design.
      </footer>
    </div>
  );
}
