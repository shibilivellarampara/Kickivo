import React from 'react';
import { motion } from 'motion/react';
import { ArrowDown, ArrowUp, Shield, Trash2 } from 'lucide-react';
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
    <div className="mt-12 max-w-2xl mx-auto px-2">
      <div className="flex items-center gap-4 mb-8">
        <div className="h-px flex-1 bg-slate-100" />
        <h3 className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-400">Match Timeline</h3>
        <div className="h-px flex-1 bg-slate-100" />
      </div>

      <div className="relative flex flex-col gap-6 pl-4 pr-4 md:px-0">
        {/* Dynamic Center Vertical Line */}
        <div className="absolute left-1/2 top-0 bottom-0 w-[2px] bg-slate-100 -translate-x-1/2" />

        {events.length === 0 && (
          <div className="text-center py-16 text-slate-300 font-bold uppercase tracking-[0.2em] text-[10px]">
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
              <div key={e.id} className="relative z-10 flex justify-center py-2">
                <div className="bg-slate-900 border border-slate-800 text-white px-6 py-2 rounded-full text-[9px] font-black uppercase tracking-[0.2em] shadow-lg ring-[6px] ring-white">
                  {milestoneLabel}{e.timestamp && e.timestamp !== 'Pens' && e.timestamp !== '0\'' && e.timestamp !== "null" ? ` • ${e.timestamp}` : ''}
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
              <div key={e.id} className="relative flex items-center group min-h-[50px] z-10">
                {/* Timeline node */}
                <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center z-10">
                  <div className={`w-8 h-8 rounded-full bg-white border flex items-center justify-center shadow-md ${result === 'goal' ? 'border-emerald-200 text-emerald-500' : 'border-red-200 text-red-500'}`}>
                    <SoccerIcon className="w-3.5 h-3.5" />
                  </div>
                </div>

                <div className="flex-1 flex items-center justify-end gap-3 pr-8">
                  {isCreator && displayOnLeft && (
                    <button 
                      onClick={() => onUndo(e.id)} 
                      className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-500 rounded-lg border border-rose-100/50 transition-all cursor-pointer shadow-sm active:scale-95 shrink-0"
                      title="Delete event"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {displayOnLeft && (
                    <div className="bg-slate-50/70 hover:bg-slate-100/50 rounded-2xl px-4 py-2.5 border border-slate-100 shadow-[2px_4px_12px_rgba(0,0,0,0.02)] inline-flex items-center gap-3 transition-all duration-300">
                      <div className="text-right">
                        <p className="text-[11px] font-black text-slate-800">{pl?.name?.split(' #')[0]}</p>
                        <p className={`text-[8px] font-extrabold uppercase tracking-widest ${result === 'goal' ? 'text-emerald-500' : 'text-red-500'}`}>Penalty {result}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex-1 flex items-center justify-start gap-3 pl-8">
                  {!displayOnLeft && (
                    <div className="bg-slate-50/70 hover:bg-slate-100/50 rounded-2xl px-4 py-2.5 border border-slate-100 shadow-[2px_4px_12px_rgba(0,0,0,0.02)] inline-flex items-center gap-3 transition-all duration-300">
                      <div className="text-left">
                        <p className="text-[11px] font-black text-slate-800">{pl?.name?.split(' #')[0]}</p>
                        <p className={`text-[8px] font-extrabold uppercase tracking-widest ${result === 'goal' ? 'text-emerald-500' : 'text-red-500'}`}>Penalty {result}</p>
                      </div>
                    </div>
                  )}
                  {isCreator && !displayOnLeft && (
                    <button 
                      onClick={() => onUndo(e.id)} 
                      className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-500 rounded-lg border border-rose-100/50 transition-all cursor-pointer shadow-sm active:scale-95 shrink-0"
                      title="Delete event"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
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
          const assistantName = e.assistantId ? (isPlayerTeamA ? playersA : playersB).find(p => p.id === e.assistantId)?.name?.split(' (')[0].split(' #')[0] : null;
          
          return (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              key={e.id} 
              className="relative flex items-center group min-h-[55px] z-10"
            >
              {/* Event Marker */}
              <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center z-10">
                <div className={`w-9 h-9 rounded-full bg-white border flex items-center justify-center text-[10px] font-black shadow-md transition-all group-hover:border-emerald-300 ${isOwnGoal ? 'border-red-200 text-red-500 shadow-red-100' : 'border-slate-100 text-slate-600 font-mono'}`}>
                  {e.timestamp}
                </div>
              </div>              {/* Left Side Content */}
              <div className="flex-1 flex items-center justify-end gap-3 pr-8 transition-all">
                {isCreator && displayOnLeft && (
                  <button 
                    onClick={() => onUndo(e.id)} 
                    className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-500 rounded-lg border border-rose-100/50 transition-all cursor-pointer shadow-sm active:scale-95 shrink-0"
                    title="Delete event"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                {displayOnLeft && (
                  <div className="bg-slate-50/70 hover:bg-slate-100/50 rounded-2xl px-4 py-2.5 border border-slate-100 shadow-[2px_4px_12px_rgba(0,0,0,0.02)] inline-flex flex-col items-end gap-1 text-right transition-all duration-300">
                    <div className="flex items-center gap-2.5">
                      <div className="flex flex-col items-end">
                        <span className={`text-[11px] font-black leading-snug ${isOwnGoal ? 'text-red-500' : 'text-slate-800'}`}>{pl?.name?.split(' (')[0].split(' #')[0]}</span>
                        {e.assistantId && (
                          <div className="flex items-center gap-1 text-[8px] text-slate-400 font-bold tracking-tight mt-0.5">
                            {e.type === 'substitution'
                              ? <><ArrowUp className="w-2.5 h-2.5 text-emerald-500 shrink-0" /><span>{ assistantName }</span></>
                              : <><span className="text-slate-300">Assist:</span><span>{ assistantName }</span></>
                            }
                          </div>
                        )}
                      </div>
                      {e.type === 'goal' ? (
                        <div className="w-5 h-5 flex items-center justify-center bg-emerald-50 rounded-lg p-1 shrink-0">
                          <SoccerIcon className={`w-3.5 h-3.5 ${isOwnGoal ? 'text-red-500' : 'text-emerald-500'}`} />
                        </div>
                      ) : e.type === 'substitution' ? (
                        <div className="flex flex-col items-center justify-center bg-blue-50 rounded-lg p-1 shrink-0 w-5 h-5">
                          <ArrowUp className="w-2.5 h-2.5 text-emerald-500" />
                        </div>
                      ) : (
                        <div className={`w-2.5 h-3.5 rounded-[2px] shadow-sm shrink-0 ${e.type === 'yellow_card' ? 'bg-amber-400' : 'bg-red-500'}`} />
                      )}
                    </div>
                    {e.type === 'goal' && e.goalType && (
                      <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest ${isOwnGoal ? 'bg-red-50 text-red-400' : 'bg-emerald-50 text-emerald-600'}`}>
                        {e.goalType.replace(/_/g,' ')}
                      </div>
                    )}
                    {e.type === 'substitution' && (
                      <div className="text-[7px] text-slate-400 font-black uppercase tracking-widest mt-0.5 flex items-center gap-1">
                        <ArrowDown className="w-2 h-2 text-red-400" /> Came Off
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Right Side Content */}
              <div className="flex-1 flex items-center justify-start gap-3 pl-8">
                {!displayOnLeft && (
                  <div className="bg-slate-50/70 hover:bg-slate-100/50 rounded-2xl px-4 py-2.5 border border-slate-100 shadow-[2px_4px_12px_rgba(0,0,0,0.02)] inline-flex flex-col items-start gap-1 text-left transition-all duration-300">
                    <div className="flex items-center gap-2.5">
                      {e.type === 'goal' ? (
                        <div className="w-5 h-5 flex items-center justify-center bg-emerald-50 rounded-lg p-1 shrink-0">
                          <SoccerIcon className={`w-3.5 h-3.5 ${isOwnGoal ? 'text-red-500' : 'text-emerald-500'}`} />
                        </div>
                      ) : e.type === 'substitution' ? (
                        <div className="flex flex-col items-center justify-center bg-blue-50 rounded-lg p-1 shrink-0 w-5 h-5">
                          <ArrowUp className="w-2.5 h-2.5 text-emerald-500" />
                        </div>
                      ) : (
                        <div className={`w-2.5 h-3.5 rounded-[2px] shadow-sm shrink-0 ${e.type === 'yellow_card' ? 'bg-amber-400' : 'bg-red-500'}`} />
                      )}
                      <div className="flex flex-col items-start">
                        <span className={`text-[11px] font-black leading-snug ${isOwnGoal ? 'text-red-500' : 'text-slate-800'}`}>{pl?.name?.split(' (')[0].split(' #')[0]}</span>
                        {e.assistantId && (
                          <div className="flex items-center gap-1 text-[8px] text-slate-400 font-bold tracking-tight mt-0.5">
                            {e.type === 'substitution'
                              ? <><ArrowUp className="w-2.5 h-2.5 text-emerald-500 shrink-0" /><span>{ assistantName }</span></>
                              : <><span className="text-slate-300">Assist:</span><span>{ assistantName }</span></>
                            }
                          </div>
                        )}
                      </div>
                    </div>
                    {e.type === 'goal' && e.goalType && (
                      <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest ${isOwnGoal ? 'bg-red-50 text-red-400' : 'bg-emerald-50 text-emerald-600'}`}>
                        {e.goalType.replace(/_/g,' ')}
                      </div>
                    )}
                    {e.type === 'substitution' && (
                      <div className="text-[7px] text-slate-400 font-black uppercase tracking-widest mt-0.5 flex items-center gap-1">
                        <ArrowDown className="w-2 h-2 text-red-400" /> Came Off
                      </div>
                    )}
                  </div>
                )}
                {isCreator && !displayOnLeft && (
                  <button 
                    onClick={() => onUndo(e.id)} 
                    className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-500 rounded-lg border border-rose-100/50 transition-all cursor-pointer shadow-sm active:scale-95 shrink-0"
                    title="Delete event"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
