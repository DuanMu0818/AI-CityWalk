/**
 * API 调用模块
 * 封装所有后端 API 请求，统一错误处理
 * 后端基础 URL 根据当前页面自动确定
 */

const API = (() => {
    // 后端基础 URL（与前端同源时用相对路径，开发时可改绝对路径）
    const BASE_URL = window.location.protocol === 'file:'
        ? 'http://localhost:5000'
        : '';

    /**
     * 通用请求封装
     * @param {string} url - 请求路径
     * @param {object} options - fetch 选项
     * @returns {Promise<any>} 解析后的 JSON 数据
     */
    async function request(url, options = {}) {
        const defaultOptions = {
            headers: { 'Content-Type': 'application/json' },
        };

        const mergedOptions = { ...defaultOptions, ...options };
        if (mergedOptions.body && typeof mergedOptions.body === 'object') {
            mergedOptions.body = JSON.stringify(mergedOptions.body);
        }

        // 超时控制（默认 120 秒）
        const timeout = options.timeout || 120000;
        const controller = new AbortController();
        mergedOptions.signal = controller.signal;
        const timer = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(`${BASE_URL}${url}`, mergedOptions);
            clearTimeout(timer);

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || `请求失败 (HTTP ${response.status})`);
            }
            return data;
        } catch (err) {
            clearTimeout(timer);
            if (err.name === 'AbortError') {
                throw new Error('请求超时，请检查网络后重试');
            }
            throw err;
        }
    }

    /**
     * 获取前端配置（腾讯地图 Key）
     * @returns {Promise<{tencent_map_key: string}>}
     */
    async function getConfig() {
        return request('/api/config');
    }

    /**
     * 生成路线
     * @param {object} preferences - 用户偏好数据
     * @returns {Promise<object>} 完整路线数据（含途经点坐标）
     */
    async function generateRoute(preferences) {
        return request('/api/generate', {
            method: 'POST',
            body: preferences,
        });
    }

    /**
     * 获取用户当前城市
     * - 传入 lat/lng 时：使用 GPS 坐标反向地理编码
     * - 不传参数时：使用 IP 定位（无需权限的兜底方案）
     * @param {number} [lat] - 纬度（可选）
     * @param {number} [lng] - 经度（可选）
     * @returns {Promise<{city: string, province: string, district: string, lat?: number, lng?: number}>}
     */
    async function getLocation(lat, lng) {
        if (lat !== undefined && lng !== undefined) {
            return request(`/api/locate?lat=${lat}&lng=${lng}`);
        }
        // 无参数 → 后端使用请求 IP 定位
        return request('/api/locate');
    }

    /**
     * 获取历史路线列表（分页+搜索）
     * @param {number} page
     * @param {string} search
     * @returns {Promise<{routes: Array, total: number}>}
     */
    async function getHistory(page = 1, search = '') {
        const params = new URLSearchParams({ page, limit: 20 });
        if (search) params.set('search', search);
        return request(`/api/history?${params.toString()}`);
    }

    /**
     * 获取城市天气
     * @param {string} city
     * @returns {Promise<{condition: string, temperature: string}>}
     */
    async function getWeather(city) {
        return request(`/api/weather?city=${encodeURIComponent(city)}`);
    }

    /**
     * 搜索周边 POI
     * @param {number} lat
     * @param {number} lng
     * @param {string} keyword
     * @returns {Promise<{pois: Array}>}
     */
    async function searchNearby(lat, lng, keyword = '') {
        const params = new URLSearchParams({ lat, lng, radius: 1000 });
        if (keyword) params.set('keyword', keyword);
        return request(`/api/poi/nearby?${params.toString()}`);
    }

    /**
     * 获取单条路线详情
     * @param {number} id - 路线 ID
     * @returns {Promise<object>}
     */
    async function getRouteDetail(id) {
        return request(`/api/history/${id}`);
    }

    /**
     * 获取两点之间的步行路径规划
     * @param {number} fromLat - 起点纬度
     * @param {number} fromLng - 起点经度
     * @param {number} toLat - 终点纬度
     * @param {number} toLng - 终点经度
     * @returns {Promise<{distance: number, duration: number, path: Array}>}
     */
    async function getWalkingDirection(fromLat, fromLng, toLat, toLng) {
        return request(`/api/directions/walking?from_lat=${fromLat}&from_lng=${fromLng}&to_lat=${toLat}&to_lng=${toLng}`);
    }

    /**
     * 删除一条历史路线
     * @param {number} id - 路线 ID
     * @returns {Promise<object>}
     */
    async function deleteRoute(id) {
        return request(`/api/history/${id}`, {
            method: 'DELETE',
        });
    }

    // 公开 API
    return {
        getConfig,
        getLocation,
        generateRoute,
        getWalkingDirection,
        getHistory,
        getRouteDetail,
        deleteRoute,
        getWeather,
        searchNearby,
    };
})();
