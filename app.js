import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAN8GWRVvtLWH1HzyTDhJnUf_-h4Jp-UhA",
    authDomain: "all-family-calendar.firebaseapp.com",
    projectId: "all-family-calendar",
    storageBucket: "all-family-calendar.firebasestorage.app",
    messagingSenderId: "790336816938",
    appId: "1:790336816938:web:b3b06b1c9877e5ba46c053"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const eventsRef = collection(db, 'familyEvents');
const membersRef = collection(db, 'familyMembers');
const noteRef = doc(db, 'familyNotes', 'mainNote'); 

let currentDate = new Date();
let events = [];
let familyMembers = [];
let weatherData = {}; 
let currentEditingId = null;
let currentViewingId = null;
let selectedDateForModal = null;
let searchQuery = '';
let clickCount = 0;
let clickTimer = null;

function triggerHaptic() {
    if (window.navigator && window.navigator.vibrate) window.navigator.vibrate(10);
}

/* ================== 🌟 主題風格切換管理 ================== */
const themePalettes = {
    warm: { 50: '#fff7ed', 100: '#ffedd5', 200: '#fed7aa', 300: '#fdba74', 400: '#fb923c', 500: '#f97316', 600: '#ea580c', 700: '#c2410c', 800: '#9a3412', 900: '#7c2d12' },
    forest: { 50: '#f0fdf4', 100: '#dcfce7', 200: '#bbf7d0', 300: '#86efac', 400: '#4ade80', 500: '#22c55e', 600: '#16a34a', 700: '#15803d', 800: '#166534', 900: '#14532d' },
    purple: { 50: '#faf5ff', 100: '#f3e8ff', 200: '#e9d5ff', 300: '#d8b4fe', 400: '#c084fc', 500: '#a855f7', 600: '#9333ea', 700: '#7e22ce', 800: '#6b21a8', 900: '#581c87' },
    dark: { 50: '#18181b', 100: '#27272a', 200: '#3f3f46', 300: '#52525b', 400: '#71717a', 500: '#a1a1aa', 600: '#d4d4d8', 700: '#e4e4e7', 800: '#f4f4f5', 900: '#fafafa' }
};

function setTheme(themeName) {
    const palette = themePalettes[themeName] || themePalettes.warm;
    const root = document.documentElement;
    Object.keys(palette).forEach(key => {
        root.style.setProperty(`--color-${key}`, palette[key]);
    });
    localStorage.setItem('family_app_theme', themeName);
    const selectEl = document.getElementById('theme-select');
    if (selectEl) selectEl.value = themeName;
}

// 初始化載入儲存的主題
const savedTheme = localStorage.getItem('family_app_theme') || 'warm';
setTheme(savedTheme);

document.getElementById('theme-select').addEventListener('change', (e) => {
    triggerHaptic();
    setTheme(e.target.value);
});

/* ================== 天氣 API (台南市) ================== */
async function fetchWeather() {
    try {
        const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=22.9908&longitude=120.2133&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=Asia%2FTaipei');
        const data = await res.json();
        const weatherMoji = {
            0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
            45: '🌫️', 48: '🌫️', 51: '🌧️', 53: '🌧️', 55: '🌧️',
            61: '🌧️', 63: '🌧️', 65: '🌧️', 71: '❄️', 73: '❄️', 75: '❄️', 95: '⛈️'
        };
        if (data && data.daily) {
            data.daily.time.forEach((dateStr, index) => {
                const code = data.daily.weathercode[index];
                const maxTemp = Math.round(data.daily.temperature_2m_max[index]);
                weatherData[dateStr] = `${weatherMoji[code] || '☁️'} ${maxTemp}°`;
            });
        }
    } catch (e) { console.log("氣象載入失敗:", e); }
}
fetchWeather().then(() => renderCalendar());

/* ================== 家庭共用便利貼 ================== */
const stickyNoteEl = document.getElementById('family-sticky-note');
const noteStatusEl = document.getElementById('note-status');
let noteTimeout = null;

onSnapshot(noteRef, (docSnap) => {
    if (docSnap.exists()) {
        const data = docSnap.data();
        if (document.activeElement !== stickyNoteEl) stickyNoteEl.value = data.content || '';
    }
});

stickyNoteEl.addEventListener('input', () => {
    noteStatusEl.textContent = '儲存中...';
    noteStatusEl.classList.remove('opacity-0');
    if (noteTimeout) clearTimeout(noteTimeout);
    noteTimeout = setTimeout(async () => {
        try {
            await setDoc(noteRef, { content: stickyNoteEl.value }, { merge: true });
            noteStatusEl.textContent = '已同步';
            setTimeout(() => noteStatusEl.classList.add('opacity-0'), 2000);
        } catch (e) { noteStatusEl.textContent = '儲存失敗'; }
    }, 1000); 
});

/* ================== 成員管理系統 ================== */
onSnapshot(membersRef, (snapshot) => {
    familyMembers = [];
    snapshot.forEach((doc) => {
        familyMembers.push({ id: doc.id, name: doc.data().name });
    });
    familyMembers.sort((a, b) => a.name.localeCompare(b.name));
    renderMemberSelects();
    renderMemberManageList();
});

function renderMemberSelects() {
    const datalist = document.getElementById('member-list');
    const voterSelect = document.getElementById('poll-voter-select');
    
    if (datalist) datalist.innerHTML = '';
    
    let currentVoter = '';
    if (voterSelect) {
        currentVoter = voterSelect.value;
        voterSelect.innerHTML = '<option value="" disabled selected>請點此選擇您是哪位成員...</option>';
    }

    familyMembers.forEach(m => {
        if (datalist) {
            const opt = document.createElement('option');
            opt.value = m.name;
            datalist.appendChild(opt);
        }
        if (voterSelect) {
            const vOpt = document.createElement('option');
            vOpt.value = m.name;
            vOpt.textContent = m.name;
            voterSelect.appendChild(vOpt);
        }
    });

    if (voterSelect && familyMembers.some(m => m.name === currentVoter)) {
        voterSelect.value = currentVoter;
    }
}

