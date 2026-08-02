# API 接口设计文档

## 基础信息

- **基础 URL**：`http://localhost:5000`
- **数据格式**：JSON
- **编码**：UTF-8
- **跨域**：通过 Flask-CORS 允许所有来源

---

## 1. 获取前端配置

### `GET /api/config`

返回腾讯地图 JS API Key，供前端动态加载地图使用。

**请求**：无参数

**成功响应** `200 OK`：
```json
{
  "tencent_map_key": "你的腾讯地图Key"
}
```

**错误响应** `500 Internal Server Error`：
```json
{
  "error": "配置加载失败"
}
```

---

## 2. 生成路线

### `POST /api/generate`

接收用户偏好，调用 AI 生成路线，地理编码获取坐标，保存到数据库。

**请求头**：
```
Content-Type: application/json
```

**请求体**：
```json
{
  "city": "成都",
  "theme": "美食之旅",
  "time_energy": "半天轻松逛",
  "budget": "学生党平价",
  "special_needs": ["适合拍照", "有咖啡馆休息"],
  "description": "想吃地道川菜，喜欢老建筑"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| city | string | ✅ | 城市名称 |
| theme | string | ❌ | 主题风格 |
| time_energy | string | ❌ | 时间/体力偏好 |
| budget | string | ❌ | 预算偏好 |
| special_needs | string[] | ❌ | 特殊需求数组 |
| description | string | ❌ | 自由描述 |

**成功响应** `200 OK`：
```json
{
  "id": 1,
  "route_name": "舌尖上的蓉城漫步",
  "theme": "美食之旅",
  "city": "成都",
  "summary": "从宽窄巷子出发，穿越老成都街巷，品味地道川菜和小吃，在文艺咖啡馆歇脚，最后到锦里感受夜市烟火气。",
  "waypoints": [
    {
      "name": "宽窄巷子",
      "category": "历史街区",
      "description": "成都最具代表性的历史文化街区，青砖灰瓦的清代建筑间藏着各种小吃和手工艺店。",
      "stay_minutes": 60,
      "tips": "建议上午10点前到达，人少好拍照。推荐三大炮和龙抄手。",
      "lat": 30.669876,
      "lng": 104.055234
    },
    {
      "name": "人民公园",
      "category": "公园",
      "description": "成都人最爱的休闲场所，鹤鸣茶社喝一碗盖碗茶，感受最地道的成都慢生活。",
      "stay_minutes": 45,
      "tips": "鹤鸣茶社的竹椅位置很抢手，建议早点去。",
      "lat": 30.663421,
      "lng": 104.058912
    }
  ],
  "created_at": "2026-07-28T14:30:00"
}
```

**错误响应**：

`400 Bad Request`（参数缺失）：
```json
{
  "error": "城市名称不能为空"
}
```

`500 Internal Server Error`（AI 生成失败）：
```json
{
  "error": "路线生成失败，请稍后重试"
}
```

`504 Gateway Timeout`（AI 超时）：
```json
{
  "error": "AI 响应超时，请稍后重试"
}
```

---

## 3. 获取历史路线列表

### `GET /api/history`

返回所有历史路线的摘要信息。

**请求**：无参数

**成功响应** `200 OK`：
```json
{
  "routes": [
    {
      "id": 1,
      "city": "成都",
      "theme": "美食之旅",
      "route_name": "舌尖上的蓉城漫步",
      "summary": "从宽窄巷子出发...",
      "waypoint_count": 4,
      "created_at": "2026-07-28T14:30:00"
    },
    {
      "id": 2,
      "city": "北京",
      "theme": "历史探秘",
      "route_name": "皇城根下的时光漫步",
      "summary": "从故宫出发...",
      "waypoint_count": 5,
      "created_at": "2026-07-27T10:15:00"
    }
  ]
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int | 路线 ID |
| city | string | 城市名 |
| theme | string | 主题 |
| route_name | string | 路线名称 |
| summary | string | 路线概述 |
| waypoint_count | int | 途经点数量 |
| created_at | string | 创建时间（ISO 8601） |

---

## 4. 获取单条路线详情

### `GET /api/history/<id>`

返回指定路线的完整信息（含途经点坐标）。

**路径参数**：
| 参数 | 类型 | 说明 |
|------|------|------|
| id | int | 路线 ID |

**成功响应** `200 OK`：
```json
{
  "id": 1,
  "route_name": "舌尖上的蓉城漫步",
  "theme": "美食之旅",
  "city": "成都",
  "summary": "从宽窄巷子出发...",
  "waypoints": [
    {
      "name": "宽窄巷子",
      "category": "历史街区",
      "description": "...",
      "stay_minutes": 60,
      "tips": "...",
      "lat": 30.669876,
      "lng": 104.055234
    }
  ],
  "created_at": "2026-07-28T14:30:00"
}
```

**错误响应** `404 Not Found`：
```json
{
  "error": "路线不存在"
}
```

---

## 5. 删除历史路线

### `DELETE /api/history/<id>`

删除指定的历史路线。

**路径参数**：
| 参数 | 类型 | 说明 |
|------|------|------|
| id | int | 路线 ID |

**成功响应** `200 OK`：
```json
{
  "message": "删除成功"
}
```

**错误响应** `404 Not Found`：
```json
{
  "error": "路线不存在"
}
```

---

## 6. 错误码汇总

| HTTP 状态码 | 含义 | 场景 |
|-------------|------|------|
| 200 | 成功 | 所有正常请求 |
| 400 | 请求参数错误 | 城市为空、JSON 格式错误 |
| 404 | 资源不存在 | 查询/删除不存在的路线 ID |
| 500 | 服务器内部错误 | AI 调用失败、地理编码异常、数据库错误 |
| 504 | 网关超时 | DeepSeek API 响应超时（>60s） |
