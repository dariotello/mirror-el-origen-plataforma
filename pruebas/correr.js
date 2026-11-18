#!/usr/bin/env node
/* pruebas/correr.js — la RED DE PRUEBAS de la plataforma (23/10/2026).
   POR QUÉ EXISTE: hasta ahora las pruebas las corría Claude a mano antes de cada entrega. Con esto
   corren SOLAS en cada pull request (GitHub Actions) y el PR queda en ROJO si algo se rompe, ANTES
   del Merge. «No soltar el freno: ponerle un freno mejor que ande solo.»

   Uso:   node pruebas/correr.js                    → prueba el index.html de la raíz del repo
          node pruebas/correr.js --archivo otro.html → prueba otro archivo (así se hace la mutación de control)
          node pruebas/correr.js --sin-navegador     → solo node --check + bancos (sin Playwright)
   Sale con código 0 si TODO está verde, 1 si algo falló. */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');

const AQUI = __dirname, RAIZ = path.join(AQUI, '..');
const args = process.argv.slice(2);
const iArch = args.indexOf('--archivo');
const ARCHIVO = path.resolve(iArch >= 0 ? args[iArch + 1] : path.join(RAIZ, 'index.html'));
const SIN_NAV = args.includes('--sin-navegador');
const PARALELO = Math.max(1, +(process.env.PRUEBAS_PARALELO || 3));

const fallas = [];
const t0 = Date.now();
function titulo(s) { console.log('\n━━━ ' + s + ' ━━━'); }

if (!fs.existsSync(ARCHIVO)) { console.error('No encuentro ' + ARCHIVO); process.exit(1); }
const html = fs.readFileSync(ARCHIVO, 'utf8');
const build = (/const APP_BUILD = '([^']+)'/.exec(html) || [])[1] || '(sin APP_BUILD)';
console.log('Archivo: ' + ARCHIVO + '\nBuild:   ' + build);

// ── 0) Etapa 1 (29/10/2026): el index.html tiene que ser EXACTAMENTE el armado de los módulos, y cada órgano
//    tiene que tener su ficha completa (contrato). Solo si el repo ya tiene armar.js y se prueba el index de la raíz.
if (fs.existsSync(path.join(RAIZ, 'armar.js')) && iArch < 0) {
  titulo('0) Armado desde módulos y contrato de órganos (node armar.js --verificar)');
  const r = cp.spawnSync(process.execPath, [path.join(RAIZ, 'armar.js'), '--verificar'], { encoding: 'utf8' });
  console.log(((r.stdout || '') + (r.stderr || '')).trim().split('\n').map(l => '  ' + l).join('\n'));
  if (r.status !== 0) fallas.push('armado: el index.html no es el armado de los módulos, o un órgano no cumple su ficha');
}

// ── 1) node --check de cada <script> inline ─────────────────────────────────────
titulo('1) Sintaxis: node --check de cada <script> inline');
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chk-'));
  const re = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi; let m, n = 0, ok = 0;
  while ((m = re.exec(html))) {
    const at = m[1] || '';
    if (/\bsrc=/i.test(at)) continue;
    if (/type=["'](?!text\/javascript|module)/i.test(at)) continue; // JSON-LD, plantillas, etc.
    n++;
    const f = path.join(tmp, 'script_' + n + (/module/i.test(at) ? '.mjs' : '.js'));
    fs.writeFileSync(f, m[2]);
    try { cp.execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); ok++; }
    catch (e) { fallas.push('sintaxis: <script> nº ' + n); console.log('  ❌ <script> nº ' + n + '\n' + String(e.stderr).split('\n').slice(0, 6).join('\n')); }
  }
  if (n === 0) { fallas.push('sintaxis: no encontré ningún <script>'); }
  console.log((ok === n && n > 0 ? '  ✅ ' : '  ❌ ') + ok + '/' + n + ' bloques OK');
}