function renderMemberManageList() {
    const container = document.getElementById('member-list-container');
    if(!container) return;
    container.innerHTML = '';
    
    if(familyMembers.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-400 text-sm py-6"><i class="fas fa-user-plus mb-2 text-xl opacity-50"></i><br>目前尚未建立任何成員</p>';
        return;
    }

    familyMembers.forEach(m => {
        const item = document.createElement('div');
        item.className = 'flex justify-between items-center bg-white p-3 rounded-xl border border-warm-100 shadow-sm transition-all hover:border-warm-300';
        item.innerHTML = `
            <span class="font-bold text-gray-700 text-sm">${m.name}</span>
            <div class="flex gap-1">
                <button class="btn-edit-member text-warm-500 hover:bg-warm-50 px-2.5 py-1.5 rounded-lg transition-colors"><i class="fas fa-pen"></i></button>
                <button class="btn-delete-member text-rose-400 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg transition-colors"><i class="fas fa-trash-alt"></i></button>
            </div>
        `;
        item.querySelector('.btn-edit-member').addEventListener('click', async () => {
            triggerHaptic();
            const newName = prompt('請輸入新的成員名稱：', m.name);
            if (newName && newName.trim() !== '' && newName.trim() !== m.name) {
                if (familyMembers.some(ext => ext.name === newName.trim())) return alert('此名字已經存在囉！');
                await updateDoc(doc(db, 'familyMembers', m.id), { name: newName.trim() });
            }
        });
        item.querySelector('.btn-delete-member').addEventListener('click', async () => {
            triggerHaptic();
            if (confirm(`確定要刪除成員「${m.name}」嗎？\n(注意：這不會影響過去已經建立的歷史行程)`)) {
                await deleteDoc(doc(db, 'familyMembers', m.id));
            }
        });
        container.appendChild(item);
    });
}

document.getElementById('btn-add-member').addEventListener('click', async () => {
    triggerHaptic();
    const input = document.getElementById('new-member-name');
    const name = input.value.trim();
    if (name) {
        if(familyMembers.some(m => m.name === name)) return alert('這個成員已經存在囉！');
        await addDoc(membersRef, { name: name });
        input.value = '';
    }
});
document.getElementById('btn-manage-members').addEventListener('click', () => { triggerHaptic(); document.getElementById('member-modal').classList.remove('hidden'); });
document.getElementById('btn-close-member-modal').addEventListener('click', () => { triggerHaptic(); document.getElementById('member-modal').classList.add('hidden'); });

/* ================== 相片牆 (網址預覽) ================== */
const photoUrlInput = document.getElementById('event-photo-url');
const photoPreview = document.getElementById('photo-preview');
const previewImg = photoPreview.querySelector('img');

photoUrlInput.addEventListener('input', (e) => {
    const url = e.target.value.trim();
    if (url) {
        previewImg.src = url;
        photoPreview.classList.remove('hidden');
    } else {
        previewImg.src = '';
        photoPreview.classList.add('hidden');
    }
});
document.getElementById('btn-remove-photo').addEventListener('click', () => {
    triggerHaptic();
    photoUrlInput.value = '';
    previewImg.src = '';
    photoPreview.classList.add('hidden');
});

/* ================== 家庭回憶相簿牆互動邏輯 ================== */
const galleryModal = document.getElementById('gallery-modal');
document.getElementById('btn-open-gallery').addEventListener('click', () => {
    triggerHaptic();
    renderGalleryGrid();
    galleryModal.classList.remove('hidden');
});
document.getElementById('btn-close-gallery').addEventListener('click', () => {
    triggerHaptic();
    galleryModal.classList.add('hidden');
});

