const fs=require('fs'),vm=require('vm'),path=require('path');
const DIR=path.join(__dirname,'..');
function mkEl(){return {innerHTML:'',textContent:'',disabled:false,dataset:{},style:{},
  classList:{_s:new Set(),add(c){this._s.add(c)},remove(c){this._s.delete(c)},toggle(c){},contains(){return false}},
  querySelector(){return null},querySelectorAll(){return []},setAttribute(){},addEventListener(){}};}
const view=mkEl();
const doc={getElementById:id=>id==='view'?view:mkEl(),querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){},createElement:mkEl};
const mem={};
const loc={hash:'#/',replace(h){this.hash=h}};
const win={addEventListener(){},removeEventListener(){},scrollTo(){}};
const sandbox={window:win,document:doc,console,Date,confirm:()=>true,
  setInterval:()=>0,clearInterval(){},location:loc,
  localStorage:{getItem:k=>k in mem?mem[k]:null,setItem:(k,v)=>{mem[k]=String(v)}}};
win.localStorage=sandbox.localStorage;
vm.createContext(sandbox);
const run=f=>vm.runInContext(fs.readFileSync(DIR+'/js/'+f,'utf8'),sandbox,{filename:f});
const boot=()=>['yy-questions.js','yy-courses.js','yy-deck.js','yy-srs.js','yy-study.js','app.js'].forEach(run);
boot();
const S=win.YY_STUDY, SRS=win.YY_SRS;
let fails=[]; const ck=(c,m)=>{ if(!c) fails.push(m); };
const html=()=>view.innerHTML;
const DAY=86400000;

// 1. 首页入口
loc.hash='#/'; run('app.js');
ck(html().includes('每日成语 · 易混词'),'首页缺少新入口');
ck(html().includes('300 条高频成语与易混词'),'首页入口描述未更新');
ck(html().includes('待复习'),'首页未显示待复习数');

// 2. 看板
loc.hash='#/study'; run('app.js');
const dash=html();
ck(dash.includes('今日任务'),'看板缺少今日任务');
ck(dash.includes('未来 7 天复习量'),'看板缺少 7 天预测');
ck(dash.includes('学习设置'),'看板缺少设置区');
ck(dash.includes('词库 300'),'看板未显示词库总数');
ck(dash.includes('新学 <b>10</b> 条'),'首日应显示新学 10 条');
ck((dash.match(/class="fc-col"/g)||[]).length===7,'预测柱应为 7 根');
ck(dash.includes('data-act="study-start"'),'看板缺少开始按钮');

// 3. 启动会话
S.start(false);
ck(loc.hash==='#/study/session','启动后应切到会话路由');
const s1=html();
ck(s1.includes('点开答案'),'会话未显示翻面按钮');
ck(s1.includes('新学'),'首日应标记为新学');
ck(s1.includes('已复习 <b>0</b> / 10'),'会话总数应为 10');
ck(s1.includes('st-bar-fill'),'缺少进度条');

// 4. 翻面
S.flip();
const fl=html();
ck(fl.includes('rate-again')&&fl.includes('rate-hard')&&fl.includes('rate-good'),'翻面后未出现三档自评');
ck(fl.includes('忘记')&&fl.includes('模糊')&&fl.includes('认识'),'自评文案缺失');
ck(fl.includes('card-fc flipped'),'卡片未加 flipped 类');

// 5. 防误触 + 评分推进
S.flip();                                   // 翻回正面
ck(S.grade('good')===false,'未翻面时不应记入评分（防误触）');
S.flip(); ck(S.grade('good')===true,'翻面后评分应记入');
S.flip(); S.grade('hard');
S.flip(); S.grade('again');
ck(html().includes('已复习 <b>3</b> / 10'),'评分后计数应为3，片段='+JSON.stringify((html().match(/已复习 <b>\d+<\/b> \/ \d+/)||['无'])[0]));

// 6. 队列走完 → 等待态
for(let i=0;i<7;i++){ S.flip(); S.grade('good'); }
ck(S.isWaiting(),'队列走完后应进入等待态');
const wait=html();
ck(wait.includes('还有 1 条要重记'),'等待态应提示 1 条，实际='+((wait.match(/还有 \d+ 条要重记/)||['无'])[0]));
ck(wait.includes('class="st-wait-clock"'),'等待态缺少倒计时');
ck(wait.includes('立即重记'),'等待态缺少跳过按钮');

