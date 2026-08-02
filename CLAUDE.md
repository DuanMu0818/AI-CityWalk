# AI CityWalk — 智能行程规划系统

## 项目简介

基于大语言模型（DeepSeek）和地图数据（腾讯地图）的智能 CityWalk 路线规划 Web 应用。用户用自然语言描述偏好，AI 生成空间合理、主题鲜明的漫步路线并在地图上可视化展示。

## 技术栈

| 层次 | 技术 |
|------|------|
| 前端 | HTML + CSS + JavaScript（单页应用） |
| 地图 | 腾讯地图 JS API GL |
| 后端 | Python 3.11 + Flask |
| AI | DeepSeek API（OpenAI 兼容格式） |
| 地理编码 | 腾讯地图 Web Service API |
| 数据库 | SQLite |

## 规范文档索引

| 文档 | 路径 | 说明 |
|------|------|------|
| 功能需求规格书 | `docx/requirements.md` | 完整的功能需求定义 |
| 技术架构设计 | `docx/tech-architecture.md` | 系统架构、数据流、技术选型 |
| UI/UX 设计规范 | `docx/design-spec.md` | 视觉设计、布局、组件、动效 |
| API 接口设计 | `docx/api-design.md` | 后端 API 端点定义 |
| 开发执行步骤 | `docx/dev-steps.md` | 分阶段开发计划和验收标准 |

## 开发日志

路径：`dev-log/`

每次开发结束后更新日志，记录：
- ✅ 当日完成的事项
- 📋 待办事项
- 📝 备注和问题

## 工作规范

### 开发节奏
- **每次只做 1-2 个小步骤**，完成后验证通过再继续，不贪多
- **每次开发结束必须更新 dev-log**
- **遇到不确定的地方先问用户**，不擅自做重大决定

### 编码规范
- 代码写**中文注释**，方便初学者理解
- 变量和函数命名使用英文，但注释用中文
- 每个文件开头注明文件用途
- 函数/方法添加简要说明

### 项目结构
```
AI-CityWalk/
├── CLAUDE.md           # 本文件（项目指引）
├── README.md           # 项目使用说明
├── .gitignore          # Git 忽略规则
├── dev-log/            # 开发日志
├── docx/               # 规范文档
├── backend/            # 后端代码
│   ├── app.py
│   ├── config.py
│   ├── services/
│   ├── requirements.txt
│   └── .env
└── frontend/           # 前端代码
    ├── index.html
    ├── css/
    └── js/
```

## 当前开发阶段

**阶段：文档搭建完成 → 等待用户申请 API Key → Phase 1 后端基础**

- [x] 需求确认
- [x] 项目管理基础搭建（CLAUDE.md + dev-log + docx）
- [ ] 用户申请 API Key（DeepSeek + 腾讯地图）
- [ ] Phase 1：后端基础（Flask + SQLite）
- [ ] Phase 2：AI 路线生成 + 地理编码
- [ ] Phase 3：前端页面
- [ ] Phase 4：历史记录
- [ ] Phase 5：联调优化 + 文档
