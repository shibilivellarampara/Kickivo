import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { User as FirebaseUser } from 'firebase/auth';
import { doc, getDocFromServer, getDocs, collection, addDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../../lib/firebase';
import { Team, Tournament, Player } from '../../types';
import { Users, X, Send } from 'lucide-react';

interface JoinTeamViewProps {
  tournamentId: string;
  teamId: string;
  user: FirebaseUser | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export const JoinTeamView: React.FC<JoinTeamViewProps> = ({ tournamentId, teamId, user, onSuccess, onCancel }) => {
  const [team, setTeam] = useState<Team | null>(null);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tDoc, teamDoc, playersDocs] = await Promise.all([
          getDocFromServer(doc(db, 'tournaments', tournamentId)),
          getDocFromServer(doc(db, `tournaments/${tournamentId}/teams`, teamId)),
          getDocs(collection(db, `tournaments/${tournamentId}/teams/${teamId}/players`))
        ]);
        if (tDoc.exists()) setTournament({ id: tDoc.id, ...tDoc.data() } as Tournament);
        if (teamDoc.exists()) setTeam({ id: teamDoc.id, ...teamDoc.data() } as Team);
        setPlayers(playersDocs.docs.map(d => ({ id: d.id, ...d.data() } as Player)));
      } catch (err) {
        console.error("Join fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [tournamentId, teamId]);

  const handleJoin = async (claimPlayerId?: string) => {
    if (!user) {
      alert("Please sign in to join a team!");
      return;
    }

    setJoining(true);
    try {
      if (claimPlayerId) {
        // Update existing player doc to link to this user
        const playerRef = doc(db, `tournaments/${tournamentId}/teams/${teamId}/players`, claimPlayerId);
        await updateDoc(playerRef, {
          userId: user.uid,
          photoURL: user.photoURL || ''
        });
      } else {
        // Create new player doc
        await addDoc(collection(db, `tournaments/${tournamentId}/teams/${teamId}/players`), {
          name: user.displayName || 'Player',
          userId: user.uid,
          photoURL: user.photoURL || '',
          teamId,
          tournamentId,
          createdAt: serverTimestamp()
        });
      }
      onSuccess();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'join_team');
    } finally {
      setJoining(false);
    }
  };

  if (loading) return <div className="p-20 text-center font-black uppercase text-xs tracking-widest animate-pulse">Scanning Match Card...</div>;
  if (!team || !tournament) return <div className="p-20 text-center font-bold">Tournament or Team not found.</div>;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white p-8 md:p-12 rounded-[40px] shadow-2xl border border-slate-100 space-y-8"
    >
      <div className="text-center space-y-4">
        <div className="w-20 h-20 bg-emerald-50 rounded-[28px] flex items-center justify-center mx-auto border-2 border-emerald-100 shadow-xl shadow-emerald-500/10">
          <Users className="w-10 h-10 text-emerald-500" />
        </div>
        <div>
          <h2 className="text-3xl font-black tracking-tighter uppercase leading-none">Assemble with {team.name}</h2>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-2">{tournament.name}</p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Select your roster spot</h3>
          <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-2 scrollbar-hide">
             {players.filter(p => !p.userId).map(p => (
               <button 
                key={p.id}
                onClick={() => handleJoin(p.id)}
                disabled={joining}
                className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-200 hover:border-emerald-500 hover:shadow-md transition-all text-left group"
               >
                 <div className="flex items-center gap-3">
                   <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center font-black text-xs text-slate-300 group-hover:bg-emerald-50 group-hover:text-emerald-500">#{p.number || '?'}</div>
                   <span className="font-bold text-slate-700">{p.name}</span>
                 </div>
                 <span className="text-[9px] font-black uppercase tracking-widest text-slate-300 group-hover:text-emerald-500">Claim Slot</span>
               </button>
             ))}
             <button 
                onClick={() => handleJoin()}
                disabled={joining}
                className="flex items-center justify-between p-4 bg-emerald-500 text-white rounded-2xl shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all text-left"
               >
                 <div className="flex items-center gap-3">
                   <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center"><Send className="w-4 h-4" /></div>
                   <span className="font-bold">Join as new player</span>
                 </div>
               </button>
          </div>
        </div>

        <button 
          onClick={onCancel}
          className="w-full py-4 text-slate-400 font-black text-xs uppercase tracking-widest hover:text-slate-600 transition-colors"
        >
          Nevermind, take me back
        </button>
      </div>
    </motion.div>
  );
};
