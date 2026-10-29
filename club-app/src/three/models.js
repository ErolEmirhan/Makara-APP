import * as THREE from 'three';
import {
  TAU,
  smoothstep,
  rng,
  noise3,
  roundedBox,
  gridGeometry,
  weldSeam,
  ensureOutward,
  grainBumpTexture,
} from './geometry';

const C = (hex) => new THREE.Color(hex);
const physical = (o) => new THREE.MeshPhysicalMaterial(o);
const UP = new THREE.Vector3(0, 1, 0);

function mesh(geometry, material, { cast = true } = {}) {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = cast;
  return m;
}

function lathe(points, segments = 96) {
  return new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(Math.max(x, 1e-4), y)), segments);
}

/** Halka uçlarını kapatan yelpaze üçgenleri (spiral şeridin başı ve sonu). */
function ringCap(positions, colors, ringIndex, nv, outwardSign) {
  const row = nv + 1;
  const base = ringIndex * row * 3;
  const center = new THREE.Vector3();
  const col = new THREE.Color();
  for (let j = 0; j < nv; j++) {
    center.x += positions[base + j * 3];
    center.y += positions[base + j * 3 + 1];
    center.z += positions[base + j * 3 + 2];
    col.r += colors[base + j * 3];
    col.g += colors[base + j * 3 + 1];
    col.b += colors[base + j * 3 + 2];
  }
  center.multiplyScalar(1 / nv);
  col.multiplyScalar(1 / nv);
  const pos = [center.x, center.y, center.z];
  const cols = [col.r, col.g, col.b];
  for (let j = 0; j <= nv; j++) {
    pos.push(positions[base + j * 3], positions[base + j * 3 + 1], positions[base + j * 3 + 2]);
    cols.push(colors[base + j * 3], colors[base + j * 3 + 1], colors[base + j * 3 + 2]);
  }
  const idx = [];
  for (let j = 1; j <= nv; j++) {
    if (outwardSign > 0) idx.push(0, j, j + 1);
    else idx.push(0, j + 1, j);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/* ───────────────────────────── Makara (tarçınlı rulo) ───────────────────────────── */

export function makeRoll() {
  const group = new THREE.Group();
  const turns = 3.4;
  const r0 = 0.06;
  const w = 0.094;
  const h0 = 0.19;
  const P = 2.2;
  const pitch = (2 * w * 0.9) / TAU;
  const Theta = turns * TAU;
  const NT = 680;
  const NP = 36;
  const heightAt = (t) => h0 * (1.1 - 0.2 * t);

  const golden = C('#E8B070');
  const crumb = C('#CF8A48');
  const baked = C('#9C5526');
  const cinnamon = C('#4A1F0E');
  const tmp = new THREE.Color();
  const positions = [];
  const colors = [];

  for (let i = 0; i <= NT; i++) {
    const t = i / NT;
    const th = t * Theta;
    const endK = 1 - smoothstep(0.955, 1, t);
    const startK = smoothstep(0, 0.05, t);
    const ww = w * (0.55 + 0.45 * endK) * (0.45 + 0.55 * startK);
    const hh = heightAt(t) * (0.8 + 0.2 * endK) * (0.75 + 0.25 * startK);
    const rc = r0 + pitch * th - (w - ww) + 0.004 * Math.sin(th * 2.3 + 1.1);
    for (let j = 0; j <= NP; j++) {
      const phi = (j / NP) * TAU;
      const c = Math.cos(phi);
      const s = Math.sin(phi);
      const ex = Math.sign(c) * Math.pow(Math.abs(c), 2 / P);
      const ey = Math.sign(s) * Math.pow(Math.abs(s), 2 / P);
      const bump = 1 + 0.05 * (noise3(th * 1.9, phi * 1.4, 0.5) - 0.5);
      const R = rc + ww * ex * bump;
      const y = Math.max(0, hh + hh * ey * bump);
      positions.push(R * Math.cos(th), y, R * Math.sin(th));

      const outerFace = ex > 0 && t > 1 - 1 / turns;
      const side = smoothstep(0.5, 0.9, Math.abs(ex));
      tmp.copy(golden).lerp(crumb, noise3(th * 3.1, phi * 2.2, 1.7) * 0.6);
      if (outerFace) tmp.lerp(baked, side * 0.75);
      else tmp.lerp(cinnamon, side);
      // tarçın lekeleri: şeridin üst kenarlarına doğru sızan koyu çizgiler
      const smear = smoothstep(0.25, 0.55, Math.abs(ex)) * smoothstep(0.55, 0.75, noise3(th * 6, phi, 4.2));
      if (!outerFace) tmp.lerp(cinnamon, smear * 0.6);
      if (ey < -0.2) tmp.lerp(baked, 0.55);
      colors.push(tmp.r, tmp.g, tmp.b);
    }
  }

  const doughGeo = gridGeometry(positions, NT, NP, { colors });
  ensureOutward(doughGeo, Math.floor(NT / 2) * (NP + 1) + Math.round(NP / 4), UP);
  weldSeam(doughGeo, NT, NP);

  const dough = physical({
    vertexColors: true,
    roughness: 0.6,
    sheen: 0.45,
    sheenColor: C('#FFDDB0'),
    sheenRoughness: 0.45,
    clearcoat: 0.12,
    clearcoatRoughness: 0.55,
    bumpMap: grainBumpTexture(),
    bumpScale: 0.7,
  });
  group.add(mesh(doughGeo, dough));
  group.add(mesh(ringCap(positions, colors, 0, NP, -1), dough));
  group.add(mesh(ringCap(positions, colors, NT, NP, 1), dough));

  /* Hamurun üst yüzeyi — glaze bu kabartıyı takip eder, spiral glaze'in altından okunur. */
  const doughTop = (rho, alpha) => {
    const a = ((alpha % TAU) + TAU) % TAU;
    let k = Math.round((rho - r0 - pitch * a) / (pitch * TAU));
    k = Math.max(0, k);
    const th = Math.min(a + k * TAU, Theta);
    const rc = r0 + pitch * th;
    const x = THREE.MathUtils.clamp((rho - rc) / w, -1, 1);
    const hh = heightAt(th / Theta);
    return hh + hh * Math.pow(1 - Math.pow(Math.abs(x), P), 1 / P);
  };
  const crest = (rho) => 2 * heightAt(THREE.MathUtils.clamp((rho - r0) / (pitch * Theta), 0, 1));

  /* Pembe glaze */
  const thick = 0.03;
  const lift = 0.011;
  const fill = 0.32;
  const thetaEff = Theta * 0.955;
  const Rbase = r0 + pitch * (thetaEff - TAU) + w * 0.3;
  const outerTheta = (alpha) => {
    const a = ((alpha % TAU) + TAU) % TAU;
    let th = a;
    while (th + TAU <= thetaEff) th += TAU;
    return th;
  };
  const outerCenter = (alpha) => r0 + pitch * outerTheta(alpha);
  // Şeridin üst yüzünde ex = 0.5 noktası: glaze buradan omuza dökülmeye başlar.
  const phiShoulder = Math.acos(Math.pow(0.5, P / 2));
  const jumpAngle = thetaEff % TAU;
  const rand = rng(11);
  const drips = [];
  const dripCount = 7;
  for (let k = 0; k < dripCount; k++) {
    let a = (k / dripCount) * TAU + 0.3 + (rand() - 0.5) * 0.5;
    const distToJump = Math.abs(Math.atan2(Math.sin(a - jumpAngle), Math.cos(a - jumpAngle)));
    if (distToJump < 0.4) a += 0.55;
    const shoulder = outerCenter(a) + w * 0.5;
    const drop = 0.04 + rand() * 0.13;
    drips.push({ a, sigma: 0.07 + rand() * 0.05, len: shoulder - Rbase + drop });
  }
  const edge = (alpha) => {
    let e = Rbase * (1 + 0.06 * Math.sin(4 * alpha + 0.4) + 0.035 * Math.sin(9 * alpha + 1.9));
    for (const d of drips) {
      const da = Math.atan2(Math.sin(alpha - d.a), Math.cos(alpha - d.a));
      e += d.len * Math.exp(-((da / d.sigma) ** 4));
    }
    return e;
  };

  const NR = 150;
  const NS = 480;
  const gpos = [];
  const gcol = [];
  const glazeLight = C('#FF73B8');
  const glazeDeep = C('#E01C7C');
  const gc = new THREE.Color();
  for (let i = 0; i <= NR; i++) {
    const u = i / NR;
    for (let j = 0; j <= NS; j++) {
      const alpha = (j / NS) * TAU;
      const rho = u * edge(alpha);
      const lip = thick * Math.sqrt(Math.max(0, 1 - Math.pow(u, 8)));
      const rcOut = outerCenter(alpha);
      const shoulder = rcOut + w * 0.5;
      let radial;
      let y;
      if (rho <= shoulder) {
        radial = rho;
        const f = fill * (1 - smoothstep(shoulder - w * 0.9, shoulder, rho));
        const top = doughTop(rho, alpha);
        y = THREE.MathUtils.lerp(top, crest(rho), f) + lift + lip;
        const groove = THREE.MathUtils.clamp((crest(rho) - top) / (h0 * 0.55), 0, 1);
        gc.copy(glazeLight).lerp(glazeDeep, Math.pow(groove, 0.8) * 0.85);
      } else {
        // Dış şeridin süper-elips kesiti üzerinde aşağı süzül
        const hh = heightAt(outerTheta(alpha) / Theta);
        const sc = Math.sqrt((w * w + hh * hh) / 2);
        const d = rho - shoulder;
        const phi = Math.max(-0.45, phiShoulder - d / sc);
        const c = Math.cos(phi);
        const sn = Math.sin(phi);
        const ex = Math.sign(c) * Math.pow(Math.abs(c), 2 / P);
        const ey = Math.sign(sn) * Math.pow(Math.abs(sn), 2 / P);
        let nx = ex / w;
        let ny = ey / hh;
        const nl = Math.hypot(nx, ny) || 1;
        const blend = smoothstep(0, 0.35, d / sc);
        nx = (nx / nl) * blend;
        ny = THREE.MathUtils.lerp(1, ny / nl, blend);
        const ol = Math.hypot(nx, ny) || 1;
        const off = lift + lip;
        radial = rcOut + w * ex + (nx / ol) * off;
        y = hh + hh * ey + (ny / ol) * off;
        gc.copy(glazeLight).lerp(glazeDeep, 0.3);
      }
      gpos.push(radial * Math.cos(alpha), y, radial * Math.sin(alpha));
      gcol.push(gc.r, gc.g, gc.b);
    }
  }
  const glazeGeo = gridGeometry(gpos, NR, NS, { colors: gcol });
  ensureOutward(glazeGeo, Math.floor(NR / 3) * (NS + 1) + 5, UP);
  weldSeam(glazeGeo, NR, NS);
  const gn = glazeGeo.attributes.normal;
  for (let j = 0; j <= NS; j++) gn.setXYZ(j, 0, 1, 0);

  const glaze = physical({
    vertexColors: true,
    roughness: 0.12,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    sheen: 0.5,
    sheenColor: C('#FFC6E2'),
    emissive: C('#4A0020'),
    emissiveIntensity: 0.3,
  });
  group.add(mesh(glazeGeo, glaze));

  const glazeTop = (x, z) => {
    const rho = Math.hypot(x, z);
    const alpha = Math.atan2(z, x);
    const u = rho / edge(alpha);
    if (u >= 1) return doughTop(rho, alpha);
    const lip = thick * Math.sqrt(Math.max(0, 1 - Math.pow(u, 8)));
    return THREE.MathUtils.lerp(doughTop(rho, alpha), crest(rho), fill) + lift + lip;
  };

  /* Beyaz krema çizgileri — yüzeyi takip eden ince tüp */
  const pts = [];
  const zig = 8;
  const span = Rbase * 0.92;
  const rotY = 0.5;
  for (let k = 0; k <= zig; k++) {
    const x0 = -span + (2 * span * k) / zig;
    const zMax = Math.sqrt(Math.max(0, span * span - x0 * x0)) * 0.9;
    const z0 = k % 2 ? zMax : -zMax;
    const next = k < zig ? -span + (2 * span * (k + 1)) / zig : x0;
    for (let m = 0; m < (k < zig ? 6 : 1); m++) {
      const f = m / 6;
      const zMaxN = Math.sqrt(Math.max(0, span * span - next * next)) * 0.9;
      const z1 = (k + 1) % 2 ? zMaxN : -zMaxN;
      const x = x0 + (next - x0) * f;
      const z = z0 + (z1 - z0) * f;
      const xr = x * Math.cos(rotY) - z * Math.sin(rotY);
      const zr = x * Math.sin(rotY) + z * Math.cos(rotY);
      pts.push(new THREE.Vector3(xr, glazeTop(xr, zr) + 0.008, zr));
    }
  }
  const drizzleCurve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.4);
  group.add(
    mesh(
      new THREE.TubeGeometry(drizzleCurve, 520, 0.0105, 10, false),
      physical({ color: C('#FFF8FB'), roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.1, sheen: 0.6 }),
    ),
  );

  /* Lotus kırıntıları */
  const crumbMats = [C('#B8692C'), C('#9A5522'), C('#C98140')].map((color) =>
    physical({ color, roughness: 0.85, sheen: 0.4, sheenColor: C('#FFD5A0'), bumpMap: grainBumpTexture(), bumpScale: 1.5 }),
  );
  for (let k = 0; k < 20; k++) {
    const rho = Math.sqrt(rand()) * Rbase * 0.85;
    const a = rand() * TAU;
    const size = 0.02 + rand() * 0.026;
    const x = rho * Math.cos(a);
    const z = rho * Math.sin(a);
    const m = mesh(new THREE.DodecahedronGeometry(size, 0), crumbMats[k % 3]);
    m.position.set(x, glazeTop(x, z) + size * 0.2, z);
    m.rotation.set(rand() * 3, rand() * 3, rand() * 3);
    m.scale.set(1.15, 0.55, 1);
    group.add(m);
  }

  group.userData.name = 'roll';
  return group;
}

/* ───────────────────────────── Fincan ───────────────────────────── */

function latteArtTexture(kind) {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(256, 256, 40, 256, 256, 256);
  if (kind === 'turkish') {
    g.addColorStop(0, '#C79A6B');
    g.addColorStop(0.75, '#A87A4E');
    g.addColorStop(1, '#5B3519');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);
    const rand = rng(5);
    for (let i = 0; i < 420; i++) {
      const r = 2 + rand() * 9;
      const a = rand() * TAU;
      const d = Math.sqrt(rand()) * 230;
      ctx.beginPath();
      ctx.arc(256 + Math.cos(a) * d, 256 + Math.sin(a) * d, r, 0, TAU);
      ctx.fillStyle = `rgba(${rand() > 0.5 ? '232,200,160' : '120,78,44'},${0.18 + rand() * 0.3})`;
      ctx.fill();
    }
  } else {
    g.addColorStop(0, '#C7905F');
    g.addColorStop(0.7, '#8E5632');
    g.addColorStop(1, '#4E2A14');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);
    ctx.save();
    ctx.translate(256, 270);
    ctx.shadowColor = 'rgba(255,240,228,0.9)';
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#FFF4EA';
    ctx.beginPath();
    const s = 1.05;
    ctx.moveTo(0, 95 * s);
    ctx.bezierCurveTo(-150 * s, 0, -120 * s, -125 * s, -40 * s, -118 * s);
    ctx.bezierCurveTo(-10 * s, -114 * s, 0, -90 * s, 0, -70 * s);
    ctx.bezierCurveTo(0, -90 * s, 10 * s, -114 * s, 40 * s, -118 * s);
    ctx.bezierCurveTo(120 * s, -125 * s, 150 * s, 0, 0, 95 * s);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,244,234,0.9)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(256, 120);
    ctx.lineTo(256, 360);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function makeCup(variant = 'latte') {
  const group = new THREE.Group();
  const turkish = variant === 'turkish';
  const ceramicWhite = physical({ color: C('#FFFFFF'), roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.04 });
  const gold = physical({ color: C('#E9C27C'), metalness: 1, roughness: 0.22 });
  const outerMat = turkish
    ? ceramicWhite
    : physical({ color: C('#F78DBE'), roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05, sheen: 0.3 });

  const S = turkish ? 0.78 : 1;
  const H = turkish ? 0.5 : 0.5;
  const rimR = (turkish ? 0.3 : 0.47) * S;
  const footR = (turkish ? 0.2 : 0.25) * S;
  const wall = 0.022;

  const outer = [[0, 0], [footR, 0], [footR + 0.012, 0.012], [footR + 0.012, 0.03], [footR + 0.03, 0.05]];
  const steps = 14;
  for (let k = 1; k <= steps; k++) {
    const t = k / steps;
    const x = footR + 0.03 + (rimR - footR - 0.03) * Math.pow(t, turkish ? 0.9 : 0.62);
    outer.push([x, 0.05 + (H - 0.05) * t]);
  }
  const rimArc = [];
  for (let k = 1; k <= 7; k++) {
    const a = (k / 7) * Math.PI;
    rimArc.push([rimR - wall / 2 + (wall / 2) * Math.cos(a), H + (wall / 2) * Math.sin(a)]);
  }
  const inner = [];
  for (let k = steps; k >= 1; k--) {
    const t = k / steps;
    const x = footR + 0.03 + (rimR - footR - 0.03) * Math.pow(t, turkish ? 0.9 : 0.62) - wall;
    inner.push([x, 0.05 + (H - 0.05) * t]);
  }
  inner.push([footR - 0.02, 0.07], [0, 0.07]);

  const cupGroup = new THREE.Group();
  cupGroup.add(mesh(lathe(outer.concat(rimArc.slice(0, 3)), 128), outerMat));
  cupGroup.add(mesh(lathe(rimArc.slice(2).concat(inner), 128), ceramicWhite));
  if (turkish) {
    const band = mesh(new THREE.TorusGeometry(rimR - wall / 2, wall * 0.62, 12, 128), gold);
    band.rotation.x = Math.PI / 2;
    band.position.y = H + 0.002;
    cupGroup.add(band);
  }

  /* Kahve yüzeyi */
  const liquidY = H * 0.86;
  const tLiquid = (liquidY - 0.05) / (H - 0.05);
  const liquidR = footR + 0.03 + (rimR - footR - 0.03) * Math.pow(tLiquid, turkish ? 0.9 : 0.62) - wall - 0.002;
  const surface = mesh(
    new THREE.CircleGeometry(liquidR, 96),
    physical({ map: latteArtTexture(variant), roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.2 }),
  );
  surface.rotation.x = -Math.PI / 2;
  surface.position.y = liquidY;
  cupGroup.add(surface);

  /* Kulp */
  const arc = Math.PI * 1.25;
  const handle = mesh(new THREE.TorusGeometry(0.12 * S, 0.03 * S, 20, 64, arc), turkish ? ceramicWhite : outerMat);
  handle.rotation.z = -arc / 2;
  handle.scale.set(0.9, 1, 1);
  handle.position.set(rimR * 0.93 + 0.07 * S, H * 0.55, 0);
  cupGroup.add(handle);

  /* Tabak */
  const saucerR = turkish ? 0.52 : 0.72;
  const saucer = mesh(
    lathe([[0, 0], [saucerR * 0.6, 0], [saucerR * 0.72, 0.02], [saucerR * 0.95, 0.06], [saucerR, 0.075], [saucerR * 0.98, 0.085], [saucerR * 0.92, 0.07], [saucerR * 0.6, 0.04], [0, 0.038]], 128),
    ceramicWhite,
  );
  group.add(saucer);
  if (turkish) {
    const rim = mesh(new THREE.TorusGeometry(saucerR * 0.99, 0.008, 10, 160), gold);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.08;
    group.add(rim);
    const lokum = physical({ color: C('#F8A9CB'), roughness: 0.9, sheen: 1, sheenColor: C('#FFFFFF'), sheenRoughness: 0.8 });
    const l1 = mesh(roundedBox(0.13, 0.11, 0.13, 0.035, 4), lokum);
    l1.position.set(-0.32, 0.095, 0.2);
    l1.rotation.y = 0.5;
    const l2 = mesh(roundedBox(0.13, 0.11, 0.13, 0.035, 4), lokum);
    l2.position.set(-0.2, 0.095, 0.32);
    l2.rotation.y = -0.3;
    group.add(l1, l2);
  }
  cupGroup.position.y = 0.04;
  group.add(cupGroup);
  group.userData.name = 'cup';
  return group;
}

