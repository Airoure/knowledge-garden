/* ============================================================
 * 数量关系方法营 · 出题引擎（25 个子题型）
 * 干扰项均带代数含义（比例搞反、算术平均代替调和平均、
 * 容斥漏加重叠项、利润率直接打折相减等），逐题解析给快解步骤。
 * ============================================================ */
(function () {
  'use strict';

  /* ── 工具 ─────────────────────────────────────────────── */
  const rnd = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const chance = (p) => Math.random() < p;
  const gcd = (a, b) => b ? gcd(b, a % b) : a;
  const lcm = (a, b) => a / gcd(a, b) * b;
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
    const p = s.split('.');
    return fmtInt(Number(p[0])) + (p[1] ? '.' + p[1] : '');
  }
  const pct1 = (n) => fmtDec(n, 1) + '%';
  const C = (n, k) => {
    if (k < 0 || k > n) return 0;
    let r = 1;
    for (let i = 1; i <= k; i++) r = r * (n - k + i) / i;
    return Math.round(r);
  };
  const fact = (n) => { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; };

  /* ── 选项构造 ─────────────────────────────────────────── */
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
      if (cfg.add) tryAdd(trueVal + pick([-3, -2, -1.5, -1, 1, 1.5, 2, 3]) * cfg.add);
      else {
        const lo = cfg.rel ? cfg.rel[0] : .06, hi = cfg.rel ? cfg.rel[1] : .16;
        tryAdd(trueVal * (1 + (chance(.5) ? 1 : -1) * (lo + Math.random() * (hi - lo))));
      }
    }
    let opts = items.slice(0, 4).map((it) => ({ text: it.h, isAns: it.ok }));
    if (cfg.sortAsc !== false) {
      const val = (t) => parseFloat(String(t.text).replace(/,/g, '')) || 0;
      opts.sort((a, b) => val(a) - val(b));
    } else opts = shuffle(opts);
    opts.forEach((o, i) => { o.k = 'ABCD'[i]; });
    if (!opts.some((o) => o.isAns)) opts[0].isAns = true;
    return { options: opts, ansIdx: opts.findIndex((o) => o.isAns) };
  }

  function mk(typeId, typeName, level, stem, exprHtml, optRes, analysis, tip) {
    return { typeId, typeName, level, stem, exprHtml, options: optRes.options, ansIdx: optRes.ansIdx, analysis, tip };
  }

  /* ════════ 第一章 代入排除法 ════════ */

  // 余数同余：最小正整数（先暴力验证有解，避免不互质模数下的无解组合）
  function genTongyu(level) {
    let m1, m2, r1, r2, x, guard = 0;
    do {
      m1 = rnd(4, 12); m2 = rnd(4, 12);
      r1 = rnd(1, m1 - 1); r2 = rnd(1, m2 - 1);
      x = r1;
      let g2 = 0;
      while (g2++ < 4000 && !(x > 0 && x % m2 === r2)) x += m1;
    } while (guard++ < 100 && !(x > 0 && x % m2 === r2));
    const L = lcm(m1, m2);
    const res = numericOpts(x, { dp: 0, add: Math.max(2, Math.round(L / 6)),
      extra: [x + L, r1 + r2 + m1, x + m1] });   // x+L：同样满足但不是最小
    const seq = [];
    for (let v = r1, i = 0; i < 4; i++, v += m1) seq.push(v);
    const analysis = `从 r1 开始按 m1 的倍数枚举：${seq.join('、')}…，逐个验算除以 ${m2} 的余数，<br>
      第一个满足「÷${m2} 余 ${r2}」的是 <b class="num key">${x}</b>（${x}÷${m1} 余 ${x % m1}，${x}÷${m2} 余 ${x % m2}），选 <b>${res.options[res.ansIdx].k}</b>。<br>
      <em>注意：${x + L} 也满足两个余数条件（通解是 ${x}+${L}n），但题目问的是<b>最小</b>——代入排除时「最小/最大」字眼必须圈出来。</em>`;
    return mk('tongyu', '代入排除 · 余数同余', level,
      `一个正整数除以 ${m1} 余 ${r1}，除以 ${m2} 余 ${r2}。满足条件的最小正整数是（　）：`,
      null, res, analysis, '从余数出发按倍数枚举，圈住“最小”');
  }

  // 年龄倍数（往前推倍数变大、往后推倍数变小——两个方向都合法）
  function genNianling(level) {
    const before = chance(.4);
    let k, m;
    if (before) { k = rnd(2, 5); m = k + pick([1, 2, 3, 4]); }   // n 年前 → 倍数更大
    else { k = rnd(3, 5); m = k - pick(k === 3 ? [1] : [1, 2]); }   // n 年后 → 倍数变小，m≥2 保证公式有效
    const d = gcd(Math.abs(k - m), m - 1);
    const step = (m - 1) / d;
    const x = step * rnd(level === 'warm' ? 3 : 4, level === 'warm' ? 12 : 18);
    const n = x * Math.abs(k - m) / (m - 1);
    const dirTxt = before ? `${n} 年前` : `${n} 年后`;
    const y = before ? x - n : x + n;
    const son = before ? k * x - n : k * x + n;
    console.assert(son === m * y && y > 0, '年龄比例异常');
    const ask = pick(['乙今年', 'n', '甲今年']);
    const trueVal = ask === '乙今年' ? x : ask === '甲今年' ? k * x : n;
    const res = numericOpts(trueVal, { dp: 0, extra: [x, k * x, n, x + n, Math.abs(k * x - n)] });
    const askTxt = ask === 'n' ? `题中的 n 为（　）` : (ask === '乙今年' ? '乙今年的年龄为（　）岁' : '甲今年的年龄为（　）岁');
    const stem = `今年甲的年龄是乙的 <b>${k}</b> 倍，${dirTxt}甲的年龄是乙的 <b>${m}</b> 倍。${askTxt}：`;
    const analysis = `年龄问题铁律：<b>年龄差不变</b>。设乙今年 ${x} 岁，甲今年 ${k}×${x}＝${k * x} 岁；<br>
      ${dirTxt}：乙 ${y} 岁、甲 ${son} 岁，${son}÷${y}＝${m} ✓。${before ? '（往前推，年龄变小，倍数反而变大——方向别记反。）' : ''}<br>
      ${ask === '乙今年' ? `乙今年 <b class="num key">${x}</b> 岁` : ask === '甲今年' ? `甲今年 <b class="num key">${k * x}</b> 岁` : `两人相差 ${k * x}−${x}＝<b class="num key">${k * x - x}</b> 岁（=n）`}，选 <b>${res.options[res.ansIdx].k}</b>。<br>
      <em>考场更快的是<b>代入选项</b>：拿选项当乙的年龄，验算两次倍数关系即可。</em>`;
    return mk('nianling', '代入排除 · 年龄倍数', level, stem, null, res, analysis,
      '年龄差不变，倍数年年变');
  }

  // 两位数与数字交换
  function genShuwei(level) {
    let a, b;
    do { a = rnd(1, 9); b = rnd(1, 9); } while (a === b || (a + b) % 2 !== Math.abs(b - a) % 2);
    const orig = 10 * a + b, swap = 10 * b + a;
    const biggerFirst = orig > swap;
    const diff = Math.abs(orig - swap);
    const s = a + b;
    const askSwap = chance(.5);
    const ans = askSwap ? swap : orig;
    const res = numericOpts(ans, { dp: 0, extra: [orig, swap, orig + diff, s * 5, Math.round((orig + swap) / 2)] });
    const dirTxt = biggerFirst ? '小' : '大';
    const stem = `一个两位数，十位数字与个位数字之和为 <b>${s}</b>；把十位与个位数字对调后，新数比原数${dirTxt} <b>${diff}</b>。${askSwap ? '对调后' : '原来'}的两位数是（　）：`;
    const hi = Math.max(a, b), lo = Math.min(a, b);
    const analysis = `数字对调差值规律：<b>新数 − 原数 ＝ 9×（个位 − 十位）</b>，故个位比十位大 ${diff}÷9 ＝ ${diff / 9}。<br>
      与「数字之和 ${s}」联立：两数字为 (${s}＋${diff / 9})÷2＝${hi} 和 (${s}−${diff / 9})÷2＝${lo}，
      原数 ${dirTxt === '大' ? '小于' : '大于'}对调后的数 → 原数 <b class="num key">${orig}</b>、对调后 ${swap}，选 <b>${res.options[res.ansIdx].k}</b>。<br>
      <em>这类题直接代入选项更快：先拿「和为 ${s}」筛掉一批，再验差值。</em>`;
    return mk('shuwei', '代入排除 · 数字对调', level, stem, null, res, analysis,
      '对调差 = 9×(个位−十位)，和与差奇偶性相同');
  }

  /* ════════ 第二章 方程法 ════════ */

  function genJitu(level) {
    const H = rnd(level === 'warm' ? 10 : 18, level === 'warm' ? 30 : 46);
    const R = rnd(3, H - 4);
    const F = 2 * H + 2 * R;
    const askRabbit = chance(.6);
    const ans = askRabbit ? R : H - R;
    const res = numericOpts(ans, { dp: 0, extra: [R, H - R, F / 2 - H, R + 2] });
    const stem = `笼子里有鸡和兔共 <b>${H}</b> 个头、<b>${F}</b> 只脚。${askRabbit ? '兔' : '鸡'}有（　）只：`;
    const analysis = `假设全是鸡：应有 ${2 * H} 只脚，实际多出 ${F}−${2 * H}＝${F - 2 * H} 只；<br>
      每只兔比鸡多 2 只脚 → 兔 ＝ ${F - 2 * H}÷2 ＝ <b class="num key">${R}</b> 只，鸡 ${H - R} 只，选 <b>${res.options[res.ansIdx].k}</b>。<br>
      <em>口诀「假设全鸡，差脚折半得兔」。方程法同样快：设兔 x，则 4x＋2(${H}−x)＝${F}。</em>`;
    return mk('jitu', '方程法 · 鸡兔同笼', level, stem, null, res, analysis,
      '假设全鸡，差脚折半得兔');
  }

  function genYingkui(level) {
    const delta = rnd(1, 3), a1 = rnd(2, 5), a2 = a1 + delta;
    const k = rnd(7, level === 'warm' ? 12 : 24);      // 人数（k*delta≥6 保证两次“盈/亏”都为正）
    let e1 = rnd(1, 9), s2 = k * delta - e1;
    if (s2 <= 0) { e1 = k * delta - rnd(1, 5); s2 = k * delta - e1; }
    const total = a1 * k + e1;
    const res = numericOpts(k, { dp: 0, extra: [total, k + delta, e1 + s2, total / a2] });
    const item = pick(['苹果', '橘子', '图书', '纪念品', '气球']);
    const who = pick(['小朋友', '学生', '员工']);
    const stem = `把${item}分给一批${who}，每人分 <b>${a1}</b> 个则多出 <b>${e1}</b> 个；每人分 <b>${a2}</b> 个则还缺 <b>${s2}</b> 个。这批${who}有（　）人：`;
    const analysis = `两次分配的<b>总量差</b> ＝ 多出的＋缺的 ＝ ${e1}＋${s2}＝${e1 + s2} 个；<br>
      造成差距的原因是每人多拿 ${a2}−${a1}＝${delta} 个 → 人数 ＝ ${e1 + s2}÷${delta} ＝ <b class="num key">${k}</b> 人，
      ${item}共 ${a1}×${k}＋${e1}＝${total} 个，选 <b>${res.options[res.ansIdx].k}</b>。<br>
      <em>盈亏公式：人数＝(盈＋亏)÷两次分配差。干扰项里混着${item}总数（${total}），看清问的是“人”还是“物”。</em>`;
    return mk('yingkui', '方程法 · 盈亏问题', level, stem, null, res, analysis,
      '人数 =（盈+亏）÷ 分配差');
  }

  function genBuding(level) {
    let a, b, x0, y0, sols;
    let guard = 0;
    do {
      a = rnd(2, 9); b = rnd(2, 9);
      x0 = rnd(1, 12); y0 = rnd(1, 9);
      const Cn = a * x0 + b * y0;
      sols = [];
      for (let x = 1; x <= Math.floor((Cn - 1) / a); x++) {
        const rem = Cn - a * x;
        if (rem > 0 && rem % b === 0) sols.push([x, rem / b]);
      }
    } while (guard++ < 200 && sols.length !== 1);
    const Cn = a * x0 + b * y0;
    const askX = chance(.5);
    const ans = askX ? x0 : y0;
    const parityNote = a % 2 === 0
      ? `a＝${a} 是偶数 → ${a}x 恒为偶 → ${b}y 的奇偶性与 ${Cn} 相同，先把 y 的奇偶锁定为 <b>${y0 % 2 === 0 ? '偶' : '奇'}</b> 数，缩小一半范围。`
      : b % 2 === 0
        ? `b＝${b} 是偶数 → ${b}y 恒为偶 → ${a}x 的奇偶性与 ${Cn} 相同，x 必为<b>${x0 % 2 === 0 ? '偶' : '奇'}</b>数。`
        : `用尾数法：${a}x 的尾数只能是 0/${a} 的倍数尾数，结合 ${Cn} 的尾数试 2~3 次即可。`;
    const res = numericOpts(ans, { dp: 0, extra: [x0, y0, x0 + y0, ans + 1, Cn / (a + b)] });
    const itemA = pick(['钢笔', '笔记本', '水杯', '雨伞']), itemB = pick(['橡皮', '签字笔', '便签', '胶带']);
    const stem = `商店里${itemA}每件 <b>${a}</b> 元、${itemB}每件 <b>${b}</b> 元。某老师恰好花 <b>${Cn}</b> 元买了两件商品若干件（两种都买了）。${askX ? itemA : itemB}买了（　）件：`;
    const analysis = `设${itemA} x 件、${itemB} y 件：${a}x＋${b}y＝${Cn}。<br>
      ${parityNote}<br>正整数解只有一组：x＝${x0}、y＝${y0}（验算 ${a}×${x0}＋${b}×${y0}＝${Cn} ✓），
      故${askX ? itemA : itemB}买了 <b class="num key">${ans}</b> 件，选 <b>${res.options[res.ansIdx].k}</b>。<br>
      <em>不定方程三板斧：<b>奇偶 → 尾数 → 整除特性</b>，比硬枚举快得多。</em>`;
    return mk('buding', '方程法 · 不定方程', level, stem, null, res, analysis,
      '奇偶 → 尾数 → 整除，三板斧缩小范围');
  }

  /* ════════ 第三章 赋值法 ════════ */

  function genGongzuo(level) {
    const t1 = rnd(level === 'warm' ? 4 : 8, level === 'warm' ? 12 : 40);
    const t2 = rnd(level === 'warm' ? 4 : 8, level === 'warm' ? 12 : 40);
    const L = lcm(t1, t2);
    const e1 = L / t1, e2 = L / t2;
    const coop = L / (e1 + e2);
    const dp = coop % 1 === 0 ? 0 : 1;
    const res = numericOpts(coop, { dp, extra: [(t1 + t2) / 2, t1 + t2, Math.min(t1, t2), L / (e1 * e2) * 1] });
    const stem = `一项工程，甲队单独做 <b>${t1}</b> 天完成，乙队单独做 <b>${t2}</b> 天完成。两队合作需要（　）天：`;
    const analysis = `没有任何总量数字 → <b>赋值总量＝${t1} 与 ${t2} 的最小公倍数 ${L}</b>；<br>
      效率：甲 ${L}÷${t1}＝${e1}，乙 ${L}÷${t2}＝${e2}；合作 ${L}÷(${e1}＋${e2})＝${L}/${e1 + e2} ≈ <b class="num key">${fmtDec(coop, dp)}</b> 天，选 <b>${res.options[res.ansIdx].k}</b>。<br>
      <em>工程问题铁律：合作时间<b>小于</b>两队单独时间中较小的那个。干扰项 ${(t1 + t2) / 2} 是“把时间取平均”的典型错解。</em>`;
    return mk('gongzuo', '赋值法 · 合作工程', level, stem, null, res, analysis,
      '赋值总量=最小公倍数，效率相加');
  }

  function genJiaoti(level) {
    const t1 = rnd(6, 15), t2 = rnd(6, 15);
    const L = lcm(t1, t2) * 2;
    const e1 = L / t1, e2 = L / t2;
    // 逐天模拟：第 1、3、5…天甲，第 2、4…天乙
    let rem = L, days = 0;
    while (rem > 0) {
      days++;
      rem -= (days % 2 === 1 ? e1 : e2);
    }
    const cycle = e1 + e2;
    const res = numericOpts(days, { dp: 0, add: 2, extra: [days - 1, days + 1, Math.ceil(L / cycle), L / Math.max(e1, e2)] });
    const stem = `一项工程，甲单独做 <b>${t1}</b> 天完成，乙单独做 <b>${t2}</b> 天完成。现按“甲做 1 天、乙做 1 天”轮流交替施工，完成这项工程共需（　）天：`;
    const fullCycles = Math.floor(L / cycle);
    const analysis = `赋值总量 ＝ ${t1}、${t2} 的最小公倍数的 2 倍 ＝ <b>${L}</b>；甲每天 ${e1}、乙每天 ${e2}。<br>
      一个周期（2 天）完成 ${cycle}；${fullCycles} 个整周期后剩 ${L - fullCycles * cycle}，按“单日甲、双日乙”接着做 → 第 ${days} 天收尾。<br>
      共需 <b class="num key">${days}</b> 天，选 <b>${res.options[res.ansIdx].k}</b>。<br>
      <em>交替工程的关键是<b>最后一天谁在做</b>——直接逐天模拟到收尾，别硬套公式。</em>`;
    return mk('jiaoti', '赋值法 · 交替工程', level, stem, null, res, analysis,
      '算整周期，再单独算收尾那天');
  }

  function genZhekou(level) {
    const r1 = rnd(2, 12) * 5;                       // 定价利润率 10%~60%
    const d = pick(level === 'warm' ? [7, 8, 9] : [6, 7, 8, 9]);
    const profitPct = 100 * (1 + r1 / 100) * d / 10 - 100;
    const dp = profitPct % 1 === 0 ? 0 : 1;
    const trapMinus = r1 - (10 - d) * 10;            // 直接相减
    const trapProd = r1 * d / 10;                    // 利润率×折扣
    const res = numericOpts(profitPct, { dp, extra: [trapMinus, trapProd, r1 / (10 - d) * 10] });
    const stem = `某商品按<b>利润率 ${r1}%</b> 定价，实际按定价的 <b>${d} 折</b>出售。出售该商品的利润率是（　）：`;
    const sell = 100 * (1 + r1 / 100) * d / 10;
    const analysis = `成本未知 → <b>赋值成本 100</b>：定价 100×(1＋${r1}%)＝${100 + r1}，<br>
      ${d} 折出售 ＝ ${100 + r1}×0.${d} ＝ ${fmtDec(sell, 2)}，利润 ${fmtDec(sell - 100, 2)} → 利润率
      <b class="num key">${pct1(profitPct)}</b>，选 <b>${res.options[res.ansIdx].k}</b>。<br>
      <em>陷阱对照：「${r1}%−(10−${d})×10%＝${trapMinus}%」是<b>错误算法</b>——折扣是打在“定价”上不是打在“成本”上，两者基数不同。</em>`;
    return mk('zhekou', '赋值法 · 定价与折扣', level, stem, null, res, analysis,
      '成本赋 100，折扣打在定价上');
  }

  function genNongdu(level) {
    const m1 = rnd(2, 8) * 50, m2 = rnd(2, 8) * 50;
    const c1 = rnd(4, 12) * 5, c2 = rnd(1, 6) * 5;
    const mixed = (m1 * c1 + m2 * c2) / (m1 + m2);
    const dp = mixed % 1 === 0 ? 0 : 1;
    const res = numericOpts(mixed, { dp, extra: [(c1 + c2) / 2, c1 * m1 / (m1 + m2), c1 - c2, mixed * 1.12] });
    const stem = `有 ${itemStr('A', m1, c1)}，${itemStr('B', m2, c2)}，两溶液混合后的浓度为（　）：`;
    const analysis = `溶质相加、溶液相加：(${m1}×${c1}%＋${m2}×${c2}%)÷${m1 + m2}<br>
      ＝(${fmtInt(m1 * c1 / 100)}＋${fmtInt(m2 * c2 / 100)})÷${m1 + m2}×100% ＝ <b class="num key">${pct1(mixed)}</b>，选 <b>${res.options[res.ansIdx].k}</b>。<br>
      <em>混合浓度必然<b>介于两个浓度之间</b>、且靠近质量大的一侧；${fmtDec((c1 + c2) / 2, 1)}% 这种算术平均是经典陷阱（只有质量相等时才成立）。</em>`;
    return mk('nongdu', '赋值法 · 浓度混合', level, stem, null, res, analysis,
      '溶质加溶质，溶液加溶液');
    function itemStr(tag, m, c) { return `<b>${tag}</b> 溶液 ${m} 克、浓度 <b>${c}%</b>`; }
  }

  /* ════════ 第四章 比例法 ════════ */

  function genSubi(level) {
    const p = rnd(2, 8), q = rnd(p + 1, 9);
    const dv = q - p;
    const tUnit = rnd(level === 'warm' ? 3 : 6, level === 'warm' ? 10 : 18);
    const k = dv * tUnit;
    const tA = k * q / dv, tB = k * p / dv;   // 甲慢 → 甲时间长
    const res = numericOpts(tB, { dp: 0, extra: [tA, k, tB + dv, tA - tB] });
    const stem = `甲、乙两人速度之比为 <b>${p}:${q}</b>。两人沿同一条路从 A 地到 B 地，甲比乙多用 <b>${k}</b> 分钟。乙全程用了（　）分钟：`;
    const analysis = `路程相同 → 时间与速度成<b>反比</b>：时间比 ${q}:${p}（速度小的用时多）。<br>
      甲比乙多 1 份时间 ＝ ${tA}−${tB}＝${k / dv} 分钟；<br>
      乙用 ${p} 份 ＝ <b class="num key">${tB}</b> 分钟，选 <b>${res.options[res.ansIdx].k}</b>。<br>
      <em>比例法核心：S 一定，v 与 t 成反比。干扰项 ${tA} 是把比例弄反的结果——先用“谁慢谁用时多”定方向再动笔。</em>`;
    return mk('subi', '比例法 · 速度比定时间', level, stem, null, res, analysis,
      'S 一定，v 与 t 成反比');
  }

  function genFenpei(level) {
    const p = rnd(1, 9), q = rnd(1, 9), r = rnd(1, 9);
    const P = p + q + r;
    const unit = rnd(level === 'warm' ? 8 : 24, level === 'warm' ? 40 : 120);
    const T = unit * P;
    const mx = Math.max(p, q, r), mn = Math.min(p, q, r);
    const askBig = chance(.6);
    const ans = unit * (askBig ? mx : mn);
    const res = numericOpts(ans, { dp: 0, extra: [unit * P, unit * mx, unit * mn, Math.round(T / 3)] });
    const stem = `奖金 <b>${fmtInt(T)}</b> 元按 <b>${p}:${q}:${r}</b> 分给甲、乙、丙三人，${askBig ? '分得最多' : '分得最少'}的一人拿（　）元：`;
    const analysis = `总份数 ${p}＋${q}＋${r}＝${P} 份 → 每份 ${fmtInt(T)}÷${P}＝${unit} 元；<br>
      ${askBig ? '最大' : '最小'}份额 ${askBig ? mx : mn} 份 ＝ ${unit}×${askBig ? mx : mn} ＝
      <b class="num key">${ans}</b> 元，选 <b>${res.options[res.ansIdx].k}</b>。<br>
      <em>比例分配三步：加总份数 → 求每份 → 按份取值。先求“每份”这个中间量，三个人的金额就全有了。</em>`;
    return mk('fenpei', '比例法 · 按比分配', level, stem, null, res, analysis,
      '先求“每份”，再按份取值');
  }

  /* ════════ 第五章 行程问题 ════════ */

  function genXiangyu(level) {
    const v1 = rnd(3, 14) * 5, v2 = rnd(3, 14) * 5;
    const t = pick([1, 2, 3, 4]);
    const S = (v1 + v2) * t;
    const askDist = chance(.55);
    const dist = v1 * t;
    const trueVal = askDist ? dist : S;
    const res = numericOpts(trueVal, { dp: 0, extra: [dist, v2 * t, S / 2, t, S / v1] });
    const stem = `甲、乙两车分别从 A、B 两地同时出发，<b>相向而行</b>。甲车速度 ${v1} 千米/时、乙车 ${v2} 千米/时，两车出发后 <b>${t}</b> 小时相遇。${askDist ? `相遇地点距 A 地（　）千米` : `A、B 两地相距（　）千米`}：`;
    const analysis = askDist
      ? `相遇时两车走的<b>时间相同</b>都是 ${t} 小时 → 距 A 地 ＝ 甲的路程 ＝ ${v1}×${t} ＝ <b class="num key">${dist}</b> 千米，选 <b>${res.options[res.ansIdx].k}</b>。<br>
         <em>验证：全程 ＝ (${v1}＋${v2})×${t} ＝ ${S} 千米 ＝ ${dist}＋${v2 * t} ✓。干扰项 ${v2 * t} 是“距 B 地”的距离——先看清楚以哪地为基准。</em>`
      : `相遇问题：路程和 ＝ 速度和 × 时间 → S ＝ (${v1}＋${v2})×${t} ＝ <b class="num key">${S}</b> 千米，选 <b>${res.options[res.ansIdx].k}</b>。<br>
         <em>口诀：相遇 — 速度<b>相加</b>；追及 — 速度<b>相减</b>。</em>`;
    return mk('xiangyu', '行程 · 相遇', level, stem, null, res, analysis, '相遇加，追及减');
  }

  function genZhuiji(level) {
    const dv = rnd(1, 8) * 5;
    const v2 = rnd(3, 10) * 5, v1 = v2 + dv;
    const t = pick([1, 2, 3, 4]);
    const D0 = dv * t;
    const askTime = chance(.5);
    const trueVal = askTime ? t : v1 * t;
    const res = numericOpts(trueVal, { dp: 0, extra: [t, D0, D0 / (v1 + v2), v1 * t] });
    const stem = `乙车以 ${v2} 千米/时的速度先行，甲车以 ${v1} 千米/时的速度出发追击。<b>出发时两车相距 ${D0} 千米</b>（乙在前）。问${askTime ? `甲经过（　）小时追上乙` : `甲追上乙时走了（　）千米`}：`;
    const analysis = `追及问题：追及时间 ＝ 初始距离差 ÷ 速度差 ＝ ${D0}÷(${v1}−${v2}) ＝ ${D0}/${dv} ＝ <b class="num key">${t}</b> 小时。<br>
      ${!askTime ? `追上时甲走了 ${v1}×${t} ＝ <b class="num key">${v1 * t}</b> 千米（乙走了 ${v2}×${t}＝${v2 * t}，多走的正好是 ${D0} 差距 ✓）。` : ''}选 <b>${res.options[res.ansIdx].k}</b>。<br>
      <em>干扰项 ${D0 / (v1 + v2)} 是把追及当成了相遇（速度相加）——方向一错全错。</em>`;
    return mk('zhuiji', '行程 · 追及', level, stem, null, res, analysis, '追及用速度差');
  }

  function genLiushui(level) {
    const v = rnd(4, 16), u = rnd(1, Math.min(5, v - 1));
    const S2 = lcm(v + u, v - u) * rnd(1, 3);
    const tShun = S2 / (v + u), tNi = S2 / (v - u);
    const shipV = (S2 / tShun + S2 / tNi) / 2;           // = v
    const waterV = (S2 / tShun - S2 / tNi) / 2;          // = u
    const askWater = chance(.5);
    const trueVal = askWater ? waterV : shipV;
    const res = numericOpts(trueVal, { dp: 0,
      extra: [waterV, shipV, S2 / tShun, S2 / tNi, waterV * 2] });
    const stem = `一艘船顺流航行 ${fmtInt(S2)} 千米需要 <b>${tShun}</b> 小时，逆流返回同样路程需要 <b>${tNi}</b> 小时。问${askWater ? '水流速度' : '船在静水中的速度'}是（　）千米/时：`;
    const analysis = `顺速 ＝ ${fmtInt(S2)}÷${tShun} ＝ ${fmtDec(S2 / tShun, 1)}，逆速 ＝ ${fmtInt(S2)}÷${tNi} ＝ ${fmtDec(S2 / tNi, 1)}；<br>
      核心方程：船速＝(顺速＋逆速)÷2，水速＝(顺速−逆速)÷2。<br>
      ${askWater ? `水速 ＝ (${fmtDec(S2 / tShun, 1)}−${fmtDec(S2 / tNi, 1)})÷2 ＝ <b class="num key">${fmtDec(waterV, 0)}</b> 千米/时` :
        `船速 ＝ (${fmtDec(S2 / tShun, 1)}＋${fmtDec(S2 / tNi, 1)})÷2 ＝ <b class="num key">${fmtDec(shipV, 0)}</b> 千米/时`}，选 <b>${res.options[res.ansIdx].k}</b>。<br>
      <em>公式别记反：顺速＝船＋水、逆速＝船−水；两式相加除二得船速、相减除二得水速。干扰项里有把“两倍水速”当水速的。</em>`;
    return mk('liushui', '行程 · 流水行船', level, stem, null, res, analysis,
      '船速=(顺+逆)/2，水速=(顺−逆)/2');
  }

  function genJunsumidu(level) {
    const v1 = rnd(4, 15) * 5, v2 = rnd(4, 15) * 5;
    const avg = 2 * v1 * v2 / (v1 + v2);
    const dp = avg % 1 === 0 ? 0 : 1;
    const res = numericOpts(avg, { dp, extra: [(v1 + v2) / 2, v1 * v2 / (v1 + v2), Math.min(v1, v2), avg * 1.05] });
    const stem = `某人骑车去程速度 ${v1} 千米/时，沿原路返回速度 ${v2} 千米/时。往返全程的平均速度是（　）千米/时：`;
    const analysis = `等距离平均速度 ＝ <b>2v₁v₂/(v₁＋v₂)</b> ＝ 2×${v1}×${v2}÷(${v1}＋${v2}) ＝ ${fmtInt(2 * v1 * v2)}÷${v1 + v2} ＝
      <b class="num key">${fmtDec(avg, dp)}</b>，选 <b>${res.options[res.ansIdx].k}</b>。<br>
      <em>最大陷阱：算术平均 (${v1}＋${v2})/2＝${fmtDec((v1 + v2) / 2, 1)}——平均速度是<b>总路程÷总时间</b>，慢的那程耗时更久，永远把结果往慢速那边拉。</em>`;
    return mk('junsumidu', '行程 · 等距平均速', level, stem, null, res, analysis,
      '调和平均，结果偏向慢速');
  }

  /* ════════ 第六章 经济利润 ════════ */

  function genLirun(level) {
    let c, r, sell, guard = 0;
    do {
      c = rnd(level === 'warm' ? 4 : 8, level === 'warm' ? 20 : 60) * 25;
      r = rnd(2, 14) * 5;
      sell = c * (1 + r / 100);
    } while (!Number.isInteger(sell) && guard++ < 200);
    if (!Number.isInteger(sell)) { c = 200; r = 50; sell = 300; }
    const cost = c;                               // 恒等于 sell/(1+r/100)
    const res = numericOpts(cost, { dp: 0,
      extra: [sell, cost, sell - cost, sell * (1 - r / 100)] });
    const stem = `某商品按<b>利润率 ${r}%</b> 定价后售价为 <b>${fmtInt(sell)}</b> 元。这件商品的成本是（　）元：`;
    const analysis = `利润率 ＝ (售价−成本)÷<b>成本</b> → 成本 ＝ 售价÷(1＋利润率)<br>
      ＝ ${fmtInt(sell)}÷(1＋${r}%) ＝ ${fmtInt(sell)}/1.${String(r).padStart(2, '0')} ＝ <b class="num key">${fmtInt(cost)}</b> 元，选 <b>${res.options[res.ansIdx].k}</b>。<br>
      <em>易错点：成本 ≠ 售价×(1−${r}%)＝${fmtInt(sell * (1 - r / 100))}（干扰项）。利润率的基数是成本，不是售价；反过来“销售利润率”基数才是售价，看清定义。</em>`;
    return mk('lirun', '利润 · 成本还原', level, stem, null, res, analysis,
      '成本 = 售价 ÷(1+利润率)');
  }

  function genFenduan(level) {
    const a = rnd(3, 8) * 2, b = a + rnd(2, 6);
    const p1 = rnd(2, 3), p2 = p1 + rnd(1, 2), p3 = p2 + rnd(1, 2);
    const W = b + rnd(2, 14);
    const fee = a * p1 + (b - a) * p2 + (W - b) * p3;
    const res = numericOpts(fee, { dp: 0, extra: [W * p1, W * p2, a * p1 + (b - a) * p2, W * p3] });
    const kind = pick(['自来水', '居民用电', '管道燃气']);
    const stem = `某市${kind}实行阶梯计价：每月 ${a} 吨（度）以内 ${p1} 元/单位，超过 ${a} 至 ${b} 单位部分 ${p2} 元/单位，超过 ${b} 单位部分 ${p3} 元/单位。某户本月用量 <b>${W}</b> 单位，应缴费（　）元：`;
    const analysis = `分段拆解：${a}×${p1} ＋ (${b}−${a})×${p2} ＋ (${W}−${b})×${p3}<br>
      ＝ ${a * p1}＋${(b - a) * p2}＋${(W - b) * p3} ＝ <b class="num key">${fee}</b> 元，选 <b>${res.options[res.ansIdx].k}</b>。<br>
      <em>分段计费只对“超出部分”适用更高单价。干扰项 ${W * p2} 是“全按第二档算”的偷懒解——分段题先把区间写清楚再算。</em>`;
    return mk('fenduan', '利润 · 分段计费', level, stem, null, res, analysis,
      '分段只对“超出部分”涨价');
  }

  function genMaizeng(level) {
    const pairs = [[2, 1], [3, 1], [4, 1], [3, 2], [5, 2], [4, 3], [5, 3]];
    const [x, y] = pick(level === 'warm' ? pairs.slice(0, 3) : pairs);
    const zhe = 10 * x / (x + y);
    const dp = zhe % 1 === 0 ? 0 : 1;
    const res = numericOpts(zhe, { dp, extra: [10 * y / (x + y), 10 * y / x, 10 - 10 * y / x, 10 * (x - y) / x] });
    const item = pick(['酸奶', '洗衣液', '面包', '饮料']);
    const stem = `某超市${item}开展“<b>买 ${x} 送 ${y}</b>”促销。相当于按原价的（　）折出售：`;
    const analysis = `买 ${x} 送 ${y}：花 ${x} 件的钱拿到 ${x}＋${y}＝${x + y} 件 → 实际单价是原价的 ${x}/${x + y}；<br>
      折数 ＝ 10×${x}/${x + y} ＝ <b class="num key">${fmtDec(zhe, dp)}</b> 折，选 <b>${res.options[res.ansIdx].k}</b>。<br>
      <em>口诀：买 x 送 y → 折数＝10x/(x＋y)。“买三送一”就是 7.5 折，不是“便宜三分之一再折”。</em>`;
    return mk('maizeng', '利润 · 买送折扣', level, stem, null, res, analysis,
      '买x送y → 10x/(x+y) 折');
  }

  /* ════════ 第七章 排列组合与概率 ════════ */

  function genXuanren(level) {
    const n = rnd(4, 8), m = rnd(3, 8);
    const k = rnd(2, Math.min(4, n + m - 2));
    const i = rnd(Math.max(0, k - m), Math.min(k, n));
    const ans = C(n, i) * C(m, k - i);
    const res = numericOpts(ans, { dp: 0, sortAsc: false,
      extra: [C(n, i) + C(m, k - i), C(n + m, k), C(n, k - i) * C(m, i), ans * 2] });
    const stem = `某小组有 <b>${n}</b> 名男生、<b>${m}</b> 名女生，现从中选出 <b>${k}</b> 人参加活动，要求其中恰好 <b>${i}</b> 名男生。共有（　）种选法：`;
    const analysis = `分两步取：男生选 ${i} 人有 C(${n},${i})＝${C(n, i)} 种，女生选 ${k - i} 人有 C(${m},${k - i})＝${C(m, k - i)} 种；<br>
      分步相乘：${C(n, i)}×${C(m, k - i)} ＝ <b class="num key">${ans}</b> 种，选 <b>${res.options[res.ansIdx].k}</b>。<br>
      <em>「分类相加、分步相乘」——先判断是分类还是分步。干扰项 ${C(n, i) + C(m, k - i)} 把乘法做成了加法。</em>`;
    return mk('xuanren', '排列组合 · 分步选人', level, stem, null, res, analysis,
      '分类相加，分步相乘');
  }

  function genPailie(level) {
    const n = rnd(4, 6);
    const adjacent = chance(.55);
    const ans = adjacent ? fact(n - 1) * 2 : fact(n) - fact(n - 1) * 2;
    const res = numericOpts(ans, { dp: 0, sortAsc: false,
      extra: [fact(n), fact(n - 1), fact(n - 1) * 2, fact(n) / 2] });
    const names = ['演讲', '合唱', '朗诵', '舞蹈', '小品', '魔术'];
    const stem = `${n} 个节目排成一条演出顺序（节目各不相同）${adjacent ? `，其中<b>甲、乙两个节目必须相邻</b>` : `，其中<b>甲、乙两个节目不能相邻`}。共有（　）种排法：`;
    const analysis = adjacent
      ? `捆绑法：把甲乙捆成一个整体，与其余 ${n - 2} 个节目共 ${n - 1} 个元素全排列 (${n - 1})!＝${fact(n - 1)}；<br>
         再给捆绑体内部排序 ×2 → ${fact(n - 1)}×2 ＝ <b class="num key">${ans}</b> 种，选 <b>${res.options[res.ansIdx].k}</b>。<br>
         <em>捆绑法两步：先整体、后内部。</em>`
      : `插空法：先排其余 ${n - 2} 个节目，共 (${n - 2})!＝${fact(n - 2)} 种，形成 ${n - 1} 个空隙；<br>
         甲乙从空隙中选 2 个排列：A(${n - 1},2)＝${(n - 1) * (n - 2)} → ${fact(n - 2)}×${(n - 1) * (n - 2)} ＝ <b class="num key">${ans}</b> 种，选 <b>${res.options[res.ansIdx].k}</b>。<br>
         <em>验证：全排 ${fact(n)}−相邻 ${fact(n - 1) * 2}＝${fact(n) - fact(n - 1) * 2} ✓。不相邻用插空，相邻用捆绑。</em>`;
    const tag = adjacent ? '排列组合 · 相邻捆绑' : '排列组合 · 不相邻插空';
    return mk('pailie', tag, level, stem, null, res, analysis,
      adjacent ? '先捆绑成整体，再排内部' : '先排其它，往空隙里插');
  }

  function genGailv(level) {
    const a = rnd(3, 7), b = rnd(2, 6);
    const k = pick([2, 3]);
    const i = rnd(1, Math.min(k, a));
    if (k - i > b) return genGailv(level);
    const num = C(a, i) * C(b, k - i), den = C(a + b, k);
    const pctAns = num / den * 100;
    const dp = 1;
    const res = numericOpts(pctAns, { dp, extra: [pctAns * 2, 100 - pctAns, (a / (a + b)) * 100, pctAns * 0.6] });
    const colA = pick(['红球', '白球', '黑球']), colB = colA === '红球' ? '白球' : '红球';
    const stem = `袋中有 <b>${a}</b> 个${colA}、<b>${b}</b> 个${colB}（除颜色外完全相同）。随机摸出 <b>${k}</b> 个球，恰好摸出 <b>${i}</b> 个${colA}的概率约为（　）：`;
    const analysis = `古典概型：总取法 C(${a + b},${k})＝${den} 种；<br>
      恰好 ${i} 个${colA}：C(${a},${i})×C(${b},${k - i})＝${C(a, i)}×${C(b, k - i)}＝${num} 种；<br>
      P ＝ ${num}/${den} ≈ <b class="num key">${pct1(pctAns)}</b>，选 <b>${res.options[res.ansIdx].k}</b>。<br>
      <em>概率题先数清楚“分子取法数”和“分母总取法数”，都是组合数；干扰项 ${pct1(100 - pctAns)} 是“至少/恰好”问法搞反的结果。</em>`;
    return mk('gailv', '概率 · 古典概型', level, stem, null, res, analysis,
      '分子分母都是组合数');
  }

  /* ════════ 第八章 几何·容斥·最值 ════════ */

  function genJihe(level) {
    if (level === 'real' && chance(.6)) {
      // 周长+比例 → 面积
      const p = rnd(2, 5), q = p + rnd(1, 4);
      const unit = rnd(2, 6);
      const P = 2 * (p + q) * unit;
      const L = p * unit, W = q * unit;
      const area = L * W;
      const res = numericOpts(area, { dp: 0, extra: [2 * (L + W), L + W, (P / 2) * (P / 2), area * 1.2] });
      const stem = `一个长方形周长为 <b>${P}</b> 厘米，长与宽之比为 <b>${p}:${q}</b>。它的面积是（　）平方厘米：`;
      const analysis = `周长的一半＝长＋宽＝${P / 2}，按 ${p}:${q} 分：长＝${P / 2}×${p}/${p + q}＝${L}，宽＝${W}；<br>
        面积 ＝ ${L}×${W} ＝ <b class="num key">${area}</b> 平方厘米，选 <b>${res.options[res.ansIdx].k}</b>。<br>
        <em>常见错误：拿周长直接按比例分（忘除以 2）。周长 → 先除以 2 再按比分配。</em>`;
      return mk('jihe', '几何 · 周长比例求面积', level, stem, null, res, analysis, '周长先除以 2 再分配');
    }
    const shape = pick(['rect', 'circle']);
    if (shape === 'rect') {
      const l = rnd(5, 40), w = rnd(3, l - 2);
      const area = l * w;
      const res = numericOpts(area, { dp: 0, extra: [2 * (l + w), l + w, l * w * 1.15, (l + 2) * (w + 2)] });
      const stem = `一块长方形草地长 <b>${l}</b> 米、宽 <b>${w}</b> 米，它的面积是（　）平方米：`;
      const analysis = `长×宽 ＝ ${l}×${w} ＝ <b class="num key">${area}</b> 平方米，选 <b>${res.options[res.ansIdx].k}</b>。<br>
         <em>干扰项 ${2 * (l + w)} 是周长——看清问“面积”还是“周长”，以及单位（米/平方米）。</em>`;
      return mk('jihe', '几何 · 长方形面积', level, stem, null, res, analysis, '面积与周长看清再算');
    }
    const r = rnd(2, 12);
    const area = 3.14 * r * r;
    const dp = 2;
    const res = numericOpts(area, { dp, extra: [2 * 3.14 * r, 3.14 * 2 * r, 3.14 * (r / 2) * (r / 2), area * 1.1] });
    const stem = `一个圆形花坛半径为 <b>${r}</b> 米（π 取 3.14），它的面积约是（　）平方米：`;
    const analysis = `S＝πr² ＝ 3.14×${r}² ＝ 3.14×${r * r} ＝ <b class="num key">${fmtDec(area, 2)}</b> 平方米，选 <b>${res.options[res.ansIdx].k}</b>。<br>
       <em>干扰项 ${fmtDec(2 * 3.14 * r, 2)} 是周长。半径与直径别混：给直径 D 时先除以 2 得 r。</em>`;
    return mk('jihe', '几何 · 圆的面积', level, stem, null, res, analysis, '给直径先除 2，πr² 别记成 2πr');
  }

  function genRongchi(level) {
    if (level === 'real' && chance(.55)) {
      // 三集合标准公式
      const a = rnd(20, 45), b = rnd(18, 42), c = rnd(15, 38);
      const ab = rnd(4, Math.min(a, b) - 2), ac = rnd(3, Math.min(a, c) - 2), bc = rnd(3, Math.min(b, c) - 2);
      const t = rnd(2, Math.min(ab, ac, bc) - 1);
      const total = a + b + c - (ab + ac + bc) + t;
      const res = numericOpts(total, { dp: 0,
        extra: [a + b + c - (ab + ac + bc), a + b + c, total - t, total + t] });
      const stem = `某班同学中，喜欢数学的 <b>${a}</b> 人、喜欢物理的 <b>${b}</b> 人、喜欢化学的 <b>${c}</b> 人；
        同时喜欢数学和物理的 <b>${ab}</b> 人、数学和化学的 <b>${ac}</b> 人、物理和化学的 <b>${bc}</b> 人；
        三科都喜欢的 <b>${t}</b> 人。至少喜欢其中一科的同学有（　）人：`;
      const analysis = `三集合容斥标准公式：A∪B∪C ＝ A＋B＋C −(AB＋AC＋BC) ＋ ABC<br>
        ＝ ${a}＋${b}＋${c} −(${ab}＋${ac}＋${bc}) ＋ ${t} ＝ ${a + b + c}−${ab + ac + bc}＋${t} ＝ <b class="num key">${total}</b> 人，选 <b>${res.options[res.ansIdx].k}</b>。<br>
        <em>两两重叠部分被减了 3 次、加回来时三重叠部分被多减了 1 次——所以<b>最后要 + 三科都喜欢的</b>。漏掉这一项正是干扰项 ${a + b + c - (ab + ac + bc)}。</em>`;
      return mk('rongchi', '容斥 · 三集合', level, stem, null, res, analysis,
        '标准公式最后 + 三重叠项');
    }
    // 二集合
    const A = rnd(20, 60), B = rnd(15, 55), both = rnd(5, Math.min(A, B) - 3), neither = rnd(3, 25);
    const total = A + B - both + neither;
    const res = numericOpts(total, { dp: 0, extra: [A + B - both, A + B + neither, total - neither, both] });
    const actA = pick(['参加合唱团', '报名书法班', '喜欢跑步']), actB = pick(['参加篮球队', '报名绘画班', '喜欢游泳']);
    const stem = `某年级 ${actA}的有 <b>${A}</b> 人，${actB}的有 <b>${B}</b> 人，两者都参加（喜欢）的有 <b>${both}</b> 人，两者都不参加（喜欢）的有 <b>${neither}</b> 人。该年级共有（　）人：`;
    const analysis = `二集合容斥：总数 ＝ A＋B − AB ＋ 都不<br>
      ＝ ${A}＋${B} −${both} ＋ ${neither} ＝ <b class="num key">${total}</b> 人，选 <b>${res.options[res.ansIdx].k}</b>。<br>
      <em>并集把重叠部分数了两次、减一次即可；别忘了把“都不”的加回来。画个两圆韦恩图 30 秒搞定，别硬背公式。</em>`;
    return mk('rongchi', '容斥 · 二集合', level, stem, null, res, analysis,
      'A+B−AB+都不');
  }

  function genHeding(level) {
    if (level === 'real' && chance(.5)) {
      // 最不利构造
      const k = rnd(3, 5);
      const counts = Array.from({ length: k }, () => rnd(4, 10));
      const j = pick([3, 4]);
      const ans = counts.reduce((s, c) => s + Math.min(c, j - 1), 0) + 1;
      const res = numericOpts(ans, { dp: 0, extra: [ans - 1, counts.reduce((s, c) => s + c, 0) + 1, Math.max(...counts) + j, ans + j] });
      const cols = ['红色', '黄色', '蓝色', '白色', '黑色'].slice(0, k);
      const stem = `袋中有${cols.map((c, i) => `<b>${cols[i]}</b>袜子 ${counts[i]} 只`).join('、')}（袜子不成对也可穿）。至少摸出（　）只袜子，才能保证其中有 <b>${j}</b> 只同色：`;
      const analysis = `最不利原则：先考虑<b>最倒霉的情况</b>——每种颜色都恰好摸到 ${j - 1} 只却凑不齐 ${j} 只同色：<br>
        ${counts.map((c) => Math.min(c, j - 1)).join('＋')} ＋ 1 ＝ <b class="num key">${ans}</b> 只，选 <b>${res.options[res.ansIdx].k}</b>。<br>
        <em>「保证」两字 = 最不利构造：把最坏的取法取满，再加 1 就必然达成。数量多的颜色不影响下限（被 min 截断）。</em>`;
      return mk('heding', '最值 · 最不利构造', level, stem, null, res, analysis,
        '保证 = 最坏情况 + 1');
    }
    // 和定最值
    const n = rnd(3, 8);
    const m = rnd(10, 30);
    const S = n * m - n * (n - 1) / 2 - rnd(0, n - 1);
    const res = numericOpts(m, { dp: 0, extra: [m - 1, Math.floor(S / n), m + 1, m - 2] });
    const stem = `将 <b>${S}</b> 分成 <b>${n}</b> 个互不相同的正整数之和。其中最大的那个数<b>最小</b>可能是（　）：`;
    const analysis = `要让最大的数尽量小 → ${n} 个数尽量<b>接近</b>。取连续 ${n} 个整数试探：<br>
      和最小的一组“最大值＝${m}”的互异正整数和为 ${n}×${m}−${n * (n - 1) / 2}（即 ${m}+${m - 1}+…+${m - n + 1}），不小于 ${S}，
      且“最大值＝${m - 1}”时最大总和 ${n * (m - 1) - n * (n - 1) / 2}＜${S} 不够分 → 最大数最小是 <b class="num key">${m}</b>，选 <b>${res.options[res.ansIdx].k}</b>。<br>
      <em>和定最值口诀：求最大最小 → 其余取到极端（最大者小 ↔ 其他尽量大）；互不相同的构造从连续整数入手。</em>`;
    return mk('heding', '最值 · 和定最值', level, stem, null, res, analysis,
      '想“最小”，就让其余的尽量大');
  }

  /* ── 注册 ─────────────────────────────────────────────── */
  const GEN = {
    tongyu: genTongyu, nianling: genNianling, shuwei: genShuwei,
    jitu: genJitu, yingkui: genYingkui, buding: genBuding,
    gongzuo: genGongzuo, jiaoti: genJiaoti, zhekou: genZhekou, nongdu: genNongdu,
    subi: genSubi, fenpei: genFenpei,
    xiangyu: genXiangyu, zhuiji: genZhuiji, liushui: genLiushui, junsumidu: genJunsumidu,
    lirun: genLirun, fenduan: genFenduan, maizeng: genMaizeng,
    xuanren: genXuanren, pailie: genPailie, gailv: genGailv,
    jihe: genJihe, rongchi: genRongchi, heding: genHeding,
  };

  window.SUSUAN_NUMGEN = {
    gen(id, level, hint) {
      const fn = GEN[id];
      if (!fn) throw new Error('unknown generator: ' + id);
      let q = fn(level, hint), guard = 0;
      while (guard++ < 8) {
        const bad =
          !q || !Array.isArray(q.options) || q.options.length < 2 ||
          q.ansIdx < 0 || q.ansIdx >= q.options.length ||
          new Set(q.options.map((o) => o.text ?? '')).size !== q.options.length ||
          String(q.stem + q.analysis).includes('NaN') || String(q.stem + q.analysis).includes('undefined');
        if (!bad) break;
        q = fn(level, hint);
      }
      return q;
    },
    /** 综合模考题型池 [generatorId, 权重] */
    EXAM_POOL: [
      ['tongyu', 3], ['nianling', 3], ['shuwei', 2],
      ['jitu', 3], ['yingkui', 3], ['buding', 4],
      ['gongzuo', 5], ['jiaoti', 2], ['zhekou', 4], ['nongdu', 3],
      ['subi', 3], ['fenpei', 2],
      ['xiangyu', 4], ['zhuiji', 4], ['liushui', 3], ['junsumidu', 3],
      ['lirun', 3], ['fenduan', 2], ['maizeng', 2],
      ['xuanren', 4], ['pailie', 4], ['gailv', 4],
      ['jihe', 3], ['rongchi', 3], ['heding', 3],
    ],
  };
})();
