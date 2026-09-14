/* ============================================================
 * 公考速算训练营 · 出题引擎
 * 所有题目按行测资料分析真题风格生成：
 *  - 数字规模贴近真实材料（四位~六位数、一位小数增长率）
 *  - 选项间距分「巩固（宽）/ 实战（窄）」两档，实战档与真题相当
 *  - 干扰项有代数含义（忘除 1+r、单位换算错位、分子分母颠倒等）
 * ============================================================ */
(function () {
  'use strict';

  /* ── 基础工具 ─────────────────────────────────────────── */
  const rnd = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
  const rndf = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const chance = (p) => Math.random() < p;
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  const fmtInt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  function fmtDec(n, d) {
    const s = Number(n).toFixed(d);
    const parts = s.split('.');
    return fmtInt(Number(parts[0])) + (parts[1] ? '.' + parts[1] : '');
  }
  const pct1 = (n) => fmtDec(n, 1) + '%';
  const frac = (num, den, cls) =>
    `<span class="frac${cls ? ' ' + cls : ''}"><span class="fn">${num}</span><span class="fd">${den}</span></span>`;

  /* ── 题干语境素材 ─────────────────────────────────────── */
  const REGIONS = ['某省', '某市', '全国', '华东地区', '某地级市', '某自治区'];
  const SUBJ_ECO = ['规模以上工业增加值', '社会消费品零售总额', '固定资产投资', '外贸进出口总值',
    '地区生产总值', '财政总收入', '旅游总收入', '粮食总产量'];
  const SUBJ_SCI = ['研发经费投入', '高新技术企业营业收入', '技术合同成交额'];
  const UNIT_MONEY = ['亿元', '亿元', '亿元', '万元'];

  /* ── 数值选项构造器 ───────────────────────────────────── */
  /**
   * 以真值为中心生成 4 个唯一选项。
   * cfg: {dp 小数位 | rel 相对扰动范围[lo,hi] | add 加法型每档间距 |
   *       extra 具名干扰值数组 | sortAsc 是否升序(默认 true)}
   */
  function numericOpts(trueVal, cfg) {
    const dp = cfg.dp || 0;
    const F = (v) => fmtDec(v, dp);
    const items = [{ h: F(trueVal), ok: true }];
    const seen = new Set(items.map((i) => i.h));
    const tryAdd = (v) => {
      if (!isFinite(v) || v <= 0) return false;
      const h = F(v);
      if (seen.has(h)) return false;
      seen.add(h); items.push({ h, ok: false });
      return true;
    };
    shuffle(cfg.extra || []).forEach(tryAdd);
    let g = 0;
    while (items.length < 4 && g++ < 400) {
      if (cfg.add) {
        tryAdd(trueVal + pick([-3, -2.5, -2, -1.5, 1.5, 2, 2.5, 3]) * cfg.add);
      } else {
        const lo = cfg.rel ? cfg.rel[0] : .02, hi = cfg.rel ? cfg.rel[1] : .04;
        const m = lo + Math.random() * (hi - lo);
        tryAdd(trueVal * (1 + (chance(.5) ? m : -m)));
      }
    }
    let opts = items.slice(0, 4).map((it) => ({ text: it.h, isAns: it.ok }));
    if (cfg.sortAsc !== false) {
      const val = (t) => parseFloat(String(t.text).replace(/,/g, '')) || 0;
      opts.sort((a, b) => val(a) - val(b));
    } else { opts = shuffle(opts); }
    opts.forEach((o, i) => { o.k = 'ABCD'[i]; });
    // 确保正确项仍在数组中（slice 截断极端情况下兜底）
    if (!opts.some((o) => o.isAns)) opts[0].isAns = true;
    return { options: opts, ansIdx: opts.findIndex((o) => o.isAns) };
  }

  /** 过滤“离锚点太近”的错误干扰项，并补足到 4 个（用于百化分双锚点场景） */
  function sanitizeByAnchor(optRes, anchors, minRel) {
    const farEnough = (v) => anchors.every(
      (an) => Math.abs(v - an) / Math.abs(an) >= minRel);
    const keep = optRes.options.filter(
      (o) => o.isAns || farEnough(parseFloat(o.text.replace(/,/g, ''))));
    while (keep.length < 4) {
      const base = anchors[0];
      const cand = base * (1 + (chance(.5) ? 1 : -1) * (minRel + .02 + Math.random() * .05));
      const cs = fmtDec(cand, optRes._dp || 0);
      if (!keep.some((o) => o.text === cs)) keep.push({ text: cs, isAns: false });
    }
    const val = (t) => parseFloat(t.text.replace(/,/g, '')) || 0;
    keep.sort((a, b) => val(a) - val(b));
    keep.forEach((o, i) => { o.k = 'ABCD'[i]; });
    return { options: keep, ansIdx: keep.findIndex((o) => o.isAns) };
  }

  // 「首位替换」干扰项：保持数量级、只换最高有效数字 → 训练首商反应
  function firstDigitDistractions(v, dp, n) {
    const s = parseFloat(fmtDec(v, dp).replace(/,/g, ''));
    const mag = Math.pow(10, Math.floor(Math.log10(s)));
    const lead = Math.floor(s / mag);
    const rem = s - lead * mag;
    const out = [];
    for (const d of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9].filter((x) => x !== lead))) {
      if (out.length >= n) break;
      out.push(d * mag + rem);
    }
    return out;
  }

  /* ══════════════════════════════════════════════════════
   * M1 直除法 —— 裸式 / 嵌入基期情境
   * ══════════════════════════════════════════════════════ */
  function genDiv(level) {
    const warm = level === 'warm';
    let b, qT;
    if (warm) { b = rnd(12, 699); qT = rndf(20, 90); }
    else { b = rnd(107, 9899); qT = rndf(4, 88); }
    const a = Math.round(qT * b);
    const qEx = a / b;

    // 实战偶发：除以 (1+r) 的形态，衔接第三章
    if (!warm && chance(.35)) {
      const rp = rndf(2.4, 18.6);
      const stem = `<b>${pick(REGIONS)}${pick(SUBJ_SCI)}</b>今年为 <b class="num">${fmtInt(a)}</b> 亿元，
        同比增长 <b class="num">${fmtDec(rp, 1)}%</b>。求上年同期数值约为多少？`;
      const trueBase = a / (1 + rp / 100);
      const bd = trueBase >= 10000 ? 0 : 1;
      const res = numericOpts(trueBase, { dp: bd, rel: [.015, .032] });
      const analysis = `上年在增长之前、数值更小 → 除以 (1＋${fmtDec(rp, 1)}%)。<br>
        直除试商：${fmtInt(a)} ÷ ${fmtDec(1 + rp / 100, 3)}，商开头是
        <b class="num key">${fmtDec(trueBase, bd)}</b>，与选项 <b>${res.options[res.ansIdx].k}</b> 对应。<br>
        <em>技巧：先估数量级（约 1.79 万 ÷ 1.1 ⇒ 一万多），再除首二位；永远只除到能区分选项为止。</em>`;
      return mk('div', '直除法', level, stem,
        `${fmtInt(a)} <i>÷</i> <span class="paren">(1 + ${fmtDec(rp, 1)}%)</span>`,
        res, analysis, warm ? '先判数量级再算首商' : '除到能区分选项就停笔');
    }

    const stem = `下列各式中，计算结果最接近的一项是（　）：`;
    const dp = qEx >= 50 ? 0 : qEx >= 8 ? 1 : 2;
    const res = numericOpts(qEx, {
      dp, rel: warm ? undefined : [.014, .03],
      extra: warm ? firstDigitDistractions(qEx, dp, 3) : [],
    });
    const analysis = `列竖式不必抄全被除数，除到够用即止：<br>
      ${fmtInt(a)} ÷ ${fmtInt(b)} ＝ <b class="num key">${fmtDec(qEx, dp)}</b>，
      选 <b>${res.options[res.ansIdx].k}</b>。<br>
      <em>口诀：选项首位都不同 → 只除 1 位；首两位才不同 → 除到第二位。
      被除数取前三位参与运算就够了。</em>`;
    return mk('div', '直除法', level, stem, `${fmtInt(a)} <i>÷</i> ${fmtInt(b)}`,
      res, analysis, warm ? '先看选项首位决定要除几位' : '除到能区分选项就停笔');
  }

  /* ══════════════════════════════════════════════════════
   * M2 增长类 —— sub: jiqi / jjl / rate
   * ══════════════════════════════════════════════════════ */
  const PURE_POOL = [[25, 4], [16.7, 6], [12.5, 8], [20, 5], [33.3, 3],
    [8.3, 12], [11.1, 9], [14.3, 7], [50, 2]];
  // 与真实分数略有出入的“不整齐”增长率（整数 n，保证百化分可用）
  const IMPURE_POOL = [[8.6, 12], [19.4, 5], [13.7, 7], [6.4, 15], [11.6, 9], [23.9, 4]];

  function bestFracNote(rPct) {
    let bestN = 2, bestErr = 1e9;
    for (const n of [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]) {
      const e = Math.abs(rPct - 100 / n);
      if (e < bestErr) { bestErr = e; bestN = n; }
    }
    if (bestErr > .65) return null;
    const above = rPct > 100 / bestN;
    return { n: bestN, above,
      html: `<br><span class="mini">偏差校正：${fmtDec(rPct, 1)}% ${above ? '略大于' : '略小于'}
        1/${bestN}（＝${fmtDec(100 / bestN, 1)}%），所以精确答案比“现期÷(${bestN}${above ? '＋1' : '＋1'})”的近似值<b>${above ? '稍大' : '稍小'}</b>——找最近选项即可。</span>` };
  }

  function genGrowth(level, sub) {
    sub = sub || pick(['jiqi', 'jjl', 'rate']);
    const warm = level === 'warm';
    const unit = pick(UNIT_MONEY);
    const region = pick(REGIONS);
    const subj = chance(.35) ? pick(SUBJ_SCI) : pick(SUBJ_ECO);

    if (sub === 'jiqi') {
      const base = rnd(warm ? 800 : 3000, warm ? 90000 : 980000);
      const r = warm ? rndf(4, 30) : rndf(2.8, 34.6);
      const now = Math.round(base * (1 + r / 100));
      const stem = `2023 年<b>${region}${subj}</b>为 <b class="num">${fmtInt(now)}</b> ${unit}，
        同比增长 <b class="num">${fmtDec(r, 1)}%</b>。2022 年该指标约为多少 ${unit}？`;
      let res = numericOpts(base, { dp: 0, rel: warm ? [.06, .13] : [.014, .03],
        _dp: 0, extra: chance(.6) ? [now * (1 - r / 100)] : [] });
      res = sanitizeByAnchor(res, [base], warm ? .09 : .05);
      const analysis = `基期在增长之前、数值更小 → 基期 ＝ 现期 ÷ (1＋r)<br>
        ＝ ${fmtInt(now)} ÷ ${fmtDec(1 + r / 100, 3)} ≈ <b class="num key">${fmtInt(base)}</b> ${unit}，
        选 <b>${res.options[res.ansIdx].k}</b>。<br>
        <em>r 很小时（＜5%）也可用 现期×(1−r) 近似；若某干扰项恰好是“乘了 (1−r)”的结果，那是命题人挖的坑。</em>`;
      return mk('growth.jiqi', '基期量 · 现期÷(1+r)', level, stem, null, res, analysis,
        '去年在增长的“前面”，要变小');
    }

    if (sub === 'jjl') {
      const down = !warm && chance(.3);
      const cur = rnd(warm ? 900 : 4000, warm ? 60000 : 480000);
      let r, N;
      do {
        if (warm || chance(.55)) { const p = pick(PURE_POOL); r = p[0]; N = p[1]; }
        else { const c = pick(IMPURE_POOL); r = c[0]; N = c[1]; }
      } while (down && Math.round(N) < 4);          // 下降时避免 n−1 太小
      const dirTxt = down ? '下降' : '增长';
      const askTxt = down ? '减少量' : '增加量';
      const stem = `2023 年<b>${region}${subj}</b>为 <b class="num">${fmtInt(cur)}</b> ${unit}，
        同比${dirTxt} <b class="num">${fmtDec(r, 1)}%</b>。同比${askTxt}约为多少 ${unit}？`;
      const deltaExact = cur * (r / 100) / (1 + r / 100);
      const nR = Math.round(N);
      const approxV = down ? cur / (nR - 1) : cur / (nR + 1);
      const dpD = deltaExact >= 10000 ? 0 : 1;
      let res = numericOpts(deltaExact, {
        dp: dpD, _dp: dpD,
        rel: warm ? [.07, .15] : [.035, .06],
        extra: [cur * (r / 100), approxV],
      });
      // 双锚点防坑：任何干扰项不得同时贴近“精确值”和“近似值”
      res = sanitizeByAnchor(res, [deltaExact, approxV], .055);
      const note = bestFracNote(r);
      const analysis = `增长量 ＝ 现期 × r/(1＋r)。本题 r=${fmtDec(r, 1)}% ≈ 1/${nR}，故<br>
        ${dirTxt}量 ≈ ${fmtInt(cur)} ÷ (${nR} ${down ? '－' : '＋'} 1)
        ＝ ${fmtInt(cur)} ÷ ${down ? nR - 1 : nR + 1} ≈ <b class="num key">${fmtDec(approxV, dpD)}</b>；
        精确值为 ${fmtDec(deltaExact, dpD)}${approxV !== 0 ? `（相差约 ${fmtDec(Math.abs(deltaExact - approxV) / deltaExact * 100, 1)}%）` : ''}，
        与之最近的选项是 <b>${res.options[res.ansIdx].k}</b>。${note ? note.html : ''}<br>
        <em>陷阱提醒：“现期 × r”没有除以 (1＋r)，是错误算法；"下降"用 n−1、"增长"用 n＋1 别记反。</em>`;
      return mk('growth.jjl', '增长量 · 现期×r/(1+r)', level, stem, null, res, analysis,
        down ? '下降时用 现期÷(n−1)' : '先百化分，再看偏差方向');
    }

    // rate：已知基期和现期求增长率
    const baseV = rnd(warm ? 2000 : 6000, warm ? 70000 : 320000);
    const gTrue = warm ? rndf(8, 45) : rndf(3.5, 62.1);
    const curV = Math.round(baseV * (1 + gTrue / 100));
    const diff = curV - baseV;
    const wrongDenom = diff / curV * 100;
    const stem = `<b>${region}${subj}</b>由上年的 <b class="num">${fmtInt(baseV)}</b> ${unit}
      提高到今年的 <b class="num">${fmtInt(curV)}</b> ${unit}。同比增长率约为（　）：`;
    const res = numericOpts(gTrue, { dp: 1,
      extra: [wrongDenom, gTrue * (chance(.5) ? 1.22 : .78), gTrue + pick([1.8, -1.9])] });
    const analysis = `增长率 ＝ <b>(现期 − 基期) ÷ 基期</b><br>
      ＝ (${fmtInt(curV)} − ${fmtInt(baseV)}) ÷ ${fmtInt(baseV)}
      ＝ ${fmtInt(diff)} ÷ ${fmtInt(baseV)} ≈ <b class="num key">${pct1(gTrue)}</b>，
      选 <b>${res.options[res.ansIdx].k}</b>。<br>
      <em>头号易错点：分母是<b>基期</b>！把分母除成现期会得到 ${pct1(wrongDenom)}——它就混在某个干扰项里。</em>`;
    return mk('growth.rate', '增长率 · Δ/基期', level, stem, null, res, analysis,
      '增长率分母永远是“原来那个数”');
  }

  /* ══════════════════════════════════════════════════════
   * M4 比重 —— pct / units 单位陷阱 / dir 升降判断
   * ══════════════════════════════════════════════════════ */
  function genBizhong(level) {
    const warm = level === 'warm';
    const roll = warm ? 'pct' : pick(['pct', 'units', 'units', 'dir']);

    if (roll === 'dir') {
      const rp = rndf(4, 32), rq = rndf(2.5, 26);
      const partFaster = chance(.5);
      const rPart = partFaster ? rp : rq, rWhole = partFaster ? rq : rp;
      const up = rPart > rWhole;
      const options = [
        { k: 'A', text: up ? '上升了' : '下降了', isAns: true },
        { k: 'B', text: up ? '下降了' : '上升了', isAns: false },
      ];
      const stem = `2023 年<b>某省${pick(SUBJ_SCI)}</b>占全国的比重，与上年相比的变化是：<br>
        已知该省研发投入同比增速 <b class="num">${fmtDec(rPart, 1)}%</b>，
        全国整体研发投入同比增速 <b class="num">${fmtDec(rWhole, 1)}%</b>。`;
      const analysis = `比重升降<b>不用计算</b>，只看增速快慢：
        部分增速 ＞ 整体增速 → 比重上升；反之下降。<br>
        本题 ${fmtDec(rPart, 1)}% ${up ? '＞' : '＜'} ${fmtDec(rWhole, 1)}%，
        故比重<b class="key">${up ? '上升' : '下降'}</b>，选 <b>A</b>。<br>
        <em>口诀：谁跑得快，份额向谁偏。（想确认数值才需要动笔，判断方向三秒收工。）</em>`;
      return mk('bizhong.dir', '比重 · 升降判断', level, stem, null,
        { options, ansIdx: 0 }, analysis, '分子长得快 → 比重升');
    }

    if (roll === 'units') {
      const wholeYi = rnd(120, 9800);
      const tPct = warm ? rndf(12, 70) : rndf(6, 62);
      const partWan = Math.round(wholeYi * tPct / 100);
      const partShown = partWan * 10000;                       // 以「万元」呈现
      const truePct = partShown / 10000 / wholeYi * 100;
      const wrongNoConv = partShown / wholeYi * 100;           // 忘换算
      const wrongTenfold = truePct / 10;                       // 万→亿进率错 10 倍
      const stem = `2023 年某省高新技术产业投资 <b class="num">${fmtInt(partShown)}</b> 万元，
        全省固定资产投资合计 <b class="num">${fmtInt(wholeYi)}</b> 亿元。
        该省高新技术产业投资约占固定资产投资的（　）：`;
      const extras = [wrongTenfold, truePct * 1.35];
      if (wrongNoConv <= 99 && wrongNoConv >= 1) extras.push(wrongNoConv);
      const res = numericOpts(truePct, { dp: 2, sortAsc: true, extra: extras });
      const analysis = `先把单位拉齐：${fmtInt(partShown)} 万元 ＝ ${fmtInt(partWan)} 亿元（1 亿＝10⁴ 万）。<br>
        比重 ＝ ${fmtInt(partWan)} ÷ ${fmtInt(wholeYi)} × 100%
        ≈ <b class="num key">${fmtDec(truePct, 2)}%</b>，选 <b>${res.options[res.ansIdx].k}</b>。<br>
        <em>不换算会算出约 ${wrongNoConv >= 1 && wrongNoConv <= 999 ? fmtDec(wrongNoConv, 1) : '天大'}% 的结果——
        资料分析的材料里单位不一致是常态，读题第一步先扫单位！</em>`;
      return mk('bizhong.units', '比重 · 单位陷阱', level, stem, null, res, analysis,
        '先统一单位再动笔');
    }

    // pct：普通比重
    const whole = rnd(warm ? 300 : 2400, warm ? 60000 : 985000);
    const tPct = rndf(warm ? 8 : 6.5, warm ? 90 : 88.5);
    const part = Math.round(whole * tPct / 100);
    const truePct = part / whole * 100;
    const unit = pick(UNIT_MONEY);
    const stem = `2023 年<b>${pick(REGIONS)}${pick(SUBJ_ECO)}</b>完成额 <b class="num">${fmtInt(whole)}</b> ${unit}，
      其中某一分项完成 <b class="num">${fmtInt(part)}</b> ${unit}。该分项所占比重约为（　）：`;
    const swapOk = truePct < 40 && truePct > 2.5;
    const res = numericOpts(truePct, {
      dp: 1,
      rel: warm ? undefined : [.028, .055],
      add: warm ? 5.5 : undefined,
      extra: [swapOk ? whole / part * 100 : truePct * 1.44, truePct * .82],
    });
    const analysis = `比重 ＝ 部分 ÷ 整体 ＝ ${fmtInt(part)} ÷ ${fmtInt(whole)}<br>
      直除得商开头 <b class="num key">${fmtDec(truePct, 1)}%</b>，选 <b>${res.options[res.ansIdx].k}</b>。<br>
      <em>比重永远是“部分在前”；拿不准谁是整体就想一句话：被切分的蛋糕才是整体。
      干扰项里有把分子分母颠倒的结果，别踩。</em>`;
    return mk('bizhong.pct', '比重 · 部分÷整体', level, stem, null, res, analysis,
      '切开的蛋糕 ÷ 整个蛋糕');
  }

  /* ══════════════════════════════════════════════════════
   * M5 尾数法 —— 连加
   * ══════════════════════════════════════════════════════ */
  function genWeishu(level) {
    const warm = level === 'warm';
    const k = warm ? 4 : 5;
    const year0 = rnd(2016, 2019);
    const terms = []; let S = 0;
    for (let i = 0; i < k; i++) {
      const t = rnd(warm ? 1200 : 12345, warm ? 68000 : 987650);
      terms.push(t); S += t;
    }
    const F = (v) => fmtInt(v);
    const items = [{ h: F(S), ok: true }];
    const seen = new Set([items[0].h]);
    const high = Math.floor(S / 100) * 100;
    let guard = 0;
    while (items.length < 5 && guard++ < 200) {     // 多备 1 个，供替换使用
      const v = high + rnd(0, 99);
      if (v === S) continue;
      const h = F(v);
      if (seen.has(h)) continue;
      seen.add(h); items.push({ h, ok: false });
    }
    // 实战：偶尔放一个“末两位相同、高位不同”的选项，逼你看倒数第三位
    if (!warm && chance(.45) && items.length >= 5) {
      items.pop();
      const v = S + pick([-1, 1]) * 100 * rnd(1, 9);
      const h = F(v);
      if (!seen.has(h)) { items.push({ h, ok: false }); seen.add(h); }
      else items.push({ h: F(S + 1000), ok: false });
    }
    let opts = items.slice(0, 4).map((o) => ({ text: o.h, isAns: o.ok }));
    if (!opts.some((o) => o.isAns)) opts[0].isAns = true;
    const val = (t) => parseFloat(t.text.replace(/,/g, '')) || 0;
    opts.sort((a, b) => val(a) - val(b));
    opts.forEach((o, i) => { o.k = 'ABCD'[i]; });
    const ansIdx = opts.findIndex((o) => o.isAns);

    const tailSum2 = terms.reduce((acc, t) => acc + (t % 100), 0);
    const yearList = Array.from({ length: k }, (_, i) => year0 + i);
    const stem = `<b>${pick(REGIONS)}${pick(SUBJ_ECO)}</b> ${year0}—${year0 + k - 1} 年累计完成额为（　）万元。<br>
      <span class="mini">其中 ${terms.map((t, i) => `${yearList[i]} 年 <b class="num">${fmtInt(t)}</b>`).join('　')}</span>`;
    const analysis = `几个五、六位数连加，精算太慢——直接盯<b>末两位</b>：<br>
      各年数字末两位：${terms.map((t) => String(t % 100).padStart(2, '0')).join('、')}，
      相加得 <b class="num key">${tailSum2}</b>，故结果末两位必为
      <b class="key">${String(tailSum2 % 100).padStart(2, '0')}</b>，
      只有 <b>${opts[ansIdx].k}</b> 符合，锁定它。<br>
      <em>升级规则：若有选项末两位相同 → 往前多看一位；四项末位互异时只看末位即可，三秒收工。
      （减法同理可看尾数，注意借位。）</em>`;
    return mk('weishu', '尾数法 · 连加锁定', level, stem, null, { options: opts, ansIdx },
      analysis, '加减法先看尾巴，别硬算');
  }

  /* ══════════════════════════════════════════════════════
   * M6 分数比较 —— pair 二选一 / quad 四选一
   * ══════════════════════════════════════════════════════ */
  function genBijiao(level, mode) {
    const warm = level === 'warm';
    const gapMin = warm ? .09 : .038, gapMax = warm ? .22 : .085;
    const makeOne = (x) => {
      const den = rnd(107, 8949);
      return { num: Math.max(1, Math.round(den * x)), den };
    };

    if (mode === 'pair' || (warm && chance(.5))) {
      const x = rndf(.12, .9);
      const g = gapMin + Math.random() * (gapMax - gapMin);
      const f1 = makeOne(x);
      const f2 = makeOne(x * (1 + (chance(.5) ? g : -g)));
      const v1 = f1.num / f1.den, v2 = f2.num / f2.den;
      const bigIsFirst = v1 > v2;
      const askSmall = chance(.4);
      const options = [
        { k: 'A', text: `${f1.num}/${fmtInt(f1.den)}`, htmlF: frac(f1.num, fmtInt(f1.den)), isAns: askSmall ? !bigIsFirst : bigIsFirst },
        { k: 'B', text: `${f2.num}/${fmtInt(f2.den)}`, htmlF: frac(f2.num, fmtInt(f2.den)), isAns: askSmall ? bigIsFirst : !bigIsFirst },
      ];
      const crossL = f1.num * f2.den, crossR = f2.num * f1.den;
      const analysis = `两个分数不好约分时，最快的是<b>直除首商</b>：<br>
        ${frac(f1.num, fmtInt(f1.den), 'inline')} ≈ ${fmtDec(v1 * 100, 1)}% ，
        ${frac(f2.num, fmtInt(f2.den), 'inline')} ≈ ${fmtDec(v2 * 100, 1)}% —— 大小一目了然。<br>
        <em>交叉相乘验证：左边 ${fmtInt(crossL)}（=${f1.num}×${fmtInt(f2.den)}）
        与右边 ${fmtInt(crossR)}（=${f2.num}×${fmtInt(f1.den)}）比大小；
        但考场上直除通常更快，通分是最不该用的办法。</em>`;
      return mk('bijiao.pair', '分数比较 · 二选一', level,
        `两个分数中${askSmall ? '<b>较小</b>' : '<b>较大</b>'}的是（　）：`,
        '', { options, ansIdx: options.findIndex((o) => o.isAns) }, analysis,
        askSmall ? '别急着通分，先估首商' : '首商定胜负');
    }

    // quad：四选一（真题标准问法）
    const x = rndf(.15, .86);
    const g = gapMin + Math.random() * (gapMax - gapMin);
    const leadRelGap = g * (1 + Math.random() * .6);
    const loserGs = shuffle([
      g * (1 + Math.random() * .7),
      g * (.6 + Math.random() * .6),
      g * (.2 + Math.random() * .5),
    ]);
    const ratios = [x * (1 + leadRelGap)].concat(loserGs.map((lg) => x * (1 - lg)));
    const parts = ratios.map(makeOne);
    const vals = parts.map((p) => p.num / p.den);
    const leadI = vals.indexOf(Math.max(...vals));
    // 展示顺序与年份绑定，选项按钮渲染这四个年份标签
    const slots = shuffle([0, 1, 2, 3]);
    const years = [2020, 2021, 2022, 2023];
    const presented = slots.map((oi, i) => ({
      y: years[i], num: parts[oi].num, den: parts[oi].den, v: vals[oi], srcIdx: oi,
    }));
    const options = presented.map((p, i) => ({
      k: 'ABCD'[i], text: `${p.y}年`, yr: p.y, isAns: p.srcIdx === leadI,
    }));
    const stem = `<b>${pick(REGIONS)}${pick(SUBJ_ECO)}</b>四年数据经整理，同比增速分别对应下列四个分数
      （分子＝增量相关量，分母＝基期量）。<b>增速最快</b>的是（　）：`;
    const exprHtml = `<div class="quad">${
      presented.map((p, i) =>
        `<div class="qcell"><span class="qtag">${p.y} 年</span>${
          frac(p.num, fmtInt(p.den))}<span class="qv" data-qv>${fmtDec(p.v * 100, 1)}%</span></div>`
      ).join('')}</div>`;
    const ranked = presented.slice().sort((a, b) => b.v - a.v);
    const analysis = `全部直除估算到 0.1 个百分点即可：<br>${
      ranked.map((p, rank) =>
        `<span class="step-line">${rank === 0 ? '✅' : '　　'} ${p.y} 年：${p.num} ÷ ${fmtInt(p.den)} ≈ ${fmtDec(p.v * 100, 1)}%</span>`
      ).join('<br>')}<br>
      最大者为 <b class="num key">${fmtDec(vals[leadI] * 100, 1)}%</b>，对应选项
      <b>${options.find((o) => o.isAns).k}</b>（${options.find((o) => o.isAns).yr} 年）。<br>
      <em>实战流程：第一眼扫有没有“分子明显特大／分母明显特小”的直接入围者；剩下的靠首商淘汰——
      永远不要精确通分，也不要逐个精算。</em>`;
    return mk('bijiao.quad', '分数比较 · 四选一', level, stem, exprHtml,
      { options, ansIdx: options.findIndex((o) => o.isAns) }, analysis,
      '先淘汰明显的，再用首商决胜');
  }

  /* ══════════════════════════════════════════════════════
   * M7 提高篇 —— 年均增长率
   * ══════════════════════════════════════════════════════ */
  function genAdv(level) {
    const n = rnd(3, 5);
    const v0 = rnd(600, 4800);
    const rUsed = Math.round(rndf(level === 'warm' ? 6 : 5.5, level === 'warm' ? 14 : 19.5) * 10) / 10 / 100;
    const v1 = Math.round(v0 * Math.pow(1 + rUsed, n));
    const y0 = rnd(2017, 2020);
    const ratio = v1 / v0;
    const exactR = (Math.pow(ratio, 1 / n) - 1) * 100;
    const displayed = Math.round(exactR * 10) / 10;
    const stem = `<b>${pick(REGIONS)}${pick(SUBJ_ECO)}</b>由 ${y0} 年的 <b class="num">${fmtInt(v0)}</b> 亿元
      增至 ${y0 + n} 年的 <b class="num">${fmtInt(v1)}</b> 亿元。${y0 + 1}—${y0 + n} 年期间年均增长率约为（　）：`;
    const res = numericOpts(displayed, { dp: 1, add: pick([1.6, 2.1, 2.6]), extra: [] });
    const roughHint = ((ratio - 1) * 100 / n).toFixed(1);
    const analysis = `年均增长率不必开方！先用<b>总增幅缩范围</b>：<br>
      总增幅 ${fmtDec((ratio - 1) * 100, 1)}% ÷ ${n} 年 ≈ <b class="num">${roughHint}%/年</b>；
      由于复利滚存的放大效应，真正的年均增速应<b>小于</b>这个粗估值 → 锁定选项中比
      ${roughHint}% 略小的那一个。<br>
      校验：(1＋${fmtDec(displayed, 1)}%)^${n} ≈ ${fmtDec(Math.pow(1 + displayed / 100, n), 2)}
      ，与实际增幅倍数 ${fmtDec(ratio, 2)} 吻合 → 选 <b>${res.options[res.ansIdx].k}</b>。<br>
      <em>结论：n≤5 且增速不大时，“粗估后选略小”一击必中；若两个选项都偏小且接近，才需要按复利微调试乘。</em>`;
    return mk('adv.yrr', '年均增长率', level, stem, null, res, analysis,
      '总增幅÷年数是上限粗估，真值略小');
  }

  /* ══════════════════════════════════════════════════════
   * M8 格尺法（格子乘法）—— 纯乘法 / 整体×比重
   * ══════════════════════════════════════════════════════ */
  function genGechi(level) {
    const warm = level === 'warm';
    if (warm || chance(.5)) {
      // 纯乘法：三位数 × 两位数
      const a = rnd(112, 989);
      const b = rnd(12, 99);
      const P = a * b;
      const res = numericOpts(P, { dp: 0, rel: warm ? [.06, .14] : [.02, .045],
        extra: [P + a, P - b] });
      const analysis = `格子乘法：把 ${fmtInt(a)} 与 ${b} 各位数字两两相乘填格（十位写左上三角、个位写右下三角，
        不足两位补 0 占位），再从右下角起沿斜线相加、进位传给相邻左上斜线，得
        <b class="num key">${fmtInt(P)}</b>，选 <b>${res.options[res.ansIdx].k}</b>。<br>
        <em>资料分析通常只要前三位有效数字——格子画一半、斜线加两三条即可停笔；进位只在相邻斜线间传递，不会跨位乱走。</em>`;
      return mk('gechi', '格尺法 · 格子乘法', level,
        `用格尺法快速得到 ${fmtInt(a)} × ${b} 的结果（　）：`,
        null, res, analysis, '十位左上、个位右下，斜线相加');
    }
    // 整体 × 比重求部分量
    const W = rnd(1240, 9860);
    const t = rnd(12, 87);
    const part = W * t / 100;
    const dp = part % 1 === 0 ? 0 : 1;
    const res = numericOpts(part, { dp, rel: warm ? [.07, .15] : [.025, .05],
      extra: [part / 10] });
    const unit = pick(UNIT_MONEY);
    const stem = `<b>${pick(REGIONS)}${pick(SUBJ_ECO)}</b>共 <b class="num">${fmtInt(W)}</b> ${unit}，
      其中某分项占 <b class="num">${t}%</b>。该分项约为（　）${unit}：`;
    const analysis = `部分 ＝ 整体 × 比重 ＝ ${fmtInt(W)} × ${t}%。<br>
      格尺只算 ${fmtInt(W)} × ${t} 的前几位（两位乘数只需两列格子），斜线相加后点小数点（÷100）
      → <b class="num key">${fmtDec(part, dp)}</b> ${unit}，选 <b>${res.options[res.ansIdx].k}</b>。<br>
      <em>陷阱对照：干扰项里有把小数点点错一位的结果——格尺算完后先估数量级，再落小数点。</em>`;
    return mk('gechi', '格尺法 · 整体×比重', level, stem, null, res, analysis,
      '先算前几位，再点小数点');
  }

  /* ══════════════════════════════════════════════════════
   * 附录自测：百分↔分数 & 平方数
   * ══════════════════════════════════════════════════════ */
  const FRAC_TABLE = [
    { p: '50%', f: [1, 2], tier: 1 }, { p: '33.3%', f: [1, 3], tier: 1 },
    { p: '25%', f: [1, 4], tier: 1 }, { p: '20%', f: [1, 5], tier: 1 },
    { p: '16.7%', f: [1, 6], tier: 1 }, { p: '12.5%', f: [1, 8], tier: 1 },
    { p: '37.5%', f: [3, 8], tier: 1 }, { p: '62.5%', f: [5, 8], tier: 1 },
    { p: '75%', f: [3, 4], tier: 1 },
    { p: '66.7%', f: [2, 3], tier: 2 }, { p: '14.3%', f: [1, 7], tier: 2 },
    { p: '28.6%', f: [2, 7], tier: 2 }, { p: '42.9%', f: [3, 7], tier: 2 },
    { p: '57.1%', f: [4, 7], tier: 2 }, { p: '71.4%', f: [5, 7], tier: 2 },
    { p: '85.7%', f: [6, 7], tier: 2 }, { p: '87.5%', f: [7, 8], tier: 2 },
    { p: '11.1%', f: [1, 9], tier: 2 }, { p: '10%', f: [1, 10], tier: 2 },
    { p: '8.3%', f: [1, 12], tier: 2 }, { p: '6.7%', f: [1, 15], tier: 2 },
    { p: '83.3%', f: [5, 6], tier: 2 }, { p: '80%', f: [4, 5], tier: 2 },
    { p: '9.1%', f: [1, 11], tier: 3 }, { p: '18.2%', f: [2, 11], tier: 3 },
    { p: '27.3%', f: [3, 11], tier: 3 }, { p: '7.7%', f: [1, 13], tier: 3 },
    { p: '7.1%', f: [1, 14], tier: 3 }, { p: '6.25%', f: [1, 16], tier: 3 },
    { p: '5.9%', f: [1, 17], tier: 3 }, { p: '90.9%', f: [10, 11], tier: 3 },
    { p: '91.7%', f: [11, 12], tier: 3 },
  ];

  function genHuhuan(level) {
    const maxTier = level === 'warm' ? 1 : level === 'real' ? 3 : 2;
    const pool = FRAC_TABLE.filter((e) => e.tier <= maxTier);
    const hit = pick(pool);
    const toFrac = chance(.5);
    const nearByPercent = FRAC_TABLE.filter((e) => e !== hit &&
      Math.abs(parseFloat(e.p) - parseFloat(hit.p)) < 15);
    let list;
    if (toFrac) {
      const set = new Set([hit.f.join()]);
      list = [{ text: `${hit.f[0]}/${hit.f[1]}`, isAns: true }];
      for (const d of nearByPercent.concat(shuffle(pool))) {
        const k = d.f.join();
        if (set.has(k) || k === hit.f.join()) continue;
        set.add(k);
        list.push({ text: `${d.f[0]}/${d.f[1]}`, isAns: false });
        if (list.length === 4) break;
      }
    } else {
      const set = new Set([hit.p]);
      list = [{ text: hit.p, isAns: true }];
      for (const d of nearByPercent.concat(shuffle(pool))) {
        if (set.has(d.p) || d.p === hit.p) continue;
        set.add(d.p);
        list.push({ text: d.p, isAns: false });
        if (list.length === 4) break;
      }
    }
    const options = shuffle(list).slice(0, 4);
    options.forEach((o, i) => { o.k = 'ABCD'[i]; });
    const ansIdx = options.findIndex((o) => o.isAns);
    const stem = toFrac
      ? `快问快答：<b class="big-q num">${hit.p}</b> 最接近哪个分数？（背熟这张对照表，考场一步到位）`
      : `快问快答：<b class="big-q num">${hit.f[0]}/${hit.f[1]}</b> 约等于百分之几？`;
    const correctText = toFrac ? `${hit.f[0]}/${hit.f[1]}` : hit.p;
    const analysis = toFrac
      ? `${hit.p} ＝ <b class="key">${correctText}</b>。<br>
         <em>记忆锚点：1/${hit.f[1] === 8 ? 8 : hit.f[1]} 族内 n/8 ＝ 12.5%×n；
         七分之一族循环节 142857 推出全表；同分子比大小看分母（分母大的反而小）。</em>`
      : `<b class="key">${correctText}</b> ＝ ${hit.p}。<br>
         <em>背诵主线抓六张牌：1/7＝14.3%、1/8＝12.5%、1/9＝11.1%、1/11＝9.1%、1/12＝8.3%、1/13＝7.7%，其余都能从它们推出来。</em>`;
    return mk('huhuan', '百分 ↔ 分数', level, stem, null, { options, ansIdx }, analysis, '');
  }

  function genPingfang(level) {
    // 平方数统一考 11～30（考公必背区间）：不再按难度分段，
    // 20 个底数保证「一组自测」内基本不撞题。
    const n = rnd(11, 30);
    const sq = n * n;
    const res = numericOpts(sq, { dp: 0,
      extra: [(n + 1) * (n + 1), (n - 1) * (n - 1), sq + 2 * n] });
    return mk('pingfang', '平方数速记', level,
      `快问快答：<b class="big-q num">${n}</b>² ＝ ？`, null, res,
      `${n}² ＝ <b class="key">${sq}</b>。<br>
       <em>记忆锚点：相邻平方差＝2n＋1（可用来推算）；高频三兄弟 13²＝169、15²＝225、25²＝625 必须秒答。</em>`, '');
  }

  /* ── 组装 Q ─────────────────────────────────────────── */
  function mk(typeId, typeName, level, stem, exprHtml, optRes, analysis, tip) {
    return {
      typeId, typeName, level, stem, exprHtml,
      options: optRes.options, ansIdx: optRes.ansIdx, analysis, tip,
    };
  }

  /* ── 注册表 ─────────────────────────────────────────── */
  const GEN = {
    div: genDiv,
    growth: genGrowth,
    bizhong: genBizhong,
    weishu: genWeishu,
    bijiao: genBijiao,
    adv: genAdv,
    gechi: genGechi,
    huhuan: genHuhuan,
    pingfang: genPingfang,
  };

  window.SUSUAN_QGEN = {
    gen(id, level, hint) {
      const fn = GEN[id];
      if (!fn) throw new Error('unknown generator: ' + id);
      let q = fn(level, hint), guard = 0;
      while (guard++ < 8) {
        const bad =
          !q || !Array.isArray(q.options) || q.options.length < 2 ||
          q.ansIdx < 0 || q.ansIdx >= q.options.length ||
          new Set(q.options.map((o) => o.text ?? o.htmlF ?? '')).size !== q.options.length ||
          q.options.some((o) => (o.text ?? '') === '' && o.htmlF == null);
        if (!bad) break;
        q = fn(level, hint);
      }
      return q;
    },
    /** 综合模考题型池 [generatorId, 权重] */
    EXAM_POOL: [
      ['div', 16], ['growth', 26], ['bizhong', 20],
      ['weishu', 12], ['bijiao', 12], ['adv', 6], ['gechi', 8],
    ],
    /** 供速记卡页展示的百分↔分数对照表 */
    FRAC_TABLE,
  };
})();
