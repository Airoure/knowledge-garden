# 选项图片输入 + Trick 纯文本化 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 错题表单的选项支持粘贴图片；Trick 内容编辑改为纯文本 + 图片，彻底移除 markdown/KaTeX 渲染。

**Architecture:** 沿用题干 `stemImages` 的既有模式——图片以压缩后的 base64 data URL 存入字符串数组，表单级 `onPaste` 按焦点路由到不同字段。图片压缩工具提取为共享模块，供错题表单与 Trick 表单复用。Trick 纯文本渲染依赖 `.card .stem` 已有的 `white-space: pre-wrap`。

**Tech Stack:** React 19 + TypeScript + Vite；无新增依赖（移除 marked / katex / dompurify / @types/katex）。

## Global Constraints

- 数据文件格式：`dataVersion` 保持 `1`，所有新增字段为可选（`optionsImages?`、`contentImages?`），旧数据不破坏。
- 图片一律压缩：`compressImage`（≤1600px、JPEG 0.85），原始图更小则保留原样。
- 界面文案用中文；提示文案需说明"光标停在哪个输入框，图片粘贴到哪"。
- 不删除 `data/data.json` 中除 3 条 Trick `content` 字段以外的任何内容（用户有未提交改动）。
- 所有 UI 改动验证方式：`npm run build` 通过；Task 1 另有 vitest 单测。

---

### Task 1: 数据模型 + 校验 + 测试

**Files:**
- Modify: `src/store/types.ts`
- Modify: `src/store/DataStore.ts`
- Modify: `src/store/DataStore.test.ts`

**Interfaces:**
- Consumes: 现有 `WrongQuestion`、`Trick` 接口。
- Produces: `WrongQuestion.optionsImages?: string[]`、`Trick.contentImages?: string[]`（后续所有任务消费此字段名）。

- [ ] **Step 1: 在 `WrongQuestion` 增加 `optionsImages`**

在 `src/store/types.ts` 中 `stemImages` 字段旁新增：

```ts
  stemImages?: string[];  // 粘贴的题干图片（base64 data URL）
  optionsImages?: string[]; // 粘贴的选项图片（base64 data URL）
```

- [ ] **Step 2: 在 `Trick` 增加 `contentImages`**

```ts
  content: string;
  contentImages?: string[]; // 粘贴的内容图片（base64 data URL）
```

- [ ] **Step 3: 写失败测试**

在 `src/store/DataStore.test.ts` 的 `describe('validateData / isValidData')` 内、`trickIds` 相关测试之后追加：

```ts
  it('accepts wrong questions with optionsImages', () => {
    expect(validateData(data({ wrongQuestions: [{ ...wq(), optionsImages: ['data:image/jpeg;base64,AAA'] }] }))).toBeNull();
  });

  it('rejects wrong questions whose optionsImages is not a string array', () => {
    expect(validateData(data({ wrongQuestions: [{ ...wq(), optionsImages: 'x' }] }))).toMatch(/optionsImages/);
  });

  it('rejects wrong questions with a non-string optionsImages entry', () => {
    expect(validateData(data({ wrongQuestions: [{ ...wq(), optionsImages: [42] }] }))).toMatch(/optionsImages/);
  });

  it('accepts tricks with contentImages', () => {
    expect(validateData(data({ tricks: [{ ...trick(), contentImages: ['data:image/jpeg;base64,BBB'] }] }))).toBeNull();
  });

  it('rejects tricks whose contentImages is not a string array', () => {
    expect(validateData(data({ tricks: [{ ...trick(), contentImages: 42 }] }))).toMatch(/contentImages/);
  });
```

- [ ] **Step 4: 运行测试确认失败**

Run: `npm test`
Expected: FAIL —— 5 个新用例因 `validateData` 未校验 `optionsImages`/`contentImages` 而失败。

- [ ] **Step 5: 实现校验**

在 `src/store/DataStore.ts` 中，`stemImages` 校验块之后新增：

```ts
    if (rec.optionsImages !== undefined && (!Array.isArray(rec.optionsImages) || !rec.optionsImages.every((s) => typeof s === 'string'))) {
      return `第 ${n} 条错题的 optionsImages 必须是字符串数组`;
    }
```

在 Trick 校验块的 `pinned` 校验之后新增：

