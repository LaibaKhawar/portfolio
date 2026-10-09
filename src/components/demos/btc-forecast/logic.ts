/**
 * Forecast models for the BTC demo. Framework-free.
 *
 * The notebook (i2112697_A4.ipynb) fits sklearn LinearRegression and a
 * degree-2 polynomial on the unix timestamp with a random 80/20 split. Here
 * the same regression-on-time models are refit on a chronological split,
 * next to two baselines that respect time order: persistence and AR(p) on
 * log returns, both evaluated one step ahead, walk-forward.
 */

/* ---------------- Linear algebra ---------------- */

/** Solve A x = b for symmetric positive definite A via Cholesky. */
export function choleskySolve(A: number[][], b: number[]): number[] {
  const n = A.length;
  const L: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = A[i][j];
      for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
      if (i === j) {
        if (s <= 0) throw new Error("Matrix is not positive definite");
        L[i][i] = Math.sqrt(s);
      } else {
        L[i][j] = s / L[j][j];
      }
    }
  }
  const y = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    let s = b[i];
    for (let k = 0; k < i; k++) s -= L[i][k] * y[k];
    y[i] = s / L[i][i];
  }
  const x = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = y[i];
    for (let k = i + 1; k < n; k++) s -= L[k][i] * x[k];
    x[i] = s / L[i][i];
  }
  return x;
}

/** Ordinary least squares through the normal equations X'X beta = X'y. */
export function leastSquares(X: number[][], y: number[]): number[] {
  const p = X[0]?.length ?? 0;
  const XtX: number[][] = Array.from({ length: p }, () => new Array<number>(p).fill(0));
  const Xty = new Array<number>(p).fill(0);
  for (let r = 0; r < X.length; r++) {
    const row = X[r];
    for (let i = 0; i < p; i++) {
      Xty[i] += row[i] * y[r];
      for (let j = 0; j <= i; j++) XtX[i][j] += row[i] * row[j];
    }
  }
  for (let i = 0; i < p; i++) for (let j = 0; j < i; j++) XtX[j][i] = XtX[i][j];
  return choleskySolve(XtX, Xty);
}

/* ---------------- Metrics ---------------- */

export function rmse(actual: number[], pred: number[]): number {
  let s = 0;
  for (let i = 0; i < actual.length; i++) s += (actual[i] - pred[i]) ** 2;
  return Math.sqrt(s / actual.length);
}

export function mae(actual: number[], pred: number[]): number {
  let s = 0;
  for (let i = 0; i < actual.length; i++) s += Math.abs(actual[i] - pred[i]);
  return s / actual.length;
}

/** Mean absolute percentage error, in percent (as in the notebook). */
export function mape(actual: number[], pred: number[]): number {
  let s = 0;
  for (let i = 0; i < actual.length; i++) s += Math.abs((actual[i] - pred[i]) / actual[i]);
  return (s / actual.length) * 100;
}

export type Metrics = { rmse: number; mae: number; mape: number };

export const metrics = (actual: number[], pred: number[]): Metrics => ({
  rmse: rmse(actual, pred),
  mae: mae(actual, pred),
  mape: mape(actual, pred),
});

/* ---------------- Models ---------------- */

/**
 * Polynomial regression of price on time (day index), fitted on [0, split).
 * The time feature is standardised with the training mean and std so the
 * normal equations stay well conditioned. Returns predictions for every day.
 */
export function polyTimeFit(close: number[], split: number, degree: number): { coef: number[]; fitted: number[] } {
  let mean = 0;
  for (let t = 0; t < split; t++) mean += t;
  mean /= split;
  let v = 0;
  for (let t = 0; t < split; t++) v += (t - mean) ** 2;
  const sd = Math.sqrt(v / split) || 1;
  const feats = (t: number) => {
    const z = (t - mean) / sd;
    const row = [1];
    for (let d = 1; d <= degree; d++) row.push(z ** d);
    return row;
  };
  const X: number[][] = [];
  for (let t = 0; t < split; t++) X.push(feats(t));
  const coef = leastSquares(X, close.slice(0, split));
  const fitted = close.map((_, t) => feats(t).reduce((s, f, i) => s + f * coef[i], 0));
  return { coef, fitted };
}

