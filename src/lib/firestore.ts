import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  writeBatch,
  increment,
  type QueryConstraint,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Match, Prediction, UserProfile, Team } from "@/types";

// --- Helpers ---
function fromTimestamp(ts: Timestamp | Date | undefined): Date {
  if (!ts) return new Date();
  if (ts instanceof Timestamp) return ts.toDate();
  return ts;
}

// --- Users ---
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    uid: snap.id,
    email: d.email,
    pseudo: d.pseudo,
    role: d.role ?? "user",
    totalPoints: d.totalPoints ?? 0,
    exactScoresCount: d.exactScoresCount ?? 0,
    correctWinnerCount: d.correctWinnerCount ?? 0,
    predictionsCount: d.predictionsCount ?? 0,
    createdAt: fromTimestamp(d.createdAt),
    updatedAt: fromTimestamp(d.updatedAt),
  };
}

export async function createUserProfile(
  uid: string,
  email: string,
  pseudo: string
): Promise<void> {
  await setDoc(doc(db, "users", uid), {
    email,
    pseudo,
    role: "user",
    totalPoints: 0,
    exactScoresCount: 0,
    correctWinnerCount: 0,
    predictionsCount: 0,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
}

export function subscribeLeaderboard(
  callback: (users: UserProfile[]) => void,
  onError?: (err: Error) => void
) {
  return onSnapshot(
    query(
      collection(db, "users"),
      orderBy("totalPoints", "desc")
    ),
    (snap) => {
      const users = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            uid: d.id,
            email: data.email,
            pseudo: data.pseudo,
            role: data.role ?? "user",
            totalPoints: data.totalPoints ?? 0,
            exactScoresCount: data.exactScoresCount ?? 0,
            correctWinnerCount: data.correctWinnerCount ?? 0,
            predictionsCount: data.predictionsCount ?? 0,
            createdAt: fromTimestamp(data.createdAt),
            updatedAt: fromTimestamp(data.updatedAt),
          } as UserProfile;
        })
        .sort((a, b) =>
          b.totalPoints !== a.totalPoints
            ? b.totalPoints - a.totalPoints
            : b.exactScoresCount - a.exactScoresCount
        );
      callback(users);
    },
    (err) => {
      console.error("subscribeLeaderboard:", err);
      onError?.(err);
    }
  );
}

// --- Matches ---
function matchFromDoc(d: { id: string; data: () => Record<string, unknown> }): Match {
  const data = d.data() as Record<string, unknown>;
  return {
    id: d.id,
    apiMatchId: data.apiMatchId as string | undefined,
    phase: data.phase as Match["phase"],
    groupCode: data.groupCode as string | undefined,
    homeTeamId: data.homeTeamId as string,
    awayTeamId: data.awayTeamId as string,
    homeTeam: data.homeTeam as Team,
    awayTeam: data.awayTeam as Team,
    stadiumName: data.stadiumName as string,
    city: data.city as string,
    kickoffUtc: fromTimestamp(data.kickoffUtc as Timestamp),
    lockAtUtc: fromTimestamp(data.lockAtUtc as Timestamp),
    status: data.status as Match["status"],
    homeScore: data.homeScore != null ? (data.homeScore as number) : null,
    awayScore: data.awayScore != null ? (data.awayScore as number) : null,
    qualifiedTeamId: (data.qualifiedTeamId as string | null) ?? null,
    isFinished: (data.isFinished as boolean) ?? false,
  };
}

export function subscribeMatches(
  callback: (matches: Match[]) => void,
  constraints: QueryConstraint[] = []
) {
  return onSnapshot(
    query(
      collection(db, "matches"),
      orderBy("kickoffUtc", "asc"),
      ...constraints
    ),
    (snap) => {
      callback(snap.docs.map(matchFromDoc));
    }
  );
}

export async function getMatches(): Promise<Match[]> {
  const snap = await getDocs(
    query(collection(db, "matches"), orderBy("kickoffUtc", "asc"))
  );
  return snap.docs.map(matchFromDoc);
}

export async function setMatchResult(
  matchId: string,
  homeScore: number,
  awayScore: number,
  qualifiedTeamId: string | null
): Promise<void> {
  await updateDoc(doc(db, "matches", matchId), {
    homeScore,
    awayScore,
    qualifiedTeamId,
    isFinished: true,
    status: "finished",
  });
}

export async function updateMatchStatus(
  matchId: string,
  status: Match["status"]
): Promise<void> {
  await updateDoc(doc(db, "matches", matchId), { status });
}

