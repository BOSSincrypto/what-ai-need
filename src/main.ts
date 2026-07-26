/**
 * Application shell: state, rendering and event wiring.
 *
 * There is no framework and no virtual DOM. Sections re-render by replacing
 * their own container's children, which for a page of this size is both faster
 * and less code than diffing would be. The single source of truth is `state`;
 * `render()` derives everything else from it.
 */

import './style.css';
import type { Details, Lang, Meta, Model, Timeline } from './types';
import { t, loc, setLang, getLang, fmt, fmtPrice, fmtTokens, fmtDate, fmtDateShort, type Key } from './i18n';
import { h, mount, $, debounce } from './dom';
import {
  rescore, applyFilters, rankAndTier, picks, vendorList, defaultFilters, isOpen,
  type Filters, type Scored, type SortKey,
} from './compute';
import {
  paretoChart, timelineChart, barChart, divergingChart, groupedBars, meter, hideTooltip,
} from './charts';

// ── State ────────────────────────────────────────────────────────────────────

interface State {
  meta: Meta;
  models: Model[];
  timeline: Timeline;
  filters: Filters;
  weights: Record<string, number>;
  preset: string;
  sort: SortKey;
  limit: number;
  tab: string;
  compare: string[];
  benchmark: string;
  showWeights: boolean;
}

let state: State;
/** Cache of the last rescore, so filtering does not redo the maths. */
let scoredCache: { key: string; models: Model[] } | null = null;

const PAGE = 40;
const MAX_COMPARE = 4;

// ── Lazy detail payload ──────────────────────────────────────────────────────

/**
 * Per-model benchmark breakdowns live in a second file.
 *
 * They are 40% of the model data and are needed only by the detail sheet and
 * the benchmark explorer, so the initial render does not wait for them. The
 * fetch is kicked off when the browser goes idle, and awaited on demand if a
 * visitor clicks faster than that.
 */
let detailsPromise: Promise<void> | null = null;

function ensureDetails(): Promise<void> {
  detailsPromise ??= fetch(`${import.meta.env.BASE_URL}data/details.json`)
    .then((r) => r.json() as Promise<Details>)
    .then((details) => {
      for (const m of state.models) Object.assign(m, details[m.id]);
      // Anything already rescored is a copy, so drop the cache to pick these up.
      scoredCache = null;
    })
    .catch(() => { /* detail panels degrade to the summary they already have */ });
  return detailsPromise;
}

const hasDetails = () => state.models.some((m) => m.bs || m.ar);

// ── Persistence ──────────────────────────────────────────────────────────────

const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

/**
 * Reflect the view in the URL so a filtered leaderboard can be shared.
 *
 * Only non-default values are written — a pristine page keeps a clean address,
 * and `replaceState` keeps the back button meaning "the previous page" rather
 * than "the previous keystroke".
 */
function syncUrl() {
  const p = new URLSearchParams();
  const f = state.filters;
  if (state.preset !== 'balanced') p.set('for', state.preset);
  if (f.query) p.set('q', f.query);
  if (f.vendor) p.set('vendor', f.vendor);
  if (f.country) p.set('country', f.country);
  if (f.license !== 'all') p.set('lic', f.license);
  if (f.maxPrice != null) p.set('max', String(f.maxPrice));
  if (f.needs.size) p.set('needs', [...f.needs].join(','));
  if (!f.modernOnly) p.set('all', '1');
  if (state.sort !== 'score') p.set('sort', state.sort);
  if (state.tab !== 'pareto') p.set('tab', state.tab);
  if (state.compare.length) p.set('cmp', state.compare.join(','));
  const qs = p.toString();
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}

function readUrl(meta: Meta): Partial<State> {
  const p = new URLSearchParams(location.search);
  const f = defaultFilters();
  f.query = p.get('q') ?? '';
  f.vendor = p.get('vendor') ?? '';
  f.country = p.get('country') ?? '';
  const lic = p.get('lic');
  if (lic === 'open' || lic === 'proprietary') f.license = lic;
  const max = Number(p.get('max'));
  if (p.get('max') && Number.isFinite(max)) f.maxPrice = max;
  if (p.get('needs')) f.needs = new Set(p.get('needs')!.split(',').filter(Boolean));
  if (p.get('all') === '1') f.modernOnly = false;

  const preset = meta.presets.find((x) => x.id === p.get('for'))?.id ?? 'balanced';
  const weights = { ...meta.presets.find((x) => x.id === preset)!.w };
  return {
    filters: f, preset, weights,
    sort: (p.get('sort') as SortKey) ?? (preset === 'bulk' ? 'value' : 'score'),
    tab: p.get('tab') ?? 'pareto',
    compare: (p.get('cmp') ?? '').split(',').filter(Boolean).slice(0, MAX_COMPARE),
  };
}

// ── Derived data ─────────────────────────────────────────────────────────────

