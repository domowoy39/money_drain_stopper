$ cat > ~/skript.js << 'ENDOFFILE'
const tg = window.Telegram.WebApp;
tg.expand();

const STORAGE_KEY  = 'user_subscriptions_v1';
const CONS_KEY     = 'user_consumables_v1';
const NOTIFIED_KEY = 'notified_dates_v1';

let subscriptions = [];
let consumables   = [];
let currentTab    = 'subs';

async function init() {
    setupMainButton();
    tg.CloudStorage.getItem(STORAGE_KEY, function(err, val) {
        if (!err && val) subscriptions = JSON.parse(val);
        tg.CloudStorage.getItem(CONS_KEY, function(err2, val2) {
            if (!err2 && val2) consumables = JSON.parse(val2);
            document.getElementById('loader').classList.add('hidden');
            document.getElementById('main-app').classList.remove('hidden');
            renderSubs();
            renderConsumables();
            checkAndNotify();
        });
    });
}

function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
    event.target.classList.add('active');
    document.getElementById('tab-subs').classList.toggle('hidden', tab !== 'subs');
    document.getElementById('tab-consumables').classList.toggle('hidden', tab !== 'consumables');
    setupMainButton();
}

function setupMainButton() {
    if (tg.MainButton._clickHandler) {
        tg.MainButton.offClick(tg.MainButton._clickHandler);
    }
    if (currentTab === 'subs') {
        tg.MainButton.setText("ДОБАВИТЬ ПОДПИСКУ");
        tg.MainButton._clickHandler = function() { openModal(); };
    } else {
        tg.MainButton.setText("ДОБАВИТЬ РАСХОДНИК");
        tg.MainButton._clickHandler = function() { openConsModal(); };
    }
    tg.MainButton.onClick(tg.MainButton._clickHandler);
    tg.MainButton.show();
}

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
    var name = document.getElementById('sub-name').value.trim();
    var cost = parseInt(document.getElementById('sub-cost').value);
    var date = document.getElementById('sub-date').value;
    if (!name || isNaN(cost) || !date) { tg.showAlert("Заполните все поля"); return; }
    subscriptions.push({ id: Date.now(), name: name, cost: cost, date: date });
    tg.CloudStorage.setItem(STORAGE_KEY, JSON.stringify(subscriptions));
    closeModal();
    renderSubs();
    tg.HapticFeedback.notificationOccurred('success');
}

function deleteSub(id) {
    tg.showConfirm("Удалить подписку?", function(ok) {
        if (!ok) return;
        subscriptions = subscriptions.filter(function(s) { return s.id !== id; });
        tg.CloudStorage.setItem(STORAGE_KEY, JSON.stringify(subscriptions));
        renderSubs();
        tg.HapticFeedback.impactOccurred('medium');
    });
}

function renderSubs() {
    var list    = document.getElementById('subscriptions-list');
    var totalEl = document.getElementById('total-cost');
    var emptyEl = document.getElementById('empty-msg');
    list.innerHTML = '';
    var total = subscriptions.reduce(function(s, x) { return s + x.cost; }, 0);
    totalEl.innerText = formatMoney(total) + ' ₽';
    if (subscriptions.length === 0) {
        list.appendChild(emptyEl);
        emptyEl.style.display = 'block';
        return;
    }
    emptyEl.style.display = 'none';
    var sorted = subscriptions.slice().sort(function(a, b) { return new Date(a.date) - new Date(b.date); });
    sorted.forEach(function(sub) {
        var d = getDaysLeft(sub.date);
        var badge;
        if (d < 0)       badge = '<span class="badge overdue">Просрочено</span>';
        else if (d === 0) badge = '<span class="badge today">Сегодня</span>';
        else if (d <= 3)  badge = '<span class="badge soon">Через ' + d + ' дн.</span>';
        else              badge = '<span class="badge normal">Через ' + d + ' дн.</span>';
        var card = document.createElement('div');
        card.className = 'sub-card';
        card.innerHTML =
            '<div class="sub-info">' +
                '<div class="sub-name">' + sub.name + '</div>' +
                '<div class="sub-meta">' + badge + ' ' + formatDate(sub.date) + '</div>' +
            '</div>' +
            '<div class="sub-right">' +
                '<div class="sub-cost">' + formatMoney(sub.cost) + ' ₽</div>' +
                '<button class="delete-btn" onclick="deleteSub(' + sub.id + ')">🗑</button>' +
            '</div>';
        list.appendChild(card);
    });
}

