import React from 'react';
import { Team } from '../../types';
import { getTeamShortName } from '../../utils/football';

interface TeamSlotProps {
  id?: string;
  teams: Team[];
  small?: boolean;
  onSelectTeam?: (team: Team) => void;
}

export const TeamSlot: React.FC<TeamSlotProps> = ({ id, teams, small = false, onSelectTeam }) => {
  const team = teams.find(t => t.id === id);
  
  const handleClick = (e: React.MouseEvent) => {
    if (team && onSelectTeam) {
      e.stopPropagation();
      onSelectTeam(team);
    }
  };

  if (small) {
    return (
      <div 
        onClick={handleClick}
        className={`w-8 h-8 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0 ${team && onSelectTeam ? 'cursor-pointer hover:border-emerald-500 hover:scale-105 transition-all' : ''}`}
      >
        {team?.logoURL ? (
          <img src={team.logoURL} className="w-full h-full object-cover" alt="" />
        ) : (
          <div className="text-[10px] font-black text-slate-300 italic uppercase">{team?.name?.charAt(0) || '?'}</div>
        )}
      </div>
    );
  }
  return (
    <div 
      onClick={handleClick}
      className={`flex flex-col items-center gap-2 ${team && onSelectTeam ? 'cursor-pointer group/slot' : ''}`}
    >
      <div className={`w-14 h-14 md:w-16 md:h-16 rounded-[20px] bg-slate-50 border-2 border-slate-200 flex items-center justify-center p-2 shadow-sm overflow-hidden transition-all ${team && onSelectTeam ? 'group-hover/slot:border-emerald-500 group-hover/slot:scale-105' : ''}`}>
        {team?.logoURL ? (
          <img src={team.logoURL} className="w-full h-full object-contain" alt="" />
        ) : (
          <div className="text-xl font-black text-slate-300 uppercase">{team?.name?.charAt(0) || '?'}</div>
        )}
      </div>
      <div className={`text-[10px] font-black text-slate-400 uppercase tracking-widest transition-colors ${team && onSelectTeam ? 'group-hover/slot:text-emerald-500 group-hover/slot:underline' : ''}`}>{getTeamShortName(team)}</div>
    </div>
  );
};
