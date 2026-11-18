
/* ══════════════════════════════════════════════════════════════════════════════════════════════
   v40 · PILARES 2 y 3 + ACTUALIZADOR (25/09/2026) — pedido de Darío: «que no quede en un juguete».
   ══════════════════════════════════════════════════════════════════════════════════════════════ */

/* ══ v40-comprende — PILAR 2: MEMORIA QUE ENTIENDE SIGNIFICADOS ══════════════════════════════
   POR QUÉ: la memoria y los documentos se buscaban SOLO por palabras (BM25). Si le contaste «mi
   perro se llama Tango» y después preguntás por «tu mascota», no lo encontraba: cero palabras en
   común. Para la tesis es peor: una entrevista que dice «los chicos se aburren» no aparece si
   buscás «desmotivación».
   CÓMO: un modelo chico de EMBEDDINGS (e5 multilingüe, licencia MIT, ~118 MB) corre DENTRO del
   navegador (Transformers.js, WebAssembly). Convierte cada recuerdo y cada fragmento en un vector
   de «significado» y la búsqueda FUSIONA palabras + significado (Reciprocal Rank Fusion). Además
   cruza idiomas: preguntás en español y encuentra el párrafo del paper en inglés.
   EL NORTE, UNO POR UNO:
     · gratis/libre: modelo MIT, librería Apache; se baja UNA vez de Hugging Face y queda en la
       caché del navegador.
     · soberanía: los textos NO salen del dispositivo para esto; los vectores viven en IndexedDB
       de este navegador (y se borran con un botón).
     · honestidad: es OPT-IN (pesa 118 MB, no se descarga sin que lo pidas) y el panel dice qué
       está haciendo y cuánto lleva. Si algo falla, todo sigue por palabras como siempre.
     · cupo: no gasta un solo token de Groq.
   SEGURO DE REGRESIÓN: bm25Search no cambia; solo DELEGA en la fusión cuando hay un vector de la
   pregunta ACTUAL (se arma al entrar a send() y se cierra al terminar de armar el contexto). En
   cualquier otro lado (informe, bancos, navegador sin la función) se comporta igual que siempre. */
const SEM_MODELO = 'Xenova/multilingual-e5-small';
const SEM_LIB_URLS = ['https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.0', 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.0/+esm'];
const SEM_MB = 118;
const SEM_LOTE = 8;
const SEM_UMBRAL = 0.80;         // e5 da cosenos altos de base: por debajo de esto no se considera «parecido»
const SEM_MARGEN = 0.06;         // y además tiene que estar cerca del mejor (evita colar recuerdos que no vienen al caso)
const SEM_ESPERA_MS = 1500;      // la pregunta nunca espera más que esto por su vector
try { document.addEventListener('input', function(ev){ try { if (ev && ev.target && ev.target.id === 'inp') _sem.ultTecla = Date.now(); } catch(_){} }, true); } catch(e){} // v40-pausa
var _sem = { on:false, estado:'apagado', extractor:null, vecs:new Map(), cargando:null, indexando:false, hechos:0, total:0, pct:0, q:null, err:'', enFusion:false, usada:0 };
function semOnGuardado(){ try { return localStorage.getItem('mirror_sem_on') === '1'; } catch(e){ return false; } }
function semListo(){ return !!(_sem.on && _sem.extractor && _sem.q && _sem.q.activo && (Date.now() - _sem.q.ts) < 60000); }
function _semHash(s){ s = String(s || ''); let h = 0x811c9dc5; for (let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36) + ':' + s.length; }
function _semCos(a, b){ let s = 0; const n = Math.min(a.length, b.length); for (let i = 0; i < n; i++) s += a[i] * b[i]; return s; }
function _semDB(){ return new Promise(function(ok, no){ try { const r = indexedDB.open('mirror_sem', 1); r.onupgradeneeded = function(){ r.result.createObjectStore('vec'); }; r.onsuccess = function(){ ok(r.result); }; r.onerror = function(){ no(r.error); }; } catch(e){ no(e); } }); }
async function _semCargarCache(){
  try { const db = await _semDB(); await new Promise(function(ok){ const rq = db.transaction('vec','readonly').objectStore('vec').openCursor();
    rq.onsuccess = function(){ const c = rq.result; if (c){ _sem.vecs.set(c.key, c.value); c.continue(); } else ok(); }; rq.onerror = function(){ ok(); }; }); } catch(e){}
}
async function _semGuardar(pares){ try { const db = await _semDB(); const st = db.transaction('vec','readwrite').objectStore('vec'); pares.forEach(function(p){ st.put(p[1], p[0]); }); } catch(e){} }
async function semBorrarAprendido(){ _sem.vecs = new Map(); try { indexedDB.deleteDatabase('mirror_sem'); } catch(e){} semPintar(); }
function semProgreso(e){ try { if (e && typeof e.progress === 'number' && (e.status === 'progress_total' || e.status === 'progress')){ _sem.pct = Math.min(100, Math.round(e.progress)); semPintar(); } } catch(_){} }
async function semCargar(){
  if (_sem.extractor) return true;
  if (_sem.cargando) return _sem.cargando;
  _sem.cargando = (async function(){
    _sem.estado = 'descargando'; _sem.err = ''; semPintar();
    let lib = null, ultimo = null;
    for (const u of SEM_LIB_URLS){ try { lib = await import(u); if (lib && lib.pipeline) break; } catch(e){ ultimo = e; lib = null; } }
    if (!lib || !lib.pipeline) throw (ultimo || new Error('no pude cargar la librería de Transformers.js'));
    try { if (lib.env){ lib.env.allowLocalModels = false; } } catch(e){}
    /* v40-audit2 (25/09/2026) — HALLAZGO EN VIVO: en la red de Darío huggingface.co responde SIN
       permiso CORS (el navegador lo bloquea: «Failed to fetch»), mientras jsDelivr anda perfecto.
       Plan B honesto: bajar el MISMO modelo a través de TU proxy de Cloudflare (ruta /hf, lista
       cerrada de modelos, ver WORKER_ruta_hf.md). Se recuerda qué camino anduvo. */
    const _viaProxy = function(){ try { return (typeof PROXY_URL === 'string' && PROXY_URL) ? PROXY_URL.replace(/\/+$/, '') + '/hf/' : ''; } catch(e){ return ''; } };
    const _abrir = function(){ return lib.pipeline('feature-extraction', SEM_MODELO, { dtype:'q8', device:'wasm', progress_callback: semProgreso }); };
    let _prefProxy = false; try { _prefProxy = localStorage.getItem('mirror_sem_via') === 'proxy'; } catch(e){}
    if (_prefProxy && _viaProxy()){ try { lib.env.remoteHost = _viaProxy(); } catch(e){} }
    try { _sem.extractor = await _abrir(); }
    catch(e1){
      const hf = _viaProxy();
      if (!hf || _prefProxy) throw new Error(_semMensajeRed(e1, !!hf));
      try { lib.env.remoteHost = hf; _sem.estado = 'descargando'; semPintar(); _sem.extractor = await _abrir(); try { localStorage.setItem('mirror_sem_via', 'proxy'); } catch(_){} }
      catch(e2){ throw new Error(_semMensajeRed(e2, true)); }
    }
    await _semCargarCache();
    _sem.estado = 'listo'; semPintar();
    return true;
  })().catch(function(e){
    _sem.estado = 'error'; _sem.err = String((e && e.message) || e).slice(0, 180); _sem.cargando = null;
    try { regError('comprende:carga', e); } catch(_){}
    semPintar(); return false;
  });
  return _sem.cargando;
}
function _semMensajeRed(e, probeProxy){
  const m = String((e && e.message) || e || '');
  // v40-audit3: el proxy EXISTE pero la ruta /hf no está bien puesta (405 = quedó después del «Usá POST»)
  if (probeProxy && /\((40[345])\)/.test(m) && /\/hf\//.test(m))
    return 'tu proxy respondió ' + (m.match(/\((40[345])\)/)||['',''])[1] + ': la ruta /hf todavía no está bien puesta en tu Worker (tiene que ir ARRIBA de la línea que dice «Usá POST» — ver WORKER_ruta_hf.md)';
  if (/fetch|network|cors|load failed/i.test(m))
    return probeProxy ? 'tu red no me deja bajar el modelo de Hugging Face, y tu proxy todavía no tiene la ruta /hf (la instrucción está en el LEEME, es pegar un bloque en tu Worker)'
                      : 'tu red no me deja bajar el modelo de Hugging Face, y sin proxy configurado no tengo otro camino';
  return m.slice(0, 160);
}
async function semEmbed(textos, prefijo){
  const out = await _sem.extractor(textos.map(function(t){ return prefijo + String(t || '').slice(0, 2000); }), { pooling:'mean', normalize:true });
  const arr = (out && typeof out.tolist === 'function') ? out.tolist() : out;
  return arr.map(function(v){ return Float32Array.from(v); });
}
function _semChunks(){
  const a = [];
  try { (recuerdosChunks || []).forEach(function(c){ if (c && c.text && !c.arch) a.push(c); }); } catch(e){}
  try { (ragChunks || []).forEach(function(c){ if (c && c.text) a.push(c); }); } catch(e){}
  return a;
}
async function semIndexar(){
  if (_sem.indexando || !_sem.extractor || !_sem.on) return;
  _sem.indexando = true;
  try {
    const todos = _semChunks();
    const pend = todos.filter(function(c){ return !_sem.vecs.has(_semHash(c.text)); });
    _sem.total = todos.length; _sem.hechos = todos.length - pend.length; semPintar();
    for (let i = 0; i < pend.length; i += SEM_LOTE){
      if (!_sem.on) break;
      /* v40-pausa (2/10, en vivo: «anda como lenta»): aprender corre en el mismo hilo que la app. Mientras escribís o
         mientras espera una respuesta, se hace a un lado y sigue después (hasta 20 s; después aprende igual, despacio). */
      for (let w = 0; w < 40 && ((typeof busy !== 'undefined' && busy) || (Date.now() - (_sem.ultTecla || 0) < 2500)); w++){ await new Promise(function(r){ setTimeout(r, 500); }); }
      const lote = pend.slice(i, i + SEM_LOTE);
      const vs = await semEmbed(lote.map(function(c){ return c.text; }), 'passage: ');
      const pares = lote.map(function(c, j){ return [_semHash(c.text), vs[j]]; });
      pares.forEach(function(p){ _sem.vecs.set(p[0], p[1]); });
      await _semGuardar(pares);
      _sem.hechos += lote.length; semPintar();
      await new Promise(function(r){ setTimeout(r, 30); });   // respiro: la app sigue fluida mientras aprende
    }
  } catch(e){ try { regError('comprende:indexar', e); } catch(_){} }
  finally { _sem.indexando = false; semPintar(); }
}
/* Se llama al entrar a send(): arma el vector de la pregunta (con tope de espera) y lo deja
   ACTIVO solo para este turno. */
async function semPrepararConsulta(text){
  _sem.q = null;
  if (!_sem.on || !_sem.extractor || !text) return;
  try {
    const v = await Promise.race([
      semEmbed([text], 'query: ').then(function(a){ return a[0]; }),
      new Promise(function(r){ setTimeout(function(){ r(null); }, SEM_ESPERA_MS); })
    ]);
    if (v) _sem.q = { vec: v, ts: Date.now(), activo: true };
  } catch(e){ try { regError('comprende:consulta', e); } catch(_){} }
  try { setTimeout(semIndexar, 2500); } catch(e){}   // lo nuevo (un recuerdo, un documento) se aprende después
}
function semCerrarConsulta(){ try { if (_sem.q) _sem.q.activo = false; } catch(e){} }
/* Palabras + significado → un solo ranking (RRF, k=60). Devuelve null si no hay con qué fusionar
   (entonces bm25Search sigue solo, como siempre). */
function semFusionar(query, chunks, topK, rec){
  if (!semListo() || !chunks || !chunks.length) return null;
  const q = _sem.q.vec, cand = [];
  for (const c of chunks){ const v = c && c.text ? _sem.vecs.get(_semHash(c.text)) : null; if (v) cand.push({ c: c, s: _semCos(q, v) }); }
  if (!cand.length) return null;
  const k = Math.max(topK * 4, 12);
  let lex = [];
  _sem.enFusion = true;
  try { lex = bm25Search(query, chunks, k, rec); } finally { _sem.enFusion = false; }
  cand.sort(function(a, b){ return b.s - a.s; });
  const mejor = cand[0].s;
  const sem = cand.filter(function(x){ return x.s >= SEM_UMBRAL && x.s >= mejor - SEM_MARGEN; }).slice(0, k);
  const pts = new Map();
  lex.forEach(function(c, i){ pts.set(c, (pts.get(c) || 0) + 1 / (60 + i)); });
  sem.forEach(function(x, i){ pts.set(x.c, (pts.get(x.c) || 0) + 1 / (60 + i)); });
  if (sem.some(function(x){ return lex.indexOf(x.c) < 0; })) _sem.usada++;
  return Array.from(pts.entries()).sort(function(a, b){ return b[1] - a[1]; }).slice(0, topK).map(function(e){ return e[0]; });
}
function semEstadoTexto(){
  const e = _sem.estado;
  if (!_sem.on) return 'Apagada. ' + ((typeof CONFIG!=='undefined' && CONFIG && CONFIG.appName) ? CONFIG.appName : 'Tu MIRROR') + ' busca por palabras, como siempre.'; // v40-marca
  if (e === 'descargando') return 'Preparando el modelo en tu navegador' + (_sem.pct ? ' — ' + _sem.pct + '%' : '…') + ' (la primera vez baja ~' + SEM_MB + ' MB; después queda guardado).';
  if (e === 'error') return '⚠ No pude prepararla: ' + (_sem.err || 'error desconocido') + '. Todo sigue andando por palabras, como siempre.';
  if (e === 'listo'){
    const t = _sem.total || _semChunks().length;
    const h = Math.min(_sem.hechos || _sem.vecs.size, t);
    return (_sem.indexando ? '🧠 Aprendiendo tus recuerdos y documentos: ' : '🧠 Activa. Entiende ') + h + ' de ' + t + ' fragmentos'
      + (_sem.indexando ? '… (la app se puede usar mientras tanto)' : '.') + (_sem.usada ? ' Ya encontró ' + _sem.usada + ' vez/veces algo que por palabras no aparecía.' : '');
  }
  return 'Encendida: preparando…';
}
function semPintar(){
  try { const s = document.getElementById('sem-estado'); if (s) s.textContent = semEstadoTexto(); } catch(e){}
  try { const b = document.getElementById('sem-toggle'); if (b) b.textContent = _sem.on ? 'Apagar' : ('Activar (baja ~' + SEM_MB + ' MB una sola vez)'); } catch(e){}
  try { const p = document.querySelector('[data-pie="comprende"]'); if (p) p.textContent = _sem.on ? (_sem.estado === 'listo' ? '🧠 entiende ✓' : '🧠 entiende…') : '🧠 memoria que entiende'; } catch(e){}
}
async function semActivar(on){
  _sem.on = !!on;
  try { localStorage.setItem('mirror_sem_on', on ? '1' : '0'); } catch(e){}
  semPintar();
  if (on){ const ok = await semCargar(); if (ok) semIndexar(); }
}
function semAbrir(){
  try {
    let m = document.getElementById('sem-modal');
    if (!m){
      m = document.createElement('div'); m.id = 'sem-modal'; m.className = 'v40-modal';
      m.innerHTML = '<div class="v40-caja"><div class="v40-tit">🧠 Memoria que entiende</div>'
        + '<div class="v40-txt">Hoy tu MIRROR encuentra recuerdos y documentos por <b>palabras</b>. Con esto los encuentra también por <b>significado</b>: si le contaste de «Tango, mi perro» y preguntás por «tu mascota», lo encuentra; si preguntás en español, encuentra el párrafo del paper en inglés.</div>'
        + '<div class="v40-txt">Corre <b>dentro de tu dispositivo</b>: el modelo (e5 multilingüe, libre, ~' + SEM_MB + ' MB) se baja <b>una sola vez</b> y queda guardado en este navegador. Tus textos no salen de acá para esto y no gasta tu cupo de IA. En compus viejas o celulares la primera preparación puede tardar unos minutos.</div>'
        + '<div class="v40-estado" id="sem-estado"></div>'
        + '<div class="v40-bots"><button class="v40-btn prim" id="sem-toggle" onclick="semActivar(!_sem.on)"></button>'
        + '<button class="v40-btn" onclick="if(confirm(\'¿Borro lo que aprendió? Tus recuerdos NO se tocan; solo se vuelve a aprender.\')) semBorrarAprendido()">Borrar lo aprendido</button>'
        + '<button class="v40-btn" onclick="document.getElementById(\'sem-modal\').remove()">Cerrar</button></div></div>';
      document.body.appendChild(m);
    }
    semPintar();
  } catch(e){ try { regError('comprende:panel', e); } catch(_){} }
}
// al abrir: si ya estaba encendida, se prepara sola desde la caché (sin volver a bajar nada) y sin apurar el arranque
try { if (semOnGuardado()){ _sem.on = true; setTimeout(function(){ semCargar().then(function(ok){ if (ok) semIndexar(); }); }, 5000); } } catch(e){}

/* ══ v40-acompana — PILAR 3: QUE CUALQUIERA LA PUEDA USAR ════════════════════════════════════
   Tres piezas, las tres locales y sin tokens extra:
   (1) 🎧 CHARLA POR VOZ, MANOS LIBRES: hablás, te contesta en voz alta y vuelve a escucharte
       sola. Para quien maneja, cocina, no ve bien o no se lleva con el teclado. Se corta
       diciendo «terminamos» (o «chau», «basta») o tocando el botón; si no escucha nada dos
       veces seguidas, se apaga sola (no queda el micrófono abierto).
   (2) Aa MODO FÁCIL: letra grande, botones grandes, solo lo esencial a la vista. Se recuerda
       en este navegador.
   (3) 📷 FOTO Y RESUELVO: foto de una factura, un turno o una receta + «agendame el
       vencimiento» → la visión LEE la foto y el agente (ACTÚA 2.0) deja la tarea y la tarjeta.
       Lo leído entra como DATO, nunca como orden; y un número de teléfono leído de una foto NO
       se usa para WhatsApp/llamar (puede estar mal leído): hay que dictarlo. */
let charlaOn = false, charlaRec = null, charlaSilencios = 0, charlaWatch = null, charlaTTSPrevio = null;
const CHARLA_FIN_RE = /^\s*(terminamos|termin[aá]|chau|basta|listo,?\s*gracias|cort[aá]|ya\s+est[aá])\b/i;
function charlaSoporte(){ try { return !!(window.SpeechRecognition || window.webkitSpeechRecognition) && !!window.speechSynthesis; } catch(e){ return false; } }
function charlaUI(){
  try { const b = document.getElementById('charlabtn'); if (b){ b.classList.toggle('acc', charlaOn); const l = b.querySelector('.lbl'); if (l) l.textContent = charlaOn ? 'terminar la charla' : 'charla por voz'; } } catch(e){}
  try { const f = document.getElementById('facil-hablar'); if (f) f.textContent = charlaOn ? '⏹ terminar la charla' : '🎧 hablame'; } catch(e){}
}
function charlaIniciar(){
  if (charlaOn){ charlaTerminar('Listo, cortamos la charla por voz.'); return; }
  if (!charlaSoporte()){ addMsg('mirror', 'Para charlar por voz necesito el dictado y la voz del navegador, y este no los tiene. Probá con Chrome o Edge — o escribime, que es lo mismo.'); return; }
  try { if (typeof cerrarTools === 'function') cerrarTools(); } catch(e){}
  charlaOn = true; charlaSilencios = 0;
  charlaTTSPrevio = ttsOn;
  try { if (!ttsOn && typeof toggleTTS === 'function') toggleTTS(); } catch(e){}
  charlaUI();
  addMsg('mirror', '🎧 Charla por voz: hablame tranquilo, con tus pausas; cuando hagas silencio un par de segundos te contesto en voz alta y vuelvo a escucharte. Para cortar decí «terminamos» o tocá el botón. (El dictado lo transcribe tu navegador' + ((typeof vozLocal !== 'undefined' && vozLocal) ? ', acá adentro 🔒' : '') + '.)');
  if (charlaWatch) clearInterval(charlaWatch);
  charlaWatch = setInterval(charlaTic, 500);
}
function charlaTerminar(msg){
  charlaOn = false; charlaBuffer = ''; charlaUltVoz = 0; charlaInicioTurno = 0;   // v40-pausa-voz
  try { if (charlaRec) charlaRec.abort(); } catch(e){}
  charlaRec = null;
  if (charlaWatch){ clearInterval(charlaWatch); charlaWatch = null; }
  try { if (charlaTTSPrevio === false && ttsOn && typeof toggleTTS === 'function') toggleTTS(); } catch(e){}
  charlaUI();
  if (msg) addMsg('mirror', msg);
}
let charlaQuietoDesde = 0;
/* Vuelve a escuchar recién cuando hubo ~0,8 s de SILENCIO real (ni pensando ni hablando). Sin
   esto, en el hueco de 60 ms antes de que arranque la voz se abría el micrófono y la entidad
   se escuchaba a sí misma. */
function charlaTic(){
  if (!charlaOn || charlaRec) return;
  let ocupado = false;
  try { if (busy) ocupado = true; } catch(e){}
  try { if (window.speechSynthesis && (speechSynthesis.speaking || speechSynthesis.pending)) ocupado = true; } catch(e){}
  if (ocupado){ charlaQuietoDesde = 0; return; }
  if (!charlaQuietoDesde){ charlaQuietoDesde = Date.now(); return; }
  if (Date.now() - charlaQuietoDesde < 800) return;
  charlaQuietoDesde = 0;
  charlaEscuchar();
}
/* ══ v40-pausa-voz (3/10/2026, en vivo: «¿por qué se corta tan rápido cada vez que estoy hablando? es como que hay un cupo
   para charlar») ══ El reconocedor se abría en modo NO continuo: el navegador lo cierra en la primera pausa corta (~1 s) y la
   app mandaba ese pedazo. Quien habla pensando (o un docente que explica) queda cortado a la mitad, y la entidad contesta
   solo lo último que escuchó. AHORA: se escucha en continuo (en Android, que repite resultados en continuo, se reabre solo y
   se pega sin duplicar) y se manda recién cuando hubo CHARLA_PAUSA_MS de silencio después de hablar. Si el navegador corta
   antes, se vuelve a abrir y se sigue sumando. Tope: CHARLA_MAX_MS por intervención (no queda el micrófono abierto). */
const CHARLA_PAUSA_MS = 2200;
const CHARLA_MAX_MS = 90000;
let charlaBuffer = '', charlaUltVoz = 0, charlaInicioTurno = 0;
function charlaFusionar(base, nuevo){
  nuevo = String(nuevo || '').trim(); if (!nuevo) return String(base || '').trim();
  const b = String(base || '').trim(); if (!b) return nuevo;
  const bl = b.toLowerCase(), nl = nuevo.toLowerCase();
  if (bl.endsWith(nl)) return b;
  if (nl.startsWith(bl)) return nuevo;                                   // Android: vuelve a mandar lo acumulado + lo nuevo
  for (let k = Math.min(bl.length, nl.length); k > 3; k--){ if (bl.slice(-k) === nl.slice(0, k)) return b + nuevo.slice(k); }
  return b + ' ' + nuevo;
}
function charlaEscuchar(){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR || !charlaOn) return;
  const r = new SR(); charlaRec = r;
  r.lang = (typeof i18nRecLang === 'function') ? i18nRecLang() : 'es-AR';
  try { if (typeof vozLocal !== 'undefined' && vozLocal) r.processLocally = true; } catch(e){}
  const esAndroidCh = /android/i.test((navigator && navigator.userAgent) || '');
  r.continuous = !esAndroidCh; r.interimResults = true;
  if (!charlaInicioTurno) charlaInicioTurno = Date.now();
  let sesion = '';
  const inp = document.getElementById('inp');
  const pintar = function(){ try { if (inp){ inp.value = charlaFusionar(charlaBuffer, sesion); aresize(inp); } } catch(e){} };
  r.onresult = function(ev){
    let fin = '', inter = '';
    for (let i = 0; i < ev.results.length; i++){ const x = ev.results[i]; if (x.isFinal) fin += x[0].transcript; else inter += x[0].transcript; }
    const t = (fin + ' ' + inter).replace(/\s+/g, ' ').trim();
    if (t){ sesion = t; charlaUltVoz = Date.now(); pintar(); }
  };
  r.onerror = function(ev){
    if (ev && ev.error === 'not-allowed'){ charlaTerminar('El navegador no me deja usar el micrófono. Dale permiso (el candado junto a la dirección → Micrófono → Permitir) y volvemos a charlar.'); }
    // v40-mic: sin micrófono o sin red, antes terminaba en «No te escuché más» (como si no hubieras hablado)
    else if (ev && ev.error === 'audio-capture'){ charlaTerminar('No encuentro un micrófono que funcione (no hay, está desconectado o lo usa otro programa), así que corté la charla por voz. Revisalo y la retomamos.'); }
    else if (ev && ev.error === 'network'){ charlaTerminar('El dictado de tu navegador necesita internet y la conexión falló, así que corté la charla por voz. Cuando vuelva la red, la retomamos.'); }
  };
  // vigía de la pausa: con el navegador escuchando en continuo, la que decide cuándo terminaste de hablar es la app
  const vigia = setInterval(function(){
    try {
      if (charlaRec !== r){ clearInterval(vigia); return; }
      const hayAlgo = !!(sesion || charlaBuffer);
      if (hayAlgo && charlaUltVoz && (Date.now() - charlaUltVoz) >= CHARLA_PAUSA_MS) { clearInterval(vigia); r.stop(); }
      else if (Date.now() - charlaInicioTurno > CHARLA_MAX_MS) { clearInterval(vigia); r.stop(); }
    } catch(e){}
  }, 250);
  r.onend = function(){
    try { clearInterval(vigia); } catch(e){}
    charlaRec = null;
    if (!charlaOn) return;
    charlaBuffer = charlaFusionar(charlaBuffer, sesion);
    const t = String(charlaBuffer || '').trim();
    if (!t){ charlaInicioTurno = 0; charlaSilencios++; if (charlaSilencios >= 2) charlaTerminar('No te escuché más, así que corté la charla por voz para no dejar el micrófono abierto. Cuando quieras, la retomamos.'); return; }
    charlaSilencios = 0;
    // el navegador cortó en una pausa CORTA (o hubo voz hace instantes): se vuelve a abrir y se sigue sumando
    const pausa = Date.now() - (charlaUltVoz || 0);
    if (pausa < CHARLA_PAUSA_MS && (Date.now() - charlaInicioTurno) < CHARLA_MAX_MS){ setTimeout(function(){ if (charlaOn && !charlaRec) charlaEscuchar(); }, 60); return; }
    charlaBuffer = ''; charlaUltVoz = 0; charlaInicioTurno = 0;
    if (CHARLA_FIN_RE.test(t)){ try { if (inp){ inp.value = ''; aresize(inp); } } catch(e){} charlaTerminar('Listo, cortamos la charla por voz. ¡Hasta la próxima!'); return; }
    try { if (inp) inp.value = t; send(); } catch(e){ try { regError('charla:send', e); } catch(_){} }
  };
  try { r.start(); } catch(e){ charlaRec = null; }
}

const FACIL_CLASE = 'modo-facil';
function facilActivo(){ try { return localStorage.getItem('mirror_facil') === '1'; } catch(e){ return false; } }
function facilAplicar(on){
  try { document.body.classList.toggle(FACIL_CLASE, !!on); } catch(e){}
  try { const p = document.querySelector('[data-pie="facil"]'); if (p) p.textContent = on ? 'Aa salir del modo fácil' : 'Aa modo fácil'; } catch(e){}
  try {
    let caja = document.getElementById('facil-caja');
    if (on && !caja){
      caja = document.createElement('div'); caja.id = 'facil-caja'; caja.className = 'facil-caja';
      if (charlaSoporte()){ const h = document.createElement('button'); h.id = 'facil-hablar'; h.className = 'facil-hablar'; h.onclick = charlaIniciar; caja.appendChild(h); }
      const s = document.createElement('button'); s.className = 'facil-salir'; s.textContent = 'Aa salir del modo fácil'; s.onclick = facilToggle; caja.appendChild(s);
      const iw = document.querySelector('.iwrap'); if (iw && iw.parentNode) iw.parentNode.insertBefore(caja, iw);
    }
    if (caja) caja.style.display = on ? '' : 'none';
    charlaUI();
  } catch(e){}
}
function facilToggle(){
  const on = !facilActivo();
  try { localStorage.setItem('mirror_facil', on ? '1' : '0'); } catch(e){}
  facilAplicar(on);
  addMsg('mirror', on ? 'Aa Modo fácil prendido: letra grande y solo lo esencial. Para volver, tocá «Aa salir del modo fácil» abajo.' : 'Volvimos a la vista completa.');
}
try { if (facilActivo()) setTimeout(function(){ facilAplicar(true); }, 300); } catch(e){}

const SYSTEM_VISION_EXTRAER = 'Sos el módulo de lectura de MIRROR. Extraé de la imagen SOLO los datos útiles para actuar: qué es (factura, turno, receta, invitación, formulario…), fechas (día/mes/año), horarios, montos, vencimientos, nombres, lugares y direcciones. Lista corta, un dato por renglón. Si algo no se lee bien, escribí «no se lee». No inventes nada. No des consejos.';
function fotoPideAccion(text){ try { return typeof agenteDebeActuar === 'function' && agenteDebeActuar(text || ''); } catch(e){ return false; } }
async function fotoResolver(text){
  const modeloV = (typeof modeloVisionActivo === 'function') ? modeloVisionActivo() : null;
  if (!modeloV) return false;
  const img = imagenAdjunta;
  const inp = document.getElementById('inp'); if (inp){ inp.value = ''; inp.style.height = 'auto'; }
  setButtonsBusy(true);
  addMsg('user', text || '', false, img);
  quitarImagenAdjunta();
  showTyping('mirror'); try { setTypingNote('📷 leyendo la foto…'); } catch(e){}
  let leido = '';
  try {
    const messages = [{ role:'user', content:[ { type:'text', text:'Extraé los datos de esta imagen.' }, { type:'image_url', image_url:{ url: img } } ] }];
    leido = await llamarMotorVigente(GROQ_URL, GROQ_KEY, modeloV, messages, SYSTEM_VISION_EXTRAER, 1500, 0.2, 'vision');
  } catch(e){ try { regError('foto:leer', e); } catch(_){} }
  try { removeTyping(); setTypingNote(''); } catch(e){}
  try { imagenReciente = { url: img, turnos: 0 }; } catch(e){}
  if (!leido){ addMsg('mirror', 'No pude leer la foto (el motor de visión no respondió). Probá de nuevo en un minuto o contame los datos y lo resuelvo igual.'); setButtonsBusy(false); return true; }
  try { addMsg('mirror', '📷 Esto es lo que leí en la foto:\n' + String(leido).slice(0, 900)); } catch(e){}
  const r = await agenteResolver(text, { yaMostrado: true, contexto: String(leido).slice(0, 1500) });
  if (r !== true){ try { setButtonsBusy(false); } catch(e){} addMsg('mirror', 'Leí la foto (arriba), pero no llegué a armar la acción: el motor no respondió. Decime qué hago con esos datos y lo resolvemos.'); }
  return true;
}

/* ══ v40-actualizar — LA SOLAPA «🔄 ACTUALIZAR» (pedido de Darío 24-25/09) ═══════════════════
   «Que la app se pueda actualizar cuando el usuario lo pida, como todas las apps.» La app ya
   traía lo nuevo al recargar (service worker network-first), pero nadie se enteraba. Ahora:
     · cada versión lleva su número de BUILD y sus NOVEDADES en criollo (acá abajo);
     · al abrir y cada 6 h mira si la publicada es más nueva (pide la página sin caché y lee su
       build: no hace falta ningún archivo extra en el deploy) y, si hay, avisa con un cartel;
     · la solapa «🔄 actualizar» del pie muestra la versión, lo nuevo y «buscar ahora».
   Actualizar = recargar con lo nuevo. La configuración, la memoria, los contactos y las tareas
   NO se tocan: no viven en el código. Nunca recarga sola ni a mitad de una respuesta. */
const APP_BUILD = '2026-11-18.1';
const APP_NOVEDADES = ["✦ Generación v40: tu MIRROR actúa en varios pasos, entiende por significado, te acompaña por voz y se actualiza solo.", "🧩 Las piezas, de verdad aunque preguntes todo junto: si me preguntás varias cosas en un mensaje («¿qué versión sos? ¿qué piezas tenés?»), la lista de mis piezas la saca la app de sus fichas — antes, en ese caso, la inventaba el modelo y confundía piezas con modos. «Piezas de ajedrez» o «del auto» siguen siendo charla normal.", "🧩 Ya sé de qué estoy hecha: preguntame «¿qué piezas tenés?» y te muestro mis piezas reales (salen de sus fichas, no de mi memoria). Las que se pueden dormir las dormís o despertás vos: «dormí la pieza de agenda» / «despertá la pieza de agenda». Y cuando te digo mi versión, ya no le agrego mejoras que no traje.", "📇 Tu agenda, contestada por la app: «¿me pasás el mail de Laura?» o «la tenés en contactos» te dan el dato al toque, con la tarjeta lista para escribirle, llamarla o ir. Si hay dos Lauras te pregunto cuál, y si no la tengo te lo digo de frente. El dato no le llega al modelo ni queda en la charla guardada. Y un código como «TARS-2» ya no se cambia por el nombre de tu modo.", "🧭 Seguís la charla sobre tu investigación: después de un 🔎 o un 📄, «decime las conclusiones» contesta desde ESA investigación o ese análisis (antes los perdía; vale mientras no recargues la página). Si la web no aportó nada, te lo digo arriba de todo, y si tenés documentos cargados te ofrezco leer el documento entero. Y te hablo con los nombres de TUS modos, no con los de fábrica. En una investigación sobre una persona o tu proyecto, ya no se busca la pregunta suelta (traía homónimos): van las búsquedas con contexto.", "🔎 Investigación a fondo: escribí «investigá a fondo …» (o tocá «+» → 🔎). Arma un plan, busca en varias fuentes, cruza con tus documentos y te escribe una síntesis con citas que podés verificar, y la lista de fuentes la pone la app (no se puede inventar). Gratis, con tu proxy.", "📄 Documentos largos, leídos enteros: «analizá el documento completo y decime…» lo recorre por partes (no solo los pedazos que se parecen a tu pregunta), te contesta citando la parte [P3] de cada cosa y te deja bajar el análisis.", "🕶 Tu memoria, más en tus manos: el chip «◈ memoria» te muestra qué recuerdos usé en cada respuesta y podés olvidarlos ahí mismo; con ✎ corregís un recuerdo; y la «🕶 charla temporal» no guarda nada ni usa tus recuerdos. Y si el motor de IA se cuelga, paso solo al de respaldo y te digo por qué.", "🛡 Revisión a fondo de octubre: tu MIRROR cambia de modo cuando le decís su nombre («pasá al modo analítico»); la hora y la versión salen exactas aunque lo escribas rápido o con errores; si no hay internet o el motor de IA se cae, te lo dice tal cual en vez de mandarte a revisar tu configuración; «borrar memoria» te dice exactamente qué borró; en el celular todo el pie se puede tocar y la bandeja «+» se cierra al mandar, con Esc o tocando afuera; y cuando dice «guardado», es porque de verdad se guardó.", "🎧 La charla por voz ya no te corta a la mitad: te deja hacer pausas y contesta cuando terminás de hablar. Y tu MIRROR contesta con datos fijos, sin inventar, quién es, qué versión es, qué hora es, dónde está lo tuyo, qué es el chip «↺ respaldo» y cómo se usan el modo fácil, la charla por voz y la memoria que entiende; ya no niega lo que sí tiene. Y lo hace directo: «buscá en internet…», «dibujame…», «activá el modo fácil» o «buscá a Juan en mis contactos». Y si la búsqueda 🌐 falla, te dice por qué.", "🔧 Pulido de octubre: el motor principal espera unos segundos antes de pasarle la posta al respaldo; cuando contesta el respaldo lo ves con el chip «↺ respaldo» y se cuida más de no inventar; tu MIRROR ya contesta bien «¿qué sabés hacer?», «¿tenés límites?» y «¿dónde guardás lo mío?»; y al agendar, la fecha va al calendario y no se repite en el título (se entiende aunque escribas «15 de dic» o te comas una letra). Lo que es un dato de la app (dónde está lo tuyo, cuál es el motor de respaldo, otras versiones) lo contesta la app misma, sin inventos, aunque lo preguntes todo junto. La letra ya no salta de chica a grande mientras contesta, y la memoria que entiende aprende cuando no la estás usando.", "🔧 Arreglos de la auditoría: tu MIRROR ya sabe qué trae su versión y que se actualiza (antes lo inventaba, y hasta se lo acordaba mal: ahora la verdad le gana a la memoria); ninguna ventana queda sin salida (✕, Esc o tocando afuera); si una voz no suena, sigue con otra de tu compu y te avisa; «¿cómo estás? ¿cuál es tu modelo?» contesta las dos cosas; y si agendás una fecha que ya pasó, te lo advierte.", "🧭 Tu MIRROR ahora actúa en varios pasos: «avisale a Juan que no llego y anotame reprogramar» — busca, prepara y te deja las tarjetas; el último toque es tuyo.", "🧠 Memoria que entiende (opcional): encuentra por significado, no solo por palabras. Corre en tu dispositivo.", "🎧 Charla por voz manos libres y Aa modo fácil, para usarla sin teclado.", "📷 Foto y resuelvo: foto de una factura o un turno + «agendame el vencimiento».", "🔄 Esta solapa: te avisa cuando hay una versión nueva."];
const ACT_CADA_MS = 6 * 60 * 60 * 1000;
let _actUltimo = null;
function _actCompara(a, b){ a = String(a || ''); b = String(b || ''); return a === b ? 0 : (a > b ? 1 : -1); }   // «AAAA-MM-DD.n» ordena como texto
function actLeerBuild(html){ const m = /const APP_BUILD = '([^']+)'/.exec(String(html || '')); return m ? m[1] : ''; }
function actLeerNovedades(html){ try { const m = /const APP_NOVEDADES = (\[[^\n]*\]);/.exec(String(html || '')); return m ? JSON.parse(m[1]) : []; } catch(e){ return []; } }
async function actBuscar(manual){
  const est = document.getElementById('act-estado');
  const decir = function(t){ try { if (est) est.textContent = t; } catch(e){} };
  try {
    if (/^file:/i.test(location.protocol)){ decir('Estás abriendo la app desde un archivo de tu compu: desde acá no puedo buscar actualizaciones. En la app publicada, sí.'); return null; }
    if (typeof navigator !== 'undefined' && navigator.onLine === false){ decir('Sin conexión: cuando vuelva la red, busco.'); return null; }
    /* La búsqueda automática baja la página entera (~800 KB): como mucho una vez cada 6 h, aunque
       abras la app diez veces (cuida los datos del celu). A mano, siempre. */
    if (!manual){ try { const u = Number(localStorage.getItem('mirror_act_ultimo') || 0); if (Date.now() - u < ACT_CADA_MS) return null; } catch(e){} }
    decir('Buscando…');
    const url = location.href.split('#')[0].split('?')[0] + '?act=' + Date.now();
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const html = await res.text();
    const remoto = actLeerBuild(html);
    _actUltimo = Date.now();
    try { localStorage.setItem('mirror_act_ultimo', String(_actUltimo)); } catch(e){}
    if (!remoto){ decir('No pude leer la versión publicada. Probá más tarde.'); return null; }
    if (_actCompara(remoto, APP_BUILD) > 0){
      const nov = actLeerNovedades(html);
      decir('✦ Hay una versión nueva (' + remoto + ').');
      actCartel(remoto, nov, manual);
      return remoto;
    }
    decir('Estás al día ✅ — versión ' + (typeof PLATFORM_VERSION !== 'undefined' ? PLATFORM_VERSION + ' · ' : '') + 'build ' + APP_BUILD + '.');
    return '';
  } catch(e){
    try { regError('actualizar', e); } catch(_){}
    decir('No pude buscar ahora (' + String((e && e.message) || e).slice(0, 60) + '). Probá en un rato.');
    return null;
  }
}
/* v40-novnombre (3/10): las novedades decían «tu MIRROR» también en instalaciones con nombre propio. En pantalla, si la
   entidad tiene nombre (p. ej. «MANIFIESTOS»), se usa ese nombre. El texto guardado no cambia (la app lo compara entre versiones). */
