import { motion } from 'framer-motion';
import { useMotionPreset } from '@/lib/motion';
import type { RiskLevel } from '@/lib/mlRisk';

const RISK_COLOR: Record<RiskLevel, string> = {
  low: 'hsl(var(--success))',
  moderate: 'hsl(var(--warning))',
  high: 'hsl(var(--destructive))',
};

interface RiskGaugeProps {
  probability: number;
  risk: RiskLevel;
  size?: number;
  delay?: number;
}

export default function RiskGauge({ probability, risk, size = 64, delay = 0 }: RiskGaugeProps) {
  const { shouldReduceMotion } = useMotionPreset();
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const targetOffset = circumference * (1 - probability / 100);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${probability}% probability, ${risk} risk`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={RISK_COLOR[risk]}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: shouldReduceMotion ? targetOffset : circumference }}
          animate={{ strokeDashoffset: targetOffset }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.9, delay: shouldReduceMotion ? 0 : delay, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-bold" style={{ color: RISK_COLOR[risk] }}>{probability}%</span>
      </div>
    </div>
  );
}
