import { createSim, step, act, derive } from './src/sim.js';
function run(name, plan, maxT = 30) {
  const s = createSim(); const todo = plan.map(p => ({...p}));
  const trace = [];
  while (s.t < maxT && !s.outcome) {
    for (const p of todo) if (!p.done && s.t >= p.t) { act(s, p.id, p.arg); p.done = 1; }
    step(s, 1 / 60 / 20);
    const m = Math.floor(s.t);
    if (m % 2 === 0 && !trace[m]) { const v = s.vitals; trace[m] = `${m}m ${v.sbp}/${v.spo2}/${v.hr}`; }
  }
  console.log(name.padEnd(30), (s.outcome || 'ongoing').padEnd(8), s.t.toFixed(1).padStart(5), '|', trace.filter(Boolean).slice(0, 9).join('  '));
}
const stop = {t:.5,id:'stop'}; const im=(t,arg='thigh')=>({t,id:'im',arg});
run('sin tratamiento', []);
run('solo suspender', [stop]);
run('antihist+cortico', [{t:1,id:'chlor'},{t:1.2,id:'hydro'}]);
run('IM sin suspender', [im(2)]);
run('1 IM + suspender', [stop, im(2)]);
run('2 IM + suspender', [stop, im(2), im(7)]);
run('2 IM deltoides + susp', [stop, im(2,'deltoid'), im(7,'deltoid')]);
run('2 IM + O2', [stop, im(2), im(7), {t:1,id:'o2'}]);
run('completo sin 2a dosis', [stop, im(2), {t:1,id:'o2'},{t:1.5,id:'legs'},{t:2.5,id:'fluid'}]);
run('óptimo', [stop, im(1.5), {t:1,id:'o2'},{t:1.5,id:'legs'},{t:2.5,id:'fluid'}, im(6.5)]);
run('óptimo + 2 bolos', [stop, im(1.5), {t:1,id:'o2'},{t:1.5,id:'legs'},{t:2.5,id:'fluid'},{t:5,id:'fluid'}, im(6.5)]);
run('adrenalina tardía 6m', [stop, im(6), {t:6,id:'o2'},{t:6,id:'legs'},{t:6,id:'fluid'}, im(11)]);
run('2 bolos EV', [{t:1,id:'ivbolus'},{t:3,id:'ivbolus'}]);
