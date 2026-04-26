export type TournamentType = 'league' | 'knockout';
export type TournamentStatus = 'upcoming' | 'live' | 'completed';
export type MatchStatus = 'scheduled' | 'live' | 'finished';
export type MatchEventType = 'goal' | 'yellow_card' | 'red_card';

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
}

export interface Team {
  id: string;
  name: string;
  logoURL?: string;
  captainId?: string;
  tournamentId: string;
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
}

export interface MatchEvent {
  id: string;
  matchId: string;
  type: MatchEventType;
  playerId: string;
  teamId: string;
  minute: number;
  timestamp: string;
}
