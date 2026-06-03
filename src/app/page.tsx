"use client";

import { FormEvent, useEffect, useState, useTransition } from "react";
import { Streamdown } from "streamdown";
import remarkGfm from "remark-gfm";
import { featuredTeams } from "@/lib/team-data";
import type { GroupsView, KnockoutMatch, KnockoutView, MatchReport, TeamSnapshot, WorldCupGroup } from "@/lib/types";

const defaultReport: MatchReport = {
  intel: {
    teamA: {
      name: "Argentina",
      elo: 2113,
      worldRank: 2,
      rating: 86,
      likelyFormation: "4-3-3",
      startXI: [],
      substitutes: [],
      keyPlayers: [
        { name: "Lionel Messi", role: "Forward", availability: "likely" },
        { name: "Julian Alvarez", role: "Forward", availability: "likely" }
      ],
      unavailable: [],
      squadStatus: "estimated",
      notes: []
    },
    teamB: {
      name: "France",
      elo: 2081,
      worldRank: 3,
      rating: 82,
      likelyFormation: "4-2-3-1",
      startXI: [],
      substitutes: [],
      keyPlayers: [
        { name: "Kylian Mbappe", role: "Forward", availability: "likely" },
        { name: "Ousmane Dembele", role: "Forward", availability: "likely" }
      ],
      unavailable: [],
      squadStatus: "estimated",
      notes: []
    },
    sources: [{ title: "Live model", snippet: "World Football Elo ratings power this prediction." }],
    provenance: { ratings: "elo", squads: "estimated", lineups: "none", research: "none" },
    headline: "Argentina (Elo 2113, #2) meet France (Elo 2081, #3)."
  },
  prediction: {
    teamA: "Argentina",
    teamB: "France",
    winA: 41,
    draw: 26,
    winB: 33,
    xgA: 1.4,
    xgB: 1.2,
    predictedScore: "1-1",
    scorelines: [
      { score: "1-1", probability: 13 },
      { score: "1-0", probability: 10 },
      { score: "0-1", probability: 9 },
      { score: "2-1", probability: 9 }
    ],
    likelyScorers: [
      { player: "Kylian Mbappe", team: "France", probability: 28 },
      { player: "Lionel Messi", team: "Argentina", probability: 26 }
    ],
    confidence: 64,
    keyDrivers: [
      "Argentina are the rated favourite — Elo 2113 (rank #2) to France's 2081 (rank #3), a 32-point gap.",
      "The gap is narrow, so game state and fine margins decide more than raw quality.",
      "Chance quality leans on Lionel Messi for Argentina and Kylian Mbappe for France."
    ],
    risks: ["Likely-scorer estimates move with the confirmed XI and penalty-taker assignment."],
    whatChanges: ["Confirmed starting XI and late fitness news", "Unexpected rotation in midfield or fullback roles", "Early yellow cards to high-leverage anchors", "Penalty-taker assignment and set-piece routines"],
    events: { bothTeamsScore: 53, over25: 50, under25: 50, cleanSheetA: 30, cleanSheetB: 25, expectedGoals: 2.6 }
  },
  lineupStatus: "projected"
};

type SelectedFixture = { teamA: string; teamB: string; host?: string; date?: string; ground?: string };

const PROVENANCE_LABEL: Record<string, string> = {
  elo: "Live Elo ratings",
  estimated: "Estimated strength",
  "api-football": "Live squads",
  confirmed: "Confirmed XI",
  projected: "Projected XI",
  none: "—",
  valyu: "Valyu research"
};

