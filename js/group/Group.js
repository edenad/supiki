
import { state } from '../state.js';
import { container } from '../dom.js';
import { CONSTANTS, STATES } from '../constants.js';

export class Group {
    constructor(id, members) {
        this.id = id;
        this.members = members; // Array of IDs
        this.leaderId = null;
        this.state = STATES.IDLE;

        // Target for the group
        this.targetX = 0;
        this.targetZ = 0;
        this.center = { x: 0, z: 0 };

        // Timer for decisions
        this.decisionTimer = 0;
        this.lifetimeFrames = 3600 + Math.random() * 7200; // 60s ~ 180s

        // Visual Debug
        this.debugDot = document.createElement('div');
        let debugClass = 'debug-zone absolute bg-red-500 rounded-full z-10 pointer-events-none opacity-80';
        if (!state.ui.showDebugZones) {
            debugClass += ' hidden';
        }
        this.debugDot.className = debugClass;
        this.debugDot.style.width = '16px';
        this.debugDot.style.height = '16px';
        this.debugDot.style.border = '2px solid white';
        this.debugDot.style.color = 'white';
        this.debugDot.style.fontSize = '10px';
        this.debugDot.style.display = 'flex';
        this.debugDot.style.justifyContent = 'center';
        this.debugDot.style.alignItems = 'center';
        this.debugDot.style.boxShadow = '0 0 10px red';

        if (container) container.appendChild(this.debugDot);

        this.recalculateLeader();
    }

    recalculateLeader() {
        // Valid Members are filtered at start of update or here?
        // Let's filter here just in case.
        const validMates = this.members
            .map(id => state.mates.find(m => m.id === id))
            .filter(m => m);

        if (validMates.length === 0) return;

        // Separate Adults and Children
        const adults = validMates.filter(m => !m.isChild);
        const children = validMates.filter(m => m.isChild);

        let candidates = [];

        // Priority: Adults
        if (adults.length > 0) {
            // Find max courage among Adults
            const maxCourage = Math.max(...adults.map(m => m.courage));
            candidates = adults.filter(m => m.courage === maxCourage);
        } else {
            // Only Children in group
            // Find max courage among Children
            const maxCourage = Math.max(...children.map(m => m.courage));
            candidates = children.filter(m => m.courage === maxCourage);
        }

        if (candidates.length === 0) return; // Should not happen if validMates > 0

        // Randomly pick one from candidates
        const leader = candidates[Math.floor(Math.random() * candidates.length)];
        this.leaderId = leader.id;
        console.log(`[Group ${this.id}] New Leader: ${this.leaderId} (Courage: ${leader.courage}, Child: ${leader.isChild})`);
    }

    update() {
        if (!container) return;

        // 1. Validate Members & Calculate Center
        let sumX = 0;
        let sumZ = 0;
        const validMembers = [];
        let leaderExists = false;

        this.members.forEach(id => {
            const m = state.mates.find(x => x.id === id);
            // Check existence and state (dragged mates are temporarily ignored or removed?)
            // If dragged, maybe keep in group but don't count for center?
            // User requirement: "If separated by certain distance, remove". Dragging usually separates.
            if (m) {
                validMembers.push(m);
                sumX += m.x;
                sumZ += m.z;
                if (m.id === this.leaderId) leaderExists = true;
            }
        });

        // Calculate Center
        const memberCount = validMembers.length;
        if (memberCount === 0) {
            this.dissolve();
            return;
        }

        const centerX = sumX / memberCount;
        const centerZ = sumZ / memberCount;

        // 2. Pruning (Distance Check)
        const keptMemberIds = [];
        validMembers.forEach(m => {
            const dx = m.x - centerX;
            const dz = m.z - centerZ;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist > CONSTANTS.GROUP_MAX_RADIUS) {
                // Kick
                m.groupId = null;
                console.log(`[Group ${this.id}] Kicked ${m.id} (Distance: ${dist.toFixed(0)})`);
            } else {
                keptMemberIds.push(m.id);
            }
        });

        this.members = keptMemberIds;

        // 3. Dissolution Check
        if (this.members.length < 3) { // User: "2 bodies or less -> dissolve" (so < 3)
            this.dissolve();
            return;
        }

