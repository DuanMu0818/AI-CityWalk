# AI CityWalk

[![Python](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/flask-3.0-green.svg)](https://flask.palletsprojects.com/)
[![License: MIT](https://img.shields.io/badge/license-MIT-yellow.svg)](LICENSE)

基于大语言模型的城市漫步（CityWalk）路线规划工具。用户输入城市与偏好，系统生成路线并在地图上展示。

在线演示：https://aicitywalk.dpdns.org

演示站点部署在公网，使用作者自己的 API 额度，可能因额度用尽或限流而暂时不可用。历史记录保存在服务端，请勿在描述中填写个人敏感信息。

## 特性

- 按城市、主题、可用时间、体力和预算生成路线，支持自然语言补充需求
- 在腾讯地图上展示路线：编号标记、折线连接、点位信息窗
- 每个途经点包含推荐理由、建议停留时间和提示
- 历史路线保存在 SQLite 中，可查看、回显和删除
- 桌面端与移动端布局适配

## 工作原理

大语言模型直接输出经纬度时容易出现偏差，因此项目将路线生成拆为两步：

1. 调用 DeepSeek API，仅生成路线中的地点名称及说明
2. 调用腾讯地图 WebService API 对地点名称进行地理编码，得到坐标后交由前端渲染

```
用户偏好 -> DeepSeek（地点名称）-> 腾讯地图地理编码（坐标）-> 前端渲染
```

## 技术栈

| 模块 | 技术 |
|------|------|
| 前端 | HTML / CSS / JavaScript |
| 地图 | 腾讯地图 JavaScript API GL |
| 后端 | Python 3.11, Flask |
| 模型 | DeepSeek Flash v4 |
| 数据库 | SQLite |
| 地理编码 | 腾讯地图 WebService API |

## 快速开始

### 环境要求

- Python 3.11+
- DeepSeek API Key
- 腾讯地图 Key（需开通 JavaScript API GL 与 WebService API）

### 安装

```bash
git clone https://github.com/DuanMu0818/ai-citywalk.git
cd ai-citywalk
pip install -r requirements.txt
```

### 配置

在项目根目录创建 `.env`：

```
DEEPSEEK_API_KEY=your_deepseek_key
TENCENT_MAP_KEY=your_tencent_map_key
```

### 运行

```bash
python app.py
```

启动后访问 http://localhost:5000。

## 部署

线上部署在**自有服务器**上，链路是：`浏览器 --HTTPS:443--> nginx（TLS 终止）--HTTP:5000--> gunicorn + Flask`。
四个步骤：

1. **申请域名**：注册一个域名（演示站点用的是 `aicitywalk.dpdns.org`）。
2. **托管 DNS**：把域名的 NS 交给 Cloudflare，在 DNS 面板添加一条 `A` 记录，指向服务器的公网 IPv4。
3. **申请证书**：在服务器上安装 certbot，执行 `certbot --nginx -d aicitywalk.dpdns.org`，由 Let's Encrypt 签发证书；证书 90 天有效，certbot 的定时任务会自动续期。
4. **反向代理**：nginx 监听 80/443，完成 TLS 握手后把请求转发到后端只开 HTTP 的端口（`127.0.0.1:5000`）；后端用 gunicorn 启动，交给 systemd 托管。

nginx 站点配置参考：

```nginx
server {
    listen 443 ssl;
    http2 on;
    server_name aicitywalk.dpdns.org;

    ssl_certificate     /etc/letsencrypt/live/aicitywalk.dpdns.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/aicitywalk.dpdns.org/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 75s;   # 路线生成最长 60s，留出余量
    }
}

server {
    listen 80;
    server_name aicitywalk.dpdns.org;
    return 301 https://$host$request_uri;
}
```

```bash
# 后端
pip install -r requirements.txt
gunicorn -w 2 -b 127.0.0.1:5000 app:app   # 工作目录 backend/
```

其余注意事项：

- 密钥写在服务器的 `backend/.env`（`DEEPSEEK_API_KEY` / `TENCENT_MAP_KEY`），不要提交；`.gitignore` 已忽略
- 腾讯地图的 JavaScript API Key 会暴露在浏览器中，请在腾讯位置服务控制台为其配置域名白名单；WebService Key 仅在后端使用，不应下发到前端
- 生成接口已内置限流（每 IP 每 60 秒 5 次），公网环境建议再在服务商后台设置用量告警
- SQLite 数据存放在服务器本地文件中（已启用 WAL 模式），重新部署前请备份

## 使用

1. 输入城市
2. 选择主题（美食探访、历史人文、潮流打卡、自然风光、文艺小巷，可多选）
3. 设置可用时间、体力等级与预算
4. 可选：补充自然语言描述，例如“想去本地人常去的店”
5. 点击生成，路线将显示在地图上

## 贡献

欢迎通过 Issue 反馈问题或提出建议，也欢迎提交 Pull Request。

## 许可证

基于 [MIT License](LICENSE) 发布。