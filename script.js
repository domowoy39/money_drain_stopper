const tg = window.Telegram.WebApp;
tg.expand();

// Ключ для облачного хранилища
const STORAGE_KEY = 'user_subscriptions_v1';

// Состояние
let subscriptions = [];

// Инициализация
async function init() {
    // Настраиваем главную кнопку как "Добавить"
    setupMainButton();

    // Загружаем данные
    tg.CloudStorage.getItem(STORAGE_KEY, (err, value) => {
        document.getElementById('loader').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');

        if (!err && value) {
            subscriptions = JSON.parse(value);
            renderList();
        } else {
            renderList(); // Отрисует пустой список
        }
    });
}

// Настройка MainButton (синяя кнопка внизу)
function setupMainButton() {
    tg.MainButton.setText("ДОБАВИТЬ ПОДПИСКУ");
    tg.MainButton.show();
    tg.MainButton.onClick(() => {
        openModal();
    });
}

// Открытие/Закрытие модального окна
function openModal() {
    // Сбрасываем поля
    document.getElementById('sub-name').value = '';
    document.getElementById('sub-cost').value = '';
    
    // Ставим дату "сегодня" по умолчанию
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('sub-date').value = today;

    document.getElementById('add-modal').classList.remove('hidden');
    
    // Скрываем MainButton пока открыта модалка, чтобы не мешала
    tg.MainButton.hide();
}

function closeModal() {
    document.getElementById('add-modal').classList.add('hidden');
    tg.MainButton.show();
}

// Сохранение новой подписки
function saveSubscription() {
    const name = document.getElementById('sub-name').value.trim();
    const cost = parseInt(document.getElementById('sub-cost').value);
    const dateStr = document.getElementById('sub-date').value;

    if (!name || isNaN(cost) || !dateStr) {
        tg.showAlert("Пожалуйста, заполните все поля");
        return;
    }

    const newSub = {
        id: Date.now(), // Уникальный ID
        name: name,
        cost: cost,
        date: dateStr
    };

    subscriptions.push(newSub);
    saveData();
    closeModal();
    renderList();
    tg.HapticFeedback.notificationOccurred('success');
}

// Удаление
function deleteSub(id) {
    tg.showConfirm("Удалить эту подписку?", (ok) => {
        if (ok) {
            subscriptions = subscriptions.filter(s => s.id !== id);
            saveData();
            renderList();
            tg.HapticFeedback.impactOccurred('medium');
        }
    });
}

// Сохранение в облако
function saveData() {
    tg.CloudStorage.setItem(STORAGE_KEY, JSON.stringify(subscriptions));
}

// Отрисовка списка
function renderList() {
    const list = document.getElementById('subscriptions-list');
    const totalEl = document.getElementById('total-cost');
    const emptyMsg = document.getElementById('empty-msg');

    list.innerHTML = ''; // Очистка

    // Считаем общую сумму
    const total = subscriptions.reduce((sum, sub) => sum + sub.cost, 0);
    totalEl.innerText = formatMoney(total) + ' ₽';

    if (subscriptions.length === 0) {
        list.appendChild(emptyMsg);
        emptyMsg.style.display = 'block';
        return;
    } else {
        emptyMsg.style.display = 'none';
    }

    // Сортируем: сначала те, у которых дата ближе
    // Если дата прошла, считаем её как "в следующем месяце" для сортировки,
    // но визуально покажем "Просрочено" или дату
    subscriptions.sort((a, b) => new Date(a.date) - new Date(b.date));

    subscriptions.forEach(sub => {
        const daysLeft = getDaysLeft(sub.date);
        let statusBadge = '';
        let dateDisplay = formatDate(sub.date);

        if (daysLeft < 0) {
            // Дата прошла
            statusBadge = `<span class="badge soon">Просрочено</span>`;
        } else if (daysLeft === 0) {
            statusBadge = `<span class="badge soon">Сегодня</span>`;
        } else if (daysLeft <= 3) {
            statusBadge = `<span class="badge soon">Через ${daysLeft} дн.</span>`;
        } else {
            statusBadge = `<span class="badge ok">Через ${daysLeft} дн.</span>`;
        }

        const card = document.createElement('div');
        card.className = 'sub-card';
        card.innerHTML = `
            <div class="sub-info">
                <div class="sub-name">${sub.name}</div>
                <div class="sub-date">
                    ${statusBadge} <span>${dateDisplay}</span>
                </div>
            </div>
            <div class="sub-cost">${formatMoney(sub.cost)} ₽</div>
            <button class="delete-btn" onclick="deleteSub(${sub.id})">🗑</button>
        `;
        list.appendChild(card);
    });
}

// Вспомогательные функции
function formatMoney(num) {
    return new Intl.NumberFormat('ru-RU').format(num);
}

function formatDate(dateStr) {
    const options = { day: 'numeric', month: 'long' };
    return new Date(dateStr).toLocaleDateString('ru-RU', options);
}

function getDaysLeft(targetDateStr) {
    const now = new Date();
    // Сбрасываем время, чтобы считать только дни
    now.setHours(0,0,0,0);
    
    const target = new Date(targetDateStr);
    target.setHours(0,0,0,0);

    const diffTime = target - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    return diffDays;
}

// Запуск
init();