function novNombre(t){
  try {
    const app = String((typeof CONFIG !== 'undefined' && CONFIG && CONFIG.appName) || '').trim();
    if (!app || /^mirror$/i.test(app)) return String(t);
    return String(t).replace(/\b([Tt])u MIRROR\b/g, function(_, T){ return app; });
  } catch(e){ return String(t); }
}
function actCartel(remoto, nov, manual){
  try {
    if (!manual){
      const p = JSON.parse(localStorage.getItem('mirror_act_pospuesto') || 'null');
      if (p && p.b === remoto && (Date.now() - p.t) < 24 * 3600 * 1000) return;   // «más tarde» se respeta un día
    }
  } catch(e){}
  try {
    let c = document.getElementById('act-cartel'); if (c) c.remove();
    c = document.createElement('div'); c.id = 'act-cartel'; c.className = 'act-cartel';
    const lista = (nov || []).slice(0, 5).map(function(n){ return '<li>' + actuaEsc(novNombre(n)) + '</li>'; }).join('');
    c.innerHTML = '<div class="act-tit">✦ Hay una versión nueva de ' + ((typeof CONFIG!=='undefined' && CONFIG && CONFIG.appName && CONFIG.appName !== 'MIRROR') ? memEsc(CONFIG.appName) : 'tu MIRROR') + '</div>'
      + (lista ? '<ul class="act-nov">' + lista + '</ul>' : '')
      + '<div class="act-nota">Actualizar no toca tu configuración, tu memoria, tus contactos ni tus tareas.</div>'
      + '<div class="act-bots"><button class="v40-btn prim" onclick="actAplicar()">Actualizar ahora</button><button class="v40-btn" onclick="actPosponer(\'' + actuaEsc(remoto) + '\')">Más tarde</button></div>';
    document.body.appendChild(c);
  } catch(e){ try { regError('actualizar:cartel', e); } catch(_){} }
}
function actPosponer(b){ try { localStorage.setItem('mirror_act_pospuesto', JSON.stringify({ b: b, t: Date.now() })); } catch(e){} try { const c = document.getElementById('act-cartel'); if (c) c.remove(); } catch(e){} }
async function actAplicar(){
  try { if (busy){ addMsg('mirror', 'Termino esta respuesta y actualizo — tocá «Actualizar ahora» de nuevo en un segundito.'); return; } } catch(e){}
  try { if (navigator.serviceWorker){ const r = await navigator.serviceWorker.getRegistration(); if (r) await r.update(); } } catch(e){}
  try { sessionStorage.setItem('mirror_sesion_entro', '1'); } catch(e){}   // que vuelva directo a la app, no a la puerta del constructor
  location.reload();
}
function actAbrir(){
  try {
    let m = document.getElementById('act-modal');
    if (!m){
      m = document.createElement('div'); m.id = 'act-modal'; m.className = 'v40-modal';
      const nov = APP_NOVEDADES.map(function(n){ return '<li>' + actuaEsc(novNombre(n)) + '</li>'; }).join('');
      m.innerHTML = '<div class="v40-caja"><div class="v40-tit">🔄 Actualizaciones</div>'
        + '<div class="v40-txt">Estás usando la versión <b>' + actuaEsc(typeof PLATFORM_VERSION !== 'undefined' ? PLATFORM_VERSION : '') + '</b> · build <b>' + actuaEsc(APP_BUILD) + '</b>.</div>'
        + '<div class="v40-txt">Lo nuevo de esta versión:</div><ul class="act-nov">' + nov + '</ul>'
        + '<div class="v40-estado" id="act-estado"></div>'
        + '<div class="v40-bots"><button class="v40-btn prim" onclick="actBuscar(true)">Buscar actualizaciones ahora</button>'
        + '<button class="v40-btn" onclick="document.getElementById(\'act-modal\').remove()">Cerrar</button></div></div>';
      document.body.appendChild(m);
    }
  } catch(e){ try { regError('actualizar:panel', e); } catch(_){} }
}
try {
  setTimeout(function(){ actBuscar(false); }, 9000);
  setInterval(function(){ actBuscar(false); }, ACT_CADA_MS);
} catch(e){}
/* ══════════ FIN v40 (comprende · acompaña · actualizar) ══════════ */

/* ══ v40-audit (24/09/2026) — AUTOCONOCIMIENTO POR RELEVANCIA ══════════════════════════════
   HALLAZGO EN VIVO: «dame los detalles técnicos de esta app» → Groq rebotó por CUPO (429) y
   contestó el respaldo. La arquitectura entera son ~2700 tokens que viajaban en CADA pregunta
   sobre la app, encima del espejo, la memoria y la charla: un tercio del minuto gratis (8000).
   Ahora viaja: el encabezado, un ÍNDICE de todo lo que la app tiene (un renglón por capacidad,
   así nunca «no sabe» que algo existe) y el DETALLE solo de las 6 más relevantes a la pregunta.
   ~45% menos tokens, misma fuente de verdad (se arma de ARQUITECTURA_MIRROR, no es un texto
   aparte que pueda quedar viejo). Y además: los modos se nombran como los bautizó el usuario —
   el respaldo contestaba «MIRROR, TARS, EXAMINADOR y CONEX» a quien los llamó ATIS o BASE. */
const ARQ_DETALLE_K = 6;
const ARQ_DETALLE_MAX_CHARS = 2600;   // v40-cupo2
const _ARQ_CORTAS = new Set(['voz','web','pdf','csv','foto']);
/* v40-audit11: cómo nombra la gente cada función → el renglón que la explica (en vivo, «voz» y «significado» no traían
   «CHARLA POR VOZ» ni «MEMORIA QUE ENTIENDE», y la entidad terminó diciendo que no las tenía) */
const _ARQ_PISTAS = [
  [/\bvoz\b|hablar|sin\s+escribir|manos\s+libres/, /CHARLA POR VOZ/],
  [/significad|entiende|entender/, /MEMORIA QUE ENTIENDE/],
  [/\bfoto|imagen|camara/, /FOTO Y RESUELVO/],
  [/actualiz|version/, /🔄 ACTUALIZAR/],
  [/respaldo/, /MOTOR DE RESPALDO/],
  [/encuesta/, /MIRROR ENCUESTA/],
  [/facil/, /MODO FÁCIL/],
  [/agend|tarea|whatsapp|llamar|mail|avisale|mandale/, /AGENTE/],
  [/document|archivo|adjunt|pdf/, /Subir documentos/]
];   // v40-audit11: palabras cortas que SÍ nombran una función («voz» quedaba afuera por tener 3 letras)
const _ARQ_STOP = new Set(['esta','este','estos','estas','para','como','cómo','que','qué','con','los','las','del','una','uno','por','sobre','dame','decime','contame','app','aplicacion','aplicación','tiene','tenes','tenés','hace','hacer','podes','podés','sabes','sabés','cual','cuál','cuales','cuáles','todo','todos','toda','todas','algo','mirror','detalles','tecnicos','técnicos','informe','funciona','funcionamiento']);
/* v40-audit11: palabras de charla que no dicen NADA sobre qué función se pregunta (en vivo «pero eso no lo tenés incorporado,
   me encantaría una mejor…» elegía el detalle por «pero» y «mejor») */