```ts
    if (rec.contentImages !== undefined && (!Array.isArray(rec.contentImages) || !rec.contentImages.every((s) => typeof s === 'string'))) {
      return `第 ${n} 条 Trick 的 contentImages 必须是字符串数组`;
    }
```

- [ ] **Step 6: 运行测试确认通过**

Run: `npm test`
Expected: PASS —— 全部用例通过（含原有 18 个 + 新增 5 个）。

- [ ] **Step 7: Commit**

```bash
git add src/store/types.ts src/store/DataStore.ts src/store/DataStore.test.ts
git commit -m "feat: optionsImages/contentImages data model + validation"
```

---

### Task 2: 共享图片工具 + 错题表单选项图片

**Files:**
- Create: `src/lib/image.ts`
- Modify: `src/components/WrongQuestionForm.tsx`

**Interfaces:**
- Consumes: Task 1 的 `optionsImages` 字段；现有表单状态。
- Produces: `compressImage(dataUrl: string, maxWidth?: number, quality?: number): Promise<string>`、`fileToDataUrl(file: File): Promise<string>`（Task 4 复用）。

- [ ] **Step 1: 创建共享图片工具**

创建 `src/lib/image.ts`，把 `WrongQuestionForm.tsx` 现有的 `compressImage` 和 `fileToDataUrl` 原样搬入并导出：

```ts
/** 粘贴图片：先读为 data URL，再降采样压缩为 JPEG（≤1600px），原始图更小则保留原样。 */
export function compressImage(dataUrl: string, maxWidth = 1600, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, maxWidth / img.width);
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(dataUrl); return; }
        ctx.fillStyle = '#fff'; // JPEG 无透明通道
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        const jpeg = canvas.toDataURL('image/jpeg', quality);
        resolve(jpeg.length < dataUrl.length ? jpeg : dataUrl);
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => reject(new Error('图片解析失败'));
    img.src = dataUrl;
  });
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('读取图片失败'));
    reader.readAsDataURL(file);
  });
}
```

- [ ] **Step 2: 表单接入共享工具并加字段/焦点状态**

`src/components/WrongQuestionForm.tsx`：

删除文件内 `compressImage` 与 `fileToDataUrl` 两个函数定义（已移入 `src/lib/image.ts`），改为：

```ts
import { compressImage, fileToDataUrl } from '../lib/image';
```

接口与初始状态增加 `optionsImages`：

```ts
export interface WrongQuestionInput {
  source?: string; stem: string; stemImages: string[]; options?: string; optionsImages: string[];
  myAnswer: string; correctAnswer: string;
  analysis?: string; knowledgePoint: WrongQuestion['knowledgePoint']; errorCause: WrongQuestion['errorCause']; tags: string[];
  trickIds: string[];
}
```

```ts
    options: initial?.options ?? '',
    optionsImages: initial?.optionsImages ?? [],
```

新增焦点目标状态（放在 `const [tagInput, setTagInput] = useState('');` 之后）：

```ts
  const [pasteTarget, setPasteTarget] = useState<'stem' | 'options'>('stem');
```

- [ ] **Step 3: onPaste 按焦点路由**

把现有 `onPaste` 中 `setF((prev) => ({ ...prev, stemImages: [...prev.stemImages, compressed] }))` 改为按 `pasteTarget` 路由：

```ts
        setF((prev) => pasteTarget === 'options'
          ? { ...prev, optionsImages: [...prev.optionsImages, compressed] }
          : { ...prev, stemImages: [...prev.stemImages, compressed] });
```

- [ ] **Step 4: 题干/选项文本框绑定焦点 + 选项图片缩略图**

题干 `<textarea>` 增加 `onFocus={() => setPasteTarget('stem')}`；底部提示改为：

```tsx
            <div className="paste-hint">光标停在题干/选项输入框时 ⌘V / Ctrl+V 粘贴图片（支持多张）</div>
```

选项行替换为：

```tsx
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
```

- [ ] **Step 5: 构建验证**

Run: `npm run build`
Expected: PASS —— tsc 无类型错误、vite 打包成功。

- [ ] **Step 6: Commit**

```bash
git add src/lib/image.ts src/components/WrongQuestionForm.tsx
git commit -m "feat: option images in wrong-question form with focus-routed paste"
```

---

### Task 3: 选项图片展示（列表页 + 复习页）

**Files:**
- Modify: `src/pages/WrongQuestionsPage.tsx`
- Modify: `src/pages/ReviewPage.tsx`

