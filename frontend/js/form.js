const Form = (() => {
    const els = {};
    let isInitialized = false;

    function init() {
        if (isInitialized) return;
        cacheElements();
        bindEvents();
        restoreFormState();
        isInitialized = true;
    }

    let onLocateCallback = null;

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

    function bindEvents() {
        els.inputCity.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                els.btnGenerate.click();
            }
        });

        els.inputDescription.addEventListener('input', () => {
            const len = els.inputDescription.value.length;
            const max = 300;
            els.charCount.textContent = `${len} / ${max}`;

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

        initCapsuleGroup(els.themeGroup, true);
        initCapsuleGroup(els.timeEnergyGroup, false);
        initCapsuleGroup(els.budgetGroup, false);

        initCapsuleGroup(els.specialNeedsGroup, true);

        if (els.btnLocate) {
            els.btnLocate.addEventListener('click', () => {
                if (onLocateCallback) {
                    onLocateCallback();
                }
            });
        }

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

    function initCapsuleGroup(groupEl, isMulti) {
        if (!groupEl) return;

        groupEl.addEventListener('click', (e) => {
            const capsule = e.target.closest('.capsule');
            if (!capsule) return;

            if (isMulti) {
                capsule.classList.toggle('active');
            } else {
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

    function getFormData() {
        const getSelected = (groupEl) => {
            const active = groupEl?.querySelector('.capsule.active');
            return active ? active.dataset.value : '';
        };

        const getMultiSelected = (groupEl) => {
            if (!groupEl) return [];
            const actives = groupEl.querySelectorAll('.capsule.active');
            return Array.from(actives).map(el => el.dataset.value);
        };

        return {
            city: els.inputCity.value.trim(),
            theme: getMultiSelected(els.themeGroup).join('、'),
            time_energy: getSelected(els.timeEnergyGroup),
            budget: getSelected(els.budgetGroup),
            special_needs: getMultiSelected(els.specialNeedsGroup),
            description: els.inputDescription.value.trim(),
        };
    }

    function validate(data) {
        if (!data.city) {
            return { valid: false, error: '请输入城市名称' };
        }
        if (data.city.length < 2) {
            return { valid: false, error: '城市名称至少需要 2 个字符' };
        }
        return { valid: true };
    }

    function setLoading(loading) {
        if (loading) {
            els.btnGenerate.disabled = true;
            els.btnGenerate.textContent = '⏳ 正在规划路线...';
        } else {
            els.btnGenerate.disabled = false;
            els.btnGenerate.textContent = '🚀 生成路线';
        }
    }

    function showCityError() {
        els.inputCity.style.borderColor = 'var(--color-error)';
        els.inputCity.focus();
        setTimeout(() => {
            els.inputCity.style.borderColor = 'var(--color-border)';
        }, 2000);
    }

    function setCity(city) {
        if (els.inputCity) {
            els.inputCity.value = city;
            els.inputCity.style.borderColor = 'var(--color-success)';
            els.inputCity.style.background = 'rgba(103,194,58,0.05)';

            const oldBadge = document.querySelector('.locate-success-badge');
            if (oldBadge) oldBadge.remove();

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

    function saveFormState() {
        try {
            const data = {
                city: els.inputCity?.value || '',
                description: els.inputDescription?.value || '',
                theme: getMultiSelectedValues(els.themeGroup),
                timeEnergy: getSelectedValue(els.timeEnergyGroup),
                budget: getSelectedValue(els.budgetGroup),
                specialNeeds: getMultiSelectedValues(els.specialNeedsGroup),
            };
            localStorage.setItem('citywalk_form', JSON.stringify(data));
        } catch (e) { /* localStorage 不可用时静默失败 */ }
    }

    function restoreFormState() {
        try {
            const raw = localStorage.getItem('citywalk_form');
            if (!raw) return;
            const data = JSON.parse(raw);

            if (data.city && els.inputCity) els.inputCity.value = data.city;
            if (data.description && els.inputDescription) {
                els.inputDescription.value = data.description;
                els.inputDescription.dispatchEvent(new Event('input'));
            }
            const themes = Array.isArray(data.theme) ? data.theme : [data.theme];
            themes.forEach(v => restoreCapsule(els.themeGroup, v, true));
            restoreCapsule(els.timeEnergyGroup, data.timeEnergy, false);
            restoreCapsule(els.budgetGroup, data.budget, false);
            if (data.specialNeeds && Array.isArray(data.specialNeeds)) {
                data.specialNeeds.forEach(v => restoreCapsule(els.specialNeedsGroup, v, true));
            }
        } catch (e) { /* 数据损坏时静默失败 */ }
    }

    function getSelectedValue(groupEl) {
        const active = groupEl?.querySelector('.capsule.active');
        return active ? active.dataset.value : '';
    }

    function getMultiSelectedValues(groupEl) {
        if (!groupEl) return [];
        return Array.from(groupEl.querySelectorAll('.capsule.active')).map(el => el.dataset.value);
    }

    function restoreCapsule(groupEl, value, isMulti) {
        if (!groupEl || !value) return;
        const target = groupEl.querySelector(`[data-value="${CSS.escape(value)}"]`);
        if (target) {
            if (!isMulti) target.classList.add('active');
            else target.classList.add('active');
        }
    }

    function onLocate(callback) {
        onLocateCallback = callback;
    }

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
