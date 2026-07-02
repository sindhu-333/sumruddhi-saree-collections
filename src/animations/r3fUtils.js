// Lightweight helpers for lazy-loading R3F scenes and basic camera motion
import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';

export function LazyScene({ children, ...props }) {
  return (
    <Suspense fallback={<div style={{width: '100%', height: '100%'}} />}>
      <Canvas {...props}>{children}</Canvas>
    </Suspense>
  );
}

export default { LazyScene };
