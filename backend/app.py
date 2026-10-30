from __future__ import annotations

import io
import math
import os
import sys
import time
import urllib.request
from collections import defaultdict
from typing import Any, Dict, List, Optional, Tuple, Union

from flask import Flask, Response, jsonify, request, send_from_directory
from flask_cors import CORS

from config import Config
from services.ai_service import AIService
from services.db_service import DBService
from services.geocode_service import GeocodeService

if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

Waypoint = Dict[str, Any]
ApiResult = Union[Response, Tuple[Response, int]]


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    )
    return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def find_largest_cluster(
    waypoints: List[Waypoint], radius_km: float = 1.5
) -> Tuple[List[Waypoint], List[str]]:
    n = len(waypoints)
    if n <= 2:
        return waypoints, []

    neighbors: Dict[int, List[int]] = {i: [] for i in range(n)}
    for i in range(n):
        for j in range(i + 1, n):
            a, b = waypoints[i], waypoints[j]
            if a.get("lat") and a.get("lng") and b.get("lat") and b.get("lng"):
                if haversine_km(a["lat"], a["lng"], b["lat"], b["lng"]) <= radius_km:
                    neighbors[i].append(j)
                    neighbors[j].append(i)

    visited: set[int] = set()
    best_cluster: List[int] = []
    for i in range(n):
        if i in visited:
            continue
        stack = [i]
        cluster: List[int] = []
        while stack:
            node = stack.pop()
            if node in visited:
                continue
            visited.add(node)
            cluster.append(node)
            stack.extend(nb for nb in neighbors[node] if nb not in visited)
        if len(cluster) > len(best_cluster):
            best_cluster = cluster

    if len(best_cluster) >= 2:
        keep = set(best_cluster)
        kept = [wp for i, wp in enumerate(waypoints) if i in keep]
        removed = [waypoints[i].get("name", "?") for i in range(n) if i not in keep]
        return kept, removed
    return waypoints, []


def enforce_walking_distance(
    waypoints: List[Waypoint], max_gap_km: float = 2.0, min_waypoints: int = 2
) -> Tuple[List[Waypoint], List[str]]:
    if len(waypoints) <= min_waypoints:
        return waypoints, []

    filtered = [waypoints[0]]
    removed: List[str] = []

    for i in range(1, len(waypoints)):
        curr = waypoints[i]
        prev = waypoints[i - 1]
        if None not in (prev.get("lat"), prev.get("lng"), curr.get("lat"), curr.get("lng")):
            dist = haversine_km(prev["lat"], prev["lng"], curr["lat"], curr["lng"])
            if dist > max_gap_km:
                removed.append(f"{curr.get('name', '?')}(距{prev.get('name', '?')}{dist:.1f}km)")
                continue
        filtered.append(curr)

    return filtered, removed


frontend_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend")
app = Flask(__name__, static_folder=frontend_dir, static_url_path="")
CORS(app, origins=[os.getenv("CORS_ORIGIN", "http://localhost:5000")])

ai_service = AIService()
geocode_service = GeocodeService()
db_service = DBService()

_rate_limits: Dict[str, List[float]] = defaultdict(list)


def _check_rate_limit(key: str, max_requests: int = 5, window: int = 60) -> bool:
    now = time.time()
    _rate_limits[key] = [t for t in _rate_limits[key] if now - t < window]
    if len(_rate_limits[key]) >= max_requests:
        return False
    _rate_limits[key].append(now)
    return True


def _error_response(message: str, status_code: int = 500) -> ApiResult:
    # 生产环境不暴露 500 的具体信息
    if not Config.DEBUG and status_code == 500:
        message = "服务内部错误，请稍后重试"
    return jsonify({"error": message}), status_code


@app.route("/")
def index() -> Response:
    return send_from_directory(app.static_folder, "index.html")


@app.route("/api/config", methods=["GET"])
def get_config() -> ApiResult:
    """前端从这里拿腾讯地图 JS Key，避免写死在 HTML 里"""
    try:
        return jsonify({"tencent_map_key": Config.TENCENT_MAP_KEY})
    except Exception as e:
        return _error_response(f"配置加载失败: {e}")


