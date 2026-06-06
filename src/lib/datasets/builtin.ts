// Bundled seaborn sample datasets. CSVs live in src/assets/datasets/ and are
// imported as raw strings via Vite's ?raw suffix.
import tipsCsv from "@/assets/datasets/tips.csv?raw";
import penguinsCsv from "@/assets/datasets/penguins.csv?raw";
import mpgCsv from "@/assets/datasets/mpg.csv?raw";
import exerciseCsv from "@/assets/datasets/exercise.csv?raw";
import carCrashesCsv from "@/assets/datasets/car_crashes.csv?raw";
import planetsCsv from "@/assets/datasets/planets.csv?raw";
import healthexpCsv from "@/assets/datasets/healthexp.csv?raw";

export const BUILTIN_CSVS: Record<string, string> = {
  tips: tipsCsv,
  penguins: penguinsCsv,
  mpg: mpgCsv,
  exercise: exerciseCsv,
  car_crashes: carCrashesCsv,
  planets: planetsCsv,
  healthexp: healthexpCsv,
};

export function getBuiltinCsv(key: string): string | null {
  return BUILTIN_CSVS[key] ?? null;
}
