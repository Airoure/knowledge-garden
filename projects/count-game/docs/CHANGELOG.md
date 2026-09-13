# 更新日志

## 2026-08-19 23:00

### [FEAT] 去掉提交按钮，输入正确答案自动跳转

| 字段 | 内容 |
|---|---|
| **问题/需求** | 用户反馈做题时需要手动点提交按钮才能跳转下一题，交互不够流畅 |
| **根因/方案** | 在输入框 onChange 中实时检测输入值，匹配正确答案时自动触发提交和延迟跳转；同时补全三个面板的 isComposing 检查 |
| **改动范围** | `src/components/PracticePanel/PracticePanel.tsx`、`src/components/BattlePracticePanel/BattlePracticePanel.tsx`、`src/components/GaozhaoPanel/GaozhaoPanel.tsx` |
| **影响面** | 练习模式（固定/无尽）、对战模式、高照数算三个做题面板的答案提交交互 |
| **状态** | ✅ 已完成 |
