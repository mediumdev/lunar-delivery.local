// constants.js

const GAME_CONFIG = Object.freeze({
    TICK_INTERVAL: 1200,
    MAP_SIZE: 18,
    CELL_SIZE: 32,
    BASE_POSITION: { x: 9, y: 9 },
    INITIAL_MONEY: 400,
    INITIAL_REPUTATION: 100,
    MAX_REPUTATION: 150,
    URGENCY_DECAY_PER_TICK: 1,
    REPUTATION_LOSS_PER_EXPIRED: 15,
    REPUTATION_GAIN_PER_DELIVERY: 3,
    BATTERY_CHARGE_PER_TICK: 4,
    REPAIR_COST: 120,
    NEW_ORDER_EVERY_TICKS: 8,
    MAX_ACTIVE_ORDERS: 5,
    MAX_ROVERS: 6,
    GAME_OVER_REPUTATION: 0,
});

const ROVER_TYPES = Object.freeze({
    scout:    { capacity: 20, maxBattery: 100, speed: 1.2, cost: 150, label: 'Разведчик' },
    hauler:   { capacity: 50, maxBattery: 90,  speed: 0.8, cost: 350, label: 'Тягач' },
    explorer: { capacity: 30, maxBattery: 160, speed: 1.0, cost: 550, label: 'Следопыт' },
});

const ZONE_TYPES = Object.freeze({
    base:      { risk: 0.00, speedFactor: 1.0, cssClass: 'zone-base',      label: 'База' },
    plains:    { risk: 0.03, speedFactor: 1.0, cssClass: 'zone-plains',    label: 'Равнины' },
    craters:   { risk: 0.10, speedFactor: 1.5, cssClass: 'zone-craters',   label: 'Кратеры' },
    mountains: { risk: 0.20, speedFactor: 2.2, cssClass: 'zone-mountains', label: 'Горы' },
    darkside:  { risk: 0.35, speedFactor: 2.8, cssClass: 'zone-darkside',  label: 'Тёмная сторона' },
});

const INITIAL_ROVERS = Object.freeze([
    { type: 'scout',  name: 'R-01' },
    { type: 'hauler', name: 'R-02' },
]);

const ROVER_STATUS = Object.freeze({
    IDLE: 'idle',
    DELIVERING: 'delivering',
    CHARGING: 'charging',
    BROKEN: 'broken',
});

const ORDER_STATUS = Object.freeze({
    PENDING: 'pending',
    IN_PROGRESS: 'in_progress',
    DELIVERED: 'delivered',
    EXPIRED: 'expired',
    FAILED: 'failed',
});

function generateMapZones(size, basePos) {
    const zones = [];
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            let type;
            if (x === basePos.x && y === basePos.y) {
                type = 'base';
            } else {
                const dist = Math.abs(x - basePos.x) + Math.abs(y - basePos.y);
                if (x >= size - 4 && y >= size - 4 && Math.random() < 0.7) {
                    type = 'darkside';
                } else if (dist <= 3) {
                    type = 'plains';
                } else if (dist <= 7) {
                    type = Math.random() < 0.6 ? 'craters' : 'plains';
                } else {
                    type = Math.random() < 0.7 ? 'mountains' : 'craters';
                }
            }
            zones.push({ x, y, type });
        }
    }
    return zones;
}