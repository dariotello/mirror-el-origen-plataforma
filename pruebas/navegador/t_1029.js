// t_1029.js — build 2026-10-29.x: los hallazgos EN VIVO de Darío del 23/10, con sus frases exactas.
// (Reescrita el 29/10 a la tarde sobre la build del chat: la de 55 casos se perdió al pisarse la carpeta. Prueba COMPORTAMIENTO, no nombres internos.)
// Uso: FILE=…/index.html NODE_PATH=$(npm root -g) node t_1029.js   (≈1–2 min)
// Cada bloque lleva CONTROLES (lo que NO tiene que agarrar). Sobre la 23.2 tiene que dar ROJO.
const { abrir } = require('./harness.js');
const CFG = { appName:'MANIFIESTOS', perfil:{ nombre:'ATIS' }, modos:{ mirror:'ATIS', tars:'MODO ANALÍTICO', jurado:'EXPERTO/EXAMINADOR', conn:'BASE' }, modeloPrincipal:'openai/gpt-oss-120b', motorPrincipal:'groq' };
let ok = 0, mal = 0;
function t(n, c, d){ if (c){ ok++; console.log('  ✅ ' + n); } else { mal++; console.log('  ❌ ' + n + (d !== undefined ? '  → ' + String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 300) : '')); } }
const ultimo = p => p.evaluate(() => { const m = document.querySelectorAll('#chat .msg'); return m.length ? m[m.length - 1].innerText : ''; });
const CORS = { 'access-control-allow-origin':'*' };
// Groq simulado: contesta según el pedido y guarda TODO lo que le llega (para ver qué contexto viaja)
async function groqFalso(p, fnRespuesta){
  const log = [];
  await p.route('**/proxy/groq', async route => {
    const b = JSON.parse(route.request().postData() || '{}');
    const sys = (b.messages && b.messages[0] && b.messages[0].content) || '';
    const todo = (b.messages || []).map(m => m.content).join('\n');
    log.push({ sys, todo });
    const c = fnRespuesta(sys, todo, b);
    if (c && c.tool) return route.fulfill({ status: 200, contentType:'application/json', headers: CORS, body: JSON.stringify({ choices:[{ message:{ role:'assistant', content:'', tool_calls:[{ id:'call_1', type:'function', function:{ name:'agendar', arguments: JSON.stringify(c.tool) } }] } }], usage:{ total_tokens: 100 } }) });
    return route.fulfill({ status: 200, contentType:'application/json', headers: CORS, body: JSON.stringify({ choices:[{ message:{ role:'assistant', content:c } }] }) });
  });
  return log;
}
async function decir(p, q, ms){ await p.fill('#inp', q); await p.keyboard.press('Enter'); await p.waitForTimeout(ms || 1500); return ultimo(p); }
const docGrande = () => { const frases = []; for (let i = 0; i < 2600; i++) frases.push('La tesis de Villa Regina analiza la enseñanza de la física y la entropía en la escuela secundaria, párrafo ' + i + '.'); return frases.join(' '); };

