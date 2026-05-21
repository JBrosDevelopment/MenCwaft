import { SETTINGS } from "./settings.js";
import { INPUT_MANAGER } from "./input_manager.js";
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { BLOCK_MANAGER } from "./block_manager.js";

class Player {
    constructor(username) {
        this.username = username;
        this.position = new THREE.Vector3(8, 33, 8);
        this.rotation = new THREE.Euler(0, 0, 0, "YXZ");
        
        this.camera = new THREE.PerspectiveCamera(75, SETTINGS.ASPECT_RATIO, 0.1, SETTINGS.CLIPPING_DISTANCE);
        this.camera.rotation.order = "YXZ";
        this.camera.position.copy(this.position);
        this.blockCooldown = 0;
        this.selectedBlockIndex = 0;
        this.hotbar = new Array(9).fill(null);
    }

    update(delta, world) {
        INPUT_MANAGER.updatePosition(this.position, delta);
        INPUT_MANAGER.updateRotation(this.rotation);
        this.camera.position.copy(this.position);
        this.camera.rotation.copy(this.rotation);

        this.blockCooldown -= delta;
        if (this.blockCooldown > 0) return;
        this.blockCooldown = 0.1;

        if (INPUT_MANAGER.mouse.left) {
            this.breakBlock(world);
        }
    
        if (INPUT_MANAGER.mouse.right) {
            this.placeBlock(world);
        }

        if (INPUT_MANAGER.mouse.scrollDelta !== 0) {
            const scrollDirection = Math.sign(INPUT_MANAGER.mouse.scrollDelta);
            this.selectedBlockIndex = (this.selectedBlockIndex + scrollDirection + 9) % 9;
            INPUT_MANAGER.mouse.scrollDelta = 0;
        }
        updateHotbar(this);
    }

    setBlockinHotbar(index, blockType) {
        if (index < 0 || index > 8) return;
    
        const block = BLOCK_MANAGER.BLOCKS[blockType];
        if (!block) return;
    
        const slot = document.getElementById(`hotbar-slot-${index}`);
        if (!slot) return;
    
        const TILE_SIZE = 128;     // each tile is 128×128
        const ATLAS_SIZE = 1024;   // 8×8 tiles → 1024px atlas
        const SLOT_SIZE = 48;      // hotbar slot size
    
        const SCALE = SLOT_SIZE / TILE_SIZE; // 0.375
        const SCALED_ATLAS = ATLAS_SIZE * SCALE; // 384px
    
        const [ u, v ] = (block.unique_sides) ? block.tex.top : block.tex;

        const x = -(u * TILE_SIZE * SCALE);
        const y = -(v * TILE_SIZE * SCALE);
    
        slot.style.backgroundImage = `url('textures/${SETTINGS.TEXTURE_PACK}/blocks.png')`;
        slot.style.backgroundSize = `${SCALED_ATLAS}px ${SCALED_ATLAS}px`;
        slot.style.backgroundPosition = `${x}px ${y}px`;

        this.hotbar[index] = blockType;
    }

    breakBlock(world) {
        const target = getTargetBlock(this.camera, world.scene);
        if (!target) return;
    
        const { x, y, z } = getBlockCoords(target, false);
    
        world.setBlock(x, y, z, BLOCK_MANAGER.BLOCKS["air"]);
    }

    placeBlock(world) {
        const target = getTargetBlock(this.camera, world.scene);
        if (!target) return;
    
        const { x, y, z } = getBlockCoords(target, true);
    
        const blockType = this.hotbar[this.selectedBlockIndex];
        if (!blockType) return;
        world.setBlock(x, y, z, BLOCK_MANAGER.BLOCKS[blockType]); 
    }
    
    editHotbar(index) {
        if (index < 0 || index > 8) return;
        this.selectedBlockIndex = index;
    }
}

function getTargetBlock(camera, scene) {
    const raycaster = new THREE.Raycaster();
    raycaster.far = SETTINGS.BLOCK_REACH; // e.g. 5

    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

    const hits = raycaster.intersectObjects(scene.children, false);
    if (hits.length === 0) return null;

    const hit = hits[0];

    return {
        hit,
        point: hit.point.clone(),
        normal: hit.face.normal.clone()
    };
}

function getBlockCoords(hit, placing) {
    const p = hit.point.clone();

    if (placing) {
        p.add(hit.normal.clone().multiplyScalar(0.5));
    } else {
        p.add(hit.normal.clone().multiplyScalar(-0.5));
    }

    return {
        x: Math.floor(p.x),
        y: Math.floor(p.y),
        z: Math.floor(p.z)
    };
}

const hotbarElement = document.getElementById("hotbar");
const hotbarSlots = [];
function createHotBar() {
    for (let i = 0; i < 9; i++) {
        const slot = document.createElement("div");
        slot.className = "hotbar-slot";
        slot.id = `hotbar-slot-${i}`;
        hotbarElement.appendChild(slot);
        hotbarSlots.push(slot);
    }
}
createHotBar();

function updateHotbar(player) {
    hotbarSlots.forEach((slot, i) => {
        slot.classList.toggle("selected", i === player.selectedBlockIndex);
    });
}


export const PLAYER_MANAGER = { Player, getTargetBlock, getBlockCoords, createHotBar, updateHotbar };