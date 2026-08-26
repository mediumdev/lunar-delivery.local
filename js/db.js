// === db.js: Слой работы с IndexedDB для постоянного хранения данных игры ===

const DB_NAME = 'lunar_delivery_db';
const DB_VERSION = 2;
const STORES = ['rovers', 'orders', 'deliveries', 'events', 'state', 'zones'];

let _db = null;

// Открытие базы данных и создание хранилищ при необходимости
function openDB() {
    return new Promise((resolve, reject) => {
        if (_db) return resolve(_db);
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            const oldVersion = e.oldVersion || 0;

            STORES.forEach(name => {
                if (!db.objectStoreNames.contains(name)) {
                    db.createObjectStore(name, { keyPath: 'id', autoIncrement: true });
                }
            });

            // Очистка данных при мажорном обновлении версии схемы
            if (oldVersion > 0 && oldVersion < 2) {
                STORES.forEach(name => {
                    try {
                        const txLocal = db.transaction(name, 'readwrite');
                        txLocal.objectStore(name).clear();
                    } catch (err) { /* ignore */ }
                });
            }
        };
        req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
        req.onerror = (e) => reject(e.target.error);
    });
}

// Вспомогательная функция для получения транзакции
function tx(storeName, mode = 'readonly') {
    return openDB().then(db => db.transaction(storeName, mode).objectStore(storeName));
}

// CRUD операции для работы с хранилищами
function dbPut(storeName, value) {
    return tx(storeName, 'readwrite').then(store => new Promise((res, rej) => {
        const r = store.put(value);
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
    }));
}

function dbAdd(storeName, value) {
    return tx(storeName, 'readwrite').then(store => new Promise((res, rej) => {
        const r = store.add(value);
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
    }));
}

function dbGet(storeName, id) {
    return tx(storeName).then(store => new Promise((res, rej) => {
        const r = store.get(id);
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
    }));
}

function dbGetAll(storeName) {
    return tx(storeName).then(store => new Promise((res, rej) => {
        const r = store.getAll();
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
    }));
}

function dbDelete(storeName, id) {
    return tx(storeName, 'readwrite').then(store => new Promise((res, rej) => {
        const r = store.delete(id);
        r.onsuccess = () => res();
        r.onerror = () => rej(r.error);
    }));
}

function dbClear(storeName) {
    return tx(storeName, 'readwrite').then(store => new Promise((res, rej) => {
        const r = store.clear();
        r.onsuccess = () => res();
        r.onerror = () => rej(r.error);
    }));
}

// Полная очистка всех хранилищ для начала новой игры
async function dbClearAll() {
    for (const s of STORES) await dbClear(s);
}