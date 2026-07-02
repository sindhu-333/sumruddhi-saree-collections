import { useEffect } from 'react';

// Attach magnetic hover to an element.
export default function useMagnetic(ref, { strength = 12, radius = 150 } = {}) {
  useEffect(() => {
    const el = ref?.current;
    if (!el) return;

    let raf = null;

    function onMove(e) {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > radius) {
        el.style.transform = '';
        return;
      }

      const px = (dx / rect.width) * strength;
      const py = (dy / rect.height) * strength;

      if (!raf) raf = requestAnimationFrame(() => {
        el.style.transform = `translate3d(${px}px, ${py}px, 0) scale(1.002)`;
        raf = null;
      });
    }

    function onLeave() {
      if (raf) cancelAnimationFrame(raf);
      raf = null;
      el.style.transform = '';
    }

    window.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);

    return () => {
      window.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [ref, strength, radius]);
}
