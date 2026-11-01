import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, setDoc, onSnapshot, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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

// 🌟 啟動 Firestore 離線持續性支援 (Offline Persistence)
enableIndexedDbPersistence(db).catch((err) => {
    if (err.code == 'failed-precondition') {
        console.warn('多個分頁同時開啟，離線持續性僅能在一個分頁生效。');
    } else if (err.code == 'unimplemented') {
        console.warn('此瀏覽器不支援離線持續性功能。');
    }
});

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

function triggerHaptic() {
    if (window.navigator && window.navigator.vibrate) window.navigator.vibrate(10);
}

/* ================== 手機版側邊欄抽屜控制 ================== */
const sidebar = document.getElementById('sidebar');
const sidebarBackdrop = document.getElementById('sidebar-backdrop');

function toggleSidebar() {
    triggerHaptic();
    const isOpen = !sidebar.classList.contains('-translate-x-full');
    if (isOpen) {
        sidebar.classList.add('-translate-x-full');
        sidebarBackdrop.classList.add('hidden');
    } else {
        sidebar.classList.remove('-translate-x-full');
        sidebarBackdrop.classList.remove('hidden');
    }
}

document.getElementById('btn-toggle-sidebar').addEventListener('click', toggleSidebar);
document.getElementById('btn-close-sidebar').addEventListener('click', toggleSidebar);
sidebarBackdrop.addEventListener('click', toggleSidebar);

/* ================== 主題風格切換管理 ================== */
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
    let currentVoter = voterSelect ? voterSelect.value : '';
    if (voterSelect) voterSelect.innerHTML = '<option value="" disabled selected>請點此選擇您是哪位成員...</option>';

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
    if (voterSelect && familyMembers.some(m => m.name === currentVoter)) voterSelect.value = currentVoter;
}

