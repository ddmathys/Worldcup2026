import { getFirestore, Timestamp } from "firebase-admin/firestore";
import type { DocumentData } from "firebase-admin/firestore";
import { getAdminAuth } from "./firebase-admin";
import { getApps } from "firebase-admin/app";
import { WC2026_TEAMS } from "./seed-data";
import { resolveBracket, ROUND_ORDER, type ResolvedMatch } from "./bracket";
import type { Match, Team } from "@/types";

function getAdminDb() {
  getAdminAuth();
  return getFirestore(getApps()[0]);
}

// ─── Team name → internal ID ───────────────────────────────────────────────
const TEAM_NAME_MAP: Record<string, string> = {
  Mexico: "mex", "South Africa": "rsa",
  "Korea Republic": "kor", "South Korea": "kor",
  "Czech Republic": "cze", Czechia: "cze",
  Canada: "can",
  "Bosnia-Herzegovina": "bih", "Bosnia and Herzegovina": "bih", "Bosnia & Herzegovina": "bih",
  Qatar: "qat", Switzerland: "sui",
  Brazil: "bra", Morocco: "mar", Haiti: "hai", Scotland: "sco",
  "United States": "usa", USA: "usa",
  Paraguay: "par", Australia: "aus",
  Turkey: "tur", Türkiye: "tur", Turkiye: "tur",
  Germany: "ger",
  Curacao: "cur", "Curaçao": "cur",
  "Ivory Coast": "civ", "Côte d'Ivoire": "civ", "Cote d'Ivoire": "civ",
  Ecuador: "ecu",
  Netherlands: "ned", Japan: "jpn", Sweden: "swe", Tunisia: "tun",
  Belgium: "bel", Egypt: "egy", Iran: "irn", "IR Iran": "irn", "New Zealand": "nzl",
  Spain: "esp", "Cape Verde": "cpv", "Cabo Verde": "cpv", "Saudi Arabia": "ksa", Uruguay: "uru",
  France: "fra", Senegal: "sen", Norway: "nor", Iraq: "irq",
  Argentina: "arg", Algeria: "alg", Austria: "aut", Jordan: "jor",
  Portugal: "por",
  "DR Congo": "cod", "Congo DR": "cod", "Democratic Republic of Congo": "cod",
  Uzbekistan: "uzb", Colombia: "col",
  England: "eng", Croatia: "cro", Ghana: "gha", Panama: "pan",
};

function teamByName(name: string): Team {
  const id = TEAM_NAME_MAP[name];
  const found = id ? WC2026_TEAMS.find((t) => t.id === id) : null;
  return (
    found ?? {
      id: `ext_${name.toLowerCase().replace(/\s+/g, "_")}`,
      name,
      code: "zz",
    }
  );
}

function mapPhase(round: string): Match["phase"] {
  const r = round.toLowerCase();
  if (r.includes("group")) return "group";
  if (r.includes("32")) return "r32";
  if (r.includes("16")) return "r16";
  if (r.includes("quarter")) return "qf";
  if (r.includes("semi")) return "sf";
  if (r.includes("final")) return "final";
  return "group";
}

const FINISHED_STATUSES = ["finished", "ft", "aet", "pen", "completed", "ended", "full_time", "fulltime", "after_extra_time", "penalties"];
const LIVE_STATUSES = ["live", "1h", "2h", "ht", "et", "bt", "p", "in_play", "inplay", "playing", "started", "half_time", "halftime"];

function mapStatus(s: string): Match["status"] {
  s = s.toLowerCase();
  if (FINISHED_STATUSES.includes(s)) return "finished";
  if (LIVE_STATUSES.includes(s)) return "live";
  if (s === "locked") return "locked";
  return "open";
}

// ─── wc2026api.com ─────────────────────────────────────────────────────────
interface WC2026Match {
  id: number;
  /** Numéro de match FIFA officiel (73→104 en phase finale), sert à résoudre les
   *  équipes manquantes via le tableau quand le provider ne les a pas encore. */
  match_number?: number;
  round: string;
  group_name?: string;
  home_team: string | null;
  away_team: string | null;
  stadium?: string;
  city?: string;
  kickoff_utc: string;
  status: string;
  home_score?: number | null;
  away_score?: number | null;
}

