import { apiFootballEnabled, getFixtureBetween, resolveTeamId } from "./api-football";
import { resolveCountry } from "./countries";
import { predictMatch } from "./prediction-engine";
import { applyConfirmedLineup, buildTeamSnapshot, getLineups } from "./team-intel";
import { getTopScorers } from "./api-football";
import { getValyuSources } from "./valyu-research";
import type { DataProvenance, MatchReport, ResearchIntel, Source, TeamSnapshot } from "./types";

function headlineFor(teamA: TeamSnapshot, teamB: TeamSnapshot, provenance: DataProvenance): string {
  if (provenance.ratings === "elo") {
    const favourite = teamA.elo >= teamB.elo ? teamA : teamB;
    const underdog = favourite === teamA ? teamB : teamA;
    return `${favourite.name} (Elo ${favourite.elo}, #${favourite.worldRank}) meet ${underdog.name} (Elo ${underdog.elo}, #${underdog.worldRank}).`;
  }
  return `${teamA.name} vs ${teamB.name} — estimated strength until live ratings load.`;
}

/** Try to overlay an official team sheet; returns updated snapshots + whether it was live. */
async function tryConfirmedLineups(teamA: TeamSnapshot, teamB: TeamSnapshot) {
  if (!apiFootballEnabled()) return { teamA, teamB, confirmed: false };

  const [idA, idB] = await Promise.all([resolveTeamId(teamA.name), resolveTeamId(teamB.name)]);
  if (!idA || !idB) return { teamA, teamB, confirmed: false };

  const fixture = await getFixtureBetween(idA, idB);
  if (!fixture) return { teamA, teamB, confirmed: false };

  const lineups = await getLineups(fixture.id);
  if (!lineups || lineups.length < 2) return { teamA, teamB, confirmed: false };

  const match = (team: TeamSnapshot) => {
    const apiName = resolveCountry(team.name)?.apiName ?? team.name;
    return lineups.find((l) => l.team.toLowerCase() === apiName.toLowerCase());
  };
  const lineupA = match(teamA);
  const lineupB = match(teamB);
  if (!lineupA || !lineupB) return { teamA, teamB, confirmed: false };

  return {
    teamA: applyConfirmedLineup(teamA, lineupA),
    teamB: applyConfirmedLineup(teamB, lineupB),
    confirmed: true
  };
}

/** Assemble a full match report from every real source available, with graceful fallback. */
export async function buildMatchReport(
  teamAName: string,
  teamBName: string,
  lineupConfirmedToggle = false,
  homeAdvantage = 0
): Promise<MatchReport> {
  const topScorers = await getTopScorers(); // one shared call (null without key)

  const [snapA, snapB, valyuSources] = await Promise.all([
    buildTeamSnapshot(teamAName, topScorers),
    buildTeamSnapshot(teamBName, topScorers),
    getValyuSources(teamAName, teamBName)
  ]);

  const { teamA, teamB, confirmed } = await tryConfirmedLineups(snapA, snapB);

  const sources: Source[] =
    valyuSources && valyuSources.length
      ? valyuSources
      : [{ title: "Live model", snippet: "World Football Elo ratings power the prediction. Add VALYU_API_KEY for cited match research." }];

  const provenance: DataProvenance = {
    ratings: teamA.elo || teamB.elo ? "elo" : "estimated",
    squads: teamA.squadStatus !== "estimated" || teamB.squadStatus !== "estimated" ? "api-football" : "estimated",
    lineups: confirmed ? "confirmed" : teamA.startXI.length ? "projected" : "none",
    research: valyuSources && valyuSources.length ? "valyu" : "none"
  };

  const intel: ResearchIntel = {
    teamA,
    teamB,
    sources,
    provenance,
    headline: headlineFor(teamA, teamB, provenance)
  };

  const lineupConfirmed = confirmed || lineupConfirmedToggle;

  return {
    intel,
    prediction: predictMatch(intel, lineupConfirmed, homeAdvantage),
    lineupStatus: confirmed ? "confirmed" : "projected"
  };
}