/* ───────────────────────────── Macaron ───────────────────────────── */

function macaron(color, fillingColor, r = 0.36, h = 0.13) {
  const g = new THREE.Group();
  const shellMat = physical({ color: C(color), roughness: 0.5, sheen: 1, sheenColor: C('#FFFFFF'), sheenRoughness: 0.6, clearcoat: 0.25, clearcoatRoughness: 0.5 });
  const footMat = physical({ color: C(color).offsetHSL(0, -0.05, 0.05), roughness: 0.9, sheen: 0.6 });
  const profile = [[0, 0], [r * 0.96, 0], [r, h * 0.12], [r, h * 0.28]];
  for (let k = 1; k <= 18; k++) {
    const a = (k / 18) * (Math.PI / 2);
    profile.push([r * Math.pow(Math.cos(a), 0.5), h * 0.28 + h * 0.72 * Math.sin(a)]);
  }
  const shellGeo = lathe(profile, 96);

  const footGeo = new THREE.TorusGeometry(r * 0.985, h * 0.14, 10, 120);
  const fp = footGeo.attributes.position;
  for (let i = 0; i < fp.count; i++) {
    const x = fp.getX(i), y = fp.getY(i), z = fp.getZ(i);
    const n = 1 + 0.35 * (noise3(x * 30, y * 30, z * 30) - 0.5);
    const len = Math.hypot(x, y);
    const k = (len + (n - 1) * h * 0.14) / len;
    fp.setXYZ(i, x * k, y * k, z);
  }
  footGeo.computeVertexNormals();

  const shell = (flip) => {
    const s = new THREE.Group();
    s.add(mesh(shellGeo, shellMat));
    const foot = mesh(footGeo, footMat);
    foot.rotation.x = Math.PI / 2;
    foot.position.y = h * 0.1;
    foot.scale.set(1, 1, 0.8);
    s.add(foot);
    if (flip) s.rotation.x = Math.PI;
    return s;
  };

  const fh = h * 0.42;
  const fr = r * 0.88;
  const filling = mesh(
    lathe([[0, -fh / 2], [fr, -fh / 2], [fr + 0.018, -fh * 0.1], [fr + 0.02, 0], [fr + 0.018, fh * 0.1], [fr, fh / 2], [0, fh / 2]], 96),
    physical({ color: C(fillingColor), roughness: 0.45, sheen: 0.5, clearcoat: 0.2 }),
  );
  const bottom = shell(true);
  bottom.position.y = h;
  filling.position.y = h + fh / 2;
  const top = shell(false);
  top.position.y = h + fh;
  g.add(bottom, filling, top);
  return g;
}

