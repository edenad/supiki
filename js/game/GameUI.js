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
        // スピキのDOM要素を取得
        const mateEl = document.getElementById(`mate-${mate.id}`);
        if (!mateEl) return;

        let els = gauges.get(mate.id);

        if (!els) {
            const wrapper = document.createElement('div');
            // position: absolute, parent is mateEl (which is already absolutely positioned)
            wrapper.style.cssText = [
                'position:absolute',
                'left:50%',
                'transform:translateX(-50%)',
                'pointer-events:none',
                'z-index:9999',
                'bottom:88%',  // 頭上あたり
            ].join(';');

            const track = document.createElement('div');
            track.style.cssText = 'width:44px;height:7px;background:rgba(0,0,0,0.45);border-radius:4px;overflow:hidden;border:1px solid rgba(255,255,255,0.3);';

            const fill = document.createElement('div');
            fill.style.cssText = 'height:100%;width:100%;border-radius:4px;transition:width 0.12s,background 0.25s;';
            track.appendChild(fill);
            wrapper.appendChild(track);
            mateEl.appendChild(wrapper);
            els = { wrapper, fill, mateId: mate.id };
            gauges.set(mate.id, els);
        }

        // DOM親が変わっていたら再アタッチ
        if (els.wrapper.parentElement !== mateEl) {
            mateEl.appendChild(els.wrapper);
        }

        const pct = Math.max(0, Math.min(100, mate.bodyTemp ?? 100));

        let color;
        if (mate.gameFrozen) color = '#93c5fd'; // blue frozen
        else if (pct > 66) color = '#22c55e'; // green
        else if (pct > 33) color = '#f59e0b'; // amber
        else color = '#ef4444'; // red

        els.fill.style.width = `${pct}%`;
        els.fill.style.background = color;
    });

    // 削除済みmateのゲージを除去
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
