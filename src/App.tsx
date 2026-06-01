import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  orderBy, 
  doc, 
  getDocFromServer, 
  setDoc 
} from 'firebase/firestore';
import { 
  Trophy, 
  Users, 
  Plus, 
  LogIn, 
  LogOut,
  ChevronRight, 
  User as UserIcon, 
  Zap, 
  X, 
  Menu,
  Star,
  RefreshCw,
  LayoutGrid,
  Activity,
  Shield
} from 'lucide-react';
import { auth, db, OperationType, handleFirestoreError } from './lib/firebase';
import { Tournament } from './types';
import { AppLogo } from './components/common/Icons';

// Extracted Components
import { HomeView } from './components/Home/HomeView';
import { DashboardView } from './components/Dashboard/DashboardView';
import { TournamentView } from './components/Tournament/TournamentView';
import { CreateTournamentView } from './components/Tournament/CreateTournamentView';
import { JoinTeamView } from './components/Tournament/JoinTeamView';
import { RecruitmentBoard } from './components/views/RecruitmentBoard';

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

  // Swipe-to-back history tracking
  const [viewHistory, setViewHistory] = useState<string[]>(['home']);
  const historyRef = React.useRef<string[]>(['home']);
  const viewRef = React.useRef<string>('home');

  useEffect(() => {
    viewRef.current = view;
    setViewHistory(prev => {
      if (prev[prev.length - 1] === view) return prev;
      const next = view === 'home' ? ['home'] : [...prev, view];
      historyRef.current = next;
      return next;
    });
  }, [view]);

  const handleGoBack = React.useCallback(() => {
    const prev = historyRef.current;
    if (prev.length > 1) {
      const nextHistory = [...prev];
      nextHistory.pop(); // Remove current view
      const lastView = nextHistory[nextHistory.length - 1];
      
      historyRef.current = nextHistory;
      setViewHistory(nextHistory);
      setView(lastView as any);
      if (lastView === 'home') {
        setSelectedTournament(null);
      }
    } else {
      historyRef.current = ['home'];
      setViewHistory(['home']);
      setView('home');
      setSelectedTournament(null);
    }
  }, []);

  const clearError = () => setGlobalError(null);
  const clearMessage = () => setGlobalMessage(null);

  const notify = (msg: string) => {
    setGlobalMessage(msg);
    setTimeout(clearMessage, 1500);
  };

  const handleError = (err: any) => {
    let message = "An unexpected error occurred.";
    if (err instanceof Error) {
      message = err.message;
      if (message.startsWith('{')) {
        try {
          const parsed = JSON.parse(message);
          if (parsed.error) message = parsed.error;
          if (message.includes('Missing or insufficient permissions')) {
            message = "You don't have permission to do that. Please make sure you are signed in and are the creator.";
          }
        } catch (e) {}
      }
    } else if (typeof err === 'string') {
      message = err;
    }
    setGlobalError(message);
    setTimeout(clearError, 6000);
  };

  useEffect(() => {
    const errorListener = (e: any) => handleError(e.detail);
    window.addEventListener('app-error', errorListener);

    // Swipe left-to-right detector
    let touchStartX = 0;
    let touchStartY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.changedTouches.length !== 1) return;
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;

      const deltaX = touchEndX - touchStartX;
      const deltaY = Math.abs(touchEndY - touchStartY);

      // Trigger standard back gesture if horizontal displacement > 75px and start boundary is left 30%
      if (
        touchStartX < Math.max(150, window.innerWidth * 0.3) &&
        deltaX > 75 &&
        deltaY < 50
      ) {
        const swipeEvent = new CustomEvent('swipe-back', { cancelable: true });
        const defaulted = window.dispatchEvent(swipeEvent);
        if (defaulted) {
          handleGoBack();
        }
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
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
      handleFirestoreError(error, OperationType.GET, 'tournaments');
    });

    (window as any).triggerCreateTournament = () => setView('create-tournament');

    const params = new URLSearchParams(window.location.search);
    const joinT = params.get('join');
    const tourneyT = params.get('t');
    if (joinT && tourneyT) {
      setJoinData({ teamId: joinT, tournamentId: tourneyT });
      setView('join-team');
    }

    return () => {
      window.removeEventListener('app-error', errorListener);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
      unsubscribeAuth();
      unsubscribeTournaments();
    };
  }, [handleGoBack]);

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
    const name = "KICKIVO";
    const characters = name.split("");

    return (
      <div className="min-h-screen bg-white flex items-center justify-center overflow-hidden">
        <div className="relative flex flex-col items-center">
          {/* Logo Animation: Coming from nothing */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ 
              type: "spring",
              stiffness: 260,
              damping: 20,
              duration: 1 
            }}
            className="mb-8"
          >
            <div className="w-24 h-24 bg-emerald-500 rounded-[32px] flex items-center justify-center shadow-2xl shadow-emerald-500/20">
              <Zap className="w-12 h-12 text-white fill-white" />
            </div>
          </motion.div>

          {/* Name Display: Character by Character */}
          <div className="flex gap-1">
            {characters.map((char, index) => (
              <motion.span
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.5,
                  delay: 0.5 + (index * 0.1),
                  ease: "easeOut"
                }}
                className="text-slate-900 text-4xl font-black italic uppercase tracking-tighter"
              >
                {char}
              </motion.span>
            ))}
          </div>

          {/* Subtext Animation */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5, duration: 1 }}
            className="flex items-center gap-3 mt-4"
          >
            <div className="h-[2px] w-8 bg-emerald-500/20" />
            <span className="text-[10px] font-black uppercase text-emerald-500 tracking-[0.4em]">Arena Loading</span>
            <div className="h-[2px] w-8 bg-emerald-500/20" />
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans overflow-x-hidden">
      <header className="sticky top-0 z-[100] w-full bg-white/70 backdrop-blur-3xl border-b border-black/5 px-4 md:px-8 h-16 md:h-20 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2.5 bg-slate-100 rounded-xl lg:hidden text-slate-600">
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2 md:gap-3 cursor-pointer group" onClick={() => { setView('home'); setSelectedTournament(null); }}>
            <div className="w-8 h-8 md:w-10 md:h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Zap className="w-5 h-5 md:w-6 md:h-6 text-white fill-white" />
            </div>
            <span className="font-black text-xl md:text-2xl tracking-tighter uppercase italic">Kickivo</span>
          </div>
        </div>
        <div>
          {user ? (
            <button onClick={() => { setView('dashboard'); setDashboardTab('profile'); }} className="flex items-center gap-2.5 p-1 bg-black/5 rounded-full">
              <img src={user.photoURL || ''} alt="" className="w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-white" />
            </button>
          ) : (
            <button onClick={login} className="bg-slate-900 text-white px-5 py-2.5 rounded-2xl font-black text-[10px] uppercase tracking-widest">
              Sign In
            </button>
          )}
        </div>
      </header>

      <AnimatePresence>
        {globalError && (
          <motion.div initial={{ y: -100 }} animate={{ y: 0 }} exit={{ y: -100 }} className="fixed top-4 left-4 right-4 z-[1000] flex justify-center">
            <div className="bg-red-500 text-white px-6 py-4 rounded-2xl shadow-xl flex items-center gap-4 border-2 border-white/20">
              <Zap className="w-5 h-5 flex-shrink-0 animate-pulse" />
              <p className="font-bold">{globalError}</p>
              <button onClick={clearError}><X className="w-5 h-5" /></button>
            </div>
          </motion.div>
        )}
        {globalMessage && (
          <motion.div initial={{ y: -100 }} animate={{ y: 0 }} exit={{ y: -100 }} className="fixed top-4 left-4 right-4 z-[1000] flex justify-center">
            <div className="bg-emerald-500 text-white px-6 py-4 rounded-2xl shadow-xl flex items-center gap-4">
              <Zap className="w-5 h-5" />
              <p className="font-bold">{globalMessage}</p>
              <button onClick={clearMessage}><X className="w-5 h-5" /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto px-4 pt-8 pb-24 w-full">
        <div className="flex flex-col lg:flex-row gap-8 min-h-[80vh] relative">
          <AnimatePresence>
            {(isSidebarOpen || (typeof window !== 'undefined' && window.innerWidth >= 1024)) && (
              <motion.aside initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} className={`fixed lg:sticky top-0 left-0 h-screen z-[200] lg:z-0 w-80 lg:w-72 shrink-0 ${isSidebarOpen ? 'block' : 'hidden lg:block'}`}>
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm lg:hidden z-[-1]" onClick={() => setIsSidebarOpen(false)} />
                <div className="bg-white/90 backdrop-blur-3xl lg:border-r border-black/5 p-6 flex flex-col h-full">
                  <div className="flex items-center gap-4 cursor-pointer pb-8 mb-6 border-b border-black/5" onClick={() => { setView('home'); setSelectedTournament(null); setIsSidebarOpen(false); }}>
                    <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                      <Zap className="w-7 h-7 text-white fill-white" />
                    </div>
                    <div>
                      <h1 className="font-black text-2xl tracking-tighter uppercase italic">Kickivo</h1>
                      <p className="text-[9px] font-black uppercase text-emerald-500 tracking-[0.2em] mt-1">Official Hub</p>
                    </div>
                  </div>
                  {user && (
                    <nav className="space-y-2 flex-1">
                      <button onClick={() => { setView('home'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${view === 'home' ? 'bg-emerald-500 text-white shadow-xl shadow-emerald-500/30 font-black' : 'text-slate-500 hover:bg-black/5'}`}>
                        <LayoutGrid className="w-5 h-5" />
                        <span className="text-[10px] uppercase tracking-widest">Explore Matches</span>
                      </button>
                      <button onClick={() => { setView('dashboard'); setDashboardTab('tournaments'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${view === 'dashboard' && dashboardTab === 'tournaments' ? 'bg-slate-900 text-white shadow-xl shadow-slate-900/30 font-black' : 'text-slate-500 hover:bg-black/5'}`}>
                        <Activity className="w-5 h-5" />
                        <span className="text-[10px] uppercase tracking-widest">Active Tournaments</span>
                      </button>
                      <button onClick={() => { setView('dashboard'); setDashboardTab('following'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${view === 'dashboard' && dashboardTab === 'following' ? 'bg-slate-900 text-white shadow-xl shadow-slate-900/30 font-black' : 'text-slate-500 hover:bg-black/5'}`}>
                        <Star className="w-5 h-5 text-amber-400" />
                        <span className="text-[10px] uppercase tracking-widest">Following</span>
                      </button>
                      <button onClick={() => { setView('dashboard'); setDashboardTab('teams'); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${view === 'dashboard' && dashboardTab === 'teams' ? 'bg-slate-900 text-white shadow-xl shadow-slate-900/30 font-black' : 'text-slate-500 hover:bg-black/5'}`}>
                        <Users className="w-5 h-5 text-blue-500" />
                        <span className="text-[10px] uppercase tracking-widest">Squads</span>
                      </button>
                    </nav>
                  )}
                  {user ? (
                    <div className="mt-auto pt-8 border-t border-black/5 flex flex-col gap-4 p-4">
                      <button onClick={() => { logout(); setIsSidebarOpen(false); }} className="flex items-center gap-4 text-slate-400 hover:text-red-500 transition-colors">
                        <LogOut className="w-5 h-5" />
                        <span className="font-black text-[10px] uppercase tracking-widest">Logout</span>
                      </button>
                      <div className="pt-4 flex items-center justify-between">
                        <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">Kickivo Platform</span>
                        <span className="text-[9px] font-black text-slate-300 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">v1.2.4</span>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-auto flex flex-col gap-8">
                      <button onClick={login} className="w-full flex items-center justify-center gap-3 p-5 rounded-2xl bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest shadow-xl shadow-slate-900/20">
                        <LogIn className="w-5 h-5" />
                        <span>Direct Sign In</span>
                      </button>
                      <div className="px-4 flex items-center justify-between">
                        <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">Kickivo Platform</span>
                        <span className="text-[9px] font-black text-slate-300 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">v1.2.4</span>
                      </div>
                    </div>
                  )}
                </div>
              </motion.aside>
            )}
          </AnimatePresence>

          <main className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              {view === 'home' && (
                <motion.div key="home" className="space-y-12">
                  <HomeView tournaments={tournaments} onSelectTournament={(t) => { setSelectedTournament(t); setView('tournament'); }} />
                  <RecruitmentBoard user={user} onError={handleError} notify={notify} />
                </motion.div>
              )}
              {view === 'tournament' && selectedTournament && (
                <motion.div key="tournament">
                  <TournamentView 
                    tournament={selectedTournament} 
                    user={user} 
                    onBack={() => { setView('home'); setSelectedTournament(null); }} 
                    onError={handleError} 
                    notify={notify} 
                  />
                </motion.div>
              )}
              {view === 'create-tournament' && (
                <motion.div key="create">
                  <CreateTournamentView user={user} onSuccess={() => { setView('dashboard'); setDashboardTab('tournaments'); notify('Tournament created!'); }} onError={handleError} />
                </motion.div>
              )}
              {view === 'join-team' && user && joinData && (
                <motion.div key="join" className="max-w-xl mx-auto">
                  <JoinTeamView 
                    teamId={joinData.teamId} 
                    tournamentId={joinData.tournamentId} 
                    user={user} 
                    onSuccess={() => { setView('dashboard'); setDashboardTab('teams'); notify('Joined the team!'); window.history.replaceState({}, '', '/'); }} 
                    onCancel={() => setView('home')} 
                  />
                </motion.div>
              )}
              {view === 'dashboard' && user && (
                <motion.div key="dashboard">
                  <DashboardView user={user} activeTab={dashboardTab} onSelectTournament={(t) => { setSelectedTournament(t); setView('tournament'); }} onError={handleError} />
                </motion.div>
              )}
            </AnimatePresence>
          </main>
        </div>
      </div>

      {user && (
        <nav className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-[90%] h-16 bg-white/60 backdrop-blur-2xl border border-white/40 rounded-[32px] shadow-xl flex items-center justify-around px-2">
            {[
            { id: 'home', icon: LayoutGrid, label: 'Explore' },
            { id: 'tournaments', icon: Trophy, label: 'Tournaments', tab: 'tournaments' },
            { id: 'teams', icon: Users, label: 'Teams', tab: 'teams' },
            { id: 'profile', icon: UserIcon, label: 'Me', tab: 'profile' }
          ].map((item) => {
            const isActive = item.id === 'home' ? view === 'home' : (view === 'dashboard' && dashboardTab === item.tab);
            const Icon = item.icon;
            return (
              <button key={item.id} onClick={() => { if (item.id === 'home') setView('home'); else { setView('dashboard'); setDashboardTab(item.tab as any); } }} className={`relative flex flex-col items-center justify-center gap-0.5 min-h-[44px] min-w-[44px] rounded-2xl transition-all ${isActive ? 'text-emerald-500 scale-110' : 'text-slate-400'}`}>
                {isActive && <motion.div layoutId="mobile-nav-bg" className="absolute inset-0 bg-emerald-500/10 rounded-2xl" />}
                <Icon className="w-5 h-5 relative z-10" />
                <span className="text-[9px] font-bold uppercase tracking-wider relative z-10">{item.label}</span>
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}
