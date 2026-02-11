import type { ReactNode } from 'react';
import { m, useReducedMotion, type HTMLMotionProps } from 'framer-motion';
import { motionVariants } from '~/lib/motion/config';
import { classNames } from '~/utils/classNames';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'icon';

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'ui-button--primary',
  secondary: 'ui-button--secondary',
  ghost: 'ui-button--ghost',
  danger: 'ui-button--danger',
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: 'ui-button--sm',
  md: 'ui-button--md',
  icon: 'ui-button--icon',
};

interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({
  children,
  className,
  disabled,
  type,
  variant = 'secondary',
  size = 'md',
  ...props
}: ButtonProps) {
  const reduceMotion = useReducedMotion();

  return (
    <m.button
      type={type ?? 'button'}
      disabled={disabled}
      variants={reduceMotion ? motionVariants.buttonReduced : motionVariants.button}
      initial="rest"
      animate="rest"
      whileHover={reduceMotion || disabled ? undefined : 'hover'}
      whileTap={reduceMotion || disabled ? undefined : 'tap'}
      className={classNames('ui-button ui-focus-ring', VARIANT_CLASS[variant], SIZE_CLASS[size], className)}
      {...props}
    >
      {children}
    </m.button>
  );
}
