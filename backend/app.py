"""
AI CityWalk — Flask 后端主应用
提供路线生成、历史记录管理、前端配置等 API 接口

启动方式：python app.py
默认运行在 http://localhost:5000
"""

import sys
import io

# 修复 Windows 终端 GBK 编码下 emoji 打印报错的问题
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

import os
import math
import time
from collections import defaultdict
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from config import Config
from services.ai_service import AIService
from services.geocode_service import GeocodeService
from services.db_service import DBService


def haversine_km(lat1, lng1, lat2, lng2):
    """计算两点之间的球面距离（km）"""
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))


def find_largest_cluster(waypoints, radius_km=1.5):
    """
    找出最大密集聚类，只保留相互之间距离在 radius_km 内的地点。
    返回属于最大聚类的途经点列表（保持原始顺序）。
    """
    n = len(waypoints)
    if n <= 2:
        return waypoints, []

    # 建图：距离在阈值内的点之间有边
    neighbors = {i: [] for i in range(n)}
    for i in range(n):
        for j in range(i+1, n):
            a, b = waypoints[i], waypoints[j]
            if a.get('lat') and a.get('lng') and b.get('lat') and b.get('lng'):
                d = haversine_km(a['lat'], a['lng'], b['lat'], b['lng'])
                if d <= radius_km:
                    neighbors[i].append(j)
                    neighbors[j].append(i)

    # 找最大连通分量
    visited = set()
    best_cluster = []
    for i in range(n):
        if i not in visited:
            # BFS
            stack = [i]
            cluster = []
            while stack:
                node = stack.pop()
                if node in visited:
                    continue
                visited.add(node)
                cluster.append(node)
                for nb in neighbors[node]:
                    if nb not in visited:
                        stack.append(nb)
            if len(cluster) > len(best_cluster):
                best_cluster = cluster

    if len(best_cluster) >= 2:
        idx_set = set(best_cluster)
        kept = [wp for i, wp in enumerate(waypoints) if i in idx_set]
        removed = [waypoints[i].get('name','?') for i in range(n) if i not in idx_set]
        return kept, removed
    return waypoints, []


def enforce_walking_distance(waypoints, max_gap_km=2.0, min_waypoints=2):
    """
    过滤间距过大的途经点。相邻两点距离 > max_gap_km 的移除较远的那个。
    返回 (filtered_waypoints, removed_names)
    """
    if len(waypoints) <= min_waypoints:
        return waypoints, []

    filtered = [waypoints[0]]
    removed = []

    for i in range(1, len(waypoints)):
        curr = waypoints[i]
        orig_prev = waypoints[i-1]  # 只和原始前一个点比较
        if orig_prev.get('lat') is not None and orig_prev.get('lng') is not None and curr.get('lat') is not None and curr.get('lng') is not None:
            dist = haversine_km(orig_prev['lat'], orig_prev['lng'], curr['lat'], curr['lng'])
            if dist > max_gap_km:
                removed.append(f"{curr.get('name','?')}(距{orig_prev.get('name','?')}{dist:.1f}km)")
                continue
        filtered.append(curr)

    if len(filtered) < min_waypoints:
        return filtered, removed

    return filtered, removed

# 初始化 Flask 应用
# 静态文件目录指向前端文件夹
frontend_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend")
app = Flask(__name__, static_folder=frontend_dir, static_url_path="")
CORS(app, origins=[os.getenv("CORS_ORIGIN", "http://localhost:5000")])

# 初始化服务
ai_service = AIService()
geocode_service = GeocodeService()
db_service = DBService()


# ============================================================
# 辅助函数
# ============================================================

# 简易速率限制器
_rate_limits = defaultdict(list)

def _check_rate_limit(key, max_requests=5, window=60):
    """限制每个 key 在 window 秒内最多 max_requests 次请求"""
    now = time.time()
    _rate_limits[key] = [t for t in _rate_limits[key] if now - t < window]
    if len(_rate_limits[key]) >= max_requests:
        return False
    _rate_limits[key].append(now)
    return True


def _error_response(message, status_code=500):
    """构造统一的错误响应（生产模式下隐藏详细信息）"""
    if not Config.DEBUG and status_code == 500:
        message = "服务内部错误，请稍后重试"
    return jsonify({"error": message}), status_code


# ============================================================
# 前端页面路由
# ============================================================

@app.route("/")
def index():
    """返回前端主页面"""
    return send_from_directory(app.static_folder, "index.html")


# ============================================================
# API 路由
# ============================================================

