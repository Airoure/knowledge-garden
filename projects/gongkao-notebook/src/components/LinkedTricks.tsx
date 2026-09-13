import { useState } from 'react';
import type { Trick } from '../store/types';

/**
 * 错题关联的 Trick。
 * - 表单选择模式（传 onToggle）：列出全部 trick，点选/取消选择
 * - 展示模式（不传 onToggle）：只显示 ids 命中的 trick，点击展开/收起内容（纯文本 + 图片）
 * 已被删除的 trick id 自动跳过。
 */
export default function LinkedTricks({ tricks, ids, onToggle, forceExpand = false }: {
  tricks: Trick[];
  ids?: string[];
  onToggle?: (id: string) => void;
  forceExpand?: boolean; // 打印模式：全部展开
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const selectable = !!onToggle;

  const items = selectable
    ? tricks
    : (ids ?? []).map((id) => tricks.find((t) => t.id === id)).filter((t): t is Trick => !!t);
  if (items.length === 0) return null;

  const selected = new Set(ids ?? []);

  const toggleExpand = (id: string) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <div className="linked-tricks">
      {items.map((t) => (
        <div key={t.id} className={selected.has(t.id) ? 'trick-chip on' : 'trick-chip'}>
          <button
            type="button"
            className="trick-chip-btn"
            onClick={() => (selectable ? onToggle!(t.id) : toggleExpand(t.id))}
            title={selectable ? (selected.has(t.id) ? '取消关联' : '关联此 Trick') : (expanded.has(t.id) ? '收起' : '展开')}
          >
            {t.pinned ? '📌 ' : ''}{t.title}
            {t.knowledgePoint && <span className="badge kp">{t.knowledgePoint}</span>}
            {!selectable && !forceExpand && <span className="expand-hint">{expanded.has(t.id) ? '▲' : '▼'}</span>}
          </button>
          {!selectable && (forceExpand || expanded.has(t.id)) && (
            <div className="trick-chip-body">
              <div className="stem">{t.content}</div>
              {t.contentImages && t.contentImages.length > 0 && (
                <div className="stem-images">
                  {t.contentImages.map((src, i) => <img key={i} src={src} alt={`内容图片 ${i + 1}`} />)}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