**Interfaces:**
- Consumes: Task 1 的 `optionsImages` 字段。

- [ ] **Step 1: 列表页渲染选项图片**

`src/pages/WrongQuestionsPage.tsx` 中 `{q.options && <div className="stem" style={{ marginTop: 8 }}>{q.options}</div>}` 之后插入：

```tsx
          {q.optionsImages && q.optionsImages.length > 0 && (
            <div className="stem-images">
              {q.optionsImages.map((src, i) => <img key={i} src={src} alt={`选项图片 ${i + 1}`} />)}
            </div>
          )}
```

- [ ] **Step 2: 复习页渲染选项图片**

`src/pages/ReviewPage.tsx` 中 `{q.options && <div className="stem" style={{ marginTop: 10 }}>{q.options}</div>}` 之后插入：

```tsx
          {q.optionsImages && q.optionsImages.length > 0 && (
            <div className="stem-images">
              {q.optionsImages.map((src, i) => <img key={i} src={src} alt={`选项图片 ${i + 1}`} />)}
            </div>
          )}
```

- [ ] **Step 3: 构建验证**

Run: `npm run build`
Expected: PASS。

- [ ] **Step 4: Commit**

```bash
git add src/pages/WrongQuestionsPage.tsx src/pages/ReviewPage.tsx
git commit -m "feat: render option images on list and review pages"
```

---

### Task 4: Trick 表单改纯文本 + 图片

**Files:**
- Modify: `src/components/TrickForm.tsx`

**Interfaces:**
- Consumes: Task 2 的 `compressImage` / `fileToDataUrl`；Task 1 的 `contentImages` 字段。
- Produces: `TrickInput` 增加 `contentImages: string[]`（Task 5 展示消费）。

- [ ] **Step 1: 接口与状态**

`src/components/TrickForm.tsx`：

```ts
import { useState, type ClipboardEvent, type FormEvent } from 'react';
import { KNOWLEDGE_POINTS, type Trick } from '../store/types';
import { compressImage, fileToDataUrl } from '../lib/image';

export interface TrickInput {
  title: string; content: string; contentImages: string[];
  knowledgePoint?: Trick['knowledgePoint']; tags: string[]; pinned: boolean;
}
```

初始状态加 `contentImages: initial?.contentImages ?? []`。

- [ ] **Step 2: 加 onPaste 与缩略图**

`<form onSubmit={submit}>` 改为 `<form onSubmit={submit} onPaste={onPaste}>`；在 `submit` 定义后新增：

```ts
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
```

- [ ] **Step 3: 标签、placeholder、缩略图 UI**

内容行替换为：

```tsx
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
```

- [ ] **Step 4: 构建验证**

Run: `npm run build`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/components/TrickForm.tsx
git commit -m "feat: plain-text trick form with pasted images"
```

---

### Task 5: Trick 纯文本展示 + 移除 markdown 渲染链

**Files:**
- Modify: `src/pages/TricksPage.tsx`
- Modify: `src/components/LinkedTricks.tsx`
- Delete: `src/components/RichText.tsx`
- Modify: `src/styles.css`
- Modify: `package.json`（经 `npm uninstall`）

**Interfaces:**
- Consumes: Task 1 的 `contentImages`、Task 4 的 `TrickInput.contentImages`。

- [ ] **Step 1: TricksPage 纯文本 + 图片**

`src/pages/TricksPage.tsx`：删除 `import RichText from '../components/RichText';`，把 `<RichText content={t.content} />` 替换为：

```tsx
          <div className="stem">{t.content}</div>
          {t.contentImages && t.contentImages.length > 0 && (
            <div className="stem-images">
              {t.contentImages.map((src, i) => <img key={i} src={src} alt={`内容图片 ${i + 1}`} />)}
            </div>
          )}
```

- [ ] **Step 2: LinkedTricks 纯文本 + 图片**

`src/components/LinkedTricks.tsx`：删除 `import RichText from './RichText';`；把注释里"（Markdown + 公式）"改为"（纯文本 + 图片）"；把

```tsx
            <div className="trick-chip-body"><RichText content={t.content} /></div>
```

替换为：

```tsx
            <div className="trick-chip-body">
              <div className="stem">{t.content}</div>
              {t.contentImages && t.contentImages.length > 0 && (
                <div className="stem-images">
                  {t.contentImages.map((src, i) => <img key={i} src={src} alt={`内容图片 ${i + 1}`} />)}
                </div>
              )}
            </div>
