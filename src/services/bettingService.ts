import { collection, doc, setDoc, getDocs, query, where, orderBy, increment, Timestamp, runTransaction, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';

export interface ManuBetOption {
  label: string;
  odds: number; // Static/Starting odds
}

export interface ManuBet {
  id?: string;
  matchId: string; // ID do jogo vinculado
  title: string;
  description: string;
  active: boolean;
  options: ManuBetOption[];
  totalPool: number;
  poolByCategory: Record<string, number>;
  initialMargin: number; // Fixed margin to match initial odds exactly
  createdAt: string;
}

export interface UserManuBet {
  id?: string;
  userId: string;
  manuBetId: string;
  matchId: string; // Vínculo redundante para facilitar consultas
  optionLabel: string;
  amount: number;
  oddsAtTime: number;
  status: 'pending' | 'won' | 'lost';
  createdAt: string;
}

export const bettingService = {
  /**
   * (Admin) Criar uma nova opção de aposta rápida com Pool inicial
   */
  async createManuBet(data: Omit<ManuBet, 'id' | 'createdAt' | 'totalPool' | 'poolByCategory' | 'initialMargin'>) {
    const path = 'manuBets';
    try {
      const ref = doc(collection(db, path));
      
      // Calcular margem necessária para que as odds iniciais sejam EXATAMENTE as fornecidas
      const sumProbabilities = data.options.reduce((acc, o) => acc + (1 / Math.max(1.01, o.odds)), 0);
      const initialMargin = 1 / sumProbabilities;
      
      const poolByCategory: Record<string, number> = {};
      let totalPool = 0;
      const baseLiquidity = 10000; // Liquidez inicial para estabilizar o mercado
      
      data.options.forEach(opt => {
        // Pool inicial baseado na probabilidade implícita
        const weight = 1 / Math.max(1.01, opt.odds);
        poolByCategory[opt.label] = weight * baseLiquidity;
        totalPool += poolByCategory[opt.label];
      });

      const newBet: ManuBet = {
        ...data,
        id: ref.id,
        totalPool,
        poolByCategory,
        initialMargin,
        createdAt: new Date().toISOString()
      };
      await setDoc(ref, newBet);
      return newBet;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  },

  /**
   * Calcula as Odds Atuais baseadas no Pool (Modelo Pari-Mutuel)
   */
  calculateCurrentOdds(bet: ManuBet, optionLabel: string) {
    const totalPool = bet.totalPool || 0;
    const amountOnOption = bet.poolByCategory[optionLabel] || 1;
    
    // Usar a margem inicial calculada na criação para manter a fidelidade aos valores de entrada
    // Se não existir, fallback para 0.90 (10% vig)
    const houseMargin = bet.initialMargin || 0.90;
    
    // Odds Dinâmicas: (Pool Total / Pool da Opção) * Margem
    const rawOdds = (totalPool / amountOnOption) * houseMargin;
    
    // Garantir odds mínimas de 1.05
    return Math.max(1.05, parseFloat(rawOdds.toFixed(2)));
  },

  /**
   * Listar apostas rápidas ativas
   */
  async getActiveManuBets() {
    const path = 'manuBets';
    try {
      // Tentar com ordenação (requer índice composto)
      const q = query(collection(db, path), where('active', '==', true), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ManuBet));
    } catch (err) {
      console.warn("Falha na consulta ordenada de manuBets, tentando sem ordenação:", err);
      try {
        // Fallback para consulta simples
        const qSimple = query(collection(db, path), where('active', '==', true));
        const snapSimple = await getDocs(qSimple);
        return snapSimple.docs.map(doc => ({ id: doc.id, ...doc.data() } as ManuBet));
      } catch (err2) {
        handleFirestoreError(err2, OperationType.GET, path);
        return [];
      }
    }
  },

  /**
   * (Usuário) Realizar uma aposta rápida com Ajuste Dinâmico de Mercado Atômico
   */
  async placeManuBet(userId: string, bet: ManuBet, optionLabel: string, amount: number) {
    const userBetPath = 'userManuBets';
    const userRef = doc(db, 'users', userId);
    const manuBetRef = doc(db, 'manuBets', bet.id!);
    
    try {
      const placement = await runTransaction(db, async (transaction) => {
        // 1. Verificar se já existe uma aposta pendente para esta oferta
        const existingQuery = query(
          collection(db, userBetPath), 
          where('userId', '==', userId), 
          where('manuBetId', '==', bet.id!),
          where('status', '==', 'pending')
        );
        const existingSnap = await getDocs(existingQuery);
        if (!existingSnap.empty) {
          throw new Error("Você já possui uma aposta nesta oferta. Cancele-a para mudar sua escolha.");
        }

        const betDoc = await transaction.get(manuBetRef);
        const userDoc = await transaction.get(userRef);
        
        if (!betDoc.exists()) throw new Error("A oferta de aposta não existe mais.");
        if (!userDoc.exists()) throw new Error("Usuário não encontrado.");
        
        const betData = betDoc.data() as ManuBet;
        const userData = userDoc.data();
        
        if ((userData.noseCoins || 0) < amount) {
          throw new Error("Saldo insuficiente em NoseCoins.");
        }

        if (!betData.active) {
          throw new Error("Esta oferta já foi encerrada.");
        }

        // 2. Captura as odds exatas do momento ANTES da nova aposta
        const oddsAtEntry = this.calculateCurrentOdds(betData, optionLabel);

        // 3. Projeta o novo estado do mercado
        const newTotalPool = (betData.totalPool || 0) + amount;
        const newPoolByCategory = { ...betData.poolByCategory };
        newPoolByCategory[optionLabel] = (newPoolByCategory[optionLabel] || 0) + amount;

        const updatedOptions = betData.options.map(opt => ({
          ...opt,
          odds: this.calculateCurrentOdds({
            ...betData,
            totalPool: newTotalPool,
            poolByCategory: newPoolByCategory
          }, opt.label)
        }));

        const betRef = doc(collection(db, userBetPath));
        const newPlacement: UserManuBet = {
          userId,
          manuBetId: betData.id!,
          matchId: betData.matchId,
          optionLabel,
          oddsAtTime: oddsAtEntry,
          amount,
          status: 'pending',
          createdAt: new Date().toISOString()
        };

        // 4. Executa as atualizações atômicas
        transaction.set(betRef, newPlacement);
        transaction.update(userRef, { noseCoins: (userData.noseCoins || 0) - amount });
        transaction.update(manuBetRef, { 
          totalPool: newTotalPool,
          poolByCategory: newPoolByCategory,
          options: updatedOptions
        });

        return newPlacement;
      });

      return placement;
    } catch (err) {
      if (err instanceof Error && (err.message.includes("Saldo insuficiente") || err.message.includes("já possui"))) {
         throw err; 
      }
      handleFirestoreError(err, OperationType.WRITE, userBetPath);
    }
  },

  /**
   * (Usuário) Cancelar uma aposta pendente e estornar o valor
   */
  async cancelUserManuBet(userId: string, userBetId: string) {
    const userBetRef = doc(db, 'userManuBets', userBetId);
    const userRef = doc(db, 'users', userId);
    
    try {
      await runTransaction(db, async (transaction) => {
        const userBetDoc = await transaction.get(userBetRef);
        if (!userBetDoc.exists()) throw new Error("Aposta não encontrada.");
        
        const betData = userBetDoc.data() as UserManuBet;
        if (betData.status !== 'pending') throw new Error("Esta aposta já foi resolvida.");
        
        const manuBetRef = doc(db, 'manuBets', betData.manuBetId);
        const manuBetDoc = await transaction.get(manuBetRef);
        const userDoc = await transaction.get(userRef);
        
        if (!manuBetDoc.exists()) throw new Error("A oferta original não existe.");
        if (!userDoc.exists()) throw new Error("Usuário não encontrado.");

        const mBet = manuBetDoc.data() as ManuBet;
        const uData = userDoc.data();

        // 1. Estornar valor
        transaction.update(userRef, { noseCoins: (uData.noseCoins || 0) + betData.amount });

        // 2. Remover do Pool e recalcular odds
        const newTotalPool = Math.max(0, (mBet.totalPool || 0) - betData.amount);
        const newPoolByCategory = { ...mBet.poolByCategory };
        newPoolByCategory[betData.optionLabel] = Math.max(0, (newPoolByCategory[betData.optionLabel] || 0) - betData.amount);

        const updatedOptions = mBet.options.map(opt => ({
          ...opt,
          odds: this.calculateCurrentOdds({
            ...mBet,
            totalPool: newTotalPool,
            poolByCategory: newPoolByCategory
          }, opt.label)
        }));

        transaction.update(manuBetRef, {
          totalPool: newTotalPool,
          poolByCategory: newPoolByCategory,
          options: updatedOptions
        });

        // 3. Excluir a aposta
        transaction.delete(userBetRef);
      });
    } catch (err) {
      if (err instanceof Error) throw err;
      handleFirestoreError(err, OperationType.DELETE, 'userManuBets');
    }
  },

  /**
   * (Admin) Bootstrap de ofertas clássicas e exaustivas para a Copa
   */
  async bootstrapOffers() {
    console.log("Iniciando bootstrap de ofertas...");
    const { writeBatch } = await import('firebase/firestore');
    const batch = writeBatch(db);
    const path = 'manuBets';
    
    const offers = [
      { 
        title: "Campeão do Mundo 2026", 
        description: "Quem levará a taça para casa?", 
        options: [
          { label: "Brasil", odds: 4.5 },
          { label: "França", odds: 5.0 },
          { label: "Argentina", odds: 6.0 },
          { label: "Espanha", odds: 7.5 },
          { label: "Inglaterra", odds: 8.0 },
          { label: "Outro", odds: 10.0 }
        ]
      },
      {
        title: "Artilheiro da Competição",
        description: "Quem ganhará a Chuteira de Ouro?",
        options: [
          { label: "Mbappé", odds: 3.5 },
          { label: "Vinícius Jr", odds: 5.5 },
          { label: "Haaland", odds: 8.0 },
          { label: "Lionel Messi", odds: 12.0 },
          { label: "Harry Kane", odds: 9.0 }
        ]
      },
      {
        title: "Melhor Jogador (Bola de Ouro)",
        description: "Quem será eleito o craque da Copa 2026?",
        options: [
          { label: "Vinícius Jr", odds: 6.0 },
          { label: "Jude Bellingham", odds: 7.0 },
          { label: "Mbappé", odds: 5.5 },
          { label: "Lamine Yamal", odds: 10.0 }
        ]
      },
      {
        title: "Melhor Campanha das Américas",
        description: "Qual seleção das Américas chegará mais longe?",
        options: [
          { label: "Brasil", odds: 1.9 },
          { label: "EUA", odds: 3.8 },
          { label: "Argentina", odds: 2.2 },
          { label: "México", odds: 5.5 },
          { label: "Canadá", odds: 15.0 }
        ]
      },
      {
        title: "Melhor Campanha da África",
        description: "Qual seleção africana terá o melhor desempenho?",
        options: [
          { label: "Marrocos", odds: 2.5 },
          { label: "Senegal", odds: 3.0 },
          { label: "Nigéria", odds: 4.5 },
          { label: "Egito", odds: 6.0 }
        ]
      },
      {
        title: "Luva de Ouro (Melhor Goleiro)",
        description: "Quem será eleito o melhor goleiro da Copa?",
        options: [
          { label: "Alisson", odds: 4.0 },
          { label: "E. Martínez", odds: 4.5 },
          { label: "Courtois", odds: 5.0 },
          { label: "Maignan", odds: 6.0 }
        ]
      },
      {
        title: "Seleção Revelação",
        description: "Qual time será a maior surpresa chegando às quartas?",
        options: [
          { label: "Marrocos", odds: 3.0 },
          { label: "Japão", odds: 4.0 },
          { label: "Canadá", odds: 5.0 },
          { label: "Coreia do Sul", odds: 6.5 }
        ]
      },
      {
        title: "Total de Gols na Copa",
        description: "Mais ou menos de 170.5 gols em todo o torneio?",
        options: [
          { label: "Acima de 170.5", odds: 1.85 },
          { label: "Abaixo de 170.5", odds: 1.85 }
        ]
      },
      {
        title: "Haverá um Hat-trick?",
        description: "Algum jogador marcará 3 gols em um único jogo?",
        options: [
          { label: "Sim", odds: 2.10 },
          { label: "Não", odds: 1.65 }
        ]
      },
      {
        title: "Finalistas da Copa 2026",
        description: "Quais serão os dois times da grande final?",
        options: [
          { label: "Brasil x França", odds: 12.0 },
          { label: "Argentina x Espanha", odds: 15.0 },
          { label: "Brasil x Argentina", odds: 18.0 },
          { label: "Inglaterra x França", odds: 14.0 }
        ]
      }
    ];
 
    try {
      console.log(`Preparando batch com ${offers.length} ofertas...`);
      for (const off of offers) {
        const ref = doc(collection(db, path));
        
        const sumProbabilities = off.options.reduce((acc, o) => acc + (1 / Math.max(1.01, o.odds)), 0);
        const initialMargin = 1 / sumProbabilities;

        const poolByCategory: Record<string, number> = {};
        let totalPool = 0;
        const baseLiquidity = 10000;
        
        off.options.forEach(opt => {
          const weight = 1 / Math.max(1.01, opt.odds);
          poolByCategory[opt.label] = weight * baseLiquidity;
          totalPool += poolByCategory[opt.label];
        });
 
        const newBet = {
          ...off,
          id: ref.id,
          matchId: 'global',
          active: true,
          totalPool,
          poolByCategory,
          initialMargin,
          createdAt: new Date().toISOString()
        };
        batch.set(ref, newBet);
      }
      console.log("Commitando batch no Firestore...");
      await batch.commit();
      console.log("Batch concluído com sucesso!");
    } catch (err) {
      console.error("Erro no bootstrapOffers:", err);
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  },

  /**
   * Listar as apostas realizadas pelo usuário
   */
  async getUserPlacements(userId: string) {
    const path = 'userManuBets';
    try {
      const q = query(collection(db, path), where('userId', '==', userId), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserManuBet));
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, path);
      return [];
    }
  },

  /**
   * (Admin) Resolver uma aposta, distribuindo prêmios
   */
  async resolveManuBet(manuBetId: string, winningLabel: string) {
    const manuBetPath = `manuBets/${manuBetId}`;
    try {
      // 1. Marcar a aposta como inativa
      await setDoc(doc(db, 'manuBets', manuBetId), { active: false }, { merge: true });

      // 2. Buscar todos os usuários que apostaram
      const q = query(collection(db, 'userManuBets'), where('manuBetId', '==', manuBetId), where('status', '==', 'pending'));
      const snap = await getDocs(q);

      for (const betDoc of snap.docs) {
        const bet = betDoc.data() as UserManuBet;
        const isWinner = bet.optionLabel === winningLabel;
        const status = isWinner ? 'won' : 'lost';

        await setDoc(betDoc.ref, { status }, { merge: true });

        if (isWinner) {
          // Adicionar ganhos ao saldo do usuário
          const prize = Math.floor(bet.amount * bet.oddsAtTime);
          await setDoc(doc(db, 'users', bet.userId), { noseCoins: increment(prize) }, { merge: true });
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, manuBetPath);
    }
  },

  /**
   * (Admin) Atualizar uma oferta ManuBet
   */
  async updateManuBet(manuBetId: string, data: Partial<ManuBet>) {
    const path = `manuBets/${manuBetId}`;
    try {
      await setDoc(doc(db, 'manuBets', manuBetId), data, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  },

  /**
   * (Admin) Excluir uma oferta ManuBet
   */
  async deleteManuBet(manuBetId: string) {
    const path = `manuBets/${manuBetId}`;
    try {
      const { deleteDoc } = await import('firebase/firestore');
      await deleteDoc(doc(db, 'manuBets', manuBetId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  }
};
