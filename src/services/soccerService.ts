import axios from 'axios';
import { collection, doc, setDoc, getDocs, getDoc, query, where, orderBy, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';

export interface ApiMatch {
  id: number;
  utcDate: string;
  status: string;
  matchday: number;
  stage: string;
  homeTeam: { name: string; tla: string; crest: string };
  awayTeam: { name: string; tla: string; crest: string };
  score: {
    regularTime: { home: number | null; away: number | null } | null;
    fullTime: { home: number | null; away: number | null };
  };
}

export interface Match {
  id: string;
  teamA: string;
  teamB: string;
  flagA: string;
  flagB: string;
  date: string;
  stage: string;
  round: number;
  scoreA: number;
  scoreB: number;
  finished: boolean;
  venue: string;
}

export const soccerService = {
  /**
   * Sincroniza jogos da Copa do Mundo para o Firestore
   * Nota: Como 2026 é futuro, APIs costumam usar WC (World Cup) ID 2000
   */
  async syncWorldCupMatches() {
    try {
      const response = await axios.get('/api/football-proxy');
      const matches: ApiMatch[] = response.data.matches;

      for (const match of matches) {
        const matchRef = doc(db, 'matches', match.id.toString());
        await setDoc(matchRef, {
          teamA: match.homeTeam.name,
          teamB: match.awayTeam.name,
          flagA: match.homeTeam.crest,
          flagB: match.awayTeam.crest,
          date: match.utcDate,
          stage: match.stage,
          round: match.matchday,
          scoreA: (match.score.regularTime?.home ?? match.score.fullTime.home) ?? 0,
          scoreB: (match.score.regularTime?.away ?? match.score.fullTime.away) ?? 0,
          finished: match.status === 'FINISHED',
          venue: 'Estádio FIFA'
        }, { merge: true });
      }
      return matches.length;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'matches');
    }
  },

  /**
   * Busca jogos do Firestore para exibição nas telas
   */
  async getLocalMatches() {
    const path = 'matches';
    try {
      const q = query(collection(db, path), orderBy('date', 'asc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, path);
      return [];
    }
  },

  /**
   * Atualiza o placar de um jogo e calcula os pontos dos palpites
   */
  async updateMatchScore(matchId: string, scoreA: number, scoreB: number) {
    try {
      const matchRef = doc(db, 'matches', matchId);
      const matchSnap = await getDoc(matchRef);
      const isElimination = matchSnap.exists() && matchSnap.data()?.round == null;
      await setDoc(matchRef, {
        scoreA,
        scoreB,
        finished: true,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // Buscar todos os palpites para este jogo
      const betsQuery = query(collection(db, 'bets'), where('matchId', '==', matchId));
      const betsSnap = await getDocs(betsQuery);

      for (const betDoc of betsSnap.docs) {
        const bet = betDoc.data();
        const oldPoints = bet.pointsEarned || 0;
        let newPoints = 0;

        const exactMatch = bet.predictedScoreA === scoreA && bet.predictedScoreB === scoreB;
        const correctResult = (bet.predictedScoreA > bet.predictedScoreB && scoreA > scoreB) ||
          (bet.predictedScoreA < bet.predictedScoreB && scoreA < scoreB) ||
          (bet.predictedScoreA === bet.predictedScoreB && scoreA === scoreB);

        if (exactMatch) {
          newPoints = 25;
        } else if (correctResult) {
          newPoints = 10;
        }

        const pointDiff = newPoints - oldPoints;

        // Atualizar o palpite com os pontos
        await setDoc(betDoc.ref, { pointsEarned: newPoints }, { merge: true });

        // Atualizar perfil do usuário com a diferença
        if (pointDiff !== 0) {
          const userRef = doc(db, 'users', bet.userId);
          const userUpdate: Record<string, unknown> = { points: increment(pointDiff) };
          if (isElimination) userUpdate.eliminationPoints = increment(pointDiff);
          await setDoc(userRef, userUpdate, { merge: true });
        }
      }
      // Snapshot do ranking após resolver o jogo
      await soccerService.saveRankingSnapshot(matchId, scoreA, scoreB);

      return true;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `matches/${matchId}`);
    }
  },

  async rebuildRankingHistory(onProgress?: (current: number, total: number) => void) {
    // Buscar jogos encerrados em ordem cronológica
    const matchesSnap = await getDocs(query(
      collection(db, 'matches'),
      where('finished', '==', true),
      orderBy('date', 'asc')
    ));
    const finishedMatches = matchesSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));

    // Buscar todos os palpites com pontos
    const betsSnap = await getDocs(collection(db, 'bets'));
    // Agrupa por matchId → userId → pointsEarned
    const betsByMatch: Record<string, Record<string, number>> = {};
    betsSnap.docs.forEach(d => {
      const b = d.data();
      if (!b.matchId || !b.userId) return;
      if (!betsByMatch[b.matchId]) betsByMatch[b.matchId] = {};
      betsByMatch[b.matchId][b.userId] = b.pointsEarned || 0;
    });

    // Buscar todos os usuários para nomes e fotos
    const usersSnap = await getDocs(collection(db, 'users'));
    const usersMap: Record<string, { displayName: string; photoURL: string }> = {};
    usersSnap.docs.forEach(d => {
      const u = d.data();
      usersMap[d.id] = { displayName: u.displayName || 'Usuário', photoURL: u.photoURL || '' };
    });

    // Acumula pontos jogo a jogo e salva snapshot
    const cumulative: Record<string, number> = {};
    for (let i = 0; i < finishedMatches.length; i++) {
      const match = finishedMatches[i];
      const matchBets = betsByMatch[match.id] || {};
      for (const [userId, pts] of Object.entries(matchBets)) {
        cumulative[userId] = (cumulative[userId] || 0) + pts;
      }

      const entries = Object.entries(cumulative)
        .sort(([uidA, a], [uidB, b]) => b - a || uidA.localeCompare(uidB))
        .map(([userId, points], idx) => ({
          userId,
          displayName: usersMap[userId]?.displayName ?? 'Usuário',
          photoURL: usersMap[userId]?.photoURL ?? '',
          points,
          position: idx + 1,
        }));

      await setDoc(doc(db, 'rankingHistory', match.id), {
        matchId: match.id,
        matchLabel: `${match.teamA} x ${match.teamB}`,
        scoreA: match.scoreA,
        scoreB: match.scoreB,
        resolvedAt: match.updatedAt || match.date,
        entries,
      });

      onProgress?.(i + 1, finishedMatches.length);
    }

    return finishedMatches.length;
  },

  async fetchApiResults(): Promise<{ matches: ApiMatch[]; lastCheckedAt: string | null }> {
    try {
      const response = await axios.get<{ matches: ApiMatch[]; lastCheckedAt: string | null }>('/api/pending-results');
      return response.data;
    } catch (err) {
      console.error('[fetchApiResults]', err);
      return { matches: [], lastCheckedAt: null };
    }
  },

  async refreshApiResults(): Promise<{ matches: ApiMatch[]; lastCheckedAt: string | null }> {
    try {
      const response = await axios.post<{ matches: ApiMatch[]; lastCheckedAt: string | null }>('/api/pending-results/refresh');
      return response.data;
    } catch (err) {
      console.error('[refreshApiResults]', err);
      return { matches: [], lastCheckedAt: null };
    }
  },

  async saveRankingSnapshot(matchId: string, scoreA: number, scoreB: number) {
    try {
      const matchSnap = await getDocs(query(collection(db, 'matches')));
      const match = matchSnap.docs.find(d => d.id === matchId)?.data();
      const matchLabel = match ? `${match.teamA} x ${match.teamB}` : matchId;

      const usersSnap = await getDocs(query(collection(db, 'users'), orderBy('points', 'desc')));
      const sorted = usersSnap.docs
        .map(d => ({ id: d.id, ...d.data() as any }))
        .sort((a, b) => (b.points || 0) - (a.points || 0) || a.id.localeCompare(b.id));
      const entries = sorted.map((u, i) => ({
        userId: u.id,
        displayName: u.displayName || 'Usuário',
        photoURL: u.photoURL || '',
        points: u.points || 0,
        position: i + 1,
      }));

      await setDoc(doc(db, 'rankingHistory', matchId), {
        matchId,
        matchLabel,
        scoreA,
        scoreB,
        resolvedAt: new Date().toISOString(),
        entries,
      });
    } catch (err) {
      console.error('Erro ao salvar snapshot do ranking:', err);
    }
  }
};
