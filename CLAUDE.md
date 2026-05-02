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
  - `calculateProfit(plane, route, config, manualTrips)` — revenue minus fuel/staff/maintenance costs; trips/day = `24 / (flight_time + 0.5)`; `manualTrips` overrides the automatic maximum
  - `analyzeTopRoutesForPlane(plane, limit, manualTrips)` — ranks all routes by daily profit for a given aircraft
  - `getBestPlanesByType(budget, type, manualTrips)` — filters planes by budget and type, returns top 10 sorted by `totalDailyProfit` (fleet-based ranking)

### Uçak Öneri Sıralama Mantığı

`getBestPlanesByType` community standardına göre filo bazlı sıralama yapar:

```
fleetSize        = Math.min(Math.floor(budget / price), MAX_FLEET_SIZE)  // MAX_FLEET_SIZE = 30
fleetEfficiency  = fleetSize ≤ 3  → 1.0   (tam verim, talep dolmuyor)
                   fleetSize ≤ 10 → 0.8   (4-10 uçak, talep biraz paylaşılıyor)
                   fleetSize ≤ 20 → 0.6   (11-20 uçak, birden fazla rota gerekebilir)
                   fleetSize ≤ 30 → 0.4   (21-30 uçak, talep tamamen doluyor)
totalDailyProfit = fleetSize × singlePlaneDailyProfit × fleetEfficiency
```

Sıralama `totalDailyProfit`'e göre büyükten küçüğe yapılır. `efficiency` (tek uçak kâr/fiyat) UI'da gösterilmeye devam eder ama sıralamayı etkilemez. Kullanıcı `manualTrips` ile günlük sefer sayısını override edebilir; boş bırakılırsa `24 / cycleTime` maksimumu kullanılır.

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

Formulas sourced from `cathaypacific8747/am4` (formulae.md). Easy and Realism use **different formulas** — there is no shared multiplier.

### Passenger ticket prices (per mode)

| Class | Easy mode | Realism mode |
|-------|-----------|--------------|
| Economy (Y) | `0.4 × distance + 170` | `0.3 × distance + 150` |
| Business (J) | `0.8 × distance + 560` | `0.6 × distance + 500` |
| First (F) | `1.2 × distance + 1200` | `0.9 × distance + 1000` |

### Cargo prices (same for both modes — under investigation)

| Class | Formula |
|-------|---------|
| Cargo Light (L) | `0.07 × distance + 50` |
| Cargo Heavy (H) | `0.11 × distance + 150` |

### Easy mode mechanics (implemented)

- **4× aircraft speed** — `calculateFlightTime` applies `speed × 4` in Easy mode, resulting in ~2.7× more daily flights (turnaround time is fixed at 0.5h).
- **Higher ticket prices** — distance coefficients and base values both differ (see table above).
- The old `1.1× revenue multiplier` approach has been removed.

### Realism varsayımları (implemented)

- **Günlük aktif yönetim limiti: 18 saat.** Kullanıcı uyku/iş için günde max 18 saat oyuna girebilir, uçağı manuel kaldırması şart. Bu yüzden günlük max sefer = `floor(18 / cycleTime)`, 24 değil. `logic.js`'te `DAILY_AVAILABLE_HOURS = 18` sabiti, `configurator.js` aynı sabiti kullanır, AI prompt'u (`worker.js`) da aynı kuralı bilir.
- **Default boş hangar slot: 3.** Kullanıcı belirtmediyse AI ve UI 3 boş slot varsayar. AI cevabın başında bu varsayımı bildirir. `extractContextFromMessage` "5 slot var" / "3 boş slot" / "4 hangar" ifadelerini yakalar; aksi halde fallback değer 3.

## Sıradaki Yapılacaklar

### Tamamlanan (v0.5-ai-mature)

- [x] **Yazım toleransı** — Levenshtein distance, transposition algılama, eşik 2 (token + bigram kandidatları, letter/digit pattern kontrolü)
- [x] **A-Check vs uçak satma mantığı** — system prompt'ta: A-check %0.5-2 vs satış kaybı %20-40 karşılaştırması
- [x] **AI gereksiz veri sorma yasağı** — context'teki bilgileri tekrar sormama, yazım düzeltmesi bildirimi

### Açık Görevler

- [ ] **Akıllı bağlam filtreleme** — kullanıcı "bütçe" yazınca uçak listesi, "şehir/IATA" yazınca rota listesi context'e eklensin (`planes.js` ve `routes.js` client tarafında, AI bunlara erişemiyor).
- [ ] **AI internet bağlantısı** — kullanıcı bilmediği konu sorduğunda "araştırabilirim ama doğruluğundan emin olamam" desin, onay verirse Google Search tool aktif olsun.
- [ ] **Kullanıcı CI/fuel_price input'u** — `COST_INDEX` ve `FUEL_PRICE` şu an `logic.js`'de sabit; anasayfaya 2 input eklenmeli.
- [ ] **Kargo rota demand verisi** — `routes.js`'de kargo rotalarında `demand.c` alanı eksik; kargo analizi şu an çalışmıyor.
- [ ] **Chat'e "Geçmişi Temizle" butonu** — sessionStorage'taki `am4ChatHistory` anahtarını sıfırlasın.
- [~] **Talep paylaşımı modeli** — kısmen tamamlandı: filo büyüklüğüne göre verim katsayısı (0.4×–1.0×) eklendi. Açık soru: günlük toplam talebin sefer sayısına bölünmesi doğru mu? Talep her sefer bağımsız mı oluşuyor?

## Yasaklı Kaynaklar

Aşağıdaki kaynaklara araştırma veya referans amacıyla **kesinlikle erişme**:

- **am4tools.com** — virüs/zararlı yazılım riski nedeniyle yasaklı.

Araştırma için kullanılacak onaylı kaynaklar:
- tycoon.airlines4.app
- Reddit r/airlinemanager
- AM4 resmi Discord wiki
- airlinemanager.com (resmi site)

## Key Conventions

- No classes — all modules export plain objects with methods or functions into the global scope.
- `sessionStorage` key `am4ChatHistory` stores Gemini multi-turn history as a JSON array. History is cleared when the browser tab is closed — there is no persistent chat history across sessions.
- The single-page app uses `display` toggling on `.page` sections — not routing.
- CSS custom properties (`--primary`, `--success`, etc.) defined in `:root` control the entire color theme.