@app.route("/api/locate", methods=["GET"])
def locate_city() -> ApiResult:
    try:
        lat_arg = request.args.get("lat")
        lng_arg = request.args.get("lng")

        if lat_arg and lng_arg:
            lat = float(lat_arg)
            lng = float(lng_arg)

            if not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
                return _error_response("坐标超出有效范围", 400)

            location = geocode_service.reverse_geocode(lat, lng)
            if location is None:
                return _error_response("未能识别当前位置的城市信息", 500)
            return jsonify(location)

        print("[API] 无 GPS 坐标，使用 IP 定位")
        location = geocode_service.ip_location()
        if location is None:
            return _error_response("IP 定位失败，请手动输入城市", 500)

        print(f"[API] IP 定位结果: {location.get('city', '未知')} ({location.get('province', '')})")
        return jsonify(location)

    except ValueError:
        return _error_response("坐标参数格式错误", 400)
    except Exception as e:
        print(f"[API] 定位失败: {e}")
        return _error_response(f"定位失败: {e}", 500)


@app.route("/api/generate", methods=["POST"])
def generate_route() -> ApiResult:
    try:
        client_ip = request.remote_addr or "unknown"
        if not _check_rate_limit(f"gen:{client_ip}", max_requests=5, window=60):
            return _error_response("请求过于频繁，请稍后再试", 429)

        data = request.get_json(silent=True)
        if not data:
            return _error_response("请求体不能为空", 400)

        city = data.get("city", "").strip()
        if not city:
            return _error_response("城市名称不能为空", 400)

        preferences: Dict[str, Any] = {
            "city": city,
            "theme": data.get("theme", ""),
            "time_energy": data.get("time_energy", ""),
            "budget": data.get("budget", ""),
            "special_needs": data.get("special_needs", []),
            "description": data.get("description", ""),
            "user_lat": data.get("user_lat"),
            "user_lng": data.get("user_lng"),
        }

        print(f"[API] 开始生成路线概念，城市: {city}, 主题: {preferences['theme']}")
        route_data = ai_service.generate_route(preferences)
        concept_waypoints: List[Waypoint] = route_data.get("waypoints", [])
        area: str = route_data.get("area", "")
        print(
            f"[API] AI 概念: {route_data.get('route_name')}, 片区: {area}, "
            f"{len(concept_waypoints)} 个类型"
        )

        # 搜索中心：用户就在目标城市时用用户坐标，否则对片区做地理编码
        user_lat = preferences["user_lat"]
        user_lng = preferences["user_lng"]
        search_center: Optional[Dict[str, float]] = None

        if user_lat and user_lng:
            user_location = geocode_service.reverse_geocode(user_lat, user_lng)
            if user_location and user_location.get("city") == city:
                search_center = {"lat": user_lat, "lng": user_lng}
                print(f"[API] 用户在{city}，以用户坐标({user_lat:.4f},{user_lng:.4f})为中心")
            else:
                user_city = user_location.get("city", "?") if user_location else "?"
                print(f"[API] 用户在{user_city}，目标城市{city}，改为地理编码片区")

        if not search_center:
            for addr in (f"{city}{area}", f"{city}市{area}", area, city):
                if not addr:
                    continue
                search_center = geocode_service.geocode_center(addr)
                if search_center:
                    print(f"[API] 片区中心({addr}) -> ({search_center['lat']:.4f}, {search_center['lng']:.4f})")
                    break

        if not search_center:
            return _error_response(f"无法定位'{city} {area}'，请尝试更具体的城市或片区名称", 500)

        if concept_waypoints:
            print(f"[API] 搜索中心: ({search_center['lat']:.4f}, {search_center['lng']:.4f})，搜索 POI")

            all_pois: List[Dict[str, Any]] = []
            for wp in concept_waypoints:
                cat = wp.get("category") or wp.get("name") or "景点"
                pois = geocode_service.search_nearby_pois(
                    search_center["lat"], search_center["lng"], cat, radius=1000
                )
                valid = [p for p in pois if p.get("name") and p.get("distance", 9999) < 2000]
                if not valid:
                    print(f"[API] {cat}: 无结果")
                    continue
                for p in valid:
                    all_pois.append({
                        **p,
                        "_cat": cat,
                        "_desc": wp.get("description", ""),
                        "_stay": wp.get("stay_minutes", 40),
                        "_tips": wp.get("tips", ""),
                    })
                print(f"[API] {cat}: 找到 {len(valid)} 个 ({valid[0]['name']} {valid[0].get('distance', '?')}m)")

            all_pois.sort(key=lambda x: x.get("distance", 9999))
            seen_names: set[str] = set()
            seen_cats: set[str] = set()
            real_waypoints: List[Waypoint] = []
            for p in all_pois:
                if p["name"] in seen_names or p["_cat"] in seen_cats:
                    continue
                seen_names.add(p["name"])
                seen_cats.add(p["_cat"])
                real_waypoints.append({
                    "name": p["name"],
                    "category": p["_cat"],
                    "description": p["_desc"],
                    "stay_minutes": p["_stay"],
                    "tips": p["_tips"],
                    "lat": p["lat"],
                    "lng": p["lng"],
                })
                print(f"[API] #{len(real_waypoints)} {p['_cat']} -> {p['name']} ({p.get('distance', '?')}m)")
                if len(real_waypoints) >= len(concept_waypoints):
                    break

            if real_waypoints:
                seen_coords: set[Tuple[float, float]] = set()
                unique: List[Waypoint] = []
                for wp in real_waypoints:
                    key = (round(wp["lat"], 5), round(wp["lng"], 5))
                    if key not in seen_coords:
                        seen_coords.add(key)
                        unique.append(wp)
                route_data["waypoints"] = unique
                print(f"[API] 真实 POI 路线: {len(unique)} 个地点")
            else:
                print("[API] POI 搜索无结果，回退地理编码")
                geocoded, _failed = geocode_service.geocode_waypoints(concept_waypoints, f"{city}{area}")
                route_data["waypoints"] = [wp for wp in geocoded if wp.get("lat") is not None]

        waypoints = route_data.get("waypoints", [])
        if not waypoints:
            return _error_response("未能找到合适的地点，请尝试其他城市或主题", 500)

        route_id = db_service.save_route(route_data)
        route_data["id"] = route_id
        print(f"[API] 路线已保存，ID: {route_id}")

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
def get_walking_directions() -> ApiResult:
    try:
        from_lat = request.args.get("from_lat")
        from_lng = request.args.get("from_lng")
        to_lat = request.args.get("to_lat")
        to_lng = request.args.get("to_lng")

        if not all([from_lat, from_lng, to_lat, to_lng]):
            return _error_response("缺少坐标参数", 400)

        result = geocode_service.get_walking_direction(
            float(from_lat), float(from_lng), float(to_lat), float(to_lng)
        )
        if result is None:
            return _error_response("步行路径规划失败", 500)
        return jsonify(result)

    except ValueError:
        return _error_response("坐标参数格式错误", 400)
    except Exception as e:
        return _error_response(f"路径规划失败: {e}")


