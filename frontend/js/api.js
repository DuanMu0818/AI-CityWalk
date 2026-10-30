const API = (() => {
    // 后端基础 URL（与前端同源时用相对路径，开发时可改绝对路径）
    const BASE_URL = window.location.protocol === 'file:'
        ? 'http://localhost:5000'
        : '';

    async function request(url, options = {}) {
        const defaultOptions = {
            headers: { 'Content-Type': 'application/json' },
        };

        const mergedOptions = { ...defaultOptions, ...options };
        if (mergedOptions.body && typeof mergedOptions.body === 'object') {
            mergedOptions.body = JSON.stringify(mergedOptions.body);
        }

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

    async function getConfig() {
        return request('/api/config');
    }

    async function generateRoute(preferences) {
        return request('/api/generate', {
            method: 'POST',
            body: preferences,
        });
    }

    async function getLocation(lat, lng) {
        if (lat !== undefined && lng !== undefined) {
            return request(`/api/locate?lat=${lat}&lng=${lng}`);
        }
        // 无参数 → 后端使用请求 IP 定位
        return request('/api/locate');
    }

    async function getHistory(page = 1, search = '') {
        const params = new URLSearchParams({ page, limit: 20 });
        if (search) params.set('search', search);
        return request(`/api/history?${params.toString()}`);
    }

    async function getWeather(city) {
        return request(`/api/weather?city=${encodeURIComponent(city)}`);
    }

    async function searchNearby(lat, lng, keyword = '') {
        const params = new URLSearchParams({ lat, lng, radius: 1000 });
        if (keyword) params.set('keyword', keyword);
        return request(`/api/poi/nearby?${params.toString()}`);
    }

    async function getRouteDetail(id) {
        return request(`/api/history/${id}`);
    }

    async function getWalkingDirection(fromLat, fromLng, toLat, toLng) {
        return request(`/api/directions/walking?from_lat=${fromLat}&from_lng=${fromLng}&to_lat=${toLat}&to_lng=${toLng}`);
    }

    async function deleteRoute(id) {
        return request(`/api/history/${id}`, {
            method: 'DELETE',
        });
    }

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
