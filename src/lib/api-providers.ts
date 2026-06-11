import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getAdminAuth } from "./firebase-admin";
import { getApps } from "firebase-admin/app";
import { WC2026_TEAMS } from "./seed-data";
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
  Belgium: "bel", Egypt: "egy", Iran: "irn", "New Zealand": "nzl",
  Spain: "esp", "Cape Verde": "cpv", "Saudi Arabia": "ksa", Uruguay: "uru",
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

function mapStatus(s: string): Match["status"] {
  s = s.toLowerCase();
  if (s === "finished" || s === "ft" || s === "aet" || s === "pen") return "finished";
  if (s === "live" || s === "1h" || s === "2h" || s === "ht" || s === "et" || s === "bt" || s === "p") return "live";
  if (s === "locked") return "locked";
  return "open";
}

// ─── wc2026api.com ─────────────────────────────────────────────────────────
interface WC2026Match {
  id: number;
  round: string;
  group_name?: string;
  home_team: string;
  away_team: string;
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
  byApiId: Map<string, string>;
  byTeams: Map<string, string>;
}

async function getExistingMatchIndex(): Promise<MatchIndex> {
  const adminDb = getAdminDb();
  const snap = await adminDb.collection("matches").get();
  const byApiId = new Map<string, string>();
  const byTeams = new Map<string, string>();
  snap.docs.forEach((d) => {
    const data = d.data();
    if (data.apiMatchId) byApiId.set(String(data.apiMatchId), d.id);
    if (data.phase && data.homeTeamId && data.awayTeamId) {
      byTeams.set(teamPairKey(data.phase, data.homeTeamId, data.awayTeamId), d.id);
    }
  });
  return { byApiId, byTeams };
}

function findExistingDoc(
  index: MatchIndex,
  apiMatchId: string,
  phase: string,
  homeId: string,
  awayId: string
): string | undefined {
  const byId = index.byApiId.get(apiMatchId);
  if (byId) return byId;
  const key = teamPairKey(phase, homeId, awayId);
  const docId = index.byTeams.get(key);
  if (docId) index.byTeams.delete(key);
  return docId;
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

export async function syncMatchesWC2026(): Promise<{ synced: number; errors: number; provider: string }> {
  const raw = await fetchWC2026("/matches");
  const list: WC2026Match[] = Array.isArray(raw) ? raw : (raw as { matches: WC2026Match[] }).matches ?? [];

  const adminDb = getAdminDb();
  const index = await getExistingMatchIndex();
  const batch = adminDb.batch();
  let synced = 0, errors = 0;

  for (const m of list) {
    try {
      const home = teamByName(m.home_team);
      const away = teamByName(m.away_team);
      const kickoff = new Date(m.kickoff_utc);
      const phase = mapPhase(m.round);
      const data = buildMatchDoc(
        home, away, kickoff,
        phase,
        normalizeGroupCode(m.group_name),
        m.stadium ?? "", m.city ?? "",
        mapStatus(m.status),
        m.home_score ?? null, m.away_score ?? null,
        String(m.id)
      );
      const existing = findExistingDoc(index, String(m.id), phase, home.id, away.id);
      if (existing) {
        batch.update(adminDb.collection("matches").doc(existing), pruneForUpdate(data));
      } else {
        batch.set(adminDb.collection("matches").doc(), data);
      }
      synced++;
    } catch { errors++; }
  }
  await batch.commit();
  return { synced, errors, provider: "wc2026api.com" };
}

export async function syncScoresWC2026(): Promise<{ updated: number; provider: string }> {
  const raw = await fetchWC2026("/matches");
  const list: WC2026Match[] = Array.isArray(raw) ? raw : (raw as { matches: WC2026Match[] }).matches ?? [];

  const adminDb = getAdminDb();
  const index = await getExistingMatchIndex();
  const batch = adminDb.batch();
  let updated = 0;

  for (const m of list) {
    if (m.status !== "live" && m.status !== "finished") continue;
    // Scores : matching par apiMatchId uniquement — le fallback par équipes
    // risquerait d'inverser home/away. La sync "matches" pose l'apiMatchId.
    const docId = index.byApiId.get(String(m.id));
    if (!docId) continue;
    batch.update(adminDb.collection("matches").doc(docId), {
      homeScore: m.home_score ?? null,
      awayScore: m.away_score ?? null,
      status: mapStatus(m.status),
      isFinished: m.status === "finished",
    });
    updated++;
  }
  await batch.commit();
  return { updated, provider: "wc2026api.com" };
}

export async function syncMatchesApiFootball(): Promise<{ synced: number; errors: number; provider: string }> {
  const data = await fetchApiFootball("/fixtures?league=1&season=2026");
  const adminDb = getAdminDb();
  const index = await getExistingMatchIndex();
  const batch = adminDb.batch();
  let synced = 0, errors = 0;

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
      const existing = findExistingDoc(index, String(f.fixture.id), phase, home.id, away.id);
      if (existing) {
        batch.update(adminDb.collection("matches").doc(existing), pruneForUpdate(data2));
      } else {
        batch.set(adminDb.collection("matches").doc(), data2);
      }
      synced++;
    } catch { errors++; }
  }
  await batch.commit();
  return { synced, errors, provider: "api-football.com" };
}

export async function syncScoresApiFootball(): Promise<{ updated: number; provider: string }> {
  const data = await fetchApiFootball("/fixtures?league=1&season=2026&live=all");
  const adminDb = getAdminDb();
  const index = await getExistingMatchIndex();
  const batch = adminDb.batch();
  let updated = 0;

  for (const f of data.response) {
    const docId = index.byApiId.get(String(f.fixture.id));
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
  return { updated, provider: "api-football.com" };
}

function extractGroup(round: string): string | null {
  const m = round.match(/Group\s+([A-L])/i);
  return m ? m[1].toUpperCase() : null;
}
