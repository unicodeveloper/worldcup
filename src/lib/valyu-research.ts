import type { Source } from "./types";

type ValyuResult = {
  title?: string;
  url?: string;
  content?: string;
  snippet?: string;
};

function extractSources(response: unknown): Source[] {
  const payload = response as { results?: ValyuResult[]; searchResults?: ValyuResult[]; sources?: ValyuResult[] };
  const results = payload.results ?? payload.searchResults ?? payload.sources ?? [];

  return results
    .slice(0, 6)
    .map((result) => ({
      title: result.title ?? "Valyu source",
      url: result.url,
      snippet: (result.content ?? result.snippet ?? "Live source returned by Valyu.").slice(0, 240)
    }))
    .filter((source) => source.title);
}

/**
 * Live, real match-context research from Valyu — current squad news, expected
 * lineups, injuries and tactical previews. Returns the actual cited sources
 * (title, url, snippet) shown to the user. Null when no key is configured.
 */
export async function getValyuSources(teamAName: string, teamBName: string): Promise<Source[] | null> {
  if (!process.env.VALYU_API_KEY) return null;

  try {
    const { Valyu } = await import("valyu-js");
    const valyu = new Valyu();
    const query = [
      `FIFA World Cup 2026 ${teamAName} vs ${teamBName} preview`,
      `current squad injuries suspensions expected lineup likely starters`,
      `recent form tactical analysis key players likely goalscorers`
    ]
      .join(" ")
      .slice(0, 390);

    const response = await valyu.search(query, { searchType: "all", maxNumResults: 8 });
    return extractSources(response);
  } catch (error) {
    console.error("Valyu research failed", error);
    return null;
  }
}
