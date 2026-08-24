<p align="right">
  <b>English</b> ·
  <a href="README.zh-CN.md">简体中文</a>
</p>

# WearRoute（行装）— An AI Scenario Wardrobe

> Leave the itinerary to the weather. Leave the outfits and luggage to AI.

WearRoute is an AI-powered wardrobe and packing assistant built around one promise: **no thinking required, nothing packed wrong**.

## What It Does

Most weather apps tell you the temperature. Most fashion apps suggest generic outfits. WearRoute goes further: it combines your **personal wardrobe**, **dressing preferences**, **trip scenarios**, **destination weather**, and **luggage constraints** to generate outfit plans and packing lists you can follow as-is.

Before a business trip, enter your destination and itinerary, and WearRoute produces in one pass:

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

WearRoute integrates weather alerts, outfit recommendations, and packing lists into a single personalized decision service.

- **Subscription**: core features are free; advanced features (multi-trip management, family members, deeper personalization, unlimited plan generation) require a membership
- **Targeted recommendations**: when the app identifies a genuine gap in the user's wardrobe or travel kit, it recommends purchasable products and earns commission — recommendations appear only when relevant and are clearly labeled

## Tech Stack

The architecture rule is **thin client, thick server**: recommendation logic, weather integration, luggage optimization, and business rules all live in the API, so the web and iOS clients only render. See [AGENTS.md](AGENTS.md) for the full engineering conventions.

| Layer | Choice | Notes |
|---|---|---|
| Front end | React 18 + TypeScript 5.9 + Vite 5 | Single-page app, hand-written CSS, Bauhaus theme tokens (shared background `#CAF5F7`) |
| Bilingual UI | In-house i18n in `client/src/i18n` | English/Chinese strings plus a `LangProvider`; the choice persists in `localStorage` and mirrors onto `<html lang>` |
| Back end | Node 22.x with TypeScript | Native type stripping (`--experimental-strip-types`), plain `node:http`; one process serves both the built client and `/api/*` |
| Database | SQLite locally through the built-in `node:sqlite`, PostgreSQL (Neon) in production through `pg` | `server/data/wearroute.db` is created for local development; `migrate:sqlite` imports it into Postgres |
| Auth | `node:crypto` scrypt with per-user salt, opaque session tokens | Passwords are never stored in plain text |
| Shared types | `shared/*.ts` | Outfit, packing, wardrobe, weather, and trip-constraint types imported across the stack |
| Native iOS | SwiftUI, iOS 17+ | Mirrors the web pages against the same API and carries no business logic — see [ios/README.md](ios/README.md) |
| Tests | Built-in `node:test` runner, plus custom render and layout probes | No test framework dependency |

### External services

