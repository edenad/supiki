import { CONSTANTS } from './constants.js';

export function getScale(z) {
    if (z < CONSTANTS.MIN_Z) z = CONSTANTS.MIN_Z;
    if (z > CONSTANTS.DEPTH_RANGE) z = CONSTANTS.DEPTH_RANGE;
    // Linear interpolation for scale from 1.0 (front) to MIN_SCALE (back)
    const distinctness = (z - CONSTANTS.MIN_Z) / (CONSTANTS.DEPTH_RANGE - CONSTANTS.MIN_Z);
    return 1.0 - distinctness * (1.0 - CONSTANTS.MIN_SCALE);
}

export function getSnappedZ(z) {
    if (z < CONSTANTS.MIN_Z) z = CONSTANTS.MIN_Z;
    if (z > CONSTANTS.DEPTH_RANGE) z = CONSTANTS.DEPTH_RANGE;

    const range = CONSTANTS.DEPTH_RANGE - CONSTANTS.MIN_Z;
    const layerHeight = range / (CONSTANTS.Z_LAYERS - 1);
    const layerIndex = Math.round((z - CONSTANTS.MIN_Z) / layerHeight);

    return CONSTANTS.MIN_Z + layerIndex * layerHeight;
}