function openConsModal() {
    document.getElementById('cons-name').value = '';
    document.getElementById('cons-days').value = '';
    document.getElementById('cons-start-date').value = new Date().toISOString().split('T')[0];
    document.querySelectorAll('.preset-btn').forEach(function(b) { b.classList.remove('selected'); });
    document.getElementById('add-cons-modal').classList.remove('hidden');
    tg.MainButton.hide();
}

function closeConsModal() {
    document.getElementById('add-cons-modal').classList.add('hidden');
    tg.MainButton.show();
}

function setDays(n) {
    document.getElementById('cons-days').value = n;
    document.querySelectorAll('.preset-btn').forEach(function(b) {
        b.classList.toggle('selected', parseInt(b.textContent) === n);
    });
}

function saveConsumable() {
    var name      = document.getElementById('cons-name').value.trim();
    var days      = parseInt(document.getElementById('cons-days').value);
    var startDate = document.getElementById('cons-start-date').value;
    if (!name || isNaN(days) || !startDate) { tg.showAlert("Заполните все поля"); return; }
    consumables.push({ id: Date.now(), name: name, days: days, startDate: startDate });
    tg.CloudStorage.setItem(CONS_KEY, JSON.stringify(consumables));
    closeConsModal();
    renderConsumables();
    tg.HapticFeedback.notificationOccurred('success');
}

function deleteCons(id) {
    tg.showConfirm("Удалить расходник?", function(ok) {
        if (!ok) return;
        consumables = consumables.filter(function(c) { return c.id !== id; });
        tg.CloudStorage.setItem(CONS_KEY, JSON.stringify(consumables));
        renderConsumables();
        tg.HapticFeedback.impactOccurred('medium');
    });
}

function refreshCons(id) {
    var c = consumables.find(function(c) { return c.id === id; });
    if (!c) return;
    c.startDate = new Date().toISOString().split('T')[0];
    tg.CloudStorage.setItem(CONS_KEY, JSON.stringify(consumables));
    renderConsumables();
    tg.HapticFeedback.notificationOccurred('success');
}

function renderConsumables() {
    var list    = document.getElementById('consumables-list');
    var countEl = document.getElementById('consumables-count');
    var emptyEl = document.getElementById('empty-cons-msg');
    list.innerHTML = '';
    var active = consumables.filter(function(c) { return getConsDaysLeft(c) >= 0; }).length;
    countEl.innerText = active + ' активных';
    if (consumables.length === 0) {
        list.appendChild(emptyEl);
        emptyEl.style.display = 'block';
        return;
    }
    emptyEl.style.display = 'none';
    var sorted = consumables.slice().sort(function(a, b) { return getConsDaysLeft(a) - getConsDaysLeft(b); });
    sorted.forEach(function(c) {
        var dLeft    = getConsDaysLeft(c);
        var pct      = Math.max(0, Math.min(100, Math.round((dLeft / c.days) * 100)));
        var barColor = dLeft < 0 ? '#ff3b30' : dLeft <= 3 ? '#ff9500' : '#34c759';
        var badge;
        if (dLeft < 0)        badge = '<span class="badge overdue">Просрочено</span>';
        else if (dLeft === 0)  badge = '<span class="badge today">Сегодня</span>';
        else if (dLeft <= 3)   badge = '<span class="badge soon">Осталось ' + dLeft + ' дн.</span>';
        else                   badge = '<span class="badge normal">Осталось ' + dLeft + ' дн.</span>';
        var endDate = new Date(c.startDate);
        endDate.setDate(endDate.getDate() + c.days);
        var endStr = endDate.toISOString().split('T')[0];
        var card = document.createElement('div');
        card.className = 'sub-card';
        card.style.flexDirection = 'column';
        card.style.alignItems = 'stretch';
        card.innerHTML =
            '<div style="display:flex;justify-content:space-between;align-items:center">' +
                '<div class="sub-info">' +
                    '<div class="sub-name">' + c.name + '</div>' +
                    '<div class="sub-meta">' + badge + ' до ' + formatDate(endStr) + '</div>' +
                '</div>' +
                '<div style="display:flex;align-items:center;gap:4px">' +
                    '<div style="font-size:13px;color:var(--text-secondary);text-align:right">' + c.days + ' дн.<br><span style="font-size:11px">' + pct + '%</span></div>' +
                    '<button class="refresh-btn" onclick="refreshCons(' + c.id + ')" title="Использовал сегодня">♻️</button>' +
                    '<button class="delete-btn" onclick="deleteCons(' + c.id + ')">🗑</button>' +
                '</div>' +
            '</div>' +
            '<div class="cons-progress-wrap">' +
                '<div class="cons-progress-bar" style="width:' + pct + '%;background:' + barColor + '"></div>' +
            '</div>';
        list.appendChild(card);
    });
}

