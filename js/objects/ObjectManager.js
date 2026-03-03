import { state } from '../state.js';
import { InteractableObject } from './InteractableObject.js';
import { Pond } from './Pond.js';
import { CollisionSystem } from '../systems/CollisionSystem.js';

export function spawnObject(config, x, z) {
    const id = `obj-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    let obj;

    // Check for overlap and find free tile
    const TILE = 50;
    let spawnX = x;
    let spawnZ = z;

    const isOccupied = (tx, tz) => {
        return state.objects.some(o => CollisionSystem.getTileDistance(tx, tz, o.x, o.z) === 0);
    };

    if (isOccupied(spawnX, spawnZ)) {
        let found = false;
        // Search spiral 5 radius
        for (let r = 1; r <= 5; r++) {
            for (let dx = -r; dx <= r; dx++) {
                for (let dz = -r; dz <= r; dz++) {
                    // Only check edge of square ring to avoid re-checking inner
                    if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;

                    const testX = x + dx * TILE;
                    const testZ = z + dz * TILE;

                    // Bounds Check
                    // Helper or direct check?
                    // Limits: ~0 to containerWidth?
                    // We don't have container width here easily, but we know negative is bad.
                    if (testX < 0 || testZ < 0) continue;
                    // Max? Let's assume 2000 or similar if needed, but mostly negative is the "ghost block" issue (behind camera?).
                    // Actually, Z < MIN_Z (0) is bad.

                    if (!isOccupied(testX, testZ)) {
                        spawnX = testX;
                        spawnZ = testZ;
                        found = true;
                        break;
                    }
                }
                if (found) break;
            }
            if (found) break;
        }
        if (!found) {
            console.warn("No free space for object spawn.");
            return null;
        }
    }

    // Create a local copy of config to allow per-instance modification
    const localConfig = { ...config };

    // --- FOOD Variant Logic ---
    if (localConfig.type === 'food') {
        // If specific foodType is requested, respect it
        if (!localConfig.foodType || localConfig.foodType === 'random') {
            const rand = Math.random();
            if (rand < 0.2) {
                // Star Candy (High Value)
                localConfig.src = "pictures/objects/food_star.png";
                localConfig.foodType = 'star';
                localConfig.foodValue = 3;
            } else if (rand < 0.8) {
                // Cinnamon (Normal) - Renamed from Candy
                localConfig.src = "pictures/objects/food_cinnamon.png";
                localConfig.foodType = 'cinnamon';
                localConfig.foodValue = 2;
            } else {
                // Bad Food (Food 7) - Like Spikey
                localConfig.src = "pictures/objects/food_bad.png";
                localConfig.foodType = 'bad';
                localConfig.foodValue = -1;
            }
        } else if (localConfig.foodType === 'cinnamon') {
            localConfig.src = "pictures/objects/food_cinnamon.png";
            localConfig.foodValue = 2;
        } else if (localConfig.foodType === 'star') {
            localConfig.src = "pictures/objects/food_star.png";
            localConfig.foodValue = 3;
        } else if (localConfig.foodType === 'bad') {
            localConfig.src = "pictures/objects/food_bad.png";
            localConfig.foodValue = -1;
        }
    }

    // Factory Logic
    if (localConfig.type === 'pond') {
        obj = new Pond(id, spawnX, spawnZ);
    } else {
        obj = new InteractableObject(id, spawnX, spawnZ, localConfig);
    }

    // Assign extra props if InteractableObject didn't copy them all
    if (localConfig.type === 'food') {
        obj.foodType = localConfig.foodType;
        obj.foodValue = localConfig.foodValue;
    }

    // Initial amount (if simple consumable)
    obj.amount = localConfig.amount || 5;

    state.objects.push(obj);
    return obj;
}

export function removeObject(id) {
    const idx = state.objects.findIndex(o => o.id === id);
    if (idx > -1) {
        state.objects[idx].remove(); // Call class method
        state.objects.splice(idx, 1);
    }
}

// Global exposure
window.removeObject = removeObject;
window.addEventListener('remove-object', (e) => {
    if (e.detail && e.detail.id) {
        removeObject(e.detail.id);
    }
});

// Spawn Object Event Listener
window.addEventListener('spawn-object', (e) => {
    if (e.detail) {
        // Support detail as config object directly OR as { config: ... } wrapper
        // If e.detail has 'type', treat it as config.
        let config = e.detail.config || e.detail;

        // Ensure type exists
        if (!config.type) config = { type: 'food' }; // Default?

        const x = e.detail.x !== undefined ? e.detail.x : (state.camera ? state.camera.x : 0);
        const z = e.detail.z !== undefined ? e.detail.z : (state.camera ? state.camera.z : 0);

        spawnObject(config, x, z);
    }
});
