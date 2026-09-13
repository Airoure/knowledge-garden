export const KNOWLEDGE_POINTS = ['增长率', '增长量', '比重', '平均数', '倍数', '基期现期', '年均增长', '混合增长率', '其他'] as const;
export type KnowledgePoint = (typeof KNOWLEDGE_POINTS)[number];

export const ERROR_CAUSES = ['计算失误', '公式不熟', '审题不清', '估算误差', '其他'] as const;
export type ErrorCause = (typeof ERROR_CAUSES)[number];

export type MasteryStatus = 'unmastered' | 'reviewing' | 'mastered';

export interface ReviewLogEntry { at: string; correct: boolean }

export interface WrongQuestion {
  id: string;
  createdAt: string;
  source?: string;
  stem: string;
  stemImages?: string[];  // 粘贴的题干图片（base64 data URL）
  optionsImages?: string[]; // 粘贴的选项图片（base64 data URL）
  trickIds?: string[];    // 关联的 Trick id
  options?: string;
  myAnswer: string;
  correctAnswer: string;
  analysis?: string;
  knowledgePoint: KnowledgePoint;
  errorCause: ErrorCause;
  tags: string[];
  status: MasteryStatus;
  reviewCount: number;
  lastReviewAt: string | null;
  reviewLog: ReviewLogEntry[];
}

export interface Trick {
  id: string;
  createdAt: string;
  title: string;
  content: string;
  contentImages?: string[]; // 粘贴的内容图片（base64 data URL）
  knowledgePoint?: KnowledgePoint;
  tags: string[];
  pinned: boolean;
}

export interface AppData {
  dataVersion: 1;
  wrongQuestions: WrongQuestion[];
  tricks: Trick[];
}

export const EMPTY_DATA: AppData = { dataVersion: 1, wrongQuestions: [], tricks: [] };

export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
