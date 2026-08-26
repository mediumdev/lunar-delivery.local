// === texts.js: Централизованный словарь текстов для UI, событий и сообщений об ошибках ===
// Позволяет легко менять формулировки или добавлять локализацию без правки игровой логики.

const TEXTS = Object.freeze({
    // === Основные заголовки и метрики верхней панели ===
    title: '🌘 ЛУННАЯ ДОСТАВКА',
    subtitle: 'Симулятор логистики лунной базы',

    money: 'Кредиты',
    reputation: 'Рейтинг базы',
    sol: 'Сол',
    tick: 'Тик',

    roversTitle: '🤖 Роверы',
    ordersTitle: '📦 Заказы',
    eventsTitle: '📡 Журнал событий',
    legendTitle: '🗺 Зоны Луны',
    buyTitle: 'Купить ровер',
    deliveryTitle: '🚀 Доставка',

    // === Параметры заказов и роверов (отображаются в карточках и панели доставки) ===
    weight: 'Вес',
    kg: 'кг',
    battery: 'Батарея',
    capacity: 'Грузоподъёмность',
    reward: 'Награда',
    urgency: 'Срочность',
    risk: 'Риск',
    distance: 'Расстояние',
    cells: 'кл.',
    speed: 'Скорость',
    status: 'Статус',
    time: 'Время',
    ticks: 'тиков',

    // === Текстовые представления статусов сущностей ===
    status_idle: 'Свободен',
    status_delivering: 'В доставке',
    status_charging: 'Заряжается',
    status_broken: 'Повреждён',

    order_pending: 'Ожидает',
    order_in_progress: 'В пути',
    order_delivered: 'Доставлен',
    order_expired: 'Просрочен',
    order_failed: 'Провален',

    // === Названия кнопок и действий ===
    deliver: '🚀 Доставить',
    charge: 'Зарядить',
    repair: 'Починить',
    buy: 'Купить',
    cancel: 'Отмена',
    newGame: '🔄 Новая игра',
    pause: '⏸ Пауза',
    resume: '▶ Продолжить',
    close: 'Закрыть',
    speedLabel: '⚡ Скорость: x',

    // === Подсказки и сообщения об ошибках валидации ===
    selectRover: 'Выберите ровера',
    selectOrder: 'Выберите заказ',
    selectOrderAndRover: 'Выберите заказ и ровера',
    notEnoughBattery: 'Не хватает заряда батареи',
    notEnoughCapacity: 'Заказ слишком тяжёлый для этого ровера',
    roverBusy: 'Ровер занят',
    roverBroken: 'Ровер повреждён — нужна починка',
    
    // === Сообщения о результатах действий и изменениях состояния ===
    deliverySuccess: '✅ Доставка успешна! +{reward} кредитов',
    orderExpired: '⏰ Заказ просрочен! Рейтинг −{loss}',
    cannotAfford: 'Недостаточно кредитов',
    gameOver: '💀 РЕЙТИНГ БАЗЫ УТРАЧЕН',
    gameOverSub: 'Игра окончена. Заработано кредитов: {money}',
    
    noActiveOrders: 'Нет активных заказов',
    activeDeliveries: 'В пути:',
    orderBadge: 'Заказ',
    deliveringOrder: 'Везёт заказ #{id} ({progress}%)',
    orderTitleTemplate: 'Заказ #{id}: {weight}кг, {reward}💰, риск {risk}%',

    // === Шаблоны событий для журнала (логика подставляет значения через .replace) ===
    eventRoverBroke: '⚠ {rover} попал в завал и повреждён',
    eventDustStorm: '🌪 Пыльная буря замедлила {rover}',
    eventBonus: '💎 {rover} нашёл лунный кристалл! +{amount} кредитов',
    eventOrderSpawn: '📦 Новый заказ #{id} ({weight}кг, {reward}💰)',
    eventDeliveryStarted: '🚀 {rover} → Заказ #{id} ({distance} {cells})',
    eventRoverPickedUp: '📦 {rover} забрал заказ #{id}',
    eventRoverCharging: '⚡ {rover} на зарядке',
    eventRoverRepaired: '🔧 {rover} починен и поставлен на зарядку',
    
    // === Системные сообщения и подсказки интерфейса ===
    notFound: 'Не найдено',
    orderAlreadyDelivering: 'Заказ уже в доставке',
    hangarFull: 'Нет места в ангаре',

    legendBase: 'База — безопасно',
    legendPlains: 'Равнины — быстрый путь',
    legendCraters: 'Кратеры — средний риск',
    legendMountains: 'Горы — высокий риск',
    legendDarkside: 'Тёмная сторона — экстремально',

    hintSelectOrder: 'Выберите заказ на карте или в списке',
    hintSelectRover: 'Выберите ровера для доставки',
    hintImpossible: 'Доставка невозможна: не хватает батареи/грузоподъёмности',
});