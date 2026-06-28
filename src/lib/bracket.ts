import type { Match } from "@/types";
import { computeStandings, projectQualifiers, type TeamStanding } from "./standings";

// Structure officielle du tableau final de la Coupe du Monde 2026 (48 équipes).
// Source : FIFA / Wikipédia « 2026 FIFA World Cup knockout stage ».
// Les 8 affiches « vainqueur de groupe vs 3e » dépendent des groupes dont sont
// issus les 8 meilleurs 3es : on les attribue par couplage (voir assignThirds).

export type Round = "r32" | "r16" | "qf" | "sf" | "final";

export const ROUND_LABELS: Record<Round, string> = {
  r32: "16es de finale",
  r16: "8es de finale",
  qf: "Quarts de finale",
  sf: "Demi-finales",
  final: "Finale",
};

export const ROUND_ORDER: Round[] = ["r32", "r16", "qf", "sf", "final"];

type Slot =
  | { kind: "winner"; group: string }
  | { kind: "runnerup"; group: string }
  | { kind: "third"; groups: string[] }
  | { kind: "feed"; match: number };

interface MatchDef {
  no: number;
  round: Round;
  a: Slot;
  b: Slot;
}

const MATCHES: MatchDef[] = [
  // ── 16es de finale (matchs 73-88) ──
  { no: 73, round: "r32", a: { kind: "runnerup", group: "A" }, b: { kind: "runnerup", group: "B" } },
  { no: 74, round: "r32", a: { kind: "winner", group: "E" }, b: { kind: "third", groups: ["A", "B", "C", "D", "F"] } },
  { no: 75, round: "r32", a: { kind: "winner", group: "F" }, b: { kind: "runnerup", group: "C" } },
  { no: 76, round: "r32", a: { kind: "winner", group: "C" }, b: { kind: "runnerup", group: "F" } },
  { no: 77, round: "r32", a: { kind: "winner", group: "I" }, b: { kind: "third", groups: ["C", "D", "F", "G", "H"] } },
  { no: 78, round: "r32", a: { kind: "runnerup", group: "E" }, b: { kind: "runnerup", group: "I" } },
  { no: 79, round: "r32", a: { kind: "winner", group: "A" }, b: { kind: "third", groups: ["C", "E", "F", "H", "I"] } },
  { no: 80, round: "r32", a: { kind: "winner", group: "L" }, b: { kind: "third", groups: ["E", "H", "I", "J", "K"] } },
  { no: 81, round: "r32", a: { kind: "winner", group: "D" }, b: { kind: "third", groups: ["B", "E", "F", "I", "J"] } },
  { no: 82, round: "r32", a: { kind: "winner", group: "G" }, b: { kind: "third", groups: ["A", "E", "H", "I", "J"] } },
  { no: 83, round: "r32", a: { kind: "runnerup", group: "K" }, b: { kind: "runnerup", group: "L" } },
  { no: 84, round: "r32", a: { kind: "winner", group: "H" }, b: { kind: "runnerup", group: "J" } },
  { no: 85, round: "r32", a: { kind: "winner", group: "B" }, b: { kind: "third", groups: ["E", "F", "G", "I", "J"] } },
  { no: 86, round: "r32", a: { kind: "winner", group: "J" }, b: { kind: "runnerup", group: "H" } },
  { no: 87, round: "r32", a: { kind: "winner", group: "K" }, b: { kind: "third", groups: ["D", "E", "I", "J", "L"] } },
  { no: 88, round: "r32", a: { kind: "runnerup", group: "D" }, b: { kind: "runnerup", group: "G" } },
  // ── 8es de finale (matchs 89-96) ──
  { no: 89, round: "r16", a: { kind: "feed", match: 74 }, b: { kind: "feed", match: 77 } },
  { no: 90, round: "r16", a: { kind: "feed", match: 73 }, b: { kind: "feed", match: 75 } },
  { no: 91, round: "r16", a: { kind: "feed", match: 76 }, b: { kind: "feed", match: 78 } },
  { no: 92, round: "r16", a: { kind: "feed", match: 79 }, b: { kind: "feed", match: 80 } },
  { no: 93, round: "r16", a: { kind: "feed", match: 83 }, b: { kind: "feed", match: 84 } },
  { no: 94, round: "r16", a: { kind: "feed", match: 81 }, b: { kind: "feed", match: 82 } },
  { no: 95, round: "r16", a: { kind: "feed", match: 86 }, b: { kind: "feed", match: 88 } },
  { no: 96, round: "r16", a: { kind: "feed", match: 85 }, b: { kind: "feed", match: 87 } },
  // ── Quarts (matchs 97-100) ──
  { no: 97, round: "qf", a: { kind: "feed", match: 89 }, b: { kind: "feed", match: 90 } },
  { no: 98, round: "qf", a: { kind: "feed", match: 93 }, b: { kind: "feed", match: 94 } },
  { no: 99, round: "qf", a: { kind: "feed", match: 91 }, b: { kind: "feed", match: 92 } },
  { no: 100, round: "qf", a: { kind: "feed", match: 95 }, b: { kind: "feed", match: 96 } },
  // ── Demies (matchs 101-102) ──
  { no: 101, round: "sf", a: { kind: "feed", match: 97 }, b: { kind: "feed", match: 98 } },
  { no: 102, round: "sf", a: { kind: "feed", match: 99 }, b: { kind: "feed", match: 100 } },
  // ── Finale (match 104) ──
  { no: 104, round: "final", a: { kind: "feed", match: 101 }, b: { kind: "feed", match: 102 } },
];

