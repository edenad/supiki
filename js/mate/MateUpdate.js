import { state } from '../state.js';
import { CONSTANTS, STATES } from '../constants.js';
import { getSnappedZ } from '../utils.js';
import { updateMateElement } from './MateVisuals.js';
import { MOTIONS } from '../configs/MotionConfigs.js';
import { CollisionSystem } from '../systems/CollisionSystem.js';
import { maybeSpeakIdle, trySpeak } from '../sound/SoundManager.js';

/**
 * Calculates approach velocity towards an object.
 * @param {number} x Mate world X
 * @param {number} z Mate world Z
 * @param {object} obj Target object
 * @param {number} walkSpeed Walk speed
 * @returns {{ vx: number, vz: number, stateTimer: number }}
 */
function calcApproachVector(x, z, obj, walkSpeed) {
    const approachAngle = Math.random() * Math.PI * 2;
    const r = obj.radius || 30;
    const offsetDist = r * 0.5 + Math.random() * r * 0.3;
    const targetRx = obj.x + Math.cos(approachAngle) * offsetDist;
    const targetRz = obj.z + Math.sin(approachAngle) * (offsetDist / (obj.zScale || 3.0));
    const dxT = targetRx - x;
    const dzT = targetRz - z;
    const angle = Math.atan2(dzT, dxT);
    return {
        vx: Math.cos(angle) * walkSpeed,
        vz: Math.sin(angle) * walkSpeed,
        stateTimer: Math.max(10, Math.sqrt(dxT * dxT + dzT * dzT) / walkSpeed)
    };
}