function pipeline(): Scored[] {
  const key = JSON.stringify(state.weights);
  if (scoredCache?.key !== key) {
    scoredCache = { key, models: rescore(state.models, state.meta, state.weights) };
  }
  const filtered = applyFilters(scoredCache.models, state.filters, state.meta.cutoff);
  return rankAndTier(filtered, state.sort);
}

// ── Small building blocks ────────────────────────────────────────────────────

const tierBadge = (tier: string | null) =>
  h('span', { class: `tier t${tier ?? 'x'}`, title: `Tier ${tier ?? '—'}` }, tier ?? '—');

const flag = (code: string) => state.meta.countries[code]?.flag ?? '🏳️';

/** Confidence rendered as a 5-pip strip — a bar would read as another score. */
function confPips(cf: number): HTMLElement {
  const filled = Math.round(cf * 5);
  return h('span', {
    class: 'pips',
    title: `${t('confidence')}: ${Math.round(cf * 100)}%`,
    'aria-label': `${t('confidence')} ${Math.round(cf * 100)}%`,
  }, ...Array.from({ length: 5 }, (_, i) => h('i', { class: i < filled ? 'on' : '' })));
}

function sourceDots(src: string[]): HTMLElement {
  const all = ['epoch', 'lmarena', 'openrouter'];
  return h('span', { class: 'srcs' }, ...all
    .filter((s) => src.includes(s))
    .map((s) => h('i', { class: `src src-${s}`, title: s })));
}

// ── Sections ─────────────────────────────────────────────────────────────────

function renderRecommender(rows: Scored[]): HTMLElement {
  const { best, value, open } = picks(rows);
  const card = (label: string, m: Scored | null, note: string) => !m ? null : h('button', {
    class: 'pick', type: 'button', onclick: () => openDetail(m.id),
  },
    h('span', { class: 'pick-label' }, label),
    h('span', { class: 'pick-name' }, m.n),
    h('span', { class: 'pick-meta' }, `${flag(m.c)} ${m.v}`),
    h('span', { class: 'pick-note' }, note),
  );

  return h('section', { class: 'reco card' },
    h('h2', {}, t('whatFor')),
    h('p', { class: 'hint' }, t('whatForHint')),
    h('div', { class: 'chips' }, ...state.meta.presets.map((p) => h('button', {
      type: 'button',
      class: `chip ${state.preset === p.id ? 'on' : ''}`,
      'aria-pressed': state.preset === p.id,
      onclick: () => {
        state.preset = p.id;
        state.weights = { ...p.w };
        state.sort = (p.sort as SortKey) ?? 'score';
        state.limit = PAGE;
        render();
      },
    }, h('span', { class: 'chip-ico' }, p.icon), loc(p))) ),

    h('div', { class: 'reco-grid' },
      h('label', { class: 'field' },
        h('span', {}, t('budget')),
        h('span', { class: 'range-row' },
          h('input', {
            type: 'range', min: '0', max: '100', step: '1',
            value: String(priceToSlider(state.filters.maxPrice)),
            oninput: (e: Event) => {
              const v = Number((e.target as HTMLInputElement).value);
              state.filters.maxPrice = v >= 100 ? null : sliderToPrice(v);
              state.limit = PAGE;
              render();
            },
          }),
          h('output', {}, state.filters.maxPrice == null
            ? t('anyBudget')
            : `≤ ${fmtPrice(state.filters.maxPrice)}${t('perMillion')}`),
        ),
      ),
      h('div', { class: 'field' },
        h('span', {}, t('requirements')),
        h('div', { class: 'toggles' }, ...([
          ['tools', 'reqTools'], ['vision', 'reqVision'], ['longctx', 'reqLongCtx'],
          ['reasoning', 'reqReasoning'], ['free', 'reqFree'],
        ] as [string, Key][]).map(([id, key]) => h('button', {
          type: 'button',
          class: `toggle ${state.filters.needs.has(id) ? 'on' : ''}`,
          'aria-pressed': state.filters.needs.has(id),
          onclick: () => {
            const n = state.filters.needs;
            n.has(id) ? n.delete(id) : n.add(id);
            state.limit = PAGE;
            render();
          },
        }, t(key)))),
      ),
    ),

    h('div', { class: 'picks' },
      card(t('topPick'), best, best ? `${t('index')} ${best.score?.toFixed(1)}` : ''),
      card(t('bestValue'), value, value?.pb != null ? `${fmtPrice(value.pb)}${t('perMillion')}` : ''),
      card(t('bestOpen'), open, open ? `${t('open')} · ${open.score?.toFixed(1)}` : ''),
    ),
  );
}

/** Budget slider is logarithmic — the interesting range is $0.05 to $5. */
const sliderToPrice = (v: number) => Math.round(10 ** (-1.4 + (v / 100) * 3.5) * 1000) / 1000;
const priceToSlider = (p: number | null) =>
  p == null ? 100 : Math.round(((Math.log10(p) + 1.4) / 3.5) * 100);

