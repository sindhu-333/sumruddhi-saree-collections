export const easings = {
  silk: [0.25, 0.1, 0.0, 1.0],
  spring: [0.34, 1.56, 0.64, 1],
  cinematic: [0.16, 1, 0.3, 1],
  anticipate: [0.36, 0, 0.66, -0.56],
  reveal: [0.77, 0, 0.175, 1],
  soft: [0.23, 0.97, 0.35, 1],
  snap: [0.34, 0.01, 0.22, 0.99]
};

export const durations = {
  instant: 0.08,
  fastest: 0.12,
  fast: 0.16,
  medium: 0.32,
  slow: 0.60,
  cinematic: 1.0,
  epic: 1.80
};

export const pageVariants = {
  initial: { opacity: 0, scale: 0.985, y: 10 },
  in: { opacity: 1, scale: 1, y: 0, transition: { duration: durations.medium, ease: easings.cinematic } },
  out: { opacity: 0, scale: 0.995, y: -6, transition: { duration: durations.fast, ease: easings.soft } }
};

export const fade = {
  initial: { opacity: 0 },
  in: { opacity: 1, transition: { duration: durations.fast, ease: easings.soft } },
  out: { opacity: 0, transition: { duration: durations.fast, ease: easings.soft } }
};

export const floaty = {
  hover: { y: -6, scale: 1.01, transition: { duration: durations.fast, ease: easings.soft } },
  tap: { scale: 0.985, transition: { duration: durations.fast } }
};

export default {
  easings,
  durations,
  pageVariants,
  fade,
  floaty
};
