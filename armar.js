#!/usr/bin/env node
/* armar.js — ETAPA 1 de la «Arquitectura de la Entidad Componible» (29/10/2026). Ver ESTRUCTURA.md.
   POR QUÉ: el index.html único (1 MB) era el techo; ahora la fuente vive en piezas (nucleo/, adn/, organos/) y este script
   las pega, en el orden de armar.json, en el MISMO index.html de siempre. El deploy no cambia.
   (Reescrito el 29/10 a la tarde con la misma receta y las mismas reglas: el original se perdió al pisarse la carpeta.)

   node armar.js                         → arma index.html desde las piezas
   node armar.js --verificar             → no escribe: rojo si index.html no es exactamente el armado (lo corre la red de pruebas)
   node armar.js --desarmar              → hiciste un arreglo directo en index.html: lo pasa a las piezas (usa las «anclas»)
   node armar.js --sellar-adn adn-1.1 "por qué"   → cambiaste el ADN a propósito: lo sella con versión, huella y motivo
   node armar.js --salida otro.html      → arma en otro archivo (para probar sin pisar nada)

   Reglas que hace cumplir (las del documento):
   1. ningún órgano se ensambla sin FICHA completa y con su banco existente (regla 3);
   2. el ADN está sellado: si cambia sin sellarse, rojo;
   3. cada pieza de JavaScript pasa `node --check` sola (si algo se rompe, dice qué pieza);
   4. ningún órgano se cuela: una carpeta en organos/ que no está en la receta da rojo;
   5. el index.html tiene que ser exactamente el que arman las piezas. */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto'), cp = require('child_process');
const RAIZ = __dirname, args = process.argv.slice(2), fallas = [];
const receta = JSON.parse(fs.readFileSync(path.join(RAIZ, 'armar.json'), 'utf8'));
const piezas = receta.piezas;
const iS = args.indexOf('--salida');
if (iS >= 0 && !args[iS + 1]) { console.log('Uso: node armar.js --salida otro.html'); process.exit(1); }
const SALIDA = path.resolve(RAIZ, iS >= 0 ? args[iS + 1] : receta.salida);
const md5 = b => crypto.createHash('md5').update(b).digest('hex');
// verificador 29/10: con un checkout de git en Windows (CRLF) las anclas y la huella del ADN no coincidían. Se lee siempre en LF.
const LF = b => Buffer.from(b.toString('utf8').replace(/\r\n/g, '\n'), 'utf8');
const leer = f => LF(fs.readFileSync(path.join(RAIZ, f)));

// ── desarmar: index.html → piezas, cortando en las anclas de la receta ─────────────
if (args.includes('--desarmar')) {
  const h = fs.readFileSync(SALIDA, 'utf8').replace(/\r\n/g, '\n'); const ini = []; let pos = 0;
  for (const p of piezas) {
    if (p.ancla == null) { ini.push(0); continue; }
    let i = h.indexOf(p.ancla, pos); if (i < 0) { console.log('❌ no encuentro el ancla de ' + p.archivo + ' en ' + path.basename(SALIDA)); process.exit(1); }
    if (p.despues) i += p.ancla.length; i += (p.corrimiento || 0); ini.push(i); pos = i;
  }
  ini.push(h.length);
  piezas.forEach((p, k) => { if (p.generada) return; const f = path.join(RAIZ, p.archivo); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, h.slice(ini[k], ini[k + 1])); });
  console.log('✅ desarmé ' + path.basename(SALIDA) + ' en ' + piezas.length + ' piezas. Si tocaste el ADN, sellalo: node armar.js --sellar-adn adn-X.Y "por qué".');
  process.exit(0);
}