function renderStats(): HTMLElement {
  const c = state.meta.counts;
  const cell = (value: string, label: string) =>
    h('div', { class: 'stat' }, h('b', {}, value), h('span', {}, label));
  return h('section', { class: 'stats' },
    cell(fmt(c.models), t('statModels')),
    cell(fmt(c.datapoints), t('statDatapoints')),
    cell(fmt(c.benchmarks), t('statBenchmarks')),
    cell(fmt(c.arenas), t('statArenas')),
    cell(fmt(c.vendors), t('statVendors')),
    cell(fmtDateShort(state.meta.dataDate), t('updated')),
  );
}

function renderControls(rows: Scored[], total: number): HTMLElement {
  const vendors = vendorList(state.models);
  const countries = [...new Set(state.models.map((m) => m.c))]
    .filter((c) => state.meta.countries[c])
    .sort();

  const select = (
    value: string, onchange: (v: string) => void, placeholder: string,
    options: { value: string; label: string }[],
  ) => h('select', {
    class: 'sel', value,
    onchange: (e: Event) => { onchange((e.target as HTMLSelectElement).value); },
  },
    h('option', { value: '' }, placeholder),
    ...options.map((o) => h('option', { value: o.value, selected: o.value === value }, o.label)),
  );

  return h('section', { class: 'controls', id: 'board' },
    h('div', { class: 'ctl-row' },
      h('input', {
        class: 'search', type: 'search', value: state.filters.query,
        placeholder: t('search'), 'aria-label': t('search'),
        oninput: debounce((e: Event) => {
          state.filters.query = (e.target as HTMLInputElement).value;
          state.limit = PAGE;
          render();
        }, 160),
      }),
      select(state.filters.vendor, (v) => { state.filters.vendor = v; state.limit = PAGE; render(); },
        t('allVendors'), vendors.map((v) => ({ value: v.name, label: `${v.name} (${v.count})` }))),
      select(state.filters.country, (v) => { state.filters.country = v; state.limit = PAGE; render(); },
        t('allCountries'), countries.map((c) => ({
          value: c, label: `${state.meta.countries[c].flag} ${loc(state.meta.countries[c])}`,
        }))),
      h('div', { class: 'seg' }, ...([
        ['all', 'filters'], ['open', 'open'], ['proprietary', 'proprietary'],
      ] as [Filters['license'], Key][]).map(([id, key]) => h('button', {
        type: 'button', class: state.filters.license === id ? 'on' : '',
        onclick: () => { state.filters.license = id; state.limit = PAGE; render(); },
      }, id === 'all' ? t('license') : t(key)))),
      h('button', {
        type: 'button', class: `toggle ${state.filters.modernOnly ? 'on' : ''}`,
        title: t('onlyModernHint'),
        onclick: () => { state.filters.modernOnly = !state.filters.modernOnly; state.limit = PAGE; render(); },
      }, t('onlyModern')),
      h('button', {
        type: 'button', class: `toggle ${state.showWeights ? 'on' : ''}`,
        onclick: () => { state.showWeights = !state.showWeights; render(); },
      }, '⚙ ', t('weights')),
    ),
    h('div', { class: 'ctl-meta' },
      h('span', {}, `${t('showing')} ${fmt(Math.min(state.limit, rows.length))} ${t('of')} ${fmt(rows.length)}`),
      rows.length !== total && h('button', {
        type: 'button', class: 'link',
        onclick: () => { state.filters = defaultFilters(); state.limit = PAGE; render(); },
      }, t('resetFilters')),
    ),
  );
}

function renderWeights(): HTMLElement | null {
  if (!state.showWeights) return null;
  return h('section', { class: 'card weights' },
    h('h3', {}, t('weights')),
    h('p', { class: 'hint' }, t('weightsHint')),
    h('div', { class: 'weight-grid' }, ...state.meta.categories.map((c) => h('label', { class: 'wrow' },
      h('span', {}, loc(c)),
      h('input', {
        type: 'range', min: '0', max: '3', step: '0.1',
        value: String(state.weights[c.id] ?? 0),
        oninput: (e: Event) => {
          state.weights = { ...state.weights, [c.id]: Number((e.target as HTMLInputElement).value) };
          state.preset = 'custom';
          render();
        },
      }),
      h('output', {}, (state.weights[c.id] ?? 0).toFixed(1)),
    ))),
    h('button', {
      type: 'button', class: 'link',
      onclick: () => {
        const balanced = state.meta.presets.find((p) => p.id === 'balanced')!;
        state.preset = 'balanced';
        state.weights = { ...balanced.w };
        render();
      },
    }, t('resetWeights')),
  );
}

// ── Leaderboard ──────────────────────────────────────────────────────────────

