import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, setDoc, getDoc, getDocs, onSnapshot, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDYGym07ekiZgikCqVsAA9OfylxGAAvUp8",
  authDomain: "family-calendar-2026-90f16.firebaseapp.com",
  projectId: "family-calendar-2026-90f16",
  storageBucket: "family-calendar-2026-90f16.firebasestorage.app",
  messagingSenderId: "289688020199",
  appId: "1:289688020199:web:0ccb2b321c7f437744ae42"
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

const CWA_API_KEY = "CWA-A6EF9D61-B6BA-4F86-BEF6-83103A2A52C2"; 
let activeCWAAlerts = {};

async function fetchCWAAlerts() {
    if (!CWA_API_KEY) return;
    try {
        const res = await fetch(`https://opendata.cwa.gov.tw/api/v1/rest/datastore/W-C0033-001?Authorization=${CWA_API_KEY}&format=JSON`);
        const data = await res.json();
        if (data?.records?.location) {
            data.records.location.forEach(loc => {
                const locName = loc.locationName;
                const hazards = loc.hazardConditions?.hazards;
                if (hazards && hazards.length > 0) {
                    const eventsList = hazards.map(h => h.info?.event || (h.info?.phenomena ? h.info.phenomena + h.info.significance : '極端氣候')).filter(Boolean);
                    if (eventsList.length > 0) activeCWAAlerts[locName] = [...new Set(eventsList)].join('、');
                }
            });
        }
    } catch (e) { console.warn("CWA API 警報讀取失敗", e); }
}

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
    // (說明書內容已在 HTML 中預先渲染)
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

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const openModals = document.querySelectorAll('.modal-backdrop:not(.hidden)');
        if (openModals.length > 0) {
            triggerHaptic();
            openModals.forEach(modal => {
                modal.classList.add('hidden');
                if (modal.id === 'day-modal') selectedDateForModal = null;
                if (modal.id === 'view-modal') {
                    currentViewingId = null;
                    stopViewVideo(); 
                }
            });
        }
    }
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
    if (themePalettes[savedTheme]) { sel.value = savedTheme; } else { sel.value = 'warm'; setTheme('warm'); }
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
    const newSelectEl = themeSelectEl.cloneNode(true);
    themeSelectEl.parentNode.replaceChild(newSelectEl, themeSelectEl);
    newSelectEl.addEventListener('change', (e) => { triggerHaptic(); setTheme(e.target.value); });
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

Promise.all([fetchWeather(), fetchCWAAlerts()]).then(() => renderCalendar());

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
    snapshot.forEach(doc => {
        const data = doc.data();
        familyMembers.push({ id: doc.id, name: data.name, emoji: data.emoji || '👤' });
    });
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
        item.innerHTML = `<span><span class="text-lg mr-1">${m.emoji}</span> ${m.name}</span><button class="text-rose-400 px-2 py-1"><i class="fas fa-trash-alt"></i></button>`;
        item.querySelector('button').addEventListener('click', async () => { if (confirm(`刪除 ${m.name}？`)) await deleteDoc(doc(db, 'familyMembers', m.id)); });
        container.appendChild(item);
    });
}

