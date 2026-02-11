import type { ReactNode } from 'react';
import { useLocation } from '@remix-run/react';
import { AnimatePresence, m, useReducedMotion } from 'framer-motion';
import { motionVariants } from '~/lib/motion/config';

interface PageTransitionProps {
  children: ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation();
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence initial={false} mode="wait">
      <m.div
        key={location.pathname}
        variants={reduceMotion ? motionVariants.pageReduced : motionVariants.page}
        initial="initial"
        animate="animate"
        exit="exit"
        className="min-h-full ui-motion-layer"
      >
        {children}
      </m.div>
    </AnimatePresence>
  );
}
