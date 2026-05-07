import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Sword, Save, Trash2, Clock, MapPin, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { soccerService } from '../services/soccerService';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { doc, setDoc, getDocs, collection, query, where } from 'firebase/firestore';

export const Betting = () => {
  const { user } = useAuth();
  const [activeRound, setActiveRound] = useState<number | string | 'all'>(1);
  const [matches, setMatches] = useState<any[]>([]);
  const [userBets, setUserBets] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const matchesData = await soccerService.getLocalMatches();
        let filtered = matchesData;
        if (activeRound !== 'all') {
          if (typeof activeRound === 'number') {
            filtered = matchesData.filter((m: any) => m.round === activeRound);
          } else {
            // Map our UI tabs to common API stage names if needed
            const stageLower = (activeRound as string).toLowerCase();
            filtered = matchesData.filter((m: any) => {
              const matchStage = m.stage?.toLowerCase() || '';
              // Match our labels (like 'L16') or common names
              if (stageLower === 'l32') return matchStage.includes('32') || matchStage.includes('last_32');
              if (stageLower === 'l16') return matchStage.includes('16') || matchStage.includes('last_16') || matchStage.includes('round_of_16');
              if (stageLower === 'quarters_finals') return matchStage.includes('quarter') || matchStage === 'qf';
              if (stageLower === 'semi_finals') return (matchStage.includes('semi') || matchStage === 'sf') && !matchStage.includes('quarter');
              if (stageLower === 'finals') return (matchStage === 'final' || matchStage === 'finals' || matchStage.includes('third') || matchStage.includes('3rd')) && !matchStage.includes('semi') && !matchStage.includes('quarter');
              
              return matchStage === stageLower || m.round === activeRound;
            });
          }
        }
        setMatches(filtered);

        if (user) {
          const q = query(collection(db, 'bets'), where('userId', '==', user.uid));
          const betsSnap = await getDocs(q);
          const betsMap: Record<string, any> = {};
          betsSnap.docs.forEach(doc => {
            const data = doc.data();
            betsMap[data.matchId] = data;
          });
          setUserBets(betsMap);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [activeRound, user]);

  const handleScoreChange = (matchId: string, team: 'A' | 'B', value: string) => {
    const score = parseInt(value) || 0;
    setUserBets(prev => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        [`predictedScore${team}`]: score,
        matchId,
        userId: user?.uid
      }
    }));
  };

  const saveBet = async (matchId: string) => {
    if (!user) return;
    const bet = userBets[matchId];
    if (!bet || bet.predictedScoreA === undefined || bet.predictedScoreB === undefined) {
      alert('Preencha os dois placares!');
      return;
    }

    setSaving(matchId);
    try {
      const betId = `${user.uid}_${matchId}`;
      await setDoc(doc(db, 'bets', betId), {
        ...bet,
        updatedAt: new Date().toISOString(),
        createdAt: bet.createdAt || new Date().toISOString()
      }, { merge: true });
      alert('Palpite salvo com sucesso!');
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar palpite. Verifique se o jogo já começou.');
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-white">Carregando jogos...</div>;
  }

  return (
    <div className="space-y-8 pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-4 border-b border-white/5">
        <div>
          <h2 className="text-3xl font-black text-white uppercase tracking-tighter">
            {activeRound === 'all' ? 'Todos os Jogos' : 
             typeof activeRound === 'number' ? `Rodada ${activeRound}` : 
             activeRound.replace('_', ' ')} 
            <span className="text-white/40 font-medium text-lg ml-2">Copa 2026</span>
          </h2>
        </div>
        <div className="flex bg-white/5 p-1 rounded-xl overflow-x-auto gap-1">
          {[1, 2, 3, 'L32', 'L16', 'Quarters_finals', 'Semi_finals', 'Finals', 'all'].map((r) => (
            <button 
              key={r.toString()}
              onClick={() => setActiveRound(r as any)}
              className={cn(
                "px-4 py-2 rounded-lg text-[10px] font-black transition-all uppercase tracking-widest whitespace-nowrap",
                activeRound === r ? "bg-editorial-gold text-editorial-navy" : "text-white/60 hover:text-white"
              )}
            >
              {r === 'all' ? 'Ver Todos' : 
               r === 'L32' ? '1/16' :
               r === 'L16' ? '1/8' :
               r === 'Quarters_finals' ? 'Quartas' :
               r === 'Semi_finals' ? 'Semi' :
               r === 'Finals' ? 'Finais' :
               `R${r}`}
            </button>
          ))}
        </div>
      </header>

      {/* Countdown Warning */}
      <div className="flex items-center justify-center p-3 rounded-xl">
        <p className="text-xs font-mono font-bold text-editorial-gold uppercase tracking-[2px]">
          FECHA EM: 02d 14h 05m 33s
        </p>
      </div>

      <div className="flex flex-col gap-8 max-w-4xl mx-auto">
        {matches.map((match, i) => (
          <motion.div
            key={match.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="match-card bg-white text-editorial-navy rounded-[24px] p-8 relative overflow-hidden shadow-2xl flex flex-col items-center"
          >
            {/* Top gradient line */}
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-600 to-green-500" />
            
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-[2px] mb-8">
               {match.stage?.toUpperCase() || 'GRUPO A'} • {match.venue.toUpperCase()} • {new Date(match.date).toLocaleDateString()}
            </div>

            <div className="w-full flex items-center justify-between gap-4 md:gap-12">
              {/* Team A */}
              <div className="flex-1 flex flex-col items-center">
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-4xl mb-4 shadow-lg border-4 border-white overflow-hidden p-3">
                  {match.flagA?.startsWith('http') ? (
                    <img src={match.flagA} alt={match.teamA} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                  ) : (
                    match.flagA
                  )}
                </div>
                <h4 className="text-lg font-black tracking-tighter uppercase text-center">{match.teamA}</h4>
              </div>

              {/* Score Input */}
              <div className="flex items-center gap-4">
                <input 
                  type="number" 
                  min="0"
                  className="w-16 h-16 bg-slate-100 border-2 border-slate-200 rounded-xl text-center text-3xl font-black focus:border-editorial-accent outline-none transition-all"
                  placeholder="0"
                  value={userBets[match.id]?.predictedScoreA ?? ''}
                  onChange={(e) => handleScoreChange(match.id, 'A', e.target.value)}
                  disabled={match.finished}
                />
                <span className="text-slate-300 font-light italic">VS</span>
                <input 
                  type="number" 
                  min="0"
                  className="w-16 h-16 bg-slate-100 border-2 border-slate-200 rounded-xl text-center text-3xl font-black focus:border-editorial-accent outline-none transition-all"
                  placeholder="0"
                  value={userBets[match.id]?.predictedScoreB ?? ''}
                  onChange={(e) => handleScoreChange(match.id, 'B', e.target.value)}
                  disabled={match.finished}
                />
              </div>

              {/* Team B */}
              <div className="flex-1 flex flex-col items-center">
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-4xl mb-4 shadow-lg border-4 border-white overflow-hidden p-3">
                  {match.flagB?.startsWith('http') ? (
                    <img src={match.flagB} alt={match.teamB} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                  ) : (
                    match.flagB
                  )}
                </div>
                <h4 className="text-lg font-black tracking-tighter uppercase text-center">{match.teamB}</h4>
              </div>
            </div>

            <div className="w-full mt-8 pt-6 border-t border-slate-100 flex items-center justify-between">
               <div>
                  <span className="text-[10px] text-slate-400 uppercase font-black block">Status do Jogo</span>
                  <span className={cn("font-extrabold text-sm uppercase", match.finished ? "text-red-500" : "text-green-500")}>
                    {match.finished ? `Encerrado (${match.scoreA} x ${match.scoreB})` : 'Aberto para Palpites'}
                  </span>
               </div>
               {!match.finished && (
                 <button 
                  onClick={() => saveBet(match.id)}
                  disabled={saving === match.id}
                  className="bg-editorial-accent hover:bg-green-600 text-white font-black px-8 py-3 rounded-xl transition-all shadow-lg shadow-green-900/20 active:scale-95 uppercase text-xs tracking-widest disabled:opacity-50"
                 >
                    {userBets[match.id]?.updatedAt ? 'Atualizar' : 'Confirmar'}
                 </button>
               )}
               {match.finished && userBets[match.id] && (
                 <div className="flex items-center gap-2 text-editorial-navy font-bold text-xs uppercase bg-slate-100 px-4 py-2 rounded-lg">
                    <CheckCircle2 size={16} className="text-green-600" /> Palpite Registrado
                 </div>
               )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Info Footer */}
      <div className="max-w-4xl mx-auto mt-12 p-8 bg-editorial-navy/20 rounded-[32px] border border-white/5 text-center">
         <p className="text-white/40 text-xs font-bold uppercase tracking-[2px]">
            Lembre-se: Você pode alterar seus palpites até o início de cada partida.
         </p>
      </div>
    </div>
  );
};