document.getElementById('btn-add-member').addEventListener('click', async () => {
    const nameInput = document.getElementById('new-member-name');
    const emojiInput = document.getElementById('new-member-emoji');
    const nameStr = nameInput.value.trim();
    const emojiStr = emojiInput.value.trim() || '👤';
    
    if (nameStr && !familyMembers.some(m => m.name === nameStr)) {
        await addDoc(membersRef, { name: nameStr, emoji: emojiStr });
        nameInput.value = '';
        emojiInput.value = '👤';
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

// === 內建國定假日等其他邏輯省略... ===
// (確保你保留原本的國定假日匯入與匯出按鈕監聽器，為節省字數此處省略非核心修改)

// ============================================
// 🚨 核心升級：定位解析共用引擎 (地圖與天氣共用)
// ============================================

const twLocationsMap = {
    "台北":{lat:25.033,lng:121.565},"新北":{lat:25.011,lng:121.461},"桃園":{lat:24.993,lng:121.301},"台中":{lat:24.147,lng:120.673},"台南":{lat:22.999,lng:120.227},
    "高雄":{lat:22.627,lng:120.301},"基隆":{lat:25.127,lng:121.739},"新竹":{lat:24.813,lng:120.967},"苗栗":{lat:24.56,lng:120.821},"彰化":{lat:24.075,lng:120.544},
    "南投":{lat:23.903,lng:120.693},"埔里":{lat:23.966,lng:120.966},"雲林":{lat:23.709,lng:120.431},"嘉義":{lat:23.48,lng:120.453},"屏東":{lat:22.668,lng:120.486},
    "恆春":{lat:22.002,lng:120.741},"宜蘭":{lat:24.757,lng:121.753},"花蓮":{lat:23.987,lng:121.601},"台東":{lat:22.758,lng:121.144},"澎湖":{lat:23.571,lng:119.579},
    "金門":{lat:24.449,lng:118.377},"馬祖":{lat:26.16,lng:119.94},"阿里山":{lat:23.508,lng:120.801},"合歡山":{lat:24.143,lng:121.271},"墾丁":{lat:21.944,lng:120.796},
    "日月潭":{lat:23.852,lng:120.925},"清境":{lat:24.058,lng:121.156},"武陵":{lat:24.364,lng:121.314},"太平山":{lat:24.492,lng:121.536},"拉拉山":{lat:24.721,lng:121.422},
    "小琉球":{lat:22.343,lng:120.368},"綠島":{lat:22.661,lng:121.488},"蘭嶼":{lat:22.057,lng:121.532}
};

function extractCoordsFromUrl(url) {
    if (!url) return null;
    try {
        let match = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
        match = url.match(/[?&](q|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/);
        if (match) return { lat: parseFloat(match[2]), lng: parseFloat(match[3]) };
        match = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
        if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
    } catch(e) {}
    return null;
}

// 統一的地點解析函式
async function resolveLocationCoords(evt) {
    // 1. 導航網址提取精準座標
    let coords = extractCoordsFromUrl(evt.mapUrl);
    if (coords) return { coords, name: evt.location || '網址精準定位', source: 'url' };

    // 2. 地點關鍵字比對
    if (evt.location) {
        const matchKey = Object.keys(twLocationsMap).find(k => evt.location.includes(k));
        if (matchKey) return { coords: twLocationsMap[matchKey], name: matchKey, source: 'dict' };
        
        // 3. 快取
        if (window.geocache && window.geocache[evt.location]) {
            return { coords: window.geocache[evt.location], name: evt.location, source: 'cache' };
        }
        
        // 4. API 查詢 (強制優先篩選台灣)
        try {
            // 若沒有縣市關鍵字，強制補上台灣提高命中率
            const query = evt.location.includes('台') || evt.location.includes('縣') || evt.location.includes('市') ? evt.location : evt.location + ' 台灣';
            const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=10&language=zh`);
            const geo = await r.json();
            if (geo.results && geo.results.length > 0) {
                // 💡 防呆：強制尋找 country_code === 'TW' 的結果
                let best = geo.results.find(res => res.country_code === 'TW') || geo.results[0];
                const loc = { lat: best.latitude, lng: best.longitude };
                if (!window.geocache) window.geocache = {};
                window.geocache[evt.location] = loc;
                return { coords: loc, name: best.name, source: 'api' };
            }
        } catch(e) {}
    }
    return null;
}

// ============================================

function getLocalYMD(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

onSnapshot(eventsRef, (snapshot) => {
    events = [];
    snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        let sDate = data.startDate;
        let eDate = data.endDate || data.startDate;
        if (data.isLunarRecurring && data.lunarMonth && data.lunarDay) {
            try {
                const solar = Lunar.fromYmd(currentDate.getFullYear(), data.lunarMonth, data.lunarDay).getSolar();
                sDate = `${solar.getYear()}-${String(solar.getMonth()).padStart(2, '0')}-${String(solar.getDay()).padStart(2, '0')}`;
                eDate = sDate;
            } catch(e) {}
        }
        events.push({
            id: docSnap.id, title: data.title || '未命名活動', icon: data.icon || '',
            startDate: sDate, endDate: eDate, originalStart: data.startDate,
            isLunarRecurring: data.isLunarRecurring || false, lunarMonth: data.lunarMonth || null, lunarDay: data.lunarDay || null,
            author: data.author || '家族成員', color: data.color || 'bg-rose-400',
            photoUrl: data.photoUrl || null, videoUrl: data.videoUrl || null, fileUrl: data.fileUrl || null,
            location: data.location || '', mapUrl: data.mapUrl || '',
            isChecklist: data.isChecklist || false, checklist: data.checklist || [],
            isPoll: data.isPoll || false, pollOptions: (data.pollOptions || []).map(o => ({ title: o.title, voters: o.voters || [] })),
            isExpense: data.isExpense || false, payers: data.payers || [], sharers: data.sharers || [],
            isWide: data.isWide || false
        });
    });
    renderApp();
    
    if (document.getElementById('map-modal') && !document.getElementById('map-modal').classList.contains('hidden')) {
        renderFootprintMap();
    }
    
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
    const todayStr = getLocalYMD(new Date());

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

    const isGovHoliday = dayEvents.some(e => e.author === '政府行事曆');
    const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
    const isRedDay = isWeekend || isGovHoliday;

    let cellBgClass = isToday ? 'bg-warm-50' : (isRedDay ? 'bg-rose-50/80 border-rose-200' : 'bg-white');
    let isSelected = (dateStr === activeCellDate);
    let activeRingClass = isSelected ? 'ai-active-cell transition-all duration-300' : '';

    const todayObj2 = new Date();
    const todayS = getLocalYMD(todayObj2);
    const tomorrowObj2 = new Date(todayObj2); tomorrowObj2.setDate(tomorrowObj2.getDate() + 1);
    const tomorrowS = getLocalYMD(tomorrowObj2);

    let hasWeatherAlert = false;
    if (dateStr === todayS || dateStr === tomorrowS) {
        hasWeatherAlert = dayEvents.some(e => e.location && Object.keys(activeCWAAlerts).some(city => e.location.includes(city)));
    }

    if (hasWeatherAlert) {
        cellBgClass = 'bg-rose-50 border-rose-400';
        activeRingClass += ' ring-2 ring-rose-500 shadow-md'; 
    }

    const cell = document.createElement('div');
    cell.className = `day-cell border border-warm-100 rounded-xl p-1 flex flex-col gap-1 cursor-pointer relative ${cellBgClass} ${activeRingClass}`;
    
    cell.addEventListener('click', () => {
        document.querySelectorAll('.day-cell').forEach(c => c.classList.remove('ai-active-cell', 'transition-all', 'duration-300'));
        cell.classList.add('ai-active-cell', 'transition-all', 'duration-300');
        activeCellDate = dateStr;
        openDayModal(dateStr);
    });
    
    let dateNumColor = isToday ? 'bg-warm-500 text-white shadow-sm' : (isRedDay ? 'text-rose-600 font-extrabold' : 'text-gray-600');
    
    const [y, m, d] = dateStr.split('-').map(Number);
    const lunar = Lunar.fromDate(dateObj); 
    let lunarText = lunar.getDayInChinese(); 
    let isLunarHighlight = (lunarText === '初一' || lunarText === '十五');
    
    const festivals = lunar.getFestivals();
    const jieQi = lunar.getJieQi();
    
    if (festivals.length > 0) {
        lunarText = festivals[0];
        isLunarHighlight = true;
    } else if (jieQi) {
        lunarText = jieQi;
        isLunarHighlight = true;
    }
    
    const lunarStyle = isLunarHighlight ? 'text-rose-500 font-bold' : 'text-gray-400 font-medium';
    
    const alertBadgeHtml = hasWeatherAlert ? `<div class="absolute -top-1.5 -right-1.5 flex h-4 w-4 z-20"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span><span class="relative inline-flex rounded-full h-4 w-4 bg-rose-600 text-white text-[8px] items-center justify-center"><i class="fas fa-exclamation-triangle"></i></span></div>` : '';

    cell.innerHTML = `
        ${alertBadgeHtml}
        <div class="flex flex-col px-0.5 w-full shrink-0">
            <div class="flex justify-between items-start w-full">
                <span class="text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full ${dateNumColor} shrink-0">${dayNum}</span>
                <span class="text-[9px] ${lunarStyle} whitespace-nowrap pt-0.5">${lunarText}</span>
            </div>
            <span class="text-[8.5px] md:text-[9px] text-blue-500 leading-tight mt-0.5 whitespace-normal break-words">${weatherData[dateStr] || ''}</span>
        </div>`;

    const container = document.createElement('div');
    container.className = 'flex flex-col gap-0.5 overflow-y-auto flex-1 hide-scrollbar';
    dayEvents.forEach(evt => {
        const pollBadge = evt.isPoll ? ` <i class="fas fa-poll text-[9px]"></i>` : '';
        const el = document.createElement('div');
        el.className = `${evt.color} text-white text-xs md:text-sm font-bold px-1.5 py-1 rounded md:rounded-md shadow-sm transition-transform hover:scale-[1.02] leading-tight whitespace-normal break-words`;
        el.innerHTML = `${evt.icon ? evt.icon + ' ' : ''}${evt.title}${pollBadge}`;
        el.addEventListener('click', (ev) => { 
            ev.stopPropagation(); 
            document.querySelectorAll('.day-cell').forEach(c => c.classList.remove('ai-active-cell', 'transition-all', 'duration-300'));
            cell.classList.add('ai-active-cell', 'transition-all', 'duration-300');
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
    
    const dayEvts = events.filter(e => {
        const inRange = dateStr >= e.startDate && dateStr <= e.endDate;
        if (!inRange) return false;
        if (!searchQuery) return true;
        return (e.title && e.title.toLowerCase().includes(searchQuery)) || 
               (e.author && e.author.toLowerCase().includes(searchQuery)) || 
               (e.location && e.location.toLowerCase().includes(searchQuery));
    });

    if (dayEvts.length === 0) {
        list.innerHTML = '<p class="text-center text-gray-400 text-sm py-4">這一天沒有符合的行程</p>';
    } else {
        dayEvts.forEach(evt => {
            const item = document.createElement('div');
            item.className = 'p-3 rounded-xl border bg-warm-50/50 cursor-pointer flex justify-between items-center';
            const pollIcon = evt.isPoll ? ` <i class="fas fa-poll text-indigo-500"></i>` : '';
            item.innerHTML = `<div class="flex items-center gap-2"><div class="w-3 h-3 rounded-full ${evt.color}"></div><span class="font-bold text-sm">${evt.icon ? evt.icon + ' ' : ''}${evt.title}${pollIcon}</span></div><i class="fas fa-chevron-right text-xs text-gray-300"></i>`;
            item.addEventListener('click', () => { closeDayModal(); openViewModal(evt.id); });
            list.appendChild(item);
        });
    }
    document.getElementById('day-modal').classList.remove('hidden');
}
function closeDayModal() { document.getElementById('day-modal').classList.add('hidden'); }

function renderUpcoming() {
    const container = document.getElementById('upcoming-events');
    const empty = document.getElementById('no-upcoming');
    container.innerHTML = '';
    const todayObj = new Date(); todayObj.setHours(0, 0, 0, 0);
    const todayStr = getLocalYMD(todayObj);
    
    const upcoming = events.filter(e => {
        if (e.endDate < todayStr) return false;
        if (!searchQuery) return true;
        return (e.title && e.title.toLowerCase().includes(searchQuery)) || 
               (e.author && e.author.toLowerCase().includes(searchQuery)) || 
               (e.location && e.location.toLowerCase().includes(searchQuery));
    }).sort((a, b) => a.startDate.localeCompare(b.startDate)).slice(0, 5);
    
    empty.classList.toggle('hidden', upcoming.length > 0);
    upcoming.forEach(evt => {
        const el = document.createElement('div');
        el.className = 'bg-white p-3 md:p-4 rounded-xl border shadow-sm cursor-pointer flex items-center gap-3 md:gap-4 hover:bg-warm-50 transition-colors';
        el.addEventListener('click', () => openViewModal(evt.id));

        const [sY, sM, sD] = evt.startDate.split('-').map(Number);
        const startObj = new Date(sY, sM - 1, sD);
        const diffDays = Math.round((startObj - todayObj) / (1000 * 60 * 60 * 24));
        
        let countdownHtml = '';
        if (diffDays <= 0) countdownHtml = `<span class="px-2.5 py-1 bg-rose-500 text-white rounded-full text-xs font-extrabold animate-pulse">🎉 今天</span>`;
        else if (diffDays === 1) countdownHtml = `<span class="px-2.5 py-1 bg-orange-500 text-white rounded-full text-xs font-bold">🔥 明天</span>`;
        else if (diffDays <= 7) countdownHtml = `<span class="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-bold">⏳ 倒數 ${diffDays} 天</span>`;
        else countdownHtml = `<span class="px-2.5 py-1 bg-gray-100 text-gray-500 rounded-full text-xs font-bold">還有 ${diffDays} 天</span>`;

        const [y, m, d] = evt.startDate.split('-');
        el.innerHTML = `
            <div class="${evt.color} text-white rounded-xl w-12 h-12 md:w-14 md:h-14 flex flex-col items-center justify-center shrink-0 shadow-sm">
                <span class="text-[10px] md:text-xs">${m}月</span><span class="text-base md:text-xl font-bold">${d}</span>
            </div>
            <div class="flex-1 truncate">
                <div class="flex justify-between items-center gap-2">
                    <h4 class="font-bold text-gray-800 text-sm md:text-base truncate">${evt.icon ? evt.icon + ' ' : ''}${evt.title}</h4>
                    ${countdownHtml}
                </div>
                <span class="text-xs md:text-sm text-gray-500 mt-1 block">${evt.startDate}</span>
            </div>`;
        container.appendChild(el);
    });
}

const goToToday = () => {
    triggerHaptic();
    const now = new Date();
    currentDate = new Date(); 
    activeCellDate = getLocalYMD(now);
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

const photoUrlInput = document.getElementById('event-photo-url');
if(photoUrlInput) {
    photoUrlInput.addEventListener('input', (e) => {
        const val = e.target.value.trim();
        const previewBox = document.getElementById('photo-preview');
        const imgEl = previewBox.querySelector('img');
        if (val) { imgEl.src = getDirectImageUrl(val); previewBox.classList.remove('hidden'); } 
        else { previewBox.classList.add('hidden'); imgEl.src = ''; }
    });
    
    document.getElementById('btn-remove-photo').addEventListener('click', () => {
        triggerHaptic();
        document.getElementById('event-photo-url').value = '';
        document.getElementById('photo-preview').classList.add('hidden');
        document.querySelector('#photo-preview img').src = '';
    });
}

function openModal(id = null) {
    document.getElementById('event-form').reset();
    document.getElementById('event-photo-url').value = '';
    document.getElementById('event-video-url').value = '';
    document.getElementById('photo-preview').classList.add('hidden');
    document.getElementById('event-file-url').value = '';
    document.getElementById('event-location').value = '';
    document.getElementById('event-map-url').value = '';
    
    document.getElementById('event-is-wide').checked = false;

    checklistCheckbox.checked = false; checklistFields.classList.add('hidden'); checklistContainer.innerHTML = '';
    pollCheckbox.checked = false; pollFields.classList.add('hidden'); pollOptionsContainer.innerHTML = '';
    expenseCheckbox.checked = false; expenseFields.classList.add('hidden'); payersContainer.innerHTML = ''; sharersContainer.innerHTML = '';

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
            document.getElementById('event-is-lunar-recurring').checked = evt.isLunarRecurring || false;
            document.querySelector(`input[name="event-color"][value="${evt.color}"]`).checked = true;
            
            if (evt.isWide) document.getElementById('event-is-wide').checked = true;

            if (evt.photoUrl) {
                document.getElementById('event-photo-url').value = evt.photoUrl;
                document.querySelector('#photo-preview img').src = getDirectImageUrl(evt.photoUrl);
                document.getElementById('photo-preview').classList.remove('hidden');
            }
            if (evt.videoUrl) document.getElementById('event-video-url').value = evt.videoUrl;
            if (evt.fileUrl) document.getElementById('event-file-url').value = evt.fileUrl;
            if (evt.location) document.getElementById('event-location').value = evt.location;
            if (evt.mapUrl) document.getElementById('event-map-url').value = evt.mapUrl;
            
            if (evt.isChecklist && evt.checklist) {
                checklistCheckbox.checked = true; checklistFields.classList.remove('hidden');
                evt.checklist.forEach(item => addChecklistRow(item.text, item.assignee, item.done));
            }
            if (evt.isPoll && evt.pollOptions) {
                pollCheckbox.checked = true; pollFields.classList.remove('hidden');
                evt.pollOptions.forEach(o => addPollOptionRow(o.title));
            }
            if (evt.isExpense) {
                expenseCheckbox.checked = true; expenseFields.classList.remove('hidden');
                (evt.payers || []).forEach(p => addPayerRow(p.name, p.amount, p.note));
                (evt.sharers || []).forEach(s => addSharerRow(s.name, s.weight));
            }
        }
    } else {
        document.getElementById('modal-title').innerText = '新增活動'; document.getElementById('btn-delete').classList.add('hidden');
        document.getElementById('event-start-date').value = getLocalYMD(currentDate);
        authorSelect.innerHTML = getMemberOptions('', '請選擇建立者...');
    }
    document.getElementById('event-modal').classList.remove('hidden');
}
function closeModal() { document.getElementById('event-modal').classList.add('hidden'); }

// ============================================
// 🚨 天氣模組使用共用定位解析引擎
// ============================================

function openViewModal(id) {
    const evt = events.find(e => e.id === id);
    if (!evt) return;
    currentViewingId = id;
    document.getElementById('view-modal-header').className = `h-20 w-full ${evt.color}`;
    document.getElementById('view-title').innerText = (evt.icon ? evt.icon + ' ' : '') + evt.title;
    document.getElementById('view-date').innerText = evt.startDate === evt.endDate ? evt.startDate : `${evt.startDate} ~ ${evt.endDate}`;
    
    document.getElementById('view-author').innerHTML = `建立者：${getMemberEmoji(evt.author)} ${evt.author}`;

    const pBox = document.getElementById('view-photo-container');
    if (evt.photoUrl) { pBox.classList.remove('hidden'); document.getElementById('view-photo').src = getDirectImageUrl(evt.photoUrl); } else pBox.classList.add('hidden');

    const vBox = document.getElementById('view-video-container');
    const vIframe = document.getElementById('view-video-iframe');
    const vElement = document.getElementById('view-video-element');
    
    if (evt.videoUrl) {
        let url = evt.videoUrl.trim(); 
        vIframe.classList.add('hidden'); 
        vElement.classList.add('hidden');
        
        vBox.style.cssText = "width: 100%; aspect-ratio: 16/9; background: #000; border-radius: 0.75rem; overflow: margin-top: 0.75rem; position: relative;";
        vIframe.style.cssText = "position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none;";
        vIframe.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture');
        vIframe.setAttribute('allowfullscreen', 'true');
        vElement.style.cssText = "position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: contain; outline: none;";
        vElement.setAttribute('controls', 'true');
        
        let ytId = '';
        if (url.includes('youtube.com/watch?v=')) {
            ytId = new URL(url).searchParams.get('v');
        } else if (url.includes('youtu.be/')) {
            ytId = url.split('youtu.be/')[1].split('?')[0];
        } else if (url.includes('youtube.com/shorts/')) {
            ytId = url.split('youtube.com/shorts/')[1].split('?')[0];
            vBox.style.cssText = "width: 100%; max-width: 320px; aspect-ratio: 9/16; background: #000; border-radius: 0.75rem; overflow: hidden; margin: 0.75rem auto; position: relative;";
        }

        if (ytId) {
            vIframe.src = `https://www.youtube.com/embed/${ytId}?rel=0&playsinline=1`;
            vIframe.classList.remove('hidden');
        } else if (url.includes('drive.google.com')) {
            let fileId = '';
            if (url.includes('/d/')) fileId = url.split('/d/')[1].split('/')[0];
            else if (url.includes('id=')) fileId = new URL(url).searchParams.get('id');
            if (fileId) { vIframe.src = `https://drive.google.com/file/d/${fileId}/preview`; vIframe.classList.remove('hidden'); } 
            else { vIframe.src = url; vIframe.classList.remove('hidden'); }
        } else {
            vElement.src = url; 
            vElement.classList.remove('hidden');
        }
        vBox.classList.remove('hidden');
    } else { 
        vBox.classList.add('hidden'); 
        vIframe.src = ''; 
        vElement.src = '';
        vBox.style.cssText = "";
    }

    const fBox = document.getElementById('view-file-container');
    if (evt.fileUrl) { fBox.classList.remove('hidden'); document.getElementById('view-file-link').href = evt.fileUrl; } else fBox.classList.add('hidden');

    const mMapBox = document.getElementById('view-map-container');
    const mMapLink = document.getElementById('view-map-link');
    const mLocText = document.getElementById('view-location-text');
    
    let weatherBox = document.getElementById('view-weather-box');
    if (!weatherBox) {
        weatherBox = document.createElement('div');
        weatherBox.id = 'view-weather-box';
        mMapBox.appendChild(weatherBox);
    }
    weatherBox.classList.add('hidden');
    weatherBox.className = 'w-full py-2.5 bg-sky-50 text-sky-800 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 shadow-sm mt-2 px-2 text-center transition-all';

    if (evt.mapUrl || evt.location) {
        mLocText.innerText = evt.location || '點擊開啟地圖導航';
        mMapLink.href = evt.mapUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(evt.location)}`;
        mMapBox.classList.remove('hidden');

        if (evt.startDate) {
            weatherBox.classList.remove('hidden');
            weatherBox.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 正在為您精準定位查詢氣象...';
            
            // 使用共用定位解析引擎
            resolveLocationCoords(evt).then(result => {
                if (!result) throw new Error('Location not found');
                
                return fetch(`https://api.open-meteo.com/v1/forecast?latitude=${result.coords.lat}&longitude=${result.coords.lng}&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=Asia%2FTaipei&forecast_days=16&past_days=7`)
                    .then(r => r.json())
                    .then(wData => ({ wData, locName: result.name }));
            })
            .then(({ wData, locName }) => {
                const idx = wData.daily.time.indexOf(evt.startDate);
                if (idx !== -1 && wData.daily.temperature_2m_max[idx] !== null) {
                    const wCode = wData.daily.weathercode[idx];
                    const desc = weatherDescMap[wCode] || '☁️ 未知';
                    const isRainy = [51,53,55,61,63,65,80,81,82,95].includes(wCode);
                    const max = Math.round(wData.daily.temperature_2m_max[idx]);
                    const min = Math.round(wData.daily.temperature_2m_min[idx]);
                    let weatherTips = isRainy ? "預計有雨，記得帶傘或雨棚！" : "天氣不錯喔！";

                    let localAlert = null;
                    for (const city in activeCWAAlerts) {
                        if ((evt.location && evt.location.includes(city)) || locName.includes(city)) {
                            localAlert = activeCWAAlerts[city]; 
                            break;
                        }
                    }

                    const todayS = getLocalYMD(new Date());
                    const tObj = new Date(); tObj.setDate(tObj.getDate() + 1);
                    const tomorrowS = getLocalYMD(tObj);
                    const isTodayOrTomorrow = (evt.startDate === todayS || evt.startDate === tomorrowS);

                    if (localAlert && isTodayOrTomorrow) {
                        weatherBox.className = 'w-full py-2.5 bg-rose-100 text-rose-900 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 shadow-md mt-2 px-2 text-center ring-2 ring-rose-500 animate-pulse transition-all';
                        weatherBox.innerHTML = `
                            <div class="flex flex-col items-center">
                                <div class="flex items-center gap-1.5 text-rose-700 font-black"><i class="fas fa-exclamation-triangle text-base"></i> 氣象署特報生效中</div>
                                <div class="text-base mt-0.5">${desc} | ${min}~${max}°C</div>
                                <div class="bg-rose-600 text-white text-[11px] px-2.5 py-0.5 rounded-full mt-1 animate-bounce shadow-sm">${localAlert}</div>
                            </div>
                        `;
                    } else if (isRainy) {
                        weatherBox.className = 'w-full py-2.5 bg-indigo-100 text-indigo-900 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 shadow-md mt-2 px-2 text-center ring-2 ring-indigo-400 animate-pulse transition-all';
                        weatherBox.innerHTML = `
                            <div class="flex flex-col items-center">
                                <div class="flex items-center gap-1.5"><i class="fas fa-map-marker-alt"></i> 成功定位 [${locName}]</div>
                                <div class="text-base mt-0.5">${desc} | ${min}~${max}°C</div>
                                <div class="text-[11px] opacity-80 mt-0.5">${weatherTips}</div>
                            </div>
                        `;
                    } else {
                        weatherBox.className = 'w-full py-2.5 bg-sky-50 text-sky-800 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 shadow-sm mt-2 px-2 text-center transition-all';
                        weatherBox.innerHTML = `
                            <div class="flex flex-col items-center">
                                <div class="flex items-center gap-1.5"><i class="fas fa-map-marker-alt"></i> 成功定位 [${locName}]</div>
                                <div class="text-base mt-0.5">${desc} | ${min}~${max}°C</div>
                                <div class="text-[11px] opacity-80 mt-0.5">${weatherTips}</div>
                            </div>
                        `;
                    }
                } else {
                    const tDate = new Date(evt.startDate);
                    const nDate = new Date();
                    const diff = Math.ceil((tDate - nDate) / (1000 * 60 * 60 * 24));
                    if (diff > 14) {
                        weatherBox.innerHTML = `<i class="fas fa-calendar-check text-sky-600"></i> 已定位 [${evt.location||'此地點'}]：預報僅支援14天內，快出發時再來看！`;
                    } else if (diff < -7) {
                        weatherBox.innerHTML = `<i class="fas fa-history text-sky-600"></i> 已定位 [${evt.location||'此地點'}]：這是過去的行程囉。`;
                    } else {
                        weatherBox.innerHTML = `<i class="fas fa-info-circle text-sky-600"></i> 已定位 [${evt.location||'此地點'}]：當日無氣象資料。`;
                    }
                }
            })
            .catch(() => {
                weatherBox.innerHTML = `<i class="fas fa-search-location text-amber-600"></i> 查無定位，請貼上含 @經緯度 完整導航網址或加上縣市`;
                weatherBox.className = 'w-full py-2.5 bg-amber-50 text-amber-800 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 shadow-sm mt-2 px-2 text-center';
            });
        }
    } else { 
        mMapBox.classList.add('hidden'); 
    }

    const checkContainer = document.getElementById('view-checklist-container');
    const checkItems = document.getElementById('view-checklist-items');
    const checkProgress = document.getElementById('view-checklist-progress');
    if (evt.isChecklist && evt.checklist && evt.checklist.length > 0) {
        checkItems.innerHTML = ''; let doneCount = 0;
        evt.checklist.forEach((item, idx) => {
            if (item.done) doneCount++;
            const row = document.createElement('label');
            row.className = 'flex items-center justify-between bg-white p-2 rounded-xl border cursor-pointer';
            row.innerHTML = `
                <div class="flex items-center gap-2">
                    <input type="checkbox" ${item.done ? 'checked' : ''} class="w-4 h-4 text-emerald-600 rounded cursor-pointer">
                    <span class="${item.done ? 'line-through text-gray-400' : 'text-gray-700 font-bold'}">${item.text}</span>
                </div>
                <span class="text-[10px] bg-warm-50 text-warm-700 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">${getMemberEmoji(item.assignee)} ${item.assignee || '未認領'}</span>
            `;
            row.querySelector('input').addEventListener('change', async (e) => {
                let updatedChecklist = [...evt.checklist]; updatedChecklist[idx].done = e.target.checked;
                await updateDoc(doc(eventsRef, evt.id), { checklist: updatedChecklist });
                
                const newDoneCount = updatedChecklist.filter(i => i.done).length;
                if (newDoneCount === evt.checklist.length && window.confetti) {
                    confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, zIndex: 9999 });
                }
            });
            checkItems.appendChild(row);
        });
        checkProgress.innerText = `${doneCount}/${evt.checklist.length}`; checkContainer.classList.remove('hidden');
    } else { checkContainer.classList.add('hidden'); }

    const pollContainer = document.getElementById('view-poll-container');
    const pollOptionsEl = document.getElementById('view-poll-options');
    const voterSelect = document.getElementById('poll-voter-select');
    const finalizeBtn = document.getElementById('btn-finalize-poll');
    const votedMembersBanner = document.getElementById('voted-members-banner');

    if (evt.isPoll && evt.pollOptions && evt.pollOptions.length > 0) {
        pollOptionsEl.innerHTML = '';
        let allVotedMembersSet = new Set();
        evt.pollOptions.forEach(opt => opt.voters.forEach(name => allVotedMembersSet.add(name)));
        const allVotedMembersArr = Array.from(allVotedMembersSet);

        voterSelect.innerHTML = '<option value="" disabled selected>請選擇您是哪位成員...</option>';
        familyMembers.forEach(m => {
            const hasVoted = allVotedMembersArr.includes(m.name);
            const opt = document.createElement('option');
            opt.value = m.name;
            if (hasVoted) { opt.disabled = true; opt.textContent = `${m.emoji} ${m.name} (已投票)`; } else opt.textContent = `${m.emoji} ${m.name}`;
            voterSelect.appendChild(opt);
        });

        const voter = voterSelect.value;
        const votedWithEmoji = allVotedMembersArr.map(name => `${getMemberEmoji(name)}${name}`);
        votedMembersBanner.innerHTML = allVotedMembersArr.length > 0 ? `<i class="fas fa-check-circle text-emerald-600 mr-1"></i> 已投票：<strong>${votedWithEmoji.join(', ')}</strong>` : `<i class="far fa-clock text-indigo-500 mr-1"></i> 尚無成員投票`;

        let maxVotes = -1; evt.pollOptions.forEach(opt => { if (opt.voters.length > maxVotes) maxVotes = opt.voters.length; });

        evt.pollOptions.forEach((opt, idx) => {
            const row = document.createElement('div');
            row.className = 'bg-white p-2.5 rounded-xl border flex flex-col gap-1.5 shadow-sm';
            const isWinner = maxVotes > 0 && opt.voters.length === maxVotes;
            row.innerHTML = `
                <div class="flex justify-between items-center">
                    <span class="font-bold text-gray-800 flex items-center gap-1.5">${opt.title} ${isWinner ? '<span class="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full font-extrabold">👑 最高票</span>' : ''}</span>
                    <button class="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg text-xs font-bold transition-all active:scale-95 shadow-sm">投一票 (${opt.voters.length} 票)</button>
                </div>`;
            row.querySelector('button').addEventListener('click', async () => {
                const currentVoter = voterSelect.value;
                if (!currentVoter) return alert('請先在上方選擇您是哪位成員！');
                let updated = evt.pollOptions.map(o => ({ title: o.title, voters: [...o.voters] }));
                updated.forEach(o => o.voters = o.voters.filter(n => n !== currentVoter));
                updated[idx].voters.push(currentVoter);
                await updateDoc(doc(eventsRef, evt.id), { pollOptions: updated });
            });
            pollOptionsEl.appendChild(row);
        });

        finalizeBtn.onclick = async () => {
            const winnerOpt = evt.pollOptions.reduce((prev, curr) => (curr.voters.length > prev.voters.length) ? curr : prev);
            if (!winnerOpt || winnerOpt.voters.length === 0) return alert('目前還沒有人投票喔！');
            if (confirm(`【家族投票總結報告】\n\n🎯 最高票勝出選項：${winnerOpt.title}\n📊 獲得票數：${winnerOpt.voters.length} 票\n\n確定要將此結果拍板定案為正式行程標題嗎？`)) {
                await updateDoc(doc(eventsRef, evt.id), { title: winnerOpt.title, isPoll: false });
                alert('🎉 已成功將最高票拍板定案！'); 
                document.getElementById('view-modal').classList.add('hidden');
                if (window.confetti) confetti({ particleCount: 200, spread: 100, origin: { y: 0.5 }, zIndex: 9999 });
            }
        };
        pollContainer.classList.remove('hidden');
    } else pollContainer.classList.add('hidden');

    const expenseContainer = document.getElementById('view-expense-container');
    const expenseDetails = document.getElementById('view-expense-details');
    if (evt.isExpense && evt.payers && evt.payers.length > 0) {
        let balances = {};
        let totalExpense = 0;

        evt.payers.forEach(p => {
            let amt = parseFloat(p.amount) || 0;
            balances[p.name] = (balances[p.name] || 0) + amt;
            totalExpense += amt;
        });

        let totalWeight = (evt.sharers || []).reduce((sum, s) => sum + (parseFloat(s.weight) || 1), 0) || 1;
        let perWeightAmount = totalExpense / totalWeight;

        (evt.sharers || []).forEach(s => {
            let shareAmt = perWeightAmount * (parseFloat(s.weight) || 1);
            balances[s.name] = (balances[s.name] || 0) - shareAmt;
        });

        let debtors = [];
        let creditors = [];
        for (let name in balances) {
            let b = Math.round(balances[name]);
            if (b < -1) debtors.push({ name, amount: -b });
            else if (b > 1) creditors.push({ name, amount: b });
        }

        let transactions = [];
        let d = 0, c = 0;
        while (d < debtors.length && c < creditors.length) {
            let debtor = debtors[d];
            let creditor = creditors[c];
            let settleAmount = Math.min(debtor.amount, creditor.amount);

            if (settleAmount > 0) {
                transactions.push({ from: debtor.name, to: creditor.name, amount: settleAmount });
            }

            debtor.amount -= settleAmount;
            creditor.amount -= settleAmount;

            if (debtor.amount === 0) d++;
            if (creditor.amount === 0) c++;
        }

        let detailsHtml = `<div class="mb-3 space-y-1.5 bg-white/60 p-2.5 rounded-xl border border-amber-200/60 shadow-sm">
                            <div class="text-[11px] font-bold text-amber-800 mb-1 flex items-center gap-1"><i class="fas fa-clipboard-list"></i> 代墊明細紀錄：</div>`;
        evt.payers.forEach(p => {
            detailsHtml += `<div class="flex justify-between items-center text-xs">
                                <span class="text-gray-700"><strong>${getMemberEmoji(p.name)} ${p.name}</strong> 墊付${p.note ? '：「<span class="text-amber-700 font-medium">'+p.note+'</span>」' : ''}</span>
                                <span class="font-bold text-amber-700">$${p.amount}</span>
                            </div>`;
        });
        detailsHtml += `</div>`;

        let html = detailsHtml + `<div class="font-bold border-b border-amber-200 pb-2 mb-2 flex justify-between items-center">
                        <span>總計產生支出：$${Math.round(totalExpense).toLocaleString()}</span>
                        <span class="text-[10px] bg-amber-200/70 text-amber-900 px-2 py-0.5 rounded-full"><i class="fas fa-balance-scale"></i> 互抵結算</span>
                    </div>
                    <div class="space-y-2">`;
                    
        if (transactions.length === 0) {
            html += `<div class="text-center text-sm text-gray-500 py-3">🎉 無須互相轉帳，帳目已完美平衡！</div>`;
        } else {
            transactions.forEach(t => {
                html += `
                    <div class="flex items-center justify-between bg-white p-3 rounded-xl border border-amber-100 shadow-sm">
                        <div class="flex flex-col">
                            <span class="font-bold text-sm text-gray-800">${getMemberEmoji(t.from)} ${t.from}</span>
                            <span class="text-xs text-gray-500 mt-0.5">應轉給 <strong class="text-gray-700">${getMemberEmoji(t.to)} ${t.to}</strong></span>
                        </div>
                        <div class="font-extrabold text-amber-600 text-base">
                            $${t.amount.toLocaleString()}
                        </div>
                    </div>`;
            });
        }
        html += `</div>`;
        
        expenseDetails.innerHTML = html; 
        expenseContainer.classList.remove('hidden');
    } else {
        expenseContainer.classList.add('hidden');
    }

    document.getElementById('view-modal').classList.add('hidden'); document.getElementById('view-modal').classList.remove('hidden');
}

