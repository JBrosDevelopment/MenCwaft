import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { SETTINGS } from "./settings.js";

const crosshair = document.getElementById("crosshair");

export function updateCrosshair() {
    crosshair.style.left = `${SETTINGS.WIDTH / 2}px`;
    crosshair.style.top = `${SETTINGS.HEIGHT / 2}px`;
}

function createBlockOutline(scene) {
    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.001, 1.001, 1.001));
    
    const outlineMaterial = new THREE.LineBasicMaterial({
        color: 0xC6C6C6, // Minecraft-style light gray
        transparent: true,
        opacity: 0.9
    });
        
    const blockOutline = new THREE.LineSegments(edges, outlineMaterial);

    blockOutline.visible = false;
    blockOutline.raycast = () => {};
    
    scene.add(blockOutline);

    const raycaster = new THREE.Raycaster();
    raycaster.far = SETTINGS.BLOCK_REACH;

    return {
        outline: blockOutline,
        ray: raycaster,
    };
}

function getTargetBlock(camera, scene, raycaster) {
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

    const hits = raycaster.intersectObjects(scene.children);

    if (hits.length === 0) return null;

    return hits[0];
}

function updateBlockOutline(camera, scene, blockOutline) {
    try {
        const hit = getTargetBlock(camera, scene, blockOutline.ray);
        
        if (!hit) {
            blockOutline.outline.visible = false;
            return;
        }
        
        const pos = hit.point.clone()
            .add(hit.face.normal.clone().multiplyScalar(-0.5))
            .floor()
            .addScalar(0.5);
            
        blockOutline.outline.position.copy(pos);
        blockOutline.outline.visible = true;
    }
    catch {

    }
}


export const BLOCK_OUTLINE = {
    updateCrosshair,
    createBlockOutline,
    getTargetBlock,
    updateBlockOutline,
}