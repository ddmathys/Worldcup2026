import { NextResponse } from "next/server";
import { syncScoresWC2026 } from "@/lib/api-providers";
import { recalculateAllPoints } from "@/lib/firestore";
import { getDocs, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";

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

  const snap = await getDocs(collection(db, "matches"));
  const needsUpdate = snap.docs.some((d) => {
    const data = d.data();
    if (data.isFinished) return false;
    const kickoff: number | undefined = data.kickoffUtc?.toDate?.()?.getTime?.();
    if (!kickoff) return false;
    return now >= kickoff + SYNC_DELAY;
  });

  if (!needsUpdate) {
    return NextResponse.json({ ok: true, skipped: true, reason: "no match in update window" });
  }

  const result = await syncScoresWC2026();
  await recalculateAllPoints();
  return NextResponse.json({ ok: true, ...result });
}