document.getElementById('event-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    triggerHaptic();
    const titleVal = document.getElementById('event-title').value.trim();
    if (!titleVal) return alert('請輸入活動名稱！');

    const isRecurring = document.getElementById('event-is-lunar-recurring').checked;
    let lMonth = null, lDay = null; const startVal = document.getElementById('event-start-date').value;
    if (isRecurring && startVal) {
        const [y, m, d] = startVal.split('-').map(Number);
        const lunar = Solar.fromYmd(y, m, d).getLunar();
        lMonth = lunar.getMonth(); lDay = lunar.getDay();
    }

    let checklistArr = [];
    if (checklistCheckbox.checked) {
        document.querySelectorAll('.checklist-row').forEach(row => {
            const text = row.querySelector('.checklist-text').value.trim();
            const assignee = row.querySelector('.checklist-assignee').value.trim();
            const done = row.dataset.done === 'true';
            if (text) checklistArr.push({ text, assignee, done });
        });
    }

    let pollOpts = [];
    if (pollCheckbox.checked) {
        const existing = events.find(ev => ev.id === currentEditingId);
        document.querySelectorAll('.poll-row').forEach((row, idx) => {
            const t = row.querySelector('.poll-option-title').value.trim();
            if (t) {
                let voters = (existing && existing.pollOptions && existing.pollOptions[idx] && existing.pollOptions[idx].title === t) ? existing.pollOptions[idx].voters : [];
                pollOpts.push({ title: t, voters: voters });
            }
        });
    }

    let payersArr = []; let sharersArr = [];
    if (expenseCheckbox.checked) {
        document.querySelectorAll('.payer-row').forEach(row => {
            const name = row.querySelector('.payer-name').value.trim(); 
            const amount = parseFloat(row.querySelector('.payer-amount').value) || 0;
            const note = row.querySelector('.payer-note').value.trim();
            if (name && amount > 0) payersArr.push({ name, amount, note });
        });
        document.querySelectorAll('.sharer-row').forEach(row => {
            const name = row.querySelector('.sharer-name').value.trim(); const weight = parseFloat(row.querySelector('.sharer-weight').value) || 1;
            if (name) sharersArr.push({ name, weight });
        });
    }

    const isWideChecked = document.getElementById('event-is-wide').checked;

    const eventData = {
        title: titleVal, icon: document.getElementById('event-icon').value,
        startDate: startVal, endDate: document.getElementById('event-end-date').value || startVal,
        isLunarRecurring: isRecurring, lunarMonth: lMonth, lunarDay: lDay,
        author: document.getElementById('event-author').value.trim() || '家族成員',
        color: document.querySelector('input[name="event-color"]:checked').value,
        photoUrl: document.getElementById('event-photo-url').value.trim(),
        videoUrl: document.getElementById('event-video-url').value.trim(), fileUrl: document.getElementById('event-file-url').value.trim(),
        location: document.getElementById('event-location').value.trim(), mapUrl: document.getElementById('event-map-url').value.trim(),
        isChecklist: checklistCheckbox.checked && checklistArr.length > 0, checklist: checklistArr,
        isPoll: pollCheckbox.checked && pollOpts.length > 0, pollOptions: pollOpts,
        isExpense: expenseCheckbox.checked && payersArr.length > 0, payers: payersArr, sharers: sharersArr,
        isWide: isWideChecked
    };

    if (currentEditingId) { await updateDoc(doc(eventsRef, currentEditingId), eventData); } 
    else { await addDoc(eventsRef, eventData); }
    closeModal();
});