['pero','porque','eso','esto','tenes','tengo','tener','gustaria','encantaria','mejor','mejores','mejoras','incorporado','incorporada','incorporar','quisiera','querria','podrias','mucho','gusto','soy','todavia','necesito','necesitas'].forEach(function(w){ _ARQ_STOP.add(w); });
function _arqNorm(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
function _arqPartir(){
  const lineas = String(ARQUITECTURA_MIRROR||'').split('\n');
  const cab = [], items = [], pie = [];
  let vistoItem = false;
  lineas.forEach(function(l){
    if (/^•/.test(l)) { vistoItem = true; items.push(l); }
    else if (!vistoItem) cab.push(l);
    else if (/^Si te preguntan/.test(l)) pie.push(l);
  });
  return { cab: cab.filter(function(x){ return x.trim() && !/:\s*$/.test(x.trim()); }).slice(0,3), items: items, pie: pie };
}
function _arqTitulo(item){
  var t = item.replace(/^•\s*/,'');
  var cortes = [t.indexOf(':'), t.indexOf(' — '), t.indexOf(' ('), t.indexOf('.')].filter(function(i){ return i > 3; });
  var fin = cortes.length ? Math.min.apply(null, cortes) : 60;
  return t.slice(0, Math.min(fin, 70)).trim();
}
function _arqNombresModos(){
  try {
    const M = (typeof CONFIG!=='undefined' && CONFIG.modos) || null; if (!M) return '';
    return 'NOMBRES EN ESTA INSTALACIÓN (usá SIEMPRE estos, no los internos): el espejo se llama «' + (M.mirror||'MIRROR') + '», el analista «' + (M.tars||'TARS') + '», el examinador «' + (M.jurado||'EXAMINADOR') + '» y las conexiones «' + (M.conn||'CONEX') + '»' + ((CONFIG.appName) ? '; la entidad se llama «' + CONFIG.appName + '»' : '') + '.';
  } catch(e){ return ''; }
}
/* ══ v40-1029 — LOS NOMBRES DE FÁBRICA NO SE FILTRAN (hallazgo en vivo de Darío, 23/10) ══════════════════════════
   «QUE SABES HACER?» → «módulos internos: TARS, EXAMINADOR, CONEX». CAUSA (verificada): el system prompt sí se
   personaliza (personalizarPrompt), pero la ARQUITECTURA que viaja como material iba con los nombres de fábrica
   («MIRROR · TARS · ⚖ EXAMINADOR · CONEX», «TARS: analista…», «CONEX: panel…»). Dos capas, porque por prompt no alcanza
   (lección v39-modelsano): (1) la arquitectura sale con los nombres de la instalación; (2) la respuesta, antes de
   mostrarse, cambia los nombres de fábrica por los tuyos. NO se toca si el usuario los nombró él (es su pregunta), ni
   si su nombre ya es el de fábrica, ni sin modos configurados. Los nombres propios se protegen antes de reemplazar
   (con «EXPERTO/EXAMINADOR», el EXAMINADOR suelto pasa a «EXPERTO/EXAMINADOR» sin duplicarse). */
function personalizarNombres(txt, pregunta, conMirror){
  try {
    if (typeof txt !== 'string' || !txt) return txt;
    const C = (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.modos) || null; if (!C) return txt;
    const M = NMODOS(); const q = String(pregunta || '');
    // verificador 29/10: «JURADO» queda afuera (es palabra común: «el jurado de la tesis»), y MIRROR también (el constructor
    // sigue diciendo «Tu MIRROR actúa»: renombrarlo en la arquitectura apuntaba a un interruptor que no existe con ese nombre)
    const pares = [['TARS', M.tars], ['CONEX', M.conn], ['EXAMINADOR', M.jurado]];
    if (conMirror) pares.push(['MIRROR', M.mirror]);
    // las direcciones web y el código no se tocan («https://github.com/nasa/TARS», «const TARS = 1»)
    const prot = []; let out = txt.replace(/```[\s\S]*?```|`[^`\n]*`|https?:\/\/[^\s)»"']+/g, function(m){ prot.push(m); return '\u0003' + (prot.length - 1) + '\u0003'; });
    pares.forEach(function(p, i){
      const fab = p[0], suyo = String(p[1] || '').trim();
      if (!suyo || suyo === fab) return;
      if (new RegExp('\\b' + fab + '\\b', 'i').test(q)) return;   // lo nombró el usuario: no es fuga
      const tok = '\u0002' + i + '\u0002';
      /* v40-codigos (06/11/2026): «TARS-2» quedaba «MODO ANALÍTICO-2». Un nombre pegado a «-», a un número o a una letra es
         un CÓDIGO, no el modo: no se toca. Sin lookbehind (los iPhone viejos no lo soportan): se captura el carácter previo. */
      out = out.split(suyo).join(tok).replace(new RegExp('(^|[^A-Za-z0-9_\\-])' + fab + '(?![A-Za-z0-9_\\-])', 'g'), function(_, pre){ return pre + suyo; }).split(tok).join(suyo); // función: un «$&» en el nombre no se interpreta
    });
    return out.replace(/\u0003(\d+)\u0003/g, function(_, k){ return prot[+k]; });
  } catch(e){ return txt; }
}
function nombresDeFabricaEnSalida(reply, pregunta){
  try {
    let r = personalizarNombres(reply, pregunta, false);
    // «módulos internos» no existe para el usuario: son sus modos
    if (typeof r === 'string') r = r.replace(/\bm[oó]dulos\s+internos\b/gi, function(m){ return /^M/.test(m) ? 'Modos' : 'modos'; });
    return r;
  } catch(e){ return reply; }
}
function arquitecturaRelevante(pregunta){
  try {
    const P = _arqPartir();
    if (!P.items.length) return ARQUITECTURA_MIRROR;
    const terms = _arqNorm(pregunta).split(/[^a-z0-9ñ]+/).filter(function(w){ return (w.length >= 4 || (typeof _ARQ_CORTAS !== 'undefined' && _ARQ_CORTAS.has(w))) && !_ARQ_STOP.has(w); }).map(function(w){ return w.slice(0,5); });
    const pideModelo = /\b(modelo|motor|llm|groq|gpt|qwen)/i.test(pregunta||'');
    const pideLoMio = /(guard|privad|segur|l[ií]mite|no\s+pod[eé]s|qui[eé]n\s+(?:ve|lee|tiene)|gratis|cost[aá]s|cuesta|d[oó]nde\s+(?:ten|qued|viv|est))/i.test(pregunta||''); // v40-autoconoc2
    const pideRespaldo = /respaldo/i.test(pregunta||''); // v40-audit9
    const _qN = _arqNorm(pregunta);
    const puntaje = P.items.map(function(it, i){
      const n = _arqNorm(it); let s = 0;
      terms.forEach(function(t){ if (n.indexOf(t) >= 0) s++; });
      if (pideModelo && /MODELO \/ MOTOR/.test(it)) s += 5;
      if (pideLoMio && /DÓNDE GUARDO LO TUYO/.test(it)) s += 5;   // v40-autoconoc2
      if (pideRespaldo && /MOTOR DE RESPALDO/.test(it)) s += 6;  // v40-audit9
      if (typeof _ARQ_PISTAS !== 'undefined') _ARQ_PISTAS.forEach(function(p){ if (p[0].test(_qN) && p[1].test(it)) s += 3; });   // v40-audit11: la función nombrada por su apodo
      return { i: i, s: s };
    });
    let elegidos = puntaje.filter(function(x){ return x.s > 0; }).sort(function(a,b){ return b.s - a.s || a.i - b.i; }).slice(0, ARQ_DETALLE_K).map(function(x){ return x.i; });
    if (!elegidos.length) elegidos = P.items.map(function(_,i){ return i; }).slice(0, ARQ_DETALLE_K); // pregunta general: lo principal (los modos van primero)
    /* v40-cupo2: el detalle tiene tope de caracteres (los renglones nuevos son largos): entran los más relevantes hasta
       ARQ_DETALLE_MAX_CHARS, siempre al menos uno. El índice, que nombra TODO, viaja siempre entero. */
    { let _acc = 0; elegidos = elegidos.filter(function(i, n){ const L = P.items[i].length; if (n === 0 || _acc + L <= ARQ_DETALLE_MAX_CHARS){ _acc += L; return true; } return false; }); }
    elegidos.sort(function(a,b){ return a-b; });
    const indice = P.items.map(function(it){ return _arqTitulo(it); }).join(' · ');
    const nombres = _arqNombresModos();
    const _arqOut = P.cab.join('\n') + '\n' + (nombres ? nombres + '\n' : '')
      + 'TODO LO QUE LA APP TIENE (índice — si preguntan por algo de acá que no está en el detalle, decí que existe y ofrecé contar más): ' + indice + '\n'
      + 'DETALLE DE LO RELEVANTE PARA ESTA PREGUNTA:\n' + elegidos.map(function(i){ return P.items[i]; }).join('\n') + '\n'
      + (P.pie.join('\n') || 'Si te preguntan algo de la app que NO figura acá, decí honestamente que no lo sabés con certeza.');
    return (typeof personalizarNombres === 'function') ? personalizarNombres(_arqOut, pregunta, false) : _arqOut; // v40-1029: con los nombres de la instalación
  } catch(e){ try{ regError('arq:relevante', e); }catch(_){} return ARQUITECTURA_MIRROR; }
}

/* ══ v40-audit6 (25/09/2026, 19:33) — «¿QUÉ TIENE DE BUENO LA v40?» → INVENTABA ══════════════════════
   HALLAZGO EN VIVO DE DARÍO, con la v40 recién deployada: preguntó qué trae la versión, si hay
   novedades, por qué es mejor que la v38 y si se actualiza sola. La entidad INVENTÓ («barra de acciones
   rápidas», «cifrado actualizado», «control de permisos más estricto») y NEGÓ lo que sí existe («No, la
   app no se actualiza sola»). CAUSA: la lista REAL de novedades (APP_NOVEDADES) vivía solo en la solapa
   🔄 — el modelo nunca la veía; y «¿alguna novedad?» / «¿se actualiza sola?» no nombran la app, así que
   ni siquiera entraba la arquitectura. Con el motor de respaldo (más chico) el hueco se llenó de humo.
   AHORA: cualquier pregunta por la versión, las novedades o las actualizaciones lleva al contexto la
   FUENTE DE VERDAD (versión, build, la lista textual de novedades y cómo se actualiza), con la orden de
   no afirmar nada fuera de eso. Se sostiene 2 turnos más, para las repreguntas («¿cuáles son esas
   ventajas?») que ya no nombran la versión. */
/* v40-audit9 (2/10, en vivo): «¿por qué la v5.0 es mejor que la v4.5?» no nombraba «versión» ni un «v40» de dos cifras:
   no entró la fuente de verdad y el modelo inventó una «v5.0». Ahora «v5.0», «v4.5», «v 39» también disparan. */
const PREGUNTA_POR_VERSION = /(versi[oó]n|\bv\s?\d{2}\b|\bv\s?\d[.,]\d\b|novedad|\bqu[eé]\s+(hay|trae|tiene)\s+de\s+(nuev|buen)|\bqu[eé]\s+cambi[oó]\s*(?:[?¿!.]*\s*$|(?:en|con)\s+(?:la\s+app|vos|esta\s+versi[oó]n|la\s+actualizaci[oó]n))|\b(?:te|se)\s+actualiz|\bactualizarte\b|\bactualizaci[oó]n(?:es)?\s+(?:de\s+(?:la\s+app|vos)|nueva|tuya)|\bhay\s+(?:alguna\s+|una\s+)?actualizaci|\bbuild\b|lo\s+nuevo)/i;  // v40-audit11: acotada («¿qué cambió en la ley?», «actualizá la tarea» ya no traen el bloque de versión)
let _versionTurnos = 0;
/* v40-1029 (en vivo 23/10 + auditores): después de preguntar la versión, el bloque de VERSIÓN viajaba 2–3 turnos más
   aunque la charla cambiara de tema, y el corrector de novedades se metía donde no correspondía: a «QUE SABES HACER?»
   le sacó «crear encuestas» (¡que sí sabe hacer!) y puso «✎ Nota de la app: saqué las encuestas de lo nuevo…». Ahora
   sigue vigente SOLO en una repregunta corta («¿y esas ventajas?», «¿pero qué cambió?»); una pregunta por lo que la
   app sabe hacer NO es una pregunta por lo nuevo. */
const PREGUNTA_CAPACIDADES = /\b(?:qu[eé]\s+(?:sab[eé]s|pod[eé]s|sabes|podes)(?:\s+hacer)?|para\s+qu[eé]\s+serv[ií]s|qu[eé]\s+funciones|qu[eé]\s+hac[eé]s|en\s+qu[eé]\s+me\s+(?:pod[eé]s\s+)?ayud)/i;
function versionSigueVigente(t){
  t = String(t || '');
  if (PREGUNTA_CAPACIDADES.test(t)) return false;
  if (t.split(/\s+/).filter(Boolean).length > 14) return false;
  return /^\s*(?:y|pero|entonces|o\s+sea|che)\b/i.test(t) || /\b(?:eso|esto|esa|ese|esas|esos|aquello|ventajas?|mejor|cambi\w*|nuev\w*|diferencias?)\b/i.test(t);
}
let _appTurnos = 0;   // v40-audit11: repreguntas sobre la app que ya no la nombran
function bloqueVersion(){
  try {
    const nov = (typeof APP_NOVEDADES !== 'undefined' && Array.isArray(APP_NOVEDADES)) ? APP_NOVEDADES : [];
    const ver = (typeof PLATFORM_VERSION !== 'undefined') ? PLATFORM_VERSION : '';
    const bld = (typeof APP_BUILD !== 'undefined') ? APP_BUILD : '';
    return '=== VERSIÓN Y NOVEDADES DE ESTA APP (fuente de verdad — lo ÚNICO que podés afirmar sobre la versión) ===\n'
      + 'Versión: ' + ver + (bld ? ' · build ' + bld : '') + '.\n'
      + 'LO NUEVO DE ESTA VERSIÓN (la lista completa y real, en este orden):\n' + nov.map(function(n){ n = String(n); if (n.length <= 200) return '- ' + n; const c = n.indexOf('; ', 80); return '- ' + (c > 0 && c < 200 ? n.slice(0, c) : n.slice(0, 195).replace(/\s+\S*$/, '')) + '…'; }).join('\n') + '\n' /* v40-cupo2: cada novedad, hasta ~200 caracteres */
      + '¿SE ACTUALIZA SOLA? SÍ BUSCA SOLA Y AVISA: al abrir (y cada 6 horas) mira si hay una versión publicada más nueva y, si la hay, muestra un cartel con «Actualizar ahora»: un toque y queda al día. Nunca se cambia a mitad de una respuesta ni sin avisar. La solapa «🔄 actualizar» (en «⋯ más») muestra la versión, lo nuevo y «buscar ahora». Al actualizar NO se toca nada tuyo: memoria, documentos, contactos, tareas y configuración quedan igual.\n'
      + 'OJO: lo que la app YA tenía antes (las tarjetas de un toque para llamar o mandar WhatsApp, las encuestas, los informes, el panel de estado, el «+» de la barra) NO es novedad de esta versión: no lo presentes como nuevo ni le inventes nombres.\n'
      + 'OTRAS VERSIONES: si te nombran una versión que NO es esta (por ejemplo «v5.0» o «v4.5»), aclará de frente que vos sos la ' + ver + (bld ? ' · build ' + bld : '') + ' y que de esa otra no tenés información: NO la describas ni la compares inventando.\n'
      + 'ESTO LE GANA A TODO: a la memoria y a lo que hayas dicho antes en esta charla. Si ahí aparece otra lista de novedades o funciones que acá no están, fue un ERROR tuyo: no la repitas, y si ya la dijiste en esta charla, corregite de frente en una línea («me corrijo: antes te dije cosas que la v… no tiene»).\n'
      + 'REGLAS: contestá con ESTO, en tus palabras y con calidez, sin listas eternas. NO inventes funciones, mejoras, cifras ni cambios de seguridad que no estén acá. Si te piden un detalle que no figura, decí que no lo sabés con certeza y ofrecé abrir «🔄 actualizar». Si comparan con la versión anterior, lo que cambió es exactamente esta lista. Si la pregunta NO es sobre esta app (p. ej. la versión de un documento), ignorá este bloque.\n'
      + '=== FIN VERSIÓN ===\n\n';
  } catch(e){ return ''; }
}

/* ══ v40-novedad (2/10/2026) — «CREAR ENCUESTAS» NO ES NOVEDAD DE LA v40 (auditoría 25/09, 20:20) ══════
   Con la .7 la respuesta a «¿qué tiene de bueno la v40?» salió real… salvo un matiz: presentó «crear
   encuestas» como si fuera nuevo. La orden ya estaba en bloqueVersion y el modelo igual la coló: por
   prompt no alcanza (la misma lección de v39-modelsano). Se corrige la SALIDA, determinístico y acotado:
     · solo en respuestas a preguntas por la versión/novedades;
     · solo renglones u oraciones que nombran algo que la app YA tenía (encuestas, informes, tarjetas de
       un toque, panel de estado) y que NO figura en APP_NOVEDADES, o algo inventado que ya se vio
       («barra de acciones rápidas», «cifrado actualizado»);
     · si el usuario mismo preguntó por eso («¿la v40 tiene encuestas?»), no se toca;
     · nunca deja la respuesta vacía, y AVISA al pie que corrigió (honestidad radical). */
const NOVEDAD_AJENA = [
  { re: /\bencuestas?\b/i, nombre: 'las encuestas', previa: true },
  { re: /\binformes?\b/i, nombre: 'los informes', previa: true },
  { re: /\btarjetas?\s+de\s+un\s+(?:solo\s+)?toque\b/i, nombre: 'las tarjetas de un toque', previa: true },
  { re: /\bpanel\s+de\s+estado\b/i, nombre: 'el panel de estado', previa: true },
  { re: /\bbarra\s+de\s+acciones(?:\s+r[aá]pidas)?\b/i, nombre: 'una «barra de acciones rápidas»', previa: false },
  { re: /\bcifrado\s+(?:actualizado|mejorado|nuevo|de\s+extremo)/i, nombre: 'un «cifrado nuevo»', previa: false }
];
const _NOVEDAD_MARCA = /(nuev|novedad|ahora(?:\s+tambi[eé]n)?\s+(?:pod[eé]s|puede|ten[eé]s|tiene|tra[eé])|incorpor|se\s+sum|sum[oó]|agreg|estren|trae|v\s?\d{2}\b)/i;
// lo que se nombra COMO de antes («los informes de siempre», «seguís teniendo…») no es venderlo como nuevo
const _PREVIA_MARCA = /(de\s+siempre|como\s+antes|igual\s+que\s+antes|de\s+antes|ya\s+(?:ten[ií]|exist|estaba|ven[ií])|segu[ií]s\s+teniendo|sigue[n]?\s+(?:estando|igual|ah[ií]))/i;
function corregirNovedadAjena(reply, pregunta){
  try {
    if (typeof reply !== 'string' || !reply) return reply;
    const nov = ((typeof APP_NOVEDADES !== 'undefined' && Array.isArray(APP_NOVEDADES)) ? APP_NOVEDADES : []).join(' ');
    const activos = NOVEDAD_AJENA.filter(function(x){ return !x.re.test(nov) && !x.re.test(String(pregunta || '')); });
    if (!activos.length) return reply;
    const lineas = reply.split('\n');
    const sacados = [];
    const esItem = function(l){ return /^\s*(?:[-•*·]|\d+[.)])\s+/.test(l); };
    const hayLista = lineas.some(esItem);
    for (let i = 0; i < lineas.length; i++){
      const l = lineas[i];
      const hit = activos.filter(function(x){ return x.re.test(l); });
      if (!hit.length) continue;
      if (esItem(l) && !_PREVIA_MARCA.test(l) && (hayLista || _NOVEDAD_MARCA.test(l))) { hit.forEach(function(x){ if (sacados.indexOf(x.nombre) < 0) sacados.push(x.nombre); }); lineas[i] = null; continue; }
      // dentro de un párrafo: solo la ORACIÓN que lo presenta como nuevo
      const orac = l.split(/(?<=[.!?])\s+/);
      let tocado = false;
      for (let k = 0; k < orac.length; k++){
        const _venta = _NOVEDAD_MARCA.test(orac[k]) && !_PREVIA_MARCA.test(orac[k]);
        if (activos.some(function(x){ return x.re.test(orac[k]); }) && (_venta || activos.some(function(x){ return !x.previa && x.re.test(orac[k]); }))){
          activos.forEach(function(x){ if (x.re.test(orac[k]) && sacados.indexOf(x.nombre) < 0) sacados.push(x.nombre); });
          orac[k] = null; tocado = true;
        }
      }
      if (tocado) lineas[i] = orac.filter(function(o){ return o !== null; }).join(' ');
    }
    if (!sacados.length) return reply;
    const limpio = lineas.filter(function(l){ return l !== null; }).join('\n').replace(/\n{3,}/g, '\n\n').trim();
    if (limpio.replace(/[\s\W]/g, '').length < 40) return reply;   // nunca dejar la respuesta hueca
    const previas = sacados.filter(function(n){ return NOVEDAD_AJENA.some(function(x){ return x.nombre === n && x.previa; }); });
    const inventadas = sacados.filter(function(n){ return previas.indexOf(n) < 0; });
    return limpio + '\n\n✎ Nota de la app: '
      + (previas.length ? 'saqué ' + previas.join(', ') + ' de lo nuevo: eso ya estaba de antes' : '')
      + (previas.length && inventadas.length ? '; y ' : '') + (inventadas.length ? 'saqué ' + inventadas.join(', ') + ', que la app no tiene' : '')
      + '. Lo nuevo de verdad está en «🔄 actualizar».';
  } catch(e){ try{ regError('novedad', e); }catch(_){} return reply; }
}

function pedidoWeb(t){
  const s = String(t || '').trim();
  let m = /^(?:che,?\s*)?(?:busc[aá](?:me)?|fij[aá]te|averigu[aá](?:me)?|googlea(?:me)?)\s+en\s+(?:internet|la\s+web|google)\s*:?\s*(.{3,200}?)\s*[?.!]*$/i.exec(s);
  if (!m) m = /^(?:che,?\s*)?(?:busc[aá](?:me)?|fij[aá]te|averigu[aá](?:me)?)\s+(.{3,200}?)\s+en\s+(?:internet|la\s+web|google)\s*[?.!]*$/i.exec(s);
  return m ? m[1].trim() : '';
}
function pedidoImagen(t){
  const m = /^(?:che,?\s*)?(?:dibuj[aá](?:me)?|(?:cre[aá]|gener[aá]|hac[eé])(?:me)?\s+(?:una\s+imagen|un\s+dibujo)\s+(?:de|con))\s+(.{3,300}?)\s*[.!]*$/i.exec(String(t || '').trim());
  return m ? m[1].trim() : '';
}
async function send() {
  if (busy) return;
  const miTurno = ++turnoVivo; // v40-tope
  try { cerrarTools(); } catch(e){} // v40-tray: al mandar, la bandeja «+» se cierra y el chat recupera su lugar
  const inp = document.getElementById('inp');
  const text = inp.value.trim();
  /* v38-dest: se guarda el pedido TAL CUAL lo escribió el usuario. Es contra esto que se
     verifica que un número dictado sea de verdad dictado, y no traído por el modelo desde
     cualquier lado de la conversación. Se pisa en cada turno a propósito. */
  try { ultimoPedidoUsuario = text; } catch(e){}
  if (!text && !imagenAdjunta) return;
  if (typeof trigPulse === 'function') trigPulse(); // v19: el header reacciona al enviar
  inp.value = ''; inp.style.height = 'auto';
  if(window.speechSynthesis) speechSynthesis.cancel(); // v2.2: nueva consulta corta la lectura anterior
  micStop(); // v2.3: el envío cierra la sesión de dictado — el próximo mensaje arranca limpio
  if(micAccion){ micAccion=false; try{ vozAccionUI(); }catch(e){} } // v38-vozaccion (C2): si mandás a mano, el modo hablar-acción se cierra solo
  try{ cumpliTurno(); }catch(e){} // v38-cumpli (H1): cuenta la sesión para el recordatorio de pausa
  // v38-apagado (H3): si se cumplió el límite que vos te pusiste, acá se frena. El mensaje
  // NO se pierde: queda escrito en el campo, y con un toque seguís. Nunca se traba de verdad.
  try{ if(apagadoBloquea()){ inp.value = text; setButtonsBusy(false); return; } }catch(e){}
  /* v38-vision4 (2/08/2026) — LA RAMA DE VISIÓN SE MUEVE ACÁ ABAJO. Hallado al portar la visión
     al MIRROR personal: el desvío estaba ANTES de cumpliTurno (H1) y de apagadoBloquea (H3), así
     que mandar una imagen NO contaba el turno y SALÍA IGUAL con el límite diario cumplido. Un
     límite que el usuario se puso y tiene una puerta lateral no es un límite: rompía la bandera
     más distintiva del proyecto. Se corrige en las dos muletas el mismo día — la lección de
     v38-proc, que vivió dos días arreglado en una sola. Sigue ANTES de actuaInterceptar: con una
     foto adjunta el pedido es mirarla, no operar la app. */
  try { if (imagenReciente) imagenReciente.turnos++; } catch(e){}
  if (!imagenAdjunta && imagenReciente && imagenReciente.turnos <= 3 && REFIERE_IMAGEN_RE.test(text||'')) { imagenAdjunta = imagenReciente.url; imagenReapertura = true; } // v40-audit
  if (imagenAdjunta && fotoPideAccion(text)) { return fotoResolver(text); } // v40-acompana: foto y resuelvo
  if (imagenAdjunta) { return enviarConImagen(text); }
  /* v40-audit11 (3/10): «buscá en internet X» y «dibujame X» llegaban al modelo, que no navega ni dibuja (y la regla le hace
     ofrecer el botón). Ahora el pedido va DIRECTO a la herramienta de verdad: la búsqueda web (🌐) o el creador de imágenes
     (🎨, que pide la clave si falta). Solo en el espejo y con la capacidad encendida; si no, sigue el camino de siempre. */
  try {
    if ((mode === 'mirror' || mode === 'tars') && !imagenAdjunta){ const _inv = pedidoInvestigacion(text); if (_inv) return investigarAFondo(_inv, text); const _dc = pedidoDocCompleto(text); if (_dc) return analizarDocCompleto(_dc, text); } // v40-investigar · v40-doccompleto
    if (mode === 'mirror' && !imagenAdjunta){
      const _pw = pedidoWeb(text);
      if (_pw && (typeof CONFIG === 'undefined' || !CONFIG.cap || CONFIG.cap.web !== false)) { inp.value = _pw; return sendWeb(); }
      const _pi = pedidoImagen(text);
      if (_pi && typeof generarImagen === 'function') { inp.value = _pi; return generarImagen(); }
    }
  } catch(e){ try { regError('pedido:web-imagen', e); } catch(_){} }
  // v36-actua (Etapa 3 Ciclo 2): ¿pedido sobre la propia app? Se resuelve al instante, sin tokens.
  if (actuaInterceptar(text)) return;
  // v39-modelfijo: pregunta por el MODELO/MOTOR de IA → respuesta LOCAL y FIJA (no pasa por el modelo, que confabulaba).
  // v40-hechos: datos de la app (dónde está lo tuyo, el respaldo, versiones ajenas) → los contesta la app, no el modelo.
  // Va ANTES del modelfijo: «¿cuál es tu motor de respaldo?» nombra «tu motor» pero NO pregunta por el modelo principal.
  /* v40-hechos-modos (16/10, auditor 1): en los otros modos «¿qué hora es?» o «¿qué versión sos?» iban al modelo, que no
     tiene reloj e inventa. Ahí solo se contestan esos dos DATOS y solo si es TODO lo que se pregunta: cualquier otra cosa
     sigue el camino de siempre del modo (no se toca la lógica del analista ni del examinador). */
  let _hechos = (mode === 'mirror') ? hechosDeLaApp(text) : hechosDeLaApp(text).filter(function(x){ return x === 'hora' || x === 'miversion'; });
  if (mode !== 'mirror' && _hechos.length && !_restoTrivial(textoSinHechos(text))) _hechos = [];
  const _textoModelo = _hechos.length ? textoSinHechos(text) : text;
  if (_hechos.length && _restoTrivial(_textoModelo) && !esPreguntaModelo(_textoModelo)) {
    // v40-cupo2: la repregunta («¿cuáles son esas ventajas?», «¿dónde la busco?») sigue teniendo la fuente de verdad
    try { if (_hechos.indexOf('miversion') >= 0 || _hechos.indexOf('version') >= 0) _versionTurnos = 2; if (esPreguntaPorApp(text) || _hechos.some(function(x){ return x !== 'miversion' && x !== 'version'; })) _appTurnos = 2; } catch(e){} // la repregunta de VERSIÓN no necesita la arquitectura (le comía el lugar al bloque de versión)
    responderHechosFijo(text, _hechos); return;
  }
  if (_hechos.length && esPreguntaModeloSola(_textoModelo)) { responderHechosFijo(text, _hechos, textoModeloFijo()); return; } // v40-partes: hecho + modelo, todo fijo (sin gastar una llamada)
  let _hechosYa = false;
  if (esPreguntaModeloSola(_textoModelo) && !_hechos.length) { responderModeloFijo(text); return; }
  const _antepIdentidad = esPreguntaModelo(_textoModelo); // v40-audit: venía con otro pedido → se antepone al final · v40-hechos: sin las preguntas que ya contestó la app
  setButtonsBusy(true);
  /* v40-agente: pedido de ACCIÓN (avisale / mandale / agendame…) → lo resuelve el agente en varios
     pasos con herramientas locales. Si no pudo ni empezar, sigue el camino de siempre sin
     repetir el mensaje del usuario. */
  try { if (_sem.on) await semPrepararConsulta(text); } catch(e){} // v40-comprende: el vector de ESTA pregunta (tope 1,5 s)
  let _agenteMostro = false;
  if (agenteDebeActuar(_textoModelo)) {
    let _ra = false;
    /* v40-hechos: «¿dónde guardo lo mío? … y agendame X» — el agente se quedaba con el pedido y contestaba MAL lo
       demás («decime dónde querés guardar tus archivos»). Ahora la app contesta los datos y el agente recibe solo el pedido. */
    if (_hechos.length){ try { addMsg('user', text); addMsg('mirror', textoHechos(_hechos, text)); history.push({ role:'user', content:text }, { role:'assistant', content:textoHechos(_hechos, text) }); } catch(e){} _hechosYa = true; }
    try { _ra = await agenteResolver(_textoModelo, _hechos.length ? { yaMostrado:true } : undefined); } catch(e){ try{ regError('agente', e); }catch(_){} }
    if (_ra === true) { semCerrarConsulta(); return; }
    _agenteMostro = (_ra === 'mostrado') || _hechosYa;
  }

  // Construir contexto SOLO para la llamada actual (no se guarda en history,
  // para no multiplicar tokens en cada turno y saturar Groq).
  // v1.2: la bibliografía (RAG) es material de ANÁLISIS y solo corresponde al modo TARS.
  // En modo MIRROR no se inyecta: si no, MIRROR ve fragmentos de la bibliografía y se va al
  // rol académico (deja de ser la entidad personal del usuario). MIRROR es la persona, no el analista.
  // v1.4 (COMPUERTA): en TARS normal solo traemos bibliografía si la pregunta la amerita
  // (teórica/analítica o nombra autor). Si la base de datos externa está conectada, siempre fluye
  // (es el modo análisis datos+bibliografía). Así TARS no cita de más Y ahorramos la
  // llamada de traducción ES->EN, que se hacía en CADA mensaje.
  // v3.9 (FIX TARS no veía archivos de sesión): los archivos que el usuario sube EN LA SESIÓN
  // se consultan SIEMPRE, no importa cómo redacte la pregunta. Antes, si la pregunta no contenía
  // una palabra "teórica" ni nombraba un autor cargado, la compuerta los dejaba afuera y TARS no
  // se enteraba de lo que decía el archivo recién subido. La biblioteca persistente grande SIGUE
  // con compuerta (no se vuelcan fragmentos de la bibliografía en cada mensaje suelto).
  const haySesion = ragDocs.some(d => d.type==='session' && d.content);
  const buscarBiblioteca = tesisConnected || necesitaBibliografia(text); // ¿buscar en la biblioteca persistida?
  // v37-fix (Bug B): el espejo (mirror) NO inyecta la bibliografía persistida, pero si hay un
  // documento de SESIÓN cargado y el usuario pide explícitamente resumen / «qué dice» / informe
  // DEL documento, lo dejamos leerlo (antes respondía «subí el documento» aunque estuviera cargado).
  const pideDoc = /(resum|qu[eé]\s+dice|de\s+qu[eé]\s+(?:trata|va)|sobre\s+qu[eé]|analiz|revis|\ble[eé]r?\b|informe|el\s+(?:documento|archivo|texto|pdf|paper|apunte)|lo\s+que\s+(?:sub|carg))/i.test(text);
  // v37-fix2 (Bug B): los documentos pueden estar como PERM (biblioteca) o de sesión. Si el usuario
  // pide resumen/informe de un documento y hay CUALQUIERA de los dos, lo dejamos leerlo.
  const usarBiblio = ((mode === 'tars' || mode === 'jurado') && (buscarBiblioteca || haySesion || (pideDoc && ragChunks.length)))
                   || (mode === 'mirror' && pideDoc && (haySesion || ragChunks.length));
  // v0.7: la expansión ES->EN solo sirve para la biblioteca persistida (papers en inglés). Para un
  // archivo de sesión (propio, en español) no hace falta y evita gastar una llamada a Groq.
  const searchQuery = (usarBiblio && buscarBiblioteca && ragChunks.length) ? await expandQueryBilingual(text) : text;
  const ragContext = usarBiblio ? getRagContext(text, searchQuery, buscarBiblioteca || (pideDoc && ragChunks.length>0)) : '';
  // v0.7: nivel de datos según la pregunta. Si además hay PDFs, bajamos un escalón
  // para no saturar el cupo de Groq (resumen+PDFs rinde igual y gasta mucho menos).
  let nivelDatos = nivelContextoDatos(text);
  if (ragContext && nivelDatos === 'completo') nivelDatos = 'normal';
  if (ragContext && nivelDatos === 'normal') nivelDatos = 'resumen';
  const tesisContext = ((mode === 'tars' || mode === 'jurado') && tesisConnected) ? getTesisContext(nivelDatos) : '';
  // v35-mem: memoria personal por relevancia (BM25 sobre recuerdos). SOLO modo espejo; en TARS/jurado queda vacía.
  let _preguntaVersion = false; try { _preguntaVersion = PREGUNTA_POR_VERSION.test(text) || _versionTurnos > 0; } catch(e){} // v40-audit7 (los filtros de memoria/historial envenenados siguen los turnos pegajosos)
  let _versionDirecta = false; try { _versionDirecta = PREGUNTA_POR_VERSION.test(text) || (_versionTurnos > 0 && versionSigueVigente(text)); } catch(e){} // v40-1029: el bloque largo y el corrector, solo si de verdad se habla de la versión
  const memoriaRelevante = (mode === 'mirror') ? getRecuerdosContext(text, { sinVersion: _preguntaVersion }) : '';
  const suenoRelevante = (mode === 'mirror' && !charlaTemporal) ? getSuenoContext(text) : ''; // v39-sonar · v40-temporal: sólo si el dueño pregunta por el sueño
  const tareasRelevante = (mode === 'mirror') ? getTareasContext(text) : ''; // v39-tareas
  // v35-proc (Etapa 4): registrar la procedencia REAL del contexto (el código ya lo sabe; ahora se ve)
  // v37-web (C1a): ¿esta pregunta continúa una búsqueda web reciente? Si sí, los
  // resultados vuelven al contexto en vez de dejar al modelo tirando de memoria.
  const webRetenido = (mode === 'mirror') ? webContextoVigente(text) : '';
  ultimaProcedencia = [];
  ultimaProcRecuerdos = memoriaRelevante ? recUsadosUltimos.slice() : []; // v40-recusados
  if (memoriaRelevante) ultimaProcedencia.push('◈ memoria');
  if (suenoRelevante) ultimaProcedencia.push('💤 sueño'); // v39-sonar
  if (tareasRelevante) ultimaProcedencia.push('📋 tareas'); // v39-tareas
  if (webRetenido) ultimaProcedencia.push('🌐 web'); // v37-web (C1a): el chip ahora dice la verdad
  if (tesisContext) ultimaProcedencia.push('⬡ datos');
  if (ragContext) ultimaProcedencia.push('📚 biblioteca');

  // v1.0: si en TARS preguntan por DATOS pero la base NO está conectada,
  // que TARS avise de conectarla (botón CONEX) en vez de irse a los PDFs.
  const preguntaPorDatos = /\b(datos?|registros?|base de datos|encuestas?|entrevistas?|escala|likert|frecuencia|porcentaje|estad[ií]stic|muestra|resultados?)\b/i.test(text);
  /* v39-ragwin (2/09/2026): no confundir «evaluá las CONSIGNAS/el instrumento para recolectar
     datos» con «mostrame los datos de la base». Si el pedido es evaluar un instrumento o un
     documento (consignas, pertinencia, cuestionario…) o hay un archivo cargado en la sesión,
     NO desviamos a «conectá CONEX»: eso es análisis de instrumento, no consulta de registros. */
  const evalInstrumento = /\b(consignas?|instrumento|pertinencia|cuestionario|gu[ií]a de (?:preguntas|entrevista)|r[úu]brica|validez|dise[ñn]o del? (?:instrumento|encuesta)|documentos?|archivos?|papers?|apuntes?)\b/i.test(text);
  let avisoSinBase = '';
  /* v39-routerdoc (11/09/2026): evalInstrumento ahora cubre el PLURAL (documentos/archivos) + papers/apuntes.
     Hallazgo EN VIVO de Darío: "analizá los datos de mis documentos" (base SIN conectar, docs PERM)
     caía en el aviso «conectá CONEX» porque la regex sólo tenía el singular — el modelo no veía sus
     propios documentos. No se toca la protección de la base: un pedido de registros/encuestas SIN
     mencionar documentos sigue desviando bien (eso lo amarra TEST_router_docs.js). */
  const _informeCtx = informeVigente(text); // v40-1029: la repregunta sobre el último informe
  if (mode === 'tars' && !tesisConnected && preguntaPorDatos && !evalInstrumento && !haySesion) { // verificador: el aviso de la base no se saltea por un informe
    avisoSinBase = 'IMPORTANTE: la base de datos externa NO está conectada en este momento. El usuario pregunta por datos/registros pero NO tenés acceso a ellos. NO uses la bibliografía como si fuera la base de datos. Respondé EXACTAMENTE: "La base de datos no está conectada todavía. Conectala con el botón CONEX (arriba a la derecha) y vuelvo a tener acceso a los registros para analizarlos." No inventes datos ni cites PDFs como si fueran los datos.\n\n';
  }

  // v1.0: si preguntan por la LISTA o CANTIDAD de documentos/archivos, le damos la lista REAL.
  // Esto evita que TARS cuente fragmentos del buscador como si fueran documentos.
  // v1.3: distinguimos pregunta PURA de inventario ("cuántos documentos hay") de una pregunta
  // que además pide análisis ("qué ves en los registros y qué opinás de la bibliografía").
  // Solo en la PURA reemplazamos todo por la lista; si no, la lista se SUMA al contexto.
  const preguntaPorDocs = /\b(cu[áa]nt[oa]s?|qu[ée]|cu[áa]les?)\b.*\b(documentos?|archivos?|pdf|bibliograf[íi]a|textos?)\b|\b(documentos?|archivos?)\s+(tenemos|hay|cargad|guardad|subid|en memoria)/i.test(text);
  // Inventario PURO: menciona documentos/archivos pero NO pide datos ni análisis.
  const pidetambienDatosOanalisis = preguntaPorDatos || /\b(analiz|opini[óo]n|opin[aá]|ves|interpret|cruz|relacion|seg[úu]n|aplicá|conclusi|tensi[óo]n|actor)\b/i.test(text);
  const inventarioPuro = preguntaPorDocs && /\b(cu[áa]nt[oa]s?)\b/i.test(text) && !pidetambienDatosOanalisis;
  let listaDocsTxt = '';
  if (mode === 'tars' && preguntaPorDocs) {
    const lista = listaDocumentosReal();
    if (lista) {
      listaDocsTxt = 'LISTA REAL Y COMPLETA DE DOCUMENTOS EN MEMORIA (esta es la VERDAD — usá EXACTAMENTE esta lista, NO cuentes fragmentos ni inventes documentos):\nHay '+lista.total+' documento(s) cargado(s):\n'+lista.texto+'\n\nRegla: si te preguntan cuántos o cuáles documentos hay, respondé con ESTA lista de '+lista.total+'. NO confundas "fragmentos" con "documentos". NO menciones documentos que no estén en esta lista.\n\n';
    } else {
      listaDocsTxt = 'No hay documentos cargados en memoria. Decílo claramente: no hay documentos. NO inventes ninguno.\n\n';
    }
  }

  /* v39-memfix (11/09/2026): el usuario pregunta si RECUERDA / REPITE / empieza de cero.
     Sin esto el modelo inventaba «no tengo memoria, cada charla empieza de cero» — FALSO y contra
     la Regla de Oro: la app SÍ persiste la conversación (se restaura al reabrir) y trae recuerdos
     por relevancia. Se inyecta una nota honesta para que NUNCA niegue su memoria. Hallazgo en vivo de Darío. */
  const preguntaPorMemoria = (mode === 'mirror') && /\b(me\s+repet[íi]s|te\s+repet[íi]s|ten[ée]s\s+memoria|ten[ée]s\s+registro|record[áa]s|te\s+acord[áa]s|me\s+olvid[áa]s|te\s+olvid[áa]s|empez[áa]s\s+de\s+cero|arranc[áa]s\s+de\s+cero|de\s+cero\s+cada|guard[áa]s\s+(?:lo|la\s+charla|la\s+conversaci))/i.test(text);
  /* v40-autoconoc2 (2/10/2026): la nota decía «se guarda en el dispositivo» y NO es así — la charla y los recuerdos
     viven en la Firebase PROPIA del usuario (lo verificó la auditoría del 25/09: sin esa base, nada se guardaba entre
     sesiones). La nota dice ahora dónde está de verdad, y si la base no está configurada, lo dice de frente. */
  const _sinBaseMem = (typeof FB_URL !== 'undefined') && !FB_URL;
  const avisoMemoria = !preguntaPorMemoria ? '' : _sinBaseMem
    ? 'NOTA DE HONESTIDAD (obligatoria): en ESTA instalación la base de memoria (Firebase) NO está configurada. Mientras la app esté abierta te acordás de lo que se habló, pero al cerrarla la charla NO queda guardada para la próxima vez. Decilo así, de frente, y sugerí cargar la Firebase en el constructor para tener memoria entre sesiones. No inventes recuerdos de otras sesiones.\n\n'
    : 'NOTA DE HONESTIDAD (obligatoria): SÍ tenés memoria persistente de esta conversación — se guarda en la base Firebase PROPIA del usuario (la que configuró) y se restaura cuando reabre la app; además traés recuerdos por RELEVANCIA (no recitás todo). NUNCA digas que «no tenés memoria» ni que «cada charla empieza de cero»: es falso. Si justo ahora no te llegó un recuerdo puntual, decí que no lo tenés a mano y pedile el dato, SIN negar que tenés memoria.\n\n';
  let contextoActual = text;
  if (avisoSinBase) {
    contextoActual = avisoSinBase + 'PREGUNTA: ' + text;
  } else if (inventarioPuro) {
    // Pregunta SOLO sobre cuántos/cuáles documentos: priorizamos la lista real, sin fragmentos.
    contextoActual = listaDocsTxt + 'PREGUNTA: ' + text;
  } else {
    // Cualquier otra pregunta de TARS: ensamblamos TODO lo que aplique (datos + bibliografía + lista).
    let partes = '';
    // v2.3: si la pregunta es sobre la PROPIA APP (MIRROR/TARS/funcionamiento), va la
    // arquitectura real al contexto — autoconocimiento sin inventos, en cualquier modo.
    /* v40-audit11 (3/10, en vivo): «¿qué mejoras te gustaría?» → pidió lo que ya tiene; la repregunta «¿pero eso no lo tenés
       incorporado?» ya no nombraba nada de la app y contestó «no» (falso). La arquitectura acompaña 2 turnos más. */
    /* v40-cupo2 (3/10, hallado al auditar la auditoría de Darío): con la salida medida de verdad (v40-cupo), el espejo tiene
       ~1.800 tokens para charla + material (el system solo ya pesa ~4.200). La arquitectura y la versión iban PRIMERO y lo
       corto e importante (la orden de los datos fijos, la nota de memoria, los recuerdos) iba al final… que es justo lo que
       el recorte corta. Ahora: lo corto y obligatorio primero; lo personal después; versión y arquitectura al final, y SOLO
       si hacen falta (si la app ya contestó ese dato con texto fijo, no se le manda al modelo el mismo tema en largo). */
    if (_hechos.length) partes += 'YA LO CONTESTÓ LA APP CON DATOS FIJOS (se muestra arriba de tu respuesta): ' + _hechos.map(function(x){ return x === 'guardo' ? 'dónde se guarda lo del usuario' : (x === 'respaldo' ? 'cuál es el motor de respaldo' : 'versiones que no son esta'); }).join(', ') + '. NO hables de esos temas ni los repitas: contestá SOLO lo demás del mensaje.\n\n'; // v40-hechos
    if (avisoMemoria) partes += avisoMemoria; // v39-memfix: nota de honestidad sobre la memoria
    const _hechosVersion = _hechos.indexOf('miversion') >= 0 || _hechos.indexOf('version') >= 0;
    let _partesFin = '';
    // «¿qué mejoras/actualizaciones te gustaría?» nombra «actualiz» pero NO pregunta por la versión (en vivo se comía el lugar de la arquitectura)
    const _esDeseo = /te\s+gustar[ií]a|qu[eé]\s+mejoras|carta\s+a\s+claude|eso\s+no\s+lo\s+ten[eé]s|ten[eé]s\s+incorporad/i.test(text);
    let _bloqueVer = '';
    try {
      if (PREGUNTA_POR_VERSION.test(text) && !_esDeseo) _versionTurnos = 3;
      if (_versionTurnos > 0){ if (!_hechosVersion && !_esDeseo && _versionDirecta) _bloqueVer = bloqueVersion(); _versionTurnos--; } // v40-1029: «¿cómo se llama mi perra?» ya no carga la lista de novedades
    } catch(e){} // v40-audit6: la versión real, no inventada · v40-cupo2: si ya la contestó la app, no viaja en largo
    /* v40-audit11 (3/10, en vivo): «¿qué mejoras te gustaría?» → pidió lo que ya tiene; la repregunta «¿pero eso no lo tenés
       incorporado?» ya no nombraba nada de la app y contestó «no» (falso). La arquitectura acompaña 2 turnos más. */
    try { if (esPreguntaPorApp(text)) _appTurnos = 3; } catch(e){}
    // la arquitectura «pegajosa» solo acompaña a una REPREGUNTA (pregunta, «y…», «pero…», «eso…»), no a cualquier charla que siga
    const _esRepregunta = /[?¿]/.test(_textoModelo) || /^\s*(?:y|pero|entonces|o\s+sea|che)\b/i.test(_textoModelo) || /\b(?:eso|esto|esa|ese|aquello)\b/i.test(_textoModelo);
    // si la repregunta ya lleva la fuente de verdad de la versión, la arquitectura «pegajosa» no va (no entran las dos en el cupo)
    if (esPreguntaPorApp(_textoModelo) || (_appTurnos > 0 && !_hechos.length && _esRepregunta && !_bloqueVer)) {
      // en la repregunta, el detalle se elige también por lo que se venía hablando (la respuesta anterior nombra las funciones)
      let _arqQ = _textoModelo;
      try { if (!esPreguntaPorApp(_textoModelo) || /\b(?:eso|esto|esa|ese|aquello)\b/i.test(_textoModelo)) { const _ult = history.slice().reverse().find(function(m){ return m && m.role === 'assistant'; }); /* acá la pregunta de ahora todavía no entró a history */ if (_ult) _arqQ = _textoModelo + ' ' + String(_ult.content || '').slice(0, 600); } } catch(e){}
      _partesFin += arquitecturaRelevante(_arqQ) + resumenErrores() + '\n\n';
    } // v35-diag (Etapa 6) · v40-audit: por relevancia · v40-autoconoc2: + preguntas a la entidad sin nombrar la app
    if (_appTurnos > 0) _appTurnos--;
    _partesFin += _bloqueVer;   // v40-cupo2: la versión, última (si hay que recortar, se recorta primero)
    if (memoriaRelevante) partes += memoriaRelevante + '\n\n';
    if (suenoRelevante) partes += suenoRelevante + '\n\n'; // v39-sonar: el cruce local va como contexto honesto
    if (tareasRelevante) partes += tareasRelevante + '\n\n'; // v39-tareas
    if (_informeCtx){ partes += _informeCtx; ultimaProcedencia.push('🔎 tu informe'); try { invUltimoInforme.usado = history.length; } catch(e){} } // v40-1029: después de lo personal y ADELANTE del material (el recorte corta del final)
    // v37-web (C1a): la web va DESPUÉS de la memoria a propósito — ante un dato
    // concreto, la fuente reciente pesa más que el recuerdo.
    if (webRetenido) partes += webRetenido + '\n\n';
    if (anaDataset && mode !== 'jurado'){ partes += anaDataset.resumenTxt + '\n\n'; try{ ultimaProcedencia.push('📊 datos'); }catch(e){} } // v36-analista: el modelo interpreta, JAMÁS calcula
    partes += _partesFin; // v40-cupo2: versión y arquitectura, después de lo personal (si hay que recortar, se recortan primero)
    // v2.1: en modo jurado el dominio experto SIEMPRE va en el contexto (fuente del interrogatorio).
    if (mode === 'jurado') partes += DOMINIO_EXPERTO_TPL + '\n\n';
    if (tesisContext) partes += tesisContext + '\n\n';
    if (ragContext) partes += '=== BIBLIOGRAFÍA (marco teórico, NO son los datos) ===\n' + ragContext + '\n\n';
    if (listaDocsTxt) partes += listaDocsTxt;
    contextoActual = (partes ? partes + '---\n' : '') + 'PREGUNTA: ' + (_hechos.length ? _textoModelo : text); // v40-hechos2: lo que ya contestó la app no se le vuelve a preguntar al modelo
  }

  if (!_agenteMostro) addMsg('user', text, false); // v40-agente: si el agente ya lo mostró y cedió el turno, no se repite
  // En history guardamos solo la pregunta limpia (memoria conversacional liviana).
  // v1.5: si es una redacción en nombre de Darío (modo MIRROR), es tarea puntual: no se guarda.
  const esTarea = (mode === 'mirror') && esRedaccionEnNombre(text);
  if (!esTarea) history.push({role:'user', content:text});
  sesionTurnos++; // v35-vida (Etapa 5)
  try{ if(typeof cebActiva==='function' && cebActiva() && mode==='mirror') cebTurnoUsuario(text, {}); }catch(e){} // v52-cebolla: gasta energía del turno (gated, solo espejo)

  // Elegir estilo visual y system prompt
  const isTarsDB = mode === 'tars' && tesisConnected;
  showTyping(mode==='jurado' ? 'jurado' : (isTarsDB ? 'db' : mode));

  const systemPrompt = (mode==='jurado') ? buildAnaliticoSystem(SYSTEM_TARS_JURADO)
    : isTarsDB ? buildAnaliticoSystem(SYSTEM_TARS_DB)
    : (mode==='tars') ? buildAnaliticoSystem(SYSTEM_TARS)
    : (buildMirrorSystem() + cebLineaPrompt() + cebBanderaPrompt()); // v25 + v52-cebolla: estado sólo en modo espejo (gated)
  const msgStyle = mode==='jurado' ? 'jurado' : (isTarsDB ? 'db' : mode);

  // Mensajes a Groq: historial previo liviano + el mensaje actual CON contexto pesado.
  // v2.4: en jurado el proyecto completo viaja en CADA turno (≈7k tokens), así que el
  // historial va más corto — menos presión sobre la cuota por minuto = menos saturación.
  /* v40-audit8 (25/09/2026, 19:58): con la .6 la memoria ya no mentía, pero la respuesta todavía traía «la barra de
     acciones rápidas». CAUSA: al abrir, la app RESTAURA la charla desde la Firebase («Memoria restaurada…») y los últimos
     turnos viajan como historial — ahí estaban las respuestas inventadas de las 19:33. En preguntas de versión, las
     respuestas VIEJAS de la entidad sobre versiones no viajan (la verdad va en bloqueVersion); lo que dijo el usuario, sí. */
  const previos = history.slice(mode==='jurado' ? -5 : -8, esTarea ? undefined : -1).filter(function(m){ /* v40-1023 (auditor 1): en una redacción el pedido no entra al historial, así que no se recorta el último (era la respuesta anterior) */ // últimos turnos, sin el actual
    // v40-cupo2: la respuesta FIJA de la app sobre la versión es la verdad, no un invento: esa sí viaja («¿cuáles son ESAS ventajas?»)
    try { const _c = String(m && m.content || ''); return !(_preguntaVersion && m && m.role === 'assistant' && _RECUERDO_DE_VERSION.test(_c) && !/🔄 (?:Mi versión: soy la|Otras versiones: yo soy la)/.test(_c)); } catch(e){ return true; }
  });
  // v39-cupo: perillas y presupuesto de salida se calculan ACÁ (ajustarAlCupo los necesita para
  // medir). En reposo/no-cebolla dan los mismos números de siempre (jurado 1100, TARS-DB 1500,
  // resto 700; temps de siempre). Antes vivían adentro del try.
  try { if (_informeCtx && invUltimoInforme && invUltimoInforme.texto){ const _cab = String(invUltimoInforme.texto).slice(0, 200); for (let _i = previos.length - 1; _i >= 0; _i--){ if (previos[_i] && previos[_i].role === 'assistant' && String(previos[_i].content || '').slice(0, 200) === _cab) previos.splice(_i, 1); } } } catch(e){} // v40-1029
  const _cebP = (typeof cebActiva==='function' && cebActiva() && mode==='mirror') ? cebPerillas() : null; // v52-cebolla
  const _maxSalida = _cebP ? _cebP.tok : (mode==='jurado'?1100:(isTarsDB?1500:700));
  const _temp = _cebP ? _cebP.temp : ((mode==='tars')?0.3:(mode==='jurado'?0.4:0.7));
  const _ajuste = ajustarAlCupo(contextoActual, systemPrompt, previos, salidaEfectiva(MODELO_GROQ, _maxSalida), mode === 'mirror' ? 2 : 0); // v39-cupo: mide y recorta ANTES de mandar · v40-cupo: con la salida que de verdad se pide · v40-cupo2: el espejo cuida el último ida y vuelta
  const mensajesGroq = _ajuste.mensajes;
  semCerrarConsulta(); // v40-comprende: el contexto ya está armado; la fusión vale solo para ESTE turno

  let reply = null;
  let errorMsg = null;
  try {
    reply = await callGroqResiliente(mensajesGroq, systemPrompt, _maxSalida, _temp);
  } catch(e) {
    if (e.tipo === 'too_big' && (tesisContext || ragContext)) {
      // Reintento con contexto REDUCIDO: resumen de datos + menos fragmentos de PDF.
      removeTyping(); showTyping(mode==='jurado' ? 'jurado' : (isTarsDB ? 'db' : mode));
      let tesisCompacto = (mode==='tars' && tesisConnected) ? getTesisContext('resumen') : '';
      // v2.1: en jurado el dominio experto es irrenunciable; ante contexto excedido se suelta la bibliografía, no el dominio.
      if (mode==='jurado') tesisCompacto = DOMINIO_EXPERTO_TPL;
      const ragReducido = recortarRag(ragContext, 2); // solo 2 fragmentos
      let ctxReducido = text;
      if (tesisCompacto && ragReducido) ctxReducido = tesisCompacto + '\n\nDOCUMENTOS:\n' + ragReducido + '\n\n---\nPREGUNTA: ' + text;
      else if (tesisCompacto) ctxReducido = tesisCompacto + '\n\n---\nPREGUNTA: ' + text;
      else if (ragReducido) ctxReducido = 'DOCUMENTOS:\n' + ragReducido + '\n\n---\nPREGUNTA: ' + text;
      try {
        reply = await callGroq([{role:'user', content:ctxReducido}], systemPrompt, mode==='jurado'?1100:(isTarsDB?1200:700), (mode==='tars')?0.3:(mode==='jurado'?0.4:0.7));
      } catch(e2){ errorMsg = mensajeError(e2.tipo, e2.message); } // v38-honest
    } else {
      errorMsg = mensajeError(e.tipo, e.message);
    }
  }

  if (miTurno !== turnoVivo) { try { regError('turno-tardio', new Error('respuesta descartada: llegó después de liberar los botones')); } catch(_){} return; } // v40-tope: llegó tarde → ni pantalla, ni voz, ni historial
  removeTyping();
  try{ if(typeof cebActiva==='function' && cebActiva() && mode==='mirror') cebTurnoResultado({ error: !!errorMsg }); }catch(e){} // v52-cebolla
  if (!reply) reply = errorMsg || (mode==='tars'
    ? 'No pude procesar la consulta. Probá reformularla o más tarde.'
    : 'Che, no me llegó bien eso. ¿Me lo repetís?');

  try{ reply = actuaProcesarReply(reply); }catch(e){ console.error(e); } // v36-actua: ¿el modelo pidió una tarjeta?
  try{ if (!errorMsg && esPreguntaPorApp(text) && !preguntaNombraModeloAjeno(text)) reply = corregirModeloAjeno(reply); }catch(e){ console.error(e); } // v39-modelsano · v40-autoconoc2: mismo disparador que la arquitectura
  try{ const _rc = (!errorMsg) ? respaldoChip() : ''; if (_rc) ultimaProcedencia.push(_rc); }catch(e){} // v40-respaldo: se ve quién contestó
  try{ if (!errorMsg && _versionDirecta) reply = corregirNovedadAjena(reply, text); }catch(e){ console.error(e); } // v40-novedad: lo de antes no se vende como nuevo
  try{ if (!errorMsg && _antepIdentidad){ const _li = lineaIdentidadModelo(); if (_li) reply = _li + '\n\n' + reply; } }catch(e){ console.error(e); } // v40-audit
  try{ if (!errorMsg && _hechos.length){ const _sinT = sacarTemasDeHechos(reply, _hechos); reply = _hechosYa ? (_sinT || reply) : (textoHechos(_hechos, text) + (_sinT ? '\n\n' + _sinT : '')); } }catch(e){ console.error(e); } // v40-hechos: el dato lo pone la app
  try{ if (!errorMsg) reply = nombresDeFabricaEnSalida(reply, text); }catch(e){ console.error(e); } // v40-1029: los nombres de TUS modos
  try{ addMsg('mirror', reply, msgStyle); }catch(e){ console.error(e); }
  try{ if (!errorMsg) ofrecerDocCompleto(text); }catch(e){ console.error(e); } // v40-1029: 📄 leer entero, con un toque
  try{ actuaPintarTarjeta(); }catch(e){ console.error(e); } // v36-actua
  try{ hablar(reply); }catch(e){ console.error(e); } // v3.0 — P5: si la voz falla, la app NO se traba
  // v1.0: línea de fuentes solo con los PDFs que TARS realmente nombró (no los del buscador de fondo)
  const esError = !!errorMsg;
  // v1.1: en preguntas de INVENTARIO de documentos (cuántos/cuáles hay) NO mostramos la
  // línea "Fuentes": los nombres de archivo aparecen en la respuesta y darían un falso
  // positivo (TARS no está "citando" esos textos, solo los está listando).
  const fuentesTxt = preguntaPorDocs ? '' : formatearFuentes(reply);
  if (fuentesTxt && !esError && mode==='tars') {
    // guardamos en el log solo las fuentes efectivamente mencionadas
    const mencionados = fuentesTxt.replace('📚 Fuentes: ','').split(' · ').map(s=>s.replace(/ \(frag\..*\)$/,''));
    if (informeLog.length) informeLog[informeLog.length-1].fuentes = ultimasFuentes.filter(f=>mencionados.includes(f.doc));
    const chat = document.getElementById('chat');
    const fdiv = document.createElement('div');
    fdiv.className = 'msg';
    fdiv.innerHTML = '<div class="av mav" style="opacity:0;"></div><div style="font-size:11px;color:var(--tars,#7fd1c0);opacity:0.75;font-family:\'Space Mono\',monospace;padding:2px 4px;">'+fuentesTxt+'</div>';
    chat.appendChild(fdiv);
    chat.scrollTop = chat.scrollHeight;
  }
  /* v39-memlimpia (21/08/2026) — LOS ERRORES NO ENTRAN A LA MEMORIA.
     Hermano del v45-memlimpia del MIRROR personal, verificado ACÁ por separado: la estructura
     de esta muleta es distinta (dos `if` sueltos, y `recuerdoGuardar` NO estaba gateado por
     `esTarea`). El hallazgo es el mismo —un mensaje de error no es un recuerdo— y el arreglo
     también: si el turno falló (`esError`), ni a `history` ni a la memoria por relevancia. */
  if (!esTarea && !esError) { history.push({role:'assistant', content:reply}); try{ await memorySet(history); }catch(e){ console.error('memorySet',e); } }
  if (mode === 'mirror' && !esError) { try{ await recuerdoGuardar(text, reply); }catch(e){ console.error('recuerdoGuardar',e); } } // v35-mem · v39-memlimpia: no guardar errores
  setButtonsBusy(false);
}

// --- Editar Perfil ---
async function editarPerfil() {
  const actual = perfilData || {};
  const filosofia = prompt('Tu filosofía de vida:', actual.filosofia || '');
  if (filosofia === null) return;
  const caracter = prompt('Tu carácter / quién sos:', actual.caracter || '');
  if (caracter === null) return;
  const paz = prompt('Qué te da paz / qué te quita el sueño:', actual.paz || '');
  if (paz === null) return;
  const proyectos = prompt('Tus proyectos activos:', actual.proyectos || '');
  if (proyectos === null) return;

  const nombre = prompt('Tu nombre completo:', actual.nombre || '');
  if (nombre === null) return;
  const ubicacion = prompt('Tu ubicación (ciudad, país):', actual.ubicacion || '');
  if (ubicacion === null) return;
  const rol = prompt('Tu rol / ocupación:', actual.rol || '');
  if (rol === null) return;
  const nuevo = {
    nombre, ubicacion, rol,
    filosofia, caracter, paz, proyectos,
    actualizado: new Date().toISOString()
  };
  perfilData = nuevo;
  const _okP = await perfilSave(nuevo);
  document.getElementById('perfil-sync').textContent = 'Actualizado ' + new Date().toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit',hourCycle:'h23'}); // v40-1029
  addMsg('mirror', _okP ? '✅ Perfil actualizado y guardado en tu Firebase.'
    : (FB_URL ? '⚠️ Actualicé tu perfil para esta sesión, pero NO pude guardarlo en tu Firebase (revisá la conexión o las reglas de la base). Si cerrás la app, se pierde.'
              : '◈ Actualicé tu perfil para esta sesión. Todavía no hay una base Firebase conectada, así que al cerrar la app se pierde.'), 'mirror'); // v40-guardado
}

// ============================================================
// --- v0.7: INFORME DESCARGABLE (Word / PDF) ---
// ============================================================
// Carga una librería desde CDN una sola vez.
// ============================================================
// --- v0.8: GENERACIÓN DE INFORME ACADÉMICO CON TARS ---
// ============================================================
// Junta datos reales + bibliografía + temas de sesión → TARS redacta el informe.
// Devuelve el TEXTO del informe (sin gráficos; los gráficos los embebe Word/PDF).
async function generarInformeAcademico(statusEl){
  const stats = calcularEstadisticas();
  const temas = temasDeLaSesion();
  const docNames = ragDocs.map(d=>d.name);

  // 1) Resumen de datos reales en texto (para que TARS NO invente cifras)
  let datosTxt = '';
  if (stats){
    // v3.6: CONTEOS ABSOLUTOS como dato primario, con la BASE de cada dimensión explícita.
    // El porcentaje solo se agrega cuando la base es razonable (>=10). Con bases chicas un
    // "100%" es UNA sola persona y el motor llegó a malinterpretarlo (invirtió "no noté
    // cambios" -> "reportan que cambió"). Mostramos la etiqueta entre comillas para que el
    // modelo la copie LITERAL y no la reinterprete.
    const PCT_MIN_BASE = 10;
    const dim = (t,arr,base)=>{
      if (!arr || !arr.length) return '';
      const items = arr.map(d=>{
        const pct = (base>=PCT_MIN_BASE && d.pct!=null) ? ' ('+d.pct+'%)' : '';
        return '"'+d.label+'" = '+d.n+' de '+base+pct;
      }).join('; ');
      return t+' (base: '+base+' respuesta(s)): '+items;
    };
    const muestraChica = stats.totalRegistros < PCT_MIN_BASE;
    const lineas = ['Total de registros: '+stats.totalRegistros+'.'];
    stats.dimensiones.forEach(d => { const t = dim(d.etiqueta, d.items, stats.totalRegistros); if (t) lineas.push(t); });
    if (muestraChica) lineas.push('NOTA DE MUESTRA (OBLIGATORIA): la cantidad de registros es chica; los porcentajes NO son representativos. Reportá CONTEOS ABSOLUTOS ("X de N"), no porcentajes. "1 de 1" significa un solo registro, NO una mayoría ni una tendencia.');
    datosTxt = lineas.filter(Boolean).join('\n');
  }

  // 2) Fragmentos relevantes de la bibliografía (PDFs cargados)
  let bibliografiaTxt = '';
  if (ragChunks.length){
    // Tomamos fragmentos sobre los temas de la sesión + términos clave del análisis
    const consulta = temas || ragChunks.slice(0,3).map(c=>c.docName).join(' ');
    const top = bm25Search(normalizeText(consulta || 'resumen análisis'), ragChunks, 6);
    bibliografiaTxt = top.map(c=>'['+c.docName+'] '+c.text.substring(0,600)).join('\n\n');
  }

  // 3) ¿Hace falta web? Solo si hay temas de sesión y poca bibliografía.
  let webTxt = '';
  if (temas && ragChunks.length < 3){
    if (statusEl) statusEl.textContent = '🌐 Buscando en la web para profundizar...';
    webTxt = await buscarWebParaInforme(temas.split('\n')[0]);
  }

  // 4) Prompt para que TARS redacte el informe académico riguroso
  const tieneDocs = !!bibliografiaTxt;
  /* v37-i18n (V36-5c): el prompt YA decía «en el idioma de tu usuario»… pero nunca
     le decía CUÁL era. Sin ese dato el modelo lo infería del material — que está en
     español — y el informe salía en español aunque la app estuviera en inglés.
     De ahí el hueco de honestidad: MIRROR prometía un informe en inglés y lo daba
     en español. Ahora el idioma viaja explícito. */
  const _idi = (function(){ try { return ({es:'ESPAÑOL',en:'INGLÉS (English)',pt:'PORTUGUÉS (Português)'})[(CONFIG && CONFIG.idioma) || 'es'] || 'ESPAÑOL'; } catch(e){ return 'ESPAÑOL'; } })();
  const sys = `Sos un analista experto. Redactás un INFORME RIGUROSO Y ESTRUCTURADO ÍNTEGRAMENTE EN ${_idi} — ese es el idioma elegido por tu usuario, y vale para TODO el informe: títulos, secciones, tablas y conclusiones. Si el material de origen está en otro idioma, traducilo; las citas textuales van en su idioma original entre comillas, con tu explicación en ${_idi}. A partir de los DATOS y los DOCUMENTOS que se te proveen. El tema, el campo y el enfoque son los que surgen de ESE material; no asumas un dominio que no esté ahí.

REGLAS ESTRICTAS:
- NO inventes cifras. Usá EXACTAMENTE los números que te doy en DATOS. Si un dato no está, no lo menciones.
- NO escribas como chat ni con preguntas. Es un informe formal, en tercera persona.
- NO incluyas enlaces de descarga ni URLs inventadas.
- Si hay DOCUMENTOS, citá cada idea SOLO por la fuente cuyo fragmento figura en el contexto (por su rótulo). NUNCA cites de memoria una fuente que no tengas delante, ni inventes autores o años. Si el rótulo es un código o nombre de archivo sin autor claro, usá su contenido sin citarlo por ese nombre.
- Si NO hay documentos, escribí el informe a partir de los DATOS y tu conocimiento general del campo, SIN inventar citas ni referencias.
- Estructura con estos encabezados, cada uno en su línea empezando con \"## \":
## Introducción
## Resultados${tieneDocs ? '\n## Discusión' : ''}
## Conclusiones
- En Resultados, interpretá los datos (no solo los repitas: los gráficos ya están en el documento). Describí QUÉ muestran los datos y qué patrones se observan.${tieneDocs ? '\n- En Discusión, cruzá los datos con las ideas de los DOCUMENTOS provistos, aplicándolas a ESTE caso concreto. Anclá cada interpretación en una fuente real del material, no en \"la teoría\" en abstracto.' : ''}
- PROHIBIDO el relleno especulativo encadenado (\"podría indicar... podría estar... podría deberse...\"). Si la muestra es chica, decilo UNA sola vez con precisión y analizá lo que los datos SÍ permiten afirmar. Cada oración debe aportar algo nuevo.
- LEÉ CADA ETIQUETA DE DATO DE FORMA LITERAL: nunca inviertas su sentido. Si una categoría dice \"No, no noté cambios\", significa que NO; jamás la presentes como que SÍ. Copiá el sentido de la etiqueta tal cual.
- CON BASES CHICAS (la base aparece como \"base: N respuesta(s)\"), reportá los CONTEOS ABSOLUTOS (\"1 de 3\"), NO porcentajes. Un porcentaje sobre n=1 o n=2 no es un hallazgo.
- PROHIBIDO escribir \"solo el X %\" o \"apenas el X %\" cuando X es alto (50, 66, 100...): un 100 % no es \"solo\". Reservá \"solo/apenas\" para proporciones realmente bajas, y aun así preferí el conteo absoluto.
- Cada dimensión trae su base entre paréntesis: respetala. No mezcles bases distintas.
- Tono claro y preciso, sin relleno.
- Escribí los signos de forma normal: \"33,3 %\" (no \"33,3 /%\"), \"N° 145\" (no \"N° /145\"). No uses barras \"/\" ni caracteres de escape antes de % ° o números. Texto limpio.`;

  let userPrompt = 'DATOS REALES (no inventar, usar estos):\n'+(datosTxt||'(sin datos cuantitativos conectados)')+'\n\n';
  if (bibliografiaTxt) userPrompt += 'BIBLIOGRAFÍA (fragmentos de los PDFs cargados):\n'+bibliografiaTxt+'\n\n';
  if (temas) userPrompt += 'EJES TEMÁTICOS construidos en la sesión de trabajo:\n'+temas+'\n\n';
  if (webTxt) userPrompt += 'INFORMACIÓN WEB COMPLEMENTARIA:\n'+webTxt+'\n\n';
  userPrompt += 'Redactá el informe académico completo siguiendo la estructura obligatoria.';

  const _nmAnalitico = (CONFIG && CONFIG.modos && CONFIG.modos.tars) ? CONFIG.modos.tars : 'ANALISTA';
  if (statusEl) statusEl.textContent = '✍️ ' + _nmAnalitico + ' está redactando el informe académico...';
  // v1.1: 3000 tokens para que el informe COMPLETO (incl. Conclusiones) no se trunque.
  // v3.0 — P3: el informe también reintenta ante saturación, avisando en el modal.
  const avisoInforme = (txt)=>{ if(statusEl) statusEl.textContent = txt || ('⏳ ' + _nmAnalitico + ' está redactando el informe...'); };
  let texto = await callGroqResiliente([{role:'user', content:userPrompt}], buildAnaliticoSystem(sys), 3000, 0.4, avisoInforme); // v25: el informe también se redacta con la lente del oficio
  if (!texto) return texto;

  // Red de seguridad: si el informe volvió SIN Conclusiones (o cortado), pedimos solo el cierre
  // y lo pegamos. Así nunca queda un informe sin conclusión aunque el modelo se quede sin espacio.
  const tieneConclusiones = /##\s*conclusion/i.test(texto);
  if (!tieneConclusiones){
    if (statusEl) statusEl.textContent = '✍️ Completando las conclusiones...';
    const sysCierre = personalizarPrompt('Sos TARS, analista experto en el dominio de tu usuario. Te paso un informe al que le FALTAN las conclusiones (o quedaron cortadas). Redactá SOLO la sección de conclusiones, empezando exactamente con la línea "## Conclusiones". Cerrá el análisis: qué muestran los datos y los documentos, qué queda pendiente. En español, sin relleno, sin inventar cifras. No repitas el resto del informe.');
    try {
      const cierre = await callGroqResiliente([{role:'user', content:'INFORME (para que veas el contexto, NO lo repitas):\n'+texto.slice(-2000)+'\n\nRedactá solo "## Conclusiones".'}], sysCierre, 800, 0.4, avisoInforme);
      if (cierre && /##\s*conclusion/i.test(cierre)){
        // pegamos desde el encabezado de conclusiones por si vino con preámbulo
        const idx = cierre.search(/##\s*conclusion/i);
        texto = texto.trim() + '\n\n' + cierre.slice(idx).trim();
      }
    } catch(e){ /* si el cierre falla, devolvemos el informe igual */ }
  }
  // v3.8: red de seguridad determinista. Si el texto cita porcentajes que NO surgen de los
  // datos calculados, se agrega una nota de verificación interna (nunca se altera el cuerpo).
  try {
    const cifrasRaras = auditarCifrasInforme(texto, stats);
    if (cifrasRaras.length){
      texto = texto.trim() + '\n\n## Nota de verificación (uso interno)\n'
        + 'Revisión automática del sistema: el informe menciona porcentaje(s) que no coinciden con los datos de campo calculados (' + cifrasRaras.join(', ') + '). Verificá si son correctos o si provienen de la bibliografía antes de usar el documento.';
    }
  } catch(e){ /* la auditoría jamás debe romper la generación del informe */ }
  return texto;
}

// v1.1: parte una línea de texto en segmentos {text, bold} respetando **negrita** y *cursiva*.
// Sirve para que Word/PDF rendericen el markdown que devuelve TARS en vez de mostrar los asteriscos.
function mdSegmentos(linea){
  const segs = [];
  // Tokeniza por **negrita** y *cursiva* (no anidados, suficiente para informes).
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*)/g;
  let last = 0, m;
  while ((m = re.exec(linea)) !== null){
    if (m.index > last) segs.push({ text: linea.slice(last, m.index) });
    if (m[2] !== undefined) segs.push({ text: m[2], bold:true });
    else segs.push({ text: m[3], italics:true });
    last = re.lastIndex;
  }
  if (last < linea.length) segs.push({ text: linea.slice(last) });
  return segs.length ? segs : [{ text: linea }];
}

// v3.8: AUDITORÍA DETERMINISTA DE CIFRAS — red de seguridad final anti-invención.
// Tras redactar, el CÓDIGO (no el modelo) revisa que cada PORCENTAJE citado en el informe
// coincida con un porcentaje realmente calculado de los datos (tolerancia de redondeo 1.0).
// Si aparece un % que no surge de los datos, NO altera ni bloquea el informe: lo informa
// para que se agregue una nota de verificación. Cumple la regla de oro: lo que no viene de
// los datos, se avisa. Años, conteos y "n = 3" no se tocan (solo mira tokens con "%").
function auditarCifrasInforme(texto, stats){
  if (!texto || !stats) return [];
  const legit = new Set([0, 100]);
  const push = v => { if (typeof v === 'number' && !isNaN(v)) legit.add(v); };
  (stats.dimensiones||[]).forEach(d=>{ (d.items||[]).forEach(it=> push(it.pct)); });
  const sospechosos = [];
  const re = /(\d{1,3}(?:[.,]\d+)?)\s*%/g; let m;
  while ((m = re.exec(texto)) !== null){
    const val = parseFloat(m[1].replace(',', '.'));
    if (isNaN(val)) continue;
    let ok = false;
    legit.forEach(L=>{ if (Math.abs(L - val) <= 1.0) ok = true; });
    if (!ok && !sospechosos.includes(m[1]+' %')) sospechosos.push(m[1]+' %');
  }
  return sospechosos;
}

// v1.1: quita marcas markdown para usos en texto plano (PDF lo arma con runs aparte).
/* v40-pdf-fix (FINAL) — PORTADO el 18/07/2026 desde la v4.0 live (porte LIMPIO, decisión de
   Darío: sin el código muerto de los dos intentos previos; este es el que rige en ejecución allá):
   reemplazos por código numérico de carácter (fuente 100% ASCII auditable) + RED DE SEGURIDAD:
   todo carácter que la fuente estándar del PDF no mide bien se vuelve espacio. Comillas curvas
   -> rectas, guiones largos -> guion, puntos suspensivos -> tres puntos, invisibles -> fuera.
   Tildes, enie, signos de apertura y guillemets son Latin-1: quedan INTACTOS. */
function limpiarMd(s){
  s = (s||'').replace(/\*\*([^*]+)\*\*/g,'$1').replace(/\*([^*]+)\*/g,'$1').replace(/`([^`]+)`/g,'$1');
  s = s.split(String.fromCharCode(8230)).join('...');
  var pares = [[8216,39],[8217,39],[8218,39],[8242,39],[700,39],
               [8220,34],[8221,34],[8222,34],[8243,34],
               [8211,45],[8212,45],[8722,45],[8209,45],[173,45],[160,32]];
  for (var p = 0; p < pares.length; p++){
    s = s.split(String.fromCharCode(pares[p][0])).join(String.fromCharCode(pares[p][1]));
  }
  var out = '';
  for (var i = 0; i < s.length; i++){
    var c = s.charCodeAt(i);
    if (c === 10 || c === 13 || (c >= 32 && c <= 255)) { out += s.charAt(i); }
    else if (c === 8203 || c === 8204 || c === 8205 || c === 65279) { /* invisibles: fuera */ }
    else { out += ' '; }
  }
  return out;
}

// v1.3: formatea la respuesta del modelo para que se LEA BIEN en el chat.
// El modelo a veces manda markdown crudo (**negrita**, ####, y sobre todo TABLAS con |) que
// el chat no renderiza y se ven como un amontonamiento ilegible. Esta función:
//  - escapa HTML peligroso (las respuestas vienen del modelo, pero por las dudas)
//  - convierte tablas markdown en líneas legibles "col — col — col"
//  - convierte **negrita** y *cursiva* en <strong>/<em>
//  - limpia encabezados #### y bullets, y respeta saltos de línea
function formatearParaChat(txt){
  if (!txt) return '';
  let s = String(txt);
  // escape básico
  s = s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  // limpiar tics de barra y espaciado (mismo criterio que el informe)
  s = limpiarTextoInforme(s);
  // --- TABLAS markdown -> texto legible ---
  const lineas = s.split('\n');
  const out = [];
  for (let i=0;i<lineas.length;i++){
    const l = lineas[i];
    // ¿es fila de tabla? (empieza/contiene pipes con contenido)
    if (/^\s*\|.*\|\s*$/.test(l)){
      // saltar filas separadoras |---|---|
      if (/^\s*\|[\s:\-|]+\|\s*$/.test(l)) continue;
      const celdas = l.split('|').map(c=>c.trim()).filter(c=>c!=='');
      if (celdas.length){ out.push(celdas.join(' — ')); continue; }
    }
    out.push(l);
  }
  s = out.join('\n');
  // encabezados #### -> negrita en su propia línea
  s = s.replace(/^#{1,6}\s*(.+)$/gm, '<strong>$1</strong>');
  // negrita / cursiva / código
  s = s.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>')
       .replace(/(^|[^*])\*([^*\n]+)\*/g,'$1<em>$2</em>')
       .replace(/`([^`]+)`/g,'$1');
  // bullets "- " o "• " al inicio de línea -> "• "
  s = s.replace(/^[ \t]*[-•]\s+/gm,'• ');
  // saltos de línea -> <br>
  s = s.replace(/\n{2,}/g,'<br><br>').replace(/\n/g,'<br>');
  return s;
}

// v3.5: NORMALIZACIÓN UNICODE. El motor de respaldo (gpt-oss/Cerebras) cuela caracteres
// invisibles entre palabras: espacios de ancho cero (U+200B/C/D, U+FEFF, U+2060) y espacios
// exóticos (nbsp, en/em space, etc.). Consecuencias en el PDF: jsPDF a veces no parte donde
// debe -> renglones que se recortan en el margen ("...describir la con"); y la regex del
// limpiador de barras no matchea porque el ancho-cero NO es \s en JS -> sobrevive "Río /Negro".
// CLAVE (verificado en banco jsPDF real): el ancho-cero NO se borra a secas (pegaría palabras:
// "describirlaconfiguración"); se convierte en ESPACIO, devolviéndole a jsPDF sus puntos de
// corte. Una sola pasada deja el texto limpio para chat, voz, Word y PDF a la vez.
function normalizarUnicode(t){
  return (t||'')
    .replace(/[\u200B\u200C\u200D\u2060\uFEFF]/g, ' ')               // ancho-cero -> ESPACIO (re-separa palabras)
    .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ')// espacios exóticos -> espacio normal
    .replace(/[\u2018\u2019]/g, "'")                                   // ‘ ’ -> '
    .replace(/[\u201C\u201D]/g, '"')                                   // “ ” -> "
    .replace(/[\u2013\u2014]/g, '-')                                   // – — (en/em dash) -> guion simple (jsPDF helvetica los maneja mejor)
    .replace(/\u2026/g, '...')                                          // … -> ...
    .replace(/[ \t]{2,}/g, ' ');                                       // colapsa espacios que hayan quedado
}

// v1.2: limpia tics del modelo que ensucian el informe (barras espurias antes de % y números,
// espacios dobles, espacios antes de signos de puntuación). NO altera el contenido real.
// v3.5: arranca normalizando Unicode (cinturón y tiradores) para que la regex de barras vea
// espacios reales donde el motor metió ancho-cero.
function limpiarTextoInforme(t){
  if (!t) return '';
  return normalizarUnicode(t)
    // 1) Barra espuria del modelo: " /palabra", " /Número", " /%". El modelo la mete antes de
    //    casi cualquier token. La quitamos SOLO cuando hay un espacio antes (así no rompemos
    //    fechas "12/05" ni fracciones "y/o" ni URLs "http://").
    .replace(/(\s)\/(?=[%A-Za-zÁÉÍÓÚÑáéíóúñ0-9])/g, '$1')   // " /Negro"→" Negro", " /2005"→" 2005", " /%"→" %"
    .replace(/N°\s*\/?\s*(\d)/g, 'N° $1')   // "N°/145" / "N° /145" / "N°145" -> "N° 145"
    .replace(/([a-záéíóúñ])(N°)/g, '$1 $2') // "TécnicaN°" -> "Técnica N°"
    .replace(/[ \t]{2,}/g, ' ')             // espacios dobles -> uno
    .replace(/\s+([,.;:])/g, '$1')          // espacio antes de , . ; : -> pegado (NO toca %)
    .replace(/(\d)\s*%/g, '$1 %')           // "33,3%" o "33,3  %" -> "33,3 %"
    .replace(/%([A-Za-zÁÉÍÓÚáéíóúñ])/g, '% $1')  // "% de" si quedó pegado
    .replace(/\(\s+/g, '(').replace(/\s+\)/g, ')')  // paréntesis sin espacios internos
    .replace(/[ \t]+\n/g, '\n');            // espacios al final de línea
}

// Parsea el informe de TARS en secciones. Cada bloque se TIPA para renderizarlo bien:
//  - tipo 'subtitulo'  (encabezados ### dentro de una sección)
//  - tipo 'lista-num'  (1. 2. 3.)  /  'lista-bullet'  (- o •)
//  - tipo 'texto'      (párrafo normal, con **negrita** intacta para procesar luego)
function parsearInforme(texto){
  if (!texto) return [];
  texto = limpiarTextoInforme(texto);
  const secciones = [];
  let actual = null;
  const push = (b)=>{ if (!actual){ actual = { titulo:'', bloques:[] }; secciones.push(actual); } actual.bloques.push(b); };
  texto.split('\n').forEach(raw=>{
    const l = raw.trim();
    if (!l) return;
    // Encabezado de sección de primer nivel: "## Título"
    let m = l.match(/^##\s+(.+)/) && !l.match(/^###\s+/) ? l.match(/^##\s+(.+)/) : null;
    if (m){ actual = { titulo: limpiarMd(m[1].trim()), bloques:[] }; secciones.push(actual); return; }
    // Subtítulo interno: "### Subtítulo"  (o "#### ")
    m = l.match(/^#{3,}\s+(.+)/);
    if (m){ push({ tipo:'subtitulo', texto: limpiarMd(m[1].trim()) }); return; }
    // Lista numerada: "1. ..." / "1) ..."
    m = l.match(/^(\d+)[.)]\s+(.+)/);
    if (m){ push({ tipo:'lista-num', texto: m[2].trim() }); return; }
    // Lista con viñeta: "- ..." / "• ..." / "* ..." (asterisco SOLO si va seguido de espacio)
    m = l.match(/^[-•]\s+(.+)/) || l.match(/^\*\s+(.+)/);
    if (m){ push({ tipo:'lista-bullet', texto: m[1].trim() }); return; }
    // Párrafo normal
    push({ tipo:'texto', texto: l });
  });
  return secciones;
}

// Decide en qué sección insertar los gráficos (después de "Resultados").
function esSeccionResultados(titulo){ return /resultado/i.test(titulo); }

function cargarScript(src){
  return new Promise((res,rej)=>{
    const s=document.createElement('script'); s.src=src; s.onload=res; s.onerror=()=>rej(new Error('No se pudo cargar '+src));
    document.head.appendChild(s);
  });
}
// v0.8: intenta varias fuentes (CDN) hasta que una cargue. Arregla el fallo de docx.
async function cargarConFallback(urls, checkGlobal){
  if (window[checkGlobal]) return;
  for (const url of urls){
    try { await cargarScript(url); if (window[checkGlobal]) return; }
    catch(e){ /* probamos la siguiente */ }
  }
  if (!window[checkGlobal]) throw new Error('No se pudo cargar la librería desde ningún servidor. Revisá tu conexión.');
}
const CDN_DOCX = [
  'https://cdnjs.cloudflare.com/ajax/libs/docx/8.5.0/docx.min.js',
  'https://unpkg.com/docx@8.5.0/build/index.umd.js',
  'https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.min.js'
];
const CDN_JSPDF = [
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js',
  'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'
];
// v16: respaldo multi-CDN también para lectura de documentos (subir PDF/DOCX).
const CDN_PDFJS = [
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js',
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js'
];
const CDN_MAMMOTH = [
  'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js',
  'https://unpkg.com/mammoth@1.6.0/mammoth.browser.min.js',
  'https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js'
];

// Filtra el log dejando solo el intercambio analítico (preguntas + respuestas),
// descartando mensajes de sistema/estado (conexiones, memoria restaurada, etc.).
function construirContenidoInforme(){
  const SKIP = ['Memoria restaurada','Memoria borrada','documento(s) cargados','Base de datos','Acceso a base de datos','Perfil actualizado','cargados desde memoria','conectada'];
  const items = informeLog.filter(m=>{
    if (m.role==='user' && m.text.trim()) return true;
    if (m.role==='mirror' && (m.style==='tars' || m.style==='db')) return true;
    return false;
  }).filter(m=> !SKIP.some(s=> m.text.includes(s)) );
  return items;
}

function abrirModalInforme(){
  const items = construirContenidoInforme();
  const stats = calcularEstadisticas();
  if (!items.length && !stats){
    alert('Todavía no hay nada para el informe. Conectá la base de datos externa o hacé al menos una consulta a '+((CONFIG&&CONFIG.modos&&CONFIG.modos.tars)||'ANALISTA')+'.');
    return;
  }
  const docNames = ragDocs.map(d=>d.name);
  const m = document.getElementById('modal-informe');
  document.getElementById('informe-resumen').innerHTML =
    (stats ? '<strong>'+stats.totalRegistros+'</strong> registros reales (con gráficos) · ' : '') +
    '<strong>'+items.filter(i=>i.role==='user').length+'</strong> consulta(s) · '+
    '<strong>'+docNames.length+'</strong> documento(s)';
  m.classList.add('visible');
}
function cerrarModalInforme(){ document.getElementById('modal-informe').classList.remove('visible'); }

// v15: BIBLIOGRAFÍA del informe — VACÍA por defecto (marca blanca / universal).
// Antes traía hardcodeada bibliografía específica de un dominio, que se colaba en el
// informe de CUALQUIER usuario (músico, escritor, etc.) rotulada "verificada por el autor".
// Eso rompía marca blanca + no-mentir, así que se quitó (mismo criterio que AUTORES_BIB).
// Con el array vacío, el informe lista AUTOMÁTICAMENTE los documentos REALES que cargó el
// usuario (fallback meta.docNames ya codeado en los generadores Word/PDF). Si algún usuario
// quiere una bibliografía curada a mano, suma sus citas APA acá.
const BIBLIOGRAFIA_APA = [];

function metadatosInforme(){
  const fecha = new Date().toLocaleString('es-AR',{dateStyle:'long',timeStyle:'short',hourCycle:'h23'}); // v40-1029: 24 h siempre
  const docNames = ragDocs.map(d=>d.name);
  return { fecha, docNames, nReg: tesisData ? tesisData.length : 0 };
}

// --- Generar Word (.docx): informe ACADÉMICO escrito por TARS + gráficos ---
async function descargarWord(){
  const prev = document.getElementById('informe-status');
  try {
    // 1) TARS redacta el informe académico (datos + bibliografía + temas + web)
    const textoInforme = await generarInformeAcademico(prev);
    if (!textoInforme){ prev.textContent = mensajeError('rate_limit'); return; /* v40-web: sin «⚠️ ⚠️» */ }

    prev.textContent = '⏳ Armando el documento Word con gráficos...';
    await cargarConFallback(CDN_DOCX, 'docx');
    const { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun, AlignmentType, LevelFormat } = window.docx;
    const meta = metadatosInforme();
    const stats = calcularEstadisticas();
    const secciones = parsearInforme(textoInforme);

    const children = [];
    const P = (txt,opt)=> new Paragraph({ children:[new TextRun(Object.assign({text:txt},opt||{}))], spacing:{after:120} });
    // v1.1: párrafo con **negrita**/*cursiva* convertidas a runs reales.
    const Prich = (txt,extra)=> new Paragraph({ children: mdSegmentos(txt).map(s=>new TextRun(Object.assign({text:s.text, bold:s.bold||false, italics:s.italics||false}, extra||{}))), spacing:{after:120} });
    // v1.1: ítem de lista (bullet o numerada) con negritas internas.
    const Pitem = (txt, ref)=> new Paragraph({ numbering:{reference:ref, level:0}, children: mdSegmentos(txt).map(s=>new TextRun({text:s.text, bold:s.bold||false, italics:s.italics||false})), spacing:{after:60} });

    // Portada
    children.push(new Paragraph({ text:'Informe de análisis — MIRROR «El Origen»', heading:HeadingLevel.TITLE }));
    children.push(P('Informe generado con MIRROR «El Origen»', {italics:true, color:'666666'}));
    children.push(P('Generado: '+meta.fecha, {size:18, color:'888888'}));
    children.push(new Paragraph({ text:'' }));

    // Función para insertar todos los gráficos
    const insertarGraficos = ()=>{
      if (!stats) return;
      const dims = stats.dimensiones.map(d=>[d.etiqueta, d.items]);
      dims.forEach(([titulo,datos])=>{
        if (!datos || !datos.length) return;
        const g = generarGraficoBarras(titulo, datos);
        children.push(new Paragraph({ children:[ new ImageRun({ type:'png', data: dataUrlABytes(g.dataUrl), transformation:{ width:560, height:Math.round(g.h*560/g.w) } }) ], spacing:{after:80} }));
      });
      children.push(new Paragraph({ text:'' }));
    };

    // Cuerpo: secciones del informe de TARS; los gráficos van tras "Resultados"
    // v1.2: cada GRUPO de lista numerada usa su propia referencia para reiniciar en 1.
    // (Antes una sola ref acumulaba: Resultados 1-4 → Conclusiones seguía en 5,6,7...)
    const numRefs = []; // referencias de listas numeradas creadas, para declararlas en config
    let grupoNum = 0;       // contador de grupos numerados
    let refNumActual = null; // ref del grupo numerado en curso
    let enListaNum = false;  // venimos de un ítem numerado consecutivo
    let graficosInsertados = false;
    secciones.forEach(sec=>{
      if (sec.titulo) children.push(new Paragraph({ text:sec.titulo, heading:HeadingLevel.HEADING_1 }));
      enListaNum = false; refNumActual = null; // cada sección reinicia el grupo
      (sec.bloques||[]).forEach(b=>{
        if (b.tipo === 'lista-num'){
          if (!enListaNum){ // arranca un grupo nuevo → ref nueva que empieza en 1
            grupoNum++; refNumActual = 'inf-num-'+grupoNum; numRefs.push(refNumActual); enListaNum = true;
          }
          children.push(Pitem(b.texto, refNumActual));
          return;
        }
        enListaNum = false; refNumActual = null;
        if (b.tipo === 'subtitulo') children.push(new Paragraph({ text:b.texto, heading:HeadingLevel.HEADING_2 }));
        else if (b.tipo === 'lista-bullet') children.push(Pitem(b.texto, 'inf-bullet'));
        else children.push(Prich(b.texto));
      });
      if (esSeccionResultados(sec.titulo)){ insertarGraficos(); graficosInsertados = true; }
    });
    // Si TARS no tituló "Resultados", insertamos los gráficos al final del cuerpo
    if (!graficosInsertados){ children.push(new Paragraph({ text:'Gráficos', heading:HeadingLevel.HEADING_1 })); insertarGraficos(); }

    // Bibliografía
    const refsWord = (typeof BIBLIOGRAFIA_APA!=='undefined' && BIBLIOGRAFIA_APA.length)
      ? BIBLIOGRAFIA_APA : meta.docNames.map(limpiarNombreDoc).filter(function(r,i,a){ return r && a.indexOf(r) === i; }); // v40-audit: el PDF de Darío traía «TP Tello MIRROR» tres veces
    if (refsWord.length){
      children.push(new Paragraph({ text:'Bibliografía', heading:HeadingLevel.HEADING_1 }));
      refsWord.forEach(ref=> children.push(new Paragraph({ numbering:{reference:'inf-bib', level:0}, children:[new TextRun(ref)] }))); // v3.7: APA verificada por el autor
      children.push(new Paragraph({ children:[new TextRun({ text:'Referencias en normas APA, verificadas por el autor. Documento de trabajo interno.', italics:true, size:16, color:'8a8a90' })], spacing:{before:120} }));
    }

    // Config de numeración: una entrada decimal por cada grupo numerado + bullets.
    const numConfig = [
      { reference:'inf-bullet', levels:[{ level:0, format:LevelFormat.BULLET, text:'•', alignment:AlignmentType.LEFT, style:{ paragraph:{ indent:{ left:720, hanging:360 } } } }] },
      { reference:'inf-bib', levels:[{ level:0, format:LevelFormat.BULLET, text:'•', alignment:AlignmentType.LEFT, style:{ paragraph:{ indent:{ left:720, hanging:360 } } } }] },
    ];
    numRefs.forEach(ref=> numConfig.push(
      { reference:ref, levels:[{ level:0, format:LevelFormat.DECIMAL, text:'%1.', alignment:AlignmentType.LEFT, style:{ paragraph:{ indent:{ left:720, hanging:360 } } } }] }
    ));

    const doc = new Document({
      numbering:{ config: numConfig },
      sections:[{ properties:{}, children }]
    });
    const blob = await Packer.toBlob(doc);
    bajarBlob(blob, 'Informe_MIRROR_'+fechaArchivo()+'.docx');
    prev.textContent = '✅ Word descargado.';
    setTimeout(()=>{ cerrarModalInforme(); prev.textContent=''; }, 1800);
  } catch(e){ prev.textContent = '❌ Error: '+e.message; }
}

// --- Generar PDF: informe ACADÉMICO escrito por TARS + gráficos ---
// v3.2 — REDISEÑO VISUAL COMPLETO (fix "los PDFs son horribles", verificación celu 12/6):
// portada con banda estilo MIRROR, títulos con regla, jerarquía tipográfica consistente,
// figuras con epígrafe numerado, bibliografía con sangría francesa y pie con paginación
// "pág. X de Y" en todas las páginas. La estructura del contenido no cambia.
async function descargarPDF(){
  const prev = document.getElementById('informe-status');
  try {
    const textoInforme = await generarInformeAcademico(prev);
    if (!textoInforme){ prev.textContent = mensajeError('rate_limit'); return; /* v40-web: sin «⚠️ ⚠️» */ }

    prev.textContent = '⏳ Armando el PDF con gráficos...';
    await cargarConFallback(CDN_JSPDF, 'jspdf');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit:'mm', format:'a4' });
    const meta = metadatosInforme();
    const stats = calcularEstadisticas();
    const secciones = parsearInforme(textoInforme);

    const margin = 20, ancho = 210 - margin*2, LH = 5.2;
    const VERDE=[15,110,86], AZUL=[40,90,120], GRIS=[125,125,135], TINTA=[35,35,40];
    const LIMITE = 272; // piso del cuerpo: deja lugar al pie de página
    let y = margin;
    const nl   = (inc)=>{ y += inc; if (y > LIMITE){ doc.addPage(); y = margin; } };
    const need = (h)=>{ if (y + h > LIMITE){ doc.addPage(); y = margin; } };

    // ── PORTADA: banda oscura MIRROR con filo violeta ──
    doc.setFillColor(13,13,26);    doc.rect(0, 0, 210, 42, 'F');
    doc.setFillColor(112,112,255); doc.rect(0, 42, 210, 1.1, 'F');
    doc.setTextColor(150,150,205); doc.setFont('helvetica','normal'); doc.setFontSize(9);
    doc.text('P R O Y E C T O   M I R R O R', margin, 14);
    doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(19);
    doc.text('Informe de análisis — «El Origen»', margin, 24.5);
    doc.setFont('helvetica','italic'); doc.setFontSize(10.5); doc.setTextColor(195,195,235);
    doc.text('Informe generado con MIRROR «El Origen»', margin, 33);
    y = 52;
    doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(GRIS[0],GRIS[1],GRIS[2]);
    doc.text('Generado por '+((CONFIG&&CONFIG.modos&&CONFIG.modos.tars)||'ANALISTA')+' · '+meta.fecha, margin, y); nl(9);
    doc.setTextColor(TINTA[0],TINTA[1],TINTA[2]);

    // ── Títulos con jerarquía ──
    const H1 = (t)=>{ need(20); nl(2.5);
      doc.setFont('helvetica','bold'); doc.setFontSize(13.5); doc.setTextColor(VERDE[0],VERDE[1],VERDE[2]);
      doc.splitTextToSize(limpiarMd(t), ancho).forEach(l=>{ doc.text(l, margin, y); nl(6.5); });
      doc.setDrawColor(VERDE[0],VERDE[1],VERDE[2]); doc.setLineWidth(0.45);
      doc.line(margin, y-3.4, margin+ancho, y-3.4); nl(2.2);
      doc.setTextColor(TINTA[0],TINTA[1],TINTA[2]);
    };
    const H2 = (t)=>{ need(12); nl(1.5);
      doc.setFont('helvetica','bold'); doc.setFontSize(11.5); doc.setTextColor(AZUL[0],AZUL[1],AZUL[2]);
      doc.splitTextToSize(limpiarMd(t), ancho).forEach(l=>{ doc.text(l, margin, y); nl(5.8); });
      doc.setTextColor(TINTA[0],TINTA[1],TINTA[2]); nl(0.6);
    };

    // ── Figuras con epígrafe numerado (el título va FUERA de la imagen) ──
    let figura = 0;
    const insertarGraficos = ()=>{
      if (!stats) return;
      const dims = stats.dimensiones.map(d=>[d.etiqueta, d.items]);
      dims.forEach(([titulo,datos])=>{
        if (!datos || !datos.length) return;
        const g = generarGraficoBarras(titulo, datos, { sinTitulo:true });
        const imgW = ancho - 14, imgH = g.h*imgW/g.w;
        need(imgH + 13);
        nl(2);
        doc.addImage(g.dataUrl, 'PNG', margin+7, y, imgW, imgH); nl(imgH + 4.5);
        figura++;
        doc.setFont('helvetica','italic'); doc.setFontSize(9); doc.setTextColor(GRIS[0],GRIS[1],GRIS[2]);
        doc.text('Figura '+figura+'. '+titulo+'.', margin+7, y); nl(8);
        doc.setFont('helvetica','normal'); doc.setTextColor(TINTA[0],TINTA[1],TINTA[2]);
      });
    };

    let graficosInsertados = false;
    // v3.4 — TIPOGRAFÍA A PRUEBA DE BALAS (capturas del 12/6: letras estiradas, desbordes
    // del margen y renglones pisados, SIEMPRE donde había **negritas**): el camino "mixto"
    // que dibujaba palabra por palabra queda ELIMINADO DE RAÍZ. Todo el cuerpo se imprime
    // con splitTextToSize nativo de jsPDF — un solo tamaño, un solo estilo por bloque,
    // jamás desborda ni superpone. Las marcas ** y * se quitan del texto del PDF
    // (el Word sí conserva las negritas; el PDF prioriza ser impecable).
    const printRich = (txt, x, fontSize, baseStyle)=>{
      doc.setFont('helvetica', baseStyle||'normal');
      doc.setFontSize(fontSize);
      const lineas = doc.splitTextToSize(limpiarMd(txt), ancho - (x - margin));
      lineas.forEach(l=>{ need(LH+1); doc.text(l, x, y); nl(LH); });
      doc.setFont('helvetica','normal');
    };

    // ── Cuerpo ──
    secciones.forEach(sec=>{
      if (sec.titulo) H1(sec.titulo);
      let numItem = 0;
      (sec.bloques||[]).forEach(b=>{
        if (b.tipo === 'subtitulo'){
          numItem = 0;
          H2(b.texto);
        } else if (b.tipo === 'lista-num' || b.tipo === 'lista-bullet'){
          need(LH+2);
          let vinheta;
          if (b.tipo === 'lista-num'){ numItem++; vinheta = numItem + '.'; }
          else { vinheta = '•'; }
          doc.setFont('helvetica','normal'); doc.setFontSize(10.5);
          doc.setTextColor(VERDE[0],VERDE[1],VERDE[2]);
          doc.text(vinheta, margin+2, y);
          doc.setTextColor(TINTA[0],TINTA[1],TINTA[2]);
          printRich(b.texto, margin+9, 10.5, 'normal');
          nl(0.8);
        } else {
          numItem = 0;
          need(LH+2);
          printRich(b.texto, margin, 10.5, 'normal');
          nl(2.2);
        }
      });
      if (esSeccionResultados(sec.titulo)){ insertarGraficos(); graficosInsertados = true; }
    });
    if (!graficosInsertados){ H1('Gráficos'); insertarGraficos(); }

    // ── Bibliografía en APA (sangría francesa) ──
    // v3.7: lista APA verificada por el autor; si estuviera vacía, cae a los nombres de archivo limpios.
    const refsPDF = (typeof BIBLIOGRAFIA_APA!=='undefined' && BIBLIOGRAFIA_APA.length)
      ? BIBLIOGRAFIA_APA : meta.docNames.map(limpiarNombreDoc).filter(function(r,i,a){ return r && a.indexOf(r) === i; }); // v40-audit: el PDF de Darío traía «TP Tello MIRROR» tres veces
    if (refsPDF.length){
      H1('Bibliografía');
      doc.setFont('helvetica','normal'); doc.setFontSize(9.5); doc.setTextColor(70,70,78);
      refsPDF.forEach(ref=>{
        const lineas = doc.splitTextToSize(ref, ancho - 6);
        need(lineas.length*4.5 + 1.6);
        doc.setTextColor(VERDE[0],VERDE[1],VERDE[2]); doc.text('•', margin, y);
        doc.setTextColor(70,70,78);
        lineas.forEach(l=>{ doc.text(l, margin+5, y); nl(4.5); });
        nl(1.2);
      });
      // Nota para el autor (el informe es de uso interno): recordatorio de verificación.
      nl(1.5); doc.setFont('helvetica','italic'); doc.setFontSize(8); doc.setTextColor(130,130,138);
      doc.splitTextToSize('Referencias en normas APA, verificadas por el autor. Documento de trabajo interno.', ancho).forEach(l=>{ doc.text(l, margin, y); nl(3.8); });
      doc.setFont('helvetica','normal');
      doc.setTextColor(TINTA[0],TINTA[1],TINTA[2]);
    }

    // ── Pie de página en TODAS las hojas: regla + firma + "pág. X de Y" ──
    const total = doc.getNumberOfPages();
    for (let p=1; p<=total; p++){
      doc.setPage(p);
      doc.setDrawColor(205,205,215); doc.setLineWidth(0.25);
      doc.line(margin, 283, 210-margin, 283);
      doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(145,145,155);
      doc.text('MIRROR «El Origen» · idea de Darío A. Tello', margin, 288);
      doc.text('pág. '+p+' de '+total, 210-margin, 288, { align:'right' });
    }

    doc.save('Informe_MIRROR_'+fechaArchivo()+'.pdf');
    prev.textContent = '✅ PDF descargado.';
    setTimeout(()=>{ cerrarModalInforme(); prev.textContent=''; }, 1800);
  } catch(e){ prev.textContent = '❌ Error: '+e.message; }
}

// --- Generar JSON estructurado (para verificación / análisis posterior con Claude) ---
function descargarJSON(){
  const prev = document.getElementById('informe-status');
  prev.textContent = '⏳ Generando JSON...';
  try {
    const items = construirContenidoInforme();
    const meta = metadatosInforme();
    // Emparejamos cada consulta con su respuesta para que quede legible y estructurado.
    const intercambios = [];
    for (let i=0; i<items.length; i++){
      if (items[i].role==='user'){
        const respuestas = [];
        const fuentes = [];
        let j = i+1;
        while (j<items.length && items[j].role!=='user'){
          respuestas.push(items[j].text);
          if (items[j].fuentes) items[j].fuentes.forEach(f=>fuentes.push(f));
          j++;
        }
        intercambios.push({
          n: intercambios.length+1,
          consulta: items[i].text,
          respuesta_tars: respuestas.join('\n\n'),
          fuentes: fuentes,
          timestamp: items[i].ts
        });
      }
    }
    const payload = {
      proyecto: 'MIRROR «El Origen»',
      autor: (perfilData && perfilData.nombre) ? perfilData.nombre : 'Usuario de MIRROR',
      institucion: 'MIRROR «El Origen»',
      generado: new Date().toISOString(),
      generado_legible: meta.fecha,
      version_app: 'v1.0',
      estadisticas_reales: calcularEstadisticas(),
      documentos_en_memoria: ragDocs.map(d=>({ nombre:d.name, tipo:d.type, fragmentos:d.nChunks||null })),
      registros_base: meta.nReg,
      total_consultas: intercambios.length,
      intercambios
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
    bajarBlob(blob, 'Informe_MIRROR_'+fechaArchivo()+'.json');
    prev.textContent = '✅ JSON descargado.';
    setTimeout(()=>{ cerrarModalInforme(); prev.textContent=''; }, 1500);
  } catch(e){ prev.textContent = '❌ Error: '+e.message; }
}

function bajarBlob(blob, nombre){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 2000);
}
function fechaArchivo(){ const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }

/* ══════════ v38-cumpli (H1) — CUMPLIMIENTO COMO BANDERA ══════════
   Tres piezas, y las tres existen por la misma razón: que nadie tenga que confiar a ciegas.
   1) AVISO DE IA — una línea al abrir, clara, sin letra chica. Desde el 2/08/2026 el
      Artículo 50 del EU AI Act lo exige para cualquier sistema que interactúe con personas;
      acá ya era lo que correspondía. En la white-label pesa más: quien recibe esta app no
      conoce a quien la armó, así que se le dice a dónde van sus datos, con el host adelante.
   2) PANEL «QUÉ HAGO CON LO TUYO» — el inventario REAL, armado en el momento.
   3) RECORDATORIO DE PAUSA — a los 25 minutos o 20 idas y vueltas, una vez, apagable.
   Además: las imágenes generadas quedan MARCADAS como generadas por IA (Art. 50 también).
   La marca legible por máquina (watermark/metadatos) tiene plazo hasta el 2/12/2026 y NO
   está hecha: se dice acá para que nadie la dé por hecha. */
/* ══════════ v38-apagado (H3) — EL MIRROR QUE SE APAGA SOLO ══════════
   Un límite de tiempo diario que se pone el propio usuario. Ninguna app del mercado hace
   esto porque a todas les conviene que te quedes: es la bandera más distintiva del proyecto
   y la más barata de construir (H1 ya dejó el contador de sesión armado).
   TRES REGLAS, y las tres son de fondo:
   1) Viene APAGADO. Un límite que no elegiste no es cuidado, es paternalismo.
   2) Cuando se cumple, avisa y frena — pero SIEMPRE deja seguir. Trabar a alguien afuera de
      su propia herramienta es peligroso: no sabemos para qué la necesita en ese momento.
   3) Nunca reta ni culpa. «Llegaste al límite que vos te pusiste» — y nada más. La app no
      opina sobre cómo usás tu tiempo; solo sostiene lo que vos decidiste.
   El uso se cuenta por minuto y SOLO con la pestaña a la vista: si la dejás abierta de fondo
   no te come el día. Todo vive en tu dispositivo, y se reinicia cada día. */
const APAGADO_OPCIONES = [0, 30, 60, 90];
let apagadoActivo = false, apagadoTimer = null;
function apagadoLimite(){ try{ const v=parseInt(localStorage.getItem('mirror_apagado_min')||'0',10); return (APAGADO_OPCIONES.indexOf(v)>=0)?v:0; }catch(e){ return 0; } }
function apagadoHoy(){ const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function apagadoUso(){
  try{ const o=JSON.parse(localStorage.getItem('mirror_apagado_uso')||'{}'); return (o && o.d===apagadoHoy()) ? (o.min||0) : 0; }catch(e){ return 0; }
}
function apagadoSumar(m){
  try{ localStorage.setItem('mirror_apagado_uso', JSON.stringify({ d:apagadoHoy(), min:apagadoUso()+m })); }catch(e){}
}
function apagadoSet(min){
  try{ localStorage.setItem('mirror_apagado_min', String(min)); }catch(e){}
  apagadoActivo = false;
  try{ cumpliAbrir(); }catch(e){}
  try{ addMsg('mirror', min ? ('Listo — límite de '+min+' minutos por día. Cuando se cumpla te aviso y freno. Vas a poder seguir igual si lo necesitás: el límite es tuyo, no una condena.')
                            : 'Listo — saqué el límite diario. Sin tope, como estaba.'); }catch(e){}
}
function apagadoSeguir(extra){
  apagadoActivo = false;
  if (extra) apagadoSumar(-extra); // se corre el mostrador, no se borra lo usado
  try{ addMsg('mirror', extra ? ('Dale, seguimos '+extra+' minutos más. Sin culpa: vos sabés lo que necesitás.') : 'Dale, seguimos. El límite queda para mañana.'); }catch(e){}
}
function apagadoTarjeta(){
  try{
    const chat=document.getElementById('chat'); if(!chat) return;
    const lim=apagadoLimite();
    const div=document.createElement('div'); div.className='msg';
    div.innerHTML='<div class="av mav" style="opacity:0;"></div><div class="actua-card">'
      +'<div class="actua-tit">🌙 Llegaste a tus '+lim+' minutos de hoy</div>'
      +'<div class="actua-det">Es el límite que vos te pusiste. Nada se pierde: tu memoria queda donde está y mañana seguimos. Si lo necesitás de verdad, seguí — para eso están los botones.</div>'
      +'<a class="actua-btn" href="#" data-seguir="10">10 minutos más</a>'
      +'<a class="actua-btn actua-share" href="#" data-seguir="0">seguir sin límite hoy</a></div>';
    div.querySelectorAll('[data-seguir]').forEach(function(b){
      b.addEventListener('click', function(ev){ ev.preventDefault(); apagadoSeguir(parseInt(b.getAttribute('data-seguir'),10)||0); });
    });
    chat.appendChild(div); chat.scrollTop=chat.scrollHeight;
  }catch(e){ try{ regError('apagado:tarjeta',e) }catch(_){} }
}
function apagadoChequear(){
  const lim=apagadoLimite();
  if(!lim || apagadoActivo) return;
  if(apagadoUso() >= lim){ apagadoActivo = true; apagadoTarjeta(); }
}
function apagadoBloquea(){ // se llama al enviar: si el límite se cumplió, no sale el mensaje
  if(!apagadoActivo) return false;
  apagadoTarjeta();
  return true;
}
function apagadoArrancar(){
  if(apagadoTimer) return;
  apagadoTimer = setInterval(function(){
    try{
      if(!apagadoLimite()) return;
      if(typeof document!=='undefined' && document.visibilityState && document.visibilityState!=='visible') return; // de fondo no cuenta
      apagadoSumar(1); apagadoChequear();
    }catch(e){}
  }, 60000);
}
setTimeout(function(){ try{ apagadoArrancar(); }catch(e){} }, 3000);

const CUMPLI_PAUSA_MIN = 25;     // minutos de sesión
const CUMPLI_PAUSA_TURNOS = 20;  // idas y vueltas
let cumpliInicio = Date.now(), cumpliTurnos = 0, cumpliPausaMostrada = false;
function cumpliPausaActiva(){ try{ return localStorage.getItem('mirror_pausa_off')!=='1'; }catch(e){ return true; } }
function cumpliPausaToggle(){
  let activa=cumpliPausaActiva();
  try{ localStorage.setItem('mirror_pausa_off', activa?'1':'0'); }catch(e){}
  activa=!activa;
  try{ const b=document.getElementById('cumpli-pausa-btn'); if(b) b.textContent = activa?'recordatorio de pausa: ON':'recordatorio de pausa: OFF'; }catch(e){}
  try{ addMsg('mirror', activa?'Listo — te voy a avisar cuando lleves un rato largo acá. No para echarte: para devolverte a tu vida.':'Listo — no te aviso más de las pausas. Queda a tu criterio, como tiene que ser.'); }catch(e){}
}
function cumpliEsc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function cumpliInventario(){
  let claves=0, agenda=0;
  try{ for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k&&k.indexOf('mirror_')===0) claves++; } }catch(e){}
  try{ agenda=Object.keys(JSON.parse(localStorage.getItem('mirror_agenda')||'{}')).length; }catch(e){}
  return {
    app: (typeof CONFIG!=='undefined' && CONFIG.appName) ? String(CONFIG.appName) : 'MIRROR',
    claves: claves,
    agenda: agenda,
    recuerdos: (typeof recuerdosChunks!=='undefined' && Array.isArray(recuerdosChunks)) ? recuerdosChunks.length : 0,
    docs: (typeof ragDocs!=='undefined' && Array.isArray(ragDocs)) ? ragDocs.length : 0,
    base: (typeof FB_URL!=='undefined' && FB_URL) ? String(FB_URL) : '',
    proxy: (typeof PROXY_URL!=='undefined' && PROXY_URL) ? String(PROXY_URL) : '',
    vozLocal: (typeof vozLocal!=='undefined') ? !!vozLocal : false,
    imagenes: !!(typeof POLLI_KEY!=='undefined' && POLLI_KEY),
    roles: (function(){ try{ return (CONFIG && CONFIG.roles && CONFIG.roles.aceptado) ? String(CONFIG.roles.aceptado).slice(0,10) : ''; }catch(e){ return ''; } })()
  };
}
function cumpliHTML(){
  const inv=cumpliInventario();
  const host=function(u){ try{ return u ? new URL(u).host : ''; }catch(e){ return u||''; } };
  const nom=cumpliEsc(inv.app);
  return ''
  +'<div class="cumpli-sec"><h4>Lo primero, sin vueltas</h4>'
  +'<p>'+nom+' es una <b>inteligencia artificial</b>, no una persona. No tiene conciencia y <b>se puede equivocar</b>: lo importante, verificalo. Que te hable en criollo no lo vuelve humano.</p></div>'
  +'<div class="cumpli-sec"><h4>Quién es quién acá</h4>'
  +'<p>Esta app la armó alguien con la plataforma <b>MIRROR</b>, y esa persona <b>eligió dónde se guardan tus datos</b>. '
  +(inv.base?'Van a <b>'+cumpliEsc(host(inv.base))+'</b>: esa base es de esa persona, no de la plataforma ni de un tercero.':'No configuró ninguna base, así que no se guarda nada fuera de este dispositivo.')
  +' Es justo que lo sepas antes de contarle nada íntimo.</p>'
  +'<p><b>La plataforma aporta la arquitectura, no maneja datos:</b> este archivo corre entero en tu navegador y no tiene ningún servidor detrás. Quien programó la plataforma nunca ve, guarda ni puede recuperar lo que vos escribas. Las decisiones sobre tus datos las toma quien configuró esta app — y vos, al elegir qué contarle.</p>'
  /* Si hay constancia, se muestra. No es para lucirla: es para que quien usa la app sepa
     que la persona que la armó leyó qué responsabilidad estaba tomando. */
  +(inv.roles?'<p style="opacity:0.7;">Quien configuró esta app dejó constancia el <b>'+cumpliEsc(inv.roles)+'</b> de que elige dónde van los datos y responde por lo que se cargue.</p>':'')
  +'</div>'
  +'<div class="cumpli-sec"><h4>Qué se guarda en ESTE dispositivo</h4>'
  +'<p>'+inv.claves+' cosa'+(inv.claves===1?'':'s')+' en el almacenamiento del navegador: la configuración de la app, tu agenda local ('+inv.agenda+' contacto'+(inv.agenda===1?'':'s')+'), las voces, el volumen y los ajustes. <b>Nada de esto sale de acá</b> salvo que vos lo mandes'+(inv.base?' — con una excepción que te digo de frente: al terminar el constructor («Dar vida») se copia la configuración (sin el PIN) a tu Firebase, para que tu MIRROR viaje con vos a otro dispositivo':'')+'.</p></div>'
  +(inv.base?'<div class="cumpli-sec"><h4>Qué vive en esa base</h4><p>Los recuerdos ('+inv.recuerdos+'), la charla reciente, el perfil, los documentos ('+inv.docs+'), las respuestas de tus encuestas y una copia de la configuración (sin el PIN).</p>'
    /* v38-base: acá va un HECHO verificado, no una sospecha. Compartir el MIRROR por link
       manda solo la vitrina (nombre, modos, color, presentación): la dirección de la base,
       el proxy y el PIN NO viajan. Decir eso vale más que sembrar una duda vaga — y es lo
       que hace que «cada uno el suyo» funcione de verdad. */
    +'<p><b>Compartir tu MIRROR no entrega tu base.</b> El link que se comparte lleva solo el nombre, los modos, el color y tu presentación: la dirección de esta base, el proxy y el PIN <b>no viajan ahí</b>. Quien lo abra ve una vitrina de solo lectura y, si le gusta, se arma el suyo — con su propia base. Lo sano es <b>una base por persona</b>.</p></div>':'')
  +'<div class="cumpli-sec"><h4>Qué viaja cuando escribís</h4>'
  +'<p>Tu mensaje, los últimos turnos, los recuerdos relevantes y los fragmentos de documentos que hagan falta. Salen hacia <b>'+(inv.proxy?cumpliEsc(host(inv.proxy)):'el proxy configurado')+'</b> y de ahí al motor de IA. <b>Lo que no sabemos</b>: qué hace ese motor con lo que recibe. Es de ellos, y no te lo vamos a jurar.</p></div>'
  +'<div class="cumpli-sec"><h4>Lo que cruzo SIN mandar nada (💤 soñar)</h4>'
  +'<p>Con la app abierta y ociosa cruzo tus recuerdos <b>acá, en tu dispositivo</b>, para ver patrones, conexiones y repeticiones — es lo que llamo «soñar». <b>No llamo a ningún motor ni sale un solo byte</b>: es cómputo local sobre lo que vos ya guardaste. Y no es una experiencia: no siento nada, «sueño» es una metáfora. Lo ves con «💤 lo que crucé» o preguntándome «¿soñaste algo?».</p></div>'
  +'<div class="cumpli-sec"><h4>Tu voz</h4>'
  +'<p>'+(inv.vozLocal
      ? 'El dictado se procesa <b>dentro de este dispositivo</b> 🔒 — el audio no viaja a ningún lado.'
      : 'Hoy el dictado lo transcribe el navegador <b>afuera</b>. Si querés que sea local, pedí «voz local».')
  +' El audio no se graba ni acá ni allá.</p></div>'
  +(inv.imagenes?'<div class="cumpli-sec"><h4>Las imágenes</h4><p>Las imágenes que genera son <b>generadas por IA</b> y quedan marcadas como tales debajo de cada una. La marca <i>legible por máquina</i> (metadatos/watermark) todavía no está hecha — se dice para que nadie la dé por hecha.</p></div>':'')
  /* La lista se parte en DOS a propósito. Mezclarlas sería prometer por cuenta ajena:
     una cosa es lo que hace este código (se puede verificar leyéndolo) y otra muy distinta
     lo que hagan la base, el proxy o el motor que elija cada usuario. */
  +'<div class="cumpli-sec cumpli-no"><h4>Qué NO hace ESTA app (esto sí lo podemos afirmar)</h4><ul>'
  +'<li>No tiene ningún servidor de quien la programó: <b>no hay a dónde mandarte los datos</b> aunque se quisiera.</li>'
  +'<li>No lleva publicidad, ni telemetría, ni analítica, ni rastreadores. Nadie paga para que te recomiende nada.</li>'
  +'<li>No vende ni cede nada tuyo, porque no recibe nada tuyo.</li>'
  +'<li>No lee tu correo ni tus mensajes: no tiene acceso.</li>'
  +'<li>No envía nada solo. Deja la acción lista y el último toque es tuyo.</li>'
  +'<li>No hace perfilado publicitario ni te puntúa.</li>'
  +'</ul></div>'
  +'<div class="cumpli-sec"><h4>Qué depende de VOS (y no podemos responder por eso)</h4>'
  +'<p>Vos elegís la base donde se guardan tus cosas, el proxy por donde salen y el motor de IA que responde. <b>Lo que hagan esos tres con tus datos es cosa de ellos y tuya, no de esta app.</b> Verificá sus términos: son de terceros y pueden cambiarlos cuando quieran.</p>'
  +'<p>A hoy, con el motor más usado acá (Groq): no entrena modelos con lo que le mandás salvo permiso expreso, y por defecto puede guardar registros hasta 30 días para abuso y fiabilidad, salvo que actives <i>Zero Data Retention</i> en su consola. <b>Esto es lo que ellos publican, no una garantía nuestra</b>, y si cambiás de motor cambia todo.</p></div>'
  +'<div class="cumpli-sec"><h4>Lo que sale a terceros (y lo elegís vos)</h4>'
  +'<p><b>Al abrir la app no se le pide nada a nadie.</b> Las tipografías del diseño vivían en un servidor de Google y se bajaban cada vez que abrías: eso le mostraba tu dirección IP a Google sin que vos lo eligieras. <b>Ya no.</b> Ahora arranca con las letras de tu dispositivo.</p>'
  +'<p>'+(fuentesWebActiva()
      ? 'Las originales las tenés <b>encendidas</b>: se bajan de <b>fonts.googleapis.com</b>, que ve tu IP al abrir. Lo elegiste vos y lo apagás cuando quieras.'
      : 'Si querés la facha original, se encienden acá — pero se bajan de <b>fonts.googleapis.com</b> y ese servidor va a ver tu IP cada vez que abras. Sabiendo eso, es tu decisión.')+'</p>'
  +'<p><a class="actua-btn'+(fuentesWebActiva()?'':' actua-share')+'" href="#" onclick="fuentesWebToggle();return false;">tipografías originales: '+(fuentesWebActiva()?'ON':'OFF')+'</a></p></div>'
  +'<div class="cumpli-sec"><h4>Las librerías, una por una</h4>'
  +'<p>Cinco cosas puntuales necesitan código que no viene adentro de la app, y se baja <b>solo en el momento en que usás esa función</b> — nunca al abrir: <b>leer un PDF</b>, <b>abrir o armar planillas</b>, <b>leer un .docx</b>, <b>dibujar los gráficos</b> del analista y <b>generar el informe</b> en Word o PDF. Vienen de <b>cdnjs.cloudflare.com</b>, <b>unpkg.com</b> o <b>jsdelivr.net</b>, y ese servidor ve tu IP <i>en ese momento</i>. <b>Lo que NO ven</b>: ni una letra de lo que escribís ni del archivo — el archivo se procesa acá, en tu dispositivo, y nunca sale.</p></div>'
  +'<div class="cumpli-sec"><h4>Lo tuyo es tuyo</h4>'
  +'<p><b>📦 llevarme todo</b> te baja en un archivo tus recuerdos, tu perfil, la lista de tus documentos y lo guardado en este dispositivo, con un sello que avisa si el archivo se dañó (el texto de los documentos no va: guardá los originales). <b>Borrar memoria</b> y el panel de memoria borran lo que quieras, cuando quieras. No hay «contactate con soporte».</p></div>'
  +'<div class="cumpli-sec"><h4>Si te quedás de más</h4>'
  +'<p>A los '+CUMPLI_PAUSA_MIN+' minutos o '+CUMPLI_PAUSA_TURNOS+' idas y vueltas te avisa, una sola vez y sin trabar nada. Lo podés apagar acá abajo. Ninguna app hace esto porque a todas les conviene que te quedes.</p></div>'
  /* v38-apagado (H3): el control vive acá, junto a todo lo demás que el usuario decide sobre
     sí mismo. Se muestra el uso real de hoy — sin eso, elegir un límite es a ciegas. */
  +'<div class="cumpli-sec"><h4>Tu límite diario (lo elegís vos)</h4>'
  +'<p>'+(apagadoLimite()
      ? ('Hoy llevás <b>'+apagadoUso()+' de '+apagadoLimite()+' minutos</b>. Cuando se cumpla te aviso y freno — y vas a poder seguir igual si lo necesitás: es tu límite, no una condena.')
      : 'No tenés límite puesto. Si querés que te frene, elegí uno: es la única app que se apaga sola porque vos se lo pediste.')+'</p>'
  +'<p>'+APAGADO_OPCIONES.map(function(m){
      const act = (m===apagadoLimite());
      return '<a class="actua-btn'+(act?'':' actua-share')+'" href="#" onclick="apagadoSet('+m+');return false;" style="margin:3px 6px 3px 0;display:inline-block;">'+(m?m+' min':'sin límite')+(act?' ✓':'')+'</a>';
    }).join('')+'</p></div>'
  /* Salvedades. No están para escudarse: están para que nadie se lleve una sorpresa y para
     que quede claro quién decide qué. Se escriben en criollo a propósito — una salvedad que
     no se entiende no protege a nadie, y las letras chicas son justo lo que este proyecto
     no quiere ser. */
  +'<div class="cumpli-sec cumpli-no"><h4>Los límites, sin letra chica</h4><ul>'
  +'<li><b>Es una app limitada</b> y se ofrece tal como está, sin garantías de ningún tipo. Puede fallar, quedarse sin servicio o equivocarse.</li>'
  +'<li><b>No es asesoramiento profesional.</b> Nada de lo que diga reemplaza a un médico, un abogado, un contador ni un psicólogo. Si algo importa de verdad, consultá con una persona matriculada.</li>'
  +'<li><b>No es un servicio de emergencia.</b> Si hay riesgo para vos o para alguien, buscá ayuda humana ya: emergencias locales o alguien de confianza.</li>'
  +'<li><b>Vos elegís dónde van tus datos</b> — la base, el proxy, el motor — y <b>sos responsable de esa elección</b> y de lo que cargues.</li>'
  +'<li>Si la usás con datos de otras personas (alumnos, pacientes, clientes), <b>el responsable de esos datos sos vos</b>, con las obligaciones que eso traiga donde vivas.</li>'
  +'<li>Si se la das a un menor, que haya un adulto acompañando. La herramienta no suple eso.</li>'
  +'<li>Quien programó esta app <b>no tiene acceso a tus datos, ni servidores, ni forma de recuperarlos</b> si los perdés. Por eso existe «llevarme todo»: la copia es tuya y es tu responsabilidad hacerla.</li>'
  +'</ul></div>';
}
function cumpliAbrir(){
  try{
    const b=document.getElementById('cumpli-body'); if(b) b.innerHTML=cumpliHTML();
    const btn=document.getElementById('cumpli-pausa-btn'); if(btn) btn.textContent='recordatorio de pausa: '+(cumpliPausaActiva()?'ON':'OFF');
    const m=document.getElementById('cumpli-modal'); if(m) m.classList.add('visible');
  }catch(e){ try{ regError('cumpli:abrir',e) }catch(_){} }
}
function cumpliCerrar(){ try{ const m=document.getElementById('cumpli-modal'); if(m) m.classList.remove('visible'); }catch(e){} }
function cumpliLinea(html, clase){
  try{
    const chat=document.getElementById('chat'); if(!chat) return false;
    const div=document.createElement('div');
    div.className='aviso-ia'+(clase?' '+clase:'');
    div.innerHTML=html+'<span class="aviso-x" title="cerrar" onclick="this.parentNode.remove()">✕</span>';
    chat.appendChild(div); chat.scrollTop=chat.scrollHeight; return true;
  }catch(e){ try{ regError('cumpli:linea',e) }catch(_){} return false; }
}
function cumpliAvisoInicial(){
  try{ if(sessionStorage.getItem('mirror_aviso_ia')==='1') return; sessionStorage.setItem('mirror_aviso_ia','1'); }catch(e){}
  cumpliLinea('Hablás con una <b>IA</b>, no con una persona — y como toda IA, se puede equivocar. '
    +'<span class="aviso-link" onclick="cumpliAbrir()">Qué hago con lo tuyo</span>');
}
function cumpliTurno(){
  try{
    cumpliTurnos++;
    if(cumpliPausaMostrada || !cumpliPausaActiva()) return;
    const mins=(Date.now()-cumpliInicio)/60000;
    if(mins<CUMPLI_PAUSA_MIN && cumpliTurnos<CUMPLI_PAUSA_TURNOS) return;
    cumpliPausaMostrada=true;
    cumpliLinea('Llevás '+(mins>=CUMPLI_PAUSA_MIN?Math.round(mins)+' minutos':cumpliTurnos+' idas y vueltas')+' acá. '
      +'Si estabas yendo a algo, andá — esto no se va a ningún lado. '
      +'<span class="aviso-link" onclick="cumpliPausaToggle()">no me avises más</span>', 'aviso-pausa');
  }catch(e){ try{ regError('cumpli:turno',e) }catch(_){} }
}
setTimeout(function(){ try{ cumpliAvisoInicial(); }catch(e){} }, 900);
setTimeout(function(){ try{ tareasAvisoInicial(); }catch(e){} }, 1600); // v39-tareas
setTimeout(function(){ try{ soniarAvisoInicial(); }catch(e){} }, 2300); // v39-sonaviso

/* ══════════ v38-porta (H2) — PORTABILIDAD TOTAL ══════════
   Anti-retención hecho función: TODO lo del usuario en UN archivo, con verificación de
   integridad. En la white-label pesa doble: es lo que se reparte a terceros, y la bandera
   que más ayuda a salir al dominio (es lo que la multa a Replika, por retención opaca,
   castiga). Nadie tiene que pedir permiso para llevarse lo suyo.
   QUÉ SE LLEVA: todo lo guardado en el dispositivo (config del constructor, agenda, voces,
   volumen, la carta y sus contadores) + recuerdos + perfil + documentos.
   ⚠️ OJO, SE DICE DE FRENTE: la config puede incluir la URL de tu proxy y la clave de
   imágenes (`mirror_pollinations_key`). El archivo es tuyo, pero tratalo como una
   contraseña: no lo subas a ningún lado público.
   QUÉ NO: las claves de IA (viven en tu proxy, la app no las tiene) ni la charla en curso.
   INTEGRIDAD: un hash del contenido viaja en el archivo; al importar se recalcula y, si no
   coincide, NO se toca nada. AL IMPORTAR se repone lo LOCAL; lo que vive en Firebase
   (recuerdos y perfil) no se escribe solo — queda en el archivo, a disposición. */
const PORTA_ESQUEMA = 1;
function portaHash(txt){ // FNV-1a de 32 bits: corto, sin dependencias, alcanza para detectar alteración
  let h=0x811c9dc5; const s=String(txt);
  for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=(h+((h<<1)+(h<<4)+(h<<7)+(h<<8)+(h<<24)))>>>0; }
  return ('00000000'+h.toString(16)).slice(-8);
}
function portaLocal(){
  const out={};
  try{ for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k && k.indexOf('mirror_')===0) out[k]=localStorage.getItem(k); } }catch(e){ try{ regError('porta:local',e) }catch(_){} }
  return out;
}
function portaSensibles(local){ // lo que hay que avisar sin vueltas
  const s=[]; try{
    if(local['mirror_pollinations_key']) s.push('tu clave de imágenes');
    const c=local['mirror_config']||''; if(/proxyUrl|fbUrl/.test(c)) s.push('las direcciones de tu proxy y tu base');
  }catch(e){}
  return s;
}
function portaArmar(){
  const cuerpo={
    esquema: PORTA_ESQUEMA,
    app: (typeof CONFIG!=='undefined' && CONFIG.appName) ? String(CONFIG.appName) : 'MIRROR',
    version: (typeof PLATFORM_VERSION!=='undefined'?PLATFORM_VERSION:'?'),
    exportado: new Date().toISOString(),
    local: portaLocal(),
    recuerdos: (typeof recuerdosChunks!=='undefined' && Array.isArray(recuerdosChunks)) ? recuerdosChunks : [],
    perfil: (typeof perfilData!=='undefined') ? perfilData : null,
    docs: (typeof ragDocs!=='undefined' && Array.isArray(ragDocs)) ? ragDocs : []
  };
  const json=JSON.stringify(cuerpo);
  return { cuerpo:cuerpo, integridad:{ hash:portaHash(json), algoritmo:'fnv1a32', bytes:json.length } };
}
function portaExportar(){
  try{
    const p=portaArmar();
    const archivo=JSON.stringify({ integridad:p.integridad, datos:p.cuerpo }, null, 1);
    const nombre=String(p.cuerpo.app).toUpperCase().replace(/[^A-Z0-9]/g,'_');
    bajarBlob(new Blob([archivo],{type:'application/json'}), nombre+'_TODO_LO_TUYO_'+fechaArchivo()+'.json');
    const n=p.cuerpo.recuerdos.length, d=p.cuerpo.docs.length, l=Object.keys(p.cuerpo.local).length;
    const sens=portaSensibles(p.cuerpo.local);
    /* v40-porta (16/10, auditores 2 y 4): decía «TODO» pero de los documentos va la LISTA, no el texto; y el sello es una
       suma de control sin clave: detecta un archivo dañado, no a alguien que lo edite a propósito y recalcule el sello. */
    const _perf = !!(p.cuerpo && p.cuerpo.perfil);
    return 'Listo ✅ — te bajé en un archivo: '+n+' recuerdo'+(n===1?'':'s')+', la lista de '+d+' documento'+(d===1?'':'s')+' (el texto de los documentos no va: guardá tus originales), '+l+' cosa'+(l===1?'':'s')+' guardada'+(l===1?'':'s')+' en este dispositivo'+(_perf?' y tu perfil':'')
         +'. Lleva un sello ('+p.integridad.hash+') que avisa si el archivo se dañó. '
         +(sens.length?('⚠️ Adentro va '+sens.join(' y ')+' — el archivo es tuyo, pero guardalo como guardás una contraseña. '):'')
         +'Guardalo donde quieras: es tuyo y no necesitás mi permiso para tenerlo. Lo que NO va: las claves de IA (viven en tu proxy) ni la charla de ahora.';
  }catch(e){ try{ regError('porta:exportar',e) }catch(_){} return 'Quise armarte el archivo y falló algo acá adentro — quedó en mi diagnóstico. No te dejo con un archivo a medias.'; }
}
function portaVerificar(texto){
  let a; try{ a=JSON.parse(texto); }catch(e){ return { ok:false, motivo:'no es un archivo JSON válido' }; }
  if(!a || !a.datos || !a.integridad || !a.integridad.hash) return { ok:false, motivo:'no tiene la forma de un archivo de MIRROR (le falta el sello o los datos)' };
  const recalculado=portaHash(JSON.stringify(a.datos));
  if(recalculado!==a.integridad.hash) return { ok:false, motivo:'el sello de integridad NO coincide (esperaba '+a.integridad.hash+', calculé '+recalculado+'): el archivo fue editado o se corrompió' };
  if(a.datos.esquema!==PORTA_ESQUEMA) return { ok:false, motivo:'es de otra versión del formato (esquema '+a.datos.esquema+', yo entiendo el '+PORTA_ESQUEMA+')' };
  return { ok:true, datos:a.datos };
}
function portaImportarTexto(texto){
  const v=portaVerificar(texto);
  if(!v.ok) return '❌ No importé NADA: '+v.motivo+'. Tus datos quedaron como estaban — prefiero no tocar nada antes que meterte basura adentro.';
  const d=v.datos;
  const resumen=Object.keys(d.local||{}).length+' cosas de este dispositivo, '+((d.recuerdos||[]).length)+' recuerdos y '+((d.docs||[]).length)+' documentos';
  let confirma=true;
  try{ confirma=confirm('Este archivo trae '+resumen+', exportado el '+String(d.exportado||'?').slice(0,10)+'.\n\nVoy a REEMPLAZAR lo que tenés guardado en ESTE dispositivo (config, agenda, voces, ajustes). Los recuerdos y el perfil NO los escribo en tu Firebase: quedan disponibles en el archivo.\n\n¿Sigo?'); }catch(e){}
  if(!confirma) return 'Listo, no toqué nada. El archivo sigue ahí para cuando quieras.';
  let puestas=0;
  try{ for(const k in (d.local||{})){ if(k.indexOf('mirror_')===0){ localStorage.setItem(k, d.local[k]); puestas++; } } }
  catch(e){ try{ regError('porta:importar',e) }catch(_){} return 'Pude leer el archivo (sello correcto) pero el navegador me negó el guardado — no quedó nada a medias. Quedó en mi diagnóstico.'; }
  return 'Listo ✅ — repuse '+puestas+' cosa'+(puestas===1?'':'s')+' de este dispositivo. Recargá la página para que todo tome efecto.\n\n'
       + 'Lo honesto: los '+((d.recuerdos||[]).length)+' recuerdos y el perfil viven en tu Firebase y NO los escribí solos — no meto la mano en tu base sin que me lo pidas. Están enteros en el archivo.';
}
function portaImportarArchivo(){
  try{
    const inp=document.getElementById('portafile');
    if(!inp) return false;
    inp.value=''; inp.click(); return true;
  }catch(e){ try{ regError('porta:input',e) }catch(_){} return false; }
}
function portaArchivoElegido(ev){
  try{
    const f=ev && ev.target && ev.target.files && ev.target.files[0];
    if(!f){ return; }
    const fr=new FileReader();
    fr.onload=function(){ try{ addMsg('mirror', portaImportarTexto(String(fr.result||''))); }catch(e){ try{ regError('porta:leer',e) }catch(_){} } };
    fr.onerror=function(){ try{ addMsg('mirror','No pude leer ese archivo. Probá de nuevo, o mandámelo otra vez.'); }catch(e){} };
    fr.readAsText(f);
  }catch(e){ try{ regError('porta:archivo',e) }catch(_){} }
}

