import { CONSTANTS, STATES } from '../constants.js';
import { state } from '../state.js';
import { container } from '../dom.js';
import { handleObjectMouseDown } from '../input.js';
import { GridSystem } from '../systems/GridSystem.js';
import { ObjectVisualizer, ANCHOR_MODES } from './ObjectVisualizer.js';

export class InteractableObject {
    constructor(id, x, z, config) {
        this.id = id;
        // Snap initial position to grid
        const snapped = GridSystem.snapPosition(x, z);
        this.x = snapped.x;
        this.z = snapped.z;

        // Grid-based sizing (Default to 1x1 if not specified)
        this.widthTiles = config.width || 1;
        this.depthTiles = config.depth || 1;

        // Pixel dimensions based on TILE_SIZE (50)
        this.width = this.widthTiles * CONSTANTS.TILE_SIZE;
        this.depth = this.depthTiles * CONSTANTS.TILE_SIZE;

        // Visual size (for image scaling, taking the larger dimension)
        this.size = Math.max(this.width, this.depth);

        this.capacity = config.capacity || 4; // Max concurrent interactors
        this.interactors = []; // List of mate IDs
        this.offsetY = config.offsetY || 0;

        // config hooks
        // config hooks - Wrapped to inject Cooldown Logic
        const baseConditions = config.conditions || (() => true);
        this.conditions = (mate, obj) => {
            // Check specific object cooldown
            if (mate.objectCooldowns && mate.objectCooldowns[obj.id]) {
                if (Date.now() < mate.objectCooldowns[obj.id]) {
                    return false;
                }
            }
            return baseConditions(mate, obj);
        };

        this.onInteractStart = config.onInteractStart || (() => { });
        this.onInteractTick = config.onInteractTick || (() => { }); // Returns true if interaction complete

        const baseOnInteractEnd = config.onInteractEnd || (() => { });
        this.onInteractEnd = (mate, obj) => {
            baseOnInteractEnd(mate, obj);

            // Set Cooldown (30 seconds)
            if (!mate.objectCooldowns) mate.objectCooldowns = {};
            mate.objectCooldowns[obj.id] = Date.now() + 30000;

            // Cleanup old cooldowns occasionally? 
            // Maybe not strictly necessary for session length, but good practice.
            // For now, keep it simple.
        };

        // Visuals
        this.type = config.type || 'generic';
        this.anchor = config.anchor || ANCHOR_MODES.BOTTOM; // Default to BOTTOM
        // Handle src being SVG data URI or regular URL, or text fallback
        this.element = this.createDOM(config.src, config.text);
    }

    get currentInteractorsCount() {
        return this.interactors.length;
    }

    get maxInteractors() {
        return this.capacity;
    }

    set maxInteractors(val) {
        this.capacity = val;
    }

    canInteract() {
        return this.interactors.length < this.capacity;
    }

    addInteractor(mateId) {
        // Validation check before adding
        if (this.canInteract() && !this.interactors.includes(mateId)) {
            this.interactors.push(mateId);
            return true;
        }
        // Even if full, if already present, return true (idempotent)
        if (this.interactors.includes(mateId)) return true;

        return false;
    }

    removeInteractor(mateId) {
        const index = this.interactors.indexOf(mateId);
        if (index > -1) {
            this.interactors.splice(index, 1);
            return true;
        }
        return false;
    }

