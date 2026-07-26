/**
 * Static metadata: which benchmarks we ingest, how they map to capability
 * categories, and how raw vendor/organisation strings collapse into one label.
 *
 * Keeping this in one place means `collect.mjs` stays pure plumbing: add a row
 * here and the benchmark shows up in the site with no other change.
 */

/** Capability categories. `w` is the default weight inside the WAIN index. */
export const CATEGORIES = [
  { id: 'reasoning', w: 1.0, en: 'Reasoning & Knowledge', ru: 'Рассуждение и знания' },
  { id: 'math', w: 0.9, en: 'Mathematics', ru: 'Математика' },
  { id: 'coding', w: 1.1, en: 'Coding', ru: 'Программирование' },
  { id: 'agentic', w: 1.1, en: 'Agentic & Tool use', ru: 'Агенты и инструменты' },
  { id: 'multimodal', w: 0.6, en: 'Multimodal & Spatial', ru: 'Мультимодальность' },
  { id: 'longcontext', w: 0.5, en: 'Long context', ru: 'Длинный контекст' },
  { id: 'writing', w: 0.5, en: 'Writing & Creativity', ru: 'Текст и креатив' },
  { id: 'preference', w: 0.8, en: 'Human preference', ru: 'Человеческие предпочтения' },
];

/**
 * Epoch AI Benchmarking Hub files we ingest.
 *
 * `col` is the column holding the headline score — Epoch's CSVs are not
 * uniform, every benchmark names it differently. `pct` marks scores already
 * expressed as 0-100 rather than 0-1 (display only; the index normalises
 * within a benchmark so the unit never matters for ranking).
 */