/* ══════════ v38-c5 (2/08/2026) — C5 SHARE TARGET: RECIBIR DESDE OTRA APP ══════════
   Cierra el Track C. C1 era «hablá y mandá» (MIRROR → afuera); esto es el camino de vuelta:
   estás en WhatsApp, el navegador o el correo, tocás «compartir» y **MIRROR aparece en la lista
   de apps del sistema**, como cualquier otra. Mandás ahí un mensaje, un link o un texto y llega
   al campo, listo para preguntarle qué hacer con eso. Mata el copiar-pegar-cambiar-de-app.

   LO QUE ESTE CÓDIGO NO PUEDE HACER SOLO (y hay que decirlo): para que MIRROR figure en esa
   lista, el que manda es **`manifest.json`**, que vive en el repo del deploy y NO en la carpeta
   de trabajo. Sin el bloque `share_target` ahí, esta función existe y no la llama nadie: no
   rompe nada, simplemente nunca recibe. El bloque exacto está en `C5_SHARE_TARGET_manifest.md`.
   Además: el sistema solo ofrece una PWA **instalada**, y Share Target hoy es de Android/Chrome
   y Windows — **en iPhone no existe**. No se promete lo que el navegador no da.

   POR QUÉ MÉTODO GET Y NO POST: con GET lo compartido llega en la URL y lo lee esta función.
   POST obligaría a que el Service Worker intercepte el envío, y el SW de este proyecto tiene
   una regla escrita: no toca nada que no sea el documento de navegación. GET alcanza para texto
   y enlaces, que es todo lo que C5 necesita.

   LA REGLA DEL NORTE, IGUAL QUE EN C1: lo compartido **queda en el campo y NO se manda solo**.
   El último toque es humano. Recibir algo de otra app no es permiso para hablarle al modelo. */
