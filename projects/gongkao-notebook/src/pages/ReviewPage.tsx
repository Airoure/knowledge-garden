import { useState } from 'react';
import { KNOWLEDGE_POINTS, type AppData, type WrongQuestion } from '../store/types';
import { filterQuestions } from '../stats/stats';
import { applyReviewResult } from '../stats/review';
import StatusBadge from '../components/StatusBadge';
import LinkedTricks from '../components/LinkedTricks';

export default function ReviewPage({ data, onUpdateData }: { data: AppData; onUpdateData: (n: AppData) => void }) {
  const [kps, setKps] = useState<string[]>([]);
  const [status, setStatus] = useState('unmastered');
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [summary, setSummary] = useState<{ correct: number; total: number } | null>(null);
  // Freeze the queue when a round starts (mount / filter change / restart) so that
  // answering — which changes question statuses and shrinks the live filter — never
  // shifts idx onto a different question or skips one mid-round.
  const [round, setRound] = useState<WrongQuestion[]>(() =>
    filterQuestions(data.wrongQuestions, { kps, cause: '', status, keyword: '', dateFrom: '', dateTo: '' }),
  );

  const startRound = (nextKps: string[], nextStatus: string) => {
    setRound(filterQuestions(data.wrongQuestions, { kps: nextKps, cause: '', status: nextStatus, keyword: '', dateFrom: '', dateTo: '' }));
    setIdx(0);
    setRevealed(false);
    setSummary(null);
    setCorrectCount(0);
  };

  const reset = () => { setIdx(0); setRevealed(false); setSummary(null); setCorrectCount(0); };

  const liveOf = (q: WrongQuestion) => data.wrongQuestions.find((x) => x.id === q.id) ?? q;

  const answer = (correct: boolean) => {
    const q = round[idx];
    const updated = applyReviewResult(liveOf(q), correct);
    onUpdateData({ ...data, wrongQuestions: data.wrongQuestions.map((x) => x.id === q.id ? updated : x) });
    const newCorrect = correctCount + (correct ? 1 : 0);
    setCorrectCount(newCorrect);
    const done = idx + 1 >= round.length;
    if (done) { setSummary({ correct: newCorrect, total: round.length }); setRevealed(false); setIdx(0); }
    else { setIdx(idx + 1); setRevealed(false); }
  };

  if (summary) {
    return (
      <div className="review-card">
        <h2>本次复习完成</h2>
        <p>答对 {summary.correct} / {summary.total}，状态已自动更新。</p>
        <button onClick={() => startRound(kps, status)}>再来一轮</button>
      </div>
    );
  }

  const q = round[idx];
  const live = q ? liveOf(q) : null;

  return (
    <div>
      <div className="filterbar">
        <select value={status} onChange={(e) => { const v = e.target.value; setStatus(v); startRound(kps, v); }}>
          <option value="unmastered">未掌握</option>
          <option value="reviewing">复习中</option>
          <option value="mastered">已掌握</option>
          <option value="">全部状态</option>
        </select>
        <button onClick={reset}>重置进度</button>
        <div style={{ width: '100%' }}>
          {KNOWLEDGE_POINTS.map((kp) => (
            <span key={kp} className={kps.includes(kp) ? 'chip on' : 'chip'}
              onClick={() => { const next = kps.includes(kp) ? kps.filter((x) => x !== kp) : [...kps, kp]; setKps(next); startRound(next, status); }}>{kp}</span>
          ))}
        </div>
      </div>

      {round.length === 0 || !live ? <p className="hint">没有符合条件的错题</p> : (
        <div className="review-card">
          <div className="meta" style={{ marginBottom: 10 }}>
            <StatusBadge status={live.status} />
            <span className="badge kp">{q.knowledgePoint}</span>
            <span>{idx + 1} / {round.length}</span>
          </div>
          <div className="stem">{q.stem}</div>
          {q.stemImages && q.stemImages.length > 0 && (
            <div className="stem-images">
              {q.stemImages.map((src, i) => <img key={i} src={src} alt={`题干图片 ${i + 1}`} />)}
            </div>
          )}
          {q.options && <div className="stem" style={{ marginTop: 10 }}>{q.options}</div>}
          {q.optionsImages && q.optionsImages.length > 0 && (
            <div className="stem-images">
              {q.optionsImages.map((src, i) => <img key={i} src={src} alt={`选项图片 ${i + 1}`} />)}
            </div>
          )}
          {!revealed ? (
            <div className="review-actions">
              <button className="primary" onClick={() => setRevealed(true)}>显示答案</button>
            </div>
          ) : (
            <>
              <div className="answer-box">
                <div><strong>我的答案：</strong>{q.myAnswer}</div>
                <div><strong style={{ color: '#15803d' }}>正确答案：{q.correctAnswer}</strong></div>
                {q.analysis && <div style={{ marginTop: 8, color: '#444' }}>解析：{q.analysis}</div>}
                {q.trickIds && q.trickIds.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>关联 Trick（点开看方法）：</div>
                    <LinkedTricks tricks={data.tricks} ids={q.trickIds} />
                  </div>
                )}
              </div>
              <div className="review-actions">
                <button className="primary" onClick={() => answer(true)}>做对了</button>
                <button onClick={() => answer(false)}>还是错</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
