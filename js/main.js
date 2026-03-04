import { state } from './state.js';
import { container } from './dom.js';
import { addMate, clearAllMates, removeMate } from './mate/MateLogic.js';
import { updateMate } from './mate/MateUpdate.js';
import { spawnObject } from './objects/ObjectManager.js';
import { ITEM_CONFIGS } from './configs/ItemConfigs.js';
state.configs = ITEM_CONFIGS;
import { toggleControls, updateInspector, showMateInfo } from './ui.js';
import { handleGlobalMouseMove, handleGlobalMouseUp } from './input.js';
import { drawGrid, updateDebugOverlay } from './debug.js';

import { updateGroups } from './group/GroupManager.js';
import { updateGame, startGame, stopGame } from './game/GameManager.js';

// Expose to window for HTML handlers and console debugging
window.addMate = addMate;
window.clearAllMates = clearAllMates;
window.toggleControls = toggleControls;
window.removeMate = removeMate;
window.showMateInfo = showMateInfo;
window.spawnObject = spawnObject;
window.state = state;
window.startGame = startGame;
window.stopGame = stopGame;

// Initialize Listeners
document.addEventListener('mousemove', handleGlobalMouseMove);
document.addEventListener('touchmove', handleGlobalMouseMove, { passive: false });
document.addEventListener('mouseup', handleGlobalMouseUp);
document.addEventListener('touchend', handleGlobalMouseUp);

// Disable right-click context menu globally
document.addEventListener('contextmenu', (e) => e.preventDefault());

const gravInput = document.getElementById('input-gravity');
if (gravInput) gravInput.addEventListener('input', (e) => state.physics.gravity = parseFloat(e.target.value));

const bounceInput = document.getElementById('input-bounce');
if (bounceInput) bounceInput.addEventListener('input', (e) => state.physics.bounce = parseFloat(e.target.value));

function animate() {
    if (!container) return;

    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    state.time += 0.05;
    const t = state.time;

    // Update Groups (Decisions)
    updateGroups();

    state.mates.forEach(mate => {
        updateMate(mate, containerWidth, containerHeight, t);
    });

    state.objects.forEach(obj => {
        if (obj.tick) obj.tick();
        else if (obj.update) obj.update(); // Fallback for Pond/other subclasses
    });

    updateInspector();
    if (state.ui.showDebugZones) updateDebugOverlay();

    updateGame();

    requestAnimationFrame(animate);
}

// Fixed Logical Resolution
const LOGICAL_WIDTH = 1000; // 20 tiles * 50
const LOGICAL_HEIGHT = 600; // Arbitrary height to fit ground + sky

function handleResize() {
    if (!container) return;

    const winW = window.innerWidth;
    const winH = window.innerHeight;

    // Scale to Fit (Contain)
    const scaleW = winW / LOGICAL_WIDTH;
    const scaleH = winH / LOGICAL_HEIGHT;
    const scale = Math.min(scaleW, scaleH); // Ensure it fits both dimensions

    // Calculate Centering Offsets
    const visualW = LOGICAL_WIDTH * scale;
    const visualH = LOGICAL_HEIGHT * scale;
    const offsetX = (winW - visualW) / 2;
    const offsetY = (winH - visualH) / 2;

    // Apply Styles
    container.style.width = `${LOGICAL_WIDTH}px`;
    container.style.height = `${LOGICAL_HEIGHT}px`;
    container.style.transformOrigin = 'top left';
    container.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;

    // Update State for Input Mapping
    state.params.viewScale = scale;

    // We also need to store the offsets for Input Mapping!
    state.params.viewOffsetX = offsetX;
    state.params.viewOffsetY = offsetY;

    // Redraw Grid
    drawGrid();
}

window.addEventListener('resize', handleResize);
// Initial Call
handleResize();

// Initial Spawn
spawnObject(ITEM_CONFIGS.FOOD, 225, 125);
spawnObject(ITEM_CONFIGS.SPIKEY, 825, 125);
spawnObject(ITEM_CONFIGS.POND, 525, 125); // Center Pond

requestAnimationFrame(animate);