export const EPOCH_BENCHMARKS = [
  // ── Reasoning & knowledge ──────────────────────────────────────────────
  { id: 'gpqa', file: 'gpqa_diamond.csv', col: 'mean_score', cat: 'reasoning', w: 1.0, en: 'GPQA Diamond', ru: 'GPQA Diamond', about_en: 'PhD-level science questions, Google-proof.', about_ru: 'Научные вопросы уровня PhD, устойчивые к поиску.' },
  { id: 'hle', file: 'hle_external.csv', col: 'Accuracy', cat: 'reasoning', w: 1.0, en: "Humanity's Last Exam", ru: 'Humanity’s Last Exam', about_en: 'Expert-written questions at the frontier of human knowledge.', about_ru: 'Экспертные вопросы на границе человеческих знаний.' },
  { id: 'arc_agi_2', file: 'arc_agi_2_external.csv', col: 'Score', cat: 'reasoning', w: 0.9, en: 'ARC-AGI-2', ru: 'ARC-AGI-2', about_en: 'Novel abstract reasoning puzzles resistant to memorisation.', about_ru: 'Абстрактные головоломки, устойчивые к запоминанию.' },
  { id: 'arc_agi', file: 'arc_agi_external.csv', col: 'Score', cat: 'reasoning', w: 0.5, en: 'ARC-AGI-1', ru: 'ARC-AGI-1', about_en: 'First-generation abstraction and reasoning corpus.', about_ru: 'Первое поколение корпуса абстрактных задач.' },
  { id: 'simpleqa', file: 'simpleqa_verified.csv', col: 'mean_score', cat: 'reasoning', w: 0.8, en: 'SimpleQA Verified', ru: 'SimpleQA Verified', about_en: 'Short factual questions — measures hallucination resistance.', about_ru: 'Короткие фактические вопросы — устойчивость к галлюцинациям.' },
  { id: 'simplebench', file: 'simplebench_external.csv', col: 'Score (AVG@5)', cat: 'reasoning', w: 0.7, en: 'SimpleBench', ru: 'SimpleBench', about_en: 'Trick questions humans find easy and models find hard.', about_ru: 'Вопросы с подвохом: лёгкие для людей, трудные для моделей.' },
  { id: 'enigma', file: 'enigma_eval_external.csv', col: 'Accuracy', cat: 'reasoning', w: 0.5, en: 'EnigmaEval', ru: 'EnigmaEval', about_en: 'Complex multi-step puzzle hunts.', about_ru: 'Сложные многошаговые головоломки.' },
  { id: 'critpt', file: 'critpt_external.csv', col: 'Accuracy', cat: 'reasoning', w: 0.6, en: 'CritPt', ru: 'CritPt', about_en: 'Research-level physics reasoning.', about_ru: 'Физика исследовательского уровня.' },
  { id: 'forecastbench', file: 'forecastbench_external.csv', col: 'Overall score', cat: 'reasoning', w: 0.4, en: 'ForecastBench', ru: 'ForecastBench', about_en: 'Accuracy of predictions about future events.', about_ru: 'Точность прогнозов будущих событий.' },
  { id: 'chess', file: 'chess_puzzles.csv', col: 'mean_score', cat: 'reasoning', w: 0.3, en: 'Chess Puzzles', ru: 'Шахматные задачи', about_en: 'Tactical chess puzzle solving.', about_ru: 'Решение тактических шахматных задач.' },

  // ── Mathematics ────────────────────────────────────────────────────────
  { id: 'frontiermath', file: 'frontiermath.csv', col: 'mean_score', cat: 'math', w: 1.0, en: 'FrontierMath', ru: 'FrontierMath', about_en: 'Unpublished research-level mathematics problems.', about_ru: 'Неопубликованные задачи исследовательского уровня.' },
  { id: 'frontiermath_t4', file: 'frontiermath_tier_4.csv', col: 'mean_score', cat: 'math', w: 0.9, en: 'FrontierMath Tier 4', ru: 'FrontierMath Tier 4', about_en: 'The hardest tier — problems for research mathematicians.', about_ru: 'Самый сложный уровень — для профессиональных математиков.' },
  { id: 'aime', file: 'otis_mock_aime_2024_2025.csv', col: 'mean_score', cat: 'math', w: 0.7, en: 'OTIS Mock AIME', ru: 'OTIS Mock AIME', about_en: 'Olympiad-style competition mathematics.', about_ru: 'Олимпиадная математика уровня AIME.' },
  { id: 'math_l5', file: 'math_level_5.csv', col: 'mean_score', cat: 'math', w: 0.5, en: 'MATH Level 5', ru: 'MATH Level 5', about_en: 'Hardest tier of the MATH competition dataset.', about_ru: 'Сложнейший уровень датасета MATH.' },
  { id: 'proofbench', file: 'proofbench_external.csv', col: 'Accuracy', cat: 'math', w: 0.7, en: 'ProofBench', ru: 'ProofBench', about_en: 'Formal and natural-language proof construction.', about_ru: 'Построение формальных и текстовых доказательств.' },

  // ── Coding ─────────────────────────────────────────────────────────────
  { id: 'swebench', file: 'swe_bench_verified.csv', col: 'mean_score', cat: 'coding', w: 1.0, en: 'SWE-bench Verified', ru: 'SWE-bench Verified', about_en: 'Real GitHub issues resolved end to end in a repo.', about_ru: 'Реальные issue с GitHub, решённые целиком в репозитории.' },
  { id: 'terminalbench', file: 'terminalbench_external.csv', col: 'Accuracy mean', cat: 'coding', w: 0.9, en: 'Terminal-Bench', ru: 'Terminal-Bench', about_en: 'Autonomous work in a real terminal environment.', about_ru: 'Автономная работа в настоящем терминале.' },
  { id: 'scicode', file: 'scicode_external.csv', col: 'Score', cat: 'coding', w: 0.7, en: 'SciCode', ru: 'SciCode', about_en: 'Scientific computing code written from research papers.', about_ru: 'Научный код по описаниям из статей.' },
  { id: 'cursorbench', file: 'cursorbench_external.csv', col: 'Score', cat: 'coding', w: 0.7, en: 'CursorBench', ru: 'CursorBench', about_en: 'Real-world IDE edits drawn from developer sessions.', about_ru: 'Реальные правки в IDE из сессий разработчиков.' },
  { id: 'frontiercode', file: 'frontiercode_external.csv', col: 'Main score', cat: 'coding', w: 0.8, en: 'FrontierCode', ru: 'FrontierCode', about_en: 'Hard programming tasks beyond current model reach.', about_ru: 'Трудные задачи программирования на пределе моделей.' },
  { id: 'gso', file: 'gso_external.csv', col: 'Score OPT@1', cat: 'coding', w: 0.6, en: 'GSO', ru: 'GSO', about_en: 'Code optimisation — making real software measurably faster.', about_ru: 'Оптимизация кода — реальное ускорение софта.' },
  { id: 'aider', file: 'aider_polyglot_external.csv', col: 'Percent correct', cat: 'coding', w: 0.6, en: 'Aider Polyglot', ru: 'Aider Polyglot', about_en: 'Multi-language edit tasks with strict diff formats.', about_ru: 'Многоязычное редактирование со строгим форматом диффов.' },
  { id: 'alebench', file: 'ale_bench_external.csv', col: 'Performance', cat: 'coding', w: 0.5, en: 'ALE-Bench', ru: 'ALE-Bench', about_en: 'Long-horizon algorithm-engineering contests.', about_ru: 'Длинные соревнования по алгоритмической инженерии.' },
  { id: 'algotune', file: 'algotune_external.csv', col: 'Score', cat: 'coding', w: 0.4, en: 'AlgoTune', ru: 'AlgoTune', about_en: 'Speeding up reference algorithm implementations.', about_ru: 'Ускорение эталонных реализаций алгоритмов.' },
  { id: 'deepswe', file: 'deepswe_external.csv', col: 'Pass@1', cat: 'coding', w: 0.6, en: 'DeepSWE', ru: 'DeepSWE', about_en: 'Deep software-engineering tasks with agent scaffolds.', about_ru: 'Глубокие задачи разработки с агентными обвязками.' },
  { id: 'livebench', file: 'live_bench_external.csv', col: 'Global average', cat: 'coding', w: 0.4, en: 'LiveBench', ru: 'LiveBench', about_en: 'Contamination-free rolling benchmark, global average.', about_ru: 'Обновляемый бенчмарк без утечек, общий средний балл.' },

  // ── Agentic & tool use ─────────────────────────────────────────────────
  { id: 'apex_agents', file: 'apex_agents_external.csv', col: 'Mean score', cat: 'agentic', w: 0.9, en: 'APEX Agents', ru: 'APEX Agents', about_en: 'Professional agentic workflows across domains.', about_ru: 'Профессиональные агентные сценарии в разных доменах.' },
  { id: 'metr', file: 'metr_time_horizons_external.csv', col: 'average_score', cat: 'agentic', w: 0.9, en: 'METR Time Horizons', ru: 'METR Time Horizons', about_en: 'How long a task a model can complete autonomously.', about_ru: 'Насколько длинную задачу модель тянет автономно.' },
  { id: 'osworld2', file: 'osworld_2_external.csv', col: 'Binary accuracy', cat: 'agentic', w: 0.8, en: 'OSWorld-2', ru: 'OSWorld-2', about_en: 'Real desktop computer use across applications.', about_ru: 'Реальное управление компьютером в приложениях.' },
  { id: 'osworld', file: 'os_world_external.csv', col: 'Score', cat: 'agentic', w: 0.5, pct: true, en: 'OSWorld', ru: 'OSWorld', about_en: 'First-generation computer-use benchmark.', about_ru: 'Первое поколение бенчмарка управления ПК.' },
  { id: 'tac', file: 'the_agent_company_external.csv', col: '% Score', cat: 'agentic', w: 0.7, en: 'TheAgentCompany', ru: 'TheAgentCompany', about_en: 'Simulated company tasks — a full knowledge-work day.', about_ru: 'Задачи симулированной компании — рабочий день целиком.' },
  { id: 'gdpval', file: 'gdpval_external.csv', col: 'Win Rate (%)', cat: 'agentic', w: 0.7, pct: true, en: 'GDPval', ru: 'GDPval', about_en: 'Economically valuable tasks judged against professionals.', about_ru: 'Экономически ценные задачи в сравнении с профессионалами.' },
  { id: 'deepresearch', file: 'deepresearchbench_external.csv', col: 'Average score', cat: 'agentic', w: 0.6, en: 'DeepResearch Bench', ru: 'DeepResearch Bench', about_en: 'Multi-source research report quality.', about_ru: 'Качество исследовательских отчётов по многим источникам.' },
  { id: 'vending2', file: 'vending_bench_2_external.csv', col: 'Score', cat: 'agentic', w: 0.6, en: 'Vending-Bench 2', ru: 'Vending-Bench 2', about_en: 'Running a business over a very long horizon.', about_ru: 'Ведение бизнеса на очень длинном горизонте.' },
  { id: 'balrog', file: 'balrog_external.csv', col: 'Average progress', cat: 'agentic', w: 0.4, en: 'BALROG', ru: 'BALROG', about_en: 'Agentic reasoning in games and interactive worlds.', about_ru: 'Агентное мышление в играх и интерактивных мирах.' },
  { id: 'cybench', file: 'cybench_external.csv', col: 'Unguided % Solved', cat: 'agentic', w: 0.5, en: 'Cybench', ru: 'Cybench', about_en: 'Capture-the-flag cybersecurity tasks, unguided.', about_ru: 'CTF-задачи по кибербезопасности без подсказок.' },
  { id: 'exploitbench', file: 'exploitbench_external.csv', col: 'Mean capability', cat: 'agentic', w: 0.4, en: 'ExploitBench', ru: 'ExploitBench', about_en: 'Offensive-security capability measurement.', about_ru: 'Измерение наступательных возможностей в security.' },
  { id: 'weirdml', file: 'weirdml_external.csv', col: 'Accuracy', cat: 'agentic', w: 0.5, en: 'WeirdML', ru: 'WeirdML', about_en: 'Unusual ML problems solved by writing training code.', about_ru: 'Нестандартные ML-задачи через написание кода обучения.' },
  { id: 'blueprint2', file: 'blueprint_bench_2_external.csv', col: 'Score', cat: 'agentic', w: 0.4, en: 'BlueprintBench 2', ru: 'BlueprintBench 2', about_en: 'Reconstructing floor plans from photographs.', about_ru: 'Восстановление планов помещений по фотографиям.' },
  { id: 'gbaeval', file: 'gbaeval_external.csv', col: 'Overall score', cat: 'agentic', w: 0.4, en: 'GBAEval', ru: 'GBAEval', about_en: 'Long-horizon play of Game Boy Advance titles.', about_ru: 'Долгая игра в игры Game Boy Advance.' },
  { id: 'posttrain', file: 'posttrainbench_external.csv', col: 'Average (%)', cat: 'agentic', w: 0.4, pct: true, en: 'PostTrainBench', ru: 'PostTrainBench', about_en: 'Autonomously post-training a smaller model.', about_ru: 'Автономный пост-тренинг меньшей модели.' },
  { id: 'rli', file: 'rli_external.csv', col: 'Score', cat: 'agentic', w: 0.4, en: 'Remote Labor Index', ru: 'Remote Labor Index', about_en: 'End-to-end freelance projects from real marketplaces.', about_ru: 'Фриланс-проекты целиком с реальных бирж.' },
  { id: 'surface_evolver', file: 'surface_evolver_bench_external.csv', col: 'Mean score', cat: 'agentic', w: 0.3, en: 'Surface Evolver Bench', ru: 'Surface Evolver Bench', about_en: 'Driving specialised scientific software.', about_ru: 'Управление специализированным научным ПО.' },
  { id: 'btf3', file: 'btf3_external.csv', col: 'Pooled score', cat: 'agentic', w: 0.3, en: 'Beat The Forecasters 3', ru: 'Beat The Forecasters 3', about_en: 'Competing against human superforecasters.', about_ru: 'Соревнование с людьми-суперпрогнозистами.' },

  // ── Multimodal & spatial ───────────────────────────────────────────────
  { id: 'video_mme', file: 'video_mme_external.csv', col: 'Overall (no subtitles)', cat: 'multimodal', w: 0.7, en: 'Video-MME', ru: 'Video-MME', about_en: 'Video understanding without subtitle crutches.', about_ru: 'Понимание видео без опоры на субтитры.' },
  { id: 'vpct', file: 'vpct_external.csv', col: 'Correct', cat: 'multimodal', w: 0.5, en: 'VPCT', ru: 'VPCT', about_en: 'Visual physics and trajectory prediction.', about_ru: 'Предсказание физики и траекторий по видео.' },
  { id: 'geobench', file: 'geobench_external.csv', col: 'ACW Avg Score', cat: 'multimodal', w: 0.5, en: 'GeoBench', ru: 'GeoBench', about_en: 'Geolocating photographs from visual cues alone.', about_ru: 'Геолокация фотографий только по визуальным признакам.' },
  { id: 'cad_eval', file: 'cad_eval_external.csv', col: 'Overall pass (%)', cat: 'multimodal', w: 0.4, pct: true, en: 'CAD-Eval', ru: 'CAD-Eval', about_en: 'Generating parametric 3D CAD models.', about_ru: 'Генерация параметрических 3D CAD-моделей.' },
  { id: 'spatialviz', file: 'spatialviz_bench_external.csv', col: 'Overall score', cat: 'multimodal', w: 0.4, en: 'SpatialViz-Bench', ru: 'SpatialViz-Bench', about_en: 'Mental rotation and spatial visualisation.', about_ru: 'Мысленное вращение и пространственное воображение.' },
  { id: 'mindcube', file: 'mindcube_external.csv', col: 'Overall score', cat: 'multimodal', w: 0.3, en: 'MindCube', ru: 'MindCube', about_en: 'Spatial mental models from limited views.', about_ru: 'Пространственные модели по ограниченным ракурсам.' },

  // ── Long context ───────────────────────────────────────────────────────
  { id: 'fiction120k', file: 'fictionlivebench_external.csv', col: '120k token score', cat: 'longcontext', w: 1.0, en: 'Fiction.LiveBench 120k', ru: 'Fiction.LiveBench 120k', about_en: 'Deep comprehension across a 120k-token narrative.', about_ru: 'Глубокое понимание текста на 120k токенов.' },

  // ── Writing ────────────────────────────────────────────────────────────
  { id: 'lech_writing', file: 'lech_mazur_writing_external.csv', col: 'Mean score', cat: 'writing', w: 1.0, en: 'Creative Writing (Mazur)', ru: 'Креативное письмо (Mazur)', about_en: 'LLM-graded creative writing under tight constraints.', about_ru: 'Креативное письмо под жёсткими ограничениями.' },
  { id: 'webdev_arena', file: 'webdev_arena_external.csv', col: 'Arena Score', cat: 'coding', w: 0.6, elo: true, en: 'WebDev Arena', ru: 'WebDev Arena', about_en: 'Head-to-head human votes on generated web apps.', about_ru: 'Парные голоса людей за сгенерированные веб-приложения.' },
];

