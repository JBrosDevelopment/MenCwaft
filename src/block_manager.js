import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { createNoise2D } from 'https://cdn.jsdelivr.net/npm/simplex-noise@4.0.1/+esm';
import { SETTINGS } from "./settings.js";
import { BIOME_MANAGER } from './boime_manager.js';

const BLOCKS = {
    air:        { id: 0 },
    gras:       { id: 1, tex: { top: [5, 0], bottom: [3, 0], front: [4, 0], back: [4, 0], left: [4, 0], right: [4, 0] }, unique_sides: true },
    dir:        { id: 2, tex: [3, 0], unique_sides: false },
    cob:        { id: 3, tex: [2, 0], unique_sides: false },
    bedroc:     { id: 4, tex: [1, 0], unique_sides: false },
    san:        { id: 5, tex: [6, 0], unique_sides: false },
    log:        { id: 6, tex: { top: [7, 0], bottom: [7, 0], front: [0, 1], back: [0, 1], left: [0, 1], right: [0, 1] }, unique_sides: true },
    leaf:        { id: 7, tex: [1, 1], unique_sides: false },
};


const CHUNK_SIZE = 16;
const WORLD_HEIGHT = 128;
const GROUND_LEVEL = 31;
const CHUNK_GENERATION_HEIGHT = GROUND_LEVEL + 1;

const FACE_DEFINITIONS = {
    px: { // +X
        normal: [ 1, 0, 0 ],
        vertices: [
            [1, 0, 1],
            [1, 0, 0],
            [1, 1, 0],
            [1, 1, 1],
        ],
    },
    nx: { // -X
        normal: [ -1, 0, 0 ],
        vertices: [
            [0, 0, 0],
            [0, 0, 1],
            [0, 1, 1],
            [0, 1, 0],
        ],
    },
    pz: { // +Z
        normal: [ 0, 0, 1 ],
        vertices: [
            [0, 0, 1],
            [1, 0, 1],
            [1, 1, 1],
            [0, 1, 1],
        ],
    },
    nz: { // -Z
        normal: [ 0, 0, -1 ],
        vertices: [
            [1, 0, 0],
            [0, 0, 0],
            [0, 1, 0],
            [1, 1, 0],
        ],
    },

    // untouched — already correct
    py: { // +Y
        normal: [ 0, 1, 0 ],
        vertices: [
            [0, 1, 1],
            [1, 1, 1],
            [1, 1, 0],
            [0, 1, 0],
        ],
    },
    ny: { // -Y
        normal: [ 0, -1, 0 ],
        vertices: [
            [0, 0, 0],
            [1, 0, 0],
            [1, 0, 1],
            [0, 0, 1],
        ],
    },
};    

const FACE_UVS = [
    0, 0,
    1, 0,
    1, 1,
    0, 1,
];  

const FACE_TO_SIDE = {
    px: "right",
    nx: "left",
    py: "top",
    ny: "bottom",
    pz: "front",
    nz: "back",
};

