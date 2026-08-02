"""
腾讯地图地理编码服务模块
将 AI 生成的地点名称转换为 GCJ-02 坐标（lat, lng）
"""

import time
import requests
from config import Config


class GeocodeService:
    """腾讯地图地理编码服务，为路线途经点补充坐标数据"""

    def __init__(self):
        self.key = Config.TENCENT_MAP_KEY
        self.geocode_url = Config.TENCENT_GEOCODE_URL
        self.poi_url = Config.TENCENT_POI_SEARCH_URL
        self.ip_location_url = Config.TENCENT_IP_LOCATION_URL

    def geocode_waypoints(self, waypoints, city):
        """
        为途经点列表中的每个地点获取 GCJ-02 坐标
        参数:
            waypoints: 途经点列表（每个点含 name 字段）
            city: 城市名（用于提高搜索精度）
        返回:
            waypoints: 注入了 lat/lng 坐标的途经点列表
            failed: 地理编码失败的地点名称列表
        """
        result_waypoints = []
        failed = []

        for i, wp in enumerate(waypoints):
            name = wp.get("name", "").strip()
            if not name:
                wp["lat"] = None
                wp["lng"] = None
                failed.append(f"（空名称）")
                continue

            # 获取坐标
            location = self._search_location(name, city)

            if location:
                wp["lat"] = location["lat"]
                wp["lng"] = location["lng"]
                result_waypoints.append(wp)
                print(f"[Geocode] ✅ [{i+1}/{len(waypoints)}] {name} → ({location['lat']}, {location['lng']})")
            else:
                wp["lat"] = None
                wp["lng"] = None
                result_waypoints.append(wp)
                failed.append(name)
                print(f"[Geocode] ❌ [{i+1}/{len(waypoints)}] {name} → 未找到坐标")

            # 遵循腾讯地图 API 频率限制（每秒不超过 5 次）
            if i < len(waypoints) - 1:
                time.sleep(0.15)

        # 移除去重但保留顺序（跳过坐标为空的地点，不参与去重）
        seen = set()
        unique_waypoints = []
        for wp in result_waypoints:
            lat, lng = wp.get("lat"), wp.get("lng")
            if lat is None or lng is None:
                # 编码失败的地点不参与去重，直接保留
                unique_waypoints.append(wp)
                continue
            key = (lat, lng)
            if key not in seen:
                seen.add(key)
                unique_waypoints.append(wp)
            else:
                print(f"[Geocode] ⚠️ 发现重复坐标，跳过: {wp.get('name')}")

        return unique_waypoints, failed

    def _search_location(self, name, city):
        """
        搜索地点坐标，先尝试地理编码，失败则尝试 POI 搜索
        参数:
            name: 地点名称
            city: 城市名
        返回:
            包含 lat/lng 的字典，或 None
        """
        # 第一步：使用地理编码接口
        location = self._geocode(name, city)
        if location:
            return location

        # 第二步：使用 POI 搜索接口作为备选
        location = self._poi_search(name, city)
        if location:
            return location

        return None

    def _geocode(self, name, city):
        """
        调用腾讯地图地理编码 API
        文档: https://lbs.qq.com/webservice_v1/guide-geocoder.html
        """
        try:
            # 构造地址：地点名 + 城市名，提高精度
            address = f"{city}{name}"
            params = {
                "address": address,
                "key": self.key,
            }
            response = requests.get(self.geocode_url, params=params, timeout=10)
            data = response.json()

            # status 0 表示成功
            if data.get("status") == 0 and data.get("result"):
                result = data["result"]
                # 腾讯 API 返回的 location 是 {lat, lng} 对象
                location = result.get("location")
                if location and location.get("lat") and location.get("lng"):
                    # 检查精度（腾讯地理编码有可信度评分）
                    reliability = result.get("reliability", 0)
                    if reliability >= 3:  # 可信度 >= 3 才接受（满分为7）
                        return {
                            "lat": float(location["lat"]),
                            "lng": float(location["lng"]),
                        }
                    else:
                        print(f"    [Geocode] 可信度不足 ({reliability}/7): {name}")

            return None

        except Exception as e:
            print(f"    [Geocode] 请求异常: {e}")
            return None

    def reverse_geocode(self, lat, lng):
        """
        反向地理编码：将坐标转换为地址信息
        文档: https://lbs.qq.com/webservice_v1/guide-geocoder.html
        参数:
            lat: 纬度（GCJ-02）
            lng: 经度（GCJ-02）
        返回:
            包含 city, address 等信息的字典，或 None
        """
        try:
            params = {
                "location": f"{lat},{lng}",
                "key": self.key,
                "get_poi": "0",  # 不返回周边 POI
            }
            response = requests.get(self.geocode_url, params=params, timeout=10)
            data = response.json()

            if data.get("status") == 0 and data.get("result"):
                result = data["result"]
                # 提取地址组件（ad_info 包含省市区信息）
                ad_info = result.get("ad_info", {})
                address_component = result.get("address_component", {})

                city = (
                    ad_info.get("city")
                    or address_component.get("city")
                    or result.get("address", "")
                )

                # 去掉"市"字后缀（如"成都市"→"成都"）
                if city and city.endswith("市"):
                    city = city[:-1]

                return {
                    "city": city,
                    "province": ad_info.get("province", ""),
                    "district": ad_info.get("district", ""),
                    "address": result.get("address", ""),
                    "lat": lat,
                    "lng": lng,
                }

            print(f"    [Reverse Geocode] 失败: status={data.get('status')}, msg={data.get('message')}")
            return None

        except Exception as e:
            print(f"    [Reverse Geocode] 请求异常: {e}")
            return None

    def ip_location(self, ip=""):
        """
        IP 定位：通过 IP 地址获取当前城市（不需要 GPS）
        文档: https://lbs.qq.com/webservice_v1/guide-ip.html
        参数:
            ip: 客户端 IP（留空则使用请求来源 IP）
        返回:
            包含 city, lat, lng 等信息的字典，或 None
        """
        try:
            params = {"key": self.key}
            if ip:
                params["ip"] = ip
            # IP 为空时 API 使用请求来源 IP

            response = requests.get(self.ip_location_url, params=params, timeout=10)
            data = response.json()

            # status 0 表示成功
            if data.get("status") == 0 and data.get("result"):
                result = data["result"]
                ad_info = result.get("ad_info", {})
                location = result.get("location", {})

                city = ad_info.get("city", "")
                # 去掉"市"字后缀
                if city and city.endswith("市"):
                    city = city[:-1]

                return {
                    "city": city,
                    "province": ad_info.get("province", ""),
                    "district": ad_info.get("district", ""),
                    "nation": ad_info.get("nation", ""),
                    "lat": location.get("lat"),
                    "lng": location.get("lng"),
                }

            print(f"    [IP Location] 失败: status={data.get('status')}, msg={data.get('message')}")
            return None

        except Exception as e:
            print(f"    [IP Location] 请求异常: {e}")
            return None

    def _poi_search(self, name, city):
        """
        调用腾讯地图 POI 搜索 API（地理编码失败的备选方案）
        文档: https://lbs.qq.com/webservice_v1/guide-search.html
        """
        try:
            params = {
                "keyword": name,
                "boundary": f"region({city},0)",  # 限定在城市范围
                "key": self.key,
                "page_size": 1,  # 只要第一个结果
            }
            response = requests.get(self.poi_url, params=params, timeout=10)
            data = response.json()

            # status 0 表示成功
            if data.get("status") == 0 and data.get("data"):
                places = data["data"]
                if len(places) > 0:
                    location = places[0].get("location")
                    if location and location.get("lat") and location.get("lng"):
                        return {
                            "lat": float(location["lat"]),
                            "lng": float(location["lng"]),
                        }

            return None

        except Exception as e:
            print(f"    [POI] 请求异常: {e}")
            return None

    def get_walking_direction(self, from_lat, from_lng, to_lat, to_lng):
        """
        调用腾讯地图步行路线规划 API，获取两点之间的真实步行路径
        文档: https://lbs.qq.com/webservice_v1/guide-direction.html
        参数:
            from_lat, from_lng: 起点坐标
            to_lat, to_lng: 终点坐标
        返回:
            {distance, duration, path: [{lat, lng}, ...]} 或 None
        """
        try:
            url = "https://apis.map.qq.com/ws/direction/v1/walking/"
            params = {
                "from": f"{from_lat},{from_lng}",
                "to": f"{to_lat},{to_lng}",
                "key": self.key,
            }
            response = requests.get(url, params=params, timeout=10)
            data = response.json()

            if data.get("status") == 0 and data.get("result"):
                result = data["result"]
                routes = result.get("routes", [])
                if len(routes) > 0:
                    route = routes[0]
                    distance = route.get("distance", 0)  # 米
                    duration = route.get("duration", 0)  # 分钟
                    polyline = route.get("polyline", [])
                    path = []
                    if polyline:
                        if isinstance(polyline[0], (int, float)):
                            for j in range(0, len(polyline), 2):
                                if j + 1 < len(polyline):
                                    path.append({"lat": polyline[j], "lng": polyline[j+1]})
                        else:
                            path = [{"lat": p[0], "lng": p[1]} for p in polyline]
                    return {
                        "distance": distance,
                        "duration": duration,
                        "path": path,
                    }

            print(f"    [Direction] 失败: status={data.get('status')}, msg={data.get('message')}")
            return None

        except Exception as e:
            print(f"    [Direction] 请求异常: {e}")
            return None

    def geocode_center(self, address):
        """地理编码片区中心坐标 — 降低可靠性门槛 + 多策略尝试"""
        # 策略1：城市+片区名，低门槛
        for attempt in [address, address.replace('-', '')]:
            loc = self._geocode_raw(attempt, min_reliability=1)
            if loc:
                print(f"[Geocode] 片区中心({address}) → ({loc['lat']:.4f}, {loc['lng']:.4f})")
                return loc
        return None

    def _geocode_raw(self, address, min_reliability=1):
        """地理编码，可指定最低可信度"""
        try:
            params = {"address": address, "key": self.key}
            response = requests.get(self.geocode_url, params=params, timeout=10)
            data = response.json()
            if data.get("status") == 0 and data.get("result"):
                result = data["result"]
                location = result.get("location")
                if location and location.get("lat") and location.get("lng"):
                    reliability = result.get("reliability", 0)
                    if reliability >= min_reliability:
                        return {"lat": float(location["lat"]), "lng": float(location["lng"])}
                    print(f"    [Geocode] 可信度不足 ({reliability}/7): {address}")
            return None
        except Exception as e:
            print(f"    [Geocode] 请求异常: {e}")
            return None

    def search_nearby_pois(self, lat, lng, keyword, radius=1500):
        """搜索周边POI并返回结构化结果"""
        return self.search_nearby(lat, lng, keyword, radius)

    def search_nearby(self, lat, lng, keyword="", radius=1000):
        """
        搜索周边 POI
        文档: https://lbs.qq.com/webservice_v1/guide-search.html
        """
        try:
            params = {
                "boundary": f"nearby({lat},{lng},{radius})",
                "key": self.key,
                "page_size": 10,
                "orderby": "_distance",
            }
            if keyword:
                params["keyword"] = keyword

            response = requests.get(self.poi_url, params=params, timeout=10)
            data = response.json()

            if data.get("status") == 0 and data.get("data"):
                pois = []
                for p in data["data"][:10]:
                    loc = p.get("location", {})
                    pois.append({
                        "name": p.get("title", ""),
                        "address": p.get("address", ""),
                        "category": p.get("category", ""),
                        "lat": loc.get("lat"),
                        "lng": loc.get("lng"),
                        "distance": p.get("_distance", 0),
                    })
                return pois

            return []
        except Exception as e:
            print(f"    [Nearby] 请求异常: {e}")
            return []
