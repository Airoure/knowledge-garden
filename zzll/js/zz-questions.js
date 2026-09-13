/* ============================================================
 * 政治理论学习营 · 出题引擎（基于考点卡片库生成选择题）
 * 实战档：同专题干扰项（最具迷惑性）；巩固档：混入跨专题干扰项
 * ============================================================ */
(function () {
  'use strict';

  const CHAPS = window.ZZ_CHAPTERS;
  const CARDS = window.ZZ_CARDS;

  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  function genMcq(level, hint) {
    const pool = hint ? CARDS.filter((c) => c.ch === hint) : CARDS;
    const hit = pick(pool);
    const correct = hit.a;
    const chName = (CHAPS.find((c) => c.id === hit.ch) || {}).name || hit.ch;

    // 干扰项：实战档全部取同专题答案（表述相近最具迷惑性）；巩固档混入跨专题
    const sameCh = [...new Set(pool.filter((c) => c !== hit && c.a !== correct).map((c) => c.a))];
    const otherCh = [...new Set(CARDS.filter((c) => c.ch !== hit.ch && c.a !== correct).map((c) => c.a))];
    let texts;
    if (level === 'real' || sameCh.length >= 3) {
      texts = shuffle(sameCh).slice(0, 3);
      let g = 0;
      while (texts.length < 3 && g++ < 20) {
        const t = pick(otherCh);
        if (!texts.includes(t)) texts.push(t);
      }
    } else {
      texts = shuffle(sameCh).slice(0, 1)
        .concat(shuffle(otherCh).slice(0, 2));
      texts = [...new Set(texts)].slice(0, 3);
    }
    while (texts.length < 3) texts.push(`以上都不对（${texts.length}）`);

    const opts = shuffle([{ text: correct, isAns: true }, ...texts.map((t) => ({ text: t, isAns: false }))]);
    opts.forEach((o, i) => { o.k = 'ABCD'[i]; });
    const ansIdx = opts.findIndex((o) => o.isAns);

    return {
      typeId: 'mcq.' + hit.ch, typeName: chName + ' · 选择', level,
      stem: `${hit.q}（　　）`,
      cardId: `${hit.ch}::${hit.q}`,
      exprHtml: null,
      options: opts, ansIdx,
      analysis: `<b class="num key">${hit.a}</b>。<br><span class="mini">${hit.tip}</span><br>
        <em>本题出自「${chName}」专题——做错的同学把该专题的考点卡片加入今日复习，三天后再遇见就认识了。</em>`,
      tip: '',
    };
  }

  window.ZZ_QGEN = {
    gen(id, level, hint) {
      if (id !== 'mcq') throw new Error('unknown generator: ' + id);
      let q = genMcq(level, hint), guard = 0;
      while (guard++ < 8) {
        const bad =
          new Set(q.options.map((o) => o.text)).size !== 4 ||
          q.ansIdx < 0 || q.ansIdx >= 4 ||
          String(q.stem + q.analysis).includes('undefined');
        if (!bad) break;
        q = genMcq(level, hint);
      }
      return q;
    },
    EXAM_POOL: CHAPS.map((c) => ({ id: 'mcq', hint: c.id, w: 16 })),
  };
})();
