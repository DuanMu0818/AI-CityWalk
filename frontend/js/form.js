/**
 * 表单模块
 * 管理偏好表单的交互：胶囊按钮选择、字数统计、数据收集和验证
 */

const Form = (() => {
    // 缓存 DOM 引用
    const els = {};
    let isInitialized = false;

    /**
     * 初始化表单 — 绑定所有事件 + 恢复缓存状态
     */
    function init() {
        if (isInitialized) return;
        cacheElements();
        bindEvents();
        restoreFormState();  // 恢复 localStorage 缓存的表单状态
        isInitialized = true;
    }

    // 定位按钮回调（由 app.js 注册）
    let onLocateCallback = null;

    /** 缓存所有表单元素引用 */
    function cacheElements() {
        els.inputCity = document.getElementById('inputCity');
        els.inputDescription = document.getElementById('inputDescription');
        els.charCount = document.getElementById('charCount');
        els.btnGenerate = document.getElementById('btnGenerate');
        els.btnLocate = document.getElementById('btnLocate');
        els.themeGroup = document.getElementById('themeGroup');
        els.timeEnergyGroup = document.getElementById('timeEnergyGroup');
        els.budgetGroup = document.getElementById('budgetGroup');
        els.specialNeedsGroup = document.getElementById('specialNeedsGroup');
    }

    /** 绑定事件监听 */
    function bindEvents() {
        // 城市输入 — Enter 键直接触发生成
        els.inputCity.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                els.btnGenerate.click();
            }
        });

        // 补充描述 — 字数统计 v2（含进度条）
        els.inputDescription.addEventListener('input', () => {
            const len = els.inputDescription.value.length;
            const max = 300;
            els.charCount.textContent = `${len} / ${max}`;

            // 进度条
            const bar = document.getElementById('charCountBar');
            if (bar) {
                const pct = Math.min((len / max) * 100, 100);
                bar.style.setProperty('--char-pct', pct + '%');
            }

            if (len > 280) {
                els.charCount.style.color = 'var(--color-error)';
                if (bar) bar.style.setProperty('--char-color', 'var(--color-error)');
            } else if (len > 250) {
                els.charCount.style.color = 'var(--color-orange)';
                if (bar) bar.style.setProperty('--char-color', 'var(--color-orange)');
            } else {
                els.charCount.style.color = 'var(--color-text-secondary)';
                if (bar) bar.style.setProperty('--char-color', 'var(--color-primary)');
            }
        });

        // 胶囊按钮 — 单选组 + 多选组
        initCapsuleGroup(els.themeGroup, true);    // 主题：多选
        initCapsuleGroup(els.timeEnergyGroup, false);
        initCapsuleGroup(els.budgetGroup, false);

        // 胶囊按钮 — 多选组（特殊需求）
        initCapsuleGroup(els.specialNeedsGroup, true);

        // 定位按钮 — 点击时触发注册的回调
        if (els.btnLocate) {
            els.btnLocate.addEventListener('click', () => {
                if (onLocateCallback) {
                    onLocateCallback();
                }
            });
        }

        // 表单自动保存 — 任何变更后 500ms 写入 localStorage
        let saveTimeout;
        const autoSave = () => {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(saveFormState, 500);
        };
        els.inputCity.addEventListener('input', autoSave);
        els.inputDescription.addEventListener('input', autoSave);
        [els.themeGroup, els.timeEnergyGroup, els.budgetGroup, els.specialNeedsGroup].forEach(group => {
            if (group) group.addEventListener('click', autoSave);
        });
    }

    /**
     * 初始化胶囊按钮组的点击行为
     * @param {HTMLElement} groupEl - 胶囊组容器元素
     * @param {boolean} isMulti - 是否支持多选
     */
    function initCapsuleGroup(groupEl, isMulti) {
        if (!groupEl) return;

        groupEl.addEventListener('click', (e) => {
            const capsule = e.target.closest('.capsule');
            if (!capsule) return;

            if (isMulti) {
                // 多选：切换 active 状态
                capsule.classList.toggle('active');
            } else {
                // 单选：如果点击的是已选中的 → 取消选中，否则切换
                if (capsule.classList.contains('active')) {
                    capsule.classList.remove('active');
                } else {
                    const siblings = groupEl.querySelectorAll('.capsule');
                    siblings.forEach(s => s.classList.remove('active'));
                    capsule.classList.add('active');
                }
            }
        });
    }

    /**
     * 收集表单数据
     * @returns {{city: string, theme: string, time_energy: string, budget: string, special_needs: string[], description: string}}
     */
    function getFormData() {
        // 获取单选组的值
        const getSelected = (groupEl) => {
            const active = groupEl?.querySelector('.capsule.active');
            return active ? active.dataset.value : '';
        };

        // 获取多选组的值
        const getMultiSelected = (groupEl) => {
            if (!groupEl) return [];
            const actives = groupEl.querySelectorAll('.capsule.active');
            return Array.from(actives).map(el => el.dataset.value);
        };

        return {
            city: els.inputCity.value.trim(),
            theme: getMultiSelected(els.themeGroup).join('、'),  // 多选主题用、连接
            time_energy: getSelected(els.timeEnergyGroup),
            budget: getSelected(els.budgetGroup),
            special_needs: getMultiSelected(els.specialNeedsGroup),
            description: els.inputDescription.value.trim(),
        };
    }

    /**
     * 验证表单数据
     * @param {object} data - 表单数据
     * @returns {{valid: boolean, error?: string}}
     */
    function validate(data) {
        if (!data.city) {
            return { valid: false, error: '请输入城市名称' };
        }
        if (data.city.length < 2) {
            return { valid: false, error: '城市名称至少需要 2 个字符' };
        }
        return { valid: true };
    }

    /**
     * 设置生成按钮的加载状态
     * @param {boolean} loading - 是否加载中
     */
    function setLoading(loading) {
        if (loading) {
            els.btnGenerate.disabled = true;
            els.btnGenerate.textContent = '⏳ 正在规划路线...';
        } else {
            els.btnGenerate.disabled = false;
            els.btnGenerate.textContent = '🚀 生成路线';
        }
    }

    /**
     * 高亮显示城市输入框错误
     */
    function showCityError() {
        els.inputCity.style.borderColor = 'var(--color-error)';
        els.inputCity.focus();
        setTimeout(() => {
            els.inputCity.style.borderColor = 'var(--color-border)';
        }, 2000);
    }

    /**
     * 程序化设置城市名称（定位成功后自动填充）+ 视觉反馈
     * @param {string} city - 城市名
     */
    function setCity(city) {
        if (els.inputCity) {
            els.inputCity.value = city;
            // 添加视觉反馈——输入框短暂变绿 + 显示定位成功标记
            els.inputCity.style.borderColor = 'var(--color-success)';
            els.inputCity.style.background = 'rgba(103,194,58,0.05)';

            // 移除旧标记
            const oldBadge = document.querySelector('.locate-success-badge');
            if (oldBadge) oldBadge.remove();

            // 添加定位成功标记
            const badge = document.createElement('span');
            badge.className = 'locate-success-badge';
            badge.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" fill="#67C23A"/><polyline points="4,7 6.5,9.5 10,5" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg> 已定位`;
            els.inputCity.parentElement.appendChild(badge);

            setTimeout(() => {
                els.inputCity.style.borderColor = 'var(--color-border)';
                els.inputCity.style.background = '#FAFBFC';
                if (badge) badge.style.opacity = '0';
                setTimeout(() => { if (badge) badge.remove(); }, 400);
            }, 2500);
        }
    }

    /**
     * 设置定位按钮的加载状态
     * @param {boolean} locating - 是否正在定位
     */
    function setLocating(locating) {
        if (!els.btnLocate) return;
        if (locating) {
            els.btnLocate.classList.add('loading');
            els.btnLocate.textContent = '⏳';
        } else {
            els.btnLocate.classList.remove('loading');
            els.btnLocate.textContent = '📍';
        }
    }

    /**
     * 保存表单状态到 localStorage
     */
    function saveFormState() {
        try {
            const data = {
                city: els.inputCity?.value || '',
                description: els.inputDescription?.value || '',
                theme: getMultiSelectedValues(els.themeGroup),  // 多选主题全部保存
                timeEnergy: getSelectedValue(els.timeEnergyGroup),
                budget: getSelectedValue(els.budgetGroup),
                specialNeeds: getMultiSelectedValues(els.specialNeedsGroup),
            };
            localStorage.setItem('citywalk_form', JSON.stringify(data));
        } catch (e) { /* localStorage 不可用时静默失败 */ }
    }

    /**
     * 从 localStorage 恢复表单状态
     */
    function restoreFormState() {
        try {
            const raw = localStorage.getItem('citywalk_form');
            if (!raw) return;
            const data = JSON.parse(raw);

            if (data.city && els.inputCity) els.inputCity.value = data.city;
            if (data.description && els.inputDescription) {
                els.inputDescription.value = data.description;
                // 触发字数统计更新
                els.inputDescription.dispatchEvent(new Event('input'));
            }
            // theme 现在是数组，逐个恢复
            const themes = Array.isArray(data.theme) ? data.theme : [data.theme];
            themes.forEach(v => restoreCapsule(els.themeGroup, v, true));
            restoreCapsule(els.timeEnergyGroup, data.timeEnergy, false);
            restoreCapsule(els.budgetGroup, data.budget, false);
            if (data.specialNeeds && Array.isArray(data.specialNeeds)) {
                data.specialNeeds.forEach(v => restoreCapsule(els.specialNeedsGroup, v, true));
            }
        } catch (e) { /* 数据损坏时静默失败 */ }
    }

    /** 获取单选组的值 */
    function getSelectedValue(groupEl) {
        const active = groupEl?.querySelector('.capsule.active');
        return active ? active.dataset.value : '';
    }

    /** 获取多选组的值 */
    function getMultiSelectedValues(groupEl) {
        if (!groupEl) return [];
        return Array.from(groupEl.querySelectorAll('.capsule.active')).map(el => el.dataset.value);
    }

    /** 恢复胶囊选中状态 */
    function restoreCapsule(groupEl, value, isMulti) {
        if (!groupEl || !value) return;
        const target = groupEl.querySelector(`[data-value="${CSS.escape(value)}"]`);
        if (target) {
            if (!isMulti) target.classList.add('active');
            else target.classList.add('active');
        }
    }

    /**
     * 注册定位按钮点击的回调
     * @param {Function} callback
     */
    function onLocate(callback) {
        onLocateCallback = callback;
    }

    // 公开 API
    return {
        init,
        getFormData,
        validate,
        setLoading,
        setCity,
        setLocating,
        onLocate,
        showCityError,
    };
})();
