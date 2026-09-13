# 📦 项目源码备份

本目录存放独立应用的**源码快照**，用于版本管理与异地备份。
（已通过 nginx 禁止 Web 访问：`location ^~ /projects/ { return 404; }`）

---

## count-game · 数感道场

| 项目 | 值 |
|---|---|
| 在线地址 | http://124.221.183.60/count-game/ |
| 独立源码仓库 | https://github.com/Airoure/count-game |
| 部署位置 | `/var/www/count-game/`（构建产物，不纳入本仓库） |
| 技术栈 | React + Vite + Socket.io（前端） / Express + TypeScript（后端） |
| 功能 | 考公速算训练游戏、实时对战、高照数算模块、登录与做题记录 |

> ⚠️ 本目录是**快照**。日常开发请以独立仓库 `Airoure/count-game` 为准，避免两处代码分叉。

## gongkao-notebook · 公考笔记本

| 项目 | 值 |
|---|---|
| 在线地址 | http://124.221.183.60/gongkao/ |
| 部署位置 | `/var/www/gongkao-notebook/` |
| 技术栈 | React 19 + Vite（前端） / Express（后端，`server.mjs`） |
| 功能 | 错题本、速算技巧笔记、图片留存 |

> 📌 用户数据保存在 `/var/www/gongkao-notebook/data/data.json`（含图片 base64，约 2-3 MB），
> 因每次使用都会变动，未纳入 git 跟踪，需单独备份。

---

## 目录约定

- 排除项：`node_modules/`、`dist/`、`.git/`、`logs/`、用户数据
- 各子项目自带 `.gitignore`，规则在本仓库中同样生效
- 新增项目时：复制源码（排除上述内容）到本目录，并在此文档补充条目
