import { state } from '../state.js';
import { STATES } from '../constants.js';
import { spawnSingleMate, clearAllMates } from '../mate/MateLogic.js';
import { initGameUI, updateGameUI, showGameOver, hideGameUI } from './GameUI.js';

const CFG = {
    DECAY: 0.025,          // bodyTemp loss per frame (~67s to freeze)
    MOUSE_GAIN: 1.5,       // bodyTemp gain when mouse-rubbing
    SPAWN_FRAMES: 7200,    // 120s at 60fps
    MAX_MATES: 20,
    INITIAL_MATES: 4,
    MOUSE_RADIUS: 90,      // px in container-local coords
    MOUSE_MIN_SPEED: 4,    // px/frame
    DROP_RADIUS: 150,      // px to trigger thaw_friend
    THAW_THRESHOLD: 25,    // bodyTemp to unfreeze at
};

let gameActive = false;
let spawnTimer = 0;
let frameCount = 0;

function onMateDropped(e) {
    if (!gameActive) return;
    const mate = state.mates.find(m => m.id === e.detail.mateId);
    if (!mate) return;

    const frozenNearby = state.mates.find(m => {
        if (!m.gameFrozen || m.id === mate.id) return false;
        return Math.hypot(m.x - mate.x, m.z - mate.z) < CFG.DROP_RADIUS;
    });

    if (frozenNearby) {
        mate.state = STATES.INTERACT;
        mate.reactionTargetId = frozenNearby.id;
        mate.reactionType = 'thaw_friend';
        mate.actionTimer = 0;
        mate.vx = 0; mate.vz = 0;
    }
}

export function startGame() {
    clearAllMates();
    state.objects.forEach(obj => { if (obj.element?.parentNode) obj.element.parentNode.removeChild(obj.element); });
    state.objects = [];
    gameActive = true;
    spawnTimer = 0;
    frameCount = 0;

    for (let i = 0; i < CFG.INITIAL_MATES; i++) spawnSingleMate();

    initGameUI();
    window.addEventListener('mate-dropped', onMateDropped);
}

export function stopGame() {
    gameActive = false;
    hideGameUI();
    window.removeEventListener('mate-dropped', onMateDropped);
}

export function isGameActive() { return gameActive; }

export function updateGame() {
    if (!gameActive) return;
    frameCount++;
    spawnTimer++;

    if (spawnTimer >= CFG.SPAWN_FRAMES && state.mates.length < CFG.MAX_MATES) {
        spawnSingleMate();
        spawnTimer = 0;
    }

    const mouseSpeed = Math.hypot(state.mouse.vx || 0, state.mouse.vy || 0);
    const scale = state.params.viewScale || 1;
    const localMX = (state.mouse.x - (state.params.viewOffsetX || 0)) / scale;
    const localMY = (state.mouse.y - (state.params.viewOffsetY || 0)) / scale;

    state.mates.forEach(mate => {
        if (mate.bodyTemp === undefined) mate.bodyTemp = 100;
        if (mate.id === state.drag.id && state.drag.isDragging) return;

        if (!mate.gameFrozen) {
            mate.bodyTemp = Math.max(0, mate.bodyTemp - CFG.DECAY);
            if (mate.bodyTemp <= 0) {
                mate.isFrozen = true;
                mate.frozenCooldown = true;
                mate.gameFrozen = true;
                mate.interactionCooldown = 999999;
                mate.reactionType = null;
                mate.reactionTargetId = null;
                mate.targetObjectId = null;
            }
        } else {
            // Mouse rubbing thaws
            const d = Math.hypot(mate.screenX - localMX, mate.screenY - localMY);
            if (d < CFG.MOUSE_RADIUS && mouseSpeed >= CFG.MOUSE_MIN_SPEED) {
                mate.bodyTemp = Math.min(100, mate.bodyTemp + CFG.MOUSE_GAIN);
            }
            if (mate.bodyTemp >= CFG.THAW_THRESHOLD) {
                mate.isFrozen = false;
                mate.frozenCooldown = false;
                mate.gameFrozen = false;
                mate.interactionCooldown = 0;
                mate.state = STATES.IDLE;
                mate.stateTimer = 60;
                mate.reactionType = null;
                mate.reactionTargetId = null;
            }
        }
    });

    // Game over: only 1 or fewer non-frozen mates
    const unfrozen = state.mates.filter(m => !m.gameFrozen);
    if (state.mates.length > 0 && unfrozen.length <= 1) {
        gameActive = false;
        window.removeEventListener('mate-dropped', onMateDropped);
        showGameOver(Math.floor(frameCount / 60));
        return;
    }

    updateGameUI();
}