export async function seedMatches(matches: Omit<Match, "id">[]): Promise<void> {
  const batch = writeBatch(db);
  matches.forEach((m) => {
    const ref = doc(collection(db, "matches"));
    batch.set(ref, {
      ...m,
      kickoffUtc: Timestamp.fromDate(m.kickoffUtc),
      lockAtUtc: Timestamp.fromDate(m.lockAtUtc),
    });
  });
  await batch.commit();
}

// --- Predictions ---
export function predictionId(userId: string, matchId: string) {
  return `${userId}_${matchId}`;
}

export async function getPrediction(
  userId: string,
  matchId: string
): Promise<Prediction | null> {
  const snap = await getDoc(
    doc(db, "predictions", predictionId(userId, matchId))
  );
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    id: snap.id,
    userId: d.userId,
    matchId: d.matchId,
    predictedHomeScore: d.predictedHomeScore ?? null,
    predictedAwayScore: d.predictedAwayScore ?? null,
    predictedQualifiedTeamId: d.predictedQualifiedTeamId ?? null,
    pointsAwarded: d.pointsAwarded ?? null,
    isAiGenerated: d.isAiGenerated ?? false,
    aiMethod: d.aiMethod,
    createdAt: fromTimestamp(d.createdAt),
    updatedAt: fromTimestamp(d.updatedAt),
  };
}

export function subscribeUserPredictions(
  userId: string,
  callback: (predictions: Prediction[]) => void
) {
  return onSnapshot(
    query(collection(db, "predictions"), where("userId", "==", userId)),
    (snap) => {
      const preds = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          userId: data.userId,
          matchId: data.matchId,
          predictedHomeScore: data.predictedHomeScore ?? null,
          predictedAwayScore: data.predictedAwayScore ?? null,
          predictedQualifiedTeamId: data.predictedQualifiedTeamId ?? null,
          pointsAwarded: data.pointsAwarded ?? null,
          isAiGenerated: data.isAiGenerated ?? false,
          aiMethod: data.aiMethod,
          createdAt: fromTimestamp(data.createdAt),
          updatedAt: fromTimestamp(data.updatedAt),
        } as Prediction;
      });
      callback(preds);
    }
  );
}

export async function savePrediction(
  userId: string,
  matchId: string,
  lockAtUtc: Date,
  predictedHomeScore: number,
  predictedAwayScore: number,
  predictedQualifiedTeamId: string | null,
  isAiGenerated = false,
  aiMethod?: string
): Promise<void> {
  if (new Date() >= lockAtUtc) {
    throw new Error("Ce match est verrouillé — pronostic impossible.");
  }
  if (predictedHomeScore < 0 || predictedAwayScore < 0) {
    throw new Error("Score invalide.");
  }

  const id = predictionId(userId, matchId);
  const existing = await getDoc(doc(db, "predictions", id));
  const now = Timestamp.now();
  const isNew = !existing.exists();

  await setDoc(doc(db, "predictions", id), {
    userId,
    matchId,
    predictedHomeScore,
    predictedAwayScore,
    predictedQualifiedTeamId,
    pointsAwarded: null,
    isAiGenerated,
    ...(aiMethod ? { aiMethod } : {}),
    createdAt: isNew ? now : existing.data().createdAt,
    updatedAt: now,
  });

  if (isNew) {
    await updateDoc(doc(db, "users", userId), {
      predictionsCount: increment(1),
    });
  }
}

