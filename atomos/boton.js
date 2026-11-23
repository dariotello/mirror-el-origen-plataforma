/* ☁ ÁTOMO DE LA NUBE «boton» v1.0 — GENERADO por armar.js desde nube/atomos/boton/codigo.js. NO SE EDITA A MANO.
   Lo trae el cargador del núcleo (organos/cargador) cuando un pedido lo necesita, y lo suelta al terminar. */
(function(){
var fabrica = function(){
/* ☁ ÁTOMO DE PANTALLA «botón» (v40-nube, 23/11/2026) — un botón con su texto. Compartido por todas las recetas. Evento «toca». */
return {
  crear: function(props){
    props = props || {};
    const nodo = document.createElement('button');
    nodo.type = 'button'; nodo.textContent = String(props.texto || 'OK');
    nodo.style.cssText = 'cursor:pointer;padding:6px 12px;border-radius:6px;border:1px solid currentColor;background:transparent;color:inherit;font:inherit;font-size:14px;';
    const oyentes = { toca: [] };
    nodo.addEventListener('click', function(){ oyentes.toca.forEach(function(f){ f(); }); });
    return { nodo: nodo, on: function(ev, fn){ if (oyentes[ev]) oyentes[ev].push(fn); } };
  }
};
};
if (typeof window !== 'undefined' && typeof window.__atomoNubeLlega === 'function') window.__atomoNubeLlega("boton", "1.0", fabrica);
else if (typeof module !== 'undefined' && module.exports) module.exports = fabrica;
})();