function c5Leer(busqueda){
  // Se aceptan los nombres en criollo Y los estándar en inglés: según cómo quede escrito el
  // manifest, el navegador manda unos u otros. Fallar por el idioma de una clave sería tonto.
  try {
    const p = new URLSearchParams(busqueda || '');
    const g = function(){ for (var i=0;i<arguments.length;i++){ var v=p.get(arguments[i]); if (v) return String(v); } return ''; };
    return { titulo: g('titulo','title'), texto: g('texto','text'), enlace: g('enlace','url','link') };
  } catch(e){ return { titulo:'', texto:'', enlace:'' }; }
}
function c5Armar(d){
  d = d || {};
  const partes = [];
  const tit = String(d.titulo||'').trim(), txt = String(d.texto||'').trim(), url = String(d.enlace||'').trim();
  if (tit && tit !== txt) partes.push(tit);
  if (txt) partes.push(txt);
  // WhatsApp y varios navegadores meten el enlace ADENTRO del texto: repetirlo sería ruido.
  if (url && txt.indexOf(url) < 0 && tit.indexOf(url) < 0) partes.push(url);
  return partes.join('\n').trim();
}
function c5Recibir(){
  try {
    const d = c5Leer(location.search);
    const junto = c5Armar(d);
    if (!junto) return false; // no vino nada: la app arranca como siempre
    /* La URL se limpia al toque. Si no, recargar volvería a inyectar lo mismo una y otra vez,
       y además lo compartido quedaría escrito en la barra de direcciones a la vista de
       cualquiera que mire la pantalla. */
    try { history.replaceState(null, '', location.pathname + location.hash); } catch(e){}
    const inp = document.getElementById('inp');
    if (inp){
      inp.value = junto + (junto.length ? '\n\n' : '');
      try { aresize(inp); } catch(e){}
      try { inp.focus(); } catch(e){}
    }
    addMsg('mirror', 'Me llegó esto desde otra app y te lo dejé abajo, sin mandarlo. Escribí qué querés que haga con eso (resumirlo, contestarlo, guardarlo) y lo mando vos.');
    return true;
  } catch(e){ try{ regError('c5:recibir', e) }catch(_){} return false; }
}

