/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Landing } from './pages/Landing';
import { Dashboard } from './pages/Dashboard';
import { Betting } from './pages/Betting';
import { Leaderboard } from './pages/Leaderboard';
import { ManuBet } from './pages/ManuBet';
import { Profile } from './pages/Profile';
import { Admin } from './pages/Admin';
import { Navbar } from './components/Navbar';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './lib/firebase';

function AppContent() {
  const { user, profile, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'config', 'app'), (snap) => {
      if (!snap.exists()) return;
      const deployedVersion = snap.data().version as string | undefined;
      if (deployedVersion && deployedVersion !== __APP_BUILD_TIME__) {
        setUpdateAvailable(true);
      }
    });
    return unsub;
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full"
        />
        <p className="text-slate-500 font-bold uppercase tracking-widest animate-pulse">Carregando Campo...</p>
      </div>
    );
  }

  if (!user) {
    return <Landing />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard setActiveTab={setActiveTab} />;
      case 'betting': return <Betting />;
      case 'leaderboard': return <Leaderboard />;
      case 'manubet': return <ManuBet />;
      case 'profile': return <Profile />;
      case 'admin': return profile?.isAdmin ? <Admin /> : <Dashboard setActiveTab={setActiveTab} />;
      default: return <Dashboard setActiveTab={setActiveTab} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col md:flex-row">
      {updateAvailable && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-editorial-gold text-editorial-navy flex items-center justify-between px-6 py-3 shadow-lg">
          <span className="font-black text-sm uppercase tracking-wide">
            Nova versão disponível — atualize para continuar apostando.
          </span>
          <button
            onClick={() => window.location.reload()}
            className="bg-editorial-navy text-white font-black text-xs uppercase px-4 py-2 rounded-lg hover:opacity-80 transition-opacity"
          >
            Atualizar agora
          </button>
        </div>
      )}
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="flex-1 md:ml-20 lg:ml-64 pt-20 pb-10 md:pt-10 px-4 md:px-8 xl:px-12 relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
