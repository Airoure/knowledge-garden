const fs=require('fs'),vm=require('vm'),path=require('path');
const YY=path.join(__dirname,'..','js');
const mem={}; const localStorage={getItem:k=>k in mem?mem[k]:null,setItem:(k,v)=>{mem[k]=String(v)}};
const sandbox={window:{},localStorage,console,Date}; sandbox.window.localStorage=localStorage;
vm.createContext(sandbox);
const run=f=>vm.runInContext(fs.readFileSync(path.join(YY,f),'utf8'),sandbox,{filename:f});
run('yy-deck.js'); run('yy-srs.js');
const W=sandbox.window, SRS=W.YY_SRS;
const TOTAL=W.YY_DECK.length;                          // 词库条数（会随扩充变化，勿写死）
const DAY=86400000;
let DAY0=new Date(2026,8,1,12,0,0).getTime();
const at=d=>DAY0+d*DAY;
let fails=[]; const ck=(c,m)=>{ if(!c) fails.push(m); };

// 1. 首日：10 张新卡、0 复习
let ov=SRS.overview(at(0));
ck(ov.newCount===10,'首日新学应10，实为'+ov.newCount);
ck(ov.dueCount===0,'首日复习应0，实为'+ov.dueCount);
let sess=SRS.session(at(0));
ck(sess.length===10,'首日队列应10，实为'+sess.length);
ck(sess.every(x=>x.isNew),'首日应全为新卡');
ck(new Set(sess.map(x=>x.card.id)).size===10,'首日队列有重复');

// 2. 全部「认识」→ 间隔1天，到期落在次日零点
sess.forEach(x=>SRS.grade(x.card.id,'good',at(0)));
const s0=SRS.cardState(sess[0].card.id).state;
ck(s0.ivl===1,'good 首次间隔应1天，实为'+s0.ivl);
const nm=new Date(at(1)); nm.setHours(0,0,0,0);
ck(s0.due===nm.getTime(),'到期应落在次日零点，实为'+new Date(s0.due).toISOString());
ck(s0.due<=at(1),'次日中午应已到期');
ov=SRS.overview(at(0));
ck(ov.newCount===0,'同日不应再发新卡，实为'+ov.newCount);
ck(ov.dueCount===0,'同日不应有到期卡');

// 3. 第2天：10 到期 + 10 新学，计数重置
ov=SRS.overview(at(1));
ck(ov.dueCount===10,'第2天到期应10，实为'+ov.dueCount);
ck(ov.newCount===10,'第2天新学应10，实为'+ov.newCount);
ck(ov.newLearnedToday===0,'跨天应重置当日新学计数');

// 4. 「忘记」→ 排到 10 分钟后：当场移出队列，10 分钟后重现
sess=SRS.session(at(1));
const dueCards=sess.filter(x=>!x.isNew);
ck(dueCards.length===10,'第2天应有10张到期卡');
const idA=dueCards[0].card.id;
SRS.grade(idA,'again',at(1));
let st=SRS.cardState(idA).state;
ck(st.n===0,'again 应重置轮次，实为'+st.n);
ck(Math.abs(st.due-(at(1)+10*60000))<1000,'again 应10分钟后重现');
ck(st.ef<2.55,'again 应降低 EF，实为'+st.ef);
ck(SRS.overview(at(1)).dueCount===9,'again 卡当场应移出队列，实为'+SRS.overview(at(1)).dueCount);
ck(SRS.overview(at(1)+5*60000).dueCount===9,'again 卡5分钟内应仍未到期，实为'+SRS.overview(at(1)+5*60000).dueCount);
// 【引擎行为】again 卡在 +10min 准点回归队列；此处断言必须在「学完当天新卡」之前——
// 因为当天新卡的到期日是次日零点，学完后它们也会计入到期数。
ck(SRS.overview(at(1)+11*60000).dueCount===10,'again 卡11分钟后应重回队列（9张存量到期+它自己=10），实为'+SRS.overview(at(1)+11*60000).dueCount);
ck(SRS.overview(at(1)+9*60000).dueCount===9,'again 卡9分钟时不应回归，实为'+SRS.overview(at(1)+9*60000).dueCount);
ck(SRS.overview(at(1)).scheduledCount===1,'已学未到期应为1（9张存量仍到期 + 该卡排到10分钟后），实为'+SRS.overview(at(1)).scheduledCount);
ck(SRS.overview(at(2)).dueCount===10,'第2天应10张到期（当日新学次日零点才到期不算今天），实为'+SRS.overview(at(2)).dueCount);
ck(SRS.overview(at(1)).learnedCount===10,'累计学过应为10（第0天学的10张，不因评忘记而倒退），实为'+SRS.overview(at(1)).learnedCount);
ck(SRS.overview(at(1)).progress===Math.round(10/TOTAL*100),'进度应为'+(Math.round(10/TOTAL*100))+'%（10/'+TOTAL+'），实为'+SRS.overview(at(1)).progress);

