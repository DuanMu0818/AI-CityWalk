const History = (() => {
    const els = {};
    let isInitialized = false;
    let onSelectCallback = null;
    let isOpen = false;
    let searchQuery = '';
    let currentPage = 1;
    let totalPages = 1;
    let searchTimeout = null;

    function init(onSelect) {
        if (isInitialized) return;
        cacheElements();
        bindEvents();
        onSelectCallback = onSelect;
        isInitialized = true;
    }

    function cacheElements() {
        els.drawer = document.getElementById('historyDrawer');
        els.mask = document.getElementById('drawerMask');
        els.btnOpen = document.getElementById('btnOpenHistory');
        els.btnClose = document.getElementById('btnCloseDrawer');
        els.body = document.getElementById('drawerBody');
        els.loading = document.getElementById('drawerLoading');
        els.empty = document.getElementById('drawerEmpty');
        els.list = document.getElementById('drawerList');
        els.searchInput = document.getElementById('inputSearchHistory');
    }

    function bindEvents() {
        els.btnOpen.addEventListener('click', open);

        els.btnClose.addEventListener('click', close);

        els.mask.addEventListener('click', close);

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && isOpen) {
                close();
            }
        });

        if (els.searchInput) {
            els.searchInput.addEventListener('input', () => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    searchQuery = els.searchInput.value.trim();
                    currentPage = 1;
                    loadHistory();
                }, 400);
            });
        }
    }

    async function open() {
        els.drawer.classList.add('show');
        els.mask.classList.add('show');
        isOpen = true;
        if (els.searchInput) els.searchInput.value = '';
        searchQuery = '';
        currentPage = 1;
        await loadHistory();
    }

    function close() {
        els.drawer.classList.remove('show');
        els.mask.classList.remove('show');
        isOpen = false;
    }

    async function loadHistory() {
        els.loading.style.display = 'block';
        els.empty.style.display = 'none';
        els.list.innerHTML = '';

        const oldPager = document.querySelector('.drawer-pagination');
        if (oldPager) oldPager.remove();

        try {
            const data = await API.getHistory(currentPage, searchQuery);
            const routes = data.routes || [];
            const total = data.total || 0;
            totalPages = Math.ceil(total / (data.limit || 20));

            els.loading.style.display = 'none';

            if (routes.length === 0) {
                els.empty.style.display = 'block';
                const txt = document.querySelector('#drawerEmpty .empty-text');
                if (txt) txt.textContent = searchQuery ? '未找到匹配的路线' : '暂无历史路线';
            } else {
                renderList(routes);
                if (totalPages > 1) renderPagination();
            }
        } catch (err) {
            els.loading.style.display = 'none';
            els.list.innerHTML = `
                <div class="drawer-empty">
                    <p style="color: var(--color-error);">加载失败: ${escapeHtml(err.message)}</p>
                    <button class="drawer-retry-btn" data-action="retry">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 8a6 6 0 0111.3-3.5M14 8a6 6 0 01-11.3 3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><polyline points="12.7,2 13,4.5 10.5,4.2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                        重试
                    </button>
                </div>
            `;
            els.list.querySelector('[data-action="retry"]').addEventListener('click', () => loadHistory());
        }
    }

    function renderPagination() {
        const pager = document.createElement('div');
        pager.className = 'drawer-pagination';
        pager.innerHTML = `
            <button class="drawer-page-btn" ${currentPage <= 1 ? 'disabled' : ''} data-page="prev">上一页</button>
            <span class="drawer-page-info">${currentPage} / ${totalPages}</span>
            <button class="drawer-page-btn" ${currentPage >= totalPages ? 'disabled' : ''} data-page="next">下一页</button>
        `;
        els.list.parentElement.appendChild(pager);

        pager.querySelector('[data-page="prev"]').addEventListener('click', () => {
            if (currentPage > 1) { currentPage--; loadHistory(); }
        });
        pager.querySelector('[data-page="next"]').addEventListener('click', () => {
            if (currentPage < totalPages) { currentPage++; loadHistory(); }
        });
    }

    function renderList(routes) {
        els.list.innerHTML = routes.map(route => {
            const date = route.created_at
                ? new Date(route.created_at).toLocaleDateString('zh-CN', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                  })
                : '未知时间';

            return `
                <div class="history-item" data-id="${route.id}" data-action="select">
                    <div class="history-item-name">${escapeHtml(route.route_name || '未命名路线')}</div>
                    <div class="history-item-meta">
                        <span class="history-item-city">📍 ${escapeHtml(route.city || '未知城市')}</span>
                        ${route.theme ? `<span class="history-item-theme">${escapeHtml(route.theme)}</span>` : ''}
                        <span style="font-size: 12px; color: var(--color-placeholder);">
                            ${route.waypoint_count || 0} 个途经点
                        </span>
                    </div>
                    <div class="history-item-bottom">
                        <span class="history-item-date">${date}</span>
                        <button class="history-item-delete" data-id="${route.id}" data-action="delete">
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 4h10M5 4V2.5a1 1 0 011-1h2a1 1 0 011 1V4M11 4v6.5a1 1 0 01-1 1H4a1 1 0 01-1-1V4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
                            删除
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        els.list.removeEventListener('click', handleListClick);
        els.list.addEventListener('click', handleListClick);
    }

    function handleListClick(e) {
        const action = e.target.dataset.action || e.target.closest('[data-action]')?.dataset.action;
        const id = parseInt(e.target.dataset.id || e.target.closest('[data-id]')?.dataset.id);

        if (!id) return;

        if (action === 'delete') {
            e.stopPropagation();
            handleDelete(id);
        } else if (action === 'select') {
            handleSelect(id);
        }
    }

    async function handleSelect(id) {
        try {
            const routeData = await API.getRouteDetail(id);
            close();
            if (onSelectCallback) {
                onSelectCallback(routeData);
            }
        } catch (err) {
            App.showToast(`加载路线失败: ${err.message}`, 'error');
        }
    }

    async function handleDelete(id) {
        const confirmed = await App.showConfirm('确定要删除这条路线吗？此操作不可撤销。');
        if (!confirmed) return;

        try {
            await API.deleteRoute(id);
            App.showToast('路线已删除', 'success');
            await loadHistory();
        } catch (err) {
            App.showToast(`删除失败: ${err.message}`, 'error');
        }
    }

    async function refresh() {
        await loadHistory();
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    return {
        init,
        open,
        close,
        refresh,
        isOpen: () => isOpen,
    };
})();
