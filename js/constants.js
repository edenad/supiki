
export const STATES = {
    IDLE: 'IDLE',
    WALK: 'WALK',
    JUMP: 'JUMP',
    DRAGGED: 'DRAGGED',
    INTERACT: 'INTERACT',
    EAT: 'EAT' // It was used in line 721 but not defined in STATES originally? Line 721 checks for STATES.EAT but line 10-15 only lists 5 states. I should check line 721 carefully. Ah, line 721: "if (mate.state === STATES.INTERACT || mate.state === STATES.EAT)". If EAT is missing in STATES, it would be undefined. Let's add it cleanly or check consumption.
};

export const CONSTANTS = {
    DEPTH_RANGE: 250, // 5 Tiles * 50
    MIN_Z: 0, // Allow full range (was 20)
    MIN_SCALE: 0.7,
    Z_LAYERS: 6,
    DEFAULT_SIZE: 64,
    OBJECT_REACTION_RADIUS: 50,
    OBJECT_INTERFERENCE_RADIUS: 150,
    GROUP_DISTANCE: 150,    // Distance to be considered part of a cluster
    MIN_GROUP_SIZE: 3,      // Minimum mates to form a group
    GROUP_COHESION: 0.05,   // Force to stay together
    GROUP_MAX_RADIUS: 250,  // Distance from center to be kicked
    MATE_SEPARATION: 30,    // Minimum distance between mates
    TILE_SIZE: 50           // Size of ground tiles
};

export const IMAGES = {
    SAD: './pictures/スピキ基本涙目ωワ.png',      // Something sad happened (Drag/Throw)
    NEUTRAL_BAD: './pictures/スピキ基本o.png',     // Neutral but slightly bad
    NEUTRAL_GOOD: './pictures/スピキ笑顔ωワ.png',   // Default / Neutral good
    HAPPY: './pictures/スピキ＞＜へωワ.png',        // Something happy happened
    CANDY: 'img/candy.png',
    TRAMPOLINE: 'img/trampoline.png',
    SPIKEY: 'img/spikey.png',
    POND: './pictures/objects/mizutamari.png',
    UKIWA_FRONT: './pictures/objects/ukiwa_front.png',
    ICE: './pictures/objects/ice.png'
};
