import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Edit2, Check, User, Shield, Star, Footprints, Trophy, Trash2 } from 'lucide-react';
import { Player, Tournament, Team, Match, MatchEvent } from '../../types';
import { DEFAULT_AVATARS, renderPlayerAvatar } from '../../utils/avatarUtils';
import { db, OperationType, handleFirestoreError } from '../../lib/firebase';
import { doc, updateDoc, collectionGroup, query, where, getDocs, getDoc } from 'firebase/firestore';

interface PlayerProfileModalProps {
  player: Player;
  tournament: Tournament;
  teams: Team[];
  matches: Match[];
  events: MatchEvent[];
  user: any; // Firebase user | null
  onClose: () => void;
  notify: (msg: string) => void;
}

export const PlayerProfileModal: React.FC<PlayerProfileModalProps> = ({
  player,
  tournament,
  teams,
  matches,
  events,
  user,
  onClose,
  notify,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(player.name || '');
  const [number, setNumber] = useState(player.number || 10);
  const [position, setPosition] = useState(player.position || 'MID');
  const [photoURL, setPhotoURL] = useState(player.photoURL || '');
  const [bio, setBio] = useState(player.bio || '');
  const [preferredFoot, setPreferredFoot] = useState<'Left' | 'Right' | 'Both'>(player.preferredFoot || 'Right');
  const [age, setAge] = useState(player.age ?? 22);
  const [saves, setSaves] = useState(player.saves ?? 0);

  const [associationTournaments, setAssociationTournaments] = useState<{
    tournament: Tournament;
    teamName: string;
    position: string;
    number: number;
    isCurrent: boolean;
  }[]>([]);
  const [loadingTournaments, setLoadingTournaments] = useState(false);

  useEffect(() => {
    const fetchAssociatedTournaments = async () => {
      setLoadingTournaments(true);
      try {
        let q;
        if (player.userId) {
          q = query(collectionGroup(db, 'players'), where('userId', '==', player.userId));
        } else {
          q = query(collectionGroup(db, 'players'), where('name', '==', player.name));
        }

        const querySnapshot = await getDocs(q);
        const resultsMap: Record<string, { teamId: string; position: string; number: number }> = {};

        querySnapshot.forEach(docSnap => {
          const pathParts = docSnap.ref.path.split('/');
          if (pathParts.length >= 6 && pathParts[0] === 'tournaments') {
            const tId = pathParts[1];
            const pData = docSnap.data() as Player;
            resultsMap[tId] = {
              teamId: pathParts[3],
              position: pData.position || 'MID',
              number: pData.number || 10,
            };
          }
        });

        const list: typeof associationTournaments = [];
        const tIds = Object.keys(resultsMap);

        await Promise.all(
          tIds.map(async tId => {
            try {
              const tDocRef = doc(db, 'tournaments', tId);
              const tDocSnap = await getDoc(tDocRef);
              if (!tDocSnap.exists()) return;
              const tData = { id: tDocSnap.id, ...tDocSnap.data() } as Tournament;

              let tName = 'Free Agent';
              const teamInfo = resultsMap[tId];
              if (teamInfo.teamId) {
                const teamDocRef = doc(db, `tournaments/${tId}/teams`, teamInfo.teamId);
                const teamDocSnap = await getDoc(teamDocRef);
                if (teamDocSnap.exists()) {
                  tName = teamDocSnap.data().name || 'Free Agent';
                }
              }

              list.push({
                tournament: tData,
                teamName: tName,
                position: teamInfo.position,
                number: teamInfo.number,
                isCurrent: tId === tournament.id,
              });
            } catch (err) {
              console.error('Error fetching associated tournament info:', err);
            }
          })
        );

        list.sort((a, b) => {
          if (a.isCurrent) return -1;
          if (b.isCurrent) return 1;
          const statusOrder: Record<string, number> = { live: 0, upcoming: 1, scheduled: 1, completed: 2, finished: 2 };
          const orderA = statusOrder[a.tournament.status] ?? 3;
          const orderB = statusOrder[b.tournament.status] ?? 3;
          if (orderA !== orderB) return orderA - orderB;
          return a.tournament.name.localeCompare(b.tournament.name);
        });

        setAssociationTournaments(list);
      } catch (err) {
        console.error('Error fetching associated tournaments:', err);
      } finally {
        setLoadingTournaments(false);
      }
    };

    fetchAssociatedTournaments();
  }, [player.id, player.userId, player.name, tournament.id]);

  const team = teams.find(t => t.id === player.teamId);

  // Check editing privileges
  const isSelf = user && player.userId === user.uid;
  const isTournamentCreator = user && tournament.creatorId === user.uid;
  const isTeamCreator = user && team && (team.creatorId === user.uid || team.captainId === user.uid);
  const canEdit = isSelf || isTournamentCreator || isTeamCreator;

  // Calculate dynamic stats from actual events
  const totalGoals = events.filter(
    e => e.type === 'goal' && e.playerId === player.id && e.goalType !== 'own_goal' && !e.isPenaltyShootout
  ).length;

  const totalAssists = events.filter(
    e => e.type === 'goal' && e.assistantId === player.id && !e.isPenaltyShootout
  ).length;

  const yellowCards = events.filter(
    e => e.type === 'yellow_card' && e.playerId === player.id
  ).length;

  const directReds = events.filter(
    e => e.type === 'red_card' && e.playerId === player.id
  ).length;

  // Calculate indirect reds: matches with 2 yellows
  const yellowsByMatch: Record<string, number> = {};
  events.filter(e => e.type === 'yellow_card' && e.playerId === player.id).forEach(e => {
    yellowsByMatch[e.matchId] = (yellowsByMatch[e.matchId] || 0) + 1;
  });
  const indirectReds = Object.values(yellowsByMatch).filter(count => count >= 2).length;
  const totalRedCards = directReds + indirectReds;

  const totalMVPs = matches.filter(m => m.manOfTheMatchId === player.id).length;

  // Deduce matches played based on matches of this tournament where player is in lineup or subs or has logged events
  const playedMatches = matches.filter(m => {
    if (m.status !== 'finished' && m.status !== 'live') return false;
    const isTeamA = m.teamAId === player.teamId;
    const isTeamB = m.teamBId === player.teamId;
    if (!isTeamA && !isTeamB) return false;

    // Check if lineup lists exist and contain this player
    if (isTeamA && m.lineupA?.includes(player.id)) return true;
    if (isTeamB && m.lineupB?.includes(player.id)) return true;
    if (isTeamA && m.subsA?.includes(player.id)) return true;
    if (isTeamB && m.subsB?.includes(player.id)) return true;

    // Fallback: did they record any event in this match?
    const hasEvent = events.some(e => e.matchId === m.id && (e.playerId === player.id || e.assistantId === player.id));
    if (hasEvent) return true;

    // Default return false if lineages exist but player isn't in them.
    const teamHasSheets = (isTeamA && m.lineupA && m.lineupA.length > 0) || (isTeamB && m.lineupB && m.lineupB.length > 0);
    return !teamHasSheets;
  }).length;

  const matchesPlayedDisplay = player.matchesPlayed !== undefined && player.matchesPlayed > playedMatches 
    ? player.matchesPlayed 
    : playedMatches;

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;

    try {
      const playerRef = doc(db, `tournaments/${tournament.id}/teams/${player.teamId}/players/${player.id}`);
      await updateDoc(playerRef, {
        name,
        number: Number(number),
        position,
        photoURL,
        bio,
        preferredFoot,
        age: Number(age),
        saves: position === 'GK' ? Number(saves) : 0,
      });

      setIsEditing(false);
      notify('Player Profile updated successfully!');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `players/${player.id}`);
    }
  };

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"
      />
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="relative bg-white w-full max-w-4xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[92vh]"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-6 top-6 z-[650] p-2 bg-slate-100/80 hover:bg-slate-200 rounded-full text-slate-500 hover:text-slate-800 transition-colors shadow-sm"
        >
          <X className="w-5 h-5" />
        </button>

        {/* LEFT PANEL: The Horizontal Dynamic Athletic Card */}
        <div className="w-full md:w-[410px] bg-slate-50 p-8 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-slate-100 shrink-0 select-none">
          <div className="text-center mb-5">
            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.3em]">Tour Player Pass</h4>
          </div>

          {/* Horizontal Player Card ID */}
          <div className="relative w-full max-w-[340px] h-[220px] rounded-[32px] bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 border border-emerald-900/30 p-5 text-white shadow-xl flex flex-col justify-between overflow-hidden">
            {/* Ambient Shimmer / Backdrop pattern */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            
            {/* Top Row: Shirt Number and Position Badge */}
            <div className="flex justify-between items-center relative z-10">
              <span className="text-[9px] font-black tracking-widest text-emerald-400 uppercase truncate max-w-[160px]">
                {tournament.name}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[10px] bg-slate-800/80 border border-slate-700/80 font-extrabold px-2 py-0.5 rounded-lg text-emerald-300">
                  {position}
                </span>
                <span className="text-[10px] bg-emerald-500 text-slate-950 font-black px-2 py-0.5 rounded-lg">
                  #{number}
                </span>
              </div>
            </div>

            {/* Middle Row: Photo, Name & Preferred Foot / Age */}
            <div className="flex items-center gap-4 relative z-10 my-1">
              <div className="shrink-0">
                {renderPlayerAvatar(photoURL, name, "w-16 h-16 rounded-2xl border border-white/20 shadow-md bg-slate-800")}
              </div>
              <div className="min-w-0 flex-1 leading-tight">
                <h3 className="text-lg font-black tracking-tight leading-tight uppercase italic truncate">
                  {name}
                </h3>
                <p className="text-[10px] text-slate-400 font-semibold tracking-wider mt-0.5 uppercase truncate">
                  {team?.name || 'Free Agent'}
                </p>
                <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400 font-bold uppercase">
                  <span>Age: <strong className="text-white">{age}</strong></span>
                  <span className="opacity-30">•</span>
                  <span>Foot: <strong className="text-white">{preferredFoot}</strong></span>
                </div>
              </div>
            </div>

            {/* Bottom Row: Career stats grid mapped horizontally */}
            <div className="grid grid-cols-5 gap-1 bg-slate-900/60 backdrop-blur-sm border border-slate-800/40 rounded-2xl p-2 text-center text-white relative z-10">
              <div className="min-w-0">
                <p className="text-xs font-black text-emerald-400">{matchesPlayedDisplay}</p>
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">MP</p>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black text-emerald-400">{totalGoals}</p>
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">GLS</p>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black text-emerald-400">{totalAssists}</p>
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">AST</p>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black text-yellow-500">{yellowCards}</p>
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">YEL</p>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black text-rose-500">{totalRedCards}</p>
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">RED</p>
              </div>
            </div>

            {/* GK extra saves if Goalkeeper */}
            {position === 'GK' && (
              <div className="absolute right-5 top-[76px] bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-lg text-center shadow-lg backdrop-blur-md">
                <span className="block text-[7px] text-emerald-300 font-extrabold uppercase">Saves</span>
                <span className="text-xs font-black text-emerald-400">{saves}</span>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL: Stats View or Edit Profile Form */}
        <div className="flex-1 p-8 md:p-12 overflow-y-auto no-scrollbar max-h-[92vh] md:max-h-none">
          <AnimatePresence mode="wait">
            {!isEditing ? (
              <motion.div
                key="stats-view"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                {/* Profile Header */}
                <div className="flex justify-between items-start flex-wrap gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full">
                        {position}
                      </span>
                      {team && (
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                          {team.name}
                        </span>
                      )}
                      {player.userId && (
                        <span className="text-[9px] font-black uppercase tracking-widest text-blue-500 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-full flex items-center gap-1">
                          <Check className="w-2.5 h-2.5" /> Claimed Player
                        </span>
                      )}
                    </div>
                    <h2 className="text-3xl font-black uppercase italic tracking-tight text-slate-900 leading-none pt-1">
                      {player.name}
                    </h2>
                  </div>

                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="px-5 py-2.5 bg-slate-900 text-white rounded-full text-xs font-bold hover:bg-emerald-500 hover:text-slate-950 transition-all flex items-center gap-2 active:scale-95 shadow-lg shadow-slate-900/10"
                    >
                      <Edit2 className="w-3.5 h-3.5" /> Edit Profile Attributes
                    </button>
                  )}
                </div>

                {/* Player Bio */}
                <div>
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5">Player Bio</h4>
                  <p className="text-slate-600 text-sm leading-relaxed italic">
                    {bio ? `"${bio}"` : '"A dedicated squad member working hard to achieve team victory."'}
                  </p>
                </div>

                {/* Football Attributes Header Strip */}
                <div className="border-t border-slate-100 pt-6">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="h-px flex-1 bg-slate-100" />
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">Logged Stats</h4>
                    <div className="h-px flex-1 bg-slate-100" />
                  </div>

                  {/* Career Stats Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div className="bg-slate-50/50 border border-slate-100 rounded-3xl p-5 text-center flex flex-col justify-between">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Matches Played</p>
                      <p className="text-3xl font-black text-slate-900">{matchesPlayedDisplay}</p>
                    </div>
                    <div className="bg-slate-50/50 border border-slate-100 rounded-3xl p-5 text-center flex flex-col justify-between">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Goals Scored</p>
                      <p className="text-3xl font-black text-emerald-500">{totalGoals}</p>
                    </div>
                    <div className="bg-slate-50/50 border border-slate-100 rounded-3xl p-5 text-center flex flex-col justify-between">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Assists</p>
                      <p className="text-3xl font-black text-blue-500">{totalAssists}</p>
                    </div>
                    <div className="bg-slate-50/50 border border-slate-100 rounded-3xl p-5 text-center flex flex-col justify-between">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Yellow Cards</p>
                      <p className="text-3xl font-black text-amber-500">{yellowCards}</p>
                    </div>
                    <div className="bg-slate-50/50 border border-slate-100 rounded-3xl p-5 text-center flex flex-col justify-between">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Red Cards</p>
                      <p className="text-3xl font-black text-rose-500">{totalRedCards}</p>
                    </div>
                    {position === 'GK' ? (
                      <div className="bg-indigo-50/30 border border-indigo-100 rounded-3xl p-5 text-center flex flex-col justify-between">
                        <p className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest mb-1">Goalkeeper Saves</p>
                        <p className="text-3xl font-black text-indigo-600">{saves}</p>
                      </div>
                    ) : (
                      <div className="bg-slate-50/50 border border-slate-100 rounded-3xl p-5 text-center flex flex-col justify-between">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">MOTM MVPs</p>
                        <p className="text-3xl font-black text-amber-500">{totalMVPs}</p>
                      </div>
                    )}
                  </div>

                  {/* Ratios & Play Style */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    <div className="bg-slate-50/50 border border-slate-100 rounded-3xl p-5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Footprints className="w-5 h-5 text-slate-400" />
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Preferred Foot</p>
                          <p className="text-xs font-bold text-slate-700">{preferredFoot === 'Both' ? 'Ambidextrous (Both)' : preferredFoot}</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-slate-50/50 border border-slate-100 rounded-3xl p-5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Trophy className="w-5 h-5 text-slate-400" />
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Active Tournament</p>
                          <p className="text-xs font-bold text-slate-700 truncate max-w-[160px]">
                            {tournament.name}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Associated/Past Tournaments History */}
                  <div className="border-t border-slate-100 pt-6">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="h-px flex-1 bg-slate-100" />
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">Tournament History</h4>
                      <div className="h-px flex-1 bg-slate-100" />
                    </div>

                    {loadingTournaments ? (
                      <div className="flex justify-center items-center py-6 gap-2">
                        <div className="w-4 h-4 border-2 border-slate-200 border-t-emerald-500 rounded-full animate-spin" />
                        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Loading history...</span>
                      </div>
                    ) : associationTournaments.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {associationTournaments.map(({ tournament: assocT, teamName, position: assocPos, number: assocNum, isCurrent }) => (
                          <div 
                            key={assocT.id} 
                            className={`p-4 rounded-3xl border transition-all ${
                              isCurrent 
                                ? 'bg-emerald-50/20 border-emerald-500/25 shadow-sm shadow-emerald-500/5' 
                                : 'bg-slate-50/35 border-slate-100 hover:border-slate-200'
                            }`}
                          >
                            <div className="flex justify-between items-start gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
                                    assocT.status === 'live'
                                      ? 'bg-rose-50 text-rose-500 border border-rose-100 animate-pulse'
                                      : assocT.status === 'finished' || assocT.status === 'completed'
                                        ? 'bg-slate-100 text-slate-650'
                                        : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                  }`}>
                                    {assocT.status === 'finished' || assocT.status === 'completed' ? 'Completed' : assocT.status === 'live' ? 'Live' : 'Upcoming'}
                                  </span>
                                  {isCurrent && (
                                    <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600">
                                      Current
                                    </span>
                                  )}
                                </div>
                                <h5 className="font-extrabold text-sm text-slate-800 uppercase italic tracking-tight mt-1 truncate">
                                  {assocT.name}
                                </h5>
                                <p className="text-xs text-slate-500 font-medium">
                                  Team: <span className="font-bold text-slate-700">{teamName}</span>
                                </p>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <span className="text-[9px] bg-slate-200/60 font-black px-1.5 py-0.5 rounded text-slate-750">
                                  {assocPos}
                                </span>
                                <span className="text-[9px] bg-slate-900 text-white font-black px-1.5 py-0.5 rounded">
                                  #{assocNum}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 bg-slate-50/50 rounded-3xl border border-slate-100">
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">No other tournaments found</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.form
                key="edit-form"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                onSubmit={handleUpdate}
                className="space-y-6"
              >
                <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                  <h3 className="text-2xl font-black uppercase tracking-tight text-slate-900 flex items-center gap-2">
                    <Edit2 className="w-5 h-5 text-emerald-500" /> Edit Player Info
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="text-xs font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest"
                  >
                    Cancel
                  </button>
                </div>

                {/* Form Tabs: General Info */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">General info</h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase">Roster name</label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="w-full bg-slate-50 px-5 py-3.5 rounded-2xl border border-slate-200 font-bold focus:ring-2 focus:ring-emerald-500 outline-none text-slate-800"
                        placeholder="Player Name"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase">Photo URL</label>
                      <input
                        type="url"
                        value={photoURL}
                        onChange={e => setPhotoURL(e.target.value)}
                        className="w-full bg-slate-50 px-5 py-3.5 rounded-2xl border border-slate-200 font-bold focus:ring-2 focus:ring-emerald-500 outline-none text-slate-800"
                        placeholder="https://example.com/avatar.jpg"
                      />
                    </div>

                    <div className="space-y-1.5 col-span-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase">Or Choose template avatar</label>
                      <div className="grid grid-cols-4 gap-2.5 p-2 bg-slate-50 border border-slate-100 rounded-2xl max-h-[140px] overflow-y-auto">
                        {DEFAULT_AVATARS.map(avatar => {
                          const Icon = avatar.icon;
                          const isSelected = photoURL === avatar.id;
                          return (
                            <button
                              key={avatar.id}
                              type="button"
                              onClick={() => setPhotoURL(avatar.id)}
                              className={`group h-11 rounded-xl flex items-center justify-center bg-gradient-to-br ${avatar.gradientClass} relative ${isSelected ? 'ring-4 ring-emerald-500 scale-95 shadow-md' : 'opacity-80 hover:opacity-100'} transition-all`}
                              title={avatar.name}
                            >
                              <Icon className={`w-5 h-5 ${avatar.textClass}`} />
                              {isSelected && (
                                <span className="absolute -top-1 -right-1 bg-emerald-500 text-white rounded-full p-0.5 shadow-sm z-10">
                                  <Check className="w-2 h-2" />
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase">Squad #</label>
                      <input
                        type="number"
                        required
                        min="1"
                        max="99"
                        value={number}
                        onChange={e => setNumber(Number(e.target.value))}
                        className="w-full bg-slate-50 px-5 py-3.5 rounded-2xl border border-slate-200 font-bold focus:ring-2 focus:ring-emerald-500 outline-none text-slate-800"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase">Position</label>
                      <select
                        value={position}
                        onChange={e => setPosition(e.target.value)}
                        className="w-full bg-slate-50 px-5 py-3.5 rounded-2xl border border-slate-200 font-bold focus:ring-2 focus:ring-emerald-500 outline-none text-slate-800"
                      >
                        <option value="GK">Goalkeeper (GK)</option>
                        <option value="DEF">Defender (DEF)</option>
                        <option value="MID">Midfielder (MID)</option>
                        <option value="FWD">Forward (FWD)</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase">Pref. Foot</label>
                      <select
                        value={preferredFoot}
                        onChange={e => setPreferredFoot(e.target.value as any)}
                        className="w-full bg-slate-50 px-5 py-3.5 rounded-2xl border border-slate-200 font-bold focus:ring-2 focus:ring-emerald-500 outline-none text-slate-800"
                      >
                        <option value="Right">Right</option>
                        <option value="Left">Left</option>
                        <option value="Both">Both</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase">Age</label>
                      <input
                        type="number"
                        required
                        min="15"
                        max="60"
                        value={age}
                        onChange={e => setAge(Number(e.target.value))}
                        className="w-full bg-slate-50 px-5 py-3.5 rounded-2xl border border-slate-200 font-bold focus:ring-2 focus:ring-emerald-500 outline-none text-slate-800"
                      />
                    </div>
                  </div>

                  {position === 'GK' && (
                    <div className="space-y-1.5 p-5 bg-emerald-50/40 border border-emerald-100 rounded-3xl">
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase">Goalkeeper Saves Counter</label>
                        <span className="text-emerald-600 font-black text-lg">{saves}</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="500"
                        value={saves}
                        onChange={e => setSaves(Number(e.target.value))}
                        className="w-full accent-emerald-500 cursor-pointer"
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase">Personal motto / bio</label>
                    <textarea
                      value={bio}
                      onChange={e => setBio(e.target.value)}
                      maxLength={140}
                      className="w-full bg-slate-50 px-5 py-3 h-20 rounded-2xl border border-slate-200 font-bold focus:ring-2 focus:ring-emerald-500 outline-none text-slate-800 resize-none text-sm"
                      placeholder="Write a custom slogan or play description..."
                    />
                  </div>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  className="w-full bg-emerald-500 hover:bg-emerald-600 hover:text-slate-950 text-white font-bold py-4 rounded-2xl shadow-lg active:scale-95 transition-all mt-6 flex items-center justify-center gap-2"
                >
                  <Check className="w-5 h-5" /> Save Player Attributes
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};
