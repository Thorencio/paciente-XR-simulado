// Modelo fisiológico simplificado y didáctico. Tiempo en minutos simulados.
// No es un modelo farmacocinético validado: reproduce la forma general del cuadro.

export const TIME_SCALE = 3; // 1 s real = 3 s simulados
const CASE_LIMIT = 20; // min simulados

export const CASE = {
  who: 'Sr. Tapia, 46 años, 82 kg',
  where: 'Sala de observación de urgencias',
  story: 'Pielonefritis aguda. Hace 8 minutos comenzó ceftriaxona 1 g EV por la vía del antebrazo. Sin alergias conocidas.',
  call: 'El técnico te llama: el paciente dice que le pica todo el cuerpo y que le cuesta respirar.',
};

export const ACTIONS = [
  { id: 'help', group: 'Organizar', label: 'Llamar al equipo' },
  { id: 'stop', group: 'Organizar', label: 'Suspender ceftriaxona' },
  { id: 'im', group: 'Fármacos', label: 'Adrenalina 0,5 mg IM', hint: 'Elige el sitio de punción en el paciente' },
  { id: 'ivbolus', group: 'Fármacos', label: 'Adrenalina 1 mg EV directo' },
  { id: 'salb', group: 'Fármacos', label: 'Salbutamol nebulizado' },
  { id: 'chlor', group: 'Fármacos', label: 'Clorfenamina 10 mg EV' },
  { id: 'hydro', group: 'Fármacos', label: 'Hidrocortisona 200 mg EV' },
  { id: 'o2', group: 'Soporte', label: 'Oxígeno con reservorio', toggle: true },
  { id: 'legs', group: 'Soporte', label: 'Tender y elevar piernas', toggle: true },
  { id: 'fluid', group: 'Soporte', label: 'Bolo cristaloide 500 mL' },
];

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function createSim() {
  const s = {
    t: 0,
    A: 0.30, B: 0.32, C: 0.34, U: 0.55,
    D: 1, trigger: true,
    depots: [], E: 0,
    o2: false, legs: false, volume: 0, infusing: 0, mlGiven: 0,
    nebUntil: -1, arrhythmia: 0, ivBoluses: 0,
    stableFor: 0, lowFor: 0,
    outcome: null, // 'stable' | 'arrest'
    log: {}, doses: [], events: [],
    vitals: null,
  };
  s.vitals = derive(s);
  return s;
}

function effect(s) { return s.E / (s.E + 0.26); }

export function derive(s) {
  const eff = effect(s);
  const arr = s.arrhythmia > 0 ? 1 : 0;
  let sbp = 130 - 96 * s.C + 26 * s.volume + 20 * eff + (s.legs ? 6 : 0) + arr * 55;
  let spo2 = 98.5 - 15 * s.B - 22 * s.A * s.A + (s.o2 ? 6 * (1 - 0.4 * s.A) : 0);
  spo2 = Math.min(100, spo2);
  if (sbp < 70) spo2 -= (70 - sbp) * 0.25;
  let hr = 80 + 60 * s.C + 14 * s.B + 16 * eff + arr * 45;
  if (sbp < 60) hr -= (60 - sbp) * 4;
  let rr = 16 + 16 * s.B + 12 * s.A;
  if (sbp > 126) sbp = 126 + (sbp - 126) * 0.3 + arr * 30;
  const dbp = sbp * 0.56 + 4;
  const map = (sbp + 2 * dbp) / 3;
  let gcs = 15;
  if (map < 62 || spo2 < 88) gcs = 14;
  if (map < 52 || spo2 < 82) gcs = 12;
  if (map < 44 || spo2 < 75) gcs = 8;
  if (gcs <= 8) rr *= 0.7;
  if (s.outcome === 'arrest') { hr = 0; rr = 0; sbp = 0; spo2 = 0; gcs = 3; return { hr, rr, sbp, dbp: 0, map: 0, spo2, gcs }; }
  const j = Math.sin(s.t * 7.3) + Math.sin(s.t * 3.1 + 1);
  return {
    hr: Math.round(hr + j * 1.5), rr: Math.round(rr + j * 0.5),
    sbp: Math.round(sbp), dbp: Math.round(dbp), map: Math.round(map),
    spo2: Math.round(clamp(spo2 + j * 0.3, 0, 100)), gcs,
  };
}

