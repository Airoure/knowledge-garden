import { useState, type ClipboardEvent, type FormEvent } from 'react';
import { KNOWLEDGE_POINTS, type Trick } from '../store/types';
import { compressImage, fileToDataUrl } from '../lib/image';

export interface TrickInput {
  title: string; content: string; contentImages: string[];
  knowledgePoint?: Trick['knowledgePoint']; tags: string[]; pinned: boolean;
}

export default function TrickForm({ initial, onSubmit, onClose }: {
  initial?: Trick; onSubmit: (t: TrickInput) => void; onClose: () => void;
}) {
  const [f, setF] = useState<TrickInput>({
    title: initial?.title ?? '',
    content: initial?.content ?? '',
    contentImages: initial?.contentImages ?? [],
    knowledgePoint: initial?.knowledgePoint ?? undefined,
    tags: initial?.tags ?? [],
    pinned: initial?.pinned ?? false,
  });
  const [tagInput, setTagInput] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!f.title.trim() || !f.content.trim()) return;
    onSubmit({ ...f, tags: f.tags });
  };

  const onPaste = async (e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (!item.type.startsWith('image/')) continue;
      e.preventDefault();
      const file = item.getAsFile();
      if (!file) continue;
      try {
        const raw = await fileToDataUrl(file);
        const compressed = await compressImage(raw);
        setF((prev) => ({ ...prev, contentImages: [...prev.contentImages, compressed] }));
      } catch {
        // 无法读取的图片直接忽略，可重新粘贴
      }
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{initial ? '编辑 Trick' : '新增 Trick'}</h2>
        <form onSubmit={submit} onPaste={onPaste}>
          <div className="form-row">
            <label>标题 *</label>
            <input type="text" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="如：混合增长率十字交叉法" />
          </div>
          <div className="form-row">
            <label>内容 *（纯文本，公式可粘贴图片）</label>
            <textarea value={f.content} onChange={(e) => setF({ ...f, content: e.target.value })} style={{ minHeight: 160 }}
              placeholder={'示例：\n混合增长率 r 介于部分增长率之间，偏向基期量大的一方。'} />
            {f.contentImages.length > 0 && (
              <div className="stem-images">
                {f.contentImages.map((src, i) => (
                  <div key={i} className="thumb">
                    <img src={src} alt={`内容图片 ${i + 1}`} />
                    <button type="button" title="移除" onClick={() => setF({ ...f, contentImages: f.contentImages.filter((_, j) => j !== i) })}>×</button>
                  </div>
                ))}
              </div>
            )}
            <div className="paste-hint">在此表单内 ⌘V / Ctrl+V 粘贴图片（支持多张）</div>
          </div>
          <div className="form-row">
            <label>关联知识点（可选）</label>
            <select value={f.knowledgePoint ?? ''} onChange={(e) => setF({ ...f, knowledgePoint: (e.target.value || undefined) as Trick['knowledgePoint'] | undefined })}>
              <option value="">无</option>
              {KNOWLEDGE_POINTS.map((kp) => <option key={kp} value={kp}>{kp}</option>)}
            </select>
          </div>
          <div className="form-row">
            <label>标签（回车添加）</label>
            <input type="text" value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); const t = tagInput.trim(); if (t && !f.tags.includes(t)) setF({ ...f, tags: [...f.tags, t] }); setTagInput(''); }
              }} />
            <div>{f.tags.map((t) => (
              <span key={t} className="chip on" style={{ marginRight: 6, marginTop: 6 }}
                onClick={() => setF({ ...f, tags: f.tags.filter((x) => x !== t) })}>{t} ×</span>
            ))}</div>
          </div>
          <div className="form-row">
            <label><input type="checkbox" checked={f.pinned} onChange={(e) => setF({ ...f, pinned: e.target.checked })} /> 置顶</label>
          </div>
          <div className="form-actions">
            <button type="button" onClick={onClose}>取消</button>
            <button type="submit" className="primary">保存</button>
          </div>
        </form>
      </div>
    </div>
  );
}
