import { useReducedMotion, type Variants } from 'framer-motion';

/**
 * Returns motion-safe variants: full animation normally, or a no-op
 * (instant, no movement) when the user has prefers-reduced-motion set.
 * Use this instead of hardcoding animation props directly on components,
 * so reduced-motion support is automatic everywhere rather than something
 * that has to be remembered per-component.
 */
export function useMotionPreset() {
  const shouldReduceMotion = useReducedMotion();

  const fadeInUp: Variants = shouldReduceMotion
    ? { hidden: { opacity: 1 }, visible: { opacity: 1 } }
    : {
        hidden: { opacity: 0, y: 12 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.28, ease: 'easeOut' } },
      };

  const fadeIn: Variants = shouldReduceMotion
    ? { hidden: { opacity: 1 }, visible: { opacity: 1 } }
    : {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0.2, ease: 'easeOut' } },
      };

  const staggerContainer: Variants = shouldReduceMotion
    ? { hidden: {}, visible: {} }
    : {
        hidden: {},
        visible: { transition: { staggerChildren: 0.05, delayChildren: 0.04 } },
      };

  const hoverLift = shouldReduceMotion ? {} : { whileHover: { y: -2 }, whileTap: { scale: 0.98 } };

  const pageTransition = shouldReduceMotion
    ? { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 1 } }
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0, transition: { duration: 0.22, ease: 'easeOut' } },
        exit: { opacity: 0, transition: { duration: 0.15 } },
      };

  return { fadeInUp, fadeIn, staggerContainer, hoverLift, pageTransition, shouldReduceMotion };
}
