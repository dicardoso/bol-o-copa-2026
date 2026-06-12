import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { TrendingUp, TrendingDown, Minus, History } from 'lucide-react';
import { cn } from '../lib/utils';
import { collection, query, orderBy, limit, getDocs, getCountFromServer, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';

interface RankingEntry {
  userId: string;
  displayName: string;
  photoURL: string;
  points: number;
  position: number;
}

interface Snapshot {
  matchId: string;
  matchLabel: string;
  resolvedAt: string;
  entries: RankingEntry[];
}

const PLAYER_COLORS = ['#f59e0b','#3b82f6','#10b981','#f97316','#8b5cf6','#ec4899','#94a3b8','#14b8a6','#84cc16','#ef4444'];

interface BumpChartProps {
  snapshots: Snapshot[];
  players: { id: string; displayName: string }[];
}

const BumpChart = ({ snapshots, players }: BumpChartProps) => {
  if (snapshots.length < 2) return (
    <p className="text-white/30 text-xs text-center py-8">São necessários pelo menos 2 jogos resolvidos para exibir o gráfico.</p>
  );

  const W = 700, H = 320;
  const padL = 100, padR = 100, padT = 20, padB = 36;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const maxPos = Math.min(players.length, 10);

  const xOf = (si: number) => padL + (si / (snapshots.length - 1)) * chartW;
  const yOf = (pos: number) => padT + ((pos - 1) / (maxPos - 1)) * chartH;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 340 }}>
      {/* Grid lines */}
      {Array.from({ length: maxPos }, (_, i) => (
        <line key={i} x1={padL} x2={W - padR} y1={yOf(i + 1)} y2={yOf(i + 1)}
          stroke="white" strokeOpacity={0.04} strokeWidth={1} />
      ))}

      {/* Position labels left */}
      {Array.from({ length: maxPos }, (_, i) => (
        <text key={i} x={padL - 10} y={yOf(i + 1) + 4} textAnchor="end"
          fill="rgba(255,255,255,0.2)" fontSize={10} fontWeight="bold">
          #{i + 1}
        </text>
      ))}

      {/* Match labels bottom */}
      {snapshots.map((s, si) => (
        <text key={s.matchId} x={xOf(si)} y={H - 4} textAnchor="middle"
          fill="rgba(255,255,255,0.25)" fontSize={9}>
          {s.matchLabel.length > 12 ? s.matchLabel.slice(0, 11) + '…' : s.matchLabel}
        </text>
      ))}

      {/* Player lines */}
      {players.slice(0, 10).map((player, pi) => {
        const color = PLAYER_COLORS[pi];
        const positions = snapshots.map(s => {
          const e = s.entries.find(e => e.userId === player.id);
          return e ? Math.min(e.position, maxPos) : null;
        });

        // Build smooth bump path using cubic bezier
        const segments: string[] = [];
        for (let si = 0; si < snapshots.length; si++) {
          const pos = positions[si];
          if (pos === null) continue;
          const x = xOf(si);
          const y = yOf(pos);
          if (segments.length === 0) {
            segments.push(`M ${x},${y}`);
          } else {
            // Find previous valid point
            let prevSi = si - 1;
            while (prevSi >= 0 && positions[prevSi] === null) prevSi--;
            if (prevSi >= 0 && positions[prevSi] !== null) {
              const px = xOf(prevSi);
              const py = yOf(positions[prevSi]!);
              const mx = (px + x) / 2;
              segments.push(`C ${mx},${py} ${mx},${y} ${x},${y}`);
            } else {
              segments.push(`M ${x},${y}`);
            }
          }
        }

        const d = segments.join(' ');
        const firstPos = positions.find(p => p !== null);
        const lastPos = [...positions].reverse().find(p => p !== null);
        const lastSi = positions.lastIndexOf(lastPos ?? null);
        const firstSi = positions.indexOf(firstPos ?? null);

        return (
          <g key={player.id}>
            <path d={d} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" opacity={0.85} />
            {/* Dots at each snapshot */}
            {positions.map((pos, si) => pos !== null && (
              <circle key={si} cx={xOf(si)} cy={yOf(pos)} r={4} fill={color} stroke="#0f172a" strokeWidth={1.5} />
            ))}
            {/* Name + position at end (right side) */}
            {lastPos !== null && (
              <text x={xOf(lastSi) + 10} y={yOf(lastPos!) + 4} textAnchor="start"
                fill={color} fontSize={10} fontWeight="bold" opacity={0.9}>
                #{lastPos} {player.displayName.split(' ')[0]}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
};

export const Leaderboard = () => {
  const { user, profile } = useAuth();
  const [tab, setTab] = useState<'geral' | 'evolucao'>('geral');
  const [ranking, setRanking] = useState<any[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
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

        // Buscar histórico de snapshots
        const histQ = query(collection(db, 'rankingHistory'), orderBy('resolvedAt', 'asc'));
        const histSnap = await getDocs(histQ);
        setSnapshots(histSnap.docs.map(d => d.data() as Snapshot));
      } catch (err) {
        console.error('Erro ao buscar ranking:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchRanking();
  }, [user, profile]);

  // Variação de posição: compara ranking atual com o snapshot anterior ao mais recente
  const positionDelta = (userId: string): number | null => {
    if (snapshots.length < 2) return null;
    const prev = snapshots[snapshots.length - 2].entries.find(e => e.userId === userId);
    const curr = snapshots[snapshots.length - 1].entries.find(e => e.userId === userId);
    if (!prev || !curr) return null;
    return prev.position - curr.position; // positivo = subiu
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
                  <th className="px-8 py-4 text-[10px] font-black text-white/40 uppercase tracking-widest">Pos</th>
                  <th className="px-4 py-4 text-[10px] font-black text-white/40 uppercase tracking-widest"></th>
                  <th className="px-8 py-4 text-[10px] font-black text-white/40 uppercase tracking-widest">Player</th>
                  <th className="px-8 py-4 text-[10px] font-black text-white/40 uppercase tracking-widest text-right">Points</th>
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
                      <td className="px-8 py-4 font-black">
                        <span className={cn(row.pos <= 3 ? 'text-editorial-gold' : 'text-white/20')}>
                          {row.pos.toString().padStart(2, '0')}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        {delta === null ? (
                          <Minus size={12} className="text-white/20" />
                        ) : delta > 0 ? (
                          <span className="flex items-center gap-0.5 text-green-400 text-[10px] font-black">
                            <TrendingUp size={12} /> +{delta}
                          </span>
                        ) : delta < 0 ? (
                          <span className="flex items-center gap-0.5 text-red-400 text-[10px] font-black">
                            <TrendingDown size={12} /> {delta}
                          </span>
                        ) : (
                          <Minus size={12} className="text-white/40" />
                        )}
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
                        <span className="font-mono font-bold text-editorial-accent">{row.points}</span>
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
              {/* Bump chart — variação de posições */}
              <div className="bg-editorial-navy/40 border border-white/5 rounded-[24px] p-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xs font-black text-white/40 uppercase tracking-widest">Variação de Posições — Top 10</h3>
                  <div className="flex flex-wrap gap-3">
                    {ranking.slice(0, 10).map((p, i) => (
                      <span key={p.id} className="flex items-center gap-1.5 text-[10px] font-bold">
                        <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: PLAYER_COLORS[i] }} />
                        <span style={{ color: PLAYER_COLORS[i] }}>{p.displayName.split(' ')[0]}</span>
                      </span>
                    ))}
                  </div>
                </div>
                <BumpChart snapshots={snapshots} players={ranking.slice(0, 10)} />
              </div>

              {/* Tabela por jogo */}
              <div className="bg-editorial-navy/40 border border-white/5 rounded-[24px] overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-white/5">
                      <th className="px-6 py-4 text-[10px] font-black text-white/40 uppercase tracking-widest">Player</th>
                      {snapshots.map(s => (
                        <th key={s.matchId} className="px-4 py-4 text-[10px] font-black text-white/40 uppercase tracking-widest text-center whitespace-nowrap">
                          {s.matchLabel}
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
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-3">
                            <span className="text-white/20 font-black text-xs w-4">{player.pos}</span>
                            <div className="w-6 h-6 bg-white/5 rounded-full overflow-hidden">
                              {player.photoURL ? <img src={player.photoURL} className="w-full h-full object-cover" /> : null}
                            </div>
                            <span className="font-bold text-xs">{player.displayName}</span>
                          </div>
                        </td>
                        {snapshots.map((s, si) => {
                          const entry = s.entries.find(e => e.userId === player.id);
                          const prev = si > 0 ? snapshots[si - 1].entries.find(e => e.userId === player.id) : null;
                          const gained = entry && prev ? entry.points - prev.points : null;
                          return (
                            <td key={s.matchId} className="px-4 py-3 text-center">
                              <span className="font-mono font-bold text-xs text-white/70">{entry?.points ?? '—'}</span>
                              {gained !== null && gained > 0 && (
                                <span className="block text-[9px] text-green-400 font-black">+{gained}</span>
                              )}
                              {entry && (
                                <span className="block text-[9px] text-white/30">#{entry.position}</span>
                              )}
                            </td>
                          );
                        })}
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
