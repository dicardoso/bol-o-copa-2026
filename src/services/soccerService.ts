import axios from 'axios';
import { collection, doc, setDoc, getDocs, query, where, orderBy, increment } from 'firebase/firestore';
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
  score: { fullTime: { home: number; away: number } };
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
          scoreA: match.score.fullTime.home ?? 0,
          scoreB: match.score.fullTime.away ?? 0,
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
          await setDoc(userRef, { points: increment(pointDiff) }, { merge: true });
        }
      }
      return true;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `matches/${matchId}`);
    }
  }
};
