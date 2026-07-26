#!/usr/bin/env node
/**
 * Builds the entire data layer of the site.
 *
 * Everything the browser needs is computed here, at build time, and written as
 * static JSON: the client only ever filters and sorts arrays it already has.
 * That keeps the page fast, immune to third-party API outages, and free of the
 * CORS problems that come with calling these sources from a browser.
 *
 *   node scripts/collect.mjs [--offline]
 *
 * `--offline` reuses whatever is in `.cache/`, which makes iterating on the
 * aggregation maths cheap and keeps CI from hammering the upstream sources.
 */

import { mkdir, writeFile, readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CATEGORIES, EPOCH_BENCHMARKS, ARENAS, PRESETS, SOURCES, COUNTRIES,
} from './registry.mjs';
import {
  slugify, splitVariant, resolve, canonVendor, countryOf,
  makeScaler, shrink, weightedMean, round, paretoFrontier, tierFromRank, confidenceOf,
  undate, prettyName,
} from './normalize.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'data');
const CACHE = join(ROOT, '.cache');
const OFFLINE = process.argv.includes('--offline');

const EPOCH_ZIP = 'https://epoch.ai/data/benchmark_data.zip';
const OPENROUTER = 'https://openrouter.ai/api/v1/models';
const HF = 'https://datasets-server.huggingface.co';
const AA = 'https://artificialanalysis.ai/api/v2/language/models/free';

/** Models older than this are historical context, not buying advice. */
const MODERN_CUTOFF = '2025-01-01';

const log = (...a) => console.log('•', ...a);
const warn = (...a) => console.warn('!', ...a);

// ── Fetching ─────────────────────────────────────────────────────────────────

/**
 * Fetch with retry and an on-disk cache.
 *
 * Upstream sources fail intermittently; a run that loses one source silently
 * would publish a leaderboard with a hole in it, so every fetch falls back to
 * the last good cached copy and the failure is recorded in the output.
 */
async function grab(url, { key, json = true, tries = 3, headers = {} } = {}) {
  const cacheFile = join(CACHE, key ?? createHash('sha1').update(url).digest('hex'));

  if (OFFLINE) {
    const buf = await readFile(cacheFile).catch(() => null);
    if (!buf) throw new Error(`offline and nothing cached for ${url}`);
    return json ? JSON.parse(buf.toString('utf8')) : buf;
  }

  let lastErr;
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': 'what-ai-need/1.0 (+https://what-ai-need.bossincrypto.dev)', ...headers },
        signal: AbortSignal.timeout(90_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      await mkdir(CACHE, { recursive: true });
      await writeFile(cacheFile, buf);
      return json ? JSON.parse(buf.toString('utf8')) : buf;
    } catch (err) {
      lastErr = err;
      if (attempt < tries) await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    }
  }

  const stale = await readFile(cacheFile).catch(() => null);
  if (stale) {
    warn(`${url} failed (${lastErr.message}) — using cached copy`);
    return json ? JSON.parse(stale.toString('utf8')) : stale;
  }
  throw lastErr;
}

// ── Minimal ZIP + CSV readers (avoids pulling in dependencies) ────────────────

/**
 * Read a ZIP archive from its end-of-central-directory record.
 *
 * Only the two cases Epoch's export actually uses are handled: stored (0) and
 * deflate (8). Anything else throws rather than returning silent garbage.
 */
function unzip(buf) {
  const eocdSig = 0x06054b50;
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 66_000; i--) {
    if (buf.readUInt32LE(i) === eocdSig) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('not a zip archive');

  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = new Map();

  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('bad central directory');
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);

    // The local header repeats the name/extra lengths, and they can differ
    // from the central directory's — always read them from the local record.
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(dataStart, dataStart + compSize);

    if (method === 0) files.set(name, raw);
    else if (method === 8) files.set(name, inflateRawSync(raw));
    else throw new Error(`unsupported zip compression ${method} for ${name}`);

    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