        // 4. Leader Check
        // If leader was kicked or didn't exist
        if (!this.members.includes(this.leaderId) || !leaderExists) {
            this.recalculateLeader();
        }

        const leader = state.mates.find(m => m.id === this.leaderId);
        if (!leader) return; // Safety

        // Update Visual Debug
        this.debugDot.innerText = `L:${leader.courage}`; // Show Leader Courage
        const containerHeight = container.clientHeight;
        const containerWidth = container.clientWidth;
        const wCenterX = containerWidth / 2;
        const depthRatio = centerZ / CONSTANTS.DEPTH_RANGE;
        const scale = 1.0 - depthRatio * (1.0 - CONSTANTS.MIN_SCALE);
        const relativeX = centerX - wCenterX;
        const visualX = wCenterX + relativeX * scale;
        const visualY = containerHeight - centerZ;
        this.debugDot.style.left = `${visualX - 8}px`;
        this.debugDot.style.top = `${visualY - 8}px`;
        this.debugDot.style.zIndex = Math.floor(visualY + 100);


        // 5. State & Movement Logic
        this.decisionTimer--;
        this.lifetimeFrames--;
        if (this.lifetimeFrames <= 0) {
            this.dissolve();
            return;
        }

        // Sync Group State -> Leader State (Leader drives the group)
        // Actually Group drives the Leader, Leader drives the followers