export function makeMacaron() {
  const group = new THREE.Group();
  const a = macaron('#BEE0A6', '#F6EED6');
  const b = macaron('#D8C3F3', '#FFFFFF');
  const c = macaron('#F79BC4', '#FFF2F7');
  const step = 0.13 * 2 + 0.13 * 0.42;
  a.position.set(0, 0, 0);
  a.rotation.y = 0.4;
  b.position.set(0.04, step, -0.02);
  b.rotation.set(0.03, -0.6, -0.04);
  c.position.set(-0.03, step * 2, 0.03);
  c.rotation.set(-0.06, 1.1, 0.08);
  group.add(a, b, c);
  group.userData.name = 'macaron';
  return group;
}

/* ───────────────────────────── Kruvasan ───────────────────────────── */

export function makeCroissant() {
  const N = 260;
  const M = 44;
  const positions = [];
  const colors = [];
  const light = C('#F1C98F');
  const crest = C('#A4561B');
  const belly = C('#E9BB7E');
  const tmp = new THREE.Color();
  for (let i = 0; i <= N; i++) {
    const s = -1 + (2 * i) / N;
    const a = s * 1.2;
    const pathR = 0.56 * (1 - 0.22 * Math.pow(Math.abs(s), 2.4));
    const cx = pathR * Math.sin(a);
    const cz = -pathR * Math.cos(a) + 0.36;
    const nx = Math.sin(a);
    const nz = -Math.cos(a);
    const base = 0.3 * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(s), 1.7)), 1.05) + 0.01;
    for (let j = 0; j <= M; j++) {
      const phi = (j / M) * TAU;
      const c = Math.cos(phi);
      const sn = Math.sin(phi);
      const ridge = Math.abs(Math.cos(Math.PI * (2.5 * s + 0.07 * Math.sin(phi * 1.0))));
      const rr = base * (0.76 + 0.32 * Math.pow(ridge, 0.55)) * (1 + 0.03 * (noise3(s * 9, phi * 2, 3.3) - 0.5));
      const ox = rr * c * 1.08;
      const oy = rr * sn * (sn < 0 ? 0.42 : 0.95) + rr * 0.42;
      positions.push(cx + nx * ox, oy, cz + nz * ox);
      tmp.copy(light).lerp(crest, smoothstep(0.25, 0.95, ridge) * smoothstep(-0.3, 0.7, sn) * 0.95);
      tmp.lerp(belly, smoothstep(0.1, -0.6, sn) * 0.7);
      tmp.lerp(crest, noise3(s * 14, phi * 3, 9.1) * 0.18);
      colors.push(tmp.r, tmp.g, tmp.b);
    }
  }
  const geo = gridGeometry(positions, N, M, { colors });
  ensureOutward(geo, Math.floor(N / 2) * (M + 1) + Math.round(M / 4), UP);
  weldSeam(geo, N, M);
  const mat = physical({
    vertexColors: true,
    roughness: 0.42,
    clearcoat: 0.55,
    clearcoatRoughness: 0.32,
    sheen: 0.5,
    sheenColor: C('#FFE0B0'),
    bumpMap: grainBumpTexture(),
    bumpScale: 0.4,
  });
  const group = new THREE.Group();
  group.add(mesh(geo, mat));
  group.userData.name = 'croissant';
  return group;
}

