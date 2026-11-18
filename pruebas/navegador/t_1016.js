// t_1016.js — build 2026-10-16.1: los hallazgos CONFIRMADOS de los 4 auditores del 16/10, probados en Chromium real.
// Uso: FILE=…/PLATAFORMA/index.html NODE_PATH=$(npm root -g) node t_1016.js
const { abrir } = require('./harness.js');
const CFG = { appName:'MANIFIESTOS', perfil:{ nombre:'ATIS' }, modos:{ mirror:'ATIS', tars:'MODO ANALÍTICO', jurado:'EXPERTO/EXAMINADOR', conn:'BASE' }, modeloPrincipal:'openai/gpt-oss-120b', motorPrincipal:'groq' };
let ok = 0, mal = 0;
function t(n, c, d){ if (c){ ok++; console.log('  ✅ ' + n); } else { mal++; console.log('  ❌ ' + n + (d !== undefined ? '  → ' + String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 260) : '')); } }
const ultimo = p => p.evaluate(() => { const m = document.querySelectorAll('#chat .msg'); return m.length ? m[m.length - 1].innerText : ''; });
async function decir(h, q, ms){ const n0 = h.srv._reqs.length; await h.page.fill('#inp', q); await h.page.keyboard.press('Enter'); await h.page.waitForTimeout(ms || 1400); return { llamadas: h.srv._reqs.length - n0, u: (await ultimo(h.page)).replace(/\s+/g, ' ') }; }

