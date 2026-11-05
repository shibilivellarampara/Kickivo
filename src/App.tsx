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
  getDoc,
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
  Shield,
  Sun,
  Moon,
  Settings,
  Smartphone
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
import { PWAInstallButton } from './components/common/PWAInstallButton';

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [view, setView] = useState<'home' | 'tournament' | 'create-tournament' | 'dashboard' | 'join-team'>('home');
  const [dashboardTab, setDashboardTab] = useState<'tournaments' | 'teams' | 'profile' | 'following'>('tournaments');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    let metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta');
      metaThemeColor.setAttribute('name', 'theme-color');
      document.head.appendChild(metaThemeColor);
    }

    if (theme === 'dark') {
      root.classList.add('dark');
      metaThemeColor.setAttribute('content', '#020617'); // slate-950
    } else {
      root.classList.remove('dark');
      metaThemeColor.setAttribute('content', '#f8fafc'); // slate-50
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [joinData, setJoinData] = useState<{ teamId: string, tournamentId: string } | null>(null);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [followedIds, setFollowedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setFollowedIds([]);
      return;
    }
    const q = collection(db, `users/${user.uid}/following`);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ids = snapshot.docs.map(doc => doc.data().tournamentId as string).filter(Boolean);
      setFollowedIds(ids);
    }, (error) => {
      console.error("Error listening to following subcollection: ", error);
    });
    return () => unsubscribe();
  }, [user]);
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

  // Deep linking: Auto-route to selected tournament if t, tournament, or s is in URL on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shortCode = params.get('s');

    if (shortCode) {
      const docRef = doc(db, 'short_urls', shortCode);
      getDoc(docRef).then((docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data && data.url) {
            const urlObj = new URL(data.url);
            window.history.replaceState({}, '', urlObj.search);
            
            const updatedParams = new URLSearchParams(urlObj.search);
            const tVal = updatedParams.get('t');
            const joinVal = updatedParams.get('join');
            
            if (joinVal && tVal) {
              setJoinData({ teamId: joinVal, tournamentId: tVal });
              setView('join-team');
            } else if (tVal && tournaments.length > 0) {
              const found = tournaments.find(t => t.id === tVal);
              if (found) {
                setSelectedTournament(found);
                setView('tournament');
              }
            } else if (tVal) {
              // Force component to re-read updated URL parameters on next render
              setView('home');
            }
          }
        }
      }).catch((err) => {
        console.error('Failed to resolve short URL:', err);
      });
      return;
    }

    if (tournaments.length > 0 && view === 'home') {
      const tourneyId = params.get('t') || params.get('tournament');
      const joinT = params.get('join');
      if (tourneyId && !joinT) {
        const found = tournaments.find(t => t.id === tourneyId);
        if (found) {
          setSelectedTournament(found);
          setView('tournament');
        }
      }
    }
  }, [tournaments, view]);

  const login = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (e) {
      handleError(e);
    }
  };

  useEffect(() => {
    (window as any).triggerLogin = login;
    return () => {
      delete (window as any).triggerLogin;
    };
  }, [login]);

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
    const isDark = theme === 'dark';

    return (
      <div className={`min-h-screen ${isDark ? 'bg-slate-950 text-white' : 'bg-white text-slate-900'} flex items-center justify-center overflow-hidden transition-colors duration-300`}>
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
                className={`${isDark ? 'text-white' : 'text-slate-900'} text-4xl font-black italic uppercase tracking-tighter`}
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
            <div className={`h-[2px] w-8 ${isDark ? 'bg-emerald-500/40' : 'bg-emerald-500/20'}`} />
            <span className="text-[10px] font-black uppercase text-emerald-500 tracking-[0.4em]">Arena Loading</span>
            <div className={`h-[2px] w-8 ${isDark ? 'bg-emerald-500/40' : 'bg-emerald-500/20'}`} />
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans overflow-x-hidden transition-colors duration-300">
      <header className="fixed top-0 left-0 right-0 z-[100] w-full bg-white/85 dark:bg-slate-900/90 backdrop-blur-3xl border-b border-black/5 dark:border-white/10 px-4 md:px-8 pt-[env(safe-area-inset-top,0px)] transition-colors duration-300">
        <div className="h-16 md:h-20 flex items-center justify-between w-full">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 md:gap-3 cursor-pointer group" onClick={() => { setView('home'); setSelectedTournament(null); }}>
              <div className="w-8 h-8 md:w-10 md:h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Zap className="w-5 h-5 md:w-6 md:h-6 text-white fill-white" />
              </div>
              <span className="font-black text-xl md:text-2xl tracking-tighter uppercase italic text-slate-900 dark:text-white">Kickivo</span>
            </div>
          </div>

        {/* Center Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-1 bg-slate-100/80 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-slate-200/40 dark:border-slate-700/60 shadow-sm transition-colors">
          <button 
            onClick={() => { setView('home'); setSelectedTournament(null); }} 
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
              view === 'home' 
                ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20 font-black' 
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            Explore
          </button>
          
          <button 
            onClick={() => { setView('dashboard'); setDashboardTab('tournaments'); }} 
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
              view === 'dashboard' && dashboardTab === 'tournaments' 
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md font-black' 
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white'
            }`}
          >
            <Trophy className="w-4 h-4" />
            Tournaments
          </button>

          {user && (
            <>
              <button 
                onClick={() => { setView('dashboard'); setDashboardTab('following'); }} 
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                  view === 'dashboard' && dashboardTab === 'following' 
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md font-black' 
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                <Star className="w-4 h-4 text-amber-500" />
                Following
              </button>

              <button 
                onClick={() => { setView('dashboard'); setDashboardTab('teams'); }} 
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                  view === 'dashboard' && dashboardTab === 'teams' 
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md font-black' 
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                <Users className="w-4 h-4 text-blue-500" />
                Squads
              </button>
            </>
          )}
        </nav>

        {/* Right side Profile & Quick Theme toggle */}
        <div className="flex items-center gap-2.5 md:gap-3">
          <button 
            type="button" 
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} 
            className="p-2 md:p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-all"
            aria-label="Toggle Theme"
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-amber-400" />}
          </button>

          {user ? (
            <div className="relative">
              <button 
                onClick={() => setIsProfileOpen(!isProfileOpen)} 
                className="flex items-center gap-2.5 p-1 bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 rounded-full transition-all focus:outline-none"
              >
                <img src={user.photoURL || ''} alt="Profile" className="w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-white dark:border-slate-800" />
              </button>
              
              <AnimatePresence>
                {isProfileOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsProfileOpen(false)} />
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95, y: 15 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 15 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-3 w-64 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-3xl shadow-xl z-50 overflow-hidden divide-y divide-slate-150 dark:divide-slate-800"
                    >
                      <div className="px-5 py-4">
                        <p className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Signed In As</p>
                        <p className="font-bold text-sm text-slate-800 dark:text-slate-200 truncate mt-1">{user.displayName || 'Player'}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">{user.email}</p>
                      </div>

                      <div className="p-2 space-y-1">
                        <button 
                          onClick={() => { 
                            setView('dashboard'); 
                            setDashboardTab('profile'); 
                            setIsProfileOpen(false); 
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-2xl transition-all text-left"
                        >
                          <UserIcon className="w-4 h-4 text-emerald-500" />
                          <span>My Profile</span>
                        </button>

                        <button 
                          onClick={() => { 
                            setView('dashboard'); 
                            setDashboardTab('tournaments'); 
                            setIsProfileOpen(false); 
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-2xl transition-all text-left"
                        >
                          <Settings className="w-4 h-4 text-slate-500" />
                          <span>Dashboard Settings</span>
                        </button>

                        <PWAInstallButton 
                          variant="menu" 
                          onSelect={() => setIsProfileOpen(false)} 
                        />

                        <button 
                          onClick={() => { 
                            setTheme(theme === 'light' ? 'dark' : 'light'); 
                          }}
                          className="w-full flex items-center justify-between px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-2xl transition-all text-left"
                        >
                          <div className="flex items-center gap-3">
                            {theme === 'light' ? <Moon className="w-4 h-4 text-slate-500" /> : <Sun className="w-4 h-4 text-amber-500" />}
                            <span>Dark Theme</span>
                          </div>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 lowercase bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full font-mono">
                            {theme === 'dark' ? 'on' : 'off'}
                          </span>
                        </button>
                      </div>

                      <div className="p-2">
                        <button 
                          onClick={() => { 
                            logout(); 
                            setIsProfileOpen(false); 
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-xs font-bold uppercase tracking-wider text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-2xl transition-all text-left"
                        >
                          <LogOut className="w-4 h-4" />
                          <span>Logout</span>
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <div className="relative flex items-center gap-2">
              <button onClick={login} className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-emerald-500 dark:hover:bg-emerald-500 dark:hover:text-white px-3.5 md:px-5 py-2 md:py-2.5 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-md">
                Sign In
              </button>

              <button 
                onClick={() => setIsProfileOpen(!isProfileOpen)} 
                className="p-2 md:p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-all"
                title="Options"
                aria-label="Options"
              >
                <UserIcon className="w-4 h-4" />
              </button>

              <AnimatePresence>
                {isProfileOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsProfileOpen(false)} />
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95, y: 15 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 15 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-3 w-64 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-3xl shadow-xl z-50 overflow-hidden divide-y divide-slate-150 dark:divide-slate-800"
                    >
                      <div className="px-5 py-4">
                        <p className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">Welcome Guest</p>
                        <p className="font-bold text-sm text-slate-800 dark:text-slate-200 truncate mt-1">Kickivo Arena</p>
                      </div>

                      <div className="p-2 space-y-1">
                        <button 
                          onClick={() => { login(); setIsProfileOpen(false); }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-2xl transition-all text-left"
                        >
                          <LogIn className="w-4 h-4 text-emerald-500" />
                          <span>Sign In with Google</span>
                        </button>

                        <PWAInstallButton 
                          variant="menu" 
                          onSelect={() => setIsProfileOpen(false)} 
                        />

                        <button 
                          onClick={() => { setTheme(theme === 'light' ? 'dark' : 'light'); }}
                          className="w-full flex items-center justify-between px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-2xl transition-all text-left"
                        >
                          <div className="flex items-center gap-3">
                            {theme === 'light' ? <Moon className="w-4 h-4 text-slate-500" /> : <Sun className="w-4 h-4 text-amber-500" />}
                            <span>Dark Theme</span>
                          </div>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 lowercase bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full font-mono">
                            {theme === 'dark' ? 'on' : 'off'}
                          </span>
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
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

      <div className="max-w-7xl mx-auto px-4 pt-[calc(4.75rem+env(safe-area-inset-top,0px))] md:pt-[7.5rem] pb-[calc(6rem+env(safe-area-inset-bottom,0px))] w-full dark:text-slate-100 transition-colors">
        <main className="min-h-[80vh] min-w-0 pb-28 md:pb-8">
          <AnimatePresence mode="wait">
            {view === 'home' && (
              <motion.div key="home" className="space-y-12">
                <HomeView tournaments={tournaments} user={user} followedIds={followedIds} onSelectTournament={(t) => { setSelectedTournament(t); setView('tournament'); }} />
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
            {view === 'join-team' && !user && joinData && (
              <motion.div key="join-signin" className="max-w-xl mx-auto">
                <div className="bg-white dark:bg-slate-900 rounded-[40px] p-8 md:p-12 border border-slate-200 dark:border-slate-800 shadow-xl text-center space-y-6">
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Invitation to Join</p>
                  <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-900 dark:text-white">Sign in to join your team</h2>
                  <p className="text-slate-500 dark:text-slate-400 font-medium">You have been invited to join a team. Sign in with Google to continue.</p>
                  <div className="flex flex-col gap-4">
                    <button onClick={login} className="w-full py-5 bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-100">
                      Sign in with Google
                    </button>
                    <button onClick={() => setView('home')} className="text-slate-400 font-bold text-xs uppercase tracking-widest hover:text-slate-600">
                      Cancel
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
            {view === 'dashboard' && user && (
              <motion.div key="dashboard">
                <DashboardView user={user} activeTab={dashboardTab} onTabChange={setDashboardTab} onSelectTournament={(t) => { setSelectedTournament(t); setView('tournament'); }} onError={handleError} />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Mobile Floating Bottom Navigation Bar (Always visible on mobile) */}
      <nav className="md:hidden fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px))] left-1/2 -translate-x-1/2 z-[100] w-[94%] max-w-[440px] h-16 bg-white/85 dark:bg-slate-900/85 backdrop-blur-2xl border border-slate-100 dark:border-slate-800 rounded-[24px] shadow-lg shadow-slate-200/55 dark:shadow-black/30 flex items-center justify-around px-2">
        {user ? (
          [
            { id: 'home', icon: LayoutGrid, label: 'Explore' },
            { id: 'tournaments', icon: Trophy, label: 'Tournaments', tab: 'tournaments' },
            { id: 'following', icon: Star, label: 'Following', tab: 'following' },
            { id: 'teams', icon: Users, label: 'Teams', tab: 'teams' },
            { id: 'profile', icon: UserIcon, label: 'Me', tab: 'profile' }
          ].map((item) => {
            const isActive = item.id === 'home' ? view === 'home' : (view === 'dashboard' && dashboardTab === item.tab);
            const Icon = item.icon;
            return (
              <button 
                key={item.id} 
                onClick={() => { 
                  if (item.id === 'home') {
                    setView('home'); 
                    setSelectedTournament(null);
                  } else { 
                    setView('dashboard'); 
                    setDashboardTab(item.tab as any); 
                  } 
                }} 
                className={`relative flex flex-col items-center justify-center gap-0.5 min-h-[44px] min-w-[44px] rounded-2xl transition-all ${isActive ? 'text-emerald-500 scale-105' : 'text-slate-400'}`}
              >
                {isActive && <motion.div layoutId="mobile-nav-bg" className="absolute inset-0 bg-emerald-500/10 rounded-2xl" />}
                <Icon className="w-5 h-5 relative z-10" />
                <span className="text-[9px] font-bold uppercase tracking-wider relative z-10">{item.label}</span>
              </button>
            );
          })
        ) : (
          [
            { id: 'home', icon: LayoutGrid, label: 'Explore' },
            { id: 'tournaments', icon: Trophy, label: 'Tournaments' },
            { id: 'install', icon: Smartphone, label: 'Install', isInstall: true },
            { id: 'signin', icon: LogIn, label: 'Sign In', isSignIn: true }
          ].map((item) => {
            if (item.isInstall) {
              return <PWAInstallButton key="install" variant="nav" />;
            }
            const isActive = item.id === 'home' && view === 'home';
            const Icon = item.icon;
            return (
              <button 
                key={item.id} 
                onClick={() => { 
                  if (item.id === 'home' || item.id === 'tournaments') {
                    setView('home'); 
                    setSelectedTournament(null);
                  } else if (item.isSignIn) {
                    login();
                  }
                }} 
                className={`relative flex flex-col items-center justify-center gap-0.5 min-h-[44px] min-w-[44px] rounded-2xl transition-all ${isActive ? 'text-emerald-500 scale-105' : 'text-slate-400'}`}
              >
                {isActive && <motion.div layoutId="mobile-nav-bg-guest" className="absolute inset-0 bg-emerald-500/10 rounded-2xl" />}
                <Icon className="w-5 h-5 relative z-10" />
                <span className="text-[9px] font-bold uppercase tracking-wider relative z-10">{item.label}</span>
              </button>
            );
          })
        )}
      </nav>
    </div>
  );
}