export function step(s, dt) {
  if (s.outcome) return;
  s.t += dt;
  // Mediadores: con el gatillo activo persisten; al suspenderlo decaen lentamente.
  if (s.trigger) s.D = 1;
  else s.D += (0.28 - s.D) * Math.min(1, dt / 5);
  if (!s.trigger && s.t > 0) s.D = Math.max(0.06, s.D - 0.012 * dt);

  for (const d of s.depots) {
    const abs = Math.min(d.amt, d.ka * d.amt * dt);
    d.amt -= abs; s.E += abs * d.bio;
  }
  s.E -= (s.E * dt) / 5;
  const eff = effect(s);

  const neb = s.t < s.nebUntil ? 1 : 0;
  s.A = clamp(s.A + dt * (0.10 * s.D * (1 - s.A) - 0.27 * eff * s.A), 0, 1);
  s.B = clamp(s.B + dt * (0.12 * s.D * (1 - s.B) - 0.31 * eff * s.B - 0.07 * neb * s.B), 0, 1);
  s.C = clamp(s.C + dt * (0.15 * s.D * (1 - s.C) - 0.31 * eff * s.C), 0, 1);
  s.U = clamp(s.U + dt * (0.13 * s.D * (1 - s.U) - 0.16 * eff * s.U - (s.log.chlor != null ? 0.06 * s.U : 0)), 0, 1);

  if (s.infusing > 0) {
    const r = Math.min(s.infusing, 0.1 * dt);
    s.infusing -= r; s.volume = clamp(s.volume + r, 0, 1);
  }
  s.volume = clamp(s.volume - 0.018 * s.C * dt, 0, 1);
  s.arrhythmia = Math.max(0, s.arrhythmia - dt);

  const v = derive(s);
  s.vitals = v;
  // Paro
  if (v.sbp < 50 || v.spo2 < 68) s.lowFor += dt; else s.lowFor = 0;
  if (s.lowFor > 0.4) { s.outcome = 'arrest'; s.vitals = derive(s); return; }
  // Estabilización
  const ok = v.sbp >= 100 && v.spo2 >= 94 && s.A < 0.2 && s.B < 0.24 && !s.trigger;
  s.stableFor = ok ? s.stableFor + dt : 0;
  if (s.stableFor >= 1.5) s.outcome = 'stable';
  else if (s.t >= CASE_LIMIT) s.outcome = 'partial';
}

// Devuelve un mensaje para mostrar o null.
export function act(s, id, arg) {
  if (s.outcome) return null;
  const first = (k) => { if (s.log[k] == null) s.log[k] = s.t; };
  switch (id) {
    case 'help':
      if (s.log.help != null) return 'El equipo ya viene en camino.';
      first('help');
      return 'Equipo de reanimación avisado. Carro de paro al box.';
    case 'stop':
      if (!s.trigger) return 'La infusión ya está suspendida.';
      s.trigger = false; first('stop');
      return 'Ceftriaxona suspendida y desconectada. La vía queda permeable.';
    case 'im': {
      first('im');
      const last = s.doses[s.doses.length - 1];
      const site = arg === 'deltoid' ? 'deltoid' : 'thigh';
      s.doses.push({ t: s.t, site });
      s.depots.push(site === 'thigh' ? { amt: 1, ka: 0.5, bio: 1 } : { amt: 1, ka: 0.2, bio: 0.65 });
      const n = s.doses.length;
      const lugar = site === 'thigh' ? 'cara anterolateral del muslo' : 'deltoides';
      if (last && s.t - last.t < 3) return `Dosis ${n} en ${lugar}, solo ${fmtGap(s.t - last.t)} después de la anterior.`;
      return `Dosis ${n} de adrenalina IM en ${lugar}.`;
    }
    case 'ivbolus':
      first('ivbolus'); s.ivBoluses++; s.arrhythmia = 2.5;
      if (s.ivBoluses >= 2) { s.outcome = 'arrest'; s.vitals = derive(s); return 'Fibrilación ventricular tras el segundo bolo EV de adrenalina.'; }
      return 'Taquicardia ventricular no sostenida, PA disparada. El paciente refiere dolor torácico.';
    case 'salb':
      first('salb'); s.nebUntil = s.t + 8;
      return s.log.im == null ? 'Nebulización iniciada. No reemplaza a la adrenalina.' : 'Nebulización con salbutamol iniciada.';
    case 'chlor':
      if (s.log.chlor != null) return 'Ya se administró clorfenamina.';
      first('chlor');
      return 'Clorfenamina administrada. Puede aliviar la piel; no trata vía aérea, respiración ni circulación.';
    case 'hydro':
      if (s.log.hydro != null) return 'Ya se administró hidrocortisona.';
      first('hydro');
      return 'Hidrocortisona administrada. Sin efecto en los próximos minutos.';
    case 'o2':
      s.o2 = !s.o2; if (s.o2) first('o2');
      return s.o2 ? 'Mascarilla con reservorio a 15 L/min.' : 'Oxígeno retirado.';
    case 'legs':
      s.legs = !s.legs; if (s.legs) first('legs');
      return s.legs ? 'Paciente tendido con piernas elevadas.' : 'Piernas bajadas.';
    case 'fluid':
      first('fluid'); s.infusing += 0.5; s.mlGiven += 500;
      return `Bolo de 500 mL pasando rápido. Total indicado: ${s.mlGiven} mL.`;
  }
  return null;
}

