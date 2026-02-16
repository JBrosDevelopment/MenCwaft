import { SETTINGS } from "./settings.js";
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

const keys = {
    w: false,
    s: false,
    a: false,
    d: false,
    Space: false,
    Shift: false,
    Control: false,
    Escape: false,
    Enter: false
};

const mouse = {
    left: false,
    right: false,
    middle: false
}

let yaw = 0;
let pitch = 0;
  
window.addEventListener("keydown", (e) => {
    if (e.key in keys) keys[e.key] = true;
    if (e.key === " ") keys.Space = true;

    if (e.key === "Escape" && SETTINGS.LOCKED_IN) {
        SETTINGS.LOCKED_IN = false;
        document.exitPointerLock();
    }

    if (e.ctrlKey || e.metaKey) {
        const blockedKeys = ['s', 'p', 'w', 'r', 'a', 't']; 
        if (blockedKeys.includes(e.key.toLowerCase())) {
            e.stopPropagation();
            e.preventDefault(); // Stop default browser action
        }
    }
});
  
window.addEventListener("keyup", (e) => {
    if (e.key in keys) keys[e.key] = false;
    if (e.key === " ") keys.Space = false;
});

document.addEventListener("click", () => {
    if (!SETTINGS.LOCKED_IN) {
        SETTINGS.LOCKED_IN = true;
        document.body.requestPointerLock();
    }
});

document.addEventListener("mousedown", (e) => {
    if (!SETTINGS.LOCKED_IN) {
        SETTINGS.LOCKED_IN = true;
        document.body.requestPointerLock();
    }

    if (e.button === 0) mouse.left = true;
    if (e.button === 1) mouse.middle = true;
    if (e.button === 2) mouse.right = true;
});

document.addEventListener("mouseup", (e) => {
    if (e.button === 0) mouse.left = false;
    if (e.button === 1) mouse.middle = false;
    if (e.button === 2) mouse.right = false;
});

document.addEventListener("mousemove", (event) => {
    if (!SETTINGS.LOCKED_IN) return;

    yaw  -= event.movementX * SETTINGS.MOUSE_SENSITIVITY;
    pitch -= event.movementY * SETTINGS.MOUSE_SENSITIVITY;
    
    pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));
});

function isKeyPressed(key) {
    return keys[key] || false;
}

function updatePosition(position, delta) {
    let speed = SETTINGS.MOVE_SPEED * delta;
    if (keys.Shift) {
        speed *= SETTINGS.SHIFT_MODIFIER;
    }

    // Local movement direction
    const direction = new THREE.Vector3(0, 0, 0);

    if (keys.w) direction.z -= 1;
    if (keys.s) direction.z += 1;
    if (keys.a) direction.x -= 1;
    if (keys.d) direction.x += 1;

    // Vertical movement (world up)
    if (keys.Space) direction.y += 1;
    if (keys.Control) direction.y -= 1;

    if (direction.lengthSq() === 0) return;

    direction.normalize();

    const yawRotation = new THREE.Euler(0, yaw, 0, "YXZ");
    direction.applyEuler(yawRotation);

    direction.multiplyScalar(speed);
    position.add(direction);
}

function updateRotation(rotation) {
    rotation.y = yaw;
    rotation.x = pitch;
}

export const INPUT_MANAGER = {
    keys,
    mouse,
    yaw,
    pitch,
    isKeyPressed,
    updatePosition,
    updateRotation
};