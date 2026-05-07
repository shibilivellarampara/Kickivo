import React from 'react';
import { Match, Team } from '../../types';
import { formatTeamName, getTeamShortName } from '../../utils/football';
import { TeamSlot } from './TeamSlot';

interface BracketMatchProps {
  match: Match;
  teams: Team[];
  position: 'left' | 'right' | 'center';
  onSelect: (m: Match) => void;
  compact?: boolean;
}

export const BracketMatch: React.FC<BracketMatchProps> = ({ match, teams, position, onSelect, compact = false }) => {
  const teamA = teams.find(t => t.id === match.teamAId);
  const teamB = teams.find(t => t.id === match.teamBId);
  const isFinished = match.status === 'finished';
  const isAWinner = isFinished && (match.scoreA > match.scoreB || (match.scoreA === match.scoreB && (match.pensA || 0) > (match.pensB || 0)));
  const isBWinner = isFinished && (match.scoreB > match.scoreA || (match.scoreA === match.scoreB && (match.pensB || 0) > (match.pensA || 0)));

  const displayAName = teamA ? formatTeamName(teamA.name) : (match.placeholderA || 'TBD');
  const displayAShort = getTeamShortName(teamA, match.placeholderA);
  const displayBName = teamB ? formatTeamName(teamB.name) : (match.placeholderB || 'TBD');
  const displayBShort = getTeamShortName(teamB, match.placeholderB);

  const textAlignClass = position === 'left' ? 'text-right' : position === 'right' ? 'text-left' : 'text-center';
  const flexDirectionClass = position === 'left' ? 'flex-row-reverse' : 'flex-row';

  return (
    <div className="relative group">
      {match.leg && (
        <div className={`absolute -top-3 ${position === 'left' ? 'right-4 text-right' : 'left-4 text-left'} bg-slate-50 text-[8px] font-black uppercase tracking-widest text-slate-400 px-2 py-0.5 rounded-full border border-slate-100 z-10 shadow-sm transition-all group-hover:bg-emerald-50 group-hover:text-emerald-500`}>
          Leg {match.leg}
        </div>
      )}
      <div 
        onClick={() => onSelect(match)}
        className={`${compact ? 'w-full' : 'w-64'} bg-white border border-slate-200 rounded-3xl p-5 cursor-pointer hover:border-emerald-500/50 transition-all shadow-sm hover:shadow-md ${textAlignClass}`}
      >
        <div className="space-y-3">
          <div className={`flex items-center gap-3 ${flexDirectionClass}`}>
            <TeamSlot id={match.teamAId} teams={teams} small />
            <div className={`flex-1 min-w-0 ${textAlignClass}`}>
              <div className={`text-xs font-black uppercase tracking-tighter truncate ${isAWinner ? 'text-emerald-500' : 'text-slate-900'}`}>
                {displayAName}
              </div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{displayAShort}</div>
            </div>
            <div className="flex flex-col items-center">
              <span className={`text-xl font-black tabular-nums ${isAWinner ? 'text-emerald-500' : 'text-slate-300'}`}>
                {match.status === 'scheduled' ? '-' : match.scoreA}
              </span>
              {match.pensA !== undefined && (
                <span className="text-[8px] font-black text-amber-500 mt-[-4px]">({match.pensA})</span>
              )}
            </div>
          </div>
          <div className={`flex items-center gap-3 ${flexDirectionClass}`}>
            <TeamSlot id={match.teamBId} teams={teams} small />
            <div className={`flex-1 min-w-0 ${textAlignClass}`}>
              <div className={`text-xs font-black uppercase tracking-tighter truncate ${isBWinner ? 'text-emerald-500' : 'text-slate-900'}`}>
                {displayBName}
              </div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{displayBShort}</div>
            </div>
            <div className="flex flex-col items-center">
              <span className={`text-xl font-black tabular-nums ${isBWinner ? 'text-emerald-500' : 'text-slate-300'}`}>
                {match.status === 'scheduled' ? '-' : match.scoreB}
              </span>
              {match.pensB !== undefined && (
                <span className="text-[8px] font-black text-amber-500 mt-[-4px]">({match.pensB})</span>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Curved Connectors */}
      {position !== 'center' && (
        <div className={`hidden md:block absolute top-1/2 ${position === 'left' ? '-right-12' : '-left-12'} w-12 h-px bg-slate-200 -z-0`} />
      )}
    </div>
  );
};
