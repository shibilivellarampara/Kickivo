import React from 'react';
import { motion } from 'motion/react';
import { X, Users } from 'lucide-react';
import { Match, Team, Player } from '../../types';
import { sortPlayersByPosition } from '../../utils/football';

interface PenaltyShootoutModalProps {
  isPenaltyShootoutMode: boolean;
  setIsPenaltyShootoutMode: (show: boolean) => void;
  teamA?: Team;
  teamB?: Team;
  liveMatch: Match;
  playersA: Player[];
  playersB: Player[];
  penaltyTakerIds: Set<string>;
  isOnPitch: (playerId: string, teamId: string) => boolean;
  addPenaltyKick: (playerId: string, teamId: string, result: 'goal' | 'miss') => Promise<void>;
}

export const PenaltyShootoutModal: React.FC<PenaltyShootoutModalProps> = ({
  isPenaltyShootoutMode,
  setIsPenaltyShootoutMode,
  teamA,
  teamB,
  liveMatch,
  playersA,
  playersB,
  penaltyTakerIds,
  isOnPitch,
  addPenaltyKick,
}) => {
  if (!isPenaltyShootoutMode) return null;

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => setIsPenaltyShootoutMode(false)}
        className="absolute inset-0 bg-slate-900/90 backdrop-blur-md"
      />
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="relative bg-white w-full max-w-xl rounded-[40px] p-8 md:p-12 shadow-2xl overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1.5 bg-amber-500" />
        <button
          type="button"
          onClick={() => setIsPenaltyShootoutMode(false)}
          className="absolute right-8 top-8 p-2 text-slate-300 hover:text-slate-600 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="text-center mb-10">
          <h3 className="text-2xl font-black italic uppercase tracking-tighter text-slate-900">Penalty Shootout</h3>
          <div className="flex items-center justify-center gap-4 mt-2">
            <div className="h-px w-8 bg-slate-100" />
            <span className="text-[10px] font-bold text-amber-500 uppercase tracking-[0.3em]">Tiebreaker Active</span>
            <div className="h-px w-8 bg-slate-100" />
          </div>
        </div>

        <div className="flex items-center justify-center gap-12 mb-12 py-6 bg-slate-50 rounded-3xl border border-slate-100">
          <div className="flex flex-col items-center gap-2">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{teamA?.name}</p>
            <span className="text-4xl font-black text-slate-900 tracking-tighter">{liveMatch.pensA || 0}</span>
          </div>
          <div className="text-xl font-black text-slate-200">VS</div>
          <div className="flex flex-col items-center gap-2">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{teamB?.name}</p>
            <span className="text-4xl font-black text-slate-900 tracking-tighter">{liveMatch.pensB || 0}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-10">
          {['A', 'B'].map(side => {
            const sideTeam = side === 'A' ? teamA : teamB;
            const sidePlayers = side === 'A' ? playersA : playersB;
            const selectId = `taker-${side.toLowerCase()}`;
            return (
              <div key={side} className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center border border-slate-200">
                    {sideTeam?.logoURL ? (
                      <img src={sideTeam.logoURL} className="w-5 h-5 object-contain" alt="" />
                    ) : (
                      <Users className="w-4 h-4 text-slate-300" />
                    )}
                  </div>
                  <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest truncate">{sideTeam?.name}</p>
                </div>
                <div className="space-y-3">
                  <select
                    id={selectId}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-xs font-bold focus:ring-2 focus:ring-emerald-500 transition-all outline-none text-slate-800"
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Select Taker
                    </option>
                    {sortPlayersByPosition(sidePlayers)
                      .filter(p => isOnPitch(p.id, sideTeam!.id) && !penaltyTakerIds.has(p.id))
                      .map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} (#{p.number})
                        </option>
                      ))}
                  </select>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const el = document.getElementById(selectId) as HTMLSelectElement;
                        if (el.value) addPenaltyKick(el.value, sideTeam!.id, 'goal');
                        el.value = '';
                      }}
                      className="flex-1 bg-emerald-500 text-white py-4 rounded-2xl text-[10px] font-black uppercase shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                    >
                      Goal
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const el = document.getElementById(selectId) as HTMLSelectElement;
                        if (el.value) addPenaltyKick(el.value, sideTeam!.id, 'miss');
                        el.value = '';
                      }}
                      className="flex-1 bg-red-500 text-white py-4 rounded-2xl text-[10px] font-black uppercase shadow-lg shadow-red-500/20 active:scale-95 transition-all"
                    >
                      Miss
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setIsPenaltyShootoutMode(false)}
          className="w-full mt-12 py-5 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:bg-slate-800 transition-all"
        >
          Exit Result Panel
        </button>
      </motion.div>
    </div>
  );
};
