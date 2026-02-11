import type { ReactNode } from 'react';
import { m, useReducedMotion, type HTMLMotionProps } from 'framer-motion';
import { motionVariants } from '~/lib/motion/config';
import { classNames } from '~/utils/classNames';

type ElevationLevel = 0 | 1 | 2 | 3 | 4 | 5;

interface CardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: ReactNode;
  interactive?: boolean;
  elevation?: ElevationLevel;
}

export function Card({
  children,
  className,
  interactive = false,
  elevation = 2,
  ...props
}: CardProps) {
  const reduceMotion = useReducedMotion();

  return (
    <m.div
      variants={reduceMotion ? motionVariants.cardReduced : motionVariants.card}
      initial="rest"
      animate="rest"
      whileHover={reduceMotion || !interactive ? undefined : 'hover'}
      whileTap={reduceMotion || !interactive ? undefined : 'tap'}
      data-interactive={interactive ? 'true' : 'false'}
      className={classNames('surface-card ui-card', `elevation-${elevation}`, className)}
      {...props}
    >
      {children}
    </m.div>
  );
}
