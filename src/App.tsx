/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
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

function AppContent() {
  const { user, profile, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

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
