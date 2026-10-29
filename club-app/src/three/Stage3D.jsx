import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { createModel } from './models';
import { createRenderer, createStudio, contactShadow, frameObject, disposeObject, webglAvailable } from './studio';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const easeOutExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

/**
 * Canlı 3D sahne. Parmakla çevrilebilir (ataletli), kendi kendine yavaşça döner,
 * açılışta sinematik bir giriş yapar. Ekranda değilken render durur.
 */
export default function Stage3D({
  model = 'roll',
  variant,
  interactive = true,
  autoRotate = true,
  entrance = true,
  elevation = 24,
  zoom = 1,
  offsetY = 0,
  float = true,
  spin = 0.32,
  initialRotation = -0.55,
  shadowOpacity = 0.42,
  className = '',
  style,
  fallback = null,
}) {
  const hostRef = useRef(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !webglAvailable()) return undefined;
    const canvas = document.createElement('canvas');
    canvas.className = 'stage3d-canvas';
    host.appendChild(canvas);

    let renderer;
    try {
      renderer = createRenderer(canvas);
    } catch {
      canvas.remove();
      return undefined;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const studio = createStudio(renderer);
    const object = createModel(model, variant);
    const pivot = new THREE.Group();
    pivot.add(object);
    const box = new THREE.Box3().setFromObject(object);
    const center = box.getCenter(new THREE.Vector3());
    object.position.x -= center.x;
    object.position.z -= center.z;
    studio.scene.add(pivot);
    const shadow = contactShadow(pivot, { opacity: shadowOpacity });
    studio.scene.add(shadow);

    const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 50);
    const reduced = prefersReducedMotion();

    const state = {
      rot: initialRotation,
      vel: 0,
      tilt: 0,
      tiltTarget: 0,
      dragging: false,
      lastX: 0,
      lastY: 0,
      lastT: 0,
      visible: true,
      raf: 0,
      start: performance.now(),
    };

    const resize = () => {
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      frameObject(camera, pivot, { elevation, zoom, offsetY });
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    const io = new IntersectionObserver(([entry]) => {
      state.visible = entry.isIntersecting;
    });
    io.observe(host);

    const onDown = (e) => {
      if (!interactive) return;
      state.dragging = true;
      state.lastX = e.clientX;
      state.lastY = e.clientY;
      state.lastT = performance.now();
      state.vel = 0;
      host.setPointerCapture?.(e.pointerId);
    };
    const onMove = (e) => {
      if (!state.dragging) return;
      const now = performance.now();
      const dx = e.clientX - state.lastX;
      const dy = e.clientY - state.lastY;
      const dt = Math.max(1, now - state.lastT) / 1000;
      const delta = dx * 0.011;
      state.rot += delta;
      state.vel = delta / dt;
      state.tiltTarget = THREE.MathUtils.clamp(state.tiltTarget + dy * 0.004, -0.35, 0.35);
      state.lastX = e.clientX;
      state.lastY = e.clientY;
      state.lastT = now;
    };
    const onUp = () => {
      state.dragging = false;
      state.tiltTarget = 0;
    };
    host.addEventListener('pointerdown', onDown);
    host.addEventListener('pointermove', onMove);
    host.addEventListener('pointerup', onUp);
    host.addEventListener('pointercancel', onUp);

    let last = performance.now();
    const loop = (now) => {
      state.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!state.visible || document.hidden) return;
      const t = (now - state.start) / 1000;

      if (!state.dragging) {
        state.vel *= Math.pow(0.05, dt);
        state.rot += state.vel * dt;
        if (autoRotate && !reduced) state.rot += spin * dt;
      }
      state.tilt += (state.tiltTarget - state.tilt) * Math.min(1, dt * 6);

      const k = entrance && !reduced ? easeOutExpo(Math.min(1, t / 1.8)) : 1;
      const bob = float && !reduced ? Math.sin(t * 1.25) * 0.022 : 0;
      pivot.rotation.set(state.tilt, state.rot - (1 - k) * 1.6, 0);
      pivot.scale.setScalar(0.78 + 0.22 * k);
      pivot.position.y = bob + (1 - k) * -0.12;
      shadow.material.opacity = shadowOpacity * (0.55 + 0.45 * k) * (1 - bob * 4);
      renderer.render(studio.scene, camera);
    };
    state.raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(state.raf);
      ro.disconnect();
      io.disconnect();
      host.removeEventListener('pointerdown', onDown);
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerup', onUp);
      host.removeEventListener('pointercancel', onUp);
      disposeObject(studio.scene);
      studio.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    };
  }, [model, variant, interactive, autoRotate, entrance, elevation, zoom, offsetY, float, spin, initialRotation, shadowOpacity]);

  return (
    <div ref={hostRef} className={`stage3d ${interactive ? 'is-interactive' : ''} ${className}`} style={style}>
      {fallback}
    </div>
  );
}