/* ───────────────────────────── Prag tatlısı ───────────────────────────── */

function raspberry(radius = 0.075) {
  const g = new THREE.Group();
  const mat = physical({ color: C('#E2265F'), roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.15, sheen: 0.6, sheenColor: C('#FF9CC0') });
  g.add(mesh(new THREE.SphereGeometry(radius * 0.92, 24, 16), mat));
  const drupe = new THREE.SphereGeometry(radius * 0.3, 12, 8);
  const count = 56;
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 1.7;
    const rad = Math.sqrt(Math.max(0, 1 - y * y));
    const th = i * 2.399963;
    const d = mesh(drupe, mat);
    d.position.set(Math.cos(th) * rad * radius, y * radius * 1.08, Math.sin(th) * rad * radius);
    d.scale.setScalar(0.85 + 0.3 * ((i * 37) % 7) / 7);
    g.add(d);
  }
  return g;
}

export function makePrag() {
  const group = new THREE.Group();
  const grain = grainBumpTexture();
  const sponge = physical({ color: C('#4B2516'), roughness: 0.92, sheen: 1, sheenColor: C('#8A5638'), sheenRoughness: 0.7, bumpMap: grain, bumpScale: 2.2 });
  const cream = physical({ color: C('#C88C5F'), roughness: 0.55, sheen: 0.6, sheenColor: C('#F2C9A2'), clearcoat: 0.2 });
  const ganache = physical({ color: C('#2A120A'), roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.03 });
  const layers = [
    [sponge, 0.15, 0.76],
    [cream, 0.05, 0.74],
    [sponge, 0.15, 0.76],
    [cream, 0.05, 0.74],
    [sponge, 0.13, 0.76],
  ];
  let y = 0;
  for (const [mat, h, size] of layers) {
    const m = mesh(roundedBox(size, h, size, Math.min(0.035, h * 0.45), 4), mat);
    m.position.y = y + h / 2;
    group.add(m);
    y += h - 0.002;
  }
  const top = mesh(roundedBox(0.8, 0.075, 0.8, 0.035, 5), ganache);
  top.position.y = y + 0.035;
  group.add(top);
  y += 0.075;

  const berry = raspberry();
  berry.position.set(0.08, y + 0.06, 0.05);
  group.add(berry);
  const berry2 = raspberry(0.06);
  berry2.position.set(-0.12, y + 0.05, 0.14);
  berry2.rotation.z = 0.6;
  group.add(berry2);

  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, 0);
  leafShape.bezierCurveTo(0.05, 0.03, 0.08, 0.1, 0, 0.17);
  leafShape.bezierCurveTo(-0.08, 0.1, -0.05, 0.03, 0, 0);
  const leaf = mesh(
    new THREE.ShapeGeometry(leafShape, 16),
    physical({ color: C('#43A047'), roughness: 0.35, clearcoat: 0.6, side: THREE.DoubleSide }),
  );
  leaf.position.set(-0.02, y + 0.09, -0.02);
  leaf.rotation.set(-1.0, 0.6, -0.4);
  group.add(leaf);

  const goldLeaf = mesh(
    new THREE.CircleGeometry(0.035, 7),
    physical({ color: C('#F0CF85'), metalness: 1, roughness: 0.2, side: THREE.DoubleSide }),
  );
  goldLeaf.position.set(0.22, y + 0.004, -0.18);
  goldLeaf.rotation.x = -Math.PI / 2;
  group.add(goldLeaf);

  group.userData.name = 'prag';
  return group;
}

