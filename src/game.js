import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { SETTINGS } from "./settings.js";
import { BLOCK_MANAGER } from "./block_manager.js";
import { ATMOSPHERE } from "./atmosphere.js";
import { PLAYER_MANAGER } from './player_manager.js';
import { INPUT_MANAGER } from './input_manager.js';
import { BLOCK_OUTLINE } from './block_outline.js';

class Game {
    constructor(scene, renderer, dayCycle, chunkManager, player, blockOutlineData, isSinglePlayerGame) {
        this.scene = scene;
        this.renderer = renderer;
        this.dayCycle = dayCycle;
        this.chunkManager = chunkManager;
        this.player = player;
        this.blockOutlineData = blockOutlineData;
        this.lastChunkX = 0;
        this.lastChunkZ = 0;
        this.lastTime = 0;
        this.isSinglePlayerGame = isSinglePlayerGame;
        this.isMenuVisible = false;
    }
}

function spawnPlayer(name, chunkManager) {
    const spawnPosition = BLOCK_MANAGER.TopPositionInWorld(-SETTINGS.SPAWN_DISTANCE, SETTINGS.SPAWN_DISTANCE, -SETTINGS.SPAWN_DISTANCE, SETTINGS.SPAWN_DISTANCE, chunkManager);
    chunkManager.update(spawnPosition);
    
    let player = new PLAYER_MANAGER.Player(name);
    player.position.copy(spawnPosition);

    return player;
}

function init(name, isSinglePlayerGame) {
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
    
    const player = spawnPlayer(name, chunkManager);
    
    let blockOutlineData = BLOCK_OUTLINE.createBlockOutline(scene);
    
    player.setBlockinHotbar(0, "gras");
    player.setBlockinHotbar(1, "dir");
    player.setBlockinHotbar(2, "cob");
    player.setBlockinHotbar(3, "bedroc");
    player.setBlockinHotbar(4, "san");
    player.setBlockinHotbar(5, "log");
    player.setBlockinHotbar(6, "leaf");

    return new Game(scene, renderer, dayCycle, chunkManager, player, blockOutlineData, isSinglePlayerGame);
}

let game = init("Player1", true);

function RenderFrame(time, Game) {
    if (time === undefined) time = 0;
    const delta = (time - Game.lastTime) / 1000;
    Game.lastTime = time;

    requestAnimationFrame(() => RenderFrame(performance.now(), Game));

    Game.dayCycle.update(delta, Game.player.position);
    
    let currentChunkX = BLOCK_MANAGER.worldToChunkCoord(Game.player.position.x);
    let currentChunkZ = BLOCK_MANAGER.worldToChunkCoord(Game.player.position.z);
    
    if (currentChunkX !== Game.lastChunkX || currentChunkZ !== Game.lastChunkZ) {
        Game.chunkManager.update(Game.player.position);
    }
    Game.chunkManager.updateDirtyChunks();
    Game.chunkManager.loadQueueTick();
    if (Game.chunkManager.loadQueue.size === 0) {
        Game.player.enablePhysics = true;
    }

    Game.lastChunkX = Game.currentChunkX;
    Game.lastChunkZ = currentChunkZ;

    if (INPUT_MANAGER.isKeyPressed("p")) {
        Game.chunkManager.saveWorld();
    }

    if (INPUT_MANAGER.isKeyPressed("r")) {
        Game.chunkManager.resetWorld();
        console.log("World reset!");
    }

    BLOCK_OUTLINE.updateBlockOutline(Game.player.camera, Game.scene, Game.blockOutlineData);

    Game.player.update(delta, Game.chunkManager, Game.isMenuVisible);

    Game.renderer.render(Game.scene, Game.player.camera);
}

RenderFrame(performance.now(), game);

export { Game, spawnPlayer, init, RenderFrame };