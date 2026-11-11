// Caso de razonamiento clínico: rodilla aguda.
// Las pruebas del examen usan razones de verosimilitud publicadas (ver src).
// Los hallazgos de la anamnesis usan valores didácticos aproximados.

export const CASE = {
  who: 'Matías Rojas, 24 años',
  where: 'Consulta de kinesiología',
  story: 'Estudiante de enfermería y futbolista amateur. Hace 5 días se lesionó la rodilla derecha en un partido. Llega caminando, cojeando, derivado por su entrenador.',
  call: 'Tu tarea es razonar el caso: pregunta, plantea hipótesis, examina y decide la conducta.',
};

export const STAGES = [
  { id: 'anam', label: 'Anamnesis' },
  { id: 'hyp', label: 'Hipótesis' },
  { id: 'exam', label: 'Examen físico' },
  { id: 'dx', label: 'Diagnóstico' },
  { id: 'plan', label: 'Conducta' },
];

export const HYP = [
  { id: 'lca', label: 'Rotura de LCA', short: 'LCA', prior: 0.25 },
  { id: 'men', label: 'Lesión meniscal', short: 'Menisco', prior: 0.25 },
  { id: 'lcm', label: 'Esguince de LCM', short: 'LCM', prior: 0.2 },
  { id: 'rot', label: 'Luxación de rótula', short: 'Rótula', prior: 0.08 },
  { id: 'fx', label: 'Fractura', short: 'Fractura', prior: 0.07 },
  { id: 'lcp', label: 'Rotura de LCP', short: 'LCP', prior: 0.04 },
  { id: 'leve', label: 'Contusión o esguince leve', short: 'Leve', prior: 0.3 },
];
export const TRUTH = 'lca';

export const Q_LIMIT = 9;
export const QUESTIONS = [
  { id: 'mec', label: '¿Cómo fue la lesión?', key: true,
    a: 'Iba a recibir un pase, frené en seco y giré con el pie derecho apoyado. Nadie me tocó.',
    note: 'Mecanismo sin contacto: desaceleración con pivote.',
    lr: { lca: 1.5, men: 1.3, lcm: 0.5, rot: 1.3, fx: 0.7, lcp: 0.4, leve: 0.8 } },
  { id: 'pop', label: '¿Sintió o escuchó algo?', key: true,
    a: 'Sentí como un crujido adentro, un «pop».',
    note: 'Chasquido percibido en el momento de la lesión.',
    lr: { lca: 1.5, lcm: 0.9, rot: 1.2, fx: 1.1, leve: 0.5 } },
  { id: 'cont', label: '¿Pudo seguir jugando?',
    a: 'No. Intenté volver a la cancha y la rodilla se me fue. Me tuve que salir.',
    note: 'No pudo continuar el partido.',
    lr: { lca: 1.2, men: 1.1, rot: 1.2, fx: 1.2, leve: 0.5 } },
  { id: 'der', label: '¿Cuándo se le hinchó?', key: true,
    a: 'Altiro. A las dos horas estaba como un melón.',
    note: 'Derrame en menos de 2 horas: sugiere hemartrosis.',
    lr: { lca: 1.8, men: 0.7, lcm: 0.7, rot: 1.6, fx: 1.8, lcp: 1.2, leve: 0.3 } },
  { id: 'fall', label: '¿Ahora le falla la rodilla?', key: true,
    a: 'Sí, cuando giro o bajo escaleras siento que se me va, como que se desarma.',
    note: 'Fallo o inestabilidad en giros.',
    lr: { lca: 1.5, men: 1.1, rot: 1.3, lcp: 1.1, leve: 0.6 } },
  { id: 'blq', label: '¿Se le traba o bloquea?', key: true,
    a: 'No se me traba. Me cuesta estirarla del todo, pero es por la hinchazón.',
    note: 'Sin bloqueo mecánico verdadero.',
    lr: { men: 0.6 } },
  { id: 'dol', label: '¿Dónde le duele más?',
    a: 'En toda la rodilla, un poco más por fuera.',
    note: 'Dolor difuso, algo más lateral.',
    lr: { lcm: 0.5, rot: 0.7 } },
  { id: 'rotq', label: '¿Se le salió la rótula?',
    a: 'No, que yo viera. La rótula estaba en su lugar.',
    note: 'Sin deformidad rotuliana en el momento de la lesión.',
    lr: { rot: 0.3 } },
  { id: 'apo', label: '¿Puede apoyar y caminar?', key: true,
    a: 'Sí, cojeando, pero apoyo. Llegué caminando desde el paradero.',
    note: 'Puede cargar peso.',
    lr: { fx: 0.4 } },
  { id: 'prev', label: '¿Se había lesionado antes?',
    a: 'Nunca. Es la primera vez.', note: 'Sin lesiones previas en esa rodilla.', lr: {} },
  { id: 'red', label: '¿Fiebre, hormigueo o pie frío?', key: true,
    a: 'No, nada de eso. El pie lo siento normal.',
    note: 'Sin banderas rojas neurovasculares ni infecciosas.', lr: {} },
  { id: 'obj', label: '¿Qué espera de la atención?', key: true,
    a: 'Quiero volver a jugar este año. Y no puedo faltar a mis prácticas clínicas.',
    note: 'Meta: volver al fútbol. Contexto académico exigente.', lr: {} },
  { id: 'trat', label: '¿Qué ha hecho hasta ahora?',
    a: 'Hielo, la pierna arriba y paracetamol. No he ido al médico.', note: 'Sin estudio previo.', lr: {} },
  { id: 'enf', label: '¿Enfermedades o fármacos?',
    a: 'Ninguna. Solo el paracetamol.', note: 'Sin antecedentes mórbidos.', lr: {} },
];

