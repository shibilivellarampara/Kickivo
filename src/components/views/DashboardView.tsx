import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User as FirebaseUser } from 'firebase/auth';
import { collection, query, where, orderBy, getDocs, deleteDoc, doc, collectionGroup } from 'firebase/firestore';
import { Trophy, Plus, Star, Users, ChevronRight, Settings, Trash2 } from 'lucide-react';
import { db, auth, OperationType, handleFirestoreError } from '../../lib/firebase';
import { Tournament, Team, Player, MatchEvent } from '../../types';
import { AppLogo, SoccerIcon, PitchIcon } from '../common/Icons';
import { formatTeamName } from '../../utils/football';

interface DashboardViewProps {
  user: FirebaseUser;
  activeTab: 'tournaments' | 'teams' | 'profile' | 'following';
  onSelectTournament: (t: Tournament) => void;
  onError: (err: any) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ user, activeTab, onSelectTournament, onError }) => {
  const [userTournaments, setUserTournaments] = useState<Tournament[]>([]);
  const [followingTournaments, setFollowingTournaments] = useState<Tournament[]>([]);
  const [userTeams, setUserTeams] = useState<Team[]>([]);
  const [careerTeams, setCareerTeams] = useState<{ teamId: string, tournamentId: string, name: string }[]>([]);
  const [careerStats, setCareerStats] = useState({ goals: 0, assists: 0, matches: 0, yellow: 0, red: 0 });
  const [loading, setLoading] = useState(true);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const qTournaments = query(collection(db, 'tournaments'), where('creatorId', '==', user.uid), orderBy('createdAt', 'desc'));
        const qTeams = query(collectionGroup(db, 'teams'), where('creatorId', '==', user.uid));
        const qCareerEvents = query(collectionGroup(db, 'events'), where('userId', '==', user.uid));
        const qCareerPlayers = query(collectionGroup(db, 'players'), where('userId', '==', user.uid));
        
        const [sTournaments, sTeams, sCareerEvents, sCareerPlayers, sFollowDocs] = await Promise.all([
          getDocs(qTournaments),
          getDocs(qTeams),
          getDocs(qCareerEvents),
          getDocs(qCareerPlayers),
          getDocs(collection(db, `users/${user.uid}/following`))
        ]);

        setUserTournaments(sTournaments.docs.map(d => ({ id: d.id, ...d.data() } as Tournament)));
        setUserTeams(sTeams.docs.map(d => ({ id: d.id, ...d.data() } as Team)));
        
        const careerPlayerData = sCareerPlayers.docs.map(d => d.data() as Player);
        const cTeamsMap: { [key: string]: any } = {};
        const followIds = new Set<string>();

        careerPlayerData.forEach(p => {
          cTeamsMap[p.teamId] = { teamId: p.teamId, tournamentId: p.tournamentId, name: p.name };
          if (p.tournamentId) followIds.add(p.tournamentId);
        });
        sFollowDocs.docs.forEach(d => {
          followIds.add(d.data().tournamentId);
        });
        setCareerTeams(Object.values(cTeamsMap));

        if (followIds.size > 0) {
          const ids = Array.from(followIds);
          const qFollow = query(collection(db, 'tournaments'), where('__name__', 'in', ids.slice(0, 10)));
          const sFollow = await getDocs(qFollow);
          setFollowingTournaments(sFollow.docs.map(d => ({ id: d.id, ...d.data() } as Tournament)));
        }

        const events = sCareerEvents.docs.map(d => d.data() as MatchEvent);
        setCareerStats({
          goals: events.filter(e => e.type === 'goal' && e.goalType !== 'own_goal' && !e.isPenaltyShootout).length,
          assists: events.filter(e => e.assistantUserId === user.uid && e.goalType !== 'own_goal' && !e.isPenaltyShootout).length,
          matches: sCareerPlayers.size,
          yellow: events.filter(e => e.type === 'yellow_card').length,
          red: events.filter(e => e.type === 'red_card').length
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, 'dashboard_data');
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [user.uid]);

  const handleDeleteTournament = async (tournamentId: string) => {
    if (isDeletingId !== tournamentId) {
      setIsDeletingId(tournamentId);
      setTimeout(() => setIsDeletingId(null), 3000);
      return;
    }

    try {
      await deleteDoc(doc(db, 'tournaments', tournamentId));
      setUserTournaments(prev => prev.filter(t => t.id !== tournamentId));
      setIsDeletingId(null);
    } catch (err) {
      onError(err);
      handleFirestoreError(err, OperationType.DELETE, `tournaments/${tournamentId}`);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20 text-emerald-500 font-black uppercase text-xs tracking-widest animate-pulse">
      Initializing Secure Dashboard...
    </div>
  );

  return (
    <div className="space-y-6">
      <AnimatePresence mode="wait">
        <motion.div 
          key={activeTab}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="space-y-6"
        >
            {activeTab === 'tournaments' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-black uppercase tracking-tight text-slate-800">Your Masterpieces</h2>
                  <button 
                    onClick={() => (window as any).triggerCreateTournament()}
                    className="flex items-center gap-2 bg-emerald-500 text-white px-4 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/10"
                  >
                    <Plus className="w-3 h-3" /> New Tournament
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  {userTournaments.length === 0 ? (
                    <div className="p-12 text-center bg-slate-50 rounded-[40px] border border-dashed border-slate-200">
                      <p className="text-slate-400 font-bold mb-4">You haven't built any tournaments yet.</p>
                      <button onClick={() => (window as any).triggerCreateTournament()} className="px-6 py-3 bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest">Create Tournament</button>
                    </div>
                  ) : (
                    userTournaments.map(t => (
                      <div 
                        key={t.id} 
                        className="group bg-white p-6 rounded-[32px] border border-slate-200 hover:border-emerald-200 shadow-sm hover:shadow-xl transition-all flex items-center justify-between"
                      >
                        <div className="flex items-center gap-4 cursor-pointer" onClick={() => onSelectTournament(t)}>
                          <div className="w-12 h-12 md:w-14 md:h-14 bg-emerald-50 rounded-[18px] md:rounded-[20px] flex items-center justify-center group-hover:scale-110 transition-transform shrink-0">
                            <Trophy className="w-6 h-6 md:w-7 md:h-7 text-emerald-500" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-black text-slate-800 uppercase tracking-tight text-sm md:text-lg truncate">{t.name}</h4>
                            <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{t.type.replace('_', ' ')} • {t.status}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                           <ChevronRight className="w-6 h-6 text-slate-200 group-hover:text-emerald-500" />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'following' && (
              <div className="space-y-4">
                <h2 className="text-xl font-black uppercase tracking-tight text-slate-800">Watching Closely</h2>
                <div className="grid grid-cols-1 gap-4">
                  {followingTournaments.length === 0 ? (
                    <div className="p-12 text-center bg-slate-50 rounded-[40px] border border-dashed border-slate-200">
                      <p className="text-slate-400 font-bold">You aren't active in any other tournaments yet.</p>
                    </div>
                  ) : (
                    followingTournaments.map(t => (
                      <div 
                        key={t.id} 
                        onClick={() => onSelectTournament(t)}
                        className="group bg-white p-6 rounded-[32px] border border-slate-200 hover:border-emerald-200 shadow-sm transition-all cursor-pointer flex items-center justify-between"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 bg-slate-50 rounded-[20px] flex items-center justify-center group-hover:bg-emerald-50">
                            <Star className="w-7 h-7 text-slate-300 group-hover:text-emerald-500" />
                          </div>
                          <div>
                            <h4 className="font-black text-slate-800 uppercase tracking-tight leading-tight">{t.name}</h4>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Since {new Date(t.createdAt).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <ChevronRight className="w-6 h-6 text-slate-200 group-hover:text-emerald-500" />
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'teams' && (
              <div className="space-y-4">
                <h2 className="text-xl font-black uppercase tracking-tight text-slate-800">Your Squads</h2>
                <div className="grid grid-cols-1 gap-4">
                  {userTeams.length === 0 ? (
                    <div className="p-12 text-center bg-slate-50 rounded-[40px] border border-dashed border-slate-200">
                      <p className="text-slate-400 font-bold">You haven't formed a squad yet.</p>
                    </div>
                  ) : (
                    userTeams.map(team => (
                      <div key={team.id} className="bg-white p-6 rounded-[32px] border border-slate-200 flex items-center justify-between group shadow-sm hover:shadow-xl transition-all">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 bg-slate-50 rounded-[20px] flex items-center justify-center overflow-hidden border border-slate-100">
                            {team.logoURL ? <img src={team.logoURL} className="w-full h-full object-cover" /> : <Users className="text-slate-300" />}
                          </div>
                          <div>
                            <h4 className="font-black text-slate-800 uppercase tracking-tight">{formatTeamName(team.name)}</h4>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ID: {team.id.slice(0, 8)}</p>
                          </div>
                        </div>
                        <button className="p-4 bg-slate-50 rounded-2xl text-slate-400 hover:text-emerald-500 transition-colors">
                          <Settings className="w-5 h-5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'profile' && (
              <div className="space-y-8">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white p-6 rounded-[32px] border border-slate-200 text-center flex flex-col items-center shadow-sm">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1 flex items-center gap-1">
                      <SoccerIcon className="w-3 h-3" /> Goals
                    </p>
                    <p className="text-3xl font-black text-emerald-500">{careerStats.goals}</p>
                  </div>
                  <div className="bg-white p-6 rounded-[32px] border border-slate-200 text-center shadow-sm">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Assists</p>
                    <p className="text-3xl font-black text-blue-500">{careerStats.assists}</p>
                  </div>
                  <div className="bg-white p-6 rounded-[32px] border border-slate-200 text-center shadow-sm">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1 flex items-center justify-center gap-1">
                      <PitchIcon className="w-3 h-3" /> Matches
                    </p>
                    <p className="text-3xl font-black text-slate-900">{careerStats.matches}</p>
                  </div>
                  <div className="bg-white p-6 rounded-[32px] border border-slate-200 text-center shadow-sm">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Yellow/Red</p>
                    <p className="text-xl font-black text-slate-900">{careerStats.yellow}/{careerStats.red}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-black uppercase tracking-tighter">Tournament Management (Destructive)</h3>
                  <div className="grid grid-cols-1 gap-3">
                    {userTournaments.map(t => (
                      <div key={t.id} className="bg-white p-6 rounded-[32px] border border-slate-200 flex items-center justify-between shadow-sm">
                        <div className="flex items-center gap-4">
                          <Trophy className="w-5 h-5 text-slate-200" />
                          <span className="font-bold text-slate-700">{t.name}</span>
                        </div>
                        <button 
                          onClick={() => handleDeleteTournament(t.id)}
                          className={`p-3 rounded-2xl transition-all flex items-center gap-2 group ${isDeletingId === t.id ? 'bg-red-500 text-white scale-105' : 'bg-red-50 text-red-500 hover:bg-red-500 hover:text-white'}`}
                        >
                          <Trash2 className="w-5 h-5" />
                          <span className="text-[10px] font-black uppercase tracking-widest">{isDeletingId === t.id ? 'Confirm?' : 'Delete'}</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm">
                  <div className="p-8 border-b border-slate-100">
                    <h3 className="text-lg font-black uppercase tracking-tighter mb-4">Official Bio</h3>
                    <div className="space-y-4">
                      <div className="flex justify-between py-3 border-b border-slate-50">
                        <span className="text-slate-400 font-bold text-xs uppercase">Display Name</span>
                        <span className="font-black text-slate-800">{user.displayName}</span>
                      </div>
                      <div className="flex justify-between py-3 border-b border-slate-50">
                        <span className="text-slate-400 font-bold text-xs uppercase">Email</span>
                        <span className="font-black text-slate-800">{user.email}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
