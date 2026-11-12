<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>溫馨家族行事曆</title>
    
    <link rel="manifest" href="manifest.json">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="家族行事曆">
    <link rel="apple-touch-icon" href="./family-icon.jpg">

    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/lunar-javascript@1.6.12/lunar.js"></script>

    <script>
        tailwind.config = {
            theme: { 
                extend: { 
                    fontFamily: { sans: ['Nunito', 'sans-serif'] }, 
                    colors: { 
                        warm: { 
                            50: 'var(--color-50)', 100: 'var(--color-100)', 200: 'var(--color-200)', 
                            300: 'var(--color-300)', 400: 'var(--color-400)', 500: 'var(--color-500)', 
                            600: 'var(--color-600)', 700: 'var(--color-700)', 800: 'var(--color-800)', 900: 'var(--color-900)' 
                        } 
                    } 
                } 
            }
        }
    </script>
    <link rel="stylesheet" href="./style.css">
</head>
<body class="text-gray-800 h-screen flex flex-col md:flex-row overflow-hidden theme-warm relative" id="app-body">
    
    <header class="md:hidden bg-white border-b border-warm-200 px-4 py-3 flex items-center justify-between z-20 shrink-0 shadow-sm">
        <button id="btn-toggle-sidebar" class="w-10 h-10 bg-warm-100 text-warm-700 rounded-xl flex items-center justify-center font-bold transition-all active:scale-95 shadow-sm">
            <i class="fas fa-bars text-lg"></i>
        </button>
        <h1 class="text-lg font-extrabold text-warm-800 flex items-center gap-1.5"><i class="fas fa-home text-warm-500"></i> 我們這一家</h1>
        <button id="btn-mobile-add" class="w-10 h-10 bg-warm-500 text-white rounded-xl flex items-center justify-center font-bold transition-all active:scale-95 shadow-md shadow-warm-500/30">
            <i class="fas fa-plus"></i>
        </button>
    </header>

    <aside id="sidebar" class="fixed inset-y-0 left-0 z-40 w-80 lg:w-96 bg-white border-r border-warm-200 flex flex-col shadow-2xl md:shadow-[4px_0_24px_rgba(249,115,22,0.05)] transform -translate-x-full md:translate-x-0 transition-transform duration-300 ease-in-out md:static h-full">
        <div class="p-6 pb-4 border-b border-warm-100 bg-warm-50 flex items-center justify-between select-none">
            <h1 class="text-xl md:text-2xl font-bold text-warm-800 flex items-center gap-2"><i class="fas fa-home text-warm-500"></i> 我們這一家</h1>
            <div class="flex items-center gap-2">
                <button id="btn-open-admin" class="w-10 h-10 bg-warm-100 hover:bg-warm-200 text-warm-700 rounded-xl flex items-center justify-center font-bold transition-all active:scale-95 shadow-sm" title="管理員後台">
                    <i class="fas fa-cog text-lg"></i>
                </button>
                <button id="btn-close-sidebar" class="md:hidden w-10 h-10 rounded-full bg-warm-100 text-warm-700 flex items-center justify-center"><i class="fas fa-times text-lg"></i></button>
            </div>
        </div>
        
        <div class="px-5 pt-5 pb-3 bg-warm-50/50 border-b border-warm-100 space-y-3 shrink-0">
            <div class="flex items-center justify-between bg-white px-4 py-2.5 rounded-xl border border-warm-200 shadow-sm">
                <span class="text-sm md:text-base font-bold text-warm-800 flex items-center gap-1.5"><i class="fas fa-palette text-warm-500"></i> 主題風格</span>
                <select id="theme-select" class="bg-warm-50 border border-warm-200 text-sm md:text-base font-bold text-warm-800 rounded-lg px-2 py-1 outline-none cursor-pointer">
                    <option value="warm">🍊 溫馨暖橘</option>
                    <option value="forest">🌿 清新森林</option>
                    <option value="purple">💜 浪漫柔紫</option>
                    <option value="dark">🌙 極簡暗黑</option>
                </select>
            </div>
            <div class="relative">
                <i class="fas fa-search absolute left-4 top-3.5 text-gray-400 text-base"></i>
                <input type="text" id="search-input" placeholder="搜尋行程或成員..." class="w-full pl-11 pr-4 py-2.5 bg-white border border-warm-200 rounded-xl text-base outline-none shadow-sm">
            </div>
            <button id="btn-open-gallery" class="w-full py-3 bg-warm-100 hover:bg-warm-200 text-warm-800 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-2 shadow-sm">
                <i class="fas fa-photo-film text-warm-600"></i> 📸 家庭回憶相簿牆
            </button>
        </div>

        <div class="p-5 flex-1 overflow-y-auto hide-scrollbar relative flex flex-col">
            <h2 class="text-base md:text-lg font-extrabold text-warm-600 uppercase tracking-wider mb-3 px-1 shrink-0">即將到來</h2>
            <div id="upcoming-events" class="space-y-3 shrink-0"></div>
            <div id="no-upcoming" class="hidden text-center py-6 text-gray-400 shrink-0">
                <i class="far fa-calendar-check text-4xl mb-3 opacity-50"></i>
                <p class="text-base">沒有符合的行程喔！</p>
            </div>
            <div class="mt-4 flex-1 flex flex-col bg-amber-50 rounded-2xl border border-amber-200 p-4 shadow-sm min-h-[140px]">
                <div class="flex justify-between items-center mb-2 shrink-0">
                    <h3 class="text-sm md:text-base font-bold text-amber-800 flex items-center gap-1.5"><i class="fas fa-sticky-note text-amber-500"></i> 家庭便利貼</h3>
                    <span id="note-status" class="text-xs font-bold text-amber-600 opacity-0 transition-opacity">已同步</span>
                </div>
                <textarea id="family-sticky-note" placeholder="隨手記下家庭瑣事..." class="w-full flex-1 bg-transparent border-none resize-none outline-none text-base text-amber-900 placeholder-amber-700/40 hide-scrollbar"></textarea>
            </div>
            <div class="absolute top-5 right-5 text-xs text-gray-300 font-bold select-none">v6.9</div>
        </div>

        <div class="p-5 border-t border-warm-100 bg-white space-y-2 shrink-0 hidden md:block">
            <button id="btn-open-add" class="w-full py-3.5 bg-warm-500 hover:bg-warm-600 text-white rounded-2xl font-extrabold text-lg shadow-lg shadow-warm-500/30 flex items-center justify-center gap-2">
                <i class="fas fa-plus"></i> 新增活動
            </button>
        </div>
    </aside>

    <div id="sidebar-backdrop" class="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 hidden md:hidden"></div>

    <main class="flex-1 flex flex-col h-full bg-[#fdfbf9] overflow-hidden">
        <header class="hidden md:flex px-4 py-3 md:px-8 md:py-4 items-center justify-between bg-white/50 backdrop-blur-sm border-b border-warm-100 shrink-0">
            <div class="flex items-center gap-2 md:gap-4">
                <button id="btn-prev-month" class="w-10 h-10 rounded-full hover:bg-warm-100 text-warm-600 flex items-center justify-center"><i class="fas fa-chevron-left"></i></button>
                <h2 id="current-month-year" class="text-xl md:text-3xl font-extrabold text-warm-900 w-32 md:w-48 text-center"></h2>
                <button id="btn-next-month" class="w-10 h-10 rounded-full hover:bg-warm-100 text-warm-600 flex items-center justify-center"><i class="fas fa-chevron-right"></i></button>
            </div>
            <button id="btn-today" class="px-4 py-2 bg-warm-100 text-warm-700 hover:bg-warm-200 rounded-xl font-semibold text-sm">今天</button>
        </header>

        <div class="md:hidden px-4 py-2 bg-white border-b border-warm-100 flex items-center justify-between shrink-0">
            <button id="btn-mob-prev" class="w-8 h-8 rounded-full bg-warm-50 text-warm-600 flex items-center justify-center"><i class="fas fa-chevron-left text-sm"></i></button>
            <h2 id="mob-month-year" class="text-base font-extrabold text-warm-900"></h2>
            <button id="btn-mob-next" class="w-8 h-8 rounded-full bg-warm-50 text-warm-600 flex items-center justify-center"><i class="fas fa-chevron-right text-sm"></i></button>
            <button id="btn-mob-today" class="px-3 py-1 bg-warm-100 text-warm-700 rounded-lg font-bold text-xs">今天</button>
        </div>
        
        <div id="calendar-swipe-container" class="flex-1 flex flex-col p-2 md:p-4 select-none overflow-hidden">
            <div class="grid grid-cols-7 gap-1 mb-1 shrink-0">
                <div class="text-center font-bold text-rose-500 text-xs md:text-sm py-1">日</div>
                <div class="text-center font-bold text-gray-500 text-xs md:text-sm py-1">一</div>
                <div class="text-center font-bold text-gray-500 text-xs md:text-sm py-1">二</div>
                <div class="text-center font-bold text-gray-500 text-xs md:text-sm py-1">三</div>
                <div class="text-center font-bold text-gray-500 text-xs md:text-sm py-1">四</div>
                <div class="text-center font-bold text-gray-500 text-xs md:text-sm py-1">五</div>
                <div class="text-center font-bold text-blue-500 text-xs md:text-sm py-1">六</div>
            </div>
            <div id="calendar-grid" class="grid grid-cols-7 gap-1 md:gap-2 flex-1"></div>
        </div>
    </main>
    
    <!-- 新增/編輯活動 Modal -->
    <div id="event-modal" class="fixed inset-0 bg-warm-900/40 backdrop-blur-sm z-50 hidden flex items-center justify-center p-4 modal-backdrop" data-close-target="event-modal">
        <div class="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-fade-in max-h-[90vh] flex flex-col modal-content" onclick="event.stopPropagation()">
            <div class="px-6 py-4 bg-warm-50 border-b border-warm-100 flex justify-between items-center shrink-0">
                <h3 id="modal-title" class="text-lg font-bold text-warm-800">新增活動</h3>
                <button id="btn-close-modal" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times text-xl"></i></button>
            </div>
            <form id="event-form" class="p-6 space-y-4 overflow-y-auto">
                <input type="hidden" id="event-id">

                <div>
                    <label class="block text-sm font-bold text-gray-700 mb-1">活動名稱 <span class="text-rose-500">*</span></label>
                    <input type="text" id="event-title" required placeholder="例如：三天兩夜家族露營" class="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-warm-400">
                </div>
                <div>
                    <label class="block text-sm font-bold text-gray-700 mb-1">選擇貼圖</label>
                    <select id="event-icon" class="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm">
                        <option value="">(無貼圖)</option>
                        <option value="🏕️">🏕️ 露營</option>
                        <option value="🎉">🎉 聚會/慶祝</option>
                        <option value="🚗">🚗 出遊/開車</option>
                        <option value="🎂">🎂 生日</option>
                        <option value="❤️">❤️ 約會/紀念</option>
                        <option value="✈️">✈️ 旅遊</option>
                        <option value="🍔">🍔 美食/聚餐</option>
                        <option value="💡">💡 重要事項</option>
                        <option value="🏥">🏥 醫生/回診</option>
                        <option value="🛒">🛒 購物</option>
                    </select>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-bold text-gray-700 mb-1"><i class="fas fa-image text-warm-500"></i> 相片網址 (可選)</label>
                        <input type="url" id="event-photo-url" placeholder="Google Drive 等圖檔連結..." class="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm">
                        <div id="photo-preview" class="mt-2 hidden relative">
                            <img src="" class="w-full h-24 object-cover rounded-xl border">
                            <button type="button" id="btn-remove-photo" class="absolute top-2 right-2 w-7 h-7 bg-white/80 rounded-full text-rose-500 flex items-center justify-center"><i class="fas fa-trash-alt"></i></button>
                        </div>
                    </div>
                    <div>
                        <label class="block text-sm font-bold text-gray-700 mb-1"><i class="fas fa-video text-purple-500"></i> 影片網址 (可選)</label>
                        <input type="url" id="event-video-url" placeholder="支援 YouTube 或 Drive 連結..." class="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm">
                    </div>
                </div>

                <div>
                    <label class="block text-sm font-bold text-gray-700 mb-1"><i class="fas fa-paperclip text-blue-500"></i> 相關檔案/文件附件網址 (可選)</label>
                    <input type="url" id="event-file-url" placeholder="例如 Google 雲端 PDF 網址..." class="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm">
                </div>
                
                <div>
                    <label class="block text-sm font-bold text-gray-700 mb-1"><i class="fas fa-map-marker-alt text-rose-500"></i> 地點名稱與導航連結 (可選)</label>
                    <div class="space-y-2">
                        <input type="text" id="event-location" placeholder="例如：台南市美術館二館" class="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none">
                        <input type="url" id="event-map-url" placeholder="貼上 Google Maps 導航網址..." class="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none">
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-bold text-gray-700 mb-1">開始日期 <span class="text-rose-500">*</span></label>
                        <input type="date" id="event-start-date" required class="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm">
                    </div>
                    <div>
                        <label class="block text-sm font-bold text-gray-700 mb-1">結束日期</label>
                        <input type="date" id="event-end-date" class="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm">
                    </div>
                </div>
                
                <div class="flex items-center gap-2 bg-amber-50/60 p-3 rounded-xl border border-amber-200">
                    <input type="checkbox" id="event-is-lunar-recurring" class="w-4 h-4 text-amber-600 rounded">
                    <label for="event-is-lunar-recurring" class="text-sm font-bold text-amber-900 cursor-pointer">
                        <i class="fas fa-moon text-amber-600 mr-1"></i> 每年農曆生日/節日自動重複
                    </label>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-bold text-gray-700 mb-1">時間</label>
                        <input type="time" id="event-time" class="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm">
                    </div>
                    <div>
                        <div class="flex justify-between items-end mb-1">
                            <label class="block text-sm font-bold text-gray-700">建立者 <span class="text-rose-500">*</span></label>
                            <button type="button" id="btn-manage-members" class="text-xs text-warm-500 hover:text-warm-700 font-bold"><i class="fas fa-users-cog"></i> 管理成員</button>
                        </div>
                        <select id="event-author" required class="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none">
                            <option value="">請選擇建立者...</option>
                        </select>
                    </div>
                </div>
                <div>
                    <label class="block text-sm font-bold text-gray-700 mb-1">詳細備註</label>
                    <textarea id="event-desc" rows="2" placeholder="注意事項..." class="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm"></textarea>
                </div>

                <div class="bg-emerald-50/60 p-3.5 rounded-2xl border border-emerald-100 space-y-3">
                    <div class="flex items-center justify-between">
                        <label class="text-sm font-bold text-emerald-900 flex items-center gap-1.5 cursor-pointer">
                            <i class="fas fa-clipboard-check text-emerald-600"></i> 啟用攜帶裝備 / 任務清單
                        </label>
                        <input type="checkbox" id="event-is-checklist" class="w-4 h-4 text-emerald-500 rounded cursor-pointer">
                    </div>
                    <div id="checklist-fields" class="hidden space-y-2 pt-1">
                        <div id="checklist-items-container" class="space-y-2"></div>
                        <button type="button" id="btn-add-checklist-item" class="px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-xl font-bold text-xs flex items-center gap-1">
                            <i class="fas fa-plus"></i> 新增裝備或任務
                        </button>
                    </div>
                </div>

                <!-- 新增：營地視覺化配置圖 -->
                <div class="bg-teal-50/50 p-3.5 rounded-2xl border border-teal-100 space-y-3">
                    <div class="flex items-center justify-between">
                        <label class="text-sm font-bold text-teal-900 flex items-center gap-1.5 cursor-pointer">
                            <i class="fas fa-campground text-teal-600"></i> 啟用 19x19 營地視覺配置圖
                        </label>
                        <input type="checkbox" id="event-is-campsite" class="w-4 h-4 text-teal-500 rounded cursor-pointer">
                    </div>
                    <div id="campsite-fields" class="hidden space-y-2 pt-1">
                        <p class="text-[11px] text-teal-700 font-bold bg-teal-100/50 p-2 rounded-lg">💡 請直接拖曳下方 5 頂 (7x7) 帳篷來安排營位。中央虛線區為建議的「兒童跑跳保留區」。</p>
                        <div id="campsite-canvas" class="relative w-full aspect-square bg-teal-50 border-2 border-teal-200 rounded-lg overflow-hidden touch-none" 
                             style="background-image: linear-gradient(#99f6e4 1px, transparent 1px), linear-gradient(90deg, #99f6e4 1px, transparent 1px); background-size: calc(100%/19) calc(100%/19);">
                            <!-- 兒童遊憩區 (視覺提示) -->
                            <div class="absolute border-2 border-dashed border-teal-400 bg-teal-400/10 pointer-events-none flex items-center justify-center"
                                 style="left: calc(100%/19 * 5); top: calc(100%/19 * 5); width: calc(100%/19 * 9); height: calc(100%/19 * 9);">
                                <span class="text-teal-700/60 font-bold text-xs"><i class="fas fa-child"></i> 兒童遊憩區</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="bg-indigo-50/50 p-3.5 rounded-2xl border border-indigo-100 space-y-3">
                    <div class="flex items-center justify-between">
                        <label class="text-sm font-bold text-indigo-900 flex items-center gap-1.5 cursor-pointer">
                            <i class="fas fa-poll text-indigo-600"></i> 啟用活動意願投票 (保密投票)
                        </label>
                        <input type="checkbox" id="event-is-poll" class="w-4 h-4 text-indigo-500 rounded cursor-pointer">
                    </div>
                    <div id="poll-fields" class="hidden space-y-2 pt-1">
                        <div id="poll-options-container" class="space-y-2"></div>
                        <button type="button" id="btn-add-poll-option" class="px-3 py-1.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-800 rounded-xl font-bold text-xs flex items-center gap-1">
                            <i class="fas fa-plus"></i> 新增選項
                        </button>
                    </div>
                </div>

                <div class="bg-amber-50/50 p-3.5 rounded-2xl border border-amber-100 space-y-3">
                    <div class="flex items-center justify-between">
                        <label class="text-sm font-bold text-amber-900 flex items-center gap-1.5 cursor-pointer">
                            <i class="fas fa-receipt text-amber-600"></i> 啟用代墊記帳與分帳
                        </label>
                        <input type="checkbox" id="event-is-expense" class="w-4 h-4 text-warm-500 rounded cursor-pointer">
                    </div>
                    <div id="expense-fields" class="hidden space-y-3 pt-1">
                        <div>
                            <label class="block text-xs font-bold text-gray-600 mb-1">誰先出錢了？（代墊紀錄）</label>
                            <div id="payers-container" class="space-y-2"></div>
                            <button type="button" id="btn-add-payer" class="mt-2 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-xl font-bold text-xs flex items-center gap-1">
                                <i class="fas fa-plus"></i> 新增代墊人
                            </button>
                        </div>
                        <div class="pt-2 border-t border-amber-200/60">
                            <label class="block text-xs font-bold text-gray-600 mb-1">分攤對象與份數</label>
                            <div id="sharers-container" class="space-y-2 mb-2"></div>
                            <button type="button" id="btn-add-sharer" class="px-3 py-1.5 bg-orange-100 hover:bg-orange-200 text-orange-800 rounded-xl font-bold text-xs flex items-center gap-1">
                                <i class="fas fa-user-friends"></i> 新增分攤成員
                            </button>
                        </div>
                    </div>
                </div>

                <div>
                    <label class="block text-sm font-bold text-gray-700 mb-2">標籤顏色</label>
                    <div class="flex flex-wrap gap-3">
                        <label class="cursor-pointer"><input type="radio" name="event-color" value="bg-rose-400" class="peer sr-only" checked><div class="w-8 h-8 rounded-full bg-rose-400 ring-2 ring-transparent peer-checked:ring-rose-600"></div></label>
                        <label class="cursor-pointer"><input type="radio" name="event-color" value="bg-red-500" class="peer sr-only"><div class="w-8 h-8 rounded-full bg-red-500 ring-2 ring-transparent peer-checked:ring-red-700"></div></label>
                        <label class="cursor-pointer"><input type="radio" name="event-color" value="bg-blue-400" class="peer sr-only"><div class="w-8 h-8 rounded-full bg-blue-400 ring-2 ring-transparent peer-checked:ring-blue-600"></div></label>
                        <label class="cursor-pointer"><input type="radio" name="event-color" value="bg-indigo-500" class="peer sr-only"><div class="w-8 h-8 rounded-full bg-indigo-500 ring-2 ring-transparent peer-checked:ring-indigo-700"></div></label>
                        <label class="cursor-pointer"><input type="radio" name="event-color" value="bg-emerald-400" class="peer sr-only"><div class="w-8 h-8 rounded-full bg-emerald-400 ring-2 ring-transparent peer-checked:ring-emerald-600"></div></label>
                        <label class="cursor-pointer"><input type="radio" name="event-color" value="bg-amber-400" class="peer sr-only"><div class="w-8 h-8 rounded-full bg-amber-400 ring-2 ring-transparent peer-checked:ring-amber-600"></div></label>
                        <label class="cursor-pointer"><input type="radio" name="event-color" value="bg-purple-400" class="peer sr-only"><div class="w-8 h-8 rounded-full bg-purple-400 ring-2 ring-transparent peer-checked:ring-purple-700"></div></label>
                        <label class="cursor-pointer"><input type="radio" name="event-color" value="bg-gray-600" class="peer sr-only"><div class="w-8 h-8 rounded-full bg-gray-600 ring-2 ring-transparent peer-checked:ring-gray-800"></div></label>
                    </div>
                </div>
                <div class="pt-2 flex gap-3 shrink-0">
                    <button type="button" id="btn-delete" class="hidden px-4 py-2 bg-gray-100 hover:bg-rose-100 text-gray-600 rounded-xl font-bold">刪除</button>
                    <div class="flex-1"></div>
                    <button type="button" id="btn-cancel-modal" class="px-5 py-2 text-gray-500 hover:bg-gray-100 rounded-xl font-bold">取消</button>
                    <button type="submit" id="btn-save-event" class="px-6 py-2 bg-warm-500 hover:bg-warm-600 text-white rounded-xl font-bold shadow-md">儲存</button>
                </div>
            </form>
        </div>
    </div>

    <!-- Gallery Modal (手帳拍立得升級版) -->
    <div id="gallery-modal" class="fixed inset-0 bg-warm-900/60 backdrop-blur-md z-[100] hidden flex items-center justify-center p-4 md:p-6 modal-backdrop" data-close-target="gallery-modal">
        <div class="bg-[#f8f9fa] w-full max-w-5xl h-[85vh] md:h-[90vh] rounded-[2rem] shadow-2xl overflow-hidden flex flex-col modal-content ring-1 ring-white/50" onclick="event.stopPropagation()">
            
            <!-- 質感標題區 -->
            <div class="px-6 py-5 bg-white border-b border-gray-100 flex justify-between items-center z-10 shadow-sm relative">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-gradient-to-br from-warm-400 to-rose-400 flex items-center justify-center text-white shadow-md">
                        <i class="fas fa-camera-retro text-lg"></i>
                    </div>
                    <div>
                        <h3 class="text-xl font-extrabold text-gray-800 tracking-wide">家庭回憶相簿</h3>
                        <p class="text-xs text-gray-400 font-medium mt-0.5">記錄我們的美好時刻</p>
                    </div>
                </div>
                <button id="btn-close-gallery" class="w-10 h-10 rounded-full bg-gray-50 hover:bg-gray-200 text-gray-500 transition-colors flex items-center justify-center active:scale-95">
                    <i class="fas fa-times text-xl"></i>
                </button>
            </div>
            
            <!-- 內容網格區 (由 JS 動態生成排版) -->
            <div id="gallery-grid-container" class="overflow-y-auto flex-1 relative">
                <!-- 相片將透過 JS 動態生成至此 -->
            </div>
        </div>
    </div>

    <!-- Day Modal -->
    <div id="day-modal" class="fixed inset-0 bg-warm-900/40 backdrop-blur-sm z-50 hidden flex items-center justify-center p-4 modal-backdrop" data-close-target="day-modal">
        <div class="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] modal-content" onclick="event.stopPropagation()">
            <div class="px-6 py-4 bg-warm-50 border-b flex justify-between items-center"><h3 id="day-modal-title" class="text-lg font-bold">當日行程</h3><button id="btn-close-day-modal" class="text-gray-400"><i class="fas fa-times text-xl"></i></button></div>
            <div id="day-modal-list" class="p-4 space-y-3 overflow-y-auto flex-1"></div>
        </div>
    </div>

    <!-- View Modal -->
    <div id="view-modal" class="fixed inset-0 bg-warm-900/40 backdrop-blur-sm z-50 hidden flex items-center justify-center p-4 modal-backdrop" data-close-target="view-modal">
        <div class="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden relative modal-content flex flex-col max-h-[90vh]" onclick="event.stopPropagation()">
            <div id="view-modal-header" class="h-16 w-full shrink-0"></div>
            <button id="btn-close-view" class="absolute top-4 right-4 w-8 h-8 bg-white/30 rounded-full flex items-center justify-center text-white"><i class="fas fa-times"></i></button>
            <div class="p-6 overflow-y-auto flex-1 space-y-3">
                <h3 id="view-title" class="text-2xl font-extrabold text-gray-800"></h3>
                
                <div id="view-photo-container" class="hidden mb-2"><img id="view-photo" class="w-full object-cover max-h-48 rounded-xl"></div>
                
                <!-- 影片播放器 (智慧內嵌) -->
                <div id="view-video-container" class="hidden mb-2">
                    <iframe id="view-video-iframe" class="w-full aspect-video rounded-xl shadow-sm hidden" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
                    <video id="view-video-element" class="w-full aspect-video rounded-xl bg-black shadow-sm hidden" controls playsinline></video>
                </div>

                <div id="view-file-container" class="hidden mb-2"><a id="view-file-link" href="#" target="_blank" class="w-full py-2 bg-blue-50 text-blue-700 rounded-xl font-bold text-xs flex items-center justify-center gap-2"><i class="fas fa-paperclip"></i> 開啟附件檔案</a></div>
                
                <div id="view-map-container" class="hidden mb-2">
                    <a id="view-map-link" href="#" target="_blank" class="w-full py-2 bg-rose-50 text-rose-700 rounded-xl font-bold text-xs flex items-center justify-center gap-2">
                        <i class="fas fa-map-marked-alt"></i> 地點導航：<span id="view-location-text"></span>
                    </a>
                </div>

                <p id="view-date" class="text-sm font-bold text-gray-600"></p>
                <p id="view-author" class="text-xs text-gray-400"></p>

                <div id="view-checklist-container" class="bg-emerald-50 p-3.5 rounded-2xl border border-emerald-200 space-y-2.5 hidden">
                    <div class="font-bold flex items-center justify-between text-xs text-emerald-800 border-b border-emerald-100 pb-2">
                        <span><i class="fas fa-clipboard-check text-sm mr-1"></i> 裝備與任務清單</span>
                        <span id="view-checklist-progress" class="text-[10px] bg-emerald-200/70 px-2 py-0.5 rounded-full">0/0</span>
                    </div>
                    <div id="view-checklist-items" class="space-y-1.5 text-xs"></div>
                </div>

                <div id="view-poll-container" class="bg-indigo-50 p-3.5 rounded-2xl space-y-2.5 hidden border border-indigo-100">
                    <div class="font-bold text-xs text-indigo-800 flex items-center justify-between">
                        <span><i class="fas fa-poll text-base mr-1"></i> 家族保密投票</span>
                        <span id="poll-summary-badge" class="text-[10px] bg-indigo-200/70 px-2 py-0.5 rounded-full text-indigo-900">投票中</span>
                    </div>
                    <div class="space-y-1">
                        <label class="block text-[11px] font-bold text-indigo-900">1. 選擇您是哪位成員：</label>
                        <select id="poll-voter-select" class="w-full px-3 py-2 rounded-xl bg-white border border-indigo-200 text-xs outline-none"></select>
                    </div>
                    <div id="voted-members-banner" class="bg-indigo-100/60 p-2 rounded-xl text-[11px] text-indigo-900 font-medium">尚無成員投票</div>
                    <div id="view-poll-options" class="space-y-2 text-xs"></div>
                    <button id="btn-finalize-poll" class="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-1.5 mt-2">
                        <i class="fas fa-crown text-amber-300"></i> 查看總結並將最高票拍板定案
                    </button>
                </div>

                <div id="view-expense-container" class="bg-amber-50 p-3.5 rounded-2xl border border-amber-200 space-y-2 hidden text-amber-900">
                    <div class="font-bold flex items-center gap-1.5 text-xs text-amber-800"><i class="fas fa-receipt"></i> 代墊與分帳結算</div>
                    <div id="view-expense-details" class="text-xs space-y-1.5"></div>
                </div>

                <!-- 新增：檢視模式下的營地唯讀配置圖 -->
                <div id="view-campsite-container" class="bg-teal-50 p-3.5 rounded-2xl border border-teal-200 space-y-2.5 hidden mt-2">
                    <div class="font-bold flex items-center justify-between text-xs text-teal-800 border-b border-teal-100 pb-2">
                        <span><i class="fas fa-map-marked-alt text-sm mr-1"></i> 營區搭設配置圖</span>
                    </div>
                    <div id="view-campsite-canvas" class="relative w-full aspect-square bg-teal-100/50 border border-teal-200 rounded overflow-hidden" 
                         style="background-image: linear-gradient(#99f6e4 1px, transparent 1px), linear-gradient(90deg, #99f6e4 1px, transparent 1px); background-size: calc(100%/19) calc(100%/19);">
                        <!-- 唯讀帳篷將渲染於此 -->
                    </div>
                </div>

                <div class="pt-4 flex gap-2">
                    <button id="btn-edit-from-view" class="flex-1 py-2 bg-warm-100 text-warm-700 rounded-xl font-bold text-sm">編輯</button>
                </div>
            </div>
        </div>
    </div>

    <!-- Member Modal (管理成員與備份/匯入後台) -->
    <div id="member-modal" class="fixed inset-0 bg-warm-900/40 backdrop-blur-sm z-[60] hidden flex items-center justify-center p-4 modal-backdrop" data-close-target="member-modal">
        <div class="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] modal-content" onclick="event.stopPropagation()">
            <div class="px-6 py-4 bg-warm-50 border-b flex justify-between items-center">
                <h3 class="text-lg font-bold">管理與資料備份</h3>
                <button id="btn-close-member-modal" class="text-gray-400"><i class="fas fa-times text-xl"></i></button>
            </div>
            
            <div class="p-4 overflow-y-auto flex-1 space-y-4">
                <div>
                    <label class="block text-xs font-bold text-gray-700 mb-1">家族成員管理</label>
                    <div class="flex gap-2 mb-2">
                        <input type="text" id="new-member-name" placeholder="新成員名字..." class="flex-1 px-3 py-2 bg-gray-50 border rounded-xl text-sm outline-none">
                        <button id="btn-add-member" class="px-4 py-2 bg-warm-500 text-white rounded-xl font-bold text-sm"><i class="fas fa-plus"></i></button>
                    </div>
                    <div id="member-list-container" class="space-y-2 max-h-36 overflow-y-auto bg-gray-50 p-2 rounded-xl border"></div>
                </div>

                <hr class="border-gray-200">

                <div class="space-y-2">
                    <label class="block text-xs font-bold text-gray-700">政府行事曆與節日</label>
                    <button id="btn-import-gov-holidays" class="w-full py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm">
                        <i class="fas fa-calendar-alt"></i> 一鍵匯入 2026 政府行事曆與國定假日
                    </button>
                </div>

                <hr class="border-gray-200">

                <div class="space-y-2">
                    <label class="block text-xs font-bold text-gray-700">資料備份與還原 (JSON)</label>
                    <div class="grid grid-cols-2 gap-2">
                        <button id="btn-export-json" class="py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm">
                            <i class="fas fa-download"></i> 匯出備份
                        </button>
                        <label class="py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer">
                            <i class="fas fa-upload"></i> 還原檔案
                            <input type="file" id="input-import-json" accept=".json" class="hidden">
                        </label>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(e => console.log(e)); });
        }
    </script>
    <script type="module" src="./app.js?v=6.9"></script>
</body>
</html>