export const T_LIMIT = 7;
// pos: resultado en este paciente. for: hipótesis que evalúa. alt: efecto en otras hipótesis.
export const TESTS = [
  { id: 'lach', label: 'Lachman', for: 'lca', sens: 0.85, spec: 0.94, src: 'Benjaminse 2006', pos: true,
    text: 'Traslación anterior mayor que en la rodilla izquierda, con tope blando.', alt: { leve: 0.3 } },
  { id: 'cajA', label: 'Cajón anterior', for: 'lca', lrp: 3.8, lrn: 0.3, src: 'Solomon 2001', pos: false,
    text: 'Sin traslación clara. El paciente contrae los isquiotibiales por dolor y bloquea la prueba.', say: 'Me duele cuando la dobla tanto.' },
  { id: 'piv', label: 'Pivot shift', for: 'lca', sens: 0.24, spec: 0.98, src: 'Benjaminse 2006', pos: false,
    text: 'No se reproduce el resalte. La defensa muscular impide relajar la pierna.', say: '¡Ay! No, no me gusta esa.' },
  { id: 'pal', label: 'Signo de la palanca', for: 'lca', sens: 0.79, spec: 0.92, src: 'Hesmerg 2024', pos: true,
    text: 'Con el puño bajo la pantorrilla y presión sobre el muslo distal, el talón no se levanta de la camilla.', alt: { leve: 0.4 } },
  { id: 'cajP', label: 'Cajón posterior', for: 'lcp', sens: 0.9, spec: 0.99, src: 'Rubinstein 1994', pos: false,
    text: 'Sin traslación posterior ni hundimiento de la tibia. Escalón tibial normal.' },
  { id: 'valg', label: 'Estrés en valgo a 30°', for: 'lcm', sens: 0.86, spec: 0.8, src: 'aprox', pos: false,
    text: 'Sin apertura medial y con tope firme. No duele sobre el trayecto del LCM.' },
  { id: 'var', label: 'Estrés en varo a 30°', for: null, pos: false,
    text: 'Sin apertura lateral, tope firme. Evalúa el ligamento colateral lateral, que no estaba entre tus hipótesis.' },
  { id: 'mcm', label: 'McMurray', for: 'men', sens: 0.7, spec: 0.71, src: 'Hegedus 2007', pos: false,
    text: 'Sin chasquido ni dolor en la interlínea. Molestia difusa al final de la flexión, por el derrame.', say: 'Molesta al doblarla al fondo.' },
  { id: 'int', label: 'Palpar la interlínea', for: 'men', sens: 0.63, spec: 0.77, src: 'Hegedus 2007', pos: true,
    text: 'Dolor leve a la palpación de la interlínea lateral. La interlínea medial es indolora.' },
  { id: 'apr', label: 'Aprehensión rotuliana', for: 'rot', sens: 0.7, spec: 0.75, src: 'aprox', pos: false,
    text: 'Sin aprehensión al desplazar la rótula hacia lateral. Retináculo medial indoloro.' },
  { id: 'barr', label: 'Test de barrido (derrame)', for: null, pos: true, src: 'aprox',
    text: 'Derrame 2+: la onda de líquido vuelve sola al lado medial.',
    lrmap: { lca: 1.5, fx: 1.5, rot: 1.3, lcm: 0.7, leve: 0.3 } },
  { id: 'ott', label: 'Reglas de Ottawa', for: 'fx', sens: 0.985, spec: 0.486, src: 'Bachmann 2004', pos: false,
    text: 'No cumple ningún criterio: menor de 55 años, sin dolor aislado en rótula ni en cabeza del peroné, flexiona más de 90° y camina 4 pasos.' },
];

