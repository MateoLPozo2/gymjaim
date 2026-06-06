// Generates sample imputation snippets for the runner's "Peek at solutions"
// section. Each snippet is keyed off the exercise's target/y/condition cols
// so users see code that's actually runnable on their dataset.

export interface SampleSolution {
  key: string;
  title: string;
  description: string;
  code: string;
}

export function buildSampleSolutions(
  target: string,
  y: string,
  condition: string | null | undefined,
): SampleSolution[] {
  const sols: SampleSolution[] = [
    {
      key: "mean",
      title: "Mean fill",
      description:
        "Replace every NaN in the target with the column mean. Fast, but biases the slope toward the existing data's center.",
      code: `# Mean imputation
df['${target}'] = df['${target}'].fillna(df['${target}'].mean())
df.head()
`,
    },
    {
      key: "median",
      title: "Median fill",
      description:
        "Use the median instead — more robust to outliers than the mean, especially for skewed columns.",
      code: `# Median imputation
df['${target}'] = df['${target}'].fillna(df['${target}'].median())
df.head()
`,
    },
    {
      key: "regression",
      title: "Regression-based fill",
      description:
        "Fit a simple linear model on the rows that do have ${target}, then predict the missing ones from '${y}'.",
      code: `# Predict missing values from '${y}'
from sklearn.linear_model import LinearRegression
import numpy as np

mask = df['${target}'].notna() & df['${y}'].notna()
model = LinearRegression().fit(df.loc[mask, ['${y}']], df.loc[mask, '${target}'])

missing = df['${target}'].isna() & df['${y}'].notna()
df.loc[missing, '${target}'] = model.predict(df.loc[missing, ['${y}']])
df.head()
`.replace(/\$\{target\}/g, target).replace(/\$\{y\}/g, y),
    },
  ];

  if (condition) {
    sols.push({
      key: "grouped",
      title: "Conditional group mean",
      description: `Bucket rows by '${condition}' (split at its median) and fill each group with its own '${target}' mean. Useful when missingness correlates with '${condition}'.`,
      code: `# Conditional group-wise mean
import numpy as np

threshold = df['${condition}'].median()
bucket = np.where(df['${condition}'] > threshold, 'high', 'low')
df['${target}'] = df.groupby(bucket)['${target}'].transform(
    lambda s: s.fillna(s.mean())
)
df.head()
`,
    });
  }

  return sols;
}
