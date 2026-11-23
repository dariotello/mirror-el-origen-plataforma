/* ══════════ v40-piezas (10/11/2026) — DORMIR Y DESPERTAR PIEZAS (la tabla periódica en uso) ══════════
   Darío (06/11): «LA MATERIA ESTA FORMADA POR ATOMOS…» y «NO QUIERO TENER APLICACIONES QUE OCUPEN ESPACIO COMO WINDOWS».
   La entidad SABE de qué está hecha: ENTIDAD_PIEZAS (lo genera armar.js desde las fichas, no se escribe a mano).
   · «¿qué piezas tenés?» / «tabla periódica» → la lista sale del catálogo, sin el modelo (no puede inventar piezas).
   · «dormí la pieza de agenda» / «despertá la pieza de agenda» → solo las fichas con "dormible": true, y solo con el
     pedido explícito del usuario (consentimiento). El estado vive en ESTE dispositivo (localStorage).
   · Una pieza dormida no matchea nada: la app sigue andando como si no estuviera.
   La ficha manda primero: si su "estado" no es "despierto", la pieza no se despierta desde el chat. */
const PIEZAS_DORMIDAS_KEY = 'mirror_piezas_dormidas';
function piezasLocales(){ return (typeof ENTIDAD_PIEZAS !== 'undefined' && Array.isArray(ENTIDAD_PIEZAS)) ? ENTIDAD_PIEZAS : []; }
// v40-nube (23/11): las piezas que se enchufan (como Dato de agenda) viven en la nube; su ficha llega con el catálogo de atomos/
function piezasNube(){ try { return (ATOMOS_NUBE.catalogo ? ATOMOS_NUBE.catalogo.atomos : []).filter(function(a){ return a.se_ensambla_en; }).map(function(a){ return Object.assign({ nube: true }, a); }); } catch(e){ return []; } }
function piezasCatalogo(){ return piezasLocales().concat(piezasNube()); }
function piezasDormidas(){ try { const a = JSON.parse(localStorage.getItem(PIEZAS_DORMIDAS_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch(e){ return []; } }
function piezaFicha(id){ return piezasCatalogo().find(function(p){ return p.id === id; }) || null; }
function piezaDespierta(id){
  const f = piezaFicha(id);
  if (f && f.estado !== 'despierto') return false;            // la ficha manda
  return piezasDormidas().indexOf(id) < 0;                     // y después, lo que decidió el usuario en este dispositivo
}
function _piezaNorm(s){ try { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ ]+/g, ' ').trim(); } catch(e){ return String(s || '').toLowerCase(); } }
function piezaBuscar(q){
  const n = _piezaNorm(q).replace(/\b(la|el|de|del|pieza|atomo|organo|tu|mi)\b/g, ' ').replace(/\s+/g, ' ').trim();
  if (!n) return [];
  const pal = n.split(' ').filter(function(w){ return w.length >= 3; });
  return piezasCatalogo().filter(function(p){
    const h = _piezaNorm(p.id.replace(/_/g, ' ') + ' ' + p.nombre + ' ' + p.name);
    return pal.length && pal.every(function(w){ return h.indexOf(w) >= 0; });
  });
}
function _piezaLinea(p){ const vivo = piezaDespierta(p.id); return '• ' + (vivo ? '🟢' : '⚪') + ' ' + p.nombre + ' — ' + (p.tipo || 'órgano') + (p.se_ensambla_en ? ' (se ensambla en ' + p.se_ensambla_en + ')' : '') + ': ' + (vivo ? 'despierta' : 'dormida') + (p.dormible ? ' · se puede dormir' : ''); }
function piezasLista(){
  const loc = piezasLocales();
  if (!loc.length) return 'No encuentro mi catálogo de piezas en esta versión, así que no te voy a listar nada de memoria.';
  let nube = '';
  try {
    const c = ATOMOS_NUBE.catalogo, nom = function(a){ return _piezaNombreCorto(a.nombre); };
    if (!c) nube = '\n☁ La nube: no pude leer su catálogo (' + ATOMOS_NUBE.estadoCatalogo + '), así que lo que vive allá no te lo listo de memoria.';
    else nube = '\n☁ En la nube (las traigo cuando hacen falta y las suelto al terminar):\n' + piezasNube().map(_piezaLinea).join('\n')
      + '\n• Átomos para armar herramientas: ' + c.atomos.filter(function(a){ return !a.se_ensambla_en; }).map(nom).join(', ')
      + ((c.recetas || []).length ? '\n• Herramientas que sé armar: ' + c.recetas.map(function(r){ return r.nombre; }).join(', ') + ' («armame una calculadora»)' : '')
      + '\nCargadas ahora: ' + (Object.keys(ATOMOS_NUBE.cargados).map(function(id){ const f = nubeFicha(id); return f ? nom(f) : id; }).join(', ') || 'ninguna');
  } catch(e){}
  return '🧩 Mis piezas (la tabla periódica, sale de sus fichas, no de mi memoria):\nEn mí (el núcleo):\n' + loc.map(_piezaLinea).join('\n') + nube
    + '\nLas que dicen «se puede dormir» las dormís o despertás vos: «dormí la pieza de <nombre>» o «despertá la pieza de <nombre>». Queda en este dispositivo.';
}
function _piezaNombreCorto(n){ return String(n || '').replace(/\s*\(.*\)\s*$/, ''); }
function piezaCambiar(accion, q){
  const c = piezaBuscar(q);
  if (!c.length){ // v40-nube (hallazgo 2 del 18/11): además de decir que no está, digo cuáles hay
    const todas = piezasCatalogo(), dorm = todas.filter(function(p){ return p.dormible; });
    return 'No tengo ninguna pieza que se llame «' + String(q).trim() + '». Las que tengo: ' + todas.map(function(p){ return _piezaNombreCorto(p.nombre); }).join(', ') + '.'
      + (dorm.length ? ' ' + (dorm.length === 1 ? 'Solo ' + _piezaNombreCorto(dorm[0].nombre) + ' se puede dormir.' : 'Se pueden dormir: ' + dorm.map(function(p){ return _piezaNombreCorto(p.nombre); }).join(', ') + '.') : '')
      + (typeof ATOMOS_NUBE !== 'undefined' && !ATOMOS_NUBE.catalogo ? ' (El catálogo de la nube no llegó: si era de allá, no lo puedo ver ahora.)' : '');
  }
  if (c.length > 1) return 'Hay ' + c.length + ' piezas que coinciden: ' + c.map(function(p){ return p.nombre; }).join(' y ') + '. Decime cuál.';
  const p = c[0];
  if (!p.dormible) return '«' + p.nombre + '» es parte de lo que me sostiene: no se puede dormir desde el chat.';
  const d = piezasDormidas().filter(function(x){ return x !== p.id; });
  if (accion === 'dormir'){
    d.push(p.id);
    try { localStorage.setItem(PIEZAS_DORMIDAS_KEY, JSON.stringify(d)); } catch(e){ return 'No pude guardar el cambio en este dispositivo — quedó en mi diagnóstico.'; }
    return '⚪ Listo: «' + p.nombre + '» quedó dormida en este dispositivo. Mientras duerma no actúa, y el resto sigue andando. Para volver: «despertá la pieza de ' + p.nombre.replace(/\s*\(.*\)\s*$/, '').toLowerCase() + '».';
  }
  if (p.estado !== 'despierto') return '«' + p.nombre + '» está ' + p.estado + ' en su ficha: se despierta con una versión nueva, no desde el chat.';
  try { localStorage.setItem(PIEZAS_DORMIDAS_KEY, JSON.stringify(d)); } catch(e){ return 'No pude guardar el cambio en este dispositivo — quedó en mi diagnóstico.'; }
  return '🟢 Listo: «' + p.nombre + '» está despierta otra vez.';
}
try {
  /* v40-nube (hallazgo 1 del 18/11): «DORMÍ PIEZA AGENDA, ¿ME PASAS EL MAIL DE LAURA?» tomaba todo como nombre. Ahora la orden
     se corta en su parte; lo que sobra sigue su camino (lo prueban las demás reglas y, si ninguna lo toma, va como mensaje aparte). */
  const PIEZAS_RE = /^\s*¿?\s*(?:(dorm[ií](?:me)?|apag[aá]|despert[aá](?:me)?|prend[eé]|activ[aá])\s+(?:la\s+|el\s+)?(?:pieza|[aá]tomo|[oó]rgano)\s+(?:de\s+|del\s+)?(.{2,40}?)|(?:qu[eé]|cu[aá]les)\s+(?:piezas|[aá]tomos|[oó]rganos)\s+(?:ten[eé]s|hay|te\s+forman)|(?:mostr[aá](?:me)?|ver)\s+(?:tus\s+|las\s+)?piezas|tu\s+tabla\s+peri[oó]dica)\s*[?¡!.]*\s*$/i;
  const PIEZA_Y_MAS_RE = /^\s*¿?\s*(dorm[ií](?:me)?|apag[aá]|despert[aá](?:me)?|prend[eé]|activ[aá])\s+(?:la\s+|el\s+)?(?:pieza|[aá]tomo|[oó]rgano)\s+(?:de\s+|del\s+)?([^,;?¿!¡.]{2,40}?)\s*(?:[,;.!?¡¿]+|\s+y\s+)\s*(\S.*)$/i;
  if (typeof ACTUA_CMDS !== 'undefined' && Array.isArray(ACTUA_CMDS)) ACTUA_CMDS.unshift({
    nucleo: 'piezas',
    re: { source: 'v40-piezas', exec: function(t){ const d = PIEZA_Y_MAS_RE.exec(t); return d ? Object.assign([d[0], d[1], d[2]], { resto: d[3] }) : PIEZAS_RE.exec(t); } },
    run: function(m){
      if (!m[1]) return piezasLista();
      const acc = /^(?:dorm|apag)/i.test(m[1]) ? 'dormir' : 'despertar';
      const r = piezaCambiar(acc, m[2]);
      if (!m.resto) return r;
      let otro = null; try { otro = (typeof nubeResolverResto === 'function') ? nubeResolverResto(m.resto) : null; } catch(e){ try{ regError('nucleo:piezas:resto', e); }catch(_){ } }
      if (otro) return r + '\n\n' + otro;
      setTimeout(function(){ try { const i = document.getElementById('inp'); if (i && !i.value){ i.value = m.resto; send(); } } catch(e){} }, 80);
      return r + '\n\nY lo otro («' + m.resto + '») te lo contesto ahora, aparte.';
    }
  });
} catch(e){ try{ regError('nucleo:piezas', e); }catch(_){ } }
/* ══════════ FIN v40-piezas ══════════ */
