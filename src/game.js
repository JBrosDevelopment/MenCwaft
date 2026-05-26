import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { SETTINGS } from "./settings.js";
import { BLOCK_MANAGER } from "./block_manager.js";
import { ATMOSPHERE } from "./atmosphere.js";
import { PLAYER_MANAGER } from './player_manager.js';
import { INPUT_MANAGER } from './input_manager.js';
import { BLOCK_OUTLINE } from './block_outline.js';
import { BIOME_MANAGER } from './boime_manager.js';

BLOCK_OUTLINE.updateCrosshair();

const scene = new THREE.Scene();

const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById("c") });
renderer.setSize(SETTINGS.WIDTH, SETTINGS.HEIGHT);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
scene.add(ambientLight);

const dayCycle = new ATMOSPHERE.DayCycle(scene);

const chunkManager = new BLOCK_MANAGER.ChunkManager(scene, SETTINGS.SEED);
chunkManager.loadWorld();

const spawnPosition = BLOCK_MANAGER.TopPositionInWorld(-SETTINGS.SPAWN_DISTANCE, SETTINGS.SPAWN_DISTANCE, -SETTINGS.SPAWN_DISTANCE, SETTINGS.SPAWN_DISTANCE, chunkManager);
chunkManager.update(spawnPosition);

let player = new PLAYER_MANAGER.Player("Player1");
player.position.copy(spawnPosition);

let lastChunkX, lastChunkZ = 0;
let lastTime = 0;

let blockOutlineData = BLOCK_OUTLINE.createBlockOutline(scene);

player.setBlockinHotbar(0, "gras");
player.setBlockinHotbar(1, "dir");
player.setBlockinHotbar(2, "cob");
player.setBlockinHotbar(3, "bedroc");
player.setBlockinHotbar(4, "san");
player.setBlockinHotbar(5, "log");
player.setBlockinHotbar(6, "leaf");

function RenderFrame(time) {
    if (time === undefined) time = 0;
    const delta = (time - lastTime) / 1000;
    lastTime = time;

    requestAnimationFrame(RenderFrame);

    dayCycle.update(delta, player.position);
    
    let currentChunkX = BLOCK_MANAGER.worldToChunkCoord(player.position.x);
    let currentChunkZ = BLOCK_MANAGER.worldToChunkCoord(player.position.z);
    
    if (currentChunkX !== lastChunkX || currentChunkZ !== lastChunkZ) {
        chunkManager.update(player.position);
    }
    chunkManager.updateDirtyChunks();

    lastChunkX = currentChunkX;
    lastChunkZ = currentChunkZ;

    if (INPUT_MANAGER.isKeyPressed("Enter")) {
        chunkManager.saveWorld();
    }

    if (INPUT_MANAGER.isKeyPressed("r")) {
        chunkManager.resetWorld();
        console.log("World reset!");
    }

    BLOCK_OUTLINE.updateBlockOutline(player.camera, scene, blockOutlineData);

    player.update(delta, chunkManager);

    renderer.render(scene, player.camera);
}

RenderFrame();