function renderGalleryGrid() {
    const container = document.getElementById('gallery-grid-container');
    container.innerHTML = '';
    
    const photoEvents = events.filter(e => e.photoUrl && e.photoUrl.trim() !== '').sort((a, b) => b.startDate.localeCompare(a.startDate));

    if (photoEvents.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center py-16 text-gray-400">
                <i class="far fa-images text-4xl mb-3 opacity-50"></i>
                <p class="text-sm">目前還沒有任何相片記錄喔！</p>
                <p class="text-xs text-gray-300 mt-1">在建立或編輯行程時貼上相片網址，照片就會自動收錄在這裡。</p>
            </div>
        `;
        return;
    }

    photoEvents.forEach(evt => {
        const item = document.createElement('div');
        item.className = 'bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-all cursor-pointer flex flex-col group';
        item.innerHTML = `
            <div class="aspect-square w-full overflow-hidden bg-gray-100 relative">
                <img src="${evt.photoUrl}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300">
                <div class="absolute top-2 left-2 bg-black/50 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    ${evt.startDate}
                </div>
            </div>
            <div class="p-3 flex flex-col justify-between flex-1">
                <h4 class="font-bold text-gray-800 text-xs truncate">${evt.icon ? evt.icon+' ' : ''}${evt.title}</h4>
                <p class="text-[10px] text-gray-400 mt-1 flex items-center gap-1"><i class="far fa-user"></i> ${evt.author || '家族成員'}</p>
            </div>
        `;
        item.addEventListener('click', () => {
            triggerHaptic();
            galleryModal.classList.add('hidden');
            openViewModal(evt.id);
        });
        container.appendChild(item);
    });
}

/* ================== 攜帶物品與任務認領系統 ================== */
const checklistCheckbox = document.getElementById('event-is-checklist');
const checklistFields = document.getElementById('checklist-fields');
const checklistContainer = document.getElementById('checklist-items-container');

checklistCheckbox.addEventListener('change', (e) => {
    if (e.target.checked) {
        checklistFields.classList.remove('hidden');
        if (checklistContainer.children.length === 0) addChecklistRow('', '', false);
    } else {
        checklistFields.classList.add('hidden');
    }
});

function addChecklistRow(text = '', assignee = '', done = false) {
    const row = document.createElement('div');
    row.className = 'flex items-center gap-2 checklist-row';
    row.dataset.done = done ? 'true' : 'false';
    row.innerHTML = `
        <input type="text" placeholder="物品或任務 (例: 冰桶、麻將席)" value="${text}" class="checklist-text flex-1 px-3 py-1.5 bg-white border border-emerald-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-400" required>
        <input type="text" list="member-list" placeholder="認領人(可選)" value="${assignee}" class="checklist-assignee w-28 px-2.5 py-1.5 bg-white border border-emerald-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-400">
        <button type="button" class="btn-remove-check text-rose-400 hover:text-rose-600 p-1 text-sm"><i class="fas fa-trash-alt"></i></button>
    `;
    row.querySelector('.btn-remove-check').addEventListener('click', () => row.remove());
    checklistContainer.appendChild(row);
}
document.getElementById('btn-add-checklist-item').addEventListener('click', () => { triggerHaptic(); addChecklistRow(); });

/* ================== 投票表決系統 ================== */
const pollCheckbox = document.getElementById('event-is-poll');
const pollFields = document.getElementById('poll-fields');
const pollOptionsContainer = document.getElementById('poll-options-container');

pollCheckbox.addEventListener('change', (e) => {
    if (e.target.checked) {
        pollFields.classList.remove('hidden');
        if (pollOptionsContainer.children.length === 0) addPollOptionRow('');
    } else {
        pollFields.classList.add('hidden');
    }
});

function addPollOptionRow(title = '') {
    const row = document.createElement('div');
    row.className = 'flex items-center gap-2 poll-row';
    row.innerHTML = `
        <input type="text" placeholder="輸入選項 (例: 去山上露營 / 10月20日)" value="${title}" class="poll-option-title flex-1 px-3 py-1.5 bg-white border border-indigo-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-400" required>
        <button type="button" class="btn-remove-poll text-rose-400 hover:text-rose-600 p-1 text-sm"><i class="fas fa-trash-alt"></i></button>
    `;
    row.querySelector('.btn-remove-poll').addEventListener('click', () => row.remove());
    pollOptionsContainer.appendChild(row);
}
document.getElementById('btn-add-poll-option').addEventListener('click', () => { triggerHaptic(); addPollOptionRow(); });

/* ================== 記帳與權重分帳系統 ================== */
const expenseCheckbox = document.getElementById('event-is-expense');
const expenseFields = document.getElementById('expense-fields');
const payersContainer = document.getElementById('payers-container');
const sharersContainer = document.getElementById('sharers-container');

expenseCheckbox.addEventListener('change', (e) => {
    if (e.target.checked) {
        expenseFields.classList.remove('hidden');
        if (payersContainer.children.length === 0) addPayerRow('', '');
    } else { expenseFields.classList.add('hidden'); }
});

function addPayerRow(name = '', amount = '') {
    const row = document.createElement('div');
    row.className = 'flex items-center gap-2 payer-row';
    row.innerHTML = `
        <input type="text" list="member-list" placeholder="輸入墊付人" value="${name}" class="payer-name w-1/3 px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-amber-400" required>
        <input type="number" placeholder="金額 $" value="${amount}" class="payer-amount flex-1 px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-amber-400" required>
        <button type="button" class="btn-remove-payer text-rose-400 hover:text-rose-600 p-1 text-sm"><i class="fas fa-trash-alt"></i></button>
    `;
    row.querySelector('.btn-remove-payer').addEventListener('click', () => row.remove());
    payersContainer.appendChild(row);
}
document.getElementById('btn-add-payer').addEventListener('click', () => { triggerHaptic(); addPayerRow(); });

function addSharerRow(name = '', weight = 1) {
    const row = document.createElement('div');
    row.className = 'flex items-center gap-2 sharer-row';
    row.innerHTML = `
        <input type="text" list="member-list" placeholder="分攤成員" value="${name}" class="sharer-name flex-1 px-3 py-1.5 bg-white border border-orange-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-orange-400" required>
        <div class="flex items-center bg-white border border-orange-200 rounded-xl px-2 py-1">
            <input type="number" min="0.5" step="0.5" value="${weight}" class="sharer-weight w-12 text-center text-xs font-bold outline-none">
            <span class="text-[10px] text-gray-400">份</span>
        </div>
        <button type="button" class="btn-remove-sharer text-rose-400 hover:text-rose-600 p-1 text-sm"><i class="fas fa-trash-alt"></i></button>
    `;
    row.querySelector('.btn-remove-sharer').addEventListener('click', () => row.remove());
    sharersContainer.appendChild(row);
}
document.getElementById('btn-add-sharer').addEventListener('click', () => { triggerHaptic(); addSharerRow('', 1); });

/* ================== 行事曆核心 ================== */
const modals = ['admin-modal', 'day-modal', 'event-modal', 'view-modal', 'member-modal', 'gallery-modal'];
modals.forEach(modalId => {
    const modalEl = document.getElementById(modalId);
    modalEl.addEventListener('click', (e) => {
        if (e.target === modalEl) {
            triggerHaptic();
            modalEl.classList.add('hidden');
            if (modalId === 'day-modal') selectedDateForModal = null;
            if (modalId === 'view-modal') currentViewingId = null;
        }
    });
});

let touchStartX = 0;
let touchEndX = 0;
const swipeContainer = document.getElementById('calendar-swipe-container');
swipeContainer.addEventListener('touchstart', (e) => { touchStartX = e.changedTouches[0].screenX; }, { passive: true });
swipeContainer.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    const swipeThreshold = 50;
    if (touchEndX < touchStartX - swipeThreshold) { triggerHaptic(); currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(); }
    if (touchEndX > touchStartX + swipeThreshold) { triggerHaptic(); currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(); }
}, { passive: true });

document.getElementById('admin-trigger').addEventListener('click', () => {
    clickCount++;
    if (clickTimer) clearTimeout(clickTimer);
    if (clickCount >= 3) {
        clickCount = 0;
        triggerHaptic();
        document.getElementById('admin-modal').classList.remove('hidden');
    } else {
        clickTimer = setTimeout(() => { clickCount = 0; }, 500);
    }
});
document.getElementById('btn-close-admin').addEventListener('click', () => { triggerHaptic(); document.getElementById('admin-modal').classList.add('hidden'); });

onSnapshot(eventsRef, (snapshot) => {
    events = [];
    snapshot.forEach((doc) => {
        const data = doc.data();
        events.push({ 
            id: doc.id, title: data.title, icon: data.icon || '', startDate: data.startDate || data.date, endDate: data.endDate || data.date, time: data.time || '', author: data.author || '', description: data.description || '', isNav: data.isNav || false, color: data.color || 'bg-rose-400', 
            isExpense: data.isExpense || false, payers: data.payers || [], expenseSplits: data.expenseSplits || 4, sharers: data.sharers || [],
            photoUrl: data.photoUrl || null,
            isPoll: data.isPoll || false, pollOptions: data.pollOptions || [],
            isChecklist: data.isChecklist || false, checklist: data.checklist || []
        });
    });
    renderApp();
    if (selectedDateForModal) openDayModal(selectedDateForModal, false);
    if (currentViewingId) openViewModal(currentViewingId);
});

function formatDateStr(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

document.getElementById('search-input').addEventListener('input', (e) => { searchQuery = e.target.value.trim().toLowerCase(); renderApp(); });

/* ================== 後台管理：ICS 與 JSON 完整備份還原 ================== */
document.getElementById('ics-file-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function(event) {
        const text = event.target.result;
        const eventsToImport = parseICS(text);
        if (eventsToImport.length === 0) return alert('無法解析該 ICS 檔案！');
        if (confirm(`確認批次匯入 ${eventsToImport.length} 筆資料？`)) {
            try {
                for (let evt of eventsToImport) await addDoc(eventsRef, evt);
                triggerHaptic();
                alert('匯入成功！');
                document.getElementById('admin-modal').classList.add('hidden');
            } catch (err) { alert('匯入失敗，請稍後再試。'); }
        }
        e.target.value = '';
    };
    reader.readAsText(file);
});

document.getElementById('btn-clear-gov').addEventListener('click', async () => {
    const govEvents = events.filter(e => e.author === '政府行事曆');
    if (govEvents.length === 0) return alert('目前沒有任何政府行事曆資料！');
    const seen = new Set();
    const duplicatesToDelete = [];
    govEvents.forEach(evt => {
        const key = `${evt.title}_${evt.startDate}`;
        if (seen.has(key)) duplicatesToDelete.push(evt);
        else seen.add(key);
    });
    if (duplicatesToDelete.length === 0) return alert('沒有發現重複項目。');
    if (confirm(`發現 ${duplicatesToDelete.length} 筆重複資料，確認清除？`)) {
        try {
            for (let evt of duplicatesToDelete) await deleteDoc(doc(eventsRef, evt.id));
            triggerHaptic();
            alert('清除成功！');
            document.getElementById('admin-modal').classList.add('hidden');
        } catch (err) { alert('清理失敗。'); }
    }
});

document.getElementById('btn-export-backup').addEventListener('click', () => {
    triggerHaptic();
    const backupData = {
        version: '4.2',
        exportedAt: new Date().toISOString(),
        familyMembers: familyMembers.map(m => ({ name: m.name })),
        familyEvents: events.map(({ id, ...rest }) => rest),
        stickyNote: stickyNoteEl.value || ''
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `family_calendar_backup_${formatDateStr(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
});

document.getElementById('json-restore-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
        try {
            const data = JSON.parse(ev.target.result);
            if (!data.familyEvents && !data.familyMembers) return alert('備份檔案格式不正確！');
            
            if (confirm(`確定要從備份檔還原嗎？\n將匯入 ${data.familyMembers?.length || 0} 位成員與 ${data.familyEvents?.length || 0} 筆行程。`)) {
                if (data.familyMembers) {
                    for (let m of data.familyMembers) {
                        if (m.name && !familyMembers.some(ext => ext.name === m.name)) {
                            await addDoc(membersRef, { name: m.name });
                        }
                    }
                }
                if (data.familyEvents) {
                    for (let evt of data.familyEvents) {
                        await addDoc(eventsRef, evt);
                    }
                }
                if (typeof data.stickyNote === 'string') {
                    await setDoc(noteRef, { content: data.stickyNote }, { merge: true });
                }
                triggerHaptic();
                alert('系統備份資料還原成功！');
                document.getElementById('admin-modal').classList.add('hidden');
            }
        } catch (err) {
            console.error(err);
            alert('讀取備份檔失敗，請確認檔案是否為有效的 JSON！');
        }
        e.target.value = '';
    };
    reader.readAsText(file);
});

