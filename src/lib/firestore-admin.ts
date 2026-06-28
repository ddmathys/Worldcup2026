import { getAdminAuth } from "./firebase-admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getApps } from "firebase-admin/app";
import { scorePrediction } from "./scoring";
import type { Match, UserProfile, UserRole } from "@/types";

function getAdminDb() {
  getAdminAuth();
  return getFirestore(getApps()[0]);
}

export async function recalculateAllPointsAdmin(): Promise<void> {
  const db = getAdminDb();
  const [matchesSnap, predsSnap, usersSnap] = await Promise.all([
    db.collection("matches").get(),
    db.collection("predictions").get(),
    db.collection("users").get(),
  ]);

  const matches = new Map(matchesSnap.docs.map((d) => [d.id, d.data()]));
  const userPoints = new Map<string, { total: number; exact: number; winner: number; predictions: number }>();

  usersSnap.docs.forEach((d) => {
    userPoints.set(d.id, { total: 0, exact: 0, winner: 0, predictions: 0 });
  });

  const BATCH_SIZE = 400;
  let batch = db.batch();
  let ops = 0;

  for (const predDoc of predsSnap.docs) {
    const pred = predDoc.data();
    const uid = pred.userId as string;
    if (userPoints.has(uid)) userPoints.get(uid)!.predictions += 1;

    const match = matches.get(pred.matchId as string);
    if (!match || !match.isFinished) continue;

    const { points, exact, correct } = scorePrediction(
      match.phase as Match["phase"],
      pred.predictedHomeScore as number | null,
      pred.predictedAwayScore as number | null,
      match.homeScore as number | null,
      match.awayScore as number | null
    );

    batch.update(db.collection("predictions").doc(predDoc.id), { pointsAwarded: points });
    ops++;
    if (userPoints.has(uid)) {
      const u = userPoints.get(uid)!;
      u.total += points;
      if (exact) u.exact += 1;
      else if (correct) u.winner += 1;
    }

    if (ops >= BATCH_SIZE) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
    }
  }

  userPoints.forEach((pts, uid) => {
    batch.update(db.collection("users").doc(uid), {
      totalPoints: pts.total,
      exactScoresCount: pts.exact,
      correctWinnerCount: pts.winner,
      predictionsCount: pts.predictions,
      updatedAt: FieldValue.serverTimestamp(),
    });
    ops++;
  });

  if (ops > 0) await batch.commit();
}

export async function getAllUsersAdmin(): Promise<UserProfile[]> {
  const auth = getAdminAuth();
  const db = getAdminDb();

  // Firebase Auth = source de vérité pour les emails (jamais vide)
  const authResult = await auth.listUsers(1000);

  // Firestore pour les points et métadonnées (peut être partiel)
  const snap = await db.collection("users").get();
  const firestoreMap = new Map(snap.docs.map((d) => [d.id, d.data()]));

  return authResult.users
    .filter((u) => !!u.email)
    .map((u) => {
      const data = firestoreMap.get(u.uid) ?? {};
      return {
        uid: u.uid,
        email: u.email!,
        pseudo: (data.pseudo as string) ?? u.displayName ?? "",
        role: ((data.role as UserRole) ?? "user") as UserRole,
        totalPoints: (data.totalPoints as number) ?? 0,
        exactScoresCount: (data.exactScoresCount as number) ?? 0,
        correctWinnerCount: (data.correctWinnerCount as number) ?? 0,
        predictionsCount: (data.predictionsCount as number) ?? 0,
        createdAt: data.createdAt?.toDate?.() ?? new Date(),
        updatedAt: data.updatedAt?.toDate?.() ?? new Date(),
      };
    })
    .sort((a, b) => b.totalPoints - a.totalPoints);
}