// Ordre vertical par colonne pour que chaque match soit centré entre ses deux
// matchs « parents » (alignement de l'arbre via justify-around).
const COLUMN_ORDER: Record<Round, number[]> = {
  r32: [74, 77, 73, 75, 83, 84, 81, 82, 76, 78, 79, 80, 86, 88, 85, 87],
  r16: [89, 90, 93, 94, 91, 92, 95, 96],
  qf: [97, 98, 99, 100],
  sf: [101, 102],
  final: [104],
};

export interface ResolvedTeam {
  id: string;
  name: string;
  code: string;
}

export interface ResolvedSlot {
  /** Étiquette de position : « 1er I », « 2e B », « 3e A/B/C/D/F », « Vainqueur 73 ». */
  label: string;
  team: ResolvedTeam | null;
  /** Équipe garantie d'un top-2 de groupe (projection). */
  confirmed: boolean;
  /** Score réel si le match a été joué. */
  score: number | null;
  /** Cette équipe a gagné ce match. */
  winner: boolean;
}

export interface ResolvedMatch {
  no: number;
  round: Round;
  a: ResolvedSlot;
  b: ResolvedSlot;
  kickoff: Date | null;
  finished: boolean;
  live: boolean;
  /** Un vrai match Firestore alimente cette position (les 2 équipes sont connues). */
  real: boolean;
}

export interface ResolvedBracket {
  columns: Record<Round, ResolvedMatch[]>;
  confirmedCount: number;
  projectedTeams: number;
}

/**
 * Couplage des 8 meilleurs 3es vers les 8 affiches « 1er vs 3e », en respectant
 * la contrainte de groupes de chaque affiche (algorithme de Kuhn — bipartite).
 */
function assignThirds(thirds: TeamStanding[]): Map<number, TeamStanding> {
  const slots = MATCHES.filter((m) => m.round === "r32" && (m.a.kind === "third" || m.b.kind === "third")).map((m) => {
    const slot = (m.a.kind === "third" ? m.a : m.b) as { kind: "third"; groups: string[] };
    return { no: m.no, groups: slot.groups };
  });

  const slotToThird = new Array(slots.length).fill(-1);
  const thirdToSlot = new Array(thirds.length).fill(-1);

  function augment(si: number, visited: boolean[]): boolean {
    for (let ti = 0; ti < thirds.length; ti++) {
      if (visited[ti]) continue;
      if (!slots[si].groups.includes(thirds[ti].groupCode)) continue;
      visited[ti] = true;
      if (thirdToSlot[ti] === -1 || augment(thirdToSlot[ti], visited)) {
        thirdToSlot[ti] = si;
        slotToThird[si] = ti;
        return true;
      }
    }
    return false;
  }

  for (let si = 0; si < slots.length; si++) {
    augment(si, new Array(thirds.length).fill(false));
  }

  const result = new Map<number, TeamStanding>();
  slots.forEach((slot, si) => {
    if (slotToThird[si] !== -1) result.set(slot.no, thirds[slotToThird[si]]);
  });
  return result;
}

function matchWinnerId(real: Match): string | null {
  if (real.qualifiedTeamId) return real.qualifiedTeamId;
  if (real.homeScore == null || real.awayScore == null) return null;
  if (real.homeScore > real.awayScore) return real.homeTeamId;
  if (real.awayScore > real.homeScore) return real.awayTeamId;
  return null;
}

