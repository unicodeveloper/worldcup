import { resolveCountry } from "./countries";
import { estimateMatch } from "./prediction-engine";
import { HOST_NATIONS } from "./groups-data";
import type { KnockoutFixture } from "./fixtures";
import type { KnockoutMatch, KnockoutRound, KnockoutView, WorldCupGroup } from "./types";

const HOST_ADVANTAGE = 55;
const ROUND_ORDER = ["Round of 32", "Round of 16", "Quarter-final", "Semi-final", "Match for third place", "Final"];

type Slot = { team: string; elo: number; expectedPoints: number };
type Resolved = { teamA: string; teamB: string; winner: string; loser: string };

function eloOf(name: string, table: Map<string, number>): number {
  const country = resolveCountry(name);
  return (country && table.get(country.elo)) || 1500;
}

/**
 * Build the projected knockout bracket. The structure, dates and venues are real
 * (openfootball); the qualifiers and winners are projected from the Elo group
 * model — group winners/runners-up from the standings, the eight best
 * third-placed teams, then each tie resolved by win probability (Elo breaks
 * level ties, standing in for a shootout).
 */
export function buildKnockoutView(
  groups: WorldCupGroup[],
  fixtures: KnockoutFixture[],
  table: Map<string, number>
): KnockoutView {
  // group letter -> ordered finishers (winner, runner-up, third)
  const byLetter = new Map<string, Slot[]>();
  for (const g of groups) {
    const letter = g.name.replace("Group ", "");
    byLetter.set(
      letter,
      g.standings.map((s) => ({ team: s.team, elo: s.elo, expectedPoints: s.expectedPoints }))
    );
  }

  // The eight best third-placed teams qualify (by projected points).
  const thirds = Array.from(byLetter.entries())
    .map(([letter, finishers]) => ({ letter, third: finishers[2] }))
    .filter((t) => t.third)
    .sort((a, b) => b.third.expectedPoints - a.third.expectedPoints);
  const qualifyingThirdLetters = new Set(thirds.slice(0, 8).map((t) => t.letter));
  const consumedThirds = new Set<string>();

  const results = new Map<number, Resolved>();

  const resolveSlot = (slot: string): Slot | null => {
    const direct = slot.match(/^([12])([A-L])$/);
    if (direct) {
      const finishers = byLetter.get(direct[2]);
      return finishers?.[direct[1] === "1" ? 0 : 1] ?? null;
    }

    const third = slot.match(/^3([A-L/]+)$/);
    if (third) {
      const letters = third[1].split("/");
      // best available third among allowed groups, preferring qualifying thirds
      const ranked = letters
        .filter((l) => !consumedThirds.has(l) && byLetter.get(l)?.[2])
        .sort((a, b) => (byLetter.get(b)![2].expectedPoints) - (byLetter.get(a)![2].expectedPoints))
        .sort((a, b) => Number(qualifyingThirdLetters.has(b)) - Number(qualifyingThirdLetters.has(a)));
      const chosen = ranked[0];
      if (!chosen) return null;
      consumedThirds.add(chosen);
      return byLetter.get(chosen)![2];
    }

    const winner = slot.match(/^W(\d+)$/);
    if (winner) {
      const r = results.get(Number(winner[1]));
      return r ? { team: r.winner, elo: eloOf(r.winner, table), expectedPoints: 0 } : null;
    }
    const loser = slot.match(/^L(\d+)$/);
    if (loser) {
      const r = results.get(Number(loser[1]));
      return r ? { team: r.loser, elo: eloOf(r.loser, table), expectedPoints: 0 } : null;
    }
    return null;
  };

  const matches: KnockoutMatch[] = fixtures
    .slice()
    .sort((a, b) => a.num - b.num)
    .map((fx) => {
      const a = resolveSlot(fx.team1);
      const b = resolveSlot(fx.team2);

      let winA = 0;
      let draw = 0;
      let winB = 0;
      let predictedScore = "—";
      let projectedWinner: string | null = null;

      if (a && b) {
        const hostAdv = HOST_NATIONS.has(a.team) ? HOST_ADVANTAGE : HOST_NATIONS.has(b.team) ? -HOST_ADVANTAGE : 0;
        const est = estimateMatch(a.elo, b.elo, hostAdv);
        winA = est.winA;
        draw = est.draw;
        winB = est.winB;
        predictedScore = est.predictedScore;
        // Higher win share advances; level ties break on Elo (shootout proxy).
        const aAdvances = est.raw.winA > est.raw.winB || (est.raw.winA === est.raw.winB && a.elo >= b.elo);
        projectedWinner = aAdvances ? a.team : b.team;
        results.set(fx.num, {
          teamA: a.team,
          teamB: b.team,
          winner: projectedWinner,
          loser: aAdvances ? b.team : a.team
        });
      }

      return {
        num: fx.num,
        round: fx.round,
        slotA: fx.team1,
        slotB: fx.team2,
        teamA: a?.team ?? null,
        teamB: b?.team ?? null,
        eloA: a?.elo ?? 0,
        eloB: b?.elo ?? 0,
        winA,
        draw,
        winB,
        predictedScore,
        projectedWinner,
        host: a && HOST_NATIONS.has(a.team) ? a.team : b && HOST_NATIONS.has(b.team) ? b.team : undefined,
        date: fx.date,
        ground: fx.ground
      };
    });

  const rounds: KnockoutRound[] = ROUND_ORDER.map((name) => ({
    name,
    matches: matches.filter((m) => m.round === name)
  })).filter((r) => r.matches.length > 0);

  const finalMatch = matches.find((m) => m.round === "Final");

  return { rounds, projectedChampion: finalMatch?.projectedWinner ?? null };
}