/**
 * LMArena leaderboards, served through the official Hugging Face dataset.
 * `text_style_control` is preferred over raw `text`: it de-biases the Elo for
 * response length and markdown formatting, which is the fairer signal.
 */
export const ARENAS = [
  { id: 'text_style_control', cat: 'preference', w: 1.0, en: 'Text (style control)', ru: 'Текст (контроль стиля)' },
  { id: 'webdev', cat: 'preference', w: 0.7, en: 'WebDev', ru: 'Веб-разработка' },
  { id: 'agent', cat: 'preference', w: 0.8, en: 'Agent', ru: 'Агенты' },
  { id: 'vision_style_control', cat: 'preference', w: 0.6, en: 'Vision (style control)', ru: 'Зрение (контроль стиля)' },
  { id: 'search_style_control', cat: 'preference', w: 0.5, en: 'Search', ru: 'Поиск' },
  { id: 'document_style_control', cat: 'preference', w: 0.5, en: 'Documents', ru: 'Документы' },
];

/** Raw organisation strings → one canonical vendor label. */
export const VENDOR_ALIASES = {
  'google deepmind': 'Google',
  'deepmind': 'Google',
  'google research': 'Google',
  'google deepmind,google': 'Google',
  'google,google deepmind': 'Google',
  'meta ai': 'Meta',
  'meta-llama': 'Meta',
  'moonshot': 'MoonshotAI',
  'moonshotai': 'MoonshotAI',
  'x-ai': 'xAI',
  'xai': 'xAI',
  'spacexai': 'xAI',
  'bytedance': 'ByteDance',
  'baidu': 'Baidu',
  'meituan': 'Meituan',
  'kwaipilot': 'Kwaipilot',
  'poolside': 'Poolside',
  'sakana': 'Sakana',
  'perceptron': 'Perceptron',
  'openrouter': 'OpenRouter',
  'tencent': 'Tencent',
  'minimax': 'MiniMax',
  'liquid': 'Liquid AI',
  'ai21': 'AI21 Labs',
  'upstage': 'Upstage',
  'arcee-ai': 'Arcee AI',
  'agentica-org': 'Agentica',
  'opengvlab': 'OpenGVLab',
  'thudm': 'Z.ai',
  'z.ai (zhipu ai)': 'Z.ai',
  'z-ai': 'Z.ai',
  'z.ai (zhipu ai),tsinghua university': 'Z.ai',
  'zhipu ai': 'Z.ai',
  'mistral': 'Mistral AI',
  'mistralai': 'Mistral AI',
  'qwen': 'Alibaba',
  'alibaba': 'Alibaba',
  'microsoft research': 'Microsoft',
  'microsoft,nvidia': 'Microsoft',
  'openai': 'OpenAI',
  'anthropic': 'Anthropic',
  'nvidia': 'NVIDIA',
  'deepseek,peking university': 'DeepSeek',
  'inclusionai': 'inclusionAI',
  'ibm-granite': 'IBM',
  'xiaomi corp': 'Xiaomi',
  'thinkingmachines': 'Thinking Machines',
  'nex-agi': 'Nex AGI',
  'stepfun': 'StepFun',
  'aion-labs': 'AionLabs',
  'shanghai ai lab': 'Shanghai AI Lab',
  'allen institute for ai,university of washington': 'Allen Institute for AI',

  // Vendors whose OpenRouter slug title-cases into a different string than the
  // name Epoch and LMArena use ("Deepseek" vs "DeepSeek"). Without these the
  // same lab shows up twice in every per-vendor chart.
  deepseek: 'DeepSeek',
  'deepseek-ai': 'DeepSeek',
  ibm: 'IBM',
  allenai: 'Allen Institute for AI',
  'allen institute for ai': 'Allen Institute for AI',
  'bytedance-seed': 'ByteDance',
  seed: 'ByteDance',
  nousresearch: 'Nous Research',
  'nous research': 'Nous Research',
  zai: 'Z.ai',
  rekaai: 'Reka AI',
  'ant-group': 'Ant Group',
  'inception-ai': 'Inception Labs',
  inception: 'Inception Labs',
  deepcogito: 'Deep Cogito',
  cognitivecomputations: 'Cognitive Computations',
  'anthracite-org': 'Anthracite',
  thedrummer: 'TheDrummer',
  sao10k: 'Sao10K',
  'arcee ai': 'Arcee AI',
  arcee: 'Arcee AI',
  writer: 'Writer',
  relace: 'Relace',
  morph: 'Morph',
  diffbot: 'Diffbot',
  'tsinghua university': 'Z.ai',
  moonshotai: 'MoonshotAI',
};

