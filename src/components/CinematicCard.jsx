import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import '../styles/animation.css';
import useMagnetic from '../animations/hooks/useMagnetic';

export default function CinematicCard({ children, className = '', style, ...props }) {
  const ref = useRef(null);
  const specRef = useRef(null);

  // light magnetic tilt for card
  useMagnetic(ref, { strength: 8, radius: 220 });

  const handleMove = (e) => {
    const el = ref.current; if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const rx = (py - 0.5) * 6; const ry = (px - 0.5) * -6;
    el.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(8px)`;

    // update specular highlight position + intensity via CSS variables
    const spec = specRef.current;
    if (spec) {
      spec.style.setProperty('--sx', `${px * 100}%`);
      spec.style.setProperty('--sy', `${py * 100}%`);
      const dx = px - 0.5; const dy = py - 0.5;
      const dist = Math.hypot(dx, dy);
      const intensity = Math.max(0, 1 - dist * 1.6);
      spec.style.setProperty('--spec-opacity', `${0.7 * intensity}`);
      spec.style.setProperty('--spec-scale', `${1 + intensity * 0.6}`);
    }
  };

  const handleLeave = () => {
    const el = ref.current; if (!el) return; el.style.transform = '';
    const spec = specRef.current; if (spec) {
      spec.style.setProperty('--spec-opacity', '0');
      spec.style.setProperty('--spec-scale', '1');
    }
  };

  return (
    <motion.div
      ref={ref}
      className={`glass-card cinematic-tilt ${className}`}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.998 }}
      style={{ position: 'relative', overflow: 'hidden', transformStyle: 'preserve-3d', willChange: 'transform', ...style }}
      {...props}
    >
      <div ref={specRef} className="specular-highlight" />
      <div className="card-glow" aria-hidden="true" />
      {children}
    </motion.div>
  );
}
