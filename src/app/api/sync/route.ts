import { NextRequest, NextResponse } from "next/server";
import { syncMatchesWC2026, syncScoresWC2026 } from "@/lib/api-providers";
import { recalculateAllPoints } from "@/lib/firestore";

export async function POST(request: NextRequest) {
  try {
    const { type } = await request.json() as { type: string };

    if (type === "matches") {
      const result = await syncMatchesWC2026();
      return NextResponse.json({ ok: true, ...result });
    }

    if (type === "scores") {
      const result = await syncScoresWC2026();
      await recalculateAllPoints();
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({ error: "type invalide" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
