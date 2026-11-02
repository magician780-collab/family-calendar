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

// 記錄目前選中的日期格子 (預設為今天)
const initDate = new Date();
let activeCellDate = `${initDate.getFullYear()}-${String(initDate.getMonth() + 1).padStart(2, '0')}-${String(initDate.getDate()).padStart(2, '0')}`;

// 動態載入 AI 呼吸燈動畫樣式
if (!document.getElementById('ai-border-style')) {
    const style = document.createElement('style');
    style.id = 'ai-border-style';
    style.innerHTML = `
    @keyframes ai-glow {
        0%, 100% { box-shadow: 0 0 10px rgba(139, 92, 246, 0.4), 0 0 20px rgba(59, 130, 246, 0.2); border-color: #8b5cf6; }
        50% { box-shadow: 0 0 20px rgba(59, 130, 246, 0.8), 0 0 30px rgba(168, 85, 247, 0.5); border-color: #3b82f6; }
    }
    .ai-active-cell {
        animation: ai-glow 2s infinite alternate;
        transform: scale(1.03);
        z-index: 20;
        border-width: 2px !important;
        border-radius: 0.75rem;
    }
    `;
    document.head.appendChild(style);
}

function triggerHaptic() {
    if (window.navigator && window.navigator.vibrate) window.navigator.vibrate(10);
}

// 🛑 核心防呆：關閉視窗時停止所有影片播放
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

// 修復：綁定「新增活動」表單內的「管理成員」按鈕
document.getElementById('btn-manage-members').addEventListener('click', () => {
    triggerHaptic();
    document.getElementById('member-modal').classList.remove('hidden');
});

/* 通用：點擊背景自動關閉 Modal (加入自動停止影片) */
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

/* ⌨️ 電腦版功能：按下 ESC 鍵自動關閉所有開啟的視窗 */
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

/* 手機版：左右滑動切換月份 */
let touchStartX = 0;
let touchEndX = 0;
const swipeContainer = document.getElementById('calendar-swipe-container');

if (swipeContainer) {
    swipeContainer.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    swipeContainer.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipeGesture();
    }, { passive: true });
}

function handleSwipeGesture() {
    const swipeThreshold = 50; 
    if (touchEndX < touchStartX - swipeThreshold) {
        triggerHaptic();
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar();
    }
    if (touchEndX > touchStartX + swipeThreshold) {
        triggerHaptic();
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar();
    }
}

/* 🔍 搜尋功能監聽 */
const searchInputEl = document.getElementById('search-input');
if (searchInputEl) {
    searchInputEl.addEventListener('input', (e) => {
        searchQuery = e.target.value.trim().toLowerCase();
        renderApp();
    });
}

/* ========================================================
   🎨 20 種以上多樣化主題風格設定 (含 AI 風格、馬卡龍色系，並刪除暗黑)
   ======================================================== */
