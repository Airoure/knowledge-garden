# 数感道场 · 项目交接文档

> **版本** v1.0.0 ｜ **日期** 2026-08-05 ｜ **技术栈** React 18 + TypeScript + Vite

---

## 目录

1. [项目概览](#1-项目概览)
2. [技术栈](#2-技术栈)
3. [项目结构](#3-项目结构)
4. [核心架构](#4-核心架构)
5. [功能清单](#5-功能清单)
6. [关键实现细节](#6-关键实现细节)
7. [已修复问题](#7-已修复问题)
8. [构建与运行](#8-构建与运行)
9. [后续开发建议](#9-后续开发建议)

---

## 1. 项目概览

**数感道场**（Number Sense Dojo）是一个面向考公人群的速算练习 Web 应用。用户可以选择加减乘除四种运算、一位数或两位数难度，通过限时答题训练计算速度与准确率。视觉风格采用中式水墨宣纸美学，以墨色、朱砂、金、翠玉为主色调。

项目从最初的单 HTML 文件逐步演进为 Vite + React 18 + TypeScript + CSS Modules 的模块化架构。当前已实现两种游戏模式：**固定题数模式**（预设题量，正计时）和**无尽模式**（倒计时驱动，答对加时 / 答错扣时，参数可自定义）。

> **当前状态**：所有功能已开发完成，TypeScript 类型检查零错误，Vite 生产构建通过。开发服务器运行在 `localhost:5173`。

---

## 2. 技术栈

| 类别 | 技术 | 版本 | 用途 |
|------|------|------|------|
| 构建工具 | Vite | ^5.4.0 | 开发服务器 + 生产构建 |
| 前端框架 | React | ^18.3.1 | UI 渲染与状态管理 |
| 类型系统 | TypeScript | ^5.5.3 | 类型安全 |
| 样式方案 | CSS Modules | — | 组件级样式隔离 |
| 字体 | Google Fonts | — | Noto Serif SC / Noto Sans SC / DM Serif Display / Cormorant Garamond |

项目**无额外运行时依赖**，仅依赖 React 和 React-DOM。所有状态管理通过自定义 Hooks 实现，未引入 Redux、Zustand 等外部状态库。路径别名 `@/` 映射到 `src/` 目录。

---

## 3. 项目结构

```
sushu-daochang/
├── src/
│   ├── main.tsx                    # 应用入口，挂载到 #root
│   ├── App.tsx                     # 根组件，管理阶段流转 + 默认配置
│   ├── App.module.css              # 根布局样式
│   ├── types/
│   │   └── index.ts                # 所有 TypeScript 类型定义
│   ├── hooks/
│   │   ├── usePractice.ts          # 核心 Hook：练习流程控制（双模式）
│   │   ├── useTimer.ts             # 正计时 Hook（固定模式）
│   │   └── useCountdown.ts         # 倒计时 Hook（无尽模式，支持 adjust）
│   ├── utils/
│   │   ├── questionGenerator.ts    # 题目生成 + 评级计算 + 配置常量
│   │   └── format.ts               # 时间格式化 + 中文题号
│   ├── components/
│   │   ├── Header/                 # 顶部标题区（品牌名 + 副标题）
│   │   ├── SetupPanel/             # 设置面板（模式/运算/难度/数量或时间）
│   │   ├── PracticePanel/          # 练习面板（题目展示 + 答题输入 + 反馈）
│   │   ├── ResultPanel/            # 结果面板（印章评级 + 统计数据）
│   │   └── shared/
│   │       ├── Card.tsx            # 通用卡片容器
│   │       └── CornerOrnaments.tsx # 固定定位装饰角花
│   └── styles/
│       ├── variables.css           # CSS 变量（色板 + 字体族）
│       └── globals.css             # 全局样式 + 动画关键帧 + 宣纸纹理
├── index.html                      # HTML 模板（Google Fonts 引入）
├── package.json                    # 依赖与脚本
├── tsconfig.json                   # TS 配置（含 @/ 路径别名）
├── tsconfig.node.json              # Vite 配置文件的 TS 配置
└── vite.config.ts                  # Vite 构建配置
```

每个组件目录下包含 `.tsx` 组件文件和对应的 `.module.css` 样式文件，保持就近原则。

---

## 4. 核心架构

### 组件层级

```
App（根组件）
├── CornerOrnaments          // 固定装饰角花
├── Header                   // 品牌标题区
│
├── SetupPanel               // phase = 'setup'
│   └── Card
│       ├── 模式切换（固定题数 / 无尽模式）
│       ├── 运算类型多选（+ − × ÷）
│       ├── 难度等级单选（一位数 / 两位数）
│       └── 题量选择 OR 无尽设置（初始时间/加时/扣时）
│
├── PracticePanel            // phase = 'practice'
│   └── Card
│       ├── 进度条（题目进度 OR 时间占比）
│       ├── 状态栏（进度/正确/用时 OR 剩余/已答/正确）
│       ├── 题目展示区
│       ├── 答案输入 + 提交按钮
│       ├── 反馈区（正确/错误 + 加时扣时提示）
│       └── 退出按钮
│
└── ResultPanel              // phase = 'result'
    └── Card
        ├── 朱砂印章评级
        ├── 统计数据（正确率 / 答对数 / 用时）
        └── 操作按钮（再来一组/一局 + 返回设置）
```

### 状态管理：usePractice Hook

整个练习流程由 `usePractice` Hook 统一管理，App 组件通过推断 `result` 和 `isActive` 状态决定当前阶段，无需额外的 phase state。

```typescript
// App.tsx 中的阶段推断逻辑
let phase: Phase
if (practice.result) {
  phase = 'result'      // 有结果 → 显示结果面板
} else if (practice.isActive) {
  phase = 'practice'    // 练习中 → 显示练习面板
} else {
  phase = 'setup'       // 默认 → 显示设置面板
}
```

### 双模式数据流

**固定模式（fixed）**

```
start(config) → generateQuestions() 批量生成 → countUpTimer.start()
  ↓
submitAnswer() → 判断正误 → setAnswerStatus()
  ↓
next() → currentIndex++ → 到末尾则 stop + buildPracticeResult()
```

**无尽模式（endless）**

```
start(config) → generateSingleQuestion() → countdown.start(initialTime)
  ↓
submitAnswer() → 判断正误
  ├─ 正确 → countdown.adjust(+bonus)
  └─ 错误 → countdown.adjust(-penalty)
  ↓
next() → totalAnswered++ → generateSingleQuestion() 生成新题
  ↓
countdown.remaining === 0 → useEffect 监听 → buildPracticeResult()
```

> **闭包陷阱处理**：`usePractice` 内部使用了多个 `useRef`（`configRef`、`correctCountRef`、`totalAnsweredRef`、`answerStatusRef`、`isFinishedRef`、`lastQuestionRef`）来解决 `setTimeout` 和 `useEffect` 中的闭包陈旧值问题。修改状态时同步更新对应的 ref，确保回调函数能读到最新值。

### 类型系统

```typescript
// types/index.ts 核心类型
type GameMode = 'fixed' | 'endless'

interface PracticeConfig {
  mode: GameMode
  operations: Operation[]
  difficulty: Difficulty
  totalCount: number          // 固定模式
  endless: EndlessSettings    // 无尽模式
}

interface EndlessSettings {
  initialTime: number    // 初始总时间（秒）
  correctBonus: number   // 答对加时（秒）
  wrongPenalty: number   // 答错扣时（秒）
}

interface PracticeResult {
  mode: GameMode
  correctCount: number
  totalCount: number      // 固定=总题数，无尽=总答题数
  accuracy: number
  timeElapsed: number     // 固定=总用时，无尽=游戏时长
  grade: GradeInfo
}
```

---

## 5. 功能清单

| 功能 | 模式 | 状态 | 说明 |
|------|------|------|------|
| 运算类型多选 | 通用 | ✅ 已完成 | 加减乘除可自由组合，至少保留一种 |
| 难度选择 | 通用 | ✅ 已完成 | 一位数运算 / 两位数运算 |
| 固定题数模式 | fixed | ✅ 已完成 | 10/20/30/50 题可选，正计时，答完汇总 |
| 无尽模式 | endless | ✅ 已完成 | 倒计时驱动，时间归零结束 |
| 初始时间设置 | endless | ✅ 已完成 | 60/120/180/300 秒可选 |
| 答对加时 | endless | ✅ 已完成 | 0/3/5/10 秒可选，0 表示不加时 |
| 答错扣时 | endless | ✅ 已完成 | 0/3/5/10 秒可选，0 表示不扣时 |
| 紧急状态提示 | endless | ✅ 已完成 | 剩余 ≤10s 时倒计时与进度条脉冲变红 |
| 即时反馈 | 通用 | ✅ 已完成 | 答对绿色 / 答错红色 + 正确答案，延迟 700ms 自动下一题 |
| 朱砂印章评级 | 通用 | ✅ 已完成 | 优(≥90%) / 良(≥75%) / 中(≥60%) / 勉(<60%) |
| 题目去重 | 通用 | ✅ 已完成 | 避免连续出现相同题目 |
| 响应式布局 | 通用 | ✅ 已完成 | 移动端适配（≤640px 断点） |

---

## 6. 关键实现细节

### useCountdown Hook

无尽模式的倒计时通过追踪 `endTimeRef` 时间戳实现，而非简单的秒数递减。这样 `adjust(delta)` 可以直接修改结束时间戳，避免因 setInterval 延迟导致的累计误差。每 200ms tick 一次保证 adjust 后及时更新显示。

```typescript
const adjust = useCallback((deltaSeconds: number) => {
  endTimeRef.current += deltaSeconds * 1000
  const left = Math.max(0, Math.round((endTimeRef.current - Date.now()) / 1000))
  setRemaining(left)
  if (left <= 0) {
    clear()
    setIsRunning(false)
  }
}, [clear])
```

### 无尽模式结束判定

通过 `useEffect` 监听 `countdown.remaining` 和 `countdown.isRunning`。当倒计时归零时，需要特殊处理一个边界情况：如果当前题已作答但还在反馈延迟期间（700ms）时间归零，该题应计入 `totalAnswered`。

```typescript
// usePractice.ts 中的结束监听
useEffect(() => {
  if (mode === 'endless' && isActive && !countdown.isRunning && countdown.remaining === 0) {
    const timePlayed = Math.floor((Date.now() - startTimeRef.current) / 1000)
    // 当前题若已作答但尚未计入 totalAnswered
    const currentAnswered = totalAnsweredRef.current + (answerStatusRef.current !== 'idle' ? 1 : 0)
    const practiceResult = buildPracticeResult('endless', correctCountRef.current, currentAnswered, timePlayed)
    setResult(practiceResult)
    isFinishedRef.current = true
    setIsActive(false)
  }
}, [mode, isActive, countdown.isRunning, countdown.remaining])
```

### 题目生成逻辑

除法题目的生成方式特殊：先生成除数 `b` 和商 `answer`，再计算被除数 `a = b * answer`，确保结果为整数。两位数除法的除数范围为 2-12，商为 2-15，被除数可能超过两位数。

### 配置常量集中管理

所有可选项常量定义在 `questionGenerator.ts` 中，UI 组件直接引用，确保数据单一来源：

```typescript
export const COUNT_OPTIONS = [10, 20, 30, 50] as const
export const TIME_OPTIONS = [60, 120, 180, 300] as const
export const BONUS_OPTIONS = [0, 3, 5, 10] as const
export const PENALTY_OPTIONS = [0, 3, 5, 10] as const
```

### CSS 变量主题系统

所有颜色通过 `variables.css` 中的 CSS 变量统一管理，包括墨色系、宣纸系、朱砂系、金色系、翠玉系、雾色系六个色系，以及四组字体族定义。组件样式文件中不出现硬编码色值。

### 宣纸纹理实现

全局背景通过两层伪元素实现宣纸质感：`body::before` 是三组径向渐变光晕（金、朱砂、翠玉），`body::after` 是 SVG turbulence 噪点纹理。

---

## 7. 已修复问题

**提交按钮宽度变化导致输入框位移**

点击"提交"后按钮文字变为"下一题"，按钮宽度变化挤压左侧输入框。修复方式：给 `.submitBtn` 设置固定宽度 `width: 7.5em` 和 `flex-shrink: 0`。

**倒计时数字宽度变化导致位置跳动**

计时器数字变化时（如 1:09 → 1:08），因字体宽度不同导致位置偏移。修复方式：给 `.statusValue` 添加 `font-variant-numeric: tabular-nums`、`min-width: 3.5em` 和 `text-align: center`。

**TypeScript 构建报错 "Referenced project may not disable emit"**

`tsconfig.node.json` 中设置了 `"noEmit": true` 与 `"composite": true` 冲突。修复方式：移除 `tsconfig.node.json` 中的 `"noEmit": true`。

---

## 8. 构建与运行

### 开发环境

```bash
# 安装依赖
npm install

# 启动开发服务器（默认端口 5173）
npm run dev

# 类型检查（不输出文件）
npm run typecheck
```

### 生产构建

```bash
# 完整构建（tsc -b 类型检查 + vite build 打包）
npm run build

# 预览生产构建
npm run preview
```

构建产物输出到 `dist/` 目录。当前构建体积：JS 约 161KB（gzip 52KB），CSS 约 15KB（gzip 3.7KB）。

---

## 9. 后续开发建议

### 短期优化

**答题历史记录** — 当前每次练习结果不会持久化。可引入 `localStorage` 存储历史成绩，在结果面板展示趋势变化（如正确率提升曲线、平均用时变化）。

**键盘快捷键增强** — 当前仅支持 Enter 提交 / 下一题。可增加空格键跳过、数字键直接输入等快捷操作，提升答题流畅度。

### 中期功能

**更多难度等级** — 当前仅有一位数和两位数两个等级。可扩展三位数运算、混合位数（如两位数除以一位数）、小数运算等。

**错题本** — 记录答错的题目，支持针对性复习模式——只练错题，直到全部答对。

**统计仪表盘** — 按运算类型、难度维度统计正确率和平均用时，帮助用户发现薄弱环节。

### 长期方向

**自适应难度** — 根据用户答题表现动态调整题目难度，答对率高时自动提升难度，答错率高时降低难度，保持心流体验。

**多人对战 / 排行榜** — 引入后端服务，支持实时对战或异步排行榜，增加社交竞争元素。

> **架构扩展提示**：当前 `usePractice` Hook 已经为双模式设计打好了基础。新增模式时，只需在 `GameMode` 类型中添加新值，在 `usePractice` 中处理对应逻辑分支，并在 `SetupPanel` 和 `PracticePanel` 中适配 UI 即可。类型系统和配置结构已预留了扩展空间。
