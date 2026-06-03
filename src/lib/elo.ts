import { resolveCountry } from "./countries";

/**
 * Real national-team strength from the World Football Elo Ratings (eloratings.net).
 *
 * eloratings.net is a thin SPA over plain TSV files served at /World.tsv with no
 * auth and no rate limiting. Column layout (tab-separated):
 *   [0] global rank   [1] rank   [2] 2-letter code   [3] current Elo rating  ...
 *
 * We fetch once and cache for a day (ratings only move when matches are played).
 */
const ELO_URL = "https://www.eloratings.net/World.tsv";
const REVALIDATE_SECONDS = 60 * 60 * 24;

export type EloTable = Map<string, number>; // code -> rating

function parseEloTsv(tsv: string): EloTable {
  const table: EloTable = new Map();
  for (const line of tsv.split("\n")) {
    const cols = line.split("\t");
    if (cols.length < 4) continue;
    const code = cols[2]?.trim();
    const rating = Number(cols[3]);
    if (code && /^[A-Z]{2}$/.test(code) && Number.isFinite(rating)) {
      table.set(code, rating);
    }
  }
  return table;
}

let memo: { at: number; table: EloTable } | null = null;

export async function getEloTable(): Promise<EloTable> {
  if (memo && Date.now() - memo.at < REVALIDATE_SECONDS * 1000) return memo.table;

  const response = await fetch(ELO_URL, {
    headers: { "User-Agent": "WorldCupSeer/1.0 (+https://worldcupseer.app)" },
    next: { revalidate: REVALIDATE_SECONDS }
  });
  if (!response.ok) throw new Error(`Elo fetch failed: ${response.status}`);

  const table = parseEloTsv(await response.text());
  if (table.size === 0) throw new Error("Elo table parsed empty");

  memo = { at: Date.now(), table };
  return table;
}

/** Current real Elo rating for a team name, or null if unknown/unavailable. */
export async function getElo(teamName: string): Promise<number | null> {
  const country = resolveCountry(teamName);
  if (!country) return null;
  try {
    const table = await getEloTable();
    return table.get(country.elo) ?? null;
  } catch {
    return null;
  }
}

export type EloProfile = { elo: number; rank: number };

/** Real Elo rating plus world rank (rank derived by ordering the live table). */
export async function getEloProfile(teamName: string): Promise<EloProfile | null> {
  const country = resolveCountry(teamName);
  if (!country) return null;
  try {
    const table = await getEloTable();
    const elo = table.get(country.elo);
    if (elo === undefined) return null;
    const rank = Array.from(table.values()).filter((r) => r > elo).length + 1;
    return { elo, rank };
  } catch {
    return null;
  }
}

/**
 * Convert a real Elo matchup into expected goals (lambdas) for a Poisson model.
 *
 * The Elo gap gives A's expected match score (win=1, draw=0.5); we turn that into
 * an expected goal supremacy and split a tournament-average total between the sides.
 * Driving a single Poisson grid from these lambdas keeps win/draw/loss and the
 * scoreline distribution mutually consistent (and never negative).
 *
 * `homeAdvantage` (~65 Elo points) applies when teamA is the designated home side.
 */
const TOURNAMENT_TOTAL_GOALS = 2.6; // long-run avg goals per international match
const SUPREMACY_SCALE = 0.9;
const MIN_LAMBDA = 0.18;

export function eloExpectedGoals(eloA: number, eloB: number, homeAdvantage = 0) {
  const dr = eloA + homeAdvantage - eloB;
  const expectedA = 1 / (1 + Math.pow(10, -dr / 400));
  const clamped = Math.min(0.999, Math.max(0.001, expectedA));
  const supremacy = Math.log(clamped / (1 - clamped)) * SUPREMACY_SCALE;

  return {
    lambdaA: Math.max(MIN_LAMBDA, (TOURNAMENT_TOTAL_GOALS + supremacy) / 2),
    lambdaB: Math.max(MIN_LAMBDA, (TOURNAMENT_TOTAL_GOALS - supremacy) / 2),
    eloGap: dr
  };
}
