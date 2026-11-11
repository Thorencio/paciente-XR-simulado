// Genera el sitio: index.html (menú), urgencias.html y rodilla.html. Uso: node build.mjs [carpeta]
import esbuild from 'esbuild'; import fs from 'node:fs'; import path from 'node:path';
const OUT = process.argv[2] || '..';
const f = (w) => fs.readFileSync(`node_modules/@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-${w}-normal.woff2`).toString('base64');
const FONT = [400, 700].map((w) => `@font-face{font-family:'Atkinson Hyperlegible';font-weight:${w};font-display:swap;src:url(data:font/woff2;base64,${f(w)}) format('woff2')}`).join('');
const BASE = fs.readFileSync('src/base.css', 'utf8');
async function js(entry) {
  const r = await esbuild.build({ entryPoints: [entry], bundle: true, minify: true, format: 'iife', write: false, target: 'es2020', legalComments: 'none' });
  return r.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
}
const fill = (tpl, map) => { let h = fs.readFileSync(tpl, 'utf8'); for (const [k, v] of Object.entries(map)) { const [a, ...b] = h.split(k); h = a + v + b.join(k); } return h; };
fs.mkdirSync(OUT, { recursive: true });
const pages = {
  'index.html': fill('src/inicio.html', { '/*FONT*/': FONT }),
  'urgencias.html': fill('src/template.html', { '/*FONT*/': FONT, '/*MESH*/': fs.readFileSync('dist-mesh.b64', 'utf8'), '/*JS*/': await js('src/main.js') }),
  'rodilla.html': fill('src/rodilla/template.html', { '/*FONT*/': FONT, '/*BASE*/': BASE, '/*MESH*/': fs.readFileSync('dist-mesh-rodilla.json', 'utf8'), '/*JS*/': await js('src/rodilla/main.js') }),
};
for (const [n, h] of Object.entries(pages)) { fs.writeFileSync(path.join(OUT, n), h); console.log(n, (h.length / 1024) | 0, 'KB'); }
