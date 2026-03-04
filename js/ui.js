import { state } from './state.js';
import { uiLayer } from './dom.js';

export function showMateInfo(id) {
    state.ui.selectedMateId = id;

    const mate = state.mates.find(m => m.id === id);
    if (!mate) return;

    const panel = document.getElementById('inspector-panel');
    panel.classList.remove('hidden');

    document.getElementById('insp-id').innerText = '#' + mate.id;
    updateInspector(); // Update values immediately

    // Delete handler
    const delBtn = document.getElementById('insp-delete-btn');
    delBtn.onclick = () => {
        const idx = state.mates.findIndex(m => m.id === id);
        if (idx !== -1) {
            const el = document.getElementById(`mate-${id}`);
            if (el) el.remove();
            state.mates.splice(idx, 1);
            updateCountDisplay();
            panel.classList.add('hidden');
        }
    };
}

export function toggleDebugZones() {
    state.ui.showDebugZones = !state.ui.showDebugZones;
    const zones = document.querySelectorAll('.debug-zone');
    console.log(`[Debug] Toggling zones: ${state.ui.showDebugZones}, count: ${zones.length}`);
    zones.forEach(el => {
        if (state.ui.showDebugZones) el.classList.remove('hidden');
        else el.classList.add('hidden');
    });

    // SVG Grid
    const grid = document.getElementById('debug-grid');
    if (grid) {
        if (state.ui.showDebugZones) {
            grid.style.display = 'block';
            grid.classList.remove('hidden');
        } else {
            grid.style.display = 'none';
            grid.classList.add('hidden');
        }
    }
}
window.toggleDebugZones = toggleDebugZones;

export function toggleControls() {
    state.ui.showControls = !state.ui.showControls;
    const topBar = document.getElementById('top-bar');
    const restoreBtn = document.getElementById('restore-btn');

    if (state.ui.showControls) {
        // Show Top Bar
        topBar.style.transform = 'translateY(0)';
        restoreBtn.classList.add('hidden');
    } else {
        // Hide Top Bar
        topBar.style.transform = 'translateY(-100%)';
        restoreBtn.classList.remove('hidden');
    }
}

export function updateCountDisplay() {
    const el = document.getElementById('mate-count');
    if (el) el.textContent = `Count: ${state.mates.length}`;
}

export function updateInspector() {
    if (state.ui.selectedMateId && !document.getElementById('inspector-panel').classList.contains('hidden')) {
        const m = state.mates.find(x => x.id === state.ui.selectedMateId);
        if (m) {
            document.getElementById('insp-emotion').innerText = m.emotion;
            document.getElementById('insp-courage').innerText = m.courage;
            document.getElementById('insp-wisdom').innerText = m.wisdom;
            document.getElementById('insp-friendliness').innerText = m.friendliness.toFixed(1);
            document.getElementById('insp-state').innerText = m.state;
        }
    }
}

export function toggleGameMode() {
    state.gameMode = !state.gameMode;
    const normalBg = document.getElementById('bg-normal');
    const gameBg = document.getElementById('bg-gamemode');
    const btn = document.getElementById('game-mode-btn');

    if (state.gameMode) {
        normalBg?.classList.add('hidden');
        gameBg?.classList.remove('hidden');
        if (btn) { btn.textContent = '🌿'; btn.title = '通常モードに戻る'; }
        if (window.startGame) window.startGame();
    } else {
        normalBg?.classList.remove('hidden');
        gameBg?.classList.add('hidden');
        if (btn) { btn.textContent = '🎮'; btn.title = 'ゲームモード'; }
        if (window.stopGame) window.stopGame();
    }
}
window.toggleGameMode = toggleGameMode;
