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
  Timestamp
} from 'firebase/firestore';
import { 
  Trophy, 
  Users, 
  Calendar, 
  RefreshCw, 
  ChevronRight, 
  Star, 
  X, 
  Shield, 
  Plus, 
  Footprints 
} from 'lucide-react';
import { db, OperationType, handleFirestoreError } from '../../lib/firebase';
import { Tournament, TournamentStatus, Match, Team, Player, MatchEvent, User } from '../../types';
import { SoccerIcon } from '../common/Icons';
import { formatTeamName, getTeamShortName } from '../../utils/football';
import { MatchScoringView } from '../Match/MatchScoringView';
import { TeamDetailView } from './TeamDetailView';
import { TeamSlot } from './TeamSlot';
import { BracketMatch } from './BracketMatch';
import { User as FirebaseUser } from 'firebase/auth';

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
  const [showAddTeam, setShowAddTeam] = useState(false);
  const [showAddMatch, setShowAddMatch] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const isCreator = user?.uid === tournament.creatorId;
  const liveMatches = useMemo(() => matches.filter(m => m.status === 'live'), [matches]);

  const tiesByRound = useMemo(() => {
    const playoffMatches = matches.filter(m => m.group === 'Playoffs' || tournament.type === 'knockout');
    const rounds = ['Round of 64', 'Round of 32', 'Round of 16', 'Qualification', 'Qualifier', 'Quarter-final', 'Semi-final', 'Losers Final', 'Final'];
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

  const generateAutoSchedule = async () => {
    if (teams.length < 2) return onError('Need at least 2 teams to schedule');
    setIsGenerating(true);
    try {
      const allMatches: any[] = [];
      if (tournament.type === 'league_playoff') {
        const numGroups = tournament.numberOfGroups || 2;
        const shuffledTeams = [...teams].sort(() => Math.random() - 0.5);
        for (let i = 0; i < shuffledTeams.length; i++) {
          const groupName = `Group ${String.fromCharCode(65 + (i % numGroups))}`;
          await updateDoc(doc(db, `/tournaments/${tournament.id}/teams/${shuffledTeams[i].id}`), { group: groupName });
          shuffledTeams[i] = { ...shuffledTeams[i], group: groupName };
        }
        for (let g = 0; g < numGroups; g++) {
          const groupName = `Group ${String.fromCharCode(65 + g)}`;
          const groupTeams = shuffledTeams.filter(t => t.group === groupName);
          for (let i = 0; i < groupTeams.length; i++) {
            for (let j = i + 1; j < groupTeams.length; j++) {
              allMatches.push({ teamAId: groupTeams[i].id, teamBId: groupTeams[j].id, group: groupName });
              if (tournament.homeAwayGroup) allMatches.push({ teamAId: groupTeams[j].id, teamBId: groupTeams[i].id, group: groupName });
            }
          }
        }
      } else      if (tournament.type === 'knockout') {
        const shuffledTeams = [...teams].sort(() => Math.random() - 0.5);
        if (shuffledTeams.length < 2) return onError('Need at least 2 teams for knockout');
        
        const result = await generateBrackets(shuffledTeams, 'knockout');
        if (Array.isArray(result)) {
          allMatches.push(...result);
        } else {
          return; // generateBrackets already called notify
        }
      } else {
        for (let i = 0; i < teams.length; i++) {
          for (let j = i + 1; j < teams.length; j++) {
            allMatches.push({ teamAId: teams[i].id, teamBId: teams[j].id });
            if (tournament.homeAwayGroup) allMatches.push({ teamAId: teams[j].id, teamBId: teams[i].id });
          }
        }
      }

      allMatches.sort(() => Math.random() - 0.5);
      const scheduledMatches: any[] = [];
      const teamLastMatchTime: Record<string, number> = {};
      const REST_PERIOD = 60 * 60 * 1000;
      const MATCH_DURATION = (tournament.matchDuration || 30) * 60 * 1000;
      const MATCHES_PER_DAY = tournament.matchesPerDay || 8;
      const [startHour, startMin] = (tournament.startTime || '10:00').split(':').map(Number);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 1);
      startDate.setHours(startHour, startMin, 0, 0);
      let currentStartTime = startDate.getTime();
      let matchesScheduledCount = 0;

      while (allMatches.length > 0) {
        let matchFound = false;
        for (let i = 0; i < allMatches.length; i++) {
          const m = allMatches[i];
          if (currentStartTime >= (teamLastMatchTime[m.teamAId] || 0) + REST_PERIOD && currentStartTime >= (teamLastMatchTime[m.teamBId] || 0) + REST_PERIOD) {
            scheduledMatches.push(cleanObj({
              ...m,
              kickoff: Timestamp.fromMillis(currentStartTime),
              scoreA: 0, scoreB: 0, status: 'scheduled', tournamentId: tournament.id, createdAt: serverTimestamp(),
            }));
            teamLastMatchTime[m.teamAId] = currentStartTime + MATCH_DURATION;
            teamLastMatchTime[m.teamBId] = currentStartTime + MATCH_DURATION;
            allMatches.splice(i, 1);
            matchFound = true;
            matchesScheduledCount++;
            if (matchesScheduledCount % MATCHES_PER_DAY === 0) {
              const nextDay = new Date(currentStartTime);
              nextDay.setDate(nextDay.getDate() + 1);
              nextDay.setHours(startHour, startMin, 0, 0);
              currentStartTime = nextDay.getTime();
            } else currentStartTime += MATCH_DURATION;
            break;
          }
        }
        if (!matchFound) {
          currentStartTime += MATCH_DURATION;
          if (currentStartTime > Date.now() + 30 * 24 * 60 * 60 * 1000) break;
        }
      }
      for (const m of scheduledMatches) await addDoc(collection(db, `/tournaments/${tournament.id}/matches`), m);
      notify('Fixtures generated!');
    } catch (err) {
      onError(err);
      handleFirestoreError(err, OperationType.WRITE, 'matches');
    } finally { setIsGenerating(false); }
  };

  const startPlayoffs = async () => {
    if (matches.some(m => m.group === 'Playoffs')) return onError('Playoffs already generated');
    const numAdvancing = tournament.advancingPerGroup || 2;
    const numGroups = tournament.numberOfGroups || 2;
    const qualified: Team[] = [];
    
    for (let i = 0; i < numGroups; i++) {
        const standings = getStandingsForGroup(`Group ${String.fromCharCode(65 + i)}`);
        qualified.push(...standings.slice(0, numAdvancing));
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

        // Special Case: Single Group with 2, 3, or 4 teams
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

  if (selectedMatch) return <MatchScoringView tournament={tournament} match={selectedMatch} teams={teams} allPlayers={allPlayers} onBack={() => setSelectedMatch(null)} isCreator={isCreator} notify={notify} matches={matches} />;
  if (selectedTeam) return <TeamDetailView tournament={tournament} team={selectedTeam} onBack={() => setSelectedTeam(null)} isCreator={isCreator} />;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
        <div className="space-y-3">
           <div className="flex items-center gap-3">
             <div className={`px-3 py-1 rounded-full text-[10px] font-bold text-white uppercase tracking-wider ${
               tournament.status === 'live' ? 'bg-emerald-500' : 
               (tournament.status === 'completed' || tournament.status === 'finished') ? 'bg-amber-500' : 
               'bg-slate-500'
             }`}>
               {tournament.status}
             </div>
             <div className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">{tournament.type.replace('_', ' ')}</div>
           </div>
           <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-none text-slate-900">{tournament.name}</h1>
           {(() => {
              const fin = matches.find(m => m.round === 'Final' && m.status === 'finished');
              if (fin) {
                const champId = (fin.scoreA > fin.scoreB || (fin.scoreA===fin.scoreB && (fin.pensA||0)>(fin.pensB||0))) ? fin.teamAId : fin.teamBId;
                const champ = teams.find(t => t.id === champId);
                if (champ) return <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-200 px-4 py-2 rounded-full w-fit"><Trophy className="w-4 h-4 text-amber-500" /><span className="text-amber-700 font-bold text-sm">{champ.name}</span><span className="text-[9px] font-bold text-amber-400 uppercase tracking-[0.2em]">Champions</span></div>;
              }
              return null;
           })()}
           <div className="flex items-center gap-4">
             <p className="text-slate-500 font-medium max-w-2xl leading-relaxed">{tournament.description}</p>
             <button 
               onClick={toggleFollow} 
               className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all ${
                 isFollowing 
                   ? 'text-amber-500 bg-amber-50/50 hover:bg-amber-50' 
                   : 'bg-white border border-slate-200 text-slate-400 hover:text-amber-500 shadow-sm'
               }`}
             >
               <Star className={`w-3.5 h-3.5 ${isFollowing ? 'fill-amber-500' : ''}`} />
               {isFollowing ? 'Following' : 'Follow'}
             </button>
           </div>
        </div>
        <div className="flex gap-2 flex-wrap items-end">
          {isCreator && (
            <>
              {matches.length === 0 && <button onClick={generateAutoSchedule} disabled={isGenerating} className="px-4 py-2 bg-slate-900 text-white rounded-full text-sm font-bold flex items-center gap-2 hover:bg-slate-800 disabled:opacity-50"><RefreshCw className={isGenerating ? 'animate-spin' : ''} /> Auto-Fixtures</button>}
              {tournament.type === 'league_playoff' && matches.length > 0 && !matches.some(m => m.group === 'Playoffs') && matches.filter(m => m.group !== 'Playoffs').every(m => m.status === 'finished') && <button onClick={startPlayoffs} disabled={isGenerating} className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-full text-sm font-bold flex items-center gap-2 border border-emerald-200 disabled:opacity-50"><Trophy className="w-4 h-4" /> Start Playoffs</button>}
              {!allMatchesScheduled && <button onClick={() => setShowAddMatch(true)} className="px-4 py-2 bg-emerald-500 text-white rounded-full text-sm font-bold flex items-center gap-2 shadow-lg"><Calendar className="w-4 h-4" /> Schedule Match</button>}
            </>
          )}
        </div>
      </div>

      {/* Live Matches Strip */}
      {liveMatches.length > 0 && (
        <div className="bg-gradient-to-r from-red-500/5 via-rose-500/10 to-transparent border border-rose-100 rounded-3xl p-5 space-y-3.5 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
            </span>
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-800 flex items-center gap-1.5">
              Live Matches Now <span className="bg-rose-100 text-rose-600 text-[8px] font-extrabold px-1.5 py-0.5 rounded-full">{liveMatches.length}</span>
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {liveMatches.map(m => {
              const tA = teams.find(t => t.id === m.teamAId);
              const tB = teams.find(t => t.id === m.teamBId);
              return (
                <div 
                  key={m.id} 
                  onClick={() => setSelectedMatch(m)}
                  className="bg-white/95 backdrop-blur-md hover:bg-white p-3.5 rounded-2xl border border-rose-100/50 hover:border-rose-300 transition-all shadow-sm hover:shadow cursor-pointer flex flex-col justify-between group"
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-[8px] font-extrabold uppercase tracking-widest text-rose-500 bg-rose-50/70 px-1.5 py-0.5 rounded">
                      {m.round || m.group || 'Match'}
                    </span>
                    {m.kickoff && (
                      <span className="text-[8px] font-semibold text-slate-400">
                        {m.kickoff.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <div className="flex items-center gap-1.5 justify-end min-w-0">
                      <span className="text-[11px] font-black text-slate-700 truncate group-hover:text-rose-600 transition-colors">{tA?.name || m.placeholderA || 'TBD'}</span>
                      {tA?.logoURL ? (
                        <img src={tA.logoURL} className="w-5 h-5 rounded-full object-contain shrink-0" alt="" />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-slate-50 flex items-center justify-center text-[8px] font-extrabold text-slate-300 border border-slate-100 shrink-0">
                          {tA?.name?.[0] || '?'}
                        </div>
                      )}
                    </div>
                    <div className="bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-lg flex items-center justify-center gap-1 min-w-[40px] shrink-0 text-center">
                      <span className="font-black text-xs text-rose-600">{m.scoreA}</span>
                      <span className="text-rose-300 font-bold text-[9px]">-</span>
                      <span className="font-black text-xs text-rose-600">{m.scoreB}</span>
                    </div>
                    <div className="flex items-center gap-1.5 justify-start min-w-0">
                      {tB?.logoURL ? (
                        <img src={tB.logoURL} className="w-5 h-5 rounded-full object-contain shrink-0" alt="" />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-slate-50 flex items-center justify-center text-[8px] font-extrabold text-slate-300 border border-slate-100 shrink-0">
                          {tB?.name?.[0] || '?'}
                        </div>
                      )}
                      <span className="text-[11px] font-black text-slate-700 truncate group-hover:text-rose-600 transition-colors">{tB?.name || m.placeholderB || 'TBD'}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex items-center gap-4 md:gap-8 border-b border-slate-200 overflow-x-auto scrollbar-hide no-scrollbar pt-2">
        {(['matches', 'knockout', 'standings', 'teams', 'stats'] as const)
          .filter(t => {
            if (t === 'knockout') return tournament.type === 'league_playoff' || tournament.type === 'knockout';
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
                  <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === tab ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
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
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
            {matches.length === 0 ? (
              <div className="py-20 text-center font-bold text-slate-300 uppercase tracking-widest bg-white rounded-3xl border border-slate-100 italic">No matches scheduled yet</div>
            ) : (
              (() => {
                const grouped = matches.reduce((acc, m) => {
                  let dateKey = m.kickoff 
                    ? m.kickoff.toDate().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }) 
                    : (m.round || m.group || 'Regular Season');
                  
                  if (!acc[dateKey]) {
                    acc[dateKey] = {
                      matches: [],
                      timestamp: m.kickoff?.seconds || (m.createdAt?.seconds || 0),
                      roundIndex: m.round ? ['Round of 64', 'Round of 32', 'Round of 16', 'Qualification', 'Qualifier', 'Quarter-final', 'Semi-final', 'Losers Final', 'Final'].indexOf(m.round) : -1
                    };
                  }
                  acc[dateKey].matches.push(m);
                  return acc;
                }, {} as Record<string, { matches: Match[], timestamp: number, roundIndex: number }>);

                return (Object.entries(grouped) as [string, { matches: Match[], timestamp: number, roundIndex: number }][])
                  .sort(([, a], [, b]) => {
                    if (tournament.type === 'knockout' && a.roundIndex !== -1 && b.roundIndex !== -1) {
                      return a.roundIndex - b.roundIndex;
                    }
                    return a.timestamp - b.timestamp;
                  })
                  .map(([g, groupData]) => (
                    <div key={g} className="space-y-4">
                      <div className="flex items-center gap-3 px-2">
                        <div className="h-[2px] flex-1 bg-slate-100" />
                        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em] flex items-center gap-2">
                          <Calendar className="w-3 h-3 text-slate-300" /> {g}
                        </h3>
                        <div className="h-[2px] flex-1 bg-slate-100" />
                      </div>
                      <div className="space-y-2">
                        {groupData.matches.sort((a, b) => (a.kickoff?.seconds || 0) - (b.kickoff?.seconds || 0)).map(m => {
                          const tA = teams.find(t => t.id === m.teamAId), tB = teams.find(t => t.id === m.teamBId);
                          const isF = m.status === 'finished';
                          const winA = isF && (m.scoreA > m.scoreB || (m.scoreA===m.scoreB && (m.pensA||0)>(m.pensB||0)));
                          const winB = isF && (m.scoreB > m.scoreA || (m.scoreA===m.scoreB && (m.pensB||0)>(m.pensA||0)));
                          const isPens = isF && m.scoreA === m.scoreB && (m.pensA !== undefined || m.pensB !== undefined);
                          const isBye = m.placeholderA === 'BYE' || m.placeholderB === 'BYE';
                          
                          return (
                            <div key={m.id} onClick={() => setSelectedMatch(m)} className="bg-white px-4 py-4 rounded-2xl border border-slate-100 flex items-center group hover:border-emerald-400 transition-all shadow-sm cursor-pointer">
                              <div className="w-14 md:w-16 text-center border-r border-slate-100 pr-2 mr-2 flex flex-col items-center justify-center shrink-0">
                                <span className={`text-[10px] font-bold uppercase tracking-wider ${isF ? 'text-slate-400' : m.status === 'live' ? 'text-emerald-500 animate-pulse font-black' : 'text-slate-300'}`}>
                                  {isBye ? 'BYE' : (isF ? 'FT' : (m.status === 'live' ? 'Live' : 'vs'))}
                                </span>
                                {m.status === 'scheduled' && m.kickoff && !isBye && (
                                  <span className="text-[8px] font-semibold text-slate-400">{m.kickoff.toDate().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}</span>
                                )}
                              </div>
                              
                              <div className="flex-1 grid grid-cols-[1fr_auto_1fr] items-center gap-2 md:gap-4 min-w-0">
                                {/* Team A */}
                                <div className="flex items-center justify-end gap-2 md:gap-3 min-w-0">
                                  <span className={`font-bold truncate text-xs md:text-sm lg:text-base text-right ${winA ? 'text-emerald-500' : m.placeholderA === 'BYE' ? 'text-slate-300 italic' : 'text-slate-700'}`}>
                                    {tA?.name || m.placeholderA || 'TBD'}
                                  </span>
                                  {tA?.logoURL ? (
                                    <img src={tA.logoURL} className="w-6 h-6 md:w-8 md:h-8 rounded-full object-contain flex-shrink-0" alt="" />
                                  ) : (
                                    <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-slate-50 flex items-center justify-center text-[10px] font-bold text-slate-200 flex-shrink-0 border border-slate-100">
                                      {tA?.name?.[0] || '?'}
                                    </div>
                                  )}
                                </div>
 
                                {/* Score Box */}
                                <div className={`px-2 md:px-3 py-1 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-center gap-2 ${isBye ? 'min-w-[120px] md:min-w-[160px]' : 'min-w-[54px] md:min-w-[80px]'}`}>
                                   {isBye ? (
                                     <span className="text-[9px] md:text-[10px] font-bold text-amber-500 uppercase tracking-tight">Advances as BYE</span>
                                   ) : m.status === 'scheduled' ? (
                                     <span className="text-[10px] font-bold text-slate-300">VS</span>
                                   ) : (
                                     <>
                                       <span className={`font-black text-sm md:text-base ${winA ? 'text-emerald-500 font-black' : 'text-slate-700'}`}>{m.scoreA}</span>
                                       <span className="text-slate-300 font-medium">-</span>
                                       <span className={`font-black text-sm md:text-base ${winB ? 'text-emerald-500 font-black' : 'text-slate-700'}`}>{m.scoreB}</span>
                                     </>
                                   )}
                                </div>
 
                                {/* Team B */}
                                <div className="flex items-center justify-start gap-2 md:gap-3 min-w-0">
                                  {tB?.logoURL ? (
                                    <img src={tB.logoURL} className="w-6 h-6 md:w-8 md:h-8 rounded-full object-contain flex-shrink-0" alt="" />
                                  ) : (
                                    <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-slate-50 flex items-center justify-center text-[10px] font-bold text-slate-200 flex-shrink-0 border border-slate-100">
                                      {tB?.name?.[0] || '?'}
                                    </div>
                                  )}
                                  <span className={`font-bold truncate text-xs md:text-sm lg:text-base text-left ${winB ? 'text-emerald-500' : m.placeholderB === 'BYE' ? 'text-slate-300 italic' : 'text-slate-700'}`}>
                                    {tB?.name || m.placeholderB || 'TBD'}
                                  </span>
                                </div>
                              </div>

                              <div className="w-6 flex items-center justify-end ml-2">
                                <ChevronRight className="w-4 h-4 text-slate-200 group-hover:text-emerald-500 transition-colors" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ));
              })()
            )}

          </motion.div>
        )}

        {activeTab === 'knockout' && (
           <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-8"><div className="max-w-7xl mx-auto overflow-x-auto pb-20 no-scrollbar"><div className="flex flex-col items-center gap-16 min-w-max">
             <div className="text-center space-y-2">
               <Trophy className="w-10 h-10 text-amber-500 mx-auto" />
               <h2 className="text-2xl font-bold uppercase italic tracking-tight">Knockout Stage</h2>
               <div className="h-1 w-12 bg-amber-500/20 mx-auto rounded-full" />
             </div>
              <div className="flex flex-col md:grid md:grid-cols-4 gap-12 items-center w-full">
                <div className="space-y-4 flex flex-col items-end">
                   {tiesByRound['Qualification']?.length > 0 && <div className="flex flex-col gap-4">{tiesByRound['Qualification'].map(t => <div key={t[0].id} className="space-y-2">{t.map(m => <BracketMatch key={m.id} match={m} teams={teams} position="left" onSelect={setSelectedMatch} compact={tournament.homeAwayKnockout} />)}</div>)}</div>}
                   {tiesByRound['Qualifier']?.length > 0 && <div className="flex flex-col gap-4">{tiesByRound['Qualifier'].map(t => <div key={t[0].id} className="space-y-2">{t.map(m => <BracketMatch key={m.id} match={m} teams={teams} position="left" onSelect={setSelectedMatch} compact={tournament.homeAwayKnockout} />)}</div>)}</div>}
                   {tiesByRound['Round of 16']?.length > 0 && <div className="flex flex-col gap-4">{tiesByRound['Round of 16'].slice(0,4).map(t => <div key={t[0].id} className="space-y-2">{t.map(m => <BracketMatch key={m.id} match={m} teams={teams} position="left" onSelect={setSelectedMatch} compact={tournament.homeAwayKnockout} />)}</div>)}</div>}
                </div>
                <div className="space-y-12 flex flex-col items-end">
                   {tiesByRound['Quarter-final']?.length > 0 && <div className="flex flex-col gap-8">{tiesByRound['Quarter-final'].slice(0,2).map(t => <div key={t[0].id} className="space-y-4">{t.map(m => <BracketMatch key={m.id} match={m} teams={teams} position="left" onSelect={setSelectedMatch} compact={tournament.homeAwayKnockout} />)}</div>)}</div>}
                   {tiesByRound['Semi-final']?.length > 0 && <div className="min-h-[200px] flex flex-col justify-center">{tiesByRound['Semi-final'].slice(0,1).map(t => <div key={t[0].id} className="space-y-4">{t.map(m => <BracketMatch key={m.id} match={m} teams={teams} position="left" onSelect={setSelectedMatch} compact={tournament.homeAwayKnockout} />)}</div>)}</div>}
                </div>
                <div className="order-first md:order-none flex flex-col items-center gap-12">
                   <div className="flex flex-col items-center gap-12 bg-slate-50/50 p-12 rounded-[60px] border border-slate-100 shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-amber-500 text-white px-8 py-2 rounded-b-2xl text-[10px] font-bold uppercase tracking-widest shadow-lg z-20">Grand Final</div>
                      {tiesByRound['Final']?.length > 0 ? (
                         tiesByRound['Final']?.map(t => <div key={t[0].id} className="space-y-6 relative z-10">{t.map(m => <div key={m.id} onClick={() => setSelectedMatch(m)} className="bg-white p-10 rounded-[40px] border-2 border-amber-500/30 shadow-xl scale-110 hover:scale-125 transition-transform cursor-pointer"><div className="flex items-center gap-8"><TeamSlot id={m.teamAId} teams={teams} /><div className="flex flex-col items-center gap-2 text-slate-900"><span className="text-4xl font-black">{m.status==='scheduled'?'-':m.scoreA}</span><span className="text-[10px] font-bold text-slate-300">VS</span><span className="text-4xl font-black">{m.status==='scheduled'?'-':m.scoreB}</span></div><TeamSlot id={m.teamBId} teams={teams} /></div></div>)}</div>)
                      ) : (
                         <div className="p-10 text-slate-300 font-bold uppercase italic text-sm tracking-widest">Finalists pending</div>
                      )}
                   </div>
                   {tournament.hasLosersFinal && (
                      <div className="flex flex-col items-center gap-6 bg-slate-50/30 p-8 rounded-[40px] border border-slate-100/50">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">3rd Place Match</div>
                        {tiesByRound['Losers Final']?.length > 0 ? (
                           tiesByRound['Losers Final']?.map(t => <div key={t[0].id} className="space-y-4">{t.map(m => <BracketMatch key={m.id} match={m} teams={teams} position="center" onSelect={setSelectedMatch} compact={tournament.homeAwayKnockout} />)}</div>)
                        ) : (
                           <div className="text-xs font-bold text-slate-300 uppercase tracking-widest">TBD</div>
                        )}
                      </div>
                   )}
                </div>
                <div className="space-y-12">
                   {tiesByRound['Semi-final']?.length > 0 && <div className="min-h-[200px] flex flex-col justify-center">{tiesByRound['Semi-final'].slice(1,2).map(t => <div key={t[0].id} className="space-y-4">{t.map(m => <BracketMatch key={m.id} match={m} teams={teams} position="right" onSelect={setSelectedMatch} compact={tournament.homeAwayKnockout} />)}</div>)}</div>}
                   {tiesByRound['Quarter-final']?.length > 0 && <div className="flex flex-col gap-8">{tiesByRound['Quarter-final'].slice(2,4).map(t => <div key={t[0].id} className="space-y-4">{t.map(m => <BracketMatch key={m.id} match={m} teams={teams} position="right" onSelect={setSelectedMatch} compact={tournament.homeAwayKnockout} />)}</div>)}</div>}
                </div>
                <div className="space-y-4">
                   {tiesByRound['Round of 16']?.length > 0 && <div className="flex flex-col gap-4">{tiesByRound['Round of 16'].slice(4,8).map(t => <div key={t[0].id} className="space-y-2">{t.map(m => <BracketMatch key={m.id} match={m} teams={teams} position="right" onSelect={setSelectedMatch} compact={tournament.homeAwayKnockout} />)}</div>)}</div>}
                   {tiesByRound['Qualifier']?.length > 0 && <div className="flex flex-col gap-4">{tiesByRound['Qualifier'].map(t => <div key={t[0].id} className="space-y-2">{t.map(m => <BracketMatch key={m.id} match={m} teams={teams} position="right" onSelect={setSelectedMatch} compact={tournament.homeAwayKnockout} />)}</div>)}</div>}
                   {tiesByRound['Qualification']?.length > 0 && <div className="flex flex-col gap-4">{tiesByRound['Qualification'].map(t => <div key={t[0].id} className="space-y-2">{t.map(m => <BracketMatch key={m.id} match={m} teams={teams} position="right" onSelect={setSelectedMatch} compact={tournament.homeAwayKnockout} />)}</div>)}</div>}
                </div>
             </div>
           </div></div></motion.div>
        )}

        {activeTab === 'standings' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8">
            {(tournament.type === 'league_playoff' ? Array.from({ length: tournament.numberOfGroups || 0 }).map((_, i) => `Group ${String.fromCharCode(65 + i)}`) : [undefined]).map(g => {
              const s = getStandingsForGroup(g);
              const hasGroupLiveMatch = matches.some(m => m.status === 'live' && m.group !== 'Playoffs' && (g ? (m.group === g || (m.teamAId && teams.find(team => team.id === m.teamAId)?.group === g)) : true));
              return (
                <div key={g || 'All'} className="space-y-4">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    {g && <h3 className="text-xl font-black italic">{g}</h3>}
                    {hasGroupLiveMatch && (
                      <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-600 border border-emerald-100 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest animate-pulse ml-auto">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full block animate-ping" />
                        Live Standings Active
                      </span>
                    )}
                  </div>
                  <div className="bg-white rounded-3xl border border-slate-100 overflow-x-auto shadow-sm">
                    <table className="min-w-[500px] md:min-w-full text-left">
                      <thead><tr className="bg-slate-50 border-b border-slate-100"><th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-400 tracking-wider">#</th><th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-400 tracking-wider">Team</th><th className="px-3 py-3 text-[10px] font-bold uppercase text-slate-400 tracking-wider text-center">MP</th><th className="px-3 py-3 text-[10px] font-bold uppercase text-slate-400 tracking-wider text-center">PTS</th><th className="px-2 py-3 text-[10px] font-bold uppercase text-slate-400 tracking-wider text-center">GF</th><th className="px-2 py-3 text-[10px] font-bold uppercase text-slate-400 tracking-wider text-center">GA</th><th className="px-3 py-3 text-[10px] font-bold uppercase text-slate-400 tracking-wider text-center">GD</th></tr></thead>
                      <tbody className="divide-y divide-slate-50">
                         {s.map((t, idx) => {
                            const liveMatchForTeam = matches.find(m => m.status === 'live' && m.group !== 'Playoffs' && (m.teamAId === t.id || m.teamBId === t.id));
                            let liveStatus: 'winning' | 'losing' | 'drawing' | null = null;
                            let oppName = '';
                            if (liveMatchForTeam) {
                              const isA = liveMatchForTeam.teamAId === t.id;
                              const sScore = isA ? (liveMatchForTeam.scoreA || 0) : (liveMatchForTeam.scoreB || 0);
                              const oScore = isA ? (liveMatchForTeam.scoreB || 0) : (liveMatchForTeam.scoreA || 0);
                              const oppId = isA ? liveMatchForTeam.teamBId : liveMatchForTeam.teamAId;
                              oppName = teams.find(team => team.id === oppId)?.name || 'Opponent';
                              if (sScore > oScore) liveStatus = 'winning';
                              else if (sScore < oScore) liveStatus = 'losing';
                              else liveStatus = 'drawing';
                            }
                            return (
                              <tr key={t.id} className="hover:bg-slate-50 transition-colors cursor-pointer group" onClick={() => setSelectedTeam(t)}>
                                <td className="px-4 py-3 font-bold text-slate-300 text-xs">{idx + 1}</td>
                                <td className="px-4 py-3 font-semibold flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-3">
                                    {t.logoURL ? <img src={t.logoURL} className="w-8 h-8 rounded-full object-contain" /> : <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100" />}
                                    <span className="text-sm group-hover:text-emerald-600 transition-colors">{t.name}</span>
                                  </div>
                                  {liveStatus && (
                                    <div className="flex items-center justify-center shrink-0 w-4 h-4 select-none"
                                         title={`Live match vs ${oppName} (${liveMatchForTeam?.scoreA} - ${liveMatchForTeam?.scoreB})`}>
                                      <span className="relative flex h-2 w-2">
                                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                                          liveStatus === 'winning' ? 'bg-emerald-400' : liveStatus === 'losing' ? 'bg-rose-400' : 'bg-slate-400'
                                        }`} />
                                        <span className={`relative inline-flex rounded-full h-2 w-2 ${
                                          liveStatus === 'winning' ? 'bg-emerald-500' : liveStatus === 'losing' ? 'bg-rose-500' : 'bg-slate-500'
                                        }`} />
                                      </span>
                                    </div>
                                  )}
                                </td>
                                <td className="px-3 py-3 text-center font-semibold text-slate-400 text-sm">{t.played}</td>
                                <td className="px-3 py-3 text-center">
                                  <span className="bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-lg font-bold text-xs tracking-tight">
                                    {t.points}
                                  </span>
                                </td>
                                <td className="px-2 py-3 text-center font-medium text-slate-400 text-xs">{t.gf}</td>
                                <td className="px-2 py-3 text-center font-medium text-slate-400 text-xs">{t.ga}</td>
                                <td className="px-3 py-3 text-center font-semibold text-emerald-500 text-sm">{t.gd > 0 ? `+${t.gd}` : t.gd}</td>
                              </tr>
                            );
                         })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </motion.div>
        )}

        {activeTab === 'teams' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
            {matches.length === 0 && (isCreator || (user && !teams.some(t => t.creatorId === user.uid))) && (
              <div className="flex justify-end"><button onClick={() => setShowAddTeam(true)} className="bg-emerald-500 text-white px-6 py-3 rounded-full text-xs font-black shadow-lg flex items-center gap-2"><Plus className="w-4 h-4" />{isCreator ? 'Add Team' : 'Register Squad'}</button></div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
              {teams.length === 0 ? <div className="col-span-full py-20 text-center font-bold text-slate-300 uppercase bg-white rounded-3xl italic">No teams yet</div> : 
                teams.map(t => (
                  <div key={t.id} onClick={() => setSelectedTeam(t)} className="bg-white border border-slate-100 rounded-3xl p-6 flex flex-col items-center gap-4 cursor-pointer hover:border-emerald-200 hover:shadow-xl transition-all h-full shadow-sm">
                    <div className="w-20 h-20 bg-slate-50 rounded-full border border-slate-50 overflow-hidden flex items-center justify-center">{t.logoURL ? <img src={t.logoURL} className="w-full h-full object-contain" /> : <Users className="w-10 h-10 text-slate-200" />}</div>
                    <span className="font-black text-xs uppercase tracking-tight text-center">{t.name}</span>
                  </div>
                ))
              }
            </div>
          </motion.div>
        )}

        {activeTab === 'stats' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-12">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {/* Golden Boot */}
                <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm">
                   <div className="flex items-center gap-3 mb-6"><div className="w-10 h-10 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg"><SoccerIcon className="w-6 h-6 text-white" /></div><h3 className="font-black uppercase italic">Golden Boot</h3></div>
                   <div className="space-y-4">
                      {Array.from(new Set(events.filter(e => e.type === 'goal' && e.goalType !== 'own_goal' && !e.isPenaltyShootout).map(e => e.playerId))).map(pid => {
                        const p = allPlayers.find(pl => pl.id === pid);
                        const goals = events.filter(e => e.type === 'goal' && e.goalType !== 'own_goal' && !e.isPenaltyShootout && e.playerId === pid).length;
                        return { pid, name: p?.name || 'Unknown', goals };
                      }).filter(p => p.goals > 0 && p.name !== 'Unknown').sort((a,b) => b.goals - a.goals).slice(0,5).map((p, i) => (
                        <div key={p.pid} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl">
                           <div className="flex items-center gap-3"><span className="text-[10px] font-black text-slate-300">#0{i+1}</span><span className="font-bold text-xs">{p.name.split(' ')[0]}</span></div>
                           <span className="bg-white w-8 h-8 rounded-xl flex items-center justify-center shadow-sm font-black text-emerald-500 text-sm">{p.goals}</span>
                        </div>
                      ))}
                      {events.filter(e => e.type === 'goal' && e.goalType !== 'own_goal').length === 0 && <p className="text-center py-10 text-slate-300 italic font-bold">No goals yet</p>}
                   </div>
                </div>
                {/* Playmakers */}
                <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm">
                   <div className="flex items-center gap-3 mb-6"><div className="w-10 h-10 bg-blue-500 rounded-2xl flex items-center justify-center shadow-lg"><Footprints className="w-6 h-6 text-white" /></div><h3 className="font-black uppercase italic">Playmakers</h3></div>
                   <div className="space-y-4">
                      {Array.from(new Set(events.filter(e => e.type === 'goal' && e.assistantId && !e.isPenaltyShootout).map(e => e.assistantId!))).map(aid => {
                        const p = allPlayers.find(pl => pl.id === aid);
                        const assists = events.filter(e => e.type === 'goal' && e.assistantId === aid && !e.isPenaltyShootout).length;
                        return { aid, name: p?.name || 'Unknown', assists };
                      }).filter(p => p.assists > 0 && p.name !== 'Unknown').sort((a,b) => b.assists - a.assists).slice(0,5).map((p, i) => (
                        <div key={p.aid} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl">
                           <div className="flex items-center gap-3"><span className="text-[10px] font-black text-slate-300">#0{i+1}</span><span className="font-bold text-xs">{p.name.split(' ')[0]}</span></div>
                           <span className="bg-white w-8 h-8 rounded-xl flex items-center justify-center shadow-sm font-black text-blue-500 text-sm">{p.assists}</span>
                        </div>
                      ))}
                   </div>
                </div>
                {/* Awards */}
                <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm">
                   <div className="flex items-center gap-3 mb-6"><div className="w-10 h-10 bg-amber-500 rounded-2xl flex items-center justify-center shadow-lg"><Star className="w-6 h-6 text-white fill-current" /></div><h3 className="font-black uppercase italic">Most MVPs</h3></div>
                   <div className="space-y-4">
                      {Array.from(new Set(matches.filter(m => m.manOfTheMatchId).map(m => m.manOfTheMatchId!))).map(pid => {
                        const p = allPlayers.find(pl => pl.id === pid);
                        const awards = matches.filter(m => m.manOfTheMatchId === pid).length;
                        return { pid, name: p?.name || 'Unknown', awards };
                      }).filter(p => p.awards > 0 && p.name !== 'Unknown').sort((a,b) => b.awards - a.awards).slice(0,5).map((p, i) => (
                        <div key={p.pid} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl">
                           <div className="flex items-center gap-3"><span className="text-[10px] font-black text-slate-300">#0{i+1}</span><span className="font-bold text-xs">{p.name.split(' ')[0]}</span></div>
                           <span className="bg-white w-8 h-8 rounded-xl flex items-center justify-center shadow-sm font-black text-amber-500 text-sm">{p.awards}</span>
                        </div>
                      ))}
                   </div>
                </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAddTeam && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddTeam(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white w-full max-w-md rounded-[32px] p-10 shadow-2xl">
              <button onClick={() => setShowAddTeam(false)} className="absolute right-6 top-6 p-2 text-slate-300 hover:text-slate-600 transition-colors"><X className="w-5 h-5" /></button>
              <h2 className="text-3xl font-black mb-8 tracking-tighter italic">Register Team</h2>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const name = (e.currentTarget.elements.namedItem('team-name') as HTMLInputElement).value.trim();
                const fileInput = e.currentTarget.elements.namedItem('team-logo') as HTMLInputElement;
                let logoURL = "";
                if (fileInput.files?.[0]) {
                  const reader = new FileReader();
                  logoURL = await new Promise(r => { reader.onload = () => r(reader.result as string); reader.readAsDataURL(fileInput.files![0]); });
                }
                try {
                  await addDoc(collection(db, `/tournaments/${tournament.id}/teams`), cleanObj({ name, logoURL, tournamentId: tournament.id, creatorId: user?.uid, createdAt: serverTimestamp() }));
                  setShowAddTeam(false);
                } catch (err) { handleFirestoreError(err, OperationType.WRITE, `teams`); }
              }} className="space-y-6">
                <div className="space-y-2"><label className="text-[10px] font-black uppercase text-slate-400">Team Name</label><input name="team-name" required className="w-full bg-slate-50 px-6 py-5 rounded-2xl border border-slate-100 font-bold" placeholder="e.g. Real Madrid" /></div>
                <div className="space-y-2"><label className="text-[10px] font-black uppercase text-slate-400">Team Icon</label><div className="relative group"><input name="team-logo" type="file" accept="image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" /><div className="w-full bg-slate-50 px-5 py-10 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center gap-3 transition-all group-hover:border-emerald-500 group-hover:bg-emerald-50/50"><Plus className="w-8 h-8 text-slate-200" /><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Select Icon</span></div></div></div>
                <button type="submit" className="w-full bg-emerald-500 text-white font-black py-5 rounded-2xl shadow-xl shadow-emerald-500/20 active:scale-95 transition-all">Confirm Registration</button>
              </form>
            </motion.div>
          </div>
        )}

        {showAddMatch && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddMatch(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white w-full max-w-md rounded-[32px] p-10 shadow-2xl">
              <button onClick={() => setShowAddMatch(false)} className="absolute right-6 top-6 p-2 text-slate-300 hover:text-slate-600 transition-colors"><X className="w-5 h-5" /></button>
              <h2 className="text-3xl font-black mb-8 tracking-tighter italic">Schedule Match</h2>
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
                <select name="teamA" required className="w-full bg-slate-50 px-5 py-4 rounded-2xl border border-slate-100 font-bold"><option value="">Select Team A</option>{teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
                <select name="teamB" required className="w-full bg-slate-50 px-5 py-4 rounded-2xl border border-slate-100 font-bold"><option value="">Select Team B</option>{teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
                <input name="kickoff" type="datetime-local" className="w-full bg-slate-50 px-5 py-4 rounded-2xl border border-slate-100 font-bold" />
                <button type="submit" className="w-full bg-emerald-500 text-white font-black py-5 rounded-2xl shadow-xl shadow-emerald-500/20 active:scale-95 transition-all">Create Match</button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
