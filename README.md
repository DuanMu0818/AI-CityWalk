# 🚶 AI CityWalk — 智能城市漫步路线规划

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

👉 **直接访问**：**[ai-citywalk-production.up.railway.app]**（部署后替换为实际地址）

打开网页即可使用，无需安装任何东西！


## 📖 使用指南

1. **选择城市** — 输入你要探索的城市名称
2. **选择主题** — 美食探访 / 历史人文 / 潮流打卡 / 自然风光 / 文艺小巷（可多选）
3. **设置偏好** — 可用时间、体力等级、预算范围
4. **自由描述**（可选）— 用自然语言补充特殊需求，如"想去本地人爱去的店"
5. **点击生成** — AI 为你规划路线并在地图上展示

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 开源协议

本项目基于 [MIT License](LICENSE) 开源，仅供学习和参考使用。

---

<p align="center">
  <sub>Made with ❤️ by <a href="https://github.com/DuanMu0818">DuanMu0818</a></sub>
</p>
