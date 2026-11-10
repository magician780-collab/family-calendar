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
                    <li>可以自由挑選可愛的圖示，以及為行程自訂「標籤顏色」。</li>
                    <li><b>進階功能：</b> 點開行程時，點擊底部的「編輯」即可修改，或點擊左下角「刪除」移除行程。</li>
                </ul>
            </section>
            
            <section>
                <h3 class="font-bold text-lg text-indigo-600 mb-2 flex items-center gap-2"><i class="fas fa-users"></i> 2. 家族專屬功能</h3>
                <ul class="list-disc pl-5 space-y-1">
                    <li><b class="text-indigo-600">保密投票：</b> 旅遊不知道要去哪？在新增活動時勾選「啟用活動意願投票」，輸入選項。大家就能在行程內投票，最高票的選項可以由發起人一鍵「拍板定案」！</li>
                    <li><b class="text-emerald-600">裝備任務清單：</b> 露營時誰帶帳篷？勾選「裝備/任務清單」，指定負責人，完成後還能打勾確認。全部完成會有驚喜喔！</li>
                    <li><b class="text-amber-600">代墊分帳：</b> 出去玩有人先墊錢？勾選「分帳功能」，輸入誰代墊、總額多少，以及大家的分攤份數（小孩算 0.5 份），系統會自動幫你算好每個人該給多少錢。</li>
                </ul>
            </section>
            
            <section>
                <h3 class="font-bold text-lg text-purple-600 mb-2 flex items-center gap-2"><i class="fas fa-photo-video"></i> 3. 影音回憶與地圖導航</h3>
                <ul class="list-disc pl-5 space-y-1">
                    <li><b>放入相片：</b> 將 Google Drive 的相片權限設為「知道連結的人皆可檢視」，把網址貼入「相片網址」欄位，行程就會出現漂亮的預覽圖。</li>
                    <li><b>放入影片：</b> 支援 YouTube 連結（包含 Shorts 短影音）與 Google Drive 影片，貼上後可直接在系統內點開觀看，並支援全螢幕！</li>
                    <li><b>相簿牆：</b> 點擊左側選單的 <b class="text-warm-600">📸 家庭回憶相簿牆</b>，就能一次回味所有帶有相片的精彩行程。</li>
                    <li><b class="text-blue-600 bg-blue-50 px-1 py-0.5 rounded">智慧導航與天氣：</b> 系統是根據「地點名稱」來抓取天氣。系統已內建全台縣市與大景點，只要在名稱內包含大範圍地名（如：<b>南投</b>白石馬露營區），就能精準預報！詳細地址可貼在導航網址欄位。</li>
                </ul>
            </section>

            <section>
                <h3 class="font-bold text-lg text-blue-600 mb-2 flex items-center gap-2"><i class="fas fa-radio"></i> 4. 隱藏彩蛋：專屬廣播電台</h3>
                <ul class="list-disc pl-5 space-y-1">
                    <li>系統內建一個隨時可以「自由拖曳移動」的音樂播放器。</li>
                    <li>您可以點擊選單，選擇 <b class="text-blue-600">手動輸入電台/YouTube網址</b>。</li>
                    <li>不管是喜歡的 MP3 音樂，或是 <b>YouTube 上的 24 小時新聞/音樂直播</b>，貼上網址就能讓系統邊播音樂邊看行事曆囉！</li>
                </ul>
            </section>
            
            <section class="bg-amber-50 p-4 rounded-xl border border-amber-200">
                <h3 class="font-bold text-lg text-amber-800 mb-1 flex items-center gap-2"><i class="fas fa-shield-alt"></i> 管理員專區</h3>
                <p class="text-amber-700">左側選單的 <i class="fas fa-cog"></i> 齒輪圖示是管理員後台。內含「一鍵匯入政府國定假日」與「雲端備份還原」功能。這些功能可能會覆蓋重要資料，因此已加上密碼鎖保護，確保家族紀錄的安全。</p>
            </section>
        </div>
    `;

    modal.innerHTML = `
        <div class="bg-white w-full max-w-2xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden modal-content" onclick="event.stopPropagation()">
            <div class="px-6 py-4 bg-blue-50 border-b border-blue-100 flex justify-between items-center shrink-0">
                <h3 class="font-bold text-blue-900 flex items-center gap-2"><i class="fas fa-book-open text-blue-600"></i> 系統說明書</h3>
                <button id="btn-close-manual-modal" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times text-xl"></i></button>
            </div>
            <div class="p-6 overflow-y-auto flex-1 hide-scrollbar">
                ${manualContent}
            </div>
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
    ai_cyber: { 50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd', 400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8', 800: '#1e40af', 900: '#1e3a8a' },
    ai_matrix: { 50: '#ecfdf5', 100: '#d1fae5', 200: '#a7f3d0', 300: '#6ee7b7', 400: '#34d399', 500: '#10b981', 600: '#059669', 700: '#047857', 800: '#065f46', 900: '#064e3b' },
    ai_neon: { 50: '#fdf4ff', 100: '#fae8ff', 200: '#f5d0fe', 300: '#f0abfc', 400: '#e879f9', 500: '#d946ef', 600: '#c026d3', 700: '#a21caf', 800: '#86198f', 900: '#701a75' },
    ai_quantum: { 50: '#eef2ff', 100: '#e0e7ff', 200: '#c7d2fe', 300: '#a5b4fc', 400: '#818cf8', 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca', 800: '#3730a3', 900: '#312e81' },
    ai_neural: { 50: '#fff1f2', 100: '#ffe4e6', 200: '#fecdd3', 300: '#fda4af', 400: '#fb7185', 500: '#f43f5e', 600: '#e11d48', 700: '#be123c', 800: '#881337', 900: '#4c0519' },
    macaron_pink: { 50: '#fff0f5', 100: '#ffe4e1', 200: '#ffc0cb', 300: '#ffb6c1', 400: '#ff69b4', 500: '#ff9eb5', 600: '#ff7b9c', 700: '#ff5c8a', 800: '#d84a72', 900: '#b03a5b' },
    macaron_blue: { 50: '#f0f8ff', 100: '#e6f2ff', 200: '#cce5ff', 300: '#99ccff', 400: '#66b2ff', 500: '#a2d2ff', 600: '#7ebdf6', 700: '#5aa8ec', 800: '#3993e2', 900: '#1a7dd8' },
    macaron_purple: { 50: '#f8f4ff', 100: '#f3e8ff', 200: '#e6ccff', 300: '#d9b3ff', 400: '#cc99ff', 500: '#cdb4db', 600: '#b892c9', 700: '#a370b7', 800: '#8e4ea5', 900: '#792c93' },
    macaron_yellow: { 50: '#fffff0', 100: '#ffffe0', 200: '#fffacd', 300: '#fff68f', 400: '#ffebcd', 500: '#fcf6bd', 600: '#e9e29c', 700: '#d6ce7b', 800: '#c3ba5a', 900: '#b0a639' },
    macaron_green: { 50: '#f0fff0', 100: '#e0ffe0', 200: '#ccffcc', 300: '#b3ffb3', 400: '#99ff99', 500: '#d0f4de', 600: '#addcb8', 700: '#8ac492', 800: '#67ac6c', 900: '#449446' },
    cherry: { 50: '#fff1f2', 100: '#ffe4e6', 200: '#fecdd3', 300: '#fda4af', 400: '#fb7185', 500: '#f43f5e', 600: '#e11d48', 700: '#be123c', 800: '#881337', 900: '#4c0519' },
    ocean: { 50: '#f0f9ff', 100: '#e0f2fe', 200: '#bae6fd', 300: '#7dd3fc', 400: '#38bdf8', 500: '#0ea5e9', 600: '#0284c7', 700: '#0369a1', 800: '#075985', 900: '#0c4a6e' },
    sunset: { 50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a', 300: '#fcd34d', 400: '#fbbf24', 500: '#f59e0b', 600: '#d97706', 700: '#b45309', 800: '#92400e', 900: '#78350f' },
    lavender: { 50: '#f5f3ff', 100: '#ede9fe', 200: '#ddd6fe', 300: '#c4b5fd', 400: '#a78bfa', 500: '#8b5cf6', 600: '#7c3aed', 700: '#6d28d9', 800: '#5b21b6', 900: '#4c1d95' },
    coffee: { 50: '#fdf8f6', 100: '#f2e8e5', 200: '#eaddd7', 300: '#e0cec7', 400: '#d2b48c', 500: '#bc8f8f', 600: '#8b4513', 700: '#654321', 800: '#4a2e18', 900: '#331a00' },
    galaxy: { 50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1', 400: '#94a3b8', 500: '#64748b', 600: '#475569', 700: '#334155', 800: '#1e293b', 900: '#0f172a' },
    lemon: { 50: '#fefce8', 100: '#fef9c3', 200: '#fef08a', 300: '#fde047', 400: '#facc15', 500: '#eab308', 600: '#ca8a04', 700: '#a16207', 800: '#854d0e', 900: '#713f12' },
    peach: { 50: '#fff1f2', 100: '#ffe4e6', 200: '#fecdd3', 300: '#fda4af', 400: '#fb7185', 500: '#ff7f50', 600: '#fa8072', 700: '#e9967a', 800: '#cd5c5c', 900: '#8b0000' },
    matcha: { 50: '#f4f6f0', 100: '#e3e8d7', 200: '#c8d3b2', 300: '#a7b889', 400: '#829762', 500: '#657945', 600: '#506035', 700: '#3f4c29', 800: '#303a1f', 900: '#232a17' },
    arctic: { 50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1', 400: '#94a3b8', 500: '#64748b', 600: '#475569', 700: '#334155', 800: '#1e293b', 900: '#0f172a' }
};

function initThemeSelectOptions() {
    const sel = document.getElementById('theme-select');
    if (!sel) return;
    sel.innerHTML = '';
    const customThemes = [
        { id: 'warm', name: '🍊 溫馨暖橘' }, { id: 'forest', name: '🌿 清新森林' }, { id: 'purple', name: '💜 浪漫柔紫' },
        { id: 'ai_cyber', name: '🤖 AI 賽博藍' }, { id: 'ai_matrix', name: '🟩 AI 數位綠' }, { id: 'ai_neon', name: '🔮 AI 霓虹紫' },
        { id: 'ai_quantum', name: '⚡ AI 量子紫藍' }, { id: 'ai_neural', name: '🧬 AI 神經紅' },
        { id: 'macaron_pink', name: '🎀 馬卡龍粉' }, { id: 'macaron_blue', name: '🍼 馬卡龍藍' }, { id: 'macaron_purple', name: '🦄 馬卡龍紫' },
        { id: 'macaron_yellow', name: '🐣 馬卡龍黃' }, { id: 'macaron_green', name: '🍈 馬卡龍綠' },
        { id: 'cherry', name: '🌸 櫻花紛飛' }, { id: 'ocean', name: '🌊 蔚藍海洋' }, { id: 'sunset', name: '🌇 夕陽黃昏' },
        { id: 'lavender', name: '🪻 薰衣草園' }, { id: 'coffee', name: '☕ 拿鐵咖啡' }, { id: 'galaxy', name: '🌌 深邃星空' },
        { id: 'lemon', name: '🍋 萊姆檸檬' }, { id: 'peach', name: '🍑 甜美蜜桃' }, { id: 'matcha', name: '🍵 濃郁抹茶' },
        { id: 'arctic', name: '❄️ 北極冰川' }
    ];
    customThemes.forEach(t => { const opt = document.createElement('option'); opt.value = t.id; opt.textContent = t.name; sel.appendChild(opt); });
    const savedTheme = localStorage.getItem('family_app_theme') || 'warm';
    if (customThemes.some(t => t.id === savedTheme)) { sel.value = savedTheme; } 
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

const importGovBtn = document.getElementById('btn-import-gov-holidays');
if (importGovBtn) {
    importGovBtn.innerHTML = '<i class="fas fa-calendar-alt"></i> 一鍵匯入年度國定假日 (可自訂年份)';
    importGovBtn.addEventListener('click', () => {
        triggerHaptic();
        requestAdminAccess(async () => {
            const defaultYear = currentDate.getFullYear();
            const yearStr = prompt('請輸入您要匯入國定假日的「西元年份」：', defaultYear);
            if (!yearStr) return;
            const targetYear = parseInt(yearStr, 10);
            if (isNaN(targetYear) || targetYear < 2020 || targetYear > 2100) return alert('請輸入有效的西元年份！');
            try {
                const lunarJan1 = Lunar.fromYmd(targetYear, 1, 1).getSolar();
                const eve = lunarJan1.next(-1);
                const dragonBoat = Lunar.fromYmd(targetYear, 5, 5).getSolar();
                const midAutumn = Lunar.fromYmd(targetYear, 8, 15).getSolar();
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
                    if (!isExist) { await addDoc(eventsRef, h); importedCount++; }
                }
                if (importedCount > 0) alert(`🎉 成功新增 ${targetYear} 年的 ${importedCount} 筆國定假日！`);
                else alert(`ℹ️ 行事曆中已經有 ${targetYear} 年的國定假日了，無須重複匯入！`);
            } catch (err) { alert('匯入失敗，請檢查網路連線。'); }
        });
    });
}

if (importGovBtn && !document.getElementById('btn-cleanup-holidays')) {
    const cleanupBtn = document.createElement('button');
    cleanupBtn.id = 'btn-cleanup-holidays';
    cleanupBtn.className = 'w-full py-2.5 mt-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm cursor-pointer transition-all active:scale-95';
    cleanupBtn.innerHTML = '<i class="fas fa-broom"></i> 清除重複的國定假日';
    importGovBtn.parentNode.appendChild(cleanupBtn);
    cleanupBtn.addEventListener('click', () => {
        requestAdminAccess(async () => {
            if (!confirm('確定要掃描並清除重複匯入的「政府行事曆」假日嗎？')) return;
            triggerHaptic();
            try {
                const govEvents = events.filter(e => e.author === '政府行事曆');
                const seen = new Set();
                const duplicates = [];
                for (const evt of govEvents) {
                    const uniqueKey = `${evt.title}_${evt.startDate}`;
                    if (seen.has(uniqueKey)) duplicates.push(evt.id); else seen.add(uniqueKey); 
                }
                if (duplicates.length === 0) return alert('✅ 目前行事曆中沒有發現重複的假日。');
                if (confirm(`發現 ${duplicates.length} 筆重複的假日，確定要立即刪除嗎？`)) {
                    for (const id of duplicates) await deleteDoc(doc(eventsRef, id));
                    alert(`🎉 成功清除 ${duplicates.length} 筆重複假日！`);
                }
            } catch (err) { alert('清除失敗，請檢查網路連線。'); }
        });
    });
}

const exportBtn = document.getElementById('btn-export-json');
const importInput = document.getElementById('input-import-json');
if (exportBtn && importInput) {
    const importLabel = importInput.parentElement;
    const sectionLabel = exportBtn.closest('.space-y-2').querySelector('label');
    if (sectionLabel) sectionLabel.innerHTML = '☁️ 雲端備份與手機檔案匯入';
    exportBtn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> 建立新備份至雲端';
    exportBtn.className = 'py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer';

    const cloudRestoreBtn = document.createElement('button');
    cloudRestoreBtn.id = 'btn-cloud-restore';
    cloudRestoreBtn.className = 'py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer';
    cloudRestoreBtn.innerHTML = '<i class="fas fa-history"></i> 選擇歷史紀錄還原';

    const gridContainer = exportBtn.closest('.grid');
    gridContainer.className = 'flex flex-col gap-2'; 
    gridContainer.insertBefore(cloudRestoreBtn, importLabel);

    const importBtn = document.createElement('button');
    importBtn.id = 'btn-local-import';
    importBtn.className = 'w-full py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer border border-blue-200';
    importBtn.innerHTML = '<i class="fas fa-folder-open"></i> 從 iPhone/本機 選擇檔案匯入';
    
    importLabel.parentNode.replaceChild(importBtn, importLabel);
    importBtn.parentNode.appendChild(importInput);

    importBtn.addEventListener('click', (e) => {
        e.preventDefault();
        triggerHaptic();
        requestAdminAccess(() => {
            importInput.click();
        });
    });

    importInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!confirm('⚠️ 警告：匯入手機檔案將會【完全覆蓋】目前行事曆上的所有行程與成員！確定要繼續嗎？')) {
            e.target.value = ''; return;
        }

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                importBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 匯入中...';
                importBtn.style.pointerEvents = 'none';

                const importedData = JSON.parse(event.target.result);
                const eventsToImport = importedData.events || (Array.isArray(importedData) ? importedData : []);
                const membersToImport = importedData.familyMembers || [];

                for (const evt of events) await deleteDoc(doc(eventsRef, evt.id));
                for (const ev of eventsToImport) { delete ev.id; await addDoc(eventsRef, ev); }

                for (const m of familyMembers) await deleteDoc(doc(membersRef, m.id));
                for (const m of membersToImport) { delete m.id; await addDoc(membersRef, m); }

                if (importedData.note !== undefined) {
                    await setDoc(noteRef, { content: importedData.note }, { merge: true });
                }

                alert('🎉 檔案匯入成功！已成功載入您的完整紀錄。');
                document.getElementById('member-modal').classList.add('hidden');
            } catch (err) {
                alert('讀取檔案失敗，請確認是否為正確的 JSON 備份檔。');
            } finally {
                importBtn.innerHTML = '<i class="fas fa-folder-open"></i> 從 iPhone/本機 選擇檔案匯入';
                importBtn.style.pointerEvents = 'auto';
                e.target.value = '';
            }
        };
        reader.readAsText(file);
    });

    exportBtn.addEventListener('click', () => {
        requestAdminAccess(async () => {
            if(!confirm('確定要將目前的「所有行程與成員」建立一份新備份到雲端嗎？')) return;
            triggerHaptic();
            try {
                exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 備份中...'; exportBtn.disabled = true;
                const backupData = { 
                    exportDate: new Date().toISOString(), 
                    events: events,
                    familyMembers: familyMembers,
                    note: document.getElementById('family-sticky-note').value
                };
                const backupId = Date.now().toString();
                await setDoc(doc(db, 'familyBackups', backupId), backupData);
                alert('🎉 雲端備份成功！已建立一份包含成員的全新備份存檔。');
            } catch (err) { alert('備份失敗，請檢查網路連線。'); } 
            finally { exportBtn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> 建立新備份至雲端'; exportBtn.disabled = false; }
        });
    });

    cloudRestoreBtn.addEventListener('click', () => {
        requestAdminAccess(async () => {
            triggerHaptic();
            try {
                cloudRestoreBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 讀取歷史...'; cloudRestoreBtn.disabled = true;
                const snap = await getDocs(collection(db, 'familyBackups'));
                if (snap.empty) { alert('☁️ 目前雲端沒有找到任何備份紀錄喔！請先建立備份。'); return; }
                const backupsList = [];
                snap.forEach(d => backupsList.push({ id: d.id, ...d.data() }));
                backupsList.sort((a, b) => new Date(b.exportDate) - new Date(a.exportDate));

                const modal = document.createElement('div');
                modal.className = 'fixed inset-0 bg-warm-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-fade-in';
                let listHtml = '';
                backupsList.slice(0, 10).forEach((b, index) => {
                    const timeStr = new Date(b.exportDate).toLocaleString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute:'2-digit', second:'2-digit' });
                    const badge = index === 0 ? '<span class="px-2 py-0.5 bg-rose-100 text-rose-700 rounded-full text-[10px] ml-2 font-bold">最新</span>' : '';
                    listHtml += `
                        <button class="w-full text-left bg-white p-3 rounded-xl border hover:bg-amber-50 hover:border-amber-400 transition-all flex justify-between items-center group cursor-pointer shadow-sm" data-id="${b.id}">
                            <div><div class="font-bold text-gray-800 flex items-center">${timeStr} ${badge}</div><div class="text-xs text-gray-500 mt-1">包含 ${b.events ? b.events.length : 0} 筆行程</div></div>
                            <i class="fas fa-download text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity text-lg"></i>
                        </button>`;
                });
                modal.innerHTML = `
                    <div class="bg-white w-full max-w-sm rounded-3xl shadow-2xl flex flex-col overflow-hidden" onclick="event.stopPropagation()">
                        <div class="px-5 py-4 bg-amber-50 border-b border-amber-100 flex justify-between items-center">
                            <h3 class="font-bold text-amber-900 flex items-center gap-2"><i class="fas fa-history text-amber-500"></i> 選擇要還原的歷史備份</h3>
                            <button id="btn-close-backup-modal" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times text-xl"></i></button>
                        </div>
                        <div class="p-4 space-y-3 max-h-[60vh] overflow-y-auto bg-gray-50">${listHtml}</div>
                    </div>`;
                document.body.appendChild(modal);

                document.getElementById('btn-close-backup-modal').onclick = () => modal.remove();
                modal.onclick = () => modal.remove();

                modal.querySelectorAll('button[data-id]').forEach(btn => {
                    btn.onclick = async (e) => {
                        e.stopPropagation();
                        const bId = btn.getAttribute('data-id');
                        const selectedBackup = backupsList.find(b => b.id === bId);
                        const timeStr = new Date(selectedBackup.exportDate).toLocaleString('zh-TW');
                        if(confirm(`⚠️ 嚴重警告：\n還原將會【完全覆蓋】您目前行事曆上的所有行程與成員！\n\n確定要時光倒流，還原到 ${timeStr} 的版本嗎？`)) {
                            modal.remove(); cloudRestoreBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 還原中...'; cloudRestoreBtn.disabled = true;
                            try {
                                const eventsToRestore = selectedBackup.events || [];
                                const membersToRestore = selectedBackup.familyMembers || [];

                                for (const evt of events) await deleteDoc(doc(eventsRef, evt.id));
                                for (const ev of eventsToRestore) { delete ev.id; await addDoc(eventsRef, ev); }

                                for (const m of familyMembers) await deleteDoc(doc(membersRef, m.id));
                                for (const m of membersToRestore) { delete m.id; await addDoc(membersRef, m); }

                                if (selectedBackup.note !== undefined) {
                                    await setDoc(noteRef, { content: selectedBackup.note }, { merge: true });
                                }

                                alert('🎉 雲端還原大成功！已成功回到您選擇的歷史時間點。');
                                document.getElementById('member-modal').classList.add('hidden');
                            } catch (err) { alert('寫入資料失敗，請檢查網路。'); }
                        }
                    };
                });
            } catch (err) { alert('讀取雲端歷史紀錄失敗，請檢查網路連線。'); } 
            finally { cloudRestoreBtn.innerHTML = '<i class="fas fa-history"></i> 選擇歷史紀錄還原'; cloudRestoreBtn.disabled = false; }
        });
    });
}