/** RFC 4180 CSV parse into an array of row objects. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];

  const header = rows[0].map((h) => h.trim());
  return rows.slice(1)
    .filter((r) => r.length > 1)
    .map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])));
}

const num = (v) => {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(/[%$,]/g, ''));
  return Number.isFinite(n) ? n : null;
};

// ── Source loaders ───────────────────────────────────────────────────────────

/** Epoch AI: 40+ benchmarks plus their own composite capability index. */
async function loadEpoch() {
  const buf = await grab(EPOCH_ZIP, { key: 'epoch.zip', json: false });
  const files = unzip(buf);
  log(`Epoch AI: ${files.size} files in archive`);

  /** benchmark id → [{ name, score, org, country, released }] */
  const benches = new Map();
  for (const b of EPOCH_BENCHMARKS) {
    const file = files.get(b.file);
    if (!file) { warn(`Epoch: ${b.file} missing from archive`); continue; }
    const rows = parseCsv(file.toString('utf8'));
    const out = [];
    for (const r of rows) {
      const score = num(r[b.col]);
      const name = r['Model version'] || r.Name;
      if (score == null || !name) continue;
      out.push({
        name,
        score,
        org: r.Organization || '',
        country: r.Country || '',
        released: r['Release date'] || '',
        agent: r.Agent || null,
      });
    }
    if (out.length) benches.set(b.id, out);
    else warn(`Epoch: ${b.id} produced no rows (column "${b.col}"?)`);
  }

  // Epoch's own cross-benchmark composite, kept as an independent opinion
  // rather than folded into our index (it would double-count the same runs).
  const eci = new Map();
  const eciFile = files.get('epoch_capabilities_index.csv');
  if (eciFile) {
    for (const r of parseCsv(eciFile.toString('utf8'))) {
      const v = num(r['ECI Score']);
      const name = r['Model version'];
      if (v == null || !name) continue;
      const { base } = splitVariant(name, { aggressive: true });
      const prev = eci.get(base);
      if (!prev || v > prev.score) {
        eci.set(base, {
          score: v,
          org: r.Organization || '',
          country: r.Country || '',
          released: r['Release date'] || '',
        });
      }
    }
  }
  log(`Epoch AI: ${benches.size} benchmarks, ECI for ${eci.size} models`);
  return { benches, eci };
}

/** OpenRouter: the commercial reality layer — price, context, modality. */
async function loadOpenRouter() {
  const { data } = await grab(OPENROUTER, { key: 'openrouter.json' });
  const out = [];
  for (const m of data) {
    // `~`-prefixed ids and the auto/fusion routers are meta-endpoints that
    // dispatch to other models; they have no capabilities of their own.
    if (m.id.startsWith('~') || m.id.startsWith('openrouter/')) continue;
    const free = m.id.endsWith(':free');
    const id = m.id.replace(/:free$/, '');
    const [vendorSlug, ...rest] = id.split('/');
    const productSlug = rest.join('/');

    const pIn = num(m.pricing?.prompt);
    const pOut = num(m.pricing?.completion);
    out.push({
      orId: id,
      // OpenRouter sells date-pinned snapshots (`gpt-4o-2024-08-06`) alongside
      // the rolling id. They are the same model for our purposes, and keeping
      // them apart would strand every benchmark score on the undated name.
      slug: undate(slugify(productSlug)),
      vendorSlug,
      name: String(m.name || '').replace(/^[^:]+:\s*/, '').replace(/\s*\(free\)$/i, ''),
      // OpenRouter quotes per-token prices; per-million is what humans compare.
      priceIn: pIn == null ? null : pIn * 1e6,
      priceOut: pOut == null ? null : pOut * 1e6,
      cacheRead: num(m.pricing?.input_cache_read) == null ? null : num(m.pricing.input_cache_read) * 1e6,
      context: m.context_length ?? m.top_provider?.context_length ?? null,
      maxOut: m.top_provider?.max_completion_tokens ?? null,
      inputModalities: m.architecture?.input_modalities ?? [],
      outputModalities: m.architecture?.output_modalities ?? [],
      tools: (m.supported_parameters ?? []).includes('tools'),
      structured: (m.supported_parameters ?? []).includes('structured_outputs'),
      reasoning: Boolean(m.reasoning) || (m.supported_parameters ?? []).includes('reasoning'),
      efforts: m.reasoning?.supported_efforts ?? null,
      created: m.created ? new Date(m.created * 1000).toISOString().slice(0, 10) : null,
      hf: m.hugging_face_id ?? null,
      free,
      description: m.description ?? '',
    });
  }

  // Collapse `:free` duplicates onto their paid twin, keeping the free flag.
  const byId = new Map();
  for (const m of out) {
    const prev = byId.get(m.orId);
    if (!prev) byId.set(m.orId, m);
    else prev.free = prev.free || m.free;
  }
  log(`OpenRouter: ${byId.size} models`);
  return [...byId.values()];
}