    createDOM(src, text) {
        let el;
        // Check if src is valid image Source
        if (src) {
            el = document.createElement('img');
            el.src = src;
            el.draggable = false; // Prevent browser drag
            el.className = 'select-none pointer-events-none'; // Pass events to wrapper/hitArea
        } else {
            // Text Fallback
            el = document.createElement('div');
            el.textContent = text || '?';
            el.style.fontSize = `${this.size * 0.8}px`; // Adjust font size
            el.style.display = 'flex';
            el.style.alignItems = 'center';
            el.style.justifyContent = 'center';
        }

        // Wrapper Container
        const wrapper = document.createElement('div');
        wrapper.className = 'absolute select-none cursor-pointer'; // Removed transition-transform
        wrapper.style.width = `${this.size}px`;
        wrapper.style.height = `${this.size}px`;
        wrapper.style.left = '0';
        wrapper.style.top = '0';

        // Apply Anchor Logic using helper class
        ObjectVisualizer.applyAnchor(wrapper, el, this.anchor);

        // Content (Image or Text)
        el.style.display = 'block'; // Remove inline descender space
        el.style.width = '100%';
        el.style.height = '100%';
        el.style.objectFit = 'contain';
        wrapper.appendChild(el);

        // Expanded Hit Area for Dragging (matches grid footprint, aligned to bottom-center)
        const hitArea = document.createElement('div');
        hitArea.className = 'absolute z-20 cursor-move';
        hitArea.style.width = `${this.width}px`;
        hitArea.style.height = `${this.depth}px`;
        hitArea.style.left = '50%';
        hitArea.style.top = '100%';
        hitArea.style.transform = 'translate(-50%, -100%)';
        // hitArea.style.backgroundColor = 'rgba(0, 255, 0, 0.2)'; // Debug hit area

        // Move event listener to this hit area + wrapper
        // wrapper is the main container, events bubble. 
        // But we want to ensure easy clicking.
        wrapper.appendChild(hitArea);

        // Debug Zones: Handled by global GridSystem/debug.js overlay.

        // Interaction: Drag-start
        wrapper.addEventListener('mousedown', (e) => {
            if (e.button === 2) return; // right click handled separately
            handleObjectMouseDown(e, this.id);
        });
        wrapper.addEventListener('touchstart', (e) => {
            handleObjectMouseDown(e, this.id);
        }, { passive: false });

        // Interaction: Right Click -> In-place delete button (no popup)
        wrapper.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Remove any existing menu first
            const existing = document.getElementById('obj-ctx-menu');
            if (existing) existing.remove();

            // Build in-place menu
            const menu = document.createElement('div');
            menu.id = 'obj-ctx-menu';
            menu.style.cssText = 'position:absolute;left:50%;top:-28px;transform:translateX(-50%);background:#222;color:#fff;border-radius:6px;padding:3px 10px;font-size:12px;cursor:pointer;z-index:99999;white-space:nowrap;user-select:none;';
            menu.textContent = '🗑 削除';
            menu.addEventListener('click', (ev) => {
                ev.stopPropagation();
                window.dispatchEvent(new CustomEvent('remove-object', { detail: { id: this.id } }));
                menu.remove();
            });
            wrapper.style.position = 'relative';
            wrapper.appendChild(menu);

            // Auto-close on outside click
            const close = () => { menu.remove(); document.removeEventListener('mousedown', close); };
            setTimeout(() => document.addEventListener('mousedown', close), 0);
        });
        // Note: click-to-show-distances removed

        if (container) container.appendChild(wrapper);
        this.element = wrapper; // Update reference for update()
        return wrapper;
    }

    // update() remains mostly same as it acts on this.element (now wrapper)
    update() {
        if (!container) return;
        const containerHeight = container.clientHeight;
        const containerWidth = container.clientWidth;
        const centerX = containerWidth / 2;

        const isDragging = (state.drag.id === this.id && state.drag.type === 'object');

        // Logic Position (Grid Snapped)
        const logicalX = this.x;
        const logicalZ = this.z;

        // Visual Position (Smooth if dragging, else Snap)
        const targetX = isDragging && this.dragVisualX !== undefined ? this.dragVisualX : logicalX;
        const targetZ = isDragging && this.dragVisualZ !== undefined ? this.dragVisualZ : logicalZ;

        // --- 1. Update Main Element (Smooth) ---
        const depthRatio = targetZ / CONSTANTS.DEPTH_RANGE;
        const scale = 1.0 - depthRatio * (1.0 - CONSTANTS.MIN_SCALE);

        const relativeX = targetX - centerX;
        const visualX = centerX + relativeX * scale;
        // visualY calculation: 
        // Logic: Z is "distance from camera". So higher Z = lower on screen (higher Y value).
        // Wait, current logic: `containerHeight - this.size - targetZ`
        // If Z is 0 (closest), Y is `height - size`. (Bottom of screen).
        // If Z is huge (farthest), Y is smaller (Higher on screen).
        // This coordinates system seems: Z+ means "into the screen", so Y decreases (goes up).
        // Standard "Perspective": Far away things are higher up.
        // Wait, code says: `visualY = containerHeight - this.size - targetZ`.
        // If Z increases, visualY decreases -> Goes Up. Correct.

        let visualY = containerHeight - this.size - targetZ;

        // Apply Config Offset (e.g. for POND to be lower)
        // If we serve "lower", we need INCREASE Y.
        // So + offsetY.
        if (this.offsetY) {
            visualY += this.offsetY;
        }

        const left = visualX - (this.size / 2);

        this.element.style.transform = `translate3d(${left}px, ${visualY}px, 0) scale(${scale})`;
        this.element.style.zIndex = Math.floor(visualY + (isDragging ? 1000 : 0)); // Lift up when dragging

        // --- 2. Update Ghost Element (Snapped Indicator) ---
        // Removed as per user request (no white circle when dragging)
        if (this.ghostElement) {
            this.ghostElement.remove();
            this.ghostElement = null;
        }
    }

    remove() {
        if (this.element) this.element.remove();
        if (this.ghostElement) this.ghostElement.remove();
    }
}
