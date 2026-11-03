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

const twLocations = {
    "台北":{lat:25.033,lng:121.565},"新北":{lat:25.011,lng:121.461},"桃園":{lat:24.993,lng:121.301},"台中":{lat:24.147,lng:120.673},"台南":{lat:22.999,lng:120.227},
    "高雄":{lat:22.627,lng:120.301},"基隆":{lat:25.127,lng:121.739},"新竹":{lat:24.813,lng:120.967},"苗栗":{lat:24.56,lng:120.821},"彰化":{lat:24.075,lng:120.544},
    "南投":{lat:23.903,lng:120.693},"埔里":{lat:23.966,lng:120.966},"雲林":{lat:23.709,lng:120.431},"嘉義":{lat:23.48,lng:120.453},"屏東":{lat:22.668,lng:120.486},
    "恆春":{lat:22.002,lng:120.741},"宜蘭":{lat:24.757,lng:121.753},"花蓮":{lat:23.987,lng:121.601},"台東":{lat:22.758,lng:121.144},"澎湖":{lat:23.571,lng:119.579},
    "金門":{lat:24.449,lng:118.377},"馬祖":{lat:26.16,lng:119.94},"阿里山":{lat:23.508,lng:120.801},"合歡山":{lat:24.143,lng:121.271},"墾丁":{lat:21.944,lng:120.796},
    "日月潭":{lat:23.852,lng:120.925},"清境":{lat:24.058,lng:121.156},"武陵":{lat:24.364,lng:121.314},"太平山":{lat:24.492,lng:121.536},"拉拉山":{lat:24.721,lng:121.422},
    "小琉球":{lat:22.343,lng:120.368},"綠島":{lat:22.661,lng:121.488},"蘭嶼":{lat:22.057,lng:121.532}
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
    @keyframes ai-glow { 0%, 100% { box-shadow: 0 0 8px var(--color-400), inset 0 0 4px var(--color-100); border-color: var(--color-500); } 50% { box-shadow: 0 0 16px var(--color-500), inset 0 0 8px var(--color-200); border-color: var(--color-600); } }
    .ai-active-cell { animation: ai-glow 2s infinite alternate; transform: scale(1.02); z-index: 20; border-width: 2px !important; border-radius: 0.75rem; }
    @media screen and (max-height: 600px) and (orientation: landscape) {
        body#app-body, main { height: auto !important; min-height: 100vh !important; overflow-y: auto !important; }
        #calendar-swipe-container { min-height: 120vw !important; overflow: visible !important; }
        #calendar-grid { min-height: 400px !important; }
        .vehicle-wrapper, .drone-wrapper { display: none !important; }
    }
    .masonry-gallery { column-count: 2; column-gap: 12px; }
    @media (min-width: 768px) { .masonry-gallery { column-count: 3; column-gap: 16px; } }
    @media (min-width: 1024px) { .masonry-gallery { column-count: 4; column-gap: 16px; } }
    .masonry-item { break-inside: avoid; margin-bottom: 12px; position: relative; border-radius: 12px; overflow: hidden; background: #f3f4f6; }
    .masonry-item img.masonry-thumb { width: 100%; display: block; transition: transform 0.5s ease; }
    .masonry-item:hover img.masonry-thumb { transform: scale(1.08); }
    .masonry-overlay { position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 60%); opacity: 0; transition: opacity 0.3s ease; display: flex; flex-direction: column; justify-content: flex-end; padding: 12px; color: white; }
    .masonry-item:hover .masonry-overlay { opacity: 1; }
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
if (galleryBtn && !document.getElementById('btn-open-video-gallery')) {
    
    const videoBtn = document.createElement('button');
    videoBtn.id = 'btn-open-video-gallery';
    videoBtn.className = 'w-full py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-2 shadow-sm mt-3';
    videoBtn.innerHTML = '<i class="fas fa-film text-indigo-600"></i> 🎬 家庭影音大廳';
    galleryBtn.parentNode.insertBefore(videoBtn, galleryBtn.nextSibling);

    const manualBtn = document.createElement('button');
    manualBtn.id = 'btn-open-manual';
    manualBtn.className = 'w-full py-3 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-2 shadow-sm mt-2';
    manualBtn.innerHTML = '<i class="fas fa-book-open text-blue-600"></i> 📖 系統使用說明書';
    videoBtn.parentNode.insertBefore(manualBtn, videoBtn.nextSibling);

    const qrBtn = document.createElement('button');
    qrBtn.id = 'btn-open-qr';
    qrBtn.className = 'w-full py-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-2 shadow-sm mt-2';
    qrBtn.innerHTML = '<i class="fas fa-qrcode text-emerald-600"></i> 📱 掃描安裝 App';
    manualBtn.parentNode.insertBefore(qrBtn, manualBtn.nextSibling);

    videoBtn.addEventListener('click', () => {
        triggerHaptic();
        if (!sidebar.classList.contains('-translate-x-full') && window.innerWidth < 768) toggleSidebar();
        openVideoGallery();
    });

    manualBtn.addEventListener('click', () => {
        triggerHaptic();
        if (!sidebar.classList.contains('-translate-x-full') && window.innerWidth < 768) toggleSidebar();
        openManualModal();
    });

    qrBtn.addEventListener('click', () => {
        triggerHaptic();
        if (!sidebar.classList.contains('-translate-x-full') && window.innerWidth < 768) toggleSidebar();
        openQRModal();
    });
}

function openVideoGallery() {
    let modal = document.getElementById('video-gallery-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'video-gallery-modal';
        modal.className = 'fixed inset-0 bg-warm-50 z-[150] flex flex-col hidden transition-transform transform translate-x-full duration-300';
        modal.innerHTML = `
            <div class="px-4 py-4 md:px-6 md:py-5 bg-white border-b border-warm-200 flex justify-between items-center shadow-sm shrink-0 z-50">
                <h2 class="text-lg md:text-xl font-extrabold text-indigo-800 flex items-center gap-2"><i class="fas fa-film text-indigo-600"></i> 🎬 家庭影音大廳</h2>
                <button id="btn-close-video-gallery" class="w-8 h-8 md:w-10 md:h-10 bg-warm-100 text-warm-600 rounded-full flex items-center justify-center hover:bg-warm-200 transition-colors"><i class="fas fa-times text-lg"></i></button>
            </div>
            <div id="video-grid-container" class="p-4 masonry-gallery bg-gray-900 flex-1 overflow-y-auto"></div>
        `;
        document.body.appendChild(modal);
        document.getElementById('btn-close-video-gallery').addEventListener('click', () => {
            triggerHaptic();
            modal.classList.add('translate-x-full');
            setTimeout(() => {
                modal.classList.add('hidden');
                document.getElementById('video-grid-container').innerHTML = ''; 
            }, 300);
        });
    }

    const container = document.getElementById('video-grid-container');
    container.innerHTML = '';
    
    const videoEvents = events.filter(e => e.videoUrl && e.videoUrl.trim() !== '').sort((a, b) => b.startDate.localeCompare(a.startDate));
    
    if (videoEvents.length === 0) {
        container.innerHTML = `<div class="col-span-full text-center py-20 text-gray-500"><i class="fas fa-video-slash text-5xl mb-4 opacity-50"></i><p class="text-sm font-bold">目前還沒有任何影片記錄喔！</p></div>`;
    } else {
        videoEvents.forEach(evt => {
            const item = document.createElement('div');
            item.className = 'masonry-item shadow-lg border border-gray-800 bg-black group cursor-pointer';
            
            let ytId = '';
            let url = evt.videoUrl.trim();
            
            try {
                if (url.includes('v=')) ytId = url.split('v=')[1].split('&')[0];
                else if (url.includes('youtu.be/')) ytId = url.split('youtu.be/')[1].split('?')[0];
                else if (url.includes('shorts/')) ytId = url.split('shorts/')[1].split('?')[0];
            } catch (e) {}
            
            let thumbHtml = '';
            if (ytId && ytId.length > 5) {
                thumbHtml = `<img src="https://img.youtube.com/vi/${ytId}/hqdefault.jpg" class="masonry-thumb w-full h-auto object-cover opacity-60 group-hover:opacity-100 transition-all duration-500">`;
            } else {
                thumbHtml = `<div class="w-full aspect-video bg-gradient-to-br from-indigo-900 to-gray-900 flex items-center justify-center opacity-60 group-hover:opacity-100 transition-all duration-500"></div>`;
            }

            item.innerHTML = `
                ${thumbHtml}
                <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-20">
                    <i class="fas fa-play text-white text-5xl drop-shadow-[0_0_15px_rgba(255,255,255,0.5)] scale-75 group-hover:scale-100 transition-transform"></i>
                </div>
                <div class="absolute top-2 left-2 bg-rose-600/80 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm z-20 flex items-center gap-1 pointer-events-none"><i class="fas fa-video"></i> ${evt.startDate}</div>
                <div class="masonry-overlay z-10 pt-16 pointer-events-none">
                    <h4 class="font-extrabold text-sm truncate drop-shadow-md">${evt.icon ? evt.icon+' ' : ''}${evt.title}</h4>
                    <p class="text-[10px] text-gray-300 mt-1 font-bold">點擊直接播放</p>
                </div>
            `;
            
            item.addEventListener('click', function onClick(e) {
                e.stopPropagation();
                triggerHaptic();
                item.removeEventListener('click', onClick);
                item.classList.remove('cursor-pointer', 'group');
                
                let embedHtml = '';
                if (ytId && ytId.length > 5) {
                    embedHtml = `<iframe class="w-full" style="aspect-ratio: 16/9; border: none; border-radius: 12px 12px 0 0;" src="https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0&playsinline=1" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`;
                } else if (url.includes('drive.google.com')) {
                    let fileId = '';
                    if (url.includes('/d/')) fileId = url.split('/d/')[1].split('/')[0];
                    else if (url.includes('id=')) fileId = new URL(url).searchParams.get('id');
                    embedHtml = `<iframe class="w-full" style="aspect-ratio: 16/9; border: none; border-radius: 12px 12px 0 0;" src="https://drive.google.com/file/d/${fileId}/preview" allow="autoplay; fullscreen" allowfullscreen></iframe>`;
                } else {
                    embedHtml = `<video src="${url}" controls autoplay playsinline class="w-full" style="border-radius: 12px 12px 0 0;"></video>`;
                }
                
                item.innerHTML = `
                    ${embedHtml}
                    <button class="w-full py-2.5 bg-indigo-950 hover:bg-indigo-900 text-indigo-100 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 rounded-b-xl border-t border-indigo-900">
                        <i class="fas fa-external-link-alt"></i> 查看完整行程明細
                    </button>
                `;
                
                item.querySelector('button').addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    triggerHaptic();
                    modal.classList.add('translate-x-full');
                    setTimeout(() => {
                        modal.classList.add('hidden');
                        document.getElementById('video-grid-container').innerHTML = '';
                        openViewModal(evt.id); 
                    }, 300);
                });
            });
            container.appendChild(item);
        });
    }
    
    modal.classList.remove('hidden');
    void modal.offsetWidth;
    modal.classList.remove('translate-x-full');
}