/** LMArena via the official Hugging Face mirror of the leaderboard. */
async function loadArenas() {
  const out = new Map();
  for (const a of ARENAS) {
    const rows = [];
    try {
      for (let offset = 0; offset < 1200; offset += 100) {
        const url = `${HF}/filter?dataset=${encodeURIComponent('lmarena-ai/leaderboard-dataset')}`
          + `&config=${a.id}&split=latest`
          + `&where=${encodeURIComponent('"category"=\'overall\'')}`
          + `&offset=${offset}&length=100`;
        const page = await grab(url, { key: `arena-${a.id}-${offset}.json` });
        for (const r of page.rows ?? []) rows.push(r.row);
        if (!page.rows?.length || rows.length >= (page.num_rows_total ?? 0)) break;
      }
    } catch (err) {
      warn(`Arena ${a.id}: ${err.message}`);
      continue;
    }
    if (!rows.length) continue;
    // Not every arena uses the same column names. The classic Elo boards carry
    // `rating`/`vote_count`; the newer agent board reports a win-rate style
    // `score` with `session_count`. Reading only the first shape silently
    // dropped a whole leaderboard, so accept both and record which it was.
    const norm = rows
      .map((r) => ({
        name: r.model_name,
        org: r.organization ?? '',
        license: r.license ?? '',
        rating: Number.isFinite(r.rating) ? r.rating : r.score,
        lo: r.rating_lower ?? r.score_ci_lower ?? null,
        hi: r.rating_upper ?? r.score_ci_upper ?? null,
        votes: r.vote_count ?? r.session_count ?? r.observation_count ?? 0,
        rank: r.rank,
      }))
      .filter((r) => Number.isFinite(r.rating) && r.name);

    if (!norm.length) { warn(`Arena ${a.id}: no usable ratings`); continue; }
    out.set(a.id, {
      published: rows[0]?.leaderboard_publish_date ?? null,
      // Elo sits in the hundreds; the agent board's score is a 0-1 fraction.
      elo: norm[0].rating > 100,
      models: norm,
    });
    log(`Arena ${a.id}: ${norm.length} models`);
  }
  return out;
}

/** Artificial Analysis — optional, needs a free key in `AA_API_KEY`. */
async function loadArtificialAnalysis() {
  const key = process.env.AA_API_KEY;
  if (!key) { log('Artificial Analysis: no AA_API_KEY, skipping'); return null; }
  try {
    const res = await grab(AA, { key: 'aa.json', headers: { 'x-api-key': key } });
    const rows = res.data ?? res.models ?? [];
    log(`Artificial Analysis: ${rows.length} models`);
    return rows.map((m) => ({
      slug: slugify(m.slug ?? m.name),
      name: m.name,
      creator: m.model_creator?.name ?? '',
      released: m.release_date ?? null,
      intelligence: m.evaluations?.artificial_analysis_intelligence_index ?? null,
      coding: m.evaluations?.artificial_analysis_coding_index ?? null,
      math: m.evaluations?.artificial_analysis_math_index ?? null,
      speed: m.performance?.median_output_tokens_per_second ?? null,
      latency: m.performance?.median_time_to_first_token_seconds ?? null,
      orId: m.openrouter_api_id ?? null,
    }));
  } catch (err) {
    warn(`Artificial Analysis: ${err.message}`);
    return null;
  }
}

// ── Aggregation ──────────────────────────────────────────────────────────────

/**
 * Fold every source into one canonical model registry.
 *
 * OpenRouter seeds the canonical key space because it is the only source
 * describing products you can actually buy. Benchmark-only models (research
 * releases, retired versions) get minted as they are encountered.
 */