document.getElementById('btn-delete').addEventListener('click', async () => {
    if (currentEditingId && confirm('確定要刪除嗎？')) { await deleteDoc(doc(eventsRef, currentEditingId)); closeModal(); }
});

// === 家族足跡地圖：核心渲染機制 ===
function getMemberEmoji(name) {
    const member = familyMembers.find(m => m.name === name);
    return member ? (member.emoji || '👤') : '👤';
}

document.getElementById('btn-open-map').addEventListener('click', () => {
    triggerHaptic();
    document.getElementById('map-modal').classList.remove('hidden');
    renderFootprintMap();
    if (window.innerWidth < 768 && !document.getElementById('sidebar').classList.contains('-translate-x-full')) {
        toggleSidebar(); 
    }
});

document.getElementById('btn-close-map').addEventListener('click', () => {
    triggerHaptic();
    document.getElementById('map-modal').classList.add('hidden');
});

function renderFootprintMap() {
    if (!footprintMap) {
        footprintMap = L.map('map-container').setView([23.7, 120.9], 7);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 18
        }).addTo(footprintMap);
        mapMarkersLayer = L.layerGroup().addTo(footprintMap);
    }
    
    mapMarkersLayer.clearLayers();
    setTimeout(() => { footprintMap.invalidateSize(); }, 300);

    if (!window.geocache) window.geocache = {};

    events.forEach(evt => {
        if (!evt.location && !evt.mapUrl) return;

        resolveLocationCoords(evt).then(result => {
            if (result) {
                addMarkerToMap(result.coords, evt);
            }
        });
    });
}

