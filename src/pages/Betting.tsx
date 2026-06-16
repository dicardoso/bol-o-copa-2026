import { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { Sword, Save, Trash2, Clock, MapPin, CheckCircle2, EyeOff, Eye, Users, X, Trophy } from 'lucide-react';
import { cn } from '../lib/utils';
import { soccerService } from '../services/soccerService';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { doc, setDoc, getDocs, getDoc, collection, query, where } from 'firebase/firestore';

import { CountdownTimer } from '../components/CountdownTimer';

export const Betting = () => {
  const { user } = useAuth();
  const [activeRound, setActiveRound] = useState<number | string | 'all'>(1);
  const [matches, setMatches] = useState<any[]>([]);
  const [userBets, setUserBets] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [hideFinished, setHideFinished] = useState(true);
  const [betsModal, setBetsModal] = useState<{
    isOpen: boolean;
    match: any | null;
    bets: { userId: string; displayName: string; photoURL: string; predictedScoreA: number; predictedScoreB: number; pointsEarned?: number }[];
    loading: boolean;
  }>({ isOpen: false, match: null, bets: [], loading: false });
  const [, setTick] = useState(0);
  const forceUpdate = useCallback(() => setTick(t => t + 1), []);

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
    let score = parseInt(value) || 0;
    if (score > 99) score = 99;
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

  const isMatchLocked = (match: any): boolean =>
    match.finished || new Date() >= new Date(match.date);

  const canViewBets = (match: any) => isMatchLocked(match);

  const openBetsModal = async (match: any) => {
    const matchId = match.id;
    setBetsModal({ isOpen: true, match, bets: [], loading: true });
    try {
      const betsSnap = await getDocs(query(collection(db, 'bets'), where('matchId', '==', matchId)));
      const entries = await Promise.all(
        betsSnap.docs.map(async (betDoc) => {
          const bet = betDoc.data();
          const userSnap = await getDoc(doc(db, 'users', bet.userId));
          const u = userSnap.data();
          return {
            userId: bet.userId,
            displayName: u?.displayName || 'Usuário',
            photoURL: u?.photoURL || '',
            predictedScoreA: bet.predictedScoreA ?? 0,
            predictedScoreB: bet.predictedScoreB ?? 0,
            pointsEarned: bet.pointsEarned,
          };
        })
      );
      const sorted = match.finished
        ? entries.sort((a, b) => (b.pointsEarned ?? 0) - (a.pointsEarned ?? 0))
        : entries.sort((a, b) => a.displayName.localeCompare(b.displayName));
      setBetsModal(prev => {
        if (prev.match?.id !== matchId) return prev;
        return { ...prev, bets: sorted, loading: false };
      });
    } catch (err) {
      console.error(err);
      setBetsModal(prev => {
        if (prev.match?.id !== matchId) return prev;
        return { ...prev, loading: false };
      });
    }
  };

  const saveBet = async (matchId: string) => {
    if (!user) return;
    const match = matches.find(m => m.id === matchId);
    if (match && isMatchLocked(match)) {
      alert('O jogo já começou. Palpites encerrados.');
      return;
    }
    const bet = userBets[matchId];
    if (!bet || bet.predictedScoreA === undefined || bet.predictedScoreB === undefined) {
      alert('Preencha os dois placares!');
      return;
    }

    setSaving(matchId);
    try {
      const now = new Date().toISOString();
      const betData = {
        ...bet,
        updatedAt: now,
        createdAt: bet.createdAt || now,
      };
      const betId = `${user.uid}_${matchId}`;
      await setDoc(doc(db, 'bets', betId), betData, { merge: true });
      setUserBets(prev => ({ ...prev, [matchId]: betData }));
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar palpite. Verifique se o jogo já começou.');
    } finally {
      setSaving(null);
    }
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const visibleMatches = hideFinished
    ? matches.filter(m => {
      const matchDay = new Date(m.date);
      matchDay.setHours(0, 0, 0, 0);
      return !m.finished || matchDay >= today;
    })
    : matches;

  const hiddenCount = matches.length - visibleMatches.length;

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
          <button
            onClick={() => setHideFinished(h => !h)}
            className="mt-2 flex items-center gap-2 text-xs font-bold text-white/40 hover:text-white/70 transition-colors uppercase tracking-widest"
          >
            {hideFinished ? <Eye size={14} /> : <EyeOff size={14} />}
            {hideFinished
              ? hiddenCount > 0
                ? `${hiddenCount} encerrado${hiddenCount !== 1 ? 's' : ''} oculto${hiddenCount !== 1 ? 's' : ''} — mostrar`
                : 'Encerrados ocultos'
              : 'Ocultar encerrados'}
          </button>
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
        <CountdownTimer targetDate="2026-06-22T14:00:00Z" />
      </div>

      <div className="flex flex-col gap-8 max-w-4xl mx-auto">
        {visibleMatches.map((match, i) => (
          <motion.div
            key={match.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="match-card bg-white text-editorial-navy rounded-[24px] p-4 sm:p-8 relative overflow-hidden shadow-2xl flex flex-col items-center"
          >
            {/* Top gradient line */}
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-600 to-green-500" />

            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-[2px] mb-4">
              {match.stage?.toUpperCase() || 'GRUPO A'} • {match.venue.toUpperCase()} • {new Date(match.date).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })} • {new Date(match.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}
            </div>

            {!match.finished && (
              <div className="mb-6">
                <CountdownTimer
                  targetDate={match.date}
                  onExpire={forceUpdate}
                />
              </div>
            )}

            <div className="w-full flex items-center justify-between gap-4 md:gap-12">
              {/* Team A */}
              <div className="flex-1 flex flex-col items-center">
                <div className="w-14 h-14 sm:w-20 sm:h-20 bg-slate-100 rounded-full flex items-center justify-center text-2xl sm:text-4xl mb-3 sm:mb-4 shadow-lg border-4 border-white overflow-hidden p-2 sm:p-3">
                  {match.flagA?.startsWith('http') ? (
                    <img src={match.flagA} alt={match.teamA} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                  ) : (
                    match.flagA
                  )}
                </div>
                <h4 className="text-xs sm:text-lg font-black tracking-tighter uppercase text-center leading-tight">{match.teamA}</h4>
              </div>

              {/* Score Input */}
              <div className="flex items-center gap-2 sm:gap-4">
                <input
                  type="number"
                  min="0"
                  max="99"
                  className="w-12 h-12 sm:w-16 sm:h-16 bg-slate-100 border-2 border-slate-200 rounded-xl text-center text-2xl sm:text-3xl font-black focus:border-editorial-accent outline-none transition-all"
                  placeholder="0"
                  value={userBets[match.id]?.predictedScoreA ?? ''}
                  onChange={(e) => handleScoreChange(match.id, 'A', e.target.value)}
                  disabled={isMatchLocked(match)}
                />
                <span className="text-slate-300 font-light italic text-sm sm:text-base">VS</span>
                <input
                  type="number"
                  min="0"
                  max="99"
                  className="w-12 h-12 sm:w-16 sm:h-16 bg-slate-100 border-2 border-slate-200 rounded-xl text-center text-2xl sm:text-3xl font-black focus:border-editorial-accent outline-none transition-all"
                  placeholder="0"
                  value={userBets[match.id]?.predictedScoreB ?? ''}
                  onChange={(e) => handleScoreChange(match.id, 'B', e.target.value)}
                  disabled={isMatchLocked(match)}
                />
              </div>

              {/* Team B */}
              <div className="flex-1 flex flex-col items-center">
                <div className="w-14 h-14 sm:w-20 sm:h-20 bg-slate-100 rounded-full flex items-center justify-center text-2xl sm:text-4xl mb-3 sm:mb-4 shadow-lg border-4 border-white overflow-hidden p-2 sm:p-3">
                  {match.flagB?.startsWith('http') ? (
                    <img src={match.flagB} alt={match.teamB} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                  ) : (
                    match.flagB
                  )}
                </div>
                <h4 className="text-xs sm:text-lg font-black tracking-tighter uppercase text-center leading-tight">{match.teamB}</h4>
              </div>
            </div>

            <div className="w-full mt-8 pt-6 border-t border-slate-100 flex items-center justify-between flex-wrap gap-3">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-black block">Status do Jogo</span>
                <span className={cn("font-extrabold text-sm uppercase",
                  match.finished ? "text-red-500" :
                    isMatchLocked(match) ? "text-orange-500" :
                      "text-green-500"
                )}>
                  {match.finished
                    ? `Encerrado (${match.scoreA} x ${match.scoreB})`
                    : isMatchLocked(match)
                      ? 'Em andamento — palpites encerrados'
                      : 'Aberto para Palpites'}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {canViewBets(match) && (
                  <button
                    onClick={() => openBetsModal(match)}
                    className="flex items-center gap-2 text-editorial-navy font-bold text-xs uppercase bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-lg transition-colors"
                  >
                    <Users size={14} /> Ver palpites
                  </button>
                )}
                {!isMatchLocked(match) && (
                  <button
                    onClick={() => saveBet(match.id)}
                    disabled={saving === match.id}
                    className="bg-editorial-accent hover:bg-green-600 text-white font-black px-8 py-3 rounded-xl transition-all shadow-lg shadow-green-900/20 active:scale-95 uppercase text-xs tracking-widest disabled:opacity-50"
                  >
                    {userBets[match.id]?.updatedAt ? 'Atualizar' : 'Confirmar'}
                  </button>
                )}
                {isMatchLocked(match) && userBets[match.id] && (
                  <div className="flex items-center gap-2 text-editorial-navy font-bold text-xs uppercase bg-slate-100 px-4 py-2 rounded-lg">
                    <CheckCircle2 size={16} className="text-green-600" /> Palpite Registrado
                  </div>
                )}
              </div>
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

      {/* Bets Modal */}
      {betsModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-900 border border-slate-800 rounded-t-[32px] sm:rounded-[32px] w-full sm:max-w-lg max-h-[85vh] flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-800 flex items-start justify-between gap-4 shrink-0">
              <div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Palpites do Jogo</p>
                <h3 className="text-lg font-black text-white uppercase tracking-tight leading-tight">
                  {betsModal.match?.teamA} <span className="text-slate-500">×</span> {betsModal.match?.teamB}
                </h3>
                {betsModal.match?.finished && (
                  <p className="text-xs text-green-500 font-bold mt-1">
                    Resultado: {betsModal.match.scoreA} × {betsModal.match.scoreB}
                  </p>
                )}
              </div>
              <button
                onClick={() => setBetsModal({ isOpen: false, match: null, bets: [], loading: false })}
                className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors shrink-0"
              >
                <X size={20} />
              </button>
            </div>

            {/* List */}
            <div className="overflow-y-auto flex-1 p-4 space-y-2">
              {betsModal.loading ? (
                <div className="py-12 text-center text-slate-500 text-sm">Carregando palpites...</div>
              ) : betsModal.bets.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-sm italic">Nenhum palpite registrado ainda.</div>
              ) : (
                betsModal.bets.map((entry, i) => {
                  const isMe = entry.userId === user?.uid;
                  const isExact = betsModal.match?.finished &&
                    entry.predictedScoreA === betsModal.match.scoreA &&
                    entry.predictedScoreB === betsModal.match.scoreB;
                  const isCorrect = !isExact && betsModal.match?.finished && (entry.pointsEarned ?? 0) > 0;

                  return (
                    <div
                      key={entry.userId}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-2xl border transition-all",
                        isMe ? "border-yellow-500/40 bg-yellow-500/5" : "border-slate-800 bg-slate-800/30"
                      )}
                    >
                      {/* Rank (only when finished) */}
                      {betsModal.match?.finished && (
                        <span className="text-[10px] font-black text-slate-600 w-5 text-center shrink-0">
                          {i + 1}º
                        </span>
                      )}

                      {/* Avatar */}
                      <img
                        src={entry.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${entry.userId}`}
                        alt={entry.displayName}
                        className="w-9 h-9 rounded-full bg-slate-700 shrink-0 object-cover"
                        referrerPolicy="no-referrer"
                      />

                      {/* Name */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white truncate flex items-center gap-1.5">
                          {entry.displayName}
                          {isMe && (
                            <span className="text-[8px] bg-yellow-500 text-slate-900 px-1.5 py-0.5 rounded font-black uppercase">Você</span>
                          )}
                        </p>
                      </div>

                      {/* Predicted score */}
                      <div className={cn(
                        "px-3 py-1.5 rounded-xl font-black text-sm tracking-tight shrink-0",
                        isExact ? "bg-green-500 text-white" :
                          isCorrect ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" :
                            "bg-slate-800 text-slate-300"
                      )}>
                        {entry.predictedScoreA} × {entry.predictedScoreB}
                      </div>

                      {/* Points (only when finished) */}
                      {betsModal.match?.finished && (
                        <div className={cn(
                          "flex items-center gap-1 text-[11px] font-black shrink-0",
                          (entry.pointsEarned ?? 0) > 0 ? "text-yellow-400" : "text-slate-600"
                        )}>
                          <Trophy size={11} />
                          {entry.pointsEarned ?? 0}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer count */}
            {!betsModal.loading && betsModal.bets.length > 0 && (
              <div className="px-6 py-3 border-t border-slate-800 shrink-0">
                <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest text-center">
                  {betsModal.bets.length} palpite{betsModal.bets.length !== 1 ? 's' : ''} registrado{betsModal.bets.length !== 1 ? 's' : ''}
                </p>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
};
