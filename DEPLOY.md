# AI CityWalk — 私有服务器部署完全指南

> 适用系统：**Debian 12** / Ubuntu 20.04+  
> 预计耗时：30-60 分钟（含域名配置）

---

## 目录

- [架构概览](#架构概览)
- [前提准备](#前提准备)
- [第一步：基础环境安装](#第一步基础环境安装)
- [第二步：上传项目代码](#第二步上传项目代码)
- [第三步：配置 Python 虚拟环境](#第三步配置-python-虚拟环境)
- [第四步：配置环境变量](#第四步配置环境变量)
- [第五步：手动启动验证](#第五步手动启动验证)
- [第六步：systemd 服务化](#第六步systemd-服务化)
- [第七步：Nginx 反向代理](#第七步nginx-反向代理)
- [第八步：防火墙配置](#第八步防火墙配置)
- [第九步：HTTPS 证书](#第九步https-证书)
- [日常维护](#日常维护)
- [故障排查](#故障排查)
- [Debian 12 vs Ubuntu 差异](#debian-12-vs-ubuntu-差异)
- [部署检查清单](#部署检查清单)
- [快速命令参考](#快速命令参考)

---

## 架构概览

部署后的请求流向：

```
用户浏览器
    │
    ▼
Nginx (监听 80/443 端口)
    │
    ├── /*.css, /*.js, /*.svg ...  →  直接返回静态文件 (/opt/AI-CityWalk/frontend/)
    │
    ├── /api/*  ──────────────────→  Gunicorn (127.0.0.1:5000, 仅本机监听)
    │                                    │
    │                                    ├── DeepSeek API    → AI 生成路线概念
    │                                    ├── 腾讯地图 API     → 地理编码 + POI 搜索  
    │                                    └── SQLite 文件     → 历史记录持久化
    │
    └── 其他路径  ────────────────→  /opt/AI-CityWalk/frontend/index.html (SPA 兜底)
```

### 为什么这样设计

| 设计决策 | 原因 |
|----------|------|
| Nginx 处理静态文件 | 比 Flask 快 10 倍以上，且支持缓存、gzip |
| Gunicorn 只监听 127.0.0.1 | 不直接暴露到公网，安全 |
| 前端同源部署 | 前端 JS 自动用相对路径调 API（[frontend/js/api.js:9-11](frontend/js/api.js#L9-L11)），无跨域问题 |
| 腾讯地图 Key 动态获取 | Key 存在后端，前端通过 `/api/config` 获取（[frontend/js/map.js:25-26](frontend/js/map.js#L25-L26)），不暴露在 HTML 源码中 |
| SQLite 文件存储 | 零配置，不需要额外安装数据库服务 |

---

## 前提准备

### 你需要准备

| 项目 | 说明 | 去哪弄 |
|------|------|--------|
| 服务器 | Debian 12 / Ubuntu，≥1核1G | 阿里云/腾讯云/华为云 等 |
| 域名（可选） | 有域名才能上 HTTPS | 任意域名注册商 |
| DeepSeek API Key | AI 生成路线的核心 | [platform.deepseek.com](https://platform.deepseek.com) → API Keys |
| 腾讯地图 Key | 地图显示 + 地址搜索 | [lbs.qq.com](https://lbs.qq.com) → 应用管理 → 创建应用 |

### 腾讯地图 Key 特别说明

这个 Key 需要**同时开启两个服务**：

1. **WebService API** — 后端地理编码用（[geocode_service.py](backend/services/geocode_service.py) 调用）
2. **地图 JS API** — 前端地图显示用（[map.js](frontend/js/map.js) 加载）

在 [lbs.qq.com 控制台](https://lbs.qq.com) 的「Key 管理」中：
- 勾选「WebService API」→ 选择「域名白名单」→ 填入你的服务器 IP 或域名
- 勾选「地图 JS API」→ 同样设置白名单

> ⚠️ **白名单不设置的话，地图在前端加载不出来，地理编码也会被拒绝。这是部署失败最常见的原因。**

### SSH 登录服务器

```bash
# Windows 用户用 PowerShell 或 Git Bash
ssh root@你的服务器IP

# 或用密钥登录
ssh -i ~/.ssh/你的密钥 root@你的服务器IP
```

---

## 第一步：基础环境安装

```bash
# 更新系统包
sudo apt update && sudo apt upgrade -y

# 安装必备软件
sudo apt install -y \
    python3 python3-pip python3-venv \
    nginx git curl \
    certbot python3-certbot-nginx

# 验证安装
python3 --version    # 应该输出 Python 3.11.x
nginx -v             # 应该输出 nginx/1.22.x
git --version        # 确认 git 可用
```

> Debian 12 自带 Python 3.11，和项目完美匹配，不需要额外折腾版本。

---

## 第二步：上传项目代码

### 方式 A：Git 克隆（推荐）

先把项目推送到 GitHub（公开或私有仓库），然后：

```bash
cd /opt

# 公开仓库
sudo git clone https://github.com/你的用户名/AI-CityWalk.git

# 私有仓库（需要先配置 SSH Key 或输入用户名密码）
sudo git clone https://github.com/你的用户名/AI-CityWalk.git
```

**优点**：后续更新只需 `git pull`，方便维护。

### 方式 B：scp 上传

在你**本地 Windows 电脑**的 PowerShell 中执行：

```powershell
# 上传整个项目到服务器
scp -r "d:\System file\Desktop\AI-CityWalk" root@你的服务器IP:/opt/
```

**优点**：不需要 GitHub 中转，直接传。

---

## 第三步：配置 Python 虚拟环境

```bash
# 进入后端目录
cd /opt/AI-CityWalk/backend

# 创建虚拟环境（隔离项目依赖，不污染系统 Python）
python3 -m venv venv

# 激活虚拟环境
source venv/bin/activate

# 此时终端提示符前面会出现 (venv)，表示虚拟环境已激活

# 升级 pip（避免安装旧包报错）
pip install --upgrade pip

# 安装项目依赖
pip install -r requirements.txt
```

### 验证依赖安装

```bash
pip list | grep -E "flask|gunicorn|openai|requests|dotenv"
```

应该看到以下 6 个包：

```
flask            3.0.0
flask_cors       4.0.0
gunicorn         22.0.0
openai           1.55.0
python-dotenv    1.0.0
requests         2.31.0
httpx            0.27.2
```

如果缺少某个包，手动安装：
```bash
pip install 包名==版本号
```

---

## 第四步：配置环境变量

### 创建 .env 文件

```bash
cd /opt/AI-CityWalk/backend
nano .env
```

写入以下内容（**替换成你自己的 Key**）：

```ini
# DeepSeek AI 配置
DEEPSEEK_API_KEY=sk-你的DeepSeek密钥

# 腾讯地图配置（同一个 Key 同时用于前端地图和后端地理编码）
TENCENT_MAP_KEY=你的腾讯地图Key

# 数据库文件路径（可选，不设则默认 backend/citywalk.db）
DATABASE_PATH=/opt/AI-CityWalk/backend/citywalk.db

# 运行端口（可选，默认 5000）
PORT=5000
```

> `nano` 编辑器操作：编辑完按 `Ctrl+O` 保存，`Ctrl+X` 退出。

### 各变量详解

| 变量 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `DEEPSEEK_API_KEY` | ✅ 是 | - | DeepSeek 平台申请的 API Key，格式 `sk-` 开头 |
| `TENCENT_MAP_KEY` | ✅ 是 | - | 腾讯位置服务申请的 Key |
| `DATABASE_PATH` | ❌ 否 | `backend/citywalk.db` | SQLite 数据库文件位置，建议放 `/data/` 下方便备份 |
| `PORT` | ❌ 否 | `5000` | Gunicorn 监听端口，一般不用改 |

### 安全设置

```bash
# .env 包含敏感信息，应该只有 root 和 www-data 能读
chmod 600 /opt/AI-CityWalk/backend/.env

# 确认权限
ls -la /opt/AI-CityWalk/backend/.env
# 应该显示 -rw------- (600)
```

---

## 第五步：手动启动验证

**部署最重要的原则：先手动跑通，再配置自动启动。**

### 启动后端

```bash
cd /opt/AI-CityWalk/backend
source venv/bin/activate
python app.py
```

看到以下输出说明成功：

```
✅ 所有 API Key 已配置
🚶 AI CityWalk 后端启动中...
📍 访问 http://localhost:5000
📋 API 文档: docx/api-design.md
🔑 /api/config - 获取腾讯地图 Key
🤖 /api/generate - 生成路线
📚 /api/history - 历史路线
```

如果看到 `⚠️ 警告：以下 API Key 未配置`，说明 `.env` 文件没写对或路径不对，回头检查第四步。

### 测试 API（另开一个 SSH 窗口）

```bash
# 测试 1：获取配置（验证后端基本可用）
curl http://localhost:5000/api/config
# 预期返回：{"tencent_map_key":"你的Key"}

# 测试 2：生成路线（验证 DeepSeek + 腾讯地图全流程）
curl -X POST http://localhost:5000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"city":"成都","theme":"美食之旅","time_energy":"半天轻松逛（约3-4小时）"}'
# 预期返回：完整的路线 JSON，waypoints 数组中每个点有 lat/lng 坐标
```

### 测试通过后停掉

按 `Ctrl+C` 停掉手动启动的 Flask 进程。

---

## 第六步：systemd 服务化

让应用在后台持续运行，崩溃自动重启，服务器重启后自动启动。

### 创建服务文件

```bash
sudo tee /etc/systemd/system/citywalk.service << 'EOF'
[Unit]
Description=AI CityWalk Backend
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/opt/AI-CityWalk/backend
EnvironmentFile=/opt/AI-CityWalk/backend/.env
ExecStart=/opt/AI-CityWalk/backend/venv/bin/gunicorn app:app \
    --bind 127.0.0.1:5000 \
    --workers 2 \
    --timeout 120 \
    --access-logfile /var/log/citywalk-access.log \
    --error-logfile /var/log/citywalk-error.log
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
```

### 每个参数的含义

| 参数 | 值 | 说明 |
|------|----|------|
| `User` | `www-data` | 以低权限用户运行，即使应用被攻破也拿不到 root 权限 |
| `WorkingDirectory` | `/opt/AI-CityWalk/backend` | 工作目录，确保 `.env` 和 `citywalk.db` 能正确找到 |
| `EnvironmentFile` | `.env` 文件路径 | 从 `.env` 加载环境变量 |
| `--bind 127.0.0.1:5000` | 只监听本机 | 不直接暴露到公网，必须通过 Nginx 访问 |
| `--workers 2` | 2 个进程 | 经验值：CPU 核数 × 2 + 1。小服务器 2 个够了 |
| `--timeout 120` | 120 秒超时 | DeepSeek API 有时响应慢，设短了会 504 |
| `Restart=always` | 总是重启 | 无论什么原因挂掉都自动拉起来 |
| `RestartSec=5` | 等 5 秒再重启 | 避免疯狂重启循环 |

### 设置权限并启动

```bash
# 让 www-data 用户拥有项目目录的所有权
sudo chown -R www-data:www-data /opt/AI-CityWalk

# 确保日志文件可写
sudo touch /var/log/citywalk-access.log /var/log/citywalk-error.log
sudo chown www-data:www-data /var/log/citywalk-access.log /var/log/citywalk-error.log

# 重载 systemd 配置
sudo systemctl daemon-reload

# 设置开机自启
sudo systemctl enable citywalk

# 启动服务
sudo systemctl start citywalk

# 检查运行状态
sudo systemctl status citywalk
```

### 状态解读

看到以下内容表示正常运行：

```
● citywalk.service - AI CityWalk Backend
     Loaded: loaded (/etc/systemd/system/citywalk.service; enabled)
     Active: active (running) since ...
```

如果 `Active: failed`，用以下命令排查：
```bash
# 查看详细错误日志
sudo journalctl -u citywalk -n 50 --no-pager

# 或者直接看 Gunicorn 错误日志
sudo tail -50 /var/log/citywalk-error.log
```

---

## 第七步：Nginx 反向代理

### 创建站点配置

```bash
sudo tee /etc/nginx/sites-available/citywalk << 'EOF'
server {
    listen 80;
    # TODO: 替换成你的域名或服务器 IP
    server_name 你的域名或IP;

    # 前端静态文件根目录
    root /opt/AI-CityWalk/frontend;
    index index.html;

    # ==========================================
    # 静态资源缓存（CSS/JS/图片等）
    # 这些文件通常不变，缓存 7 天减少请求
    # ==========================================
    location ~* \.(css|js|svg|png|jpg|jpeg|gif|ico|woff|woff2)$ {
        expires 7d;
        add_header Cache-Control "public, immutable";
    }

    # ==========================================
    # API 请求转发给后端 Gunicorn
    # ==========================================
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # AI 生成路线可能耗时较长
        proxy_read_timeout 120s;
        proxy_connect_timeout 30s;
    }

    # ==========================================
    # 其他路径全部返回 index.html（SPA 路由）
    # ==========================================
    location / {
        try_files $uri $uri/ /index.html;
    }

    # ==========================================
    # 安全加固：禁止访问隐藏文件
    # ==========================================
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }
}
EOF
```

### 启用站点

```bash
# 创建软链接（Nginx 只加载 sites-enabled 里的配置）
sudo ln -s /etc/nginx/sites-available/citywalk /etc/nginx/sites-enabled/

# 删除默认站点（避免端口冲突）
sudo rm -f /etc/nginx/sites-enabled/default

# 检查配置文件语法
sudo nginx -t
# 看到 "syntax is ok" 和 "test is successful" 就对了

# 重载 Nginx 使配置生效
sudo systemctl reload nginx

# 确认 Nginx 在运行
sudo systemctl status nginx
```

### 验证

在浏览器地址栏输入 `http://你的服务器IP`，应该能看到完整的 AI CityWalk 页面了。

---

## 第八步：防火墙配置

### 云服务器安全组（先做这个）

如果你用的是**阿里云/腾讯云/华为云**等云服务器，登录云控制台，在「安全组」中添加规则：

| 方向 | 端口 | 协议 | 来源 |
|------|------|------|------|
| 入方向 | 80 | TCP | 0.0.0.0/0 |
| 入方向 | 443 | TCP | 0.0.0.0/0 |
| 入方向 | 22 | TCP | 你的IP/0.0.0.0（SSH，别把自己锁外面） |

> ⚠️ 安全组是云平台层面的防火墙，和系统防火墙是两层。两层都要放行。

### Debian 12 系统防火墙

Debian 12 默认使用 `nftables` 框架，但**通常没有配置规则**（相当于全部放行）。检查一下：

```bash
# 查看当前防火墙规则
sudo nft list ruleset

# 如果输出为空或只有基本规则，说明防火墙没开，不用配置
# 如果已经有规则，添加下面的放行：
sudo nft add rule inet filter input tcp dport 80 accept
sudo nft add rule inet filter input tcp dport 443 accept
```

如果你习惯用 `iptables`：

```bash
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT
# 持久化规则
sudo apt install -y iptables-persistent
sudo netfilter-persistent save
```

---

## 第九步：HTTPS 证书

> 需要先有域名，并把域名解析到服务器 IP。

### 配置域名

```bash
# 编辑 Nginx 配置，把 server_name 改成你的域名
sudo nano /etc/nginx/sites-available/citywalk
# 找到 server_name 那一行，改成你的域名，例如：
# server_name citywalk.你的域名.com;
```

保存后重载：

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### 申请免费 SSL 证书

```bash
# certbot 会自动验证域名所有权并修改 Nginx 配置
sudo certbot --nginx -d 你的域名

# 按提示操作：
# 1. 输入你的邮箱（用于证书到期提醒）
# 2. 同意服务条款（输入 Y）
# 3. 是否接收推广邮件（输入 N）
# 4. 是否自动重定向 HTTP 到 HTTPS（选 2，自动跳转）
```

完成后访问 `https://你的域名`，地址栏应该出现 🔒 图标。

### 证书自动续期

certbot 安装时会自动添加续期定时任务。验证一下：

```bash
# 测试自动续期是否正常（不会真的续期，只是模拟）
sudo certbot renew --dry-run

# 看到 "Congratulations, all simulated renewals succeeded" 就 OK
```

Let's Encrypt 证书 90 天有效期，certbot 会在到期前自动续期，你不需要手动操作。

---

## 日常维护

### 查看运行状态

```bash
# 一键查看所有相关服务
sudo systemctl status citywalk nginx

# 看应用日志（实时滚动）
sudo journalctl -u citywalk -f

# 看最近 50 条日志
sudo journalctl -u citywalk -n 50

# 看 Nginx 访问日志
sudo tail -f /var/log/nginx/access.log

# 看 Nginx 错误日志
sudo tail -f /var/log/nginx/error.log
```

### 重启服务

```bash
# 改完代码或配置后重启
sudo systemctl restart citywalk

# 改完 Nginx 配置后重载（不中断服务）
sudo systemctl reload nginx

# 彻底重启整个服务器后，服务会自动启动（因为 enable 了）
```

### 更新代码

```bash
cd /opt/AI-CityWalk

# 拉取最新代码
sudo git pull

# 如果有新的 Python 依赖
cd backend
source venv/bin/activate
pip install -r requirements.txt
deactivate

# 重启应用
sudo systemctl restart citywalk
```

### 备份数据库

```bash
# SQLite 就是一个文件，直接复制即可
sudo cp /opt/AI-CityWalk/backend/citywalk.db ~/backups/citywalk-$(date +%Y%m%d).db

# 建议加到 crontab 每天自动备份
# sudo crontab -e
# 0 3 * * * cp /opt/AI-CityWalk/backend/citywalk.db /root/backups/citywalk-$(date +\%Y\%m\%d).db
```

### 查看资源使用

```bash
# CPU 和内存
htop

# 磁盘空间
df -h

# SQLite 数据库大小
ls -lh /opt/AI-CityWalk/backend/citywalk.db
```

---

## 故障排查

### 问题 1：访问页面 502 Bad Gateway

**原因**：Nginx 能正常运行，但转发的后端（Gunicorn）挂了。

```bash
# 先看后端是否在运行
sudo systemctl status citywalk

# 如果挂了，看日志找原因
sudo journalctl -u citywalk -n 50

# 常见原因：
# - .env 文件不存在或路径不对 → 检查 /opt/AI-CityWalk/backend/.env
# - Python 依赖没装全 → pip install -r requirements.txt
# - www-data 用户没权限 → sudo chown -R www-data:www-data /opt/AI-CityWalk
```

### 问题 2：访问页面 404 Not Found

**原因**：Nginx 配置的 `root` 路径不对，或者站点没启用。

```bash
# 检查前端文件是否存在
ls -la /opt/AI-CityWalk/frontend/index.html

# 检查站点是否启用
ls -la /etc/nginx/sites-enabled/

# 检查 Nginx 配置语法
sudo nginx -t
```

### 问题 3：生成路线返回 504 超时

**原因**：AI 生成耗时超过 Nginx 的 `proxy_read_timeout`。

```bash
# 检查 Nginx 配置中的超时设置
grep -n "proxy_read_timeout" /etc/nginx/sites-available/citywalk
# 应该是 120s，如果太小就改大

# 同时检查 Gunicorn 超时
grep -n "timeout" /etc/systemd/system/citywalk.service
# 也应该是 120
```

### 问题 4：地图加载不出来

**原因**：几乎都是腾讯地图 Key 的白名单没配。

1. 打开浏览器 F12 控制台
2. 看有没有 "key 鉴权失败" 之类的错误
3. 去 [lbs.qq.com](https://lbs.qq.com) → Key 管理 → 检查白名单是否包含你的域名/IP
4. 检查是否同时开启了「WebService API」和「地图 JS API」

### 问题 5：定位功能返回"IP 定位失败"

**原因**：腾讯地图 IP 定位接口调用失败。

```bash
# 测试一下直接调 API 能不能通
curl "https://apis.map.qq.com/ws/location/v1/ip?key=你的Key"
```

如果返回 `status: 0` 就说明正常，如果失败检查：
- Key 是否正确
- WebService API 是否开启
- 服务器是否能正常访问外网

### 问题 6：历史记录刷新后丢失

**原因**：`DATABASE_PATH` 配置不对，或者数据库文件权限有问题。

```bash
# 检查数据库文件
ls -la /opt/AI-CityWalk/backend/citywalk.db

# 确认 www-data 用户有读写权限
sudo -u www-data sqlite3 /opt/AI-CityWalk/backend/citywalk.db "SELECT COUNT(*) FROM routes;"
```

### 问题 7：Gunicorn workers 不够用

症状：多个用户同时访问时响应很慢。

```bash
# 编辑服务文件，增加 workers
sudo nano /etc/systemd/system/citywalk.service
# 把 --workers 2 改成 --workers 4

# 重启生效
sudo systemctl daemon-reload
sudo systemctl restart citywalk
```

> Workers 数量建议：CPU 核数 × 2 + 1。查看 CPU 核数：`nproc`

### 通用排查技巧

```bash
# 测试后端是否正常（绕过 Nginx，直接访问 Gunicorn）
curl -v http://127.0.0.1:5000/api/config

# 如果上面正常但通过 Nginx 不行，说明 Nginx 配置有问题
curl -v http://localhost/api/config

# 查看所有 systemd 服务的错误
sudo journalctl -p 3 -xb
```

---

## Debian 12 vs Ubuntu 差异

| 差异点 | Debian 12 | Ubuntu 22.04 | 影响 |
|--------|-----------|-------------|------|
| 默认 Python | 3.11 ✅ | 3.10 | Debian 12 完美匹配，Ubuntu 22.04 也能用 |
| `www-data` 用户 | 存在 | 存在 | 无差异 |
| Nginx 配置目录 | `/etc/nginx/sites-available/` | 相同 | 无差异 |
| systemd 路径 | `/etc/systemd/system/` | 相同 | 无差异 |
| 默认防火墙 | `nftables`（通常无规则） | `ufw`（通常未启用） | 基本不用管 |
| `certbot` 包名 | `certbot` + `python3-certbot-nginx` | 相同 | 无差异 |
| `.env` 文件权限 | 需 `chmod 600` | 相同 | 无差异 |

> 结论：本指南**同时适用于 Debian 12 和 Ubuntu**，命令完全通用。

---

## 部署检查清单

部署完成后逐项确认：

### 基础服务
- [ ] `sudo systemctl status citywalk` → `active (running)`
- [ ] `sudo systemctl status nginx` → `active (running)`
- [ ] `curl http://127.0.0.1:5000/api/config` → 返回 JSON

### 功能测试
- [ ] 浏览器访问 `http://你的IP或域名` → 看到完整页面（导航栏 + 表单 + 地图占位图）
- [ ] 输入城市"成都"，点击"生成路线" → 加载动画 → 地图显示标记点 → 卡片显示途经点详情
- [ ] 点击"历史记录" → 能看到刚才生成的路线
- [ ] 点击历史路线 → 能回显到地图上
- [ ] 删除一条历史路线 → 确认删除后列表刷新
- [ ] 点击途经点卡片的"高德/腾讯/百度"链接 → 能跳转到对应地图 App

### 安全加固
- [ ] `.env` 文件权限为 `600`（`ls -la /opt/AI-CityWalk/backend/.env`）
- [ ] 腾讯地图 Key 白名单已设置（域名或 IP）
- [ ] 有域名则 HTTPS 已生效（浏览器地址栏显示 🔒）
- [ ] 云服务器安全组已放行 80/443 端口

### 日志确认
- [ ] `sudo journalctl -u citywalk -n 20` → 没有 ERROR
- [ ] `/var/log/citywalk-error.log` → 为空或只有警告

---

## 快速命令参考

```bash
# ========== 服务管理 ==========
sudo systemctl start citywalk        # 启动
sudo systemctl stop citywalk         # 停止
sudo systemctl restart citywalk      # 重启
sudo systemctl status citywalk       # 状态
sudo systemctl reload nginx          # 重载 Nginx（不中断服务）

# ========== 日志查看 ==========
sudo journalctl -u citywalk -f       # 实时日志
sudo journalctl -u citywalk -n 100   # 最近 100 条
sudo tail -f /var/log/nginx/access.log  # Nginx 访问日志

# ========== 代码更新 ==========
cd /opt/AI-CityWalk
sudo git pull
sudo systemctl restart citywalk

# ========== 证书管理 ==========
sudo certbot renew --dry-run         # 测试证书续期
sudo certbot certificates            # 查看已有证书

# ========== 故障排查 ==========
sudo nginx -t                        # 检查 Nginx 配置
curl http://127.0.0.1:5000/api/config  # 测试后端
sudo journalctl -p 3 -xb             # 查看系统级错误
```

---

## 项目文件说明

部署涉及的关键文件和它们的作用：

| 文件 | 作用 |
|------|------|
| `backend/app.py` | Flask 主应用，定义所有 API 路由 |
| `backend/config.py` | 从 `.env` 读取配置 |
| `backend/.env` | 存储 API Key 等敏感信息（不提交 Git） |
| `backend/requirements.txt` | Python 依赖清单 |
| `backend/services/ai_service.py` | DeepSeek AI 路线生成 |
| `backend/services/geocode_service.py` | 腾讯地图地理编码 + POI 搜索 |
| `backend/services/db_service.py` | SQLite 数据库操作 |
| `frontend/index.html` | 前端主页面 |
| `frontend/js/api.js` | 前端 API 调用封装（自动判断 API 地址） |
| `frontend/js/map.js` | 腾讯地图交互 |
| `frontend/js/app.js` | 前端主控制器 |
| `frontend/css/style.css` | 前端完整样式表 |
| `Procfile` | Railway/Render 等云平台用的启动命令 |
| `.gitignore` | Git 忽略规则（`.env` 和 `*.db` 不会提交） |
