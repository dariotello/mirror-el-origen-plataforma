/* ☁ ÁTOMO DE LA NUBE «armador» v1.0 — GENERADO por armar.js desde nube/atomos/armador/codigo.js. NO SE EDITA A MANO.
   Lo trae el cargador del núcleo (organos/cargador) cuando un pedido lo necesita, y lo suelta al terminar. */
(function(){
var fabrica = function(){
/* ☁ ÁTOMO LÓGICO «armador» (v40-nube, 23/11/2026) — el que ENSAMBLA una herramienta desde una receta JSON.
   Vive en la nube como cualquier átomo: el núcleo lo trae solo cuando piden una herramienta, y lo suelta al desarmarla.
   1) lee la receta; 2) la VALIDA contra el catálogo (ningún átomo inventado, ningún evento o método que el átomo no
   declare: la receta describe, nunca trae código); 3) trae sus átomos; 4) arma la pantalla y los enlaces; 5) devuelve la
   herramienta lista para que el núcleo la muestre y la desarme. Si algo falla, suelta lo que trajo y lo dice. */
function validar(r, cat){
  const mal = [], fi = function(id){ return (cat.atomos || []).find(function(a){ return a.id === id; }); };
  if (!r || !Array.isArray(r.atomos) || !Array.isArray(r.pantalla)) return ['la receta no tiene forma de receta'];
  r.atomos.forEach(function(a){ if (!fi(a)) mal.push('falta el átomo «' + a + '» en el catálogo'); });
  if (r.atomos.indexOf('superficie') < 0) mal.push('no tiene superficie');
  const ids = {};
  r.pantalla.forEach(function(p){ const f = fi(p.atomo); if (!/^[a-z_][a-z0-9_]*$/.test(p.id || '') || ids[p.id] || r.atomos.indexOf(p.atomo) < 0 || !f || f.clase !== 'pantalla') mal.push('la pieza «' + p.id + '» no es válida'); ids[p.id] = f; });
  (r.enlaces || []).forEach(function(e, k){
    const o = String(e.cuando || '').split('.'), lg = fi(e.pasar_por);
    if (!ids[o[0]] || ids[o[0]].eventos.indexOf(o[1]) < 0) mal.push('enlace ' + (k + 1) + ': evento que no existe');
    if (e.tomar && (!ids[e.tomar] || ids[e.tomar].metodos.indexOf('valor') < 0)) mal.push('enlace ' + (k + 1) + ': no hay de dónde tomar');
    if (e.pasar_por && (r.atomos.indexOf(e.pasar_por) < 0 || !lg || lg.clase !== 'lógica')) mal.push('enlace ' + (k + 1) + ': átomo lógico que no está');
    if (!ids[e.entregar_a] || ids[e.entregar_a].metodos.indexOf(e.metodo || 'poner') < 0) mal.push('enlace ' + (k + 1) + ': método que no existe');
  });
  return mal;
}
async function armar(rf, api){
  const r = await api.tope(fetch(api.base + rf.archivo + '?v=' + encodeURIComponent(rf.huella || ''), { cache: 'no-cache' }).then(function(x){ if (!x.ok) throw new Error('HTTP ' + x.status); return x.json(); }), 6000);
  const mal = validar(r, api.catalogo || {});
  if (mal.length) throw new Error('la receta no pasó la validación: ' + mal.join('; '));
  const traidos = [];
  try { for (const a of r.atomos){ await api.traer(a); traidos.push(a); } }
  catch(e){ traidos.forEach(api.soltar); throw e; }
  const A = function(id){ return api.cargados[id].inst; }, P = {};
  const sup = A('superficie').crear({ id: r.id, titulo: r.nombre, nota: 'Armada con ' + r.atomos.length + ' átomos de la nube (' + r.atomos.join(', ') + '). Cuando no la necesites, «✕ desarmar»: se suelta todo y no queda nada instalado.' });
  r.pantalla.forEach(function(p){ P[p.id] = A(p.atomo).crear(p.props || {}); sup.cuerpo.appendChild(P[p.id].nodo); });
  (r.enlaces || []).forEach(function(e){
    const o = e.cuando.split('.');
    P[o[0]].on(o[1], function(){
      let v = e.tomar ? P[e.tomar].valor() : '';
      if (e.pasar_por) v = A(e.pasar_por).ejecutar(v);
      P[e.entregar_a][e.metodo || 'poner'](v);
      if (e.limpiar && e.tomar) P[e.tomar].limpiar();
    });
  });
  return { id: r.id, nombre: r.nombre, nodo: sup.nodo, atomos: r.atomos.slice(), alCerrar: sup.alCerrar };
}
return { armar: armar, validar: validar };
};
if (typeof window !== 'undefined' && typeof window.__atomoNubeLlega === 'function') window.__atomoNubeLlega("armador", "1.0", fabrica);
else if (typeof module !== 'undefined' && module.exports) module.exports = fabrica;
})();
