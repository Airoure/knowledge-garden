/* ============================================================
 * 判断推理方法营 · 出题引擎
 * 图形推理（SVG 程序化生成）+ 类比推理（关系词库）
 * + 翻译/真假/分析推理（逻辑生成，内部暴力验证）
 * + 定义判断、加强削弱（手写题库轮换）
 * ============================================================ */
(function () {
  'use strict';

  const rnd = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const chance = (p) => Math.random() < p;
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const S = '#7dd3fc';

  /* ── SVG 基础 ─────────────────────────────────────────── */
  const svg = (inner, size = 68) =>
    `<svg viewBox="0 0 100 100" width="${size}" height="${size}" fill="none" stroke="${S}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">${inner}</svg>`;
  const poly = (pts, extra = '') => `<polygon points="${pts}" ${extra}/>`;
  const circ = (cx, cy, r, extra = '') => `<circle cx="${cx}" cy="${cy}" r="${r}" ${extra}/>`;
  const line = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  const rect = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`;

  /* 对称性图形库（属性均人工核验） */
  const SHAPE = {
    triIso: poly('50,12 86,80 14,80'),
    trapIso: poly('20,25 80,25 65,78 35,78'),
    arrow: poly('50,10 78,50 62,50 62,88 38,88 38,50 22,50'),
    para: poly('25,25 85,25 75,78 15,78'),
    zee: poly('18,22 82,22 82,40 42,60 82,60 82,78 18,78 18,60 58,40 18,40'),
    ellT: '<ellipse cx="50" cy="50" rx="38" ry="20" transform="rotate(35 50 50)"/>',
    rectA: rect(15, 30, 70, 42),
    rhomb: poly('50,10 88,50 50,90 12,50'),
    hex: poly('50,8 86,29 86,71 50,92 14,71 14,29'),
    circleA: circ(50, 50, 38),
    scalene: poly('18,26 82,14 88,74 30,84'),
    ell: '<ellipse cx="50" cy="50" rx="40" ry="24"/>',
  };
  const SYM_LABEL = {
    triIso: '仅轴对称', trapIso: '仅轴对称', arrow: '仅轴对称',
    para: '仅中心对称', zee: '仅中心对称', ellT: '仅中心对称',
    rectA: '既是轴对称又是中心对称', rhomb: '既是轴对称又是中心对称',
    hex: '既是轴对称又是中心对称', circleA: '既是轴对称又是中心对称',
    ell: '既是轴对称又是中心对称', scalene: '既非轴对称也非中心对称',
  };
  const MAIN_CLASSES = {
    axisOnly: ['triIso', 'trapIso', 'arrow'],
    centerOnly: ['para', 'zee', 'ellT'],
    both: ['rectA', 'rhomb', 'hex', 'circleA', 'ell'],
  };

  function mk(typeId, typeName, level, stem, exprHtml, options, ansIdx, analysis, tip) {
    options.forEach((o, i) => { o.k = 'ABCD'[i]; });
    return { typeId, typeName, level, stem, exprHtml, options, ansIdx, analysis, tip };
  }

  /* ════════ 图形推理 ════════ */

  // 1) 对称性找异类
  function genSym(level) {
    const clsNames = Object.keys(MAIN_CLASSES);
    const cls = pick(clsNames);
    const other = pick(clsNames.filter((c) => c !== cls));
    const keys = shuffle(MAIN_CLASSES[cls].slice(0, 3));
    const odd = pick(MAIN_CLASSES[other]);
    keys.splice(rnd(0, 3), 0, odd);
    const shown = shuffle(keys.slice(0, 4));
    const oddIdx = shown.indexOf(odd);
    const options = shown.map((key) => ({ text: '图形', html: svg(SHAPE[key]), isAns: key === odd }));
    const analysis = `逐个检查对称性：${shown.map((key, i) => `${'ABCD'[i]}：${SYM_LABEL[key]}`).join('；')}。<br>
      <b>${'ABCD'[oddIdx]}</b> 与其他三个的对称属性不同，选它。<br>
      <em>检查口诀：先横竖各对折一次（轴对称），再旋转 180° 看是否重合（中心对称）——两样都要试，别只试一种。</em>`;
    return mk('tuxing.sym', '图形推理 · 对称性', level,
      `下面四个图形中，<b>对称属性</b>与其他三个不同的是（　）：`,
      `<div class="svg-row">${shown.map((key) => `<div class="svg-cell">${svg(SHAPE[key])}</div>`).join('')}</div>`,
      options, oddIdx, analysis, '轴对称对折试，中心对称转半圈');
  }

  /* 封闭区域（面）图形库：每个面数 3 种不同构造（均已人工核验） */
  const FACE_FIGS = {
    1: [circ(50, 50, 38), poly('50,12 86,80 14,80'), rect(15, 30, 70, 42)],
    2: [rect(15, 25, 70, 50) + line(15, 25, 85, 75),
        circ(50, 50, 36) + line(14, 50, 86, 50),
        circ(28, 50, 20) + circ(72, 50, 20)],
    3: [circ(38, 50, 26) + circ(62, 50, 26),
        rect(15, 25, 70, 50) + line(38, 25, 38, 75) + line(62, 25, 62, 75),
        circ(25, 50, 15) + circ(50, 50, 15) + circ(75, 50, 15)],
    4: [rect(18, 18, 64, 64) + line(50, 18, 50, 82) + line(18, 50, 82, 50),
        rect(20, 20, 60, 60) + line(20, 20, 80, 80) + line(80, 20, 20, 80),
        circ(28, 28, 14) + circ(72, 28, 14) + circ(28, 72, 14) + circ(72, 72, 14)],
  };
  function genFaces(level) {
    const target = rnd(2, 4);
    const other = pick([1, 2, 3, 4].filter((x) => x !== target));
    const shown = [...FACE_FIGS[target], FACE_FIGS[other][rnd(0, 2)]];
    const disp = shuffle(shown);
    const oddIdx = disp.indexOf(shown[3]);
    const options = disp.map((inner) => ({ text: '图形', html: svg(inner), isAns: inner === shown[3] }));
    const analysis = `数每个图形的<b>封闭区域（面）</b>：${disp.map((inner, i) =>
      `${'ABCD'[i]}：${inner === shown[3] ? other : target} 个`).join('；')}。<br>
      <b>${'ABCD'[oddIdx]}</b> 的面数与其他三个不同，选它。<br>
      <em>数面技巧：内部被线条每切出一个小封闭区各算一面——外轮廓之外不算；“田”字 4 面、“日”字 2 面，两个相离圆是 2 面。</em>`;
    return mk('tuxing.faces', '图形推理 · 封闭区域数', level,
      `下面四个图形中，<b>封闭区域（面）的数量</b>与其他三个不同的是（　）：`,
      `<div class="svg-row">${disp.map((inner) => `<div class="svg-cell">${svg(inner)}</div>`).join('')}</div>`,
      options, oddIdx, analysis, '切一刀多一面，数面别数轮廓');
  }

  // 3) 部分数（连通块）
  const PART_SPOTS = [[28, 30], [72, 30], [30, 72], [72, 72], [50, 50]];
  const partShape = (i, cx, cy) => {
    const kind = i % 3;
    if (kind === 0) return circ(cx, cy, 15);
    if (kind === 1) return poly(`${cx - 16},${cy + 14} ${cx + 16},${cy + 14} ${cx},${cy - 16}`);
    return rect(cx - 14, cy - 12, 28, 24);
  };
  function figParts(k, variant) {
    const spots = shuffle(PART_SPOTS).slice(0, k);
    let inner = '';
    spots.forEach(([cx, cy], i) => { inner += partShape(i + variant, cx, cy); });
    return inner;
  }
  function genParts(level) {
    const target = rnd(1, 3);
    const other = pick([1, 2, 3, 4].filter((x) => x !== target));
    const disp = [figParts(target, 0), figParts(target, 1), figParts(other, 2), figParts(target, 2)];
    const oddIdx = 2;
    const options = disp.map((inner) => ({ text: '图形', html: svg(inner), isAns: inner === disp[2] }));
    const analysis = `数每个图形由<b>几个互不相连的部分</b>组成：${disp.map((inner, i) =>
      `${'ABCD'[i]}：${i === 2 ? other : target} 个部分`).join('；')}。<br>
      <b>${'ABCD'[oddIdx]}</b> 的部分数不同，选它。<br>
      <em>部分数＝连通块个数：只要有一点相连就算同一部分；相离的图形才分开数。</em>`;
    return mk('tuxing.parts', '图形推理 · 部分数', level,
      `下面四个图形中，<b>图形的部分数（连通部分个数）</b>与其他三个不同的是（　）：`,
      `<div class="svg-row">${disp.map((inner) => `<div class="svg-cell">${svg(inner)}</div>`).join('')}</div>`,
      options, oddIdx, analysis, '相连算一部分，相离才分开数');
  }

  // 4) 黑白块平移（3×3 双元素）
  const gridSvg = (blackSet) => {
    let inner = '';
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      const x = c * 30 + 5, y = r * 30 + 5;
      inner += blackSet.has(r * 3 + c)
        ? `<rect x="${x}" y="${y}" width="26" height="26" fill="${S}" stroke="${S}" stroke-width="1"/>`
        : `<rect x="${x}" y="${y}" width="26" height="26" fill="none" stroke-width="2"/>`;
    }
    return svg(inner, 74);
  };
  const sameSet = (s1, s2) => s1.size === s2.size && [...s1].every((v) => s2.has(v));
  function genShift(level) {
    const stepA = pick([1, 2, 3]), stepB = pick([1, 2, 3]);
    const start = rnd(0, 8);
    let pA = start, pB = (start + 4) % 9;
    const frames = [];
    for (let f = 0; f < 3; f++) {
      frames.push(new Set([pA, pB]));
      pA = (pA + stepA) % 9;
      pB = (pB + stepB) % 9;
    }
    const correct = new Set([pA, pB]);
    const cand = [
      new Set([pA, (pB + 1) % 9]),
      new Set([(pA - 1 + 9) % 9, pB]),
      new Set([frames[2].has(0) ? [...frames[2]][0] : 0, pB]),   // 静止（与图 3 相同）
      new Set([(pA + stepA) % 9, pB]),
    ];
    const wrongs = [];
    for (const c of shuffle(cand)) {
      if (wrongs.length < 3 && !sameSet(c, correct) && !wrongs.some((w) => sameSet(w, c))) wrongs.push(c);
    }
    let extra = 1;
    while (wrongs.length < 3) {
      const c = new Set([(pA + extra) % 9, (pB + extra + 1) % 9]);
      if (!sameSet(c, correct) && !wrongs.some((w) => sameSet(w, c))) wrongs.push(c);
      extra++;
    }
    const opts = shuffle([correct, ...wrongs]);
    const options = opts.map((s) => ({ text: '图形', html: gridSvg(s), isAns: sameSet(s, correct) }));
    const ansIdx = options.findIndex((o) => o.isAns);
    const cellName = (idx) => `第${Math.floor(idx / 3) + 1}行第${(idx % 3) + 1}列`;
    const exprHtml = `<div class="svg-row">${frames.map((f, i) =>
      `<div class="svg-cell"><span class="s-tag">${['图 1', '图 2', '图 3'][i]}</span>${gridSvg(f)}</div>`).join('')}
      <div class="svg-cell"><span class="s-tag">？</span><div style="width:74px;height:74px;display:grid;place-items:center;color:var(--mut);font-size:30px">?</div></div></div>`;
    const analysis = `轨道是 9 个格子的循环（按行数过去再绕回来），两个黑块<b>各自的步长不同</b>：<br>
      黑块一每幅图前进 ${stepA} 格、黑块二每幅图前进 ${stepB} 格。第 4 幅它们分别应在 ${cellName(pA)} 和 ${cellName(pB)}，<br>
      对应 <b>${'ABCD'[ansIdx]}</b>。<br>
      <em>位置类三步：定轨道 → 分元素追踪步长 → 逐幅验证。两个元素一定分开看；干扰项里有“原地不动”的选项，专坑没发现移动规律的人。</em>`;
    return mk('tuxing.shift', '图形推理 · 位置平移', level,
      `观察前三个图形中<b>黑块的移动规律</b>，问号处应填入的图形是（　）：`,
      exprHtml, options, ansIdx, analysis, '分元素追踪步长，一圈一圈数');
  }

  // 5) 旋转（含镜像陷阱）
  function genRotate(level) {
    const shape = poly('40,12 74,30 58,46 78,58 40,58') + `<circle cx="46" cy="70" r="4" fill="${S}" stroke="none"/>`;
    const base = rnd(0, 7) * 45;
    const step = 45;
    const rot = (deg, mirror) => `<g transform="rotate(${deg} 50 50)${mirror ? ' scale(-1,1) translate(-100,0)' : ''}">${shape}</g>`;
    const frames = [base, base + step, base + 2 * step];
    const correctDeg = base + 3 * step;
    const correct = rot(correctDeg, false);
    const wrongs = [rot(base + 2 * step, false), rot(correctDeg + 2 * step, false), rot(correctDeg, true)];
    const opts = shuffle([{ h: correct, ok: true }, { h: wrongs[0], ok: false }, { h: wrongs[1], ok: false }, { h: wrongs[2], ok: false }]);
    const options = opts.map((o) => ({ text: '图形', html: svg(o.h), isAns: o.ok }));
    const ansIdx = options.findIndex((o) => o.isAns);
    const exprHtml = `<div class="svg-row">${frames.map((deg, i) =>
      `<div class="svg-cell"><span class="s-tag">${['图 1', '图 2', '图 3'][i]}</span>${svg(rot(deg))}</div>`).join('')}
      <div class="svg-cell"><span class="s-tag">？</span><div style="width:74px;height:74px;display:grid;place-items:center;color:var(--mut);font-size:30px">?</div></div></div>`;
    const analysis = `图形每次<b>顺时针旋转 ${step}°</b>：三幅图依次转了 0°、${step}°、${2 * step}°，第四幅应转到 ${correctDeg % 360}°（相对图 1）。<br>
      对应 <b>${'ABCD'[ansIdx]}</b>。<br>
      <em>陷阱提醒：有一个选项是<b>镜像</b>（翻面）——看图案上的小圆点位置，旋转怎么转都到不了镜像的位置。区分旋转与翻转：盯住不对称细节的方向。</em>`;
    return mk('tuxing.rotate', '图形推理 · 旋转', level,
      `观察图形<b>旋转的规律</b>，问号处应填入的图形是（　）：`,
      exprHtml, options, ansIdx, analysis, '盯住不对称细节，旋转与镜像分清');
  }

  // 6) 叠加去同存异
  function genOverlap(level) {
    const randSet = () => {
      const s = new Set();
      while (s.size < rnd(3, 5)) s.add(rnd(0, 8));
      return s;
    };
    const A = randSet(), B = randSet();
    const correct = new Set();
    for (let i = 0; i < 9; i++) if (A.has(i) !== B.has(i)) correct.add(i);
    if (correct.size === 0) return genOverlap(level);
    const orSet = new Set([...A, ...B]);
    const andSet = new Set([...A].filter((x) => B.has(x)));
    const near = new Set(correct);
    near.delete([...near][0]);
    near.add(([...correct][0] + 1) % 9);
    const candOpts = shuffle([
      { s: correct, ok: true },
      { s: orSet, ok: false },
      { s: andSet, ok: andSet.size > 0 && !sameSet(andSet, correct) },
      { s: near, ok: !sameSet(near, correct) },
    ]);
    const options = candOpts.map((o) => ({ text: '图形', html: gridSvg(o.s), isAns: o.ok }));
    const ansIdx = options.findIndex((o) => o.isAns);
    const stem = `将图 1 与图 2 <b>叠加</b>，规律为“<b>去同存异</b>”（两图相同位置的色块消去、不同位置的保留）。得到的图形是（　）：`;
    const exprHtml = `<div class="svg-row">
      <div class="svg-cell"><span class="s-tag">图 1</span>${gridSvg(A)}</div>
      <div class="svg-cell" style="display:grid;place-items:center;color:var(--mut);font-size:26px">⊕</div>
      <div class="svg-cell"><span class="s-tag">图 2</span>${gridSvg(B)}</div></div>`;
    const analysis = `逐格比对：两图<b>都有</b>的 ${[...A].filter((x) => B.has(x)).length} 格消去，<b>只有一方有</b>的保留；<br>
      结果是 <b>${'ABCD'[ansIdx]}</b>。<br>
      <em>去同存异＝按位“异或”。三个经典陷阱：全部保留（忘了去同）、只留相同部分（做成了“求同”）、只保留图 1。</em>`;
    return mk('tuxing.overlap', '图形推理 · 样式叠加', level, stem, exprHtml, options, ansIdx, analysis,
      '去同存异＝异或；同消异留');
  }

  /* ════════ 类比推理 ════════ */
  const RELS = [
    { id: 'zhongshu', name: '种属关系', dir: true, pairs: [['苹果', '水果'], ['玫瑰', '花'], ['轿车', '汽车'], ['水稻', '粮食'], ['狮子', '哺乳动物']] },
    { id: 'zucheng', name: '组成关系', dir: true, pairs: [['轮胎', '汽车'], ['手指', '手掌'], ['书页', '书本'], ['车轮', '自行车'], ['屋檐', '房屋']] },
    { id: 'fanyi', name: '反义关系', dir: false, pairs: [['高', '矮'], ['成功', '失败'], ['勤劳', '懒惰'], ['光明', '黑暗'], ['节约', '浪费']] },
    { id: 'jinyi', name: '近义关系', dir: false, pairs: [['美丽', '漂亮'], ['立即', '马上'], ['思索', '思考'], ['帮助', '协助'], ['闻名', '著名']] },
    { id: 'maodun', name: '矛盾关系', dir: false, pairs: [['生', '死'], ['男', '女'], ['真', '假'], ['出席', '缺席']] },
    { id: 'gongneng', name: '功能关系', dir: true, pairs: [['冰箱', '冷藏'], ['台灯', '照明'], ['钢笔', '书写'], ['空调', '制冷'], ['灭火器', '灭火']] },
    { id: 'changsuo', name: '职业与场所', dir: true, pairs: [['医生', '医院'], ['厨师', '厨房'], ['演员', '舞台'], ['教师', '学校'], ['法官', '法院']] },
    { id: 'jiaocha', name: '交叉关系', dir: false, pairs: [['党员', '教师'], ['医生', '运动员'], ['诗人', '画家'], ['大学生', '志愿者']] },
  ];
  const relDesc = (rel, a, b) =>
    rel.id === 'zhongshu' ? `${a}是${b}的一种` :
    rel.id === 'zucheng' ? `${a}是${b}的一个组成部分` :
    rel.id === 'fanyi' ? '两者词义相反' :
    rel.id === 'jinyi' ? '两者词义相近' :
    rel.id === 'maodun' ? '非此即彼，没有第三种情况' :
    rel.id === 'gongneng' ? `${a}的主要功能是${b}` :
    rel.id === 'changsuo' ? `${a}的主要工作场所是${b}` :
    `有的${a}是${b}，且有的${a}不是${b}，两集合相交`;
  function genAnalogy(level) {
    const rel = pick(RELS);
    const stemPair = pick(rel.pairs);
    const sameRel = rel.pairs.filter((p) => p !== stemPair);
    const correctPair = pick(sameRel);
    const distract = [];
    if (rel.dir) distract.push([correctPair[1], correctPair[0]]);
    distract.push([stemPair[1], stemPair[0]]);
    shuffle(RELS.filter((r) => r.id !== rel.id)).slice(0, 4).forEach((r) => distract.push(pick(r.pairs)));
    const seen = new Set([stemPair.join('|'), correctPair.join('|')]);
    const list = [{ a: correctPair[0], b: correctPair[1], ok: true }];
    for (const d of shuffle(distract)) {
      const key = d.join('|');
      if (seen.has(key) || d[0] === d[1]) continue;
      seen.add(key);
      list.push({ a: d[0], b: d[1], ok: false });
      if (list.length === 4) break;
    }
    const opts = shuffle(list.slice(0, 4));
    const options = opts.map((o) => ({ text: `${o.a} : ${o.b}`, isAns: o.ok }));
    const ansIdx = options.findIndex((o) => o.isAns);
    const stem = `<b>${stemPair[0]}</b> : <b>${stemPair[1]}</b>　　下列词项逻辑关系与题干最相近的是（　）：`;
    const analysis = `题干是<b>${rel.name}</b>：${relDesc(rel, stemPair[0], stemPair[1])}。<br>
      选项 <b>${'ABCD'[ansIdx]}</b>（${correctPair[0]} : ${correctPair[1]}）同为${rel.name}——${relDesc(rel, correctPair[0], correctPair[1])}，选它。<br>
      <em>辨析要点：种属≠组成——“A 是 B 的一种”是种属，“A 是 B 的一部分”是组成（轮胎:汽车是组成，汽车:交通工具才是种属）；另注意方向，干扰项里有把题干颠倒的。</em>`;
    return mk('leibi', '类比推理 · ' + rel.name, level, stem, null, options, ansIdx, analysis,
      '先造句子定关系，再看方向是否一致');
  }

  /* ════════ 翻译推理 ════════ */
  const CHAINS = [
    ['下雨', '地湿', '路滑'],
    ['刻苦训练', '技术水平提高', '赢得比赛'],
    ['乱砍滥伐', '水土流失', '洪涝灾害频发'],
    ['通货膨胀', '物价上涨', '居民购买力下降'],
    ['熬夜', '精神不振', '工作效率低下'],
    ['坚持锻炼', '身体素质增强', '患病概率降低'],
  ];
  const NEG = (p) => `并非“${p}”`;
  function genTrans(level) {
    const variant = pick(['chain', 'ni', 'morgan', 'xuanyan']);
    const [a, b, c] = pick(CHAINS);

    if (variant === 'chain') {
      const opts = shuffle([
        { text: `${a} → ${c}`, isAns: true },
        { text: `${c} → ${a}`, isAns: false },
        { text: `${NEG(a)} → ${NEG(c)}`, isAns: false },
        { text: `${b} → ${a}`, isAns: false },
      ]);
      const ansIdx = opts.findIndex((o) => o.isAns);
      return mk('trans.chain', '翻译推理 · 递推传递', level,
        `已知：<b>如果 ${a}，那么 ${b}</b>；<b>如果 ${b}，那么 ${c}</b>。由此一定能推出（　）：`,
        null, opts, ansIdx,
        `传递规则：A→B、B→C 可得 <b>A→C</b>（${a}→${b}→${c}），选 <b>${'ABCD'[ansIdx]}</b>。<br>
         <em>逆着一律推不出：由 A→C 得不到 C→A（肯后无效），由“非 A”也得不到“非 C”（否前无效）——干扰项全是这两个无效式。</em>`,
        '顺着箭头传递，逆着箭头都无效');
    }
    if (variant === 'ni') {
      const opts = shuffle([
        { text: `${NEG(a)}`, isAns: true },
        { text: `虽然${NEG(b)}，但${a}仍可能发生`, isAns: false },
        { text: `${a}一定发生了`, isAns: false },
        { text: `${a}与${b}是否发生均无法判断`, isAns: false },
      ]);
      const ansIdx = opts.findIndex((o) => o.isAns);
      return mk('trans.ni', '翻译推理 · 逆否规则', level,
        `已知：<b>如果 ${a}，那么 ${b}</b>。事实是：<b>${NEG(b)}</b>。由此一定能推出（　）：`,
        null, opts, ansIdx,
        `翻译：${a} → ${b}。逆否等价：<b>${NEG(b)} → ${NEG(a)}</b>（否后必否前）。<br>
         现在“${NEG(b)}”，触发逆否 → “${NEG(a)}”，选 <b>${'ABCD'[ansIdx]}</b>。<br>
         <em>口诀：肯前必肯后、否后必否前；<b>否前、肯后都推不出确定结论</b>。</em>`,
        '否后必否前，否前无结论');
    }
    if (variant === 'morgan') {
      const opts = shuffle([
        { text: `${NEG(a)} 或 ${NEG(b)}`, isAns: true },
        { text: `${NEG(a)} 且 ${NEG(b)}`, isAns: false },
        { text: `${a} 或 ${b}`, isAns: false },
        { text: `${NEG(a)} → ${b}`, isAns: false },
      ]);
      const ansIdx = opts.findIndex((o) => o.isAns);
      return mk('trans.morgan', '翻译推理 · 摩根定律', level,
        `命题“<b>${a} 且 ${b}</b>”<b>不成立</b>。据此，逻辑上一定成立的是（　）：`,
        null, opts, ansIdx,
        `摩根定律：¬(A∧B) ＝ <b>¬A ∨ ¬B</b>——“且”的否定变“或”。<br>
         即“${a} 与 ${b} 至少有一个不成立”，选 <b>${'ABCD'[ansIdx]}</b>。<br>
         <em>别选“两者都不成立”（¬A∧¬B）——那比题干强得多；否定要分配进括号，且变或、或变且。</em>`,
        '且的否定是或，或的否定是且');
    }
    const opts = shuffle([
      { text: `${b} 一定成立`, isAns: true },
      { text: `${b} 一定不成立`, isAns: false },
      { text: `${a} 与 ${b} 同时成立`, isAns: false },
      { text: `${b} 是否成立无法判断`, isAns: false },
    ]);
    const ansIdx = opts.findIndex((o) => o.isAns);
    return mk('trans.xuanyan', '翻译推理 · 选言推理', level,
      `已知：“<b>${a} 或 ${b}</b>”为真（至少一个成立），又确认<b>${NEG(a)}</b>。由此可以推出（　）：`,
      null, opts, ansIdx,
      `选言推理：A∨B 为真、A 为假 → <b>B 必真</b>（否定一个，肯定另一个），选 <b>${'ABCD'[ansIdx]}</b>。<br>
       <em>方向注意：相容选言“否一推一”有效；“肯一”无效——肯定了 A 推不出 B 假，两者可能同时为真。</em>`,
      '否一推一；肯一无效');
  }

  /* ════════ 真假推理 ════════ */
  function genTruth(level) {
    const people = ['甲', '乙', '丙', '丁'];
    const mkStmt = () => {
      const form = rnd(0, 2);
      if (form === 0) { const X = pick(people); return { txt: `是${X}做的`, eval: (c) => c === X }; }
      if (form === 1) { const X = pick(people); return { txt: `不是${X}做的`, eval: (c) => c !== X }; }
      let X = pick(people), Y = pick(people);
      while (Y === X) Y = pick(people);
      return { txt: `是${X}或${Y}之一`, eval: (c) => c === X || c === Y };
    };
    const wantOneTrue = chance(.6);
    const target = wantOneTrue ? 1 : 3;
    let stmts, sols;
    let guard = 0;
    do {
      stmts = [mkStmt(), mkStmt(), mkStmt(), mkStmt()];
      sols = people.filter((cand) => stmts.filter((s) => s.eval(cand)).length === target);
    } while (guard++ < 500 && sols.length !== 1);
    if (sols.length !== 1) {
      // 兜底：人工核验过的固定题（唯一解=甲，恰一真）
      stmts = [
        { txt: '是甲做的', eval: (c) => c === '甲' },
        { txt: '是乙做的', eval: (c) => c === '乙' },
        { txt: '不是甲做的', eval: (c) => c !== '甲' },
        { txt: '是丙或丁之一', eval: (c) => c === '丙' || c === '丁' },
      ];
      sols = ['甲'];
    }
    const sol = sols[0];
    const trueIdx = stmts.map((s, i) => (s.eval(sol) ? i : -1)).filter((i) => i >= 0);
    const falseIdx = stmts.map((s, i) => (s.eval(sol) ? -1 : i)).filter((i) => i >= 0);
    const answerPerson = wantOneTrue ? people[trueIdx[0]] : people[falseIdx[0]];
    const options = shuffle(people.map((p) => ({ text: p, isAns: p === answerPerson })));
    const ansIdx = options.findIndex((o) => o.isAns);
    const truthRow = stmts.map((s, i) => `${people[i]}话：${s.eval(sol) ? '真' : '假'}`).join('　');
    const stem = `某实验室一瓶试剂被打碎，只有甲、乙、丙、丁四人接触过。四人各说了一句话：<br>
      <span class="mini">甲：“${stmts[0].txt}”　乙：“${stmts[1].txt}”　丙：“${stmts[2].txt}”　丁：“${stmts[3].txt}”</span><br>
      已知四人中<b>${wantOneTrue ? '只有一人说真话' : '只有一人说假话'}</b>。${wantOneTrue ? '说真话' : '说假话'}的是（　）：`;
    const analysis = `假设代入：逐个假定“肇事者是 X”，数真话个数。<br>
      代入“${sol}”时：${truthRow}——恰好${wantOneTrue ? '只有一真 ✓' : '只有一假 ✓'}；代入其他人真话个数都不等于 ${target}，假设不成立。<br>
      肇事者是 <b>${sol}</b>，${wantOneTrue ? '说真话' : '说假话'}的是 <b>${answerPerson}</b>，选 <b>${'ABCD'[ansIdx]}</b>。<br>
      <em>真假推理通用套路：①找<b>矛盾关系</b>（两句话必一真一假，把真/假名额先给他们）；②没有现成矛盾就用假设代入法，逐人验证真话数。</em>`;
    return mk('zhenjia.truth', '真假推理 · 唯一真假', level, stem, null, options, ansIdx, analysis,
      '找矛盾定真假，没矛盾就假设代入');
  }

  /* ════════ 分析推理（匹配） ════════ */
  function genAnalysis(level) {
    const people = ['甲', '乙', '丙'];
    const cities = ['北京', '上海', '广州'];
    const cand = [];
    for (const p of people) for (const c of cities) {
      cand.push({ txt: `${p}去了${c}`, test: (asg) => asg[people.indexOf(p)] === c });
      cand.push({ txt: `${p}没有去${c}`, test: (asg) => asg[people.indexOf(p)] !== c });
    }
    const clues = [];
    const findSol = (list) => {
      for (const p of [[0, 1, 2], [1, 0, 2], [2, 0, 1], [0, 2, 1], [1, 2, 0], [2, 1, 0]]) {
        const asg = p.map((i) => cities[i]);
        if (list.every((cl) => cl.test(asg))) return asg;
      }
      return null;
    };
    const countSols = (list) => {
      let cnt = 0;
      for (const p of [[0, 1, 2], [1, 0, 2], [2, 0, 1], [0, 2, 1], [1, 2, 0], [2, 1, 0]]) {
        const asg = p.map((i) => cities[i]);
        if (list.every((cl) => cl.test(asg))) cnt++;
      }
      return cnt;
    };
    for (const cl of shuffle(cand)) {
      clues.push(cl);
      if (countSols(clues) === 1) break;
    }
    const sol = findSol(clues);
    if (!sol) return genAnalysis(level);
    const askPerson = rnd(0, 2);
    const correctCity = sol[askPerson];
    const others = cities.filter((c) => c !== correctCity);
    const options = shuffle([
      { text: `${people[askPerson]}去了${correctCity}`, isAns: true },
      { text: `${people[askPerson]}去了${others[0]}`, isAns: false },
      { text: `${people[askPerson]}去了${others[1]}`, isAns: false },
      { text: `${people[(askPerson + 1) % 3]}去了${correctCity}`, isAns: false },
    ]);
    const ansIdx = options.findIndex((o) => o.isAns);
    const stem = `甲、乙、丙三人分别去了北京、上海、广州中的一个（互不相同）。已知：<br>
      <span class="mini">${clues.map((c, i) => `${i + 1}. ${c.txt}`).join('　')}</span><br>
      以下<b>一定为真</b>的是（　）：`;
    const analysis = `列表法（行=人、列=城）逐条排除：${clues.map((c) => c.txt).join('；')}。<br>
      同时满足全部条件的安排唯一：甲—${sol[0]}、乙—${sol[1]}、丙—${sol[2]}。<br>
      选 <b>${'ABCD'[ansIdx]}</b>（${people[askPerson]}去了${correctCity}）。<br>
      <em>分析推理三板斧：①最大信息优先（被提及最多的人/城先定）；②表格打 × 排除；③最后把结论代回每条条件验证。</em>`;
    return mk('zhenjia.analysis', '分析推理 · 匹配排除', level, stem, null, options, ansIdx, analysis,
      '列表打叉排，代入做验证');
  }

  /* ════════ 定义判断（手写题库） ════════ */
  const DEF_BANK = [
    {
      stem: `行政处罚：指行政机关依法对违反行政管理秩序的公民、法人或者其他组织予以<b>制裁</b>的行为。根据上述定义，下列属于行政处罚的是（　）`,
      opts: [
        '法院判处某犯罪分子拘役三个月',
        '市场监管部门对制假企业罚款 10 万元',
        '公司对迟到员工扣发当月奖金',
        '交警指挥过往车辆绕行施工路段',
      ],
      ans: 1,
      ana: `要件拆解：①主体是<b>行政机关</b>；②对象是<b>违反管理秩序</b>者；③性质是<b>制裁</b>。<br>
        A 主体是法院（属刑罚）；C 主体是公司（内部管理）；D 是行政指导、不含制裁。B 三要件全中。<br>
        <em>定义判断口诀：拆要件（主体/对象/目的/方式/结果），逐项对照，一项不符即排除。</em>`,
    },
    {
      stem: `习得性无助：指个体在经历反复失败后，感到一切无法控制，从而<b>放弃努力</b>、被动承受失败的心理状态。下列体现习得性无助的是（　）`,
      opts: [
        '小林多次考试失利后认为努力无用，干脆放弃复习',
        '老张创业失败一次，总结经验后再次创业',
        '小赵天资聪颖，从不努力也成绩优异',
        '老王担心项目失败，主动向领导申请调岗',
      ],
      ans: 0,
      ana: `要件：①反复失败；②形成“无法控制”的认知；③<b>放弃努力</b>。A 三条全占；B 仅失败一次且继续努力；C 无失败经历；D 是主动规避而非习得无助。选 A。<br>
        <em>多要件定义逐条核对，缺一即排除。</em>`,
    },
    {
      stem: `机会成本：指为了得到某种东西而<b>所放弃的其他可能收益中最大的那一个</b>。小周用 10 万元开店，年利润 3 万；若打工年薪 5 万、若炒股预期收益 4 万（三者只能选其一）。开店的机会成本是（　）`,
      opts: ['3 万元', '4 万元', '5 万元', '9 万元'],
      ans: 2,
      ana: `放弃的选项里收益<b>最大</b>的是打工（5 万）——机会成本取“最优替代”，不是所有替代之和。D“9 万”是两项相加，典型错误。<br>
        <em>数量型定义题把每个数字对号入座再选，别凭感觉。</em>`,
    },
    {
      stem: `马太效应：指好的愈好、坏的愈坏，<b>强者愈强、弱者愈弱</b>的累积优势现象。下列属于马太效应的是（　）`,
      opts: [
        '名校毕业生获得更多面试机会、能力提升更快，与普通院校毕业生的差距不断拉大',
        '某地出台减税政策，缩小了中小企业与大企业的税负差距',
        '王先生中奖后挥霍一空，重新变穷',
        '两家公司恶性竞价，最终两败俱伤',
      ],
      ans: 0,
      ana: `要件：①优势方获得更多资源；②差距<b>累积扩大</b>。A 全中；B 是缩小差距（反向）；C 是一次性损耗；D 是两败俱伤而非一强愈强。<br>
        <em>留意定义的方向词：“扩大”类选项与“缩小/一次性”类选项方向相反。</em>`,
    },
    {
      stem: `正当防卫：指对<b>正在进行的不法侵害</b>采取的制止行为，对不法侵害人造成损害的，不负刑事责任。下列属于正当防卫的是（　）`,
      opts: [
        '李某得知三个月前被打，纠集他人将对方打伤',
        '王某遭遇持刀抢劫，夺刀反击致抢劫者轻伤',
        '张某误以为对方要打自己，先动手将其打倒',
        '刘某将正在逃跑的小偷追上后殴打泄愤',
      ],
      ans: 1,
      ana: `核心要件：不法侵害<b>正在进行</b>。A 事后报复；C 假想防卫（侵害并不存在）；D 侵害已结束（逃跑中）；B 侵害正在进行且目的是制止，符合。<br>
        <em>时间要件是正当防卫的头号考点：事前、事后都不算，必须“正在进行”。</em>`,
    },
    {
      stem: `从众效应：指个体在<b>群体压力</b>下，放弃自己的判断而采取与多数人一致的行为。下列属于从众效应的是（　）`,
      opts: [
        '看到大家都抢购某款手机，原本不需要的小陈也买了一部',
        '工程师依据专业判断否决了团队的多数意见',
        '小刘参考美食排行榜选了餐厅，吃完觉得不错',
        '公司按多数票表决通过了年度预算',
      ],
      ans: 0,
      ana: `要件：①群体压力；②<b>放弃自己的判断</b>；③与多数人一致。A“原本不需要”暴露了被压力裹挟；B 恰好相反；C 是参考信息，没有压力与放弃判断的矛盾；D 是正常表决程序。<br>
        <em>区分“参考多数意见”与“迫于压力放弃判断”。</em>`,
    },
    {
      stem: `通货膨胀：指流通中的货币数量超过经济实际需要，引起<b>物价总水平持续、普遍上涨</b>的现象。下列情形属于通货膨胀的是（　）`,
      opts: [
        '春节前猪肉价格短期上涨，节后回落',
        '央行连年超发货币，绝大多数商品价格逐年走高',
        '某品牌手机因芯片短缺价格上调',
        '台风过后当地蔬菜价格翻倍',
      ],
      ans: 1,
      ana: `要件：①物价<b>总水平</b>（不是个别商品）；②<b>持续</b>（不是暂时波动）。A、D 短期局部波动；C 个别商品供给冲击；B 货币超发＋普遍持续上涨，符合。<br>
        <em>“总水平”“持续性”这两个限定词是命题人最爱挖的坑。</em>`,
    },
    {
      stem: `职业倦怠：指个体因长期工作压力而产生<b>情绪耗竭、去人格化和低成就感</b>的综合症状。下列属于职业倦怠的是（　）`,
      opts: [
        '护士老李工作十年，近来对病人冷漠麻木，觉得自己的工作毫无价值',
        '小杨第一天上班非常紧张，手心出汗',
        '程序员小方项目冲刺后休息一周满血复活',
        '教师老郑因学生顶撞而生气，第二天恢复正常',
      ],
      ans: 0,
      ana: `三要件：情绪耗竭＋去人格化＋低成就感，且须<b>长期压力累积</b>。A 全中；B、C、D 均为短期情绪反应，休整即恢复，不构成倦怠。<br>
        <em>“长期性”这类时间状语也是要件，别只看行为表现。</em>`,
    },
    {
      stem: `晕轮效应：指对某人的<b>局部特征形成印象后推及整体</b>、以偏概全的认知偏差。下列属于晕轮效应的是（　）`,
      opts: [
        '面试官见应聘者谈吐得体，便认定其专业能力也一定出色',
        '考官对每位考生统一使用结构化评分表打分',
        '老同学重逢，小赵仍按十年前的印象评价对方',
        '经理对迟到员工印象变差，而绩效考核本就显示其长期拖延',
      ],
      ans: 0,
      ana: `要件：由<b>单一局部特征</b>（谈吐）推及<b>整体</b>（专业能力），缺乏其他证据。A 符合；B 恰是防偏差设计；C 是信息滞后/刻板印象；D 的负面判断有绩效证据支撑，不是以偏概全。<br>
        <em>与其他认知偏差区分：刻板印象靠“群体标签”，首因效应靠“第一印象”，晕轮靠“局部推整体”。</em>`,
    },
    {
      stem: `搭便车行为：指个体<b>不付出成本</b>或付出极少成本，却享受他人行动带来的公共利益。下列属于搭便车行为的是（　）`,
      opts: [
        '小区多数业主集资安装门禁，一楼张大爷未出钱却同样享受门禁保障',
        '小王购买正版软件并按约定付费使用',
        '公司搞免费试吃促销，顾客尝后大多没有购买',
        '小李使用同学主动共享给他的视频会员账号',
      ],
      ans: 0,
      ana: `要件：①受益物是<b>公共物品</b>（不具排他性）；②自己<b>不付成本</b>；③照样受益。A 门禁改善全楼受益、未出钱者照样享受，典型搭便车；B 正常交易；D 是授权共享；C 是营销安排，试吃本在企业预期内。<br>
        <em>“不具排他性”是搭便车的前提——对私人商品的蹭用不叫搭便车。</em>`,
    },
    {
      stem: `隐性失业：指劳动者表面上被雇佣，但<b>实际劳动量远低于其能力</b>、边际生产率趋近于零的就业状态。下列属于隐性失业的是（　）`,
      opts: [
        '老赵被单位裁员后一直在家待业',
        '某单位人浮于事，小钱每天打卡上班却几乎没有实际工作可做',
        '小孙主动辞职在家备考研究生',
        '农忙时节返乡帮工的企业白领小周',
      ],
      ans: 1,
      ana: `要件：①<b>名义上就业</b>（有岗位、在出勤）；②实际劳动量远低于能力、边际生产率趋零。B“人浮于事、无活可干”全中；A 是显性失业；C 自愿退出劳动市场；D 正常假期。<br>
        <em>“隐性”二字的关键＝名义就业、实际闲置。</em>`,
    },
  ];
  function genDef(level) {
    const q = DEF_BANK[rnd(0, DEF_BANK.length - 1)];
    const options = q.opts.map((t, i) => ({ text: t, isAns: i === q.ans }));
    return mk('dingyi', '定义判断 · 要件对照', level, q.stem, null, options, q.ans, q.ana,
      '拆要件，逐项对照，一项不符即排除');
  }

  /* ════════ 加强削弱（手写题库） ════════ */
  const ARG_BANK = [
    {
      stem: `某研究发现，经常喝咖啡的人患心脏病的比例更低。研究人员据此认为，<b>喝咖啡有助于预防心脏病</b>。以下哪项如果为真，最能<b>削弱</b>上述结论？（　）`,
      opts: [
        '咖啡中还含有可能对人体有害的其他物质',
        '心脏不好的人得知自身状况后，会主动少喝或不喝咖啡',
        '有些人喝了一辈子咖啡也未患心脏病',
        '该研究的样本人数超过一万人',
      ],
      ans: 1,
      ana: `论点：咖啡→预防心脏病。B 指出<b>因果倒置</b>：不是“咖啡让心脏好”，而是“心脏不好的人少喝咖啡”——直接颠倒因果，削弱最狠。<br>
        A 无关痛痒；C 举个别反例不否认整体统计；D 是加强论据可信度。<br>
        <em>削弱力度排序：因果倒置 ≈ 切断因果 ＞ 他因 ＞ 样本质疑 ＞ 举反例 ＞ 诉诸动机。</em>`,
    },
    {
      stem: `考古队在某地煤层中发现了大量古植物化石，因此认为<b>该地区古代气候温暖湿润</b>。以下哪项是上述论证<b>必需的前提</b>？（　）`,
      opts: [
        '该地现在的气候并不温暖湿润',
        '煤层只在温暖湿润、植物大量繁衍的环境下才能形成',
        '化石可以保存数百万年',
        '该考古队装备了先进的勘探设备',
      ],
      ans: 1,
      ana: `论证链：煤层化石 →（缺桥）→ 温暖湿润。B 在“煤层”与“温暖湿润”之间<b>搭桥</b>，否定它论证立刻崩塌，故为必需前提。<br>
        A 无关（古今气候本可不同）；C 只说明化石可信；D 无关。<br>
        <em>前提题检验法：把选项<b>否定</b>后代回，论证崩溃者即必需前提（“否定代入法”）。</em>`,
    },
    {
      stem: `某市去年在主干道安装智能信号灯，今年全市交通事故起数下降 20%。交管部门认为，<b>智能信号灯有效减少了事故</b>。以下哪项如果为真，最能<b>削弱</b>这一结论？（　）`,
      opts: [
        '智能信号灯造价高昂',
        '今年该市机动车保有量大幅下降，各类事故普遍减少',
        '部分驾驶员表示看不懂新信号灯',
        '邻市未安装智能信号灯，事故率也下降了 5%',
      ],
      ans: 1,
      ana: `B 给出<b>他因</b>：机动车总量大幅下降才是主因（全市各类事故普遍减少），动摇“信号灯起作用”的因果结论。<br>
        A 无关；C 是体验问题；D 形成对照（没装也降但只降 5%），反而略有加强。<br>
        <em>因果型结论的削弱三板斧：因果倒置、另有他因、切断因果。</em>`,
    },
    {
      stem: `某减肥药服用组三个月平均减重 4 公斤。研究人员认为<b>该药减肥有效</b>。以下哪项如果为真，最能<b>加强</b>这一结论？（　）`,
      opts: [
        '该药已通过有关部门审批上市',
        '同期服用安慰剂的对照组平均仅减重 0.5 公斤，两组差异具有统计学显著性',
        '该药价格适中，购买方便',
        '少数人服药后出现轻微头晕',
      ],
      ans: 1,
      ana: `原论证缺参照系——不吃药也许也能减 4 公斤。B 补上<b>对照实验</b>：安慰剂组仅 0.5 公斤且差异显著，说明药确实起效，是最强加强。<br>
        A、C 与药效无关；D 是副作用信息。<br>
        <em>对照实验是因果结论的黄金证据；看到“对照组/控制变量”优先考虑。</em>`,
    },
    {
      stem: `某健身平台随机调查其会员，85% 的会员对平台服务表示满意。有人据此得出结论：<b>本市居民对健身服务的整体满意度很高</b>。以下哪项如果为真，最能<b>削弱</b>这一结论？（　）`,
      opts: [
        '该平台会员以年轻人为主，且都是主动付费的忠实用户',
        '调查问卷共设 20 道题，答题耗时较长',
        '平台今年新增了游泳课程',
        '部分会员反映健身装备价格偏贵',
      ],
      ans: 0,
      ana: `论证从“平台会员”跳到“本市居民”。A 指出<b>样本严重有偏</b>（年轻＋付费忠实用户无法代表全体市民），代表性崩塌则结论崩塌。<br>
        B 问卷长短、C 新课程、D 装备价格都不触及“样本能否代表总体”。<br>
        <em>凡“调查/问卷”做论据，先查三件事：样本有无偏、样本够不够、问题有无诱导。</em>`,
    },
    {
      stem: `研究发现，每天睡眠少于 6 小时的人工作效率明显更低。因此有人建议：<b>保证充足睡眠可以提高工作效率</b>。以下哪项如果为真，最能<b>削弱</b>该建议的合理性？（　）`,
      opts: [
        '并非所有人都需要 7-8 小时睡眠',
        '是工作压力大导致这些人睡得少，而压力大本身才是效率低的原因',
        '有些成功人士每天只睡 5 小时',
        '该研究由某床垫厂商赞助',
      ],
      ans: 1,
      ana: `B 指出<b>因果倒置＋共同他因</b>：不是“少睡→低效”，而是“压力大→又少睡又低效”——真正的元凶是压力，建议药不对症。<br>
        A 个别差异、C 举反例、D 诉诸赞助动机，力度都远弱于直接动摇因果链。<br>
        <em>“诉诸利益/赞助方”类选项看似有力实则很弱，别被带节奏。</em>`,
    },
    {
      stem: `某国提高烟税后，卷烟总销量不降反升。有人据此认为：<b>提高烟税没能抑制吸烟</b>。以下哪项如果为真，最能<b>削弱</b>上述结论？（　）`,
      opts: [
        '该国同期人口增长 15%，卷烟总销量上升但人均消费量明显下降',
        '本次烟税提高的幅度约为 10%',
        '该国青少年吸烟率保持稳定',
        '部分烟民转而改吸电子烟',
      ],
      ans: 0,
      ana: `A 补上关键口径：<b>人均消费量实际下降</b>——总销量上升只是人口增长所致，“税无效”的结论建立在被扭曲的数据口径上，直接动摇论点。<br>
        B 税率幅度、C 青少年数据、D 转向电子烟均不足以推翻。<br>
        <em>数据型论证先问一句：有没有更合理的统计口径（人均/占比/同口径对比）？</em>`,
    },
    {
      stem: `某企业规定：只有通过安全考试，员工才能进入生产车间。小张进入了生产车间。由此可以<b>必然推出</b>（　）`,
      opts: [
        '小张通过了安全考试',
        '小张业务能力强',
        '小张即使没通过考试也能进车间',
        '所有通过考试的人都进过车间',
      ],
      ans: 0,
      ana: `“只有 A，才 B”翻译为 <b>B → A</b>（进车间 → 通过考试）。小张进车间（肯前）→ 必然通过考试（肯后），A 正确。<br>
        D 把必要条件当充分条件反向使用（通过考试 ⇏ 一定进车间）；C 直接违反必要条件定义。<br>
        <em>“只有…才…”＝必要条件：后推前；“只要…就…”＝充分条件：前推后。翻译错全盘错。</em>`,
    },
    {
      stem: `某企业认为，给员工提供免费健身房可以提高生产率，理由是<b>研究表明锻炼能改善情绪和认知</b>。以下哪项如果为真，最能<b>加强</b>该企业的设想？（　）`,
      opts: [
        '同行业某公司开设健身房后员工生产率提升 8%，且期间其他管理制度均未变化',
        '健身房的建设成本两年内即可收回',
        '有些员工更喜欢在户外锻炼',
        '该企业员工平均年龄为 35 岁',
      ],
      ans: 0,
      ana: `论据只到“锻炼有益”，从“设健身房”到“生产率提高”缺一环。A 用同行业<b>对照案例</b>（并排除其他制度变化）补全了这条链，加强力度最大。<br>
        B 是成本收益、C 是偏好差异、D 无关。<br>
        <em>加强题优先找“搭桥＋排除他因”的对照型选项。</em>`,
    },
    {
      stem: `报告显示，使用某学习 App 的学生平均成绩提高了 10 分。结论：<b>该 App 能提高学生成绩</b>。以下哪项如果为真，最能<b>削弱</b>该结论？（　）`,
      opts: [
        '该 App 界面设计精美',
        '使用该 App 的学生本就更有学习主动性，且他们近期的自习时长也普遍增加了',
        '该 App 用户总数已超过一百万',
        '多所学校的辅导老师也向学生推荐了这款 App',
      ],
      ans: 1,
      ana: `B 指出<b>自选择偏差＋他因</b>：成绩提高可能源于学生本身的主动性与自习投入，而非 App——因果链被整体替换。<br>
        A 谈界面、C 谈规模、D 谈推荐，都与“App 是不是原因”无关。<br>
        <em>凡是“用了 X 的人更好”类论证，条件反射找两个削弱点：自选择偏差、共同他因。</em>`,
    },
  ];
  function genLunzheng(level) {
    const q = ARG_BANK[rnd(0, ARG_BANK.length - 1)];
    const options = q.opts.map((t, i) => ({ text: t, isAns: i === q.ans }));
    return mk('lunzheng', '论证 · 加强与削弱', level, q.stem, null, options, q.ans, q.ana,
      '先找论点论据，再按削弱/加强力度排序');
  }

  /* ── 注册 ─────────────────────────────────────────────── */
  const GEN = {
    sym: genSym, faces: genFaces, parts: genParts, shift: genShift, rotate: genRotate, overlap: genOverlap,
    analogy: genAnalogy, trans: genTrans, truth: genTruth, analysis: genAnalysis,
    def: genDef, lunzheng: genLunzheng,
  };

  window.PD_GEN = {
    gen(id, level, hint) {
      const fn = GEN[id];
      if (!fn) throw new Error('unknown generator: ' + id);
      let q = fn(level, hint), guard = 0;
      while (guard++ < 8) {
        const bad =
          !q || !Array.isArray(q.options) || q.options.length !== 4 ||
          q.ansIdx < 0 || q.ansIdx >= 4 ||
          new Set(q.options.map((o) => o.html ?? o.text ?? '')).size !== q.options.length ||
          String(q.stem + q.analysis).includes('undefined') || String(q.stem + q.analysis).includes('NaN');
        if (!bad) break;
        q = fn(level, hint);
      }
      return q;
    },
    EXAM_POOL: [
      ['sym', 8], ['faces', 8], ['parts', 4], ['shift', 6], ['rotate', 6], ['overlap', 6],
      ['analogy', 14], ['trans', 12], ['truth', 8], ['analysis', 8], ['def', 10], ['lunzheng', 10],
    ],
  };
})();
