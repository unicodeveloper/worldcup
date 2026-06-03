/**
 * Official 2026 FIFA World Cup group draw (12 groups of 4).
 *
 * Cross-checked across three sources — FIFA (official final-draw results),
 * ESPN and DAZN — which agree on all 48 teams. The two slots FIFA listed as
 * playoff winners at draw time have since resolved to Iraq (Group I) and
 * DR Congo (Group K), reflected here. `host` flags the tournament hosts, who
 * carry home advantage in their group matches.
 */
export type GroupDraw = { name: string; teams: string[] };

export const WORLD_CUP_GROUPS: GroupDraw[] = [
  { name: "A", teams: ["Mexico", "South Africa", "South Korea", "Czechia"] },
  { name: "B", teams: ["Canada", "Bosnia and Herzegovina", "Qatar", "Switzerland"] },
  { name: "C", teams: ["Brazil", "Morocco", "Haiti", "Scotland"] },
  { name: "D", teams: ["United States", "Paraguay", "Australia", "Türkiye"] },
  { name: "E", teams: ["Germany", "Curaçao", "Ivory Coast", "Ecuador"] },
  { name: "F", teams: ["Netherlands", "Japan", "Sweden", "Tunisia"] },
  { name: "G", teams: ["Belgium", "Egypt", "Iran", "New Zealand"] },
  { name: "H", teams: ["Spain", "Cape Verde", "Saudi Arabia", "Uruguay"] },
  { name: "I", teams: ["France", "Senegal", "Iraq", "Norway"] },
  { name: "J", teams: ["Argentina", "Algeria", "Austria", "Jordan"] },
  { name: "K", teams: ["Portugal", "DR Congo", "Uzbekistan", "Colombia"] },
  { name: "L", teams: ["England", "Croatia", "Ghana", "Panama"] }
];

/** Tournament co-hosts — they get home advantage in their group fixtures. */
export const HOST_NATIONS = new Set(["United States", "Mexico", "Canada"]);
