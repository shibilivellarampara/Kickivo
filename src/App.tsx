import React, { useState, useEffect, useMemo } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  updateDoc,
  deleteDoc,
  serverTimestamp, 
  doc, 
  getDocFromServer,
  setDoc,
  collectionGroup,
  where,
  getDocs,
  orderBy,
  limit
} from 'firebase/firestore';
import { auth, db, OperationType, handleFirestoreError } from './lib/firebase';
import { Tournament, Match, Team, User, Player, MatchEvent, MatchEventType, GoalType } from './types';
import { Trophy, Users, LayoutDashboard, Plus, Play, LogIn, LogOut, ChevronRight, User as UserIcon, Calendar, Zap, Star, Shield, Target, MessageSquare, TrendingUp, RefreshCw, Send, ArrowUp, ArrowDown, X, RotateCcw, Settings, Trash2, Pause, Circle, Footprints } from 'lucide-react';
import { GiSoccerBall } from 'react-icons/gi';
import { motion, AnimatePresence } from 'motion/react';

const SoccerIcon = ({ className }: { className?: string }) => {
  const Icon = GiSoccerBall as any;
  return <Icon className={className} />;
};

// Sub-components will be defined or imported here
// For brevity in one file, I'll define some inline or use a simple router pattern

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [view, setView] = useState<'home' | 'tournament' | 'create-tournament' | 'dashboard' | 'join-team'>('home');
  const [dashboardTab, setDashboardTab] = useState<'tournaments' | 'teams' | 'profile'>('tournaments');
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [joinData, setJoinData] = useState<{ teamId: string, tournamentId: string } | null>(null);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [globalMessage, setGlobalMessage] = useState<string | null>(null);

  const clearError = () => setGlobalError(null);
  const clearMessage = () => setGlobalMessage(null);

  const notify = (msg: string) => {
    setGlobalMessage(msg);
    setTimeout(clearMessage, 1000);
  };

  const handleError = (err: any) => {
    let message = "An unexpected error occurred.";
    if (err instanceof Error) {
      message = err.message;
      // Try to parse JSON from handleFirestoreError
      if (message.startsWith('{')) {
        try {
          const parsed = JSON.parse(message);
          if (parsed.error) {
            message = parsed.error;
            // Map common firebase errors to user friendly messages
            if (message.includes('Missing or insufficient permissions')) {
              message = "You don't have permission to do that. Please make sure you are signed in and are the creator.";
            }
          }
        } catch (e) {
          // Fallback to original message
        }
      }
    } else if (typeof err === 'string') {
      message = err;
    }
    setGlobalError(message);
    // Auto clear after 6 seconds
    setTimeout(clearError, 6000);
  };

  useEffect(() => {
    const errorListener = (e: any) => {
      handleError(e.detail);
    };
    window.addEventListener('app-error', errorListener);

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          // Ensure user doc exists
          const userRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDocFromServer(userRef);
          if (!userDoc.exists()) {
            await setDoc(userRef, {
              uid: firebaseUser.uid,
              displayName: firebaseUser.displayName || 'Anonymous',
              email: firebaseUser.email || '',
              photoURL: firebaseUser.photoURL || '',
              role: 'user'
            });
          }
        } catch (e) {
          handleError(e);
          handleFirestoreError(e, OperationType.WRITE, `users/${firebaseUser.uid}`);
        }
      }
      setLoading(false);
    });

    const q = query(collection(db, 'tournaments'), orderBy('createdAt', 'desc'));
    const unsubscribeTournaments = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tournament));
      setTournaments(docs);
    }, (error) => {
      handleError(error);
      handleFirestoreError(error, OperationType.GET, 'tournaments');
    });

    (window as any).triggerCreateTournament = () => setView('create-tournament');

    // Handle join logic
    const params = new URLSearchParams(window.location.search);
    const joinT = params.get('join');
    const tourneyT = params.get('t');
    if (joinT && tourneyT) {
      setJoinData({ teamId: joinT, tournamentId: tourneyT });
      setView('join-team');
    }

    return () => {
      window.removeEventListener('app-error', errorListener);
      unsubscribeAuth();
      unsubscribeTournaments();
    };
  }, []);

  const login = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (e) {
      handleError(e);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setView('home');
    } catch (e) {
      handleError(e);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <Zap className="w-12 h-12 text-emerald-500" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans overflow-x-hidden">
      <AnimatePresence>
        {globalError && (
          <motion.div 
            key="global-error"
            initial={{ opacity: 0, y: -100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -100 }}
            className="fixed top-4 left-4 right-4 z-[1000] flex justify-center pointer-events-none"
          >
            <div className="bg-red-500 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 pointer-events-auto border-2 border-white/20 max-w-xl">
              <Zap className="w-5 h-5 flex-shrink-0 animate-pulse" />
              <p className="font-bold flex-1">{globalError}</p>
              <button onClick={clearError} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        )}
        {globalMessage && (
          <motion.div 
            key="global-message"
            initial={{ opacity: 0, y: -100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -100 }}
            className="fixed top-4 left-4 right-4 z-[1000] flex justify-center pointer-events-none"
          >
            <div className="bg-emerald-500 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 pointer-events-auto border-2 border-white/20 max-w-xl">
              <Star className="w-5 h-5 flex-shrink-0" />
              <p className="font-bold flex-1">{globalMessage}</p>
              <button onClick={clearMessage} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Navbar - Futuristic iOS Glass Design */}
      <nav className="fixed top-4 md:top-6 left-1/2 -translate-x-1/2 z-[100] w-[92%] md:w-full max-w-4xl px-4 md:px-6 h-14 md:h-16 flex items-center justify-between bg-white/60 backdrop-blur-2xl border border-white/40 rounded-[28px] md:rounded-[32px] shadow-[0_8px_32px_rgba(0,0,0,0.08)] transition-all">
        <div 
          className="flex items-center gap-2 md:gap-3 cursor-pointer group" 
          onClick={() => { setView('home'); setSelectedTournament(null); }}
        >
          <div className="bg-emerald-500 p-1.5 md:p-2 rounded-xl shadow-lg shadow-emerald-500/20 group-hover:rotate-6 transition-transform">
            <Trophy className="text-white w-4 h-4 md:w-5 md:h-5" />
          </div>
          <span className="font-black text-lg md:text-xl tracking-tighter uppercase italic">Kickivo</span>
        </div>

        <div className="flex items-center gap-1 md:gap-3">
          {user ? (
            <>
              {/* Desktop Nav */}
              <div className="hidden md:flex items-center gap-1 p-1 bg-black/5 rounded-2xl">
                {(['home', 'dashboard-tournaments', 'dashboard-teams'] as const).map((navKey) => {
                  const isActive = navKey === 'home' ? view === 'home' : (view === 'dashboard' && dashboardTab === (navKey === 'dashboard-tournaments' ? 'tournaments' : 'teams'));
                  const label = navKey === 'home' ? 'Explore' : (navKey === 'dashboard-tournaments' ? 'Tournaments' : 'Teams');
                  const Icon = navKey === 'home' ? Zap : (navKey === 'dashboard-tournaments' ? Trophy : Users);
                  
                  return (
                    <button 
                      key={navKey}
                      onClick={() => {
                        if (navKey === 'home') setView('home');
                        else {
                          setView('dashboard');
                          setDashboardTab(navKey === 'dashboard-tournaments' ? 'tournaments' : 'teams');
                        }
                      }}
                      className={`relative px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${isActive ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      {isActive && <motion.div layoutId="nav-bg" className="absolute inset-0 bg-white rounded-xl shadow-sm z-0" />}
                      <Icon className="w-3.5 h-3.5 relative z-10" />
                      <span className="relative z-10">{label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-1 ml-2">
                <button 
                  onClick={() => { setView('dashboard'); setDashboardTab('profile'); }}
                  className={`p-2 rounded-xl transition-all ${view === 'dashboard' && dashboardTab === 'profile' ? 'text-white bg-emerald-500 shadow-lg shadow-emerald-500/20' : 'text-slate-400 hover:bg-black/5'}`}
                >
                  <UserIcon className="w-5 h-5" />
                </button>
                <button onClick={logout} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </>
          ) : (
            <button 
              onClick={login}
              className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20"
            >
              <LogIn className="w-4 h-4" /> Sign In
            </button>
          )}
        </div>
      </nav>

      {/* Mobile Bottom Nav - glass design */}
      {user && (
        <nav className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-[90%] h-16 bg-white/60 backdrop-blur-2xl border border-white/40 rounded-[32px] shadow-[0_12px_40px_rgba(0,0,0,0.12)] flex items-center justify-around px-2">
          {[
            { id: 'home', icon: Zap, label: 'Explore' },
            { id: 'tournaments', icon: Trophy, label: 'Arena', tab: 'tournaments' },
            { id: 'teams', icon: Users, label: 'Teams', tab: 'teams' },
            { id: 'profile', icon: UserIcon, label: 'Me', tab: 'profile' }
          ].map((item) => {
            const isActive = item.id === 'home' ? view === 'home' : (view === 'dashboard' && dashboardTab === item.tab);
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id === 'home') setView('home');
                  else {
                    setView('dashboard');
                    setDashboardTab(item.tab as any);
                  }
                }}
                className={`relative flex flex-col items-center justify-center gap-1 w-12 h-12 rounded-2xl transition-all ${isActive ? 'text-emerald-500 scale-110' : 'text-slate-400'}`}
              >
                {isActive && <motion.div layoutId="mobile-nav-bg" className="absolute inset-0 bg-emerald-500/10 rounded-2xl z-0" />}
                <item.icon className={`w-5 h-5 relative z-10 ${isActive ? 'fill-emerald-500/20' : ''}`} />
                <span className="text-[8px] font-black uppercase tracking-tighter relative z-10">{item.label}</span>
              </button>
            );
          })}
        </nav>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 pt-24 md:pt-32 pb-24 md:pb-12 w-full overflow-x-hidden">
        <AnimatePresence mode="wait">
          {view === 'home' && (
            <motion.div key="home" className="space-y-12">
              <HomeView 
                tournaments={tournaments} 
                onSelectTournament={(t) => {
                  setSelectedTournament(t);
                  setView('tournament');
                }}
              />
              <RecruitmentBoard user={user} onError={handleError} notify={notify} />
            </motion.div>
          )}
          {view === 'tournament' && selectedTournament && (
            <motion.div key="tournament">
              <TournamentView 
                tournament={selectedTournament} 
                user={user}
                onBack={() => {
                   setView('home');
                   setSelectedTournament(null);
                }}
                onError={handleError}
                notify={notify}
              />
            </motion.div>
          )}
          {view === 'create-tournament' && (
            <motion.div key="create">
              <CreateTournamentView 
                user={user} 
                onSuccess={() => {
                  setView('home');
                  notify('Tournament created successfully!');
                }} 
                onError={handleError}
              />
            </motion.div>
          )}
          {view === 'join-team' && joinData && (
            <motion.div key="join">
              <JoinTeamView 
                teamId={joinData.teamId} 
                tournamentId={joinData.tournamentId} 
                user={user}
                onSuccess={() => {
                   setView('dashboard');
                   setDashboardTab('teams');
                   notify('Successfully joined the team!');
                   // Clear URL params
                   window.history.replaceState({}, document.title, window.location.pathname);
                }}
                onCancel={() => setView('home')}
              />
            </motion.div>
          )}
          {view === 'dashboard' && user && (
            <motion.div key="dashboard">
              <DashboardView 
                user={user} 
                initialTab={dashboardTab}
                onSelectTournament={(t) => {
                  setSelectedTournament(t);
                  setView('tournament');
                }}
                onError={handleError}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function HomeView({ tournaments, onSelectTournament }: { tournaments: Tournament[], onSelectTournament: (t: Tournament) => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-12"
    >
      <header className="space-y-4">
        <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-slate-900 leading-none">
          LOCAL HEROES,<br/>
          <span className="text-emerald-500 italic">KICKIVO STYLE.</span>
        </h1>
        <p className="text-lg text-slate-500 max-w-xl">
          Track live scores, build your player card, and join the most competitive community in amateur football.
        </p>
      </header>

      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Trophy className="w-5 h-5 text-emerald-500" />
            Active Tournaments
          </h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tournaments.length === 0 ? (
            <div className="col-span-full py-12 text-center bg-white border border-dashed border-slate-300 rounded-3xl text-slate-400 font-medium">
              No active tournaments found. Be the first to create one!
            </div>
          ) : (
            tournaments.map(t => (
              <motion.div 
                key={t.id}
                whileHover={{ y: -4 }}
                onClick={() => onSelectTournament(t)}
                className="group bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-emerald-200 transition-all cursor-pointer relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-4">
                  <div className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    t.status === 'live' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {t.status}
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center group-hover:bg-emerald-500 transition-colors">
                    <Trophy className="w-6 h-6 text-emerald-500 group-hover:text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg leading-tight">{t.name}</h3>
                    <p className="text-sm text-slate-500 line-clamp-2 mt-1">{t.description}</p>
                  </div>
                  <div className="flex items-center justify-between pt-4 border-top border-slate-100">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t.type}</span>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-500" />
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </section>
    </motion.div>
  );
}

function CreateTournamentView({ user, onSuccess, onError }: { user: FirebaseUser | null, onSuccess: () => void, onError: (err: any) => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<Tournament['type']>('league');
  const [numberOfGroups, setNumberOfGroups] = useState(2);
  const [advancingPerGroup, setAdvancingPerGroup] = useState(2);
  const [maxTeams, setMaxTeams] = useState(8);
  const [useDemoData, setUseDemoData] = useState(false);
  const [demoTeamsCount, setDemoTeamsCount] = useState(4);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const docRef = await addDoc(collection(db, 'tournaments'), {
        name,
        description,
        type,
        numberOfGroups: type === 'league_playoff' ? numberOfGroups : null,
        advancingPerGroup: type === 'league_playoff' ? advancingPerGroup : null,
        maxTeams: Number(maxTeams),
        creatorId: user.uid,
        status: 'upcoming',
        createdAt: new Date().toISOString()
      });

      if (useDemoData) {
        // Create demo teams with recognizable names
        const pool = ['Real Madrid', 'FC Barcelona', 'Manchester City', 'Liverpool FC', 'Arsenal', 'Chelsea', 'PSG', 'Bayern Munich', 'Juventus', 'AC Milan'];
        const shortNames: Record<string, string> = {
          'Real Madrid': 'RM',
          'FC Barcelona': 'FCB',
          'Manchester City': 'MC',
          'Liverpool FC': 'LFC',
          'Arsenal': 'ARS',
          'Chelsea': 'CHE',
          'PSG': 'PSG',
          'Bayern Munich': 'BM',
          'Juventus': 'JUV',
          'AC Milan': 'ACM'
        };
        
        const actualTeamsCount = Math.min(Number(demoTeamsCount), Number(maxTeams));
        for (let tIdx = 0; tIdx < actualTeamsCount; tIdx++) {
          const teamName = pool[tIdx % pool.length] + (tIdx >= pool.length ? ` ${Math.floor(tIdx / pool.length) + 1}` : '');
          const teamRef = await addDoc(collection(db, `tournaments/${docRef.id}/teams`), {
            name: teamName,
            createdAt: serverTimestamp(),
          });

          // Add 12 players per team
          const positions = ['GK', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'FWD', 'FWD', 'SUB', 'SUB', 'SUB'];
          const sn = shortNames[pool[tIdx % pool.length]] || teamName.split(' ').map(w => w[0]).join('').toUpperCase();
          for (let i = 1; i <= 12; i++) {
            await addDoc(collection(db, `tournaments/${docRef.id}/teams/${teamRef.id}/players`), {
              name: `${sn} Player ${i}`,
              number: i,
              position: positions[(i-1) % positions.length],
              tournamentId: docRef.id,
              teamId: teamRef.id,
              createdAt: serverTimestamp(),
            });
          }
        }
      }

      onSuccess();
    } catch (err) {
      onError(err);
      handleFirestoreError(err, OperationType.WRITE, 'tournaments');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-2xl mx-auto bg-white p-8 md:p-12 rounded-3xl shadow-xl border border-slate-100"
    >
      <div className="space-y-2 mb-8">
        <h2 className="text-3xl font-black tracking-tight">Host Tournament</h2>
        <p className="text-slate-500 font-medium">Create a new arena for the local talent to shine.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Tournament Name</label>
          <input 
            required
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full bg-slate-50 px-5 py-4 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
            placeholder="e.g. City Champions Trophy"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-widest text-slate-400">About</label>
          <textarea 
            required
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="w-full bg-slate-50 px-5 py-4 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium h-32"
            placeholder="Tell us about the tournament, eligibility, rules..."
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Tournament Type</label>
            <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-200">
              <button 
                type="button"
                onClick={() => setType('league')}
                className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${type === 'league' ? 'bg-white shadow-sm text-emerald-500' : 'text-slate-400'}`}
              >
                League
              </button>
              <button 
                type="button"
                onClick={() => setType('knockout')}
                className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${type === 'knockout' ? 'bg-white shadow-sm text-emerald-500' : 'text-slate-400'}`}
              >
                Knockout
              </button>
              <button 
                type="button"
                onClick={() => setType('league_playoff')}
                className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${type === 'league_playoff' ? 'bg-white shadow-sm text-emerald-500' : 'text-slate-400'}`}
              >
                Mixed
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Total Teams</label>
            <input 
              type="number"
              required
              min="2"
              max="64"
              value={maxTeams}
              onChange={e => {
                const val = e.target.value;
                if (val === "") {
                  setMaxTeams("" as any);
                } else {
                  const num = parseInt(val);
                  if (!isNaN(num)) setMaxTeams(num);
                }
              }}
              className="w-full bg-slate-50 px-5 py-4 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              placeholder="e.g. 8"
            />
          </div>
        </div>

        {type === 'league_playoff' && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100"
          >
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Number of Groups</label>
              <select 
                value={numberOfGroups}
                onChange={e => setNumberOfGroups(Number(e.target.value))}
                className="w-full bg-slate-50 px-5 py-4 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              >
                {[2, 4, 8].map(n => <option key={n} value={n}>{n} Groups</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Advancing per Group</label>
              <select 
                value={advancingPerGroup}
                onChange={e => setAdvancingPerGroup(Number(e.target.value))}
                className="w-full bg-slate-50 px-5 py-4 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              >
                {[1, 2, 4].map(n => <option key={n} value={n}>Top {n} Teams</option>)}
              </select>
            </div>
          </motion.div>
        )}
        <div className="space-y-4 p-5 bg-slate-50 rounded-2xl border border-slate-200">
          <div className="flex items-center gap-3">
            <input 
              type="checkbox"
              id="demo-data"
              checked={useDemoData}
              onChange={e => setUseDemoData(e.target.checked)}
              className="w-5 h-5 accent-emerald-500 cursor-pointer"
            />
            <label htmlFor="demo-data" className="text-sm font-bold text-slate-700 cursor-pointer flex-1">
              Create with Demo Data <span className="text-[10px] text-red-500 uppercase tracking-tighter ml-1">(Testing Feature)</span>
              <p className="text-[10px] text-slate-400 font-medium">Generates teams and 12 players per team automatically.</p>
            </label>
          </div>
          
          {useDemoData && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-2 pt-4 border-t border-slate-200"
            >
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Number of Demo Teams</label>
              <div className="flex items-center gap-4">
                <input 
                  type="range"
                  min="2"
                  max={maxTeams || 32}
                  value={demoTeamsCount}
                  onChange={e => setDemoTeamsCount(Number(e.target.value))}
                  className="flex-1 accent-emerald-500"
                />
                <span className="text-lg font-black text-emerald-500 w-8">{demoTeamsCount}</span>
              </div>
              <p className="text-[10px] text-slate-400 italic">Limited by "Total Teams" setting above.</p>
            </motion.div>
          )}
        </div>

        <button 
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-emerald-500 text-white font-bold py-5 rounded-2xl shadow-lg hover:bg-emerald-600 transition-all hover:scale-[1.02] active:scale-100 disabled:opacity-50"
        >
          {isSubmitting ? 'Architecting...' : 'Create Tournament'}
        </button>
      </form>
    </motion.div>
  );
}

function TournamentView({ tournament, user, onBack, onError, notify }: { tournament: Tournament, user: FirebaseUser | null, onBack: () => void, onError: (err: any) => void, notify: (msg: string) => void }) {
  const [activeTab, setActiveTab] = useState<'matches' | 'teams' | 'standings' | 'scorers'>('matches');
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [showAddTeam, setShowAddTeam] = useState(false);
  const [showAddMatch, setShowAddMatch] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const teamsQ = query(collection(db, `/tournaments/${tournament.id}/teams`));
    const unsubscribeTeams = onSnapshot(teamsQ, (s) => {
      setTeams(s.docs.map(d => ({ id: d.id, ...d.data() } as Team)));
    }, (err) => {
      onError(err);
      handleFirestoreError(err, OperationType.GET, 'teams');
    });

    const matchesQ = query(collection(db, `/tournaments/${tournament.id}/matches`));
    const unsubscribeMatches = onSnapshot(matchesQ, (s) => {
      setMatches(s.docs.map(d => ({ id: d.id, ...d.data() } as Match)));
    }, (err) => {
      onError(err);
      handleFirestoreError(err, OperationType.GET, 'matches');
    });

    const eventsQ = query(collectionGroup(db, 'events'), where('matchId', 'in', matches.length > 0 ? matches.map(m => m.id) : ['placeholder']));
    // Simplified: in a larger app, fetch events per match or store aggregated stats.
    // for this prototype, we'll fetch all tournament events manually for the Golden Boot.
    // Real-time Golden Boot updates
    const q = query(collectionGroup(db, 'events'), where('tournamentId', '==', tournament.id));
    const unsubscribeEvents = onSnapshot(q, (s) => {
      setEvents(s.docs.map(d => ({ id: d.id, ...d.data() } as MatchEvent)));
    }, (err) => {
      onError(err);
      handleFirestoreError(err, OperationType.GET, 'events');
    });

    const playersQ = query(collectionGroup(db, 'players'), where('tournamentId', '==', tournament.id));
    const unsubscribePlayers = onSnapshot(playersQ, (s) => {
      setAllPlayers(s.docs.map(d => ({ 
        id: d.id, 
        tournamentId: tournament.id,
        ...d.data() 
      } as Player)));
    }, (err) => {
      // Don't fail the whole view if players fetch fails (maybe old data missing tournamentId)
      console.warn("Failed to fetch all players for Golden Boot:", err);
    });

    return () => {
      unsubscribeMatches();
      unsubscribeTeams();
      unsubscribeEvents();
      unsubscribePlayers();
    };
  }, [tournament.id]);

  const generateAutoSchedule = async () => {
    if (teams.length < 2) return onError('Need at least 2 teams to schedule');
    setIsGenerating(true);
    try {
      if (tournament.type === 'league_playoff') {
        const numGroups = tournament.numberOfGroups || 2;
        const shuffledTeams = [...teams].sort(() => Math.random() - 0.5);
        
        // Assign teams to groups
        for (let i = 0; i < shuffledTeams.length; i++) {
          const groupIndex = i % numGroups;
          const groupChar = String.fromCharCode(65 + groupIndex);
          const groupName = `Group ${groupChar}`;
          const teamRef = doc(db, `/tournaments/${tournament.id}/teams/${shuffledTeams[i].id}`);
          await updateDoc(teamRef, { group: groupName });
          
          // Update local state copy for the next loop
          shuffledTeams[i] = { ...shuffledTeams[i], group: groupName };
        }

        // Generate round robin for each group
        for (let g = 0; g < numGroups; g++) {
          const groupChar = String.fromCharCode(65 + g);
          const groupName = `Group ${groupChar}`;
          const groupTeams = shuffledTeams.filter(t => t.group === groupName);
          
          for (let i = 0; i < groupTeams.length; i++) {
            for (let j = i + 1; j < groupTeams.length; j++) {
              await addDoc(collection(db, `/tournaments/${tournament.id}/matches`), {
                teamAId: groupTeams[i].id,
                teamBId: groupTeams[j].id,
                scoreA: 0,
                scoreB: 0,
                status: 'scheduled',
                tournamentId: tournament.id,
                group: groupName,
                createdAt: serverTimestamp()
              });
            }
          }
        }
      } else {
        // Simple Round Robin
        for (let i = 0; i < teams.length; i++) {
          for (let j = i + 1; j < teams.length; j++) {
            await addDoc(collection(db, `/tournaments/${tournament.id}/matches`), {
              teamAId: teams[i].id,
              teamBId: teams[j].id,
              scoreA: 0,
              scoreB: 0,
              status: 'scheduled',
              tournamentId: tournament.id,
              createdAt: serverTimestamp()
            });
          }
        }
      }
      notify('Fixtures generated successfully!');
    } catch (err) {
      onError(err);
      handleFirestoreError(err, OperationType.WRITE, 'matches');
    } finally {
      setIsGenerating(false);
    }
  };

  const startPlayoffs = async () => {
    if (matches.some(m => m.group === 'Playoffs')) return onError('Playoffs already generated');
    const numAdvancing = tournament.advancingPerGroup || 2;
    const numGroups = tournament.numberOfGroups || 2;
    
    // Group winners and runner-ups
    const qualified: { [group: string]: Team[] } = {};
    for (let i = 0; i < numGroups; i++) {
        const groupChar = String.fromCharCode(65 + i);
        const groupName = `Group ${groupChar}`;
        const s = getStandingsForGroup(groupName);
        qualified[groupName] = s.slice(0, numAdvancing);
    }

    const advancingTeams = Object.values(qualified).flat();
    if (advancingTeams.length < 2) return onError('Not enough teams qualified for playoffs');

    setIsGenerating(true);
    try {
        // Cross-group pairing if possible
        if (numGroups === 2 && numAdvancing >= 1) {
            const groupA = qualified['Group A'] || [];
            const groupB = qualified['Group B'] || [];
            if (groupA[0] && groupB[1]) {
                await addDoc(collection(db, `/tournaments/${tournament.id}/matches`), {
                    teamAId: groupA[0].id,
                    teamBId: groupB[1].id,
                    scoreA: 0, scoreB: 0, status: 'scheduled', tournamentId: tournament.id, group: 'Playoffs', createdAt: serverTimestamp()
                });
            }
            if (groupB[0] && groupA[1]) {
                await addDoc(collection(db, `/tournaments/${tournament.id}/matches`), {
                    teamAId: groupB[0].id,
                    teamBId: groupA[1].id,
                    scoreA: 0, scoreB: 0, status: 'scheduled', tournamentId: tournament.id, group: 'Playoffs', createdAt: serverTimestamp()
                });
            }
        } else {
            // Generic sequential pairing
            for (let i = 0; i < advancingTeams.length; i += 2) {
                if (advancingTeams[i+1]) {
                    await addDoc(collection(db, `/tournaments/${tournament.id}/matches`), {
                        teamAId: advancingTeams[i].id,
                        teamBId: advancingTeams[i+1].id,
                        scoreA: 0, scoreB: 0, status: 'scheduled', tournamentId: tournament.id, group: 'Playoffs', createdAt: serverTimestamp()
                    });
                }
            }
        }
        notify('Playoff fixtures generated!');
    } catch (err) {
        onError(err);
        handleFirestoreError(err, OperationType.WRITE, 'matches');
    } finally {
        setIsGenerating(false);
    }
  };

  const isCreator = user?.uid === tournament.creatorId;

  const [isDeleting, setIsDeleting] = useState(false);

  const deleteTournament = async () => {
    if (!isDeleting) {
      setIsDeleting(true);
      setTimeout(() => setIsDeleting(false), 3000); // Reset after 3s
      return;
    }
    
    try {
      await deleteDoc(doc(db, 'tournaments', tournament.id));
      onBack();
    } catch (err) {
      onError(err);
      handleFirestoreError(err, OperationType.DELETE, `tournaments/${tournament.id}`);
    }
  };

  if (selectedMatch) {
    return (
      <MatchScoringView 
        tournament={tournament}
        match={selectedMatch} 
        teams={teams}
        onBack={() => setSelectedMatch(null)}
        isCreator={isCreator}
        notify={notify}
      />
    );
  }

  if (selectedTeam) {
    return (
      <TeamDetailView 
        tournament={tournament}
        team={selectedTeam}
        onBack={() => setSelectedTeam(null)}
        isCreator={isCreator}
      />
    );
  }

  const getStandingsForGroup = (groupName?: string) => {
    const filteredTeams = groupName ? teams.filter(t => t.group === groupName) : teams;
    return filteredTeams.map(team => {
      // Exclude playoff matches from standings calculation
      const teamMatches = matches.filter(m => 
        m.status === 'finished' && 
        m.group !== 'Playoffs' && 
        (m.teamAId === team.id || m.teamBId === team.id)
      );
      let played = teamMatches.length;
      let won = 0, drawn = 0, lost = 0, gf = 0, ga = 0;

      teamMatches.forEach(m => {
        const isTeamA = m.teamAId === team.id;
        const score = isTeamA ? m.scoreA : m.scoreB;
        const oppScore = isTeamA ? m.scoreB : m.scoreA;
        gf += score;
        ga += oppScore;
        if (score > oppScore) won++;
        else if (score < oppScore) lost++;
        else drawn++;
      });

      return {
        ...team,
        played, won, drawn, lost, gf, ga,
        gd: gf - ga,
        points: (won * 3) + (drawn * 1)
      };
    }).sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className={`px-3 py-1 rounded-full text-[10px] font-black text-white uppercase tracking-wider ${
              tournament.status === 'live' ? 'bg-emerald-500' : 'bg-slate-500'
            }`}>
              {tournament.status}
            </div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">{tournament.type}</div>
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter leading-none">{tournament.name}</h1>
          <p className="text-slate-500 font-medium max-w-2xl">{tournament.description}</p>
        </div>

        {isCreator && (
          <div className="flex gap-2 flex-wrap">
            {matches.length === 0 && (
              <button 
                onClick={generateAutoSchedule}
                disabled={isGenerating}
                className="px-4 py-2 bg-slate-900 text-white rounded-full text-sm font-bold flex items-center gap-2 hover:bg-slate-800 transition-all shadow-sm disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} /> Auto-Fixtures
              </button>
            )}
            {tournament.type === 'league_playoff' && matches.length > 0 && !matches.some(m => m.group === 'Playoffs') && matches.filter(m => m.group !== 'Playoffs').every(m => m.status === 'finished') && (
              <button 
                onClick={startPlayoffs}
                disabled={isGenerating}
                className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-full text-sm font-bold flex items-center gap-2 hover:bg-emerald-100 transition-all border border-emerald-200 shadow-sm disabled:opacity-50"
              >
                <Trophy className="w-4 h-4" /> Start Playoffs
              </button>
            )}
            <button 
              onClick={() => setShowAddTeam(true)}
              className="px-4 py-2 bg-white border border-slate-200 rounded-full text-sm font-bold flex items-center gap-2 hover:bg-slate-50 transition-colors shadow-sm"
            >
              <Users className="w-4 h-4" /> Add Team
            </button>
            <button 
              onClick={() => setShowAddMatch(true)}
              className="px-4 py-2 bg-emerald-500 text-white rounded-full text-sm font-bold flex items-center gap-2 hover:bg-emerald-600 transition-all shadow-lg"
            >
              <Calendar className="w-4 h-4" /> Schedule Match
            </button>
            <button 
              onClick={deleteTournament}
              className={`p-2 transition-all flex items-center gap-2 font-bold text-[10px] uppercase tracking-widest group rounded-lg ${
                isDeleting ? 'bg-red-500 text-white shadow-lg animate-pulse' : 'text-slate-300 hover:text-red-500'
              }`}
              title={isDeleting ? 'Click again to confirm delete' : 'Delete Tournament'}
            >
              <Trash2 className={`w-4 h-4 ${isDeleting ? 'text-white' : 'text-slate-300 group-hover:text-red-500'} transition-colors`} />
              <span className="hidden md:inline">{isDeleting ? 'Confirm Delete' : 'Delete Tournament'}</span>
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 md:gap-8 border-b border-slate-200 overflow-x-auto scrollbar-hide no-scrollbar pt-2">
        {(['matches', 'teams', 'standings', 'stats'] as const).map(tab => (
          <button 
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-4 text-xs md:text-sm font-bold uppercase tracking-wider transition-all relative whitespace-nowrap ${
              activeTab === tab ? 'text-emerald-500' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            {tab === 'stats' ? 'Leaderboards' : tab}
            {activeTab === tab && (
              <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500 rounded-full" />
            )}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'matches' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -10 }}
            className="space-y-8"
          >
            {matches.length === 0 ? (
              <div className="py-20 text-center font-bold text-slate-300 uppercase tracking-widest bg-white rounded-3xl border border-slate-100 italic">
                No matches scheduled yet
              </div>
            ) : (
              Object.entries(
                matches.reduce((acc, m) => {
                  const group = m.group || 'Regular Season';
                  if (!acc[group]) acc[group] = [];
                  acc[group].push(m);
                  return acc;
                }, {} as { [key: string]: Match[] })
              ).sort(([a], [b]) => a === 'Playoffs' ? 1 : b === 'Playoffs' ? -1 : a.localeCompare(b)).map(([group, groupMatches]) => {
                const matchesList = groupMatches as Match[];
                return (
                <div key={group} className="space-y-4">
                  {tournament.type === 'league_playoff' && (
                    <div className="flex items-center gap-3 px-2">
                       <div className="h-[2px] flex-1 bg-slate-100" />
                       <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                        {group}
                       </h3>
                       <div className="h-[2px] flex-1 bg-slate-100" />
                    </div>
                  )}
                    <div className="space-y-2">
                      {matchesList.map(m => {
                        const teamA = teams.find(t => t.id === m.teamAId);
                        const teamB = teams.find(t => t.id === m.teamBId);
                        const isFinished = m.status === 'finished';
                        const winnerA = isFinished && m.scoreA > m.scoreB;
                        const winnerB = isFinished && m.scoreB > m.scoreA;
                        
                        const formatTeamName = (name: string) => {
                          if (!name) return '';
                          if (name.length <= 10) return name;
                          const parts = name.split(' ');
                          if (parts.length > 1) {
                            return `${parts[0].charAt(0)}. ${parts.slice(1).join(' ')}`;
                          }
                          return name;
                        };

                        return (
                          <div 
                            key={m.id} 
                            onClick={() => setSelectedMatch(m)}
                            className="bg-white px-3 md:px-4 py-4 rounded-2xl border border-slate-100 flex items-center group hover:border-emerald-400 transition-all shadow-sm hover:shadow-md cursor-pointer"
                          >
                            {/* Status Section */}
                            <div className="w-8 md:w-10 text-center border-r border-slate-100 pr-1 mr-1 shrink-0 flex items-center justify-center">
                              <span className={`text-[9px] md:text-[10px] font-black uppercase tracking-tighter ${
                                isFinished ? 'text-slate-400' : m.status === 'live' ? 'text-emerald-500 animate-pulse' : 'text-slate-300'
                              }`}>
                                {isFinished ? 'FT' : m.status === 'live' ? 'Live' : m.status === 'scheduled' ? 'vs' : m.status}
                              </span>
                            </div>

                            {/* Teams Grid */}
                            <div className="flex-1 flex items-center justify-between text-xs md:text-base min-w-0">
                              {/* Team A */}
                              <div className="flex-1 flex items-center justify-end gap-1 md:gap-3 pr-1 md:pr-2 min-w-0">
                                <span className={`font-bold truncate transition-colors text-[10px] sm:text-sm md:text-base ${winnerA ? 'text-emerald-500' : 'text-slate-900'}`}>{formatTeamName(teamA?.name || '')}</span>
                                {teamA?.logoURL ? (
                                  <img src={teamA.logoURL} className="w-4 h-4 md:w-6 md:h-6 object-cover rounded-full bg-slate-50 shrink-0" alt="" />
                                ) : (
                                  <div className="w-4 h-4 md:w-6 md:h-6 rounded-full bg-slate-50 flex items-center justify-center text-[7px] md:text-[10px] font-black text-slate-300 shrink-0 border border-slate-100">{teamA?.name?.charAt(0)}</div>
                                )}
                              </div>

                              {/* Score Center */}
                              <div className="shrink-0 px-1.5 md:px-3 flex items-center gap-1 md:gap-2 bg-slate-50 rounded-lg md:rounded-xl py-1 md:py-1.5 min-w-[40px] md:min-w-[60px] justify-center border border-slate-100 shadow-inner">
                                {m.status === 'scheduled' ? (
                                  <span className="text-[8px] md:text-[10px] font-black text-slate-300 uppercase tracking-widest">VS</span>
                                ) : (
                                  <>
                                    <span className={`font-black tabular-nums text-xs md:text-lg ${winnerA ? 'text-emerald-500' : 'text-slate-900'}`}>{m.scoreA}</span>
                                    <span className="text-slate-300 font-bold">-</span>
                                    <span className={`font-black tabular-nums text-xs md:text-lg ${winnerB ? 'text-emerald-500' : 'text-slate-900'}`}>{m.scoreB}</span>
                                  </>
                                )}
                              </div>

                              {/* Team B */}
                              <div className="flex-1 flex items-center justify-start gap-1 md:gap-3 pl-1 md:pl-2 min-w-0">
                                {teamB?.logoURL ? (
                                  <img src={teamB.logoURL} className="w-4 h-4 md:w-6 md:h-6 object-cover rounded-full bg-slate-50 shrink-0" alt="" />
                                ) : (
                                  <div className="w-4 h-4 md:w-6 md:h-6 rounded-full bg-slate-50 flex items-center justify-center text-[7px] md:text-[10px] font-black text-slate-300 shrink-0 border border-slate-100">{teamB?.name?.charAt(0)}</div>
                                )}
                                <span className={`font-bold truncate transition-colors text-[10px] sm:text-sm md:text-base ${winnerB ? 'text-emerald-500' : 'text-slate-900'}`}>{formatTeamName(teamB?.name || '')}</span>
                              </div>
                            </div>
                            
                            <div className="ml-2 md:ml-4 flex items-center justify-center shrink-0">
                                <ChevronRight className="w-3 h-3 md:w-4 md:h-4 text-slate-200 group-hover:text-emerald-500 transition-all" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                </div>
              );
              })
            )}
          </motion.div>
        )}

        {activeTab === 'teams' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6"
          >
            {teams.length === 0 ? (
              <div className="col-span-full py-20 text-center font-bold text-slate-300 uppercase tracking-widest">Join as the first team!</div>
            ) : (
              teams.map(t => (
                <div 
                  key={t.id} 
                  className="relative group cursor-pointer"
                >
                  {isCreator && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Delete ${t.name}?`)) {
                          deleteDoc(doc(db, `tournaments/${tournament.id}/teams/${t.id}`));
                        }
                      }}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow-lg"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                  <div 
                    onClick={() => setSelectedTeam(t)}
                    className="aspect-square bg-white border border-slate-200 rounded-3xl p-6 flex flex-col items-center justify-center gap-4 text-center group-hover:border-emerald-200 transition-all shadow-sm h-full"
                  >
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100 group-hover:bg-emerald-50 transition-colors mb-2 overflow-hidden">
                      {t.logoURL ? (
                        <img src={t.logoURL} alt={t.name} className="w-full h-full object-cover" />
                      ) : (
                        <Users className="w-8 h-8 text-slate-300 group-hover:text-emerald-500" />
                      )}
                    </div>
                    <span className="font-black text-sm uppercase tracking-tight">{t.name}</span>
                  </div>
                </div>
              ))
            )}
          </motion.div>
        )}

        {activeTab === 'standings' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -10 }}
            className="space-y-8"
          >
            {(tournament.type === 'league_playoff' ? Array.from({ length: tournament.numberOfGroups || 0 }).map((_, i) => `Group ${String.fromCharCode(65 + i)}`) : [undefined]).map((group) => {
              const groupStandings = getStandingsForGroup(group);
              return (
                <div key={group || 'All'} className="space-y-4">
                  {group && <h3 className="text-xl font-black">{group}</h3>}
                  <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto scrollbar-hide">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="px-3 md:px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Pos</th>
                            <th className="px-3 md:px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Team</th>
                            <th className="px-2 md:px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">P</th>
                            <th className="hidden sm:table-cell px-2 md:px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">W</th>
                            <th className="hidden sm:table-cell px-2 md:px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">D</th>
                            <th className="hidden sm:table-cell px-2 md:px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">L</th>
                            <th className="px-2 md:px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">GD</th>
                            <th className="px-3 md:px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Pts</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {groupStandings.map((s, idx) => (
                            <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-3 md:px-6 py-5 font-black text-slate-400">
                                <span className={idx === 0 ? 'text-emerald-500 font-black' : ''}>{idx + 1}</span>
                              </td>
                              <td className="px-3 md:px-6 py-5 font-black min-w-[120px]">
                                <div className="flex items-center gap-2 md:gap-3">
                                  {s.logoURL ? (
                                    <img src={s.logoURL} className="w-5 h-5 md:w-6 md:h-6 object-cover rounded-full" alt="" />
                                  ) : (
                                    <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-slate-100 flex items-center justify-center text-[7px] md:text-[8px] border border-slate-200 text-slate-400 shrink-0">{s.name.charAt(0)}</div>
                                  )}
                                  <span className={`truncate ${idx === 0 ? 'text-emerald-600' : ''}`}>{s.name}</span>
                                </div>
                              </td>
                              <td className="px-2 md:px-6 py-5 text-center font-bold">{s.played}</td>
                              <td className="hidden sm:table-cell px-2 md:px-6 py-5 text-center font-medium">{s.won}</td>
                              <td className="hidden sm:table-cell px-2 md:px-6 py-5 text-center font-medium">{s.drawn}</td>
                              <td className="hidden sm:table-cell px-2 md:px-6 py-5 text-center font-medium">{s.lost}</td>
                              <td className="px-2 md:px-6 py-5 text-center font-bold text-emerald-500 text-xs md:text-base">{s.gd > 0 ? `+${s.gd}` : s.gd}</td>
                              <td className="px-3 md:px-6 py-5 text-center">
                                <span className="bg-emerald-500 text-white px-2 md:px-3 py-1 rounded-lg font-black text-xs md:text-sm">{s.points}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })}
          </motion.div>
        )}
        {activeTab === 'stats' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="space-y-12"
          >
            {/* Top Scorers - Golden Boot */}
            <section className="space-y-4">
              <div className="flex items-center gap-3 px-2">
                <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <SoccerIcon className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-xl font-black uppercase tracking-tighter">Golden Boot</h3>
              </div>
              <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto scrollbar-hide">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Rank</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Player</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Goals</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {Array.from(new Set(events.filter(e => e.type === 'goal' && e.goalType !== 'own_goal').map(e => e.playerId)))
                        .map((pid) => {
                          const player = allPlayers.find(p => p.id === pid);
                          const goals = events.filter(e => e.type === 'goal' && e.goalType !== 'own_goal' && e.playerId === pid).length;
                          return { pid, name: player?.name || 'Unknown', goals };
                        })
                        .filter(p => p.goals > 0 && p.name !== 'Unknown')
                        .sort((a, b) => b.goals - a.goals)
                        .slice(0, 10)
                        .map((p, idx) => (
                          <tr key={p.pid} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-5 font-black text-slate-400">{idx + 1}</td>
                            <td className="px-6 py-5 font-black text-slate-700">{p.name.split(' (')[0].split(' #')[0]}</td>
                            <td className="px-6 py-5 text-center">
                              <span className="bg-emerald-500 text-white px-3 py-1 rounded-lg font-black text-sm">{p.goals}</span>
                            </td>
                          </tr>
                        ))}
                      {events.filter(e => e.type === 'goal' && e.goalType !== 'own_goal').length === 0 && (
                        <tr><td colSpan={3} className="px-6 py-20 text-center text-slate-300 font-bold italic">No goals yet</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            {/* Top Assists */}
            <section className="space-y-4">
              <div className="flex items-center gap-3 px-2">
                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <Footprints className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-xl font-black uppercase tracking-tighter">Playmakers</h3>
              </div>
              <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto scrollbar-hide">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Rank</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Player</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Assists</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {Array.from(new Set(events.filter(e => e.type === 'goal' && e.assistantId).map(e => e.assistantId!)))
                        .map((aid) => {
                          const player = allPlayers.find(p => p.id === aid);
                          const assists = events.filter(e => e.type === 'goal' && e.assistantId === aid).length;
                          return { aid, name: player?.name || 'Unknown', assists };
                        })
                        .filter(p => p.assists > 0 && p.name !== 'Unknown')
                        .sort((a, b) => b.assists - a.assists)
                        .slice(0, 10)
                        .map((p, idx) => (
                          <tr key={p.aid} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-5 font-black text-slate-400">{idx + 1}</td>
                            <td className="px-6 py-5 font-black text-slate-700">{p.name.split(' (')[0].split(' #')[0]}</td>
                            <td className="px-6 py-5 text-center">
                              <span className="bg-blue-500 text-white px-3 py-1 rounded-lg font-black text-sm">{p.assists}</span>
                            </td>
                          </tr>
                        ))}
                      {events.filter(e => e.type === 'goal' && e.assistantId).length === 0 && (
                        <tr><td colSpan={3} className="px-6 py-20 text-center text-slate-300 font-bold italic">No assists yet</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Yellow Cards */}
              <section className="space-y-4">
                <div className="flex items-center gap-3 px-2">
                  <div className="w-6 h-8 bg-yellow-400 rounded-sm shadow-md" />
                  <h3 className="text-xl font-black uppercase tracking-tighter">Yellow Cards</h3>
                </div>
                <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Player</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Qty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {Array.from(new Set(events.filter(e => e.type === 'yellow_card').map(e => e.playerId)))
                        .map((pid) => {
                          const player = allPlayers.find(p => p.id === pid);
                          const count = events.filter(e => e.type === 'yellow_card' && e.playerId === pid).length;
                          return { pid, name: player?.name || 'Unknown', count };
                        })
                        .filter(p => p.count > 0 && p.name !== 'Unknown')
                        .sort((a, b) => b.count - a.count)
                        .map((p) => (
                          <tr key={p.pid} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-5 font-black text-slate-700 text-sm">{p.name.split(' (')[0].split(' #')[0]}</td>
                            <td className="px-6 py-5 text-center font-black text-yellow-600">{p.count}</td>
                          </tr>
                        ))}
                      {events.filter(e => e.type === 'yellow_card').length === 0 && (
                        <tr><td colSpan={2} className="px-6 py-10 text-center text-slate-300 font-bold italic text-xs">No cards</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Red Cards */}
              <section className="space-y-4">
                <div className="flex items-center gap-3 px-2">
                  <div className="w-6 h-8 bg-red-500 rounded-sm shadow-md" />
                  <h3 className="text-xl font-black uppercase tracking-tighter">Red Cards</h3>
                </div>
                <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Player</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Qty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {Array.from(new Set(events.filter(e => e.type === 'red_card').map(e => e.playerId)))
                        .map((pid) => {
                          const player = allPlayers.find(p => p.id === pid);
                          const count = events.filter(e => e.type === 'red_card' && e.playerId === pid).length;
                          return { pid, name: player?.name || 'Unknown', count };
                        })
                        .filter(p => p.count > 0 && p.name !== 'Unknown')
                        .sort((a, b) => b.count - a.count)
                        .map((p) => (
                          <tr key={p.pid} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-5 font-black text-slate-700 text-sm">{p.name.split(' (')[0].split(' #')[0]}</td>
                            <td className="px-6 py-5 text-center font-black text-red-600">{p.count}</td>
                          </tr>
                        ))}
                      {events.filter(e => e.type === 'red_card').length === 0 && (
                        <tr><td colSpan={2} className="px-6 py-10 text-center text-slate-300 font-bold italic text-xs">No red cards</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAddTeam && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowAddTeam(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl"
            >
              <button onClick={() => setShowAddTeam(false)} className="absolute right-6 top-6 p-2 text-slate-300 hover:text-slate-600 transition-colors"><X className="w-5 h-5" /></button>
              <h2 className="text-2xl font-black tracking-tight mb-6">Register Team</h2>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const nameInput = form.elements.namedItem('team-name') as HTMLInputElement;
                const name = nameInput.value.trim();
                const fileInput = form.elements.namedItem('team-logo') as HTMLInputElement;
                
                // Duplicate check
                if (teams.some(t => t.name.toLowerCase() === name.toLowerCase())) {
                  notify(`A team named "${name}" is already registered in this tournament.`);
                  return;
                }

                let logoURL = "";
                if (fileInput.files?.[0]) {
                  const reader = new FileReader();
                  logoURL = await new Promise((resolve) => {
                    reader.onload = () => resolve(reader.result as string);
                    reader.readAsDataURL(fileInput.files![0]);
                  });
                }

                try {
                  await addDoc(collection(db, `/tournaments/${tournament.id}/teams`), { 
                    name, 
                    logoURL,
                    tournamentId: tournament.id,
                    creatorId: user.uid,
                    createdAt: serverTimestamp()
                  });
                  setShowAddTeam(false);
                } catch (err) { handleFirestoreError(err, OperationType.WRITE, `tournaments/${tournament.id}/teams`); }
              }} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Team Name</label>
                  <input name="team-name" required className="w-full bg-slate-50 px-5 py-4 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none font-bold" placeholder="e.g. Real Madrid" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Team Icon</label>
                  <div className="relative group">
                    <input name="team-logo" type="file" accept="image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                    <div className="w-full bg-slate-50 px-5 py-8 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-2 group-hover:border-emerald-500 transition-all">
                      <Plus className="w-6 h-6 text-slate-300" />
                      <span className="text-xs font-bold text-slate-400">Upload Icon from Gallery</span>
                    </div>
                  </div>
                </div>
                <button type="submit" className="w-full bg-emerald-500 text-white font-bold py-5 rounded-2xl shadow-lg hover:bg-emerald-600 transition-all active:scale-95">Confirm Registration</button>
              </form>
            </motion.div>
          </div>
        )}

        {showAddMatch && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowAddMatch(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl"
            >
              <button onClick={() => setShowAddMatch(false)} className="absolute right-6 top-6 p-2 text-slate-300 hover:text-slate-600 transition-colors"><X className="w-5 h-5" /></button>
              <h2 className="text-2xl font-black tracking-tight mb-6">Schedule Match</h2>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const teamAId = (e.currentTarget.elements.namedItem('teamA') as HTMLSelectElement).value;
                const teamBId = (e.currentTarget.elements.namedItem('teamB') as HTMLSelectElement).value;
                if (teamAId === teamBId) return onError('Select different teams');
                try {
                  await addDoc(collection(db, `/tournaments/${tournament.id}/matches`), { 
                    teamAId, teamBId, scoreA: 0, scoreB: 0, status: 'scheduled', tournamentId: tournament.id, createdAt: serverTimestamp() 
                  });
                  setShowAddMatch(false);
                } catch (err) { handleFirestoreError(err, OperationType.WRITE, `tournaments/${tournament.id}/matches`); }
              }} className="space-y-4">
                <select name="teamA" required className="w-full bg-slate-50 px-5 py-4 rounded-2xl border border-slate-200">
                  <option value="">Select Team A</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <div className="text-center font-bold text-slate-300">VS</div>
                <select name="teamB" required className="w-full bg-slate-50 px-5 py-4 rounded-2xl border border-slate-200">
                  <option value="">Select Team B</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <button type="submit" className="w-full bg-emerald-500 text-white font-bold py-4 rounded-2xl mt-4">Create Fixture</button>
              </form>
            </motion.div>
          </div>
        )}

        {editingMatch && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setEditingMatch(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white w-full max-w-sm rounded-3xl p-8 shadow-2xl"
            >
              <button onClick={() => setEditingMatch(null)} className="absolute right-6 top-6 p-2 text-slate-300 hover:text-slate-600 transition-colors"><X className="w-5 h-5" /></button>
              <h2 className="text-2xl font-black tracking-tight mb-6">Edit Match</h2>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const scoreA = parseInt(formData.get('scoreA') as string);
                const scoreB = parseInt(formData.get('scoreB') as string);
                const status = formData.get('status') as Match['status'];
                
                try {
                  const matchRef = doc(db, `tournaments/${tournament.id}/matches/${editingMatch.id}`);
                  await updateDoc(matchRef, { scoreA, scoreB, status });
                  setEditingMatch(null);
                  notify('Match updated successfully!');
                } catch (err) { handleFirestoreError(err, OperationType.WRITE, `tournaments/${tournament.id}/matches/${editingMatch.id}`); }
              }} className="space-y-6">
                <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <div className="flex flex-col items-center flex-1">
                    <span className="text-[9px] font-black uppercase text-slate-400 mb-2 truncate max-w-[80px]">
                      {teams.find(t => t.id === editingMatch.teamAId)?.name}
                    </span>
                    <input type="number" name="scoreA" defaultValue={editingMatch.scoreA} className="w-16 h-16 text-center text-3xl font-black rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div className="px-4 font-black text-slate-300">:</div>
                  <div className="flex flex-col items-center flex-1">
                     <span className="text-[9px] font-black uppercase text-slate-400 mb-2 truncate max-w-[80px]">
                      {teams.find(t => t.id === editingMatch.teamBId)?.name}
                    </span>
                    <input type="number" name="scoreB" defaultValue={editingMatch.scoreB} className="w-16 h-16 text-center text-3xl font-black rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Match Status</label>
                  <select name="status" defaultValue={editingMatch.status} className="w-full bg-slate-50 px-5 py-4 rounded-2xl border border-slate-200 font-bold outline-none">
                    <option value="scheduled">Scheduled</option>
                    <option value="live">Live</option>
                    <option value="finished">Finished</option>
                  </select>
                </div>

                <div className="flex gap-3">
                   <button type="button" onClick={() => setEditingMatch(null)} className="flex-1 bg-slate-100 text-slate-600 font-bold py-4 rounded-2xl">Cancel</button>
                   <button type="submit" className="flex-[2] bg-emerald-500 text-white font-bold py-4 rounded-2xl shadow-lg hover:bg-emerald-600 transition-all">Update Match</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function MatchTimer({ match, isCreator, tournament }: { match: Match, isCreator: boolean, tournament: Tournament }) {
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
    if (!isCreator || !window.confirm('Reset timer to 0:00?')) return;
     const matchRef = doc(db, `tournaments/${tournament.id}/matches/${match.id}`);
     await updateDoc(matchRef, {
       isTimerRunning: false,
       elapsedTimeOnPause: 0,
       timerStartTime: null
     });
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="bg-white/10 px-8 py-3 rounded-3xl border border-white/10 flex flex-col items-center shadow-xl backdrop-blur-md">
         <span className="text-[9px] font-black uppercase tracking-[0.4em] text-white/30 mb-1">Match Time</span>
         <span className="text-5xl font-black tabular-nums font-mono text-emerald-400 tracking-tighter">{formatTime(elapsed)}</span>
      </div>
      {isCreator && match.status !== 'finished' && (
        <div className="flex gap-2">
           <button 
             onClick={toggleTimer}
             className={`p-3 rounded-2xl border transition-all shadow-lg active:scale-95 ${match.isTimerRunning ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'}`}
           >
             {match.isTimerRunning ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
           </button>
           <button 
             onClick={resetTimer}
             className="p-3 rounded-2xl bg-white/5 border border-white/10 text-white/40 hover:text-white transition-all hover:bg-white/10 active:scale-95"
             title="Reset Clock"
           >
             <RotateCcw className="w-5 h-5" />
           </button>
        </div>
      )}
    </div>
  );
}

function MatchScoringView({ tournament, match, teams, onBack, isCreator, notify }: { 
  tournament: Tournament, 
  match: Match, 
  teams: Team[], 
  onBack: () => void,
  isCreator: boolean,
  notify: (msg: string) => void 
}) {
  const [liveMatch, setLiveMatch] = useState<Match>(match);
  const [playersA, setPlayersA] = useState<Player[]>([]);
  const [playersB, setPlayersB] = useState<Player[]>([]);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [showEventModal, setShowEventModal] = useState<{ side: 'A' | 'B', type: MatchEventType, step: number, data?: any } | null>(null);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);

  const teamA = teams.find(t => t.id === match.teamAId);
  const teamB = teams.find(t => t.id === match.teamBId);

  const lastEventId = useMemo(() => {
    if (events.length === 0) return null;
    const sorted = [...events].sort((a, b) => {
      const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
      return timeB - timeA;
    });
    return sorted[0].id;
  }, [events]);

  useEffect(() => {
    const unsubMatch = onSnapshot(doc(db, `tournaments/${tournament.id}/matches/${match.id}`), (s) => {
      if (s.exists()) setLiveMatch({ id: s.id, ...s.data() } as Match);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `tournaments/${tournament.id}/matches/${match.id}`);
    });

    const unsubEvents = onSnapshot(collection(db, `tournaments/${tournament.id}/matches/${match.id}/events`), (s) => {
      setEvents(s.docs.map(d => ({ id: d.id, ...d.data() } as MatchEvent)));
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `tournaments/${tournament.id}/matches/${match.id}/events`);
    });

    const fetchPlayers = async () => {
      try {
        const qA = query(collection(db, `tournaments/${tournament.id}/teams/${match.teamAId}/players`));
        const qB = query(collection(db, `tournaments/${tournament.id}/teams/${match.teamBId}/players`));
        const [sA, sB] = await Promise.all([getDocs(qA), getDocs(qB)]);
        setPlayersA(sA.docs.map(d => ({ id: d.id, ...d.data() } as Player)));
        setPlayersB(sB.docs.map(d => ({ id: d.id, ...d.data() } as Player)));
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `players`);
      }
    };

    fetchPlayers();

    return () => {
      unsubMatch();
      unsubEvents();
    };
  }, [tournament.id, match.id, match.teamAId, match.teamBId]);

  const getMatchTime = () => {
    if (!liveMatch.isTimerRunning && (liveMatch.elapsedTimeOnPause === 0 || liveMatch.elapsedTimeOnPause === undefined)) {
      return null;
    }
    
    let seconds = liveMatch.elapsedTimeOnPause || 0;
    if (liveMatch.isTimerRunning && liveMatch.timerStartTime) {
      const startTime = liveMatch.timerStartTime.toMillis ? liveMatch.timerStartTime.toMillis() : new Date(liveMatch.timerStartTime).getTime();
      const diff = Math.floor((Date.now() - startTime) / 1000);
      seconds += diff;
    }
    
    const mins = Math.floor(seconds / 60);
    return `${mins}'`;
  };

  const addEvent = async (playerId: string, type: MatchEventType, teamId: string, metadata?: { assistantId?: string, goalType?: GoalType }) => {
    if (!isCreator) return;
    try {
      const matchRef = doc(db, `tournaments/${tournament.id}/matches/${match.id}`);
      const isTeamA = teamId === match.teamAId;
      
      const playerRecord = (isTeamA ? playersA : playersB).find(p => p.id === playerId);
      const assistantRecord = metadata?.assistantId ? (isTeamA ? playersA : playersB).find(p => p.id === metadata.assistantId) : null;

      const matchTime = getMatchTime();

      await addDoc(collection(db, `tournaments/${tournament.id}/matches/${match.id}/events`), {
        matchId: match.id,
        tournamentId: tournament.id,
        type,
        playerId,
        userId: playerRecord?.userId || null,
        assistantId: (metadata?.goalType === 'own_goal') ? null : (metadata?.assistantId || null),
        assistantUserId: (metadata?.goalType === 'own_goal') ? null : (assistantRecord?.userId || null),
        goalType: metadata?.goalType || (type === 'goal' ? 'open_goal' : null),
        teamId,
        minute: 0, 
        timestamp: matchTime,
        createdAt: serverTimestamp()
      });

      if (type === 'yellow_card') {
        const yellowCount = events.filter(e => e.playerId === playerId && e.type === 'yellow_card').length;
        if (yellowCount >= 1) { 
          await addDoc(collection(db, `tournaments/${tournament.id}/matches/${match.id}/events`), {
            matchId: match.id,
            tournamentId: tournament.id,
            type: 'red_card',
            playerId,
            teamId,
            minute: 0,
            timestamp: matchTime,
            createdAt: serverTimestamp()
          });
        }
      }

      if (type === 'goal') {
        const isOwnGoal = metadata?.goalType === 'own_goal';
        // If it's an own goal, the OPPONENT gets the point
        const teamToIncrementIsA = isOwnGoal ? !isTeamA : isTeamA;
        
        await setDoc(matchRef, {
          [teamToIncrementIsA ? 'scoreA' : 'scoreB']: (teamToIncrementIsA ? liveMatch.scoreA : liveMatch.scoreB) + 1,
          status: 'live'
        }, { merge: true });
      }
      setShowEventModal(null);
    } catch (err) {
      console.error("Add event error:", err);
      handleFirestoreError(err, OperationType.WRITE, `tournaments/${tournament.id}/matches/${match.id}/events`);
    }
  };

  const undoLastEvent = async () => {
    if (!isCreator || events.length === 0) return;
    
    // Sort events by createdAt to find the last one
    const sortedEvents = [...events].sort((a, b) => {
      const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
      return timeB - timeA;
    });

    const lastEvent = sortedEvents[0];
    if (!lastEvent) return;

    try {
      const matchRef = doc(db, `tournaments/${tournament.id}/matches/${match.id}`);
      const eventRef = doc(db, `tournaments/${tournament.id}/matches/${match.id}/events/${lastEvent.id}`);

      // If it was a goal, decrement score
      if (lastEvent.type === 'goal') {
        const isTeamA = lastEvent.teamId === match.teamAId;
        const isOwnGoal = lastEvent.goalType === 'own_goal';
        // If it was an own goal, the OPPONENT's score was incremented, so decrement it
        const teamToDecrementIsA = isOwnGoal ? !isTeamA : isTeamA;
        
        await updateDoc(matchRef, {
          [teamToDecrementIsA ? 'scoreA' : 'scoreB']: Math.max(0, (teamToDecrementIsA ? liveMatch.scoreA : liveMatch.scoreB) - 1)
        });
      }

      // If it was a second yellow that triggered a red, find and delete the red too
      if (lastEvent.type === 'yellow_card') {
        const yellowCount = events.filter(e => e.playerId === lastEvent.playerId && e.type === 'yellow_card').length;
        if (yellowCount >= 2) {
          const matchingRed = events.find(e => e.playerId === lastEvent.playerId && e.type === 'red_card' && e.timestamp === lastEvent.timestamp);
          if (matchingRed) {
            await deleteDoc(doc(db, `tournaments/${tournament.id}/matches/${match.id}/events/${matchingRed.id}`));
          }
        }
      }

      await deleteDoc(eventRef);
      notify('Last event undone');
    } catch (err) {
      console.error("Undo error:", err);
      handleFirestoreError(err, OperationType.DELETE, `tournaments/${tournament.id}/matches/${match.id}/events`);
    }
  };

  const finishMatch = async () => {
    if (!isCreator || isFinishing) return;
    setIsFinishing(true);
    try {
      const matchRef = doc(db, `tournaments/${tournament.id}/matches/${match.id}`);
      await updateDoc(matchRef, { 
        status: 'finished',
        updatedAt: serverTimestamp() 
      });
      setShowFinishConfirm(false);
      notify('Match finished successfully!');
    } catch (err) {
      console.error("Finish match error:", err);
      handleFirestoreError(err, OperationType.UPDATE, `tournaments/${tournament.id}/matches/${match.id}`);
    } finally {
      setIsFinishing(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
      className="space-y-12"
    >
      <button onClick={onBack} className="flex items-center gap-2 text-slate-400 font-bold hover:text-slate-900 transition-colors uppercase tracking-widest text-[10px]">
        &larr; Back to Tournament
      </button>

      <div className="bg-[#121212] text-white rounded-[32px] p-6 md:p-10 shadow-2xl relative overflow-hidden border border-white/5">
        <div className="flex flex-col items-center gap-8 relative z-10">
          <div className="flex flex-col items-center gap-2">
            <div className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-white/5 border border-white/10 ${
              liveMatch.status === 'live' ? 'text-red-500 border-red-500/20' : 'text-white/40'
            }`}>
              {liveMatch.status === 'live' ? 'Live' : liveMatch.status === 'finished' ? 'FT' : 'Scheduled'}
            </div>
            {liveMatch.status !== 'finished' && <MatchTimer match={liveMatch} isCreator={isCreator} tournament={tournament} />}
          </div>
          
          <div className="flex items-start justify-center gap-4 md:gap-12 w-full max-w-4xl mx-auto">
            <div className="flex-1 flex flex-col items-center gap-4 text-center min-w-0">
              <div className="w-16 h-16 md:w-24 md:h-24 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 shadow-xl border-b-2 border-b-transparent transition-all shrink-0">
                {teamA?.logoURL ? (
                  <img src={teamA.logoURL} className="w-full h-full object-cover rounded-2xl" alt="" />
                ) : (
                  <Users className="w-8 h-8 md:w-12 md:h-12 text-white/20" />
                )}
              </div>
              <div className="space-y-4 w-full flex flex-col items-center">
                <h2 className={`text-xs md:text-xl font-black tracking-tight uppercase leading-tight transition-colors truncate w-full ${
                  liveMatch.status === 'finished' && liveMatch.scoreA > liveMatch.scoreB ? 'text-emerald-400' : ''
                }`}>
                  {(() => {
                    const name = teamA?.name || '';
                    if (name.length <= 10) return name;
                    const parts = name.split(' ');
                    return parts.length > 1 ? `${parts[0].charAt(0)}. ${parts.slice(1).join(' ')}` : name;
                  })()}
                </h2>
                
                {isCreator && liveMatch.status !== 'finished' && (
                  <div className="flex items-center justify-center gap-3">
                    <button 
                      onClick={() => setShowEventModal({ side: 'A', type: 'goal', step: 1 })} 
                      className="w-12 h-12 md:w-16 md:h-16 bg-emerald-500 rounded-2xl md:rounded-[24px] flex items-center justify-center hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-500/20 active:scale-90 group shrink-0"
                      title="Add Goal"
                    >
                      <SoccerIcon className="w-6 h-6 md:w-8 md:h-8 text-white group-hover:scale-110 transition-transform" />
                    </button>
                    <button 
                      onClick={() => setShowEventModal({ side: 'A', type: 'yellow_card', step: 1 })} 
                      className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-yellow-400 from-50% to-red-500 to-50% rounded-2xl md:rounded-[24px] flex items-center justify-center hover:opacity-90 transition-all shadow-xl active:scale-90 group shrink-0"
                      title="Add Card"
                    >
                      <Shield className="w-6 h-6 md:w-8 md:h-8 text-white drop-shadow-md group-hover:rotate-12 transition-transform" />
                    </button>
                    <button 
                      onClick={() => setShowEventModal({ side: 'A', type: 'substitution', step: 1 })} 
                      className="w-12 h-12 md:w-16 md:h-16 bg-white/5 border border-white/10 rounded-2xl md:rounded-[24px] flex items-center justify-center hover:bg-white/10 transition-all active:scale-90 group shrink-0"
                      title="Substitution"
                    >
                      <RefreshCw className="w-6 h-6 md:w-8 md:h-8 text-white/40 group-hover:text-white group-hover:rotate-180 transition-all duration-500" />
                    </button>
                  </div>
                )}
              </div>
            </div>
 
            <div className="flex items-center gap-2 md:gap-3 shrink-0 h-16 md:h-24">
              <span className={`text-4xl md:text-8xl font-black tabular-nums tracking-tighter transition-colors ${
                liveMatch.status === 'finished' && liveMatch.scoreA > liveMatch.scoreB ? 'text-emerald-400' : ''
              }`}>{liveMatch.scoreA}</span>
              <span className="text-xl md:text-4xl font-black text-white/10">-</span>
              <span className={`text-4xl md:text-8xl font-black tabular-nums tracking-tighter transition-colors ${
                liveMatch.status === 'finished' && liveMatch.scoreB > liveMatch.scoreA ? 'text-emerald-400' : ''
              }`}>{liveMatch.scoreB}</span>
            </div>
 
            <div className="flex-1 flex flex-col items-center gap-4 text-center min-w-0">
              <div className="w-16 h-16 md:w-24 md:h-24 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 shadow-xl border-b-2 border-b-transparent transition-all shrink-0">
                {teamB?.logoURL ? (
                  <img src={teamB.logoURL} className="w-full h-full object-cover rounded-2xl" alt="" />
                ) : (
                  <Users className="w-8 h-8 md:w-12 md:h-12 text-white/20" />
                )}
              </div>
              <div className="space-y-4 w-full flex flex-col items-center">
                <h2 className={`text-xs md:text-xl font-black tracking-tight uppercase leading-tight transition-colors truncate w-full ${
                  liveMatch.status === 'finished' && liveMatch.scoreB > liveMatch.scoreA ? 'text-emerald-400' : ''
                }`}>
                  {(() => {
                    const name = teamB?.name || '';
                    if (name.length <= 10) return name;
                    const parts = name.split(' ');
                    return parts.length > 1 ? `${parts[0].charAt(0)}. ${parts.slice(1).join(' ')}` : name;
                  })()}
                </h2>

                {isCreator && liveMatch.status !== 'finished' && (
                  <div className="flex items-center justify-center gap-3">
                    <button 
                      onClick={() => setShowEventModal({ side: 'B', type: 'goal', step: 1 })} 
                      className="w-12 h-12 md:w-16 md:h-16 bg-emerald-500 rounded-2xl md:rounded-[24px] flex items-center justify-center hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-500/20 active:scale-90 group shrink-0"
                      title="Add Goal"
                    >
                      <SoccerIcon className="w-6 h-6 md:w-8 md:h-8 text-white group-hover:scale-110 transition-transform" />
                    </button>
                    <button 
                      onClick={() => setShowEventModal({ side: 'B', type: 'yellow_card', step: 1 })} 
                      className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-yellow-400 from-50% to-red-500 to-50% rounded-2xl md:rounded-[24px] flex items-center justify-center hover:opacity-90 transition-all shadow-xl active:scale-90 group shrink-0"
                      title="Add Card"
                    >
                      <Shield className="w-6 h-6 md:w-8 md:h-8 text-white drop-shadow-md group-hover:rotate-12 transition-transform" />
                    </button>
                    <button 
                      onClick={() => setShowEventModal({ side: 'B', type: 'substitution', step: 1 })} 
                      className="w-12 h-12 md:w-16 md:h-16 bg-white/5 border border-white/10 rounded-2xl md:rounded-[24px] flex items-center justify-center hover:bg-white/10 transition-all active:scale-90 group shrink-0"
                      title="Substitution"
                    >
                      <RefreshCw className="w-6 h-6 md:w-8 md:h-8 text-white/40 group-hover:text-white group-hover:rotate-180 transition-all duration-500" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-16 max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <div className="h-px flex-1 bg-white/5" />
            <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20">Match Timeline</h3>
            <div className="h-px flex-1 bg-white/5" />
          </div>

          <div className="relative space-y-6">
            {/* Center Line */}
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/5 -translate-x-1/2" />

            {events.length === 0 && (
              <div className="text-center py-12 text-white/10 font-bold uppercase tracking-widest text-xs">
                Waiting for events...
              </div>
            )}

            {events.sort((a, b) => {
              const parseTime = (t: string) => {
                 if (!t || !t.includes("'")) return 999; 
                 const mins = parseInt(t.replace('\'',''));
                 return isNaN(mins) ? 999 : mins;
              };
              const timeA = parseTime(a.timestamp || "");
              const timeB = parseTime(b.timestamp || "");
              if (timeA !== timeB) return timeA - timeB;
              
              // Secondarily sort by createdAt to keep order of entry
              const createA = a.createdAt?.toMillis() || 0;
              const createB = b.createdAt?.toMillis() || 0;
              return createA - createB;
            }).map((e) => {
              const playerTeamId = e.teamId;
              const isPlayerTeamA = playerTeamId === match.teamAId;
              const isOwnGoal = e.type === 'goal' && e.goalType === 'own_goal';
              // Display on the beneficiary's side (if OG, it's the other team's side)
              const displayOnLeft = isOwnGoal ? !isPlayerTeamA : isPlayerTeamA;
              
              const pl = (isPlayerTeamA ? playersA : playersB).find(p => p.id === e.playerId);
              const isValidTime = e.timestamp && e.timestamp.includes("'");
              
              return (
                <motion.div 
                  initial={{ opacity: 0, x: displayOnLeft ? -20 : 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  key={e.id} 
                  className="relative flex items-center group"
                >
                  {/* Event Marker */}
                  <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center z-10">
                    {isValidTime ? (
                      <div className={`w-8 h-8 rounded-full bg-[#121212] border ${isOwnGoal ? 'border-red-500/50' : 'border-white/10'} flex items-center justify-center text-[9px] font-black ${isOwnGoal ? 'text-red-500' : 'text-white/60'} shadow-xl group-hover:border-white/30 transition-all`}>
                        {e.timestamp}
                      </div>
                    ) : (
                      <div className="w-3 h-3 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                        <div className="w-1 h-1 rounded-full bg-white/20" />
                      </div>
                    )}
                  </div>

                  {/* Left Side Content (Team A display side) */}
                  <div className={`flex-1 flex flex-col items-end pr-8 transition-all ${displayOnLeft ? 'opacity-100' : 'opacity-20 translate-x-2 grayscale'}`}>
                    {displayOnLeft && (
                      <div className="text-right space-y-1">
                        <div className="flex items-center justify-end gap-3">
                          <div className="flex flex-col items-end">
                            <span className={`text-xs font-black ${isOwnGoal ? 'text-red-500' : 'text-white'}`}>{pl?.name?.split(' (')[0].split(' #')[0]}</span>
                            {e.assistantId && (
                              <div className="flex items-center justify-end gap-1 text-[9px] text-white/40 font-black uppercase">
                                <span>{ (isPlayerTeamA ? playersA : playersB).find(p => p.id === e.assistantId)?.name?.split(' (')[0].split(' #')[0] }</span>
                                {e.type === 'substitution' ? <ArrowUp className="w-2.5 h-2.5 text-emerald-500" /> : <Footprints className="w-2.5 h-2.5" />}
                              </div>
                            )}
                          </div>
                          {e.type === 'goal' ? (
                            <div className="w-6 h-6 flex items-center justify-center">
                              <SoccerIcon className={`w-4 h-4 ${isOwnGoal ? 'text-red-500' : 'text-white'}`} />
                            </div>
                          ) : e.type === 'substitution' ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <ArrowDown className="w-2.5 h-2.5 text-red-500" />
                              <ArrowUp className="w-2.5 h-2.5 text-emerald-500" />
                            </div>
                          ) : (
                            <div className={`w-3.5 h-5 rounded-sm shadow-md ${e.type === 'yellow_card' ? 'bg-yellow-400' : 'bg-red-500'}`} />
                          )}
                        </div>
                        {e.type === 'goal' && e.goalType && (
                          <div className={`text-[10px] uppercase font-black ${isOwnGoal ? 'text-red-500/60' : 'text-white/30'}`}>{e.goalType.replace('_',' ')}</div>
                        )}
                        {isCreator && e.id === lastEventId && (
                           <button onClick={undoLastEvent} className="text-[8px] uppercase font-black text-red-500/40 hover:text-red-500 transition-colors">Undo</button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right Side Content (Team B display side) */}
                  <div className={`flex-1 flex flex-col items-start pl-8 transition-all ${!displayOnLeft ? 'opacity-100' : 'opacity-20 -translate-x-2 grayscale'}`}>
                    {!displayOnLeft && (
                      <div className="text-left space-y-1">
                        <div className="flex items-center justify-start gap-3">
                          {e.type === 'goal' ? (
                            <div className="w-6 h-6 flex items-center justify-center">
                              <SoccerIcon className={`w-4 h-4 ${isOwnGoal ? 'text-red-500' : 'text-white'}`} />
                            </div>
                          ) : e.type === 'substitution' ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <ArrowDown className="w-2.5 h-2.5 text-red-500" />
                              <ArrowUp className="w-2.5 h-2.5 text-emerald-500" />
                            </div>
                          ) : (
                            <div className={`w-3.5 h-5 rounded-sm shadow-md ${e.type === 'yellow_card' ? 'bg-yellow-400' : 'bg-red-500'}`} />
                          )}
                          <div className="flex flex-col items-start">
                            <span className={`text-xs font-black ${isOwnGoal ? 'text-red-500' : 'text-white'}`}>{pl?.name?.split(' (')[0].split(' #')[0]}</span>
                            {e.assistantId && (
                              <div className="flex items-center justify-start gap-1 text-[9px] text-white/40 font-black uppercase">
                                {e.type === 'substitution' ? <ArrowUp className="w-2.5 h-2.5 text-emerald-500" /> : <Footprints className="w-2.5 h-2.5" />}
                                <span>{ (isPlayerTeamA ? playersA : playersB).find(p => p.id === e.assistantId)?.name?.split(' (')[0].split(' #')[0] }</span>
                              </div>
                            )}
                          </div>
                        </div>
                        {e.type === 'goal' && e.goalType && (
                          <div className={`text-[10px] uppercase font-black ${isOwnGoal ? 'text-red-500/60' : 'text-white/30'}`}>{e.goalType.replace('_',' ')}</div>
                        )}
                        {isCreator && e.id === lastEventId && (
                           <button onClick={undoLastEvent} className="text-[8px] uppercase font-black text-red-500/40 hover:text-red-500 transition-colors">Undo</button>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>


        {isCreator && liveMatch.status !== 'finished' && (
          <div className="mt-16 flex justify-center">
            <button 
              onClick={() => setShowFinishConfirm(true)}
              className="bg-red-500/10 text-red-500 border border-red-500/20 px-8 py-3 rounded-full font-black text-xs uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all"
            >
              Finish Match
            </button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showEventModal && (
          <div key="event-modal" className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowEventModal(null)} className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white w-full max-w-sm rounded-[32px] p-8 shadow-2xl">
              <button 
                onClick={() => setShowEventModal(null)} 
                className="absolute right-6 top-6 p-2 text-slate-300 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <h3 className="text-xl font-black mb-6 flex items-center gap-2 uppercase tracking-tighter">
                {showEventModal.type === 'goal' ? (showEventModal.step === 1 ? 'Select Goal Scorer' : 'Goal Details') : 
                 showEventModal.type === 'substitution' ? (showEventModal.step === 1 ? 'Player Out' : 'Player In') :
                 (showEventModal.step === 1 ? 'Select Player' : 'Card Type')}
              </h3>

              {showEventModal.step === 1 ? (
                <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-1">
                  {(showEventModal.side === 'A' ? playersA : playersB)
                    .filter(p => {
                      if (showEventModal.type === 'substitution') return true; // Can sub anyone technically
                      return !events.some(e => e.playerId === p.id && e.type === 'red_card');
                    })
                    .map((p, idx) => (
                    <button 
                      key={p.id}
                      onClick={() => {
                        if (showEventModal.type === 'goal') {
                          setShowEventModal({ ...showEventModal, step: 2, data: { playerId: p.id, goalType: 'open_goal' } });
                        } else if (showEventModal.type === 'yellow_card' || showEventModal.type === 'red_card') {
                          setShowEventModal({ ...showEventModal, step: 2, data: { playerId: p.id, cardType: 'yellow_card' } });
                        } else if (showEventModal.type === 'substitution') {
                          setShowEventModal({ ...showEventModal, step: 2, data: { playerOutId: p.id } });
                        }
                      }}
                      className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:border-emerald-500 hover:bg-emerald-50 transition-all text-left group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-[10px] font-black shadow-sm group-hover:text-emerald-600">
                          {showEventModal.type === 'goal' ? <SoccerIcon className="w-4 h-4 text-slate-300 group-hover:text-emerald-500" /> : 
                           showEventModal.type === 'substitution' ? <ArrowDown className="w-4 h-4 text-red-400" /> :
                           <Shield className="w-4 h-4 text-slate-300 group-hover:text-yellow-400" />}
                        </div>
                        <div className="font-bold flex items-center gap-2">
                          {p.name.split(' (')[0].split(' #')[0]}
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{p.position}</div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-6">
                  {showEventModal.type === 'goal' && (
                    <>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Goal Type</p>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { id: 'open_goal', label: 'Open Goal' },
                            { id: 'header', label: 'Header' },
                            { id: 'penalty', label: 'Penalty' },
                            { id: 'own_goal', label: 'Own Goal' }
                          ].map(gType => (
                            <button
                              key={gType.id}
                              onClick={() => {
                                setShowEventModal({ 
                                  ...showEventModal, 
                                  data: { 
                                    ...showEventModal.data, 
                                    goalType: gType.id as GoalType,
                                    assistantId: gType.id === 'own_goal' ? undefined : showEventModal.data.assistantId
                                  } 
                                });
                              }}
                              className={`py-3 px-2 rounded-2xl transition-all font-black text-[9px] uppercase tracking-widest border ${
                                showEventModal.data.goalType === gType.id 
                                  ? 'bg-emerald-500 text-white border-emerald-500 shadow-md' 
                                  : 'bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100'
                              }`}
                            >
                              {gType.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {showEventModal.data.goalType !== 'own_goal' && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Assisted by (Optional)</p>
                          <select 
                            className="w-full bg-slate-50 px-5 py-4 rounded-2xl border border-slate-200 font-bold text-sm"
                            defaultValue={showEventModal.data.assistantId || ""}
                            onChange={(e) => setShowEventModal({ ...showEventModal, data: { ...showEventModal.data, assistantId: e.target.value } })}
                          >
                            <option value="">No Assist</option>
                            {(showEventModal.side === 'A' ? playersA : playersB)
                              .filter(p => p.id !== showEventModal.data.playerId)
                              .map((p) => <option key={p.id} value={p.id}>{p.name.split(' (')[0].split(' #')[0]}</option>)}
                          </select>
                        </motion.div>
                      )}

                      <button
                        onClick={() => {
                          addEvent(
                            showEventModal.data.playerId, 
                            'goal', 
                            showEventModal.side === 'A' ? match.teamAId : match.teamBId,
                            { 
                              assistantId: showEventModal.data.goalType === 'own_goal' ? undefined : showEventModal.data.assistantId, 
                              goalType: showEventModal.data.goalType 
                            }
                          );
                        }}
                        className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all active:scale-95"
                      >
                        Record Goal
                      </button>
                    </>
                  )}

                  {(showEventModal.type === 'yellow_card' || showEventModal.type === 'red_card') && (
                    <>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Select Card</p>
                        <div className="grid grid-cols-2 gap-4">
                          <button 
                            onClick={() => setShowEventModal({ ...showEventModal, data: { ...showEventModal.data, cardType: 'yellow_card' } })}
                            className={`flex flex-col items-center gap-3 p-6 rounded-3xl border-2 transition-all ${
                              showEventModal.data.cardType === 'yellow_card' ? 'bg-yellow-50 border-yellow-400 shadow-lg shadow-yellow-400/10' : 'bg-slate-50 border-slate-100'
                            }`}
                          >
                            <div className="w-8 h-12 bg-yellow-400 rounded-sm shadow-md" />
                            <span className={`font-black text-[10px] uppercase tracking-widest ${showEventModal.data.cardType === 'yellow_card' ? 'text-yellow-700' : 'text-slate-400'}`}>Yellow</span>
                          </button>
                          <button 
                            onClick={() => setShowEventModal({ ...showEventModal, data: { ...showEventModal.data, cardType: 'red_card' } })}
                            className={`flex flex-col items-center gap-3 p-6 rounded-3xl border-2 transition-all ${
                              showEventModal.data.cardType === 'red_card' ? 'bg-red-50 border-red-500 shadow-lg shadow-red-500/10' : 'bg-slate-50 border-slate-100'
                            }`}
                          >
                            <div className="w-8 h-12 bg-red-500 rounded-sm shadow-md" />
                            <span className={`font-black text-[10px] uppercase tracking-widest ${showEventModal.data.cardType === 'red_card' ? 'text-red-700' : 'text-slate-400'}`}>Red</span>
                          </button>
                        </div>
                      </div>
                      <button
                        onClick={() => addEvent(showEventModal.data.playerId, showEventModal.data.cardType, showEventModal.side === 'A' ? match.teamAId : match.teamBId)}
                        className={`w-full py-4 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg transition-all active:scale-95 ${
                          showEventModal.data.cardType === 'yellow_card' ? 'bg-yellow-500 shadow-yellow-500/20 hover:bg-yellow-600' : 'bg-red-500 shadow-red-500/20 hover:bg-red-600'
                        }`}
                      >
                        Assign Card
                      </button>
                    </>
                  )}

                  {showEventModal.type === 'substitution' && (
                    <>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Player In</p>
                        <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
                          {(showEventModal.side === 'A' ? playersA : playersB)
                            .filter(p => p.id !== showEventModal.data.playerOutId && !events.some(e => e.playerId === p.id && e.type === 'red_card'))
                            .map((p) => (
                            <button 
                              key={p.id}
                              onClick={() => setShowEventModal({ ...showEventModal, data: { ...showEventModal.data, playerInId: p.id } })}
                              className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all text-left ${
                                showEventModal.data.playerInId === p.id ? 'bg-emerald-50 border-emerald-500' : 'bg-slate-50 border-slate-100 hover:border-emerald-200'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center">
                                  <ArrowUp className="w-4 h-4 text-emerald-500" />
                                </div>
                                <span className="font-bold">{p.name.split(' (')[0].split(' #')[0]}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                      <button
                        disabled={!showEventModal.data.playerInId}
                        onClick={() => {
                          addEvent(showEventModal.data.playerOutId, 'substitution', showEventModal.side === 'A' ? match.teamAId : match.teamBId, { assistantId: showEventModal.data.playerInId });
                        }}
                        className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all active:scale-95 disabled:opacity-50"
                      >
                        Confirm Sub
                      </button>
                    </>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        )}

        {showFinishConfirm && (
          <div key="finish-modal" className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowFinishConfirm(false)} className="absolute inset-0 bg-slate-900/80 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white w-full max-w-sm rounded-[32px] p-8 shadow-2xl text-center">
              <div className="w-20 h-20 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <SoccerIcon className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-black uppercase tracking-tighter mb-2">End Match?</h3>
              <p className="text-slate-500 text-sm mb-8 font-medium">This will lock the scores and finalize the result in the standings. This action cannot be undone.</p>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setShowFinishConfirm(false)}
                  className="bg-slate-100 text-slate-900 font-black py-4 rounded-2xl text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={finishMatch}
                  disabled={isFinishing}
                  className="bg-red-500 text-white font-black py-4 rounded-2xl text-xs uppercase tracking-widest hover:bg-red-600 transition-all shadow-lg shadow-red-500/20 disabled:opacity-50"
                >
                  {isFinishing ? 'Finishing...' : 'End Match'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function TeamDetailView({ tournament, team, onBack, isCreator }: { tournament: Tournament, team: Team, onBack: () => void, isCreator: boolean }) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [teamMatches, setTeamMatches] = useState<Match[]>([]);
  const [showAddPlayer, setShowAddPlayer] = useState(false);

  useEffect(() => {
    const unsubPlayers = onSnapshot(collection(db, `tournaments/${tournament.id}/teams/${team.id}/players`), (s) => {
      setPlayers(s.docs.map(d => ({ id: d.id, ...d.data() } as Player)));
    });

    const fetchStats = async () => {
      try {
        // Fetch all events for this tournament where this team is involved
        const qEvents = query(collectionGroup(db, 'events'), where('tournamentId', '==', tournament.id));
        const [sEvents, sMatches] = await Promise.all([
          getDocs(qEvents),
          getDocs(query(collection(db, `tournaments/${tournament.id}/matches`), where('status', '==', 'finished')))
        ]);
        
        const allEvents = sEvents.docs.map(d => ({ id: d.id, ...d.data() } as MatchEvent));
        setEvents(allEvents);

        const allFinishedMatches = sMatches.docs.map(d => ({ id: d.id, ...d.data() } as Match))
          .filter(m => m.teamAId === team.id || m.teamBId === team.id);
        setTeamMatches(allFinishedMatches);
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `stats`);
      }
    };

    fetchStats();
    return unsubPlayers;
  }, [tournament.id, team.id]);

  const getPlayerStats = (playerId: string) => {
    const pEvents = events.filter(e => e.playerId === playerId);
    const assistedEvents = events.filter(e => e.assistantId === playerId);
    return {
      goals: pEvents.filter(e => e.type === 'goal' && e.teamId === team.id && e.goalType !== 'own_goal').length,
      assists: assistedEvents.filter(e => e.goalType !== 'own_goal').length,
      matchesPlayed: teamMatches.length, // Simplified: team matches = player matches
      yellow: pEvents.filter(e => e.type === 'yellow_card').length,
      red: pEvents.filter(e => e.type === 'red_card').length
    };
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-12">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-400 font-bold hover:text-slate-900 transition-colors uppercase tracking-widest text-[10px] self-start sm:self-center">
          &larr; Back to Teams
        </button>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button 
            onClick={() => {
              const url = `${window.location.origin}${window.location.pathname}?t=${tournament.id}&join=${team.id}`;
              navigator.clipboard.writeText(url);
              (window as any).notify('Join link copied to clipboard!');
            }}
            className="px-4 py-2 bg-slate-100 text-slate-600 rounded-full text-[10px] md:text-xs font-bold hover:bg-slate-200 transition-all flex items-center gap-2"
          >
            <Send className="w-3 h-3" /> Share Join Link
          </button>
          {(isCreator || team.creatorId === (auth.currentUser?.uid)) && (
            <button onClick={() => setShowAddPlayer(true)} className="px-4 py-2 bg-emerald-500 text-white rounded-full text-[10px] md:text-xs font-bold hover:bg-emerald-600 transition-all">+ Add Player</button>
          )}
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-center gap-8">
        <div className="w-24 h-24 md:w-32 md:h-32 bg-white rounded-full border border-slate-200 shadow-lg flex items-center justify-center overflow-hidden shrink-0">
          {team.logoURL ? (
            <img src={team.logoURL} alt={team.name} className="w-full h-full object-cover" />
          ) : (
            <Users className="w-10 h-10 md:w-12 md:h-12 text-slate-300" />
          )}
        </div>
        <div className="text-center md:text-left space-y-2">
          <h1 className="text-3xl md:text-5xl font-black tracking-tighter uppercase leading-none">{team.name}</h1>
          <div className="flex items-center justify-center md:justify-start gap-4">
            <div className="flex items-center gap-2 text-slate-500 font-bold text-xs uppercase tracking-widest">
              <Star className="w-4 h-4 text-emerald-500" /> {players.length} Players Registered
            </div>
          </div>
        </div>
      </div>

      <section className="space-y-6">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Users className="w-5 h-5 text-emerald-500" />
          The Squad
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {players.map((p, idx) => {
            const stats = getPlayerStats(p.id);
            return (
              <div key={p.id} className="bg-white p-6 rounded-3xl border border-slate-200 flex items-center justify-between group hover:border-emerald-200 transition-all shadow-sm relative">
                {isCreator && (
                  <button 
                    onClick={() => {
                      if (window.confirm(`Delete ${p.name}?`)) {
                        deleteDoc(doc(db, `tournaments/${tournament.id}/teams/${team.id}/players/${p.id}`));
                      }
                    }}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow-lg"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
                <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
                  <div className="flex flex-col items-center gap-1.5 shrink-0">
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-slate-50 rounded-2xl flex items-center justify-center font-black text-slate-300 text-base md:text-lg group-hover:bg-emerald-50 group-hover:text-emerald-500 transition-colors">
                      {idx + 1}
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="px-1 bg-emerald-50 rounded font-black text-emerald-600 text-[8px] md:text-[10px] flex items-center gap-0.5">
                        <SoccerIcon className="w-2.5 h-2.5" /> {stats.goals}G
                      </div>
                      <div className="px-1 bg-blue-50 rounded font-black text-blue-600 text-[8px] md:text-[10px]">{stats.assists}A</div>
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm md:text-lg leading-tight truncate">
                      {p.name.split(' (')[0].split(' #')[0]}
                    </div>
                    <div className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest">{p.position || 'Player'}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 md:gap-4 shrink-0 bg-slate-50/50 p-2 md:p-0 rounded-xl md:bg-transparent">
                  <div className="flex flex-col items-center">
                    <span className="text-[8px] md:text-[10px] font-black text-slate-300">MP</span>
                    <span className="font-black text-slate-400 text-sm md:text-lg tabular-nums">{stats.matchesPlayed}</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="w-1.5 h-2 md:w-2 md:h-2.5 bg-yellow-400 rounded-[1px] mb-0.5 md:mb-1" />
                    <span className="font-black text-yellow-600 text-sm md:text-lg tabular-nums">{stats.yellow}</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="w-1.5 h-2 md:w-2 md:h-2.5 bg-red-500 rounded-[1px] mb-0.5 md:mb-1" />
                    <span className="font-black text-red-500 text-sm md:text-lg tabular-nums">{stats.red}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {events.length > 0 && (
        <section className="space-y-6">
          <h2 className="text-xl font-bold flex items-center gap-2 uppercase tracking-tighter">
            <Trophy className="w-5 h-5 text-yellow-500" />
            Performance Summary
          </h2>
          <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Player</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Goals</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Yellow</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Red</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {players
                  .map(p => ({ ...p, stats: getPlayerStats(p.id) }))
                  .filter(p => p.stats.goals > 0 || p.stats.yellow > 0 || p.stats.red > 0)
                  .sort((a, b) => b.stats.goals - a.stats.goals || b.stats.yellow - a.stats.yellow)
                  .map((p, idx) => (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-bold">{p.name.split(' (')[0].split(' #')[0]}</div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-black ${p.stats.goals > 0 ? 'bg-emerald-500 text-white' : 'text-slate-300'}`}>
                          {p.stats.goals}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-black ${p.stats.yellow > 0 ? 'bg-yellow-400 text-yellow-900' : 'text-slate-300'}`}>
                          {p.stats.yellow}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-black ${p.stats.red > 0 ? 'bg-red-500 text-white' : 'text-slate-300'}`}>
                          {p.stats.red}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <AnimatePresence>
        {showAddPlayer && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddPlayer(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl">
              <button onClick={() => setShowAddPlayer(false)} className="absolute right-6 top-6 p-2 text-slate-300 hover:text-slate-600 transition-colors"><X className="w-5 h-5" /></button>
              <h2 className="text-2xl font-black tracking-tight mb-6">Add Team Player</h2>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const name = (form.elements.namedItem('player-name') as HTMLInputElement).value;
                const number = Number((form.elements.namedItem('player-number') as HTMLInputElement).value);
                const position = (form.elements.namedItem('player-position') as HTMLInputElement).value;
                try {
                  await addDoc(collection(db, `/tournaments/${tournament.id}/teams/${team.id}/players`), { 
                    name, number, position, teamId: team.id, tournamentId: tournament.id 
                  });
                  setShowAddPlayer(false);
                } catch (err) { handleFirestoreError(err, OperationType.WRITE, `players`); }
              }} className="space-y-4">
                <input name="player-name" required className="w-full bg-slate-50 px-5 py-4 rounded-2xl border border-slate-200" placeholder="Full Name" />
                <div className="grid grid-cols-2 gap-4">
                  <input name="player-number" type="number" className="w-full bg-slate-50 px-5 py-4 rounded-2xl border border-slate-200" placeholder="Jersey #" />
                  <input name="player-position" className="w-full bg-slate-50 px-5 py-4 rounded-2xl border border-slate-200" placeholder="Position (e.g. FW)" />
                </div>
                <button type="submit" className="w-full bg-emerald-500 text-white font-bold py-4 rounded-2xl mt-2">Add to Squad</button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function RecruitmentBoard({ user, onError, notify }: { user: FirebaseUser | null, onError: (err: any) => void, notify: (msg: string) => void }) {
  const [posts, setPosts] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'recruitment'), orderBy('createdAt', 'desc'), limit(10));
    const unsub = onSnapshot(q, (s) => {
      setPosts(s.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => {
      onError(err);
      handleFirestoreError(err, OperationType.LIST, 'recruitment');
    });
    return unsub;
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const form = e.currentTarget as HTMLFormElement;
    const content = (form.elements.namedItem('content') as HTMLTextAreaElement).value;
    const type = (form.elements.namedItem('type') as HTMLSelectElement).value;

    try {
      await addDoc(collection(db, 'recruitment'), {
        userId: user.uid,
        userName: user.displayName || 'Player',
        content,
        type,
        createdAt: serverTimestamp()
      });
      setShowForm(false);
    } catch (err) {
      onError(err);
      handleFirestoreError(err, OperationType.WRITE, 'recruitment');
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900">
          <MessageSquare className="w-5 h-5 text-emerald-500" />
          Community Recruitment
        </h2>
        <button 
          onClick={() => user ? setShowForm(true) : notify('Please login to post')}
          className="px-4 py-2 bg-slate-900 text-white rounded-full text-xs font-bold hover:bg-emerald-500 transition-all shadow-lg active:scale-95"
        >
          Post Request
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {posts.map(post => (
          <div key={post.id} className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm space-y-4 hover:border-emerald-200 transition-all flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                  <UserIcon className="w-5 h-5 text-slate-400" />
                </div>
                <div>
                  <div className="font-bold text-sm text-slate-900">{post.userName}</div>
                  <div className="text-[10px] uppercase font-black tracking-widest text-emerald-500">{post.type?.replace(/_/g, ' ')}</div>
                </div>
              </div>
              <p className="text-sm text-slate-600 italic leading-relaxed">"{post.content}"</p>
            </div>
            <button className="w-full py-3 bg-slate-50 text-slate-900 text-xs font-bold rounded-[18px] flex items-center justify-center gap-2 hover:bg-emerald-50 hover:text-emerald-500 transition-all border border-slate-100 group">
              <Send className="w-3 h-3 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" /> Connect
            </button>
          </div>
        ))}
        {posts.length === 0 && (
          <div className="col-span-full py-20 text-center bg-slate-50 rounded-[32px] border border-dashed border-slate-200 text-slate-400 font-medium italic">
            No active recruitment requests yet.
          </div>
        )}
      </div>

      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowForm(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white w-full max-w-md rounded-[32px] p-8 shadow-2xl">
              <button onClick={() => setShowForm(false)} className="absolute right-6 top-6 p-2 text-slate-300 hover:text-slate-600 transition-colors"><X className="w-5 h-5" /></button>
              <h2 className="text-2xl font-black tracking-tight mb-6">Recruitment Post</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <select name="type" className="w-full bg-slate-50 px-5 py-4 rounded-2xl border border-slate-200 font-bold focus:ring-2 focus:ring-emerald-500 outline-none">
                  <option value="looking_for_team">Player seeking Team</option>
                  <option value="looking_for_player">Team seeking Player</option>
                  <option value="friendly_match">Friendly Match Request</option>
                </select>
                <textarea name="content" required placeholder="Tell the community what you're looking for..." className="w-full bg-slate-50 px-5 py-4 rounded-2xl border border-slate-200 h-32 focus:ring-2 focus:ring-emerald-500 outline-none" />
                <button type="submit" className="w-full bg-emerald-500 text-white font-bold py-4 rounded-2xl hover:bg-emerald-600 transition-all shadow-lg active:scale-95">Post to Board</button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  );
}

function DashboardView({ user, initialTab, onSelectTournament, onError }: { user: FirebaseUser, initialTab?: 'tournaments' | 'teams' | 'profile', onSelectTournament: (t: Tournament) => void, onError: (err: any) => void }) {
  const [userTournaments, setUserTournaments] = useState<Tournament[]>([]);
  const [userTeams, setUserTeams] = useState<Team[]>([]);
  const [careerTeams, setCareerTeams] = useState<{ teamId: string, tournamentId: string, name: string }[]>([]);
  const [careerStats, setCareerStats] = useState({ goals: 0, assists: 0, matches: 0, yellow: 0, red: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'tournaments' | 'teams' | 'profile'>(initialTab || 'tournaments');

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const qTournaments = query(collection(db, 'tournaments'), where('creatorId', '==', user.uid), orderBy('createdAt', 'desc'));
        const qTeams = query(collectionGroup(db, 'teams'), where('creatorId', '==', user.uid));
        const qCareerEvents = query(collectionGroup(db, 'events'), where('userId', '==', user.uid));
        const qCareerPlayers = query(collectionGroup(db, 'players'), where('userId', '==', user.uid));
        
        const [sTournaments, sTeams, sCareerEvents, sCareerPlayers] = await Promise.all([
          getDocs(qTournaments),
          getDocs(qTeams),
          getDocs(qCareerEvents),
          getDocs(qCareerPlayers)
        ]);

        setUserTournaments(sTournaments.docs.map(d => ({ id: d.id, ...d.data() } as Tournament)));
        setUserTeams(sTeams.docs.map(d => ({ id: d.id, ...d.data() } as Team)));
        
        const careerPlayerData = sCareerPlayers.docs.map(d => d.data() as Player);
        // Deduplicate and map career teams
        const cTeamsMap: { [key: string]: any } = {};
        careerPlayerData.forEach(p => {
          cTeamsMap[p.teamId] = { teamId: p.teamId, tournamentId: p.tournamentId, name: p.name }; // Using p.name from player record as fallback
        });
        setCareerTeams(Object.values(cTeamsMap));

        const events = sCareerEvents.docs.map(d => d.data() as MatchEvent);
        setCareerStats({
          goals: events.filter(e => e.type === 'goal' && e.goalType !== 'own_goal').length,
          assists: events.filter(e => e.assistantUserId === user.uid && e.goalType !== 'own_goal').length,
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

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-500 border-t-transparent shadow-xl"></div>
    </div>
  );

  return (
    <div className="space-y-8 pb-20">
      {/* Profile Header */}
      <div className="bg-slate-900 text-white rounded-[40px] p-8 md:p-12 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
          <img src={user.photoURL || ''} alt="" className="w-24 h-24 rounded-full border-4 border-white/10 shadow-2xl" />
          <div className="text-center md:text-left space-y-1 text-slate-100">
            <h1 className="text-3xl font-black tracking-tighter uppercase">{user.displayName}</h1>
            <p className="text-white/50 font-medium text-sm">{user.email}</p>
          </div>
        </div>
      </div>

      {/* Active View */}
      <motion.div 
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="min-h-[400px] pt-4"
      >
        {activeTab === 'tournaments' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black uppercase tracking-tight text-slate-800">Manage Your Tournaments</h2>
              <button 
                onClick={() => {
                  // In a real app we'd trigger the view change from parent, 
                  // but here we can just call setView if we pass it or use a callback
                  (window as any).triggerCreateTournament();
                }}
                className="flex items-center gap-2 bg-emerald-500 text-white px-4 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-sm"
              >
                <Plus className="w-3 h-3" /> New Tournament
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {userTournaments.length === 0 ? (
              <div className="col-span-full p-12 text-center bg-slate-50 rounded-[32px] border border-dashed border-slate-200">
                <p className="text-slate-400 font-bold mb-4">No tournaments found.</p>
                <button 
                  onClick={() => (window as any).triggerCreateTournament()}
                  className="px-6 py-3 bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest"
                >
                  Create Your First Tournament
                </button>
              </div>
            ) : (
                userTournaments.map(t => (
                  <div 
                    key={t.id} 
                    onClick={() => onSelectTournament(t)}
                    className="group bg-white p-6 rounded-3xl border border-slate-200 hover:border-emerald-200 shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-slate-50 group-hover:bg-emerald-50 rounded-2xl flex items-center justify-center">
                        <Trophy className="w-6 h-6 text-emerald-500" />
                      </div>
                      <div>
                        <h4 className="font-black text-slate-800 uppercase tracking-tight line-clamp-1">{t.name}</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.type.replace('_', ' ')} • {t.status}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-200 group-hover:text-emerald-500" />
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'teams' && (
          <div className="space-y-4">
            <h2 className="text-xl font-black uppercase tracking-tight text-slate-800">Your Registered Teams</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {userTeams.length === 0 ? (
                <div className="col-span-full p-12 text-center bg-slate-50 rounded-[32px] border border-dashed border-slate-200">
                  <p className="text-slate-400 font-bold">You haven't formed any teams yet.</p>
                </div>
              ) : (
                userTeams.map(team => (
                  <div key={team.id} className="bg-white p-6 rounded-3xl border border-slate-200 flex items-center justify-between group shadow-sm">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center overflow-hidden border border-slate-100">
                        {team.logoURL ? <img src={team.logoURL} className="w-full h-full object-cover" /> : <Users className="text-slate-300" />}
                      </div>
                      <div>
                        <h4 className="font-black text-slate-800 uppercase tracking-tight">{team.name}</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ID: {team.tournamentId.slice(0, 8)}</p>
                      </div>
                    </div>
                    <button className="p-3 bg-slate-50 rounded-xl text-slate-400 hover:text-emerald-500 transition-colors">
                      <Settings className="w-5 h-5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="space-y-6 max-w-2xl mx-auto">
            {/* Career Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-6 rounded-3xl border border-slate-200 text-center flex flex-col items-center">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1 flex items-center gap-1">
                  <SoccerIcon className="w-3 h-3" /> Goals
                </p>
                <p className="text-3xl font-black text-emerald-500">{careerStats.goals}</p>
              </div>
              <div className="bg-white p-6 rounded-3xl border border-slate-200 text-center">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Assists</p>
                <p className="text-3xl font-black text-blue-500">{careerStats.assists}</p>
              </div>
              <div className="bg-white p-6 rounded-3xl border border-slate-200 text-center">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Matches</p>
                <p className="text-3xl font-black text-slate-900">{careerStats.matches}</p>
              </div>
              <div className="bg-white p-6 rounded-3xl border border-slate-200 text-center">
                <div className="flex items-center justify-center gap-2">
                  <div className="flex flex-col">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Y/R</p>
                    <p className="text-xl font-black text-slate-900">{careerStats.yellow}/{careerStats.red}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="p-8 border-b border-slate-100">
                <h3 className="text-lg font-black uppercase tracking-tighter mb-4">Account Information</h3>
                <div className="space-y-4">
                  <div className="flex justify-between py-3 border-b border-slate-50">
                    <span className="text-slate-400 font-bold text-xs uppercase">Display Name</span>
                    <span className="font-black text-slate-800">{user.displayName}</span>
                  </div>
                  <div className="flex justify-between py-3 border-b border-slate-50">
                    <span className="text-slate-400 font-bold text-xs uppercase">Email Address</span>
                    <span className="font-black text-slate-800">{user.email}</span>
                  </div>
                  <div className="flex justify-between py-3 border-b border-slate-50">
                    <span className="text-slate-400 font-bold text-xs uppercase">User ID</span>
                    <span className="font-mono text-[10px] text-slate-400">{user.uid}</span>
                  </div>
                </div>
              </div>
              <div className="p-6 bg-slate-50 flex items-center justify-between">
                <button 
                  onClick={() => auth.signOut()}
                  className="flex items-center gap-2 text-red-500 font-black text-xs uppercase tracking-widest hover:text-red-600 transition-colors"
                >
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </div>
            </div>

            {/* Career History */}
            <div className="space-y-4">
              <h3 className="text-lg font-black uppercase tracking-tighter">Career History</h3>
              <div className="grid grid-cols-1 gap-3">
                {careerTeams.length === 0 ? (
                  <div className="p-8 text-center bg-slate-100 rounded-3xl border border-dashed border-slate-200">
                    <p className="text-slate-400 font-bold text-sm uppercase">No past teams recorded.</p>
                  </div>
                ) : (
                  careerTeams.map((ct, idx) => (
                    <div key={`${ct.teamId}-${idx}`} className="bg-white p-6 rounded-3xl border border-slate-200 flex items-center justify-between shadow-sm">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center">
                          <Shield className="w-5 h-5 text-emerald-500" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">{ct.name}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Team ID: {ct.teamId.slice(0, 8)}</p>
                        </div>
                      </div>
                      <Trophy className="w-5 h-5 text-yellow-500/50" />
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function JoinTeamView({ tournamentId, teamId, user, onSuccess, onCancel }: { tournamentId: string, teamId: string, user: FirebaseUser | null, onSuccess: () => void, onCancel: () => void }) {
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
      (window as any).notify("Please sign in to join a team!");
      return;
    }
    setJoining(true);
    try {
      if (claimPlayerId) {
        // Update existing player record with userId and ensure tournamentId exists
        await updateDoc(doc(db, `tournaments/${tournamentId}/teams/${teamId}/players`, claimPlayerId), {
          userId: user.uid,
          tournamentId: tournamentId,
          updatedAt: serverTimestamp()
        });
      } else {
        // Create new player record
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
          {team.logoURL ? <img src={team.logoURL} className="w-full h-full object-cover" /> : <Users className="w-12 h-12 text-slate-300" />}
        </div>
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Invitation to Join</p>
          <h2 className="text-4xl font-black uppercase tracking-tighter">{team.name}</h2>
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
}