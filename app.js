import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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

let currentDate = new Date();
let events = [];
let currentEditingId = null;
let currentViewingId = null;
let selectedDateForModal = null;
let searchQuery = '';
let clickCount = 0;
let clickTimer = null;

// iOS 觸控回饋輔助函數（輕微震動）
function triggerHaptic() {
    if (window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(10);
    }
}

// 記帳區塊開關聯動
document.getElementById('event-is-expense').addEventListener('change', (e) => {
    const fields = document.getElementById('expense-fields');
    if (e.target.checked) {
        fields.classList.remove('hidden');
    } else {
        fields.classList.add('hidden');
    }
});

const modals = ['admin-modal', 'day-modal', 'event-modal', 'view-modal'];
modals.forEach(modalId => {
    const modalEl = document.getElementById(modalId);
    modalEl.addEventListener('click', (e) => {
        if (e.target === modalEl) {
            triggerHaptic();
            modalEl.classList.add('hidden');
            if (modalId === 'day-modal') selectedDateForModal = null;
        }
    });
});

let touchStartX = 0;
let touchEndX = 0;
const swipeContainer = document.getElementById('calendar-swipe-container');

swipeContainer.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
}, { passive: true });

swipeContainer.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
}, { passive: true });

function handleSwipe() {
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

document.getElementById('btn-close-admin').addEventListener('click', () => {
    triggerHaptic();
    document.getElementById('admin-modal').classList.add('hidden');
});

onSnapshot(eventsRef, (snapshot) => {
    events = [];
    snapshot.forEach((doc) => {
        const data = doc.data();
        events.push({ 
            id: doc.id, 
            title: data.title,
            icon: data.icon || '',
            startDate: data.startDate || data.date,
            endDate: data.endDate || data.date,
            time: data.time || '',
            author: data.author || '家族成員',
            description: data.description || '',
            isNav: data.isNav || false,
            color: data.color || 'bg-rose-400',
            isExpense: data.isExpense || false,
            expenseAmount: data.expenseAmount || 0,
            expensePayer: data.expensePayer || '爸爸',
            expenseSplits: data.expenseSplits || 4
        });
    });
    renderApp();
    if (selectedDateForModal) {
        openDayModal(selectedDateForModal, false);
    }
});

function formatDateStr(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

document.getElementById('search-input').addEventListener('input', (e) => {
    searchQuery = e.target.value.trim().toLowerCase();
    renderApp();
});

document.getElementById('ics-file-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(event) {
        const text = event.target.result;
        const eventsToImport = parseICS(text);

        if (eventsToImport.length === 0) {
            alert('無法解析該 ICS 檔案，請確認格式是否正確！');
            return;
        }

        if (confirm(`成功解析出 ${eventsToImport.length} 筆政府行事曆資料，是否確認批次匯入？`)) {
            try {
                for (let evt of eventsToImport) {
                    await addDoc(eventsRef, evt);
                }
                triggerHaptic();
                alert('政府行事曆批次匯入成功！');
                document.getElementById('admin-modal').classList.add('hidden');
            } catch (err) {
                console.error("ICS Import Error:", err);
                alert('匯入失敗，請稍後再試。');
            }
        }
        e.target.value = '';
    };
    reader.readAsText(file);
});

document.getElementById('btn-clear-gov').addEventListener('click', async () => {
    const govEvents = events.filter(e => e.author === '政府行事曆');
    if (govEvents.length === 0) {
        alert('目前沒有任何政府行事曆資料需要清理！');
        return;
    }

    const seen = new Set();
    const duplicatesToDelete = [];

    govEvents.forEach(evt => {
        const key = `${evt.title}_${evt.startDate}`;
        if (seen.has(key)) {
            duplicatesToDelete.push(evt);
        } else {
            seen.add(key);
        }
    });

    if (duplicatesToDelete.length === 0) {
        alert('檢查完畢！目前沒有發現重複的政府行事曆項目。');
        return;
    }

    if (confirm(`檢測到共有 ${duplicatesToDelete.length} 筆重複的政府行事曆，是否確認一鍵清除重複、每項只留一個？`)) {
        try {
            for (let evt of duplicatesToDelete) {
                await deleteDoc(doc(eventsRef, evt.id));
            }
            triggerHaptic();
            alert('已成功清除重複的政府行事曆，每項都只保留一個！');
            document.getElementById('admin-modal').classList.add('hidden');
        } catch (err) {
            console.error("Clear Duplicate Gov Events Error:", err);
            alert('清理失敗，請稍後再試。');
        }
    }
});

