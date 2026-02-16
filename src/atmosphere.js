import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { SETTINGS } from './settings.js';

class DayCycle {
    constructor(scene) {
        this.scene = scene;
        this.time = 0.15;
        this.sunAngle = 0xfff8a6
        this.dayColor = 0x87ceeb;
        this.nightColor = 0x0b0d17;
        this.sunMeshColor = 0xfff5cc;
        this.moonMeshColor = 0xffffff;

        scene.background = new THREE.Color(this.dayColor);
        scene.fog = new THREE.Fog(this.dayColor, SETTINGS.FOG_NEAR, SETTINGS.FOG_FAR);

        this.sun = new THREE.DirectionalLight(0xffffff, 1.0);
        this.sun.position.set(100, 200, 100);
        this.sun.castShadow = true;

        this.sun.shadow.mapSize.width = 2048;
        this.sun.shadow.mapSize.height = 2048;

        this.sun.shadow.camera.near = 1;
        this.sun.shadow.camera.far = 500;
        this.sun.shadow.camera.left = -200;
        this.sun.shadow.camera.right = 200;
        this.sun.shadow.camera.top = 200;
        this.sun.shadow.camera.bottom = -200;

        scene.add(this.sun);
        scene.add(this.sun.target);

        this.moon = new THREE.DirectionalLight(0xffffff, 0.05);
        this.moon.position.set(100, 200, 100);
        this.moon.castShadow = true;

        this.moon.shadow.mapSize.width = 2048;
        this.moon.shadow.mapSize.height = 2048;

        this.moon.shadow.camera.near = 1;
        this.moon.shadow.camera.far = 500;
        this.moon.shadow.camera.left = -200;
        this.moon.shadow.camera.right = 200;
        this.moon.shadow.camera.top = 200;
        this.moon.shadow.camera.bottom = -200;

        scene.add(this.moon);
        scene.add(this.moon.target);

        const sunGeometry = new THREE.BoxGeometry(32, 32, 32);
        const sunMaterial = new THREE.MeshBasicMaterial({
            color: this.sunMeshColor
        });

        this.sunMesh = new THREE.Mesh(sunGeometry, sunMaterial);
        scene.add(this.sunMesh);

        const moonGeometry = new THREE.BoxGeometry(26, 26, 26);
        const moonMaterial = new THREE.MeshBasicMaterial({
            color: this.moonMeshColor
        });

        this.moonMesh = new THREE.Mesh(moonGeometry, moonMaterial);
        scene.add(this.moonMesh);
    }

    updateAtmosphere(heightFactor) {
        const dayColor = new THREE.Color(this.dayColor);
        const nightColor = new THREE.Color(this.nightColor);
    
        const t = THREE.MathUtils.clamp(heightFactor, 0, 1);
    
        const skyColor = nightColor.clone().lerp(dayColor, t);
    
        this.sun.intensity = t;
    
        this.sun.color.setRGB(
            1,
            0.95 + t * 0.05,
            0.8 + t * 0.2
        );
    
        this.scene.background = skyColor;
        this.scene.fog.color.copy(skyColor);
    }    

    update(delta, playerPosition) {
        // Advance time
        this.time += delta * SETTINGS.DAY_SPEED;
        this.time %= 1;
    
        // Convert time to sun angle
        const angle = this.time * Math.PI * 2;
    
        // Sun orbit radius
        const radius = 125;
    
        // Sun position in the sky
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        const z = 0;
    
        const sunWorldPos = new THREE.Vector3(
            playerPosition.x + x,
            playerPosition.y + y,
            playerPosition.z + z
        );
    
        // Move sun light
        this.sun.position.copy(sunWorldPos);
        this.sun.target.position.copy(playerPosition);
    
        // Move visible sun
        this.sunMesh.position.copy(sunWorldPos);
        this.sunMesh.lookAt(playerPosition);
        
        // Move moon (opposite side of sun)
        const moonWorldPos = new THREE.Vector3(
            playerPosition.x - x,
            playerPosition.y - y,
            playerPosition.z - z
        );

        this.moon.position.copy(moonWorldPos);
        this.moon.target.position.copy(playerPosition);

        // move visable moon
        this.moonMesh.position.copy(moonWorldPos);
        this.moonMesh.lookAt(playerPosition);

        // Sky color blend
        this.updateAtmosphere(y / radius);
    }
}

export const ATMOSPHERE = { DayCycle };