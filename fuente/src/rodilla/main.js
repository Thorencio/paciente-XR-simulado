import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import qrcode from 'qrcode-generator';
import { CASE, STAGES, HYP, QUESTIONS, TESTS, PLAN, INSPECTION, Q_LIMIT, T_LIMIT, createCase, ask, closeAnamnesis, toggleHyp, runTest, debrief } from './caso.js';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const FONT = "'Atkinson Hyperlegible', system-ui, sans-serif";
const H = new THREE.Vector3(0.03, 0.095, 0.10), K = new THREE.Vector3(0.47, 0.078, 0.10);
const PLINTH = 0.72;

let c = createCase();
let phase = 'intro'; // intro | placing | ready | running | over
let xrMode = null, handheld = false;
let lastQ = '', lastSay = '', lastFind = '', lastDelta = '';

/* ---------- Render base ---------- */
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight, false);
renderer.xr.enabled = true;
renderer.xr.setFoveation(1);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(44, innerWidth / innerHeight, 0.02, 30);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.minDistance = 0.4; controls.maxDistance = 4; controls.maxPolarAngle = 1.62;
function frameView() {
  const narrow = innerWidth < 760, wide = innerWidth / innerHeight;
  if (narrow) { camera.position.set(0.25, 2.55, 2.0); controls.target.set(0.12, 0.76, -0.95); }
  else if (phase === 'intro' && wide > 1.2) { camera.position.set(-0.2, 2.05, 1.65); controls.target.set(-0.42, 0.82, -0.9); }
  else { camera.position.set(0.35, 1.95, 1.25); controls.target.set(0.5, 0.82, -0.9); }
  controls.update();
}
frameView();
scene.add(new THREE.HemisphereLight(0xf6f4ef, 0x6b6156, 1.7));
const key = new THREE.DirectionalLight(0xfff1df, 2.1); key.position.set(-1.0, 3, 1.8); scene.add(key);
const fill = new THREE.DirectionalLight(0xc6dcff, 0.6); fill.position.set(2.2, 1.4, -1); scene.add(fill);
const world = new THREE.Group(); world.position.set(0, 0, -0.95); scene.add(world);

function canvasTex(w, h) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return { c: cv, g: cv.getContext('2d'), tex };
}
function wrap(g, text, maxW) {
  const out = []; let line = '';
  for (const w of String(text).split(' ')) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; }
  if (line) out.push(line); return out;
}

/* ---------- Box de kinesiología ---------- */
const room = new THREE.Group(); world.add(room);
(function buildRoom() {
  const f = canvasTex(512, 512); f.g.fillStyle = '#c9b89c'; f.g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 8; i++) { f.g.fillStyle = i % 2 ? '#c2b093' : '#cdbda2'; f.g.fillRect(0, i * 64, 512, 62); }
  f.tex.wrapS = f.tex.wrapT = THREE.RepeatWrapping; f.tex.repeat.set(4, 6);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), new THREE.MeshLambertMaterial({ map: f.tex }));
  floor.rotation.x = -Math.PI / 2; floor.position.z = 0.8; room.add(floor);
  const wallM = new THREE.MeshLambertMaterial({ color: 0xe6e8e1 });
  const wall = (x, z, ry, w) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 3), wallM); m.position.set(x, 1.5, z); m.rotation.y = ry; room.add(m); };
  wall(0, -1.5, 0, 7); wall(-3.2, 0.8, Math.PI / 2, 7); wall(3.2, 0.8, -Math.PI / 2, 7); wall(0, 4.2, Math.PI, 7);
  // Espaldera
  const wood = new THREE.MeshStandardMaterial({ color: 0xc89a62, roughness: 0.6 });
  const bars = new THREE.Group(); bars.position.set(-0.55, 0, -1.44); room.add(bars);
  for (const x of [-0.45, 0.45]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.07, 2.4, 0.07), wood); p.position.set(x, 1.2, 0); bars.add(p); }
  for (let i = 0; i < 14; i++) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.9, 10), wood); r.rotation.z = Math.PI / 2; r.position.set(0, 0.16 + i * 0.16, 0.03); bars.add(r); }
  // Colchoneta y balón
  const mat = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.04, 1.4, 2, 0.015), new THREE.MeshStandardMaterial({ color: 0x3f6e8c, roughness: 0.8 }));
  mat.position.set(1.75, 0.02, -0.5); room.add(mat);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.32, 32, 20), new THREE.MeshStandardMaterial({ color: 0x5aa58e, roughness: 0.5 }));
  ball.position.set(1.85, 0.32, -1.05); room.add(ball);
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 0.4), new THREE.MeshBasicMaterial({ color: 0xffffff })); lamp.position.set(0, 2.95, 0); room.add(lamp);
})();
(function blob() {
  const t = canvasTex(256, 128); const gr = t.g.createRadialGradient(128, 64, 8, 128, 64, 124);
  gr.addColorStop(0, 'rgba(0,0,0,.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); t.g.fillStyle = gr; t.g.fillRect(0, 0, 256, 128);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.2), new THREE.MeshBasicMaterial({ map: t.tex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.006; world.add(m);
})();
(function plinth() {
  const pad = new THREE.MeshStandardMaterial({ color: 0x4b5a63, roughness: 0.85 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xb7bfc2, metalness: 0.5, roughness: 0.4 });
  const top = new THREE.Mesh(new RoundedBoxGeometry(1.95, 0.09, 0.66, 3, 0.035), pad); top.position.set(0, PLINTH - 0.045, 0); world.add(top);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.05, 0.56), metal); frame.position.set(0, PLINTH - 0.115, 0); world.add(frame);
  for (const x of [-0.82, 0.82]) for (const z of [-0.24, 0.24]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.045, PLINTH - 0.12, 0.045), metal); l.position.set(x, (PLINTH - 0.12) / 2, z); world.add(l); }
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.02, 0.5), new THREE.MeshStandardMaterial({ color: 0xd8d4c8 })); shelf.position.set(0, 0.2, 0); world.add(shelf);
  const towel = new THREE.Mesh(new RoundedBoxGeometry(0.28, 0.07, 0.4, 2, 0.03), new THREE.MeshStandardMaterial({ color: 0xece6d6, roughness: 0.95 })); towel.position.set(-0.8, PLINTH + 0.03, 0); world.add(towel);
})();