function parseICS(icsText) {
    const parsedEvents = [];
    const lines = icsText.split(/\r\n|\n|\r/);
    let currentEvent = null;

    for (let line of lines) {
        line = line.trim();
        if (line === 'BEGIN:VEVENT') {
            currentEvent = { title: '', icon: '', startDate: '', endDate: '', author: '政府行事曆', description: '', isNav: false, color: 'bg-rose-400', isExpense: false, expenseAmount: 0, expensePayer: '', expenseSplits: 1 };
        } else if (line === 'END:VEVENT' && currentEvent) {
            if (currentEvent.title && currentEvent.startDate) {
                if (!currentEvent.endDate) currentEvent.endDate = currentEvent.startDate;
                parsedEvents.push(currentEvent);
            }
            currentEvent = null;
        } else if (currentEvent) {
            if (line.startsWith('SUMMARY:')) {
                currentEvent.title = line.substring(8).trim();
            } else if (line.startsWith('DTSTART')) {
                const dateVal = line.split(':').pop().trim();
                currentEvent.startDate = formatICSDate(dateVal);
            } else if (line.startsWith('DTEND')) {
                const dateVal = line.split(':').pop().trim();
                let d = parseICSDateObj(dateVal);
                if (d) {
                    d.setDate(d.getDate() - 1);
                    currentEvent.endDate = formatDateStr(d);
                }
            } else if (line.startsWith('DESCRIPTION:')) {
                currentEvent.description = line.substring(12).trim();
            }
        }
    }
    parsedEvents.forEach(e => { if (!e.endDate) e.endDate = e.startDate; });
    return parsedEvents;
}

function formatICSDate(str) {
    if (str.length >= 8) {
        const y = str.substring(0, 4);
        const m = str.substring(4, 6);
        const d = str.substring(6, 8);
        return `${y}-${m}-${d}`;
    }
    return str;
}

function parseICSDateObj(str) {
    if (str.length >= 8) {
        const y = parseInt(str.substring(0, 4));
        const m = parseInt(str.substring(4, 6)) - 1;
        const d = parseInt(str.substring(6, 8));
        return new Date(y, m, d);
    }
    return null;
}

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

