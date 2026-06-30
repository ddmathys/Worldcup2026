import { NextResponse } from "next/server";
import { syncScoresWC2026, syncScoresApiFootball } from "@/lib/api-providers";
import { recalculateAllPointsAdmin } from "@/lib/firestore-admin";
import { getAdminAuth } from "@/lib/firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { getApps } from "firebase-admin/app";

// Called by Vercel Cron every 30 min.
// Only syncs if a match kicked off ≥ 3h30 ago and is not yet marked finished,
// which approximates "1h after the final whistle".
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const now = Date.now();
  const SYNC_DELAY = 3.5 * 3600_000; // 3h30 after kickoff

  getAdminAuth();
  const adminDb = getFirestore(getApps()[0]);
  const snap = await adminDb.collection("matches").get();
  const needsUpdate = snap.docs.some((d) => {
    const data = d.data();
    if (data.isFinished) return false;
    const kickoff: number | undefined = data.kickoffUtc?.toDate?.()?.getTime?.();
    if (!kickoff) return false;
    return now >= kickoff + SYNC_DELAY;
  });

  if (!needsUpdate) {
    // Aucun match à synchroniser, mais on recalcule quand même : un match a pu
    // passer isFinished via la sync calendrier (type:"matches"), qui ne déclenche
    // pas de recalcul — sinon ses pointsAwarded resteraient null indéfiniment.
    await recalculateAllPointsAdmin();
    return NextResponse.json({ ok: true, skipped: true, reason: "no match in update window" });
  }

  // Même logique que /api/sync : wc2026api peut répondre sans erreur mais
  // sans match exploitable, on bascule alors sur API-Football.
  let result;
  try {
    result = await syncScoresWC2026();
  } catch {
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
  return NextResponse.json({ ok: true, ...result });
}