/* ---------- Paciente ---------- */
const U = { uBreath: { value: 0 } };
const patient = new THREE.Group(); patient.position.y = PLINTH + 0.012; world.add(patient);
const skinMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.66, metalness: 0 });
skinMat.onBeforeCompile = (sh) => {
  Object.assign(sh.uniforms, U);
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nattribute vec4 aMask; uniform float uBreath;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += normal * aMask.b * uBreath;');
};
const hipG = new THREE.Group(); hipG.position.copy(H); patient.add(hipG);
const kneeG = new THREE.Group(); kneeG.position.copy(K).sub(H); kneeG.rotation.order = 'ZYX'; hipG.add(kneeG);
const tibG = new THREE.Group(); kneeG.add(tibG);

const eyes = { lids: [], lidMat: new THREE.MeshStandardMaterial({ color: 0xbf8c6c, roughness: 0.6 }) };
(function face() {
  const white = new THREE.MeshStandardMaterial({ color: 0xe8e4dc, roughness: 0.25 });
  const iris = new THREE.MeshStandardMaterial({ color: 0x3a2616, roughness: 0.18 });
  for (const z of [-0.033, 0.033]) {
    const e = new THREE.Group(); e.position.set(-0.7875, 0.1985, z); const R = 0.0132;
    e.add(new THREE.Mesh(new THREE.SphereGeometry(R, 20, 14), white));
    const ir = new THREE.Mesh(new THREE.SphereGeometry(R * 0.5, 14, 10), iris); ir.position.y = R * 0.74; ir.scale.y = 0.55; e.add(ir);
    const lid = new THREE.Mesh(new THREE.SphereGeometry(R * 1.09, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), eyes.lidMat);
    e.add(lid); eyes.lids.push(lid); patient.add(e);
  }
})();

/* Flechas, marcadores y puño del examinador */
const AMBER = 0xf2b134;
function makeArrow() {
  const g = new THREE.Group(); const m = new THREE.MeshStandardMaterial({ color: AMBER, emissive: 0x6b4500, roughness: 0.4, depthTest: true });
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.035, 16), m); head.rotation.x = Math.PI; head.position.y = -0.0175; g.add(head);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.0065, 0.0065, 0.075, 10), m); shaft.position.y = -0.0725; g.add(shaft);
  g.visible = false; return g;
}
const arrow = makeArrow(); arrow.scale.setScalar(1.5);
const markers = [0, 1].map(() => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.014, 16, 12), new THREE.MeshBasicMaterial({ color: AMBER, transparent: true, opacity: 0.85, depthTest: false })); m.renderOrder = 5; m.visible = false; return m; });
const fist = new THREE.Mesh(new RoundedBoxGeometry(0.09, 0.07, 0.08, 3, 0.025), new THREE.MeshStandardMaterial({ color: 0xc89a7a, roughness: 0.6 }));
fist.position.set(0.6, 0.012, 0.10); fist.visible = false; patient.add(fist);
const frames = { tib: { g: tibG, o: K }, thigh: { g: hipG, o: H }, pat: { g: patient, o: new THREE.Vector3() } };
function attach(obj, part, at) { const f = frames[part]; f.g.add(obj); obj.position.set(at[0] - f.o.x, at[1] - f.o.y, at[2] - f.o.z); obj.userData.base = obj.position.clone(); }