function buildRegistry(or, epoch, arenas) {
  /** canonical key → model record */
  const models = new Map();
  const canonical = new Set();

  const blank = (id) => ({
    id,
    name: null,
    vendor: 'Unknown',
    country: 'Other',
    released: null,
    scores: {},        // benchmark id → raw score
    normalized: {},    // benchmark id → 0-100
    arena: {},         // arena id → { rating, votes, rank }
    variants: new Set(),
    sources: new Set(),
    openrouter: null,
    eci: null,
    aa: null,
  });

  // Newest first, so that when date-pinned snapshots collapse onto one slug
  // the rolling/latest listing is the one whose price and context we keep.
  for (const m of [...or].sort((a, b) => String(b.created ?? '').localeCompare(String(a.created ?? '')))) {
    const id = m.slug;
    if (models.has(id)) {
      const rec = models.get(id);
      rec.openrouter.free = rec.openrouter.free || m.free;
      // Earliest listing date is the family's real debut.
      if (m.created && (!rec.released || m.created < rec.released)) rec.released = m.created;
      continue;
    }
    canonical.add(id);
    const rec = blank(id);
    rec.name = m.name;
    rec.vendor = canonVendor(m.vendorSlug);
    rec.country = countryOf(rec.vendor, null);
    rec.released = m.created;
    rec.openrouter = m;
    rec.sources.add('openrouter');
    models.set(id, rec);
  }

  /** Look up an existing canonical model, or mint one for a foreign name. */
  const touch = (rawName, { org, country, released }) => {
    let id = resolve(rawName, canonical);
    if (!id) {
      id = splitVariant(rawName, { aggressive: true }).base;
      if (!id) return null;
      canonical.add(id);
      models.set(id, blank(id));
    }
    const rec = models.get(id);
    const { variant } = splitVariant(rawName, { aggressive: false });
    if (variant) rec.variants.add(variant);
    if (!rec.name) rec.name = prettyName(id);
    if (rec.vendor === 'Unknown' && org) {
      rec.vendor = canonVendor(org);
      rec.country = countryOf(rec.vendor, country);
    }
    // Prefer the earliest credible release date we see for the family.
    if (released && (!rec.released || released < rec.released)) rec.released = released;
    return rec;
  };

  // Benchmarks. A model may appear many times per benchmark (one row per
  // reasoning effort, or per agent scaffold on Terminal-Bench); the
  // leaderboard convention is to report its best configuration.
  for (const b of EPOCH_BENCHMARKS) {
    const rows = epoch.benches.get(b.id);
    if (!rows) continue;
    for (const r of rows) {
      const rec = touch(r.name, { org: r.org, country: r.country, released: r.released });
      if (!rec) continue;
      rec.sources.add('epoch');
      if (rec.scores[b.id] == null || r.score > rec.scores[b.id]) rec.scores[b.id] = r.score;
    }
  }

  for (const [base, e] of epoch.eci) {
    const rec = touch(base, { org: e.org, country: e.country, released: e.released });
    if (!rec) continue;
    rec.sources.add('epoch');
    rec.eci = e.score;
  }

  // Arenas.
  for (const [arenaId, data] of arenas) {
    for (const m of data.models) {
      const rec = touch(m.name, { org: m.org, country: null, released: null });
      if (!rec) continue;
      rec.sources.add('lmarena');
      const prev = rec.arena[arenaId];
      if (!prev || m.rating > prev.rating) {
        rec.arena[arenaId] = { rating: m.rating, lo: m.lo, hi: m.hi, votes: m.votes, rank: m.rank };
      }
      if (m.license && !rec.license) rec.license = m.license;
    }
  }

  return models;
}

/** Attach Artificial Analysis rows by OpenRouter id first, then by slug. */
function attachAA(models, aa) {
  if (!aa) return;
  const byOr = new Map();
  for (const rec of models.values()) {
    if (rec.openrouter) byOr.set(rec.openrouter.orId, rec);
  }
  const canonical = new Set(models.keys());
  for (const row of aa) {
    let rec = row.orId ? byOr.get(row.orId) : null;
    if (!rec) {
      const id = resolve(row.slug, canonical);
      rec = id ? models.get(id) : null;
    }
    if (!rec) continue;
    rec.aa = row;
    rec.sources.add('aa');
  }
}

/**
 * Normalise every benchmark onto 0-100 and roll the result up into category
 * scores and the overall WAIN index.
 */
