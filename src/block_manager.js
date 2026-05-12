import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { SETTINGS } from "./settings.js";

const BLOCKS = {
    air:        { id: 0 },
    gras:       { id: 1, tex: { top: [5, 0], bottom: [3, 0], front: [4, 0], back: [4, 0], left: [4, 0], right: [4, 0] }, unique_sides: true },
    dir:        { id: 2, tex: [3, 0], unique_sides: false },
    cob:        { id: 3, tex: [2, 0], unique_sides: false },
    bedroc:     { id: 4, tex: [1, 0], unique_sides: false },
};


const CHUNK_SIZE = 16;
const WORLD_HEIGHT = 64;
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

/// Generates a chunk at the specified chunk coordinates
/// chunkX and chunkZ are multiples of 16
/// Returns a 3D matrix of block IDs, with dimensions [16][32][16]
/// X and Z range from chunkX to chunkX + 15 and chunkZ to chunkZ + 15
/// Y ranges from 0 to 32 (GROUND_LEVEL + 1)
function GenerateChunk(chunkX, chunkZ) {
    // chunkX and chunkZ would be used down the line for more complex terrain generation
    // but for now we just create a flat world
    // So we just check if they are multiples of 16 and nothing else
    if (chunkX % CHUNK_SIZE != 0 || chunkZ % CHUNK_SIZE != 0) {
        console.error(`Chunk coordinates: ${chunkX}, ${chunkZ} must be multiples of 16`);
        return null;
    }
    const gras_level = 31
    const dir_level = 27
    const cob_level = 1
    const bedroc_level = 0
    let chunkData = new Array(CHUNK_SIZE);
    for (let x = 0; x < CHUNK_SIZE; x++) {
        chunkData[x] = new Array(WORLD_HEIGHT);
        for (let y = 0; y < WORLD_HEIGHT; y++) {
            chunkData[x][y] = new Array(CHUNK_SIZE);
            for (let z = 0; z < CHUNK_SIZE; z++) {
                if (y == bedroc_level) chunkData[x][y][z] = BLOCKS["bedroc"];
                else if (y > bedroc_level && y < dir_level) chunkData[x][y][z] = BLOCKS["cob"];
                else if (y >= dir_level && y < gras_level) chunkData[x][y][z] = BLOCKS["dir"];
                else if (y == gras_level) chunkData[x][y][z] = BLOCKS["gras"];
                else chunkData[x][y][z] = BLOCKS["air"];
            }
        }
    }

    //chunkData[0][0][0] = BLOCKS["bedroc"];
    //chunkData[0][0][1] = BLOCKS["dir"];
    //chunkData[0][0][2] = BLOCKS["dir"];
    //chunkData[0][1][0] = BLOCKS["cob"];
    //chunkData[0][2][0] = BLOCKS["cob"];
    //chunkData[1][0][0] = BLOCKS["gras"];
    //chunkData[2][0][0] = BLOCKS["gras"];

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
    constructor(scene) {
        this.scene = scene;
        this.chunks = new Map();
        this.modifiedChunks = new Map();
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
    
        const data = GenerateChunk(wx, wz);

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
            chunk.data = GenerateChunk(chunk.x * CHUNK_SIZE, chunk.z * CHUNK_SIZE);
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