/* ══════════ v38-cdn (2/08/2026) — LAS TIPOGRAFÍAS, FUERA DEL ARRANQUE ══════════
   §11 del itinerario: «lo único que sale a un tercero sin que el usuario lo elija». Era esto.
   Las dos tipografías del diseño (Space Mono y Cormorant Garamond) vivían en un servidor de
   Google y se bajaban en CADA apertura: fonts.googleapis.com veía la IP de todo el que abriera
   la app, siempre, sin haberlo elegido. Con un panel que promete «no hay a dónde mandar tus
   datos», dejar eso prendido era una contradicción escrita en el propio código.

   QUÉ SE HIZO: el enlace salió del HTML y las cadenas de respaldo se reforzaron para que la app
   se vea bien con las tipografías del dispositivo. **Por defecto no se pide nada a nadie.**
   Quien quiera la facha original la enciende acá, sabiendo qué implica, y la decisión le queda
   guardada. Soberanía no es prohibir: es que la elección sea del usuario y esté a la vista.

   POR QUÉ NO SE EMPOTRARON EN EL ARCHIVO (que sería lo ideal: facha idéntica y cero terceros):
   hacen falta los .woff2, que no están en la carpeta. Ambas son licencia OFL y se pueden
   empotrar citando la licencia. Si algún día aparecen los archivos, este interruptor sobra. */
const FUENTES_URL = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=Space+Mono:wght@400;700&display=swap';
function fuentesWebActiva(){ try { return localStorage.getItem('mirror_fuentes_web') === '1'; } catch(e){ return false; } }
function fuentesWebCargar(){
  try {
    if (document.getElementById('fuentes-web')) return true; // ya está: no se pide dos veces
    const l = document.createElement('link');
    l.id = 'fuentes-web'; l.rel = 'stylesheet'; l.href = FUENTES_URL;
    (document.head || document.body).appendChild(l);
    return true;
  } catch(e){ try{ regError('fuentes:cargar', e) }catch(_){} return false; }
}
function fuentesWebQuitar(){
  try { const l = document.getElementById('fuentes-web'); if (l && l.parentNode) l.parentNode.removeChild(l); return true; }
  catch(e){ return false; }
}
function fuentesWebToggle(){
  const nueva = !fuentesWebActiva();
  let guardo = true;
  try { localStorage.setItem('mirror_fuentes_web', nueva ? '1' : '0'); } catch(e){ guardo = false; }
  if (nueva) fuentesWebCargar(); else fuentesWebQuitar();
  try {
    // El panel se redibuja para que el estado que muestra sea el REAL, no el de hace un rato.
    const b = document.getElementById('cumpli-body');
    if (b && typeof cumpliHTML === 'function') b.innerHTML = cumpliHTML();
  } catch(e){}
  try {
    addMsg('mirror', nueva
      ? ('Listo — tipografías originales encendidas. Se bajan de fonts.googleapis.com, así que ese servidor ve tu IP cada vez que abrís.' + (guardo ? ' Queda guardado.' : ' Ojo: el navegador no me dejó guardar la elección, así que al cerrar vuelve a apagarse.'))
      : ('Listo — de vuelta a las tipografías de tu dispositivo. Al abrir la app ya no se le pide nada a nadie.' + (guardo ? '' : ' Ojo: el navegador no me dejó guardar la elección.')));
  } catch(e){}
}
// Solo si el usuario lo pidió alguna vez. Sin esta línea, la app nunca sale a buscar una letra.
try { if (fuentesWebActiva()) fuentesWebCargar(); } catch(e){}

// --- Init ---
(async () => {
  const [mem, savedChunks, perfil, recuerdos] = await Promise.all([memoryGet(), chunksLoadAll(), perfilLoad(), recuerdosLoadAll()]); // v35-mem
  recuerdosChunks = recuerdos || []; // v35-mem: memoria personal por relevancia
  try{ setTimeout(soniarSiCorresponde, 5000); }catch(e){} // v39-sonar: sueña sola con la app abierta y ociosa (nada viaja)
  if (perfil) {
    perfilData = perfil;
    document.getElementById('perfil-sync').textContent = 'Cargado desde memoria';
  }
  if (mem.length > 0) {
    history = mem;
    addMsg('mirror','Memoria restaurada. Seguimos donde lo dejamos.','mirror');
  }
  try{ c5Recibir(); }catch(e){ try{ regError('c5:init',e) }catch(_){} } // v38-c5 (C5): ¿la app se abrió porque alguien compartió algo hacia acá?
  if (savedChunks.length > 0) {
    ragChunks = savedChunks;
    // Reagrupar chunks en documentos para la UI
    const byDoc = {};
    savedChunks.forEach(c => {
      if (!byDoc[c.docId]) byDoc[c.docId] = { id:c.docId, name:c.docName, type:c.type, nChunks:0 };
      byDoc[c.docId].nChunks++;
    });
    ragDocs = Object.values(byDoc);
    const permCount = ragDocs.filter(d=>d.type==='perm').length;
    const tempCount = ragDocs.filter(d=>d.type==='temp').length;
    addMsg('mirror','🧠 '+ragDocs.length+' documento(s) cargados desde memoria ('+savedChunks.length+' fragmentos · '+permCount+' perm, '+tempCount+' temp).','tars');
    updateRagUI();
  }
})();
// ══════════ PWA (v2.2) — MIRROR instalable · v24: aviso de nueva versión ══════════
// El sw.js NO cambia entre deploys (la verdad vive en PLATFORM_VERSION del index).
// Por eso el aviso compara la versión CARGADA contra la del index FRESCO de la red.
window._verCheckTS = 0;
window.chequearVersionNueva = async function(){
  try{
    if(window.MODO_COMPARTIDO) return;                 // al visitante de un link no lo molestamos
    if(Date.now() - window._verCheckTS < 60000) return; // throttle: como mucho 1 chequeo por minuto
    window._verCheckTS = Date.now();
    const r = await fetch('index.html', {cache:'no-store'});
    if(!r || !r.ok) return;
    const txt = await r.text();
    const m = txt.match(/PLATFORM_VERSION\s*=\s*'([^']+)'/);
    if(m && m[1] && m[1] !== PLATFORM_VERSION){
      const v=document.getElementById('pwa-update-ver'); if(v) v.textContent = m[1];
      const b=document.getElementById('pwa-update'); if(b) b.classList.add('show');
    }
  }catch(_){}
};
window.pwaActualizar = function(){ try{ location.reload(); }catch(_){ location.href = location.pathname; } };
window.pwaDescartarUpdate = function(){ var b=document.getElementById('pwa-update'); if(b) b.classList.remove('show'); };

if('serviceWorker' in navigator && (location.protocol==='https:'||location.hostname==='localhost')){
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('mirror-sw.js').then(function(reg){ // v40-sw (16/10, auditor 4): apuntaba a «sw.js», que no existe (404 callado)
      // Por si algún día el sw.js sí cambia: cuando entre uno nuevo, chequeamos versión.
      if(reg){ reg.addEventListener('updatefound',function(){ var nw=reg.installing; if(nw){ nw.addEventListener('statechange',function(){ if(nw.state==='installed' && navigator.serviceWorker.controller){ window.chequearVersionNueva(); } }); } }); }
    }).catch(()=>{});
    setTimeout(function(){ window.chequearVersionNueva(); }, 8000); // primer chequeo tras el arranque
  });
  document.addEventListener('visibilitychange',function(){ if(document.visibilityState==='visible'){ window.chequearVersionNueva(); } });
}

/* ╔══════════════════════════════════════════════════════════════════╗
   ║  FACHADA v3.0 — del demo aprobado (mirror_demo_v07_audio_FINAL)   ║
   ║  Logo MIR[Я]OR (la I = monolito 360°) · música "El Origen"        ║
   ║  · cinemática de nacimiento · modo presentación/defensa.          ║
   ║  CAPA VISUAL/SONORA PURA: no toca modos, RAG, voz ni Firebase.    ║
   ╚══════════════════════════════════════════════════════════════════╝ */
let hdrThinking=false, t=0;
const palettes={
  mirror:{core:[180,180,255],glow:[112,112,255],particle:[140,140,255]},
  tars:{core:[180,255,240],glow:[0,255,204],particle:[80,255,220]},
  jurado:{core:[255,225,185],glow:[255,184,107],particle:[255,205,150]},
  conn:{core:[200,255,220],glow:[74,222,128],particle:[140,255,180]}
};
function pal(){return palettes[mode]||palettes.mirror;}
function rgba(c,a){return `rgba(${c[0]},${c[1]},${c[2]},${a})`;}
/* ===== "EL ORIGEN" — suite ambiental original (Web Audio, sin samples) =====
   Coro etéreo + reverb de catedral + pulso house + clímax + cluster que crece
   (metáfora del monolito apoderándose). Atmósfera inspirada en 2001 y en Enya,
   pero 100% original: no recrea ninguna obra con copyright. */
let audioCtx=null, soundOn=false, musicStarted=false;
let masterGain=null, busDry=null, busWet=null, convolver=null, comp=null;
let choirVoices=[], subOsc=null, subGain=null, choirGain=null, choirFilter=null, hatBuffer=null;
let chordIx=0, energy=0.12, thinkBoost=0, step16=0, nextTime=0, schedTimer=null;

const BPM=70, BEAT=60/BPM, S16=BEAT/4, BARS_CYCLE=24, BARS_PER_CHORD=2;
const N={A1:55,F1:43.65,G1:49,C2:65.41,
  F3:174.61,G3:196,A3:220,B3:246.94,C4:261.63,D4:293.66,E4:329.63,F4:349.23,G4:392,A4:440,B4:493.88,C5:523.25,E5:659.25};
// root = sub-bajo · choir = tríada coral media · shine = brillo agudo (clímax)
const PROG=[
  {root:N.A1, choir:[N.A3,N.C4,N.E4], shine:[N.A4,N.C5,N.E5]}, // Am
  {root:N.F1, choir:[N.F3,N.A3,N.C4], shine:[N.A4,N.C5,N.F4]}, // F
  {root:N.C2, choir:[N.C4,N.E4,N.G4], shine:[N.G4,N.C5,N.E5]}, // C
  {root:N.G1, choir:[N.G3,N.B3,N.D4], shine:[N.B4,N.D4,N.G4]}  // G
];

function makeIR(sec,decay){const rate=audioCtx.sampleRate,len=rate*sec,buf=audioCtx.createBuffer(2,len,rate);
  for(let ch=0;ch<2;ch++){const d=buf.getChannelData(ch);
    for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,decay);}return buf;}
function noiseBuf(sec){const rate=audioCtx.sampleRate,len=rate*sec,b=audioCtx.createBuffer(1,len,rate),d=b.getChannelData(0);
  for(let i=0;i<len;i++)d[i]=Math.random()*2-1;return b;}

function initAudio(){
  if(audioCtx)return;
  audioCtx=new (window.AudioContext||window.webkitAudioContext)();
  comp=audioCtx.createDynamicsCompressor();
  comp.threshold.value=-18;comp.knee.value=20;comp.ratio.value=3.5;comp.attack.value=0.01;comp.release.value=0.25;
  masterGain=audioCtx.createGain(); masterGain.gain.value=0;
  comp.connect(masterGain); masterGain.connect(audioCtx.destination);
  busDry=audioCtx.createGain(); busDry.connect(comp);
  convolver=audioCtx.createConvolver(); convolver.buffer=makeIR(4.8,2.0);
  busWet=audioCtx.createGain(); busWet.gain.value=0.85; convolver.connect(busWet); busWet.connect(comp);
  // sub
  subGain=audioCtx.createGain(); subGain.gain.value=0; subGain.connect(busDry);
  subOsc=audioCtx.createOscillator(); subOsc.type='sine'; subOsc.frequency.value=PROG[0].root;
  subOsc.connect(subGain); subOsc.start();
  // coro etéreo: por nota 3 osc unison detune + vibrato → vocal/Enya. Va a seco + reverb.
  choirFilter=audioCtx.createBiquadFilter(); choirFilter.type='lowpass'; choirFilter.frequency.value=480; choirFilter.Q.value=0.6;
  choirGain=audioCtx.createGain(); choirGain.gain.value=0;
  choirFilter.connect(choirGain); choirGain.connect(busDry); choirGain.connect(convolver);
  PROG[0].choir.forEach((f,ni)=>{
    [-7,0,7].forEach(det=>{
      const o=audioCtx.createOscillator(); o.type='sawtooth'; o.frequency.value=f; o.detune.value=det;
      const lfo=audioCtx.createOscillator(); lfo.type='sine'; lfo.frequency.value=4.4+Math.random()*0.8;
      const lg=audioCtx.createGain(); lg.gain.value=3.5; lfo.connect(lg); lg.connect(o.detune); lfo.start();
      o.connect(choirFilter); o.start(); choirVoices.push({o:o,ni:ni});
    });
  });
  hatBuffer=noiseBuf(0.3);
}
function eff(){return Math.max(energy,thinkBoost);}
function setChord(ix){const c=PROG[ix],now=audioCtx.currentTime;
  subOsc.frequency.setTargetAtTime(c.root,now,1.4);
  choirVoices.forEach(v=>v.o.frequency.setTargetAtTime(c.choir[v.ni],now,2.2));}
function updateMix(){if(!audioCtx)return;const now=audioCtx.currentTime,e=eff();
  subGain.gain.setTargetAtTime(soundOn?(0.26+0.12*e):0,now,0.5);    // graves más presentes
  choirGain.gain.setTargetAtTime(soundOn?(0.05+0.13*e):0,now,0.6);
  choirFilter.frequency.setTargetAtTime(420+e*1700,now,0.7);        // menos agudos
  busWet.gain.setTargetAtTime(1.15-0.30*e,now,0.8);}                // más reverberancia // más reverb en calma, más definición en clímax
function shine(freq,when,vol){const o=audioCtx.createOscillator();o.type='sine';
  const g=audioCtx.createGain();o.frequency.value=freq;o.connect(g);g.connect(busDry);g.connect(convolver);
  g.gain.setValueAtTime(0.0001,when);g.gain.exponentialRampToValueAtTime(vol,when+0.04);
  g.gain.exponentialRampToValueAtTime(0.0005,when+3.0);o.start(when);o.stop(when+3.1);}
function thump(when,vol){ // latido sordo, grave y apagado
  const o=audioCtx.createOscillator();o.type='sine';
  const lp=audioCtx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=95; // apaga el golpe
  const g=audioCtx.createGain();
  o.frequency.setValueAtTime(74,when);o.frequency.exponentialRampToValueAtTime(33,when+0.17);
  g.gain.setValueAtTime(0.0001,when);g.gain.exponentialRampToValueAtTime(vol,when+0.03);
  g.gain.exponentialRampToValueAtTime(0.001,when+0.42);
  o.connect(lp);lp.connect(g);g.connect(busDry);
  const rs=audioCtx.createGain();rs.gain.value=0.4;g.connect(rs);rs.connect(convolver); // cola = envolvente
  o.start(when);o.stop(when+0.44);}
function heart(when,vol){thump(when,vol);thump(when+0.18,vol*0.6);} // latido: lub-dub
function clusterSwell(when){ // cluster microtonal que crece y se disuelve → "el monolito"
  const base=PROG[chordIx].root*4,g=audioCtx.createGain();
  g.gain.setValueAtTime(0.0001,when);g.gain.exponentialRampToValueAtTime(0.09,when+4.0);
  g.gain.exponentialRampToValueAtTime(0.0006,when+7.0);g.connect(busDry);g.connect(convolver);
  for(let i=0;i<7;i++){const o=audioCtx.createOscillator();o.type='sawtooth';
    o.frequency.value=base*(1+i*0.018);o.connect(g);o.start(when);o.stop(when+7.2);}}
function energyForBar(bar){const b=bar%BARS_CYCLE;
  if(b<6)return 0.12;                       // intro / calma oscura
  if(b<14)return 0.12+(b-6)/8*0.6;          // construcción
  if(b<20)return 0.9+0.06*Math.sin(b);      // clímax (house + cluster)
  return 0.65-(b-20)/4*0.5;}                // descenso
function scheduler(){
  while(nextTime<audioCtx.currentTime+0.12){
    const bar=Math.floor(step16/16),inBar=step16%16;
    energy=energyForBar(bar);
    if(step16%(16*BARS_PER_CHORD)===0){setChord(chordIx);
      shine(PROG[chordIx].shine[0],nextTime+0.05,0.04+0.07*eff());
      chordIx=(chordIx+1)%PROG.length;}
    const E=eff();
    if(inBar%4===0){updateMix(); if(E>0.30)heart(nextTime,0.28+0.26*E);} // latido tenue en cada pulso
    if(E>0.8&&inBar===8)shine(PROG[chordIx].shine[1],nextTime,0.035);
    if(bar%BARS_CYCLE===13&&inBar===0)clusterSwell(nextTime);
    nextTime+=S16; step16++;
  }
}
function startMusic(){if(musicStarted)return;musicStarted=true;
  step16=0;chordIx=0;nextTime=audioCtx.currentTime+0.1;setChord(0);updateMix();
  schedTimer=setInterval(scheduler,25);}
function toggleSound(){
  initAudio(); if(audioCtx.state==='suspended')audioCtx.resume();
  soundOn=!soundOn;
  const b=document.getElementById('sndBtn');
  b.textContent=soundOn?'🔊 sonido':'🔇 sonido';
  b.classList.toggle('playing',soundOn);
  if(soundOn){startMusic(); if(masterGain)masterGain.gain.setTargetAtTime(ctxVol(),audioCtx.currentTime,0.5);}
  else if(masterGain)masterGain.gain.setTargetAtTime(0,audioCtx.currentTime,0.4);
  updateMix();
}
// "pensar" empuja la energía a un clímax momentáneo
function setDrone(level){const tb=level>0.04?0.85:0; if(tb!==thinkBoost){thinkBoost=tb; updateMix();}}
// ════ v32 — FIRMA SONORA «El Origen» ════════════════════════════════════════
// Sello sonoro propio de la plataforma: breve arpegio cálido Am–F–C–G con cola de reverb
// larga (reusa el convolver de la suite). Suena UNA sola vez, al nacer el MIRROR. 100%
// original (Web Audio, sin samples ni recreación de obras con copyright). On/off: respeta
// el toggle 🔊 «sonido» del footer (siempre visible); si está apagado, no suena.
let firmaSonada=false;
function firmaOrigen(){
  if(!audioCtx || !busDry || !convolver || !soundOn || firmaSonada) return;
  firmaSonada=true;
  const now=audioCtx.currentTime+0.15, paso=0.62;
  const notas=[N.A3, N.F3, N.C4, N.G4];   // raíces cálidas de la progresión Am–F–C–G
  notas.forEach((f,i)=>{
    const when=now+i*paso;
    [['sine',1.0],['triangle',0.35]].forEach(par=>{
      const o=audioCtx.createOscillator(); o.type=par[0]; o.frequency.value=f;
      const g=audioCtx.createGain();
      g.gain.setValueAtTime(0.0001,when);
      g.gain.exponentialRampToValueAtTime(0.13*par[1],when+0.05);
      g.gain.exponentialRampToValueAtTime(0.0004,when+2.6);
      o.connect(g); g.connect(busDry); g.connect(convolver);   // seco + reverb largo
      o.start(when); o.stop(when+2.7);
    });
  });
  try{ shine(N.E5, now+3*paso+0.1, 0.05); }catch(_){}   // brillo agudo final (clímax suave)
}

/* ===== VOLUMEN CONTEXTUAL: fuerte en la presentación, tenue en el chat ===== */
const PRES_VOL=0.9, CHAT_VOL=0.20; // v3.3: en el chat la música acompaña, no compite (antes 0.34 tapaba la voz)
function presActiva(){
  const bootOn=!document.getElementById('boot').classList.contains('gone');
  const presOn=document.getElementById('pres').classList.contains('open');
  return bootOn||presOn;
}
/* ── v37-vol (B1) — POR QUÉ «SUBÍ LA MÚSICA» SE DESHACÍA SOLO ──
   El itinerario sospechaba de updateMix(). VERIFICADO: updateMix NO toca el
   volumen que se oye — mueve graves, coro, filtro y reverb, nunca masterGain.
   EL CULPABLE ES EL DUCKING:
     1. «subí la música» → setVol(0.5)                     ✔ sube
     2. MIRROR contesta EN VOZ ALTA → duckMusic() → 0.04   ✔ baja para la voz
     3. termina de hablar → setVol(ctxVol()) y ctxVol()
        devolvía la CONSTANTE CHAT_VOL = 0.20              ✘ ¡PISA EL 0.5!
   El comando se autodestruía con su propia confirmación hablada.
   ARREGLO: el volumen que elige el usuario es la FUENTE DE VERDAD, sobrevive al
   duck, al boot y a la presentación, y persiste entre sesiones. */
const VOL_MIN=0.02, VOL_MAX=1.0, VOL_PASO=0.15;
let volUsuario=null; // null = nunca lo tocó → vale el default tenue de siempre
try { const g=localStorage.getItem('mirror_vol'); if(g!==null){ const n=parseFloat(g); if(!isNaN(n)) volUsuario=Math.min(VOL_MAX,Math.max(VOL_MIN,n)); } } catch(e){}
function volChat(){ return volUsuario===null ? CHAT_VOL : volUsuario; }
function ctxVol(){return presActiva()?PRES_VOL:volChat();}
function setVol(v){if(soundOn&&masterGain)masterGain.gain.setTargetAtTime(v,audioCtx.currentTime,0.7);}
/* La perilla del usuario: guarda la decisión Y la aplica. */
function setVolUsuario(v){
  const n=Math.min(VOL_MAX,Math.max(VOL_MIN,Number(v)||0));
  volUsuario=n;
  try { localStorage.setItem('mirror_vol',String(n)); } catch(e){}
  setVol(ctxVol());
  try { volSliderSync(); } catch(e){}
  return n;
}
/* Sube o baja un paso DESDE DONDE ESTÁ, para que «subí» repetido siga subiendo. */
function volPaso(arriba){ return setVolUsuario(volChat() + (arriba?VOL_PASO:-VOL_PASO)); }
function volPct(){ return Math.round(volChat()*100); }
/* Mantiene el control del pie en sintonía con el volumen real. */
function volSliderSync(){
  try {
    const p=volPct(), s=document.getElementById('volSlider');
    if(s){
      if(String(s.value)!==String(p)) s.value=p;
      s.style.setProperty('--pct', p+'%');   // rellena el riel hasta el nivel actual
      s.setAttribute('aria-valuetext', p+'%');
      s.title='Volumen de la música: '+p+'%';
    }
    // El número aparece al tocar el control o al usar los comandos de voz, y se apaga solo.
    const e=document.getElementById('volPct');
    if(e){
      e.textContent=p+'%';
      e.classList.add('viva');
      clearTimeout(volPctTimer);
      volPctTimer=setTimeout(function(){ try{ e.classList.remove('viva'); }catch(_){} }, 1600);
    }
  } catch(e){}
}
let volPctTimer=null;
function startAudioIfNeeded(){
  initAudio();
  const go=()=>{ if(!soundOn){soundOn=true;const b=document.getElementById('sndBtn');
      if(b){b.textContent='🔊 sonido';b.classList.add('playing');} startMusic();}
    if(masterGain)masterGain.gain.setTargetAtTime(ctxVol(),audioCtx.currentTime,0.6); updateMix(); };
  if(audioCtx.state==='suspended') audioCtx.resume().then(go).catch(()=>{}); else go();
}
// el navegador exige una interacción para sonar: el primer gesto del usuario activa todo.
// v3.1 — REGLA DE ORO DEL SONIDO (fix celular 12/6): antes, el primer toque "se gastaba"
// aunque Android dejara el audio colgado en 'suspended' → la música no arrancaba nunca.
// Ahora el gesto REINTENTA en cada toque hasta que el contexto esté realmente corriendo,
// y si el sistema lo suspende (pestaña al fondo, pantalla apagada) lo retomamos al volver.
let audioKick=false;
function firstGesture(){
  if(audioKick)return;
  startAudioIfNeeded();
  setTimeout(()=>{ if(audioCtx && audioCtx.state==='running') audioKick=true; },300);
}
['pointerdown','keydown','touchstart','click'].forEach(ev=>window.addEventListener(ev,firstGesture,{passive:true}));
try{ volSliderSync(); }catch(e){} // v37-vol (B1): el control nace con el volumen guardado
document.addEventListener('visibilitychange',()=>{
  if(!audioCtx) return;
  if(document.hidden){
    // v7: pausamos el audio cuando la pestaña pasa al fondo, así dos MIRROR abiertos a la vez no se solapan.
    try{ audioCtx.suspend().catch(()=>{}); }catch(e){}
  } else if(soundOn && audioCtx.state==='suspended'){
    try{ audioCtx.resume().catch(()=>{}); }catch(e){}
  }
});

/* ===== LOGO COMPACTO: M I R R O R, la I es el monolito, las RR invertidas ===== */
function drawLogoMirror(ctx,W,H,active,fontSize,cyFrac,spin,auraK){
  const aK=(auraK==null?1:auraK);
  const p=palettes[mode];const glow=p.glow;
  const col='rgb('+p.core[0]+','+p.core[1]+','+p.core[2]+')';
  const fs=fontSize||30;
  const cy=H*(cyFrac||0.56);
  const sp=spin||0.02;
  ctx.font='600 '+fs+'px Georgia, serif';
  ctx.textBaseline='middle';
  const gap=fs*0.07;
  const parts=[
    {ch:'M',flip:false},
    {ch:'I',mono:true},
    {ch:'R',flip:false},
    {ch:'R',flip:true},
    {ch:'O',flip:false},
    {ch:'R',flip:false}
  ];
  const monoW=fs*0.34;
  let total=0;
  parts.forEach(pt=>{ total+= pt.mono?monoW: ctx.measureText(pt.ch).width; total+=gap; });
  total-=gap;
  let x=(W-total)/2;
  parts.forEach(pt=>{
    if(pt.mono){
      const mh=fs*1.25, baseY=cy+mh/2;
      drawSpinMonolith(ctx,x+monoW/2,baseY,mh,active?1:0.5,sp,aK);
      x+=monoW+gap;
    }else{
      ctx.save();
      ctx.fillStyle=active?'rgb(255,255,255)':col;
      ctx.shadowColor=rgba(glow,(active?0.7:0.4)*aK);ctx.shadowBlur=Math.min(active?fs*0.4:fs*0.2, active?(8+16*aK):(6+8*aK));
      const w=ctx.measureText(pt.ch).width;
      if(pt.flip){ ctx.translate(x+w,cy);ctx.scale(-1,1);ctx.fillText(pt.ch,0,0); }
      else{ ctx.fillText(pt.ch,x,cy); }
      ctx.restore();
      x+=w+gap;
    }
  });
}

/* ===== PRESENTACIÓN: logo MIRROR grande, sin gente, se manifiesta con el mouse ===== */
/* v18 — campo orbital: partículas recorriendo una elipse inclinada (vista casi de canto)
   alrededor del centro. Profundidad simulada por seno del ángulo: las de "adelante" más
   grandes y brillantes; las de "atrás" tenues. Color por modo (pal().particle). Barato:
   solo corre con el boot activo o la presentación abierta. */
function drawOrbField(ctx,W,H,cx,cy,lit){
  const col=pal().particle, base=Math.min(W,H), squash=0.34;
  for(let i=0;i<orbs.length;i++){
    const o=orbs[i], ang=o.a+t*o.sp, r=base*o.rad;
    const x=cx+Math.cos(ang)*r, y=cy+Math.sin(ang)*r*squash;
    const depth=(Math.sin(ang)+1)/2;            // 0 atrás .. 1 adelante
    const sz=o.size*(0.5+0.85*depth);
    const a=(0.08+0.5*depth)*(0.6+0.6*lit)*(0.7+0.3*Math.sin(t*0.05+o.ph));
    ctx.fillStyle=rgba(col,Math.max(0,Math.min(0.85,a)));
    ctx.beginPath();ctx.arc(x,y,Math.max(0.3,sz),0,6.28);ctx.fill();
  }
}
function drawPresLogo(ctx,W,H){
  const p=palettes[mode];const glow=p.glow;
  const lit=mouseGlow; // SOLO el mouse lo enciende/hace girar más
  // fondo: degradé sutil de marca
  let bg=ctx.createRadialGradient(W/2,H*0.42,10,W/2,H*0.42,Math.max(10,W*0.7));
  if(mode==='tars'){bg.addColorStop(0,'#06231f');bg.addColorStop(1,'#020a08');}
  else{bg.addColorStop(0,'#140f2e');bg.addColorStop(1,'#05030c');}
  ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
  // estrellas estáticas titilando (como en el archivo original)
  stars.forEach(s=>{
    const tw=0.35+0.5*Math.sin(t*0.03*s.sp+s.ph);
    ctx.fillStyle=rgba([255,255,255],tw*0.6);
    ctx.beginPath();ctx.arc(s.x*W,s.y*H,s.r,0,6.28);ctx.fill();
  });
  // halo central muy tenue: el reflejo del espejo es el protagonista
  const cxp=W/2, cyp=H*0.42;
  let halo=ctx.createRadialGradient(cxp,cyp,10,cxp,cyp,Math.max(20,W*(0.16+lit*0.14)));
  halo.addColorStop(0,rgba(glow,0.11+0.18*lit));halo.addColorStop(1,rgba(glow,0));
  ctx.fillStyle=halo;ctx.beginPath();ctx.arc(cxp,cyp,Math.max(20,W*(0.16+lit*0.14)),0,6.28);ctx.fill();
  drawOrbField(ctx,W,H,cxp,cyp,lit);
  // el logo: gira 360° continuo (como el header); el mouse solo lo enciende, no lo acelera
  const fs=Math.min(W*0.16, 150);
  const spin=0.018;
  drawLogoMirror(ctx,W,H,lit>0.08,fs,0.42,spin,0.66); // auraK 0.66 = un poco más de luz
}

/* ===== MONOLITO GIRATORIO 360° (reutilizable: escena grande y logo header) ===== */
function drawSpinMonolith(ctx,cx,baseY,height,lit,spinSpeed,auraK){
  // monolito como caja delgada que gira sobre su eje vertical
  const p=palettes[mode];const glow=p.glow;
  const aK=(auraK==null?1:auraK);
  const ang=t*spinSpeed;                 // ángulo de giro
  const depth=height*0.075;              // grosor (1:4:9 → muy delgado)
  const halfW=height*0.165;              // mitad del ancho de la cara
  // ancho proyectado de cada cara según el giro (perspectiva simple)
  const faceW=Math.abs(Math.cos(ang))*halfW;   // cara ancha
  const sideW=Math.abs(Math.sin(ang))*depth;   // canto
  const my=baseY-height;
  // aura — halo doble que respira (vivo)
  const breathe=Math.sin(t*0.045)*0.06;
  const auraR=height*(0.52+lit*0.45+breathe);
  const acy=my+height/2;
  // halo exterior amplio
  let aura2=ctx.createRadialGradient(cx,acy,height*0.1,cx,acy,Math.max(2,auraR*1.7));
  aura2.addColorStop(0,rgba(glow,(0.06+0.14*lit)*aK));aura2.addColorStop(1,rgba(glow,0));
  ctx.fillStyle=aura2;ctx.beginPath();ctx.arc(cx,acy,Math.max(2,auraR*1.7),0,6.28);ctx.fill();
  // halo interno intenso
  let aura=ctx.createRadialGradient(cx,acy,height*0.06,cx,acy,Math.max(2,auraR));
  aura.addColorStop(0,rgba(glow,(0.16+0.34*lit)*aK));aura.addColorStop(0.55,rgba(glow,(0.08+0.16*lit)*aK));aura.addColorStop(1,rgba(glow,0));
  ctx.fillStyle=aura;ctx.beginPath();ctx.arc(cx,acy,Math.max(2,auraR),0,6.28);ctx.fill();
  // orden de caras según giro para que el canto quede "detrás"
  const front=Math.cos(ang)>=0;
  // cara principal
  if(faceW>0.5){
    ctx.fillStyle=front?'#050507':'#020203';
    ctx.fillRect(cx-faceW,my,faceW*2,height);
    // reflejo
    let sh=ctx.createLinearGradient(cx-faceW,0,cx+faceW,0);
    sh.addColorStop(0,rgba([255,255,255],0.05+0.06*lit));sh.addColorStop(0.35,rgba([255,255,255],0));
    ctx.fillStyle=sh;ctx.fillRect(cx-faceW,my,faceW*2,height);
  }
  // canto lateral (aparece a los costados al girar)
  if(sideW>0.5){
    const sx=Math.sin(ang)>=0?cx+faceW:cx-faceW-sideW;
    ctx.fillStyle='#010102';
    ctx.fillRect(sx,my,sideW,height);
  }
  // ARISTAS encendidas
  ctx.lineWidth=1.5;ctx.lineJoin='round';
  ctx.strokeStyle=rgba(glow,0.30+0.65*lit);
  if(faceW>0.5)ctx.strokeRect(cx-faceW,my,faceW*2,height);
  // brillo blanco en las aristas verticales
  if(lit>0.15&&faceW>0.5){
    ctx.lineWidth=2.2;ctx.strokeStyle=rgba([255,255,255],0.28*lit);
    ctx.beginPath();ctx.moveTo(cx-faceW,my);ctx.lineTo(cx-faceW,my+height);
    ctx.moveTo(cx+faceW,my);ctx.lineTo(cx+faceW,my+height);ctx.stroke();
  }
  // destello recorriendo cuando el frente nos mira
  if(lit>0.05&&faceW>halfW*0.5){
    const ly=my+height-(height+30)*((t*0.012)%1);
    let fl=ctx.createLinearGradient(0,ly-28,0,ly+28);
    fl.addColorStop(0,rgba(glow,0));fl.addColorStop(0.5,rgba([255,255,255],0.5*lit));fl.addColorStop(1,rgba(glow,0));
    ctx.fillStyle=fl;ctx.fillRect(cx-faceW-2,ly-28,faceW*2+4,56);
  }
}

const stars=[];for(let i=0;i<70;i++)stars.push({x:Math.random(),y:Math.random()*0.45,r:0.4+Math.random()*1.2,ph:Math.random()*6.28,sp:0.4+Math.random()*1.6});
/* v18 — campo orbital de partículas: complementa el monolito en boot/presentación (NO lo reemplaza). */
const ORB_N=(typeof innerWidth==='number'&&innerWidth<600)?90:150;
const orbs=[];for(let i=0;i<ORB_N;i++)orbs.push({a:Math.random()*6.28,sp:0.0025+Math.random()*0.006,rad:0.26+Math.random()*0.24,size:0.6+Math.random()*1.7,ph:Math.random()*6.28});
let mouseGlow=0; // 0 apagado, sube al mover el mouse, baja solo

/* canvases de la fachada */
const hdrCtx=document.getElementById('hdrOrb').getContext('2d');
const presCanvas=document.getElementById('presCanvas'),presCtx=presCanvas.getContext('2d');
const bootCanvas=document.getElementById('bootCanvas'),bootCtx=bootCanvas.getContext('2d');
let dpr=1;
function sizeFull(c){dpr=Math.min(window.devicePixelRatio||1,2);c.width=innerWidth*dpr;c.height=innerHeight*dpr;c.getContext('2d').setTransform(dpr,0,0,dpr,0,0);}
function sizeAll(){sizeFull(presCanvas);sizeFull(bootCanvas);}
addEventListener('resize',sizeAll);sizeAll();

/* pulso reactivo en el header (micro-pulso al recibir mensaje, aprobado) */
let pulse=0;
function trigPulse(){pulse=0.5;}
document.getElementById('symbol').addEventListener('click',()=>{trigPulse();firstGesture();});

/* el mouse/touch enciende el logo en boot y presentación */
addEventListener('mousemove',()=>{ if(presActiva())mouseGlow=Math.min(1,mouseGlow+0.035); });
addEventListener('touchmove',()=>{ if(presActiva())mouseGlow=Math.min(1,mouseGlow+0.04); },{passive:true});

function loop(){
  t++;
  if(pulse>0)pulse=Math.max(0,pulse-0.03);
  if(mouseGlow>0)mouseGlow=Math.max(0,mouseGlow-0.015);
  // v31 (D2) — ORBE VIVO (SUTIL, ajustado a pedido de Darío): el header insinúa vida
  //   SIN alejarse del orbe original. reposo → respira apenas (±0.05 alrededor de 1.0);
  //   pensando → late muy suave. El brillo y el giro (0.07) al pensar son los de siempre.
  //   Color por modo lo da palettes[mode]. Solo visual: no toca lógica ni datos.
  const _spinHdr = hdrThinking ? 0.07 : 0.02;
  const _auraHdr = hdrThinking
    ? (1.05 + 0.10*Math.pow(Math.sin(t*0.14),2))      // latido apenas perceptible al pensar
    : (1.0 + 0.05*Math.sin(t*0.04) + 0.25*pulse);     // respiración mínima + leve destello al recibir
  const _vivoHdr = hdrThinking || pulse>0.05;
  hdrCtx.setTransform(1,0,0,1,0,0);hdrCtx.clearRect(0,0,340,96);
  drawLogoMirror(hdrCtx,340,96,_vivoHdr,30,0.56,_spinHdr,_auraHdr);
  setDrone(hdrThinking?0.06:0.02);
  if(!document.getElementById('boot').classList.contains('gone')){
    bootCtx.clearRect(0,0,innerWidth,innerHeight);
    drawPresLogo(bootCtx,innerWidth,innerHeight);
  }
  if(document.getElementById('pres').classList.contains('open')){
    presCtx.clearRect(0,0,innerWidth,innerHeight);
    drawPresLogo(presCtx,innerWidth,innerHeight);
  }
  requestAnimationFrame(loop);
}
loop();

