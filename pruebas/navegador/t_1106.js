// t_1106.js — build 2026-11-06.x: el hallazgo EN VIVO de Darío del 29/10 (contactos), con sus frases EXACTAS, en Chromium real.
// Uso: FILE=…/index.html NODE_PATH=$(npm root -g) node t_1106.js   (≈1 min). Sobre la 29.2 tiene que dar ROJO.
// CONTROLES: preguntas generales siguen yendo al modelo; el mail no viaja al modelo ni queda en la charla guardada.
const { abrir } = require('./harness.js');
const CFG = { appName:'MANIFIESTOS', perfil:{ nombre:'ATIS' }, modos:{ mirror:'ATIS', tars:'MODO ANALÍTICO', jurado:'EXPERTO/EXAMINADOR', conn:'BASE' }, modeloPrincipal:'openai/gpt-oss-120b', motorPrincipal:'groq' };
const AG = { 'laura pena': { nombre:'Laura Peña', email:'laura.pena00@gmail.com', tel:'+5492984112233', dir:'' }, 'juan perez': { nombre:'Juan Pérez', tel:'2984556677' } };
let ok = 0, mal = 0;
function t(n, c, d){ if (c){ ok++; console.log('  ✅ ' + n); } else { mal++; console.log('  ❌ ' + n + (d !== undefined ? '  → ' + String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 300) : '')); } }
const ultimo = p => p.evaluate(() => { const m = document.querySelectorAll('#chat .msg'); return m.length ? m[m.length - 1].innerText : ''; });
const CORS = { 'access-control-allow-origin':'*' };
async function groqFalso(p, fn){ const log = []; await p.route('**/proxy/groq', async route => { const b = JSON.parse(route.request().postData() || '{}'); const todo = (b.messages || []).map(m => typeof m.content === 'string' ? m.content : JSON.stringify(m.content)).join('\n'); log.push(todo); return route.fulfill({ status:200, contentType:'application/json', headers:CORS, body: JSON.stringify({ choices:[{ message:{ role:'assistant', content: fn(todo) } }] }) }); }); return log; }
async function decir(p, q, ms){ await p.fill('#inp', q); await p.keyboard.press('Enter'); await p.waitForTimeout(ms || 1500); return p.evaluate(() => document.getElementById('chat').innerText); }
(async () => {
  console.log('\n━━━ A · «¿Me pasás la dirección de mail de Laura?» → «LA TENÉS EN CONTACTOS» (ATIS, Laura en 📇) ━━━');
  { const h = await abrir({ fb:true, cfg:CFG, ls:{ mirror_agenda: JSON.stringify(AG) } }); const p = h.page;
    const log = await groqFalso(p, () => 'No tengo la dirección de mail de Laura. ¿Me la pasás?');
    const antes = await p.evaluate(() => document.getElementById('chat').innerText.length);
    let chat = await decir(p, '¿Me pasás la dirección de mail de Laura?', 1800);
    const nuevo1 = chat.slice(antes);
    t('la app da el mail de Laura', /laura\.pena00@gmail\.com/.test(nuevo1), nuevo1.slice(-300));
    t('  y NO dice «No tengo la dirección de mail»', !/No tengo la direcci[oó]n de mail/.test(nuevo1), nuevo1.slice(-300));
    t('  con la tarjeta ✉ lista (mailto con la dirección)', await p.evaluate(() => [...document.querySelectorAll('#chat a')].some(a => /^mailto:laura\.pena00@gmail\.com/.test(a.getAttribute('href') || ''))));
    t('  sin pasar por el modelo', log.length === 0, log.length + ' pedidos al modelo');
    const a2 = chat.length; chat = await decir(p, 'LA TENÉS EN CONTACTOS', 1800);
    t('«LA TENÉS EN CONTACTOS» → contesta la app, con el dato', /laura\.pena00@gmail\.com/.test(chat.slice(a2)) && log.length === 0, chat.slice(a2).slice(-300));
    const hist = await p.evaluate(() => JSON.stringify(history));
    t('el mail NO queda en la charla guardada (history tapado)', !/laura\.pena00/.test(hist) && /\[mail de tu agenda\]/.test(hist), hist.slice(-300));
    // control: una pregunta general sigue yendo al modelo, y no le llega el mail
    const n0 = log.length; await decir(p, 'explicame qué es la entropía con un ejemplo', 1800);
    t('control: la pregunta general va al modelo', log.length > n0, log.length);
    t('control: y al modelo NO le llega el mail de Laura', !log.some(x => /laura\.pena00/.test(x)));
    const n1 = log.length; await decir(p, '¿me pasás el número de la policía?', 1800);
    t('control: «¿me pasás el número de la policía?» es del modelo (no dice «no está en tu agenda»)', log.length > n1);
    t('sin errores de página', !(p._pe || []).length, p._pe);
    await h.close(); }
  console.log('\n━━━ B · dos «Laura» → pregunta cuál; el nombre pelado lo resuelve ━━━');
  { const ag = Object.assign({ 'laura gomez': { nombre:'Laura Gómez', email:'lgomez@x.com' } }, AG);
    const h = await abrir({ fb:true, cfg:CFG, ls:{ mirror_agenda: JSON.stringify(ag) } }); const p = h.page;
    const log = await groqFalso(p, () => 'RESPUESTA_MODELO');
    let a = (await p.evaluate(() => document.getElementById('chat').innerText)).length;
    let chat = await decir(p, '¿Me pasás la dirección de mail de Laura?', 1500);
    t('pregunta cuál, sin dar ningún mail', /2 contactos/.test(chat.slice(a)) && !/@/.test(chat.slice(a)), chat.slice(a).slice(-250));
    a = chat.length; chat = await decir(p, 'Laura Peña', 1500);
    t('«Laura Peña» → ahora sí, sus datos', /laura\.pena00@gmail\.com/.test(chat.slice(a)) && log.length === 0, chat.slice(a).slice(-250));
    await h.close(); }
  console.log('\n━━━ C · no está en la agenda ━━━');
  { const h = await abrir({ fb:true, cfg:CFG, ls:{ mirror_agenda: JSON.stringify(AG) } }); const p = h.page;
    const log = await groqFalso(p, () => 'RESPUESTA_MODELO');
    const a = (await p.evaluate(() => document.getElementById('chat').innerText)).length;
    const chat = await decir(p, 'pasame el mail de Rodolfo, está en mis contactos', 1500);
    t('lo dice de frente, sin inventar y sin el modelo', /No tengo a «Rodolfo/.test(chat.slice(a)) && log.length === 0, chat.slice(a).slice(-250));
    await h.close(); }
  console.log('\n' + (mal === 0 ? '✅ TODO VERDE — ' + ok + ' casos' : '❌ ' + mal + ' fallos de ' + (ok + mal)));
  process.exit(mal === 0 ? 0 : 1);
})().catch(e => { console.log('❌ ' + e.message); process.exit(1); });
