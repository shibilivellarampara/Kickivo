import React from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import { Match, Team, Player, MatchEventType, GoalType } from '../../types';
import { sortPlayersByPosition } from '../../utils/football';

interface MatchEventModalProps {
  showEventModal: { side: 'A' | 'B'; type: MatchEventType; step: number; data?: any } | null;
  setShowEventModal: (modal: { side: 'A' | 'B'; type: MatchEventType; step: number; data?: any } | null) => void;
  playersA: Player[];
  playersB: Player[];
  teamA?: Team;
  teamB?: Team;
  match: Match;
  redCardedPlayerIds: Set<string>;
  isOnPitch: (playerId: string, teamId: string) => boolean;
  getEligibleLeaving: (side: 'A' | 'B') => Player[];
  getEligibleSubs: (side: 'A' | 'B') => Player[];
  addEvent: (
    playerId: string,
    type: MatchEventType,
    teamId: string,
    metadata?: { assistantId?: string; goalType?: GoalType; isPenaltyShootout?: boolean; penaltyResult?: 'goal' | 'miss' }
  ) => Promise<void>;
}

export const MatchEventModal: React.FC<MatchEventModalProps> = ({
  showEventModal,
  setShowEventModal,
  playersA,
  playersB,
  teamA,
  teamB,
  match,
  redCardedPlayerIds,
  isOnPitch,
  getEligibleLeaving,
  getEligibleSubs,
  addEvent,
}) => {
  if (!showEventModal) return null;

  return (
    <div key="event-modal" className="fixed inset-0 z-[500] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => setShowEventModal(null)}
        className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"
      />
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="relative bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 w-full max-w-sm rounded-[32px] p-8 shadow-2xl"
      >
        <button
          type="button"
          onClick={() => setShowEventModal(null)}
          className="absolute right-6 top-6 p-2 text-slate-300 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        <h3 className="text-xl font-black mb-6 uppercase tracking-tighter text-slate-900 dark:text-white">
          {showEventModal.type === 'goal'
            ? 'Log Goal'
            : showEventModal.type === 'substitution'
            ? 'Log Substitution'
            : showEventModal.step === 0
            ? 'Select Card Color'
            : showEventModal.type === 'yellow_card'
            ? 'Yellow Card'
            : 'Red Card'}
        </h3>

        {showEventModal.step === 0 && (showEventModal.type === 'yellow_card' || showEventModal.type === 'red_card') && (
          <div className="space-y-4">
            <p className="text-[9px] font-black uppercase text-slate-400">Select Card Color</p>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setShowEventModal({ ...showEventModal, type: 'yellow_card', step: 1 })}
                className="bg-amber-400 hover:bg-amber-500 text-amber-950 font-black p-6 rounded-2xl flex flex-col items-center justify-center gap-3 active:scale-95 hover:scale-[1.02] transition-all border border-amber-300 shadow-md shadow-amber-500/10 hover:shadow-amber-500/20"
              >
                <div className="w-8 h-12 bg-amber-400 rounded-sm border border-amber-500 shadow-md" />
                <span className="text-xs uppercase tracking-wider font-extrabold">Yellow</span>
              </button>
              <button
                type="button"
                onClick={() => setShowEventModal({ ...showEventModal, type: 'red_card', step: 1 })}
                className="bg-red-500 hover:bg-red-600 text-white font-black p-6 rounded-2xl flex flex-col items-center justify-center gap-3 active:scale-95 hover:scale-[1.02] transition-all border border-red-400 shadow-md shadow-red-500/10 hover:shadow-red-500/20"
              >
                <div className="w-8 h-12 bg-red-500 rounded-sm border border-red-600 shadow-md" />
                <span className="text-xs uppercase tracking-wider font-extrabold">Red</span>
              </button>
            </div>
          </div>
        )}

        {showEventModal.step === 1 && showEventModal.type === 'goal' && (
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'open_goal', label: 'Open Goal' },
              { id: 'header', label: 'Header' },
              { id: 'penalty_scored', label: 'Penalty Scored' },
              { id: 'penalty_missed', label: 'Missed Penalty' },
              { id: 'own_goal', label: 'Own Goal' },
              { id: 'free_kick', label: 'Free Kick' }
            ].map(t => (
              <button
                type="button"
                key={t.id}
                onClick={() => {
                  if (t.id === 'penalty_scored') {
                    setShowEventModal({ ...showEventModal, step: 2, data: { goalType: 'penalty', penaltyResult: 'goal' } });
                  } else if (t.id === 'penalty_missed') {
                    setShowEventModal({ ...showEventModal, step: 2, data: { goalType: 'penalty', penaltyResult: 'miss' } });
                  } else {
                    setShowEventModal({ ...showEventModal, step: 2, data: { goalType: t.id } });
                  }
                }}
                className="bg-slate-50 p-4 rounded-2xl font-bold text-xs uppercase hover:bg-emerald-500 hover:text-white transition-all text-slate-800"
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {((showEventModal.step === 2 && showEventModal.type === 'goal') ||
          (showEventModal.step === 1 && showEventModal.type !== 'goal' && showEventModal.type !== 'substitution')) && (
          <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-2 no-scrollbar">
            {sortPlayersByPosition(showEventModal.side === 'A' ? playersA : playersB)
              .filter(p => {
                if (showEventModal.type === 'goal') {
                  return isOnPitch(p.id, showEventModal.side === 'A' ? match.teamAId : match.teamBId);
                }
                // For cards, allow booking any registered squad player who hasn't been red-carded (including bench / out of starting 11)
                return !redCardedPlayerIds.has(p.id);
              })
              .map(p => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => {
                    if (showEventModal.type === 'goal') {
                      const noAssistTypes = ['own_goal', 'penalty', 'free_kick'];
                      if (showEventModal.data?.penaltyResult === 'miss') {
                        setShowEventModal(null);
                        addEvent(p.id, 'penalty_kick', (showEventModal.side === 'A' ? teamA : teamB)!.id, {
                          penaltyResult: 'miss'
                        });
                      } else if (noAssistTypes.includes(showEventModal.data?.goalType)) {
                        setShowEventModal(null);
                        addEvent(p.id, 'goal', (showEventModal.side === 'A' ? teamA : teamB)!.id, {
                          goalType: showEventModal.data.goalType,
                          penaltyResult: showEventModal.data.penaltyResult || null
                        });
                      } else {
                        setShowEventModal({ ...showEventModal, step: 3, data: { ...showEventModal.data, playerId: p.id } });
                      }
                    } else {
                      setShowEventModal(null);
                      addEvent(p.id, showEventModal.type, (showEventModal.side === 'A' ? teamA : teamB)!.id);
                    }
                  }}
                  className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl font-bold text-xs flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-800 dark:text-slate-200 transition-colors"
                >
                  <span>{p.name}</span>
                  <span className="text-[10px] text-slate-400">#{p.number}</span>
                </button>
              ))}
          </div>
        )}

        {showEventModal.step === 3 && showEventModal.type === 'goal' && (
          <div className="space-y-4">
            <p className="text-[9px] font-black uppercase text-slate-400">Select Assistant (Optional)</p>
            <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto no-scrollbar">
              <button
                type="button"
                onClick={() => {
                  setShowEventModal(null);
                  addEvent(showEventModal.data.playerId, 'goal', (showEventModal.side === 'A' ? teamA : teamB)!.id, {
                    goalType: showEventModal.data.goalType,
                  });
                }}
                className="bg-emerald-500 text-white p-4 rounded-xl font-bold text-xs uppercase shadow-lg hover:bg-emerald-600 transition-all"
              >
                No Assist
              </button>
              {sortPlayersByPosition(showEventModal.side === 'A' ? playersA : playersB)
                .filter(p => isOnPitch(p.id, showEventModal.side === 'A' ? match.teamAId : match.teamBId) && p.id !== showEventModal.data.playerId)
                .map(p => (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => {
                      setShowEventModal(null);
                      addEvent(showEventModal.data.playerId, 'goal', (showEventModal.side === 'A' ? teamA : teamB)!.id, {
                        goalType: showEventModal.data.goalType,
                        assistantId: p.id,
                      });
                    }}
                    className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl font-bold text-xs flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-800 dark:text-slate-200 transition-colors"
                  >
                    <span>{p.name}</span>
                    <span className="text-[10px] text-slate-400">#{p.number}</span>
                  </button>
                ))}
            </div>
          </div>
        )}

        {showEventModal.type === 'substitution' && (
          <div className="space-y-4">
            <p className="text-[9px] font-black uppercase text-slate-400">{showEventModal.step === 1 ? 'Player Leaving' : 'Player Entering'}</p>
            <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto no-scrollbar">
              {(showEventModal.step === 1
                ? sortPlayersByPosition(getEligibleLeaving(showEventModal.side))
                : sortPlayersByPosition(getEligibleSubs(showEventModal.side)).filter(p => p.id !== showEventModal.data?.playerOutId)
              ).map(p => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => {
                    if (showEventModal.step === 1) {
                      setShowEventModal({ ...showEventModal, step: 2, data: { playerOutId: p.id } });
                    } else {
                      setShowEventModal(null);
                      addEvent(showEventModal.data.playerOutId, 'substitution', (showEventModal.side === 'A' ? teamA : teamB)!.id, {
                        assistantId: p.id,
                      });
                    }
                  }}
                  className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl font-bold text-xs flex items-center justify-between transition-colors hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-800 dark:text-slate-200"
                >
                  <span>{p.name}</span>
                  <span className="text-[10px] text-slate-400">#{p.number}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};