function fmtGap(min) { const sec = Math.round(min * 60); return `${sec} s`; }
export const fmtClock = (min) => {
  const sec = Math.floor(min * 60);
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
};

export function speech(s) {
  if (s.outcome === 'arrest') return '';
  const v = s.vitals;
  if (v.gcs <= 8) return '';
  if (v.gcs <= 12) return '…no… veo…';
  if (s.outcome === 'stable') return 'Ya respiro mejor. Qué susto.';
  if (s.A > 0.62) return 'No… me pasa… el aire…';
  if (v.sbp < 80) return 'Me voy a desmayar…';
  if (s.A > 0.42) return 'Se me cierra la garganta.';
  if (s.B > 0.38) return 'Me cuesta sacar el aire, me aprieta el pecho.';
  if (s.U > 0.3) return 'Sigue picándome, pero respiro mejor.';
  return 'Me siento bastante mejor.';
}

export function exam(s, part) {
  const v = s.vitals;
  if (s.outcome === 'arrest') return { title: 'Sin respuesta', text: 'No responde, no respira y no tiene pulso central.' };
  switch (part) {
    case 'airway':
      return { title: 'Vía aérea', sound: 'stridor', level: s.A, text:
        s.A > 0.6 ? 'Estridor audible en reposo. Labios y lengua muy edematosos. Apenas logra hablar.' :
        s.A > 0.36 ? 'Voz ronca, edema de labios y úvula. Estridor inspiratorio leve.' :
        s.A > 0.2 ? 'Voz algo disfónica. Edema labial leve. Sin estridor.' : 'Voz normal. Edema labial en retroceso.' };
    case 'chest':
      return { title: 'Auscultación', sound: 'wheeze', level: s.B, text:
        s.B > 0.65 ? `Murmullo muy disminuido, tórax casi silente. FR ${v.rr}. Uso de musculatura accesoria.` :
        s.B > 0.34 ? `Sibilancias espiratorias difusas. FR ${v.rr}, espiración prolongada.` :
        s.B > 0.2 ? `Sibilancias aisladas. FR ${v.rr}.` : `Murmullo vesicular simétrico, sin sibilancias. FR ${v.rr}.` };
    case 'pulse':
      return { title: 'Pulso y perfusión', text:
        v.sbp < 75 ? 'Pulso radial ausente, femoral débil. Llene capilar de 5 s. Piel fría y sudorosa.' :
        v.sbp < 95 ? `Pulso radial filiforme a ${v.hr}/min. Llene capilar de 4 s.` :
        v.sbp < 110 ? `Pulso radial presente a ${v.hr}/min. Llene capilar de 3 s.` : `Pulso radial lleno a ${v.hr}/min. Llene capilar menor a 2 s.` };
    case 'skin':
      return { title: 'Piel', text:
        s.U > 0.45 ? 'Habones confluentes y eritema en tronco, cuello y brazos. Prurito intenso.' :
        s.U > 0.22 ? 'Habones dispersos, en retroceso.' : 'Eritema tenue, sin habones nuevos.' };
  }
}

