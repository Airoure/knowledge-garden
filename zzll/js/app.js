/* ============================================================
 * 政治理论学习营 · 应用逻辑
 * 分专题学习 + 背诵卡片（SRS 间隔重复）+ 选择题巩固 + 速查表
 * ============================================================ */
(function () {
  'use strict';

  const view = document.getElementById('view');
  const CHAPS = window.ZZ_CHAPTERS;
  const CARDS = window.ZZ_CARDS;
  const SHEETS = window.ZZ_SHEETS;
  const GEN = window.ZZ_QGEN;
  const chapById = (id) => CHAPS.find((c) => c.id === id);
  const chapName = (id) => (chapById(id) || {}).name || id;

  /* ── 存储 ─────────────────────────────────────────────── */
  const KEY = 'zzll-v1';
  let store;
  try { store = JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { store = null; }
  if (!store || !store.srs) {
    store = { chapters: {}, exams: [], srs: {}, settings: {} };
  }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} };
  const chapStats = (id) => store.chapters[id] || (store.chapters[id] = { started: false, practiced: 0, right: 0, total: 0, best: 0 });
  const cardId = (c) => `${c.ch}::${c.q}`;

  /* SRS 调度：等级 0-5，答对按 1/2/4/8/16/32 天间隔推进 */
  const INTERVALS = [1, 2, 4, 8, 16, 32];
  const DAY = 24 * 3600 * 1000;
  const srsState = (id) => store.srs[id];
  const isDue = (c) => {
    const s = srsState(cardId(c));
    return s && s.due <= Date.now();
  };
  const isNew = (c) => !srsState(cardId(c));
  const isMastered = (c) => {
    const s = srsState(cardId(c));
    return s && s.lv >= 4;
  };
  function grade(id, g) {
    const s = srsState(id) || { lv: 0 };
    if (g === 'no') store.srs[id] = { lv: 0, due: Date.now() + 10 * 60 * 1000 };
    else if (g === 'mid') store.srs[id] = { lv: Math.max(s.lv, 1), due: Date.now() + 1 * DAY };
    else {
      const lv = Math.min((s.lv || 0) + 1, 6);
      store.srs[id] = { lv, due: Date.now() + INTERVALS[Math.min(lv - 1, 5)] * DAY };
    }
    save();
  }

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
   * 选择题练习引擎
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
    quiz = { cfg, list, idx: 0, answers: [], streak: 0, answered: false, qStart: 0, tInt: 0, autoT: 0, examStart: cfg.mode === 'exam' ? performance.now() : 0 };
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
    const opts = q.options.map((o, i) => ({ ...o, i }));
    const examChip = isExam ? `<span class="chip timer" id="tcum">⏱ 0:00</span><span class="chip" id="tpace">配速 —</span>` : '';
    const autoChip = !isExam ? `<button class="chip btnlike" data-act="toggle-auto" style="cursor:pointer">自动下一题：${store.settings.autoNext ? '开' : '关'}</button>` : '';

    view.innerHTML = `
      <div class="qtop">
        <span class="chip type">${q.typeName}</span>
        <span class="chip ${lvlCls}">${isExam ? '真题难度' : quiz.cfg.level === 'warm' ? '巩固' : '实战'}</span>
        <span class="chip timer" id="tcur">0.0s</span>
        ${examChip}
        <span class="sp"></span>
        ${quiz.streak >= 2 ? `<span class="chip flame">🔥×${quiz.streak}</span>` : ''}
        ${autoChip}
        <button class="chip btnlike" data-act="quit" style="cursor:pointer">✕ 退出</button>
      </div>
      <div class="prog-track"><i style="width:${quiz.idx / quiz.list.length * 100}%"></i></div>
      <div class="qcard" id="qcard">
        <div class="q-stem">${q.stem}</div>
        <div class="opts">${opts.map((o) => `
          <button class="opt" data-i="${o.i}"><span class="k">${o.k}</span><span class="t">${esc(o.text)}</span></button>`).join('')}</div>
        <div id="afeed"></div>
      </div>
      <div class="nextbar" id="nextbar" hidden>
        <button class="btn primary" data-act="next">${quiz.idx + 1 >= quiz.list.length ? '查看成绩 →' : '下一题 →'}</button>
      </div>
      <div class="kbd-hint">键盘：<kbd>1</kbd>–<kbd>4</kbd> / <kbd>A</kbd>–<kbd>D</kbd> 选择 · 答题后 <kbd>Enter</kbd> 下一题</div>`;

    quiz.tInt = setInterval(() => {
      const el = (performance.now() - quiz.qStart) / 1000;
      const t = document.getElementById('tcur');
      if (t) t.textContent = el.toFixed(1) + 's';
      if (isExam) {
        const cum = (performance.now() - quiz.examStart) / 1000;
        const c = document.getElementById('tcum');
        if (c) c.textContent = `⏱ ${Math.floor(cum / 60)}:${String(Math.floor(cum % 60)).padStart(2, '0')}`;
        const pace = document.getElementById('tpace');
        if (pace) {
          const expect = (quiz.idx + el / 90) * 40;
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
      const st = chapStats(quiz.cfg.courseId);
      st.started = true; st.total++;
      if (ok) st.right++;
      save();
    }
    if (!ok && q.cardId) {
      grade(q.cardId, 'no');           // 做错的考点自动进入今日复习
    }

    const card = document.getElementById('qcard');
    card.classList.add('answered');
    card.querySelectorAll('.opt').forEach((b, bi) => {
      b.disabled = true;
      if (bi === q.ansIdx) b.classList.add('right');
      else if (bi === i) b.classList.add('wrong');
      else b.classList.add('dim');
    });
    document.getElementById('afeed').innerHTML = `
      <div class="analysis">
        <div class="verdict ${ok ? 'ok' : 'no'}">${ok ? '✓ 答对了' : '✗ 答错了'}
          <span class="used">用时 ${dur.toFixed(1)} 秒</span></div>
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

    if (cfg.mode === 'exam') {
      store.exams.push({ at: Date.now(), pct, dur: totalTime, count: answers.length });
      if (store.exams.length > 20) store.exams = store.exams.slice(-20);
      save();
    } else if (cfg.courseId) {
      const st = chapStats(cfg.courseId);
      st.practiced++;
      st.best = Math.max(st.best, Math.round(pct * 100));
      save();
    }

    view.innerHTML = `
      <div class="score-wrap">
        <h2>${cfg.mode === 'exam' ? '综合模考成绩' : '本组练习完成'}</h2>
        <div class="sub">${cfg.title || ''} · 共 ${answers.length} 题</div>
        <div class="ring-wrap">${ringSvg(pct, 150)}
          <div class="rv"><b style="color:${ringColor(pct)}">${Math.round(pct * 100)}<span style="font-size:16px">%</span></b>
          <span>正确率</span></div></div>
        <div class="sub">${pct >= .9 ? '🔥 非常扎实！' : pct >= .7 ? '👍 主干已经立住，错题进复习队列了。' : '📖 建议先过一遍专题讲义，再用背卡巩固。'}</div>
      </div>
      <div class="sgrid">
        <div class="cell"><b>${right}<span style="font-size:13px;color:var(--mut)">/${answers.length}</span></b><span>答对题数</span></div>
        <div class="cell"><b>${fmtSec(totalTime)}</b><span>总用时</span></div>
        <div class="cell"><b>${(totalTime / answers.length).toFixed(1)}s</b><span>平均每题</span></div>
        <div class="cell"><b>${Object.keys(store.srs).length}</b><span>复习库卡片</span></div>
      </div>
      <div class="sec-title">逐题回顾</div>
      <div class="rev">${answers.map((a, i) => revItem(a, i)).join('')}</div>
      <div class="nextbar" style="justify-content:center; margin-top:26px">
        <button class="btn ghost" data-act="nav" data-h="${cfg.courseId ? '#/c/' + cfg.courseId : '#/'}">回到${cfg.courseId ? '本章' : '首页'}</button>
        <button class="btn primary" data-act="again">再来一组</button>
      </div>`;
    quiz.finished = true;
  }

  function revItem(a, i) {
    const q = a.q;
    return `<details class="${a.ok ? '' : 'was-wrong'}">
      <summary><span class="mark ${a.ok ? 'ok' : 'no'}">${a.ok ? '✓' : '✗'}</span>
        第 ${i + 1} 题 · ${esc(q.typeName)}<span class="who">${a.dur.toFixed(1)}s</span></summary>
      <div class="rbody">
        <div class="yap">正确答案：<span class="ok-c">${esc(q.options[q.ansIdx].text)}</span>
          ${a.ok ? '' : `　你的答案：<span class="no-c">${esc(q.options[a.pick].text)}</span>`}</div>
        <div>${q.analysis}</div>
      </div></details>`;
  }

  /* ══════════════════════════════════════════════════════
   * SRS 背诵引擎
   * ══════════════════════════════════════════════════════ */
  let review = null;

  function startReview(chFilter) {
    let queue;
    if (chFilter) {
      const cards = CARDS.filter((c) => c.ch === chFilter);
      queue = [...cards.filter((c) => isDue(c)), ...cards.filter(isNew), ...cards.filter((c) => !isDue(c) && !isNew(c))].slice(0, 12);
    } else {
      queue = [...CARDS.filter(isDue), ...CARDS.filter(isNew).slice(0, 15)];
    }
    if (queue.length === 0) { renderReviewDone(); return; }
    review = { queue, idx: 0, grades: [], revealed: false, chFilter };
    renderReview();
  }

  function renderReview() {
    const c = review.queue[review.idx];
    const s = srsState(cardId(c));
    review.revealed = false;
    view.innerHTML = `
      <div class="qtop">
        <span class="chip type">${chapName(c.ch)}</span>
        <span class="chip">${s ? `第 ${s.lv + 1} 次复习` : '新卡片'}</span>
        <span class="sp"></span>
        <button class="chip btnlike" data-act="quit-review" style="cursor:pointer">✕ 结束</button>
      </div>
      <div class="prog-track"><i style="width:${review.idx / review.queue.length * 100}%"></i></div>
      <div class="qcard flash" id="flash">
        <div class="f-tag">背诵卡片 ${review.idx + 1} / ${review.queue.length}　·　想好答案再翻面</div>
        <div class="f-q">${esc(c.q)}</div>
        <div id="f-back" style="display:none">
          <div class="f-a">${esc(c.a)}</div>
          ${c.tip ? `<div class="f-tip">${esc(c.tip)}</div>` : ''}
        </div>
      </div>
      <div id="gradebar-wrap"><button class="btn primary" data-act="show-answer" style="display:block;margin:0 auto">👁 显示答案</button></div>
      <div class="kbd-hint">键盘：<kbd>Enter</kbd>/<kbd>空格</kbd> 翻面 · 翻面后 <kbd>1</kbd> 忘了 <kbd>2</kbd> 模糊 <kbd>3</kbd> 记住了</div>`;
  }

  function reveal() {
    if (!review || review.revealed) return;
    review.revealed = true;
    document.getElementById('f-back').style.display = 'block';
    document.getElementById('gradebar-wrap').innerHTML = `
      <div class="gradebar">
        <button class="btn g-no" data-act="grade" data-g="no">😰 忘了（1）</button>
        <button class="btn g-mid" data-act="grade" data-g="mid">🤔 模糊（2）</button>
        <button class="btn g-ok" data-act="grade" data-g="ok">😄 记住了（3）</button>
      </div>`;
    document.querySelector('.gradebar')?.scrollIntoView?.({ block: 'nearest' });
  }

  function doGrade(g) {
    if (!review || !review.revealed) return;
    const c = review.queue[review.idx];
    grade(cardId(c), g);
    review.grades.push(g);
    review.idx++;
    if (review.idx >= review.queue.length) renderReviewDone();
    else renderReview();
  }

  function renderReviewDone() {
    const g = review ? review.grades : [];
    const okN = g.filter((x) => x === 'ok').length;
    const noN = g.filter((x) => x === 'no').length;
    view.innerHTML = `
      <div class="score-wrap">
        <h2>✅ 本轮复习完成</h2>
        <div class="sub">共复习 ${g.length} 张卡片</div>
        <div class="sgrid" style="max-width:520px;margin:24px auto">
          <div class="cell"><b>${okN}</b><span>记住了</span></div>
          <div class="cell"><b>${g.filter((x) => x === 'mid').length}</b><span>模糊</span></div>
          <div class="cell"><b>${noN}</b><span>忘了</span></div>
          <div class="cell"><b>${CARDS.filter(isMastered).length}</b><span>已掌握</span></div>
        </div>
        <div class="sub">按遗忘曲线安排：忘了的今天稍后会再次出现，"记住了"的卡片按 1/2/4/8/16/32 天的间隔迎接下一轮复习。</div>
      </div>
      <div class="nextbar" style="justify-content:center; margin-top:26px">
        <button class="btn ghost" data-act="nav" data-h="#/">回首页</button>
        <button class="btn primary" data-act="nav" data-h="#/review">继续复习 →</button>
      </div>`;
    if (review) { review.finished = true; }
  }

  /* ══════════════════════════════════════════════════════
   * 视图：首页
   * ══════════════════════════════════════════════════════ */
  function renderHome() {
    const dueN = CARDS.filter(isDue).length;
    const newN = CARDS.filter(isNew).length;
    const mastered = CARDS.filter(isMastered).length;

    const rows = CHAPS.map((c) => {
      const cards = CARDS.filter((x) => x.ch === c.id);
      const mas = cards.filter(isMastered).length;
      const st = store.chapters[c.id];
      const p = st && st.total ? Math.round(st.right / st.total * 100) : null;
      return `<div class="ch-row" data-act="nav" data-h="#/c/${c.id}">
        <div class="ic">${c.icon}</div>
        <div>
          <div class="tt"><span class="no">${c.no}</span>${c.name}</div>
          <div class="ds">${c.oneLiner}</div>
          <div class="badges">${(c.tags || []).map((t) => `<span class="badge ${t === '重中之重' ? 'hot' : ''}">${t}</span>`).join('')}
            <span class="badge">${cards.length} 张卡片</span></div>
          <div class="mastery-bar"><i style="width:${cards.length ? Math.round(mas / cards.length * 100) : 0}%"></i></div>
        </div>
        <div class="meta">${p != null ? `<div class="pct">${p}%</div><div>已练 ${st.total} 题</div>` : ''}<div>掌握 ${mas}/${cards.length}</div></div>
        <div class="arr">→</div>
      </div>`;
    }).join('');

    view.innerHTML = `
      <div class="hero">
        <h1>政治理论，<span class="grad">背得下才是分</span>。</h1>
        <p>六大专题 × 考点卡片库 —— 按遗忘曲线安排背诵，选择题即时巩固，速查表考前抱佛脚。</p>
      </div>
      <div class="ov-card">
        <div class="ov-ring">${ringSvg(CARDS.length ? mastered / CARDS.length : 0, 84)}
          <div class="v" style="color:${mastered ? ringColor(mastered / CARDS.length) : 'var(--mut)'}">${Math.round(mastered / CARDS.length * 100)}%</div></div>
        <div class="ov-mid">
          <div class="t">今日背诵任务</div>
          <div class="s">待复习 <b>${dueN}</b> 张 · 新卡片 <b>${newN}</b> 张 · 已掌握 <b>${mastered}</b> / ${CARDS.length} 张</div>
          <div class="bars">${CHAPS.map((c) => {
            const cards = CARDS.filter((x) => x.ch === c.id);
            const m = cards.filter(isMastered).length;
            return `<i title="${c.name}" style="--pct:${cards.length ? m / cards.length : 0}"></i>`;
          }).join('')}</div>
        </div>
        <a class="cta-exam" href="#/review" data-act="nav" data-h="#/review">🔁 开始今日复习<small>忘了的先来，新卡跟上</small></a>
      </div>
      <div class="sec-title">专题学习</div>
      <div class="chapters">${rows}</div>
      <div class="sec-title">巩固与速查</div>
      <div class="chapters">
        <div class="ch-row" data-act="nav" data-h="#/exam">
          <div class="ic">🎯</div>
          <div><div class="tt">选择题模考</div><div class="ds">全部专题混合出题 · 做错的考点自动进入今日复习队列</div></div>
          <div class="meta"></div><div class="arr">→</div>
        </div>
        <div class="ch-row" data-act="nav" data-h="#/cards">
          <div class="ic">📇</div>
          <div><div class="tt">速查表</div><div class="ds">党代会速查 · 数字考点 · 灵魂精髓 · 主要矛盾演变</div></div>
          <div class="meta"></div><div class="arr">→</div>
        </div>
      </div>
      <p class="mini" style="margin-top:24px;text-align:center">内容依据公开权威教材与文件表述整理，仅供备考学习；如与最新官方文件表述有出入，以最新文件为准。</p>`;
  }

  /* ══════════════════════════════════════════════════════
   * 视图：专题页
   * ══════════════════════════════════════════════════════ */
  function renderChapter(id) {
    const c = chapById(id);
    if (!c) { location.hash = '#/'; return; }
    chapStats(id).started = true; save();
    const cards = CARDS.filter((x) => x.ch === id);
    const mas = cards.filter(isMastered).length;
    const st = store.chapters[id];

    view.innerHTML = `
      <div class="crumbs" data-act="nav" data-h="#/">← 返回专题列表</div>
      <div class="ch-head"><span class="no">${c.no}</span><h1>${c.icon} ${c.name}</h1></div>
      <div class="ch-oneline">${c.oneLiner}　<span class="mini">预计 ${c.minutes} 分钟 · ${cards.length} 张考点卡片</span></div>

      <div class="sec"><h2>专题讲义</h2>${c.intro}</div>
      <div class="sec"><h2>核心要点</h2>
        <div class="steps-box"><ol style="margin:0">${c.keyPoints.map((s) => `<li>${s}</li>`).join('')}</ol></div></div>

      <div class="sec"><h2>考点卡片（点击展开）</h2>
        <div class="cardlist">${cards.map((x, i) => `
          <details><summary><span class="qid">${String(i + 1).padStart(2, '0')}</span>${esc(x.q)}</summary>
            <div class="a-line">${esc(x.a)}</div>
            ${x.tip ? `<div class="tip-line">${esc(x.tip)}</div>` : ''}</details>`).join('')}</div></div>

      <div class="sec"><h2>巩固练习</h2>
        <div class="steps-box" style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">
          <button class="btn primary" data-act="practice" data-l="real">▶ 选择题实战 · 8 题</button>
          <button class="btn" data-act="practice" data-l="warm">▸ 巩固模式 · 干扰项更温和</button>
          <button class="btn ghost" data-act="chapter-review">🔁 本专题卡片背诵</button>
          <span class="mini">${st && st.practiced ? `本章已练 ${st.practiced} 组 · 最佳 ${st.best}% · 累计 ${st.right}/${st.total}` : `已掌握 ${mas}/${cards.length} 张——先通读讲义，再用卡片和选择题巩固。`}</span>
        </div></div>`;
  }

  /* ══════════════════════════════════════════════════════
   * 视图：模考说明 / 速查表
   * ══════════════════════════════════════════════════════ */
  function renderExamIntro() {
    const past = store.exams.slice(-5).reverse();
    view.innerHTML = `
      <div class="crumbs" data-act="nav" data-h="#/">← 返回专题列表</div>
      <div class="ch-head"><h1>🎯 选择题模考</h1></div>
      <div class="ch-oneline">六大专题混合出题 · 干扰项取自同一专题的相近表述 · 做错的考点自动进入今日复习</div>
      <div class="sec"><div class="steps-box">
        <p style="margin-bottom:10px"><b>规则</b>：共 10 题，覆盖全部专题，约 40 秒/题。政治理论选择题拼的就是<b>表述的精确度</b>——干扰项往往只差几个字。</p>
        <button class="btn primary" data-act="exam-start" style="width:100%;padding:13px">开始模考 →</button>
      </div></div>
      ${past.length ? `<div class="sec"><h2>历史成绩</h2><div class="ktable">${past.map((e) =>
        `<div class="kcell"><span class="mini">${fmtDate(e.at)}</span>
         <span style="color:${ringColor(e.pct)};font-weight:700">${Math.round(e.pct * 100)}%</span></div>`).join('')}</div></div>` : ''}`;
  }

  let cardsTab = 0;
  function renderCards() {
    const sheet = SHEETS[cardsTab] || SHEETS[0];
    view.innerHTML = `
      <div class="crumbs" data-act="nav" data-h="#/">← 返回专题列表</div>
      <div class="ch-head"><h1>📇 速查表</h1></div>
      <div class="tabs">${SHEETS.map((s, i) =>
        `<button class="btn small ${i === cardsTab ? 'active' : ''}" data-act="cards-tab" data-t="${i}">${s.tab}</button>`).join('')}</div>
      <div class="ktable" style="grid-template-columns:1fr">${sheet.rows.map((r) =>
        `<div class="kcell" style="justify-content:space-between;gap:16px">
           <span class="f" style="font-family:inherit;color:var(--tx2)">${r[0]}</span>
           <span class="p" style="color:#7dd3fc;font-weight:700;text-align:right">${r[1]}</span></div>`).join('')}</div>
      <p class="mini" style="margin-top:18px">考前把这几张表各过两遍，比临时抱佛脚刷手机管用。</p>`;
  }

  /* ══════════════════════════════════════════════════════
   * 路由与事件
   * ══════════════════════════════════════════════════════ */
  function route() {
    stopQuizTimers();
    review = null;
    const h = location.hash || '#/';
    if (h === '#/' || h === '#') renderHome();
    else if (h.startsWith('#/c/')) renderChapter(h.slice(4));
    else if (h === '#/review') startReview();
    else if (h === '#/exam') renderExamIntro();
    else if (h === '#/cards') renderCards();
    else renderHome();
    window.scrollTo(0, 0);
  }

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
    if (act === 'practice') {
      const id = location.hash.slice(4);
      startQuiz({
        courseId: id, level: t.dataset.l,
        pool: [{ id: 'mcq', hint: id }], count: 8, mode: 'practice',
        title: `${chapName(id)}`,
      });
      return;
    }
    if (act === 'exam-start') {
      startQuiz({
        courseId: null, level: 'real',
        pool: GEN.EXAM_POOL, count: window.EXAM_CFG.count, mode: 'exam', title: '综合模考',
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
    if (act === 'chapter-review') { startReview(location.hash.slice(4)); return; }
    if (act === 'show-answer') { reveal(); return; }
    if (act === 'grade') { doGrade(t.dataset.g); return; }
    if (act === 'quit-review') {
      // 已有评分记录则展示本轮总结，否则回首页
      if (review && review.grades && review.grades.length) renderReviewDone();
      else location.hash = '#/';
      return;
    }

    if (!quiz || quiz.finished) return;
    if (act === 'next') { next(); return; }
  });

  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('.opt');
    if (b && quiz && !quiz.answered && !quiz.finished) choose(Number(b.dataset.i));
  });

  document.addEventListener('keydown', (ev) => {
    if (review && !review.finished) {
      if (!review.revealed && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); reveal(); return; }
      if (review.revealed && /^[1-3]$/.test(ev.key)) { ev.preventDefault(); doGrade(['no', 'mid', 'ok'][Number(ev.key) - 1]); return; }
      return;
    }
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
