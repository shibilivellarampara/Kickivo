import React from 'react';
import { motion } from 'motion/react';
import { Tournament } from '../../types';
import { Trophy, ChevronRight } from 'lucide-react';
import { AppLogo } from '../common/Icons';

interface HomeViewProps {
  tournaments: Tournament[];
  onSelectTournament: (t: Tournament) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ tournaments, onSelectTournament }) => {
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
            <AppLogo className="w-5 h-5 rounded-md" />
            Active Tournaments
          </h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tournaments.length === 0 ? (
            <div className="col-span-full py-12 text-center bg-white border border-dashed border-slate-300 rounded-3xl text-slate-400 font-medium">
              No active tournaments found. Be the first to create one!
            </div>
          ) : (
            tournaments
              .sort((a, b) => {
                const order: Record<string, number> = { live: 0, upcoming: 1, scheduled: 1, completed: 2, finished: 2 };
                return (order[a.status] ?? 3) - (order[b.status] ?? 3);
              })
              .map(t => (
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
