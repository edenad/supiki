import { GridSystem } from './GridSystem.js';

/**
 * Checks if two entities are within a certain tile distance.
 * This replaces the elliptical distance check with a discrete grid-based manhattan or chebyshev distance.
 * However, the user asked for "mask-based" (tile-based) collision.
 * 
 * We assume entities occupy the tile they are currently in.
 * Range checks should be: "Is entity A's tile within N tiles of entity B's tile?"
 */
export const CollisionSystem = {

    /**
     * Checks if a point (px, pz) is within `radius` tiles of an object at (ox, oz).
     * The objects are anchored at grid centers.
     * The `radius` is now interpreted as "number of tiles".
     * 
     * @param {number} px Point X (World)
     * @param {number} pz Point Z (World)
     * @param {number} ox Object X (World)
     * @param {number} oz Object Z (World)
     * @param {number} tileRadius Radius in TILES (default 1 means adjacent inclusive?)
     *                            If radius is 50px, tile size 50, radius is 1 tile.
     * @returns {boolean}
     */
    checkTileOverlap: function (px, pz, ox, oz, worldRadius) {
        // Convert world radius to tile radius (approx)
        const range = Math.max(0, Math.floor(worldRadius / GridSystem.TILE_SIZE));
        const pCol = Math.floor(px / GridSystem.TILE_SIZE);
        const pRow = Math.floor(pz / GridSystem.TILE_SIZE);
        const oCol = Math.floor(ox / GridSystem.TILE_SIZE);
        const oRow = Math.floor(oz / GridSystem.TILE_SIZE);

        const dx = Math.abs(pCol - oCol);
        const dy = Math.abs(pRow - oRow);

        return Math.max(dx, dy) <= range;
    },

    /**
     * Helper to get the tile distance between two points
     */
    getTileDistance: function (x1, z1, x2, z2) {
        const c1 = Math.floor(x1 / GridSystem.TILE_SIZE);
        const r1 = Math.floor(z1 / GridSystem.TILE_SIZE);
        const c2 = Math.floor(x2 / GridSystem.TILE_SIZE);
        const r2 = Math.floor(z2 / GridSystem.TILE_SIZE);
        return Math.max(Math.abs(c1 - c2), Math.abs(r1 - r2));
    }
};
