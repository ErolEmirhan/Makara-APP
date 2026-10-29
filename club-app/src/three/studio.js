import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { contactShadowTexture } from './geometry';

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

export function createRenderer(canvas, { preserve = false } = {}) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: preserve,
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.setClearColor(0x000000, 0);
  return renderer;
}

/**
 * Stüdyo ışığı: sıcak ana ışık, pembe kontra ışık, yumuşak dolgu ve
 * prosedürel oda yansıması — dışarıdan HDR dosyası indirmeye gerek yok.
 */
export function createStudio(renderer, { rimColor = '#FF6FB1', rimIntensity = 3.4 } = {}) {
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const envRT = pmrem.fromScene(room, 0.04);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.85;
  room.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) o.material.dispose();
  });
  pmrem.dispose();

  const key = new THREE.DirectionalLight('#FFF1E4', 2.6);
  key.position.set(-2.4, 4.2, 3.2);
  const rim = new THREE.DirectionalLight(rimColor, rimIntensity);
  rim.position.set(3.2, 2.0, -3.4);
  const back = new THREE.DirectionalLight('#FFD6EA', 1.2);
  back.position.set(-3, 1.2, -3);
  const fill = new THREE.HemisphereLight('#FFFFFF', '#FFC9E0', 0.65);
  scene.add(key, rim, back, fill);

  return {
    scene,
    dispose() {
      envRT.dispose();
    },
  };
}

export function contactShadow(object, { opacity = 0.42, spread = 1.45 } = {}) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      color: '#5C1238',
      alphaMap: contactShadowTexture(),
      transparent: true,
      opacity,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  plane.rotation.x = -Math.PI / 2;
  plane.position.set((box.min.x + box.max.x) / 2, box.min.y + 0.002, (box.min.z + box.max.z) / 2);
  plane.scale.set(size.x * spread, size.z * spread, 1);
  plane.renderOrder = -1;
  return plane;
}

/**
 * Nesneyi kadraja oturtur: dar açı (sinematik tele objektif), hafif yukarıdan bakış.
 * Dönerken taşmasın diye dikey eksen etrafındaki silindirik sınır kullanılır.
 */
export function frameObject(camera, object, { elevation = 24, zoom = 1, offsetY = 0, margin = 0.84 } = {}) {
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  let rXZ = 0;
  const v = new THREE.Vector3();
  object.updateMatrixWorld(true);
  object.traverse((o) => {
    const pos = o.geometry?.attributes?.position;
    if (!pos) return;
    const step = Math.max(1, Math.floor(pos.count / 400));
    for (let i = 0; i < pos.count; i += step) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      rXZ = Math.max(rXZ, Math.hypot(v.x - center.x, v.z - center.z));
    }
  });
  const corners = [];
  for (const sx of [-1, 1]) for (const sy of [box.min.y, box.max.y]) for (const sz of [-1, 1]) {
    corners.push(new THREE.Vector3(center.x + sx * rXZ, sy, center.z + sz * rXZ));
  }
  const target = center.clone();
  target.y += offsetY;
  const el = THREE.MathUtils.degToRad(elevation);
  const dir = new THREE.Vector3(0, Math.sin(el), Math.cos(el));
  const fov = THREE.MathUtils.degToRad(camera.fov);
  let dist = Math.max(rXZ, (box.max.y - box.min.y) / 2) / Math.sin(fov / 2);
  for (let iter = 0; iter < 4; iter++) {
    camera.position.copy(target).addScaledVector(dir, dist);
    camera.near = dist / 20;
    camera.far = dist * 4;
    camera.lookAt(target);
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();
    let ext = 0;
    for (const c of corners) {
      const p = c.clone().project(camera);
      ext = Math.max(ext, Math.abs(p.x), Math.abs(p.y));
    }
    dist *= ext / (margin * zoom);
  }
  camera.position.copy(target).addScaledVector(dir, dist);
  camera.lookAt(target);
  camera.updateProjectionMatrix();
  return { target, dist };
}

export function disposeObject(root) {
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) m.dispose();
  });
}
