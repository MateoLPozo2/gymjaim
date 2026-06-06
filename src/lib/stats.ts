// Inference / imputation helpers ported from the Streamlit reference.
// Operates on JS arrays so we can grade attempts immediately, and ports the
// same logic into Python for the in-browser Pyodide runner.

export interface SlopeResult {
  slope: number;
  intercept: number;
  n: number;
}

export function ordinaryLeastSquares(
  x: (number | null)[],
  y: (number | null)[],
): SlopeResult {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < x.length; i++) {
    const xv = x[i];
    const yv = y[i];
    if (xv == null || yv == null || !Number.isFinite(xv) || !Number.isFinite(yv)) continue;
    xs.push(xv);
    ys.push(yv);
  }
  const n = xs.length;
  if (n < 2) return { slope: NaN, intercept: NaN, n };
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  if (den === 0) return { slope: NaN, intercept: NaN, n };
  const slope = num / den;
  const intercept = my - slope * mx;
  return { slope, intercept, n };
}

export function quantile(values: number[], q: number): number {
  if (values.length === 0) return NaN;
  const sorted = values.slice().sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function mean(values: number[]): number {
  if (!values.length) return NaN;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

export function median(values: number[]): number {
  return quantile(values, 0.5);
}