function sortableHead(label: string, key: SortKey): HTMLElement {
  const active = state.sort === key;
  return h('th', {
    class: `sortable ${active ? 'on' : ''}`, scope: 'col',
    'aria-sort': active ? 'descending' : 'none',
  }, h('button', {
    type: 'button',
    onclick: () => { state.sort = key; state.limit = PAGE; render(); },
  }, label, active ? ' ↓' : ''));
}

function renderTable(rows: Scored[]): HTMLElement {
  if (!rows.length) {
    return h('section', { class: 'card empty' },
      h('p', {}, t('nothingFound')),
      h('button', {
        type: 'button', class: 'btn',
        onclick: () => { state.filters = defaultFilters(); render(); },
      }, t('resetFilters')),
    );
  }

  const visible = rows.slice(0, state.limit);
  const cats = state.meta.categories.filter((c) => (state.weights[c.id] ?? 0) > 0);

  return h('section', { class: 'card table-card' },
    h('div', { class: 'table-scroll' },
      h('table', { class: 'board' },
        h('thead', {},
          h('tr', {},
            h('th', { scope: 'col', class: 'c-rank' }, t('rank')),
            h('th', { scope: 'col', class: 'c-cmp' }, ''),
            h('th', { scope: 'col', class: 'c-model' }, t('model')),
            h('th', { scope: 'col', class: 'c-tier' }, t('tier')),
            sortableHead(t('index'), 'score'),
            sortableHead('ECI', 'eci'),
            h('th', { scope: 'col', class: 'c-cats' }, t('byCategory')),
            h('th', { scope: 'col', class: 'c-conf' }, t('confidence')),
            sortableHead(t('price'), 'price'),
            sortableHead(t('context'), 'context'),
            sortableHead(t('value'), 'value'),
            h('th', { scope: 'col', class: 'c-src' }, t('sources')),
          ),
        ),
        h('tbody', {}, ...visible.map((m) => {
          const checked = state.compare.includes(m.id);
          return h('tr', {
            class: `${m.p ? 'is-pareto' : ''} ${checked ? 'is-cmp' : ''}`,
            onclick: (e: Event) => {
              if ((e.target as HTMLElement).closest('input,button')) return;
              openDetail(m.id);
            },
          },
            h('td', { class: 'c-rank' }, String(m.rank)),
            h('td', { class: 'c-cmp' }, h('input', {
              type: 'checkbox', checked, 'aria-label': `${t('compare')} ${m.n}`,
              disabled: !checked && state.compare.length >= MAX_COMPARE,
              onchange: () => {
                state.compare = checked
                  ? state.compare.filter((id) => id !== m.id)
                  : [...state.compare, m.id].slice(0, MAX_COMPARE);
                render();
              },
            })),
            h('td', { class: 'c-model' },
              h('button', { type: 'button', class: 'model-btn', onclick: () => openDetail(m.id) },
                h('b', {}, m.n),
                h('span', { class: 'model-sub' },
                  `${flag(m.c)} ${m.v}`,
                  isOpen(m) && h('i', { class: 'tag tag-open' }, t('open')),
                  m.f?.includes('free') && h('i', { class: 'tag tag-free' }, t('free')),
                  m.p && h('i', { class: 'tag tag-pareto' }, '★'),
                ),
              ),
            ),
            h('td', { class: 'c-tier' }, tierBadge(m.tier)),
            h('td', { class: 'c-score' },
              h('b', {}, m.score == null ? '—' : m.score.toFixed(1)),
              meter(m.score),
            ),
            // Epoch's own composite, shown unchanged as an independent second
            // opinion — it is deliberately not folded into the index, which
            // draws on the same underlying runs.
            h('td', { class: 'c-eci' }, m.eci == null ? '—' : String(m.eci)),
            h('td', { class: 'c-cats' }, h('span', { class: 'catbars' }, ...cats.map((c) => {
              const v = m.cat[c.id];
              return h('i', {
                class: v == null ? 'cb none' : 'cb',
                style: v == null ? {} : { height: `${Math.max(8, v)}%` },
                title: `${loc(c)}: ${v == null ? t('noData') : v.toFixed(1)}`,
              });
            }))),
            h('td', { class: 'c-conf' }, confPips(m.cf ?? 0)),
            h('td', { class: 'c-price' }, m.pb == null ? '—' : h('span', {},
              h('b', {}, fmtPrice(m.pb)),
              h('small', {}, `${fmtPrice(m.pi)} / ${fmtPrice(m.po)}`),
            )),
            h('td', { class: 'c-ctx' }, fmtTokens(m.ctx)),
            h('td', { class: 'c-value' }, m.valueNow == null ? '—' : fmt(m.valueNow, 0)),
            h('td', { class: 'c-src' }, sourceDots(m.src)),
          );
        })),
      ),
    ),
    rows.length > state.limit && h('button', {
      type: 'button', class: 'btn wide',
      onclick: () => { state.limit += PAGE * 2; render(); },
    }, `${t('showMore')} (${fmt(rows.length - state.limit)})`),
  );
}

// ── Compare drawer ───────────────────────────────────────────────────────────

