import { resolveCountry } from "./countries";

/**
 * Real squad, lineup, injury, fixture and scorer data from API-Football
 * (api-sports.io), which covers the FIFA World Cup 2026 as league id 1.
 *
 * The free plan allows ~100 requests/day, so every call is cached. Reference
 * data (squads, fixtures, injuries, top scorers) is cached for hours; lineups
 * are cached briefly because official team sheets land ~1h before kickoff.
 *
 * Set API_FOOTBALL_KEY in .env.local to enable. With no key, every helper
 * resolves to null and callers fall back to projected data.
 */
const HOST = "https://v3.football.api-sports.io";
const WORLD_CUP_LEAGUE = 1;
const SEASON = 2026;

export const apiFootballEnabled = () => Boolean(process.env.API_FOOTBALL_KEY);

type CacheEntry = { at: number; value: unknown };
const cache = new Map<string, CacheEntry>();

async function request<T>(path: string, ttlSeconds: number): Promise<T | null> {
  if (!process.env.API_FOOTBALL_KEY) return null;

  const cached = cache.get(path);
  if (cached && Date.now() - cached.at < ttlSeconds * 1000) return cached.value as T;

  try {
    const response = await fetch(`${HOST}${path}`, {
      headers: { "x-apisports-key": process.env.API_FOOTBALL_KEY },
      next: { revalidate: ttlSeconds }
    });
    if (!response.ok) throw new Error(`API-Football ${response.status} on ${path}`);

    const json = (await response.json()) as { errors?: unknown; response?: T };
    // API-Football returns errors as [] on success but as an object on failure
    // (e.g. {"plan":"Free plans do not have access to this season..."}).
    const errs = json.errors;
    const hasErrors = Array.isArray(errs) ? errs.length > 0 : errs && Object.keys(errs).length > 0;
    if (hasErrors) {
      // Plan/season restrictions are an expected free-tier limit, not a bug: the
      // free plan can't read this season, so season-gated endpoints (fixtures,
      // injuries, scorers) return {"plan": "..."}. Log once quietly and cache the
      // skip — it won't change until the plan is upgraded — so callers fall back
      // and we don't burn the daily quota re-asking a guaranteed failure.
      const planLimited =
        !Array.isArray(errs) && typeof errs === "object" && errs !== null && "plan" in errs;
      if (planLimited) {
        console.warn(`[api-football] skipped (plan limit): ${path}`);
        cache.set(path, { at: Date.now(), value: null });
        return null;
      }
      throw new Error(`API-Football errors on ${path}: ${JSON.stringify(errs)}`);
    }

    const value = (json.response ?? null) as T | null;
    cache.set(path, { at: Date.now(), value });
    return value;
  } catch (error) {
    console.error("[api-football]", error);
    return null;
  }
}

const HOUR = 3600;

/* ---------------- team resolution ---------------- */

type ApiTeam = { team: { id: number; name: string } };

export async function resolveTeamId(teamName: string): Promise<number | null> {
  const country = resolveCountry(teamName);
  const search = country?.apiName ?? teamName;
  const res = await request<ApiTeam[]>(`/teams?search=${encodeURIComponent(search)}`, HOUR * 24);
  return res?.[0]?.team.id ?? null;
}

/* ---------------- squad ---------------- */

export type ApiSquadPlayer = {
  id: number;
  name: string;
  position: string; // Goalkeeper | Defender | Midfielder | Attacker
  number?: number;
};

type SquadResponse = { players: ApiSquadPlayer[] }[];

export async function getSquad(teamId: number): Promise<ApiSquadPlayer[] | null> {
  const res = await request<SquadResponse>(`/players/squads?team=${teamId}`, HOUR * 12);
  return res?.[0]?.players ?? null;
}

/* ---------------- injuries / suspensions ---------------- */

export type ApiInjury = { player: string; type: string; reason: string };

// In API-Football v3, `type` and `reason` are nested under `player`.
type InjuryResponse = { player: { name: string; type?: string; reason?: string } }[];

export async function getInjuries(teamId: number): Promise<ApiInjury[] | null> {
  const res = await request<InjuryResponse>(
    `/injuries?team=${teamId}&season=${SEASON}`,
    HOUR * 3
  );
  if (!res) return null;
  return res.map((i) => ({
    player: i.player?.name ?? "Unknown",
    type: i.player?.type ?? "Injury",
    reason: i.player?.reason ?? "Unavailable"
  }));
}

/* ---------------- fixtures + lineups ---------------- */

export type ApiFixture = {
  id: number;
  date: string;
  status: string; // NS, 1H, FT...
  home: string;
  away: string;
};

type FixtureResponse = {
  fixture: { id: number; date: string; status: { short: string } };
  teams: { home: { name: string }; away: { name: string } };
}[];

/** Next scheduled meeting (or most relevant fixture) between two teams. */
export async function getFixtureBetween(teamIdA: number, teamIdB: number): Promise<ApiFixture | null> {
  const res = await request<FixtureResponse>(
    `/fixtures/headtohead?h2h=${teamIdA}-${teamIdB}&league=${WORLD_CUP_LEAGUE}&season=${SEASON}`,
    HOUR
  );
  const fx = res?.[0];
  if (!fx) return null;
  return {
    id: fx.fixture.id,
    date: fx.fixture.date,
    status: fx.fixture.status.short,
    home: fx.teams.home.name,
    away: fx.teams.away.name
  };
}

export type ApiLineup = {
  team: string;
  formation: string;
  startXI: { name: string; pos: string }[];
  substitutes: { name: string; pos: string }[];
};

type LineupResponse = {
  team: { name: string };
  formation: string;
  startXI: { player: { name: string; pos: string } }[];
  substitutes: { player: { name: string; pos: string } }[];
}[];

/** Official lineups for a fixture — only populated ~1h before kickoff. */
export async function getLineups(fixtureId: number): Promise<ApiLineup[] | null> {
  const res = await request<LineupResponse>(`/fixtures/lineups?fixture=${fixtureId}`, 300);
  if (!res || res.length === 0) return null;
  return res.map((l) => ({
    team: l.team.name,
    formation: l.formation,
    startXI: l.startXI.map((p) => ({ name: p.player.name, pos: p.player.pos })),
    substitutes: l.substitutes.map((p) => ({ name: p.player.name, pos: p.player.pos }))
  }));
}

/* ---------------- top scorers ---------------- */

export type ApiScorer = { name: string; team: string; goals: number };

type ScorerResponse = {
  player: { name: string };
  statistics: { team: { name: string }; goals: { total: number | null } }[];
}[];

export async function getTopScorers(): Promise<ApiScorer[] | null> {
  const res = await request<ScorerResponse>(
    `/players/topscorers?league=${WORLD_CUP_LEAGUE}&season=${SEASON}`,
    HOUR * 6
  );
  if (!res) return null;
  return res.map((s) => ({
    name: s.player.name,
    team: s.statistics[0]?.team.name ?? "",
    goals: s.statistics[0]?.goals.total ?? 0
  }));
}