export const INSPECTION = 'Rodilla derecha con aumento de volumen difuso, sin hematoma ni herida. Le faltan unos 5° de extensión.';

export const PLAN = [
  { id: 'rm', label: 'Derivar a traumatología con resonancia', good: true,
    why: 'Confirma la rotura y busca lesiones asociadas de menisco o cartílago. La decisión quirúrgica se toma junto al paciente.' },
  { id: 'reh', label: 'Rehabilitación precoz: derrame, extensión y cuádriceps', good: true,
    why: 'Se inicia en ambos caminos, con o sin cirugía. Llegar a la cirugía con la rodilla seca, extensión completa y buen control del cuádriceps mejora los resultados.' },
  { id: 'mul', label: 'Muletas con carga según tolerancia', good: true,
    why: 'Permite caminar sin cojear mientras baja el derrame.' },
  { id: 'rx', label: 'Pedir radiografía de rodilla', good: 'ottawa',
    why: 'Con las reglas de Ottawa negativas, la radiografía no es necesaria.' },
  { id: 'inm', label: 'Inmovilizar con férula rígida 4 semanas', good: false,
    why: 'La inmovilización prolongada favorece la pérdida de extensión y la atrofia del cuádriceps.' },
  { id: 'rep', label: 'Reposo sin ejercicios hasta la resonancia', good: false,
    why: 'El reposo total retrasa la recuperación de la extensión y del control muscular.' },
  { id: 'vol', label: 'Volver a jugar cuando ceda el dolor', good: false,
    why: 'Volver a pivotar con el LCA roto expone a nuevos episodios de fallo y a daño meniscal.' },
];

/* ---------- Razonamiento ---------- */
export const lrOf = (t) => {
  if (t.lrmap) return null;
  if (t.lrp) return t.pos ? t.lrp : t.lrn;
  if (t.sens == null) return 1;
  return t.pos ? t.sens / (1 - t.spec) : (1 - t.sens) / t.spec;
};
const upd = (p, lr) => { const o = (p / (1 - p)) * lr; return Math.min(0.995, Math.max(0.005, o / (1 + o))); };

export function createCase() {
  const probs = {}; HYP.forEach((h) => (probs[h.id] = h.prior));
  return { stage: 'anam', asked: [], tests: [], hyp: [], dx: null, plan: [], probs, afterAnam: null, history: [] };
}
export function ask(c, id) {
  const q = QUESTIONS.find((x) => x.id === id);
  if (!q || c.asked.includes(id) || c.asked.length >= Q_LIMIT) return null;
  c.asked.push(id);
  for (const [h, lr] of Object.entries(q.lr)) c.probs[h] = upd(c.probs[h], lr);
  return q;
}
export function closeAnamnesis(c) { c.afterAnam = { ...c.probs }; c.stage = 'hyp'; }
export function toggleHyp(c, id) {
  const i = c.hyp.indexOf(id);
  if (i >= 0) c.hyp.splice(i, 1); else if (c.hyp.length < 3) c.hyp.push(id);
}
export function runTest(c, id) {
  const t = TESTS.find((x) => x.id === id);
  if (!t || c.tests.includes(id) || c.tests.length >= T_LIMIT) return null;
  const before = { ...c.probs };
  c.tests.push(id);
  if (t.lrmap) for (const [h, lr] of Object.entries(t.lrmap)) c.probs[h] = upd(c.probs[h], lr);
  else if (t.for) c.probs[t.for] = upd(c.probs[t.for], lrOf(t));
  if (t.alt) for (const [h, lr] of Object.entries(t.alt)) c.probs[h] = upd(c.probs[h], lr);
  const changes = HYP.map((h) => ({ id: h.id, short: h.short, from: before[h.id], to: c.probs[h.id] })).filter((x) => Math.abs(x.to - x.from) >= 0.005);
  c.history.push({ id, changes, before });
  return { t, changes };
}

