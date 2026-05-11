const tg = window.Telegram.WebApp;
tg.expand();

const STORAGE_KEY = 'user_subscriptions_v1';
const NOTIFIED_KEY = 'notified_dates_v1';

let subscriptions = [];

async function init() {
    setupMainButton();
    tg.CloudStorage.getItem(STORAGE_KEY, (err, value) => {
        document.getElementById('loader').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        if (!err && value) {
            subscriptions = JSON.parse(value);
            renderList();
            checkAndNotify();
        } else {
            renderList();
        }
    });
}

function checkAndNotify() {
    if (subscriptions.length === 0) return;

    const todayStr = new Date().toISOString().split('T')[0];

    tg.CloudStorage.getItem(NOTIFIED_KEY, (err, value) => {
        const notified = (!err && value) ? JSON.parse(value) : {};

        const urgent = [];
        const soonOne = [];
        const soonThree = [];
        const overdue = [];

        subscriptions.forEach(sub => {
            const daysLeft = getDaysLeft(sub.date);
            const notifyId = `${sub.id}_${todayStr}`;
            if (notified[notifyId]) return;

            if (daysLeft < 0) overdue.push(sub);
            else if (daysLeft === 0) urgent.push(sub);
            else if (daysLeft === 1) soonOne.push(sub);
            else if (daysLeft === 3) soonThree.push(sub);
        });

        const messages = [];

        if (overdue.length > 0) {
            const names = overdue.map(s => `• ${s.name} — ${s.cost} ₽`).join('\n');
            messages.push(`🔴 Просроченные подписки:\n${names}\nОбновите даты списания!`);
        }
        if (urgent.length > 0) {
            const names = urgent.map(s => `• ${s.name} — ${s.cost} ₽`).join('\n');
            messages.push(`⚡️ Сегодня списание:\n${names}`);
        }
        if (soonOne.length > 0) {
            const names = soonOne.map(s => `• ${s.name} — ${s.cost} ₽`).join('\n');
            messages.push(`⏰ Завтра списание:\n${names}`);
        }
        if (soonThree.length > 0) {
            const names = soonThree.map(s => `• ${s.name} — ${s.cost} ₽`).join('\n');
            messages.push(`📅 Через 3 дня списание:\n${names}`);
        }

        if (messages.length === 0) return;

        showNextAlert(messages, 0, () => {
            const allShown = [...overdue, ...urgent, ...soonOne, ...soonThree];
            allShown.forEach(sub => {
                notified[`${sub.id}_${todayStr}`] = true;
            });
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - 7);
            Object.keys(notified).forEach(key => {
                const dateStr = key.split('_').pop();
                if (new Date(dateStr) < cutoff) delete notified[key];
            });
            tg.CloudStorage.setItem(NOTIFIED_KEY, JSON.stringify(notified));
        });
    });
}

function showNextAlert(messages, index, onDone) {
    if (index >= messages.length) { onDone(); return; }
    tg.showAlert(messages[index], () => {
        showNextAlert(messages, index + 1, onDone);
    });
}

function setupMainButton() {
    tg.MainButton.setText("ДОБАВИТЬ ПОДПИСКУ");
    tg.MainButton.show();
    tg.MainButton.onClick(() => { openModal(); });
}

function openModal() {
    document.getElementById('sub-name').value = '';
    document.getElementById('sub-cost').value = '';
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('sub-date').value = today;
    document.getElementById('add-modal').classList.remove('hidden');
    tg.MainButton.hide();
}

function closeModal() {
    document.getElementById('add-modal').classList.add('hidden');
    tg.MainButton.show();
}

function saveSubscription() {
    const name = document.getElementById('sub-name').value.trim();
    const cost = parseInt(document.getElementById('sub-cost').value);
    const dateStr = document.getElementById('sub-date').value;

    if (!name || isNaN(cost) || !dateStr) {
        tg.showAlert("Пожалуйста, заполните все поля");
        return;
    }

    const newSub = { id: Date.now(), name, cost, date: dateStr };
    subscriptions.push(newSub);
    saveData();
    closeModal();
    renderList();
    tg.HapticFeedback.notificationOccurred('success');
}

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

function saveData() {
    tg.CloudStorage.setItem(STORAGE_KEY, JSON.stringify(subscriptions));
}

function renderList() {
    const list = document.getElementById('subscriptions-list');
    const totalEl = document.getElementById('total-cost');
    const emptyMsg = document.getElementById('empty-msg');

    list.innerHTML = '';

    const total = subscriptions.reduce((sum, sub) => sum + sub.cost, 0);
    totalEl.innerText = formatMoney(total) + ' ₽';

    if (subscriptions.length === 0) {
        list.appendChild(emptyMsg);
        emptyMsg.style.display = 'block';
        return;
    } else {
        emptyMsg.style.display = 'none';
    }

    subscriptions.sort((a, b) => new Date(a.date) - new Date(b.date));

    subscriptions.forEach(sub => {
        const daysLeft = getDaysLeft(sub.date);
        let statusBadge = '';

        if (daysLeft < 0) {
            statusBadge = `<span class="badge overdue">Просрочено</span>`;
        } else if (daysLeft === 0) {
            statusBadge = `<span class="badge today">Сегодня</span>`;
        } else if (daysLeft <= 3) {
            statusBadge = `<span class="badge soon">Через ${daysLeft} дн.</span>`;
        } else {
            statusBadge = `<span class="badge normal">Через ${daysLeft} дн.</span>`;
        }

        const card = document.createElement('div');
        card.className = 'sub-card';
        card.innerHTML = `
            <div class="sub-info">
                <div class="sub-name">${sub.name}</div>
                <div class="sub-meta">${statusBadge} ${formatDate(sub.date)}</div>
            </div>
            <div class="sub-right">
                <div class="sub-cost">${formatMoney(sub.cost)} ₽</div>
                <button class="delete-btn" onclick="deleteSub(${sub.id})">🗑</button>
            </div>
        `;
        list.appendChild(card);
    });
}

function getDaysLeft(dateStr) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);
    return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

function formatMoney(amount) {
    return amount.toLocaleString('ru-RU');
}

init();
