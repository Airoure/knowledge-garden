import { useState } from 'react';
import { KNOWLEDGE_POINTS, todayStr, type AppData, type Trick } from '../store/types';
import TrickForm, { type TrickInput } from '../components/TrickForm';
import { usePrintMode } from '../usePrintMode';

export default function TricksPage({ data, onUpdateData }: { data: AppData; onUpdateData: (n: AppData) => void }) {
  const [keyword, setKeyword] = useState('');
  const [kp, setKp] = useState('');
  const [editing, setEditing] = useState<Trick | 'new' | null>(null);
  const [, startPrint] = usePrintMode();

  const list = data.tricks
    .filter((t) => !kp || t.knowledgePoint === kp)
    .filter((t) => {
      const kw = keyword.trim().toLowerCase();
      if (!kw) return true;
      return [t.title, t.content, ...t.tags].join(' ').toLowerCase().includes(kw);
    })
    .sort((a, b) => Number(b.pinned) - Number(a.pinned));

  /** crypto.randomUUID 在非 HTTPS 环境不可用，提供兼容实现 */
  const genId = () => (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);

  const upsert = (input: TrickInput, existing?: Trick) => {
    let next: Trick[];
    if (existing) {
      next = data.tricks.map((t) => t.id === existing.id ? { ...existing, ...input } : t);
    } else {
      next = [{ ...input, id: genId(), createdAt: todayStr() }, ...data.tricks];
    }
    onUpdateData({ ...data, tricks: next });
    setEditing(null);
  };

  return (
    <div>
      <div className="filterbar">
        <input type="text" placeholder="搜索标题/内容/标签" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
        <select value={kp} onChange={(e) => setKp(e.target.value)}>
          <option value="">全部知识点</option>
          {KNOWLEDGE_POINTS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <button onClick={startPrint}>导出 PDF</button>
        <button onClick={() => setEditing('new')} className="primary">+ 新增 Trick</button>
      </div>

      <div className="print-header">资料分析计算 Trick 集（共 {list.length} 条 · {new Date().toLocaleDateString('zh-CN')}）</div>
      {list.length === 0 && <p className="hint">没有符合条件的 Trick</p>}
      {list.map((t) => (
        <div key={t.id} className="card">
          <div className="stem"><strong>{t.pinned ? '📌 ' : ''}{t.title}</strong></div>
          <div className="stem">{t.content}</div>
          {t.contentImages && t.contentImages.length > 0 && (
            <div className="stem-images">
              {t.contentImages.map((src, i) => <img key={i} src={src} alt={`内容图片 ${i + 1}`} />)}
            </div>
          )}
          <div className="meta">
            {t.knowledgePoint && <span className="badge kp">{t.knowledgePoint}</span>}
            {t.tags.map((tag) => <span key={tag} className="badge cause">{tag}</span>)}
          </div>
          <div className="actions">
            <button onClick={() => setEditing(t)}>编辑</button>
            <button onClick={() => {
              if (window.confirm('删除这条 Trick？')) onUpdateData({ ...data, tricks: data.tricks.filter((x) => x.id !== t.id) });
            }}>删除</button>
          </div>
        </div>
      ))}

      {editing && (
        <TrickForm
          initial={editing === 'new' ? undefined : editing}
          onSubmit={(input) => upsert(input, editing === 'new' ? undefined : editing)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