function score(models) {
  const list = [...models.values()];
  const modern = (m) => !m.released || m.released >= MODERN_CUTOFF;

  // Scale each benchmark against its own modern cohort. Calibrating on the
  // full history would compress today's models into the top few points,
  // because these benchmarks all start near zero for 2023-era models.
  for (const b of EPOCH_BENCHMARKS) {
    const cohort = list.filter((m) => modern(m) && m.scores[b.id] != null).map((m) => m.scores[b.id]);
    if (cohort.length < 4) continue;
    const scale = makeScaler(cohort);
    for (const m of list) {
      if (m.scores[b.id] != null) m.normalized[b.id] = scale(m.scores[b.id]);
    }
  }

  // Arena Elo gets the same treatment, per arena.
  for (const a of ARENAS) {
    const cohort = list.filter((m) => m.arena[a.id]).map((m) => m.arena[a.id].rating);
    if (cohort.length < 4) continue;
    const scale = makeScaler(cohort);
    for (const m of list) {
      if (m.arena[a.id]) m.normalized[`arena:${a.id}`] = scale(m.arena[a.id].rating);
    }
  }

  // Category means, then a prior pass, then shrinkage. Two passes are needed
  // because the prior is the cohort median of the very thing being computed.
  const byCat = new Map(CATEGORIES.map((c) => [c.id, []]));
  const rawCat = new Map();

  for (const m of list) {
    const cats = {};
    for (const c of CATEGORIES) {
      const pairs = [];
      if (c.id === 'preference') {
        for (const a of ARENAS) {
          const v = m.normalized[`arena:${a.id}`];
          if (v != null) pairs.push([v, a.w]);
        }
      } else {
        for (const b of EPOCH_BENCHMARKS) {
          if (b.cat !== c.id) continue;
          const v = m.normalized[b.id];
          if (v != null) pairs.push([v, b.w]);
        }
      }
      if (!pairs.length) continue;
      cats[c.id] = { mean: weightedMean(pairs), n: pairs.length };
      if (modern(m)) byCat.get(c.id).push(cats[c.id].mean);
    }
    rawCat.set(m.id, cats);
  }

  const priors = {};
  for (const [cat, values] of byCat) {
    const sorted = values.sort((a, b) => a - b);
    priors[cat] = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 50;
  }

  for (const m of list) {
    const cats = rawCat.get(m.id);
    m.categories = {};
    m.categoriesRaw = {};
    for (const [cat, { mean, n }] of Object.entries(cats)) {
      m.categoriesRaw[cat] = mean;
      m.categories[cat] = shrink(mean, n, priors[cat]);
      m.categories[cat] = Math.max(0, Math.min(100, m.categories[cat]));
    }
    m.coverage = Object.values(cats).reduce((s, c) => s + c.n, 0);
    m.categoryCounts = Object.fromEntries(Object.entries(cats).map(([k, v]) => [k, v.n]));
  }

  // The headline index, with the default weights. The client recomputes this
  // live whenever the user moves a weight slider or picks a task preset, using
  // exactly the same three steps.
  const totalWeight = CATEGORIES.reduce((s, c) => s + c.w, 0);
  for (const m of list) {
    m.wainRaw = weightedMean(CATEGORIES.map((c) => [m.categories[c.id], c.w]));
    const present = CATEGORIES.reduce((s, c) => s + (m.categories[c.id] != null ? c.w : 0), 0);
    m.confidence = confidenceOf(m.coverage, present, totalWeight);
  }

  // Step three needs a prior, and the prior is the median of step one — so it
  // can only be computed once every model has a raw score.
  const rawScores = list
    .filter((m) => m.wainRaw != null && modern(m))
    .map((m) => m.wainRaw)
    .sort((a, b) => a - b);
  const prior = rawScores.length ? rawScores[Math.floor(rawScores.length / 2)] : 50;

  for (const m of list) {
    m.wain = m.wainRaw == null ? null : prior + (m.wainRaw - prior) * m.confidence;
  }
  return { list, prior };
}

/**
 * Derived analytics: price, value, source disagreement, Pareto frontier.
 */
function analyse(list) {
  for (const m of list) {
    const or = m.openrouter;
    // A 3:1 input:output token mix is the usual assumption for chat and
    // agentic workloads, and it is the ratio these vendors price against.
    m.blended = or && or.priceIn != null && or.priceOut != null
      ? (or.priceIn * 3 + or.priceOut) / 4
      : null;
    m.value = m.wain != null && m.blended > 0 ? m.wain / m.blended : null;

    // Where the crowd and the benchmarks disagree. Positive means humans like
    // it more than its benchmark scores suggest — usually a sign of tone and
    // formatting quality that benchmarks do not capture.
    const bench = weightedMean(
      CATEGORIES.filter((c) => c.id !== 'preference').map((c) => [m.categories[c.id], c.w]),
    );
    const pref = m.categories.preference ?? null;
    m.benchScore = bench;
    m.gap = bench != null && pref != null ? pref - bench : null;
  }

  const priced = list.filter((m) => m.blended > 0 && m.wain != null);
  const frontier = new Set(paretoFrontier(priced.map((m) => ({ id: m.id, price: m.blended, quality: m.wain }))));
  for (const m of list) m.pareto = frontier.has(m.id);

  // Value percentile makes "cheap for what it is" comparable across tiers.
  const values = priced.map((m) => m.value).sort((a, b) => a - b);
  for (const m of list) {
    if (m.value == null) { m.valuePct = null; continue; }
    let i = 0;
    while (i < values.length && values[i] < m.value) i++;
    m.valuePct = values.length > 1 ? (i / (values.length - 1)) * 100 : 50;
  }
  return list;
}

