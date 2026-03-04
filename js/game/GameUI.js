import { state } from '../state.js';
import { container } from '../dom.js';

const gauges = new Map(); // mateId -> { wrapper, fill }

export function initGameUI() {
    hideGameUI();
    const overlay = document.getElementById('gameover-overlay');
    if (overlay) overlay.classList.add('hidden');
}

export function updateGameUI() {
    state.mates.forEach(mate => {
        let els = gauges.get(mate.id);

        if (!els) {
            const wrapper = document.createElement('div');
            wrapper.style.cssText = 'position:absolute;pointer-events:none;display:flex;flex-direction:column;align-items:center;transform:translateX(-50%);z-index:999;';

            const track = document.createElement('div');
            track.style.cssText = 'width:44px;height:7px;background:rgba(0,0,0,0.35);border-radius:4px;overflow:hidden;border:1px solid rgba(255,255,255,0.25);';

            const fill = document.createElement('div');
            fill.style.cssText = 'height:100%;width:100%;border-radius:4px;transition:width 0.15s,background 0.3s;';
            track.appendChild(fill);
            wrapper.appendChild(track);
            if (container) container.appendChild(wrapper);
            els = { wrapper, fill };
            gauges.set(mate.id, els);
        }

        const pct = Math.max(0, Math.min(100, mate.bodyTemp ?? 100));
        const posX = mate.screenX;
        const posY = mate.screenY - (mate.size || 80) * 0.7;
        els.wrapper.style.left = `${posX}px`;
        els.wrapper.style.top = `${posY}px`;

        let color;
        if (mate.gameFrozen) color = '#60a5fa';  // blue - frozen
        else if (pct > 66) color = '#22c55e';  // green - warm
        else if (pct > 33) color = '#f59e0b';  // amber - cool
        else color = '#ef4444';  // red - cold

        els.fill.style.width = `${pct}%`;
        els.fill.style.background = color;
    });

    // Remove gauges for deleted mates
    for (const [id, els] of gauges.entries()) {
        if (!state.mates.find(m => m.id === id)) {
            els.wrapper.remove();
            gauges.delete(id);
        }
    }
}

export function showGameOver(seconds) {
    for (const [, els] of gauges.entries()) els.wrapper.remove();
    gauges.clear();

    const overlay = document.getElementById('gameover-overlay');
    if (!overlay) return;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    const timeEl = document.getElementById('gameover-time');
    if (timeEl) timeEl.textContent = `${m}:${String(s).padStart(2, '0')}`;
    overlay.classList.remove('hidden');
}

export function hideGameUI() {
    for (const [, els] of gauges.entries()) { if (els.wrapper.parentNode) els.wrapper.remove(); }
    gauges.clear();
    const overlay = document.getElementById('gameover-overlay');
    if (overlay) overlay.classList.add('hidden');
}
