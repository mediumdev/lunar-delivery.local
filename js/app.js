// app.js

document.addEventListener('DOMContentLoaded', async function() {
    const setText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };
    
    setText('game-title', TEXTS.title);
    setText('label-money', TEXTS.money);
    setText('label-reputation', TEXTS.reputation);
    setText('label-sol', TEXTS.sol);
    setText('label-tick', TEXTS.tick);
    setText('rovers-title', TEXTS.roversTitle);
    setText('orders-title', TEXTS.ordersTitle);
    setText('events-title', TEXTS.eventsTitle);
    setText('legend-title', TEXTS.legendTitle);
    setText('buy-title', TEXTS.buyTitle);
    setText('delivery-title', TEXTS.deliveryTitle);
    setText('btn-deliver', TEXTS.deliver);
    setText('btn-new-game', TEXTS.newGame);
    setText('btn-pause', TEXTS.pause);
    setText('gameover-title', TEXTS.gameOver);

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
        const tmpl = document.getElementById('tmpl-legend-item');
        for (const key of Object.keys(ZONE_TYPES)) {
            if (key === 'base') continue;
            const z = ZONE_TYPES[key];
            const item = tmpl.content.cloneNode(true).firstElementChild;
            item.className = `legend-item ${z.cssClass}`;
            item.querySelector('.legend-label').textContent = z.label;
            item.querySelector('.legend-stats').textContent = `${TEXTS.risk} ${Math.round(z.risk*100)}% · ×${z.speedFactor}`;
            legendList.appendChild(item);
        }
    }

    Game.addUpdateCallback(() => {
        UI.renderAll();
    });

    Game.start();
});