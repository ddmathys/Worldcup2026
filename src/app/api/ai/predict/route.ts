import { NextRequest, NextResponse } from "next/server";

const DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions";

const METHODS: Record<string, { label: string; prompt: string }> = {
  ai: {
    label: "IA libre",
    prompt:
      "Use your best global analytical judgment. Consider FIFA rankings, recent form, team quality, historical context, and tournament conditions.",
  },
  fifa: {
    label: "Classement FIFA",
    prompt:
      "Base your predictions strictly on FIFA April 2026 rankings. Top-ranked teams should win more often, with scores reflecting the quality gap.",
  },
  betting: {
    label: "Cotes de paris",
    prompt:
      "Simulate bookmaker odds: 55% chance favourite wins, 25% draw, 20% upset. Reflect typical betting market logic.",
  },
  form: {
    label: "Forme actuelle",
    prompt:
      "Focus on 2025-2026 performance and pre-tournament momentum. Recent form matters more than historical reputation.",
  },
  chaos: {
    label: "Mode chaos",
    prompt:
      "Encourage upsets and surprising results. Underdogs win, high-scoring games, unexpected draws. Keep scores realistic but unpredictable.",
  },
};

export interface PredictMatch {
  id: string;
  homeTeam: string;
  awayTeam: string;
}

export interface PredictResult {
  id: string;
  homeScore: number;
  awayScore: number;
  note: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      groupCode: string;
      matches: PredictMatch[];
      method?: string;
    };
    const { groupCode, matches, method = "ai" } = body;

    if (!matches?.length) {
      return NextResponse.json({ ok: false, error: "Aucun match fourni" }, { status: 400 });
    }

    const key = process.env.DEEPSEEK_API_KEY;
    if (!key) {
      return NextResponse.json({ ok: false, error: "DEEPSEEK_API_KEY non configurée" }, { status: 500 });
    }

    const m = METHODS[method] ?? METHODS.ai;
    const prompt = `Tu es un expert football analysant la Coupe du Monde 2026, Groupe ${groupCode}.
Méthode : "${m.label}". Instructions : ${m.prompt}

Retourne UNIQUEMENT un tableau JSON valide, sans markdown ni explication :
[{"id":"...","homeScore":N,"awayScore":N,"note":"max 8 mots en français"},…]

Matchs :
${JSON.stringify(matches)}`;

    const res = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        max_tokens: 800,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { ok: false, error: `DeepSeek ${res.status}: ${text.slice(0, 200)}` },
        { status: 502 }
      );
    }

    const data = await res.json() as { choices: Array<{ message: { content: string } }> };
    const raw = data.choices?.[0]?.message?.content ?? "";

    // Extract the JSON array robustly — ignore any surrounding text/markdown
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json(
        { ok: false, error: `Réponse IA invalide : ${raw.slice(0, 200)}` },
        { status: 502 }
      );
    }
    const results = JSON.parse(jsonMatch[0]) as PredictResult[];
    return NextResponse.json({ ok: true, results });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