function createDayCell(dayNum, dateStr, isToday = false) {
    const dateObj = new Date(dateStr);
    const dayOfWeek = dateObj.getDay();
    
    let lunarStr = '';
    try {
        const solar = Solar.fromDate(dateObj);
        const lunar = solar.getLunar();
        lunarStr = lunar.getFestivals()[0] || lunar.getDayInChinese();
        if (lunar.getDay() === 1) {
            lunarStr = lunar.getMonthInChinese() + '月';
        }
    } catch (err) {
        lunarStr = '';
    }

    const allEventsForCheck = events.filter(e => dateStr >= e.startDate && dateStr <= e.endDate);
    const isMakeUpWorkDay = allEventsForCheck.some(e => e.author === '政府行事曆' && (e.title.includes('補行上班') || e.title.includes('補班')));
    const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
    const isGovHoliday = allEventsForCheck.some(e => e.author === '政府行事曆');
    
    const isRedDay = (isWeekend && !isMakeUpWorkDay) || isGovHoliday;
    const dayEvents = allEventsForCheck.sort((a, b) => (a.time || '24:00').localeCompare(b.time || '24:00'));

    let cellBgClass = 'bg-white';
    if (isToday) {
        cellBgClass = 'bg-warm-50 border-warm-300 ring-2 ring-warm-400';
    } else if (isRedDay) {
        cellBgClass = 'bg-rose-50/80 border-rose-200 hover:bg-rose-100/80';
    } else {
        cellBgClass = 'bg-white hover:border-warm-300 hover:shadow-sm';
    }

    const cell = document.createElement('div');
    cell.className = `border border-warm-100 rounded-xl p-1 flex flex-col gap-1 transition-all ${cellBgClass} cursor-pointer overflow-hidden`;
    cell.addEventListener('click', () => {
        triggerHaptic();
        openDayModal(dateStr);
    });
    
    let dateNumColor = isToday ? 'bg-warm-500 text-white shadow-sm' : (isRedDay ? 'text-rose-600 font-extrabold' : 'text-gray-600');

    const header = document.createElement('div');
    header.className = 'flex justify-between items-center px-0.5 shrink-0';
    header.innerHTML = `
        <span class="text-xs md:text-sm font-bold w-5 h-5 md:w-6 md:h-6 flex items-center justify-center rounded-full ${dateNumColor}">${dayNum}</span>
        <span class="text-[9px] md:text-[10px] text-gray-400 font-medium">${lunarStr}</span>
    `;
    cell.appendChild(header);

    const eventsContainer = document.createElement('div');
    eventsContainer.className = 'flex flex-col gap-0.5 overflow-y-auto hide-scrollbar flex-1';
    
    dayEvents.forEach(evt => {
        const matchSearch = !searchQuery || 
            evt.title.toLowerCase().includes(searchQuery) || 
            evt.author.toLowerCase().includes(searchQuery) || 
            evt.description.toLowerCase().includes(searchQuery);

        const evtEl = document.createElement('div');
        const opacityClass = (searchQuery && !matchSearch) ? 'opacity-25 grayscale' : '';
        
        const authorTagHtml = (evt.author && evt.author !== '政府行事曆') ? `<span class="text-[7px] md:text-[8px] bg-black/20 px-1 rounded shrink-0 self-end md:self-auto">${evt.author}</span>` : '';
        const iconDisplay = evt.icon ? `${evt.icon} ` : '';
        const expenseBadge = evt.isExpense ? ` <i class="fas fa-receipt text-[9px] opacity-90"></i>` : '';

        evtEl.className = `${evt.color} text-white text-[9px] md:text-[11px] font-bold px-1 py-0.5 rounded shadow-sm cursor-pointer hover:brightness-110 active:scale-95 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-1 ${opacityClass}`;
        evtEl.innerHTML = `<span class="truncate w-full">${evt.time ? `<span class="opacity-75 font-normal text-[8px] mr-0.5">${evt.time}</span>` : ''}${iconDisplay}${evt.title}${expenseBadge}</span>${authorTagHtml}`;
        
        evtEl.addEventListener('click', (e) => {
            e.stopPropagation();
            triggerHaptic();
            openViewModal(evt.id);
        });

        eventsContainer.appendChild(evtEl);
    });
    
    cell.appendChild(eventsContainer);
    return cell;
}

