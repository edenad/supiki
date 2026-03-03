import { state } from './state.js';
import { container } from './dom.js';
import { CONSTANTS } from './constants.js';
import { GridSystem } from './systems/GridSystem.js';

let debugOverlayGroup = null;

export function drawGrid() {
    if (!container) return;

    // Cleanup old grid
    const oldGrid = document.getElementById('debug-grid');
    if (oldGrid) oldGrid.remove();

    // Force fixed logical size for Grid drawing
    const logicalW = 1000;
    const h = 600; // Use fixed 600 for projection height

    // Params (Match global logic)
    const centerX = logicalW / 2;

    const project = (x, z) => {
        const depthRatio = z / CONSTANTS.DEPTH_RANGE;
        const scale = 1.0 - depthRatio * (1.0 - CONSTANTS.MIN_SCALE);
        const vx = centerX + (x - centerX) * scale;
        const vy = h - z; // Foot position
        return { x: vx, y: vy };
    };

    // Draw Checkerboard Tiles
    const step = CONSTANTS.TILE_SIZE || 50;

    // Create SVG Element
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute('id', 'debug-grid');
    svg.setAttribute('width', logicalW);
    svg.setAttribute('height', h);
    svg.setAttribute('viewBox', `0 0 ${logicalW} ${h}`);
    svg.style.position = 'absolute';
    svg.style.top = '0';
    svg.style.left = '0';
    svg.style.pointerEvents = 'none'; // Click-through
    svg.style.zIndex = '0'; // Behind everything

    if (!state.ui.showDebugZones) {
        svg.classList.add('hidden');
    }

    container.appendChild(svg);

    // Create Overlay Group (For dynamic highlighting) - Insert BEFORE grid lines
    debugOverlayGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    debugOverlayGroup.setAttribute('id', 'debug-overlay');
    svg.appendChild(debugOverlayGroup);

    let colorToggle = false;

    // Start from an aligned grid line, even if < MIN_Z
    const startZ = Math.floor(CONSTANTS.MIN_Z / step) * step;

    for (let z = startZ; z < CONSTANTS.DEPTH_RANGE; z += step) {
        let rowColorToggle = colorToggle;
        for (let x = 0; x < logicalW; x += step) {
            // Limit X and Z
            const xNext = Math.min(x + step, logicalW);
            const zNext = Math.min(z + step, CONSTANTS.DEPTH_RANGE);

            // Project Points
            const p1 = project(x, z);           // TL
            const p2 = project(xNext, z);       // TR
            const p3 = project(xNext, zNext);   // BR
            const p4 = project(x, zNext);       // BL

            const tile = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
            const points = `${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y} ${p4.x},${p4.y}`;
            tile.setAttribute('points', points);

            // Checkerboard Colors (Subtle)
            const fill = rowColorToggle ? 'rgba(0, 255, 255, 0.05)' : 'rgba(0, 0, 255, 0.02)';
            tile.setAttribute('fill', fill);

            // Grid Lines
            tile.setAttribute('stroke', 'rgba(0, 50, 255, 0.15)');
            tile.setAttribute('stroke-width', '0.5');

            svg.appendChild(tile);

            rowColorToggle = !rowColorToggle;
        }
        colorToggle = !colorToggle;
    }

    // Border Frame for the entire play area
    const tl = project(0, CONSTANTS.MIN_Z || 20);
    const tr = project(logicalW, CONSTANTS.MIN_Z || 20);
    const br = project(logicalW, CONSTANTS.DEPTH_RANGE || 200);
    const bl = project(0, CONSTANTS.DEPTH_RANGE || 200);

    const frame = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    frame.setAttribute('points', `${tl.x},${tl.y} ${tr.x},${tr.y} ${br.x},${br.y} ${bl.x},${bl.y}`);
    frame.setAttribute('fill', 'none');
    frame.setAttribute('stroke', 'rgba(0, 0, 255, 0.3)');
    frame.setAttribute('stroke-width', '1');
    svg.appendChild(frame);
}

