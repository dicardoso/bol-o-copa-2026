import { motion, AnimatePresence } from 'motion/react';
import { Coins, Flame, Info, ChevronRight, Zap, Target, Star, Loader2 } from 'lucide-react';
import { NoseCoin } from '../components/NoseCoin';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import { useState, useEffect } from 'react';
import { bettingService, ManuBet as ManuBetType, UserManuBet } from '../services/bettingService';
import { soccerService, Match } from '../services/soccerService';
import { CountdownTimer } from '../components/CountdownTimer';

export const ManuBet = () => {
  const { profile, user } = useAuth();
  const [selectedBet, setSelectedBet] = useState<any>(null);
  const [activeBets, setActiveBets] = useState<ManuBetType[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [userPlacements, setUserPlacements] = useState<UserManuBet[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [betAmount, setBetAmount] = useState<number>(0);
  const [placing, setPlacing] = useState(false);

  const loadData = async () => {
    try {
      const [active, allMatches] = await Promise.all([
        bettingService.getActiveManuBets(),
        soccerService.getLocalMatches()
      ]);
      setActiveBets(active);
      setMatches(allMatches);
      if (user) {
        const placements = await bettingService.getUserPlacements(user.uid);
        setUserPlacements(placements);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const isExpired = (matchId: string) => {
    const match = matches.find(m => m.id === matchId);
    if (!match) return false;
    return new Date(match.date) <= new Date();
  };

  const getUserBetForOffer = (offerId: string) => {
    return userPlacements.find(p => p.manuBetId === offerId && p.status === 'pending');
  };

  const handlePlaceBet = async () => {
    if (!user || !selectedBet || betAmount <= 0) return;

    if (isExpired(selectedBet.matchId)) {
      alert("Esta aposta já foi encerrada pois o jogo começou.");
      setSelectedBet(null);
      return;
    }

    const existingBet = getUserBetForOffer(selectedBet.id);
    if (existingBet) {
      alert(`Você já possui uma aposta ativa de ${existingBet.amount} NC em "${existingBet.optionLabel}". Cancele-a antes de mudar sua escolha.`);
      return;
    }

    if (betAmount > (profile?.noseCoins || 0)) {
      alert("Saldo insuficiente em NoseCoins!");
      return;
    }

    setPlacing(true);
    try {
      await bettingService.placeManuBet(user.uid, selectedBet, selectedBet.selected.label, betAmount);
      alert("Aposta realizada com sucesso!");
      setSelectedBet(null);
      setBetAmount(0);
      loadData();
    } catch (err) {
      console.error(err);
      alert("Erro ao processar aposta.");
    } finally {
      setPlacing(false);
    }
  };

  const handleCancelBet = async (userBetId: string) => {
    if (!user) {
      console.log("Cancelamento abortado: usuário não logado");
      return;
    }

    if (!userBetId) {
      console.error("Cancelamento abortado: userBetId indefinido");
      return;
    }

    console.log("Iniciando cancelamento da aposta:", userBetId, "para usuário:", user.uid);

    try {
      setCancellingId(userBetId);
      await bettingService.cancelUserManuBet(user.uid, userBetId);
      console.log("Sucesso no cancelamento via service");
      alert("Aposta cancelada e valor estornado!");
      await loadData();
    } catch (err: any) {
      console.error("Erro detectado no catch de handleCancelBet:", err);
      // Tentar parsear se for JSON de erro do nosso handler
      let displayMsg = "Erro ao cancelar aposta.";
      try {
        if (typeof err.message === 'string' && err.message.startsWith('{')) {
          const parsed = JSON.parse(err.message);
          displayMsg = `${parsed.error} (${parsed.operationType} @ ${parsed.path})`;
        } else {
          displayMsg = err.message || displayMsg;
        }
      } catch (e) {
        displayMsg = err.message || displayMsg;
      }
      alert(displayMsg);
    } finally {
      setCancellingId(null);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-white">Carregando ofertas...</div>;

  return (
    <div className="space-y-8 pb-20">
      <header className="relative bg-gradient-to-br from-editorial-navy to-black p-8 rounded-[32px] border border-white/5 overflow-hidden">
        <div className="absolute top-0 right-0 p-8 rotate-12 opacity-20">
          <NoseCoin size={250} />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-full bg-editorial-gold flex items-center justify-center font-black text-editorial-navy text-xs">N</div>
            <h2 className="text-xl font-bold text-editorial-gold tracking-[2px] uppercase">ManuBet</h2>
          </div>

          <span className="section-title !text-editorial-gold/60">Apostas Rápidas</span>
          <h1 className="text-4xl font-black text-white italic tracking-tighter mb-4">LIVE CASINO</h1>

          <div className="mt-8 flex flex-col md:flex-row items-center gap-4">
            <div className="bg-editorial-gold/10 backdrop-blur-md px-6 py-4 rounded-2xl flex flex-col border border-editorial-gold/20 w-full md:w-auto">
              <span className="text-[10px] font-black text-editorial-gold/60 uppercase tracking-widest mb-1">Seu Saldo Atual</span>
              <div className="flex items-center gap-2">
                <NoseCoin size={24} />
                <span className="text-2xl font-black text-editorial-gold">{profile?.noseCoins?.toLocaleString() || 0} NC</span>
              </div>
            </div>
            <div className="text-xs text-white/30 italic max-w-[200px]">
              Jogue com responsabilidade. Admin Mode Active.
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {activeBets.map((bet, i) => (
          <motion.div
            key={bet.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-gradient-to-b from-editorial-navy/40 to-black/40 border border-white/5 rounded-3xl p-6 hover:border-editorial-gold transition-all flex flex-col gap-4 group relative"
          >
            <div className="flex items-center justify-between gap-4">
              {matches.find(m => m.id === bet.matchId) && (
                <div className="flex flex-col gap-1">
                  <CountdownTimer targetDate={matches.find(m => m.id === bet.matchId)!.date} />
                </div>
              )}
              <div className="bg-red-600 text-white text-[9px] font-black px-2 py-0.5 rounded uppercase">LIVE</div>
            </div>

            <div>
              <h3 className="text-lg font-bold text-white group-hover:text-editorial-gold transition-colors">{bet.title}</h3>
              <p className="text-xs text-white/40 uppercase font-bold">{bet.description}</p>
            </div>

            <div className="space-y-3 mt-2">
              {bet.options.map((opt, j) => {
                const userChoice = getUserBetForOffer(bet.id!);
                const isThisChoice = userChoice?.optionLabel === opt.label;

                return (
                  <button
                    key={j}
                    onClick={() => !isExpired(bet.matchId) && setSelectedBet({ ...bet, selected: opt })}
                    disabled={isExpired(bet.matchId)}
                    className={cn(
                      "w-full flex items-center justify-between p-4 border rounded-xl transition-all relative overflow-hidden",
                      isExpired(bet.matchId) ? "bg-slate-900/40 border-slate-800 opacity-50 cursor-not-allowed" :
                        isThisChoice ? "bg-editorial-gold/20 border-editorial-gold" : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-editorial-gold"
                    )}
                  >
                    <div className="flex flex-col items-start">
                      <span className={cn("font-bold text-sm", isThisChoice ? "text-editorial-gold" : "text-white/60")}>{opt.label}</span>
                      {isThisChoice && (
                        <span className="text-[8px] font-black uppercase text-editorial-gold bg-editorial-gold/10 px-2 rounded-full border border-editorial-gold/20">
                          VOCÊ APOSTOU • {userChoice.amount} NC
                        </span>
                      )}
                    </div>
                    <span className="font-mono font-black text-editorial-gold text-lg">
                      {bettingService.calculateCurrentOdds(bet, opt.label).toFixed(2)}
                    </span>
                  </button>
                );
              })}

              {getUserBetForOffer(bet.id!) && !isExpired(bet.matchId) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCancelBet(getUserBetForOffer(bet.id!)!.id!);
                  }}
                  disabled={!!cancellingId}
                  className="w-full py-2 text-[10px] font-black text-red-500 hover:text-red-400 bg-red-500/5 hover:bg-red-500/10 rounded-lg transition-all border border-red-500/20 uppercase flex items-center justify-center gap-2"
                >
                  {cancellingId === getUserBetForOffer(bet.id!)?.id ? <Loader2 size={12} className="animate-spin" /> : 'CANCELAR APOSTA ATUAL'}
                </button>
              )}
            </div>
          </motion.div>
        ))}
        {activeBets.length === 0 && (
          <div className="col-span-full p-12 text-center text-white/20 italic bg-white/5 rounded-3xl border border-dashed border-white/10">
            Aguardando novas ofertas do Admin...
          </div>
        )}
      </div>

      <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 p-8 rounded-3xl">
        <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-500 fill-yellow-500" /> Minhas Apostas
        </h3>
        <div className="space-y-4">
          {userPlacements.map((placement, k) => {
            const matchOpen = !isExpired(placement.matchId);
            return (
              <div key={placement.id} className="flex items-center justify-between p-4 bg-slate-800/50 rounded-2xl border border-slate-800">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-slate-700 rounded-xl flex items-center justify-center font-bold text-white text-xs">#{k + 1}</div>
                  <div>
                    <p className="font-bold text-white">{placement.optionLabel}</p>
                    <p className="text-xs text-slate-500 font-bold uppercase">
                      {new Date(placement.createdAt).toLocaleDateString()} • {placement.amount} NC • Odds {placement.oddsAtTime}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <p className={cn(
                    "font-black text-sm uppercase",
                    placement.status === 'won' ? "text-green-500" :
                      placement.status === 'lost' ? "text-red-500" : "text-yellow-500"
                  )}>
                    {placement.status === 'won' ? `+${Math.floor(placement.amount * placement.oddsAtTime)} NC` :
                      placement.status === 'lost' ? `-${placement.amount} NC` : 'PENDENTE'}
                  </p>
                  {placement.status === 'pending' && matchOpen && (
                    <button
                      onClick={() => handleCancelBet(placement.id!)}
                      disabled={!!cancellingId}
                      className="text-[9px] font-black text-white/30 hover:text-red-500 transition-colors uppercase border border-white/10 px-2 py-1 rounded-md flex items-center gap-1"
                    >
                      {cancellingId === placement.id ? <Loader2 size={10} className="animate-spin" /> : 'Cancelar'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {userPlacements.length === 0 && (
            <p className="text-white/20 italic text-center py-4">Você ainda não realizou nenhuma aposta rápida.</p>
          )}
        </div>
      </div>

      {/* Bet Modal */}
      <AnimatePresence>
        {selectedBet && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedBet(null)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-slate-900 border border-white/10 rounded-[40px] p-8 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-black text-white italic">FAZER APOSTA</h3>
                <button onClick={() => setSelectedBet(null)} className="text-slate-500 p-2 hover:text-white transition-colors"><Zap /></button>
              </div>

              <div className="space-y-6">
                <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="text-xl font-bold text-white">{selectedBet.title}</h4>
                    {matches.find(m => m.id === selectedBet.matchId) && (
                      <CountdownTimer targetDate={matches.find(m => m.id === selectedBet.matchId)!.date} />
                    )}
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="px-4 py-1 bg-indigo-600 rounded-full text-xs font-bold text-white uppercase">{selectedBet.selected.label}</span>
                    <span className="text-3xl font-black text-yellow-500">x{bettingService.calculateCurrentOdds(selectedBet, selectedBet.selected.label).toFixed(2)}</span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">Valor da Aposta</label>
                  <div className="relative mt-2">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2"><NoseCoin size={24} /></div>
                    <input
                      type="number"
                      value={betAmount || ''}
                      onChange={(e) => setBetAmount(parseInt(e.target.value) || 0)}
                      className="w-full bg-slate-950 border-2 border-slate-800 rounded-2xl py-4 pl-14 pr-4 text-2xl font-black text-white focus:border-yellow-500 outline-none transition-colors"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Ganhos em Potencial</p>
                    <p className="text-xl font-black text-green-500">
                      {Math.floor(betAmount * bettingService.calculateCurrentOdds(selectedBet, selectedBet.selected.label)).toLocaleString()} NC
                    </p>
                  </div>
                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Novo Saldo</p>
                    <p className="text-xl font-black text-white">
                      {((profile?.noseCoins || 0) - betAmount).toLocaleString()} NC
                    </p>
                  </div>
                </div>

                <button
                  onClick={handlePlaceBet}
                  disabled={placing || betAmount <= 0 || isExpired(selectedBet.matchId) || !!getUserBetForOffer(selectedBet.id)}
                  className="w-full bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-black py-4 rounded-2xl shadow-xl shadow-yellow-500/20 transition-all active:scale-95 uppercase tracking-widest text-lg disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {placing ? <Loader2 className="animate-spin" /> :
                    isExpired(selectedBet.matchId) ? 'Encerrado' :
                      !!getUserBetForOffer(selectedBet.id) ? 'Aposta Já Realizada' : 'Confirmar Aposta'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

