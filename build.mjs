import esbuild from 'esbuild'; import fs from 'node:fs';
const r=await esbuild.build({entryPoints:['src/main.js'],bundle:true,minify:true,format:'iife',write:false,target:'es2020',legalComments:'none'});
const js=r.outputFiles[0].text.replace(/<\/script/g,'<\\/script');
const f=w=>fs.readFileSync(`node_modules/@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-${w}-normal.woff2`).toString('base64');
const font=[400,700].map(w=>`@font-face{font-family:'Atkinson Hyperlegible';font-weight:${w};font-display:swap;src:url(data:font/woff2;base64,${f(w)}) format('woff2')}`).join('');
let h=fs.readFileSync('src/template.html','utf8');
h=h.split('/*FONT*/').join(font).split('/*MESH*/').join(fs.readFileSync('dist-mesh.b64','utf8'));
const [a,b]=h.split('/*JS*/');h=a+js+b;
fs.writeFileSync('../index.html',h);console.log('index.html',(h.length/1024|0)+' KB');