/* ═══ CINEMÁTICA DE ARRANQUE (10 s, salteable con un toque) ═══ */
let bootDone=false;
function finishBoot(){
  if(bootDone)return; bootDone=true;
  document.getElementById('boot').classList.add('gone');
  document.getElementById('app').classList.add('ready');
  // v32 — FIRMA SONORA: suena al nacer el MIRROR (no en vista compartida), con el master
  // aún en volumen de presentación (clímax). Respeta el toggle 🔊. Luego setVol baja al chat.
  if (!window.MODO_COMPARTIDO){ try{ firmaOrigen(); }catch(_){ } }
  setVol(ctxVol()); // v37-vol (B1): respeta el volumen elegido, no la constante
  // v22 · Palanca D: si abrieron un link compartido, mostramos la carta de solo-lectura y nada más.
  if (window.MODO_COMPARTIDO){
    if (typeof window.mostrarVistaCompartida==='function') window.mostrarVistaCompartida(window.MODO_COMPARTIDO);
    return;
  }
  // Terminada la cinemática de "El Origen", nace el constructor (si hace falta).
  // v7: si falta configurar, se lanza YA (sin demora) — antes esperaba 400ms y se veía el MIRROR construido por un instante.
  if (typeof lanzarConstructorTrasBoot === 'function') {
    if (window.MIRROR_necesitaConfig) lanzarConstructorTrasBoot();
    else setTimeout(lanzarConstructorTrasBoot, 400);
  }
}
function bootCine(){
  /* v37-fachada (V36-3): con la fachada apagada, la cinemática de nacimiento no
     corre — la app aparece de una. Es lo que la perilla promete. */
  try {
    const capF = (typeof CONFIG!=='undefined' && CONFIG && CONFIG.cap) ? (CONFIG.cap.fachada !== false) : true;
    if (!capF) { startAudioIfNeeded(); finishBoot(); return; }
  } catch(e){}
  startAudioIfNeeded();
  setTimeout(()=>{document.getElementById('bootTitle').classList.add('show');},600);
  setTimeout(()=>{document.getElementById('bootSign').classList.add('show');},1200);
  // v23: quien abre un link compartido ve un teaser breve del monolito (no la cinemática entera),
  // así la carta de solo-lectura aparece rápido (clave para abrir desde el celu). El flujo normal no cambia.
  var _boot = window.MODO_COMPARTIDO ? 2600 : 10000;
  setTimeout(finishBoot,_boot);
  setTimeout(finishBoot,_boot+2000); // failsafe absoluto: la app SIEMPRE aparece
}
window.addEventListener('load',()=>setTimeout(bootCine,200));

/* ═══ PRESENTACIÓN / DEFENSA ═══ */
function openPres(){const pr=document.getElementById('pres');pr.classList.add('open');sizeAll();
  startAudioIfNeeded();
  setTimeout(()=>{document.getElementById('presTitle').classList.add('show');
    document.getElementById('presSign').classList.add('show');},400);}
function closePres(){document.getElementById('pres').classList.remove('open');
  document.getElementById('presTitle').classList.remove('show');
  document.getElementById('presSign').classList.remove('show');
  setVol(ctxVol());} // v37-vol (B1): respeta el volumen elegido, no la constante
addEventListener('keydown',e=>{
  if(!document.getElementById('pres').classList.contains('open'))return;
  if(e.key==='Escape')closePres();
  if(e.key===' '){e.preventDefault();mouseGlow=1;}
  if(e.key==='m')setMode('mirror');if(e.key==='t')setMode('tars');
});

/* ═══ DUCKING: cuando MIRROR/TARS hablan, la música baja y respeta la voz ═══ */
let duckTimer=null;
function duckMusic(){
  if(!soundOn||!masterGain)return;
  // v3.3: ducking más hondo (0.04, antes 0.10 — seguía tapando la voz en el celu) y con
  // período de gracia: el chequeo no devuelve el volumen en los primeros 1,5 s, porque la
  // cola de lectura puede tardar en arrancar y el timer la pisaba antes de la primera palabra.
  setVol(0.04);
  const desde=Date.now();
  if(duckTimer)clearInterval(duckTimer);
  duckTimer=setInterval(()=>{
    const hablando=window.speechSynthesis&&(speechSynthesis.speaking||speechSynthesis.pending);
    if(!hablando && Date.now()-desde>1500){
      clearInterval(duckTimer);duckTimer=null;setVol(ctxVol());
    }
  },500);
}


/* ════════════════════════════════════════════════════════════════════════
   ║  CONSTRUCTOR DE MIRROR  ·  asistente visual de primera configuración    ║
   ║  Una idea original de Darío Alejandro Tello.                            ║
   ║  Permite a cualquier persona armar su propio MIRROR —nombres, motor,    ║
   ║  capacidades, colores y perfil— sin tocar una línea de código.          ║
   ════════════════════════════════════════════════════════════════════════ */