export default function Home() {
  const [teamA, setTeamA] = useState("Argentina");
  const [teamB, setTeamB] = useState("France");
  const [lineupConfirmed, setLineupConfirmed] = useState(false);
  const [report, setReport] = useState<MatchReport>(defaultReport);
  const [groupsView, setGroupsView] = useState<GroupsView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [selected, setSelected] = useState<SelectedFixture | null>(null);
  const [fixtureReport, setFixtureReport] = useState<MatchReport | null>(null);
  const [fixtureLoading, setFixtureLoading] = useState(false);
  const [showAllOdds, setShowAllOdds] = useState(false);

  function openFixture(fixture: SelectedFixture) {
    setSelected(fixture);
    setFixtureReport(null);
    setFixtureLoading(true);
    fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamA: fixture.teamA, teamB: fixture.teamB, host: fixture.host })
    })
      .then((r) => r.json())
      .then((data) => setFixtureReport(data?.error ? null : data))
      .catch(() => setFixtureReport(null))
      .finally(() => setFixtureLoading(false));
  }

  function closeFixture() {
    setSelected(null);
    setFixtureReport(null);
  }

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeFixture();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  useEffect(() => {
    fetch("/api/groups")
      .then((response) => response.json())
      .then(setGroupsView)
      .catch(() => setGroupsView(null));
  }, []);

  function analyze(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setError(null);

    startTransition(async () => {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamA, teamB, lineupConfirmed })
      });
      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error ?? "Could not analyze this match.");
        return;
      }

      setReport(payload);
    });
  }

  const p = report.prediction;
  const prov = report.intel.provenance;
  const ratingsLive = prov.ratings === "elo";
  const [homeGoals = "", awayGoals = ""] = p.predictedScore.split("-").map((s) => s.trim());

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brandMark">WCS</span>
          <div>
            <strong>World Cup Seer</strong>
            <small>Match intelligence · 2026</small>
          </div>
        </div>
        <span className={`statusPill${ratingsLive ? " live" : ""}`}>
          <span className="dot" />
          {ratingsLive ? "Live Elo model" : "Estimated model"}
        </span>
      </header>

      {/* Hero */}
      <section className="hero">
        <div className="rise">
          <p className="eyebrow">Explainable predictions</p>
          <h1>
            See the match <em>before</em> it&rsquo;s played.
          </h1>
          <p className="lede">
            Pick any fixture for a clear forecast — win probabilities, the likely scoreline, who
            scores, and the reasoning — built on real World Football Elo, live squads and injuries.
          </p>

          <form className="matchForm" onSubmit={analyze}>
            <label>
              Team A
              <input list="teams" value={teamA} onChange={(e) => setTeamA(e.target.value)} aria-label="Team A" />
            </label>
            <span className="versus">v</span>
            <label>
              Team B
              <input list="teams" value={teamB} onChange={(e) => setTeamB(e.target.value)} aria-label="Team B" />
            </label>
            <datalist id="teams">
              {featuredTeams.map((team) => <option key={team} value={team} />)}
            </datalist>

            <button className="btnSubmit" type="submit" disabled={isPending}>
              {isPending ? "Analyzing match…" : "Analyze match"}
            </button>

            <div className="heroActions">
              <button
                type="button"
                className="toggle"
                data-on={lineupConfirmed}
                onClick={() => setLineupConfirmed((v) => !v)}
              >
                {lineupConfirmed ? "Confirmed XI" : "Projected XI"}
              </button>
              <span className="conf">
                Model confidence <b>{p.confidence}%</b>
              </span>
            </div>
            {error ? <p className="error">{error}</p> : null}
          </form>
        </div>

        {/* Scoreboard */}
        <div className="scoreboard rise" aria-label="Match forecast">
          <div className="scoreboardTop">
            <span className="label">Predicted result</span>
            <span className="tag">{PROVENANCE_LABEL[prov.lineups] ?? "Projected XI"}</span>
          </div>

          <div className="scoreLine">
            <div className="sideName a">
              {p.teamA}
              <small>Elo {report.intel.teamA.elo || "—"}</small>
            </div>
            <div className="scoreNum">
              {homeGoals}<span>–</span>{awayGoals}
            </div>
            <div className="sideName b">
              {p.teamB}
              <small>Elo {report.intel.teamB.elo || "—"}</small>
            </div>
          </div>

          <div className="probSeg">
            <div className="probTrack" role="img" aria-label={`${p.teamA} ${p.winA}%, draw ${p.draw}%, ${p.teamB} ${p.winB}%`}>
              <i className="pa" style={{ width: `${p.winA}%` }} />
              <i className="pd" style={{ width: `${p.draw}%` }} />
              <i className="pb" style={{ width: `${p.winB}%` }} />
            </div>
            <div className="probLegend">
              <div>
                <span className="key"><span className="swatch a" /> {p.teamA}</span>
                <b>{p.winA}%</b>
              </div>
              <div className="mid">
                <span className="key"><span className="swatch d" /> Draw</span>
                <b>{p.draw}%</b>
              </div>
              <div className="end">
                <span className="key"><span className="swatch b" /> {p.teamB}</span>
                <b>{p.winB}%</b>
              </div>
            </div>
          </div>

          <div className="scoreboardFoot">
            <div className="cell">
              <span>{p.teamA} xG</span>
              <strong>{p.xgA.toFixed(1)}</strong>
            </div>
            <div className="cell">
              <span>Confidence</span>
              <strong>{p.confidence}%</strong>
            </div>
            <div className="cell">
              <span>{p.teamB} xG</span>
              <strong>{p.xgB.toFixed(1)}</strong>
            </div>
          </div>
        </div>
      </section>

      {/* provenance strip — honest about what's real */}
      <section className="provStrip" aria-label="Data sources">
        <ProvItem label="Ratings" value={PROVENANCE_LABEL[prov.ratings]} live={prov.ratings === "elo"} />
        <ProvItem label="Squads" value={PROVENANCE_LABEL[prov.squads]} live={prov.squads === "api-football"} />
        <ProvItem label="Lineups" value={PROVENANCE_LABEL[prov.lineups]} live={prov.lineups === "confirmed"} />
        <ProvItem label="Research" value={PROVENANCE_LABEL[prov.research]} live={prov.research === "valyu"} />
      </section>

      {/* Report */}
      <div className="sectionHead">
        <h2>The breakdown</h2>
        <span className="note">{ratingsLive ? "Elo-driven model" : "Estimated"}</span>
      </div>

      <section className="grid">
        <article className="card span4">
          <p className="cardLabel">Analyst brief</p>
          <h3>{report.intel.headline}</h3>
          <div className="driverGrid">
            {p.keyDrivers.map((driver, i) => (
              <div className="driver" key={driver}>
                <span>0{i + 1}</span>
                <p>{driver}</p>
              </div>
            ))}
          </div>
          {p.risks.length > 0 ? (
            <div className="riskRow">
              {p.risks.map((risk) => <span key={risk}>{risk}</span>)}
            </div>
          ) : null}
        </article>

        <article className="card span2">
          <p className="cardLabel">Model signals</p>
          <div className="signals">
            {modelSignals(report).map(([level, message]) => (
              <div className="signal" key={level}>
                <strong>{level}</strong>
                <p>{message}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="card span3">
          <p className="cardLabel">Likely scorers</p>
          {p.likelyScorers.map((scorer) => (
            <div className="row" key={`${scorer.team}-${scorer.player}`}>
              <div className="who">
                <b>{scorer.player}</b>
                <small>{scorer.team}</small>
              </div>
              <span className="val pct">{scorer.probability}%</span>
            </div>
          ))}
        </article>

        <article className="card span3">
          <p className="cardLabel">Scoreline distribution</p>
          {p.scorelines.map((s) => (
            <div className="scoreline" key={s.score}>
              <b>{s.score}</b>
              <div className="track"><i style={{ width: `${Math.min(100, s.probability * 5)}%` }} /></div>
              <em>{s.probability}%</em>
            </div>
          ))}
        </article>

        <TeamCard team={report.intel.teamA} side="a" />
        <TeamCard team={report.intel.teamB} side="b" />

        <article className="card span6">
          <p className="cardLabel">Lineup sensitivity</p>
          <h3>What would change this prediction?</h3>
          <div className="pillRow">
            {p.whatChanges.map((item) => <span key={item}>{item}</span>)}
          </div>
        </article>

        <article className="card span6">
          <div className="sectionHead" style={{ border: 0, padding: 0, margin: "0 0 18px" }}>
            <h2>Title odds</h2>
            <span className="note">Real Elo · all 48 teams</span>
          </div>
          {groupsView ? (
            <>
              <div className="champions">
                {(showAllOdds ? groupsView.champions : groupsView.champions.slice(0, 12)).map((team, i) => (
                  <div className={`champion${i === 0 ? " top" : ""}`} key={team.team}>
                    <span className="rankNo">{i + 1}</span>
                    <span className="cName">{team.team}</span>
                    <strong>{team.probability < 0.01 ? "<0.01%" : `${team.probability}%`}</strong>
                  </div>
                ))}
              </div>
              {groupsView.champions.length > 12 ? (
                <button type="button" className="showAll" onClick={() => setShowAllOdds((v) => !v)}>
                  {showAllOdds ? "Show top 12" : `Show all ${groupsView.champions.length} teams`}
                </button>
              ) : null}
            </>
          ) : (
            <p className="muted">Loading title odds…</p>
          )}
        </article>

        <article className="card span6">
          <div className="sectionHead" style={{ border: 0, padding: 0, margin: "0 0 4px" }}>
            <h2>Group stage</h2>
            <span className="note">
              {groupsView?.fixtureSource === "openfootball" ? "Real fixtures · Elo estimates" : "All 12 groups · Elo estimates"}
            </span>
          </div>
          <p className="muted" style={{ margin: "0 0 20px" }}>
            Every real 2026 group, all matches, with an Elo-based estimate per fixture. Top two advance.
          </p>
          {groupsView ? (
            <div className="groupsGrid">
              {groupsView.groups.map((group) => (
                <GroupCard key={group.name} group={group} onSelect={openFixture} />
              ))}
            </div>
          ) : (
            <p className="muted">Loading groups…</p>
          )}
        </article>

        {groupsView?.knockout ? (
          <article className="card span6">
            <div className="sectionHead" style={{ border: 0, padding: 0, margin: "0 0 4px" }}>
              <h2>Knockout bracket</h2>
              <span className="note">Projected · real structure &amp; dates</span>
            </div>
            <p className="muted" style={{ margin: "0 0 18px" }}>
              Real R32→final structure, dates and venues. Qualifiers and winners are projected from the
              Elo group model{groupsView.knockout.projectedChampion ? <> — projected champion <b style={{ color: "var(--green-ink)" }}>{groupsView.knockout.projectedChampion}</b></> : null}. Click any tie for the breakdown.
            </p>
            <Bracket knockout={groupsView.knockout} onSelect={openFixture} />
          </article>
        ) : null}

        <article className="card span6 sources">
          <p className="cardLabel">Research sources</p>
          {report.intel.sources.map((source) => (
            <div className="source" key={`${source.title}-${source.url ?? source.snippet}`}>
              <b>{source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a> : source.title}</b>
              <Snippet text={source.snippet} />
            </div>
          ))}
        </article>
      </section>

      {selected ? (
        <FixtureModal
          fixture={selected}
          report={fixtureReport}
          loading={fixtureLoading}
          onClose={closeFixture}
        />
      ) : null}
    </main>
  );
}

function GroupCard({ group, onSelect }: { group: WorldCupGroup; onSelect: (f: SelectedFixture) => void }) {
  const letter = group.name.replace("Group ", "");
  return (
    <div className="groupCard">
      <div className="groupHead">
        <span className="groupBadge">{letter}</span>
        <h4>{group.name}</h4>
      </div>

      <div className="standings">
        {group.standings.map((row, i) => (
          <div className={`standRow${i < 2 ? " adv" : ""}`} key={row.team}>
            <span className="pos">{i + 1}</span>
            <div className="who">
              <b>{row.team}</b>
              <small>Elo {row.elo} · #{row.worldRank}</small>
            </div>
            <span className="xpts">{row.expectedPoints} pts</span>
            <span className="advp">{row.advanceProbability}%</span>
          </div>
        ))}
      </div>

      <div className="matches">
        {group.matches.map((m, i) => (
          <button
            type="button"
            className="match"
            key={`${m.teamA}-${m.teamB}-${i}`}
            onClick={() => onSelect({ teamA: m.teamA, teamB: m.teamB, host: m.host, date: m.date, ground: m.ground })}
            aria-label={`Breakdown: ${m.teamA} vs ${m.teamB}`}
          >
            <div className="matchTop">
              <span className="mt a">{m.teamA}</span>
              <span className="mscore">{m.predictedScore}</span>
              <span className="mt b">{m.teamB}</span>
            </div>
            <div className="matchBar">
              <i className="pa" style={{ width: `${m.winA}%` }} />
              <i className="pd" style={{ width: `${m.draw}%` }} />
              <i className="pb" style={{ width: `${m.winB}%` }} />
            </div>
            <div className="matchMeta">
              <span>{m.winA}/{m.draw}/{m.winB}</span>
              {m.date ? <span>{m.date}{m.ground ? ` · ${m.ground}` : ""}{m.host ? " · host" : ""}</span> : null}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

const ROUND_SHORT: Record<string, string> = {
  "Round of 32": "R32",
  "Round of 16": "R16",
  "Quarter-final": "Quarter-finals",
  "Semi-final": "Semi-finals",
  "Match for third place": "Third place",
  Final: "Final"
};

function Bracket({ knockout, onSelect }: { knockout: KnockoutView; onSelect: (f: SelectedFixture) => void }) {
  return (
    <div className="bracket">
      {knockout.rounds.map((round) => (
        <div className="bracketCol" key={round.name}>
          <h4 className="bracketRound">{ROUND_SHORT[round.name] ?? round.name}</h4>
          <div className="bracketMatches">
            {round.matches.map((m) => (
              <BracketTie key={m.num} m={m} onSelect={onSelect} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function BracketTie({ m, onSelect }: { m: KnockoutMatch; onSelect: (f: SelectedFixture) => void }) {
  const resolved = m.teamA && m.teamB;
  const side = (team: string | null, slot: string, win: number, isWinner: boolean) => (
    <div className={`btSide${isWinner ? " win" : ""}`}>
      <span className="btTeam">{team ?? <em className="btSlot">{slot}</em>}</span>
      <span className="btPct">{resolved ? `${win}%` : ""}</span>
    </div>
  );
  return (
    <button
      type="button"
      className="bracketTie"
      disabled={!resolved}
      onClick={() => resolved && onSelect({ teamA: m.teamA!, teamB: m.teamB!, host: m.host, date: m.date, ground: m.ground })}
      aria-label={resolved ? `Breakdown: ${m.teamA} vs ${m.teamB}` : "Tie not yet resolved"}
    >
      {side(m.teamA, m.slotA, m.winA, m.projectedWinner === m.teamA)}
      <div className="btMid"><span>{resolved ? m.predictedScore : "vs"}</span></div>
      {side(m.teamB, m.slotB, m.winB, m.projectedWinner === m.teamB)}
    </button>
  );
}

/**
 * Render a Valyu research snippet as markdown. Snippets are raw article content
 * truncated to ~240 chars, so they often end mid-token; Streamdown closes the
 * incomplete markdown gracefully instead of printing literal `**`/`[` syntax.
 *
 * `linkSafety` is disabled: its click-to-confirm popup renders a <div>/<p>
 * inside the link's own <p>, which is invalid HTML nesting and breaks
 * hydration. Links open directly in a new tab instead.
 */
function Snippet({ text }: { text: string }) {
  return (
    <Streamdown
      className="sourceSnippet"
      remarkPlugins={[remarkGfm]}
      parseIncompleteMarkdown
      animated={false}
      linkSafety={{ enabled: false }}
    >
      {text}
    </Streamdown>
  );
}

function FixtureModal({
  fixture,
  report,
  loading,
  onClose
}: {
  fixture: SelectedFixture;
  report: MatchReport | null;
  loading: boolean;
  onClose: () => void;
}) {
  const p = report?.prediction;
  return (
    <div className="modalOverlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={`${fixture.teamA} vs ${fixture.teamB} breakdown`}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modalClose" onClick={onClose} aria-label="Close">×</button>

        <div className="modalHead">
          <p className="eyebrow">Match breakdown</p>
          <div className="modalTeams">
            <span className="mt a">{fixture.teamA}</span>
            <strong>{p ? p.predictedScore : "—"}</strong>
            <span className="mt b">{fixture.teamB}</span>
          </div>
          {fixture.date ? (
            <p className="modalMeta">{fixture.date}{fixture.ground ? ` · ${fixture.ground}` : ""}{fixture.host ? ` · ${fixture.host} at home` : ""}</p>
          ) : null}
        </div>

        {loading || !p ? (
          <p className="muted modalLoading">Reading live research and running the model…</p>
        ) : (
          <div className="modalBody">
            <div className="probSeg">
              <div className="probTrack">
                <i className="pa" style={{ width: `${p.winA}%` }} />
                <i className="pd" style={{ width: `${p.draw}%` }} />
                <i className="pb" style={{ width: `${p.winB}%` }} />
              </div>
              <div className="probLegend">
                <div><span className="key"><span className="swatch a" /> {p.teamA}</span><b>{p.winA}%</b></div>
                <div className="mid"><span className="key"><span className="swatch d" /> Draw</span><b>{p.draw}%</b></div>
                <div className="end"><span className="key"><span className="swatch b" /> {p.teamB}</span><b>{p.winB}%</b></div>
              </div>
            </div>

            <div className="modalStats">
              <div className="mstat"><span>{p.teamA} xG</span><strong>{p.xgA.toFixed(1)}</strong></div>
              <div className="mstat"><span>{p.teamB} xG</span><strong>{p.xgB.toFixed(1)}</strong></div>
              <div className="mstat"><span>Confidence</span><strong>{p.confidence}%</strong></div>
            </div>

            <div className="modalCols">
              <section>
                <p className="cardLabel">Why this prediction</p>
                <ul className="reasonList">
                  {p.keyDrivers.map((d) => <li key={d}>{d}</li>)}
                </ul>
              </section>

              <section>
                <p className="cardLabel">Events that might happen</p>
                <div className="eventGrid">
                  <Event label="Both teams score" value={`${p.events.bothTeamsScore}%`} />
                  <Event label="Over 2.5 goals" value={`${p.events.over25}%`} />
                  <Event label="Under 2.5 goals" value={`${p.events.under25}%`} />
                  <Event label="Expected goals" value={p.events.expectedGoals.toFixed(1)} />
                  <Event label={`${p.teamA} clean sheet`} value={`${p.events.cleanSheetA}%`} />
                  <Event label={`${p.teamB} clean sheet`} value={`${p.events.cleanSheetB}%`} />
                </div>
              </section>
            </div>

            <div className="modalCols">
              <section>
                <p className="cardLabel">Likely scorers</p>
                {p.likelyScorers.length ? p.likelyScorers.map((s) => (
                  <div className="row" key={`${s.team}-${s.player}`}>
                    <div className="who"><b>{s.player}</b><small>{s.team}</small></div>
                    <span className="val pct">{s.probability}%</span>
                  </div>
                )) : <p className="muted">No scorer data for this matchup.</p>}
              </section>

              <section>
                <p className="cardLabel">Scoreline distribution</p>
                {p.scorelines.map((s) => (
                  <div className="scoreline" key={s.score}>
                    <b>{s.score}</b>
                    <div className="track"><i style={{ width: `${Math.min(100, s.probability * 5)}%` }} /></div>
                    <em>{s.probability}%</em>
                  </div>
                ))}
              </section>
            </div>

            {p.risks.length ? (
              <section>
                <p className="cardLabel">Risks &amp; swing factors</p>
                <div className="riskRow">
                  {p.risks.map((r) => <span key={r}>{r}</span>)}
                </div>
              </section>
            ) : null}

            {report.intel.sources.length ? (
              <section>
                <p className="cardLabel">Live research</p>
                <div className="sources">
                  {report.intel.sources.slice(0, 4).map((s) => (
                    <div className="source" key={`${s.title}-${s.url ?? s.snippet}`}>
                      <b>{s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.title}</a> : s.title}</b>
                      <Snippet text={s.snippet} />
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function Event({ label, value }: { label: string; value: string }) {
  return (
    <div className="event">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function ProvItem({ label, value, live }: { label: string; value: string; live: boolean }) {
  return (
    <div className="provItem">
      <span className={`provDot${live ? " on" : ""}`} />
      <div>
        <small>{label}</small>
        <b>{value}</b>
      </div>
    </div>
  );
}

function modelSignals(report: MatchReport): [string, string][] {
  const p = report.prediction;
  const a = report.intel.teamA;
  const b = report.intel.teamB;
  return [
    ["Strength (Elo)", a.elo && b.elo ? `${a.name} ${a.elo} (#${a.worldRank}) vs ${b.name} ${b.elo} (#${b.worldRank}).` : "Live Elo unavailable for one side; using estimated strength."],
    ["Chance quality", `Expected goals model at ${p.xgA.toFixed(1)} to ${p.xgB.toFixed(1)} from the Elo gap.`],
    ["Squad data", report.intel.provenance.squads === "api-football" ? "Live squads and injuries loaded." : "Squads estimated — connect API-Football for live rosters."],
    ["Confidence", `${p.confidence}% from the rating gap and how much live data backs the call.`]
  ];
}

function TeamCard({ team, side }: { team: TeamSnapshot; side: "a" | "b" }) {
  return (
    <article className={`card span3 teamCard ${side}`}>
      <p className="cardLabel">Squad snapshot</p>
      <div className="crest">
        <span className="mark" />
        <h3>{team.name}</h3>
        <span className="rate">{team.elo || "—"}</span>
      </div>
      <div className="statGrid statGrid3">
        <div className="stat"><span>World Elo</span><strong>{team.elo || "—"}</strong></div>
        <div className="stat"><span>Rank</span><strong>{team.worldRank ? `#${team.worldRank}` : "—"}</strong></div>
        <div className="stat"><span>Squad</span><strong className="cap">{team.squadStatus}</strong></div>
      </div>
      <p className="formation">Likely shape · <b>{team.likelyFormation}</b></p>
      {team.keyPlayers.map((player) => (
        <div className="row" key={player.name}>
          <div className="who">
            <b>{player.name}</b>
            <small>{player.role}{typeof player.goals === "number" ? ` · ${player.goals}g` : ""}</small>
          </div>
          <span className="avail" data-s={player.availability}>{player.availability}</span>
        </div>
      ))}
      {team.unavailable.length > 0 ? (
        <div className="unavail">
          <small>Out / doubtful</small>
          <div className="pillRow">
            {team.unavailable.slice(0, 5).map((u) => <span key={u}>{u}</span>)}
          </div>
        </div>
      ) : null}
    </article>
  );
}
