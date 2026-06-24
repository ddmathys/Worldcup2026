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

export interface ResolvedSlot {
  /** Étiquette de position : « 1er I », « 2e B », « 3e A/B/C/D/F », « Vainqueur 73 ». */
  label: string;
  team: TeamStanding | null;
  confirmed: boolean;
}

export interface ResolvedMatch {
  no: number;
  round: Round;
  a: ResolvedSlot;
  b: ResolvedSlot;
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

export function resolveBracket(matches: Match[]): ResolvedBracket {
  const standings = computeStandings(matches);
  const { bestThirds, confirmedIds } = projectQualifiers(standings);

  const winnerOf = (g: string) => standings.get(g)?.[0] ?? null;
  const runnerOf = (g: string) => standings.get(g)?.[1] ?? null;
  const thirdByMatch = assignThirds(bestThirds);

  const resolveSlot = (no: number, slot: Slot): ResolvedSlot => {
    switch (slot.kind) {
      case "winner": {
        const team = winnerOf(slot.group);
        return { label: `1er ${slot.group}`, team, confirmed: !!team && confirmedIds.has(team.team.id) };
      }
      case "runnerup": {
        const team = runnerOf(slot.group);
        return { label: `2e ${slot.group}`, team, confirmed: !!team && confirmedIds.has(team.team.id) };
      }
      case "third": {
        const team = thirdByMatch.get(no) ?? null;
        return { label: `3e ${slot.groups.join("/")}`, team, confirmed: false };
      }
      case "feed":
        return { label: `Vainqueur ${slot.match}`, team: null, confirmed: false };
    }
  };

  const byNo = new Map(MATCHES.map((m) => [m.no, m]));
  const columns = {} as Record<Round, ResolvedMatch[]>;
  let projectedTeams = 0;

  for (const round of ROUND_ORDER) {
    columns[round] = COLUMN_ORDER[round].map((no) => {
      const def = byNo.get(no)!;
      const a = resolveSlot(no, def.a);
      const b = resolveSlot(no, def.b);
      if (a.team) projectedTeams++;
      if (b.team) projectedTeams++;
      return { no, round, a, b };
    });
  }

  return { columns, confirmedCount: confirmedIds.size, projectedTeams };
}