function openDayModal(dateStr, setGlobal = true) {
    if (setGlobal) selectedDateForModal = dateStr;
    const dParts = dateStr.split('-');
    
    let lunarSubtitle = '';
    try {
        const solar = Solar.fromYmd(parseInt(dParts[0]), parseInt(dParts[1]), parseInt(dParts[2]));
        const lunar = solar.getLunar();
        lunarSubtitle = `（農曆 ${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}）`;
    } catch(e) {}

    document.getElementById('day-modal-title').innerText = `${dParts[0]}年 ${parseInt(dParts[1])}月 ${parseInt(dParts[2])}日 ${lunarSubtitle}`;
    
    const dayEvents = events.filter(e => dateStr >= e.startDate && dateStr <= e.endDate).sort((a, b) => (a.time || '24:00').localeCompare(b.time || '24:00'));
    const listContainer = document.getElementById('day-modal-list');
    listContainer.innerHTML = '';
    
    if (dayEvents.length === 0) {
        listContainer.innerHTML = `
            <div class="text-center py-6 text-gray-400">
                <i class="far fa-calendar-times text-3xl mb-2 opacity-50"></i>
                <p class="text-sm">這一天沒有安排行程喔！</p>
            </div>
        `;
    } else {
        dayEvents.forEach(evt => {
            const item = document.createElement('div');
            item.className = 'p-3 rounded-2xl border border-warm-100 bg-warm-50/50 hover:bg-warm-50 transition-all cursor-pointer flex items-center justify-between gap-3';
            item.addEventListener('click', () => {
                triggerHaptic();
                closeDayModal();
                openViewModal(evt.id);
            });
            
            const displayAuthor = evt.author === '政府行事曆' ? '國定假日' : evt.author;
            const iconDisplay = evt.icon ? `${evt.icon} ` : '';
            const expenseText = evt.isExpense ? ` <span class="text-amber-600 font-bold">($${evt.expenseAmount})</span>` : '';
            item.innerHTML = `
                <div class="flex items-center gap-3 min-w-0">
                    <div class="w-3 h-3 rounded-full ${evt.color} shrink-0"></div>
                    <div class="min-w-0">
                        <h4 class="font-bold text-gray-800 text-sm break-words">${iconDisplay}${evt.title}${expenseText}</h4>
                        <p class="text-xs text-gray-400 flex items-center gap-2 mt-0.5">
                            <span><i class="far fa-clock"></i> ${evt.time || '全天'}</span>
                            <span><i class="far fa-user"></i> ${displayAuthor}</span>
                        </p>
                    </div>
                </div>
                <i class="fas fa-chevron-right text-gray-300 text-xs"></i>
            `;
            listContainer.appendChild(item);
        });
    }
    document.getElementById('day-modal').classList.remove('hidden');
}

function closeDayModal() {
    document.getElementById('day-modal').classList.add('hidden');
    selectedDateForModal = null;
}