function addMarkerToMap(coords, evt) {
    // 💡 防重疊微調機制：加入極微小的隨機偏移 (約幾十公尺)
    // 這樣就算去了同一個營地好幾次，圖釘也不會完全疊在一起點不到！
    const jitterLat = coords.lat + (Math.random() - 0.5) * 0.0006;
    const jitterLng = coords.lng + (Math.random() - 0.5) * 0.0006;
    
    const marker = L.marker([jitterLat, jitterLng]).addTo(mapMarkersLayer);
    
    let imgHtml = '';
    if (evt.photoUrl) {
        imgHtml = `<img src="${getDirectImageUrl(evt.photoUrl)}" class="w-full h-24 object-cover rounded mt-2 mb-2 shadow-sm">`;
    }
    
    const popupContent = `
        <div class="text-center w-48 font-sans">
            <div class="font-extrabold text-sm text-gray-800">${evt.icon || ''} ${evt.title}</div>
            <div class="text-[10px] text-gray-500 font-bold mb-1">${evt.startDate}</div>
            ${imgHtml}
            <button class="w-full bg-emerald-500 text-white text-xs font-bold py-1.5 rounded mt-1 shadow-sm active:scale-95 transition-transform" 
                onclick="document.getElementById('map-modal').classList.add('hidden'); openViewModal('${evt.id}')">
                查看行程
            </button>
        </div>
    `;
    marker.bindPopup(popupContent);
}

