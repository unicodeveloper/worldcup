/**
 * Real 2026 World Cup match schedule from openfootball/worldcup.json — a free,
 * open dataset of the official fixtures: dates, kickoff times, venues, the exact
 * group-stage matchups, and the knockout bracket structure (slot codes like
 * "1A", "2B", "3A/B/C/D/F", "W74"). Cached for a day; callers fall back to a
 * synthesized round-robin if it can't be reached.
 */
const SOURCE_URL =
  "https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json";
const REVALIDATE_SECONDS = 60 * 60 * 12;

export type Fixture = {
  group: string; // e.g. "Group A"
  team1: string;
  team2: string;
  date?: string;
  time?: string;
  ground?: string;
};

export type KnockoutFixture = {
  num: number; // sequential match number across the tournament
  round: string; // "Round of 32" … "Final"
  team1: string; // slot code, e.g. "1A", "2B", "3A/B/C/D/F", "W74", "L101"
  team2: string;
  date?: string;
  time?: string;
  ground?: string;
};

type OpenFootballMatch = {
  group?: string;
  round?: string;
  team1?: string;
  team2?: string;
  date?: string;
  time?: string;
  ground?: string;
};

type ParsedSchedule = { byGroup: Map<string, Fixture[]>; knockout: KnockoutFixture[] };

let memo: { at: number; data: ParsedSchedule } | null = null;

async function loadSchedule(): Promise<ParsedSchedule | null> {
  if (memo && Date.now() - memo.at < REVALIDATE_SECONDS * 1000) return memo.data;

  try {
    const response = await fetch(SOURCE_URL, { next: { revalidate: REVALIDATE_SECONDS } });
    if (!response.ok) throw new Error(`fixtures fetch failed: ${response.status}`);

    const json = (await response.json()) as { matches?: OpenFootballMatch[] };
    const matches = json.matches ?? [];

    const byGroup = new Map<string, Fixture[]>();
    const knockout: KnockoutFixture[] = [];

    matches.forEach((m, index) => {
      if (!m.team1 || !m.team2) return;
      if (m.group) {
        const list = byGroup.get(m.group) ?? [];
        list.push({ group: m.group, team1: m.team1, team2: m.team2, date: m.date, time: m.time, ground: m.ground });
        byGroup.set(m.group, list);
      } else if (m.round) {
        knockout.push({
          num: index + 1, // matches are listed in tournament order
          round: m.round,
          team1: m.team1,
          team2: m.team2,
          date: m.date,
          time: m.time,
          ground: m.ground
        });
      }
    });

    if (byGroup.size === 0) throw new Error("no group fixtures parsed");
    const data = { byGroup, knockout };
    memo = { at: Date.now(), data };
    return data;
  } catch (error) {
    console.error("[fixtures]", error);
    return null;
  }
}

/** Group-stage fixtures keyed by group name ("Group A" … "Group L"), or null on failure. */
export async function getGroupFixtures(): Promise<Map<string, Fixture[]> | null> {
  return (await loadSchedule())?.byGroup ?? null;
}

/** Knockout-stage fixtures (slot codes + real dates/venues) in match order, or null. */
export async function getKnockoutFixtures(): Promise<KnockoutFixture[] | null> {
  return (await loadSchedule())?.knockout ?? null;
}
