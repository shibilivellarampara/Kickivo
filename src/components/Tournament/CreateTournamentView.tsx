import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { addDoc, collection } from 'firebase/firestore';
import { User as FirebaseUser } from 'firebase/auth';
import { db } from '../../lib/firebase';
import { Tournament } from '../../types';

interface CreateTournamentViewProps {
  user: FirebaseUser | null;
  onSuccess: () => void;
  onError: (err: any) => void;
}

export const CreateTournamentView: React.FC<CreateTournamentViewProps> = ({ user, onSuccess, onError }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<Tournament['type']>('league');
  const [numberOfGroups, setNumberOfGroups] = useState(2);
  const [advancingPerGroup, setAdvancingPerGroup] = useState(2);
  const [advancementType, setAdvancementType] = useState<'standard' | 'qualifier'>('standard');
  const [maxTeams, setMaxTeams] = useState(8);
  const [matchesPerDay, setMatchesPerDay] = useState(8);
  const [startTime, setStartTime] = useState('10:00');
  const [matchDuration, setMatchDuration] = useState(30);
  const [enableTimer, setEnableTimer] = useState(false);
  const [homeAwayGroup, setHomeAwayGroup] = useState(false);
  const [homeAwayKnockout, setHomeAwayKnockout] = useState(false);
  const [hasLosersFinal, setHasLosersFinal] = useState(false);
  const [useDemoData, setUseDemoData] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionProgress, setSubmissionProgress] = useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isSubmitting) return;

    setIsSubmitting(true);
    setSubmissionProgress(5);
    try {
      const docRef = await addDoc(collection(db, 'tournaments'), {
        name,
        description,
        type,
        numberOfGroups: type === 'league_playoff' ? numberOfGroups : null,
        advancingPerGroup: type === 'league_playoff' ? advancingPerGroup : null,
        advancementType: type === 'league_playoff' ? (numberOfGroups === 1 && advancingPerGroup === 3 ? 'qualifier' : 'standard') : null,
        maxTeams: Number(maxTeams),
        matchesPerDay,
        startTime,
        matchDuration: enableTimer ? matchDuration : null,
        homeAwayGroup: type === 'league' ? homeAwayGroup : false,
        homeAwayKnockout: type === 'knockout' ? homeAwayKnockout : false,
        hasLosersFinal: type === 'knockout' ? hasLosersFinal : false,
        creatorId: user.uid,
        status: 'upcoming',
        createdAt: new Date(),
      });
      setSubmissionProgress(20);

      if (useDemoData) {
        // Generate Demo Teams (European Elite)
        const demoTeams = [
          { name: 'Real Madrid', logo: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=200&h=200&fit=crop', players: ['Vinícius Jr', 'Bellingham', 'Rodrygo', 'Valverde', 'Courtois'] },
          { name: 'Manchester City', logo: 'https://images.unsplash.com/photo-1543353071-10c8ba85a902?w=200&h=200&fit=crop', players: ['Haaland', 'De Bruyne', 'Rodri', 'Foden', 'Ederson'] },
          { name: 'Bayern Munich', logo: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=200&h=200&fit=crop', players: ['Harry Kane', 'Musiala', 'Sané', 'Kimmich', 'Neuer'] },
          { name: 'Liverpool FC', logo: 'https://images.unsplash.com/photo-1516239482977-b5536283ff86?w=200&h=200&fit=crop', players: ['Mo Salah', 'Van Dijk', 'Alisson', 'Mac Allister', 'Luis Díaz'] },
          { name: 'Paris Saint-Germain', logo: 'https://images.unsplash.com/photo-1519750783826-e2420f4d687f?w=200&h=200&fit=crop', players: ['Dembélé', 'Vitinha', 'Donnarumma', 'Hakimi', 'Zaire-Emery'] },
          { name: 'Inter Milan', logo: 'https://images.unsplash.com/photo-1504450708461-91369b76c88f?w=200&h=200&fit=crop', players: ['Lautaro Martínez', 'Barella', 'Bastoni', 'Dimarco', 'Sommer'] },
          { name: 'Bayer Leverkusen', logo: 'https://images.unsplash.com/photo-1563299796-175967249174?w=200&h=200&fit=crop', players: ['Wirtz', 'Xhaka', 'Grimaldo', 'Frimpong', 'Schick'] },
          { name: 'Arsenal FC', logo: 'https://images.unsplash.com/photo-1534361960057-19889db9621e?w=200&h=200&fit=crop', players: ['Ødegaard', 'Saka', 'Rice', 'Saliba', 'Raya'] },
          { name: 'FC Barcelona', logo: 'https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=200&h=200&fit=crop', players: ['Lamine Yamal', 'Lewandowski', 'Gavi', 'Pedri', 'Ter Stegen'] },
          { name: 'Borussia Dortmund', logo: 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=200&h=200&fit=crop', players: ['Guirassy', 'Brandt', 'Sabitzer', 'Kobel', 'Schlotterbeck'] },
          { name: 'Atlético Madrid', logo: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=200&h=200&fit=crop', players: ['Griezmann', 'Julián Alvarez', 'Oblak', 'De Paul', 'Koke'] },
          { name: 'AC Milan', logo: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=200&h=200&fit=crop', players: ['Leão', 'Maignan', 'Theo Hernandez', 'Pulisic', 'Morata'] },
          { name: 'Juventus', logo: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=200&h=200&fit=crop', players: ['Vlahović', 'Douglas Luiz', 'Koopmeiners', 'Bremer', 'Di Gregorio'] },
          { name: 'Chelsea FC', logo: 'https://images.unsplash.com/photo-1543353071-10c8ba85a902?w=200&h=200&fit=crop', players: ['Palmer', 'Enzo Fernández', 'Caicedo', 'Jackson', 'Robert Sánchez'] },
          { name: 'Napoli', logo: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=200&h=200&fit=crop', players: ['Kvaratskhelia', 'Lukaku', 'Osimhen', 'Zambo Anguissa', 'Meret'] },
          { name: 'RB Leipzig', logo: 'https://images.unsplash.com/photo-1516239482977-b5536283ff86?w=200&h=200&fit=crop', players: ['Openda', 'Xavi Simons', 'Sesko', 'Gulácsi', 'Raum'] },
        ];

        const teamsToCreate = demoTeams.slice(0, Math.min(Number(maxTeams), 16));
        const totalTeams = teamsToCreate.length;
        let teamsDone = 0;

        for (const t of teamsToCreate) {
          const teamDoc = await addDoc(collection(db, `tournaments/${docRef.id}/teams`), {
            name: t.name,
            logoURL: t.logo,
            tournamentId: docRef.id,
            creatorId: user.uid,
            createdAt: new Date()
          });

          // Add some demo players
          const positions = ['GK', 'DEF', 'MID', 'FWD'];
          for (let i = 0; i < t.players.length; i++) {
            await addDoc(collection(db, `tournaments/${docRef.id}/teams/${teamDoc.id}/players`), {
              name: t.players[i],
              number: [1, 7, 8, 9, 10][i] || (i + 1),
              position: positions[Math.min(i, positions.length - 1)],
              tournamentId: docRef.id,
              teamId: teamDoc.id,
              userId: null
            });
          }
          teamsDone++;
          setSubmissionProgress(20 + Math.floor((teamsDone / totalTeams) * 80));
        }
      } else {
        setSubmissionProgress(100);
      }

      onSuccess();
    } catch (err) {
      onError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-2xl mx-auto bg-white p-8 md:p-12 rounded-[40px] shadow-2xl border border-slate-100"
    >
      <div className="text-center mb-10">
        <h1 className="text-3xl font-black tracking-tight italic uppercase">Create Tournament</h1>
        <p className="text-slate-400 text-sm font-medium mt-2">Design your competition structure</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Competition Name</label>
            <input 
              required
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-slate-50 px-5 py-4 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-lg"
              placeholder="e.g. Champions League 2024"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Tagline / Location</label>
            <textarea 
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full bg-slate-50 px-5 py-4 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium h-24"
              placeholder="Tell players about the venue, prize, or rules..."
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Format</label>
            <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
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
              onChange={e => setMaxTeams(Number(e.target.value))}
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
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
               <div className="flex items-center gap-3">
                 <input 
                   type="checkbox"
                   id="enable-timer"
                   checked={enableTimer}
                   onChange={e => setEnableTimer(e.target.checked)}
                   className="w-5 h-5 accent-emerald-500 cursor-pointer"
                 />
                 <label htmlFor="enable-timer" className="text-xs font-bold text-slate-700 cursor-pointer">Enable Match Timer</label>
               </div>
               {enableTimer && (
                 <div className="flex items-center gap-2">
                   <input 
                     type="number"
                     min="1"
                     max="120"
                     value={matchDuration}
                     onChange={e => setMatchDuration(Number(e.target.value))}
                     className="w-16 bg-white border border-slate-200 rounded-lg px-2 py-1 text-center font-bold text-xs"
                   />
                   <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">MINS</span>
                 </div>
               )}
            </div>
          </div>
          <div className="space-y-4 pt-4">
             {type === 'league' && (
               <div className="flex items-center gap-3">
                 <input 
                   type="checkbox"
                   id="ha-group"
                   checked={homeAwayGroup}
                   onChange={e => setHomeAwayGroup(e.target.checked)}
                   className="w-5 h-5 accent-emerald-500 cursor-pointer disabled:opacity-30"
                 />
                 <label htmlFor="ha-group" className="text-xs font-bold text-slate-500 cursor-pointer">Home & Away (Groups)</label>
               </div>
             )}
             {type === 'knockout' && (
               <>
                 <div className="flex items-center gap-3">
                   <input 
                     type="checkbox"
                     id="ha-knockout"
                     checked={homeAwayKnockout}
                     onChange={e => setHomeAwayKnockout(e.target.checked)}
                     className="w-5 h-5 accent-emerald-500 cursor-pointer disabled:opacity-30"
                   />
                   <label htmlFor="ha-knockout" className="text-xs font-bold text-slate-500 cursor-pointer">Home & Away (Knockout)</label>
                 </div>
                 <div className="flex items-center gap-3">
                   <input 
                     type="checkbox"
                     id="losers-final"
                     checked={hasLosersFinal}
                     onChange={e => setHasLosersFinal(e.target.checked)}
                     className="w-5 h-5 accent-emerald-500 cursor-pointer disabled:opacity-30"
                   />
                   <label htmlFor="losers-final" className="text-xs font-bold text-slate-500 cursor-pointer">Include Losers Final (3rd Place)</label>
                 </div>
               </>
             )}
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
                onChange={e => {
                  const val = Number(e.target.value);
                  setNumberOfGroups(val);
                  if (val !== 1) setAdvancementType('standard');
                }}
                className="w-full bg-slate-50 px-5 py-4 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              >
                {[1, 2, 4, 8].map(n => <option key={n} value={n}>{n} {n === 1 ? 'Group (Single)' : 'Groups'}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Advancing to Knockout</label>
              <select 
                value={advancingPerGroup}
                onChange={e => setAdvancingPerGroup(Number(e.target.value))}
                className="w-full bg-slate-50 px-5 py-4 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              >
                {numberOfGroups === 1 
                  ? [2, 3, 4].map(n => <option key={n} value={n}>Top {n} Teams</option>)
                  : [1, 2, 4].map(n => <option key={n} value={n}>Top {n} per Group</option>)
                }
              </select>
            </div>
            {numberOfGroups === 1 && advancingPerGroup === 3 && (
              <div className="col-span-2 p-4 bg-amber-50 rounded-2xl border border-amber-100">
                <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest flex items-center gap-2">
                  <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                  Qualifier Mode Active
                </p>
                <p className="text-[10px] text-amber-600 mt-1">1st place goes to Final. 2nd vs 3rd play a Qualifier for the last Final spot.</p>
              </div>
            )}
            {numberOfGroups === 1 && advancingPerGroup === 2 && (
              <div className="col-span-2 p-4 bg-blue-50 rounded-2xl border border-blue-100">
                <p className="text-[10px] font-bold text-blue-700 uppercase tracking-widest">Straight to Final</p>
                <p className="text-[10px] text-blue-600 mt-1">1st and 2nd will play the Grand Final immediately.</p>
              </div>
            )}
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
        </div>

        <button 
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-emerald-500 text-white font-black py-5 rounded-2xl shadow-xl shadow-emerald-500/20 hover:bg-emerald-600 transition-all active:scale-95 disabled:opacity-50 relative overflow-hidden"
        >
          {isSubmitting && (
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${submissionProgress}%` }}
              className="absolute inset-0 bg-white/20"
            />
          )}
          <span className="relative z-10">
            {isSubmitting ? `Architecting... ${submissionProgress}%` : 'Create Tournament'}
          </span>
        </button>
      </form>
    </motion.div>
  );
};
