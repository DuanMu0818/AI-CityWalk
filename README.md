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

在线演示部署在 [Railway](https://railway.app/)。自行部署到公网时请注意以下几点：

- 密钥通过平台的环境变量配置，不要提交 `.env`，并确保其已加入 `.gitignore`
- 腾讯地图的 JavaScript API Key 会暴露在浏览器中，请在腾讯位置服务控制台为其配置域名白名单，避免被他人盗用额度；WebService Key 仅在后端使用，不应下发到前端
- 路线生成会调用 DeepSeek 与腾讯地图的付费或限额接口，公网环境建议为生成接口添加频率限制，并在服务商后台设置用量告警
- SQLite 数据存放在本地文件中，容器类平台重新部署后文件系统可能被重置，需要持久化历史记录时请挂载持久卷
- 生产环境建议使用 gunicorn 等 WSGI 服务器，而不是 Flask 自带的开发服务器

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