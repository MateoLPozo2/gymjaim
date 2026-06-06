export interface FeedbackInput {
  targetCol: string;
  yCol: string;
  conditionCol?: string | null;
  userCode: string;
  slopes: {
    expected: number | null;
    user: number | null;
    optimal: number | null;
    delta: number | null;
    pct: number | null;
    matched: boolean;
  };
}

export interface FeedbackResult {
  coach: string;
  critic: string;
}

type ImputationType = "constant" | "simple_stat" | "conditional" | "model" | "unknown";

function detectImputationType(code: string): ImputationType {
  const lower = code.toLowerCase();
  if (lower.includes("simpleimputer") || lower.includes("knnimputer") || lower.includes("iterativeimputer")) {
    return "model";
  }
  if (lower.includes("groupby") || lower.includes("transform(") || lower.includes(".map(")) {
    return "conditional";
  }
  if (lower.includes(".mean()") || lower.includes(".median()") || lower.includes(".mode()")) {
    return "simple_stat";
  }
  // fillna with a literal number
  if (/fillna\s*\(\s*[\d.+-]/.test(lower)) {
    return "constant";
  }
  return "unknown";
}

function fmt(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(3);
}

function absPct(v: number | null | undefined): number {
  return v != null && Number.isFinite(v) ? Math.abs(v) : Infinity;
}

export function generateFeedback(input: FeedbackInput): FeedbackResult {
  const { targetCol, yCol, conditionCol, userCode, slopes } = input;
  const { expected, user, pct, matched } = slopes;
  const impType = detectImputationType(userCode);
  const pctAbs = absPct(pct);

  // ── The Coach ──────────────────────────────────────────────────────────────

  let coach: string;

  if (matched) {
    coach = `Oracle match — your slope (${fmt(user)}) reproduced the ground-truth regression exactly. Now ask yourself: was the fill logically justified by the data-generating process, or did you get lucky on this seed? The next level is being able to explain *why* the approach was sound, not just that the number lined up.`;
  } else if (pctAbs < 5) {
    if (impType === "conditional" && conditionCol) {
      coach = `Very close — your slope (${fmt(user)}) is within ${pctAbs.toFixed(1)}% of expected (${fmt(expected)}). Conditioning on ${conditionCol} was the right instinct. The small remaining gap usually comes from how the condition boundary is drawn — try a finer grouping or check whether the group means are themselves biased.`;
    } else {
      coach = `Close — your slope (${fmt(user)}) is within ${pctAbs.toFixed(1)}% of expected (${fmt(expected)}). Most of the bias is gone. Double-check that the fill doesn't mask a systematic pattern in the missing values${conditionCol ? ` — conditioning on ${conditionCol} might close the remaining gap` : ""}.`;
    }
  } else if (pctAbs < 20) {
    if (impType === "simple_stat") {
      coach = `Your slope (${fmt(user)}) is ${pctAbs.toFixed(1)}% off from expected (${fmt(expected)}). A marginal statistic fill is a reasonable start, but it ignores structure in the data. Look at whether ${targetCol} missingness correlates with another column${conditionCol ? ` — ${conditionCol} is a candidate` : ""}. Conditioning on it often closes most of the gap.`;
    } else if (impType === "constant") {
      coach = `Your slope (${fmt(user)}) is ${pctAbs.toFixed(1)}% from expected (${fmt(expected)}). A constant fill is the simplest approach, but constants shift the conditional mean. Try replacing it with a column-level statistic — even the column mean is usually better than a fixed number.`;
    } else {
      coach = `Your slope (${fmt(user)}) is ${pctAbs.toFixed(1)}% off from expected (${fmt(expected)}). Look at the distribution of missing values in ${targetCol} — are they spread randomly, or do they cluster in a particular range of ${yCol}? That pattern tells you which imputation strategy will work.`;
    }
  } else {
    if (impType === "constant") {
      coach = `Your slope (${fmt(user)}) is ${pctAbs.toFixed(1)}% from expected (${fmt(expected)}) — a constant fill is pulling the regression line hard. Constants are only safe when values are missing completely at random (MCAR). Check whether missing ${targetCol} rows tend to have unusually high or low ${yCol} values — if they do, the fill is introducing systematic bias.`;
    } else {
      coach = `Your slope (${fmt(user)}) is ${pctAbs.toFixed(1)}% from expected (${fmt(expected)}) — the fill is significantly moving the regression line. The gap this large usually means the imputation strategy violates a key assumption of the data. Think about whether missing values in ${targetCol} are MCAR, MAR, or MNAR: a simple fill assumes MCAR, and it fails badly whenever that assumption is wrong.`;
    }
  }

  // ── The Critic ─────────────────────────────────────────────────────────────

  let critic: string;

  if (matched) {
    critic = `Matching the oracle is necessary, not sufficient. Can you prove the fill is justified by the data-generating process — not just by the slope score? If I changed the random seed so the absent rows were the highest values, would your approach still work? If you can't answer that, you found the right number for the wrong reason.`;
  } else if (impType === "conditional") {
    critic = `Conditional imputation is a step up from a global statistic, but you never showed the condition column actually captures the missingness pattern. What if the grouping variable you chose is correlated with the outcome but not with *why* values went missing? In that case, conditioning on it introduces its own bias. Prove the condition is relevant.`;
  } else if (impType === "model") {
    critic = `You used a model-based imputer, but model-based imputation assumes missingness at random (MAR). You never tested that assumption. If the absent ${targetCol} rows are systematically the extreme values — the ones most predictable by external features you didn't include — the imputer propagates that bias into the regression. Can you rule it out?`;
  } else if (impType === "simple_stat" || impType === "constant") {
    critic = `You filled ${targetCol} with a single value, but you never tested whether missingness is random. If the absent rows are systematically the high or low values, your fill introduces structural bias — not noise. A ${pctAbs > 15 ? `${pctAbs.toFixed(0)}% slope error` : "slope error this size"} is consistent with non-random missingness. Can you rule that out? If you can't, your slope (${fmt(user)}) is an artifact, not an estimate.`;
  } else {
    critic = `Your imputation makes an implicit assumption about why the values in ${targetCol} are missing, and you never stated what that assumption is. If the absent rows are systematically the high values, your slope (${fmt(user)}) is biased downward. If they're the low values, it's biased upward. Which is it — and how do you know?`;
  }

  return { coach, critic };
}