/** Vendor → country, used when a source does not carry a country column. */
export const VENDOR_COUNTRY = {
  OpenAI: 'US', Anthropic: 'US', Google: 'US', Meta: 'US', xAI: 'US',
  Microsoft: 'US', NVIDIA: 'US', 'Mistral AI': 'FR', Cohere: 'CA',
  DeepSeek: 'CN', MoonshotAI: 'CN', Alibaba: 'CN', 'Z.ai': 'CN',
  MiniMax: 'CN', Tencent: 'CN', ByteDance: 'CN', Baichuan: 'CN', Baidu: 'CN',
  OpenGVLab: 'CN', THUDM: 'CN', 'iFlytek': 'CN', Skywork: 'CN',
  '01.AI': 'CN', Xiaomi: 'CN', StepFun: 'CN', 'Shanghai AI Lab': 'CN',
  inclusionAI: 'CN', Meituan: 'CN', Kwaipilot: 'CN', 'Nex AGI': 'CN',
  'Thinking Machines': 'US', 'Allen Institute for AI': 'US', IBM: 'US',
  Databricks: 'US', Perplexity: 'US', Amazon: 'US', Salesforce: 'US',
  'Reka AI': 'US', 'Inception Labs': 'US', 'Inflection AI': 'US',
  Poolside: 'US', Sakana: 'JP', 'Technology Innovation Institute': 'AE',
  Upstage: 'KR', LG: 'KR', Naver: 'KR', 'AI21 Labs': 'IL', Yandex: 'RU',
  'Cerebras Systems': 'US', MosaicML: 'US', EleutherAI: 'US',
  'Stability AI': 'GB', AionLabs: 'IL', Perceptron: 'US', Liquid: 'US',
  'Nous Research': 'US', 'Arcee AI': 'US', 'Reka AI': 'US', Writer: 'US',
  Relace: 'US', Morph: 'US', Diffbot: 'US', 'Deep Cogito': 'US',
  'Cognitive Computations': 'US', TheDrummer: 'US', Anthracite: 'US',
  'Ant Group': 'CN', Sao10K: 'SG', 'Liquid AI': 'US', OpenGVLab: 'CN',
  Agentica: 'US', 'Inception Labs': 'US', Kwaipilot: 'CN',
};