export function debrief(c) {
  const items = [];
  const add = (ok, label, detail) => items.push({ ok, label, detail });
  const pct = (p) => `${Math.round(p * 100)}%`;
  const keys = QUESTIONS.filter((q) => q.key);
  const missing = keys.filter((q) => !c.asked.includes(q.id));
  add(missing.length <= 1, 'Preguntas clave', missing.length ? `Hiciste ${keys.length - missing.length} de ${keys.length}. Faltó: ${missing.map((q) => q.label).join(' ')}` : `Hiciste las ${keys.length}.`);
  add(c.asked.includes('red'), 'Banderas rojas', c.asked.includes('red') ? 'Exploraste síntomas neurovasculares e infecciosos.' : 'No preguntaste por fiebre, hormigueo ni pie frío.');
  add(c.hyp[0] === TRUTH, 'Hipótesis principal tras la anamnesis', c.hyp.length ? `Elegiste ${HYP.find((h) => h.id === c.hyp[0]).label}. Con la historia, la rotura de LCA era la más probable (${pct(c.afterAnam.lca)}).` : 'No elegiste hipótesis.');
  add(c.tests.includes('lach'), 'Prueba de Lachman', c.tests.includes('lach') ? 'Es la prueba clínica más útil para el LCA en la fase aguda.' : 'No la hiciste: es la prueba clínica más útil para el LCA en la fase aguda.');
  const ruled = [['valg', 'LCM'], ['ott', 'fractura'], ['cajP', 'LCP']].filter(([t]) => !c.tests.includes(t)).map(([, n]) => n);
  if (!c.tests.includes('apr') && !c.asked.includes('rotq')) ruled.push('luxación de rótula');
  add(ruled.length === 0, 'Diagnósticos diferenciales examinados', ruled.length ? `Faltó examinar: ${ruled.join(', ')}.` : 'Examinaste LCM, fractura, LCP y rótula.');
  const weak = [], redundant = [];
  for (const h of c.history) {
    const t = TESTS.find((x) => x.id === h.id);
    const lrs = t.lrmap ? Object.values(t.lrmap) : t.for ? [lrOf(t)] : [1];
    if (Math.max(...lrs.map((x) => Math.abs(Math.log(x)))) < Math.log(2)) weak.push(t.label);
    else if (t.for && (h.before[t.for] > 0.95 || h.before[t.for] < 0.02)) redundant.push(t.label);
  }
  add(weak.length + redundant.length <= 1, 'Rendimiento de las pruebas',
    [weak.length ? `Con su resultado, casi no cambiaron la probabilidad: ${weak.join(', ')}.` : '', redundant.length ? `La hipótesis ya estaba confirmada o descartada: ${redundant.join(', ')}.` : ''].filter(Boolean).join(' ') || 'Elegiste pruebas que movieron tu razonamiento.');
  add(c.dx === TRUTH, 'Diagnóstico', c.dx ? `Elegiste ${HYP.find((h) => h.id === c.dx).label}. Probabilidad final de rotura de LCA: ${pct(c.probs.lca)}.` : 'Sin diagnóstico.');
  const otta = c.tests.includes('ott');
  const goodIds = PLAN.filter((p) => p.good === true || (p.good === 'ottawa' && !otta)).map((p) => p.id);
  const missed = PLAN.filter((p) => p.good === true && !c.plan.includes(p.id));
  const wrong = PLAN.filter((p) => c.plan.includes(p.id) && !goodIds.includes(p.id));
  add(missed.length === 0 && wrong.length === 0, 'Conducta',
    [missed.length ? `Faltó: ${missed.map((p) => p.label.toLowerCase()).join('; ')}.` : '', ...wrong.map((p) => p.why)].filter(Boolean).join(' ') || 'Conducta adecuada.');
  const learn = [
    'Un derrame en menos de 2 horas tras un pivote sin contacto orienta a hemartrosis; su causa más frecuente es la rotura de LCA.',
    'El Lachman es la prueba más útil en la fase aguda. El cajón anterior y el pivot shift suelen fallar por la defensa muscular.',
    'Un McMurray negativo no descarta una lesión meniscal; la resonancia la buscará.',
    'Con las reglas de Ottawa negativas no hace falta radiografía.',
    'En jóvenes que quieren volver a deportes de pivote suele indicarse la reconstrucción. La rehabilitación precoz se hace en ambos caminos.',
  ];
  return { items, learn, score: items.filter((i) => i.ok).length, total: items.length };
}
