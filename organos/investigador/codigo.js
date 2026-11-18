/* ══ v40-investigar (23/10/2026) — 🔎 INVESTIGACIÓN A FONDO: un agente de varios pasos, gratis ══════════════════════════
   PEDIDO DE DARÍO (23/10, en vivo): «una herramienta competente para resolver problemáticas complejas… no jueguitos».
   Lo que hoy venden como «Deep Research» (Gemini, ChatGPT, Perplexity), hecho con lo que esta plataforma ya tiene y SIN PAGAR:
     1) PLAN: el modelo descompone la pregunta en 3–5 búsquedas concretas (una llamada chica).
     2) BÚSQUEDA: cada búsqueda va por tu proxy a Tavily (plan gratis), una por una, con tope de tiempo; se juntan las
        fuentes sin repetir. Si hay documentos tuyos cargados o recuerdos que vienen al caso, también entran (marcados).
     3) SÍNTESIS: un informe con citas [n] que SOLO pueden apuntar a las fuentes que se encontraron.
     4) CONTROL (lo hace el CÓDIGO, no el modelo): se borran las citas a fuentes que no existen, la lista de fuentes la
        arma la app con los títulos y direcciones reales (el modelo no puede inventar una URL), y se dice cuántas se usaron.
   PRESUPUESTO: el plan gratis de Groq da 8.000 tokens por minuto al gpt-oss-120b. Por eso el informe usa un prompt de
   sistema corto (no el del espejo entero) y las fuentes van recortadas; si igual se satura, la cadena de siempre espera lo
   que pida el motor o pasa al escalón 20b. HONESTIDAD: sin fuentes NO se arma un «informe» que parezca verificado. */