@app.route("/api/config", methods=["GET"])
def get_config():
    """
    返回前端配置信息，包括腾讯地图 JS API Key
    前端通过此接口动态获取 Key，避免硬编码在 HTML 中
    """
    try:
        return jsonify({"tencent_map_key": Config.TENCENT_MAP_KEY})
    except Exception as e:
        return _error_response(f"配置加载失败: {str(e)}")


@app.route("/api/locate", methods=["GET"])
def locate_city():
    """
    获取用户当前城市
    - 有 lat/lng 参数时：使用 GPS 坐标反向地理编码
    - 无参数时：使用 IP 定位（兜底方案）
    返回: {city, province, district, address?, lat, lng}
    """
    try:
        lat = request.args.get("lat")
        lng = request.args.get("lng")

        if lat and lng:
            # 方式一：GPS 坐标反向地理编码
            lat = float(lat)
            lng = float(lng)

            # 校验坐标范围
            if not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
                return _error_response("坐标超出有效范围", 400)

            location = geocode_service.reverse_geocode(lat, lng)
            if location is None:
                return _error_response("未能识别当前位置的城市信息", 500)

            return jsonify(location)
        else:
            # 方式二：IP 定位（无参数时自动使用请求来源 IP）
            print("[API] 无 GPS 坐标，使用 IP 定位...")
            location = geocode_service.ip_location()
            if location is None:
                return _error_response("IP 定位失败，请手动输入城市", 500)

            print(f"[API] IP 定位结果: {location.get('city', '未知')} ({location.get('province', '')})")
            return jsonify(location)

    except ValueError:
        return _error_response("坐标参数格式错误", 400)
    except Exception as e:
        print(f"[API] 定位失败: {e}")
        return _error_response(f"定位失败: {str(e)}", 500)


