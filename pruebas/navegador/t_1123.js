// t_1123.js — build 2026-11-23.x: LA APP OPERA EN LA NUBE (v40-nube). Darío (22/11): «…QUE LA APP OPEREN EN LA NUBE ARMANDO Y
// DESARMANDO LO QUE EL USUARIO NECESITA Y SE LO TRAE, CUANDO EL USUARIO NO LO NECESITA MÁS SE DESENSAMBLA…».
// La compuerta: arranca sin piezas · el mail de Laura trae la pieza y la suelta · dos herramientas con átomos compartidos que se
// arman y se desarman sin dejar nada · sin red, aviso honesto · y los hallazgos 1, 2 y 3 de su auditoría del 18/11.
// Uso: FILE=…/index.html NODE_PATH=$(npm root -g) node t_1123.js. Sobre la 2026-11-18.1 tiene que dar ROJO. Lleva CONTROLES.
const { abrir } = require('./harness.js');
const fs = require('fs'), path = require('path');
const CFG = { appName:'MANIFIESTOS', perfil:{ nombre:'ATIS' }, modos:{ mirror:'ATIS', tars:'MODO ANALÍTICO', jurado:'EXPERTO/EXAMINADOR', conn:'BASE' }, modeloPrincipal:'openai/gpt-oss-120b', motorPrincipal:'groq' };
const AG = { 'laura pena': { nombre:'Laura Peña', email:'laura.pena00@gmail.com', tel:'+5492984112233' } };
const LS = { mirror_agenda: JSON.stringify(AG) };
let ok = 0, mal = 0;
function t(n, c, d){ if (c){ ok++; console.log('  ✅ ' + n); } else { mal++; console.log('  ❌ ' + n + (d !== undefined ? '  → ' + String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 300) : '')); } }
const CORS = { 'access-control-allow-origin':'*' };
async function groqFalso(p, fn){ const log = []; await p.route('**/proxy/groq', async route => { const b = JSON.parse(route.request().postData() || '{}'); const todo = (b.messages || []).map(m => typeof m.content === 'string' ? m.content : '').join('\n'); log.push(todo); return route.fulfill({ status:200, contentType:'application/json', headers:CORS, body: JSON.stringify({ choices:[{ message:{ role:'assistant', content: fn(todo) } }] }) }); }); return log; }
// lo nuevo se mide por nodos (no por largo de texto): al desarmar, el panel SALE del chat y el texto se achica
async function decir(p, q, ms){ await p.evaluate(() => [...document.getElementById('chat').children].forEach(n => n.setAttribute('data-visto', '1'))); await p.fill('#inp', q); await p.keyboard.press('Enter'); await p.waitForTimeout(ms || 1700); return p.evaluate(() => [...document.getElementById('chat').children].filter(n => !n.hasAttribute('data-visto')).map(n => n.innerText).join('\n')); }
const estado = p => p.evaluate(() => ({
  nube: typeof ATOMOS_NUBE !== 'undefined',
  cargados: typeof ATOMOS_NUBE !== 'undefined' ? Object.keys(ATOMOS_NUBE.cargados) : null,
  reglasNube: typeof ACTUA_CMDS !== 'undefined' ? ACTUA_CMDS.filter(c => c.atomo).length : -1,
  scripts: document.querySelectorAll('script[data-atomo-nube]').length,
  paneles: document.querySelectorAll('.nube-herramienta').length,
  fila: typeof ACTUA_CMDS !== 'undefined' ? ACTUA_CMDS.length : -1,
  global: typeof datoAgendaEntender !== 'undefined' || typeof TRAMITE_PLANTILLAS !== 'undefined' || typeof validar !== 'undefined'
}));
const limpio = e => e.nube && e.cargados.length === 0 && e.reglasNube === 0 && e.scripts === 0 && !e.global;
(async () => {
  console.log('\n━━━ A · arranca SIN piezas; el mail de Laura trae la pieza de la nube y la suelta ━━━');
  { const h = await abrir({ fb:true, cfg:CFG, ls:LS, wait:2500 }); const p = h.page;
    const log = await groqFalso(p, () => 'RESPUESTA_MODELO');
    const e0 = await estado(p);
    t('arranca sin piezas: ningún átomo cargado ni enchufado, nada en memoria', limpio(e0) && e0.paneles === 0, e0);
    t('  solo leyó el catálogo de la nube (unos KB de fichas), ningún átomo', h.srv._nube.length >= 1 && h.srv._nube.every(r => r === 'catalogo.json'), h.srv._nube);
    let r = await decir(p, '¿Me pasás la dirección de mail de Laura?', 2200);
    t('«¿Me pasás la dirección de mail de Laura?» → la app da el mail, sin el modelo', /laura\.pena00@gmail\.com/.test(r) && log.length === 0, r.slice(0, 200));
    t('  con la tarjeta ✉', await p.evaluate(() => [...document.querySelectorAll('#chat a')].some(a => /^mailto:laura\.pena00@gmail\.com/.test(a.getAttribute('href') || ''))));
    t('  la pieza vino de la nube (pidió atomos/dato_agenda.js)', h.srv._nube.indexOf('dato_agenda.js') >= 0, h.srv._nube);
    let e1 = await estado(p);
    t('  y al terminar el turno la SOLTÓ: sin regla, sin <script>, sin funciones en memoria', limpio(e1) && e1.fila === e0.fila, e1);
    t('  el registro dice que la trajo y la soltó', await p.evaluate(() => ATOMOS_NUBE.registro.some(x => x.id === 'dato_agenda' && x.trajo && x.solto)));
    r = await decir(p, 'LA TENÉS EN CONTACTOS', 2000);
    t('«LA TENÉS EN CONTACTOS» → la vuelve a traer, da el mail y la suelta', /laura\.pena00@gmail\.com/.test(r) && limpio(await estado(p)), r.slice(0, 200));
    const n = h.srv._nube.length, nl = log.length;
    r = await decir(p, 'explicame la tabla periódica', 1800);
    t('control: «explicame la tabla periódica» es del modelo y NO trae ninguna pieza', log.length > nl && h.srv._nube.length === n, h.srv._nube.slice(n));
    r = await decir(p, '¿qué piezas tenés?', 1600);
    t('«¿qué piezas tenés?» → núcleo + nube (Dato de agenda en la nube) + herramientas que sé armar', /En mí \(el núcleo\)/.test(r) && /En la nube/.test(r) && /Dato de agenda/.test(r) && /Calculadora/.test(r) && /Cargadas ahora: ninguna/.test(r), r.slice(0, 700));
    t('sin errores de página', !(p._pe || []).length, p._pe);
    await h.close(); }
  console.log('\n━━━ B · dos herramientas con átomos COMPARTIDOS: se arman en la charla y se desarman sin dejar nada ━━━');
  { const h = await abrir({ fb:true, cfg:CFG, ls:LS, wait:2500 }); const p = h.page;
    const log = await groqFalso(p, () => 'RESPUESTA_MODELO');
    const e0 = await estado(p), w0 = await p.evaluate(() => Object.keys(window).filter(k => !/^__habla/.test(k)).length); // __habla*: la voz de mentira del harness
    let r = await decir(p, 'armame una calculadora', 2500);
    t('«armame una calculadora» → la arma con átomos de la nube, sin el modelo', /Te armé «🧮 Calculadora»/.test(r) && log.length === 0, r.slice(0, 200));
    let e = await estado(p);
    t('  el panel está en la charla y tiene sus átomos cargados', e.paneles === 1 && ['superficie', 'campo', 'boton', 'texto', 'calcular', 'armador'].every(a => e.cargados.indexOf(a) >= 0), e);
    await p.fill('.nube-herramienta input', '(3+4)*2'); await p.click('.nube-herramienta button:not([data-nube])'); await p.waitForTimeout(300);
    t('  la calculadora FUNCIONA: (3+4)*2 → = 14 (la cuenta la hace el código)', /= 14/.test(await p.evaluate(() => document.querySelector('.nube-herramienta').innerText)));
    await p.fill('.nube-herramienta input', '1/0'); await p.press('.nube-herramienta input', 'Enter'); await p.waitForTimeout(300);
    t('  control: 1/0 → «No entiendo esa cuenta», no adivina', /No entiendo esa cuenta/.test(await p.evaluate(() => document.querySelector('.nube-herramienta').innerText)));
    const n = h.srv._nube.length;
    r = await decir(p, 'armame una lista de tareas', 2500);
    e = await estado(p);
    t('«armame una lista de tareas» → desarma la calculadora y arma la lista (una por vez)', /Te armé «📝 Lista de tareas»/.test(r) && e.paneles === 1 && await p.evaluate(() => document.querySelector('.nube-herramienta').getAttribute('data-herramienta')) === 'lista', e);
    t('  reusa los MISMOS átomos (superficie, campo, botón) y suelta los que no (texto, calcular)', ['superficie', 'campo', 'boton', 'lista'].every(a => e.cargados.indexOf(a) >= 0) && e.cargados.indexOf('calcular') < 0 && e.cargados.indexOf('texto') < 0, e.cargados);
    t('  los trajo de la nube', ['superficie.js', 'campo.js', 'boton.js', 'lista.js', 'recetas/lista.json'].every(x => h.srv._nube.slice(n).indexOf(x) >= 0), h.srv._nube.slice(n));
    await p.fill('.nube-herramienta input', 'comprar pan'); await p.press('.nube-herramienta input', 'Enter'); await p.waitForTimeout(250);
    await p.fill('.nube-herramienta input', 'llamar al plomero'); await p.click('.nube-herramienta button:not([data-nube])'); await p.waitForTimeout(250);
    t('  la lista FUNCIONA: dos tareas agregadas', await p.evaluate(() => document.querySelectorAll('.nube-herramienta li').length) === 2);
    await p.click('.nube-herramienta [data-nube="cerrar"]'); await p.waitForTimeout(500);
    e = await estado(p);
    t('«✕ desarmar» → no queda NADA: ni panel, ni átomos, ni <script>, ni reglas', limpio(e) && e.paneles === 0 && e.fila === e0.fila, e);
    t('  y la app lo dice («Desarmé…: solté N átomos»)', /Desarmé «📝 Lista de tareas»: solté 5 átomos/.test(await p.evaluate(() => document.getElementById('chat').innerText)));
    t('  la ventana quedó igual de liviana (sin globales nuevas)', await p.evaluate(() => Object.keys(window).filter(k => !/^__habla/.test(k)).length) === w0, w0);
    r = await decir(p, 'armame una calculadora', 2500);
    t('  se vuelve a armar desde la receta (no quedó copia)', /Te armé «🧮 Calculadora»/.test(r) && (await estado(p)).paneles === 1, r.slice(0, 200));
    r = await decir(p, 'cerrá la calculadora', 1500);
    t('«cerrá la calculadora» → la desarma', /Desarmé «🧮 Calculadora»/.test(r) && limpio(await estado(p)), r.slice(0, 200));
    r = await decir(p, 'cerrá la calculadora', 1500);
    t('  y si no hay ninguna, lo dice', /No tengo ninguna herramienta armada/.test(r), r.slice(0, 200));
    const nl = log.length; r = await decir(p, '¿cuánto sale una calculadora científica?', 1800);
    t('control: «¿cuánto sale una calculadora científica?» es del modelo, no arma nada', log.length > nl && (await estado(p)).paneles === 0, r.slice(0, 200));
    const n2 = log.length; r = await decir(p, 'armame una lista de 5 películas de ciencia ficción', 1800);
    t('control: «armame una lista de 5 películas…» es del modelo, no arma nada', log.length > n2 && (await estado(p)).paneles === 0, r.slice(0, 200));
    t('sin errores de página', !(p._pe || []).length, p._pe);
    await h.close(); }
  console.log('\n━━━ C · hallazgos del 18/11: la frase EXACTA de Darío y sus controles ━━━');
  { const h = await abrir({ fb:true, cfg:CFG, ls:LS, wait:2500 }); const p = h.page;
    const log = await groqFalso(p, () => 'Ahí va: ¿por qué el fotón no paga hotel? Porque viaja liviano.');
    let r = await decir(p, 'DORMÍ PIEZA AGENDA, ¿ME PASAS EL MAIL DE LAURA?', 2200);
    t('«DORMÍ PIEZA AGENDA, ¿ME PASAS EL MAIL DE LAURA?» → duerme la pieza', /quedó dormida/.test(r) && !/No tengo ninguna pieza que se llame/.test(r), r.slice(0, 300));
    t('  y lo otro sigue su camino: la app dice que la pieza está dormida, sin dar el mail ni ir al modelo', /está dormida en este dispositivo: no te doy el dato/.test(r) && !/laura\.pena00/.test(r) && log.length === 0, r.slice(0, 400));
    r = await decir(p, '¿Me pasás el mail de Laura?', 2000);
    t('hallazgo 3: dormida + «¿Me pasás el mail de Laura?» → «la pieza está dormida», no «no tengo el mail»', /Dato de agenda», y está dormida/.test(r) && /despertá la pieza de agenda/.test(r) && log.length === 0, r.slice(0, 300));
    r = await decir(p, 'DESPERTÁ PIEZA AGENDA, ¿ME PASAS EL MAIL DE LAURA?', 2200);
    t('«DESPERTÁ PIEZA AGENDA, ¿ME PASAS EL MAIL DE LAURA?» → despierta y da el mail', /despierta otra vez/.test(r) && /laura\.pena00@gmail\.com/.test(r) && log.length === 0, r.slice(0, 300));
    t('  y la soltó al terminar', limpio(await estado(p)));
    r = await decir(p, 'dormí la pieza de agenda', 1600);
    t('control: «dormí la pieza de agenda» sola → dormida', /quedó dormida/.test(r) && !/lo otro/.test(r), r.slice(0, 200));
    r = await decir(p, 'despertá la pieza de agenda', 1600);
    r = await decir(p, 'DORMÍ PIEZA AGENDA', 1600);
    t('control: «DORMÍ PIEZA AGENDA» → dormida', /quedó dormida/.test(r), r.slice(0, 200));
    r = await decir(p, 'dormí la pieza de teletransporte', 1600);
    t('control: «dormí la pieza de teletransporte» → no la tengo', /No tengo ninguna pieza que se llame «teletransporte»/.test(r), r.slice(0, 300));
    t('  hallazgo 2: y dice cuáles hay y cuál se puede dormir', /Las que tengo: /.test(r) && /Dato de agenda/.test(r) && /Manos/.test(r) && /Solo Dato de agenda se puede dormir/.test(r), r.slice(0, 300));
    r = await decir(p, 'DESPERTÁ LA PIEZA GRANDE', 1600);
    t('hallazgo 2: «DESPERTÁ LA PIEZA GRANDE» → no la tengo + las que tengo', /«GRANDE»/.test(r) && /Las que tengo:/.test(r), r.slice(0, 300));
    r = await decir(p, 'despertá la pieza de agenda', 1600);
    const nl = log.length;
    r = await decir(p, 'dormí la pieza de agenda y contame un chiste', 3200);
    t('«dormí la pieza de agenda y contame un chiste» → la duerme y el chiste lo cuenta el modelo, aparte', /quedó dormida/.test(r) && /viaja liviano/.test(r) && log.length > nl, r.slice(0, 400));
    t('sin errores de página', !(p._pe || []).length, p._pe);
    await h.close(); }
  console.log('\n━━━ D · sin red o sin la pieza: aviso honesto, no se inventa ━━━');
  { const h = await abrir({ fb:true, cfg:CFG, ls:LS, wait:2500, nubeFalla: r => r === 'dato_agenda.js' || r === 'calcular.js' }); const p = h.page;
    const log = await groqFalso(p, () => 'No tengo la dirección de mail de Laura. ¿Me la pasás?');
    let r = await decir(p, '¿Me pasás la dirección de mail de Laura?', 2200);
    t('la pieza no llega → «no llegó… No te invento el dato», sin el modelo y sin el mail', /no llegó/.test(r) && /No te invento el dato/.test(r) && !/laura\.pena00/.test(r) && log.length === 0, r.slice(0, 300));
    t('  y no quedó nada colgado', limpio(await estado(p)));
    r = await decir(p, 'armame una calculadora', 2500);
    t('una herramienta a la que le falta un átomo → «no pude», sin mostrar algo a medias', /no pude/.test(r) && (await estado(p)).paneles === 0, r.slice(0, 300));
    t('  y soltó lo que había traído', limpio(await estado(p)), await estado(p));
    t('sin errores de página', !(p._pe || []).length, p._pe);
    await h.close(); }
  { const cat = fs.readFileSync(path.join(process.env.NUBE_DIR || path.join(__dirname, '..', '..', 'atomos'), 'catalogo.json'), 'utf8');
    const h = await abrir({ fb:true, cfg:CFG, ls:Object.assign({ mirror_nube_catalogo: cat }, LS), wait:2500, nube:false }); const p = h.page;
    const log = await groqFalso(p, () => 'RESPUESTA_MODELO');
    let r = await decir(p, '¿Me pasás la dirección de mail de Laura?', 2200);
    t('sin red (nada de la nube llega; queda la copia del catálogo) → aviso honesto, no inventa', /no llegó/.test(r) && !/laura\.pena00/.test(r) && log.length === 0, r.slice(0, 300));
    r = await decir(p, 'explicame qué es un átomo', 1800);
    t('  control: lo que no es de la pieza sigue andando con el modelo', /RESPUESTA_MODELO/.test(r), r.slice(0, 200));
    t('sin errores de página', !(p._pe || []).length, p._pe);
    await h.close(); }
  { const h = await abrir({ fb:true, cfg:CFG, ls:LS, wait:2500, nube:false }); const p = h.page;
    const log = await groqFalso(p, () => 'RESPUESTA_MODELO');
    let r = await decir(p, '¿qué piezas tenés?', 1800);
    t('sin red y sin copia: «¿qué piezas tenés?» → lo del núcleo + «no pude leer su catálogo», sin inventar', /En mí \(el núcleo\)/.test(r) && /no pude leer su catálogo/.test(r), r.slice(0, 500));
    t('sin errores de página', !(p._pe || []).length, p._pe);
    await h.close(); }
  console.log('\n━━━ E · las plantillas de trámites, traídas de la nube a su lugar de la fila ━━━');
  { const h = await abrir({ fb:true, cfg:CFG, ls:LS, wait:2500 }); const p = h.page;
    const log = await groqFalso(p, () => 'RESPUESTA_MODELO');
    let r = await decir(p, 'plantilla de inasistencia del 5 de agosto por gripe', 2200);
    t('«plantilla de inasistencia…» → la arma la pieza traída de la nube, sin el modelo', /Te dejé la plantilla armada/.test(r) && log.length === 0 && h.srv._nube.indexOf('plantillas_tramite.js') >= 0, r.slice(0, 200));
    t('  y la soltó', limpio(await estado(p)));
    const nl = log.length; r = await decir(p, '¿qué modelo de IA usás?', 1800);
    t('control: «¿qué modelo de IA usás?» no es un trámite', !/plantilla/i.test(r), r.slice(0, 200));
    t('sin errores de página', !(p._pe || []).length, p._pe);
    await h.close(); }
  console.log('\n' + (mal === 0 ? '✅ TODO VERDE — ' + ok + ' casos' : '❌ ' + mal + ' fallos de ' + (ok + mal)));
  process.exit(mal === 0 ? 0 : 1);
})().catch(e => { console.log('❌ ' + e.message); process.exit(1); });