const themePalettes = {
    // 經典系列
    warm: { 50: '#fff7ed', 100: '#ffedd5', 200: '#fed7aa', 300: '#fdba74', 400: '#fb923c', 500: '#f97316', 600: '#ea580c', 700: '#c2410c', 800: '#9a3412', 900: '#7c2d12' },
    forest: { 50: '#f0fdf4', 100: '#dcfce7', 200: '#bbf7d0', 300: '#86efac', 400: '#4ade80', 500: '#22c55e', 600: '#16a34a', 700: '#15803d', 800: '#166534', 900: '#14532d' },
    purple: { 50: '#faf5ff', 100: '#f3e8ff', 200: '#e9d5ff', 300: '#d8b4fe', 400: '#c084fc', 500: '#a855f7', 600: '#9333ea', 700: '#7e22ce', 800: '#6b21a8', 900: '#581c87' },
    
    // 🤖 AI 與科技風系列
    ai_cyber: { 50: '#090d16', 100: '#111827', 200: '#1f2937', 300: '#374151', 400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8', 800: '#1e40af', 900: '#1e3a8a' },
    ai_matrix: { 50: '#022c22', 100: '#064e3b', 200: '#047857', 300: '#10b981', 400: '#34d399', 500: '#059669', 600: '#047857', 700: '#065f46', 800: '#064e3b', 900: '#022c22' },
    ai_neon: { 50: '#2e1065', 100: '#4c1d95', 200: '#5b21b6', 300: '#7c3aed', 400: '#8b5cf6', 500: '#a855f7', 600: '#c084fc', 700: '#d8b4fe', 800: '#e9d5ff', 900: '#f3e8ff' },
    ai_quantum: { 50: '#082f49', 100: '#0369a1', 200: '#0284c7', 300: '#38bdf8', 400: '#7dd3fc', 500: '#0284c7', 600: '#0369a1', 700: '#075985', 800: '#0c4a6e', 900: '#082f49' },
    ai_neural: { 50: '#4c0519', 100: '#881337', 200: '#9f1239', 300: '#be123c', 400: '#e11d48', 500: '#f43f5e', 600: '#fb7185', 700: '#fecdd3', 800: '#ffe4e6', 900: '#fff1f2' },

    // 🎀 馬卡龍 (Macaron) 粉嫩系列
    macaron_pink: { 50: '#fff0f5', 100: '#ffe4e1', 200: '#ffc0cb', 300: '#ffb6c1', 400: '#ff69b4', 500: '#ff9eb5', 600: '#ff7b9c', 700: '#ff5c8a', 800: '#d84a72', 900: '#b03a5b' },
    macaron_blue: { 50: '#f0f8ff', 100: '#e6f2ff', 200: '#cce5ff', 300: '#99ccff', 400: '#66b2ff', 500: '#a2d2ff', 600: '#7ebdf6', 700: '#5aa8ec', 800: '#3993e2', 900: '#1a7dd8' },
    macaron_purple: { 50: '#f8f4ff', 100: '#f3e8ff', 200: '#e6ccff', 300: '#d9b3ff', 400: '#cc99ff', 500: '#cdb4db', 600: '#b892c9', 700: '#a370b7', 800: '#8e4ea5', 900: '#792c93' },
    macaron_yellow: { 50: '#fffff0', 100: '#ffffe0', 200: '#fffacd', 300: '#fff68f', 400: '#ffebcd', 500: '#fcf6bd', 600: '#e9e29c', 700: '#d6ce7b', 800: '#c3ba5a', 900: '#b0a639' },
    macaron_green: { 50: '#f0fff0', 100: '#e0ffe0', 200: '#ccffcc', 300: '#b3ffb3', 400: '#99ff99', 500: '#d0f4de', 600: '#addcb8', 700: '#8ac492', 800: '#67ac6c', 900: '#449446' },

    // 🌸 自然與生活感系列
    cherry: { 50: '#fff1f2', 100: '#ffe4e6', 200: '#fecdd3', 300: '#fda4af', 400: '#fb7185', 500: '#f43f5e', 600: '#e11d48', 700: '#be123c', 800: '#881337', 900: '#4c0519' },
    ocean: { 50: '#f0f9ff', 100: '#e0f2fe', 200: '#bae6fd', 300: '#7dd3fc', 400: '#38bdf8', 500: '#0ea5e9', 600: '#0284c7', 700: '#0369a1', 800: '#075985', 900: '#0c4a6e' },
    sunset: { 50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a', 300: '#fcd34d', 400: '#fbbf24', 500: '#f59e0b', 600: '#d97706', 700: '#b45309', 800: '#92400e', 900: '#78350f' },
    lavender: { 50: '#f5f3ff', 100: '#ede9fe', 200: '#ddd6fe', 300: '#c4b5fd', 400: '#a78bfa', 500: '#8b5cf6', 600: '#7c3aed', 700: '#6d28d9', 800: '#5b21b6', 900: '#4c1d95' },
    coffee: { 50: '#fdf8f6', 100: '#f2e8e5', 200: '#eaddd7', 300: '#e0cec7', 400: '#d2b48c', 500: '#bc8f8f', 600: '#8b4513', 700: '#654321', 800: '#4a2e18', 900: '#331a00' },
    galaxy: { 50: '#0f172a', 100: '#1e293b', 200: '#334155', 300: '#475569', 400: '#64748b', 500: '#4f46e5', 600: '#4338ca', 700: '#3730a3', 800: '#312e81', 900: '#1e1b4b' },
    lemon: { 50: '#fefce8', 100: '#fef9c3', 200: '#fef08a', 300: '#fde047', 400: '#facc15', 500: '#eab308', 600: '#ca8a04', 700: '#a16207', 800: '#854d0e', 900: '#713f12' },
    peach: { 50: '#fff1f2', 100: '#ffe4e6', 200: '#fecdd3', 300: '#fda4af', 400: '#fb7185', 500: '#ff7f50', 600: '#fa8072', 700: '#e9967a', 800: '#cd5c5c', 900: '#8b0000' },
    matcha: { 50: '#f4f6f0', 100: '#e3e8d7', 200: '#c8d3b2', 300: '#a7b889', 400: '#829762', 500: '#657945', 600: '#506035', 700: '#3f4c29', 800: '#303a1f', 900: '#232a17' },
    arctic: { 50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1', 400: '#94a3b8', 500: '#64748b', 600: '#475569', 700: '#334155', 800: '#1e293b', 900: '#0f172a' }
};

// 動態覆蓋 index.html 寫死的下拉選項，提供完整 23 種風格
function initThemeSelectOptions() {
    const sel = document.getElementById('theme-select');
    if (!sel) return;
    
    // 清空舊選項 (順便徹底移除暗黑)
    sel.innerHTML = '';

    const customThemes = [
        { id: 'warm', name: '🍊 溫馨暖橘' },
        { id: 'forest', name: '🌿 清新森林' },
        { id: 'purple', name: '💜 浪漫柔紫' },
        // 馬卡龍色系
        { id: 'macaron_pink', name: '🎀 馬卡龍粉' },
        { id: 'macaron_blue', name: '🍼 馬卡龍藍' },
        { id: 'macaron_purple', name: '🦄 馬卡龍紫' },
        { id: 'macaron_yellow', name: '🐣 馬卡龍黃' },
        { id: 'macaron_green', name: '🍈 馬卡龍綠' },
        // AI 科技風
        { id: 'ai_cyber', name: '🤖 AI 賽博龐克' },
        { id: 'ai_matrix', name: '🟩 AI 數位矩陣' },
        { id: 'ai_neon', name: '🔮 AI 極光霓虹' },
        { id: 'ai_quantum', name: '⚡ AI 量子科技' },
        { id: 'ai_neural', name: '🧬 AI 神經網絡' },
        // 自然與生活
        { id: 'cherry', name: '🌸 櫻花紛飛' },
        { id: 'ocean', name: '🌊 蔚藍海洋' },
        { id: 'sunset', name: '🌇 夕陽黃昏' },
        { id: 'lavender', name: '🪻 薰衣草園' },
        { id: 'coffee', name: '☕ 拿鐵咖啡' },
        { id: 'galaxy', name: '🌌 深邃星空' },
        { id: 'lemon', name: '🍋 萊姆檸檬' },
        { id: 'peach', name: '🍑 甜美蜜桃' },
        { id: 'matcha', name: '🍵 濃郁抹茶' },
        { id: 'arctic', name: '❄️ 北極冰川' }
    ];

    customThemes.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = t.name;
        sel.appendChild(opt);
    });

    const savedTheme = localStorage.getItem('family_app_theme') || 'warm';
    // 防呆：如果之前的紀錄是已經被刪除的 dark，就重置回預設的暖橘色
    if (customThemes.some(t => t.id === savedTheme)) {
        sel.value = savedTheme;
    } else {
        sel.value = 'warm';
        setTheme('warm');
    }
}

function setTheme(name) {
    const palette = themePalettes[name] || themePalettes.warm;
    const root = document.documentElement;
    Object.keys(palette).forEach(k => root.style.setProperty(`--color-${k}`, palette[k]));
    localStorage.setItem('family_app_theme', name);
    const sel = document.getElementById('theme-select');
    if (sel) sel.value = name;
}

// 啟動時先將自訂的 23 種清單注入畫面的 select，再讀取使用者的主題偏好
initThemeSelectOptions();
setTheme(localStorage.getItem('family_app_theme') || 'warm');

const themeSelectEl = document.getElementById('theme-select');
if (themeSelectEl) {
    // 覆蓋原本在底下的簡單監聽，以避免衝突
    const newSelectEl = themeSelectEl.cloneNode(true);
    themeSelectEl.parentNode.replaceChild(newSelectEl, themeSelectEl);
    newSelectEl.addEventListener('change', (e) => { 
        triggerHaptic(); 
        setTheme(e.target.value); 
    });
}
/* ======================================================== */

/* 天氣 API */
async function fetchWeather() {
    try {
        const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=22.9908&longitude=120.2133&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=Asia%2FTaipei');
        const data = await res.json();
        const m = { 0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️', 45: '🌫️', 51: '🌧️', 61: '🌧️', 95: '⛈️' };
        if (data && data.daily) {
            data.daily.time.forEach((d, i) => { weatherData[d] = `${m[data.daily.weathercode[i]] || '☁️'} ${Math.round(data.daily.temperature_2m_max[i])}°`; });
        }
    } catch (e) {}
}
fetchWeather().then(() => renderCalendar());

/* 便利貼 */
const stickyNoteEl = document.getElementById('family-sticky-note');
const noteStatusEl = document.getElementById('note-status');
let noteTimeout = null;
onSnapshot(noteRef, (docSnap) => {
    if (docSnap.exists() && document.activeElement !== stickyNoteEl) stickyNoteEl.value = docSnap.data().content || '';
});
stickyNoteEl.addEventListener('input', () => {
    noteStatusEl.textContent = '儲存中...';
    noteStatusEl.classList.remove('opacity-0');
    if (noteTimeout) clearTimeout(noteTimeout);
    noteTimeout = setTimeout(async () => {
        await setDoc(noteRef, { content: stickyNoteEl.value }, { merge: true });
        noteStatusEl.textContent = '已同步';
        setTimeout(() => noteStatusEl.classList.add('opacity-0'), 2000);
    }, 1000);
});

/* 成員管理 */
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
        await addDoc(membersRef, { name: input.value.trim() });
        input.value = '';
    }
});
document.getElementById('btn-close-member-modal').addEventListener('click', () => document.getElementById('member-modal').classList.add('hidden'));

