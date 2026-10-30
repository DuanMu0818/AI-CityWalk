const MapModule = (() => {
    let map = null;
    let currentMarkers = [];
    let currentPolyline = null;
    let currentWaypoints = [];
    let mapKey = '';
    let onMarkerClickCallback = null;
    let isInitialized = false;
    let sdkLoaded = false;
    let highlightedIndex = -1;

    async function init() {
        if (isInitialized) return;

        try {
            const config = await API.getConfig();
            mapKey = config.tencent_map_key;

            if (!mapKey) {
                console.error('[Map] 未获取到腾讯地图 Key');
                return;
            }

            await loadMapSDK();
        } catch (err) {
            console.error('[Map] SDK 加载失败:', err);
            throw err;
        }
    }

    function loadMapSDK() {
        return new Promise((resolve, reject) => {
            if (window.TMap && sdkLoaded) {
                resolve();
                return;
            }

            window._initTMap = () => {
                sdkLoaded = true;
                resolve();
            };

            const script = document.createElement('script');
            script.src = `https://map.qq.com/api/gljs?v=1.exp&key=${mapKey}&callback=_initTMap`;
            script.onerror = () => {
                reject(new Error('腾讯地图 SDK 加载失败，请检查网络连接'));
            };
            document.head.appendChild(script);
        });
    }

    function createMap(lat, lng, zoom = 12) {
        if (map) {
            map.setCenter(new TMap.LatLng(lat, lng));
            map.setZoom(zoom);
            console.log(`[Map] 地图已更新中心: (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
            return;
        }

        const container = document.getElementById('mapContainer');
        const center = new TMap.LatLng(lat, lng);

        map = new TMap.Map(container, {
            center: center,
            zoom: zoom,
            viewMode: '2D',
            baseMap: {
                type: 'vector',
                features: ['base', 'building3d', 'point', 'label'],
            },
        });

        map.on('click', () => {
            highlightedIndex = -1;
        });

        const placeholder = document.getElementById('mapPlaceholder');
        if (placeholder) {
            placeholder.style.display = 'none';
        }

        isInitialized = true;
        console.log(`[Map] 地图实例创建成功，中心: (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
    }

    function displayRoute(waypoints, onMarkerClick) {
        if (!map || !isInitialized) {
            console.warn('[Map] 地图未初始化，无法展示路线');
            return;
        }

        clearRoute();
        highlightedIndex = -1;

        currentWaypoints = waypoints;
        onMarkerClickCallback = onMarkerClick;

        if (!waypoints || waypoints.length === 0) return;

        const validWaypoints = waypoints.filter(wp => wp.lat != null && wp.lng != null);
        if (validWaypoints.length === 0) return;

        const markerGeometries = validWaypoints.map((wp, i) => ({
            id: `marker-${i}`,
            styleId: 'citywalk-marker',
            position: new TMap.LatLng(wp.lat, wp.lng),
            properties: { index: i, name: wp.name, category: wp.category || '', lat: wp.lat, lng: wp.lng },
        }));

        const markerLayer = new TMap.MultiMarker({
            map: map,
            styles: {
                'citywalk-marker': new TMap.MarkerStyle({
                    width: 34, height: 34, anchor: { x: 17, y: 17 },
                    src: createMarkerSVG(34, '#4A90D9', ''),
                }),
            },
            geometries: markerGeometries,
        });

        const labelLayer = new TMap.MultiLabel({
            map: map,
            styles: {
                'citywalk-label': new TMap.LabelStyle({
                    color: '#FFFFFF', size: 15, offset: { x: 0, y: 0 },
                    alignment: 'center', fontWeight: '600',
                }),
            },
            geometries: validWaypoints.map((wp, i) => ({
                id: `label-${i}`,
                styleId: 'citywalk-label',
                position: new TMap.LatLng(wp.lat, wp.lng),
                content: String(i + 1),
            })),
        });

        markerLayer.on('click', (evt) => {
            const props = evt.geometry?.properties;
            if (props && typeof props.index === 'number') {
                highlightedIndex = props.index;
                if (onMarkerClickCallback) {
                    onMarkerClickCallback(props.index);
                }
            }
        });

        currentMarkers = [{ markerLayer, labelLayer, geometries: markerGeometries, validWaypoints }];

        const geometries = [];
        for (let i = 0; i < validWaypoints.length - 1; i++) {
            geometries.push({
                id: `seg-${i}`,
                styleId: 'walking-line',
                paths: [
                    new TMap.LatLng(validWaypoints[i].lat, validWaypoints[i].lng),
                    new TMap.LatLng(validWaypoints[i+1].lat, validWaypoints[i+1].lng),
                ],
            });
        }

        currentPolyline = new TMap.MultiPolyline({
            map: map,
            styles: {
                'walking-line': new TMap.PolylineStyle({
                    color: '#4A90D9',
                    width: 5,
                    borderWidth: 2,
                    borderColor: 'rgba(255,255,255,0.8)',
                    lineCap: 'round', lineJoin: 'round',
                    dashArray: [14, 6],
                }),
            },
            geometries: geometries,
        });

        const bounds = new TMap.LatLngBounds();
        validWaypoints.forEach(wp => bounds.extend(new TMap.LatLng(wp.lat, wp.lng)));
        map.fitBounds(bounds, { padding: 60 });

        console.log(`[Map] 路线展示: ${validWaypoints.length} 标记, ${geometries.length} 段连线`);
    }

    function createMarkerSVG(size, color, text) {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
            <defs>
                <filter id="markerShadow">
                    <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-color="#000" flood-opacity="0.2"/>
                </filter>
            </defs>
            <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 2}" fill="${color}" stroke="#FFFFFF" stroke-width="2.5" filter="url(#markerShadow)"/>
            <text x="${size/2}" y="${size/2}" text-anchor="middle" dy="${size*0.17}" fill="#FFFFFF" font-size="${size*0.42}" font-weight="700" font-family="sans-serif">${text}</text>
        </svg>`;
        return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    }

    function centerOn(lat, lng, zoom = 14) {
        if (!map || !isInitialized) {
            console.warn('[Map] 地图未初始化，无法居中');
            return;
        }

        const pos = new TMap.LatLng(lat, lng);
        map.setCenter(pos);
        map.setZoom(zoom);

        if (window._userLocationMarker) {
            window._userLocationMarker.setMap(null);
        }

        window._userLocationMarker = new TMap.MultiMarker({
            map: map,
            styles: {
                'user-loc': new TMap.MarkerStyle({
                    width: 20,
                    height: 20,
                    anchor: { x: 10, y: 10 },
                    src: createUserLocationSVG(),
                }),
            },
            geometries: [{
                id: 'user-location',
                styleId: 'user-loc',
                position: pos,
            }],
        });

        console.log(`[Map] 定位到用户位置: (${lat}, ${lng})`);
    }

    function createUserLocationSVG() {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
            <circle cx="14" cy="14" r="11" fill="none" stroke="#4A90D9" stroke-width="2" opacity="0.25"/>
            <circle cx="14" cy="14" r="7" fill="#4A90D9" stroke="#FFFFFF" stroke-width="3"/>
        </svg>`;
        return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    }

    let _hlMarker = null;

    function highlightMarker(index) {
        if (!map || index >= currentWaypoints.length) return;
        const wp = currentWaypoints[index];
        if (!wp || !wp.lat || !wp.lng) return;

        if (_hlMarker) { try { _hlMarker.setMap(null); } catch(e) {} }
        _hlMarker = new TMap.MultiMarker({
            map: map,
            styles: {
                'hl': new TMap.MarkerStyle({
                    width: 44, height: 44, anchor: { x: 22, y: 22 },
                    src: createMarkerSVG(44, '#E6A23C', String(index + 1)),
                }),
            },
            geometries: [{ id: 'hl-marker', styleId: 'hl', position: new TMap.LatLng(wp.lat, wp.lng) }],
        });

        map.setCenter(new TMap.LatLng(wp.lat, wp.lng));
        map.setZoom(16);
    }

    function clearRoute() {
        if (_hlMarker) { try { _hlMarker.setMap(null); } catch(e) {} _hlMarker = null; }
        currentMarkers.forEach(markerGroup => {
            if (markerGroup.markerLayer) {
                markerGroup.markerLayer.setMap(null);
            }
            if (markerGroup.labelLayer) {
                markerGroup.labelLayer.setMap(null);
            }
        });
        currentMarkers = [];

        if (currentPolyline) {
            currentPolyline.setMap(null);
            currentPolyline = null;
        }

        currentWaypoints = [];
        highlightedIndex = -1;
        onMarkerClickCallback = null;
    }

    function destroy() {
        clearRoute();
        if (map) {
            map.destroy();
            map = null;
            isInitialized = false;
        }
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    return {
        init,
        createMap,
        displayRoute,
        centerOn,
        highlightMarker,
        clearRoute,
        destroy,
        isReady: () => isInitialized,
    };
})();