function getConsDaysLeft(c) {
    var end = new Date(c.startDate);
    end.setDate(end.getDate() + c.days);
    end.setHours(0,0,0,0);
    var today = new Date();
    today.setHours(0,0,0,0);
    return Math.round((end - today) / 86400000);
}

function checkAndNotify() {
    var todayStr = new Date().toISOString().split('T')[0];
    tg.CloudStorage.getItem(NOTIFIED_KEY, function(err, val) {
        var notified = (!err && val) ? JSON.parse(val) : {};
        var messages = [];

        var subOverdue = [], subUrgent = [], subSoon1 = [], subSoon3 = [];
        subscriptions.forEach(function(s) {
            var nid = 'sub_' + s.id + '_' + todayStr;
            if (notified[nid]) return;
            var d = getDaysLeft(s.date);
            if (d < 0)        subOverdue.push(s);
            else if (d === 0) subUrgent.push(s);
            else if (d === 1) subSoon1.push(s);
            else if (d === 3) subSoon3.push(s);
        });

        if (subOverdue.length) messages.push('🔴 Просроченные подписки:\n' + subOverdue.map(function(s) { return '• ' + s.name + ' — ' + s.cost + ' ₽'; }).join('\n'));
        if (subUrgent.length)  messages.push('⚡️ Сегодня списание:\n'       + subUrgent.map(function(s) { return '• ' + s.name + ' — ' + s.cost + ' ₽'; }).join('\n'));
        if (subSoon1.length)   messages.push('⏰ Завтра списание:\n'         + subSoon1.map(function(s) { return '• ' + s.name + ' — ' + s.cost + ' ₽'; }).join('\n'));
        if (subSoon3.length)   messages.push('📅 Через 3 дня списание:\n'   + subSoon3.map(function(s) { return '• ' + s.name + ' — ' + s.cost + ' ₽'; }).join('\n'));

        var consOverdue = [], consUrgent = [], consSoon = [];
        consumables.forEach(function(c) {
            var nid = 'cons_' + c.id + '_' + todayStr;
            if (notified[nid]) return;
            var d = getConsDaysLeft(c);
            if (d < 0)        consOverdue.push(c);
            else if (d === 0) consUrgent.push(c);
            else if (d <= 3)  consSoon.push(c);
        });

        if (consOverdue.length) messages.push('🔴 Расходники закончились:\n'          + consOverdue.map(function(c) { return '• ' + c.name; }).join('\n'));
        if (consUrgent.length)  messages.push('⚡️ Расходники заканчиваются сегодня:\n' + consUrgent.map(function(c) { return '• ' + c.name; }).join('\n'));
        if (consSoon.length)    messages.push('📦 Скоро закончатся (до 3 дн.):\n'      + consSoon.map(function(c) { return '• ' + c.name + ' — осталось ' + getConsDaysLeft(c) + ' дн.'; }).join('\n'));

        if (messages.length === 0) return;

        showNextAlert(messages, 0, function() {
            var allShown = subOverdue.concat(subUrgent, subSoon1, subSoon3, consOverdue, consUrgent, consSoon);
            allShown.forEach(function(item) {
                var prefix = (item.cost !== undefined) ? 'sub' : 'cons';
                notified[prefix + '_' + item.id + '_' + todayStr] = true;
            });
            var cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - 7);
            Object.keys(notified).forEach(function(k) {
                var d = k.split('_').pop();
                if (new Date(d) < cutoff) delete notified[k];
            });
            tg.CloudStorage.setItem(NOTIFIED_KEY, JSON.stringify(notified));
        });
    });
}

function showNextAlert(msgs, i, done) {
    if (i >= msgs.length) { done(); return; }
    tg.showAlert(msgs[i], function() { showNextAlert(msgs, i + 1, done); });
}

function getDaysLeft(dateStr) {
    var today = new Date(); today.setHours(0,0,0,0);
    var target = new Date(dateStr); target.setHours(0,0,0,0);
    return Math.round((target - today) / 86400000);
}

function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

function formatMoney(n) {
    return n.toLocaleString('ru-RU');
}

init();
ENDOFFILE
echo "Lines: $(wc -l < ~/skript.js)"
