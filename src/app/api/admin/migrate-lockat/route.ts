import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase-admin";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getApps } from "firebase-admin/app";

function getAdminDb() {
  getAdminAuth();
  return getFirestore(getApps()[0]);
}

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const db = getAdminDb();
    const snap = await db.collection("matches").get();

    let updated = 0;
    let skipped = 0;
    const BATCH_SIZE = 400;
    let batch = db.batch();
    let batchCount = 0;

    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      const kickoff: Timestamp | undefined = data.kickoffUtc;
      if (!kickoff) { skipped++; continue; }

      const kickoffMs = kickoff.toMillis();
      const newLockAtMs = kickoffMs - 1 * 3600_000;
      const currentLockAt: Timestamp | undefined = data.lockAtUtc;

      if (currentLockAt && Math.abs(currentLockAt.toMillis() - newLockAtMs) < 1000) {
        skipped++;
        continue;
      }

      batch.update(docSnap.ref, {
        lockAtUtc: Timestamp.fromMillis(newLockAtMs),
      });
      updated++;
      batchCount++;

      if (batchCount >= BATCH_SIZE) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    }

    if (batchCount > 0) await batch.commit();

    return NextResponse.json({ ok: true, updated, skipped, total: snap.size });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
