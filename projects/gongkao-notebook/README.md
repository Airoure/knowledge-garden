# 行测资料分析错题本

本地运行的错题 + 计算 trick 记录应用（Vite + React + Express）。

## 使用

```bash
npm install
npm run dev        # 开发：前端 5173，API 3001（vite 代理）
npm test           # 纯函数单测
npm run build && npm start   # 生产：构建后由 server 托管，访问 http://localhost:3001
```

数据保存在 `data/data.json`（git 管理，天然备份）。

## 页面

- 错题：录入/编辑/删除，按知识点、错因、状态、关键词、**记录日期范围**筛选；题干支持文字 + 剪贴板图片粘贴（表单内 ⌘V / Ctrl+V，自动压缩为 JPEG 存入数据）；可关联 Trick（卡片与复习时点开查看）；导出 PDF 只含当前筛选结果，页头带日期范围
- 复习：按筛选出一组错题自测，做对状态前移，做错回退未掌握
- Trick：Markdown + KaTeX 公式，置顶优先，可搜索
- 统计：知识点/错因/状态分布、近 8 周趋势、薄弱知识点 Top 3
