import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { soccerService } from '../services/soccerService';
import { BarChart2, Target, TrendingUp, XCircle, Coins } from 'lucide-react';
import { type Snapshot } from '../components/RankingCharts';
import { cn } from '../lib/utils';

type Tab = 'geral' | 'meu';
type ResultType = 'exact' | 'partial' | 'miss' | 'pending';

interface MatchData {
  id: string;
  teamA: string;
  teamB: string;
  scoreA: number | null;
  scoreB: number | null;
  finished: boolean;
  date: string;
}

interface BetData {
  id: string;
  userId: string;
  matchId: string;
  predictedScoreA: number;
  predictedScoreB: number;
  pointsEarned: number;
}

interface UserManuBetData {
  id: string;
  userId: string;
  amount: number;
  status: 'pending' | 'won' | 'lost';
  payout?: number;
  winnings?: number;
}

function classifyBet(bet: BetData, match: MatchData): ResultType {
  if (!match?.finished || match.scoreA === null || match.scoreB === null) return 'pending';
  if (bet.predictedScoreA === match.scoreA && bet.predictedScoreB === match.scoreB) return 'exact';
  const predictedResult = Math.sign(bet.predictedScoreA - bet.predictedScoreB);
  const actualResult = Math.sign(match.scoreA - match.scoreB);
  return predictedResult === actualResult ? 'partial' : 'miss';
}

const Sparkline = ({ data }: { data: number[] }) => {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const W = 300, H = 60;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((v - min) / range) * (H - 8) - 4;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-14">
      <polyline points={pts} fill="none" stroke="#f59e0b" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {data.map((v, i) => {
        const x = (i / (data.length - 1)) * W;
        const y = H - ((v - min) / range) * (H - 8) - 4;
        return <circle key={i} cx={x} cy={y} r={3} fill="#f59e0b" stroke="#0f172a" strokeWidth={1.5} />;
      })}
    </svg>
  );
};

