export type CurriculumGroup = {
  label: string;
  comingSoon?: boolean;
  topics: string[];
};

export const CURRICULUM: CurriculumGroup[] = [
  {
    label: "Introduction",
    topics: [
      "Data Types",
      "Descriptive Statistics",
      "Data Formats",
      "Probability Distributions",
      "Sample vs. Population",
      "Data Storage and Imports",
    ],
  },
  {
    label: "Data Cleaning",
    topics: [
      "Type Errors and Duplicate Values",
      "Missing Values",
      "Outlier Detection",
      "Cleaning Strings",
      "Data Transformation",
      "Encoding Categorical Variables",
      "Feature Selection",
    ],
  },
  {
    label: "Forecasting",
    topics: [
      "Autoregressive Models",
      "Moving Average Models",
      "Exponential Smoothing",
      "ARIMA Models",
      "ARCH Models",
      "Lag Length Selection",
      "Seasonality",
      "State-space Models",
      "Forecast Evaluation",
    ],
  },
  {
    label: "Machine Learning",
    comingSoon: true,
    topics: [],
  },
];

export const ALL_TOPICS = CURRICULUM.flatMap((g) => g.topics);

export const ROLE_OPTIONS = [
  "Data Analyst",
  "Business Analyst",
  "Junior Data Scientist",
  "Research Analyst",
  "Market Research Analyst",
  "Operations Analyst",
  "Product Analyst",
  "Business Intelligence (BI) Analyst",
  "Student",
  "Other",
] as const;