function mulberry32(seed) {
    return function() {
        let t = seed += 0x6D2B79F5;

        t = Math.imul(t ^ t >>> 15, t | 1);

        t ^= t + Math.imul(t ^ t >>> 7, t | 61);

        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

function fbm(noise2D, x, z, octaves, persistence, lacunarity) {
    let amplitude = 1;
    let frequency = 1;

    let value = 0;
    let max = 0;

    for (let i = 0; i < octaves; i++) {
        value += noise2D(x * frequency, z * frequency) * amplitude;

        max += amplitude;

        amplitude *= persistence;
        frequency *= lacunarity;
    }

    return value / max;
}

function ridgedFBM(noise2D, x, z, octaves) {
    let value = 0;

    let amplitude = 0.5;
    let frequency = 1.0;

    for (let i = 0; i < octaves; i++) {

        let n = noise2D(
            x * frequency,
            z * frequency
        );

        // Ridge transformation
        n = 1 - Math.abs(n);

        // Sharpen ridges
        n *= n;

        value += n * amplitude;

        frequency *= 2.0;
        amplitude *= 0.5;
    }

    return value;
}

function smoothstep(edge0, edge1, x) {
    x = Math.max(
        0,
        Math.min(
            1,
            (x - edge0) / (edge1 - edge0)
        )
    );

    return x * x * (3 - 2 * x);
}

function GenerateChunk(chunkX, chunkZ, terrainNoise, tempNoise, humidityNoise) {

    if (chunkX % CHUNK_SIZE != 0 || chunkZ % CHUNK_SIZE != 0) {
        console.error(`Chunk coordinates: ${chunkX}, ${chunkZ} must be multiples of 16`);
        return null;
    }

    const SEA_LEVEL = 28;
    const MAX_TREES_PER_CHUNK = 5;
    let treesInChunk = 0;

    let chunkData = new Array(CHUNK_SIZE);

    for (let x = 0; x < CHUNK_SIZE; x++) {

        chunkData[x] = new Array(WORLD_HEIGHT);

        for (let y = 0; y < WORLD_HEIGHT; y++) {
            chunkData[x][y] = new Array(CHUNK_SIZE);
        }

        for (let z = 0; z < CHUNK_SIZE; z++) {
            const worldX = chunkX + x;
            const worldZ = chunkZ + z;

            // BIOME NOISE
            const temperature = tempNoise(worldX * 0.001, worldZ * 0.001);
            const humidity = humidityNoise(worldX * 0.001, worldZ * 0.001);

            // BIOME BLENDING
            const mountainFactor = smoothstep(-0.2, 0.4, -temperature); // Mountains appear in colder regions
            const desertFactor = smoothstep(0.2, 0.7, temperature) * smoothstep(0.3, -0.3, humidity); // Deserts appear in hot + dry regions
            const forestFactor = smoothstep(0.1, 0.7, humidity); // Forests appear in humid regions
            let plainsFactor = 1.0 - Math.max(mountainFactor, desertFactor, forestFactor); // Plains are default
            
            plainsFactor = Math.max(plainsFactor, 0);

            // DOMAIN WARPING
            const warpX = terrainNoise(worldX * 0.002, worldZ * 0.002) * 30;
            const warpZ = terrainNoise((worldX + 1000) * 0.002, (worldZ + 1000) * 0.002) * 30;

            const nx = worldX + warpX;
            const nz = worldZ + warpZ;

            // BASE TERRAIN
            const baseTerrain = fbm(terrainNoise, nx * 0.003, nz * 0.003, 5, 0.5, 2.0);
            
            // RIDGED MOUNTAINS
            const mountains = ridgedFBM(terrainNoise, nx * 0.008, nz * 0.008, 5);

            // BIOME HEIGHTS
            const plainsHeight = baseTerrain * 8;
            const forestHeight = baseTerrain * 12;
            const desertHeight = baseTerrain * 5;
            const mountainHeight = baseTerrain * 15 + mountains * 45;
            
            // FINAL BLENDED HEIGHT
            const terrainHeight = Math.floor(
                    plainsHeight * plainsFactor +
                    forestHeight * forestFactor +
                    desertHeight * desertFactor +
                    mountainHeight * mountainFactor
                ) + SEA_LEVEL;

            // SURFACE BLOCKS
            let surfaceBlock = "gras";
            let subsurfaceBlock = "dir";

            if (desertFactor > 0.5) {
                surfaceBlock = "san";
                subsurfaceBlock = "san";
            }

            if (mountainFactor > 0.6) {
                surfaceBlock = "cob";
                subsurfaceBlock = "cob";
            }

            const mountainCobHeight = 45;
            
            
            // GENERATE BLOCKS
            for (let y = 0; y < WORLD_HEIGHT; y++) {

                if (y === 0) {
                    chunkData[x][y][z] = BLOCKS["bedroc"];
                }

                else if (y < terrainHeight - 4) {
                    chunkData[x][y][z] = BLOCKS["cob"];
                }

                else if (y < terrainHeight) {
                    if (mountainFactor > 0.6 && y < mountainCobHeight) {
                        subsurfaceBlock = "dir"; // for mountains, transition from dir to cob
                    } 
                    chunkData[x][y][z] = BLOCKS[subsurfaceBlock];
                }

                else if (y === terrainHeight) {
                    if (mountainFactor > 0.6 && y < mountainCobHeight) {
                       surfaceBlock = "gras"; // for mountains, transition from gras to cob
                    } 
                    chunkData[x][y][z] = BLOCKS[surfaceBlock];
                }

                else {
                    chunkData[x][y][z] = BLOCKS["air"];
                }
            }

            // TREES
            const treeNoise = terrainNoise(worldX * 0.1, worldZ * 0.1);
            if (forestFactor > 0.7 && treeNoise > 0.6 && MAX_TREES_PER_CHUNK > treesInChunk && terrainHeight < mountainCobHeight) {
                chunkData[x][terrainHeight + 1][z] = BLOCKS["log"];
                treesInChunk++;
            }
        }
    }

    return chunkData;
}

const ATLAS_SIZE = 8; // tiles per row
const TILE_SIZE = 1 / ATLAS_SIZE;

/// Renders the specified chunk data at the given chunk coordinates
/// chunkX and chunkZ are multiples of 16
/// chunkData is a 3D matrix of block IDs, with dimensions [16][32][16]
function RenderChunk(scene, chunkData, chunkX, chunkZ) {
    if (chunkX % CHUNK_SIZE != 0 || chunkZ % CHUNK_SIZE != 0) {
        console.error(`Chunk coordinates: ${chunkX}, ${chunkZ} must be multiples of 16`);
        return;
    }
    const positions = [];
    const normals = [];
    const indices = [];

    let indexOffset = 0;

    const texture = new THREE.TextureLoader().load("Textures/" + SETTINGS.TEXTURE_PACK + "/blocks.png");
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;

    const material = new THREE.MeshStandardMaterial({map: texture});

    const uvs = [];

    function isAir(x, y, z) {
        if (x < 0 || x >= CHUNK_SIZE ||
            y < 0 || y >= CHUNK_GENERATION_HEIGHT ||
            z < 0 || z >= CHUNK_SIZE
        ) {
            return true; // outside chunk = air
        }
        
        return chunkData[x][y][z].id === 0;
    }

    for (let x = 0; x < CHUNK_SIZE; x++) {
        for (let y = 0; y < WORLD_HEIGHT; y++) {
            for (let z = 0; z < CHUNK_SIZE; z++) {

                const block = chunkData[x][y][z];
                if (block.id == BLOCKS["air"].id) continue;

                if (!block || !block.tex) {
                    console.warn(block.id, "==", BLOCKS["air"].id);
                    return;
                }
                

                // World position
                const wx = chunkX + x;
                const wy = y;
                const wz = chunkZ + z;
                
                if (isAir(x + 1, y, z)) addFace(positions, normals, uvs, indices, wx, wy, wz, "px", block, indexOffset), indexOffset += 4;
                if (isAir(x - 1, y, z)) addFace(positions, normals, uvs, indices, wx, wy, wz, "nx", block, indexOffset), indexOffset += 4;
                if (isAir(x, y + 1, z)) addFace(positions, normals, uvs, indices, wx, wy, wz, "py", block, indexOffset), indexOffset += 4;
                if (isAir(x, y - 1, z)) addFace(positions, normals, uvs, indices, wx, wy, wz, "ny", block, indexOffset), indexOffset += 4;
                if (isAir(x, y, z + 1)) addFace(positions, normals, uvs, indices, wx, wy, wz, "pz", block, indexOffset), indexOffset += 4;
                if (isAir(x, y, z - 1)) addFace(positions, normals, uvs, indices, wx, wy, wz, "nz", block, indexOffset), indexOffset += 4;
            }
        }
    }
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));

    geometry.setIndex(indices);
    geometry.computeBoundingSphere();
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    scene.add(mesh);
    return mesh;
}

