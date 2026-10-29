import * as THREE from 'three';
import { createModel } from './models';
import { createRenderer, createStudio, contactShadow, frameObject, disposeObject, webglAvailable } from './studio';

/**
 * Listelerde onlarca WebGL bağlamı açmamak için modelleri tek bir gizli
 * renderer ile stüdyo fotoğrafına çevirip (PNG) önbelleğe alır.
 */
const cache = new Map();
let queue = Promise.resolve();
let ctx = null;
let idleTimer = null;

function ensureContext() {
  if (ctx) return ctx;
  const canvas = document.createElement('canvas');
  const renderer = createRenderer(canvas, { preserve: true });
  renderer.setPixelRatio(1);
  const studio = createStudio(renderer);
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 50);
  ctx = { canvas, renderer, studio, camera };
  return ctx;
}

function scheduleRelease() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (!ctx) return;
    ctx.studio.dispose();
    ctx.renderer.dispose();
    ctx.renderer.forceContextLoss();
    ctx = null;
  }, 4000);
}

async function renderStill(model, variant, size, { elevation = 26, rotation = -0.55, zoom = 1 } = {}) {
  const { canvas, renderer, studio, camera } = ensureContext();
  renderer.setSize(size, size, false);
  camera.aspect = 1;
  const object = createModel(model, variant);
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  object.position.x -= center.x;
  object.position.z -= center.z;
  const pivot = new THREE.Group();
  pivot.add(object);
  pivot.rotation.y = rotation;
  const shadow = contactShadow(pivot, { opacity: 0.4 });
  studio.scene.add(pivot, shadow);
  frameObject(camera, pivot, { elevation, zoom });
  // Doku (logo) yüklenmesini bekle
  await new Promise((r) => setTimeout(r, model === 'coin' ? 250 : 0));
  renderer.render(studio.scene, camera);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  studio.scene.remove(pivot, shadow);
  disposeObject(pivot);
  disposeObject(shadow);
  scheduleRelease();
  return blob ? URL.createObjectURL(blob) : null;
}

export function snapshot(model, variant, { size = 480, ...opts } = {}) {
  const key = `${model}:${variant || ''}:${size}:${JSON.stringify(opts)}`;
  if (cache.has(key)) return cache.get(key);
  if (!webglAvailable()) return Promise.resolve(null);
  const job = queue.then(() => renderStill(model, variant, size, opts)).catch(() => null);
  queue = job;
  cache.set(key, job);
  return job;
}
