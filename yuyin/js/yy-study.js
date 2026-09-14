/* ============================================================
 * 言语理解方法营 · 每日成语/易混词复习（视图层）
 * ------------------------------------------------------------
 * 依赖：window.YY_DECK（词库）、window.YY_SRS（SM-2 引擎）
 * 入口：#/study        今日看板 + 开始学习
 *       #/study/session 卡片学习流程
 * 交互：点亮卡片翻面 → 三档自评（忘记 / 模糊 / 认识）
 *       评「忘记」的卡 10 分钟后在本场重现，直到清空队列
 * ============================================================ */
(function () {
  'use strict';

  const view = document.getElementById('view');
  const SRS = window.YY_SRS;
  const DECK = window.YY_DECK || [];
  const byId = (id) => DECK.find((c) => c.id === id);

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const TYPE_LABEL = { idiom: '成语', word: '易混词' };
  const TYPE_ICON = { idiom: '🀄', word: '🔤' };

  /* ── 会话状态 ── */
  let session = null;
  let timer = null;

  function clearTimer() { if (timer) { clearInterval(timer); timer = null; } }

  /* ══════════════════════════════════════════════════════
   * 视图一：今日看板
   * ══════════════════════════════════════════════════════ */
  function renderStudy() {
    clearTimer();
    session = null;
    const ov = SRS.overview();
    const meta = window.YY_DECK_META || {};

    const ring = (() => {
      const size = 96, r = (size - 12) / 2, C = 2 * Math.PI * r;
      const p = Math.max(0, Math.min(1, ov.progress / 100));
      return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="#22304f" stroke-width="9"/>
        <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="url(#sg)" stroke-width="9"
          stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - p)}"
          transform="rotate(-90 ${size / 2} ${size / 2})"/>
        <defs><linearGradient id="sg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#38bdf8"/><stop offset="100%" stop-color="#818cf8"/>
        </linearGradient></defs>
      </svg>`;
    })();

    const forecast = SRS.forecast(Date.now(), 7);
    const maxF = Math.max(1, ...forecast.map((f) => f.count));
    const dayName = (ts, i) => {
      if (i === 0) return '今天';
      if (i === 1) return '明天';
      const d = new Date(ts);
      return (d.getMonth() + 1) + '/' + d.getDate();
    };
    const bars = forecast.map((f, i) => `
      <div class="fc-col">
        <div class="fc-bar"><i style="height:${Math.round(f.count / maxF * 100)}%"></i></div>
        <span class="fc-n">${f.count}</span>
        <span class="fc-d">${dayName(f.from, i)}</span>
      </div>`).join('');

    const hasWork = ov.pendingTotal > 0;
    const ctaText = hasWork
      ? `▶ 开始今日学习 · ${ov.dueCount} 复习${ov.newCount ? ` + ${ov.newCount} 新学` : ''}`
      : (ov.freshCount > 0 ? '✓ 今日任务已完成，可继续加练' : `🎉 全部 ${ov.total} 条已进入复习循环`);

    view.innerHTML = `
      <div class="crumbs" data-act="nav" data-h="#/">← 返回课程表</div>
      <div class="ch-head"><h1>📇 每日成语 · 易混词</h1></div>
      <div class="ch-oneline">共 <b>${ov.total}</b> 条高频词条，按 <b>SM-2 间隔重复</b> 调度 —— 到期的先复习，再学当天的新词条。</div>

      <div class="ov-card">
        <div class="ov-ring">${ring}<div class="v">${ov.progress}%</div></div>
        <div class="ov-mid">
          <div class="t">今日任务</div>
          <div class="s">${hasWork
            ? `待复习 <b>${ov.dueCount}</b> 条 · 新学 <b>${ov.newCount}</b> 条　<span class="mini">（今日已复习 ${ov.reviewsToday} 条，已学新词 ${ov.newLearnedToday} 条）</span>`
            : `今日已清空 —— 已复习 <b>${ov.reviewsToday}</b> 条，新学 <b>${ov.newLearnedToday}</b> 条。<span class="mini">明天再来，或点下方「加练」提前学新词条。</span>`}</div>
          <div class="bars">
            <span class="bar-chip">📚 词库 ${ov.total}</span>
            <span class="bar-chip">✅ 已学 ${ov.learnedCount}</span>
            <span class="bar-chip">🔁 到期 ${ov.dueCount}</span>
            <span class="bar-chip">🌱 未学 ${ov.freshCount}</span>
            ${ov.streak > 1 ? `<span class="bar-chip">🔥 连续 ${ov.streak} 天</span>` : ''}
          </div>
        </div>
        <button class="cta-exam" data-act="study-start" ${hasWork ? '' : 'data-extra="1"'}>${ctaText}
          <small>${hasWork ? `约 ${Math.max(1, Math.round(ov.pendingTotal * 0.25))} 分钟 · 三档自评安排复习间隔` : '加练不会打乱复习节奏，只提前发新词条'}</small></button>
      </div>

      <div class="sec-title">未来 7 天复习量</div>
      <div class="forecast">${bars}</div>
      <div class="mini" style="margin-top:8px">间隔按 1 → 6 → 上次×EF 递推，上限 365 天。「忘记」会清零间隔重来，所以柱子会随记忆牢固度逐渐后移。</div>

      <div class="sec-title">学习设置</div>
      <div class="chapters">
        <div class="ch-row" data-act="study-quota" data-d="-5">
          <div class="ic">➖</div>
          <div><div class="tt">减少每日新学</div><div class="ds">当前每天 ${ov.newPerDay} 条 · 调小可减轻负担</div></div>
          <div class="meta"></div><div class="arr">−5</div>
        </div>
        <div class="ch-row" data-act="study-quota" data-d="5">
          <div class="ic">➕</div>
          <div><div class="tt">增加每日新学</div><div class="ds">建议 10~20 条；${ov.total} 条约 ${Math.max(1, Math.round(ov.total / 15))} 天过完一轮</div></div>
          <div class="meta"></div><div class="arr">+5</div>
        </div>
        <div class="ch-row" data-act="study-preview" data-g="__all__">
          <div class="ic">📖</div>
          <div><div class="tt">词库总览</div><div class="ds">按分类查看全部 ${ov.total} 条，可直接点开释义</div></div>
          <div class="meta"></div><div class="arr">→</div>
        </div>
        <div class="ch-row" data-act="study-reset">
          <div class="ic">🧹</div>
          <div><div class="tt">重置记忆进度</div><div class="ds">清空所有复习安排，从第 1 条重新开始（不可撤销）</div></div>
          <div class="meta"></div><div class="arr">→</div>
        </div>
      </div>
      ${SRS.available ? '' : `<div class="sec"><p class="mini">⚠️ 当前浏览器无法写入 localStorage（可能处于无痕模式），本次学习进度仅保存在内存中，刷新后会丢失。</p></div>`}
    `;
  }

  /* ══════════════════════════════════════════════════════
   * 视图二：词库总览（只读浏览）
   * ══════════════════════════════════════════════════════ */
  function renderPreview(group) {
    clearTimer();
    session = null;
    const groups = (window.YY_DECK_META && window.YY_DECK_META.groups) || {};
    const names = Object.keys(groups);
    const list = group === '__all__' ? DECK : DECK.filter((c) => c.group === group);
    const tabs = ['__all__'].concat(names).map((g) => {
      const label = g === '__all__' ? `全部 ${DECK.length}` : `${g} ${groups[g]}`;
      return `<button class="btn small ${g === group ? 'active' : ''}" data-act="study-preview" data-g="${esc(g)}">${esc(label)}</button>`;
    }).join('');

    view.innerHTML = `
      <div class="crumbs" data-act="nav" data-h="#/study">← 返回今日学习</div>
      <div class="ch-head"><h1>📖 词库总览</h1></div>
      <div class="ch-oneline">共 <b>${list.length}</b> 条${group === '__all__' ? '' : `（${esc(group)}）`} —— 点任意条目展开释义、误用提示与例句。</div>
      <div class="tabs">${tabs}</div>
      <div class="db-list">
        ${list.map((c) => `
          <details class="db-item">
            <summary>
              <span class="db-type">${TYPE_ICON[c.type] || ''} ${esc(TYPE_LABEL[c.type] || '')}</span>
              <b>${esc(c.front)}</b>
              <span class="db-g">${esc(c.group)}</span>
            </summary>
            <div class="db-body">
              <div class="db-row"><span class="db-k">释义</span><span>${esc(c.answer)}</span></div>
              ${c.note ? `<div class="db-row"><span class="db-k">辨析</span><span>${esc(c.note)}</span></div>` : ''}
              ${c.example ? `<div class="db-row"><span class="db-k">例句</span><span class="db-eg">${esc(c.example)}</span></div>` : ''}
            </div>
          </details>`).join('')}
      </div>`;
  }

  /* ══════════════════════════════════════════════════════
   * 视图三：学习会话
   * ══════════════════════════════════════════════════════ */
  function startSession(extra) {
    let queue = SRS.session();
    if (extra) {
      // 加练：在不违反配额的前提下，额外补 10 条未学词条
      const ov = SRS.overview();
      if (ov.pendingTotal === 0 && ov.freshCount > 0) {
        const used = new Set(queue.map((x) => x.card.id));
        const more = DECK.filter((c) => !SRS.cardState(c.id) && !used.has(c.id)).slice(0, 10)
          .map((c) => ({ card: c, isNew: true }));
        queue = queue.concat(more);
      }
    }
    if (!queue.length) return;
    session = {
      queue, total: queue.length, idx: 0,
      flipped: false, graded: 0, right: 0, wrong: 0, newDone: 0,
      deferred: [], deferAt: [], cur: null,
    };
    loadCard();
    // 切到会话路由；即使地址跳转失败也先保证会话已建立并渲染
    try { if (location.hash !== '#/study/session') location.hash = '#/study/session'; } catch (e) {}
    renderSession();
  }

  function loadCard() {
    if (!session) return;
    if (session.idx >= session.queue.length) { session.cur = null; return; }
    session.cur = session.queue[session.idx];
    session.flipped = false;
  }

  function renderSession() {
    if (!session) { renderStudy(); return; }

    // 队列走完：若还有「忘记」的卡在等 10 分钟，进入等待态而不是直接结束
    if (session.idx >= session.queue.length) {
      if (session.deferred.length) { renderWaiting(); return; }
      clearTimer();
      renderSessionDone();
      return;
    }

    const item = session.cur = session.queue[session.idx];
    const card = item.card;
    const pos = session.graded + 1;
    const pct = Math.round(session.graded / Math.max(1, session.total) * 100);
    const st = SRS.cardState(card.id);
    const ivlText = st && st.state ? (st.state.ivl >= 1 ? `${Math.round(st.state.ivl)} 天` : '今天') : '—';
    const again = SRS.overview().dueCount;

    view.innerHTML = `
      <div class="crumbs" data-act="study-quit">← 结束本次学习</div>
      <div class="st-bar">
        <div class="st-bar-fill" style="width:${pct}%"></div>
      </div>
      <div class="st-stat">
        <span>已复习 <b>${session.graded}</b> / ${session.total}</span>
        <span class="ok">认识 <b>${session.right}</b></span>
        <span class="bad">待重记 <b>${session.wrong}</b></span>
        <span>${item.isNew ? '<span class="tag-new">新学</span>' : '<span class="tag-rev">复习</span>'}</span>
      </div>

      <div class="card-wrap">
        <div class="card-fc${session.flipped ? ' flipped' : ''}">
          <div class="card-face card-front">
            <div class="card-kind">${TYPE_ICON[card.type] || ''} ${esc(TYPE_LABEL[card.type] || '')} · ${esc(card.group)}</div>
            <div class="card-word">${esc(card.front)}</div>
            <div class="card-hint">先自己回想一遍释义与辨析点，再点开答案</div>
            <button class="btn primary st-flip" data-act="study-flip">点开答案 ▾</button>
          </div>
          <div class="card-face card-back">
            <div class="card-kind">${TYPE_ICON[card.type] || ''} ${esc(TYPE_LABEL[card.type] || '')} · ${esc(card.group)}</div>
            <div class="card-word small">${esc(card.front)}</div>
            <div class="card-sec"><span class="card-k">释义</span><p>${esc(card.answer)}</p></div>
            ${card.note ? `<div class="card-sec"><span class="card-k">辨析 / 易错</span><p>${esc(card.note)}</p></div>` : ''}
            ${card.example ? `<div class="card-sec"><span class="card-k">例句</span><p class="eg">${esc(card.example)}</p></div>` : ''}
          </div>
        </div>
      </div>

      <div class="st-actions" id="st-actions">
        ${session.flipped ? `
          <div class="st-ask">刚才回想得怎么样？——按真实感受选，别骗自己</div>
          <div class="rate-row">
            <button class="btn rate rate-again" data-act="study-grade" data-r="again">
              忘记<small>重置 · 10 分钟后再来</small></button>
            <button class="btn rate rate-hard" data-act="study-grade" data-r="hard">
              模糊<small>间隔拉长到 ${Math.max(1, Math.round((st && st.state ? st.state.ivl : 1) * 1.2))} 天</small></button>
            <button class="btn rate rate-good" data-act="study-grade" data-r="good">
              认识<small>下次复习：${ivlText === '今天' ? '明天' : '约 ' + (() => {
                const n = st && st.state ? st.state.n : 0;
                const ef = st && st.state ? st.state.ef : 2.5;
                const iv = st && st.state ? st.state.ivl : 0;
                const next = n === 0 ? 1 : n === 1 ? 6 : Math.min(365, Math.round(iv * ef));
                return next + ' 天后';
              })()}</small></button>
          </div>` : `
          <button class="btn primary st-flip-wide" data-act="study-flip">显示答案</button>
          <p class="mini" style="text-align:center;margin-top:8px">键盘：空格翻面 · 1 忘记 · 2 模糊 · 3 认识</p>`}
      </div>
      <p class="mini st-foot">${again ? `当前仍有 ${again} 条到期待复习` : '到期的词条已清空'}　·　本条已复习 ${st ? st.seen : 0} 次${st && st.wrong ? ` · 错过 ${st.wrong} 次` : ''}</p>
    `;
  }

  function renderSessionDone() {
    clearTimer();
    const s = session;
    const ov = SRS.overview();
    const acc = s.graded ? Math.round(s.right / s.graded * 100) : 0;
    const grade = acc >= 90 ? { t: '记性极佳', s: 'EXCELLENT' } : acc >= 75 ? { t: '稳中有进', s: 'GOOD' }
      : acc >= 55 ? { t: '还需巩固', s: 'FAIR' } : { t: '别急，重复就是力量', s: 'KEEP GOING' };
    view.innerHTML = `
      <div class="st-done">
        <div class="st-done-ic">🎉</div>
        <h2>${grade.t}</h2>
        <div class="st-done-sub">${grade.s}</div>
        <div class="st-done-grid">
          <div><span class="n">${s.graded}</span><span class="l">本次复习</span></div>
          <div><span class="n ok">${s.right}</span><span class="l">认识</span></div>
          <div><span class="n bad">${s.wrong}</span><span class="l">待重记</span></div>
          <div><span class="n">${acc}%</span><span class="l">一次记住率</span></div>
        </div>
        <div class="st-done-meta mini">
          今日累计：复习 <b>${ov.reviewsToday}</b> 条 · 新学 <b>${ov.newLearnedToday}</b> 条
          ${ov.streak > 1 ? ` · 🔥 已连续学习 <b>${ov.streak}</b> 天` : ''}
          <br>全部 ${ov.total} 条进度 <b>${ov.learnedCount}</b> / ${ov.total}（${ov.progress}%）
          ${ov.dueCount ? `　·　仍有 <b>${ov.dueCount}</b> 条到期未复习` : ''}
        </div>
        <div class="st-done-btns">
          ${ov.pendingTotal > 0 ? `<button class="btn primary" data-act="study-start">▶ 继续学习（还剩 ${ov.pendingTotal} 条）</button>` : ''}
          <button class="btn" data-act="nav" data-h="#/study">返回今日看板</button>
        </div>
      </div>`;
  }

  /* ── 等待态：队列走完，但还有「忘记」的卡在冷却中 ── */
  function renderWaiting() {
    const wait = session.deferAt.length ? Math.max(0, session.deferAt[0] - Date.now()) : 0;
    const sec = Math.ceil(wait / 1000);
    const mm = String(Math.floor(sec / 60)).padStart(2, '0');
    const ss = String(sec % 60).padStart(2, '0');
    view.innerHTML = `
      <div class="crumbs" data-act="study-quit">← 结束本次学习</div>
      <div class="st-wait">
        <div class="st-wait-ic">⏳</div>
        <h2>还有 ${session.deferred.length} 条要重记</h2>
        <div class="st-wait-sub mini">刚才选了「忘记」的词条会回到队列 —— 间隔重复的关键就是趁热再记一次，别直接关掉。</div>
        <div class="st-wait-clock" id="st-clock">${mm}:${ss}</div>
        <div class="st-done-btns">
          <button class="btn primary" data-act="study-now" ${wait > 0 ? '' : 'disabled'}>立即重记（跳过等待）</button>
          <button class="btn" data-act="study-finish">结束本次学习</button>
        </div>
        <div class="mini" style="margin-top:14px">本次已复习 <b>${session.graded}</b> 条 · 认识 <b>${session.right}</b> · 待重记 <b>${session.wrong}</b></div>
        ${session.deferred.map((d) => `<div class="st-wait-item">${esc(d.card.front)}</div>`).join('')}
      </div>`;
  }

  /* ── 评分 ── */
  /* 返回是否真正记入（未翻面或会话已结束时返回 false，调用方可据此判断） */
  function grade(rating) {
    if (!session || !session.flipped || !session.cur) return false;
    if (rating !== 'again' && rating !== 'hard' && rating !== 'good') return false;
    const item = session.cur;
    const card = item.card;
    SRS.grade(card.id, rating, Date.now());

    if (rating === 'again') {
      session.wrong++;
      session.deferred.push(item);
      session.deferAt.push(Date.now() + 10 * 60000);
    } else {
      session.right++;
    }
    if (item.isNew) session.newDone++;
    session.graded++;
    session.idx++;
    loadCard();                                          // 推进后自动复位 flipped
    renderSession();
    return true;
  }

  function flip() {
    if (!session || !session.cur) return;
    session.flipped = !session.flipped;
    renderSession();
  }

  /* 把到点的延后卡插回队列；返回是否有变化 */
  function requeueDue(force) {
    if (!session) return false;
    const now = Date.now();
    let moved = false;
    for (let i = 0; i < session.deferAt.length; i++) {
      if (force || session.deferAt[i] <= now) {
        session.queue.push(session.deferred[i]);
        session.deferred.splice(i, 1);
        session.deferAt.splice(i, 1);
        moved = true; i--;
      }
    }
    if (moved) loadCard();
    return moved;
  }

  /* 每秒心跳：等待态刷新倒计时 / 到点自动回队列 */
  function tick() {
    if (!session) { clearTimer(); return; }
    if (session.idx < session.queue.length) return;      // 正常答题中，无需处理
    if (requeueDue(false)) { renderSession(); return; }
    if (session.deferred.length) {
      const clock = document.getElementById('st-clock');
      if (clock) {
        const sec = Math.max(0, Math.ceil((session.deferAt[0] - Date.now()) / 1000));
        clock.textContent = String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');
        const btn = document.querySelector('[data-act="study-now"]');
        if (btn && sec <= 0) btn.disabled = false;
      }
      return;
    }
    renderSession();
  }

  function ensureTimer() { if (!timer) timer = setInterval(tick, 1000); }

  /* ── 供 app.js 调用 ── */
  window.YY_STUDY = {
    render() { renderStudy(); },
    preview(group) { renderPreview(group || '__all__'); },
    start(extra) { startSession(extra); ensureTimer(); },
    grade, flip,
    tick: () => { if (session) tick(); },
    quit() { clearTimer(); session = null; renderStudy(); },
    finish() { clearTimer(); session = null; renderStudy(); },
    /** 立即把延后的卡放回队列（跳过 10 分钟等待） */
    requeueNow() { if (session && requeueDue(true)) renderSession(); },
    hasSession() { return !!session; },
    isWaiting() { return !!(session && session.idx >= session.queue.length && session.deferred.length); },
    setQuota(delta) { SRS.setNewPerDay(SRS.overview().newPerDay + (Number(delta) || 0)); renderStudy(); },
    reset() { SRS.resetAll(); clearTimer(); session = null; renderStudy(); },
    dispose() { clearTimer(); session = null; },
  };
})();
