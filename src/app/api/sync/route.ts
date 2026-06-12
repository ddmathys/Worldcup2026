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
      // wc2026api peut répondre sans erreur mais sans aucun match live/terminé
      // exploitable : on bascule aussi sur API-Football quand 0 mise à jour.
      let result;
      let primaryError: string | null = null;
      try {
        result = await syncScoresWC2026();
      } catch (e) {
        primaryError = e instanceof Error ? e.message : String(e);
        result = null;
      }
      if (!result || result.updated === 0) {
        try {
          const fallback = await syncScoresApiFootball();
          result = result && result.updated >= fallback.updated ? result : fallback;
        } catch (e) {
          if (!result) throw e;
        }
      }
      await recalculateAllPointsAdmin();
      return NextResponse.json({ ok: true, ...result, primaryError });
    }

    if (type === "recalc") {
      // Recalcul seul, côté serveur (SDK Admin) : le recalcul côté client est
      // bloqué par les règles Firestore (update des predictions d'autrui).
      await recalculateAllPointsAdmin();
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "type invalide" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
