/**
 * Desktop Mate Simulator - Vanilla JS Implementation
 */

// Auto-approve confirms
window.confirm = () => true;

// --- Constants ---
const STATES = {
    IDLE: 'IDLE',
    WALK: 'WALK',
    JUMP: 'JUMP',
    DRAGGED: 'DRAGGED',
    INTERACT: 'INTERACT'
};

const CONSTANTS = {
    DEPTH_RANGE: 200,
    MIN_Z: 20,
    MIN_SCALE: 0.7,
    Z_LAYERS: 6,
    Z_LAYERS: 6,
    DEFAULT_SIZE: 64,
    OBJECT_REACTION_RADIUS: 50,
    OBJECT_INTERFERENCE_RADIUS: 150
};

const IMAGES = {
    SAD: './pictures/スピキ基本涙目ωワ.png',      // Something sad happened (Drag/Throw)
    NEUTRAL_BAD: './pictures/スピキ基本o.png',     // Neutral but slightly bad
    NEUTRAL_GOOD: './pictures/スピキ笑顔ωワ.png',   // Default / Neutral good
    HAPPY: './pictures/スピキ＞＜へωワ.png'        // Something happy happened
};

// --- State ---
const state = {
    mates: [],
    physics: {
        gravity: 0.3,
        friction: 0.95,
        bounce: 0.4
    },
    mouse: { x: 0, y: 0 },
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
        showControls: true
    },
    ui: {
        showControls: true
    },
    time: 0,
    objects: [] // Array of { id, type, x, z, amount, maxAmount }
};

// --- Generic Interactable Object System ---
// --- Generic Interactable Object System ---
class InteractableObject {
    constructor(id, x, z, config) {
        this.id = id;
        this.x = x;
        this.z = z;
        this.radius = config.radius || 30;
        this.size = this.radius * 2;
        this.capacity = config.capacity || 4;
        this.interactors = []; // List of mate IDs

        // config hooks
        this.conditions = config.conditions || (() => true);
        this.onInteractStart = config.onInteractStart || (() => { });
        this.onInteractTick = config.onInteractTick || (() => { }); // Returns true if interaction complete
        this.onInteractEnd = config.onInteractEnd || (() => { });

        // Visuals
        this.type = config.type || 'generic';
        // Handle src being SVG data URI or regular URL, or text fallback
        this.element = this.createDOM(config.src, config.text);
    }

