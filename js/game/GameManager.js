import { state } from '../state.js';
import { STATES } from '../constants.js';
import { spawnSingleMate, clearAllMates } from '../mate/MateLogic.js';
import { container } from '../dom.js';
import { createMateElement } from '../mate/MateVisuals.js';
import { initGameUI, updateGameUI, showGameOver, hideGameUI } from './GameUI.js';
import { updateCountDisplay } from '../ui.js';

const CFG = {
    DECAY_BASE: 0.01515,   // Base decay per frame
    MOUSE_GAIN: 0.25,      // ×2の仕事量: 0.5→0.25 (こすり続け200fで+50)
    SPAWN_FRAMES: 7200,    // 120s at 60fps
    MAX_MATES: 20,
    INITIAL_MATES: 4,
    MOUSE_RADIUS: 120,     // px (container-local)
    MOUSE_MIN_SPEED: 2,    // px/frame
    DROP_RADIUS: 150,      // px to trigger thaw_friend
    THAW_THRESHOLD: 100,   // bodyTemp must reach this to unfreeze
};

let gameActive = false;
let spawnTimer = 0;
let frameCount = 0;

// -------------------------------------------------------
// 通常モードの状態をスナップショット保存/復元
// -------------------------------------------------------
function saveNormalState() {
    // DOM要素ごと parent から切り離して保管
    state.savedNormalState = {
        mates: state.mates.slice(),           // shallow copy of array
        objects: state.objects.slice(),
    };
}

function restoreNormalState() {
    if (!state.savedNormalState) return;

    // ゲームモードのDOMを削除
    state.mates.forEach(m => {
        const el = document.getElementById(`mate-${m.id}`);
        if (el) el.remove();
    });
    state.objects.forEach(obj => {
        if (obj.element?.parentNode) obj.element.parentNode.removeChild(obj.element);
    });

    // 通常モードのスピキを復元
    state.mates = state.savedNormalState.mates;
    state.objects = state.savedNormalState.objects;
    state.savedNormalState = null;

    // DOM再アタッチ (スピキ)
    state.mates.forEach(m => {
        const existing = document.getElementById(`mate-${m.id}`);
        if (!existing) {
            container.appendChild(createMateElement(m));
        }
    });
    // オブジェクトのDOMも再アタッチ
    state.objects.forEach(obj => {
        if (obj.element && !obj.element.parentNode) {
            container.appendChild(obj.element);
        }
    });

    updateCountDisplay();
}

// -------------------------------------------------------
// ドロップ時のこすり開始 (100% 確率で発動)
// -------------------------------------------------------
function onMateDropped(e) {
    if (!gameActive) return;
    const mate = state.mates.find(m => m.id === e.detail.mateId);
    if (!mate || mate.gameFrozen) return;

    const frozenNearby = state.mates.find(m => {
        if (!m.gameFrozen || m.id === mate.id) return false;
        return Math.hypot(m.x - mate.x, m.z - mate.z) < CFG.DROP_RADIUS;
    });

    if (frozenNearby) {
        // クールダウンに関わらず必ずこすりに行く (100%)
        mate.interactionCooldown = 0;
        mate.state = STATES.INTERACT;
        mate.reactionTargetId = frozenNearby.id;
        mate.reactionType = 'thaw_friend';
        mate.actionTimer = 0;
        mate.vx = 0; mate.vz = 0;
    }
}

// -------------------------------------------------------
// Public API
// -------------------------------------------------------
export function startGame() {
    // 通常モードの状態を退避
    saveNormalState();

    // ゲームモード用ステージを初期化
    clearAllMates();
    state.objects.forEach(obj => {
        if (obj.element?.parentNode) obj.element.parentNode.removeChild(obj.element);
    });
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

    // 通常モードの状態を復元
    restoreNormalState();
}

export function isGameActive() { return gameActive; }

export function updateGame() {
    if (!gameActive) return;
    frameCount++;
    spawnTimer++;

    // スピキ増殖 (120秒ごと)
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
        // 個体ごとのランダム減少速度 (1倍〜10倍)
        if (mate.decayMultiplier === undefined) {
            mate.decayMultiplier = 1.0 + Math.random() * 9.0;
        }

        // ドラッグ中は温度変化なし
        if (mate.id === state.drag.id && state.drag.isDragging) return;

        if (!mate.gameFrozen) {
            mate.bodyTemp = Math.max(0, mate.bodyTemp - (CFG.DECAY_BASE * mate.decayMultiplier));
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
            // マウスでこすると回復 (仕事量2倍: MOUSE_GAIN=0.25)
            const d = Math.hypot(mate.screenX - localMX, mate.screenY - localMY);
            if (d < CFG.MOUSE_RADIUS && mouseSpeed >= CFG.MOUSE_MIN_SPEED) {
                mate.bodyTemp = Math.min(100, mate.bodyTemp + CFG.MOUSE_GAIN);
            }
            // 完全回復で解凍
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

    // ゲームオーバー：全員が凍ったら終了
    const unfrozen = state.mates.filter(m => !m.gameFrozen);
    if (state.mates.length > 0 && unfrozen.length === 0) {
        gameActive = false;
        window.removeEventListener('mate-dropped', onMateDropped);
        showGameOver(Math.floor(frameCount / 60));
        return;
    }

    updateGameUI();
}