export function updateMate(mate, containerWidth, containerHeight, t) {
    // Validation
    if (Number.isNaN(mate.x)) mate.x = containerWidth / 2;
    if (Number.isNaN(mate.z)) mate.z = CONSTANTS.MIN_Z;
    if (Number.isNaN(mate.h)) mate.h = 0;

    // Self-healing: Clear inPond if not interacting
    if (mate.inPond && mate.state !== STATES.INTERACT) {
        mate.inPond = false;
    }

    // Self-healing: Clear Frozen if not interacting and no cooldown
    if (mate.isFrozen && !mate.gameFrozen && mate.interactionCooldown <= 0 && mate.state !== STATES.INTERACT) {
        mate.isFrozen = false;
        mate.frozenCooldown = false;
    }

    // Distance-based Ice Check: Continuously monitor distance to Ice
    if (mate.isFrozen || mate.frozenCooldown) {
        let isNearIce = false;
        if (state.objects && state.objects.length > 0) {
            state.objects.forEach(obj => {
                if (obj.type === 'ice') {
                    const distTiles = CollisionSystem.getTileDistance(mate.x, mate.z, obj.x, obj.z);
                    if (distTiles < 4) { // Roughly 200px radius
                        isNearIce = true;
                    }
                }
            });
        }
        // If pulled away from Ice or Ice is removed, cure frozen state immediately
        if (!isNearIce && !mate.gameFrozen) {
            mate.isFrozen = false;
            mate.frozenCooldown = false;
            if (mate.state !== STATES.INTERACT) {
                mate.interactionCooldown = 0; // Clear cooldown to resume normal activity
            }
        }
    }

    // Cooldown Timer
    if (mate.interactionCooldown > 0) {
        mate.interactionCooldown--;
        // Special Handling for "Frozen Cooldown"
        if (mate.frozenCooldown) {
            mate.isFrozen = true;
            MOTIONS.FREEZE.update(mate, mate.interactionCooldown); // Or any timer
            if (!(mate.id === state.drag.id && state.drag.isDragging)) {
                // Recalculate screen positioning even if frozen (for camera/resize validity)
                const depthRatio = mate.z / CONSTANTS.DEPTH_RANGE;
                const perspectiveScale = 1.0 - depthRatio * (1.0 - CONSTANTS.MIN_SCALE);
                const centerX = containerWidth / 2;
                const relativeX = mate.x - centerX;
                const visualX = centerX + relativeX * perspectiveScale;
                // Assuming h=0 if frozen usually, or keep current h
                const visualY = containerHeight - mate.size - mate.z - mate.h;
                mate.perspectiveScale = perspectiveScale;
                mate.screenX = visualX;
                mate.screenY = visualY;

                updateMateElement(mate);
                return; // Skip other updates completely to stay put
            }
        }
    } else {
        // Cooldown Ended
        if (mate.frozenCooldown) {
            mate.frozenCooldown = false;
            mate.isFrozen = false;
        }
    }
    // --- Emotion / Friendliness Logic ---
    // Recovery
    if (mate.state !== STATES.DRAGGED) {
        mate.shakeStress = 0;
        // Game mode: keep emotion at 0
        if (state.gameMode) {
            mate.emotion = 0;
        } else if (Math.random() < 0.000006 && mate.emotion < 3) {
            mate.emotion += 1;
        }
    }

    // --- Global Debug Color Update (Realtime) ---
    {
        let debugMinDist = 9999;
        if (state.objects.length > 0) {
            state.objects.forEach(obj => {
                const distTiles = CollisionSystem.getTileDistance(mate.x, mate.z, obj.x, obj.z);
                if (distTiles < debugMinDist) debugMinDist = distTiles * 50;
            });
        }
        // Use cached DOM reference instead of per-frame getElementById
        const dot = mate.debugDotEl;
        if (dot) {
            const isInteractingWithMate = mate.state === STATES.INTERACT && mate.reactionTargetId !== null && (mate.reactionType === 'approach_mate' || mate.reactionType === 'suri_suri' || mate.reactionType === 'dance' || mate.reactionType === 'greet' || mate.reactionType === 'self_look' || mate.reactionType === 'self_stretch' || mate.reactionType === 'self_dance' || mate.reactionType === 'self_spin' || mate.reactionType === 'self_dig');

            if (isInteractingWithMate) {
                dot.style.backgroundColor = 'white';
            } else if (mate.state === STATES.INTERACT || mate.isRunningAway) {
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
                if (obj) {
                    if (obj.onInteractEnd) obj.onInteractEnd(mate, obj);
                    obj.removeInteractor(mate.id);
                }
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
    const ceilingHeight = containerHeight * 2;

    // --- Rolling (Dekopin) ---
    if (mate.isRolling) {
        const speed = Math.sqrt(vx * vx + vz * vz);
        // Spin proportional to horizontal speed (z-axis rotation only, no scale change)
        const spinDir = vx >= 0 ? 1 : -1;
        mate.rollingRotation = (mate.rollingRotation || 0) + speed * spinDir * 3;
        mate.rotation = mate.rollingRotation;

        if (isGrounded) {
            // On ground: apply rolling friction until slow enough to stop
            vx *= 0.88;
            vz *= 0.88;

            if (speed < 0.5) {
                mate.isRolling = false;
                mate.rotation = 0;
                mate.state = STATES.IDLE;
                mate.stateTimer = 60;
                vx = 0; vz = 0;
            }
        }
        // Airborne: no friction, just spin
    }


    // State Machine
    if (isGrounded) {
        if (h < 0) h = 0;

        if (currentState === STATES.JUMP || currentState === STATES.DRAGGED) {
            // Landing Logic / Pre-Jump Logic
            if (mate.stateTimer > 0) {
                // PRE_JUMP Phase (Squat) - skip if rolling (dekopin launches directly)
                if (!mate.isRolling) {
                    vx = 0; vz = 0;
                    mate.stateTimer--;

                    const progress = 1 - (mate.stateTimer / 20);
                    MOTIONS.CROUCH.update(mate, progress);

                    if (mate.stateTimer <= 0) {
                        const jumpHeight = containerHeight / 4;
                        const courageFactor = mate.courage / 5;
                        const finalHeight = jumpHeight * courageFactor;

                        vh = Math.sqrt(2 * state.physics.gravity * finalHeight);
                        vx = (Math.random() < 0.3) ? (Math.random() - 0.5) * 15 : (Math.random() - 0.5) * 4;
                        vz = (Math.random() - 0.5) * 2;
                        mate.state = STATES.JUMP;
                    }
                }
            } else if (vh < -state.physics.gravity * 2.5) {
                // Bounce
                vh *= -state.physics.bounce;
                vx *= 0.8;
                vz *= 0.8;

                if (Math.abs(vh) > 5) mate.emotion = Math.max(0, mate.emotion - 1);

            } else {
                // Landed
                vh = 0;
                if (!mate.isRolling) {
                    // Normal landing: snap and idle
                    vx = 0; vz = 0;
                    z = getSnappedZ(z);
                    if (currentState === STATES.JUMP) {
                        mate.state = STATES.IDLE;
                        mate.stateTimer = 60 + Math.random() * 60;
                        mate.scaleX = 1.1; mate.scaleY = 0.9; mate.rotation = 0;
                    }
                    if (currentState === STATES.DRAGGED) {
                        mate.state = STATES.IDLE;
                        mate.stateTimer = 60;
                    }
                } else {
                    // Rolling landing: keep sliding (WALK handles the friction in rolling block)
                    mate.state = STATES.WALK;
                    mate.stateTimer = 120;
                    mate.walkingToEat = false;
                    // Landing squash
                    mate.scaleX = 1.3;
                    mate.scaleY = 0.7;
                }
            }
        }

        if (currentState === STATES.IDLE) {
            vx *= 0.8; vz *= 0.8;
            mate.stateTimer--;

            // ランダムつぶやき (感情により種別が変わる)
            maybeSpeakIdle(mate);

            // --- Spontaneous Dig Trigger (disabled in game mode) ---
            if (!state.gameMode && !mate.walkingToEat && !mate.targetObjectId && mate.interactionCooldown <= 0) {
                const hasFood = state.objects.some(o => o.type === 'food');
                if (!hasFood && Math.random() < 1 / 3600) {
                    mate.state = STATES.INTERACT;
                    mate.edgeAction = 'dig';
                    mate.digAngle = 30 + Math.random() * 30;
                    mate.actionTimer = 90 + Math.random() * 90;
                    mate.stateTimer = Math.max(mate.stateTimer, 60);
                    vx = 0; vz = 0;
                }
            }

            if (mate.stateTimer <= 0) {
                // Logic handled later in block
            } else {
                MOTIONS.IDLE_BREATH.update(mate, t);
                mate.rotation = Math.sin(t + mate.animPhase) * 2;
            }

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

                // GROUP LOGIC OVERRIDE: If in a group, wait for command
                if (mate.groupId) {
                    mate.stateTimer = 30 + Math.random() * 30; // Random wait
                    return;
                }

                // Check for nearby objects (disabled in game mode)
                if (!state.gameMode && state.objects.length > 0) {
                    let bestTarget = null;
                    let minWeightedDist = 9999;

                    state.objects.forEach(obj => {
                        if (obj.conditions && !obj.conditions(mate, obj)) return;

                        // Reaction check: Use Tile Overlap
                        const detectionRadius = (obj.detectionRadius !== undefined ? obj.detectionRadius : (obj.radius || 30));
                        const interferenceRadius = (obj.radius || 30) + 50;

                        // Priority Reaction (Red Zone - Interact)
                        if (CollisionSystem.checkTileOverlap(x, z, obj.x, obj.z, detectionRadius)) {
                            if (minWeightedDist > 0) { // Found better tier
                                minWeightedDist = -1;
                                bestTarget = obj;
                            }
                        }
                        // Interference Radius (Awareness - Yellow Zone)
                        else if (CollisionSystem.checkTileOverlap(x, z, obj.x, obj.z, interferenceRadius) && minWeightedDist > 0) {
                            // Use simple manhattan/chebyshev for sorting if needed, or just pick first
                            const dist = CollisionSystem.getTileDistance(x, z, obj.x, obj.z);
                            if (dist < minWeightedDist) {
                                minWeightedDist = dist;
                                bestTarget = obj;
                            }
                        }
                    });

                    if (bestTarget) {
                        let shouldInteract = minWeightedDist === -1; // Auto if close
                        if (!shouldInteract) {
                            let chance = 0.6 + (mate.wisdom * 0.1);
                            if (bestTarget.type === 'candy') {
                                chance = 0.95;
                                if (mate.emotion < 2) chance = 2.0;
                            }
                            if (Math.random() < chance) shouldInteract = true;
                        }

                        // Prevent interaction if cooldown
                        if (mate.interactionCooldown > 0) shouldInteract = false;

                        if (shouldInteract) {
                            mate.targetObjectId = bestTarget.id;
                            mate.state = STATES.WALK;
                            mate.walkingToEat = true;

                            const walkSpeed = 2 * (mate.courage + 5) / 10;
                            const approach = calcApproachVector(x, z, bestTarget, walkSpeed);
                            vx = approach.vx;
                            vz = approach.vz;
                            mate.stateTimer = approach.stateTimer;

                            if (vx > 0.2) mate.direction = 1;
                            else if (vx < -0.2) mate.direction = -1;
                        }
                    }
                }

                // Check for nearby frozen mates (User Request: "Face, Startle, Run")
                // --- Game mode: skip all interactions except thaw_friend (handled by drop event) ---
                if (state.gameMode) {
                    // Just walk / idle - no interactions
                } else {
                    const nearbyFrozen = state.mates.find(m => m.id !== mate.id && m.isFrozen && !mate.isRunningAway);
                    if (nearbyFrozen) {
                        const dx = nearbyFrozen.x - x;
                        const dz = nearbyFrozen.z - z;
                        const dist = Math.sqrt(dx * dx + dz * dz);

                        if (dist < 100) { // Reaction range
                            // 1. Face them
                            mate.direction = dx > 0 ? 1 : -1;

                            // 2. Startle Motion (One-shot via specialized transient state or just modifying vars?)
                            // Spikey uses "INTERACT" state to play Startle. Let's do that.
                            // We need a dummy object or a special logic. 
                            // Or we can just set state=INTERACT and handle it manually.
                            // But INTERACT usually requires targetObjectId.
                            // Let's create a "FrozenReact" Pseudo-Object or handle it in INTERACT generic?
                            // Simpler: Set specialized variables and use INTERACT without ID, or a special ID.
                            // ACTUALLY: Let's use a "reactionTarget" property on mate to distinguishing.

                            mate.state = STATES.INTERACT;
                            mate.reactionTargetId = nearbyFrozen.id;
                            mate.reactionType = 'frozen_scare';
                            mate.actionTimer = 0;
                            mate.vx = 0; mate.vz = 0;
                            return; // Break IDLE loop
                        }
                    }

                    // Check for nearby mates to interact with
                    if (!mate.walkingToEat && mate.interactionCooldown <= 0 && !mate.isRunningAway) {
                        const nearbyMate = state.mates.find(m => {
                            if (m.id === mate.id || m.state !== STATES.IDLE || m.interactionCooldown > 0 || m.reactionTargetId || m.isRunningAway || m.walkingToEat) {
                                return false;
                            }
                            const dx = m.x - mate.x;
                            const dz = m.z - mate.z;
                            const dist = Math.sqrt(dx * dx + dz * dz);
                            return dist < 200; // Interaction range 200
                        });

                        if (nearbyMate) {
                            // Initiate interaction for both
                            mate.state = STATES.INTERACT;
                            mate.reactionTargetId = nearbyMate.id;
                            mate.actionTimer = 0;

                            nearbyMate.state = STATES.INTERACT;
                            nearbyMate.reactionTargetId = mate.id;
                            nearbyMate.actionTimer = 0;

                            // Determine type based on emotion
                            const e1 = mate.emotion;
                            const e2 = nearbyMate.emotion;
                            let type = 'greet';

                            if ((e1 === 0 && e2 >= 2) || (e2 === 0 && e1 >= 2)) {
                                type = 'suri_suri';
                            } else if (e1 <= 1 && e2 <= 1) {
                                type = 'dance';
                            }

                            // Enter approach phase first
                            mate.reactionType = 'approach_mate';
                            mate.nextReactionType = type;
                            nearbyMate.reactionType = 'approach_mate';
                            nearbyMate.nextReactionType = type;
                            return; // Break IDLE loop
                        }
                    }

                } // end !state.gameMode block

                // If we didn't start interacting, decide normal behavior
                // Only act if cooldown is done and not walking to eat
                if (!mate.walkingToEat && mate.interactionCooldown <= 0) {

                    // Possible behaviors
                    let behaviors = ['walk', 'jump', 'dig']; // base
                    if (mate.emotion === 0) behaviors.push('look');
                    if (mate.emotion >= 2) behaviors.push('stretch', 'dance');
                    if (mate.emotion >= 3) behaviors.push('spin');

                    // --- ゲームモード制約：「ただ動き回るだけ」 ---
                    if (state.gameMode) {
                        behaviors = ['walk', 'jump'];
                    }

                    // Weighted selection
                    // Previously Walk probability was proportional to wisdom.
                    const walkProb = 0.5;
                    const isWalk = Math.random() < walkProb;

                    if (isWalk) {
                        // WALK
                        mate.state = STATES.WALK;
                        let targetX = Math.random() * containerWidth;
                        let targetZ = getSnappedZ(CONSTANTS.MIN_Z + Math.random() * (CONSTANTS.DEPTH_RANGE - CONSTANTS.MIN_Z));

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
                        // Pick from non-walk behaviors
                        const nonWalk = behaviors.filter(b => b !== 'walk');
                        const choice = nonWalk[Math.floor(Math.random() * nonWalk.length)];

                        if (choice === 'jump') {
                            mate.state = STATES.JUMP; // Use JUMP state pre-jump squat
                            mate.stateTimer = 20;
                        } else {
                            // Specialized IDLE actions (execute via INTERACT state but isolated)
                            mate.state = STATES.INTERACT;
                            mate.reactionTargetId = null; // null means self-act
                            mate.reactionType = 'self_' + choice;
                            mate.actionTimer = 0;
                            mate.vx = 0; mate.vz = 0;
                        }
                    }

                    // 安全策: stateTimer が10秒(600フレーム)を超えないようにする
                    if (mate.stateTimer > 600) mate.stateTimer = 600;
                }
            }
        }
        else if (currentState === STATES.INTERACT) {
            // Determine Interaction Type
            if (mate.reactionType && mate.reactionType.startsWith('self_')) {
                mate.actionTimer++;
                const action = mate.reactionType.substring(5);

                if (action === 'look') {
                    // Look around (left right left right) over 60 frames
                    if (mate.actionTimer % 20 === 0) mate.direction *= -1;
                    if (mate.actionTimer >= 60) {
                        // Sensing
                        const wisdom = mate.wisdom || 3;
                        const TILE = 50;
                        const hasNearbyFood = state.objects.some(o =>
                            o.type === 'food' &&
                            (Math.abs(o.x - mate.x) + Math.abs(o.z - mate.z)) / TILE <= wisdom
                        );
                        if (hasNearbyFood) {
                            mate.emotion = Math.min(3, mate.emotion + 1);
                        }
                        mate.state = STATES.IDLE;
                        mate.stateTimer = 60;
                        mate.reactionType = null;
                        mate.direction = Math.random() > 0.5 ? 1 : -1;
                    }
                }
                else if (action === 'stretch') {
                    // Up and down scaling over 60 frames
                    mate.scaleY = 1 + Math.sin(mate.actionTimer * 0.1) * 0.4;
                    mate.scaleX = 2 - mate.scaleY; // Maintain volume roughly
                    if (mate.actionTimer >= 60) {
                        mate.state = STATES.IDLE;
                        mate.stateTimer = 60;
                        mate.reactionType = null;
                        mate.scaleX = 1; mate.scaleY = 1;
                    }
                }
                else if (action === 'dance') {
                    // Small sway and jump over 120 frames
                    mate.rotation = Math.sin(mate.actionTimer * 0.2) * 15;
                    mate.offsetY = -Math.abs(Math.sin(mate.actionTimer * 0.4)) * 10;
                    if (mate.actionTimer % 30 === 0) mate.direction *= -1;

                    if (mate.actionTimer >= 120) {
                        mate.state = STATES.IDLE;
                        mate.stateTimer = 60;
                        mate.reactionType = null;
                        mate.rotation = 0; mate.offsetY = 0;
                    }
                }
                else if (action === 'spin') {
                    // Rolling on spot for 90 frames
                    // To look rolling without vx/vz, we just use rollingRotation
                    mate.rollingRotation = (mate.rollingRotation || 0) + 15;
                    mate.rotation = mate.rollingRotation;
                    if (mate.actionTimer >= 90) {
                        mate.state = STATES.IDLE;
                        mate.stateTimer = 60;
                        mate.reactionType = null;
                        mate.rotation = 0; mate.rollingRotation = 0;
                    }
                }
                else if (action === 'dig') {
                    // Wobble and spawn item
                    mate.rotation = Math.sin(mate.actionTimer * 0.5) * 8;
                    mate.scaleY = 0.9 + Math.abs(Math.sin(mate.actionTimer * 0.3)) * 0.1;
                    if (mate.actionTimer >= 90) {
                        const w = mate.wisdom || 3;
                        const c = mate.courage || 3;
                        const chance = Math.min(0.5, (w + c) / 20);
                        if (Math.random() < chance) {
                            const starChance = w / 5 * 0.5;
                            const type = Math.random() < starChance ? 'star' : 'cinnamon';
                            window.dispatchEvent(new CustomEvent('spawn-object', {
                                detail: {
                                    type: 'food', foodType: type,
                                    x: mate.x + (Math.random() - 0.5) * 60,
                                    z: mate.z + (Math.random() - 0.5) * 30
                                }
                            }));
                            mate.emotion = Math.max(0, mate.emotion - 1); // Cost of digging
                        }
                        mate.state = STATES.IDLE;
                        mate.stateTimer = 60;
                        mate.reactionType = null;
                        mate.rotation = 0; mate.scaleX = 1; mate.scaleY = 1;
                    }
                }
            }
            else if (mate.reactionType === 'frozen_scare') {
                mate.stateTimer++; // Using stateTimer or create new timer? actionTimer is usually used.
                mate.actionTimer++;

                // Motion: STARTLE
                MOTIONS.STARTLE.update(mate, mate.actionTimer);

                // Duration: 1 second (30 fps) -> 30 frames
                if (mate.actionTimer > 30) {
                    // Run Away Logic
                    const target = state.mates.find(m => m.id === mate.reactionTargetId);
                    if (target) {
                        const dx = mate.x - target.x;
                        const dz = mate.z - target.z;
                        const angle = Math.atan2(dz, dx); // Run away

                        const runSpeed = 4; // Fast run
                        mate.vx = Math.cos(angle) * runSpeed;
                        mate.vz = Math.sin(angle) * runSpeed;
                        mate.state = STATES.WALK;
                        mate.stateTimer = 40; // Run for ~1.3s
                        mate.isRunningAway = true;
                        mate.direction = mate.vx > 0 ? 1 : -1;
                        mate.emotion = Math.max(0, mate.emotion - 1); // Scared -> Sad/Neutral
                    } else {
                        mate.state = STATES.IDLE;
                        mate.stateTimer = 30;
                    }
                    mate.reactionType = null;
                    mate.reactionTargetId = null;
                }
            }
            else if (mate.reactionType === 'approach_mate') {
                const target = state.mates.find(m => m.id === mate.reactionTargetId);
                if (!target || target.state !== STATES.INTERACT || target.reactionTargetId !== mate.id) {
                    mate.state = STATES.IDLE;
                    mate.stateTimer = 30;
                    mate.reactionType = null;
                    mate.reactionTargetId = null;
                    mate.offsetY = 0;
                    return;
                }

                const dx = target.x - mate.x;
                const dz = target.z - mate.z;
                const dist = Math.sqrt(dx * dx + dz * dz);

                // Move closer until they are very near
                if (dist > 30) {
                    const walkSpeed = 1.5; // slow walk
                    const angle = Math.atan2(dz, dx);
                    vx = Math.cos(angle) * walkSpeed;
                    vz = Math.sin(angle) * walkSpeed;
                    mate.direction = vx > 0 ? 1 : -1;

                    // Simple walk animation effect
                    if (mate.actionTimer === undefined) mate.actionTimer = 0;
                    mate.actionTimer++;
                    mate.offsetY = -Math.abs(Math.sin(mate.actionTimer * 0.3)) * 5;
                } else {
                    // Close enough, start actual interaction
                    vx = 0; vz = 0; mate.offsetY = 0;
                    mate.reactionType = mate.nextReactionType; // Proceed to suri_suri, dance, or greet
                    mate.actionTimer = 0;

                    // 両者がポジティブなセリフを言う
                    trySpeak(mate.id, 'INTERACT', { minInterval: 1000, pan: getPan(mate) });
                    if (target) trySpeak(target.id, 'INTERACT', { minInterval: 1000, pan: getPan(target) });
                }
            }
            else if (mate.reactionType === 'suri_suri' || mate.reactionType === 'dance' || mate.reactionType === 'greet') {
                mate.actionTimer++;

                const target = state.mates.find(m => m.id === mate.reactionTargetId);

                // If target was removed, dragged, or interrupted, abort
                if (!target || target.state !== STATES.INTERACT || target.reactionTargetId !== mate.id) {
                    mate.state = STATES.IDLE;
                    mate.stateTimer = 30;
                    mate.reactionType = null;
                    mate.reactionTargetId = null;
                    mate.skewX = 0; mate.offsetY = 0;
                    return;
                }

                // Face each other tightly
                const dx = target.x - mate.x;
                mate.direction = dx > 0 ? 1 : -1;

                if (mate.reactionType === 'suri_suri') {
                    if (mate.emotion >= 2) {
                        // Rubbing animation
                        mate.skewX = Math.sin(mate.actionTimer * 0.5) * 15 * mate.direction;
                    } else {
                        // Receiving animation (happy wiggle)
                        if (mate.actionTimer % 20 < 10) {
                            mate.scaleY = 0.95;
                            mate.scaleX = 1.05;
                        } else {
                            mate.scaleY = 1.0;
                            mate.scaleX = 1.0;
                        }
                    }

                    if (mate.actionTimer === 60) { // End of interaction
                        if (mate.emotion === 0) {
                            const p = Math.min(1.0, (mate.courage || 0) / 5);
                            if (Math.random() < p) mate.emotion = Math.min(3, mate.emotion + 1);
                        } else if (mate.emotion >= 2) {
                            const p = Math.min(0.5, (mate.wisdom || 0) / 10);
                            if (Math.random() < p) mate.emotion = Math.min(3, mate.emotion + 1);
                        }
                    }
                } else if (mate.reactionType === 'dance') {
                    // Dance animation
                    mate.offsetY = -Math.abs(Math.sin(mate.actionTimer * 0.3)) * 10;
                    if (mate.actionTimer % 20 === 0) mate.direction *= -1;

                    if (mate.actionTimer === 60) {
                        // Evaluate only once per pair to keep them synchronized
                        if (mate.id < target.id) {
                            const totalCourage = (mate.courage || 0) + (target.courage || 0);
                            if (Math.random() < totalCourage * 0.10) {
                                mate.emotion = Math.min(3, mate.emotion + 1);
                                target.emotion = Math.min(3, target.emotion + 1);
                            }
                        }
                    }
                } else if (mate.reactionType === 'greet') {
                    // Fake jump animation (parabola)
                    if (mate.actionTimer < 15) {
                        mate.offsetY = -(Math.sin((mate.actionTimer / 15) * Math.PI) * 20);
                    } else {
                        mate.offsetY = 0;
                        // Happy wiggle while waiting
                        if (mate.actionTimer % 10 < 5) mate.skewX = 5;
                        else mate.skewX = -5;
                    }
                }

                // End of interaction
                let endTime = 60;
                if (mate.reactionType === 'greet') endTime = 45; // greet finishes faster

                if (mate.actionTimer >= endTime) {
                    mate.state = STATES.IDLE;
                    mate.stateTimer = 60 + Math.random() * 60;
                    mate.reactionType = null;
                    mate.reactionTargetId = null;
                    mate.skewX = 0;
                    mate.scaleX = 1;
                    mate.scaleY = 1;
                    mate.offsetY = 0;
                    mate.interactionCooldown = 180; // Reset to original 3s cooldown
                }
            }
            else if (mate.reactionType === 'thaw_friend') {
                const target = state.mates.find(m => m.id === mate.reactionTargetId);
                if (!target || !target.gameFrozen) {
                    // Target thawed or gone – stop helping
                    mate.state = STATES.IDLE;
                    mate.stateTimer = 60;
                    mate.reactionType = null;
                    mate.reactionTargetId = null;
                    mate.skewX = 0; mate.offsetY = 0;
                    vx = 0; vz = 0;
                } else {
                    mate.actionTimer++;
                    const dx = target.x - mate.x;
                    const dz = target.z - mate.z;
                    const dist = Math.sqrt(dx * dx + dz * dz);
                    if (dist > 50) {
                        // Approach
                        const spd = 2.5;
                        const angle = Math.atan2(dz, dx);
                        vx = Math.cos(angle) * spd;
                        vz = Math.sin(angle) * spd;
                        mate.direction = vx > 0 ? 1 : -1;
                        mate.offsetY = -Math.abs(Math.sin(mate.actionTimer * 0.3)) * 5;
                    } else {
                        // Rub!
                        vx = 0; vz = 0;
                        mate.direction = dx > 0 ? 1 : -1;
                        mate.skewX = Math.sin(mate.actionTimer * 0.5) * 15 * mate.direction;
                        mate.offsetY = 0;
                        if (target.bodyTemp !== undefined) {
                            target.bodyTemp = Math.min(100, target.bodyTemp + 0.4); // ×2仕事量
                        }
                    }
                }
            }
            else if (mate.targetObjectId) {
                // --- Object Interaction ---
                const obj = state.objects.find(o => o.id === mate.targetObjectId);
                if (!obj) {
                    // Target was removed (e.g. food eaten by someone else)
                    // Properly reset all walk-to-eat state to avoid infinite WALK
                    mate.state = STATES.IDLE;
                    mate.stateTimer = 30;
                    mate.targetObjectId = null;
                    mate.walkingToEat = false;
                    return;
                }
                const finished = obj.onInteractTick(mate, obj);
                // Sync local velocity variables as onInteractTick modifies the object directly
                vx = mate.vx;
                vz = mate.vz;
                vh = mate.vh; // Fix: Sync vertical velocity too (e.g. for trampoline)

                if (finished) {
                    if (obj.onInteractEnd) obj.onInteractEnd(mate, obj);
                    obj.removeInteractor(mate.id);

                    // Only force IDLE if the interaction didn't transition to another state (like JUMP)
                    if (mate.state === STATES.INTERACT) {
                        mate.state = STATES.IDLE;
                        mate.stateTimer = 60 + Math.random() * 60;
                    }

                    mate.targetObjectId = null;
                    mate.walkingToEat = false;
                    if (mate.interactionCooldown <= 0) {
                        mate.interactionCooldown = 300; // Default 5 seconds blank
                    }
                }
            } else {
                // --- Wall/Idle Interaction (formerly EDGE_STAY) ---
                vx = 0; vz = 0;
                mate.stateTimer--;
                // actionTimer is decremented once below (with guard)

                // Motion: IDLE_BREATH or IDLE_DIG
                if (mate.edgeAction === 'dig') {
                    MOTIONS.IDLE_DIG.update(mate, t);
                    const isLeftSide = x < containerWidth / 2;
                    mate.direction = isLeftSide ? 1 : -1;
                } else {
                    MOTIONS.IDLE_BREATH.update(mate, t);
                    if (mate.edgeAction === 'look_mouse') {
                        mate.direction = state.mouse.x < x ? -1 : 1;
                        mate.rotation = 0;
                    } else {
                        mate.direction = x < containerWidth / 2 ? 1 : -1;
                        mate.rotation = 0;
                    }
                }

                // Guard: actionTimer should not go below -1 to avoid phantom triggers
                if (mate.actionTimer > 0) mate.actionTimer--;
                else if (mate.actionTimer < -1) mate.actionTimer = -1;

                if (mate.actionTimer <= 0) {
                    // Check if we just finished DIGGING
                    if (mate.edgeAction === 'dig') {
                        // Digging Finished: check success
                        // courage (1-5) => success 20% - 60%
                        const courage = mate.courage || 3;
                        const findChance = 0.2 + (courage - 1) / 4 * 0.4; // 0.2 to 0.6

                        if (Math.random() < findChance) {
                            // Found something!
                            // wisdom (1-5) => star chance 10% - 50%
                            const wisdom = mate.wisdom || 3;
                            const starChance = 0.1 + (wisdom - 1) / 4 * 0.4; // 0.1 to 0.5

                            const type = Math.random() < starChance ? 'star' : 'cinnamon';

                            // Spawn nearby
                            window.dispatchEvent(new CustomEvent('spawn-object', {
                                detail: {
                                    type: 'food',
                                    foodType: type,
                                    x: mate.x + (Math.random() - 0.5) * 20,
                                    z: mate.z + (Math.random() - 0.5) * 10
                                }
                            }));

                            mate.emotion = Math.min(3, mate.emotion + 1);
                        }
                        mate.edgeAction = null; // Reset after dig attempt
                    }


                    if (mate.stateTimer <= 0) {
                        // Finish IDLE State -> Transition to WALK
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
                        // Change Action within IDLE
                        mate.actionTimer = 60 + Math.random() * 120;
                        // Decide next action: look_center or look_mouse
                        // (Dig is handled by the per-frame spontaneous trigger, not here)
                        mate.edgeAction = Math.random() < 0.5 ? 'look_center' : 'look_mouse';
                    }
                }
            }
        }
        else if (currentState === STATES.WALK) {
            mate.stateTimer--;
            if (mate.emotion === 0) {
                // Motion Selection: WALK_SHIVER vs WALK_NORMAL
                // 40% Shiver
                if (Math.random() < 0.4) {
                    MOTIONS.WALK_SHIVER.update(mate, t);
                    // Shiver includes random jitter on x/z? 
                    // Old code had x/z jitter. Motion updates transform. 
                    // We must do position jitter here or inside Motion?
                    // Motion list "update" takes mate. It can modify x/z.
                    // But usually visuals only modify scale/rot.
                    // Let's add jitter here manually if needed, or assume Motion handles it?
                    // MotionConfigs: WALK_SHIVER only does rotation.
                    // Re-add jitter here:
                    x += (Math.random() - 0.5) * 3;
                    z += (Math.random() - 0.5) * 3;
                } else {
                    MOTIONS.WALK_NORMAL.update(mate, t);
                }
            } else {
                // Emotion >= 1 (Normal base)
                let usedMotion = false;

                // Priority Check for Bouncy
                if (mate.emotion >= 3) {
                    // Check if valid?
                    // Old code: "Only bounce if skewing? ... or independent"
                    // Let's simplify: High Emotion = Bouncy Walk
                    MOTIONS.WALK_BOUNCY.update(mate, t);
                    usedMotion = true;
                }
                else if (mate.emotion >= 2 && Math.random() < 0.7) {
                    MOTIONS.WALK_SKEW.update(mate, t);
                    usedMotion = true;
                }

                if (!usedMotion) {
                    MOTIONS.WALK_NORMAL.update(mate, t);
                }
            }

            // Check for Object Interference during Walk (Interruption)
            // Skip if rolling (dekopin) or already targeting something
            if (!mate.isRolling && !mate.walkingToEat && !mate.targetObjectId && !mate.isRunningAway && state.objects.length > 0) {
                state.objects.forEach(obj => {
                    // Check conditions
                    if (obj.conditions && !obj.conditions(mate, obj)) return;

                    const interferenceRadius = (obj.radius || 30) + 50;

                    if (CollisionSystem.checkTileOverlap(x, z, obj.x, obj.z, interferenceRadius)) {
                        let chance = 0.6 + (mate.wisdom * 0.1);
                        let triggerThreshold = 0.05;

                        if (obj.type === 'candy') {
                            chance = 1.5;
                            triggerThreshold = 0.1;
                            if (mate.emotion < 2) triggerThreshold = 0.5;
                        }

                        if (Math.random() < triggerThreshold * chance) {
                            mate.targetObjectId = obj.id;

                            const walkSpeed = 2 * (mate.courage + 5) / 10;
                            const approach = calcApproachVector(x, z, obj, walkSpeed);
                            vx = approach.vx;
                            vz = approach.vz;

                            mate.direction = vx > 0 ? 1 : -1;
                            mate.walkType = 'straight';
                            mate.stateTimer = approach.stateTimer;
                            mate.walkingToEat = true;
                        }
                    }
                });
            }

            // Boundary Check
            if ((vx < 0 && x <= 20) || (vx > 0 && x >= containerWidth - 20) ||
                (vz < 0 && z <= CONSTANTS.MIN_Z) || (vz > 0 && z >= CONSTANTS.DEPTH_RANGE)) {

                mate.state = STATES.IDLE;
                mate.stateTimer = 60;
                mate.isRunningAway = false; // Reset flag
                vx = 0; vz = 0;
                z = getSnappedZ(z);
            } else if (mate.stateTimer <= 0) {
                // Reached destination
                if (mate.walkingToEat && mate.targetObjectId) {
                    const obj = state.objects.find(o => o.id === mate.targetObjectId);

                    let canInteract = false;

                    if (obj) {
                        const arrivalRadius = (obj.detectionRadius !== undefined ? obj.detectionRadius : (obj.radius || 30));

                        // Strict Tile Check for Arrival
                        if (CollisionSystem.checkTileOverlap(x, z, obj.x, obj.z, arrivalRadius)) {
                            canInteract = true;
                        }
                    }

                    // Re-check conditions (Capacity might have filled up while walking)
                    if (canInteract && obj.conditions && !obj.conditions(mate, obj)) {
                        canInteract = false;
                        // Maybe look confused?
                        mate.emotion = Math.max(0, mate.emotion - 1);
                    }

                    if (obj && canInteract) {
                        if (obj.addInteractor(mate.id)) {
                            mate.state = STATES.INTERACT;
                            mate.scaleX = 1; mate.scaleY = 1; mate.rotation = 0;

                            const dx = obj.x - x;
                            mate.direction = dx >= 0 ? 1 : -1;

                            if (obj.onInteractStart) obj.onInteractStart(mate, obj);
                        } else {
                            // Capacity Full - Abort
                            mate.state = STATES.IDLE;
                            mate.stateTimer = 60;
                            mate.walkingToEat = false;
                            mate.targetObjectId = null;
                            vx = 0; vz = 0;
                            return;
                        }
                    } else {
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

                    // GROUP LOGIC OVERRIDE
                    if (mate.groupId) {
                        // Just stop and wait. Group will command again.
                        mate.stateTimer = 30;
                    }
                }
            }

            // Always face movement direction if walking
            if (mate.state === STATES.WALK && Math.abs(vx) > 0.1) {
                mate.direction = vx > 0 ? 1 : -1;
            }
        }
    } else {
        // Airborne
        if (currentState !== STATES.DRAGGED) mate.state = STATES.JUMP;

        vh -= state.physics.gravity;
        mate.skewX = 0; mate.offsetY = 0;

        if (!mate.isRolling) {
            // Normal jump visuals
            MOTIONS.JUMP_STRETCH.update(mate, vh);
            mate.rotation = vx * 2;
        }
        // isRolling: rotation is already set by the rolling block above

        if (h > ceilingHeight) {
            h = ceilingHeight;
            vh *= -state.physics.bounce;
        }
    }

    // --- Separation Logic Removed/Disabled to prevent pushing/backwalking ---
    /*
    const separationRadius = CONSTANTS.MATE_SEPARATION || 30;
    let pushX = 0;
    let pushZ = 0;
     
    state.mates.forEach(other => {
        if (other.id === mate.id) return;
        const dx = mate.x - other.x;
        const dz = mate.z - other.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
     
        if (dist < separationRadius && dist > 0.1) {
            const force = (separationRadius - dist) / separationRadius; // 0 to 1
            const push = force * 5.0; // Stronger push
     
            pushX += (dx / dist) * push;
            pushZ += (dz / dist) * push;
        }
    });
     
    if (mate.h <= 0 && (mate.state === STATES.IDLE || mate.state === STATES.WALK)) {
        x += pushX;
        z += pushZ;
    }
    */

    // Apply Physics
    x += vx;
    z += vz;
    h += vh;

    // X Limits (Margin for Visuals)
    const margin = mate.size ? mate.size / 2 : 32;
    if (x < margin) { x = margin; vx *= -0.5; mate.direction = 1; }
    if (x > containerWidth - margin) { x = containerWidth - margin; vx *= -0.5; mate.direction = -1; }

    // Z Limits
    if (z < CONSTANTS.MIN_Z) { z = CONSTANTS.MIN_Z; vz *= -1; }
    if (z > CONSTANTS.DEPTH_RANGE) { z = CONSTANTS.DEPTH_RANGE; vz *= -1; }

    // Update Position State
    mate.x = x; mate.z = z; mate.h = h;
    mate.vx = vx; mate.vz = vz; mate.vh = vh;

    // Calculate Visuals
    const depthRatio = z / CONSTANTS.DEPTH_RANGE;
    const perspectiveScale = 1.0 - depthRatio * (1.0 - CONSTANTS.MIN_SCALE);
    const centerX = containerWidth / 2;
    const relativeX = x - centerX;
    const visualX = centerX + relativeX * perspectiveScale;
    const visualY = containerHeight - mate.size - z - h;

    mate.perspectiveScale = perspectiveScale;
    mate.screenX = visualX;
    mate.screenY = visualY;

    updateMateElement(mate);
}