/* ========================================================
   📅 通用版：政府行事曆與國定假日 (動態推算年份 + 防重複與清除)
   ======================================================== */
const importGovBtn = document.getElementById('btn-import-gov-holidays');
if (importGovBtn) {
    importGovBtn.innerHTML = '<i class="fas fa-calendar-alt"></i> 一鍵匯入年度國定假日 (可自訂年份)';
    
    importGovBtn.addEventListener('click', async () => {
        triggerHaptic();
        
        const defaultYear = currentDate.getFullYear();
        const yearStr = prompt('請輸入您要匯入國定假日的「西元年份」：', defaultYear);
        if (!yearStr) return;
        
        const targetYear = parseInt(yearStr, 10);
        if (isNaN(targetYear) || targetYear < 2020 || targetYear > 2100) {
            return alert('請輸入有效的西元年份 (例如：2025, 2026, 2027)！');
        }

        try {
            const lunarJan1 = Lunar.fromYmd(targetYear, 1, 1).getSolar(); // 春節
            const eve = lunarJan1.next(-1); // 除夕
            const dragonBoat = Lunar.fromYmd(targetYear, 5, 5).getSolar(); // 端午
            const midAutumn = Lunar.fromYmd(targetYear, 8, 15).getSolar(); // 中秋

            const govHolidays = [
                { title: '元旦', startDate: `${targetYear}-01-01`, endDate: `${targetYear}-01-01`, icon: '🎉', author: '政府行事曆', color: 'bg-rose-500' },
                { title: '農曆除夕', startDate: eve.toYmd(), endDate: eve.toYmd(), icon: '🧧', author: '政府行事曆', color: 'bg-red-600' },
                { title: '春節', startDate: lunarJan1.toYmd(), endDate: lunarJan1.next(3).toYmd(), icon: '🧧', author: '政府行事曆', color: 'bg-red-600' },
                { title: '和平紀念日', startDate: `${targetYear}-02-28`, endDate: `${targetYear}-02-28`, icon: '🕊️', author: '政府行事曆', color: 'bg-blue-500' },
                { title: '兒童節/民族掃墓節', startDate: `${targetYear}-04-04`, endDate: `${targetYear}-04-05`, icon: '🌿', author: '政府行事曆', color: 'bg-emerald-500' },
                { title: '勞動節', startDate: `${targetYear}-05-01`, endDate: `${targetYear}-05-01`, icon: '⭐', author: '政府行事曆', color: 'bg-amber-500' },
                { title: '端午節', startDate: dragonBoat.toYmd(), endDate: dragonBoat.toYmd(), icon: '🛶', author: '政府行事曆', color: 'bg-emerald-600' },
                { title: '中秋節', startDate: midAutumn.toYmd(), endDate: midAutumn.toYmd(), icon: '🥮', author: '政府行事曆', color: 'bg-amber-600' },
                { title: '國慶日', startDate: `${targetYear}-10-10`, endDate: `${targetYear}-10-10`, icon: '🇹🇼', author: '政府行事曆', color: 'bg-blue-600' }
            ];

            let importedCount = 0;
            for (const h of govHolidays) {
                const isExist = events.some(e => e.title === h.title && e.startDate === h.startDate && e.author === '政府行事曆');
                if (!isExist) {
                    await addDoc(eventsRef, h);
                    importedCount++;
                }
            }
            
            if (importedCount > 0) {
                alert(`🎉 成功新增 ${targetYear} 年的 ${importedCount} 筆國定假日！`);
            } else {
                alert(`ℹ️ 行事曆中已經有 ${targetYear} 年的國定假日了，無須重複匯入！`);
            }
        } catch (err) {
            console.error("節日推算或寫入失敗:", err);
            alert('匯入失敗，請檢查網路連線或套件是否載入。');
        }
    });
}

// 動態加入「清除重複假日」按鈕
if (importGovBtn && !document.getElementById('btn-cleanup-holidays')) {
    const cleanupBtn = document.createElement('button');
    cleanupBtn.id = 'btn-cleanup-holidays';
    cleanupBtn.className = 'w-full py-2.5 mt-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm cursor-pointer transition-all active:scale-95';
    cleanupBtn.innerHTML = '<i class="fas fa-broom"></i> 清除重複的國定假日';
    importGovBtn.parentNode.appendChild(cleanupBtn);

    cleanupBtn.addEventListener('click', async () => {
        if (!confirm('確定要掃描並清除重複匯入的「政府行事曆」假日嗎？')) return;
        triggerHaptic();

        try {
            const govEvents = events.filter(e => e.author === '政府行事曆');
            const seen = new Set();
            const duplicates = [];

            for (const evt of govEvents) {
                const uniqueKey = `${evt.title}_${evt.startDate}`;
                if (seen.has(uniqueKey)) {
                    duplicates.push(evt.id); 
                } else {
                    seen.add(uniqueKey); 
                }
            }

            if (duplicates.length === 0) {
                return alert('✅ 太棒了！目前行事曆中沒有發現重複的假日。');
            }

            if (confirm(`發現 ${duplicates.length} 筆重複的假日，確定要立即刪除嗎？`)) {
                for (const id of duplicates) {
                    await deleteDoc(doc(eventsRef, id));
                }
                alert(`🎉 成功清除 ${duplicates.length} 筆重複假日！`);
            }
        } catch (err) {
            alert('清除失敗，請檢查網路連線。');
        }
    });
}

