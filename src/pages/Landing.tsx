import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Trophy, Shield, Zap, Mail, Lock, LogIn, UserPlus } from 'lucide-react';
import { NoseCoin } from '../components/NoseCoin';
import { auth } from '../lib/firebase';
import { signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';

export const Landing = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center relative overflow-hidden px-4">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-green-600 blur-[120px] rounded-full" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="z-10 w-full max-w-md text-center"
      >
        <div className="flex justify-center mb-6">
          <motion.div 
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ repeat: Infinity, duration: 4 }}
            className="w-20 h-20 bg-yellow-500 rounded-3xl flex items-center justify-center shadow-2xl shadow-yellow-500/20"
          >
            <Trophy className="w-12 h-12 text-slate-900" />
          </motion.div>
        </div>

        <h1 className="text-4xl md:text-5xl font-black tracking-tighter mb-2">BOLÃO 2026</h1>
        <p className="text-slate-400 mb-8 max-w-sm mx-auto text-lg">
          O futuro do futebol chegou. Dê seus lances, suba no ranking e ganhe <span className="text-yellow-500 font-bold inline-flex items-center gap-1"><NoseCoin size={18} /> Nose Coins</span>.
        </p>

        <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 p-8 rounded-3xl shadow-2xl">
          <div className="flex bg-slate-800 p-1 rounded-xl mb-6">
            <button 
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2 rounded-lg font-bold transition-all ${isLogin ? 'bg-blue-600 text-white' : 'text-slate-400'}`}
            >
              Login
            </button>
            <button 
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2 rounded-lg font-bold transition-all ${!isLogin ? 'bg-blue-600 text-white' : 'text-slate-400'}`}
            >
              Cadastro
            </button>
          </div>

          <form onSubmit={handleAuth} className="space-y-4 text-left">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase ml-1">E-mail</label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 pl-10 pr-4 focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all"
                  placeholder="Seu melhor e-mail"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase ml-1">Senha</label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 pl-10 pr-4 focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}

            <button 
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-900/40 flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              {isLogin ? <LogIn className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
              {isLogin ? 'Entrar Agora' : 'Criar Minha Conta'}
            </button>
          </form>

          <div className="mt-6">
            <div className="relative flex items-center py-4">
              <div className="flex-grow border-t border-slate-800"></div>
              <span className="flex-shrink mx-4 text-slate-500 text-xs font-bold uppercase">Ou entre com</span>
              <div className="flex-grow border-t border-slate-800"></div>
            </div>

            <button 
              onClick={handleGoogleLogin}
              className="w-full bg-white text-slate-900 font-bold py-3 rounded-xl flex items-center justify-center gap-3 hover:bg-slate-100 transition-all active:scale-95"
            >
              <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
              Continuar com Google
            </button>
          </div>
        </div>

        <p className="mt-8 text-slate-500 text-sm">
          Ao entrar, você concorda com nossos <a href="#" className="text-blue-500 hover:underline">Termos de Uso</a>.
        </p>
      </motion.div>
    </div>
  );
};
