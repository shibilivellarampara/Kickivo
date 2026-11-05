import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  updateDoc,
  deleteDoc,
  serverTimestamp, 
  doc, 
  collectionGroup,
  where,
  Timestamp,
  getDoc,
  setDoc,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { 
  Trophy, 
  Users, 
  Calendar, 
  RefreshCw, 
  ChevronRight, 
  Heart, 
  X, 
  Shield, 
  Plus, 
  Footprints,
  Share2,
  Check,
  UserCheck,
  Copy,
  Trash2,
  Link as LinkIcon
} from 'lucide-react';
import { db, OperationType, handleFirestoreError } from '../../lib/firebase';
import { DEFAULT_EMBLEMS, renderTeamLogo } from '../../utils/avatarUtils';
import { Tournament, TournamentStatus, Match, Team, Player, MatchEvent, User } from '../../types';
import { SoccerIcon } from '../common/Icons';
import { formatTeamName, getTeamShortName } from '../../utils/football';
import { MatchScoringView } from '../Match/MatchScoringView';
import { TeamDetailView } from './TeamDetailView';
import { TeamSlot } from './TeamSlot';
import { BracketMatch } from './BracketMatch';
import { MatchesModule } from './MatchesModule';
import { PointTableModule } from './PointTableModule';
import { LeaderboardModule } from './LeaderboardModule';
import { User as FirebaseUser } from 'firebase/auth';
import { PlayerProfileModal } from './PlayerProfileModal';

interface TournamentViewProps {
  tournament: Tournament;
  user: FirebaseUser | null;
  onBack: () => void;
  onError: (err: any) => void;
  notify: (msg: string) => void;
}