/* ---------- Animación de las pruebas ---------- */
const REST = { hip: 0, knee: 0.09, valg: 0, rot: 0, ant: 0 };
const pulse = (u, s0, n) => (u < s0 ? 0 : Math.sin(((u - s0) / (1 - s0)) * n * Math.PI) ** 2);
const ANIM = {
  lach: { dur: 4.2, setup: { hip: 0.2, knee: 0.45 }, f: (u, p) => { p.ant = pulse(u, 0.15, 3) * 0.014; }, arrow: ['tib', [0.53, 0.024, 0.10], [0, 1, 0]] },
  cajA: { dur: 3.8, setup: { hip: 0.8, knee: 1.57 }, f: (u, p) => { p.ant = pulse(u, 0.15, 3) * 0.0025; }, arrow: ['tib', [0.52, 0.135, 0.10], [0, 1, 0]], pull: true },
  piv: { dur: 4, setup: { hip: 0.35, knee: 0.05, rot: -0.22, valg: -0.04 }, f: (u, p) => { p.knee = 0.05 + 0.7 * Math.min(1, u * 1.3); }, arrow: ['tib', [0.47, 0.078, 0.162], [0, 0, -1]] },
  pal: { dur: 3.6, setup: { hip: 0, knee: 0 }, f: () => {}, arrow: ['thigh', [0.4, 0.152, 0.10], [0, -1, 0]], fist: true },
  cajP: { dur: 3.8, setup: { hip: 0.8, knee: 1.57 }, f: (u, p) => { p.ant = -pulse(u, 0.15, 3) * 0.0025; }, arrow: ['tib', [0.52, 0.137, 0.10], [0, -1, 0]] },
  valg: { dur: 3.6, setup: { hip: 0.12, knee: 0.52 }, f: (u, p) => { p.valg = -pulse(u, 0.15, 3) * 0.02; }, arrow: ['tib', [0.47, 0.078, 0.162], [0, 0, -1]] },
  var: { dur: 3.6, setup: { hip: 0.12, knee: 0.52 }, f: (u, p) => { p.valg = pulse(u, 0.15, 3) * 0.02; }, arrow: ['tib', [0.47, 0.078, 0.038], [0, 0, 1]] },
  mcm: { dur: 4.6, setup: { hip: 1.45, knee: 2.1 }, f: (u, p) => { p.knee = 2.1 - 0.6 * u; p.rot = 0.3 * Math.sin(u * 4 * Math.PI); }, markers: [['tib', [0.475, 0.092, 0.045]], ['tib', [0.475, 0.092, 0.157]]] },
  int: { dur: 3, setup: { hip: 0.8, knee: 1.57 }, f: () => {}, markers: [['tib', [0.475, 0.092, 0.045]], ['tib', [0.475, 0.092, 0.157], 0xff6b5e]] },
  apr: { dur: 3.4, setup: { hip: 0.12, knee: 0.52 }, f: () => {}, arrow: ['thigh', [0.472, 0.126, 0.074], [0, 0, 1]] },
  barr: { dur: 4, setup: { hip: 0, knee: 0.09 }, f: () => {}, arrow: ['thigh', [0.4, 0.13, 0.05], [1, 0, 0]], sweep: true },
  ott: { dur: 4.6, setup: { hip: 0.5, knee: 0.3 }, f: (u, p) => { p.knee = 0.3 + 1.35 * Math.sin(u * Math.PI); }, markers: [['thigh', [0.474, 0.142, 0.10]], ['tib', [0.505, 0.07, 0.158]]] },
};
const pose = { ...REST }; let fromPose = { ...REST }, anim = null;
const _up = new THREE.Vector3(0, 1, 0);
function startAnim(id) {
  fromPose = { ...pose }; const a = ANIM[id]; anim = { id, a, t: 0 };
  arrow.visible = false; markers.forEach((m) => (m.visible = false)); fist.visible = false;
  if (a.arrow) { attach(arrow, a.arrow[0], a.arrow[1]); arrow.userData.dir = new THREE.Vector3(...a.arrow[2]); arrow.quaternion.setFromUnitVectors(_up, arrow.userData.dir); }
  (a.markers || []).forEach(([part, at, col], i) => { attach(markers[i], part, at); markers[i].material.color.setHex(col || AMBER); });
}
function resetPose() { fromPose = { ...pose }; anim = { id: 'rest', a: { dur: 0, setup: {}, f: () => {} }, t: 0 }; arrow.visible = false; markers.forEach((m) => (m.visible = false)); fist.visible = false; }
const ease = (x) => x * x * (3 - 2 * x);
function updateAnim(dt) {
  if (!anim) return;
  anim.t += dt; const a = anim.a, B = 0.8;
  const target = { ...REST, ...a.setup };
  if (anim.t < B) { const k = ease(anim.t / B); for (const key in pose) pose[key] = lerp(fromPose[key], target[key], k); }
  else {
    const u = Math.min(1, (anim.t - B) / (a.dur || 1));
    Object.assign(pose, target); a.f(u, pose);
    const on = anim.t - B < (a.dur || 0) + 0.3;
    if (a.arrow) { arrow.visible = on; const push = a.sweep ? 0 : Math.sin(anim.t * 7) * 0.5 + 0.5; const off = a.sweep ? (u * 0.09) : -0.012 * (1 - push); arrow.position.copy(arrow.userData.base).addScaledVector(arrow.userData.dir, off); if (a.sweep) arrow.position.z = arrow.userData.base.z + (u > 0.5 ? 0.1 : 0); }
    if (a.markers) a.markers.forEach((_, i) => { markers[i].visible = true; markers[i].scale.setScalar(1 + 0.25 * Math.sin(anim.t * 6)); });
    fist.visible = !!a.fist && on;
  }
  hipG.rotation.z = pose.hip; kneeG.rotation.z = -pose.knee; kneeG.rotation.y = pose.valg; tibG.rotation.x = pose.rot; tibG.position.y = pose.ant;
}

/* ---------- Globo de habla (VR) ---------- */
const bubble = canvasTex(760, 160);
const bubbleS = new THREE.Sprite(new THREE.SpriteMaterial({ map: bubble.tex, depthTest: false, transparent: true }));
bubbleS.scale.set(0.72, 0.152, 1); bubbleS.position.set(-0.45, 0.5, -0.05); bubbleS.visible = false; bubbleS.renderOrder = 11; patient.add(bubbleS);
let bubbleT = 0;
function paintBubble(t) {
  const g = bubble.g; g.clearRect(0, 0, 760, 160); bubbleT = t ? 7 : 0;
  if (t) { g.font = `700 40px ${FONT}`; const L = wrap(g, t, 700).slice(0, 2); g.fillStyle = '#f1f4ec'; g.beginPath(); g.roundRect(8, 8, 744, 30 + L.length * 50, 14); g.fill(); g.fillStyle = '#14292d'; L.forEach((l, i) => g.fillText(l, 30, 60 + i * 50)); }
  bubble.tex.needsUpdate = true;
}

