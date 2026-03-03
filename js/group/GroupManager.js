
import { state } from '../state.js';
import { CONSTANTS, STATES } from '../constants.js';
import { Group } from './Group.js';

export function updateGroups() {
    // 1. Update existing groups (and recruitment)
    // Reverse loop to allow removal
    for (let i = state.groups.length - 1; i >= 0; i--) {
        const group = state.groups[i];
        group.update(); // May remove itself (dissolve)

        // Recruitment Logic
        if (group && group.members.length >= 3 && group.members.length < 4) {
            const groupCenterX = group.center ? group.center.x : 0;
            const groupCenterZ = group.center ? group.center.z : 0;

            // Optimization: Don't check every frame
            if (Math.random() < 0.05) {
                const candidates = state.mates.filter(m => !m.groupId && m.state !== STATES.DRAGGED);
                for (const m of candidates) {
                    const dx = m.x - groupCenterX;
                    const dz = m.z - groupCenterZ;
                    const dist = Math.sqrt(dx * dx + dz * dz);

                    if (dist < CONSTANTS.GROUP_DISTANCE) {
                        // Check compatibility
                        // Children prefer other children strongly
                        // Adults care less, but maybe prefer adults?
                        // Let's implement User Request: "Children actively make groups with children"

                        // Check if group has a majority/leader child status
                        const leader = state.mates.find(x => x.id === group.leaderId);
                        const isChildGroup = leader ? leader.isChild : false;

                        // If candidate is child and group is child-led -> High Join Chance
                        // If candidate is adult and group is child-led -> Low Join Chance

                        let canJoin = true;

                        if (isChildGroup && !m.isChild) {
                            // Adult trying to join Child Group -> Very unlikely
                            canJoin = Math.random() < 0.1;
                        } else if (!isChildGroup && m.isChild) {
                            // Child trying to join Adult Group -> Possible but less likely than Child Group
                            canJoin = Math.random() < 0.5;
                        } else if (isChildGroup && m.isChild) {
                            // Child joining Child Group -> Very Likely (Boost distance check even?)
                            // Already passed distance check.
                            canJoin = true;
                        }

                        if (canJoin) {
                            group.addMember(m.id);
                            break;
                        }
                    }
                }
            }
        }
    }

    // 1.5 Group Repulsion (Avoid overlapping groups)
    const repulsionDist = 250;
    const force = 0.5; // Mild push

    for (let i = 0; i < state.groups.length; i++) {
        const g1 = state.groups[i];
        if (!g1.center || !g1.leaderId) continue;
        const l1 = state.mates.find(m => m.id === g1.leaderId);
        if (!l1) continue;

        for (let j = i + 1; j < state.groups.length; j++) {
            const g2 = state.groups[j];
            if (!g2.center || !g2.leaderId) continue;
            const l2 = state.mates.find(m => m.id === g2.leaderId);
            if (!l2) continue;

            const dx = g1.center.x - g2.center.x;
            const dz = g1.center.z - g2.center.z;
            const distSq = dx * dx + dz * dz;

            if (distSq < repulsionDist * repulsionDist && distSq > 0.1) {
                const dist = Math.sqrt(distSq);
                const push = (repulsionDist - dist) / repulsionDist;

                const fx = (dx / dist) * push * force;
                const fz = (dz / dist) * push * force;

                // Push leaders away
                l1.vx += fx;
                l1.vz += fz;
                l2.vx -= fx;
                l2.vz -= fz;
            }
        }
    }

    // 2. Form new groups
    const availableMates = state.mates.filter(m => !m.groupId && m.state !== STATES.DRAGGED && m.state !== STATES.JUMP);

    // Need at least MIN_GROUP_SIZE mates to form a group
    if (availableMates.length < CONSTANTS.MIN_GROUP_SIZE) return;

    // Checked set to avoid re-checking
    const checked = new Set();

    for (const mate of availableMates) {
        if (checked.has(mate.id)) continue;

        // Find neighbors
        const neighbors = [mate];

        for (const other of availableMates) {
            if (mate.id === other.id) continue;

            const dx = mate.x - other.x;
            const dz = mate.z - other.z;
            const dist = Math.sqrt(dx * dx + dz * dz); // Simple 2D distance

            // Distance Weighting for Group Formation
            // Children see other children as "closer" (attraction)

            let effectiveDist = dist;

            if (mate.isChild && other.isChild) {
                // Strong attraction: effectively closer
                effectiveDist = dist * 0.6;
            } else if (mate.isChild !== other.isChild) {
                // Mixed: effectively further
                effectiveDist = dist * 1.5;
            }

            if (effectiveDist < CONSTANTS.GROUP_DISTANCE) {
                neighbors.push(other);
            }
        }

        // If enough neighbors, check if they form a cohesive cluster (Star topology from 'mate')
        if (neighbors.length >= CONSTANTS.MIN_GROUP_SIZE) {
            // Check implicit connectivity? Simply taking all close to 'mate' is good enough for "clustering"

            const groupId = `group-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            const memberIds = neighbors.map(m => m.id);

            // Mark all as checked and assign groupId
            neighbors.forEach(n => {
                checked.add(n.id);
                n.groupId = groupId;
            });

            const newGroup = new Group(groupId, memberIds); // Group constructor takes IDs
            state.groups.push(newGroup);
        }

        checked.add(mate.id);
    }
}
