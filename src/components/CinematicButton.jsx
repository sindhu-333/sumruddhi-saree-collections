import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import '../styles/animation.css';
import useMagnetic from '../animations/hooks/useMagnetic';
import { useRipple } from '../animations/hooks/useRipple';

export default function CinematicButton({ children, className = '', onClick, style, ...props }) {
  const elRef = useRef(null);
  const rippleRef = useRef(null);

  // magnetic hover
  useMagnetic(elRef, { strength: 10, radius: 160 });

  // ripple manager
  const triggerRipple = useRipple(elRef);

  const handleMouseDown = (e) => {
    triggerRipple(e);
  };

  return (
    <motion.button
      ref={elRef}
      className={`cinematic-btn ${className}`}
      onMouseDown={handleMouseDown}
      onClick={onClick}
      style={{ willChange: 'transform', ...style }}
      whileTap={{ scale: 0.985 }}
      {...props}
    >
      {children}
      <span className="ripple" ref={rippleRef} aria-hidden="true" />
    </motion.button>
  );
}