/** Country → flag emoji + label, for the geography analytics panel. */
export const COUNTRIES = {
  US: { flag: '🇺🇸', en: 'United States', ru: 'США' },
  CH: { flag: '🇨🇭', en: 'Switzerland', ru: 'Швейцария' },
  SG: { flag: '🇸🇬', en: 'Singapore', ru: 'Сингапур' },
  CN: { flag: '🇨🇳', en: 'China', ru: 'Китай' },
  FR: { flag: '🇫🇷', en: 'France', ru: 'Франция' },
  GB: { flag: '🇬🇧', en: 'United Kingdom', ru: 'Великобритания' },
  CA: { flag: '🇨🇦', en: 'Canada', ru: 'Канада' },
  JP: { flag: '🇯🇵', en: 'Japan', ru: 'Япония' },
  KR: { flag: '🇰🇷', en: 'South Korea', ru: 'Южная Корея' },
  IL: { flag: '🇮🇱', en: 'Israel', ru: 'Израиль' },
  AE: { flag: '🇦🇪', en: 'UAE', ru: 'ОАЭ' },
  RU: { flag: '🇷🇺', en: 'Russia', ru: 'Россия' },
  DE: { flag: '🇩🇪', en: 'Germany', ru: 'Германия' },
  Other: { flag: '🏳️', en: 'Other', ru: 'Другие' },
};

