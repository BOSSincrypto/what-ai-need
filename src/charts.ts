/**
 * Charts, drawn as SVG by hand.
 *
 * A charting library would be the single heaviest thing on the page, and the
 * four forms here — scatter, step line, bar, diverging bar — are a few dozen
 * lines each. Colour roles come from CSS custom properties so light and dark
 * are one stylesheet, not two code paths.
 *
 * Form choices follow the data's job rather than habit: the price/quality plot
 * is an *emphasis* chart (frontier in the accent hue, everything else recessive
 * grey) because the story is "these are the ones worth considering", not "here
 * are nine categories"; comparison uses grouped bars rather than a radar
 * because overlapping polygons make four series unreadable.
 */

import { svg, h } from './dom';

const PAD = { top: 16, right: 16, bottom: 34, left: 44 };

type Scale = (v: number) => number;

const linear = (d0: number, d1: number, r0: number, r1: number): Scale =>
  (v) => (d1 === d0 ? (r0 + r1) / 2 : r0 + ((v - d0) / (d1 - d0)) * (r1 - r0));

const log = (d0: number, d1: number, r0: number, r1: number): Scale => {
  const l0 = Math.log10(Math.max(d0, 1e-6));
  const l1 = Math.log10(Math.max(d1, 1e-6));
  return (v) => r0 + ((Math.log10(Math.max(v, 1e-6)) - l0) / (l1 - l0)) * (r1 - r0);
};

/** "Nice" tick values inside a range, at most `count` of them. */
function ticks(min: number, max: number, count = 5): number[] {
  const span = max - min;
  if (span <= 0) return [min];
  const step = 10 ** Math.floor(Math.log10(span / count));
  const err = (span / count) / step;
  const mult = err >= 7.5 ? 10 : err >= 3 ? 5 : err >= 1.5 ? 2 : 1;
  const nice = step * mult;
  const out: number[] = [];
  for (let v = Math.ceil(min / nice) * nice; v <= max + 1e-9; v += nice) out.push(Number(v.toFixed(10)));
  return out;
}

// ── Tooltip ──────────────────────────────────────────────────────────────────

let tip: HTMLElement | null = null;

function tooltip(): HTMLElement {
  if (!tip) {
    tip = h('div', { class: 'tip', role: 'status', 'aria-live': 'polite' });
    document.body.append(tip);
  }
  return tip;
}

/**
 * Attach a hover tooltip to a mark.
 *
 * Positioned against the viewport and flipped near the right edge, so a point
 * on the far side of a wide scatter does not push the page sideways.
 */
function hoverable(node: SVGElement, html: string) {
  const show = (event: Event) => {
    const el = tooltip();
    el.innerHTML = html;
    el.classList.add('on');
    const rect = (event.currentTarget as SVGGraphicsElement).getBoundingClientRect();
    const width = el.offsetWidth;
    const left = Math.min(
      Math.max(8, rect.left + rect.width / 2 - width / 2),
      window.innerWidth - width - 8,
    );
    const above = rect.top > el.offsetHeight + 16;
    el.style.left = `${left}px`;
    el.style.top = `${above ? rect.top - el.offsetHeight - 10 : rect.bottom + 10}px`;
  };
  const hide = () => tooltip().classList.remove('on');
  node.addEventListener('pointerenter', show);
  node.addEventListener('pointerleave', hide);
  node.addEventListener('focus', show);
  node.addEventListener('blur', hide);
  return node;
}

export const hideTooltip = () => tip?.classList.remove('on');

// ── Shared chrome ────────────────────────────────────────────────────────────

interface Frame { root: SVGElement; plot: SVGElement; w: number; h: number; iw: number; ih: number }

function frame(w: number, h: number, label: string): Frame {
  const root = svg('svg', {
    viewBox: `0 0 ${w} ${h}`, class: 'chart', role: 'img', 'aria-label': label,
    preserveAspectRatio: 'xMidYMid meet',
  });
  const plot = svg('g', { transform: `translate(${PAD.left},${PAD.top})` });
  root.append(plot);
  return { root, plot, w, h, iw: w - PAD.left - PAD.right, ih: h - PAD.top - PAD.bottom };
}

function yAxis(f: Frame, scale: Scale, values: number[], format: (v: number) => string) {
  for (const v of values) {
    const y = scale(v);
    f.plot.append(
      svg('line', { x1: 0, x2: f.iw, y1: y, y2: y, class: 'grid' }),
      svg('text', { x: -8, y: y + 4, class: 'tick tick-y' }, format(v)),
    );
  }
}

function xAxis(f: Frame, scale: Scale, values: number[], format: (v: number) => string) {
  for (const v of values) {
    const x = scale(v);
    f.plot.append(
      svg('text', { x, y: f.ih + 20, class: 'tick tick-x' }, format(v)),
    );
  }
  f.plot.append(svg('line', { x1: 0, x2: f.iw, y1: f.ih, y2: f.ih, class: 'axis' }));
}

// ── Price vs quality (emphasis scatter) ──────────────────────────────────────

