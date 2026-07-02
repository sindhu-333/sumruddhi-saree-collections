import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { pageVariants, easings, durations } from './motionConfig';
import '../styles/animation.css';
import useCursor from './useCursor';

const MotionContext = createContext({ prefersReducedMotion: false, easing: easings, durations });

export function useMotion() {
  return useContext(MotionContext);
}

export default function MotionProvider({ children }) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = () => setPrefersReducedMotion(mq.matches);
    handler();
    if (mq.addEventListener) mq.addEventListener('change', handler); else mq.addListener(handler);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', handler); else mq.removeListener(handler);
    };
  }, []);

  const value = useMemo(() => ({ prefersReducedMotion, easing: easings, durations }), [prefersReducedMotion]);

  const { cursorRef } = useCursor();

  return (
    <MotionContext.Provider value={value}>
      {/* Global cinematic cursor element */}
      <div id="cinematic-root" aria-hidden="true">
        <div id="cinematic-cursor" ref={cursorRef} />
      </div>
      <div className="ambient-layer" aria-hidden="true" />
      <div className="noise-overlay" aria-hidden="true" />
      <AnimatePresence exitBeforeEnter>
        <motion.div
          key="app-root"
          initial="initial"
          animate="in"
          exit="out"
          variants={pageVariants}
          style={{ minHeight: '100vh' }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </MotionContext.Provider>
  );
}
