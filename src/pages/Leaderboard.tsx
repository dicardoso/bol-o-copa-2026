import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { TrendingUp, TrendingDown, Minus, History, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { collection, query, orderBy, limit, getDocs, getCountFromServer, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { BumpChart, PointsChart, PLAYER_COLORS, WINDOW, type Snapshot } from '../components/RankingCharts';

const POINTS_CHART_PLAYERS = 10;

export const Leaderboard = () => {
  const { user, profile } = useAuth();
  const [tab, setTab] = useState<'geral' | 'evolucao'>('geral');
  const [ranking, setRanking] = useState<any[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [tableEnd, setTableEnd] = useState(0);
  const tableStart = Math.max(0, tableEnd - WINDOW);
  const visibleCols = snapshots.slice(tableStart, tableEnd);

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

        if (user) {
          const myEntry = data.find(r => r.id === user.uid);
          if (myEntry) {
            setMyRank(myEntry.pos);
          } else {
            const userPoints = profile?.points || 0;
            const countQ = query(collection(db, 'users'), where('points', '>', userPoints));
            const countSnapshot = await getCountFromServer(countQ);
            setMyRank(countSnapshot.data().count + 1);
          }
        }

        const histQ = query(collection(db, 'rankingHistory'), orderBy('resolvedAt', 'asc'));
        const histSnap = await getDocs(histQ);
        const loaded = histSnap.docs.map(d => d.data() as Snapshot);
        setSnapshots(loaded);
        setTableEnd(loaded.length);
      } catch (err) {
        console.error('Erro ao buscar ranking:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchRanking();
  }, [user, profile]);

  const positionDelta = (userId: string): number | null => {
    if (snapshots.length < 2) return null;
    const prev = snapshots[snapshots.length - 2].entries.find(e => e.userId === userId);
    const curr = snapshots[snapshots.length - 1].entries.find(e => e.userId === userId);
    if (!prev || !curr) return null;
    return prev.position - curr.position;
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-white">Calculando ranking...</div>;

  return (
    <div className="space-y-8 pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-4 border-b border-white/5">
        <div>
          <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Ranking Global</h2>
        </div>
        <div className="flex bg-white/5 p-1 rounded-xl">
          {[
            { id: 'geral', label: 'Geral' },
            { id: 'evolucao', label: 'Evolução' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setTab(f.id as any)}
              className={cn(
                'px-6 py-2 rounded-lg text-xs font-black transition-all uppercase tracking-widest',
                tab === f.id ? 'bg-editorial-gold text-editorial-navy' : 'text-white/60 hover:text-white'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </header>

      {/* ── ABA GERAL ── */}
      {tab === 'geral' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="sidebar-card col-span-1 md:col-span-2">
              <span className="section-title">Top 3 Players</span>
              <div className="flex items-center justify-around py-4">
                {ranking.slice(0, 3).map((item) => (
                  <div key={item.pos} className="flex flex-col items-center">
                    <div className="relative">
                      <div className={cn(
                        'w-16 h-16 rounded-full flex items-center justify-center text-3xl border-4 mb-2 overflow-hidden',
                        item.pos === 1 ? 'border-editorial-gold bg-editorial-gold/10' :
                          item.pos === 2 ? 'border-slate-300 bg-slate-300/10' : 'border-amber-600 bg-amber-600/10'
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
                  <th className="px-4 sm:px-8 py-3 sm:py-4 text-[10px] font-black text-white/40 uppercase tracking-widest">Pos</th>
                  <th className="px-2 sm:px-4 py-3 sm:py-4 text-[10px] font-black text-white/40 uppercase tracking-widest"></th>
                  <th className="px-3 sm:px-8 py-3 sm:py-4 text-[10px] font-black text-white/40 uppercase tracking-widest">Player</th>
                  <th className="px-3 sm:px-8 py-3 sm:py-4 text-[10px] font-black text-white/40 uppercase tracking-widest text-right">Pts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {ranking.map((row, i) => {
                  const delta = positionDelta(row.id);
                  return (
                    <motion.tr
                      key={row.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.05 }}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-4 sm:px-8 py-3 sm:py-4 font-black">
                        <span className={cn(row.pos <= 3 ? 'text-editorial-gold' : 'text-white/20')}>
                          {row.pos.toString().padStart(2, '0')}
                        </span>
                      </td>
                      <td className="px-2 sm:px-4 py-3 sm:py-4">
                        {delta === null ? (
                          <Minus size={12} className="text-white/20" />
                        ) : delta > 0 ? (
                          <span className="flex items-center gap-0.5 text-green-400 text-[10px] font-black">
                            <TrendingUp size={12} /> <span className="hidden sm:inline">+{delta}</span>
                          </span>
                        ) : delta < 0 ? (
                          <span className="flex items-center gap-0.5 text-red-400 text-[10px] font-black">
                            <TrendingDown size={12} /> <span className="hidden sm:inline">{delta}</span>
                          </span>
                        ) : (
                          <Minus size={12} className="text-white/40" />
                        )}
                      </td>
                      <td className="px-3 sm:px-8 py-3 sm:py-4">
                        <div className="flex items-center gap-2 sm:gap-4">
                          <div className="w-7 h-7 sm:w-8 sm:h-8 bg-white/5 rounded-full flex items-center justify-center text-sm overflow-hidden shrink-0">
                            {row.photoURL ? <img src={row.photoURL} className="w-full h-full object-cover" /> : '👤'}
                          </div>
                          <span className="font-bold text-xs sm:text-sm truncate max-w-[100px] sm:max-w-none">{row.displayName}</span>
                        </div>
                      </td>
                      <td className="px-3 sm:px-8 py-3 sm:py-4 text-right">
                        <span className="font-mono font-bold text-sm text-editorial-accent">{row.points}</span>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── ABA EVOLUÇÃO ── */}
      {tab === 'evolucao' && (
        <div className="space-y-6">
          {snapshots.length === 0 ? (
            <div className="text-center py-20 text-white/40">
              <History size={40} className="mx-auto mb-4 opacity-30" />
              <p className="font-bold uppercase tracking-widest text-sm">Nenhum histórico ainda</p>
              <p className="text-xs mt-2">O histórico é gerado automaticamente quando um jogo é encerrado pelo admin.</p>
            </div>
          ) : (
            <>
              {/* Legenda compartilhada */}
              <div className="flex flex-wrap gap-2 sm:gap-3 px-1">
                {ranking.slice(0, 10).map((p, i) => (
                  <span key={p.id} className="flex items-center gap-1 text-[10px] font-bold">
                    <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ background: PLAYER_COLORS[i] }} />
                    <span style={{ color: PLAYER_COLORS[i] }}>{p.displayName.split(' ')[0]}</span>
                  </span>
                ))}
              </div>

              {/* Gráficos lado a lado */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-editorial-navy/40 border border-white/5 rounded-[24px] p-4 sm:p-6">
                  <h3 className="text-xs font-black text-white/40 uppercase tracking-widest mb-4">Posições</h3>
                  <BumpChart snapshots={snapshots} players={ranking.slice(0, 10)} />
                </div>
                <div className="bg-editorial-navy/40 border border-white/5 rounded-[24px] p-4 sm:p-6">
                  <h3 className="text-xs font-black text-white/40 uppercase tracking-widest mb-4">Pontos Acumulados</h3>
                  <PointsChart snapshots={snapshots} players={ranking.slice(0, POINTS_CHART_PLAYERS)} />
                </div>
              </div>

              {/* Tabela por jogo */}
              <div className="bg-editorial-navy/40 border border-white/5 rounded-[24px] overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-white/5">
                      <th className="px-3 sm:px-6 py-3 sm:py-4 text-[10px] font-black text-white/40 uppercase tracking-widest">Player</th>
                      {visibleCols.map(s => (
                        <th key={s.matchId} className="px-2 sm:px-4 py-3 sm:py-4 text-[10px] font-black text-white/40 uppercase tracking-widest text-center whitespace-nowrap">
                          <span className="sm:hidden">{s.matchLabel.length > 8 ? s.matchLabel.slice(0, 7) + '…' : s.matchLabel}</span>
                          <span className="hidden sm:inline">{s.matchLabel}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {ranking.slice(0, 20).map((player, i) => (
                      <motion.tr
                        key={player.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.03 }}
                        className="hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="px-3 sm:px-6 py-2 sm:py-3">
                          <div className="flex items-center gap-2 sm:gap-3">
                            <span className="text-white/20 font-black text-xs w-4 shrink-0">{player.pos}</span>
                            <div className="w-5 h-5 sm:w-6 sm:h-6 bg-white/5 rounded-full overflow-hidden shrink-0">
                              {player.photoURL ? <img src={player.photoURL} className="w-full h-full object-cover" /> : null}
                            </div>
                            <span className="font-bold text-xs truncate max-w-[70px] sm:max-w-none">{player.displayName.split(' ')[0]}</span>
                          </div>
                        </td>
                        {visibleCols.map((s, vi) => {
                          const realIdx = tableStart + vi;
                          const entry = s.entries.find(e => e.userId === player.id);
                          const prev = realIdx > 0 ? snapshots[realIdx - 1].entries.find(e => e.userId === player.id) : null;
                          const gained = entry && prev ? entry.points - prev.points : null;
                          return (
                            <td key={s.matchId} className="px-2 sm:px-4 py-2 sm:py-3 text-center">
                              <span className="font-mono font-bold text-xs text-white/70">{entry?.points ?? '—'}</span>
                              {gained !== null && gained > 0 && (
                                <span className="block text-[9px] text-green-400 font-black">+{gained}</span>
                              )}
                              {entry && (
                                <span className="block text-[9px] text-white/30 hidden sm:block">#{entry.position}</span>
                              )}
                            </td>
                          );
                        })}
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
                {snapshots.length > WINDOW && (
                  <div className="flex items-center justify-center gap-4 py-4 border-t border-white/5">
                    <button
                      onClick={() => setTableEnd(e => Math.max(WINDOW, e - 1))}
                      disabled={tableStart === 0}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft size={16} className="text-white/60" />
                    </button>
                    <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">
                      {tableStart + 1}–{tableEnd} / {snapshots.length}
                    </span>
                    <button
                      onClick={() => setTableEnd(e => Math.min(snapshots.length, e + 1))}
                      disabled={tableEnd === snapshots.length}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRight size={16} className="text-white/60" />
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
