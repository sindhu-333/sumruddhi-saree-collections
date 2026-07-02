import React from 'react';
import { motion } from 'framer-motion';
import { pageVariants } from './motionConfig';
import { useMotion } from './MotionProvider';

export default function PageWrapper({ children, className = '', style = {} }) {
  const { prefersReducedMotion } = useMotion();

  if (prefersReducedMotion) {
    return <div className={className} style={style}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      style={style}
      initial="initial"
      animate="in"
      exit="out"
      variants={pageVariants}
    >
      {children}
    </motion.div>
  );
}