// ========================================================
// 📁 動態加入：通用 ICS 行事曆匯入按鈕
// ========================================================
if (importGovBtn && !document.getElementById('btn-import-ics-container')) {
    const icsContainer = document.createElement('div');
    icsContainer.id = 'btn-import-ics-container';
    icsContainer.className = 'mt-4 pt-4 border-t border-gray-200';
    
    icsContainer.innerHTML = `
        <label class="block text-xs font-bold text-gray-700 mb-2">外部行事曆匯入</label>
        <label class="w-full py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm cursor-pointer transition-all active:scale-95">
            <i class="fas fa-calendar-plus"></i> 匯入通用 ICS 檔案 (.ics)
            <input type="file" id="input-import-ics" accept=".ics" class="hidden">
        </label>
    `;
    importGovBtn.parentNode.appendChild(icsContainer);

    document.getElementById('input-import-ics').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            const icsData = event.target.result;
            const parsedEvents = parseICS(icsData);
            
            if (parsedEvents.length === 0) {
                e.target.value = '';
                return alert('找不到任何有效的行程資料，請確認這是一個標準的 ICS 檔案！');
            }

            if (confirm(`成功從檔案解析出 ${parsedEvents.length} 筆行程，確定要匯入嗎？\n(系統將自動略過已經存在相同日期與名稱的重複行程)`)) {
                triggerHaptic();
                let importedCount = 0;
                for (const ev of parsedEvents) {
                    const isExist = events.some(e => e.title === ev.title && e.startDate === ev.startDate);
                    if (!isExist) {
                        const newEvent = {
                            title: ev.title || '未命名行程',
                            startDate: ev.startDate,
                            endDate: ev.endDate || ev.startDate,
                            location: ev.location || '',
                            author: 'ICS 匯入',
                            color: 'bg-blue-500',
                            icon: '🗓️',
                            isChecklist: false, checklist: [],
                            isPoll: false, pollOptions: [],
                            isExpense: false, payers: [], sharers: []
                        };
                        await addDoc(eventsRef, newEvent);
                        importedCount++;
                    }
                }
                if (importedCount > 0) {
                    alert(`🎉 成功匯入 ${importedCount} 筆新行程！`);
                } else {
                    alert(`ℹ️ 這些行程已經存在行事曆中了，無須重複匯入！`);
                }
                document.getElementById('member-modal').classList.add('hidden');
            }
            e.target.value = ''; 
        };
        reader.readAsText(file);
    });

    function parseICS(data) {
        const parsed = [];
        const lines = data.split(/\r?\n/);
        let currentEvent = null;

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            while (i + 1 < lines.length && (lines[i + 1].startsWith(' ') || lines[i + 1].startsWith('\t'))) {
                i++;
                line += lines[i].substring(1);
            }

            if (line.startsWith('BEGIN:VEVENT')) {
                currentEvent = {};
            } else if (line.startsWith('END:VEVENT') && currentEvent) {
                if (currentEvent.startDate) parsed.push(currentEvent);
                currentEvent = null;
            } else if (currentEvent) {
                if (line.startsWith('SUMMARY:')) {
                    currentEvent.title = line.substring(8).trim();
                } else if (line.match(/^DTSTART/)) {
                    const match = line.match(/:([0-9T]+Z?)/);
                    if (match) currentEvent.startDate = formatICSDate(match[1]);
                } else if (line.match(/^DTEND/)) {
                    const match = line.match(/:([0-9T]+Z?)/);
                    if (match) {
                        let eDate = formatICSDate(match[1]);
                        if (match[1].length === 8 && eDate !== currentEvent.startDate) {
                            const d = new Date(eDate);
                            d.setDate(d.getDate() - 1);
                            eDate = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                        }
                        currentEvent.endDate = eDate;
                    }
                } else if (line.startsWith('LOCATION:')) {
                    currentEvent.location = line.substring(9).trim();
                }
            }
        }
        return parsed;
    }

    function formatICSDate(icsDateStr) {
        const clean = icsDateStr.replace(/[^0-9]/g, '');
        if (clean.length >= 8) {
            return `${clean.substring(0,4)}-${clean.substring(4,6)}-${clean.substring(6,8)}`;
        }
        return '';
    }
}
/* ======================================================== */

/* ☁️ 雲端備份與還原 (支援多天歷史快照) */
const exportBtn = document.getElementById('btn-export-json');
const importInput = document.getElementById('input-import-json');

