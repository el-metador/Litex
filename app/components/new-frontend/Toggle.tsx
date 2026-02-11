import { m, useReducedMotion } from 'framer-motion';
import { motionVariants } from '~/lib/motion/config';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function Toggle({ checked, onChange }: ToggleProps) {
  const reduceMotion = useReducedMotion();

  return (
    <m.button
      onClick={() => onChange(!checked)}
      type="button"
      className={`ui-focus-ring relative inline-flex h-6 w-11 items-center rounded-full border border-white/14 transition-colors ${
        checked ? 'bg-[#10a37f]' : 'bg-white/16'
      }`}
      variants={reduceMotion ? motionVariants.buttonReduced : motionVariants.button}
      initial="rest"
      animate="rest"
      whileHover={reduceMotion ? undefined : 'hover'}
      whileTap={reduceMotion ? undefined : 'tap'}
      aria-pressed={checked}
    >
      <span
        className={`${checked ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
      />
    </m.button>
  );
}