const galleryModal = document.getElementById('gallery-modal');
document.getElementById('btn-open-gallery').addEventListener('click', () => { triggerHaptic(); renderGalleryGrid(); galleryModal.classList.remove('hidden'); });
document.getElementById('btn-close-gallery').addEventListener('click', () => { triggerHaptic(); galleryModal.classList.add('hidden'); });

function renderGalleryGrid() {
    const container = document.getElementById('gallery-grid-container');
    container.innerHTML = '';
    
    const photoEvents = events.filter(e => e.photoUrl && e.photoUrl.trim() !== '').sort((a, b) => b.startDate.localeCompare(a.startDate));
    
    container.style.cssText = 'background-color: #fdfbf9; background-image: linear-gradient(#e5e7eb 1px, transparent 1px), linear-gradient(90deg, #e5e7eb 1px, transparent 1px); background-size: 20px 20px;';
    
    if (photoEvents.length === 0) {
        container.className = 'flex flex-col items-center justify-center h-full w-full';
        container.innerHTML = `
            <div class="text-center animate-fade-in flex flex-col items-center">
                <div class="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-4 shadow-md border-2 border-dashed border-warm-300">
                    <i class="fas fa-camera-retro text-3xl text-warm-300"></i>
                </div>
                <h4 class="text-lg font-bold text-gray-700 mb-1">相簿牆空空如也</h4>
                <p class="text-sm text-gray-400">快去行程裡貼上相片網址吧！</p>
            </div>`;
        return;
    }
    
    container.className = 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5 md:gap-8 items-start content-start p-6 md:p-8 overflow-x-hidden';
    
    const rotates = ['-rotate-3', 'rotate-2', '-rotate-2', 'rotate-3', '-rotate-4', 'rotate-4'];
    const tapeColors = ['bg-rose-200/80 border-rose-300', 'bg-amber-200/80 border-amber-300', 'bg-blue-200/80 border-blue-300', 'bg-emerald-200/80 border-emerald-300'];
    const tapeRotates = ['rotate-2', '-rotate-3', 'rotate-1', '-rotate-2'];

    photoEvents.forEach((evt, index) => {
        const item = document.createElement('div');
        
        const cardRot = rotates[index % rotates.length];
        const tColor = tapeColors[index % tapeColors.length];
        const tRot = tapeRotates[index % tapeRotates.length];
        const animDelay = (index * 50) + 'ms'; 
        
        item.className = `relative bg-white p-2 md:p-3 pb-8 md:pb-10 rounded-sm shadow-md border border-gray-100 cursor-pointer flex flex-col transform transition-all duration-300 hover:z-20 hover:scale-110 hover:rotate-0 hover:shadow-2xl animate-fade-in ${cardRot}`;
        item.style.animationDelay = animDelay;
        item.style.animationFillMode = 'both';
        
        const imgUrl = getDirectImageUrl(evt.photoUrl);
        const dateStr = evt.startDate.replace(/-/g, '.');

        item.innerHTML = `
            <div class="absolute -top-2 left-1/2 transform -translate-x-1/2 w-12 md:w-16 h-4 md:h-5 ${tColor} border-x-2 border-dashed z-10 ${tRot}" style="mix-blend-mode: multiply;"></div>
            
            <div class="aspect-square w-full overflow-hidden bg-gray-100 relative shadow-inner">
                <img src="${imgUrl}" class="w-full h-full object-cover filter contrast-[1.05] brightness-[1.02]" loading="lazy">
                
                <div class="absolute bottom-1.5 right-1.5 z-10">
                    <span class="text-orange-500 font-mono text-[10px] md:text-xs font-bold drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)] tracking-tighter">
                        '${dateStr.slice(2)}
                    </span>
                </div>
            </div>
            
            <div class="absolute bottom-1 md:bottom-2 left-0 w-full text-center px-2 flex flex-col justify-center">
                <h4 class="font-bold text-gray-800 text-[11px] md:text-sm truncate">
                    ${evt.icon ? evt.icon + ' ' : ''}${evt.title}
                </h4>
                ${evt.location ? `<p class="text-[9px] md:text-[10px] text-gray-400 truncate mt-0.5"><i class="fas fa-map-marker-alt"></i> ${evt.location}</p>` : ''}
            </div>
        `;
        
        item.addEventListener('click', () => { 
            if(typeof triggerHaptic === 'function') triggerHaptic(); 
            document.getElementById('gallery-modal').classList.add('hidden'); 
            openViewModal(evt.id); 
        });
        
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
function updateUniqueSelects(containerId, selectClass) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const selects = Array.from(container.querySelectorAll(selectClass));
    const selectedValues = selects.map(s => s.value).filter(v => v !== '');
    selects.forEach(select => {
        const currentValue = select.value;
        Array.from(select.options).forEach(option => {
            if (option.value === '') return;
            if (selectedValues.includes(option.value) && option.value !== currentValue) { option.disabled = true; option.textContent = `${option.value} (已選)`; } 
            else { option.disabled = false; option.textContent = option.value; }
        });
    });
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

const expenseCheckbox = document.getElementById('event-is-expense');
const expenseFields = document.getElementById('expense-fields');
const payersContainer = document.getElementById('payers-container');
const sharersContainer = document.getElementById('sharers-container');
expenseCheckbox.addEventListener('change', (e) => {
    expenseFields.classList.toggle('hidden', !e.target.checked);
    if (e.target.checked && payersContainer.children.length === 0) { addPayerRow(); addSharerRow(); }
});

function addPayerRow(name = '', amount = '', note = '') {
    const row = document.createElement('div');
    row.className = 'flex items-center gap-1 payer-row';
    row.innerHTML = `
        <select class="payer-name w-[28%] px-2 py-1.5 bg-white border rounded-xl text-xs outline-none cursor-pointer" required>${getMemberOptions(name, '代墊人...')}</select>
        <input type="number" placeholder="金額 $" value="${amount}" class="payer-amount w-[25%] px-2 py-1.5 bg-white border rounded-xl text-xs outline-none" required>
        <input type="text" placeholder="備註(如:門票)" value="${note}" class="payer-note flex-1 px-2 py-1.5 bg-white border rounded-xl text-xs outline-none">
        <button type="button" class="text-rose-400 p-1"><i class="fas fa-trash-alt"></i></button>
    `;
    row.querySelector('button').addEventListener('click', () => { row.remove(); updateUniqueSelects('payers-container', '.payer-name'); });
    row.querySelector('.payer-name').addEventListener('change', () => { updateUniqueSelects('payers-container', '.payer-name'); });
    payersContainer.appendChild(row);
    updateUniqueSelects('payers-container', '.payer-name');
}
document.getElementById('btn-add-payer').addEventListener('click', () => addPayerRow('', '', ''));

function addSharerRow(name = '', weight = 1) {
    const row = document.createElement('div');
    row.className = 'flex items-center gap-2 sharer-row';
    row.innerHTML = `
        <select class="sharer-name flex-1 px-3 py-1.5 bg-white border rounded-xl text-xs outline-none cursor-pointer" required>${getMemberOptions(name, '分攤對象...')}</select>
        <div class="flex items-center bg-white border rounded-xl px-2 py-1">
            <input type="number" min="0.5" step="0.5" value="${weight}" class="sharer-weight w-12 text-center text-xs font-bold outline-none">
            <span class="text-[10px]">份</span>
        </div>
        <button type="button" class="text-rose-400 p-1"><i class="fas fa-trash-alt"></i></button>
    `;
    row.querySelector('button').addEventListener('click', () => { row.remove(); updateUniqueSelects('sharers-container', '.sharer-name'); });
    row.querySelector('.sharer-name').addEventListener('change', () => { updateUniqueSelects('sharers-container', '.sharer-name'); });
    sharersContainer.appendChild(row);
    updateUniqueSelects('sharers-container', '.sharer-name');
}
document.getElementById('btn-add-sharer').addEventListener('click', () => addSharerRow('', 1));

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

    const isGovHoliday = dayEvents.some(e => e.author === '政府行事曆');
    const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
    const isRedDay = isWeekend || isGovHoliday;

    let cellBgClass = isToday ? 'bg-warm-50' : (isRedDay ? 'bg-rose-50/80 border-rose-200' : 'bg-white');
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

    cell.innerHTML = `
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
    const todayStr = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;
    
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
    activeCellDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
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
        document.getElementById('event-start-date').value = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
        authorSelect.innerHTML = getMemberOptions('', '請選擇建立者...');
    }
    document.getElementById('event-modal').classList.remove('hidden');
}
function closeModal() { document.getElementById('event-modal').classList.add('hidden'); }

const twLocations = {
    "台北":{lat:25.033,lng:121.565},"新北":{lat:25.011,lng:121.461},"桃園":{lat:24.993,lng:121.301},"台中":{lat:24.147,lng:120.673},"台南":{lat:22.999,lng:120.227},
    "高雄":{lat:22.627,lng:120.301},"基隆":{lat:25.127,lng:121.739},"新竹":{lat:24.813,lng:120.967},"苗栗":{lat:24.56,lng:120.821},"彰化":{lat:24.075,lng:120.544},
    "南投":{lat:23.903,lng:120.693},"埔里":{lat:23.966,lng:120.966},"雲林":{lat:23.709,lng:120.431},"嘉義":{lat:23.48,lng:120.453},"屏東":{lat:22.668,lng:120.486},
    "恆春":{lat:22.002,lng:120.741},"宜蘭":{lat:24.757,lng:121.753},"花蓮":{lat:23.987,lng:121.601},"台東":{lat:22.758,lng:121.144},"澎湖":{lat:23.571,lng:119.579},
    "金門":{lat:24.449,lng:118.377},"馬祖":{lat:26.16,lng:119.94},"阿里山":{lat:23.508,lng:120.801},"合歡山":{lat:24.143,lng:121.271},"墾丁":{lat:21.944,lng:120.796},
    "日月潭":{lat:23.852,lng:120.925},"清境":{lat:24.058,lng:121.156},"武陵":{lat:24.364,lng:121.314},"太平山":{lat:24.492,lng:121.536},"拉拉山":{lat:24.721,lng:121.422},
    "小琉球":{lat:22.343,lng:120.368},"綠島":{lat:22.661,lng:121.488},"蘭嶼":{lat:22.057,lng:121.532}
};

function openViewModal(id) {
    const evt = events.find(e => e.id === id);
    if (!evt) return;
    currentViewingId = id;
    document.getElementById('view-modal-header').className = `h-20 w-full ${evt.color}`;
    document.getElementById('view-title').innerText = (evt.icon ? evt.icon + ' ' : '') + evt.title;
    document.getElementById('view-date').innerText = evt.startDate === evt.endDate ? evt.startDate : `${evt.startDate} ~ ${evt.endDate}`;
    document.getElementById('view-author').innerText = `建立者：${evt.author}`;

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
        weatherBox.className = 'w-full py-2.5 bg-sky-50 text-sky-800 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 shadow-sm mt-2 px-2 text-center transition-all';
        mMapBox.appendChild(weatherBox);
    }
    weatherBox.classList.add('hidden');
    weatherBox.className = 'w-full py-2.5 bg-sky-50 text-sky-800 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 shadow-sm mt-2 px-2 text-center transition-all';

    if (evt.mapUrl || evt.location) {
        mLocText.innerText = evt.location || '點擊開啟地圖導航';
        mMapLink.href = evt.mapUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(evt.location)}`;
        mMapBox.classList.remove('hidden');

        if (evt.location && evt.startDate) {
            weatherBox.classList.remove('hidden');
            weatherBox.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 正在為您查詢當地氣象...';
            
            let foundCoord = null;
            let foundName = evt.location;
            
            for (const [key, coords] of Object.entries(twLocations)) {
                if (evt.location.includes(key)) {
                    foundCoord = coords;
                    foundName = key;
                    break;
                }
            }

            const weatherFetchPromise = foundCoord 
                ? fetch(`https://api.open-meteo.com/v1/forecast?latitude=${foundCoord.lat}&longitude=${foundCoord.lng}&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=Asia%2FTaipei&forecast_days=16&past_days=7`)
                    .then(r => r.json())
                    .then(wData => ({ wData, locName: foundName }))
                : fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(evt.location)}&count=1&language=zh`)
                    .then(r => r.json())
                    .then(geo => {
                        if(geo.results && geo.results.length > 0) {
                            const { latitude, longitude, name } = geo.results[0];
                            return fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=Asia%2FTaipei&forecast_days=16&past_days=7`)
                                .then(r => r.json())
                                .then(wData => ({ wData, locName: name }));
                        }
                        throw new Error('找不到地點');
                    });

            weatherFetchPromise
                .then(({ wData, locName }) => {
                    const idx = wData.daily.time.indexOf(evt.startDate);
                    if (idx !== -1 && wData.daily.temperature_2m_max[idx] !== null) {
                        const wCode = wData.daily.weathercode[idx];
                        const desc = weatherDescMap[wCode] || '☁️ 未知';
                        const isRainy = [51,53,55,61,63,65,80,81,82,95].includes(wCode);
                        
                        if (isRainy) {
                            weatherBox.className = 'w-full py-2.5 bg-indigo-100 text-indigo-900 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 shadow-md mt-2 px-2 text-center ring-2 ring-indigo-400 animate-pulse transition-all';
                        } else {
                            weatherBox.className = 'w-full py-2.5 bg-sky-50 text-sky-800 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 shadow-sm mt-2 px-2 text-center transition-all';
                        }

                        const max = Math.round(wData.daily.temperature_2m_max[idx]);
                        const min = Math.round(wData.daily.temperature_2m_min[idx]);
                        let weatherTips = isRainy ? "預計有雨，記得帶傘或雨棚！" : "天氣不錯喔！";
                        
                        weatherBox.innerHTML = `
                            <div class="flex flex-col items-center">
                                <div class="flex items-center gap-1.5"><i class="fas fa-map-marker-alt"></i> 成功定位 [${locName}]</div>
                                <div class="text-base mt-0.5">${desc} | ${min}~${max}°C</div>
                                <div class="text-[11px] opacity-80 mt-0.5">${weatherTips}</div>
                            </div>
                        `;
                    } else {
                        const tDate = new Date(evt.startDate);
                        const nDate = new Date();
                        const diff = Math.ceil((tDate - nDate) / (1000 * 60 * 60 * 24));
                        if (diff > 14) {
                            weatherBox.innerHTML = `<i class="fas fa-calendar-check text-sky-600"></i> 已定位 [${locName}]：預報僅支援14天內，快出發時再來看！`;
                        } else if (diff < -7) {
                            weatherBox.innerHTML = `<i class="fas fa-history text-sky-600"></i> 已定位 [${locName}]：這是過去的行程囉。`;
                        } else {
                            weatherBox.innerHTML = `<i class="fas fa-info-circle text-sky-600"></i> 已定位 [${locName}]：當日無氣象資料。`;
                        }
                    }
                })
                .catch(() => {
                    weatherBox.innerHTML = `<i class="fas fa-search-location text-amber-600"></i> 氣象站查無此私人地點，請改填「縣市區」(如:南投)`;
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
                <span class="text-[10px] bg-warm-50 text-warm-700 px-2 py-0.5 rounded-full font-bold">${item.assignee || '未認領'}</span>
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
            if (hasVoted) { opt.disabled = true; opt.textContent = `${m.name} (已投票，不可再選)`; } else opt.textContent = m.name;
            voterSelect.appendChild(opt);
        });

        const voter = voterSelect.value;
        votedMembersBanner.innerHTML = allVotedMembersArr.length > 0 ? `<i class="fas fa-check-circle text-emerald-600 mr-1"></i> 已投票成員：<strong>${allVotedMembersArr.join(', ')}</strong>` : `<i class="far fa-clock text-indigo-500 mr-1"></i> 尚無成員投票`;

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

        // 1. 計算代墊的錢 (債權)
        evt.payers.forEach(p => {
            let amt = parseFloat(p.amount) || 0;
            balances[p.name] = (balances[p.name] || 0) + amt;
            totalExpense += amt;
        });

        // 2. 計算應分攤的錢 (債務)
        let totalWeight = (evt.sharers || []).reduce((sum, s) => sum + (parseFloat(s.weight) || 1), 0) || 1;
        let perWeightAmount = totalExpense / totalWeight;

        (evt.sharers || []).forEach(s => {
            let shareAmt = perWeightAmount * (parseFloat(s.weight) || 1);
            balances[s.name] = (balances[s.name] || 0) - shareAmt;
        });

        // 3. 分出債權人(正數)與債務人(負數)
        let debtors = [];
        let creditors = [];
        for (let name in balances) {
            let b = Math.round(balances[name]);
            if (b < -1) debtors.push({ name, amount: -b });
            else if (b > 1) creditors.push({ name, amount: b });
        }

        // 4. 開始互抵撮合
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
                                <span class="text-gray-700"><strong>${p.name}</strong> 墊付${p.note ? '：「<span class="text-amber-700 font-medium">'+p.note+'</span>」' : ''}</span>
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
                            <span class="font-bold text-sm text-gray-800">👤 ${t.from}</span>
                            <span class="text-xs text-gray-500 mt-0.5">應轉給 <strong class="text-gray-700">${t.to}</strong></span>
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
        isExpense: expenseCheckbox.checked && payersArr.length > 0, payers: payersArr, sharers: sharersArr
    };

    if (currentEditingId) { await updateDoc(doc(eventsRef, currentEditingId), eventData); } 
    else { await addDoc(eventsRef, eventData); }
    closeModal();
});

document.getElementById('btn-delete').addEventListener('click', async () => {
    if (currentEditingId && confirm('確定要刪除嗎？')) { await deleteDoc(doc(eventsRef, currentEditingId)); closeModal(); }
});

// === 家族專屬：固定吸附式電台播放器 (真正移除拖曳，防誤觸版) ===
function initRadioPlayer() {
    if (document.getElementById('radio-widget')) return;

    let stations = [
        { name: "🎤 A-Lin 抒情金曲串燒 (YouTube)", url: "https://www.youtube.com/watch?v=BkSSOGNeWTM", type: "live" },
        { name: "🏠 我們家的專屬主題曲 (Suno AI)", url: "https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3", type: "bgm" },
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
    // 固定在右下角，完全移除拖曳用的絕對座標
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