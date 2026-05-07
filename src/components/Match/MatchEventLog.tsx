import React from 'react';
import { motion } from 'motion/react';
import { ArrowDown, ArrowUp, Footprints, Shield } from 'lucide-react';
import { SoccerIcon } from '../common/Icons';
import { Match, MatchEvent, Player, Team } from '../../types';

interface MatchEventLogProps {
  events: MatchEvent[];
  teamA: Team | undefined;
  teamB: Team | undefined;
  playersA: Player[];
  playersB: Player[];
  isCreator: boolean;
  onUndo: (eventId: string) => void;
  match: Match;
}

export const MatchEventLog: React.FC<MatchEventLogProps> = ({ 
  events, 
  teamA, 
  teamB, 
  playersA, 
  playersB, 
  isCreator, 
  onUndo,
  match
}) => {
  const sortedEvents = [...events].sort((a, b) => {
    const parseTime = (t: string) => {
      if (!t || !t.includes("'")) return 999; 
      const mins = parseInt(t.replace('\'',''));
      return isNaN(mins) ? 999 : mins;
    };
    const timeA = parseTime(a.timestamp || "");
    const timeB = parseTime(b.timestamp || "");
    if (timeA !== timeB) return timeA - timeB;
    
    // Fallback to createdAt if timestamps are equal
    const createA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
    const createB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
    return createA - createB;
  });

  return (
    <div className="mt-16 max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-10">
        <div className="h-px flex-1 bg-slate-100" />
        <h3 className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-400">Match Timeline</h3>
        <div className="h-px flex-1 bg-slate-100" />
      </div>

      <div className="relative space-y-8">
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-200 -translate-x-1/2" />

        {events.length === 0 && (
          <div className="text-center py-24 text-slate-200 font-black uppercase tracking-[0.2em] text-xs">
            Waiting for match kick-off...
          </div>
        )}

        {sortedEvents.map((e) => {
          if (e.type === 'milestone') {
            const milestoneLabel = e.milestoneType === 'half_time' ? 'Half Time' : 
                                  e.milestoneType === 'full_time' ? 'Full Time' : 
                                  e.milestoneType === 'extra_time' ? 'Extra Time Started' :
                                  e.milestoneType === 'et_ended' ? 'Extra Time Ended' :
                                  e.milestoneType === 'penalties' ? 'Penalty Shootout' : 
                                  e.milestoneType === 'end' ? 'Match Ended' : (e.milestoneType || 'Milestone');
            return (
              <div key={e.id} className="relative z-10 flex justify-center py-4">
                <div className="bg-slate-900 text-white px-8 py-2.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl ring-[8px] ring-white">
                  {milestoneLabel} {e.timestamp && e.timestamp !== 'Pens' && `• ${e.timestamp}`}
                </div>
              </div>
            );
          }

          if (e.type === 'penalty_kick') {
            const playerTeamId = e.teamId;
            const isPlayerTeamA = playerTeamId === teamA?.id;
            const pl = (isPlayerTeamA ? playersA : playersB).find(p => p.id === e.playerId);
            const result = e.penaltyResult || 'goal';
            const displayOnLeft = isPlayerTeamA;

            return (
              <div key={e.id} className="relative flex items-center min-h-[50px]">
                <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center z-10">
                  <div className={`w-8 h-8 rounded-full bg-white border-2 flex items-center justify-center shadow-sm ${result === 'goal' ? 'border-emerald-200 text-emerald-500' : 'border-red-200 text-red-500'}`}>
                    <SoccerIcon className="w-3 h-3" />
                  </div>
                </div>

                <div className="flex-1 flex flex-col items-end pr-8">
                  {displayOnLeft && (
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-[10px] font-black text-slate-900">{pl?.name?.split(' #')[0]}</p>
                        <p className={`text-[8px] font-bold uppercase tracking-widest ${result === 'goal' ? 'text-emerald-500' : 'text-red-500'}`}>Penalty {result}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex-1 flex flex-col items-start pl-8">
                  {!displayOnLeft && (
                    <div className="flex items-center gap-3">
                      <div className="text-left">
                        <p className="text-[10px] font-black text-slate-900">{pl?.name?.split(' #')[0]}</p>
                        <p className={`text-[8px] font-bold uppercase tracking-widest ${result === 'goal' ? 'text-emerald-500' : 'text-red-500'}`}>Penalty {result}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          }

          if (e.type !== 'goal' && e.type !== 'substitution' && e.type !== 'yellow_card' && e.type !== 'red_card') {
            return null;
          }

          const playerTeamId = e.teamId;
          const isPlayerTeamA = playerTeamId === teamA?.id;
          const isOwnGoal = e.type === 'goal' && e.goalType === 'own_goal';
          const displayOnLeft = isOwnGoal ? !isPlayerTeamA : isPlayerTeamA;
          
          const pl = (isPlayerTeamA ? playersA : playersB).find(p => p.id === e.playerId);
          
          return (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              key={e.id} 
              className="relative flex items-center group min-h-[60px]"
            >
              {/* Event Marker */}
              <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center z-10">
                <div className={`w-10 h-10 rounded-full bg-white border-2 flex items-center justify-center text-[9px] font-black shadow-md transition-all group-hover:border-emerald-300 ${isOwnGoal ? 'border-red-200 text-red-500' : 'border-slate-100 text-slate-500 font-mono'}`}>
                  {e.timestamp}
                </div>
              </div>

              {/* Left Side Content */}
              <div className="flex-1 flex flex-col items-end pr-8 transition-all">
                {displayOnLeft && (
                  <div className="text-right space-y-0.5">
                    <div className="flex items-center justify-end gap-3">
                      <div className="flex flex-col items-end">
                        <span className={`text-xs font-black ${isOwnGoal ? 'text-red-500' : 'text-slate-900'}`}>{pl?.name?.split(' (')[0].split(' #')[0]}</span>
                        {e.assistantId && (
                          <div className="flex items-center justify-end gap-1 text-[9px] text-slate-400 font-bold uppercase transition-colors">
                            <span>{ (isPlayerTeamA ? playersA : playersB).find(p => p.id === e.assistantId)?.name?.split(' (')[0].split(' #')[0] }</span>
                            {e.type === 'substitution' ? <ArrowUp className="w-2.5 h-2.5 text-emerald-500" /> : <Footprints className="w-2.5 h-2.5" />}
                          </div>
                        )}
                      </div>
                      {e.type === 'goal' ? (
                        <div className="w-6 h-6 flex items-center justify-center">
                          <SoccerIcon className={`w-4 h-4 ${isOwnGoal ? 'text-red-500' : 'text-emerald-500'}`} />
                        </div>
                      ) : e.type === 'substitution' ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <ArrowDown className="w-2.5 h-2.5 text-red-500" />
                          <ArrowUp className="w-2.5 h-2.5 text-emerald-500" />
                        </div>
                      ) : (
                        <div className={`w-3 h-4 rounded-[2px] shadow-sm ${e.type === 'yellow_card' ? 'bg-amber-400' : 'bg-red-500'}`} />
                      )}
                    </div>
                    {e.type === 'goal' && e.goalType && (
                      <div className={`text-[9px] uppercase font-black tracking-widest ${isOwnGoal ? 'text-red-500/50' : 'text-slate-300'}`}>{e.goalType.replace('_',' ')}</div>
                    )}
                  </div>
                )}
              </div>

              {/* Right Side Content */}
              <div className="flex-1 pl-8">
                {!displayOnLeft && (
                  <div className="text-left space-y-0.5">
                    <div className="flex items-center justify-start gap-3">
                      {e.type === 'goal' ? (
                        <div className="w-6 h-6 flex items-center justify-center">
                          <SoccerIcon className={`w-4 h-4 ${isOwnGoal ? 'text-red-500' : 'text-emerald-500'}`} />
                        </div>
                      ) : e.type === 'substitution' ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <ArrowDown className="w-2.5 h-2.5 text-red-500" />
                          <ArrowUp className="w-2.5 h-2.5 text-emerald-500" />
                        </div>
                      ) : (
                        <div className={`w-3 h-4 rounded-[2px] shadow-sm ${e.type === 'yellow_card' ? 'bg-amber-400' : 'bg-red-500'}`} />
                      )}
                      <div className="flex flex-col items-start">
                        <span className={`text-xs font-black ${isOwnGoal ? 'text-red-500' : 'text-slate-900'}`}>{pl?.name?.split(' (')[0].split(' #')[0]}</span>
                        {e.assistantId && (
                          <div className="flex items-center justify-start gap-1 text-[9px] text-slate-400 font-bold uppercase transition-colors">
                            {e.type === 'substitution' ? <ArrowUp className="w-2.5 h-2.5 text-emerald-500" /> : <Footprints className="w-2.5 h-2.5" />}
                            <span>{ (isPlayerTeamA ? playersA : playersB).find(p => p.id === e.assistantId)?.name?.split(' (')[0].split(' #')[0] }</span>
                          </div>
                        )}
                      </div>
                    </div>
                    {e.type === 'goal' && e.goalType && (
                      <div className={`text-[9px] uppercase font-black tracking-widest ${isOwnGoal ? 'text-red-500/50' : 'text-slate-300'}`}>{e.goalType.replace('_',' ')}</div>
                    )}
                  </div>
                )}
              </div>
              
              {isCreator && (
                <button 
                  onClick={() => onUndo(e.id)} 
                  className="absolute top-1/2 -translate-y-1/2 -right-4 opacity-0 group-hover:opacity-100 p-2 text-slate-200 hover:text-red-500 transition-all font-black text-[9px] uppercase"
                >
                  Undo
                </button>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