function openQRModal() {
    if (document.getElementById('qr-modal')) {
        document.getElementById('qr-modal').classList.remove('hidden');
        return;
    }
    if (typeof QRCode === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
        script.onload = () => createAndShowQRModal();
        document.head.appendChild(script);
    } else {
        createAndShowQRModal();
    }
}

function createAndShowQRModal() {
    const modal = document.createElement('div');
    modal.id = 'qr-modal';
    modal.className = 'fixed inset-0 bg-warm-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-fade-in modal-backdrop';
    
    modal.innerHTML = `
        <div class="bg-white w-full max-w-sm rounded-3xl shadow-2xl flex flex-col overflow-hidden modal-content" onclick="event.stopPropagation()">
            <div class="px-6 py-4 bg-emerald-50 border-b border-emerald-100 flex justify-between items-center shrink-0">
                <h3 class="font-bold text-emerald-900 flex items-center gap-2"><i class="fas fa-qrcode text-emerald-600"></i> 掃描加入主畫面</h3>
                <button id="btn-close-qr-modal" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times text-xl"></i></button>
            </div>
            <div class="p-6 flex flex-col items-center justify-center space-y-4">
                <p class="text-sm font-bold text-gray-700 text-center">請家人用手機相機掃描下方條碼</p>
                <div id="qrcode-render-area" class="p-4 bg-white border-2 border-dashed border-emerald-200 rounded-2xl flex justify-center shadow-sm"></div>
                <div class="bg-emerald-50 text-emerald-800 text-xs p-3 rounded-xl w-full">
                    <ul class="list-disc pl-4 space-y-1 font-bold">
                        <li>iPhone 掃描後請用 <strong>Safari</strong> 開啟</li>
                        <li>Android 掃描後請用 <strong>Chrome</strong> 開啟</li>
                        <li>開啟後，在底部選單點擊 <strong>「加入主畫面」</strong> 即可直接變成手機 App！</li>
                    </ul>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    const currentUrl = window.location.origin + window.location.pathname;
    new QRCode(document.getElementById("qrcode-render-area"), { text: currentUrl, width: 180, height: 180, colorDark : "#064e3b", colorLight : "#ffffff", correctLevel : QRCode.CorrectLevel.H });
    document.getElementById('btn-close-qr-modal').onclick = () => modal.classList.add('hidden');
    modal.onclick = () => modal.classList.add('hidden');
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
                    <li><b class="text-emerald-600">裝備任務清單：</b> 露營時誰帶帳篷？勾選「裝備/任務清單」，指定負責人，完成後還能打勾確認。全部完成會有煙火驚喜喔！</li>
                    <li><b class="text-amber-600">代墊分帳：</b> 出去玩有人先墊錢？勾選「分帳功能」，輸入誰代墊、總額多少，以及大家的分攤份數（小孩算 0.5 份），系統會自動幫你算好每個人該給多少錢。</li>
                </ul>
            </section>
            <section>
                <h3 class="font-bold text-lg text-purple-600 mb-2 flex items-center gap-2"><i class="fas fa-photo-video"></i> 3. 影音回憶與地圖導航</h3>
                <ul class="list-disc pl-5 space-y-1">
                    <li><b>放入相片：</b> 將 Google Drive 的相片權限設為「知道連結的人皆可檢視」，把網址貼入「相片網址」欄位，行程就會出現漂亮的預覽圖。</li>
                    <li><b>相簿/影片牆：</b> 點擊左側選單的 <b class="text-warm-600">📸 相簿牆 或 🎬 影片大廳</b>，以絕美瀑布流重溫美好回憶。</li>
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
                <p class="text-amber-700">左側選單的 <i class="fas fa-cog"></i> 齒輪圖示是管理員後台。內含「一鍵匯入政府國定假日」與「雲端備份還原」等高權限功能。</p>
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
        const videoModal = document.getElementById('video-gallery-modal');
        if (videoModal && !videoModal.classList.contains('hidden')) {
            videoModal.classList.add('translate-x-full');
            setTimeout(() => {
                videoModal.classList.add('hidden');
                document.getElementById('video-grid-container').innerHTML = '';
            }, 300);
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
    const pwd = prompt('🔒 此功能需驗證權限，請輸入管理員密碼：');
    if (pwd === null) return; 
    if (pwd === ADMIN_PASSWORD) {
        callback();
    } else {
        alert('❌ 密碼錯誤！您無權執行此操作。');
    }
}

// 🌟 Apple Watch 同步匯出按鈕：直接在此處綁定，避免 setTimeout 遺失
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

    if (!document.getElementById('btn-cleanup-holidays')) {
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

        // 綁定 Apple Watch 匯出按鈕
        const appleBtn = document.createElement('button');
        appleBtn.id = 'btn-export-apple';
        appleBtn.className = 'w-full py-2.5 mt-4 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm cursor-pointer transition-all active:scale-95';
        appleBtn.innerHTML = '<i class="fab fa-apple text-base"></i> 匯出至 Apple Watch / 內建行事曆';
        importGovBtn.parentNode.appendChild(appleBtn);
        
        appleBtn.addEventListener('click', () => {
            const pwd = prompt('🔒 此功能需驗證權限，請輸入管理員密碼：');
            if (pwd !== ADMIN_PASSWORD) return alert('❌ 密碼錯誤！');
            if (events.length === 0) return alert('目前沒有任何行程喔！');
            
            let ics = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Family Calendar//TW\nCALSCALE:GREGORIAN\n";
            events.forEach(e => {
                const s = e.startDate.replace(/-/g, '');
                let ed = new Date(e.endDate || e.startDate);
                ed.setDate(ed.getDate() + 1);
                const eStr = ed.getFullYear() + String(ed.getMonth()+1).padStart(2,'0') + String(ed.getDate()).padStart(2,'0');
                ics += "BEGIN:VEVENT\nSUMMARY:" + (e.icon||'') + e.title + "\nDTSTART;VALUE=DATE:" + s + "\nDTEND;VALUE=DATE:" + eStr + "\n";
                if (e.location) ics += "LOCATION:" + e.location + "\n";
                ics += "END:VEVENT\n";
            });
            ics += "END:VCALENDAR";
            
            const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'family_events.ics';
            link.click();
        });
    }
}

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

    exportBtn.addEventListener('click', () => {
        requestAdminAccess(async () => {
            if(!confirm('確定要將目前的「所有行程」建立一份新備份到雲端嗎？')) return;
            triggerHaptic();
            try {
                exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 備份中...'; exportBtn.disabled = true;
                const backupData = { exportDate: new Date().toISOString(), events: events };
                const backupId = Date.now().toString();
                await setDoc(doc(db, 'familyBackups', backupId), backupData);
                alert('🎉 雲端備份成功！已建立一份全新的備份存檔。');
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
                        if(confirm(`⚠️ 嚴重警告：\n還原將會【完全覆蓋】您目前行事曆上的所有行程！\n\n確定要時光倒流，還原到 ${timeStr} 的版本嗎？`)) {
                            modal.remove(); cloudRestoreBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 還原中...'; cloudRestoreBtn.disabled = true;
                            try {
                                for (const evt of events) await deleteDoc(doc(eventsRef, evt.id));
                                for (const ev of selectedBackup.events) { delete ev.id; await addDoc(eventsRef, ev); }
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
    
    container.className = 'p-4 masonry-gallery bg-gray-50 flex-1 overflow-y-auto'; 
    
    const photoEvents = events.filter(e => e.photoUrl && e.photoUrl.trim() !== '').sort((a, b) => b.startDate.localeCompare(a.startDate));
    if (photoEvents.length === 0) {
        container.innerHTML = `<div class="col-span-full text-center py-20 text-gray-400"><i class="far fa-images text-5xl mb-4 opacity-50"></i><p class="text-sm font-bold">目前還沒有任何相片記錄喔！</p></div>`;
        return;
    }
    
    photoEvents.forEach((evt, idx) => {
        const item = document.createElement('div');
        item.className = 'masonry-item shadow-sm border border-gray-200';
        const imgUrl = getDirectImageUrl(evt.photoUrl);
        item.innerHTML = `
            <img src="${imgUrl}" loading="lazy" alt="Family Memory">
            <div class="absolute top-2 left-2 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm z-10">${evt.startDate}</div>
            <div class="masonry-overlay">
                <h4 class="font-extrabold text-sm truncate drop-shadow-md">${evt.icon ? evt.icon+' ' : ''}${evt.title}</h4>
                <p class="text-[10px] text-gray-200 mt-1 font-bold"><i class="fas fa-search-plus"></i> 點擊放大觀賞</p>
            </div>
        `;
        item.addEventListener('click', () => { 
            triggerHaptic(); 
            openLightbox(photoEvents, idx); 
        });
        container.appendChild(item);
    });
}

let lightboxInterval = null;
function openLightbox(photoEvents, startIndex) {
    let currentIndex = startIndex;
    let modal = document.getElementById('photo-lightbox-modal');
    
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'photo-lightbox-modal';
        modal.className = 'fixed inset-0 bg-black/95 z-[999] flex flex-col items-center justify-center opacity-0 transition-opacity duration-300';
        modal.innerHTML = `
            <button id="lb-close" class="absolute top-4 right-4 text-white p-4 text-2xl hover:text-rose-400 z-50 transition-colors"><i class="fas fa-times"></i></button>
            <button id="lb-prev" class="absolute left-2 md:left-8 top-1/2 -translate-y-1/2 text-white/70 p-4 text-4xl md:text-5xl hover:text-white hover:scale-110 z-50 transition-all"><i class="fas fa-chevron-left"></i></button>
            <button id="lb-next" class="absolute right-2 md:right-8 top-1/2 -translate-y-1/2 text-white/70 p-4 text-4xl md:text-5xl hover:text-white hover:scale-110 z-50 transition-all"><i class="fas fa-chevron-right"></i></button>
            
            <div class="relative w-full max-w-6xl px-12 md:px-24 flex-1 flex items-center justify-center">
                <img id="lb-img" class="max-h-[75vh] w-auto max-w-full object-contain rounded-lg shadow-2xl transition-all duration-300 opacity-0 scale-95">
            </div>
            
            <div class="absolute bottom-8 left-0 right-0 flex flex-col items-center gap-4 z-50">
                <div id="lb-title" class="text-white font-extrabold text-lg md:text-2xl drop-shadow-lg tracking-wide"></div>
                <div class="flex items-center gap-4">
                    <button id="lb-play" class="px-5 py-2.5 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white rounded-full text-sm font-bold flex items-center gap-2 transition-all shadow-lg border border-white/10"><i class="fas fa-play"></i> 電子相框輪播</button>
                    <button id="lb-goto" class="px-5 py-2.5 bg-warm-500 hover:bg-warm-600 text-white rounded-full text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-warm-500/30"><i class="fas fa-calendar-day"></i> 開啟行程明細</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        document.getElementById('lb-close').onclick = closeLB;
        document.getElementById('lb-prev').onclick = () => showIdx(currentIndex - 1);
        document.getElementById('lb-next').onclick = () => showIdx(currentIndex + 1);
        
        document.addEventListener('keydown', (e) => {
            if (modal.classList.contains('hidden')) return;
            if (e.key === 'ArrowLeft') showIdx(currentIndex - 1);
            if (e.key === 'ArrowRight') showIdx(currentIndex + 1);
            if (e.key === 'Escape') closeLB();
        });
    }
    
    modal.classList.remove('hidden');
    void modal.offsetWidth; 
    modal.classList.replace('opacity-0', 'opacity-100');
    
    let isPlaying = false;
    const playBtn = document.getElementById('lb-play');
    playBtn.innerHTML = '<i class="fas fa-play"></i> 電子相框輪播';
    playBtn.className = 'px-5 py-2.5 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white rounded-full text-sm font-bold flex items-center gap-2 transition-all shadow-lg border border-white/10';
    if(lightboxInterval) clearInterval(lightboxInterval);
    
    function showIdx(idx) {
        if (idx < 0) idx = photoEvents.length - 1;
        if (idx >= photoEvents.length) idx = 0;
        currentIndex = idx;
        const evt = photoEvents[idx];
        
        const img = document.getElementById('lb-img');
        img.classList.remove('opacity-100', 'scale-100');
        img.classList.add('opacity-0', 'scale-95');
        
        setTimeout(() => {
            img.src = getDirectImageUrl(evt.photoUrl);
            img.onload = () => {
                img.classList.remove('opacity-0', 'scale-95');
                img.classList.add('opacity-100', 'scale-100');
            };
        }, 150);
        
        document.getElementById('lb-title').innerText = `${evt.startDate} | ${evt.icon ? evt.icon+' ' : ''}${evt.title}`;
        
        document.getElementById('lb-goto').onclick = () => {
            closeLB();
            document.getElementById('gallery-modal').classList.add('hidden');
            openViewModal(evt.id);
        };
    }
    
    function closeLB() {
        modal.classList.replace('opacity-100', 'opacity-0');
        setTimeout(() => modal.classList.add('hidden'), 300);
        if(lightboxInterval) clearInterval(lightboxInterval);
        isPlaying = false;
    }
    
    playBtn.onclick = () => {
        isPlaying = !isPlaying;
        if(isPlaying) {
            playBtn.innerHTML = '<i class="fas fa-pause"></i> 停止輪播';
            playBtn.className = 'px-5 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-full text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-rose-500/30';
            lightboxInterval = setInterval(() => showIdx(currentIndex + 1), 3500);
        } else {
            playBtn.innerHTML = '<i class="fas fa-play"></i> 電子相框輪播';
            playBtn.className = 'px-5 py-2.5 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white rounded-full text-sm font-bold flex items-center gap-2 transition-all shadow-lg border border-white/10';
            clearInterval(lightboxInterval);
        }
    };
    
    showIdx(startIndex);
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

