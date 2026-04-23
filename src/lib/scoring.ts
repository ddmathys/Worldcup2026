import type { Match, Prediction } from "@/types";

export function calculatePoints(prediction: Prediction, match: Match): number {
  if (
    match.homeScore === null ||
    match.awayScore === null ||
    !match.isFinished ||
    prediction.predictedHomeScore === null ||
    prediction.predictedAwayScore === null
  ) {
    return 0;
  }

  const ph = prediction.predictedHomeScore;
  const pa = prediction.predictedAwayScore;
  const rh = match.homeScore;
  const ra = match.awayScore;

  if (match.phase === "group") {
    if (ph === rh && pa === ra) return 3;
    if (Math.sign(ph - pa) === Math.sign(rh - ra)) return 1;
    return 0;
  }

  if (match.phase === "final") {
    const exactScore = ph === rh && pa === ra;
    const correctQualified =
      prediction.predictedQualifiedTeamId === match.qualifiedTeamId;
    if (exactScore && correctQualified) return 12;
    if (correctQualified) return 3;
    return 0;
  }

  // r32, r16, qf, sf
  const exactScore = ph === rh && pa === ra;
  const correctQualified =
    prediction.predictedQualifiedTeamId === match.qualifiedTeamId;
  if (exactScore && correctQualified) return 6;
  if (correctQualified) return 2;
  return 0;
}

export function getMaxPoints(phase: Match["phase"]): number {
  if (phase === "group") return 3;
  if (phase === "final") return 12;
  return 6;
}

export function isLocked(lockAtUtc: Date): boolean {
  return new Date() >= lockAtUtc;
}

export function getMatchStatus(match: {
  kickoffUtc: Date;
  lockAtUtc: Date;
  isFinished: boolean;
}): "open" | "soon" | "locked" | "live" | "finished" {
  if (match.isFinished) return "finished";
  const now = new Date();
  if (now >= match.kickoffUtc) return "live";
  if (now >= match.lockAtUtc) return "locked";
  const twoHours = 2 * 60 * 60 * 1000;
  if (match.kickoffUtc.getTime() - now.getTime() <= twoHours * 2)
    return "soon";
  return "open";
}
