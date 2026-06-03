/**
 * Canonical country registry joining the real data sources:
 *  - `name`    : display name used across the app and in Valyu queries
 *  - `elo`     : code used by eloratings.net (World.tsv) — verified live
 *  - `apiName` : team name as it appears in API-Football (for when a paid plan
 *                unlocks the 2026 season and live squads/lineups)
 *
 * All 48 finalists of the 2026 FIFA World Cup are listed. eloratings codes are
 * ISO 3166-1 alpha-2 with a few custom ones (EN=England, SQ=Scotland), each
 * verified against the live World.tsv.
 */
export type Country = {
  name: string;
  elo: string;
  apiName: string;
};

export const COUNTRIES: Country[] = [
  { name: "Argentina", elo: "AR", apiName: "Argentina" },
  { name: "Spain", elo: "ES", apiName: "Spain" },
  { name: "France", elo: "FR", apiName: "France" },
  { name: "England", elo: "EN", apiName: "England" },
  { name: "Brazil", elo: "BR", apiName: "Brazil" },
  { name: "Portugal", elo: "PT", apiName: "Portugal" },
  { name: "Colombia", elo: "CO", apiName: "Colombia" },
  { name: "Netherlands", elo: "NL", apiName: "Netherlands" },
  { name: "Ecuador", elo: "EC", apiName: "Ecuador" },
  { name: "Germany", elo: "DE", apiName: "Germany" },
  { name: "Norway", elo: "NO", apiName: "Norway" },
  { name: "Croatia", elo: "HR", apiName: "Croatia" },
  { name: "Türkiye", elo: "TR", apiName: "Turkey" },
  { name: "Japan", elo: "JP", apiName: "Japan" },
  { name: "Switzerland", elo: "CH", apiName: "Switzerland" },
  { name: "Uruguay", elo: "UY", apiName: "Uruguay" },
  { name: "Belgium", elo: "BE", apiName: "Belgium" },
  { name: "Senegal", elo: "SN", apiName: "Senegal" },
  { name: "Mexico", elo: "MX", apiName: "Mexico" },
  { name: "Paraguay", elo: "PY", apiName: "Paraguay" },
  { name: "Austria", elo: "AT", apiName: "Austria" },
  { name: "Morocco", elo: "MA", apiName: "Morocco" },
  { name: "Canada", elo: "CA", apiName: "Canada" },
  { name: "Australia", elo: "AU", apiName: "Australia" },
  { name: "Scotland", elo: "SQ", apiName: "Scotland" },
  { name: "Iran", elo: "IR", apiName: "Iran" },
  { name: "South Korea", elo: "KR", apiName: "South Korea" },
  { name: "Algeria", elo: "DZ", apiName: "Algeria" },
  { name: "United States", elo: "US", apiName: "USA" },
  { name: "Panama", elo: "PA", apiName: "Panama" },
  { name: "Czechia", elo: "CZ", apiName: "Czech Republic" },
  { name: "Uzbekistan", elo: "UZ", apiName: "Uzbekistan" },
  { name: "Sweden", elo: "SE", apiName: "Sweden" },
  { name: "Egypt", elo: "EG", apiName: "Egypt" },
  { name: "Jordan", elo: "JO", apiName: "Jordan" },
  { name: "Ivory Coast", elo: "CI", apiName: "Ivory Coast" },
  { name: "DR Congo", elo: "CD", apiName: "DR Congo" },
  { name: "Tunisia", elo: "TN", apiName: "Tunisia" },
  { name: "Iraq", elo: "IQ", apiName: "Iraq" },
  { name: "Bosnia and Herzegovina", elo: "BA", apiName: "Bosnia" },
  { name: "Cape Verde", elo: "CV", apiName: "Cape Verde" },
  { name: "Saudi Arabia", elo: "SA", apiName: "Saudi Arabia" },
  { name: "New Zealand", elo: "NZ", apiName: "New Zealand" },
  { name: "Haiti", elo: "HT", apiName: "Haiti" },
  { name: "South Africa", elo: "ZA", apiName: "South Africa" },
  { name: "Ghana", elo: "GH", apiName: "Ghana" },
  { name: "Curaçao", elo: "CW", apiName: "Curacao" },
  { name: "Qatar", elo: "QA", apiName: "Qatar" }
];

const byLowerName = new Map(COUNTRIES.map((c) => [c.name.toLowerCase(), c]));

// Alternate spellings from external sources (openfootball, ESPN, etc.) → canonical name.
const ALIASES: Record<string, string> = {
  usa: "United States",
  "united states of america": "United States",
  "czech republic": "Czechia",
  turkey: "Türkiye",
  "bosnia & herzegovina": "Bosnia and Herzegovina",
  "bosnia-herzegovina": "Bosnia and Herzegovina",
  "korea republic": "South Korea",
  "côte d'ivoire": "Ivory Coast",
  "cote d'ivoire": "Ivory Coast",
  "cabo verde": "Cape Verde",
  "congo dr": "DR Congo",
  "dr congo": "DR Congo"
};

/** Resolve a free-text team name to a known country (case-insensitive), or null. */
export function resolveCountry(name: string): Country | null {
  const key = name.trim().toLowerCase();
  const canonical = ALIASES[key];
  return byLowerName.get(canonical?.toLowerCase() ?? key) ?? null;
}
