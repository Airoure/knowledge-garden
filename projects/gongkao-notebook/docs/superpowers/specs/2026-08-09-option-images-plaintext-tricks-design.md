# 设计：错题选项图片输入 + Trick 纯文本化

日期：2026-08-09

## 背景

现有 `WrongQuestionForm` 中题干（stem）已支持粘贴图片（`stemImages`，base64 data URL，≤1600px JPEG 压缩），选项（options）只是普通多行文本框。Trick 内容走 markdown + KaTeX 渲染（`RichText`），用户反馈 markdown 语法难用。

目标：

1. 错题表单的选项也支持图片输入。
2. Trick 内容编辑改为纯文本 + 图片，彻底告别 markdown。

## 变更一：错题选项支持图片

### 数据模型

`WrongQuestion` 增加可选字段 `optionsImages?: string[]`（与 `stemImages` 同构，base64 data URL）。

- `dataVersion` 保持 1：纯增量可选字段，旧数据文件不受影响，向后兼容。

### 表单（WrongQuestionForm）

- 提取 `compressImage` / `fileToDataUrl` 到共享模块 `src/lib/image.ts`（TrickForm 也要用，避免复制两份）。
- 粘贴路由改为**焦点导向**：
  - 光标停在"选项"文本框时 ⌘V / Ctrl+V → 图片追加到 `optionsImages`；
  - 否则追加到 `stemImages`（保持现状默认行为）。
  - 实现：`useState<'stem' | 'options'>` 记录当前聚焦目标，文本框 `onFocus` 切换；表单级 `onPaste` 读取该状态决定追加到哪个数组。
- 选项框下方渲染 `optionsImages` 缩略图 + 移除按钮（复用现有 `.thumb` 样式）。
- 提示文案更新为"光标停在哪个输入框，图片就粘贴到哪"。

### 展示

- 错题列表页（WrongQuestionsPage）与复习页（ReviewPage）：`options` 文本下方渲染 `optionsImages`，复用 `.stem-images` 样式。

### 校验

`DataStore.validateData` 新增 `optionsImages` 字符串数组校验，与 `stemImages` 同款：

```
第 N 条错题的 optionsImages 必须是字符串数组
```

## 变更二：Trick 内容纯文本 + 图片

### 数据模型

`Trick` 增加可选字段 `contentImages?: string[]`（base64 data URL）。

### 表单（TrickForm）

- 标签改为"内容 *（纯文本，公式可粘贴图片）"；placeholder 示例去掉 `$$...$$` markdown 语法，改为纯文本示例。
- 表单级 `onPaste` 支持粘贴图片 → 追加到 `contentImages`；下方渲染缩略图 + 移除按钮。

### 展示

- TricksPage 与 LinkedTricks：`<RichText>` 替换为纯文本渲染（`.card .stem` 已带 `white-space: pre-wrap` 保留换行）+ `contentImages` 图片。
- 纯文本渲染无需 markdown/KaTeX/DOMPurify。

### 清理

- 删除 `RichText.tsx`（唯一使用者是 TricksPage 和 LinkedTricks，二者均已改为纯文本渲染）。
- 移除 `package.json` 依赖：`marked`、`katex`、`dompurify`、`@types/katex`。
- 移除 `styles.css` 中 `.trick-chip-body .rich p`、`.trick-chip-body .katex-display` 规则。

### 数据迁移

现有 3 条 Trick 的 `content` 含 markdown 标记（`###` 标题、`$$...$$` 公式）。直接改写 `data/data.json` 中这 3 条的 `content`：

- 去掉 `###`、`$$`、`**` 等标记；
- 公式保留为普通文字（如 `$$C = A/B$$` → `C = A/B`）。

仅改 `content` 字段，不动其他字段（保留用户最近未提交的数据改动）。

## 验证

- `npm run build`（tsc + vite）通过。
- `npm test`（vitest）通过。
- 浏览器冒烟：新增错题时在选项框聚焦粘贴图片 → 缩略图出现、保存后列表/复习页显示；Trick 表单粘贴图片 → 显示；已有 Trick 显示为纯文本无 `###`/`$$` 残留。
