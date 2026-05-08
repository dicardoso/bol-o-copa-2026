import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Trophy, Search, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '../lib/utils';
import { collection, query, orderBy, limit, getDocs, getCountFromServer, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';

export const Leaderboard = () => {
  const { user, profile } = useAuth();
  const [filter, setFilter] = useState('geral');
  const [ranking, setRanking] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [myRank, setMyRank] = useState<number | null>(null);

  useEffect(() => {
    const fetchRanking = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, 'users'), orderBy('points', 'desc'), limit(50));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map((doc, index) => ({
          pos: index + 1,
          id: doc.id,
          ...doc.data()
        }));
        setRanking(data);

        // Calcular minha posição
        if (user) {
          const myEntry = data.find(r => r.id === user.uid);
          if (myEntry) {
            setMyRank(myEntry.pos);
          } else {
            // Se não estiver no top 50, conta quantos têm mais pontos
            const userPoints = profile?.points || 0;
            const countQ = query(collection(db, 'users'), where('points', '>', userPoints));
            const countSnapshot = await getCountFromServer(countQ);
            setMyRank(countSnapshot.data().count + 1);
          }
        }
      } catch (err) {
        console.error("Erro ao buscar ranking:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchRanking();
  }, [filter, user, profile]);

  if (loading) return <div className="flex items-center justify-center h-64 text-white">Calculando ranking...</div>;

  return (
    <div className="space-y-8 pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-4 border-b border-white/5">
        <div>
          <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Ranking Global</h2>
        </div>
        <div className="flex bg-white/5 p-1 rounded-xl">
          {['Geral', 'Semanal'].map((f) => (
            <button 
              key={f}
              onClick={() => setFilter(f.toLowerCase())}
              className={cn(
                "px-6 py-2 rounded-lg text-xs font-black transition-all uppercase tracking-widest",
                filter === f.toLowerCase() ? "bg-editorial-gold text-editorial-navy" : "text-white/60 hover:text-white"
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="sidebar-card col-span-1 md:col-span-2">
          <span className="section-title">Top 3 Players</span>
          <div className="flex items-center justify-around py-4">
             {ranking.slice(0, 3).map((item) => (
               <div key={item.pos} className="flex flex-col items-center">
                 <div className="relative">
                   <div className={cn(
                     "w-16 h-16 rounded-full flex items-center justify-center text-3xl border-4 mb-2 overflow-hidden",
                     item.pos === 1 ? "border-editorial-gold bg-editorial-gold/10" : 
                     item.pos === 2 ? "border-slate-300 bg-slate-300/10" : "border-amber-600 bg-amber-600/10"
                   )}>
                     {item.photoURL ? <img src={item.photoURL} className="w-full h-full object-cover" /> : '👤'}
                   </div>
                   <div className="absolute -top-2 -right-2 w-8 h-8 bg-black rounded-full flex items-center justify-center text-xs font-black border border-white/20">
                     #{item.pos}
                   </div>
                 </div>
                 <span className="font-bold text-sm">{item.displayName}</span>
                 <span className="text-editorial-gold font-black">{item.points} pts</span>
               </div>
             ))}
             {ranking.length === 0 && <p className="text-white/40 italic">Nenhum jogador pontuou ainda.</p>}
          </div>
        </div>
        <div className="sidebar-card">
           <span className="section-title">Minha Posição</span>
           <div className="flex flex-col justify-center h-full">
              <p className="text-4xl font-black mb-1">{myRank ? `#${myRank}` : '--'}</p>
              <p className="text-[10px] uppercase font-bold text-white/40 tracking-widest">
                {profile?.points || 0} pontos acumulados
              </p>
           </div>
        </div>
      </div>

      <div className="bg-editorial-navy/40 border border-white/5 rounded-[24px] overflow-hidden shadow-2xl">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-white/5">
              <th className="px-8 py-4 text-[10px] font-black text-white/40 uppercase tracking-widest">Pos</th>
              <th className="px-8 py-4 text-[10px] font-black text-white/40 uppercase tracking-widest">Player</th>
              <th className="px-8 py-4 text-[10px] font-black text-white/40 uppercase tracking-widest text-right">Points</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {ranking.map((row, i) => (
              <motion.tr 
                key={row.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.05 }}
                className="hover:bg-white/[0.02] transition-colors"
              >
                <td className="px-8 py-4 font-black">
                  <span className={cn(row.pos <= 3 ? "text-editorial-gold" : "text-white/20")}>
                    {row.pos.toString().padStart(2, '0')}
                  </span>
                </td>
                <td className="px-8 py-4">
                   <div className="flex items-center gap-4">
                     <div className="w-8 h-8 bg-white/5 rounded-full flex items-center justify-center text-sm overflow-hidden">
                       {row.photoURL ? <img src={row.photoURL} /> : '👤'}
                     </div>
                     <span className="font-bold text-sm">{row.displayName}</span>
                   </div>
                </td>
                <td className="px-8 py-4 text-right">
                  <span className="font-mono font-bold text-editorial-accent">
                    {row.points}
                  </span>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

