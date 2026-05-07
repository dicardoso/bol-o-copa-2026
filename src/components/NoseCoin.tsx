import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import noseCoinImg from '../assets/nose-coin.png';

interface NoseCoinProps {
  className?: string;
  size?: number;
}

export const NoseCoin = ({ className, size = 24 }: NoseCoinProps) => {
  return (
    <motion.div
      whileHover={{ rotateY: 180 }}
      transition={{ duration: 0.6 }}
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <img
        src={noseCoinImg}
        alt="NoseCoin"
        className="w-full h-full object-contain drop-shadow-md"
      />
    </motion.div>
  );
};
