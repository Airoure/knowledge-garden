#!/bin/bash
#============================================================
# 数感道场 · 一键部署脚本
# 版本: v1.0.0
# 适用系统: Ubuntu / CentOS
#============================================================
set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# 项目路径
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_DIR="$PROJECT_DIR/deploy"

echo ""
echo "╔══════════════════════════════════════╗"
echo "║  数感道场 · 一键部署脚本 v1.0.0     ║"
echo "╚══════════════════════════════════════╝"
echo ""

# ===== 1. 检查 Node.js =====
info "检查 Node.js 环境..."
if ! command -v node &> /dev/null; then
    warn "未检测到 Node.js，开始安装 Node.js 18..."
    if command -v apt &> /dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt install -y nodejs
    elif command -v yum &> /dev/null; then
        curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
        sudo yum install -y nodejs
    else
        error "不支持的系统，请手动安装 Node.js 18+"
    fi
fi
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    error "Node.js 版本过低，需要 18+，当前: $(node -v)"
fi
info "Node.js $(node -v) ✓"

# ===== 2. 安装 PM2 =====
info "检查 PM2..."
if ! command -v pm2 &> /dev/null; then
    warn "安装 PM2..."
    sudo npm install -g pm2
fi
info "PM2 $(pm2 -v) ✓"

# ===== 3. 安装 Nginx =====
info "检查 Nginx..."
if ! command -v nginx &> /dev/null; then
    warn "安装 Nginx..."
    if command -v apt &> /dev/null; then
        sudo apt install -y nginx
    elif command -v yum &> /dev/null; then
        sudo yum install -y nginx
    fi
    sudo systemctl enable nginx
    sudo systemctl start nginx
fi
info "Nginx $(nginx -v 2>&1 | cut -d'/' -f2) ✓"

# ===== 4. 构建前端 =====
info "安装前端依赖并构建..."
cd "$PROJECT_DIR"
npm install
npm run build
info "前端构建完成 ✓"

# ===== 5. 构建后端 =====
info "安装后端依赖并构建..."
cd "$PROJECT_DIR/server"
npm install
npm run build
info "后端构建完成 ✓"

# ===== 6. 创建日志目录 =====
mkdir -p "$PROJECT_DIR/logs"

# ===== 7. 启动后端（PM2）=====
info "启动后端服务..."
cd "$PROJECT_DIR"
pm2 delete sushu-daochang-server 2>/dev/null || true
pm2 start deploy/ecosystem.config.cjs
pm2 save
info "后端服务已启动 ✓"

# 设置 PM2 开机自启
pm2 startup 2>/dev/null || true

# ===== 8. 配置 Nginx =====
info "配置 Nginx..."
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
NGINX_CONF=""

# 判断 Nginx 配置目录
if [ -d /etc/nginx/sites-available ]; then
    NGINX_CONF="/etc/nginx/sites-available/sushu-daochang"
    sudo cp "$DEPLOY_DIR/nginx.conf" "$NGINX_CONF"
    sudo sed -i "s/YOUR_SERVER_IP/_/" "$NGINX_CONF"
    sudo ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/sushu-daochang
    # 移除默认站点冲突
    sudo rm -f /etc/nginx/sites-enabled/default
elif [ -d /etc/nginx/conf.d ]; then
    NGINX_CONF="/etc/nginx/conf.d/sushu-daochang.conf"
    sudo cp "$DEPLOY_DIR/nginx.conf" "$NGINX_CONF"
    sudo sed -i "s/YOUR_SERVER_IP/_/" "$NGINX_CONF"
else
    warn "未找到 Nginx 配置目录，请手动配置: $DEPLOY_DIR/nginx.conf"
fi

# 测试并重载 Nginx
sudo nginx -t && sudo systemctl reload nginx
info "Nginx 配置完成 ✓"

# ===== 完成 =====
echo ""
echo "╔══════════════════════════════════════════╗"
echo "║          部署完成！                       ║"
echo "╠══════════════════════════════════════════╣"
echo "║                                          ║"
echo "║  访问地址: http://$SERVER_IP            "
echo "║  健康检查: http://$SERVER_IP/health      "
echo "║                                          ║"
echo "║  常用命令:                                ║"
echo "║  pm2 logs sushu-daochang-server   # 日志 ║"
echo "║  pm2 restart sushu-daochang-server # 重启║"
echo "║  pm2 list                         # 状态 ║"
echo "║                                          ║"
echo "╚══════════════════════════════════════════╝"
echo ""
