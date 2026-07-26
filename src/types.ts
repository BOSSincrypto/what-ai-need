/** Shapes of the JSON that `scripts/collect.mjs` emits into `public/data`. */

export type Lang = 'ru' | 'en';
export type Tier = 'S' | 'A' | 'B' | 'C' | 'D';

/** Keys are short because this file ships to every visitor. */
export interface Model {
  id: string;
  n: string;                      // display name
  v: string;                      // vendor
  c: string;                      // country code
  r: string | null;               // release date
  w: number | null;               // WAIN index, confidence-adjusted
  wr: number | null;              // raw index before adjustment
  cf: number;                     // confidence 0-1
  b: number | null;               // benchmark-only score
  g: number | null;               // preference minus benchmarks
  t: Tier | null;
  cov: number;                    // datapoints behind the score
  cat: Record<string, number>;    // category id → 0-100
  cn: Record<string, number>;     // category id → datapoint count
  src: string[];
  eci?: number;                   // Epoch Capabilities Index
  p?: 1;                          // sits on the price/quality frontier
  val?: number;                   // index points per dollar
  vp?: number;                    // value percentile
  var?: string[];                 // known effort variants
  or?: string;                    // OpenRouter id
  pi?: number; po?: number; pb?: number; pc?: number;  // $/M in, out, blended, cached
  ctx?: number; mo?: number;      // context window, max output
  im?: string[];                  // input modalities
  f?: string[];                   // feature flags
  hf?: string;
  /** Merged in from `details.json` once it has been fetched. */
  bs?: Record<string, [number, number, number | null, number | null]>;  // [raw, norm, rank, of]
  ar?: Record<string, [number, number, number, number]>;  // arena → [elo, votes, rank, norm]
  aa?: { i: number | null; s: number | null; l: number | null };
}

/** `details.json`: score breakdowns, loaded on demand. */
export type Details = Record<string, Pick<Model, 'bs' | 'ar' | 'aa'>>;

export interface Category { id: string; w: number; en: string; ru: string }

export interface Benchmark {
  id: string; cat: string; w: number;
  en: string; ru: string; about_en: string; about_ru: string;
  pct?: boolean; elo?: boolean;
}

export interface Arena {
  id: string; cat: string; w: number; en: string; ru: string;
  published?: string; n?: number;
  /** False for boards scored as a 0-1 win rate rather than an Elo rating. */
  elo?: boolean;
}

export interface Preset {
  id: string; icon: string; en: string; ru: string;
  w: Record<string, number>; sort?: string;
}

export interface Source {
  id: string; name: string; url: string;
  license: string; licenseUrl: string; en: string; ru: string;
}

export interface Meta {
  generated: string;
  dataDate: string;
  counts: {
    models: number; priced: number; benchmarks: number;
    arenas: number; vendors: number; datapoints: number;
  };
  categories: Category[];
  benchmarks: Benchmark[];
  arenas: Arena[];
  presets: Preset[];
  sources: Source[];
  countries: Record<string, { flag: string; en: string; ru: string }>;
  health: { id: string; ok: boolean; n: number }[];
  cutoff: string;
  scoring: { prior: number; k: number };
}

/** Timeline series: [date, best score so far, model id, model name]. */
export type TimelinePoint = [string, number, string, string];
export type Timeline = Record<string, TimelinePoint[]>;
