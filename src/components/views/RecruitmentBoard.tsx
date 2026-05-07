import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User as FirebaseUser } from 'firebase/auth';
import { collection, query, orderBy, limit, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { MessageSquare, User as UserIcon, Send, X } from 'lucide-react';
import { db, OperationType, handleFirestoreError } from '../../lib/firebase';

interface RecruitmentBoardProps {
  user: FirebaseUser | null;
  onError: (err: any) => void;
  notify: (msg: string) => void;
}

export const RecruitmentBoard: React.FC<RecruitmentBoardProps> = ({ user, onError, notify }) => {
  const [posts, setPosts] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'recruitment'), orderBy('createdAt', 'desc'), limit(10));
    const unsub = onSnapshot(q, (s) => {
      setPosts(s.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => {
      onError(err);
      handleFirestoreError(err, OperationType.LIST, 'recruitment');
    });
    return unsub;
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const form = e.currentTarget as HTMLFormElement;
    const content = (form.elements.namedItem('content') as HTMLTextAreaElement).value;
    const type = (form.elements.namedItem('type') as HTMLSelectElement).value;

    try {
      await addDoc(collection(db, 'recruitment'), {
        userId: user.uid,
        userName: user.displayName || 'Player',
        content,
        type,
        createdAt: serverTimestamp()
      });
      setShowForm(false);
    } catch (err) {
      onError(err);
      handleFirestoreError(err, OperationType.WRITE, 'recruitment');
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900">
          <MessageSquare className="w-5 h-5 text-emerald-500" />
          Community Recruitment
        </h2>
        <button 
          onClick={() => user ? setShowForm(true) : notify('Please login to post')}
          className="px-4 py-2 bg-slate-900 text-white rounded-full text-xs font-bold hover:bg-emerald-500 transition-all shadow-lg active:scale-95"
        >
          Post Request
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {posts.map(post => (
          <div key={post.id} className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm space-y-4 hover:border-emerald-200 transition-all flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                  <UserIcon className="w-5 h-5 text-slate-400" />
                </div>
                <div>
                  <div className="font-bold text-sm text-slate-900">{post.userName}</div>
                  <div className="text-[10px] uppercase font-black tracking-widest text-emerald-500">{post.type?.replace(/_/g, ' ')}</div>
                </div>
              </div>
              <p className="text-sm text-slate-600 italic leading-relaxed">"{post.content}"</p>
            </div>
            <button className="w-full py-3 bg-slate-50 text-slate-900 text-xs font-bold rounded-[18px] flex items-center justify-center gap-2 hover:bg-emerald-50 hover:text-emerald-500 transition-all border border-slate-100 group">
              <Send className="w-3 h-3 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" /> Connect
            </button>
          </div>
        ))}
        {posts.length === 0 && (
          <div className="col-span-full py-20 text-center bg-slate-50 rounded-[32px] border border-dashed border-slate-200 text-slate-400 font-medium italic">
            No active recruitment requests yet.
          </div>
        )}
      </div>

      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowForm(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-white w-full max-w-md rounded-[32px] p-8 shadow-2xl">
              <button onClick={() => setShowForm(false)} className="absolute right-6 top-6 p-2 text-slate-300 hover:text-slate-600 transition-colors"><X className="w-5 h-5" /></button>
              <h2 className="text-2xl font-black tracking-tight mb-6">Recruitment Post</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <select name="type" className="w-full bg-slate-50 px-5 py-4 rounded-2xl border border-slate-200 font-bold focus:ring-2 focus:ring-emerald-500 outline-none">
                  <option value="looking_for_team">Player seeking Team</option>
                  <option value="looking_for_player">Team seeking Player</option>
                  <option value="friendly_match">Friendly Match Request</option>
                </select>
                <textarea name="content" required placeholder="Tell the community what you're looking for..." className="w-full bg-slate-50 px-5 py-4 rounded-2xl border border-slate-200 h-32 focus:ring-2 focus:ring-emerald-500 outline-none" />
                <button type="submit" className="w-full bg-emerald-500 text-white font-bold py-4 rounded-2xl hover:bg-emerald-600 transition-all shadow-lg active:scale-95">Post to Board</button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  );
};