// --- Score recalculation ---
export async function recalculateAllPoints(): Promise<void> {
  const [matchesSnap, predsSnap, usersSnap] = await Promise.all([
    getDocs(collection(db, "matches")),
    getDocs(collection(db, "predictions")),
    getDocs(collection(db, "users")),
  ]);

  const matches = new Map(matchesSnap.docs.map((d) => [d.id, matchFromDoc(d)]));
  const userPoints = new Map<
    string,
    { total: number; exact: number; winner: number; predictions: number }
  >();

  usersSnap.docs.forEach((d) => {
    userPoints.set(d.id, { total: 0, exact: 0, winner: 0, predictions: 0 });
  });

  const batch = writeBatch(db);

  predsSnap.docs.forEach((predDoc) => {
    const pred = predDoc.data();
    const uid = pred.userId;
    if (userPoints.has(uid)) {
      userPoints.get(uid)!.predictions += 1;
    }

    const match = matches.get(pred.matchId);
    if (!match || !match.isFinished) return;

    let points = 0;
    const ph = pred.predictedHomeScore;
    const pa = pred.predictedAwayScore;
    const rh = match.homeScore;
    const ra = match.awayScore;

    if (rh !== null && ra !== null && ph !== null && pa !== null) {
      if (match.phase === "group") {
        if (ph === rh && pa === ra) points = 3;
        else if (Math.sign(ph - pa) === Math.sign(rh - ra)) points = 1;
      } else if (match.phase === "final") {
        const exact = ph === rh && pa === ra;
        const correct = pred.predictedQualifiedTeamId === match.qualifiedTeamId;
        if (exact && correct) points = 12;
        else if (correct) points = 3;
      } else {
        const exact = ph === rh && pa === ra;
        const correct = pred.predictedQualifiedTeamId === match.qualifiedTeamId;
        if (exact && correct) points = 6;
        else if (correct) points = 2;
      }
    }

    batch.update(doc(db, "predictions", predDoc.id), { pointsAwarded: points });

    if (userPoints.has(uid)) {
      const u = userPoints.get(uid)!;
      u.total += points;
      if (points === 3 || points === 6 || points === 12) u.exact += 1;
      else if (points > 0) u.winner += 1;
    }
  });

  userPoints.forEach((pts, uid) => {
    batch.update(doc(db, "users", uid), {
      totalPoints: pts.total,
      exactScoresCount: pts.exact,
      correctWinnerCount: pts.winner,
      predictionsCount: pts.predictions,
      updatedAt: Timestamp.now(),
    });
  });

  await batch.commit();
}

// --- Admin: fix user profiles missing numeric fields ---
export async function fixUserProfiles(): Promise<number> {
  const snap = await getDocs(collection(db, "users"));
  const batch = writeBatch(db);
  let fixed = 0;
  snap.docs.forEach((d) => {
    const data = d.data();
    const needs =
      data.totalPoints === undefined ||
      data.exactScoresCount === undefined ||
      data.correctWinnerCount === undefined;
    if (needs) {
      batch.update(doc(db, "users", d.id), {
        totalPoints: data.totalPoints ?? 0,
        exactScoresCount: data.exactScoresCount ?? 0,
        correctWinnerCount: data.correctWinnerCount ?? 0,
        updatedAt: Timestamp.now(),
      });
      fixed++;
    }
  });
  await batch.commit();
  return fixed;
}

// --- Admin: recalculate predictionsCount for all existing users ---
export async function fixPredictionsCounts(): Promise<number> {
  const [predsSnap, usersSnap] = await Promise.all([
    getDocs(collection(db, "predictions")),
    getDocs(collection(db, "users")),
  ]);

  const counts = new Map<string, number>();
  usersSnap.docs.forEach((d) => counts.set(d.id, 0));
  predsSnap.docs.forEach((d) => {
    const uid = d.data().userId as string;
    if (counts.has(uid)) counts.set(uid, (counts.get(uid) ?? 0) + 1);
  });

  const batch = writeBatch(db);
  counts.forEach((count, uid) => {
    batch.update(doc(db, "users", uid), {
      predictionsCount: count,
      updatedAt: Timestamp.now(),
    });
  });
  await batch.commit();
  return predsSnap.docs.length;
}

// --- AI Predictions status ---
export async function getAiPredictionStatus(): Promise<Map<string, number>> {
  const snap = await getDocs(
    query(collection(db, "matches"), where("phase", "==", "group"))
  );
  const status = new Map<string, number>();
  snap.docs.forEach((d) => {
    const data = d.data();
    const g = data.groupCode as string;
    if (g) {
      if (!status.has(g)) status.set(g, 0);
      if (data.aiPrediction) status.set(g, (status.get(g) ?? 0) + 1);
    }
  });
  return status;
}

// --- Admin: get all users ---
export async function getAllUsers(): Promise<UserProfile[]> {
  const snap = await getDocs(
    query(collection(db, "users"), orderBy("totalPoints", "desc"))
  );
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      uid: d.id,
      email: data.email,
      pseudo: data.pseudo,
      role: data.role ?? "user",
      totalPoints: data.totalPoints ?? 0,
      exactScoresCount: data.exactScoresCount ?? 0,
      correctWinnerCount: data.correctWinnerCount ?? 0,
      predictionsCount: data.predictionsCount ?? 0,
      createdAt: fromTimestamp(data.createdAt),
      updatedAt: fromTimestamp(data.updatedAt),
    } as UserProfile;
  });
}
