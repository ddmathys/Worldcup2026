export type UserRole = "user" | "admin";
export type MatchPhase = "group" | "r32" | "r16" | "qf" | "sf" | "final";
export type MatchStatus = "scheduled" | "open" | "locked" | "live" | "finished";

export interface Team {
  id: string;
  name: string;
  code: string;
  groupCode?: string;
}

export interface Match {
  id: string;
  apiMatchId?: string;
  phase: MatchPhase;
  groupCode?: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeam: Team;
  awayTeam: Team;
  stadiumName: string;
  city: string;
  kickoffUtc: Date;
  lockAtUtc: Date;
  status: MatchStatus;
  homeScore: number | null;
  awayScore: number | null;
  qualifiedTeamId: string | null;
  isFinished: boolean;
}

export interface Prediction {
  id: string;
  userId: string;
  matchId: string;
  predictedHomeScore: number | null;
  predictedAwayScore: number | null;
  predictedQualifiedTeamId: string | null;
  pointsAwarded: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfile {
  uid: string;
  email: string;
  pseudo: string;
  role: UserRole;
  totalPoints: number;
  exactScoresCount: number;
  correctWinnerCount: number;
  predictionsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface RankingEntry {
  rank: number;
  user: UserProfile;
  totalPoints: number;
  exactScoresCount: number;
  correctWinnerCount: number;
}
