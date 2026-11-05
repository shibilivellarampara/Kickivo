import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Trophy, ChevronRight, Activity, Search, X, Heart } from 'lucide-react';
import { Tournament } from '../../types';
import { AnimatePresence } from 'motion/react';
import { User as FirebaseUser } from 'firebase/auth';

interface HomeViewProps {
  tournaments: Tournament[];
  onSelectTournament: (t: Tournament) => void;
  user: FirebaseUser | null;
  followedIds: string[];
}

export const HomeView: React.FC<HomeViewProps> = ({ 
  tournaments, 
  onSelectTournament,
  user,
  followedIds
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [filter, setFilter] = useState<'all' | 'followed'>('all');

  const filteredTournaments = tournaments
    .filter(t => {
      if (filter === 'followed') {
        return followedIds.includes(t.id);
      }
      return true;
    })
    .filter(t => 
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
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-slate-900 dark:text-white leading-none">
            LOCAL HEROES,<br/>
            <span className="text-emerald-500 italic">KICKIVO STYLE.</span>
          </h1>
          <p className="text-lg text-slate-500 dark:text-slate-400 max-w-xl">
            Track live scores, build your player card, and join the most competitive community in amateur football.
          </p>
        </div>
      </header>

      <section className="space-y-6">
        <motion.div layout className="flex flex-wrap items-center justify-between gap-4 min-h-[48px]">
          <motion.div layout className="flex items-center gap-3">
            <Activity className="w-6 h-6 text-emerald-500 shrink-0" />
            <AnimatePresence mode="wait">
              {!isSearchExpanded && (
                <motion.h2
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.15 }}
                  className="text-xl font-bold text-slate-900 dark:text-white"
                >
                  Active Tournaments
                </motion.h2>
              )}
            </AnimatePresence>
          </motion.div>

          <motion.div layout className="flex items-center gap-3 ml-auto">
            <AnimatePresence mode="wait">
              {!isSearchExpanded && (
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="flex bg-slate-150/60 dark:bg-slate-900 p-1 rounded-xl border border-slate-200/60 dark:border-slate-800/80"
                >
                  <button
                    type="button"
                    onClick={() => setFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                      filter === 'all'
                        ? 'bg-white dark:bg-slate-800 text-emerald-500 shadow-sm'
                        : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                    }`}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!user) {
                        if ((window as any).triggerLogin) {
                          (window as any).triggerLogin();
                        }
                      } else {
                        setFilter('followed');
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer ${
                      filter === 'followed'
                        ? 'bg-white dark:bg-slate-800 text-emerald-500 shadow-sm'
                        : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                    }`}
                  >
                    <Heart className={`w-3 h-3 ${filter === 'followed' ? 'text-rose-500 fill-rose-500' : 'text-slate-400 dark:text-slate-500'}`} />
                    Followed
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {isSearchExpanded && (
                <motion.div
                  layout
                  initial={{ width: 0, opacity: 0, x: 20 }}
                  animate={{ width: '240px', opacity: 1, x: 0 }}
                  exit={{ width: 0, opacity: 0, x: 20 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  className="relative overflow-hidden"
                >
                  <input 
                    autoFocus
                    type="text"
                    placeholder="Search tournaments..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 pl-4 pr-10 py-2 rounded-xl text-base md:text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500 transition-all font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-sm"
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
            
            <motion.button 
              layout
              onClick={() => {
                setIsSearchExpanded(!isSearchExpanded);
                if (isSearchExpanded) setSearchQuery('');
              }}
              className={`p-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center cursor-pointer ${isSearchExpanded ? 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:scale-105' : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/70 hover:scale-105'}`}
            >
              {isSearchExpanded ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
            </motion.button>
          </motion.div>
        </motion.div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTournaments.length === 0 ? (
            <div className="col-span-full py-20 text-center bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-800 rounded-[40px] text-slate-400">
              <div className="w-16 h-16 bg-slate-50 dark:bg-slate-950 rounded-full flex items-center justify-center mx-auto mb-4">
                {filter === 'followed' ? (
                  <Heart className="w-8 h-8 text-rose-400 fill-rose-400/25 animate-pulse" />
                ) : (
                  <Search className="w-8 h-8 text-slate-200 dark:text-slate-700" />
                )}
              </div>
              <p className="font-bold text-slate-700 dark:text-slate-300">
                {filter === 'followed' 
                  ? "You aren't following any matching tournaments yet."
                  : "No tournaments match your search."}
              </p>
              <p className="text-sm mt-1 text-slate-400 dark:text-slate-500">
                {filter === 'followed'
                  ? "Follow tournaments by viewing them and tapping the heart icon to keep tabs on their schedules!"
                  : "Try a different keyword or create your own!"}
              </p>
            </div>
          ) : (
            filteredTournaments.map(t => (
              <motion.div 
                key={t.id}
                whileHover={{ y: -4 }}
                onClick={() => onSelectTournament(t)}
                className="group bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800/85 shadow-sm hover:shadow-xl hover:border-emerald-200 dark:hover:border-emerald-500/50 transition-all cursor-pointer relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-4 flex items-center gap-2">
                  <div className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    t.status === 'live' ? 'bg-emerald-500 text-white animate-pulse' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                  }`}>
                    {t.status}
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl flex items-center justify-center group-hover:bg-emerald-500 transition-colors">
                    <Trophy className="w-6 h-6 text-emerald-500 group-hover:text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg leading-tight text-slate-900 dark:text-slate-100">{t.name}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">{t.description}</p>
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{t.type}</span>
                      {(t.category === 'efootball' || t.isEfootball) && (
                        <span className="text-[9px] font-black uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 dark:text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-200/40 dark:border-indigo-800/40">
                          eFootball
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {followedIds.includes(t.id) && (
                        <motion.div 
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="text-rose-500 flex items-center justify-center shrink-0"
                        >
                          <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                        </motion.div>
                      )}
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-500 dark:text-slate-600" />
                    </div>
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