        if (this.state === STATES.IDLE) {
            if (this.decisionTimer <= 0) {
                // Decide next move
                if (Math.random() < 0.7) {
                    this.state = STATES.WALK;
                    this.targetX = Math.random() * containerWidth;
                    this.targetZ = CONSTANTS.MIN_Z + Math.random() * (CONSTANTS.DEPTH_RANGE - CONSTANTS.MIN_Z);
                    this.decisionTimer = 300; // time limit

                    // Command Leader
                    leader.state = STATES.WALK;
                    leader.walkType = 'straight';

                    const dx = this.targetX - leader.x;
                    const dz = this.targetZ - leader.z;
                    const dist = Math.sqrt(dx * dx + dz * dz);
                    const speed = 2 * (leader.courage + 5) / 10;

                    leader.vx = (dx / dist) * speed;
                    leader.vz = (dz / dist) * speed;
                    leader.direction = leader.vx > 0 ? 1 : -1;
                    leader.stateTimer = dist / speed; // Leader sets the pace

                } else {
                    this.decisionTimer = 60 + Math.random() * 60;

                    // Maintain Formation even when IDLE
                    // 0: Leader
                    // 1: Left (-X, -Z)
                    // 2: Right (+X, -Z)
                    // 3: Back (0, -2Z)

                    // Direction based on last movement or default
                    let vx = leader.direction || 1;
                    let vz = 0;

                    // Perpendicular Vector (Right)
                    const rx = -vz;
                    const rz = vx;

                    const SPACING_DEPTH = 30;
                    const SPACING_WIDTH = 30;

                    // Show/Hide Debug Dot based on global setting
                    this.debugDot.style.display = state.ui.showDebugZones ? 'flex' : 'none';

                    const followers = this.members.filter(id => id !== this.leaderId);

                    followers.forEach((id, index) => {
                        const m = state.mates.find(x => x.id === id);
                        if (!m || m.state !== STATES.IDLE) return; // Only adjust if IDLE

                        // Assign Slot
                        let offSideways = 0;
                        let offBackward = 0;

                        if (followers.length === 1) {
                            offBackward = SPACING_DEPTH;
                        } else if (followers.length === 2) {
                            if (index === 0) { offSideways = -SPACING_WIDTH; offBackward = SPACING_DEPTH; }
                            else { offSideways = SPACING_WIDTH; offBackward = SPACING_DEPTH; }
                        } else {
                            if (index === 0) { offSideways = -SPACING_WIDTH; offBackward = SPACING_DEPTH; }
                            else if (index === 1) { offSideways = SPACING_WIDTH; offBackward = SPACING_DEPTH; }
                            else { offBackward = SPACING_DEPTH * 2; }
                        }

                        // Target Position relative to leader
                        const targetX = leader.x - (vx * offBackward) + (rx * offSideways);
                        const targetZ = leader.z - (vz * offBackward) + (rz * offSideways);

                        // Slowly drift to formation if far
                        const dx = targetX - m.x;
                        const dz = targetZ - m.z;
                        const dist = Math.sqrt(dx * dx + dz * dz);

                        if (dist > 10) {
                            m.x += dx * 0.01;
                            m.z += dz * 0.01;
                        }
                    });
                }
            }
        }
        else if (this.state === STATES.WALK) {

            // Check Leader progress
            if (leader.state !== STATES.WALK) {
                // Leader stopped (reached dest or interrupted)
                this.state = STATES.IDLE;
                this.decisionTimer = 60;
            } else {
                // Leader is walking. Direct Followers.

                // --- Diamond Formation Logic ---
                // Calculate Base Vectors based on Leader Velocity
                let vx = leader.vx;
                let vz = leader.vz;
                const speed = Math.sqrt(vx * vx + vz * vz);

                if (speed < 0.1) {
                    vx = leader.direction || 1;
                    vz = 0;
                } else {
                    vx /= speed;
                    vz /= speed;
                }

                // Perpendicular Vector (Right)
                const rx = -vz;
                const rz = vx;

                const SPACING_DEPTH = 30;
                const SPACING_WIDTH = 30;

                const followers = this.members.filter(id => id !== this.leaderId);

                // Show/Hide Debug Dot based on global setting (once, outside loop)
                this.debugDot.style.display = state.ui.showDebugZones ? 'flex' : 'none';

                followers.forEach((id, index) => {
                    const m = state.mates.find(x => x.id === id);

                    if (!m ||
                        m.state === STATES.DRAGGED ||
                        m.state === STATES.INTERACT ||
                        m.state === STATES.EAT ||
                        m.targetObjectId ||
                        m.walkingToEat
                    ) return;

                    m.state = STATES.WALK;
                    m.walkType = 'straight';

                    // Assign Slot
                    let offSideways = 0;
                    let offBackward = 0;

                    if (followers.length === 1) {
                        offBackward = SPACING_DEPTH;
                    } else if (followers.length === 2) {
                        if (index === 0) { offSideways = -SPACING_WIDTH; offBackward = SPACING_DEPTH; }
                        else { offSideways = SPACING_WIDTH; offBackward = SPACING_DEPTH; }
                    } else {
                        if (index === 0) { offSideways = -SPACING_WIDTH; offBackward = SPACING_DEPTH; }
                        else if (index === 1) { offSideways = SPACING_WIDTH; offBackward = SPACING_DEPTH; }
                        else { offBackward = SPACING_DEPTH * 2; }
                    }

                    const targetX = leader.x - (vx * offBackward) + (rx * offSideways);
                    const targetZ = leader.z - (vz * offBackward) + (rz * offSideways);

                    const dx = targetX - m.x;
                    const dz = targetZ - m.z;
                    const dist = Math.sqrt(dx * dx + dz * dz);

                    if (dist > 10) {
                        const leaderSpeed = Math.max(speed, 2.0);
                        const catchupSpeed = leaderSpeed * 1.2;
                        const finalSpeed = Math.min(catchupSpeed, 4.0);

                        m.vx = (dx / dist) * finalSpeed;
                        m.vz = (dz / dist) * finalSpeed;
                    } else {
                        m.vx = leader.vx;
                        m.vz = leader.vz;
                    }

                    if (Math.abs(m.vx) > 0.1) {
                        m.direction = m.vx > 0 ? 1 : -1;
                    }

                    m.stateTimer = 10;
                });
            }
        }
    }

    addMember(mateId) {
        if (!this.members.includes(mateId)) {
            this.members.push(mateId);
            const m = state.mates.find(x => x.id === mateId);
            if (m) m.groupId = this.id;
        }
    }

    dissolve() {
        if (this.debugDot) this.debugDot.remove();
        // Clear groupId from members
        this.members.forEach(id => {
            const m = state.mates.find(x => x.id === id);
            if (m && m.groupId === this.id) m.groupId = null;
        });
        // Remove from global list
        const idx = state.groups.findIndex(g => g.id === this.id);
        if (idx > -1) state.groups.splice(idx, 1);
        console.log(`[Group ${this.id}] Dissolved`);
    }
}
