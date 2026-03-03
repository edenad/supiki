import { CONSTANTS } from '../constants.js';

export const GridSystem = {
    TILE_SIZE: CONSTANTS.TILE_SIZE || 50,

    /**
     * Snaps a world coordinate to the nearest grid center.
     * @param {number} val - The coordinate value (x or z)
     * @returns {number} - The snapped coordinate
     */
    snap: function (val) {
        return Math.floor(val / this.TILE_SIZE) * this.TILE_SIZE + this.TILE_SIZE / 2;
    },

    /**
     * Snaps x and z to grid centers.
     * @param {number} x 
     * @param {number} z 
     * @returns {{x: number, z: number}}
     */
    snapPosition: function (x, z) {
        return {
            x: this.snap(x),
            z: this.snap(z)
        };
    },

    /**
     * Converts world coordinates to grid indices (col, row).
     * @param {number} x
     * @param {number} z
     * @returns {{col: number, row: number}}
     */
    toGridIndex: function (x, z) {
        return {
            col: Math.floor(x / this.TILE_SIZE),
            row: Math.floor(z / this.TILE_SIZE)
        };
    },

    /**
     * Converts grid indices to world center coordinates.
     * @param {number} col
     * @param {number} row
     * @returns {{x: number, z: number}}
     */
    fromGridIndex: function (col, row) {
        return {
            x: col * this.TILE_SIZE + this.TILE_SIZE / 2,
            z: row * this.TILE_SIZE + this.TILE_SIZE / 2
        };
    }
};