// ── sellar el ADN ───────────────────────────────────────────────────────────────
const fSello = path.join(RAIZ, 'adn', 'adn.json');
const iA = args.indexOf('--sellar-adn');
if (iA >= 0) {
  const version = args[iA + 1], motivo = args[iA + 2];
  if (!version || !motivo) { console.log('Uso: node armar.js --sellar-adn adn-1.1 "por qué cambió"'); process.exit(1); }
  const prev = fs.existsSync(fSello) ? JSON.parse(fs.readFileSync(fSello, 'utf8')) : { historial: [] };
  const sello = { _que_es: prev._que_es || 'Sello del ADN de fábrica: versión + huella (md5) de adn/adn_fabrica.js. Si el ADN cambia sin sellarse, el armado da rojo.',
    version, huella: md5(leer('adn/adn_fabrica.js')), fecha: new Date().toISOString().slice(0, 10), motivo,
    historial: (prev.historial || []).concat(prev.version ? [{ version: prev.version, huella: prev.huella, fecha: prev.fecha, motivo: prev.motivo }] : []) };
  fs.writeFileSync(fSello, JSON.stringify(sello, null, 2) + '\n');
  console.log('✅ ADN sellado: ' + version + ' (' + sello.huella + ')'); process.exit(0);
}

// 1) armar
/* v40-piezas (10/11/2026) — LA TABLA PERIÓDICA. Una pieza con "generada": "catalogo" no es un archivo: el armado la
   ESCRIBE leyendo las fichas de organos/*. Así el catálogo que la app conoce (ENTIDAD_PIEZAS) es siempre el de las fichas
   reales: nadie lo escribe a mano y no puede mentir. Ver la skill «atomos-mirror». */
function catalogoDesdeFichas() {
  const dirO2 = path.join(RAIZ, 'organos'); const out = [];
  for (const o of (fs.existsSync(dirO2) ? fs.readdirSync(dirO2).filter(d => fs.statSync(path.join(dirO2, d)).isDirectory()).sort() : [])) {
    let fi; try { fi = JSON.parse(fs.readFileSync(path.join(dirO2, o, 'ficha.json'), 'utf8')); } catch (e) { continue; }
    out.push({ id: o, nombre: fi.nombre || o, tipo: fi.tipo || 'órgano', se_ensambla_en: fi.se_ensambla_en || '', version: fi.version || '',
      name: fi.name || o, description: fi.description || fi.proposito || '', proposito: fi.proposito || '', estado: fi.estado || 'despierto',
      dormible: fi.dormible === true, limites: Array.isArray(fi.limites) ? fi.limites : [] });
  }
  return Buffer.from('/* ══ v40-piezas · CATÁLOGO DE PIEZAS (la tabla periódica) — GENERADO por armar.js desde las fichas de organos (ficha.json). NO SE EDITA A MANO. ══ */\n'
    + 'const ENTIDAD_PIEZAS = ' + JSON.stringify(out) + ';\n', 'utf8');
}
const trozos = [];
for (const p of piezas) {
  if (p.generada === 'catalogo') { trozos.push(catalogoDesdeFichas()); continue; }
  if (!fs.existsSync(path.join(RAIZ, p.archivo))) fallas.push('falta la pieza «' + p.archivo + '»'); else trozos.push(leer(p.archivo)); }
const html = Buffer.concat(trozos);

// 2) cada pieza de JavaScript pasa node --check sola
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'armar-'));
for (const p of piezas.filter(p => /\.js$/.test(p.archivo) && !p.generada)) {
  if (!fs.existsSync(path.join(RAIZ, p.archivo))) continue;
  const f = path.join(tmp, p.archivo.replace(/[\/\\]/g, '__'));
  fs.copyFileSync(path.join(RAIZ, p.archivo), f);
  const r = cp.spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
  if (r.status !== 0) fallas.push('la pieza «' + p.archivo + '» no pasa node --check: ' + (String(r.stderr).split('\n').find(l => /Error/.test(l)) || 'error de sintaxis'));
}

