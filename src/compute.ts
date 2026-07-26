/**
 * Client-side re-scoring.
 *
 * The build step ships every model's per-category scores, not just a final
 * number, so the index can be recomputed here whenever the visitor changes the
 * weights. This mirrors the last three steps of `scripts/collect.mjs` exactly —
 * if the maths drifts apart, the sliders would quietly rank models by a
 * different formula than the methodology section describes.
 */

import type { Meta, Model, Tier } from './types';

export interface Filters {
  query: string;
  vendor: string;
  country: string;
  license: 'all' | 'open' | 'proprietary';
  maxPrice: number | null;
  minConfidence: number;
  modernOnly: boolean;
  pricedOnly: boolean;
  needs: Set<string>;
}

export interface Scored extends Model {
  score: number | null;   // index under the active weights
  rank: number;
  tier: Tier | null;
  valueNow: number | null;
}

export const defaultFilters = (): Filters => ({
  query: '', vendor: '', country: '', license: 'all',
  maxPrice: null, minConfidence: 0, modernOnly: true, pricedOnly: false,
  needs: new Set(),
});

const TIER_CUTS: [number, Tier][] = [[0.03, 'S'], [0.10, 'A'], [0.25, 'B'], [0.50, 'C']];

function tierFromRank(rank: number, total: number): Tier | null {
  if (!total) return null;
  const pct = rank / total;
  for (const [cut, tier] of TIER_CUTS) if (pct <= cut) return tier;
  return 'D';
}

/**
 * Recompute the index for every model under a custom weight vector.
 *
 * Confidence has to be recomputed too, not reused: breadth is measured against
 * the categories the visitor actually cares about. Zero out everything except
 * coding and a chat-arena-only model is no longer "narrow" — it is simply
 * unmeasured on the axis in question, and its index should say so.
 */
export function rescore(models: Model[], meta: Meta, weights: Record<string, number>): Model[] {
  const cats = meta.categories;
  const total = cats.reduce((s, c) => s + (weights[c.id] ?? 0), 0);
  if (total <= 0) return models.map((m) => ({ ...m, w: null }));

  const { prior, k } = meta.scoring;
  const out: Model[] = [];

  for (const m of models) {
    let num = 0;
    let den = 0;
    let present = 0;
    let coverage = 0;

    for (const c of cats) {
      const weight = weights[c.id] ?? 0;
      if (weight <= 0) continue;
      const value = m.cat[c.id];
      if (value == null) continue;
      num += value * weight;
      den += weight;
      present += weight;
      coverage += m.cn[c.id] ?? 0;
    }

    if (den <= 0) { out.push({ ...m, w: null, wr: null, cf: 0 }); continue; }

    const raw = num / den;
    const confidence = Math.sqrt((present / total) * (coverage / (coverage + k)));
    out.push({
      ...m,
      wr: raw,
      cf: confidence,
      w: prior + (raw - prior) * confidence,
    });
  }
  return out;
}

/** Does this model satisfy every active requirement toggle? */
function meetsNeeds(m: Model, needs: Set<string>): boolean {
  for (const need of needs) {
    switch (need) {
      case 'tools': if (!m.f?.includes('tools')) return false; break;
      case 'reasoning': if (!m.f?.includes('reason')) return false; break;
      case 'free': if (!m.f?.includes('free')) return false; break;
      case 'vision': if (!m.im?.includes('image')) return false; break;
      case 'longctx': if (!m.ctx || m.ctx < 200_000) return false; break;
      default: break;
    }
  }
  return true;
}

/** Open weights is inferred from a Hugging Face id — the only reliable signal. */
export const isOpen = (m: Model) => Boolean(m.hf);

export function applyFilters(models: Model[], f: Filters, cutoff: string): Model[] {
  const query = f.query.trim().toLowerCase();
  return models.filter((m) => {
    if (f.modernOnly && m.r && m.r < cutoff) return false;
    if (f.pricedOnly && !(m.pb != null && m.pb > 0)) return false;
    if (f.vendor && m.v !== f.vendor) return false;
    if (f.country && m.c !== f.country) return false;
    if (f.license === 'open' && !isOpen(m)) return false;
    if (f.license === 'proprietary' && isOpen(m)) return false;
    if (f.maxPrice != null && (m.pb == null || m.pb > f.maxPrice)) return false;
    if (f.minConfidence > 0 && (m.cf ?? 0) < f.minConfidence) return false;
    if (f.needs.size && !meetsNeeds(m, f.needs)) return false;
    if (query && !`${m.n} ${m.v} ${m.id}`.toLowerCase().includes(query)) return false;
    return true;
  });
}

export type SortKey = 'score' | 'value' | 'price' | 'context' | 'released' | 'confidence' | 'name' | 'eci';

const SORTERS: Record<SortKey, (a: Model, b: Model) => number> = {
  score: (a, b) => (b.w ?? -1) - (a.w ?? -1),
  value: (a, b) => (b.val ?? -1) - (a.val ?? -1),
  // Ascending, and unpriced models sink rather than masquerading as free.
  price: (a, b) => (a.pb ?? Infinity) - (b.pb ?? Infinity),
  context: (a, b) => (b.ctx ?? -1) - (a.ctx ?? -1),
  released: (a, b) => String(b.r ?? '').localeCompare(String(a.r ?? '')),
  confidence: (a, b) => (b.cf ?? 0) - (a.cf ?? 0),
  eci: (a, b) => (b.eci ?? -1) - (a.eci ?? -1),
  name: (a, b) => a.n.localeCompare(b.n),
};

/**
 * Sort, then assign tiers.
 *
 * Tiers are ranked over the *filtered* field so they stay meaningful in a
 * narrowed view — inside "open weights under $1" the best available model is
 * S-tier even if it is mid-table globally. Ranking always uses the index, so a
 * tier does not change when the visitor sorts by price.
 */
export function rankAndTier(models: Model[], sort: SortKey): Scored[] {
  const byScore = [...models].sort(SORTERS.score);
  const tiers = new Map<string, Tier | null>();
  const scoreable = byScore.filter((m) => m.w != null);
  scoreable.forEach((m, i) => tiers.set(m.id, tierFromRank(i, scoreable.length)));

  const sorted = sort === 'score' ? byScore : [...models].sort(SORTERS[sort]);
  return sorted.map((m, i) => ({
    ...m,
    score: m.w,
    rank: i + 1,
    tier: tiers.get(m.id) ?? null,
    valueNow: m.w != null && m.pb != null && m.pb > 0 ? m.w / m.pb : null,
  }));
}

/** Highlights for the recommender strip. */
export function picks(models: Scored[]) {
  const scored = models.filter((m) => m.score != null);
  const best = scored[0] ?? null;
  const value = [...scored]
    .filter((m) => m.valueNow != null && (m.cf ?? 0) > 0.3)
    .sort((a, b) => (b.valueNow ?? 0) - (a.valueNow ?? 0))[0] ?? null;
  const open = scored.find((m) => isOpen(m)) ?? null;
  return { best, value, open };
}

/** Distinct vendors present in the data, most models first. */
export function vendorList(models: Model[]): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const m of models) counts.set(m.v, (counts.get(m.v) ?? 0) + 1);
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
