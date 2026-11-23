/* ══════════ v40-nube (23/11/2026) — EL CARGADOR DE LA NUBE: traer · usar · soltar ══════════
   Darío (22/11): «…QUE LA APP OPEREN EN LA NUBE ARMANDO Y DESARMANDO LO QUE EL USUARIO NECESITA Y SE LO TRAE, CUANDO EL
   USUARIO NO LO NECESITA MÁS SE DESENSAMBLA…». El index arranca SIN piezas: los átomos y las recetas viven en atomos/
   (los publica armar.js). Un dato de agenda: se trae el átomo, contesta y se suelta al fin del turno. Una herramienta:
   se trae el átomo «armador», que valida la receta y la arma; «✕ desarmar» suelta todo. Sin red: se dice de frente. */
const ATOMOS_NUBE = { base: 'atomos/', catalogo: null, estadoCatalogo: 'sin leer', cargados: {}, fabricas: {}, registro: [], herramienta: null, _leyendo: null };
window.__atomoNubeLlega = function(id, v, fab){ if (typeof fab === 'function') ATOMOS_NUBE.fabricas[id] = fab; };
function _nubeTope(p, ms){ let t; return Promise.race([p, new Promise(function(_, no){ t = setTimeout(function(){ no(new Error('tardó demasiado')); }, ms); })]).finally(function(){ clearTimeout(t); }); }
function nubeCatalogo(){
  const N = ATOMOS_NUBE;
  if (N.estadoCatalogo === 'leído') return Promise.resolve(N.catalogo);
  return N._leyendo || (N._leyendo = _nubeTope(fetch(N.base + 'catalogo.json', { cache: 'no-cache' }), 6000)
    .then(function(r){ if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function(c){ if (!c || !Array.isArray(c.atomos)) throw new Error('vino sin forma'); N.catalogo = c; N.estadoCatalogo = 'leído'; try { localStorage.setItem('mirror_nube_catalogo', JSON.stringify(c)); } catch(e){} })
    .catch(function(e){ N.estadoCatalogo = 'no llegó: ' + ((e && e.message) || e); // el respaldo: la última ficha leída (solo fichas, unos KB)
      if (!N.catalogo) try { const g = JSON.parse(localStorage.getItem('mirror_nube_catalogo') || 'null'); if (g && Array.isArray(g.atomos)) N.catalogo = g; } catch(_){ } })
    .then(function(){ N._leyendo = null; return N.catalogo; }));
}
function nubeFicha(id){ const c = ATOMOS_NUBE.catalogo; return (c && c.atomos.find(function(a){ return a.id === id; })) || null; }
function nubeTraer(id){
  const N = ATOMOS_NUBE, f = nubeFicha(id);
  if (!f) return Promise.reject(new Error('«' + id + '» no está en el catálogo'));
  if (N.cargados[id]) return Promise.resolve(N.cargados[id]);
  return new Promise(function(si, no){
    const s = document.createElement('script'), tope = setTimeout(function(){ fin(new Error('tardó demasiado')); }, 8000);
    s.src = N.base + f.archivo + '?v=' + encodeURIComponent(f.huella || ''); s.setAttribute('data-atomo-nube', id);
    function fin(err){
      clearTimeout(tope); s.onload = s.onerror = null;
      const fab = N.fabricas[id]; delete N.fabricas[id]; let inst = null;
      if (!err && typeof fab !== 'function') err = new Error('llegó sin su fábrica');
      if (!err) try { inst = fab() || {}; } catch(e){ err = e; }
      if (err){ s.remove(); return no(err); }
      N.cargados[id] = { id: id, ficha: f, inst: inst, script: s, regla: null };
      N.registro.push({ id: id, trajo: Date.now(), solto: 0 }); if (N.registro.length > 60) N.registro.shift();
      si(N.cargados[id]);
    }
    s.onload = function(){ fin(null); }; s.onerror = function(){ fin(new Error('no llegó, ¿sin red?')); };
    document.head.appendChild(s);
  });
}
function nubeSoltar(id){
  const N = ATOMOS_NUBE, c = N.cargados[id]; if (!c) return;
  const i = c.regla ? ACTUA_CMDS.indexOf(c.regla) : -1; if (i >= 0) ACTUA_CMDS.splice(i, 1);
  if (c.script) c.script.remove();
  delete N.cargados[id];
  const r = N.registro.filter(function(x){ return x.id === id && !x.solto; }).pop(); if (r) r.solto = Date.now();
}
// en la fila: en su «hueco» si dejó uno en las manos (así conserva su lugar de siempre); si no, detrás de la regla de piezas
function _nubeEnFila(id, regla){ const h = ACTUA_CMDS.findIndex(function(c){ return c.hueco === id; }); ACTUA_CMDS.splice(h >= 0 ? h : ACTUA_CMDS.findIndex(function(c){ return c.nucleo === 'piezas'; }) + 1, 0, regla); return regla; }
function _nubeNombre(f){ return String((f && f.nombre) || '').replace(/\s*\(.*\)\s*$/, ''); }
// las manos: antes de las reglas se traen los átomos cuya «pista» coincide; al terminar el turno se sueltan
async function nubePrepararManos(text){
  try {
    if ((typeof mode !== 'undefined' && mode !== 'mirror') || (typeof CONFIG !== 'undefined' && CONFIG.cap && CONFIG.cap.actua === false)) return;
    const t = String(text || ''); if (!t.trim() || t.length > 220) return;
    const cat = await nubeCatalogo(); if (!cat) return;
    for (const f of cat.atomos.filter(function(a){ return a.se_ensambla_en === 'manos' && a.pista && new RegExp(a.pista, 'i').test(t); })){
      const n = _nubeNombre(f);
      try {
        const c = await nubeTraer(f.id), inst = c.inst;
        if (!c.regla) c.regla = _nubeEnFila(f.id, { atomo: f.id, nube: true,
          re: { source: 'nube:' + f.id, exec: function(x){ if (piezaDespierta(f.id)) return inst.regla.re.exec(x); return inst.entender && inst.entender(x, true) ? Object.assign([String(x)], { dormida: true }) : null; }, test: function(x){ return !!this.exec(x); } },
          run: function(m){ return m.dormida ? '⚪ Eso lo contesta la pieza «' + n + '», y está dormida en este dispositivo: no te doy el dato. Despertala con «despertá la pieza de ' + n.toLowerCase().replace(/^dato de /, '') + '».' : inst.regla.run(m); } });
      } catch(e){
        try { regError('nube:traer:' + f.id, e); } catch(_){ }
        const re = f.aviso_si && new RegExp(f.aviso_si, 'i');   // sin el átomo, el aviso solo toma lo que seguro era suyo
        if (re && re.test(t) && piezaDespierta(f.id)) ATOMOS_NUBE.cargados['aviso:' + f.id] = { regla: _nubeEnFila(f.id, { atomo: f.id, re: re,
          run: function(){ return 'Para contestarte eso tengo que traer de la nube la pieza «' + n + '», y no llegó (' + e.message + '). No te invento el dato: probá de nuevo con conexión.'; } }) };
      }
    }
  } catch(e){ try { regError('nube:preparar', e); } catch(_){ } }
}
function nubeSoltarManos(){ const h = ATOMOS_NUBE.herramienta; Object.keys(ATOMOS_NUBE.cargados).forEach(function(id){ if (!h || h.atomos.indexOf(id) < 0) nubeSoltar(id); }); }
// lo que sobra de un mensaje doble («dormí la pieza de agenda, ¿me pasás el mail de Laura?»): lo prueban las reglas en fila
function nubeResolverResto(resto){ for (const c of ACTUA_CMDS){ if (c.nucleo === 'piezas') continue; const m = c.re.exec(resto); if (m) return c.run(m); } return null; }
// las herramientas: el ARMADOR también vive en la nube; se trae solo cuando piden una
function nubeDesarmar(){ const h = ATOMOS_NUBE.herramienta; if (!h) return null; ATOMOS_NUBE.herramienta = null; h.nodo.remove(); h.atomos.forEach(nubeSoltar); return h; }
function _nubeChau(h){ return '🧹 Desarmé «' + h.nombre + '»: solté ' + h.atomos.length + ' átomos y liberé la memoria.'; }
const NUBE_CERRAR_RE = /^\s*(?:cerr[aá]|desarm[aá]|sac[aá]|quit[aá])(?:la|lo)?\s+(?:la\s+|el\s+)?(?:calculadora|lista(?:\s+de\s+\w+)?|herramienta)\s*[.!?]*\s*$/i;
async function nubeHerramienta(text){
  if (typeof mode !== 'undefined' && mode !== 'mirror') return false;
  const t = String(text || '').trim(), cierra = NUBE_CERRAR_RE.test(t);
  let rf = null, resp, h;
  if (!cierra){ if (!t || t.length > 90) return false; const cat = await nubeCatalogo(); rf = cat && (cat.recetas || []).find(function(x){ return new RegExp(x.pide, 'i').test(t); }); if (!rf) return false; }
  addMsg('user', t);
  if (cierra){ h = nubeDesarmar(); resp = h ? _nubeChau(h) : 'No tengo ninguna herramienta armada ahora.'; h = null; }
  else try {
    nubeDesarmar();
    const a = await nubeTraer('armador');
    h = await a.inst.armar(rf, { base: ATOMOS_NUBE.base, catalogo: ATOMOS_NUBE.catalogo, traer: nubeTraer, soltar: nubeSoltar, cargados: ATOMOS_NUBE.cargados, tope: _nubeTope });
    h.atomos.push('armador'); ATOMOS_NUBE.herramienta = h;
    h.alCerrar(function(){ const x = nubeDesarmar(); if (x) addMsg('mirror', _nubeChau(x)); });
    resp = '🧩 Te armé «' + h.nombre + '» con ' + (h.atomos.length - 1) + ' átomos de la nube: la tenés acá abajo. Cuando no la necesites, tocá «✕ desarmar».';
  } catch(e){ h = null; nubeSoltar('armador'); try { regError('nube:armar', e); } catch(_){ } resp = 'Quise armarte «' + rf.nombre + '» con las piezas de la nube y no pude (' + ((e && e.message) || e) + '). No te muestro algo a medias.'; }
  addMsg('mirror', resp);
  if (h){ const chat = document.getElementById('chat'); chat.appendChild(h.nodo); chat.scrollTop = chat.scrollHeight; }
  try { history.push({ role: 'user', content: t }, { role: 'assistant', content: resp }); hablar(resp); } catch(e){}
  try { setButtonsBusy(false); } catch(e){}
  return true;
}
setTimeout(nubeCatalogo, 1200);
/* ══════════ FIN v40-nube ══════════ */