@app.route("/api/weather", methods=["GET"])
def get_weather() -> ApiResult:
    """代理 wttr.in，避免前端编码问题"""
    try:
        city = request.args.get("city", "").strip()
        if not city:
            return _error_response("缺少城市参数", 400)

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
        return _error_response(f"天气获取失败: {e}")


@app.route("/api/history", methods=["GET"])
def get_history() -> ApiResult:
    try:
        page = max(1, request.args.get("page", 1, type=int))
        limit = min(100, max(1, request.args.get("limit", 20, type=int)))
        search = request.args.get("search", "").strip()
        routes, total = db_service.get_routes(page, limit, search)
        return jsonify({"routes": routes, "total": total, "page": page, "limit": limit})
    except Exception as e:
        return _error_response(f"获取历史记录失败: {e}")


@app.route("/api/poi/nearby", methods=["GET"])
def search_nearby() -> ApiResult:
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
        return _error_response(f"POI 搜索失败: {e}")


@app.route("/api/history/<int:route_id>", methods=["GET"])
def get_route_detail(route_id: int) -> ApiResult:
    try:
        route = db_service.get_route(route_id)
        if route is None:
            return _error_response("路线不存在", 404)
        return jsonify(route)
    except Exception as e:
        return _error_response(f"获取路线详情失败: {e}")


@app.route("/api/history/<int:route_id>", methods=["DELETE"])
def delete_route(route_id: int) -> ApiResult:
    try:
        if not db_service.delete_route(route_id):
            return _error_response("路线不存在", 404)
        return jsonify({"message": "删除成功"})
    except Exception as e:
        return _error_response(f"删除失败: {e}")


if __name__ == "__main__":
    missing_keys = Config.validate()
    if missing_keys:
        print(f"警告：以下 API Key 未配置: {', '.join(missing_keys)}")
        print("请在 backend/.env 中填入对应的 Key")
    else:
        print("所有 API Key 已配置")

    port = int(os.getenv("PORT", 5000))
    print(f"AI CityWalk 后端启动，访问 http://localhost:{port}")
    app.run(host="127.0.0.1", port=port, debug=Config.DEBUG)