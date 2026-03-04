import { state } from '../state.js';
import { CONSTANTS, STATES } from '../constants.js';
import { createMateElement } from './MateVisuals.js';
import { updateCountDisplay } from '../ui.js';
import { container } from '../dom.js';
import { getSnappedZ } from '../utils.js';

function makeMateData(source, type, containerWidth) {
    const startX = Math.random() * containerWidth;
    const startZ = getSnappedZ(CONSTANTS.MIN_Z + Math.random() * (CONSTANTS.DEPTH_RANGE - CONSTANTS.MIN_Z));
    const startH = 200 + Math.random() * 200;
    const safeId = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const isChild = Math.random() < 0.2;
    const baseSize = isChild ? CONSTANTS.DEFAULT_SIZE * 0.6 : CONSTANTS.DEFAULT_SIZE;
    return {
        id: safeId, x: startX, z: startZ, h: startH,
        vx: (Math.random() - 0.5) * 5, vz: 0, vh: 0,
        size: baseSize, isChild, type, source,
        state: STATES.JUMP, stateTimer: 0, actionTimer: 0,
        direction: Math.random() > 0.5 ? 1 : -1,
        scaleX: 1, scaleY: 1, rotation: 0, skewX: 0, offsetY: 0,
        walkType: 'straight', edgeAction: 'look_center', digAngle: 45,
        animPhase: Math.random() * 100,
        interactionTargetId: null, screenX: 0, screenY: 0, perspectiveScale: 1,
        emotion: Math.floor(Math.random() * 4),
        courage: isChild ? Math.floor(Math.random() * 3) + 1 : Math.floor(Math.random() * 5) + 1,
        wisdom: isChild ? Math.floor(Math.random() * 3) + 1 : Math.floor(Math.random() * 5) + 1,
        friendliness: 0, shakeStress: 0, eatCooldown: 0, groupId: null,
        bodyTemp: 100  // Game mode temperature gauge
    };
}

export function addMate(source, type = 'url') {
    const containerWidth = container.clientWidth || window.innerWidth;
    for (let i = 0; i < 3; i++) {
        const newMate = makeMateData(source, type, containerWidth);
        newMate.id = `${Date.now()}-${i}-${Math.floor(Math.random() * 1000)}`;
        state.mates.push(newMate);
        container.appendChild(createMateElement(newMate));
    }
    updateCountDisplay();
}

export function spawnSingleMate() {
    const containerWidth = container.clientWidth || window.innerWidth;
    const newMate = makeMateData('', 'supiki', containerWidth);
    state.mates.push(newMate);
    container.appendChild(createMateElement(newMate));
    updateCountDisplay();
}

export function removeMate(id) {
    state.mates = state.mates.filter(m => m.id !== id);
    const el = document.getElementById(`mate-${id}`);
    if (el) el.remove();
    updateCountDisplay();
}

export function clearAllMates() {
    state.mates.forEach(m => {
        const el = document.getElementById(`mate-${m.id}`);
        if (el) el.remove();
    });
    state.mates = [];
    updateCountDisplay();
}
