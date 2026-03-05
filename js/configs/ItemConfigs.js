import { STATES, IMAGES } from '../constants.js';
import { MOTIONS } from './MotionConfigs.js';
import { state } from '../state.js';
import { trySpeak, getPan } from '../sound/SoundManager.js';

export const ITEM_CONFIGS = {
    FOOD: {
        type: 'food',
        src: "pictures/objects/food_star.png", // Default (will be randomized)
        text: '🍬',
        width: 1, // 1 tile
        depth: 1, // 1 tile
        amount: 10, // 10 bites total
        // But "Unified model".
        conditions: (mate, obj) => {
            if ((mate.interactionCooldown || 0) > 0) return false;
            // Don't interact if already empty (should be removed, but just in case)
            if (obj.amount <= 0) return false;
            if (obj && !obj.canInteract()) return false;
            return true;
        },
        onInteractStart: (mate, obj) => {
            mate.vx = 0; mate.vz = 0;
            mate.actionTimer = 0;

            // Face the object
            if (obj) {
                const dx = obj.x - mate.x;
                mate.direction = dx > 0 ? 1 : -1;
            }

            // Bad Food Logic
            if (obj.foodType === 'bad') {
                mate.emotion = 0;
                // Immediate Startle
                trySpeak(mate.id, 'STARTLE', { minInterval: 2000, pan: getPan(mate) });
                // We'll handle this in Tick to play animation
            } else {
                mate.scaleX = 1; mate.scaleY = 1; mate.rotation = 0;
            }
        },
        onInteractTick: (mate, obj) => {
            mate.vx = 0; mate.vz = 0;
            mate.actionTimer++;

            // Safety check: if object was already depleted, end interaction immediately
            if ((obj.amount !== undefined) && obj.amount <= 0) {
                window.dispatchEvent(new CustomEvent('remove-object', { detail: { id: obj.id } }));
                return true;
            }

            // --- Bad Food (Food 7) ---
            if (obj.foodType === 'bad') {
                if (mate.actionTimer < 30) {
                    MOTIONS.STARTLE.update(mate, mate.actionTimer);
                    mate.shakeStress = 20;
                    return false;
                }
                // Run Away
                mate.emotion = 0;
                mate.skewX = 0;
                mate.shakeStress = 0;

                let dx = mate.x - obj.x;
                let dz = mate.z - obj.z;
                if (Math.abs(dx) < 1 && Math.abs(dz) < 1) { dx = 10; dz = 10; }

                const angle = Math.atan2(dz, dx);
                const runSpeed = 2.0 * (mate.courage + 5) / 10;

                mate.state = STATES.WALK;
                mate.walkType = 'straight';
                mate.isRunningAway = true;
                mate.vx = Math.cos(angle) * runSpeed;
                mate.vz = Math.sin(angle) * runSpeed;
                mate.direction = mate.vx > 0 ? 1 : -1;
                mate.stateTimer = 180;
                return true;
            }

            // --- Good Food (Star / Candy) ---
            MOTIONS.EAT.update(mate, mate.actionTimer);

            if (mate.actionTimer > 100) {
                // Effect based on food type
                let boost = 1;
                if (obj.foodType === 'star') {
                    boost = 2;
                }
                mate.emotion = Math.min(3, mate.emotion + boost);
                trySpeak(mate.id, 'HAPPY', { minInterval: 3000, pan: getPan(mate) }); // おいしい！
                return true;
            }
            return false;
        },
        onInteractEnd: (mate, obj) => {
            if (mate.state === STATES.INTERACT) {
                mate.state = STATES.IDLE;
                mate.interactionCooldown = 300;
            }
            // Consumption Logic
            if (obj && obj.id) {
                if (mate.isRunningAway) return; // bad food: didn't eat, just ran

                const currentAmount = (obj.amount !== undefined ? obj.amount : 10);
                obj.amount = currentAmount - 1;

                // Visual Clipping (Top down bite)
                if (obj.element) {
                    const img = obj.element.querySelector('img');
                    if (img) {
                        const max = 10;
                        const percent = Math.max(0, (max - obj.amount) / max * 100);
                        img.style.clipPath = `inset(${percent}% 0 0 0)`;
                    }
                }

                // Remove if depleted
                if (obj.amount <= 0) {
                    window.dispatchEvent(new CustomEvent('remove-object', { detail: { id: obj.id } }));
                }
            }
        }

    },
    TRAMPOLINE: {
        type: 'trampoline',
        src: "pictures/objects/trampoline.png",
        text: '🔵',
        width: 3, // 3x3 tiles (150px)
        depth: 3,
        offsetY: 20,
        conditions: (mate, obj) => ((mate.interactionCooldown || 0) <= 0) && (!obj || obj.canInteract()),
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

                // Motion: CROUCH
                const progress = mate.actionTimer / 20;
                MOTIONS.CROUCH.update(mate, progress);
                return false;
            }

            // Phase 2: Launch
            mate.scaleY = 1.4; mate.scaleX = 0.7;
            mate.vh = 12; // Reduced Jump (was 35)
            mate.state = STATES.JUMP;
            mate.stateTimer = 0;
            mate.vx = (Math.random() - 0.5) * 10;
            mate.vz = (Math.random() - 0.5) * 2;

            return true;
        },
        onInteractEnd: (mate, obj) => { }
    },
    SPIKEY: {
        type: 'spikey',
        src: "pictures/スピッキー.png",
        text: '🌵',
        width: 2, // Spikey 1.5x of 40px ~= 60px -> 2 tiles needed to fit or just visually bigger?
        // User said "1.5 times size". 
        // 40px * 1.5 = 60px. Tiles are 50px.
        // If we set width/depth to 1.5 tiles (75px)? 
        // Logic uses integer tiles effectively for grid.
        // Let's set to 2 tiles for safety or keep 1 and visual overflow?
        // "radius deprecated, use mass".
        // Let's make it 2x2 tiles (100px) but visual scaling can be controlled via CSS or just fill the 2x2.
        // Actually, if we want "size 1.5x", maybe strict tile logic means 2x2.
        depth: 2,
        conditions: (mate, obj) => ((mate.interactionCooldown || 0) <= 0) && (!obj || obj.canInteract()),
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
            trySpeak(mate.id, 'STARTLE', { minInterval: 2000, pan: getPan(mate) }); // スピッキーに驚く
        },
        onInteractTick: (mate, obj) => {
            mate.actionTimer++;

            // Phase 1: Startle (ScaleY, Skew) - Wait 30 frames
            if (mate.actionTimer < 30) {
                mate.vx = 0; mate.vz = 0;

                // Motion: STARTLE
                MOTIONS.STARTLE.update(mate, mate.actionTimer);

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
            mate.walkType = 'straight';
            mate.isRunningAway = true; // Flag to prevent interference checks
            mate.vx = Math.cos(angle) * runSpeed;
            mate.vz = Math.sin(angle) * runSpeed;
            mate.direction = mate.vx > 0 ? 1 : -1;

            // Run for 3 seconds (180 frames) in MateUpdate logic (stateTimer)
            // But here we need to manually set target or just "push" them
            // The previous logic was setting targetX/Z manually which is not ideal in Tick
            // Let's just give them velocity and let Update handle it?
            // Actually, if we change state to WALK here, Tick stops being called?
            // Correct. MateUpdate handles WALK.
            // But we need to set stateTimer for duration.

            mate.stateTimer = 180;
            return true; // Interaction "Done", now they are running
        },
        onInteractEnd: (mate, obj) => { }
    },
    POND: {
        type: 'pond',
        src: IMAGES.POND,
        text: '💧',
        width: 3,
        depth: 1,
        offsetY: 75,
        capacity: 3,
        anchor: 'center', // use ANCHOR_MODES.CENTER (string 'center' works)
        conditions: (mate, obj) => {
            if ((mate.interactionCooldown || 0) > 0) return false;
            // Limit to capacity (walking to or in pond)
            const count = state.mates.filter(m => m.targetObjectId === obj.id && m.id !== mate.id).length;
            if (count >= (obj.maxInteractors || obj.capacity || 3)) return false;
            return true;
        },
        onInteractStart: (mate, obj) => {
            mate.state = STATES.INTERACT;
            mate.targetObjectId = obj.id;
            mate.inPond = true;
            mate.vx = 0; mate.vz = 0;
            mate.offsetY = 0;
            mate.pondTimer = 0;
            mate.isDrowning = false;
        },
        onInteractTick: (mate, obj) => {
            // Tile-based overlap check
            const halfWidth = (obj.width || 50) / 2;
            const halfDepth = (obj.depth || 50) / 2;

            const dx = Math.abs(mate.x - obj.x);
            const dz = Math.abs(mate.z - obj.z);

            // Strict box boundary
            if (dx > halfWidth || dz > halfDepth) {
                mate.inPond = false;
                mate.isDrowning = false;
                return true; // Exit interaction
            }

            mate.inPond = true;
            mate.pondTimer = (mate.pondTimer || 0) + 1;

            // 1. Check Max Duration: (30 - w * 5) seconds
            const maxDuration = (30 - (mate.wisdom || 0) * 5) * 60;
            if (mate.pondTimer > maxDuration) {
                mate.inPond = false;
                mate.isDrowning = false;
                return true; // Force exit
            }

            // 2. Drowning Logic (> 20s)
            if (mate.pondTimer > 20 * 60 && !mate.isDrowning) {
                // Chance to drown (break ukiwa)
                if (Math.random() < 0.01) {
                    mate.isDrowning = true;
                    mate.emotion = 0; // Panic!
                }
            }

            const t = Date.now() / 1000;

            if (mate.isDrowning) {
                MOTIONS.DROWN.update(mate, t);
                // Drifting while drowning
                mate.vx += (Math.random() - 0.5) * 0.5;
                mate.vz += (Math.random() - 0.5) * 0.5;
            } else {
                // Motion: FLOAT (Puka Puka)
                MOTIONS.FLOAT.update(mate, t);

                // Drift Physics (Dampened) (Water friction)
                mate.vx += (Math.random() - 0.5) * 0.2;
                mate.vz += (Math.random() - 0.5) * 0.2;
                mate.vx *= 0.9;
                mate.vz *= 0.9;
            }

            // Center Pull (Weak) ensure they stay in
            if (dx > halfWidth * 0.8 || dz > halfDepth * 0.8) {
                // If close to edge (80%), pull back
                mate.vx -= (mate.x - obj.x) * 0.005;
                mate.vz -= (mate.z - obj.z) * 0.005;
            }

            return false;
        },
        onInteractEnd: (mate, obj) => {
            mate.inPond = false;
            mate.isDrowning = false;
            mate.offsetY = 0;
            if (mate.state === STATES.INTERACT) {
                mate.state = STATES.IDLE;
            }
        }
    },
    UKIWA: {
        type: 'ukiwa',
        src: 'pictures/objects/ukiwa_front.png',
        text: '⭕',
        width: 1,
        depth: 1,
        conditions: (mate, obj) => ((mate.interactionCooldown || 0) <= 0) && (!obj || obj.canInteract()),
        onInteractStart: (mate, obj) => {
            mate.state = STATES.INTERACT;
            mate.targetObjectId = obj.id;
            mate.vx = 0; mate.vz = 0;
        },
        onInteractTick: (mate, obj) => {
            const dx = mate.x - obj.x;
            const dz = mate.z - obj.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            // Break if too far
            if (dist > 40) {
                if (obj.element) obj.element.style.opacity = '1';
                mate.inPond = false;
                return true;
            }

            if (obj.element) obj.element.style.opacity = '0';
            mate.inPond = true;

            // Simulating float
            const t = Date.now() / 1000;
            mate.offsetY = Math.sin(t * 4) * 2 - 2;

            return false;
        },
        onInteractEnd: (mate, obj) => {
            if (obj.element) obj.element.style.opacity = '1';
            mate.inPond = false;
            mate.offsetY = 0;
            if (mate.state === STATES.INTERACT) {
                mate.state = STATES.IDLE;
            }
        }
    },
    PUMPKIN: {
        type: 'pumpkin',
        src: 'pictures/objects/pumpkin.png',
        text: '🎃',
        width: 1,
        depth: 1,
        conditions: (mate, obj) => ((mate.interactionCooldown || 0) <= 0) && (!obj || obj.canInteract()),
        onInteractStart: (mate, obj) => {
            mate.vx = 0; mate.vz = 0;
            mate.emotion = Math.min(3, mate.emotion + 1); // Happy
            mate.actionTimer = 0;
            mate.scaleX = 1; mate.scaleY = 1;
            trySpeak(mate.id, 'PUMPKIN', { minInterval: 2000, volume: 0.9, pan: getPan(mate) });
        },
        onInteractTick: (mate, obj) => {
            mate.actionTimer++;

            // Motion: HAPPY_BOUNCE
            MOTIONS.HAPPY_BOUNCE.update(mate, mate.actionTimer);

            if (mate.actionTimer > 120) return true; // Finish after 2 seconds
            return false;
        },
        onInteractEnd: (mate, obj) => {
            mate.offsetY = 0;
            mate.rotation = 0;
        }
    },
    ICE: {
        type: 'ice',
        src: IMAGES.ICE,
        text: '🧊',
        width: 2,
        depth: 2,
        offsetY: 20, // Adjust lower as real images often need grounding
        conditions: (mate, obj) => ((mate.interactionCooldown || 0) <= 0) && (!obj || obj.canInteract()),
        onInteractStart: (mate, obj) => {
            mate.vx = 0; mate.vz = 0;
            mate.isFrozen = true;
            mate.emotion = 0; // Sad/Crying
            mate.actionTimer = 0;
            mate.scaleX = 1; mate.scaleY = 1; mate.rotation = 0;
            trySpeak(mate.id, 'FREEZE', { minInterval: 500, pan: getPan(mate) }); // 凍る音(ﾋﾟｷのみ)
        },
        onInteractTick: (mate, obj) => {
            mate.actionTimer++;

            // Motion: FREEZE
            MOTIONS.FREEZE.update(mate, mate.actionTimer);
            mate.emotion = 0;
            mate.isFrozen = true;

            if (mate.actionTimer > 300) return true; // 10 seconds (30fps)
            return false;
        },
        onInteractEnd: (mate, obj) => {
            // Keep frozen state active during the cooldown
            mate.isFrozen = true;
            mate.frozenCooldown = true; // Mark that we are in post-freeze cooldown

            mate.rotation = 0;
            mate.vx = 0;
            mate.vz = 0; // Ensure stopped
            if (mate.state === STATES.INTERACT) {
                mate.state = STATES.IDLE;
                // Frozen Duration: (18 - COURAGE * 5) seconds
                // 60 fps assumed for interactionCooldown logic in MateUpdate
                const durationSeconds = Math.max(1, 18 - (mate.courage || 0) * 5);
                mate.interactionCooldown = durationSeconds * 60;
            }
        }
    },
    VENDING: {
        type: 'vending',
        src: "pictures/objects/jihanki.png",
        text: '🥤',
        width: 2, // Vending 1.5x -> 60px -> 2 tiles
        depth: 2,
        offsetY: 0, // Removed offset to push it back (up) visually
        // Original was 80. User said "position is weird".
        // If it was floating, reduce offset (increase Y? No, decrease Y moves up).
        // Wait, current logic: visualY = containerHeight - size - targetZ + offsetY.
        // If offsetY is +80, it moves DOWN.
        // If it looked "weird" (maybe sinking?), let's try reducing it.
        // Let's set 40.
        capacity: 1,
        conditions: (mate, obj) => ((mate.interactionCooldown || 0) <= 0) && (!obj || obj.canInteract()),
        onInteractStart: (mate, obj) => {
            mate.vx = 0; mate.vz = 0;
            mate.actionTimer = 0;
            // Face the machine
            const dx = obj.x - mate.x;
            mate.direction = dx > 0 ? 1 : -1;
            mate.rotation = 0;
            mate.spinCenter = true; // Use center-center rotation
        },
        onInteractTick: (mate, obj) => {
            mate.actionTimer++;

            // Motion: SPIN_RAPID
            MOTIONS.SPIN_RAPID.update(mate, mate.actionTimer);

            // 2. Shake Machine (Simultaneously)
            if (obj.element && obj.element.children[0]) {
                const content = obj.element.children[0];
                const shake = Math.sin(mate.actionTimer * 1.5) * 5; // +/- 5px shake
                content.style.transform = `translateX(${shake}px)`;
            }

            // Duration: 2 seconds (60 frames) for 5 spins
            if (mate.actionTimer > 60) return true;
            return false;
        },
        onInteractEnd: (mate, obj) => {
            mate.rotation = 0;
            mate.spinCenter = false;
            if (obj && obj.element && obj.element.children[0]) {
                obj.element.children[0].style.transform = 'none';
            }
            // Note: item spawning removed - Spikey now handles digging instead
        }
    }
};
