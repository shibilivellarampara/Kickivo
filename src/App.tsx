import React, { useState, useEffect } from 'react';
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
  serverTimestamp, 
  doc, 
  getDocFromServer,
  setDoc
} from 'firebase/firestore';
import { auth, db, OperationType, handleFirestoreError } from './lib/firebase';
import { Tournament, Match, Team, User } from './types';
import { Trophy, Users, LayoutDashboard, Plus, Play, LogIn, LogOut, ChevronRight, User as UserIcon, Calendar, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Sub-components will be defined or imported here
// For brevity in one file, I'll define some inline or use a simple router pattern

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [view, setView] = useState<'home' | 'tournament' | 'create-tournament' | 'profile'>('home');
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // Ensure user doc exists
        const userRef = doc(db, 'users', firebaseUser.uid);
        const userDoc = await getDocFromServer(userRef);
        if (!userDoc.exists()) {
          try {
            await setDoc(userRef, {
              uid: firebaseUser.uid,
              displayName: firebaseUser.displayName || 'Anonymous',
              email: firebaseUser.email || '',
              photoURL: firebaseUser.photoURL || '',
              role: 'user'
            });
          } catch (e) {
            handleFirestoreError(e, OperationType.WRITE, `users/${firebaseUser.uid}`);
          }
        }
      }
      setLoading(false);
    });

    const q = query(collection(db, 'tournaments'));
    const unsubscribeTournaments = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tournament));
      setTournaments(docs);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'tournaments');
    });

    return () => {
      unsubscribeAuth();
      unsubscribeTournaments();
    };
  }, []);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const logout = async () => {
    await signOut(auth);
    setView('home');
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
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-bottom border-slate-200">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div 
            className="flex items-center gap-2 cursor-pointer" 
            onClick={() => { setView('home'); setSelectedTournament(null); }}
          >
            <div className="bg-emerald-500 p-2 rounded-lg">
              <Trophy className="text-white w-5 h-5" />
            </div>
            <span className="font-bold text-xl tracking-tight">FootyHeroes</span>
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <>
                <button 
                  onClick={() => setView('create-tournament')}
                  className="hidden md:flex items-center gap-2 bg-emerald-500 text-white px-4 py-2 rounded-full font-medium text-sm hover:bg-emerald-600 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Create Tournament
                </button>
                <div className="flex items-center gap-2 ml-2">
                  <img src={user.photoURL || ''} alt="" className="w-8 h-8 rounded-full border border-slate-200" />
                  <button onClick={logout} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                    <LogOut className="w-5 h-5 text-slate-500" />
                  </button>
                </div>
              </>
            ) : (
              <button 
                onClick={login}
                className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2 rounded-full font-medium text-sm hover:bg-slate-800 transition-colors"
              >
                <LogIn className="w-4 h-4" /> Sign In
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {view === 'home' && (
            <motion.div key="home">
              <HomeView 
                tournaments={tournaments} 
                onSelectTournament={(t) => {
                  setSelectedTournament(t);
                  setView('tournament');
                }}
              />
            </motion.div>
          )}
          {view === 'tournament' && selectedTournament && (
            <motion.div key="tournament">
              <TournamentView 
                tournament={selectedTournament} 
                user={user}
              />
            </motion.div>
          )}
          {view === 'create-tournament' && (
            <motion.div key="create">
              <CreateTournamentView 
                user={user} 
                onSuccess={() => setView('home')} 
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Mobile Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-top border-slate-200 px-6 py-3 flex justify-between items-center z-50">
        <button 
          onClick={() => setView('home')}
          className={`flex flex-col items-center gap-1 ${view === 'home' ? 'text-emerald-500' : 'text-slate-400'}`}
        >
          <LayoutDashboard className="w-6 h-6" />
          <span className="text-[10px] uppercase font-bold">Explore</span>
        </button>
        <button 
          onClick={() => user ? setView('create-tournament') : login()}
          className="flex flex-col items-center gap-1 bg-emerald-500 text-white p-3 rounded-full -mt-10 shadow-lg"
        >
          <Plus className="w-6 h-6" />
        </button>
        <button 
          onClick={() => setView('profile')}
          className={`flex flex-col items-center gap-1 ${view === 'profile' ? 'text-emerald-500' : 'text-slate-400'}`}
        >
          <UserIcon className="w-6 h-6" />
          <span className="text-[10px] uppercase font-bold">Profile</span>
        </button>
      </nav>
    </div>
  );
}

function HomeView({ tournaments, onSelectTournament }: { tournaments: Tournament[], onSelectTournament: (t: Tournament) => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-12"
    >
      <header className="space-y-4">
        <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-slate-900 leading-none">
          LOCAL HEROES,<br/>
          <span className="text-emerald-500">GLOBAL RECOGNITION.</span>
        </h1>
        <p className="text-lg text-slate-500 max-w-xl">
          The ultimate platform for local football tournaments. Track scores, discover talent, and build your football legacy.
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

function CreateTournamentView({ user, onSuccess }: { user: FirebaseUser | null, onSuccess: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<Tournament['type']>('league');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      await addDoc(collection(db, 'tournaments'), {
        name,
        description,
        type,
        creatorId: user.uid,
        status: 'upcoming',
        createdAt: new Date().toISOString()
      });
      onSuccess();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'tournaments');
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
        <div className="grid grid-cols-2 gap-4">
          <div 
            onClick={() => setType('league')}
            className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${
              type === 'league' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-100 hover:border-slate-200'
            }`}
          >
            <Calendar className={`w-6 h-6 mb-2 ${type === 'league' ? 'text-emerald-500' : 'text-slate-300'}`} />
            <div className="font-bold">League</div>
            <div className="text-xs text-slate-500">Round robin format</div>
          </div>
          <div 
            onClick={() => setType('knockout')}
            className={`p-5 rounded-2xl border-2 cursor-pointer transition-all ${
              type === 'knockout' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-100 hover:border-slate-200'
            }`}
          >
            <Zap className={`w-6 h-6 mb-2 ${type === 'knockout' ? 'text-emerald-500' : 'text-slate-300'}`} />
            <div className="font-bold">Knockout</div>
            <div className="text-xs text-slate-500">Winner takes all</div>
          </div>
        </div>
        <button 
          type="submit"
          className="w-full bg-emerald-500 text-white font-bold py-5 rounded-2xl shadow-lg hover:bg-emerald-600 transition-all hover:scale-[1.02] active:scale-100"
        >
          Create Tournament
        </button>
      </form>
    </motion.div>
  );
}

function TournamentView({ tournament, user }: { tournament: Tournament, user: FirebaseUser | null }) {
  const [activeTab, setActiveTab] = useState<'matches' | 'teams' | 'standings'>('matches');
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [showAddTeam, setShowAddTeam] = useState(false);
  const [showAddMatch, setShowAddMatch] = useState(false);

  useEffect(() => {
    const teamsQ = query(collection(db, `/tournaments/${tournament.id}/teams`));
    const unsubscribeTeams = onSnapshot(teamsQ, (s) => {
      setTeams(s.docs.map(d => ({ id: d.id, ...d.data() } as Team)));
    });

    const matchesQ = query(collection(db, `/tournaments/${tournament.id}/matches`));
    const unsubscribeMatches = onSnapshot(matchesQ, (s) => {
      setMatches(s.docs.map(d => ({ id: d.id, ...d.data() } as Match)));
    });

    return () => {
      unsubscribeTeams();
      unsubscribeMatches();
    };
  }, [tournament.id]);

  const isCreator = user?.uid === tournament.creatorId;

  if (selectedMatch) {
    return (
      <MatchScoringView 
        tournament={tournament}
        match={selectedMatch} 
        teams={teams}
        onBack={() => setSelectedMatch(null)}
        isCreator={isCreator}
      />
    );
  }

  const standings = teams.map(team => {
    const teamMatches = matches.filter(m => m.status === 'finished' && (m.teamAId === team.id || m.teamBId === team.id));
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
          <div className="flex gap-2">
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
          </div>
        )}
      </div>

      <div className="flex items-center gap-8 border-b border-slate-200">
        {(['matches', 'teams', 'standings'] as const).map(tab => (
          <button 
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-4 text-sm font-bold uppercase tracking-wider transition-all relative ${
              activeTab === tab ? 'text-emerald-500' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            {tab}
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
            className="space-y-4"
          >
            {matches.length === 0 ? (
              <div className="py-20 text-center font-bold text-slate-300 uppercase tracking-widest bg-white rounded-3xl border border-slate-100 italic">
                No matches scheduled yet
              </div>
            ) : (
              matches.map(m => (
                <div 
                  key={m.id} 
                  onClick={() => setSelectedMatch(m)}
                  className="bg-white p-6 rounded-3xl border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-6 group hover:border-emerald-200 transition-all shadow-sm cursor-pointer"
                >
                  <div className="flex-1 flex items-center justify-end gap-6 w-full md:w-auto">
                    <span className="font-black text-xl text-right">{teams.find(t => t.id === m.teamAId)?.name || 'Team A'}</span>
                    <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-2xl font-black group-hover:bg-emerald-50 group-hover:text-emerald-500 transition-colors">
                      {m.scoreA}
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-[10px] font-black uppercase text-slate-300 tracking-[0.3em]">VS</span>
                    <div className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      m.status === 'live' ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {m.status}
                    </div>
                  </div>

                  <div className="flex-1 flex items-center justify-start gap-6 w-full md:w-auto">
                    <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-2xl font-black group-hover:bg-emerald-50 group-hover:text-emerald-500 transition-colors">
                      {m.scoreB}
                    </div>
                    <span className="font-black text-xl">{teams.find(t => t.id === m.teamBId)?.name || 'Team B'}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {isCreator && m.status !== 'finished' && (
                      <div className="p-3 bg-slate-900 text-white rounded-2xl group-hover:bg-emerald-500 transition-all">
                        <Play className="w-4 h-4 fill-current" />
                      </div>
                    )}
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-emerald-500 transition-colors" />
                  </div>
                </div>
              ))
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
                <div key={t.id} className="aspect-square bg-white border border-slate-200 rounded-3xl p-6 flex flex-col items-center justify-center gap-4 text-center group hover:border-emerald-200 transition-all shadow-sm">
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100 group-hover:bg-emerald-50 transition-colors mb-2">
                    <Users className="w-8 h-8 text-slate-300 group-hover:text-emerald-500" />
                  </div>
                  <span className="font-black text-sm uppercase tracking-tight">{t.name}</span>
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
            className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Pos</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Team</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">P</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">W</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">D</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">L</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">GD</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Pts</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {standings.map((s, idx) => (
                    <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-5 font-black text-slate-400">{idx + 1}</td>
                      <td className="px-6 py-5 font-black">{s.name}</td>
                      <td className="px-6 py-5 text-center font-bold">{s.played}</td>
                      <td className="px-6 py-5 text-center font-medium">{s.won}</td>
                      <td className="px-6 py-5 text-center font-medium">{s.drawn}</td>
                      <td className="px-6 py-5 text-center font-medium">{s.lost}</td>
                      <td className="px-6 py-5 text-center font-bold text-emerald-500">{s.gd > 0 ? `+${s.gd}` : s.gd}</td>
                      <td className="px-6 py-5 text-center">
                        <span className="bg-emerald-500 text-white px-3 py-1 rounded-lg font-black text-sm">{s.points}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
              <h2 className="text-2xl font-black tracking-tight mb-6">Register Team</h2>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const name = (e.currentTarget.elements.namedItem('team-name') as HTMLInputElement).value;
                try {
                  await addDoc(collection(db, `/tournaments/${tournament.id}/teams`), { name, tournamentId: tournament.id });
                  setShowAddTeam(false);
                } catch (err) { handleFirestoreError(err, OperationType.WRITE, `tournaments/${tournament.id}/teams`); }
              }} className="space-y-4">
                <input name="team-name" required className="w-full bg-slate-50 px-5 py-4 rounded-2xl border border-slate-200" placeholder="Team Name" />
                <button type="submit" className="w-full bg-emerald-500 text-white font-bold py-4 rounded-2xl">Confirm Registration</button>
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
              <h2 className="text-2xl font-black tracking-tight mb-6">Schedule Match</h2>
              <form onSubmit={async (e) => {
                e.preventDefault();
                const teamAId = (e.currentTarget.elements.namedItem('teamA') as HTMLSelectElement).value;
                const teamBId = (e.currentTarget.elements.namedItem('teamB') as HTMLSelectElement).value;
                if (teamAId === teamBId) return alert('Select different teams');
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
      </AnimatePresence>
    </motion.div>
  );
}

function MatchScoringView({ tournament, match, teams, onBack, isCreator }: { 
  tournament: Tournament, 
  match: Match, 
  teams: Team[], 
  onBack: () => void,
  isCreator: boolean 
}) {
  const [liveMatch, setLiveMatch] = useState<Match>(match);
  const teamA = teams.find(t => t.id === match.teamAId);
  const teamB = teams.find(t => t.id === match.teamBId);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, `tournaments/${tournament.id}/matches/${match.id}`), (s) => {
      if (s.exists()) setLiveMatch({ id: s.id, ...s.data() } as Match);
    });
    return unsub;
  }, [tournament.id, match.id]);

  const updateScore = async (side: 'A' | 'B', increment: number) => {
    if (!isCreator) return;
    try {
      const matchRef = doc(db, `tournaments/${tournament.id}/matches/${match.id}`);
      await setDoc(matchRef, {
        [side === 'A' ? 'scoreA' : 'scoreB']: Math.max(0, (side === 'A' ? liveMatch.scoreA : liveMatch.scoreB) + increment),
        status: 'live'
      }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `tournaments/${tournament.id}/matches/${match.id}`);
    }
  };

  const finishMatch = async () => {
    if (!isCreator) return;
    if (!confirm('Are you sure you want to end this match?')) return;
    try {
      await setDoc(doc(db, `tournaments/${tournament.id}/matches/${match.id}`), { status: 'finished' }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `tournaments/${tournament.id}/matches/${match.id}`);
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

      <div className="bg-slate-900 text-white rounded-[40px] p-8 md:p-16 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8">
          <div className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
            liveMatch.status === 'live' ? 'bg-red-500 animate-pulse' : 'bg-white/10 text-white/50'
          }`}>
            {liveMatch.status}
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-12 relative z-10">
          <div className="flex-1 text-center space-y-6">
            <div className="w-24 h-24 bg-white/5 rounded-full mx-auto flex items-center justify-center border border-white/10 mb-4">
              <Users className="w-10 h-10 text-white/20" />
            </div>
            <h2 className="text-2xl md:text-4xl font-black tracking-tighter uppercase">{teamA?.name}</h2>
            {isCreator && liveMatch.status !== 'finished' && (
              <div className="flex items-center justify-center gap-2">
                <button onClick={() => updateScore('A', -1)} className="w-10 h-10 rounded-full border border-white/20 hover:bg-white/10 flex items-center justify-center font-bold">-</button>
                <button onClick={() => updateScore('A', 1)} className="w-24 h-12 bg-emerald-500 rounded-full font-black text-sm hover:bg-emerald-600 transition-all">+ GOAL</button>
              </div>
            )}
          </div>

          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-6 md:gap-12">
              <span className="text-7xl md:text-9xl font-black tabular-nums">{liveMatch.scoreA}</span>
              <span className="text-2xl md:text-4xl font-black text-white/20">:</span>
              <span className="text-7xl md:text-9xl font-black tabular-nums">{liveMatch.scoreB}</span>
            </div>
          </div>

          <div className="flex-1 text-center space-y-6">
            <div className="w-24 h-24 bg-white/5 rounded-full mx-auto flex items-center justify-center border border-white/10 mb-4">
              <Users className="w-10 h-10 text-white/20" />
            </div>
            <h2 className="text-2xl md:text-4xl font-black tracking-tighter uppercase">{teamB?.name}</h2>
            {isCreator && liveMatch.status !== 'finished' && (
              <div className="flex items-center justify-center gap-2">
                <button onClick={() => updateScore('B', 1)} className="w-24 h-12 bg-emerald-500 rounded-full font-black text-sm hover:bg-emerald-600 transition-all">+ GOAL</button>
                <button onClick={() => updateScore('B', -1)} className="w-10 h-10 rounded-full border border-white/20 hover:bg-white/10 flex items-center justify-center font-bold">-</button>
              </div>
            )}
          </div>
        </div>

        {isCreator && liveMatch.status === 'live' && (
          <div className="mt-16 flex justify-center">
            <button 
              onClick={finishMatch}
              className="bg-red-500/10 text-red-500 border border-red-500/20 px-8 py-3 rounded-full font-black text-xs uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all"
            >
              Finish Match
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}


