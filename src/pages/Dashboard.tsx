import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Trophy, Clock, Zap, TrendingUp, Coins } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { NoseCoin } from '../components/NoseCoin';
import { cn } from '../lib/utils';
import { soccerService } from '../services/soccerService';
import { bettingService } from '../services/bettingService';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

export const Dashboard = ({ setActiveTab }: { setActiveTab: (tab: string) => void }) => {
  const { profile } = useAuth();
  const [nextGames, setNextGames] = useState<any[]>([]);
  const [topPlayers, setTopPlayers] = useState<any[]>([]);
  const [featuredManuBet, setFeaturedManuBet] = useState<any>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [matches, activeManu] = await Promise.all([
          soccerService.getLocalMatches(),
          bettingService.getActiveManuBets()
        ]);
        
        setNextGames(matches.filter((m: any) => !m.finished).slice(0, 3));
        
        if (activeManu && activeManu.length > 0) {
          setFeaturedManuBet(activeManu[0]);
        }

        const q = query(collection(db, 'users'), orderBy('points', 'desc'), limit(3));
        const rankSnap = await getDocs(q);
        setTopPlayers(rankSnap.docs.map(doc => doc.data()));
      } catch (err) {
        console.error(err);
      }
    };
    loadData();
  }, []);

  return (
    <div className="space-y-8 pb-20">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 pb-4 border-b border-white/5">
        <div>
          <span className="section-title !mb-1">Visão Geral</span>
          <h2 className="text-3xl font-black tracking-tighter text-white uppercase">Olá, {profile?.displayName?.split(' ')[0]}</h2>
        </div>
        <div className="flex gap-4">
          <div className="bg-white/5 px-6 py-2 rounded-full border border-white/10 flex items-center gap-3">
             <NoseCoin size={20} />
             <span className="font-mono font-black text-editorial-gold">{profile?.noseCoins?.toLocaleString() || 0} NC</span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Stats Sidebar */}
        <div className="lg:col-span-3 space-y-6">
          <div className="sidebar-card">
            <span className="section-title">Minha Performance</span>
            <div className="space-y-4">
               <div className="flex justify-between items-end">
                  <span className="text-sm text-white/60">Pontos</span>
                  <span className="text-xl font-bold">{profile?.points || 0}</span>
               </div>
               <div className="flex justify-between items-center pt-2">
                  <span className="text-sm text-white/60">Saldo NC</span>
                  <span className="text-sm font-black text-editorial-gold">{profile?.noseCoins?.toLocaleString()}</span>
               </div>
            </div>
          </div>

          <div className="sidebar-card">
            <span className="section-title">Top 3 Global</span>
            <div className="space-y-3">
               {topPlayers.map((player, pos) => (
                 <div key={player.uid} className="flex items-center gap-3">
                    <span className="text-xs font-black text-editorial-gold">{(pos+1).toString().padStart(2, '0')}</span>
                    <div className="w-8 h-8 bg-white/5 rounded-full overflow-hidden">
                       {player.photoURL ? <img src={player.photoURL} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-editorial-navy" />}
                    </div>
                    <span className="text-xs font-bold text-white/80 truncate flex-1">{player.displayName}</span>
                    <span className="text-xs font-mono font-bold text-white/40">{player.points}</span>
                 </div>
               ))}
               {topPlayers.length === 0 && <p className="text-[10px] text-white/20 italic">Aguardando pontuação...</p>}
            </div>
            <button onClick={() => setActiveTab('leaderboard')} className="w-full text-center text-[10px] uppercase font-black text-white/20 mt-6 hover:text-editorial-gold transition-colors">Ver Ranking Completo</button>
          </div>
        </div>

        {/* Center Main Panel */}
        <div className="lg:col-span-6 space-y-6">
          <div className="flex items-center justify-between">
             <h3 className="text-xl font-black tracking-tight italic uppercase">Próximos Jogos</h3>
             <button onClick={() => setActiveTab('betting')} className="text-[10px] font-mono text-editorial-gold uppercase hover:underline">Ver Todos</button>
          </div>
          
          <div className="grid grid-cols-1 gap-4">
            {nextGames.map((game, i) => (
              <motion.div 
                key={game.id}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1 }}
                onClick={() => setActiveTab('betting')}
                className="bg-white text-editorial-navy rounded-3xl p-6 relative overflow-hidden group shadow-xl hover:-translate-y-1 transition-all cursor-pointer border border-transparent hover:border-editorial-gold/20"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-green-500" />
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 flex flex-col items-center">
                    <div className="w-12 h-12 mb-1 flex items-center justify-center overflow-hidden">
                       {game.flagA?.startsWith('http') ? (
                         <img src={game.flagA} alt={game.teamA} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                       ) : (
                         <span className="text-3xl">{game.flagA}</span>
                       )}
                    </div>
                    <span className="font-black text-[10px] uppercase text-center leading-tight">{game.teamA}</span>
                  </div>
                  <div className="flex-1 flex flex-col items-center border-x border-slate-100">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">{new Date(game.date).toLocaleDateString()}</span>
                    <div className="bg-slate-950 text-white px-2 py-0.5 rounded-md text-[10px] font-black italic">VS</div>
                  </div>
                  <div className="flex-1 flex flex-col items-center">
                    <div className="w-12 h-12 mb-1 flex items-center justify-center overflow-hidden">
                       {game.flagB?.startsWith('http') ? (
                         <img src={game.flagB} alt={game.teamB} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                       ) : (
                         <span className="text-3xl">{game.flagB}</span>
                       )}
                    </div>
                    <span className="font-black text-[10px] uppercase text-center leading-tight">{game.teamB}</span>
                  </div>
                </div>
              </motion.div>
            ))}
            {nextGames.length === 0 && (
              <div className="p-8 text-center bg-white/5 rounded-3xl border border-white/5 italic text-white/40">
                Nenhum jogo disponível no momento.
              </div>
            )}
          </div>
        </div>

        {/* Right ManuBet Sidebar */}
        <div className="lg:col-span-3 space-y-6">
           <div className="bg-gradient-to-br from-editorial-navy to-black border-2 border-white/5 rounded-[24px] p-6 relative overflow-hidden group">
              <div className="flex items-center gap-3 mb-6">
                 <div className="w-8 h-8 rounded-full bg-editorial-gold flex items-center justify-center font-black text-editorial-navy text-xs">N</div>
                 <h2 className="text-lg font-bold text-editorial-gold tracking-[1px] uppercase italic">ManuBet</h2>
              </div>
              
              {featuredManuBet ? (
                <>
                  <span className="section-title !text-editorial-gold/60">{featuredManuBet.title}</span>
                  
                  <div className="space-y-2 mt-4">
                     {featuredManuBet.options.slice(0, 3).map((opt: any, idx: number) => (
                       <div 
                        key={idx} 
                        onClick={() => setActiveTab('manubet')}
                        className="flex justify-between items-center p-3 bg-white/5 rounded-xl border border-white/5 hover:border-editorial-gold cursor-pointer transition-all"
                       >
                          <span className="text-xs font-bold text-white/80">{opt.label}</span>
                          <span className="text-sm font-black text-editorial-gold">
                            {bettingService.calculateCurrentOdds(featuredManuBet, opt.label).toFixed(2)}
                          </span>
                       </div>
                     ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-8 opacity-20">
                  <Coins className="w-12 h-12 mx-auto mb-4" />
                  <p className="text-[10px] font-black uppercase tracking-widest">Nenhuma oferta ativa</p>
                </div>
              )}

              <div className="mt-8 pt-6 border-t border-white/10 text-center">
                 <button 
                  onClick={() => setActiveTab('manubet')}
                  className="w-full bg-editorial-gold text-editorial-navy font-black py-3 rounded-xl uppercase text-[10px] tracking-widest shadow-lg shadow-editorial-gold/10"
                 >
                   {featuredManuBet ? 'Apostar Agora' : 'Ver Todas'}
                 </button>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

