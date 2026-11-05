import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  deleteDoc, 
  doc, 
  orderBy,
  collectionGroup
} from 'firebase/firestore';
import { User as FirebaseUser } from 'firebase/auth';
import { 
  Trophy, 
  Users, 
  Heart, 
  Settings, 
  Trash2, 
  ChevronRight, 
  Plus,
  Search,
  X
} from 'lucide-react';
import { db, OperationType, handleFirestoreError } from '../../lib/firebase';
import { Tournament, Team, Player, MatchEvent } from '../../types';
import { SoccerIcon, PitchIcon } from '../common/Icons';
import { formatTeamName } from '../../utils/football';
import { renderTeamLogo } from '../../utils/avatarUtils';

interface DashboardViewProps {
  user: FirebaseUser;
  activeTab: 'tournaments' | 'teams' | 'profile' | 'following';
  onTabChange?: (tab: 'tournaments' | 'teams' | 'profile' | 'following') => void;
  onSelectTournament: (t: Tournament) => void;
  onError: (err: any) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ 
  user, 
  activeTab, 
  onTabChange,
  onSelectTournament, 
  onError 
}) => {
  const [userTournaments, setUserTournaments] = useState<Tournament[]>([]);
  const [followingTournaments, setFollowingTournaments] = useState<Tournament[]>([]);
  const [userTeams, setUserTeams] = useState<Team[]>([]);
  const [careerTeams, setCareerTeams] = useState<{ teamId: string, tournamentId: string, name: string }[]>([]);
  const [careerStats, setCareerStats] = useState({ goals: 0, assists: 0, matches: 0, yellow: 0, red: 0 });
  const [loading, setLoading] = useState(true);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [tournamentFilter, setTournamentFilter] = useState<'created' | 'followed'>('created');

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

        setUserTournaments(sTournaments.docs.map(d => ({ id: d.id, ...d.data() } as Tournament)).sort((a, b) => {
          const order: Record<string, number> = { live: 0, upcoming: 1, scheduled: 1, completed: 2, finished: 2 };
          return (order[a.status] ?? 3) - (order[b.status] ?? 3);
        }));
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
    <div className="flex flex-col items-center justify-center py-40 gap-4">
      <div className="w-12 h-12 border-4 border-slate-100 border-t-emerald-500 rounded-full animate-spin" />
      <div className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.2em]">
        Loading your tournaments...
      </div>
    </div>
  );

  const tabsList = [
    { id: 'tournaments' as const, label: 'Tournaments', icon: Trophy },
    { id: 'following' as const, label: 'Following', icon: Heart },
    { id: 'teams' as const, label: 'Squads', icon: Users },
    { id: 'profile' as const, label: 'My Career', icon: Settings }
  ];

  return (
    <div className="space-y-8">
      {onTabChange && (
        <div className="flex bg-slate-100/60 dark:bg-slate-900/60 p-1 rounded-2xl border border-slate-200/40 dark:border-slate-800/80 max-w-lg">
          {tabsList.map(tab => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-[14px] text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                  isActive
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/15'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div 
          key={activeTab}
          onAnimationStart={() => {
            setSearchQuery('');
            setIsSearchExpanded(false);
          }}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="space-y-6"
        >
          {activeTab === 'tournaments' && (
              <div className="space-y-4">
                <motion.div layout className="flex flex-col md:flex-row md:items-center justify-between gap-4 min-h-[48px]">
                  <AnimatePresence mode="wait">
                    {!isSearchExpanded && (
                      <motion.div
                        layout
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.15 }}
                        className="flex bg-slate-100/80 dark:bg-slate-950 p-1 rounded-2xl border border-slate-200/40 dark:border-slate-800/80 w-fit shrink-0"
                      >
                        <button
                          type="button"
                          onClick={() => setTournamentFilter('created')}
                          className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wide transition-all cursor-pointer ${
                            tournamentFilter === 'created'
                              ? 'bg-white dark:bg-slate-900 text-emerald-500 shadow-sm'
                              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          Created By Me
                        </button>
                        <button
                          type="button"
                          onClick={() => setTournamentFilter('followed')}
                          className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wide transition-all flex items-center gap-1.5 cursor-pointer ${
                            tournamentFilter === 'followed'
                              ? 'bg-white dark:bg-slate-900 text-emerald-500 shadow-sm'
                              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          <Heart className={`w-3.5 h-3.5 ${tournamentFilter === 'followed' ? 'text-rose-500 fill-rose-500' : 'text-slate-400 dark:text-slate-500'}`} />
                          Followed
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <motion.div layout className="flex items-center gap-3 ml-auto w-full md:w-auto justify-end">
                    <motion.div layout className="flex items-center gap-2">
                      <AnimatePresence>
                        {isSearchExpanded && (
                          <motion.div 
                            layout
                            initial={{ width: 0, opacity: 0, x: 20 }}
                            animate={{ width: 240, opacity: 1, x: 0 }}
                            exit={{ width: 0, opacity: 0, x: 20 }}
                            transition={{ duration: 0.22, ease: "easeOut" }}
                            className="relative overflow-hidden"
                          >
                            <input 
                              autoFocus
                              type="text"
                              placeholder="Search tournaments..."
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 pl-4 pr-10 py-2 rounded-xl text-base md:text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/25 font-semibold placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-sm"
                            />
                            {searchQuery && (
                              <button 
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                      <motion.button 
                         layout
                         onClick={() => {
                           setIsSearchExpanded(!isSearchExpanded);
                           if (isSearchExpanded) setSearchQuery('');
                         }}
                         className={`p-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center cursor-pointer ${isSearchExpanded ? 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:scale-105' : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'}`}
                      >
                        {isSearchExpanded ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
                      </motion.button>
                    </motion.div>
                    {tournamentFilter === 'created' && !isSearchExpanded && (
                      <motion.button 
                        layout
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        onClick={() => (window as any).triggerCreateTournament()}
                        className="flex items-center gap-2 bg-emerald-500 text-white px-5 py-2.5 rounded-2xl font-bold text-[10px] uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/10 shrink-0 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> New
                      </motion.button>
                    )}
                  </motion.div>
                </motion.div>
                <div className="grid grid-cols-1 gap-4">
                  {(tournamentFilter === 'created' ? userTournaments : followingTournaments).filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
                    <div className="p-16 text-center bg-slate-50 dark:bg-slate-900/50 rounded-[40px] border-2 border-dashed border-slate-200 dark:border-slate-850">
                      <p className="text-slate-400 dark:text-slate-500 font-bold mb-6 italic">No tournaments found.</p>
                      {tournamentFilter === 'created' && userTournaments.length === 0 && (
                        <button onClick={() => (window as any).triggerCreateTournament()} className="px-8 py-4 bg-emerald-500 text-white rounded-2xl font-bold text-xs uppercase tracking-widest shadow-xl shadow-emerald-500/20">Create Tournament</button>
                      )}
                    </div>
                  ) : (
                    (tournamentFilter === 'created' ? userTournaments : followingTournaments).filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase())).map(t => (
                      <div 
                        key={t.id} 
                        className="group bg-white dark:bg-slate-900 p-6 rounded-[32px] border border-slate-100 dark:border-slate-800/80 hover:border-emerald-200 dark:hover:border-emerald-500/50 shadow-sm hover:shadow-xl hover:shadow-emerald-500/5 transition-all flex items-center justify-between"
                      >
                        <div className="flex items-center gap-5 cursor-pointer flex-1 min-w-0" onClick={() => onSelectTournament(t)}>
                          <div className={`w-14 h-14 md:w-16 md:h-16 bg-slate-50 dark:bg-slate-950 rounded-[22px] flex items-center justify-center transition-all shrink-0 ${tournamentFilter === 'followed' ? 'group-hover:bg-rose-50 dark:group-hover:bg-rose-950/20 group-hover:scale-105' : 'group-hover:bg-emerald-50 dark:group-hover:bg-emerald-950/40 group-hover:scale-105'}`}>
                            {tournamentFilter === 'followed' ? (
                              <Heart className="w-7 h-7 md:w-8 md:h-8 text-slate-300 dark:text-slate-700 group-hover:text-rose-500 group-hover:fill-rose-500 transition-colors" />
                            ) : (
                              <Trophy className="w-7 h-7 md:w-8 md:h-8 text-slate-300 dark:text-slate-700 group-hover:text-emerald-500 transition-colors" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-bold text-slate-900 dark:text-slate-100 uppercase tracking-tight text-base md:text-xl truncate">{t.name}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[9px] md:text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest truncate">{t.type.replace('_', ' ')}</span>
                              {(t.category === 'efootball' || t.isEfootball) && (
                                <span className="text-[8px] font-black uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 dark:text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-200/40 dark:border-indigo-800/40">
                                  eFootball
                                </span>
                              )}
                              <span className="w-1 h-1 rounded-full bg-slate-200 dark:bg-slate-800" />
                              <span className={`text-[9px] md:text-[10px] font-bold uppercase tracking-widest ${t.status === 'live' ? 'text-emerald-500' : 'text-slate-400 dark:text-slate-500'}`}>{t.status}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 pl-4">
                           {followingTournaments.some(ft => ft.id === t.id) && (
                             <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500 shrink-0" />
                           )}
                           <ChevronRight className="w-6 h-6 text-slate-200 dark:text-slate-700 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'following' && (
              <div className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {!isSearchExpanded && (
                    <h2 className="text-xl font-bold uppercase tracking-tight text-slate-800 dark:text-slate-100">Watching Closely</h2>
                  )}
                  <div className="flex items-center gap-2 ml-auto">
                    <AnimatePresence>
                      {isSearchExpanded && (
                        <motion.div 
                          initial={{ width: 0, opacity: 0 }}
                          animate={{ width: 240, opacity: 1 }}
                          exit={{ width: 0, opacity: 0 }}
                          transition={{ duration: 0.22, ease: "easeOut" }}
                          className="relative overflow-hidden"
                        >
                          <input 
                            autoFocus
                            type="text"
                            placeholder="Search tournaments..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 pl-4 pr-10 py-2 rounded-xl text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-semibold placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-sm"
                          />
                          {searchQuery && (
                            <button 
                              onClick={() => setSearchQuery('')}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <button 
                       onClick={() => {
                         setIsSearchExpanded(!isSearchExpanded);
                         if (isSearchExpanded) setSearchQuery('');
                       }}
                       className={`p-2 rounded-xl transition-all ${isSearchExpanded ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300' : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100'}`}
                    >
                      {isSearchExpanded ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  {followingTournaments.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
                    <div className="p-16 text-center bg-slate-50 dark:bg-slate-900/50 rounded-[40px] border-2 border-dashed border-slate-200 dark:border-slate-850">
                      <p className="text-slate-400 dark:text-slate-500 font-bold italic">No followed tournaments match your search.</p>
                    </div>
                  ) : (
                    followingTournaments.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase())).map(t => (
                      <div 
                        key={t.id} 
                        onClick={() => onSelectTournament(t)}
                        className="group bg-white dark:bg-slate-900 p-6 rounded-[32px] border border-slate-100 dark:border-slate-800/80 hover:border-rose-200 dark:hover:border-rose-500/50 shadow-sm transition-all cursor-pointer flex items-center justify-between"
                      >
                        <div className="flex items-center gap-5">
                          <div className="w-14 h-14 bg-slate-50 dark:bg-slate-950 rounded-[22px] flex items-center justify-center group-hover:bg-rose-50 dark:group-hover:bg-rose-950/20 group-hover:scale-105 transition-all">
                            <Heart className="w-7 h-7 text-slate-300 dark:text-slate-700 group-hover:text-rose-500 group-hover:fill-rose-500 transition-colors" />
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900 dark:text-slate-100 uppercase tracking-tight text-lg leading-tight">{t.name}</h4>
                            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">Active Since {t.createdAt ? (t.createdAt as any).toDate?.().toLocaleDateString() || new Date(t.createdAt).toLocaleDateString() : 'N/A'}</p>
                          </div>
                        </div>
                        <ChevronRight className="w-6 h-6 text-slate-200 dark:text-slate-800 group-hover:text-rose-500" />
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'teams' && (
              <div className="space-y-4">
                <h2 className="text-xl font-bold uppercase tracking-tight text-slate-800 dark:text-slate-100">Your Squads</h2>
                <div className="grid grid-cols-1 gap-4">
                  {userTeams.length === 0 ? (
                    <div className="p-16 text-center bg-slate-50 dark:bg-slate-900/50 rounded-[40px] border-2 border-dashed border-slate-200 dark:border-slate-850">
                      <p className="text-slate-400 dark:text-slate-500 font-bold italic">You haven't formed a squad yet.</p>
                    </div>
                  ) : (
                    userTeams.map(team => (
                      <div key={team.id} className="bg-white dark:bg-slate-900 p-6 rounded-[32px] border border-slate-100 dark:border-slate-800/80 flex items-center justify-between group shadow-sm hover:shadow-xl transition-all">
                        <div className="flex items-center gap-5">
                          <div className="w-16 h-16 flex items-center justify-center shrink-0">
                            {renderTeamLogo(team.logoURL, team.name, "w-16 h-16")}
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900 dark:text-slate-100 uppercase tracking-tight text-lg">{formatTeamName(team.name)}</h4>
                            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">ID: {team.id.slice(0, 8)}</p>
                          </div>
                        </div>
                        <button className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl text-slate-400 dark:text-slate-500 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-all">
                          <Settings className="w-5 h-5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'profile' && (
              <div className="space-y-12">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white dark:bg-slate-900 p-6 rounded-[32px] border border-slate-100 dark:border-slate-800 text-center flex flex-col items-center shadow-sm">
                    <p className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-widest mb-1 flex items-center gap-1">
                      <SoccerIcon className="w-3 h-3 text-emerald-500" /> Goals
                    </p>
                    <p className="text-3xl font-black text-emerald-500 tracking-tight">{careerStats.goals}</p>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-6 rounded-[32px] border border-slate-100 dark:border-slate-800 text-center shadow-sm flex flex-col items-center">
                    <p className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-widest mb-1">Assists</p>
                    <p className="text-3xl font-black text-blue-500 tracking-tight">{careerStats.assists}</p>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-6 rounded-[32px] border border-slate-100 dark:border-slate-800 text-center shadow-sm flex flex-col items-center">
                    <p className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-widest mb-1 flex items-center justify-center gap-1">
                      <PitchIcon className="w-3 h-3 text-slate-400" /> Matches
                    </p>
                    <p className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">{careerStats.matches}</p>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-6 rounded-[32px] border border-slate-100 dark:border-slate-800 text-center shadow-sm flex flex-col items-center justify-center">
                    <p className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-widest mb-2">Cards</p>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200/50 dark:border-amber-800/30">
                        <div className="w-2 h-3 bg-amber-400 rounded-[1px] border border-amber-500/20 shadow-sm shrink-0" />
                        <span className="font-extrabold text-xs text-slate-800 dark:text-slate-300">{careerStats.yellow}</span>
                      </div>
                      <div className="flex items-center gap-1.5 px-2 py-1 bg-rose-50 dark:bg-rose-950/20 rounded-lg border border-rose-200/50 dark:border-rose-800/30">
                        <div className="w-2 h-3 bg-rose-500 rounded-[1px] border border-rose-600/20 shadow-sm shrink-0" />
                        <span className="font-extrabold text-xs text-slate-800 dark:text-slate-300">{careerStats.red}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 flex items-center gap-3">
                    <Settings className="w-4 h-4" /> Tournament Management
                  </h3>
                  <div className="grid grid-cols-1 gap-3">
                    {userTournaments.map(t => (
                      <div key={t.id} className="bg-white dark:bg-slate-900 p-6 rounded-[32px] border border-slate-100 dark:border-slate-800 flex items-center justify-between shadow-sm">
                        <div className="flex items-center gap-4">
                          <Trophy className="w-5 h-5 text-slate-200 dark:text-slate-700" />
                          <span className="font-bold text-slate-700 dark:text-slate-300">{t.name}</span>
                        </div>
                        <button 
                          onClick={() => handleDeleteTournament(t.id)}
                          className={`px-5 py-3 rounded-2xl transition-all flex items-center gap-2 group ${isDeletingId === t.id ? 'bg-red-500 text-white scale-105' : 'bg-red-50 dark:bg-red-950/20 text-red-500 dark:text-red-400 hover:bg-red-500 hover:text-white dark:hover:bg-red-500'}`}
                        >
                          <Trash2 className="w-4 h-4" />
                          <span className="text-[10px] font-bold uppercase tracking-widest">{isDeletingId === t.id ? 'Confirm?' : 'Delete'}</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-[32px] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
                  <div className="p-10 border-b border-slate-50 dark:border-slate-800">
                    <h3 className="text-lg font-bold uppercase tracking-tight mb-8 text-slate-900 dark:text-white">Official Bio</h3>
                    <div className="space-y-6">
                      <div className="flex justify-between py-4 border-b border-slate-50 dark:border-slate-800">
                        <span className="text-slate-400 dark:text-slate-500 font-bold text-[10px] uppercase tracking-widest">Display Name</span>
                        <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">{user.displayName}</span>
                      </div>
                      <div className="flex justify-between py-4">
                        <span className="text-slate-400 dark:text-slate-500 font-bold text-[10px] uppercase tracking-widest">Email Address</span>
                        <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">{user.email}</span>
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
