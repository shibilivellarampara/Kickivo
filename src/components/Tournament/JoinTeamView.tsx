import React, { useState, useEffect } from 'react';
import { 
  getDocFromServer, 
  doc, 
  getDocs, 
  collection, 
  updateDoc, 
  serverTimestamp, 
  addDoc 
} from 'firebase/firestore';
import { User as FirebaseUser } from 'firebase/auth';
import { Users, ChevronRight } from 'lucide-react';
import { db, OperationType, handleFirestoreError } from '../../lib/firebase';
import { Tournament, Team, Player } from '../../types';
import { formatTeamName } from '../../utils/football';

interface JoinTeamViewProps {
  tournamentId: string;
  teamId: string;
  user: FirebaseUser | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export const JoinTeamView: React.FC<JoinTeamViewProps> = ({ 
  tournamentId, 
  teamId, 
  user, 
  onSuccess, 
  onCancel 
}) => {
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
      if ((window as any).notify) (window as any).notify("Please sign in to join a team!");
      return;
    }
    setJoining(true);
    try {
      if (claimPlayerId) {
        await updateDoc(doc(db, `tournaments/${tournamentId}/teams/${teamId}/players`, claimPlayerId), {
          userId: user.uid,
          tournamentId: tournamentId,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, `tournaments/${tournamentId}/teams/${teamId}/players`), {
          name: user.displayName,
          userId: user.uid,
          teamId: teamId,
          tournamentId: tournamentId,
          number: 0,
          position: 'Player',
          createdAt: serverTimestamp()
        });
      }
      onSuccess();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'players');
    } finally {
      setJoining(false);
    }
  };

  if (loading) return <div className="py-20 text-center">Loading team details...</div>;
  if (!tournament || !team) return <div className="py-20 text-center font-bold text-slate-400">Team or tournament not found.</div>;

  const unclaimedPlayers = players.filter(p => !p.userId);

  return (
    <div className="max-w-2xl mx-auto py-12 px-4 text-slate-900">
      <div className="bg-white rounded-[40px] p-8 md:p-12 border border-slate-200 shadow-xl text-center space-y-8">
        <div className="w-32 h-32 bg-slate-50 rounded-full mx-auto flex items-center justify-center overflow-hidden border-4 border-white shadow-lg">
          {team.logoURL ? <img src={team.logoURL} className="w-full h-full object-cover" alt="" /> : <Users className="w-12 h-12 text-slate-300" />}
        </div>
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Invitation to Join</p>
          <h2 className="text-4xl font-black uppercase tracking-tighter">{formatTeamName(team.name)}</h2>
          <p className="text-slate-500 font-medium italic">in {tournament.name}</p>
        </div>

        {unclaimedPlayers.length > 0 && (
          <div className="space-y-4">
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">Is one of these you?</p>
            <div className="grid grid-cols-1 gap-2">
              {unclaimedPlayers.map((p, idx) => (
                <button 
                  key={p.id}
                  onClick={() => handleJoin(p.id)}
                  disabled={joining}
                  className="p-4 bg-slate-50 hover:bg-emerald-50 rounded-2xl border border-slate-100 flex items-center justify-between group transition-colors disabled:opacity-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center font-black text-slate-300 group-hover:text-emerald-500">
                      {idx + 1}
                    </div>
                    <span className="font-bold text-slate-700">{p.name.split(' (')[0].split(' #')[0]}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-500" />
                </button>
              ))}
            </div>
            <div className="flex items-center gap-4 py-4">
              <div className="flex-1 h-px bg-slate-100" />
              <span className="text-[10px] font-black text-slate-300 uppercase">OR</span>
              <div className="flex-1 h-px bg-slate-100" />
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4">
          <button 
            onClick={() => handleJoin()}
            disabled={joining}
            className="w-full py-5 bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-100 disabled:opacity-50"
          >
            {joining ? 'Joining...' : 'Create New Player Slot'}
          </button>
          <button onClick={onCancel} className="text-slate-400 font-bold text-xs uppercase tracking-widest hover:text-slate-600">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
