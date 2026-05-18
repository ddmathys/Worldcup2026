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

// Fallback: extract id/homeScore/awayScore via regex when JSON.parse fails
function extractResultsFallback(raw: string, matches: PredictMatch[]): PredictResult[] {
  const results: PredictResult[] = [];
  for (const match of matches) {
    // Find the block containing this match id
    const idEscaped = match.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const blockRe = new RegExp(
      `"id"\\s*:\\s*"${idEscaped}"[^}]*?"homeScore"\\s*:\\s*(\\d+)[^}]*?"awayScore"\\s*:\\s*(\\d+)`,
      "s"
    );
    const altRe = new RegExp(
      `"homeScore"\\s*:\\s*(\\d+)[^}]*?"awayScore"\\s*:\\s*(\\d+)[^}]*?"id"\\s*:\\s*"${idEscaped}"`,
      "s"
    );
    const m = blockRe.exec(raw) ?? altRe.exec(raw);
    if (m) {
      results.push({
        id: match.id,
        homeScore: parseInt(m[1]),
        awayScore: parseInt(m[2]),
        note: "",
      });
    }
  }
  return results;
}

function parseAiResponse(raw: string, matches: PredictMatch[]): PredictResult[] {
  // 1. Try to find and parse the JSON array directly
  const arrayMatch = raw.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      return JSON.parse(arrayMatch[0]) as PredictResult[];
    } catch {
      // JSON has issues (unescaped quotes in notes, etc.) — try fallback
    }
  }

  // 2. Fallback: extract values per match via regex (note will be empty)
  const fallback = extractResultsFallback(raw, matches);
  if (fallback.length > 0) return fallback;

  throw new Error(`Réponse IA non parseable : ${raw.slice(0, 150)}`);
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

Retourne UNIQUEMENT un tableau JSON valide. Règles strictes :
- Pas de markdown, pas d'explication autour du JSON
- Les notes ne doivent PAS contenir de guillemets (") ni de caractères spéciaux
- Maximum 6 mots par note, en français simple

Format : [{"id":"...","homeScore":N,"awayScore":N,"note":"..."},...]

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
        max_tokens: 2000,
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

    const results = parseAiResponse(raw, matches);
    return NextResponse.json({ ok: true, results });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
