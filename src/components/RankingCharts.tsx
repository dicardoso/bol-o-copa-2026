import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface RankingEntry {
  userId: string;
  displayName: string;
  photoURL: string;
  points: number;
  position: number;
}

export interface Snapshot {
  matchId: string;
  matchLabel: string;
  resolvedAt: string;
  entries: RankingEntry[];
}

export const PLAYER_COLORS = [
  '#f59e0b', '#3b82f6', '#10b981', '#f97316',
  '#8b5cf6', '#ec4899', '#94a3b8', '#14b8a6', '#84cc16', '#ef4444',
];

export const WINDOW = 8;

interface ChartProps {
  snapshots: Snapshot[];
  players: { id: string; displayName: string }[];
  tall?: boolean;
}

export const BumpChart = ({ snapshots, players, tall }: ChartProps) => {
  const [windowEnd, setWindowEnd] = useState(snapshots.length);

  const windowStart = Math.max(0, windowEnd - WINDOW);
  const visible = snapshots.slice(windowStart, windowEnd);
  const canPrev = windowStart > 0;
  const canNext = windowEnd < snapshots.length;

  if (snapshots.length < 2) return (
    <p className="text-white/30 text-xs text-center py-8">São necessários pelo menos 2 jogos resolvidos para exibir o gráfico.</p>
  );

  const W = 700, H = tall ? 600 : 320;
  const padL = 100, padR = 100, padT = 20, padB = 36;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const maxPos = Math.min(players.length, 10);

  const xOf = (si: number) => padL + (si / Math.max(visible.length - 1, 1)) * chartW;
  const yOf = (pos: number) => padT + ((pos - 1) / Math.max(maxPos - 1, 1)) * chartH;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={tall ? undefined : { maxHeight: 340 }}>
        {Array.from({ length: maxPos }, (_, i) => (
          <line key={i} x1={padL} x2={W - padR} y1={yOf(i + 1)} y2={yOf(i + 1)}
            stroke="white" strokeOpacity={0.04} strokeWidth={1} />
        ))}
        {Array.from({ length: maxPos }, (_, i) => (
          <text key={i} x={padL - 10} y={yOf(i + 1) + 4} textAnchor="end"
            fill="rgba(255,255,255,0.2)" fontSize={10} fontWeight="bold">
            #{i + 1}
          </text>
        ))}
        {visible.map((s, si) => (
          <text key={s.matchId} x={xOf(si)} y={H - 4} textAnchor="middle"
            fill="rgba(255,255,255,0.25)" fontSize={9}>
            {s.matchLabel.length > 12 ? s.matchLabel.slice(0, 11) + '…' : s.matchLabel}
          </text>
        ))}
        {players.slice(0, 10).map((player, pi) => {
          const color = PLAYER_COLORS[pi % PLAYER_COLORS.length];
          const positions = visible.map(s => {
            const e = s.entries.find(e => e.userId === player.id);
            return e ? Math.min(e.position, maxPos) : null;
          });
          const segments: string[] = [];
          for (let si = 0; si < visible.length; si++) {
            const pos = positions[si];
            if (pos === null) continue;
            const x = xOf(si), y = yOf(pos);
            if (segments.length === 0) {
              segments.push(`M ${x},${y}`);
            } else {
              let prevSi = si - 1;
              while (prevSi >= 0 && positions[prevSi] === null) prevSi--;
              if (prevSi >= 0 && positions[prevSi] !== null) {
                const px = xOf(prevSi), py = yOf(positions[prevSi]!);
                const mx = (px + x) / 2;
                segments.push(`C ${mx},${py} ${mx},${y} ${x},${y}`);
              } else {
                segments.push(`M ${x},${y}`);
              }
            }
          }
          const lastPos = [...positions].reverse().find(p => p !== null);
          const lastSi = positions.lastIndexOf(lastPos ?? null);
          return (
            <g key={player.id}>
              <path d={segments.join(' ')} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" opacity={0.85} />
              {positions.map((pos, si) => pos !== null && (
                <circle key={si} cx={xOf(si)} cy={yOf(pos)} r={4} fill={color} stroke="#0f172a" strokeWidth={1.5} />
              ))}
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
      {snapshots.length > WINDOW && (
        <div className="flex items-center justify-center gap-4 mt-4">
          <button type="button" aria-label="Ver jogos anteriores" onClick={() => setWindowEnd(e => Math.max(WINDOW, e - 1))} disabled={!canPrev}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-colors">
            <ChevronLeft size={16} className="text-white/60" />
          </button>
          <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">
            {windowStart + 1}–{windowEnd} / {snapshots.length}
          </span>
          <button type="button" aria-label="Ver próximos jogos" onClick={() => setWindowEnd(e => Math.min(snapshots.length, e + 1))} disabled={!canNext}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-colors">
            <ChevronRight size={16} className="text-white/60" />
          </button>
        </div>
      )}
    </div>
  );
};

export const PointsChart = ({ snapshots, players, tall }: ChartProps) => {
  const [windowEnd, setWindowEnd] = useState(snapshots.length);

  const windowStart = Math.max(0, windowEnd - WINDOW);
  const visible = snapshots.slice(windowStart, windowEnd);
  const canPrev = windowStart > 0;
  const canNext = windowEnd < snapshots.length;

  if (snapshots.length < 2) return (
    <p className="text-white/30 text-xs text-center py-8">
      São necessários pelo menos 2 jogos resolvidos para exibir o gráfico.
    </p>
  );

  const W = 700, H = tall ? 600 : 320;
  const padL = 52, padR = 100, padT = 20, padB = 36;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const allPointValues = players.flatMap(p =>
    visible.map(s => s.entries.find(e => e.userId === p.id)?.points ?? 0)
  );
  const maxPoints = Math.max(...allPointValues, 1);
  const nonZero = allPointValues.filter(v => v > 0);
  const rawMin = nonZero.length > 0 ? Math.min(...nonZero) : 0;
  const minPoints = Math.max(0, rawMin - Math.ceil((maxPoints - rawMin) * 0.1));

  const xOf = (si: number) => padL + (si / Math.max(visible.length - 1, 1)) * chartW;
  const yOf = (pts: number) => padT + chartH - ((pts - minPoints) / Math.max(maxPoints - minPoints, 1)) * chartH;

  const gridLines = 5;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={tall ? undefined : { maxHeight: 340 }}>
        {Array.from({ length: gridLines }, (_, i) => {
          const pts = Math.round(minPoints + ((maxPoints - minPoints) / (gridLines - 1)) * i);
          const y = yOf(pts);
          return (
            <g key={i}>
              <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="white" strokeOpacity={0.04} strokeWidth={1} />
              <text x={padL - 6} y={y + 4} textAnchor="end" fill="rgba(255,255,255,0.2)" fontSize={10} fontWeight="bold">
                {pts}
              </text>
            </g>
          );
        })}
        {visible.map((s, si) => (
          <text key={s.matchId} x={xOf(si)} y={H - 4} textAnchor="middle"
            fill="rgba(255,255,255,0.25)" fontSize={9}>
            {s.matchLabel.length > 12 ? s.matchLabel.slice(0, 11) + '…' : s.matchLabel}
          </text>
        ))}
        {players.map((player, pi) => {
          const color = PLAYER_COLORS[pi % PLAYER_COLORS.length];
          const pointsList = visible.map(s => {
            const e = s.entries.find(e => e.userId === player.id);
            return e ? e.points : null;
          });
          const segments: string[] = [];
          for (let si = 0; si < visible.length; si++) {
            const pts = pointsList[si];
            if (pts === null) continue;
            const x = xOf(si), y = yOf(pts);
            if (segments.length === 0) {
              segments.push(`M ${x},${y}`);
            } else {
              let prevSi = si - 1;
              while (prevSi >= 0 && pointsList[prevSi] === null) prevSi--;
              if (prevSi >= 0 && pointsList[prevSi] !== null) {
                const px = xOf(prevSi), py = yOf(pointsList[prevSi]!);
                const mx = (px + x) / 2;
                segments.push(`C ${mx},${py} ${mx},${y} ${x},${y}`);
              } else {
                segments.push(`M ${x},${y}`);
              }
            }
          }
          const lastPts = [...pointsList].reverse().find(p => p !== null);
          const lastSi = pointsList.lastIndexOf(lastPts ?? null);
          return (
            <g key={player.id}>
              <path d={segments.join(' ')} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" opacity={0.85} />
              {pointsList.map((pts, si) => pts !== null && (
                <circle key={si} cx={xOf(si)} cy={yOf(pts)} r={4} fill={color} stroke="#0f172a" strokeWidth={1.5} />
              ))}
              {lastPts !== null && (
                <text x={xOf(lastSi) + 10} y={yOf(lastPts!) + 4} textAnchor="start"
                  fill={color} fontSize={10} fontWeight="bold" opacity={0.9}>
                  {lastPts}pts {player.displayName.split(' ')[0]}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {snapshots.length > WINDOW && (
        <div className="flex items-center justify-center gap-4 mt-4">
          <button type="button" aria-label="Ver jogos anteriores" onClick={() => setWindowEnd(e => Math.max(WINDOW, e - 1))} disabled={!canPrev}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-colors">
            <ChevronLeft size={16} className="text-white/60" />
          </button>
          <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">
            {windowStart + 1}–{windowEnd} / {snapshots.length}
          </span>
          <button type="button" aria-label="Ver próximos jogos" onClick={() => setWindowEnd(e => Math.min(snapshots.length, e + 1))} disabled={!canNext}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-colors">
            <ChevronRight size={16} className="text-white/60" />
          </button>
        </div>
      )}
    </div>
  );
};
