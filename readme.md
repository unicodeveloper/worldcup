# World Cup Seer

AI-powered match intelligence for the 2026 World Cup.

World Cup Seer generates explainable match predictions from team strength, squad context, likely lineups, scorer profiles, and Valyu-backed live research.

## V1 Scope

- Match prediction for any `Team A vs Team B`
- Win/draw/loss probabilities
- Expected score and scoreline distribution
- Likely goalscorers
- Squad and bench snapshot
- Live lineup mode toggle
- Bracket simulation preview
- Server-side Valyu research integration

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set `VALYU_API_KEY` in `.env.local` to enable live research. Without it, the app runs with a transparent demo model so the product can be developed locally.

## Commands

```bash
npm run dev
npm run build
npm run lint
```

## Architecture

- `src/app/page.tsx` contains the first product UI.
- `src/app/api/analyze/route.ts` keeps match analysis server-side.
- `src/lib/valyu-research.ts` handles Valyu search and source extraction.
- `src/lib/prediction-engine.ts` handles deterministic probabilities, xG, scorelines, scorer estimates, and bracket simulation.
- `src/lib/team-data.ts` provides seed data for local development and fallback mode.
