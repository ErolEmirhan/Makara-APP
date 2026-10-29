import * as THREE from 'three';

export const TAU = Math.PI * 2;

export function smoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Tekrarlanabilir rastgele sayı üreteci — modeller her açılışta aynı görünsün. */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash3(x, y, z) {
  const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return h - Math.floor(h);
}

/** Basit 3B değer gürültüsü (0..1). */
export function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const lerp = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz);
  return lerp(
    lerp(lerp(c(0, 0, 0), c(1, 0, 0), u), lerp(c(0, 1, 0), c(1, 1, 0), u), v),
    lerp(lerp(c(0, 0, 1), c(1, 0, 1), u), lerp(c(0, 1, 1), c(1, 1, 1), u), v),
    w,
  );
}

/** Kenarları yuvarlatılmış kutu; normaller analitik olduğu için dikiş görünmez. */
export function roundedBox(w, h, d, r, seg = 6) {
  const n = seg * 2 + 1;
  const g = new THREE.BoxGeometry(w, h, d, n, n, n);
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const half = [w / 2, h / 2, d / 2];
  const rr = Math.min(r, ...half.map((x) => x * 0.999));
  const remap = (c, H) => {
    const W = H * 2;
    const k = ((c + H) / W) * n;
    if (k <= seg) return -H + rr * (k / seg);
    if (k >= seg + 1) return H - rr * ((n - k) / seg);
    return -H + rr + (k - seg) * (W - 2 * rr);
  };
  const p = new THREE.Vector3();
  const inner = new THREE.Vector3();
  const dir = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.set(remap(pos.getX(i), half[0]), remap(pos.getY(i), half[1]), remap(pos.getZ(i), half[2]));
    inner.set(
      THREE.MathUtils.clamp(p.x, -half[0] + rr, half[0] - rr),
      THREE.MathUtils.clamp(p.y, -half[1] + rr, half[1] - rr),
      THREE.MathUtils.clamp(p.z, -half[2] + rr, half[2] - rr),
    );
    dir.subVectors(p, inner);
    if (dir.lengthSq() < 1e-12) dir.set(nor.getX(i), nor.getY(i), nor.getZ(i));
    dir.normalize();
    p.copy(inner).addScaledVector(dir, rr);
    pos.setXYZ(i, p.x, p.y, p.z);
    nor.setXYZ(i, dir.x, dir.y, dir.z);
  }
  pos.needsUpdate = true;
  nor.needsUpdate = true;
  return g;
}

/**
 * (nu+1)×(nv+1) ızgara noktalarından üçgen indeksleri; dış normali
 * garantilemek için `probe` ile yön kontrolü yapılır.
 */
export function gridGeometry(positions, nu, nv, { colors, flip = false } = {}) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (colors) g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const idx = [];
  const row = nv + 1;
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const a = i * row + j, b = (i + 1) * row + j, c = (i + 1) * row + j + 1, d = i * row + j + 1;
      if (flip) idx.push(a, d, b, b, d, c);
      else idx.push(a, b, d, b, c, d);
    }
  }
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Izgaranın v-yönündeki dikişinde (j=0 ve j=nv) normalleri ortalar. */
export function weldSeam(g, nu, nv) {
  const n = g.attributes.normal;
  const row = nv + 1;
  const v = new THREE.Vector3();
  for (let i = 0; i <= nu; i++) {
    const a = i * row, b = i * row + nv;
    v.set(n.getX(a) + n.getX(b), n.getY(a) + n.getY(b), n.getZ(a) + n.getZ(b)).normalize();
    n.setXYZ(a, v.x, v.y, v.z);
    n.setXYZ(b, v.x, v.y, v.z);
  }
  n.needsUpdate = true;
}

/** Normal yönünü örnek bir noktada kontrol eder; içeri bakıyorsa üçgenleri çevirir. */
export function ensureOutward(g, vertexIndex, expectedDir) {
  const n = g.attributes.normal;
  const got = new THREE.Vector3(n.getX(vertexIndex), n.getY(vertexIndex), n.getZ(vertexIndex));
  if (got.dot(expectedDir) >= 0) return g;
  const index = g.index.array;
  for (let i = 0; i < index.length; i += 3) {
    const t = index[i + 1];
    index[i + 1] = index[i + 2];
    index[i + 2] = t;
  }
  g.index.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

/** Kontakt gölge için gri tonlu alpha haritası (beyaz = koyu gölge). */
let shadowTexture = null;
export function contactShadowTexture() {
  if (shadowTexture) return shadowTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 256, 256);
  const grd = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, 'rgb(255,255,255)');
  grd.addColorStop(0.3, 'rgb(150,150,150)');
  grd.addColorStop(0.65, 'rgb(40,40,40)');
  grd.addColorStop(1, 'rgb(0,0,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 256, 256);
  shadowTexture = new THREE.CanvasTexture(c);
  return shadowTexture;
}

/** Pürüzlü yüzeyler (kek, kruvasan) için tekrarlanabilir gürültü bump dokusu. */
let grainTexture = null;
export function grainBumpTexture() {
  if (grainTexture) return grainTexture;
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const rand = rng(7);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = noise3(x / 9, y / 9, 0.3) * 0.6 + rand() * 0.4;
      const v = Math.floor(n * 255);
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  grainTexture = new THREE.CanvasTexture(c);
  grainTexture.wrapS = grainTexture.wrapT = THREE.RepeatWrapping;
  return grainTexture;
}
