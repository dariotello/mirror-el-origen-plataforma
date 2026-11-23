/* ☁ ÁTOMO DE LA NUBE «texto» v1.0 — GENERADO por armar.js desde nube/atomos/texto/codigo.js. NO SE EDITA A MANO.
   Lo trae el cargador del núcleo (organos/cargador) cuando un pedido lo necesita, y lo suelta al terminar. */
(function(){
var fabrica = function(){
/* ☁ ÁTOMO DE PANTALLA «texto» (v40-nube, 23/11/2026) — muestra un resultado. Método «poner». Sin HTML: va como texto. */
return {
  crear: function(props){
    props = props || {};
    const nodo = document.createElement('div');
    nodo.setAttribute('role', 'status'); nodo.textContent = String(props.texto || '');
    nodo.style.cssText = 'flex:1 1 100%;font-size:18px;min-height:1.4em;';
    return { nodo: nodo, poner: function(v){ nodo.textContent = v == null ? '' : String(v); } };
  }
};
};
if (typeof window !== 'undefined' && typeof window.__atomoNubeLlega === 'function') window.__atomoNubeLlega("texto", "1.0", fabrica);
else if (typeof module !== 'undefined' && module.exports) module.exports = fabrica;
})();
