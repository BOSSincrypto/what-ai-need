/**
 * Two-language UI strings.
 *
 * A flat dictionary rather than nested namespaces: the whole site is one page,
 * the key list is short enough to read top to bottom, and a flat shape makes a
 * missing translation a compile error rather than a runtime `undefined`.
 */

import type { Lang } from './types';

const DICT = {
  // ── Chrome ────────────────────────────────────────────────────────────────
  tagline: { ru: 'Все рейтинги LLM в одном месте', en: 'Every LLM leaderboard in one place' },
  subtitle: {
    ru: 'Бенчмарки, арены и цены из независимых источников, сведённые в один индекс',
    en: 'Benchmarks, arenas and pricing from independent sources, folded into one index',
  },
  updated: { ru: 'Данные на', en: 'Data as of' },
  theme: { ru: 'Тема', en: 'Theme' },

  // ── Recommender ───────────────────────────────────────────────────────────
  whatFor: { ru: 'Что вам нужно от модели?', en: 'What do you need a model for?' },
  whatForHint: {
    ru: 'Выбор задачи меняет веса категорий и пересчитывает индекс прямо на странице',
    en: 'Picking a task re-weights the categories and recomputes the index in place',
  },
  budget: { ru: 'Бюджет, $ за млн токенов', en: 'Budget, $ per million tokens' },
  anyBudget: { ru: 'любой', en: 'any' },
  requirements: { ru: 'Требования', en: 'Requirements' },
  reqOpen: { ru: 'Открытые веса', en: 'Open weights' },
  reqTools: { ru: 'Вызов инструментов', en: 'Tool calling' },
  reqVision: { ru: 'Понимает картинки', en: 'Understands images' },
  reqLongCtx: { ru: 'Контекст 200k+', en: '200k+ context' },
  reqFree: { ru: 'Есть бесплатный тариф', en: 'Has a free tier' },
  reqReasoning: { ru: 'Режим рассуждений', en: 'Reasoning mode' },
  topPick: { ru: 'Лучший выбор', en: 'Top pick' },
  bestValue: { ru: 'Лучшая цена/качество', en: 'Best value' },
  bestOpen: { ru: 'Лучшая открытая', en: 'Best open-weights' },

  // ── Stats ─────────────────────────────────────────────────────────────────
  statModels: { ru: 'моделей', en: 'models' },
  statBenchmarks: { ru: 'бенчмарков', en: 'benchmarks' },
  statArenas: { ru: 'арен', en: 'arenas' },
  statDatapoints: { ru: 'замеров', en: 'measurements' },
  statVendors: { ru: 'разработчиков', en: 'vendors' },
  statSources: { ru: 'источника', en: 'sources' },

  // ── Table ─────────────────────────────────────────────────────────────────
  search: { ru: 'Поиск модели или разработчика…', en: 'Search model or vendor…' },
  rank: { ru: '#', en: '#' },
  model: { ru: 'Модель', en: 'Model' },
  tier: { ru: 'Тир', en: 'Tier' },
  index: { ru: 'Индекс', en: 'Index' },
  confidence: { ru: 'Доверие', en: 'Confidence' },
  price: { ru: 'Цена', en: 'Price' },
  priceIn: { ru: 'вход', en: 'in' },
  priceOut: { ru: 'выход', en: 'out' },
  context: { ru: 'Контекст', en: 'Context' },
  value: { ru: 'Ценность', en: 'Value' },
  released: { ru: 'Релиз', en: 'Released' },
  sources: { ru: 'Источники', en: 'Sources' },
  showMore: { ru: 'Показать ещё', en: 'Show more' },
  nothingFound: { ru: 'Ничего не найдено — ослабьте фильтры', en: 'Nothing found — loosen the filters' },
  resetFilters: { ru: 'Сбросить фильтры', en: 'Reset filters' },
  showing: { ru: 'Показано', en: 'Showing' },
  of: { ru: 'из', en: 'of' },

  // ── Filters ───────────────────────────────────────────────────────────────
  filters: { ru: 'Фильтры', en: 'Filters' },
  vendor: { ru: 'Разработчик', en: 'Vendor' },
  country: { ru: 'Страна', en: 'Country' },
  allVendors: { ru: 'Все разработчики', en: 'All vendors' },
  allCountries: { ru: 'Все страны', en: 'All countries' },
  license: { ru: 'Лицензия', en: 'License' },
  onlyModern: { ru: 'Только актуальные', en: 'Current models only' },
  onlyModernHint: {
    ru: 'Скрыть модели, выпущенные до 2025 года',
    en: 'Hide models released before 2025',
  },
  minConfidence: { ru: 'Мин. доверие', en: 'Min. confidence' },
  onlyPriced: { ru: 'Только с ценой', en: 'Priced only' },

  // ── Weights ───────────────────────────────────────────────────────────────
  weights: { ru: 'Своя формула индекса', en: 'Custom index formula' },
  weightsHint: {
    ru: 'Задайте вес каждой категории — индекс и весь рейтинг пересчитаются мгновенно',
    en: 'Set the weight of each category — the index and the whole ranking recompute instantly',
  },
  resetWeights: { ru: 'Вернуть по умолчанию', en: 'Reset to defaults' },

  // ── Analytics ─────────────────────────────────────────────────────────────
  analytics: { ru: 'Аналитика', en: 'Analytics' },
  tabPareto: { ru: 'Цена и качество', en: 'Price vs quality' },
  tabTimeline: { ru: 'Движение фронтира', en: 'Frontier over time' },
  tabLandscape: { ru: 'Кто делает модели', en: 'Who builds models' },
  tabDivergence: { ru: 'Люди против бенчмарков', en: 'Humans vs benchmarks' },
  tabBenchmarks: { ru: 'Бенчмарки', en: 'Benchmarks' },

  paretoTitle: { ru: 'Что вы платите за качество', en: 'What quality costs' },
  paretoDesc: {
    ru: 'Каждая точка — модель. Ось X — цена за млн токенов (логарифмическая), ось Y — индекс. Линия соединяет модели, дешевле которых при таком качестве ничего нет.',
    en: 'Each dot is a model. X is price per million tokens (log scale), Y is the index. The line links models nothing cheaper can match at that quality.',
  },
  frontierLabel: { ru: 'Граница эффективности', en: 'Efficient frontier' },
  otherModels: { ru: 'Остальные модели', en: 'Other models' },

  timelineTitle: { ru: 'Как двигался потолок', en: 'How the ceiling moved' },
  timelineDesc: {
    ru: 'Лучший результат в категории на каждый момент времени. Ступенька — момент, когда кто-то побил рекорд.',
    en: 'The best score in a category at each point in time. Each step is the moment somebody broke the record.',
  },

  landscapeTitle: { ru: 'Расстановка сил', en: 'The landscape' },
  landscapeDesc: {
    ru: 'Сколько моделей на фронтире у каждой страны и разработчика — и насколько они хороши.',
    en: 'How many frontier models each country and vendor fields — and how good they are.',
  },
  byCountry: { ru: 'По странам', en: 'By country' },
  byVendor: { ru: 'По разработчикам', en: 'By vendor' },
  medianIndex: { ru: 'медианный индекс', en: 'median index' },

  divergenceTitle: { ru: 'Где люди и тесты расходятся', en: 'Where humans and tests disagree' },
  divergenceDesc: {
    ru: 'Разница между оценкой живых людей в слепых сравнениях и результатами бенчмарков, отсчитанная от типичной модели. Плюс — нравится людям больше, чем «заслужено» тестами; минус — модель сильнее, чем ощущается в диалоге. Только хорошо измеренные модели не старше июня 2025.',
    en: 'The gap between how live humans rate a model in blind comparisons and what the benchmarks say, measured against the typical model. Positive means people like it more than its scores earn; negative means it is stronger than it feels in conversation. Well-measured models released since June 2025 only.',
  },
  humansLike: { ru: 'Нравятся людям больше', en: 'People like these more' },
  benchStronger: { ru: 'Сильнее, чем кажется', en: 'Stronger than they feel' },

  benchmarksTitle: { ru: 'Отдельные бенчмарки', en: 'Individual benchmarks' },
  benchmarksDesc: {
    ru: 'Сырые таблицы лидеров по каждому тесту — без нормализации и весов.',
    en: 'Raw leaderboards for each test — no normalisation, no weights.',
  },

  // ── Compare ───────────────────────────────────────────────────────────────
  compare: { ru: 'Сравнить', en: 'Compare' },
  compareTitle: { ru: 'Сравнение моделей', en: 'Model comparison' },
  compareHint: {
    ru: 'Отметьте до 4 моделей в таблице',
    en: 'Tick up to 4 models in the table',
  },
  clearCompare: { ru: 'Очистить', en: 'Clear' },

  // ── Detail ────────────────────────────────────────────────────────────────
  overview: { ru: 'Обзор', en: 'Overview' },
  byCategory: { ru: 'По категориям', en: 'By category' },
  benchScores: { ru: 'Результаты бенчмарков', en: 'Benchmark results' },
  arenaScores: { ru: 'Рейтинги арен', en: 'Arena ratings' },
  votes: { ru: 'голосов', en: 'votes' },
  noData: { ru: 'нет данных', en: 'no data' },
  raw: { ru: 'сырой', en: 'raw' },
  normalized: { ru: 'норм.', en: 'norm.' },
  close: { ru: 'Закрыть', en: 'Close' },
  modalities: { ru: 'Модальности', en: 'Modalities' },
  capabilities: { ru: 'Возможности', en: 'Capabilities' },
  openInRouter: { ru: 'Открыть на OpenRouter', en: 'Open on OpenRouter' },
  measuredOn: { ru: 'Измерено на', en: 'Measured on' },
  testsIn: { ru: 'тестах в', en: 'tests across' },
  categoriesWord: { ru: 'категориях', en: 'categories' },

  // ── Methodology ───────────────────────────────────────────────────────────
  methodology: { ru: 'Как это считается', en: 'How this is computed' },
  methodIntro: {
    ru: 'Индекс WAIN — не ещё один бенчмарк, а способ свести чужие в один сопоставимый масштаб. Четыре шага:',
    en: 'The WAIN index is not another benchmark — it is a way to put other people’s benchmarks on one comparable scale. Four steps:',
  },
  step1: { ru: 'Нормализация', en: 'Normalisation' },
  step1d: {
    ru: 'У каждого теста своя шкала: доля от 0 до 1, проценты, Elo около 1500, а у Vending-Bench вообще доллары от −31 до +10 940. Каждый бенчмарк растягивается на 0–100 по своей когорте, с обрезкой по 5-му и 95-му процентилю — чтобы один выброс не сплющил всех остальных.',
    en: 'Every test has its own scale: fractions of 1, percentages, Elo near 1500, and Vending-Bench’s unbounded dollars from −31 to +10,940. Each benchmark is stretched to 0–100 against its own cohort, clamped at the 5th and 95th percentile so one runaway result cannot flatten everyone else.',
  },
  step2: { ru: 'Категории', en: 'Categories' },
  step2d: {
    ru: 'Нормализованные результаты собираются в восемь категорий — рассуждение, математика, код, агенты, мультимодальность, длинный контекст, тексты и человеческие предпочтения. Внутри категории тесты взвешены по значимости.',
    en: 'Normalised results roll up into eight categories — reasoning, maths, coding, agentic, multimodal, long context, writing and human preference. Inside a category, tests are weighted by how much they matter.',
  },
  step3: { ru: 'Поправка на доверие', en: 'Confidence adjustment' },
  step3d: {
    ru: 'Модель с одним замером не должна обгонять модель с тридцатью. Доверие — среднее геометрическое широты (сколько категорий закрыто) и глубины (сколько всего замеров). Итоговый индекс притягивается к медиане тем сильнее, чем меньше доверие. Поэтому свежая модель поначалу выглядит скромнее: данных о ней просто меньше.',
    en: 'A model with one measurement should not outrank one with thirty. Confidence is the geometric mean of breadth (how many categories are covered) and depth (how many measurements in total). The final index is pulled toward the median in proportion to how little confidence there is — which is why a brand-new model starts out looking modest: there is genuinely less evidence about it.',
  },
  step4: { ru: 'Ваши веса', en: 'Your weights' },
  step4d: {
    ru: 'Веса категорий по умолчанию — компромисс. Выберите задачу или подвиньте ползунки, и весь рейтинг пересчитается в браузере по той же формуле, без единого запроса на сервер.',
    en: 'The default category weights are a compromise. Pick a task or move the sliders and the whole ranking recomputes in your browser using the same formula, with no server round-trip.',
  },
  caveats: { ru: 'Чего этот индекс не знает', en: 'What this index does not know' },
  caveatsText: {
    ru: 'Бенчмарки не измеряют тон, надёжность в проде, качество API, скорость и лимиты. Разные тесты гоняются с разными обвязками и настройками рассуждений — сравнение всегда приблизительное. Цены берутся у OpenRouter и могут отличаться от прямых договоров с вендором. Открытые веса не значит бесплатно: считайте стоимость железа.',
    en: 'Benchmarks do not measure tone, production reliability, API quality, speed or rate limits. Different tests run with different scaffolds and reasoning settings, so any comparison is approximate. Prices come from OpenRouter and may differ from a direct vendor contract. Open weights does not mean free — count the hardware.',
  },
  dataSources: { ru: 'Источники данных', en: 'Data sources' },
  sourceHealth: { ru: 'Состояние источников', en: 'Source health' },
  builtWith: {
    ru: 'Сайт статический, собирается GitHub Actions и обновляется дважды в сутки.',
    en: 'The site is static, built by GitHub Actions and refreshed twice a day.',
  },
  openSource: { ru: 'Исходный код', en: 'Source code' },

  // ── Misc ──────────────────────────────────────────────────────────────────
  open: { ru: 'открытая', en: 'open' },
  proprietary: { ru: 'закрытая', en: 'proprietary' },
  free: { ru: 'бесплатно', en: 'free' },
  tokens: { ru: 'ток.', en: 'tok.' },
  perMillion: { ru: '/млн', en: '/M' },
  loading: { ru: 'Загрузка данных…', en: 'Loading data…' },
  loadError: {
    ru: 'Не удалось загрузить данные. Обновите страницу.',
    en: 'Could not load the data. Try refreshing.',
  },
} as const;

