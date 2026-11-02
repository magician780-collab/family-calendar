import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, setDoc, getDoc, onSnapshot, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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

/* 主題風格 */
const themePalettes = {
    warm: { 50: '#fff7ed', 100: '#ffedd5', 200: '#fed7aa', 300: '#fdba74', 400: '#fb923c', 500: '#f97316', 600: '#ea580c', 700: '#c2410c', 800: '#9a3412', 900: '#7c2d12' },
    forest: { 50: '#f0fdf4', 100: '#dcfce7', 200: '#bbf7d0', 300: '#86efac', 400: '#4ade80', 500: '#22c55e', 600: '#16a34a', 700: '#15803d', 800: '#166534', 900: '#14532d' },
    purple: { 50: '#faf5ff', 100: '#f3e8ff', 200: '#e9d5ff', 300: '#d8b4fe', 400: '#c084fc', 500: '#a855f7', 600: '#9333ea', 700: '#7e22ce', 800: '#6b21a8', 900: '#581c87' },
    dark: { 50: '#18181b', 100: '#27272a', 200: '#3f3f46', 300: '#52525b', 400: '#71717a', 500: '#a1a1aa', 600: '#d4d4d8', 700: '#e4e4e7', 800: '#f4f4f5', 900: '#fafafa' }
};
function setTheme(name) {
    const palette = themePalettes[name] || themePalettes.warm;
    const root = document.documentElement;
    Object.keys(palette).forEach(k => root.style.setProperty(`--color-${k}`, palette[k]));
    localStorage.setItem('family_app_theme', name);
    const sel = document.getElementById('theme-select');
    if (sel) sel.value = name;
}
setTheme(localStorage.getItem('family_app_theme') || 'warm');
document.getElementById('theme-select').addEventListener('change', (e) => { triggerHaptic(); setTheme(e.target.value); });

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
   📅 通用版 ICS 行事曆匯入 (支援 Google/Apple/Outlook 行事曆檔案)
   ======================================================== */