@app.route("/api/generate", methods=["POST"])
def generate_route():
    """
    生成 CityWalk 路线（核心接口）

    流程：
    1. 接收用户偏好
    2. 调用 DeepSeek AI 生成路线（地点名 + 描述）
    3. 调用腾讯地图地理编码为每个地点获取 GCJ-02 坐标
    4. 保存到 SQLite 数据库
    5. 返回完整路线数据

    请求体 JSON 示例：
    {
        "city": "成都",
        "theme": "美食之旅",
        "time_energy": "半天轻松逛",
        "budget": "学生党平价",
        "special_needs": ["适合拍照"],
        "description": "想吃地道川菜"
    }
    """
    try:
        # 速率限制（每 IP 每分钟 5 次）
        client_ip = request.remote_addr or "unknown"
        if not _check_rate_limit(f"gen:{client_ip}", max_requests=5, window=60):
            return _error_response("请求过于频繁，请稍后再试", 429)

        # 1. 解析请求参数
        data = request.get_json(silent=True)
        if not data:
            return _error_response("请求体不能为空", 400)

        city = data.get("city", "").strip()
        if not city:
            return _error_response("城市名称不能为空", 400)

        preferences = {
            "city": city,
            "theme": data.get("theme", ""),
            "time_energy": data.get("time_energy", ""),
            "budget": data.get("budget", ""),
            "special_needs": data.get("special_needs", []),
            "description": data.get("description", ""),
            "user_lat": data.get("user_lat"),
            "user_lng": data.get("user_lng"),
        }

        # 2. 调用 AI 生成路线概念（片区+地点类型，非具体店名）
        print(f"\n[API] 开始生成路线概念，城市: {city}, 主题: {preferences['theme']}")
        route_data = ai_service.generate_route(preferences)
        concept_waypoints = route_data.get("waypoints", [])
        area = route_data.get("area", "")
        print(f"[API] AI 概念生成: {route_data.get('route_name')}, 片区: {area}, {len(concept_waypoints)} 个类型")

        # 3. 确定搜索中心：优先用用户坐标（同城），其次用片区地理编码
        user_lat = preferences.get("user_lat")
        user_lng = preferences.get("user_lng")
        search_center = None

        if user_lat and user_lng:
            # 用反向地理编码判断用户是否在目标城市
            user_location = geocode_service.reverse_geocode(user_lat, user_lng)
            if user_location and user_location.get("city") == city:
                search_center = {"lat": user_lat, "lng": user_lng}
                print(f"[API] 🎯 用户在{city}，直接以用户坐标({user_lat:.4f},{user_lng:.4f})为中心搜索")
            else:
                user_city = user_location.get('city','?') if user_location else '?'
                print(f"[API] 用户在{user_city}，目标城市{city}，需要地理编码片区...")

        if not search_center:
            # 地理编码片区名
            for addr in [f"{city}{area}", f"{city}市{area}", area, city]:
                if addr:
                    search_center = geocode_service.geocode_center(addr)
                    if search_center:
                        print(f"[API] 片区中心({addr}) → ({search_center['lat']:.4f}, {search_center['lng']:.4f})")
                        break

        if not search_center:
            return _error_response(f"无法定位'{city} {area}'，请尝试更具体的城市或片区名称", 500)

        if concept_waypoints:
            print(f"[API] 搜索中心: ({search_center['lat']:.4f}, {search_center['lng']:.4f})，搜索POI...")

            # 第一步：为每个类别搜到所有结果
            all_pois = []  # [{poi_data, category, description, stay_minutes, tips}]
            for wp in concept_waypoints:
                cat = wp.get("category") or wp.get("name") or "景点"
                kw = cat  # 直接用大类（咖啡馆、书店等）
                pois = geocode_service.search_nearby_pois(
                    search_center['lat'], search_center['lng'], kw, radius=1000
                )
                valid = [p for p in pois if p.get('name') and p.get('distance', 9999) < 2000]
                if valid:
                    for p in valid:
                        all_pois.append({**p, "_cat": cat, "_desc": wp.get("description",""), "_stay": wp.get("stay_minutes",40), "_tips": wp.get("tips","")})
                    print(f"[API] {cat}: 找到 {len(valid)} 个 ({valid[0]['name']} {valid[0].get('distance','?')}m)")
                else:
                    print(f"[API] ❌ {cat}: 无结果")

            # 第二步：所有结果按距离排序，取最近的 N 个（N=waypoint数量），跨类别不重复
            all_pois.sort(key=lambda x: x.get('distance', 9999))
            seen_names = set()
            seen_cats = set()
            real_waypoints = []
            for p in all_pois:
                if p['name'] in seen_names: continue
                if p['_cat'] in seen_cats: continue  # 每个类别只取一个
                seen_names.add(p['name'])
                seen_cats.add(p['_cat'])
                real_waypoints.append({
                    "name": p['name'],
                    "category": p['_cat'],
                    "description": p['_desc'],
                    "stay_minutes": p['_stay'],
                    "tips": p['_tips'],
                    "lat": p['lat'],
                    "lng": p['lng'],
                })
                print(f"[API] ✅ #{len(real_waypoints)} {p['_cat']} → {p['name']} ({p.get('distance','?')}m)")
                if len(real_waypoints) >= len(concept_waypoints):
                    break

            if real_waypoints:
                # 过滤重复坐标
                seen_coords = set()
                unique = []
                for wp in real_waypoints:
                    key = (round(wp['lat'], 5), round(wp['lng'], 5))
                    if key not in seen_coords:
                        seen_coords.add(key)
                        unique.append(wp)
                route_data["waypoints"] = unique
                print(f"[API] 真实POI路线: {len(unique)} 个地点")
            else:
                # POI 搜索全失败，回退到地理编码
                print(f"[API] POI 搜索无结果，回退地理编码...")
                geocoded, failed = geocode_service.geocode_waypoints(concept_waypoints, f"{city}{area}")
                route_data["waypoints"] = [wp for wp in geocoded if wp.get("lat") is not None]
        else:
            # 无片区中心，回退地理编码
            if concept_waypoints:
                geocoded, failed = geocode_service.geocode_waypoints(concept_waypoints, city)
                route_data["waypoints"] = [wp for wp in geocoded if wp.get("lat") is not None]

        waypoints = route_data.get("waypoints", [])
        if not waypoints:
            return _error_response("未能找到合适的地点，请尝试其他城市或主题", 500)

        # 4. 保存到数据库
        route_id = db_service.save_route(route_data)
        route_data["id"] = route_id
        print(f"[API] 路线已保存，ID: {route_id}")

        # 5. 返回完整路线
        return jsonify(route_data)

    except ValueError as e:
        print(f"[API] 参数错误: {e}")
        return _error_response(str(e), 400)
    except Exception as e:
        print(f"[API] 生成路线失败: {e}")
        error_msg = str(e)
        if "timeout" in error_msg.lower() or "timed out" in error_msg.lower():
            return _error_response("AI 响应超时，请稍后重试", 504)
        return _error_response(f"路线生成失败: {error_msg}", 500)


