import React, { useState } from 'react';
import { motion } from 'motion/react';
import { User as FirebaseUser } from 'firebase/auth';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../../lib/firebase';
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
        const pool = [
          'Real Madrid', 'FC Barcelona', 'Manchester City', 'Liverpool FC', 'Arsenal', 
          'Chelsea', 'PSG', 'Bayern Munich', 'Juventus', 'AC Milan', 
          'Inter Milan', 'Manchester United', 'Atletico Madrid', 'Borussia Dortmund', 'Bayer Leverkusen', 'Tottenham'
        ];
        const realRosters: Record<string, string[]> = {
          'Real Madrid': ['Thibaut Courtois', 'Dani Carvajal', 'Eder Militao', 'Antonio Rudiger', 'Ferland Mendy', 'Federico Valverde', 'Aurelien Tchouameni', 'Jude Bellingham', 'Rodrygo Goes', 'Kylian Mbappe', 'Vinicius Junior', 'Endrick', 'Arda Guler', 'Eduardo Camavinga', 'Brahim Diaz'],
          'FC Barcelona': ['Ter Stegen', 'Jules Kounde', 'Pau Cubarsi', 'Ronald Araujo', 'Alejandro Balde', 'Frenkie de Jong', 'Pedri', 'Gavi', 'Lamine Yamal', 'Robert Lewandowski', 'Raphinha', 'Ferran Torres', 'Ilkay Gundogan', 'Andreas Christensen', 'Fermin Lopez'],
          'Manchester City': ['Ederson', 'Kyle Walker', 'Ruben Dias', 'Manuel Akanji', 'Josko Gvardiol', 'Rodri', 'Kevin De Bruyne', 'Bernardo Silva', 'Phil Foden', 'Erling Haaland', 'Jeremy Doku', 'Jack Grealish', 'Mateo Kovacic', 'John Stones', 'Nathan Ake'],
          'Liverpool FC': ['Alisson Becker', 'Trent Alexander-Arnold', 'Ibrahima Konate', 'Virgil van Dijk', 'Andrew Robertson', 'Alexis Mac Allister', 'Dominik Szoboszlai', 'Ryan Gravenberch', 'Mohamed Salah', 'Darwin Nunez', 'Luis Diaz', 'Cody Gakpo', 'Diogo Jota', 'Harvey Elliott', 'Curtis Jones'],
          'Arsenal': ['David Raya', 'Ben White', 'William Saliba', 'Gabriel Magalhaes', 'Riccardo Calafiori', 'Declan Rice', 'Martin Odegaard', 'Mikel Merino', 'Bukayo Saka', 'Kai Havertz', 'Gabriel Martinelli', 'Leandro Trossard', 'Gabriel Jesus', 'Jurrien Timber', 'Jorginho'],
          'Chelsea': ['Robert Sanchez', 'Reece James', 'Wesley Fofana', 'Levi Colwill', 'Marc Cucurella', 'Enzo Fernandez', 'Moises Caicedo', 'Cole Palmer', 'Noni Madueke', 'Nicolas Jackson', 'Christopher Nkunku', 'Jadon Sancho', 'Joao Felix', 'Pedro Neto', 'Romeo Lavia'],
          'PSG': ['Gianluigi Donnarumma', 'Achraf Hakimi', 'Marquinhos', 'Willian Pacho', 'Nuno Mendes', 'Warren Zaire-Emery', 'Vitinha', 'Fabian Ruiz', 'Ousmane Dembele', 'Bradley Barcola', 'Randal Kolo Muani', 'Goncalo Ramos', 'Marco Asensio', 'Lee Kang-in', 'Lucas Beraldo'],
          'Bayern Munich': ['Manuel Neuer', 'Joshua Kimmich', 'Dayot Upamecano', 'Kim Min-jae', 'Alphonso Davies', 'Aleksandar Pavlovic', 'Joao Palhinha', 'Jamal Musiala', 'Michael Olise', 'Harry Kane', 'Leroy Sane', 'Serge Gnabry', 'Thomas Muller', 'Kingsley Coman', 'Konrad Laimer'],
          'Juventus': ['Michele Di Gregorio', 'Nicolo Savona', 'Federico Gatti', 'Gleison Bremer', 'Andrea Cambiaso', 'Manuel Locatelli', 'Douglas Luiz', 'Teun Koopmeiners', 'Kenan Yildiz', 'Dusan Vlahovic', 'Nico Gonzalez', 'Francisco Conceicao', 'Khephren Thuram', 'Weston McKennie', 'Timothy Weah'],
          'AC Milan': ['Mike Maignan', 'Emerson Royal', 'Fikayo Tomori', 'Strahinja Pavlovic', 'Theo Hernandez', 'Youssouf Fofana', 'Tijjani Reijnders', 'Ruben Loftus-Cheek', 'Christian Pulisic', 'Alvaro Morata', 'Rafael Leao', 'Samuel Chukwueze', 'Tammy Abraham', 'Ismael Bennacer', 'Davide Calabria'],
          'Inter Milan': ['Yann Sommer', 'Benjamin Pavard', 'Francesco Acerbi', 'Alessandro Bastoni', 'Denzel Dumfries', 'Nicolo Barella', 'Hakan Calhanoglu', 'Henrikh Mkhitaryan', 'Federico Dimarco', 'Lautaro Martinez', 'Marcus Thuram', 'Mehdi Taremi', 'Davide Frattesi', 'Piotr Zielinski', 'Stefan de Vrij'],
          'Manchester United': ['Andre Onana', 'Diogo Dalot', 'Matthijs de Ligt', 'Lisandro Martinez', 'Noussair Mazraoui', 'Kobbie Mainoo', 'Manuel Ugarte', 'Bruno Fernandes', 'Alejandro Garnacho', 'Rasmus Hojlund', 'Marcus Rashford', 'Amad Diallo', 'Joshua Zirkzee', 'Harry Maguire', 'Christian Eriksen'],
          'Atletico Madrid': ['Jan Oblak', 'Nahuel Molina', 'Robin Le Normand', 'Jose Maria Gimenez', 'Reinildo', 'Rodrigo De Paul', 'Koke', 'Conor Gallagher', 'Antoine Griezmann', 'Julian Alvarez', 'Alexander Sorloth', 'Samuel Lino', 'Marcos Llorente', 'Angel Correa', 'Rodrigo Riquelme'],
          'Borussia Dortmund': ['Gregor Kobel', 'Yan Couto', 'Waldemar Anton', 'Nico Schlotterbeck', 'Julian Ryerson', 'Emre Can', 'Pascal Gross', 'Julian Brandt', 'Marcel Sabitzer', 'Serhou Guirassy', 'Karim Adeyemi', 'Jamie Gittens', 'Donyell Malen', 'Maximilian Beier', 'Felix Nmecha'],
          'Bayer Leverkusen': ['Lukas Hradecky', 'Edmond Tapsoba', 'Jonathan Tah', 'Piero Hincapie', 'Jeremie Frimpong', 'Granit Xhaka', 'Robert Andrich', 'Alejandro Grimaldo', 'Florian Wirtz', 'Victor Boniface', 'Martin Terrier', 'Patrik Schick', 'Aleix Garcia', 'Jonas Hofmann', 'Exequiel Palacios'],
          'Tottenham': ['Guglielmo Vicario', 'Pedro Porro', 'Cristian Romero', 'Micky van de Ven', 'Destiny Udogie', 'Yves Bissouma', 'James Maddison', 'Rodrigo Bentancur', 'Dejan Kulusevski', 'Dominic Solanke', 'Heung-min Son', 'Brennan Johnson', 'Richarlison', 'Lucas Bergvall', 'Archie Gray']
        };

        const shortNames: Record<string, string> = {
          'Real Madrid': 'RM', 'FC Barcelona': 'FCB', 'Manchester City': 'MC', 'Liverpool FC': 'LFC', 'Arsenal': 'ARS', 'Chelsea': 'CHE', 'PSG': 'PSG', 'Bayern Munich': 'FCB', 'Juventus': 'JUV', 'AC Milan': 'ACM', 'Inter Milan': 'INT', 'Manchester United': 'MU', 'Atletico Madrid': 'ATM', 'Borussia Dortmund': 'BVB', 'Bayer Leverkusen': 'B04', 'Tottenham': 'TOT'
        };
        
        const actualTeamsCount = Number(maxTeams);
        for (let tIdx = 0; tIdx < actualTeamsCount; tIdx++) {
          const baseTeamName = pool[tIdx % pool.length];
          const teamName = baseTeamName + (tIdx >= pool.length ? ` ${Math.floor(tIdx / pool.length) + 1}` : '');
          const teamRef = await addDoc(collection(db, `tournaments/${docRef.id}/teams`), {
            name: teamName,
            createdAt: serverTimestamp(),
          });

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
              <p className="text-[10px] text-slate-400 font-medium">Automatically populates all team slots with realistic squads and players.</p>
            </label>
          </div>
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
};
