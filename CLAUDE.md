# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A web-based fleet optimization tool for the Airline Manager 4 (AM4) game. Users input a budget and game mode, and the tool recommends aircraft and routes with profit calculations. An AI chat assistant (Google Gemini) provides conversational strategy advice.

Live site: https://am4-proje.pages.dev/

## Deployment

- **Frontend:** Cloudflare Pages (`am4-proje.pages.dev`) — static files only, no build step.
- **Backend:** `worker.js` is deployed as a **separate Cloudflare Workers project** — it is not part of the Pages deployment. The Gemini API key is stored in the Workers project as an environment variable named `AM4`.

These are two independent projects in Cloudflare; changes to `worker.js` must be deployed to Workers separately.

## Running the Project

No build step — open `index.html` directly in a browser. All code is vanilla JavaScript with no dependencies or transpilation.

**Backend (AI chat):** Deploy `worker.js` via Wrangler with the `AM4` environment variable set to a Google Gemini API key.

## Architecture

### Script Loading Order

The `<script>` tags in `index.html` must follow this exact order:

`planes.js` → `routes.js` → `utils.js` → `configurator.js` → `logic.js` → `ui.js`

This order is load-order-dependent — later scripts rely on globals defined by earlier ones. Do not reorder or consolidate these tags.

### Data Layer

- **`planes.js`** — ~400 aircraft objects with `type` (pax/cargo), capacity fields, fuel consumption, range, cruise speed, price
- **`routes.js`** — 150+ route objects with origin, destination, distance, and demand fields (`y`/`j`/`f` for passenger, `c` for cargo). **Note: cargo routes do not have a `demand.c` field — cargo route analysis is currently broken and non-functional.**

### Business Logic

- **`logic.js`** — Core profit engine:
  - `calculateFlightTime(distance, speed)` — distance / speed
  - `calculateProfit(plane, route, seats, gameMode)` — revenue minus fuel/staff/maintenance costs; trips/day = `24 / (flight_time + 0.5)`
  - `analyzeTopRoutesForPlane(plane, gameMode)` — ranks all routes by daily profit for a given aircraft
  - `getBestPlanesByType(budget, type, gameMode)` — filters planes by budget and type, returns top 10 by efficiency

- **`configurator.js`** — Seat/cargo optimizer:
  - `calculateOptimalSeats(plane, route)` — allocates F/J/Y seats respecting demand hierarchy (F > J > Y) and aircraft capacity (F=3 seats, J=2, Y=1)
  - `calculateOptimalCargo(plane, route)` — applies 30% Heavy / 70% Light cargo split

### Frontend

- **`ui.js`** — All DOM interaction: page navigation, dropdowns, `renderSuggestions()` (budget → plane recommendations), `renderRouteAnalysis()` (top routes for a plane), `askGemini()` (single-turn AI for route analysis), and the chat widget with multi-turn sessionStorage history

- **`utils.js`** — Pure formatting helpers: `formatCurrency()`, `formatPercent()`, `formatDuration()`

### Backend

- **`worker.js`** — Cloudflare Worker CORS-enabled POST endpoint. Tries Gemini models in this fallback order:
  1. `gemini-2.5-flash` (primary)
  2. `gemini-2.5-flash-lite` (fallback)
  3. `gemini-2.5-pro` (last resort)

  Accepts `{ message, history }`, returns `{ response, updatedHistory }`. The `AM4` env var must never be exposed to the frontend.

## AM4 Pricing Formulas

These game-specific constants are critical to all profit calculations:

| Class | Price formula |
|-------|--------------|
| Economy (Y) | `0.4 × distance + 170` |
| Business (J) | `0.8 × distance + 560` |
| First (F) | `1.2 × distance + 1200` |
| Cargo Light (L) | `0.07 × distance + 50` |
| Cargo Heavy (H) | `0.11 × distance + 150` |

Game mode multiplier: **Easy = 1.1×**, **Realism = 1.0×** applied to all revenue.

## Key Conventions

- No classes — all modules export plain objects with methods or functions into the global scope.
- `sessionStorage` key `am4ChatHistory` stores Gemini multi-turn history as a JSON array. History is cleared when the browser tab is closed — there is no persistent chat history across sessions.
- The single-page app uses `display` toggling on `.page` sections — not routing.
- CSS custom properties (`--primary`, `--success`, etc.) defined in `:root` control the entire color theme.