function addFace(positions, normals, uvs, indices, x, y, z, faceKey, block, indexOffset) {
    const face = FACE_DEFINITIONS[faceKey];

    let tx, ty;

    if (block.unique_sides) {
        const side = FACE_TO_SIDE[faceKey];
        [tx, ty] = block.tex[side];
    } else {
        [tx, ty] = block.tex;
    }

    const u0 = tx * TILE_SIZE;
    const v0 = 1 - (ty + 1) * TILE_SIZE;
    const u1 = u0 + TILE_SIZE;
    const v1 = v0 + TILE_SIZE;

    const uvMap = [
        u0, v0,
        u1, v0,
        u1, v1,
        u0, v1,
    ];

    for (let i = 0; i < 4; i++) {
        const v = face.vertices[i];
        positions.push(x + v[0], y + v[1], z + v[2]);
        normals.push(...face.normal);
        uvs.push(uvMap[i * 2], uvMap[i * 2 + 1]);
    }

    indices.push(
        indexOffset, indexOffset + 1, indexOffset + 2,
        indexOffset, indexOffset + 2, indexOffset + 3
    );
}

function worldToChunkCoord(v) {
    return Math.floor(v / CHUNK_SIZE);
}

function chunkToWorldCoord(c) {
    return c * CHUNK_SIZE;
}

