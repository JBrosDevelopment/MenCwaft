import { SETTINGS } from "./settings.js";
import { INPUT_MANAGER } from "./input_manager.js";
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { BLOCK_MANAGER } from "./block_manager.js";

class Player {
    constructor(username) {
        this.username = username;

        this.position = new THREE.Vector3(0, 0, 0);
        this.rotation = new THREE.Euler(0, 0, 0, "YXZ");
        this.velocity = new THREE.Vector3();

        this.walkSpeed = 4.317;
        this.sprintSpeed = 5.612;
        this.crouchSpeed = 1.295;

        this.jumpVelocity = 8.0;
        this.gravity = 20.0;

        this.height = 1.8;
        this.width = 0.6;
        this.crouchHeight = 1.5;

        this.isGrounded = false;
        this.isCrouching = false;

        this.isSprinting = false;
        this.lastWPressTime = 0;
        this.wWasDown = false;

        this.enablePhysics = false;

        this.camera = new THREE.PerspectiveCamera(75, SETTINGS.ASPECT_RATIO, 0.1, SETTINGS.CLIPPING_DISTANCE);
        this.camera.rotation.order = "YXZ";
        this.camera.position.copy(this.position);
        this.blockCooldown = 0;
        this.selectedBlockIndex = 0;
        this.hotbar = new Array(9).fill(null);
    }

    moveX(delta, world) {
        const newX = this.position.x + this.velocity.x * delta;

        if (!isColliding(world, newX, this.position.y, this.position.z, this.width, this.height) && this.enablePhysics) {
            if (this.isCrouching && this.isGrounded && !hasGroundBelow(world, newX, this.position.y, this.position.z, this.width)) {
                // nothing
            } else {
                this.position.x = newX;
            }
        }
    }

    moveY(delta, world) {
        const newY = this.position.y + this.velocity.y * delta;

        if (!isColliding(world, this.position.x, newY, this.position.z, this.width, this.height) && this.position.y > 0 && this.enablePhysics) {
            this.position.y = newY;
        } else {
            if (this.velocity.y < 0) {
                this.isGrounded = true;
            }

            this.velocity.y = 0;
        }
    }

    moveZ(delta, world) {
        const newZ = this.position.z + this.velocity.z * delta;
    
        if (!isColliding(world, this.position.x, this.position.y, newZ, this.width, this.height) && this.enablePhysics) {
            if (this.isCrouching && this.isGrounded && !hasGroundBelow(world, this.position.x, this.position.y, newZ, this.width)) {
                // nothing
            } else {
                this.position.z = newZ;
            }
        }
    }

    updateMovement(delta) {
        let moveX = 0;
        let moveZ = 0;
    
        if (INPUT_MANAGER.keys.w) moveZ -= 1;
        if (INPUT_MANAGER.keys.s) moveZ += 1;
        if (INPUT_MANAGER.keys.a) moveX -= 1;
        if (INPUT_MANAGER.keys.d) moveX += 1;
    
        const length = Math.hypot(moveX, moveZ);
    
        if (length > 0) {
            moveX /= length;
            moveZ /= length;
        }
    
        this.isCrouching = INPUT_MANAGER.keys.Control || INPUT_MANAGER.keys.Shift;
        
        if (INPUT_MANAGER.keys.w && !this.wWasDown) {

            if (this.lastWPressTime < 0.25) {
                this.isSprinting = true;
            }

            this.lastWPressTime = 0;
        }
        this.lastWPressTime += delta;

        if (!INPUT_MANAGER.keys.w) {
            this.isSprinting = false;
        }

        this.wWasDown = INPUT_MANAGER.keys.w;
    
        let speed = this.walkSpeed;
    
        if (this.isSprinting)
            speed = this.sprintSpeed;
    
        if (this.isCrouching)
            speed = this.crouchSpeed;
    
        const yaw = this.rotation.y;
    
        const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
        const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    
        const movement = forward.multiplyScalar(moveZ).add(right.multiplyScalar(moveX));
    
        this.velocity.x = movement.x * speed;
        this.velocity.z = movement.z * speed;
    }

    applyGravity(delta) {
        if (this.enablePhysics)
            this.velocity.y -= this.gravity * delta;
    }

    handleJump() {
        if (INPUT_MANAGER.keys.Space && this.isGrounded) {
            this.velocity.y = this.jumpVelocity;
            this.isGrounded = false;
        }
    }

    update(delta, world) {
        INPUT_MANAGER.updateRotation(this.rotation);

        if (this.position.y < -5) {
            this.position = BLOCK_MANAGER.TopPositionInWorld(-SETTINGS.SPAWN_DISTANCE, SETTINGS.SPAWN_DISTANCE, -SETTINGS.SPAWN_DISTANCE, SETTINGS.SPAWN_DISTANCE, world);
        }

        this.updateMovement(delta);
        this.handleJump();
        this.applyGravity(delta);
    
        this.moveX(delta, world);
        this.moveY(delta, world);
        this.moveZ(delta, world);
    
        const cameraHeight = this.isCrouching ? this.crouchHeight : this.height;
        this.camera.position.set(this.position.x, this.position.y + cameraHeight, this.position.z);
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
            if (this.hotbar.filter(block => block !== null).length > 0) {
                while (this.hotbar[this.selectedBlockIndex] === null) this.selectedBlockIndex = (this.selectedBlockIndex + scrollDirection + 9) % 9;
            }
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

        // Block AABB
        const blockMinX = x;
        const blockMaxX = x + 1;
        const blockMinY = y;
        const blockMaxY = y + 1;
        const blockMinZ = z;
        const blockMaxZ = z + 1;

        // Player AABB
        const playerMinX = this.position.x - this.width / 2;
        const playerMaxX = this.position.x + this.width / 2;

        const playerMinY = this.position.y;
        const playerMaxY = this.position.y + this.height;

        const playerMinZ = this.position.z - this.width / 2;
        const playerMaxZ = this.position.z + this.width / 2;

        const intersects =
            playerMinX < blockMaxX &&
            playerMaxX > blockMinX &&
            playerMinY < blockMaxY &&
            playerMaxY > blockMinY &&
            playerMinZ < blockMaxZ &&
            playerMaxZ > blockMinZ;

        if (intersects)
            return;

        world.setBlock(x, y, z, BLOCK_MANAGER.BLOCKS[blockType]); 
    }
}


function isColliding(world, x, y, z, width, height) {
    const minX = Math.floor(x - width / 2);
    const maxX = Math.floor(x + width / 2);

    const minY = Math.floor(y);
    const maxY = Math.floor(y + height);

    const minZ = Math.floor(z - width / 2);
    const maxZ = Math.floor(z + width / 2);

    for (let bx = minX; bx <= maxX; bx++) {
        for (let by = minY; by <= maxY; by++) {
            for (let bz = minZ; bz <= maxZ; bz++) {

                const block = world.getBlock(bx, by, bz);

                if (block.id !== 0) {
                    return true;
                }
            }
        }
    }

    return false;
} 

function hasGroundBelow(world, x, y, z, width) {

    const halfWidth = width / 2;

    const points = [
        [x - halfWidth, z - halfWidth],
        [x + halfWidth, z - halfWidth],
        [x - halfWidth, z + halfWidth],
        [x + halfWidth, z + halfWidth],
    ];

    for (const [px, pz] of points) {

        const block = world.getBlock(
            Math.floor(px),
            Math.floor(y - 0.1),
            Math.floor(pz)
        );

        if (block.id !== 0) {
            return true;
        }
    }

    return false;
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