/** Epoch's `Country` column carries full names; map the ones we care about. */
export const COUNTRY_NAME_TO_CODE = {
  'united states of america': 'US',
  'united states': 'US',
  china: 'CN',
  france: 'FR',
  'united kingdom': 'GB',
  canada: 'CA',
  japan: 'JP',
  'south korea': 'KR',
  israel: 'IL',
  'united arab emirates': 'AE',
  russia: 'RU',
  germany: 'DE',
};

/**
 * Task presets for the recommender. Each preset re-weights the categories,
 * which is the whole point of the WAIN index being a weighted sum.
 */
export const PRESETS = [
  { id: 'balanced', icon: '⚖️', en: 'Balanced', ru: 'Сбалансированно', w: { reasoning: 1, math: 0.9, coding: 1.1, agentic: 1.1, multimodal: 0.6, longcontext: 0.5, writing: 0.5, preference: 0.8 } },
  { id: 'coding', icon: '⌨️', en: 'Writing code', ru: 'Писать код', w: { reasoning: 0.5, math: 0.4, coding: 2.5, agentic: 1.2, multimodal: 0.1, longcontext: 0.6, writing: 0.1, preference: 0.4 } },
  { id: 'agent', icon: '🤖', en: 'Autonomous agents', ru: 'Автономные агенты', w: { reasoning: 0.7, math: 0.3, coding: 1.2, agentic: 2.5, multimodal: 0.2, longcontext: 0.8, writing: 0.1, preference: 0.3 } },
  { id: 'research', icon: '🔬', en: 'Research & analysis', ru: 'Исследования и анализ', w: { reasoning: 2.5, math: 1.4, coding: 0.4, agentic: 0.8, multimodal: 0.3, longcontext: 1.0, writing: 0.7, preference: 0.5 } },
  { id: 'math', icon: '📐', en: 'Mathematics', ru: 'Математика', w: { reasoning: 1.0, math: 3.0, coding: 0.5, agentic: 0.2, multimodal: 0.1, longcontext: 0.2, writing: 0.1, preference: 0.2 } },
  { id: 'chat', icon: '💬', en: 'Chat & writing', ru: 'Общение и тексты', w: { reasoning: 0.8, math: 0.2, coding: 0.2, agentic: 0.2, multimodal: 0.3, longcontext: 0.4, writing: 2.0, preference: 2.0 } },
  { id: 'vision', icon: '👁️', en: 'Images & video', ru: 'Картинки и видео', w: { reasoning: 0.6, math: 0.2, coding: 0.2, agentic: 0.3, multimodal: 3.0, longcontext: 0.3, writing: 0.2, preference: 0.6 } },
  { id: 'bulk', icon: '💸', en: 'Cheap at scale', ru: 'Дёшево и массово', w: { reasoning: 1.0, math: 0.5, coding: 0.8, agentic: 0.6, multimodal: 0.3, longcontext: 0.6, writing: 0.5, preference: 0.8 }, sort: 'value' },
];

