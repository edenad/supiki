import { IMAGES, CONSTANTS, STATES } from '../constants.js';
import { state } from '../state.js';
import { handleMateMouseDown } from '../input.js';
import { showMateInfo } from '../ui.js';
import { trySpeak, getPan } from '../sound/SoundManager.js';

export function createMateElement(mate) {
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
    el.appendChild(inner);

    // Debug Dot (Collision State) - cache reference on mate to avoid per-frame getElementById
    const debugDot = document.createElement('div');
    debugDot.id = `mate-debug-${mate.id}`;
    let debugClasses = 'debug-zone absolute bottom-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 rounded-full opacity-70 pointer-events-none';
    if (!state.ui.showDebugZones) {
        debugClasses += ' hidden';
    }
    debugDot.className = debugClasses;
    debugDot.style.width = '30px';
    debugDot.style.height = '10px';
    debugDot.style.backgroundColor = 'lime'; // Default safe
    debugDot.style.zIndex = '100'; // Make sure it's visible on top of feet
    el.appendChild(debugDot);
    mate.debugDotEl = debugDot; // Cache DOM reference to avoid per-frame querySelector

    el.addEventListener('mousedown', (e) => handleMateMouseDown(e, mate.id));
    el.addEventListener('touchstart', (e) => handleMateMouseDown(e, mate.id), { passive: false });

    // Interaction: Right Click to Dekopin (Flick - rolling)
    el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const m = state.mates.find(x => x.id === mate.id);
        if (!m || m.state === STATES.DRAGGED) return;

        // Dekopin: random horizontal direction + upward launch
        const angle = Math.random() * Math.PI * 2;
        const power = 7 + Math.random() * 5; // 7-12 px/frame horizontal

        m.vx = Math.cos(angle) * power;
        m.vz = Math.sin(angle) * power * 0.3;
        m.vh = 5 + Math.random() * 4; // Strong upward launch (was 1-3, now 5-9)
        m.h = 2;  // Start slightly above ground so physics treats as airborne

        m.state = STATES.JUMP; // Use JUMP so airborne physics handles it correctly
        m.stateTimer = 0;      // 0 = skip pre-jump crouch, launch immediately
        m.isRolling = true;
        m.rollingRotation = 0;
        m.walkingToEat = false;
        m.targetObjectId = null;
        m.groupId = null;

        // 驚き発話
        trySpeak(m.id, 'STARTLE', { minInterval: 1500, pan: getPan(m) });

        // Emotion hit (rotation-only flick - no scale/aspect ratio change)
        m.emotion = Math.max(0, m.emotion - 1);

    });


    // Click to Inspect
    el.addEventListener('click', (e) => {
        // If we just finished dragging, don't show info
        // (This relies on drag logic clearing 'isDragging' slightly later or checking travel distance)
        // For now, simple implementation:
        showMateInfo(mate.id);
        e.stopPropagation();
    });

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

export function updateMateElement(mate) {
    const el = document.getElementById(`mate-${mate.id}`);
    if (!el) return;

    // Debug: Anomaly Detection
    if (Math.abs(mate.scaleX) > 1.6 || Math.abs(mate.scaleY) > 1.6 || Math.abs(mate.direction) > 1.1) {
        console.warn(`[Supiki Alert] Abnormal Scale/Dir Detected! ID: ${mate.id}`);
        console.warn(`State: ${mate.state}, ScaleX: ${mate.scaleX}, ScaleY: ${mate.scaleY}, Dir: ${mate.direction}`);
        console.warn(`Vel: vx=${mate.vx?.toFixed(2)}, vh=${mate.vh?.toFixed(2)}`);
        // console.trace(); // Optional
    }

    // Safety: Clamp Scales
    let pScale = mate.perspectiveScale || 1;
    if (pScale < 0.1) pScale = 0.1;
    if (pScale > 2.0) pScale = 2.0;

    if (Math.abs(mate.scaleX) > 1.5) mate.scaleX = 1.5;
    if (Math.abs(mate.scaleY) > 1.5) mate.scaleY = 1.5;

    // Update Transform
    const transform = `
        translate3d(0, ${mate.offsetY || 0}px, 0) 
        scale(${mate.scaleX * pScale}, ${mate.scaleY * pScale}) 
        rotate(${mate.rotation || 0}deg)
        skew(${mate.skewX || 0}deg, 0deg)
    `;

    el.style.left = `${mate.screenX}px`;
    el.style.top = `${mate.screenY}px`;
    el.style.transform = transform;

    // Z-Index: Visual Y sorting (Lower on screen = Higher z-index = Front)
    // User Request: "z座標にかかわらず足元の位置が下にあるほど手前に"
    el.style.zIndex = mate.state === STATES.DRAGGED ? 10000 : Math.floor(mate.screenY);

    // Transform Origin (Dynamic)
    if (mate.spinCenter) {
        el.style.transformOrigin = 'center center';
    } else {
        el.style.transformOrigin = 'center bottom';
    }

    let filter = `brightness(${0.7 + (mate.perspectiveScale || 1) * 0.3})`;
    if (mate.isFrozen || mate.frozenCooldown) {
        filter += ' hue-rotate(180deg) contrast(1.2) brightness(1.2)';
    }
    el.style.filter = filter;

    // Update direction flipping
    const innerImg = el.querySelector(`#mate-img-${mate.id}`) || el.querySelector('img') || el.querySelector('div > div');
    if (innerImg) {
        // Safety: Ensure direction is strictly 1 or -1 to prevent accidental huge scaling
        // User reported "excessive negative scale", implying direction might have been accumulating values
        const safeDir = mate.direction > 0 ? 1 : -1;
        innerImg.style.transform = `scaleX(${safeDir})`;



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

            // OVERRIDE: Startle (Frozen Scare) - Force Emotion 0 face
            // SPIKEY interaction already sets emotion=0, so this mainly covers 'frozen_scare'
            if (mate.reactionType === 'frozen_scare') {
                targetSrc = IMAGES.SAD;
            }

            // Only update DOM if source changed
            const currentSrc = innerImg.getAttribute('src');
            // check endsWith to avoid absolute/relative path mismatch issues
            if (!currentSrc.endsWith(targetSrc.substring(2))) {
                innerImg.src = targetSrc;
            }
        }
    }
    // Ukiwa (Float) Ring Overlay
    let ukiwa = el.querySelector('.ukiwa-ring');
    // Hide ukiwa if drowning (it broke!)
    if (mate.inPond && !mate.isDrowning) {
        if (!ukiwa) {
            ukiwa = document.createElement('img');
            ukiwa.className = 'ukiwa-ring absolute top-1/2 left-1/2 w-[120%] h-[120%] object-contain pointer-events-none transform -translate-x-1/2 -translate-y-1/2';
            ukiwa.src = IMAGES.UKIWA_FRONT || 'img/ukiwa_front.png'; // Fallback
            ukiwa.style.zIndex = '10'; // In front of mate
            el.appendChild(ukiwa);
        }
        // Ukiwa tracks body exactly (no separate bobbing)
        // Ensure accurate centering with translate(-50%, -50%) and scale
        ukiwa.style.transform = 'translate(-50%, -50%) scale(1.1)';
    } else {
        if (ukiwa) ukiwa.remove();
    }
}
