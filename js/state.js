
export const state = {
    mates: [],
    physics: {
        gravity: 0.3,
        friction: 0.95,
        bounce: 0.4
    },
    mouse: { x: 0, y: 0, vx: 0, vy: 0 },
    drag: {
        isDragging: false,
        id: null,
        offsetX: 0,
        offsetY: 0,
        lastScreenX: 0,
        lastScreenY: 0,
        velocityScreenX: 0,
        velocityScreenY: 0
    },
    ui: {
        showControls: true,
        selectedMateId: null,
        showDebugZones: false
    },
    time: 0,
    objects: [], // Array of { id, type, x, z, amount, maxAmount }
    groups: [],  // Array of Group instances
    params: {
        viewScale: 1,
        viewOffsetX: 0,
        viewOffsetY: 0
    },
    gameMode: false, // true = game mode active
    // Normal mode snapshot (restored when leaving game mode)
    savedNormalState: null,
    cursor: { mode: 'grab' } // 'grab' or 'pet'
};