export const Stats = () => {
  const { user, profile } = useAuth();
  const [tab, setTab] = useState<Tab>('geral');
  const [loading, setLoading] = useState(true);

  const [matches, setMatches] = useState<MatchData[]>([]);
  const [allBets, setAllBets] = useState<BetData[]>([]);
  const [myBets, setMyBets] = useState<BetData[]>([]);
  const [myManuBets, setMyManuBets] = useState<UserManuBetData[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      try {
        const [rawMatches, allBetsSnap, myBetsSnap, myManuSnap, histSnap] = await Promise.all([
          soccerService.getLocalMatches(),
          getDocs(collection(db, 'bets')),
          getDocs(query(collection(db, 'bets'), where('userId', '==', user.uid))),
          getDocs(query(collection(db, 'userManuBets'), where('userId', '==', user.uid))),
          getDocs(query(collection(db, 'rankingHistory'), orderBy('resolvedAt', 'asc'))),
        ]);
        setMatches(rawMatches);
        setAllBets(allBetsSnap.docs.map(d => ({ id: d.id, ...d.data() as any })));
        setMyBets(myBetsSnap.docs.map(d => ({ id: d.id, ...d.data() as any })));
        setMyManuBets(myManuSnap.docs.map(d => ({ id: d.id, ...d.data() as any })));
        setSnapshots(histSnap.docs.map(d => d.data() as Snapshot));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const matchMap = Object.fromEntries(matches.map(m => [m.id, m]));
  const finishedMatches = matches.filter(m => m.finished);

  // ── General ──
  const finishedBets = allBets.filter(b => matchMap[b.matchId]?.finished);
  const totalExact = finishedBets.filter(b => classifyBet(b, matchMap[b.matchId]) === 'exact').length;
  const totalPartial = finishedBets.filter(b => classifyBet(b, matchMap[b.matchId]) === 'partial').length;
  const totalMiss = finishedBets.filter(b => classifyBet(b, matchMap[b.matchId]) === 'miss').length;

  const matchHitRates = finishedMatches
    .map(m => {
      const bets = allBets.filter(b => b.matchId === m.id);
      if (bets.length === 0) return null;
      const hits = bets.filter(b => classifyBet(b, m) !== 'miss').length;
      return { match: m, total: bets.length, hits, rate: hits / bets.length };
    })
    .filter(Boolean) as { match: MatchData; total: number; hits: number; rate: number }[];

  const mostGuessed = [...matchHitRates].sort((a, b) => b.rate - a.rate).slice(0, 5);
  const leastGuessed = [...matchHitRates].sort((a, b) => a.rate - b.rate).slice(0, 5);

  const betCountByUser: Record<string, number> = {};
  allBets.forEach(b => { betCountByUser[b.userId] = (betCountByUser[b.userId] || 0) + 1; });
  const topBettors = Object.entries(betCountByUser).sort(([, a], [, b]) => b - a).slice(0, 10);

  const lastSnapshot = snapshots[snapshots.length - 1];
  const userNameMap: Record<string, string> = {};
  lastSnapshot?.entries.forEach(e => { userNameMap[e.userId] = e.displayName; });

  // ── My stats ──
  const myFinishedBets = myBets.filter(b => matchMap[b.matchId]?.finished);
  const myExact = myFinishedBets.filter(b => classifyBet(b, matchMap[b.matchId]) === 'exact');
  const myPartial = myFinishedBets.filter(b => classifyBet(b, matchMap[b.matchId]) === 'partial');
  const myMiss = myFinishedBets.filter(b => classifyBet(b, matchMap[b.matchId]) === 'miss');

  const myBestBet = [...myFinishedBets].sort((a, b) => b.pointsEarned - a.pointsEarned)[0];
  const myWorstBet = [...myMiss].sort((a, b) =>
    new Date(matchMap[b.matchId]?.date || 0).getTime() - new Date(matchMap[a.matchId]?.date || 0).getTime()
  )[0];

  const myEvolution = snapshots
    .map(s => s.entries.find(e => e.userId === user?.uid))
    .filter(Boolean) as { points: number; position: number }[];
  const myPointsHistory = myEvolution.map(e => e.points);

  const manuWon = myManuBets.filter(b => b.status === 'won');
  const manuLost = myManuBets.filter(b => b.status === 'lost');
  const manuPending = myManuBets.filter(b => b.status === 'pending');
  const manuInvested = myManuBets.reduce((s, b) => s + (b.amount || 0), 0);
  const manuReturned = manuWon.reduce((s, b) => s + (b.payout || b.winnings || 0), 0);
  const manuNet = manuReturned - manuInvested;
  const manuWinRate = manuWon.length + manuLost.length > 0
    ? Math.round(manuWon.length / (manuWon.length + manuLost.length) * 100)
    : 0;

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-white/40">Carregando estatísticas...</div>
  );

  return (
    <div className="space-y-8 pb-20">
      <header className="pb-4 border-b border-white/5">
        <span className="section-title !mb-1">Análise</span>
        <h2 className="text-3xl font-black tracking-tighter text-white uppercase">Estatísticas</h2>
      </header>

      <div className="flex gap-2">
        {(['geral', 'meu'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-5 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-colors',
              tab === t ? 'bg-editorial-gold text-editorial-navy' : 'bg-white/5 text-white/40 hover:text-white'
            )}
          >
            {t === 'geral' ? 'Geral' : 'Meu Desempenho'}
          </button>
        ))}
      </div>

      {tab === 'geral' && (
        <div className="space-y-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total de Palpites" value={allBets.length} icon={BarChart2} />
            <StatCard
              label="Acertos Exatos" value={totalExact}
              sub={finishedBets.length > 0 ? `${Math.round(totalExact / finishedBets.length * 100)}%` : undefined}
              icon={Target} color="text-emerald-400"
            />
            <StatCard
              label="Acertos Parciais" value={totalPartial}
              sub={finishedBets.length > 0 ? `${Math.round(totalPartial / finishedBets.length * 100)}%` : undefined}
              icon={TrendingUp} color="text-blue-400"
            />
            <StatCard
              label="Erros" value={totalMiss}
              sub={finishedBets.length > 0 ? `${Math.round(totalMiss / finishedBets.length * 100)}%` : undefined}
              icon={XCircle} color="text-red-400"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="sidebar-card">
              <span className="section-title">Partidas Mais Acertadas</span>
              <MatchHitList items={mostGuessed} />
            </div>
            <div className="sidebar-card">
              <span className="section-title">Partidas Menos Acertadas</span>
              <MatchHitList items={leastGuessed} />
            </div>
          </div>

          <div className="sidebar-card">
            <span className="section-title">Ranking de Participação</span>
            <div className="space-y-3 mt-4">
              {topBettors.map(([uid, count], i) => (
                <div key={uid} className="flex items-center gap-3">
                  <span className="text-xs font-black text-editorial-gold w-6">{(i + 1).toString().padStart(2, '0')}</span>
                  <span className="flex-1 text-sm font-bold text-white/80 truncate">
                    {uid === user?.uid
                      ? (profile?.displayName || 'Você')
                      : (userNameMap[uid] || 'Usuário')}
                    {uid === user?.uid && (
                      <span className="ml-2 text-[10px] text-editorial-gold uppercase tracking-wider">você</span>
                    )}
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden w-24">
                      <div
                        className="h-full bg-editorial-gold rounded-full transition-all"
                        style={{ width: `${(count / (topBettors[0]?.[1] || 1)) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono text-white/40 w-8 text-right">{count}</span>
                  </div>
                </div>
              ))}
              {topBettors.length === 0 && (
                <p className="text-xs text-white/20 italic">Nenhum palpite registrado ainda.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'meu' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <ResultCard type="exact" count={myExact.length} total={myFinishedBets.length} />
            <ResultCard type="partial" count={myPartial.length} total={myFinishedBets.length} />
            <ResultCard type="miss" count={myMiss.length} total={myFinishedBets.length} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sidebar-card">
              <span className="section-title">Melhor Jogo</span>
              {myBestBet
                ? <BetHighlight bet={myBestBet} match={matchMap[myBestBet.matchId]} variant="best" />
                : <p className="text-xs text-white/20 italic mt-2">Nenhum jogo finalizado ainda.</p>}
            </div>
            <div className="sidebar-card">
              <span className="section-title">Pior Jogo</span>
              {myWorstBet
                ? <BetHighlight bet={myWorstBet} match={matchMap[myWorstBet.matchId]} variant="worst" />
                : <p className="text-xs text-white/20 italic mt-2">Sem erros ainda!</p>}
            </div>
          </div>

          {myPointsHistory.length >= 2 && (
            <div className="sidebar-card">
              <div className="flex items-center justify-between mb-2">
                <span className="section-title !mb-0">Evolução de Pontos</span>
                <span className="text-2xl font-black text-editorial-gold">
                  {myPointsHistory[myPointsHistory.length - 1]} pts
                </span>
              </div>
              <Sparkline data={myPointsHistory} />
              <div className="flex justify-between mt-1 text-[10px] text-white/20 font-mono">
                <span>Jogo 1</span>
                <span>Jogo {myPointsHistory.length}</span>
              </div>
            </div>
          )}

          <div className="sidebar-card">
            <div className="flex items-center gap-2 mb-4">
              <Coins className="w-4 h-4 text-editorial-gold" />
              <span className="section-title !mb-0">ManucaBets</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <MiniStat label="Apostas" value={myManuBets.length} />
              <MiniStat label="Vitórias" value={manuWon.length} color="text-emerald-400" />
              <MiniStat label="Derrotas" value={manuLost.length} color="text-red-400" />
              <MiniStat label="Pendentes" value={manuPending.length} color="text-yellow-400" />
            </div>
            <div className="mt-6 pt-4 border-t border-white/5 grid grid-cols-3 gap-4">
              <MiniStat label="NC Investidos" value={manuInvested.toLocaleString()} />
              <MiniStat label="NC Retornados" value={manuReturned.toLocaleString()} />
              <MiniStat
                label="Saldo NC"
                value={(manuNet >= 0 ? '+' : '') + manuNet.toLocaleString()}
                color={manuNet >= 0 ? 'text-emerald-400' : 'text-red-400'}
              />
            </div>
            {(manuWon.length + manuLost.length) > 0 && (
              <p className="text-[10px] text-white/20 mt-4 font-mono uppercase tracking-widest">
                Taxa de vitória: {manuWinRate}%
              </p>
            )}
            {myManuBets.length === 0 && (
              <p className="text-xs text-white/20 italic mt-2">Nenhuma aposta ManucaBet realizada.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

function StatCard({ label, value, sub, icon: Icon, color = 'text-editorial-gold' }: {
  label: string; value: number | string; sub?: string; icon: React.ElementType; color?: string;
}) {
  return (
    <div className="sidebar-card flex flex-col gap-3">
      <Icon className={cn('w-5 h-5', color)} />
      <div>
        <div className="text-2xl font-black text-white">{value}</div>
        {sub && <div className={cn('text-xs font-bold', color)}>{sub}</div>}
        <div className="text-[10px] text-white/30 uppercase tracking-widest mt-1">{label}</div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, color = 'text-white' }: {
  label: string; value: string | number; color?: string;
}) {
  return (
    <div>
      <div className={cn('text-xl font-black', color)}>{value}</div>
      <div className="text-[10px] text-white/30 uppercase tracking-widest">{label}</div>
    </div>
  );
}

function ResultCard({ type, count, total }: { type: 'exact' | 'partial' | 'miss'; count: number; total: number }) {
  const configs = {
    exact:   { label: 'Exatos',   color: 'text-emerald-400', bar: 'bg-emerald-400', desc: 'Placar exato' },
    partial: { label: 'Parciais', color: 'text-blue-400',    bar: 'bg-blue-400',    desc: 'Resultado correto' },
    miss:    { label: 'Erros',    color: 'text-red-400',     bar: 'bg-red-400',     desc: 'Resultado errado' },
  };
  const c = configs[type];
  const pct = total > 0 ? Math.round(count / total * 100) : 0;
  return (
    <div className="sidebar-card">
      <div className={cn('text-3xl font-black', c.color)}>{count}</div>
      <div className="text-xs text-white/40 mb-3">{c.desc}</div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', c.bar)} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between mt-2">
        <span className="text-[10px] text-white/30 uppercase tracking-widest">{c.label}</span>
        <span className={cn('text-[10px] font-bold', c.color)}>{pct}%</span>
      </div>
    </div>
  );
}

function MatchHitList({ items }: {
  items: { match: MatchData; total: number; hits: number; rate: number }[];
}) {
  if (items.length === 0) return (
    <p className="text-xs text-white/20 italic mt-2">Nenhum dado disponível ainda.</p>
  );
  return (
    <div className="space-y-3 mt-4">
      {items.map(({ match, hits, total, rate }) => (
        <div key={match.id} className="flex items-center gap-3">
          <span className="text-xs text-white/60 truncate flex-1">{match.teamA} x {match.teamB}</span>
          <div className="flex items-center gap-2 shrink-0">
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden w-16">
              <div className="h-full bg-editorial-gold rounded-full" style={{ width: `${rate * 100}%` }} />
            </div>
            <span className="text-[10px] font-mono text-white/40 w-10 text-right">{hits}/{total}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function BetHighlight({ bet, match, variant }: {
  bet: BetData; match: MatchData; variant: 'best' | 'worst';
}) {
  if (!match) return null;
  return (
    <div className="mt-3 space-y-1">
      <div className="text-sm font-bold text-white/80">{match.teamA} x {match.teamB}</div>
      <div className="text-xs text-white/40">
        Placar real: <span className="font-bold text-white/60">{match.scoreA}–{match.scoreB}</span>
        {' · '}
        Palpite: <span className="font-bold text-white/60">{bet.predictedScoreA}–{bet.predictedScoreB}</span>
      </div>
      <div className={cn('text-2xl font-black mt-2', variant === 'best' ? 'text-editorial-gold' : 'text-red-400')}>
        {variant === 'best' ? `+${bet.pointsEarned} pts` : '0 pts'}
      </div>
    </div>
  );
}