export function resolveBracket(matches: Match[]): ResolvedBracket {
  const standings = computeStandings(matches);
  const { bestThirds, confirmedIds } = projectQualifiers(standings);

  const winnerOf = (g: string) => standings.get(g)?.[0]?.team ?? null;
  const runnerOf = (g: string) => standings.get(g)?.[1]?.team ?? null;
  const thirdByMatch = assignThirds(bestThirds); // projection (fallback uniquement)

  // Vrais matchs à élimination directe : la donnée réelle fait autorité sur la
  // projection. On les indexe par (tour, équipe) — une équipe ne joue qu'un match
  // par tour — et on note les équipes déjà placées pour ne pas les reprojeter.
  const realByRoundTeam = new Map<string, Match>();
  const placedByRound = new Map<Round, Set<string>>(ROUND_ORDER.map((r) => [r, new Set<string>()]));
  for (const m of matches) {
    if (m.phase === "group") continue;
    const round = m.phase as Round;
    realByRoundTeam.set(`${round}|${m.homeTeamId}`, m);
    realByRoundTeam.set(`${round}|${m.awayTeamId}`, m);
    placedByRound.get(round)?.add(m.homeTeamId).add(m.awayTeamId);
  }

  // Vainqueur résolu de chaque match, propagé vers les positions « feed » suivantes.
  const winners = new Map<number, ResolvedTeam>();

  // Équipe « déterminée » d'un slot (sans projeter les 3es : ils viennent du réel).
  const detSlot = (
    slot: Slot
  ): { team: ResolvedTeam | null; label: string; confirmed: boolean } => {
    switch (slot.kind) {
      case "winner": {
        const t = winnerOf(slot.group);
        return { team: t, label: `1er ${slot.group}`, confirmed: !!t && confirmedIds.has(t.id) };
      }
      case "runnerup": {
        const t = runnerOf(slot.group);
        return { team: t, label: `2e ${slot.group}`, confirmed: !!t && confirmedIds.has(t.id) };
      }
      case "third":
        return { team: null, label: `3e ${slot.groups.join("/")}`, confirmed: false };
      case "feed":
        return { team: winners.get(slot.match) ?? null, label: `Vainqueur ${slot.match}`, confirmed: false };
    }
  };

  const byNo = new Map(MATCHES.map((m) => [m.no, m]));
  const columns = {} as Record<Round, ResolvedMatch[]>;
  let projectedTeams = 0;

  // ROUND_ORDER est croissant (r32 → finale), donc les vainqueurs d'un tour sont
  // connus avant de résoudre le suivant.
  for (const round of ROUND_ORDER) {
    columns[round] = COLUMN_ORDER[round].map((no) => {
      const def = byNo.get(no)!;
      const A = detSlot(def.a);
      const B = detSlot(def.b);

      // Le vrai match se trouve via l'équipe déterminée (1er/2e/vainqueur),
      // jamais via le 3e projeté qui peut être faux.
      const real =
        (A.team && realByRoundTeam.get(`${round}|${A.team.id}`)) ||
        (B.team && realByRoundTeam.get(`${round}|${B.team.id}`)) ||
        null;

      let aTeam = A.team;
      let bTeam = B.team;
      let aScore: number | null = null;
      let bScore: number | null = null;
      let kickoff: Date | null = null;
      let finished = false;
      let live = false;
      let winnerId: string | null = null;

      if (real) {
        kickoff = real.kickoffUtc;
        finished = real.isFinished;
        live = real.status === "live";
        // L'équipe déterminée garde sa place, le vrai adversaire remplit l'autre.
        if (A.team) {
          aTeam = A.team;
          bTeam = real.homeTeamId === A.team.id ? real.awayTeam : real.homeTeam;
        } else if (B.team) {
          bTeam = B.team;
          aTeam = real.homeTeamId === B.team.id ? real.awayTeam : real.homeTeam;
        } else {
          aTeam = real.homeTeam;
          bTeam = real.awayTeam;
        }
        const aIsHome = real.homeTeamId === aTeam?.id;
        aScore = aIsHome ? real.homeScore : real.awayScore;
        bScore = aIsHome ? real.awayScore : real.homeScore;
        if (finished) {
          winnerId = matchWinnerId(real);
          const wt = winnerId === aTeam?.id ? aTeam : winnerId === bTeam?.id ? bTeam : null;
          if (wt) winners.set(no, wt);
        }
      } else {
        // Pas de vrai match : on projette les 3es, sauf si l'équipe est déjà
        // placée ailleurs en réel (on évite de l'afficher deux fois).
        const placed = placedByRound.get(round)!;
        if (!aTeam && def.a.kind === "third") {
          const p = thirdByMatch.get(no)?.team ?? null;
          aTeam = p && !placed.has(p.id) ? p : null;
        }
        if (!bTeam && def.b.kind === "third") {
          const p = thirdByMatch.get(no)?.team ?? null;
          bTeam = p && !placed.has(p.id) ? p : null;
        }
      }

      if (round === "r32") {
        if (aTeam) projectedTeams++;
        if (bTeam) projectedTeams++;
      }

      return {
        no,
        round,
        a: { label: A.label, team: aTeam, confirmed: A.confirmed && !!aTeam, score: aScore, winner: finished && winnerId === aTeam?.id },
        b: { label: B.label, team: bTeam, confirmed: B.confirmed && !!bTeam, score: bScore, winner: finished && winnerId === bTeam?.id },
        kickoff,
        finished,
        live,
        real: !!real,
      };
    });
  }

  return { columns, confirmedCount: confirmedIds.size, projectedTeams };
}
