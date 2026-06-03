import { COUNTRIES } from "./countries";
import type { PlayerSnapshot } from "./types";

/** All 48 finalists, so any real 2026 matchup can be analyzed. */
export const featuredTeams = COUNTRIES.map((c) => c.name).sort();

/**
 * Fallback key players (real names) used only when API-Football is not connected.
 * These supply names for the UI; no fabricated ratings are derived from them.
 */
const seedKeyPlayers: Record<string, PlayerSnapshot[]> = {
  Argentina: [
    { name: "Lionel Messi", role: "Forward", availability: "likely" },
    { name: "Julian Alvarez", role: "Forward", availability: "likely" },
    { name: "Lautaro Martinez", role: "Forward", availability: "likely" }
  ],
  Brazil: [
    { name: "Vinicius Junior", role: "Forward", availability: "likely" },
    { name: "Rodrygo", role: "Forward", availability: "likely" },
    { name: "Raphinha", role: "Forward", availability: "likely" }
  ],
  France: [
    { name: "Kylian Mbappe", role: "Forward", availability: "likely" },
    { name: "Ousmane Dembele", role: "Forward", availability: "likely" },
    { name: "Antoine Griezmann", role: "Midfielder", availability: "likely" }
  ],
  England: [
    { name: "Harry Kane", role: "Forward", availability: "likely" },
    { name: "Bukayo Saka", role: "Forward", availability: "likely" },
    { name: "Jude Bellingham", role: "Midfielder", availability: "likely" }
  ],
  Spain: [
    { name: "Lamine Yamal", role: "Forward", availability: "likely" },
    { name: "Nico Williams", role: "Forward", availability: "likely" },
    { name: "Pedri", role: "Midfielder", availability: "likely" }
  ],
  Germany: [
    { name: "Jamal Musiala", role: "Forward", availability: "likely" },
    { name: "Florian Wirtz", role: "Midfielder", availability: "likely" },
    { name: "Kai Havertz", role: "Forward", availability: "likely" }
  ],
  Portugal: [
    { name: "Cristiano Ronaldo", role: "Forward", availability: "likely" },
    { name: "Rafael Leao", role: "Forward", availability: "likely" },
    { name: "Bruno Fernandes", role: "Midfielder", availability: "likely" }
  ],
  Netherlands: [
    { name: "Cody Gakpo", role: "Forward", availability: "likely" },
    { name: "Memphis Depay", role: "Forward", availability: "likely" },
    { name: "Xavi Simons", role: "Midfielder", availability: "likely" }
  ],
  "United States": [
    { name: "Christian Pulisic", role: "Forward", availability: "likely" },
    { name: "Folarin Balogun", role: "Forward", availability: "likely" },
    { name: "Gio Reyna", role: "Midfielder", availability: "likely" }
  ],
  Mexico: [
    { name: "Santiago Gimenez", role: "Forward", availability: "likely" },
    { name: "Hirving Lozano", role: "Forward", availability: "likely" },
    { name: "Edson Alvarez", role: "Midfielder", availability: "likely" }
  ],
  Uruguay: [
    { name: "Darwin Nunez", role: "Forward", availability: "likely" },
    { name: "Federico Valverde", role: "Midfielder", availability: "likely" },
    { name: "Nicolas de la Cruz", role: "Midfielder", availability: "likely" }
  ],
  Japan: [
    { name: "Kaoru Mitoma", role: "Forward", availability: "likely" },
    { name: "Takefusa Kubo", role: "Forward", availability: "likely" },
    { name: "Daichi Kamada", role: "Midfielder", availability: "likely" }
  ]
};

export function getSeedKeyPlayers(name: string): PlayerSnapshot[] {
  return (
    seedKeyPlayers[name] ?? [
      { name: `${name} forward`, role: "Forward", availability: "likely" },
      { name: `${name} playmaker`, role: "Midfielder", availability: "likely" }
    ]
  );
}
