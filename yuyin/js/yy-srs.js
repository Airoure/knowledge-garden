/* ============================================================
 * 言语理解方法营 · SM-2 间隔重复引擎
 * ------------------------------------------------------------
 * 调度规则（SuperMemo-2 变体，三档自评）：
 *   忘记 again → 重置轮次，10 分钟后本场重现，EF −0.20
 *   模糊 hard  → 保持轮次，间隔 ×1.2（最低 1 天），EF −0.15
 *   认识 good  → 轮次 +1，间隔按 1 → 6 → 上次×EF 递推，EF +0.05
 * EF 下限 1.3。state 记录 n / ef / ivl（天）/ due（时间戳）。
 * 每日配额：复习不限量（到期的都要清），新学默认 10 条。
 * 进度存 localStorage（yy-srs-v1），与练习进度（yy-v1）互不干扰。
 * ============================================================ */
(function () {
  'use strict';

  const KEY = 'yy-srs-v1';
  const DAY = 86400000;
  const DEFAULT_NEW_PER_DAY = 10;
  const AGAIN_MINUTES = 10;
  const MIN_EF = 1.3;
  const MAX_IVL = 365;                                   // 间隔上限（天）：SM-2 是几何增长，
                                                         // 不封顶会在几十次「认识」后溢出成 Infinity/NaN
  const MAX_TS = 8640000000000000;                       // JS Date 可表示的最大时间戳

  /* 数值净化：任何非法输入一律回落到默认值，杜绝 NaN 污染调度 */
  function num(v, fallback) {
    return (typeof v === 'number' && isFinite(v)) ? v : fallback;
  }
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  /* ── 日期工具（按自然日计算，避免跨天误判）── */
  function startOfDay(ts) {
    const d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  const dayKey = (ts) => {
    const d = new Date(ts);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };
  const isDue = (st, now) => !!st && !!st.state && st.state.due <= now;

  /* ── 存储 ── */
  let store = null;
  let available = true;

  function blank() {
    return {
      v: 1,
      states: {},                                        // cardId → { state, seen, wrong, last }
      daily: { date: dayKey(Date.now()), newLearned: 0, reviews: 0 },
      settings: { newPerDay: DEFAULT_NEW_PER_DAY },
      days: [],                                          // 最近 30 天学习记录
    };
  }

  function load() {
    store = blank();
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.states && parsed.daily) {
          store = parsed;
          store.settings = Object.assign({ newPerDay: DEFAULT_NEW_PER_DAY }, store.settings);
          store.days = Array.isArray(store.days) ? store.days : [];
          // 净化历史存档：旧版本可能残留 null / NaN 的 due（溢出的卡会永久不到期）
          const now0 = Date.now();
          Object.keys(store.states).forEach((id) => {
            const rec = store.states[id];
            if (!rec || typeof rec !== 'object' || !rec.state) { delete store.states[id]; return; }
            rec.state = saneState(rec.state, now0);
            rec.seen = Math.max(0, Math.floor(num(rec.seen, 0)));
            rec.wrong = Math.max(0, Math.floor(num(rec.wrong, 0)));
            rec.last = num(rec.last, 0);
          });
        }
      }
    } catch (e) {
      available = false;                                 // 隐私模式等场景降级为内存态
    }
    rollDay(Date.now(), false);
    return store;
  }

  function save() {
    if (!available) return;
    try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { available = false; }
  }

  /* 跨自然日则重置当日配额，并把昨日成绩压入历史 */
  function rollDay(now, persist) {
    const today = dayKey(now);
    if (store.daily.date === today) return false;
    const prev = store.daily;
    if (prev.newLearned > 0 || prev.reviews > 0) {
      store.days.push({ date: prev.date, learned: prev.newLearned, reviews: prev.reviews });
      if (store.days.length > 30) store.days = store.days.slice(-30);
    }
    store.daily = { date: today, newLearned: 0, reviews: 0 };
    if (persist !== false) save();
    return true;
  }

  /* ── SM-2 核心 ── */
  /* 把任意（含被污染的）状态规整为合法值，防止 NaN / Infinity 在调度里传播 */
  function saneState(s, now) {
    return {
      n: Math.max(0, Math.floor(num(s && s.n, 0))),
      ef: clamp(num(s && s.ef, 2.5), MIN_EF, 3.0),
      ivl: clamp(num(s && s.ivl, 0), 0, MAX_IVL),
      due: num(s && s.due, now),
    };
  }

  function nextState(prevState, rating, now) {
    const prev = saneState(prevState, now);
    let n = prev.n;
    let ef = prev.ef;
    let ivl;                                             // 单位：天

    if (rating === 'again') {
      n = 0;
      ef = Math.max(MIN_EF, ef - 0.20);
      ivl = AGAIN_MINUTES / (60 * 24);                   // 约 10 分钟，本场内重现
    } else if (rating === 'hard') {
      n = Math.max(1, n);
      ef = Math.max(MIN_EF, ef - 0.15);
      ivl = prev.ivl ? clamp(prev.ivl * 1.2, 1, MAX_IVL) : 1;
    } else {                                             // good
      n = n + 1;
      ef = Math.min(3.0, ef + 0.05);
      if (n === 1) ivl = 1;
      else if (n === 2) ivl = 6;
      else ivl = clamp(Math.round(prev.ivl * ef) || 6, 1, MAX_IVL);
    }

    // 到期时间落在自然日边界上：当天任意时刻学习，次日零点起即视为到期。
    // 这样「今日待复习」的语义才稳定，也不受夏令时导致的 23/25 小时日影响。
    let due = ivl >= 1
      ? startOfDay(now + Math.round(ivl) * DAY)
      : now + ivl * DAY;
    if (!isFinite(due) || due > MAX_TS) due = startOfDay(now + MAX_IVL * DAY);
    if (due < now) due = now;                            // 兜底：不允许落在过去

    return { n, ef: Math.round(ef * 1000) / 1000, ivl, due };
  }

  /* ── 队列构建 ── */
  function selectQueue(now) {
    const all = window.YY_DECK || [];
    const due = [];
    const fresh = [];
    const scheduled = [];                                // 已学且尚未到期
    let learnedTotal = 0;                                // 累计学过（含今日到期的），用于进度

    all.forEach((card) => {
      const st = store.states[card.id];
      const hasState = !!(st && st.state);
      if (hasState) learnedTotal++;
      if (isDue(st, now)) due.push(card);
      else if (hasState) scheduled.push(card);
      else fresh.push(card);
    });

    // 到期的先按到期时间排序（欠得最久的先还）
    due.sort((a, b) => store.states[a.id].state.due - store.states[b.id].state.due);

    // 新学按固定洗牌顺序发放，保证同一批内不重复、跨天推进
    const seeded = seededShuffle(fresh, store.daily.date);
    const quota = store.settings.newPerDay;
    const newToday = seeded.slice(0, Math.max(0, quota - store.daily.newLearned));

    return {
      queue: due.concat(newToday),
      dueCount: due.length,
      newCount: newToday.length,
      newRemaining: Math.max(0, quota - store.daily.newLearned),
      scheduledCount: scheduled.length,
      learnedTotal,
      freshCount: fresh.length,
    };
  }

  /* 以字符串为种子的确定性洗牌（mulberry32），同一天顺序稳定 */
  function seededShuffle(arr, seedStr) {
    let h = 2166136261;
    for (let i = 0; i < seedStr.length; i++) { h ^= seedStr.charCodeAt(i); h = Math.imul(h, 16777619); }
    const rand = () => {
      h = Math.imul(h ^ (h >>> 15), 1 | h);
      h = (h + Math.imul(h ^ (h >>> 7), 61 | h)) ^ h;
      return ((h ^ (h >>> 14)) >>> 0) / 4294967296;
    };
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* ── 对外接口 ── */
  const SRS = {
    load,
    save,
    dayKey,
    startOfDay,
    isDue,

    get store() { return store; },
    get available() { return available; },

    /** 今日看板数据 */
    overview(now) {
      const t = now || Date.now();
      rollDay(t, true);
      const q = selectQueue(t);
      return {
        date: store.daily.date,
        dueCount: q.dueCount,
        newCount: q.newCount,
        newRemaining: q.newRemaining,
        newPerDay: store.settings.newPerDay,
        learnedCount: q.learnedTotal,                    // 累计学过（进度条口径）
        scheduledCount: q.scheduledCount,                // 已学且未到期（记忆库存量）
        freshCount: q.freshCount,
        total: (window.YY_DECK || []).length,
        newLearnedToday: store.daily.newLearned,
        reviewsToday: store.daily.reviews,
        pendingTotal: q.dueCount + q.newCount,
        progress: Math.round(q.learnedTotal / Math.max(1, (window.YY_DECK || []).length) * 100),
        streak: SRS.streak(t),
      };
    },

    /** 取今日学习队列（卡片数组，含 isNew 标记） */
    session(now) {
      const t = now || Date.now();
      rollDay(t, true);
      const q = selectQueue(t);
      return q.queue.map((card) => ({
        card,
        isNew: !store.states[card.id] || !store.states[card.id].state,
      }));
    },

    /** 提交一次自评；返回该卡的新状态 */
    grade(cardId, rating, now) {
      const t = now || Date.now();
      rollDay(t, true);
      const st = store.states[cardId] || { state: null, seen: 0, wrong: 0, last: 0 };
      const wasNew = !st.state;
      st.state = nextState(st.state, rating, t);
      st.seen = (st.seen || 0) + 1;
      st.last = t;
      if (rating === 'again') st.wrong = (st.wrong || 0) + 1;
      store.states[cardId] = st;

      if (wasNew) store.daily.newLearned += 1;
      else if (rating !== 'again') store.daily.reviews += 1;

      save();
      return st.state;
    },

    /** 单卡状态（供 UI 展示） */
    cardState(cardId) { return store.states[cardId] || null; },

    /** 某天内到期的数量（用于未来 7 天预测） */
    forecast(now, days) {
      const t = startOfDay(now || Date.now());
      const out = [];
      for (let i = 0; i < (days || 7); i++) {
        const from = t + i * DAY, to = from + DAY;
        let n = 0;
        Object.keys(store.states).forEach((id) => {
          const s = store.states[id].state;
          if (s && s.due >= from && s.due < to) n++;
        });
        out.push({ from, count: n });
      }
      return out;
    },

    /** 连续学习天数 */
    streak(now) {
      const t = startOfDay(now || Date.now());
      const active = {};
      store.days.forEach((d) => { if (d.learned > 0 || d.reviews > 0) active[d.date] = true; });
      if (store.daily.newLearned > 0 || store.daily.reviews > 0) active[store.daily.date] = true;
      let n = 0;
      for (let i = 0; i < 400; i++) {
        if (active[dayKey(t - i * DAY)]) n++;
        else if (i > 0) break;                            // 今天还没学不打断连续记录
        else if (!active[dayKey(t)]) continue;
      }
      return n;
    },

    /** 重置全部记忆进度（危险操作，需二次确认） */
    resetAll() {
      store = blank();
      save();
      return store;
    },

    /** 只重置某张卡 */
    resetCard(cardId) {
      delete store.states[cardId];
      save();
    },

    setNewPerDay(n) {
      const v = Math.max(0, Math.min(100, Math.floor(Number(n) || 0)));
      store.settings.newPerDay = v;
      save();
      return v;
    },
  };

  load();
  window.YY_SRS = SRS;
})();