function renderUpcoming() {
    const container = document.getElementById('upcoming-events');
    const emptyState = document.getElementById('no-upcoming');
    container.innerHTML = '';
    
    const todayStr = formatDateStr(new Date());
    const upcoming = events.filter(e => {
        const matchDate = e.endDate >= todayStr;
        const matchSearch = !searchQuery || 
            e.title.toLowerCase().includes(searchQuery) || 
            e.author.toLowerCase().includes(searchQuery) || 
            e.description.toLowerCase().includes(searchQuery);
        return matchDate && matchSearch;
    }).sort((a, b) => a.startDate.localeCompare(b.startDate)).slice(0, 5);
    
    if (upcoming.length === 0) {
        emptyState.classList.remove('hidden');
    } else {
        emptyState.classList.add('hidden');
        upcoming.forEach(evt => {
            const el = document.createElement('div');
            el.className = 'bg-white p-3 rounded-2xl border border-warm-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer flex items-center gap-4 group';
            el.addEventListener('click', () => {
                triggerHaptic();
                openViewModal(evt.id);
            });
            
            const d = new Date(evt.startDate);
            const displayAuthor = evt.author === '政府行事曆' ? '' : evt.author;
            const iconDisplay = evt.icon ? `${evt.icon} ` : '';
            const expenseBadge = evt.isExpense ? ` <span class="text-xs text-amber-600 font-bold">($${evt.expenseAmount})</span>` : '';
            el.innerHTML = `
                <div class="${evt.color} text-white rounded-xl w-12 h-12 flex flex-col items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                    <span class="text-xs font-medium opacity-90">${d.getMonth() + 1}月</span>
                    <span class="text-lg font-bold leading-none">${d.getDate()}</span>
                </div>
                <div class="flex-1 min-w-0">
                    <h4 class="font-bold text-gray-800 break-words">${iconDisplay}${evt.title}${expenseBadge}</h4>
                    <div class="text-xs text-gray-400 mt-0.5 flex items-center gap-2 flex-wrap">
                        <span><i class="far fa-calendar-alt"></i> ${evt.startDate === evt.endDate ? evt.startDate : evt.startDate + ' ~ ' + evt.endDate}</span>
                        ${displayAuthor ? `<span><i class="far fa-user"></i> ${displayAuthor}</span>` : ''}
                    </div>
                </div>
                <div class="text-gray-300 group-hover:text-warm-400 transition-colors pr-2"><i class="fas fa-chevron-right text-sm"></i></div>
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
document.getElementById('btn-add-from-day').addEventListener('click', () => {
    triggerHaptic();
    const dateToPass = selectedDateForModal;
    closeDayModal();
    openModal(null, dateToPass);
});
document.getElementById('btn-close-view').addEventListener('click', () => { triggerHaptic(); closeViewModal(); });
document.getElementById('btn-edit-from-view').addEventListener('click', () => {
    triggerHaptic();
    const id = currentViewingId;
    closeViewModal();
    setTimeout(() => openModal(id), 100);
});

document.getElementById('btn-copy-from-view').addEventListener('click', () => {
    triggerHaptic();
    const id = currentViewingId;
    closeViewModal();
    setTimeout(() => copyEventToModal(id), 100);
});

function openModal(eventId = null, defaultDate = null) {
    document.getElementById('event-form').reset();
    document.getElementById('expense-fields').classList.add('hidden');
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
            document.getElementById('event-author').value = evt.author === '政府行事曆' ? '爸爸' : (evt.author || '爸爸');
            document.getElementById('event-desc').value = evt.description || '';
            document.getElementById('event-is-nav').checked = evt.isNav || false;
            document.querySelector(`input[name="event-color"][value="${evt.color}"]`).checked = true;

            // 記帳欄位還原
            if (evt.isExpense) {
                document.getElementById('event-is-expense').checked = true;
                document.getElementById('expense-fields').classList.remove('hidden');
                document.getElementById('expense-amount').value = evt.expenseAmount || '';
                document.getElementById('expense-payer').value = evt.expensePayer || '爸爸';
                document.getElementById('expense-splits').value = evt.expenseSplits || 4;
            } else {
                document.getElementById('event-is-expense').checked = false;
            }
        }
    } else {
        document.getElementById('modal-title').innerText = '新增活動';
        document.getElementById('btn-delete').classList.add('hidden');
        document.getElementById('event-icon').value = '';
        document.getElementById('event-is-expense').checked = false;
        const dStr = defaultDate || formatDateStr(new Date());
        document.getElementById('event-start-date').value = dStr;
        document.getElementById('event-end-date').value = dStr;
        document.getElementById('event-is-nav').checked = false;
    }
    document.getElementById('event-modal').classList.remove('hidden');
}

function copyEventToModal(eventId) {
    document.getElementById('event-form').reset();
    document.getElementById('expense-fields').classList.add('hidden');
    currentEditingId = null;
    document.getElementById('modal-title').innerText = '複製並新增活動';
    document.getElementById('btn-delete').classList.add('hidden');
    
    const evt = events.find(e => e.id === eventId);
    if (evt) {
        document.getElementById('event-title').value = evt.title;
        document.getElementById('event-icon').value = evt.icon || '';
        document.getElementById('event-start-date').value = evt.startDate;
        document.getElementById('event-end-date').value = evt.endDate || evt.startDate;
        document.getElementById('event-time').value = evt.time || '';
        document.getElementById('event-author').value = evt.author === '政府行事曆' ? '爸爸' : (evt.author || '爸爸');
        document.getElementById('event-desc').value = evt.description || '';
        document.getElementById('event-is-nav').checked = evt.isNav || false;
        document.querySelector(`input[name="event-color"][value="${evt.color}"]`).checked = true;

        if (evt.isExpense) {
            document.getElementById('event-is-expense').checked = true;
            document.getElementById('expense-fields').classList.remove('hidden');
            document.getElementById('expense-amount').value = evt.expenseAmount || '';
            document.getElementById('expense-payer').value = evt.expensePayer || '爸爸';
            document.getElementById('expense-splits').value = evt.expenseSplits || 4;
        }
    }
    document.getElementById('event-modal').classList.remove('hidden');
}

function closeModal() { 
    document.getElementById('event-modal').classList.add('hidden'); 
    currentEditingId = null; 
}

function openViewModal(eventId) {
    const evt = events.find(e => e.id === eventId);
    if(!evt) return;
    currentViewingId = eventId;
    document.getElementById('view-modal-header').className = `h-20 w-full ${evt.color}`;
    const iconDisplay = evt.icon ? `${evt.icon} ` : '';
    document.getElementById('view-title').innerText = iconDisplay + evt.title;
    
    const dateStr = evt.startDate === evt.endDate ? evt.startDate : `${evt.startDate} ~ ${evt.endDate}`;
    document.getElementById('view-date').innerText = dateStr;
    const displayAuthor = evt.author === '政府行事曆' ? '國定假日' : (evt.author || '未署名');
    document.getElementById('view-author').innerText = `建立者：${displayAuthor}`;
    
    const timeContainer = document.getElementById('view-time-container');
    if (evt.time) {
        document.getElementById('view-time').innerText = evt.time;
        timeContainer.classList.remove('hidden');
    } else { timeContainer.classList.add('hidden'); }
    
    const descContainer = document.getElementById('view-desc-container');
    if (evt.description) {
        document.getElementById('view-desc').innerText = evt.description;
        descContainer.classList.remove('hidden');
    } else { 
        descContainer.classList.add('hidden');
    }

    // 顯示分帳結果
    const expenseContainer = document.getElementById('view-expense-container');
    const expenseDetails = document.getElementById('view-expense-details');
    if (evt.isExpense && evt.expenseAmount > 0) {
        const perPerson = Math.round((evt.expenseAmount / evt.expenseSplits) * 10) / 10;
        expenseDetails.innerHTML = `
            <div>💰 總金額：<strong>$${evt.expenseAmount}</strong> 元（墊付人：${evt.expensePayer}）</div>
            <div>👥 分攤人數：<strong>${evt.expenseSplits} 人</strong></div>
            <div>⚖️ 每人平均分攤：<strong class="text-amber-700">$${perPerson}</strong> 元</div>
        `;
        expenseContainer.classList.remove('hidden');
    } else {
        expenseContainer.classList.add('hidden');
    }

    const mapBtnContainer = document.getElementById('map-btn-container');
    if (evt.description && evt.isNav) {
        const encodedQuery = encodeURIComponent(evt.description);
        document.getElementById('map-nav-link').href = `https://www.google.com/maps/search/?api=1&query=${encodedQuery}`;
        mapBtnContainer.classList.remove('hidden');
    } else {
        mapBtnContainer.classList.add('hidden');
    }
    
    document.getElementById('view-modal').classList.remove('hidden');
}

function closeViewModal() { 
    document.getElementById('view-modal').classList.add('hidden'); 
    currentViewingId = null; 
}

document.getElementById('event-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    triggerHaptic();
    const startDate = document.getElementById('event-start-date').value;
    const endDate = document.getElementById('event-end-date').value || startDate;
    
    const isExpense = document.getElementById('event-is-expense').checked;
    const eventData = {
        title: document.getElementById('event-title').value.trim(),
        icon: document.getElementById('event-icon').value,
        startDate: startDate,
        endDate: endDate < startDate ? startDate : endDate,
        time: document.getElementById('event-time').value,
        author: document.getElementById('event-author').value,
        description: document.getElementById('event-desc').value.trim(),
        isNav: document.getElementById('event-is-nav').checked,
        color: document.querySelector('input[name="event-color"]:checked').value,
        isExpense: isExpense,
        expenseAmount: isExpense ? parseFloat(document.getElementById('expense-amount').value) || 0 : 0,
        expensePayer: isExpense ? document.getElementById('expense-payer').value : '',
        expenseSplits: isExpense ? parseInt(document.getElementById('expense-splits').value) || 4 : 4
    };
    
    try {
        if (currentEditingId) {
            await updateDoc(doc(eventsRef, currentEditingId), eventData);
        } else {
            await addDoc(eventsRef, eventData);
        }
        closeModal();
    } catch (error) {
        console.error("Error saving document: ", error);
    }
});

document.getElementById('btn-delete').addEventListener('click', async () => {
    if (!currentEditingId) return;
    triggerHaptic();
    try {
        await deleteDoc(doc(eventsRef, currentEditingId));
        closeModal();
    } catch (error) {
        console.error("Error removing document: ", error);
    }
});

renderApp();