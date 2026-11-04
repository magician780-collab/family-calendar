import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, setDoc, getDoc, getDocs, onSnapshot, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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
enableIndexedDbPersistence(db).catch(() => {});

document.querySelectorAll('input[name="event-color"]').forEach(radio => {
    radio.classList.remove('sr-only');
    radio.classList.add('absolute', 'opacity-0', 'w-0', 'h-0', '-z-10'); 
});
const eventForm = document.getElementById('event-form');
if (eventForm) eventForm.classList.add('pb-8'); 

const eventsRef = collection(db, 'familyEvents');
const membersRef = collection(db, 'familyMembers');
const noteRef = doc(db, 'familyNotes', 'mainNote'); 

const ADMIN_PASSWORD = "2026"; 

let currentDate = new Date();
let events = [];
let familyMembers = [];
let weatherData = {}; 
let currentEditingId = null;
let currentViewingId = null;
let selectedDateForModal = null;
let searchQuery = '';

// 全域變數：支援相片輪播
let currentCarouselIndex = 0;
let currentCarouselImages = [];

const initDate = new Date();
let activeCellDate = `${initDate.getFullYear()}-${String(initDate.getMonth() + 1).padStart(2, '0')}-${String(initDate.getDate()).padStart(2, '0')}`;

const weatherDescMap = {
    0: '☀️ 晴朗', 1: '🌤️ 晴時多雲', 2: '⛅ 多雲', 3: '☁️ 陰天', 
    45: '🌫️ 起霧', 48: '🌫️ 霧霾', 
    51: '🌧️ 毛毛雨', 53: '🌧️ 小雨', 55: '🌧️ 陰雨', 
    61: '🌧️ 陣雨', 63: '🌧️ 中雨', 65: '🌧️ 大雨', 
    71: '❄️ 小雪', 73: '❄️ 中雪', 75: '❄️ 大雪', 
    80: '🌧️ 陣雨', 81: '🌧️ 大陣雨', 82: '🌧️ 狂風暴雨', 
    85: '❄️ 陣雪', 86: '❄️ 大陣雪', 95: '⛈️ 雷陣雨'
};

function getDirectImageUrl(url) {
    if (!url) return '';
    if (url.includes('drive.google.com/file/d/')) {
        const fileId = url.split('/d/')[1].split('/')[0];
        return `https://lh3.googleusercontent.com/d/${fileId}`;
    }
    return url;
}

if (!document.getElementById('ai-border-style')) {
    const style = document.createElement('style');
    style.id = 'ai-border-style';
    style.innerHTML = `
    @keyframes ai-glow {
        0%, 100% { box-shadow: 0 0 8px var(--color-400), inset 0 0 4px var(--color-100); border-color: var(--color-500); }
        50% { box-shadow: 0 0 16px var(--color-500), inset 0 0 8px var(--color-200); border-color: var(--color-600); }
    }
    .ai-active-cell {
        animation: ai-glow 2s infinite alternate;
        transform: scale(1.02);
        z-index: 20;
        border-width: 2px !important;
        border-radius: 0.75rem;
    }
    @media screen and (max-height: 600px) and (orientation: landscape) {
        body#app-body, main { height: auto !important; min-height: 100vh !important; overflow-y: auto !important; }
        #calendar-swipe-container { min-height: 120vw !important; overflow: visible !important; }
        #calendar-grid { min-height: 400px !important; }
        .vehicle-wrapper, .drone-wrapper { display: none !important; }
    }
    `;
    document.head.appendChild(style);
}

function triggerHaptic() {
    if (window.navigator && window.navigator.vibrate) window.navigator.vibrate(10);
}

function stopViewVideo() {
    const vIframe = document.getElementById('view-video-iframe');
    const vVideo = document.getElementById('view-video-element');
    if (vIframe) vIframe.src = ''; 
    if (vVideo) { vVideo.pause(); vVideo.src = ''; }
}

const sidebar = document.getElementById('sidebar');
const sidebarBackdrop = document.getElementById('sidebar-backdrop');
function toggleSidebar() {
    triggerHaptic();
    const isOpen = !sidebar.classList.contains('-translate-x-full');
    sidebar.classList.toggle('-translate-x-full', isOpen);
    sidebarBackdrop.classList.toggle('hidden', isOpen);
}
document.getElementById('btn-toggle-sidebar').addEventListener('click', toggleSidebar);
document.getElementById('btn-close-sidebar').addEventListener('click', toggleSidebar);
sidebarBackdrop.addEventListener('click', toggleSidebar);

document.getElementById('btn-open-admin').addEventListener('click', () => {
    triggerHaptic();
    document.getElementById('member-modal').classList.remove('hidden');
});

document.getElementById('btn-manage-members').addEventListener('click', () => {
    triggerHaptic();
    document.getElementById('member-modal').classList.remove('hidden');
});