export const TournamentView: React.FC<TournamentViewProps> = ({ 
  tournament, 
  user, 
  onBack, 
  onError, 
  notify 
}) => {
  const [activeTab, setActiveTab] = useState<'matches' | 'teams' | 'standings' | 'stats' | 'knockout'>('matches');
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [selectedProfilePlayer, setSelectedProfilePlayer] = useState<Player | null>(null);
  const [showAddTeam, setShowAddTeam] = useState(false);
  const [showAddMatch, setShowAddMatch] = useState(false);
  const [selectedEmblemId, setSelectedEmblemId] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isShortening, setIsShortening] = useState(false);
  const [showCoHostModal, setShowCoHostModal] = useState(false);
  const [copiedCoHostLink, setCopiedCoHostLink] = useState(false);
  const [isGeneratingCoHostToken, setIsGeneratingCoHostToken] = useState(false);
  const [pendingInviteToken, setPendingInviteToken] = useState<string | null>(null);

  const isCreator = user?.uid === tournament.creatorId;
  const isEditor = !!(user?.uid && tournament.editors?.includes(user.uid));
  const canManage = isCreator || isEditor;
  const liveMatches = useMemo(() => matches.filter(m => m.status === 'live'), [matches]);

  const tiesByRound = useMemo(() => {
    const playoffMatches = matches.filter(m => m.group === 'Playoffs' || tournament.type === 'knockout');
    const rounds = ['Round of 64', 'Round of 32', 'Round of 16', 'Qualification', 'Qualifier', 'Playoff', 'Quarter-final', 'Semi-final', 'Losers Final', 'Final'];
    const result: Record<string, Match[][]> = {};
    
    rounds.forEach(r => {
      // Support 'Pre-quarter' as an alias for 'Round of 16'
      const rm = playoffMatches.filter(m => m.round === r || (r === 'Round of 16' && m.round === 'Pre-quarter'));
      if (tournament.homeAwayKnockout && r !== 'Final' && r !== 'Losers Final') {
        const ties: Record<string, Match[]> = {};
        rm.forEach(m => {
          const tid = m.tieId || m.id;
          if (!ties[tid]) ties[tid] = [];
          ties[tid].push(m);
        });
        result[r] = Object.values(ties).sort((a, b) => {
          const timeA = a[0].kickoff?.seconds || a[0].createdAt?.seconds || 0;
          const timeB = b[0].kickoff?.seconds || b[0].createdAt?.seconds || 0;
          return timeA - timeB;
        });
      } else {
        result[r] = rm.map(m => [m]);
      }
    });
    return result;
  }, [matches, tournament.homeAwayKnockout]);

  const allMatchesScheduled = useMemo(() => {
    if (teams.length < 2) return false;
    if (tournament.type === 'league') {
      const base = (teams.length * (teams.length - 1)) / 2;
      const expected = tournament.homeAwayGroup ? base * 2 : base;
      return matches.length >= expected;
    }
    if (tournament.type === 'league_playoff') {
      const numGroups = tournament.numberOfGroups || 2;
      let totalExpected = 0;
      for (let i = 0; i < numGroups; i++) {
        const gName = `Group ${String.fromCharCode(65 + i)}`;
        const gTeams = teams.filter(t => t.group === gName).length;
        if (gTeams >= 2) {
          const base = (gTeams * (gTeams - 1)) / 2;
          totalExpected += tournament.homeAwayGroup ? base * 2 : base;
        }
      }
      const hasPlayoffs = matches.some(m => m.group === 'Playoffs');
      return (matches.length >= totalExpected && totalExpected > 0) || hasPlayoffs;
    }
    if (tournament.type === 'knockout') {
      return matches.length > 0;
    }
    return false;
  }, [teams, matches, tournament]);

  useEffect(() => {
    const teamsQ = query(collection(db, `/tournaments/${tournament.id}/teams`));
    const unsubscribeTeams = onSnapshot(teamsQ, (s) => {
      setTeams(s.docs.map(d => ({ id: d.id, ...d.data() } as Team)));
    }, (err) => {
      onError(err);
      handleFirestoreError(err, OperationType.GET, 'teams');
    });

    const matchesQ = query(collection(db, `/tournaments/${tournament.id}/matches`));
    const unsubscribeMatches = onSnapshot(matchesQ, (s) => {
      setMatches(s.docs.map(d => ({ id: d.id, ...d.data() } as Match)));
    }, (err) => {
      onError(err);
      handleFirestoreError(err, OperationType.GET, 'matches');
    });

    const q = query(collectionGroup(db, 'events'), where('tournamentId', '==', tournament.id));
    const unsubscribeEvents = onSnapshot(q, (s) => {
      setEvents(s.docs.map(d => ({ id: d.id, ...d.data() } as MatchEvent)));
    }, (err) => {
      onError(err);
      handleFirestoreError(err, OperationType.GET, 'events');
    });

    const playersQ = query(collectionGroup(db, 'players'), where('tournamentId', '==', tournament.id));
    const unsubscribePlayers = onSnapshot(playersQ, (s) => {
      setAllPlayers(s.docs.map(d => ({ 
        id: d.id, 
        tournamentId: tournament.id,
        ...d.data() 
      } as Player)));
    }, (err) => {
      console.warn("Failed to fetch all players:", err);
    });

    return () => {
      unsubscribeMatches();
      unsubscribeTeams();
      unsubscribeEvents();
      unsubscribePlayers();
    };
  }, [tournament.id, onError]);

  // Handle subtle page back or subview escape on swipe left to right
  useEffect(() => {
    const handleSwipeBack = (e: Event) => {
      if (selectedMatch) {
        e.preventDefault();
        setSelectedMatch(null);
      } else if (selectedTeam) {
        e.preventDefault();
        setSelectedTeam(null);
      } else if (showAddTeam) {
        e.preventDefault();
        setShowAddTeam(false);
      } else if (showAddMatch) {
        e.preventDefault();
        setShowAddMatch(false);
      } else {
        e.preventDefault();
        onBack();
      }
    };
    window.addEventListener('swipe-back', handleSwipeBack);
    return () => {
      window.removeEventListener('swipe-back', handleSwipeBack);
    };
  }, [selectedMatch, selectedTeam, showAddTeam, showAddMatch, onBack]);

  // Auto-manage tournament status
  useEffect(() => {
    if (!isCreator || matches.length === 0) return;
    
    const startedOrFinished = matches.some(m => m.status !== 'scheduled');
    const finalFinished = matches.some(m => m.round === 'Final' && m.status === 'finished');
    const allFinished = matches.length > 0 && matches.every(m => m.status === 'finished');
    
    const isCompleted = (tournament.type === 'league') ? allFinished : finalFinished;
    
    let targetStatus: TournamentStatus = 'upcoming';
    if (isCompleted) {
      targetStatus = 'completed';
    } else if (startedOrFinished) {
      targetStatus = 'live';
    } else {
      targetStatus = 'upcoming';
    }
    
    if (targetStatus !== tournament.status) {
      const updateStatus = async () => {
        try {
          await updateDoc(doc(db, `tournaments/${tournament.id}`), { 
            status: targetStatus, 
            updatedAt: serverTimestamp() 
          });
        } catch (err) {
          console.error("Error updating tournament status:", err);
        }
      };
      updateStatus();
    }
  }, [matches, tournament.status, tournament.id, tournament.type, isCreator]);

  // Check URL query parameters for co-host / editor invite token
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const key = params.get('editorKey');
    if (key) {
      setPendingInviteToken(key);
    }
  }, []);

  // Auto-generate invite token if creator opens modal and none exists yet
  useEffect(() => {
    if (showCoHostModal && isCreator && !tournament.editorInviteToken) {
      const initToken = async () => {
        try {
          setIsGeneratingCoHostToken(true);
          const token = Math.random().toString(36).substring(2, 12) + Math.random().toString(36).substring(2, 8);
          await updateDoc(doc(db, 'tournaments', tournament.id), {
            editorInviteToken: token
          });
        } catch (e) {
          console.error("Failed to generate editor token", e);
        } finally {
          setIsGeneratingCoHostToken(false);
        }
      };
      initToken();
    }
  }, [showCoHostModal, isCreator, tournament.editorInviteToken, tournament.id]);

  const acceptEditorInvite = async () => {
    if (!user) {
      (window as any).triggerLogin?.();
      return;
    }
    if (!pendingInviteToken) return;

    if (tournament.editorInviteToken && tournament.editorInviteToken === pendingInviteToken) {
      try {
        const tRef = doc(db, 'tournaments', tournament.id);
        const newMember = {
          uid: user.uid,
          displayName: user.displayName || 'Co-Host',
          email: user.email || '',
          photoURL: user.photoURL || '',
          addedAt: new Date().toISOString()
        };
        await updateDoc(tRef, {
          editors: arrayUnion(user.uid),
          editorMembers: arrayUnion(newMember)
        });
        notify(`Success! You now have co-host editing access to ${tournament.name}.`);
        setPendingInviteToken(null);
        const url = new URL(window.location.href);
        url.searchParams.delete('editorKey');
        window.history.replaceState({}, '', url.toString());
      } catch (err) {
        console.error("Error joining as co-host:", err);
        handleFirestoreError(err, OperationType.UPDATE, `tournaments/${tournament.id}`);
      }
    } else {
      notify('This Co-Host invitation link is invalid or has expired.');
    }
  };

  const regenerateEditorToken = async () => {
    if (!isCreator) return;
    try {
      setIsGeneratingCoHostToken(true);
      const token = Math.random().toString(36).substring(2, 12) + Math.random().toString(36).substring(2, 8);
      await updateDoc(doc(db, 'tournaments', tournament.id), {
        editorInviteToken: token
      });
      notify("New co-host link created. Prior link is now revoked.");
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `tournaments/${tournament.id}`);
    } finally {
      setIsGeneratingCoHostToken(false);
    }
  };

  const removeCoHost = async (uid: string) => {
    if (!isCreator) return;
    try {
      const memberToRemove = tournament.editorMembers?.find(m => m.uid === uid);
      const tRef = doc(db, 'tournaments', tournament.id);
      const updateData: any = {
        editors: arrayRemove(uid)
      };
      if (memberToRemove) {
        updateData.editorMembers = arrayRemove(memberToRemove);
      }
      await updateDoc(tRef, updateData);
      notify("Co-host removed.");
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `tournaments/${tournament.id}`);
    }
  };

  // Helper to remove undefined values before Firestore writes
  const cleanObj = (obj: any) => {
    const newObj = { ...obj };
    Object.keys(newObj).forEach(key => {
      if (newObj[key] === undefined) delete newObj[key];
    });
    return newObj;
  };

  const generateBrackets = async (sourceTeams: Team[], group: string) => {
    const createM = async (data: any) => (await addDoc(collection(db, `/tournaments/${tournament.id}/matches`), cleanObj({ 
      scoreA: 0, 
      scoreB: 0, 
      status: 'scheduled', 
      tournamentId: tournament.id, 
      group, 
      createdAt: serverTimestamp(), 
      ...data 
    }))).id;

    const createP = async (data: any) => {
      const tieId = `tie-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      const isHomeAway = tournament.homeAwayKnockout && data.round !== 'Final' && data.round !== 'Losers Final';
      
      const id1 = await createM({ ...data, ...(isHomeAway ? { leg: 1, tieId } : {}) });
      if (isHomeAway) {
        const leg2Data = { 
          ...data, 
          leg: 2, 
          tieId,
          ...(data.teamBId ? { teamAId: data.teamBId } : {}),
          ...(data.teamAId ? { teamBId: data.teamAId } : {}),
          ...(data.placeholderB ? { placeholderA: data.placeholderB } : {}),
          ...(data.placeholderA ? { placeholderB: data.placeholderA } : {}),
        };
        const id2 = await createM(leg2Data);
        return { leg1Id: id1, leg2Id: id2 };
      }
      return { leg1Id: id1 };
    };

    const sId = (res: any) => res.leg2Id ? `${res.leg1Id},${res.leg2Id}` : res.leg1Id;
    const shuffledTeams = [...sourceTeams].sort(() => Math.random() - 0.5);
    const count = shuffledTeams.length;

    if (count < 2) return notify('Need at least 2 teams for knockout');

    const getRoundName = (slots: number) => {
      if (slots === 2) return 'Final';
      if (slots === 4) return 'Semi-final';
      if (slots === 8) return 'Quarter-final';
      if (slots === 16) {
        // If 9-13 teams, call it Qualification to reach QF
        if (count > 8 && count <= 13) return 'Qualification';
        return 'Round of 16';
      }
      if (slots === 32) return 'Round of 32';
      return `Round of ${slots}`;
    };

    // 1. Determine bracket size
    const powerCount = Math.ceil(Math.log2(count));
    const totalSlots = Math.pow(2, powerCount);
    const prevPowerOf2 = Math.pow(2, powerCount - 1);
    
    // Number of matches in the first round to reach the next power of 2
    const matchesInFirstRound = count - prevPowerOf2;
    // Number of teams that get a BYE in the first round
    const teamsWithByes = count - (2 * matchesInFirstRound);

    // 2. Build skeleton from Final backwards 
    const roundsMap: any[][] = []; // [roundIdx][matchIdx] 0 is Final
    
    // Create skeleton for all rounds EXCEPT the partial first round
    // We start from powerCount - 2 (e.g. for 9 teams, this is Quarters)
    
    // Final
    const finalRes = await createP({ round: 'Final', placeholderA: 'Winner SF1', placeholderB: 'Winner SF2' });
    roundsMap[0] = [finalRes];

    // Losers Final
    let lfId = '';
    if (tournament.hasLosersFinal) {
      const res = await createP({ round: 'Losers Final', placeholderA: 'Winner LS1', placeholderB: 'Winner LS2' });
      lfId = sId(res);
    }

    // Build rounds up to the one before the partial first round
    for (let r = 1; r < powerCount - 1; r++) {
      const matchesInR = Math.pow(2, r);
      const roundName = getRoundName(matchesInR * 2);
      const prevRoundRes = roundsMap[r - 1];
      const currentRMatches = [];
      for (let m = 0; m < matchesInR; m++) {
        const successor = prevRoundRes[Math.floor(m / 2)];
        const side = m % 2 === 0 ? 'A' : 'B';
        const res = await createP({
          round: roundName,
          successorMatchId: sId(successor),
          successorSide: side,
          ...(roundName === 'Semi-final' && lfId ? { loserSuccessorMatchId: lfId, loserSuccessorSide: side } : {})
        });
        currentRMatches.push(res);
      }
      roundsMap[r] = currentRMatches;
    }

    // Now handle the partial first round and its successor round (the full power-of-2 round)
    const powerOf2RoundIdx = powerCount - 2;
    const powerOf2Matches = roundsMap[powerOf2RoundIdx];
    const firstRoundName = getRoundName(totalSlots);
    
    // Distribute teams: some go to first round, some go directly to powerOf2 round
    const teamsForFirstRound = shuffledTeams.slice(0, matchesInFirstRound * 2);
    const teamsForByes = shuffledTeams.slice(matchesInFirstRound * 2);

    // Create partial first round matches
    for (let i = 0; i < matchesInFirstRound; i++) {
       const tA = teamsForFirstRound[i * 2];
       const tB = teamsForFirstRound[i * 2 + 1];
       const succ = powerOf2Matches[Math.floor(i / 2)];
       const side = i % 2 === 0 ? 'A' : 'B';

       await createP({
         round: firstRoundName,
         teamAId: tA.id,
         teamBId: tB.id,
         successorMatchId: sId(succ),
         successorSide: side
       });
    }

    // Populate the bypass teams directly into the powerOf2 round placeholders/slots
    for (let i = 0; i < teamsForByes.length; i++) {
       const team = teamsForByes[i];
       // The index in powerOf2Matches starts after the slots taken by the partial matches
       // Each partial match occupies 0.5 of a powerOf2 match (since 2 partials = 1 powerOf2 winner)
       const offset = Math.ceil(matchesInFirstRound / 2);
       const matchIdx = offset + Math.floor(i / 2);
       const side = (matchesInFirstRound % 2 === 0) ? (i % 2 === 0 ? 'A' : 'B') : ((i + 1) % 2 === 0 ? 'A' : 'B');
       
       const mRes = powerOf2Matches[matchIdx];
       if (mRes) {
         await updateDoc(doc(db, `/tournaments/${tournament.id}/matches/${mRes.leg1Id}`), {
           [side === 'A' ? 'teamAId' : 'teamBId']: team.id
         });
         if (mRes.leg2Id) {
            await updateDoc(doc(db, `/tournaments/${tournament.id}/matches/${mRes.leg2Id}`), {
              [side === 'A' ? 'teamBId' : 'teamAId']: team.id
            });
         }
       }
    }

    notify(`Knockout bracket (${count} teams) generated!`);
  };

  // Helper to generate fair round-robin rounds using the Circle (Berger) algorithm
  // Every team plays exactly once per round, ensuring 100% distinct teams per round
  const generateRoundRobinRounds = (
    teamIds: string[], 
    homeAndAway: boolean = false, 
    groupName?: string
  ) => {
    if (teamIds.length < 2) return [];

    // Shuffle teams initially for randomized draw
    const pool = [...teamIds].sort(() => Math.random() - 0.5);
    const isOdd = pool.length % 2 !== 0;
    const list: (string | null)[] = isOdd ? [...pool, null] : [...pool];
    const n = list.length;
    const numRounds = n - 1;
    const half = n / 2;

    const rounds: { teamAId: string; teamBId: string; group?: string; round?: string }[][] = [];
    let currentList = [...list];

    for (let r = 0; r < numRounds; r++) {
      const roundMatches: { teamAId: string; teamBId: string; group?: string; round?: string }[] = [];
      for (let i = 0; i < half; i++) {
        const t1 = currentList[i];
        const t2 = currentList[n - 1 - i];

        if (t1 !== null && t2 !== null) {
          const swap = (r + i) % 2 === 1;
          roundMatches.push({
            teamAId: swap ? t2 : t1,
            teamBId: swap ? t1 : t2,
            group: groupName,
            round: `Round ${r + 1}`
          });
        }
      }
      rounds.push(roundMatches);

      // Rotate: index 0 is fixed, remaining n-1 elements rotate clockwise
      const fixed = currentList[0];
      const rotating = currentList.slice(1);
      const last = rotating.pop()!;
      currentList = [fixed, last, ...rotating];
    }

    if (homeAndAway) {
      const secondHalf: { teamAId: string; teamBId: string; group?: string; round?: string }[][] = [];
      for (let r = 0; r < numRounds; r++) {
        secondHalf.push(
          rounds[r].map(m => ({
            teamAId: m.teamBId,
            teamBId: m.teamAId,
            group: groupName,
            round: `Round ${r + numRounds + 1}`
          }))
        );
      }
      return [...rounds, ...secondHalf];
    }

    return rounds;
  };

  const generateAutoSchedule = async () => {
    if (teams.length < 2) return onError('Need at least 2 teams to schedule');
    setIsGenerating(true);
    try {
      const orderedMatches: { teamAId: string; teamBId: string; group?: string; round?: string }[] = [];

      if (tournament.type === 'league_playoff') {
        const numGroups = tournament.numberOfGroups || 2;
        const shuffledTeams = [...teams].sort(() => Math.random() - 0.5);
        for (let i = 0; i < shuffledTeams.length; i++) {
          const groupName = `Group ${String.fromCharCode(65 + (i % numGroups))}`;
          await updateDoc(doc(db, `/tournaments/${tournament.id}/teams/${shuffledTeams[i].id}`), { group: groupName });
          shuffledTeams[i] = { ...shuffledTeams[i], group: groupName };
        }

        const groupRoundsList: { teamAId: string; teamBId: string; group?: string; round?: string }[][][] = [];
        for (let g = 0; g < numGroups; g++) {
          const groupName = `Group ${String.fromCharCode(65 + g)}`;
          const groupTeamIds = shuffledTeams.filter(t => t.group === groupName).map(t => t.id);
          groupRoundsList.push(generateRoundRobinRounds(groupTeamIds, !!tournament.homeAwayGroup, groupName));
        }

        // Interleave rounds from each group
        const maxRounds = Math.max(...groupRoundsList.map(r => r.length), 0);
        for (let r = 0; r < maxRounds; r++) {
          for (let g = 0; g < numGroups; g++) {
            if (groupRoundsList[g][r]) {
              orderedMatches.push(...groupRoundsList[g][r]);
            }
          }
        }
      } else if (tournament.type === 'knockout') {
        const shuffledTeams = [...teams].sort(() => Math.random() - 0.5);
        if (shuffledTeams.length < 2) return onError('Need at least 2 teams for knockout');
        
        const result = await generateBrackets(shuffledTeams, 'knockout');
        if (Array.isArray(result)) {
          orderedMatches.push(...result);
        } else {
          return; // generateBrackets already called notify
        }
      } else {
        // Standard League (Single table)
        const teamIds = teams.map(t => t.id);
        const leagueRounds = generateRoundRobinRounds(teamIds, !!tournament.homeAwayGroup);
        for (const round of leagueRounds) {
          orderedMatches.push(...round);
        }
      }

      // Schedule matches day-by-day ensuring distinct teams on each day
      const MATCHES_PER_DAY = tournament.matchesPerDay || Math.max(1, Math.min(8, Math.floor(teams.length / 2)));
      const MATCH_DURATION = (tournament.matchDuration || 30) * 60 * 1000;
      const [startHour, startMin] = (tournament.startTime || '10:00').split(':').map(Number);
      
      const currentDayDate = new Date();
      currentDayDate.setDate(currentDayDate.getDate() + 1);
      currentDayDate.setHours(startHour, startMin, 0, 0);

      let currentKickoffTime = currentDayDate.getTime();
      let teamsPlayedToday = new Set<string>();
      let matchesTodayCount = 0;
      let dayIndex = 1;
      const MAX_DAYS = 365;

      const pendingMatches = [...orderedMatches];
      const scheduledMatches: any[] = [];

      while (pendingMatches.length > 0 && dayIndex <= MAX_DAYS) {
        // Check if we hit the matches per day limit
        if (matchesTodayCount >= MATCHES_PER_DAY) {
          currentDayDate.setDate(currentDayDate.getDate() + 1);
          currentDayDate.setHours(startHour, startMin, 0, 0);
          currentKickoffTime = currentDayDate.getTime();
          teamsPlayedToday.clear();
          matchesTodayCount = 0;
          dayIndex++;
          continue;
        }

        // Look for next match where NEITHER team has played today
        const nextMatchIdx = pendingMatches.findIndex(
          m => !teamsPlayedToday.has(m.teamAId) && !teamsPlayedToday.has(m.teamBId)
        );

        if (nextMatchIdx !== -1) {
          const [m] = pendingMatches.splice(nextMatchIdx, 1);
          scheduledMatches.push(cleanObj({
            ...m,
            kickoff: Timestamp.fromMillis(currentKickoffTime),
            scoreA: 0,
            scoreB: 0,
            status: 'scheduled',
            tournamentId: tournament.id,
            createdAt: serverTimestamp(),
          }));

          teamsPlayedToday.add(m.teamAId);
          teamsPlayedToday.add(m.teamBId);
          matchesTodayCount++;
          currentKickoffTime += MATCH_DURATION;
        } else {
          // No more remaining matches can be played today without repeating a team.
          // Advance to the next day so every day has fresh, distinct teams!
          currentDayDate.setDate(currentDayDate.getDate() + 1);
          currentDayDate.setHours(startHour, startMin, 0, 0);
          currentKickoffTime = currentDayDate.getTime();
          teamsPlayedToday.clear();
          matchesTodayCount = 0;
          dayIndex++;
        }
      }

      // Any remaining safety matches
      for (const m of pendingMatches) {
        scheduledMatches.push(cleanObj({
          ...m,
          scoreA: 0,
          scoreB: 0,
          status: 'scheduled',
          tournamentId: tournament.id,
          createdAt: serverTimestamp(),
        }));
      }

      for (const m of scheduledMatches) {
        await addDoc(collection(db, `/tournaments/${tournament.id}/matches`), m);
      }
      notify(`Fixtures generated! ${scheduledMatches.length} matches scheduled fairly across ${dayIndex} matchdays.`);
    } catch (err) {
      onError(err);
      handleFirestoreError(err, OperationType.WRITE, 'matches');
    } finally { setIsGenerating(false); }
  };

  const startPlayoffs = async () => {
    if (matches.some(m => m.group === 'Playoffs')) return onError('Playoffs already generated');
    const numAdvancing = tournament.advancingPerGroup || 2;
    const numGroups = tournament.type === 'league' ? 1 : (tournament.numberOfGroups || 1);
    const qualified: Team[] = [];
    
    if (numGroups === 1) {
      const standings = getStandingsForGroup(undefined);
      qualified.push(...standings.slice(0, numAdvancing));
    } else {
      for (let i = 0; i < numGroups; i++) {
        const standings = getStandingsForGroup(`Group ${String.fromCharCode(65 + i)}`);
        qualified.push(...standings.slice(0, numAdvancing));
      }
    }

    if (qualified.length < 2) return onError('Not enough teams qualified');
    
    setIsGenerating(true);
    try {
        const cleanObj = (obj: any) => {
          const newObj = { ...obj };
          Object.keys(newObj).forEach(key => {
            if (newObj[key] === undefined) delete newObj[key];
          });
          return newObj;
        };

        const createM = async (data: any) => (await addDoc(collection(db, `/tournaments/${tournament.id}/matches`), cleanObj({ 
          scoreA: 0, 
          scoreB: 0, 
          status: 'scheduled', 
          tournamentId: tournament.id, 
          group: 'Playoffs', 
          createdAt: serverTimestamp(), 
          ...data 
        }))).id;

        // Special Case: Single Group with 2, 3, 4, or 6 teams
        if (numGroups === 1) {
          const groupTeams = qualified;
          if (numAdvancing === 2) {
            // Direct Final
            await createM({ round: 'Final', teamAId: groupTeams[0].id, teamBId: groupTeams[1].id });
            notify('Grand Final generated!');
          } else if (numAdvancing === 3) {
             // Qualifier: 2nd vs 3rd, 1st direct to Final
             const finalId = await createM({ round: 'Final', teamAId: groupTeams[0].id, placeholderB: `Winner of Qualifier` });
             await createM({ 
               round: 'Qualifier', 
               teamAId: groupTeams[1].id, 
               teamBId: groupTeams[2].id, 
               successorMatchId: finalId, 
               successorSide: 'B' 
             });
             notify('Qualifier and Final generated!');
          } else if (numAdvancing === 4) {
             // Semi-finals: 1st vs 4th, 2nd vs 3rd
             const finalId = await createM({ round: 'Final', placeholderA: 'Winner SF1', placeholderB: 'Winner SF2' });
             await createM({ 
               round: 'Semi-final', 
               teamAId: groupTeams[0].id, 
               teamBId: groupTeams[3].id, 
               successorMatchId: finalId, 
               successorSide: 'A' 
             });
             await createM({ 
               round: 'Semi-final', 
               teamAId: groupTeams[1].id, 
               teamBId: groupTeams[2].id, 
               successorMatchId: finalId, 
               successorSide: 'B' 
             });
             notify('Semi-finals and Final generated!');
          } else if (numAdvancing === 6 && groupTeams.length >= 6) {
             // Top 6 Playoff System:
             // 1st & 2nd direct into Semi-finals!
             // 3rd vs 6th & 4th vs 5th play in Playoffs
             const finalId = await createM({ round: 'Final', placeholderA: 'Winner SF1', placeholderB: 'Winner SF2' });

             // Semi-final 1: 1st Place vs Winner of Playoff 2 (4th vs 5th)
             const sf1Id = await createM({
               round: 'Semi-final',
               teamAId: groupTeams[0].id,
               placeholderB: 'Winner Playoff (4th vs 5th)',
               successorMatchId: finalId,
               successorSide: 'A'
             });

             // Semi-final 2: 2nd Place vs Winner of Playoff 1 (3rd vs 6th)
             const sf2Id = await createM({
               round: 'Semi-final',
               teamAId: groupTeams[1].id,
               placeholderB: 'Winner Playoff (3rd vs 6th)',
               successorMatchId: finalId,
               successorSide: 'B'
             });

             // Playoff 2: 4th vs 5th (winner goes to SF1 against 1st place)
             await createM({
               round: 'Playoff',
               teamAId: groupTeams[3].id,
               teamBId: groupTeams[4].id,
               successorMatchId: sf1Id,
               successorSide: 'B'
             });

             // Playoff 1: 3rd vs 6th (winner goes to SF2 against 2nd place)
             await createM({
               round: 'Playoff',
               teamAId: groupTeams[2].id,
               teamBId: groupTeams[5].id,
               successorMatchId: sf2Id,
               successorSide: 'B'
             });

             notify('Top 6 Playoffs & Semi-finals generated!');
          } else {
             // Standard bracket for other cases
             await generateBrackets(groupTeams, 'Playoffs');
          }
        } else {
          // Standard Group Stage advancement logic
          const result = await generateBrackets(qualified, 'Playoffs');
          if (Array.isArray(result)) {
              for (const m of result) {
                await addDoc(collection(db, `/tournaments/${tournament.id}/matches`), cleanObj({
                    ...m,
                    scoreA: 0, scoreB: 0, status: 'scheduled', tournamentId: tournament.id, createdAt: serverTimestamp(), group: 'Playoffs'
                }));
              }
              notify('Playoff brackets generated!');
          }
        }
    } catch (err) { 
      onError(err); 
      handleFirestoreError(err, OperationType.WRITE, 'matches'); 
    } finally { 
      setIsGenerating(false); 
    }
  };

  const generateNextRound = async () => {
    const playM = matches.filter(m => m.group === 'Playoffs');
    const rounds = ['Round of 16', 'Qualification', 'Qualifier', 'Quarter-final', 'Semi-final', 'Final'];
    // Find current round, considering 'Pre-quarter' alias
    const curR = [...rounds].reverse().find(r => 
      playM.some(m => m.round === r || (r === 'Round of 16' && m.round === 'Pre-quarter'))
    );
    const idx = rounds.indexOf(curR || '');
    if (idx === -1 || idx >= rounds.length - 1) return notify('Already at Final!');
    const nextR = rounds[idx + 1];
    const curRM = playM.filter(m => m.round === curR || (curR === 'Round of 16' && m.round === 'Pre-quarter'));
    if (!curRM.every(m => m.status === 'finished')) return onError('Finish all current round matches first');
    const winners: string[] = [];
    if (tournament.homeAwayKnockout) {
      const ties: Record<string, Match[]> = {};
      curRM.forEach(m => { if (m.tieId) (ties[m.tieId] = ties[m.tieId] || []).push(m); });
      Object.values(ties).forEach(ls => {
        const l1 = ls.find(m => m.leg === 1), l2 = ls.find(m => m.leg === 2);
        if (l1 && l2) {
          const aA = l1.scoreA + l2.scoreB, aB = l1.scoreB + l2.scoreA;
          winners.push(aA > aB ? l1.teamAId : aB > aA ? l1.teamBId : ((l2.pensA || 0) > (l2.pensB || 0) ? l2.teamAId : l2.teamBId));
        }
      });
    } else winners.push(...curRM.map(m => m.scoreA > m.scoreB ? m.teamAId : m.scoreB > m.scoreA ? m.teamBId : ((m.pensA || 0) > (m.pensB || 0) ? m.teamAId : m.teamBId)));
    if (winners.length < 2) return onError('Not enough winners');
    setIsGenerating(true);
    try {
      for (let i = 0; i < winners.length; i += 2) if (winners[i+1]) {
        const tId = `tie-${Date.now()}`;
        const m1Data = cleanObj({ teamAId: winners[i], teamBId: winners[i+1], scoreA: 0, scoreB: 0, status: 'scheduled', tournamentId: tournament.id, group: 'Playoffs', round: nextR, createdAt: serverTimestamp(), ...(tournament.homeAwayKnockout ? { leg: 1, tieId: tId } : {}) });
        await addDoc(collection(db, `/tournaments/${tournament.id}/matches`), m1Data);
        
        if (tournament.homeAwayKnockout) {
          const m2Data = cleanObj({ teamAId: winners[i+1], teamBId: winners[i], scoreA: 0, scoreB: 0, status: 'scheduled', tournamentId: tournament.id, group: 'Playoffs', round: nextR, createdAt: serverTimestamp(), leg: 2, tieId: tId });
          await addDoc(collection(db, `/tournaments/${tournament.id}/matches`), m2Data);
        }
      }
      notify(`${nextR} generated!`);
    } catch (err) { onError(err); } finally { setIsGenerating(false); }
  };

  const [isFollowing, setIsFollowing] = useState(false);
  const [followingId, setFollowingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, `users/${user.uid}/following`), where('tournamentId', '==', tournament.id));
    return onSnapshot(q, (s) => { setIsFollowing(!s.empty); setFollowingId(s.empty ? null : s.docs[0].id); });
  }, [user, tournament.id]);

  const toggleFollow = async () => {
    if (!user) return notify('Please sign in to follow');
    try {
      if (isFollowing && followingId) { await deleteDoc(doc(db, `users/${user.uid}/following`, followingId)); notify('Unfollowed'); }
      else { await addDoc(collection(db, `users/${user.uid}/following`), { tournamentId: tournament.id, followedAt: serverTimestamp() }); notify('Following'); }
    } catch (err) { onError(err); }
  };

  const handleShare = async () => {
    setIsShortening(true);
    const originalUrl = `${window.location.origin}${window.location.pathname}?t=${tournament.id}`;
    let shareUrl = originalUrl;

    try {
      // 1. Generate a robust shortened code
      const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let code = '';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      // Check if code already exists (basic conflict check - up to 5 times)
      let docRef = doc(db, 'short_urls', code);
      let docSnap = await getDoc(docRef);
      let attempts = 0;
      while (docSnap.exists() && attempts < 5) {
        code = '';
        for (let i = 0; i < 6; i++) {
          code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        docRef = doc(db, 'short_urls', code);
        docSnap = await getDoc(docRef);
        attempts++;
      }

      // 2. Save mapping to Firestore
      await setDoc(docRef, {
        url: originalUrl,
        createdAt: new Date().toISOString()
      });

      // 3. Make the shortened URL path
      shareUrl = `${window.location.origin}${window.location.pathname}?s=${code}`;
    } catch (err) {
      console.warn('In-app URL shortening failed, falling back to original link.', err);
    } finally {
      setIsShortening(false);
    }

    if (navigator.share) {
      try {
        await navigator.share({
          title: tournament.name,
          text: `Check out ${tournament.name} on Kickivo!`,
          url: shareUrl,
        });
        notify('Link shared successfully!');
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          copyToClipboard(shareUrl);
        }
      }
    } else {
      copyToClipboard(shareUrl);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        notify('Link copied to clipboard!');
      })
      .catch((err) => {
        console.error('Failed to copy: ', err);
        notify('Failed to copy link.');
      });
  };

  const getStandingsForGroup = (group?: string) => {
    const ts = group ? teams.filter(t => t.group === group) : teams;
    return ts.map(t => {
      const ms = matches.filter(m => (m.status === 'finished' || m.status === 'live') && m.group !== 'Playoffs' && (m.teamAId === t.id || m.teamBId === t.id));
      let w = 0, d = 0, l = 0, gf = 0, ga = 0;
      ms.forEach(m => {
        const isA = m.teamAId === t.id;
        const s = isA ? (m.scoreA || 0) : (m.scoreB || 0);
        const o = isA ? (m.scoreB || 0) : (m.scoreA || 0);
        gf += s; ga += o;
        if (s > o) w++; else if (s < o) l++; else d++;
      });
      return { ...t, played: ms.length, won: w, drawn: d, lost: l, gf, ga, gd: gf - ga, points: (w * 3) + d };
    }).sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf);
  };

  if (selectedMatch) return (
    <MatchScoringView 
      tournament={tournament} 
      match={selectedMatch} 
      teams={teams} 
      allPlayers={allPlayers} 
      onBack={() => setSelectedMatch(null)} 
      isCreator={canManage} 
      notify={notify} 
      matches={matches}
      onSelectPlayer={setSelectedProfilePlayer}
      onSelectTeam={(t) => { setSelectedMatch(null); setSelectedTeam(t); }}
    />
  );
  if (selectedTeam) return (
    <>
      <TeamDetailView 
        tournament={tournament} 
        team={selectedTeam} 
        onBack={() => setSelectedTeam(null)} 
        isCreator={canManage} 
        onSelectPlayer={setSelectedProfilePlayer}
        matches={matches}
        events={events}
        teams={teams}
        user={user}
        notify={notify}
        onSelectTeam={setSelectedTeam}
      />
      {selectedProfilePlayer && (
        <PlayerProfileModal
          player={selectedProfilePlayer}
          tournament={tournament}
          teams={teams}
          matches={matches}
          events={events}
          user={user}
          onClose={() => setSelectedProfilePlayer(null)}
          notify={notify}
        />
      )}
    </>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
      {/* Pending Co-Host / Editor Invitation Banner */}
      {pendingInviteToken && !isCreator && !isEditor && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 dark:bg-emerald-950/40 border border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/20">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">Co-Host Editing Invitation</p>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                You've been invited as a verified Co-Host to score matches and manage <strong>{tournament.name}</strong>.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={() => {
                setPendingInviteToken(null);
                const url = new URL(window.location.href);
                url.searchParams.delete('editorKey');
                window.history.replaceState({}, '', url.toString());
              }}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition"
            >
              Decline
            </button>
            <button
              onClick={acceptEditorInvite}
              className="px-5 py-2 rounded-xl text-xs font-black bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 active:scale-95 transition flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              {user ? 'Accept Co-Host Access' : 'Sign In to Accept'}
            </button>
          </div>
        </div>
      )}

      {/* Unified Premium Tournament Header Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 md:p-6 shadow-sm flex flex-col gap-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2.5">
            {/* Top row: LIVE badge / status and tournament type */}
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest text-white shrink-0 ${
                tournament.status === 'live' ? 'bg-emerald-500' : 
                (tournament.status === 'completed' || tournament.status === 'finished') ? 'bg-amber-500' : 
                'bg-slate-500'
              }`}>
                {tournament.status === 'live' && <span className="w-1.5 h-1.5 bg-white rounded-full block animate-ping shrink-0" />}
                {tournament.status === 'live' ? 'Ongoing' : tournament.status}
              </span>
              <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 px-2 py-0.5 rounded-full uppercase tracking-wider">
                {tournament.type.replace('_', ' ')}
              </span>
              {(tournament.category === 'efootball' || tournament.isEfootball) && (
                <span className="text-[9px] font-black text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/50 dark:border-indigo-800/50 px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                  🎮 eFootball
                </span>
              )}
              {isFollowing && (
                <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500 shrink-0" />
              )}
            </div>

            {/* Second row: Tournament title (balanced display typography) and Description */}
            <div className="space-y-1">
              <h1 className="text-2xl md:text-3.5xl font-black tracking-tight leading-tight text-slate-950 dark:text-white">{tournament.name}</h1>
              {tournament.description && (
                <p className="text-slate-500 dark:text-slate-400 font-medium text-xs max-w-2xl leading-relaxed">{tournament.description}</p>
              )}
            </div>

            {/* Third row: Follow / Following CTA and Winner Badge if exists */}
            <div className="flex items-center gap-3 flex-wrap">
              <button 
                onClick={toggleFollow} 
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all border shadow-sm ${
                  isFollowing 
                    ? 'text-rose-500 bg-rose-50/50 dark:bg-rose-950/20 border-rose-200/50 hover:bg-rose-100/50' 
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-rose-500 hover:border-rose-200 dark:hover:text-rose-400'
                }`}
              >
                <Heart className={`w-3 h-3 ${isFollowing ? 'fill-rose-500 text-rose-500' : ''}`} />
                {isFollowing ? 'Following' : 'Follow'}
              </button>
              <button 
                onClick={handleShare} 
                disabled={isShortening}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all border shadow-sm ${
                  isShortening 
                    ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed' 
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-emerald-500 hover:border-emerald-200 active:scale-95 text-slate-500'
                }`}
                title="Share tournament link"
              >
                <Share2 className={`w-3 h-3 ${isShortening ? 'animate-spin text-emerald-500' : ''}`} />
                {isShortening ? 'Shortening...' : 'Share Link'}
              </button>

              {/* Co-Hosts / Editors Access Button */}
              {(isCreator || isEditor) && (
                <button 
                  onClick={() => setShowCoHostModal(true)} 
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all border shadow-sm ${
                    isEditor && !isCreator
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-emerald-500 hover:border-emerald-200'
                  }`}
                  title="Manage Co-Hosts and Editing Access"
                >
                  <UserCheck className="w-3 h-3 text-emerald-500" />
                  <span>{isCreator ? 'Co-Hosts' : 'Co-Host Active'}</span>
                  {(tournament.editors?.length || 0) > 0 && (
                    <span className="w-4 h-4 rounded-full bg-emerald-500 text-white text-[9px] flex items-center justify-center font-black">
                      {tournament.editors?.length}
                    </span>
                  )}
                </button>
              )}
              {(() => {
                const fin = matches.find(m => m.round === 'Final' && m.status === 'finished');
                if (fin) {
                  const champId = (fin.scoreA > fin.scoreB || (fin.scoreA===fin.scoreB && (fin.pensA||0)>(fin.pensB||0))) ? fin.teamAId : fin.teamBId;
                  const champ = teams.find(t => t.id === champId);
                  if (champ) return (
                    <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full text-[10px] select-none font-bold">
                      <Trophy className="w-3.5 h-3.5 text-amber-500" />
                      <span className="text-amber-700">{champ.name}</span>
                      <span className="text-[8px] font-black text-amber-400 uppercase tracking-widest ml-1">Champions</span>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          </div>

          {/* Header Action Controls */}
          <div className="flex gap-2.5 flex-wrap items-center md:items-end shrink-0">
            {canManage && (
              <>
                {matches.length === 0 && (
                  <button onClick={generateAutoSchedule} disabled={isGenerating} className="px-3.5 py-2 bg-slate-950 hover:bg-slate-850 text-white rounded-full text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50">
                    <RefreshCw className={`w-3 h-3 ${isGenerating ? 'animate-spin' : ''}`} />
                    Auto-Fixtures
                  </button>
                )}
                {(tournament.type === 'league_playoff' || (tournament.type === 'league' && (tournament.advancingPerGroup || 0) > 0)) && matches.length > 0 && !matches.some(m => m.group === 'Playoffs') && matches.filter(m => m.group !== 'Playoffs').every(m => m.status === 'finished') && (
                  <button onClick={startPlayoffs} disabled={isGenerating} className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100/70 text-emerald-600 rounded-full text-xs font-bold flex items-center gap-1.5 border border-emerald-200 transition-all disabled:opacity-50">
                    <Trophy className="w-3 h-3" />
                    Start Playoffs
                  </button>
                )}
                {!allMatchesScheduled && (
                  <button onClick={() => setShowAddMatch(true)} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-500/10 transition-all">
                    <Calendar className="w-3 h-3" />
                    Schedule Match
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Live Matches Scoreboard Strip (Highly Aligned, Embedded inside header card) */}
        {liveMatches.length > 0 && (
          <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
            <div className="flex items-center justify-between pb-1">
              <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100/65 dark:border-emerald-900/30 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest leading-none select-none">
                <span className="relative flex h-1.5 w-1.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                </span>
                <span>Live Matches</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {liveMatches.map(m => {
                const tA = teams.find(t => t.id === m.teamAId);
                const tB = teams.find(t => t.id === m.teamBId);
                return (
                  <div 
                    key={m.id} 
                    onClick={() => setSelectedMatch(m)}
                    className="bg-slate-50 dark:bg-slate-900 hover:bg-white dark:hover:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-emerald-300 transition-all p-3 cursor-pointer shadow-sm relative group flex flex-col justify-between"
                  >
                    {/* Top aligned metadata row */}
                    <div className="flex items-center justify-between text-[8px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2.5 border-b border-slate-100/50 dark:border-slate-800/50 pb-1 flex-wrap gap-1">
                      <span className="text-slate-500/90 flex items-center gap-1.5 shrink-0">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                        {m.round || m.group || 'Live'}
                      </span>
                      {m.kickoff && (
                        <span className="font-semibold text-slate-400 shrink-0">
                          {m.kickoff.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    
                    {/* Perfectly centered scoreboard row */}
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                      {/* Left team name list align container (Team A) */}
                      <div className="flex items-center gap-2 justify-end min-w-0">
                        <span className="text-[11px] font-black text-slate-800 dark:text-slate-200 truncate text-right group-hover:text-emerald-600 transition-colors">
                          {tA?.name || m.placeholderA || 'TBD'}
                        </span>
                        {renderTeamLogo(tA?.logoURL, tA?.name || m.placeholderA || '', "w-5.5 h-5.5")}
                      </div>

                      {/* Score badge perfectly centered vertically */}
                      <div className="flex items-center gap-1.5 bg-white dark:bg-slate-950 px-2 py-0.5 rounded-lg border border-slate-100 dark:border-slate-850 shadow-sm shrink-0 min-w-[36px] justify-center mx-1">
                        <span className="text-[11px] font-black text-slate-900 dark:text-slate-100 tabular-nums">{m.scoreA}</span>
                        <span className="text-[9px] text-slate-300 font-bold">:</span>
                        <span className="text-[11px] font-black text-slate-900 dark:text-slate-100 tabular-nums">{m.scoreB}</span>
                      </div>

                      {/* Right team name list align container (Team B) */}
                      <div className="flex items-center gap-2 justify-start min-w-0">
                        {renderTeamLogo(tB?.logoURL, tB?.name || m.placeholderB || '', "w-5.5 h-5.5")}
                        <span className="text-[11px] font-black text-slate-800 dark:text-slate-200 truncate text-left group-hover:text-emerald-600 transition-colors">
                          {tB?.name || m.placeholderB || 'TBD'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 md:gap-8 border-b border-slate-200 dark:border-slate-800 overflow-x-auto scrollbar-hide no-scrollbar pt-2">
        {(['matches', 'standings', 'knockout', 'teams', 'stats'] as const)
          .filter(t => {
            if (t === 'knockout') {
              if (tournament.type === 'knockout') return true;
              if (tournament.type === 'league_playoff') {
                return matches.some(m => m.group === 'Playoffs');
              }
              return false;
            }
            if (t === 'standings') return tournament.type !== 'knockout';
            return true;
          })
          .map(tab => {
            const label = tab === 'stats' ? 'Leaderboards' : tab;
            const count = tab === 'teams' ? teams.length : tab === 'matches' ? matches.length : null;
            return (
              <button 
                key={tab} 
                onClick={() => setActiveTab(tab)} 
                className={`pb-4 text-xs md:text-sm font-bold uppercase tracking-wider relative whitespace-nowrap transition-colors flex items-center gap-2 ${activeTab === tab ? 'text-emerald-500' : 'text-slate-400 hover:text-slate-600'}`}
              >
                {label}
                {count !== null && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === tab ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'}`}>
                    {count}
                  </span>
                )}
                {activeTab === tab && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 rounded-full" />}
              </button>
            );
          })}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'matches' && (
          <MatchesModule
            tournament={tournament}
            matches={matches}
            teams={teams}
            onSelectMatch={setSelectedMatch}
            onSelectTeam={setSelectedTeam}
          />
        )}

        {activeTab === 'knockout' && (
           <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-8"><div className="max-w-7xl mx-auto overflow-x-auto pb-20 no-scrollbar"><div className="flex flex-col items-center gap-16 min-w-max">
             <div className="text-center space-y-2">
               <Trophy className="w-10 h-10 text-amber-500 mx-auto" />
               <h2 className="text-2xl font-bold uppercase italic tracking-tight">Knockout Stage</h2>
               <div className="h-1 w-12 bg-amber-500/20 mx-auto rounded-full" />
             </div>
              <div className="flex flex-col md:grid md:grid-cols-5 gap-12 items-center w-full">
                <div className="space-y-4 flex flex-col items-end">
                   {tiesByRound['Qualification']?.length > 0 && <div className="flex flex-col gap-4">{tiesByRound['Qualification'].map(t => <div key={t[0].id} className="space-y-2">{t.map(m => <BracketMatch key={m.id} match={m} teams={teams} position="left" onSelect={setSelectedMatch} onSelectTeam={setSelectedTeam} compact={tournament.homeAwayKnockout} />)}</div>)}</div>}
                   {tiesByRound['Playoff']?.length > 0 && <div className="flex flex-col gap-4">{tiesByRound['Playoff'].slice(0, 1).map(t => <div key={t[0].id} className="space-y-2">{t.map(m => <BracketMatch key={m.id} match={m} teams={teams} position="left" onSelect={setSelectedMatch} onSelectTeam={setSelectedTeam} compact={tournament.homeAwayKnockout} />)}</div>)}</div>}
                   {tiesByRound['Qualifier']?.length > 0 && <div className="flex flex-col gap-4">{tiesByRound['Qualifier'].slice(0, 1).map(t => <div key={t[0].id} className="space-y-2">{t.map(m => <BracketMatch key={m.id} match={m} teams={teams} position="left" onSelect={setSelectedMatch} onSelectTeam={setSelectedTeam} compact={tournament.homeAwayKnockout} />)}</div>)}</div>}
                   {tiesByRound['Round of 16']?.length > 0 && <div className="flex flex-col gap-4">{tiesByRound['Round of 16'].slice(0,4).map(t => <div key={t[0].id} className="space-y-2">{t.map(m => <BracketMatch key={m.id} match={m} teams={teams} position="left" onSelect={setSelectedMatch} onSelectTeam={setSelectedTeam} compact={tournament.homeAwayKnockout} />)}</div>)}</div>}
                </div>
                <div className="space-y-12 flex flex-col items-end">
                   {tiesByRound['Quarter-final']?.length > 0 && <div className="flex flex-col gap-8">{tiesByRound['Quarter-final'].slice(0,2).map(t => <div key={t[0].id} className="space-y-4">{t.map(m => <BracketMatch key={m.id} match={m} teams={teams} position="left" onSelect={setSelectedMatch} onSelectTeam={setSelectedTeam} compact={tournament.homeAwayKnockout} />)}</div>)}</div>}
                   {tiesByRound['Semi-final']?.length > 0 && <div className="min-h-[200px] flex flex-col justify-center">{tiesByRound['Semi-final'].slice(0,1).map(t => <div key={t[0].id} className="space-y-4">{t.map(m => <BracketMatch key={m.id} match={m} teams={teams} position="left" onSelect={setSelectedMatch} onSelectTeam={setSelectedTeam} compact={tournament.homeAwayKnockout} />)}</div>)}</div>}
                </div>
                <div className="order-first md:order-none flex flex-col items-center gap-12">
                   <div className="flex flex-col items-center gap-12 bg-slate-50/50 dark:bg-slate-900/50 p-12 rounded-[60px] border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-amber-500 text-white px-8 py-2 rounded-b-2xl text-[10px] font-bold uppercase tracking-widest shadow-lg z-20">Grand Final</div>
                      {tiesByRound['Final']?.length > 0 ? (
                         tiesByRound['Final']?.map(t => <div key={t[0].id} className="space-y-6 relative z-10">{t.map(m => <div key={m.id} onClick={() => setSelectedMatch(m)} className="bg-white dark:bg-slate-900 p-10 rounded-[40px] border-2 border-amber-500/30 shadow-xl scale-110 hover:scale-125 transition-transform cursor-pointer"><div className="flex items-center gap-8"><TeamSlot id={m.teamAId} teams={teams} onSelectTeam={setSelectedTeam}/><div className="flex flex-col items-center gap-2 text-slate-900 dark:text-white"><span className="text-4xl font-black">{m.status==='scheduled'?'-':m.scoreA}</span><span className="text-[10px] font-bold text-slate-300 dark:text-slate-600">VS</span><span className="text-4xl font-black">{m.status==='scheduled'?'-':m.scoreB}</span></div><TeamSlot id={m.teamBId} teams={teams} onSelectTeam={setSelectedTeam} /></div></div>)}</div>)
                      ) : (
                         <div className="p-10 text-slate-300 font-bold uppercase italic text-sm tracking-widest">Finalists pending</div>
                      )}
                   </div>
                   {tournament.hasLosersFinal && (
                      <div className="flex flex-col items-center gap-6 bg-slate-50/30 dark:bg-slate-900/35 p-8 rounded-[40px] border border-slate-100/50 dark:border-slate-800/50">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">3rd Place Match</div>
                        {tiesByRound['Losers Final']?.length > 0 ? (
                           tiesByRound['Losers Final']?.map(t => <div key={t[0].id} className="space-y-4">{t.map(m => <BracketMatch key={m.id} match={m} teams={teams} position="center" onSelect={setSelectedMatch} onSelectTeam={setSelectedTeam} compact={tournament.homeAwayKnockout} />)}</div>)
                        ) : (
                           <div className="text-xs font-bold text-slate-300 uppercase tracking-widest">TBD</div>
                        )}
                      </div>
                   )}
                </div>
                <div className="space-y-12">
                   {tiesByRound['Semi-final']?.length > 0 && <div className="min-h-[200px] flex flex-col justify-center">{tiesByRound['Semi-final'].slice(1,2).map(t => <div key={t[0].id} className="space-y-4">{t.map(m => <BracketMatch key={m.id} match={m} teams={teams} position="right" onSelect={setSelectedMatch} onSelectTeam={setSelectedTeam} compact={tournament.homeAwayKnockout} />)}</div>)}</div>}
                   {tiesByRound['Quarter-final']?.length > 0 && <div className="flex flex-col gap-8">{tiesByRound['Quarter-final'].slice(2,4).map(t => <div key={t[0].id} className="space-y-4">{t.map(m => <BracketMatch key={m.id} match={m} teams={teams} position="right" onSelect={setSelectedMatch} onSelectTeam={setSelectedTeam} compact={tournament.homeAwayKnockout} />)}</div>)}</div>}
                </div>
                <div className="space-y-4">
                   {tiesByRound['Round of 16']?.length > 0 && <div className="flex flex-col gap-4">{tiesByRound['Round of 16'].slice(4,8).map(t => <div key={t[0].id} className="space-y-2">{t.map(m => <BracketMatch key={m.id} match={m} teams={teams} position="right" onSelect={setSelectedMatch} onSelectTeam={setSelectedTeam} compact={tournament.homeAwayKnockout} />)}</div>)}</div>}
                   {tiesByRound['Qualifier']?.length > 1 && <div className="flex flex-col gap-4">{tiesByRound['Qualifier'].slice(1, 2).map(t => <div key={t[0].id} className="space-y-2">{t.map(m => <BracketMatch key={m.id} match={m} teams={teams} position="right" onSelect={setSelectedMatch} onSelectTeam={setSelectedTeam} compact={tournament.homeAwayKnockout} />)}</div>)}</div>}
                   {tiesByRound['Playoff']?.length > 1 && <div className="flex flex-col gap-4">{tiesByRound['Playoff'].slice(1, 2).map(t => <div key={t[0].id} className="space-y-2">{t.map(m => <BracketMatch key={m.id} match={m} teams={teams} position="right" onSelect={setSelectedMatch} onSelectTeam={setSelectedTeam} compact={tournament.homeAwayKnockout} />)}</div>)}</div>}
                   {tiesByRound['Qualification']?.length > 0 && <div className="flex flex-col gap-4">{tiesByRound['Qualification'].map(t => <div key={t[0].id} className="space-y-2">{t.map(m => <BracketMatch key={m.id} match={m} teams={teams} position="right" onSelect={setSelectedMatch} onSelectTeam={setSelectedTeam} compact={tournament.homeAwayKnockout} />)}</div>)}</div>}
                </div>
             </div>
           </div></div></motion.div>
        )}

        {activeTab === 'standings' && (
          <PointTableModule
            tournament={tournament}
            teams={teams}
            matches={matches}
            onSelectTeam={setSelectedTeam}
          />
        )}

        {/* Removed inline standings body */}




         {activeTab === 'teams' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
            {matches.length === 0 && (canManage || (user && !teams.some(t => t.creatorId === user.uid))) && (
              <div className="flex justify-end"><button onClick={() => { setSelectedEmblemId(''); setShowAddTeam(true); }} className="bg-emerald-500 text-white px-6 py-3 rounded-full text-xs font-black shadow-lg flex items-center gap-2"><Plus className="w-4 h-4" />{canManage ? 'Add Team' : 'Register Squad'}</button></div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
              {teams.length === 0 ? <div className="col-span-full py-20 text-center font-bold text-slate-300 dark:text-slate-500 uppercase bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl italic">No teams yet</div> : 
                teams.map(t => (
                  <div key={t.id} onClick={() => setSelectedTeam(t)} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 flex flex-col items-center gap-4 cursor-pointer hover:border-emerald-200 dark:hover:border-emerald-500/50 hover:shadow-xl transition-all h-full shadow-sm">
                    <div className="w-20 h-20 flex items-center justify-center">{renderTeamLogo(t.logoURL, t.name, "w-20 h-20")}</div>
                    <span className="font-black text-xs uppercase tracking-tight text-center text-slate-900 dark:text-slate-100">{t.name}</span>
                  </div>
                ))
              }
            </div>
          </motion.div>
        )}

        {activeTab === 'stats' && (
          <LeaderboardModule
            allPlayers={allPlayers}
            teams={teams}
            matches={matches}
            events={events}
            onSelectPlayer={setSelectedProfilePlayer}
            onSelectTeam={setSelectedTeam}
          />
        )}
      </AnimatePresence>

       <AnimatePresence>
        {showAddTeam && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddTeam(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 w-full max-w-md rounded-[32px] p-8 shadow-2xl">
              <button onClick={() => setShowAddTeam(false)} className="absolute right-6 top-6 p-2 text-slate-300 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"><X className="w-5 h-5" /></button>
              <h2 className="text-3xl font-black mb-6 tracking-tighter italic text-slate-900 dark:text-white">Register Team</h2>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const name = (e.currentTarget.elements.namedItem('team-name') as HTMLInputElement).value.trim();
                const fileInput = e.currentTarget.elements.namedItem('team-logo') as HTMLInputElement;
                let logoURL = "";
                if (fileInput.files?.[0]) {
                  const reader = new FileReader();
                  logoURL = await new Promise(r => { reader.onload = () => r(reader.result as string); reader.readAsDataURL(fileInput.files![0]); });
                } else if (selectedEmblemId) {
                  logoURL = selectedEmblemId;
                }
                try {
                  await addDoc(collection(db, `/tournaments/${tournament.id}/teams`), cleanObj({ name, logoURL, tournamentId: tournament.id, creatorId: user?.uid, createdAt: serverTimestamp() }));
                  setShowAddTeam(false);
                } catch (err) { handleFirestoreError(err, OperationType.WRITE, `teams`); }
              }} className="space-y-4">
                <div className="space-y-2"><label className="text-[10px] font-black uppercase text-slate-400">Team Name</label><input name="team-name" required className="w-full bg-slate-50 dark:bg-slate-950 px-6 py-4.5 rounded-2xl border border-slate-150 dark:border-slate-800/80 font-bold text-slate-900 dark:text-white" placeholder="e.g. Real Madrid" /></div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Team Icon</label>
                  
                  {/* File Upload Selector */}
                  <div className="relative group">
                    <input name="team-logo" type="file" accept="image/*" onChange={(e) => { if (e.target.files?.length) setSelectedEmblemId(''); }} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                    <div className="w-full bg-slate-50 dark:bg-slate-905 px-5 py-6 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col items-center gap-2 transition-all group-hover:border-emerald-500 group-hover:bg-emerald-50/50">
                      <Plus className="w-6 h-6 text-slate-300" />
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Upload Custom Image Panel</span>
                    </div>
                  </div>

                  {/* Predefined Emblem Selection */}
                  <div className="mt-3">
                    <label className="text-[10px] font-black uppercase text-slate-400 block mb-2">Or select a default emblem</label>
                    <div className="grid grid-cols-4 gap-2 p-2 border border-slate-100 dark:border-slate-800/85 rounded-2xl bg-slate-50/50 dark:bg-slate-950/40">
                      {DEFAULT_EMBLEMS.map(emb => {
                        const Icon = emb.icon;
                        const isSelected = selectedEmblemId === emb.id;
                        return (
                          <button
                            key={emb.id}
                            type="button"
                            onClick={() => setSelectedEmblemId(emb.id)}
                            className={`group h-11 rounded-xl flex items-center justify-center bg-gradient-to-br ${emb.gradientClass} relative ${isSelected ? 'ring-4 ring-emerald-500 scale-95 shadow-md' : 'opacity-80 hover:opacity-100'} transition-all`}
                            title={emb.name}
                          >
                            <Icon className="w-5 h-5 text-white" />
                            {isSelected && (
                              <span className="absolute -top-1 -right-1 bg-emerald-500 text-white rounded-full p-0.5 shadow-sm">
                                <Check className="w-2 h-2" />
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <button type="submit" className="w-full bg-emerald-500 text-white font-black py-4.5 rounded-2xl shadow-xl shadow-emerald-500/20 active:scale-95 transition-all mt-4">Confirm Registration</button>
              </form>
            </motion.div>
          </div>
        )}

        {showAddMatch && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddMatch(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 w-full max-w-md rounded-[32px] p-10 shadow-2xl">
              <button onClick={() => setShowAddMatch(false)} className="absolute right-6 top-6 p-2 text-slate-300 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"><X className="w-5 h-5" /></button>
              <h2 className="text-3xl font-black mb-8 tracking-tighter italic text-slate-900 dark:text-white">Schedule Match</h2>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const tA = (e.currentTarget.elements.namedItem('teamA') as HTMLSelectElement).value;
                const tB = (e.currentTarget.elements.namedItem('teamB') as HTMLSelectElement).value;
                const kickoff = (e.currentTarget.elements.namedItem('kickoff') as HTMLInputElement).value;
                if (tA === tB) return notify('Choose different teams');
                try {
                  await addDoc(collection(db, `/tournaments/${tournament.id}/matches`), cleanObj({ teamAId: tA, teamBId: tB, scoreA: 0, scoreB: 0, status: 'scheduled', tournamentId: tournament.id, kickoff: kickoff ? Timestamp.fromDate(new Date(kickoff)) : null, createdAt: serverTimestamp() }));
                  setShowAddMatch(false);
                } catch (err) { handleFirestoreError(err, OperationType.WRITE, `matches`); }
              }} className="space-y-4">
                <select name="teamA" required className="w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white px-5 py-4 rounded-2xl border border-slate-100 dark:border-slate-800 font-bold"><option value="" className="dark:bg-slate-900">Select Team A</option>{teams.map(t => <option key={t.id} value={t.id} className="dark:bg-slate-900">{t.name}</option>)}</select>
                <select name="teamB" required className="w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white px-5 py-4 rounded-2xl border border-slate-100 dark:border-slate-800 font-bold"><option value="" className="dark:bg-slate-900">Select Team B</option>{teams.map(t => <option key={t.id} value={t.id} className="dark:bg-slate-900">{t.name}</option>)}</select>
                <input name="kickoff" type="datetime-local" className="w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white px-5 py-4 rounded-2xl border border-slate-100 dark:border-slate-800 font-bold" />
                <button type="submit" className="w-full bg-emerald-500 text-white font-black py-5 rounded-2xl shadow-xl shadow-emerald-500/20 active:scale-95 transition-all">Create Match</button>
              </form>
            </motion.div>
          </div>
        )}

        {selectedProfilePlayer && (
          <PlayerProfileModal
            key="player-profile-modal-main"
            player={selectedProfilePlayer}
            tournament={tournament}
            teams={teams}
            matches={matches}
            events={events}
            user={user}
            onClose={() => setSelectedProfilePlayer(null)}
            notify={notify}
          />
        )}

        {/* Co-Hosts / Editors Access Management Modal */}
        {showCoHostModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }} 
              className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 max-w-lg w-full border border-slate-100 dark:border-slate-800 shadow-2xl relative space-y-6 text-left max-h-[90vh] overflow-y-auto"
            >
              <button 
                onClick={() => setShowCoHostModal(false)} 
                className="absolute top-6 right-6 p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                  <UserCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-lg md:text-xl text-slate-900 dark:text-white tracking-tight">Co-Hosts & Editors</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Collaborative match scoring & tournament management</p>
                </div>
              </div>

              {/* Shareable Invite Link Section */}
              <div className="bg-slate-50 dark:bg-slate-950/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <LinkIcon className="w-3.5 h-3.5 text-emerald-500" />
                    Editor Invite Link
                  </span>
                  {isCreator && (
                    <button
                      onClick={regenerateEditorToken}
                      disabled={isGeneratingCoHostToken}
                      className="text-[10px] font-bold text-slate-400 hover:text-emerald-500 flex items-center gap-1 disabled:opacity-50"
                      title="Generate a new link and revoke earlier link"
                    >
                      <RefreshCw className={`w-3 h-3 ${isGeneratingCoHostToken ? 'animate-spin' : ''}`} />
                      Regenerate
                    </button>
                  )}
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Anyone who opens this link can accept Co-Host access to score matches, update timelines, record goals & cards, and manage squad rosters.
                </p>

                {tournament.editorInviteToken ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-white dark:bg-slate-900 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 font-mono truncate select-all">
                      {`${window.location.origin}/?t=${tournament.id}&editorKey=${tournament.editorInviteToken}`}
                    </div>
                    <button
                      onClick={() => {
                        const link = `${window.location.origin}/?t=${tournament.id}&editorKey=${tournament.editorInviteToken}`;
                        navigator.clipboard.writeText(link);
                        setCopiedCoHostLink(true);
                        notify('Co-Host invite link copied to clipboard!');
                        setTimeout(() => setCopiedCoHostLink(false), 2500);
                      }}
                      className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md shadow-emerald-500/20 active:scale-95 transition shrink-0"
                    >
                      {copiedCoHostLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedCoHostLink ? 'Copied' : 'Copy Link'}</span>
                    </button>
                  </div>
                ) : (
                  <div className="py-2 text-center text-xs text-slate-400 italic">
                    Generating your unique co-host invite link...
                  </div>
                )}
              </div>

              {/* Current Co-Hosts List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  <span>Active Co-Hosts ({(tournament.editors?.length || 0)})</span>
                  <span className="text-[10px] font-normal text-slate-400">Creator: Full Control</span>
                </div>

                {(!tournament.editors || tournament.editors.length === 0) ? (
                  <div className="py-6 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-slate-100 dark:border-slate-800">
                    No co-hosts added yet. Share the invite link above to add partners.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-48 overflow-y-auto pr-1">
                    {tournament.editors.map(uid => {
                      const member = tournament.editorMembers?.find(m => m.uid === uid);
                      const isMe = user?.uid === uid;
                      return (
                        <div key={uid} className="py-2.5 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {member?.photoURL ? (
                              <img src={member.photoURL} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold shrink-0">
                                {(member?.displayName || 'C')[0]}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate flex items-center gap-1.5">
                                {member?.displayName || 'Co-Host Editor'}
                                {isMe && <span className="text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded font-normal">You</span>}
                              </p>
                              {member?.email && <p className="text-[10px] text-slate-400 truncate">{member.email}</p>}
                            </div>
                          </div>
                          {isCreator && (
                            <button
                              onClick={() => removeCoHost(uid)}
                              className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition"
                              title="Remove Co-Host Access"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Security info notes */}
              <div className="p-3.5 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                <p className="font-bold text-emerald-700 dark:text-emerald-400">Co-Host Permissions:</p>
                <p>• Can start match timers, add/delete goals, cards, and milestones in real time.</p>
                <p>• Can add teams, edit rosters, and schedule matches.</p>
                <p>• Cannot delete the tournament or remove other editors (only Creator can).</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