function renderCompare(rows: Scored[]): HTMLElement | null {
  if (!state.compare.length) return null;
  const chosen = state.compare
    .map((id) => rows.find((m) => m.id === id) ?? state.models.find((m) => m.id === id))
    .filter(Boolean) as Model[];
  if (!chosen.length) return null;

  return h('section', { class: 'card cmp' },
    h('div', { class: 'cmp-head' },
      h('h3', {}, t('compareTitle')),
      h('button', {
        type: 'button', class: 'link',
        onclick: () => { state.compare = []; render(); },
      }, t('clearCompare')),
    ),
    groupedBars(
      state.meta.categories.map((c) => ({ id: c.id, label: loc(c) })),
      chosen.map((m) => ({ id: m.id, name: m.n, values: m.cat })),
    ),
    h('table', { class: 'cmp-table' },
      h('tbody', {}, ...([
        [t('index'), (m: Model) => (m.w == null ? '—' : m.w.toFixed(1))],
        [t('confidence'), (m: Model) => `${Math.round((m.cf ?? 0) * 100)}%`],
        [t('price'), (m: Model) => (m.pb == null ? '—' : `${fmtPrice(m.pb)}${t('perMillion')}`)],
        [t('context'), (m: Model) => fmtTokens(m.ctx)],
        [t('released'), (m: Model) => fmtDate(m.r)],
        ['ECI', (m: Model) => (m.eci == null ? '—' : String(m.eci))],
        [t('license'), (m: Model) => (isOpen(m) ? t('open') : t('proprietary'))],
      ] as [string, (m: Model) => string][]).map(([label, get]) => h('tr', {},
        h('th', { scope: 'row' }, label),
        ...chosen.map((m) => h('td', {}, get(m))),
      ))),
    ),
  );
}

// ── Analytics ────────────────────────────────────────────────────────────────

function renderAnalytics(rows: Scored[]): HTMLElement {
  const tabs: [string, Key][] = [
    ['pareto', 'tabPareto'], ['timeline', 'tabTimeline'],
    ['landscape', 'tabLandscape'], ['divergence', 'tabDivergence'],
    ['benchmarks', 'tabBenchmarks'],
  ];
  return h('section', { class: 'card analytics' },
    h('h2', {}, t('analytics')),
    h('div', { class: 'tabs', role: 'tablist' }, ...tabs.map(([id, key]) => h('button', {
      type: 'button', role: 'tab', class: `tab ${state.tab === id ? 'on' : ''}`,
      'aria-selected': state.tab === id,
      onclick: () => { state.tab = id; render(); },
    }, t(key)))),
    h('div', { class: 'tab-body', role: 'tabpanel' }, analyticsBody(rows)),
  );
}

function analyticsBody(rows: Scored[]): HTMLElement {
  switch (state.tab) {
    case 'timeline': return timelinePanel();
    case 'landscape': return landscapePanel(rows);
    case 'divergence': return divergencePanel();
    case 'benchmarks': return benchmarkPanel();
    default: return paretoPanel(rows);
  }
}

function paretoPanel(rows: Scored[]): HTMLElement {
  const points = rows
    .filter((m) => m.pb != null && m.pb > 0 && m.score != null && (m.cf ?? 0) > 0.25)
    .map((m) => ({
      id: m.id, name: m.n, vendor: m.v,
      price: m.pb!, score: m.score!, frontier: Boolean(m.p),
    }));
  return h('div', {},
    h('h3', {}, t('paretoTitle')),
    h('p', { class: 'hint' }, t('paretoDesc')),
    paretoChart(points, {
      frontier: t('frontierLabel'), other: t('otherModels'),
      x: `${t('price')}${t('perMillion')}`, y: t('index'),
    }, openDetail),
  );
}

function timelinePanel(): HTMLElement {
  return h('div', {},
    h('h3', {}, t('timelineTitle')),
    h('p', { class: 'hint' }, t('timelineDesc')),
    // Small multiples rather than eight lines in one frame: a categorical
    // palette tops out well below eight distinguishable series.
    h('div', { class: 'multiples' }, ...state.meta.categories
      .filter((c) => state.timeline[c.id]?.length > 1)
      .map((c) => h('figure', { class: 'multiple' },
        h('figcaption', {}, loc(c)),
        timelineChart(state.timeline[c.id], loc(c), openDetail),
        h('small', {}, state.timeline[c.id].at(-1)?.[3] ?? ''),
      ))),
  );
}

