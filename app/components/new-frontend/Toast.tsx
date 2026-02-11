import { CheckCircle2 } from 'lucide-react';
import { AnimatePresence, m, useReducedMotion } from 'framer-motion';
import { motionVariants } from '~/lib/motion/config';

interface ToastProps {
  message: string;
  isVisible: boolean;
  onClose: () => void;
}

export function Toast({ message, isVisible, onClose }: ToastProps) {
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {isVisible ? (
        <m.div
          key="toast"
          variants={reduceMotion ? motionVariants.toastReduced : motionVariants.toast}
          initial="initial"
          animate="animate"
          exit="exit"
          className="pointer-events-none fixed left-1/2 top-5 z-[80] -translate-x-1/2"
        >
          <button
            type="button"
            onClick={onClose}
            className="ui-focus-ring pointer-events-auto flex min-w-[280px] items-center gap-3 rounded-[var(--radius-md)] border border-[#34c89f]/28 bg-[#10a37f] px-4 py-3 text-white elevation-4"
          >
            <CheckCircle2 size={20} />
            <span className="text-left text-sm font-medium">{message}</span>
          </button>
        </m.div>
      ) : null}
    </AnimatePresence>
  );
}
