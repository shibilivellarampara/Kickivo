import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  updateDoc,
  deleteDoc,
  serverTimestamp, 
  doc, 
  getDocs,
  where
} from 'firebase/firestore';
import { 
  Users, 
  Plus, 
  X, 
  Star,
  Settings,
  Shield,
  Zap,
  Trash2,
  Hash,
  Activity,
  HelpingHand
} from 'lucide-react';
import { db, OperationType, handleFirestoreError } from '../../lib/firebase';
import { Tournament, Team, Player } from '../../types';
import { sortPlayersByPosition } from '../../utils/football';

interface TeamDetailViewProps {
  tournament: Tournament;
  team: Team;
  onBack: () => void;
  isCreator: boolean;
}

export const TeamDetailView: React.FC<TeamDetailViewProps> = ({ 
  tournament, 
  team, 
  onBack, 
  isCreator 
}) => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);

  useEffect(() => {
    const q = query(collection(db, `tournaments/${tournament.id}/teams/${team.id}/players`));
    return onSnapshot(q, (s) => {
      setPlayers(s.docs.map(d => ({ id: d.id, ...d.data() } as Player)));
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `players`);
    });
  }, [tournament.id, team.id]);

  const addPlayer = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const name = (form.elements.namedItem('player-name') as HTMLInputElement).value;
    const number = parseInt((form.elements.namedItem('player-number') as HTMLInputElement).value);
    const position = (form.elements.namedItem('player-position') as HTMLSelectElement).value;

    try {
      await addDoc(collection(db, `tournaments/${tournament.id}/teams/${team.id}/players`), {
        name,
        number,
        position,
        teamId: team.id,
        tournamentId: tournament.id,
        goals: 0,
        assists: 0,
        matchesPlayed: 0
      });
      setShowAddPlayer(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `players`);
    }
  };

  const updatePlayer = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingPlayer) return;
    const form = e.currentTarget;
    const name = (form.elements.namedItem('player-name') as HTMLInputElement).value;
    const number = parseInt((form.elements.namedItem('player-number') as HTMLInputElement).value);
    const position = (form.elements.namedItem('player-position') as HTMLSelectElement).value;

    try {
      await updateDoc(doc(db, `tournaments/${tournament.id}/teams/${team.id}/players/${editingPlayer.id}`), {
        name,
        number,
        position
      });
      setEditingPlayer(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `players`);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-slate-400 font-semibold hover:text-slate-900 transition-colors uppercase tracking-widest text-[9px]">
          &larr; Back to Tournament
        </button>
        {isCreator && (
          <button 
            onClick={() => setShowAddPlayer(true)}
            className="bg-slate-900 text-white px-6 py-3 rounded-full text-xs font-bold shadow-lg hover:bg-slate-800 transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Join Squad
          </button>
        )}
      </div>

      <div className="bg-white rounded-[40px] p-8 md:p-12 border border-slate-100 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-slate-900" />
        <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
          <div className="w-32 h-32 md:w-48 md:h-48 bg-slate-50 rounded-[40px] flex items-center justify-center border border-slate-100 overflow-hidden shadow-inner">
             {team.logoURL ? <img src={team.logoURL} className="w-full h-full object-contain" alt="" /> : <Users className="w-20 h-20 text-slate-200" />}
          </div>
          <div className="flex-1 text-center md:text-left space-y-4">
            <div className="flex items-center justify-center md:justify-start gap-4">
               <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-none text-slate-900">{team.name}</h1>
               {team.captainId && <Star className="w-6 h-6 text-amber-400 fill-amber-400" />}
            </div>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
               <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100">
                  <Activity className="w-4 h-4 text-emerald-500" />
                  <span className="text-sm font-bold text-slate-600">{players.length} Squad Members</span>
               </div>
               {team.group && (
                 <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100">
                    <Shield className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-bold text-slate-600">{team.group}</span>
                 </div>
               )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className="flex items-center gap-4 mb-4">
          <div className="h-[2px] flex-1 bg-slate-100" />
          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Squad List</h3>
          <div className="h-[2px] flex-1 bg-slate-100" />
        </div>
        
        {players.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-3xl border border-slate-100">
            <Users className="w-12 h-12 text-slate-100 mx-auto mb-4" />
            <p className="text-slate-300 font-bold uppercase tracking-widest text-[10px] italic">No players added yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortPlayersByPosition(players).map(p => (
              <div key={p.id} className="bg-white p-6 rounded-3xl border border-slate-100 flex items-center justify-between group hover:border-emerald-500 hover:shadow-lg transition-all shadow-sm">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 font-bold text-slate-400 group-hover:bg-emerald-500 group-hover:text-white transition-all">
                       {p.number || <Zap className="w-5 h-5 opacity-30" />}
                    </div>
                    <div>
                       <h4 className="font-bold text-slate-900">{p.name}</h4>
                       <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">{p.position || 'Player'}</span>
                    </div>
                 </div>
                 {isCreator && (
                   <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setEditingPlayer(p)} className="p-2 text-slate-300 hover:text-slate-900 transition-colors"><Settings className="w-4 h-4" /></button>
                      <button onClick={() => {
                         if (window.confirm(`Delete ${p.name}?`)) {
                            deleteDoc(doc(db, `tournaments/${tournament.id}/teams/${team.id}/players/${p.id}`));
                         }
                      }} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                   </div>
                 )}
              </div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {(showAddPlayer || editingPlayer) && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setShowAddPlayer(false); setEditingPlayer(null); }} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white w-full max-w-md rounded-[32px] p-8 shadow-2xl">
              <button onClick={() => { setShowAddPlayer(false); setEditingPlayer(null); }} className="absolute right-6 top-6 p-2 text-slate-300 hover:text-slate-600 transition-colors"><X className="w-5 h-5" /></button>
              <h2 className="text-2xl font-bold tracking-tight mb-6">{editingPlayer ? 'Edit Player' : 'Join Squad'}</h2>
              <form onSubmit={editingPlayer ? updatePlayer : addPlayer} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Full Name</label>
                  <input name="player-name" required defaultValue={editingPlayer?.name} className="w-full bg-slate-50 px-5 py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none font-bold" placeholder="e.g. Cristiano Ronaldo" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Squad Number</label>
                      <input name="player-number" type="number" required defaultValue={editingPlayer?.number} className="w-full bg-slate-50 px-5 py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none font-bold" placeholder="7" />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Position</label>
                      <select name="player-position" required defaultValue={editingPlayer?.position || 'FWD'} className="w-full bg-slate-50 px-5 py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none font-bold">
                         <option value="GK">Goalkeeper (GK)</option>
                         <option value="DEF">Defender (DEF)</option>
                         <option value="MID">Midfielder (MID)</option>
                         <option value="FWD">Forward (FWD)</option>
                         <option value="SUB">Substitute (SUB)</option>
                      </select>
                   </div>
                </div>
                <button type="submit" className="w-full bg-emerald-500 text-white font-bold py-5 rounded-2xl shadow-lg hover:bg-emerald-600 transition-all active:scale-95 mt-4">
                   {editingPlayer ? 'Save Changes' : 'Confirm Registration'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
