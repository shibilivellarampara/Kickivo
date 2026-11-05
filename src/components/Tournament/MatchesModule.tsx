import React from 'react';
import { motion } from 'motion/react';
import { Calendar, ChevronRight } from 'lucide-react';
import { Tournament, Match, Team } from '../../types';
import { renderTeamLogo } from '../../utils/avatarUtils';

interface MatchesModuleProps {
  tournament: Tournament;
  matches: Match[];
  teams: Team[];
  onSelectMatch: (match: Match) => void;
  onSelectTeam?: (team: Team) => void;
}

export const MatchesModule: React.FC<MatchesModuleProps> = ({
  tournament,
  matches,
  teams,
  onSelectMatch,
  onSelectTeam,
}) => {
  if (matches.length === 0) {
    return (
      <div className="py-20 text-center font-bold text-slate-300 dark:text-slate-500 uppercase tracking-widest bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800/80 italic select-none">
        No matches scheduled yet
      </div>
    );
  }

  const grouped = matches.reduce((acc, m) => {
    const dateKey = m.kickoff 
      ? m.kickoff.toDate().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }) 
      : (m.round || m.group || 'Regular Season');
    
    if (!acc[dateKey]) {
      acc[dateKey] = {
        matches: [],
        timestamp: m.kickoff?.seconds || (m.createdAt?.seconds || 0),
        roundIndex: m.round ? ['Round of 64', 'Round of 32', 'Round of 16', 'Qualification', 'Qualifier', 'Playoff', 'Quarter-final', 'Semi-final', 'Losers Final', 'Final'].indexOf(m.round) : -1
      };
    }
    acc[dateKey].matches.push(m);
    return acc;
  }, {} as Record<string, { matches: Match[], timestamp: number, roundIndex: number }>);

  const sortedGroups = (Object.entries(grouped) as [string, { matches: Match[], timestamp: number, roundIndex: number }][])
    .sort(([, a], [, b]) => {
      if (tournament.type === 'knockout' && a.roundIndex !== -1 && b.roundIndex !== -1) {
        return a.roundIndex - b.roundIndex;
      }
      return a.timestamp - b.timestamp;
    });

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8 animate-fade-in">
      {sortedGroups.map(([g, groupData]) => (
        <div key={g} className="space-y-4">
          <div className="flex items-center gap-3 px-2">
            <div className="h-[2px] flex-1 bg-slate-100/70" />
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] flex items-center gap-2 select-none">
              <Calendar className="w-3.5 h-3.5 text-slate-300 shrink-0" /> {g}
            </h3>
            <div className="h-[2px] flex-1 bg-slate-100/70" />
          </div>
          
          <div className="space-y-3">
            {groupData.matches.sort((a, b) => (a.kickoff?.seconds || 0) - (b.kickoff?.seconds || 0)).map(m => {
              const tA = teams.find(t => t.id === m.teamAId);
              const tB = teams.find(t => t.id === m.teamBId);
              const isF = m.status === 'finished';
              const winA = isF && (m.scoreA > m.scoreB || (m.scoreA === m.scoreB && (m.pensA || 0) > (m.pensB || 0)));
              const winB = isF && (m.scoreB > m.scoreA || (m.scoreA === m.scoreB && (m.pensB || 0) > (m.pensA || 0)));
              const isBye = m.placeholderA === 'BYE' || m.placeholderB === 'BYE';
              
              return (
                <div 
                  key={m.id} 
                  onClick={() => onSelectMatch(m)} 
                  className="bg-white dark:bg-slate-900 px-5 py-4 rounded-[24px] border border-slate-100 dark:border-slate-800/80 flex items-center group hover:border-emerald-400 hover:shadow-md transition-all shadow-sm cursor-pointer"
                >
                  <div className="w-14 md:w-18 text-center border-r border-slate-100 dark:border-slate-800 pr-3 mr-3 flex flex-col items-center justify-center shrink-0">
                    <span className={`text-[10px] font-black uppercase tracking-wider ${isF ? 'text-slate-400' : m.status === 'live' ? 'text-emerald-500 animate-pulse font-black' : 'text-slate-300'}`}>
                      {isBye ? 'BYE' : (isF ? 'FT' : (m.status === 'live' ? 'Live' : 'vs'))}
                    </span>
                    {m.status === 'scheduled' && m.kickoff && !isBye && (
                      <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 mt-0.5">
                        {m.kickoff.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex-1 grid grid-cols-[1fr_auto_1fr] items-center gap-2 md:gap-4 min-w-0">
                    {/* Team A */}
                    <div className="flex items-center justify-end gap-2 md:gap-3 min-w-0">
                      <span 
                        onClick={(e) => {
                          if (tA && onSelectTeam) {
                            e.stopPropagation();
                            onSelectTeam(tA);
                          }
                        }}
                        className={`font-bold truncate text-xs md:text-sm lg:text-base text-right ${winA ? 'text-emerald-500 font-extrabold' : m.placeholderA === 'BYE' ? 'text-slate-300 dark:text-slate-650 italic' : 'text-slate-700 dark:text-slate-200'} ${tA && onSelectTeam ? 'hover:text-emerald-500 hover:underline cursor-pointer' : ''}`}
                      >
                        {tA?.name || m.placeholderA || 'TBD'}
                      </span>
                      {renderTeamLogo(tA?.logoURL, tA?.name || m.placeholderA || '', "w-6 h-6 md:w-8 md:h-8 hover:scale-105 transition-transform division-glow")}
                    </div>
  
                    {/* Score Box */}
                    <div className={`px-2.5 md:px-4 py-1.5 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-center gap-2 ${isBye ? 'min-w-[120px] md:min-w-[170px]' : 'min-w-[60px] md:min-w-[90px]'}`}>
                      {isBye ? (
                        <span className="text-[9px] md:text-[10px] font-black text-amber-500 uppercase tracking-wider">Advances as BYE</span>
                      ) : m.status === 'scheduled' ? (
                        <span className="text-[10px] font-bold text-slate-300 dark:text-slate-600">VS</span>
                      ) : (
                        <>
                           <span className={`font-black text-sm md:text-base ${winA ? 'text-emerald-500' : 'text-slate-700 dark:text-slate-200'}`}>{m.scoreA}</span>
                           <span className="text-slate-300 dark:text-slate-700 font-medium">-</span>
                           <span className={`font-black text-sm md:text-base ${winB ? 'text-emerald-500' : 'text-slate-700 dark:text-slate-200'}`}>{m.scoreB}</span>
                        </>
                      )}
                    </div>
  
                    {/* Team B */}
                    <div className="flex items-center justify-start gap-2 md:gap-3 min-w-0">
                      {renderTeamLogo(tB?.logoURL, tB?.name || m.placeholderB || '', "w-6 h-6 md:w-8 md:h-8 hover:scale-105 transition-transform division-glow")}
                      <span 
                        onClick={(e) => {
                          if (tB && onSelectTeam) {
                            e.stopPropagation();
                            onSelectTeam(tB);
                          }
                        }}
                        className={`font-bold truncate text-xs md:text-sm lg:text-base text-left ${winB ? 'text-emerald-500 font-extrabold' : m.placeholderB === 'BYE' ? 'text-slate-300 dark:text-slate-650 italic' : 'text-slate-700 dark:text-slate-200'} ${tB && onSelectTeam ? 'hover:text-emerald-500 hover:underline cursor-pointer' : ''}`}
                      >
                        {tB?.name || m.placeholderB || 'TBD'}
                      </span>
                    </div>
                  </div>
 
                  <div className="w-6 flex items-center justify-end ml-2 shrink-0">
                    <ChevronRight className="w-4 h-4 text-slate-200 dark:text-slate-700 group-hover:text-emerald-500 transition-colors" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </motion.div>
  );
};
