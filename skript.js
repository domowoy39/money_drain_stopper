const tg = window.Telegram.WebApp;
tg.expand();

const STORAGE_KEY   = 'user_subscriptions_v1';
const CONS_KEY      = 'user_consumables_v1';
const NOTIFIED_KEY  = 'notified_dates_v1';

let subscriptions = [];
let consumables   = [];
let currentTab    = 'subs';

// ── INIT ──────────────────────────────────────────────
async function init() {
    setupMainButton();

    tg.CloudStorage.getItem(STORAGE_KEY, (err, val) => {
        if (!err && val) subscriptions = JSON.parse(val);

        tg.CloudStorage.getItem(CONS_KEY, (err2, val2) => {
            if (!err2 && val2) consumables = JSON.parse(val2);

            document.getElementById('loader').classList.add('hidden');
            document.getElementById('main-app').classList.remove('hidden');

            renderSubs();
            renderConsumables();
            checkAndNotify();
        });
    });
}

// ── ВКЛАДКИ ───────────────────────────────────────────
function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');

    document.getElementById('tab-subs').classList.toggle('hidden', tab !== 'subs');
    document.getElementById('tab-consumables').classList.toggle('hidden', tab !== 'consumables');

    setupMainButton();
}

// ── MAIN BUTTON ───────────────────────────────────────
function setupMainButton() {
    tg.MainButton.offClick(tg.MainButton._clickHandler);
    if (currentTab === 'subs') {
        tg.MainButton.setText("ДОБАВИТЬ ПОДПИСКУ");
        tg.MainButton._clickHandler = () => openModal();
    } else {
        tg.MainButton.setText("ДОБАВИТЬ РАСХОДНИК");
        tg.MainButton._clickHandler = () => openConsModal();
    }
    tg.MainButton.onClick(tg.MainButton._clickHandler);
    tg.MainButton.show();
}

// ── ПОДПИСКИ ──────────────────────────────────────────
function openModal() {
    document.getElementById('sub-name').value = '';
    document.getElementById('sub-cost').value = '';
    document.getElementById('sub-date').value = new Date().toISOString().split('T')[0];
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
    const date = document.getElementById('sub-date').value;
    if (!name || isNaN(cost) || !date) { tg.showAlert("Заполните все поля"); return; }
    subscriptions.push({ id: Date.now(), name, cost, date });
    tg.CloudStorage.setItem(STORAGE_KEY, JSON.stringify(subscriptions));
    closeModal();
    renderSubs();
    tg.HapticFeedback.notificationOccurred('success');
}
function deleteSub(id) {
    tg.showConfirm("Удалить подписку?", ok => {
        if (!ok) return;
        subscriptions = subscriptions.filter(s => s.id !== id);
        tg.CloudStorage.setItem(STORAGE_KEY, JSON.stringify(subscriptions));
        renderSubs();
        tg.HapticFeedback.impactOccurred('medium');
    });
}
function renderSubs() {
    const list    = document.getElementById('subscriptions-list');
    const totalEl = document.getElementById('total-cost');
    const emptyEl = document.getElementById('empty-msg');
    list.innerHTML = '';
    totalEl.innerText = formatMoney(subscriptions.reduce((s, x) => s + x.cost, 0)) + ' ₽';
    if (subscriptions.length === 0) { list.appendChild(emptyEl); emptyEl.style.display = 'block'; return; }
    emptyEl.style.display = 'none';
    [...subscriptions].sort((a, b) => new Date(a.date) - new Date(b.date)).forEach(sub => {
        const d = getDaysLeft(sub.date);
        const badge = d < 0 ? `<span class="badge overdue">Просрочено</span>`
                    : d === 0 ? `<span class="badge today">Сегодня</span>`
                    : d <= 3  ? `<span class="badge soon">Через ${d} дн.</span>`
                    : `<span class="badge normal">Через ${d} дн.</span>`;
        const card = document.createElement('div');
        card.className = 'sub-card';
        card.innerHTML = `
            <div class="sub-info">
                <div class="sub-name">${sub.name}</div>
                <div class="sub-meta">${badge} ${formatDate(sub.date)}</div>
            </div>
            <div class="sub-right">
                <div class="sub-cost">${formatMoney(sub.cost)} ₽</div>
                <button class="delete-btn" onclick="deleteSub(${sub.id})">🗑</button>
            </div>`;
        list.appendChild(card);
    });
}