/** Attribution block rendered in the footer and the sources panel. */
export const SOURCES = [
  {
    id: 'epoch', name: 'Epoch AI — Benchmarking Hub', url: 'https://epoch.ai/benchmarks',
    license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    en: 'Independently run and curated results for 40+ frontier benchmarks.',
    ru: 'Независимо проведённые и курируемые результаты 40+ фронтир-бенчмарков.',
  },
  {
    id: 'lmarena', name: 'LMArena (Arena.ai)', url: 'https://arena.ai/leaderboard/text',
    license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    en: 'Millions of blind pairwise human votes turned into Elo ratings.',
    ru: 'Миллионы слепых парных голосов людей, сведённые в Elo-рейтинги.',
  },
  {
    id: 'openrouter', name: 'OpenRouter', url: 'https://openrouter.ai/models',
    license: 'Public API', licenseUrl: 'https://openrouter.ai/docs',
    en: 'Live pricing, context windows, modalities and capabilities.',
    ru: 'Актуальные цены, окна контекста, модальности и возможности.',
  },
  {
    id: 'aa', name: 'Artificial Analysis', url: 'https://artificialanalysis.ai/',
    license: 'Data API', licenseUrl: 'https://artificialanalysis.ai/data-api',
    en: 'Intelligence Index plus measured throughput and latency.',
    ru: 'Intelligence Index плюс измеренные скорость и задержка.',
  },
];
