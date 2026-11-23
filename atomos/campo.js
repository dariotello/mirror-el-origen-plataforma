/* ☁ ÁTOMO DE LA NUBE «campo» v1.0 — GENERADO por armar.js desde nube/atomos/campo/codigo.js. NO SE EDITA A MANO.
   Lo trae el cargador del núcleo (organos/cargador) cuando un pedido lo necesita, y lo suelta al terminar. */
(function(){
var fabrica = function(){
/* ☁ ÁTOMO DE PANTALLA «campo» (v40-nube, 23/11/2026) — una línea para escribir. Compartido: la calculadora lo usa para la
   cuenta y la lista para cada ítem. Evento «enter»; métodos valor / poner / limpiar. */
return {
  crear: function(props){
    props = props || {};
    const nodo = document.createElement('input');
    nodo.type = 'text'; nodo.placeholder = String(props.placeholder || ''); nodo.setAttribute('aria-label', String(props.placeholder || 'campo'));
    nodo.style.cssText = 'flex:1 1 180px;min-width:0;padding:6px 8px;border-radius:6px;border:1px solid rgba(128,128,128,.5);background:transparent;color:inherit;font:inherit;font-size:14px;';
    const oyentes = { enter: [] };
    nodo.addEventListener('keydown', function(e){ if (e.key === 'Enter'){ e.preventDefault(); oyentes.enter.forEach(function(f){ f(); }); } });
    return {
      nodo: nodo,
      on: function(ev, fn){ if (oyentes[ev]) oyentes[ev].push(fn); },
      valor: function(){ return nodo.value; },
      poner: function(v){ nodo.value = v == null ? '' : String(v); },
      limpiar: function(){ nodo.value = ''; try { nodo.focus(); } catch(e){} }
    };
  }
};
};
if (typeof window !== 'undefined' && typeof window.__atomoNubeLlega === 'function') window.__atomoNubeLlega("campo", "1.0", fabrica);
else if (typeof module !== 'undefined' && module.exports) module.exports = fabrica;
})();
