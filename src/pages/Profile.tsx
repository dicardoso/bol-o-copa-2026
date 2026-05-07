import { LogOut, User as UserIcon, Settings, Shield, History, Wallet, Trophy, ChevronRight, Bell, Lock, Eye, ArrowLeft, Check, Smartphone, Mail, Globe, Sword } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { NoseCoin } from '../components/NoseCoin';
import { auth, db } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect } from 'react';
import { bettingService, UserManuBet } from '../services/bettingService';
import { userService, UserPreferences, UserSecuritySettings } from '../services/userService';
import { notificationService } from '../services/notificationService';
import { soccerService, Match } from '../services/soccerService';
import { cn } from '../lib/utils';
import { query, collection, where, getDocs, orderBy, limit } from 'firebase/firestore';

type ProfileTab = 'overview' | 'security' | 'notifications';

interface ActivityItem {
  id: string;
  type: 'manuBet' | 'prediction';
  label: string;
  sublabel: string;
  date: string;
  amount?: number;
  odds?: number;
  status: 'pending' | 'won' | 'lost' | 'registered' | 'cancelled';
  result?: string;
}

export const Profile = () => {
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');
  const [history, setHistory] = useState<ActivityItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  
  useEffect(() => {
    if (user) {
      loadHistory();
    }
  }, [user]);

  const loadHistory = async () => {
    if (!user) return;
    setLoadingHistory(true);
    try {
      // Carrega apostas rápidas (manuBets) e palpites (bets) simultaneamente
      const [manuBets, predictions, matches] = await Promise.all([
        bettingService.getUserPlacements(user.uid),
        getDocs(query(
          collection(db, 'bets'), 
          where('userId', '==', user.uid), 
          orderBy('createdAt', 'desc'),
          limit(10)
        )),
        soccerService.getLocalMatches()
      ]);

      const matchesData = matches as Match[];
      const matchMap = matchesData.reduce((acc, m) => ({ ...acc, [m.id]: m }), {} as Record<string, Match>);

      const manuItems: ActivityItem[] = manuBets.map(b => ({
        id: b.id!,
        type: 'manuBet',
        label: b.optionLabel,
        sublabel: `Aposta Rápida • ${b.amount} NC @ ${b.oddsAtTime.toFixed(2)}`,
        date: b.createdAt,
        amount: b.amount,
        odds: b.oddsAtTime,
        status: b.status as any
      }));

      const predictionItems: ActivityItem[] = predictions.docs.map(doc => {
        const data = doc.data();
        const match = matchMap[data.matchId];
        return {
          id: doc.id,
          type: 'prediction',
          label: match ? `${match.teamA} x ${match.teamB}` : 'Palpite de Jogo',
          sublabel: `Placar predito: ${data.predictedScoreA} - ${data.predictedScoreB}`,
          date: data.createdAt?.toDate?.()?.toISOString() || data.updatedAt || new Date().toISOString(),
          status: 'registered'
        };
      });

      const merged = [...manuItems, ...predictionItems].sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      setHistory(merged.slice(0, 10));
    } catch (err) {
      console.error("Erro ao carregar histórico:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleUpdatePreferences = async (key: keyof UserPreferences, value: boolean) => {
    if (!user || !profile) return;
    setIsSyncing(true);
    try {
      if (key === 'pushNotifications' && value === true) {
        const success = await notificationService.subscribeToPush(user.uid);
        if (!success) {
          alert('Permissão de notificação negada ou erro no registro.');
        }
      } else if (key === 'pushNotifications' && value === false) {
        await notificationService.unsubscribeFromPush(user.uid);
      } else {
        const currentPrefs = profile.preferences || { emailNotifications: true, pushNotifications: true, marketingEmails: false };
        const newPrefs = { ...currentPrefs, [key]: value };
        await userService.updatePreferences(user.uid, newPrefs);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleTestEmail = async () => {
    if (!user || !profile?.email) return;
    setIsSyncing(true);
    try {
      await notificationService.sendEmail(
        profile.email,
        "Teste de Notificação - Nose",
        "Seu sistema de notificações está ativo e configurado corretamente!"
      );
      alert("E-mail de teste enviado!");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUpdateSecurity = async (key: keyof UserSecuritySettings, value: boolean) => {
    if (!user || !profile) return;
    const currentSecurity = profile.security || { twoStepVerification: false, publicProfile: true };
    const newSecurity = { ...currentSecurity, [key]: value };
    await userService.updateSecurity(user.uid, newSecurity);
  };

  if (activeTab === 'security') {
    const security = profile?.security || { twoStepVerification: false, publicProfile: true };
    
    return (
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="max-w-2xl mx-auto space-y-8 pb-20"
      >
        <button onClick={() => setActiveTab('overview')} className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors font-bold uppercase text-xs tracking-widest">
          <ArrowLeft size={16} /> Voltar ao Perfil
        </button>

        <header className="space-y-2">
          <h2 className="text-3xl font-black text-white uppercase italic">Segurança & Privacidade</h2>
          <p className="text-slate-500 font-medium">Controle como sua conta é protegida e quem pode ver seus dados.</p>
        </header>

        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-500">
                  <Lock size={24} />
                </div>
                <div>
                  <p className="font-bold text-white text-lg">Verificação em Duas Etapas</p>
                  <p className="text-sm text-slate-500">Adicione uma camada extra de segurança ao entrar.</p>
                </div>
              </div>
              <button 
                onClick={() => handleUpdateSecurity('twoStepVerification', !security.twoStepVerification)}
                className={cn(
                  "w-14 h-8 rounded-full transition-all relative p-1",
                  security.twoStepVerification ? "bg-blue-600" : "bg-slate-800"
                )}
              >
                <div className={cn(
                  "w-6 h-6 bg-white rounded-full transition-all shadow-sm",
                  security.twoStepVerification ? "translate-x-6" : "translate-x-0"
                )} />
              </button>
            </div>

            <div className="h-px bg-slate-800" />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-purple-500/10 rounded-2xl flex items-center justify-center text-purple-500">
                  <Eye size={24} />
                </div>
                <div>
                  <p className="font-bold text-white text-lg">Perfil Público</p>
                  <p className="text-sm text-slate-500">Permitir que outros usuários vejam suas estatísticas.</p>
                </div>
              </div>
              <button 
                onClick={() => handleUpdateSecurity('publicProfile', !security.publicProfile)}
                className={cn(
                  "w-14 h-8 rounded-full transition-all relative p-1",
                  security.publicProfile ? "bg-purple-600" : "bg-slate-800"
                )}
              >
                <div className={cn(
                  "w-6 h-6 bg-white rounded-full transition-all shadow-sm",
                  security.publicProfile ? "translate-x-6" : "translate-x-0"
                )} />
              </button>
            </div>
          </div>

          <div className="bg-slate-900/50 border border-slate-800/50 rounded-3xl p-6">
            <h4 className="text-slate-400 font-bold uppercase text-xs tracking-widest mb-4">Sessões Ativas</h4>
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <Smartphone className="text-slate-500" size={20} />
                <div>
                  <p className="text-sm font-bold text-white">Este Dispositivo</p>
                  <p className="text-[10px] text-green-500 font-black uppercase">Ativo Agora</p>
                </div>
              </div>
              <span className="text-[10px] font-mono text-slate-500">IP: 187.21.**.**</span>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  if (activeTab === 'notifications') {
    const prefs = profile?.preferences || { emailNotifications: true, pushNotifications: true, marketingEmails: false };

    return (
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="max-w-2xl mx-auto space-y-8 pb-20"
      >
        <button onClick={() => setActiveTab('overview')} className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors font-bold uppercase text-xs tracking-widest">
          <ArrowLeft size={16} /> Voltar ao Perfil
        </button>

        <header className="space-y-2">
          <h2 className="text-3xl font-black text-white uppercase italic">Preferências de Notificação</h2>
          <p className="text-slate-500 font-medium">Escolha como e quando você quer ser avisado sobre suas apostas.</p>
        </header>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-yellow-500/10 rounded-2xl flex items-center justify-center text-yellow-500">
                  <Mail size={24} />
                </div>
                <div>
                  <p className="font-bold text-white text-lg">Notificações por E-mail</p>
                  <p className="text-sm text-slate-500">Receba resultados e atualizações por e-mail.</p>
                </div>
              </div>
              <button 
                disabled={isSyncing}
                onClick={() => handleUpdatePreferences('emailNotifications', !prefs.emailNotifications)}
                className={cn(
                  "w-14 h-8 rounded-full transition-all relative p-1",
                  prefs.emailNotifications ? "bg-yellow-500" : "bg-slate-800",
                  isSyncing && "opacity-50 cursor-not-allowed"
                )}
              >
                <div className={cn(
                  "w-6 h-6 bg-white rounded-full transition-all shadow-sm",
                  prefs.emailNotifications ? "translate-x-6" : "translate-x-0"
                )} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-500/10 rounded-2xl flex items-center justify-center text-green-500">
                  <Bell size={24} />
                </div>
                <div>
                  <p className="font-bold text-white text-lg">Notificações Push</p>
                  <p className="text-sm text-slate-500">Alertas em tempo real no seu navegador ou celular.</p>
                </div>
              </div>
              <button 
                disabled={isSyncing}
                onClick={() => handleUpdatePreferences('pushNotifications', !prefs.pushNotifications)}
                className={cn(
                  "w-14 h-8 rounded-full transition-all relative p-1",
                  prefs.pushNotifications ? "bg-green-500" : "bg-slate-800",
                  isSyncing && "opacity-50 cursor-not-allowed"
                )}
              >
                <div className={cn(
                  "w-6 h-6 bg-white rounded-full transition-all shadow-sm",
                  prefs.pushNotifications ? "translate-x-6" : "translate-x-0"
                )} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-500/10 rounded-2xl flex items-center justify-center text-slate-500">
                  <Globe size={24} />
                </div>
                <div>
                  <p className="font-bold text-white text-lg">Novidades & Marketing</p>
                  <p className="text-sm text-slate-500">Seja o primeiro a saber sobre novas ofertas e bônus.</p>
                </div>
              </div>
              <button 
                disabled={isSyncing}
                onClick={() => handleUpdatePreferences('marketingEmails', !prefs.marketingEmails)}
                className={cn(
                  "w-14 h-8 rounded-full transition-all relative p-1",
                  prefs.marketingEmails ? "bg-slate-500" : "bg-slate-800",
                  isSyncing && "opacity-50 cursor-not-allowed"
                )}
              >
                <div className={cn(
                  "w-6 h-6 bg-white rounded-full transition-all shadow-sm",
                  prefs.marketingEmails ? "translate-x-6" : "translate-x-0"
                )} />
              </button>
            </div>

            <div className="pt-4">
              <button 
                onClick={handleTestEmail}
                disabled={isSyncing}
                className="w-full py-4 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2"
              >
                <Mail size={18} /> Enviar E-mail de Teste
              </button>
            </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-20">
      <header className="text-center space-y-6">
        <div className="relative inline-block">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-32 h-32 bg-slate-800 rounded-[42px] flex items-center justify-center text-5xl shadow-2xl border-4 border-slate-900 group relative overflow-hidden"
          >
            {profile?.photoURL ? (
              <img src={profile.photoURL} alt={profile.displayName} className="w-full h-full object-cover" />
            ) : (
              <UserIcon size={64} className="text-slate-600" />
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Settings className="text-white animate-spin-slow" />
            </div>
          </motion.div>
          <div className="absolute -bottom-2 -right-2 bg-gradient-to-tr from-blue-600 to-indigo-600 p-2 rounded-2xl border-4 border-slate-950 text-white shadow-xl">
             <Check size={18} fill="white" />
          </div>
        </div>
        
        <div>
          <h2 className="text-4xl font-black text-white tracking-tight leading-none mb-2 italic">
            {profile?.displayName?.toUpperCase() || 'USUÁRIO'}
          </h2>
          <div className="flex items-center justify-center gap-2">
            <span className="px-3 py-1 bg-slate-800 rounded-full text-[10px] font-black text-slate-400 uppercase tracking-widest border border-slate-700">
              {profile?.isAdmin ? 'ADMINISTRADOR' : 'APOSTADOR'}
            </span>
            <span className="text-slate-600 font-bold">•</span>
            <span className="text-slate-500 font-bold text-sm tracking-wide">{profile?.email}</span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4">
        <motion.div 
          whileHover={{ y: -4 }}
          className="bg-slate-900 border border-slate-800 p-6 rounded-[32px] flex flex-col items-center justify-center gap-3 relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <Trophy size={80} />
          </div>
          <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-500">
            <Trophy size={24} />
          </div>
          <div className="text-center">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Pontos Globais</p>
            <p className="text-4xl font-black text-white leading-none tracking-tighter">
              {profile?.points || 0}
            </p>
          </div>
        </motion.div>

        <motion.div 
          whileHover={{ y: -4 }}
          className="bg-slate-900 border border-slate-800 p-6 rounded-[32px] flex flex-col items-center justify-center gap-3 relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <NoseCoin size={80} />
          </div>
          <div className="w-12 h-12 bg-yellow-500/10 rounded-2xl flex items-center justify-center">
            <NoseCoin size={24} />
          </div>
          <div className="text-center">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Saldo Atual</p>
            <p className="text-4xl font-black text-yellow-500 leading-none tracking-tighter">
              {profile?.noseCoins?.toLocaleString() || 0}
            </p>
          </div>
        </motion.div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-lg font-black text-white uppercase italic tracking-wider flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-500" /> Histórico de Atividade
          </h3>
          <button onClick={loadHistory} className="text-[10px] font-black text-slate-500 hover:text-white uppercase tracking-widest">
            Atualizar
          </button>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-[32px] overflow-hidden divide-y divide-slate-800/50">
           {loadingHistory ? (
              <div className="p-10 text-center text-slate-500 italic font-medium">Carregando atividades...</div>
           ) : history.length > 0 ? history.slice(0, 10).map((item) => (
             <div key={item.id} className="p-5 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
               <div className="flex items-center gap-4">
                 <div className={cn(
                   "w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg",
                   item.status === 'won' ? "bg-green-500/10 text-green-500 shadow-green-500/5" :
                   item.status === 'lost' ? "bg-red-500/10 text-red-500 shadow-red-500/5" :
                   item.type === 'prediction' ? "bg-indigo-500/10 text-indigo-500" :
                   "bg-slate-800 text-slate-400"
                 )}>
                   {item.status === 'won' ? <Check size={20} className="stroke-[3]" /> : 
                    item.type === 'prediction' ? <Sword size={20} /> : <Wallet size={20} />}
                 </div>
                 <div>
                   <p className="font-black text-white text-sm uppercase tracking-tight line-clamp-1">{item.label}</p>
                   <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                     {new Date(item.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} • {item.sublabel}
                   </p>
                 </div>
               </div>
               <div className="text-right ml-4 shrink-0">
                  <span className={cn(
                    "text-[10px] font-black px-2.5 py-1 rounded-full border uppercase tracking-widest leading-none",
                    item.status === 'won' ? "bg-green-500/10 text-green-500 border-green-500/20" :
                    item.status === 'lost' ? "bg-red-500/10 text-red-500 border-red-500/20" :
                    item.status === 'registered' ? "bg-indigo-500/10 text-indigo-500 border-indigo-500/20" :
                    "bg-slate-800 text-slate-400 border-slate-700"
                  )}>
                    {item.status === 'pending' ? 'Pendente' : 
                     item.status === 'won' ? `+${Math.floor((item.amount || 0) * (item.odds || 0))}` : 
                     item.status === 'lost' ? 'Perdida' : 'Registrado'}
                  </span>
               </div>
             </div>
           )) : (
             <div className="p-12 text-center space-y-2">
               <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto opacity-20">
                 <History size={32} />
               </div>
               <p className="text-slate-500 font-medium italic">Nenhuma atividade encontrada.</p>
             </div>
           )}
        </div>
      </div>

      <div className="pt-4 space-y-3">
         <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={() => setActiveTab('security')}
              className="group flex flex-col items-start p-6 bg-slate-900 border border-slate-800 rounded-[32px] hover:bg-slate-800 transition-all text-left"
            >
               <Shield size={24} className="text-blue-500 mb-4 group-hover:scale-110 transition-transform" />
               <span className="font-black text-white uppercase text-xs tracking-widest leading-tight">Segurança &<br/>Privacidade</span>
            </button>
            <button 
              onClick={() => setActiveTab('notifications')}
              className="group flex flex-col items-start p-6 bg-slate-900 border border-slate-800 rounded-[32px] hover:bg-slate-800 transition-all text-left"
            >
               <Bell size={24} className="text-yellow-500 mb-4 group-hover:scale-110 transition-transform" />
               <span className="font-black text-white uppercase text-xs tracking-widest leading-tight">Notificações &<br/>Preferências</span>
            </button>
         </div>

         <button 
           onClick={() => signOut(auth)}
           className="w-full group overflow-hidden relative flex items-center justify-center gap-3 p-5 bg-red-500/10 border border-red-500/20 rounded-[28px] hover:bg-red-500 transition-all"
         >
            <div className="absolute inset-x-0 h-full w-2 bg-red-500 left-0 transition-all group-hover:w-full opacity-10 group-hover:opacity-100" />
            <LogOut size={20} className="text-red-500 group-hover:text-white transition-colors relative z-10" />
            <span className="font-black uppercase tracking-[0.2em] text-xs text-red-500 group-hover:text-white transition-colors relative z-10">
              Encerrar Sessão Segura
            </span>
         </button>
      </div>
    </div>
  );
};

