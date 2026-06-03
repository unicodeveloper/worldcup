import { getEloTable } from "./elo";
import { resolveCountry } from "./countries";
import { estimateMatch } from "./prediction-engine";
import { getGroupFixtures, getKnockoutFixtures, type Fixture } from "./fixtures";
import { buildKnockoutView } from "./knockout";
import { HOST_NATIONS, WORLD_CUP_GROUPS } from "./groups-data";
import type { FixtureSource, GroupMatch, GroupsView, GroupStandingRow, WorldCupGroup } from "./types";

const HOST_ADVANTAGE = 55; // Elo points for a host nation at home
const PAIRS: [number, number][] = [
  [0, 1],
  [0, 2],
  [0, 3],
  [1, 2],
  [1, 3],
  [2, 3]
];

type TeamElo = { team: string; elo: number; rank: number };

function eloFor(name: string, table: Map<string, number>, ratings: number[]): TeamElo {
  const country = resolveCountry(name);
  const elo = (country && table.get(country.elo)) || 1500;
  const rank = ratings.filter((r) => r > elo).length + 1;
  return { team: name, elo, rank };
}

/** Probability each team finishes top 2 — exact over all 3^6 outcome combinations. */
function advanceProbabilities(teams: TeamElo[], matchPairs: [number, number][], matchProbs: { a: number; d: number; b: number }[]): number[] {
  const advance = [0, 0, 0, 0];
  const combos = 3 ** matchPairs.length; // 729

  for (let mask = 0; mask < combos; mask += 1) {
    const points = [0, 0, 0, 0];
    let prob = 1;
    let m = mask;
    for (let p = 0; p < matchPairs.length; p += 1) {
      const outcome = m % 3;
      m = Math.floor(m / 3);
      const [i, j] = matchPairs[p];
      const mp = matchProbs[p];
      if (outcome === 0) {
        prob *= mp.a;
        points[i] += 3;
      } else if (outcome === 1) {
        prob *= mp.d;
        points[i] += 1;
        points[j] += 1;
      } else {
        prob *= mp.b;
        points[j] += 3;
      }
    }
    const order = [0, 1, 2, 3].sort((x, y) => points[y] - points[x] || teams[y].elo - teams[x].elo);
    advance[order[0]] += prob;
    advance[order[1]] += prob;
  }
  return advance;
}

function buildGroup(
  name: string,
  teamNames: string[],
  fixtures: Fixture[] | null,
  table: Map<string, number>,
  ratings: number[]
): WorldCupGroup {
  const teams = teamNames.map((n) => eloFor(n, table, ratings));
  const indexOf = (teamName: string) => {
    const target = resolveCountry(teamName)?.name ?? teamName;
    return teams.findIndex((t) => (resolveCountry(t.team)?.name ?? t.team) === target);
  };

  // Use the real schedule when available; otherwise the 6 round-robin pairings.
  const scheduled: { i: number; j: number; fx?: Fixture }[] =
    fixtures && fixtures.length >= 6
      ? fixtures
          .map((fx) => ({ i: indexOf(fx.team1), j: indexOf(fx.team2), fx }))
          .filter((p) => p.i >= 0 && p.j >= 0)
      : PAIRS.map(([i, j]) => ({ i, j }));

  const matches: GroupMatch[] = [];
  const matchPairs: [number, number][] = [];
  const matchProbs: { a: number; d: number; b: number }[] = [];
  const expectedPoints = [0, 0, 0, 0];

  for (const { i, j, fx } of scheduled) {
    const a = teams[i];
    const b = teams[j];
    const hostAdv = HOST_NATIONS.has(a.team) ? HOST_ADVANTAGE : HOST_NATIONS.has(b.team) ? -HOST_ADVANTAGE : 0;
    const est = estimateMatch(a.elo, b.elo, hostAdv);

    matchPairs.push([i, j]);
    matchProbs.push({ a: est.raw.winA, d: est.raw.draw, b: est.raw.winB });
    expectedPoints[i] += 3 * est.raw.winA + est.raw.draw;
    expectedPoints[j] += 3 * est.raw.winB + est.raw.draw;

    matches.push({
      teamA: a.team,
      teamB: b.team,
      eloA: a.elo,
      eloB: b.elo,
      winA: est.winA,
      draw: est.draw,
      winB: est.winB,
      predictedScore: est.predictedScore,
      host: HOST_NATIONS.has(a.team) ? a.team : HOST_NATIONS.has(b.team) ? b.team : undefined,
      date: fx?.date,
      time: fx?.time,
      ground: fx?.ground
    });
  }

  const advance = advanceProbabilities(teams, matchPairs, matchProbs);

  const standings: GroupStandingRow[] = teams
    .map((t, idx) => ({
      team: t.team,
      elo: t.elo,
      worldRank: t.rank,
      expectedPoints: Math.round(expectedPoints[idx] * 10) / 10,
      advanceProbability: Math.round(advance[idx] * 100)
    }))
    .sort((x, y) => y.advanceProbability - x.advanceProbability || y.expectedPoints - x.expectedPoints);

  return { name: `Group ${name}`, standings, matches };
}

/** Build the full real-draw group stage with Elo-based estimates for every match. */
export async function buildGroupsView(): Promise<GroupsView> {
  const [table, fixturesByGroup, knockoutFixtures] = await Promise.all([
    getEloTable(),
    getGroupFixtures(),
    getKnockoutFixtures()
  ]);
  const ratings = Array.from(table.values());
  const fixtureSource: FixtureSource = fixturesByGroup ? "openfootball" : "round-robin";

  const groups = WORLD_CUP_GROUPS.map((g) =>
    buildGroup(g.name, g.teams, fixturesByGroup?.get(`Group ${g.name}`) ?? null, table, ratings)
  );

  const knockout = knockoutFixtures ? buildKnockoutView(groups, knockoutFixtures, table) : null;

  // Title odds: softmax over Elo across the whole 48-team field.
  const field = WORLD_CUP_GROUPS.flatMap((g) => g.teams).map((team) => {
    const country = resolveCountry(team);
    return { team, elo: (country && table.get(country.elo)) || 1500 };
  });
  const weights = field.map((t) => ({ team: t.team, w: Math.exp((t.elo - 1950) / 90) }));
  const total = weights.reduce((sum, x) => sum + x.w, 0);
  const champions = weights
    .map((x) => ({ team: x.team, probability: Math.round((x.w / total) * 10000) / 100 }))
    .sort((a, b) => b.probability - a.probability); // all 48 teams, 2-dp so minnows aren't 0

  return { groups, champions, fixtureSource, knockout };
}
