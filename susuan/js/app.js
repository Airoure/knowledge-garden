/* ============================================================
 * 公考速算训练营 · 应用逻辑
 * hash 路由 / 课程渲染 / 练习引擎 / 进度存储（localStorage）
 * ============================================================ */
(function () {
  'use strict';

  const view = document.getElementById('view');
  const COURSES = window.COURSES || [];
  const GEN = window.SUSUAN_QGEN;
  const courseById = (id) => COURSES.find((c) => c.id === id);

  /* ── 存储 ─────────────────────────────────────────────── */
  const KEY = 'susuan-v1';
  let store;
  try { store = JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { store = null; }
  if (!store || !store.chapters) {
    store = { chapters: {}, exams: [], wrong: [], cards: { h: { s: 0, r: 0 }, p: { s: 0, r: 0 } }, settings: { autoNext: true } };
  }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} };
  const chapterStats = (id) => store.chapters[id] || (store.chapters[id] = { started: false, practiced: 0, right: 0, total: 0, best: 0 });

  /* ── 工具 ─────────────────────────────────────────────── */
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const stripHtml = (h) => String(h || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const fmtDate = (ts) => new Date(ts).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  const fmtSec = (s) => s >= 60 ? `${Math.floor(s / 60)}分${Math.round(s % 60)}秒` : `${s.toFixed(1)}秒`;
  const ringColor = (p) => p >= .8 ? '#34d399' : p >= .6 ? '#38bdf8' : p >= .4 ? '#fbbf24' : '#f87171';
  function ringSvg(p, size) {
    const r = (size - 10) / 2, C = 2 * Math.PI * r;
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="#22304f" stroke-width="8"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${ringColor(p)}"
        stroke-width="8" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - Math.max(0, Math.min(1, p)))}"/>
    </svg>`;
  }
  function weightedPick(pool) {
    const total = pool.reduce((a, e) => a + (e.w || 1), 0);
    let x = Math.random() * total;
    for (const e of pool) { x -= (e.w || 1); if (x <= 0) return e; }
    return pool[pool.length - 1];
  }

  /* ══════════════════════════════════════════════════════
   * 练习引擎
   * ══════════════════════════════════════════════════════ */
  let quiz = null;

  function stopQuizTimers() {
    if (!quiz) return;
    clearInterval(quiz.tInt);
    clearTimeout(quiz.autoT);
    quiz = null;
  }

  function startQuiz(cfg) {
    // cfg: {courseId, level('warm'|'real'), pool, count, mode('practice'|'exam'|'flash'), flashKind, title}
    const list = [];
    const seen = new Set();
    // 同一组练习内避免重复出同一道题（题库上限不足时才允许重复，如自测 10 题 / 20 个平方数）
    const keyOf = (q) => `${q.typeId}|${stripHtml(q.stem)}|${(q.options || []).map((o) => o.text || o.htmlF || '').join(',')}`;
    for (let i = 0; i < cfg.count; i++) {
      const entry = weightedPick(cfg.pool);
      let q = GEN.gen(entry.id, cfg.level, entry.hint), key = keyOf(q), tries = 0;
      while (seen.has(key) && tries++ < 40) {
        q = GEN.gen(entry.id, cfg.level, entry.hint);
        key = keyOf(q);
      }
      seen.add(key);
      list.push(q);
    }
    stopQuizTimers();
    quiz = {
      cfg, list, idx: 0, answers: [], streak: 0, answered: false,
      qStart: 0, tInt: 0, autoT: 0, examStart: cfg.mode === 'exam' ? performance.now() : 0,
    };
    renderQuiz();
  }

  function quizOptionHtml(o, big) {
    const inner = o.htmlF ? `<span class="t frac-t">${o.htmlF}</span>` : `<span class="t">${esc(o.text)}</span>`;
    return `<button class="opt${big ? ' big' : ''}" data-i="${o.i}">
      <span class="k">${o.k}</span>${inner}</button>`;
  }

  function renderQuiz() {
    const q = quiz.list[quiz.idx];
    quiz.answered = false;
    clearInterval(quiz.tInt);
    clearTimeout(quiz.autoT);
    quiz.qStart = performance.now();

    const isFlash = quiz.cfg.mode === 'flash';
    const isExam = quiz.cfg.mode === 'exam';
    const lvlCls = quiz.cfg.level === 'warm' ? 'lvl-warm' : 'lvl-real';
    const lvlTxt = quiz.cfg.level === 'warm' ? '巩固' : '实战';
    const opts = q.options.map((o, i) => ({ ...o, i }));
    const big = q.typeId === 'bijiao.pair';

    const examChip = isExam
      ? `<span class="chip timer" id="tcum">⏱ 0:00</span><span class="chip" id="tpace">配速 —</span>`
      : '';
    const autoChip = (!isFlash && !isExam)
      ? `<button class="chip btnlike" data-act="toggle-auto" style="cursor:pointer">自动下一题：${store.settings.autoNext ? '开' : '关'}</button>`
      : '';

    view.innerHTML = `
      <div class="qtop">
        ${isFlash ? '' : `<span class="chip type">${q.typeName}</span>`}
        ${isFlash ? '' : `<span class="chip ${lvlCls}">${isExam ? '真题难度' : lvlTxt}</span>`}
        <span class="chip timer" id="tcur">0.0s</span>
        ${examChip}
        <span class="sp"></span>
        ${quiz.streak >= 2 ? `<span class="chip flame">🔥×${quiz.streak}</span>` : ''}
        ${autoChip}
        <button class="chip btnlike" data-act="quit" style="cursor:pointer">✕ 退出</button>
      </div>
      <div class="prog-track"><i style="width:${(quiz.idx) / quiz.list.length * 100}%"></i></div>
      <div class="qcard" id="qcard">
        <div class="q-stem">${q.stem}</div>
        ${q.exprHtml ? `<div class="expr">${q.exprHtml}</div>` : ''}
        <div class="opts">${opts.map((o) => quizOptionHtml(o, big)).join('')}</div>
        <div id="afeed"></div>
      </div>
      <div class="nextbar" id="nextbar" hidden>
        ${isFlash ? '' : `<button class="btn primary" data-act="next">${quiz.idx + 1 >= quiz.list.length ? '查看成绩 →' : '下一题 →'}</button>`}
      </div>
      ${isFlash ? '' : `<div class="kbd-hint">键盘：<kbd>1</kbd>–<kbd>4</kbd> / <kbd>A</kbd>–<kbd>D</kbd> 选择 · 答题后 <kbd>Enter</kbd> 下一题</div>`}
    `;

    // 计时器
    quiz.tInt = setInterval(() => {
      const el = (performance.now() - quiz.qStart) / 1000;
      const t = document.getElementById('tcur');
      if (t) t.textContent = el.toFixed(1) + 's';
      if (isExam) {
        const cum = (performance.now() - quiz.examStart) / 1000;
        const c = document.getElementById('tcum');
        const pace = document.getElementById('tpace');
        const mm = Math.floor(cum / 60), ss = Math.floor(cum % 60);
        if (c) c.textContent = `⏱ ${mm}:${String(ss).padStart(2, '0')}`;
        if (pace) {
          const expect = (quiz.idx + el / 90) * 66;      // 真题平均 66 秒/题
          const ratio = cum / Math.max(expect, 1);
          pace.textContent = ratio < .9 ? '配速领先' : ratio < 1.2 ? '配速正常' : '配速落后';
          pace.className = 'chip ' + (ratio < .9 ? 'pace-ok' : ratio < 1.2 ? 'pace-warn' : 'pace-bad');
        }
      }
    }, 100);
  }

  function choose(i) {
    if (!quiz || quiz.answered) return;
    quiz.answered = true;
    clearInterval(quiz.tInt);
    const q = quiz.list[quiz.idx];
    const ok = i === q.ansIdx;
    const dur = (performance.now() - quiz.qStart) / 1000;
    quiz.answers.push({ q, pick: i, ok, dur });
    quiz.streak = ok ? quiz.streak + 1 : 0;

    // 记录
    if (quiz.cfg.mode === 'flash') {
      const c = quiz.cfg.flashKind === 'huhuan' ? store.cards.h : store.cards.p;
      c.s++; if (ok) c.r++;
      save();
    } else if (quiz.cfg.courseId) {
      const st = chapterStats(quiz.cfg.courseId);
      st.started = true; st.total++;
      if (ok) st.right++;
      save();
    }
    if (!ok && quiz.cfg.mode !== 'flash') {
      store.wrong.push({
        at: Date.now(), typeId: q.typeId, typeName: q.typeName,
        stem: stripHtml(q.stem).slice(0, 160),
        correct: String(q.options[q.ansIdx].text ?? '见解析'),
        yours: String(q.options[i].text ?? '—'),
        analysis: q.analysis,
      });
      if (store.wrong.length > 60) store.wrong = store.wrong.slice(-60);
      save();
    }

    // 界面反馈
    const card = document.getElementById('qcard');
    card.classList.add('answered');
    const btns = card.querySelectorAll('.opt');
    btns.forEach((b, bi) => {
      b.disabled = true;
      if (bi === q.ansIdx) b.classList.add('right');
      else if (bi === i) b.classList.add('wrong');
      else b.classList.add('dim');
    });
    const durTxt = dur < 5 ? `用时 ${dur.toFixed(1)} 秒 ⚡` : dur > 66 ? `用时 ${fmtSec(dur)}（真题节奏约 66 秒/题）` : `用时 ${dur.toFixed(1)} 秒`;
    document.getElementById('afeed').innerHTML = `
      <div class="analysis">
        <div class="verdict ${ok ? 'ok' : 'no'}">${ok ? '✓ 答对了' : '✗ 答错了'}
          <span class="used">${durTxt}</span></div>
        <div class="body">${q.analysis}</div>
      </div>`;
    document.getElementById('nextbar').hidden = false;

    if (quiz.cfg.mode === 'flash') {
      quiz.autoT = setTimeout(next, 1050);
    } else if (quiz.cfg.mode === 'practice' && store.settings.autoNext) {
      quiz.autoT = setTimeout(next, ok ? 900 : 3200);
    }
  }

  function next() {
    if (!quiz) return;
    quiz.idx++;
    if (quiz.idx >= quiz.list.length) finishQuiz();
    else renderQuiz();
  }

  function finishQuiz() {
    clearInterval(quiz.tInt);
    clearTimeout(quiz.autoT);
    const cfg = quiz.cfg, answers = quiz.answers;
    const right = answers.filter((a) => a.ok).length;
    const pct = answers.length ? right / answers.length : 0;
    const totalTime = answers.reduce((a, b) => a + b.dur, 0);
    const bestStreak = (() => {
      let m = 0, c = 0;
      answers.forEach((a) => { c = a.ok ? c + 1 : 0; m = Math.max(m, c); });
      return m;
    })();

    if (cfg.mode === 'exam') {
      store.exams.push({ at: Date.now(), pct, dur: totalTime, count: answers.length });
      if (store.exams.length > 20) store.exams = store.exams.slice(-20);
      save();
    } else if (cfg.mode === 'practice' && cfg.courseId) {
      const st = chapterStats(cfg.courseId);
      st.practiced++;
      st.best = Math.max(st.best, Math.round(pct * 100));
      save();
    }

    // 分题型小结（模考用）
    const byType = {};
    answers.forEach((a) => {
      const k = a.q.typeName;
      byType[k] = byType[k] || { r: 0, t: 0, dur: 0 };
      byType[k].t++; byType[k].dur += a.dur;
      if (a.ok) byType[k].r++;
    });

    const course = cfg.courseId ? courseById(cfg.courseId) : null;
    const backLabel = course ? '回到本章' : '回首页';
    const backHash = course ? `#/c/${course.id}` : '#/';

    view.innerHTML = `
      <div class="score-wrap">
        <h2>${cfg.mode === 'exam' ? '综合模考成绩' : isFlash(cfg) ? '自测完成' : '本组练习完成'}</h2>
        <div class="sub">${cfg.title || ''} · 共 ${answers.length} 题</div>
        <div class="ring-wrap">${ringSvg(pct, 150)}
          <div class="rv"><b style="color:${ringColor(pct)}">${Math.round(pct * 100)}<span style="font-size:16px">%</span></b>
          <span>正确率</span></div>
        </div>
        <div class="sub">${pct >= .9 ? '🔥 稳了，这就是考场手感！' : pct >= .7 ? '👍 不错的准确率，把错题的技巧再看一眼。' :
        pct >= .5 ? '💪 方法已经入门，正确率需要再练几组固化。' : '📖 建议先回到上文把「例题解析」过一遍，再来练习。'}</div>
      </div>
      <div class="sgrid">
        <div class="cell"><b>${right}<span style="font-size:13px;color:var(--mut)">/${answers.length}</span></b><span>答对题数</span></div>
        <div class="cell"><b>${fmtSec(totalTime)}</b><span>总用时</span></div>
        <div class="cell"><b>${(totalTime / answers.length).toFixed(1)}s</b><span>平均每题</span></div>
        <div class="cell"><b>${bestStreak}</b><span>最长连对</span></div>
      </div>
      ${cfg.mode === 'exam' ? examTypeTable(byType) : ''}
      <div class="sec-title">逐题回顾</div>
      <div class="rev">${answers.map((a, i) => revItem(a, i)).join('')}</div>
      <div class="nextbar" style="justify-content:center; margin-top:26px">
        <button class="btn ghost" data-act="nav" data-h="${backHash}">${backLabel}</button>
        <button class="btn primary" data-act="again">再来一组</button>
      </div>
    `;
    quiz.finished = true;
    function isFlash(c) { return c.mode === 'flash'; }
  }

  function examTypeTable(byType) {
    const rows = Object.entries(byType).map(([k, v]) =>
      `<div class="kcell"><span style="font-family:inherit">${k}</span>
       <span class="${v.r === v.t ? 'p' : ''}" style="color:${v.r === v.t ? 'var(--good)' : 'var(--warn)'};font-weight:700">
       ${v.r}/${v.t} · 均${(v.dur / v.t).toFixed(0)}s</span></div>`).join('');
    return `<div class="sec"><h2>分题型战绩</h2><div class="ktable">${rows}</div></div>`;
  }

  function revItem(a, i) {
    const q = a.q;
    const yours = q.options[a.pick] ? (q.options[a.pick].text ?? '—') : '—';
    const corr = q.options[q.ansIdx].text ?? '';
    return `<details class="${a.ok ? '' : 'was-wrong'}">
      <summary><span class="mark ${a.ok ? 'ok' : 'no'}">${a.ok ? '✓' : '✗'}</span>
        第 ${i + 1} 题 · ${esc(q.typeName)}
        <span class="who">${a.dur.toFixed(1)}s</span></summary>
      <div class="rbody">
        <div class="yap">你的答案：<span class="${a.ok ? 'ok-c' : 'no-c'}">${esc(yours)}</span>
          ${a.ok ? '' : `　正确答案：<span class="ok-c">${esc(corr)}</span>`}</div>
        <div>${q.analysis}</div>
      </div>
    </details>`;
  }

  /* ══════════════════════════════════════════════════════
   * 视图：首页
   * ══════════════════════════════════════════════════════ */
  function renderHome() {
    let seen = 0, right = 0;
    const pcts = COURSES.map((c) => {
      const st = store.chapters[c.id];
      const p = st && st.total ? st.right / st.total : -1;
      if (p >= 0) { seen += st.total; right += st.right; }
      return p;
    });
    const overall = seen ? right / seen : 0;
    const bars = COURSES.map((c, i) =>
      `<i title="${c.name} ${pcts[i] >= 0 ? Math.round(pcts[i] * 100) + '%' : ''}" style="--pct:${pcts[i] >= 0 ? pcts[i] : 0}"></i>`).join('');

    const rows = COURSES.map((c) => {
      const st = store.chapters[c.id];
      const p = st && st.total ? Math.round(st.right / st.total * 100) : null;
      const passed = st && st.best >= 80;
      return `<div class="ch-row" data-act="nav" data-h="#/c/${c.id}">
        <div class="ic">${c.icon}</div>
        <div>
          <div class="tt"><span class="no">${c.no}</span>${c.name}</div>
          <div class="ds">${c.oneLiner}</div>
          <div class="badges">${(c.tags || []).map((t) => `<span class="badge ${t === '必考' || t === '必背' || t === '必学' ? 'hot' : ''}">${t}</span>`).join('')}
            ${passed ? '<span class="badge ok">✓ 已通过</span>' : ''}</div>
        </div>
        <div class="meta">${p != null ? `<div class="pct">${p}%</div><div>已练 ${st.total} 题</div>` : st && st.started ? '<div>已阅读</div>' : '<div>未开始</div>'}</div>
        <div class="arr">→</div>
      </div>`;
    }).join('');

    view.innerHTML = `
      <div class="hero">
        <h1>先学方法，再上强度。</h1>
        <p>行测资料分析速算方法九章 —— 直除、百化分、格尺、增长、比重、尾数、比较、年均：每章讲透原理、拆解例题，再配真题难度的题库实战。</p>
      </div>
      <div class="ov-card">
        <div class="ov-ring">${ringSvg(overall, 84)}<div class="v" style="color:${seen ? ringColor(overall) : 'var(--mut)'}">${seen ? Math.round(overall * 100) + '%' : '—'}</div></div>
        <div class="ov-mid">
          <div class="t">训练总览</div>
          <div class="s">${seen ? `已练 <b>${seen}</b> 题，答对 <b>${right}</b> 题` : '从第一章「直除法」开始，它是一切技巧的地基'}${store.wrong.length ? ` · 错题 <b>${store.wrong.length}</b> 道（<a href="#/wrong">回顾</a>）` : ''}</div>
          <div class="bars">${bars}</div>
        </div>
        <a class="cta-exam" href="#/exam" data-act="nav" data-h="#/exam">🎯 综合模考<small>10 题混编 · 真题难度 · 建议 11 分钟</small></a>
      </div>
      <div class="sec-title">方法课程</div>
      <div class="chapters">${rows}</div>
      <div class="sec-title">辅助工具</div>
      <div class="chapters">
        <div class="ch-row" data-act="nav" data-h="#/cards">
          <div class="ic">📇</div>
          <div><div class="tt">速记卡 · 百化分 & 平方数</div><div class="ds">对照表 + 限时自测，把秒杀表刻进肌肉记忆</div></div>
          <div class="meta"></div><div class="arr">→</div>
        </div>
        <div class="ch-row" data-act="nav" data-h="#/wrong">
          <div class="ic">🩹</div>
          <div><div class="tt">错题回顾</div><div class="ds">最近答错的题都在这里，附完整解析${store.wrong.length ? `（${store.wrong.length} 道）` : '（暂无）'}</div></div>
          <div class="meta"></div><div class="arr">→</div>
        </div>
      </div>`;
  }

  /* ══════════════════════════════════════════════════════
   * 视图：章节
   * ══════════════════════════════════════════════════════ */
  function renderChapter(id) {
    const c = courseById(id);
    if (!c) { location.hash = '#/'; return; }
    chapterStats(id).started = true; save();

    const demos = (c.demos || []).map((d, di) => `
      <div class="demo">
        <div class="d-head"><span class="d-title">${d.title}</span>
          <button class="btn small ghost" data-act="sol" data-t="sol-${di}">展开解析 ▾</button></div>
        <div class="d-stem">${d.stem}</div>
        ${d.opts ? `<div class="d-opts">${d.opts.map((o) => o.startsWith(d.ans + '.') ? `<span class="hit">${o}</span>` : `<span>${o}</span>`).join('')}</div>` : ''}
        <div class="sol" id="sol-${di}">${d.steps.map((s) => `<div class="s-line">${s}</div>`).join('')}
          <div class="s-line" style="color:var(--good);font-weight:700">答案：${d.ans}</div></div>
      </div>`).join('');

    const keyTable = c.keyTable ? `
      <div class="sec"><h2>核心对照表（先背 1～2 档）</h2>
        <div class="tier-label">第一档 · 必背</div>
        <div class="ktable">${KTABLE.filter((e) => e.tier === 1).map(kcell).join('')}</div>
        <div class="tier-label">第二档 · 拉开差距</div>
        <div class="ktable">${KTABLE.filter((e) => e.tier === 2).map(kcell).join('')}</div>
        <div class="tier-label">第三档 · 学有余力</div>
        <div class="ktable">${KTABLE.filter((e) => e.tier === 3).map(kcell).join('')}</div>
      </div>` : '';

    const st = store.chapters[id];

    view.innerHTML = `
      <div class="crumbs" data-act="nav" data-h="#/">← 返回课程表</div>
      <div class="ch-head"><span class="no">${c.no}</span><h1>${c.icon} ${c.name}</h1>
        <span class="stars">${'★'.repeat(c.stars)}${'☆'.repeat(3 - c.stars)}</span></div>
      <div class="ch-oneline">${c.oneLiner}　<span class="mini">预计 ${c.minutes} 分钟</span></div>

      <div class="sec"><h2>为什么要学它</h2>${c.why}</div>
      <div class="sec"><h2>操作步骤</h2>
        <div class="steps-box"><ol style="margin:0">${c.steps.map((s) => `<li>${s}</li>`).join('')}</ol></div></div>
      ${keyTable}
      <div class="sec"><h2>例题 · 逐步解析</h2>${demos}
        <p class="mini">先把题自己过一遍，再点「展开解析」对照步骤——每一步都对应上面的方法。</p></div>
      <div class="sec"><h2>易错点 & 防坑清单</h2>
        <div class="pit-box"><ul style="margin:0">${c.pitfalls.map((s) => `<li>${s}</li>`).join('')}</ul></div></div>

      <div class="sec"><h2>开始练习</h2>
        <div class="steps-box" style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">
          <button class="btn primary" data-act="practice" data-l="real">▶ 真题实战 · 8 题</button>
          <button class="btn" data-act="practice" data-l="warm">▸ 巩固模式 · 数字温和些</button>
          <span class="mini">${st && st.practiced ? `本章已练 ${st.practiced} 组 · 最佳正确率 <b style="color:var(--good)">${st.best}%</b> · 累计 ${st.right}/${st.total}` : '完成本章阅读后，先用「巩固模式」找感觉，再切「真题实战」。'}</span>
        </div></div>`;
  }

  const KTABLE = (window.SUSUAN_QGEN && window.SUSUAN_QGEN.FRAC_TABLE) || [];
  const kcell = (e) => `<div class="kcell"><span class="f">${e.f[0]}/${e.f[1]}</span><span class="p">${e.p}</span></div>`;

  /* ══════════════════════════════════════════════════════
   * 视图：模考
   * ══════════════════════════════════════════════════════ */
  function renderExamIntro() {
    const past = store.exams.slice(-5).reverse();
    view.innerHTML = `
      <div class="crumbs" data-act="nav" data-h="#/">← 返回课程表</div>
      <div class="ch-head"><h1>🎯 综合模考</h1></div>
      <div class="ch-oneline">八类题型混编抽题 · 全部按真题难度出题 · 顶部实时配速提示</div>
      <div class="sec"><div class="steps-box">
        <p style="margin-bottom:10px"><b>规则</b>：共 10 题，覆盖直除、基期、增长量、增长率、比重、尾数、比较、年均增长率、格尺乘法。
        真题节奏约 <b>66 秒/题</b>，全程计时但<b>不会强制交卷</b>——关注顶部配速灯，训练自己的时间感。</p>
        <button class="btn primary" data-act="exam-start" style="width:100%;padding:13px">开始模考 →</button>
      </div></div>
      ${past.length ? `<div class="sec"><h2>历史成绩</h2><div class="ktable">${past.map((e) =>
        `<div class="kcell"><span class="mini">${fmtDate(e.at)}</span>
         <span class="p" style="color:${ringColor(e.pct)};font-weight:700">${Math.round(e.pct * 100)}%</span></div>`).join('')}</div></div>` : ''}
      ${store.wrong.length ? `<div class="sec"><p class="mini">💡 提示：你还有 <a href="#/wrong">${store.wrong.length} 道错题</a>没回顾，模考前过一遍解析更有效。</p></div>` : ''}`;
  }

  /* ══════════════════════════════════════════════════════
   * 视图：速记卡
   * ══════════════════════════════════════════════════════ */
  let cardsTab = 'huhuan';
  function renderCards() {
    const tab = cardsTab;
    const isH = tab === 'huhuan';
    const LADDER = window.BAIFENBAI_LADDER || [];
    const tableHtml = isH
      ? `<div class="ladder">
          <div class="ladder-title">巧 记 百 化 分</div>
          ${LADDER.map((z) => `
            <div class="lz lz-${z.color}">
              <div class="lz-col lz-l">${z.left.map(([f, p]) =>
                `<div class="lz-row"><span class="lz-p">${p}</span><span class="lz-dot"></span><span class="lz-f">${f}</span></div>`).join('')}</div>
              <div class="lz-mid"><b>${z.name}</b><span class="lz-note">${z.note}</span></div>
              <div class="lz-col lz-r">${z.right.map(([f, p]) =>
                `<div class="lz-row"><span class="lz-f">${f}</span><span class="lz-dot"></span><span class="lz-p">${p}</span></div>`).join('')}</div>
              ${z.bottom ? `<div class="lz-btm"><span class="lz-dot"></span>${z.bottom[0]} ＝ ${z.bottom[1]}</div>` : ''}
            </div>`).join('')}
          <p class="mini" style="text-align:center;margin-top:10px">记忆主线：蓝区秒懂 → 黄区等差 → 绿区互换 → 红区加和 20。<br>考场上 8%～17% 区间（红、绿、黄三区）出现频率最高。</p>
        </div>`
      : `<div class="tier-label">11 ～ 30 的平方（考公必背区间，资料分析开方估算常用）</div>
         <div class="sq-table">${Array.from({ length: 20 }, (_, i) => {
           const n = i + 11;
           return `<div class="kcell"><span class="f">${n}</span><span class="p">${n * n}</span></div>`;
         }).join('')}</div>`;
    const cs = isH ? store.cards.h : store.cards.p;
    const testBtns = isH
      ? `<button class="btn primary" data-act="st-start" data-l="warm">▸ 基础自测</button>
         <button class="btn" data-act="st-start" data-l="real">▸ 全表自测（含第三档）</button>`
      : `<button class="btn primary" data-act="st-start" data-l="warm">▸ 开始自测 · 11～30（20 个平方数）</button>`;
    const desc = isH
      ? '连答 10 题，每题自动跳下一道。目标是条件反射：<b>看到百分数就想到分数</b>。'
      : '连答 10 题，每题自动跳下一道。目标是条件反射：<b>看到底数就报出平方</b>。每次抽题不重复。';
    view.innerHTML = `
      <div class="crumbs" data-act="nav" data-h="#/">← 返回课程表</div>
      <div class="ch-head"><h1>📇 速记卡</h1></div>
      <div class="tabs">
        <button class="btn small ${isH ? 'active' : ''}" data-act="cards-tab" data-t="huhuan">百分 ↔ 分数</button>
        <button class="btn small ${!isH ? 'active' : ''}" data-act="cards-tab" data-t="pingfang">平方数</button>
      </div>
      ${tableHtml}
      <div class="selftest">
        <h3>⚡ 限时自测</h3>
        <div class="desc">${desc}
          历史成绩：${cs.s ? `答对 ${cs.r}/${cs.s}（${Math.round(cs.r / cs.s * 100)}%）` : '暂无'}</div>
        <div id="st-box">${testBtns}</div>
      </div>`;
  }

  /* ══════════════════════════════════════════════════════
   * 视图：错题本
   * ══════════════════════════════════════════════════════ */
  function renderWrong() {
    const list = store.wrong.slice().reverse();
    view.innerHTML = `
      <div class="crumbs" data-act="nav" data-h="#/">← 返回课程表</div>
      <div class="ch-head"><h1>🩹 错题回顾</h1>
        ${list.length ? '<button class="btn small danger" data-act="wrong-clear" style="margin-left:auto">清空全部</button>' : ''}</div>
      ${list.length
        ? `<div class="wrong-list">${list.map((w) => `
          <details class="wrong-item"><summary style="cursor:pointer;list-style:none">
            <span class="w-when">${fmtDate(w.at)}</span> · <span class="chip type" style="font-size:11px">${esc(w.typeName)}</span>
            <div class="mini" style="margin-top:4px">${esc(w.stem).slice(0, 90)}…</div></summary>
            <div class="w-mid">你的答案：${esc(w.yours)} ｜ 正确答案：${esc(w.correct)}</div>
            <div class="mini">${w.analysis}</div>
          </details>`).join('')}</div>`
        : `<div class="steps-box" style="text-align:center;padding:40px">
             <p style="font-size:15px">还没有错题记录 🎉<br><span class="mini">去<a href="#/">开始练习</a>，错题会自动收进这里（最多保留 60 道）。</span></p>
           </div>`}`;
  }

  /* ══════════════════════════════════════════════════════
   * 路由
   * ══════════════════════════════════════════════════════ */
  function route() {
    stopQuizTimers();
    const h = location.hash || '#/';
    if (h === '#/' || h === '#') renderHome();
    else if (h.startsWith('#/c/')) renderChapter(h.slice(4));
    else if (h === '#/exam') renderExamIntro();
    else if (h === '#/cards') renderCards();
    else if (h === '#/wrong') renderWrong();
    else renderHome();
    window.scrollTo(0, 0);
  }

  /* ── 事件委托 ─────────────────────────────────────────── */
  document.addEventListener('click', (ev) => {
    const t = ev.target.closest('[data-act]');
    if (!t) return;
    const act = t.dataset.act;

    if (act === 'nav') {
      const h = t.dataset.h;
      // 目标与当前 hash 相同时 hashchange 不会触发，直接重渲染
      if (location.hash === h) route();
      else location.hash = h;
      return;
    }
    if (act === 'sol') {
      const sol = document.getElementById(t.dataset.t);
      sol.classList.toggle('open');
      t.textContent = sol.classList.contains('open') ? '收起解析 ▴' : '展开解析 ▾';
      return;
    }
    if (act === 'practice') {
      const id = location.hash.slice(4);
      const c = courseById(id);
      startQuiz({
        courseId: id, level: t.dataset.l,
        pool: c.practice.pool, count: 8, mode: 'practice',
        title: `${c.no} ${c.name}`,
      });
      return;
    }
    if (act === 'exam-start') {
      startQuiz({
        courseId: null, level: 'real',
        pool: GEN.EXAM_POOL.map(([id, w]) => ({ id, w })),
        count: window.EXAM_CFG.count, mode: 'exam', title: '综合模考',
      });
      return;
    }
    if (act === 'st-start') {
      startQuiz({
        courseId: null, level: t.dataset.l,
        pool: [{ id: cardsTab }], count: 10, mode: 'flash', flashKind: cardsTab,
        title: cardsTab === 'huhuan' ? '百分↔分数自测' : '平方数自测',
      });
      return;
    }
    if (act === 'cards-tab') { cardsTab = t.dataset.t; renderCards(); return; }
    if (act === 'toggle-auto') {
      store.settings.autoNext = !store.settings.autoNext; save();
      t.textContent = `自动下一题：${store.settings.autoNext ? '开' : '关'}`;
      return;
    }
    if (act === 'quit') {
      // 回到来源页（直接重渲染，避免 hash 未变化不触发路由）
      stopQuizTimers();
      const h = location.hash || '#/';
      if (h.startsWith('#/c/')) renderChapter(h.slice(4));
      else if (h === '#/cards') renderCards();
      else if (h === '#/exam') renderExamIntro();
      else renderHome();
      return;
    }
    if (act === 'wrong-clear') {
      store.wrong = []; save(); renderWrong(); return;
    }

    // 练习中
    if (!quiz || quiz.finished) return;
    if (act === 'next') { next(); return; }
    if (act === 'opt-pick') choose(Number(t.dataset.i));
  });

  // 选项点击（.opt 没有 data-act，用子委托）
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('.opt');
    if (b && quiz && !quiz.answered && !quiz.finished) choose(Number(b.dataset.i));
  });

  // 键盘
  document.addEventListener('keydown', (ev) => {
    if (!quiz || quiz.finished) return;
    const q = quiz.list[quiz.idx];
    if (!quiz.answered) {
      const k = ev.key.toLowerCase();
      let i = -1;
      if (/^[1-9]$/.test(k)) i = Number(k) - 1;
      else if (/^[a-d]$/.test(k)) i = k.charCodeAt(0) - 97;
      if (i >= 0 && i < q.options.length) { ev.preventDefault(); choose(i); }
    } else if (ev.key === 'Enter' || ev.key.toLowerCase() === 'n') {
      if (quiz.cfg.mode !== 'flash') { ev.preventDefault(); next(); }
    }
  });

  window.addEventListener('hashchange', route);
  route();
})();
