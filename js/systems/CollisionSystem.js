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
        const pGrid = GridSystem.toGridIndex(px, pz);
        const oGrid = GridSystem.toGridIndex(ox, oz);

        // Convert world radius to tile radius (approx)
        // Ensure at least 0 range
        const range = Math.max(0, Math.floor(worldRadius / GridSystem.TILE_SIZE));

        // Check Chebyshev distance (King's move metric) for square/tile based range
        // dx = abs(c1 - c2), dy = abs(r1 - r2)
        // if max(dx, dy) <= range, they are in range.

        const dx = Math.abs(pGrid.col - oGrid.col);
        const dy = Math.abs(pGrid.row - oGrid.row);

        return Math.max(dx, dy) <= range;
    },

    /**
     * Helper to get the tile distance between two points
     */
    getTileDistance: function (x1, z1, x2, z2) {
        const g1 = GridSystem.toGridIndex(x1, z1);
        const g2 = GridSystem.toGridIndex(x2, z2);
        return Math.max(Math.abs(g1.col - g2.col), Math.abs(g1.row - g2.row));
    }
};
