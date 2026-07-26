# what AI need

Aggregated LLM leaderboards — benchmarks, human-preference arenas and live
pricing from independent sources, folded into one comparable index.

**<https://what-ai-need.bossincrypto.dev>**

Static site, no backend, no tracking. The whole interface is ~21 KB gzipped.

## What it does

Every leaderboard measures something different on a different scale, so
comparing them by eye is guesswork. This project normalises them, weights them
by what you actually need a model for, and says how much to trust the result.

- **One index across four sources** — 53 benchmarks, 6 arenas, live prices.
- **Task presets** — coding, agents, research, maths, chat, vision, cheap-at-scale.
  Each re-weights the categories and re-ranks everything in the browser.
- **Custom weights** — set your own per-category weights and the ranking follows.
- **Confidence** — a model measured once does not outrank one measured thirty times.
- **Price/quality frontier** — which models nothing cheaper can match.
- **Frontier over time** — when each capability ceiling actually moved.
- **Humans vs benchmarks** — where blind human votes disagree with test scores.
- **Filters** — vendor, country, open weights, price cap, context, tool calling,
  vision, reasoning mode, free tier. All shareable through the URL.
- Russian and English, light and dark.

## Data sources

| Source | What it provides | Licence |
|---|---|---|
| [Epoch AI Benchmarking Hub](https://epoch.ai/benchmarks) | 53 benchmarks + the Epoch Capabilities Index | CC BY 4.0 |
| [LMArena](https://arena.ai/leaderboard/text) via the [official HF dataset](https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset) | Blind pairwise human votes as Elo, 6 arenas | CC BY 4.0 |
| [OpenRouter](https://openrouter.ai/models) | Pricing, context windows, modalities, capabilities | Public API |
| [Artificial Analysis](https://artificialanalysis.ai/) | Intelligence Index, throughput, latency | Data API (optional key) |

## How the index works

1. **Normalise.** Each benchmark is stretched to 0–100 against its own cohort of
   current models, clamped at the 2nd and 98th percentile. Necessary because the
   raw scales range from 0–1 fractions to Elo near 1500 to Vending-Bench's
   unbounded dollars (−31 to +10,940).
2. **Roll up.** Normalised results are weighted into eight capability categories.
3. **Adjust for evidence.** Confidence is the geometric mean of *breadth* (how
   much of the weighted category space is covered) and *depth* (total
   measurements). The index is pulled toward the median in proportion to how
   little confidence backs it — so a brand-new model starts out looking modest,
   because there genuinely is less evidence about it.
4. **Re-weight.** Presets and sliders recompute steps 2–4 client-side using the
   identical formula.

Epoch's own composite (ECI) is shown as a separate column rather than folded in —
it draws on the same underlying runs, so including it would double-count.

### What it cannot tell you

Benchmarks do not measure tone, production reliability, API quality, rate limits
or speed. Different tests run with different scaffolds and reasoning settings, so
any cross-test comparison is approximate. Prices are OpenRouter's and may differ
from a direct vendor contract. Open weights does not mean free — count the hardware.

## Local development

```bash
npm install
npm run collect     # fetch + normalise sources into public/data (~10 s)
npm run dev
```

`public/data/` is generated, not committed. Other scripts:

| Command | Does |
|---|---|
| `npm run collect` | Rebuild the data layer from upstream |
| `npm run collect -- --offline` | Rebuild from `.cache/` — no network, fast iteration |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | Production bundle into `dist/` |

Adding a benchmark is one row in `scripts/registry.mjs`; nothing else changes.

## Deployment

GitHub Actions builds and publishes to GitHub Pages on every push to `main`,
twice daily on a schedule, and on manual dispatch. The custom domain comes from
`public/CNAME`.

First-time setup on a fresh fork:

1. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
2. Point DNS at GitHub Pages — a `CNAME` record for the subdomain to
   `<owner>.github.io.`
3. Optionally add an `AA_API_KEY` repository secret ([free
   tier](https://artificialanalysis.ai/data-api)) to enable the Artificial
   Analysis panel. Everything else works without it.

## Licence

Code is MIT. Aggregated data belongs to the sources above and stays under their
terms — CC BY 4.0 for Epoch AI and LMArena, which requires attribution when you
reuse it.