// === 家族專屬：固定吸附式電台播放器 ===
function initRadioPlayer() {
    if (document.getElementById('radio-widget')) return;

    let stations = [
        { name: "🎤 A-Lin 抒情金曲串燒 (YouTube)", url: "https://www.youtube.com/watch?v=BkSSOGNeWTM", type: "live" },
        { name: "🏠 露營家族背景音樂 (Suno)", url: "https://github.com/magician780-collab/family-calendar/raw/refs/heads/main/%E9%9C%B2%E7%87%9F%E5%AE%B6%E6%97%8F%E8%83%8C%E6%99%AF%E9%9F%B3%E6%A8%82.mp3", type: "bgm" },
        { name: "📻 A-Line 青春電台 (FM 98.7)", url: "https://www.youtube.com/watch?v=jfKfPfyJRdk", type: "live" },
        { name: "📻 城市廣播網 (FM 97.1)", url: "https://onair.family977.com.tw:8977/live.mp3", type: "live" }
    ];

    try {
        const customStations = JSON.parse(localStorage.getItem('my_custom_stations') || '[]');
        stations = [...stations, ...customStations];
    } catch (e) {}

    let currentStationIdx = 0;
    let hlsInstance = null; 
    let isPlaying = false;
    let isExpanded = true;

    const radioContainer = document.createElement('div');
    radioContainer.id = 'radio-widget';
    radioContainer.className = 'fixed right-4 bottom-24 md:bottom-8 z-[100] flex items-center bg-white/90 backdrop-blur-md rounded-full shadow-lg border border-warm-200 select-none transition-all duration-300 ease-in-out overflow-hidden';
    
    radioContainer.style.width = 'max-content';
    radioContainer.style.maxWidth = '300px';

    radioContainer.innerHTML = `
        <button id="btn-radio-toggle" class="w-10 h-10 shrink-0 flex items-center justify-center text-warm-500 hover:text-warm-700 bg-white/50 hover:bg-warm-100 transition-colors z-10 rounded-full cursor-pointer">
            <i class="fas fa-chevron-right text-xs transition-transform duration-300" id="radio-toggle-icon"></i>
        </button>
        <div id="radio-content" class="flex items-center gap-1.5 md:gap-2 pr-4 md:pr-4 py-1.5 md:py-2 opacity-100 transition-opacity duration-300 w-auto">
            <div id="btn-radio-play" class="relative flex items-center justify-center w-8 h-8 rounded-full bg-warm-100 hover:bg-warm-200 transition-colors shrink-0 cursor-pointer">
                <i id="radio-icon" class="fas fa-play text-warm-600 text-xs md:text-sm pl-0.5 pointer-events-none"></i>
            </div>
            <div class="flex flex-col justify-center min-w-[90px] max-w-[120px] pointer-events-none">
                <span id="radio-text" class="text-[10px] md:text-xs font-bold text-warm-700 truncate">${stations[0].name}</span>
                <span id="radio-status" class="text-[9px] md:text-[10px] text-warm-500 font-medium truncate">點擊播放</span>
            </div>
            <button id="btn-radio-menu" class="w-8 h-8 rounded-full text-warm-400 hover:text-warm-600 hover:bg-warm-50 flex items-center justify-center transition-colors shrink-0 cursor-pointer" title="開啟電台選單">
                <i class="fas fa-list-ul text-xs pointer-events-none"></i>
            </button>
        </div>
        <audio id="radio-audio" preload="none"></audio>
        <div id="yt-radio-container" class="absolute w-[1px] h-[1px] opacity-0 pointer-events-none overflow-hidden"></div>
    `;
    document.body.appendChild(radioContainer);

    const menuContainer = document.createElement('div');
    menuContainer.id = 'radio-menu';
    menuContainer.className = 'fixed right-4 bottom-[calc(6rem+40px)] md:bottom-[calc(2rem+50px)] z-[101] bg-white/95 backdrop-blur-lg border border-warm-200 rounded-2xl shadow-xl p-2 w-64 max-h-[60vh] overflow-y-auto hidden animate-fade-in flex flex-col gap-1 hide-scrollbar';
    document.body.appendChild(menuContainer);
    
    const audio = document.getElementById('radio-audio');
    const ytContainer = document.getElementById('yt-radio-container');
    const playBtn = document.getElementById('btn-radio-play');
    const menuBtn = document.getElementById('btn-radio-menu');
    const toggleBtn = document.getElementById('btn-radio-toggle');
    const contentArea = document.getElementById('radio-content');
    const toggleIcon = document.getElementById('radio-toggle-icon');
    
    const icon = document.getElementById('radio-icon');
    const text = document.getElementById('radio-text');
    const statusText = document.getElementById('radio-status');

    toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        triggerHaptic();
        isExpanded = !isExpanded;
        
        if (isExpanded) {
            radioContainer.style.maxWidth = '300px';
            contentArea.style.opacity = '1';
            contentArea.style.width = 'auto';
            contentArea.style.paddingRight = '1rem';
            toggleIcon.style.transform = 'rotate(0deg)'; 
        } else {
            radioContainer.style.maxWidth = '40px'; 
            contentArea.style.opacity = '0';
            contentArea.style.width = '0px';
            contentArea.style.paddingRight = '0px';
            toggleIcon.style.transform = 'rotate(180deg)'; 
            menuContainer.classList.add('hidden'); 
        }
    });

    function renderMenu() {
        menuContainer.innerHTML = '';
        stations.forEach((station, idx) => {
            const item = document.createElement('button');
            const isActive = (idx === currentStationIdx);
            item.className = `w-full text-left px-3 py-2 rounded-xl text-xs md:text-sm font-bold transition-colors flex items-center justify-between ${isActive ? 'bg-warm-50 text-warm-700' : 'text-gray-600 hover:bg-warm-50 hover:text-warm-700'}`;
            
            const isCustom = idx >= 4; 
            const deleteBtnHtml = isCustom ? `<i class="fas fa-trash-alt text-rose-400 hover:text-rose-600 ml-2" data-delete="${idx}"></i>` : '';

            item.innerHTML = `
                <div class="flex items-center truncate">
                    <span class="truncate pr-2">${station.name}</span>
                </div>
                <div class="flex items-center shrink-0">
                    <i class="fas fa-volume-up text-warm-500 ${isActive ? 'opacity-100' : 'opacity-0'}"></i>
                    ${deleteBtnHtml}
                </div>
            `;
            
            item.addEventListener('click', (e) => {
                e.stopPropagation(); 
                if (e.target.dataset.delete) {
                    if (confirm(`確定要刪除自訂電台「${station.name}」嗎？`)) {
                        stations.splice(idx, 1);
                        const customStations = stations.slice(4);
                        localStorage.setItem('my_custom_stations', JSON.stringify(customStations));
                        
                        if (currentStationIdx === idx) {
                            audio.pause();
                            ytContainer.innerHTML = '';
                            if(hlsInstance) hlsInstance.destroy();
                            isPlaying = false;
                            currentStationIdx = 0;
                            text.innerText = stations[0].name;
                            statusText.innerText = '點擊播放';
                            icon.className = 'fas fa-play text-warm-600 text-xs md:text-sm pl-0.5';
                            radioContainer.classList.remove('ring-2', 'ring-warm-400');
                        } else if (currentStationIdx > idx) currentStationIdx--;
                        
                        renderMenu();
                    }
                    return;
                }

                triggerHaptic();
                currentStationIdx = idx;
                renderMenu(); 
                loadAndPlayStation(idx);
                menuContainer.classList.add('hidden');
            });
            menuContainer.appendChild(item);
        });

        const addUrlBtn = document.createElement('button');
        addUrlBtn.className = 'w-full mt-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-500 rounded-xl text-xs md:text-sm font-bold border border-dashed border-gray-300 transition-colors flex items-center justify-center gap-1';
        addUrlBtn.innerHTML = '<i class="fas fa-link"></i> 輸入新電台/YouTube網址';
        addUrlBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const newName = prompt('請輸入新曲目名稱：');
            if (!newName) return;
            const newUrl = prompt('請貼上網址 (支援 YouTube 直播連結、.mp3 或 .m3u8)：\n例如：https://www.youtube.com/watch?v=...');
            if (!newUrl) return;
            
            const newStation = { name: '📺 ' + newName, url: newUrl, type: 'live' };
            stations.push(newStation);
            
            const custom = JSON.parse(localStorage.getItem('my_custom_stations') || '[]');
            custom.push(newStation);
            localStorage.setItem('my_custom_stations', JSON.stringify(custom));
            
            alert('🎉 新增成功！請在選單中點選播放。');
            renderMenu();
        });
        menuContainer.appendChild(addUrlBtn);
    }

    renderMenu();

    menuBtn.addEventListener('click', (e) => {
        e.stopPropagation(); 
        triggerHaptic();
        menuContainer.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
        if (!radioContainer.contains(e.target) && !menuContainer.contains(e.target)) {
            menuContainer.classList.add('hidden');
        }
    });

    function loadAndPlayStation(index) {
        const station = stations[index];
        text.innerText = station.name;
        audio.volume = 0.4;
        statusText.innerText = '連線中...';
        icon.className = 'fas fa-spinner fa-spin text-warm-600 text-xs md:text-sm';
        isPlaying = true;

        audio.pause();
        if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null; }
        ytContainer.innerHTML = '';

        const onPlaySuccess = () => {
            icon.className = 'fas fa-music text-warm-600 text-xs md:text-sm animate-bounce';
            statusText.innerText = '正在播放';
            radioContainer.classList.add('ring-2', 'ring-warm-400');
        };

        const onPlayError = (e) => {
            console.log('Stream Error:', e);
            statusText.innerText = '網址失效或阻擋連線';
            icon.className = 'fas fa-exclamation-triangle text-rose-500 text-xs md:text-sm';
            radioContainer.classList.remove('ring-2', 'ring-warm-400');
            isPlaying = false;
        };

        let isYouTube = false;
        let ytId = '';
        if (station.url.includes('youtube.com/watch?v=')) {
            isYouTube = true;
            ytId = new URL(station.url).searchParams.get('v');
        } else if (station.url.includes('youtu.be/')) {
            isYouTube = true;
            ytId = station.url.split('youtu.be/')[1].split('?')[0];
        }

        if (isYouTube && ytId) {
            ytContainer.innerHTML = `<iframe width="100" height="100" src="https://www.youtube.com/embed/${ytId}?autoplay=1&playsinline=1&enablejsapi=1" allow="autoplay"></iframe>`;
            setTimeout(onPlaySuccess, 1500); 
        } else if (station.url.includes('.m3u8') && typeof Hls !== 'undefined' && Hls.isSupported()) {
            hlsInstance = new Hls();
            hlsInstance.loadSource(station.url);
            hlsInstance.attachMedia(audio);
            hlsInstance.on(Hls.Events.MANIFEST_PARSED, function() {
                audio.play().then(onPlaySuccess).catch(onPlayError);
            });
            hlsInstance.on(Hls.Events.ERROR, function (event, data) {
                if (data.fatal) onPlayError(data);
            });
        } else {
            audio.src = station.url;
            audio.loop = (station.type === 'bgm'); 
            audio.play().then(onPlaySuccess).catch(onPlayError);
        }
    }

    playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        triggerHaptic();
        
        if (isPlaying) {
            audio.pause();
            ytContainer.innerHTML = ''; 
            icon.className = 'fas fa-play text-warm-600 text-xs md:text-sm pl-0.5';
            statusText.innerText = '已暫停';
            radioContainer.classList.remove('ring-2', 'ring-warm-400');
        } else {
            loadAndPlayStation(currentStationIdx);
        }
        isPlaying = !isPlaying;
    });

    audio.addEventListener('error', () => {
        if (isPlaying) {
            statusText.innerText = '電台斷線，請換台';
            icon.className = 'fas fa-exclamation-triangle text-rose-500 text-xs md:text-sm';
            isPlaying = false;
            radioContainer.classList.remove('ring-2', 'ring-warm-400');
        }
    });
}

