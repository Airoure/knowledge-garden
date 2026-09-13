import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend } from 'recharts';
import { byErrorCause, byKnowledgePoint, byStatus, weakestTopics, weeklyTrend } from '../stats/stats';
import type { AppData } from '../store/types';

const COLORS = ['#c53b2e', '#2b4c7e', '#b07718', '#3e7a4c', '#6b6555', '#a02a20', '#8a7a3f', '#5b6b2f', '#26231b'];

export default function StatsPage({ data }: { data: AppData }) {
  const qs = data.wrongQuestions;
  const kp = useMemo(() => byKnowledgePoint(qs), [qs]);
  const cause = useMemo(() => byErrorCause(qs), [qs]);
  const status = useMemo(() => byStatus(qs), [qs]);
  const trend = useMemo(() => weeklyTrend(qs), [qs]);
  const weak = useMemo(() => weakestTopics(qs), [qs]);

  if (qs.length === 0) return <p className="hint">还没有错题数据，先去记录吧</p>;

  return (
    <div>
      <div className="chart-grid">
        <div className="chart-box">
          <h3>知识点错题分布</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={kp}>
              <XAxis dataKey="key" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" name="错题数" fill="#c53b2e" radius={[0, 0, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-box">
          <h3>错因分布</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={cause} dataKey="count" nameKey="key" innerRadius={40} outerRadius={80} label>
                {cause.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-box">
          <h3>掌握状态分布</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={status} dataKey="count" nameKey="status" innerRadius={40} outerRadius={80} label={(e) => ({ unmastered: '未掌握', reviewing: '复习中', mastered: '已掌握' })[e.name as string] ?? e.name}>
                <Cell fill="#c53b2e" /><Cell fill="#b07718" /><Cell fill="#3e7a4c" />
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-box">
          <h3>近 8 周新增错题趋势</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="count" name="新增错题" stroke="#2b4c7e" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        <strong>最薄弱知识点 Top {weak.length}</strong>
        {weak.length === 0 ? <p className="hint" style={{ padding: 8 }}>暂无未掌握错题</p> : (
          <ul>
            {weak.map((w) => <li key={w.key}>{w.key}：{w.count} 道未掌握</li>)}
          </ul>
        )}
      </div>
    </div>
  );
}
