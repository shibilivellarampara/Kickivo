import React from 'react';
import { motion } from 'motion/react';
import { Tournament, Match, Team } from '../../types';
import { renderTeamLogo } from '../../utils/avatarUtils';

interface PointTableModuleProps {
  tournament: Tournament;
  teams: Team[];
  matches: Match[];
  onSelectTeam: (team: Team) => void;
}

export const PointTableModule: React.FC<PointTableModuleProps> = ({
  tournament,
  teams,
  matches,
  onSelectTeam,
}) => {
  
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
      return { 
        ...t, 
        played: ms.length, 
        won: w, 
        drawn: d, 
        lost: l, 
        gf, 
        ga, 
        gd: gf - ga, 
        points: (w * 3) + d 
      };
    }).sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf);
  };

  const groups = tournament.type === 'league_playoff' 
    ? Array.from({ length: tournament.numberOfGroups || 0 }).map((_, i) => `Group ${String.fromCharCode(65 + i)}`) 
    : [undefined];

  const advancingCount = tournament.advancingPerGroup ?? (tournament.type === 'league_playoff' ? 2 : 0);
  const isTop6Mode = advancingCount === 6;
  const isQualifierMode = tournament.advancementType === 'qualifier' && advancingCount === 3;
  const isEfootball = tournament.category === 'efootball' || tournament.isEfootball;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-8 animate-fade-in">
      {groups.map(g => {
        const standingsList = getStandingsForGroup(g);
        const hasGroupLiveMatch = matches.some(m => 
          m.status === 'live' && 
          m.group !== 'Playoffs' && 
          (g ? (m.group === g || (m.teamAId && teams.find(team => team.id === m.teamAId)?.group === g)) : true)
        );
        
        return (
          <div key={g || 'All'} className="space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              {g && <h3 className="text-xl font-black italic text-slate-800 dark:text-slate-100">{g}</h3>}
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 overflow-x-auto shadow-sm">
              <table className="min-w-[500px] md:min-w-full text-left">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950/40 border-b border-slate-100 dark:border-slate-800">
                    <th className="px-5 py-3.5 text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider w-16">#</th>
                    <th className="px-5 py-3.5 text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">Team</th>
                    <th className="px-4 py-3.5 text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider text-center w-16">MP</th>
                    <th className="px-4 py-3.5 text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider text-center w-20">PTS</th>
                    <th className="px-3 py-3.5 text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider text-center w-16">GF</th>
                    <th className="px-3 py-3.5 text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider text-center w-16">GA</th>
                    <th className="px-4 py-3.5 text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider text-center w-20">GD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {standingsList.map((t, idx) => {
                    const isQualifying = advancingCount > 0 && idx < advancingCount;

                    let sideBarColor = '';
                    let dotColor = '';
                    let rankTextColor = '';
                    let rowBg = '';
                    let qualifyTag = '';

                    if (isQualifying) {
                      if (isTop6Mode) {
                        if (idx < 2) {
                          sideBarColor = 'bg-blue-500';
                          dotColor = 'bg-blue-500';
                          rankTextColor = 'text-blue-600 dark:text-blue-400 font-black';
                          rowBg = 'bg-blue-50/20 dark:bg-blue-950/15 hover:bg-blue-50/40 dark:hover:bg-blue-950/30';
                          qualifyTag = 'Direct Semi';
                        } else {
                          sideBarColor = 'bg-emerald-500';
                          dotColor = 'bg-emerald-500';
                          rankTextColor = 'text-emerald-600 dark:text-emerald-400 font-black';
                          rowBg = 'bg-emerald-50/20 dark:bg-emerald-950/15 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/30';
                          qualifyTag = 'Playoff';
                        }
                      } else if (isQualifierMode) {
                        if (idx === 0) {
                          sideBarColor = 'bg-emerald-500';
                          dotColor = 'bg-emerald-500';
                          rankTextColor = 'text-emerald-600 dark:text-emerald-400 font-black';
                          rowBg = 'bg-emerald-50/20 dark:bg-emerald-950/15 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/30';
                          qualifyTag = 'Final';
                        } else {
                          sideBarColor = 'bg-amber-500';
                          dotColor = 'bg-amber-500';
                          rankTextColor = 'text-amber-600 dark:text-amber-400 font-black';
                          rowBg = 'bg-amber-50/20 dark:bg-amber-950/15 hover:bg-amber-50/40 dark:hover:bg-amber-950/30';
                          qualifyTag = 'Qualifier';
                        }
                      } else {
                        sideBarColor = isEfootball ? 'bg-indigo-500' : 'bg-emerald-500';
                        dotColor = isEfootball ? 'bg-indigo-500' : 'bg-emerald-500';
                        rankTextColor = isEfootball 
                          ? 'text-indigo-600 dark:text-indigo-400 font-black' 
                          : 'text-emerald-600 dark:text-emerald-400 font-black';
                        rowBg = isEfootball 
                          ? 'bg-indigo-50/20 dark:bg-indigo-950/15 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/30' 
                          : 'bg-emerald-50/20 dark:bg-emerald-950/15 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/30';
                        qualifyTag = advancingCount === 2 ? 'Final' : advancingCount === 4 ? 'Semi-final' : 'Playoffs';
                      }
                    }

                    const liveMatchForTeam = matches.find(m => 
                      m.status === 'live' && 
                      m.group !== 'Playoffs' && 
                      (m.teamAId === t.id || m.teamBId === t.id)
                    );
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
                      <tr 
                        key={t.id} 
                        className={`transition-colors cursor-pointer group relative ${
                          isQualifying ? rowBg : 'hover:bg-slate-50 dark:hover:bg-slate-950/40'
                        }`} 
                        onClick={() => onSelectTeam(t)}
                      >
                        <td className="relative px-5 py-3.5 font-bold text-xs">
                          {/* Sleek left vertical indicator bar with reduced width */}
                          {isQualifying && (
                            <div 
                              className={`absolute left-0 top-0 bottom-0 w-[3px] ${sideBarColor} rounded-r-full shadow-sm`} 
                              title={`Position ${idx + 1}: ${idx < 2 && isTop6Mode ? 'Direct Semis' : 'Playoffs'}`}
                            />
                          )}
                          <span className={isQualifying ? rankTextColor : 'text-slate-400 dark:text-slate-500'}>
                            {idx + 1}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 font-semibold flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            {renderTeamLogo(t.logoURL, t.name, "w-8 h-8")}
                            <span className="text-sm group-hover:text-emerald-600 transition-colors truncate text-slate-800 dark:text-slate-200">
                              {t.name}
                            </span>
                          </div>
                          {liveStatus && (
                            <div 
                              className="flex items-center justify-center shrink-0 w-4 h-4 select-none"
                              title={`Live match vs ${oppName} (${liveMatchForTeam?.scoreA} - ${liveMatchForTeam?.scoreB})`}
                            >
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
                        <td className="px-4 py-3.5 text-center font-semibold text-slate-400 dark:text-slate-500 text-sm">{t.played}</td>
                        <td className="px-4 py-3.5 text-center">
                          <span className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-lg font-bold text-xs tracking-tight">
                            {t.points}
                          </span>
                        </td>
                        <td className="px-3 py-3.5 text-center font-medium text-slate-400 dark:text-slate-500 text-xs">{t.gf}</td>
                        <td className="px-3 py-3.5 text-center font-medium text-slate-400 dark:text-slate-500 text-xs">{t.ga}</td>
                        <td className="px-4 py-3.5 text-center font-semibold text-emerald-500 text-sm">
                          {t.gd > 0 ? `+${t.gd}` : t.gd}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Standings Legend & Key */}
            <div className="mt-4 px-4 py-3.5 bg-slate-50/70 dark:bg-slate-900/70 rounded-2xl border border-slate-100/80 dark:border-slate-800/80 max-w-sm select-none text-[9px] uppercase tracking-wider shadow-sm">
              <div className="flex flex-col gap-2 text-slate-500 dark:text-slate-400 font-bold">
                {/* Qualification Rules */}
                {advancingCount > 0 && (
                  <div className="pb-2.5 border-b border-slate-200/60 dark:border-slate-800/80 space-y-1.5">
                    <div className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                      Playoff Qualification
                    </div>
                    {isTop6Mode ? (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-[3px] bg-emerald-500 shrink-0 shadow-sm" />
                          <span className="font-black text-slate-800 dark:text-slate-200">1st & 2nd:</span>
                          <span className="text-slate-600 dark:text-slate-400 font-semibold">Direct to Semi-finals</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-[3px] bg-blue-500 shrink-0 shadow-sm" />
                          <span className="font-black text-slate-800 dark:text-slate-200">3rd–6th:</span>
                          <span className="text-slate-600 dark:text-slate-400 font-semibold">Playoffs (3v6, 4v5 → Semis)</span>
                        </div>
                      </>
                    ) : isQualifierMode ? (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-[3px] bg-emerald-500 shrink-0 shadow-sm" />
                          <span className="font-black text-slate-800 dark:text-slate-200">1st:</span>
                          <span className="text-slate-600 dark:text-slate-400 font-semibold">Direct to Grand Final</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-[3px] bg-amber-500 shrink-0 shadow-sm" />
                          <span className="font-black text-slate-800 dark:text-slate-200">2nd & 3rd:</span>
                          <span className="text-slate-600 dark:text-slate-400 font-semibold">Qualifier for Final spot</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-[3px] ${isEfootball ? 'bg-indigo-500' : 'bg-emerald-500'} shrink-0 shadow-sm`} />
                        <span className="font-black text-slate-800 dark:text-slate-200">Top {advancingCount}:</span>
                        <span className="text-slate-600 dark:text-slate-400 font-semibold">
                          Qualify for {advancingCount === 2 ? 'Grand Final' : advancingCount === 4 ? 'Semi-finals' : 'Playoffs'}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {hasGroupLiveMatch && (
                  <>
                    <div className="flex items-center gap-1.5">
                      <div className="w-6 shrink-0 flex items-center justify-start pl-0.5">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                        </span>
                      </div>
                      <span className="text-slate-300 dark:text-slate-700 font-normal">:</span>
                      <span>Winning (Live Match)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-6 shrink-0 flex items-center justify-start pl-0.5">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500" />
                        </span>
                      </div>
                      <span className="text-slate-300 dark:text-slate-700 font-normal">:</span>
                      <span>Losing (Live Match)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-6 shrink-0 flex items-center justify-start pl-0.5">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-slate-500" />
                        </span>
                      </div>
                      <span className="text-slate-300 dark:text-slate-700 font-normal">:</span>
                      <span>Drawing (Live Match)</span>
                    </div>
                  </>
                )}
                
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 dark:text-slate-500 font-semibold w-6 shrink-0">MP</span>
                  <span className="text-slate-300 dark:text-slate-700 font-normal">:</span>
                  <span>Matches Played</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 dark:text-slate-500 font-semibold w-6 shrink-0">PTS</span>
                  <span className="text-slate-300 dark:text-slate-700 font-normal">:</span>
                  <span>Points</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 dark:text-slate-500 font-semibold w-6 shrink-0">GF</span>
                  <span className="text-slate-300 dark:text-slate-700 font-normal">:</span>
                  <span>Goals For</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 dark:text-slate-500 font-semibold w-6 shrink-0">GA</span>
                  <span className="text-slate-300 dark:text-slate-700 font-normal">:</span>
                  <span>Goals Against</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400 dark:text-slate-500 font-semibold w-6 shrink-0">GD</span>
                  <span className="text-slate-300 dark:text-slate-700 font-normal">:</span>
                  <span>Goal Difference</span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </motion.div>
  );
};
