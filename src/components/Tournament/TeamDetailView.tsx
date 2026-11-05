import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  updateDoc,
  deleteDoc,
  doc 
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
  Activity,
  Trophy,
  Calendar,
  TrendingUp,
  Award,
  Sparkles,
  Target,
  Check
} from 'lucide-react';
import { db, OperationType, handleFirestoreError } from '../../lib/firebase';
import { DEFAULT_AVATARS, renderTeamLogo, renderPlayerAvatar } from '../../utils/avatarUtils';
import { Tournament, Team, Player, Match, MatchEvent } from '../../types';
import { sortPlayersByPosition } from '../../utils/football';

interface TeamDetailViewProps {
  tournament: Tournament;
  team: Team;
  onBack: () => void;
  isCreator: boolean;
  onSelectPlayer?: (player: Player) => void;
  matches: Match[];
  events: MatchEvent[];
  teams: Team[];
  user: any;
  notify: (msg: string) => void;
  onSelectTeam?: (team: Team) => void;
}

export const TeamDetailView: React.FC<TeamDetailViewProps> = ({ 
  tournament, 
  team, 
  onBack, 
  isCreator,
  onSelectPlayer,
  matches,
  events,
  teams,
  user,
  notify,
  onSelectTeam
}) => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [selectedPlayerAvatarId, setSelectedPlayerAvatarId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'overview' | 'squad' | 'matches' | 'standings'>('overview');
  const isEfootball = tournament.category === 'efootball' || tournament.isEfootball;

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
        photoURL: selectedPlayerAvatarId,
        goals: 0,
        assists: 0,
        matchesPlayed: 0
      });
      setShowAddPlayer(false);
      notify(`${name} successfully registered to squad!`);
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
        position,
        photoURL: selectedPlayerAvatarId
      });
      setEditingPlayer(null);
      notify('Player settings saved!');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `players`);
    }
  };

  // Standings calculation for highlight
  const getPointsTable = () => {
    return teams.map(t => {
      const ms = matches.filter(m => m.status === 'finished' && (m.teamAId === t.id || m.teamBId === t.id));
      let w = 0, d = 0, l = 0, gf = 0, ga = 0;
      ms.forEach(m => {
        const isA = m.teamAId === t.id;
        const s = isA ? (m.scoreA || 0) : (m.scoreB || 0);
        const o = isA ? (m.scoreB || 0) : (m.scoreA || 0);
        gf += s; ga += o;
        if (s > o) w++; else if (s < o) l++; else d++;
      });
      return { ...t, played: ms.length, won: w, drawn: d, lost: l, gf, ga, gd: gf - ga, points: (w * 3) + d };
    }).sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf);
  };

  const standings = getPointsTable();
  const currentRank = standings.findIndex(t => t.id === team.id) + 1;
  const currentPoints = standings.find(t => t.id === team.id)?.points || 0;

  // Filter team specific matches
  const teamMatches = matches.filter(m => m.teamAId === team.id || m.teamBId === team.id);
  const completedMatches = teamMatches.filter(m => m.status === 'finished');
  const upcomingMatches = teamMatches.filter(m => m.status !== 'finished');

  // Compute stats for overview achievements
  const totalGoalsScored = completedMatches.reduce((acc, m) => {
    const isA = m.teamAId === team.id;
    return acc + (isA ? (m.scoreA || 0) : (m.scoreB || 0));
  }, 0);

  const teamWins = completedMatches.filter(m => {
    const isA = m.teamAId === team.id;
    return isA ? (m.scoreA || 0) > (m.scoreB || 0) : (m.scoreB || 0) > (m.scoreA || 0);
  }).length;

  const teamLosses = completedMatches.filter(m => {
    const isA = m.teamAId === team.id;
    return isA ? (m.scoreA || 0) < (m.scoreB || 0) : (m.scoreB || 0) < (m.scoreA || 0);
  }).length;

  const hasInvincibles = completedMatches.length >= 3 && teamLosses === 0;

  // Check top goalscorer
  const teamScorers = players.map(p => {
    const goals = events.filter(e => e.type === 'goal' && e.playerId === p.id && e.goalType !== 'own_goal' && !e.isPenaltyShootout).length;
    return { name: p.name, goals };
  }).sort((a, b) => b.goals - a.goals);
  const topGoalScorer = teamScorers[0]?.goals > 0 ? teamScorers[0] : null;

  // Classify players for the tactical lineup grid
  const gks = players.filter(p => p.position === 'GK');
  const defs = players.filter(p => p.position === 'DEF');
  const mids = players.filter(p => p.position === 'MID');
  const fwds = players.filter(p => p.position === 'FWD');

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pb-20">
      
      {/* Back Header navigation */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-slate-400 font-extrabold hover:text-slate-900 dark:hover:text-white transition-colors uppercase tracking-widest text-[9px]">
          &larr; Back to Tournament
        </button>
        {isCreator && (
          <button 
            type="button"
            onClick={() => { setSelectedPlayerAvatarId(''); setShowAddPlayer(true); }}
            className="bg-slate-900 text-white px-6 py-3 rounded-full text-xs font-bold shadow-lg hover:bg-emerald-500 hover:text-slate-950 transition-all flex items-center gap-2 active:scale-95 border border-slate-800"
          >
            <Plus className="w-4 h-4" /> Add Squad Player
          </button>
        )}
      </div>

      {/* Team Header Bio Card */}
      <div className="bg-slate-900 rounded-[40px] p-8 md:p-10 text-white relative overflow-hidden shadow-xl border border-slate-800">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row items-center gap-6 md:gap-10 relative z-10">
          <div className="w-28 h-28 md:w-36 md:h-36 flex items-center justify-center shrink-0">
             {renderTeamLogo(team.logoURL, team.name, "w-28 h-28 md:w-36 md:h-36")}
          </div>
          <div className="flex-1 text-center md:text-left space-y-3.5">
            <div className="flex items-center justify-center md:justify-start gap-3">
               <h1 className="text-3xl md:text-5xl font-black uppercase italic tracking-tight">{team.name}</h1>
               {team.captainId && <Star className="w-5 h-5 text-amber-500 fill-amber-500" />}
            </div>
            
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 text-xs">
              <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-xl">
                <Users className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-bold text-slate-300">{players.length} Athletic Roster</span>
              </div>
              {team.group && (
                <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-xl">
                  <Shield className="w-3.5 h-3.5 text-blue-400" />
                  <span className="font-bold text-slate-300">{team.group}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-xl">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-bold text-slate-300">PTS: {currentPoints} • Rank #{currentRank}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 overflow-x-auto pb-px scrollbar-thin">
        {[
          { id: 'overview', label: 'Overview', icon: Target },
          { id: 'squad', label: 'Squad', icon: Users },
          { id: 'matches', label: 'Matches', icon: Calendar },
          { id: 'standings', label: 'Standings', icon: TrendingUp },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-5 py-3 border-b-2 font-black uppercase text-[10px] tracking-wider transition-all shrink-0 ${
                isActive 
                  ? 'border-emerald-500 text-slate-900 dark:text-emerald-400 bg-emerald-50/10 dark:bg-emerald-950/25' 
                  : 'border-transparent text-slate-400 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/40'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-500' : 'text-slate-400'}`} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div className="min-h-[400px]">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left side: Football Pitch Lineup */}
            <div className="lg:col-span-8 space-y-5">
              <div className="bg-white dark:bg-slate-900 p-5 rounded-[32px] border border-slate-100 dark:border-slate-800/80 shadow-sm">
                <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100 dark:border-slate-800/60">
                  <div>
                    <h3 className="font-black uppercase tracking-tight text-slate-900 dark:text-white text-sm">Lineup Pitch</h3>
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Probable squad arrangement</p>
                  </div>
                  <span className="text-[8px] font-black uppercase tracking-widest bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-full">
                    Interactable Matchday Pitch
                  </span>
                </div>

                {players.length === 0 ? (
                  <div className="py-24 text-center bg-slate-50 dark:bg-slate-955/30 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                     <Users className="w-12 h-12 text-slate-200 dark:text-slate-700 mx-auto mb-4" />
                     <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                       {isEfootball ? '🎮 eFootball Mode (Direct goals only · No squad rosters required)' : 'No squad members assigned to map'}
                     </p>
                  </div>
                ) : (
                  /* The visual field */
                  <div className="relative w-full aspect-[4/3] rounded-2xl bg-gradient-to-b from-emerald-800 to-emerald-950 dark:from-slate-900 dark:to-slate-950 border-4 border-emerald-900 dark:border-slate-800 field-dark shadow-inner overflow-hidden p-3 flex flex-col justify-between">
                    {/* Pitch markings */}
                    <div className="absolute inset-x-0 top-0 h-1/2 border-b-2 border-white/10" />
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-28 h-28 border-2 border-white/10 rounded-full" />
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-white/20 rounded-full" />
                    {/* Penalty area top */}
                    <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-48 h-12 border-b-2 border-x-2 border-white/10" />
                    {/* Penalty area bottom */}
                    <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-48 h-12 border-t-2 border-x-2 border-white/10" />

                    {/* FWD line */}
                    <div className="flex justify-around items-center w-full min-h-[4rem] relative z-10 pt-2">
                      {fwds.length > 0 ? (
                        fwds.map(p => (
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            key={p.id}
                            onClick={() => onSelectPlayer?.(p)}
                            className="flex flex-col items-center gap-1 focus:outline-none"
                          >
                            <div className="w-9 h-9 md:w-11 md:h-11 rounded-full bg-rose-500 text-white font-black text-xs border-2 border-white shadow-lg flex items-center justify-center">
                              #{p.number}
                            </div>
                            <span className="bg-slate-900/90 text-white font-bold text-[8px] uppercase tracking-wider px-2 py-0.5 rounded shadow text-center truncate max-w-[70px]">
                              {p.name.split(' ').pop()}
                            </span>
                          </motion.button>
                        ))
                      ) : (
                        <div className="text-[7.5px] font-bold text-white/40 uppercase tracking-widest bg-white/5 px-3 py-1 rounded-full border border-white/5">FWD Position Open</div>
                      )}
                    </div>

                    {/* MID line */}
                    <div className="flex justify-around items-center w-full min-h-[4rem] relative z-10">
                      {mids.length > 0 ? (
                        mids.map(p => (
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            key={p.id}
                            onClick={() => onSelectPlayer?.(p)}
                            className="flex flex-col items-center gap-1 focus:outline-none"
                          >
                            <div className="w-9 h-9 md:w-11 md:h-11 rounded-full bg-amber-500 text-white font-black text-xs border-2 border-white shadow-lg flex items-center justify-center">
                              #{p.number}
                            </div>
                            <span className="bg-slate-900/90 text-white font-bold text-[8px] uppercase tracking-wider px-2 py-0.5 rounded shadow text-center truncate max-w-[70px]">
                              {p.name.split(' ').pop()}
                            </span>
                          </motion.button>
                        ))
                      ) : (
                        <div className="text-[7.5px] font-bold text-white/40 uppercase tracking-widest bg-white/5 px-3 py-1 rounded-full border border-white/5">MID Position Open</div>
                      )}
                    </div>

                    {/* DEF line */}
                    <div className="flex justify-around items-center w-full min-h-[4rem] relative z-10">
                      {defs.length > 0 ? (
                        defs.map(p => (
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            key={p.id}
                            onClick={() => onSelectPlayer?.(p)}
                            className="flex flex-col items-center gap-1 focus:outline-none"
                          >
                            <div className="w-9 h-9 md:w-11 md:h-11 rounded-full bg-blue-500 text-white font-black text-xs border-2 border-white shadow-lg flex items-center justify-center">
                              #{p.number}
                            </div>
                            <span className="bg-slate-900/90 text-white font-bold text-[8px] uppercase tracking-wider px-2 py-0.5 rounded shadow text-center truncate max-w-[70px]">
                              {p.name.split(' ').pop()}
                            </span>
                          </motion.button>
                        ))
                      ) : (
                        <div className="text-[7.5px] font-bold text-white/40 uppercase tracking-widest bg-white/5 px-3 py-1 rounded-full border border-white/5">DEF Position Open</div>
                      )}
                    </div>

                    {/* GK line */}
                    <div className="flex justify-center items-center w-full min-h-[3rem] relative z-10 pb-2">
                      {gks.length > 0 ? (
                        gks.slice(0, 1).map(p => (
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            key={p.id}
                            onClick={() => onSelectPlayer?.(p)}
                            className="flex flex-col items-center gap-1 focus:outline-none"
                          >
                            <div className="w-9 h-9 md:w-11 md:h-11 rounded-full bg-indigo-500 text-white font-black text-xs border-2 border-white shadow-lg flex items-center justify-center">
                              #{p.number}
                            </div>
                            <span className="bg-slate-900/90 text-white font-bold text-[8px] uppercase tracking-wider px-2 py-0.5 rounded shadow text-center truncate max-w-[70px]">
                              {p.name.split(' ').pop()} (GK)
                            </span>
                          </motion.button>
                        ))
                      ) : (
                        <div className="text-[7.5px] font-bold text-white/40 uppercase tracking-widest bg-white/5 px-3 py-1 rounded-full border border-white/5">GK Position Open</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right side: Achievements & Quick Stats Column */}
            <div className="lg:col-span-4 space-y-6">
              {/* Trophies & Awards section */}
              <div className="bg-white dark:bg-slate-900 p-5 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
                <div>
                  <h3 className="font-black uppercase tracking-tight text-slate-900 dark:text-white text-sm">Achievements Cabinet</h3>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500">Team historic & active awards</p>
                </div>

                <div className="space-y-3.5">
                  {/* Dynamic Champions Recognition */}
                  {tournament.status === 'finished' && currentRank === 1 ? (
                    <div className="flex items-start gap-3 p-3.5 bg-amber-50 dark:bg-amber-950/20 rounded-2xl border border-amber-200 dark:border-amber-800/40">
                      <Trophy className="w-8 h-8 text-amber-500 fill-amber-500/15 shrink-0 mt-0.5 animate-bounce" />
                      <div>
                        <h4 className="font-extrabold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-tight">Tournament Champion</h4>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Grand champions of {tournament.name}! Undefeated tournament finish.</p>
                      </div>
                    </div>
                  ) : null}

                  {/* Dynamic Runners up recognition */}
                  {tournament.status === 'finished' && currentRank === 2 ? (
                    <div className="flex items-start gap-3 p-3.5 bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-slate-200 dark:border-slate-800">
                      <Award className="w-8 h-8 text-slate-400 fill-slate-300 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-extrabold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-tight">Silver Medalist</h4>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Fought fiercely throughout the championship and finalized in 2nd place.</p>
                      </div>
                    </div>
                  ) : null}

                  {/* Invincibles Award */}
                  {hasInvincibles ? (
                    <div className="flex items-start gap-3 p-3.5 bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-200 dark:border-emerald-800/40">
                      <Zap className="w-8 h-8 text-emerald-500 fill-emerald-500/10 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-extrabold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-tight">The Invincibles</h4>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Completed {completedMatches.length} matches in this campaign without letting in a single defeat!</p>
                      </div>
                    </div>
                  ) : null}

                  {/* Top goalscorer club */}
                  {topGoalScorer ? (
                    <div className="flex items-start gap-3 p-3.5 bg-indigo-50 dark:bg-indigo-950/20 rounded-2xl border border-indigo-200 dark:border-indigo-800/40">
                      <Sparkles className="w-8 h-8 text-indigo-500 fill-indigo-500/10 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-extrabold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-tight">Club Golden Striker</h4>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Lead by <strong className="text-slate-800 dark:text-slate-100">{topGoalScorer.name}</strong> with {topGoalScorer.goals} tournament goals.</p>
                      </div>
                    </div>
                  ) : null}

                  {/* Standard club registration award */}
                  <div className="flex items-start gap-3 p-3.5 bg-slate-50/50 dark:bg-slate-950/20 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <Shield className="w-8 h-8 text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-extrabold text-slate-800 dark:text-slate-200 text-[11px] uppercase tracking-tight">Affiliated Squad</h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Registered and actively competing in the {tournament.name} football division.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* General Statistical Summary */}
              <div className="bg-white dark:bg-slate-900 p-5 rounded-[32px] border border-slate-105 dark:border-slate-800 shadow-sm space-y-3.5">
                <h3 className="font-black uppercase tracking-tight text-slate-900 dark:text-white text-sm">Campaign Stats</h3>
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-2xl text-center">
                    <span className="block text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Goals Scored</span>
                    <span className="text-xl font-black text-slate-900 dark:text-white">{totalGoalsScored}</span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-2xl text-center">
                    <span className="block text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Total Wins</span>
                    <span className="text-xl font-black text-emerald-500">{teamWins}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'squad' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortPlayersByPosition(players).map(p => (
                <div 
                  key={p.id} 
                  onClick={() => onSelectPlayer?.(p)}
                  className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 flex items-center justify-between group hover:border-emerald-500 hover:shadow-lg transition-all shadow-sm cursor-pointer"
                >
                   <div className="flex items-center gap-4">
                      {/* Separate custom or default profile avatar from metadata details */}
                      <div className="relative shrink-0 select-none">
                        {renderPlayerAvatar(p.photoURL, p.name, "w-11 h-11 rounded-xl")}
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 text-white rounded-full flex items-center justify-center text-[9px] font-black tracking-tighter border border-white group-hover:bg-slate-900 group-hover:scale-105 transition-all">
                          {p.number || '#'}
                        </div>
                      </div>
                      <div>
                         <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">{p.name}</h4>
                         <span className="text-[10px] font-bold text-slate-300 dark:text-slate-500 uppercase tracking-widest">{p.position || 'Player'}</span>
                      </div>
                   </div>
                   {isCreator && (
                     <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setSelectedPlayerAvatarId(p.photoURL || ''); setEditingPlayer(p); }}
                          className="p-2 text-slate-300 dark:text-slate-600 hover:text-slate-900 dark:hover:text-white transition-colors"
                        >
                          <Settings className="w-4 h-4" />
                        </button>
                        <button 
                          type="button"
                          onClick={async (e) => {
                             e.stopPropagation();
                             if (window.confirm(`Delete ${p.name}?`)) {
                                try {
                                  await deleteDoc(doc(db, `tournaments/${tournament.id}/teams/${team.id}/players/${p.id}`));
                                  notify(`Player ${p.name} removed from roster`);
                                } catch (err) {
                                  handleFirestoreError(err, OperationType.WRITE, `players/${p.id}`);
                                }
                             }
                          }} 
                          className="p-2 text-slate-300 dark:text-slate-600 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                     </div>
                   )}
                </div>
              ))}
            </div>
            {players.length === 0 && (
              <div className="py-20 text-center bg-white dark:bg-slate-900 rounded-[32px] border border-slate-150 dark:border-slate-800">
                <Users className="w-12 h-12 text-slate-100 dark:text-slate-700 mx-auto mb-4" />
                <p className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest text-[10px]">
                  {isEfootball ? '🎮 eFootball Tournament: Matches use direct team scoring without player rosters' : 'No active players added yet'}
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'matches' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Upcoming fixtures panel */}
            <div className="space-y-4">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-2">
                <h3 className="font-black uppercase tracking-tight text-slate-900 dark:text-white text-sm flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-500" /> Upcoming Matches ({upcomingMatches.length})
                </h3>
              </div>
              
              {upcomingMatches.length > 0 ? (
                <div className="space-y-3">
                  {upcomingMatches.map(m => {
                    const tA = teams.find(t => t.id === m.teamAId);
                    const tB = teams.find(t => t.id === m.teamBId);
                    const isF = m.status === 'finished';
                    const winA = isF && (m.scoreA > m.scoreB || (m.scoreA === m.scoreB && (m.pensA || 0) > (m.pensB || 0)));
                    const winB = isF && (m.scoreB > m.scoreA || (m.scoreA === m.scoreB && (m.pensB || 0) > (m.pensA || 0)));
                    const isBye = m.placeholderA === 'BYE' || m.placeholderB === 'BYE';
                    return (
                      <div key={m.id} className="bg-white dark:bg-slate-900 px-4 py-3 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center group hover:border-emerald-400 hover:shadow-sm transition-all shadow-sm">
                        <div className="w-12 text-center border-r border-slate-100 dark:border-slate-800 pr-2 mr-2 flex flex-col items-center justify-center shrink-0">
                          <span className="text-[8px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-tight">
                            MD {m.round || '1'}
                          </span>
                          <span className={`text-[9px] font-black uppercase ${m.status === 'live' ? 'text-emerald-500 animate-pulse' : 'text-slate-300 dark:text-slate-650'}`}>
                            {isBye ? 'BYE' : (m.status === 'live' ? 'Live' : 'VS')}
                          </span>
                          {m.status === 'scheduled' && m.kickoff && !isBye && (
                            <span className="text-[7px] font-bold text-slate-400 dark:text-slate-500 mt-0.5 scale-90">
                              {m.kickoff.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>

                        <div className="flex-1 grid grid-cols-[1fr_auto_1fr] items-center gap-2 min-w-0">
                          {/* Team A */}
                          {/* Team A */}
                          <div className="flex items-center justify-end gap-1.5 min-w-0">
                            <span 
                              onClick={(e) => {
                                if (tA && onSelectTeam) {
                                  e.stopPropagation();
                                  onSelectTeam(tA);
                                }
                              }}
                              className={`font-bold truncate text-[11px] md:text-xs text-right leading-tight text-slate-700 dark:text-slate-200 ${tA && onSelectTeam ? 'hover:text-emerald-500 hover:underline cursor-pointer' : ''}`}
                            >
                              {tA?.name || m.placeholderA || 'TBD'}
                            </span>
                            {renderTeamLogo(tA?.logoURL, tA?.name || m.placeholderA || '', "w-5 h-5 md:w-6 md:h-6 hover:scale-105 transition-transform")}
                          </div>

                          {/* Score Box */}
                          <div className={`px-2 py-1 bg-slate-50 dark:bg-slate-950/70 rounded-lg border border-slate-100 dark:border-slate-800 flex items-center justify-center gap-1.5 ${isBye ? 'min-w-[70px]' : 'min-w-[45px] md:min-w-[55px]'}`}>
                            {isBye ? (
                              <span className="text-[8px] font-black text-amber-500 uppercase tracking-tight">BYE</span>
                            ) : (
                              <span className="text-[9px] font-bold text-slate-300 dark:text-slate-500">VS</span>
                            )}
                          </div>

                          {/* Team B */}
                          <div className="flex items-center justify-start gap-1.5 min-w-0">
                            {renderTeamLogo(tB?.logoURL, tB?.name || m.placeholderB || '', "w-5 h-5 md:w-6 md:h-6 hover:scale-105 transition-transform")}
                            <span 
                              onClick={(e) => {
                                if (tB && onSelectTeam) {
                                  e.stopPropagation();
                                  onSelectTeam(tB);
                                }
                              }}
                              className={`font-bold truncate text-[11px] md:text-xs text-left leading-tight text-slate-700 dark:text-slate-200 ${tB && onSelectTeam ? 'hover:text-emerald-500 hover:underline cursor-pointer' : ''}`}
                            >
                              {tB?.name || m.placeholderB || 'TBD'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-12 bg-slate-50/50 dark:bg-slate-950/20 text-center rounded-[32px] border border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] text-slate-400 dark:text-slate-505 font-extrabold uppercase tracking-wider">No remaining fixtures scheduled</p>
                </div>
              )}
            </div>

            {/* Completed matches panel */}
            <div className="space-y-4">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-2">
                <h3 className="font-black uppercase tracking-tight text-slate-900 dark:text-white text-sm flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-yellow-500" /> Completed Matches ({completedMatches.length})
                </h3>
              </div>
              
              {completedMatches.length > 0 ? (
                <div className="space-y-3">
                  {completedMatches.map(m => {
                    const tA = teams.find(t => t.id === m.teamAId);
                    const tB = teams.find(t => t.id === m.teamBId);
                    const isF = m.status === 'finished';
                    const winA = isF && (m.scoreA > m.scoreB || (m.scoreA === m.scoreB && (m.pensA || 0) > (m.pensB || 0)));
                    const winB = isF && (m.scoreB > m.scoreA || (m.scoreA === m.scoreB && (m.pensB || 0) > (m.pensA || 0)));
                    const isBye = m.placeholderA === 'BYE' || m.placeholderB === 'BYE';

                    return (
                      <div key={m.id} className="bg-white dark:bg-slate-900 px-4 py-3 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center group hover:border-emerald-400 hover:shadow-sm transition-all shadow-sm">
                        <div className="w-12 text-center border-r border-slate-100 dark:border-slate-800 pr-2 mr-2 flex flex-col items-center justify-center shrink-0">
                          <span className="text-[8px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-tight">
                            MD {m.round || '1'}
                          </span>
                          <span className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500">
                            FT
                          </span>
                        </div>

                        <div className="flex-1 grid grid-cols-[1fr_auto_1fr] items-center gap-2 min-w-0">
                          {/* Team A */}
                          <div className="flex items-center justify-end gap-1.5 min-w-0">
                            <span 
                              onClick={(e) => {
                                if (tA && onSelectTeam) {
                                  e.stopPropagation();
                                  onSelectTeam(tA);
                                }
                              }}
                              className={`font-bold truncate text-[11px] md:text-xs text-right leading-tight ${winA ? 'text-emerald-500 font-extrabold' : 'text-slate-700 dark:text-slate-200'} ${tA && onSelectTeam ? 'hover:text-emerald-500 hover:underline cursor-pointer' : ''}`}
                            >
                              {tA?.name || m.placeholderA || 'TBD'}
                            </span>
                            {renderTeamLogo(tA?.logoURL, tA?.name || m.placeholderA || '', "w-5 h-5 md:w-6 md:h-6 hover:scale-105 transition-transform")}
                          </div>

                          {/* Score Box */}
                          <div className={`px-2 py-1 bg-slate-50 dark:bg-slate-950/70 rounded-lg border border-slate-100 dark:border-slate-800 flex items-center justify-center gap-1.5 ${isBye ? 'min-w-[70px]' : 'min-w-[45px] md:min-w-[55px]'}`}>
                            {isBye ? (
                              <span className="text-[8px] font-black text-amber-500 uppercase tracking-tight">BYE</span>
                            ) : (
                              <>
                                 <span className={`font-black text-xs md:text-sm ${winA ? 'text-emerald-500' : 'text-slate-700 dark:text-slate-200'}`}>{m.scoreA}</span>
                                 <span className="text-slate-300 dark:text-slate-650 font-medium text-xs">-</span>
                                 <span className={`font-black text-xs md:text-sm ${winB ? 'text-emerald-500' : 'text-slate-700 dark:text-slate-200'}`}>{m.scoreB}</span>
                              </>
                            )}
                          </div>

                          {/* Team B */}
                          <div className="flex items-center justify-start gap-1.5 min-w-0">
                            {renderTeamLogo(tB?.logoURL, tB?.name || m.placeholderB || '', "w-5 h-5 md:w-6 md:h-6 hover:scale-105 transition-transform")}
                            <span 
                              onClick={(e) => {
                                if (tB && onSelectTeam) {
                                  e.stopPropagation();
                                  onSelectTeam(tB);
                                }
                              }}
                              className={`font-bold truncate text-[11px] md:text-xs text-left leading-tight ${winB ? 'text-emerald-500 font-extrabold' : 'text-slate-700 dark:text-slate-200'} ${tB && onSelectTeam ? 'hover:text-emerald-500 hover:underline cursor-pointer' : ''}`}
                            >
                              {tB?.name || m.placeholderB || 'TBD'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-12 bg-slate-50/50 dark:bg-slate-950/20 text-center rounded-[32px] border border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] text-slate-400 dark:text-slate-505 font-extrabold uppercase tracking-wider">No tournament matches played yet</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'standings' && (
          <div className="bg-white dark:bg-slate-900 p-5 rounded-[32px] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="flex justify-between items-center mb-5 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-black uppercase tracking-tight text-slate-900 dark:text-white text-sm">Standings Tracker</h3>
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Live tournament updates</p>
              </div>
              <span className="text-[9px] font-extrabold tracking-widest text-[#001] dark:text-slate-200 bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 px-3 py-1 rounded-lg">
                Group Division
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[500px]">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    <th className="py-3 px-4 text-center">Pos</th>
                    <th className="py-3 px-4">Club name</th>
                    <th className="py-3 px-4 text-center">MP</th>
                    <th className="py-3 px-4 text-center">W</th>
                    <th className="py-3 px-4 text-center">D</th>
                    <th className="py-3 px-4 text-center">L</th>
                    <th className="py-3 px-4 text-center">GD</th>
                    <th className="py-3 px-4 text-center">PTS</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((t, idx) => {
                    const isSelf = t.id === team.id;
                    const advancingCount = tournament.advancingPerGroup ?? (tournament.type === 'league_playoff' ? 2 : 0);
                    const isQualifying = advancingCount > 0 && idx < advancingCount;
                    const isTop6Mode = advancingCount === 6;
                    const isQualifierMode = tournament.advancementType === 'qualifier' && advancingCount === 3;
                    
                    const qualifyBorder = isQualifying 
                      ? (isTop6Mode && idx < 2 ? 'border-l-2 border-l-blue-500 bg-blue-500/[0.03]' : 'border-l-2 border-l-emerald-500 bg-emerald-500/[0.03]') 
                      : '';

                    return (
                      <tr 
                        key={t.id} 
                        onClick={() => {
                          if (!isSelf && onSelectTeam) {
                            onSelectTeam(t);
                          }
                        }}
                        className={`border-b border-slate-50 dark:border-slate-800/50 text-xs transition-colors ${
                          isSelf 
                            ? 'bg-emerald-500/10 hover:bg-emerald-500/15 font-bold border-l-2 border-l-emerald-500' 
                            : isQualifying 
                              ? `${qualifyBorder} hover:opacity-90 cursor-pointer`
                              : 'hover:bg-slate-50/45 dark:hover:bg-slate-950/40 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer'
                        }`}
                      >
                        <td className="py-3.5 px-4 text-center font-black">
                          {idx === 0 ? <span className="text-amber-500">🏆</span> : idx + 1}
                        </td>
                        <td className="py-3.5 px-4 font-black text-slate-800 dark:text-slate-200 uppercase italic">
                          <span className="flex items-center gap-1.5 flex-wrap">
                            {t.name}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center font-semibold text-slate-700 dark:text-slate-300">{t.played}</td>
                        <td className="py-3.5 px-4 text-center text-emerald-600 dark:text-emerald-400">{t.won}</td>
                        <td className="py-3.5 px-4 text-center text-slate-500 dark:text-slate-400">{t.drawn}</td>
                        <td className="py-3.5 px-4 text-center text-rose-500">{t.lost}</td>
                        <td className={`py-3.5 px-4 text-center font-mono ${t.gd > 0 ? 'text-emerald-500' : 'text-slate-500 dark:text-slate-400'}`}>
                          {t.gd > 0 ? `+${t.gd}` : t.gd}
                        </td>
                        <td className="py-3.5 px-4 text-center font-black text-slate-900 dark:text-white">{t.points}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {(showAddPlayer || editingPlayer) && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setShowAddPlayer(false); setEditingPlayer(null); }} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 w-full max-w-md rounded-[32px] p-8 shadow-2xl">
              <button type="button" onClick={() => { setShowAddPlayer(false); setEditingPlayer(null); }} className="absolute right-6 top-6 p-2 text-slate-300 hover:text-slate-600 dark:hover:text-white transition-colors"><X className="w-5 h-5" /></button>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight mb-6">{editingPlayer ? 'Edit Player' : 'Join Squad'}</h2>
              <form onSubmit={editingPlayer ? updatePlayer : addPlayer} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Full Name</label>
                  <input name="player-name" required defaultValue={editingPlayer?.name} className="w-full bg-slate-50 dark:bg-slate-950 px-5 py-4 rounded-2xl border border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-slate-900 dark:text-white" placeholder="e.g. Cristiano Ronaldo" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Squad Number</label>
                      <input name="player-number" type="number" required defaultValue={editingPlayer?.number} className="w-full bg-slate-50 dark:bg-slate-950 px-5 py-4 rounded-2xl border border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-slate-900 dark:text-white" placeholder="7" />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Position</label>
                      <select name="player-position" required defaultValue={editingPlayer?.position || 'FWD'} className="w-full bg-slate-50 dark:bg-slate-950 px-5 py-4 rounded-2xl border border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-slate-900 dark:text-white">
                         <option value="GK">Goalkeeper (GK)</option>
                         <option value="DEF">Defender (DEF)</option>
                         <option value="MID">Midfielder (MID)</option>
                         <option value="FWD">Forward (FWD)</option>
                         <option value="SUB">Substitute (SUB)</option>
                      </select>
                   </div>
                </div>

                {/* Predefined Player Avatar Selection */}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-50block mb-1">Select Profile Avatar</label>
                  <div className="grid grid-cols-4 gap-2 p-2 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl max-h-[140px] overflow-y-auto">
                    {DEFAULT_AVATARS.map(avatar => {
                      const Icon = avatar.icon;
                      const isSelected = selectedPlayerAvatarId === avatar.id;
                      return (
                        <button
                          key={avatar.id}
                          type="button"
                          onClick={() => setSelectedPlayerAvatarId(avatar.id)}
                          className={`group h-11 rounded-xl flex items-center justify-center bg-gradient-to-br ${avatar.gradientClass} relative ${isSelected ? 'ring-4 ring-emerald-500 scale-95 shadow-md' : 'opacity-80 hover:opacity-100'} transition-all`}
                          title={avatar.name}
                        >
                          <Icon className={`w-5 h-5 ${avatar.textClass}`} />
                          {isSelected && (
                            <span className="absolute -top-1 -right-1 bg-emerald-500 text-white rounded-full p-0.5 shadow-sm">
                              <Check className="w-2 h-2" />
                            </span>
                          )}
                        </button>
                      );
                    })}
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