function landscapePanel(rows: Scored[]): HTMLElement {
  const scored = rows.filter((m) => m.score != null && (m.cf ?? 0) > 0.3);
  const median = (values: number[]) => {
    const s = [...values].sort((a, b) => a - b);
    return s.length ? s[Math.floor(s.length / 2)] : 0;
  };

  const group = (keyOf: (m: Scored) => string, label: (k: string) => string, top: number) => {
    const map = new Map<string, number[]>();
    for (const m of scored) {
      const k = keyOf(m);
      map.set(k, [...(map.get(k) ?? []), m.score!]);
    }
    return [...map.entries()]
      .filter(([, v]) => v.length >= 2)
      .map(([k, v]) => ({ label: label(k), value: median(v), sub: `${v.length}` }))
      .sort((a, b) => b.value - a.value)
      .slice(0, top);
  };

  return h('div', {},
    h('h3', {}, t('landscapeTitle')),
    h('p', { class: 'hint' }, t('landscapeDesc')),
    h('div', { class: 'two-col' },
      h('div', {},
        h('h4', {}, t('byCountry')),
        barChart(group(
          (m) => m.c,
          (c) => `${state.meta.countries[c]?.flag ?? ''} ${loc(state.meta.countries[c] ?? { en: c, ru: c })}`,
          8,
        ), (v) => v.toFixed(1)),
        h('small', { class: 'hint' }, t('medianIndex')),
      ),
      h('div', {},
        h('h4', {}, t('byVendor')),
        barChart(group((m) => m.v, (v) => v, 12), (v) => v.toFixed(1)),
        h('small', { class: 'hint' }, t('medianIndex')),
      ),
    ),
  );
}

function divergencePanel(): HTMLElement {
  // Restricted to well-measured, current models: for a 2023 model the gap is
  // mostly an artefact of arena Elo compressing while benchmarks do not.
  const eligible = state.models
    .filter((m) => m.g != null && (m.cf ?? 0) > 0.5 && (!m.r || m.r >= '2025-06-01'))
    .sort((a, b) => (b.g ?? 0) - (a.g ?? 0));

  // Centre on the median. Arena Elo is normalised against every model that has
  // ever been voted on, while benchmarks are normalised against current models
  // only, so the raw gap sits well above zero for almost everything — which
  // filled a panel headed "stronger than they feel" with positive numbers.
  // What is interesting is the deviation from typical, not the offset itself.
  const gaps = eligible.map((m) => m.g!).sort((a, b) => a - b);
  const centre = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 0;

  const rowOf = (m: Model) => ({
    label: m.n, value: m.g! - centre,
    note: `${m.cat.preference?.toFixed(0) ?? '—'} / ${m.b?.toFixed(0) ?? '—'}`,
  });
  const top = eligible.slice(0, 8).map(rowOf);
  const bottom = eligible.slice(-8).reverse().map(rowOf);
  const byName = new Map(state.models.map((m) => [m.n, m.id]));

  return h('div', {},
    h('h3', {}, t('divergenceTitle')),
    h('p', { class: 'hint' }, t('divergenceDesc')),
    h('div', { class: 'two-col' },
      h('div', {}, h('h4', {}, t('humansLike')),
        divergingChart(top, (name) => openDetail(byName.get(name) ?? ''))),
      h('div', {}, h('h4', {}, t('benchStronger')),
        divergingChart(bottom, (name) => openDetail(byName.get(name) ?? ''))),
    ),
  );
}

function benchmarkPanel(): HTMLElement {
  if (!hasDetails()) {
    ensureDetails().then(render);
    return h('div', {}, h('p', { class: 'boot' }, t('loading')));
  }
  const bench = state.meta.benchmarks.find((b) => b.id === state.benchmark)
    ?? state.meta.benchmarks[0];
  const scored = state.models
    .filter((m) => m.bs?.[bench.id])
    .sort((a, b) => b.bs![bench.id][0] - a.bs![bench.id][0])
    .slice(0, 20);

  return h('div', {},
    h('h3', {}, t('benchmarksTitle')),
    h('p', { class: 'hint' }, t('benchmarksDesc')),
    h('select', {
      class: 'sel wide',
      onchange: (e: Event) => { state.benchmark = (e.target as HTMLSelectElement).value; render(); },
    }, ...state.meta.benchmarks.map((b) => h('option', {
      value: b.id, selected: b.id === bench.id,
    }, `${loc(b)} — ${loc(state.meta.categories.find((c) => c.id === b.cat) ?? { en: '', ru: '' })}`))),
    h('p', { class: 'bench-about' }, loc(bench, 'about_')),
    barChart(
      scored.map((m) => ({
        label: m.n,
        value: m.bs![bench.id][0],
        sub: m.v,
      })),
      (v) => (bench.elo ? v.toFixed(0) : bench.pct ? `${v.toFixed(1)}%` : `${(v * 100).toFixed(1)}%`),
    ),
  );
}

// ── Model detail ─────────────────────────────────────────────────────────────

let dialog: HTMLDialogElement | null = null;
let openId: string | null = null;

/**
 * Show a model sheet straight away, then fill in the breakdown when it lands.
 *
 * Blocking the sheet on a network round-trip would make every click feel slow
 * for the sake of two tables at the bottom of it.
 */
