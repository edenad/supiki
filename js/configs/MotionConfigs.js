export const MOTIONS = {
    // --- Locomotion ---
    WALK_NORMAL: {
        name: 'Walk (Normal)',
        description: 'Standard walking with slight vertical bobbing',
        update: (mate, t) => {
            mate.scaleY = 1 + Math.sin(t * 10) * 0.05;
            mate.scaleX = 1 - Math.sin(t * 10) * 0.02;
            mate.rotation = 0; mate.skewX = 0;
        }
    },
    WALK_SHIVER: {
        name: 'Walk (Shiver)',
        description: 'Trembling walk for low emotion/fear',
        update: (mate, t) => {
            mate.rotation = (Math.random() - 0.5) * 10;
            // Position jitter handling remains in update logic, this is body transform
            mate.scaleX = 1; mate.scaleY = 1;
        }
    },
    WALK_SKEW: {
        name: 'Walk (Head Tilt)',
        description: 'Lively walk with head tilting/skewing',
        update: (mate, t) => {
            const animFreq = 2.5;
            const phase = t * animFreq + mate.animPhase;
            const cycle = Math.sin(phase);
            mate.skewX = cycle * 25 * mate.direction;
            mate.scaleX = 1; mate.scaleY = 1; mate.rotation = 0;
        }
    },
    WALK_BOUNCY: {
        name: 'Walk (Bouncy)',
        description: 'High emotion bouncy walk',
        update: (mate, t) => {
            const animFreq = 2.5;
            const phase = t * animFreq + mate.animPhase;
            const cycle = Math.sin(phase);
            // Sync skew with bounce
            mate.skewX = cycle * 25 * mate.direction;

            const stretch = Math.abs(cycle);
            mate.scaleY = 1.0 + (stretch * 0.3);
            mate.scaleX = 1.0 - (stretch * 0.15);
            mate.rotation = 0;
        }
    },

    // --- Idle / Ambient ---
    IDLE_BREATH: {
        name: 'Idle (Breath)',
        description: 'Gentle breathing animation',
        update: (mate, t) => {
            const breath = Math.sin(t * 0.1 + mate.animPhase);
            mate.scaleY = 1 + breath * 0.02;
            mate.scaleX = 1 - breath * 0.01;
            mate.skewX = 0; // Reset skew
            mate.rotation = 0; // Reset rotation (unless handled elsewhere)
        }
    },
    IDLE_DIG: {
        name: 'Dig',
        description: 'Digging animation with rotation and squash',
        update: (mate, t) => {
            const digCycle = Math.sin(t * 15);
            mate.scaleY = 0.9 + digCycle * 0.1;
            mate.scaleX = 1.1 - digCycle * 0.05;
            const baseAngle = mate.digAngle || 45;
            mate.rotation = (mate.direction === 1 ? baseAngle : -baseAngle) + digCycle * 5;
        }
    },

    // --- Actions / Interactions ---
    EAT: {
        name: 'Eat',
        description: 'Generic eating/chewing animation',
        update: (mate, t) => {
            // t here assumes frame counter or time
            const chew = Math.sin(t * 0.8) * 0.1;
            mate.scaleY = 1.0 - chew;
            mate.scaleX = 1.0 + chew * 0.5;
            mate.rotation = Math.sin(t * 0.2) * 2;
        }
    },
    CROUCH: {
        name: 'Crouch',
        description: 'Preparing to jump',
        update: (mate, progress) => {
            // Progress 0.0 to 1.0
            mate.scaleY = 1 - progress * 0.4;
            mate.scaleX = 1 + progress * 0.2;
        }
    },
    JUMP_STRETCH: {
        name: 'Jump Stretch',
        description: 'Stretching while in air',
        update: (mate, velocityY) => {
            const stretch = Math.min(Math.abs(velocityY) * 0.05, 0.4);
            mate.scaleY = 1 + stretch;
            mate.scaleX = 1 - (stretch * 0.5);
        }
    },
    HAPPY_BOUNCE: {
        name: 'Happy Bounce',
        description: 'Excited bounce (Pumpkin)',
        update: (mate, t) => {
            // t = frame counter
            mate.offsetY = -Math.abs(Math.sin(t * 0.2)) * 10;
            mate.rotation = Math.sin(t * 0.1) * 10;
        }
    },
    FREEZE: {
        name: 'Freeze',
        description: 'Completely static frozen state',
        update: (mate, t) => {
            mate.vx = 0; mate.vz = 0;
            mate.rotation = 0;
            mate.skewX = 0;
            mate.scaleX = 1; mate.scaleY = 1;
        }
    },
    SPIN_RAPID: {
        name: 'Spin Rapid',
        description: 'Rapid spinning (Vending Machine)',
        update: (mate, t) => {
            mate.rotation += 30; // Accumulative
        }
    },

    FLOAT: {
        name: 'Float',
        description: 'Bobbing in water (Pond)',
        update: (mate, t) => {
            // Puka Puka
            mate.offsetY = Math.sin(t * 2 + mate.id) * 6 - 8;
        }
    },
    STARTLE: {
        name: 'Startle',
        description: 'Shock/Fear reaction (Spikey)',
        update: (mate, t) => {
            mate.scaleY = 1.2;
            mate.scaleX = 0.9;
            mate.skewX = 10 * mate.direction;
        }
    },
    DROWN: {
        name: 'Drown',
        description: 'Struggling in water',
        update: (mate, t) => {
            // Rapid bobbing
            mate.offsetY = Math.sin(t * 0.5) * 10;
            // Panic rotation
            mate.rotation = Math.sin(t * 0.8) * 15;
            // Flailing scale
            mate.scaleX = 1.0 + Math.sin(t * 1.2) * 0.1;
            mate.scaleY = 1.0 + Math.cos(t * 1.2) * 0.1;
        }
    }
};