/* ---------- Estado de etapa y acciones ---------- */
const stageIdx = () => STAGES.findIndex((s) => s.id === c.stage);
function stageInfo() {
  switch (c.stage) {
    case 'anam': return { title: 'Anamnesis', count: `${c.asked.length} de ${Q_LIMIT} preguntas`, hint: 'Elige qué preguntar. Tienes un número limitado de preguntas.', next: 'Pasar a las hipótesis', can: c.asked.length > 0,
      opts: QUESTIONS.map((q) => ({ id: 'q:' + q.id, label: q.label, state: c.asked.includes(q.id) ? 'done' : '', off: c.asked.includes(q.id) || c.asked.length >= Q_LIMIT })) };
    case 'hyp': return { title: 'Hipótesis', count: `${c.hyp.length} de 3`, hint: 'Elige tu hipótesis principal y hasta dos alternativas. La primera que marques es la principal.', next: 'Pasar al examen físico', can: c.hyp.length > 0,
      opts: HYP.map((h) => { const i = c.hyp.indexOf(h.id); return { id: 'h:' + h.id, label: h.label, tag: i === 0 ? 'Principal' : i > 0 ? 'Alternativa' : '', state: i >= 0 ? 'done' : '' }; }) };
    case 'exam': return { title: 'Examen físico', count: `${c.tests.length} de ${T_LIMIT} pruebas`, hint: 'Elige las pruebas que más cambien tu razonamiento.', next: 'Pasar al diagnóstico', can: c.tests.length > 0,
      opts: TESTS.map((t) => { const d = c.tests.includes(t.id); return { id: 't:' + t.id, label: t.label, tag: d ? (t.pos ? 'Positivo' : 'Negativo') : '', state: d ? (t.pos ? 'pos' : 'neg') : '', off: d || c.tests.length >= T_LIMIT }; }) };
    case 'dx': return { title: 'Diagnóstico', count: '', hint: 'Elige el diagnóstico más probable.', next: 'Pasar a la conducta', can: !!c.dx,
      opts: HYP.map((h) => ({ id: 'd:' + h.id, label: h.label, state: c.dx === h.id ? 'done' : '' })) };
    case 'plan': return { title: 'Conducta', count: `${c.plan.length} elegidas`, hint: 'Marca todas las indicaciones que darías hoy.', next: 'Terminar y ver la pauta', can: c.plan.length > 0,
      opts: PLAN.map((p) => ({ id: 'p:' + p.id, label: p.label, state: c.plan.includes(p.id) ? 'done' : '' })) };
  }
}
function setMsg(q, say, find, delta) { lastQ = q || ''; lastSay = say || ''; lastFind = find || ''; lastDelta = delta || ''; renderMsg(); paintBubble(lastSay); panelDirty = true; }
function perform(id) {
  if (id === 'start') return beginCase();
  if (id === 'restart') return restart();
  if (id === 'menu') return goMenu();
  if (phase !== 'running') return;
  if (id === 'next') return advance();
  const [k, v] = id.split(':');
  if (k === 'q') { const q = ask(c, v); if (q) setMsg(q.label, q.a, q.note); }
  else if (k === 'h') toggleHyp(c, v);
  else if (k === 't') {
    const r = runTest(c, v); if (!r) return;
    startAnim(v);
    const d = r.changes.map((x) => `${x.short} ${Math.round(x.from * 100)}% a ${Math.round(x.to * 100)}%`).join(' · ');
    setMsg(`${r.t.label}: ${r.t.pos ? 'positivo' : 'negativo'}`, r.t.say || '', r.t.text, d || 'Sin cambios en tus hipótesis.');
  }
  else if (k === 'd') c.dx = v;
  else if (k === 'p') { const i = c.plan.indexOf(v); if (i >= 0) c.plan.splice(i, 1); else c.plan.push(v); }
  render();
}
function advance() {
  const s = stageInfo(); if (!s.can) return;
  if (c.stage === 'anam') { closeAnamnesis(c); setMsg('', '', 'Con lo que sabes hasta ahora, ¿qué crees que tiene?'); }
  else if (c.stage === 'hyp') { c.stage = 'exam'; setMsg('Inspección', '', INSPECTION); }
  else if (c.stage === 'exam') { c.stage = 'dx'; resetPose(); setMsg('', '', 'Integra la historia y el examen.'); }
  else if (c.stage === 'dx') { c.stage = 'plan'; setMsg('', '', 'Matías espera una respuesta: quiere volver a jugar este año.'); }
  else if (c.stage === 'plan') return finish();
  render();
}

