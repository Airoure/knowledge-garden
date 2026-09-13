import { useState } from 'react';
import { ERROR_CAUSES, KNOWLEDGE_POINTS, todayStr, type AppData, type WrongQuestion } from '../store/types';
import { filterQuestions, type QuestionFilter } from '../stats/stats';
import StatusBadge from '../components/StatusBadge';
import LinkedTricks from '../components/LinkedTricks';
import WrongQuestionForm, { type WrongQuestionInput } from '../components/WrongQuestionForm';
import { usePrintMode } from '../usePrintMode';

export default function WrongQuestionsPage({ data, onUpdateData, filter, setFilter }: {
  data: AppData; onUpdateData: (n: AppData) => void;
  filter: QuestionFilter; setFilter: (f: QuestionFilter) => void;
}) {
  const [editing, setEditing] = useState<WrongQuestion | 'new' | null>(null);
  const [printing, startPrint] = usePrintMode();

  const list = filterQuestions(data.wrongQuestions, filter);

  const toggleKp = (kp: string) => setFilter({ ...filter, kps: filter.kps.includes(kp) ? filter.kps.filter((x) => x !== kp) : [...filter.kps, kp] });

  /** crypto.randomUUID 在非 HTTPS 环境不可用，提供兼容实现 */
  const genId = () => (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);

  const upsert = (input: WrongQuestionInput, existing?: WrongQuestion) => {
    let next: WrongQuestion[];
    if (existing) {
      next = data.wrongQuestions.map((q) => q.id === existing.id ? { ...existing, ...input } : q);
    } else {
      next = [{
        ...input, id: genId(), createdAt: todayStr(),
        status: 'unmastered', reviewCount: 0, lastReviewAt: null, reviewLog: [],
      } as WrongQuestion, ...data.wrongQuestions];
    }
    onUpdateData({ ...data, wrongQuestions: next });
    setEditing(null);
  };

  const remove = (id: string) => {
    if (window.confirm('删除这道错题？')) onUpdateData({ ...data, wrongQuestions: data.wrongQuestions.filter((q) => q.id !== id) });
  };

  return (
    <div>
      <div className="filterbar">
        <select value={filter.cause} onChange={(e) => setFilter({ ...filter, cause: e.target.value })}>
          <option value="">全部错因</option>
          {ERROR_CAUSES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}>
          <option value="">全部状态</option>
          <option value="unmastered">未掌握</option>
          <option value="reviewing">复习中</option>
          <option value="mastered">已掌握</option>
        </select>
        <input type="text" placeholder="搜索题干/来源/标签" value={filter.keyword}
          onChange={(e) => setFilter({ ...filter, keyword: e.target.value })} />
        <label className="date-filter">从 <input type="date" value={filter.dateFrom} onChange={(e) => setFilter({ ...filter, dateFrom: e.target.value })} /></label>
        <label className="date-filter">到 <input type="date" value={filter.dateTo} onChange={(e) => setFilter({ ...filter, dateTo: e.target.value })} /></label>
        <button onClick={startPrint}>导出 PDF</button>
        <button onClick={() => setEditing('new')} className="primary">+ 新增错题</button>
        <div style={{ width: '100%' }}>
          {KNOWLEDGE_POINTS.map((kp) => (
            <span key={kp} className={filter.kps.includes(kp) ? 'chip on' : 'chip'} onClick={() => toggleKp(kp)}>{kp}</span>
          ))}
        </div>
      </div>

      <div className="print-header">资料分析错题集（共 {list.length} 题{filter.dateFrom || filter.dateTo ? ` · ${filter.dateFrom || '…'} 至 ${filter.dateTo || '…'}` : ''}）</div>
      {list.length === 0 && <p className="hint">没有符合条件的错题</p>}
      {list.map((q) => (
        <div key={q.id} className="card">
          <div className="stem">{q.stem}</div>
          {q.stemImages && q.stemImages.length > 0 && (
            <div className="stem-images">
              {q.stemImages.map((src, i) => <img key={i} src={src} alt={`题干图片 ${i + 1}`} />)}
            </div>
          )}
          <div className="meta">
            <StatusBadge status={q.status} />
            <span className="badge kp">{q.knowledgePoint}</span>
            <span className="badge cause">{q.errorCause}</span>
            {q.source && <span>来源：{q.source}</span>}
            <span>记录：{q.createdAt}</span>
            <span>复习 {q.reviewCount} 次</span>
          </div>
          {q.options && <div className="stem" style={{ marginTop: 8 }}>{q.options}</div>}
          {q.optionsImages && q.optionsImages.length > 0 && (
            <div className="stem-images">
              {q.optionsImages.map((src, i) => <img key={i} src={src} alt={`选项图片 ${i + 1}`} />)}
            </div>
          )}
          <div className="stem" style={{ marginTop: 8 }}>
            <strong>我的答案：</strong>{q.myAnswer}　<strong style={{ color: '#15803d' }}>正确答案：{q.correctAnswer}</strong>
          </div>
          {q.analysis && <div className="stem" style={{ marginTop: 8, color: '#444' }}>解析：{q.analysis}</div>}
          <LinkedTricks tricks={data.tricks} ids={q.trickIds} forceExpand={printing} />
          <div className="actions">
            <button onClick={() => setEditing(q)}>编辑</button>
            <button onClick={() => remove(q.id)}>删除</button>
          </div>
        </div>
      ))}

      {editing && (
        <WrongQuestionForm
          initial={editing === 'new' ? undefined : editing}
          tricks={data.tricks}
          onSubmit={(input) => upsert(input, editing === 'new' ? undefined : editing)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
