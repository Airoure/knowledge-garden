/* ============================================================
 * 数量关系方法营 · 应用逻辑（与速算训练营同框架）
 * hash 路由 / 课程渲染 / 练习引擎 / 进度存储（localStorage）
 * ============================================================ */
(function () {
  'use strict';

  const view = document.getElementById('view');
  const COURSES = window.COURSES || [];
  const GEN = window.YY_GEN;
  const SHEETS = window.TIP_SHEETS || [];
  const courseById = (id) => COURSES.find((c) => c.id === id);

  /* ── 存储 ─────────────────────────────────────────────── */
  const KEY = 'yy-v1';
  let store;
  try { store = JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { store = null; }
  if (!store || !store.chapters) {
    store = { chapters: {}, exams: [], wrong: [], settings: { autoNext: true } };
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
    const list = [];
    for (let i = 0; i < cfg.count; i++) {
      const entry = weightedPick(cfg.pool);
      list.push(GEN.gen(entry.id, cfg.level, entry.hint));
    }
    stopQuizTimers();
    quiz = {
      cfg, list, idx: 0, answers: [], streak: 0, answered: false,
      qStart: 0, tInt: 0, autoT: 0, examStart: cfg.mode === 'exam' ? performance.now() : 0,
    };
    renderQuiz();
  }

  function renderQuiz() {
    const q = quiz.list[quiz.idx];
    quiz.answered = false;
    clearInterval(quiz.tInt);
    clearTimeout(quiz.autoT);
    quiz.qStart = performance.now();

    const isExam = quiz.cfg.mode === 'exam';
    const lvlCls = quiz.cfg.level === 'warm' ? 'lvl-warm' : 'lvl-real';
    const lvlTxt = quiz.cfg.level === 'warm' ? '巩固' : '实战';
    const opts = q.options.map((o, i) => ({ ...o, i }));

    const examChip = isExam
      ? `<span class="chip timer" id="tcum">⏱ 0:00</span><span class="chip" id="tpace">配速 —</span>`
      : '';
    const autoChip = (!isExam)
      ? `<button class="chip btnlike" data-act="toggle-auto" style="cursor:pointer">自动下一题：${store.settings.autoNext ? '开' : '关'}</button>`
      : '';

    view.innerHTML = `
      <div class="qtop">
        <span class="chip type">${q.typeName}</span>
        <span class="chip ${lvlCls}">${isExam ? '真题难度' : lvlTxt}</span>
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
        <div class="opts">${opts.map((o) => `
          <button class="opt" data-i="${o.i}"><span class="k">${o.k}</span>${o.html
            ? `<span class="t svg-t">${o.html}</span>`
            : `<span class="t">${esc(o.text)}</span>`}</button>`).join('')}
        </div>
        <div id="afeed"></div>
      </div>
      <div class="nextbar" id="nextbar" hidden>
        <button class="btn primary" data-act="next">${quiz.idx + 1 >= quiz.list.length ? '查看成绩 →' : '下一题 →'}</button>
      </div>
      <div class="kbd-hint">键盘：<kbd>1</kbd>–<kbd>4</kbd> / <kbd>A</kbd>–<kbd>D</kbd> 选择 · 答题后 <kbd>Enter</kbd> 下一题</div>
    `;

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
          const expect = (quiz.idx + el / 90) * 50;      // 言语理解约 50 秒/题
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

    if (quiz.cfg.courseId) {
      const st = chapterStats(quiz.cfg.courseId);
      st.started = true; st.total++;
      if (ok) st.right++;
      save();
    }
    if (!ok) {
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

    const card = document.getElementById('qcard');
    card.classList.add('answered');
    const btns = card.querySelectorAll('.opt');
    btns.forEach((b, bi) => {
      b.disabled = true;
      if (bi === q.ansIdx) b.classList.add('right');
      else if (bi === i) b.classList.add('wrong');
      else b.classList.add('dim');
    });
    const durTxt = dur < 20 ? `用时 ${dur.toFixed(1)} 秒` : dur > 50 ? `用时 ${fmtSec(dur)}（言语理解建议 50 秒/题内解决，纠结就先标记跳过）` : `用时 ${dur.toFixed(1)} 秒`;
    document.getElementById('afeed').innerHTML = `
      <div class="analysis">
        <div class="verdict ${ok ? 'ok' : 'no'}">${ok ? '✓ 答对了' : '✗ 答错了'}
          <span class="used">${durTxt}</span></div>
        <div class="body">${q.analysis}</div>
      </div>`;
    document.getElementById('nextbar').hidden = false;

    if (quiz.cfg.mode === 'practice' && store.settings.autoNext) {
      quiz.autoT = setTimeout(next, ok ? 1200 : 3600);
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
        <h2>${cfg.mode === 'exam' ? '综合模考成绩' : '本组练习完成'}</h2>
        <div class="sub">${cfg.title || ''} · 共 ${answers.length} 题</div>
        <div class="ring-wrap">${ringSvg(pct, 150)}
          <div class="rv"><b style="color:${ringColor(pct)}">${Math.round(pct * 100)}<span style="font-size:16px">%</span></b>
          <span>正确率</span></div>
        </div>
        <div class="sub">${pct >= .9 ? '🔥 这个正确率上考场很能打！' : pct >= .7 ? '👍 方法对了，把错题的坑再看一眼。' :
        pct >= .5 ? '💪 题型认得出来吗？先回例题解析巩固套路。' : '📖 建议回上文把「操作步骤」和「例题解析」过一遍再练。'}</div>
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
  }

  function examTypeTable(byType) {
    const rows = Object.entries(byType).map(([k, v]) =>
      `<div class="kcell"><span style="font-family:inherit">${k}</span>
       <span style="color:${v.r === v.t ? 'var(--good)' : 'var(--warn)'};font-weight:700">
       ${v.r}/${v.t} · 均${(v.dur / v.t).toFixed(0)}s</span></div>`).join('');
    return `<div class="sec"><h2>分题型战绩</h2><div class="ktable">${rows}</div></div>`;
  }

  function revItem(a, i) {
    const q = a.q;
    const yours = q.options[a.pick] ? q.options[a.pick].text : '—';
    const corr = q.options[q.ansIdx].text;
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
          <div class="badges">${(c.tags || []).map((t) => `<span class="badge ${t === '必考' || t === '必学' ? 'hot' : ''}">${t}</span>`).join('')}
            ${passed ? '<span class="badge ok">✓ 已通过</span>' : ''}</div>
        </div>
        <div class="meta">${p != null ? `<div class="pct">${p}%</div><div>已练 ${st.total} 题</div>` : st && st.started ? '<div>已阅读</div>' : '<div>未开始</div>'}</div>
        <div class="arr">→</div>
      </div>`;
    }).join('');

    view.innerHTML = `
      <div class="hero">
        <h1>言语理解，<span class="grad">读结构、抓重心</span>。</h1>
        <p>行测言语理解与表达六章方法课 —— 逻辑填空、主旨概括、意图细节、语句排序与语句填空，每章讲透套路，配「巩固 / 真题」两档练习。</p>
      </div>
      <div class="ov-card">
        <div class="ov-ring">${ringSvg(overall, 84)}<div class="v" style="color:${seen ? ringColor(overall) : 'var(--mut)'}">${seen ? Math.round(overall * 100) + '%' : '—'}</div></div>
        <div class="ov-mid">
          <div class="t">训练总览</div>
          <div class="s">${seen ? `已练 <b>${seen}</b> 题，答对 <b>${right}</b> 题` : '从第一章「关联词与语境分析」开始——读懂行文脉络，答案就在作者的态度里'}${store.wrong.length ? ` · 错题 <b>${store.wrong.length}</b> 道（<a href="#/wrong">回顾</a>）` : ''}</div>
          <div class="bars">${bars}</div>
        </div>
        <a class="cta-exam" href="#/exam" data-act="nav" data-h="#/exam">🎯 综合模考<small>10 题混编 · 真题难度 · 建议 9 分钟</small></a>
      </div>
      <div class="sec-title">方法课程</div>
      <div class="chapters">${rows}</div>
      <div class="sec-title">辅助工具</div>
      <div class="chapters">
        <div class="ch-row" data-act="nav" data-h="#/cards">
          <div class="ic">📇</div>
          <div><div class="tt">技巧速查卡</div><div class="ds">关联词标志词、常错词义辨析、主旨结构模型、细节陷阱清单、排序三步法——考前最后过一遍</div></div>
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

    const st = store.chapters[id];

    view.innerHTML = `
      <div class="crumbs" data-act="nav" data-h="#/">← 返回课程表</div>
      <div class="ch-head"><span class="no">${c.no}</span><h1>${c.icon} ${c.name}</h1>
        <span class="stars">${'★'.repeat(c.stars)}${'☆'.repeat(3 - c.stars)}</span></div>
      <div class="ch-oneline">${c.oneLiner}　<span class="mini">预计 ${c.minutes} 分钟</span></div>

      <div class="sec"><h2>为什么要学它</h2>${c.why}</div>
      <div class="sec"><h2>操作步骤</h2>
        <div class="steps-box"><ol style="margin:0">${c.steps.map((s) => `<li>${s}</li>`).join('')}</ol></div></div>
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

  /* ══════════════════════════════════════════════════════
   * 视图：模考
   * ══════════════════════════════════════════════════════ */
  function renderExamIntro() {
    const past = store.exams.slice(-5).reverse();
    const mins = Math.round(window.EXAM_CFG.suggestSecs / 60);
    view.innerHTML = `
      <div class="crumbs" data-act="nav" data-h="#/">← 返回课程表</div>
      <div class="ch-head"><h1>🎯 综合模考</h1></div>
      <div class="ch-oneline">八大章节题型混编抽题 · 全部按真题难度出题 · 顶部实时配速提示</div>
      <div class="sec"><div class="steps-box">
        <p style="margin-bottom:10px"><b>规则</b>：共 10 题，覆盖代入排除、方程、赋值、比例、行程、利润、排列组合、几何容斥最值。
        数量关系的考场策略是<b>会做的 60 秒内拿下、不会的果断跳过</b>——关注顶部配速灯，训练自己的取舍感。</p>
        <button class="btn primary" data-act="exam-start" style="width:100%;padding:13px">开始模考 →</button>
      </div></div>
      ${past.length ? `<div class="sec"><h2>历史成绩</h2><div class="ktable">${past.map((e) =>
        `<div class="kcell"><span class="mini">${fmtDate(e.at)}</span>
         <span class="p" style="color:${ringColor(e.pct)};font-weight:700">${Math.round(e.pct * 100)}%</span></div>`).join('')}</div></div>` : ''}
      ${store.wrong.length ? `<div class="sec"><p class="mini">💡 提示：你还有 <a href="#/wrong">${store.wrong.length} 道错题</a>没回顾，模考前过一遍解析更有效。</p></div>` : ''}`;
  }

  /* ══════════════════════════════════════════════════════
   * 视图：公式速查卡
   * ══════════════════════════════════════════════════════ */
  let cardsTab = 0;
  function renderCards() {
    const sheet = SHEETS[cardsTab] || SHEETS[0];
    view.innerHTML = `
      <div class="crumbs" data-act="nav" data-h="#/">← 返回课程表</div>
      <div class="ch-head"><h1>📇 技巧速查卡</h1></div>
      <div class="tabs">${SHEETS.map((s, i) =>
        `<button class="btn small ${i === cardsTab ? 'active' : ''}" data-act="cards-tab" data-t="${i}">${s.tab}</button>`).join('')}</div>
      <div class="ktable" style="grid-template-columns:1fr">${sheet.rows.map((r) =>
        `<div class="kcell" style="justify-content:space-between;gap:16px">
           <span class="f" style="font-family:inherit;color:var(--tx2)">${r[0]}</span>
           <span class="p" style="color:#7dd3fc;font-weight:700">${r[1]}</span></div>`).join('')}</div>
      <p class="mini" style="margin-top:18px">考前 5 分钟把这几张表过一遍，比多刷十道新题更有用。</p>`;
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
    if (act === 'cards-tab') { cardsTab = Number(t.dataset.t); renderCards(); return; }
    if (act === 'toggle-auto') {
      store.settings.autoNext = !store.settings.autoNext; save();
      t.textContent = `自动下一题：${store.settings.autoNext ? '开' : '关'}`;
      return;
    }
    if (act === 'quit') {
      stopQuizTimers();
      const h = location.hash || '#/';
      if (h.startsWith('#/c/')) renderChapter(h.slice(4));
      else if (h === '#/exam') renderExamIntro();
      else renderHome();
      return;
    }
    if (act === 'wrong-clear') {
      store.wrong = []; save(); renderWrong(); return;
    }

    if (!quiz || quiz.finished) return;
    if (act === 'next') { next(); return; }
  });

  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('.opt');
    if (b && quiz && !quiz.answered && !quiz.finished) choose(Number(b.dataset.i));
  });

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
      ev.preventDefault(); next();
    }
  });

  window.addEventListener('hashchange', route);
  route();
})();