/* ---------- DOM ---------- */
$('iw').textContent = CASE.who; $('iwh').textContent = CASE.where; $('is').textContent = CASE.story; $('ic').textContent = CASE.call;
$('steps').innerHTML = STAGES.map((s) => `<li>${s.label}</li>`).join('');
$('bars').innerHTML = HYP.map((h) => `<div class="pr" id="pr_${h.id}"><span>${h.short}</span><div class="bar"><i></i></div><b></b></div>`).join('');
function renderMsg() { $('q').textContent = lastQ; $('say').textContent = lastSay ? `«${lastSay}»` : ''; $('find').textContent = lastFind; $('delta').textContent = lastDelta; }
function render() {
  const si = stageIdx();
  [...$('steps').children].forEach((li, i) => { li.className = i === si ? 'now' : i < si || phase === 'over' ? 'done' : ''; });
  const showP = ['exam', 'dx', 'plan'].includes(c.stage) || phase === 'over';
  $('prob').style.display = showP ? 'block' : 'none';
  if (showP) for (const h of HYP) { const r = $('pr_' + h.id); r.classList.toggle('mine', c.hyp.includes(h.id)); r.querySelector('i').style.width = `${Math.round(c.probs[h.id] * 100)}%`; r.querySelector('b').textContent = `${Math.round(c.probs[h.id] * 100)}%`; r.querySelector('span').innerHTML = h.short + (c.hyp[0] === h.id ? ' <em>1</em>' : ''); }
  if (phase === 'over') return;
  const s = stageInfo();
  $('stageHead').querySelector('h2').textContent = s.title; $('stageHead').querySelector('span').textContent = s.count; $('stageHint').textContent = s.hint;
  $('acts').innerHTML = '';
  for (const o of s.opts) {
    const b = document.createElement('button'); b.className = 'act' + (o.state ? ' ' + o.state : ''); b.disabled = !!o.off;
    b.innerHTML = '<span></span>'; b.firstChild.textContent = o.label;
    if (o.tag) { const t = document.createElement('small'); t.textContent = o.tag; b.appendChild(t); }
    b.onclick = () => perform(o.id); $('acts').appendChild(b);
  }
  $('next').textContent = s.next; $('next').disabled = !s.can;
  panelDirty = true;
}
$('next').onclick = () => perform('next'); $('restart').onclick = () => perform('restart'); $('menu').onclick = () => perform('menu');
$('cartT').onclick = () => { const o = $('cart').classList.toggle('open'); $('cartT').textContent = o ? 'Cerrar panel' : 'Abrir panel'; };
for (const el of [$('cart'), $('deb'), $('msg')]) el.addEventListener('beforexrselect', (e) => e.preventDefault());
$('sReal').onclick = () => setARScale(1); $('sMesa').onclick = () => setARScale(0.38);

function finish() {
  phase = 'over'; resetPose(); render(); panelDirty = true;
  const d = debrief(c);
  $('debIn').innerHTML = `<h2>Pauta del caso</h2><p></p><div id="rows"></div><h3>Para recordar</h3><ul class="learn"></ul><button id="again">Atender de nuevo</button> <button id="toMenu" class="alt" style="padding:13px 18px;border:0;background:transparent;color:var(--scrub);box-shadow:inset 0 0 0 2px var(--scrub);font-size:18px;font-weight:700;border-radius:3px">Volver a los módulos</button><p id="refs">Pruebas: Benjaminse 2006 (Lachman, pivot shift), Solomon 2001 (cajón anterior), Hesmerg 2024 (signo de la palanca), Rubinstein 1994 (cajón posterior), Hegedus 2007 (McMurray, interlínea), Bachmann 2004 (Ottawa). Valgo, aprehensión, derrame e historia usan valores didácticos aproximados.</p>`;
  $('debIn').querySelector('p').textContent = `${d.score} de ${d.total} objetivos cumplidos. Diagnóstico real: rotura de LCA.`;
  for (const it of d.items) { const r = document.createElement('div'); r.className = 'row ' + (it.ok ? 'ok' : 'no'); r.innerHTML = '<i></i><b></b><span></span>'; r.querySelector('i').textContent = it.ok ? '✓' : '✕'; r.querySelector('b').textContent = it.label; r.querySelector('span').textContent = it.detail; $('rows').appendChild(r); }
  for (const n of d.learn) { const li = document.createElement('li'); li.textContent = n; $('debIn').querySelector('ul').appendChild(li); }
  $('again').onclick = restart; $('toMenu').onclick = goMenu;
  if (!xrMode || handheld) $('deb').style.display = 'flex';
}
function restart() {
  c = createCase(); $('deb').style.display = 'none'; resetPose(); setMsg('', '', '');
  phase = xrMode && !handheld ? 'ready' : 'running'; render(); panelDirty = true;
}
function beginCase() { phase = 'running'; setMsg('', '', 'Matías está en la camilla. Empieza por la anamnesis.'); render(); }
async function goMenu() { const s = renderer.xr.getSession(); if (s) { try { await s.end(); } catch (e) {} } location.href = 'index.html'; }