(async () => {
  // ── A · charla y modos (auditor 1) ──────────────────────────────────────────────
  console.log('\n━━━ A · cambiar de modo por su nombre, hora, datos y falsos positivos (config ATIS) ━━━');
  { const h = await abrir({ fb:true, cfg:CFG, reply:'RESPUESTA_DEL_MODELO' }); const p = h.page;
    const casos = [['pasá al modo analítico','tars'],['PASAME AL MODO ANALITICO','tars'],['llevame al modo EXPERTO/EXAMINADOR','jurado'],['pasame al modo experto','jurado'],['cambiá al modo examinador','jurado'],['pasá al modo analista','tars'],['pasá al modo BASE','conn']];
    for (const [q, dest] of casos){
      await p.evaluate(() => setMode('mirror')); await p.waitForTimeout(150);
      const r = await decir(h, q, 700); const m = await p.evaluate(() => mode);
      t('«' + q + '» → modo ' + dest + ', sin «No conozco»', m === dest && !/No conozco/.test(r.u) && r.llamadas === 0, { m, u:r.u.slice(0,120) });
    }
    await p.evaluate(() => setMode('mirror')); await p.waitForTimeout(150);
    // controles del verificador: lo que NO es cambiar de modo, no cambia de modo ni dice «No conozco»
    for (const q of ['desactivá el modo analista','activá el modo auto','cambiá el modo de pago de la tarjeta','activá el modo avión']){
      await p.evaluate(() => setMode('mirror')); await p.waitForTimeout(120);
      const r = await decir(h, q, 900); const m = await p.evaluate(() => mode);
      t('control: «' + q + '» no te pasa de modo ni dice «No conozco un modo»', m === 'mirror' && !/No conozco un modo/.test(r.u), { m, u:r.u.slice(0,120) });
    }
    await p.evaluate(() => setMode('mirror')); await p.waitForTimeout(120);
    { const r = await decir(h, 'pasá al modo zumba', 700); t('«pasá al modo zumba» (no existe) → sigue diciendo que no lo conoce', /No conozco un modo que se llame «zumba»/.test(r.u), r.u); }
    { const r = await decir(h, 'pasá al modo jurado', 700); t('la regla vieja (tars|jurado|conex) dice el nombre que le pusiste («EXPERTO/EXAMINADOR»), no «el JURADO»', /EXPERTO\/EXAMINADOR/.test(r.u) && !/el JURADO/.test(r.u), r.u); }
    await p.evaluate(() => setMode('mirror')); await p.waitForTimeout(150);

    for (const q of ['q hora es','QUE HORA ES CHE','decime la hora','me decis la hora?','tenés hora?','QUE HORA ES? Y QUE DÍA ES HOY','qué día es mañana?']){
      const r = await decir(h, q); t('hora fija: «' + q + '» (sin ir al modelo)', r.llamadas === 0 && /🕐 Son las \d\d:\d\d/.test(r.u), r);
    }
    { const r = await decir(h, 'qué día es mañana?'); t('  «qué día es mañana?» también dice qué día es mañana', /Mañana es /.test(r.u), r.u); }
    { const r = await decir(h, 'tengo turno con el médico el martes, ¿qué día?'); t('control: «…¿qué día?» en una charla NO se tapa con la fecha (va al modelo)', r.llamadas > 0 && !/🕐/.test(r.u), r); }
    { const r = await decir(h, 'qué hora es en Tokio?'); t('control: «qué hora es en Tokio?» NO es la hora local → va al modelo', r.llamadas > 0 && !/🕐/.test(r.u), r); }

    for (const q of ['que verison sos','CUAL ES TU VERSION','EN QUE VERSION ESTAS','QUE BUILD SOS','ESTAS ACTUALIZADA?','sos la ultima version?','cuales son tus novedade']){
      const r = await decir(h, q); t('versión fija: «' + q + '»', r.llamadas === 0 && r.u.indexOf('Mi versión: soy la v40 · build ' + (/const APP_BUILD = '([^']+)'/.exec(require('fs').readFileSync(process.env.FILE,'utf8'))||[])[1]) >= 0 /* v40-1023: la build que diga el archivo, no una fija */, r.u.slice(0,120));
    }
    for (const q of ['CON QUE MODELO FUNCIONAS','QUE IA SOS','SOS CHATGPT?','sos gpt?','SOS LLAMA O GPT?']){
      const r = await decir(h, q); t('modelo fijo: «' + q + '» (sin ir al modelo)', r.llamadas === 0 && /openai\/gpt-oss-120b/.test(r.u), r);
    }
    for (const q of ['DONDE SE GUARDA TODO LO QUE TE DIGO','dónde está guardado lo mío','DONDE ALMACENAS MIS DATOS']){
      const r = await decir(h, q); t('dónde se guarda, fijo: «' + q + '»', r.llamadas === 0 && /Dónde está lo tuyo/.test(r.u), r.u.slice(0,120));
    }
    { const r = await decir(h, 'QUE PASA SI SE CAE GROQ'); t('«QUE PASA SI SE CAE GROQ» → el motor de respaldo, fijo', r.llamadas === 0 && /motor de respaldo/.test(r.u), r.u.slice(0,100)); }

    // falsos positivos: NO son sobre la app
    for (const q of ['qué versión tenés del informe que te pasé?','que version usas de python','con quién hablo para reclamar en el banco?','quién sos vos para decirme eso','tenés respaldo de lo que me decís?','dónde guardo mis cosas para la mudanza?','sos una persona increíble, gracias','qué opinás de la privacidad en las redes?']){
      const r = await decir(h, q); t('NO es dato de la app: «' + q + '» → al modelo, sin respuesta fija ni panel', r.llamadas > 0 && /RESPUESTA_DEL_MODELO/.test(r.u) && !/Mi versión|Quién soy|motor de respaldo|Dónde está lo tuyo|Te abrí el panel/.test(r.u), r.u.slice(0,140));
    }
    { const r = await decir(h, 'DONDE QUEDA LO QUE HABLAMOS'); t('«DONDE QUEDA LO QUE HABLAMOS» ya no arma una tarjeta de Maps', !/Cómo llegar/.test(r.u), r.u.slice(0,120)); }
    { const r = await decir(h, 'dónde queda la plaza San Martín'); t('control: «dónde queda la plaza San Martín» SÍ arma Maps', /Cómo llegar/.test(r.u), r.u.slice(0,120)); }
    // lo que SÍ abre el panel sigue igual
    for (const q of ['sos una persona?','sos una persona o una ia','privacidad','¿sos una ia?']){
      const r = await decir(h, q, 900); t('sigue abriendo el panel de transparencia: «' + q + '»', /Te abrí el panel/.test(r.u), r.u.slice(0,100));
      await p.keyboard.press('Escape'); await p.waitForTimeout(150);
    }
    { const s = await p.evaluate(() => sacarTemasDeHechos('Soy todo oídos. Seguro que hoy te va bárbaro con la entrevista. Soy «MANIFIESTOS», tu doble.', ['identidad','guardo']));
      t('sacarTemasDeHechos ya no borra «Soy todo oídos» ni «Seguro que te va bárbaro»', /Soy todo oídos/.test(s) && /Seguro que hoy/.test(s) && !/Soy «MANIFIESTOS»/.test(s), s); }

    // otros modos: solo hora/versión y solo si es todo lo que se pregunta
    await p.evaluate(() => setMode('tars')); await p.waitForTimeout(200);
    { const r = await decir(h, '¿qué hora es?'); t('en MODO ANALÍTICO «¿qué hora es?» sale del reloj (sin modelo)', r.llamadas === 0 && /🕐/.test(r.u), r); }
    { const r = await decir(h, 'qué hora es? y explicame la entropía', 1800); t('  …pero «qué hora es? y explicame la entropía» sigue el camino del modo (va al modelo)', r.llamadas > 0, r); }
    { const r = await decir(h, 'quien te creo?', 1800); t('  …y la identidad en el modo analítico no se toca (va al modelo, como antes)', r.llamadas > 0, r); }
    await p.evaluate(() => setMode('mirror'));

    // selector de voz con los nombres de la instalación
    { const v = await p.evaluate(() => { abrirSelectorVoz(); return document.getElementById('voz-lista').innerText + '|' + document.getElementById('voz-modal').innerText; });
      t('selector de voz: botones «ATIS» y «MODO ANALÍTICO», no «MIRROR» fijo', /ATIS/.test(v) && /MODO ANALÍTICO/.test(v) && !/\bMIRROR\b/.test(v.split('|')[0]), v.slice(0,200)); }
    t('sin errores JS (A)', !(p._pe||[]).length, p._pe);
    await h.close(); }

  // ── A2 · modos incompletos ─────────────────────────────────────────────────────
  { const h = await abrir({ cfg:{ modos:{ mirror:'ATIS' } } }); const p = h.page;
    const tx = await p.evaluate(() => { setMode('jurado'); return document.body.innerText; });
    t('config con modos a medias ({mirror:"ATIS"}) → nada dice «undefined»', !/undefined/.test(tx) && /EXAMINADOR/.test(tx), (tx.match(/.{0,30}undefined.{0,30}/)||[''])[0]);
    await h.close(); }

  // ── B · accesorios (auditor 2) ─────────────────────────────────────────────────
  console.log('\n━━━ B · config previa de Firebase (XSS + proxy) · imagen ━━━');
  { const h = await abrir({ path:'/', cfg:{ configurado:false } }); const p = h.page;
    await p.route('**/evilfb/config.json', r => r.fulfill({ status:200, contentType:'application/json', body: JSON.stringify({ configurado:true, appName:'<img src=x onerror="window.__xss=1">', perfil:{ nombre:'<b onmouseover=window.__xss=2>X</b>' }, proxyUrl:'https://evil.example/proxy' }) }));
    const dialogs = []; p.on('dialog', d => { dialogs.push(d.message()); d.dismiss(); });
    await p.evaluate((b) => { const i = document.getElementById('c-fb'); i.value = b + '/evilfb'; const px = document.getElementById('c-proxy'); if (px) px.value = 'https://mio.workers.dev'; return consChequearConfigPrevia(); }, h.base);
    await p.waitForTimeout(600);
    const r = await p.evaluate(() => ({ xss: window.__xss, html: document.getElementById('cons-recuperar').innerHTML, txt: document.getElementById('cons-recuperar').innerText }));
    t('el appName remoto con <img onerror> NO corre código', r.xss === undefined, r);
    t('  …y se ve como texto («<img src=x…»)', /<img src=x/.test(r.txt) && !/<img/i.test(r.html.replace(/&lt;img/g,'')), r.html.slice(0,200));
    await p.evaluate(() => consRecuperar()); await p.waitForTimeout(300);
    const px = await p.evaluate(() => CONFIG.proxyUrl);
    t('«Traerla» con un proxy distinto: te lo muestra y pregunta', dialogs.some(m => /evil\.example/.test(m) && /Cancelar/.test(m)), dialogs);
    t('  …y si decís que no, queda TU proxy (no el remoto)', px === 'https://mio.workers.dev', px);
    await h.close(); }
  { const h = await abrir({ cfg:CFG, ls:{ mirror_pollinations_key:'pk_prueba' } }); const p = h.page;
    await p.route('https://gen.pollinations.ai/**', r => r.fulfill({ status:200, contentType:'text/html', body:'<html><body>error del servicio</body></html>' }));
    await p.fill('#inp', 'un gato astronauta'); await p.evaluate(() => generarImagen()); await p.waitForTimeout(1200);
    const r = await p.evaluate(() => ({ imgs: document.querySelectorAll('#chat img').length, u: (document.querySelectorAll('#chat .msg')[document.querySelectorAll('#chat .msg').length-1]||{}).innerText || '' }));
    t('imagen: si Pollinations manda HTML en vez de imagen, no se muestra como «imagen generada»', r.imgs === 0 && /no me mandó una imagen/.test(r.u), r);
    await h.close(); }

  // ── C · celular y accesibilidad (auditor 3) ─────────────────────────────────────
  console.log('\n━━━ C · celular 360×640: el «⋯ más» se alcanza · bandeja «+» · teclado · micrófono ━━━');
  for (const [W,H] of [[360,640],[390,664]]){
    const h = await abrir({ cfg:CFG, viewport:{ width:W, height:H }, wait:2000 }); const p = h.page;
    await p.evaluate(() => { toggleTools(); toggleMas(); }); await p.waitForTimeout(300);
    const r = await p.evaluate(() => { const fuera = [];
      document.querySelectorAll('#fmoreGroup [data-pie], #fmoreGroup span[onclick], .fnote span[onclick]').forEach(el => { if (!el.offsetParent) return; el.scrollIntoView({ block:'nearest' }); const b = el.getBoundingClientRect(); if (b.bottom > innerHeight + 1 || b.top < 0) fuera.push(el.innerText.trim().slice(0,24)); });
      const ch = document.getElementById('chat').getBoundingClientRect().height; return { fuera, ch, sw: document.documentElement.scrollWidth }; });
    t(W+'×'+H+' con «+» y «⋯ más» abiertos: todas las pastillas se pueden traer a la pantalla', r.fuera.length === 0, r.fuera);
    t('  …el chat conserva lugar (≥ 100 px) y no hay scroll horizontal', r.ch >= 100 && r.sw <= W, r);
    await h.close();
  }
  { const h = await abrir({ cfg:CFG, viewport:{ width:390, height:844 }, reply:'hola' }); const p = h.page;
    const est = () => p.evaluate(() => document.getElementById('toolsTray').classList.contains('oculto'));
    await p.evaluate(() => toggleTools()); await p.waitForTimeout(100); const abierta = !(await est());
    await p.keyboard.press('Escape'); await p.waitForTimeout(100);
    t('bandeja «+»: abre y se cierra con Esc', abierta && await est());
    await p.evaluate(() => toggleTools()); await p.mouse.click(195, 200); await p.waitForTimeout(100);
    t('  …y tocando afuera (en el chat)', await est());
    await p.evaluate(() => toggleTools()); await p.fill('#inp', 'hola che'); await p.keyboard.press('Enter'); await p.waitForTimeout(900);
    t('  …y al mandar un mensaje', await est());
    await p.evaluate(() => toggleTools()); await p.click('#inp'); await p.waitForTimeout(100);
    t('  control: tocar el cuadro de escribir NO la cierra', !(await est()));
    const tab = await p.evaluate(() => { const els = Array.from(document.querySelectorAll('.fnote span[onclick]')); return { total: els.length, sinFoco: els.filter(e => e.getAttribute('tabindex') !== '0').map(e => e.innerText.trim().slice(0,20)) }; });
    t('pie: todas las pastillas toman foco con Tab (' + tab.total + ')', tab.total > 8 && tab.sinFoco.length === 0, tab.sinFoco);
    const doc = await p.evaluate(() => { const el = document.querySelector('.fnote [data-pie="documentos"]'); el.focus(); el.dispatchEvent(new KeyboardEvent('keydown', { key:'Enter', bubbles:true })); const m = document.querySelectorAll('#chat .msg'); return m[m.length-1].innerText; });
    t('  …y Enter las toca («📎 mis documentos» con el teclado)', /No tenés documentos/.test(doc), doc);
    const ct = await p.evaluate(() => { const e = document.querySelector('.aviso-ia'); if (!e) return null; const s = getComputedStyle(e); return { o: s.opacity, c: s.color }; });
    t('aviso «Hablás con una IA»: opacidad plena (antes 0,75 → contraste 2,3:1)', ct && ct.o === '1', ct);
    t('sin errores JS (C)', !(p._pe||[]).length, p._pe);
    await h.close(); }
  for (const err of ['audio-capture','not-allowed']){
    const h = await abrir({ cfg:CFG }); const p = h.page;
    const r = await p.evaluate((err) => { window.SpeechRecognition = function(){ const s = this; s.start = function(){ setTimeout(() => { s.onerror && s.onerror({ error: err }); s.onend && s.onend(); }, 20); }; s.stop = function(){}; s.abort = function(){}; }; window.webkitSpeechRecognition = window.SpeechRecognition; vozAccion(); return new Promise(res => setTimeout(() => { const m = document.querySelectorAll('#chat .msg'); res({ u: m[m.length-1].innerText, acc: micAccion, lbl: (document.getElementById('accLbl')||{}).textContent }); }, 300)); }, err);
    t('«hablá y actúo» con micrófono en error «' + err + '»: no queda trabado en «terminá y actúo»', r.acc === false && !/terminá/.test(r.lbl || ''), r);
    t('  …y dice la causa real', err === 'audio-capture' ? /No encuentro un micrófono/.test(r.u) : /bloqueó el micrófono/.test(r.u), r.u);
    await h.close();
  }

  // ── D · honestidad y robustez (auditor 4) ───────────────────────────────────────
  console.log('\n━━━ D · sin red · motor caído · saturación real · borrar memoria · perfil ━━━');
  { const h = await abrir({ fb:true, cfg:CFG }); const p = h.page;
    await p.route('**/proxy/**', r => r.abort('internetdisconnected'));
    const r = await decir(h, 'contame algo lindo de la física', 6000);
    t('sin red: «Falló la conexión», sin «Failed to fetch» ni «no sé bien qué»', /Falló la conexión/.test(r.u) && !/Failed to fetch|no sé bien qué/.test(r.u), r.u);
    await h.close(); }
  { const h = await abrir({ fb:true, cfg:CFG }); const p = h.page;
    await p.route('**/proxy/**', r => r.fulfill({ status:502, contentType:'text/html', body:'<html>Bad gateway</html>' }));
    const r = await decir(h, 'contame algo lindo de la física', 6000);
    t('motor caído (502 con HTML): dice que es del lado del motor, NO manda a revisar CONEX', /no está contestando bien/.test(r.u) && !/CONEX/.test(r.u), r.u);
    await h.close(); }
  { const h = await abrir({ cfg:CFG }); const p = h.page;
    await p.route('**/proxy/**', r => { const u = r.request().url();
      if (/\/cerebras/.test(u)) return r.fulfill({ status:400, contentType:'application/json', body: JSON.stringify({ error:{ message:'Falta el secret CEREBRAS_KEY en el proxy' } }) });
      return r.fulfill({ status:429, contentType:'application/json', body: JSON.stringify({ error:{ message:'Rate limit reached. Please try again in 0.2s', code:'rate_limit_exceeded' } }) }); });
    const tipo = await p.evaluate(async () => { try { await callGroq([{ role:'user', content:'hola' }], 'sos una prueba', 50, 0.5); return 'contestó'; } catch(e){ return e.tipo + '|' + e.message; } });
    t('instalación de fábrica con todo saturado: el error que manda es «rate_limit» (no el «Falta el secret» del respaldo sin clave)', /^rate_limit\|/.test(tipo), tipo);
    const msg = await p.evaluate(() => mensajeError('rate_limit'));
    t('  …y el cartel dice «saturados», sin mandar a agregar /cloudflare (Cloudflare ya contestó)', /saturad/.test(msg) && !/ruta \/cloudflare/.test(msg), msg);
    await h.close(); }
  { const h = await abrir({ fb:true, cfg:CFG }); const p = h.page;
    p.on('dialog', d => d.type() === 'prompt' ? d.accept('BORRAR') : d.accept());
    await p.evaluate(() => clearMem()); await p.waitForTimeout(600);
    const u = await ultimo(p);
    t('🗑 borrar memoria (con Firebase): dice exactamente qué borró y que los recuerdos siguen', /Borré la charla guardada/.test(u) && /recuerdos/.test(u) && !/Empezamos de cero/.test(u), u);
    await h.close(); }
  { const h = await abrir({ cfg:CFG }); const p = h.page;
    p.on('dialog', d => d.type() === 'prompt' ? d.accept(d.defaultValue() || 'BORRAR') : d.accept());
    await p.evaluate(() => clearMem()); await p.waitForTimeout(500);
    t('🗑 borrar memoria (sin Firebase): no dice que borró algo guardado afuera', /No hay una base Firebase conectada/.test(await ultimo(p)), await ultimo(p));
    await p.evaluate(() => editarPerfil()); await p.waitForTimeout(500);
    const u = await ultimo(p);
    t('editar perfil sin Firebase: ya no dice «guardado en memoria permanente»', !/guardado en memoria permanente/.test(u) && /Todavía no hay una base Firebase/.test(u), u);
    await h.close(); }
  { const h = await abrir({ fb:true, cfg:CFG }); const p = h.page;
    await p.route('**/fb/perfil.json', r => r.request().method() === 'PUT' ? r.fulfill({ status:401, contentType:'application/json', body:'{"error":"Permission denied"}' }) : r.continue());
    p.on('dialog', d => d.accept(d.defaultValue() || 'x'));
    await p.evaluate(() => editarPerfil()); await p.waitForTimeout(700);
    t('editar perfil con Firebase en 401: avisa que NO se guardó', /NO pude guardarlo en tu Firebase/.test(await ultimo(p)), await ultimo(p));
    await h.close(); }

  console.log('\n' + (mal ? '❌ ' + mal + ' FALLAN (' + ok + ' ok)' : '✅ TODO VERDE — ' + ok + ' pruebas (navegador real · auditores 16/10)'));
  process.exit(mal ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
