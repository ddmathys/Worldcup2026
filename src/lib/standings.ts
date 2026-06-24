import type { Match, Team } from "@/types";

export interface TeamStanding {
  team: Team;
  groupCode: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  form: ("W" | "D" | "L")[];
}

const GROUP_MATCHES_PER_TEAM = 3;

function sortStandings(a: TeamStanding, b: TeamStanding): number {
  if (b.points !== a.points) return b.points - a.points;
  const gdB = b.goalsFor - b.goalsAgainst;
  const gdA = a.goalsFor - a.goalsAgainst;
  if (gdB !== gdA) return gdB - gdA;
  if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
  return a.team.name.localeCompare(b.team.name);
}

/** Compute group standings from the group-phase matches. */
export function computeStandings(matches: Match[]): Map<string, TeamStanding[]> {
  const groups = new Map<string, Map<string, TeamStanding>>();

  const groupMatches = matches
    .filter((m) => m.phase === "group")
    .sort((a, b) => a.kickoffUtc.getTime() - b.kickoffUtc.getTime());

  groupMatches.forEach((m) => {
    const g = m.groupCode!;
    if (!groups.has(g)) groups.set(g, new Map());
    const gs = groups.get(g)!;

    if (!gs.has(m.homeTeamId))
      gs.set(m.homeTeamId, { team: m.homeTeam, groupCode: g, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0, form: [] });
    if (!gs.has(m.awayTeamId))
      gs.set(m.awayTeamId, { team: m.awayTeam, groupCode: g, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0, form: [] });

    if (!m.isFinished || m.homeScore === null || m.awayScore === null) return;

    const home = gs.get(m.homeTeamId)!;
    const away = gs.get(m.awayTeamId)!;

    home.played++; away.played++;
    home.goalsFor += m.homeScore; home.goalsAgainst += m.awayScore;
    away.goalsFor += m.awayScore; away.goalsAgainst += m.homeScore;

    if (m.homeScore > m.awayScore) {
      home.won++; home.points += 3; away.lost++;
      home.form.push("W"); away.form.push("L");
    } else if (m.homeScore < m.awayScore) {
      away.won++; away.points += 3; home.lost++;
      home.form.push("L"); away.form.push("W");
    } else {
      home.drawn++; home.points++; away.drawn++; away.points++;
      home.form.push("D"); away.form.push("D");
    }
  });

  const result = new Map<string, TeamStanding[]>();
  groups.forEach((gs, group) => {
    result.set(group, Array.from(gs.values()).sort(sortStandings));
  });
  return result;
}

/**
 * Teams (in a single group's standings) that are mathematically guaranteed a
 * top-2 finish, regardless of the remaining matchday-3 results.
 *
 * Conservative & sound: a team T is confirmed when at most one OTHER team can
 * still reach or exceed T's current points in T's worst case (T wins nothing
 * more). Ties count as "could be above", so we never over-claim a spot.
 */
export function confirmedTop2Ids(group: TeamStanding[]): Set<string> {
  const confirmed = new Set<string>();
  for (const t of group) {
    const tFloor = t.points; // worst case: T gains nothing from remaining games
    let canReachOrPass = 0;
    for (const o of group) {
      if (o.team.id === t.team.id) continue;
      const oCeiling = o.points + 3 * Math.max(0, GROUP_MATCHES_PER_TEAM - o.played);
      if (oCeiling >= tFloor) canReachOrPass++;
    }
    if (canReachOrPass <= 1) confirmed.add(t.team.id);
  }
  return confirmed;
}

export interface QualifierProjection {
  firsts: TeamStanding[];
  seconds: TeamStanding[];
  bestThirds: TeamStanding[];
  /** Team ids mathematically guaranteed a top-2 finish. */
  confirmedIds: Set<string>;
}

/**
 * Project the 32 qualifiers from current standings: the winner and runner-up of
 * each group plus the 8 best third-placed teams (WC2026 format).
 */
export function projectQualifiers(standings: Map<string, TeamStanding[]>): QualifierProjection {
  const firsts: TeamStanding[] = [];
  const seconds: TeamStanding[] = [];
  const thirds: TeamStanding[] = [];
  const confirmedIds = new Set<string>();

  const groupCodes = Array.from(standings.keys()).sort();
  for (const g of groupCodes) {
    const rows = standings.get(g)!;
    if (rows[0]) firsts.push(rows[0]);
    if (rows[1]) seconds.push(rows[1]);
    if (rows[2]) thirds.push(rows[2]);
    confirmedTop2Ids(rows).forEach((id) => confirmedIds.add(id));
  }

  const bestThirds = [...thirds].sort(sortStandings).slice(0, 8);

  return { firsts, seconds, bestThirds, confirmedIds };
}
