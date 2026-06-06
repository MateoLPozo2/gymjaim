// Short, human-readable descriptions for the seven built-in seaborn samples.
// Sourced from the seaborn-data repository and the original dataset docs.
export interface BuiltinMeta {
  source: string;
  sourceUrl?: string;
  blurb: string;
  typicalUse: string;
}

export const BUILTIN_META: Record<string, BuiltinMeta> = {
  tips: {
    source: "seaborn-data · tips",
    sourceUrl: "https://github.com/mwaskom/seaborn-data",
    blurb:
      "244 restaurant bills collected by a single waiter over a few months. Each row is one table, with the bill total, the tip the table left, party size, day, time and the smoker/non-smoker flag.",
    typicalUse:
      "Regression of tip on total_bill, group comparisons across day or time, simple introductions to seaborn's relational plots.",
  },
  penguins: {
    source: "Palmer Station LTER · penguins",
    sourceUrl: "https://allisonhorst.github.io/palmerpenguins/",
    blurb:
      "344 penguins measured at Palmer Station, Antarctica, across three species (Adelie, Chinstrap, Gentoo). Includes bill length, bill depth, flipper length and body mass.",
    typicalUse:
      "Classification, clustering, and missing-value practice — there are real NaNs in the raw file.",
  },
  mpg: {
    source: "UCI · Auto MPG",
    sourceUrl: "https://archive.ics.uci.edu/dataset/9/auto+mpg",
    blurb:
      "398 cars from the late 70s and early 80s with fuel economy, displacement, weight, horsepower, and model year. A classic teaching dataset.",
    typicalUse:
      "Multivariate regression, feature engineering, and handling missing horsepower values.",
  },
  exercise: {
    source: "seaborn-data · exercise",
    blurb:
      "Repeated pulse measurements for 30 subjects exercising under three diet conditions over 15 minutes.",
    typicalUse:
      "Repeated-measures plots, mixed-effects practice, and time-series style line plots.",
  },
  car_crashes: {
    source: "seaborn-data · car_crashes",
    blurb:
      "Per-state US car crash statistics from FiveThirtyEight (2012): total crashes per billion miles, plus breakdowns by speeding, alcohol, distraction, insurance premium and losses.",
    typicalUse:
      "State-level correlation analysis and intro pair-plots.",
  },
  planets: {
    source: "NASA Exoplanet Archive · planets",
    sourceUrl: "https://exoplanetarchive.ipac.caltech.edu/",
    blurb:
      "1035 confirmed exoplanet discoveries with orbital period, mass, distance, discovery method and year. Many fields contain real missing values.",
    typicalUse:
      "Missing-value imputation, log-scale visualizations, and time-trend analysis.",
  },
  healthexp: {
    source: "OECD · health spending",
    sourceUrl: "https://data.oecd.org/healthres/health-spending.htm",
    blurb:
      "Per-capita health expenditure (USD, PPP-adjusted) paired with life expectancy at birth across OECD countries and years.",
    typicalUse:
      "Cross-country regression, multi-line longitudinal charts, and the classic 'US is an outlier' demo.",
  },
};
