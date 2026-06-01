export type TournamentType = 'league' | 'knockout' | 'league_playoff';
export type TournamentStatus = 'upcoming' | 'live' | 'completed';
export type MatchStatus = 'scheduled' | 'live' | 'finished';
export type MatchEventType = 'goal' | 'yellow_card' | 'red_card' | 'substitution' | 'half_time' | 'full_time' | 'aet' | 'penalty_kick' | 'end';

export interface User {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  role: 'admin' | 'user';
}

export interface Tournament {
  id: string;
  name: string;
  description: string;
  type: TournamentType;
  creatorId: string;
  status: TournamentStatus;
  createdAt: string;
  numberOfGroups?: number;
  advancingPerGroup?: number;
  maxTeams?: number;
  matchesPerDay?: number;
  homeAwayGroup?: boolean;
  homeAwayKnockout?: boolean;
  startTime?: string; // HH:mm
  matchDuration?: number; // minutes
  hasLosersFinal?: boolean;
  advancementType?: 'standard' | 'qualifier';
}

export interface Team {
  id: string;
  name: string;
  logoURL?: string;
  captainId?: string;
  creatorId?: string;
  tournamentId: string;
  group?: string; // e.g. "Group A", "Group B" etc.
  shortName?: string;
}

export interface Match {
  id: string;
  tournamentId: string;
  teamAId: string;
  teamBId: string;
  scoreA: number;
  scoreB: number;
  pensA?: number; // Penalty shootout score for team A
  pensB?: number; // Penalty shootout score for team B
  status: MatchStatus;
  startTime?: string;
  group?: string; // Optional group name for matches
  timerStartTime?: any; // Timestamp
  elapsedTimeOnPause?: number; // in seconds
  isTimerRunning?: boolean;
  manOfTheMatchId?: string;
  round?: string; // e.g. "Semi-final", "Final"
  placeholderA?: string; // e.g. "Winner QF1"
  placeholderB?: string; // e.g. "Winner QF2"
  successorMatchId?: string; // Match to move winner to
  successorSide?: 'A' | 'B'; // Which side of successor match to populate
  loserSuccessorMatchId?: string; // Match to move loser to (e.g. Losers Final)
  loserSuccessorSide?: 'A' | 'B';
  kickoff?: any; // Firestore Timestamp
  leg?: 1 | 2;
  tieId?: string;
  createdAt?: any;
  updatedAt?: any;
}

export type GoalType = 'open_goal' | 'header' | 'penalty' | 'own_goal' | 'free_kick';

export interface Player {
  id: string;
  name: string;
  number?: number;
  position?: string;
  teamId: string;
  tournamentId?: string;
  userId?: string; // Links to a registered user
  goals?: number;
  assists?: number;
  matchesPlayed?: number;
  yellowCards?: number;
  redCards?: number;
}

export interface MatchEvent {
  id: string;
  matchId: string;
  tournamentId?: string;
  type: MatchEventType;
  playerId: string;
  userId?: string; // Optional: denormalized for easier career stats query
  assistantId?: string;
  assistantUserId?: string; // Links to assistant registered user
  goalType?: GoalType;
  teamId: string;
  minute: number;
  timestamp: string;
  isPenaltyShootout?: boolean; // True if goal was scored during a penalty shootout (tiebreaker)
  penaltyResult?: 'goal' | 'miss';
}
