# World Cup Seer

**Explainable AI match intelligence for the 2026 FIFA World Cup.**

World Cup Seer turns real national-team data into transparent match predictions. For any `Team A vs Team B`, it produces win/draw/loss probabilities, an expected scoreline, likely goalscorers, squad and lineup context, and the *reasoning* behind the call — backed by live Elo ratings, real squads, and cited Valyu research.

Nothing is a black box: every number is traceable to a data source, and the UI flags exactly how much of each prediction is built on live data versus estimates.

---

## Table of contents

- [What it does](#what-it-does)
- [How it works](#how-it-works)
- [Data sources](#data-sources)
- [Tech stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Quick start](#quick-start)
- [Getting your API keys](#getting-your-api-keys)
- [Environment variables](#environment-variables)
- [Running the app](#running-the-app)
- [How provenance works](#how-provenance-works)
- [Project structure](#project-structure)
- [API endpoints](#api-endpoints)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

---

## What it does

- **Match predictions** for any two of the 48 World Cup 2026 finalists.
- **Win / draw / loss probabilities** derived from a Poisson model over Elo-implied expected goals.
- **Expected score + full scoreline distribution** (e.g. `2-1` at 9%, `1-1` at 13%, …).
- **Likely goalscorers** from real tournament scorer data or squad attackers.
- **Squad & bench snapshot** with injury/suspension flags.
- **Live lineup mode** — overlays official starting XIs when they land (~1h before kickoff).
- **Group stage + knockout bracket** simulation with a projected champion.
- **Cited live research** — current squad news, expected lineups, and tactical previews via Valyu, rendered as formatted markdown.
- **Host advantage** modeling for the host nation in any tie.

The app runs **fully functional with zero API keys** using real World Football Elo ratings — keys progressively unlock richer data (see [How provenance works](#how-provenance-works)).

---

## How it works

```
Team A vs Team B
      │
      ▼
┌─────────────────────────────────────────────────────────────┐
│  buildMatchReport()  (src/lib/report.ts)                     │
│                                                              │
│  1. Elo strength       ← eloratings.net  (always real)       │
│  2. Squads / injuries  ← API-Football    (key optional)      │
│  3. Top scorers        ← API-Football    (key optional)      │
│  4. Official lineups   ← API-Football    (~1h pre-kickoff)   │
│  5. Live research       ← Valyu           (key optional)      │
└─────────────────────────────────────────────────────────────┘
      │
      ▼
  prediction-engine.ts  →  probabilities, xG, scorelines, scorers, risks
      │
      ▼
  Match report  (predictions + provenance + cited sources)
```

The prediction math is **deterministic** — Elo gap → expected goals → a Poisson grid of scorelines → win/draw/loss, BTTS, over/under, clean sheets, and confidence. The same inputs always produce the same prediction, which keeps it auditable.

---

## Data sources

| Source | Provides | Key required | Notes |
|---|---|---|---|
| [World Football Elo](https://www.eloratings.net) | National-team strength + world rank | **No** | Public `World.tsv`, no auth, cached 24h |
| [API-Football](https://www.api-football.com) | Squads, lineups, subs, injuries, top scorers, fixtures | Optional | Free plan = 100 req/day; responses cached |
| [Valyu](https://valyu.ai) | Cited live match research (squad news, previews) | Optional | Server-side only; sources shown in the UI |

---

## Tech stack

- **[Next.js 16](https://nextjs.org)** (App Router) + **React 19**
- **TypeScript**
- **[Zod](https://zod.dev)** — request validation
- **[valyu-js](https://www.npmjs.com/package/valyu-js)** — Valyu research integration
- **[Streamdown](https://www.npmjs.com/package/streamdown)** + **[remark-gfm](https://github.com/remarkjs/remark-gfm)** — markdown rendering for research snippets (gracefully handles truncated content)

---

## Prerequisites

- **Node.js ≥ 20.9**
- **npm** (ships with Node)
- API keys are **optional** — the app works without them.

---

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Create your local env file
cp .env.example .env.local

# 3. (Optional) add your API keys to .env.local — see below

# 4. Start the dev server
npm run dev
```

Open **http://localhost:3000**. With no keys, predictions run on real Elo ratings and a transparent demo model so you can develop locally right away.

---

## Getting your API keys

Both keys are optional but unlock real squad data and cited research. Add them to `.env.local`.

### Valyu — live cited research

1. Go to **[platform.valyu.ai](https://platform.valyu.ai)** and sign up (free credits on signup).
2. Open the **API Keys** section of the dashboard and create a key.
3. Copy it into `.env.local`:

   ```bash
   VALYU_API_KEY=your_valyu_key_here
   ```

Without it, the app falls back to a "Live model" source note and skips external research.

### API-Football — real squads, lineups & scorers

1. Go to **[dashboard.api-football.com](https://dashboard.api-football.com)** and create an account (the **Free** plan allows ~100 requests/day).
2. Copy your API key from the dashboard.
3. Add it to `.env.local`:

   ```bash
   API_FOOTBALL_KEY=your_api_football_key_here
   ```

> **Free-plan note:** The free plan **cannot read the 2026 season**, so squads load (that endpoint isn't season-gated) but season-specific data — fixtures, injuries, and top scorers — is unavailable and the app silently falls back. A paid plan that includes season 2026 unlocks the full live experience. The app handles this gracefully and logs a single quiet warning rather than erroring.

After adding or changing keys, **restart the dev server** — Next.js only reads `.env.local` at startup.

---

## Environment variables

| Variable | Required | Default behavior without it | Where to get it |
|---|---|---|---|
| `VALYU_API_KEY` | No | No live cited research; uses a model-only source note | [platform.valyu.ai](https://platform.valyu.ai) |
| `API_FOOTBALL_KEY` | No | Squads/lineups estimated; predictions still use real Elo | [dashboard.api-football.com](https://dashboard.api-football.com) |

`.env.local` is git-ignored. Never commit real keys.

---

## Running the app

```bash
npm run dev      # start the dev server (hot reload) on :3000
npm run build    # production build
npm run start    # serve the production build
npm run lint     # run ESLint
```

---

## How provenance works

Every report carries a **provenance** object that the UI surfaces, so users always know what's real:

| Field | Values | Meaning |
|---|---|---|
| `ratings` | `elo` \| `estimated` | Real Elo strength vs neutral fallback |
| `squads` | `api-football` \| `estimated` | Live roster vs seed names only |
| `lineups` | `confirmed` \| `projected` \| `none` | Official XI vs projected vs unavailable |
| `research` | `valyu` \| `none` | Cited live sources vs model-only |

This drives graceful degradation: a team with no live squad is flagged **"Squad is estimated — connect live squad data to firm it up"** rather than presenting guesses as fact. Connect the relevant key and the flag clears.

---

## Project structure

```
src/
├── app/
│   ├── page.tsx                 # Main product UI (predictions, modals, brackets)
│   ├── styles.css               # App styles
│   └── api/
│       ├── analyze/route.ts     # POST: build a match report (server-side)
│       └── groups/route.ts      # GET: group stage + knockout view
└── lib/
    ├── report.ts                # Orchestrates all sources into a MatchReport
    ├── prediction-engine.ts     # Deterministic probabilities, xG, scorelines, risks
    ├── elo.ts                   # World Football Elo fetch + parse (eloratings.net)
    ├── api-football.ts          # Squads, lineups, injuries, scorers, fixtures (cached)
    ├── valyu-research.ts        # Valyu search + cited-source extraction
    ├── team-intel.ts            # Assembles a team snapshot from live sources
    ├── countries.ts             # Canonical registry of all 48 finalists (Elo + API names)
    ├── groups.ts / groups-data.ts / knockout.ts / fixtures.ts  # Tournament structure
    ├── team-data.ts             # Seed data for local dev / fallback mode
    └── types.ts                 # Shared types
```

---

## API endpoints

### `POST /api/analyze`

Build a full match report.

**Request body**
```json
{
  "teamA": "Argentina",
  "teamB": "France",
  "lineupConfirmed": false,
  "host": "United States"
}
```
- `teamA`, `teamB` — required, 2–60 chars, must differ.
- `lineupConfirmed` — optional; forces lineup-confirmed mode.
- `host` — optional; whichever team matches gets home advantage.

**Response** — a `MatchReport` (`intel`, `prediction`, `lineupStatus`). Returns `400` for invalid input, `502` on failure.

### `GET /api/groups`

Returns the projected group standings and knockout bracket.

---

## Deployment

The app deploys cleanly to **[Vercel](https://vercel.com)** (or any Node host that runs Next.js):

1. Push the repo to your Git provider.
2. Import it into Vercel.
3. Add `VALYU_API_KEY` and `API_FOOTBALL_KEY` as environment variables (optional).
4. Deploy — the build command is `next build`.

---

## Troubleshooting

- **"… squad is estimated"** — `API_FOOTBALL_KEY` isn't set, the dev server wasn't restarted after adding it, or the API call failed. Restart the server and check the console for `[api-football]` lines.
- **`[api-football] skipped (plan limit)`** — expected on the free plan for season-2026 endpoints (fixtures/injuries/scorers). Upgrade the plan to enable them; squads and Elo still work.
- **No research sources** — set `VALYU_API_KEY` and restart.
- **Keys not taking effect** — Next.js reads `.env.local` only at startup; restart `npm run dev`.
