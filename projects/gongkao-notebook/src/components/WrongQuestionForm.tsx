import { useState, type ClipboardEvent, type FormEvent } from 'react';
import { ERROR_CAUSES, KNOWLEDGE_POINTS, type Trick, type WrongQuestion } from '../store/types';
import { compressImage, fileToDataUrl } from '../lib/image';
import { appendPastedImage } from '../lib/paste';
import LinkedTricks from './LinkedTricks';

export interface WrongQuestionInput {
  source?: string; stem: string; stemImages: string[]; options?: string; optionsImages: string[];
  myAnswer: string; correctAnswer: string;
  analysis?: string; knowledgePoint: WrongQuestion['knowledgePoint']; errorCause: WrongQuestion['errorCause']; tags: string[];
  trickIds: string[];
}

export default function WrongQuestionForm({ initial, tricks, onSubmit, onClose }: {
  initial?: WrongQuestion;
  tricks: Trick[];
  onSubmit: (q: WrongQuestionInput) => void;
  onClose: () => void;
}) {
  const [f, setF] = useState<WrongQuestionInput>({
    source: initial?.source ?? '',
    stem: initial?.stem ?? '',
    stemImages: initial?.stemImages ?? [],
    options: initial?.options ?? '',
    optionsImages: initial?.optionsImages ?? [],
    myAnswer: initial?.myAnswer ?? '',
    correctAnswer: initial?.correctAnswer ?? '',
    analysis: initial?.analysis ?? '',
    knowledgePoint: initial?.knowledgePoint ?? KNOWLEDGE_POINTS[0],
    errorCause: initial?.errorCause ?? ERROR_CAUSES[0],
    tags: initial?.tags ?? [],
    trickIds: initial?.trickIds ?? [],
  });
  const [tagInput, setTagInput] = useState('');
  const [pasteTarget, setPasteTarget] = useState<'stem' | 'options'>('stem');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!f.stem.trim() && f.stemImages.length === 0) return;
    if (!f.myAnswer.trim() || !f.correctAnswer.trim()) return;
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
        setF((prev) => appendPastedImage(prev, pasteTarget, compressed));
      } catch {
        // 无法读取的图片直接忽略，可重新粘贴
      }
    }
  };

  const toggleTrick = (id: string) => setF((prev) => ({
    ...prev,
    trickIds: prev.trickIds.includes(id) ? prev.trickIds.filter((x) => x !== id) : [...prev.trickIds, id],
  }));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{initial ? '编辑错题' : '新增错题'}</h2>
        <form onSubmit={submit} onPaste={onPaste}>
          <div className="form-row">
            <label>题干（文字或粘贴图片）</label>
            <textarea value={f.stem} onChange={(e) => setF({ ...f, stem: e.target.value })} onFocus={() => setPasteTarget('stem')} placeholder="粘贴题干文字，或在此表单内按 ⌘V / Ctrl+V 粘贴截图（支持多张）" />
            {f.stemImages.length > 0 && (
              <div className="stem-images">
                {f.stemImages.map((src, i) => (
                  <div key={i} className="thumb">
                    <img src={src} alt={`题干图片 ${i + 1}`} />
                    <button type="button" title="移除" onClick={() => setF({ ...f, stemImages: f.stemImages.filter((_, j) => j !== i) })}>×</button>
                  </div>
                ))}
              </div>
            )}
            <div className="paste-hint">光标停在题干/选项输入框时 ⌘V / Ctrl+V 粘贴图片（支持多张）</div>
          </div>
          <div className="form-row">
            <label>关联 Trick（可选，点选/取消）</label>
            {tricks.length === 0
              ? <div className="paste-hint">还没有 Trick，可先去 Trick 页添加</div>
              : <LinkedTricks tricks={tricks} ids={f.trickIds} onToggle={toggleTrick} />}
          </div>
          <div className="form-row">
            <label>选项（换行分隔，可选；聚焦此处可粘贴图片）</label>
            <textarea value={f.options} onChange={(e) => setF({ ...f, options: e.target.value })}
              onFocus={() => setPasteTarget('options')} onBlur={() => setPasteTarget('stem')} />
            {f.optionsImages.length > 0 && (
              <div className="stem-images">
                {f.optionsImages.map((src, i) => (
                  <div key={i} className="thumb">
                    <img src={src} alt={`选项图片 ${i + 1}`} />
                    <button type="button" title="移除" onClick={() => setF({ ...f, optionsImages: f.optionsImages.filter((_, j) => j !== i) })}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="form-row">
            <label>我的答案 *</label>
            <input type="text" value={f.myAnswer} onChange={(e) => setF({ ...f, myAnswer: e.target.value })} />
          </div>
          <div className="form-row">
            <label>正确答案 *</label>
            <input type="text" value={f.correctAnswer} onChange={(e) => setF({ ...f, correctAnswer: e.target.value })} />
          </div>
          <div className="form-row">
            <label>知识点</label>
            <select value={f.knowledgePoint} onChange={(e) => setF({ ...f, knowledgePoint: e.target.value as WrongQuestion['knowledgePoint'] })}>
              {KNOWLEDGE_POINTS.map((kp) => <option key={kp} value={kp}>{kp}</option>)}
            </select>
          </div>
          <div className="form-row">
            <label>错因</label>
            <select value={f.errorCause} onChange={(e) => setF({ ...f, errorCause: e.target.value as WrongQuestion['errorCause'] })}>
              {ERROR_CAUSES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-row">
            <label>来源（可选）</label>
            <input type="text" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} placeholder="如：2025 国考副省级卷" />
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
            <label>解析 / 笔记（可选）</label>
            <textarea value={f.analysis} onChange={(e) => setF({ ...f, analysis: e.target.value })} />
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