/* ---------- Panel VR ---------- */
const panel = canvasTex(1024, 1180);
const panelMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.94, 1.083), new THREE.MeshBasicMaterial({ map: panel.tex, transparent: true }));
panelMesh.position.set(1.25, 1.42, 0.08); panelMesh.rotation.y = -0.55; panelMesh.visible = false; panelMesh.userData.panel = true; world.add(panelMesh);
let panelBtns = [], hover = null, panelDirty = true;
function drawPanel() {
  panelDirty = false; const g = panel.g, W = 1024, PH = 1180; panelBtns = [];
  g.clearRect(0, 0, W, PH); g.fillStyle = '#0f3f44'; g.beginPath(); g.roundRect(0, 0, W, PH, 18); g.fill(); g.textAlign = 'left';
  const para = (t, x, y, w, size, col, weight = 400, lh = 1.28) => { g.font = `${weight} ${size}px ${FONT}`; g.fillStyle = col; for (const l of wrap(g, t, w)) { g.fillText(l, x, y); y += size * lh; } return y; };
  const btn = (id, x, y, w, h, label, state, tag) => {
    panelBtns.push({ id, x, y, w, h });
    g.fillStyle = hover === id ? '#ffffff' : state === 'done' ? '#9fe6d2' : state === 'pos' ? '#ffb4ab' : state === 'neg' ? '#9fe6d2' : state === 'go' ? '#f2b134' : state === 'off' ? '#5e7d80' : '#f1f4ec';
    g.beginPath(); g.roundRect(x, y, w, h, 8); g.fill(); g.fillStyle = '#14292d'; g.font = `700 ${h < 70 ? 26 : 29}px ${FONT}`;
    const L = wrap(g, label, w - (tag ? 150 : 32)).slice(0, 2);
    L.forEach((t, i) => g.fillText(t, x + 16, y + h / 2 + 10 - (L.length - 1) * 16 + i * 32));
    if (tag) { g.font = `700 22px ${FONT}`; g.textAlign = 'right'; g.fillText(tag, x + w - 14, y + h / 2 + 8); g.textAlign = 'left'; }
  };
  if (phase === 'ready') {
    let y = para(CASE.who, 44, 92, 930, 58, '#f1f4ec', 700);
    y = para(CASE.where, 44, y + 4, 930, 34, '#9fe6d2');
    y = para(CASE.story, 44, y + 30, 930, 40, '#f1f4ec');
    y = para(CASE.call, 44, y + 26, 930, 40, '#f2b134', 700);
    para('Apunta y aprieta el gatillo, o pellizca con la mano. Las pruebas se verán en la rodilla derecha de Matías.', 44, y + 28, 930, 32, '#9fe6d2');
    btn('start', 44, PH - 270, 936, 110, 'Comenzar el caso', 'go'); btn('menu', 44, PH - 140, 936, 90, 'Volver a los módulos');
  } else if (phase === 'over') {
    const d = debrief(c);
    let y = para('Pauta del caso', 44, 80, 930, 50, '#f1f4ec', 700);
    y = para(`${d.score} de ${d.total} objetivos. Diagnóstico real: rotura de LCA.`, 44, y, 930, 30, '#9fe6d2') + 8;
    for (const it of d.items) { g.font = `700 32px ${FONT}`; g.fillStyle = it.ok ? '#9fe6d2' : '#ff8f84'; g.fillText(it.ok ? '✓' : '✕', 44, y + 26); g.fillStyle = '#f1f4ec'; g.font = `700 30px ${FONT}`; g.fillText(it.label, 88, y + 26); y += 54; if (!it.ok) y = para(it.detail, 88, y + 6, 880, 24, '#f1f4ecb0', 400, 1.2) - 10; }
    btn('restart', 44, PH - 228, 936, 88, 'Atender de nuevo', 'go'); btn('menu', 44, PH - 124, 936, 88, 'Volver a los módulos');
  } else {
    const s = stageInfo();
    g.fillStyle = '#f1f4ec'; g.font = `700 46px ${FONT}`; g.fillText(`${stageIdx() + 1}. ${s.title}`, 44, 72);
    g.font = `400 30px ${FONT}`; g.fillStyle = '#9fe6d2'; g.textAlign = 'right'; g.fillText(s.count, 980, 70); g.textAlign = 'left';
    g.fillStyle = '#082a2e'; g.fillRect(44, 96, 936, 196);
    let y = 136;
    if (lastQ) y = para(lastQ, 64, y, 900, 27, '#9fe6d2', 700, 1.15);
    if (lastSay) y = para(`«${lastSay}»`, 64, y + 4, 900, 31, '#f1f4ec', 700, 1.18);
    y = para(lastFind || s.hint, 64, y + 4, 900, 27, lastFind ? '#9fe6d2' : '#f1f4ecb0', 400, 1.2);
    if (lastDelta) para(lastDelta, 64, y + 2, 900, 25, '#f2b134', 400, 1.2);
    y = 312;
    if (['exam', 'dx', 'plan'].includes(c.stage)) {
      HYP.forEach((h, i) => {
        const yy = y + i * 31, p = c.probs[h.id], mine = c.hyp.includes(h.id);
        g.font = `${mine ? 700 : 400} 24px ${FONT}`; g.fillStyle = mine ? '#f2b134' : '#f1f4ec'; g.fillText(h.short, 44, yy + 21);
        g.fillStyle = '#f1f4ec22'; g.fillRect(190, yy + 6, 690, 18); g.fillStyle = mine ? '#f2b134' : '#f1f4ec'; g.fillRect(190, yy + 6, 690 * p, 18);
        g.textAlign = 'right'; g.fillText(`${Math.round(p * 100)}%`, 980, yy + 22); g.textAlign = 'left';
      });
      y += 7 * 31 + 14;
    }
    const one = c.stage === 'plan', cols = one ? 1 : 2, gap = 12;
    const rows = Math.ceil(s.opts.length / cols);
    const avail = PH - 128 - y, bh = Math.min(96, Math.floor(avail / rows) - gap), bw = (936 - (cols - 1) * 16) / cols;
    s.opts.forEach((o, i) => btn(o.id, 44 + (i % cols) * (bw + 16), y + Math.floor(i / cols) * (bh + gap), bw, bh, o.label, o.state || (o.off ? 'off' : ''), o.tag));
    btn('next', 44, PH - 112, 936, 84, s.next, s.can ? 'go' : 'off');
  }
  panel.tex.needsUpdate = true;
}

