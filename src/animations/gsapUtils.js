import { gsap } from 'gsap';

export function timeline(fn, opts = {}) {
  const tl = gsap.timeline(opts);
  if (typeof fn === 'function') fn(tl);
  return tl;
}

export function quickTo(target, vars) {
  return gsap.to(target, { ...vars, overwrite: true });
}

export default { timeline, quickTo };
