import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Home, Calendar, Trophy, Coins, User, LogOut, Menu, X, Settings, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { NoseCoin } from './NoseCoin';
import { cn } from '../lib/utils';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Navbar = ({ activeTab, setActiveTab }: NavbarProps) => {
  const { profile } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navItems = [
    { id: 'dashboard', label: 'Início', icon: Home },
    { id: 'betting', label: 'Todos os Jogos', icon: Calendar },
    { id: 'leaderboard', label: 'Ranking', icon: Trophy },
    { id: 'manubet', label: 'ManuBet', icon: Coins },
    { id: 'profile', label: 'Perfil', icon: User },
  ];

  if (profile?.isAdmin) {
    navItems.push({ id: 'admin', label: 'Admin', icon: ShieldCheck });
  }

  return (
    <>
      {/* Desktop Sidebar */}
      <nav className="fixed left-0 top-0 h-full w-20 lg:w-64 bg-editorial-navy/80 backdrop-blur-xl text-white hidden md:flex flex-col border-r border-white/5 z-50">
        <div className="h-[70px] px-6 flex items-center gap-3 border-b border-white/5">
          <span className="font-extrabold text-xl hidden lg:block tracking-tighter uppercase">COPA<span className="text-editorial-gold">2026</span></span>
          <div className="w-8 h-8 bg-editorial-gold rounded flex items-center justify-center font-black text-editorial-navy lg:hidden">26</div>
        </div>

        <div className="mt-8 flex-1 px-4 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all group relative",
                activeTab === item.id 
                  ? "text-editorial-gold" 
                  : "text-white/60 hover:text-white"
              )}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              <span className="font-bold text-sm tracking-widest uppercase hidden lg:block">{item.label}</span>
              {activeTab === item.id && (
                <motion.div layoutId="nav-pill" className="absolute left-0 w-1 h-6 bg-editorial-gold rounded-r-full" />
              )}
            </button>
          ))}
        </div>

        <div className="p-4 border-t border-white/5 space-y-4">
          <div className="hidden lg:flex items-center gap-3 px-4 py-2 bg-editorial-gold/10 border border-editorial-gold/20 rounded-full">
             <NoseCoin size={24} />
             <div className="flex flex-col">
               <span className="font-mono font-bold text-editorial-gold text-sm">{profile?.noseCoins?.toLocaleString() || 0} NC</span>
             </div>
          </div>
          <button 
            onClick={() => signOut(auth)}
            className="w-full flex items-center gap-4 px-4 py-3 text-white/40 hover:text-red-400 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-bold text-sm tracking-widest uppercase hidden lg:block">Sair</span>
          </button>
        </div>
      </nav>

      {/* Mobile Top Bar */}
      <nav className="fixed top-0 left-0 right-0 h-[70px] bg-editorial-navy/80 backdrop-blur-xl border-b border-white/5 md:hidden flex items-center justify-between px-6 z-50">
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-white tracking-tighter uppercase">COPA<span className="text-editorial-gold">2026</span></span>
        </div>
        
        <div className="flex items-center gap-4">
           <div className="flex items-center gap-2 bg-editorial-gold/15 px-3 py-1.5 rounded-full border border-editorial-gold/30">
             <NoseCoin size={18} />
             <span className="text-sm font-mono font-bold text-editorial-gold">{profile?.noseCoins?.toLocaleString() || 0}</span>
           </div>
           <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="text-white">
             {isMenuOpen ? <X /> : <Menu />}
           </button>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            className="fixed inset-0 bg-slate-900 z-40 md:hidden flex flex-col pt-20 px-6 gap-2"
          >
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsMenuOpen(false);
                }}
                className={cn(
                  "flex items-center gap-4 py-4 px-4 rounded-xl",
                  activeTab === item.id ? "bg-blue-600 text-white" : "text-slate-400"
                )}
              >
                <item.icon className="w-6 h-6" />
                <span className="font-medium text-lg">{item.label}</span>
              </button>
            ))}
            <button 
              onClick={() => {
                signOut(auth);
                setIsMenuOpen(false);
              }}
              className="mt-auto mb-10 flex items-center gap-4 py-4 px-4 text-red-500"
            >
              <LogOut className="w-6 h-6" />
              <span className="font-medium text-lg">Sair</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
