import { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, Users, Calendar, Database, Send, Plus, Search, MoreVertical, Edit, Trash, CheckCircle, Loader2, Clock } from 'lucide-react';
import { cn } from '../lib/utils';
import { collection, getCountFromServer } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { soccerService } from '../services/soccerService';
import { bettingService } from '../services/bettingService';
import { CountdownTimer } from '../components/CountdownTimer';

export const Admin = () => {
  const [activeSubTab, setActiveSubTab] = useState('overview');
  const [syncing, setSyncing] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [counts, setCounts] = useState({ users: 0, matches: 0, bets: 0, manuBets: 0, userManuBets: 0 });
  const [matches, setMatches] = useState<any[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [manuBets, setManuBets] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [newManuBetModal, setNewManuBetModal] = useState({
    isOpen: false,
    matchId: '',
    title: '',
    description: '',
    options: [{ label: '', odds: 2.0 }, { label: '', odds: 2.0 }]
  });
  const [editManuBetModal, setEditManuBetModal] = useState({
    isOpen: false,
    id: '',
    matchId: '',
    title: '',
    description: '',
    options: [{ label: '', odds: 2.0 }, { label: '', odds: 2.0 }]
  });
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; match: any; scores: { a: number; b: number } | null }>({
    isOpen: false,
    match: null,
    scores: null
  });

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const { getDocs, query, orderBy, limit } = await import('firebase/firestore');
      const q = query(collection(db, 'users'), orderBy('points', 'desc'), limit(50));
      const snap = await getDocs(q);
      setUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchMatches = async () => {
    setLoadingMatches(true);
    try {
      const data = await soccerService.getLocalMatches();
      setMatches(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMatches(false);
    }
  };

  const loadManuBets = async () => {
    try {
      const data = await bettingService.getActiveManuBets();
      setManuBets(data);
    } catch (err) {
      console.error("Erro ao carregar manuBets:", err);
    }
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const usersCount = await getCountFromServer(collection(db, 'users'));
        const matchesCount = await getCountFromServer(collection(db, 'matches'));
        const betsCount = await getCountFromServer(collection(db, 'bets'));
        const manuBetsCount = await getCountFromServer(collection(db, 'manuBets'));
        const userManuBetsCount = await getCountFromServer(collection(db, 'userManuBets'));
        setCounts({
          users: usersCount.data().count,
          matches: matchesCount.data().count,
          bets: betsCount.data().count,
          manuBets: manuBetsCount.data().count,
          userManuBets: userManuBetsCount.data().count
        });
      } catch (err) {
        console.error(err);
      }
    };
    fetchStats();
    fetchMatches();
    fetchUsers();
  }, []);

  useEffect(() => {
    if (activeSubTab === 'manubet') loadManuBets();
    if (activeSubTab === 'users') fetchUsers();
  }, [activeSubTab]);

  const handleUpdateScore = async (matchId: string, scoreA: number, scoreB: number) => {
    try {
      await soccerService.updateMatchScore(matchId, scoreA, scoreB);
      alert('Placar atualizado e pontos calculados!');
      fetchMatches();
    } catch (err) {
      alert('Erro ao atualizar placar.');
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const count = await soccerService.syncWorldCupMatches();
      alert(`${count} jogos sincronizados com sucesso!`);
      fetchMatches();
    } catch (err) {
      alert('Falha na sincronização. Verifique a chave da API no .env.');
    } finally {
      setSyncing(false);
    }
  };

  const stats = [
    { label: 'Usuários Totais', value: counts.users.toLocaleString(), icon: Users, color: 'text-blue-500' },
    { label: 'Jogos Cadastrados', value: counts.matches.toLocaleString(), icon: Calendar, color: 'text-green-500' },
    { label: 'Palpites (Jogos)', value: counts.bets.toLocaleString(), icon: Send, color: 'text-yellow-500' },
    { label: 'Apostas ManuBet', value: counts.userManuBets.toLocaleString(), icon: Database, color: 'text-purple-500' },
  ];

  return (
    <div className="space-y-8 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-white uppercase tracking-tight flex items-center gap-3">
            <ShieldCheck className="w-10 h-10 text-blue-500" /> PAINEL ADMIN
          </h2>
          <p className="text-slate-400">Controle total sobre o ecossistema da Copa 2026.</p>
        </div>
      </header>

      {/* Admin Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
            className="bg-slate-900 border border-slate-800 p-6 rounded-3xl"
          >
            <div className="flex items-center gap-4">
              <div className={cn("p-4 rounded-2xl bg-slate-800", stat.color)}>
                <stat.icon size={24} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{stat.label}</p>
                <p className="text-3xl font-black text-white">{stat.value}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="flex flex-col xl:flex-row gap-8 mt-8">
        {/* Admin Navigation */}
        <div className="w-full xl:w-72 space-y-2">
          {[
            { id: 'overview', label: 'Visão Geral', icon: Database },
            { id: 'users', label: 'Gestão de Usuários', icon: Users },
            { id: 'matches', label: 'Calendário & Jogos', icon: Calendar },
            { id: 'manubet', label: 'Config ManuBet', icon: Send },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSubTab(item.id)}
              className={cn(
                "w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-bold transition-all",
                activeSubTab === item.id ? "bg-white text-slate-900" : "bg-slate-900 text-slate-400 hover:bg-slate-800"
              )}
            >
              <item.icon size={20} />
              {item.label}
            </button>
          ))}
        </div>

        {/* Admin Content Area */}
        <div className="flex-1 bg-slate-900 border border-slate-800 rounded-[32px] p-8 overflow-hidden min-h-[600px]">
          {activeSubTab === 'overview' && (
            <div className="space-y-8">
              <h3 className="text-2xl font-bold text-white mb-6 italic">Visão Geral do Sistema</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-800/30 p-8 rounded-[32px] border border-slate-800 flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-white mb-2 uppercase text-xs tracking-widest text-slate-500">Engajamento de Apostas</h4>
                    <p className="text-4xl font-black text-white italic">{(counts.bets + counts.userManuBets).toLocaleString()}</p>
                    <p className="text-sm text-slate-400 mt-2">Palpites totais em todo o sistema.</p>
                  </div>
                  <div className="mt-8 flex gap-4">
                    <div className="flex-1 bg-slate-900/50 p-4 rounded-2xl border border-slate-800/50">
                      <p className="text-[10px] font-bold text-slate-500 uppercase">Match Bets</p>
                      <p className="text-xl font-bold text-yellow-500">{counts.bets}</p>
                    </div>
                    <div className="flex-1 bg-slate-900/50 p-4 rounded-2xl border border-slate-800/50">
                      <p className="text-[10px] font-bold text-slate-500 uppercase">Casino Bets</p>
                      <p className="text-xl font-bold text-purple-500">{counts.userManuBets}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-800/30 p-8 rounded-[32px] border border-slate-800 flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-white mb-2 uppercase text-xs tracking-widest text-slate-500">Base de Usuários</h4>
                    <p className="text-4xl font-black text-white italic">{counts.users.toLocaleString()}</p>
                    <p className="text-sm text-slate-400 mt-2">Jogadores ativos registrados.</p>
                  </div>
                  <div className="mt-8 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-bold uppercase">Meta de Crescimento</span>
                      <span className="text-white font-black">72%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 w-[72%]" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-slate-800/30 p-6 rounded-2xl border border-slate-800">
                  <h4 className="font-bold text-white mb-4 uppercase text-xs tracking-widest">Atividade Recente (Simulado)</h4>
                  <ul className="space-y-3">
                    <li className="text-sm text-slate-400 border-l-2 border-green-500 pl-3 flex justify-between">
                      <span>Nova aposta em BRA x FRA</span>
                      <span className="text-[10px] text-slate-600 font-mono italic">2m ago</span>
                    </li>
                    <li className="text-sm text-slate-400 border-l-2 border-blue-500 pl-3 flex justify-between">
                      <span>Novo usuário registrado</span>
                      <span className="text-[10px] text-slate-600 font-mono italic">15m ago</span>
                    </li>
                    <li className="text-sm text-slate-400 border-l-2 border-yellow-500 pl-3 flex justify-between">
                      <span>Resultado lançado: ARG 3 x 1 MEX</span>
                      <span className="text-[10px] text-slate-600 font-mono italic">2h ago</span>
                    </li>
                  </ul>
                </div>
                <div className="bg-slate-800/30 p-6 rounded-2xl border border-slate-800">
                  <h4 className="font-bold text-white mb-4 uppercase text-xs tracking-widest">Manutenção do Sistema</h4>
                  <div className="space-y-4">
                    <button
                      onClick={handleSync}
                      disabled={syncing}
                      className="w-full text-left p-4 bg-slate-950 hover:bg-slate-900 rounded-2xl text-sm text-slate-300 flex items-center justify-between border border-slate-800 transition-all group"
                    >
                      <span className="flex items-center gap-3">
                        <Database size={18} className="text-blue-500" />
                        Sincronizar Dados da API
                      </span>
                      {syncing ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} className="text-slate-500 group-hover:text-blue-500" />}
                    </button>
                    <button className="w-full text-left p-4 bg-slate-950 hover:bg-slate-900 rounded-2xl text-sm text-slate-300 flex items-center justify-between border border-slate-800 transition-all group">
                      <span className="flex items-center gap-3">
                        <CheckCircle size={18} className="text-green-500" />
                        Limpar Cache Global
                      </span>
                      <CheckCircle size={16} className="text-slate-500 group-hover:text-green-500" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSubTab === 'users' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-600" />
                  <input type="text" placeholder="Buscar usuário..." className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-12 pr-4 text-white" />
                </div>
                <button className="bg-slate-800 p-3 rounded-xl hover:bg-slate-700"><Plus size={24} className="text-white" /></button>
              </div>
              <div className="space-y-3">
                {loadingUsers ? (
                  <div className="p-12 text-center text-slate-500 italic">Carregando usuários...</div>
                ) : users.length === 0 ? (
                  <div className="p-12 text-center text-slate-500 italic">Nenhum usuário encontrado.</div>
                ) : users.map((u) => (
                  <div key={u.id} className="flex items-center justify-between p-4 bg-slate-950 rounded-2xl border border-slate-800 hover:border-slate-600 transition-all">
                    <div className="flex items-center gap-4">
                      <img
                        src={u.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.uid}`}
                        alt={u.displayName}
                        className="w-10 h-10 rounded-full bg-slate-800"
                        referrerPolicy="no-referrer"
                      />
                      <div>
                        <p className="font-bold text-white flex items-center gap-2">
                          {u.displayName}
                          {u.isAdmin && <span className="text-[9px] bg-blue-600 text-white px-1.5 py-0.5 rounded uppercase">Admin</span>}
                        </p>
                        <p className="text-xs text-slate-500">{u.email} • {u.noseCoins?.toLocaleString() || 0} NC • {u.points || 0} pts</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"><Edit size={16} /></button>
                      <button className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-red-500"><Trash size={16} /></button>
                      <button className="p-2 hover:bg-slate-800 rounded-lg text-slate-400"><MoreVertical size={16} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSubTab === 'matches' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">Próximos Confrontos</h3>
                <div className="flex gap-2">
                  <button
                    onClick={handleSync}
                    disabled={true}
                    className="bg-green-600 hover:bg-green-500 text-white font-bold px-6 py-2 rounded-xl flex items-center gap-2 disabled:opacity-50"
                  >
                    {syncing ? 'Sincronizando...' : 'Importar da API'}
                  </button>
                  <button className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-2 rounded-xl flex items-center gap-2">
                    <Plus size={18} /> Novo Jogo
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4">
                {loadingMatches ? <p className="text-white/40 italic">Carregando jogos do banco...</p> :
                  matches.length === 0 ? <p className="text-white/40 italic">Nenhum jogo sincronizado. Use o botão Importar da API.</p> :
                    matches.map((m) => (
                      <div key={m.id} className="bg-slate-950 p-6 rounded-3xl border border-slate-800 flex items-center justify-between group">
                        <div className="flex items-center gap-6">
                          <div className="flex flex-col items-center gap-2 min-w-[100px]">
                            <div className="w-12 h-8 bg-slate-800 rounded-md overflow-hidden flex items-center justify-center border border-white/10 shadow-lg">
                              {m.flagA && m.flagA.length > 5 ? (
                                <img
                                  src={m.flagA}
                                  alt={m.teamA}
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <span className="text-xl">{m.flagA || '🏳️'}</span>
                              )}
                            </div>
                            <span className="font-bold text-white text-xs uppercase tracking-wider">{m.teamA}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              placeholder="0"
                              className="w-12 bg-black border border-slate-700 rounded-lg p-2 text-center text-white font-black"
                              defaultValue={m.scoreA}
                              id={`scoreA-${m.id}`}
                            />
                            <span className="text-xl font-black text-slate-700">X</span>
                            <input
                              type="number"
                              placeholder="0"
                              className="w-12 bg-black border border-slate-700 rounded-lg p-2 text-center text-white font-black"
                              defaultValue={m.scoreB}
                              id={`scoreB-${m.id}`}
                            />
                          </div>
                          <div className="flex flex-col items-center gap-2 min-w-[100px]">
                            <div className="w-12 h-8 bg-slate-800 rounded-md overflow-hidden flex items-center justify-center border border-white/10 shadow-lg">
                              {m.flagB && m.flagB.length > 5 ? (
                                <img
                                  src={m.flagB}
                                  alt={m.teamB}
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <span className="text-xl">{m.flagB || '🏳️'}</span>
                              )}
                            </div>
                            <span className="font-bold text-white text-xs uppercase tracking-wider">{m.teamB}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">{m.stage?.replace('_', ' ') || 'FASE DE GRUPOS'}</p>
                            <p className="text-[10px] font-bold text-slate-500 uppercase">{new Date(m.date).toLocaleDateString()} • {new Date(m.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                            <p className={cn("text-xs font-black uppercase mt-1", m.finished ? "text-green-500" : "text-yellow-500")}>
                              {m.finished ? 'ENCERRADO / CALCULADO' : 'AGUARDANDO RESULTADO'}
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              const a = (document.getElementById(`scoreA-${m.id}`) as HTMLInputElement).value;
                              const b = (document.getElementById(`scoreB-${m.id}`) as HTMLInputElement).value;
                              setConfirmModal({
                                isOpen: true,
                                match: m,
                                scores: { a: parseInt(a), b: parseInt(b) }
                              });
                            }}
                            className={cn(
                              "font-black px-4 py-3 rounded-xl transition-all flex items-center gap-2",
                              m.finished ? "bg-slate-800 text-slate-500" : "bg-yellow-500 text-slate-900 hover:bg-yellow-400"
                            )}
                          >
                            <CheckCircle size={18} /> {m.finished ? 'Recalcular' : 'Lançar'}
                          </button>
                        </div>
                      </div>
                    ))
                }
              </div>
            </div>
          )}

          {activeSubTab === 'manubet' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">Configuração ManuBet</h3>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      if (confirm("Deseja gerar as ofertas padrões para a Copa?")) {
                        setBootstrapping(true);
                        try {
                          await bettingService.bootstrapOffers();
                          alert("Ofertas geradas!");
                          loadManuBets();
                        } catch (err) {
                          console.error(err);
                          alert("Erro ao gerar ofertas. Verifique as permissões de Admin.");
                        } finally {
                          setBootstrapping(false);
                        }
                      }
                    }}
                    disabled={bootstrapping}
                    className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-2 rounded-xl flex items-center gap-2 disabled:opacity-50"
                  >
                    {bootstrapping ? <Loader2 className="animate-spin" size={18} /> : 'Gerar Ofertas Iniciais'}
                  </button>
                  <button
                    onClick={() => setNewManuBetModal({ ...newManuBetModal, isOpen: true })}
                    className="bg-editorial-gold text-editorial-navy font-bold px-6 py-2 rounded-xl flex items-center gap-2"
                  >
                    <Plus size={18} /> Criar Nova Oferta
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {manuBets.map(mb => (
                  <div key={mb.id} className="bg-slate-950 p-6 rounded-3xl border border-slate-800 flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] bg-blue-500/10 text-blue-500 px-2 py-1 rounded font-black uppercase">
                          {matches.find(m => m.id === mb.matchId) ? (
                            `${matches.find(m => m.id === mb.matchId).teamA} x ${matches.find(m => m.id === mb.matchId).teamB}`
                          ) : 'Aposta Global'}
                        </span>
                        {matches.find(m => m.id === mb.matchId) && mb.active && (
                          <CountdownTimer targetDate={matches.find(m => m.id === mb.matchId).date} />
                        )}
                      </div>
                      <h4 className="font-bold text-white">{mb.title}</h4>
                      <p className="text-xs text-slate-500">{mb.description}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {mb.options.map(opt => {
                          const marketOdds = bettingService.calculateCurrentOdds(mb, opt.label);
                          return (
                            <div key={opt.label} className="bg-slate-900 border border-slate-800 rounded-xl p-3 min-w-[120px]">
                              <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">{opt.label}</p>
                              <div className="flex items-baseline gap-2">
                                <span className="text-xl font-black text-white">x{marketOdds.toFixed(2)}</span>
                                <span className="text-[10px] text-slate-600 line-through">x{opt.odds}</span>
                              </div>
                              <p className="text-[8px] text-slate-700 mt-1 uppercase font-bold tracking-tighter">
                                Pool: {(mb.poolByCategory[opt.label] || 0).toLocaleString()} NC
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex flex-col gap-3 items-end">
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditManuBetModal({
                              isOpen: true,
                              id: mb.id!,
                              matchId: mb.matchId || '',
                              title: mb.title,
                              description: mb.description,
                              options: mb.options
                            });
                          }}
                          className="bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white p-3 rounded-2xl transition-all"
                          title="Editar Oferta"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (confirm("Deseja EXCLUIR esta oferta de aposta? Todos os dados serão perdidos.")) {
                              await bettingService.deleteManuBet(mb.id!);
                              loadManuBets();
                            }
                          }}
                          className="bg-red-500/10 border border-red-500/20 hover:bg-red-500 text-red-500 hover:text-white p-3 rounded-2xl transition-all"
                          title="Excluir Oferta"
                        >
                          <Trash size={18} />
                        </button>
                      </div>

                      {mb.active ? (
                        <div className="flex flex-wrap gap-2 justify-end">
                          {mb.options.map(opt => (
                            <button
                              key={opt.label}
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (confirm(`Confirmar ${opt.label} como vencedor?`)) {
                                  await bettingService.resolveManuBet(mb.id!, opt.label);
                                  alert("Resultados processados!");
                                  loadManuBets();
                                }
                              }}
                              className="bg-green-600 hover:bg-green-500 text-white text-[10px] font-black px-4 py-2 rounded-xl"
                            >
                              GANHOU: {opt.label}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl">
                          <CheckCircle size={14} className="text-slate-500" />
                          <span className="text-[10px] font-bold text-slate-500 uppercase">Finalizada</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {manuBets.length === 0 && (
                  <div className="p-8 bg-slate-950 rounded-3xl border border-slate-800 text-center text-slate-500 italic">
                    Nenhuma aposta ativa no momento.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-slate-800 rounded-[32px] p-8 max-w-md w-full shadow-2xl"
          >
            <h3 className="text-2xl font-black text-white italic mb-4 uppercase">Confirmar Resultado</h3>
            <p className="text-slate-400 mb-8">
              Você está prestes a lançar o placar de <span className="text-white font-bold">{confirmModal.match?.teamA} {confirmModal.scores?.a} x {confirmModal.scores?.b} {confirmModal.match?.teamB}</span>.
              Isso recalculará todos os pontos dos usuários instantaneamente.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setConfirmModal({ isOpen: false, match: null, scores: null })}
                className="bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 rounded-2xl transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (confirmModal.match && confirmModal.scores) {
                    handleUpdateScore(confirmModal.match.id, confirmModal.scores.a, confirmModal.scores.b);
                  }
                  setConfirmModal({ isOpen: false, match: null, scores: null });
                }}
                className="bg-green-600 hover:bg-green-500 text-white font-black py-4 rounded-2xl transition-all shadow-lg shadow-green-500/20"
              >
                Confirmar
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* New ManuBet Offer Modal */}
      {newManuBetModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-slate-800 rounded-[32px] p-8 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-2xl font-black text-white italic mb-6 uppercase">Nova Oferta ManuBet</h3>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Jogo Vinculado</label>
                <select
                  value={newManuBetModal.matchId}
                  onChange={e => setNewManuBetModal({ ...newManuBetModal, matchId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-sm"
                >
                  <option value="">Selecione um jogo...</option>
                  {matches.map(m => (
                    <option key={m.id} value={m.id}>{m.teamA} x {m.teamB} ({new Date(m.date).toLocaleDateString()})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Título</label>
                <input
                  type="text"
                  value={newManuBetModal.title}
                  onChange={e => setNewManuBetModal({ ...newManuBetModal, title: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white"
                  placeholder="Ex: Artilheiro do Jogo"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Descrição</label>
                <input
                  type="text"
                  value={newManuBetModal.description}
                  onChange={e => setNewManuBetModal({ ...newManuBetModal, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white"
                  placeholder="Descrição da oferta..."
                />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-slate-500 uppercase block">Opções e Odds de Entrada</label>
                {newManuBetModal.options.map((opt, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      type="text"
                      value={opt.label}
                      onChange={e => {
                        const newOpts = [...newManuBetModal.options];
                        newOpts[i].label = e.target.value;
                        setNewManuBetModal({ ...newManuBetModal, options: newOpts });
                      }}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-sm"
                      placeholder="Nome da opção"
                    />
                    <input
                      type="number"
                      step="0.1"
                      value={opt.odds}
                      onChange={e => {
                        const newOpts = [...newManuBetModal.options];
                        newOpts[i].odds = parseFloat(e.target.value);
                        setNewManuBetModal({ ...newManuBetModal, options: newOpts });
                      }}
                      className="w-24 bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-sm"
                    />
                    <button
                      onClick={() => {
                        const newOpts = newManuBetModal.options.filter((_, idx) => idx !== i);
                        setNewManuBetModal({ ...newManuBetModal, options: newOpts });
                      }}
                      className="p-3 text-red-500"
                    >
                      <Trash size={18} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => {
                    setNewManuBetModal({
                      ...newManuBetModal,
                      options: [...newManuBetModal.options, { label: '', odds: 2.0 }]
                    });
                  }}
                  className="w-full py-2 border-2 border-dashed border-slate-800 rounded-xl text-slate-500 hover:text-white hover:border-slate-600 transition-all text-xs font-bold uppercase"
                >
                  + Adicionar Opção
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-8">
              <button
                onClick={() => setNewManuBetModal({ ...newManuBetModal, isOpen: false })}
                className="bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 rounded-2xl transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  if (!newManuBetModal.matchId || !newManuBetModal.title || newManuBetModal.options.some(o => !o.label)) {
                    alert("Selecione um jogo e preencha todos os campos corretamente.");
                    return;
                  }
                  try {
                    await bettingService.createManuBet({
                      matchId: newManuBetModal.matchId,
                      title: newManuBetModal.title,
                      description: newManuBetModal.description,
                      active: true,
                      options: newManuBetModal.options
                    });
                    setNewManuBetModal({ isOpen: false, matchId: '', title: '', description: '', options: [{ label: '', odds: 2.0 }, { label: '', odds: 2.0 }] });
                    loadManuBets();
                    alert("Oferta criada com sucesso!");
                  } catch (e) {
                    console.error(e);
                    alert("Erro ao criar oferta. Verifique sua conexão e permissões.");
                  }
                }}
                className="bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl transition-all"
              >
                Criar Oferta
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Edit ManuBet Offer Modal */}
      {editManuBetModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-slate-800 rounded-[32px] p-8 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-2xl font-black text-white italic mb-6 uppercase">Editar Oferta ManuBet</h3>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Jogo Vinculado</label>
                <select
                  value={editManuBetModal.matchId}
                  onChange={e => setEditManuBetModal({ ...editManuBetModal, matchId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-sm"
                >
                  <option value="">Selecione um jogo...</option>
                  {matches.map(m => (
                    <option key={m.id} value={m.id}>{m.teamA} x {m.teamB}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Título</label>
                <input
                  type="text"
                  value={editManuBetModal.title}
                  onChange={e => setEditManuBetModal({ ...editManuBetModal, title: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Descrição</label>
                <input
                  type="text"
                  value={editManuBetModal.description}
                  onChange={e => setEditManuBetModal({ ...editManuBetModal, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white"
                />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-slate-500 uppercase block">Opções (Indisponível para edição aqui para manter consistência do pool)</label>
                {editManuBetModal.options.map((opt, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      disabled
                      type="text"
                      value={opt.label}
                      className="flex-1 bg-slate-800 border border-slate-700 rounded-xl p-3 text-slate-500 text-sm cursor-not-allowed"
                    />
                    <div className="w-24 bg-slate-800 border border-slate-700 rounded-xl p-3 text-slate-500 text-sm flex items-center justify-center">
                      x{opt.odds}
                    </div>
                  </div>
                ))}
                <p className="text-[10px] text-slate-500 italic">* Para alterar opções e odds base, exclua e crie uma nova oferta.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-8">
              <button
                onClick={() => setEditManuBetModal({ ...editManuBetModal, isOpen: false })}
                className="bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 rounded-2xl transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  if (!editManuBetModal.title) {
                    alert("O título é obrigatório.");
                    return;
                  }
                  try {
                    await bettingService.updateManuBet(editManuBetModal.id, {
                      matchId: editManuBetModal.matchId,
                      title: editManuBetModal.title,
                      description: editManuBetModal.description
                    });
                    setEditManuBetModal({ ...editManuBetModal, isOpen: false });
                    loadManuBets();
                    alert("Oferta atualizada com sucesso!");
                  } catch (e) {
                    console.error(e);
                    alert("Erro ao atualizar oferta.");
                  }
                }}
                className="bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-black py-4 rounded-2xl transition-all"
              >
                Salvar Alterações
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};
