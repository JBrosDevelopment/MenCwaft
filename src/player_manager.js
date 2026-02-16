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
    
        world.setBlock(x, y, z, BLOCK_MANAGER.BLOCKS["bedroc"]); 
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

export const PLAYER_MANAGER = { Player, getTargetBlock, getBlockCoords };