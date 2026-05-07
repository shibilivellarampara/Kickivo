import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Trophy, ChevronRight, Activity, Search, X } from 'lucide-react';
import { Tournament } from '../../types';
import { AnimatePresence } from 'motion/react';

interface HomeViewProps {
  tournaments: Tournament[];
  onSelectTournament: (t: Tournament) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ tournaments, onSelectTournament }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);

  const filteredTournaments = tournaments.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-12"
    >
      <header className="space-y-6">
        <div className="space-y-4">
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-slate-900 leading-none">
            LOCAL HEROES,<br/>
            <span className="text-emerald-500 italic">KICKIVO STYLE.</span>
          </h1>
          <p className="text-lg text-slate-500 max-w-xl">
            Track live scores, build your player card, and join the most competitive community in amateur football.
          </p>
        </div>
      </header>

      <section className="space-y-6">
        <div className="flex items-center justify-between min-h-[44px]">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Activity className="w-6 h-6 text-emerald-500" />
            {!isSearchExpanded && 'Active Tournaments'}
          </h2>

          <div className="flex items-center gap-2">
            <AnimatePresence>
              {isSearchExpanded && (
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: '200px', opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  className="relative overflow-hidden"
                >
                  <input 
                    autoFocus
                    type="text"
                    placeholder="Active Tournament"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white border border-slate-200 pl-4 pr-10 py-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
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
              className={`p-2 rounded-xl transition-all ${isSearchExpanded ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
            >
              {isSearchExpanded ? <X className="w-5 h-5" /> : <Search className="w-5 h-5" />}
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTournaments.length === 0 ? (
            <div className="col-span-full py-20 text-center bg-white border border-dashed border-slate-300 rounded-[40px] text-slate-400">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-slate-200" />
              </div>
              <p className="font-bold">No tournaments match your search.</p>
              <p className="text-sm mt-1">Try a different keyword or create your own!</p>
            </div>
          ) : (
            filteredTournaments.map(t => (
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
};
