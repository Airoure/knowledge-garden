/* 练习引擎流程测试：答错可重试、统计只记首次作答、模考不受影响
 * 运行：cd yuyin && node tests/quiz.flow.test.js
 * 与 study.flow.test.js 同款极简 DOM 桩，不依赖浏览器。 */
const fs = require('fs'), vm = require('vm'), path = require('path');
const DIR = path.join(__dirname, '..');

/* ── DOM 桩 ── */
function mkEl() {
  return { innerHTML: '', textContent: '', hidden: false, disabled: false, dataset: {}, style: {},
    classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, toggle() {}, contains(c) { return this._s.has(c); } },
    querySelector() { return null; }, querySelectorAll() { return []; }, setAttribute() {}, addEventListener() {} };
}
const view = mkEl();
const qcard = mkEl();
const afeed = mkEl();                 // 每次作答都会被 choose() 整体覆写
const nextbar = mkEl();
nextbar.hidden = true;                // 对应 renderQuiz 里的 hidden 属性
const byId = { view, qcard, afeed, nextbar };
/* 选项按钮桩：题面选项由 innerHTML 生成，桩里给 4 个通用按钮 */
const opts = [0, 1, 2, 3].map((i) => { const e = mkEl(); e.dataset.i = String(i); return e; });
qcard.querySelectorAll = (sel) => sel === '.opt' ? opts : [];

/* 真实 DOM 里下一题靠 innerHTML 重建，桩里手动等价复位 */
function simulateRebuild() {
  qcard.classList._s.clear();
  afeed.innerHTML = '';
  nextbar.hidden = true;
  nextbar.innerHTML = '';
  opts.forEach((o) => { o.disabled = false; o.classList._s.clear(); });
}

/* 事件委托监听器。真实浏览器整页加载会重建 document，
 * 这里在每次加载 app.js 前清空，避免新旧两份闭包同时响应点击。 */
const listeners = {};
const doc = {
  getElementById: (id) => byId[id] || mkEl(),
  querySelector: () => null, querySelectorAll: () => [],
  createElement: mkEl,
  addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
};
function clickAct(act, dataset) {
  const ev = { target: { closest: (sel) => sel === '[data-act]' ? { dataset: { act, ...(dataset || {}) } } : null } };
  (listeners.click || []).forEach((fn) => fn(ev));
}
function clickOpt(i) {
  const ev = { target: { closest: (sel) => sel === '.opt' ? opts[i] : null } };
  (listeners.click || []).forEach((fn) => fn(ev));
}

const mem = {};
const loc = { hash: '#/', replace(h) { this.hash = h; } };
const win = { addEventListener() {}, removeEventListener() {}, scrollTo() {} };
const timeouts = [];                  // 只记录不执行，自动跳题在这里可观察
const sandbox = { window: win, document: doc, console, Date,
  performance: { now: () => Date.now() },
  setInterval: () => 0, clearInterval() {}, setTimeout: (fn, ms) => { timeouts.push(ms); return 1; }, clearTimeout() {},
  location: loc, confirm: () => true,
  localStorage: { getItem: k => k in mem ? mem[k] : null, setItem: (k, v) => { mem[k] = String(v); } } };
win.localStorage = sandbox.localStorage;
vm.createContext(sandbox);
const run = f => vm.runInContext(fs.readFileSync(DIR + '/js/' + f, 'utf8'), sandbox, { filename: f });
function loadApp() { for (const k of Object.keys(listeners)) delete listeners[k]; run('app.js'); }
['yy-questions.js', 'yy-courses.js', 'yy-deck.js', 'yy-srs.js', 'yy-study.js'].forEach(run);
loadApp();

let fails = []; const ck = (c, m) => { if (!c) fails.push(m); };
const store = () => JSON.parse(mem['yy-v1']);

/* 1. 进入第一章练习（真题实战） */
loc.hash = '#/c/guanlian'; loadApp();
clickAct('practice', { l: 'real' });
ck(view.innerHTML.includes('qcard'), '练习未启动');
ck(nextbar.hidden === true, '未作答时下一题栏应隐藏');
ck(view.innerHTML.includes('答错后 <kbd>R</kbd>'), '练习模式应提示 R 重试快捷键');

