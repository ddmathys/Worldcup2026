import { NextResponse } from "next/server";
import { getDocs, collection, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { NewsletterSection } from "@/lib/newsletter-template";
import { format, isToday, isTomorrow } from "date-fns";
import { fr } from "date-fns/locale";

const DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions";

interface MatchRow {
  home: string;
  away: string;
  group: string;
  time: string;
  phase: string;
}

interface DeepSeekResponse {
  subject: string;
  preheader: string;
  sections: NewsletterSection[];
}

function buildPrompt(
  today: MatchRow[],
  tomorrow: MatchRow[],
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

  return `Tu es un journaliste sportif passionné et expert en football, qui rédige la newsletter quotidienne de la Coupe du Monde 2026 pour une communauté de fans français.

Date : ${dateStr}

Matchs du jour :
${todayStr}

Matchs de demain :
${tomorrowStr}

Génère une newsletter engageante, chaleureuse et informative en français. Règles :
- Ton passionné, accessible, dynamique — comme si tu parlais à des amis fans de foot
- Si des matchs ont lieu aujourd'hui : mets les enjeux, ce qui est en jeu dans les groupes
- La veille des matchs : raconte une anecdote marquante ou un fait surprenant sur les équipes concernées
- Sans matchs : une histoire captivante sur le tournoi (record, fait historique, pays hôte, star attendue…)
- 2 sections maximum, chacune avec un contenu de 2-3 paragraphes
- Les emojis doivent être simples (⚽🔥💡🏆🌍)

Réponds UNIQUEMENT avec ce JSON valide (sans markdown, sans texte autour) :
{
  "subject": "sujet de l'email (max 60 caractères, en français, avec emoji)",
  "preheader": "texte de prévisualisation court (max 100 caractères)",
  "sections": [
    {
      "title": "titre de la section",
      "emoji": "emoji unique",
      "content": "contenu en texte brut, paragraphes séparés par \\n\\n"
    }
  ]
}`;
}

export async function GET() {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) {
    return NextResponse.json({ ok: false, error: "DEEPSEEK_API_KEY non configurée" }, { status: 500 });
  }

  // Fetch all matches from Firestore
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
      group: (data.groupCode as string) ?? data.phase,
      time: format(kickoff, "HH:mm"),
      phase: data.phase as string,
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
      max_tokens: 2000,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ ok: false, error: `DeepSeek ${res.status}: ${text.slice(0, 200)}` }, { status: 502 });
  }

  const data = await res.json() as { choices: Array<{ message: { content: string } }> };
  const raw = data.choices?.[0]?.message?.content ?? "{}";

  let newsletter: DeepSeekResponse;
  try {
    newsletter = JSON.parse(raw) as DeepSeekResponse;
  } catch {
    return NextResponse.json({ ok: false, error: "Réponse IA invalide", raw }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    subject: newsletter.subject,
    preheader: newsletter.preheader,
    sections: newsletter.sections,
    matchesToday: today,
    matchesTomorrow: tomorrow,
    dateStr,
  });
}
