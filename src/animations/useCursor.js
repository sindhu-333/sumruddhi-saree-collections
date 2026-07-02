import { useEffect, useRef } from 'react';

export default function useCursor() {
  const cursorRef = useRef(null);
  const pos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const el = cursorRef.current;
    if (!el) return;

    let raf = null;

    const onMove = (e) => {
      pos.current.x = e.clientX;
      pos.current.y = e.clientY;
      if (!raf) raf = requestAnimationFrame(() => {
        el.style.transform = `translate3d(${pos.current.x}px, ${pos.current.y}px, 0)`;
        raf = null;
      });
    };

    window.addEventListener('mousemove', onMove);
    return () => {
      window.removeEventListener('mousemove', onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return { cursorRef };
}
