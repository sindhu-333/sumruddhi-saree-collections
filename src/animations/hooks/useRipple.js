import { useCallback } from 'react';

// Returns a handler to create a radial ripple effect inside the element.
export function useRipple(ref) {
  const create = useCallback((event) => {
    const el = ref?.current;
    if (!el) return;

    const r = el.querySelector('.ripple');
    if (!r) return;

    const rect = el.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    r.style.left = `${x}px`;
    r.style.top = `${y}px`;
    r.style.opacity = '1';
    r.style.transform = 'translate(-50%,-50%) scale(1)';

    setTimeout(() => {
      r.style.opacity = '0';
      r.style.transform = 'translate(-50%,-50%) scale(0)';
    }, 420);
  }, [ref]);

  return create;
}

export default useRipple;