function openDetail(id: string) {
  const m = state.models.find((x) => x.id === id);
  if (!m) return;
  hideTooltip();
  openId = id;
  showSheet(m);
  if (!hasDetails()) {
    ensureDetails().then(() => {
      const fresh = state.models.find((x) => x.id === id);
      if (fresh && openId === id && dialog?.open) showSheet(fresh);
    });
  }
}

function showSheet(m: Model) {
  const catRows = state.meta.categories
    .filter((c) => m.cat[c.id] != null)
    .map((c) => ({ label: loc(c), value: m.cat[c.id], sub: `${m.cn[c.id]}×` }));

  const benchRows = state.meta.benchmarks
    .filter((b) => m.bs?.[b.id])
    .sort((a, b) => (m.bs![b.id][1] ?? 0) - (m.bs![a.id][1] ?? 0))
    .map((b) => {
      const [rawScore, norm, rank, of] = m.bs![b.id];
      return h('tr', {},
        h('th', { scope: 'row' }, loc(b), h('small', {}, loc(b, 'about_'))),
        h('td', {}, b.elo
          ? rawScore.toFixed(0)
          : b.pct ? `${rawScore.toFixed(1)}%` : `${(rawScore * 100).toFixed(1)}%`),
        h('td', {}, meter(norm), rank && h('small', {}, `#${rank} ${t('of')} ${of}`)),
      );
    });

  const arenaRows = state.meta.arenas
    .filter((a) => m.ar?.[a.id])
    .map((a) => h('tr', {},
      h('th', { scope: 'row' }, loc(a)),
      // The agent board reports a win rate, not an Elo — labelling it "Elo"
      // would put a 0.13 next to a 1507 and imply they are the same quantity.
      h('td', {}, a.elo === false ? `${(m.ar![a.id][0] * 100).toFixed(1)}%` : `${m.ar![a.id][0]} Elo`),
      h('td', {}, `#${m.ar![a.id][2]}`, h('small', {}, `${fmt(m.ar![a.id][1])} ${t('votes')}`)),
    ));

  const body = h('div', { class: 'detail' },
    h('header', {},
      h('div', {},
        h('h3', {}, m.n),
        h('p', { class: 'detail-sub' },
          `${flag(m.c)} ${m.v}`,
          m.r && ` · ${fmtDate(m.r)}`,
          isOpen(m) && h('i', { class: 'tag tag-open' }, t('open')),
        ),
      ),
      h('button', { type: 'button', class: 'icon-btn', onclick: () => dialog?.close(), 'aria-label': t('close') }, '✕'),
    ),

    h('div', { class: 'detail-kpi' },
      h('div', {}, h('b', {}, m.w?.toFixed(1) ?? '—'), h('span', {}, t('index'))),
      h('div', {}, h('b', {}, `${Math.round((m.cf ?? 0) * 100)}%`), h('span', {}, t('confidence'))),
      h('div', {}, h('b', {}, m.pb == null ? '—' : fmtPrice(m.pb)), h('span', {}, `${t('price')}${t('perMillion')}`)),
      h('div', {}, h('b', {}, fmtTokens(m.ctx)), h('span', {}, t('context'))),
      m.eci != null && h('div', {}, h('b', {}, String(m.eci)), h('span', {}, 'Epoch ECI')),
    ),

    h('p', { class: 'detail-cov' },
      `${t('measuredOn')} ${m.cov} ${t('testsIn')} ${Object.keys(m.cn).length} ${t('categoriesWord')}`),

    catRows.length > 0 && h('section', {},
      h('h4', {}, t('byCategory')),
      barChart(catRows as never, (v) => v.toFixed(1)),
    ),

    (m.im?.length || m.f?.length) && h('section', {},
      h('h4', {}, t('capabilities')),
      h('p', { class: 'tags' },
        ...(m.im ?? []).map((x) => h('i', { class: 'tag' }, x)),
        ...(m.f ?? []).map((x) => h('i', { class: 'tag tag-cap' }, x)),
        m.mo && h('i', { class: 'tag' }, `max out ${fmtTokens(m.mo)}`),
      ),
    ),

    arenaRows.length > 0 && h('section', {},
      h('h4', {}, t('arenaScores')),
      h('table', { class: 'mini' }, h('tbody', {}, ...arenaRows)),
    ),

    benchRows.length > 0 && h('section', {},
      h('h4', {}, t('benchScores')),
      h('table', { class: 'mini' }, h('tbody', {}, ...benchRows)),
    ),

    m.or && h('p', {}, h('a', {
      class: 'btn', href: `https://openrouter.ai/${m.or}`, target: '_blank', rel: 'noopener noreferrer',
    }, t('openInRouter'), ' ↗')),
  );

  if (!dialog) {
    const el = h('dialog', { class: 'sheet' }) as HTMLDialogElement;
    // Clicking the backdrop lands on the dialog element itself, never a child.
    el.addEventListener('click', (e) => { if (e.target === el) el.close(); });
    el.addEventListener('close', () => { openId = null; });
    document.body.append(el);
    dialog = el;
  }
  mount(dialog, body);
  if (!dialog.open) dialog.showModal();
}

