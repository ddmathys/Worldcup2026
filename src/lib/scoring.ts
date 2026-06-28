import type { Match, Prediction } from "@/types";

export interface ScoreOutcome {
  /** Points awarded for this prediction (bonus qualifié compris). */
  points: number;
  /** Exact score (home AND away correct). */
  exact: boolean;
  /** Correct outcome (winner or draw) — true whenever the score part scores. */
  correct: boolean;
  /** Bonus accordé pour la bonne équipe qualifiée (t.a.b. inclus). */
  qualifierBonus: boolean;
}

/** Bonus pour avoir prédit la bonne équipe qualifiée (tirs au but inclus). */
export const QUALIFIER_BONUS = 2;

/** Contexte « équipe qualifiée » pour le bonus en phase finale. */
export interface QualifierContext {
  homeTeamId: string;
  awayTeamId: string;
  predictedQualifiedTeamId: string | null;
  actualQualifiedTeamId: string | null;
}

// Équipe qui se qualifie : le vainqueur du temps réglementaire, ou — en cas de
// nul (séance de t.a.b.) — l'équipe désignée explicitement.
function qualifierFromScore(
  home: number,
  away: number,
  homeTeamId: string,
  awayTeamId: string,
  explicit: string | null
): string | null {
  if (home > away) return homeTeamId;
  if (away > home) return awayTeamId;
  return explicit ?? null;
}

/**
 * Source de vérité unique du barème — utilisée par l'UI, le recalcul client et
 * le recalcul serveur.
 *   - Poules :  3 (score exact) / 1 (bon résultat, nul compris) / 0
 *   - 16es → demies : 6 (score exact) / 3 (bon résultat) / 0
 *   - Finale : 12 (score exact) / 3 (bon résultat) / 0
 *   - Phase finale : +2 si la bonne équipe qualifiée est prédite (t.a.b. inclus).
 */
export function scorePrediction(
  phase: Match["phase"],
  ph: number | null,
  pa: number | null,
  rh: number | null,
  ra: number | null,
  qualifier?: QualifierContext
): ScoreOutcome {
  if (ph === null || pa === null || rh === null || ra === null) {
    return { points: 0, exact: false, correct: false, qualifierBonus: false };
  }

  const exact = ph === rh && pa === ra;
  const correctOutcome = Math.sign(ph - pa) === Math.sign(rh - ra);

  const [exactPts, outcomePts] =
    phase === "group" ? [3, 1] : phase === "final" ? [12, 3] : [6, 3];

  const base = exact ? exactPts : correctOutcome ? outcomePts : 0;

  // Bonus « équipe qualifiée » uniquement en phase finale.
  let qualifierBonus = false;
  if (phase !== "group" && qualifier) {
    const predQ = qualifierFromScore(ph, pa, qualifier.homeTeamId, qualifier.awayTeamId, qualifier.predictedQualifiedTeamId);
    const actQ = qualifierFromScore(rh, ra, qualifier.homeTeamId, qualifier.awayTeamId, qualifier.actualQualifiedTeamId);
    if (predQ && actQ && predQ === actQ) qualifierBonus = true;
  }

  return {
    points: base + (qualifierBonus ? QUALIFIER_BONUS : 0),
    exact,
    correct: correctOutcome,
    qualifierBonus,
  };
}

export function calculatePoints(prediction: Prediction, match: Match): number {
  if (!match.isFinished) return 0;
  return scorePrediction(
    match.phase,
    prediction.predictedHomeScore,
    prediction.predictedAwayScore,
    match.homeScore,
    match.awayScore,
    {
      homeTeamId: match.homeTeamId,
      awayTeamId: match.awayTeamId,
      predictedQualifiedTeamId: prediction.predictedQualifiedTeamId,
      actualQualifiedTeamId: match.qualifiedTeamId,
    }
  ).points;
}

export function getMaxPoints(phase: Match["phase"]): number {
  if (phase === "group") return 3;
  if (phase === "final") return 12 + QUALIFIER_BONUS;
  return 6 + QUALIFIER_BONUS;
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
