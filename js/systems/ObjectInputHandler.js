import { state } from '../state.js';
import { container } from '../dom.js';
import { CONSTANTS } from '../constants.js';
import { GridSystem } from './GridSystem.js';

export const ObjectInputHandler = {
    startDrag: function (e, id) {
        if (e.cancelable) e.preventDefault();
        const clientX = e.clientX || e.touches?.[0]?.clientX;
        const clientY = e.clientY || e.touches?.[0]?.clientY;

        if (!clientX || !container) return;

        const obj = state.objects.find(o => o.id === id);
        if (!obj) return;

        state.drag.isDragging = true;
        state.drag.id = id;
        state.drag.type = 'object';
        state.drag.lastScreenX = clientX;
        state.drag.lastScreenY = clientY;
        state.drag.velocityScreenX = 0;
        state.drag.velocityScreenY = 0;

        // Calculate Drag Offset relative to the OBJECT PIVOT (Bottom-Center)
        // The pivot is the only point consistent across scales in this projection.
        const rect = container.getBoundingClientRect();
        const scaleFactor = state.params.viewScale || 1;

        // Map Screen Mouse to Logical Mouse
        const relMouseX = (clientX - rect.left) / scaleFactor;
        const relMouseY = (clientY - rect.top) / scaleFactor;

        const containerWidth = container.clientWidth; // Should be LOGICAL_WIDTH (1000)
        const containerHeight = container.clientHeight; // Should be LOGICAL_HEIGHT (600)
        const centerX = containerWidth / 2;

        // Visualize Pivot Position on Screen
        // PivotX = CenterX + (WorldX - CenterX) * Scale
        // PivotY = ContainerHeight - WorldZ

        const depthRatio = obj.z / CONSTANTS.DEPTH_RANGE;
        const scale = 1.0 - depthRatio * (1.0 - CONSTANTS.MIN_SCALE);
        const pivotX = centerX + (obj.x - centerX) * scale;
        const pivotY = containerHeight - obj.z;

        // Offset from Pivot
        state.drag.offsetX = pivotX - relMouseX;
        state.drag.offsetY = pivotY - relMouseY;
    },

    handleDrag: function (screenX, screenY) {
        if (!container) return;
        const obj = state.objects.find(o => o.id === state.drag.id);
        if (!obj) return;

        const rect = container.getBoundingClientRect();
        // Use Logical Properties for Math
        const containerWidth = container.clientWidth;
        const containerHeight = container.clientHeight;
        const centerX = containerWidth / 2;

        const scaleFactor = state.params.viewScale || 1;

        // We need to map clientX/Y to Logical Space.
        const relMouseX = (screenX - rect.left) / scaleFactor;
        const relMouseY = (screenY - rect.top) / scaleFactor;

        // 1. Calculate Target Visual Position using Offset
        // Pivot tracking:
        const targetPivotX = relMouseX + (state.drag.offsetX || 0);
        const targetPivotY = relMouseY + (state.drag.offsetY || 0);

        // 1. Calculate World Z from Pivot Y
        // PivotY = ContainerHeight - Z  =>  Z = ContainerHeight - PivotY
        let newZ = containerHeight - targetPivotY;
        newZ = Math.max(CONSTANTS.MIN_Z, Math.min(CONSTANTS.DEPTH_RANGE, newZ));

        // 2. Calculate Scale at new Z
        const depthRatio = newZ / CONSTANTS.DEPTH_RANGE;
        const scale = 1.0 - depthRatio * (1.0 - CONSTANTS.MIN_SCALE);

        // 3. Calculate World X from Pivot X
        // PivotX = CenterX + (WorldX - CenterX) * Scale
        // WorldX = CenterX + (PivotX - CenterX) / Scale
        let newX = centerX + (targetPivotX - centerX) / scale;
        newX = Math.max(0, Math.min(containerWidth, newX));

        // SNAP TO GRID (Real-time)
        const snapped = GridSystem.snapPosition(newX, newZ);

        // Update Object Logic (Snapped)
        obj.x = snapped.x;
        obj.z = Math.max(CONSTANTS.MIN_Z, Math.min(CONSTANTS.DEPTH_RANGE, snapped.z));

        // Update Object Visuals (Smooth)
        obj.dragVisualX = newX;
        obj.dragVisualZ = newZ;

        // Force visual update
        if (obj.update) obj.update();
    },

    endDrag: function () {
        const obj = state.objects.find(o => o.id === state.drag.id);
        if (obj) {
            // Final snap (logical x/z is already snapped in handleDrag, but ensure visual matches)
            // We just need to clear the dragVisual props or let update() handle it.
            // By setting x/z again we ensure consistency.

            // Allow checking bounds one last time
            if (container) {
                const w = container.clientWidth;
                const step = GridSystem.TILE_SIZE;
                obj.x = Math.max(step / 2, Math.min(w - step / 2, obj.x));
            }

            // Clear visual override
            delete obj.dragVisualX;
            delete obj.dragVisualZ;

            if (obj.update) obj.update();
        }

        state.drag.isDragging = false;
        state.drag.id = null;
        state.drag.type = null;
    }
};
