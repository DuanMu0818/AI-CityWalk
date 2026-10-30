const App = (() => {
    const CATEGORY_COLORS = {
        '美食': '#E67E22',
        '历史街区': '#8B6914',
        '文化遗址': '#8B6914',
        '博物馆': '#3498DB',
        '公园': '#2ECC71',
        '自然景观': '#27AE60',
        '咖啡馆': '#A0522D',
        '书店': '#8E44AD',
        '艺术馆': '#8E44AD',
        '购物': '#D4A017',
    };

    const CATEGORY_CLASS_MAP = {
        '美食': 'cat-美食',
        '历史街区': 'cat-历史街区',
        '文化遗址': 'cat-文化遗址',
        '博物馆': 'cat-博物馆',
        '公园': 'cat-公园',
        '自然景观': 'cat-自然景观',
        '咖啡馆': 'cat-咖啡馆',
        '书店': 'cat-书店',
        '艺术馆': 'cat-艺术馆',
        '购物': 'cat-购物',
    };

    let currentRouteData = null;
    let loadingTimer = null;
    let isLoading = false;
    let isInitialized = false;
    let lastFormData = null;
    let userCoords = null;

    function getCategoryColor(category) {
        return CATEGORY_COLORS[category] || '#4A90D9';
    }

    function getCategoryClass(category) {
        return CATEGORY_CLASS_MAP[category] || '';
    }

    async function init() {
        if (isInitialized) return;

        try {
            Form.init();
            Form.onLocate(handleLocate);
            History.init(loadHistoryRoute);
            document.getElementById('btnGenerate').addEventListener('click', handleGenerate);

            const btnShare = document.getElementById('btnShare');
            if (btnShare) btnShare.addEventListener('click', shareRoute);

            document.getElementById('inputCity').addEventListener('input', (e) => {
                const city = e.target.value.trim();
                if (city.length >= 2) setNavbarCity(city);
            });

            document.addEventListener('keydown', (e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    document.getElementById('btnGenerate').click();
                }
                if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
                    e.preventDefault();
                    if (History.isOpen()) {
                        History.close();
                    } else {
                        document.getElementById('btnOpenHistory').click();
                    }
                }
            });

            initCardScrollButtons();

            initConfirmDialog();

            await MapModule.init();
            console.log('[App] 地图 SDK 加载完成');

            const coords = await detectLocation();
            userCoords = { lat: coords.lat, lng: coords.lng };
            MapModule.createMap(coords.lat, coords.lng, 12);

            const cityName = document.getElementById('inputCity').value.trim();
            if (cityName) setNavbarCity(cityName);

            console.log(`[App] 应用初始化完成，中心: (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`);

            isInitialized = true;
        } catch (err) {
            console.error('[App] 初始化失败:', err);
            MapModule.createMap(39.908823, 116.397470, 12);
            setNavbarCity('北京');
            showToast('定位失败，已使用默认城市', 'error');
            isInitialized = true;
        }
    }

    async function detectLocation() {
        if (navigator.geolocation) {
            try {
                const position = await new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, {
                        enableHighAccuracy: false,
                        timeout: 5000,
                        maximumAge: 600000,
                    });
                });

                const { latitude, longitude } = position.coords;
                console.log(`[App] GPS 定位成功: (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`);

                const location = await API.getLocation(latitude, longitude);
                if (location && location.city) {
                    Form.setCity(location.city);
                }

                return { lat: latitude, lng: longitude };
            } catch (err) {
                console.log(`[App] GPS 定位失败 (code=${err.code || 'unknown'}), 尝试 IP 定位...`);
            }
        }

        console.log('[App] 使用 IP 定位...');
        const location = await API.getLocation();

        if (location && location.city && location.lat && location.lng) {
            Form.setCity(location.city);
            console.log(`[App] IP 定位成功: ${location.city} (${location.lat.toFixed(4)}, ${location.lng.toFixed(4)})`);
            return { lat: location.lat, lng: location.lng };
        }

        throw new Error('无法获取位置信息');
    }

    async function handleGenerate() {
        if (isLoading) return;

        const formData = Form.getFormData();
        const validation = Form.validate(formData);
        if (!validation.valid) {
            showToast(validation.error, 'error');
            Form.showCityError();
            return;
        }

        lastFormData = { ...formData };
        if (userCoords) {
            formData.user_lat = userCoords.lat;
            formData.user_lng = userCoords.lng;
        }

        isLoading = true;
        Form.setLoading(true);
        showLoading();

        try {
            const routeData = await API.generateRoute(formData);
            hideLoading();
            displayRoute(routeData);
            if (routeData.filtered && routeData.filtered.length > 0) {
                showToast(`已自动跳过 ${routeData.filtered.length} 个过远地点：${routeData.filtered.join('、')}`, 'error');
            }
            showToast('路线生成成功！', 'success');
            isLoading = false;
            Form.setLoading(false);
        } catch (err) {
            hideLoading();
            isLoading = false;
            Form.setLoading(false);
            showToast(`路线生成失败，请重试`, 'error');
            const btn = document.getElementById('btnGenerate');
            if (btn) {
                btn.textContent = '🔄 重试';
                btn.style.background = 'var(--color-orange)';
            }
            console.error('[App] 路线生成失败:', err);
        }
    }

    function displayRoute(routeData) {
        currentRouteData = routeData;
        const waypoints = routeData.waypoints || [];
        MapModule.displayRoute(waypoints, onMapMarkerClick);
        renderCards(routeData);
    }

    function renderCards(routeData) {
        const cardsSection = document.getElementById('cardsSection');
        const routeNameDisplay = document.getElementById('routeNameDisplay');
        const routeSummaryDisplay = document.getElementById('routeSummaryDisplay');
        const cardsContainer = document.getElementById('cardsContainer');

        cardsSection.classList.add('visible');

        let title = routeData.route_name || 'CityWalk 路线';
        if (routeData.area) title += ` · ${routeData.area}`;
        routeNameDisplay.textContent = title;
        routeSummaryDisplay.textContent = routeData.summary || '';

        const waypoints = routeData.waypoints || [];

        const totalMinutes = waypoints.reduce((sum, wp) => sum + (wp.stay_minutes || 30), 0);
        const totalHours = Math.round(totalMinutes / 60 * 10) / 10;
        const distKm = routeData.walking_distance_km || '—';
        document.getElementById('statWaypoints').textContent = `${waypoints.length} 个途经点`;
        document.getElementById('statDuration').textContent = `约 ${totalHours} 小时 · ${distKm}km`;

        cardsContainer.innerHTML = waypoints.map((wp, i) => {
            const animDelay = i * 0.08;
            const catClass = getCategoryClass(wp.category);

            return `
                <div class="route-card" data-index="${i}" style="animation-delay: ${animDelay}s;">
                    <button class="card-skip-btn" data-action="skip" data-index="${i}" title="跳过此地点">✕</button>
                    <div class="route-card-inner">
                        <div class="card-header-row">
                            <div class="card-number">${i + 1}</div>
                            <h4 class="card-name">${escapeHtml(wp.name || '未命名地点')}</h4>
                        </div>
                        ${wp.category ? `<span class="card-category ${catClass}">${escapeHtml(wp.category)}</span>` : ''}
                        ${wp.description ? `<p class="card-description">${escapeHtml(wp.description)}</p>` : ''}
                        <div class="card-footer">
                            ${wp.stay_minutes ? `<span class="card-stay-time"><svg width="14" height="14" viewBox="0 0 14 14" style="vertical-align:-2px"><circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" stroke-width="1.3"/><line x1="7" y1="4" x2="7" y2="7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><line x1="7" y1="7" x2="10" y2="9" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg> ${wp.stay_minutes}分钟</span>` : ''}
                            ${wp.tips ? `<span class="card-tips" title="${escapeHtml(wp.tips)}"><svg width="14" height="14" viewBox="0 0 14 14" style="vertical-align:-2px;flex-shrink:0"><circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" stroke-width="1.3"/><line x1="7" y1="4" x2="7" y2="7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><circle cx="7" cy="10" r="0.7" fill="currentColor"/></svg><span class="card-tips-text">${escapeHtml(wp.tips)}</span></span>` : ''}
                            ${wp.lat != null && wp.lng != null ? `<span class="card-nav-links" data-action="nav" data-lat="${wp.lat}" data-lng="${wp.lng}" data-name="${escapeHtml(wp.name)}"><a href="https://uri.amap.com/marker?position=${wp.lng},${wp.lat}&name=${encodeURIComponent(wp.name)}" target="_blank" class="nav-pill nav-gaode" title="高德地图" onclick="event.stopPropagation()">高德</a><a href="https://apis.map.qq.com/uri/v1/marker?marker=coord:${wp.lat},${wp.lng};title:${encodeURIComponent(wp.name)}" target="_blank" class="nav-pill nav-tencent" title="腾讯地图" onclick="event.stopPropagation()">腾讯</a><a href="https://api.map.baidu.com/marker?location=${wp.lat},${wp.lng}&title=${encodeURIComponent(wp.name)}&output=html&coord_type=gcj02" target="_blank" class="nav-pill nav-baidu" title="百度地图" onclick="event.stopPropagation()">百度</a></span>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        cardsContainer.querySelectorAll('.route-card').forEach((card, i) => {
            const wp = waypoints[i];
            if (wp && wp.category) {
                card.style.setProperty('--cat-color', getCategoryColor(wp.category));
                const style = document.createElement('style');
                const color = getCategoryColor(wp.category);
                style.textContent = `.route-card[data-index="${i}"]::before { background: ${color}; }`;
                card.appendChild(style);
            }
        });

        cardsContainer.querySelectorAll('.route-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('[data-action="skip"]')) {
                    e.stopPropagation();
                    const idx = parseInt(e.target.closest('[data-action="skip"]').dataset.index);
                    skipWaypoint(idx);
                    return;
                }
                const index = parseInt(card.dataset.index);
                cardsContainer.querySelectorAll('.route-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                MapModule.highlightMarker(index);
            });
        });

        updateScrollButtons(cardsContainer);

        if (cardsContainer.firstElementChild) {
            cardsContainer.firstElementChild.classList.add('active');
        }
    }

    function initCardScrollButtons() {
        const container = document.getElementById('cardsContainer');
        const btnLeft = document.getElementById('btnScrollLeft');
        const btnRight = document.getElementById('btnScrollRight');

        if (!btnLeft || !btnRight) return;

        btnLeft.addEventListener('click', () => {
            container.scrollBy({ left: -280, behavior: 'smooth' });
        });

        btnRight.addEventListener('click', () => {
            container.scrollBy({ left: 280, behavior: 'smooth' });
        });

        container.addEventListener('scroll', () => updateScrollButtons(container));
    }

    function updateScrollButtons(container) {
        const btnLeft = document.getElementById('btnScrollLeft');
        const btnRight = document.getElementById('btnScrollRight');
        if (!btnLeft || !btnRight) return;

        const canScrollLeft = container.scrollLeft > 2;
        const canScrollRight = container.scrollLeft + container.clientWidth < container.scrollWidth - 2;

        btnLeft.style.opacity = canScrollLeft ? '1' : '0';
        btnLeft.style.pointerEvents = canScrollLeft ? 'auto' : 'none';
        btnRight.style.opacity = canScrollRight ? '1' : '0';
        btnRight.style.pointerEvents = canScrollRight ? 'auto' : 'none';
    }

    function onMapMarkerClick(index) {
        const cardsContainer = document.getElementById('cardsContainer');
        if (!cardsContainer) return;

        cardsContainer.querySelectorAll('.route-card').forEach(c => c.classList.remove('active'));

        const targetCard = cardsContainer.querySelector(`[data-index="${index}"]`);
        if (targetCard) {
            targetCard.classList.add('active');
            targetCard.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            console.log('[App] 卡片联动: #' + (index + 1));
        }
    }

    function loadHistoryRoute(routeData) {
        if (!routeData || !routeData.waypoints) {
            showToast('路线数据无效', 'error');
            return;
        }
        if (routeData.city) {
            document.getElementById('inputCity').value = routeData.city;
        }
        displayRoute(routeData);
        showToast('路线已加载', 'success');
    }

    async function handleLocate() {
        if (!navigator.geolocation) {
            showToast('您的浏览器不支持定位功能', 'error');
            return;
        }

        Form.setLocating(true);

        try {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 60000,
                });
            });

            const { latitude, longitude } = position.coords;
            const location = await API.getLocation(latitude, longitude);

            if (location && location.city) {
                Form.setCity(location.city);
                MapModule.centerOn(latitude, longitude);
                showToast(`已定位到 ${location.city}`, 'success');
            } else {
                showToast('未能识别城市，请手动输入', 'error');
            }
        } catch (err) {
            if (err.code === 1) {
                showToast('请在浏览器设置中允许位置访问', 'error');
            } else {
                showToast('定位失败，请手动输入城市', 'error');
            }
        } finally {
            Form.setLocating(false);
        }
    }

    function showLoading() {
        const overlay = document.getElementById('loadingOverlay');
        overlay.classList.add('show');
        overlay.classList.remove('hide');

        const progressFill = document.getElementById('loadingProgressFill');
        if (progressFill) {
            progressFill.style.transition = 'none';
            progressFill.style.width = '0%';
            progressFill.offsetHeight; // 强制回流，确保 0% 生效
            progressFill.style.transition = 'width 30s linear';
            progressFill.style.width = '90%';
        }

        const stages = document.querySelectorAll('.loading-stages .stage');
        stages.forEach(s => s.classList.remove('active', 'done'));
        const textEl = document.getElementById('loadingText');

        setTimeout(() => { stages[0]?.classList.add('active'); textEl.textContent = '正在理解你的偏好...'; }, 260);
        setTimeout(() => {
            stages[0]?.classList.replace('active', 'done');
            stages[1]?.classList.add('active');
            textEl.textContent = '正在匹配城市地点与坐标...';
        }, 2600);
        setTimeout(() => {
            stages[1]?.classList.replace('active', 'done');
            stages[2]?.classList.add('active');
            textEl.textContent = '正在生成最优漫步路线...';
        }, 6000);

        const tips = ['马上就好', '正在优化路线', '为你精选最佳地点', '稍等片刻'];
        let ti = 0;
        loadingTimer = setInterval(() => {
            if (stages[2]?.classList.contains('active')) {
                textEl.textContent = tips[ti % tips.length];
                ti++;
            }
        }, 4000);
    }

    function hideLoading() {
        if (loadingTimer) { clearInterval(loadingTimer); loadingTimer = null; }

        const progressFill = document.getElementById('loadingProgressFill');
        if (progressFill) {
            progressFill.style.transition = 'width 0.4s ease';
            progressFill.style.width = '100%';
            setTimeout(() => { progressFill.style.transition = 'none'; progressFill.style.width = '0%'; }, 500);
        }

        const stages = document.querySelectorAll('.loading-stages .stage');
        stages.forEach(s => { s.classList.remove('active'); s.classList.add('done'); });
        document.getElementById('loadingText').textContent = '路线已就绪';

        setTimeout(() => {
            const overlay = document.getElementById('loadingOverlay');
            overlay.classList.add('hide');
            overlay.classList.remove('show');
        }, 500);
    }

    const W_ICONS = { sunny:'☀️', clear:'☀️', cloudy:'☁️', overcast:'☁️', partly:'⛅', mist:'🌫', fog:'🌫', rain:'🌧', drizzle:'🌦', thunder:'⛈', snow:'❄️' };
    function wIcon(c) {
        c = (c||'').toLowerCase();
        for (const [k,v] of Object.entries(W_ICONS)) { if (c.includes(k)) return v; }
        return '🌤';
    }

    async function setNavbarCity(city) {
        const el = document.getElementById('navbarCity');
        if (!el || !city) return;
        el.textContent = '📍 ' + city;
        try {
            const w = await API.getWeather(city);
            if (w && w.temperature) {
                el.textContent = wIcon(w.condition) + ' ' + w.temperature + ' ' + city;
            }
        } catch(e) {}
    }

    function shareRoute() {
        if (!currentRouteData) return;
        const wps = currentRouteData.waypoints || [];
        const lines = [
            `🚶 ${currentRouteData.route_name || 'CityWalk 路线'}`,
            `📍 ${currentRouteData.city || ''} · ${currentRouteData.area || ''}`,
            currentRouteData.summary || '',
            '',
            ...wps.map((wp, i) => `${i+1}. ${wp.name}${wp.category ? ' ['+wp.category+']' : ''} — ${wp.description||''}`)
        ];
        const text = lines.join('\n');
        navigator.clipboard.writeText(text).then(() => {
            showToast('路线已复制到剪贴板！', 'success');
        }).catch(() => {
            showToast('复制失败，请重试', 'error');
        });
    }

    function skipWaypoint(index) {
        if (!currentRouteData) return;
        const wps = currentRouteData.waypoints || [];
        if (wps.length <= 2) {
            showToast('至少保留 2 个途经点', 'error');
            return;
        }
        const removed = wps.splice(index, 1);
        currentRouteData.waypoints = wps;
        MapModule.clearRoute();
        MapModule.displayRoute(wps, onMapMarkerClick);
        renderCards(currentRouteData);
        showToast(`已跳过：${removed[0]?.name || ''}`, 'success');
    }

    function showToast(message, type = '') {
        const toast = document.getElementById('toast');
        const toastText = document.getElementById('toastText');
        const toastIcon = document.getElementById('toastIcon');

        toastText.textContent = message;
        toast.className = 'toast ' + type;

        if (type === 'success') {
            toastIcon.innerHTML = `<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="7" stroke="#fff" stroke-width="1.5"/><polyline points="5,9 8,12 13,6" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        } else if (type === 'error') {
            toastIcon.innerHTML = `<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="7" stroke="#fff" stroke-width="1.5"/><line x1="6" y1="6" x2="12" y2="12" stroke="#fff" stroke-width="2" stroke-linecap="round"/><line x1="12" y1="6" x2="6" y2="12" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>`;
        } else {
            toastIcon.innerHTML = '';
        }

        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        clearTimeout(toast._timeout);
        toast._timeout = setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    function initConfirmDialog() {
    }

    function showConfirm(message) {
        return new Promise((resolve) => {
            const overlay = document.getElementById('confirmOverlay');
            const msgEl = document.getElementById('confirmMessage');
            const btnOk = document.getElementById('btnConfirmOk');
            const btnCancel = document.getElementById('btnConfirmCancel');

            msgEl.textContent = message;
            overlay.classList.add('show');

            function cleanup(result) {
                overlay.classList.remove('show');
                btnOk.removeEventListener('click', onOk);
                btnCancel.removeEventListener('click', onCancel);
                resolve(result);
            }

            function onOk() { cleanup(true); }
            function onCancel() { cleanup(false); }

            btnOk.addEventListener('click', onOk);
            btnCancel.addEventListener('click', onCancel);
        });
    }

    function haversineDistance(lat1, lng1, lat2, lng2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    return {
        init,
        showToast,
        showConfirm,
    };
})();

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
