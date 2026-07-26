/**
 * Cross-source identity resolution and the scoring maths behind the WAIN index.
 *
 * The hard part of aggregating leaderboards is that nobody agrees on what a
 * model is called. The same model appears as:
 *
 *   Epoch AI      claude-opus-5_max          (effort after an underscore)
 *   LMArena       claude-opus-4-6-thinking   (variant after a hyphen)
 *   OpenRouter    anthropic/claude-opus-5    (vendor-prefixed product id)
 *
 * We anchor on OpenRouter, which is the only source that lists real, currently
 * purchasable products. Foreign names are matched by progressively stripping
 * trailing reasoning-effort tokens until something lands in the canonical set.
 * That ordering matters: `qwen3.7-max` hits on the first try and keeps its
 * `max` (a product tier), while `gpt-5.5-high` misses, drops `high`, and
 * correctly resolves to `gpt-5.5`.
 */

import { VENDOR_ALIASES, VENDOR_COUNTRY, COUNTRY_NAME_TO_CODE } from './registry.mjs';

/**
 * Tokens that denote a reasoning-effort or thinking-mode variant rather than a
 * distinct product. Stripped only from the tail, and only one at a time.
 */
const EFFORT_TOKENS = new Set([
  'max', 'xhigh', 'high', 'medium', 'low', 'minimal', 'none', 'unknown',
  'promax', 'prounknown', 'prohigh', 'proxhigh', 'promedium', 'prolow',
  'thinking', 'nonthinking', 'reasoning', 'noreasoning', 'think', 'nothink',
  'effort', 'default',
]);

/**
 * Tokens that mark a release channel rather than a capability tier. Safe to
 * strip on their own, but never enough to merge two genuinely different models.
 */
const CHANNEL_TOKENS = new Set([
  'preview', 'prerelease', 'pre', 'release', 'beta', 'beta1', 'beta2', 'alpha',
  'exp', 'experimental', 'latest', 'stable', 'ga', 'test', 'webapp', 'web',
]);

/**
 * Trailing junk that identifies a build rather than a model: date stamps
 * (`20251101`, `0309`), and thinking-token budgets (`32k`, `16k`) that LMArena
 * appends to Anthropic entries.
 */
const BUILD_SUFFIX = /^(?:\d{8}|\d{6}|20\d{2}|0[1-9]\d{2}|1[0-2]\d{2}|\d{1,3}k)$/;

/**
 * A trailing ISO date, already slugified to hyphens (`gpt-5-4-2026-03-05`).
 *
 * This cannot be handled by token-at-a-time peeling: the final `05` is an
 * innocuous two-digit token on its own, so the loop stops before reaching the
 * year. Matching the whole three-token run is the only way to see it.
 */
const TRAILING_DATE = /-20\d{2}-(?:0[1-9]|1[0-2])-(?:[0-2]\d|3[01])(?=-|$)/g;

/**
 * Lowercase, collapse every separator — including the decimal point — to a
 * single hyphen.
 *
 * Folding `.` into `-` is what makes cross-source matching work at all:
 * OpenRouter ships `anthropic/claude-opus-4.8` while Epoch and LMArena both
 * call it `claude-opus-4-8`. Without this the same model lands in the registry
 * twice — once with a price and no scores, once with 33 scores and no price.
 */
