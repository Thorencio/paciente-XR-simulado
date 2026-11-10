import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import qrcode from 'qrcode-generator';
import { ACTIONS, CASE, TIME_SCALE, createSim, step, act, exam, speech, debrief, fmtClock } from './sim.js';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const FONT = "'Atkinson Hyperlegible', system-ui, sans-serif";

let s = createSim();
let phase = 'intro'; // intro | placing | ready | running | over
let paused = false, armed = false, muted = false;
let lastFind = '', lastSay = '', xrMode = null, handheld = false;
const stamp = {};

/* ---------- Render base ---------- */
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight, false);
renderer.xr.enabled = true;
renderer.xr.setFoveation(1);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.02, 30);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.minDistance = 0.45; controls.maxDistance = 4.2; controls.maxPolarAngle = 1.62;
function frameView() {
  const narrow = innerWidth < 760, wide = innerWidth / innerHeight;
  const d = narrow ? 3.5 : 2.75;
  camera.position.set(narrow ? -0.15 : -0.05, 1.55 + d * 0.3, -0.95 + d);
  controls.target.set(narrow ? -0.3 : (phase === 'intro' && wide > 1.2 ? -0.45 : 0.27), narrow ? 0.98 : 0.95, -0.95);
  controls.update();
}
frameView();

scene.add(new THREE.HemisphereLight(0xf3f6ff, 0x6a6258, 1.75));
const key = new THREE.DirectionalLight(0xfff3e4, 2.1); key.position.set(-1.2, 3, 1.6); scene.add(key);
const fill = new THREE.DirectionalLight(0xbcd8ff, 0.55); fill.position.set(2, 1.5, -1); scene.add(fill);

const world = new THREE.Group(); world.position.set(0, 0, -0.95); scene.add(world);

/* ---------- Canvas helpers ---------- */
function wrap(g, text, maxW) {
  const out = []; let line = '';
  for (const w of String(text).split(' ')) {
    const t = line ? line + ' ' + w : w;
    if (g.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
  }
  if (line) out.push(line);
  return out;
}
function canvasTex(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return { c, g: c.getContext('2d'), tex };
}

/* ---------- Habitación ---------- */
const room = new THREE.Group(); world.add(room);
(function buildRoom() {
  const f = canvasTex(512, 512); f.g.fillStyle = '#b9c4bf'; f.g.fillRect(0, 0, 512, 512);
  f.g.strokeStyle = '#a7b3ae'; f.g.lineWidth = 3;
  for (let i = 0; i <= 4; i++) { f.g.beginPath(); f.g.moveTo(i * 128, 0); f.g.lineTo(i * 128, 512); f.g.moveTo(0, i * 128); f.g.lineTo(512, i * 128); f.g.stroke(); }
  f.tex.wrapS = f.tex.wrapT = THREE.RepeatWrapping; f.tex.repeat.set(5, 5);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), new THREE.MeshLambertMaterial({ map: f.tex }));
  floor.rotation.x = -Math.PI / 2; floor.position.z = 0.8; room.add(floor);
  const wallM = new THREE.MeshLambertMaterial({ color: 0xdfe6df });
  const bandM = new THREE.MeshLambertMaterial({ color: 0x4f9a95 });
  const wall = (x, z, ry, w) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 3), wallM); m.position.set(x, 1.5, z); m.rotation.y = ry; room.add(m);
    const b = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.14), bandM); b.position.set(x + Math.sin(ry) * 0.005, 0.95, z + Math.cos(ry) * 0.005); b.rotation.y = ry; room.add(b);
  };
  wall(0, -1.5, 0, 7); wall(-3.2, 0.8, Math.PI / 2, 7); wall(3.2, 0.8, -Math.PI / 2, 7); wall(0, 4.2, Math.PI, 7);
  // Cortina de box
  const pts = []; for (let i = 0; i <= 44; i++) pts.push(new THREE.Vector2(i / 44 * 2.1, Math.sin(i * 0.9) * 0.05));
  const shape = new THREE.Shape(pts.concat(pts.slice().reverse().map((p) => new THREE.Vector2(p.x, p.y + 0.012))));
  const curtain = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 2.15, bevelEnabled: false, curveSegments: 1 }), new THREE.MeshLambertMaterial({ color: 0x8cbcb5 }));
  curtain.rotation.x = Math.PI / 2; curtain.position.set(1.05, 2.3, -1.28); room.add(curtain);
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.04, 0.42), new THREE.MeshBasicMaterial({ color: 0xffffff })); lamp.position.set(0, 2.95, 0); room.add(lamp);
})();

// Sombra de contacto: sirve también en AR
(function blob() {
  const t = canvasTex(256, 128); const gr = t.g.createRadialGradient(128, 64, 8, 128, 64, 124);
  gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  t.g.translate(0, 0); t.g.fillStyle = gr; t.g.fillRect(0, 0, 256, 128);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 1.3), new THREE.MeshBasicMaterial({ map: t.tex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.006; world.add(m);
})();

/* ---------- Camilla ---------- */
const MATT = 0.78;
const footPivot = new THREE.Group(); footPivot.position.set(0.05, MATT, 0);
(function gurney() {
  const metal = new THREE.MeshStandardMaterial({ color: 0x9aa7ad, metalness: 0.55, roughness: 0.4 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2c3a40, roughness: 0.75 });
  const pad = new THREE.MeshStandardMaterial({ color: 0x2f5560, roughness: 0.85 });
  const box = (w, h, d, x, y, z, m, p = world) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); p.add(b); return b; };
  const m1 = new THREE.Mesh(new RoundedBoxGeometry(1.08, 0.11, 0.72, 3, 0.04), pad); m1.position.set(-0.49, MATT - 0.055, 0); world.add(m1);
  const m2 = new THREE.Mesh(new RoundedBoxGeometry(0.93, 0.11, 0.72, 3, 0.04), pad); m2.position.set(0.47, -0.055, 0); footPivot.add(m2); world.add(footPivot);
  box(1.95, 0.05, 0.62, 0, MATT - 0.135, 0, metal);
  box(0.06, 0.5, 0.42, 0, 0.42, 0, dark);
  box(1.5, 0.05, 0.56, 0, 0.17, 0, metal);
  for (const x of [-0.72, 0.72]) for (const z of [-0.26, 0.26]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.05, 20), dark); w.rotation.x = Math.PI / 2; w.position.set(x, 0.075, z); world.add(w);
  }
  for (const z of [-0.39, 0.39]) {
    if (z < 0) { box(0.9, 0.022, 0.022, -0.45, MATT + 0.16, z, metal); for (const x of [-0.82, -0.08]) box(0.022, 0.22, 0.022, x, MATT + 0.05, z, metal); }
  }
  const pillow = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), new THREE.MeshStandardMaterial({ color: 0xe9eee9, roughness: 0.92 }));
  pillow.scale.set(0.16, 0.042, 0.25); pillow.position.set(-0.8, MATT + 0.012, 0); world.add(pillow);
})();

