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

        const btnDeliver = document.getElementById('btn-deliver');
        if (btnDeliver) btnDeliver.addEventListener('click', onDeliver);

        const btnNewGame = document.getElementById('btn-new-game');
        if (btnNewGame) btnNewGame.addEventListener('click', onNewGame);

        const btnPause = document.getElementById('btn-pause');
        if (btnPause) btnPause.addEventListener('click', onPause);

        const speedSlider = document.getElementById('speed-slider');
        if (speedSlider) {
            speedSlider.addEventListener('input', onSpeedChange);
            updateSpeedDisplay();
        }

        const btnBuyScout = document.getElementById('btn-buy-scout');
        if (btnBuyScout) btnBuyScout.addEventListener('click', () => onBuy('scout'));

        const btnBuyHauler = document.getElementById('btn-buy-hauler');
        if (btnBuyHauler) btnBuyHauler.addEventListener('click', () => onBuy('hauler'));

        const btnBuyExplorer = document.getElementById('btn-buy-explorer');
        if (btnBuyExplorer) btnBuyExplorer.addEventListener('click', () => onBuy('explorer'));

        updateBuyButtons();
    }

    function updateBuyButtons() {
        const btnScout = document.getElementById('btn-buy-scout');
        if (btnScout) btnScout.textContent = `${ROVER_TYPES.scout.label} (${ROVER_TYPES.scout.cost}💰)`;
        
        const btnHauler = document.getElementById('btn-buy-hauler');
        if (btnHauler) btnHauler.textContent = `${ROVER_TYPES.hauler.label} (${ROVER_TYPES.hauler.cost}💰)`;
        
        const btnExplorer = document.getElementById('btn-buy-explorer');
        if (btnExplorer) btnExplorer.textContent = `${ROVER_TYPES.explorer.label} (${ROVER_TYPES.explorer.cost}💰)`;
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

    function renderRovers() {
        const list = document.getElementById('rovers-list');
        if (!list) return;

        const existingCards = new Map();
        list.querySelectorAll('.rover-card').forEach(card => {
            const id = parseInt(card.dataset.roverId);
            if (!isNaN(id)) existingCards.set(id, card);
        });

        for (const r of Game.rovers) {
            const type = ROVER_TYPES[r.type];
            const batteryPct = Math.round(r.battery / r.maxBattery * 100);

            const activeDelivery = Game.deliveries.find(d => d.roverId === r.id);
            const deliveryOrder = activeDelivery ? Game.orders.find(o => o.id === activeDelivery.orderId) : null;
            const deliveryProgress = activeDelivery 
                ? Math.round((activeDelivery.step / activeDelivery.totalSteps) * 100) 
                : 0;

            let card = existingCards.get(r.id);

            if (!card) {
                card = document.createElement('div');
                card.className = 'rover-card';
                card.dataset.roverId = r.id;
                card.addEventListener('click', (e) => {
                    if (e.target.closest('button')) return;
                    selectRover(r.id);
                });
                list.appendChild(card);
            }

            card.classList.toggle('selected', r.id === selectedRoverId);
            card.classList.toggle('busy', r.status === ROVER_STATUS.DELIVERING);

            let deliveryInfo = '';
            if (activeDelivery && deliveryOrder) {
                deliveryInfo = `
                    <div class="rover-delivery-info">
                        <div class="delivery-badge">📦 Заказ #${deliveryOrder.id}</div>
                        <div class="delivery-progress">
                            <div class="progress-bar">
                                <div class="progress-fill" style="width:${deliveryProgress}%"></div>
                            </div>
                            <span class="progress-text">${deliveryProgress}%</span>
                        </div>
                    </div>
                `;
            }

            card.innerHTML = `
                <div class="rover-header">
                    <span class="rover-name">${r.name}</span>
                    <span class="rover-type">${type.label}</span>
                </div>
                <div class="rover-status status-${r.status}">${TEXTS['status_' + r.status]}</div>
                ${deliveryInfo}
                <div class="stat">
                    <span>⚡ ${TEXTS.battery}</span>
                    <div class="bar"><div class="bar-fill battery-fill" style="width:${batteryPct}%"></div></div>
                    <span class="stat-val">${Math.round(r.battery)}/${r.maxBattery}</span>
                </div>
                <div class="stat">
                    <span>📦 ${TEXTS.capacity}</span>
                    <span class="stat-val">${r.capacity} ${TEXTS.kg}</span>
                </div>
                <div class="rover-actions">
                    ${r.status === ROVER_STATUS.IDLE ? `<button class="btn btn-small" data-act="charge" data-id="${r.id}">⚡</button>` : ''}
                    ${r.status === ROVER_STATUS.BROKEN ? `<button class="btn btn-small btn-danger" data-act="repair" data-id="${r.id}">🔧 ${GAME_CONFIG.REPAIR_COST}💰</button>` : ''}
                </div>
            `;

            card.querySelectorAll('button').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const id = parseInt(btn.dataset.id);
                    if (btn.dataset.act === 'charge') doChargeRover(id);
                    else if (btn.dataset.act === 'repair') doRepairRover(id);
                });
            });

            existingCards.delete(r.id);
        }

        existingCards.forEach(card => card.remove());
    }

    function renderOrders() {
        const list = document.getElementById('orders-list');
        if (!list) return;

        const pending = Game.orders.filter(o => o.status === ORDER_STATUS.PENDING);
        const selectedRover = selectedRoverId ? Game.rovers.find(r => r.id === selectedRoverId) : null;

        const existingCards = new Map();
        list.querySelectorAll('.order-card').forEach(card => {
            const id = parseInt(card.dataset.orderId);
            if (!isNaN(id)) existingCards.set(id, card);
        });

        if (!pending.length) {
            existingCards.forEach(card => card.remove());
            if (!list.querySelector('.empty-hint')) {
                list.innerHTML = `<div class="empty-hint">Нет активных заказов</div>`;
            }
            return;
        }

        const hint = list.querySelector('.empty-hint');
        if (hint) hint.remove();

        for (const o of pending) {
            let card = existingCards.get(o.id);

            if (!card) {
                card = document.createElement('div');
                card.className = 'order-card';
                card.dataset.orderId = o.id;
                card.addEventListener('click', () => selectOrder(o.id));
                list.appendChild(card);
            }

            card.classList.toggle('selected', o.id === selectedOrderId);
            card.classList.toggle('in-progress', o.status === ORDER_STATUS.IN_PROGRESS);
            
            const isAvailable = selectedRover && isOrderAvailableForRover(selectedRover, o);
            card.classList.toggle('available', isAvailable && o.id !== selectedOrderId);

            const bgColor = getUrgencyColor(o.urgency, o.maxUrgency);
            card.style.borderLeftColor = bgColor;

            const urgencyPct = Math.round((o.urgency / o.maxUrgency) * 100);
            let urgencyClass = 'urgency-ok';
            if (urgencyPct < 50) urgencyClass = 'urgency-warn';
            if (urgencyPct < 25) urgencyClass = 'urgency-crit';

            card.innerHTML = `
                <div class="order-header">
                    <span class="order-id">#${o.id}</span>
                    <span class="order-zone">${ZONE_TYPES[o.zone].label}</span>
                </div>
                <div class="order-stats">
                    <div><span>📦</span> ${o.weight} ${TEXTS.kg}</div>
                    <div><span>💰</span> ${o.reward}</div>
                    <div><span>⏱</span> <span class="${urgencyClass}">${o.urgency}</span></div>
                    <div><span>☠</span> ${o.risk}%</div>
                </div>
            `;

            existingCards.delete(o.id);
        }

        existingCards.forEach(card => card.remove());
    }

    function renderDeliveryPanel() {
        const info = document.getElementById('delivery-info');
        const btn = document.getElementById('btn-deliver');

        if (!info || !btn) return;

        // --- ЛОГИКА ПРОВЕРКИ ВАЛИДНОСТИ ВЫБОРА ---
        // Сбрасываем выбор, если он стал невалидным из-за изменений в игре
        let isOrderSelectionValid = false;
        let isRoverSelectionValid = false;

        if (selectedOrderId) {
            const order = Game.orders.find(o => o.id === selectedOrderId);
            isOrderSelectionValid = order && order.status === ORDER_STATUS.PENDING;
            if (isOrderSelectionValid) {
                const activeDelivery = Game.deliveries.find(d => d.orderId === selectedOrderId);
                if (activeDelivery) {
                    isOrderSelectionValid = false;
                }
            }
        }

        if (selectedRoverId) {
            const rover = Game.rovers.find(r => r.id === selectedRoverId);
            isRoverSelectionValid = rover && rover.status === ROVER_STATUS.IDLE;
        }

        if (selectedOrderId && !isOrderSelectionValid) {
            selectedOrderId = null;
        }
        if (selectedRoverId && !isRoverSelectionValid) {
            selectedRoverId = null;
        }
        // --- КОНЕЦ ПРОВЕРКИ ВАЛИДНОСТИ ---

        let activeDeliveriesHtml = '';
        if (Game.deliveries.length > 0) {
            const items = Game.deliveries.map(d => {
                const rover = Game.rovers.find(r => r.id === d.roverId);
                const order = Game.orders.find(o => o.id === d.orderId);
                if (!rover || !order) return '';
                const progress = Math.round((d.step / d.totalSteps) * 100);
                return `
                    <div class="active-delivery-item">
                        <span class="active-rover">${rover.name}</span>
                        <span class="active-arrow">→</span>
                        <span class="active-order">#${order.id}</span>
                        <div class="active-progress">
                            <div class="progress-fill" style="width:${progress}%"></div>
                        </div>
                        <span class="active-percent">${progress}%</span>
                    </div>
                `;
            }).join('');
            activeDeliveriesHtml = `
                <div class="active-deliveries">
                    <div class="active-title">🚀 В пути:</div>
                    ${items}
                </div>
            `;
        }

        if (!selectedOrderId || !selectedRoverId) {
            info.innerHTML = `
                ${activeDeliveriesHtml}
                ${activeDeliveriesHtml ? '' : `<div class="hint">${TEXTS.hintSelectOrder}<br>${TEXTS.hintSelectRover}</div>`}
            `;
            btn.disabled = true;
            MapView.renderPath(null);
            return;
        }

        const rover = Game.rovers.find(r => r.id === selectedRoverId);
        const order = Game.orders.find(o => o.id === selectedOrderId);

        if (!rover || !order) {
            info.innerHTML = `<div class="hint">Выберите заказ и ровера</div>`;
            btn.disabled = true;
            MapView.renderPath(null);
            return;
        }

        const check = Game.canDeliver(rover, order);
        const calc = check.ok ? check.calc : Game.calculateDeliveryCost(rover, order);

        info.innerHTML = `
            ${activeDeliveriesHtml}
            <div class="delivery-main">
                <div class="delivery-row"><span>${rover.name} → Заказ #${order.id}</span></div>
                <div class="delivery-grid">
                    <div class="delivery-row"><span>📏 ${TEXTS.distance}:</span><b>${calc.distance} ${TEXTS.cells}</b></div>
                    <div class="delivery-row"><span>🔋 ${TEXTS.battery}:</span><b>${calc.batteryCost} / ${Math.round(rover.battery)}</b></div>
                    <div class="delivery-row"><span>📦 ${TEXTS.weight}:</span><b>${order.weight} / ${rover.capacity} ${TEXTS.kg}</b></div>
                    <div class="delivery-row"><span>⏱ Время:</span><b>~${calc.ticks} тиков</b></div>
                    <div class="delivery-row"><span>☠ Риск:</span><b>${Math.round(calc.avgRisk * 100)}%</b></div>
                    <div class="delivery-row"><span>💰 Награда:</span><b>${order.reward}</b></div>
                </div>
                ${!check.ok ? `<div class="delivery-error">⚠ ${check.reason}</div>` : ''}
            </div>
        `;
        btn.disabled = !check.ok;

        if (check.ok) {
            MapView.renderPath(calc.path);
        } else {
            MapView.renderPath(null);
        }
    }

    function renderEvents() {
        const list = document.getElementById('events-list');
        if (!list) return;
        list.innerHTML = '';
        for (const e of Game.eventLog.slice(0, 30)) {
            const item = document.createElement('div');
            item.className = 'event-item';
            item.innerHTML = `<span class="event-tick">[${e.tick}]</span> ${e.text}`;
            list.appendChild(item);
        }
    }

    function renderAll() {
        renderTopBar();
        renderRovers();
        renderOrders();
        renderDeliveryPanel();
        const selectedRover = selectedRoverId ? Game.rovers.find(r => r.id === selectedRoverId) : null;
        window._selectedRoverForHighlight = selectedRover;
        MapView.renderRovers(Game.rovers, selectedRoverId);
        MapView.renderOrders(Game.orders, selectedOrderId);
    }

    // УПРОЩЕНО: просто переключаем выбор, валидация происходит в renderDeliveryPanel
    function selectOrder(id) {
        selectedOrderId = (selectedOrderId === id) ? null : id;
        renderOrders();
        renderDeliveryPanel();
        MapView.renderOrders(Game.orders, selectedOrderId);
    }

    // УПРОЩЕНО: просто переключаем выбор, валидация происходит в renderDeliveryPanel
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
        
        // ФИНАЛЬНАЯ ПРОВЕРКА перед запуском доставки
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

    // ИЗМЕНЕНО: убрана задержка setTimeout, скорость меняется мгновенно
    function onSpeedChange(e) {
        const newSpeed = parseFloat(e.target.value);
        Game.setSpeed(newSpeed);
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