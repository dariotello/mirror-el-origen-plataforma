// t_1023.js — build 2026-10-23.1: hallazgos confirmados de los auditores del 23/10 + las 3 mejoras del mercado + el escalón 20b.
// Uso: FILE=…/PLATAFORMA/index.html NODE_PATH=$(npm root -g) node t_1023.js   (≈2–3 min: hay un caso que espera el tope de 30 s)
// Cada bloque lleva CONTROLES (lo que NO tiene que agarrar). Sobre la 16.1 tiene que dar ROJO.
const { abrir } = require('./harness.js');
const CFG = { appName:'MANIFIESTOS', perfil:{ nombre:'ATIS' }, modos:{ mirror:'ATIS', tars:'MODO ANALÍTICO', jurado:'EXPERTO/EXAMINADOR', conn:'BASE' }, modeloPrincipal:'openai/gpt-oss-120b', motorPrincipal:'groq' };
let ok = 0, mal = 0;
function t(n, c, d){ if (c){ ok++; console.log('  ✅ ' + n); } else { mal++; console.log('  ❌ ' + n + (d !== undefined ? '  → ' + String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 260) : '')); } }
const ultimo = p => p.evaluate(() => { const m = document.querySelectorAll('#chat .msg'); return m.length ? m[m.length - 1].innerText : ''; });
const todo = p => p.evaluate(() => document.getElementById('chat').innerText);
async function decir(h, q, ms){ const n0 = h.srv._reqs.length; await h.page.fill('#inp', q); await h.page.keyboard.press('Enter'); await h.page.waitForTimeout(ms || 1300); return { llamadas: h.srv._reqs.length - n0, bodies: h.srv._reqs.slice(n0).map(r => r.body).join('\n'), u: (await ultimo(h.page)).replace(/\s+/g, ' ') }; }

// Firebase simulado con datos y registro de escrituras (page.route + recarga: la app lee la base al arrancar)
async function conFirebase(h, datos, opts){
  opts = opts || {};
  const esc = h.escrituras = [];
  await h.page.route('**/fb/**', async route => {
    const rq = route.request(), u = new URL(rq.url()), m = rq.method();
    const ruta = decodeURIComponent(u.pathname.replace(/^\/fb\//, '').replace(/\.json$/, ''));
    if (m !== 'GET'){ esc.push({ m, ruta, body: rq.postData() || '' }); if (opts.falla && opts.falla(m, ruta)) return route.fulfill({ status: 500, body: '{"error":"x"}', headers:{'access-control-allow-origin':'*'} }); return route.fulfill({ status: 200, contentType:'application/json', body: rq.postData() || 'null', headers:{'access-control-allow-origin':'*'} }); }
    const v = Object.prototype.hasOwnProperty.call(datos, ruta) ? datos[ruta] : null;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(v), headers:{'access-control-allow-origin':'*'} });
  });
  await h.page.reload({ waitUntil: 'load' }); await h.page.waitForTimeout(1800);
  // el índice de cada recuerdo (tf/len) se arma con el tokenize REAL de la app, como si lo hubiera guardado ella
  await h.page.evaluate(() => { (recuerdosChunks || []).forEach(r => { const tk = tokenize(r.text); const tf = {}; tk.forEach(x => tf[x] = (tf[x] || 0) + 1); r.tf = tf; r.len = tk.length; }); });
}
const REC = (id, txt) => ({ id, text: txt, tf: {}, len: 5, ts: Date.now() - 86400e3 });

