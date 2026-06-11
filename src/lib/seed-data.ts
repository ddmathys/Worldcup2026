import type { Team } from "@/types";

// Source : tirage au sort officiel FIFA, 5 décembre 2025, Kennedy Center, Washington D.C.
export const WC2026_TEAMS: Team[] = [
  // Groupe A
  { id: "mex", name: "Mexique", code: "mx", groupCode: "A" },
  { id: "rsa", name: "Afrique du Sud", code: "za", groupCode: "A" },
  { id: "kor", name: "Corée du Sud", code: "kr", groupCode: "A" },
  { id: "cze", name: "Tchéquie", code: "cz", groupCode: "A" },
  // Groupe B
  { id: "can", name: "Canada", code: "ca", groupCode: "B" },
  { id: "bih", name: "Bosnie-Herzégovine", code: "ba", groupCode: "B" },
  { id: "qat", name: "Qatar", code: "qa", groupCode: "B" },
  { id: "sui", name: "Suisse", code: "ch", groupCode: "B" },
  // Groupe C
  { id: "bra", name: "Brésil", code: "br", groupCode: "C" },
  { id: "mar", name: "Maroc", code: "ma", groupCode: "C" },
  { id: "hai", name: "Haïti", code: "ht", groupCode: "C" },
  { id: "sco", name: "Écosse", code: "gb", groupCode: "C" },
  // Groupe D
  { id: "usa", name: "États-Unis", code: "us", groupCode: "D" },
  { id: "par", name: "Paraguay", code: "py", groupCode: "D" },
  { id: "aus", name: "Australie", code: "au", groupCode: "D" },
  { id: "tur", name: "Türkiye", code: "tr", groupCode: "D" },
  // Groupe E
  { id: "ger", name: "Allemagne", code: "de", groupCode: "E" },
  { id: "cur", name: "Curaçao", code: "cw", groupCode: "E" },
  { id: "civ", name: "Côte d'Ivoire", code: "ci", groupCode: "E" },
  { id: "ecu", name: "Équateur", code: "ec", groupCode: "E" },
  // Groupe F
  { id: "ned", name: "Pays-Bas", code: "nl", groupCode: "F" },
  { id: "jpn", name: "Japon", code: "jp", groupCode: "F" },
  { id: "swe", name: "Suède", code: "se", groupCode: "F" },
  { id: "tun", name: "Tunisie", code: "tn", groupCode: "F" },
  // Groupe G
  { id: "bel", name: "Belgique", code: "be", groupCode: "G" },
  { id: "egy", name: "Égypte", code: "eg", groupCode: "G" },
  { id: "irn", name: "Iran", code: "ir", groupCode: "G" },
  { id: "nzl", name: "Nouvelle-Zélande", code: "nz", groupCode: "G" },
  // Groupe H
  { id: "esp", name: "Espagne", code: "es", groupCode: "H" },
  { id: "cpv", name: "Cap-Vert", code: "cv", groupCode: "H" },
  { id: "ksa", name: "Arabie Saoudite", code: "sa", groupCode: "H" },
  { id: "uru", name: "Uruguay", code: "uy", groupCode: "H" },
  // Groupe I
  { id: "fra", name: "France", code: "fr", groupCode: "I" },
  { id: "sen", name: "Sénégal", code: "sn", groupCode: "I" },
  { id: "nor", name: "Norvège", code: "no", groupCode: "I" },
  { id: "irq", name: "Irak", code: "iq", groupCode: "I" },
  // Groupe J
  { id: "arg", name: "Argentine", code: "ar", groupCode: "J" },
  { id: "alg", name: "Algérie", code: "dz", groupCode: "J" },
  { id: "aut", name: "Autriche", code: "at", groupCode: "J" },
  { id: "jor", name: "Jordanie", code: "jo", groupCode: "J" },
  // Groupe K
  { id: "por", name: "Portugal", code: "pt", groupCode: "K" },
  { id: "cod", name: "RD Congo", code: "cd", groupCode: "K" },
  { id: "uzb", name: "Ouzbékistan", code: "uz", groupCode: "K" },
  { id: "col", name: "Colombie", code: "co", groupCode: "K" },
  // Groupe L
  { id: "eng", name: "Angleterre", code: "gb", groupCode: "L" },
  { id: "cro", name: "Croatie", code: "hr", groupCode: "L" },
  { id: "gha", name: "Ghana", code: "gh", groupCode: "L" },
  { id: "pan", name: "Panama", code: "pa", groupCode: "L" },
];