const importGovBtn = document.getElementById('btn-import-gov-holidays');
if (importGovBtn) {
    const parent = importGovBtn.parentNode;
    
    // 替換原本的按鈕為上傳檔案的 Label
    const icsLabel = document.createElement('label');
    icsLabel.className = 'w-full py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm cursor-pointer transition-all active:scale-95';
    icsLabel.innerHTML = '<i class="fas fa-calendar-plus"></i> 匯入通用 ICS 行事曆檔案 (.ics)<input type="file" id="input-import-ics" accept=".ics" class="hidden">';
    
    parent.replaceChild(icsLabel, importGovBtn);

    // ICS 檔案上傳解析邏輯
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
                    // 嚴格防重複檢查：名稱、開始日期
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

    // 輕量的純前端 ICS 解析器
    function parseICS(data) {
        const parsed = [];
        const lines = data.split(/\r?\n/);
        let currentEvent = null;

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            // 處理 ICS 格式的斷行延續
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

/* ☁️ 雲端備份與還原 (替換原本的 JSON 下載功能) */
const exportBtn = document.getElementById('btn-export-json');
const importInput = document.getElementById('input-import-json');

if (exportBtn && importInput) {
    const importLabel = importInput.parentElement;
    
    // 改寫標題
    const sectionLabel = exportBtn.closest('.space-y-2').querySelector('label');
    if (sectionLabel) sectionLabel.innerHTML = '☁️ 雲端資料備份與還原';

    // 重新設定「備份至雲端」按鈕
    exportBtn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> 備份至雲端';
    exportBtn.className = 'py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95';
    
    // 建立「從雲端還原」按鈕來取代原本的上傳框
    const cloudRestoreBtn = document.createElement('button');
    cloudRestoreBtn.id = 'btn-cloud-restore';
    cloudRestoreBtn.className = 'py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95';
    cloudRestoreBtn.innerHTML = '<i class="fas fa-cloud-download-alt"></i> 從雲端還原';
    
    importLabel.parentNode.replaceChild(cloudRestoreBtn, importLabel);

    // 綁定 Firebase 儲存節點
    const backupRef = doc(db, 'familyBackups', 'latest');

    // 備份事件
    exportBtn.addEventListener('click', async () => {
        if(!confirm('確定要將目前的「所有行程」備份到雲端嗎？\n(這將會覆蓋前一次的雲端備份紀錄)')) return;
        triggerHaptic();
        
        try {
            exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 備份中...';
            exportBtn.disabled = true;
            
            const backupData = {
                exportDate: new Date().toISOString(),
                events: events
            };
            await setDoc(backupRef, backupData);
            alert('🎉 雲端備份成功！現在您的行程已經安全存放在雲端了。');
        } catch (err) {
            console.error(err);
            alert('備份失敗，請檢查網路連線。');
        } finally {
            exportBtn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> 備份至雲端';
            exportBtn.disabled = false;
        }
    });

    // 還原事件
    cloudRestoreBtn.addEventListener('click', async () => {
        triggerHaptic();
        
        try {
            cloudRestoreBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 讀取中...';
            cloudRestoreBtn.disabled = true;
            
            const snap = await getDoc(backupRef);
            if (!snap.exists()) {
                alert('☁️ 目前雲端沒有找到任何備份紀錄喔！請先執行備份。');
                return;
            }
            
            const data = snap.data();
            const backupTime = new Date(data.exportDate).toLocaleString();
            
            if (confirm(`找到雲端備份 (備份時間：${backupTime})\n共包含 ${data.events.length} 筆行程。\n\n⚠️ 嚴重警告：\n還原將會【完全清除】您目前行事曆上的所有行程，並替換為這份備份的版本。\n您確定要繼續還原嗎？`)) {
                
                cloudRestoreBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 清除舊資料...';
                
                // 1. 先清空現有的 events
                for (const evt of events) {
                    await deleteDoc(doc(eventsRef, evt.id));
                }
                
                cloudRestoreBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 還原備份中...';
                
                // 2. 寫入備份的 events
                for (const ev of data.events) {
                    delete ev.id; // 防止帶入舊 ID
                    await addDoc(eventsRef, ev);
                }
                
                alert('🎉 雲端還原大成功！');
                document.getElementById('member-modal').classList.add('hidden');
            }
        } catch (err) {
            console.error(err);
            alert('還原失敗，請檢查網路連線。');
        } finally {
            cloudRestoreBtn.innerHTML = '<i class="fas fa-cloud-download-alt"></i> 從雲端還原';
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
        el.className = 'bg-white p-3 rounded-xl border shadow-sm cursor-pointer flex items-center gap-3';
        el.addEventListener('click', () => openViewModal(evt.id));

        const [sY, sM, sD] = evt.startDate.split('-').map(Number);
        const startObj = new Date(sY, sM - 1, sD);
        const diffDays = Math.round((startObj - todayObj) / (1000 * 60 * 60 * 24));
        
        let countdownHtml = '';
        if (diffDays <= 0) countdownHtml = `<span class="px-2 py-0.5 bg-rose-500 text-white rounded-full text-[10px] font-extrabold animate-pulse">🎉 今天</span>`;
        else if (diffDays === 1) countdownHtml = `<span class="px-2 py-0.5 bg-orange-500 text-white rounded-full text-[10px] font-bold">🔥 明天</span>`;
        else if (diffDays <= 7) countdownHtml = `<span class="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-[10px] font-bold">⏳ 倒數 ${diffDays} 天</span>`;
        else countdownHtml = `<span class="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-[10px] font-bold">還有 ${diffDays} 天</span>`;

        const [y, m, d] = evt.startDate.split('-');
        el.innerHTML = `
            <div class="${evt.color} text-white rounded-xl w-11 h-11 flex flex-col items-center justify-center shrink-0">
                <span class="text-[9px]">${m}月</span><span class="text-sm font-bold">${d}</span>
            </div>
            <div class="flex-1 truncate">
                <div class="flex justify-between items-center gap-1">
                    <h4 class="font-bold text-gray-800 text-xs truncate">${evt.icon ? evt.icon + ' ' : ''}${evt.title}</h4>
                    ${countdownHtml}
                </div>
                <span class="text-[10px] text-gray-400 mt-0.5 block">${evt.startDate}</span>
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