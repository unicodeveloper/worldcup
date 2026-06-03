import type { MatchEvents, Prediction, ResearchIntel, TeamSnapshot } from "./types";
import { eloExpectedGoals } from "./elo";

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const round1 = (v: number) => Math.round(v * 10) / 10;
const pct = (v: number) => Math.round(v * 100);

function poisson(lambda: number, goals: number) {
  let factorial = 1;
  for (let i = 2; i <= goals; i += 1) factorial *= i;
  return (Math.exp(-lambda) * Math.pow(lambda, goals)) / factorial;
}

/** Full W/D/L + scoreline grid from the two expected-goal rates (one model, consistent). */
function poissonGrid(lambdaA: number, lambdaB: number) {
  let winA = 0;
  let draw = 0;
  let winB = 0;
  const scorelines: { score: string; probability: number }[] = [];

  for (let a = 0; a <= 8; a += 1) {
    for (let b = 0; b <= 8; b += 1) {
      const p = poisson(lambdaA, a) * poisson(lambdaB, b);
      if (a > b) winA += p;
      else if (a === b) draw += p;
      else winB += p;
      scorelines.push({ score: `${a}-${b}`, probability: p });
    }
  }

  const top = scorelines
    .sort((x, y) => y.probability - x.probability)
    .slice(0, 5)
    .map((s) => ({ score: s.score, probability: pct(s.probability) }));

  return { winA, draw, winB, top };
}

/**
 * Fallback strength when a nation is missing from the Elo table: derive a pseudo
 * Elo from the display rating so the model still produces a sensible result.
 */
function effectiveElo(team: TeamSnapshot): number {
  return team.elo > 0 ? team.elo : 1300 + team.rating * 9.5;
}

/**
 * Single-match estimate straight from two real Elo ratings — used by the group
 * view to estimate every fixture. Returns both raw probabilities (for points
 * projections) and display-rounded values.
 */
export function estimateMatch(eloA: number, eloB: number, homeAdvantage = 0) {
  const { lambdaA, lambdaB } = eloExpectedGoals(eloA, eloB, homeAdvantage);
  const grid = poissonGrid(lambdaA, lambdaB);
  return {
    raw: { winA: grid.winA, draw: grid.draw, winB: grid.winB },
    winA: pct(grid.winA),
    draw: pct(grid.draw),
    winB: pct(grid.winB),
    xgA: round1(lambdaA),
    xgB: round1(lambdaB),
    predictedScore: grid.top[0]?.score ?? `${Math.round(lambdaA)}-${Math.round(lambdaB)}`
  };
}

/** In-match event probabilities derived from the two expected-goal rates. */
function matchEvents(lambdaA: number, lambdaB: number): MatchEvents {
  const pA0 = Math.exp(-lambdaA); // P(A scores 0)
  const pB0 = Math.exp(-lambdaB);

  let over25 = 0;
  for (let a = 0; a <= 8; a += 1) {
    for (let b = 0; b <= 8; b += 1) {
      if (a + b >= 3) over25 += poisson(lambdaA, a) * poisson(lambdaB, b);
    }
  }

  return {
    bothTeamsScore: pct((1 - pA0) * (1 - pB0)),
    over25: pct(over25),
    under25: pct(1 - over25),
    cleanSheetA: pct(pB0), // A keeps a clean sheet when B fails to score
    cleanSheetB: pct(pA0),
    expectedGoals: round1(lambdaA + lambdaB)
  };
}

function likelyScorers(teamA: TeamSnapshot, teamB: TeamSnapshot, xgA: number, xgB: number) {
  const build = (team: TeamSnapshot, teamXg: number) =>
    team.keyPlayers
      .filter((p) => p.availability !== "out")
      .map((p, index) => {
        // Real goals (top-scorer feed) weight the estimate; otherwise depth order does.
        const goalWeight = p.goals && p.goals > 0 ? clamp(p.goals / 6, 0.4, 1) : 0.85 - index * 0.18;
        return {
          player: p.name,
          team: team.name,
          probability: clamp(Math.round((teamXg / 2.4) * goalWeight * 52), 4, 52)
        };
      });

  return [...build(teamA, xgA), ...build(teamB, xgB)]
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 6);
}

type DriverContext = {
  eloGap: number;
  winA: number;
  winB: number;
  draw: number;
  xgA: number;
  xgB: number;
  predictedScore: string;
  events: MatchEvents;
  host?: string;
};

/**
 * Match-specific reasoning derived from the real model outputs (exact win %, xG,
 * predicted score, gap size, event probabilities, host edge) — so every fixture
 * reads differently rather than reusing one template.
 */
