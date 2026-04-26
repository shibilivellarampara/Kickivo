export type TournamentType = 'league' | 'knockout' | 'league_playoff';
export type TournamentStatus = 'upcoming' | 'live' | 'completed';
export type MatchStatus = 'scheduled' | 'live' | 'finished';
export type MatchEventType = 'goal' | 'yellow_card' | 'red_card' | 'substitution';

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
}

export interface Team {
  id: string;
  name: string;
  logoURL?: string;
  captainId?: string;
  creatorId?: string;
  tournamentId: string;
  group?: string; // e.g. "Group A", "Group B" etc.
}

export interface Match {
  id: string;
  tournamentId: string;
  teamAId: string;
  teamBId: string;
  scoreA: number;
  scoreB: number;
  status: MatchStatus;
  startTime?: string;
  group?: string; // Optional group name for matches
  timerStartTime?: any; // Timestamp
  elapsedTimeOnPause?: number; // in seconds
  isTimerRunning?: boolean;
}

export type GoalType = 'open_goal' | 'header' | 'penalty' | 'own_goal';

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
}