(function(){
  const css = document.createElement('style');
  css.textContent = `
  #cons-ov{position:fixed;inset:0;z-index:99999;display:none;overflow-y:auto;
    background:radial-gradient(ellipse at 50% -10%,#11112e 0%,#06061a 45%,#00000a 100%);
    font-family:'Space Mono', ui-monospace, 'Cascadia Mono', 'Segoe UI Mono', 'DejaVu Sans Mono', monospace;color:#d8d8f0;animation:consWake 1.1s ease both;}
  #cons-ov.show{display:block;}
  @keyframes consWake{from{opacity:0;filter:blur(14px);}to{opacity:1;filter:none;}}
  #cons-stars{position:fixed;inset:0;pointer-events:none;z-index:0;opacity:.5;}
  .cons-wrap{position:relative;z-index:2;max-width:600px;margin:0 auto;padding:54px 24px 80px;min-height:100%;}
  .cons-mono{width:14px;height:62px;margin:0 auto 16px;border-radius:2px;
    background:linear-gradient(180deg,#1a1a2e,#000 50%,#1a1a2e);
    box-shadow:0 0 26px var(--cons-accent,#7070ff),0 0 60px rgba(112,112,255,.3);
    animation:consMono 6s ease-in-out infinite;}
  @keyframes consMono{0%,100%{transform:rotateY(0) scaleY(1);}50%{transform:rotateY(180deg) scaleY(1.04);}}
  .cons-logo{text-align:center;font-family:'Cormorant Garamond', Georgia, 'Times New Roman', serif;font-size:34px;font-weight:300;
    letter-spacing:8px;color:#f4f4ff;margin-bottom:3px;text-shadow:0 0 30px rgba(112,112,255,.4);}
  .cons-logo b{color:var(--cons-accent,#7070ff);font-style:normal;}
  .cons-sub{text-align:center;font-size:9.5px;letter-spacing:3px;color:#6a6a92;text-transform:uppercase;margin-bottom:4px;}
  .cons-author{text-align:center;font-size:9px;letter-spacing:2px;color:#4a4a6a;margin-bottom:8px;font-style:italic;}
  .cons-ver{text-align:center;font-size:10px;letter-spacing:2.5px;color:#8a8ac8;margin-bottom:10px;opacity:0.9;}
  .cons-ver::before{content:'· ';opacity:0.5;}.cons-ver::after{content:' ·';opacity:0.5;}
  .cons-prog{display:flex;gap:6px;justify-content:center;margin:20px 0 30px;}
  .cons-prog span{width:26px;height:3px;border-radius:3px;background:rgba(120,120,255,0.15);transition:.4s;}
  .cons-prog span.on{background:var(--cons-accent,#7070ff);box-shadow:0 0 10px var(--cons-accent,#7070ff);}
  .cons-step{display:none;}
  .cons-step.show{display:block;animation:consFade .55s cubic-bezier(.2,.8,.2,1);}
  @keyframes consFade{from{opacity:0;transform:translateY(14px);}to{opacity:1;transform:none;}}
  .cons-h{font-family:'Cormorant Garamond', Georgia, 'Times New Roman', serif;font-size:27px;font-weight:300;color:#f4f4ff;margin-bottom:9px;line-height:1.25;}
  .cons-h em{color:var(--cons-accent,#7070ff);font-style:italic;}
  .cons-p{font-size:12.5px;line-height:1.75;color:#9a9ab8;margin-bottom:20px;}
  .cons-p b{color:#c0c0e0;font-weight:400;}
  .cons-label{display:block;font-size:10.5px;letter-spacing:1.5px;color:#8484ae;text-transform:uppercase;margin:16px 0 6px;}
  .cons-inp,.cons-sel,.cons-ta{width:100%;background:rgba(120,120,255,0.05);border:1px solid rgba(120,120,255,0.16);
    border-radius:10px;color:#eaeaff;font-family:'Space Mono', ui-monospace, 'Cascadia Mono', 'Segoe UI Mono', 'DejaVu Sans Mono', monospace;font-size:13px;padding:12px 14px;outline:none;transition:.25s;box-sizing:border-box;}
  .cons-sel option{background:#0d0d1c;color:#eaeaff;} /* v39-consmodelo: en Windows (Edge/Chrome) la lista desplegable es blanca y heredaba el texto #eaeaff → las opciones no se leían */
  .cons-inp:focus,.cons-sel:focus,.cons-ta:focus{border-color:var(--cons-accent,#7070ff);background:rgba(120,120,255,0.09);
    box-shadow:0 0 0 3px var(--cons-accent-glow,rgba(112,112,255,.12));}
  .cons-ta{resize:vertical;min-height:68px;line-height:1.6;}
  .cons-hint{font-size:11px;color:#646488;margin-top:6px;line-height:1.55;}
  .cons-hint b{color:#9494c4;font-weight:400;}
  .cons-row{display:flex;gap:11px;flex-wrap:wrap;}.cons-row>*{flex:1;min-width:130px;}
  .cons-mcard{border:1px solid rgba(120,120,255,0.14);border-radius:12px;padding:13px 15px;margin-bottom:10px;cursor:pointer;
    transition:.25s;position:relative;overflow:hidden;}
  .cons-mcard:hover{border-color:rgba(120,120,255,0.4);background:rgba(120,120,255,0.05);transform:translateX(3px);}
  .cons-mcard.sel{border-color:var(--cons-accent,#7070ff);background:var(--cons-accent-glow,rgba(112,112,255,0.1));
    box-shadow:0 0 22px var(--cons-accent-glow,rgba(112,112,255,.15));}
  .cons-mcard .mt{font-size:13.5px;color:#eaeaff;display:flex;align-items:center;gap:9px;flex-wrap:wrap;}
  .cons-mcard .badge{font-size:8.5px;letter-spacing:1px;padding:2px 8px;border-radius:20px;text-transform:uppercase;}
  .cons-mcard .badge.free{background:rgba(74,222,128,0.16);color:#4ade80;}
  .cons-mcard .badge.prem{background:rgba(255,184,107,0.16);color:#ffb86b;}
  .cons-mcard .md{font-size:11px;color:#7c7c9e;margin-top:5px;line-height:1.5;}
  .cons-mcard .mcost{font-size:10.5px;margin-top:8px;line-height:1.5;color:#9a9ac0;border-top:1px solid rgba(120,120,255,0.1);padding-top:7px;}
  .cons-mcard .mcost a{color:#9aa0ff;text-decoration:underline;}
  .cons-mcard .mcost.free{color:#7fcf9a;}
  .cons-premlink{display:inline-block;margin:14px 0 2px;color:#ffd9a0;cursor:pointer;font-size:12px;text-decoration:underline;}
  /* Toggles de capacidad */
  .cons-tog{display:flex;align-items:center;justify-content:space-between;gap:12px;
    border:1px solid rgba(120,120,255,0.14);border-radius:12px;padding:13px 16px;margin-bottom:10px;transition:.2s;}
  .cons-tog:hover{border-color:rgba(120,120,255,0.3);}
  .cons-tog .tl{font-size:13px;color:#eaeaff;}
  .cons-tog .td{font-size:10.5px;color:#7c7c9e;margin-top:3px;line-height:1.4;}
  .cons-sw{flex:0 0 auto;width:46px;height:26px;border-radius:20px;background:rgba(120,120,255,0.18);position:relative;cursor:pointer;transition:.3s;}
  .cons-sw::after{content:'';position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#9a9ac4;transition:.3s;}
  .cons-sw.on{background:var(--cons-accent,#7070ff);}
  .cons-sw.on::after{left:23px;background:#fff;}
  /* Esquema de color */
  .cons-colors{display:flex;gap:12px;flex-wrap:wrap;margin-top:4px;}
  /* v35-car (Etapa 5B): perillas de carácter */
  .cons-car{margin:10px 0;}
  .cons-car-top{display:flex;justify-content:space-between;align-items:center;}
  .cons-car-val{font-size:10px;color:var(--accent);font-family:'Space Mono', ui-monospace, 'Cascadia Mono', 'Segoe UI Mono', 'DejaVu Sans Mono', monospace;}
  .cons-range{width:100%;accent-color:var(--accent);margin:4px 0 2px;cursor:pointer;}
  .cons-car-ends{display:flex;justify-content:space-between;font-size:9px;opacity:0.55;}
  .cons-color{width:42px;height:42px;border-radius:50%;cursor:pointer;border:2px solid transparent;transition:.2s;position:relative;}
  .cons-color:hover{transform:scale(1.1);}
  .cons-color.sel{border-color:#fff;box-shadow:0 0 16px currentColor;}
  .cons-nav{display:flex;gap:11px;margin-top:30px;}
  .cons-btn{flex:1;border:none;border-radius:10px;padding:14px;font-family:'Space Mono', ui-monospace, 'Cascadia Mono', 'Segoe UI Mono', 'DejaVu Sans Mono', monospace;font-size:13px;font-weight:700;
    letter-spacing:1px;cursor:pointer;transition:.25s;}
  .cons-btn.prim{background:var(--cons-accent,#7070ff);color:#fff;box-shadow:0 4px 24px var(--cons-accent-glow,rgba(112,112,255,.3));}
  .cons-btn.prim:hover{filter:brightness(1.15);transform:translateY(-1px);}
  .cons-btn.sec{background:rgba(120,120,255,0.07);color:#9a9ab8;border:1px solid rgba(120,120,255,0.18);}
  .cons-btn.sec:hover{color:#eaeaff;}
  .cons-skip{text-align:center;margin-top:16px;}
  .cons-skip a{font-size:11px;color:#646488;text-decoration:underline;cursor:pointer;}
  .cons-ok{font-size:48px;text-align:center;margin:14px 0;animation:consPulse 2.5s ease infinite;}
  @keyframes consPulse{0%,100%{opacity:1;transform:scale(1);}50%{opacity:.7;transform:scale(1.08);}}
  .cons-foot{text-align:center;font-size:9px;letter-spacing:1.5px;color:#3e3e5c;margin-top:40px;line-height:1.6;font-style:italic;}
  `;
  document.head.appendChild(css);

  const ov = document.createElement('div');
  ov.id = 'cons-ov';
  ov.innerHTML = `
   <canvas id="cons-stars"></canvas>
   <div class="cons-wrap">
     <div class="cons-mono"></div>
     <div class="cons-logo">MIR<b>[Я]</b>OR</div>
     <div class="cons-sub">El Origen · Constructor</div>
     <div class="cons-author">una idea de Darío A. Tello</div>
     <div class="cons-ver" data-ver></div>
     <div class="cons-prog" id="cons-prog"></div>

     <div class="cons-step" data-step="0">
       <div id="cons-volver" style="display:none;margin:0 0 20px;padding:14px 16px;border:1px solid var(--cons-accent,#7070ff);border-radius:12px;background:rgba(112,112,255,0.08);text-align:center;">
         <div class="cons-p" style="margin:0 0 12px;"><span>Ya tenés tu MIRROR armado en este navegador:</span> <b id="cons-volver-nom"></b></div>
         <div class="cons-nav" style="margin-top:0;"><button class="cons-btn prim" onclick="consEnter()">Entrar a mi MIRROR ▸</button></div>
         <div class="cons-hint" style="margin-top:8px;">O seguí abajo para ajustarlo o armar uno nuevo.</div>
       </div>
       <div class="cons-h">Vas a crear tu <em>propio MIRROR</em>.</div>
       <div class="cons-p">Tu MIRROR es tu entidad digital: te conoce, habla como vos y trabaja para vos. En unos pocos pasos lo vas a tener andando — <b>sin escribir una sola línea de código</b>. Te acompaño en cada decisión, como si lo armáramos juntos. Lo único que tenés que haber conseguido antes (la guía te explica cómo): tu clave de IA, tu proxy y tu memoria.</div>
       <label class="cons-label" style="margin-top:16px;">🌐 Idioma de tu MIRROR</label>
       <select class="cons-sel" id="c-idioma" onchange="i18nConsCambiar(this.value)">
         <option value="es" selected>Español (rioplatense)</option>
         <option value="en">English</option>
         <option value="pt">Português (Brasil)</option>
       </select>
       <div class="cons-hint">Gobierna la interfaz, el dictado, las voces, las encuestas, los informes y el idioma en que responde tu espejo. Honestidad: los modos analítico y examinador siguen respondiendo en español — tu MIRROR te lo va a decir de frente si se lo pedís en otro idioma.</div>
       <div class="cons-nav"><button class="cons-btn prim" onclick="consGo(1)">Comenzar el viaje ▸</button></div>
       <div class="cons-skip" style="margin-top:8px;"><a onclick="abrirGuia()" style="color:#9aa0ff;">📖 ¿No tenés tu clave, proxy y memoria todavía? Abrí la guía paso a paso</a></div>
       <div class="cons-skip"><a onclick="consSkip()">Soy técnico, llevame directo a la app</a></div>
     </div>

     <div class="cons-step" data-step="1">
       <div class="cons-h">Dale un <em>nombre</em> a tu MIRROR.</div>
       <div class="cons-p">Tu MIRROR tiene cuatro modos. Llamalos como quieras — estos son los nombres que vas a ver en pantalla. Si te gustan los que vienen, dejalos.</div>
       <label class="cons-label">Nombre de tu entidad</label>
       <input class="cons-inp" id="c-appName" placeholder="MIRROR">
       <div class="cons-row">
         <div><label class="cons-label">Tu yo digital</label><input class="cons-inp" id="c-m-mirror" placeholder="MIRROR"></div>
         <div><label class="cons-label">Analítico</label><input class="cons-inp" id="c-m-tars" placeholder="TARS"></div>
       </div>
       <div class="cons-row">
         <div><label class="cons-label">Experto / examinador</label><input class="cons-inp" id="c-m-jurado" placeholder="EXAMINADOR"></div>
         <div><label class="cons-label">Conexiones / datos</label><input class="cons-inp" id="c-m-conn" placeholder="CONEX"></div>
       </div>
       <div class="cons-nav"><button class="cons-btn sec" onclick="consGo(0)">◂ Atrás</button><button class="cons-btn prim" onclick="consGo(2)">Siguiente ▸</button></div>
     </div>

     <div class="cons-step" data-step="2">
       <div class="cons-h">Elegí tu <em>motor</em>.</div>
       <div class="cons-p">Es lo que hace pensar a tu MIRROR. Pensalo como el motor de tu auto: los <b>gratuitos</b> alcanzan de sobra para volar. Los <b>premium</b> son más potentes, pero necesitan créditos pagos. Vos elegís tu máquina.</div>
       <div id="cons-motores"></div>
       <label class="cons-label">Modelo</label>
       <select class="cons-sel" id="c-modelo"></select>
       <div class="cons-hint" id="c-motor-clave"></div>
       <a class="cons-premlink" onclick="abrirPremium()">💎 ¿Gratis o premium? Mirá qué cuesta cada cosa, sin humo</a>
       <div class="cons-nav"><button class="cons-btn sec" onclick="consGo(1)">◂ Atrás</button><button class="cons-btn prim" onclick="consGo(3)">Siguiente ▸</button></div>
     </div>

     <div class="cons-step" data-step="3">
       <div class="cons-h">¿Qué <em>sabe hacer</em> tu MIRROR?</div>
       <div class="cons-p">Activá solo lo que quieras. Cada cosa es real y ya está construida — nada de humo. Algunos prefieren su MIRROR en silencio; otros, con voz y micrófono. Es tu decisión.</div>
       <div id="cons-toggles"></div>
       <label class="cons-label">Panel estado 🧅 <span style="opacity:0.6;font-size:9px;">(opcional — el estado interno de tu MIRROR en números honestos)</span></label>
       <div id="cons-cebolla"></div>
       <label class="cons-label">Carácter de tu MIRROR <span style="opacity:0.6;font-size:9px;">(perillas estilo TARS de Interstellar — vos las regulás)</span></label>
       <div id="cons-caracter"></div>
       <a class="cons-premlink" onclick="abrirPremium()">💎 Insumos premium (honestos) y qué viene próximamente</a>
       <label class="cons-label">Color de tu MIRROR</label>
       <div class="cons-colors" id="cons-colors"></div>
       <div class="cons-nav"><button class="cons-btn sec" onclick="consGo(2)">◂ Atrás</button><button class="cons-btn prim" onclick="consGo(4)">Siguiente ▸</button></div>
     </div>

     <div class="cons-step" data-step="4">
       <div class="cons-h">Conectá tus <em>direcciones</em>.</div>
       <div class="cons-p">Las tres direcciones tuyas que obtuviste con la guía. Tu clave de IA <b>no va acá</b>: vive segura en tu proxy, nunca en el navegador.</div>
       <div style="margin:2px 0 10px;"><a onclick="abrirGuia()" style="color:#9aa0ff;cursor:pointer;font-size:12px;text-decoration:underline;">📖 Ver la guía para conseguir estas tres direcciones</a></div>
       <label class="cons-label">Tu proxy (Cloudflare Worker)</label>
       <input class="cons-inp" id="c-proxy" placeholder="https://mi-mirror-api.workers.dev">
       <div class="cons-hint">La que termina en <b>.workers.dev</b>.</div>
       <label class="cons-label">Tu memoria (Firebase)</label>
       <input class="cons-inp" id="c-fb" placeholder="https://mi-mirror-default-rtdb.firebaseio.com" onblur="consChequearConfigPrevia()">
       <div class="cons-hint">La que termina en <b>.firebaseio.com</b>.</div>
       <!-- v38-base (1/08/2026) — LA REGLA DE ORO DE LA BASE, dicha ANTES de la receta.
            Antes acá se recomendaban las reglas abiertas y la advertencia iba al final, en
            letra chica. El riesgo real no es que TU base esté abierta —es tuya y sabés lo que
            hay—, es que alguien reparta su MIRROR a varias personas contra LA MISMA base: ahí
            cada uno puede leer lo de los demás. Eso ya no es un riesgo propio, es afectar a
            terceros. La solución sencilla no es criptografía: es UNA BASE POR PERSONA. -->
       <div style="margin-top:12px;padding:13px 15px;border-radius:10px;background:rgba(74,222,128,0.07);border:1px solid rgba(74,222,128,0.32);font-size:12px;color:#c8f5d8;line-height:1.6;">
         <b>📌 La regla de oro: una base por persona.</b><br>
         Tu memoria es tuya y va a tu base. <b>No le pases esta misma dirección a otras personas</b> para que la usen: si varias usan la misma base, <b>pueden leer lo que escriben las demás</b>. No es una falla del MIRROR, es cómo funciona una base compartida.<br>
         <span style="display:block;margin-top:7px;"><b>Tranquilo, esto no pasa por accidente:</b> cuando compartís tu MIRROR por link, se comparte la vitrina (nombre, modos, color, tu presentación) — <b>tu base, tu proxy y tu PIN no viajan ahí</b>. Quien lo abra se arma el suyo. Solo pasaría si vos le pasás a mano esta dirección o tu archivo de respaldo: no lo hagas.</span>
         <span style="display:block;margin-top:7px;">¿Querés que otra gente tenga MIRROR —alumnos, tu familia, un equipo? <b>Que cada uno cree el suyo</b>, gratis, con la misma guía. Cinco minutos por persona, y la intimidad de cada uno queda donde tiene que estar. Si necesitás sí o sí que compartan base, hacen falta <b>reglas con autenticación</b>: eso lo explica la guía, y hasta tenerlas andando, no cargues ahí nada de terceros.</span>
       </div>
       <div style="margin-top:10px;padding:12px 14px;border-radius:10px;background:rgba(255,180,0,0.07);border:1px solid rgba(255,180,0,0.28);font-size:12px;color:#ffd9a0;line-height:1.55;">
         <b>⚠ Para que tu memoria no caduque.</b> Si creaste tu Firebase en «modo de prueba», a los <b>30 días deja de guardar</b> sola (es una regla de Firebase, no de tu MIRROR: el MIRROR sigue abriendo, pero pierde la memoria nueva).<br>
         Para que dure, en la consola de Firebase → <b>Realtime Database → pestaña Reglas</b>:
         <code style="display:block;margin-top:7px;padding:8px 10px;border-radius:7px;background:rgba(0,0,0,0.35);color:#ffe9c2;font-size:11px;letter-spacing:0;white-space:pre;">{ "rules": { ".read": true, ".write": true } }</code>
         <span style="display:block;margin-top:7px;font-size:11px;opacity:0.86;"><b>Qué significa esto exactamente, sin adornos:</b> cualquiera que conozca la dirección de tu base puede leer y escribir en ella. La dirección no se publica en ningún lado, pero <b>tampoco es un secreto fuerte</b>: viaja en tu navegador. Para tu memoria personal, en tu base, es un riesgo que podés asumir sabiéndolo. <b>Para datos de otras personas, no.</b> Ahí van reglas con autenticación.</span>
       </div>
       <div id="cons-recuperar" style="display:none;margin-top:10px;padding:12px 14px;border-radius:10px;background:rgba(74,222,128,0.08);border:1px solid rgba(74,222,128,0.3);font-size:12px;color:#bdf0cf;line-height:1.5;"></div>
       <label class="cons-label">Tu PIN de memoria (inventá uno)</label>
       <input class="cons-inp" id="c-pin" placeholder="un PIN tuyo">
       <!-- v37-tel (A1): white-label, no se puede asumir Argentina -->
       <label class="cons-label">Código de país para WhatsApp (opcional)</label>
       <input class="cons-inp" id="c-pais" placeholder="54 (Argentina) · 34 (España) · 52 (México) · 1 (EE.UU.)" inputmode="numeric">
       <div class="cons-hint">Solo los números, sin el +. WhatsApp exige el número completo con código de país: sin esto, un número local no abre el chat. Si guardás tus contactos con + y el código, no hace falta.</div>
       <div class="cons-nav"><button class="cons-btn sec" onclick="consGo(3)">◂ Atrás</button><button class="cons-btn prim" onclick="consGo(5)">Siguiente ▸</button></div>
     </div>

     <div class="cons-step" data-step="5">
       <div class="cons-h">¿Quién <em>sos</em>?</div>
       <div class="cons-p">Esto es lo que hace que tu MIRROR hable como vos y no como un robot. Cuanto más cuentes, mejor te conoce. Completá lo que quieras ahora; lo podés ampliar siempre.</div>
       <div class="oficio-wrap">
         <div class="oficio-lbl">¿A qué te dedicás? Tocá un punto de partida (opcional — después editás todo a tu gusto):</div>
         <div class="oficio-chips">
           <button type="button" class="oficio-chip" onclick="aplicarOficio('docente',this)">📚 Docente</button>
           <button type="button" class="oficio-chip" onclick="aplicarOficio('emprendedor',this)">💼 Emprendedor/a</button>
           <button type="button" class="oficio-chip" onclick="aplicarOficio('musico',this)">🎵 Músico/a</button>
           <button type="button" class="oficio-chip" onclick="aplicarOficio('creativo',this)">✍️ Escritor/a</button>
           <button type="button" class="oficio-chip" onclick="aplicarOficio('salud',this)">🩺 Salud</button>
           <button type="button" class="oficio-chip" onclick="aplicarOficio('oficina',this)">🗂️ Oficina</button>
           <button type="button" class="oficio-chip" onclick="aplicarOficio('estudiante',this)">🎓 Estudiante</button>
         </div>
       </div>
       <label class="cons-label">Tu nombre</label>
       <input class="cons-inp" id="c-nombre" placeholder="Nombre y apellido">
       <div class="cons-row">
         <div><label class="cons-label">Ubicación</label><input class="cons-inp" id="c-ubic" placeholder="Ciudad, país"></div>
         <div><label class="cons-label">Rol / ocupación</label><input class="cons-inp" id="c-rol" placeholder="A qué te dedicás"></div>
       </div>
       <label class="cons-label">Cómo hablás y escribís</label>
       <textarea class="cons-ta" id="c-estilo" placeholder="Ej: informal, directo, rioplatense con voseo, humor seco. Tu MIRROR va a imitar esto."></textarea>
       <label class="cons-label">Algo más sobre vos (opcional)</label>
       <textarea class="cons-ta" id="c-proyectos" placeholder="Tus proyectos, lo que te importa, en qué andás."></textarea>
       <!-- v38-roles (H1.bis): la constancia va ACÁ, en el último paso, cuando la persona ya
            vio a dónde apuntan sus direcciones y antes de que su MIRROR exista. No es un
            trámite: es el momento en que queda claro que la elección —y la responsabilidad
            sobre lo que cargue— es suya. Se guarda la fecha y la versión del texto. -->
       <div style="margin:18px 0 4px;padding:13px 15px;border-radius:10px;background:rgba(255,180,0,0.06);border:1px solid rgba(255,180,0,0.26);font-size:12px;color:#ffd9a0;line-height:1.6;">
         <b>Antes de darle vida, lo importante en cinco líneas:</b><br>
         · Tu memoria va a <b>tu base</b> y tus mensajes salen por <b>tu proxy</b>: los elegiste vos, y lo que esos servicios hagan se rige por sus términos.<br>
         · <b>Acá no hay servidor nuestro.</b> Nadie ve, guarda ni puede recuperar lo que cargues — ni siquiera para ayudarte.<br>
         · Si vas a cargar datos de otras personas, <b>el responsable de esos datos sos vos</b>.<br>
         · <b>Una base por persona:</b> compartir tu MIRROR por link NO entrega tu base (viaja solo la vitrina). Si querés que otros tengan el suyo, que cada uno cree su base.<br>
         · Es software libre <b>sin garantías</b>, no es asesoramiento profesional y no es un servicio de emergencia.<br>
         · Es una IA: <b>se equivoca</b>. Verificá lo que importe.
         <label style="display:flex;gap:9px;align-items:flex-start;margin-top:11px;cursor:pointer;color:#ffe9c2;">
           <input type="checkbox" id="c-roles-ok" style="margin-top:3px;flex-shrink:0;">
           <span>Lo leí y lo entiendo: <b>yo elijo dónde van mis datos y respondo por lo que cargue</b>. <a onclick="abrirLegal()" style="color:#9aa0ff;cursor:pointer;text-decoration:underline;">Ver el detalle completo</a></span>
         </label>
       </div>
       <div class="cons-nav"><button class="cons-btn sec" onclick="consGo(4)">◂ Atrás</button><button class="cons-btn prim" onclick="consFinish()">Dar vida a mi MIRROR ✦</button></div>
     </div>

     <div class="cons-step" data-step="6">
       <div class="cons-ok">✦</div>
       <div class="cons-h" style="text-align:center;">Tu MIRROR <em>respira</em>.</div>
       <div class="cons-p" style="text-align:center;">Ya es tuyo, único, irrepetible. Lo podés ajustar cuando quieras desde el modo de conexiones. El origen está; el espejo, ahora, es tuyo.</div>
       <div class="cons-nav"><button class="cons-btn prim" onclick="consEnter()">Entrar a mi MIRROR ▸</button></div>
       <div class="cons-foot">MIRROR «El Origen» · una idea original de Darío Alejandro Tello<br>construido para que cada persona tenga el suyo<br><a onclick="abrirLegal()" style="color:#9aa0ff;cursor:pointer;text-decoration:underline;">🔒 Privacidad y licencia</a></div>
     </div>
   </div>`;
  document.body.appendChild(ov);

  // Cielo de estrellas (fachada del constructor)
  (function stars(){
    const cv = document.getElementById('cons-stars');
    function draw(){
      const w = cv.width = innerWidth, h = cv.height = innerHeight;
      const ctx = cv.getContext('2d'); ctx.clearRect(0,0,w,h);
      for (let i=0;i<90;i++){
        const x=Math.random()*w, y=Math.random()*h, r=Math.random()*1.3;
        ctx.globalAlpha=Math.random()*0.6+0.1; ctx.fillStyle='#bcbcff';
        ctx.beginPath(); ctx.arc(x,y,r,0,7); ctx.fill();
      }
    }
    draw(); addEventListener('resize',()=>{ if(document.getElementById('cons-ov').classList.contains('show')) draw(); });
  })();

  const prog = document.getElementById('cons-prog');
  for (let i=0;i<7;i++){ prog.appendChild(document.createElement('span')); }

  let motorSel = 'groq';
  /* v39-consmodelo (24/09/2026) — HALLAZGO DE DARÍO: «no me deja elegir qwen3.8 por más que lo
     seleccione». renderMotores() rearma las <option> cada vez que se entra al paso 2 (y al tocar
     una tarjeta de motor) y NUNCA volvía a marcar la elegida: siempre quedaba la primera. Y
     prefill() tampoco traía el modelo guardado. Resultado: al volver al paso o al reabrir el
     constructor para ajustar, veías gpt-oss-120b y, si guardabas, te lo pisaba. Acá se recuerda
     la elección (por motor) y, si no hubo, se muestra la que ya tenías guardada. */
  let modeloSelCons = null;
  let capState = Object.assign({}, CONFIG_DEFAULT.cap);
  let cebState = { on:false, vars:{ energia:true, sintonia:true, claridad:true, carga:true } }; // v52-cebolla
  let colorSel = 'violeta';

  // Aplica el color del propio constructor en vivo (preview).
  function pintarConstructor(){
    const t = TEMAS_COLOR[colorSel] || TEMAS_COLOR.violeta;
    document.getElementById('cons-ov').style.setProperty('--cons-accent', t.accent);
    document.getElementById('cons-ov').style.setProperty('--cons-accent-glow', t.glow);
  }

  window.consGo = function(n){
    document.querySelectorAll('.cons-step').forEach(el=>el.classList.remove('show'));
    const step = document.querySelector('.cons-step[data-step="'+n+'"]');
    if(step) step.classList.add('show');
    prog.querySelectorAll('span').forEach((s,i)=>s.classList.toggle('on', i<=n));
    document.getElementById('cons-ov').scrollTop = 0;
    if(n===2) renderMotores();
    if(n===3){ renderToggles(); renderCaracter(); renderColors(); renderCebolla(); } // v52-cebolla // v35-car
  };

  // ── COSTO HONESTO POR MOTOR (sin números que caduquen: modelo de costo + link al pricing real) ──
  const PRICING = {
    groq:       { free:true,  txt:'✓ Gratis, sin tarjeta. Alcanza de sobra para volar.' },
    /* v41-cerebras (23/08/2026) — LA TARJETA SE CONTRADECÍA A SÍ MISMA (hallazgo de Darío en
       vivo). Arriba la descripción decía «Gratis hasta el 17/08/2026; desde esa fecha exige
       tarjeta», y acá abajo, en la misma tarjeta, seguía el sello verde «✓ Gratis, sin
       tarjeta». Quien elige un motor mira el sello, no el párrafo: se estaba eligiendo un
       motor «gratis» que pide tarjeta. Groq NO se toca — ese sí sigue gratis y sin tarjeta. */
    cerebras:   { free:false, txt:'💳 Ya no es gratis: desde el 17/08/2026 pide tarjeta para darte US$5 de crédito; agotados, pagás por uso. El respaldo gratis hoy es Cloudflare (ver abajo). ', url:'https://www.cerebras.ai/pricing' },
    openai:     { free:false, txt:'💳 Pagás por uso, sin abono mensual. ', url:'https://openai.com/api/pricing/' },
    openrouter: { free:false, txt:'💳 Pagás por uso/crédito, sin abono. Una sola clave → cientos de modelos (Claude, GPT-4o…). ', url:'https://openrouter.ai/models' },
    deepseek:   { free:false, txt:'💳 Pagás por uso, muy económico. ', url:'https://api-docs.deepseek.com/quick_start/pricing' },
    together:   { free:false, txt:'💳 Pagás por uso, sin abono. ', url:'https://www.together.ai/pricing' },
    mistral:    { free:false, txt:'💳 Pagás por uso, sin abono. ', url:'https://mistral.ai/pricing' }
  };
  function costoLinea(k){
    const p = PRICING[k]; if(!p) return '';
    const link = p.url ? '<a href="'+p.url+'" target="_blank" rel="noopener">ver precios actuales ↗</a>' : '';
    return '<div class="mcost'+(p.free?' free':'')+'">'+p.txt+link+'</div>';
  }
  function renderMotores(){
    const cont = document.getElementById('cons-motores'); cont.innerHTML='';
    Object.keys(MOTORES).forEach(k=>{
      const m = MOTORES[k];
      const card = document.createElement('div');
      card.className = 'cons-mcard' + (k===motorSel?' sel':'');
      card.onclick = ()=>{ motorSel=k; renderMotores(); };
      /* v41-cerebras: tres estados, no dos. «Premium» no describe a Cerebras (te regala US$5)
         y «Gratis» es directamente falso. El sello dice lo único que importa antes de elegir:
         si te va a pedir la tarjeta o no. */
      const _sello = m.tipo==='gratuito' ? 'Gratis' : (m.tipo==='tarjeta' ? 'Pide tarjeta' : 'Premium');
      card.innerHTML = '<div class="mt">'+m.nombre+'<span class="badge '+(m.tipo==='gratuito'?'free':'prem')+'">'+
        _sello+'</span></div><div class="md">'+m.desc+'</div>'+costoLinea(k);
      cont.appendChild(card);
    });
    const sel = document.getElementById('c-modelo'); sel.innerHTML='';
    const _lista = MOTORES[motorSel].modelos || [];
    _lista.forEach(md=>{ const o=document.createElement('option'); o.value=md; o.textContent=md; sel.appendChild(o); });
    // v39-consmodelo: vuelve a marcar la elegida (ver arriba, junto a motorSel)
    const _pref = (modeloSelCons && modeloSelCons.motor===motorSel && _lista.indexOf(modeloSelCons.id)>=0) ? modeloSelCons.id
                : ((CONFIG.motorPrincipal===motorSel && _lista.indexOf(CONFIG.modeloPrincipal)>=0) ? CONFIG.modeloPrincipal : _lista[0]);
    if (_pref) sel.value = _pref;
    sel.onchange = function(){ modeloSelCons = { motor: motorSel, id: sel.value }; };
    const secret = motorSel.toUpperCase()+'_KEY';
    const esPago = MOTORES[motorSel].tipo!=='gratuito';
    document.getElementById('c-motor-clave').innerHTML =
      '<b>1) ¿Cómo saco la clave?</b> '+MOTORES[motorSel].comoClave +
      (esPago ? ' <span style="color:#ffd9a0;">Es de pago por uso: cargá un crédito en el proveedor.</span>' : '') +
      '<br><b>2) ¿Dónde la pongo?</b> En TU proxy, como secreto <code style="color:#ffd9a0;">'+secret+'</code> '+
      '(Cloudflare → tu Worker → <b>Settings → Variables and Secrets → Add</b> → nombre <code style="color:#ffd9a0;">'+secret+'</code>, valor = tu clave → <b>Deploy</b>). '+
      'La clave NUNCA va en MIRROR: queda blindada dentro del proxy.';
  }

  const CAPS_INFO = [
    { k:'sonido',    t:'Música ambiental',    d:'La banda sonora original «El Origen» mientras usás tu MIRROR.' },
    { k:'voz',       t:'Lectura en voz alta',  d:'Tu MIRROR te lee las respuestas en voz alta. Elegís la voz.' },
    { k:'microfono', t:'Dictado por voz',      d:'Hablale a tu MIRROR en vez de escribir. Usa el micrófono.' },
    { k:'web',       t:'Búsqueda en la web',   d:'Tu MIRROR puede buscar información actual en internet (requiere clave Tavily).' },
    { k:'audio',     t:'Memoria de audio',     d:'Subí un audio (o un video) y tu MIRROR transcribe lo que se dice y lo recuerda. Gratis, con Whisper de Groq.' },
    { k:'fachada',   t:'Fachada cinematográfica', d:'La cinemática de nacimiento, el monolito y el modo presentación.' },
    { k:'devolver',  t:'Te devuelve a tu vida',  d:'En charlas largas, tu MIRROR cierra con una acción concreta hacia afuera en vez de retenerte. Toda IA del mercado se diseña para engancharte; el tuyo se diseña para devolverte a tu vida.' }, // v35-vida (Etapa 5)
    { k:'actua',     t:'Tu MIRROR actúa',       d:'Manos propias: por chat o por voz prende y apaga la música o la lectura, abre su memoria, y arma tarjetas de UN toque para llamar, mandar WhatsApp, poner música o agendar. Nunca ejecuta nada hacia afuera sin tu toque final; los números salen solo de tu agenda local (tu dispositivo) y jamás se inventan.' }, // v36-actua (Etapa 3 C2)
    { k:'analista',  t:'Analista de datos',     d:'Subí o pegá un CSV y tu MIRROR lo analiza EN TU DISPOSITIVO: estadística, frecuencias, correlaciones y gráficos. La matemática la calcula la app — el modelo solo interpreta; tus filas crudas jamás viajan a la nube.' }, // v36-analista (Etapa 11 C2)
    { k:'encuesta',  t:'Encuestas propias',     d:'Creá formularios sin Google Forms: archivos autocontenidos cuyas respuestas caen en TU Firebase. Las ves, exportás CSV y las analizás con el analista — soberanía de datos de punta a punta.' }, // v36-encuesta (Etapa 12 C2)
    { k:'redactor',  t:'Redactor de respuestas', d:'Pegale un mail o WhatsApp recibido y tu MIRROR redacta la respuesta EN TU VOZ, usando tu perfil y tu memoria. Te la entrega en una tarjeta de UN toque: leés, tocás y sale. Nunca envía solo — y tu bandeja de entrada no la lee (te lo decimos de frente).' }, // v36-redactor (Etapa 13 C2)
  ];
  function renderToggles(){
    const cont = document.getElementById('cons-toggles'); cont.innerHTML='';
    CAPS_INFO.forEach(c=>{
      const row = document.createElement('div'); row.className='cons-tog';
      row.innerHTML = '<div><div class="tl">'+c.t+'</div><div class="td">'+c.d+'</div></div>'+
        '<div class="cons-sw'+(capState[c.k]?' on':'')+'" data-k="'+c.k+'"></div>';
      row.querySelector('.cons-sw').onclick = function(){ capState[c.k]=!capState[c.k]; this.classList.toggle('on', capState[c.k]); };
      cont.appendChild(row);
    });
  }
  // v52-cebolla: control del dueño — encender el panel estado y elegir sus dimensiones.
  function renderCebolla(){
    const cont = document.getElementById('cons-cebolla'); if(!cont) return; cont.innerHTML='';
    const head = document.createElement('div'); head.className='cons-tog';
    head.innerHTML = '<div><div class="tl">🧅 Panel estado (la «cebolla»)</div><div class="td">Un estado interno en NÚMEROS que ajusta el tono y vive en el dispositivo. No son sentimientos — se ven y se ponen en cero.</div></div>'+'<div class="cons-sw'+(cebState.on?' on':'')+'"></div>';
    head.querySelector('.cons-sw').onclick = function(){ cebState.on=!cebState.on; this.classList.toggle('on', cebState.on); };
    cont.appendChild(head);
    (typeof CEB_VARS!=='undefined'?CEB_VARS:[]).forEach(function(V){
      const row = document.createElement('div'); row.className='cons-tog';
      const dorm = V.cableada ? '' : ' <span style="opacity:0.6">(sin estímulos aún)</span>';
      row.innerHTML = '<div><div class="tl">'+V.n+dorm+'</div><div class="td">'+V.q+'</div></div>'+'<div class="cons-sw'+(cebState.vars[V.k]?' on':'')+'"></div>';
      row.querySelector('.cons-sw').onclick = function(){ cebState.vars[V.k]=!cebState.vars[V.k]; this.classList.toggle('on', cebState.vars[V.k]); };
      cont.appendChild(row);
    });
  }
  // v35-car (Etapa 5B): perillas de carácter — el usuario esculpe CÓMO le habla su MIRROR.
  const CAR_INFO = [
    { k:'franqueza', t:'Franqueza', lo:'diplomático', hi:'sin anestesia' },
    { k:'humor',     t:'Humor',     lo:'sobrio',      hi:'socarrón' },
    { k:'desafio',   t:'Desafío',   lo:'acompaña',    hi:'confronta' }
  ];
  let carState = Object.assign({}, CONFIG_DEFAULT.caracter);
  function renderCaracter(){
    const cont = document.getElementById('cons-caracter'); if(!cont) return; cont.innerHTML='';
    CAR_INFO.forEach(c=>{
      const row = document.createElement('div'); row.className='cons-car';
      row.innerHTML = '<div class="cons-car-top"><span class="tl">'+c.t+'</span><span class="cons-car-val" id="car-val-'+c.k+'">'+(carState[c.k]??50)+'</span></div>'+
        '<input type="range" min="0" max="100" value="'+(carState[c.k]??50)+'" class="cons-range" data-k="'+c.k+'">'+
        '<div class="cons-car-ends"><span>'+c.lo+'</span><span>'+c.hi+'</span></div>';
      row.querySelector('input').oninput = function(){ carState[c.k]=parseInt(this.value,10)||0; const v=document.getElementById('car-val-'+c.k); if(v) v.textContent=this.value; };
      cont.appendChild(row);
    });
  }
  function renderColors(){
    const cont = document.getElementById('cons-colors'); cont.innerHTML='';
    Object.keys(TEMAS_COLOR).forEach(k=>{
      const c = document.createElement('div');
      c.className='cons-color'+(k===colorSel?' sel':'');
      c.style.background = TEMAS_COLOR[k].accent; c.style.color = TEMAS_COLOR[k].accent;
      c.title = k;
      c.onclick = ()=>{ colorSel=k; pintarConstructor(); renderColors(); };
      cont.appendChild(c);
    });
  }

  window.consSkip = function(){ document.getElementById('cons-ov').classList.remove('show'); try{ sessionStorage.setItem('mirror_sesion_entro','1'); }catch(_){} }; // v39-consvisit

  window.consFinish = async function(){ // v37-sec (V36-1c): async porque el PIN se hashea
    const v = id => (document.getElementById(id).value||'').trim();
    /* v38-roles (H1.bis): sin la constancia no se sigue. No es burocracia — es el único
       momento en que la persona ve, junta, la decisión que está tomando: sus datos, su base,
       su responsabilidad. Se guarda CUÁNDO lo aceptó y QUÉ versión del texto leyó; si mañana
       el texto cambia, se sabe cuál firmó. Si el campo no existiera (constructor viejo o DOM
       incompleto), NO se traba el flujo: se registra que no hubo constancia y sigue. */
    try {
      const chk = document.getElementById('c-roles-ok');
      if (chk && !chk.checked){
        alert('Falta una sola cosa: marcar que entendés que vos elegís dónde van tus datos y respondés por lo que cargues.\n\nEstá al pie de este paso. Si querés leer el detalle, tocá «Ver el detalle completo».');
        try{ chk.scrollIntoView({behavior:'smooth',block:'center'}); }catch(e){}
        return;
      }
      CONFIG.roles = chk ? { aceptado:new Date().toISOString(), version:'1', texto:'roles-y-limites-v1' }
                         : { aceptado:'', version:'1', texto:'sin-constancia' };
    } catch(e){ try{ regError('roles:constancia',e) }catch(_){} }
    CONFIG.appName = v('c-appName') || 'MIRROR';
    CONFIG.modos = { mirror:v('c-m-mirror')||'MIRROR', tars:v('c-m-tars')||'ANALISTA', jurado:v('c-m-jurado')||'EXAMINADOR', conn:v('c-m-conn')||'CONEX' };
    CONFIG.motorPrincipal = motorSel;
    CONFIG.modeloPrincipal = document.getElementById('c-modelo').value;
    if (motorSel==='groq'){ CONFIG.motorRespaldo='cerebras'; CONFIG.modeloRespaldo='gpt-oss-120b'; }
    else if (motorSel==='cerebras'){ CONFIG.motorRespaldo='groq'; CONFIG.modeloRespaldo='openai/gpt-oss-120b'; } // v38-motor · v39-qwen38: qwen3.6 retirado 14/09 → gpt-oss-120b (producción)
    else { CONFIG.motorRespaldo=''; CONFIG.modeloRespaldo=''; }
    CONFIG.cap = Object.assign({}, capState);
    CONFIG.cebolla = { on: !!cebState.on, vars: Object.keys(cebState.vars).filter(function(k){ return cebState.vars[k]; }) }; // v52-cebolla
    CONFIG.caracter = Object.assign({}, carState); // v35-car
    CONFIG.colorTema = colorSel;
    // v41-barra: se guarda SIN barra final — las rutas se arman concatenando y «…dev//groq»
    // no matchea el pathname que compara el Worker. Se limpia acá, no solo al leer, para que
    // lo que quede guardado sea lo correcto y no haya que arreglarlo en cada lectura.
    CONFIG.proxyUrl = proxyLimpio(v('c-proxy')); CONFIG.fbUrl = v('c-fb');
    CONFIG.paisCod = v('c-pais').replace(/[^\d]/g,''); // v37-tel (A1)
    // v37-sec (V36-1c): del campo PIN sale una HUELLA, nunca el PIN.
    // Campo vacío = "no lo cambio": se conserva la huella que ya estaba guardada.
    {
      const _pin = v('c-pin');
      if (_pin) {
        try { CONFIG.pinMemH = await pinHash(_pin); }
        catch(e) { alert('No pude asegurar tu PIN en este navegador (hace falta HTTPS). El PIN anterior sigue vigente.'); }
      }
      CONFIG.pinMem = ''; // el PIN en claro no se guarda nunca más
    }
    CONFIG.perfil = { nombre:v('c-nombre'), ubicacion:v('c-ubic'), rol:v('c-rol'), filosofia:'', caracter:'', paz:'', proyectos:v('c-proyectos'), estilo:v('c-estilo') };
    CONFIG.idioma = (window.i18nSel==='en'||window.i18nSel==='pt'||window.i18nSel==='es') ? window.i18nSel : (CONFIG.idioma||'es'); // v36-i18n (Etapa 13B)
    CONFIG.configurado = true;
    guardarConfig(CONFIG);
    aplicarConfigVars(); aplicarNombresUI(); aplicarCapacidades();
    // Que el MIRROR viaje entre dispositivos: subimos la config a la Firebase del usuario.
    if (typeof configSubirAFirebase === 'function' && CONFIG.fbUrl) configSubirAFirebase(CONFIG.fbUrl, CONFIG);
    consGo(6);
  };

  window.consEnter = function(){ document.getElementById('cons-ov').classList.remove('show'); try{ sessionStorage.setItem('mirror_sesion_entro','1'); }catch(_){} }; // v39-consvisit: recargar en la MISMA pestaña ya no vuelve a mostrar la puerta

  /* v40-marca (23/10/2026, auditor 4): con otra marca («LUMEN», «MANIFIESTOS») seguían a la vista textos fijos con «MIRROR»:
     «Todo lo que tu MIRROR recuerda», «Compartí tu MIRROR», «Tu MIRROR puede generar imágenes», la pestaña del navegador…
     Se cambia el nombre en los textos y títulos de la app que ve el usuario final. Quedan como están, a propósito: los
     créditos («idea de Darío A. Tello»), el constructor, la guía y lo legal (son de la plataforma), y la charla. */
  window.marcaBlanca = function(app){
    const FUERA = '#cons-ov, #guia-ov, #legal-ov, #premium-ov, #gmail-ov, .fcredit, #chat, script, style, textarea, pre, code, #sv-cta';
    const _vieja = window._marcaActual || 'MIRROR';
    const _esc = function(x){ return String(x).replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&'); };
    const re = new RegExp('\\b(?:MIRROR' + (_vieja !== 'MIRROR' ? '|' + _esc(_vieja) : '') + ')\\b', 'g'); // verificador 23/10: si cambiás la marca sin recargar, también se reemplaza la anterior
    window._marcaActual = app;
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    const cambiar = [];
    while (w.nextNode()){ const n = w.currentNode; if (re.test(n.nodeValue) && !(n.parentElement && n.parentElement.closest(FUERA))) cambiar.push(n); re.lastIndex = 0; }
    cambiar.forEach(function(n){ n.nodeValue = n.nodeValue.replace(re, app); });
    document.querySelectorAll('[title]').forEach(function(el){ const t = el.getAttribute('title'); re.lastIndex = 0; if (t && re.test(t) && !el.closest(FUERA)){ re.lastIndex = 0; el.setAttribute('title', t.replace(re, app)); } });
    try { if (/\bMIRROR\b/.test(document.title)) document.title = document.title.replace(/^MIRROR\b/, app); } catch(_){}
  };
  window.aplicarNombresUI = function(){
    try {
      const M = Object.assign({}, CONFIG_DEFAULT.modos, CONFIG.modos || {}); // v40-modos-incompletos: lo que falte toma el nombre de fábrica
      const set=(id,txt)=>{ const e=document.getElementById(id); if(e) e.textContent=txt; };
      set('btn-mirror', M.mirror); set('btn-tars', M.tars);
      set('btn-jurado', '⚖ '+M.jurado); set('btn-conn', '⬡ '+M.conn);
      /* v40-saludo (3/10, captura de Darío con la 03.2): al abrir, la pestaña decía «ATIS» pero el encabezado «MIRROR activo» y el
         saludo «Hola. Soy MIRROR.» — y la entidad se llama «MANIFIESTOS». Ahora el arranque usa los nombres de la instalación. */
      if (typeof mode === 'undefined' || mode === 'mirror'){
        set('hstatus', (M.mirror || 'MIRROR') + ' activo');
        if (CONFIG.configurado && M.mirror && M.mirror !== 'MIRROR') set('htitle', M.mirror);
      }
      const _app = String(CONFIG.appName || '').trim();
      try { if (_app && (_app !== 'MIRROR' || (window._marcaActual && window._marcaActual !== 'MIRROR'))) marcaBlanca(_app || 'MIRROR'); } catch(_){}
      const _sal = document.querySelector('#chat .msg .bubble');
      if (_app && _app !== 'MIRROR' && _sal && /^\s*Hola\. Soy MIRROR\./.test(_sal.textContent || '')){
        _sal.textContent = '';
        _sal.appendChild(document.createTextNode('Hola. Soy ' + _app + '.'));
        _sal.appendChild(document.createElement('br'));
        _sal.appendChild(document.createTextNode('Preguntame lo que quieras.'));
      }
    } catch(e){}
  };

  function prefill(){
    if(!CONFIG.configurado) return;
    const set=(id,val)=>{ const e=document.getElementById(id); if(e) e.value=val||''; };
    set('c-appName',CONFIG.appName);
    set('c-m-mirror',CONFIG.modos.mirror); set('c-m-tars',CONFIG.modos.tars);
    set('c-m-jurado',CONFIG.modos.jurado); set('c-m-conn',CONFIG.modos.conn);
    motorSel = CONFIG.motorPrincipal||'groq';
    capState = Object.assign({}, CONFIG_DEFAULT.cap, CONFIG.cap||{});
    carState = Object.assign({}, CONFIG_DEFAULT.caracter, CONFIG.caracter||{}); // v35-car
    { const cc = CONFIG.cebolla || {}; const vs = Array.isArray(cc.vars)?cc.vars:['energia','sintonia','claridad','carga']; cebState={on:!!cc.on,vars:{}}; vs.forEach(function(k){ cebState.vars[k]=true; }); } // v52-cebolla
    colorSel = CONFIG.colorTema||'violeta';
    set('c-proxy',CONFIG.proxyUrl); set('c-fb',CONFIG.fbUrl);
    // v38-roles (H1.bis): si ya dio la constancia, no se le vuelve a exigir en cada ajuste
    // — pero si la destilda, se respeta: la puede retirar cuando quiera.
    try{ const chk=document.getElementById('c-roles-ok'); if(chk) chk.checked = !!(CONFIG.roles && CONFIG.roles.aceptado); }catch(e){}
    set('c-pais',CONFIG.paisCod); // v37-tel (A1)
    // v37-sec (V36-1c): el PIN ya no se puede volver a mostrar — de él solo queda
    // la huella. El campo va vacío y el texto de ayuda avisa qué significa.
    set('c-pin','');
    try {
      const _cp = document.getElementById('c-pin');
      if (_cp) _cp.placeholder = (CONFIG.pinMemH || CONFIG.pinMem)
        ? 'ya tenés uno guardado — escribí acá solo si querés cambiarlo'
        : 'un PIN tuyo';
    } catch(e) {}
    const p=CONFIG.perfil||{};
    set('c-nombre',p.nombre); set('c-ubic',p.ubicacion); set('c-rol',p.rol);
    set('c-estilo',p.estilo); set('c-proyectos',p.proyectos);
  }

  window.abrirConstructor = function(){
    prefill(); pintarConstructor();
    document.getElementById('cons-ov').classList.add('show');
    consGo(CONFIG.configurado ? 1 : 0);
  };

  // ── v21 — PLANTILLAS POR OFICIO: punto de partida del perfil según el rubro (editable) ──
  const PLANTILLAS_OFICIO = {
    docente:     { rol:'Docente', estilo:'Cercano y claro. Explico con ejemplos cotidianos, tengo paciencia pero pongo límites. Lenguaje sencillo, sin tecnicismos de más.', algo:'Mis clases, la preparación de material, el seguimiento de mis estudiantes y las cuestiones de la escuela.' },
    emprendedor: { rol:'Emprendedor/a — llevo mi propio negocio', estilo:'Directo y resolutivo. Voy al grano, orientado a la acción. Cordial con clientes, firme en lo importante.', algo:'Mi negocio, la atención a clientes, las ventas, los proveedores y hacer crecer el proyecto.' },
    musico:      { rol:'Músico/a', estilo:'Expresivo y sensible, relajado. Hablo con calidez, me sale natural lo creativo. Informal pero cuidando lo que digo.', algo:'Mi música, los ensayos y shows, las composiciones y la difusión de lo que hago.' },
    creativo:    { rol:'Escritor/a · Creativo/a', estilo:'Cuido las palabras, busco la imagen justa. Tono reflexivo, a veces con humor, siempre con voz propia.', algo:'Mis textos y proyectos creativos, las ideas en las que ando, los plazos y la difusión.' },
    salud:       { rol:'Profesional de la salud', estilo:'Cálido pero preciso. Transmito calma y confianza, claro sin asustar. Nunca improviso un dato médico.', algo:'Mi consulta, el seguimiento de pacientes, los turnos y la coordinación con colegas.' },
    oficina:     { rol:'Profesional / trabajo de oficina', estilo:'Cordial y profesional, claro y ordenado. Formal cuando hace falta, cercano en el día a día. Concreto en los mails.', algo:'Mi trabajo, los proyectos y plazos, la coordinación con el equipo y los clientes.' },
    estudiante:  { rol:'Estudiante', estilo:'Informal y curioso, con ganas. Hablo relajado, pregunto cuando no sé. Directo y sin vueltas.', algo:'Mis materias y exámenes, los trabajos prácticos, los grupos de estudio y la organización del tiempo.' }
  };
  window.aplicarOficio = function(clave, btn){
    const o = PLANTILLAS_OFICIO[clave]; if(!o) return;
    const rol=document.getElementById('c-rol'); if(rol) rol.value=o.rol;
    const est=document.getElementById('c-estilo'); if(est) est.value=o.estilo;
    const alg=document.getElementById('c-proyectos'); if(alg && !alg.value.trim()) alg.value=o.algo; // "algo más" solo si está vacío
    document.querySelectorAll('.oficio-chip').forEach(c=>c.classList.remove('on'));
    if(btn) btn.classList.add('on');
  };
  // ════ v22 · PALANCA D — COMPARTIR POR LINK DE SOLO LECTURA ════
  // Base64-URL UTF-8-safe (entra en un hash, no viaja al servidor).
  function _b64urlEnc(s){ return btoa(unescape(encodeURIComponent(s))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
  function _b64urlDec(s){ s=s.replace(/-/g,'+').replace(/_/g,'/'); while(s.length%4) s+='='; return decodeURIComponent(escape(atob(s))); }
  // WHITELIST EXPLÍCITA: SOLO la carta de presentación pública. NUNCA proxy, firebase, PIN, claves ni ubicación.
  function _payloadCompartir(){
    const p = CONFIG.perfil || {};
    const M = Object.assign({}, CONFIG_DEFAULT.modos, CONFIG.modos || {}); // v40-modos-incompletos: lo que falte toma el nombre de fábrica
    return { v:1, n: CONFIG.appName || 'MIRROR',
      m:{ mi:M.mirror, ta:M.tars, ju:M.jurado, co:M.conn },
      c: CONFIG.colorTema || 'violeta',
      p:{ no:(p.nombre||''), ro:(p.rol||''), es:(p.estilo||''), al:(p.proyectos||'') } };
  }
  function _linkCompartir(){
    return location.origin + location.pathname + '#m=' + _b64urlEnc(JSON.stringify(_payloadCompartir()));
  }
  window.leerPayloadCompartido = function(){
    try {
      const m = (location.hash||'').match(/^#m=(.+)$/);
      if(!m) return null;
      const o = JSON.parse(_b64urlDec(m[1]));
      if(!o || o.v!==1 || typeof o.n!=='string') return null;
      return o;
    } catch(e){ return null; }
  };
  window.mostrarVistaCompartida = function(pay){
    try {
      const v = document.getElementById('share-view'); if(!v) return;
      const t = (typeof TEMAS_COLOR!=='undefined' && TEMAS_COLOR[pay.c]) ? TEMAS_COLOR[pay.c] : {accent:'#7070ff',glow:'rgba(100,100,255,0.18)'};
      v.style.setProperty('--sv-accent', t.accent);
      v.style.setProperty('--sv-glow', t.glow);
      document.getElementById('sv-name').textContent = pay.n || 'MIRROR';
      const p = pay.p || {};
      const fila=(rowId,valId,txt)=>{ const r=document.getElementById(rowId),e=document.getElementById(valId); if(e) e.textContent=txt||''; if(r) r.style.display = (txt&&txt.trim())?'':'none'; };
      const owner=document.getElementById('sv-owner');
      const _no = (typeof p.no === 'string') ? p.no : ''; // v40-1023 (auditor 2): un «no» que no es texto rompía la vista
      if(owner){ if(_no.trim()){ owner.textContent=(String(pay.n||'').trim() || 'MIRROR')+' de '+_no; owner.style.display=''; } else owner.style.display='none'; }
      fila('sv-row-rol','sv-rol', p.ro);
      fila('sv-row-estilo','sv-estilo', p.es);
      fila('sv-row-algo','sv-algo', p.al);
      v.style.display='flex';
    } catch(e){}
  };
  window.abrirCompartir = function(){
    if(!CONFIG.configurado){ alert('Primero armá tu MIRROR en el constructor. Después vas a poder compartirlo.'); return; }
    const inp=document.getElementById('share-link'); if(inp) inp.value=_linkCompartir();
    const an=document.getElementById('share-appname'); if(an) an.textContent=CONFIG.appName||'MIRROR';
    const nat=document.getElementById('share-native'); if(nat) nat.style.display = (navigator.share)?'inline-flex':'none';
    const msg=document.getElementById('share-msg'); if(msg) msg.textContent='';
    const g=document.getElementById('share-ov'); if(g){ g.style.display='block'; g.scrollTop=0; }
  };
  window.cerrarCompartir = function(){ const g=document.getElementById('share-ov'); if(g) g.style.display='none'; };
  window.copiarLinkCompartir = function(){
    const inp=document.getElementById('share-link'), msg=document.getElementById('share-msg'); if(!inp) return;
    const ok=()=>{ if(msg) msg.textContent='✅ Link copiado. Pegalo donde quieras.'; };
    const txt=inp.value;
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(txt).then(ok).catch(function(){ try{ inp.select(); document.execCommand('copy'); ok(); }catch(e){} });
    } else { try{ inp.select(); document.execCommand('copy'); ok(); }catch(e){} }
  };
  window.compartirNativo = function(){
    const inp=document.getElementById('share-link'); if(!inp) return;
    if(navigator.share){ navigator.share({ title:(CONFIG.appName||'MIRROR'), text:'Te presento mi MIRROR:', url:inp.value }).catch(function(){}); }
  };
  /* v40-1023 (auditor 2): la vista previa tapaba todo y su único botón recargaba la página (sin Firebase se perdía la charla).
     Ahora en la vista previa el botón es «◂ volver» (y Esc también vuelve). */
  window.previsualizarCompartir = function(){ if(typeof window.mostrarVistaCompartida==='function'){ window.mostrarVistaCompartida(_payloadCompartir()); window._vistaPrevia = true; const c=document.getElementById('sv-cta'), b=document.getElementById('sv-volver'); if(c) c.style.display='none'; if(b){ b.style.display=''; try{ b.focus(); }catch(_){} } } };
  window.cerrarVistaPrevia = function(){ const v=document.getElementById('share-view'); if(v) v.style.display='none'; window._vistaPrevia=false; const c=document.getElementById('sv-cta'), b=document.getElementById('sv-volver'); if(c) c.style.display=''; if(b) b.style.display='none'; };
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape' && window._vistaPrevia){ e.preventDefault(); window.cerrarVistaPrevia(); } }, true);

  window.abrirGuia = function(){ var g=document.getElementById('guia-ov'); if(g){ g.style.display='block'; g.scrollTop=0; } };
  window.cerrarGuia = function(){ var g=document.getElementById('guia-ov'); if(g) g.style.display='none'; };
  window.abrirLegal = function(){ var g=document.getElementById('legal-ov'); if(g){ g.style.display='block'; g.scrollTop=0; } };
  window.cerrarLegal = function(){ var g=document.getElementById('legal-ov'); if(g) g.style.display='none'; };
  window.abrirPremium = function(){ var g=document.getElementById('premium-ov'); if(g){ g.style.display='block'; g.scrollTop=0; } };
  window.cerrarPremium = function(){ var g=document.getElementById('premium-ov'); if(g) g.style.display='none'; };
  window.abrirGmail = function(){ var g=document.getElementById('gmail-ov'); if(g){ g.style.display='block'; g.scrollTop=0; } };
  window.cerrarGmail = function(){ var g=document.getElementById('gmail-ov'); if(g) g.style.display='none'; };
  window.generarScriptGmail = function(){
    var pre=document.getElementById('gmail-code'); if(!pre) return;
    var code=pre.textContent;
    try {
      if (CONFIG && CONFIG.proxyUrl) code=code.replace('https://TU-PROXY.TU-SUBDOMINIO.workers.dev', CONFIG.proxyUrl); // v40-1023 (auditor 4): sin el subdominio del autor
      var ruta=(typeof MOTORES!=='undefined' && MOTORES[CONFIG.motorPrincipal]) ? MOTORES[CONFIG.motorPrincipal].ruta : 'groq';
      code=code.replace("RUTA:      'groq'", "RUTA:      '"+ruta+"'");
      if (CONFIG && CONFIG.modeloPrincipal) code=code.replace("'openai/gpt-oss-120b'", "'"+CONFIG.modeloPrincipal+"'"); // v38-motor: tiene que coincidir con el literal del snippet de arriba
      var perfil=(typeof construirPerfilNucleo==='function') ? construirPerfilNucleo() : '';
      if (perfil) code=code.replace("'Describí acá quién sos y tu estilo de escritura (lo mismo que pusiste en tu MIRROR).'", JSON.stringify(perfil));
    } catch(e){}
    var msg=document.getElementById('gmail-copy-msg');
    if (navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(code).then(
        function(){ if(msg) msg.textContent='✅ Copiado, ya configurado con tu proxy y tu estilo. Pegalo en script.google.com'; },
        function(){ if(msg) msg.textContent='No pude copiar solo: seleccioná el código de abajo y copialo (Ctrl+C).'; }
      );
    } else { if(msg) msg.textContent='Seleccioná el código de abajo y copialo (Ctrl+C).'; }
  };
  window.guiaCopiar = function(id, btn){
    var el=document.getElementById(id); if(!el) return;
    var txt = (el.value!==undefined && el.value!==null) ? el.value : el.textContent;
    var ok=function(){ if(btn){ var o=btn.textContent; btn.textContent='\u2713 copiado'; setTimeout(function(){btn.textContent=o;},1500); } };
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(txt).then(ok).catch(function(){ try{ el.select&&el.select(); document.execCommand('copy'); ok(); }catch(e){} });
    } else { try{ el.select&&el.select(); document.execCommand('copy'); ok(); }catch(e){} }
  };

  // Si el usuario pega una Firebase que ya tiene un MIRROR configurado, se lo ofrecemos
  // (recupera nombres, motor, capacidades, color y perfil — el MIRROR "viaja" con él).
  let _cfgPrevia = null;
  window.consChequearConfigPrevia = async function(){
    const fb = (document.getElementById('c-fb').value||'').trim();
    const aviso = document.getElementById('cons-recuperar');
    if (!fb || typeof configBajarDeFirebase !== 'function') { aviso.style.display='none'; return; }
    aviso.style.display='block';
    aviso.innerHTML = '⏳ Buscando si ya tenés un MIRROR guardado en esta memoria...';
    const prev = await configBajarDeFirebase(fb);
    if (prev) {
      _cfgPrevia = prev;
      /* v40-cfgprevia (16/10/2026, auditor 2): lo que viene de config.json lo pudo escribir cualquiera que tenga
         la dirección de la base (la guía sugiere reglas abiertas). Antes iba con innerHTML → un appName con
         <img onerror> corría código en el constructor. Ahora todo lo remoto se pinta como TEXTO. */
      const _e = function(v){ return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').slice(0,80); };
      const nombre = (prev.perfil && prev.perfil.nombre) ? prev.perfil.nombre : 'tu MIRROR';
      aviso.innerHTML = '✨ Encontré una configuración guardada acá ('+ _e(prev.appName||'MIRROR') +', de '+ _e(nombre) +'). '+
        '<a onclick="consRecuperar()" style="color:#4ade80;text-decoration:underline;cursor:pointer;font-weight:700;">Traerla y seguir</a> — o ignorala y armá uno nuevo.';
    } else {
      aviso.style.display='none';
    }
  };
  window.consRecuperar = function(){
    if (!_cfgPrevia) return;
    const fbActual = (document.getElementById('c-fb').value||'').trim();
    /* v40-cfgprevia: el proxy es por donde sale TODA la charla. Si la config guardada trae un proxy distinto del
       que ya tenés, no lo aceptamos callados: lo mostramos y decidís vos (si decís que no, queda el tuyo). */
    try {
      const pxRemoto = String(_cfgPrevia.proxyUrl||'').trim();
      const pxActual = String((document.getElementById('c-proxy')||{}).value || (CONFIG&&CONFIG.proxyUrl) || '').trim();
      if (pxRemoto && pxRemoto.replace(/\/+$/,'') !== pxActual.replace(/\/+$/,'')) {
        const okPx = confirm('La configuración guardada usa este proxy para hablar con la IA:\n\n' + pxRemoto.slice(0,200) +
          '\n\n¿Es tuyo y lo querés usar? (Si no lo reconocés, tocá Cancelar: me quedo con el que ya tenías.)');
        if (!okPx) { _cfgPrevia = Object.assign({}, _cfgPrevia); if (pxActual) _cfgPrevia.proxyUrl = pxActual; else delete _cfgPrevia.proxyUrl; }
      }
    } catch(e){}
    /* v40-1023 (auditor 2): «Traerla» borraba los PIN locales (la copia de la base nunca los lleva), aceptaba callada otra base
       externa y traía la constancia de roles ya tildada desde la base (alguien podía dejarla «firmada»). Lo que es de ESTE
       dispositivo se queda como estaba; la constancia se firma acá. */
    const _loc = (typeof CONFIG !== 'undefined' && CONFIG) || {};
    const _prev = Object.assign({}, _cfgPrevia);
    ['pinMemH','pinExternaH','fbExterna','pinMem','pinExterna'].forEach(function(k){ if (_loc[k]) _prev[k] = _loc[k]; else delete _prev[k]; });
    if (_loc.roles && _loc.roles.aceptado) _prev.roles = _loc.roles; else delete _prev.roles;
    CONFIG = Object.assign({}, CONFIG_DEFAULT, _prev);
    CONFIG.fbUrl = fbActual; // respetamos la dirección que acaba de escribir
    guardarConfig(CONFIG);
    motorSel = CONFIG.motorPrincipal||'groq';
    capState = Object.assign({}, CONFIG_DEFAULT.cap, CONFIG.cap||{});
    colorSel = CONFIG.colorTema||'violeta';
    prefill(); pintarConstructor();
    document.getElementById('cons-recuperar').innerHTML = '✅ Listo, traje tu MIRROR. Revisá el proxy y el PIN, y dale a Siguiente.';
  };

  // Arranque: el constructor nace DESPUÉS de la cinemática (finishBoot lo dispara).
  // v22: si la URL trae un MIRROR compartido (#m=...), entramos en modo solo-lectura (no constructor).
  var _shared = (typeof window.leerPayloadCompartido==='function') ? window.leerPayloadCompartido() : null;
  if (_shared){ window.MODO_COMPARTIDO = _shared; }
  // v39-conslink (19/09/2026): ?constructor (o #constructor) en la URL fuerza el asistente de armado,
  // tenga o no config guardada — link de demo compartible, sin tocar la app normal del dueño.
  window._forzarConstructor = function(){ try { var q=((location.search||'')+(location.hash||'')); return /[?&#]constructor(?=$|[=&])/i.test(q); } catch(e){ return false; } };
  /* v39-consvisit (24/09/2026) — PEDIDO DE DARÍO: «que apenas deploye y apriete Visit aparezca
     el constructor, no la app desplegada». La plataforma es la PUERTA para que cada uno arme el
     suyo (y la carta de presentación de Darío): la dirección pelada abre SIEMPRE el constructor.
     Pero sin castigar al que ya la usa todos los días:
       · si ya tenés tu MIRROR armado en ese navegador, el paso 0 te muestra arriba un botón
         «Entrar a mi MIRROR ▸» (un toque) y abajo, lo de siempre para ajustarlo;
       · una vez que entraste, recargar en la MISMA pestaña va directo a la app (sessionStorage:
         se borra solo al cerrar la pestaña — nada queda guardado de más);
       · ?app en la URL entra directo siempre (es la que usa la app instalada, ver v36-pwa);
       · un link compartido (#m=…) sigue siendo solo-lectura, como siempre. */
  window._abrirDirecto = function(){
    try {
      if (/[?&]app(?=$|[=&])/i.test(location.search||'')) return true;
      return sessionStorage.getItem('mirror_sesion_entro') === '1';
    } catch(e){ return false; }   // navegador que bloquea el almacenamiento → puerta (es lo seguro)
  };
  window.MIRROR_necesitaConfig = (!CONFIG.configurado || window._forzarConstructor() || !window._abrirDirecto()) && !window.MODO_COMPARTIDO;
  window.lanzarConstructorTrasBoot = function(){
    if (window.MODO_COMPARTIDO) return;
    if (!CONFIG.configurado || window._forzarConstructor() || !window._abrirDirecto()){
      // ya armado y sin ?constructor (que es el link de demo «desde cero») → se precarga lo suyo
      if (CONFIG.configurado && !window._forzarConstructor()){ try{ prefill(); }catch(e){ try{ regError('consvisit:prefill', e); }catch(_){} } }
      try {
        const vol = document.getElementById('cons-volver');
        if (vol) vol.style.display = CONFIG.configurado ? 'block' : 'none';
        const nom = document.getElementById('cons-volver-nom');
        if (nom) nom.textContent = '«' + (CONFIG.appName || 'MIRROR') + '»';
      } catch(e){}
      pintarConstructor(); document.getElementById('cons-ov').classList.add('show'); consGo(0);
    }
  };
  if (CONFIG.configurado){ aplicarNombresUI(); aplicarCapacidades(); }
})();