// ── 2) Bancos (Node puro) ───────────────────────────────────────────────────────
// Los bancos esperan la estructura de la carpeta de Darío: <base>/PLATAFORMA/index.html y los
// bancos en <base>/MIRROR/. La armamos en una carpeta temporal. MIRROR/index.html NO está en este
// repo: los bancos de «las dos muletas» lo saltean solos (marcado «[repo]» en cada uno).
titulo('2) Bancos');
{
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'bancos-'));
  fs.mkdirSync(path.join(base, 'PLATAFORMA')); fs.mkdirSync(path.join(base, 'MIRROR'));
  fs.copyFileSync(ARCHIVO, path.join(base, 'PLATAFORMA', 'index.html'));
  const dirB = path.join(AQUI, 'bancos');
  const bancos = fs.readdirSync(dirB).filter(f => /^TEST_.*\.js$/.test(f)).sort();
  for (const b of bancos) fs.copyFileSync(path.join(dirB, b), path.join(base, 'MIRROR', b));
  for (const b of bancos) {
    const r = cp.spawnSync(process.execPath, [path.join(base, 'MIRROR', b)], { cwd: path.join(base, 'MIRROR'), encoding: 'utf8', timeout: 5 * 60 * 1000, maxBuffer: 64 * 1024 * 1024 });
    const out = (r.stdout || '') + (r.stderr || '');
    const resumen = out.trim().split('\n').filter(l => /VERDE|pasan|fallan|FALL|❌|Error/.test(l)).slice(-1)[0] || out.trim().split('\n').slice(-1)[0] || '';
    const mal = r.status !== 0 || r.error;
    if (mal) { fallas.push('banco ' + b); console.log('  ❌ ' + b + '  (código ' + r.status + ')'); console.log(out.split('\n').filter(l => /❌|Error|FALL/.test(l)).slice(0, 15).map(l => '       ' + l.slice(0, 220)).join('\n')); }
    else console.log('  ✅ ' + b.padEnd(34) + resumen.replace(/\s+/g, ' ').trim().slice(0, 110));
  }
}

// ── 3) Navegador real (Playwright + Chromium) ───────────────────────────────────
// Algunas pruebas viejas no cortan con código de error sino que IMPRIMEN el problema:
// por eso además del código se leen estas señales en la salida.
function salidaConFalla(out) {
  const lineas = out.split('\n');
  for (const l of lineas) {
    if (/❌|Esc✗|SIN-CIERRE/.test(l)) return l.trim();
    if (/(no existen|duplicados|sin id definido|errores|pageerror|console\.error)/.test(l) && /\[(?!\])/.test(l)) return l.trim();
    const sc = /"sw":(\d+),"cw":(\d+)/.exec(l); if (sc && +sc[1] > +sc[2] + 1) return 'scroll horizontal: ' + l.trim();
  }
  return '';
}
async function navegador() {
  titulo('3) Navegador real (Chromium), con proxy y voz simulados');
  let pw = null; try { pw = require.resolve('playwright'); } catch (e) {}
  if (!pw) { fallas.push('navegador: falta Playwright (npm install playwright)'); console.log('  ❌ falta Playwright'); return; }
  const dirN = path.join(AQUI, 'navegador');
  const pruebas = fs.readdirSync(dirN).filter(f => /^t_.*\.js$/.test(f)).sort();
  const cola = pruebas.slice();
  const correr = f => new Promise(res => {
    const ini = Date.now();
    const ch = cp.spawn(process.execPath, [path.join(dirN, f)], { cwd: dirN, env: Object.assign({}, process.env, { FILE: ARCHIVO, NODE_PATH: [path.dirname(path.dirname(pw)), process.env.NODE_PATH || ''].filter(Boolean).join(path.delimiter) }) });
    let out = ''; ch.stdout.on('data', d => out += d); ch.stderr.on('data', d => out += d);
    const tope = setTimeout(() => { out += '\n❌ se pasó de 10 minutos'; ch.kill('SIGKILL'); }, 10 * 60 * 1000);
    ch.on('close', code => {
      clearTimeout(tope);
      const senal = salidaConFalla(out);
      const seg = ((Date.now() - ini) / 1000).toFixed(0) + ' s';
      if (code !== 0 || senal) {
        fallas.push('navegador ' + f);
        console.log('  ❌ ' + f + '  (código ' + code + ', ' + seg + ')' + (senal ? '  → ' + senal.slice(0, 200) : ''));
        console.log(out.split('\n').filter(l => /❌|Error|✗/.test(l)).slice(0, 15).map(l => '       ' + l.slice(0, 220)).join('\n'));
      } else {
        const res = out.trim().split('\n').filter(l => /✅|OK/.test(l)).slice(-1)[0] || 'sin errores';
        console.log('  ✅ ' + f.padEnd(22) + seg.padStart(6) + '  ' + res.replace(/\s+/g, ' ').trim().slice(0, 90));
      }
      res();
    });
  });
  await Promise.all(Array.from({ length: PARALELO }, async () => { while (cola.length) await correr(cola.shift()); }));
}

(async () => {
  if (!SIN_NAV) await navegador();
  titulo('Resultado');
  const min = ((Date.now() - t0) / 60000).toFixed(1);
  if (fallas.length) {
    console.log('❌ ROJO — ' + fallas.length + ' cosa(s) fallaron (' + min + ' min):\n' + fallas.map(f => '   · ' + f).join('\n'));
    console.log('\nNo hagas Merge de este pull request hasta que esto quede verde.');
    process.exit(1);
  }
  console.log('✅ VERDE — sintaxis, bancos' + (SIN_NAV ? '' : ' y navegador') + ' OK (' + min + ' min). Build ' + build + '.');
  console.log('Ojo: el verde de acá NO reemplaza tu prueba en vivo (voz real, micrófono, Groq de verdad).');
})();