export interface ParetoPoint {
  id: string; name: string; vendor: string;
  price: number; score: number; frontier: boolean;
}

export function paretoChart(
  points: ParetoPoint[],
  labels: { frontier: string; other: string; x: string; y: string },
  onPick: (id: string) => void,
): HTMLElement {
  const w = 760;
  const hgt = 420;
  const f = frame(w, hgt, `${labels.y} / ${labels.x}`);
  if (!points.length) return h('div', { class: 'chart-wrap' }, f.root);

  const prices = points.map((p) => p.price);
  const scores = points.map((p) => p.score);
  const x = log(Math.min(...prices) * 0.7, Math.max(...prices) * 1.3, 0, f.iw);
  const yMin = Math.max(0, Math.min(...scores) - 3);
  const yMax = Math.max(...scores) + 3;
  const y = linear(yMin, yMax, f.ih, 0);

  yAxis(f, y, ticks(yMin, yMax, 5), (v) => String(Math.round(v)));

  // Decade ticks: prices span four orders of magnitude, so powers of ten are
  // the only labels that stay evenly spaced and readable.
  const decades: number[] = [];
  for (let e = -3; e <= 3; e++) {
    const v = 10 ** e;
    if (v >= Math.min(...prices) * 0.7 && v <= Math.max(...prices) * 1.3) decades.push(v);
  }
  xAxis(f, x, decades, (v) => (v < 1 ? `$${v}` : `$${v}`));

  const frontier = points.filter((p) => p.frontier).sort((a, b) => a.price - b.price);
  if (frontier.length > 1) {
    f.plot.append(svg('path', {
      d: frontier.map((p, i) => `${i ? 'L' : 'M'}${x(p.price).toFixed(1)},${y(p.score).toFixed(1)}`).join(' '),
      class: 'frontier-line',
    }));
  }

  // Recessive marks first so the frontier always draws on top of the crowd.
  for (const p of [...points].sort((a, b) => Number(a.frontier) - Number(b.frontier))) {
    const dot = svg('circle', {
      cx: x(p.price).toFixed(1), cy: y(p.score).toFixed(1), r: p.frontier ? 6 : 4,
      class: p.frontier ? 'dot dot-frontier' : 'dot dot-other',
      tabindex: 0, role: 'button', 'aria-label': `${p.name}, ${p.score.toFixed(0)}, $${p.price}`,
      onclick: () => onPick(p.id),
      onkeydown: (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(p.id); } },
    });
    f.plot.append(hoverable(dot, `<b>${p.name}</b><span>${p.vendor}</span>
      <span>${labels.y}: <b>${p.score.toFixed(1)}</b></span>
      <span>${labels.x}: <b>$${p.price < 1 ? p.price.toFixed(3) : p.price.toFixed(2)}</b></span>`));
  }

  // Direct-label the frontier's standouts. Labelling every point would be
  // unreadable; the cheapest, the best, and the best-value elbow tell the story.
  const best = frontier[frontier.length - 1];
  const cheapest = frontier[0];
  const elbow = frontier.reduce((a, b) => (b.score / Math.log10(b.price + 1.1) > a.score / Math.log10(a.price + 1.1) ? b : a), frontier[0]);
  for (const p of new Set([cheapest, elbow, best].filter(Boolean))) {
    f.plot.append(svg('text', {
      x: x(p.price), y: y(p.score) - 12, class: 'dot-label',
    }, p.name));
  }

  return h('div', { class: 'chart-wrap' },
    h('div', { class: 'legend' },
      h('span', { class: 'lg' }, h('i', { class: 'sw sw-frontier' }), labels.frontier),
      h('span', { class: 'lg' }, h('i', { class: 'sw sw-other' }), labels.other),
    ),
    f.root,
    h('div', { class: 'axis-title' }, `↑ ${labels.y}   →  ${labels.x}`),
  );
}

// ── Frontier over time (small multiples) ─────────────────────────────────────

export function timelineChart(
  series: [string, number, string, string][],
  title: string,
  onPick: (id: string) => void,
): SVGElement {
  const w = 340;
  const hgt = 170;
  const f = frame(w, hgt, title);
  if (series.length < 2) return f.root;

  const times = series.map((p) => Date.parse(p[0]));
  const x = linear(Math.min(...times), Date.now(), 0, f.iw);
  const scores = series.map((p) => p[1]);
  const y = linear(Math.max(0, Math.min(...scores) - 4), Math.max(...scores) + 4, f.ih, 0);

  yAxis(f, y, ticks(Math.min(...scores), Math.max(...scores), 3), (v) => String(Math.round(v)));
  const years = [...new Set(series.map((p) => p[0].slice(0, 4)))].map((yr) => Date.parse(`${yr}-01-01`));
  xAxis(f, x, years.filter((v) => v >= Math.min(...times)), (v) => String(new Date(v).getUTCFullYear()));

  // A step line, not a smooth one: the record does not creep upward between
  // releases, it jumps the day a model ships.
  let d = '';
  series.forEach((p, i) => {
    const px = x(Date.parse(p[0]));
    const py = y(p[1]);
    d += i === 0 ? `M${px.toFixed(1)},${py.toFixed(1)}` : ` H${px.toFixed(1)} V${py.toFixed(1)}`;
  });
  d += ` H${f.iw.toFixed(1)}`;
  f.plot.append(svg('path', { d, class: 'step-line' }));

  for (const p of series) {
    f.plot.append(hoverable(
      svg('circle', {
        cx: x(Date.parse(p[0])).toFixed(1), cy: y(p[1]).toFixed(1), r: 4,
        class: 'dot dot-frontier', tabindex: 0, role: 'button', 'aria-label': `${p[3]}, ${p[1]}`,
        onclick: () => onPick(p[2]),
      }),
      `<b>${p[3]}</b><span>${p[0]}</span><span>${p[1].toFixed(1)}</span>`,
    ));
  }
  return f.root;
}

