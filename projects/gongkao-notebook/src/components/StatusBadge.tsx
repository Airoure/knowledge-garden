import type { MasteryStatus } from '../store/types';

const LABEL: Record<MasteryStatus, string> = { unmastered: '未掌握', reviewing: '复习中', mastered: '已掌握' };

export default function StatusBadge({ status }: { status: MasteryStatus }) {
  return <span className={`badge ${status}`}>{LABEL[status]}</span>;
}
