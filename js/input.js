import { state } from './state.js';
import { getSnappedZ } from './utils.js';
import { CONSTANTS, STATES } from './constants.js';
import { container } from './dom.js';
import { ObjectInputHandler } from './systems/ObjectInputHandler.js';

export function handleMateMouseDown(e, id) {
    // なでるモードのときは掴みを無効化
    if ((state.cursor?.mode || 'grab') === 'pet') return;

    if (e.cancelable) e.preventDefault(); // Prevent text selection etc
    const clientX = e.clientX || e.touches?.[0]?.clientX;
    const clientY = e.clientY || e.touches?.[0]?.clientY;

    if (!clientX) return;

    // Correct Z snap
    const mate = state.mates.find(m => m.id === id);
    if (mate) {
        mate.z = getSnappedZ(mate.z);

        // Instantly thaw frozen mates when grabbed (non-game mode only)
        if (!state.gameMode && (mate.isFrozen || mate.frozenCooldown)) {
            mate.isFrozen = false;
            mate.frozenCooldown = false;
            mate.interactionCooldown = 0;
            mate.state = STATES.IDLE;
            mate.stateTimer = 30;
        }
    }

    state.drag.isDragging = true;
    state.drag.id = id;
    state.drag.lastScreenX = clientX;
    state.drag.lastScreenY = clientY;
    state.drag.velocityScreenX = 0;
    state.drag.velocityScreenY = 0;
}


export function handleGlobalMouseMove(e) {
    const clientX = e.clientX || e.touches?.[0]?.clientX;
    const clientY = e.clientY || e.touches?.[0]?.clientY;

    // Update generic mouse pos
    if (clientX) {
        state.mouse.vx = clientX - state.mouse.x;
        state.mouse.vy = clientY - state.mouse.y;
        state.mouse.x = clientX;
        state.mouse.y = clientY;
    }

    if (!state.drag.isDragging || !clientX) return;

    const dx = clientX - state.drag.lastScreenX;
    const dy = clientY - state.drag.lastScreenY;

    state.drag.lastScreenX = clientX;
    state.drag.lastScreenY = clientY;
    state.drag.velocityScreenX = dx;
    state.drag.velocityScreenY = dy;

    // Delegate to ObjectInputHandler if dragging object
    if (state.drag.type === 'object') {
        ObjectInputHandler.handleDrag(clientX, clientY);
        return;
    }

    // Mate Dragging Logic
    const mate = state.mates.find(m => m.id === state.drag.id);
    if (mate) {
        // Adjust dx/dy by scale
        const scale = state.params.viewScale || 1;
        mate.screenX += dx / scale;
        mate.screenY += dy / scale;
    }
}

export function handleObjectMouseDown(e, id) {
    ObjectInputHandler.startDrag(e, id);
}

export function handleGlobalMouseUp(e) {
    if (!state.drag.isDragging) return;

    if (state.drag.type === 'object') {
        ObjectInputHandler.endDrag();
        return;
    }

    const mate = state.mates.find(m => m.id === state.drag.id);
    if (!mate || !container) {
        state.drag.isDragging = false;
        state.drag.id = null;
        return;
    }

    const containerHeight = container.clientHeight;
    const containerWidth = container.clientWidth;
    const centerX = containerWidth / 2;

    const visualY = mate.screenY;
    const visualX = mate.screenX;

    // Calculate Physical Position from Visual
    let fixedZ = mate.z;
    // visualY = containerHeight - size - z - h (if jumping?)
    // When dragging, we are moving visualY directly.
    // We assume h=0 during drag placement logic (drop to ground).
    // So newZ = containerHeight - size - visualY.
    let calculatedZ = containerHeight - mate.size - visualY;

    // Clamp Z to valid range
    fixedZ = getSnappedZ(Math.max(CONSTANTS.MIN_Z, Math.min(CONSTANTS.DEPTH_RANGE, calculatedZ)));

    // Logic:
    // `newH = containerHeight - mate.size - fixedZ - visualY;`
    let newH = containerHeight - mate.size - fixedZ - visualY;
    newH = Math.max(0, newH);

    // Recalculate X based on Z scale
    const depthRatio = fixedZ / CONSTANTS.DEPTH_RANGE;
    const scale = 1.0 - depthRatio * (1.0 - CONSTANTS.MIN_SCALE);
    const newX = centerX + (visualX - centerX) / scale;

    mate.x = Math.max(0, Math.min(containerWidth, newX));
    mate.z = fixedZ;
    mate.h = newH;

    mate.vx = state.drag.velocityScreenX;
    mate.vh = -state.drag.velocityScreenY;

    mate.scaleX = 1;
    mate.scaleY = 1;

    // 高く飛ばしたとき好感度DOWN
    if (mate.vh > 8) {
        mate.friendliness = Math.max(-10, (mate.friendliness || 0) - 1);
    }

    if (mate.h <= 0 && Math.abs(mate.vh) < 2 && Math.abs(mate.vx) < 2) {
        mate.state = STATES.IDLE;
        mate.stateTimer = 60;
        mate.vx = 0; mate.vh = 0; mate.vz = 0;
    } else {
        mate.state = STATES.JUMP;
        mate.stateTimer = 0;
    }

    // Game mode: notify drop near frozen mates
    if (state.gameMode && mate.h <= 0) {
        window.dispatchEvent(new CustomEvent('mate-dropped', { detail: { mateId: mate.id } }));
    }

    state.drag.isDragging = false;
    state.drag.id = null;
}
