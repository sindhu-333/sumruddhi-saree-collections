import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { easings } from '../animations/motionConfig';
import '../styles/animation.css';

export default function CinematicLoader({ onComplete }) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Premium loading minimum 2000ms
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onComplete, 1000); // 1000ms fade out duration
    }, 2000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="cinematic-loader"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.0, ease: easings.silk }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            backgroundColor: 'var(--ink)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            color: 'var(--gold)'
          }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, filter: 'blur(10px)' }}
            animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
            transition={{ duration: 1.5, ease: easings.silk }}
          >
            <h1 style={{ 
              fontFamily: 'serif', 
              fontSize: '3rem', 
              letterSpacing: '0.2em',
              fontWeight: 300,
              textTransform: 'uppercase',
              margin: 0
            }}>
              Vastra
            </h1>
          </motion.div>
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: '120px', opacity: 0.5 }}
            transition={{ delay: 0.5, duration: 1.2, ease: easings.silk }}
            style={{
              height: '1px',
              backgroundColor: 'var(--gold)',
              marginTop: '24px'
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}