export function debrief(s) {
  const t = (k) => (s.log[k] == null ? null : s.log[k]);
  const items = [];
  const add = (ok, label, detail) => items.push({ ok, label, detail });
  const im = t('im');
  add(im != null && im <= 3, 'Adrenalina IM precoz', im == null ? 'No se administró.' : `Primera dosis al minuto ${fmtClock(im)}. Objetivo del caso: antes de 3 min.`);
  if (s.doses.length) {
    const allThigh = s.doses.every((d) => d.site === 'thigh');
    add(allThigh, 'Sitio de punción', allThigh ? 'Cara anterolateral del muslo.' : 'Se usó deltoides: la absorción es peor que en el muslo.');
    const persisted = s.doses.length >= 2 || s.t - s.doses[0].t >= 5;
    if (persisted) {
      const gap = s.doses.length >= 2 ? s.doses[1].t - s.doses[0].t : null;
      add(gap != null && gap >= 4 && gap <= 7, 'Repetición de la dosis', gap == null ? 'Persistían síntomas a los 5 min y no se repitió.' : `Segunda dosis ${fmtClock(gap)} después de la primera. Se repite a los 5 min si persisten problemas A, B o C.`);
    }
  }
  add(t('stop') != null && t('stop') <= 2, 'Suspender el fármaco causal', t('stop') == null ? 'La ceftriaxona siguió pasando.' : `Suspendida al minuto ${fmtClock(t('stop'))}.`);
  add(t('help') != null, 'Pedir ayuda', t('help') == null ? 'No se llamó al equipo.' : `Al minuto ${fmtClock(t('help'))}.`);
  add(t('o2') != null, 'Oxígeno en alta concentración', t('o2') == null ? 'No se indicó.' : `Al minuto ${fmtClock(t('o2'))}.`);
  add(t('legs') != null, 'Posición con hipotensión', t('legs') == null ? 'No se tendió ni se elevaron las piernas.' : `Al minuto ${fmtClock(t('legs'))}.`);
  add(s.mlGiven >= 500, 'Volumen EV por hipotensión', s.mlGiven ? `${s.mlGiven} mL indicados.` : 'No se indicaron fluidos.');
  add(s.ivBoluses === 0, 'Sin bolo EV de adrenalina', s.ivBoluses ? 'Fuera de paro y de manos especializadas, el bolo EV arriesga arritmias graves.' : 'Evitado.');
  const early = ['chlor', 'hydro'].filter((k) => t(k) != null && (im == null || t(k) < im));
  add(early.length === 0, 'Adrenalina antes que fármacos de segunda línea', early.length ? 'Antihistamínico o corticoide antes de la adrenalina: no tratan A, B ni C.' : 'Prioridad correcta.');
  const obs = s.doses.length >= 3 ? 'al menos 12 h' : s.doses.length === 2 ? 'mínimo 6 h' : 'según riesgo, 2 a 6 h';
  const next = s.outcome === 'stable'
    ? [`Observar ${obs} tras la resolución; vigilar reacción bifásica.`, 'Triptasa sérica: idealmente antes de 2 h y no después de 4 h del inicio.', 'Registrar alergia a ceftriaxona, autoinyector y derivar a alergología.']
    : s.outcome === 'partial' && s.doses.length < 2
      ? ['Persistían problemas A o B: correspondía repetir la adrenalina IM a los 5 min.', 'Dos dosis IM sin mejoría definen anafilaxia refractaria.']
      : ['Dos dosis IM sin mejoría definen anafilaxia refractaria: infusión de adrenalina y apoyo crítico.', 'En paro: RCP y adrenalina según protocolo de reanimación.'];
  return { items, next, score: items.filter((i) => i.ok).length, total: items.length };
}
