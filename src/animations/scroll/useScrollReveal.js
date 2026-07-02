import { useEffect } from 'react';

// Simple scroll reveal helper using IntersectionObserver
export default function useScrollReveal(ref, { root = null, rootMargin = '0px 0px -8% 0px', threshold = 0.12, once = true, onReveal } = {}) {
  useEffect(() => {
    const el = ref?.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    const obs = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          el.classList.add('in-view');
          onReveal?.(el);
          if (once) obs.unobserve(el);
        }
      });
    }, { root, rootMargin, threshold });

    obs.observe(el);
    return () => obs.disconnect();
  }, [ref, root, rootMargin, threshold, once, onReveal]);
}
