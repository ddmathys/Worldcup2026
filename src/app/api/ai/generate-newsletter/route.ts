import { NextResponse } from "next/server";
import { getDocs, collection, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { NewsletterDraft, MatchRow } from "@/lib/newsletter-template";
import { format, isToday, isTomorrow, subDays, isAfter } from "date-fns";
import { fr } from "date-fns/locale";
import type { QueryDocumentSnapshot, DocumentData } from "firebase/firestore";

const DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions";

// ─── Types ───────────────────────────────────────────────────────────────────

interface GroupContext {
  group: string;
  teams: string[];
}

interface FinishedMatch {
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  group: string;
  date: string; // "lundi 26 mai"
}

// ─── Helpers Firebase ────────────────────────────────────────────────────────

function buildGroupContext(docs: QueryDocumentSnapshot<DocumentData>[]): GroupContext[] {
  const map = new Map<string, Set<string>>();
  for (const d of docs) {
    const data = d.data() as Record<string, unknown>;
    const g = (data.groupCode as string) ?? null;
    if (!g) continue;
    const home = (data.homeTeam as { name: string })?.name;
    const away = (data.awayTeam as { name: string })?.name;
    if (!map.has(g)) map.set(g, new Set());
    if (home) map.get(g)!.add(home);
    if (away) map.get(g)!.add(away);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([group, teams]) => ({ group, teams: Array.from(teams).sort() }));
}

/**
 * Matchs terminés dans les 4 derniers jours — ce sont les seuls résultats
 * que l'IA est autorisée à commenter.
 */
function extractRecentResults(
  docs: QueryDocumentSnapshot<DocumentData>[]
): FinishedMatch[] {
  const cutoff = subDays(new Date(), 4);
  return docs
    .filter((d) => {
      const data = d.data() as Record<string, unknown>;
      if (!data.isFinished) return false;
      const kickoff: Date = (data.kickoffUtc as { toDate: () => Date })?.toDate?.() ?? new Date(0);
      return isAfter(kickoff, cutoff);
    })
    .map((d) => {
      const data = d.data() as Record<string, unknown>;
      const kickoff: Date = (data.kickoffUtc as { toDate: () => Date })?.toDate?.() ?? new Date();
      return {
        home: (data.homeTeam as { name: string })?.name ?? "?",
        away: (data.awayTeam as { name: string })?.name ?? "?",
        homeScore: (data.homeScore as number) ?? 0,
        awayScore: (data.awayScore as number) ?? 0,
        group: (data.groupCode as string) ?? (data.phase as string) ?? "?",
        date: format(kickoff, "EEEE d MMMM", { locale: fr }),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ─── System prompt ───────────────────────────────────────────────────────────

function buildSystemPrompt(groups: GroupContext[], hasResults: boolean): string {
  const groupLines = groups
    .map((g) => `  - Groupe ${g.group} : ${g.teams.join(", ")}`)
    .join("\n");

  const resultsWarning = hasResults
    ? `⚠️ RÉSULTATS : Tu as accès aux résultats réels ci-dessous. N'utilise QUE ces scores — ne les modifie pas, ne les invente pas.`
    : `⚠️ AUCUN MATCH N'A ENCORE ÉTÉ JOUÉ. Il est STRICTEMENT INTERDIT d'inventer des scores, des résultats ou des classements de groupe. Tout article doit être en mode "avant-match" (preview, enjeux, analyse tactique, histoire entre les nations). Si tu inventes un score, ta réponse sera rejetée.`;

  return `Tu es un journaliste football expert, reconnu pour la rigueur factuelle de tes analyses. Tu travailles pour une newsletter lue par des passionnés de foot qui détectent immédiatement les erreurs factuelles.

COUPE DU MONDE 2026 — GROUPES OFFICIELS (tirage du 5 décembre 2025) :
${groupLines}

${resultsWarning}

RÈGLES DE VÉRIFICATION — à respecter impérativement :
1. Classement FIFA d'avril 2026 : France #1, Espagne #2, Argentine #3, Angleterre #4, Portugal #5, Brésil #6, Pays-Bas #7, Maroc #8, Belgique #9, Allemagne #10.
2. Statistiques historiques : ne cite que des chiffres vérifiables (palmarès FIFA officiel, records avérés). Si tu doutes d'un chiffre, reformule sans lui.
3. Joueurs : ne mentionne que des joueurs réellement convoqués dans leur sélection pour ce Mondial.
4. Confrontations historiques : uniquement des matchs réellement joués entre ces nations.
5. Format 2026 : 48 équipes, 12 groupes de 4, hôtes USA/Canada/Mexique, 104 matchs.
6. NE JAMAIS inventer de résultats, scores ou classements de groupe qui ne t'ont pas été fournis.

STYLE : L'Équipe magazine ou The Athletic. Récit narratif, analyse tactique, enjeux humains. Phrases complètes, jamais de puces. Français rigoureux.`;
}

// ─── User prompt ─────────────────────────────────────────────────────────────

function buildUserPrompt(
  today: MatchRow[],
  tomorrow: MatchRow[],
  recentResults: FinishedMatch[],
  dateStr: string
): string {
  const todayStr =
    today.length > 0
      ? today.map((m) => `  - ${m.home} vs ${m.away} (Groupe ${m.group}, ${m.time})`).join("\n")
      : "  Aucun match aujourd'hui.";

  const tomorrowStr =
    tomorrow.length > 0
      ? tomorrow.map((m) => `  - ${m.home} vs ${m.away} (Groupe ${m.group}, ${m.time})`).join("\n")
      : "  Aucun match demain.";

  // ── Bloc résultats réels ──────────────────────────────────────────────────
  const resultsBlock =
    recentResults.length > 0
      ? `\nRÉSULTATS RÉELS DES DERNIERS MATCHS (seuls scores que tu peux citer) :
${recentResults
  .map(
    (m) =>
      `  - ${m.date} · Groupe ${m.group} : ${m.home} ${m.homeScore}-${m.awayScore} ${m.away}`
  )
  .join("\n")}
`
      : `\n🚫 AUCUN RÉSULTAT DISPONIBLE. Le tournoi n'a pas encore commencé ou aucun match récent n'est terminé. Rédige UNIQUEMENT en mode preview/avant-match. Interdiction absolue d'inventer des scores.\n`;

  // ── Instruction centrale ──────────────────────────────────────────────────
  const focusMatches = today.length > 0 ? today : tomorrow.length > 0 ? tomorrow : null;

  let focusInstruction: string;

  if (focusMatches) {
    focusInstruction = `
MATCHES À ANALYSER EN PRIORITÉ (${today.length > 0 ? "aujourd'hui" : "demain"}) :
${focusMatches.map((m) => `  · ${m.home} vs ${m.away} (Groupe ${m.group})`).join("\n")}

Pour chaque match, construis ton article autour de :
1. CE QUI EST EN JEU — situation du groupe, scénarios de qualification (basés sur les résultats fournis ou "groupe encore ouvert" si aucun résultat)
2. LE RÉCIT DU TOURNOI — comment ces équipes sont arrivées là, leur forme, leurs forces
3. LA BATAILLE TACTIQUE — systèmes de jeu, duel clé, ce qui peut faire basculer le match
4. L'HISTOIRE — confrontations historiques réelles en Coupe du Monde entre ces nations

⚠️ Si aucun résultat de groupe n'est disponible, ne pas supposer de classement : écrire "groupe encore indécis" ou "premier match pour ces deux équipes".`;
  } else if (recentResults.length > 0) {
    focusInstruction = `
Pas de match aujourd'hui ni demain. Rédige un bilan de la phase de poules basé UNIQUEMENT sur les résultats fournis ci-dessus.
- Analyse les surprises et confirmations parmi ces vrais résultats
- Portrait d'une équipe ou d'un joueur qui ressort de ces matchs
- Enjeux des prochaines journées de poule

⚠️ N'invente aucun autre résultat que ceux listés ci-dessus.`;
  } else {
    focusInstruction = `
Le tournoi n'a pas encore commencé (ou aucun résultat récent disponible). Rédige un grand article de preview :
- L'enjeu historique : première Coupe du Monde à 48 équipes, 3 pays hôtes
- Les groupes les plus ouverts et les favoris à surveiller (basé sur les groupes réels fournis et le classement FIFA)
- Un portrait d'une équipe ou d'un groupe particulièrement explosif
- Les questions tactiques et humaines qui feront ce tournoi

⚠️ Zéro score, zéro résultat inventé. Mode anticipation uniquement.`;
  }

  return `Date de publication : ${dateStr}

Matchs du jour :
${todayStr}

Matchs de demain :
${tomorrowStr}
${resultsBlock}
${focusInstruction}

Réponds UNIQUEMENT avec ce JSON valide (sans markdown, sans texte autour) :
{
  "subject": "Objet email en français, percutant, max 60 caractères, avec emoji",
  "preheader": "Sous-titre, max 90 caractères",
  "headline": "Grand titre éditorial, narratif et fort, max 70 caractères",
  "intro": "2-3 phrases d'introduction qui posent l'enjeu. Ton éditorial.",
  "articles": [
    {
      "tag": "À LA UNE",
      "matchTitle": "Équipe A · Équipe B (ou null)",
      "title": "Titre de l'article, narratif, accrocheur",
      "content": "Corps — minimum 5 paragraphes séparés par \\n\\n. Récit, analyse tactique, contexte historique réel. Aucune liste.",
      "pullQuote": "Une phrase forte extraite du contenu",
      "keyPlayer": {
        "name": "Prénom Nom",
        "team": "Pays",
        "role": "Rôle tactique précis dans ce match (2-3 phrases)"
      }
    }
  ],
  "statOfDay": {
    "number": "chiffre réel et vérifiable",
    "unit": "unité optionnelle",
    "label": "Contexte WC2026 (1-2 phrases)"
  }
}

Maximum 2 articles. Tous les faits sont vérifiés. Aucun score inventé.`;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET() {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) {
    return NextResponse.json(
      { ok: false, error: "DEEPSEEK_API_KEY non configurée" },
      { status: 500 }
    );
  }

  let snap;
  try {
    snap = await getDocs(query(collection(db, "matches"), orderBy("kickoffUtc", "asc")));
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: `Erreur Firebase : ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }

  const today: MatchRow[] = [];
  const tomorrow: MatchRow[] = [];

  snap.docs.forEach((d) => {
    const data = d.data();
    const kickoff: Date = data.kickoffUtc?.toDate?.() ?? new Date();
    const row: MatchRow = {
      home: (data.homeTeam as { name: string })?.name ?? "?",
      away: (data.awayTeam as { name: string })?.name ?? "?",
      group: (data.groupCode as string) ?? (data.phase as string),
      time: format(kickoff, "HH:mm"),
    };
    if (isToday(kickoff)) today.push(row);
    else if (isTomorrow(kickoff)) tomorrow.push(row);
  });

  const groups = buildGroupContext(snap.docs);
  const recentResults = extractRecentResults(snap.docs);
  const hasResults = recentResults.length > 0;

  const dateStr = format(new Date(), "EEEE d MMMM yyyy", { locale: fr });
  const systemPrompt = buildSystemPrompt(groups, hasResults);
  const userPrompt = buildUserPrompt(today, tomorrow, recentResults, dateStr);

  let res: Response;
  try {
    res = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        max_tokens: 4000,
        temperature: 0.6,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: `Impossible de joindre DeepSeek : ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 }
    );
  }

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { ok: false, error: `DeepSeek ${res.status}: ${text.slice(0, 400)}` },
      { status: 502 }
    );
  }

  let aiData: { choices?: Array<{ message?: { content?: string } }> };
  try {
    aiData = await res.json() as typeof aiData;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Réponse DeepSeek non parsable" },
      { status: 502 }
    );
  }

  const raw = aiData.choices?.[0]?.message?.content ?? "{}";

  let newsletter: Omit<NewsletterDraft, "matchesToday" | "matchesTomorrow" | "dateStr">;
  try {
    newsletter = JSON.parse(raw) as typeof newsletter;
  } catch {
    return NextResponse.json(
      { ok: false, error: "La réponse IA n'est pas un JSON valide", raw: raw.slice(0, 500) },
      { status: 502 }
    );
  }

  if (!newsletter.subject || !newsletter.articles?.length) {
    return NextResponse.json(
      { ok: false, error: "Structure JSON incomplète (subject ou articles manquants)", raw: raw.slice(0, 500) },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    ...newsletter,
    matchesToday: today,
    matchesTomorrow: tomorrow,
    dateStr,
  });
}