// 7. 跳过等待 → 回到队列
S.requeueNow();
ck(!S.isWaiting(),'跳过等待后不应仍处等待态');
ck(html().includes('点开答案'),'重记的卡应回到答题界面');

// 8. 答对后结束
S.flip(); S.grade('good');
const done=html();
ck(done.includes('class="st-done"'),'队列清空后应显示完成态');
ck(done.includes('本次复习'),'完成态缺少统计');
ck(done.includes('st-done-grid'),'完成态缺少数据格');

// 9. 持久化
ck(!!mem['yy-srs-v1'],'未写入 localStorage');
const saved=JSON.parse(mem['yy-srs-v1']);
ck(Object.keys(saved.states).length===10,'应记录10张卡状态，实为'+Object.keys(saved.states).length);
ck(saved.daily.newLearned===10,'当日新学应记10，实为'+saved.daily.newLearned);

// 10. 词库总览
S.preview('__all__');
ck(html().includes('词库总览'),'总览标题缺失');
ck((html().match(/class="db-item"/g)||[]).length===300,'总览应300条，实为'+(html().match(/class="db-item"/g)||[]).length);
S.preview('望文生义');
ck((html().match(/class="db-item"/g)||[]).length===36,'分类筛选应36条，实为'+(html().match(/class="db-item"/g)||[]).length);

// 11. 配额
S.setQuota(5);
ck(JSON.parse(mem['yy-srs-v1']).settings.newPerDay===15,'配额应变15');
S.setQuota(-100);
ck(JSON.parse(mem['yy-srs-v1']).settings.newPerDay===0,'配额应截断为0');

// 12. 重置
S.reset();
ck(Object.keys(JSON.parse(mem['yy-srs-v1']).states).length===0,'重置后应无卡状态');

// 13. 其他路由未被破坏
['#/','#/cards','#/wrong','#/exam','#/c/guanlian'].forEach(h=>{
  loc.hash=h;
  try{ run('app.js'); ck(html().length>200,'路由 '+h+' 内容过少'); }
  catch(e){ fails.push('路由 '+h+' 抛错: '+e.message); }
});
loc.hash='#/study/session';
try{ run('app.js'); ck(loc.hash==='#/study','无会话时应回看板，实为'+loc.hash); }
catch(e){ fails.push('session 兜底抛错: '+e.message); }

// 14. 多天连续学习回归
S.reset();
const quota=SRS.overview().newPerDay;
ck(quota===10,'重置后配额应回到10，实为'+quota);
let dc=[];
for(let d=0;d<6;d++){
  const q=SRS.session(Date.now()+d*DAY);
  dc.push({n:q.filter(x=>x.isNew).length,r:q.filter(x=>!x.isNew).length});
  ck(new Set(q.map(x=>x.card.id)).size===q.length,'第'+d+'天队列内有重复卡');
  ck(q.filter(x=>x.isNew).length<=quota,'第'+d+'天新学超配额');
  q.forEach(x=>SRS.grade(x.card.id,'good',Date.now()+d*DAY));
}
ck(Object.keys(SRS.store.states).length===60,'6天应累计60条，实为'+Object.keys(SRS.store.states).length);
ck(dc[0].n===10,'第0天应发10条新学，实为'+dc[0].n);
ck(dc[1].r===10,'第1天应有10条复习，实为'+dc[1].r);
const before=Object.keys(SRS.store.states).length;
run('yy-srs.js');
ck(Object.keys(win.YY_SRS.store.states).length===before,'重载后卡状态丢失');

// 15. 离开学习页释放定时器
S.reset();
loc.hash='#/study/session';
S.start(false);
ck(S.hasSession(),'会话应已建立');
loc.hash='#/'; run('app.js');
ck(!S.hasSession(),'离开学习页后会话应被释放');

console.log(fails.length ? '❌ 失败 '+fails.length+' 项:\n'+fails.map(f=>' - '+f).join('\n') : '✅ 端到端全部通过（15 组 / 55+ 断言）');