function parseICS(icsText) {
    const parsedEvents = [];
    const lines = icsText.split(/\r\n|\n|\r/);
    let currentEvent = null;
    for (let line of lines) {
        line = line.trim();
        if (line === 'BEGIN:VEVENT') {
            currentEvent = { title: '', icon: '', startDate: '', endDate: '', author: '政府行事曆', description: '', isNav: false, color: 'bg-rose-400', isExpense: false, payers: [], expenseSplits: 1, sharers: [], isPoll: false, pollOptions: [], isChecklist: false, checklist: [] };
        } else if (line === 'END:VEVENT' && currentEvent) {
            if (currentEvent.title && currentEvent.startDate) {
                if (!currentEvent.endDate) currentEvent.endDate = currentEvent.startDate;
                parsedEvents.push(currentEvent);
            }
            currentEvent = null;
        } else if (currentEvent) {
            if (line.startsWith('SUMMARY:')) currentEvent.title = line.substring(8).trim();
            else if (line.startsWith('DTSTART')) currentEvent.startDate = formatICSDate(line.split(':').pop().trim());
            else if (line.startsWith('DTEND')) {
                let d = parseICSDateObj(line.split(':').pop().trim());
                if (d) { d.setDate(d.getDate() - 1); currentEvent.endDate = formatDateStr(d); }
            } else if (line.startsWith('DESCRIPTION:')) { currentEvent.description = line.substring(12).trim(); }
        }
    }
    parsedEvents.forEach(e => { if (!e.endDate) e.endDate = e.startDate; });
    return parsedEvents;
}
function formatICSDate(str) { if (str.length >= 8) return `${str.substring(0,4)}-${str.substring(4,6)}-${str.substring(6,8)}`; return str; }
function parseICSDateObj(str) { if (str.length >= 8) return new Date(parseInt(str.substring(0,4)), parseInt(str.substring(4,6))-1, parseInt(str.substring(6,8))); return null; }

function renderApp() { renderCalendar(); renderUpcoming(); }

function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    document.getElementById('current-month-year').innerText = `${year}年 ${month + 1}月`;
    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = '';
    const todayStr = formatDateStr(new Date());
    
    for (let i = 0; i < firstDay; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'border border-warm-100 rounded-xl bg-[#fdfbf9]/50 opacity-30';
        grid.appendChild(emptyCell);
    }
    for (let i = 1; i <= totalDays; i++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        grid.appendChild(createDayCell(i, dateStr, dateStr === todayStr));
    }
}

function getTotalExpense(evt) {
    if (!evt.payers || evt.payers.length === 0) return 0;
    return evt.payers.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
}

