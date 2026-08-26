// === game.js: Ядро игровой логики, расчеты и игровой цикл (tick) ===

const Game = (() => {
    let state = null;
    let rovers = [];
    let orders = [];
    let deliveries = [];
    let zones = [];
    let animationFrameId = null;
    let lastFrameTime = 0;
    let timeAccumulator = 0;
    let speedMultiplier = 1;
    
    const eventLog = [];
    const onUpdateCallbacks = [];

    function addUpdateCallback(callback) {
        if (typeof callback === 'function' && !onUpdateCallbacks.includes(callback)) {
            onUpdateCallbacks.push(callback);
        }
    }

    function removeUpdateCallback(callback) {
        const index = onUpdateCallbacks.indexOf(callback);
        if (index > -1) {
            onUpdateCallbacks.splice(index, 1);
        }
    }

    function notifyUpdate() {
        onUpdateCallbacks.forEach(callback => {
            try { callback(); } catch (e) { console.error('Error in update callback:', e); }
        });
    }

    // === Инициализация новой игры: сброс БД, генерация карты и стартовых роверов ===
    async function newGame() {
        await dbClearAll();
        zones = generateMapZones(GAME_CONFIG.MAP_SIZE, GAME_CONFIG.BASE_POSITION);
        await dbPut('zones', { id: 1, data: zones });

        state = {
            id: 1, money: GAME_CONFIG.INITIAL_MONEY, reputation: GAME_CONFIG.INITIAL_REPUTATION,
            sol: 1, tick: 0, paused: false, gameOver: false,
        };
        await dbPut('state', state);

        rovers = [];
        for (const cfg of INITIAL_ROVERS) {
            const type = ROVER_TYPES[cfg.type];
            const rover = {
                type: cfg.type, name: cfg.name, x: GAME_CONFIG.BASE_POSITION.x, y: GAME_CONFIG.BASE_POSITION.y,
                battery: type.maxBattery, capacity: type.capacity, maxBattery: type.maxBattery,
                speed: type.speed, status: ROVER_STATUS.IDLE, orderId: null,
            };
            const id = await dbAdd('rovers', rover);
            rover.id = id;
            rovers.push(rover);
        }

        orders = [];
        deliveries = [];
        eventLog.length = 0;

        await spawnOrder();
        await spawnOrder();

        addEvent(TEXTS.subtitle);
        notifyUpdate();
        return { state, rovers, orders, zones };
    }

    // === Загрузка игры: восстановление состояния роверов, заказов и карты из БД ===
    async function loadGame() {
        const states = await dbGetAll('state');
        state = states[0];
        rovers = await dbGetAll('rovers');
        rovers.forEach(r => delete r.shaking);
        orders = await dbGetAll('orders');
        deliveries = await dbGetAll('deliveries');

        const savedZones = await dbGet('zones', 1);
        if (savedZones && savedZones.data && Array.isArray(savedZones.data)) {
            zones = savedZones.data;
        } else {
            zones = generateMapZones(GAME_CONFIG.MAP_SIZE, GAME_CONFIG.BASE_POSITION);
            await dbPut('zones', { id: 1, data: zones });
        }

        if (!state || state.gameOver || state.reputation <= GAME_CONFIG.GAME_OVER_REPUTATION) {
            return await newGame();
        }

        return { state, rovers, orders, zones };
    }

    // === Генерация заказа: расчет веса, награды, срочности и риска на основе зоны ===
    async function spawnOrder() {
        if (!state) return;
        if (orders.filter(o => o.status === ORDER_STATUS.PENDING).length >= GAME_CONFIG.MAX_ACTIVE_ORDERS) return;

        let pos;
        do {
            pos = { x: Math.floor(Math.random() * GAME_CONFIG.MAP_SIZE), y: Math.floor(Math.random() * GAME_CONFIG.MAP_SIZE) };
        } while (pos.x === GAME_CONFIG.BASE_POSITION.x && pos.y === GAME_CONFIG.BASE_POSITION.y);

        const zone = getZoneAt(pos.x, pos.y);
        const zoneData = ZONE_TYPES[zone.type];

        const weight = 5 + Math.floor(Math.random() * 40);
        const distance = manhattan(pos, GAME_CONFIG.BASE_POSITION);
        const baseReward = Math.round(distance * 8 + weight * 2 + zoneData.risk * 200);
        const reward = baseReward + Math.floor(Math.random() * 30);
        const urgency = 25 + Math.floor(Math.random() * 30) + Math.round(distance * 1.5);

        const order = {
            weight, reward, urgency, maxUrgency: urgency, risk: Math.round(zoneData.risk * 100),
            destination: { x: pos.x, y: pos.y }, zone: zone.type, status: ORDER_STATUS.PENDING, roverId: null, createdAt: state.tick,
        };

        const id = await dbAdd('orders', order);
        order.id = id;
        orders.push(order);

        addEvent(TEXTS.eventOrderSpawn.replace('{id}', id).replace('{weight}', weight).replace('{reward}', reward));
        notifyUpdate();
        return order;
    }

    // === Расчет стоимости доставки ===
    function calculateDeliveryCost(rover, order) {
        const distance = manhattan(rover, order.destination);
        const path = buildPath(rover, order.destination);
        let totalRisk = 0;
        for (const cell of path) {
            const z = getZoneAt(cell.x, cell.y);
            totalRisk += ZONE_TYPES[z.type].risk;
        }
        const avgRisk = path.length ? totalRisk / path.length : 0;
        
        // Штраф за вес: чем ближе вес к максимуму, тем выше расход батареи
        const weightPenalty = 1 + (order.weight / rover.capacity);
        const batteryCost = Math.ceil(distance * weightPenalty * (1 + avgRisk * 2));

        let timeFactor = 0;
        for (const cell of path) {
            const z = getZoneAt(cell.x, cell.y);
            timeFactor += ZONE_TYPES[z.type].speedFactor; // "Разные зоны отличаются по скорости"
        }
        const avgSpeedFactor = path.length ? timeFactor / path.length : 1;
        const ticks = Math.ceil((distance * avgSpeedFactor) / rover.speed);

        return { distance, batteryCost, ticks, path, avgRisk };
    }

    // === Валидация: "Ровер не должен везти заказ, если не хватает батареи или грузоподъёмности" ===
    function canDeliver(rover, order) {
        if (rover.status === ROVER_STATUS.BROKEN) return { ok: false, reason: TEXTS.roverBroken };
        if (rover.status !== ROVER_STATUS.IDLE) return { ok: false, reason: TEXTS.roverBusy };
        if (order.weight > rover.capacity) return { ok: false, reason: TEXTS.notEnoughCapacity }; // Сценарий невозможной доставки
        
        const activeDelivery = deliveries.find(d => d.orderId === order.id);
        if (activeDelivery) return { ok: false, reason: TEXTS.orderAlreadyDelivering };
        
        const calc = calculateDeliveryCost(rover, order);
        if (calc.batteryCost > rover.battery) return { ok: false, reason: TEXTS.notEnoughBattery }; // Сценарий невозможной доставки
        
        return { ok: true, calc };
    }

    // === Запуск доставки: создание записи в deliveries и смена статуса ровера ===
    async function startDelivery(roverId, orderId) {
        const rover = rovers.find(r => r.id === roverId);
        const order = orders.find(o => o.id === orderId);
        if (!rover || !order) return { ok: false, reason: TEXTS.notFound };
        const check = canDeliver(rover, order);
        if (!check.ok) return check;

        rover.status = ROVER_STATUS.DELIVERING;
        rover.orderId = order.id;
        
        const pathToOrder = buildPath(rover, order.destination);
        const pathToBase = buildPath(order.destination, GAME_CONFIG.BASE_POSITION);
        const fullPath = [...pathToOrder, ...pathToBase.slice(1)];
        
        const delivery = {
            roverId: rover.id, orderId: order.id, path: fullPath, step: 0,
            orderStepIndex: pathToOrder.length - 1, batteryCost: check.calc.batteryCost,
            totalSteps: fullPath.length, startedAt: state.tick,
        };
        const id = await dbAdd('deliveries', delivery);
        delivery.id = id;
        deliveries.push(delivery);

        await dbPut('rovers', rover);
        addEvent(TEXTS.eventDeliveryStarted.replace('{rover}', rover.name).replace('{id}', order.id).replace('{distance}', check.calc.distance));
        notifyUpdate();
        return { ok: true };
    }

    // === Основной игровой тик: движение, риск, списание батареи, завершение доставки ===
    async function tick() {
        if (!state || state.paused || state.gameOver) return;
        state.tick++;
        if (state.tick % 60 === 0) state.sol++;

        for (const d of [...deliveries]) {
            const rover = rovers.find(r => r.id === d.roverId);
            const order = orders.find(o => o.id === d.orderId);
            if (!rover || !order) continue;

            const currentCell = d.path[Math.min(d.step, d.path.length - 1)] || GAME_CONFIG.BASE_POSITION;
            const zone = getZoneAt(currentCell.x, currentCell.y);
            const zoneData = ZONE_TYPES[zone.type];

            // Риск маршрута может привести к поломке ровера
            if (Math.random() < zoneData.risk * 0.5) {
                rover.status = ROVER_STATUS.BROKEN;
                rover.battery = 0;
                rover.orderId = null;
                order.status = ORDER_STATUS.FAILED;
                rover.shaking = true;
                await dbPut('rovers', rover);
                await dbPut('orders', order);
                await dbDelete('deliveries', d.id);
                deliveries = deliveries.filter(x => x.id !== d.id);
                addEvent(TEXTS.eventRoverBroke.replace('{rover}', rover.name));
                continue;
            }

            if (Math.random() < 0.03) {
                addEvent(TEXTS.eventDustStorm.replace('{rover}', rover.name));
                rover.shaking = true;
            } else {
                d.step++;
            }

            // Постепенное списание батареи на каждом шаге
            const batteryPerStep = d.batteryCost / Math.max(1, d.totalSteps);
            rover.battery = Math.max(0, rover.battery - batteryPerStep);

            if (d.step < d.path.length) {
                rover.x = d.path[d.step].x;
                rover.y = d.path[d.step].y;
            }

            if (d.step === d.orderStepIndex && order.status === ORDER_STATUS.PENDING) {
                order.status = ORDER_STATUS.IN_PROGRESS;
                await dbPut('orders', order);
                addEvent(TEXTS.eventRoverPickedUp.replace('{rover}', rover.name).replace('{id}', order.id));
            }

            if (Math.random() < 0.02) {
                const bonus = 20 + Math.floor(Math.random() * 40);
                state.money += bonus;
                addEvent(TEXTS.eventBonus.replace('{rover}', rover.name).replace('{amount}', bonus));
            }

            // После доставки меняются очки/деньги, батарея и статус заказа
            if (d.step >= d.totalSteps) {
                rover.x = GAME_CONFIG.BASE_POSITION.x;
                rover.y = GAME_CONFIG.BASE_POSITION.y;
                rover.status = ROVER_STATUS.CHARGING;
                rover.orderId = null;
                order.status = ORDER_STATUS.DELIVERED;
                state.money += order.reward;
                state.reputation = Math.min(GAME_CONFIG.MAX_REPUTATION, state.reputation + GAME_CONFIG.REPUTATION_GAIN_PER_DELIVERY);
                await dbPut('rovers', rover);
                await dbPut('orders', order);
                await dbDelete('deliveries', d.id);
                deliveries = deliveries.filter(x => x.id !== d.id);
                addEvent(TEXTS.deliverySuccess.replace('{reward}', order.reward));
            } else {
                // Сохраняем обновленный шаг доставки и путь в БД
                await dbPut('deliveries', d);
                await dbPut('rovers', rover);
            }
        }

        // Уменьшение срочности и потеря репутации при просрочке (цель игры - не потерять рейтинг)
        for (const order of orders) {
            if (order.status === ORDER_STATUS.PENDING) {
                order.urgency -= GAME_CONFIG.URGENCY_DECAY_PER_TICK;
                if (order.urgency <= 0) {
                    order.status = ORDER_STATUS.EXPIRED;
                    order.urgency = 0;
                    state.reputation = Math.max(0, state.reputation - GAME_CONFIG.REPUTATION_LOSS_PER_EXPIRED);
                    addEvent(TEXTS.orderExpired.replace('{loss}', GAME_CONFIG.REPUTATION_LOSS_PER_EXPIRED));
                }
                await dbPut('orders', order);
            }
        }

        // Автоматическая зарядка роверов на базе
        for (const rover of rovers) {
            if (rover.status === ROVER_STATUS.CHARGING) {
                rover.battery = Math.min(rover.maxBattery, rover.battery + GAME_CONFIG.BATTERY_CHARGE_PER_TICK);
                if (rover.battery >= rover.maxBattery) {
                    rover.battery = rover.maxBattery;
                    rover.status = ROVER_STATUS.IDLE;
                }
                await dbPut('rovers', rover);
            }
        }

        if (state.tick % GAME_CONFIG.NEW_ORDER_EVERY_TICKS === 0) {
            await spawnOrder();
        }

        await dbPut('state', state);

        // Проверка условия проигрыша
        if (state.reputation <= GAME_CONFIG.GAME_OVER_REPUTATION) {
            state.gameOver = true;
            await dbPut('state', state);
            stop();
            if (typeof UI !== 'undefined' && UI.showGameOver) UI.showGameOver();
        }

        notifyUpdate();
    }

    async function chargeRover(roverId) {
        const rover = rovers.find(r => r.id === roverId);
        if (!rover || rover.status !== ROVER_STATUS.IDLE) return false;
        rover.status = ROVER_STATUS.CHARGING;
        await dbPut('rovers', rover);
        addEvent(TEXTS.eventRoverCharging.replace('{rover}', rover.name));
        notifyUpdate();
        return true;
    }

    async function repairRover(roverId) {
        const rover = rovers.find(r => r.id === roverId);
        if (!rover || rover.status !== ROVER_STATUS.BROKEN) return { ok: false };
        if (state.money < GAME_CONFIG.REPAIR_COST) return { ok: false, reason: TEXTS.cannotAfford };
        
        state.money -= GAME_CONFIG.REPAIR_COST;
        rover.status = ROVER_STATUS.CHARGING; 
        rover.battery = Math.floor(rover.maxBattery / 2);
        rover.x = GAME_CONFIG.BASE_POSITION.x;
        rover.y = GAME_CONFIG.BASE_POSITION.y;
        
        await dbPut('state', state);
        await dbPut('rovers', rover);
        addEvent(TEXTS.eventRoverRepaired.replace('{rover}', rover.name));
        notifyUpdate();
        return { ok: true };
    }

    async function buyRover(type) {
        const cfg = ROVER_TYPES[type];
        if (!cfg) return { ok: false };
        if (state.money < cfg.cost) return { ok: false, reason: TEXTS.cannotAfford };
        if (rovers.length >= GAME_CONFIG.MAX_ROVERS) return { ok: false, reason: TEXTS.hangarFull };
        
        state.money -= cfg.cost;
        const rover = {
            type, name: 'R-' + String(rovers.length + 1).padStart(2, '0'),
            x: GAME_CONFIG.BASE_POSITION.x, y: GAME_CONFIG.BASE_POSITION.y,
            battery: cfg.maxBattery, capacity: cfg.capacity, maxBattery: cfg.maxBattery,
            speed: cfg.speed, status: ROVER_STATUS.IDLE, orderId: null,
        };
        const id = await dbAdd('rovers', rover);
        rover.id = id;
        rovers.push(rover);
        await dbPut('state', state);
        notifyUpdate();
        return { ok: true, rover };
    }

    // === Игровой цикл на requestAnimationFrame с поддержкой ускорения времени ===
    function gameLoop(timestamp) {
        if (!state) return;
        if (!state.paused && !state.gameOver) {
            if (!lastFrameTime) lastFrameTime = timestamp;
            const deltaTime = Math.min(timestamp - lastFrameTime, 250);
            lastFrameTime = timestamp;
            timeAccumulator += deltaTime * speedMultiplier;
            const tickInterval = GAME_CONFIG.TICK_INTERVAL;
            while (timeAccumulator >= tickInterval) {
                tick();
                timeAccumulator -= tickInterval;
            }
        } else {
            lastFrameTime = timestamp;
        }
        animationFrameId = requestAnimationFrame(gameLoop);
    }

    function start() {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        lastFrameTime = 0;
        timeAccumulator = 0;
        animationFrameId = requestAnimationFrame(gameLoop);
    }

    function stop() {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
    }

    function setSpeed(multiplier) {
        speedMultiplier = Math.max(1, Math.min(3, parseFloat(multiplier)));
        if (typeof MapView !== 'undefined' && MapView.updateRoverTransitions) MapView.updateRoverTransitions();
        notifyUpdate();
        return speedMultiplier;
    }

    function getSpeed() { return speedMultiplier; }
    function getTickInterval() { return Math.max(50, Math.round(GAME_CONFIG.TICK_INTERVAL / speedMultiplier)); }
    function manhattan(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }
    function getZoneAt(x, y) { return zones.find(z => z.x === x && z.y === y) || { type: 'plains' }; }
    
    // Простой алгоритм построения пути (сначала по X, потом по Y)
    function buildPath(from, to) {
        const path = [];
        let x = from.x, y = from.y;
        while (x !== to.x) { path.push({ x, y }); x += (to.x > x ? 1 : -1); }
        while (y !== to.y) { path.push({ x, y }); y += (to.y > y ? 1 : -1); }
        path.push({ x: to.x, y: to.y });
        return path;
    }

    async function addEvent(text) {
        const entry = { text, tick: state ? state.tick : 0, at: Date.now() };
        eventLog.unshift(entry);
        if (eventLog.length > 50) eventLog.pop();
        try { await dbAdd('events', entry); } catch (e) { /* ignore */ }
        if (typeof UI !== 'undefined' && UI.renderEvents) {
            try { UI.renderEvents(); } catch (e) { /* ignore */ }
        }
    }

    function pause() { if (state) state.paused = true; }
    function resume() { if (state) state.paused = false; }

    return {
        newGame, loadGame, start, stop, pause, resume, tick,
        spawnOrder, startDelivery, chargeRover, repairRover, buyRover,
        calculateDeliveryCost, canDeliver, getZoneAt, buildPath,
        addEvent, addUpdateCallback, removeUpdateCallback,
        setSpeed, getSpeed, getTickInterval,
        get state() { return state; },
        get rovers() { return rovers; },
        get orders() { return orders; },
        get deliveries() { return deliveries; },
        get zones() { return zones; },
        get eventLog() { return eventLog; },
    };
})();