// ── Horizontal bars (sequential, single hue) ─────────────────────────────────

export interface BarRow { label: string; value: number; note?: string; sub?: string }

export function barChart(rows: BarRow[], format: (v: number) => string): HTMLElement {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return h('div', { class: 'bars' },
    ...rows.map((r) => h('div', { class: 'bar-row' },
      h('span', { class: 'bar-label' }, r.label),
      h('span', { class: 'bar-track' },
        h('span', {
          class: 'bar-fill',
          style: { width: `${Math.max(1.5, (r.value / max) * 100)}%` },
        }),
      ),
      h('span', { class: 'bar-value' }, format(r.value), r.sub && h('small', {}, r.sub)),
    )),
  );
}

// ── Diverging bars (two poles, neutral middle) ───────────────────────────────

export function divergingChart(
  rows: { label: string; value: number; note: string }[],
  onPick?: (label: string) => void,
): HTMLElement {
  const max = Math.max(...rows.map((r) => Math.abs(r.value)), 1);
  return h('div', { class: 'diverge' },
    // The row itself is `display: contents` so every bar shares one baseline,
    // which means it generates no box and cannot be the click target. The
    // label carries the interaction instead — and as a real button it gets
    // keyboard focus and a focus ring for free.
    ...rows.map((r) => h('div', { class: 'dv-row' },
      onPick
        ? h('button', { class: 'dv-label', type: 'button', onclick: () => onPick(r.label) }, r.label)
        : h('span', { class: 'dv-label' }, r.label),
      h('span', { class: 'dv-track' },
        h('span', { class: 'dv-axis' }),
        h('span', {
          class: `dv-fill ${r.value >= 0 ? 'pos' : 'neg'}`,
          style: {
            width: `${(Math.abs(r.value) / max) * 50}%`,
            left: r.value >= 0 ? '50%' : `${50 - (Math.abs(r.value) / max) * 50}%`,
          },
        }),
      ),
      h('span', { class: 'dv-value' }, `${r.value >= 0 ? '+' : ''}${r.value.toFixed(1)}`,
        h('small', {}, r.note)),
    )),
  );
}

// ── Grouped bars for model comparison ────────────────────────────────────────

/**
 * Up to four models across the category axis.
 *
 * Grouped bars rather than a radar: overlapping polygons hide whichever series
 * is drawn underneath, and area on a radar exaggerates differences that a
 * shared baseline shows honestly. Four is the cap because the fourth colour
 * slot is where the palette's guarantees stop.
 */
export function groupedBars(
  categories: { id: string; label: string }[],
  models: { id: string; name: string; values: Record<string, number> }[],
): HTMLElement {
  return h('div', { class: 'cmp-chart' },
    h('div', { class: 'legend' },
      ...models.map((m, i) => h('span', { class: 'lg' },
        h('i', { class: `sw sw-s${i + 1}` }), m.name)),
    ),
    ...categories.map((c) => {
      const values = models.map((m) => m.values[c.id]);
      if (values.every((v) => v == null)) return null;
      const best = Math.max(...values.filter((v) => v != null));
      return h('div', { class: 'cmp-cat' },
        h('div', { class: 'cmp-cat-name' }, c.label),
        h('div', { class: 'cmp-group' },
          ...models.map((m, i) => {
            const v = m.values[c.id];
            return h('div', { class: 'cmp-bar-row' },
              h('span', { class: 'cmp-track' },
                v == null ? h('span', { class: 'cmp-none' }, '—') : h('span', {
                  class: `cmp-fill s${i + 1}`, style: { width: `${v}%` },
                }),
              ),
              // Direct label on every bar: three of the four palette slots sit
              // below 3:1 on the light surface, and the relief rule requires
              // that identity never rest on colour alone.
              h('span', { class: `cmp-val ${v === best ? 'best' : ''}` }, v == null ? '—' : v.toFixed(1)),
            );
          }),
        ),
      );
    }),
  );
}

/** Inline score meter used inside table cells. */
export function meter(value: number | null, max = 100): HTMLElement {
  return h('span', { class: 'meter', title: value == null ? '' : value.toFixed(1) },
    h('span', {
      class: 'meter-fill',
      style: { width: value == null ? '0%' : `${Math.max(1, (value / max) * 100)}%` },
    }),
  );
}