/* ───────────────────────────── Hediye kutusu ───────────────────────────── */

export function makeGift() {
  const group = new THREE.Group();
  const pink = physical({ color: C('#F2549F'), roughness: 0.32, sheen: 0.8, sheenColor: C('#FFB3D6'), clearcoat: 0.7, clearcoatRoughness: 0.2 });
  const pinkLid = physical({ color: C('#F566AC'), roughness: 0.3, sheen: 0.8, sheenColor: C('#FFB3D6'), clearcoat: 0.8, clearcoatRoughness: 0.18 });
  const ribbon = physical({ color: C('#FFF6FA'), roughness: 0.28, sheen: 1, sheenColor: C('#FFFFFF'), clearcoat: 0.5 });

  const body = mesh(roundedBox(0.8, 0.56, 0.8, 0.05, 5), pink);
  body.position.y = 0.28;
  const lid = mesh(roundedBox(0.88, 0.17, 0.88, 0.05, 5), pinkLid);
  lid.position.y = 0.56 + 0.06;
  group.add(body, lid);

  const bands = [
    [0.13, 0.565, 0.812, 0.28],
    [0.812, 0.565, 0.13, 0.28],
    [0.13, 0.176, 0.892, 0.62],
    [0.892, 0.176, 0.13, 0.62],
  ];
  for (const [bw, bh, bd, by] of bands) {
    const b = mesh(roundedBox(bw, bh, bd, 0.012, 2), ribbon);
    b.position.y = by;
    group.add(b);
  }
  const topY = 0.56 + 0.06 + 0.085;
  const loopGeo = new THREE.TorusGeometry(0.13, 0.04, 16, 64);
  for (const side of [-1, 1]) {
    const loop = mesh(loopGeo, ribbon);
    loop.scale.set(1, 0.72, 0.5);
    loop.position.set(side * 0.13, topY + 0.07, 0);
    loop.rotation.set(0, 0, side * 0.42);
    group.add(loop);
    const tail = mesh(roundedBox(0.09, 0.02, 0.24, 0.008, 2), ribbon);
    tail.position.set(side * 0.08, topY + 0.01, 0.14);
    tail.rotation.set(0.15, side * 0.45, 0);
    group.add(tail);
  }
  const knot = mesh(new THREE.SphereGeometry(0.065, 24, 16), ribbon);
  knot.scale.set(1, 0.8, 0.9);
  knot.position.y = topY + 0.04;
  group.add(knot);
  group.userData.name = 'gift';
  return group;
}