function createDayCell(dayNum, dateStr, isToday = false) {
    const dateObj = new Date(dateStr);
    const dayOfWeek = dateObj.getDay();
    let lunarStr = '';
    try {
        const lunar = Solar.fromDate(dateObj).getLunar();
        lunarStr = lunar.getFestivals()[0] || lunar.getDayInChinese();
        if (lunar.getDay() === 1) lunarStr = lunar.getMonthInChinese() + '月';
    } catch (err) {}

    const allEventsForCheck = events.filter(e => dateStr >= e.startDate && dateStr <= e.endDate);
    const isMakeUpWorkDay = allEventsForCheck.some(e => e.author === '政府行事曆' && (e.title.includes('上班') || e.title.includes('補班')));
    const isRedDay = ((dayOfWeek === 0 || dayOfWeek === 6) && !isMakeUpWorkDay) || allEventsForCheck.some(e => e.author === '政府行事曆');
    const dayEvents = allEventsForCheck.sort((a, b) => (a.time || '24:00').localeCompare(b.time || '24:00'));

    let cellBgClass = isToday ? 'bg-warm-50 border-warm-300 ring-2 ring-warm-400' : (isRedDay ? 'bg-rose-50/80 border-rose-200 hover:bg-rose-100/80' : 'bg-white hover:border-warm-300 hover:shadow-sm');

    const cell = document.createElement('div');
    cell.className = `border border-warm-100 rounded-xl p-1 flex flex-col gap-1 transition-all ${cellBgClass} cursor-pointer overflow-hidden relative`;
    cell.addEventListener('click', () => { triggerHaptic(); openDayModal(dateStr); });
    
    let dateNumColor = isToday ? 'bg-warm-500 text-white shadow-sm' : (isRedDay ? 'text-rose-600 font-extrabold' : 'text-gray-600');
    const weatherInfo = weatherData[dateStr] ? `<span class="text-[8px] text-blue-500 font-bold bg-blue-50 px-1 rounded-full">${weatherData[dateStr]}</span>` : '';
    
    const header = document.createElement('div');
    header.className = 'flex justify-between items-center px-0.5 shrink-0';
    header.innerHTML = `<div class="flex items-center gap-1"><span class="text-xs md:text-sm font-bold w-5 h-5 md:w-6 md:h-6 flex items-center justify-center rounded-full ${dateNumColor}">${dayNum}</span>${weatherInfo}</div><span class="text-[9px] md:text-[10px] text-gray-400 font-medium">${lunarStr}</span>`;
    cell.appendChild(header);

    const eventsContainer = document.createElement('div');
    eventsContainer.className = 'flex flex-col gap-0.5 overflow-y-auto hide-scrollbar flex-1';
    
    dayEvents.forEach(evt => {
        const matchSearch = !searchQuery || evt.title.toLowerCase().includes(searchQuery) || evt.author.toLowerCase().includes(searchQuery) || evt.description.toLowerCase().includes(searchQuery);
        const opacityClass = (searchQuery && !matchSearch) ? 'opacity-25 grayscale' : '';
        const authorTagHtml = (evt.author && evt.author !== '政府行事曆') ? `<span class="text-[7px] md:text-[8px] bg-black/20 px-1 rounded shrink-0 self-end md:self-auto">${evt.author}</span>` : '';
        const totalExp = getTotalExpense(evt);
        const expenseBadge = evt.isExpense && totalExp > 0 ? ` <i class="fas fa-receipt text-[9px] opacity-90"></i>` : '';
        const photoBadge = evt.photoUrl ? ` <i class="fas fa-image text-[9px] opacity-90"></i>` : '';
        const pollBadge = evt.isPoll ? ` <i class="fas fa-poll text-[9px] opacity-90"></i>` : '';
        const checkBadge = evt.isChecklist && evt.checklist && evt.checklist.length > 0 ? ` <i class="fas fa-clipboard-check text-[9px] opacity-90"></i>` : '';

        const evtEl = document.createElement('div');
        evtEl.className = `${evt.color} text-white text-[9px] md:text-[11px] font-bold px-1 py-0.5 rounded shadow-sm cursor-pointer hover:brightness-110 active:scale-95 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-1 ${opacityClass}`;
        evtEl.innerHTML = `<span class="truncate w-full">${evt.time ? `<span class="opacity-75 font-normal text-[8px] mr-0.5">${evt.time}</span>` : ''}${evt.icon ? evt.icon+' ' : ''}${evt.title}${expenseBadge}${photoBadge}${pollBadge}${checkBadge}</span>${authorTagHtml}`;
        evtEl.addEventListener('click', (e) => { e.stopPropagation(); triggerHaptic(); openViewModal(evt.id); });
        eventsContainer.appendChild(evtEl);
    });
    
    cell.appendChild(eventsContainer);
    return cell;
}

function openDayModal(dateStr, setGlobal = true) {
    if (setGlobal) selectedDateForModal = dateStr;
    const dParts = dateStr.split('-');
    let lunarSubtitle = '';
    try { lunarSubtitle = `（農曆 ${Solar.fromYmd(parseInt(dParts[0]), parseInt(dParts[1]), parseInt(dParts[2])).getLunar().getMonthInChinese()}月${Solar.fromYmd(parseInt(dParts[0]), parseInt(dParts[1]), parseInt(dParts[2])).getLunar().getDayInChinese()}）`; } catch(e) {}
    document.getElementById('day-modal-title').innerText = `${dParts[0]}年 ${parseInt(dParts[1])}月 ${parseInt(dParts[2])}日 ${lunarSubtitle}`;
    
    const dayEvents = events.filter(e => dateStr >= e.startDate && dateStr <= e.endDate).sort((a, b) => (a.time || '24:00').localeCompare(b.time || '24:00'));
    const listContainer = document.getElementById('day-modal-list');
    listContainer.innerHTML = '';
    
    if (dayEvents.length === 0) {
        listContainer.innerHTML = `<div class="text-center py-6 text-gray-400"><i class="far fa-calendar-times text-3xl mb-2 opacity-50"></i><p class="text-sm">這一天沒有安排行程喔！</p></div>`;
    } else {
        dayEvents.forEach(evt => {
            const item = document.createElement('div');
            item.className = 'p-3 rounded-2xl border border-warm-100 bg-warm-50/50 hover:bg-warm-50 transition-all cursor-pointer flex items-center justify-between gap-3';
            item.addEventListener('click', () => { triggerHaptic(); closeDayModal(); openViewModal(evt.id); });
            const totalExp = getTotalExpense(evt);
            const expenseText = evt.isExpense && totalExp > 0 ? ` <span class="text-amber-600 font-bold">($${totalExp})</span>` : '';
            const pollIcon = evt.isPoll ? ` <i class="fas fa-poll text-indigo-500"></i>` : '';
            const checkIcon = evt.isChecklist ? ` <i class="fas fa-clipboard-check text-emerald-500"></i>` : '';
            item.innerHTML = `<div class="flex items-center gap-3 min-w-0"><div class="w-3 h-3 rounded-full ${evt.color} shrink-0"></div><div class="min-w-0"><h4 class="font-bold text-gray-800 text-sm break-words">${evt.icon ? evt.icon+' ' : ''}${evt.title}${expenseText}${pollIcon}${checkIcon}</h4><p class="text-xs text-gray-400 flex items-center gap-2 mt-0.5"><span><i class="far fa-clock"></i> ${evt.time || '全天'}</span><span><i class="far fa-user"></i> ${evt.author === '政府行事曆' ? '國定假日' : evt.author}</span></p></div></div><i class="fas fa-chevron-right text-gray-300 text-xs"></i>`;
            listContainer.appendChild(item);
        });
    }
    document.getElementById('day-modal').classList.remove('hidden');
}

function closeDayModal() { document.getElementById('day-modal').classList.add('hidden'); selectedDateForModal = null; }

