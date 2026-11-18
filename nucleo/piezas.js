/* ══════════ v40-piezas (10/11/2026) — DORMIR Y DESPERTAR PIEZAS (la tabla periódica en uso) ══════════
   Darío (06/11): «LA MATERIA ESTA FORMADA POR ATOMOS…» y «NO QUIERO TENER APLICACIONES QUE OCUPEN ESPACIO COMO WINDOWS».
   La entidad SABE de qué está hecha: ENTIDAD_PIEZAS (lo genera armar.js desde las fichas, no se escribe a mano).
   · «¿qué piezas tenés?» / «tabla periódica» → la lista sale del catálogo, sin el modelo (no puede inventar piezas).
   · «dormí la pieza de agenda» / «despertá la pieza de agenda» → solo las fichas con "dormible": true, y solo con el
     pedido explícito del usuario (consentimiento). El estado vive en ESTE dispositivo (localStorage).
   · Una pieza dormida no matchea nada: la app sigue andando como si no estuviera.
   La ficha manda primero: si su "estado" no es "despierto", la pieza no se despierta desde el chat. */
const PIEZAS_DORMIDAS_KEY = 'mirror_piezas_dormidas';
function piezasCatalogo(){ return (typeof ENTIDAD_PIEZAS !== 'undefined' && Array.isArray(ENTIDAD_PIEZAS)) ? ENTIDAD_PIEZAS : []; }
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
function piezasLista(){
  const cat = piezasCatalogo();
  if (!cat.length) return 'No encuentro mi catálogo de piezas en esta versión, así que no te voy a listar nada de memoria.';
  const lin = cat.map(function(p){
    const vivo = piezaDespierta(p.id);
    return '• ' + (vivo ? '🟢' : '⚪') + ' ' + p.nombre + ' — ' + (p.tipo || 'órgano') + (p.se_ensambla_en ? ' (se ensambla en ' + p.se_ensambla_en + ')' : '') + ': ' + (vivo ? 'despierta' : 'dormida') + (p.dormible ? ' · se puede dormir' : '');
  });
  return '🧩 Mis piezas (la tabla periódica, sale de sus fichas, no de mi memoria):\n' + lin.join('\n')
    + '\nLas que dicen «se puede dormir» las dormís o despertás vos: «dormí la pieza de <nombre>» o «despertá la pieza de <nombre>». Queda en este dispositivo.';
}
function piezaCambiar(accion, q){
  const c = piezaBuscar(q);
  if (!c.length) return 'No tengo ninguna pieza que se llame «' + String(q).trim() + '». Preguntame «¿qué piezas tenés?» y te muestro la lista real.';
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
  if (typeof ACTUA_CMDS !== 'undefined' && Array.isArray(ACTUA_CMDS)) ACTUA_CMDS.unshift({
    nucleo: 'piezas',
    re: /^\s*¿?\s*(?:(dorm[ií](?:me)?|apag[aá]|despert[aá](?:me)?|prend[eé]|activ[aá])\s+(?:la\s+|el\s+)?(?:pieza|[aá]tomo|[oó]rgano)\s+(?:de\s+|del\s+)?(.{2,40}?)|(?:qu[eé]|cu[aá]les)\s+(?:piezas|[aá]tomos|[oó]rganos)\s+(?:ten[eé]s|hay|te\s+forman)|(?:mostr[aá](?:me)?|ver)\s+(?:tus\s+|las\s+)?piezas|tu\s+tabla\s+peri[oó]dica)\s*[?¡!.]*\s*$/i,
    run: function(m){
      if (!m[1]) return piezasLista();
      const acc = /^(?:dorm|apag)/i.test(m[1]) ? 'dormir' : 'despertar';
      return piezaCambiar(acc, m[2]);
    }
  });
} catch(e){ try{ regError('nucleo:piezas', e); }catch(_){ } }
/* ══════════ FIN v40-piezas ══════════ */
