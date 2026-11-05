import React from 'react';
import { motion } from 'motion/react';
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { SoccerIcon, MissedPenaltyIcon } from '../common/Icons';
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
  onSelectPlayer?: (player: Player) => void;
}

export const MatchEventLog: React.FC<MatchEventLogProps> = ({ 
  events, 
  teamA, 
  teamB, 
  playersA, 
  playersB, 
  isCreator, 
  onUndo,
  match,
  onSelectPlayer
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

  const secondYellowEventIds = React.useMemo(() => {
    const ids = new Set<string>();
    const yellowCounts: Record<string, number> = {};
    sortedEvents.forEach(e => {
      if (e.type === 'yellow_card') {
        yellowCounts[e.playerId] = (yellowCounts[e.playerId] || 0) + 1;
        if (yellowCounts[e.playerId] === 2) {
          ids.add(e.id);
        }
      }
    });
    return ids;
  }, [sortedEvents]);

  return (
    <div className="mt-12 max-w-2xl mx-auto px-2">
      <div className="flex items-center gap-4 mb-8">
        <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800/80" />
        <h3 className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-400 dark:text-slate-500">Match Timeline</h3>
        <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800/80" />
      </div>

      <div className="relative flex flex-col gap-6 pl-4 pr-4 md:px-0">
        {/* Dynamic Center Vertical Line */}
        <div className="absolute left-1/2 top-0 bottom-0 w-[2px] bg-slate-100 dark:bg-slate-800 -translate-x-1/2" />

        {events.length === 0 && (
          <div className="text-center py-16 text-slate-300 dark:text-slate-600 font-bold uppercase tracking-[0.2em] text-[10px]">
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
                <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800/80 text-slate-500 px-5 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.15em] shadow-sm ring-[5px] ring-white dark:ring-slate-900">
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
              <div key={e.id} className="relative flex items-center group min-h-[50px] z-10 w-full">
                {/* Timeline node */}
                <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center z-10">
                  <div className={`w-8 h-8 rounded-full bg-white dark:bg-slate-900 border flex items-center justify-center shadow-md ${result === 'goal' ? 'border-emerald-200 dark:border-emerald-800/40 text-emerald-500' : 'border-red-200 dark:border-red-900/40 text-red-500'}`}>
                    {result === 'goal' ? (
                      <SoccerIcon className="w-3.5 h-3.5" />
                    ) : (
                      <MissedPenaltyIcon className="w-4 h-4 text-rose-500" />
                    )}
                  </div>
                </div>

                <div className="flex-1 flex items-center justify-end gap-1 px-1 pr-5 sm:pr-8 min-w-0">
                  {isCreator && displayOnLeft && (
                    <button 
                      onClick={() => onUndo(e.id)} 
                      className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1 text-slate-350 dark:text-slate-600 hover:text-rose-500 dark:hover:text-[#ff6b6b] hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-full transition-all cursor-pointer active:scale-90 shrink-0"
                      title="Delete event"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                  {displayOnLeft && (
                    <div className="bg-slate-50/70 dark:bg-slate-950/40 hover:bg-slate-105/50 dark:hover:bg-slate-950/80 rounded-xl px-2 py-1 xs:px-3 xs:py-1.5 border border-slate-100 dark:border-slate-800 shadow-[2px_4px_12px_rgba(0,0,0,0.02)] flex flex-col items-end justify-center transition-all duration-300 w-full max-w-[110px] xs:max-w-[140px] sm:max-w-[180px] min-w-[70px]">
                      <p 
                        onClick={() => { if (pl && onSelectPlayer) onSelectPlayer(pl); }}
                        className={`text-[10px] sm:text-[11px] font-black text-slate-800 dark:text-slate-205 truncate w-full text-right ${pl && onSelectPlayer ? 'cursor-pointer hover:text-emerald-500 hover:underline' : ''}`}
                      >
                        {pl?.name?.split(' #')[0]}
                      </p>
                      <p className={`text-[7px] sm:text-[8px] font-extrabold uppercase tracking-wider truncate w-full text-right ${result === 'goal' ? 'text-emerald-500' : 'text-red-500'}`}>Penalty {result}</p>
                    </div>
                  )}
                </div>

                <div className="flex-1 flex items-center justify-start gap-1 px-1 pl-5 sm:pl-8 min-w-0">
                  {!displayOnLeft && (
                    <div className="bg-slate-50/70 dark:bg-slate-950/40 hover:bg-slate-105/50 dark:hover:bg-slate-950/80 rounded-xl px-2 py-1 xs:px-3 xs:py-1.5 border border-slate-100 dark:border-slate-800 shadow-[2px_4px_12px_rgba(0,0,0,0.02)] flex flex-col items-start justify-center transition-all duration-300 w-full max-w-[110px] xs:max-w-[140px] sm:max-w-[180px] min-w-[70px]">
                      <p 
                        onClick={() => { if (pl && onSelectPlayer) onSelectPlayer(pl); }}
                        className={`text-[10px] sm:text-[11px] font-black text-slate-800 dark:text-slate-205 truncate w-full text-left ${pl && onSelectPlayer ? 'cursor-pointer hover:text-emerald-500 hover:underline' : ''}`}
                      >
                        {pl?.name?.split(' #')[0]}
                      </p>
                      <p className={`text-[7px] sm:text-[8px] font-extrabold uppercase tracking-wider truncate w-full text-left ${result === 'goal' ? 'text-emerald-500' : 'text-red-500'}`}>Penalty {result}</p>
                    </div>
                  )}
                  {isCreator && !displayOnLeft && (
                    <button 
                      onClick={() => onUndo(e.id)} 
                      className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1 text-slate-350 dark:text-slate-600 hover:text-rose-500 dark:hover:text-[#ff6b6b] hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-full transition-all cursor-pointer active:scale-90 shrink-0"
                      title="Delete event"
                    >
                      <Trash2 className="w-3 h-3" />
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
          const assistantPl = e.assistantId ? (isPlayerTeamA ? playersA : playersB).find(p => p.id === e.assistantId) : null;
          const assistantName = assistantPl?.name?.split(' (')[0].split(' #')[0] || null;
          
          return (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              key={e.id} 
              className="relative flex items-center group min-h-[55px] z-10 w-full"
            >
              {/* Event Marker */}
              <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center z-10">
                <div className={`w-8 h-8 rounded-full bg-white dark:bg-slate-900 border flex items-center justify-center text-[9px] font-black shadow-md transition-all group-hover:border-emerald-300 dark:group-hover:border-emerald-700 ${isOwnGoal ? 'border-red-200 dark:border-red-900/40 text-red-500 shadow-red-100' : 'border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-350 font-mono'}`}>
                  {e.timestamp}
                </div>
              </div>
              {/* Left Side Content */}
              <div className="flex-1 flex items-center justify-end gap-1 px-1 pr-5 sm:pr-8 transition-all min-w-0">
                {isCreator && displayOnLeft && (
                  <button 
                    onClick={() => onUndo(e.id)} 
                    className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1 text-slate-350 dark:text-slate-600 hover:text-rose-500 dark:hover:text-[#ff6b6b] hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-full transition-all cursor-pointer active:scale-90 shrink-0"
                    title="Delete event"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
                {displayOnLeft && (
                  e.type === 'substitution' ? (
                    <div className="bg-slate-50/70 dark:bg-slate-950/40 hover:bg-white dark:hover:bg-slate-900 rounded-xl px-2 py-1 xs:px-3 xs:py-1.5 border border-slate-100 dark:border-slate-800 shadow-[2px_4px_12px_rgba(0,0,0,0.02)] flex flex-col gap-1 transition-all duration-300 w-full max-w-[110px] xs:max-w-[140px] sm:max-w-[180px] min-w-[70px]">
                      {/* Coming In Row */}
                      <div 
                        onClick={() => { if (assistantPl && onSelectPlayer) onSelectPlayer(assistantPl); }}
                        className={`flex items-center justify-end gap-1 w-full min-w-0 ${assistantPl && onSelectPlayer ? 'cursor-pointer hover:text-emerald-500 hover:underline' : ''}`}
                      >
                        <span className="text-[10px] sm:text-[11px] font-black text-slate-800 dark:text-slate-200 truncate leading-none text-right flex-1 min-w-0">{assistantName || 'In'}</span>
                        <div className="w-4 h-4 flex items-center justify-center bg-emerald-50 dark:bg-emerald-950/20 rounded-full border border-emerald-100 dark:border-emerald-900/30 shrink-0">
                          <ArrowDown className="w-2.5 h-2.5 text-emerald-500" strokeWidth={3} />
                        </div>
                      </div>
                      <div className="h-[1px] bg-slate-100/60 dark:bg-slate-800/80 w-full" />
                      {/* Going Out Row */}
                      <div 
                        onClick={() => { if (pl && onSelectPlayer) onSelectPlayer(pl); }}
                        className={`flex items-center justify-end gap-1 w-full min-w-0 ${pl && onSelectPlayer ? 'cursor-pointer hover:text-emerald-500 hover:underline' : ''}`}
                      >
                        <span className="text-[9px] sm:text-[10px] font-semibold text-slate-400 dark:text-slate-500 truncate leading-none text-right flex-1 min-w-0">{pl?.name?.split(' (')[0].split(' #')[0] || 'Out'}</span>
                        <div className="w-4 h-4 flex items-center justify-center bg-rose-50 dark:bg-rose-950/20 rounded-full border border-rose-100 dark:border-rose-900/30 shrink-0">
                          <ArrowUp className="w-2.5 h-2.5 text-rose-500" strokeWidth={3} />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-50/70 dark:bg-slate-950/40 hover:bg-slate-100/50 dark:hover:bg-slate-905/60 rounded-xl px-2 py-1 xs:px-3 xs:py-1.5 border border-slate-100 dark:border-slate-800 shadow-[2px_4px_12px_rgba(0,0,0,0.02)] flex flex-col items-end gap-1 transition-all duration-300 w-full max-w-[110px] xs:max-w-[140px] sm:max-w-[180px] min-w-[70px]">
                      <div className="flex items-center gap-1.5 w-full justify-end min-w-0">
                        <div className="flex flex-col items-end min-w-0 flex-1">
                          <span 
                            onClick={() => { if (pl && onSelectPlayer) onSelectPlayer(pl); }}
                            className={`text-[10px] sm:text-[11px] font-black leading-snug truncate w-full text-right ${isOwnGoal ? 'text-red-500' : 'text-slate-800 hover:text-emerald-500 dark:text-slate-200 dark:hover:text-emerald-450'} ${pl && onSelectPlayer ? 'cursor-pointer hover:underline' : ''}`}
                          >
                            {pl?.name?.split(' (')[0].split(' #')[0] || (displayOnLeft ? teamA?.name : teamB?.name) || 'Goal'}
                          </span>
                          {e.assistantId && (
                            <div className="flex items-center gap-0.5 text-[8px] text-slate-400 dark:text-slate-540 font-bold tracking-tight mt-0.5 truncate w-full justify-end min-w-0">
                              <span className="text-slate-300 dark:text-slate-600 shrink-0">Assist:</span>
                              <span 
                                onClick={() => { if (assistantPl && onSelectPlayer) onSelectPlayer(assistantPl); }}
                                className={`truncate ${assistantPl && onSelectPlayer ? 'cursor-pointer hover:text-emerald-500 hover:underline' : ''}`}
                              >
                                { assistantName }
                              </span>
                            </div>
                          )}
                        </div>
                        {e.type === 'goal' ? (
                          <div className="w-4 h-4 flex items-center justify-center bg-emerald-50 dark:bg-emerald-950/20 rounded-lg p-0.5 shrink-0 animate-pulse">
                            <SoccerIcon className={`w-3 h-3 ${isOwnGoal ? 'text-red-500' : 'text-emerald-500'}`} />
                          </div>
                        ) : e.type === 'yellow_card' && secondYellowEventIds.has(e.id) ? (
                          <div className="relative w-5 h-4 flex items-center justify-center shrink-0 filter drop-shadow-[0_1px_1px_rgba(0,0,0,0.15)]" title="Second Yellow (Red Card)">
                            {/* Yellow card under */}
                            <div className="absolute top-0.5 left-0.5 w-[7px] h-[11px] bg-amber-400 rounded-[1px] border border-amber-500/10 transform -rotate-[12deg] z-10" />
                            {/* Red card over */}
                            <div className="absolute top-0 left-2 w-[7px] h-[11px] bg-rose-500 rounded-[1px] border border-rose-600/10 transform rotate-[8deg] z-20 shadow-sm" />
                          </div>
                        ) : (
                          <div className={`w-2 h-3 rounded-[1.5px] shadow-sm shrink-0 ${e.type === 'yellow_card' ? 'bg-amber-400' : 'bg-red-500'}`} />
                        )}
                      </div>
                      {e.type === 'goal' && e.goalType && (
                        <div className={`inline-flex items-center px-1 py-0.5 rounded-full text-[6px] sm:text-[7px] font-black uppercase tracking-widest ${isOwnGoal ? 'bg-red-50 dark:bg-red-950/30 text-red-400' : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600'}`}>
                          {e.goalType.replace(/_/g,' ')}
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>

              {/* Right Side Content */}
              <div className="flex-1 flex items-center justify-start gap-1 px-1 pl-5 sm:pl-8 transition-all min-w-0">
                {!displayOnLeft && (
                  e.type === 'substitution' ? (
                    <div className="bg-slate-50/70 dark:bg-slate-950/40 hover:bg-white dark:hover:bg-slate-900 rounded-xl px-2 py-1 xs:px-3 xs:py-1.5 border border-slate-100 dark:border-slate-800 shadow-[2px_4px_12px_rgba(0,0,0,0.02)] flex flex-col gap-1 transition-all duration-300 w-full max-w-[110px] xs:max-w-[140px] sm:max-w-[180px] min-w-[70px]">
                      {/* Coming In Row */}
                      <div 
                        onClick={() => { if (assistantPl && onSelectPlayer) onSelectPlayer(assistantPl); }}
                        className={`flex items-center justify-start gap-1 w-full min-w-0 ${assistantPl && onSelectPlayer ? 'cursor-pointer hover:text-emerald-500 hover:underline' : ''}`}
                      >
                        <div className="w-4 h-4 flex items-center justify-center bg-emerald-50 dark:bg-emerald-950/20 rounded-full border border-emerald-100 dark:border-emerald-900/30 shrink-0">
                          <ArrowDown className="w-2.5 h-2.5 text-emerald-500" strokeWidth={3} />
                        </div>
                        <span className="text-[10px] sm:text-[11px] font-black text-slate-800 dark:text-slate-200 truncate leading-none text-left flex-1 min-w-0">{assistantName || 'In'}</span>
                      </div>
                      <div className="h-[1px] bg-slate-100/60 dark:bg-slate-800/80 w-full" />
                      {/* Going Out Row */}
                      <div 
                        onClick={() => { if (pl && onSelectPlayer) onSelectPlayer(pl); }}
                        className={`flex items-center justify-start gap-1 w-full min-w-0 ${pl && onSelectPlayer ? 'cursor-pointer hover:text-emerald-500 hover:underline' : ''}`}
                      >
                        <div className="w-4 h-4 flex items-center justify-center bg-rose-50 dark:bg-rose-950/20 rounded-full border border-rose-100 dark:border-rose-900/30 shrink-0">
                          <ArrowUp className="w-2.5 h-2.5 text-rose-500" strokeWidth={3} />
                        </div>
                        <span className="text-[9px] sm:text-[10px] font-semibold text-slate-400 dark:text-slate-500 truncate leading-none text-left flex-1 min-w-0">{pl?.name?.split(' (')[0].split(' #')[0] || 'Out'}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-50/70 dark:bg-slate-950/40 hover:bg-slate-105 darK:hover:bg-slate-950/80 border border-slate-100 dark:border-slate-800 shadow-[2px_4px_12px_rgba(0,0,0,0.02)] flex flex-col items-start gap-1 transition-all duration-300 w-full max-w-[110px] xs:max-w-[140px] sm:max-w-[180px] min-w-[70px]">
                      <div className="flex items-center gap-1.5 w-full justify-start min-w-0">
                        {e.type === 'goal' ? (
                          <div className="w-4 h-4 flex items-center justify-center bg-emerald-50 dark:bg-emerald-950/20 rounded-lg p-0.5 shrink-0 animate-pulse">
                            <SoccerIcon className={`w-3 h-3 ${isOwnGoal ? 'text-red-500' : 'text-emerald-500'}`} />
                          </div>
                        ) : e.type === 'yellow_card' && secondYellowEventIds.has(e.id) ? (
                          <div className="relative w-5 h-4 flex items-center justify-center shrink-0 filter drop-shadow-[0_1px_1px_rgba(0,0,0,0.15)]" title="Second Yellow (Red Card)">
                            {/* Yellow card under */}
                            <div className="absolute top-0.5 left-0.5 w-[7px] h-[11px] bg-amber-400 rounded-[1px] border border-amber-500/10 transform -rotate-[12deg] z-10" />
                            {/* Red card over */}
                            <div className="absolute top-0 left-2 w-[7px] h-[11px] bg-rose-500 rounded-[1px] border border-rose-600/10 transform rotate-[8deg] z-20 shadow-sm" />
                          </div>
                        ) : (
                          <div className={`w-2 h-3 rounded-[1.5px] shadow-sm shrink-0 ${e.type === 'yellow_card' ? 'bg-amber-400' : 'bg-red-500'}`} />
                        )}
                        <div className="flex flex-col items-start min-w-0 flex-1">
                          <span 
                            onClick={() => { if (pl && onSelectPlayer) onSelectPlayer(pl); }}
                            className={`text-[10px] sm:text-[11px] font-black leading-snug truncate w-full text-left ${isOwnGoal ? 'text-red-500' : 'text-slate-800 hover:text-emerald-500 dark:text-slate-200 dark:hover:text-emerald-450'} ${pl && onSelectPlayer ? 'cursor-pointer hover:underline' : ''}`}
                          >
                            {pl?.name?.split(' (')[0].split(' #')[0] || (!displayOnLeft ? teamB?.name : teamA?.name) || 'Goal'}
                          </span>
                          {e.assistantId && (
                            <div className="flex items-center gap-0.5 text-[8px] text-slate-400 dark:text-slate-540 font-bold tracking-tight mt-0.5 truncate w-full justify-start min-w-0">
                              <span className="text-slate-300 dark:text-slate-600 shrink-0">Assist:</span>
                              <span 
                                onClick={() => { if (assistantPl && onSelectPlayer) onSelectPlayer(assistantPl); }}
                                className={`truncate ${assistantPl && onSelectPlayer ? 'cursor-pointer hover:text-emerald-500 hover:underline' : ''}`}
                              >
                                { assistantName }
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      {e.type === 'goal' && e.goalType && (
                        <div className={`inline-flex items-center px-1 py-0.5 rounded-full text-[6px] sm:text-[7px] font-black uppercase tracking-widest ${isOwnGoal ? 'bg-red-50 dark:bg-red-950/30 text-red-400' : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600'}`}>
                          {e.goalType.replace(/_/g,' ')}
                        </div>
                      )}
                    </div>
                  )
                )}
                {isCreator && !displayOnLeft && (
                  <button 
                    onClick={() => onUndo(e.id)} 
                    className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1 text-slate-350 dark:text-slate-600 hover:text-rose-500 dark:hover:text-[#ff6b6b] hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-full transition-all cursor-pointer active:scale-90 shrink-0"
                    title="Delete event"
                  >
                    <Trash2 className="w-3 h-3" />
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