const INV_MAX_BUSQ = 5, INV_RES_POR_BUSQ = 4, INV_MAX_FUENTES = 12, INV_CAR_FUENTE = 650, INV_TOPE_WEB_MS = 20000;
function pedidoInvestigacion(t){
  const m = /^\s*(?:che,?\s*)?(?:investig[aá](?:me)?\s+(?:a\s+fondo|en\s+profundidad|bien)\s*:?\s*(?:(?:sobre|de|acerca\s+de|si|qu[eé]|c[oó]mo)\s+)?|hac[eé](?:me)?\s+una\s+investigaci[oó]n\s+(?:a\s+fondo\s+|profunda\s+|completa\s+)?(?:sobre|de|acerca\s+de)\s+|deep\s+research\s*:?\s*)(.{6,600}?)\s*[.!]*\s*$/i.exec(String(t || ''));
  return m ? m[1].trim() : '';
}
function invNota(txt){ try { setTypingNote(txt); } catch(_){} try { if (busy) setButtonsBusy(true); } catch(_){} } // cada paso rearma el reloj de 2 min
function invParsearPlan(raw, pregunta){
  const out = [];
  try {
    const j = /\{[\s\S]*\}/.exec(String(raw || ''));
    if (j){ const o = JSON.parse(j[0]); (o.busquedas || o.queries || []).forEach(function(q){ q = String(q || '').trim(); if (q.length >= 3 && q.length <= 200) out.push(q); }); }
  } catch(_){}
  if (!out.length){ String(raw || '').split('\n').forEach(function(l){ const q = l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').replace(/^["«]|["»]$/g, '').trim(); if (q.length >= 6 && q.length <= 200 && !/^\{|\}$|busquedas/i.test(q)) out.push(q); }); }
  const vistos = {}, final = [];
  [pregunta].concat(out).forEach(function(q){ const k = q.toLowerCase(); if (!vistos[k] && final.length < INV_MAX_BUSQ){ vistos[k] = 1; final.push(q.slice(0, 200)); } });
  return final;
}
async function invBuscar(q){
  const r = await fetchTextoConTope(TAVILY_URL, { method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer ' + TAVILY_KEY }, body: JSON.stringify({ query: q, max_results: INV_RES_POR_BUSQ, search_depth: 'basic' }) }, INV_TOPE_WEB_MS);
  if (!r.res.ok){ let _rr = r.res; try { _rr = new Response(r.raw, { status: r.res.status }); } catch(_){} const e = new Error(await webCausaDe(_rr) || ('HTTP ' + r.res.status)); e.status = r.res.status; throw e; }
  let d = {}; try { d = JSON.parse(r.raw || '{}'); } catch(_){}
  return (d.results || []).filter(function(x){ return x && /^https?:\/\//i.test(String(x.url || '')); });
}
/* Control de citas: solo quedan las [n] que apuntan a una fuente real; la lista de fuentes la pone la app. */
function invLimpiarCitas(txt, n){
  let quitadas = 0;
  let t = String(txt || '').replace(/\[(\d{1,2})\]/g, function(m, k){ k = +k; if (k >= 1 && k <= n) return m; quitadas++; return ''; });
  t = t.replace(/\n#{0,4}\s*\**\s*(?:fuentes|referencias|bibliograf[ií]a)\s*\**\s*:?\s*\n[\s\S]*$/i, '').trim(); // la lista la arma la app
  const usadas = {}; (t.match(/\[(\d{1,2})\]/g) || []).forEach(function(m){ usadas[+m.slice(1, -1)] = 1; });
  return { texto: t, quitadas: quitadas, usadas: usadas };
}
let invUltimoInforme = null;
function invBajarInforme(){
  if (!invUltimoInforme) return;
  try { bajarBlob(new Blob([invUltimoInforme.md], { type:'text/markdown;charset=utf-8' }), 'investigacion_' + fechaArchivo() + '.md'); } catch(e){ try { regError('investigar:bajar', e); } catch(_){} }
}
function investigarDesdeCaja(){
  const inp = document.getElementById('inp'); const q = (inp && inp.value || '').trim();
  if (!q){ addMsg('mirror', '🔎 Escribí en la caja la pregunta que querés investigar a fondo y tocá de nuevo «🔎 investigar». También podés escribir «investigá a fondo …».', mode); return; }
  if (inp){ inp.value = ''; try { inp.style.height = 'auto'; } catch(_){} }
  return investigarAFondo(q, '🔎 ' + q);
}
async function investigarAFondo(pregunta, textoUsuario){
  if (busy) return;
  const miTurno = ++turnoVivo;
  if (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.cap && CONFIG.cap.web === false){
    addMsg('user', textoUsuario || pregunta); addMsg('mirror', '🔎 La investigación a fondo usa la búsqueda web, y en esta instalación está apagada (constructor → capacidades → 🌐). Sin web no armo un informe con fuentes.', mode); return; }
  setButtonsBusy(true);
  addMsg('user', textoUsuario || pregunta);
  showTyping('web');
  const fuentes = [], fallas = [];
  let reply = '', error = null;
  let propio = ''; // v40-1029: afuera del try, porque el aviso de «0 citas» necesita saber si hubo material propio
  try {
    // 1) plan
    invNota('🔎 Paso 1/3 · armo el plan de búsqueda…');
    let plan = [pregunta];
    try {
      /* v40-1029 (en vivo 23/10): «investigá a fondo sobre el proyecto de tesis de Darío Tello» trajo OTROS «Tello» (0 de 12
         citadas). El plan no sabía quién preguntaba. Ahora lleva pistas (nombre, lugar, proyectos y documentos del usuario) y la
         orden de desambiguar personas, proyectos y lugares. Las pistas solo orientan las búsquedas: no se inventa nada con ellas. */
      const _pistas = invPistas();
      const raw = await callGroqResiliente([{ role:'user', content: 'Pregunta a investigar: «' + pregunta + '»\nFecha de hoy: ' + new Date().toISOString().slice(0, 10) + '.\n' + (_pistas ? 'PISTAS DE QUIÉN PREGUNTA (usalas SOLO si la pregunta es sobre él, sus proyectos o su lugar): ' + _pistas + '.\n' : '') + 'Devolvé SOLO un JSON {"busquedas":["…","…"]} con 3 a 4 búsquedas web CORTAS y concretas (en el idioma en que más fuentes buenas haya; podés mezclar español e inglés) que, juntas, cubran la pregunta: datos, definiciones, evidencia y posturas distintas. Si la pregunta es sobre una PERSONA, un PROYECTO o un LUGAR concretos, cada búsqueda lleva el nombre completo entre comillas y algo que lo distinga (lugar, institución o tema), para no traer homónimos. Nada más que el JSON.' }],
        'Sos un planificador de búsquedas. Respondés solo con JSON válido.', 300, 0.2);
      plan = invParsearPlan(raw, pregunta);
      if (invEsPersonaOProyecto(pregunta) && plan.length > 2) plan = plan.slice(1); // v40-10292: sobre una persona o tu proyecto, la pregunta cruda trae homónimos («otros Tello»): van solo las búsquedas con contexto
    } catch(e){ try { regError('investigar:plan', e); } catch(_){} } // sin plan se busca la pregunta tal cual
    if (miTurno !== turnoVivo) return;
    // 2) búsquedas (una por una: el plan gratis de Tavily se cuida)
    const vistas = {};
    for (let i = 0; i < plan.length; i++){
      invNota('🔎 Paso 2/3 · busco (' + (i + 1) + '/' + plan.length + '): ' + plan[i].slice(0, 70));
      try {
        const rs = await invBuscar(plan[i]);
        rs.forEach(function(x){ const k = String(x.url).replace(/[#?].*$/, '').replace(/\/+$/, ''); if (!vistas[k] && fuentes.length < INV_MAX_FUENTES){ vistas[k] = 1; fuentes.push({ titulo: String(x.title || x.url).slice(0, 160), url: String(x.url), texto: String(x.content || '').replace(/\s+/g, ' ').slice(0, INV_CAR_FUENTE), busqueda: plan[i] }); } });
      } catch(e){ fallas.push(plan[i] + ' → ' + String(e && e.message || e).slice(0, 120)); try { regError('investigar:web', e); } catch(_){} if (e && (e.status === 401 || e.status === 403 || e.status === 404)) break; }
      if (miTurno !== turnoVivo) return;
    }
    // contexto propio (marcado aparte: no es web)
    // v40-1029: también los documentos de SESIÓN (antes solo la biblioteca guardada: con los dos de la tesis subidos en la sesión, el informe no los veía)
    try { if ((typeof ragChunks !== 'undefined' && ragChunks.length) || (typeof ragDocs !== 'undefined' && ragDocs.some(function(d){ return d && d.type === 'session' && d.content; }))){ const rc = getRagContext(pregunta, pregunta, true); if (rc) propio += 'DE TUS DOCUMENTOS:\n' + String(rc).slice(0, 1800) + '\n'; } } catch(_){}
    try { const mr = (mode === 'mirror') ? getRecuerdosContext(pregunta) : ''; if (mr) propio += 'DE TU MEMORIA:\n' + String(mr).slice(0, 900) + '\n'; } catch(_){}
    if (!fuentes.length){
      removeTyping();
      const causa = fallas.length ? fallas[fallas.length - 1].split(' → ').pop() : 'no trajo resultados';
      addMsg('mirror', '🔎 No pude investigar esto: la búsqueda web ' + (fallas.length ? 'no respondió (' + causa + ')' : 'no trajo resultados') + '. Sin fuentes no te armo un «informe» que parezca verificado y no lo es. Probá en un rato, cambiá la pregunta, o preguntame normal (te contesto con lo que sé, sin fuentes).', mode);
      setButtonsBusy(false); return;
    }
    // 3) síntesis
    invNota('🔎 Paso 3/3 · leo ' + fuentes.length + ' fuentes y escribo el informe…');
    const ctx = fuentes.map(function(f, i){ return '[' + (i + 1) + '] ' + f.titulo + ' — ' + f.url + '\n' + f.texto; }).join('\n\n');
    const nombre = (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.appName) || 'MIRROR';
    const sys = 'Sos el modo investigación de ' + nombre + ', la extensión digital de tu usuario. Escribís en español rioplatense, claro y riguroso.\n'
      + 'REGLAS DURAS: (1) toda afirmación de hecho lleva su cita [n] y SOLO podés citar las fuentes numeradas que te paso; (2) si las fuentes no alcanzan, se contradicen o son flojas, lo decís; (3) no inventes datos, cifras, autores ni enlaces; (4) lo que venga de «DE TUS DOCUMENTOS» o «DE TU MEMORIA» lo marcás como tal, sin [n]; (5) no escribas la lista de fuentes: la agrega la app.\n'
      + 'FORMATO: **En corto** (2–4 líneas con la respuesta directa) · **Lo que encontré** (desarrollo por temas, con [n]) · **Dónde no hay acuerdo o falta evidencia** · **Qué haría ahora** (2–3 pasos concretos).';
    const msg = 'PREGUNTA: ' + pregunta + '\n\nFUENTES WEB (' + fuentes.length + '):\n' + ctx + (propio ? '\n\n' + propio : '') + '\n\nEscribí el informe.';
    reply = await callGroqResiliente([{ role:'user', content: msg }], sys, 1400, 0.3);
  } catch(e){ error = e; }
  if (miTurno !== turnoVivo) return;
  removeTyping();
  if (error || !reply){
    addMsg('mirror', String(mensajeError((error && error.tipo) || 'otro', error && error.message)).replace(/^(?!⚠|⏱)/, '⚠️ ') + (fuentes.length ? ' (Las ' + fuentes.length + ' fuentes sí se encontraron: si reintentás, el informe sale de nuevo.)' : ''), mode);
    setButtonsBusy(false); return;
  }
  const lc = invLimpiarCitas(sinPensamiento(reply), fuentes.length);
  const nUsadas = Object.keys(lc.usadas).length;
  const lista = fuentes.map(function(f, i){ return '[' + (i + 1) + '] ' + f.titulo + ' — ' + f.url + (lc.usadas[i + 1] ? '' : ' (consultada, no citada)'); }).join('\n');
  const pie = '\n\n**Fuentes** (las armó la app con lo que de verdad encontró; ' + nUsadas + ' de ' + fuentes.length + ' citadas' + (lc.quitadas ? '; saqué ' + lc.quitadas + ' cita(s) a fuentes que no existían' : '') + '):\n' + lista
    + (fallas.length ? '\n\n⚠️ ' + fallas.length + ' búsqueda(s) no respondieron; el informe sale de las demás.' : '')
    + '\n\nOjo: las fuentes son lo que devolvió el buscador, y yo puedo leerlas mal. Para algo importante, abrí las citadas.';
  /* v40-1029 (en vivo 23/10): con «0 de 12 citadas» el informe salía igual, con cara de verificado, y el aviso quedaba
     escondido al pie. Ahora se dice ARRIBA de todo, y se dice de dónde sale entonces lo que sigue. */
  const cabeza = nUsadas ? '' : '⚠️ **De frente:** la web no aportó nada citable sobre esto (0 de ' + fuentes.length + ' fuentes citadas' + (lc.quitadas ? ': las citas que escribió el modelo no apuntaban a fuentes reales y las saqué' : ': el informe no se apoyó en ninguna de las que trajo el buscador') + '). '
    + (propio ? 'Lo que sigue solo puede apoyarse en **tus documentos y tu memoria**, no en internet: verificalo ahí.' : 'Tomá lo que sigue como orientación, no como un informe verificado.') + '\n\n';
  const final = cabeza + lc.texto + pie;
  invUltimoInforme = { pregunta: pregunta, tipo: 'inv', texto: final, md: '# Investigación: ' + pregunta + '\n_' + fechaHora24() + ' · ' + nombreInv() + '_\n\n' + final + '\n' };
  ultimaProcedencia = ['🔎 investigación · ' + fuentes.length + ' fuentes'];
  try { const _rc = respaldoChip(); if (_rc) ultimaProcedencia.push(_rc); } catch(_){}
  addMsg('mirror', final, 'web');
  try { const ult = document.querySelector('#chat .msg:last-child .bubble'); if (ult){ const b = document.createElement('button'); b.type = 'button'; b.className = 'proc-chip proc-chip-btn'; b.textContent = '⬇ bajar el informe (.md)'; b.onclick = invBajarInforme; const c = ult.querySelector('.proc-chips') || ult; c.appendChild(b); } } catch(_){}
  try { const corto = /\*\*En corto\*\*\s*:?\s*([\s\S]*?)(?:\n\s*\*\*|$)/i.exec(lc.texto); hablar(corto ? corto[1].replace(/\[\d+\]/g, '') : lc.texto.slice(0, 500).replace(/\[\d+\]/g, '')); } catch(_){}
  // v40-1029: con 0 citas y documentos cargados, el camino honesto es leerlos enteros: se ofrece con un toque
  try { if (!nUsadas && typeof ragDocs !== 'undefined' && ragDocs.length){ const ult2 = document.querySelector('#chat .msg:last-child .bubble'); if (ult2){ const b2 = document.createElement('button'); b2.type = 'button'; b2.className = 'proc-chip proc-chip-btn'; b2.textContent = '📄 leer «' + String(docElegir(pregunta).doc.name).slice(0, 40) + '» entero sobre esto'; b2.onclick = function(){ if (busy) return; b2.disabled = true; analizarDocCompleto({ resto: pregunta, texto: pregunta }, '📄 analizá el documento completo: ' + pregunta); }; (ult2.querySelector('.proc-chips') || ult2).appendChild(b2); } } } catch(_){}
  history.push({ role:'user', content:'🔎 ' + pregunta }, { role:'assistant', content: final.slice(0, 6000) });
  invUltimoInforme.hLen = history.length; // v40-1029: desde acá se cuenta si la repregunta todavía es sobre este informe
  try { await memorySet(history); } catch(_){}
  setButtonsBusy(false);
}

/* ══ v40-doccompleto (23/10/2026) — 📄 UN DOCUMENTO LARGO, LEÍDO ENTERO Y POR PARTES ═══════════════════════════════════
   PEDIDO DE DARÍO (23/10): herramientas sustanciales para trabajos complejos. Hasta hoy, al preguntar por un documento, al
   modelo le llegaban solo los 3–4 fragmentos MÁS PARECIDOS a la pregunta (búsqueda). Para «resumí la tesis entera» o «qué
   conclusiones saca el informe» eso no alcanza: lo importante puede estar justo en lo que no se parece a la pregunta.
   AHORA («analizá el documento completo…»): el documento se recorre en partes (mapa), de cada parte se saca lo que aporta a
   tu pedido, y al final se arma la respuesta con todo (reducción), citando la parte [Pn] de cada afirmación.
   CUPO: el plan gratis de Groq da 8.000 tokens/min al gpt-oss-120b; cada parte es un pedido chico y, si se satura, la cadena
   espera lo que pida el motor o pasa al escalón 20b (que tiene su propio cupo). Tope: DOC_MAX_PARTES; si el documento es más
   largo, se dice de frente qué porcentaje se leyó. Nada se guarda en tu Firebase: las notas por parte viven en esta sesión. */
const DOC_PALABRAS_PARTE = 1700, DOC_MAX_PARTES = 12;
function pedidoDocCompleto(t){
  const s = String(t || '').trim();
  // verificador 23/10: sin documentos cargados («leé el libro entero de Sabato…») o con el texto pegado en el mensaje, es charla normal
  if (typeof ragDocs === 'undefined' || !ragDocs.length) return null;
  if (!/\b(?:complet[oa]|enter[oa]|de\s+punta\s+a\s+punta|por\s+partes|todo\s+el\s+(?:documento|pdf|archivo|texto|libro|informe|paper)|toda\s+la\s+tesis)\b/i.test(s)) return null;
  const m = /^\s*(?:che,?\s*)?(?:analiz[aá]|le[eé]|resum[ií]|revis[aá]|estudi[aá]|recorr[eé]|proces[aá])(?:me|lo|la)?\s+(?:todo\s+|toda\s+)?(?:el|la|este|esta|mi)?\s*(documento|pdf|archivo|texto|libro|tesis|paper|informe|apunte)\b([\s\S]{0,600})$/i.exec(s);
  if (!m) return null;
  const resto = m[2].replace(/^\s*(?:entero|entera|completo|completa|de\s+punta\s+a\s+punta|por\s+partes)\b\s*/i, '').trim();
  if (/^:/.test(resto) || resto.split(/\s+/).filter(Boolean).length > 40) return null; // vino el texto pegado: ese texto es lo que hay que leer
  return { resto: resto, texto: s };
}
function docElegir(resto){
  const docs = (typeof ragDocs !== 'undefined' ? ragDocs : []).slice();
  if (!docs.length) return { doc: null, docs: docs };
  const N = function(x){ return String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); };
  const r = N(resto);
  const porNombre = docs.filter(function(d){ const base = N(d.name).replace(/\.[a-z0-9]{2,4}$/, ''); return base && (r.indexOf(base) >= 0 || base.split(/[\s_\-.]+/).filter(function(w){ return w.length >= 4; }).some(function(w){ return r.indexOf(w) >= 0; })); });
  return { doc: porNombre.length === 1 ? porNombre[0] : docs[docs.length - 1], docs: docs, porNombre: porNombre.length === 1 };
}
function docPartes(doc){
  let textos = [];
  if (doc.type === 'session') textos = chunkText(String(doc.content || ''), DOC_PALABRAS_PARTE, 80);
  else {
    const cs = (ragChunks || []).filter(function(c){ return c.docId === doc.id; }).sort(function(a, b){ return (a.idx || 0) - (b.idx || 0); });
    // los fragmentos guardados se solapan 150 palabras: se juntan de a dos (~1.700 palabras por parte)
    for (let i = 0; i < cs.length; i += 2) textos.push(cs[i].text + (cs[i + 1] ? '\n' + cs[i + 1].text : ''));
  }
  return textos.filter(function(x){ return String(x).trim().length > 0; });
}
async function analizarDocCompleto(ped, textoUsuario){
  if (busy) return;
  const el = docElegir(ped.resto);
  if (!el.doc){ addMsg('user', textoUsuario); addMsg('mirror', '📄 No tenés documentos cargados en esta sesión. Subí uno con «+» → ⊕ documento y después pedime «analizá el documento completo…».', mode); return; }
  const miTurno = ++turnoVivo;
  setButtonsBusy(true);
  addMsg('user', textoUsuario);
  showTyping(mode === 'tars' ? 'tars' : 'mirror');
  const partes = docPartes(el.doc), total = partes.length, usar = partes.slice(0, DOC_MAX_PARTES);
  const tarea = ped.resto.replace(/^\s*(?:y|,)\s*/i, '').trim() || 'un análisis completo: tema y tesis central, estructura, argumentos y evidencias principales, conclusiones, y puntos débiles o vacíos';
  const notas = []; let error = null, reply = '';
  try {
    for (let i = 0; i < usar.length; i++){
      invNota('📄 Leo la parte ' + (i + 1) + ' de ' + usar.length + (total > usar.length ? ' (de ' + total + ')' : '') + ' de «' + el.doc.name + '»…');
      try {
        const n = await callGroqResiliente([{ role:'user', content: 'TAREA DEL USUARIO: ' + tarea + '\n\nPARTE ' + (i + 1) + ' de ' + total + ' del documento «' + el.doc.name + '»:\n<<<\n' + String(usar[i]).slice(0, 20000) + '\n>>>\n\nExtraé SOLO lo que esta parte aporta a la tarea: ideas clave, datos y cifras exactas, definiciones, y alguna cita textual corta entre comillas si vale la pena. Máximo 170 palabras, en viñetas. Si no aporta nada, escribí exactamente: nada relevante.' }],
          'Leés documentos con rigor. No inventás nada que no esté en el texto que te pasan. Español rioplatense, conciso.', 450, 0.2);
        notas.push({ i: i + 1, txt: sinPensamiento(String(n || '')).trim() || 'nada relevante' });
      } catch(e){ notas.push({ i: i + 1, txt: '(no la pude leer: ' + String(e && (e.tipo || e.message) || 'error').slice(0, 60) + ')', falla: true }); try { regError('doccompleto:parte', e); } catch(_){} if (e && (e.tipo === 'credencial' || e.tipo === 'pago_requerido')) { error = e; break; } }
      if (miTurno !== turnoVivo) return;
    }
    const leidas = notas.filter(function(n){ return !n.falla; });
    if (!error && leidas.length){
      invNota('📄 Junto lo de las ' + leidas.length + ' partes y armo la respuesta…');
      const ctx = notas.map(function(n){ return '[P' + n.i + '] ' + n.txt; }).join('\n\n');
      reply = await callGroqResiliente([{ role:'user', content: 'TAREA DEL USUARIO sobre el documento «' + el.doc.name + '»: ' + tarea + '\n\nNOTAS POR PARTE (sacadas del documento, en orden):\n' + ctx + '\n\nRespondé la tarea con todo el documento a la vista. Cada afirmación lleva la parte de donde sale, así: [P3]. Si algo no está en las notas, no lo afirmes. Cerrá con una línea: qué partes no aportaron a la tarea.' }],
        'Sos el modo análisis de documentos de ' + ((typeof CONFIG !== 'undefined' && CONFIG && CONFIG.appName) || 'MIRROR') + '. Riguroso, claro, en español rioplatense. Estructura con títulos cortos y viñetas cuando ayude.', 1400, 0.3);
    } else if (!error) { error = new Error('no pude leer ninguna parte'); error.tipo = (notas[0] && /timeout/.test(notas[0].txt)) ? 'timeout' : 'otro'; }
  } catch(e){ error = e; }
  if (miTurno !== turnoVivo) return;
  removeTyping();
  if (error || !reply){
    addMsg('mirror', String(mensajeError((error && error.tipo) || 'otro', error && error.message)).replace(/^(?!⚠|⏱)/, '⚠️ '), mode);
    setButtonsBusy(false); return;
  }
  let txt = sinPensamiento(reply).replace(/\[P(\d{1,2})\]/g, function(m, k){ return (+k >= 1 && +k <= notas.length) ? m : ''; });
  const fallidas = notas.filter(function(n){ return n.falla; }).map(function(n){ return n.i; });
  const cobertura = Math.round(100 * usar.length / Math.max(1, total));
  const pie = '\n\n— Leí «' + el.doc.name + '» ' + (usar.length === total ? 'ENTERO' : 'en sus primeras ' + usar.length + ' de ' + total + ' partes (≈' + cobertura + '%: el resto no entró en esta pasada)') + (fallidas.length ? '; no pude leer la(s) parte(s) ' + fallidas.join(', ') : '') + '. [Pn] = parte del documento.' + ((!el.porNombre && el.docs.length > 1) ? ' Elegí el último que cargaste; si querías otro, nombralo («analizá el documento completo de <nombre>…»).' : '');
  const final = txt + pie;
  invUltimoInforme = { pregunta: tarea, tipo: 'doc', texto: final, md: '# Análisis completo: ' + el.doc.name + '\n_' + fechaHora24() + ' · ' + nombreInv() + '_\n\n**Pedido:** ' + tarea + '\n\n' + final + '\n\n---\n## Notas por parte\n' + notas.map(function(n){ return '### P' + n.i + '\n' + n.txt; }).join('\n\n') + '\n' };
  ultimaProcedencia = ['📄 documento completo · ' + usar.length + '/' + total + ' partes'];
  try { const _rc = respaldoChip(); if (_rc) ultimaProcedencia.push(_rc); } catch(_){}
  addMsg('mirror', final, mode === 'tars' ? 'tars' : 'mirror');
  try { const ult = document.querySelector('#chat .msg:last-child .bubble'); if (ult){ const b = document.createElement('button'); b.type = 'button'; b.className = 'proc-chip proc-chip-btn'; b.textContent = '⬇ bajar el análisis (.md)'; b.onclick = invBajarInforme; (ult.querySelector('.proc-chips') || ult).appendChild(b); } } catch(_){}
  try { hablar(txt.slice(0, 600).replace(/\[P\d+\]/g, '')); } catch(_){}
  history.push({ role:'user', content: textoUsuario }, { role:'assistant', content: final.slice(0, 6000) });
  invUltimoInforme.hLen = history.length; // v40-1029
  try { await memorySet(history); } catch(_){}
  setButtonsBusy(false);
}
/* v40-1029 (en vivo 23/10, Darío): la .md del informe decía «04:48:43» a las 16:48. toLocaleString('es-AR') depende del
   navegador y de la configuración de Windows: en su Edge salió a 12 horas y sin am/pm. Se arma a mano, 24 h siempre. */
function fechaHora24(d){ d = d || new Date(); const z = function(n){ return String(n).padStart(2, '0'); }; return z(d.getDate()) + '/' + z(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + z(d.getHours()) + ':' + z(d.getMinutes()) + ':' + z(d.getSeconds()); }
/* v40-10292 (29/10/2026, auditoría de la 29.1) — EL HALLAZGO EN VIVO ERA «0 de 12 citadas» POR HOMÓNIMOS. La 29.1 le pasa pistas
   al planificador, pero la pregunta CRUDA («el proyecto de tesis de Darío Tello») seguía yendo primera al buscador y llenaba el
   cupo de fuentes con otros «Tello». Si la pregunta es sobre una persona o un proyecto concreto y el plan trajo búsquedas con
   contexto, la cruda no va. Un lugar («paneles solares en Villa Regina») NO cuenta como persona: ahí la cruda sigue yendo. */
function invEsPersonaOProyecto(p){
  const s = String(p || '');
  if (/\b(?:mi|mis|nuestro|nuestra)\s+(?:tesis|proyecto|investigaci[oó]n|trabajo|tp|paper|libro|tesina|emprendimiento)\b/i.test(s)) return true;
  { const m = /\b(?:tesis|proyecto|trabajo|obra|libro|investigaci[oó]n)\s+(?:de\s+tesis\s+)?de\s+/i.exec(s); if (m){ const c = s.charAt(m.index + m[0].length); if (c && c !== c.toLowerCase()) return true; } }
  return /(?:\bqui[eé]n\s+(?:es|fue)|\bsobre|\bacerca\s+de)\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,}\s+(?:[A-ZÁÉÍÓÚÑ]\.?\s+)?[A-ZÁÉÍÓÚÑ][a-záéíóúñ]{2,}\b/.test(s);
}
function invPistas(){
  try {
    const P = (typeof perfilData !== 'undefined' && perfilData) || (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.perfil) || {};
    const out = [];
    if (P.nombre) out.push('se llama ' + String(P.nombre).slice(0, 60));
    if (P.ubicacion) out.push('vive en ' + String(P.ubicacion).slice(0, 60));
    if (P.rol) out.push('es ' + String(P.rol).slice(0, 80));
    if (P.proyectos) out.push('sus proyectos: ' + String(P.proyectos).slice(0, 200));
    const docs = (typeof ragDocs !== 'undefined' ? ragDocs : []).map(function(d){ return d && d.name; }).filter(Boolean).slice(0, 6);
    if (docs.length) out.push('documentos que cargó: ' + docs.join(', ').slice(0, 300));
    return out.join('; ');
  } catch(e){ return ''; }
}
/* ══ v40-1029 — LA REPREGUNTA SOBRE EL INFORME (hallazgo en vivo de Darío, 23/10) ══════════════════════════════
   En MODO ANALÍTICO: «investigá a fondo…» → informe. Después «DECIME LAS CONCLUSIONES» / «TE ESTOY PIDIENDO LAS
   CONCLUSIONES DE LA INVESTIGACIÓN A FONDO QUE HICISTE» → «No tengo acceso al texto completo…». CAUSA (verificada en el
   código): el informe viajaba solo como historial, y en el analista ajustarAlCupo suelta el historial ANTES que el
   material (guardarUltimos = 0): con dos documentos cargados, el RAG llenaba el cupo y el informe se iba primero.
   AHORA: si la pregunta es sobre el último informe (lo nombra, pide conclusiones/resumen, o es una repregunta corta con
   «eso/esas/y/pero» justo después), el informe va ADENTRO del material y ADELANTE: el recorte corta del final, así que
   lo que se pierde primero es la bibliografía, no el informe. Vale 4 idas y vueltas; después se suelta solo. */
/* verificador 29/10: la primera versión agarraba cualquier «resumen» o «análisis» («hacé un resumen de mis tareas» perdía las
   tareas). Ahora: conclusiones (con errores de tipeo), «el/tu/ese informe | investigación | análisis», «lo que investigaste»,
   «esas fuentes», o un «resumilo / ampliá eso / profundizá» pelado. */
const PIDE_INFORME_RE = /\bconclu(?:[sc]i[oó]n(?:es)?|[sc]iones|iste|[ií]s|[ií]ste)\b|\b(?:el|tu|ese|este|la|tu|esa|esta|del|de\s+la)\s+(?:informe|investigaci[oó]n|an[aá]lisis|investigacion)\b(?!\s+(?:sobre|acerca\s+de)\b)|\blo\s+que\s+(?:hiciste|encontraste|investigaste|le[ií]ste|analizaste)\b|\binvestigaste\b|\b(?:las|esas|tus)\s+fuentes\b|^\s*(?:hac[eé]me\s+un\s+|dame\s+un\s+)?(?:resumen|resum[ií](?:me)?(?:lo|la)?|s[ií]ntesis)\s*[.!?¿]*\s*$|^\s*(?:ampli[aá]|profundiz[aá]|desarroll[aá])(?:me)?(?:lo|la)?(?:\s+(?:eso|esto|m[aá]s|un\s+poco)\b[^\n]{0,40})?\s*[.!?]*\s*$/i; // v40-10292: «contame de la investigación SOBRE el cáncer» habla de otra cosa: no arrastra el informe
function informeVigente(text){
  try {
    if (!invUltimoInforme || !invUltimoInforme.texto || !invUltimoInforme.hLen) return '';
    // se cuenta desde la última vez que se usó («usado» se anota antes de que entre ese ida y vuelta: +2)
    let dist = history.length - Math.max(invUltimoInforme.hLen, invUltimoInforme.usado ? invUltimoInforme.usado + 2 : 0);
    if (dist < 0 && dist >= -2) dist = 0; // ese turno falló y no guardó la respuesta
    if (dist < 0 || dist > 8) return '';
    const t = String(text || '');
    const corta = t.split(/\s+/).filter(Boolean).length <= 14 && (/^\s*(?:y|pero|entonces|o\s+sea|che)\b/i.test(t) || /\b(?:eso|esto|esa|ese|esas|esos|aquello)\b/i.test(t));
    if (!PIDE_INFORME_RE.test(t) && !(corta && dist === 0)) return ''; // verificador: «¿y eso?» solo JUSTO después del informe (o de usarlo)
    return '=== TU ÚLTIMO ' + (invUltimoInforme.tipo === 'doc' ? 'ANÁLISIS DE DOCUMENTO' : 'INFORME DE INVESTIGACIÓN') + ' (lo escribiste VOS en esta charla; el usuario te pregunta por esto: contestá desde acá y NO digas que no lo tenés) ===\n'
      + 'Pedido: ' + String(invUltimoInforme.pregunta || '').slice(0, 300) + '\n' + cortarLimpio(String(invUltimoInforme.texto), (typeof mode !== 'undefined' && mode === 'mirror') ? 3200 : 7000) + '\n=== FIN DEL INFORME ===\n\n'; // verificador: en el espejo el cupo libre es chico (~1.800 tokens)
  } catch(e){ return ''; }
}
/* v40-1029: si piden conclusiones o un resumen y hay documentos cargados, la respuesta de siempre lee solo los pedazos que
   se parecen a la pregunta. Se ofrece, con un toque, leer el documento ENTERO (📄). No se corre solo: son varios pedidos. */
function ofrecerDocCompleto(text){
  try {
    if (typeof ragDocs === 'undefined' || !ragDocs.length) return false;
    const t = String(text || '');
    if (/\b(?:tareas?|pendientes?|agenda|recordatorios?|charla|conversaci[oó]n|memoria|recuerdos?|contactos?)\b/i.test(t)) return false; // verificador: «hacé un resumen de mis tareas» no es un documento
    const _conclu = /\bconclu(?:[sc]i[oó]n(?:es)?|[sc]iones)\b/i.test(t);
    const _pideDoc = /\b(?:resum[ií]\w*|resumen|s[ií]ntesis|de\s+qu[eé]\s+(?:trata|va)|qu[eé]\s+dice|ideas?\s+principales|tesis\s+central)/i.test(t) && /\b(?:documento|pdf|archivo|texto|tesis|paper|libro|apunte|proyecto|trabajo|cap[ií]tulo|informe)\b/i.test(t);
    if (!_conclu && !_pideDoc) return false;
    if (pedidoDocCompleto(t)) return false;
    const ult = document.querySelector('#chat .msg:last-child .bubble'); if (!ult) return false;
    const el = docElegir(t); if (!el.doc) return false;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'proc-chip proc-chip-btn';
    b.textContent = '📄 leer «' + String(el.doc.name).slice(0, 40) + '» entero y contestarte esto';
    b.onclick = function(){ if (busy) return; b.disabled = true; analizarDocCompleto({ resto: t, texto: t }, '📄 ' + t); };
    (ult.querySelector('.proc-chips') || ult).appendChild(b);
    return true;
  } catch(e){ return false; }
}
function nombreInv(){ return ((typeof CONFIG !== 'undefined' && CONFIG && CONFIG.appName) || 'MIRROR') + ' · ' + ((typeof PLATFORM_VERSION !== 'undefined' && PLATFORM_VERSION) || 'v40') + ((typeof APP_BUILD !== 'undefined') ? ' · build ' + APP_BUILD : ''); }