(async () => {
  // ── A · seguridad: ids trampa en memoria y encuestas (auditor 2) ─────────────────
  console.log('\n━━━ A · ids trampa en tu Firebase (memoria y encuestas) ━━━');
  { const h = await abrir({ fb:true, cfg:CFG }); const p = h.page;
    p.on('dialog', d => d.accept());
    const trampa = '"><img src=x onerror="window.__xr=1">';
    await conFirebase(h, {
      'recuerdos': { a: REC(trampa, '[2026-10-01] USUARIO: dato con id trampa'), b: REC('r_1_ok', '[2026-10-01] USUARIO: mi perra se llama Pochola') },
      'encuestas': { [trampa.replace('__xr','__xe')]: { def:{ id:'x', titulo:'Trampa', preguntas:[{t:'a'}] } },
                     "e1');window.__xe2=1;('": { def:{ id:'z', titulo:'Trampa2', preguntas:[{t:'a'}] } },
                     'e_ok1': { def:{ id:'e_ok1', titulo:'Buena', preguntas:[{t:'q1'}], fb:'https://atacante.firebaseio.com' }, respuestas:{ a:null, b:{ r:{ q0:'si' } } } } }
    });
    await p.evaluate(() => abrirMemoria()); await p.waitForTimeout(500);
    t('memoria: un id trampa NO corre código al abrir el panel', await p.evaluate(() => window.__xr === undefined));
    t('  …y el recuerdo se ve igual (con su ✎ y su ✕)', await p.evaluate(() => document.querySelectorAll('#mem-lista .voz-item').length === 2 && document.querySelectorAll('#mem-lista button[data-rid]').length === 4));
    await p.evaluate(() => { const b = Array.from(document.querySelectorAll('#mem-lista button[data-rid]')).find(x => x.textContent === '✕' && x.dataset.rid.indexOf('img') >= 0); b.click(); }); await p.waitForTimeout(600);
    const del = h.escrituras.find(e => e.m === 'DELETE');
    t('  ✕ sobre el id trampa borra ESA clave (va codificada, no se escapa a otra rama de la base)', del && del.ruta === 'recuerdos/' + trampa, del);
    await p.evaluate(() => cerrarMemoria());
    await p.evaluate(() => encAbrir()); await p.waitForTimeout(800);
    t('encuestas: ninguna clave trampa corre código al abrir 📋', await p.evaluate(() => window.__xe === undefined && window.__xe2 === undefined));
    t('  …las trampas se avisan como «nombre raro» y la buena se lista normal', await p.evaluate(() => { const t = document.getElementById('enc-lista').innerText; return /nombre raro/.test(t) && /Buena/.test(t); }));
    await p.evaluate(() => { document.querySelectorAll('#enc-lista button').forEach(b => b.click()); }); await p.waitForTimeout(500); // apretar todo: ninguna trampa se dispara
    t('  …y apretando todos los botones tampoco', await p.evaluate(() => window.__xe2 === undefined));
    const form = await p.evaluate(() => encFormHTML({ id:'e_ok1', titulo:'Buena', preguntas:[{t:'q1'}], fb:'https://atacante.firebaseio.com' }));
    t('  el formulario manda las respuestas a TU base actual, no a la que diga la definición', form.indexOf('atacante') < 0 && /\/fb\/encuestas\/e_ok1\/respuestas\.json/.test(form));
    t('  un id inválido no arma formulario', await p.evaluate(() => { try { encFormHTML({ id:'x"+(1)+"', titulo:'t', preguntas:[{t:'a'}] }); return false; } catch(e){ return true; } }));
    await p.evaluate(() => encVer('e_ok1')); await p.waitForTimeout(700);
    t('  «ver» con una respuesta vacía (null) en la base no se traba', await p.evaluate(() => /2 respuesta/.test(document.getElementById('enc-lista').innerText)));
    t('sin errores JS', !(p._pe || []).length, p._pe);
    await h.close();
  }

  // ── B · memoria a la vista: qué recuerdos usé, olvidar, corregir (radar de mercado) ─
  console.log('\n━━━ B · ◈ memoria · N (qué recuerdos usé) · olvidar · ✎ corregir ━━━');
  { const h = await abrir({ fb:true, cfg:CFG, reply:'Se llama Pochola.' }); const p = h.page;
    p.on('dialog', d => d.accept());
    await conFirebase(h, { 'recuerdos': { a: REC('r_1_pocho', '[2026-10-01] USUARIO: mi perra se llama Pochola y tiene 3 años || ASISTENTE: qué lindo nombre') } }, { falla: (m, r) => m === 'PATCH' && /recuerdos\/r_1_pocho/.test(r) && global.__fallaEdit });
    await decir(h, 'como se llama mi perra?', 1500);
    const chip = await p.evaluate(() => { const b = document.querySelector('#chat .msg:last-child .proc-chip-btn'); return b ? b.textContent : ''; });
    t('el chip dice «◈ memoria · 1» y es un botón', /◈ memoria · 1/.test(chip), chip);
    await p.evaluate(() => document.querySelector('#chat .msg:last-child .proc-chip-btn').click()); await p.waitForTimeout(300);
    t('  al tocarlo muestra EL recuerdo que viajó', await p.evaluate(() => /Pochola/.test((document.querySelector('#chat .msg:last-child .proc-rec') || {}).innerText || '')));
    { const r = await decir(h, 'contame algo de astronomía', 1300); const c2 = await p.evaluate(() => !!document.querySelector('#chat .msg:last-child .proc-chip-btn')); t('control: una respuesta sin recuerdos no tiene el botón', !c2); }
    // corregir con ✎ (primero falla Firebase: no tiene que decir guardado)
    await p.evaluate(() => abrirMemoria()); await p.waitForTimeout(300);
    global.__fallaEdit = true;
    await p.evaluate(() => editarRecuerdo('r_1_pocho')); await p.fill('#mem-edit-ta', '[2026-10-01] USUARIO: mi perra se llama Pocholita'); await p.click('#mem-edit-ok'); await p.waitForTimeout(500);
    t('✎ con Firebase caído: dice que NO se guardó y el recuerdo sigue igual', await p.evaluate(() => /No se guardó/.test(document.getElementById('mem-edit-nota').textContent) && /Pochola y tiene/.test(recuerdosChunks[0].text)));
    global.__fallaEdit = false;
    await p.click('#mem-edit-ok'); await p.waitForTimeout(500);
    const pat = h.escrituras.filter(e => e.m === 'PATCH' && e.ruta === 'recuerdos/r_1_pocho').pop();
    t('✎ guardar: PATCH a recuerdos/<id> con el texto nuevo y su índice', pat && /Pocholita/.test(pat.body) && /"tf"/.test(pat.body), pat);
    t('  …la lista lo muestra «(editado)» y la búsqueda lo encuentra por la palabra nueva', await p.evaluate(() => /Pocholita/.test(document.getElementById('mem-lista').innerText) && /editado/.test(document.getElementById('mem-lista').innerText) && bm25Search('pocholita', recuerdosChunks, 3).length === 1));
    await p.evaluate(() => cerrarMemoria());
    // olvidar desde el chip
    await decir(h, 'como se llama mi perra?', 1500);
    await p.evaluate(() => document.querySelector('#chat .msg:last-child .proc-chip-btn').click()); await p.waitForTimeout(300);
    await p.evaluate(() => document.querySelector('#chat .msg:last-child .proc-rec-x[data-rid="r_1_pocho"]').click()); await p.waitForTimeout(600);
    t('«✕ olvidar» desde el chip: DELETE a esa clave, desaparece de la memoria y dice «olvidado ✓»', h.escrituras.some(e => e.m === 'DELETE' && e.ruta === 'recuerdos/r_1_pocho') && await p.evaluate(() => !recuerdosChunks.some(r => r.id === 'r_1_pocho') && /olvidado ✓/.test(document.querySelector('#chat .msg:last-child').innerText)));
    t('sin errores JS', !(p._pe || []).length, p._pe);
    await h.close();
  }

  // ── C · charla temporal ─────────────────────────────────────────────────────────
  console.log('\n━━━ C · 🕶 charla temporal: no guarda ni usa recuerdos ━━━');
  { const h = await abrir({ fb:true, cfg:CFG, reply:'Dale.' }); const p = h.page;
    await conFirebase(h, { 'recuerdos': { a: REC('r_1_pocho', '[2026-10-01] USUARIO: mi perra se llama Pochola') } });
    await decir(h, 'hoy fui al cine con mi hermana Laura', 1300);
    await p.waitForFunction(() => !busy, null, { timeout: 15000 }); await p.waitForTimeout(400); // verificador: esperar el fin del turno, no un tiempo fijo
    t('control: sin charla temporal, el turno SÍ se guarda (memoria y recuerdos)', h.escrituras.some(e => /^memory$/.test(e.ruta)) && h.escrituras.some(e => /^recuerdos$/.test(e.ruta)));
    const n0 = h.escrituras.length;
    await p.evaluate(() => temporalToggle()); await p.waitForTimeout(300);
    t('al prenderla: banda visible y aviso honesto (el motor igual recibe lo que escribís)', await p.evaluate(() => { const b = document.getElementById('temporal-banda'); return b && !b.hidden && b.offsetHeight > 0; }) && /el motor de IA igual recibe/.test(await ultimo(p)));
    const r = await decir(h, 'como se llama mi perra? y mi gato se llama Michi', 1500);
    t('  no viaja ningún recuerdo al modelo', r.llamadas > 0 && !/Pochola/.test(r.bodies), r.bodies.slice(0, 200));
    t('  nada se escribe en tu Firebase', h.escrituras.length === n0, h.escrituras.slice(n0));
    await p.evaluate(() => temporalToggle()); await p.waitForTimeout(300);
    t('al terminarla: lo temporal sale del historial y lo dice', await p.evaluate(() => !history.some(m => /Michi/.test(m.content))) && /no se guardó/.test(await ultimo(p)));
    await decir(h, 'mañana tengo parcial de física', 1300);
    const mem = h.escrituras.slice(n0).filter(e => e.ruta === 'memory').map(e => e.body).join('');
    t('  después vuelve a guardar, sin lo de la charla temporal', mem && /parcial de f/.test(mem) && !/Michi/.test(mem), mem.slice(0, 200));
    t('sin errores JS', !(p._pe || []).length, p._pe);
    await h.close();
  }

  // ── D · motor: tope de tiempo, 429 sin apagar streaming, escalón 20b, aviso con la causa ─
  console.log('\n━━━ D · motor colgado / saturado / clave rota (auditor 4 + escalón 20b) ━━━');
  { const h = await abrir({ fb:false, cfg:CFG, reply:'RESP' }); const p = h.page;
    const log = [];
    let modoGroq = 'cuelga';
    await p.route('**/proxy/groq', async route => {
      const b = JSON.parse(route.request().postData() || '{}'); log.push({ t: Date.now(), modelo: b.model, stream: !!b.stream });
      if (modoGroq === 'cuelga') return; // nunca contesta
      if (modoGroq === '429' && b.model === 'openai/gpt-oss-120b') return route.fulfill({ status: 429, contentType:'application/json', body: JSON.stringify({ error:{ message:'Rate limit reached for model openai/gpt-oss-120b on tokens per day', type:'tokens' } }), headers:{'access-control-allow-origin':'*'} });
      if (modoGroq === '401') return route.fulfill({ status: 401, contentType:'application/json', body: JSON.stringify({ error:{ message:'Invalid API Key' } }), headers:{'access-control-allow-origin':'*'} });
      if (b.stream) return route.fulfill({ status: 200, headers:{ 'content-type':'text/event-stream', 'access-control-allow-origin':'*' }, body: 'data: ' + JSON.stringify({ choices:[{ delta:{ content:'DESDE_' + b.model } }] }) + '\n\ndata: [DONE]\n\n' });
      return route.fulfill({ status: 200, contentType:'application/json', body: JSON.stringify({ choices:[{ message:{ role:'assistant', content:'DESDE_' + b.model } }] }), headers:{'access-control-allow-origin':'*'} });
    });
    await p.route('**/proxy/cloudflare', route => route.fulfill({ status: 200, contentType:'application/json', body: JSON.stringify({ choices:[{ message:{ role:'assistant', content:'DESDE_CLOUDFLARE' } }] }), headers:{'access-control-allow-origin':'*'} }));
    const t0 = Date.now();
    await p.fill('#inp', 'explicame la ley de Ohm'); await p.keyboard.press('Enter');
    await p.waitForFunction(() => /DESDE_CLOUDFLARE/.test(document.getElementById('chat').innerText), null, { timeout: 75000 }).catch(() => {});
    const seg = (Date.now() - t0) / 1000;
    const tx = await todo(p);
    t('Groq colgado: a los ~30 s corta y contesta el respaldo (antes: 2 min de puntitos y nunca probaba el respaldo)', /DESDE_CLOUDFLARE/.test(tx) && seg < 50, { seg });
    t('  …el aviso dice la causa real («tardó demasiado») y no «Todo en orden»', /tardó demasiado en contestar/.test(tx) && !/Todo en orden/.test(tx));
    t('  …con un cuelgue NO se suma el escalón 20b (sería otra espera)', !log.some(x => x.modelo === 'openai/gpt-oss-20b'), log);
    // 429: no apaga el streaming y no repite al instante; el 20b contesta antes que Cloudflare
    modoGroq = '429'; log.length = 0;
    await p.evaluate(() => { motorActivo = 'groq'; });
    const r1 = await decir(h, 'armame un plan de estudio de electromagnetismo', 9000);
    const pri = log.filter(x => x.modelo === 'openai/gpt-oss-120b');
    t('429: contesta el gpt-oss-20b del mismo Groq (escalón) antes que el Llama de Cloudflare', /DESDE_openai\/gpt-oss-20b/.test(await todo(p)) && !/DESDE_CLOUDFLARE[\s\S]*plan de estudio/.test(r1.u), log);
    t('  …el chip dice «↺ respaldo (Groq · gpt-oss-20b)»', /↺ respaldo \(Groq · gpt-oss-20b\)/.test(r1.u), r1.u.slice(-120));
    t('  …el 429 por streaming NO dispara un segundo pedido al 120b en el acto', pri.length < 2 || (pri[1].t - pri[0].t) > 500, pri.map(x => x.t - pri[0].t));
    t('  …y el streaming sigue prendido para la sesión (un 429 no es «proxy sin SSE»)', await p.evaluate(() => STREAM_OK === true));
    // clave rota: ni escalón (misma clave) ni «Todo en orden»
    modoGroq = '401'; log.length = 0;
    await p.evaluate(() => { motorActivo = 'groq'; });
    await decir(h, 'resumime la teoría de la relatividad', 4000);
    const tx2 = await todo(p);
    t('clave rota (401): avisa que NO se arregla solo y contesta Cloudflare; sin probar el 20b', /rechazó la clave/.test(tx2) && /NO se arregla solo/.test(tx2) && !log.some(x => x.modelo === 'openai/gpt-oss-20b'), log);
    // respuesta tardía de un turno ya liberado: se descarta
    modoGroq = 'ok';
    await p.unroute('**/proxy/groq');
    await p.route('**/proxy/groq', async route => { await new Promise(r => setTimeout(r, 2500)); route.fulfill({ status: 200, contentType:'application/json', body: JSON.stringify({ choices:[{ message:{ role:'assistant', content:'RESPUESTA_TARDIA' } }] }), headers:{'access-control-allow-origin':'*'} }); });
    await p.fill('#inp', 'pregunta que se va a colgar'); await p.keyboard.press('Enter'); await p.waitForTimeout(700);
    await p.evaluate(() => { turnoVivo++; setButtonsBusy(false); removeTyping(); }); // lo que hace el reloj de 2 min
    await p.waitForTimeout(3500);
    t('respuesta tardía de un turno ya liberado: no aparece ni entra al historial', !/RESPUESTA_TARDIA/.test(await todo(p)) && await p.evaluate(() => !history.some(m => /RESPUESTA_TARDIA/.test(m.content))));
    t('sin errores JS', !(p._pe || []).length, p._pe);
    await h.close();
  }

  // ── E · frases reales (auditor 1): saludo o nombre adelante, varias preguntas juntas, falsos positivos ─
  console.log('\n━━━ E · frases: «MANIFIESTOS, QUE HORA ES?», dos preguntas juntas, controles ━━━');
  { const h = await abrir({ fb:true, cfg:CFG, reply:'RESPUESTA_DEL_MODELO' }); const p = h.page;
    for (const q of ['MANIFIESTOS, QUE HORA ES?','ATIS QUE HORA ES','HOLA QUE HORA ES?','QUE HORAS SON?','me podes decir la hora?','QUE HORA ES MANIFIESTOS?','que hora es atis','QUE HORA ES, MANIFIESTOS']){ // en vivo 23/10 18:03: «QUE HORA ES MANIFIESTOS?» → «Son las 14:37» (inventada)
      const r = await decir(h, q); t('hora fija: «' + q + '»', r.llamadas === 0 && /🕐 Son las/.test(r.u), r.u.slice(0, 100));
    }
    for (const q of ['MANIFIESTOS, SOS CHATGPT?','Q IA SOS','QUE LLM USAS?']){
      const r = await decir(h, q); t('modelo fijo: «' + q + '»', r.llamadas === 0 && /gpt-oss-120b/.test(r.u), r.u.slice(0, 100));
    }
    { const r = await decir(h, 'QUE HORA ES Y QUE VERSION SOS'); t('«QUE HORA ES Y QUE VERSION SOS» → las dos, fijas', r.llamadas === 0 && /🕐 Son las/.test(r.u) && /Mi versión/.test(r.u), r.u.slice(0, 160)); }
    { const r = await decir(h, 'QUE VERSION SOS Y CONTAME UN CHISTE', 1600); t('«QUE VERSION SOS Y CONTAME UN CHISTE» → versión fija + el chiste va al modelo', /Mi versión/.test(r.u) && r.llamadas > 0 && /CONTAME UN CHISTE/.test(r.bodies), r.u.slice(0, 120)); }
    { const r = await decir(h, 'QUIEN SOS Y QUE IA USAS'); t('«QUIEN SOS Y QUE IA USAS» → quién soy + el modelo, sin gastar una llamada', r.llamadas === 0 && /gpt-oss-120b/.test(r.u) && /Quién soy/.test(r.u), r.u.slice(0, 160)); }
    for (const q of ['LA NUEVA PROFE ES MEJOR QUE LA ANTERIOR?','Y ESA PELICULA QUE TIENE DE BUENO?','la v1.2 de mi tesis ya esta lista','QUE VERSION 3.12 DE PYTHON ME CONVIENE?','A VECES NO SE QUIEN SOY','HOLA MANIFIESTOS, COMO ESTAS?','compré pan y queso para la cena']){
      const r = await decir(h, q, 1500); t('control → charla normal (va al modelo, sin tarjeta fija): «' + q + '»', r.llamadas > 0 && /RESPUESTA_DEL_MODELO/.test(r.u) && !/Mi versión|Otras versiones|Quién soy|🕐/.test(r.u), r.u.slice(0, 140));
    }
    { const r = await decir(h, 'DONDE QUEDA GUARDADO LO QUE TE DIGO?'); t('«DONDE QUEDA GUARDADO LO QUE TE DIGO?» → dónde está lo tuyo, no una ruta de Maps', !/Ruta lista/.test(r.u), r.u.slice(0, 120)); }
    { await p.evaluate(() => setMode('mirror')); const r = await decir(h, 'LLEVA AL JURADO LA CARPETA EL LUNES', 1500); t('«LLEVA AL JURADO LA CARPETA EL LUNES» NO cambia de modo', await p.evaluate(() => mode) === 'mirror', r.u.slice(0, 100)); }
    { await p.evaluate(() => setMode('mirror')); const r = await decir(h, 'pasá al modo jurado', 800); t('control: «pasá al modo jurado» SÍ cambia', await p.evaluate(() => mode) === 'jurado', r.u.slice(0, 100)); }
    { await p.evaluate(() => setMode('mirror')); const r = await decir(h, 'PONE EL MODO EXPERTO', 1500); t('«PONE EL MODO EXPERTO» no arma una tarjeta de música', !/es música/.test(r.u), r.u.slice(0, 100)); }
    { await p.evaluate(() => setMode('mirror')); const r = await decir(h, 'PASA AL MODO ANALITICO Y EXPLICAME LA ENTROPIA', 900);
      t('«PASA AL MODO ANALITICO Y EXPLICAME LA ENTROPIA» → cambia y deja el pedido escrito para mandarlo', await p.evaluate(() => mode) === 'tars' && await p.inputValue('#inp') === 'EXPLICAME LA ENTROPIA' && /te lo dejé escrito/.test(r.u), { v: await p.inputValue('#inp'), u: r.u.slice(0, 160) });
      await p.fill('#inp', ''); }
    { await p.evaluate(() => setMode('tars')); const r = await decir(h, 'pasá al modo MANIFIESTOS', 800); t('«pasá al modo MANIFIESTOS» → vuelve al espejo, sin «No conozco»', !/No conozco/.test(r.u), r.u.slice(0, 120)); await p.evaluate(() => setMode('mirror')); }
    { await decir(h, 'mañana rindo fisica 2 y estoy nervioso', 1500);
      const r = await decir(h, 'redactá la contestación a la vecina que se queja del ruido, educada pero firme', 1600);
      t('redacción: viaja también la última respuesta (antes se perdía)', /RESPUESTA_DEL_MODELO/.test(r.bodies.split('redactá')[0] || '') || (r.bodies.match(/RESPUESTA_DEL_MODELO/g) || []).length >= 1, r.bodies.slice(0, 200)); }
    t('sin errores JS', !(p._pe || []).length, p._pe);
    await h.close();
  }

  // ── F · agenda, vista previa, marca, accesibilidad ─────────────────────────────
  console.log('\n━━━ F · agenda sin datos en la charla · vista previa con salida · marca · foco ━━━');
  { const h = await abrir({ fb:true, cfg:CFG, reply:'RESP', ls:{ mirror_agenda: JSON.stringify({ ana:{ nombre:'Ana', tel:'+54 9 298 455-1234', email:'ana@correo.com' } }) } }); const p = h.page;
    const r = await decir(h, 'buscá el contacto de Ana', 900);
    t('agenda: en pantalla se ve el número', /455-1234/.test(r.u), r.u.slice(0, 120));
    t('  …pero en la charla guardada NO quedan ni el número ni el mail', await p.evaluate(() => !history.some(m => /455-?1234|ana@correo/.test(m.content))));
    const r2 = await decir(h, 'gracias, después la llamo', 1500);
    t('  …ni viajan al modelo en el turno siguiente', r2.llamadas > 0 && !/455|ana@correo/.test(r2.bodies));
    t('  …y ya no promete «No sale de tu dispositivo»', !/No sale de tu dispositivo/.test(r.u));
    await p.evaluate(() => { window.__marca = 1; abrirCompartir(); previsualizarCompartir(); }); await p.waitForTimeout(300);
    t('vista previa del link: hay «◂ volver» (no el botón que recarga)', await p.evaluate(() => getComputedStyle(document.getElementById('sv-volver')).display !== 'none' && getComputedStyle(document.getElementById('sv-cta')).display === 'none'));
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    t('  Esc vuelve sin recargar la página', await p.evaluate(() => getComputedStyle(document.getElementById('share-view')).display === 'none' && window.__marca === 1));
    await p.evaluate(() => cerrarCompartir());
    t('marca: con appName MANIFIESTOS, los textos de la app y la pestaña no dicen MIRROR', await p.evaluate(() => /MANIFIESTOS/.test(document.getElementById('mem-intro').textContent) && !/MIRROR/.test(document.getElementById('mem-intro').textContent) && /^MANIFIESTOS/.test(document.title)));
    t('  control: el crédito del pie («idea de Darío A. Tello») queda como está', await p.evaluate(() => /MIRROR/.test(document.querySelector('.fcredit').textContent)));
    t('  la plantilla de Gmail no muestra el subdominio del autor', await p.evaluate(() => !/fisica-dat/.test(document.getElementById('gmail-code').textContent)));
    await p.evaluate(() => document.getElementById('anabtn').focus());
    await p.evaluate(() => abrirAgenda()); await p.waitForTimeout(400);
    const dentro = await p.evaluate(() => { const m = document.getElementById('agenda-modal'); return m && m.getAttribute('role') === 'dialog' && m.contains(document.activeElement); });
    t('contactos: se anuncia como ventana y el foco entra', dentro);
    let escapo = 0; for (let i = 0; i < 10; i++){ await p.keyboard.press('Tab'); if (await p.evaluate(() => !document.getElementById('agenda-modal').contains(document.activeElement))) escapo++; }
    t('  Tab queda adentro (10 veces)', escapo === 0, { escapo });
    await p.focus('#ag-mail'); await p.keyboard.press('Escape'); await p.waitForTimeout(400);
    t('  Esc CIERRA contactos y NO borra el primer contacto (antes apretaba su «✕»: se perdía «Ana»)', await p.evaluate(() => getComputedStyle(document.getElementById('agenda-modal')).display === 'none' && !!JSON.parse(localStorage.getItem('mirror_agenda') || '{}').ana));
    t('  al cerrar, el foco vuelve a donde estaba', await p.evaluate(() => document.activeElement && document.activeElement.id === 'anabtn'), await p.evaluate(() => document.activeElement && (document.activeElement.id || document.activeElement.tagName)));
    t('la bandeja «+»: «documento» se alcanza con teclado', await p.evaluate(() => document.querySelector('label[for="finput"]').tabIndex === 0));
    t('«Nueva versión lista» escondido no se enfoca ni se lee', await p.evaluate(() => getComputedStyle(document.getElementById('pwa-update')).visibility === 'hidden'));
    t('sin errores JS', !(p._pe || []).length, p._pe);
    await h.close();
  }
  { const h = await abrir({ fb:false, cfg:CFG, path:'/' }); const p = h.page; await p.waitForTimeout(1500);
    const ins = await p.evaluate(() => ({ cons: !!document.getElementById('cons-ov') && getComputedStyle(document.getElementById('cons-ov')).display !== 'none', inert: document.getElementById('app').inert }));
    t('con el constructor abierto, la app de atrás no se alcanza con Tab (inert)', !ins.cons || ins.inert === true, ins);
    await h.close();
  }


  // ── G · 🔎 investigación a fondo · H · 📄 documento completo ─────────────────────
  console.log('\n━━━ G · 🔎 investigación a fondo (plan → búsquedas → informe con citas controladas) ━━━');
  { const h = await abrir({ fb:false, cfg:CFG, reply:'RESPUESTA_DEL_MODELO' }); const p = h.page;
    const tav = [], llam = []; let tavModo = 'ok';
    await p.route('**/proxy/tavily', async route => {
      const b = JSON.parse(route.request().postData() || '{}'); tav.push(b.query);
      if (tavModo === '401') return route.fulfill({ status: 401, contentType:'application/json', body: '{"detail":{"error":"Unauthorized: missing or invalid API key."}}', headers:{'access-control-allow-origin':'*'} });
      const n = tav.length;
      return route.fulfill({ status: 200, contentType:'application/json', headers:{'access-control-allow-origin':'*'}, body: JSON.stringify({ results: [
        { title:'Fuente A' + n, url:'https://ejemplo.org/a' + n, content:'Dato verificable número ' + n + ' sobre energía solar.' },
        { title:'Fuente común', url:'https://ejemplo.org/comun', content:'Esta fuente aparece en todas las búsquedas.' } ] }) });
    });
    await p.route('**/proxy/groq', async route => {
      const b = JSON.parse(route.request().postData() || '{}'); const sys = (b.messages && b.messages[0] && b.messages[0].content) || '';
      if (!b.stream) llam.push(/planificador/.test(sys) ? 'plan' : (/modo investigaci/.test(sys) ? 'informe' : (/Leés documentos/.test(sys) ? 'parte' : (/análisis de documentos/.test(sys) ? 'reduce' : 'otro'))));
      let c = 'RESPUESTA_DEL_MODELO';
      if (/planificador/.test(sys)) c = '{"busquedas":["energia solar costos argentina 2026","rendimiento paneles patagonia","subsidios energia renovable rio negro"]}';
      else if (/modo investigaci/.test(sys)) c = '**En corto** Conviene con matices [1][3].\n\n**Lo que encontré** El costo bajó [2] y hay un dato que no existe [9].\n\n**Fuentes**\n[1] Inventada — https://inventada.com/x';
      else if (/Leés documentos/.test(sys)) { const m = /PARTE (\d+) de (\d+)/.exec(b.messages[1].content); c = '- idea clave de la parte ' + (m ? m[1] : '?'); }
      else if (/análisis de documentos/.test(sys)) c = 'Conclusión principal [P1], desarrollo [P2] y algo inventado [P40].';
      if (b.stream) return route.fulfill({ status: 200, contentType:'application/json', body: JSON.stringify({ choices:[{ message:{ role:'assistant', content:c } }] }), headers:{'access-control-allow-origin':'*'} });
      return route.fulfill({ status: 200, contentType:'application/json', body: JSON.stringify({ choices:[{ message:{ role:'assistant', content:c } }] }), headers:{'access-control-allow-origin':'*'} });
    });
    await p.fill('#inp', 'investigá a fondo si conviene poner paneles solares en Villa Regina'); await p.keyboard.press('Enter');
    await p.waitForFunction(() => /Fuentes\*?\*? \(las armó la app/.test(document.getElementById('chat').innerText) || /No pude investigar/.test(document.getElementById('chat').innerText), null, { timeout: 30000 }).catch(() => {});
    const tx = await ultimo(p);
    t('investigar: arma el plan y busca la pregunta + las búsquedas del plan (una por una)', llam[0] === 'plan' && tav.length === 4 && /conviene poner paneles solares en Villa Regina$/.test(tav[0]), { llam, tav });
    t('  el informe sale con la lista de fuentes que armó la APP (direcciones reales)', /https:\/\/ejemplo\.org\/a1/.test(tx) && /https:\/\/ejemplo\.org\/comun/.test(tx), tx.slice(-400));
    t('  la fuente repetida en varias búsquedas aparece UNA vez', (tx.match(/ejemplo\.org\/comun/g) || []).length === 1);
    t('  la URL que inventó el modelo NO aparece y la cita [9] (no existe) se borró y se avisa', !/inventada\.com/.test(tx) && !/\[9\]/.test(tx) && /saqué 1 cita/.test(tx));
    t('  dice cuáles fuentes citó y cuáles solo consultó', /3 de 5 citadas/.test(tx) && /consultada, no citada/.test(tx), tx.slice(-300));
    t('  chip «🔎 investigación · 5 fuentes» y botón para bajar el informe', /🔎 investigación · 5 fuentes/.test(tx) && /bajar el informe/.test(tx));
    t('  queda en el historial (para seguir preguntando sobre el informe)', await p.evaluate(() => history.some(m => m.role === 'assistant' && /ejemplo\.org/.test(m.content))));
    // sin web: no hay «informe» sin fuentes
    tavModo = '401'; llam.length = 0; tav.length = 0;
    await p.fill('#inp', 'investigá a fondo el impacto del litio en Argentina'); await p.keyboard.press('Enter');
    await p.waitForFunction(() => /No pude investigar/.test(document.getElementById('chat').innerText), null, { timeout: 20000 }).catch(() => {});
    const tx2 = await ultimo(p);
    t('sin web (Tavily 401): NO arma un informe sin fuentes y dice por qué', /No pude investigar/.test(tx2) && /Tavily rechazó la clave/.test(tx2) && llam.indexOf('informe') < 0 && tav.length === 1, { tx2: tx2.slice(0, 200), tav, llam });
    // controles
    tavModo = 'ok'; tav.length = 0;
    for (const q of ['la investigación de mi tesis va lenta, qué hago?','investigá']){ const r = await decir(h, q, 1500); t('control: «' + q + '» no dispara la investigación', tav.length === 0 && !/🔎 investigación/.test(r.u), r.u.slice(0, 100)); }

    console.log('\n━━━ H · 📄 documento completo (mapa por partes → respuesta con [Pn]) ━━━');
    llam.length = 0;
    { const r = await decir(h, 'analizá el documento completo y decime las conclusiones', 1500); t('sin documentos cargados: no arranca la lectura por partes (va a la charla normal, como en la 16.1)', llam.indexOf('parte') < 0 && !/documento completo ·/.test(r.u), r.u.slice(0, 120)); }
    await p.evaluate(() => { const w = []; for (let i = 0; i < 5000; i++) w.push('palabra' + (i % 97)); ragDocs.push({ id:'sess_1', name:'informe_energia.txt', type:'session', content: w.join(' ') }); });
    await p.fill('#inp', 'analizá el documento completo y decime las conclusiones'); await p.keyboard.press('Enter');
    await p.waitForFunction(() => /Leí «informe_energia\.txt»/.test(document.getElementById('chat').innerText), null, { timeout: 30000 }).catch(() => {});
    const d1 = await ultimo(p); const partes = llam.filter(x => x === 'parte').length;
    t('5.000 palabras → lo recorre ENTERO en ' + partes + ' partes y después arma la respuesta', partes >= 3 && partes <= 4 && llam[llam.length - 1] === 'reduce' && /Leí «informe_energia\.txt» ENTERO/.test(d1), { llam, d1: d1.slice(-250) });
    t('  cita las partes [P1] [P2] y borra la parte que no existe [P40]', /\[P1\]/.test(d1) && /\[P2\]/.test(d1) && !/\[P40\]/.test(d1));
    t('  chip «📄 documento completo · N/N partes» y botón para bajar el análisis', /📄 documento completo · (\d+)\/\1 partes/.test(d1) && /bajar el análisis/.test(d1), d1.slice(-200));
    llam.length = 0;
    await p.evaluate(() => { const w = []; for (let i = 0; i < 30000; i++) w.push('termino' + (i % 113)); ragDocs.push({ id:'sess_2', name:'tesis_larga.txt', type:'session', content: w.join(' ') }); });
    await p.fill('#inp', 'leé toda la tesis completa y resumila'); await p.keyboard.press('Enter');
    await p.waitForFunction(() => /Leí «tesis_larga\.txt»/.test(document.getElementById('chat').innerText), null, { timeout: 45000 }).catch(() => {});
    const d2 = await ultimo(p);
    t('documento de 30.000 palabras: lee 12 partes y dice DE FRENTE qué porcentaje quedó afuera', llam.filter(x => x === 'parte').length === 12 && /primeras 12 de \d+ partes \(≈\d+\s?%/.test(d2), { n: llam.filter(x => x === 'parte').length, d2: d2.slice(-260) });
    llam.length = 0;
    { const r = await decir(h, 'qué dice el documento sobre la eficiencia?', 1500); t('control: una pregunta común sobre el documento NO dispara la lectura completa', llam.indexOf('parte') < 0 && !/documento completo ·/.test(r.u), { llam }); }
    t('sin errores JS', !(p._pe || []).length, p._pe);
    await h.close();
  }

  // ── I · hallazgos del VERIFICADOR (23/10) ──────────────────────────────────────
  console.log('\n━━━ I · lo que encontró el verificador ━━━');
  { const h = await abrir({ fb:true, cfg:CFG, reply:'RESPUESTA_DEL_MODELO' }); const p = h.page;
    await conFirebase(h, { 'recuerdos': {} });
    // 1) charla temporal: «terminar» con una respuesta en vuelo no puede dejar que se guarde
    await p.evaluate(() => temporalToggle()); await p.waitForTimeout(200);
    await p.route('**/proxy/groq', async route => { await new Promise(r => setTimeout(r, 2500)); route.fulfill({ status: 200, contentType:'application/json', body: JSON.stringify({ choices:[{ message:{ role:'assistant', content:'OK_LENTO' } }] }), headers:{'access-control-allow-origin':'*'} }); });
    const n0 = h.escrituras.length;
    await p.fill('#inp', 'secreto: mi clave del banco es pepito123 y nadie lo sabe'); await p.keyboard.press('Enter'); await p.waitForTimeout(500);
    await p.evaluate(() => temporalToggle()); // intento de terminarla con la respuesta en vuelo
    await p.waitForFunction(() => !busy, null, { timeout: 20000 }); await p.waitForTimeout(800);
    t('charla temporal: «terminar» a mitad de un turno no se acepta y nada de ese turno va a tu Firebase', await p.evaluate(() => charlaTemporal === true) && !h.escrituras.slice(n0).some(e => /pepito123|OK_LENTO/.test(e.body)) && /Esperá a que termine/.test(await todo(p)), h.escrituras.slice(n0));
    await p.evaluate(() => temporalToggle()); await p.waitForTimeout(300);
    t('  al terminarla después: dice cuántos mensajes (tuyos y míos) y no se guardó nada', /2 mensajes, tuyos y míos/.test(await ultimo(p)) && !h.escrituras.slice(n0).some(e => /pepito123/.test(e.body)), await ultimo(p));
    await p.unroute('**/proxy/groq');
    // 2) documento completo: sin documentos o con el texto pegado → charla normal
    for (const q of ['leé el libro entero de Sabato y decime qué opinás', 'resumí el texto completo: hoy en la reunión se decidió cambiar el horario de la feria y sumar dos puestos nuevos']){
      const r = await decir(h, q, 1600); t('sin documentos cargados, «' + q.slice(0, 40) + '…» va al modelo (como en la 16.1)', r.llamadas > 0 && !/No tenés documentos cargados/.test(r.u), r.u.slice(0, 120));
    }
    await p.evaluate(() => { ragDocs.push({ id:'sess_9', name:'tesis_vieja.pdf', type:'session', content:'texto del documento '.repeat(200) }); });
    { const r = await decir(h, 'resumí el texto completo: ' + 'la reunión decidió muchas cosas sobre la feria y los puestos y los horarios '.repeat(4), 1600); t('con un documento cargado y el texto pegado, se resume el texto pegado (no el documento)', r.llamadas > 0 && !/Leí «tesis_vieja\.pdf»/.test(r.u), r.u.slice(0, 120)); }
    // 3) la hora no se cuela en traducciones ni citas
    for (const q of ['traducime al inglés, qué hora es', 'Mi hijo siempre me pregunta, qué hora es', 'decime cómo se dice en francés y qué hora es']){
      const r = await decir(h, q, 1500); t('«' + q + '» → va al modelo (no la hora fija)', r.llamadas > 0 && !/🕐 Son las/.test(r.u), r.u.slice(0, 100));
    }
    { const r = await decir(h, 'MANIFIESTOS, QUE HORA ES?'); t('control: «MANIFIESTOS, QUE HORA ES?» sigue dando la hora fija', r.llamadas === 0 && /🕐 Son las/.test(r.u)); }
    // 6) regla vieja de modo con pedido atrás
    { await p.evaluate(() => setMode('mirror')); const r = await decir(h, 'pasá al modo tars y explicame la entropía', 900);
      t('«pasá al modo tars y explicame la entropía» → cambia y deja el pedido escrito', await p.evaluate(() => mode) === 'tars' && await p.inputValue('#inp') === 'explicame la entropía', { v: await p.inputValue('#inp') }); await p.fill('#inp', ''); await p.evaluate(() => setMode('mirror')); }
    // 5) la marca se puede cambiar sin recargar
    await p.evaluate(() => { CONFIG.appName = 'LUMEN'; aplicarNombresUI(); });
    t('cambiar la marca sin recargar: «MANIFIESTOS» pasa a «LUMEN» en los textos', await p.evaluate(() => /LUMEN/.test(document.getElementById('mem-intro').textContent) && !/MANIFIESTOS/.test(document.getElementById('mem-intro').textContent)));
    // 4) un 400 al pedir streaming → camino clásico, contesta el principal
    await p.route('**/proxy/groq', route => { const b = JSON.parse(route.request().postData() || '{}'); if (b.stream) return route.fulfill({ status: 400, contentType:'application/json', body: '{"error":{"message":"stream not supported"}}', headers:{'access-control-allow-origin':'*'} }); return route.fulfill({ status: 200, contentType:'application/json', body: JSON.stringify({ choices:[{ message:{ role:'assistant', content:'DESDE_PRINCIPAL' } }] }), headers:{'access-control-allow-origin':'*'} }); });
    await p.evaluate(() => { STREAM_OK = true; motorActivo = 'groq'; });
    { const r = await decir(h, 'explicame la segunda ley de Newton', 2500); t('el motor rechaza el streaming (400) → contesta el principal sin streaming, no el respaldo', /DESDE_PRINCIPAL/.test(r.u) && !/↺ respaldo/.test(r.u) && await p.evaluate(() => STREAM_OK === false), r.u.slice(0, 120)); }
    t('sin errores JS', !(p._pe || []).length, p._pe);
    await h.close();
  }
  console.log('\n' + (mal ? '❌ ' + mal + ' FALLAN (' + ok + ' ok)' : '✅ TODO VERDE — ' + ok + ' pruebas (navegador real · tanda 23/10)'));
  process.exit(mal ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
