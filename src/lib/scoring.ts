import type { Match, Prediction } from "@/types";

export interface ScoreOutcome {
  /** Points awarded for this prediction. */
  points: number;
  /** Exact score (home AND away correct). */
  exact: boolean;
  /** Correct outcome (winner or draw) — true whenever points > 0. */
  correct: boolean;
}

/**
 * Source de vérité unique du barème — utilisée par l'UI, le recalcul client et
 * le recalcul serveur. Le score repose uniquement sur les buts prédits vs réels
 * (l'équipe qualifiée n'entre plus en compte) :
 *   - Poules :  3 (score exact) / 1 (bon résultat, nul compris) / 0
 *   - 16es → demies : 6 (score exact) / 3 (bon résultat) / 0
 *   - Finale : 12 (score exact) / 3 (bon résultat) / 0  (bonus conservé)
 */
export function scorePrediction(
  phase: Match["phase"],
  ph: number | null,
  pa: number | null,
  rh: number | null,
  ra: number | null
): ScoreOutcome {
  if (ph === null || pa === null || rh === null || ra === null) {
    return { points: 0, exact: false, correct: false };
  }

  const exact = ph === rh && pa === ra;
  const correctOutcome = Math.sign(ph - pa) === Math.sign(rh - ra);

  const [exactPts, outcomePts] =
    phase === "group" ? [3, 1] : phase === "final" ? [12, 3] : [6, 3];

  if (exact) return { points: exactPts, exact: true, correct: true };
  if (correctOutcome) return { points: outcomePts, exact: false, correct: true };
  return { points: 0, exact: false, correct: false };
}

export function calculatePoints(prediction: Prediction, match: Match): number {
  if (!match.isFinished) return 0;
  return scorePrediction(
    match.phase,
    prediction.predictedHomeScore,
    prediction.predictedAwayScore,
    match.homeScore,
    match.awayScore
  ).points;
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