// ── Methodology & footer ─────────────────────────────────────────────────────

function renderMethod(): HTMLElement {
  const step = (n: number, title: Key, text: Key) => h('li', {},
    h('b', {}, `${n}. ${t(title)}`), h('p', {}, t(text)));

  return h('section', { class: 'card method' },
    h('h2', {}, t('methodology')),
    h('p', {}, t('methodIntro')),
    h('ol', { class: 'steps' },
      step(1, 'step1', 'step1d'), step(2, 'step2', 'step2d'),
      step(3, 'step3', 'step3d'), step(4, 'step4', 'step4d'),
    ),
    h('h3', {}, t('caveats')),
    h('p', { class: 'hint' }, t('caveatsText')),
    h('h3', {}, t('dataSources')),
    h('ul', { class: 'sources' }, ...state.meta.sources.map((s) => {
      const health = state.meta.health.find((x) => x.id === s.id);
      return h('li', {},
        h('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer' }, s.name, ' ↗'),
        h('i', { class: `dot-health ${health?.ok ? 'ok' : 'off'}`, title: health?.ok ? 'ok' : 'unavailable' }),
        h('p', {}, loc(s)),
        h('small', {}, h('a', {
          href: s.licenseUrl, target: '_blank', rel: 'noopener noreferrer',
        }, s.license)),
      );
    })),
  );
}

function renderFooter(): HTMLElement {
  return h('footer', { class: 'site-foot' },
    h('p', {}, t('builtWith')),
    h('p', {},
      `${t('updated')} ${fmtDate(state.meta.dataDate)} · `,
      h('a', {
        href: 'https://github.com/BOSSincrypto/what-ai-need',
        target: '_blank', rel: 'noopener noreferrer',
      }, t('openSource'), ' ↗'),
    ),
  );
}

// ── Render ───────────────────────────────────────────────────────────────────

function render() {
  const rows = pipeline();
  const total = scoredCache?.models.length ?? state.models.length;
  mount($('#app'),
    renderRecommender(rows),
    renderStats(),
    renderControls(rows, total),
    renderWeights(),
    renderCompare(rows),
    renderTable(rows),
    renderAnalytics(rows),
    renderMethod(),
    renderFooter(),
  );
  syncUrl();
  paintChrome();
}

/** Header bits live outside `#app` and only need their labels refreshed. */
function paintChrome() {
  const tagline = $('[data-i18n="tagline"]');
  if (tagline) tagline.textContent = t('tagline');
  document.documentElement.lang = getLang();
  for (const btn of document.querySelectorAll<HTMLButtonElement>('#lang-switch button')) {
    btn.classList.toggle('on', btn.dataset.lang === getLang());
  }
}

// ── Boot ─────────────────────────────────────────────────────────────────────

function applyTheme(theme: string) {
  document.documentElement.dataset.theme = theme;
  store.set('theme', theme);
  const btn = $('#theme-btn span');
  if (btn) btn.textContent = theme === 'dark' ? '☾' : '☀';
}

async function boot() {
  applyTheme(store.get('theme') ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  setLang((store.get('lang') as Lang) ?? (navigator.language.startsWith('ru') ? 'ru' : 'en'));

  const base = import.meta.env.BASE_URL;
  let meta: Meta;
  let models: Model[];
  let timeline: Timeline;
  try {
    [meta, models, timeline] = await Promise.all([
      fetch(`${base}data/meta.json`).then((r) => r.json()),
      fetch(`${base}data/models.json`).then((r) => r.json()),
      fetch(`${base}data/timeline.json`).then((r) => r.json()),
    ]);
  } catch {
    mount($('#app'), h('p', { class: 'boot error' }, t('loadError')));
    return;
  }

  const fromUrl = readUrl(meta);
  state = {
    meta, models, timeline,
    filters: fromUrl.filters!,
    weights: fromUrl.weights!,
    preset: fromUrl.preset!,
    sort: fromUrl.sort!,
    tab: fromUrl.tab!,
    compare: fromUrl.compare!,
    limit: PAGE,
    benchmark: meta.benchmarks[0]?.id ?? '',
    showWeights: false,
  };

  $('#theme-btn')?.addEventListener('click', () => {
    applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  });
  for (const btn of document.querySelectorAll<HTMLButtonElement>('#lang-switch button')) {
    btn.addEventListener('click', () => {
      setLang(btn.dataset.lang as Lang);
      store.set('lang', btn.dataset.lang!);
      render();
    });
  }
  addEventListener('scroll', hideTooltip, { passive: true });

  render();

  // Warm the detail payload once the page is interactive, so opening a model
  // costs nothing. `requestIdleCallback` is still missing on Safari.
  const idle = window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 1200));
  idle(() => { void ensureDetails(); });
}

boot();
