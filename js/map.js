// map.js

const MapView = (() => {
    let mapEl = null;
    let overlayEl = null;

    function getUrgencyColor(urgency, maxUrgency) {
        const pct = Math.max(0, Math.min(1, urgency / maxUrgency));
        const hue = Math.round(pct * 50);
        return `hsl(${hue}, 85%, 55%)`;
    }

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

    function init(container) {
        mapEl = document.createElement('div');
        mapEl.className = 'lunar-map';
        mapEl.style.gridTemplateColumns = `repeat(${GAME_CONFIG.MAP_SIZE}, ${GAME_CONFIG.CELL_SIZE}px)`;
        mapEl.style.gridTemplateRows = `repeat(${GAME_CONFIG.MAP_SIZE}, ${GAME_CONFIG.CELL_SIZE}px)`;

        overlayEl = document.createElement('div');
        overlayEl.className = 'map-overlay';
        mapEl.appendChild(overlayEl);

        container.innerHTML = '';
        container.appendChild(mapEl);
    }

    function renderZones(zones) {
        if (!mapEl) return;

        const savedOverlay = overlayEl;
        mapEl.innerHTML = '';
        mapEl.appendChild(savedOverlay);

        for (const z of zones) {
            const cell = document.createElement('div');
            cell.className = `map-cell ${ZONE_TYPES[z.type].cssClass}`;
            cell.dataset.x = z.x;
            cell.dataset.y = z.y;
            cell.dataset.zone = z.type;

            if (z.type === 'base') {
                cell.innerHTML = '<span class="base-icon">⚑</span>';
                cell.title = TEXTS.legendBase;
            } else {
                const seed = (z.x * 31 + z.y * 17) % 100;
                if (z.type === 'craters' && seed < 30) {
                    cell.innerHTML = '<span class="deco crater-deco"></span>';
                } else if (z.type === 'mountains' && seed < 40) {
                    cell.innerHTML = '<span class="deco mountain-deco">▲</span>';
                } else if (z.type === 'darkside' && seed < 20) {
                    cell.innerHTML = '<span class="deco dark-deco">✦</span>';
                }
            }
            mapEl.appendChild(cell);
        }
    }

    function cellToPixel(x, y) {
        return {
            px: x * GAME_CONFIG.CELL_SIZE + GAME_CONFIG.CELL_SIZE / 2,
            py: y * GAME_CONFIG.CELL_SIZE + GAME_CONFIG.CELL_SIZE / 2,
        };
    }

    function clampPos(x, y) {
        return {
            x: Math.max(0, Math.min(GAME_CONFIG.MAP_SIZE - 1, x)),
            y: Math.max(0, Math.min(GAME_CONFIG.MAP_SIZE - 1, y)),
        };
    }

    function renderRovers(rovers, selectedRoverId) {
        if (!overlayEl) return;

        const existingMarkers = new Map();
        overlayEl.querySelectorAll('.rover-marker').forEach(el => {
            existingMarkers.set(parseInt(el.dataset.roverId), el);
        });

        for (const r of rovers) {
            const { x, y } = clampPos(r.x, r.y);
            const { px, py } = cellToPixel(x, y);
            const activeDelivery = Game.deliveries.find(d => d.roverId === r.id);

            let el = existingMarkers.get(r.id);

            if (!el) {
                el = document.createElement('div');
                el.className = `rover-marker status-${r.status}`;
                el.dataset.roverId = r.id;
                el.style.left = px + 'px';
                el.style.top = py + 'px';
                overlayEl.appendChild(el);
            } else {
                el.className = `rover-marker status-${r.status}`;
                el.style.left = px + 'px';
                el.style.top = py + 'px';
            }

            if (r.id === selectedRoverId) {
                el.classList.add('selected');
            } else {
                el.classList.remove('selected');
            }

            let inner = `<span class="rover-body">${r.name.slice(-2)}</span>`;
            if (activeDelivery) {
                inner += `<span class="rover-order-badge">#${activeDelivery.orderId}</span>`;
            }
            el.innerHTML = inner;

            let tooltip = `${r.name} (${TEXTS['status_' + r.status]})`;
            if (activeDelivery) {
                const order = Game.orders.find(o => o.id === activeDelivery.orderId);
                if (order) {
                    const progress = Math.round((activeDelivery.step / activeDelivery.totalSteps) * 100);
                    tooltip += `\n📦 Везёт заказ #${order.id} (${progress}%)`;
                }
            }
            el.title = tooltip;

            existingMarkers.delete(r.id);
        }

        existingMarkers.forEach(el => {
            el.style.transition = 'opacity 0.3s, transform 0.3s';
            el.style.opacity = '0';
            el.style.transform = 'translate(-50%, -50%) scale(0.3)';
            setTimeout(() => el.remove(), 300);
        });
    }

    function updateRoverTransitions() {
        if (!overlayEl) return;
        const tickInterval = Game.getTickInterval();
        overlayEl.style.setProperty('--rover-transition-duration', `${tickInterval}ms`);
    }

    function renderOrders(orders, selectedOrderId) {
        if (!overlayEl) return;

        const roverForCheck = window._selectedRoverForHighlight || null;

        const existingMarkers = new Map();
        overlayEl.querySelectorAll('.order-marker').forEach(el => {
            if (!el.classList.contains('removing')) {
                existingMarkers.set(parseInt(el.dataset.orderId), el);
            }
        });

        for (const o of orders) {
            if (o.status !== ORDER_STATUS.PENDING) continue;
            if (!o.destination) continue;

            const { x, y } = clampPos(o.destination.x, o.destination.y);
            const { px, py } = cellToPixel(x, y);

            let el = existingMarkers.get(o.id);

            if (!el) {
                el = document.createElement('div');
                el.className = 'order-marker';
                el.style.left = px + 'px';
                el.style.top = py + 'px';
                el.dataset.orderId = o.id;
                overlayEl.appendChild(el);
            } else {
                el.style.left = px + 'px';
                el.style.top = py + 'px';
            }

            el.classList.toggle('selected', o.id === selectedOrderId);
            el.classList.toggle('in-progress', o.status === ORDER_STATUS.IN_PROGRESS);
            
            const isAvailable = roverForCheck && isOrderAvailableForRover(roverForCheck, o);
            el.classList.toggle('available', isAvailable && o.id !== selectedOrderId);

            const bgColor = getUrgencyColor(o.urgency, o.maxUrgency);
            el.style.backgroundColor = bgColor;

            const urgencyPct = Math.round((o.urgency / o.maxUrgency) * 100);
            let urgencyClass = 'urgency-ok';
            if (urgencyPct < 50) urgencyClass = 'urgency-warn';
            if (urgencyPct < 25) urgencyClass = 'urgency-crit';

            el.innerHTML = `
                <span class="order-id">#${o.id}</span>
                <span class="order-urgency ${urgencyClass}">${o.urgency}</span>
            `;
            el.title = `Заказ #${o.id}: ${o.weight}${TEXTS.kg}, ${o.reward}💰, риск ${o.risk}%`;

            existingMarkers.delete(o.id);
        }

        existingMarkers.forEach(el => {
            el.classList.add('removing');
            setTimeout(() => el.remove(), 300);
        });
    }

    function renderPath(path) {
        if (!overlayEl) return;
        overlayEl.querySelectorAll('.path-dot').forEach(el => el.remove());
        if (!path || !path.length) return;
        for (let i = 0; i < path.length; i++) {
            const { x, y } = clampPos(path[i].x, path[i].y);
            const { px, py } = cellToPixel(x, y);
            const dot = document.createElement('div');
            dot.className = 'path-dot';
            dot.style.left = px + 'px';
            dot.style.top = py + 'px';
            dot.style.animationDelay = (i * 0.02) + 's';
            overlayEl.appendChild(dot);
        }
    }

    return { 
        init, renderZones, renderRovers, renderOrders, renderPath, 
        cellToPixel, updateRoverTransitions, 
        getUrgencyColor, isOrderAvailableForRover
    };
})();