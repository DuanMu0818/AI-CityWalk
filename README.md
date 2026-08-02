# 🚶 AI CityWalk — 智能城市漫步路线规划

<p align="center">
  <img src="frontend/assets/logo.svg" alt="AI CityWalk Logo" width="120" />
</p>

<p align="center">
  <strong>用自然语言描述你的偏好，AI 为你生成一条主题鲜明、空间合理的城市漫步路线</strong>
</p>

<p align="center">
  <a href="#-技术栈"><img src="https://img.shields.io/badge/python-3.11+-blue.svg" alt="Python 3.11+" /></a>
  <a href="#-技术栈"><img src="https://img.shields.io/badge/flask-3.0-green.svg" alt="Flask 3.0" /></a>
  <a href="#-技术栈"><img src="https://img.shields.io/badge/deepseek-API-purple.svg" alt="DeepSeek API" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-yellow.svg" alt="MIT License" /></a>
</p>

---

## ✨ 功能特点

| 功能 | 说明 |
|------|------|
| 🎯 **AI 智能规划** | 基于 DeepSeek 大模型，根据城市、主题、时间、预算等多维度偏好，自动生成个性化路线 |
| 🗺️ **地图可视化** | 腾讯地图展示完整路线——编号标记点 + 折线连接 + 信息窗详情，一目了然 |
| 📝 **途经点详情** | 每个地点包含名称、推荐理由、建议停留时间、实用小贴士 |
| 💾 **历史记录** | SQLite 持久化存储，支持查看、回显、删除历史路线 |
| 📱 **响应式设计** | 适配桌面端和移动端，侧栏 + 地图双面板布局 |
| ✨ **精美动效** | AI 生成过程中展示等待动画，体验流畅自然 |

## 🎬 效果预览

> 添加你的截图后，删除下面这行替换为实际图片

```
📸 建议截图：路线生成结果页（地图 + 途经点卡片）
```

## 🛠️ 技术栈

| 层次 | 技术 | 说明 |
|------|------|------|
| 🖥️ 前端 | HTML + CSS + JavaScript | 单页应用，模块化 JS |
| 🗺️ 地图 | 腾讯地图 JS API GL | 标记点、折线、信息窗、自适应视野 |
| ⚙️ 后端 | Python 3.11 + Flask | RESTful API，5 个端点 |
| 🤖 AI | DeepSeek API | OpenAI 兼容格式，路线智能生成 |
| 🗄️ 数据库 | SQLite | 轻量级本地持久化 |
| 🌐 地理编码 | 腾讯地图 Web Service API | 地点名称 → 坐标转换 + POI 搜索 |

### 核心设计

采用**两阶段生成策略**解决 LLM 坐标幻觉问题：

```
用户偏好 → DeepSeek AI 生成路线骨架（地点名称）
         → 腾讯地图地理编码（名称 → 精确坐标）
         → 前端地图渲染（标记 + 折线）
```

## 🚀 在线体验