/* ───────────────────────────── Puan jetonu ───────────────────────────── */

let logoTexture = null;
function loadLogoTexture() {
  if (!logoTexture) {
    logoTexture = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}wordmark-white.png`);
    logoTexture.colorSpace = THREE.SRGBColorSpace;
    logoTexture.anisotropy = 4;
  }
  return logoTexture;
}

export function makeCoin() {
  const group = new THREE.Group();
  const metal = physical({ color: C('#FF9CCB'), metalness: 1, roughness: 0.24, clearcoat: 0.6, clearcoatRoughness: 0.1 });
  const R = 0.5;
  const T = 0.07;
  const profile = [[0, -T], [R - 0.03, -T], [R, -T + 0.03], [R, T - 0.03], [R - 0.03, T], [R - 0.06, T], [R - 0.075, T - 0.022], [0, T - 0.022]];
  const geo = lathe(profile, 128);
  const back = [[0, -T + 0.022], [R - 0.075, -T + 0.022], [R - 0.06, -T]];
  const body = mesh(geo, metal);
  const backFace = mesh(lathe(back.reverse(), 128), metal);
  const disc = new THREE.Group();
  disc.add(body, backFace);
  const tex = loadLogoTexture();
  const face = mesh(
    new THREE.PlaneGeometry(0.66, 0.36),
    physical({ map: tex, transparent: true, metalness: 0.4, roughness: 0.25, color: C('#FFFFFF'), depthWrite: false }),
  );
  face.rotation.x = -Math.PI / 2;
  face.position.y = T - 0.021;
  disc.add(face);
  disc.rotation.x = Math.PI / 2;
  disc.position.y = R;
  group.add(disc);
  group.userData.name = 'coin';
  return group;
}

export const MODEL_FACTORIES = {
  roll: () => makeRoll(),
  cup: (variant) => makeCup(variant),
  macaron: () => makeMacaron(),
  croissant: () => makeCroissant(),
  prag: () => makePrag(),
  gift: () => makeGift(),
  coin: () => makeCoin(),
};

export function createModel(name, variant) {
  const factory = MODEL_FACTORIES[name] || MODEL_FACTORIES.roll;
  return factory(variant);
}
