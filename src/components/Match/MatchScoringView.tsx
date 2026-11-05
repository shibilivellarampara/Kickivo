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
  getDocs,
  setDoc
} from 'firebase/firestore';
import { 
  Users, 
  Trophy, 
  Shield, 
  ArrowLeftRight, 
  ArrowUp, 
  ArrowDown, 
  ArrowRight,
  X, 
  Zap,
  Star,
  Footprints,
  Clock,
  CheckCircle2,
  RotateCcw,
  Unlock
} from 'lucide-react';
import { db, OperationType, handleFirestoreError } from '../../lib/firebase';
import { Tournament, Match, Team, Player, MatchEvent, MatchEventType, GoalType } from '../../types';
import { sortPlayersByPosition } from '../../utils/football';
import { SoccerIcon, AppLogo, MissedPenaltyIcon } from '../common/Icons';
import { renderTeamLogo } from '../../utils/avatarUtils';
import { MatchTimer } from './MatchTimer';
import { MatchEventLog } from './MatchEventLog';
import { LineupSetupWizard } from './LineupSetupWizard';
import { MatchEventModal } from './MatchEventModal';
import { PenaltyShootoutModal } from './PenaltyShootoutModal';

interface MatchScoringViewProps {
  tournament: Tournament;
  match: Match;
  teams: Team[];
  allPlayers: Player[];
  onBack: () => void;
  isCreator: boolean;
  notify: (msg: string) => void;
  matches: Match[];
  onSelectPlayer?: (player: Player) => void;
  onSelectTeam?: (team: Team) => void;
}