const galleryBtn = document.getElementById('btn-open-gallery');
if (galleryBtn && !document.getElementById('btn-open-manual')) {
    const manualBtn = document.createElement('button');
    manualBtn.id = 'btn-open-manual';
    manualBtn.className = 'w-full py-3 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-2 shadow-sm mt-3';
    manualBtn.innerHTML = '<i class="fas fa-book-open text-blue-600"></i> 📖 系統使用說明書';
    galleryBtn.parentNode.insertBefore(manualBtn, galleryBtn.nextSibling);

    manualBtn.addEventListener('click', () => {
        triggerHaptic();
        if (!sidebar.classList.contains('-translate-x-full') && window.innerWidth < 768) toggleSidebar();
        openManualModal();
    });
}

function openManualModal() {
    if (document.getElementById('manual-modal')) {
        document.getElementById('manual-modal').classList.remove('hidden');
        return;
    }

    const modal = document.createElement('div');
    modal.id = 'manual-modal';
    modal.className = 'fixed inset-0 bg-warm-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-fade-in modal-backdrop';
    
    const manualContent = `
        <h2 class="text-2xl font-extrabold text-warm-800 mb-4 border-b pb-2"><i class="fas fa-book-reader text-warm-500"></i> 溫馨家族行事曆 - 快速上手指南</h2>
        <div class="space-y-6 text-sm text-gray-700 leading-relaxed">
            <section>
                <h3 class="font-bold text-lg text-rose-600 mb-2 flex items-center gap-2"><i class="fas fa-calendar-plus"></i> 1. 新增與管理行程</h3>
                <ul class="list-disc pl-5 space-y-1">
                    <li>點擊畫面右下角的 <b class="bg-warm-500 text-white px-1.5 py-0.5 rounded text-xs">＋</b> (手機版) 或側邊欄的 <b class="text-warm-600">新增活動</b>。</li>
                    <li>輸入活動名稱、時間、並選擇「建立者」。</li>
                </ul>
            </section>
            <section>
                <h3 class="font-bold text-lg text-purple-600 mb-2 flex items-center gap-2"><i class="fas fa-photo-video"></i> 2. 影音回憶相簿與導航</h3>
                <ul class="list-disc pl-5 space-y-1">
                    <li><b>放入多張相片：</b> 系統已支援多圖輪播！點擊「新增相片」按鈕並貼上圖片網址即可。</li>
                    <li><b>相簿牆：</b> 點擊左側選單的相簿牆，回味所有美好回憶。</li>
                </ul>
            </section>
        </div>
    `;

    modal.innerHTML = `
        <div class="bg-white w-full max-w-2xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden modal-content" onclick="event.stopPropagation()">
            <div class="px-6 py-4 bg-blue-50 border-b border-blue-100 flex justify-between items-center shrink-0">
                <h3 class="font-bold text-blue-900 flex items-center gap-2"><i class="fas fa-book-open text-blue-600"></i> 系統說明書</h3>
                <button id="btn-close-manual-modal" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times text-xl"></i></button>
            </div>
            <div class="p-6 overflow-y-auto flex-1 hide-scrollbar">${manualContent}</div>
            <div class="p-4 bg-gray-50 border-t flex justify-center shrink-0">
                <button id="btn-understand-manual" class="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm transition-all active:scale-95">
                    我了解了，開始使用！
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('btn-close-manual-modal').onclick = () => modal.classList.add('hidden');
    document.getElementById('btn-understand-manual').onclick = () => modal.classList.add('hidden');
    modal.onclick = () => modal.classList.add('hidden');
}

document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', () => {
        triggerHaptic();
        backdrop.classList.add('hidden');
        if (backdrop.id === 'day-modal') selectedDateForModal = null;
        if (backdrop.id === 'view-modal') {
            currentViewingId = null;
            stopViewVideo(); 
        }
    });
});

let touchStartX = 0;
let touchEndX = 0;
const swipeContainer = document.getElementById('calendar-swipe-container');

if (swipeContainer) {
    swipeContainer.addEventListener('touchstart', (e) => { touchStartX = e.changedTouches[0].screenX; }, { passive: true });
    swipeContainer.addEventListener('touchend', (e) => { touchEndX = e.changedTouches[0].screenX; handleSwipeGesture(); }, { passive: true });
}

function handleSwipeGesture() {
    const swipeThreshold = 50; 
    if (touchEndX < touchStartX - swipeThreshold) { triggerHaptic(); currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(); }
    if (touchEndX > touchStartX + swipeThreshold) { triggerHaptic(); currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(); }
}

const searchInputEl = document.getElementById('search-input');
if (searchInputEl) {
    searchInputEl.addEventListener('input', (e) => { searchQuery = e.target.value.trim().toLowerCase(); renderApp(); });
}

// 主題與背景色設定
const themePalettes = {
    warm: { 50: '#fff7ed', 100: '#ffedd5', 200: '#fed7aa', 300: '#fdba74', 400: '#fb923c', 500: '#f97316', 600: '#ea580c', 700: '#c2410c', 800: '#9a3412', 900: '#7c2d12' },
    forest: { 50: '#f0fdf4', 100: '#dcfce7', 200: '#bbf7d0', 300: '#86efac', 400: '#4ade80', 500: '#22c55e', 600: '#16a34a', 700: '#15803d', 800: '#166534', 900: '#14532d' },
    purple: { 50: '#faf5ff', 100: '#f3e8ff', 200: '#e9d5ff', 300: '#d8b4fe', 400: '#c084fc', 500: '#a855f7', 600: '#9333ea', 700: '#7e22ce', 800: '#6b21a8', 900: '#581c87' },
    dark: { 50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1', 400: '#94a3b8', 500: '#64748b', 600: '#475569', 700: '#334155', 800: '#1e293b', 900: '#0f172a' }
};

function initThemeSelectOptions() {
    const sel = document.getElementById('theme-select');
    if (!sel) return;
    const savedTheme = localStorage.getItem('family_app_theme') || 'warm';
    if (Object.keys(themePalettes).includes(savedTheme)) { sel.value = savedTheme; } 
    else { sel.value = 'warm'; setTheme('warm'); }
}
function setTheme(name) {
    const palette = themePalettes[name] || themePalettes.warm;
    const root = document.documentElement;
    Object.keys(palette).forEach(k => root.style.setProperty(`--color-${k}`, palette[k]));
    localStorage.setItem('family_app_theme', name);
    const sel = document.getElementById('theme-select');
    if (sel) sel.value = name;
}
initThemeSelectOptions();
setTheme(localStorage.getItem('family_app_theme') || 'warm');

const themeSelectEl = document.getElementById('theme-select');
if (themeSelectEl) {
    themeSelectEl.addEventListener('change', (e) => { triggerHaptic(); setTheme(e.target.value); });
}

async function fetchWeather() {
    try {
        const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=22.9908&longitude=120.2133&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=Asia%2FTaipei&forecast_days=16&past_days=7');
        const data = await res.json();
        if (data && data.daily) {
            data.daily.time.forEach((d, i) => { 
                const code = data.daily.weathercode[i];
                const desc = weatherDescMap[code] || '☁️ 陰天';
                weatherData[d] = `${desc} ${Math.round(data.daily.temperature_2m_max[i])}°`; 
            });
        }
    } catch (e) {}
}
fetchWeather().then(() => renderCalendar());

const stickyNoteEl = document.getElementById('family-sticky-note');
const noteStatusEl = document.getElementById('note-status');
let noteTimeout = null;
onSnapshot(noteRef, (docSnap) => { if (docSnap.exists() && document.activeElement !== stickyNoteEl) stickyNoteEl.value = docSnap.data().content || ''; });
stickyNoteEl.addEventListener('input', () => {
    noteStatusEl.textContent = '儲存中...'; noteStatusEl.classList.remove('opacity-0');
    if (noteTimeout) clearTimeout(noteTimeout);
    noteTimeout = setTimeout(async () => {
        await setDoc(noteRef, { content: stickyNoteEl.value }, { merge: true });
        noteStatusEl.textContent = '已同步'; setTimeout(() => noteStatusEl.classList.add('opacity-0'), 2000);
    }, 1000);
});

onSnapshot(membersRef, (snapshot) => {
    familyMembers = [];
    snapshot.forEach(doc => familyMembers.push({ id: doc.id, name: doc.data().name }));
    familyMembers.sort((a, b) => a.name.localeCompare(b.name));
    renderMemberManageList();
});
function renderMemberManageList() {
    const container = document.getElementById('member-list-container');
    if (!container) return;
    container.innerHTML = familyMembers.length === 0 ? '<p class="text-center text-gray-400 text-sm py-4">尚無成員</p>' : '';
    familyMembers.forEach(m => {
        const item = document.createElement('div');
        item.className = 'flex justify-between items-center bg-white p-2.5 rounded-xl border shadow-sm text-sm';
        item.innerHTML = `<span>${m.name}</span><button class="text-rose-400 px-2 py-1"><i class="fas fa-trash-alt"></i></button>`;
        item.querySelector('button').addEventListener('click', async () => { if (confirm(`刪除 ${m.name}？`)) await deleteDoc(doc(db, 'familyMembers', m.id)); });
        container.appendChild(item);
    });
}
document.getElementById('btn-add-member').addEventListener('click', async () => {
    const input = document.getElementById('new-member-name');
    if (input.value.trim() && !familyMembers.some(m => m.name === input.value.trim())) {
        await addDoc(membersRef, { name: input.value.trim() }); input.value = '';
    }
});
document.getElementById('btn-close-member-modal').addEventListener('click', () => document.getElementById('member-modal').classList.add('hidden'));

function requestAdminAccess(callback) {
    const pwd = prompt('🔒 此功能僅限管理員操作。\n請輸入管理員密碼：');
    if (pwd === null) return; 
    if (pwd === ADMIN_PASSWORD) {
        callback();
    } else {
        alert('❌ 密碼錯誤！您無權執行此操作。');
    }
}

// ---------------- 處理表單多圖動態新增 ----------------
function addPhotoInputRow(url = '') {
    const container = document.getElementById('photo-urls-container');
    const row = document.createElement('div');
    row.className = 'flex flex-col gap-2 p-3 bg-gray-50 border border-gray-200 rounded-xl relative photo-input-row';
    row.innerHTML = `
        <div class="flex gap-2">
            <input type="url" placeholder="貼上 Google Drive 等圖檔連結..." value="${url}" class="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm photo-url-input outline-none focus:border-warm-400">
            <button type="button" class="w-9 h-9 bg-white border border-gray-200 text-rose-400 hover:text-rose-600 rounded-lg flex items-center justify-center btn-remove-photo-row transition-colors"><i class="fas fa-trash-alt"></i></button>
        </div>
        <img src="${url ? getDirectImageUrl(url) : ''}" class="w-full h-24 object-cover rounded-lg border border-gray-200 photo-preview-img ${url ? '' : 'hidden'}">
    `;
    
    const input = row.querySelector('.photo-url-input');
    const img = row.querySelector('.photo-preview-img');
    input.addEventListener('input', (e) => {
        const val = e.target.value.trim();
        if(val) { img.src = getDirectImageUrl(val); img.classList.remove('hidden'); }
        else { img.classList.add('hidden'); img.src = ''; }
    });
    row.querySelector('.btn-remove-photo-row').addEventListener('click', () => row.remove());
    container.appendChild(row);
}
document.getElementById('btn-add-photo-input').addEventListener('click', () => { triggerHaptic(); addPhotoInputRow(); });

const galleryModal = document.getElementById('gallery-modal');
document.getElementById('btn-open-gallery').addEventListener('click', () => { triggerHaptic(); renderGalleryGrid(); galleryModal.classList.remove('hidden'); });
document.getElementById('btn-close-gallery').addEventListener('click', () => { triggerHaptic(); galleryModal.classList.add('hidden'); });

function renderGalleryGrid() {
    const container = document.getElementById('gallery-grid-container');
    container.innerHTML = '';
    const photoEvents = events.filter(e => e.photoUrls && e.photoUrls.length > 0).sort((a, b) => b.startDate.localeCompare(a.startDate));
    if (photoEvents.length === 0) {
        container.innerHTML = `<div class="col-span-full text-center py-16 text-gray-400"><i class="far fa-images text-4xl mb-3 opacity-50"></i><p class="text-sm">目前還沒有任何相片記錄喔！</p></div>`;
        return;
    }
    photoEvents.forEach(evt => {
        const item = document.createElement('div');
        item.className = 'bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 cursor-pointer flex flex-col group';
        const imgUrl = getDirectImageUrl(evt.photoUrls[0]); 
        const multiPhotoBadge = evt.photoUrls.length > 1 ? `<div class="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 shadow-sm"><i class="fas fa-images"></i> ${evt.photoUrls.length}</div>` : '';
        item.innerHTML = `
            <div class="aspect-square w-full overflow-hidden bg-gray-100 relative">
                <img src="${imgUrl}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300">
                <div class="absolute top-2 left-2 bg-black/50 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full">${evt.startDate}</div>
                ${multiPhotoBadge}
            </div>
            <div class="p-3">
                <h4 class="font-bold text-gray-800 text-xs truncate">${evt.icon ? evt.icon+' ' : ''}${evt.title}</h4>
            </div>`;
        item.addEventListener('click', () => { triggerHaptic(); galleryModal.classList.add('hidden'); openViewModal(evt.id); });
        container.appendChild(item);
    });
}

function getMemberOptions(selected = '', defaultText = '請選擇...') {
    let html = `<option value="" disabled ${!selected ? 'selected' : ''}>${defaultText}</option>`;
    familyMembers.forEach(m => { html += `<option value="${m.name}" ${m.name === selected ? 'selected' : ''}>${m.name}</option>`; });
    return html;
}
function getChecklistMemberOptions(selected = '') {
    let html = `<option value="" ${!selected ? 'selected' : ''}>(未認領)</option>`;
    familyMembers.forEach(m => { html += `<option value="${m.name}" ${m.name === selected ? 'selected' : ''}>${m.name}</option>`; });
    return html;
}

const checklistCheckbox = document.getElementById('event-is-checklist');
const checklistFields = document.getElementById('checklist-fields');
const checklistContainer = document.getElementById('checklist-items-container');
checklistCheckbox.addEventListener('change', (e) => {
    checklistFields.classList.toggle('hidden', !e.target.checked);
    if (e.target.checked && checklistContainer.children.length === 0) addChecklistRow();
});
function addChecklistRow(text = '', assignee = '', done = false) {
    const row = document.createElement('div');
    row.className = 'flex items-center gap-2 checklist-row';
    row.dataset.done = done ? 'true' : 'false';
    row.innerHTML = `
        <input type="text" placeholder="裝備/任務" value="${text}" class="checklist-text flex-1 px-3 py-1.5 bg-white border rounded-xl text-xs outline-none" required>
        <select class="checklist-assignee w-24 px-2 py-1.5 bg-white border rounded-xl text-xs outline-none cursor-pointer">${getChecklistMemberOptions(assignee)}</select>
        <button type="button" class="text-rose-400 p-1"><i class="fas fa-trash-alt"></i></button>
    `;
    row.querySelector('button').addEventListener('click', () => row.remove());
    checklistContainer.appendChild(row);
}
document.getElementById('btn-add-checklist-item').addEventListener('click', () => addChecklistRow());

onSnapshot(eventsRef, (snapshot) => {
    events = [];
    snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        let sDate = data.startDate;
        let eDate = data.endDate || data.startDate;
        events.push({
            id: docSnap.id, title: data.title || '未命名活動', icon: data.icon || '',
            startDate: sDate, endDate: eDate, originalStart: data.startDate,
            isLunarRecurring: data.isLunarRecurring || false, lunarMonth: data.lunarMonth || null, lunarDay: data.lunarDay || null,
            author: data.author || '家族成員', color: data.color || 'bg-rose-400',
            // 升級陣列資料格式 (向下相容)
            photoUrls: data.photoUrls || (data.photoUrl ? [data.photoUrl] : []), 
            videoUrl: data.videoUrl || null, fileUrl: data.fileUrl || null,
            location: data.location || '', mapUrl: data.mapUrl || '',
            isChecklist: data.isChecklist || false, checklist: data.checklist || [],
            isPoll: data.isPoll || false, pollOptions: (data.pollOptions || []).map(o => ({ title: o.title, voters: o.voters || [] })),
            isExpense: data.isExpense || false, payers: data.payers || [], sharers: data.sharers || []
        });
    });
    renderApp();
    if (selectedDateForModal) openDayModal(selectedDateForModal, false);
    if (currentViewingId) openViewModal(currentViewingId);
});

function renderApp() { renderCalendar(); renderUpcoming(); }

function renderCalendar() {
    const y = currentDate.getFullYear();
    const m = currentDate.getMonth();
    const tStr = `${y}年 ${m + 1}月`;
    if (document.getElementById('current-month-year')) document.getElementById('current-month-year').innerText = tStr;
    if (document.getElementById('mob-month-year')) document.getElementById('mob-month-year').innerText = tStr;

    const firstDay = new Date(y, m, 1).getDay();
    const totalDays = new Date(y, m + 1, 0).getDate();
    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = '';
    const todayStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;

    for (let i = 0; i < firstDay; i++) {
        const empty = document.createElement('div');
        empty.className = 'border border-warm-100 rounded-xl bg-warm-50/30 opacity-30';
        grid.appendChild(empty);
    }
    for (let i = 1; i <= totalDays; i++) {
        const dStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        grid.appendChild(createDayCell(i, dStr, dStr === todayStr));
    }
}

function createDayCell(dayNum, dateStr, isToday) {
    const dateObj = new Date(dateStr);
    const dayOfWeek = dateObj.getDay();
    const dayEvents = events.filter(e => {
        const inRange = dateStr >= e.startDate && dateStr <= e.endDate;
        if (!inRange) return false;
        if (!searchQuery) return true;
        return (e.title && e.title.toLowerCase().includes(searchQuery)) || 
               (e.author && e.author.toLowerCase().includes(searchQuery)) || 
               (e.location && e.location.toLowerCase().includes(searchQuery));
    });

    let cellBgClass = isToday ? 'bg-warm-50' : 'bg-white';
    let isSelected = (dateStr === activeCellDate);
    let activeRingClass = isSelected ? 'ai-active-cell transition-all duration-300' : '';

    const cell = document.createElement('div');
    cell.className = `day-cell border border-warm-100 rounded-xl p-1 flex flex-col gap-1 cursor-pointer relative ${cellBgClass} ${activeRingClass}`;
    
    cell.addEventListener('click', () => {
        document.querySelectorAll('.day-cell').forEach(c => c.classList.remove('ai-active-cell', 'transition-all', 'duration-300'));
        cell.classList.add('ai-active-cell', 'transition-all', 'duration-300');
        activeCellDate = dateStr;
        openDayModal(dateStr);
    });
    
    let dateNumColor = isToday ? 'bg-warm-500 text-white shadow-sm' : 'text-gray-600';
    
    const lunar = Lunar.fromDate(dateObj); 
    let lunarText = lunar.getDayInChinese(); 

    cell.innerHTML = `
        <div class="flex flex-col px-0.5 w-full shrink-0">
            <div class="flex justify-between items-start w-full">
                <span class="text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full ${dateNumColor} shrink-0">${dayNum}</span>
                <span class="text-[9px] text-gray-400 font-medium whitespace-nowrap pt-0.5">${lunarText}</span>
            </div>
            <span class="text-[8.5px] md:text-[9px] text-blue-500 leading-tight mt-0.5 whitespace-normal break-words">${weatherData[dateStr] || ''}</span>
        </div>`;

    const container = document.createElement('div');
    container.className = 'flex flex-col gap-0.5 overflow-y-auto flex-1 hide-scrollbar';
    dayEvents.forEach(evt => {
        const el = document.createElement('div');
        el.className = `${evt.color} text-white text-xs font-bold px-1.5 py-1 rounded md:rounded-md shadow-sm transition-transform hover:scale-[1.02] leading-tight whitespace-normal break-words`;
        el.innerHTML = `${evt.icon ? evt.icon + ' ' : ''}${evt.title}`;
        el.addEventListener('click', (ev) => { 
            ev.stopPropagation(); 
            activeCellDate = dateStr; openViewModal(evt.id); 
        });
        container.appendChild(el);
    });
    cell.appendChild(container);
    return cell;
}

function openDayModal(dateStr, setGlobal = true) {
    if (setGlobal) selectedDateForModal = dateStr;
    document.getElementById('day-modal-title').innerText = `${dateStr} 行程`;
    const list = document.getElementById('day-modal-list');
    list.innerHTML = '';
    
    const dayEvts = events.filter(e => dateStr >= e.startDate && dateStr <= e.endDate);
    if (dayEvts.length === 0) {
        list.innerHTML = '<p class="text-center text-gray-400 text-sm py-4">這一天沒有符合的行程</p>';
    } else {
        dayEvts.forEach(evt => {
            const item = document.createElement('div');
            item.className = 'p-3 rounded-xl border bg-warm-50/50 cursor-pointer flex justify-between items-center';
            item.innerHTML = `<div class="flex items-center gap-2"><div class="w-3 h-3 rounded-full ${evt.color}"></div><span class="font-bold text-sm">${evt.icon ? evt.icon + ' ' : ''}${evt.title}</span></div><i class="fas fa-chevron-right text-xs text-gray-300"></i>`;
            item.addEventListener('click', () => { closeDayModal(); openViewModal(evt.id); });
            list.appendChild(item);
        });
    }
    document.getElementById('day-modal').classList.remove('hidden');
}
function closeDayModal() { document.getElementById('day-modal').classList.add('hidden'); }

function renderUpcoming() {
    const container = document.getElementById('upcoming-events');
    container.innerHTML = '';
    const todayObj = new Date(); todayObj.setHours(0, 0, 0, 0);
    const todayStr = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;
    
    const upcoming = events.filter(e => e.endDate >= todayStr).sort((a, b) => a.startDate.localeCompare(b.startDate)).slice(0, 5);
    
    upcoming.forEach(evt => {
        const el = document.createElement('div');
        el.className = 'bg-white p-3 md:p-4 rounded-xl border shadow-sm cursor-pointer flex items-center gap-3 md:gap-4 hover:bg-warm-50 transition-colors';
        el.addEventListener('click', () => openViewModal(evt.id));

        const [y, m, d] = evt.startDate.split('-');
        el.innerHTML = `
            <div class="${evt.color} text-white rounded-xl w-12 h-12 md:w-14 md:h-14 flex flex-col items-center justify-center shrink-0 shadow-sm">
                <span class="text-[10px] md:text-xs">${m}月</span><span class="text-base md:text-xl font-bold">${d}</span>
            </div>
            <div class="flex-1 truncate">
                <div class="flex justify-between items-center gap-2">
                    <h4 class="font-bold text-gray-800 text-sm md:text-base truncate">${evt.icon ? evt.icon + ' ' : ''}${evt.title}</h4>
                </div>
            </div>`;
        container.appendChild(el);
    });
}

const goToToday = () => {
    triggerHaptic();
    currentDate = new Date(); 
    activeCellDate = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
    renderCalendar();
};

document.getElementById('btn-prev-month').addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(); });
document.getElementById('btn-next-month').addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(); });
document.getElementById('btn-today').addEventListener('click', goToToday);
document.getElementById('btn-mob-prev').addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(); });
document.getElementById('btn-mob-next').addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(); });
document.getElementById('btn-mob-today').addEventListener('click', goToToday);

document.getElementById('btn-open-add').addEventListener('click', () => openModal());
document.getElementById('btn-mobile-add').addEventListener('click', () => openModal());
document.getElementById('btn-close-modal').addEventListener('click', closeModal);
document.getElementById('btn-cancel-modal').addEventListener('click', closeModal);
document.getElementById('btn-close-day-modal').addEventListener('click', closeDayModal);

document.getElementById('btn-close-view').addEventListener('click', () => { 
    document.getElementById('view-modal').classList.add('hidden');
    stopViewVideo(); 
});
document.getElementById('btn-edit-from-view').addEventListener('click', () => { 
    const id = currentViewingId; 
    document.getElementById('view-modal').classList.add('hidden'); 
    stopViewVideo(); openModal(id); 
});

function openModal(id = null) {
    document.getElementById('event-form').reset();
    document.getElementById('photo-urls-container').innerHTML = ''; // 清空相片區塊
    document.getElementById('event-video-url').value = '';
    document.getElementById('event-file-url').value = '';
    document.getElementById('event-location').value = '';
    document.getElementById('event-map-url').value = '';
    
    currentEditingId = id;
    const authorSelect = document.getElementById('event-author');

    if (id) {
        document.getElementById('modal-title').innerText = '編輯活動';
        document.getElementById('btn-delete').classList.remove('hidden');
        const evt = events.find(e => e.id === id);
        if (evt) {
            authorSelect.innerHTML = getMemberOptions(evt.author, '請選擇建立者...');
            document.getElementById('event-title').value = evt.title || '';
            document.getElementById('event-icon').value = evt.icon || '';
            document.getElementById('event-start-date').value = evt.originalStart || evt.startDate;
            document.getElementById('event-end-date').value = evt.endDate || evt.startDate;
            document.querySelector(`input[name="event-color"][value="${evt.color}"]`).checked = true;
            
            // 匯入多張相片網址
            if (evt.photoUrls && evt.photoUrls.length > 0) {
                evt.photoUrls.forEach(url => addPhotoInputRow(url));
            } else {
                addPhotoInputRow(); // 預設給一個空欄位
            }
            
            if (evt.videoUrl) document.getElementById('event-video-url').value = evt.videoUrl;
            if (evt.fileUrl) document.getElementById('event-file-url').value = evt.fileUrl;
            if (evt.location) document.getElementById('event-location').value = evt.location;
            if (evt.mapUrl) document.getElementById('event-map-url').value = evt.mapUrl;
        }
    } else {
        document.getElementById('modal-title').innerText = '新增活動'; document.getElementById('btn-delete').classList.add('hidden');
        document.getElementById('event-start-date').value = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
        authorSelect.innerHTML = getMemberOptions('', '請選擇建立者...');
        addPhotoInputRow(); // 預設給一個空欄位
    }
    document.getElementById('event-modal').classList.remove('hidden');
}
function closeModal() { document.getElementById('event-modal').classList.add('hidden'); }

// --- 相簿輪播控制器 ---
function updateCarouselPosition() {
    const carousel = document.getElementById('view-photo-carousel');
    const indicators = document.getElementById('view-photo-indicators');
    if(!carousel || !indicators) return;
    
    carousel.style.transform = `translateX(-${currentCarouselIndex * 100}%)`;
    Array.from(indicators.children).forEach((ind, i) => {
        ind.className = `w-1.5 h-1.5 rounded-full transition-all ${i === currentCarouselIndex ? 'bg-white scale-125 shadow-sm' : 'bg-white/50'}`;
    });
}

document.getElementById('btn-carousel-prev').addEventListener('click', (e) => {
    e.stopPropagation(); triggerHaptic();
    currentCarouselIndex = (currentCarouselIndex > 0) ? currentCarouselIndex - 1 : currentCarouselImages.length - 1;
    updateCarouselPosition();
});

document.getElementById('btn-carousel-next').addEventListener('click', (e) => {
    e.stopPropagation(); triggerHaptic();
    currentCarouselIndex = (currentCarouselIndex < currentCarouselImages.length - 1) ? currentCarouselIndex + 1 : 0;
    updateCarouselPosition();
});

// 加入手機滑動(Swipe)支援
let carouselTouchStartX = 0;
const carouselContainer = document.getElementById('view-photo-container');
carouselContainer.addEventListener('touchstart', e => {
    carouselTouchStartX = e.changedTouches[0].screenX;
}, { passive: true });
carouselContainer.addEventListener('touchend', e => {
    if (currentCarouselImages.length <= 1) return; // 單張圖不用滑動
    const touchEndX = e.changedTouches[0].screenX;
    if (touchEndX < carouselTouchStartX - 40) {
        // 向左滑 (下一張)
        triggerHaptic();
        currentCarouselIndex = (currentCarouselIndex < currentCarouselImages.length - 1) ? currentCarouselIndex + 1 : 0;
        updateCarouselPosition();
    }
    if (touchEndX > carouselTouchStartX + 40) {
        // 向右滑 (上一張)
        triggerHaptic();
        currentCarouselIndex = (currentCarouselIndex > 0) ? currentCarouselIndex - 1 : currentCarouselImages.length - 1;
        updateCarouselPosition();
    }
}, { passive: true });


function openViewModal(id) {
    const evt = events.find(e => e.id === id);
    if (!evt) return;
    currentViewingId = id;
    document.getElementById('view-modal-header').className = `h-20 w-full ${evt.color}`;
    document.getElementById('view-title').innerText = (evt.icon ? evt.icon + ' ' : '') + evt.title;
    document.getElementById('view-date').innerText = evt.startDate === evt.endDate ? evt.startDate : `${evt.startDate} ~ ${evt.endDate}`;
    document.getElementById('view-author').innerText = `建立者：${evt.author}`;

    // 處理多圖輪播相簿顯示
    const pBox = document.getElementById('view-photo-container');
    const carousel = document.getElementById('view-photo-carousel');
    const indicators = document.getElementById('view-photo-indicators');

    if (evt.photoUrls && evt.photoUrls.length > 0) {
        currentCarouselImages = evt.photoUrls.map(url => getDirectImageUrl(url));
        currentCarouselIndex = 0;

        carousel.innerHTML = currentCarouselImages.map(url => `<img src="${url}" class="w-full h-48 object-cover shrink-0">`).join('');
        indicators.innerHTML = currentCarouselImages.map((_, i) => `<div class="w-1.5 h-1.5 rounded-full transition-all ${i === 0 ? 'bg-white scale-125' : 'bg-white/50'}"></div>`).join('');
        
        updateCarouselPosition();
        pBox.classList.remove('hidden');
        
        // 超過一張圖才顯示左右箭頭
        const showNav = currentCarouselImages.length > 1;
        document.getElementById('btn-carousel-prev').classList.toggle('hidden', !showNav);
        document.getElementById('btn-carousel-next').classList.toggle('hidden', !showNav);
    } else {
        pBox.classList.add('hidden');
    }

    const vBox = document.getElementById('view-video-container');
    const vIframe = document.getElementById('view-video-iframe');
    const vElement = document.getElementById('view-video-element');
    
    if (evt.videoUrl) {
        let url = evt.videoUrl.trim(); 
        vIframe.classList.add('hidden'); vElement.classList.add('hidden');
        
        vBox.style.cssText = "width: 100%; aspect-ratio: 16/9; background: #000; border-radius: 0.75rem; overflow: hidden; position: relative;";
        vIframe.style.cssText = "position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none;";
        
        let ytId = '';
        if (url.includes('youtube.com/watch?v=')) ytId = new URL(url).searchParams.get('v');
        else if (url.includes('youtu.be/')) ytId = url.split('youtu.be/')[1].split('?')[0];

        if (ytId) {
            vIframe.src = `https://www.youtube.com/embed/${ytId}?rel=0&playsinline=1`;
            vIframe.classList.remove('hidden');
        } else {
            vElement.src = url; vElement.classList.remove('hidden');
        }
        vBox.classList.remove('hidden');
    } else { 
        vBox.classList.add('hidden'); vIframe.src = ''; vElement.src = '';
    }

    const fBox = document.getElementById('view-file-container');
    if (evt.fileUrl) { fBox.classList.remove('hidden'); document.getElementById('view-file-link').href = evt.fileUrl; } else fBox.classList.add('hidden');

    const mMapBox = document.getElementById('view-map-container');
    if (evt.mapUrl || evt.location) {
        document.getElementById('view-location-text').innerText = evt.location || '點擊開啟地圖導航';
        document.getElementById('view-map-link').href = evt.mapUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(evt.location)}`;
        mMapBox.classList.remove('hidden');
    } else { 
        mMapBox.classList.add('hidden'); 
    }

    document.getElementById('view-modal').classList.add('hidden'); document.getElementById('view-modal').classList.remove('hidden');
}

document.getElementById('event-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    triggerHaptic();
    const titleVal = document.getElementById('event-title').value.trim();
    if (!titleVal) return alert('請輸入活動名稱！');

    // 收集所有相片網址
    let photoUrlsArr = [];
    document.querySelectorAll('.photo-url-input').forEach(input => {
        const val = input.value.trim();
        if (val) photoUrlsArr.push(val);
    });

    const eventData = {
        title: titleVal, icon: document.getElementById('event-icon').value,
        startDate: document.getElementById('event-start-date').value, 
        endDate: document.getElementById('event-end-date').value || document.getElementById('event-start-date').value,
        author: document.getElementById('event-author').value.trim() || '家族成員',
        color: document.querySelector('input[name="event-color"]:checked').value,
        photoUrls: photoUrlsArr, // 存入陣列
        videoUrl: document.getElementById('event-video-url').value.trim(), 
        fileUrl: document.getElementById('event-file-url').value.trim(),
        location: document.getElementById('event-location').value.trim(), 
        mapUrl: document.getElementById('event-map-url').value.trim(),
    };

    if (currentEditingId) { await updateDoc(doc(eventsRef, currentEditingId), eventData); } 
    else { await addDoc(eventsRef, eventData); }
    closeModal();
});

document.getElementById('btn-delete').addEventListener('click', async () => {
    if (currentEditingId && confirm('確定要刪除嗎？')) { await deleteDoc(doc(eventsRef, currentEditingId)); closeModal(); }
});