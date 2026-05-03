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
  getDoc,
  setDoc,
  collectionGroup,
  where,
  getDocs,
  orderBy,
  limit,
  Timestamp
} from 'firebase/firestore';
import { auth, db, OperationType, handleFirestoreError } from './lib/firebase';
import { Tournament, Match, Team, User, Player, MatchEvent, MatchEventType, GoalType } from './types';
import { Trophy, Users, LayoutDashboard, Plus, Play, LogIn, LogOut, ChevronRight, User as UserIcon, Calendar, Zap, Star, Shield, Target, MessageSquare, TrendingUp, RefreshCw, Send, ArrowUp, ArrowDown, X, RotateCcw, Settings, Trash2, Pause, Circle, Footprints, Menu, ArrowLeftRight, Hash, Activity, HelpingHand, LandPlot } from 'lucide-react';
import { GiSoccerBall } from 'react-icons/gi';
import { motion, AnimatePresence } from 'motion/react';

const SoccerIcon = ({ className }: { className?: string }) => {
  const Icon = GiSoccerBall as any;
  return <Icon className={className} />;
};

const PitchIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="94" height="58" rx="4" />
    <line x1="50" y1="3" x2="50" y2="61" />
    <circle cx="50" cy="32" r="10" />
    <rect x="3" y="20" width="12" height="24" />
    <rect x="85" y="20" width="12" height="24" />
    <path d="M15 26a8 8 0 0 1 0 12" />
    <path d="M85 26a8 8 0 0 0 0 12" />
  </svg>
);

const provider = new GoogleAuthProvider();

const positionOrder: Record<string, number> = {
  'FWD': 1,
  'MID': 2,
  'DEF': 3,
  'GK': 4,
  'SUB': 5
};

const sortPlayersByPosition = (players: Player[]) => {
  return [...players].sort((a, b) => {
    const orderA = positionOrder[a.position || 'SUB'] || 99;
    const orderB = positionOrder[b.position || 'SUB'] || 99;
    if (orderA !== orderB) return orderA - orderB;
    return a.name.localeCompare(b.name);
  });
};

const formatTeamName = (name: string) => {
  if (!name) return "";
  return name
    .replace(/\bFC\b/gi, '')
    .replace(/\bF\.C\.?\b/gi, '')
    .replace(/\bFootball Club\b/gi, '')
    .trim();
};

const getTeamShortName = (team?: Team, placeholder?: string) => {
  if (team?.shortName) return team.shortName;
  if (team) {
    const original = team.name.trim();
    if (original.toUpperCase().startsWith("FC ")) {
      const words = original.split(/\s+/);
      if (words.length > 1) return ("FC" + words[1].charAt(0)).toUpperCase();
    }
    if (original.toUpperCase().endsWith(" FC")) {
      const words = original.split(/\s+/);
      if (words.length > 1) return (words[0].charAt(0) + "FC").toUpperCase();
    }
    const sanitized = formatTeamName(team.name);
    return sanitized.substring(0, 3).toUpperCase();
  }
  return placeholder ? placeholder.substring(0, 3).toUpperCase() : 'TBD';
};

