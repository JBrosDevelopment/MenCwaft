const ASPECT_RATIO = 1920 / 1080;

let width = window.innerWidth;
let height = window.innerHeight;

if (width / height > ASPECT_RATIO) {
    width = height * ASPECT_RATIO;
} else {
    height = width / ASPECT_RATIO;
}

export const SETTINGS = {
    ASPECT_RATIO,
    WIDTH: Math.floor(width),
    HEIGHT: Math.floor(height),
    LOCKED_IN: false,
    MOVE_SPEED: 10,
    SHIFT_MODIFIER: 1.5,
    MOUSE_SENSITIVITY: 0.004,
    TEXTURE_PACK: "default",
    RENDER_DISTANCE: 5, 
    CLIPPING_DISTANCE: 250,
    FOG_NEAR: 10,
    FOG_FAR: 250,
    DAY_SPEED: 0.01, 
    BLOCK_REACH: 5,
    TILE_SIZE: 128,
    SEED: 12345,
}