```

- [ ] **Step 3: 删除 RichText.tsx**

```bash
git rm src/components/RichText.tsx
```

- [ ] **Step 4: 清理 CSS**

`src/styles.css` 中删除两行：

```css
.trick-chip-body .rich p { margin: 4px 0; }
.trick-chip-body .katex-display { margin: 6px 0; overflow-x: auto; }
```

（`.trick-chip-body` 本体样式保留；`.card .stem` 的 `pre-wrap` 已覆盖换行显示。）

- [ ] **Step 5: 卸载依赖**

```bash
npm uninstall marked katex dompurify
npm uninstall -D @types/katex
```

Expected: `package.json` 与 `package-lock.json` 均移除上述包。

- [ ] **Step 6: 验证无残留引用**

Run: `npm run build && npm test`
Expected: 两者均 PASS（若 `grep -r "RichText\|marked\|katex\|dompurify" src` 有残留，先清理再重跑）。

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: plain-text trick rendering, drop markdown/katex stack"
```

---

### Task 6: 迁移现有 Trick 数据

**Files:**
- Modify: `data/data.json`（仅 3 条 Trick 中的 1 条 `content` 含 markdown；其余 2 条无标记，不动）

**Interfaces:**
- Consumes: 无需前置任务。

- [ ] **Step 1: 改写含 markdown 的 Trick content**

`data/data.json` 中 id 为 `44e756f6-4354-4a89-8ccb-8448357de2a3`（标题"混合平均数"）的 `content`，从：

```text
### 混合平均数： 
满足：（1）$$C = A/B$$，如：人均收入 = 总收入/人数；
（2）有一个总体和若干部分，如：全国=农村+城镇
距离是人均收入，量是人数
---
### 混合增长率： $$C = A + B$$  已知A和B的值和增值率，求混合后整体C的增值率
距离是r，量是基期
$$r = 增长量/基期$$
```

改为：

```text
混合平均数： 
满足：（1）C = A/B，如：人均收入 = 总收入/人数；
（2）有一个总体和若干部分，如：全国=农村+城镇
距离是人均收入，量是人数
---
混合增长率： C = A + B  已知A和B的值和增值率，求混合后整体C的增值率
距离是r，量是基期
r = 增长量/基期
```

规则：去掉 `### `、`$$` 包裹，公式保留为普通文字。其余字段与其余 Trick 一律不动。

- [ ] **Step 2: 校验 JSON 与 schema**

Run:

```bash
jq -e '.tricks | length == 3' data/data.json
```

Expected: 输出 `true`，JSON 合法且仍为 3 条 Trick。

- [ ] **Step 3: 用现有测试兜底校验**

Run: `npm test`
Expected: PASS —— `loadData`/`validateData` 对迁移后的数据文件语义不变（单测用工厂数据，此处为回归确认构建链无碍）。

- [ ] **Step 4: Commit**

```bash
git add data/data.json
git commit -m "chore: migrate trick content from markdown to plain text"
```

---

### Task 7: 端到端验证

**Files:** 无（纯验证）。

- [ ] **Step 1: 全量构建 + 测试**

Run: `npm run build && npm test`
Expected: 两者 PASS。

- [ ] **Step 2: 浏览器冒烟（新增错题 + 选项图片）**

Run: `npm run dev`，打开 `http://localhost:5173`：

1. 错题页 → "+ 新增错题"；
2. 光标点进"选项"文本框 → 系统截图后 ⌘V 粘贴 → 选项下方出现缩略图；
3. 保存 → 列表卡片中选项下方出现图片；
4. 复习页进入该题 → 选项图片正常显示；
5. 题干框聚焦再粘贴一张 → 图片进题干（验证焦点路由）。

- [ ] **Step 3: 浏览器冒烟（Trick 纯文本 + 图片）**

1. Trick 页 → "+ 新增 Trick"；
2. 内容框粘贴图片 → 缩略图出现，保存后卡片显示纯文本 + 图片；
3. 编辑已有"混合平均数"Trick → 内容显示为纯文本，无 `###`/`$$` 残留；
4. 错题页展开关联 Trick → 纯文本 + 图片正常。

- [ ] **Step 4: 收尾提交**

```bash
git add -A && git commit -m "chore: final verification" --allow-empty
```
（如无未提交改动，跳过此步。）