export const MatchScoringView: React.FC<MatchScoringViewProps> = ({ 
  tournament, 
  match, 
  teams, 
  allPlayers, 
  onBack, 
  isCreator, 
  notify, 
  matches,
  onSelectPlayer,
  onSelectTeam
}) => {
  const [liveMatch, setLiveMatch] = useState<Match>(match);
  const [isPenaltyShootoutMode, setIsPenaltyShootoutMode] = useState(false);
  const [playersA, setPlayersA] = useState<Player[]>([]);
  const [playersB, setPlayersB] = useState<Player[]>([]);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [showEventModal, setShowEventModal] = useState<{ side: 'A' | 'B', type: MatchEventType, step: number, data?: any } | null>(null);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [showLineupConfirm, setShowLineupConfirm] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    actionLabel: string;
    isDangerous?: boolean;
    onConfirm: () => void;
  } | null>(null);

  // Pre-game lineup and substitutes selections states
  const [tempLineupA, setTempLineupA] = useState<string[]>([]);
  const [tempSubsA, setTempSubsA] = useState<string[]>([]);
  const [tempLineupB, setTempLineupB] = useState<string[]>([]);
  const [tempSubsB, setTempSubsB] = useState<string[]>([]);
  const [setupStep, setSetupStep] = useState<'teamA' | 'teamB' | 'confirm'>('teamA');

  // Helper to remove undefined values before Firestore writes
  const cleanObj = (obj: any) => {
    const newObj = { ...obj };
    Object.keys(newObj).forEach(key => {
      if (newObj[key] === undefined) delete newObj[key];
    });
    return newObj;
  };

  const isEfootball = tournament.category === 'efootball' || tournament.isEfootball;

  const startDirectKickoff = async () => {
    if (!isCreator) return;
    try {
      await updateDoc(doc(db, `tournaments/${tournament.id}/matches/${match.id}`), {
        status: 'live',
        isTimerRunning: true,
        timerStartTime: serverTimestamp(),
        elapsedTimeOnPause: 0,
      });
      notify('🎮 eFootball match started & live!');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `tournaments/${tournament.id}/matches/${match.id}`);
    }
  };

  const addTeamGoal = async (teamId: string) => {
    if (!isCreator) return;
    try {
      const matchRef = doc(db, `tournaments/${tournament.id}/matches/${match.id}`);
      const isTeamA = teamId === match.teamAId;
      const matchTime = getMatchTime();
      const currentScore = isTeamA ? liveMatch.scoreA : liveMatch.scoreB;

      await addDoc(collection(db, `tournaments/${tournament.id}/matches/${match.id}/events`), cleanObj({
        matchId: match.id,
        tournamentId: tournament.id,
        type: 'goal',
        playerId: null,
        userId: null,
        assistantId: null,
        assistantUserId: null,
        goalType: 'open_goal',
        teamId,
        minute: 0,
        timestamp: matchTime,
        createdAt: serverTimestamp(),
      }));

      await setDoc(matchRef, {
        [isTeamA ? 'scoreA' : 'scoreB']: currentScore + 1,
        status: 'live'
      }, { merge: true });

      const teamName = isTeamA ? (teamA?.name || 'Team A') : (teamB?.name || 'Team B');
      notify(`⚽ Goal for ${teamName}!`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `tournaments/${tournament.id}/matches/${match.id}/events`);
    }
  };

  const decrementTeamScore = async (teamId: string) => {
    if (!isCreator) return;
    try {
      const isTeamA = teamId === match.teamAId;
      const currentScore = isTeamA ? liveMatch.scoreA : liveMatch.scoreB;
      if (currentScore <= 0) return;

      const matchRef = doc(db, `tournaments/${tournament.id}/matches/${match.id}`);
      
      const lastGoal = events.filter(e => e.type === 'goal' && e.teamId === teamId).pop();
      if (lastGoal) {
        await deleteDoc(doc(db, `tournaments/${tournament.id}/matches/${match.id}/events/${lastGoal.id}`));
      }

      await setDoc(matchRef, {
        [isTeamA ? 'scoreA' : 'scoreB']: Math.max(0, currentScore - 1),
      }, { merge: true });

      const teamName = isTeamA ? (teamA?.name || 'Team A') : (teamB?.name || 'Team B');
      notify(`Score reduced for ${teamName}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `tournaments/${tournament.id}/matches/${match.id}`);
    }
  };

  const teamA = teams.find(t => t.id === match.teamAId);
  const teamB = teams.find(t => t.id === match.teamBId);

  useEffect(() => {
    const unsubMatch = onSnapshot(doc(db, `tournaments/${tournament.id}/matches/${match.id}`), (s) => {
      if (s.exists()) setLiveMatch({ id: s.id, ...s.data() } as Match);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `tournaments/${tournament.id}/matches/${match.id}`);
    });

    const unsubEvents = onSnapshot(collection(db, `tournaments/${tournament.id}/matches/${match.id}/events`), (s) => {
      setEvents(s.docs.map(d => ({ id: d.id, ...d.data() } as MatchEvent)));
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `tournaments/${tournament.id}/matches/${match.id}/events`);
    });

    const fetchPlayers = async () => {
      try {
        const qA = query(collection(db, `tournaments/${tournament.id}/teams/${match.teamAId}/players`));
        const qB = query(collection(db, `tournaments/${tournament.id}/teams/${match.teamBId}/players`));
        const [sA, sB] = await Promise.all([getDocs(qA), getDocs(qB)]);
        setPlayersA(sA.docs.map(d => ({ id: d.id, ...d.data() } as Player)));
        setPlayersB(sB.docs.map(d => ({ id: d.id, ...d.data() } as Player)));
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `players`);
      }
    };

    fetchPlayers();

    return () => {
      unsubMatch();
      unsubEvents();
    };
  }, [tournament.id, match.id, match.teamAId, match.teamBId]);

  const getMatchTime = () => {
    if (!liveMatch.isTimerRunning && (liveMatch.elapsedTimeOnPause === 0 || liveMatch.elapsedTimeOnPause === undefined)) {
      return null;
    }
    
    let seconds = liveMatch.elapsedTimeOnPause || 0;
    if (liveMatch.isTimerRunning && liveMatch.timerStartTime) {
      const startTime = liveMatch.timerStartTime.toMillis ? liveMatch.timerStartTime.toMillis() : new Date(liveMatch.timerStartTime).getTime();
      const diff = Math.floor((Date.now() - startTime) / 1000);
      seconds += diff;
    }
    
    const mins = Math.floor(seconds / 60);
    return `${mins}'`;
  };

  const addEvent = async (playerId: string, type: MatchEventType, teamId: string, metadata?: { assistantId?: string, goalType?: GoalType, isPenaltyShootout?: boolean, penaltyResult?: 'goal' | 'miss' }) => {
    if (!isCreator) return;
    try {
      const matchRef = doc(db, `tournaments/${tournament.id}/matches/${match.id}`);
      const isTeamA = teamId === match.teamAId;
      
      const playerRecord = (isTeamA ? playersA : playersB).find(p => p.id === playerId);
      const assistantRecord = metadata?.assistantId ? (isTeamA ? playersA : playersB).find(p => p.id === metadata.assistantId) : null;

      const matchTime = getMatchTime();
      const isPenaltyShootout = metadata?.isPenaltyShootout || false;
      const isNoAssistGoal = metadata?.goalType === 'own_goal' || metadata?.goalType === 'free_kick' || metadata?.goalType === 'penalty';

      await addDoc(collection(db, `tournaments/${tournament.id}/matches/${match.id}/events`), cleanObj({
        matchId: match.id,
        tournamentId: tournament.id,
        type,
        playerId,
        userId: playerRecord?.userId || null,
        assistantId: (isNoAssistGoal || isPenaltyShootout) ? null : (metadata?.assistantId || null),
        assistantUserId: (isNoAssistGoal || isPenaltyShootout) ? null : (assistantRecord?.userId || null),
        goalType: metadata?.goalType || (type === 'goal' ? 'open_goal' : null),
        teamId,
        minute: 0, 
        timestamp: isPenaltyShootout ? 'Pens' : matchTime,
        createdAt: serverTimestamp(),
        isPenaltyShootout,
        penaltyResult: metadata?.penaltyResult || null
      }));

      if (type === 'goal') {
        const isOwnGoal = metadata?.goalType === 'own_goal';
        const teamToIncrementIsA = isOwnGoal ? !isTeamA : isTeamA;
        
        if (isPenaltyShootout) {
          const field = teamToIncrementIsA ? 'pensA' : 'pensB';
          await setDoc(matchRef, {
            [field]: (liveMatch[field] || 0) + 1,
            status: 'live'
          }, { merge: true });
        } else {
          await setDoc(matchRef, {
            [teamToIncrementIsA ? 'scoreA' : 'scoreB']: (teamToIncrementIsA ? liveMatch.scoreA : liveMatch.scoreB) + 1,
            status: 'live'
          }, { merge: true });
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `tournaments/${tournament.id}/matches/${match.id}/events`);
    }
  };

  const undoEvent = async (eventId: string) => {
    if (!isCreator) return;
    
    const eventToDelete = events.find(e => e.id === eventId);
    if (!eventToDelete) return;

    setConfirmModal({
      title: "Delete Event",
      message: "Are you sure you want to delete this event from the timeline? This will update the match score accordingly.",
      actionLabel: "Delete",
      isDangerous: true,
      onConfirm: async () => {
        try {
          const matchRef = doc(db, `tournaments/${tournament.id}/matches/${match.id}`);
          const eventRef = doc(db, `tournaments/${tournament.id}/matches/${match.id}/events/${eventId}`);

          if (eventToDelete.type === 'goal' || (eventToDelete.type === 'penalty_kick' && eventToDelete.penaltyResult === 'goal')) {
            const isTeamA = eventToDelete.teamId === match.teamAId;
            const isOwnGoal = eventToDelete.type === 'goal' && eventToDelete.goalType === 'own_goal';
            const isPenaltyShootout = eventToDelete.isPenaltyShootout;
            
            if (isPenaltyShootout) {
              const field = isTeamA ? 'pensA' : 'pensB';
              await updateDoc(matchRef, {
                [field]: Math.max(0, (liveMatch[field] || 0) - 1)
              });
            } else {
              const teamToDecrementIsA = isOwnGoal ? !isTeamA : isTeamA;
              await updateDoc(matchRef, {
                [teamToDecrementIsA ? 'scoreA' : 'scoreB']: Math.max(0, (teamToDecrementIsA ? liveMatch.scoreA : liveMatch.scoreB) - 1)
              });
            }
          }

          await deleteDoc(eventRef);
          notify('Event deleted and score updated.');
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `tournaments/${tournament.id}/matches/${match.id}/events/${eventId}`);
        } finally {
          setConfirmModal(null);
        }
      }
    });
  };

  const addPenaltyKick = async (playerId: string, teamId: string, result: 'goal' | 'miss') => {
    if (!isCreator) return;
    try {
      const matchRef = doc(db, `tournaments/${tournament.id}/matches/${match.id}`);
      const isTeamA = teamId === match.teamAId;
      const playerRecord = (isTeamA ? playersA : playersB).find(p => p.id === playerId);

      await addDoc(collection(db, `tournaments/${tournament.id}/matches/${match.id}/events`), cleanObj({
        matchId: match.id,
        tournamentId: tournament.id,
        type: 'penalty_kick',
        playerId,
        userId: playerRecord?.userId || null,
        teamId,
        minute: 0,
        timestamp: 'Pens',
        createdAt: serverTimestamp(),
        isPenaltyShootout: true,
        penaltyResult: result
      }));

      if (result === 'goal') {
        const field = isTeamA ? 'pensA' : 'pensB';
        await setDoc(matchRef, {
          [field]: (liveMatch[field] || 0) + 1,
          status: 'live'
        }, { merge: true });
      }
      notify(`Penalty ${result} recorded`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `tournaments/${tournament.id}/matches/${match.id}/events`);
    }
  };


  const addMilestone = async (type: 'half_time' | 'full_time' | 'extra_time' | 'penalties' | 'end') => {
    if (!isCreator) return;
    try {
      const matchTime = getMatchTime();
      const matchRef = doc(db, `tournaments/${tournament.id}/matches/${match.id}`);
      const updateData: any = {
        isTimerRunning: false,
        timerStartTime: null
      };

      if (type === 'extra_time') {
        await addDoc(collection(db, `tournaments/${tournament.id}/matches/${match.id}/events`), cleanObj({
          matchId: liveMatch.id,
          tournamentId: tournament.id,
          type: 'milestone',
          milestoneType: type,
          playerId: 'system',
          teamId: 'system',
          timestamp: matchTime,
          createdAt: serverTimestamp()
        }));
        updateData.status = 'live';
      } else if (type === 'penalties') {
        if (milestonesValues.hasET) {
           await addDoc(collection(db, `tournaments/${tournament.id}/matches/${match.id}/events`), cleanObj({
             matchId: liveMatch.id,
             tournamentId: tournament.id,
             type: 'milestone',
             milestoneType: 'et_ended',
             playerId: 'system',
             teamId: 'system',
             timestamp: matchTime,
             createdAt: serverTimestamp()
           }));
        }
        
        await addDoc(collection(db, `tournaments/${tournament.id}/matches/${match.id}/events`), cleanObj({
          matchId: liveMatch.id,
          tournamentId: tournament.id,
          type: 'milestone',
          milestoneType: 'penalties',
          playerId: 'system',
          teamId: 'system',
          timestamp: 'Pens',
          createdAt: serverTimestamp()
        }));

        setIsPenaltyShootoutMode(true);
      } else {
        await addDoc(collection(db, `tournaments/${tournament.id}/matches/${match.id}/events`), cleanObj({
          matchId: liveMatch.id,
          tournamentId: tournament.id,
          type: 'milestone',
          milestoneType: type,
          playerId: 'system',
          teamId: 'system',
          timestamp: matchTime,
          createdAt: serverTimestamp()
        }));
      }

      await updateDoc(matchRef, updateData);
      if (type === 'end') setShowFinishConfirm(true);
      
      const msgs = {
        half_time: 'First half ended',
        full_time: 'Full time recorded',
        extra_time: 'Extra time started',
        penalties: 'Penalty shootout started',
        end: 'Match ready to finish'
      };
      notify(msgs[type]);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `events`);
    }
  };

  const finishMatch = async () => {
    if (!isCreator || isFinishing) return;
    const isKnockout = liveMatch.group === 'Playoffs' || liveMatch.round;
    const isFirstLeg = liveMatch.leg === 1;

    if (isKnockout && !isFirstLeg) {
      if (liveMatch.leg === 2 && liveMatch.tieId) {
        const matchesInTie = matches.filter(m => m.tieId === liveMatch.tieId);
        const leg1 = matchesInTie.find(m => m.leg === 1);
        if (leg1 && leg1.status === 'finished') {
          const aggA = leg1.scoreA + liveMatch.scoreB;
          const aggB = leg1.scoreB + liveMatch.scoreA;
          if (aggA === aggB && (liveMatch.pensA || 0) === (liveMatch.pensB || 0)) {
            return notify('Aggregate is a draw. Please record penalties.');
          }
        }
      } else if (!liveMatch.leg && liveMatch.scoreA === liveMatch.scoreB && (liveMatch.pensA || 0) === (liveMatch.pensB || 0)) {
        return notify('Knockout matches must have a winner. Please record penalties.');
      }
    }

    setIsFinishing(true);
    try {
      const suggested = getSuggestedMotM();
      const matchRef = doc(db, `tournaments/${tournament.id}/matches/${match.id}`);
      const updateData: any = { status: 'finished', updatedAt: serverTimestamp() };
      if (!liveMatch.manOfTheMatchId && suggested) updateData.manOfTheMatchId = suggested;
      
      await updateDoc(matchRef, cleanObj(updateData));

      // Finish tournament if it's the final
      if (liveMatch.round === 'Final') {
        const tournamentRef = doc(db, `tournaments/${tournament.id}`);
        await updateDoc(tournamentRef, { status: 'completed', updatedAt: serverTimestamp() });
      }

      // Bracket Progression
      if (liveMatch.successorMatchId) {
        let winnerId = null;
        if (liveMatch.tieId) {
          const matchesInTie = matches.filter(m => m.tieId === liveMatch.tieId);
          const allLegsInTie = matchesInTie.map(m => m.id === match.id ? { ...m, ...updateData, scoreA: liveMatch.scoreA, scoreB: liveMatch.scoreB, pensA: liveMatch.pensA, pensB: liveMatch.pensB, status: 'finished' } : m);
          if (allLegsInTie.every(m => m.status === 'finished')) {
            const l1 = allLegsInTie.find(m => m.leg === 1);
            const l2 = allLegsInTie.find(m => m.leg === 2);
            if (l1 && l2) {
              const aggA = l1.scoreA + l2.scoreB;
              const aggB = l1.scoreB + l2.scoreA;
              if (aggA > aggB) winnerId = l1.teamAId;
              else if (aggB > aggA) winnerId = l1.teamBId;
              else winnerId = (l2.pensA || 0) > (l2.pensB || 0) ? l2.teamAId : l2.teamBId;
            }
          }
        } else {
          winnerId = liveMatch.scoreA > liveMatch.scoreB ? liveMatch.teamAId : 
                     liveMatch.scoreB > liveMatch.scoreA ? liveMatch.teamBId :
                     ((liveMatch.pensA || 0) > (liveMatch.pensB || 0) ? liveMatch.teamAId : liveMatch.teamBId);
        }

        if (winnerId) {
          const successorIds = liveMatch.successorMatchId.split(',');
          for (const sId of successorIds) {
            const successorRef = doc(db, `tournaments/${tournament.id}/matches/${sId.trim()}`);
            const successorMatch = matches.find(m => m.id === sId.trim());
            if (successorMatch) {
              const side = liveMatch.successorSide;
              const finalSide = (successorMatch.leg === 2) ? (side === 'A' ? 'teamBId' : 'teamAId') : (side === 'A' ? 'teamAId' : 'teamBId');
              await updateDoc(successorRef, cleanObj({ [finalSide]: winnerId }));
            }
          }
        }

        if (liveMatch.loserSuccessorMatchId) {
          let loserId = null;
          if (liveMatch.tieId) {
            const matchesInTie = matches.filter(m => m.tieId === liveMatch.tieId);
            const allLegsInTie = matchesInTie.map(m => m.id === match.id ? { ...m, ...updateData, scoreA: liveMatch.scoreA, scoreB: liveMatch.scoreB, pensA: liveMatch.pensA, pensB: liveMatch.pensB, status: 'finished' } : m);
            if (allLegsInTie.every(m => m.status === 'finished')) {
              const l1 = allLegsInTie.find(m => m.leg === 1);
              const l2 = allLegsInTie.find(m => m.leg === 2);
              if (l1 && l2) {
                const aggA = l1.scoreA + l2.scoreB;
                const aggB = l1.scoreB + l2.scoreA;
                if (aggA < aggB) loserId = l1.teamAId;
                else if (aggB < aggA) loserId = l1.teamBId;
                else loserId = (l2.pensA || 0) < (l2.pensB || 0) ? l2.teamAId : l2.teamBId;
              }
            }
          } else {
            loserId = liveMatch.scoreA < liveMatch.scoreB ? liveMatch.teamAId : 
                      liveMatch.scoreB < liveMatch.scoreA ? liveMatch.teamBId :
                      ((liveMatch.pensA || 0) < (liveMatch.pensB || 0) ? liveMatch.teamAId : liveMatch.teamBId);
          }

          if (loserId) {
            const successorIds = liveMatch.loserSuccessorMatchId.split(',');
            for (const sId of successorIds) {
              const successorRef = doc(db, `tournaments/${tournament.id}/matches/${sId.trim()}`);
              const successorMatch = matches.find(m => m.id === sId.trim());
              if (successorMatch) {
                const side = liveMatch.loserSuccessorSide;
                const finalSide = (successorMatch.leg === 2) ? (side === 'A' ? 'teamBId' : 'teamAId') : (side === 'A' ? 'teamAId' : 'teamBId');
                await updateDoc(successorRef, cleanObj({ [finalSide]: loserId }));
              }
            }
          }
        }
      }

      setShowFinishConfirm(false);
      notify('Match finished successfully!');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `tournaments/${tournament.id}/matches/${match.id}`);
    } finally {
      setIsFinishing(false);
    }
  };

  const reopenMatch = async () => {
    if (!isCreator || isFinishing) return;
    setConfirmModal({
      title: "Reopen Match",
      message: "Are you sure you want to reopen this match? This will change the status back to 'live' and allow you to edit/delete timeline events or log new events.",
      actionLabel: "Reopen Live",
      onConfirm: async () => {
        setIsFinishing(true);
        try {
          const matchRef = doc(db, `tournaments/${tournament.id}/matches/${match.id}`);
          await updateDoc(matchRef, {
            status: 'live',
            updatedAt: serverTimestamp()
          });

          // If this is the Final or the tournament is completed, reopen the tournament
          if (liveMatch.round === 'Final' || tournament.status === 'completed') {
            const tournamentRef = doc(db, `tournaments/${tournament.id}`);
            await updateDoc(tournamentRef, {
              status: 'live',
              updatedAt: serverTimestamp()
            });
          }

          // Clear successor team placement fields in knockout matches because the final winner is no longer determined
          if (liveMatch.successorMatchId) {
            const successorIds = liveMatch.successorMatchId.split(',');
            for (const sId of successorIds) {
              const successorRef = doc(db, `tournaments/${tournament.id}/matches/${sId.trim()}`);
              const successorMatch = matches.find(m => m.id === sId.trim());
              if (successorMatch) {
                const side = liveMatch.successorSide;
                const finalSide = (successorMatch.leg === 2) ? (side === 'A' ? 'teamBId' : 'teamAId') : (side === 'A' ? 'teamAId' : 'teamBId');
                await updateDoc(successorRef, { [finalSide]: "" });
              }
            }
          }
          if (liveMatch.loserSuccessorMatchId) {
            const successorIds = liveMatch.loserSuccessorMatchId.split(',');
            for (const sId of successorIds) {
              const successorRef = doc(db, `tournaments/${tournament.id}/matches/${sId.trim()}`);
              const successorMatch = matches.find(m => m.id === sId.trim());
              if (successorMatch) {
                const side = liveMatch.loserSuccessorSide;
                const finalSide = (successorMatch.leg === 2) ? (side === 'A' ? 'teamBId' : 'teamAId') : (side === 'A' ? 'teamAId' : 'teamBId');
                await updateDoc(successorRef, { [finalSide]: "" });
              }
            }
          }

          notify('Match reopened! You can edit, add, or delete events now.');
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `tournaments/${tournament.id}/matches/${match.id}`);
        } finally {
          setIsFinishing(false);
          setConfirmModal(null);
        }
      }
    });
  };

  const resetMatch = async () => {
    if (!isCreator || isFinishing) return;
    setConfirmModal({
      title: "Reset Match",
      message: "CRITICAL WARNING: This will DELETE ALL logged events (goals, cards, substitutions) for this match and reset the score to 0-0. This action is irreversible. Proceed?",
      actionLabel: "Reset Match",
      isDangerous: true,
      onConfirm: async () => {
        setIsFinishing(true);
        try {
          // 1. Delete all match events sequentially
          for (const event of events) {
            await deleteDoc(doc(db, `tournaments/${tournament.id}/matches/${match.id}/events/${event.id}`));
          }

          // 2. Reset match document fields back to scheduled state
          const matchRef = doc(db, `tournaments/${tournament.id}/matches/${match.id}`);
          await updateDoc(matchRef, {
            status: 'scheduled',
            scoreA: 0,
            scoreB: 0,
            pensA: 0,
            pensB: 0,
            manOfTheMatchId: '',
            isTimerRunning: false,
            elapsedTimeOnPause: 0,
            timerStartTime: null,
            updatedAt: serverTimestamp()
          });

          // 3. If this was the Final or the tournament is completed, reopen the tournament
          if (liveMatch.round === 'Final' || tournament.status === 'completed') {
            const tournamentRef = doc(db, `tournaments/${tournament.id}`);
            await updateDoc(tournamentRef, {
              status: 'live',
              updatedAt: serverTimestamp()
            });
          }

          // 4. Clear successor team placement fields in knockout matches because the winner is no longer determined
          if (liveMatch.successorMatchId) {
            const successorIds = liveMatch.successorMatchId.split(',');
            for (const sId of successorIds) {
              const successorRef = doc(db, `tournaments/${tournament.id}/matches/${sId.trim()}`);
              const successorMatch = matches.find(m => m.id === sId.trim());
              if (successorMatch) {
                const side = liveMatch.successorSide;
                const finalSide = (successorMatch.leg === 2) ? (side === 'A' ? 'teamBId' : 'teamAId') : (side === 'A' ? 'teamAId' : 'teamBId');
                await updateDoc(successorRef, { [finalSide]: "" });
              }
            }
          }
          if (liveMatch.loserSuccessorMatchId) {
            const successorIds = liveMatch.loserSuccessorMatchId.split(',');
            for (const sId of successorIds) {
              const successorRef = doc(db, `tournaments/${tournament.id}/matches/${sId.trim()}`);
              const successorMatch = matches.find(m => m.id === sId.trim());
              if (successorMatch) {
                const side = liveMatch.loserSuccessorSide;
                const finalSide = (successorMatch.leg === 2) ? (side === 'A' ? 'teamBId' : 'teamAId') : (side === 'A' ? 'teamAId' : 'teamBId');
                await updateDoc(successorRef, { [finalSide]: "" });
              }
            }
          }

          notify('Match has been fully reset to scheduled state!');
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `tournaments/${tournament.id}/matches/${match.id}`);
        } finally {
          setIsFinishing(false);
          setConfirmModal(null);
        }
      }
    });
  };

  const getSuggestedMotM = () => {
    const scores: Record<string, number> = {};
    events.forEach(e => {
        if (e.type === 'goal' && e.goalType !== 'own_goal' && !e.isPenaltyShootout) {
            scores[e.playerId] = (scores[e.playerId] || 0) + 3;
            if (e.assistantId) scores[e.assistantId] = (scores[e.assistantId] || 0) + 2;
        }
    });
    let bestPlayerId = null;
    let maxPts = -1;
    Object.entries(scores).forEach(([pid, pts]) => {
        if (pts > maxPts) { maxPts = pts; bestPlayerId = pid; }
    });
    return bestPlayerId;
  };

  const milestonesValues = useMemo(() => {
    return {
      hasHT: events.some(e => e.type === 'milestone' && e.milestoneType === 'half_time'),
      hasFT: events.some(e => e.type === 'milestone' && e.milestoneType === 'full_time'),
      hasET: events.some(e => e.type === 'milestone' && e.milestoneType === 'extra_time'),
      hasPens: events.some(e => e.type === 'milestone' && e.milestoneType === 'penalties')
    };
  }, [events]);

  const redCardedPlayerIds = useMemo(() => {
    const ids = new Set<string>();
    events.filter(e => e.type === 'red_card').forEach(e => ids.add(e.playerId));
    const yellowCounts: Record<string, number> = {};
    events.filter(e => e.type === 'yellow_card').forEach(e => {
      yellowCounts[e.playerId] = (yellowCounts[e.playerId] || 0) + 1;
      if (yellowCounts[e.playerId] >= 2) {
        ids.add(e.playerId);
      }
    });
    return ids;
  }, [events]);
  const substitutedOutPlayerIds = useMemo(() => new Set(events.filter(e => e.type === 'substitution').map(e => e.playerId)), [events]);
  const penaltyTakerIds = useMemo(() => new Set(events.filter(e => e.type === 'penalty_kick').map(e => e.playerId)), [events]);
  const isEligible = (playerId: string) => !redCardedPlayerIds.has(playerId) && !substitutedOutPlayerIds.has(playerId);

  // Synchronise or initialise lineup/subs setup states
  useEffect(() => {
    if (showLineupConfirm) {
      const sortedA = sortPlayersByPosition(playersA);
      const initialLineupA = liveMatch.lineupA && liveMatch.lineupA.length > 0
        ? liveMatch.lineupA
        : sortedA.slice(0, 11).map(p => p.id);
      const initialSubsA = liveMatch.subsA && liveMatch.subsA.length > 0
        ? liveMatch.subsA
        : sortedA.slice(11).map(p => p.id);

      const sortedB = sortPlayersByPosition(playersB);
      const initialLineupB = liveMatch.lineupB && liveMatch.lineupB.length > 0
        ? liveMatch.lineupB
        : sortedB.slice(0, 11).map(p => p.id);
      const initialSubsB = liveMatch.subsB && liveMatch.subsB.length > 0
        ? liveMatch.subsB
        : sortedB.slice(11).map(p => p.id);

      setTempLineupA(initialLineupA);
      setTempSubsA(initialSubsA);
      setTempLineupB(initialLineupB);
      setTempSubsB(initialSubsB);
      setSetupStep('teamA');
    }
  }, [showLineupConfirm, playersA, playersB, liveMatch.lineupA, liveMatch.lineupB, liveMatch.subsA, liveMatch.subsB]);

  // Derived in-ground pitch rosters
  const currentPitchA = useMemo(() => {
    const pitch = new Set(liveMatch.lineupA && liveMatch.lineupA.length > 0 ? liveMatch.lineupA : playersA.map(p => p.id));
    const sortedSubEvents = [...events]
      .filter(e => e.type === 'substitution' && e.teamId === match.teamAId)
      .sort((a, b) => parseInt(a.timestamp || '0') - parseInt(b.timestamp || '0'));
    
    sortedSubEvents.forEach(e => {
      pitch.delete(e.playerId); // Left pitch
      if (e.assistantId) {
        pitch.add(e.assistantId); // Entered pitch
      }
    });
    return pitch;
  }, [liveMatch.lineupA, playersA, events, match.teamAId]);

  const currentPitchB = useMemo(() => {
    const pitch = new Set(liveMatch.lineupB && liveMatch.lineupB.length > 0 ? liveMatch.lineupB : playersB.map(p => p.id));
    const sortedSubEvents = [...events]
      .filter(e => e.type === 'substitution' && e.teamId === match.teamBId)
      .sort((a, b) => parseInt(a.timestamp || '0') - parseInt(b.timestamp || '0'));
    
    sortedSubEvents.forEach(e => {
      pitch.delete(e.playerId); // Left pitch
      if (e.assistantId) {
        pitch.add(e.assistantId); // Entered pitch
      }
    });
    return pitch;
  }, [liveMatch.lineupB, playersB, events, match.teamBId]);

  // Available bench substitutes (not yet entered, not red carded)
  const availableSubsA = useMemo(() => {
    const subs = new Set(liveMatch.subsA || []);
    const subbedInIds = new Set(
      events
        .filter(e => e.type === 'substitution' && e.teamId === match.teamAId && e.assistantId)
        .map(e => e.assistantId)
    );
    return playersA.filter(p => subs.has(p.id) && !subbedInIds.has(p.id) && !redCardedPlayerIds.has(p.id));
  }, [liveMatch.subsA, playersA, events, match.teamAId, redCardedPlayerIds]);

  const availableSubsB = useMemo(() => {
    const subs = new Set(liveMatch.subsB || []);
    const subbedInIds = new Set(
      events
        .filter(e => e.type === 'substitution' && e.teamId === match.teamBId && e.assistantId)
        .map(e => e.assistantId)
    );
    return playersB.filter(p => subs.has(p.id) && !subbedInIds.has(p.id) && !redCardedPlayerIds.has(p.id));
  }, [liveMatch.subsB, playersB, events, match.teamBId, redCardedPlayerIds]);

  const isOnPitch = (playerId: string, teamId: string) => {
    const isTeamA = teamId === match.teamAId;
    const pitch = isTeamA ? currentPitchA : currentPitchB;
    const hasLineup = isTeamA ? (liveMatch.lineupA && liveMatch.lineupA.length > 0) : (liveMatch.lineupB && liveMatch.lineupB.length > 0);
    
    if (hasLineup) {
      return pitch.has(playerId) && !redCardedPlayerIds.has(playerId);
    }
    return !redCardedPlayerIds.has(playerId) && !substitutedOutPlayerIds.has(playerId);
  };

  const getEligibleLeaving = (side: 'A' | 'B') => {
    const players = side === 'A' ? playersA : playersB;
    return players.filter(p => isOnPitch(p.id, side === 'A' ? match.teamAId : match.teamBId));
  };

  const getEligibleSubs = (side: 'A' | 'B') => {
    const hasLineup = side === 'A' ? (liveMatch.lineupA && liveMatch.lineupA.length > 0) : (liveMatch.lineupB && liveMatch.lineupB.length > 0);
    if (hasLineup) {
      return side === 'A' ? availableSubsA : availableSubsB;
    }
    // Backward compatibility:
    const players = side === 'A' ? playersA : playersB;
    return players.filter(p => !redCardedPlayerIds.has(p.id) && !substitutedOutPlayerIds.has(p.id));
  };

  const manOfTheMatch = allPlayers.find(p => p.id === liveMatch.manOfTheMatchId);
  const suggestedPlayer = allPlayers.find(p => p.id === getSuggestedMotM());

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8 pb-24 max-w-5xl mx-auto">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between bg-white/60 dark:bg-slate-900/60 backdrop-blur-md px-6 py-4 rounded-3xl border border-slate-100 dark:border-slate-800/80 shadow-sm">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 dark:text-slate-400 font-bold hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors uppercase tracking-widest text-[10px]">
          &larr; Back to Tournament
        </button>
        <div className="flex items-center gap-2">
          <AppLogo className="w-6 h-6 rounded-lg shadow-sm" />
          <span className="font-black text-sm tracking-tighter uppercase italic text-slate-900 dark:text-white">
            Kickivo <span className="text-emerald-500">Facts</span>
          </span>
        </div>
      </div>

      {/* Main Scoring Card */}
      <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-[40px] p-6 md:p-10 shadow-[0_30px_100px_rgba(0,0,0,0.06)] relative overflow-hidden border border-black/5 dark:border-slate-800/80">
        <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500" />
        <div className="flex flex-col items-center gap-8 relative z-10">
          
          {/* Match Status Badge */}
          <div className="flex justify-center mt-2">
            <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-500 border ${
              liveMatch.status === 'live' 
                ? 'bg-emerald-550/5 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-800/40 text-emerald-600 dark:text-emerald-400 animate-pulse' 
                : liveMatch.status === 'finished' 
                  ? 'bg-slate-50 dark:bg-slate-950/40 border-slate-200/60 dark:border-slate-800 text-slate-500 dark:text-slate-400' 
                  : 'bg-slate-50/50 dark:bg-slate-950/20 text-slate-400 dark:text-slate-500 border-slate-200/40 dark:border-slate-800/40'
            }`}>
              {liveMatch.status === 'live' 
                ? (milestonesValues.hasET ? 'Extra Time' : 'Match Live') 
                : liveMatch.status === 'finished' 
                  ? (milestonesValues.hasPens ? 'PEN' : milestonesValues.hasET ? 'AET' : 'FT') 
                  : 'Scheduled'}
            </div>
          </div>

          {/* Primary Score Board Container */}
          <div className="grid grid-cols-3 items-center w-full max-w-4xl mx-auto gap-2 md:gap-8 py-4">
            {/* Team A */}
            <div 
              onClick={() => { if (teamA && onSelectTeam) onSelectTeam(teamA); }}
              className={`flex flex-col items-center text-center justify-center ${teamA && onSelectTeam ? 'cursor-pointer hover:opacity-85 group' : ''}`}
            >
               <div className="w-16 h-16 md:w-28 md:h-28 bg-slate-50 dark:bg-slate-950/40 rounded-2xl md:rounded-[36px] flex items-center justify-center border border-slate-100 dark:border-slate-800/80 shadow-[inset_1px_1px_3px_rgba(0,0,0,0.05),2px_4px_12px_rgba(0,0,0,0.04)] dark:shadow-none shrink-0 hover:scale-[1.03] transition-all duration-300">
                  {renderTeamLogo(teamA?.logoURL, teamA?.name || '', "w-10 h-10 md:w-18 md:h-18 object-contain filter drop-shadow-md")}
               </div>
               <h2 
                 title={teamA?.name}
                 className={`text-[11px] md:text-lg font-black tracking-tight uppercase truncate max-w-[110px] md:max-w-none mt-3 leading-tight ${liveMatch.status === 'finished' && liveMatch.scoreA > liveMatch.scoreB ? 'text-emerald-500' : 'text-slate-900 dark:text-white'} ${teamA && onSelectTeam ? 'group-hover:text-emerald-500 dark:group-hover:text-emerald-400 group-hover:underline' : ''}`}
               >
                 {teamA?.name}
               </h2>
            </div>

            {/* Score Center (Primary Visual Focus) */}
            <div className="flex flex-col items-center justify-center">
              <div className="bg-gradient-to-b from-slate-50 to-slate-100/50 dark:from-slate-950 dark:to-slate-950/50 px-5 py-3 md:px-10 md:py-6 rounded-2xl md:rounded-[32px] border border-slate-200/60 dark:border-slate-800 shadow-[3px_6px_16px_rgba(0,0,0,0.03),inset_0px_1px_0px_rgba(255,255,255,0.8)] dark:shadow-none flex items-center gap-3 md:gap-6">
                <div className="flex flex-col items-center">
                  <motion.span 
                    key={`scoreA-${liveMatch.scoreA}`}
                    initial={{ scale: 1 }}
                    animate={{ scale: [1, 1.25, 1] }}
                    transition={{ duration: 0.35, ease: "easeInOut" }}
                    className={`text-3xl md:text-6xl font-black tabular-nums tracking-tighter block ${liveMatch.status === 'finished' && liveMatch.scoreA > liveMatch.scoreB ? 'text-emerald-500' : 'text-slate-900 dark:text-white'}`}
                  >
                    {liveMatch.scoreA}
                  </motion.span>
                  {(liveMatch.pensA !== undefined || liveMatch.pensB !== undefined) && <span className="text-[9px] md:text-xs font-black text-amber-500 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded-full mt-1 border border-amber-100/35 dark:border-amber-900/30">({liveMatch.pensA || 0})</span>}
                </div>
                <span className="text-xl md:text-3xl font-extrabold text-slate-300 dark:text-slate-700">:</span>
                <div className="flex flex-col items-center">
                  <motion.span 
                    key={`scoreB-${liveMatch.scoreB}`}
                    initial={{ scale: 1 }}
                    animate={{ scale: [1, 1.25, 1] }}
                    transition={{ duration: 0.35, ease: "easeInOut" }}
                    className={`text-3xl md:text-6xl font-black tabular-nums tracking-tighter block ${liveMatch.status === 'finished' && liveMatch.scoreB > liveMatch.scoreA ? 'text-emerald-500' : 'text-slate-900 dark:text-white'}`}
                  >
                    {liveMatch.scoreB}
                  </motion.span>
                  {(liveMatch.pensA !== undefined || liveMatch.pensB !== undefined) && <span className="text-[9px] md:text-xs font-black text-amber-500 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded-full mt-1 border border-amber-100/35 dark:border-amber-900/30">({liveMatch.pensB || 0})</span>}
                </div>
              </div>
            </div>

            {/* Team B */}
            <div 
              onClick={() => { if (teamB && onSelectTeam) onSelectTeam(teamB); }}
              className={`flex flex-col items-center text-center justify-center ${teamB && onSelectTeam ? 'cursor-pointer hover:opacity-85 group' : ''}`}
            >
               <div className="w-16 h-16 md:w-28 md:h-28 bg-slate-50 dark:bg-slate-950/40 rounded-2xl md:rounded-[36px] flex items-center justify-center border border-slate-100 dark:border-slate-800/80 shadow-[inset_1px_1px_3px_rgba(0,0,0,0.05),2px_4px_12px_rgba(0,0,0,0.04)] dark:shadow-none shrink-0 hover:scale-[1.03] transition-all duration-300">
                  {renderTeamLogo(teamB?.logoURL, teamB?.name || '', "w-10 h-10 md:w-18 md:h-18 object-contain filter drop-shadow-md")}
               </div>
               <h2 
                 title={teamB?.name}
                 className={`text-[11px] md:text-lg font-black tracking-tight uppercase truncate max-w-[110px] md:max-w-none mt-3 leading-tight ${liveMatch.status === 'finished' && liveMatch.scoreB > liveMatch.scoreA ? 'text-emerald-500' : 'text-slate-900 dark:text-white'} ${teamB && onSelectTeam ? 'group-hover:text-emerald-500 dark:group-hover:text-emerald-400 group-hover:underline' : ''}`}
               >
                 {teamB?.name}
               </h2>
            </div>
          </div>

          {/* Timer panel BELOW score and team names */}
          {liveMatch.status === 'live' && (
            <div className="flex flex-col items-center justify-center w-full max-w-sm">
              <MatchTimer 
                match={liveMatch} 
                isCreator={isCreator} 
                tournament={tournament} 
              />
            </div>
          )}

          {/* Log Event Actions */}
          {isCreator && liveMatch.status !== 'finished' && (
            <div className="w-full max-w-4xl bg-slate-50/50 dark:bg-slate-950/30 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]">
              <div className="text-center mb-4 flex flex-col items-center gap-1">
                <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.25em]">
                  {isEfootball ? '🎮 eFootball Direct Score Console' : 'Quick Log Event Console'}
                </span>
                {liveMatch.status === 'scheduled' && (
                  <span className="text-[8px] bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/30 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider animate-pulse">
                    Locked before kickoff
                  </span>
                )}
                {isEfootball && liveMatch.status !== 'scheduled' && (
                  <span className="text-[9px] text-slate-400 dark:text-slate-500 font-medium">
                    Tap + Goal to record team goals directly. No player rosters required!
                  </span>
                )}
              </div>

              {isEfootball ? (
                /* eFootball Direct Goal Logging (No players required) */
                <div className="grid grid-cols-2 gap-4 md:gap-8 max-w-lg mx-auto">
                  {/* Team A */}
                  <div className="flex flex-col items-center gap-2.5 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                    <p className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-tight truncate max-w-full">
                      {teamA?.name}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <button
                        aria-label="Add goal"
                        title={liveMatch.status === 'scheduled' ? "Please kickoff match to log goals" : "Add Goal"}
                        disabled={liveMatch.status === 'scheduled'}
                        onClick={() => addTeamGoal(match.teamAId)}
                        className={`flex items-center gap-2 px-5 py-3 bg-emerald-500 text-white rounded-xl shadow-md transition-all font-black text-xs uppercase tracking-wider ${
                          liveMatch.status === 'scheduled' 
                            ? 'opacity-40 cursor-not-allowed' 
                            : 'hover:bg-emerald-600 hover:shadow-emerald-500/25 active:scale-95'
                        }`}
                      >
                        <SoccerIcon className="w-4 h-4 text-white" />
                        <span>+ Goal</span>
                      </button>
                      {liveMatch.scoreA > 0 && liveMatch.status !== 'scheduled' && (
                        <button
                          aria-label="Reduce score"
                          title="Undo Goal (-1)"
                          onClick={() => decrementTeamScore(match.teamAId)}
                          className="px-3 py-3 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 dark:bg-slate-800 dark:hover:bg-rose-950/30 text-slate-600 dark:text-slate-300 rounded-xl transition-all font-black text-xs"
                        >
                          -1
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Team B */}
                  <div className="flex flex-col items-center gap-2.5 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                    <p className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-tight truncate max-w-full">
                      {teamB?.name}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <button
                        aria-label="Add goal"
                        title={liveMatch.status === 'scheduled' ? "Please kickoff match to log goals" : "Add Goal"}
                        disabled={liveMatch.status === 'scheduled'}
                        onClick={() => addTeamGoal(match.teamBId)}
                        className={`flex items-center gap-2 px-5 py-3 bg-emerald-500 text-white rounded-xl shadow-md transition-all font-black text-xs uppercase tracking-wider ${
                          liveMatch.status === 'scheduled' 
                            ? 'opacity-40 cursor-not-allowed' 
                            : 'hover:bg-emerald-600 hover:shadow-emerald-500/25 active:scale-95'
                        }`}
                      >
                        <SoccerIcon className="w-4 h-4 text-white" />
                        <span>+ Goal</span>
                      </button>
                      {liveMatch.scoreB > 0 && liveMatch.status !== 'scheduled' && (
                        <button
                          aria-label="Reduce score"
                          title="Undo Goal (-1)"
                          onClick={() => decrementTeamScore(match.teamBId)}
                          className="px-3 py-3 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 dark:bg-slate-800 dark:hover:bg-rose-950/30 text-slate-600 dark:text-slate-300 rounded-xl transition-all font-black text-xs"
                        >
                          -1
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* Standard Football Events */
                <div className="grid grid-cols-2 gap-6 items-stretch">
                  {/* Team A Logging */}
                  <div className="flex flex-col items-center gap-3 border-r border-slate-200/60 dark:border-slate-800 pr-3 md:pr-6">
                    <p className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest truncate max-w-[120px] md:max-w-none">
                      {teamA?.name}
                    </p>
                    <div className="flex items-center justify-center gap-1.5 md:gap-3">
                      <button 
                        aria-label="Log goal"
                        title={liveMatch.status === 'scheduled' ? "Please kickoff match to log events" : "Goal"}
                        disabled={liveMatch.status === 'scheduled'}
                        onClick={() => setShowEventModal({ side: 'A', type: 'goal', step: 1 })} 
                        className={`flex items-center gap-1.5 px-3 py-2 md:px-5 md:py-3.5 bg-emerald-500 text-white rounded-xl shadow-md transition-all ${
                          liveMatch.status === 'scheduled' 
                            ? 'opacity-40 cursor-not-allowed' 
                            : 'hover:bg-emerald-600 hover:shadow-emerald-500/25 active:scale-95 hover:scale-[1.03]'
                        }`}
                      >
                        <SoccerIcon className="w-3.5 h-3.5 md:w-5 md:h-5 text-white" />
                        <span className="text-[9px] font-extrabold uppercase tracking-widest hidden sm:inline">Goal</span>
                      </button>
                      <button 
                        aria-label="Log card"
                        title={liveMatch.status === 'scheduled' ? "Please kickoff match to log events" : "Card"}
                        disabled={liveMatch.status === 'scheduled'}
                        onClick={() => setShowEventModal({ side: 'A', type: 'yellow_card', step: 0 })} 
                        className={`flex items-center gap-1.5 px-3 py-2 md:px-5 md:py-3.5 bg-[linear-gradient(135deg,#f59e0b_50%,#ef4444_50%)] text-white rounded-xl shadow-md transition-all ${
                          liveMatch.status === 'scheduled' 
                            ? 'opacity-40 cursor-not-allowed' 
                            : 'hover:brightness-110 hover:shadow-orange-500/25 active:scale-95 hover:scale-[1.03]'
                        }`}
                      >
                        <Shield className="w-3.5 h-3.5 md:w-5 md:h-5 text-white" />
                        <span className="text-[9px] font-extrabold uppercase tracking-widest hidden sm:inline">Card</span>
                      </button>
                      <button 
                        aria-label="Log substitution"
                        title={liveMatch.status === 'scheduled' ? "Please kickoff match to log events" : "Substitution"}
                        disabled={liveMatch.status === 'scheduled'}
                        onClick={() => setShowEventModal({ side: 'A', type: 'substitution', step: 1 })} 
                        className={`flex items-center gap-1.5 px-3 py-2 md:px-5 md:py-3.5 bg-blue-500 text-white rounded-xl shadow-md transition-all ${
                          liveMatch.status === 'scheduled' 
                            ? 'opacity-40 cursor-not-allowed' 
                            : 'hover:bg-blue-600 hover:shadow-blue-500/25 active:scale-95 hover:scale-[1.03]'
                        }`}
                      >
                        <ArrowLeftRight className="w-3.5 h-3.5 md:w-5 md:h-5 text-white" />
                        <span className="text-[9px] font-extrabold uppercase tracking-widest hidden sm:inline">Sub</span>
                      </button>
                    </div>
                  </div>

                  {/* Team B Logging */}
                  <div className="flex flex-col items-center gap-3 pl-3 md:pl-6">
                    <p className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest truncate max-w-[120px] md:max-w-none">
                      {teamB?.name}
                    </p>
                    <div className="flex items-center justify-center gap-1.5 md:gap-3">
                      <button 
                        aria-label="Log goal"
                        title={liveMatch.status === 'scheduled' ? "Please kickoff match to log events" : "Goal"}
                        disabled={liveMatch.status === 'scheduled'}
                        onClick={() => setShowEventModal({ side: 'B', type: 'goal', step: 1 })} 
                        className={`flex items-center gap-1.5 px-3 py-2 md:px-5 md:py-3.5 bg-emerald-500 text-white rounded-xl shadow-md transition-all ${
                          liveMatch.status === 'scheduled' 
                            ? 'opacity-40 cursor-not-allowed' 
                            : 'hover:bg-emerald-600 hover:shadow-emerald-500/25 active:scale-95 hover:scale-[1.03]'
                        }`}
                      >
                        <SoccerIcon className="w-3.5 h-3.5 md:w-5 md:h-5 text-white" />
                        <span className="text-[9px] font-extrabold uppercase tracking-widest hidden sm:inline">Goal</span>
                      </button>
                      <button 
                        aria-label="Log card"
                        title={liveMatch.status === 'scheduled' ? "Please kickoff match to log events" : "Card"}
                        disabled={liveMatch.status === 'scheduled'}
                        onClick={() => setShowEventModal({ side: 'B', type: 'yellow_card', step: 0 })} 
                        className={`flex items-center gap-1.5 px-3 py-2 md:px-5 md:py-3.5 bg-[linear-gradient(135deg,#f59e0b_50%,#ef4444_50%)] text-white rounded-xl shadow-md transition-all ${
                          liveMatch.status === 'scheduled' 
                            ? 'opacity-40 cursor-not-allowed' 
                            : 'hover:brightness-110 hover:shadow-orange-500/25 active:scale-95 hover:scale-[1.03]'
                        }`}
                      >
                        <Shield className="w-3.5 h-3.5 md:w-5 md:h-5 text-white" />
                        <span className="text-[9px] font-extrabold uppercase tracking-widest hidden sm:inline">Card</span>
                      </button>
                      <button 
                        aria-label="Log substitution"
                        title={liveMatch.status === 'scheduled' ? "Please kickoff match to log events" : "Substitution"}
                        disabled={liveMatch.status === 'scheduled'}
                        onClick={() => setShowEventModal({ side: 'B', type: 'substitution', step: 1 })} 
                        className={`flex items-center gap-1.5 px-3 py-2 md:px-5 md:py-3.5 bg-blue-500 text-white rounded-xl shadow-md transition-all ${
                          liveMatch.status === 'scheduled' 
                            ? 'opacity-40 cursor-not-allowed' 
                            : 'hover:bg-blue-600 hover:shadow-blue-500/25 active:scale-95 hover:scale-[1.03]'
                        }`}
                      >
                        <ArrowLeftRight className="w-3.5 h-3.5 md:w-5 md:h-5 text-white" />
                        <span className="text-[9px] font-extrabold uppercase tracking-widest hidden sm:inline">Sub</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Match Timeline section */}
        <MatchEventLog 
          events={events} 
          teamA={teamA} 
          teamB={teamB} 
          playersA={playersA} 
          playersB={playersB} 
          isCreator={isCreator} 
          onUndo={undoEvent}
          match={liveMatch}
          onSelectPlayer={onSelectPlayer}
        />

        {/* Milestone & State Controls (Cta at bottom of the panel) */}
        {isCreator && liveMatch.status !== 'finished' && (
          <div className="max-w-4xl mx-auto flex flex-col items-center gap-6 py-8 border-t border-slate-50 dark:border-slate-800/80 mt-12">
            <div className="w-full max-w-sm">
              {liveMatch.status === 'scheduled' ? (
                <button 
                  onClick={() => {
                    if (isEfootball) {
                      startDirectKickoff();
                    } else {
                      setShowLineupConfirm(true);
                    }
                  }}
                  className="group relative w-full overflow-hidden px-6 py-3.5 bg-emerald-500 text-white rounded-[24px] font-black text-[9px] uppercase tracking-[0.4em] shadow-2xl shadow-emerald-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-4"
                >
                  <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500 to-emerald-400" />
                  <div className="relative w-8 h-8 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center group-hover:rotate-12 transition-transform shadow-xl border border-white/30">
                    <Zap className="w-4 h-4 fill-white text-white" />
                  </div>
                  <span className="relative z-10">{isEfootball ? 'Start eFootball Match' : 'Kick Off Match'}</span>
                </button>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {!milestonesValues.hasHT && (
                    <button 
                      onClick={() => addMilestone('half_time')} 
                      className="group relative w-full overflow-hidden px-6 py-3.5 bg-emerald-500 text-white rounded-[24px] font-black text-[9px] uppercase tracking-[0.4em] shadow-2xl shadow-emerald-500/10 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-4"
                    >
                      <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500 to-emerald-400" />
                      <div className="relative w-8 h-8 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center group-hover:rotate-12 transition-transform shadow-xl border border-white/30">
                        <Clock className="w-4 h-4 text-white" />
                      </div>
                      <span className="relative z-10">End First Half</span>
                    </button>
                  )}
                  
                  {(milestonesValues.hasHT && !milestonesValues.hasFT) && (
                    <button 
                      onClick={() => addMilestone('full_time')} 
                      className="group relative w-full overflow-hidden px-6 py-3.5 bg-emerald-500 text-white rounded-[24px] font-black text-[9px] uppercase tracking-[0.4em] shadow-2xl shadow-emerald-500/10 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-4"
                    >
                      <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500 to-emerald-400" />
                      <div className="relative w-8 h-8 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center group-hover:rotate-12 transition-transform shadow-xl border border-white/30">
                        <CheckCircle2 className="w-4 h-4 text-white" />
                      </div>
                      <span className="relative z-10">End Second Half</span>
                    </button>
                  )}

                  {milestonesValues.hasFT && (
                    <button 
                      onClick={() => setShowFinishConfirm(true)} 
                      className="group relative w-full overflow-hidden px-6 py-3.5 bg-red-400 text-white rounded-[24px] font-black text-[9px] uppercase tracking-[0.4em] shadow-2xl shadow-red-400/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-4"
                    >
                      <div className="absolute inset-0 bg-gradient-to-tr from-red-400 to-red-300" />
                      <div className="relative w-8 h-8 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center group-hover:rotate-12 transition-transform shadow-xl border border-white/30">
                        <Trophy className="w-4 h-4 text-white" />
                      </div>
                      <span className="relative z-10">Finish Match</span>
                    </button>
                  )}

                  {milestonesValues.hasPens && liveMatch.status !== 'finished' && !isPenaltyShootoutMode && (
                    <button
                      onClick={() => setIsPenaltyShootoutMode(true)}
                      className="w-full max-w-sm mx-auto px-6 py-3 bg-amber-500 text-white rounded-[24px] font-black text-[9px] uppercase tracking-[0.4em] flex items-center justify-center gap-3"
                    >
                      <Trophy className="w-4 h-4" />
                      Open Penalty Panel
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {liveMatch.status === 'finished' && (
          <div className="mt-16 max-w-4xl mx-auto border-t border-slate-101 dark:border-slate-800 pt-16 space-y-16">
            <div className="flex flex-col items-center text-center space-y-10">
              <div className="flex items-center gap-4">
                <div className="h-px w-12 bg-slate-100 dark:bg-slate-800" />
                <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">Match Facts</h3>
                <div className="h-px w-12 bg-slate-100 dark:bg-slate-800" />
              </div>

              <div className="w-full">
                {/* Statistics Grid Removed as per user request */}
              </div>

              <div className="flex flex-col items-center gap-6">
                <div className="flex items-center gap-4">
                  <div className="h-px w-8 bg-amber-200" />
                  <div className="flex items-center gap-2">
                    <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                    <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-amber-600">Man of the Match</h3>
                  </div>
                  <div className="h-px w-8 bg-amber-200" />
                </div>
                {manOfTheMatch ? (
                 <div className="bg-amber-50 dark:bg-amber-950/20 rounded-[40px] p-10 flex flex-col items-center gap-2 shadow-xl shadow-amber-500/10 min-w-[320px] relative overflow-hidden">
                   <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-300 to-transparent opacity-50" />
                   
                   <div className="flex items-center gap-2 mb-2">
                     <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-900 flex items-center justify-center shadow-md border border-amber-100/50 dark:border-amber-900/40">
                       <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
                     </div>
                     <span className="text-xs font-black text-amber-500/30 tracking-widest">#{manOfTheMatch.number || '--'}</span>
                   </div>

                   <h4 className="text-2xl font-black italic text-slate-900 dark:text-amber-100 tracking-tight uppercase leading-none">{manOfTheMatch.name}</h4>
                   <p className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-600/50 pb-4">{teams.find(t => t.id === manOfTheMatch.teamId)?.name}</p>
                   
                   <div className="flex items-center gap-2 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm px-4 py-2 rounded-full border border-amber-200/50 dark:border-amber-900/40 shadow-sm">
                     <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                     <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest leading-none">Man of the Match</span>
                   </div>

                   {isCreator && (
                     <button 
                       onClick={() => updateDoc(doc(db, `tournaments/${tournament.id}/matches/${match.id}`), { manOfTheMatchId: '' })} 
                       className="mt-8 text-[9px] font-black text-amber-600/30 hover:text-red-500 uppercase tracking-[0.3em] transition-colors"
                     >
                       Change Result
                     </button>
                   )}
                 </div>
               ) : isCreator ? (
                <div className="w-full space-y-4">
                  {suggestedPlayer && <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl p-4 flex items-center justify-between"><div className="text-left"><p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Suggested</p><p className="font-bold text-slate-900 dark:text-white">{suggestedPlayer.name}</p></div><button onClick={() => updateDoc(doc(db, `tournaments/${tournament.id}/matches/${match.id}`), { manOfTheMatchId: suggestedPlayer.id })} className="bg-emerald-500 text-white px-4 py-2 rounded-full text-xs font-black shadow-lg shadow-emerald-500/20">Confirm</button></div>}
                  <select className="w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white px-5 py-4 rounded-2xl border border-slate-200 dark:border-slate-800 font-bold" onChange={(e) => e.target.value && updateDoc(doc(db, `tournaments/${tournament.id}/matches/${match.id}`), { manOfTheMatchId: e.target.value })} defaultValue=""><option value="" disabled className="dark:bg-slate-900">Choose a player...</option><optgroup label={teamA?.name} className="dark:bg-slate-900">{sortPlayersByPosition(playersA).map(p => <option key={p.id} value={p.id} className="dark:bg-slate-900">{p.name} (#{p.number})</option>)}</optgroup><optgroup label={teamB?.name} className="dark:bg-slate-900">{sortPlayersByPosition(playersB).map(p => <option key={p.id} value={p.id} className="dark:bg-slate-900">{p.name} (#{p.number})</option>)}</optgroup></select>
                </div>
              ) : <p className="text-slate-300 font-bold italic text-sm">Not yet awarded</p>}
            </div>

            {isCreator && (
              <div id="admin-match-controls" className="w-full max-w-sm bg-slate-50/50 dark:bg-slate-900/50 border border-slate-150 dark:border-slate-800 rounded-3xl p-5 text-center space-y-3.5 shadow-sm mt-8">
                <div className="flex flex-col items-center">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.25em]">
                    Admin Controls
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <button 
                    onClick={reopenMatch} 
                    disabled={isFinishing}
                    title="Allow editing events on the timeline"
                    className="flex items-center justify-center gap-2 bg-white dark:bg-slate-900 hover:bg-slate-100/80 dark:hover:bg-slate-950 border border-slate-200 dark:border-slate-850 text-slate-700 dark:text-slate-300 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 disabled:opacity-50 transition-all shadow-sm cursor-pointer"
                  >
                    <Unlock className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Edit Match</span>
                  </button>
                  <button 
                    onClick={resetMatch} 
                    disabled={isFinishing}
                    title="Delete all match events and reset result to 0-0"
                    className="flex items-center justify-center gap-2 bg-rose-50 dark:bg-rose-955 hover:bg-rose-100/20 border border-rose-100 dark:border-rose-900/30 text-rose-600 dark:text-rose-400 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 disabled:opacity-50 transition-all shadow-sm cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-rose-500" />
                    <span>Reset Match</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      </div>

      {/* Match Facts Legend / Event Symbols Key */}
      <div className="mt-4 px-4 py-3 bg-slate-50/50 rounded-2xl border border-slate-100/70 max-w-xs select-none text-[9px] uppercase tracking-wider">
        <div className="flex flex-col gap-1.5 text-slate-500 font-black">
          <div className="flex items-center gap-1.5">
            <div className="w-6 shrink-0 flex items-center justify-start pl-0.5">
              <SoccerIcon className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <span className="text-slate-300 font-normal">:</span>
            <span>Goal</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-6 shrink-0 flex items-center justify-start pl-0.5">
              <span className="w-2.5 h-3.5 bg-amber-400 rounded-[1.5px] block border border-amber-500/10 shadow-sm" />
            </div>
            <span className="text-slate-300 font-normal">:</span>
            <span>Yellow Card</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-6 shrink-0 flex items-center justify-start pl-0.5">
              <span className="w-2.5 h-3.5 bg-red-500 rounded-[1.5px] block border border-red-600/10 shadow-sm" />
            </div>
            <span className="text-slate-300 font-normal">:</span>
            <span>Red Card</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-6 shrink-0 flex items-center justify-start pl-0.5">
              <ArrowDown className="w-3.5 h-3.5 text-emerald-500" strokeWidth={3} />
            </div>
            <span className="text-slate-300 font-normal">:</span>
            <span>Player Subbed In</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-6 shrink-0 flex items-center justify-start pl-0.5">
              <ArrowUp className="w-3.5 h-3.5 text-rose-500" strokeWidth={3} />
            </div>
            <span className="text-slate-300 font-normal">:</span>
            <span>Player Came Off</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-6 shrink-0 flex items-center justify-start pl-0.5">
              <MissedPenaltyIcon className="w-4 h-4 text-rose-500" />
            </div>
            <span className="text-slate-300 font-normal">:</span>
            <span>Missed Penalty</span>
          </div>
        </div>
      </div>

       <AnimatePresence>
        {confirmModal && (
          <div key="custom-confirm-modal" className="fixed inset-0 z-[700] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setConfirmModal(null)} className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 w-full max-w-sm rounded-[32px] p-8 shadow-2xl">
              <button onClick={() => setConfirmModal(null)} className="absolute right-6 top-6 p-2 text-slate-300 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"><X className="w-5 h-5" /></button>
              
              <div className="text-center mb-6">
                <div className={`w-12 h-12 ${confirmModal.isDangerous ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-500 border-rose-100 dark:border-rose-900/30' : 'bg-slate-50 dark:bg-slate-950 text-emerald-500 border-slate-100 dark:border-slate-800'} border rounded-2xl flex items-center justify-center mx-auto mb-4 font-bold text-xl`}>
                  {confirmModal.isDangerous ? '⚠️' : '⚽'}
                </div>
                <h3 className="text-xl font-black italic uppercase tracking-tighter text-slate-900 dark:text-white">{confirmModal.title}</h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-3 leading-relaxed font-medium">{confirmModal.message}</p>
              </div>

              <div className="flex flex-col gap-2">
                <button 
                  onClick={confirmModal.onConfirm}
                  className={`w-full ${confirmModal.isDangerous ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/20' : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20'} text-white font-black py-4 rounded-2xl shadow-xl active:scale-95 transition-all text-[10px] uppercase tracking-[0.2em]`}
                >
                  {confirmModal.actionLabel}
                </button>
                <button onClick={() => setConfirmModal(null)} className="w-full py-3.5 font-bold text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-widest hover:text-slate-600 dark:hover:text-slate-300 transition-colors">Cancel</button>
              </div>
            </motion.div>
          </div>
        )}

        <PenaltyShootoutModal
          isPenaltyShootoutMode={isPenaltyShootoutMode}
          setIsPenaltyShootoutMode={setIsPenaltyShootoutMode}
          teamA={teamA}
          teamB={teamB}
          liveMatch={liveMatch}
          playersA={playersA}
          playersB={playersB}
          penaltyTakerIds={penaltyTakerIds}
          isOnPitch={isOnPitch}
          addPenaltyKick={addPenaltyKick}
        />

      </AnimatePresence>

      <AnimatePresence>
        <MatchEventModal
          showEventModal={showEventModal}
          setShowEventModal={setShowEventModal}
          playersA={playersA}
          playersB={playersB}
          teamA={teamA}
          teamB={teamB}
          match={match}
          redCardedPlayerIds={redCardedPlayerIds}
          isOnPitch={isOnPitch}
          getEligibleLeaving={getEligibleLeaving}
          getEligibleSubs={getEligibleSubs}
          addEvent={addEvent}
        />
      </AnimatePresence>

      <AnimatePresence>
        {showFinishConfirm && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowFinishConfirm(false)} className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 w-full max-w-sm rounded-[32px] p-10 text-center shadow-2xl">
              <div className="w-20 h-20 bg-red-50 dark:bg-red-950/20 rounded-full flex items-center justify-center mx-auto mb-6"><Shield className="w-10 h-10 text-red-500" /></div>
              <h3 className="text-2xl font-black mb-4 text-slate-900 dark:text-white">Finalize Result?</h3>
              <p className="text-slate-500 dark:text-slate-400 mb-8 font-medium">This will lock the match result and progress the tournament.</p>
              
              {/* Conditional Penalties/Extra Time Options for Knockout Tie */}
              {((liveMatch.group === 'Playoffs' || liveMatch.round) && liveMatch.scoreA === liveMatch.scoreB && (liveMatch.pensA || 0) === (liveMatch.pensB || 0)) && (
                <div className="mb-8 p-6 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-[32px] space-y-4">
                  <div className="flex items-center justify-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-500" />
                    <p className="text-amber-800 dark:text-amber-300 text-xs font-black uppercase tracking-wider">Tie in Knockout Match</p>
                  </div>
                  <p className="text-amber-600 dark:text-amber-400 text-[10px] font-bold leading-relaxed">Knockout matches must have a winner. Choose how to proceed:</p>
                  
                  <div className="grid grid-cols-2 gap-3">
                    {!milestonesValues.hasET && (
                      <button 
                        onClick={() => { setShowFinishConfirm(false); addMilestone('extra_time'); }}
                        className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-850 text-amber-600 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-100 dark:hover:bg-amber-950 transition-all font-bold"
                      >
                        Extra Time
                      </button>
                    )}
                    <button 
                      onClick={() => { setShowFinishConfirm(false); addMilestone('penalties'); }}
                      className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-850 text-emerald-600 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-50 dark:hover:bg-emerald-950 transition-all font-bold"
                    >
                      Penalties
                    </button>
                  </div>
                </div>
              )}

              <div className="flex gap-4">
                <button onClick={() => setShowFinishConfirm(false)} className="flex-1 py-4 font-black uppercase text-[10px] tracking-widest text-slate-400 hover:text-slate-900 transition-colors">Cancel</button>
                <button 
                  onClick={finishMatch} 
                  disabled={isFinishing || ((liveMatch.group === 'Playoffs' || liveMatch.round) && liveMatch.scoreA === liveMatch.scoreB && (liveMatch.pensA || 0) === (liveMatch.pensB || 0))}
                  className="flex-1 bg-red-500 text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-red-500/20 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  {isFinishing ? 'Processing...' : 'Confirm FT'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!isEfootball && (
          <LineupSetupWizard
            showLineupConfirm={showLineupConfirm}
            setShowLineupConfirm={setShowLineupConfirm}
            tournament={tournament}
            match={match}
            teamA={teamA}
            teamB={teamB}
            playersA={playersA}
            playersB={playersB}
            tempLineupA={tempLineupA}
            setTempLineupA={setTempLineupA}
            tempSubsA={tempSubsA}
            setTempSubsA={setTempSubsA}
            tempLineupB={tempLineupB}
            setTempLineupB={setTempLineupB}
            tempSubsB={tempSubsB}
            setTempSubsB={setTempSubsB}
            setupStep={setupStep}
            setSetupStep={setSetupStep}
            notify={notify}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};
