// Malla del paciente del módulo de rodilla: decúbito supino, polera y short,
// pierna derecha en dos piezas (muslo y pierna) para animar las pruebas.
import fs from 'node:fs'; import zlib from 'node:zlib';
import { sm, sub, sph, ell, cap, mz, head, torso, arm, hand, surfaceNets } from './mesh-lib.mjs';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

export const H = [0.03, 0.095, 0.10];   // cadera derecha
export const K = [0.47, 0.078, 0.10];   // rodilla derecha
const A = [0.88, 0.068, 0.097];          // tobillo

// Pierna genérica en z = +0.10. eff = derrame (solo rodilla derecha)
function thigh(p, eff) {
  let d = cap(p, H, K, 0.083, 0.056);
  d = sm(d, ell(p, [0.22, 0.112, 0.10], [0.17, 0.072, 0.07]), 0.05);
  d = sm(d, ell(p, K, [0.052, 0.05, 0.058]), 0.03);
  d = sm(d, ell(p, [0.472, 0.124, 0.10], [0.027, 0.012, 0.023]), 0.012); // rótula
  if (eff) {
    d = sm(d, ell(p, [0.405, 0.116, 0.10], [0.062, 0.036, 0.06]), 0.035); // receso suprarrotuliano
    d = sm(d, ell(p, [0.47, 0.09, 0.10], [0.06, 0.055, 0.066]), 0.03);
  }
  return d;
}
function shank(p) {
  let d = cap(p, K, A, 0.05, 0.031);
  d = sm(d, ell(p, [0.60, 0.052, 0.10], [0.13, 0.046, 0.05]), 0.04); // pantorrilla
  d = sm(d, ell(p, [0.495, 0.098, 0.10], [0.03, 0.022, 0.03]), 0.02); // tuberosidad
  d = sm(d, ell(p, [0.892, 0.05, 0.097], [0.034, 0.033, 0.03]), 0.02); // talón
  d = sm(d, cap(p, [0.895, 0.07, 0.097], [0.925, 0.19, 0.099], 0.03, 0.026), 0.025);
  d = sm(d, ell(p, [0.918, 0.20, 0.10], [0.022, 0.03, 0.04]), 0.02);
  return d;
}
const leg = (p, eff) => sm(thigh(p, eff), shank(p), 0.02);
const pelvis = (p) => sm(ell(p, [-0.02, 0.098, 0], [0.13, 0.098, 0.172]), ell(mz(p), [0.04, 0.098, 0.1], [0.07, 0.085, 0.09]), 0.05);
const torsoArm = (p) => sm(sm(torso(p), arm(mz(p)), 0.03), pelvis(p), 0.06);

const SKIN = [206, 160, 126], HAIR = [52, 38, 30], LIP = [178, 104, 92];
const SHIRT = [44, 92, 146], COLLAR = [236, 236, 228], SHORTS = [38, 42, 50];