async function fetchWC2026(path: string): Promise<unknown> {
  const key = process.env.WC2026_API_KEY;
  if (!key) throw new Error("WC2026_API_KEY non configurée");
  const res = await fetch(`https://api.wc2026api.com${path}`, {
    headers: { Authorization: `Bearer ${key}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`wc2026api ${res.status}: ${res.statusText}`);
  return res.json();
}

// ─── API-Football (fallback) ────────────────────────────────────────────────
interface ApiFootballResponse {
  response: Array<{
    fixture: { id: number; date: string; status: { short: string } };
    league: { round: string };
    teams: { home: { name: string }; away: { name: string } };
    goals: { home: number | null; away: number | null };
    venue?: { name: string; city: string };
  }>;
}

async function fetchApiFootball(path: string): Promise<ApiFootballResponse> {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) throw new Error("API_FOOTBALL_KEY non configurée");
  const res = await fetch(`https://v3.football.api-sports.io${path}`, {
    headers: {
      "x-apisports-key": key,
      "x-rapidapi-host": "v3.football.api-sports.io",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`api-football ${res.status}: ${res.statusText}`);
  return res.json();
}

// ─── Firestore helpers ──────────────────────────────────────────────────────
// Les matchs seedés n'ont pas d'apiMatchId : on indexe aussi par paire
// d'équipes (ordre ignoré) + phase pour les rattacher au lieu de les dupliquer.
function teamPairKey(phase: string, teamA: string, teamB: string): string {
  return `${phase}|${[teamA, teamB].sort().join("_")}`;
}

function normalizeGroupCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = raw.match(/([A-L])\s*$/i);
  return m ? m[1].toUpperCase() : null;
}

interface MatchIndex {
  byApiId: Map<string, { docId: string; isExt: boolean }>;
  byTeams: Map<string, string>;
  // Docs déjà terminés en base : leur résultat est figé, la sync calendrier ne
  // doit jamais les réécrire (garantie « aucune régression »).
  finishedDocIds: Set<string>;
  // Tous les matchs existants (servent à résoudre le tableau côté serveur).
  allMatches: Match[];
}

function docToMatch(id: string, d: DocumentData): Match {
  const toDate = (ts: { toDate?: () => Date } | undefined) =>
    ts?.toDate ? ts.toDate() : new Date();
  return {
    id,
    apiMatchId: d.apiMatchId,
    phase: d.phase,
    groupCode: d.groupCode,
    homeTeamId: d.homeTeamId,
    awayTeamId: d.awayTeamId,
    homeTeam: d.homeTeam,
    awayTeam: d.awayTeam,
    stadiumName: d.stadiumName ?? "",
    city: d.city ?? "",
    kickoffUtc: toDate(d.kickoffUtc),
    lockAtUtc: toDate(d.lockAtUtc),
    status: d.status,
    homeScore: d.homeScore ?? null,
    awayScore: d.awayScore ?? null,
    qualifiedTeamId: d.qualifiedTeamId ?? null,
    isFinished: d.isFinished ?? false,
  };
}

// Un doc avec une équipe ext_* vient d'un échec de mapping de nom : il n'est
// pas indexé par équipes (clé inutilisable) mais reste retrouvable par apiId.
async function getExistingMatchIndex(): Promise<MatchIndex> {
  const adminDb = getAdminDb();
  const snap = await adminDb.collection("matches").get();
  const byApiId = new Map<string, { docId: string; isExt: boolean }>();
  const byTeams = new Map<string, string>();
  const finishedDocIds = new Set<string>();
  const allMatches: Match[] = [];
  snap.docs.forEach((d) => {
    const data = d.data();
    const isExt =
      String(data.homeTeamId ?? "").startsWith("ext_") ||
      String(data.awayTeamId ?? "").startsWith("ext_");
    if (data.apiMatchId) byApiId.set(String(data.apiMatchId), { docId: d.id, isExt });
    if (data.phase && data.homeTeamId && data.awayTeamId && !isExt) {
      byTeams.set(teamPairKey(data.phase, data.homeTeamId, data.awayTeamId), d.id);
    }
    if (data.isFinished) finishedDocIds.add(d.id);
    allMatches.push(docToMatch(d.id, data));
  });
  return { byApiId, byTeams, finishedDocIds, allMatches };
}

// Choisit le doc à mettre à jour, et signale un éventuel doublon ext_* à
// supprimer (créé par une sync passée avant que le nom d'équipe soit mappé).
function findExistingDoc(
  index: MatchIndex,
  apiMatchId: string,
  phase: string,
  homeId: string,
  awayId: string
): { docId?: string; staleExtDocId?: string } {
  const byId = index.byApiId.get(apiMatchId);
  if (byId && !byId.isExt) return { docId: byId.docId };
  const key = teamPairKey(phase, homeId, awayId);
  const pairDoc = index.byTeams.get(key);
  if (pairDoc) {
    index.byTeams.delete(key);
    return {
      docId: pairDoc,
      staleExtDocId: byId && byId.docId !== pairDoc ? byId.docId : undefined,
    };
  }
  return { docId: byId?.docId };
}

// Champs à ne pas écraser sur un doc existant quand l'API ne les fournit pas,
// ou qu'ils sont gérés côté app (qualifiedTeamId).
function pruneForUpdate(data: Record<string, unknown>): Record<string, unknown> {
  if (!data.stadiumName) delete data.stadiumName;
  if (!data.city) delete data.city;
  if (data.groupCode == null) delete data.groupCode;
  delete data.qualifiedTeamId;
  return data;
}

function buildMatchDoc(
  homeTeam: Team,
  awayTeam: Team,
  kickoffUtc: Date,
  phase: Match["phase"],
  groupCode: string | null,
  stadium: string,
  city: string,
  status: Match["status"],
  homeScore: number | null,
  awayScore: number | null,
  apiMatchId: string
): Record<string, unknown> {
  return {
    apiMatchId,
    phase,
    groupCode,
    homeTeamId: homeTeam.id,
    awayTeamId: awayTeam.id,
    homeTeam,
    awayTeam,
    stadiumName: stadium,
    city,
    kickoffUtc: Timestamp.fromDate(kickoffUtc),
    lockAtUtc: Timestamp.fromDate(new Date(kickoffUtc.getTime() - 1 * 3600_000)),
    status,
    homeScore,
    awayScore,
    qualifiedTeamId: null,
    isFinished: status === "finished",
  };
}

// ─── Public sync functions ──────────────────────────────────────────────────

export async function syncMatchesWC2026(): Promise<{ synced: number; errors: number; skipped: number; provider: string }> {
  const raw = await fetchWC2026("/matches");
  const list: WC2026Match[] = Array.isArray(raw) ? raw : (raw as { matches: WC2026Match[] }).matches ?? [];

  const adminDb = getAdminDb();
  const index = await getExistingMatchIndex();
  const batch = adminDb.batch();
  let synced = 0, errors = 0, skipped = 0;

  // Résolution du tableau côté serveur : quand le provider ne connaît pas encore
  // l'adversaire d'un match à élimination directe (3e à placer, ou tour non
  // encore renseigné), on le déduit du classement + tableau officiel via le n°
  // de match FIFA. Les scores se synchroniseront ensuite par apiMatchId.
  const resolved = resolveBracket(index.allMatches);
  const byNo = new Map<number, ResolvedMatch>();
  for (const round of ROUND_ORDER) for (const rm of resolved.columns[round]) byNo.set(rm.no, rm);
  const asTeam = (t: { id: string; name: string; code: string }): Team => ({ id: t.id, name: t.name, code: t.code });

  for (const m of list) {
    try {
      const phase = mapPhase(m.round);
      let home: Team;
      let away: Team;
      if (phase !== "group" && (!m.home_team || !m.away_team)) {
        const rm = m.match_number != null ? byNo.get(m.match_number) : undefined;
        if (!rm || !rm.a.team || !rm.b.team) { errors++; continue; }
        const ta = asTeam(rm.a.team);
        const tb = asTeam(rm.b.team);
        // On garde l'équipe déjà connue côté provider à sa place (l'orientation
        // home/away doit coïncider pour que la sync des scores reste correcte).
        if (m.home_team) {
          home = teamByName(m.home_team);
          away = home.id === ta.id ? tb : ta;
        } else if (m.away_team) {
          away = teamByName(m.away_team);
          home = away.id === ta.id ? tb : ta;
        } else {
          home = ta;
          away = tb;
        }
      } else {
        home = teamByName(m.home_team!);
        away = teamByName(m.away_team!);
      }
      const kickoff = new Date(m.kickoff_utc);
      const data = buildMatchDoc(
        home, away, kickoff,
        phase,
        normalizeGroupCode(m.group_name),
        m.stadium ?? "", m.city ?? "",
        mapStatus(m.status),
        m.home_score ?? null, m.away_score ?? null,
        String(m.id)
      );
      const { docId, staleExtDocId } = findExistingDoc(index, String(m.id), phase, home.id, away.id);
      // Match déjà terminé en base : on n'y touche pas (résultat figé).
      if (docId && index.finishedDocIds.has(docId)) { skipped++; continue; }
      if (docId) {
        batch.update(adminDb.collection("matches").doc(docId), pruneForUpdate(data));
      } else {
        batch.set(adminDb.collection("matches").doc(), data);
      }
      if (staleExtDocId) batch.delete(adminDb.collection("matches").doc(staleExtDocId));
      synced++;
    } catch { errors++; }
  }
  await batch.commit();
  return { synced, errors, skipped, provider: "wc2026api.com" };
}

export interface ScoreSyncResult {
  updated: number;
  provider: string;
  seen: number;
  statuses: Record<string, number>;
}

export async function syncScoresWC2026(): Promise<ScoreSyncResult> {
  const raw = await fetchWC2026("/matches");
  const list: WC2026Match[] = Array.isArray(raw) ? raw : (raw as { matches: WC2026Match[] }).matches ?? [];

  const adminDb = getAdminDb();
  const index = await getExistingMatchIndex();
  const batch = adminDb.batch();
  let updated = 0;
  const statuses: Record<string, number> = {};

  for (const m of list) {
    statuses[m.status] = (statuses[m.status] ?? 0) + 1;
    if (mapStatus(m.status) !== "live" && mapStatus(m.status) !== "finished") continue;
    // Scores : matching par apiMatchId uniquement — le fallback par équipes
    // risquerait d'inverser home/away. La sync "matches" pose l'apiMatchId.
    const docId = index.byApiId.get(String(m.id))?.docId;
    if (!docId) continue;
    batch.update(adminDb.collection("matches").doc(docId), {
      homeScore: m.home_score ?? null,
      awayScore: m.away_score ?? null,
      status: mapStatus(m.status),
      isFinished: mapStatus(m.status) === "finished",
    });
    updated++;
  }
  await batch.commit();
  return { updated, provider: "wc2026api.com", seen: list.length, statuses };
}

export async function syncMatchesApiFootball(): Promise<{ synced: number; errors: number; skipped: number; provider: string }> {
  const data = await fetchApiFootball("/fixtures?league=1&season=2026");
  const adminDb = getAdminDb();
  const index = await getExistingMatchIndex();
  const batch = adminDb.batch();
  let synced = 0, errors = 0, skipped = 0;

  for (const f of data.response) {
    try {
      const home = teamByName(f.teams.home.name);
      const away = teamByName(f.teams.away.name);
      const kickoff = new Date(f.fixture.date);
      const phase = mapPhase(f.league.round);
      const data2 = buildMatchDoc(
        home, away, kickoff,
        phase,
        extractGroup(f.league.round),
        f.venue?.name ?? "", f.venue?.city ?? "",
        mapStatus(f.fixture.status.short),
        f.goals.home, f.goals.away,
        String(f.fixture.id)
      );
      const { docId, staleExtDocId } = findExistingDoc(index, String(f.fixture.id), phase, home.id, away.id);
      // Match déjà terminé en base : on n'y touche pas (résultat figé).
      if (docId && index.finishedDocIds.has(docId)) { skipped++; continue; }
      if (docId) {
        batch.update(adminDb.collection("matches").doc(docId), pruneForUpdate(data2));
      } else {
        batch.set(adminDb.collection("matches").doc(), data2);
      }
      if (staleExtDocId) batch.delete(adminDb.collection("matches").doc(staleExtDocId));
      synced++;
    } catch { errors++; }
  }
  await batch.commit();
  return { synced, errors, skipped, provider: "api-football.com" };
}

export async function syncScoresApiFootball(): Promise<ScoreSyncResult> {
  // live=all ne renvoie que les matchs en cours de jeu : un match terminé
  // disparaît de la réponse et ne serait donc jamais marqué isFinished.
  // On requête par fenêtre de dates (hier → demain) pour couvrir les matchs
  // live ET récemment terminés.
  const day = (offset: number) =>
    new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
  const data = await fetchApiFootball(
    `/fixtures?league=1&season=2026&from=${day(-1)}&to=${day(1)}`
  );
  const adminDb = getAdminDb();
  const index = await getExistingMatchIndex();
  const batch = adminDb.batch();
  let updated = 0;
  const statuses: Record<string, number> = {};

  for (const f of data.response) {
    statuses[f.fixture.status.short] = (statuses[f.fixture.status.short] ?? 0) + 1;
    const docId = index.byApiId.get(String(f.fixture.id))?.docId;
    if (!docId) continue;
    const status = mapStatus(f.fixture.status.short);
    batch.update(adminDb.collection("matches").doc(docId), {
      homeScore: f.goals.home,
      awayScore: f.goals.away,
      status,
      isFinished: status === "finished",
    });
    updated++;
  }
  await batch.commit();
  return { updated, provider: "api-football.com", seen: data.response.length, statuses };
}

function extractGroup(round: string): string | null {
  const m = round.match(/Group\s+([A-L])/i);
  return m ? m[1].toUpperCase() : null;
}