/** Persistence: the forecast for day t is the close on day t - 1. */
export function persistence(close: number[], from: number, to = close.length): number[] {
  const out: number[] = [];
  for (let t = from; t < to; t++) out.push(close[t - 1]);
  return out;
}

export const logReturns = (close: number[]) => close.map((c, t) => (t === 0 ? 0 : Math.log(c / close[t - 1])));

/**
 * Fit AR(p) with intercept by OLS: x_t = c + phi_1 x_{t-1} + ... + phi_p x_{t-p}.
 * Uses targets x_t for t in [start + p, end).
 */
export function fitAR(x: number[], p: number, start = 0, end = x.length): { intercept: number; phi: number[] } {
  const X: number[][] = [];
  const y: number[] = [];
  for (let t = start + p; t < end; t++) {
    const row = [1];
    for (let i = 1; i <= p; i++) row.push(x[t - i]);
    X.push(row);
    y.push(x[t]);
  }
  const beta = leastSquares(X, y);
  return { intercept: beta[0], phi: beta.slice(1) };
}

/**
 * AR(p) on log returns, fitted on the training range, forecast one step
 * ahead walk-forward on [split, n): each forecast uses actual past returns,
 * then price_hat_t = close_{t-1} * exp(return_hat_t).
 */
export function arReturnsForecast(close: number[], split: number, p: number): { pred: number[]; intercept: number; phi: number[] } {
  const r = logReturns(close);
  // r[0] is undefined in reality, so returns start at index 1. Training targets end at split - 1.
  const { intercept, phi } = fitAR(r, p, 1, split);
  const pred: number[] = [];
  for (let t = split; t < close.length; t++) {
    let rh = intercept;
    for (let i = 1; i <= p; i++) rh += phi[i - 1] * r[t - i];
    pred.push(close[t - 1] * Math.exp(rh));
  }
  return { pred, intercept, phi };
}

export type ModelKey = "linear" | "poly2" | "poly3" | "persistence" | "ar";

export type ModelResult = {
  key: ModelKey;
  label: string;
  /** Predictions over the test range [split, n). */
  test: number[];
  /** In-sample fit over [0, split) for regression-on-time models. */
  train?: number[];
  metrics: Metrics;
};

export function evaluateAll(close: number[], split: number, p: number): ModelResult[] {
  const actual = close.slice(split);
  const out: ModelResult[] = [];
  for (const [key, label, deg] of [
    ["linear", "Linear regression on time", 1],
    ["poly2", "Polynomial degree 2", 2],
    ["poly3", "Polynomial degree 3", 3],
  ] as const) {
    const { fitted } = polyTimeFit(close, split, deg);
    const test = fitted.slice(split);
    out.push({ key, label, test, train: fitted.slice(0, split), metrics: metrics(actual, test) });
  }
  const pers = persistence(close, split);
  out.push({ key: "persistence", label: "Naive persistence", test: pers, metrics: metrics(actual, pers) });
  const ar = arReturnsForecast(close, split, p).pred;
  out.push({ key: "ar", label: `AR(${p}) on log returns`, test: ar, metrics: metrics(actual, ar) });
  return out;
}

/** Index of the minimum per metric, for marking the best model. */
export function bestBy(results: ModelResult[]): Record<keyof Metrics, number> {
  const pick = (k: keyof Metrics) => results.reduce((best, r, i) => (r.metrics[k] < results[best].metrics[k] ? i : best), 0);
  return { rmse: pick("rmse"), mae: pick("mae"), mape: pick("mape") };
}
