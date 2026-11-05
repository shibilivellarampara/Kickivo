import React from 'react';
import { motion } from 'motion/react';
import { Shield, ArrowRight, CheckCircle2, Zap } from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Tournament, Match, Team, Player } from '../../types';
import { sortPlayersByPosition } from '../../utils/football';

interface LineupSetupWizardProps {
  showLineupConfirm: boolean;
  setShowLineupConfirm: (show: boolean) => void;
  tournament: Tournament;
  match: Match;
  teamA?: Team;
  teamB?: Team;
  playersA: Player[];
  playersB: Player[];
  tempLineupA: string[];
  setTempLineupA: React.Dispatch<React.SetStateAction<string[]>>;
  tempSubsA: string[];
  setTempSubsA: React.Dispatch<React.SetStateAction<string[]>>;
  tempLineupB: string[];
  setTempLineupB: React.Dispatch<React.SetStateAction<string[]>>;
  tempSubsB: string[];
  setTempSubsB: React.Dispatch<React.SetStateAction<string[]>>;
  setupStep: 'teamA' | 'teamB' | 'confirm';
  setSetupStep: React.Dispatch<React.SetStateAction<'teamA' | 'teamB' | 'confirm'>>;
  notify: (msg: string) => void;
}

export const LineupSetupWizard: React.FC<LineupSetupWizardProps> = ({
  showLineupConfirm,
  setShowLineupConfirm,
  tournament,
  match,
  teamA,
  teamB,
  playersA,
  playersB,
  tempLineupA,
  setTempLineupA,
  tempSubsA,
  setTempSubsA,
  tempLineupB,
  setTempLineupB,
  tempSubsB,
  setTempSubsB,
  setupStep,
  setSetupStep,
  notify,
}) => {
  if (!showLineupConfirm) return null;

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={() => setShowLineupConfirm(false)}
        className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"
      />
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="relative bg-white w-full max-w-lg rounded-[32px] p-8 shadow-2xl flex flex-col max-h-[85vh]"
      >
        {/* Multi-step Header */}
        <div className="text-center mb-6 shrink-0">
          <h3 className="text-xl font-black tracking-tight italic uppercase text-slate-900">Pre-Match Team Sheets</h3>
          <p className="text-slate-400 text-[10px] font-bold mt-1 uppercase tracking-widest">Construct squads before kick-off</p>
        </div>

        {/* Step Navigator */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-6 select-none shrink-0 border border-slate-200/50">
          <button
            type="button"
            onClick={() => setSetupStep('teamA')}
            className={`flex-1 py-2 text-[9px] uppercase tracking-widest font-black rounded-lg transition-all ${
              setupStep === 'teamA' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            {teamA?.shortName || 'Home'} ({tempLineupA.length})
          </button>
          <button
            type="button"
            onClick={() => setSetupStep('teamB')}
            className={`flex-1 py-2 text-[9px] uppercase tracking-widest font-black rounded-lg transition-all ${
              setupStep === 'teamB' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            {teamB?.shortName || 'Away'} ({tempLineupB.length})
          </button>
          <button
            type="button"
            onClick={() => setSetupStep('confirm')}
            className={`flex-1 py-2 text-[9px] uppercase tracking-widest font-black rounded-lg transition-all ${
              setupStep === 'confirm' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Kick-Off Check
          </button>
        </div>

        {/* Setup Screen Switcher */}
        <div className="flex-1 overflow-y-auto pr-1 mb-6 no-scrollbar">
          {setupStep === 'teamA' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-[10px] uppercase font-black text-rose-500 tracking-wider flex items-center gap-1">
                  <Shield className="w-3 h-3" /> {teamA?.name} Setup
                </span>
                <span className="text-[10px] font-medium text-slate-400 uppercase">
                  {playersA.length} Players Registered
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-emerald-50/50 border border-emerald-100/50 p-3 rounded-xl text-center">
                  <p className="text-[9px] font-black text-emerald-600 uppercase tracking-wider">Starters</p>
                  <p className="text-lg font-black text-emerald-700">{tempLineupA.length}</p>
                </div>
                <div className="bg-amber-50/50 border border-amber-100/50 p-3 rounded-xl text-center">
                  <p className="text-[9px] font-black text-amber-600 uppercase tracking-wider">Bench / Substitutes</p>
                  <p className="text-lg font-black text-amber-700">{tempSubsA.length}</p>
                </div>
              </div>

              {playersA.length === 0 && (
                <div className="text-center py-12 text-slate-400 text-xs font-medium">
                  No registered players on this team. Please add squad members first.
                </div>
              )}

              <div className="space-y-2">
                {sortPlayersByPosition(playersA).map(p => (
                  <div key={p.id} className="bg-slate-50 border border-slate-100/50 rounded-2xl p-3 flex items-center justify-between hover:bg-slate-100/50 transition-all">
                    <div className="flex items-center gap-3 truncate mr-2">
                      <div className="w-7 h-7 rounded-lg bg-white border border-slate-200/60 shadow-sm flex items-center justify-center text-xs font-black text-slate-800">
                        #{p.number || '—'}
                      </div>
                      <div className="truncate">
                        <p className="text-xs font-bold text-slate-950 truncate">{p.name}</p>
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{p.position || 'Defender'}</span>
                      </div>
                    </div>

                    <div className="shrink-0 flex bg-slate-200/80 p-0.5 rounded-lg text-[9px] font-black">
                      <button
                        type="button"
                        onClick={() => {
                          setTempLineupA(prev => [...prev.filter(id => id !== p.id), p.id]);
                          setTempSubsA(prev => prev.filter(id => id !== p.id));
                        }}
                        className={`px-3 py-1.5 rounded-md uppercase tracking-wider transition-all ${
                          tempLineupA.includes(p.id)
                            ? 'bg-emerald-500 text-white shadow-sm'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Starter
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTempSubsA(prev => [...prev.filter(id => id !== p.id), p.id]);
                          setTempLineupA(prev => prev.filter(id => id !== p.id));
                        }}
                        className={`px-3 py-1.5 rounded-md uppercase tracking-wider transition-all ${
                          tempSubsA.includes(p.id)
                            ? 'bg-amber-500 text-white shadow-sm'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Bench
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {setupStep === 'teamB' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-[10px] uppercase font-black text-emerald-500 tracking-wider flex items-center gap-1">
                  <Shield className="w-3 h-3" /> {teamB?.name} Setup
                </span>
                <span className="text-[10px] font-medium text-slate-400 uppercase">
                  {playersB.length} Players Registered
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-emerald-50/50 border border-emerald-100/50 p-3 rounded-xl text-center">
                  <p className="text-[9px] font-black text-emerald-600 uppercase tracking-wider">Starters</p>
                  <p className="text-lg font-black text-emerald-700">{tempLineupB.length}</p>
                </div>
                <div className="bg-amber-50/50 border border-amber-100/50 p-3 rounded-xl text-center">
                  <p className="text-[9px] font-black text-amber-600 uppercase tracking-wider">Bench / Substitutes</p>
                  <p className="text-lg font-black text-amber-700">{tempSubsB.length}</p>
                </div>
              </div>

              {playersB.length === 0 && (
                <div className="text-center py-12 text-slate-400 text-xs font-medium">
                  No registered players on this team. Please add squad members first.
                </div>
              )}

              <div className="space-y-2">
                {sortPlayersByPosition(playersB).map(p => (
                  <div key={p.id} className="bg-slate-50 border border-slate-100/50 rounded-2xl p-3 flex items-center justify-between hover:bg-slate-100/50 transition-all">
                    <div className="flex items-center gap-3 truncate mr-2">
                      <div className="w-7 h-7 rounded-lg bg-white border border-slate-200/60 shadow-sm flex items-center justify-center text-xs font-black text-slate-800">
                        #{p.number || '—'}
                      </div>
                      <div className="truncate">
                        <p className="text-xs font-bold text-slate-950 truncate">{p.name}</p>
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{p.position || 'Defender'}</span>
                      </div>
                    </div>

                    <div className="shrink-0 flex bg-slate-200/80 p-0.5 rounded-lg text-[9px] font-black">
                      <button
                        type="button"
                        onClick={() => {
                          setTempLineupB(prev => [...prev.filter(id => id !== p.id), p.id]);
                          setTempSubsB(prev => prev.filter(id => id !== p.id));
                        }}
                        className={`px-3 py-1.5 rounded-md uppercase tracking-wider transition-all ${
                          tempLineupB.includes(p.id)
                            ? 'bg-emerald-500 text-white shadow-sm'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Starter
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTempSubsB(prev => [...prev.filter(id => id !== p.id), p.id]);
                          setTempLineupB(prev => prev.filter(id => id !== p.id));
                        }}
                        className={`px-3 py-1.5 rounded-md uppercase tracking-wider transition-all ${
                          tempSubsB.includes(p.id)
                            ? 'bg-amber-500 text-white shadow-sm'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Bench
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {setupStep === 'confirm' && (
            <div className="space-y-6">
              <p className="text-center font-semibold text-slate-600 text-xs">Verify both team selections are logged successfully:</p>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1 truncate">{teamA?.shortName}</p>
                  <p className="text-base font-black text-slate-900">{tempLineupA.length} Starters</p>
                  <p className="text-[10px] font-medium text-slate-400 uppercase mt-0.5">{tempSubsA.length} Bench Subs</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1 truncate">{teamB?.shortName}</p>
                  <p className="text-base font-black text-slate-900">{tempLineupB.length} Starters</p>
                  <p className="text-[10px] font-medium text-slate-400 uppercase mt-0.5">{tempSubsB.length} Bench Subs</p>
                </div>
              </div>

              <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                <p className="text-[11px] font-semibold text-emerald-800">
                  {tempLineupA.length === 11 && tempLineupB.length === 11
                    ? "Perfect! Both squads are ready with exactly 11 starting players."
                    : "Squads ready. Proceeding with custom player configurations."}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Controllers */}
        <div className="border-t border-slate-100 pt-5 flex items-center justify-between shrink-0">
          {setupStep === 'teamA' && (
            <>
              <button
                type="button"
                onClick={() => setShowLineupConfirm(false)}
                className="py-4 text-xs font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setSetupStep('teamB')}
                className="bg-slate-900 text-white font-black py-4 px-6 rounded-2xl shadow-xl shadow-slate-900/10 hover:bg-slate-800 active:scale-95 transition-all text-[10px] uppercase tracking-widest flex items-center gap-2"
              >
                Next: {teamB?.shortName || 'Away'} Lineup <ArrowRight className="w-3 h-3" />
              </button>
            </>
          )}

          {setupStep === 'teamB' && (
            <>
              <button
                type="button"
                onClick={() => setSetupStep('teamA')}
                className="py-4 text-xs font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setSetupStep('confirm')}
                className="bg-slate-900 text-white font-black py-4 px-6 rounded-2xl shadow-xl shadow-slate-900/10 hover:bg-slate-800 active:scale-95 transition-all text-[10px] uppercase tracking-[0.22em] flex items-center gap-2 font-mono"
              >
                Next: Review Kick-off <ArrowRight className="w-3 h-3" />
              </button>
            </>
          )}

          {setupStep === 'confirm' && (
            <>
              <button
                type="button"
                onClick={() => setSetupStep('teamB')}
                className="py-4 text-xs font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest"
              >
                Back
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (match.status === 'scheduled') {
                    await updateDoc(doc(db, `tournaments/${tournament.id}/matches/${match.id}`), {
                      status: 'live',
                      isTimerRunning: true,
                      timerStartTime: serverTimestamp(),
                      elapsedTimeOnPause: 0,
                      lineupA: tempLineupA,
                      subsA: tempSubsA,
                      lineupB: tempLineupB,
                      subsB: tempSubsB,
                    });
                  }
                  setShowLineupConfirm(false);
                  notify('Match Started & Timer Running!');
                }}
                className="bg-emerald-500 text-white font-black py-4 px-8 rounded-2xl shadow-xl shadow-emerald-500/20 active:scale-95 hover:bg-emerald-600 transition-all text-[10px] uppercase tracking-widest flex items-center gap-2"
              >
                Kick Off Match <Zap className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};