const parts = [
  { name: 'head', f: (p) => Math.max(head(p), p[0] + 0.625), n: head, min: [-0.93, 0.0, -0.115], max: [-0.6, 0.28, 0.115], h: 0.0048,
    attr(p) {
      const q = mz(p);
      const lipD = Math.min(ell(q, [-0.7055, 0.2145, 0.009], [0.0068, 0.0075, 0.019]), ell(p, [-0.6935, 0.2125, 0], [0.0078, 0.0085, 0.0215]));
      const lip = 1 - ss(0.0005, 0.004, lipD);
      const hair = Math.max(ss(-0.838, -0.852, p[0] + 0.05 * (0.21 - p[1]) * (p[1] > 0.05 ? 1 : 0)), p[1] < 0.115 && p[0] < -0.74 ? ss(0.115, 0.09, p[1]) : 0);
      return { col: SKIN.map((c, i) => c + (LIP[i] - c) * lip).map((c, i) => c + (HAIR[i] - c) * hair), mask: [0, 0, 0, 0] };
    } },
  { name: 'torso', f: (p) => Math.max(torsoArm(p), Math.max(-0.64 - p[0], p[0] - 0.13)), n: torsoArm, min: [-0.7, -0.03, -0.36], max: [0.15, 0.27, 0.36], h: 0.0125,
    attr(p) {
      const q = mz(p); const isArm = arm(q) < torso(p) - 0.004 && q[2] > 0.2;
      const sleeve = isArm && p[0] < -0.40;
      const shorts = !isArm && p[0] > -0.12;
      const collar = !isArm && p[0] < -0.582 && Math.abs(p[2]) < 0.075 && p[1] > 0.1;
      let col = isArm && !sleeve ? SKIN : shorts ? SHORTS : collar ? COLLAR : SHIRT;
      const breath = !isArm && !shorts ? ss(-0.62, -0.48, p[0]) * (1 - ss(-0.15, 0, p[0])) * ss(0.05, 0.14, p[1]) : 0;
      return { col, mask: [0, 0, breath, 0] };
    } },
  { name: 'hands', f: (p) => Math.max(mz(p)[2] < 0.1 ? 1 : hand(mz(p)), -0.02 - p[0]), n: (p) => hand(mz(p)), min: [-0.03, 0.09, -0.34], max: [0.19, 0.19, 0.34], h: 0.0058,
    attr() { return { col: SKIN, mask: [0, 0, 0, 0] }; } },
  { name: 'legL', f: (p) => Math.max(leg(mz(p), false), p[2] + 0.01), n: (p) => leg(mz(p), false), min: [-0.08, -0.02, -0.21], max: [0.97, 0.25, 0.0], h: 0.0085,
    attr(p) { return { col: p[0] < 0.25 - 0.06 * (0.11 - p[1]) ? SHORTS : SKIN, mask: [0, 0, 0, 0] }; } },
  { name: 'thighR', f: (p) => Math.max(thigh(p, true), p[0] - 0.53, -0.07 - p[0]), n: (p) => thigh(p, true), min: [-0.08, -0.02, -0.01], max: [0.55, 0.23, 0.21], h: 0.0072,
    attr(p) { return { col: p[0] < 0.25 - 0.06 * (0.11 - p[1]) ? SHORTS : SKIN, mask: [0, 0, 0, 0] }; } },
  { name: 'shankR', f: (p) => Math.max(shank(p), 0.44 - p[0]), n: shank, min: [0.42, -0.02, 0.0], max: [0.97, 0.25, 0.2], h: 0.0072,
    attr() { return { col: SKIN, mask: [0, 0, 0, 0] }; } },
];

const gradOf = (f) => (p) => { const e = 0.0012; const g = [f([p[0] + e, p[1], p[2]]) - f([p[0] - e, p[1], p[2]]), f([p[0], p[1] + e, p[2]]) - f([p[0], p[1] - e, p[2]]), f([p[0], p[1], p[2] + e]) - f([p[0], p[1], p[2] - e])]; const l = Math.hypot(...g) || 1; return g.map((x) => x / l); };

const out = {};
for (const pt of parts) {
  const g = gradOf(pt.n);
  const { pos, idx } = surfaceNets(pt.f, g, pt.min, pt.max, pt.h);
  const nv = pos.length / 3;
  if (nv > 65535) throw new Error(pt.name + ' demasiados vértices ' + nv);
  const N = [], Col = [], M = [];
  for (let i = 0; i < pos.length; i += 3) {
    const p = [pos[i], pos[i + 1], pos[i + 2]];
    N.push(...g(p).map((x) => Math.round(x * 127)));
    const a = pt.attr(p); Col.push(...a.col.map(Math.round)); M.push(...a.mask.map((x) => Math.round(clamp(x, 0, 1) * 255)));
  }
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (let i = 0; i < pos.length; i++) { mn[i % 3] = Math.min(mn[i % 3], pos[i]); mx[i % 3] = Math.max(mx[i % 3], pos[i]); }
  const q = new Uint16Array(nv * 3); for (let i = 0; i < nv * 3; i++) q[i] = Math.round(((pos[i] - mn[i % 3]) / (mx[i % 3] - mn[i % 3] || 1)) * 65535);
  const hd = new Float32Array([nv, idx.length, ...mn, ...mx]);
  const buf = Buffer.concat([Buffer.from(hd.buffer), Buffer.from(q.buffer), Buffer.from(Int8Array.from(N).buffer), Buffer.from(Uint8Array.from(Col).buffer), Buffer.from(Uint8Array.from(M).buffer), Buffer.from(new Uint16Array(idx).buffer)]);
  out[pt.name] = zlib.deflateRawSync(buf, { level: 9 }).toString('base64');
  console.log(pt.name, nv, 'vértices', idx.length / 3, 'triángulos');
}
fs.writeFileSync('dist-mesh-rodilla.json', JSON.stringify(out));
console.log('total', (JSON.stringify(out).length / 1024) | 0, 'KB');
