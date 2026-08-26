// ui.js

const UI = (() => {
    let selectedOrderId = null;
    let selectedRoverId = null;

    // ---------- Цвет срочности (жёлтый → красный) ----------
    function getUrgencyColor(urgency, maxUrgency) {
        const pct = Math.max(0, Math.min(1, urgency / maxUrgency));
        const hue = Math.round(pct * 50);
        return `hsl(${hue}, 85%, 55%)`;
    }

    // ---------- Цвет рейтинга (зелёный → красный) ----------
    function getReputationColor(reputation, max) {
        const pct = Math.max(0, Math.min(1, reputation / max));
        const hue = Math.round(pct * 120);
        return `hsl(${hue}, 70%, 55%)`;
    }

    // ---------- Проверка доступности заказа для ровера ----------
    function isOrderAvailableForRover(rover, order) {
        if (!rover || rover.status !== ROVER_STATUS.IDLE) return false;
        if (order.weight > rover.capacity) return false;
        const activeDelivery = Game.deliveries.find(d => d.orderId === order.id);
        if (activeDelivery) return false;
        try {
            const calc = Game.calculateDeliveryCost(rover, order);
            if (calc.batteryCost > rover.battery) return false;
        } catch (e) {
            return false;
        }
        return true;
    }

    function init() {
        const mapContainer = document.querySelector('.map-container');
        if (mapContainer) {
            mapContainer.addEventListener('click', (e) => {
                const orderEl = e.target.closest('.order-marker');
                const roverEl = e.target.closest('.rover-marker');
                if (orderEl) selectOrder(parseInt(orderEl.dataset.orderId));
                else if (roverEl) selectRover(parseInt(roverEl.dataset.roverId));
            });
        }

        document.getElementById('btn-deliver')?.addEventListener('click', onDeliver);
        document.getElementById('btn-new-game')?.addEventListener('click', onNewGame);
        document.getElementById('btn-pause')?.addEventListener('click', onPause);
        document.getElementById('btn-restart')?.addEventListener('click', () => location.reload());

        const speedSlider = document.getElementById('speed-slider');
        if (speedSlider) {
            speedSlider.addEventListener('input', onSpeedChange);
            updateSpeedDisplay();
        }

        document.getElementById('btn-buy-scout')?.addEventListener('click', () => onBuy('scout'));
        document.getElementById('btn-buy-hauler')?.addEventListener('click', () => onBuy('hauler'));
        document.getElementById('btn-buy-explorer')?.addEventListener('click', () => onBuy('explorer'));

        updateBuyButtons();
    }

    function updateBuyButtons() {
        const setBtnText = (id, type) => {
            const btn = document.getElementById(id);
            if (btn) btn.textContent = `${ROVER_TYPES[type].label} (${ROVER_TYPES[type].cost}💰)`;
        };
        setBtnText('btn-buy-scout', 'scout');
        setBtnText('btn-buy-hauler', 'hauler');
        setBtnText('btn-buy-explorer', 'explorer');
    }

    function renderTopBar() {
        const s = Game.state;
        if (!s) return;
        const valMoney = document.getElementById('val-money');
        const valRep = document.getElementById('val-reputation');
        const valSol = document.getElementById('val-sol');
        const valTick = document.getElementById('val-tick');
        const repBar = document.getElementById('reputation-bar');

        if (valMoney) valMoney.textContent = s.money;
        if (valRep) {
            valRep.textContent = s.reputation;
            valRep.style.color = getReputationColor(s.reputation, GAME_CONFIG.MAX_REPUTATION);
        }
        if (valSol) valSol.textContent = s.sol;
        if (valTick) valTick.textContent = s.tick;
        if (repBar) {
            repBar.style.width = (s.reputation / GAME_CONFIG.MAX_REPUTATION * 100) + '%';
            repBar.style.background = getReputationColor(s.reputation, GAME_CONFIG.MAX_REPUTATION);
        }
    }

    // ---------- Карточки роверов (с переиспользованием DOM) ----------
    function renderRovers() {
        const list = document.getElementById('rovers-list');
        if (!list) return;

        // Собираем существующие карточки в Map для переиспользования
        const existingCards = new Map();
        list.querySelectorAll('.rover-card').forEach(card => {
            const id = parseInt(card.dataset.roverId);
            if (!isNaN(id)) existingCards.set(id, card);
        });

        const tmpl = document.getElementById('tmpl-rover-card');

        for (const r of Game.rovers) {
            const type = ROVER_TYPES[r.type];
            const batteryPct = Math.round(r.battery / r.maxBattery * 100);
            const activeDelivery = Game.deliveries.find(d => d.roverId === r.id);
            const deliveryOrder = activeDelivery ? Game.orders.find(o => o.id === activeDelivery.orderId) : null;
            const deliveryProgress = activeDelivery ? Math.round((activeDelivery.step / activeDelivery.totalSteps) * 100) : 0;

            let card = existingCards.get(r.id);

            // Создаём карточку только если её ещё нет
            if (!card) {
                card = tmpl.content.cloneNode(true).firstElementChild;
                card.dataset.roverId = r.id;
                card.addEventListener('click', (e) => {
                    if (e.target.closest('button')) return;
                    selectRover(r.id);
                });
                list.appendChild(card);
            }

            // Обновляем состояние карточки
            card.classList.toggle('selected', r.id === selectedRoverId);
            card.classList.toggle('busy', r.status === ROVER_STATUS.DELIVERING);

            card.querySelector('.rover-name').textContent = r.name;
            card.querySelector('.rover-type').textContent = type.label;

            const statusEl = card.querySelector('.rover-status');
            statusEl.className = `rover-status status-${r.status}`;
            statusEl.textContent = TEXTS['status_' + r.status];

            const deliveryInfo = card.querySelector('.rover-delivery-info');
            if (activeDelivery && deliveryOrder) {
                deliveryInfo.style.display = 'flex';
                deliveryInfo.querySelector('.delivery-badge').textContent = `📦 ${TEXTS.orderBadge} #${deliveryOrder.id}`;
                deliveryInfo.querySelector('.progress-fill').style.width = `${deliveryProgress}%`;
                deliveryInfo.querySelector('.progress-text').textContent = `${deliveryProgress}%`;
            } else {
                deliveryInfo.style.display = 'none';
            }

            card.querySelector('.stat-label-battery').textContent = `⚡ ${TEXTS.battery}`;
            card.querySelector('.bar-fill').style.width = `${batteryPct}%`;
            card.querySelector('.stat-val-battery').textContent = `${Math.round(r.battery)}/${r.maxBattery}`;

            card.querySelector('.stat-label-capacity').textContent = `📦 ${TEXTS.capacity}`;
            card.querySelector('.stat-val-capacity').textContent = `${r.capacity} ${TEXTS.kg}`;

            // Перестраиваем кнопки (их мало, и они зависят от состояния)
            const actions = card.querySelector('.rover-actions');
            actions.innerHTML = '';
            if (r.status === ROVER_STATUS.IDLE) {
                const btn = document.createElement('button');
                btn.className = 'btn btn-small';
                btn.textContent = `⚡ ${TEXTS.charge}`;
                btn.addEventListener('click', (e) => { e.stopPropagation(); doChargeRover(r.id); });
                actions.appendChild(btn);
            } else if (r.status === ROVER_STATUS.BROKEN) {
                const btn = document.createElement('button');
                btn.className = 'btn btn-small btn-danger';
                btn.textContent = `🔧 ${TEXTS.repair} (${GAME_CONFIG.REPAIR_COST}💰)`;
                btn.addEventListener('click', (e) => { e.stopPropagation(); doRepairRover(r.id); });
                actions.appendChild(btn);
            }

            existingCards.delete(r.id);
        }

        // Удаляем только те карточки, которых больше нет в списке роверов
        existingCards.forEach(card => card.remove());
    }

    // ---------- Карточки заказов (с переиспользованием DOM) ----------
    function renderOrders() {
        const list = document.getElementById('orders-list');
        if (!list) return;

        const pending = Game.orders.filter(o => o.status === ORDER_STATUS.PENDING);
        const selectedRover = selectedRoverId ? Game.rovers.find(r => r.id === selectedRoverId) : null;

        // Собираем существующие карточки в Map для переиспользования
        const existingCards = new Map();
        list.querySelectorAll('.order-card').forEach(card => {
            const id = parseInt(card.dataset.orderId);
            if (!isNaN(id)) existingCards.set(id, card);
        });

        // Если заказов нет — показываем подсказку
        if (!pending.length) {
            existingCards.forEach(card => card.remove());
            if (!list.querySelector('.empty-hint')) {
                const hint = document.createElement('div');
                hint.className = 'empty-hint';
                hint.textContent = TEXTS.noActiveOrders;
                list.appendChild(hint);
            }
            return;
        }

        const hint = list.querySelector('.empty-hint');
        if (hint) hint.remove();

        const tmpl = document.getElementById('tmpl-order-card');
        for (const o of pending) {
            let card = existingCards.get(o.id);

            // Создаём карточку только если её ещё нет
            if (!card) {
                card = tmpl.content.cloneNode(true).firstElementChild;
                card.dataset.orderId = o.id;
                card.addEventListener('click', () => selectOrder(o.id));
                list.appendChild(card);
            }

            // Обновляем состояние карточки
            card.classList.toggle('selected', o.id === selectedOrderId);
            card.classList.toggle('in-progress', o.status === ORDER_STATUS.IN_PROGRESS);

            const isAvailable = selectedRover && isOrderAvailableForRover(selectedRover, o);
            card.classList.toggle('available', isAvailable && o.id !== selectedOrderId);

            const bgColor = getUrgencyColor(o.urgency, o.maxUrgency);
            card.style.borderLeftColor = bgColor;

            const urgencyPct = Math.round((o.urgency / o.maxUrgency) * 100);
            let urgencyClass = urgencyPct < 25 ? 'urgency-crit' : (urgencyPct < 50 ? 'urgency-warn' : 'urgency-ok');

            card.querySelector('.order-id').textContent = `#${o.id}`;
            card.querySelector('.order-zone').textContent = ZONE_TYPES[o.zone].label;
            card.querySelector('.order-weight').textContent = `${o.weight} ${TEXTS.kg}`;
            card.querySelector('.order-reward').textContent = o.reward;

            const urgEl = card.querySelector('.order-urgency');
            urgEl.className = `order-urgency ${urgencyClass}`;
            urgEl.textContent = o.urgency;

            card.querySelector('.order-risk').textContent = `${o.risk}%`;

            existingCards.delete(o.id);
        }

        // Удаляем только те карточки, которых больше нет в списке заказов
        existingCards.forEach(card => card.remove());
    }

    function renderDeliveryPanel() {
        const info = document.getElementById('delivery-info');
        const btn = document.getElementById('btn-deliver');
        if (!info || !btn) return;

        let isOrderSelectionValid = false;
        if (selectedOrderId) {
            const order = Game.orders.find(o => o.id === selectedOrderId);
            isOrderSelectionValid = order && order.status === ORDER_STATUS.PENDING && !Game.deliveries.find(d => d.orderId === selectedOrderId);
        }
        if (selectedOrderId && !isOrderSelectionValid) selectedOrderId = null;
        if (selectedRoverId && !Game.rovers.find(r => r.id === selectedRoverId)) selectedRoverId = null;

        info.innerHTML = '';

        if (Game.deliveries.length > 0) {
            const container = document.createElement('div');
            container.className = 'active-deliveries';
            const title = document.createElement('div');
            title.className = 'active-title';
            title.textContent = `🚀 ${TEXTS.activeDeliveries}`;
            container.appendChild(title);

            const tmplItem = document.getElementById('tmpl-active-delivery-item');
            for (const d of Game.deliveries) {
                const rover = Game.rovers.find(r => r.id === d.roverId);
                const order = Game.orders.find(o => o.id === d.orderId);
                if (!rover || !order) continue;

                const progress = Math.round((d.step / d.totalSteps) * 100);
                const item = tmplItem.content.cloneNode(true).firstElementChild;
                item.querySelector('.active-rover').textContent = rover.name;
                item.querySelector('.active-order').textContent = `#${order.id}`;
                item.querySelector('.progress-fill').style.width = `${progress}%`;
                item.querySelector('.active-percent').textContent = `${progress}%`;
                container.appendChild(item);
            }
            info.appendChild(container);
        }

        if (!selectedOrderId || !selectedRoverId) {
            if (Game.deliveries.length === 0) {
                const hint = document.createElement('div');
                hint.className = 'hint';
                hint.appendChild(document.createTextNode(TEXTS.hintSelectOrder));
                hint.appendChild(document.createElement('br'));
                hint.appendChild(document.createTextNode(TEXTS.hintSelectRover));
                info.appendChild(hint);
            }
            btn.disabled = true;
            MapView.renderPath(null);
            return;
        }

        const rover = Game.rovers.find(r => r.id === selectedRoverId);
        const order = Game.orders.find(o => o.id === selectedOrderId);

        if (!rover || !order) {
            const hint = document.createElement('div');
            hint.className = 'hint';
            hint.textContent = TEXTS.selectOrderAndRover;
            info.appendChild(hint);
            btn.disabled = true;
            MapView.renderPath(null);
            return;
        }

        const check = Game.canDeliver(rover, order);
        const calc = check.ok ? check.calc : Game.calculateDeliveryCost(rover, order);

        const main = document.createElement('div');
        main.className = 'delivery-main';

        const headerRow = document.createElement('div');
        headerRow.className = 'delivery-row';
        const headerText = document.createElement('span');
        headerText.textContent = `${rover.name} → ${TEXTS.orderBadge} #${order.id}`;
        headerRow.appendChild(headerText);
        main.appendChild(headerRow);

        const grid = document.createElement('div');
        grid.className = 'delivery-grid';

        const rows = [
            { label: `📏 ${TEXTS.distance}:`, value: `${calc.distance} ${TEXTS.cells}` },
            { label: `🔋 ${TEXTS.battery}:`, value: `${calc.batteryCost} / ${Math.round(rover.battery)}` },
            { label: `📦 ${TEXTS.weight}:`, value: `${order.weight} / ${rover.capacity} ${TEXTS.kg}` },
            { label: `⏱ ${TEXTS.time}:`, value: `~${calc.ticks} ${TEXTS.ticks}` },
            { label: `☠ ${TEXTS.risk}:`, value: `${Math.round(calc.avgRisk * 100)}%` },
            { label: `💰 ${TEXTS.reward}:`, value: `${order.reward}` }
        ];

        const rowTmpl = document.getElementById('tmpl-delivery-row');
        for (const row of rows) {
            const el = rowTmpl.content.cloneNode(true).firstElementChild;
            el.querySelector('.delivery-label').textContent = row.label;
            el.querySelector('.delivery-value').textContent = row.value;
            grid.appendChild(el);
        }
        main.appendChild(grid);

        if (!check.ok) {
            const err = document.createElement('div');
            err.className = 'delivery-error';
            err.textContent = `⚠ ${check.reason}`;
            main.appendChild(err);
        }

        info.appendChild(main);
        btn.disabled = !check.ok;
        MapView.renderPath(check.ok ? calc.path : null);
    }

    function renderEvents() {
        const list = document.getElementById('events-list');
        if (!list) return;
        list.innerHTML = '';
        const tmpl = document.getElementById('tmpl-event-item');
        for (const e of Game.eventLog.slice(0, 30)) {
            const item = tmpl.content.cloneNode(true).firstElementChild;
            item.querySelector('.event-tick').textContent = `[${e.tick}]`;
            item.querySelector('.event-text').textContent = e.text;
            list.appendChild(item);
        }
    }

    function renderAll() {
        renderTopBar();
        renderRovers();
        renderOrders();
        renderDeliveryPanel();
        window._selectedRoverForHighlight = selectedRoverId ? Game.rovers.find(r => r.id === selectedRoverId) : null;
        MapView.renderRovers(Game.rovers, selectedRoverId);
        MapView.renderOrders(Game.orders, selectedOrderId);
    }

    function selectOrder(id) {
        selectedOrderId = (selectedOrderId === id) ? null : id;
        renderOrders();
        renderDeliveryPanel();
        MapView.renderOrders(Game.orders, selectedOrderId);
    }

    function selectRover(id) {
        selectedRoverId = (selectedRoverId === id) ? null : id;
        renderRovers();
        renderDeliveryPanel();
        window._selectedRoverForHighlight = selectedRoverId ? Game.rovers.find(r => r.id === selectedRoverId) : null;
        MapView.renderRovers(Game.rovers, selectedRoverId);
        MapView.renderOrders(Game.orders, selectedOrderId);
    }

    async function onDeliver() {
        if (!selectedOrderId || !selectedRoverId) return;
        const rover = Game.rovers.find(r => r.id === selectedRoverId);
        const order = Game.orders.find(o => o.id === selectedOrderId);

        if (!rover || !order || rover.status !== ROVER_STATUS.IDLE || order.status !== ORDER_STATUS.PENDING) {
            selectedOrderId = null;
            selectedRoverId = null;
            window._selectedRoverForHighlight = null;
            renderAll();
            flashMessage(TEXTS.hintImpossible);
            return;
        }

        const result = await Game.startDelivery(selectedRoverId, selectedOrderId);
        if (!result.ok) {
            flashMessage(result.reason);
            return;
        }
        selectedOrderId = null;
        selectedRoverId = null;
        window._selectedRoverForHighlight = null;
        renderAll();
    }

    async function doChargeRover(id) {
        await Game.chargeRover(id);
        renderAll();
    }

    async function doRepairRover(id) {
        const r = await Game.repairRover(id);
        if (!r.ok) flashMessage(r.reason || TEXTS.cannotAfford);
        renderAll();
    }

    async function onBuy(type) {
        const r = await Game.buyRover(type);
        if (!r.ok) flashMessage(r.reason || TEXTS.cannotAfford);
        renderAll();
    }

    async function onNewGame() {
        if (!confirm('Начать новую игру? Прогресс будет потерян.')) return;
        Game.stop();
        selectedOrderId = null;
        selectedRoverId = null;
        window._selectedRoverForHighlight = null;
        await Game.newGame();
        MapView.renderZones(Game.zones);
        renderAll();
        Game.start();
    }

    function onPause() {
        const btn = document.getElementById('btn-pause');
        if (!btn || !Game.state) return;
        if (Game.state.paused) {
            Game.resume();
            btn.textContent = TEXTS.pause;
        } else {
            Game.pause();
            btn.textContent = TEXTS.resume;
        }
    }

    function updateSpeedDisplay() {
        const slider = document.getElementById('speed-slider');
        const valueLabel = document.getElementById('speed-value');
        if (!slider || !valueLabel) return;
        const speed = Game.getSpeed();
        slider.value = speed;
        valueLabel.textContent = `x${speed.toFixed(1)}`;
        valueLabel.classList.remove('speed-low', 'speed-med', 'speed-high');
        if (speed < 1.5) valueLabel.classList.add('speed-low');
        else if (speed < 2.5) valueLabel.classList.add('speed-med');
        else valueLabel.classList.add('speed-high');
    }

    function onSpeedChange(e) {
        Game.setSpeed(parseFloat(e.target.value));
        updateSpeedDisplay();
    }

    function flashMessage(text) {
        const el = document.getElementById('flash');
        if (!el) return;
        el.textContent = text;
        el.classList.add('show');
        setTimeout(() => el.classList.remove('show'), 2200);
    }

    function showGameOver() {
        const modal = document.getElementById('modal-gameover');
        const gameoverText = document.getElementById('gameover-text');
        if (!modal || !gameoverText) return;
        gameoverText.textContent = TEXTS.gameOverSub.replace('{money}', Game.state.money);
        modal.classList.add('show');
    }

    return {
        init, renderAll, renderEvents, renderTopBar,
        renderRovers, renderOrders, renderDeliveryPanel,
        showGameOver, selectOrder, selectRover,
        updateSpeedDisplay, updateBuyButtons,
    };
})();