/* ---------- Entrada ---------- */
$('go2D').onclick = () => { $('intro').style.display = 'none'; $('hud').style.display = 'block'; beginCase(); frameView(); };
(async function detectXR() {
  const note = $('xrnote'); let vr = false, ar = false;
  try { if (navigator.xr) { vr = await navigator.xr.isSessionSupported('immersive-vr'); ar = await navigator.xr.isSessionSupported('immersive-ar'); } } catch (e) {}
  if (vr) { $('goVR').hidden = false; $('goVR').onclick = () => enterXR('immersive-vr'); }
  if (ar) { $('goAR').hidden = false; $('goAR').onclick = () => enterXR('immersive-ar'); }
  let url = null;
  if (location.protocol !== 'file:') try { const r = await fetch('lan.json', { cache: 'no-store' }); if (r.ok) { const j = await r.json(); if (j.url) url = new URL(location.pathname.split('/').pop() || '', j.url).href; } } catch (e) {}
  const hosted = location.protocol === 'https:' && !/^(localhost|127\.|10\.|192\.168\.|172\.)/.test(location.hostname);
  if (!url && hosted) url = location.origin + location.pathname;
  if (vr || ar) note.textContent = '';
  else if (url) note.textContent = 'Esta pantalla no tiene VR ni AR. Escanea el código con el visor o con un Android para abrir el caso allí.';
  else if (location.protocol === 'file:') note.textContent = 'Para usarlo en visor o teléfono, publícalo en internet o abre PacienteXR.exe: las instrucciones están en el README.';
  else note.textContent = /iPhone|iPad/.test(navigator.userAgent) ? 'Safari en iPhone no permite WebXR: aquí funciona solo en pantalla.' : 'Este navegador no ofrece VR ni AR. Prueba Chrome en Android o el navegador de Meta Quest.';
  if (url && !vr && !ar) { const q = qrcode(0, 'M'); q.addData(url); q.make(); $('qr').style.display = 'flex'; $('qr').innerHTML = q.createSvgTag({ cellSize: 3, margin: 0, scalable: true }) + '<span></span>'; $('qr').querySelector('span').textContent = url; }
})();

let hitSource = null, reticle = null, arScale = 1, placedOnce = false;
async function enterXR(mode) {
  const opts = { optionalFeatures: ['local-floor', 'hand-tracking', 'layers'] };
  if (mode === 'immersive-ar') { opts.optionalFeatures.push('hit-test', 'dom-overlay'); opts.domOverlay = { root: $('hud') }; }
  let session;
  try { session = await navigator.xr.requestSession(mode, opts); } catch (e) { $('xrnote').textContent = `No se pudo iniciar la sesión inmersiva: ${e.message}`; return; }
  xrMode = mode; handheld = !!session.domOverlayState;
  renderer.xr.setReferenceSpaceType('local-floor');
  try { await renderer.xr.setSession(session); } catch (e) { renderer.xr.setReferenceSpaceType('local'); await renderer.xr.setSession(session); world.position.y = -1.4; }
  controls.enabled = false; $('intro').style.display = 'none';
  room.visible = mode === 'immersive-vr';
  scene.background = mode === 'immersive-vr' ? new THREE.Color(0xe6e8e1) : null;
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
      if (!reticle) { reticle = new THREE.Mesh(new THREE.RingGeometry(0.11, 0.135, 36).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: AMBER })); reticle.matrixAutoUpdate = false; reticle.visible = false; scene.add(reticle); }
    } else if (handheld) beginCase(); else phase = 'ready';
  } else if (phase !== 'running') phase = 'ready';
  render(); panelDirty = true;
}
function onEnd() {
  xrMode = null; handheld = false; hitSource = null;
  document.documentElement.classList.remove('ar'); document.body.classList.remove('ar');
  world.visible = true; world.scale.setScalar(1); world.position.set(0, 0, -0.95); world.rotation.set(0, 0, 0); room.visible = true; scene.background = null; renderer.setClearAlpha(1);
  panelMesh.visible = false; bubbleS.visible = false; $('place').style.display = 'none'; $('arbar').style.display = 'none'; if (reticle) reticle.visible = false;
  controls.enabled = true; $('hud').style.display = 'block'; if (phase === 'ready' || phase === 'placing') beginCase();
  if (phase === 'over') finish(); frameView();
}
function setARScale(k) { arScale = k; if (placedOnce) world.scale.setScalar(k); }
const _p = new THREE.Vector3(), _c = new THREE.Vector3();
function placeWorld() {
  _p.setFromMatrixPosition(reticle.matrix); world.position.copy(_p);
  renderer.xr.getCamera().getWorldPosition(_c); world.rotation.y = Math.atan2(_c.x - _p.x, _c.z - _p.z);
  world.scale.setScalar(arScale); world.visible = true; reticle.visible = false; placedOnce = true; $('place').style.display = 'none'; beginCase();
}