// ── Output ───────────────────────────────────────────────────────────────────

/** Trim a model down to what the client actually renders. */
function serialize(m) {
  const or = m.openrouter;
  const out = {
    id: m.id,
    n: m.name,
    v: m.vendor,
    c: m.country,
    r: m.released,
    w: round(m.wain, 1),
    wr: round(m.wainRaw, 1),
    cf: round(m.confidence, 3),
    b: round(m.benchScore, 1),
    g: round(m.gap, 1),
    t: m.tier,
    cov: m.coverage,
    cat: Object.fromEntries(Object.entries(m.categories).map(([k, v]) => [k, round(v, 1)])),
    cn: m.categoryCounts,
    src: [...m.sources],
  };
  if (m.eci != null) out.eci = round(m.eci, 1);
  if (m.pareto) out.p = 1;
  if (m.value != null) { out.val = round(m.value, 2); out.vp = round(m.valuePct, 0); }
  if (m.variants.size) out.var = [...m.variants].sort();

  if (or) {
    out.or = or.orId;
    out.pi = round(or.priceIn, 3);
    out.po = round(or.priceOut, 3);
    out.pb = round(m.blended, 3);
    if (or.cacheRead != null) out.pc = round(or.cacheRead, 4);
    out.ctx = or.context;
    if (or.maxOut) out.mo = or.maxOut;
    out.im = or.inputModalities;
    out.f = [or.tools ? 'tools' : null, or.structured ? 'json' : null, or.reasoning ? 'reason' : null, or.free ? 'free' : null].filter(Boolean);
    if (or.hf) out.hf = or.hf;
  }

  return out;
}

/**
 * Per-model score breakdowns, split into their own file.
 *
 * These account for 40% of the model payload but are only read when a visitor
 * opens a model or the benchmark explorer. Keeping them out of the initial
 * fetch cuts first load from 56 KB to 34 KB gzipped; the client prefetches
 * this file when the browser goes idle, so the first click still feels instant.
 */
function serializeDetail(m, benchRanks) {
  const out = {};

  const bs = {};
  for (const b of EPOCH_BENCHMARKS) {
    if (m.scores[b.id] == null) continue;
    const placing = benchRanks.get(b.id)?.get(m.id);
    // Rank within the benchmark is what a reader actually wants — "#3 of 183"
    // means something on its own, where a normalised 92.4 does not.
    bs[b.id] = [round(m.scores[b.id], 4), round(m.normalized[b.id], 1),
      placing?.rank ?? null, placing?.total ?? null];
  }
  if (Object.keys(bs).length) out.bs = bs;

  const ar = {};
  for (const a of ARENAS) {
    const e = m.arena[a.id];
    if (!e) continue;
    // Elo is whole numbers; a win-rate score needs its decimals or it rounds
    // away to zero.
    ar[a.id] = [round(e.rating, e.rating > 100 ? 0 : 4), e.votes, e.rank,
      round(m.normalized[`arena:${a.id}`], 1)];
  }
  if (Object.keys(ar).length) out.ar = ar;

  if (m.aa) {
    out.aa = {
      i: round(m.aa.intelligence, 1),
      s: round(m.aa.speed, 1),
      l: round(m.aa.latency, 2),
    };
  }
  return Object.keys(out).length ? out : null;
}

/** Frontier-over-time series: the best score achieved on each date. */
function buildTimeline(list) {
  const out = {};
  for (const c of CATEGORIES) {
    const points = list
      .filter((m) => m.released && m.categories[c.id] != null && m.released >= '2024-01-01')
      .sort((a, b) => a.released.localeCompare(b.released));
    const series = [];
    let best = -Infinity;
    for (const m of points) {
      if (m.categories[c.id] > best) {
        best = m.categories[c.id];
        series.push([m.released, round(best, 1), m.id, m.name]);
      }
    }
    if (series.length > 1) out[c.id] = series;
  }
  return out;
}