| Service | Used for | Key required |
|---|---|---|
| [Open-Meteo](https://open-meteo.com) | Destination forecasts | No |
| [Nominatim / OpenStreetMap](https://nominatim.org) | Place search and geocoding | No |
| OpenAI-compatible LLM | Chat assistant and the trip-planning agent (Responses API, web search, structured outputs) | `AI_API_KEY` |
| Vision model (DashScope `qwen-vl-plus` by default, OpenAI-compatible) | Recognizing garments from photos | `VISION_API_KEY` |
| Unsplash / Pexels / Openverse | Scenery photos on itinerary cards (Openverse needs no key) | Optional |
| JD / Taobao affiliate APIs | "Shop similar" product recommendations | Optional |

Every key lives in `server/.env` (gitignored) locally, and in the Render dashboard in production — never in client code.

## Documentation

- [Personas and User Stories](docs/personas-and-user-stories.md)
- [AGENTS.md](AGENTS.md) — engineering conventions and architecture rules
- [ios/README.md](ios/README.md) — native client structure and device setup

## Getting Started (Development)

The repository contains the WearRoute web app, its Node API, the native iOS client, and local SQLite / production PostgreSQL persistence.

### Structure

```
client/   React + TypeScript + Vite front end (pages, components, i18n, theme)
server/   Node + TypeScript API — SQLite locally, PostgreSQL on Neon
ios/      Native SwiftUI client — iOS 17+, backed by the same API
shared/   TypeScript types shared across the stack
scripts/  Dev runner plus render and layout verification probes
docs/     Product documentation (personas, user stories)
```

### Requirements

- Node.js 22.6+ (uses the built-in `node:sqlite` module and type stripping)
- npm — the client and server are npm workspaces
- Xcode 17+ for the optional native iOS client

### Run

One command from the repository root starts both the API server (port 4177) and the front end (port 5177):

```sh
npm install   # first time only
npm run dev   # server + client together; open https://localhost:5177
```

The API server creates `server/data/wearroute.db` automatically for local development. The Vite dev server runs over HTTPS with a self-signed certificate and listens on the local network, because taking wardrobe photos from a phone requires a secure context — accept the browser warning on first visit.

### Verify

```sh
npm test   # server tests + client tests + render check + layout probe
npm run build
```

### Native iOS app

The SwiftUI app lives in `ios/` and uses the same API as the web client. See
[ios/README.md](ios/README.md) for its structure, web-to-iOS page mapping, backend setup, and device configuration.

Build it for the local simulator with:

```sh
DEVELOPER_DIR=/Applications/Xcode-beta.app/Contents/Developer xcodebuild \
  -project ios/SmartPack.xcodeproj \
  -scheme SmartPack \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  build
```

### AI assistant (optional)

The home page has a chat assistant backed by `/api/chat`. To enable it, give the server an API key:

```sh
cp server/.env.example server/.env
# edit server/.env and set AI_API_KEY (OpenAI-compatible providers work;
# switch vendors via AI_BASE_URL / AI_MODEL — see the comments in the file)
```

`server/.env` is gitignored — never commit real keys. The checked-in default assistant model is `gpt-5.6-terra`; override `AI_MODEL` in a local environment when needed. Without a key the endpoint responds 503 and the chat shows a clear "not configured" message; everything else works normally.

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

## Deploy to Render with Neon

Deploy the repository as one Render Web Service. The Node process serves both the built React app and `/api/*`, so the browser uses the Render origin automatically and no public API key is embedded in the client.

Use these Render settings:

```text
Runtime: Node
Branch: main
Build Command: npm ci && npm run build
Start Command: npm start
Health Check Path: /api/health
```

Set these server-only environment variables in Render:

```text
DATABASE_URL=<Neon pooled PostgreSQL connection string>
DATABASE_SCHEMA=wearroute
DATABASE_POOL_SIZE=5
AI_API_KEY=<provider key>
AI_BASE_URL=<OpenAI-compatible endpoint>
AI_MODEL=<model name>
TRIP_AGENT_MODEL=<optional model override>
VISION_API_KEY=<vision provider key>
VISION_BASE_URL=<vision endpoint>
VISION_MODEL=<vision model>
PHOTO_PROVIDER=<unsplash|pexels|openverse>
UNSPLASH_ACCESS_KEY=<optional>
PEXELS_API_KEY=<optional>
```

`DATABASE_SCHEMA=wearroute` keeps the application tables isolated when the Neon database is shared with another project. Only configure optional providers that are actually in use. Never set secrets as `VITE_*` variables.

To migrate the existing local data once, use the same Neon connection in a shell without committing it:

```sh
DATABASE_URL='postgresql://…' npm run migrate:sqlite --workspace wearroute-server
```

The migration is idempotent and defaults to `server/data/wearroute.db`. Set `SQLITE_PATH` when importing a database from another location.

## Status

This project is in active development. The web and native iOS apps currently cover accounts, profiles, wardrobes, trip generation, itinerary views, outfit rendering, and packing lists. Both clients ship in English and Chinese with an in-app language switch.