/* ---------- Selección en VR ---------- */
const ray = new THREE.Raycaster();
function panelHit() {
  if (!panelMesh.visible) return null; const h = ray.intersectObject(panelMesh, false)[0]; if (!h) return null;
  const x = h.uv.x * 1024, y = (1 - h.uv.y) * 1180; const b = panelBtns.find((p) => x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h);
  return b ? b.id : null;
}
const ctrls = []; const _rot = new THREE.Matrix4();
function rayFrom(ct) { _rot.identity().extractRotation(ct.matrixWorld); ray.ray.origin.setFromMatrixPosition(ct.matrixWorld); ray.ray.direction.set(0, 0, -1).applyMatrix4(_rot); }
for (let i = 0; i < 2; i++) {
  const ct = renderer.xr.getController(i);
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]), new THREE.LineBasicMaterial({ color: AMBER })); line.scale.z = 3; line.visible = false; ct.add(line); scene.add(ct); ctrls.push(ct);
  ct.addEventListener('connected', (e) => { ct.userData.src = e.data; line.visible = e.data.targetRayMode !== 'screen'; });
  ct.addEventListener('disconnected', () => { line.visible = false; ct.userData.src = null; });
  ct.addEventListener('select', () => {
    if (!xrMode) return;
    if (phase === 'placing') { if (reticle && reticle.visible) placeWorld(); return; }
    rayFrom(ct); const id = panelHit(); if (id) perform(id);
  });
}

/* ---------- Bucle ---------- */
let last = performance.now(), ph = 0, blink = 0, nextBlink = 3;
function frame(now, xf) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  updateAnim(dt);
  ph += dt * (16 / 60) * Math.PI * 2; U.uBreath.value = (Math.sin(ph) * 0.5 + 0.5) * 0.0035;
  nextBlink -= dt; if (nextBlink < 0) { blink = 1; nextBlink = 2 + Math.random() * 4; } blink = Math.max(0, blink - dt * 7);
  const pain = anim && ['piv', 'cajA', 'mcm'].includes(anim.id) && anim.t > 0.8 && anim.t < 4.5 ? 0.55 : 0;
  for (const l of eyes.lids) l.rotation.z = 0.1 + (1 - pain) * 1.95 * (1 - blink);
  if (bubbleT > 0) { bubbleT -= dt; if (bubbleT <= 0) paintBubble(''); }
  if (phase === 'placing' && xf && hitSource) {
    const res = xf.getHitTestResults(hitSource);
    if (res.length) { const pose = res[0].getPose(renderer.xr.getReferenceSpace()); reticle.visible = true; reticle.matrix.fromArray(pose.transform.matrix); } else reticle.visible = false;
  }
  if (xrMode && panelMesh.visible) { let hv = null; for (const ct of ctrls) { if (!ct.userData.src) continue; rayFrom(ct); hv = panelHit() || hv; } if (hv !== hover) { hover = hv; panelDirty = true; } }
  if (panelMesh.visible && panelDirty) drawPanel();
  if (!xrMode) controls.update();
  renderer.render(scene, camera);
}
addEventListener('resize', () => { if (renderer.xr.isPresenting) return; camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight, false); });

/* ---------- Carga ---------- */
async function decode(b64) {
  const bin = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
  const buf = await new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer();
  const h = new Float32Array(buf, 0, 8); const nv = h[0], ni = h[1]; const mn = [h[2], h[3], h[4]], mx = [h[5], h[6], h[7]];
  let off = 32;
  const q = new Uint16Array(buf.slice(off, off + nv * 6)); off += nv * 6;
  const n = new Int8Array(buf.slice(off, off + nv * 3)); off += nv * 3;
  const col = new Uint8Array(buf, off, nv * 3); off += nv * 3;
  const m4 = new Uint8Array(buf.slice(off, off + nv * 4)); off += nv * 4;
  const idx = new Uint16Array(buf.slice(off, off + ni * 2));
  const pos = new Float32Array(nv * 3), lin = new Float32Array(nv * 3);
  for (let i = 0; i < nv * 3; i++) { pos[i] = mn[i % 3] + (q[i] / 65535) * (mx[i % 3] - mn[i % 3]); lin[i] = Math.pow(col[i] / 255, 2.2); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(n, 3, true));
  g.setAttribute('color', new THREE.BufferAttribute(lin, 3)); g.setAttribute('aMask', new THREE.BufferAttribute(m4, 4, true));
  g.setIndex(new THREE.BufferAttribute(idx, 1)); return g;
}
async function loadMesh() {
  const parts = JSON.parse($('mesh').textContent);
  for (const [name, b64] of Object.entries(parts)) {
    const m = new THREE.Mesh(await decode(b64), skinMat);
    if (name === 'thighR') { m.position.copy(H).negate(); hipG.add(m); }
    else if (name === 'shankR') { m.position.copy(K).negate(); tibG.add(m); }
    else patient.add(m);
  }
}
(async () => {
  try { await Promise.all([document.fonts.load(`700 40px ${FONT}`), document.fonts.load(`400 30px ${FONT}`)]); } catch (e) {}
  await loadMesh(); updateAnim(0); hipG.rotation.z = 0; kneeG.rotation.z = -REST.knee;
  render(); renderer.setAnimationLoop(frame);
})();

window.rodilla = { get c() { return c; }, perform, get phase() { return phase; }, camera, controls, panelMesh, drawPanel, startAnim, pose };