/* 2. 故意答错：反复点第 1 个选项，答对就进下一题（最多找 6 题） */
let pick = -1, seekCorrect = 0;
for (let n = 0; n < 6 && pick < 0; n++) {
  timeouts.length = 0;
  clickOpt(0);
  if (afeed.innerHTML.includes('✗')) { pick = 0; break; }
  seekCorrect++;
  clickAct('next');
  simulateRebuild();
}
ck(pick >= 0, '连续 6 题首个选项全对，未构造出答错场景（概率极低，重跑即可）');
ck(afeed.innerHTML.includes('✗ 答错了'), '应呈现答错判定');
ck(timeouts.length === 0, '答错不应安排自动下一题，实排=' + JSON.stringify(timeouts));
ck(nextbar.hidden === false && nextbar.innerHTML.includes('再试一次') && nextbar.innerHTML.includes('下一题'), '答错后应同时出现「再试一次」与「下一题」');
ck(opts.every(o => o.disabled === true), '作答后选项应禁用');

/* 3. 首次作答已入账：错题本 1 条、章节统计 = 寻错途中答对数 + 1 */
ck(store().wrong.length === 1, '答错应记入错题本，实为 ' + store().wrong.length);
const total0 = store().chapters['guanlian'].total;
ck(total0 === seekCorrect + 1, '章节统计应记 ' + (seekCorrect + 1) + ' 题，实为 ' + total0);

/* 4. 重试：选项还原、已选错误项标记 tried、解析隐藏 */
clickAct('retry');
ck(opts.every(o => o.disabled === false), '重试后选项应重新可用');
ck(opts[pick].classList._s.has('tried'), '已选错误项应标记 tried');
ck(afeed.innerHTML === '', '重试后应隐藏解析');
ck(nextbar.hidden === true, '重试后下一题栏应隐藏');

/* 5. 重试再错 → 可继续重试，且不重复记账（若恰好选对则直接进入下一组断言） */
timeouts.length = 0;
clickOpt(1);
if (afeed.innerHTML.includes('✗')) {
  ck(afeed.innerHTML.includes('还是错了'), '重试再错应提示「还是错了」');
  ck(store().wrong.length === 1, '重试答错不应重复记入错题本');
  ck(store().chapters['guanlian'].total === total0, '重试不应重复计题数');
  ck(timeouts.length === 0, '重试答错同样不应自动跳题');
  clickAct('retry');
  ck(opts.every(o => o.disabled === false), '再次重试后选项应可用');
}

/* 6. 重试选对 → 「重试答对」+ 自动进下一题，账目仍只记首次 */
let solved = afeed.innerHTML.includes('✓');
for (let i = 0; i < 4 && !solved; i++) {
  timeouts.length = 0;
  clickOpt(i);
  if (afeed.innerHTML.includes('✓')) solved = true;
  else clickAct('retry');
}
ck(solved, '重试后应能选对');
ck(afeed.innerHTML.includes('重试答对'), '重试选对应显示「重试答对」，实际=' + afeed.innerHTML.slice(0, 60));
ck(timeouts.includes(1200), '重试答对后应安排 1.2s 自动下一题，实排=' + JSON.stringify(timeouts));
ck(store().chapters['guanlian'].total === total0 && store().wrong.length === 1, '成绩与错题本只记首次作答');

/* 7. 下一题正常推进，界面复位 */
clickAct('next');
simulateRebuild();
ck(view.innerHTML.includes('id="afeed"></div'), '进入下一题应还原为未作答状态');

/* 8. 关闭自动下一题：答对不再排定时器，答错仍有重试入口 */
clickAct('toggle-auto');
timeouts.length = 0;
clickOpt(0);
if (afeed.innerHTML.includes('✓')) {
  ck(timeouts.length === 0, '关闭自动下一题后答对不应排定时器');
} else {
  ck(nextbar.innerHTML.includes('再试一次'), '关闭自动下一题时答错仍应有重试按钮');
}
clickAct('toggle-auto');   // 恢复默认开

/* 9. 模考模式：永远没有「再试一次」 */
clickAct('exam-start');
ck(view.innerHTML.includes('qcard'), '模考未启动');
ck(!view.innerHTML.includes('答错后 <kbd>R</kbd>'), '模考不应提示 R 重试');
timeouts.length = 0;
clickOpt(0);
ck(!nextbar.innerHTML.includes('再试一次'), '模考不应出现重试按钮');
clickAct('retry');
ck(opts.every(o => o.disabled === true), '模考中重试应无效（选项保持禁用）');
ck(timeouts.length === 0, '模考不应排自动下一题');

console.log(fails.length ? '❌ 失败 ' + fails.length + ' 项:\n' + fails.map(f => ' - ' + f).join('\n') : '✅ 练习引擎流程全部通过（9 组 / 22+ 断言）');
if (fails.length) process.exit(1);
