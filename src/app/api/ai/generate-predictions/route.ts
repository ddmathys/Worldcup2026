import { NextRequest, NextResponse } from "next/server";
import {
  collection,
  doc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

const DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions";

const METHODS: Record<string, { label: string; prompt: string }> = {
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
  ai: {
    label: "IA libre",
    prompt:
      "Use your best global analytical judgment. Consider FIFA rankings, recent form, team quality, historical context, and tournament conditions.",
  },
};

interface MatchInput {
  id: string;
  homeTeam: string;
  awayTeam: string;
}

interface DeepSeekResult {
  id: string;
  homeScore: number;
  awayScore: number;
  note: string;
}

function extractResultsFallback(raw: string, matches: MatchInput[]): DeepSeekResult[] {
  const results: DeepSeekResult[] = [];
  for (const match of matches) {
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
      results.push({ id: match.id, homeScore: parseInt(m[1]), awayScore: parseInt(m[2]), note: "" });
    }
  }
  return results;
}

async function callDeepSeek(
  matches: MatchInput[],
  group: string,
  methodKey: string
): Promise<DeepSeekResult[]> {
  const method = METHODS[methodKey] ?? METHODS.ai;
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error("DEEPSEEK_API_KEY non configurée");

  const prompt = `Tu es un expert football analysant la Coupe du Monde 2026, Groupe ${group}.
Méthode : "${method.label}". Instructions : ${method.prompt}

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
    throw new Error(`DeepSeek ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json() as { choices: Array<{ message: { content: string } }> };
  const raw = data.choices?.[0]?.message?.content ?? "";

  const arrayMatch = raw.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      return JSON.parse(arrayMatch[0]) as DeepSeekResult[];
    } catch {
      // fall through to regex fallback
    }
  }

  const fallback = extractResultsFallback(raw, matches);
  if (fallback.length > 0) return fallback;

  throw new Error(`Réponse IA invalide: ${raw.slice(0, 150)}`);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      scope: "all" | "group";
      groupCode?: string;
      method?: string;
      overwrite?: boolean;
    };
    const { scope, groupCode, method = "ai", overwrite = false } = body;

    const constraints = [where("phase", "==", "group")];
    if (scope === "group" && groupCode) {
      constraints.push(where("groupCode", "==", groupCode));
    }

    const snap = await getDocs(
      query(collection(db, "matches"), orderBy("kickoffUtc", "asc"), ...constraints)
    );

    type MatchDoc = {
      id: string;
      groupCode: string;
      homeTeam: { name: string };
      awayTeam: { name: string };
      aiPrediction?: unknown;
    };

    const allMatches = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<MatchDoc, "id">),
    })) as MatchDoc[];

    const toGenerate = overwrite
      ? allMatches
      : allMatches.filter((m) => !m.aiPrediction);

    if (toGenerate.length === 0) {
      return NextResponse.json({
        ok: true,
        generated: 0,
        skipped: allMatches.length,
      });
    }

    // Group by groupCode
    const byGroup = new Map<string, MatchDoc[]>();
    for (const m of toGenerate) {
      const g = m.groupCode;
      if (!byGroup.has(g)) byGroup.set(g, []);
      byGroup.get(g)!.push(m);
    }

    let generated = 0;
    const errors: string[] = [];

    for (const [group, groupMatches] of byGroup) {
      try {
        const inputs: MatchInput[] = groupMatches.map((m) => ({
          id: m.id,
          homeTeam: m.homeTeam.name,
          awayTeam: m.awayTeam.name,
        }));

        const results = await callDeepSeek(inputs, group, method);

        for (const r of results) {
          const matchDoc = groupMatches.find((m) => m.id === r.id);
          if (!matchDoc) continue;
          await updateDoc(doc(db, "matches", r.id), {
            aiPrediction: {
              homeScore: r.homeScore,
              awayScore: r.awayScore,
              method,
              note: r.note ?? "",
              generatedAt: Timestamp.now(),
            },
          });
          generated++;
        }
      } catch (e) {
        errors.push(
          `Groupe ${group}: ${e instanceof Error ? e.message : "erreur"}`
        );
      }
    }

    return NextResponse.json({
      ok: errors.length === 0,
      generated,
      skipped: allMatches.length - toGenerate.length,
      errors,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
