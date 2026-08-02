# 技术架构设计文档

## 1. 技术栈总览

| 层次 | 技术 | 版本 | 说明 |
|------|------|------|------|
| 前端 | HTML + CSS + JavaScript | - | 纯原生，不使用框架 |
| 地图 | 腾讯地图 JS API GL | 1.0 | 动态地图，支持缩放/拖拽/标记 |
| 后端 | Python + Flask | 3.11 + 3.0 | 轻量 Web 框架 |
| 跨域 | Flask-CORS | 4.0 | 允许前端跨域调用 |
| AI | DeepSeek API | - | OpenAI 兼容格式 |
| AI SDK | openai Python 库 | 1.12 | 调用 DeepSeek |
| 地理编码 | 腾讯地图 Web Service API | v1 | 地点名 → GCJ-02 坐标 |
| HTTP 客户端 | requests | 2.31 | 调用腾讯地图 REST API |
| 数据库 | SQLite | 内置 | Python 标准库 sqlite3 |
| 配置管理 | python-dotenv | 1.0 | 从 .env 读取敏感配置 |

---

## 2. 系统架构

### 2.1 整体架构图

```
┌──────────────────────────────────────────────┐
│                   前端（浏览器）                 │
│  ┌──────────┐  ┌──────────┐  ┌─────────────┐ │
│  │ 表单模块  │  │ 地图模块  │  │ 历史记录模块 │ │
│  └─────┬────┘  └────▲─────┘  └──────┬──────┘ │
│        │            │               │         │
│        └────────────┼───────────────┘         │
│                     │ HTTP (fetch)            │
└─────────────────────┼─────────────────────────┘
                      │
                 CORS 跨域
                      │
┌─────────────────────┼─────────────────────────┐
│                   后端（Flask）                 │
│                     ▼                         │
│  ┌──────────────────────────────────────┐     │
│  │           路由层 (app.py)             │     │
│  │  /api/generate  /api/history  /api/config │
│  └──────────┬──────────────┬───────────┘     │
│             │              │                  │
│    ┌────────▼─────┐  ┌────▼──────────┐       │
│    │  AI 服务      │  │  数据库服务    │       │
│    │ ai_service.py │  │ db_service.py │       │
│    └───────┬──────┘  └───────────────┘       │
│            │                                  │
│    ┌───────▼──────────┐                      │
│    │  地理编码服务      │                      │
│    │ geocode_service.py│                      │
│    └──────────────────┘                      │
└──────────────┬───────────────────────────────┘
               │
        ┌──────┴──────┐
        ▼             ▼
  ┌──────────┐  ┌───────────┐
  │ DeepSeek │  │ 腾讯地图 API │
  │ API      │  │ (地理编码)  │
  └──────────┘  └───────────┘
```

### 2.2 核心数据流（路线生成）

```
1. 用户填写表单，点击"生成路线"
2. 前端 POST /api/generate（携带偏好 JSON）
3. Flask 路由接收请求
4. ai_service.py 构造 prompt → 调用 DeepSeek API
5. DeepSeek 返回 JSON（路线名 + 途经点名称/描述，无坐标）
6. geocode_service.py 遍历途经点 → 调用腾讯地理编码 API
7. 腾讯地图返回每个地点的 GCJ-02 坐标
8. 组装完整路线数据（含坐标）
9. db_service.py 保存到 SQLite
10. 返回完整路线 JSON 给前端
11. 前端渲染地图标记 + 折线 + 详情卡片
```

---

## 3. 两阶段生成策略

### 3.1 为什么不直接让 AI 返回坐标？

| 问题 | 说明 |
|------|------|
| 坐标幻觉 | LLM 会编造不存在的经纬度数字 |
| GCJ-02 加密 | 中国使用 GCJ-02 加密坐标系，AI 几乎不可能准确输出 |
| 精度不足 | 即使方向对了，偏差几百米在地图上也会显示错误位置 |

### 3.2 两阶段方案

**阶段一：AI 生成内容**
- 输入：用户偏好（城市、主题、时间、预算、特殊需求、描述）
- 输出：结构化 JSON（路线名 + 途经点名称和描述）
- AI 专注于创意内容，不涉及坐标

**阶段二：地理编码**
- 输入：途经点名称 + 城市名
- 输出：GCJ-02 坐标（lat, lng）
- 由腾讯地理编码 API 完成，坐标 100% 准确

### 3.3 兜底策略

- 地理编码失败的地点：跳过，不影响整体路线
- POI 类地点（咖啡馆、博物馆等）：先用地理编码，失败则用腾讯地图 POI 搜索接口
- AI 返回格式错误：自动重试 1 次（追加格式强调）

---

## 4. 项目目录结构

```
AI-CityWalk/
├── CLAUDE.md                    # Claude AI 项目指引
├── README.md                    # 项目说明
├── .gitignore                   # Git 忽略规则
├── dev-log/                     # 开发日志
│   ├── README.md
│   └── YYYY-MM-DD.md
├── docx/                        # 规范文档
│   ├── requirements.md
│   ├── tech-architecture.md
│   ├── design-spec.md
│   ├── api-design.md
│   └── dev-steps.md
├── backend/                     # 后端
│   ├── app.py                   # Flask 主应用
│   ├── config.py                # 配置管理
│   ├── services/
│   │   ├── __init__.py
│   │   ├── ai_service.py        # DeepSeek 调用
│   │   ├── geocode_service.py   # 腾讯地理编码
│   │   └── db_service.py        # SQLite 操作
│   ├── requirements.txt         # Python 依赖
│   └── .env                     # API Keys（不提交 Git）
└── frontend/                    # 前端
    ├── index.html               # 主页面
    ├── css/
    │   └── style.css            # 样式表
    ├── js/
    │   ├── app.js               # 主逻辑
    │   ├── api.js               # API 调用封装
    │   ├── map.js               # 腾讯地图操作
    │   ├── form.js              # 表单逻辑
    │   └── history.js           # 历史记录
    └── assets/                  # 静态资源
```

---

## 5. 数据库设计

### 5.1 SQLite Schema

```sql
CREATE TABLE IF NOT EXISTS routes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    city TEXT NOT NULL,                  -- 城市名
    theme TEXT,                          -- 主题标签
    route_name TEXT,                     -- 路线名称
    summary TEXT,                        -- 路线概述
    waypoints_json TEXT NOT NULL,        -- 完整途经点数据（JSON 字符串）
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 5.2 waypoints_json 格式

```json
[
  {
    "name": "宽窄巷子",
    "category": "历史街区",
    "description": "成都最具代表性的历史文化街区...",
    "stay_minutes": 60,
    "tips": "建议上午10点前到达，人少好拍照",
    "lat": 30.669876,
    "lng": 104.055234
  }
]
```

---

## 6. 依赖清单

### backend/requirements.txt
```
flask==3.0.0
flask-cors==4.0.0
openai==1.12.0
python-dotenv==1.0.0
requests==2.31.0
```

---

## 7. 环境变量

### backend/.env
```
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxx
TENCENT_MAP_KEY=xxxxxxxxxxxxxxxx
```

| 变量 | 用途 | 申请平台 |
|------|------|---------|
| DEEPSEEK_API_KEY | 调用 DeepSeek AI 生成路线 | platform.deepseek.com |
| TENCENT_MAP_KEY | 前端加载腾讯地图 JS API + 后端调用腾讯地理编码 API | lbs.qq.com |
