import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let controls: OrbitControls | null = null;
let animId: number | null = null;

export function initScene(canvas: HTMLCanvasElement): void {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);

    camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000);
    camera.position.set(0, 1.5, 3);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 0.9, 0);
    controls.update();

    // Studio lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);

    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(2, 4, 3);
    scene.add(key);

    const fill = new THREE.DirectionalLight(0x8888ff, 0.4);
    fill.position.set(-3, 2, -2);
    scene.add(fill);

    // Grid
    const grid = new THREE.GridHelper(10, 20, 0x444466, 0x333355);
    scene.add(grid);

    resizeToContainer();
    window.addEventListener('resize', resizeToContainer);

    startLoop();
}

function resizeToContainer(): void {
    if (!renderer || !camera) return;
    const el = renderer.domElement.parentElement;
    if (!el) return;
    const w = el.clientWidth;
    const h = el.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
}

function startLoop(): void {
    if (animId !== null) return;
    const loop = () => {
        animId = requestAnimationFrame(loop);
        controls?.update();
        if (renderer && scene && camera) {
            renderer.render(scene, camera);
        }
    };
    loop();
}

export function getScene(): THREE.Scene {
    if (!scene) throw new Error('Scene not initialized');
    return scene;
}

export function getCamera(): THREE.PerspectiveCamera {
    if (!camera) throw new Error('Camera not initialized');
    return camera;
}

export function getControls(): OrbitControls {
    if (!controls) throw new Error('Controls not initialized');
    return controls;
}

export function fitCameraToObject(object: THREE.Object3D): void {
    if (!camera || !controls) return;

    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    const dist = Math.abs(maxDim / Math.sin(fov / 2)) * 0.7;

    camera.position.set(center.x, center.y + size.y * 0.3, center.z + dist);
    camera.near = dist / 100;
    camera.far = dist * 10;
    camera.updateProjectionMatrix();

    controls.target.copy(center);
    controls.update();
}

export function clearMeshes(): void {
    if (!scene) return;
    const toRemove: THREE.Object3D[] = [];
    scene.traverse(obj => {
        if (obj.userData.loaded) toRemove.push(obj);
    });
    toRemove.forEach(obj => {
        scene!.remove(obj);
        if (obj instanceof THREE.Mesh) {
            obj.geometry.dispose();
            if (Array.isArray(obj.material)) {
                obj.material.forEach(m => m.dispose());
            } else {
                (obj.material as THREE.Material).dispose();
            }
        }
    });
}

export function disposeScene(): void {
    if (animId !== null) {
        cancelAnimationFrame(animId);
        animId = null;
    }
    window.removeEventListener('resize', resizeToContainer);
    clearMeshes();
    controls?.dispose();
    renderer?.dispose();
    renderer = null;
    scene = null;
    camera = null;
    controls = null;
}