function initFunAnimations() {
    if (document.getElementById('fun-animation-style')) return;
    
    if (!window.confetti) {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js';
        document.head.appendChild(script);
    }
    
    const style = document.createElement('style');
    style.id = 'fun-animation-style';
    style.innerHTML = `
    @keyframes driveCar { 0% { transform: translateX(120vw); } 100% { transform: translateX(-30vw); } }
    @keyframes bounceCar { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px) rotate(-1deg); } }
    @keyframes flyDrone { 0% { transform: translateX(-20vw) translateY(20px) rotate(5deg); } 25% { transform: translateX(30vw) translateY(-10px) rotate(0deg); } 50% { transform: translateX(70vw) translateY(15px) rotate(-5deg); } 100% { transform: translateX(120vw) translateY(-5px) rotate(0deg); } }
    
    .vehicle-wrapper { position: fixed; bottom: 90px; left: 0; z-index: 15; pointer-events: none; display: flex; align-items: flex-end; animation: driveCar 35s linear infinite; opacity: 0.85; }
    .vehicle-body { font-size: 3.5rem; animation: bounceCar 0.8s ease-in-out infinite; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.15)); position: relative; z-index: 2; }
    
    .drone-wrapper { position: fixed; top: 15%; left: 0; z-index: 15; pointer-events: none; display: flex; flex-direction: column; align-items: center; animation: flyDrone 45s linear infinite; opacity: 0.75; filter: drop-shadow(0 15px 5px rgba(0,0,0,0.2)); }
    .drone-body { font-size: 2.5rem; animation: bounceCar 1.5s ease-in-out infinite alternate; }
    
    .click-ripple { position: fixed; border-radius: 50%; border: 2px solid var(--color-500); width: 20px; height: 20px; transform: translate(-50%, -50%); pointer-events: none; z-index: 9999; animation: rippleAnim 0.5s ease-out forwards; }
    @keyframes rippleAnim { 0% { width: 0; height: 0; opacity: 0.8; } 100% { width: 60px; height: 60px; opacity: 0; border-width: 0px; } }
    `;
    document.head.appendChild(style);

    const vehicleDiv = document.createElement('div');
    vehicleDiv.className = 'vehicle-wrapper';
    const isTesla = Math.random() > 0.5;
    if (isTesla) {
        vehicleDiv.innerHTML = `<div class="vehicle-body">🚗</div><div style="font-size:1.5rem; margin-left: 10px; animation: bounceCar 0.5s infinite">⚡</div>`;
    } else {
        vehicleDiv.innerHTML = `<div style="position: relative;"><div class="vehicle-body">🚐</div></div><div style="font-size: 2rem; margin-left: 20px; margin-bottom: 2px; animation: bounceCar 0.5s infinite;">🐕</div>`;
    }
    document.body.appendChild(vehicleDiv);

    if (Math.random() > 0.7) {
        const droneDiv = document.createElement('div');
        droneDiv.className = 'drone-wrapper';
        droneDiv.innerHTML = `<div class="drone-body">🚁</div><div style="font-size:0.7rem; background:white; padding:2px 6px; border-radius:10px; margin-top:-5px; font-weight:bold; color:#666; display:flex; align-items:center; gap:3px;"><span class="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>REC</div>`;
        document.body.appendChild(droneDiv);
    }

    document.addEventListener('click', function(e) {
        if (e.target.closest('#radio-widget') || e.target.closest('#radio-menu')) return;
        let ripple = document.createElement('div');
        ripple.className = 'click-ripple';
        ripple.style.left = e.clientX + 'px';
        ripple.style.top = e.clientY + 'px';
        document.body.appendChild(ripple);
        setTimeout(() => ripple.remove(), 500);
    });
}

