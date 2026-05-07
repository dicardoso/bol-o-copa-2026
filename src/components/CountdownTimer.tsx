import { useState, useEffect, useCallback } from 'react';
import { Clock } from 'lucide-react';

interface CountdownTimerProps {
  targetDate: string;
  onExpire?: () => void;
}

export const CountdownTimer = ({ targetDate, onExpire }: CountdownTimerProps) => {
  const [timeLeft, setTimeLeft] = useState<{ d: number; h: number; m: number; s: number } | null>(null);

  const calculateTimeLeft = useCallback(() => {
    const difference = +new Date(targetDate) - +new Date();
    if (difference <= 0) return null;

    return {
      d: Math.floor(difference / (1000 * 60 * 60 * 24)),
      h: Math.floor((difference / (1000 * 60 * 60)) % 24),
      m: Math.floor((difference / 1000 / 60) % 60),
      s: Math.floor((difference / 1000) % 60),
    };
  }, [targetDate]);

  useEffect(() => {
    const initial = calculateTimeLeft();
    setTimeLeft(initial);
    
    if (!initial && onExpire) {
      onExpire();
    }

    const timer = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);
      if (!remaining) {
        clearInterval(timer);
        if (onExpire) onExpire();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [calculateTimeLeft, onExpire]);

  if (!timeLeft) {
    return (
      <span className="flex items-center gap-1 text-[10px] bg-red-500/10 text-red-500 px-2 py-1 rounded font-black uppercase">
        <Clock size={10} /> ENCERRADO
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1 text-[10px] bg-yellow-500/10 text-yellow-500 px-2 py-1 rounded font-black uppercase">
      <Clock size={10} /> {timeLeft.d > 0 ? `${timeLeft.d}d ` : ''}{timeLeft.h.toString().padStart(2, '0')}:{timeLeft.m.toString().padStart(2, '0')}:{timeLeft.s.toString().padStart(2, '0')}
    </span>
  );
};
