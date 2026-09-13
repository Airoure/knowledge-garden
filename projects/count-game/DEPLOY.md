# 数感道场 · 部署文档

> **版本** v1.0.0 ｜ **更新** 2026-08-05

---

## 目录

1. [部署架构](#1-部署架构)
2. [服务器要求](#2-服务器要求)
3. [一键部署（推荐）](#3-一键部署推荐)
4. [手动部署](#4-手动部署)
5. [防火墙配置](#5-防火墙配置)
6. [日常运维](#6-日常运维)
7. [更新部署](#7-更新部署)
8. [常见问题](#8-常见问题)

---

## 1. 部署架构

```
用户浏览器
    │
    ▼ :80
Nginx
    ├── /            → 前端静态文件 (dist/)
    ├── /socket.io/  → 反向代理 → Node.js 后端 (:3001)
    └── /health      → 反向代理 → Node.js 后端 (:3001)
                                    │
                                    ▼
                              PM2 守护进程
```

- **Nginx**（端口 80）：托管前端静态文件 + 反向代理后端 WebSocket
- **Node.js 后端**（端口 3001）：Socket.io 对战服务器，由 PM2 守护
- 用户只需访问 `http://服务器IP`，无需关心端口

---

## 2. 服务器要求

| 项目 | 最低要求 | 推荐 |
|------|----------|------|
| 系统 | Ubuntu 20.04+ / CentOS 8+ | Ubuntu 22.04 |
| CPU | 1 核 | 2 核 |
| 内存 | 512MB | 1GB+ |
| 磁盘 | 1GB | 5GB+ |
| Node.js | 18+ | 20 LTS |
| 网络 | 开放 80 端口 | 80 + 443 |

---

## 3. 一键部署（推荐）

项目根目录下的 `deploy/deploy.sh` 脚本会自动完成全部步骤。

### 步骤

```bash
# 1. 克隆项目
git clone https://github.com/你的用户名/sushu-daochang.git
cd sushu-daochang

# 2. 赋予执行权限
chmod +x deploy/deploy.sh

# 3. 执行部署
sudo bash deploy/deploy.sh
```

脚本会自动完成：
- 检查/安装 Node.js 18、PM2、Nginx
- 构建前端（`npm run build`）
- 构建后端（`cd server && npm run build`）
- 用 PM2 启动后端服务
- 配置 Nginx 反向代理
- 输出访问地址

部署完成后访问 `http://你的服务器IP` 即可使用。

---

## 4. 手动部署

如果想了解每一步细节，或脚本执行失败需要排查，按以下步骤操作。

### 4.1 安装环境

```bash
# Ubuntu
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs nginx
sudo npm install -g pm2

# CentOS
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs nginx
sudo npm install -g pm2
```

验证安装：

```bash
node -v    # v18.x.x 或更高
nginx -v   # nginx version: ...
pm2 -v     # 5.x.x 或更高
```

### 4.2 克隆并构建

```bash
cd /var/www
git clone https://github.com/你的用户名/sushu-daochang.git
cd sushu-daochang

# 构建前端
npm install
npm run build          # 产物在 dist/

# 构建后端
cd server
npm install
npm run build          # 产物在 server/dist/
cd ..
```

### 4.3 启动后端

```bash
# 创建日志目录
mkdir -p logs

# 用 PM2 启动
pm2 start deploy/ecosystem.config.cjs

# 保存进程列表（开机自启）
pm2 save
pm2 startup            # 按提示执行返回的命令

# 验证
pm2 list
# 应显示 sushu-daochang-server 状态为 online
```

### 4.4 配置 Nginx

```bash
# 复制配置文件
sudo cp deploy/nginx.conf /etc/nginx/sites-available/sushu-daochang
# CentOS 无 sites-available 目录，改用 conf.d:
# sudo cp deploy/nginx.conf /etc/nginx/conf.d/sushu-daochang.conf

# 创建软链接（Ubuntu）
sudo ln -sf /etc/nginx/sites-available/sushu-daochang /etc/nginx/sites-enabled/
# 移除默认站点避免冲突
sudo rm -f /etc/nginx/sites-enabled/default

# 测试配置
sudo nginx -t

# 重载
sudo systemctl reload nginx
```

### 4.5 验证

```bash
# 健康检查
curl http://localhost/health
# 应返回 {"status":"ok","service":"sushu-daochang-server"}

# 浏览器访问
# http://你的服务器IP
```

---

## 5. 防火墙配置

确保 80 端口对外开放：

```bash
# Ubuntu (ufw)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw reload

# CentOS (firewalld)
sudo firewall-cmd --permanent --add-port=80/tcp
sudo firewall-cmd --permanent --add-port=443/tcp
sudo firewall-cmd --reload
```

> **注意**：3001 端口**不需要**对外开放，Nginx 会通过内部反向代理访问。

### 云服务器安全组

如果使用阿里云/腾讯云等，还需在控制台的安全组规则中放行：

| 端口 | 协议 | 方向 | 说明 |
|------|------|------|------|
| 80 | TCP | 入方向 | HTTP 访问 |
| 443 | TCP | 入方向 | HTTPS（后续可选） |

---

## 6. 日常运维

### PM2 命令

```bash
pm2 list                          # 查看进程状态
pm2 logs sushu-daochang-server    # 查看实时日志
pm2 logs sushu-daochang-server --lines 100  # 查看最近100行
pm2 restart sushu-daochang-server # 重启后端
pm2 stop sushu-daochang-server    # 停止后端
pm2 monit                         # 监控面板（CPU/内存）
```

### Nginx 命令

```bash
sudo systemctl status nginx    # 查看状态
sudo systemctl restart nginx   # 重启
sudo systemctl reload nginx    # 重载配置（不中断服务）
sudo nginx -t                  # 测试配置语法
```

### 日志位置

| 日志 | 路径 | 说明 |
|------|------|------|
| 后端输出日志 | `logs/output.log` | PM2 管理的 stdout |
| 后端错误日志 | `logs/error.log` | PM2 管理的 stderr |
| Nginx 访问日志 | `/var/log/nginx/access.log` | HTTP 请求记录 |
| Nginx 错误日志 | `/var/log/nginx/error.log` | Nginx 错误记录 |

---

## 7. 更新部署

代码更新后，在服务器上执行：

```bash
cd /var/www/sushu-daochang

# 拉取最新代码
git pull origin main

# 重新构建前端
npm install
npm run build

# 重新构建后端
cd server && npm install && npm run build && cd ..

# 重启后端服务
pm2 restart sushu-daochang-server

# Nginx 不需要重启（静态文件直接读取 dist/）
```

---

## 8. 常见问题

### Q: WebSocket 连接失败，对战功能不可用

检查 Nginx 的 `/socket.io/` 反向代理配置是否包含 WebSocket 升级头：

```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

执行 `sudo nginx -t` 验证配置语法，`sudo systemctl reload nginx` 重载。

### Q: 访问页面白屏

```bash
# 检查前端是否构建成功
ls -la dist/
# 应包含 index.html 和 assets/ 目录

# 检查 Nginx root 路径是否正确
grep root /etc/nginx/sites-available/sushu-daochang
# 应指向项目的 dist/ 目录的绝对路径
```

### Q: 后端服务无法启动

```bash
# 查看错误日志
pm2 logs sushu-daochang-server --err --lines 30

# 常见原因：
# 1. server/dist/ 不存在 → cd server && npm run build
# 2. 端口 3001 被占用 → lsof -i:3001，kill 占用进程
# 3. Node.js 版本过低 → node -v，需要 18+
```

### Q: 健康检查返回 502 Bad Gateway

后端服务未运行或已崩溃：

```bash
pm2 list                          # 检查进程状态
pm2 restart sushu-daochang-server # 重启服务
curl http://localhost:3001/health # 直接测试后端
```

### Q: 如何配置 HTTPS

如果后续购买了域名并需要 HTTPS：

```bash
# 安装 certbot
sudo apt install -y certbot python3-certbot-nginx

# 自动配置 SSL（会自动修改 Nginx 配置）
sudo certbot --nginx -d 你的域名

# 自动续期已内置，测试续期：
sudo certbot renew --dry-run
```

### Q: 内存不足导致 PM2 进程被杀

```bash
# 查看内存使用
pm2 monit

# 如果内存不足，可创建 swap 分区
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```