👉 **直接访问**：**[https://你的域名.com](https://你的域名.com)**（部署后替换为实际地址）

打开网页即可使用，无需安装任何东西！

---

## 🔧 本地开发

如果你想要自己运行或二次开发：

### 前提条件

- Python 3.11+
- DeepSeek API Key（[申请](https://platform.deepseek.com/)）
- 腾讯地图 API Key（[申请](https://lbs.qq.com/)）

### 1. 克隆项目

```bash
git clone https://github.com/DuanMu0818/AI-CityWalk.git
cd AI-CityWalk
```

### 2. 安装依赖

```bash
cd backend
pip install -r requirements.txt
```

### 3. 配置 API Key

在 `backend/` 目录下创建 `.env` 文件：

```env
DEEPSEEK_API_KEY=sk-你的DeepSeek密钥
TENCENT_MAP_KEY=你的腾讯地图Key
```

> ⚠️ **重要**：`.env` 已在 `.gitignore` 中，不会被提交到 GitHub。

### 4. 启动

```bash
cd backend
python app.py
```

浏览器打开 [http://localhost:5000](http://localhost:5000)。

## 📖 使用指南

1. **选择城市** — 输入你要探索的城市名称
2. **选择主题** — 美食探访 / 历史人文 / 潮流打卡 / 自然风光 / 文艺小巷（可多选）
3. **设置偏好** — 可用时间、体力等级、预算范围
4. **自由描述**（可选）— 用自然语言补充特殊需求，如"想去本地人爱去的店"
5. **点击生成** — AI 为你规划路线并在地图上展示

## 📁 项目结构

```
AI-CityWalk/
├── backend/                    # 后端代码
│   ├── app.py                  # Flask 主应用（5 个 API 端点 + 静态文件服务）
│   ├── config.py               # 配置管理（环境变量读取 + 校验）
│   ├── requirements.txt        # Python 依赖清单
│   ├── services/
│   │   ├── ai_service.py       # DeepSeek AI 路线生成服务
│   │   ├── geocode_service.py  # 腾讯地图地理编码 + POI 搜索
│   │   └── db_service.py       # SQLite 数据库 CRUD 操作
│   └── .env                    # API Key 配置（不提交到 Git）
├── frontend/                   # 前端代码
│   ├── index.html              # 主页面（导航栏 + 表单侧栏 + 地图区 + 卡片区）
│   ├── css/
│   │   └── style.css           # 完整样式（设计系统变量 + 组件 + 动画 + 响应式）
│   ├── js/
│   │   ├── api.js              # API 调用封装
│   │   ├── form.js             # 表单交互（胶囊按钮、字数统计、验证）
│   │   ├── map.js              # 腾讯地图集成（标记、折线、信息窗、自适应视野）
│   │   ├── history.js          # 历史记录面板（侧滑抽屉）
│   │   └── app.js              # 主控制器（表单 → API → 地图 → 卡片全流程）
│   └── assets/                 # 静态资源
├── docx/                       # 项目规范文档
│   ├── requirements.md         # 功能需求规格书
│   ├── tech-architecture.md    # 技术架构设计
│   ├── design-spec.md          # UI/UX 设计规范
│   ├── api-design.md           # API 接口设计
│   └── dev-steps.md            # 开发执行步骤
├── dev-log/                    # 开发日志
├── DEPLOY.md                   # 部署指南（Render / Railway / VPS）
├── CLAUDE.md                   # Claude AI 项目指引
└── README.md                   # 本文件
```

## 🔌 API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/config` | 获取前端配置（地图 Key 等） |
| `POST` | `/api/generate` | 提交偏好，生成 AI 路线 |
| `GET` | `/api/history` | 获取历史路线列表 |
| `GET` | `/api/history/<id>` | 获取单条路线详情 |
| `DELETE` | `/api/history/<id>` | 删除历史路线 |

详细说明见 [API 接口设计文档](docx/api-design.md)。

## 🚢 部署

支持多种部署方式，详见 [DEPLOY.md](DEPLOY.md)：

| 平台 | 费用 | 难度 |
|------|------|------|
| [Render.com](https://render.com) | 免费额度 | ⭐ 简单 |
| [Railway.app](https://railway.app) | 免费额度 | ⭐ 简单 |
| 自有 VPS | 服务器费用 | ⭐⭐⭐ 中等 |

## 📚 开发文档

| 文档 | 说明 |
|------|------|
| [功能需求规格书](docx/requirements.md) | 完整的功能需求定义 |
| [技术架构设计](docx/tech-architecture.md) | 系统架构、数据流、技术选型 |
| [UI/UX 设计规范](docx/design-spec.md) | 视觉设计、布局、组件、动效 |
| [API 接口设计](docx/api-design.md) | 后端 API 端点定义 |
| [开发执行步骤](docx/dev-steps.md) | 分阶段开发计划和验收标准 |
| [开发日志](dev-log/) | 每日开发记录 |

## 🗺️ 路线图

- [x] 项目规划 + 文档搭建
- [x] 后端基础（Flask + SQLite）
- [x] AI 路线生成 + 地理编码
- [x] 前端页面开发
- [x] 三城联调测试（成都 / 北京 / 上海）
- [ ] 浏览器端交互测试 + 体验优化
- [ ] 移动端深度适配
- [ ] 路线评分与反馈机制
- [ ] 多日路线规划支持

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 开源协议

本项目基于 [MIT License](LICENSE) 开源，仅供学习和参考使用。

---

<p align="center">
  <sub>Made with ❤️ by <a href="https://github.com/DuanMu0818">DuanMu0818</a></sub>
</p>