async function main() {
  const started = Date.now();
  await mkdir(OUT, { recursive: true });

  const results = await Promise.allSettled([
    loadEpoch(), loadOpenRouter(), loadArenas(), loadArtificialAnalysis(),
  ]);
  const [epochR, orR, arenaR, aaR] = results;
  const health = [];

  if (epochR.status !== 'fulfilled') throw new Error(`Epoch AI failed: ${epochR.reason?.message}`);
  if (orR.status !== 'fulfilled') throw new Error(`OpenRouter failed: ${orR.reason?.message}`);

  const epoch = epochR.value;
  const or = orR.value;
  const arenas = arenaR.status === 'fulfilled' ? arenaR.value : new Map();
  const aa = aaR.status === 'fulfilled' ? aaR.value : null;

  health.push({ id: 'epoch', ok: true, n: epoch.benches.size });
  health.push({ id: 'openrouter', ok: true, n: or.length });
  health.push({ id: 'lmarena', ok: arenas.size > 0, n: arenas.size });
  health.push({ id: 'aa', ok: Boolean(aa), n: aa?.length ?? 0 });

  const models = buildRegistry(or, epoch, arenas);
  attachAA(models, aa);
  const { list: scored, prior } = score(models);
  const list = analyse(scored);

  // Publish anything scored, or anything currently purchasable. A model with
  // neither is a bare name we picked up from a stale benchmark row.
  const published = list
    .filter((m) => m.wain != null || m.openrouter)
    .sort((a, b) => (b.wain ?? -1) - (a.wain ?? -1));

  // Tiers are ranked against the models a visitor could plausibly pick today,
  // so retired 2023 releases do not pad the field and inflate everyone's badge.
  const ranked = published.filter((m) => m.wain != null && (!m.released || m.released >= MODERN_CUTOFF));
  ranked.forEach((m, i) => { m.tier = tierFromRank(i, ranked.length); });

  const generated = new Date().toISOString();
  const arenaMeta = {};
  for (const [id, d] of arenas) {
    arenaMeta[id] = { published: d.published, n: d.models.length, elo: d.elo };
  }

  const meta = {
    generated,
    dataDate: generated.slice(0, 10),
    counts: {
      models: published.length,
      priced: published.filter((m) => m.blended > 0).length,
      benchmarks: epoch.benches.size,
      arenas: arenas.size,
      vendors: new Set(published.map((m) => m.vendor)).size,
      datapoints: published.reduce((s, m) => s + m.coverage, 0),
    },
    categories: CATEGORIES,
    benchmarks: EPOCH_BENCHMARKS.map(({ file, col, ...rest }) => rest),
    arenas: ARENAS.map((a) => ({ ...a, ...arenaMeta[a.id] })),
    presets: PRESETS,
    sources: SOURCES,
    countries: COUNTRIES,
    health,
    cutoff: MODERN_CUTOFF,
    // Constants the client needs to reproduce the index under custom weights.
    scoring: { prior: round(prior, 2), k: 6 },
  };

  const write = async (name, data) => {
    const body = JSON.stringify(data);
    await writeFile(join(OUT, name), body);
    log(`wrote ${name} — ${(body.length / 1024).toFixed(1)} KB`);
  };

  // Placing per benchmark, computed once over every model that has a score.
  const benchRanks = new Map();
  for (const b of EPOCH_BENCHMARKS) {
    const entrants = published
      .filter((m) => m.scores[b.id] != null)
      .sort((a, z) => z.scores[b.id] - a.scores[b.id]);
    if (!entrants.length) continue;
    const placings = new Map();
    entrants.forEach((m, i) => placings.set(m.id, { rank: i + 1, total: entrants.length }));
    benchRanks.set(b.id, placings);
  }

  const details = {};
  for (const m of published) {
    const d = serializeDetail(m, benchRanks);
    if (d) details[m.id] = d;
  }

  await write('meta.json', meta);
  await write('models.json', published.map(serialize));
  await write('details.json', details);
  await write('timeline.json', buildTimeline(published));

  log(`done in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  log(`${published.length} models · ${meta.counts.datapoints} datapoints · ${meta.counts.priced} priced`);
}

main().catch((err) => {
  console.error('collect failed:', err);
  process.exit(1);
});
