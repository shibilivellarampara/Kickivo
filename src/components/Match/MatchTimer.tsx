import React, { useState, useEffect } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { db } from '../../lib/firebase';
import { Match, Tournament } from '../../types';

interface MatchTimerProps {
  match: Match;
  isCreator: boolean;
  tournament: Tournament;
}

export const MatchTimer: React.FC<MatchTimerProps> = ({ match, isCreator, tournament }) => {
  const [elapsed, setElapsed] = useState(0);
  
  useEffect(() => {
    let interval: any;
    if (match.isTimerRunning && match.timerStartTime) {
      const startTime = match.timerStartTime.toMillis ? match.timerStartTime.toMillis() : new Date(match.timerStartTime).getTime();
      const baseElapsed = match.elapsedTimeOnPause || 0;
      
      const update = () => {
        const now = Date.now();
        const diff = Math.floor((now - startTime) / 1000);
        setElapsed(baseElapsed + diff);
      };
      
      update();
      interval = setInterval(update, 1000);
    } else {
      setElapsed(match.elapsedTimeOnPause || 0);
    }
    
    return () => clearInterval(interval);
  }, [match.isTimerRunning, match.timerStartTime, match.elapsedTimeOnPause]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleTimer = async () => {
    if (!isCreator) return;
    const matchRef = doc(db, `tournaments/${tournament.id}/matches/${match.id}`);
    
    if (match.isTimerRunning) {
      const startTime = match.timerStartTime.toMillis ? match.timerStartTime.toMillis() : new Date(match.timerStartTime).getTime();
      const diff = Math.floor((Date.now() - startTime) / 1000);
      await updateDoc(matchRef, {
        isTimerRunning: false,
        elapsedTimeOnPause: (match.elapsedTimeOnPause || 0) + diff,
        timerStartTime: null,
        status: 'live'
      });
    } else {
      await updateDoc(matchRef, {
        isTimerRunning: true,
        timerStartTime: serverTimestamp(),
        status: 'live'
      });
    }
  };

  const resetTimer = async () => {
    if (!isCreator) return;
    try {
      const matchRef = doc(db, `tournaments/${tournament.id}/matches/${match.id}`);
      await updateDoc(matchRef, {
        isTimerRunning: false,
        elapsedTimeOnPause: 0,
        timerStartTime: null
      });
      setElapsed(0);
    } catch (err) {
      console.error("Error resetting timer:", err);
    }
  };

  return (
    <div className="flex items-center gap-1.5 bg-emerald-50/80 backdrop-blur-sm border border-emerald-500 p-1 pr-2.5 rounded-xl shadow-xl shadow-emerald-900/10 relative overflow-hidden group">
      {/* Decorative gradient flare */}
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent" />
      
      <div className="flex flex-col items-center px-3 py-0.5 min-w-[70px] border-r border-emerald-200 overflow-hidden relative">
         <div className="absolute inset-0 bg-emerald-500/5 blur-xl -z-10" />
         <span className="text-[6px] font-black uppercase tracking-[0.3em] text-emerald-600 mb-0">Clock</span>
         <div className="flex items-baseline gap-1">
           <span className="text-xl md:text-2xl font-black tabular-nums font-mono text-emerald-900 tracking-tighter drop-shadow-sm">{formatTime(elapsed)}</span>
         </div>
      </div>
      
      {isCreator && match.status !== 'finished' && (
        <div className="flex flex-col gap-0.5 min-w-[90px]">
           <button 
             onClick={toggleTimer}
             className={`w-full h-7 px-2 rounded-lg border transition-all active:scale-95 flex items-center justify-center gap-1 font-black text-[8px] uppercase tracking-widest ${match.isTimerRunning ? 'bg-amber-500 text-white border-amber-400 shadow-md shadow-amber-500/10' : 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-600/10 hover:bg-emerald-700'}`}
           >
             {match.isTimerRunning ? <Pause className="w-2 h-2 fill-current" /> : <Play className="w-2 h-2 fill-current" />}
             {match.isTimerRunning ? 'Pause' : (elapsed === 0 ? 'Kick Off' : 'Resume')}
           </button>
           
           <button 
             onClick={resetTimer}
             className="w-full h-6 flex items-center justify-center gap-1 rounded-md bg-white border border-emerald-100 text-emerald-600 hover:text-emerald-800 transition-all active:scale-95 shadow-sm"
             title="Reset Clock"
           >
             <RotateCcw className="w-2 h-2" />
             <span className="text-[7px] font-black uppercase tracking-widest">Reset</span>
           </button>
        </div>
      )}
    </div>
  );
};