function renderUpcoming() {
    const container = document.getElementById('upcoming-events');
    const emptyState = document.getElementById('no-upcoming');
    container.innerHTML = '';
    const todayObj = new Date();
    todayObj.setHours(0, 0, 0, 0);
    const todayStr = formatDateStr(todayObj);

    const upcoming = events.filter(e => e.endDate >= todayStr && (!searchQuery || e.title.toLowerCase().includes(searchQuery) || e.author.toLowerCase().includes(searchQuery) || e.description.toLowerCase().includes(searchQuery))).sort((a, b) => a.startDate.localeCompare(b.startDate)).slice(0, 5);
    
    if (upcoming.length === 0) emptyState.classList.remove('hidden');
    else {
        emptyState.classList.add('hidden');
        upcoming.forEach(evt => {
            const el = document.createElement('div');
            el.className = 'bg-white p-3 rounded-2xl border border-warm-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer flex items-center gap-3.5 group';
            el.addEventListener('click', () => { triggerHaptic(); openViewModal(evt.id); });
            
            const [sY, sM, sD] = evt.startDate.split('-').map(Number);
            const startObj = new Date(sY, sM - 1, sD);
            const diffDays = Math.round((startObj - todayObj) / (1000 * 60 * 60 * 24));
            
            let countdownHtml = '';
            if (diffDays <= 0) {
                countdownHtml = `<span class="px-2 py-0.5 bg-rose-500 text-white rounded-full text-[10px] font-extrabold shadow-sm animate-pulse shrink-0">🎉 今天</span>`;
            } else if (diffDays === 1) {
                countdownHtml = `<span class="px-2 py-0.5 bg-orange-500 text-white rounded-full text-[10px] font-bold shadow-sm shrink-0">🔥 明天</span>`;
            } else if (diffDays <= 7) {
                countdownHtml = `<span class="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-[10px] font-bold shrink-0">⏳ 倒數 ${diffDays} 天</span>`;
            } else {
                countdownHtml = `<span class="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-[10px] font-bold shrink-0">還有 ${diffDays} 天</span>`;
            }

            const totalExp = getTotalExpense(evt);
            const expenseBadge = evt.isExpense && totalExp > 0 ? ` <span class="text-xs text-amber-600 font-bold">($${totalExp})</span>` : '';
            
            el.innerHTML = `
                <div class="${evt.color} text-white rounded-xl w-12 h-12 flex flex-col items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                    <span class="text-xs font-medium opacity-90">${sM}月</span>
                    <span class="text-lg font-bold leading-none">${sD}</span>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between gap-1">
                        <h4 class="font-bold text-gray-800 truncate">${evt.icon ? evt.icon+' ' : ''}${evt.title}${expenseBadge}</h4>
                        ${countdownHtml}
                    </div>
                    <div class="text-xs text-gray-400 mt-1 flex items-center gap-2 flex-wrap">
                        <span><i class="far fa-calendar-alt"></i> ${evt.startDate === evt.endDate ? evt.startDate : evt.startDate + ' ~ ' + evt.endDate}</span>
                        ${evt.author && evt.author !== '政府行事曆' ? `<span><i class="far fa-user"></i> ${evt.author}</span>` : ''}
                    </div>
                </div>
            `;
            container.appendChild(el);
        });
    }
}

document.getElementById('btn-prev-month').addEventListener('click', () => { triggerHaptic(); currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(); });
document.getElementById('btn-next-month').addEventListener('click', () => { triggerHaptic(); currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(); });
document.getElementById('btn-today').addEventListener('click', () => { triggerHaptic(); currentDate = new Date(); renderCalendar(); });
document.getElementById('btn-open-add').addEventListener('click', () => { triggerHaptic(); openModal(); });
document.getElementById('btn-close-modal').addEventListener('click', () => { triggerHaptic(); closeModal(); });
document.getElementById('btn-cancel-modal').addEventListener('click', () => { triggerHaptic(); closeModal(); });
document.getElementById('btn-close-day-modal').addEventListener('click', () => { triggerHaptic(); closeDayModal(); });
document.getElementById('btn-add-from-day').addEventListener('click', () => { triggerHaptic(); const dateToPass = selectedDateForModal; closeDayModal(); openModal(null, dateToPass); });
document.getElementById('btn-close-view').addEventListener('click', () => { triggerHaptic(); closeViewModal(); });
document.getElementById('btn-edit-from-view').addEventListener('click', () => { triggerHaptic(); const id = currentViewingId; closeViewModal(); setTimeout(() => openModal(id), 100); });
document.getElementById('btn-copy-from-view').addEventListener('click', () => { triggerHaptic(); const id = currentViewingId; closeViewModal(); setTimeout(() => copyEventToModal(id), 100); });

function openModal(eventId = null, defaultDate = null) {
    document.getElementById('event-form').reset();
    expenseFields.classList.add('hidden');
    payersContainer.innerHTML = '';
    sharersContainer.innerHTML = '';
    pollFields.classList.add('hidden');
    pollOptionsContainer.innerHTML = '';
    checklistFields.classList.add('hidden');
    checklistContainer.innerHTML = '';
    
    photoUrlInput.value = '';
    previewImg.src = '';
    photoPreview.classList.add('hidden');

    currentEditingId = eventId;
    if (eventId) {
        document.getElementById('modal-title').innerText = '編輯活動';
        document.getElementById('btn-delete').classList.remove('hidden');
        const evt = events.find(e => e.id === eventId);
        if (evt) {
            document.getElementById('event-title').value = evt.title;
            document.getElementById('event-icon').value = evt.icon || '';
            document.getElementById('event-start-date').value = evt.startDate;
            document.getElementById('event-end-date').value = evt.endDate || evt.startDate;
            document.getElementById('event-time').value = evt.time || '';
            document.getElementById('event-author').value = evt.author === '政府行事曆' ? '' : (evt.author || '');
            document.getElementById('event-desc').value = evt.description || '';
            document.getElementById('event-is-nav').checked = evt.isNav || false;
            document.querySelector(`input[name="event-color"][value="${evt.color}"]`).checked = true;

            if (evt.photoUrl) {
                photoUrlInput.value = evt.photoUrl;
                previewImg.src = evt.photoUrl;
                photoPreview.classList.remove('hidden');
            }

            if (evt.isChecklist && evt.checklist && evt.checklist.length > 0) {
                checklistCheckbox.checked = true;
                checklistFields.classList.remove('hidden');
                evt.checklist.forEach(item => addChecklistRow(item.text, item.assignee || '', item.done || false));
            } else { checklistCheckbox.checked = false; }

            if (evt.isPoll && evt.pollOptions && evt.pollOptions.length > 0) {
                pollCheckbox.checked = true;
                pollFields.classList.remove('hidden');
                evt.pollOptions.forEach(opt => addPollOptionRow(opt.title));
            } else { pollCheckbox.checked = false; }

            if (evt.isExpense && evt.payers && evt.payers.length > 0) {
                expenseCheckbox.checked = true;
                expenseFields.classList.remove('hidden');
                evt.payers.forEach(p => addPayerRow(p.name, p.amount));
                document.getElementById('expense-splits').value = evt.expenseSplits || 4;
                if (evt.sharers && evt.sharers.length > 0) {
                    evt.sharers.forEach(s => addSharerRow(s.name, s.weight));
                }
            } else { expenseCheckbox.checked = false; }
        }
    } else {
        document.getElementById('modal-title').innerText = '新增活動';
        document.getElementById('btn-delete').classList.add('hidden');
        expenseCheckbox.checked = false;
        pollCheckbox.checked = false;
        checklistCheckbox.checked = false;
        document.getElementById('event-author').value = '';
        document.getElementById('event-start-date').value = defaultDate || formatDateStr(new Date());
        document.getElementById('event-end-date').value = defaultDate || formatDateStr(new Date());
        document.getElementById('event-is-nav').checked = false;
    }
    document.getElementById('event-modal').classList.remove('hidden');
}

