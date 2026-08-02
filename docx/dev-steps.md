# 开发执行步骤

## 开发节奏原则

> **每次只做 1-2 个小步骤，验证通过后再继续。不贪多，求稳。**

每个步骤完成后，都要：
1. 运行验证命令，确认功能正常
2. 更新 `dev-log/` 中的当天日志
3. 如果有问题，先修复再继续下一步

---

## Phase 1：后端基础搭建

### 步骤 1.1：安装依赖

**操作**：
- 创建 `backend/` 目录
- 编写 `backend/requirements.txt`
- 执行 `pip install -r requirements.txt`

**验证**：
```bash
pip list | grep -E "flask|openai|dotenv|requests"
```
确认 5 个包都已安装。

---

### 步骤 1.2：配置文件

**操作**：
- 编写 `backend/config.py`（从 .env 读取 3 个 Key）
- 创建 `backend/.env`（填入实际的 API Key）
- 创建 `backend/services/__init__.py`（空文件）

**验证**：
```bash
cd backend && python -c "from config import Config; print(Config.DEEPSEEK_API_KEY[:5])"
```
确认能读到 Key 的前 5 位。

---

### 步骤 1.3：Flask 应用骨架

**操作**：
- 编写 `backend/app.py`（Flask 初始化 + CORS + 路由骨架 + `/api/config`）

**验证**：
```bash
cd backend && python app.py
```
浏览器访问 `http://localhost:5000/api/config`，确认返回 `{"tencent_map_key": "xxx"}`。

---

### 步骤 1.4：数据库服务

**操作**：
- 编写 `backend/services/db_service.py`（SQLite 建表 + CRUD）

**验证**：
```bash
cd backend && python -c "
from services.db_service import DBService
db = DBService()
db.init_db()
print('数据库初始化成功')
routes = db.get_routes()
print(f'当前路线数：{len(routes)}')
"
```

---

## Phase 2：AI 路线生成 + 地理编码

### 步骤 2.1：AI 服务

**操作**：
- 编写 `backend/services/ai_service.py`（DeepSeek 调用 + 系统提示词 + JSON 解析）

**验证**：
```bash
cd backend && python -c "
from services.ai_service import AIService
ai = AIService()
result = ai.generate_route({'city': '成都', 'theme': '美食之旅'})
print(result['route_name'])
print(f'途经点数：{len(result[\"waypoints\"])}')
for wp in result['waypoints']:
    print(f'  - {wp[\"name\"]}')
"
```
确认 AI 返回了路线数据，途经点有名称和描述。

---

### 步骤 2.2：地理编码服务

**操作**：
- 编写 `backend/services/geocode_service.py`（腾讯地理编码 + POI 搜索备选）

**验证**：
```bash
cd backend && python -c "
from services.geocode_service import GeocodeService
geo = GeocodeService()
result = geo.geocode('宽窄巷子', '成都')
print(f'lat={result[\"lat\"]}, lng={result[\"lng\"]}')
"
```
确认返回了有效的 GCJ-02 坐标。

---

### 步骤 2.3：串联生成接口

**操作**：
- 在 `app.py` 中完善 `/api/generate` 路由（AI → 地理编码 → 数据库保存 → 返回）

**验证**：
```bash
curl -X POST http://localhost:5000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"city":"成都","theme":"美食之旅","time_energy":"半天轻松逛"}'
```
确认返回完整 JSON，每个途经点都有 lat/lng 坐标。

---

## Phase 3：前端页面

### 步骤 3.1：HTML 结构

**操作**：
- 创建 `frontend/` 目录结构（css/、js/、assets/）
- 编写 `frontend/index.html`（页面骨架 + 腾讯地图加载占位）

**验证**：用浏览器打开 `index.html`，确认页面结构正确渲染。

---

### 步骤 3.2：CSS 样式

**操作**：
- 编写 `frontend/css/style.css`（完整样式 + 等待动画 @keyframes + 响应式）

**验证**：刷新浏览器，确认样式正确、响应式断点生效。

---

### 步骤 3.3：表单模块

**操作**：
- 编写 `frontend/js/form.js`（表单控件渲染 + 数据收集 + 验证）

**验证**：打开页面，点击各胶囊按钮确认交互正常，提交时能收集到数据。

---

### 步骤 3.4：API 调用模块

**操作**：
- 编写 `frontend/js/api.js`（封装所有后端 API 调用）

**验证**：在浏览器控制台手动调用 `API.generateRoute({...})`，确认能收到数据。

---

### 步骤 3.5：地图模块

**操作**：
- 编写 `frontend/js/map.js`（腾讯地图动态加载 + 标记 + 折线 + InfoWindow）

**验证**：确认地图加载成功，手动调用 `Map.displayRoute(testData)` 能看到标记和折线。

---

### 步骤 3.6：主逻辑串联

**操作**：
- 编写 `frontend/js/app.js`（初始化 + 表单提交 → API 调用 → 等待动画 → 地图渲染 → 卡片展示）

**验证**：完整流程测试 — 填写表单 → 点击生成 → 看到动画 → 地图显示路线 → 卡片展示详情。

---

## Phase 4：历史记录

### 步骤 4.1：历史模块

**操作**：
- 编写 `frontend/js/history.js`（侧滑抽屉 + 列表渲染 + 路线回显 + 删除确认）

**验证**：
1. 生成一条路线
2. 打开历史面板，确认路线出现在列表中
3. 刷新页面，再次打开历史面板，确认路线仍在
4. 点击历史路线，确认地图和卡片正确显示
5. 删除一条路线，确认列表中消失

---

## Phase 5：联调优化

### 步骤 5.1：多场景测试

**操作**：
- 测试不同城市：北京、上海、广州、成都、杭州、西安
- 测试不同主题：文艺范、美食之旅、历史探秘
- 测试不同时间偏好：半天、一整天、暴走

**验证**：所有组合都能正常生成路线、地图正确显示。

---

### 步骤 5.2：错误处理

**操作**：
- 断网测试，确认显示友好错误提示
- 不填城市直接提交，确认表单验证生效
- 后端停掉，确认前端显示连接错误提示

---

### 步骤 5.3：移动端适配

**操作**：
- 浏览器窗口缩到 375px，检查布局
- 检查地图在移动端的交互
- 检查卡片在移动端的显示

---

### 步骤 5.4：最终优化

**操作**：
- 优化加载速度
- 完善注释
- 更新 README.md

---

## 时间估算（初学者参考）

| Phase | 预计时间 | 说明 |
|-------|---------|------|
| Phase 1 | 1-2 小时 | 后端基础，比较简单 |
| Phase 2 | 2-3 小时 | 核心功能，需要调试 |
| Phase 3 | 4-6 小时 | 前端工作量大，可分 2-3 次完成 |
| Phase 4 | 1-2 小时 | 历史功能，相对简单 |
| Phase 5 | 2-3 小时 | 测试和优化 |
| **总计** | **10-16 小时** | 建议分 3-5 天完成 |
