// t_1118.js — build 2026-11-18.x: hallazgo EN VIVO de Darío (16/11, Edge, build 2026-11-10.1):
// «QUE VERSION SOS? qué piezas tenés?» en UN mensaje → la versión salió fija, pero las piezas las contestó el MODELO,
// inventando («Mis "piezas" son los modos que manejo: ATIS…»). Ahora la consulta del catálogo es un HECHO por partes.
// Uso: FILE=…/index.html NODE_PATH=$(npm root -g) node t_1118.js. Sobre la 11-10.1 tiene que dar ROJO. Lleva CONTROLES.
const { abrir } = require('./harness.js');
const CFG = { appName:'MANIFIESTOS', perfil:{ nombre:'ATIS' }, modos:{ mirror:'ATIS', tars:'MODO ANALÍTICO', jurado:'EXPERTO/EXAMINADOR', conn:'BASE' }, modeloPrincipal:'openai/gpt-oss-120b', motorPrincipal:'groq' };
const INVENTO = 'Mis "piezas" son los modos que manejo: ATIS (modo espejo, hablo como vos), MODO ANALÍTICO (para subir, analizar y generar informes de archivos), EXPERTO/EXAMINADOR (consultas técnicas) y BASE (funciones básicas del motor).';
let ok = 0, mal = 0;
function t(n, c, d){ if (c){ ok++; console.log('  ✅ ' + n); } else { mal++; console.log('  ❌ ' + n + (d !== undefined ? '  → ' + String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 300) : '')); } }
const CORS = { 'access-control-allow-origin':'*' };
async function groqFalso(p, fn){ const log = []; await p.route('**/proxy/groq', async route => { const b = JSON.parse(route.request().postData() || '{}'); const todo = (b.messages || []).map(m => typeof m.content === 'string' ? m.content : '').join('\n'); log.push(todo); return route.fulfill({ status:200, contentType:'application/json', headers:CORS, body: JSON.stringify({ choices:[{ message:{ role:'assistant', content: fn(todo) } }] }) }); }); return log; }
async function decir(p, q, ms){ const a = (await p.evaluate(() => document.getElementById('chat').innerText)).length; await p.fill('#inp', q); await p.keyboard.press('Enter'); await p.waitForTimeout(ms || 1600); return (await p.evaluate(() => document.getElementById('chat').innerText)).slice(a); }
const LISTA = r => /Mis piezas \(la tabla periódica/.test(r) && /Dato de agenda/.test(r) && /Manos/.test(r);
(async () => {
  console.log('\n━━━ A · la frase EXACTA de Darío y sus variantes: versión + piezas, todo de la app ━━━');
  { const h = await abrir({ fb:true, cfg:CFG }); const p = h.page;
    const log = await groqFalso(p, () => INVENTO);
    let n = log.length, r = await decir(p, 'QUE VERSION SOS? qué piezas tenés?', 2200);
    t('«QUE VERSION SOS? qué piezas tenés?» → el bloque fijo de la versión', /Mi versión: soy la v40 · build/.test(r), r.slice(0, 200));
    t('  … y la lista REAL de piezas (de las fichas)', LISTA(r), r.slice(0, 400));
    t('  … sin el modelo y sin el invento de «piezas = modos»', log.length === n && !/modos que manejo|funciones básicas del motor/.test(r), r.slice(-300));
    n = log.length; r = await decir(p, 'que version sos y que piezas tenes', 2200);
    t('sin signos ni tildes («que version sos y que piezas tenes») → las dos, sin el modelo', /Mi versión: soy la v40/.test(r) && LISTA(r) && log.length === n, r.slice(0, 300));
    n = log.length; r = await decir(p, '¿qué hora es? ¿cuáles son tus piezas?', 2000);
    t('«¿qué hora es? ¿cuáles son tus piezas?» → hora + piezas, sin el modelo', /Son las \d\d:\d\d/.test(r) && LISTA(r) && log.length === n, r.slice(0, 300));
    t('sin errores de página', !(p._pe || []).length, p._pe);
    await h.close(); }
  { const h = await abrir({ fb:true, cfg:CFG }); const p = h.page;
    const log = await groqFalso(p, () => 'Ahí va uno: ¿qué le dice un electrón a otro? ¡No seas negativo! Y mis piezas son los modos ATIS y BASE.');
    const r = await decir(p, '¿qué piezas tenés? y contame un chiste', 2400);
    t('piezas + otro pedido → la lista de la app y el chiste del modelo', LISTA(r) && /No seas negativo/.test(r) && log.length > 0, r.slice(-300));
    t('  lo que el modelo diga de «mis piezas» se descarta', !/mis piezas son los modos/i.test(r), r.slice(-200));
    await h.close(); }
  console.log('\n━━━ B · CONTROLES: lo que NO tiene que agarrar ━━━');
  { const h = await abrir({ fb:true, cfg:CFG }); const p = h.page;
    const log = await groqFalso(p, () => 'RESPUESTA_MODELO');
    let r = await decir(p, '¿qué piezas tenés?', 1500);
    t('control: «¿qué piezas tenés?» sola sigue dando la lista, sin el modelo', LISTA(r) && log.length === 0, r.slice(0, 300));
    let n = log.length; r = await decir(p, 'QUE VERSION SOS? qué piezas hay en el ajedrez?', 2200);
    t('control: «…qué piezas hay en el ajedrez?» → versión fija, el ajedrez al modelo, sin mi lista', /Mi versión: soy la v40/.test(r) && log.length > n && !/Mis piezas \(la tabla/.test(r), r.slice(0, 300));
    n = log.length; r = await decir(p, '¿cuáles son las piezas del auto que más se gastan?', 2000);
    t('control: «piezas del auto» es del modelo', log.length > n && !/Mis piezas \(la tabla/.test(r), r.slice(0, 200));
    n = log.length; r = await decir(p, 'cuántas piezas tiene un rompecabezas de mil', 2000);
    t('control: «piezas de un rompecabezas» es del modelo', log.length > n && !/Mis piezas \(la tabla/.test(r), r.slice(0, 200));
    t('sin errores de página', !(p._pe || []).length, p._pe);
    await h.close(); }
  console.log('\n' + (mal === 0 ? '✅ TODO VERDE — ' + ok + ' casos' : '❌ ' + mal + ' fallos de ' + (ok + mal)));
  process.exit(mal === 0 ? 0 : 1);
})().catch(e => { console.log('❌ ' + e.message); process.exit(1); });