// ── РАСХОДНИКИ ────────────────────────────────────────
function openConsModal() {
    document.getElementById('cons-name').value = '';
    document.getElementById('cons-days').value = '';
    document.getElementById('cons-start-date').value = new Date().toISOString().split('T')[0];
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('selected'));
    document.getElementById('add-cons-modal').classList.remove('hidden');
    tg.MainButton.hide();
}
function closeConsModal() {
    document.getElementById('add-cons-modal').classList.add('hidden');
    tg.MainButton.show();
}
function setDays(n) {
    document.getElementById('cons-days').value = n;
    document.querySelectorAll('.preset-btn').forEach(b => {
        b.classList.toggle('selected', parseInt(b.textContent) === n);
    });
}
function saveConsumable() {
    const name      = document.getElementById('cons-name').value.trim();
    const days      = parseInt(document.getElementById('cons-days').value);
    const startDate = document.getElementById('cons-start-date').value;
    if (!name || isNaN(days) || !startDate) { tg.showAlert("Заполните все поля"); return; }
    consumables.push({ id: Date.now(), name, days, startDate });
    tg.CloudStorage.setItem(CONS_KEY, JSON.stringify(consumables));
    closeConsModal();
    renderConsumables();
    tg.HapticFeedback.notificationOccurred('success');
}
function deleteCons(id) {
    tg.showConfirm("Удалить расходник?", ok => {
        if (!ok) return;
        consumables = consumables.filter(c => c.id !== id);
        tg.CloudStorage.setItem(CONS_KEY, JSON.stringify(consumables));
        renderConsumables();
        tg.HapticFeedback.impactOccurred('medium');
    });
}
// Обновить дату — нажата кнопка ♻️, фиксируем "использовал сегодня"
function refreshCons(id) {
    const c = consumables.find(c => c.id === id);
    if (!c) return;
    c.startDate = new Date().toISOString().split('T')[0];
    tg.CloudStorage.setItem(CONS_KEY, JSON.stringify(consumables));
    renderConsumables();
    tg.HapticFeedback.notificationOccurred('success');
}
function renderConsumables() {
    const list    = document.getElementById('consumables-list');
    const countEl = document.getElementById('consumables-count');
    const emptyEl = document.getElementById('empty-cons-msg');
    list.innerHTML = '';

    const active = consumables.filter(c => getConsDaysLeft(c) >= 0).length;
    countEl.innerText = active + ' активных';

    if (consumables.length === 0) { list.appendChild(emptyEl); emptyEl.style.display = 'block'; return; }
    emptyEl.style.display = 'none';

    [...consumables].sort((a, b) => getConsDaysLeft(a) - getConsDaysLeft(b)).forEach(c => {
        const dLeft   = getConsDaysLeft(c);
        const pct     = Math.max(0, Math.min(100, Math.round((dLeft / c.days) * 100)));
        const barColor = dLeft < 0 ? '#ff3b30' : dLeft <= 3 ? '#ff9500' : '#34c759';

        const badge = dLeft < 0  ? `<span class="badge overdue">Просрочено</span>`
                    : dLeft === 0 ? `<span class="badge today">Сегодня</span>`
                    : dLeft <= 3  ? `<span class="badge soon">Осталось ${dLeft} дн.</span>`
                    : `<span class="badge normal">Осталось ${dLeft} дн.</span>`;

        const endDate = new Date(c.startDate);
        endDate.setDate(endDate.getDate() + c.days);

        const card = document.createElement('div');
        card.className = 'sub-card';
        card.style.flexDirection = 'column';
        card.style.alignItems = 'stretch';
        card.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center">
                <div class="sub-info">
                    <div class="sub-name">${c.name}</div>
                    <div class="sub-meta">${badge} до ${formatDate(endDate.toISOString().split('T')[0])}</div>
                </div>
                <div style="display:flex;align-items:center;gap:4px">
                    <div style="font-size:13px;color:var(--text-secondary);text-align:right">${c.days} дн.<br><span style="font-size:11px">${pct}%</span></div>
                    <button class="refresh-btn" onclick="refreshCons(${c.id})" title="Использовал сегодня">♻️</button>
                    <button class="delete-btn" onclick="deleteCons(${c.id})">🗑</button>
                </div>
            </div>
            <div class="cons-progress-wrap">
                <div class="cons-progress-bar" style="width:${pct}%;background:${barColor}"></div>
            </div>`;
        list.appendChild(card);
    });
}

// Сколько дней осталось до конца срока расходника
function getConsDaysLeft(c) {
    const end = new Date(c.startDate);
    end.setDate(end.getDate() + c.days);
    end.setHours(0,0,0,0);
    const today = new Date(); today.setHours(0,0,0,0);
    return Math.round((end - today) / 86400000);
}

// ── УВЕДОМЛЕНИЯ ───────────────────────────────────────
function checkAndNotify() {
    const todayStr = new Date().toISOString().split('T')[0];
    tg.CloudStorage.getItem(NOTIFIED_KEY, (err, val) => {
        const notified = (!err && val) ? JSON.parse(val) : {};
        const messages = [];

        // Подписки
        const subOverdue = [], subUrgent = [], subSoon1 = [], subSoon3 = [];
        subscriptions.forEach(s => {
            const nid = `sub_${s.id}_${todayStr}`;
            if (notified[nid]) return;
            const d = getDaysLeft(s.date);
            if      (d < 0)  subOverdue.push(s);
            else if (d === 0) subUrgent.push(s);
            else if (d === 1) subSoon1.push(s);
            else if (d ==