// Sub-components will be defined or imported here
// For brevity in one file, I'll define some inline or use a simple router pattern

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [view, setView] = useState<'home' | 'tournament' | 'create-tournament' | 'dashboard' | 'join-team'>('home');
  const [dashboardTab, setDashboardTab] = useState<'tournaments' | 'teams' | 'profile' | 'following'>('tournaments');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
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
      {/* Static Horizontal Top Header */}
      <header className="sticky top-0 z-[100] w-full bg-white/70 backdrop-blur-3xl border-b border-black/5 px-4 md:px-8 h-16 md:h-20 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-2.5 bg-slate-100 rounded-xl lg:hidden text-slate-600 hover:bg-emerald-50 hover:text-emerald-500 transition-all active:scale-95"
          >
            <Menu className="w-6 h-6" />
          </button>
          
          <div 
            className="flex items-center gap-2 md:gap-3 cursor-pointer group" 
            onClick={() => { setView('home'); setSelectedTournament(null); }}
          >
            <div className="bg-emerald-500 p-1.5 md:p-2 rounded-xl shadow-lg shadow-emerald-500/20 group-hover:rotate-6 transition-transform">
              <Trophy className="text-white w-5 h-5 md:w-6 md:h-6" />
            </div>
            <span className="font-black text-xl md:text-2xl tracking-tighter uppercase italic text-slate-900">Kickivo</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <button 
              onClick={() => { setView('dashboard'); setDashboardTab('profile'); }}
              className="group flex items-center gap-2.5 p-1 bg-black/5 rounded-full hover:bg-black/10 transition-all border border-transparent hover:border-black/5"
            >
              <img 
                src={user.photoURL || ''} 
                alt="" 
                className="w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-white shadow-sm group-hover:scale-105 transition-transform" 
              />
              <span className="hidden sm:inline-block pr-3 text-[10px] font-black uppercase tracking-widest text-slate-600">Profile</span>
            </button>
          ) : (
            <button 
              onClick={login}
              className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20"
            >
              <LogIn className="w-4 h-4" /> Sign In
            </button>
          )}
        </div>
      </header>

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
      {/* Top Navbar Removed - Replaced by Side Panel */}

      <div className="max-w-7xl mx-auto px-4 pt-8 md:pt-12 pb-24 md:pb-12 w-full lg:pl-0">
        <div className="flex flex-col lg:flex-row gap-8 min-h-[80vh] relative">
          
          {/* Sidebar Drawer Container */}
          <AnimatePresence>
            {(isSidebarOpen || (typeof window !== 'undefined' && window.innerWidth >= 1024)) && (
              <motion.aside 
                initial={{ x: -300, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -300, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className={`fixed lg:sticky top-0 lg:top-0 left-0 h-screen z-[200] lg:z-0 w-80 lg:w-72 shrink-0 transition-all ${isSidebarOpen ? 'block' : 'hidden lg:block'}`}
              >
                {/* Mobile Backdrop */}
                <div 
                  className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm lg:hidden z-[-1]" 
                  onClick={() => setIsSidebarOpen(false)}
                />

                <div className="bg-white/90 backdrop-blur-3xl lg:border-r border-black/5 p-6 lg:p-8 flex flex-col h-full overflow-y-auto lg:overflow-visible">
                  {/* Branding Header with Icon & Logo */}
                  <div 
                    className="flex items-center gap-4 cursor-pointer group pb-8 mb-6 border-b border-black/5" 
                    onClick={() => { setView('home'); setSelectedTournament(null); setIsSidebarOpen(false); }}
                  >
                    <div className="relative">
                      <div className="absolute inset-0 bg-emerald-400 blur-xl opacity-30 group-hover:opacity-50 transition-opacity" />
                      <div className="bg-emerald-500 p-2.5 rounded-2xl shadow-lg shadow-emerald-500/20 group-hover:rotate-6 transition-transform relative z-10">
                        <PitchIcon className="text-white w-6 h-6" />
                      </div>
                    </div>
                    <div>
                      <h1 className="font-black text-2xl tracking-tighter uppercase italic text-slate-900 leading-none">Kickivo</h1>
                      <p className="text-[9px] font-black uppercase text-emerald-500 tracking-[0.2em] mt-1">Official Hub</p>
                    </div>
                  </div>

                  {user ? (
                    <div className="flex flex-col flex-1">
                      {/* User Top Profile */}
                      <div 
                        className="flex items-center gap-4 p-4 rounded-3xl bg-black/5 mb-8 hover:bg-black/10 transition-colors cursor-pointer group"
                        onClick={() => { setView('dashboard'); setDashboardTab('profile'); setIsSidebarOpen(false); }}
                      >
                        <div className="relative shrink-0">
                          <img 
                            src={user.photoURL || ''} 
                            alt="" 
                            className="w-12 h-12 rounded-2xl shadow-md border-2 border-white group-hover:scale-105 transition-all duration-300" 
                          />
                          <div className="absolute -bottom-0.5 -right-0.5 bg-emerald-500 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-slate-900 text-sm truncate leading-tight">{user.displayName}</h3>
                          <p className="text-[10px] font-medium text-slate-400 truncate uppercase mt-0.5 tracking-wider">Player Level 01</p>
                        </div>
                      </div>

                      {/* Side Panel Navigation */}
                      <nav className="space-y-2 flex-1">
                        <button 
                          onClick={() => { setView('home'); setIsSidebarOpen(false); }}
                          className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all group ${view === 'home' ? 'bg-emerald-500 text-white shadow-xl shadow-emerald-500/30 font-black' : 'text-slate-500 hover:bg-black/5'}`}
                        >
                          <PitchIcon className={`w-5 h-5 ${view === 'home' ? 'text-white' : 'text-emerald-500'}`} />
                          <span className="text-[10px] uppercase tracking-widest">Explore Matches</span>
                        </button>
                        <button 
                          onClick={() => { setView('dashboard'); setDashboardTab('tournaments'); setIsSidebarOpen(false); }}
                          className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all group ${view === 'dashboard' && dashboardTab === 'tournaments' ? 'bg-slate-900 text-white shadow-xl shadow-slate-900/30 font-black' : 'text-slate-500 hover:bg-black/5'}`}
                        >
                          <div className="flex items-center gap-4">
                            <RefreshCw className={`w-5 h-5 ${view === 'dashboard' && dashboardTab === 'tournaments' ? 'text-white' : 'text-slate-400'}`} />
                            <span className="text-[10px] uppercase tracking-widest">Organize</span>
                          </div>
                        </button>
                        <button 
                          onClick={() => { setView('dashboard'); setDashboardTab('following'); setIsSidebarOpen(false); }}
                          className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all group ${view === 'dashboard' && dashboardTab === 'following' ? 'bg-slate-900 text-white shadow-xl shadow-slate-900/30 font-black' : 'text-slate-500 hover:bg-black/5'}`}
                        >
                          <div className="flex items-center gap-4">
                            <Star className={`w-5 h-5 ${view === 'dashboard' && dashboardTab === 'following' ? 'text-white' : 'text-amber-400'}`} />
                            <span className="text-[10px] uppercase tracking-widest">Following</span>
                          </div>
                        </button>
                        <button 
                          onClick={() => { setView('dashboard'); setDashboardTab('teams'); setIsSidebarOpen(false); }}
                          className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all group ${view === 'dashboard' && dashboardTab === 'teams' ? 'bg-slate-900 text-white shadow-xl shadow-slate-900/30 font-black' : 'text-slate-500 hover:bg-black/5'}`}
                        >
                          <div className="flex items-center gap-4">
                            <Users className={`w-5 h-5 ${view === 'dashboard' && dashboardTab === 'teams' ? 'text-white' : 'text-blue-500'}`} />
                            <span className="text-[10px] uppercase tracking-widest">Squads</span>
                          </div>
                        </button>
                      </nav>

                      {/* Logout at bottom */}
                      <div className="mt-auto pt-8 border-t border-black/5">
                        <button 
                          onClick={() => { logout(); setIsSidebarOpen(false); }}
                          className="w-full flex items-center gap-4 p-4 rounded-2xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all font-black text-[10px] uppercase tracking-widest group"
                        >
                          <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                          <span>Logout</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6 flex flex-col items-center py-8">
                       <Shield className="w-16 h-16 text-slate-100 mb-2" />
                       <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center leading-relaxed px-4">
                         Please sign in to access your tournament control panel
                       </p>
                       <button 
                         onClick={login}
                         className="w-full flex items-center justify-center gap-3 p-5 rounded-2xl bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20 active:scale-95"
                       >
                         <LogIn className="w-5 h-5" />
                         <span>Direct Sign In</span>
                       </button>
                    </div>
                  )}
                </div>
              </motion.aside>
            )}
          </AnimatePresence>

          {/* Main Content Area */}
          <main className="flex-1 min-w-0">
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
                      setView('dashboard');
                      setDashboardTab('tournaments');
                      notify('Tournament created successfully!');
                    }} 
                    onError={handleError}
                  />
                </motion.div>
              )}
              {view === 'join-team' && user && joinData && (
                <motion.div key="join" className="max-w-xl mx-auto">
                  <JoinTeamView 
                    teamId={joinData.teamId} 
                    tournamentId={joinData.tournamentId} 
                    user={user}
                    onSuccess={() => {
                       setView('dashboard');
                       setDashboardTab('teams');
                       notify('Successfully joined the team!');
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
                    activeTab={dashboardTab}
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
      </div>

      {/* Mobile Bottom Nav - glass design */}
      {user && (
        <nav className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-[90%] h-16 bg-white/60 backdrop-blur-2xl border border-white/40 rounded-[32px] shadow-[0_12px_40px_rgba(0,0,0,0.12)] flex items-center justify-around px-2">
          {[
            { id: 'home', icon: PitchIcon, label: 'Explore' },
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
  const [matchesPerDay, setMatchesPerDay] = useState(8);
  const [startTime, setStartTime] = useState('10:00');
  const [matchDuration, setMatchDuration] = useState(30);
  const [homeAwayGroup, setHomeAwayGroup] = useState(false);
  const [homeAwayKnockout, setHomeAwayKnockout] = useState(false);
  const [useDemoData, setUseDemoData] = useState(false);
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
        matchesPerDay: Number(matchesPerDay),
        startTime,
        matchDuration: Number(matchDuration),
        homeAwayGroup: type === 'knockout' ? false : homeAwayGroup,
        homeAwayKnockout: type === 'league' ? false : homeAwayKnockout,
        creatorId: user.uid,
        status: 'upcoming',
        createdAt: new Date().toISOString()
      });

      if (useDemoData) {
        // Create demo teams with recognizable names
        const pool = [
          'Real Madrid', 'FC Barcelona', 'Manchester City', 'Liverpool FC', 'Arsenal', 
          'Chelsea', 'PSG', 'Bayern Munich', 'Juventus', 'AC Milan', 
          'Inter Milan', 'Manchester United', 'Atletico Madrid', 'Borussia Dortmund', 'Bayer Leverkusen', 'Tottenham'
        ];
        const realRosters: Record<string, string[]> = {
          'Real Madrid': [
            'Thibaut Courtois', 'Dani Carvajal', 'Eder Militao', 'Antonio Rudiger', 'Ferland Mendy',
            'Federico Valverde', 'Aurelien Tchouameni', 'Jude Bellingham', 'Rodrygo Goes', 'Kylian Mbappe',
            'Vinicius Junior', 'Endrick', 'Arda Guler', 'Eduardo Camavinga', 'Brahim Diaz'
          ],
          'FC Barcelona': [
            'Ter Stegen', 'Jules Kounde', 'Pau Cubarsi', 'Ronald Araujo', 'Alejandro Balde',
            'Frenkie de Jong', 'Pedri', 'Gavi', 'Lamine Yamal', 'Robert Lewandowski',
            'Raphinha', 'Ferran Torres', 'Ilkay Gundogan', 'Andreas Christensen', 'Fermin Lopez'
          ],
          'Manchester City': [
            'Ederson', 'Kyle Walker', 'Ruben Dias', 'Manuel Akanji', 'Josko Gvardiol',
            'Rodri', 'Kevin De Bruyne', 'Bernardo Silva', 'Phil Foden', 'Erling Haaland',
            'Jeremy Doku', 'Jack Grealish', 'Mateo Kovacic', 'John Stones', 'Nathan Ake'
          ],
          'Liverpool FC': [
            'Alisson Becker', 'Trent Alexander-Arnold', 'Ibrahima Konate', 'Virgil van Dijk', 'Andrew Robertson',
            'Alexis Mac Allister', 'Dominik Szoboszlai', 'Ryan Gravenberch', 'Mohamed Salah', 'Darwin Nunez',
            'Luis Diaz', 'Cody Gakpo', 'Diogo Jota', 'Harvey Elliott', 'Curtis Jones'
          ],
          'Arsenal': [
            'David Raya', 'Ben White', 'William Saliba', 'Gabriel Magalhaes', 'Riccardo Calafiori',
            'Declan Rice', 'Martin Odegaard', 'Mikel Merino', 'Bukayo Saka', 'Kai Havertz',
            'Gabriel Martinelli', 'Leandro Trossard', 'Gabriel Jesus', 'Jurrien Timber', 'Jorginho'
          ],
          'Chelsea': [
            'Robert Sanchez', 'Reece James', 'Wesley Fofana', 'Levi Colwill', 'Marc Cucurella',
            'Enzo Fernandez', 'Moises Caicedo', 'Cole Palmer', 'Noni Madueke', 'Nicolas Jackson',
            'Christopher Nkunku', 'Jadon Sancho', 'Joao Felix', 'Pedro Neto', 'Romeo Lavia'
          ],
          'PSG': [
            'Gianluigi Donnarumma', 'Achraf Hakimi', 'Marquinhos', 'Willian Pacho', 'Nuno Mendes',
            'Warren Zaire-Emery', 'Vitinha', 'Fabian Ruiz', 'Ousmane Dembele', 'Bradley Barcola',
            'Randal Kolo Muani', 'Goncalo Ramos', 'Marco Asensio', 'Lee Kang-in', 'Lucas Beraldo'
          ],
          'Bayern Munich': [
            'Manuel Neuer', 'Joshua Kimmich', 'Dayot Upamecano', 'Kim Min-jae', 'Alphonso Davies',
            'Aleksandar Pavlovic', 'Joao Palhinha', 'Jamal Musiala', 'Michael Olise', 'Harry Kane',
            'Leroy Sane', 'Serge Gnabry', 'Thomas Muller', 'Kingsley Coman', 'Konrad Laimer'
          ],
          'Juventus': [
            'Michele Di Gregorio', 'Nicolo Savona', 'Federico Gatti', 'Gleison Bremer', 'Andrea Cambiaso',
            'Manuel Locatelli', 'Douglas Luiz', 'Teun Koopmeiners', 'Kenan Yildiz', 'Dusan Vlahovic',
            'Nico Gonzalez', 'Francisco Conceicao', 'Khephren Thuram', 'Weston McKennie', 'Timothy Weah'
          ],
          'AC Milan': [
            'Mike Maignan', 'Emerson Royal', 'Fikayo Tomori', 'Strahinja Pavlovic', 'Theo Hernandez',
            'Youssouf Fofana', 'Tijjani Reijnders', 'Ruben Loftus-Cheek', 'Christian Pulisic', 'Alvaro Morata',
            'Rafael Leao', 'Samuel Chukwueze', 'Tammy Abraham', 'Ismael Bennacer', 'Davide Calabria'
          ],
          'Inter Milan': [
            'Yann Sommer', 'Benjamin Pavard', 'Francesco Acerbi', 'Alessandro Bastoni', 'Denzel Dumfries',
            'Nicolo Barella', 'Hakan Calhanoglu', 'Henrikh Mkhitaryan', 'Federico Dimarco', 'Lautaro Martinez',
            'Marcus Thuram', 'Mehdi Taremi', 'Davide Frattesi', 'Piotr Zielinski', 'Stefan de Vrij'
          ],
          'Manchester United': [
            'Andre Onana', 'Diogo Dalot', 'Matthijs de Ligt', 'Lisandro Martinez', 'Noussair Mazraoui',
            'Kobbie Mainoo', 'Manuel Ugarte', 'Bruno Fernandes', 'Alejandro Garnacho', 'Rasmus Hojlund',
            'Marcus Rashford', 'Amad Diallo', 'Joshua Zirkzee', 'Harry Maguire', 'Christian Eriksen'
          ],
          'Atletico Madrid': [
            'Jan Oblak', 'Nahuel Molina', 'Robin Le Normand', 'Jose Maria Gimenez', 'Reinildo',
            'Rodrigo De Paul', 'Koke', 'Conor Gallagher', 'Antoine Griezmann', 'Julian Alvarez',
            'Alexander Sorloth', 'Samuel Lino', 'Marcos Llorente', 'Angel Correa', 'Rodrigo Riquelme'
          ],
          'Borussia Dortmund': [
            'Gregor Kobel', 'Yan Couto', 'Waldemar Anton', 'Nico Schlotterbeck', 'Julian Ryerson',
            'Emre Can', 'Pascal Gross', 'Julian Brandt', 'Marcel Sabitzer', 'Serhou Guirassy',
            'Karim Adeyemi', 'Jamie Gittens', 'Donyell Malen', 'Maximilian Beier', 'Felix Nmecha'
          ],
          'Bayer Leverkusen': [
            'Lukas Hradecky', 'Edmond Tapsoba', 'Jonathan Tah', 'Piero Hincapie', 'Jeremie Frimpong',
            'Granit Xhaka', 'Robert Andrich', 'Alejandro Grimaldo', 'Florian Wirtz', 'Victor Boniface',
            'Martin Terrier', 'Patrik Schick', 'Aleix Garcia', 'Jonas Hofmann', 'Exequiel Palacios'
          ],
          'Tottenham': [
            'Guglielmo Vicario', 'Pedro Porro', 'Cristian Romero', 'Micky van de Ven', 'Destiny Udogie',
            'Yves Bissouma', 'James Maddison', 'Rodrigo Bentancur', 'Dejan Kulusevski', 'Dominic Solanke',
            'Heung-min Son', 'Brennan Johnson', 'Richarlison', 'Lucas Bergvall', 'Archie Gray'
          ]
        };

        const shortNames: Record<string, string> = {
          'Real Madrid': 'RM',
          'FC Barcelona': 'FCB',
          'Manchester City': 'MC',
          'Liverpool FC': 'LFC',
          'Arsenal': 'ARS',
          'Chelsea': 'CHE',
          'PSG': 'PSG',
          'Bayern Munich': 'FCB',
          'Juventus': 'JUV',
          'AC Milan': 'ACM',
          'Inter Milan': 'INT',
          'Manchester United': 'MU',
          'Atletico Madrid': 'ATM',
          'Borussia Dortmund': 'BVB',
          'Bayer Leverkusen': 'B04',
          'Tottenham': 'TOT'
        };
        
        const actualTeamsCount = Number(maxTeams);
        for (let tIdx = 0; tIdx < actualTeamsCount; tIdx++) {
          const baseTeamName = pool[tIdx % pool.length];
          const teamName = baseTeamName + (tIdx >= pool.length ? ` ${Math.floor(tIdx / pool.length) + 1}` : '');
          const teamRef = await addDoc(collection(db, `tournaments/${docRef.id}/teams`), {
            name: teamName,
            createdAt: serverTimestamp(),
          });

          // Add players - use real rosters if available, else generate
          const positions = ['GK', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'FWD', 'FWD', 'SUB', 'SUB', 'SUB'];
          const sn = shortNames[baseTeamName] || teamName.split(' ').map(w => w[0]).join('').toUpperCase();
          const roster = realRosters[baseTeamName];

          for (let i = 1; i <= 12; i++) {
            const playerName = (roster && roster[i-1]) ? roster[i-1] : `${sn} Player ${i}`;
            await addDoc(collection(db, `tournaments/${docRef.id}/teams/${teamRef.id}/players`), {
              name: playerName,
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Matches Per Day</label>
            <input 
              type="number"
              required
              min="1"
              max="24"
              value={matchesPerDay}
              onChange={e => setMatchesPerDay(Number(e.target.value))}
              className="w-full bg-slate-50 px-5 py-4 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              placeholder="e.g. 8"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-slate-400">First Match Time</label>
            <input 
              type="time"
              required
              value={startTime}
              onChange={e => setStartTime(e.target.value)}
              className="w-full bg-slate-50 px-5 py-4 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Match Duration (mins)</label>
            <input 
              type="number"
              required
              min="5"
              max="180"
              value={matchDuration}
              onChange={e => setMatchDuration(Number(e.target.value))}
              className="w-full bg-slate-50 px-5 py-4 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              placeholder="e.g. 30"
            />
          </div>
          <div className="space-y-4 pt-4">
             <div className="flex items-center gap-3">
               <input 
                 type="checkbox"
                 id="ha-group"
                 disabled={type === 'knockout'}
                 checked={homeAwayGroup}
                 onChange={e => setHomeAwayGroup(e.target.checked)}
                 className="w-5 h-5 accent-emerald-500 cursor-pointer disabled:opacity-30"
               />
               <label htmlFor="ha-group" className={`text-xs font-bold text-slate-500 cursor-pointer ${type === 'knockout' ? 'opacity-30' : ''}`}>Home & Away (Groups)</label>
             </div>
             <div className="flex items-center gap-3">
               <input 
                 type="checkbox"
                 id="ha-knockout"
                 disabled={type === 'league'}
                 checked={homeAwayKnockout}
                 onChange={e => setHomeAwayKnockout(e.target.checked)}
                 className="w-5 h-5 accent-emerald-500 cursor-pointer disabled:opacity-30"
               />
               <label htmlFor="ha-knockout" className={`text-xs font-bold text-slate-500 cursor-pointer ${type === 'league' ? 'opacity-30' : ''}`}>Home & Away (Knockout)</label>
             </div>
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
              Initialize with Full Demo Data <span className="text-[10px] text-red-500 uppercase tracking-tighter ml-1">(Live Testing)</span>
              <p className="text-[10px] text-slate-400 font-medium">Automatically populates all {maxTeams} team slots with realistic squads and players.</p>
            </label>
          </div>
          
          {/* Demo teams count input removed - uses maxTeams by default */}
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

function TeamSlot({ id, teams, small = false }: { id?: string, teams: Team[], small?: boolean }) {
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
}

function BracketMatch({ match, teams, position, onSelect, compact = false }: { match: Match, teams: Team[], position: 'left' | 'right', onSelect: (m: Match) => void, key?: React.Key, compact?: boolean }) {
  const teamA = teams.find(t => t.id === match.teamAId);
  const teamB = teams.find(t => t.id === match.teamBId);
  const isFinished = match.status === 'finished';
  const isAWinner = isFinished && (match.scoreA > match.scoreB || (match.scoreA === match.scoreB && (match.pensA || 0) > (match.pensB || 0)));
  const isBWinner = isFinished && (match.scoreB > match.scoreA || (match.scoreA === match.scoreB && (match.pensB || 0) > (match.pensA || 0)));

  const displayAName = teamA ? formatTeamName(teamA.name) : (match.placeholderA || 'TBD');
  const displayAShort = getTeamShortName(teamA, match.placeholderA);
  const displayBName = teamB ? formatTeamName(teamB.name) : (match.placeholderB || 'TBD');
  const displayBShort = getTeamShortName(teamB, match.placeholderB);

  return (
    <div className="relative group">
      {match.leg && (
        <div className={`absolute -top-3 ${position === 'left' ? 'right-4 text-right' : 'left-4 text-left'} bg-slate-50 text-[8px] font-black uppercase tracking-widest text-slate-400 px-2 py-0.5 rounded-full border border-slate-100 z-10 shadow-sm transition-all group-hover:bg-emerald-50 group-hover:text-emerald-500`}>
          Leg {match.leg}
        </div>
      )}
      <div 
        onClick={() => onSelect(match)}
        className={`${compact ? 'w-full' : 'w-64'} bg-white border border-slate-200 rounded-3xl p-5 cursor-pointer hover:border-emerald-500/50 transition-all shadow-sm hover:shadow-md ${position === 'left' ? 'text-right' : 'text-left'}`}
      >
        <div className="space-y-3">
          <div className={`flex items-center gap-3 ${position === 'left' ? 'flex-row-reverse' : 'flex-row'}`}>
            <TeamSlot id={match.teamAId} teams={teams} small />
            <div className={`flex-1 min-w-0 ${position === 'left' ? 'text-right' : 'text-left'}`}>
              <div className={`text-xs font-black uppercase tracking-tighter truncate ${isAWinner ? 'text-emerald-500' : 'text-slate-900'}`}>
                {displayAName}
              </div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{displayAShort}</div>
            </div>
            <div className="flex flex-col items-center">
              <span className={`text-xl font-black tabular-nums ${isAWinner ? 'text-emerald-500' : 'text-slate-300'}`}>
                {match.status === 'scheduled' ? '-' : match.scoreA}
              </span>
              {match.pensA !== undefined && (
                <span className="text-[8px] font-black text-amber-500 mt-[-4px]">({match.pensA})</span>
              )}
            </div>
          </div>
          <div className={`flex items-center gap-3 ${position === 'left' ? 'flex-row-reverse' : 'flex-row'}`}>
            <TeamSlot id={match.teamBId} teams={teams} small />
            <div className={`flex-1 min-w-0 ${position === 'left' ? 'text-right' : 'text-left'}`}>
              <div className={`text-xs font-black uppercase tracking-tighter truncate ${isBWinner ? 'text-emerald-500' : 'text-slate-900'}`}>
                {displayBName}
              </div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{displayBShort}</div>
            </div>
            <div className="flex flex-col items-center">
              <span className={`text-xl font-black tabular-nums ${isBWinner ? 'text-emerald-500' : 'text-slate-300'}`}>
                {match.status === 'scheduled' ? '-' : match.scoreB}
              </span>
              {match.pensB !== undefined && (
                <span className="text-[8px] font-black text-amber-500 mt-[-4px]">({match.pensB})</span>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Curved Connectors */}
      <div className={`hidden md:block absolute top-1/2 ${position === 'left' ? '-right-12' : '-left-12'} w-12 h-px bg-slate-200 -z-0`} />
    </div>
  );
}

function TournamentView({ tournament, user, onBack, onError, notify }: { tournament: Tournament, user: FirebaseUser | null, onBack: () => void, onError: (err: any) => void, notify: (msg: string) => void }) {
  const [activeTab, setActiveTab] = useState<'matches' | 'teams' | 'standings' | 'stats' | 'knockout'>('matches');
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

  const tiesByRound = useMemo(() => {
    const playoffMatches = matches.filter(m => m.group === 'Playoffs');
    const rounds = ['Round of 16', 'Quarter-final', 'Semi-final', 'Final'];
    const result: Record<string, Match[][]> = {};
    
    rounds.forEach(r => {
      const rm = playoffMatches.filter(m => m.round === r);
      if (tournament.homeAwayKnockout) {
        const ties: Record<string, Match[]> = {};
        rm.forEach(m => {
          const tid = m.tieId || m.id;
          if (!ties[tid]) ties[tid] = [];
          ties[tid].push(m);
        });
        result[r] = Object.values(ties).sort((a, b) => {
          const timeA = a[0].kickoff?.seconds || a[0].createdAt?.seconds || 0;
          const timeB = b[0].kickoff?.seconds || b[0].createdAt?.seconds || 0;
          return timeA - timeB;
        });
      } else {
        result[r] = rm.map(m => [m]);
      }
    });
    return result;
  }, [matches, tournament.homeAwayKnockout]);

  const allMatchesScheduled = useMemo(() => {
    if (teams.length < 2) return false;
    if (tournament.type === 'league') {
      const base = (teams.length * (teams.length - 1)) / 2;
      const expected = tournament.homeAwayGroup ? base * 2 : base;
      return matches.length >= expected;
    }
    if (tournament.type === 'league_playoff') {
      const numGroups = tournament.numberOfGroups || 2;
      let totalExpected = 0;
      for (let i = 0; i < numGroups; i++) {
        const gName = `Group ${String.fromCharCode(65 + i)}`;
        const gTeams = teams.filter(t => t.group === gName).length;
        if (gTeams >= 2) {
          const base = (gTeams * (gTeams - 1)) / 2;
          totalExpected += tournament.homeAwayGroup ? base * 2 : base;
        }
      }
      const hasPlayoffs = matches.some(m => m.group === 'Playoffs');
      return (matches.length >= totalExpected && totalExpected > 0) || hasPlayoffs;
    }
    if (tournament.type === 'knockout') {
      return matches.length > 0;
    }
    return false;
  }, [teams, matches, tournament]);

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
      const allMatches: any[] = [];
      
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
          shuffledTeams[i] = { ...shuffledTeams[i], group: groupName };
        }

        // Generate matches for each group
        for (let g = 0; g < numGroups; g++) {
          const groupChar = String.fromCharCode(65 + g);
          const groupName = `Group ${groupChar}`;
          const groupTeams = shuffledTeams.filter(t => t.group === groupName);
          
          for (let i = 0; i < groupTeams.length; i++) {
            for (let j = i + 1; j < groupTeams.length; j++) {
              allMatches.push({
                teamAId: groupTeams[i].id,
                teamBId: groupTeams[j].id,
                group: groupName,
              });
              if (tournament.homeAwayGroup) {
                allMatches.push({
                  teamAId: groupTeams[j].id,
                  teamBId: groupTeams[i].id,
                  group: groupName,
                });
              }
            }
          }
        }
      } else {
        // Simple Round Robin
        for (let i = 0; i < teams.length; i++) {
          for (let j = i + 1; j < teams.length; j++) {
            allMatches.push({
              teamAId: teams[i].id,
              teamBId: teams[j].id,
            });
            if (tournament.homeAwayGroup) {
              allMatches.push({
                teamAId: teams[j].id,
                teamBId: teams[i].id,
              });
            }
          }
        }
      }

      // Scheduling with rest logic
      // Shuffle matches first for variety
      allMatches.sort(() => Math.random() - 0.5);

      const scheduledMatches: any[] = [];
      const teamLastMatchTime: { [teamId: string]: number } = {};
      
      const REST_PERIOD = 60 * 60 * 1000; // 1 hour minimum rest
      const MATCH_DURATION = (tournament.matchDuration || 30) * 60 * 1000;
      const MATCHES_PER_DAY = tournament.matchesPerDay || 8;
      const START_TIME_STR = tournament.startTime || '10:00';
      const [startHour, startMin] = START_TIME_STR.split(':').map(Number);
      
      // Start from tomorrow at the preferred time
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 1);
      startDate.setHours(startHour, startMin, 0, 0);
      let currentStartTime = startDate.getTime();

      let matchesScheduledCount = 0;

      while (allMatches.length > 0) {
        let matchFound = false;
        for (let i = 0; i < allMatches.length; i++) {
          const m = allMatches[i];
          const lastA = teamLastMatchTime[m.teamAId] || 0;
          const lastB = teamLastMatchTime[m.teamBId] || 0;

          if (currentStartTime >= lastA + REST_PERIOD && currentStartTime >= lastB + REST_PERIOD) {
            // Schedule it
            scheduledMatches.push({
              ...m,
              kickoff: Timestamp.fromMillis(currentStartTime),
              scoreA: 0,
              scoreB: 0,
              status: 'scheduled',
              tournamentId: tournament.id,
              createdAt: serverTimestamp(),
            });

            teamLastMatchTime[m.teamAId] = currentStartTime + MATCH_DURATION;
            teamLastMatchTime[m.teamBId] = currentStartTime + MATCH_DURATION;
            
            allMatches.splice(i, 1);
            matchFound = true;
            matchesScheduledCount++;

            // Move to next slot
            if (matchesScheduledCount % MATCHES_PER_DAY === 0) {
              // Move to next day
              const nextDay = new Date(currentStartTime);
              nextDay.setDate(nextDay.getDate() + 1);
              nextDay.setHours(startHour, startMin, 0, 0);
              currentStartTime = nextDay.getTime();
            } else {
              currentStartTime += MATCH_DURATION;
            }
            break;
          }
        }

        if (!matchFound) {
          // No match fits the rest period in this slot, skip slot
          currentStartTime += MATCH_DURATION;
          // Avoid infinite loop if somehow impossible
          if (currentStartTime > Date.now() + 30 * 24 * 60 * 60 * 1000) break;
        }
      }

      // Batch add
      for (const m of scheduledMatches) {
        await addDoc(collection(db, `/tournaments/${tournament.id}/matches`), m);
      }

      notify('Fixtures generated with smart scheduling!');
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
        const createMatch = async (matchData: any) => {
            const docRef = await addDoc(collection(db, `/tournaments/${tournament.id}/matches`), {
                scoreA: 0, 
                scoreB: 0, 
                status: 'scheduled', 
                tournamentId: tournament.id, 
                group: 'Playoffs', 
                createdAt: serverTimestamp(),
                ...matchData
            });
            return docRef.id;
        };

        const createMatchPair = async (matchData: any) => {
            const tieId = `tie-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const id1 = await createMatch({ 
              ...matchData, 
              ...(tournament.homeAwayKnockout ? { leg: 1, tieId } : {})
            });
            if (tournament.homeAwayKnockout) {
                const id2 = await createMatch({
                    ...matchData,
                    ...(matchData.teamBId ? { teamAId: matchData.teamBId } : {}),
                    ...(matchData.teamAId ? { teamBId: matchData.teamAId } : {}),
                    ...(matchData.placeholderB ? { placeholderA: matchData.placeholderB } : {}),
                    ...(matchData.placeholderA ? { placeholderB: matchData.placeholderA } : {}),
                    leg: 2,
                    tieId
                });
                return { leg1Id: id1, leg2Id: id2 };
            }
            return { leg1Id: id1 };
        };

        const count = advancingTeams.length;
        if (count === 8) {
            // Quarter-finals
            const qfResults = [];
            for (let i = 0; i < 8; i += 2) {
                const res = await createMatchPair({
                    teamAId: advancingTeams[i].id,
                    teamBId: advancingTeams[i+1].id,
                    round: 'Quarter-final'
                });
                qfResults.push(res);
            }

            // Semi-finals
            const resSF1 = await createMatchPair({
                round: 'Semi-final',
                placeholderA: `Winner QF1`,
                placeholderB: `Winner QF2`
            });
            const resSF2 = await createMatchPair({
                round: 'Semi-final',
                placeholderA: `Winner QF3`,
                placeholderB: `Winner QF4`
            });

            // Final
            const resF = await createMatchPair({
                round: 'Final',
                placeholderA: `Winner SF1`,
                placeholderB: `Winner SF2`
            });

            // Link Successors
            const getSuccessorIds = (res: any) => res.leg2Id ? `${res.leg1Id},${res.leg2Id}` : res.leg1Id;

            const matchRefs = [
                { id: qfResults[0].leg2Id || qfResults[0].leg1Id, successorMatchId: getSuccessorIds(resSF1), successorSide: 'A' },
                { id: qfResults[1].leg2Id || qfResults[1].leg1Id, successorMatchId: getSuccessorIds(resSF1), successorSide: 'B' },
                { id: qfResults[2].leg2Id || qfResults[2].leg1Id, successorMatchId: getSuccessorIds(resSF2), successorSide: 'A' },
                { id: qfResults[3].leg2Id || qfResults[3].leg1Id, successorMatchId: getSuccessorIds(resSF2), successorSide: 'B' },
                { id: resSF1.leg2Id || resSF1.leg1Id, successorMatchId: getSuccessorIds(resF), successorSide: 'A' },
                { id: resSF2.leg2Id || resSF2.leg1Id, successorMatchId: getSuccessorIds(resF), successorSide: 'B' }
            ];

            for (const ref of matchRefs) {
                await updateDoc(doc(db, `/tournaments/${tournament.id}/matches/${ref.id}`), {
                    successorMatchId: ref.successorMatchId,
                    successorSide: ref.successorSide
                });
            }

        } else if (count === 4) {
            // Semi-finals
            const resSF1 = await createMatchPair({
                teamAId: advancingTeams[0].id,
                teamBId: advancingTeams[1].id,
                round: 'Semi-final'
            });
            const resSF2 = await createMatchPair({
                teamAId: advancingTeams[2].id,
                teamBId: advancingTeams[3].id,
                round: 'Semi-final'
            });

            // Final
            const resF = await createMatchPair({
                round: 'Final',
                placeholderA: `Winner SF1`,
                placeholderB: `Winner SF2`
            });

            const sf1Decider = resSF1.leg2Id || resSF1.leg1Id;
            const sf2Decider = resSF2.leg2Id || resSF2.leg1Id;
            const finalSuccessorIds = resF.leg2Id ? `${resF.leg1Id},${resF.leg2Id}` : resF.leg1Id;

            // Link Successors
            await updateDoc(doc(db, `/tournaments/${tournament.id}/matches/${sf1Decider}`), {
                successorMatchId: finalSuccessorIds, successorSide: 'A'
            });
            await updateDoc(doc(db, `/tournaments/${tournament.id}/matches/${sf2Decider}`), {
                successorMatchId: finalSuccessorIds, successorSide: 'B'
            });

        } else if (count === 2) {
            // Final
            await createMatchPair({
                teamAId: advancingTeams[0].id,
                teamBId: advancingTeams[1].id,
                round: 'Final'
            });
        } else {
            // Fallback for odd numbers or large numbers
            const roundName = count === 16 ? 'Round of 16' : 'Knockout';
            for (let i = 0; i < advancingTeams.length; i += 2) {
                if (advancingTeams[i+1]) {
                    await createMatchPair({
                        teamAId: advancingTeams[i].id,
                        teamBId: advancingTeams[i+1].id,
                        round: roundName
                    });
                }
            }
        }
        notify('Playoff bracket generated!');
    } catch (err) {
        onError(err);
        handleFirestoreError(err, OperationType.WRITE, 'matches');
    } finally {
        setIsGenerating(false);
    }
  };

  const generateNextRound = async () => {
    const playoffMatches = matches.filter(m => m.group === 'Playoffs');
    if (playoffMatches.length === 0) return;
    
    // Find latest round
    const rounds = ['Round of 16', 'Quarter-final', 'Semi-final', 'Final'];
    const currentRound = [...rounds].reverse().find(r => playoffMatches.some(m => m.round === r)) || 'Knockout';
    const currentRoundIndex = rounds.indexOf(currentRound);
    if (currentRoundIndex === -1 || currentRoundIndex >= rounds.length - 1) return notify('Tournament already at Final stage!');
    
    const nextRoundName = rounds[currentRoundIndex + 1];
    const currentRoundMatches = playoffMatches.filter(m => m.round === currentRound);
    
    if (!currentRoundMatches.every(m => m.status === 'finished')) {
      return onError(`Please finish all ${currentRound} matches before generating the next round.`);
    }

    if (playoffMatches.some(m => m.round === nextRoundName)) {
      return onError(`${nextRoundName} already generated!`);
    }

    const winners: string[] = [];
    
    if (tournament.homeAwayKnockout) {
      // Group by tieId
      const ties: Record<string, Match[]> = {};
      currentRoundMatches.forEach(m => {
        if (m.tieId) {
          if (!ties[m.tieId]) ties[m.tieId] = [];
          ties[m.tieId].push(m);
        }
      });

      Object.values(ties).forEach(legs => {
        const l1 = legs.find(m => m.leg === 1);
        const l2 = legs.find(m => m.leg === 2);
        if (l1 && l2) {
          const aggA = l1.scoreA + l2.scoreB;
          const aggB = l1.scoreB + l2.scoreA;
          if (aggA > aggB) winners.push(l1.teamAId);
          else if (aggB > aggA) winners.push(l1.teamBId);
          else winners.push((l2.pensA || 0) > (l2.pensB || 0) ? l2.teamAId : l2.teamBId);
        }
      });
    } else {
      currentRoundMatches.forEach(m => {
        if (m.scoreA > m.scoreB) winners.push(m.teamAId);
        else if (m.scoreB > m.scoreA) winners.push(m.teamBId);
        else winners.push((m.pensA || 0) > (m.pensB || 0) ? m.teamAId : m.teamBId);
      });
    }

    if (winners.length < 2) return onError('Not enough winners to generate next round.');

    setIsGenerating(true);
    try {
      for (let i = 0; i < winners.length; i += 2) {
        if (winners[i+1]) {
          const tieId = `tie-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          await addDoc(collection(db, `/tournaments/${tournament.id}/matches`), {
            teamAId: winners[i],
            teamBId: winners[i+1],
            scoreA: 0, scoreB: 0, status: 'scheduled', tournamentId: tournament.id, group: 'Playoffs', round: nextRoundName, createdAt: serverTimestamp(),
            ...(tournament.homeAwayKnockout ? { leg: 1, tieId } : {})
          });
          if (tournament.homeAwayKnockout) {
            await addDoc(collection(db, `/tournaments/${tournament.id}/matches`), {
              teamAId: winners[i+1],
              teamBId: winners[i],
              scoreA: 0, scoreB: 0, status: 'scheduled', tournamentId: tournament.id, group: 'Playoffs', round: nextRoundName, createdAt: serverTimestamp(),
              leg: 2,
              tieId
            });
          }
        }
      }
      notify(`${nextRoundName} generated successfully!`);
    } catch (err) {
      onError(err);
      handleFirestoreError(err, OperationType.WRITE, 'matches');
    } finally {
      setIsGenerating(false);
    }
  };

  const [isFollowing, setIsFollowing] = useState(false);
  const [followingId, setFollowingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, `users/${user.uid}/following`), where('tournamentId', '==', tournament.id));
    return onSnapshot(q, (s) => {
      setIsFollowing(!s.empty);
      setFollowingId(s.empty ? null : s.docs[0].id);
    });
  }, [user, tournament.id]);

  const toggleFollow = async () => {
    if (!user) return notify('Please sign in to follow');
    try {
      if (isFollowing && followingId) {
        await deleteDoc(doc(db, `users/${user.uid}/following`, followingId));
        notify('Unfollowed tournament');
      } else {
        await addDoc(collection(db, `users/${user.uid}/following`), {
          tournamentId: tournament.id,
          followedAt: serverTimestamp()
        });
        notify('Following tournament');
      }
    } catch (err) {
      onError(err);
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
        allPlayers={allPlayers}
        onBack={() => setSelectedMatch(null)}
        isCreator={isCreator}
        notify={notify}
        matches={matches}
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
          {(() => {
            const finalMatch = matches.find(m => m.round === 'Final' && m.status === 'finished');
            if (finalMatch) {
              const isAWinner = finalMatch.scoreA > finalMatch.scoreB ||
                (finalMatch.scoreA === finalMatch.scoreB && (finalMatch.pensA || 0) > (finalMatch.pensB || 0));
              const champion = teams.find(t => t.id === (isAWinner ? finalMatch.teamAId : finalMatch.teamBId));
              if (champion) return (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  className="flex items-center gap-2.5 bg-amber-50 border border-amber-200 px-4 py-2 rounded-full w-fit"
                >
                  <Trophy className="w-4 h-4 text-amber-500" />
                  <span className="text-amber-700 font-black text-sm tracking-wide">{champion.name}</span>
                  <span className="text-[10px] font-black text-amber-400 uppercase tracking-[0.2em]">Champions</span>
                </motion.div>
              );
            }
            if (tournament.type === 'league' && matches.length > 0 && matches.every(m => m.status === 'finished')) {
              const leader = getStandingsForGroup(undefined)[0];
              if (leader) return (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  className="flex items-center gap-2.5 bg-amber-50 border border-amber-200 px-4 py-2 rounded-full w-fit"
                >
                  <Trophy className="w-4 h-4 text-amber-500" />
                  <span className="text-amber-700 font-black text-sm tracking-wide">{leader.name}</span>
                  <span className="text-[10px] font-black text-amber-400 uppercase tracking-[0.2em]">Champions</span>
                </motion.div>
              );
            }
            return null;
          })()}
          <div className="flex items-center gap-4">
            <p className="text-slate-500 font-medium max-w-2xl">{tournament.description}</p>
            <button 
              onClick={toggleFollow}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all shadow-sm ${
                isFollowing ? 'bg-amber-100 text-amber-600 border border-amber-200' : 'bg-white border border-slate-200 text-slate-400 hover:text-amber-500'
              }`}
            >
              <Star className={`w-3.5 h-3.5 ${isFollowing ? 'fill-amber-500' : ''}`} />
              {isFollowing ? 'Following' : 'Follow'}
            </button>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap items-end">
          {isCreator && (
            <>
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
            {(() => {
              const playoffMatches = matches.filter(m => m.group === 'Playoffs');
              if (playoffMatches.length === 0) return null;
              
              const rounds = ['Round of 16', 'Quarter-final', 'Semi-final', 'Final'];
              const currentRound = [...rounds].reverse().find(r => playoffMatches.some(m => m.round === r)) || 'Knockout';
              const currentRoundIndex = rounds.indexOf(currentRound);
              
              if (currentRoundIndex === -1 || currentRoundIndex >= rounds.length - 1) return null;
              
              const nextRoundName = rounds[currentRoundIndex + 1];
              const nextRoundExists = playoffMatches.some(m => m.round === nextRoundName);
              
              if (nextRoundExists) return null;

              return (
                <button 
                  onClick={generateNextRound}
                  disabled={isGenerating || !playoffMatches.filter(m => m.round === currentRound).every(m => m.status === 'finished')}
                  className="px-4 py-2 bg-amber-50 text-amber-600 rounded-full text-sm font-bold flex items-center gap-2 hover:bg-amber-100 transition-all border border-amber-200 shadow-sm disabled:opacity-50"
                >
                  <ChevronRight className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} /> Generate Next Round
                </button>
              );
            })()}
            {!allMatchesScheduled && (
              <button 
                onClick={() => setShowAddMatch(true)}
                className="px-4 py-2 bg-emerald-500 text-white rounded-full text-sm font-bold flex items-center gap-2 hover:bg-emerald-600 transition-all shadow-lg"
              >
                <Calendar className="w-4 h-4" /> Schedule Match
              </button>
            )}
          </>
        )}
      </div>
    </div>

    {/* Upcoming Match Card Section */}
    {(() => {
      const nextMatch = matches
        .filter(m => m.status === 'scheduled')
        .sort((a, b) => {
          // Primary sort by kickoff time
          const timeA = a.kickoff?.seconds || a.createdAt?.seconds || 0;
          const timeB = b.kickoff?.seconds || b.createdAt?.seconds || 0;
          if (timeA !== timeB) return timeA - timeB;
          
          // Secondary sort by round precedence
          const roundOrder = ['Quarter-final', 'Semi-final', 'Final'];
          const orderA = roundOrder.indexOf(a.round || '');
          const orderB = roundOrder.indexOf(b.round || '');
          return (orderA === -1 ? 99 : orderA) - (orderB === -1 ? 99 : orderB);
        })[0];
      
      if (!nextMatch) return null;
      
      const teamA = teams.find(t => t.id === nextMatch.teamAId);
      const teamB = teams.find(t => t.id === nextMatch.teamBId);
      
      const roundLabel = nextMatch.round === 'Semi-final' ? 'SEMI FINALS' : nextMatch.round;
      
      return (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => setSelectedMatch(nextMatch)}
          className="bg-white border border-slate-100 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 group cursor-pointer hover:border-emerald-400 transition-all shadow-sm hover:shadow-xl relative overflow-hidden"
        >
          {/* Decorative background element */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-emerald-500/10 transition-all" />
          
          <div className="flex flex-col gap-1 w-full md:w-auto">
            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Upcoming Match
            </span>
            {nextMatch.round && <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{roundLabel}</span>}
          </div>

          <div className="flex items-center justify-center gap-8 md:gap-12 flex-1">
            <div className="flex flex-col items-center gap-3">
              {teamA?.logoURL ? (
                <img src={teamA.logoURL} className="w-12 h-12 md:w-16 md:h-16 rounded-full border-2 border-white shadow-md bg-slate-50" />
              ) : (
                <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-slate-50 flex items-center justify-center text-lg font-black text-slate-300 border-2 border-white shadow-md">{teamA?.name?.[0]}</div>
              )}
              <span className="text-sm md:text-lg font-black text-slate-900">{formatTeamName(teamA?.name || 'TBA')}</span>
            </div>

            <div className="flex flex-col items-center gap-2">
              <div className="px-6 py-2 bg-slate-900 text-white rounded-2xl shadow-lg transform -rotate-2 group-hover:rotate-0 transition-transform">
                <span className="text-lg md:text-2xl font-black italic">VS</span>
              </div>
              {nextMatch.kickoff && (
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{nextMatch.kickoff.toDate().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                  <span className="text-xs font-black text-emerald-500">{nextMatch.kickoff.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              )}
            </div>

            <div className="flex flex-col items-center gap-3">
              {teamB?.logoURL ? (
                <img src={teamB.logoURL} className="w-12 h-12 md:w-16 md:h-16 rounded-full border-2 border-white shadow-md bg-slate-50" />
              ) : (
                <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-slate-50 flex items-center justify-center text-lg font-black text-slate-300 border-2 border-white shadow-md">{teamB?.name?.[0]}</div>
              )}
              <span className="text-sm md:text-lg font-black text-slate-900">{formatTeamName(teamB?.name || 'TBA')}</span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2 text-slate-300 group-hover:text-emerald-500 transition-colors">
            <span className="text-[10px] font-black uppercase tracking-widest">Match Centre</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </motion.div>
      );
    })()}

      <div className="flex items-center gap-4 md:gap-8 border-b border-slate-200 overflow-x-auto scrollbar-hide no-scrollbar pt-2">
        {(['matches', 'knockout', 'standings', 'teams', 'stats'] as const).filter(t => {
          if (t === 'knockout') return tournament.type === 'league_playoff' || tournament.type === 'knockout';
          return true;
        }).map(tab => (
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
                  let groupName = 'Upcoming';
                  if (m.kickoff) {
                    const date = m.kickoff.toDate();
                    groupName = date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
                  } else if (m.group === 'Playoffs' && m.round) {
                    groupName = m.round;
                    // Simplify names as requested
                    if (groupName === 'Semi-final') groupName = 'SEMI FINALS';
                    if (groupName === 'Final') groupName = 'Final';
                  } else {
                    groupName = m.group || 'Regular Season';
                  }
                  
                  if (!acc[groupName]) acc[groupName] = [];
                  acc[groupName].push(m);
                  return acc;
                }, {} as { [key: string]: Match[] })
              ).map(([group, groupMatches]) => {
                const matchesList = (groupMatches as Match[]).sort((a, b) => {
                  if (a.kickoff && b.kickoff) return a.kickoff.seconds - b.kickoff.seconds;
                  return 0;
                });
                return (
                <div key={group} className="space-y-4">
                  <div className="flex items-center gap-3 px-2">
                      <div className="h-[2px] flex-1 bg-slate-100" />
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                        <Calendar className="w-3 h-3" /> {group}
                      </h3>
                      <div className="h-[2px] flex-1 bg-slate-100" />
                  </div>
                  <div className="space-y-2">
                      {matchesList.map(m => {
                        const teamA = teams.find(t => t.id === m.teamAId);
                        const teamB = teams.find(t => t.id === m.teamBId);
                        const isFinished = m.status === 'finished';
                        const isPenWin = m.scoreA === m.scoreB && (m.pensA !== undefined || m.pensB !== undefined);
                        const winnerA = isFinished && (m.scoreA > m.scoreB || (isPenWin && (m.pensA || 0) > (m.pensB || 0)));
                        const winnerB = isFinished && (m.scoreB > m.scoreA || (isPenWin && (m.pensB || 0) > (m.pensA || 0)));
                        const hadAET = isFinished && events.some(e => e.matchId === m.id && e.type === 'aet');
                        
                        return (
                          <div 
                            key={m.id} 
                            onClick={() => setSelectedMatch(m)}
                            className="bg-white px-3 md:px-4 py-4 rounded-2xl border border-slate-100 flex items-center group hover:border-emerald-400 transition-all shadow-sm hover:shadow-md cursor-pointer"
                          >
                            {/* Status Section */}
                            <div className="w-12 md:w-16 text-center border-r border-slate-100 pr-1 mr-1 shrink-0 flex flex-col items-center justify-center">
                              <div className="flex flex-col items-center justify-center">
                                <span className={`text-[9px] md:text-[10px] font-black uppercase tracking-tighter ${
                                  isFinished ? 'text-slate-400' : m.status === 'live' ? 'text-emerald-500 animate-pulse' : 'text-slate-300'
                                }`}>
                                  {isFinished ? (hadAET ? 'AET' : 'FT') : (
                                    <span className="flex items-center gap-1">
                                      {m.status === 'live' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                                      {m.status === 'live' ? 'Live' : m.status === 'scheduled' ? 'vs' : m.status}
                                    </span>
                                  )}
                                </span>
                              </div>
                              {m.status === 'scheduled' && m.kickoff && (
                                <span className="text-[7px] md:text-[8px] font-black text-slate-400 mt-0.5 whitespace-nowrap">
                                  {m.kickoff.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                              {m.leg && (
                                <span className="text-[8px] font-black bg-slate-100 text-slate-500 px-1 rounded mt-1">
                                  L{m.leg}
                                </span>
                              )}
                            </div>

                            {/* Teams Grid */}
                            <div className="flex-1 flex items-center justify-between text-xs md:text-base min-w-0">
                              {/* Team A */}
                              <div className="flex-1 flex items-center justify-end gap-1 md:gap-3 pr-1 md:pr-2 min-w-0">
                                <span className={`font-black truncate transition-colors text-xs sm:text-base md:text-lg ${winnerA ? 'text-emerald-500' : 'text-slate-900'}`}>{formatTeamName(teamA?.name || '')}</span>
                                {teamA?.logoURL ? (
                                  <img src={teamA.logoURL} className="w-5 h-5 md:w-8 md:h-8 object-cover rounded-full bg-slate-50 shrink-0" alt="" />
                                ) : (
                                  <div className="w-5 h-5 md:w-8 md:h-8 rounded-full bg-slate-50 flex items-center justify-center text-[7px] md:text-[10px] font-black text-slate-300 shrink-0 border border-slate-100">{teamA?.name?.charAt(0)}</div>
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
                                  <img src={teamB.logoURL} className="w-5 h-5 md:w-8 md:h-8 object-cover rounded-full bg-slate-50 shrink-0" alt="" />
                                ) : (
                                  <div className="w-5 h-5 md:w-8 md:h-8 rounded-full bg-slate-50 flex items-center justify-center text-[7px] md:text-[10px] font-black text-slate-300 shrink-0 border border-slate-100">{teamB?.name?.charAt(0)}</div>
                                )}
                                <span className={`font-black truncate transition-colors text-xs sm:text-base md:text-lg ${winnerB ? 'text-emerald-500' : 'text-slate-900'}`}>{formatTeamName(teamB?.name || '')}</span>
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
            className="space-y-6"
          >
            {matches.length === 0 && (isCreator || (user && !teams.some(t => t.creatorId === user.uid))) && (
              <div className="flex justify-end">
                <button 
                  onClick={() => setShowAddTeam(true)}
                  className={`px-6 py-3 rounded-full text-sm font-black flex items-center gap-2 transition-all shadow-lg active:scale-95 ${
                    isCreator 
                      ? 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50' 
                      : 'bg-emerald-500 text-white hover:bg-emerald-600'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  {isCreator ? 'Add Team' : 'Register Squad'}
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
              {teams.length === 0 ? (
                <div className="col-span-full py-20 text-center font-bold text-slate-300 uppercase tracking-widest bg-white rounded-3xl border border-slate-100 italic">
                  No teams joined yet
                </div>
              ) : (
                teams.map(t => (
                  <div 
                    key={t.id} 
                    className="relative group cursor-pointer"
                  >
                    {isCreator && matches.length === 0 && (
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
                      <span className="font-black text-sm uppercase tracking-tight">{formatTeamName(t.name)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
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
                      <table className="w-full text-left border-collapse table-fixed">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="w-8 px-1 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400 pl-4">#</th>
                  <th className="px-1 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400">TM</th>
                  <th className="w-6 px-0.5 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">MP</th>
                  <th className="w-6 px-0.5 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">W</th>
                  <th className="w-6 px-0.5 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">D</th>
                  <th className="w-6 px-0.5 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">L</th>
                  <th className="w-7 px-0.5 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">GF</th>
                  <th className="w-7 px-0.5 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">GA</th>
                  <th className="w-7 px-0.5 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">GD</th>
                  <th className="w-8 px-1 py-4 text-[9px] font-black uppercase tracking-widest text-slate-400 text-center">PTS</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {groupStandings.map((s, idx) => {
                            const isQualifying = tournament.type === 'league_playoff' && idx < (tournament.advancingPerGroup || 2);
                            return (
                            <tr key={s.id} className="hover:bg-slate-50 transition-colors group relative">
                              <td className="w-8 px-1 py-4 font-black text-slate-400 pl-4 relative">
                                {isQualifying && (
                                  <div className="absolute left-0 top-2 bottom-2 w-1.5 bg-emerald-500 rounded-r-full" />
                                )}
                                <span className={idx === 0 ? 'text-emerald-500 font-black text-[9px]' : 'text-[9px]'}>{idx + 1}</span>
                              </td>
                              <td 
                                className="px-1 py-4 font-black cursor-pointer hover:text-emerald-500 transition-colors overflow-hidden"
                                onClick={() => setSelectedTeam(s)}
                              >
                                <div className="flex items-center gap-1 md:gap-3">
                                  {s.logoURL ? (
                                    <img src={s.logoURL} className="w-4 h-4 md:w-8 md:h-8 object-cover rounded-full bg-slate-50 flex-shrink-0" alt="" />
                                  ) : (
                                    <div className="w-4 h-4 md:w-8 md:h-8 rounded-full bg-slate-50 flex items-center justify-center text-[7px] md:text-[9px] border border-slate-200 text-slate-400 shrink-0">{s.name.charAt(0)}</div>
                                  )}
                                  <span className={`truncate text-[9px] md:text-base ${idx === 0 ? 'text-emerald-600' : ''}`}>{formatTeamName(s.name)}</span>
                                </div>
                              </td>
                              <td className="w-6 px-0.5 py-4 text-center font-medium text-[9px] md:text-sm">{s.played}</td>
                              <td className="w-6 px-0.5 py-4 text-center font-medium text-[9px] md:text-sm text-slate-600">{s.won}</td>
                              <td className="w-6 px-0.5 py-4 text-center font-medium text-[9px] md:text-sm text-slate-600">{s.drawn}</td>
                              <td className="w-6 px-0.5 py-4 text-center font-medium text-[9px] md:text-sm text-slate-600">{s.lost}</td>
                              <td className="w-7 px-0.5 py-4 text-center font-medium text-[8px] text-slate-400">{s.gf}</td>
                              <td className="w-7 px-0.5 py-4 text-center font-medium text-[8px] text-slate-400">{s.ga}</td>
                              <td className="w-7 px-0.5 py-4 text-center font-medium text-emerald-500 text-[9px] md:text-sm">{s.gd > 0 ? `+${s.gd}` : s.gd}</td>
                              <td className="w-8 px-1 py-4 text-center">
                                <span className="bg-emerald-500/10 text-emerald-600 px-1 py-1 rounded-sm font-medium text-[9px] md:text-sm">{s.points}</span>
                              </td>
                            </tr>
                          );
                        })}
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
                      {Array.from(new Set(events.filter(e => e.type === 'goal' && e.goalType !== 'own_goal' && !e.isPenaltyShootout).map(e => e.playerId)))
                        .map((pid) => {
                          const player = allPlayers.find(p => p.id === pid);
                          const goals = events.filter(e => e.type === 'goal' && e.goalType !== 'own_goal' && !e.isPenaltyShootout && e.playerId === pid).length;
                          return { pid, name: player?.name || 'Unknown', goals };
                        })
                        .filter(p => p.goals > 0 && p.name !== 'Unknown')
                        .sort((a, b) => b.goals - a.goals)
                        .slice(0, 10)
                        .map((p, idx) => (
                          <tr key={p.pid} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-5 font-medium text-slate-400">{idx + 1}</td>
                            <td className="px-6 py-5 font-medium text-slate-700">{p.name.split(' (')[0].split(' #')[0]}</td>
                            <td className="px-6 py-5 text-center">
                              <span className="text-emerald-500 font-medium text-lg">{p.goals}</span>
                            </td>
                          </tr>
                        ))}
                      {events.filter(e => e.type === 'goal' && e.goalType !== 'own_goal' && !e.isPenaltyShootout).length === 0 && (
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
                      {Array.from(new Set(events.filter(e => e.type === 'goal' && e.assistantId && !e.isPenaltyShootout).map(e => e.assistantId!)))
                        .map((aid) => {
                          const player = allPlayers.find(p => p.id === aid);
                          const assists = events.filter(e => e.type === 'goal' && e.assistantId === aid && !e.isPenaltyShootout).length;
                          return { aid, name: player?.name || 'Unknown', assists };
                        })
                        .filter(p => p.assists > 0 && p.name !== 'Unknown')
                        .sort((a, b) => b.assists - a.assists)
                        .slice(0, 10)
                        .map((p, idx) => (
                          <tr key={p.aid} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-5 font-medium text-slate-400">{idx + 1}</td>
                            <td className="px-6 py-5 font-medium text-slate-700">{p.name.split(' (')[0].split(' #')[0]}</td>
                            <td className="px-6 py-5 text-center">
                              <span className="text-blue-500 font-medium text-lg">{p.assists}</span>
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

            {/* Man of the Match Leaderboard */}
            <section className="space-y-4">
              <div className="flex items-center gap-3 px-2">
                <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center shadow-lg shadow-amber-500/20">
                  <Star className="w-5 h-5 text-white fill-white" />
                </div>
                <h3 className="text-xl font-black uppercase tracking-tighter">Most MVPs</h3>
              </div>
              <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto scrollbar-hide">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="w-12 px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Rank</th>
                        <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Player</th>
                        <th className="w-20 px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">AW</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {Array.from(new Set(matches.filter(m => m.manOfTheMatchId).map(m => m.manOfTheMatchId!)))
                        .map((pid) => {
                          const player = allPlayers.find(p => p.id === pid);
                          const awards = matches.filter(m => m.manOfTheMatchId === pid).length;
                          return { pid, name: player?.name || 'Unknown', awards };
                        })
                        .filter(p => p.awards > 0 && p.name !== 'Unknown')
                        .sort((a, b) => b.awards - a.awards)
                        .slice(0, 10)
                        .map((p, idx) => (
                          <tr key={p.pid} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-4 font-medium text-slate-400 text-xs">{idx + 1}</td>
                            <td className="px-4 py-4">
                              <span className="font-medium text-slate-700 text-xs md:text-sm truncate block max-w-[150px]">{p.name.split(' (')[0].split(' #')[0]}</span>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span className="text-amber-500 font-medium text-sm">{p.awards}</span>
                            </td>
                          </tr>
                        ))}
                      {matches.filter(m => m.manOfTheMatchId).length === 0 && (
                        <tr><td colSpan={3} className="px-6 py-20 text-center text-slate-300 font-bold italic">No awards yet</td></tr>
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

        {activeTab === 'knockout' && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            className="py-12 min-h-screen text-slate-900"
          >
            <div className="max-w-screen-xl mx-auto px-4 overflow-x-auto no-scrollbar pb-20">
              <div className="flex flex-col items-center gap-16 min-w-max">
                
                {/* Header */}
                <div className="text-center space-y-2">
                  <Trophy className="w-12 h-12 text-amber-500 mx-auto drop-shadow-lg" />
                  <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-900">Knockout Stage</h2>
                  <div className="h-1 w-24 bg-amber-500 mx-auto rounded-full" />
                </div>

                 <div className="flex flex-col lg:grid lg:grid-cols-[1fr_auto_1fr] gap-12 lg:gap-12 items-center w-full">
                  {/* Left Bracket */}
                  <div className="space-y-12 flex flex-col items-center lg:items-end w-full lg:w-auto">
                    {/* Quarter-finals Left */}
                    {tiesByRound['Quarter-final']?.length > 0 && (
                      <div className="flex flex-col gap-6 lg:gap-8 w-full lg:w-64">
                         <h3 className="lg:hidden text-[10px] font-black uppercase text-slate-400 text-center tracking-[0.3em] mb-4">Quarter-finals</h3>
                        {tiesByRound['Quarter-final'].slice(0, 2).map((tie, idx) => (
                          <div key={tie[0].id} className="space-y-4">
                            {tie.map(m => <BracketMatch key={m.id} match={m} teams={teams} position="left" onSelect={setSelectedMatch} compact={tournament.homeAwayKnockout} />)}
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Semi-final Left */}
                    {tiesByRound['Semi-final']?.length > 0 && (
                      <div className="flex flex-col justify-center min-h-0 lg:min-h-[300px] w-full lg:w-64">
                        <h3 className="lg:hidden text-[10px] font-black uppercase text-slate-400 text-center tracking-[0.3em] mt-8 mb-4">SEMI FINALS</h3>
                        {tiesByRound['Semi-final'].slice(0, 1).map(tie => (
                          <div key={tie[0].id} className="space-y-4">
                            {tie.map(m => <BracketMatch key={m.id} match={m} teams={teams} position="left" onSelect={setSelectedMatch} compact={tournament.homeAwayKnockout} />)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                   {/* Final Column (Center) */}
                  <div className="flex flex-col items-center gap-8 py-12 order-first lg:order-none w-full lg:w-auto">
                    {tiesByRound['Final']?.map(tie => (
                      <div key={tie[0].id} className="space-y-6">
                        {tie.map(m => (
                          <div key={m.id} className="relative group">
                            <div className="absolute -inset-4 bg-amber-500/5 blur-2xl rounded-full opacity-30 group-hover:opacity-60 transition-opacity" />
                            <div 
                              onClick={() => setSelectedMatch(m)}
                              className={`${tournament.homeAwayKnockout ? 'w-80 md:w-96 p-6 rounded-[32px]' : 'w-80 md:w-96 p-8 rounded-[40px]'} bg-white border-2 border-amber-500 shadow-xl relative z-10 cursor-pointer hover:scale-[1.02] transition-all`}
                            >
                              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-amber-500 text-white px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">Final {m.leg ? `- Leg ${m.leg}` : ''}</div>
                              <div className="flex items-center justify-between gap-4">
                                <div className="flex flex-col items-center gap-3 flex-1">
                                  <TeamSlot id={m.teamAId} teams={teams} />
                                  <div className="flex flex-col items-center">
                                    <span className="text-3xl font-black text-slate-900 tabular-nums">{m.status === 'scheduled' ? '-' : m.scoreA}</span>
                                    {m.pensA !== undefined && (
                                      <span className="text-[10px] font-black text-amber-500 mt-[-4px]">({m.pensA})</span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex flex-col items-center gap-2">
                                  <div className="text-[10px] font-black text-slate-300 uppercase tracking-[.3em]">VS</div>
                                  <Trophy className="w-8 h-8 text-amber-500" />
                                </div>
                                <div className="flex flex-col items-center gap-3 flex-1">
                                  <TeamSlot id={m.teamBId} teams={teams} />
                                  <div className="flex flex-col items-center">
                                    <span className="text-3xl font-black text-slate-900 tabular-nums">{m.status === 'scheduled' ? '-' : m.scoreB}</span>
                                    {m.pensB !== undefined && (
                                      <span className="text-[10px] font-black text-amber-500 mt-[-4px]">({m.pensB})</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                    
                    {/* Champion Decoration */}
                    {matches.find(m => m.round === 'Final' && m.status === 'finished') && (
                      <div className="text-center space-y-4 pt-8 animate-bounce">
                        <div className="w-24 h-24 bg-gradient-to-tr from-amber-500 to-amber-300 rounded-full flex items-center justify-center mx-auto shadow-xl shadow-amber-500/20">
                          <Trophy className="w-12 h-12 text-white" />
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-2xl font-black uppercase tracking-tighter text-amber-500">
                            {(() => {
                              const fm = matches.find(m => m.round === 'Final');
                              if (!fm) return '';
                              const isAWinner = fm.status === 'finished' && (fm.scoreA > fm.scoreB || (fm.scoreA === fm.scoreB && (fm.pensA || 0) > (fm.pensB || 0)));
                              const winnerId = isAWinner ? fm.teamAId : fm.teamBId;
                              return teams.find(t => t.id === winnerId)?.name || 'Champion';
                            })()}
                          </h3>
                          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Tournament Winner</p>
                        </div>
                      </div>
                    )}
                  </div>

                   {/* Right Bracket */}
                  <div className="space-y-12 flex flex-col items-center lg:items-start w-full lg:w-auto">
                    {/* Quarter-finals Right */}
                    {tiesByRound['Quarter-final']?.length > 0 && (
                      <div className="flex flex-col gap-6 lg:gap-8 w-full lg:w-64 order-last lg:order-none">
                        <h3 className="lg:hidden text-[10px] font-black uppercase text-slate-400 text-center tracking-[0.3em] mb-4">Quarter-finals</h3>
                        {tiesByRound['Quarter-final'].slice(2, 4).map((tie, idx) => (
                          <div key={tie[0].id} className="space-y-4">
                            {tie.map(m => <BracketMatch key={m.id} match={m} teams={teams} position="right" onSelect={setSelectedMatch} compact={tournament.homeAwayKnockout} />)}
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Semi-final Right */}
                    {tiesByRound['Semi-final']?.length > 0 && (
                      <div className="flex flex-col justify-center min-h-0 lg:min-h-[300px] w-full lg:w-64">
                         <h3 className="lg:hidden text-[10px] font-black uppercase text-slate-400 text-center tracking-[0.3em] mt-8 mb-4">SEMI FINALS</h3>
                        {tiesByRound['Semi-final'].slice(1, 2).map(tie => (
                          <div key={tie[0].id} className="space-y-4">
                            {tie.map(m => <BracketMatch key={m.id} match={m} teams={teams} position="right" onSelect={setSelectedMatch} compact={tournament.homeAwayKnockout} />)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Vertical fallback for smaller brackets/initial state */}
                {!matches.some(m => m.round === 'Quarter-final') && matches.some(m => m.group === 'Playoffs') && (
                  <div className="flex flex-col gap-12 w-full max-w-lg">
                    {['Semi-final', 'Final'].filter(r => matches.some(m => m.round === r)).map(round => (
                      <div key={round} className="space-y-6">
                        <h3 className="text-center text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                          {round === 'Semi-final' ? 'SEMI FINALS' : round + 's'}
                        </h3>
                        <div className="flex flex-col gap-4">
                          {matches.filter(m => m.round === round).map(m => (
                            <div 
                              key={m.id} 
                              onClick={() => setSelectedMatch(m)}
                              className="bg-white border border-slate-200 rounded-3xl p-6 cursor-pointer hover:border-emerald-500/50 transition-all flex items-center justify-between shadow-sm"
                            >
                              <div className="flex items-center gap-4">
                                <TeamSlot id={m.teamAId} teams={teams} small />
                                <span className="font-black text-xs md:text-sm text-slate-900">{teams.find(t => t.id === m.teamAId)?.name.substring(0, 3).toUpperCase()}</span>
                              </div>
                              <div className="flex items-center gap-4 px-6 border-x border-slate-100">
                                <div className="flex flex-col items-center">
                                  <span className="text-xl font-black tabular-nums text-slate-900">{m.status === 'scheduled' ? '-' : m.scoreA}</span>
                                  {m.pensA !== undefined && <span className="text-[10px] font-black text-amber-500">({m.pensA})</span>}
                                </div>
                                <span className="text-xl font-black tabular-nums text-slate-200">:</span>
                                <div className="flex flex-col items-center">
                                  <span className="text-xl font-black tabular-nums text-slate-900">{m.status === 'scheduled' ? '-' : m.scoreB}</span>
                                  {m.pensB !== undefined && <span className="text-[10px] font-black text-amber-500">({m.pensB})</span>}
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <span className="font-black text-xs md:text-sm text-slate-900">{teams.find(t => t.id === m.teamBId)?.name.substring(0, 3).toUpperCase()}</span>
                                <TeamSlot id={m.teamBId} teams={teams} small />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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
                    creatorId: user?.uid,
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
                <select name="teamB" required className="w-full bg-slate-50 px-5 py-4 rounded-2xl border border-slate-200">
                  <option value="">Select Team B</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <button type="submit" className="w-full bg-emerald-500 text-white font-bold py-5 rounded-2xl shadow-lg hover:bg-emerald-600 transition-all active:scale-95">Create Match</button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </motion.div>
  );
}


function MatchTimer({ match, isCreator, tournament, onAddMilestone, nextMilestone }: { match: Match, isCreator: boolean, tournament: Tournament, onAddMilestone?: (type: 'half_time' | 'full_time' | 'aet' | 'end') => void, nextMilestone: 'half_time' | 'full_time' | 'aet' | 'end' }) {
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
    <div className="flex items-center gap-4 bg-slate-900/95 text-white p-3 pr-4 rounded-[32px] border border-white/10 shadow-2xl backdrop-blur-xl ring-4 ring-black/5">
      <div className="flex flex-col items-center px-4 py-1 min-w-[120px] border-r border-white/5">
         <span className="text-[8px] font-black uppercase tracking-[0.4em] text-white/30 mb-0.5">Match Clock</span>
         <span className="text-4xl font-black tabular-nums font-mono text-emerald-400 tracking-tighter leading-none">{formatTime(elapsed)}</span>
      </div>
      
      {isCreator && match.status !== 'finished' && (
        <div className="flex flex-col items-center justify-center gap-1.5 min-w-[100px]">
           <button 
             onClick={toggleTimer}
             className={`w-full h-8 px-4 rounded-xl border transition-all active:scale-95 flex items-center justify-center gap-2 font-black text-[9px] uppercase tracking-widest ${match.isTimerRunning ? 'bg-amber-500 text-white border-amber-400 shadow-[0_4px_12px_rgba(245,158,11,0.3)]' : 'bg-emerald-500 text-white border-emerald-400 shadow-[0_4px_12px_rgba(16,185,129,0.3)]'}`}
           >
             {match.isTimerRunning ? <Pause className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
             {match.isTimerRunning ? 'Pause' : (elapsed === 0 ? 'Start' : 'Resume')}
           </button>
           
           <div className="flex items-center gap-1.5 w-full">
             <button 
               onClick={resetTimer}
               className="flex-1 h-8 flex items-center justify-center rounded-xl bg-white/5 border border-white/5 text-white/40 hover:text-white transition-all hover:bg-white/10 active:scale-95 overflow-hidden"
               title="Reset Clock"
             >
               <RotateCcw className="w-3.5 h-3.5" />
             </button>
             {onAddMilestone && (
               <button 
                  onClick={() => onAddMilestone(nextMilestone)}
                  className="flex-1 h-8 rounded-xl bg-white/5 border border-white/5 text-white/60 hover:text-white transition-all font-black text-[9px] uppercase tracking-widest hover:bg-white/10 active:scale-95 flex items-center justify-center"
               >
                 {nextMilestone === 'half_time' ? 'HT' : 
                  nextMilestone === 'full_time' ? 'FT' : 
                  nextMilestone === 'aet' ? 'AET' : 'END'}
               </button>
             )}
           </div>
        </div>
      )}
    </div>
  );
}

function MatchScoringView({ tournament, match, teams, allPlayers, onBack, isCreator, notify, matches }: { 
  tournament: Tournament, 
  match: Match, 
  teams: Team[], 
  allPlayers: Player[],
  onBack: () => void,
  isCreator: boolean,
  notify: (msg: string) => void,
  matches: Match[]
}) {
  const [liveMatch, setLiveMatch] = useState<Match>(match);
  const [isPenaltyShootoutMode, setIsPenaltyShootoutMode] = useState(false);
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

  const addEvent = async (playerId: string, type: MatchEventType, teamId: string, metadata?: { assistantId?: string, goalType?: GoalType, isPenaltyShootout?: boolean }) => {
    if (!isCreator) return;
    try {
      const matchRef = doc(db, `tournaments/${tournament.id}/matches/${match.id}`);
      const isTeamA = teamId === match.teamAId;
      
      const playerRecord = (isTeamA ? playersA : playersB).find(p => p.id === playerId);
      const assistantRecord = metadata?.assistantId ? (isTeamA ? playersA : playersB).find(p => p.id === metadata.assistantId) : null;

      const matchTime = getMatchTime();
      const isPenaltyShootout = metadata?.isPenaltyShootout || false;

      await addDoc(collection(db, `tournaments/${tournament.id}/matches/${match.id}/events`), {
        matchId: match.id,
        tournamentId: tournament.id,
        type,
        playerId,
        userId: playerRecord?.userId || null,
        assistantId: (metadata?.goalType === 'own_goal' || isPenaltyShootout) ? null : (metadata?.assistantId || null),
        assistantUserId: (metadata?.goalType === 'own_goal' || isPenaltyShootout) ? null : (assistantRecord?.userId || null),
        goalType: metadata?.goalType || (type === 'goal' ? 'open_goal' : null),
        teamId,
        minute: 0, 
        timestamp: isPenaltyShootout ? 'Pens' : matchTime,
        createdAt: serverTimestamp(),
        isPenaltyShootout
      });

      if (type === 'goal') {
        const isOwnGoal = metadata?.goalType === 'own_goal';
        const teamToIncrementIsA = isOwnGoal ? !isTeamA : isTeamA;
        
        if (isPenaltyShootout) {
          const field = teamToIncrementIsA ? 'pensA' : 'pensB';
          await setDoc(matchRef, {
            [field]: (liveMatch[field] || 0) + 1,
            status: 'live'
          }, { merge: true });
        } else {
          await setDoc(matchRef, {
            [teamToIncrementIsA ? 'scoreA' : 'scoreB']: (teamToIncrementIsA ? liveMatch.scoreA : liveMatch.scoreB) + 1,
            status: 'live'
          }, { merge: true });
        }
      }
      setShowEventModal(null);
    } catch (err) {
      console.error("Add event error:", err);
      handleFirestoreError(err, OperationType.WRITE, `tournaments/${tournament.id}/matches/${match.id}/events`);
    }
  };

  const undoEvent = async (eventId: string) => {
    if (!isCreator) return;
    
    const eventToDelete = events.find(e => e.id === eventId);
    if (!eventToDelete) return;

    if (!window.confirm("Delete this event?")) return;

    try {
      const matchRef = doc(db, `tournaments/${tournament.id}/matches/${match.id}`);
      const eventRef = doc(db, `tournaments/${tournament.id}/matches/${match.id}/events/${eventId}`);

      // If it was a goal or penalty goal, decrement score
      if (eventToDelete.type === 'goal' || (eventToDelete.type === 'penalty_kick' && eventToDelete.penaltyResult === 'goal')) {
        const isTeamA = eventToDelete.teamId === match.teamAId;
        const isOwnGoal = eventToDelete.type === 'goal' && eventToDelete.goalType === 'own_goal';
        const isPenaltyShootout = eventToDelete.isPenaltyShootout;
        
        if (isPenaltyShootout) {
          const field = isTeamA ? 'pensA' : 'pensB';
          await updateDoc(matchRef, {
            [field]: Math.max(0, (liveMatch[field] || 0) - 1)
          });
        } else {
          // If it was an own goal, the OPPONENT's score was incremented, so decrement it
          const teamToDecrementIsA = isOwnGoal ? !isTeamA : isTeamA;
          
          await updateDoc(matchRef, {
            [teamToDecrementIsA ? 'scoreA' : 'scoreB']: Math.max(0, (teamToDecrementIsA ? liveMatch.scoreA : liveMatch.scoreB) - 1)
          });
        }
      }

      // If it was a second yellow that triggered a red, find and delete the red too
      if (eventToDelete.type === 'yellow_card') {
        const yellowCount = events.filter(e => e.playerId === eventToDelete.playerId && e.type === 'yellow_card').length;
        if (yellowCount >= 2) {
          const matchingRed = events.find(e => e.playerId === eventToDelete.playerId && e.type === 'red_card' && e.timestamp === eventToDelete.timestamp);
          if (matchingRed) {
            await deleteDoc(doc(db, `tournaments/${tournament.id}/matches/${match.id}/events/${matchingRed.id}`));
          }
        }
      }

      await deleteDoc(eventRef);
      notify('Event deleted');
    } catch (err) {
      console.error("Undo error:", err);
      handleFirestoreError(err, OperationType.DELETE, `tournaments/${tournament.id}/matches/${match.id}/events/${eventId}`);
    }
  };

  const addPenaltyKick = async (playerId: string, teamId: string, result: 'goal' | 'miss') => {
    if (!isCreator) return;
    try {
      const matchRef = doc(db, `tournaments/${tournament.id}/matches/${match.id}`);
      const isTeamA = teamId === match.teamAId;
      const playerRecord = (isTeamA ? playersA : playersB).find(p => p.id === playerId);

      await addDoc(collection(db, `tournaments/${tournament.id}/matches/${match.id}/events`), {
        matchId: match.id,
        tournamentId: tournament.id,
        type: 'penalty_kick',
        playerId,
        userId: playerRecord?.userId || null,
        teamId,
        minute: 0,
        timestamp: 'Pens',
        createdAt: serverTimestamp(),
        isPenaltyShootout: true,
        penaltyResult: result
      });

      if (result === 'goal') {
        const field = isTeamA ? 'pensA' : 'pensB';
        await setDoc(matchRef, {
          [field]: (liveMatch[field] || 0) + 1,
          status: 'live'
        }, { merge: true });
      }
      notify(`Penalty ${result} recorded`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `tournaments/${tournament.id}/matches/${match.id}/events`);
    }
  };

  const addMilestone = async (type: 'half_time' | 'full_time' | 'aet' | 'end') => {
    if (!isCreator) return;
    try {
      let currentMinute = 0;
      if (liveMatch.isTimerRunning && liveMatch.timerStartTime) {
        const startTime = liveMatch.timerStartTime.toMillis ? liveMatch.timerStartTime.toMillis() : new Date(liveMatch.timerStartTime).getTime();
        const baseElapsed = liveMatch.elapsedTimeOnPause || 0;
        const diff = Math.floor((Date.now() - startTime) / 1000);
        currentMinute = Math.floor((baseElapsed + diff) / 60) + 1;
      } else {
        currentMinute = Math.floor((liveMatch.elapsedTimeOnPause || 0) / 60) + 1;
      }

      const eventData: any = {
        matchId: liveMatch.id,
        tournamentId: tournament.id,
        type: type,
        playerId: 'system',
        teamId: 'system',
        minute: currentMinute,
        timestamp: `${currentMinute}'`,
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, `tournaments/${tournament.id}/matches/${match.id}/events`), eventData);
      
      // Reset timer on milestone
      const matchRef = doc(db, `tournaments/${tournament.id}/matches/${match.id}`);
      await updateDoc(matchRef, {
        isTimerRunning: false,
        elapsedTimeOnPause: 0,
        timerStartTime: null
      });

      if (type === 'end') {
        setShowFinishConfirm(true);
      }

      notify(type === 'half_time' ? 'First half ended' : type === 'full_time' ? 'Full time recorded' : type === 'aet' ? 'Extra time ended' : 'Match ended');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `tournaments/${tournament.id}/matches/${match.id}/events`);
    }
  };

  const finishMatch = async () => {
    if (!isCreator || isFinishing) return;

    // Knockout winner check
    const isKnockout = match.group === 'Playoffs' || match.round;
    const isSecondLeg = liveMatch.leg === 2;
    const isFirstLeg = liveMatch.leg === 1;

    // Only block draw if it's a single leg or the second leg of a tie
    if (isKnockout && !isFirstLeg) {
      // For second leg, we need to check aggregate
      if (isSecondLeg && liveMatch.tieId) {
        const matchesInTie = matches.filter(m => m.tieId === liveMatch.tieId);
        const leg1 = matchesInTie.find(m => m.leg === 1);
        if (leg1 && leg1.status === 'finished') {
          const aggA = leg1.scoreA + liveMatch.scoreB; // Team A in Leg 1 is Away in Leg 2
          const aggB = leg1.scoreB + liveMatch.scoreA;
          if (aggA === aggB && (liveMatch.pensA || 0) === (liveMatch.pensB || 0)) {
            notify('Aggregate is a draw. Please record penalties in this second leg.');
            return;
          }
        }
      } else if (!liveMatch.leg && liveMatch.scoreA === liveMatch.scoreB && (liveMatch.pensA || 0) === (liveMatch.pensB || 0)) {
        notify('Knockout matches must have a winner. Please record penalties.');
        return;
      }
    }

    setIsFinishing(true);
    try {
      const suggested = getSuggestedMotM();
      const matchRef = doc(db, `tournaments/${tournament.id}/matches/${match.id}`);
      const updateData: any = { 
        status: 'finished',
        updatedAt: serverTimestamp() 
      };
      if (!liveMatch.manOfTheMatchId && suggested) {
        updateData.manOfTheMatchId = suggested;
      }
      
      await updateDoc(matchRef, updateData);

      // Handle Bracket Progression
      if (liveMatch.successorMatchId) {
        let winnerId = null;

        if (liveMatch.tieId) {
          const matchesInTie = matches.filter(m => m.tieId === liveMatch.tieId);
          // Combine current finished match with others
          const allLegsInTie = matchesInTie.map(m => m.id === match.id ? { ...m, ...updateData, scoreA: liveMatch.scoreA, scoreB: liveMatch.scoreB, pensA: liveMatch.pensA, pensB: liveMatch.pensB, status: 'finished' } : m);
          
          if (allLegsInTie.every(m => m.status === 'finished')) {
            const l1 = allLegsInTie.find(m => m.leg === 1);
            const l2 = allLegsInTie.find(m => m.leg === 2);
            if (l1 && l2) {
              const aggA = l1.scoreA + l2.scoreB;
              const aggB = l1.scoreB + l2.scoreA;
              if (aggA > aggB) winnerId = l1.teamAId;
              else if (aggB > aggA) winnerId = l1.teamBId;
              else winnerId = (l2.pensA || 0) > (l2.pensB || 0) ? l2.teamAId : l2.teamBId;
            } else if (l1 && !l2) {
              // Single leg tie with tieId?
              winnerId = l1.scoreA > l1.scoreB ? l1.teamAId : (l1.scoreB > l1.scoreA ? l1.teamBId : ((l1.pensA || 0) > (l1.pensB || 0) ? l1.teamAId : l1.teamBId));
            }
          }
        } else {
          winnerId = liveMatch.scoreA > liveMatch.scoreB ? liveMatch.teamAId : 
                     liveMatch.scoreB > liveMatch.scoreA ? liveMatch.teamBId :
                     (liveMatch.pensA || 0) > (liveMatch.pensB || 0) ? liveMatch.teamAId : liveMatch.teamBId;
        }

        if (winnerId) {
          const successorIds = liveMatch.successorMatchId.split(',');
          for (const sId of successorIds) {
            const successorRef = doc(db, `tournaments/${tournament.id}/matches/${sId.trim()}`);
            const successorMatch = matches.find(m => m.id === sId.trim());
            if (successorMatch) {
              // Check if we need to flip side for home/away in successor ties
              // If successorSide is A, team moves to teamAId in leg 1 and teamBId in leg 2
              const side = liveMatch.successorSide;
              const isLeg2OfSuccessor = successorMatch.leg === 2;
              const finalSide = isLeg2OfSuccessor ? (side === 'A' ? 'teamBId' : 'teamAId') : (side === 'A' ? 'teamAId' : 'teamBId');
              
              await updateDoc(successorRef, {
                [finalSide]: winnerId
              });
            }
          }
        }
      }

      setShowFinishConfirm(false);
      notify('Match finished successfully!');
    } catch (err) {
      console.error("Finish match error:", err);
      handleFirestoreError(err, OperationType.UPDATE, `tournaments/${tournament.id}/matches/${match.id}`);
    } finally {
      setIsFinishing(false);
    }
  };

  const setManOfTheMatch = async (playerId: string) => {
    if (!isCreator) return;
    try {
      const matchRef = doc(db, `tournaments/${tournament.id}/matches/${match.id}`);
      await updateDoc(matchRef, { 
        manOfTheMatchId: playerId
      });
      notify('Man of the Match updated!');
    } catch (err) {
      console.error("Set MOTM error:", err);
    }
  };

  const getSuggestedMotM = () => {
    const scores: Record<string, number> = {};
    events.forEach(e => {
        if (e.type === 'goal' && e.goalType !== 'own_goal' && !e.isPenaltyShootout) {
            scores[e.playerId] = (scores[e.playerId] || 0) + 3;
            if (e.assistantId) {
                scores[e.assistantId] = (scores[e.assistantId] || 0) + 2;
            }
        }
    });
    
    let bestPlayerId = null;
    let maxPts = -1;
    Object.entries(scores).forEach(([pid, pts]) => {
        if (pts > maxPts) {
            maxPts = pts;
            bestPlayerId = pid;
        }
    });
    return bestPlayerId;
  };

  const nextMilestone = useMemo(() => {
    const hasHT = events.some(e => e.type === 'half_time');
    const hasFT = events.some(e => e.type === 'full_time');
    const hasAET = events.some(e => e.type === 'aet');
    const hasEnd = events.some(e => e.type === 'end');
    
    if (!hasHT) return 'half_time';
    if (!hasFT) return 'full_time';
    if (!hasAET) return 'aet';
    return 'end';
  }, [events]);

  const redCardedPlayerIds = useMemo(() => {
    return new Set(events.filter(e => e.type === 'red_card').map(e => e.playerId));
  }, [events]);

  const substitutedOutPlayerIds = useMemo(() => {
    return new Set(events.filter(e => e.type === 'substitution').map(e => e.playerId));
  }, [events]);

  const penaltyTakerIds = useMemo(() => {
    return new Set(events.filter(e => e.type === 'penalty_kick').map(e => e.playerId));
  }, [events]);

  const isEligible = (playerId: string) => {
    return !redCardedPlayerIds.has(playerId) && !substitutedOutPlayerIds.has(playerId);
  };

  const manOfTheMatch = allPlayers.find(p => p.id === liveMatch.manOfTheMatchId);
  const suggestedId = getSuggestedMotM();
  const suggestedPlayer = allPlayers.find(p => p.id === suggestedId);

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }} 
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={(_, info) => {
        if (info.offset.x > 150) onBack();
      }}
      className="space-y-12"
    >
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-400 font-bold hover:text-slate-900 transition-colors uppercase tracking-widest text-[10px]">
          &larr; Back to Tournament
        </button>
        <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest sm:hidden">Swipe right to go back</p>
      </div>

      <div className="bg-white text-slate-900 rounded-[40px] p-6 md:p-10 shadow-[0_30px_100px_rgba(0,0,0,0.08)] relative overflow-hidden border border-black/5">
        <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500" />
        <div className="flex flex-col items-center gap-8 relative z-10">
          <div className="flex flex-col items-center gap-2">
            <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
              liveMatch.status === 'live' ? 'bg-emerald-50 text-emerald-500 border border-emerald-200' : 'bg-slate-100 text-slate-400'
            }`}>
              {liveMatch.status === 'live' ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Match
                </span>
              ) : liveMatch.status === 'finished' ? 'FT' : 'Scheduled'}
            </div>
            {liveMatch.status !== 'finished' && <MatchTimer match={liveMatch} isCreator={isCreator} tournament={tournament} onAddMilestone={addMilestone} nextMilestone={nextMilestone} />}
            
            {isCreator && liveMatch.status !== 'finished' && liveMatch.scoreA === liveMatch.scoreB && (
              <div className="flex flex-col items-center gap-4 mt-6">
                <button
                  onClick={() => setIsPenaltyShootoutMode(!isPenaltyShootoutMode)}
                  className={`px-6 py-3 rounded-full text-xs font-black uppercase tracking-widest transition-all border flex items-center gap-2 ${
                    isPenaltyShootoutMode 
                      ? 'bg-amber-500 text-white border-amber-400 shadow-xl shadow-amber-500/30 active:scale-95' 
                      : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200'
                  }`}
                >
                  <Trophy className="w-4 h-4" />
                  {isPenaltyShootoutMode ? 'Penalty Shootout Mode Active' : 'Go to Penalties'}
                </button>

                <AnimatePresence>
                  {isPenaltyShootoutMode && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="bg-amber-50 border border-amber-200 p-6 rounded-[32px] w-full max-w-lg shadow-xl shadow-amber-500/5 mt-4"
                    >
                      <h4 className="text-center text-[10px] font-black uppercase tracking-[0.3em] text-amber-600 mb-6 flex items-center justify-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        Record Penalty
                      </h4>
                      <div className="grid grid-cols-2 gap-8">
                        {/* Team A Picker */}
                        <div className="space-y-4">
                          <p className="text-[10px] font-black text-slate-400 uppercase text-center">{teamA?.name}</p>
                          <select 
                            id="taker-a"
                            className="w-full bg-white border border-amber-100 rounded-2xl px-4 py-3 text-xs font-bold"
                            defaultValue=""
                          >
                            <option value="" disabled>Select Taker</option>
                            {sortPlayersByPosition(playersA)
                              .filter(p => isEligible(p.id) && !penaltyTakerIds.has(p.id))
                              .map(p => <option key={p.id} value={p.id}>{p.name} (#{p.number})</option>)}
                          </select>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => {
                                const el = document.getElementById('taker-a') as HTMLSelectElement;
                                const pid = el.value;
                                if (!pid) return notify('Select a taker');
                                addPenaltyKick(pid, teamA!.id, 'goal');
                                el.value = "";
                              }}
                              className="flex-1 bg-emerald-500 text-white py-3 rounded-xl text-[10px] font-black uppercase hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 active:scale-95"
                            >Goal</button>
                            <button 
                              onClick={() => {
                                const el = document.getElementById('taker-a') as HTMLSelectElement;
                                const pid = el.value;
                                if (!pid) return notify('Select a taker');
                                addPenaltyKick(pid, teamA!.id, 'miss');
                                el.value = "";
                              }}
                              className="flex-1 bg-red-500 text-white py-3 rounded-xl text-[10px] font-black uppercase hover:bg-red-600 shadow-lg shadow-red-500/20 active:scale-95"
                            >Miss</button>
                          </div>
                        </div>

                        {/* Team B Picker */}
                        <div className="space-y-4">
                          <p className="text-[10px] font-black text-slate-400 uppercase text-center">{teamB?.name}</p>
                          <select 
                            id="taker-b"
                            className="w-full bg-white border border-amber-100 rounded-2xl px-4 py-3 text-xs font-bold"
                            defaultValue=""
                          >
                            <option value="" disabled>Select Taker</option>
                            {sortPlayersByPosition(playersB)
                              .filter(p => isEligible(p.id) && !penaltyTakerIds.has(p.id))
                              .map(p => <option key={p.id} value={p.id}>{p.name} (#{p.number})</option>)}
                          </select>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => {
                                const el = document.getElementById('taker-b') as HTMLSelectElement;
                                const pid = el.value;
                                if (!pid) return notify('Select a taker');
                                addPenaltyKick(pid, teamB!.id, 'goal');
                                el.value = "";
                              }}
                              className="flex-1 bg-emerald-500 text-white py-3 rounded-xl text-[10px] font-black uppercase hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 active:scale-95"
                            >Goal</button>
                            <button 
                              onClick={() => {
                                const el = document.getElementById('taker-b') as HTMLSelectElement;
                                const pid = el.value;
                                if (!pid) return notify('Select a taker');
                                addPenaltyKick(pid, teamB!.id, 'miss');
                                el.value = "";
                              }}
                              className="flex-1 bg-red-500 text-white py-3 rounded-xl text-[10px] font-black uppercase hover:bg-red-600 shadow-lg shadow-red-500/20 active:scale-95"
                            >Miss</button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
                   <div className="flex items-start justify-center gap-2 md:gap-16 w-full max-w-4xl mx-auto">
            <div className="flex-1 flex flex-col items-center gap-4 text-center min-w-0">
              <div className="w-16 h-16 md:w-32 md:h-32 bg-slate-50 rounded-2xl md:rounded-3xl flex items-center justify-center border border-black/5 shadow-inner transition-all shrink-0">
                {teamA?.logoURL ? (
                  <img src={teamA.logoURL} className="w-10 h-10 md:w-20 md:h-20 object-contain" alt="" />
                ) : (
                  <Users className="w-8 h-8 md:w-16 md:h-16 text-slate-200" />
                )}
              </div>
              <div className="space-y-3 w-full flex flex-col items-center">
                <h2 className={`text-[11px] md:text-2xl font-black tracking-tight uppercase leading-tight transition-colors truncate w-full ${
                  liveMatch.status === 'finished' && liveMatch.scoreA > liveMatch.scoreB ? 'text-emerald-500' : 'text-slate-900'
                }`}>
                  {teamA?.name}
                </h2>
                
                {isCreator && liveMatch.status !== 'finished' && (
                  <div className="flex items-center justify-center gap-1 xl:gap-2">
                    <button 
                      onClick={() => setShowEventModal({ side: 'A', type: 'goal', step: 1 })} 
                      className="w-9 h-9 md:w-20 md:h-20 bg-emerald-500 rounded-xl md:rounded-3xl flex items-center justify-center hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-500/20 active:scale-90 group shrink-0"
                      title="Add Goal"
                    >
                      <SoccerIcon className="w-5 h-5 md:w-10 md:h-10 text-white group-hover:scale-110 transition-transform" />
                    </button>
                    <button 
                      onClick={() => setShowEventModal({ side: 'A', type: 'yellow_card', step: 1 })} 
                      className="w-9 h-9 md:w-20 md:h-20 bg-amber-400 rounded-xl md:rounded-3xl flex items-center justify-center hover:bg-amber-500 transition-all shadow-xl shadow-amber-400/20 active:scale-90 group shrink-0"
                      title="Add Card"
                    >
                      <Shield className="w-5 h-5 md:w-10 md:h-10 text-white drop-shadow-md group-hover:rotate-12 transition-transform" />
                    </button>
                    <button 
                      onClick={() => setShowEventModal({ side: 'A', type: 'substitution', step: 1 })} 
                      className="w-9 h-9 md:w-20 md:h-20 bg-slate-100 rounded-xl md:rounded-3xl flex items-center justify-center hover:bg-slate-200 transition-all active:scale-90 group shrink-0 shadow-sm"
                      title="Substitution"
                    >
                      <ArrowLeftRight className="w-5 h-5 md:w-10 md:h-10 text-slate-400 group-hover:text-slate-600 transition-all" />
                    </button>
                  </div>
                )}
              </div>
            </div>
 
            <div className="flex flex-col items-center justify-center gap-0.5 shrink-0 h-16 md:h-32">
              <div className="flex items-center gap-2 md:gap-6">
                <div className="flex flex-col items-center">
                  <span className={`text-3xl md:text-9xl font-black tabular-nums tracking-tighter transition-colors ${
                    liveMatch.status === 'finished' && (liveMatch.scoreA > liveMatch.scoreB || (liveMatch.scoreA === liveMatch.scoreB && (liveMatch.pensA || 0) > (liveMatch.pensB || 0))) ? 'text-emerald-500' : 'text-slate-900'
                  }`}>{liveMatch.scoreA}</span>
                  {(liveMatch.pensA !== undefined || liveMatch.pensB !== undefined) && (
                    <span className="text-[10px] md:text-lg font-black text-amber-500 tabular-nums">({liveMatch.pensA || 0})</span>
                  )}
                </div>
                <span className="text-xl md:text-5xl font-black text-slate-200">-</span>
                <div className="flex flex-col items-center">
                  <span className={`text-3xl md:text-9xl font-black tabular-nums tracking-tighter transition-colors ${
                    liveMatch.status === 'finished' && (liveMatch.scoreB > liveMatch.scoreA || (liveMatch.scoreA === liveMatch.scoreB && (liveMatch.pensB || 0) > (liveMatch.pensA || 0))) ? 'text-emerald-500' : 'text-slate-900'
                  }`}>{liveMatch.scoreB}</span>
                  {(liveMatch.pensA !== undefined || liveMatch.pensB !== undefined) && (
                    <span className="text-[10px] md:text-lg font-black text-amber-500 tabular-nums">({liveMatch.pensB || 0})</span>
                  )}
                </div>
              </div>
              {liveMatch.isTimerRunning && <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse mt-1" />}
            </div>
 
            <div className="flex-1 flex flex-col items-center gap-4 text-center min-w-0">
              <div className="w-16 h-16 md:w-32 md:h-32 bg-slate-50 rounded-2xl md:rounded-3xl flex items-center justify-center border border-black/5 shadow-inner transition-all shrink-0">
                {teamB?.logoURL ? (
                  <img src={teamB.logoURL} className="w-10 h-10 md:w-20 md:h-20 object-contain" alt="" />
                ) : (
                  <Users className="w-8 h-8 md:w-16 md:h-16 text-slate-200" />
                )}
              </div>
              <div className="space-y-3 w-full flex flex-col items-center">
                <h2 className={`text-[11px] md:text-2xl font-black tracking-tight uppercase leading-tight transition-colors truncate w-full ${
                  liveMatch.status === 'finished' && liveMatch.scoreB > liveMatch.scoreA ? 'text-emerald-500' : 'text-slate-900'
                }`}>
                  {teamB?.name}
                </h2>

                {isCreator && liveMatch.status !== 'finished' && (
                  <div className="flex items-center justify-center gap-1 xl:gap-2">
                    <button 
                      onClick={() => setShowEventModal({ side: 'B', type: 'goal', step: 1 })} 
                      className="w-9 h-9 md:w-20 md:h-20 bg-emerald-500 rounded-xl md:rounded-3xl flex items-center justify-center hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-500/20 active:scale-90 group shrink-0"
                      title="Add Goal"
                    >
                      <SoccerIcon className="w-5 h-5 md:w-10 md:h-10 text-white group-hover:scale-110 transition-transform" />
                    </button>
                    <button 
                      onClick={() => setShowEventModal({ side: 'B', type: 'yellow_card', step: 1 })} 
                      className="w-9 h-9 md:w-20 md:h-20 bg-amber-400 rounded-xl md:rounded-3xl flex items-center justify-center hover:bg-amber-500 transition-all shadow-xl shadow-amber-400/20 active:scale-90 group shrink-0"
                      title="Add Card"
                    >
                      <Shield className="w-5 h-5 md:w-10 md:h-10 text-white drop-shadow-md group-hover:rotate-12 transition-transform" />
                    </button>
                    <button 
                      onClick={() => setShowEventModal({ side: 'B', type: 'substitution', step: 1 })} 
                      className="w-9 h-9 md:w-20 md:h-20 bg-slate-100 rounded-xl md:rounded-3xl flex items-center justify-center hover:bg-slate-200 transition-all active:scale-90 group shrink-0 shadow-sm"
                      title="Substitution"
                    >
                      <ArrowLeftRight className="w-5 h-5 md:w-10 md:h-10 text-slate-400 group-hover:text-slate-600 transition-all" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-16 max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-10">
            <div className="h-px flex-1 bg-slate-100" />
            <h3 className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-400">Match Timeline</h3>
            <div className="h-px flex-1 bg-slate-100" />
          </div>

          <div className="relative space-y-8">
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-200 -translate-x-1/2" />

            {events.length === 0 && (
              <div className="text-center py-24 text-slate-200 font-black uppercase tracking-[0.2em] text-xs">
                Waiting for match kick-off...
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
              
              const createA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
              const createB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
              return createA - createB;
            }).map((e) => {
              if (e.type === 'half_time' || e.type === 'full_time' || e.type === 'aet' || e.type === 'penalty_kick') {
                if (e.type === 'penalty_kick') {
                  const playerTeamId = e.teamId;
                  const isPlayerTeamA = playerTeamId === match.teamAId;
                  const pl = (isPlayerTeamA ? playersA : playersB).find(p => p.id === e.playerId);
                  const result = e.penaltyResult || 'goal';

                  return (
                    <div key={e.id} className="relative z-10 flex justify-center">
                      <div className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-md flex items-center gap-2 border-2 ${
                        result === 'goal' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'
                      }`}>
                         <span className="opacity-50">{isPlayerTeamA ? 'HOME' : 'AWAY'}</span>
                         <span>{pl?.name?.split(' #')[0]}</span>
                         <span className="w-1.5 h-1.5 rounded-full bg-current" />
                         <span>{result}</span>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={e.id} className="relative z-10 flex justify-center">
                    <div className="bg-slate-900 text-white px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl ring-4 ring-white">
                      {e.type === 'half_time' ? 'Half Time' : 
                       e.type === 'full_time' ? 'Full Time' : 
                       e.type === 'aet' ? 'AET' : 'Match Ended'} • {e.timestamp}
                    </div>
                  </div>
                );
              }

              const playerTeamId = e.teamId;
              const isPlayerTeamA = playerTeamId === match.teamAId;
              const isOwnGoal = e.type === 'goal' && e.goalType === 'own_goal';
              const displayOnLeft = isOwnGoal ? !isPlayerTeamA : isPlayerTeamA;
              
              const pl = (isPlayerTeamA ? playersA : playersB).find(p => p.id === e.playerId);
              const isValidTime = e.timestamp && e.timestamp.includes("'");
              
              return (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  key={e.id} 
                  className="relative flex items-center group min-h-[60px]"
                >
                  {/* Event Marker */}
                  <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center z-10">
                    <div className={`w-10 h-10 rounded-xl bg-white border flex items-center justify-center text-[9px] font-black shadow-sm transition-all group-hover:border-emerald-200 ${isOwnGoal ? 'border-red-200 text-red-500' : 'border-slate-100 text-slate-400 font-mono'}`}>
                      {e.timestamp}
                    </div>
                  </div>

                  {/* Left Side Content */}
                  <div className="flex-1 flex flex-col items-end pr-8 transition-all">
                    {displayOnLeft && (
                      <div className="text-right space-y-0.5" id={`event-left-${e.id}`}>
                        <div className="flex items-center justify-end gap-3">
                          <div className="flex flex-col items-end">
                            <span className={`text-xs font-black ${isOwnGoal ? 'text-red-500' : 'text-slate-900'}`}>{pl?.name?.split(' (')[0].split(' #')[0]}</span>
                            {e.assistantId && (
                              <div className="flex items-center justify-end gap-1 text-[9px] text-slate-400 font-bold uppercase transition-colors">
                                <span>{ (isPlayerTeamA ? playersA : playersB).find(p => p.id === e.assistantId)?.name?.split(' (')[0].split(' #')[0] }</span>
                                {e.type === 'substitution' ? <ArrowUp className="w-2.5 h-2.5 text-emerald-500" /> : <Footprints className="w-2.5 h-2.5" />}
                              </div>
                            )}
                          </div>
                          {e.type === 'goal' ? (
                            <div className="w-6 h-6 flex items-center justify-center">
                              <SoccerIcon className={`w-4 h-4 ${isOwnGoal ? 'text-red-500' : 'text-emerald-500'}`} />
                            </div>
                          ) : e.type === 'substitution' ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <ArrowDown className="w-2.5 h-2.5 text-red-500" />
                              <ArrowUp className="w-2.5 h-2.5 text-emerald-500" />
                            </div>
                          ) : (
                            <div className={`w-3 h-4 rounded-[2px] shadow-sm ${e.type === 'yellow_card' ? 'bg-amber-400' : 'bg-red-500'}`} />
                          )}
                        </div>
                        {e.type === 'goal' && e.goalType && (
                          <div className={`text-[9px] uppercase font-black tracking-widest ${isOwnGoal ? 'text-red-500/50' : 'text-slate-300'}`}>{e.goalType.replace('_',' ')}</div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Spacer for Marker */}
                  <div className="flex-1 pl-8">
                    {!displayOnLeft && (
                      <div className="text-left space-y-0.5" id={`event-right-${e.id}`}>
                        <div className="flex items-center justify-start gap-3">
                          {e.type === 'goal' ? (
                            <div className="w-6 h-6 flex items-center justify-center">
                              <SoccerIcon className={`w-4 h-4 ${isOwnGoal ? 'text-red-500' : 'text-emerald-500'}`} />
                            </div>
                          ) : e.type === 'substitution' ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <ArrowDown className="w-2.5 h-2.5 text-red-500" />
                              <ArrowUp className="w-2.5 h-2.5 text-emerald-500" />
                            </div>
                          ) : (
                            <div className={`w-3 h-4 rounded-[2px] shadow-sm ${e.type === 'yellow_card' ? 'bg-amber-400' : 'bg-red-500'}`} />
                          )}
                          <div className="flex flex-col items-start">
                            <span className={`text-xs font-black ${isOwnGoal ? 'text-red-500' : 'text-slate-900'}`}>{pl?.name?.split(' (')[0].split(' #')[0]}</span>
                            {e.assistantId && (
                              <div className="flex items-center justify-start gap-1 text-[9px] text-slate-400 font-bold uppercase transition-colors">
                                {e.type === 'substitution' ? <ArrowUp className="w-2.5 h-2.5 text-emerald-500" /> : <Footprints className="w-2.5 h-2.5" />}
                                <span>{ (isPlayerTeamA ? playersA : playersB).find(p => p.id === e.assistantId)?.name?.split(' (')[0].split(' #')[0] }</span>
                              </div>
                            )}
                          </div>
                        </div>
                        {e.type === 'goal' && e.goalType && (
                          <div className={`text-[9px] uppercase font-black tracking-widest ${isOwnGoal ? 'text-red-500/50' : 'text-slate-300'}`}>{e.goalType.replace('_',' ')}</div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {isCreator && (
                    <button 
                      onClick={() => undoEvent(e.id)} 
                      className="absolute top-1/2 -translate-y-1/2 -right-4 opacity-0 group-hover:opacity-100 p-2 text-slate-200 hover:text-red-500 transition-all font-black text-[9px] uppercase"
                    >
                      Undo
                    </button>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Penalty Shootout History */}
        {events.some(e => e.type === 'penalty_kick') && (
          <div className="mt-16 max-w-2xl mx-auto border-t border-slate-100 pt-16">
            <div className="flex items-center gap-4 mb-10 text-center">
              <div className="h-px flex-1 bg-slate-100" />
              <h3 className="text-[11px] font-black uppercase tracking-[0.4em] text-amber-500">Penalty Shootout Results</h3>
              <div className="h-px flex-1 bg-slate-100" />
            </div>
            
            <div className="grid grid-cols-2 gap-12">
              {/* Team A Penalties */}
              <div className="space-y-4" id="pens-a-hist">
                <p className="text-[10px] font-black text-slate-400 uppercase text-center tracking-widest">{teamA?.name}</p>
                <div className="flex flex-wrap justify-center gap-3">
                  {events.filter(e => e.type === 'penalty_kick' && e.teamId === teamA?.id).sort((a,b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0)).map((e, idx) => {
                    const pl = (e.teamId === teamA?.id ? playersA : playersB).find(p => p.id === e.playerId);
                    return (
                      <div key={e.id} className="flex flex-col items-center gap-1">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shadow-sm border-2 ${e.penaltyResult === 'goal' ? 'bg-emerald-500 text-white border-emerald-400' : 'bg-red-500 text-white border-red-400'}`}>
                          {e.penaltyResult === 'goal' ? '✓' : '✗'}
                        </div>
                        <span className="text-[8px] font-black text-slate-400 uppercase">{pl?.name?.split(' ')[0]}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="text-center mt-4">
                  <span className="text-3xl font-black text-slate-900">{liveMatch.pensA || 0}</span>
                </div>
              </div>

              {/* Team B Penalties */}
              <div className="space-y-4" id="pens-b-hist">
                <p className="text-[10px] font-black text-slate-400 uppercase text-center tracking-widest">{teamB?.name}</p>
                <div className="flex flex-wrap justify-center gap-3">
                  {events.filter(e => e.type === 'penalty_kick' && e.teamId === teamB?.id).sort((a,b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0)).map((e, idx) => {
                    const pl = (e.teamId === teamB?.id ? playersB : playersA).find(p => p.id === e.playerId);
                    return (
                      <div key={e.id} className="flex flex-col items-center gap-1">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shadow-sm border-2 ${e.penaltyResult === 'goal' ? 'bg-emerald-500 text-white border-emerald-400' : 'bg-red-500 text-white border-red-400'}`}>
                          {e.penaltyResult === 'goal' ? '✓' : '✗'}
                        </div>
                        <span className="text-[8px] font-black text-slate-400 uppercase">{pl?.name?.split(' ')[0]}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="text-center mt-4">
                  <span className="text-3xl font-black text-slate-900">{liveMatch.pensB || 0}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Man of the Match Section */}
        {liveMatch.status === 'finished' && (
          <div className="mt-16 max-w-2xl mx-auto border-t border-slate-100 pt-16">
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="h-px w-8 bg-amber-200" />
                <div className="flex items-center gap-2">
                  <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                  <h3 className="text-sm font-black uppercase tracking-[0.3em] text-amber-600">Man of the Match</h3>
                </div>
                <div className="h-px w-8 bg-amber-200" />
              </div>

              {manOfTheMatch ? (
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }} 
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-amber-50 border-2 border-amber-200 rounded-[32px] p-8 flex flex-col items-center gap-4 shadow-xl shadow-amber-500/10 min-w-[300px]"
                >
                  <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center border-4 border-amber-200 shadow-lg text-amber-500 font-black text-3xl">
                    {manOfTheMatch.number || <Zap className="w-8 h-8" />}
                  </div>
                  <div>
                    <h4 className="text-2xl font-black text-slate-900 tracking-tight">{manOfTheMatch.name}</h4>
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 mt-1">
                      {teams.find(t => t.id === manOfTheMatch.teamId)?.name}
                    </p>
                  </div>
                  {isCreator && (
                    <button 
                      onClick={() => setManOfTheMatch('')}
                      className="text-[10px] font-black text-amber-600/50 hover:text-red-500 uppercase tracking-widest transition-colors pt-2"
                    >
                      Change MotM
                    </button>
                  )}
                </motion.div>
              ) : isCreator ? (
                <div className="w-full space-y-4">
                  {suggestedPlayer && (
                    <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-center justify-between">
                      <div className="text-left">
                        <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Suggested by Performance</p>
                        <p className="font-bold text-slate-900">{suggestedPlayer.name}</p>
                      </div>
                      <button 
                        onClick={() => setManOfTheMatch(suggestedPlayer.id)}
                        className="bg-emerald-500 text-white px-4 py-2 rounded-full text-xs font-black shadow-lg shadow-emerald-500/20"
                      >
                        Confirm
                      </button>
                    </div>
                  )}
                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Man of the Match</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <select 
                        className="w-full bg-slate-50 px-5 py-4 rounded-2xl border border-slate-200 font-bold text-sm"
                        onChange={(e) => {
                          if (e.target.value) setManOfTheMatch(e.target.value);
                        }}
                        defaultValue=""
                      >
                        <option value="" disabled>Choose a player...</option>
                        <optgroup label={teamA?.name}>
                          {sortPlayersByPosition(playersA).map(p => (
                            <option key={p.id} value={p.id}>{p.name} (#{p.number})</option>
                          ))}
                        </optgroup>
                        <optgroup label={teamB?.name}>
                          {sortPlayersByPosition(playersB).map(p => (
                            <option key={p.id} value={p.id}>{p.name} (#{p.number})</option>
                          ))}
                        </optgroup>
                      </select>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-slate-300 font-bold italic text-sm">Not yet awarded</p>
              )}
            </div>
          </div>
        )}


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
                {showEventModal.type === 'goal' ? 
                  (showEventModal.step === 1 ? 'Goal Type' : 
                   showEventModal.step === 2 ? 'Select Scorer' : 'Goal Details') : 
                 showEventModal.type === 'substitution' ? 
                  (showEventModal.step === 1 ? 'Player Out' : 'Player In') :
                  (showEventModal.step === 1 ? 'Select Player' : 'Card Type')}
              </h3>

              {showEventModal.step === 1 ? (
                showEventModal.type === 'goal' ? (
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'open_goal', label: 'Open Goal' },
                      { id: 'header', label: 'Header' },
                      { id: 'penalty', label: 'Penalty' },
                      { id: 'free_kick', label: 'Free Kick' },
                      { id: 'own_goal', label: 'Own Goal', special: 'red' }
                    ].map(gType => (
                      <button
                        key={gType.id}
                        onClick={() => {
                          setShowEventModal({ 
                            ...showEventModal, 
                            step: 2,
                            data: { goalType: gType.id as GoalType } 
                          });
                        }}
                        className={`py-6 px-2 rounded-2xl transition-all font-black text-[10px] uppercase tracking-widest border border-slate-100 bg-slate-50 text-slate-600 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-600`}
                      >
                        {gType.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto pr-1 scrollbar-hide">
                    {sortPlayersByPosition(showEventModal.side === 'A' ? playersA : playersB)
                      .filter(p => {
                        if (showEventModal.type === 'substitution') return isEligible(p.id); 
                        return !redCardedPlayerIds.has(p.id);
                      })
                      .map((p, idx) => (
                      <button 
                        key={p.id}
                        onClick={() => {
                          if (showEventModal.type === 'yellow_card' || showEventModal.type === 'red_card') {
                            setShowEventModal({ ...showEventModal, step: 2, data: { playerId: p.id, cardType: 'yellow_card' } });
                          } else if (showEventModal.type === 'substitution') {
                            setShowEventModal({ ...showEventModal, step: 2, data: { playerOutId: p.id } });
                          }
                        }}
                        className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:border-emerald-500 hover:bg-emerald-50 transition-all text-left group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-[10px] font-black shadow-sm group-hover:text-emerald-600">
                            {showEventModal.type === 'substitution' ? <ArrowDown className="w-4 h-4 text-red-400" /> :
                             <Shield className="w-4 h-4 text-slate-300 group-hover:text-amber-400" />}
                          </div>
                          <div className="font-bold flex items-center gap-2">
                            {p.name.split(' (')[0].split(' #')[0]}
                          </div>
                        </div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{p.position}</div>
                      </button>
                    ))}
                  </div>
                )
              ) : showEventModal.step === 2 ? (
                showEventModal.type === 'goal' ? (
                  <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto pr-1 scrollbar-hide">
                    {sortPlayersByPosition(showEventModal.side === 'A' ? playersA : playersB)
                      .filter(p => isEligible(p.id))
                      .map((p) => (
                      <button 
                        key={p.id}
                        onClick={() => {
                          const gt = showEventModal.data.goalType;
                          if (gt === 'open_goal' || gt === 'header') {
                            setShowEventModal({ ...showEventModal, step: 3, data: { ...showEventModal.data, playerId: p.id } });
                          } else {
                            addEvent(p.id, 'goal', showEventModal.side === 'A' ? match.teamAId : match.teamBId, { goalType: gt });
                          }
                        }}
                        className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:border-emerald-500 hover:bg-emerald-50 transition-all text-left group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center">
                            <SoccerIcon className="w-4 h-4 text-slate-300 group-hover:text-emerald-500" />
                          </div>
                          <span className="font-bold">{p.name.split(' (')[0].split(' #')[0]}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{p.position}</div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-6">
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
                              .filter(p => p.id !== showEventModal.data.playerOutId && isEligible(p.id))
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
                )
              ) : (
                <div className="space-y-6">
                  {showEventModal.type === 'goal' && (
                    <>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Assisted by (Optional)</p>
                        <select 
                          className="w-full bg-slate-50 px-5 py-4 rounded-2xl border border-slate-200 font-bold text-sm"
                          defaultValue={showEventModal.data.assistantId || ""}
                          onChange={(e) => setShowEventModal({ ...showEventModal, data: { ...showEventModal.data, assistantId: e.target.value } })}
                        >
                          <option value="">No Assist</option>
                          {sortPlayersByPosition(showEventModal.side === 'A' ? playersA : playersB)
                            .filter(p => p.id !== showEventModal.data.playerId && isEligible(p.id))
                            .map((p) => <option key={p.id} value={p.id}>{p.name.split(' (')[0].split(' #')[0]} ({p.position})</option>)}
                        </select>
                      </div>

                      <button
                        onClick={() => {
                        addEvent(
                          showEventModal.data.playerId, 
                          'goal', 
                          showEventModal.side === 'A' ? match.teamAId : match.teamBId,
                          { 
                            assistantId: showEventModal.data.assistantId, 
                            goalType: showEventModal.data.goalType,
                            isPenaltyShootout: isPenaltyShootoutMode
                          }
                        );
                        }}
                        className="w-full py-4 bg-emerald-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all active:scale-95"
                      >
                        Record Goal
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
        <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto scrollbar-hide">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <Hash className="w-3.5 h-3.5 mx-auto" />
                  </th>
                  <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <UserIcon className="w-3.5 h-3.5" />
                  </th>
                  <th className="px-2 md:px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">
                    <PitchIcon className="w-3.5 h-3.5 mx-auto" />
                  </th>
                  <th className="px-2 md:px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">
                    <SoccerIcon className="w-3.5 h-3.5 mx-auto" />
                  </th>
                  <th className="hidden xs:table-cell px-2 md:px-4 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">
                    <HelpingHand className="w-3.5 h-3.5 mx-auto" />
                  </th>
                  <th className="px-2 md:px-3 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">
                    <div className="w-2 h-3 bg-amber-400 rounded-[1px] mx-auto opacity-40" />
                  </th>
                  <th className="px-2 md:px-3 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">
                    <div className="w-2 h-3 bg-red-500 rounded-[1px] mx-auto opacity-40" />
                  </th>
                  {isCreator && <th className="w-10 px-4"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {players.map((p, idx) => {
                  const stats = getPlayerStats(p.id);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-4 py-4">
                        <span className="text-xs md:text-sm font-medium text-slate-400">{idx + 1}</span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-slate-900 truncate text-xs md:text-base max-w-[100px] sm:max-w-none">{p.name.split(' (')[0].split(' #')[0]}</span>
                          <span className="text-[9px] text-slate-400 font-medium uppercase tracking-widest">{p.position || 'Player'}</span>
                        </div>
                      </td>
                      <td className="px-2 py-4 text-center">
                        <span className={`text-xs md:text-sm font-medium ${stats.matchesPlayed > 0 ? 'text-slate-600' : 'text-slate-400'}`}>{stats.matchesPlayed}</span>
                      </td>
                      <td className="px-2 py-4 text-center">
                        <span className={`text-xs md:text-sm font-medium ${stats.goals > 0 ? 'text-emerald-500' : 'text-slate-400'}`}>{stats.goals}</span>
                      </td>
                      <td className="hidden xs:table-cell px-2 py-4 text-center">
                        <span className={`text-xs md:text-sm font-medium ${stats.assists > 0 ? 'text-blue-500' : 'text-slate-400'}`}>{stats.assists}</span>
                      </td>
                      <td className="px-2 py-4 text-center">
                        <span className={`text-xs md:text-sm font-medium ${stats.yellow > 0 ? 'text-amber-500' : 'text-slate-400'}`}>{stats.yellow}</span>
                      </td>
                      <td className="px-2 py-4 text-center">
                        <span className={`text-xs md:text-sm font-medium ${stats.red > 0 ? 'text-red-500' : 'text-slate-400'}`}>{stats.red}</span>
                      </td>
                      {isCreator && (
                        <td className="px-2 py-4 text-right">
                          <button 
                            onClick={() => {
                              if (window.confirm(`Delete ${p.name}?`)) {
                                deleteDoc(doc(db, `tournaments/${tournament.id}/teams/${team.id}/players/${p.id}`));
                              }
                            }}
                            className="p-1 text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
                        <div className="font-medium text-slate-700">{p.name.split(' (')[0].split(' #')[0]}</div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-medium ${p.stats.goals > 0 ? 'bg-emerald-500 text-white' : 'text-slate-400'}`}>
                          {p.stats.goals}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-medium ${p.stats.yellow > 0 ? 'bg-yellow-400 text-yellow-900' : 'text-slate-400'}`}>
                          {p.stats.yellow}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-medium ${p.stats.red > 0 ? 'bg-red-500 text-white' : 'text-slate-400'}`}>
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

function DashboardView({ user, activeTab, onSelectTournament, onError }: { user: FirebaseUser, activeTab: 'tournaments' | 'teams' | 'profile' | 'following', onSelectTournament: (t: Tournament) => void, onError: (err: any) => void }) {
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

        // Fetch Following Tournaments
        if (followIds.size > 0) {
          const ids = Array.from(followIds);
          // Firestore 'in' limitation: handle chunks of 10 if needed, but for now assuming small list
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
                    <Plus className="w-3 h-3" /> New Arena
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  {userTournaments.length === 0 ? (
                    <div className="p-12 text-center bg-slate-50 rounded-[40px] border border-dashed border-slate-200">
                      <p className="text-slate-400 font-bold mb-4">You haven't built any arenas yet.</p>
                      <button onClick={() => (window as any).triggerCreateTournament()} className="px-6 py-3 bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest">Launch Arena</button>
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
                           {/* NOTE: Delete button removed from here as per "profiles only" request, though Organized might be what they mean. 
                               But I'll put it in the Profile Stats tab's management section if that's what they mean by 'profiles only' */}
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
                      <p className="text-slate-400 font-bold">You aren't active in any other arenas yet.</p>
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
                {/* Career Summary */}
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

                {/* Management Section - Where delete button shows (Profiles ONLY) */}
                <div className="space-y-4">
                  <h3 className="text-lg font-black uppercase tracking-tighter">Arena Management (Destructive)</h3>
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
}