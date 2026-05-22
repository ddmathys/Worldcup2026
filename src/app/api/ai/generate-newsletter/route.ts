import { NextResponse } from "next/server";
import { getDocs, collection, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { NewsletterDraft, MatchRow } from "@/lib/newsletter-template";
import { format, isToday, isTomorrow } from "date-fns";
import { fr } from "date-fns/locale";

const DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions";

function buildPrompt(today: MatchRow[], tomorrow: MatchRow[], dateStr: string): string {
  const todayStr =
    today.length > 0
      ? today.map((m) => `  - ${m.home} vs ${m.away} (Groupe ${m.group}, ${m.time})`).join("\n")
      : "  Aucun match aujourd'hui.";

  const tomorrowStr =
    tomorrow.length > 0
      ? tomorrow.map((m) => `  - ${m.home} vs ${m.away} (Groupe ${m.group}, ${m.time})`).join("\n")
      : "  Aucun match demain.";

  const focusMatches =
    today.length > 0 ? today : tomorrow.length > 0 ? tomorrow : null;

  const focusInstruction = focusMatches
    ? `
MATCHES À TRAITER EN PRIORITÉ (${today.length > 0 ? "aujourd'hui" : "demain"}) :
${focusMatches.map((m) => `  · ${m.home} vs ${m.away} (Groupe ${m.group})`).join("\n")}

Pour chaque match, construis le récit autour de :
1. CE QUI EST EN JEU — la situation dans le groupe, les scénarios de qualification, la pression sur chaque équipe
2. LE RÉCIT DE CE TOURNOI — comment ces équipes sont arrivées là, leur forme récente, leurs blessures, leur moral
3. LA BATAILLE TACTIQUE — le système de jeu, le duel clé dans l'entrejeu ou en défense, ce qui peut faire basculer le match
4. L'HISTOIRE ENTRE CES NATIONS — confrontations passées en Coupe du Monde, rivalité historique, ce que ce match représente culturellement
`
    : `
Aucun match aujourd'hui ni demain. Rédige un grand article sur la Coupe du Monde 2026 :
- Une histoire forte sur le tournoi lui-même (édition inédite à 48 équipes, 3 pays hôtes, nouveaux stades)
- Ou un bilan de la phase de poules jusqu'ici (surprises, déceptions, révélations)
- Ou le portrait d'une équipe ou d'un joueur qui marque ce tournoi
`;

  return `Tu es rédacteur en chef d'une newsletter football de référence, style L'Équipe magazine ou The Athletic. Tu écris pour des fans passionnés de foot qui veulent de l'analyse et du récit, pas des anecdotes de quiz.

Date : ${dateStr}

Matchs du jour :
${todayStr}

Matchs de demain :
${tomorrowStr}

${focusInstruction}

RÈGLES D'ÉCRITURE ABSOLUES :
- Jamais de listes à puces dans le contenu des articles — du RÉCIT pur, des phrases complètes
- Chaque paragraphe doit apporter une information ou une analyse concrète
- Les chiffres et statistiques sont les bienvenus s'ils éclairent le propos (% possession, buts encaissés, classement FIFA, nb d'Coupes du Monde remportées…)
- Le pullQuote doit être une phrase choc ou révélatrice — pas une généralité
- Le keyPlayer doit être décrit avec précision : son rôle tactique exact dans CE match
- Le statOfDay doit être un vrai chiffre intéressant lié au contexte (pas inventé)
- Langue : français impeccable, ton passionné mais rigoureux
- Maximum 2 articles

Réponds UNIQUEMENT avec ce JSON valide (sans markdown, sans texte autour) :
{
  "subject": "Objet de l'email en français, percutant, max 60 caractères, avec emoji",
  "preheader": "Sous-titre court, max 90 caractères",
  "headline": "Grand titre éditorial de cette édition, narratif et fort (max 70 chars)",
  "intro": "2-3 phrases d'introduction qui posent l'enjeu et donnent envie de lire. Ton éditorial.",
  "articles": [
    {
      "tag": "À LA UNE",
      "matchTitle": "Équipe A · Équipe B (ou null si pas lié à un match)",
      "title": "Titre de l'article, narratif, accrocheur",
      "content": "Corps de l'article — minimum 5 paragraphes séparés par \\n\\n. Récit, analyse tactique, contexte historique, enjeux de qualification. Pas de puces.",
      "pullQuote": "Une seule phrase forte ou choc extraite du contenu",
      "keyPlayer": {
        "name": "Prénom Nom",
        "team": "Pays de l'équipe",
        "role": "Description précise de son rôle tactique dans ce match spécifique (2-3 phrases)"
      }
    }
  ],
  "statOfDay": {
    "number": "chiffre ou nombre",
    "unit": "unité optionnelle (ans, buts, matchs…)",
    "label": "Explication du chiffre en contexte WC2026 (1-2 phrases)"
  }
}`;
}

export async function GET() {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) {
    return NextResponse.json({ ok: false, error: "DEEPSEEK_API_KEY non configurée" }, { status: 500 });
  }

  const snap = await getDocs(
    query(collection(db, "matches"), orderBy("kickoffUtc", "asc"))
  );

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

  const dateStr = format(new Date(), "EEEE d MMMM yyyy", { locale: fr });
  const prompt = buildPrompt(today, tomorrow, dateStr);

  const res = await fetch(DEEPSEEK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      max_tokens: 4000,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { ok: false, error: `DeepSeek ${res.status}: ${text.slice(0, 300)}` },
      { status: 502 }
    );
  }

  const data = await res.json() as { choices: Array<{ message: { content: string } }> };
  const raw = data.choices?.[0]?.message?.content ?? "{}";

  let newsletter: Omit<NewsletterDraft, "matchesToday" | "matchesTomorrow" | "dateStr">;
  try {
    newsletter = JSON.parse(raw) as typeof newsletter;
  } catch {
    return NextResponse.json({ ok: false, error: "Réponse IA invalide", raw }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    ...newsletter,
    matchesToday: today,
    matchesTomorrow: tomorrow,
    dateStr,
  });
}