export function slugify(raw) {
  return String(raw ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

/**
 * Turn a source-specific model name into `{ base, variant }`.
 *
 * `aggressive` also strips channel tokens and date stamps, which is what we
 * want when *creating* a canonical entry (so `gemini-3.1-pro-preview` and
 * `gemini-3.1-pro` become one model) but not when probing for an exact hit.
 */
export function splitVariant(raw, { aggressive = false } = {}) {
  // Epoch encodes effort after an underscore — honour that first, it is exact.
  let name = String(raw ?? '').trim();
  let variant = null;
  const us = name.lastIndexOf('_');
  if (us > 0) {
    const tail = slugify(name.slice(us + 1));
    if (EFFORT_TOKENS.has(tail) || CHANNEL_TOKENS.has(tail)) {
      variant = tail;
      name = name.slice(0, us);
    }
  }

  const slug = undate(slugify(name));
  let parts = slug.split('-').filter(Boolean);
  const dropped = [];
  // Peel trailing modifier tokens. `parts.length > 1` keeps us from eating a
  // model whose entire name is a modifier word.
  for (;;) {
    const last = parts[parts.length - 1];
    if (parts.length <= 1 || !last) break;
    const isEffort = EFFORT_TOKENS.has(last);
    const isChannel = aggressive && (CHANNEL_TOKENS.has(last) || BUILD_SUFFIX.test(last));
    if (!isEffort && !isChannel) break;
    dropped.unshift(parts.pop());
  }
  if (!variant && dropped.length) variant = dropped.join('-');
  return { base: parts.join('-'), variant };
}

/**
 * Resolve a foreign model name against the canonical set.
 *
 * Returns the canonical key, or `null` when nothing matches — the caller then
 * decides whether to mint a new entry.
 */
export function resolve(raw, canonical) {
  const direct = slugify(String(raw).includes('/') ? String(raw).split('/').pop() : raw)
    .replace(/:free$/, '');
  if (canonical.has(direct)) return direct;

  const undated = direct.replace(TRAILING_DATE, '');
  if (undated !== direct && canonical.has(undated)) return undated;

  // Progressive strip: exact first, then one modifier token at a time.
  let parts = undated.split('-').filter(Boolean);
  while (parts.length > 1) {
    const last = parts[parts.length - 1];
    if (!EFFORT_TOKENS.has(last) && !CHANNEL_TOKENS.has(last) && !BUILD_SUFFIX.test(last)) break;
    parts.pop();
    const probe = parts.join('-');
    if (canonical.has(probe)) return probe;
  }

  // Underscore-style effort (Epoch) that survived slugify as a hyphen.
  const { base } = splitVariant(raw, { aggressive: true });
  if (canonical.has(base)) return base;

  return null;
}

/** Strip a trailing ISO date from an already-slugified id. */
export function undate(slug) {
  return slug.replace(TRAILING_DATE, '');
}

/**
 * Readable label for a model we only ever saw as a raw benchmark row.
 *
 * Models sold through OpenRouter carry a proper display name; research
 * releases and retired versions do not, and `gemini-3-pro-preview` in a table
 * of otherwise title-cased names looks like a bug.
 */
const KEEP_UPPER = new Set(['gpt', 'glm', 'llm', 'moe', 'ai', 'qwq', 'eci', 'hle']);
export function prettyName(slug) {
  const words = [];
  for (const token of slug.split('-')) {
    const prev = words[words.length - 1];
    // `slugify` flattened every decimal point, so `gpt-5-5-instant` arrives as
    // three tokens. A bare number following something that already ends in a
    // digit is the back half of a version — rejoin it rather than printing
    // "GPT 5 5 Instant".
    if (/^\d+$/.test(token) && prev && /\d$/.test(prev)) {
      words[words.length - 1] = `${prev}.${token}`;
      continue;
    }
    if (/^\d/.test(token)) { words.push(token); continue; }   // 235b, 8x7b
    words.push(KEEP_UPPER.has(token) ? token.toUpperCase() : token[0].toUpperCase() + token.slice(1));
  }
  return words.join(' ').replace(/\b(GPT|Grok|Llama) (\d)/g, '$1-$2');
}

/** Collapse a raw organisation string onto a canonical vendor label. */
export function canonVendor(raw) {
  if (!raw) return 'Unknown';
  const first = String(raw).split(',')[0].trim();
  const key = String(raw).toLowerCase().trim();
  return (
    VENDOR_ALIASES[key] ||
    VENDOR_ALIASES[first.toLowerCase()] ||
    first.replace(/\b\w/g, (c) => c.toUpperCase()).replace(/Ai\b/, 'AI')
  );
}

/** Best-effort ISO country code for a vendor. */
export function countryOf(vendor, rawCountry) {
  if (rawCountry) {
    const code = COUNTRY_NAME_TO_CODE[String(rawCountry).toLowerCase().trim()];
    if (code) return code;
  }
  return VENDOR_COUNTRY[vendor] || 'Other';
}

// ── Scoring maths ────────────────────────────────────────────────────────────

/** Linear-interpolated quantile of a pre-sorted numeric array. */
export function quantile(sorted, q) {
  if (!sorted.length) return NaN;
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/**
 * Map a benchmark's raw scores onto a common 0-100 scale.
 *
 * Robust min-max against the 2nd/98th percentile rather than the extremes:
 * benchmarks in this data set range from 0-1 fractions to Elo ratings near
 * 1500 to Vending-Bench's unbounded dollar scores that swing from -31 to
 * +10,940. Clamping keeps one runaway outlier from squashing every other model
 * into the bottom of the range.
 *
 * The band is deliberately wide. A tighter 5/95 clamp pins roughly a tenth of
 * every cohort to exactly 0 or 100 — and since frontier models sit above the
 * 95th percentile on most tests, it reported them all as a flat 100 and threw
 * away precisely the differences a leaderboard exists to show.
 */
export function makeScaler(values) {
  const sorted = [...values].sort((a, b) => a - b);
  let lo = quantile(sorted, 0.02);
  let hi = quantile(sorted, 0.98);
  if (!(hi > lo)) {
    lo = sorted[0];
    hi = sorted[sorted.length - 1];
  }
  if (!(hi > lo)) return () => 50; // degenerate: every model scored identically
  return (x) => Math.max(0, Math.min(100, ((x - lo) / (hi - lo)) * 100));
}

/**
 * Shrink a mean towards a prior in proportion to how little evidence backs it.
 *
 * Without this a model evaluated on a single easy benchmark outranks one
 * measured across thirty. `k` is the number of pseudo-observations of the
 * prior; k=2.5 means a model needs a handful of benchmarks before its own
 * numbers dominate.
 */
export function shrink(mean, n, prior, k = 2.5) {
  if (!n) return prior;
  return (n * mean + k * prior) / (n + k);
}

/**
 * How much to trust a model's aggregate score, in 0-1.
 *
 * Two things make an aggregate untrustworthy, and they are independent:
 *
 *   breadth — a model tested only in a chat arena tells us nothing about its
 *             coding or agentic ability, no matter how many votes it has.
 *   depth   — a category resting on one benchmark is one benchmark's quirks.
 *
 * The geometric mean of the two refuses to let either compensate for the
 * other: 100% breadth with one datapoint each is still thin evidence. This is
 * what stops `chatgpt-4o` (two arena rows, nothing else) from outranking
 * `claude-opus-4-8` (thirty-three measurements across five categories).
 *
 * Kept dependency-free and pure so the browser can re-run it verbatim when the
 * user re-weights the index.
 */
export function confidenceOf(coverage, presentWeight, totalWeight, k = 6) {
  const breadth = totalWeight > 0 ? presentWeight / totalWeight : 0;
  const depth = coverage / (coverage + k);
  return Math.sqrt(Math.max(0, breadth) * Math.max(0, depth));
}

/** Weighted arithmetic mean; returns `null` when no weight is present. */
export function weightedMean(pairs) {
  let num = 0;
  let den = 0;
  for (const [value, weight] of pairs) {
    if (value == null || !Number.isFinite(value) || !(weight > 0)) continue;
    num += value * weight;
    den += weight;
  }
  return den > 0 ? num / den : null;
}

/** Round to `d` decimals, dropping trailing noise so the JSON stays small. */
export function round(x, d = 2) {
  if (x == null || !Number.isFinite(x)) return null;
  const f = 10 ** d;
  return Math.round(x * f) / f;
}

/**
 * Points on the Pareto frontier of (cost ↓, quality ↑).
 *
 * A model is on the frontier when nothing else is both cheaper and better.
 * Sorting by price first makes this a single pass: walk cheapest to priciest
 * and keep whatever beats the best quality seen so far.
 */
export function paretoFrontier(items) {
  const sorted = items
    .filter((m) => m.price > 0 && m.quality != null)
    .sort((a, b) => a.price - b.price || b.quality - a.quality);
  const frontier = [];
  let best = -Infinity;
  for (const m of sorted) {
    if (m.quality > best) {
      best = m.quality;
      frontier.push(m.id);
    }
  }
  return frontier;
}

/**
 * Letter tier from a model's position in the ranked field.
 *
 * Percentile rather than a fixed score cut-off, because the index is
 * deliberately shrunk toward a prior — absolute values compress as evidence
 * thins, so a fixed "S ≥ 88" would simply never fire. Ranking against the
 * current field also keeps the badge meaningful as the frontier moves: an
 * S-tier model is top-3% of what you can actually use today, not top-3% of
 * some scale frozen when this was written.
 */
export function tierFromRank(rank, total) {
  if (rank == null || !total) return null;
  const pct = rank / total;
  if (pct <= 0.03) return 'S';
  if (pct <= 0.10) return 'A';
  if (pct <= 0.25) return 'B';
  if (pct <= 0.50) return 'C';
  return 'D';
}