function copyEventToModal(eventId) {
    openModal(eventId);
    currentEditingId = null;
    document.getElementById('modal-title').innerText = '複製並新增活動';
    document.getElementById('btn-delete').classList.add('hidden');
}

function closeModal() { document.getElementById('event-modal').classList.add('hidden'); currentEditingId = null; }

function openViewModal(eventId) {
    const evt = events.find(e => e.id === eventId);
    if(!evt) return;
    currentViewingId = eventId;
    document.getElementById('view-modal-header').className = `h-20 w-full ${evt.color}`;
    document.getElementById('view-title').innerText = (evt.icon ? evt.icon + ' ' : '') + evt.title;
    document.getElementById('view-date').innerText = evt.startDate === evt.endDate ? evt.startDate : `${evt.startDate} ~ ${evt.endDate}`;
    document.getElementById('view-author').innerText = `建立者：${evt.author === '政府行事曆' ? '國定假日' : (evt.author || '未署名')}`;
    
    const viewPhotoContainer = document.getElementById('view-photo-container');
    const viewPhoto = document.getElementById('view-photo');
    if (evt.photoUrl) {
        viewPhoto.src = evt.photoUrl;
        viewPhotoContainer.classList.remove('hidden');
    } else {
        viewPhotoContainer.classList.add('hidden');
        viewPhoto.src = '';
    }

    if (evt.time) { document.getElementById('view-time').innerText = evt.time; document.getElementById('view-time-container').classList.remove('hidden'); } 
    else { document.getElementById('view-time-container').classList.add('hidden'); }
    
    if (evt.description) { document.getElementById('view-desc').innerText = evt.description; document.getElementById('view-desc-container').classList.remove('hidden'); } 
    else { document.getElementById('view-desc-container').classList.add('hidden'); }

    const checkContainer = document.getElementById('view-checklist-container');
    const checkItemsEl = document.getElementById('view-checklist-items');
    const checkProgressEl = document.getElementById('view-checklist-progress');
    if (evt.isChecklist && evt.checklist && evt.checklist.length > 0) {
        checkItemsEl.innerHTML = '';
        const doneCount = evt.checklist.filter(i => i.done).length;
        checkProgressEl.innerText = `已完成 ${doneCount}/${evt.checklist.length}`;

        evt.checklist.forEach((item, idx) => {
            const row = document.createElement('div');
            row.className = `p-2 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition-all ${item.done ? 'bg-emerald-100/50 border-emerald-200 text-gray-400 line-through' : 'bg-white border-emerald-100 text-gray-700 shadow-sm'}`;
            row.innerHTML = `
                <div class="flex items-center gap-2 min-w-0">
                    <input type="checkbox" ${item.done ? 'checked' : ''} class="w-4 h-4 text-emerald-500 rounded pointer-events-none shrink-0">
                    <span class="font-bold truncate">${item.text}</span>
                </div>
                ${item.assignee ? `<span class="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-lg text-[10px] font-bold shrink-0"><i class="far fa-user mr-0.5"></i>${item.assignee}</span>` : ''}
            `;
            row.addEventListener('click', async () => {
                triggerHaptic();
                let updatedList = evt.checklist.map(c => ({...c}));
                updatedList[idx].done = !updatedList[idx].done;
                try { await updateDoc(doc(eventsRef, evt.id), { checklist: updatedList }); }
                catch(e) { console.error("Checklist update failed", e); }
            });
            checkItemsEl.appendChild(row);
        });
        checkContainer.classList.remove('hidden');
    } else {
        checkContainer.classList.add('hidden');
    }

    const pollContainer = document.getElementById('view-poll-container');
    const pollOptionsEl = document.getElementById('view-poll-options');
    const voterSelect = document.getElementById('poll-voter-select');

    if (evt.isPoll && evt.pollOptions && evt.pollOptions.length > 0) {
        pollOptionsEl.innerHTML = '';
        const currentVoter = voterSelect ? voterSelect.value : '';

        evt.pollOptions.forEach((opt, idx) => {
            const row = document.createElement('div');
            row.className = 'bg-white p-3 rounded-xl border border-indigo-100 flex flex-col gap-1.5 shadow-sm';
            
            const hasVoted = currentVoter ? (opt.voters && opt.voters.includes(currentVoter)) : false;
            const btnClass = hasVoted ? 'bg-indigo-500 text-white shadow-md' : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-600';
            
            row.innerHTML = `
                <div class="flex justify-between items-center">
                    <span class="font-bold text-gray-700 text-sm">${opt.title}</span>
                    <button class="btn-vote ${btnClass} px-4 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5">
                        <i class="fas fa-thumbs-up"></i> 投一票 (${opt.voters ? opt.voters.length : 0})
                    </button>
                </div>
            `;
            
            row.querySelector('.btn-vote').addEventListener('click', async () => {
                triggerHaptic();
                const voterName = document.getElementById('poll-voter-select').value;
                if (!voterName) return alert('請先在上方選擇「目前投票人」是哪位成員喔！');
                
                let updatedOptions = evt.pollOptions.map(o => ({...o, voters: [...(o.voters || [])]}));
                const isCurrentlyVoted = updatedOptions[idx].voters.includes(voterName);
                
                updatedOptions.forEach(o => { o.voters = o.voters.filter(name => name !== voterName); });
                if (!isCurrentlyVoted) updatedOptions[idx].voters.push(voterName);
                
                try { await updateDoc(doc(eventsRef, evt.id), { pollOptions: updatedOptions }); } 
                catch(e) { console.error("Vote failed", e); }
            });
            pollOptionsEl.appendChild(row);
        });
        if (voterSelect) voterSelect.onchange = () => openViewModal(eventId);
        pollContainer.classList.remove('hidden');
    } else { pollContainer.classList.add('hidden'); }

    const expenseContainer = document.getElementById('view-expense-container');
    const totalExp = getTotalExpense(evt);
    if (evt.isExpense && totalExp > 0) {
        const payersHtml = evt.payers.map(p => `• ${p.name} 先墊：$${p.amount}`).join('<br>');
        
        if (evt.sharers && evt.sharers.length > 0) {
            const totalWeight = evt.sharers.reduce((sum, s) => sum + (parseFloat(s.weight) || 0), 0);
            const perUnit = totalWeight > 0 ? (totalExp / totalWeight) : 0;

            const paidMap = {};
            evt.payers.forEach(p => { paidMap[p.name] = (paidMap[p.name] || 0) + (parseFloat(p.amount) || 0); });

            const sharersHtml = evt.sharers.map(s => {
                const shouldPay = Math.round(perUnit * s.weight);
                const alreadyPaid = paidMap[s.name] || 0;
                const diff = alreadyPaid - shouldPay;
                let statusBadge = '';
                if (diff > 0) statusBadge = `<span class="text-emerald-700 font-bold">(應收回 $${diff})</span>`;
                else if (diff < 0) statusBadge = `<span class="text-rose-600 font-bold">(需補繳 $${Math.abs(diff)})</span>`;
                else statusBadge = `<span class="text-gray-400">(已結清)</span>`;

                return `• ${s.name} (${s.weight}份)：應分攤 $${shouldPay} ${statusBadge}`;
            }).join('<br>');

            document.getElementById('view-expense-details').innerHTML = `
                <div>💰 <strong>總花費：$${totalExp} 元</strong>（共 ${totalWeight} 份，每份 $${Math.round(perUnit)}）</div>
                <div class="pt-1.5 border-t border-amber-200 text-[11px] text-amber-800">
                    <strong>先墊明細：</strong><br>${payersHtml}
                </div>
                <div class="pt-1.5 border-t border-amber-200 text-[11px] text-amber-900">
                    <strong>各成員權重分攤與結算：</strong><br>${sharersHtml}
                </div>
            `;
        } else {
            const splits = evt.expenseSplits || 4;
            document.getElementById('view-expense-details').innerHTML = `
                <div>💰 <strong>總花費：$${totalExp} 元</strong>（共 ${splits} 人均分，每人應付 $${Math.round((totalExp / splits) * 10) / 10}）</div>
                <div class="pt-1 border-t border-amber-200 text-[11px] text-amber-800">
                    <strong>代墊明細：</strong><br>${payersHtml}
                </div>
            `;
        }
        expenseContainer.classList.remove('hidden');
    } else expenseContainer.classList.add('hidden');

    if (evt.description && evt.isNav) {
        document.getElementById('map-nav-link').href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(evt.description)}`;
        document.getElementById('map-btn-container').classList.remove('hidden');
    } else document.getElementById('map-btn-container').classList.add('hidden');
    
    document.getElementById('view-modal').classList.add('hidden');
    document.getElementById('view-modal').classList.remove('hidden');
}

function closeViewModal() { document.getElementById('view-modal').classList.add('hidden'); currentViewingId = null; }

document.getElementById('event-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    triggerHaptic();

    const authorInput = document.getElementById('event-author').value.trim();
    if (authorInput !== '' && authorInput !== '政府行事曆') {
        const isAuthorExist = familyMembers.some(m => m.name === authorInput);
        if (!isAuthorExist) return alert(`【建立者驗證失敗】\n「${authorInput}」不在名冊內！請從選單挑選，或先在側邊欄「管理成員」新增。`);
    }

    const isChecklist = checklistCheckbox.checked;
    let checklistData = [];
    if (isChecklist) {
        let checkError = false;
        document.querySelectorAll('.checklist-row').forEach(row => {
            const text = row.querySelector('.checklist-text').value.trim();
            const assignee = row.querySelector('.checklist-assignee').value.trim();
            const done = row.dataset.done === 'true';
            if (text) {
                if (assignee && !familyMembers.some(m => m.name === assignee)) {
                    alert(`【任務認領人驗證失敗】\n「${assignee}」不在成員名冊內！`);
                    checkError = true;
                } else {
                    checklistData.push({ text, assignee, done });
                }
            }
        });
        if (checkError) return;
    }

    const isExpense = expenseCheckbox.checked;
    let payersList = [];
    let sharersList = [];
    if (isExpense) {
        let payerError = false;
        document.querySelectorAll('.payer-row').forEach(row => {
            const name = row.querySelector('.payer-name').value.trim();
            const amount = parseFloat(row.querySelector('.payer-amount').value) || 0;
            if (name || amount > 0) {
                if (!familyMembers.some(m => m.name === name)) {
                    alert(`【墊付人驗證失敗】\n「${name}」不在名冊內！`);
                    payerError = true;
                } else { payersList.push({ name, amount }); }
            }
        });
        if (payerError) return;

        let sharerError = false;
        document.querySelectorAll('.sharer-row').forEach(row => {
            const name = row.querySelector('.sharer-name').value.trim();
            const weight = parseFloat(row.querySelector('.sharer-weight').value) || 0;
            if (name && weight > 0) {
                if (!familyMembers.some(m => m.name === name)) {
                    alert(`【分攤成員驗證失敗】\n「${name}」不在名冊內！`);
                    sharerError = true;
                } else { sharersList.push({ name, weight }); }
            }
        });
        if (sharerError) return;
    }

    const isPoll = pollCheckbox.checked;
    let pollOptionsList = [];
    if (isPoll) {
        const existingEvt = events.find(ev => ev.id === currentEditingId);
        document.querySelectorAll('.poll-row').forEach((row, idx) => {
            const title = row.querySelector('.poll-option-title').value.trim();
            if (title) {
                let voters = [];
                if (existingEvt && existingEvt.pollOptions && existingEvt.pollOptions[idx] && existingEvt.pollOptions[idx].title === title) {
                    voters = existingEvt.pollOptions[idx].voters;
                }
                pollOptionsList.push({ title, voters });
            }
        });
    }

    const submitBtn = document.getElementById('btn-save-event');
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 儲存中...';
    submitBtn.disabled = true;

    try {
        const finalPhotoUrl = photoUrlInput.value.trim();

        const eventData = {
            title: document.getElementById('event-title').value.trim(),
            icon: document.getElementById('event-icon').value,
            startDate: document.getElementById('event-start-date').value,
            endDate: document.getElementById('event-end-date').value < document.getElementById('event-start-date').value ? document.getElementById('event-start-date').value : (document.getElementById('event-end-date').value || document.getElementById('event-start-date').value),
            time: document.getElementById('event-time').value,
            author: authorInput,
            description: document.getElementById('event-desc').value.trim(),
            isNav: document.getElementById('event-is-nav').checked,
            color: document.querySelector('input[name="event-color"]:checked').value,
            isExpense: isExpense && payersList.length > 0,
            payers: payersList,
            expenseSplits: isExpense ? parseInt(document.getElementById('expense-splits').value) || 4 : 4,
            sharers: isExpense ? sharersList : [],
            isPoll: isPoll && pollOptionsList.length > 0,
            pollOptions: pollOptionsList,
            isChecklist: isChecklist && checklistData.length > 0,
            checklist: checklistData,
            photoUrl: finalPhotoUrl
        };
        
        if (currentEditingId) await updateDoc(doc(eventsRef, currentEditingId), eventData);
        else await addDoc(eventsRef, eventData);
        
        closeModal();
    } catch (error) { 
        console.error("Error saving: ", error); 
    } finally {
        submitBtn.innerHTML = originalBtnText;
        submitBtn.disabled = false;
    }
});

document.getElementById('btn-delete').addEventListener('click', async () => {
    if (!currentEditingId) return;
    triggerHaptic();
    try { await deleteDoc(doc(eventsRef, currentEditingId)); closeModal(); } 
    catch (error) { console.error("Error deleting: ", error); }
});

renderApp();