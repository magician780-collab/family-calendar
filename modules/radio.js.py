// modules/radio.js

export function initRadioPlayer() {
    if (document.getElementById('radio-widget')) return;

    // 獨立的震動函數，避免依賴外部 app.js
    function triggerHaptic() {
        if (window.navigator && window.navigator.vibrate) window.navigator.vibrate(10);
    }

    let stations = [
        { name: "🎵 輕鬆背景音 (MP3)", url: "https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3", type: "bgm" },
        { name: "📺 微微笑廣播網 (YouTube Live)", url: "https://www.youtube.com/watch?v=jfKfPfyJRdk", type: "live" },
        { name: "📻 台北愛樂 (古典樂 MP3)", url: "https://onair.family977.com.tw:8977/live.mp3", type: "live" },
        { name: "📻 K-POP 流行音樂 (MP3)", url: "https://listen.moe/kpop/fallback", type: "live" }
    ];

    try {
        const customStations = JSON.parse(localStorage.getItem('my_custom_stations') || '[]');
        stations = [...stations, ...customStations];
    } catch (e) {}

    let currentStationIdx = 0;
    let hlsInstance = null; 

    const radioContainer = document.createElement('div');
    radioContainer.id = 'radio-widget';
    radioContainer.className = 'fixed z-[100] flex items-center gap-1.5 md:gap-2 bg-white/90 backdrop-blur-md px-3 py-2 md:px-4 md:py-2.5 rounded-full shadow-lg border border-warm-200 select-none cursor-grab active:cursor-grabbing hover:scale-105';
    
    const savedPos = localStorage.getItem('radio_widget_pos');
    if (savedPos) {
        try {
            const pos = JSON.parse(savedPos);
            let nx = pos.left, ny = pos.top;
            if (nx < 0) nx = 20; if (ny < 0) ny = 20;
            if (nx > window.innerWidth - 100) nx = window.innerWidth - 150;
            if (ny > window.innerHeight - 50) ny = window.innerHeight - 100;
            radioContainer.style.left = nx + 'px';
            radioContainer.style.top = ny + 'px';
        } catch(e) {}
    } else {
        radioContainer.style.bottom = '24px';
        radioContainer.style.right = '24px';
    }

    radioContainer.innerHTML = `
        <div id="btn-radio-play" class="relative flex items-center justify-center w-7 h-7 md:w-9 md:h-9 rounded-full bg-warm-100 hover:bg-warm-200 transition-colors shrink-0 cursor-pointer">
            <i id="radio-icon" class="fas fa-play text-warm-600 text-xs md:text-sm pl-0.5 pointer-events-none"></i>
        </div>
        <div class="flex flex-col justify-center max-w-[110px] md:max-w-[140px] pr-1 pointer-events-none">
            <span id="radio-text" class="text-[10px] md:text-xs font-bold text-warm-700 truncate">${stations[0].name}</span>
            <span id="radio-status" class="text-[9px] md:text-[10px] text-warm-500 font-medium truncate">點擊播放</span>
        </div>
        <button id="btn-radio-menu" class="w-6 h-6 md:w-8 md:h-8 rounded-full text-warm-400 hover:text-warm-600 hover:bg-warm-50 flex items-center justify-center transition-colors shrink-0 cursor-pointer" title="開啟電台選單">
            <i class="fas fa-list-ul text-[10px] md:text-xs pointer-events-none"></i>
        </button>
        <audio id="radio-audio" preload="none"></audio>
        <div id="yt-radio-container" class="absolute w-[1px] h-[1px] opacity-0 pointer-events-none overflow-hidden"></div>
    `;
    document.body.appendChild(radioContainer);

    const menuContainer = document.createElement('div');
    menuContainer.id = 'radio-menu';
    menuContainer.className = 'fixed z-[101] bg-white/95 backdrop-blur-lg border border-warm-200 rounded-2xl shadow-xl p-2 w-64 max-h-[60vh] overflow-y-auto hidden animate-fade-in flex flex-col gap-1';
    document.body.appendChild(menuContainer);
    
    const audio = document.getElementById('radio-audio');
    const ytContainer = document.getElementById('yt-radio-container');
    const playBtn = document.getElementById('btn-radio-play');
    const menuBtn = document.getElementById('btn-radio-menu');
    const icon = document.getElementById('radio-icon');
    const text = document.getElementById('radio-text');
    const statusText = document.getElementById('radio-status');
    let isPlaying = false;

    let isDragging = false;
    let hasDragged = false;
    let dragStartX = 0, dragStartY = 0;
    let initialLeft = 0, initialTop = 0;

    const onDragStart = (e) => {
        if (e.type === 'touchstart') {
            dragStartX = e.touches[0].clientX;
            dragStartY = e.touches[0].clientY;
        } else {
            dragStartX = e.clientX;
            dragStartY = e.clientY;
        }
        isDragging = true;
        hasDragged = false;
        
        const rect = radioContainer.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;

        radioContainer.style.bottom = 'auto';
        radioContainer.style.right = 'auto';
        radioContainer.style.left = initialLeft + 'px';
        radioContainer.style.top = initialTop + 'px';
        radioContainer.style.transition = 'none';
    };

    const onDragMove = (e) => {
        if (!isDragging) return;
        e.preventDefault();

        const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
        const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
        
        const dx = clientX - dragStartX;
        const dy = clientY - dragStartY;

        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) hasDragged = true;

        let newLeft = initialLeft + dx;
        let newTop = initialTop + dy;

        const rect = radioContainer.getBoundingClientRect();
        if (newLeft < 0) newLeft = 0;
        if (newTop < 0) newTop = 0;
        if (newLeft + rect.width > window.innerWidth) newLeft = window.innerWidth - rect.width;
        if (newTop + rect.height > window.innerHeight) newTop = window.innerHeight - rect.height;

        radioContainer.style.left = newLeft + 'px';
        radioContainer.style.top = newTop + 'px';
    };

    const onDragEnd = () => {
        if (!isDragging) return;
        isDragging = false;
        radioContainer.style.transition = 'all 0.3s ease';
        if (hasDragged) {
            const rect = radioContainer.getBoundingClientRect();
            localStorage.setItem('radio_widget_pos', JSON.stringify({ left: rect.left, top: rect.top }));
        }
    };

    radioContainer.addEventListener('mousedown', onDragStart);
    document.addEventListener('mousemove', onDragMove, { passive: false });
    document.addEventListener('mouseup', onDragEnd);

    radioContainer.addEventListener('touchstart', onDragStart, { passive: true });
    document.addEventListener('touchmove', onDragMove, { passive: false });
    document.addEventListener('touchend', onDragEnd);

    radioContainer.addEventListener('click', (e) => {
        if (hasDragged) {
            e.preventDefault();
            e.stopPropagation();
            hasDragged = false;
        }
    }, true);

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

        const addBtn = document.createElement('button');
        addBtn.className = 'w-full mt-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-500 rounded-xl text-xs md:text-sm font-bold border border-dashed border-gray-300 transition-colors flex items-center justify-center gap-1';
        addBtn.innerHTML = '<i class="fas fa-plus"></i> 手動輸入電台/YouTube網址';
        addBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const newName = prompt('請輸入電台名稱 (例如：飛碟聯播網)：');
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
        menuContainer.appendChild(addBtn);
    }

    renderMenu();

    menuBtn.addEventListener('click', (e) => {
        e.stopPropagation(); 
        triggerHaptic();
        if (hasDragged) { hasDragged = false; return; }
        
        if (menuContainer.classList.contains('hidden')) {
            const rect = radioContainer.getBoundingClientRect();
            let menuTop = rect.top - 260;
            if (menuTop < 10) menuTop = rect.bottom + 10;
            
            let menuLeft = rect.right - 256;
            if (menuLeft < 10) menuLeft = 10;
            
            menuContainer.style.top = menuTop + 'px';
            menuContainer.style.left = menuLeft + 'px';
        }
        menuContainer.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
        if (!radioContainer.contains(e.target) && !menuContainer.contains(e.target)) menuContainer.classList.add('hidden');
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
        if (hasDragged) { hasDragged = false; return; }
        
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