import { useEffect, useRef, useState } from 'react';
import { EMPTY_DATA, type AppData } from './store/types';
import { loadData, saveData } from './store/DataStore';
import WrongQuestionsPage from './pages/WrongQuestionsPage';
import ReviewPage from './pages/ReviewPage';
import TricksPage from './pages/TricksPage';
import StatsPage from './pages/StatsPage';
import type { QuestionFilter } from './stats/stats';

export type TabId = 'wrong' | 'review' | 'tricks' | 'stats';

const TABS: { id: TabId; label: string }[] = [
  { id: 'wrong', label: '错题' },
  { id: 'review', label: '复习' },
  { id: 'tricks', label: 'Trick' },
  { id: 'stats', label: '统计' },
];

const DEFAULT_FILTER: QuestionFilter = { kps: [], cause: '', status: '', keyword: '', dateFrom: '', dateTo: '' };

export default function App() {
  const [data, setData] = useState<AppData>(EMPTY_DATA);
  const [tab, setTab] = useState<TabId>('wrong');
  const [filter, setFilter] = useState<QuestionFilter>(DEFAULT_FILTER);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const saveTimer = useRef<number | undefined>(undefined);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());

  const load = () => {
    setError(null);
    setLoadFailed(false);
    loadData()
      .then((d) => { setData(d); setLoaded(true); })
      .catch((e: Error) => { setError(e.message); setLoadFailed(true); });
  };

  useEffect(() => { load(); }, []);

  const onUpdateData = (next: AppData) => {
    setData(next);
    setError(null);
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveQueue.current = saveQueue.current.then(() => saveData(next)).catch((e: Error) => setError(e.message));
    }, 500);
  };

  const page = {
    wrong: <WrongQuestionsPage data={data} onUpdateData={onUpdateData} filter={filter} setFilter={setFilter} />,
    review: <ReviewPage data={data} onUpdateData={onUpdateData} />,
    tricks: <TricksPage data={data} onUpdateData={onUpdateData} />,
    stats: <StatsPage data={data} />,
  }[tab];

  return (
    <div className="app">
      <header className="topbar">
        <h1>资料分析错题本</h1>
        <nav>
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'tab active' : 'tab'} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
      </header>
      {error && (
        <div className="error-banner">
          {error}
          {loadFailed && <button onClick={load}>重试</button>}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}
      <main>
        {!loaded ? <p className="hint">{loadFailed ? '加载失败' : '加载中…'}</p> : page}
      </main>
    </div>
  );
}