function addPayerRow(name = '', amount = '') {
    const row = document.createElement('div');
    row.className = 'flex items-center gap-2 payer-row';
    row.innerHTML = `
        <select class="payer-name w-1/3 px-2 py-1.5 bg-white border rounded-xl text-xs outline-none cursor-pointer" required>${getMemberOptions(name, '代墊人...')}</select>
        <input type="number" placeholder="金額 $" value="${amount}" class="payer-amount flex-1 px-3 py-1.5 bg-white border rounded-xl text-xs outline-none" required>
        <button type="button" class="text-rose-400 p-1"><i class="fas fa-trash-alt"></i></button>
    `;
    row.querySelector('button').addEventListener('click', () => { row.remove(); updateUniqueSelects('payers-container', '.payer-name'); });
    row.querySelector('.payer-name').addEventListener('change', () => { updateUniqueSelects('payers-container', '.payer-name'); });
    payersContainer.appendChild(row);
    updateUniqueSelects('payers-container', '.payer-name');
}
document.getElementById('btn-add-payer').addEventListener('click', () => addPayerRow());

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
    cell.innerHTML = `<div class="flex justify-between items-center px-0.5"><span class="text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full ${dateNumColor}">${dayNum}</span><span class="text-[9px] text-blue-500">${weatherData[dateStr] || ''}</span></div>`;
    
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
                (evt.payers || []).forEach(p => addPayerRow(p.name, p.amount));
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
        
        vBox.style.cssText = "width: 100%; aspect-ratio: 16/9; background: #000; border-radius: 0.75rem; overflow: hidden; margin-top: 0.75rem; position: relative;";
        vIframe.style.cssText = "position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none;";
        vIframe.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture');
        vIframe.setAttribute('allowfullscreen', 'true');
        vElement.style.cssText = "position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: contain; outline: none;";
        vElement.setAttribute('controls', 'true');
        
        let ytId = '';
        try {
            if (url.includes('v=')) ytId = url.split('v=')[1].split('&')[0];
            else if (url.includes('youtu.be/')) ytId = url.split('youtu.be/')[1].split('?')[0];
            else if (url.includes('shorts/')) ytId = url.split('shorts/')[1].split('?')[0];
        } catch(e) {}

        if (ytId && ytId.length > 5) {
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
                alert('🎉 已成功將最高票拍板定案！'); document.getElementById('view-modal').classList.add('hidden');
                if (window.confetti) confetti({ particleCount: 200, spread: 100, origin: { y: 0.5 }, zIndex: 9999 });
            }
        };
        pollContainer.classList.remove('hidden');
    } else pollContainer.classList.add('hidden');

    const expenseContainer = document.getElementById('view-expense-container');
    const expenseDetails = document.getElementById('view-expense-details');
    if (evt.isExpense && evt.payers && evt.payers.length > 0) {
        let totalExpense = evt.payers.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
        let totalWeight = (evt.sharers || []).reduce((sum, s) => sum + (parseFloat(s.weight) || 1), 0) || 1;
        let perWeightAmount = totalExpense / totalWeight;
        let html = `<div class="font-bold border-b border-amber-200 pb-1 mb-1">總支出：$${totalExpense.toLocaleString()} 元</div><div class="space-y-1">`;
        (evt.sharers || []).forEach(s => {
            let shareAmt = Math.round(perWeightAmount * (parseFloat(s.weight) || 1));
            html += `<div class="flex justify-between"><span>👤 ${s.name} (${s.weight}份)：</span><span class="font-bold">$${shareAmt.toLocaleString()} 元</span></div>`;
        });
        html += `</div>`;
        expenseDetails.innerHTML = html; expenseContainer.classList.remove('hidden');
    } else expenseContainer.classList.add('hidden');

    document.getElementById('view-modal').classList.add('hidden'); document.getElementById('view-modal').classList.remove('hidden');
}