import { NextRequest, NextResponse } from "next/server";
import {
  syncMatchesWC2026, syncScoresWC2026,
  syncMatchesApiFootball, syncScoresApiFootball,
} from "@/lib/api-providers";
import { recalculateAllPointsAdmin } from "@/lib/firestore-admin";

export async function POST(request: NextRequest) {
  try {
    const { type } = await request.json() as { type: string };

    if (type === "matches") {
      let result;
      try {
        result = await syncMatchesWC2026();
      } catch {
        result = await syncMatchesApiFootball();
      }
      return NextResponse.json({ ok: true, ...result });
    }

    if (type === "scores") {
      let result;
      try {
        result = await syncScoresWC2026();
      } catch {
        result = await syncScoresApiFootball();
      }
      await recalculateAllPointsAdmin();
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({ error: "type invalide" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