function renderMemberManageList() {
    const container = document.getElementById('member-list-container');
    if(!container) return;
    container.innerHTML = '';
    if(familyMembers.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-400 text-sm py-6">目前尚未建立任何成員</p>';
        return;
    }
    familyMembers.forEach(m => {
        const item = document.createElement('div');
        item.className = 'flex justify-between items-center bg-white p-3 rounded-xl border border-warm-100 shadow-sm';
        item.innerHTML = `<span class="font-bold text-gray-700 text-sm">${m.name}</span><button class="btn-delete-member text-rose-400 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg"><i class="fas fa-trash-alt"></i></button>`;
        item.querySelector('.btn-delete-member').addEventListener('click', async () => {
            triggerHaptic();
            if (confirm(`確定要刪除成員「${m.name}」嗎？`)) await deleteDoc(doc(db, 'familyMembers', m.id));
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

/* ================== 相片牆與附件預覽 ================== */
const photoUrlInput = document.getElementById('event-photo-url');
const photoPreview = document.getElementById('photo-preview');
const previewImg = photoPreview.querySelector('img');

photoUrlInput.addEventListener('input', (e) => {
    const url = e.target.value.trim();
    if (url) { previewImg.src = url; photoPreview.classList.remove('hidden'); }
    else { previewImg.src = ''; photoPreview.classList.add('hidden'); }
});
document.getElementById('btn-remove-photo').addEventListener('click', () => {
    triggerHaptic();
    photoUrlInput.value = ''; previewImg.src = ''; photoPreview.classList.add('hidden');
});

const galleryModal = document.getElementById('gallery-modal');
document.getElementById('btn-open-gallery').addEventListener('click', () => { triggerHaptic(); renderGalleryGrid(); galleryModal.classList.remove('hidden'); });
document.getElementById('btn-close-gallery').addEventListener('click', () => { triggerHaptic(); galleryModal.classList.add('hidden'); });

function renderGalleryGrid() {
    const container = document.getElementById('gallery-grid-container');
    container.innerHTML = '';
    const photoEvents = events.filter(e => e.photoUrl && e.photoUrl.trim() !== '').sort((a, b) => b.startDate.localeCompare(a.startDate));
    if (photoEvents.length === 0) {
        container.innerHTML = `<div class="col-span-full text-center py-16 text-gray-400"><i class="far fa-images text-4xl mb-3 opacity-50"></i><p class="text-sm">目前還沒有任何相片記錄喔！</p></div>`;
        return;
    }
    photoEvents.forEach(evt => {
        const item = document.createElement('div');
        item.className = 'bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 cursor-pointer flex flex-col group';
        item.innerHTML = `<div class="aspect-square w-full overflow-hidden bg-gray-100 relative"><img src="${evt.photoUrl}" class="w-full h-full object-cover group-hover:scale-105 transition-transform"><div class="absolute top-2 left-2 bg-black/50 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full">${evt.startDate}</div></div><div class="p-3"><h4 class="font-bold text-gray-800 text-xs truncate">${evt.icon ? evt.icon+' ' : ''}${evt.title}</h4></div>`;
        item.addEventListener('click', () => { triggerHaptic(); galleryModal.classList.add('hidden'); openViewModal(evt.id); });
        container.appendChild(item);
    });
}

/* ================== 任務、投票與分帳區塊邏輯 ================== */
const checklistCheckbox = document.getElementById('event-is-checklist');
const checklistFields = document.getElementById('checklist-fields');
const checklistContainer = document.getElementById('checklist-items-container');
checklistCheckbox.addEventListener('change', (e) => {
    if (e.target.checked) { checklistFields.classList.remove('hidden'); if (checklistContainer.children.length === 0) addChecklistRow(); }
    else checklistFields.classList.add('hidden');
});
function addChecklistRow(text = '', assignee = '', done = false) {
    const row = document.createElement('div');
    row.className = 'flex items-center gap-2 checklist-row';
    row.dataset.done = done ? 'true' : 'false';
    row.innerHTML = `<input type="text" placeholder="任務/物品" value="${text}" class="checklist-text flex-1 px-3 py-1.5 bg-white border rounded-xl text-xs outline-none" required><input type="text" list="member-list" placeholder="認領人" value="${assignee}" class="checklist-assignee w-28 px-2 py-1.5 bg-white border rounded-xl text-xs outline-none"><button type="button" class="btn-remove-check text-rose-400 p-1"><i class="fas fa-trash-alt"></i></button>`;
    row.querySelector('.btn-remove-check').addEventListener('click', () => row.remove());
    checklistContainer.appendChild(row);
}
document.getElementById('btn-add-checklist-item').addEventListener('click', () => { triggerHaptic(); addChecklistRow(); });

const pollCheckbox = document.getElementById('event-is-poll');
const pollFields = document.getElementById('poll-fields');
const pollOptionsContainer = document.getElementById('poll-options-container');
pollCheckbox.addEventListener('change', (e) => {
    if (e.target.checked) { pollFields.classList.remove('hidden'); if (pollOptionsContainer.children.length === 0) addPollOptionRow(); }
    else pollFields.classList.add('hidden');
});
function addPollOptionRow(title = '') {
    const row = document.createElement('div');
    row.className = 'flex items-center gap-2 poll-row';
    row.innerHTML = `<input type="text" placeholder="選項標題" value="${title}" class="poll-option-title flex-1 px-3 py-1.5 bg-white border rounded-xl text-xs outline-none" required><button type="button" class="btn-remove-poll text-rose-400 p-1"><i class="fas fa-trash-alt"></i></button>`;
    row.querySelector('.btn-remove-poll').addEventListener('click', () => row.remove());
    pollOptionsContainer.appendChild(row);
}
document.getElementById('btn-add-poll-option').addEventListener('click', () => { triggerHaptic(); addPollOptionRow(); });

const expenseCheckbox = document.getElementById('event-is-expense');
const expenseFields = document.getElementById('expense-fields');
const payersContainer = document.getElementById('payers-container');
const sharersContainer = document.getElementById('sharers-container');
expenseCheckbox.addEventListener('change', (e) => {
    if (e.target.checked) { expenseFields.classList.remove('hidden'); if (payersContainer.children.length === 0) addPayerRow(); }
    else expenseFields.classList.add('hidden');
});
function addPayerRow(name = '', amount = '') {
    const row = document.createElement('div');
    row.className = 'flex items-center gap-2 payer-row';
    row.innerHTML = `<input type="text" list="member-list" placeholder="墊付人" value="${name}" class="payer-name w-1/3 px-3 py-1.5 bg-white border rounded-xl text-xs outline-none" required><input type="number" placeholder="金額 $" value="${amount}" class="payer-amount flex-1 px-3 py-1.5 bg-white border rounded-xl text-xs outline-none" required><button type="button" class="btn-remove-payer text-rose-400 p-1"><i class="fas fa-trash-alt"></i></button>`;
    row.querySelector('.btn-remove-payer').addEventListener('click', () => row.remove());
    payersContainer.appendChild(row);
}
document.getElementById('btn-add-payer').addEventListener('click', () => { triggerHaptic(); addPayerRow(); });
function addSharerRow(name = '', weight = 1) {
    const row = document.createElement('div');
    row.className = 'flex items-center gap-2 sharer-row';
    row.innerHTML = `<input type="text" list="member-list" placeholder="分攤成員" value="${name}" class="sharer-name flex-1 px-3 py-1.5 bg-white border rounded-xl text-xs outline-none" required><div class="flex items-center bg-white border rounded-xl px-2 py-1"><input type="number" min="0.5" step="0.5" value="${weight}" class="sharer-weight w-12 text-center text-xs font-bold outline-none"><span class="text-[10px]">份</span></div><button type="button" class="btn-remove-sharer text-rose-400 p-1"><i class="fas fa-trash-alt"></i></button>`;
    row.querySelector('.btn-remove-sharer').addEventListener('click', () => row.remove());
    sharersContainer.appendChild(row);
}
document.getElementById('btn-add-sharer').addEventListener('click', () => { triggerHaptic(); addSharerRow('', 1); });

/* ================== 行事曆核心與農曆重複轉換 ================== */
onSnapshot(eventsRef, (snapshot) => {
    events = [];
    snapshot.forEach((doc) => {
        const data = doc.data();
        let actualStartDate = data.startDate;
        let actualEndDate = data.endDate || data.startDate;

        // 🌟 每年農曆生日/節日自動重複推算邏輯
        if (data.isLunarRecurring && data.lunarMonth && data.lunarDay) {
            const currentYear = currentDate.getFullYear();
            try {
                const solarObj = Lunar.fromYmd(currentYear, data.lunarMonth, data.lunarDay).getSolar();
                actualStartDate = `${solarObj.getYear()}-${String(solarObj.getMonth()).padStart(2, '0')}-${String(solarObj.getDay()).padStart(2, '0')}`;
                actualEndDate = actualStartDate;
            } catch(e) {}
        }

        events.push({ 
            id: doc.id, title: data.title, icon: data.icon || '', startDate: actualStartDate, endDate: actualEndDate, 
            originalStart: data.startDate, isLunarRecurring: data.isLunarRecurring || false, lunarMonth: data.lunarMonth || null, lunarDay: data.lunarDay || null,
            time: data.time || '', author: data.author || '', description: data.description || '', isNav: data.isNav || false, color: data.color || 'bg-rose-400', 
            isExpense: data.isExpense || false, payers: data.payers || [], expenseSplits: data.expenseSplits || 4, sharers: data.sharers || [],
            photoUrl: data.photoUrl || null, fileUrl: data.fileUrl || null,
            isPoll: data.isPoll || false, pollOptions: data.pollOptions || [],
            isChecklist: data.isChecklist || false, checklist: data.checklist || []
        });
    });
    renderApp();
    if (selectedDateForModal) openDayModal(selectedDateForModal, false);
    if (currentViewingId) openViewModal(currentViewingId);
});

function formatDateStr(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

document.getElementById('search-input').addEventListener('input', (e) => { searchQuery = e.target.value.trim().toLowerCase(); renderApp(); });

function renderApp() { renderCalendar(); renderUpcoming(); }

function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const monthTitleStr = `${year}年 ${month + 1}月`;
    if (document.getElementById('current-month-year')) document.getElementById('current-month-year').innerText = monthTitleStr;
    if (document.getElementById('mob-month-year')) document.getElementById('mob-month-year').innerText = monthTitleStr;

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

    let cellBgClass = isToday ? 'bg-warm-50 border-warm-300 ring-2 ring-warm-400' : (isRedDay ? 'bg-rose-50/80 border-rose-200' : 'bg-white');

    const cell = document.createElement('div');
    cell.className = `border border-warm-100 rounded-xl p-1 flex flex-col gap-1 transition-all ${cellBgClass} cursor-pointer overflow-hidden relative`;
    cell.addEventListener('click', () => { triggerHaptic(); openDayModal(dateStr); });
    
    let dateNumColor = isToday ? 'bg-warm-500 text-white shadow-sm' : (isRedDay ? 'text-rose-600 font-extrabold' : 'text-gray-600');
    const weatherInfo = weatherData[dateStr] ? `<span class="text-[8px] text-blue-500 font-bold bg-blue-50 px-1 rounded-full">${weatherData[dateStr]}</span>` : '';
    
    cell.innerHTML = `<div class="flex justify-between items-center px-0.5 shrink-0"><div class="flex items-center gap-1"><span class="text-xs md:text-sm font-bold w-5 h-5 md:w-6 md:h-6 flex items-center justify-center rounded-full ${dateNumColor}">${dayNum}</span>${weatherInfo}</div><span class="text-[9px] md:text-[10px] text-gray-400">${lunarStr}</span></div>`;
    
    const eventsContainer = document.createElement('div');
    eventsContainer.className = 'flex flex-col gap-0.5 overflow-y-auto hide-scrollbar flex-1';
    
    dayEvents.forEach(evt => {
        const matchSearch = !searchQuery || evt.title.toLowerCase().includes(searchQuery) || evt.author.toLowerCase().includes(searchQuery);
        const opacityClass = (searchQuery && !matchSearch) ? 'opacity-25 grayscale' : '';
        const evtEl = document.createElement('div');
        evtEl.className = `${evt.color} text-white text-[9px] md:text-[11px] font-bold px-1 py-0.5 rounded shadow-sm cursor-pointer truncate ${opacityClass}`;
        evtEl.innerHTML = `${evt.icon ? evt.icon+' ' : ''}${evt.title}`;
        evtEl.addEventListener('click', (e) => { e.stopPropagation(); triggerHaptic(); openViewModal(evt.id); });
        eventsContainer.appendChild(evtEl);
    });
    cell.appendChild(eventsContainer);
    return cell;
}

function openDayModal(dateStr, setGlobal = true) {
    if (setGlobal) selectedDateForModal = dateStr;
    document.getElementById('day-modal-title').innerText = `${dateStr} 當日行程`;
    const dayEvents = events.filter(e => dateStr >= e.startDate && dateStr <= e.endDate);
    const listContainer = document.getElementById('day-modal-list');
    listContainer.innerHTML = '';
    
    if (dayEvents.length === 0) {
        listContainer.innerHTML = `<div class="text-center py-6 text-gray-400"><p class="text-sm">這一天沒有安排行程喔！</p></div>`;
    } else {
        dayEvents.forEach(evt => {
            const item = document.createElement('div');
            item.className = 'p-3 rounded-2xl border border-warm-100 bg-warm-50/50 cursor-pointer flex items-center justify-between';
            item.addEventListener('click', () => { triggerHaptic(); closeDayModal(); openViewModal(evt.id); });
            item.innerHTML = `<div class="flex items-center gap-3"><div class="w-3 h-3 rounded-full ${evt.color}"></div><h4 class="font-bold text-gray-800 text-sm">${evt.icon ? evt.icon+' ' : ''}${evt.title}</h4></div><i class="fas fa-chevron-right text-xs text-gray-300"></i>`;
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
    const todayStr = formatDateStr(new Date());
    const upcoming = events.filter(e => e.endDate >= todayStr).sort((a, b) => a.startDate.localeCompare(b.startDate)).slice(0, 5);
    
    if (upcoming.length === 0) emptyState.classList.remove('hidden');
    else {
        emptyState.classList.add('hidden');
        upcoming.forEach(evt => {
            const el = document.createElement('div');
            el.className = 'bg-white p-3 rounded-2xl border border-warm-100 shadow-sm cursor-pointer flex items-center gap-3';
            el.addEventListener('click', () => { triggerHaptic(); openViewModal(evt.id); });
            const [sY, sM, sD] = evt.startDate.split('-').map(Number);
            el.innerHTML = `<div class="${evt.color} text-white rounded-xl w-12 h-12 flex flex-col items-center justify-center shrink-0"><span class="text-xs">${sM}月</span><span class="text-lg font-bold">${sD}</span></div><div class="flex-1 truncate"><h4 class="font-bold text-gray-800 truncate">${evt.icon ? evt.icon+' ' : ''}${evt.title}</h4><span class="text-xs text-gray-400">${evt.startDate}</span></div>`;
            container.appendChild(el);
        });
    }
}

document.getElementById('btn-prev-month').addEventListener('click', () => { triggerHaptic(); currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(); });
document.getElementById('btn-next-month').addEventListener('click', () => { triggerHaptic(); currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(); });
document.getElementById('btn-today').addEventListener('click', () => { triggerHaptic(); currentDate = new Date(); renderCalendar(); });
document.getElementById('btn-mob-prev').addEventListener('click', () => { triggerHaptic(); currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(); });
document.getElementById('btn-mob-next').addEventListener('click', () => { triggerHaptic(); currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(); });
document.getElementById('btn-mob-today').addEventListener('click', () => { triggerHaptic(); currentDate = new Date(); renderCalendar(); });

document.getElementById('btn-open-add').addEventListener('click', () => { triggerHaptic(); openModal(); });
document.getElementById('btn-mobile-add').addEventListener('click', () => { triggerHaptic(); openModal(); });
document.getElementById('btn-close-modal').addEventListener('click', () => { triggerHaptic(); closeModal(); });
document.getElementById('btn-cancel-modal').addEventListener('click', () => { triggerHaptic(); closeModal(); });
document.getElementById('btn-close-day-modal').addEventListener('click', () => { triggerHaptic(); closeDayModal(); });
document.getElementById('btn-close-view').addEventListener('click', () => { triggerHaptic(); closeViewModal(); });
document.getElementById('btn-edit-from-view').addEventListener('click', () => { triggerHaptic(); const id = currentViewingId; closeViewModal(); setTimeout(() => openModal(id), 100); });
document.getElementById('btn-copy-from-view').addEventListener('click', () => { triggerHaptic(); const id = currentViewingId; closeViewModal(); setTimeout(() => copyEventToModal(id), 100); });

function openModal(eventId = null, defaultDate = null) {
    document.getElementById('event-form').reset();
    currentEditingId = eventId;
    if (eventId) {
        document.getElementById('modal-title').innerText = '編輯活動';
        document.getElementById('btn-delete').classList.remove('hidden');
        const evt = events.find(e => e.id === eventId);
        if (evt) {
            document.getElementById('event-title').value = evt.title;
            document.getElementById('event-icon').value = evt.icon || '';
            document.getElementById('event-start-date').value = evt.originalStart || evt.startDate;
            document.getElementById('event-end-date').value = evt.endDate || evt.startDate;
            document.getElementById('event-is-lunar-recurring').checked = evt.isLunarRecurring || false;
            document.querySelector(`input[name="event-color"][value="${evt.color}"]`).checked = true;
        }
    } else {
        document.getElementById('modal-title').innerText = '新增活動';
        document.getElementById('btn-delete').classList.add('hidden');
        document.getElementById('event-start-date').value = defaultDate || formatDateStr(new Date());
    }
    document.getElementById('event-modal').classList.remove('hidden');
}
function copyEventToModal(eventId) { openModal(eventId); currentEditingId = null; document.getElementById('modal-title').innerText = '複製並新增活動'; document.getElementById('btn-delete').classList.add('hidden'); }
function closeModal() { document.getElementById('event-modal').classList.add('hidden'); currentEditingId = null; }

function openViewModal(eventId) {
    const evt = events.find(e => e.id === eventId);
    if(!evt) return;
    currentViewingId = eventId;
    document.getElementById('view-modal-header').className = `h-20 w-full ${evt.color}`;
    document.getElementById('view-title').innerText = (evt.icon ? evt.icon + ' ' : '') + evt.title;
    document.getElementById('view-date').innerText = evt.startDate === evt.endDate ? evt.startDate : `${evt.startDate} ~ ${evt.endDate}`;
    document.getElementById('view-author').innerText = `建立者：${evt.author || '未署名'}`;
    document.getElementById('view-modal').classList.remove('hidden');
}
function closeViewModal() { document.getElementById('view-modal').classList.add('hidden'); currentViewingId = null; }

document.getElementById('event-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    triggerHaptic();

    const isLunarRecurring = document.getElementById('event-is-lunar-recurring').checked;
    let lunarMonth = null, lunarDay = null;
    const startDateVal = document.getElementById('event-start-date').value;

    if (isLunarRecurring && startDateVal) {
        const [y, m, d] = startDateVal.split('-').map(Number);
        const solar = Solar.fromYmd(y, m, d);
        const lunar = solar.getLunar();
        lunarMonth = lunar.getMonth();
        lunarDay = lunar.getDay();
    }

    const eventData = {
        title: document.getElementById('event-title').value.trim(),
        icon: document.getElementById('event-icon').value,
        startDate: startDateVal,
        endDate: document.getElementById('event-end-date').value || startDateVal,
        isLunarRecurring: isLunarRecurring,
        lunarMonth: lunarMonth,
        lunarDay: lunarDay,
        author: document.getElementById('event-author').value.trim() || '家族成員',
        color: document.querySelector('input[name="event-color"]:checked').value
    };

    // 🌟 樂觀更新 (Optimistic UI)：立即在本地端渲染，背景非同步寫入 Firestore
    if (currentEditingId) {
        const index = events.findIndex(e => e.id === currentEditingId);
        if (index !== -1) events[index] = { ...events[index], ...eventData };
        await updateDoc(doc(eventsRef, currentEditingId), eventData);
    } else {
        await addDoc(eventsRef, eventData);
    }
    renderApp();
    closeModal();
});

document.getElementById('btn-delete').addEventListener('click', async () => {
    if (!currentEditingId) return;
    triggerHaptic();
    if (confirm('確定要刪除此活動嗎？')) {
        await deleteDoc(doc(eventsRef, currentEditingId));
        closeModal();
    }
});

renderApp();