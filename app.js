function renderGalleryGrid() {
    const container = document.getElementById('gallery-grid-container');
    container.innerHTML = '';
    
    // 過濾有照片的行程，並由新到舊排序
    const photoEvents = events.filter(e => e.photoUrl && e.photoUrl.trim() !== '').sort((a, b) => b.startDate.localeCompare(a.startDate));
    
    // 🎨 網格底圖：改成可愛的「手帳方格紙」背景
    container.style.cssText = 'background-color: #fdfbf9; background-image: linear-gradient(#e5e7eb 1px, transparent 1px), linear-gradient(90deg, #e5e7eb 1px, transparent 1px); background-size: 20px 20px;';
    
    // 空狀態設計
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
    
    // 容器加上足夠的 padding，避免傾斜的相片被裁切
    container.className = 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5 md:gap-8 items-start content-start p-6 md:p-8 overflow-x-hidden';
    
    // 定義拍立得「永久隨機傾斜」與「紙膠帶顏色」 (這是手機版不單調的秘訣！)
    const rotates = ['-rotate-3', 'rotate-2', '-rotate-2', 'rotate-3', '-rotate-4', 'rotate-4'];
    const tapeColors = ['bg-rose-200/80 border-rose-300', 'bg-amber-200/80 border-amber-300', 'bg-blue-200/80 border-blue-300', 'bg-emerald-200/80 border-emerald-300'];
    const tapeRotates = ['rotate-2', '-rotate-3', 'rotate-1', '-rotate-2'];

    photoEvents.forEach((evt, index) => {
        const item = document.createElement('div');
        
        const cardRot = rotates[index % rotates.length];
        const tColor = tapeColors[index % tapeColors.length];
        const tRot = tapeRotates[index % tapeRotates.length];
        const animDelay = (index * 50) + 'ms'; // 載入時有骨牌般的動畫
        
        // 📷 拍立得卡片本體：加上方型留白、陰影與永久傾斜
        item.className = `relative bg-white p-2 md:p-3 pb-8 md:pb-10 rounded-sm shadow-md border border-gray-100 cursor-pointer flex flex-col transform transition-all duration-300 hover:z-20 hover:scale-110 hover:rotate-0 hover:shadow-2xl animate-fade-in ${cardRot}`;
        item.style.animationDelay = animDelay;
        item.style.animationFillMode = 'both';
        
        const imgUrl = getDirectImageUrl(evt.photoUrl);
        // 將日期轉為 2026.11.09 格式
        const dateStr = evt.startDate.replace(/-/g, '.');

        item.innerHTML = `
            <!-- 🎗️ 裝飾紙膠帶 (隨機顏色與角度) -->
            <div class="absolute -top-2 left-1/2 transform -translate-x-1/2 w-12 md:w-16 h-4 md:h-5 ${tColor} border-x-2 border-dashed z-10 ${tRot}" style="mix-blend-mode: multiply;"></div>
            
            <!-- 相片區塊 (正方形) -->
            <div class="aspect-square w-full overflow-hidden bg-gray-100 relative shadow-inner">
                <img src="${imgUrl}" class="w-full h-full object-cover filter contrast-[1.05] brightness-[1.02]" loading="lazy">
                
                <!-- 📸 復古底片日期 (橘色相機日期風格) -->
                <div class="absolute bottom-1.5 right-1.5 z-10">
                    <span class="text-orange-500 font-mono text-[10px] md:text-xs font-bold drop-shadow-[0_1px_1px_rgba(255,255,255,0.8)] tracking-tighter">
                        '${dateStr.slice(2)}
                    </span>
                </div>
            </div>
            
            <!-- 標題與地點 (拍立得下方留白區) -->
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