export type Key = keyof typeof DICT;

let current: Lang = 'ru';

export const setLang = (lang: Lang) => { current = lang; };
export const getLang = () => current;

/** Look up a UI string in the active language. */
export const t = (key: Key): string => DICT[key][current];

/**
 * Pick the localised field off any record carrying both `ru` and `en`.
 *
 * Takes `object` rather than a mapped type so the interfaces in `types.ts` can
 * stay precise — declaring an index signature on `Category` just to satisfy
 * this helper would weaken every other use of it.
 */
export function loc(obj: object, prefix = ''): string {
  const rec = obj as Record<string, unknown>;
  return String(rec[`${prefix}${current}`] ?? rec[`${prefix}en`] ?? '');
}

/** Locale-aware number formatting; `ru` uses a narrow no-break space. */
export const fmt = (n: number, digits = 0) =>
  n.toLocaleString(current === 'ru' ? 'ru-RU' : 'en-US', {
    minimumFractionDigits: digits, maximumFractionDigits: digits,
  });

/** Compact token counts: 1048576 → "1M", 262144 → "256k". */
export function fmtTokens(n: number | undefined): string {
  if (!n) return '—';
  if (n >= 1_000_000) return `${Math.round(n / 100_000) / 10}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return String(n);
}

/** Prices span four orders of magnitude, so significant digits beat fixed ones. */
export function fmtPrice(p: number | undefined | null): string {
  if (p == null) return '—';
  if (p === 0) return '$0';
  if (p < 0.01) return `$${p.toFixed(4)}`;
  if (p < 1) return `$${p.toFixed(3)}`;
  if (p < 100) return `$${p.toFixed(2)}`;
  return `$${Math.round(p)}`;
}

/** Numeric date for the KPI tile, where "26 июл. 2026 г." wraps to two lines. */
export const fmtDateShort = (iso: string | null | undefined) =>
  !iso ? '—' : new Date(`${iso}T00:00:00Z`).toLocaleDateString(
    current === 'ru' ? 'ru-RU' : 'en-US',
    { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC' },
  );

export const fmtDate = (iso: string | null | undefined) =>
  !iso ? '—' : new Date(`${iso}T00:00:00Z`).toLocaleDateString(
    current === 'ru' ? 'ru-RU' : 'en-US',
    { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' },
  );
