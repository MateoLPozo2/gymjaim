// Mulberry32 PRNG — deterministic and small. Used to make a given attempt's
// missing-value pattern reproducible: same seed in -> same NaN indices out.
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

export function shuffleInPlace<T>(arr: T[], rand: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function sampleWithoutReplacement<T>(
  arr: readonly T[],
  n: number,
  rand: () => number,
): T[] {
  const copy = arr.slice();
  shuffleInPlace(copy, rand);
  return copy.slice(0, Math.min(n, copy.length));
}