// 3) contrato de órgano
const CAMPOS = ['nombre', 'version', 'proposito', 'disparadores', 'entradas', 'salidas', 'herramientas', 'permisos', 'limites', 'banco', 'estado', 'codigo'];
const enReceta = piezas.map(p => p.archivo);
const dirO = path.join(RAIZ, 'organos');
for (const o of (fs.existsSync(dirO) ? fs.readdirSync(dirO).filter(d => fs.statSync(path.join(dirO, d)).isDirectory()) : [])) {
  const fF = path.join(dirO, o, 'ficha.json');
  if (!fs.existsSync(fF)) { fallas.push('órgano «' + o + '»: sin ficha.json (regla 3: sin ficha no se ensambla)'); continue; }
  let fi; try { fi = JSON.parse(fs.readFileSync(fF, 'utf8')); } catch (e) { fallas.push('órgano «' + o + '»: ficha.json no es JSON válido'); continue; }
  const faltan = CAMPOS.filter(c => fi[c] === undefined || fi[c] === '' || (Array.isArray(fi[c]) && !fi[c].length));
  if (faltan.length) fallas.push('órgano «' + o + '»: la ficha no declara ' + faltan.join(', '));
  if (fi.codigo && !enReceta.includes(fi.codigo)) fallas.push('órgano «' + o + '»: su código «' + fi.codigo + '» no está en la receta (armar.json): se estaría colando');
  if (!/^(despierto|dormido|retirado)$/.test(fi.estado || '')) fallas.push('órgano «' + o + '»: estado tiene que ser despierto, dormido o retirado');
  (fi.banco || []).forEach(b => { if (!fs.existsSync(path.join(RAIZ, String(b).split('#')[0]))) fallas.push('órgano «' + o + '»: su banco «' + b + '» no existe'); });
  if (fi.adn !== undefined) fallas.push('órgano «' + o + '»: una ficha no puede redefinir el ADN (lo hereda del núcleo)');
}
enReceta.filter(a => /^organos\//.test(a)).forEach(a => { const o = a.split('/')[1]; if (!fs.existsSync(path.join(dirO, o, 'ficha.json'))) fallas.push('la receta arma «' + a + '» pero el órgano «' + o + '» no tiene ficha'); });

// 4) el ADN, sellado
if (!fs.existsSync(fSello)) fallas.push('el ADN no está sellado (falta adn/adn.json): node armar.js --sellar-adn adn-1.0 "primer sello"');
else { const s = JSON.parse(fs.readFileSync(fSello, 'utf8')); const h = md5(leer('adn/adn_fabrica.js')); if (h !== s.huella) fallas.push('el ADN cambió (huella ' + h + ') y el sello dice ' + s.huella + ' (' + s.version + '): si fue a propósito, sellalo con node armar.js --sellar-adn adn-X.Y "por qué"'); }

// 5) escribir o verificar
console.log('Armado: ' + piezas.length + ' piezas · ' + html.length + ' bytes · md5 ' + md5(html));
if (args.includes('--verificar')) {
  const actual = fs.existsSync(SALIDA) ? LF(fs.readFileSync(SALIDA)) : Buffer.alloc(0);
  if (!actual.equals(html)) {
    let i = 0; while (i < actual.length && i < html.length && actual[i] === html[i]) i++;
    let acc = 0, cual = '?'; for (let k = 0; k < trozos.length; k++) { if (i < acc + trozos[k].length) { cual = piezas[k].archivo; break; } acc += trozos[k].length; }
    fallas.push('index.html NO es el que arman las piezas (primera diferencia en la línea ' + html.slice(0, i).toString('utf8').split('\n').length + ', pieza «' + cual + '»). Tocaste una pieza: corré node armar.js. Tocaste el index: corré node armar.js --desarmar.');
  } else console.log('✅ index.html es exactamente el que arman las piezas.');
} else if (!fallas.length) { fs.writeFileSync(SALIDA, html); console.log('✅ escribí ' + path.relative(RAIZ, SALIDA)); }
if (fallas.length) { console.log('\n❌ ROJO:\n' + fallas.map(f => '   · ' + f).join('\n')); process.exit(1); }
