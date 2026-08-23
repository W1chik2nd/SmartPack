# SmartPack — An AI Scenario Wardrobe

> Leave the itinerary to the weather. Leave the outfits and luggage to AI.

SmartPack is an AI-powered wardrobe and packing assistant built around one promise: **no thinking required, nothing packed wrong**.

## What It Does

Most weather apps tell you the temperature. Most fashion apps suggest generic outfits. SmartPack goes further: it combines your **personal wardrobe**, **dressing preferences**, **trip scenarios**, **destination weather**, and **luggage constraints** to generate outfit plans and packing lists you can follow as-is.

Before a business trip, enter your destination and itinerary, and SmartPack produces in one pass:

- Complete daily outfit combinations covering meetings, commuting, dinners, and other scenarios
- Adjustment plans for temperature swings, rain, and strong sun
- A minimal luggage plan that reuses items across days wherever possible
- A travel essentials checklist: umbrella, power adapters, sunscreen, medication, and more
- Automatic reminders before departure to add or remove items based on the latest forecast

## Core Features

| Feature | Description |
|---|---|
| Digital Wardrobe Management | Add clothes by photo or manual entry; the app builds a personal wardrobe database as the foundation for all recommendations |
| Dressing Preference Learning | Learns style preferences, restrictions, and temperature sensitivity; recommendations get more personal over time |
| Daily Outfit Recommendations | A complete, ready-to-wear outfit every morning based on the day's weather and your wardrobe |
| Trip-Based Outfit Planning | Day-by-day, scenario-based outfit plans (meetings, commuting, dinners, sightseeing) generated from your itinerary |
| Destination Weather Adjustments | Dynamic adjustments for temperature swings, rain, and strong sun at the destination |
| Minimal Luggage Plan | Maximizes item reuse to cover every scenario with the fewest possible pieces |
| Travel Essentials Checklist | Auto-generated checklist of non-clothing items: umbrellas, adapters, sunscreen, medication |
| Pre-Departure Smart Reminders | Monitors forecast changes and reminds you to add or remove items before departure |

For detailed personas and per-feature user stories, see [docs/personas-and-user-stories.md](docs/personas-and-user-stories.md).

## Who It's For

- **Business travelers** who switch between meetings, commutes, and dinners and can't afford to pack wrong
- **Daily commuters** who don't want to think about outfits or get caught out by the weather
- **Travel enthusiasts** who want fresh outfits every day within limited suitcase space
- **Minimalists** who want the fewest items covering the most scenarios
- **Family trip planners** who manage clothing and supplies for the whole family

## Business Model

SmartPack integrates weather alerts, outfit recommendations, and packing lists into a single personalized decision service.

- **Subscription**: core features are free; advanced features (multi-trip management, family members, deeper personalization, unlimited plan generation) require a membership
- **Targeted recommendations**: when the app identifies a genuine gap in the user's wardrobe or travel kit, it recommends purchasable products and earns commission — recommendations appear only when relevant and are clearly labeled

## Documentation

- [Personas and User Stories](docs/personas-and-user-stories.md)

## Getting Started (Development)

The repository contains a working prototype of the authentication flow: sign-in and sign-up pages backed by a SQLite database, plus a placeholder home page.

### Structure

```
server/   Zero-dependency auth API — Node + TypeScript + SQLite (node:sqlite)
client/   React + TypeScript + Vite front end (Apple-inspired design)
```

### Requirements

- Node.js 22.6+ (uses the built-in `node:sqlite` module and type stripping)
- npm (or pnpm) — the client is an npm workspace; the server has zero dependencies

### Run

One command from the repository root starts both the API server (port 4177) and the front end (port 5177):

```sh
npm install   # first time only
npm run dev   # server + client together; open http://localhost:5177
```

The API server creates `server/data/smartpack.db` automatically on first start.

### AI assistant (optional)

The home page has a chat assistant backed by `/api/chat`. To enable it, give the server an API key:

```sh
cp server/.env.example server/.env
# edit server/.env and set AI_API_KEY (OpenAI-compatible providers work;
# switch vendors via AI_BASE_URL / AI_MODEL — see the comments in the file)
```

`server/.env` is gitignored — never commit real keys. Without a key the endpoint responds 503 and the chat shows a clear "not configured" message; everything else works normally.

<details>
<summary>Run the two processes separately (optional)</summary>

```sh
# terminal 1 — API server
cd server
node --experimental-strip-types index.ts

# terminal 2 — front end
cd client
pnpm install
pnpm dev
```

</details>

Registered accounts are stored in SQLite (passwords hashed with scrypt), and sign-in validates against the database. The Vite dev server proxies `/api/*` to the API server.

## Status

This project is in the early design stage. The current implementation covers account registration and sign-in with a placeholder home page; the wardrobe, trip planning, and packing features are under design.
