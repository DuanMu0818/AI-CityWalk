# AI CityWalk 部署指南

## 方式一：Render.com（推荐，免费）

1. 把项目上传到 GitHub
2. 打开 https://render.com → 注册 → New Web Service → 连接你的 GitHub 仓库
3. 配置：
   - **Build Command**: `pip install -r backend/requirements.txt`
   - **Start Command**: `cd backend && gunicorn app:app --bind 0.0.0.0:$PORT --workers 2 --timeout 120`
4. 在 Environment Variables 中添加：
   - `DEEPSEEK_API_KEY` = 你的 DeepSeek Key
   - `TENCENT_MAP_KEY` = 你的腾讯地图 Key
5. 点 Deploy，等 2 分钟就上线了

## 方式二：Railway.app（免费）

1. 把项目上传到 GitHub
2. 打开 https://railway.app → 注册 → New Project → Deploy from GitHub
3. 自动检测 Python 项目，无需额外配置
4. 在 Variables 中添加 DEEPSEEK_API_KEY 和 TENCENT_MAP_KEY
5. 自动部署

## 方式三：自己的 VPS/云服务器

```bash
# 1. 上传项目到服务器
scp -r AI-CityWalk user@server:/opt/

# 2. 安装依赖
cd /opt/AI-CityWalk/backend
pip install -r requirements.txt

# 3. 配置环境变量
export DEEPSEEK_API_KEY=sk-xxx
export TENCENT_MAP_KEY=xxx
export PORT=5000

# 4. 启动（使用 gunicorn）
gunicorn app:app --bind 0.0.0.0:$PORT --workers 2 --timeout 120 --daemon

# 或使用 systemd 服务（推荐）
sudo nano /etc/systemd/system/citywalk.service
```

systemd 配置示例：
```ini
[Unit]
Description=AI CityWalk
After=network.target

[Service]
User=www-data
WorkingDirectory=/opt/AI-CityWalk/backend
Environment="DEEPSEEK_API_KEY=sk-xxx"
Environment="TENCENT_MAP_KEY=xxx"
Environment="PORT=5000"
Environment="DATABASE_PATH=/data/citywalk.db"
ExecStart=/usr/bin/gunicorn app:app --bind 0.0.0.0:5000 --workers 2 --timeout 120
Restart=always

[Install]
WantedBy=multi-user.target
```

## 上线后注意事项

1. **腾讯地图 Key 白名单**：去 https://lbs.qq.com 给 Key 设置 referer 白名单，填入你的域名
2. **确认 .env 没上传**：项目根目录的 .env 已在 .gitignore 中，不会上传到 GitHub
3. **如果有域名**：用 Nginx 反向代理 + Let's Encrypt 免费 HTTPS
