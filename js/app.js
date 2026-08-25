// app.js

document.addEventListener('DOMContentLoaded', async function() {
    const setText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };
    setText('game-title', TEXTS.title);
    setText('rovers-title', TEXTS.roversTitle);
    setText('orders-title', TEXTS.ordersTitle);
    setText('events-title', TEXTS.eventsTitle);
    setText('legend-title', TEXTS.legendTitle);
    setText('btn-deliver', TEXTS.deliver);
    setText('btn-new-game', TEXTS.newGame);
    setText('btn-pause', TEXTS.pause);

    const mapContainer = document.querySelector('.map-container');
    if (mapContainer) MapView.init(mapContainer);

    UI.init();

    const data = await Game.loadGame();

    MapView.renderZones(data.zones);

    UI.renderAll();
    UI.renderEvents();

    const legendList = document.getElementById('legend-list');
    if (legendList) {
        legendList.innerHTML = '';
        for (const key of Object.keys(ZONE_TYPES)) {
            if (key === 'base') continue;
            const z = ZONE_TYPES[key];
            const item = document.createElement('div');
            item.className = `legend-item ${z.cssClass}`;
            item.innerHTML = `
                <span class="legend-swatch"></span>
                <span class="legend-label">${z.label}</span>
                <span class="legend-stats">риск ${Math.round(z.risk*100)}% · ×${z.speedFactor}</span>
            `;
            legendList.appendChild(item);
        }
    }

    // Подписываемся на обновления игры через систему колбэков
    // Теперь UI обновляется автоматически каждый тик, при появлении заказов,
    // при доставке, при изменении статуса роверов и т.д.
    Game.addUpdateCallback(() => {
        UI.renderAll();
    });

    Game.start();
});