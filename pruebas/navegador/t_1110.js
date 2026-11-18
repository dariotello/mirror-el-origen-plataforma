// t_1110.js — build 2026-11-10.x: (A) «Mi versión» sin agregados inventados (hallazgo en vivo de Darío, 06/11) ·
// (B) la tabla periódica: ENTIDAD_PIEZAS sale de las fichas, y dormir/despertar el átomo dato_agenda (skill atomos-mirror).
// Uso: FILE=…/index.html NODE_PATH=$(npm root -g) node t_1110.js. Sobre la 11-06.2 tiene que dar ROJO. Lleva CONTROLES.
const { abrir } = require('./harness.js');
const CFG = { appName:'MANIFIESTOS', perfil:{ nombre:'ATIS' }, modos:{ mirror:'ATIS', tars:'MODO ANALÍTICO', jurado:'EXPERTO/EXAMINADOR', conn:'BASE' }, modeloPrincipal:'openai/gpt-oss-120b', motorPrincipal:'groq' };
const AG = { 'laura pena': { nombre:'Laura Peña', email:'laura.pena00@gmail.com', tel:'+5492984112233' } };
const INVENTO = 'Todo bien por acá, con ganas de laburar. Además, ahora manejo mejor el contexto de tu estilo informal y directo, y el reconocimiento de los bloques de memoria y de acción está afinado, así que soy compatible con los flujos que usás para redactar mails.';
let ok = 0, mal = 0;
function t(n, c, d){ if (c){ ok++; console.log('  ✅ ' + n); } else { mal++; console.log('  ❌ ' + n + (d !== undefined ? '  → ' + String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 300) : '')); } }
const CORS = { 'access-control-allow-origin':'*' };
async function groqFalso(p, fn){ const log = []; await p.route('**/proxy/groq', async route => { const b = JSON.parse(route.request().postData() || '{}'); const todo = (b.messages || []).map(m => typeof m.content === 'string' ? m.content : '').join('\n'); log.push(todo); return route.fulfill({ status:200, contentType:'application/json', headers:CORS, body: JSON.stringify({ choices:[{ message:{ role:'assistant', content: fn(todo) } }] }) }); }); return log; }
async function decir(p, q, ms){ const a = (await p.evaluate(() => document.getElementById('chat').innerText)).length; await p.fill('#inp', q); await p.keyboard.press('Enter'); await p.waitForTimeout(ms || 1600); return (await p.evaluate(() => document.getElementById('chat').innerText)).slice(a); }
(async () => {
  console.log('\n━━━ A · «Mi versión» + otra pregunta: el modelo no suma mejoras inventadas ━━━');
  { const h = await abrir({ fb:true, cfg:CFG }); const p = h.page;
    const log = await groqFalso(p, () => INVENTO);
    const r = await decir(p, 'QUE VERSION SOS Y COMO ESTAS?', 2200);
    t('el bloque fijo de la versión está', /Mi versión: soy la v40 · build/.test(r), r.slice(0, 200));
    t('la otra parte la contesta el modelo («Todo bien por acá»)', /Todo bien por acá/.test(r) && log.length > 0, r.slice(-300));
    t('la frase inventada («manejo mejor… soy compatible…») NO aparece', !/manejo mejor|soy compatible|afinad/.test(r), r.slice(-300));
    t('sin errores de página', !(p._pe || []).length, p._pe);
    await h.close(); }
  { const h = await abrir({ fb:true, cfg:CFG }); const p = h.page;
    await groqFalso(p, () => 'Te explico: el reconocimiento de patrones es clave en física, y ahora podemos verlo con un ejemplo.');
    const r = await decir(p, 'explicame qué es el reconocimiento de patrones', 2000);
    t('control: sin pregunta de versión, el modelo no se recorta', /ahora podemos verlo con un ejemplo/.test(r), r.slice(-250));
    await h.close(); }
  console.log('\n━━━ B · la tabla periódica (ENTIDAD_PIEZAS) y dormir/despertar ━━━');
  { const h = await abrir({ fb:true, cfg:CFG, ls:{ mirror_agenda: JSON.stringify(AG) } }); const p = h.page;
    const log = await groqFalso(p, () => 'RESPUESTA_MODELO');
    const cat = await p.evaluate(() => typeof ENTIDAD_PIEZAS !== 'undefined' ? ENTIDAD_PIEZAS : null);
    t('ENTIDAD_PIEZAS existe y trae las 5 piezas de las fichas', Array.isArray(cat) && ['agente','dato_agenda','investigador','manos'].every(id => cat.some(x => x.id === id)), cat && cat.map(x => x.id));
    t('  el átomo dice que es átomo, dónde se ensambla y que se puede dormir', !!(cat || []).find(x => x.id === 'dato_agenda' && x.tipo === 'átomo' && x.se_ensambla_en === 'manos' && x.dormible === true));
    let r = await decir(p, '¿qué piezas tenés?', 1500);
    t('«¿qué piezas tenés?» → la lista sale del catálogo, sin el modelo', /Mis piezas/.test(r) && /Dato de agenda/.test(r) && /Manos/.test(r) && log.length === 0, r.slice(0, 300));
    r = await decir(p, 'dormí la pieza de agenda', 1500);
    t('«dormí la pieza de agenda» → dormida', /quedó dormida/.test(r), r.slice(0, 200));
    r = await decir(p, '¿Me pasás la dirección de mail de Laura?', 1800);
    t('dormida: el átomo NO actúa (va al modelo como en la 29.2, sin el mail)', log.length > 0 && !/laura\.pena00/.test(r), r.slice(0, 200));
    r = await decir(p, 'despertá la pieza de agenda', 1500);
    t('«despertá la pieza de agenda» → despierta', /despierta otra vez/.test(r), r.slice(0, 200));
    const n0 = log.length; r = await decir(p, '¿Me pasás la dirección de mail de Laura?', 1800);
    t('despierta: vuelve a dar el mail, sin el modelo', /laura\.pena00@gmail\.com/.test(r) && log.length === n0, r.slice(0, 200));
    r = await decir(p, 'dormí la pieza de manos', 1500);
    t('control: un órgano no dormible no se duerme desde el chat', /no se puede dormir/.test(r), r.slice(0, 200));
    r = await decir(p, 'dormí la pieza de teletransporte', 1500);
    t('control: una pieza que no existe → lo dice, no inventa', /No tengo ninguna pieza/.test(r), r.slice(0, 200));
    const n1 = log.length; await decir(p, 'explicame la tabla periódica', 1800);
    t('control: «explicame la tabla periódica» (química) es del modelo', log.length > n1);
    t('sin errores de página', !(p._pe || []).length, p._pe);
    await h.close(); }
  console.log('\n' + (mal === 0 ? '✅ TODO VERDE — ' + ok + ' casos' : '❌ ' + mal + ' fallos de ' + (ok + mal)));
  process.exit(mal === 0 ? 0 : 1);
})().catch(e => { console.log('❌ ' + e.message); process.exit(1); });