function worldToLocal(v) {
    return ((v % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
}

function chunkKey(x, z) {
    return `${x},${z}`;
}

class Chunk {
    constructor(x, z, data, mesh) {
        this.x = x;
        this.z = z;
        this.data = data;
        this.mesh = mesh;
        this.dirty = false;
    }
}

class ChunkManager {
    constructor(scene, seed) {
        this.scene = scene;
        this.chunks = new Map();
        this.modifiedChunks = new Map();
        this.seed = seed;

        this.terrainNoise = createNoise2D(mulberry32(seed));
        this.tempNoise = createNoise2D(mulberry32(seed + 1));
        this.humidityNoise = createNoise2D(mulberry32(seed + 2));
    }

    update(playerPosition) {
        const camCX = worldToChunkCoord(playerPosition.x);
        const camCZ = worldToChunkCoord(playerPosition.z);
    
        const needed = new Set();
    
        for (let dx = -SETTINGS.RENDER_DISTANCE; dx <= SETTINGS.RENDER_DISTANCE; dx++) {
            for (let dz = -SETTINGS.RENDER_DISTANCE; dz <= SETTINGS.RENDER_DISTANCE; dz++) {
                const cx = camCX + dx;
                const cz = camCZ + dz;
                const key = chunkKey(cx, cz);
    
                needed.add(key);
    
                if (!this.chunks.has(key)) {
                    this.loadChunk(cx, cz);
                }
            }
        }
        
        const toUnload = [];

        for (const [key, chunk] of this.chunks) {
            if (!needed.has(key)) {
                toUnload.push(key);
            }
        }
        
        for (const key of toUnload) {
            const chunk = this.chunks.get(key);
            this.unloadChunk(this.scene, key, chunk);
        }
    }

    updateDirtyChunks() {
        for (const chunk of this.chunks.values()) {
            if (!chunk.dirty) continue;
        
            this.rebuildChunk(chunk);
            chunk.dirty = false;
        }
    }

    rebuildChunk(chunk) {
        const wx = chunk.x * CHUNK_SIZE;
        const wz = chunk.z * CHUNK_SIZE;
        
        const mesh_rebuilt = RenderChunk(this.scene, chunk.data, wx, wz);

        if (chunk.mesh) {
            this.scene.remove(chunk.mesh);
            chunk.mesh.geometry.dispose();
            chunk.mesh.material.dispose();
        }
    
        chunk.mesh = mesh_rebuilt;
    }    
    
    loadChunk(cx, cz) {
        const wx = cx * CHUNK_SIZE;
        const wz = cz * CHUNK_SIZE;
    
        const data = GenerateChunk(wx, wz, this.terrainNoise, this.tempNoise, this.humidityNoise);

        const key = chunkKey(cx, cz);
    
        if (this.modifiedChunks.has(key)) {
            const edits = this.modifiedChunks.get(key);
    
            for (const [coord, block] of edits) {
                const [lx, wy, lz] = coord.split(",").map(Number);
                data[lx][wy][lz] = block;
            }
        }
        const mesh = RenderChunk(this.scene, data, wx, wz);
    
        const chunk = new Chunk(cx, cz, data, mesh);
        this.chunks.set(chunkKey(cx, cz), chunk);
    }

    unloadChunk(scene, key, chunk) {
        if (chunk.mesh) {
            scene.remove(chunk.mesh);
    
            chunk.mesh.traverse(obj => {
                if (obj.isMesh) {
                    obj.geometry.dispose();
    
                    if (Array.isArray(obj.material)) {
                        obj.material.forEach(m => m.dispose());
                    } else if (obj.material) {
                        obj.material.dispose();
                    }
                }
            });
        }
    
        chunk.mesh = null;
        this.chunks.delete(key);
    }

    setBlock(wx, wy, wz, block) {
        const cx = worldToChunkCoord(wx);
        const cz = worldToChunkCoord(wz);
        const lx = worldToLocal(wx);
        const lz = worldToLocal(wz);
    
        const key = chunkKey(cx, cz);
        const chunk = this.chunks.get(key);
        if (!chunk) return;
        
        chunk.data[lx][wy][lz] = block;
        chunk.dirty = true;

        for (const [nx, nz] of getAffectedChunks(wx, wy, wz)) {
            const neighbor = this.chunks.get(chunkKey(nx, nz));
            if (neighbor) neighbor.dirty = true;
        }
        
        if (!this.modifiedChunks.has(key)) {
            this.modifiedChunks.set(key, new Map());
        }

        const edits = this.modifiedChunks.get(key);
        edits.set(`${lx},${wy},${lz}`, block);
    }

    saveWorld() {
        const obj = {};
    
        for (const [chunkKey, edits] of this.modifiedChunks) {
            obj[chunkKey] = Object.fromEntries(edits);
        }
    
        localStorage.setItem("world_mods", JSON.stringify(obj));
    }

    loadWorld() {
        const saved = localStorage.getItem("world_mods");
        if (!saved) return;
    
        const parsed = JSON.parse(saved);
    
        for (const chunkKey in parsed) {
            this.modifiedChunks.set(
                chunkKey,
                new Map(Object.entries(parsed[chunkKey]))
            );
        }
    } 

    resetWorld() {
        this.modifiedChunks.clear();
        localStorage.removeItem("world_mods");
        for (const chunk of this.chunks.values()) {
            chunk.dirty = true;
            chunk.data = GenerateChunk(chunk.x * CHUNK_SIZE, chunk.z * CHUNK_SIZE, this.terrainNoise, this.tempNoise, this.humidityNoise);
        }
    }
}

function getAffectedChunks(wx, wy, wz) {
    const chunks = [];

    const cx = worldToChunkCoord(wx);
    const cz = worldToChunkCoord(wz);

    chunks.push([cx, cz]);

    if (wx % CHUNK_SIZE === 0) chunks.push([cx - 1, cz]);
    if (wx % CHUNK_SIZE === CHUNK_SIZE - 1) chunks.push([cx + 1, cz]);

    if (wz % CHUNK_SIZE === 0) chunks.push([cx, cz - 1]);
    if (wz % CHUNK_SIZE === CHUNK_SIZE - 1) chunks.push([cx, cz + 1]);

    return chunks;
}



export const BLOCK_MANAGER = { Chunk, ChunkManager, GenerateChunk, RenderChunk, worldToChunkCoord, chunkKey, BLOCKS, CHUNK_SIZE, WORLD_HEIGHT, GROUND_LEVEL, CHUNK_GENERATION_HEIGHT, FACE_DEFINITIONS };