// Function to update dynamic debug overlays (called each frame if debug ON)
export function updateDebugOverlay() {
    // If not showing debug, do nothing (or clear)
    if (!state.ui.showDebugZones) {
        if (debugOverlayGroup) debugOverlayGroup.innerHTML = '';
        return;
    }

    // Attempt to get group if missing (e.g. after redraw)
    if (!debugOverlayGroup) {
        const svg = document.getElementById('debug-grid');
        if (svg) {
            debugOverlayGroup = document.getElementById('debug-overlay');
            if (!debugOverlayGroup) {
                // If drawGrid happened but group lost? Should not happen.
                // Re-create
                debugOverlayGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
                debugOverlayGroup.setAttribute('id', 'debug-overlay');
                svg.prepend(debugOverlayGroup); // Prepend to be at bottom
            }
        } else {
            return; // No grid yet
        }
    }

    // Clear previous
    debugOverlayGroup.innerHTML = '';

    const LOGICAL_WIDTH = 1000;
    const h = 600;
    const centerX = LOGICAL_WIDTH / 2;

    // Duplicated projection logic for performance/independence
    const project = (x, z) => {
        const depthRatio = z / CONSTANTS.DEPTH_RANGE;
        const scale = 1.0 - depthRatio * (1.0 - CONSTANTS.MIN_SCALE);
        const vx = centerX + (x - centerX) * scale;
        const vy = h - z;
        return { x: vx, y: vy };
    };

    // Draw polygon helper
    const drawPoly = (gridCol, gridRow, radiusTiles, color) => {
        // Range: [gridCol - radius, gridCol + radius]
        const STEP = CONSTANTS.TILE_SIZE || 50;

        const minC = gridCol - radiusTiles;
        const maxC = gridCol + radiusTiles; // Inclusive
        const minR = gridRow - radiusTiles;
        const maxR = gridRow + radiusTiles; // Inclusive

        // Convert back to X/Z coordinates
        // minX is minC * STEP
        // maxX is (maxC + 1) * STEP (for the far edge)

        let x1 = minC * STEP;
        let z1 = minR * STEP; // MIN_Z check? Logic allows rendering outside bounds conceptually
        let x2 = (maxC + 1) * STEP;
        let z2 = (maxR + 1) * STEP;

        // Clip to valid area? (Optional, but looks cleaner)
        // x1 = Math.max(0, x1);
        // x2 = Math.min(LOGICAL_WIDTH, x2);
        // z1 = Math.max(CONSTANTS.MIN_Z, z1);
        // z2 = Math.min(CONSTANTS.DEPTH_RANGE, z2);

        // If clipped out of existence
        if (x1 >= x2 || z1 >= z2) return;

        // Project 4 corners
        const p1 = project(x1, z1); // TL
        const p2 = project(x2, z1); // TR
        const p3 = project(x2, z2); // BR
        const p4 = project(x1, z2); // BL

        const poly = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        poly.setAttribute('points', `${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y} ${p4.x},${p4.y}`);
        poly.setAttribute('fill', color);
        poly.setAttribute('stroke', 'none');
        debugOverlayGroup.appendChild(poly);
    };

    state.objects.forEach(obj => {
        // Get Grid Index
        const g = GridSystem.toGridIndex(obj.x, obj.z);
        const STEP = CONSTANTS.TILE_SIZE || 50;

        // 1. Boundary (Radius) -> Yellow
        const rad = obj.radius || 30;
        const radTiles = Math.floor(rad / STEP);
        drawPoly(g.col, g.row, radTiles, 'rgba(250, 204, 21, 0.4)'); // Yellow

        // 2. Detection (Interact) -> Red
        const detRad = obj.detectionRadius !== undefined ? obj.detectionRadius : rad;
        const detTiles = Math.floor(detRad / STEP);
        drawPoly(g.col, g.row, detTiles, 'rgba(239, 68, 68, 0.5)'); // Red
    });
}