/* ---------- Paciente ---------- */
const U = {
  uSwell: { value: 0 }, uBreath: { value: 0 }, uRash: { value: 0 }, uPale: { value: 0 },
  uCyan: { value: 0 }, uFlush: { value: 0 }, uLeg: { value: 0 },
};
const patient = new THREE.Group(); patient.position.y = MATT - 0.012; world.add(patient);
const skinMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0 });
skinMat.onBeforeCompile = (sh) => {
  Object.assign(sh.uniforms, U);
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', `#include <common>
      attribute vec4 aMask; varying vec3 vObj; varying vec4 vMask;
      uniform float uSwell,uBreath,uLeg;
      float legW(vec3 p,float r){ return r<.01? smoothstep(.02,.14,p.x):0.; }
      mat2 rot2(float a){ float c=cos(a),s=sin(a); return mat2(c,s,-s,c); }`)
    .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
      { float a=uLeg*legW(position,aMask.r); objectNormal.xy=rot2(a)*objectNormal.xy; }`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>
      transformed+=normal*(aMask.g*uSwell*.0075+aMask.b*uBreath);
      { float a=uLeg*legW(position,aMask.r); vec2 q=transformed.xy-vec2(.05,0.); transformed.xy=rot2(a)*q+vec2(.05,0.); }
      vObj=position; vMask=aMask;`);
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', `#include <common>
      varying vec3 vObj; varying vec4 vMask;
      uniform float uRash,uPale,uCyan,uFlush;
      float h3(vec3 p){ return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453); }
      float vn(vec3 p){ vec3 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
        return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),
                   mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z); }`)
    .replace('#include <color_fragment>', `#include <color_fragment>
      { vec3 P=vObj; float m=vMask.r;
        vec3 c=diffuseColor.rgb;
        if(m>.01){
          float n=vn(P*58.)*.6+vn(P*127.+7.)*.28+vn(P*17.+3.)*.12;
          float th=mix(.76,.54,uRash);
          float on=smoothstep(.02,.16,uRash)*smoothstep(.0,.5,m);
          float w=smoothstep(th-.03,th+.13,n)*on;
          float core=smoothstep(th+.09,th+.2,n)*on;
          c=mix(c,vec3(.55,.13,.10),uFlush*m*.22);
          c=mix(c,vec3(.62,.13,.10),w*.62);
          c=mix(c,vec3(.74,.36,.28),core*.6);
          c=mix(c,vec3(.50,.47,.42),uPale*.62*smoothstep(.0,.2,m));
          c=mix(c,vec3(.17,.20,.40),uCyan*vMask.a*.85);
          float b=-.42-abs(P.z)*.85;
          if(m>.9 && P.x>b && P.x<-.1 && abs(P.z)<.212){
            float dots=smoothstep(.006,.0045,length(mod(P.xz,.034)-.017));
            vec3 g=mix(vec3(.47,.66,.72),vec3(.26,.43,.52),dots);
            float trim=smoothstep(.012,.009,P.x-b);
            c=mix(g,vec3(.15,.30,.37),trim);
          }
        }
        diffuseColor.rgb=c; }`);
};

const eyes = { lids: [], lidMat: new THREE.MeshStandardMaterial({ color: 0xb98569, roughness: 0.6 }), open: 0.9 };
(function face() {
  const white = new THREE.MeshStandardMaterial({ color: 0xe8e4dc, roughness: 0.25 });
  const iris = new THREE.MeshStandardMaterial({ color: 0x2b1c12, roughness: 0.18 });
  for (const z of [-0.033, 0.033]) {
    const e = new THREE.Group(); e.position.set(-0.7875, 0.1985, z);
    const R = 0.0132;
    e.add(new THREE.Mesh(new THREE.SphereGeometry(R, 20, 14), white));
    const ir = new THREE.Mesh(new THREE.SphereGeometry(R * 0.5, 14, 10), iris); ir.position.y = R * 0.74; ir.scale.y = 0.55; e.add(ir);
    const lid = new THREE.Mesh(new THREE.SphereGeometry(R * 1.09, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), eyes.lidMat);
    e.add(lid); eyes.lids.push(lid); patient.add(e);
  }
})();

/* Mascarilla */
const mask = new THREE.Group(); mask.visible = false; patient.add(mask);
(function buildMask() {
  const mat = new THREE.MeshStandardMaterial({ color: 0xd9f1ee, transparent: true, opacity: 0.55, roughness: 0.25, side: THREE.DoubleSide, depthWrite: false });
  const prof = []; for (let i = 0; i <= 14; i++) { const t = i / 14; prof.push(new THREE.Vector2(0.002 + 0.058 * Math.sin(t * Math.PI / 2), 0.055 * (1 - t * t))); }
  const m = new THREE.Mesh(new THREE.LatheGeometry(prof, 26), mat); m.scale.set(1.25, 1, 0.92); m.position.set(-0.722, 0.205, 0); mask.add(m);
  const strap = new THREE.Mesh(new THREE.TorusGeometry(0.098, 0.0028, 6, 40, 4.36).rotateZ(2.53), new THREE.MeshStandardMaterial({ color: 0xf2f2f2 }));
  strap.rotation.y = Math.PI / 2; strap.scale.set(1.0, 1.03, 1); strap.position.set(-0.745, 0.13, 0); mask.add(strap);
  const bag = new THREE.Mesh(new THREE.SphereGeometry(0.042, 16, 12), new THREE.MeshStandardMaterial({ color: 0xbfe6e2, transparent: true, opacity: 0.7, roughness: 0.3 }));
  bag.scale.set(1.4, 0.85, 0.85); bag.position.set(-0.58, 0.215, 0.13); mask.add(bag); mask.userData.bag = bag;
  const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-0.70, 0.25, 0.03), new THREE.Vector3(-0.63, 0.25, 0.09), new THREE.Vector3(-0.60, 0.215, 0.13)]), 12, 0.0075, 8), new THREE.MeshStandardMaterial({ color: 0xc9e8e4, transparent: true, opacity: 0.8 }));
  mask.add(tube);
})();

/* Suero */
const iv = { ceft: null, line: null, bag: null, fill: null };
(function ivStand() {
  const metal = new THREE.MeshStandardMaterial({ color: 0xaab6bb, metalness: 0.6, roughness: 0.35 });
  const g = new THREE.Group(); g.position.set(-1.04, 0, 0.46); world.add(g);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 2.0, 10), metal); pole.position.y = 1.0; g.add(pole);
  for (let i = 0; i < 5; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.018, 0.03), metal); b.rotation.y = (i * Math.PI * 2) / 5; b.position.set(Math.cos(i * 1.2566) * 0.13, 0.05, -Math.sin(i * 1.2566) * 0.13); g.add(b); }
  const hook = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.012, 0.012), metal); hook.position.set(0.05, 1.98, 0); g.add(hook);
  const bagM = new THREE.MeshStandardMaterial({ color: 0xe6f3f6, transparent: true, opacity: 0.42, roughness: 0.2, depthWrite: false });
  iv.bag = new THREE.Mesh(new RoundedBoxGeometry(0.11, 0.2, 0.04, 2, 0.015), bagM); iv.bag.position.set(0.17, 1.82, 0); iv.bag.visible = false; g.add(iv.bag);
  iv.fill = new THREE.Mesh(new THREE.BoxGeometry(0.088, 1, 0.026), new THREE.MeshStandardMaterial({ color: 0xbfe6f4, transparent: true, opacity: 0.85 })); iv.fill.position.set(0.17, 1.82, 0); iv.fill.visible = false; g.add(iv.fill);
  iv.ceft = new THREE.Mesh(new RoundedBoxGeometry(0.075, 0.12, 0.03, 2, 0.012), new THREE.MeshStandardMaterial({ color: 0xf4e6a4, transparent: true, opacity: 0.86, roughness: 0.3 })); iv.ceft.position.set(-0.08, 1.87, 0); g.add(iv.ceft);
  const tgt = new THREE.Vector3(-0.17, MATT + 0.115, 0.292);
  const c = new THREE.CatmullRomCurve3([new THREE.Vector3(-1.12, 1.8, 0.46), new THREE.Vector3(-1.02, 1.3, 0.54), new THREE.Vector3(-0.62, MATT + 0.3, 0.56), new THREE.Vector3(-0.25, MATT + 0.2, 0.42), tgt]);
  iv.line = new THREE.Mesh(new THREE.TubeGeometry(c, 44, 0.0032, 6), new THREE.MeshStandardMaterial({ color: 0xf2e8bd, roughness: 0.3 })); world.add(iv.line);
  const canula = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.008, 0.038), new THREE.MeshStandardMaterial({ color: 0xf4f4ea })); canula.position.copy(tgt); world.add(canula);
})();

/* ---------- Monitor ---------- */
const mon = canvasTex(768, 480); const MW = 520, ROW = [20, 170, 320], RH = 140;
let sweep = 0, lastMonDraw = 0, beatPh = 0, plPh = 0, respPh = 0, prevY = [0, 0, 0];
mon.g.fillStyle = '#04171a'; mon.g.fillRect(0, 0, 768, 480);
(function monitorBox() {
  const g = new THREE.Group(); g.position.set(-1.28, 0, -0.36); g.rotation.y = 0.72; world.add(g);
  const cas = new THREE.Mesh(new RoundedBoxGeometry(0.76, 0.52, 0.09, 3, 0.02), new THREE.MeshStandardMaterial({ color: 0xe0e4e0, roughness: 0.55 })); cas.position.y = 1.5; g.add(cas);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.69, 0.43), new THREE.MeshBasicMaterial({ map: mon.tex })); screen.position.set(0, 1.5, 0.047); g.add(screen);
  const st = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.26, 10), new THREE.MeshStandardMaterial({ color: 0x8f9ba1, metalness: 0.5, roughness: 0.4 })); st.position.y = 0.63; g.add(st);
  const ba = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.25, 0.04, 22), new THREE.MeshStandardMaterial({ color: 0x3a484e })); ba.position.y = 0.03; g.add(ba);
})();
function ecg(ph, v) {
  if (s.outcome === 'arrest') return 0;
  if (s.arrhythmia > 0) return Math.sin(ph * Math.PI * 2) * 0.82;
  const g = (c, w, a) => a * Math.exp(-(((ph - c) / w) ** 2));
  return g(0.18, 0.035, 0.13) + g(0.295, 0.009, -0.16) + g(0.32, 0.011, 1) + g(0.348, 0.012, -0.26) + g(0.56, 0.05, 0.27);
}
function pleth(ph, v) {
  if (s.outcome === 'arrest') return 0;
  const amp = clamp((v.sbp - 40) / 80, 0.1, 1);
  return amp * (0.85 * Math.exp(-(((ph - 0.28) / 0.13) ** 2)) + 0.38 * Math.exp(-(((ph - 0.56) / 0.12) ** 2)));
}
function drawMon(dt, now) {
  const v = s.vitals, g = mon.g;
  const px = dt * 90;
  const steps = Math.max(1, Math.round(px));
  const colors = ['#5be08a', '#56d6f0', '#f0c94b'];
  const running = phase === 'running' || phase === 'over' || phase === 'ready';
  for (let i = 0; i < steps && running; i++) {
    const d = (dt / steps);
    const hz = (v.hr || 0) / 60, rz = (v.rr || 0) / 60;
    beatPh = (beatPh + d * hz) % 1; plPh = (beatPh + 0.82) % 1; respPh = (respPh + d * rz) % 1;
    const ys = [ROW[0] + RH * (0.72 - ecg(beatPh, v) * 0.62), ROW[1] + RH * (0.82 - pleth(plPh, v) * 0.68), ROW[2] + RH * (0.55 - Math.sin(respPh * Math.PI * 2) * 0.3 * (rz > 0 ? 1 : 0))];
    g.fillStyle = '#04171a'; g.fillRect(sweep + 1, 0, 14, 480);
    g.lineWidth = 2.4;
    ys.forEach((y, k) => { g.strokeStyle = colors[k]; g.beginPath(); g.moveTo(sweep, prevY[k] || y); g.lineTo(sweep + 1, y); g.stroke(); prevY[k] = y; });
    sweep = (sweep + 1) % MW;
  }
  if (now - lastMonDraw > 450) {
    lastMonDraw = now;
    g.fillStyle = '#071f23'; g.fillRect(MW + 10, 0, 248, 480);
    const num = (y, label, val, col, unit, al) => {
      g.fillStyle = al && Math.floor(now / 450) % 2 ? '#ff6b5e' : col; g.font = `400 26px ${FONT}`; g.fillText(label, MW + 24, y);
      g.font = `700 ${val.length > 5 ? 54 : 74}px ${FONT}`; g.fillText(val, MW + 24, y + 70);
      if (unit) { g.font = `400 22px ${FONT}`; g.fillText(unit, MW + 150, y); }
    };
    num(34, 'FC', String(v.hr), colors[0], '/min', v.hr > 130 || v.hr < 45);
    num(150, 'SpO₂', String(v.spo2), colors[1], '%', v.spo2 < 90);
    num(266, 'PA', `${v.sbp}/${v.dbp}`, '#f4f4ec', 'mmHg', v.sbp < 90);
    num(382, 'FR', String(v.rr), colors[2], '/min', v.rr > 28);
    mon.tex.needsUpdate = true;
  }
}
let monAcc = 0;

/* ---------- Audio ---------- */
let actx = null, master = null;
function ensureAudio() {
  if (actx) { if (actx.state === 'suspended') actx.resume(); return; }
  try { actx = new (window.AudioContext || window.webkitAudioContext)(); master = actx.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(actx.destination); } catch (e) { actx = null; }
}
function beep() {
  if (!actx) return;
  const v = s.vitals; const o = actx.createOscillator(), g = actx.createGain();
  o.frequency.value = 440 + clamp(v.spo2 - 70, 0, 30) * 16;
  const t = actx.currentTime;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.07, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
  o.connect(g).connect(master); o.start(t); o.stop(t + 0.1);
}
function noiseBuf() {
  const b = actx.createBuffer(1, actx.sampleRate * 2, actx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b;
}
function auscultate(kind, level) {
  if (!actx) return;
  const t0 = actx.currentTime + 0.05, cycle = kind === 'stridor' ? 2.0 : 2.4, cycles = 2;
  const out = actx.createGain(); out.gain.value = 1; out.connect(master);
  const noise = actx.createBufferSource(); noise.buffer = noiseBuf(); noise.loop = true;
  const bp = actx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 420; bp.Q.value = 0.6;
  const ng = actx.createGain(); ng.gain.value = 0;
  noise.connect(bp).connect(ng).connect(out); noise.start(t0); noise.stop(t0 + cycle * cycles + 0.2);
  const silent = kind === 'wheeze' && level > 0.65;
  const pathologic = (kind === 'wheeze' && level > 0.2) || (kind === 'stridor' && level > 0.36);
  for (let c = 0; c < cycles; c++) {
    const st = t0 + c * cycle;
    ng.gain.setValueAtTime(0, st); ng.gain.linearRampToValueAtTime(silent ? 0.05 : 0.22, st + 0.35); ng.gain.linearRampToValueAtTime(0.02, st + 0.85);
    ng.gain.linearRampToValueAtTime(silent ? 0.02 : 0.12, st + 1.15); ng.gain.linearRampToValueAtTime(0, st + cycle - 0.1);
    if (!pathologic) continue;
    const freqs = kind === 'wheeze' ? [410, 590, 760] : [310, 470];
    const a = kind === 'wheeze' ? st + 0.95 : st + 0.05, dur = kind === 'wheeze' ? 1.25 : 0.82;
    const amp = (silent ? 0.015 : 0.05 + 0.07 * level);
    freqs.forEach((f, i) => {
      const o = actx.createOscillator(), g = actx.createGain(); o.type = kind === 'wheeze' ? 'triangle' : 'sawtooth';
      o.frequency.setValueAtTime(f * 1.05, a); o.frequency.linearRampToValueAtTime(f * 0.93, a + dur);
      g.gain.setValueAtTime(0, a); g.gain.linearRampToValueAtTime(amp / (i + 1), a + 0.12); g.gain.setValueAtTime(amp / (i + 1), a + dur - 0.2); g.gain.linearRampToValueAtTime(0, a + dur);
      o.connect(g).connect(out); o.start(a); o.stop(a + dur + 0.02);
    });
  }
}

/* ---------- Hotspots ---------- */
const hotspots = [];
function makeSpot(id, kind, label, at, labelAt, r) {
  const g = new THREE.Group(); patient.add(g);
  const proxy = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), new THREE.MeshBasicMaterial({ visible: false }));
  proxy.position.set(...at); proxy.userData.spot = id; g.add(proxy);
  const cvs = canvasTex(360, 88), c = cvs.g;
  const paint = (hot) => {
    c.clearRect(0, 0, 360, 88); c.font = `700 40px ${FONT}`;
    const tw = c.measureText(label).width, w = tw + 74;
    c.fillStyle = hot ? '#f2b134' : 'rgba(8,42,46,.86)'; c.beginPath(); c.roundRect((360 - w) / 2, 10, w, 68, 34); c.fill();
    c.fillStyle = hot ? '#14292d' : '#f2b134'; c.beginPath(); c.arc((360 - w) / 2 + 36, 44, 12, 0, 7); c.fill();
    c.fillStyle = hot ? '#14292d' : '#f1f4ec'; c.textBaseline = 'middle'; c.fillText(label, (360 - w) / 2 + 60, 46); cvs.tex.needsUpdate = true;
  };
  paint(false);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: cvs.tex, depthTest: false, transparent: true })); sp.scale.set(0.27, 0.066, 1); sp.position.set(...labelAt); sp.renderOrder = 10; sp.userData.spot = id; g.add(sp);
  const h = { id, kind, group: g, proxy, sprite: sp, paint, hot: false, pos: new THREE.Vector3(...at) }; hotspots.push(h); return h;
}
makeSpot('airway', 'exam', 'Vía aérea', [-0.72, 0.22, 0], [-0.66, 0.36, 0.03], 0.1);
makeSpot('chest', 'exam', 'Auscultar', [-0.36, 0.2, 0], [-0.34, 0.3, 0], 0.13);
makeSpot('skin', 'exam', 'Piel', [-0.42, 0.14, 0.27], [-0.52, 0.27, 0.32], 0.07);
makeSpot('pulse', 'exam', 'Pulso', [-0.02, 0.15, 0.27], [-0.02, 0.26, 0.33], 0.075);
makeSpot('thigh', 'site', 'Muslo', [0.32, 0.17, 0.12], [0.33, 0.3, 0.15], 0.11);
makeSpot('deltoid', 'site', 'Deltoides', [-0.53, 0.15, 0.25], [-0.5, 0.3, 0.3], 0.08);
function syncSpots() {
  for (const h of hotspots) h.group.visible = (phase === 'running') && (armed ? h.kind === 'site' : h.kind === 'exam' && !s.outcome);
}
syncSpots();

/* Inyección */
const syringe = new THREE.Group(); syringe.visible = false; patient.add(syringe);
(function () {
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.075, 12), new THREE.MeshStandardMaterial({ color: 0xeef6f7, transparent: true, opacity: 0.75 })); barrel.position.y = 0.075; syringe.add(barrel);
  const needle = new THREE.Mesh(new THREE.CylinderGeometry(0.0011, 0.0011, 0.04, 6), new THREE.MeshStandardMaterial({ color: 0xc8d2d6, metalness: 0.8, roughness: 0.2 })); needle.position.y = 0.02; syringe.add(needle);
  const plunger = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.06, 8), new THREE.MeshStandardMaterial({ color: 0x8b5fbf })); plunger.position.y = 0.135; syringe.add(plunger);
})();
let injAnim = 0;
function placeInjection(site) {
  const h = hotspots.find((x) => x.id === site);
  const p = site === 'thigh' ? new THREE.Vector3(0.32, 0.165, 0.14) : new THREE.Vector3(-0.53, 0.155, 0.25);
  syringe.position.copy(p); syringe.visible = true; injAnim = 1; syringe.userData.base = p.clone(); syringe.rotation.z = 0.0; syringe.rotation.x = site === 'thigh' ? 0.42 : 0.5;
  const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.002, 12), new THREE.MeshStandardMaterial({ color: 0xe8c9a8 })); pl.position.copy(p); patient.add(pl); plasters.push(pl);
}
const plasters = [];

/* ---------- Panel VR ---------- */
const panel = canvasTex(1024, 1180);
const panelMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.94, 1.083), new THREE.MeshBasicMaterial({ map: panel.tex, transparent: true }));
panelMesh.position.set(1.22, 1.46, 0.02); panelMesh.rotation.y = -0.52; panelMesh.visible = false; panelMesh.userData.panel = true; world.add(panelMesh);
let panelBtns = [], hover = null, panelDirty = true;
function drawPanel() {
  panelDirty = false; const g = panel.g, W = 1024, H = 1180; panelBtns = [];
  g.clearRect(0, 0, W, H); g.fillStyle = '#0f3f44'; g.beginPath(); g.roundRect(0, 0, W, H, 18); g.fill();
  g.textBaseline = 'alphabetic'; g.textAlign = 'left';
  const btn = (id, x, y, w, h, label, state) => {
    panelBtns.push({ id, x, y, w, h });
    g.fillStyle = hover === id ? '#ffffff' : state === 'done' ? '#9fe6d2' : state === 'arm' ? '#f2b134' : '#f1f4ec';
    g.beginPath(); g.roundRect(x, y, w, h, 8); g.fill();
    g.fillStyle = '#14292d'; g.font = `700 34px ${FONT}`;
    const L = wrap(g, label, w - 36);
    L.forEach((t, i) => g.fillText(t, x + 18, y + h / 2 + 12 - (L.length - 1) * 19 + i * 38));
  };
  const para = (t, x, y, w, size, col, weight = 400, lh = 1.3) => {
    g.font = `${weight} ${size}px ${FONT}`; g.fillStyle = col;
    for (const l of wrap(g, t, w)) { g.fillText(l, x, y); y += size * lh; }
    return y;
  };
  if (phase === 'ready') {
    let y = para(CASE.who, 44, 90, 930, 58, '#f1f4ec', 700);
    y = para(CASE.where, 44, y + 6, 930, 34, '#9fe6d2');
    y = para(CASE.story, 44, y + 30, 930, 40, '#f1f4ec');
    y = para(CASE.call, 44, y + 26, 930, 40, '#f2b134', 700);
    y = para('Apunta y aprieta el gatillo, o pellizca con la mano. Las etiquetas sobre el paciente sirven para examinarlo.', 44, y + 28, 930, 32, '#9fe6d2');
    btn('start', 44, H - 170, 936, 120, 'Comenzar el caso');
  } else if (phase === 'over') {
    const d = debrief(s);
    let y = para(overTitle(), 44, 76, 930, 48, '#f1f4ec', 700, 1.15);
    y = para(`${d.score} de ${d.total} objetivos cumplidos`, 44, y + 2, 930, 32, '#9fe6d2') + 10;
    for (const it of d.items) {
      g.font = `700 32px ${FONT}`; g.fillStyle = it.ok ? '#9fe6d2' : '#ff8f84'; g.fillText(it.ok ? '✓' : '✕', 44, y + 24);
      g.fillStyle = '#f1f4ec'; g.font = `700 30px ${FONT}`; g.fillText(it.label, 88, y + 24);
      y += 58;
    }
    y = para(d.next[0], 44, y + 22, 930, 29, '#f2b134');
    btn('restart', 44, H - 124, 936, 92, 'Atender de nuevo');
  } else {
    g.fillStyle = '#f1f4ec'; g.font = `700 54px ${FONT}`; g.fillText(fmtClock(s.t), 44, 76);
    g.font = `400 32px ${FONT}`; g.fillStyle = '#9fe6d2'; g.textAlign = 'right';
    g.fillText(armed ? 'Elige el sitio en el paciente' : paused ? 'En pausa' : `PA ${s.vitals.sbp}/${s.vitals.dbp}   SpO₂ ${s.vitals.spo2}`, 980, 72); g.textAlign = 'left';
    let y = 112;
    g.fillStyle = '#082a2e'; g.fillRect(44, y, 936, 178);
    let ty = para(lastSay ? `«${lastSay}»` : '', 64, y + 48, 900, 36, '#f1f4ec', 700, 1.2);
    para(lastFind, 64, ty + (lastSay ? 2 : 0), 900, 30, '#9fe6d2', 400, 1.22);
    const bw = 460, bh = 106, gap = 16, x0 = 44; y = 308;
    ACTIONS.forEach((a, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const on = a.toggle ? (a.id === 'o2' ? s.o2 : s.legs) : (a.id === 'stop' ? !s.trigger : a.id === 'help' ? s.log.help != null : a.id === 'chlor' || a.id === 'hydro' ? s.log[a.id] != null : false);
      btn(a.id, x0 + col * (bw + gap), y + row * (bh + gap), bw, bh, a.id === 'im' && armed ? 'Cancelar punción' : a.id === 'im' && s.doses.length ? `Adrenalina IM (dosis ${s.doses.length + 1})` : a.label, a.id === 'im' && armed ? 'arm' : on ? 'done' : '');
    });
    const by = H - 136;
    const b3 = 300;
    const small = (id, i, l) => { panelBtns.push({ id, x: x0 + i * (b3 + 18), y: by + 20, w: b3, h: 92 }); g.fillStyle = hover === id ? '#16565c' : '#0a3136'; g.beginPath(); g.roundRect(x0 + i * (b3 + 18), by + 20, b3, 92, 8); g.fill(); g.fillStyle = '#f1f4ec'; g.font = `400 32px ${FONT}`; g.textAlign = 'center'; g.fillText(l, x0 + i * (b3 + 18) + b3 / 2, by + 77); g.textAlign = 'left'; };
    small('pause', 0, paused ? 'Continuar' : 'Pausar'); small('snd', 1, muted ? 'Activar sonido' : 'Silenciar'); small('restart', 2, 'Reiniciar');
  }
  panel.tex.needsUpdate = true;
}

/* Globo de habla en VR */
const bubble = canvasTex(760, 150);
const bubbleS = new THREE.Sprite(new THREE.SpriteMaterial({ map: bubble.tex, depthTest: false, transparent: true })); bubbleS.scale.set(0.72, 0.142, 1); bubbleS.position.set(-0.3, 0.62, -0.2); bubbleS.visible = false; bubbleS.renderOrder = 11; patient.add(bubbleS);
function paintBubble(t) {
  const g = bubble.g; g.clearRect(0, 0, 760, 150); if (!t) { bubbleS.material.opacity = 0; bubble.tex.needsUpdate = true; return; }
  bubbleS.material.opacity = 1; g.font = `700 44px ${FONT}`; const lines = wrap(g, t, 690).slice(0, 2);
  g.fillStyle = '#f1f4ec'; g.beginPath(); g.roundRect(8, 8, 744, 28 + lines.length * 54, 14); g.fill();
  g.fillStyle = '#14292d'; lines.forEach((l, i) => g.fillText(l, 34, 64 + i * 54)); bubble.tex.needsUpdate = true;
}

/* ---------- DOM ---------- */
$('iw').textContent = CASE.who; $('iwh').textContent = CASE.where; $('is').textContent = CASE.story; $('ic').textContent = CASE.call;
const acts = $('acts');
let curG = null; const domBtns = {};
for (const a of ACTIONS) {
  if (a.group !== curG) { curG = a.group; const h = document.createElement('h2'); h.textContent = a.group; acts.appendChild(h); }
  const b = document.createElement('button'); b.className = 'act'; b.innerHTML = `<span></span><em></em>`; b.querySelector('span').textContent = a.label;
  b.onclick = () => perform(a.id); acts.appendChild(b); domBtns[a.id] = b;
}
$('vitals').innerHTML = [['hr', 'FC', 'var(--hr)'], ['spo2', 'SpO₂', 'var(--spo)'], ['bp', 'PA', 'var(--paper)'], ['rr', 'FR', 'var(--fr)']].map(([k, l, c]) => `<div class="v" id="v_${k}" style="color:${c}"><b>–</b><small>${l}</small></div>`).join('');
function setV(k, t, al) { const e = $('v_' + k); e.firstChild.textContent = t; e.classList.toggle('alarm', !!al); }
function renderHUD() {
  const v = s.vitals;
  setV('hr', v.hr, v.hr > 130 || v.hr < 45); setV('spo2', v.spo2, v.spo2 < 90); setV('bp', `${v.sbp}/${v.dbp}`, v.sbp < 90); setV('rr', v.rr, v.rr > 28);
  $('clock').textContent = fmtClock(s.t);
  for (const a of ACTIONS) {
    const b = domBtns[a.id], lbl = b.firstChild, em = b.lastChild;
    const on = a.toggle ? (a.id === 'o2' ? s.o2 : s.legs) : (a.id === 'stop' ? !s.trigger : a.id === 'help' ? s.log.help != null : a.id === 'chlor' || a.id === 'hydro' ? s.log[a.id] != null : false);
    b.classList.toggle('done', !!on); b.classList.toggle('arm', a.id === 'im' && armed);
    if (a.id === 'im') lbl.textContent = armed ? 'Cancelar punción' : s.doses.length ? `Adrenalina IM, dosis ${s.doses.length + 1}` : a.label;
    em.textContent = a.id === 'im' && s.doses.length ? fmtClock(s.doses[s.doses.length - 1].t) : s.log[a.id] != null && on ? fmtClock(s.log[a.id]) : a.id === 'fluid' && s.mlGiven ? `${s.mlGiven} mL` : '';
  }
  $('pause').textContent = paused ? 'Continuar' : 'Pausar'; $('snd').textContent = muted ? 'Sonido' : 'Silenciar';
}
function say(find) { if (find != null) lastFind = find; $('find').textContent = lastFind; panelDirty = true; }
function updateSpeech() {
  const t = speech(s);
  if (t !== lastSay) { lastSay = t; $('say').textContent = t ? `«${t}»` : ''; paintBubble(t); panelDirty = true; }
}
function perform(id) {
  ensureAudio();
  if (id === 'start') return beginCase();
  if (id === 'restart') return restart();
  if (id === 'pause') { paused = !paused; renderHUD(); panelDirty = true; return; }
  if (id === 'snd') { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.8; renderHUD(); panelDirty = true; return; }
  if (phase !== 'running' || s.outcome) return;
  if (id === 'im') { armed = !armed; say(armed ? 'Elige el sitio de punción sobre el paciente.' : ''); syncSpots(); renderHUD(); return; }
  const m = act(s, id); if (m) say(m); afterAct();
}
function spotClick(id) {
  const h = hotspots.find((x) => x.id === id); if (!h) return;
  ensureAudio();
  if (h.kind === 'site') { armed = false; const m = act(s, 'im', id); placeInjection(id); say(m); syncSpots(); afterAct(); return; }
  const e = exam(s, id); say(`${e.title}: ${e.text}`); if (e.sound) auscultate(e.sound, e.level);
}
function afterAct() { renderHUD(); panelDirty = true; if (s.outcome) finish(); }
function overTitle() {
  return s.outcome === 'stable' ? 'Paciente estabilizado' : s.outcome === 'arrest' ? 'El paciente entró en paro' : 'Caso cerrado: siguen los síntomas';
}
function finish() {
  phase = 'over'; armed = false; syncSpots(); panelDirty = true; renderHUD(); updateSpeech();
  const d = debrief(s);
  $('debIn').innerHTML = `<h2></h2><p></p><div id="rows"></div><h3>Lo que sigue</h3><ul></ul><button id="again">Atender de nuevo</button><p id="refs">Basado en la guía de anafilaxia del Resuscitation Council UK (2021) y en la Organización Mundial de Alergia. Adapta a tu protocolo local.</p>`;
  $('debIn').querySelector('h2').textContent = overTitle();
  $('debIn').querySelector('p').textContent = `${fmtClock(s.t)} minutos de atención. ${d.score} de ${d.total} objetivos cumplidos.`;
  for (const it of d.items) { const r = document.createElement('div'); r.className = 'row ' + (it.ok ? 'ok' : 'no'); r.innerHTML = `<i>${it.ok ? '✓' : '✕'}</i><b></b><span></span>`; r.querySelector('b').textContent = it.label; r.querySelector('span').textContent = it.detail; $('rows').appendChild(r); }
  for (const n of d.next) { const li = document.createElement('li'); li.textContent = n; $('debIn').querySelector('ul').appendChild(li); }
  $('again').onclick = restart;
  if (!xrMode || handheld) $('deb').style.display = 'flex';
}
function restart() {
  s = createSim(); armed = false; paused = false; lastFind = ''; injAnim = 0; syringe.visible = false;
  plasters.splice(0).forEach((p) => patient.remove(p));
  $('deb').style.display = 'none'; updateSpeech(); say('');
  phase = xrMode && !handheld ? 'ready' : 'running'; if (xrMode && handheld) phase = 'running';
  syncSpots(); renderHUD(); panelDirty = true;
}
function beginCase() { phase = 'running'; syncSpots(); say(''); updateSpeech(); renderHUD(); panelDirty = true; }

$('pause').onclick = () => perform('pause'); $('snd').onclick = () => perform('snd'); $('restart').onclick = () => perform('restart');
$('cartT').onclick = () => { const o = $('cart').classList.toggle('open'); $('cartT').textContent = o ? 'Cerrar acciones' : 'Abrir acciones'; };
for (const el of [$('cart'), $('deb'), $('msg')]) el.addEventListener('beforexrselect', (e) => e.preventDefault());
$('sReal').onclick = () => setARScale(1); $('sMesa').onclick = () => setARScale(0.38);

/* ---------- Entrada ---------- */
$('go2D').onclick = () => { ensureAudio(); $('intro').style.display = 'none'; $('hud').style.display = 'block'; beginCase(); frameView(); };
(async function detectXR() {
  const note = $('xrnote'); let vr = false, ar = false;
  try { if (navigator.xr) { vr = await navigator.xr.isSessionSupported('immersive-vr'); ar = await navigator.xr.isSessionSupported('immersive-ar'); } } catch (e) {}
  if (vr) { $('goVR').hidden = false; $('goVR').onclick = () => enterXR('immersive-vr'); }
  if (ar) { $('goAR').hidden = false; $('goAR').onclick = () => enterXR('immersive-ar'); }
  let lan = null;
  if (location.protocol !== 'file:') try { const r = await fetch('lan.json', { cache: 'no-store' }); if (r.ok) lan = await r.json(); } catch (e) {}
  const hosted = location.protocol === 'https:' && !/^(localhost|127\.|10\.|192\.168\.|172\.)/.test(location.hostname);
  if (!lan && hosted) lan = { url: location.origin + location.pathname, hosted: true };
  if (vr || ar) note.textContent = '';
  else if (lan && lan.hosted) note.textContent = 'Esta pantalla no tiene VR ni AR. Escanea el código con el visor o con un Android para abrir el caso allí.';
  else if (lan && lan.url) note.textContent = 'Esta pantalla no tiene VR ni AR. Abre esta dirección en el visor o en un Android, en la misma red wifi.';
  else if (location.protocol === 'file:') note.textContent = 'Para usarlo en visor o teléfono, abre PacienteXR.exe: las instrucciones están en LEEME.txt.';
  else note.textContent = /iPhone|iPad/.test(navigator.userAgent) ? 'Safari en iPhone no permite WebXR: aquí funciona solo en pantalla.' : 'Este navegador no ofrece VR ni AR. Prueba Chrome en Android o el navegador de Meta Quest.';
  if (lan && lan.url && !vr && !ar) {
    const q = qrcode(0, 'M'); q.addData(lan.url); q.make();
    $('qr').style.display = 'flex'; $('qr').innerHTML = q.createSvgTag({ cellSize: 3, margin: 0, scalable: true }) + '<span></span>'; $('qr').querySelector('span').textContent = lan.url;
  }
})();

let hitSource = null, reticle = null, arScale = 1, placedOnce = false;
async function enterXR(mode) {
  ensureAudio();
  const opts = { optionalFeatures: ['local-floor', 'hand-tracking', 'layers'] };
  if (mode === 'immersive-ar') { opts.optionalFeatures.push('hit-test', 'dom-overlay'); opts.domOverlay = { root: $('hud') }; }
  let session;
  try { session = await navigator.xr.requestSession(mode, opts); } catch (e) { $('xrnote').textContent = `No se pudo iniciar la sesión inmersiva: ${e.message}`; return; }
  xrMode = mode; handheld = !!session.domOverlayState;
  renderer.xr.setReferenceSpaceType('local-floor');
  try { await renderer.xr.setSession(session); }
  catch (e) { renderer.xr.setReferenceSpaceType('local'); await renderer.xr.setSession(session); world.position.y = -1.4; }
  controls.enabled = false;
  $('intro').style.display = 'none';
  room.visible = mode === 'immersive-vr';
  scene.background = mode === 'immersive-vr' ? new THREE.Color(0xdfe6df) : null;
  renderer.setClearAlpha(mode === 'immersive-ar' ? 0 : 1);
  panelMesh.visible = !handheld; bubbleS.visible = !handheld;
  if (handheld) { document.documentElement.classList.add('ar'); document.body.classList.add('ar'); $('hud').style.display = 'block'; $('arbar').style.display = 'flex'; }
  else $('hud').style.display = 'none';
  session.addEventListener('end', onEnd);
  if (mode === 'immersive-ar') {
    let gotHit = false;
    try { const v = await session.requestReferenceSpace('viewer'); hitSource = await session.requestHitTestSource({ space: v }); gotHit = true; } catch (e) { hitSource = null; }
    if (handheld && gotHit) {
      phase = 'placing'; world.visible = false; $('place').style.display = 'block'; placedOnce = false;
      if (!reticle) { reticle = new THREE.Mesh(new THREE.RingGeometry(0.11, 0.135, 36).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xf2b134 })); reticle.matrixAutoUpdate = false; reticle.visible = false; scene.add(reticle); }
    } else phase = handheld ? 'running' : 'ready';
  } else phase = 'ready';
  syncSpots(); panelDirty = true; updateSpeech();
}
function onEnd() {
  const ended = xrMode; xrMode = null; handheld = false; hitSource = null;
  document.documentElement.classList.remove('ar'); document.body.classList.remove('ar');
  world.visible = true; world.scale.setScalar(1); world.position.set(0, 0, -0.95); world.rotation.set(0, 0, 0); room.visible = true; scene.background = null; renderer.setClearAlpha(1);
  panelMesh.visible = false; bubbleS.visible = false; $('place').style.display = 'none'; $('arbar').style.display = 'none'; if (reticle) reticle.visible = false;
  controls.enabled = true; $('hud').style.display = 'block'; if (phase === 'ready' || phase === 'placing') beginCase();
  if (phase === 'over') finish(); frameView();
}
function setARScale(k) { arScale = k; if (placedOnce) world.scale.setScalar(k); }
const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _c = new THREE.Vector3();
function placeWorld() {
  _p.setFromMatrixPosition(reticle.matrix); world.position.copy(_p);
  renderer.xr.getCamera().getWorldPosition(_c);
  world.rotation.y = Math.atan2(_c.x - _p.x, _c.z - _p.z);
  world.scale.setScalar(arScale); world.visible = true; reticle.visible = false; placedOnce = true;
  $('place').style.display = 'none'; beginCase();
}

/* ---------- Selección ---------- */
const ray = new THREE.Raycaster();
function pick() {
  const list = [];
  if (panelMesh.visible) list.push(panelMesh);
  for (const h of hotspots) if (h.group.visible) list.push(h.proxy);
  const hits = ray.intersectObjects(list, false);
  for (const h of hotspots) if (h.group.visible) { /* etiquetas también son seleccionables */ }
  const labelHits = ray.intersectObjects(hotspots.filter((h) => h.group.visible).map((h) => h.sprite), false);
  const all = hits.concat(labelHits).sort((a, b) => a.distance - b.distance);
  return all[0] || null;
}
function panelBtnAt(uv) {
  const x = uv.x * 1024, y = (1 - uv.y) * 1180;
  const b = panelBtns.find((p) => x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h);
  return b ? b.id : null;
}
function resolveHit(h) {
  if (!h) return null;
  if (h.object.userData.panel) { const id = panelBtnAt(h.uv); return id ? { type: 'btn', id } : null; }
  if (h.object.userData.spot) return { type: 'spot', id: h.object.userData.spot };
  return null;
}
function doSelect() {
  const r = resolveHit(pick()); if (!r) return;
  if (r.type === 'btn') perform(r.id); else spotClick(r.id);
}
// Ratón / toque en pantalla
const ptr = new THREE.Vector2(); let down = null;
canvas.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
canvas.addEventListener('pointerup', (e) => {
  if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 7 || xrMode) return;
  ptr.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ptr, camera); doSelect();
});
canvas.addEventListener('pointermove', (e) => {
  if (xrMode) return; ptr.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); ray.setFromCamera(ptr, camera);
  const r = resolveHit(pick()); setHot(r && r.type === 'spot' ? r.id : null); canvas.style.cursor = r ? 'pointer' : '';
});
function setHot(id) { for (const h of hotspots) { const v = h.id === id; if (v !== h.hot) { h.hot = v; h.paint(v); } } }

// Controles XR
const ctrls = [];
const rayLine = () => { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]), new THREE.LineBasicMaterial({ color: 0xf2b134 })); l.scale.z = 3; return l; };
const _rot = new THREE.Matrix4();
function rayFrom(c) { _rot.identity().extractRotation(c.matrixWorld); ray.ray.origin.setFromMatrixPosition(c.matrixWorld); ray.ray.direction.set(0, 0, -1).applyMatrix4(_rot); ray.camera = renderer.xr.getCamera(); }
for (let i = 0; i < 2; i++) {
  const c = renderer.xr.getController(i); const line = rayLine(); line.visible = false; c.add(line); scene.add(c); ctrls.push(c);
  c.addEventListener('connected', (e) => { c.userData.src = e.data; line.visible = e.data.targetRayMode !== 'screen'; });
  c.addEventListener('disconnected', () => { line.visible = false; c.userData.src = null; });
  c.addEventListener('select', () => {
    if (!xrMode) return;
    if (phase === 'placing') { if (reticle && reticle.visible) placeWorld(); return; }
    rayFrom(c); doSelect();
  });
}

/* ---------- Bucle ---------- */
const lerp = (a, b, t) => a + (b - a) * t;
let last = performance.now(), hudAcc = 0, ph = 0, blink = 0, nextBlink = 3;
function frame(now, xf) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (phase === 'running' && !paused) { step(s, (dt * TIME_SCALE) / 60); if (s.outcome) finish(); }
  const v = s.vitals, k = Math.min(1, dt * 2.2);
  // Signos visibles
  U.uRash.value = lerp(U.uRash.value, ss(0.06, 0.8, s.U), k);
  U.uFlush.value = lerp(U.uFlush.value, s.U * (1 - ss(95, 62, v.sbp)), k);
  U.uPale.value = lerp(U.uPale.value, s.outcome === 'arrest' ? 1 : ss(100, 58, v.sbp), k);
  U.uCyan.value = lerp(U.uCyan.value, s.outcome === 'arrest' ? 1 : ss(93, 76, v.spo2), k);
  U.uSwell.value = lerp(U.uSwell.value, ss(0.12, 0.72, s.A), k);
  U.uLeg.value = lerp(U.uLeg.value, s.legs ? 0.36 : 0, Math.min(1, dt * 1.6));
  footPivot.rotation.z = U.uLeg.value;
  const rz = v.rr / 60; ph += dt * rz * Math.PI * 2;
  const depth = v.rr === 0 ? 0 : 0.0032 + 0.0072 * clamp(Math.max(s.A, s.B) * 1.2, 0, 1);
  U.uBreath.value = (Math.sin(ph) * 0.5 + 0.5) * depth;
  // Párpados
  nextBlink -= dt; if (nextBlink < 0) { blink = 1; nextBlink = 2 + Math.random() * 4; } blink = Math.max(0, blink - dt * 7);
  const open = v.gcs <= 8 || s.outcome === 'arrest' ? 0 : v.gcs <= 12 ? 0.22 : clamp(1 - U.uSwell.value * 0.45, 0, 1);
  eyes.open = lerp(eyes.open, open, k);
  const lidA = 0.1 + eyes.open * 1.95 * (1 - blink);
  for (const l of eyes.lids) l.rotation.z = lidA;
  eyes.lidMat.color.setRGB(lerp(0.486, 0.47, U.uPale.value), lerp(0.232, 0.40, U.uPale.value), lerp(0.14, 0.33, U.uPale.value));
  // Equipamiento
  mask.visible = s.o2; if (s.o2) mask.userData.bag.scale.y = 0.75 + Math.sin(ph) * 0.15;
  iv.ceft.visible = s.trigger; iv.line.material.color.setHex(s.trigger ? 0xf2e8bd : 0xe8f2f4);
  const showF = s.mlGiven > 0; iv.bag.visible = showF; iv.fill.visible = showF && s.infusing > 0.002;
  if (showF) { const f = clamp(s.infusing / 0.5, 0.02, 1); iv.fill.scale.y = 0.18 * f; iv.fill.position.y = 1.73 + 0.09 * f; }
  // Inyección
  if (injAnim > 0) { injAnim -= dt / 1.1; const t = injAnim; const d = t > 0.6 ? (t - 0.6) * 0.3 : 0; syringe.position.copy(syringe.userData.base); syringe.position.y += d; if (injAnim <= 0) syringe.visible = false; }
  // Monitor y latido
  const preBeat = beatPh; monAcc += dt;
  if (monAcc > 0.05) { drawMon(monAcc, now); monAcc = 0; mon.tex.needsUpdate = true; }
  if (phase === 'running' && !paused && s.vitals.hr > 0 && beatPh < preBeat) beep();
  if (phase !== 'intro') { hudAcc += dt; if (hudAcc > 0.3) { hudAcc = 0; renderHUD(); updateSpeech(); if (phase === 'running') { panelDirty = true; } } }
  // AR: colocación
  if (phase === 'placing' && xf && hitSource) {
    const rs = renderer.xr.getReferenceSpace(); const res = xf.getHitTestResults(hitSource);
    if (res.length) { const pose = res[0].getPose(rs); reticle.visible = true; reticle.matrix.fromArray(pose.transform.matrix); } else reticle.visible = false;
  }
  // Puntero XR
  if (xrMode && panelMesh.visible) {
    let hv = null, hs = null;
    for (const c of ctrls) { if (!c.userData.src) continue; rayFrom(c); const r = resolveHit(pick()); if (r && r.type === 'btn') hv = r.id; else if (r && r.type === 'spot') hs = r.id; }
    if (hv !== hover) { hover = hv; panelDirty = true; } setHot(hs);
  }
  if (panelMesh.visible && panelDirty) drawPanel();
  if (!xrMode) controls.update();
  renderer.render(scene, camera);
}

addEventListener('resize', () => { if (renderer.xr.isPresenting) return; camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight, false); });

/* ---------- Carga ---------- */
async function loadMesh() {
  const b64 = $('mesh').textContent.trim();
  const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const buf = await new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer();
  const h = new Float32Array(buf, 0, 8); const nv = h[0], ni = h[1];
  const mn = [h[2], h[3], h[4]], mx = [h[5], h[6], h[7]];
  let off = 32;
  const q = new Uint16Array(buf.slice(off, off + nv * 6)); off += nv * 6;
  const n = new Int8Array(buf.slice(off, off + nv * 3)); off += nv * 3;
  const col = new Uint8Array(buf, off, nv * 3); off += nv * 3;
  const mask4 = new Uint8Array(buf.slice(off, off + nv * 4)); off += nv * 4;
  const idx = new Uint16Array(buf.slice(off, off + ni * 2));
  const pos = new Float32Array(nv * 3), lin = new Float32Array(nv * 3);
  for (let i = 0; i < nv * 3; i++) { pos[i] = mn[i % 3] + (q[i] / 65535) * (mx[i % 3] - mn[i % 3]); lin[i] = Math.pow(col[i] / 255, 2.2); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(n, 3, true));
  g.setAttribute('color', new THREE.BufferAttribute(lin, 3));
  g.setAttribute('aMask', new THREE.BufferAttribute(mask4, 4, true));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  patient.add(new THREE.Mesh(g, skinMat));
}
(async () => {
  try { await Promise.all([document.fonts.load(`700 40px ${FONT}`), document.fonts.load(`400 30px ${FONT}`)]); } catch (e) {}
  hotspots.forEach((h) => h.paint(false));
  await loadMesh();
  renderHUD(); drawMon(0.05, 0);
  renderer.setAnimationLoop(frame);
})();

window.paciente = { ff(min) { for (let i = 0; i < min * 600 && !s.outcome; i++) step(s, 1 / 600); }, project(id) { const h = hotspots.find((x) => x.id === id); const v = h.sprite.getWorldPosition(new THREE.Vector3()).project(camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; }, get s() { return s; }, perform, spotClick, get phase() { return phase; }, camera, controls, U, drawPanel, panelMesh };
