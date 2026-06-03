export type Source = {
  title: string;
  url?: string;
  snippet: string;
};

export type PlayerSnapshot = {
  name: string;
  role: string;
  goals?: number; // real tournament goals when known (top-scorers feed)
  availability: "likely" | "doubtful" | "out";
};

export type TeamSnapshot = {
  name: string;
  elo: number; // real World Football Elo (0 if unknown)
  worldRank: number; // real rank within the Elo table (0 if unknown)
  rating: number; // Elo normalized to a 0-100 display scale
  goalsForAvg?: number; // real, from API-Football team statistics
  goalsAgainstAvg?: number;
  likelyFormation: string;
  startXI: string[]; // predicted or confirmed XI (empty until squad data loads)
  substitutes: string[];
  keyPlayers: PlayerSnapshot[];
  unavailable: string[]; // real injuries / suspensions
  squadStatus: "confirmed" | "projected" | "estimated"; // provenance of squad+XI
  notes: string[];
};

/** Tracks which real sources actually contributed to a report. */
export type DataProvenance = {
  ratings: "elo" | "estimated"; // win/draw/loss + xG basis
  squads: "api-football" | "estimated";
  lineups: "confirmed" | "projected" | "none";
  research: "valyu" | "none";
};

export type ResearchIntel = {
  teamA: TeamSnapshot;
  teamB: TeamSnapshot;
  sources: Source[];
  provenance: DataProvenance;
  headline: string;
};

/** Model-derived in-match event probabilities (all from the Poisson goal model). */
export type MatchEvents = {
  bothTeamsScore: number;
  over25: number;
  under25: number;
  cleanSheetA: number;
  cleanSheetB: number;
  expectedGoals: number;
};

export type Prediction = {
  teamA: string;
  teamB: string;
  winA: number;
  draw: number;
  winB: number;
  xgA: number;
  xgB: number;
  predictedScore: string;
  scorelines: { score: string; probability: number }[];
  likelyScorers: { player: string; team: string; probability: number }[];
  confidence: number;
  keyDrivers: string[];
  risks: string[];
  whatChanges: string[];
  events: MatchEvents;
};

export type MatchReport = {
  intel: ResearchIntel;
  prediction: Prediction;
  lineupStatus: "projected" | "confirmed";
};

/* ---------- Real group stage ---------- */

export type GroupMatch = {
  teamA: string;
  teamB: string;
  eloA: number;
  eloB: number;
  winA: number;
  draw: number;
  winB: number;
  predictedScore: string;
  host?: string; // host nation with home advantage in this fixture, if any
  date?: string; // real kickoff date (openfootball schedule)
  time?: string;
  ground?: string; // real venue
};

export type FixtureSource = "openfootball" | "round-robin";

export type GroupStandingRow = {
  team: string;
  elo: number;
  worldRank: number;
  expectedPoints: number;
  advanceProbability: number;
};

export type WorldCupGroup = {
  name: string;
  standings: GroupStandingRow[];
  matches: GroupMatch[];
};

/** Projected knockout bracket — real structure/dates, Elo-projected qualifiers. */
export type KnockoutMatch = {
  num: number;
  round: string;
  slotA: string; // original slot code, e.g. "1A", "3A/B/C/D/F", "W74"
  slotB: string;
  teamA: string | null; // projected concrete team (null if not yet resolvable)
  teamB: string | null;
  eloA: number;
  eloB: number;
  winA: number;
  draw: number;
  winB: number;
  predictedScore: string;
  projectedWinner: string | null;
  host?: string;
  date?: string;
  ground?: string;
};

export type KnockoutRound = { name: string; matches: KnockoutMatch[] };

export type KnockoutView = {
  rounds: KnockoutRound[];
  projectedChampion: string | null;
};

export type GroupsView = {
  groups: WorldCupGroup[];
  champions: { team: string; probability: number }[];
  fixtureSource: FixtureSource; // whether real schedule or synthesized matchups
  knockout: KnockoutView | null;
};