@app.route("/api/directions/walking", methods=["GET"])
def get_walking_directions():
    """
    获取两点之间的步行路径规划
    参数: from_lat, from_lng, to_lat, to_lng
    返回: {distance(米), duration(分钟), path: [{lat,lng}]}
    """
    try:
        from_lat = request.args.get("from_lat")
        from_lng = request.args.get("from_lng")
        to_lat = request.args.get("to_lat")
        to_lng = request.args.get("to_lng")

        if not all([from_lat, from_lng, to_lat, to_lng]):
            return _error_response("缺少坐标参数", 400)

        result = geocode_service.get_walking_direction(
            float(from_lat), float(from_lng),
            float(to_lat), float(to_lng)
        )

        if result is None:
            return _error_response("步行路径规划失败", 500)

        return jsonify(result)

    except ValueError:
        return _error_response("坐标参数格式错误", 400)
    except Exception as e:
        return _error_response(f"路径规划失败: {str(e)}", 500)


@app.route("/api/weather", methods=["GET"])
def get_weather():
    """代理 wttr.in 获取天气，避免前端编码问题"""
    try:
        city = request.args.get("city", "").strip()
        if not city:
            return _error_response("缺少城市参数", 400)

        import urllib.request
        url = f"https://wttr.in/{urllib.request.quote(city)}?format=%C|%t"
        req = urllib.request.Request(url, headers={"User-Agent": "curl"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            text = resp.read().decode("utf-8").strip()

        if not text or "Unknown" in text:
            return _error_response("天气数据不可用", 500)

        parts = text.split("|")
        return jsonify({
            "condition": parts[0].strip() if len(parts) > 0 else "",
            "temperature": parts[1].strip() if len(parts) > 1 else "",
        })
    except Exception as e:
        return _error_response(f"天气获取失败: {str(e)}", 500)


@app.route("/api/history", methods=["GET"])
def get_history():
    """
    获取历史路线列表（支持分页和搜索）
    参数: page(默认1), limit(默认20), search(可选，模糊匹配城市/主题/路线名)
    """
    try:
        page = max(1, request.args.get("page", 1, type=int))
        limit = min(100, max(1, request.args.get("limit", 20, type=int)))
        search = request.args.get("search", "").strip()
        routes, total = db_service.get_routes(page, limit, search)
        return jsonify({"routes": routes, "total": total, "page": page, "limit": limit})
    except Exception as e:
        return _error_response(f"获取历史记录失败: {str(e)}")


@app.route("/api/poi/nearby", methods=["GET"])
def search_nearby():
    """
    搜索指定坐标周边的 POI
    参数: lat, lng, keyword(可选), radius(默认1000米)
    """
    try:
        lat = request.args.get("lat", type=float)
        lng = request.args.get("lng", type=float)
        keyword = request.args.get("keyword", "")
        radius = request.args.get("radius", 1000, type=int)

        if lat is None or lng is None:
            return _error_response("缺少坐标参数", 400)

        results = geocode_service.search_nearby(lat, lng, keyword, radius)
        return jsonify({"pois": results})
    except Exception as e:
        return _error_response(f"POI 搜索失败: {str(e)}")


@app.route("/api/history/<int:route_id>", methods=["GET"])
def get_route_detail(route_id):
    """
    获取单条路线完整详情（含所有途经点坐标）
    用于历史记录中点击回看路线
    """
    try:
        route = db_service.get_route(route_id)
        if route is None:
            return _error_response("路线不存在", 404)
        return jsonify(route)
    except Exception as e:
        return _error_response(f"获取路线详情失败: {str(e)}")


@app.route("/api/history/<int:route_id>", methods=["DELETE"])
def delete_route(route_id):
    """
    删除一条历史路线
    """
    try:
        success = db_service.delete_route(route_id)
        if not success:
            return _error_response("路线不存在", 404)
        return jsonify({"message": "删除成功"})
    except Exception as e:
        return _error_response(f"删除失败: {str(e)}")


# ============================================================
# 启动
# ============================================================

if __name__ == "__main__":
    # 启动前验证配置
    missing_keys = Config.validate()
    if missing_keys:
        print(f"⚠️ 警告：以下 API Key 未配置: {', '.join(missing_keys)}")
        print("请在 backend/.env 文件中填入对应的 Key")
        print(f"当前 DEEPSEEK_API_KEY: {'已配置 ✅' if Config.DEEPSEEK_API_KEY else '未配置 ❌'}")
        print(f"当前 TENCENT_MAP_KEY: {'已配置 ✅' if Config.TENCENT_MAP_KEY else '未配置 ❌'}")
    else:
        print("✅ 所有 API Key 已配置")

    print(f"\n🚶 AI CityWalk 后端启动中...")
    print(f"📍 访问 http://localhost:5000")
    print(f"📋 API 文档: docx/api-design.md")
    print(f"🔑 /api/config - 获取腾讯地图 Key")
    print(f"🤖 /api/generate - 生成路线")
    print(f"📚 /api/history - 历史路线\n")

    port = int(os.getenv("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=Config.DEBUG)
