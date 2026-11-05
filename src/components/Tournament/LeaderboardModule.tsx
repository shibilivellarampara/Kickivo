import React from 'react';
import { motion } from 'motion/react';
import { Footprints, Star } from 'lucide-react';
import { SoccerIcon } from '../common/Icons';
import { Match, Team, Player, MatchEvent } from '../../types';
import { getTeamShortName } from '../../utils/football';

interface LeaderboardModuleProps {
  events: MatchEvent[];
  allPlayers: Player[];
  teams: Team[];
  matches: Match[];
  onSelectPlayer?: (player: Player) => void;
  onSelectTeam?: (team: Team) => void;
}

export const LeaderboardModule: React.FC<LeaderboardModuleProps> = ({
  events,
  allPlayers,
  teams,
  matches,
  onSelectPlayer,
  onSelectTeam,
}) => {
  const handlePlayerClick = (pid: string) => {
    const fullPlayer = allPlayers.find(pl => pl.id === pid);
    if (fullPlayer) {
      onSelectPlayer?.(fullPlayer);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-12 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        
        {/* Golden Boot */}
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg">
              <SoccerIcon className="w-6 h-6 text-white" />
            </div>
            <h3 className="font-black uppercase italic text-slate-900 dark:text-white tracking-tight text-sm">Golden Boot</h3>
          </div>
          <div className="space-y-4">
            {Array.from(new Set<string>(events.filter(e => e.type === 'goal' && e.goalType !== 'own_goal' && !e.isPenaltyShootout).map(e => e.playerId))).map((pid: string) => {
              const p = allPlayers.find(pl => pl.id === pid);
              const goals = events.filter(e => e.type === 'goal' && e.goalType !== 'own_goal' && !e.isPenaltyShootout && e.playerId === pid).length;
              const team = p ? teams.find(t => t.id === p.teamId) : null;
              const teamShortName = team ? getTeamShortName(team) : '';
              return { pid, player: p, name: p?.name || 'Unknown', team, teamShortName, goals };
            }).filter(p => p.goals > 0 && p.name !== 'Unknown').sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name)).slice(0, 5).map((p, i) => (
              <div 
                key={p.pid} 
                onClick={() => p.player && onSelectPlayer?.(p.player)}
                className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-slate-100/50 dark:border-slate-800/80 hover:border-emerald-500/40 hover:bg-white dark:hover:bg-slate-950 transition-all cursor-pointer shadow-sm hover:shadow-md grow"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[10px] font-black text-slate-300 dark:text-slate-650">{i + 1}</span>
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-xs text-slate-800 dark:text-slate-200 hover:text-emerald-500 hover:underline truncate">{p.name}</span>
                    {p.teamShortName && (
                      <span 
                        onClick={(e) => {
                          if (p.team && onSelectTeam) {
                            e.stopPropagation();
                            onSelectTeam(p.team);
                          }
                        }}
                        className="text-[8px] font-extrabold uppercase text-slate-400 hover:text-emerald-600 hover:underline tracking-wider mt-0.5"
                      >
                        {p.teamShortName}
                      </span>
                    )}
                  </div>
                </div>
                <span className="bg-white dark:bg-slate-950 w-8 h-8 rounded-xl flex items-center justify-center shadow-sm font-black text-emerald-500 text-xs border border-slate-100 dark:border-slate-800 shrink-0">{p.goals}</span>
              </div>
            ))}
            {events.filter(e => e.type === 'goal' && e.goalType !== 'own_goal' && !e.isPenaltyShootout).length === 0 && (
              <p className="text-center py-10 text-slate-300 dark:text-slate-600 italic font-bold text-xs">No goals recorded yet</p>
            )}
          </div>
        </div>

        {/* Playmakers / Most Assists */}
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-blue-500 rounded-2xl flex items-center justify-center shadow-lg">
              <Footprints className="w-6 h-6 text-white" />
            </div>
            <h3 className="font-black uppercase italic text-slate-900 dark:text-white tracking-tight text-sm">Most Assists</h3>
          </div>
          <div className="space-y-4">
            {Array.from(new Set<string>(events.filter(e => e.type === 'goal' && e.assistantId && !e.isPenaltyShootout).map(e => e.assistantId!))).map((aid: string) => {
              const p = allPlayers.find(pl => pl.id === aid);
              const assists = events.filter(e => e.type === 'goal' && e.assistantId === aid && !e.isPenaltyShootout).length;
              const team = p ? teams.find(t => t.id === p.teamId) : null;
              const teamShortName = team ? getTeamShortName(team) : '';
              return { aid, player: p, name: p?.name || 'Unknown', team, teamShortName, assists };
            }).filter(p => p.assists > 0 && p.name !== 'Unknown').sort((a, b) => b.assists - a.assists || a.name.localeCompare(b.name)).slice(0, 5).map((p, i) => (
              <div 
                key={p.aid} 
                onClick={() => p.player && onSelectPlayer?.(p.player)}
                className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-slate-100/50 dark:border-slate-800/80 hover:border-blue-500/40 hover:bg-white dark:hover:bg-slate-950 transition-all cursor-pointer shadow-sm hover:shadow-md grow"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[10px] font-black text-slate-300 dark:text-slate-650">{i + 1}</span>
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-xs text-slate-800 dark:text-slate-200 hover:text-emerald-500 hover:underline truncate">{p.name}</span>
                    {p.teamShortName && (
                      <span 
                        onClick={(e) => {
                          if (p.team && onSelectTeam) {
                            e.stopPropagation();
                            onSelectTeam(p.team);
                          }
                        }}
                        className="text-[8px] font-extrabold uppercase text-slate-400 hover:text-emerald-600 hover:underline tracking-wider mt-0.5"
                      >
                        {p.teamShortName}
                      </span>
                    )}
                  </div>
                </div>
                <span className="bg-white dark:bg-slate-950 w-8 h-8 rounded-xl flex items-center justify-center shadow-sm font-black text-blue-500 text-xs border border-slate-100 dark:border-slate-800 shrink-0">{p.assists}</span>
              </div>
            ))}
            {events.filter(e => e.type === 'goal' && e.assistantId && !e.isPenaltyShootout).length === 0 && (
              <p className="text-center py-10 text-slate-300 dark:text-slate-600 italic font-bold text-xs">No assists recorded yet</p>
            )}
          </div>
        </div>

        {/* Most MVPs */}
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-amber-500 rounded-2xl flex items-center justify-center shadow-lg">
              <Star className="w-6 h-6 text-white fill-current" />
            </div>
            <h3 className="font-black uppercase italic text-slate-900 dark:text-white tracking-tight text-sm">Most MVPs</h3>
          </div>
          <div className="space-y-4">
            {Array.from(new Set<string>(matches.filter(m => m.manOfTheMatchId).map(m => m.manOfTheMatchId!))).map((pid: string) => {
              const p = allPlayers.find(pl => pl.id === pid);
              const awards = matches.filter(m => m.manOfTheMatchId === pid).length;
              const team = p ? teams.find(t => t.id === p.teamId) : null;
              const teamShortName = team ? getTeamShortName(team) : '';
              return { pid, player: p, name: p?.name || 'Unknown', team, teamShortName, awards };
            }).filter(p => p.awards > 0 && p.name !== 'Unknown').sort((a, b) => b.awards - a.awards || a.name.localeCompare(b.name)).slice(0, 5).map((p, i) => (
              <div 
                key={p.pid} 
                onClick={() => p.player && onSelectPlayer?.(p.player)}
                className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-slate-100/50 dark:border-slate-800/80 hover:border-amber-500/40 hover:bg-white dark:hover:bg-slate-950 transition-all cursor-pointer shadow-sm hover:shadow-md grow"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[10px] font-black text-slate-300 dark:text-slate-650">{i + 1}</span>
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-xs text-slate-800 dark:text-slate-200 hover:text-emerald-500 hover:underline truncate">{p.name}</span>
                    {p.teamShortName && (
                      <span 
                        onClick={(e) => {
                          if (p.team && onSelectTeam) {
                            e.stopPropagation();
                            onSelectTeam(p.team);
                          }
                        }}
                        className="text-[8px] font-extrabold uppercase text-slate-400 hover:text-emerald-600 hover:underline tracking-wider mt-0.5"
                      >
                        {p.teamShortName}
                      </span>
                    )}
                  </div>
                </div>
                <span className="bg-white dark:bg-slate-950 w-8 h-8 rounded-xl flex items-center justify-center shadow-sm font-black text-amber-500 text-xs border border-slate-100 dark:border-slate-800 shrink-0">{p.awards}</span>
              </div>
            ))}
            {matches.filter(m => m.manOfTheMatchId).length === 0 && (
              <p className="text-center py-10 text-slate-300 dark:text-slate-600 italic font-bold text-xs">No MVP awards presented yet</p>
            )}
          </div>
        </div>

        {/* Yellow Cards statistics panel */}
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-amber-50 dark:bg-amber-950/20 rounded-2xl flex items-center justify-center border border-amber-200/60 dark:border-amber-800/60 shadow-[0_2px_8px_rgba(251,191,36,0.15)] shrink-0">
              <div className="w-3 h-4 bg-amber-400 rounded-[1.5px] shadow-[0_1px_2px_rgba(0,0,0,0.15)] border border-amber-500/20 transform -rotate-12" />
            </div>
            <h3 className="font-black uppercase italic text-slate-900 dark:text-white tracking-tight text-sm">Yellow Cards</h3>
          </div>
          <div className="space-y-4">
            {Array.from(new Set<string>(events.filter(e => e.type === 'yellow_card').map(e => e.playerId))).map((pid: string) => {
              const p = allPlayers.find(pl => pl.id === pid);
              const count = events.filter(e => e.type === 'yellow_card' && e.playerId === pid).length;
              const team = p ? teams.find(t => t.id === p.teamId) : null;
              const teamShortName = team ? getTeamShortName(team) : '';
              return { pid, player: p, name: p?.name || 'Unknown', team, teamShortName, count };
            }).filter(p => p.count > 0 && p.name !== 'Unknown').sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 5).map((p, i) => (
              <div 
                key={p.pid} 
                onClick={() => p.player && onSelectPlayer?.(p.player)}
                className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-slate-100/50 dark:border-slate-800/80 hover:border-amber-400/40 hover:bg-white dark:hover:bg-slate-950 transition-all cursor-pointer shadow-sm hover:shadow-md grow"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[10px] font-black text-slate-300 dark:text-slate-650">{i + 1}</span>
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-xs text-slate-800 dark:text-slate-200 hover:text-emerald-500 hover:underline truncate">{p.name}</span>
                    {p.teamShortName && (
                      <span 
                        onClick={(e) => {
                          if (p.team && onSelectTeam) {
                            e.stopPropagation();
                            onSelectTeam(p.team);
                          }
                        }}
                        className="text-[8px] font-extrabold uppercase text-slate-400 hover:text-emerald-600 hover:underline tracking-wider mt-0.5"
                      >
                        {p.teamShortName}
                      </span>
                    )}
                  </div>
                </div>
                <span className="bg-white dark:bg-slate-950 w-8 h-8 rounded-xl flex items-center justify-center shadow-sm font-black text-amber-500 text-xs border border-slate-100 dark:border-slate-800 shrink-0">{p.count}</span>
              </div>
            ))}
            {events.filter(e => e.type === 'yellow_card').length === 0 && (
              <p className="text-center py-10 text-slate-300 dark:text-slate-600 italic font-bold text-xs">No warnings issued yet</p>
            )}
          </div>
        </div>

        {/* Red Cards statistics panel */}
        <div className="bg-white dark:bg-slate-900 p-8 rounded-[40px] border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-rose-50 dark:bg-rose-950/20 rounded-2xl flex items-center justify-center border border-rose-200/60 dark:border-rose-850 shadow-[0_2px_8px_rgba(244,63,94,0.15)] shrink-0">
              <div className="w-3 h-4 bg-rose-500 rounded-[1.5px] shadow-[0_1px_2px_rgba(0,0,0,0.15)] border border-rose-600/20 transform -rotate-12" />
            </div>
            <h3 className="font-black uppercase italic text-slate-900 dark:text-white tracking-tight text-sm">Red Cards</h3>
          </div>
          <div className="space-y-4">
            {Array.from(new Set<string>([
              ...events.filter(e => e.type === 'red_card').map(e => e.playerId),
              ...events.filter(e => e.type === 'yellow_card').map(e => e.playerId)
            ])).map((pid: string) => {
              const p = allPlayers.find(pl => pl.id === pid);
              const directReds = events.filter(e => e.type === 'red_card' && e.playerId === pid).length;
              const yellowCardEventsByMatch = events.filter(e => e.type === 'yellow_card' && e.playerId === pid);
              const yellowsByMatch: Record<string, number> = {};
              yellowCardEventsByMatch.forEach(e => {
                yellowsByMatch[e.matchId] = (yellowsByMatch[e.matchId] || 0) + 1;
              });
              const indirectReds = Object.values(yellowsByMatch).filter(cnt => cnt >= 2).length;
              const count = directReds + indirectReds;

              const team = p ? teams.find(t => t.id === p.teamId) : null;
              const teamShortName = team ? getTeamShortName(team) : '';
              return { pid, player: p, name: p?.name || 'Unknown', team, teamShortName, count };
            }).filter(p => p.count > 0 && p.name !== 'Unknown').sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 5).map((p, i) => (
              <div 
                key={p.pid} 
                onClick={() => p.player && onSelectPlayer?.(p.player)}
                className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-slate-100/50 dark:border-slate-800/80 hover:border-rose-500/40 hover:bg-white dark:hover:bg-slate-950 transition-all cursor-pointer shadow-sm hover:shadow-md grow"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[10px] font-black text-slate-300 dark:text-slate-650">{i + 1}</span>
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-xs text-slate-800 dark:text-slate-200 hover:text-emerald-500 hover:underline truncate">{p.name}</span>
                    {p.teamShortName && (
                      <span 
                        onClick={(e) => {
                          if (p.team && onSelectTeam) {
                            e.stopPropagation();
                            onSelectTeam(p.team);
                          }
                        }}
                        className="text-[8px] font-extrabold uppercase text-slate-400 hover:text-emerald-600 hover:underline tracking-wider mt-0.5"
                      >
                        {p.teamShortName}
                      </span>
                    )}
                  </div>
                </div>
                <span className="bg-white dark:bg-slate-950 w-8 h-8 rounded-xl flex items-center justify-center shadow-sm font-black text-rose-500 text-xs border border-slate-100 dark:border-slate-800 shrink-0">{p.count}</span>
              </div>
            ))}
            {events.filter(e => e.type === 'red_card').length === 0 &&
              !events.some(e => e.type === 'yellow_card') && (
                <p className="text-center py-10 text-slate-300 dark:text-slate-600 italic font-bold text-xs">Pristine discipline — no red cards</p>
              )}
          </div>
        </div>

      </div>
    </motion.div>
  );
};
