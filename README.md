# 🚶 AI CityWalk — 智能行程规划系统

> 用 AI 为你规划一条独特的城市漫步路线

## 项目介绍

AI CityWalk 是一个基于大语言模型的智能行程规划 Web 应用。你只需要选择城市、偏好和风格，AI 就能自动生成一条空间合理、主题鲜明的 CityWalk 路线，并在地图上直观展示。

## ✨ 功能特点

- 🎯 **智能路线生成**：基于 DeepSeek AI，根据用户偏好动态规划路线
- 🗺️ **地图可视化**：腾讯地图展示路线，编号标记 + 折线连接
- 📝 **详细信息**：每个途经点包含推荐理由、停留时间、实用小贴士
- 💾 **历史记录**：保存生成过的路线，随时回看
- 📱 **响应式设计**：适配桌面端和移动端
- ✨ **精美动画**：AI 生成过程中展示优美的等待动画

## 🛠️ 技术栈

| 层次 | 技术 |
|------|------|
| 前端 | HTML + CSS + JavaScript（单页应用） |
| 地图 | 腾讯地图 JS API GL |
| 后端 | Python 3.11 + Flask |
| AI | DeepSeek API |
| 数据库 | SQLite |

## 🚀 快速开始

### 1. 克隆项目
```bash
git clone <项目地址>
cd AI-CityWalk
```

### 2. 安装后端依赖
```bash
cd backend
pip install -r requirements.txt
```

### 3. 配置 API Key
在 `backend/` 目录下创建 `.env` 文件：
```
DEEPSEEK_API_KEY=sk-你的key
TENCENT_MAP_KEY=你的腾讯地图Key
```

#### API Key 申请指引：
- **DeepSeek**：访问 https://platform.deepseek.com/ → API Keys → 创建
- **腾讯地图**：访问 https://lbs.qq.com/ → 注册登录 → 创建应用 → 申请 Key

### 4. 启动后端
```bash
cd backend
python app.py
```
后端运行在 http://localhost:5000

### 5. 打开前端
用浏览器打开 `frontend/index.html`，或使用 Live Server 插件

## 📁 项目结构

```
AI-CityWalk/
├── backend/          # 后端代码
├── frontend/         # 前端代码
├── docx/             # 项目规范文档
├── dev-log/          # 开发日志
├── CLAUDE.md         # Claude AI 项目指引
└── README.md         # 本文件
```

## 📄 许可

本项目仅供学习和参考使用。
