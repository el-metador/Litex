import type { Transition, Variants } from 'framer-motion';

const easeOut: [number, number, number, number] = [0.22, 1, 0.36, 1];
const easeInOut: [number, number, number, number] = [0.4, 0, 0.2, 1];
const easeIn: [number, number, number, number] = [0.4, 0, 1, 1];

export const motionDurations = {
  fast: 0.14,
  base: 0.22,
  slow: 0.38,
} as const;

export const motionEasing = {
  easeOut,
  easeInOut,
  easeIn,
} as const;

export const motionSprings = {
  gentle: {
    type: 'spring',
    stiffness: 320,
    damping: 28,
    mass: 0.82,
  } as Transition,
  modal: {
    type: 'spring',
    stiffness: 360,
    damping: 30,
    mass: 0.9,
  } as Transition,
} as const;

export const motionVariants = {
  page: {
    initial: {
      opacity: 0,
      y: 14,
      scale: 0.982,
    },
    animate: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: motionDurations.base,
        ease: motionEasing.easeOut,
      },
    },
    exit: {
      opacity: 0,
      y: -10,
      scale: 0.988,
      transition: {
        duration: motionDurations.fast,
        ease: motionEasing.easeIn,
      },
    },
  },
  pageReduced: {
    initial: { opacity: 0 },
    animate: {
      opacity: 1,
      transition: {
        duration: 0.12,
        ease: motionEasing.easeInOut,
      },
    },
    exit: {
      opacity: 0,
      transition: {
        duration: 0.1,
        ease: motionEasing.easeIn,
      },
    },
  },
  card: {
    rest: {
      y: 0,
      scale: 1,
      transition: {
        duration: motionDurations.fast,
        ease: motionEasing.easeInOut,
      },
    },
    hover: {
      y: -4,
      scale: 1.016,
      transition: {
        duration: motionDurations.fast,
        ease: motionEasing.easeOut,
      },
    },
    tap: {
      scale: 0.992,
      transition: {
        duration: 0.1,
        ease: motionEasing.easeInOut,
      },
    },
  },
  cardReduced: {
    rest: { opacity: 1 },
    hover: { opacity: 1 },
    tap: { opacity: 1 },
  },
  button: {
    rest: {
      scale: 1,
      transition: {
        duration: motionDurations.fast,
        ease: motionEasing.easeInOut,
      },
    },
    hover: {
      scale: 1.015,
      transition: {
        duration: motionDurations.fast,
        ease: motionEasing.easeOut,
      },
    },
    tap: {
      scale: 0.97,
      transition: {
        duration: 0.1,
        ease: motionEasing.easeInOut,
      },
    },
  },
  buttonReduced: {
    rest: { opacity: 1 },
    hover: { opacity: 1 },
    tap: { opacity: 1 },
  },
  modalBackdrop: {
    initial: { opacity: 0 },
    animate: {
      opacity: 1,
      transition: {
        duration: motionDurations.base,
        ease: motionEasing.easeOut,
      },
    },
    exit: {
      opacity: 0,
      transition: {
        duration: motionDurations.fast,
        ease: motionEasing.easeIn,
      },
    },
  },
  modalPanel: {
    initial: {
      opacity: 0,
      scale: 0.965,
      y: 12,
    },
    animate: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: motionSprings.modal,
    },
    exit: {
      opacity: 0,
      scale: 0.972,
      y: 10,
      transition: {
        duration: motionDurations.fast,
        ease: motionEasing.easeIn,
      },
    },
  },
  modalReduced: {
    initial: { opacity: 0 },
    animate: {
      opacity: 1,
      transition: {
        duration: 0.14,
        ease: motionEasing.easeOut,
      },
    },
    exit: {
      opacity: 0,
      transition: {
        duration: 0.1,
        ease: motionEasing.easeIn,
      },
    },
  },
  toast: {
    initial: {
      opacity: 0,
      y: -12,
      scale: 0.98,
    },
    animate: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: motionSprings.gentle,
    },
    exit: {
      opacity: 0,
      y: -8,
      scale: 0.98,
      transition: {
        duration: motionDurations.fast,
        ease: motionEasing.easeIn,
      },
    },
  },
  toastReduced: {
    initial: { opacity: 0 },
    animate: {
      opacity: 1,
      transition: {
        duration: 0.12,
        ease: motionEasing.easeOut,
      },
    },
    exit: {
      opacity: 0,
      transition: {
        duration: 0.1,
        ease: motionEasing.easeIn,
      },
    },
  },
} satisfies Record<string, Variants>;
