# 开发工作流

本仓库是**知识花园**（静态站点集合），宿主机 nginx 部署在 `/var/www/html`，公网地址 http://124.221.183.60/

## ⚠️ 修改后必做三件事

```bash
git add -A
git commit -m "feat(站点名): 改了什么"   # 提交信息用中文，说清改动
git push origin master
```

**推送后不需要做别的** —— 宿主机每 5 分钟自动拉取并部署上线，并验证各站点是否正常。
（如果希望立即上线，可以让宿主机侧手动执行一次同步）

## 仓库结构

```
index.html          ← 导航页（sites 数组登记所有站点，按 group 分组：gongkao / more）
susuan/ num/ pd/ yuyin/ zzll/    ← 考公备考专区（方法课站点）
vacuum-diode/ hmac-notes/ fourier/ nodejs-roadmap/ openai-cookbook-roadmap/
projects/           ← 独立应用源码快照（数感道场、公考笔记本）
```

每个站点是**独立目录**，通常包含 `index.html` + `js/` + `css/`，纯静态、无需构建。

## 新增站点时

1. 创建子目录并放入 `index.html`
2. 在根 `index.html` 的 `sites` 数组中添加条目：
   ```js
   { group: 'gongkao', icon: '🎯', title: '站点名', desc: '一句话说明', path: "/路径", tag: '已上线', tagClass: 'live' }
   ```
3. commit + push

## 禁止提交

- `node_modules/`、`dist/`（构建产物）
- 用户数据（如公考笔记本的 `data/data.json`）
- 任何密钥、token、密码

## 已有技术约定

- 言语理解方法营（`yuyin/`）的复习模块使用 SM-2 间隔重复算法，测试在 `yuyin/tests/`（零依赖，`node --test` 可跑）