export function getFlagUrl(code: string): string {
  if (!code || code === "zz") return "";
  return `https://flagcdn.com/w40/${code.toLowerCase()}.png`;
}

// Phase de poules : 6 matchs par groupe (chaque paire joue une fois)
// 3 journées espacées sur le calendrier officiel
export function generateSampleMatches(): Omit<import("@/types").Match, "id">[] {
  const matches: Omit<import("@/types").Match, "id">[] = [];
  const groups = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

  // Journée 1 : J11-15 juin, Journée 2 : J19-23 juin, Journée 3 : J27 juin-1 juillet
  const round1Start = new Date("2026-06-11T20:00:00Z");
  const round2Start = new Date("2026-06-19T20:00:00Z");
  const round3Start = new Date("2026-06-27T20:00:00Z");

  // Paires pour 4 équipes : 3 journées, 2 matchs/jour
  // J1: (0v1, 2v3) | J2: (0v2, 1v3) | J3: (0v3, 1v2)
  const roundPairs = [
    [[0, 1], [2, 3]],
    [[0, 2], [1, 3]],
    [[0, 3], [1, 2]],
  ];
  const roundStarts = [round1Start, round2Start, round3Start];
  const kickoffOffsets = [0, 3 * 3600 * 1000]; // 2 matchs par journée décalés de 3h

  groups.forEach((group, gi) => {
    const groupTeams = WC2026_TEAMS.filter((t) => t.groupCode === group);
    if (groupTeams.length < 4) return;

    roundPairs.forEach((pairs, round) => {
      pairs.forEach((pair, pi) => {
        const home = groupTeams[pair[0]];
        const away = groupTeams[pair[1]];
        const kickoff = new Date(
          roundStarts[round].getTime() +
          gi * 24 * 3600 * 1000 + // décaler chaque groupe d'un jour
          kickoffOffsets[pi]
        );
        const lockAt = new Date(kickoff.getTime() - 1 * 3600 * 1000);

        matches.push({
          phase: "group",
          groupCode: group,
          homeTeamId: home.id,
          awayTeamId: away.id,
          homeTeam: home,
          awayTeam: away,
          stadiumName: getStadiumForGroup(group),
          city: getCityForGroup(group),
          kickoffUtc: kickoff,
          lockAtUtc: lockAt,
          status: "open",
          homeScore: null,
          awayScore: null,
          qualifiedTeamId: null,
          isFinished: false,
        });
      });
    });
  });

  return matches;
}

function getStadiumForGroup(group: string): string {
  const map: Record<string, string> = {
    A: "Estadio Azteca", B: "BC Place", C: "MetLife Stadium",
    D: "SoFi Stadium", E: "AT&T Stadium", F: "Lumen Field",
    G: "Mercedes-Benz Stadium", H: "NRG Stadium", I: "Hard Rock Stadium",
    J: "Arrowhead Stadium", K: "Gillette Stadium", L: "Lincoln Financial Field",
  };
  return map[group] ?? "TBD";
}

function getCityForGroup(group: string): string {
  const map: Record<string, string> = {
    A: "Mexico", B: "Vancouver", C: "New York",
    D: "Los Angeles", E: "Dallas", F: "Seattle",
    G: "Atlanta", H: "Houston", I: "Miami",
    J: "Kansas City", K: "Boston", L: "Philadelphie",
  };
  return map[group] ?? "TBD";
}
