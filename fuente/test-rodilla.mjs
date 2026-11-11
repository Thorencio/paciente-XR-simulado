import { createCase, ask, closeAnamnesis, runTest, toggleHyp, debrief, HYP } from './src/rodilla/caso.js';
const show=(c,l)=>console.log(l.padEnd(18), HYP.map(h=>`${h.short} ${Math.round(c.probs[h.id]*100)}`).join('  '));
let c=createCase(); show(c,'previo');
['mec','pop','der','fall','blq','apo','red','obj','cont'].forEach(q=>ask(c,q)); show(c,'tras anamnesis'); closeAnamnesis(c);
toggleHyp(c,'lca');toggleHyp(c,'men');
for(const t of ['lach','pal','valg','ott','cajP','mcm','int']){runTest(c,t); show(c,'+'+t)}
c.dx='lca';c.plan=['rm','reh','mul'];const d=debrief(c);console.log(d.score+'/'+d.total);d.items.forEach(i=>console.log(i.ok?'✓':'✕',i.label,'|',i.detail));
c=createCase();['dol','prev','trat','enf'].forEach(q=>ask(c,q));show(c,'anamnesis pobre');closeAnamnesis(c);
for(const t of ['cajA','piv','var','apr']){runTest(c,t)} show(c,'pruebas pobres');c.dx='men';c.plan=['inm','rx'];const e=debrief(c);console.log(e.score+'/'+e.total);e.items.forEach(i=>console.log(i.ok?'✓':'✕',i.label,'|',i.detail));
