import json
import re
from openai import OpenAI
from config import Config


SYSTEM_PROMPT = """你是 CityWalk 路线规划师。你负责设计路线概念，后端会用真实地图数据填充具体地点。

## 你的任务
为该城市选一个最适合步行的片区（1-2条相邻街道），给出路线主题和需要的地点类型。

## 输出纯JSON（无代码块，waypoints只需要 name 填地点类型关键词，category 填类型）：
{
  "route_name": "沿武康路的漫步",
  "area": "武康路-安福路",
  "city": "上海",
  "summary": "从武康大楼出发沿武康路向北走，途经咖啡馆、书店、面包店，到安福路结束",
  "walking_distance_km": 3.5,
  "waypoints": [
    {"name": "咖啡馆", "category": "咖啡馆", "description": "有特色手冲咖啡", "stay_minutes": 40, "tips": ""},
    {"name": "书店", "category": "书店", "description": "有阅读空间", "stay_minutes": 50, "tips": ""},
    {"name": "面馆", "category": "美食", "description": "本地人推荐的面馆", "stay_minutes": 30, "tips": ""},
    {"name": "历史建筑", "category": "历史街区", "description": "有故事的老建筑", "stay_minutes": 30, "tips": ""},
    {"name": "小酒馆", "category": "美食", "description": "适合小酌", "stay_minutes": 45, "tips": ""}
  ]
}
注意：category 和 name 都必须是可以直接在腾讯地图搜索的关键词，不要用"独立""特色"等修饰词。

## 规则
- area 必须是真实存在的步行街区（如"镋钯街-崇德里""五道营胡同-国子监""东山口"）
- waypoints 每个对象填地点类型关键词（不是具体店名！），category 从：咖啡馆/书店/美食/历史街区/公园/博物馆/艺术馆/购物/文化遗址 中选择
- 半天 3-4 个 / 全天 5-6 个 / 暴走 6-8 个
- summary 要描述具体的步行路线走向"""


class AIService:
    def __init__(self):
        self.client = OpenAI(
            api_key=Config.DEEPSEEK_API_KEY,
            base_url=Config.DEEPSEEK_BASE_URL,
        )
        self.model = Config.DEEPSEEK_MODEL

    def generate_route(self, preferences):
        user_prompt = self._build_user_prompt(preferences)

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.7,
                max_tokens=4096,
                timeout=60,
            )

            content = response.choices[0].message.content
            if not content:
                raise ValueError("AI 返回了空内容，可能被内容过滤器拦截")
            ai_text = content.strip()
            route_data = self._parse_json(ai_text)

            if route_data is None:
                route_data = self._retry(user_prompt)

            return route_data

        except Exception as e:
            print(f"[AI Service] DeepSeek API 调用失败: {e}")
            raise

    def _build_user_prompt(self, prefs):
        city = prefs.get("city", "")
        theme = prefs.get("theme", "不限")
        time_energy = prefs.get("time_energy", "由你自行判断")
        budget = prefs.get("budget", "不限")
        special_needs = prefs.get("special_needs", [])
        description = prefs.get("description", "")
        user_lat = prefs.get("user_lat")
        user_lng = prefs.get("user_lng")

        parts = [f"城市：{city}"]
        if theme:
            parts.append(f"主题风格：{theme}")
        if time_energy:
            parts.append(f"时间体力：{time_energy}")
        if budget:
            parts.append(f"预算：{budget}")
        if special_needs:
            parts.append(f"特殊需求：{'、'.join(special_needs)}")
        if description:
            parts.append(f"补充描述：{description}")

        # 位置感知：同城→用户周边，异城→市中心
        if user_lat and user_lng:
            parts.append(f"\n用户当前坐标：({user_lat}, {user_lng})。请在该坐标周边 2 公里范围内选择步行片区规划路线。")
        else:
            parts.append(f"\n请选择{city}市中心最繁华、最适合步行的街区（如商业步行街、历史文化街区）作为路线片区。")

        parts.append("记住：选一个具体小片区，不走回头路。只返回JSON。")
        return "\n".join(parts)

    def _parse_json(self, text):
        try:
            data = json.loads(text)
            if self._validate_route(data):
                return data
        except json.JSONDecodeError:
            pass

        m = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
        if m:
            try:
                data = json.loads(m.group(1))
                if self._validate_route(data):
                    return data
            except json.JSONDecodeError:
                pass

        m = re.search(r"\{[\s\S]*?\}", text)
        if m:
            try:
                data = json.loads(m.group(0))
                if self._validate_route(data):
                    return data
            except json.JSONDecodeError:
                pass

        print(f"[AI Service] JSON 解析失败，前200字符: {text[:200]}")
        return None

    def _validate_route(self, data):
        if not isinstance(data, dict):
            return False
        if 'waypoints' not in data or not isinstance(data['waypoints'], list) or len(data['waypoints']) == 0:
            return False
        for wp in data['waypoints']:
            if not isinstance(wp, dict) or 'name' not in wp or not wp['name']:
                return False
        return True

    def _retry(self, user_prompt):
        retry_prompt = user_prompt + "\n\n【重要】只返回纯 JSON，不要 ``` 包裹。"
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": retry_prompt},
                ],
                temperature=0.5,
                max_tokens=4096,
                timeout=60,
            )
            content = response.choices[0].message.content
            if not content:
                raise ValueError("AI 返回了空内容，可能被内容过滤器拦截")
            ai_text = content.strip()
            route_data = self._parse_json(ai_text)
            if route_data is None:
                raise ValueError("AI 返回格式异常，重试后仍无法解析 JSON")
            return route_data
        except Exception as e:
            print(f"[AI Service] 重试失败: {e}")
            raise
