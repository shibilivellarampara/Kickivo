import React from 'react';
import { Team } from '../../types';
import { getTeamShortName } from '../../utils/football';

interface TeamSlotProps {
  id?: string;
  teams: Team[];
  small?: boolean;
}

export const TeamSlot: React.FC<TeamSlotProps> = ({ id, teams, small = false }) => {
  const team = teams.find(t => t.id === id);
  if (small) {
    return (
      <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
        {team?.logoURL ? (
          <img src={team.logoURL} className="w-full h-full object-cover" alt="" />
        ) : (
          <div className="text-[10px] font-black text-slate-300 italic uppercase">{team?.name?.charAt(0)}</div>
        )}
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="w-14 h-14 md:w-16 md:h-16 rounded-[20px] bg-slate-50 border-2 border-slate-200 flex items-center justify-center p-2 shadow-sm overflow-hidden">
        {team?.logoURL ? (
          <img src={team.logoURL} className="w-full h-full object-contain" alt="" />
        ) : (
          <div className="text-xl font-black text-slate-300 uppercase">{team?.name?.charAt(0)}</div>
        )}
      </div>
      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{getTeamShortName(team)}</div>
    </div>
  );
};