(async () => {
  // ── A · continuidad: «DECIME LAS CONCLUSIONES» después de una investigación, con la tesis cargada ──────────
  console.log('\n━━━ A · el informe viaja en la repregunta (MODO ANALÍTICO, con documentos cargados) ━━━');
  { const h = await abrir({ fb:true, cfg:CFG }); const p = h.page;
    const log = await groqFalso(p, (sys) => /planificador/.test(sys) ? '{"busquedas":["\\"Darío Tello\\" tesis Villa Regina física","Tello enseñanza entropía secundaria Río Negro"]}'
      : (/modo investigaci/.test(sys) ? '**En corto** La tesis estudia la entropía en la secundaria. CONCLUSION-ZETA-77: el enfoque por proyectos mejora la comprensión.\n\n**Lo que encontré** Nada en la web sobre esto.' : 'RESPUESTA_NORMAL'));
    const tav = [];
    await p.route('**/proxy/tavily', route => { try { tav.push(JSON.parse(route.request().postData() || '{}').query); } catch(_){} return route.fulfill({ status: 200, contentType:'application/json', headers: CORS, body: JSON.stringify({ results: [
      { title:'Otro Tello, abogado', url:'https://ejemplo.org/tello-abogado', content:'Un abogado de apellido Tello en otra provincia.' },
      { title:'Tello futbolista', url:'https://ejemplo.org/tello-futbol', content:'Un futbolista Tello.' } ] }) }); });
    await p.evaluate((txt) => { ragDocs.push({ id:'sess_1', name:'Proyecto_Tesis_Tello_FINAL_COMITE_1.docx', type:'session', content: txt }); setMode('tars'); }, docGrande());
    await p.fill('#inp', 'investigá a fondo sobre el proyecto de tesis de Darío Tello'); await p.keyboard.press('Enter');
    await p.waitForFunction(() => /las armó la app/.test(document.getElementById('chat').innerText), null, { timeout: 30000 }).catch(() => {});
    const inf = await ultimo(p);
    const plan = log.find(x => /planificador/.test(x.sys));
    t('persona/proyecto: el plan recibe pistas de quién pregunta (el documento cargado)', !!plan && /PISTAS DE QUIÉN PREGUNTA/.test(plan.todo) && /Proyecto_Tesis_Tello_FINAL_COMITE_1/.test(plan.todo), plan && plan.todo.slice(0, 300));
    t('  y la pregunta cruda NO va sola al buscador (traía homónimos)', tav.length >= 2 && tav.indexOf('el proyecto de tesis de Darío Tello') < 0 && tav.indexOf('sobre el proyecto de tesis de Darío Tello') < 0 && tav.every(q => /Villa Regina|entrop|Río Negro/.test(q)), tav);
    t('0 citas: el aviso va ARRIBA, antes del informe', /^⚠️ De frente: la web no aportó nada citable sobre esto/.test(inf.replace(/^[\s◈]+/, '').replace(/^🌐 BÚSQUEDA WEB\s*/, '')) && /0 de 2 fuentes/.test(inf), inf.slice(0, 200));
    t('  y dice de dónde sale (tus documentos)', /tus documentos y tu memoria/.test(inf), inf.slice(0, 260));
    // las dos frases EXACTAS de Darío
    for (const q of ['DECIME LAS CONCLUSIONES', 'TE ESTOY PIDIENDO LAS CONCLUSIONES DE LA INVESTIGACIÓN A FONDO QUE HICISTE']){
      const n0 = log.length; const u = await decir(p, q, 1800);
      const env = log.slice(n0).map(x => x.todo).join('\n');
      t('«' + q + '» → el informe le llega al modelo', /CONCLUSION-ZETA-77/.test(env) && /TU ÚLTIMO (?:INFORME|ANÁLISIS)/.test(env), env.length + ' chars, sin el informe');
      t('  …con el chip «🔎 tu informe»', /🔎 tu informe/.test(u), u.slice(-160));
    }
    // botón para leer el documento entero
    const u2 = await decir(p, 'DECIME LAS CONCLUSIONES DEL DOCUMENTO', 1800);
    t('conclusiones del DOCUMENTO con docs cargados → ofrece «📄 leer … entero»', /📄 leer «Proyecto_Tesis_Tello_FINAL_COMITE_1\.docx» entero/.test(u2), u2.slice(-200));
    // controles
    const n1 = log.length; const u3 = await decir(p, 'explicame la entropía con un ejemplo de la cocina', 1500);
    t('control: una pregunta que no habla del informe NO lo arrastra', !/TU ÚLTIMO (?:INFORME|ANÁLISIS)/.test(log.slice(n1).map(x => x.todo).join('\n')));
    t('control: ni ofrece leer el documento entero', !/entero para esto/.test(u3));
    await h.close(); }

  { const h = await abrir({ fb:true, cfg:CFG }); const p = h.page;
    const log = await groqFalso(p, () => 'RESPUESTA_NORMAL');
    const n0 = log.length; await decir(p, 'DECIME LAS CONCLUSIONES', 1500);
    t('control: sin investigación previa, «DECIME LAS CONCLUSIONES» no inventa un «último trabajo»', log.length > n0 && !/TU ÚLTIMO (?:INFORME|ANÁLISIS)/.test(log.slice(n0).map(x => x.todo).join('\n')));
    t('control: sin documentos no hay botón 📄', !/entero para esto/.test(await ultimo(p)));
    t('persona: «paneles solares en Villa Regina» NO se toma como persona (un lugar)', await p.evaluate(() => invEsPersonaOProyecto('si conviene poner paneles solares en Villa Regina') === false));
    t('persona: en mayúsculas («…TESIS DE DARÍO TELLO») sí', await p.evaluate(() => invEsPersonaOProyecto('INVESTIGÁ A FONDO SOBRE EL PROYECTO DE TESIS DE DARÍO TELLO') === true));
    await h.close(); }

  // ── B · nombres de la instalación, nota de versión pegada y tarjeta «compartir» ─────────────────────────
  console.log('\n━━━ B · «QUE SABES HACER?» (nombres de fábrica, nota de versión, tarjeta rara) ━━━');
  { const h = await abrir({ fb:true, cfg:CFG }); const p = h.page;
    let resp = 'Soy la 2026-10-29.1.';
    await groqFalso(p, () => resp);
    await decir(p, 'que version sos', 1500);
    resp = 'Puedo charlar, investigar y organizarte. Tengo módulos internos: TARS, EXAMINADOR, CONEX.\n- Encuestas nuevas para tu clase\n- Recordatorios\n[ACCION:{"tipo":"share","titulo":"Funciones de MANIFIESTOS","texto":"lista de funciones"}]';
    const u = await decir(p, 'QUE SABES HACER?', 1800);
    t('«QUE SABES HACER?» → nombres de TU instalación (MODO ANALÍTICO, EXPERTO/EXAMINADOR, BASE)', /MODO ANALÍTICO, EXPERTO\/EXAMINADOR, BASE/.test(u) && !/\bTARS\b|\bCONEX\b/.test(u), u.slice(0, 200));
    t('  sin «✎ Nota de la app: saqué las encuestas…» (no preguntó por la versión)', !/Nota de la app: saqué/.test(u) && /Encuestas nuevas/.test(u), u.slice(-200));
    t('  y sin la tarjeta «Funciones de MANIFIESTOS · elegir a dónde va»', !(await p.evaluate(() => /Funciones de MANIFIESTOS/.test(document.getElementById('chat').innerText))));
    // controles
    resp = 'Esta versión trae varias cosas que te van a servir en el día a día de la escuela:\n- Encuestas nuevas para tu clase\n- Ahora contesto más rápido y con menos vueltas cuando me preguntás algo';
    await decir(p, 'que version sos', 1500);
    const u2 = await decir(p, '¿y qué trae de nuevo esa versión?', 1800);
    t('control: la repregunta de VERSIÓN sí sigue corrigiendo lo que no es nuevo', /Nota de la app: saqué las encuestas/.test(u2), u2.slice(-200));
    t('control: EXPERTO/EXAMINADOR no se duplica y «analista» en minúscula no se toca', await p.evaluate(() => nombresDeFabricaEnSalida('El EXPERTO/EXAMINADOR y una analista de datos.') === 'El EXPERTO/EXAMINADOR y una analista de datos.'));
    await h.close(); }

  // ── C · tareas: duplicadas, cortadas, «recordame», «agendá:» ─────────────────────────────────────────────
  console.log('\n━━━ C · tareas (📌) sin duplicados ni cortes ━━━');
  { const h = await abrir({ fb:true, cfg:CFG, ls:{ mirror_tareas: JSON.stringify([{ id:'t_viejo', titulo:'pagar la luz el 15 de diciembr', fecha:'', ts: Date.now() - 864e5, hecha:false }]) } }); const p = h.page;
    let titAg = 'pagar el gas', cuandoAg = '3 de diciembre';
    await groqFalso(p, (sys, todo, b) => {
      if (b.tools){ const yaHizo = (b.messages || []).some(m => m.role === 'tool'); if (!yaHizo) return { tool: { titulo: titAg, cuando: cuandoAg } }; return 'Listo, quedó anotado.'; }
      return 'Listo, lo anoto. [ACCION:{"tipo":"cal","titulo":"Pagar la luz","cuando":"15 de diciembre"}]'; });
    await decir(p, 'agendame pagar la luz el 15 de diciembre', 1200);
    let ts = await p.evaluate(() => tareasActivas().map(x => x.titulo + ' · ' + x.fecha));
    t('la tarea vieja cortada y la nueva quedan en UNA, con fecha', ts.length === 1 && /2026-12-15|2027-12-15/.test(ts[0]) && !/diciembr/.test(ts[0]), ts);
    await decir(p, 'AGENDAME PAGAR LA LUZ EL 15 DE DICIEMBRE', 1200);
    ts = await p.evaluate(() => tareasActivas().map(x => x.titulo + ' · ' + x.fecha));
    t('  repetirla en mayúsculas no la duplica', ts.length === 1, ts);
    await p.evaluate(() => tareasGuardarTodas([]));
    await decir(p, 'recordame pagar el gas el 3 de diciembre', 1800);
    ts = await p.evaluate(() => tareasActivas().map(x => x.titulo + ' · ' + x.fecha));
    t('«recordame …» (por el agente) la anota una vez, con fecha', ts.length === 1 && /-12-03$/.test(ts[0]), ts);
    await p.evaluate(() => tareasGuardarTodas([]));
    titAg = 'comprar pan'; cuandoAg = '3 de noviembre'; // el agente (Groq real) saca el título del pedido
    await decir(p, 'agendá: comprar pan el 3 de noviembre', 1500);
    ts = await p.evaluate(() => tareasActivas().map(x => x.titulo + ' · ' + x.fecha));
    t('«agendá: …» con dos puntos anota «comprar pan» con fecha', ts.length === 1 && /^comprar pan · \d{4}-11-03$/i.test(ts[0]), ts);
    // controles
    await p.evaluate(() => tareasGuardarTodas([]));
    await decir(p, 'agendame pagar el gas el 3 de diciembre', 1000); await decir(p, 'agendame pagar el gas el 3 de enero', 1000); await decir(p, 'agendame comprar leche', 1000);
    ts = await p.evaluate(() => tareasActivas().map(x => x.titulo + ' · ' + x.fecha));
    t('control: la misma tarea en dos fechas distintas son DOS; otra tarea es otra', ts.length === 3, ts);
    await p.evaluate(() => tareasGuardarTodas([]));
    await decir(p, 'mañana me voy a merendar y a jugar a la Play', 1500);
    t('control: contar un plan no anota nada', (await p.evaluate(() => tareasActivas().length)) === 0);
    titAg = 'revisar con calma todas las planillas del laboratorio de física de quinto año antes de la reunión de departamento con los colegas'; cuandoAg = '20 de noviembre';
    const largo = 'agendame ' + 'revisar con calma todas las planillas del laboratorio de física de quinto año antes de la reunión de departamento con los colegas el 20 de noviembre';
    await decir(p, largo, 1200);
    ts = await p.evaluate(() => tareasActivas().map(x => x.titulo));
    const _i = ts.length === 1 ? largo.indexOf(ts[0]) : -1, _sig = _i >= 0 ? largo.charAt(_i + ts[0].length) : 'x';
    t('un pedido largo no deja el título cortado en media palabra', ts.length === 1 && ts[0].length <= 80 && _i > 0 && (_sig === ' ' || _sig === ''), ts);
    await h.close(); }

  // ── D · la hora del .md en 24 h ──────────────────────────────────────────────────────────────────────
  console.log('\n━━━ D · .md con la hora en 24 h ━━━');
  { const h = await abrir({ fb:true, cfg:CFG }); const p = h.page;
    t('fechaHora24: 16:48:43 sale «16:48:43», no «04:48:43»', await p.evaluate(() => typeof fechaHora24 === 'function' && fechaHora24(new Date(2026, 9, 23, 16, 48, 43)) === '23/10/2026 16:48:43'));
    await groqFalso(p, (sys) => /Leés documentos/.test(sys) ? '- idea clave' : 'Conclusión principal [P1].');
    await p.evaluate(() => { ragDocs.push({ id:'sess_2', name:'TP_Tello_MIRROR.pdf', type:'session', content: 'Texto corto del trabajo práctico. '.repeat(50) }); });
    await p.fill('#inp', 'analizá el documento completo y decime las conclusiones'); await p.keyboard.press('Enter');
    await p.waitForFunction(() => /Leí «TP_Tello_MIRROR\.pdf»/.test(document.getElementById('chat').innerText), null, { timeout: 20000 }).catch(() => {});
    const md = await p.evaluate(() => invUltimoInforme && invUltimoInforme.md || '');
    t('el .md del análisis lleva la fecha en 24 h (dd/mm/aaaa HH:MM:SS, sin «, » ni am/pm)', /^# Análisis completo[^\n]*\n_\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2} · /.test(md), md.slice(0, 120));
    t('  y la repregunta sobre ese análisis también viaja («RESUMIME LO QUE LEISTE»)', /TU ÚLTIMO (?:INFORME|ANÁLISIS)/.test(await p.evaluate(() => informeVigente('decime las conclusiones'))));
    await h.close(); }

  // ── E · lo que cazó el VERIFICADOR del 29/10 (amarrado) ─────────────────────────────────────────────────
  console.log('\n━━━ E · controles del verificador ━━━');
  { const h = await abrir({ fb:true, cfg:CFG, ls:{ mirror_tareas: JSON.stringify([
      { id:'a', titulo:'Comprar 1/2 kg de pan', fecha:'', ts:1, hecha:false }, { id:'b', titulo:'Preparar la clase del lunes', fecha:'', ts:2, hecha:false },
      { id:'c', titulo:'Comprar 🍎', fecha:'', ts:3, hecha:false }, { id:'d', titulo:'Comprar 🍌', fecha:'', ts:4, hecha:false }, { id:'e', titulo:'Pagar cuota 3/12', fecha:'', ts:5, hecha:false } ]) } }); const p = h.page;
    const ts = await p.evaluate(() => tareasActivas().map(x => x.titulo + '|' + x.fecha).sort());
    t('tareas viejas sin mes escrito NO se tocan (1/2 kg, «del lunes», 🍎/🍌, cuota 3/12)', JSON.stringify(ts) === JSON.stringify(['Comprar 1/2 kg de pan|', 'Comprar 🍌|', 'Comprar 🍎|', 'Pagar cuota 3/12|', 'Preparar la clase del lunes|'].sort()), ts);
    // GRAVE: lo de la charla temporal / la charla borrada no vuelve a viajar
    const r = await p.evaluate(() => {
      const out = {};
      history.push({ role:'user', content:'a' }, { role:'assistant', content:'b' });
      temporalToggle();
      invUltimoInforme = { tipo:'inv', texto:'INFORME-TEMPORAL', hLen: history.length + 2, pregunta:'x', md:'' };
      history.push({ role:'user', content:'🔎 x' }, { role:'assistant', content:'INFORME-TEMPORAL' });
      temporalToggle();
      out.temporal = informeVigente('decime las conclusiones');
      invUltimoInforme = { tipo:'inv', texto:'INFORME-BORRADO', hLen: 12, pregunta:'x', md:'' };
      history = [];
      out.borrado = informeVigente('decime las conclusiones');
      return out; });
    t('GRAVE (verificador): terminada la charla temporal, su informe NO vuelve al modelo', r.temporal === '', r.temporal.slice(0, 80));
    t('GRAVE (verificador): con el historial vacío (charla borrada), tampoco', r.borrado === '', r.borrado.slice(0, 80));
    const frases = await p.evaluate(() => { history.push({ role:'user', content:'🔎 x' }, { role:'assistant', content:'INF' }); invUltimoInforme = { tipo:'inv', texto:'INF', hLen: history.length, pregunta:'x', md:'' };
      return ['¿qué fuentes de proteína vegetal hay?', 'hacé un análisis de este poema: «x»', 'resumime este texto: hola hola', 'contame de la investigación sobre el cáncer', 'pasame un informe del clima']
        .map(q => q + ' → ' + (informeVigente(q) ? 'AGARRA' : 'no')); });
    t('controles: frases con otro objeto NO arrastran el informe viejo', frases.every(f => / no$/.test(f)), frases);
    const si = await p.evaluate(() => { history.push({ role:'user', content:'🔎 y' }, { role:'assistant', content:'INF' }); invUltimoInforme = { tipo:'inv', texto:'INF', hLen: history.length, pregunta:'y', md:'' }; return ['DECIME LAS CONCLUSIONES', 'resumilo', 'y las fuentes?', 'TE ESTOY PIDIENDO LAS CONCLUSIONES DE LA INVESTIGACIÓN A FONDO QUE HICISTE', 'qué decía tu informe?', 'qué decía el informe del clima que hiciste', 'resumime el análisis del documento', 'y la investigación de recién?', 'ampliá el informe en la parte de costos'].map(q => !!informeVigente(q)); }); // verificador 29/10: estas también son repreguntas
    t('  …y las que apuntan al trabajo anterior sí', si.every(Boolean), si);
    const nm = await p.evaluate(() => [nombresDeFabricaEnSalida('COMPOSICIÓN DEL JURADO', ''), nombresDeFabricaEnSalida('la CONEXIÓN', ''), nombresDeFabricaEnSalida('Soy TARS.', '')]);
    t('nombres: «JURADO» y «CONEXIÓN» quedan como están; «TARS» suelto cambia', nm[0] === 'COMPOSICIÓN DEL JURADO' && nm[1] === 'la CONEXIÓN' && nm[2] === 'Soy MODO ANALÍTICO.', nm);
    const nm2 = await p.evaluate(() => { const g = CONFIG.modos; CONFIG.modos = Object.assign({}, g, { jurado:'EXAMINADOR JEFE', conn:'MIS CONEX' }); const r = nombresDeFabricaEnSalida('el EXAMINADOR JEFE, MIS CONEX, EXAMINADOR y CONEX'); CONFIG.modos = g; return r; });
    t('nombres: si el nombre configurado ya contiene la palabra, no se duplica', nm2 === 'el EXAMINADOR JEFE, MIS CONEX, EXAMINADOR JEFE y MIS CONEX', nm2);
    await h.close(); }
  { const h = await abrir({ fb:true, cfg:CFG, reply:'Te lo recuerdo. [ACCION:{"tipo":"cal","titulo":"Lo que te dije","cuando":"ayer"}]' }); const p = h.page;
    await decir(p, 'recordame qué te dije ayer', 1500);
    t('control: «recordame qué te dije ayer» (pregunta a la memoria) NO anota una tarea', (await p.evaluate(() => tareasActivas().length)) === 0);
    await h.close(); }

  console.log('\n' + (mal ? '❌ ' + mal + ' FALLAN (' + ok + ' ok)' : '✅ TODO VERDE — ' + ok + ' pruebas (navegador real · hallazgos en vivo 23/10)'));
  process.exit(mal ? 1 : 0);
})().catch(e => { console.error('❌ ERROR', e); process.exit(1); });