initRadioPlayer();
initFunAnimations();

const exportIcsBtn = document.createElement('button');
exportIcsBtn.id = 'btn-export-ics';
exportIcsBtn.className = 'w-full py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer mt-3';
exportIcsBtn.innerHTML = '<i class="fab fa-apple text-base"></i> 匯出至 Apple Watch (iOS 行事曆)';

const localExportBtn = document.createElement('button');
localExportBtn.id = 'btn-export-local-json';
localExportBtn.className = 'w-full py-2.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer border border-purple-200 mt-2';
localExportBtn.innerHTML = '<i class="fas fa-file-download"></i> 下載備份檔至本機 (手機/電腦)';

const btnExportJson = document.getElementById('btn-export-json');
if (btnExportJson) {
    const backupSection = btnExportJson.closest('.space-y-2');
    if (backupSection) {
        backupSection.appendChild(localExportBtn); 
        backupSection.appendChild(exportIcsBtn);   
    }
}

exportIcsBtn.addEventListener('click', () => {
    if (typeof triggerHaptic === 'function') triggerHaptic();
    requestAdminAccess(() => {
        if (events.length === 0) return alert('目前沒有任何行程可以匯出喔！');
        exportIcsBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 產生檔案中...';
        exportIcsBtn.style.pointerEvents = 'none';
        try {
            let ics = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Family Calendar//TW\nCALSCALE:GREGORIAN\n";
            events.forEach(e => {
                const startStr = e.startDate.replace(/-/g, '');
                let endObj = new Date(e.endDate || e.startDate);
                endObj.setDate(endObj.getDate() + 1);
                const endStr = endObj.getFullYear() + String(endObj.getMonth()+1).padStart(2,'0') + String(endObj.getDate()).padStart(2,'0');
                
                ics += "BEGIN:VEVENT\n";
                ics += "UID:" + e.id + "@familycalendar\n";
                ics += "DTSTAMP:" + new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + "Z\n";
                ics += "SUMMARY:" + (e.icon ? e.icon + ' ' : '') + e.title + "\n";
                ics += "DTSTART;VALUE=DATE:" + startStr + "\n";
                ics += "DTEND;VALUE=DATE:" + endStr + "\n";
                if (e.location) ics += "LOCATION:" + e.location + "\n";
                if (e.author) ics += "DESCRIPTION:建立者：" + e.author + "\n";
                ics += "END:VEVENT\n";
            });
            ics += "END:VCALENDAR";

            const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `family_calendar_${new Date().toISOString().split('T')[0]}.ics`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            alert('🎉 成功匯出 iOS 行事曆檔案！');
        } catch (err) {
            alert('匯出失敗，請重試。');
        } finally {
            exportIcsBtn.innerHTML = '<i class="fab fa-apple text-base"></i> 匯出至 Apple Watch (iOS 行事曆)';
            exportIcsBtn.style.pointerEvents = 'auto';
        }
    });
});

localExportBtn.addEventListener('click', () => {
    if (typeof triggerHaptic === 'function') triggerHaptic();
    requestAdminAccess(() => {
        if (events.length === 0 && familyMembers.length === 0) return alert('目前沒有任何資料可以備份喔！');
        try {
            localExportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 產生檔案中...';
            localExportBtn.style.pointerEvents = 'none';

            const backupData = { 
                exportDate: new Date().toISOString(), 
                events: events,
                familyMembers: familyMembers,
                note: document.getElementById('family-sticky-note').value
            };
            const dataStr = JSON.stringify(backupData, null, 2);
            
            const blob = new Blob([dataStr], { type: 'application/json;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `family_calendar_backup_${new Date().toISOString().split('T')[0]}.json`;
            
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            alert('🎉 成功下載包含「家族成員」的完整 JSON 備份檔案！');
        } catch (err) {
            alert('匯出失敗，請重試。');
        } finally {
            localExportBtn.innerHTML = '<i class="fas fa-file-download"></i> 下載備份檔至本機 (手機/電腦)';
            localExportBtn.style.pointerEvents = 'auto';
        }
    });
});