if (exportBtn && importInput) {
    const importLabel = importInput.parentElement;
    const sectionLabel = exportBtn.closest('.space-y-2').querySelector('label');
    if (sectionLabel) sectionLabel.innerHTML = '☁️ 雲端備份歷史紀錄 (隨時可還原)';

    exportBtn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> 建立新備份至雲端';
    exportBtn.className = 'py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer';
    
    const cloudRestoreBtn = document.createElement('button');
    cloudRestoreBtn.id = 'btn-cloud-restore';
    cloudRestoreBtn.className = 'py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer';
    cloudRestoreBtn.innerHTML = '<i class="fas fa-history"></i> 選擇歷史紀錄還原';
    
    importLabel.parentNode.replaceChild(cloudRestoreBtn, importLabel);

    // 建立新備份
    exportBtn.addEventListener('click', async () => {
        if(!confirm('確定要將目前的「所有行程」建立一份新備份到雲端嗎？')) return;
        triggerHaptic();
        
        try {
            exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 備份中...';
            exportBtn.disabled = true;
            
            const backupData = {
                exportDate: new Date().toISOString(),
                events: events
            };
            
            // 使用當下時間作為文件 ID，保留多份歷史紀錄
            const backupId = Date.now().toString();
            await setDoc(doc(db, 'familyBackups', backupId), backupData);
            
            alert('🎉 雲端備份成功！已建立一份全新的備份存檔。');
        } catch (err) {
            console.error(err);
            alert('備份失敗，請檢查網路連線。');
        } finally {
            exportBtn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> 建立新備份至雲端';
            exportBtn.disabled = false;
        }
    });

    // 從歷史清單還原
    cloudRestoreBtn.addEventListener('click', async () => {
        triggerHaptic();
        
        try {
            cloudRestoreBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 讀取歷史...';
            cloudRestoreBtn.disabled = true;
            
            // 抓取雲端所有備份
            const snap = await getDocs(collection(db, 'familyBackups'));
            if (snap.empty) {
                alert('☁️ 目前雲端沒有找到任何備份紀錄喔！請先建立備份。');
                return;
            }
            
            const backupsList = [];
            snap.forEach(d => backupsList.push({ id: d.id, ...d.data() }));
            
            // 依時間新到舊排序
            backupsList.sort((a, b) => new Date(b.exportDate) - new Date(a.exportDate));

            // 動態產生還原選單 UI
            const modal = document.createElement('div');
            modal.className = 'fixed inset-0 bg-warm-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-fade-in';
            
            let listHtml = '';
            // 最多顯示最近 10 筆備份
            backupsList.slice(0, 10).forEach((b, index) => {
                const timeStr = new Date(b.exportDate).toLocaleString('zh-TW', {
                    year: 'numeric', month: '2-digit', day: '2-digit',
                    hour: '2-digit', minute:'2-digit', second:'2-digit'
                });
                const badge = index === 0 ? '<span class="px-2 py-0.5 bg-rose-100 text-rose-700 rounded-full text-[10px] ml-2 font-bold">最新</span>' : '';
                
                listHtml += `
                    <button class="w-full text-left bg-white p-3 rounded-xl border hover:bg-amber-50 hover:border-amber-400 transition-all flex justify-between items-center group cursor-pointer shadow-sm" data-id="${b.id}">
                        <div>
                            <div class="font-bold text-gray-800 flex items-center">${timeStr} ${badge}</div>
                            <div class="text-xs text-gray-500 mt-1">包含 ${b.events ? b.events.length : 0} 筆行程</div>
                        </div>
                        <i class="fas fa-download text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity text-lg"></i>
                    </button>
                `;
            });

            modal.innerHTML = `
                <div class="bg-white w-full max-w-sm rounded-3xl shadow-2xl flex flex-col overflow-hidden" onclick="event.stopPropagation()">
                    <div class="px-5 py-4 bg-amber-50 border-b border-amber-100 flex justify-between items-center">
                        <h3 class="font-bold text-amber-900 flex items-center gap-2"><i class="fas fa-history text-amber-500"></i> 選擇要還原的歷史備份</h3>
                        <button id="btn-close-backup-modal" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times text-xl"></i></button>
                    </div>
                    <div class="p-4 space-y-3 max-h-[60vh] overflow-y-auto bg-gray-50">
                        ${listHtml}
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            document.getElementById('btn-close-backup-modal').onclick = () => modal.remove();
            modal.onclick = () => modal.remove();

            // 綁定各版本的點擊還原事件
            modal.querySelectorAll('button[data-id]').forEach(btn => {
                btn.onclick = async (e) => {
                    e.stopPropagation();
                    const bId = btn.getAttribute('data-id');
                    const selectedBackup = backupsList.find(b => b.id === bId);
                    
                    const timeStr = new Date(selectedBackup.exportDate).toLocaleString('zh-TW');
                    if(confirm(`⚠️ 嚴重警告：\n還原將會【完全覆蓋】您目前行事曆上的所有行程！\n\n確定要時光倒流，還原到 ${timeStr} 的版本嗎？`)) {
                        modal.remove();
                        cloudRestoreBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 還原中...';
                        cloudRestoreBtn.disabled = true;
                        
                        try {
                            // 1. 徹底清空目前所有行程
                            for (const evt of events) {
                                await deleteDoc(doc(eventsRef, evt.id));
                            }
                            
                            // 2. 寫入所選版本的行程
                            for (const ev of selectedBackup.events) {
                                delete ev.id;
                                await addDoc(eventsRef, ev);
                            }
                            
                            alert('🎉 雲端還原大成功！已成功回到您選擇的歷史時間點。');
                            document.getElementById('member-modal').classList.add('hidden');
                        } catch (err) {
                            console.error(err);
                            alert('寫入資料失敗，請檢查網路。');
                        }
                    }
                };
            });
            
        } catch (err) {
            console.error(err);
            alert('讀取雲端歷史紀錄失敗，請檢查網路連線。');
        } finally {
            cloudRestoreBtn.innerHTML = '<i class="fas fa-history"></i> 選擇歷史紀錄還原';
            cloudRestoreBtn.disabled = false;
        }
    });
}
/* ======================================================== */

/* 相片牆 */
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

/* ================= 下拉選單處理 ================= */
function getMemberOptions(selected = '', defaultText = '請選擇...') {
    let html = `<option value="" disabled ${!selected ? 'selected' : ''}>${defaultText}</option>`;
    familyMembers.forEach(m => {
        html += `<option value="${m.name}" ${m.name === selected ? 'selected' : ''}>${m.name}</option>`;
    });
    return html;
}

function getChecklistMemberOptions(selected = '') {
    let html = `<option value="" ${!selected ? 'selected' : ''}>(未認領)</option>`;
    familyMembers.forEach(m => {
        html += `<option value="${m.name}" ${m.name === selected ? 'selected' : ''}>${m.name}</option>`;
    });
    return html;
}

function updateUniqueSelects(containerId, selectClass) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const selects = Array.from(container.querySelectorAll(selectClass));
    const selectedValues = selects.map(s => s.value).filter(v => v !== '');

    selects.forEach(select => {
        const currentValue = select.value;
        Array.from(select.options).forEach(option => {
            if (option.value === '') return;
            if (selectedValues.includes(option.value) && option.value !== currentValue) {
                option.disabled = true;
                option.textContent = `${option.value} (已選)`;
            } else {
                option.disabled = false;
                option.textContent = option.value;
            }
        });
    });
}

/* 裝備/任務清單 */
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
        <select class="checklist-assignee w-24 px-2 py-1.5 bg-white border rounded-xl text-xs outline-none cursor-pointer">
            ${getChecklistMemberOptions(assignee)}
        </select>
        <button type="button" class="text-rose-400 p-1"><i class="fas fa-trash-alt"></i></button>
    `;
    row.querySelector('button').addEventListener('click', () => row.remove());
    checklistContainer.appendChild(row);
}
document.getElementById('btn-add-checklist-item').addEventListener('click', () => addChecklistRow());

/* 投票功能 */
const pollCheckbox = document.getElementById('event-is-poll');
const pollFields = document.getElementById('poll-fields');
const pollOptionsContainer = document.getElementById('poll-options-container');
pollCheckbox.addEventListener('change', (e) => {
    pollFields.classList.toggle('hidden', !e.target.checked);
    if (e.target.checked && pollOptionsContainer.children.length === 0) addPollOptionRow();
});
function addPollOptionRow(title = '') {
    const row = document.createElement('div');
    row.className = 'flex items-center gap-2 poll-row';
    row.innerHTML = `<input type="text" placeholder="選項標題" value="${title}" class="poll-option-title flex-1 px-3 py-1.5 bg-white border rounded-xl text-xs outline-none" required><button type="button" class="text-rose-400 p-1"><i class="fas fa-trash-alt"></i></button>`;
    row.querySelector('button').addEventListener('click', () => row.remove());
    pollOptionsContainer.appendChild(row);
}
document.getElementById('btn-add-poll-option').addEventListener('click', () => addPollOptionRow());

/* 代墊記帳與分帳 */
const expenseCheckbox = document.getElementById('event-is-expense');
const expenseFields = document.getElementById('expense-fields');
const payersContainer = document.getElementById('payers-container');
const sharersContainer = document.getElementById('sharers-container');
expenseCheckbox.addEventListener('change', (e) => {
    expenseFields.classList.toggle('hidden', !e.target.checked);
    if (e.target.checked && payersContainer.children.length === 0) { addPayerRow(); addSharerRow(); }
});

function addPayerRow(name = '', amount = '') {
    const row = document.createElement('div');
    row.className = 'flex items-center gap-2 payer-row';
    row.innerHTML = `
        <select class="payer-name w-1/3 px-2 py-1.5 bg-white border rounded-xl text-xs outline-none cursor-pointer" required>
            ${getMemberOptions(name, '代墊人...')}
        </select>
        <input type="number" placeholder="金額 $" value="${amount}" class="payer-amount flex-1 px-3 py-1.5 bg-white border rounded-xl text-xs outline-none" required>
        <button type="button" class="text-rose-400 p-1"><i class="fas fa-trash-alt"></i></button>
    `;
    row.querySelector('button').addEventListener('click', () => { 
        row.remove(); 
        updateUniqueSelects('payers-container', '.payer-name'); 
    });
    row.querySelector('.payer-name').addEventListener('change', () => {
        updateUniqueSelects('payers-container', '.payer-name');
    });
    payersContainer.appendChild(row);
    updateUniqueSelects('payers-container', '.payer-name');
}
document.getElementById('btn-add-payer').addEventListener('click', () => addPayerRow());

function addSharerRow(name = '', weight = 1) {
    const row = document.createElement('div');
    row.className = 'flex items-center gap-2 sharer-row';
    row.innerHTML = `
        <select class="sharer-name flex-1 px-3 py-1.5 bg-white border rounded-xl text-xs outline-none cursor-pointer" required>
            ${getMemberOptions(name, '分攤對象...')}
        </select>
        <div class="flex items-center bg-white border rounded-xl px-2 py-1">
            <input type="number" min="0.5" step="0.5" value="${weight}" class="sharer-weight w-12 text-center text-xs font-bold outline-none">
            <span class="text-[10px]">份</span>
        </div>
        <button type="button" class="text-rose-400 p-1"><i class="fas fa-trash-alt"></i></button>
    `;
    row.querySelector('button').addEventListener('click', () => { 
        row.remove(); 
        updateUniqueSelects('sharers-container', '.sharer-name'); 
    });
    row.querySelector('.sharer-name').addEventListener('change', () => {
        updateUniqueSelects('sharers-container', '.sharer-name');
    });
    sharersContainer.appendChild(row);
    updateUniqueSelects('sharers-container', '.sharer-name');
}
document.getElementById('btn-add-sharer').addEventListener('click', () => addSharerRow('', 1));


/* 核心事件聆聽 */
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
            id: docSnap.id,
            title: data.title || '未命名活動',
            icon: data.icon || '',
            startDate: sDate,
            endDate: eDate,
            originalStart: data.startDate,
            isLunarRecurring: data.isLunarRecurring || false,
            lunarMonth: data.lunarMonth || null,
            lunarDay: data.lunarDay || null,
            author: data.author || '家族成員',
            color: data.color || 'bg-rose-400',
            photoUrl: data.photoUrl || null,
            videoUrl: data.videoUrl || null,
            fileUrl: data.fileUrl || null,
            location: data.location || '',
            mapUrl: data.mapUrl || '',
            isChecklist: data.isChecklist || false,
            checklist: data.checklist || [],
            isPoll: data.isPoll || false,
            pollOptions: (data.pollOptions || []).map(o => ({ title: o.title, voters: o.voters || [] })),
            isExpense: data.isExpense || false,
            payers: data.payers || [],
            sharers: data.sharers || []
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
    
    // 🔍 搜尋過濾邏輯
    const dayEvents = events.filter(e => {
        const inRange = dateStr >= e.startDate && dateStr <= e.endDate;
        if (!inRange) return false;
        if (!searchQuery) return true;
        
        const tMatch = e.title && e.title.toLowerCase().includes(searchQuery);
        const aMatch = e.author && e.author.toLowerCase().includes(searchQuery);
        const lMatch = e.location && e.location.toLowerCase().includes(searchQuery);
        return tMatch || aMatch || lMatch;
    });

    const isGovHoliday = dayEvents.some(e => e.author === '政府行事曆');
    const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
    const isRedDay = isWeekend || isGovHoliday;

    let cellBgClass = isToday ? 'bg-warm-50' : (isRedDay ? 'bg-rose-50/80 border-rose-200' : 'bg-white');
    
    // 判斷是否為「當前選中」的格子，加上 AI 動畫外框樣式
    let isSelected = (dateStr === activeCellDate);
    let activeRingClass = isSelected ? 'ai-active-cell transition-all duration-300' : '';

    const cell = document.createElement('div');
    cell.className = `day-cell border border-warm-100 rounded-xl p-1 flex flex-col gap-1 cursor-pointer relative ${cellBgClass} ${activeRingClass}`;
    
    // 點擊格子時，轉移外框並開啟該日行程
    cell.addEventListener('click', () => {
        document.querySelectorAll('.day-cell').forEach(c => {
            c.classList.remove('ai-active-cell', 'transition-all', 'duration-300');
        });
        cell.classList.add('ai-active-cell', 'transition-all', 'duration-300');
        activeCellDate = dateStr;
        openDayModal(dateStr);
    });
    
    let dateNumColor = isToday ? 'bg-warm-500 text-white shadow-sm' : (isRedDay ? 'text-rose-600 font-extrabold' : 'text-gray-600');
    cell.innerHTML = `<div class="flex justify-between items-center px-0.5"><span class="text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full ${dateNumColor}">${dayNum}</span><span class="text-[9px] text-blue-500">${weatherData[dateStr] || ''}</span></div>`;
    
    const container = document.createElement('div');
    container.className = 'flex flex-col gap-0.5 overflow-y-auto flex-1 hide-scrollbar';
    dayEvents.forEach(evt => {
        const pollBadge = evt.isPoll ? ` <i class="fas fa-poll text-[9px]"></i>` : '';
        const el = document.createElement('div');
        
        // ✨ 修改：手機版字體放大為 text-xs，並加上 whitespace-normal break-words 允許自動換行
        el.className = `${evt.color} text-white text-xs md:text-sm font-bold px-1.5 py-1 rounded md:rounded-md shadow-sm transition-transform hover:scale-[1.02] leading-tight whitespace-normal break-words`;
        
        el.innerHTML = `${evt.icon ? evt.icon + ' ' : ''}${evt.title}${pollBadge}`;
        el.addEventListener('click', (ev) => { 
            ev.stopPropagation(); 
            // 點擊行程標籤時同樣將 AI 框轉移過去
            document.querySelectorAll('.day-cell').forEach(c => c.classList.remove('ai-active-cell', 'transition-all', 'duration-300'));
            cell.classList.add('ai-active-cell', 'transition-all', 'duration-300');
            activeCellDate = dateStr;
            openViewModal(evt.id); 
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
    
    // 🔍 搜尋過濾邏輯
    const dayEvts = events.filter(e => {
        const inRange = dateStr >= e.startDate && dateStr <= e.endDate;
        if (!inRange) return false;
        if (!searchQuery) return true;
        
        const tMatch = e.title && e.title.toLowerCase().includes(searchQuery);
        const aMatch = e.author && e.author.toLowerCase().includes(searchQuery);
        const lMatch = e.location && e.location.toLowerCase().includes(searchQuery);
        return tMatch || aMatch || lMatch;
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

// 🌟 修復：左側摺疊頁「即將到來」字體與內距全面放大整合
function renderUpcoming() {
    const container = document.getElementById('upcoming-events');
    const empty = document.getElementById('no-upcoming');
    container.innerHTML = '';
    const todayObj = new Date();
    todayObj.setHours(0, 0, 0, 0);
    const todayStr = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;
    
    // 🔍 搜尋過濾邏輯
    const upcoming = events.filter(e => {
        if (e.endDate < todayStr) return false;
        if (!searchQuery) return true;
        
        const tMatch = e.title && e.title.toLowerCase().includes(searchQuery);
        const aMatch = e.author && e.author.toLowerCase().includes(searchQuery);
        const lMatch = e.location && e.location.toLowerCase().includes(searchQuery);
        return tMatch || aMatch || lMatch;
    }).sort((a, b) => a.startDate.localeCompare(b.startDate)).slice(0, 5);
    
    empty.classList.toggle('hidden', upcoming.length > 0);
    upcoming.forEach(evt => {
        const el = document.createElement('div');
        // ✨ 放大卡片內距與間距
        el.className = 'bg-white p-3 md:p-4 rounded-xl border shadow-sm cursor-pointer flex items-center gap-3 md:gap-4 hover:bg-warm-50 transition-colors';
        el.addEventListener('click', () => openViewModal(evt.id));

        const [sY, sM, sD] = evt.startDate.split('-').map(Number);
        const startObj = new Date(sY, sM - 1, sD);
        const diffDays = Math.round((startObj - todayObj) / (1000 * 60 * 60 * 24));
        
        let countdownHtml = '';
        // ✨ 放大倒數標籤字體 (text-xs) 與內距
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

document.getElementById('btn-prev-month').addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(); });
document.getElementById('btn-next-month').addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(); });
document.getElementById('btn-today').addEventListener('click', () => { currentDate = new Date(); renderCalendar(); });
document.getElementById('btn-mob-prev').addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(); });
document.getElementById('btn-mob-next').addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(); });
document.getElementById('btn-mob-today').addEventListener('click', () => { currentDate = new Date(); renderCalendar(); });

document.getElementById('btn-open-add').addEventListener('click', () => openModal());
document.getElementById('btn-mobile-add').addEventListener('click', () => openModal());
document.getElementById('btn-close-modal').addEventListener('click', closeModal);
document.getElementById('btn-cancel-modal').addEventListener('click', closeModal);
document.getElementById('btn-close-day-modal').addEventListener('click', closeDayModal);

/* 🛑 關閉視窗與停止影片的邏輯 */
document.getElementById('btn-close-view').addEventListener('click', () => { 
    document.getElementById('view-modal').classList.add('hidden');
    stopViewVideo(); 
});
document.getElementById('btn-edit-from-view').addEventListener('click', () => { 
    const id = currentViewingId; 
    document.getElementById('view-modal').classList.add('hidden'); 
    stopViewVideo();
    openModal(id); 
});

function openModal(id = null) {
    document.getElementById('event-form').reset();
    document.getElementById('event-photo-url').value = '';
    document.getElementById('event-video-url').value = '';
    document.getElementById('photo-preview').classList.add('hidden');
    document.getElementById('event-file-url').value = '';
    document.getElementById('event-location').value = '';
    document.getElementById('event-map-url').value = '';
    
    checklistCheckbox.checked = false;
    checklistFields.classList.add('hidden');
    checklistContainer.innerHTML = '';
    
    pollCheckbox.checked = false;
    pollFields.classList.add('hidden');
    pollOptionsContainer.innerHTML = '';
    
    expenseCheckbox.checked = false;
    expenseFields.classList.add('hidden');
    payersContainer.innerHTML = '';
    sharersContainer.innerHTML = '';

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
            if (evt.photoUrl) {
                document.getElementById('event-photo-url').value = evt.photoUrl;
                document.querySelector('#photo-preview img').src = evt.photoUrl;
                document.getElementById('photo-preview').classList.remove('hidden');
            }
            if (evt.videoUrl) document.getElementById('event-video-url').value = evt.videoUrl;
            if (evt.fileUrl) document.getElementById('event-file-url').value = evt.fileUrl;
            if (evt.location) document.getElementById('event-location').value = evt.location;
            if (evt.mapUrl) document.getElementById('event-map-url').value = evt.mapUrl;
            
            if (evt.isChecklist && evt.checklist) {
                checklistCheckbox.checked = true;
                checklistFields.classList.remove('hidden');
                evt.checklist.forEach(item => addChecklistRow(item.text, item.assignee, item.done));
            }
            if (evt.isPoll && evt.pollOptions) {
                pollCheckbox.checked = true;
                pollFields.classList.remove('hidden');
                evt.pollOptions.forEach(o => addPollOptionRow(o.title));
            }
            if (evt.isExpense) {
                expenseCheckbox.checked = true;
                expenseFields.classList.remove('hidden');
                (evt.payers || []).forEach(p => addPayerRow(p.name, p.amount));
                (evt.sharers || []).forEach(s => addSharerRow(s.name, s.weight));
            }
        }
    } else {
        document.getElementById('modal-title').innerText = '新增活動';
        document.getElementById('btn-delete').classList.add('hidden');
        document.getElementById('event-start-date').value = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
        authorSelect.innerHTML = getMemberOptions('', '請選擇建立者...');
    }
    document.getElementById('event-modal').classList.remove('hidden');
}
function closeModal() { document.getElementById('event-modal').classList.add('hidden'); }

function openViewModal(id) {
    const evt = events.find(e => e.id === id);
    if (!evt) return;
    currentViewingId = id;
    document.getElementById('view-modal-header').className = `h-20 w-full ${evt.color}`;
    document.getElementById('view-title').innerText = (evt.icon ? evt.icon + ' ' : '') + evt.title;
    document.getElementById('view-date').innerText = evt.startDate === evt.endDate ? evt.startDate : `${evt.startDate} ~ ${evt.endDate}`;
    document.getElementById('view-author').innerText = `建立者：${evt.author}`;

    // 處理相片
    const pBox = document.getElementById('view-photo-container');
    if (evt.photoUrl) { pBox.classList.remove('hidden'); document.getElementById('view-photo').src = evt.photoUrl; } else pBox.classList.add('hidden');

    // 🎥 處理影片播放 (完美支援 Drive 預覽)
    const vBox = document.getElementById('view-video-container');
    const vIframe = document.getElementById('view-video-iframe');
    const vElement = document.getElementById('view-video-element');
    
    if (evt.videoUrl) {
        let url = evt.videoUrl.trim();
        vIframe.classList.add('hidden');
        vElement.classList.add('hidden');
        
        if (url.includes('youtube.com/watch?v=')) {
            let vId = new URL(url).searchParams.get('v');
            vIframe.src = `https://www.youtube.com/embed/${vId}`;
            vIframe.classList.remove('hidden');
        } else if (url.includes('youtu.be/')) {
            let vId = url.split('youtu.be/')[1].split('?')[0];
            vIframe.src = `https://www.youtube.com/embed/${vId}`;
            vIframe.classList.remove('hidden');
        } else if (url.includes('drive.google.com')) {
            // 完美處理 Google Drive 影片預覽轉換
            let fileId = '';
            if (url.includes('/d/')) {
                fileId = url.split('/d/')[1].split('/')[0];
            } else if (url.includes('id=')) {
                fileId = new URL(url).searchParams.get('id');
            }
            if (fileId) {
                vIframe.src = `https://drive.google.com/file/d/${fileId}/preview`;
                vIframe.classList.remove('hidden');
            } else {
                vIframe.src = url;
                vIframe.classList.remove('hidden');
            }
        } else {
            // 原生 mp4
            vElement.src = url;
            vElement.classList.remove('hidden');
        }
        vBox.classList.remove('hidden');
    } else {
        vBox.classList.add('hidden');
        vIframe.src = '';
        vElement.src = '';
    }

    const fBox = document.getElementById('view-file-container');
    if (evt.fileUrl) { fBox.classList.remove('hidden'); document.getElementById('view-file-link').href = evt.fileUrl; } else fBox.classList.add('hidden');

    const mMapBox = document.getElementById('view-map-container');
    const mMapLink = document.getElementById('view-map-link');
    const mLocText = document.getElementById('view-location-text');
    if (evt.mapUrl || evt.location) {
        mLocText.innerText = evt.location || '點擊開啟地圖導航';
        mMapLink.href = evt.mapUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(evt.location)}`;
        mMapBox.classList.remove('hidden');
    } else {
        mMapBox.classList.add('hidden');
    }

    const checkContainer = document.getElementById('view-checklist-container');
    const checkItems = document.getElementById('view-checklist-items');
    const checkProgress = document.getElementById('view-checklist-progress');
    if (evt.isChecklist && evt.checklist && evt.checklist.length > 0) {
        checkItems.innerHTML = '';
        let doneCount = 0;
        evt.checklist.forEach((item, idx) => {
            if (item.done) doneCount++;
            const row = document.createElement('label');
            row.className = 'flex items-center justify-between bg-white p-2 rounded-xl border cursor-pointer';
            row.innerHTML = `
                <div class="flex items-center gap-2">
                    <input type="checkbox" ${item.done ? 'checked' : ''} class="w-4 h-4 text-emerald-600 rounded cursor-pointer">
                    <span class="${item.done ? 'line-through text-gray-400' : 'text-gray-700 font-bold'}">${item.text}</span>
                </div>
                <span class="text-[10px] bg-warm-50 text-warm-700 px-2 py-0.5 rounded-full font-bold">${item.assignee || '未認領'}</span>
            `;
            row.querySelector('input').addEventListener('change', async (e) => {
                let updatedChecklist = [...evt.checklist];
                updatedChecklist[idx].done = e.target.checked;
                await updateDoc(doc(eventsRef, evt.id), { checklist: updatedChecklist });
            });
            checkItems.appendChild(row);
        });
        checkProgress.innerText = `${doneCount}/${evt.checklist.length}`;
        checkContainer.classList.remove('hidden');
    } else {
        checkContainer.classList.add('hidden');
    }

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
            if (hasVoted) {
                opt.disabled = true;
                opt.textContent = `${m.name} (已投票，不可再選)`;
            } else {
                opt.textContent = m.name;
            }
            voterSelect.appendChild(opt);
        });

        const voter = voterSelect.value;

        votedMembersBanner.innerHTML = allVotedMembersArr.length > 0 ? 
            `<i class="fas fa-check-circle text-emerald-600 mr-1"></i> 已投票成員：<strong>${allVotedMembersArr.join(', ')}</strong>` : 
            `<i class="far fa-clock text-indigo-500 mr-1"></i> 尚無成員投票`;

        let maxVotes = -1;
        evt.pollOptions.forEach(opt => { if (opt.voters.length > maxVotes) maxVotes = opt.voters.length; });

        evt.pollOptions.forEach((opt, idx) => {
            const row = document.createElement('div');
            row.className = 'bg-white p-2.5 rounded-xl border flex flex-col gap-1.5 shadow-sm';
            const isWinner = maxVotes > 0 && opt.voters.length === maxVotes;

            row.innerHTML = `
                <div class="flex justify-between items-center">
                    <span class="font-bold text-gray-800 flex items-center gap-1.5">
                        ${opt.title} ${isWinner ? '<span class="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full font-extrabold">👑 最高票</span>' : ''}
                    </span>
                    <button class="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg text-xs font-bold transition-all active:scale-95 shadow-sm">
                        投一票 (${opt.voters.length} 票)
                    </button>
                </div>
            `;
            
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
            }
        };

        pollContainer.classList.remove('hidden');
    } else {
        pollContainer.classList.add('hidden');
    }

    const expenseContainer = document.getElementById('view-expense-container');
    const expenseDetails = document.getElementById('view-expense-details');
    if (evt.isExpense && evt.payers && evt.payers.length > 0) {
        let totalExpense = evt.payers.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
        let totalWeight = (evt.sharers || []).reduce((sum, s) => sum + (parseFloat(s.weight) || 1), 0) || 1;
        let perWeightAmount = totalExpense / totalWeight;

        let html = `<div class="font-bold border-b border-amber-200 pb-1 mb-1">總支出：$${totalExpense.toLocaleString()} 元</div>`;
        html += `<div class="space-y-1">`;
        (evt.sharers || []).forEach(s => {
            let shareAmt = Math.round(perWeightAmount * (parseFloat(s.weight) || 1));
            html += `<div class="flex justify-between"><span>👤 ${s.name} (${s.weight}份)：</span><span class="font-bold">$${shareAmt.toLocaleString()} 元</span></div>`;
        });
        html += `</div>`;
        expenseDetails.innerHTML = html;
        expenseContainer.classList.remove('hidden');
    } else {
        expenseContainer.classList.add('hidden');
    }

    document.getElementById('view-modal').classList.add('hidden');
    document.getElementById('view-modal').classList.remove('hidden');
}

/* 儲存表單 */
document.getElementById('event-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    triggerHaptic();

    const titleVal = document.getElementById('event-title').value.trim();
    if (!titleVal) return alert('請輸入活動名稱！');

    const isRecurring = document.getElementById('event-is-lunar-recurring').checked;
    let lMonth = null, lDay = null;
    const startVal = document.getElementById('event-start-date').value;

    if (isRecurring && startVal) {
        const [y, m, d] = startVal.split('-').map(Number);
        const lunar = Solar.fromYmd(y, m, d).getLunar();
        lMonth = lunar.getMonth();
        lDay = lunar.getDay();
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

    let payersArr = [];
    let sharersArr = [];
    if (expenseCheckbox.checked) {
        document.querySelectorAll('.payer-row').forEach(row => {
            const name = row.querySelector('.payer-name').value.trim();
            const amount = parseFloat(row.querySelector('.payer-amount').value) || 0;
            if (name && amount > 0) payersArr.push({ name, amount });
        });
        document.querySelectorAll('.sharer-row').forEach(row => {
            const name = row.querySelector('.sharer-name').value.trim();
            const weight = parseFloat(row.querySelector('.sharer-weight').value) || 1;
            if (name) sharersArr.push({ name, weight });
        });
    }

    const eventData = {
        title: titleVal,
        icon: document.getElementById('event-icon').value,
        startDate: startVal,
        endDate: document.getElementById('event-end-date').value || startVal,
        isLunarRecurring: isRecurring,
        lunarMonth: lMonth,
        lunarDay: lDay,
        author: document.getElementById('event-author').value.trim() || '家族成員',
        color: document.querySelector('input[name="event-color"]:checked').value,
        photoUrl: document.getElementById('event-photo-url').value.trim(),
        videoUrl: document.getElementById('event-video-url').value.trim(), 
        fileUrl: document.getElementById('event-file-url').value.trim(),
        location: document.getElementById('event-location').value.trim(),
        mapUrl: document.getElementById('event-map-url').value.trim(),
        isChecklist: checklistCheckbox.checked && checklistArr.length > 0,
        checklist: checklistArr,
        isPoll: pollCheckbox.checked && pollOpts.length > 0,
        pollOptions: pollOpts,
        isExpense: expenseCheckbox.checked && payersArr.length > 0,
        payers: payersArr,
        sharers: sharersArr
    };

    if (currentEditingId) {
        await updateDoc(doc(eventsRef, currentEditingId), eventData);
    } else {
        await addDoc(eventsRef, eventData);
    }
    closeModal();
});

document.getElementById('btn-delete').addEventListener('click', async () => {
    if (currentEditingId && confirm('確定要刪除嗎？')) {
        await deleteDoc(doc(eventsRef, currentEditingId));
        closeModal();
    }
});

renderApp();