import type { Card, Run } from './types';

export const rand = (r: Run) => {
  r.rng = (Math.imul(1664525, r.rng) + 1013904223) >>> 0;
  return r.rng / 4294967296;
};
export const choose = <T>(r: Run, items: T[]): T => items[Math.floor(rand(r) * items.length)];
export const shuffle = <T>(r: Run, items: T[]) => {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand(r) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
export const makeCard = (r: Run, id: string, upgraded = false, temporary = false): Card => ({
  uid: `c${++r.seq}`,
  id,
  upgraded,
  temporary,
});