// 5. 「模糊」间隔短于「认识」
const idH=dueCards[1].card.id, idG=dueCards[2].card.id;
SRS.grade(idH,'hard',at(1)); SRS.grade(idG,'good',at(1));
const sH=SRS.cardState(idH).state, sG=SRS.cardState(idG).state;
ck(sH.ivl<sG.ivl,'hard 间隔('+sH.ivl+') 应短于 good('+sG.ivl+')');
ck(sG.ivl===6,'good 第二次间隔应6天，实为'+sG.ivl);
ck(sG.due>sH.due,'good 到期日应晚于 hard');
ck(sG.ef>sH.ef,'good EF('+sG.ef+') 应高于 hard EF('+sH.ef+')');

// 6. EF 上下限
for(let i=0;i<30;i++) SRS.grade(idH,'again',at(1)+1000*(i+1));
ck(SRS.cardState(idH).state.ef>=1.3,'EF 低于下限 1.3');
for(let i=0;i<30;i++) SRS.grade(idG,'good',at(2)+1000*(i+1));
ck(SRS.cardState(idG).state.ef<=3.0,'EF 超过上限 3.0');

// 7. 推进 30 天：每日新学不超配额，队列无重复
let maxNew=0;
for(let d=2;d<=30;d++){
  const s=SRS.session(at(d));
  const nw=s.filter(x=>x.isNew).length;
  maxNew=Math.max(maxNew,nw);
  ck(nw<=10,'第'+d+'天新学超配额：'+nw);
  ck(new Set(s.map(x=>x.card.id)).size===s.length,'第'+d+'天队列内有重复卡');
  s.forEach(x=>SRS.grade(x.card.id,'good',at(d)));
}
ck(maxNew===10,'每日新学应稳定在配额10，峰值'+maxNew);
ov=SRS.overview(at(30));
// 已学 300 张 = 第 0 天会话 10 张 + 第 2～30 天（29 天）×10 张；
// 第 1 天的会话在本文件第 4～6 节只单独评了 3 张，其余新卡未记入进度
const expectLearned=300;
ck(ov.learnedCount===expectLearned,'30天后应学完'+expectLearned+'张，实为'+ov.learnedCount);
ck(ov.freshCount===TOTAL-expectLearned,'30天后未学应为'+(TOTAL-expectLearned)+'，实为'+ov.freshCount);

// 8. 配额可调且有边界
SRS.setNewPerDay(20); ck(SRS.overview(at(31)).newPerDay===20,'配额设置未生效');
SRS.setNewPerDay(999); ck(SRS.overview(at(31)).newPerDay===100,'配额应截断到100');
SRS.setNewPerDay(-5); ck(SRS.overview(at(31)).newPerDay===0,'负值应归零');
SRS.setNewPerDay(10);

// 9. 持久化
const b=SRS.overview(at(31));
run('yy-srs.js');
const a=W.YY_SRS.overview(at(31));
ck(b.learnedCount===a.learnedCount,'重载后进度丢失 '+b.learnedCount+'→'+a.learnedCount);
ck(b.dueCount===a.dueCount,'重载后到期数不一致 '+b.dueCount+'→'+a.dueCount);

// 10. 复习量随间隔递增而分散
const mature=[];
for(let d=31;d<=45;d++){
  const s=W.YY_SRS.session(at(d));
  mature.push(s.filter(x=>!x.isNew).length);
  s.forEach(x=>W.YY_SRS.grade(x.card.id,'good',at(d)));
}
ck(Math.max(...mature)<TOTAL,'到期量未分散，峰值'+Math.max(...mature));

// 11. streak / forecast / reset
ck(W.YY_SRS.streak(at(45))>=1,'streak 异常');
ck(W.YY_SRS.forecast(at(45),7).length===7,'预测应为7天');
W.YY_SRS.resetAll();
ck(W.YY_SRS.overview(at(45)).learnedCount===0,'resetAll 未清空');

// 12. 【回归】间隔必须封顶，防止几何增长溢出成 Infinity/NaN
{
  const s=W.YY_SRS.session(at(50));
  const id2=s[0].card.id;
  for(let i=0;i<80;i++) W.YY_SRS.grade(id2,'good',at(50)+1000*(i+1));
  const s2=W.YY_SRS.cardState(id2).state;
  ck(isFinite(s2.ivl)&&s2.ivl<=365,'间隔未封顶，实为 '+s2.ivl);
  ck(typeof s2.due==='number'&&isFinite(s2.due),'due 溢出为 '+s2.due);
  ck(s2.due>0&&s2.due<=at(50)+400*DAY,'due 超出合理范围');
}

// 13. 【回归】被污染的存档必须自愈，不能留下永不到期的卡
{
  const raw=JSON.parse(mem['yy-srs-v1']);
  raw.states.poison={state:{n:5,ef:null,ivl:1e20,due:null},seen:1,wrong:0,last:0};
  mem['yy-srs-v1']=JSON.stringify(raw);
  run('yy-srs.js');
  const p=W.YY_SRS.cardState('poison');
  ck(!!p,'污染卡丢失');
  ck(p&&isFinite(p.state.due)&&isFinite(p.state.ivl)&&isFinite(p.state.ef),'污染状态未净化');
  ck(p&&p.state.due<=at(50)+366*DAY,'净化后到期日超出合理范围');
}

console.log(fails.length ? '❌ 失败 '+fails.length+' 项:\n'+fails.map(f=>' - '+f).join('\n') : '✅ SM-2 引擎全部测试通过（13 组 / 50+ 断言）');
console.log('第31-45天到期量:',mature.join(','));