function buildDrivers(teamA: TeamSnapshot, teamB: TeamSnapshot, ctx: DriverContext): string[] {
  const aFav = ctx.eloGap >= 0;
  const stronger = aFav ? teamA : teamB;
  const weaker = aFav ? teamB : teamA;
  const favWin = aFav ? ctx.winA : ctx.winB;
  const gap = Math.abs(ctx.eloGap);
  const drivers: string[] = [];

  // 1) Strength framing, graded by how big the gap actually is.
  if (stronger.elo && weaker.elo) {
    if (gap >= 220) {
      drivers.push(`${stronger.name} are heavy favourites — a ${gap}-point Elo gulf (${stronger.elo}, #${stronger.worldRank} vs ${weaker.elo}, #${weaker.worldRank}) projects about ${favWin}% to win.`);
    } else if (gap >= 100) {
      drivers.push(`${stronger.name} are clear favourites on Elo (${stronger.elo} to ${weaker.elo}, a ${gap}-point edge), worth roughly ${favWin}% here.`);
    } else if (gap >= 45) {
      drivers.push(`${stronger.name} are favoured but it is far from settled — ${favWin}% to win against a ${ctx.draw}% draw (Elo ${stronger.elo} vs ${weaker.elo}).`);
    } else {
      drivers.push(`Near coin-flip on Elo (${stronger.elo} vs ${weaker.elo}, just ${gap} points apart) — ${ctx.draw}% of simulations finish level.`);
    }
  } else {
    drivers.push(`${stronger.name} carry the stronger profile, but live ratings are missing for one side.`);
  }

  // 2) Goals shape, from the expected-goal total.
  const total = ctx.events.expectedGoals;
  if (total <= 2.1) {
    drivers.push(`A tight, low-event game on the numbers — most likely ${ctx.predictedScore} with about ${total.toFixed(1)} goals expected (xG ${ctx.xgA.toFixed(1)}–${ctx.xgB.toFixed(1)}).`);
  } else if (total >= 3.0) {
    drivers.push(`Open game projected — ${ctx.predictedScore} the likeliest line with ~${total.toFixed(1)} goals (xG ${ctx.xgA.toFixed(1)}–${ctx.xgB.toFixed(1)}).`);
  } else {
    drivers.push(`Model centres on ${ctx.predictedScore}, xG ${ctx.xgA.toFixed(1)} to ${ctx.xgB.toFixed(1)} (~${total.toFixed(1)} total goals).`);
  }

  // 3) The standout event probability for this specific match.
  const e = ctx.events;
  if (e.cleanSheetA >= 55) drivers.push(`${teamA.name} are well placed to keep a clean sheet (${e.cleanSheetA}%).`);
  else if (e.cleanSheetB >= 55) drivers.push(`${teamB.name} are well placed to keep a clean sheet (${e.cleanSheetB}%).`);
  else if (e.bothTeamsScore >= 55) drivers.push(`Both teams are likely to score (${e.bothTeamsScore}%) — goals at both ends look probable.`);
  else if (e.over25 >= 55) drivers.push(`The total leans over 2.5 goals (${e.over25}%).`);
  else drivers.push(`The total leans under 2.5 goals (${e.under25}%).`);

  // 4) Home advantage, only where it actually applies.
  if (ctx.host) drivers.push(`${ctx.host} carry home advantage at the venue, nudging the edge their way.`);

  return drivers;
}

function buildRisks(teamA: TeamSnapshot, teamB: TeamSnapshot): string[] {
  const risks = [
    "Likely-scorer estimates move with the confirmed XI and penalty-taker assignment."
  ];
  for (const team of [teamA, teamB]) {
    if (team.unavailable.length) {
      risks.push(`${team.name} missing: ${team.unavailable.slice(0, 3).join(", ")}.`);
    }
    if (team.squadStatus === "estimated") {
      risks.push(`${team.name} squad is estimated — connect live squad data to firm it up.`);
    }
  }
  return risks;
}

export function predictMatch(intel: ResearchIntel, lineupConfirmed = false, homeAdvantage = 0): Prediction {
  const { teamA, teamB } = intel;
  const { lambdaA, lambdaB, eloGap } = eloExpectedGoals(effectiveElo(teamA), effectiveElo(teamB), homeAdvantage);
  const grid = poissonGrid(lambdaA, lambdaB);
  const events = matchEvents(lambdaA, lambdaB);

  const predictedScore = grid.top[0]?.score ?? `${Math.round(lambdaA)}-${Math.round(lambdaB)}`;
  const host = homeAdvantage > 0 ? teamA.name : homeAdvantage < 0 ? teamB.name : undefined;

  // Confidence rises with the rating gap and with how much real data backs the call.
  const dataBacking =
    (intel.provenance.ratings === "elo" ? 10 : 0) +
    (intel.provenance.squads === "api-football" ? 8 : 0) +
    (intel.provenance.lineups === "confirmed" ? 8 : intel.provenance.lineups === "projected" ? 3 : 0) +
    Math.min(6, intel.sources.length);
  const confidence = clamp(Math.round(50 + Math.abs(eloGap) / 14 + dataBacking + (lineupConfirmed ? 4 : 0)), 50, 92);

  return {
    teamA: teamA.name,
    teamB: teamB.name,
    winA: pct(grid.winA),
    draw: pct(grid.draw),
    winB: pct(grid.winB),
    xgA: round1(lambdaA),
    xgB: round1(lambdaB),
    predictedScore,
    scorelines: grid.top,
    likelyScorers: likelyScorers(teamA, teamB, lambdaA, lambdaB),
    confidence,
    keyDrivers: buildDrivers(teamA, teamB, {
      eloGap,
      winA: pct(grid.winA),
      winB: pct(grid.winB),
      draw: pct(grid.draw),
      xgA: round1(lambdaA),
      xgB: round1(lambdaB),
      predictedScore,
      events,
      host
    }),
    risks: buildRisks(teamA, teamB),
    whatChanges: [
      "Confirmed starting XI and late fitness news",
      "Unexpected rotation in midfield or fullback roles",
      "Early yellow cards to high-leverage defenders or anchors",
      "Penalty-taker assignment and set-piece routines"
    ],
    events
  };
}

