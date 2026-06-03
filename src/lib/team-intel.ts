import { getEloProfile } from "./elo";
import {
  apiFootballEnabled,
  getInjuries,
  getLineups,
  getSquad,
  getTopScorers,
  resolveTeamId,
  type ApiLineup,
  type ApiScorer
} from "./api-football";
import { getSeedKeyPlayers } from "./team-data";
import type { PlayerSnapshot, TeamSnapshot } from "./types";

/** Map raw Elo (~1300-2200) onto a friendly 0-100 display rating. */
function eloToRating(elo: number): number {
  return Math.round(Math.max(40, Math.min(99, (elo - 1300) / 9.5)));
}

const COMMON_FORMATION = "4-3-3";

function positionRole(position: string): string {
  switch (position) {
    case "Goalkeeper":
      return "Goalkeeper";
    case "Defender":
      return "Defender";
    case "Midfielder":
      return "Midfielder";
    case "Attacker":
      return "Forward";
    default:
      return position || "Squad";
  }
}

/**
 * Assemble a real team snapshot from live sources.
 *
 * Elo (rating + world rank) is always real when the nation is known. Squad, XI,
 * injuries and scorers become real once API-Football is connected; otherwise the
 * snapshot is flagged `estimated` and supplies only seed player *names* so the UI
 * never presents fabricated numbers as fact.
 */
export async function buildTeamSnapshot(
  name: string,
  topScorers: ApiScorer[] | null
): Promise<TeamSnapshot> {
  const eloProfile = await getEloProfile(name);
  const elo = eloProfile?.elo ?? 0;
  const rating = elo ? eloToRating(elo) : 0;
  const worldRank = eloProfile?.rank ?? 0;

  const base: TeamSnapshot = {
    name,
    elo,
    worldRank,
    rating,
    likelyFormation: COMMON_FORMATION,
    startXI: [],
    substitutes: [],
    keyPlayers: [],
    unavailable: [],
    squadStatus: "estimated",
    notes: []
  };

  if (!apiFootballEnabled()) {
    return {
      ...base,
      keyPlayers: getSeedKeyPlayers(name),
      notes: [
        elo
          ? `Strength is real (World Football Elo ${elo}, rank #${worldRank}).`
          : "Nation not in the Elo table; using neutral strength.",
        "Connect API-Football to load the real squad, XI, injuries and scorers."
      ]
    };
  }

  const teamId = await resolveTeamId(name);
  if (!teamId) {
    return { ...base, keyPlayers: getSeedKeyPlayers(name), notes: ["Team not found in API-Football for this season."] };
  }

  const [squad, injuries] = await Promise.all([getSquad(teamId), getInjuries(teamId)]);
  const unavailable = (injuries ?? []).map((i) => `${i.player} (${i.reason})`);
  const outNames = new Set((injuries ?? []).map((i) => i.player.toLowerCase()));

  // Key players: this team's real tournament scorers, else its attackers.
  const teamScorers = (topScorers ?? []).filter((s) => s.team.toLowerCase() === name.toLowerCase());
  let keyPlayers: PlayerSnapshot[];
  if (teamScorers.length) {
    keyPlayers = teamScorers.slice(0, 3).map((s) => ({
      name: s.name,
      role: "Forward",
      goals: s.goals,
      availability: outNames.has(s.name.toLowerCase()) ? "out" : "likely"
    }));
  } else if (squad) {
    keyPlayers = squad
      .filter((p) => p.position === "Attacker")
      .slice(0, 3)
      .map((p) => ({
        name: p.name,
        role: positionRole(p.position),
        availability: outNames.has(p.name.toLowerCase()) ? "out" : "likely"
      }));
  } else {
    keyPlayers = getSeedKeyPlayers(name);
  }

  return {
    ...base,
    keyPlayers,
    unavailable,
    squadStatus: squad ? "projected" : "estimated",
    startXI: squad ? squad.slice(0, 11).map((p) => p.name) : [],
    substitutes: squad ? squad.slice(11, 18).map((p) => p.name) : [],
    notes: [
      `World Football Elo ${elo} (rank #${worldRank}).`,
      squad ? `Real ${squad.length}-player squad loaded from API-Football.` : "Squad pending.",
      injuries?.length ? `${injuries.length} injury/suspension flag(s) applied.` : "No injuries flagged."
    ]
  };
}

/** Overlay an official team sheet onto a snapshot (called when lineups are live). */
export function applyConfirmedLineup(team: TeamSnapshot, lineup: ApiLineup): TeamSnapshot {
  return {
    ...team,
    likelyFormation: lineup.formation || team.likelyFormation,
    startXI: lineup.startXI.map((p) => p.name),
    substitutes: lineup.substitutes.map((p) => p.name),
    squadStatus: "confirmed"
  };
}

export { getLineups };
