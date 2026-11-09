// modules/effects.js

export function initFunAnimations() {
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