    createDOM(src, text) {
        let el;
        // Check if src is valid image Source
        if (src) {
            el = document.createElement('img');
            el.src = src;
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
        wrapper.className = 'absolute select-none cursor-pointer transition-transform';
        wrapper.style.width = `${this.size}px`;
        wrapper.style.height = `${this.size}px`;
        wrapper.style.left = '0';
        wrapper.style.top = '0';
        wrapper.style.transformOrigin = 'center bottom';

        // Content (Image or Text)
        el.style.width = '100%';
        el.style.height = '100%';
        el.style.objectFit = 'contain'; // Ensure image fits
        wrapper.appendChild(el);

        // Debug Dot (Foot Position)
        const dot = document.createElement('div');
        dot.className = 'absolute bg-red-600 rounded-full z-10';
        dot.style.width = '4px';
        dot.style.height = '4px';
        dot.style.bottom = '0px';
        dot.style.left = '50%';
        dot.style.transform = 'translate(-50%, 50%)'; // Center on the exact point
        wrapper.appendChild(dot);

        // Interaction: Click to show distances
        wrapper.addEventListener('click', (e) => {
            e.stopPropagation();
            console.log(`[Debug] Object clicked: ${this.type} (x:${this.x}, z:${this.z})`);

            state.mates.forEach(m => {
                const dx = m.x - this.x;
                const dz = m.z - this.z;
                // Weighted Distance: Z counts 2.5x more than X (Elliptical detection)
                // This matches the intuitive "flattened" ground perspective
                const dist = Math.sqrt(dx * dx + (dz * 2.5) ** 2).toFixed(1);

                // Show Floating Label
                const label = document.createElement('div');
                label.textContent = `d:${dist}`;
                label.className = 'absolute text-red-600 font-bold text-xs bg-white border border-red-600 px-1 rounded z-[99999] pointer-events-none';
                label.style.left = `${m.screenX + 20}px`;
                label.style.top = `${m.screenY}px`;
                if (container) container.appendChild(label);

                setTimeout(() => label.remove(), 3000);
            });
        });

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

        // Exact Projection Logic matching Mates
        const depthRatio = this.z / CONSTANTS.DEPTH_RANGE;
        const scale = 1.0 - depthRatio * (1.0 - CONSTANTS.MIN_SCALE);

        const relativeX = this.x - centerX;
        const visualX = centerX + relativeX * scale;

        // Y Position
        const visualY = containerHeight - this.size - this.z;

        // X Position (Left of element: Center VisualX - HalfWidth)
        const left = visualX - (this.size / 2);

        this.element.style.transform = `translate3d(${left}px, ${visualY}px, 0) scale(${scale})`;
        this.element.style.zIndex = Math.floor(visualY); // Sort by Y
    }

    remove() {
        if (this.element) this.element.remove();
    }
}

// Initial "Candy" configuration as a generic object style (for future usage)
// Initial "Candy" configuration
const ITEM_CONFIGS = {
    CANDY: {
        type: 'candy',
        src: "pictures/objects/キャンディ.png",
        text: '🍬',
        radius: 30,
        amount: 5,
        conditions: (mate) => (mate.eatCooldown || 0) <= 0,
        onInteractStart: (mate, obj) => {
            mate.scaleX = 1; mate.scaleY = 1; mate.rotation = 0;
            mate.actionTimer = 0;
            mate.vx = 0; mate.vz = 0;
            if (obj) {
                const dx = obj.x - mate.x;
                mate.direction = dx > 0 ? 1 : -1; // Face candy
            }
        },
        onInteractTick: (mate, obj) => {
            mate.vx = 0; mate.vz = 0;
            mate.actionTimer++;

            // Eating Animation (Chewing)
            const chew = Math.sin(mate.actionTimer * 0.8) * 0.1;
            mate.scaleY = 1.0 - chew;
            mate.scaleX = 1.0 + chew * 0.5;
            mate.rotation = Math.sin(mate.actionTimer * 0.2) * 2;

            if (mate.actionTimer > 100) {
                mate.emotion = Math.min(3, mate.emotion + 1);
                // Infinite Candy: No amount decrement, no removal
                // obj.amount--;
                // if (obj.amount <= 0) removeObject(obj.id);
                return true;
            }
            return false;
        },
        onInteractEnd: (mate, obj) => {
            if (mate.state === STATES.INTERACT) {
                mate.state = STATES.IDLE;
                mate.eatCooldown = 3000;
            }
        }
    },
    TRAMPOLINE: {
        type: 'trampoline',
        src: "data:image/svg+xml;utf8,<svg width='64' height='64' viewBox='0 0 64 64' xmlns='http://www.w3.org/2000/svg'><ellipse cx='32' cy='35' rx='28' ry='10' fill='royalblue'/><path d='M10 35 L10 55 M54 35 L54 55' stroke='black' stroke-width='4'/></svg>",
        text: '🔵',
        radius: 40,
        conditions: (mate) => true,
        onInteractStart: (mate, obj) => {
            mate.vx = 0; mate.vz = 0;
            mate.actionTimer = 0;
        },
        onInteractTick: (mate, obj) => {
            mate.vx = 0; mate.vz = 0;
            mate.actionTimer++;

            // Phase 1: Climb On & Crouch (0-20)
            if (mate.actionTimer <= 20) {
                // Slide to center
                mate.x += (obj.x - mate.x) * 0.2;
                mate.z += (obj.z - mate.z) * 0.2;

                const progress = mate.actionTimer / 20;
                mate.scaleY = 1 - progress * 0.4; // Squat down
                mate.scaleX = 1 + progress * 0.2;
                return false;
            }

            // Phase 2: Launch
            mate.scaleY = 1.4; mate.scaleX = 0.7;
            mate.vh = 35; // Big Jump
            mate.state = STATES.JUMP;
            mate.stateTimer = 0;
            mate.vx = (Math.random() - 0.5) * 10;

            return true;
        },
        onInteractEnd: (mate, obj) => { }
    },
    SPIKEY: {
        type: 'spikey',
        src: "pictures/スピッキー.png",
        text: '🌵',
        radius: 40,
        conditions: (mate) => true,
        onInteractStart: (mate, obj) => {
            mate.vx = 0; mate.vz = 0;
            mate.actionTimer = 0;
            // Face the spikey
            if (obj) {
                const dx = obj.x - mate.x;
                mate.direction = dx > 0 ? 1 : -1;
            }
            // Immediate Startle Reaction (Emotion Drop)
            mate.emotion = 0;
        },
        onInteractTick: (mate, obj) => {
            mate.actionTimer++;

            // Phase 1: Startle (120% ScaleY, 10 skew) - Wait 30 frames
            if (mate.actionTimer < 30) {
                mate.vx = 0; mate.vz = 0;
                mate.scaleY = 1.2;
                mate.scaleX = 0.9;
                mate.skewX = 10 * mate.direction; // Skew away/towards
                mate.shakeStress = 20;
                return false;
            }

            // Phase 2: Run Away
            mate.emotion = 0; // Scared
            mate.skewX = 0;
            mate.shakeStress = 0;

            // Calc vector away
            let dx = mate.x - obj.x;
            let dz = mate.z - obj.z;

            // Prevent zero vector overlap
            if (Math.abs(dx) < 1 && Math.abs(dz) < 1) {
                dx = (Math.random() - 0.5) * 10;
                dz = (Math.random() - 0.5) * 10;
            }

            const angle = Math.atan2(dz, dx);
            // Match normal walking speed: 2 * (courage factor)
            // Courage 1-5 -> Factor 0.6-1.0 -> Speed 1.2-2.0
            const runSpeed = 2.0 * (mate.courage + 5) / 10;

            mate.state = STATES.WALK;
            mate.walkType = 'straight'; // Use standard walk animation for clarity
            mate.isRunningAway = true; // Flag to prevent interference checks

            mate.vx = Math.cos(angle) * runSpeed;
            mate.vz = Math.sin(angle) * runSpeed;
            mate.direction = mate.vx > 0 ? 1 : -1;

            // Run for 3 seconds (180 frames)
            mate.stateTimer = 180;

            return true;
        },
        onInteractEnd: (mate, obj) => { }
    }
};

// Inspector State
let selectedMateId = null;

window.showMateInfo = function (id) {
    selectedMateId = id;
    const mate = state.mates.find(m => m.id === id);
    if (!mate) return;

    const panel = document.getElementById('inspector-panel');
    panel.classList.remove('hidden');

    document.getElementById('insp-id').innerText = '#' + mate.id;
    document.getElementById('insp-emotion').innerText = mate.emotion;
    document.getElementById('insp-courage').innerText = mate.courage;
    document.getElementById('insp-wisdom').innerText = mate.wisdom;
    document.getElementById('insp-friendliness').innerText = mate.friendliness.toFixed(1);
    document.getElementById('insp-state').innerText = mate.state;

    // Delete handler
    const delBtn = document.getElementById('insp-delete-btn');
    delBtn.onclick = () => {
        const idx = state.mates.findIndex(m => m.id === id);
        if (idx !== -1) {
            // Remove DOM
            const el = document.getElementById(`mate-${id}`);
            if (el) el.remove();
            // Remove data
            state.mates.splice(idx, 1);
            updateCountDisplay();
            panel.classList.add('hidden');
        }
    };
};

// --- DOM Elements ---
const container = document.getElementById('game-container');
const uiLayer = document.getElementById('ui-layer');

// --- Helper Functions ---

function getScale(z) {
    if (z < CONSTANTS.MIN_Z) z = CONSTANTS.MIN_Z;
    if (z > CONSTANTS.DEPTH_RANGE) z = CONSTANTS.DEPTH_RANGE;
    // Linear interpolation for scale from 1.0 (front) to MIN_SCALE (back)
    const distinctness = (z - CONSTANTS.MIN_Z) / (CONSTANTS.DEPTH_RANGE - CONSTANTS.MIN_Z);
    return 1.0 - distinctness * (1.0 - CONSTANTS.MIN_SCALE);
}

function getSnappedZ(z) {
    if (z < CONSTANTS.MIN_Z) z = CONSTANTS.MIN_Z;
    if (z > CONSTANTS.DEPTH_RANGE) z = CONSTANTS.DEPTH_RANGE;

    const range = CONSTANTS.DEPTH_RANGE - CONSTANTS.MIN_Z;
    const layerHeight = range / (CONSTANTS.Z_LAYERS - 1);
    const layerIndex = Math.round((z - CONSTANTS.MIN_Z) / layerHeight);

    return CONSTANTS.MIN_Z + layerIndex * layerHeight;
}

function createMateElement(mate) {
    const el = document.createElement('div');
    el.id = `mate-${mate.id}`;
    el.className = 'mate z-20 hover:brightness-110 transition-filter duration-100 cursor-pointer'; // Added cursor-pointer
    el.style.width = `${mate.size}px`;
    el.style.height = `${mate.size}px`;

    // Inner content
    const inner = document.createElement('div');
    inner.className = 'relative w-full h-full group pointer-events-none';
    inner.id = `mate-inner-${mate.id}`;

    // Image content logic
    let contentHtml = '';
    if (mate.type === 'supiki') {
        // Start with Default Image
        contentHtml = `<img id="mate-img-${mate.id}" src="${IMAGES.NEUTRAL_GOOD}" class="w-full h-full object-contain drop-shadow-lg" style="transform: scaleX(${mate.direction})" />`;
    } else if (mate.type === 'url') {
        contentHtml = `<img src="${mate.source}" class="w-full h-full object-contain drop-shadow-lg" style="transform: scaleX(${mate.direction})" onerror="this.onerror=null;this.src='https://via.placeholder.com/64?text=?';" />`;
    } else {
        contentHtml = `<div class="w-full h-full drop-shadow-lg text-current" style="transform: scaleX(${mate.direction})">${mate.source}</div>`;
    }

    inner.innerHTML = contentHtml; // No close button
    inner.innerHTML = contentHtml; // No close button
    el.appendChild(inner);

    // Debug Dot (Collision State)
    const debugDot = document.createElement('div');
    debugDot.id = `mate-debug-${mate.id}`;
    debugDot.className = 'absolute bottom-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 rounded-full opacity-70 pointer-events-none';
    debugDot.style.width = '10px';
    debugDot.style.height = '10px';
    debugDot.style.backgroundColor = 'lime'; // Default safe
    debugDot.style.zIndex = '100'; // Make sure it's visible on top of feet
    el.appendChild(debugDot);

    el.addEventListener('mousedown', (e) => handleMateMouseDown(e, mate.id));
    el.addEventListener('touchstart', (e) => handleMateMouseDown(e, mate.id), { passive: false });

    // Click to Inspect
    el.addEventListener('click', (e) => {
        // If we just finished dragging, don't show info
        // (This relies on drag logic clearing 'isDragging' slightly later or checking travel distance)
        // For now, simple implementation:
        showMateInfo(mate.id);
        e.stopPropagation();
    });

    // Petting Logic (Rubbing)
    // Petting Logic (Rubbing)
    // Track movement to distinguish hovering from rubbing
    let petDist = 0;
    let lastPetCheck = 0;

    el.addEventListener('mousemove', (e) => {
        // Prevent trigger while dragging
        if (state.drag.isDragging) return;

        // Accumulate movement distance
        const dx = Math.abs(e.movementX || 0);
        const dy = Math.abs(e.movementY || 0);
        petDist += dx + dy;

        const now = Date.now();
        // Check roughly 10 times a second (100ms interval)
        if (now - lastPetCheck > 100) {
            // Threshold: Must have moved significant amount (e.g. > 50px accumulated) to count as "Rub/Pet"
            // This prevents static hover or tiny jitters from triggering
            if (petDist > 50) {
                const m = state.mates.find(x => x.id === mate.id);
                if (m) {
                    // Increase friendliness (Cap at 100)
                    // Logic runs 10 times/sec max. +0.5 per tick = +5/sec. 20s to max.
                    if (m.friendliness < 100) m.friendliness += 0.5;

                    // Petting improves emotion (Chance based on Friendliness)
                    const happyChance = (m.friendliness / 100) * 0.2; // Max 20% chance per 100ms

                    if (m.emotion < 3 && Math.random() < happyChance) {
                        m.emotion += 1;
                    }

                    // Optional: Visual feedback or log could go here
                }
            }
            // Reset accumulator
            petDist = 0;
            lastPetCheck = now;
        }
    });

    return el;
}

function updateMateElement(mate) {
    const el = document.getElementById(`mate-${mate.id}`);
    if (!el) return;

    // Debug: Anomaly Detection
    if (Math.abs(mate.scaleX) > 1.6 || Math.abs(mate.scaleY) > 1.6 || Math.abs(mate.direction) > 1.1) {
        console.warn(`[Supiki Alert] Abnormal Scale/Dir Detected! ID: ${mate.id}`);
        console.warn(`State: ${mate.state}, ScaleX: ${mate.scaleX}, ScaleY: ${mate.scaleY}, Dir: ${mate.direction}`);
        console.warn(`Vel: vx=${mate.vx?.toFixed(2)}, vh=${mate.vh?.toFixed(2)}`);
        // console.trace(); // Optional
    }

    // Update Transform
    const transform = `
        translate3d(0, ${mate.offsetY || 0}px, 0) 
        scale(${mate.scaleX * (mate.perspectiveScale || 1)}, ${mate.scaleY * (mate.perspectiveScale || 1)}) 
        rotate(${mate.rotation || 0}deg)
        skew(${mate.skewX || 0}deg, 0deg)
    `;

    el.style.left = `${mate.screenX}px`;
    el.style.top = `${mate.screenY}px`;
    el.style.transform = transform;

    // Z-Index: Visual Y sorting (Lower on screen = Higher z-index = Front)
    // User Request: "z座標にかかわらず足元の位置が下にあるほど手前に"
    el.style.zIndex = mate.state === STATES.DRAGGED ? 10000 : Math.floor(mate.screenY);

    el.style.filter = `brightness(${0.7 + (mate.perspectiveScale || 1) * 0.3})`;

    // Update direction flipping
    const innerImg = el.querySelector(`#mate-img-${mate.id}`) || el.querySelector('img') || el.querySelector('div > div');
    if (innerImg) {
        // Safety: Ensure direction is strictly 1 or -1 to prevent accidental huge scaling
        // User reported "excessive negative scale", implying direction might have been accumulating values
        const safeDir = mate.direction > 0 ? 1 : -1;
        innerImg.style.transform = `scaleX(${safeDir})`;

        // Also clamp overall scale in case physics blew it up
        if (Math.abs(mate.scaleX) > 1.5) mate.scaleX = 1.5;
        if (Math.abs(mate.scaleY) > 1.5) mate.scaleY = 1.5;

        // Update Image Source if Supiki
        if (mate.type === 'supiki' && innerImg.tagName === 'IMG') {
            // Determine target image based on emotion value (0-3)
            // 0: Sad (Teary)
            // 1: Neutral Bad (e.g. slight frown or neutral) -> IMAGES.NEUTRAL_BAD
            // 2: Neutral Good (e.g. smile) -> IMAGES.NEUTRAL_GOOD
            // 3: Happy (Big smile) -> IMAGES.HAPPY
            let targetSrc = IMAGES.NEUTRAL_GOOD;

            // Map legacy/new emotion to image
            // Use Math.round to ensure integer
            const emote = Math.max(0, Math.min(3, Math.round(mate.emotion)));

            if (emote === 0) targetSrc = IMAGES.SAD;
            else if (emote === 1) targetSrc = IMAGES.NEUTRAL_BAD;
            else if (emote === 2) targetSrc = IMAGES.NEUTRAL_GOOD;
            else if (emote === 3) targetSrc = IMAGES.HAPPY;

            // Only update DOM if source changed
            const currentSrc = innerImg.getAttribute('src');
            // check endsWith to avoid absolute/relative path mismatch issues
            if (!currentSrc.endsWith(targetSrc.substring(2))) {
                innerImg.src = targetSrc;
            }
        }
    }
}

// --- Logic ---

function addMate(source, type = 'url') {
    const containerWidth = container.clientWidth || window.innerWidth;

    // Spawn 3 mates
    for (let i = 0; i < 3; i++) {
        const startX = Math.random() * containerWidth;
        const startZ = getSnappedZ(CONSTANTS.MIN_Z + Math.random() * (CONSTANTS.DEPTH_RANGE - CONSTANTS.MIN_Z));
        const startH = 200 + Math.random() * 200;

        // Ensure ID is a safe string for selectors (no dots)
        const safeId = `${Date.now()}-${i}-${Math.floor(Math.random() * 1000)}`;

        const newMate = {
            id: safeId,
            x: startX,
            z: startZ,
            h: startH,
            vx: (Math.random() - 0.5) * 5,
            vz: 0,
            vh: 0,
            size: CONSTANTS.DEFAULT_SIZE,
            type: type,
            source: source,
            state: STATES.JUMP,
            stateTimer: 0,
            actionTimer: 0,
            direction: Math.random() > 0.5 ? 1 : -1,
            scaleX: 1,
            scaleY: 1,
            rotation: 0,
            skewX: 0,
            offsetY: 0,
            walkType: 'straight',
            edgeAction: 'look_center',
            digAngle: 45,
            animPhase: Math.random() * 100,
            interactionTargetId: null,
            screenX: 0,
            screenY: 0,
            perspectiveScale: 1,
            perspectiveScale: 1,
            // New Parameters
            emotion: Math.floor(Math.random() * 4), // 0 to 3
            courage: Math.floor(Math.random() * 5) + 1, // 1 to 5
            wisdom: Math.floor(Math.random() * 5) + 1, // 1 to 5
            friendliness: 0, // 0 to 100
            shakeStress: 0,
            eatCooldown: 0 // New: Cooldown for eating
        };

        state.mates.push(newMate);
        container.appendChild(createMateElement(newMate));
    }
    updateCountDisplay();
}

function removeMate(id) {
    state.mates = state.mates.filter(m => m.id !== id);
    const el = document.getElementById(`mate-${id}`);
    if (el) el.remove();
    updateCountDisplay();
}

function clearAllMates() {
    state.mates.forEach(m => {
        const el = document.getElementById(`mate-${m.id}`);
        if (el) el.remove();
    });
    state.mates = [];
    updateCountDisplay();
}

function updateCountDisplay() {
    const el = document.getElementById('mate-count');
    if (el) el.textContent = `Count: ${state.mates.length}`;
}

// --- Object Logic ---
function spawnObject(config, x, z) {
    const id = `obj-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const obj = new InteractableObject(id, x, z, config);
    // Initial amount (if simple consumable)
    obj.amount = config.amount || 5;

    state.objects.push(obj);
    return obj;
}

// function updateObjectElement replaced by InteractableObject.update()
function removeObject(id) {
    const idx = state.objects.findIndex(o => o.id === id);
    if (idx > -1) {
        state.objects[idx].remove(); // Call class method
        state.objects.splice(idx, 1);
    }
}


// --- Main Loop ---

function animate() {
    if (!container) return;

    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    const centerX = containerWidth / 2;
    const ceilingHeight = containerHeight * 2;

    state.time += 0.05;
    const t = state.time;

    state.mates.forEach(mate => {
        // Validation
        if (Number.isNaN(mate.x)) mate.x = containerWidth / 2;
        if (Number.isNaN(mate.z)) mate.z = CONSTANTS.MIN_Z;
        if (Number.isNaN(mate.h)) mate.h = 0;

        // Cooldown Timer
        if (mate.eatCooldown > 0) mate.eatCooldown--;

        // --- Emotion / Friendliness Logic ---
        // Recovery: 1 level per 3000 seconds (was 30s) -> 1/100 speed
        if (mate.state !== STATES.DRAGGED) {
            mate.shakeStress = 0;
            // 0.0006 / 100 = 0.000006
            if (Math.random() < 0.000006 && mate.emotion < 3) {
                mate.emotion += 1;
            }
        }

        // --- Global Debug Color Update (Realtime) ---
        {
            let debugMinDist = 9999;
            if (state.objects.length > 0) {
                state.objects.forEach(obj => {
                    const dx = obj.x - mate.x;
                    const dz = obj.z - mate.z;
                    const d = Math.sqrt(dx * dx + (dz * 2.5) ** 2);
                    if (d < debugMinDist) debugMinDist = d;
                });
            }
            const dot = document.getElementById(`mate-debug-${mate.id}`);
            if (dot) {
                // Priority: Interaction/Busy -> Blue
                if (mate.state === STATES.INTERACT || mate.isRunningAway) {
                    dot.style.backgroundColor = 'blue';
                } else if (debugMinDist < CONSTANTS.OBJECT_REACTION_RADIUS) {
                    dot.style.backgroundColor = 'red';
                } else if (debugMinDist < CONSTANTS.OBJECT_INTERFERENCE_RADIUS) {
                    dot.style.backgroundColor = 'yellow';
                } else {
                    dot.style.backgroundColor = 'lime';
                }
            }
        }

        // -- Dragging Logic --
        if (mate.id === state.drag.id && state.drag.isDragging) {
            // Interruption Logic
            if (mate.state === STATES.INTERACT || mate.state === STATES.EAT) {
                if (mate.targetObjectId) {
                    const obj = state.objects.find(o => o.id === mate.targetObjectId);
                    if (obj && obj.onInteractEnd) obj.onInteractEnd(mate);
                }
                mate.targetObjectId = null;
                mate.walkingToEat = false;
                // Maybe add stress or reaction?
                mate.emotion = Math.max(0, mate.emotion - 1); // Annoyed at interruption
            }

            mate.state = STATES.DRAGGED;
            mate.scaleX = 1.1;
            mate.scaleY = 1.1;
            mate.rotation = state.drag.velocityScreenX * 2;
            mate.vx = state.drag.velocityScreenX;
            mate.vh = state.drag.velocityScreenY;

            // Mood based on speed + duration
            // Speed threshold > 40
            // Duration approx 1 second (60 frames at 60fps)
            const speed = Math.sqrt(mate.vx * mate.vx + mate.vh * mate.vh);

            // Stress Accumulator Logic
            if (speed > 40) {
                // Moving fast - increase stress
                mate.shakeStress = Math.min(100, (mate.shakeStress || 0) + 2);
            } else {
                // Moving slow - decay stress
                mate.shakeStress = Math.max(0, (mate.shakeStress || 0) - 1);

                // Gently held -> Friendliness ++, Emotion ++
                if (mate.shakeStress === 0) {
                    // Holding increases friendliness (Reduced speed 1/100)
                    if (mate.friendliness < 100) mate.friendliness += 0.0005;

                    // Holding improves emotion fast (Reduced speed 1/100)
                    if (mate.emotion < 3 && Math.random() < 0.0002) {
                        mate.emotion += 1;
                    }
                }
            }

            // If stress is high, drop emotion and friendliness
            if (mate.shakeStress > 60) {
                mate.emotion = 0; // Cry immediately
                if (mate.friendliness > 0) mate.friendliness -= 0.1;
            }



            updateMateElement(mate);
            return;
        }

        let { x, z, h, vx, vz, vh, state: currentState, stateTimer, actionTimer } = mate;
        const isGrounded = h <= 0;

        // State Machine
        if (isGrounded) {
            if (h < 0) h = 0;

            if (currentState === STATES.JUMP || currentState === STATES.DRAGGED) {
                // Landing Logic / Pre-Jump Logic
                if (mate.stateTimer > 0) {
                    // PRE_JUMP Phase (Squat)
                    vx = 0; vz = 0;
                    mate.stateTimer--;
                    const progress = 1 - (mate.stateTimer / 20);
                    mate.scaleX = 1 + 0.4 * progress; mate.scaleY = 1 - 0.4 * progress;

                    if (mate.stateTimer <= 0) {
                        // Launch
                        const jumpHeight = containerHeight / 2;
                        const courageFactor = mate.courage / 5;
                        const finalHeight = jumpHeight * courageFactor;

                        vh = Math.sqrt(2 * state.physics.gravity * finalHeight);
                        vx = (Math.random() < 0.3) ? (Math.random() - 0.5) * 15 : (Math.random() - 0.5) * 4;
                        vz = (Math.random() - 0.5) * 2;

                        mate.state = STATES.JUMP; // Ensure state
                    }
                } else if (vh < -state.physics.gravity * 2.5) {
                    // Bounce
                    vh *= -state.physics.bounce;
                    vx *= 0.8;
                    vz *= 0.8;

                    // Impact reduces mood slightly
                    if (Math.abs(vh) > 5) mate.emotion = Math.max(0, mate.emotion - 1);

                } else {
                    // Landed / Idle Processing
                    vh = 0; vx = 0; vz = 0;
                    z = getSnappedZ(z);

                    // Landing Transition -> Check if at edge -> Interact(Wall)
                    const isAtSideEdge = x < 50 || x > containerWidth - 50;
                    const isAtDepthEdge = z < CONSTANTS.MIN_Z + 20 || z > CONSTANTS.DEPTH_RANGE - 20;

                    if (currentState === STATES.JUMP) {
                        // Regular landing (Edge logic removed)
                        mate.state = STATES.IDLE;
                        mate.stateTimer = 60 + Math.random() * 60;
                        mate.scaleX = 1.1; mate.scaleY = 0.9; mate.rotation = 0;
                    }
                    // If DRAGGED/IDLE, we just stay here or handle below
                    if (currentState === STATES.DRAGGED) {
                        mate.state = STATES.IDLE;
                        mate.stateTimer = 60;
                    }
                }
            }

            if (currentState === STATES.IDLE) {
                vx *= 0.8; vz *= 0.8;
                mate.stateTimer--;

                mate.rotation = Math.sin(t + mate.animPhase) * 2;
                const stretch = Math.abs(mate.rotation) / 10;
                mate.scaleY = 0.98 + stretch * 0.04;
                mate.scaleX = 1 / (mate.scaleY || 1);

                if (mate.stateTimer <= 0) {
                    // Check Mouse Proximity
                    const mouseDist = Math.hypot(mate.screenX - state.mouse.x, mate.screenY - state.mouse.y);
                    if (mouseDist < 200) {
                        mate.stateTimer = 30;
                        if (mate.wisdom >= 3) {
                            const dx = state.mouse.x - mate.screenX;
                            if (Math.abs(dx) > 10) mate.direction = dx > 0 ? 1 : -1;
                        }
                        return;
                    }

                    // Check for nearby objects
                    let targetObj = null;
                    let minDist = 9999;
                    let debugMinDist = 9999; // Track absolute closest for debug coloring

                    if (state.objects.length > 0) {
                        state.objects.forEach(obj => {
                            const dx = obj.x - x;
                            const dz = obj.z - z;
                            // Weighted Distance: Z counts 2.5x more than X (Elliptical detection)
                            const d = Math.sqrt(dx * dx + (dz * 2.5) ** 2);

                            // Update Debug Dist (Ignore conditions)
                            if (d < debugMinDist) debugMinDist = d;

                            // Check conditions for INTERACTION (e.g. only hungry mates see candy)
                            if (obj.conditions && !obj.conditions(mate)) return;

                            // Prioritize Reaction Circle (Immediate interaction)
                            if (d < CONSTANTS.OBJECT_REACTION_RADIUS) {
                                minDist = -1; // Force prioritize
                                targetObj = obj;
                                return;
                            }

                            // Check Interference Circle (Potential attraction)
                            if (d < CONSTANTS.OBJECT_INTERFERENCE_RADIUS && d < minDist) {
                                minDist = d;
                                targetObj = obj;
                            }
                        });

                        // Debug color logic moved to Global Loop

                        if (targetObj) {
                            // Determine if we are in Reaction or Interference zone
                            const dx = targetObj.x - x;
                            const dz = targetObj.z - z;
                            const d = Math.sqrt(dx * dx + (dz * 2.5) ** 2);

                            let shouldInteract = false;

                            if (d < CONSTANTS.OBJECT_REACTION_RADIUS) {
                                // Inside Reaction Circle: Always interact
                                shouldInteract = true;
                            } else {
                                // Inside Interference Circle: Probabilistic approach
                                // Higher wisdom/curiosity = higher chance to investigate
                                // Higher wisdom/curiosity = higher chance to investigate
                                // Base chance 0.6 + 0.1 per Wisdom level -> 0.7 to 1.1

                                let chance = 0.6 + (mate.wisdom * 0.1);

                                // High probability for Candy
                                if (targetObj.type === 'candy') {
                                    chance = 0.95; // Very high interest in candy
                                }

                                if (Math.random() < chance) {
                                    shouldInteract = true;
                                }
                            }

                            if (shouldInteract) {
                                mate.targetObjectId = targetObj.id;
                                mate.state = STATES.WALK;
                                // Calc walking vector...
                                const angle = Math.atan2(dz, dx);
                                const walkSpeed = 2 * (mate.courage + 5) / 10;
                                vx = Math.cos(angle) * walkSpeed;
                                vz = Math.sin(angle) * walkSpeed;
                                mate.direction = vx > 0 ? 1 : -1;
                                mate.walkType = 'straight';
                                // Walk to the object center (or slightly offset)
                                mate.stateTimer = Math.sqrt(dx * dx + dz * dz) / walkSpeed;
                                mate.walkingToEat = true;
                                return;
                            }
                        }
                    }

                    // Decision: Walk or Jump
                    const unit = 0.95 / 6;
                    const walkProb = unit * mate.wisdom;

                    if (Math.random() < walkProb) {
                        // WALK
                        mate.state = STATES.WALK;
                        let targetX = Math.random() * containerWidth;
                        let targetZ = getSnappedZ(CONSTANTS.MIN_Z + Math.random() * (CONSTANTS.DEPTH_RANGE - CONSTANTS.MIN_Z));

                        // Safety margins
                        if (targetX < 100) targetX = 20;
                        else if (targetX > containerWidth - 100) targetX = containerWidth - 20;

                        const dx = targetX - x;
                        const dz = targetZ - z;
                        const dist = Math.sqrt(dx * dx + dz * dz);
                        const baseSpeed = 2;
                        const walkSpeed = baseSpeed * (mate.courage + 5) / 10;
                        const angle = Math.atan2(dz, dx);

                        vx = Math.cos(angle) * walkSpeed;
                        vz = Math.sin(angle) * walkSpeed;
                        mate.direction = vx > 0 ? 1 : -1;
                        mate.stateTimer = Math.max(30, dist / walkSpeed);

                        const r2 = Math.random();
                        mate.walkType = r2 < 0.4 ? 'straight' : r2 < 0.6 ? 'squash' : r2 < 0.8 ? 'v_shape' : 'sin_wave';
                    } else {
                        // PRE_JUMP (Transitions to JUMP)
                        mate.state = STATES.JUMP; // Use JUMP state, but with timer for pre-jump
                        mate.stateTimer = 20;
                    }
                }
            }
            else if (currentState === STATES.INTERACT) {
                // Determine Interaction Type
                if (mate.targetObjectId) {
                    // --- Object Interaction ---
                    const obj = state.objects.find(o => o.id === mate.targetObjectId);
                    if (!obj) {
                        mate.state = STATES.IDLE;
                        mate.targetObjectId = null;
                        return;
                    }
                    const finished = obj.onInteractTick(mate, obj);
                    // Sync local velocity variables as onInteractTick modifies the object directly
                    vx = mate.vx;
                    vz = mate.vz;

                    if (finished) {
                        if (obj.onInteractEnd) obj.onInteractEnd(mate);

                        // Only force IDLE if the interaction didn't transition to another state
                        if (mate.state === STATES.INTERACT) {
                            mate.state = STATES.IDLE;
                        }

                        mate.targetObjectId = null;
                        mate.eatCooldown = 60 * 60;
                    }
                } else {
                    // --- Wall/Idle Interaction (formerly EDGE_STAY) ---
                    vx = 0; vz = 0;
                    mate.stateTimer--; mate.actionTimer--;

                    const breath = Math.sin(t * 0.1 + mate.animPhase);
                    mate.scaleY = 1 + breath * 0.02; mate.scaleX = 1 - breath * 0.01;

                    if (mate.edgeAction === 'dig') {
                        const isLeftSide = x < containerWidth / 2;
                        mate.direction = isLeftSide ? 1 : -1;
                        const digCycle = Math.sin(t * 15);
                        mate.scaleY = 0.9 + digCycle * 0.1; mate.scaleX = 1.1 - digCycle * 0.05;
                        const baseAngle = mate.digAngle || 45;
                        mate.rotation = (mate.direction === 1 ? baseAngle : -baseAngle) + digCycle * 5;
                    } else if (mate.edgeAction === 'look_mouse') {
                        mate.direction = state.mouse.x < x ? -1 : 1;
                        mate.rotation = 0;
                    } else {
                        mate.direction = x < containerWidth / 2 ? 1 : -1;
                        mate.rotation = 0;
                    }

                    if (mate.actionTimer <= 0) {
                        if (mate.stateTimer <= 0) {
                            // Finish
                            mate.state = STATES.WALK;
                            const targetX = containerWidth / 2 + (Math.random() - 0.5) * 200;
                            const targetZ = getSnappedZ(CONSTANTS.DEPTH_RANGE / 2 + (Math.random() - 0.5) * 100);
                            const dx = targetX - x;
                            const dz = targetZ - z;
                            const walkSpeed = 2;
                            const angle = Math.atan2(dz, dx);
                            vx = Math.cos(angle) * walkSpeed;
                            vz = Math.sin(angle) * walkSpeed;
                            mate.stateTimer = Math.sqrt(dx * dx + dz * dz) / walkSpeed;
                            mate.walkType = 'straight';
                            mate.direction = vx > 0 ? 1 : -1;
                        } else {
                            // Change action
                            mate.actionTimer = 60 + Math.random() * 120;
                            mate.edgeAction = Math.random() < 0.5 ? 'look_center' : 'look_mouse';
                            if (mate.edgeAction === 'dig') mate.digAngle = 30 + Math.random() * 30;
                        }
                    }
                }
            }
            else if (currentState === STATES.WALK) {
                mate.stateTimer--;
                if (mate.walkType === 'straight') {
                    mate.scaleX = 1; mate.scaleY = 1; mate.rotation = 0;
                } else if (mate.walkType === 'squash') {
                    const cycle = Math.sin((t + mate.animPhase) * 2);
                    mate.scaleY = 1 + cycle * 0.1; mate.scaleX = 1 - cycle * 0.05;
                } else if (mate.walkType === 'v_shape') {
                    const vCycle = Math.abs(Math.sin((t + mate.animPhase) * 3));
                    mate.offsetY = vCycle * 5;
                    mate.rotation = mate.direction * 3;
                } else if (mate.walkType === 'sin_wave') {
                    const phase = (t + mate.animPhase) * 2;
                    mate.skewX = Math.sin(phase) * 15;
                }

                // Check for Object Interference during Walk (Interruption)
                // Only if not already targeting an object AND not running away
                if (!mate.walkingToEat && !mate.targetObjectId && !mate.isRunningAway && state.objects.length > 0) {
                    state.objects.forEach(obj => {
                        // Check conditions
                        if (obj.conditions && !obj.conditions(mate)) return;

                        const dx = obj.x - x;
                        const dz = obj.z - z;
                        const d = Math.sqrt(dx * dx + (dz * 2.5) ** 2);

                        if (d < CONSTANTS.OBJECT_INTERFERENCE_RADIUS) {
                            // Entered Interference Circle
                            let chance = 0.6 + (mate.wisdom * 0.1);
                            let triggerThreshold = 0.05;

                            // High probability for Candy
                            if (obj.type === 'candy') {
                                chance = 1.5; // Boosting base curiosity
                                triggerThreshold = 0.1; // 10% chance per frame to notice (very high)
                            }

                            // Check roughly once per second (approx) or purely on entry? 
                            // Since we check every frame, we need a low chance per frame OR a state flag 'checkedInteraction'.
                            // However, simple approach: weighted very low per frame to simulate 'noticing'
                            // 0.3 chance total -> distribute over frames? 
                            // Better: Only trigger if we are "close enough" but also use a random low probability to prevent instant lock

                            if (Math.random() < triggerThreshold * chance) { // About 1-2% chance per frame inside circle normally
                                mate.targetObjectId = obj.id;

                                // Retarget WALK to Object
                                const angle = Math.atan2(dz, dx);
                                const walkSpeed = 2 * (mate.courage + 5) / 10;
                                vx = Math.cos(angle) * walkSpeed;
                                vz = Math.sin(angle) * walkSpeed;
                                mate.direction = vx > 0 ? 1 : -1;
                                mate.walkType = 'straight';
                                mate.stateTimer = Math.sqrt(dx * dx + dz * dz) / walkSpeed;
                                mate.walkingToEat = true;

                                // Reset visuals for clarity
                                mate.scaleX = 1; mate.scaleY = 1; mate.rotation = 0; mate.skewX = 0;
                            }
                        }
                    });
                    // If retargeted, vx/vz are updated, loop continues naturally
                }

                // Boundary Check
                if ((vx < 0 && x <= 20) || (vx > 0 && x >= containerWidth - 20) ||
                    (vz < 0 && z <= CONSTANTS.MIN_Z) || (vz > 0 && z >= CONSTANTS.DEPTH_RANGE)) {

                    // Wall Interaction Removed - Just Stop
                    // Wall Interaction Removed - Just Stop
                    mate.state = STATES.IDLE;
                    mate.stateTimer = 60;
                    mate.isRunningAway = false; // Reset flag
                    vx = 0; vz = 0;
                    z = getSnappedZ(z);
                } else if (mate.stateTimer <= 0) {
                    // Reached destination
                    if (mate.walkingToEat && mate.targetObjectId) {
                        const obj = state.objects.find(o => o.id === mate.targetObjectId);

                        // Distance check to enforce Reaction Radius
                        let canInteract = false;
                        if (obj) {
                            const dx = obj.x - x;
                            const dz = obj.z - z;
                            const d = Math.sqrt(dx * dx + (dz * 2.5) ** 2);
                            if (d <= CONSTANTS.OBJECT_REACTION_RADIUS) {
                                canInteract = true;
                            }
                        }

                        if (obj && canInteract) {
                            mate.state = STATES.INTERACT;
                            // Reset transform
                            mate.scaleX = 1; mate.scaleY = 1; mate.rotation = 0;
                            // Trigger start
                            if (obj.onInteractStart) obj.onInteractStart(mate);
                        } else {
                            // Object gone or not close enough
                            mate.state = STATES.IDLE;
                            mate.stateTimer = 60;
                            mate.isRunningAway = false;
                        }
                        mate.walkingToEat = false;
                        vx = 0; vz = 0;
                    } else {
                        mate.state = STATES.IDLE;
                        mate.stateTimer = 60;
                        mate.isRunningAway = false;
                        vx = 0; vz = 0;
                        z = getSnappedZ(z);
                    }
                }
            }
        } else {
            // Airborn
            // Force JUMP state if not dragged
            if (currentState !== STATES.DRAGGED) mate.state = STATES.JUMP;

            vh -= state.physics.gravity;
            mate.skewX = 0; mate.offsetY = 0;
            const stretch = Math.min(Math.abs(vh) * 0.05, 0.4);
            mate.scaleY = 1 + stretch; mate.scaleX = 1 - (stretch * 0.5);
            mate.rotation = vx * 2;

            if (h > ceilingHeight) {
                h = ceilingHeight;
                vh *= -state.physics.bounce;
            }
        }

        // Apply Physics
        x += vx;
        z += vz;
        h += vh;

        // X Limits (Damped bounce)
        if (x < 0) { x = 0; vx *= -0.5; mate.direction = 1; }
        if (x > containerWidth) { x = containerWidth; vx *= -0.5; mate.direction = -1; }

        // Z Limits
        if (z < CONSTANTS.MIN_Z) { z = CONSTANTS.MIN_Z; vz *= -1; }
        if (z > CONSTANTS.DEPTH_RANGE) { z = CONSTANTS.DEPTH_RANGE; vz *= -1; }

        // Update Position State
        mate.x = x; mate.z = z; mate.h = h;
        mate.vx = vx; mate.vz = vz; mate.vh = vh;

        // Calculate Visuals
        const depthRatio = z / CONSTANTS.DEPTH_RANGE;
        const perspectiveScale = 1.0 - depthRatio * (1.0 - CONSTANTS.MIN_SCALE);
        const relativeX = x - centerX;
        const visualX = centerX + relativeX * perspectiveScale;
        const visualY = containerHeight - mate.size - z - h;

        mate.perspectiveScale = perspectiveScale;
        mate.screenX = visualX;
        mate.screenY = visualY;

        updateMateElement(mate);
    });

    // Render Objects
    // Render Objects
    state.objects.forEach(obj => {
        if (obj.update) obj.update();
        else updateObjectElement(obj); // Fallback if regular object
    });

    // Inspector Realtime Update
    if (selectedMateId && !document.getElementById('inspector-panel').classList.contains('hidden')) {
        const m = state.mates.find(x => x.id === selectedMateId);
        if (m) {
            document.getElementById('insp-emotion').innerText = m.emotion;
            document.getElementById('insp-courage').innerText = m.courage;
            document.getElementById('insp-wisdom').innerText = m.wisdom;
            document.getElementById('insp-friendliness').innerText = m.friendliness.toFixed(1);
            document.getElementById('insp-state').innerText = m.state;
        }
    }

    requestAnimationFrame(animate);
}

// --- Interaction Handlers ---

function handleMateMouseDown(e, id) {
    if (e.cancelable) e.preventDefault(); // Prevent text selection etc
    const clientX = e.clientX || e.touches?.[0]?.clientX;
    const clientY = e.clientY || e.touches?.[0]?.clientY;

    if (!clientX) return;

    // Correct Z snap
    const mate = state.mates.find(m => m.id === id);
    if (mate) mate.z = getSnappedZ(mate.z);

    state.drag.isDragging = true;
    state.drag.id = id;
    state.drag.lastScreenX = clientX;
    state.drag.lastScreenY = clientY;
    state.drag.velocityScreenX = 0;
    state.drag.velocityScreenY = 0;

    // Offset is handled by tracking delta later
}

function handleGlobalMouseMove(e) {
    const clientX = e.clientX || e.touches?.[0]?.clientX;
    const clientY = e.clientY || e.touches?.[0]?.clientY;

    // Update generic mouse pos
    if (clientX) {
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

    // Update dragged mate position visually immediately
    const mate = state.mates.find(m => m.id === state.drag.id);
    if (mate) {
        mate.screenX += dx;
        mate.screenY += dy;
        // Logic updates happen in animate(), but we can force render here if needed.
        // animate() runs at 60fps anyway.
    }
}

function handleGlobalMouseUp(e) {
    if (!state.drag.isDragging) return;

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

    let fixedZ = mate.z;
    let newH = containerHeight - mate.size - fixedZ - visualY;

    if (newH < 0) {
        // Drop below ground, try to find a valid Z
        const idealZ = containerHeight - mate.size - visualY;
        fixedZ = getSnappedZ(Math.max(CONSTANTS.MIN_Z, Math.min(CONSTANTS.DEPTH_RANGE, idealZ)));
        newH = 0;
    }

    // Recalculate X
    const depthRatio = fixedZ / CONSTANTS.DEPTH_RANGE;
    const scale = 1.0 - depthRatio * (1.0 - CONSTANTS.MIN_SCALE);
    const newX = centerX + (visualX - centerX) / scale;

    // Apply throw physics
    mate.x = Math.max(0, Math.min(containerWidth, newX));
    mate.z = fixedZ;
    mate.h = Math.max(0, newH);
    mate.vx = state.drag.velocityScreenX;
    mate.vh = -state.drag.velocityScreenY; // Invert ScreenY to go UP

    // Reset Scales immediately to avoid artifacts
    mate.scaleX = 1;
    mate.scaleY = 1;

    // If placed on ground gently, go IDLE directly
    if (mate.h <= 0 && Math.abs(mate.vh) < 2 && Math.abs(mate.vx) < 2) {
        mate.state = STATES.IDLE;
        mate.stateTimer = 60;
        mate.vx = 0; mate.vh = 0; mate.vz = 0;
    } else {
        mate.state = STATES.JUMP;
        mate.stateTimer = 0; // CRITICAL: Reset timer to avoid triggering Pre-Jump logic with leftover timers
    }

    state.drag.isDragging = false;
    state.drag.id = null;
}

// --- UI Controls ---

function toggleControls() {
    state.ui.showControls = !state.ui.showControls;
    const ui = document.getElementById('control-panel');
    const toggleBtn = document.getElementById('toggle-btn');
    const toggleReq = document.getElementById('toggle-text');

    if (state.ui.showControls) {
        uiLayer.classList.remove('hidden-ui');
        toggleReq.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="inline mr-1"><path d="M18 6L6 18M6 6l12 12"/></svg> Close`;
    } else {
        uiLayer.classList.add('hidden-ui');
        toggleReq.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="inline mr-1"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg> Settings`;
    }
}

// --- Initialize Handlers ---

document.addEventListener('mousemove', handleGlobalMouseMove);
document.addEventListener('touchmove', handleGlobalMouseMove, { passive: false });
document.addEventListener('mouseup', handleGlobalMouseUp);
document.addEventListener('touchend', handleGlobalMouseUp);

// Settings Listeners
document.getElementById('input-gravity').addEventListener('input', (e) => state.physics.gravity = parseFloat(e.target.value));
document.getElementById('input-bounce').addEventListener('input', (e) => state.physics.bounce = parseFloat(e.target.value));

// Obsolete UI listeners removed



// Start Animation
// Start Animation
// Initial objects removed as per user request
spawnObject(ITEM_CONFIGS.CANDY, 200, 100);
// spawnObject(ITEM_CONFIGS.TRAMPOLINE, 500, 100);
spawnObject(ITEM_CONFIGS.SPIKEY, 800, 100);

requestAnimationFrame(animate);

// --- Debug Grid (Perspective Ground) ---
function drawGrid() {
    if (!container) return;

    // Cleanup old grid
    const oldGrid = document.getElementById('debug-grid');
    if (oldGrid) oldGrid.remove();

    const w = container.clientWidth;
    const h = container.clientHeight;

    // Create SVG Overlay
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.id = 'debug-grid';
    svg.setAttribute('class', 'absolute inset-0 pointer-events-none z-0 opacity-10');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    container.appendChild(svg);

    // Params (Match global logic)
    const DEPTH_RANGE = 200; // CONSTANTS.DEPTH_RANGE
    const MIN_SCALE = 0.7;   // CONSTANTS.MIN_SCALE
    const centerX = w / 2;

    const project = (x, z) => {
        const depthRatio = z / DEPTH_RANGE;
        const scale = 1.0 - depthRatio * (1.0 - MIN_SCALE);
        const vx = centerX + (x - centerX) * scale;
        const vy = h - z; // Foot position
        return { x: vx, y: vy };
    };

    // Draw Z Lines (Horizontal-ish)
    // From X=0 to X=w at specific Zs
    for (let z = 0; z <= DEPTH_RANGE; z += 50) {
        const p1 = project(0, z);
        const p2 = project(w, z);

        const path = document.createElementNS("http://www.w3.org/2000/svg", "line");
        path.setAttribute('x1', p1.x); path.setAttribute('y1', p1.y);
        path.setAttribute('x2', p2.x); path.setAttribute('y2', p2.y);
        path.setAttribute('stroke', 'blue');
        path.setAttribute('stroke-width', '1');
        svg.appendChild(path);

        // Text
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute('x', p1.x + 5);
        text.setAttribute('y', p1.y - 2);
        text.setAttribute('fill', 'blue');
        text.setAttribute('font-size', '10');
        text.textContent = `Z:${z}`;
        svg.appendChild(text);
    }

    // Draw X Lines (Converging)
    // From Z=0 to Z=DEPTH_RANGE at specific Xs
    for (let x = 0; x <= w; x += 100) {
        const p1 = project(x, 0);
        const p2 = project(x, DEPTH_RANGE);

        const path = document.createElementNS("http://www.w3.org/2000/svg", "line");
        path.setAttribute('x1', p1.x); path.setAttribute('y1', p1.y);
        path.setAttribute('x2', p2.x); path.setAttribute('y2', p2.y);
        path.setAttribute('stroke', 'red');
        path.setAttribute('stroke-dasharray', '4'); // Dashed for vertical
        path.setAttribute('stroke-width', '1');
        svg.appendChild(path);

        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute('x', p1.x);
        text.setAttribute('y', p1.y - 5); // At bottom
        text.setAttribute('fill', 'red');
        text.setAttribute('font-size', '10');
        text.setAttribute('text-anchor', 'middle');
        text.textContent = `X:${x}`;
        svg.appendChild(text);
    }
}

// Call Grid
setTimeout(drawGrid, 500);
window.addEventListener('resize', drawGrid);
