/* ☁ ÁTOMO DE LA NUBE «superficie» v1.0 — GENERADO por armar.js desde nube/atomos/superficie/codigo.js. NO SE EDITA A MANO.
   Lo trae el cargador del núcleo (organos/cargador) cuando un pedido lo necesita, y lo suelta al terminar. */
(function(){
var fabrica = function(){
/* ☁ ÁTOMO DE PANTALLA «superficie» (v40-nube, 23/11/2026) — el «papel» donde se arma una herramienta, en la conversación.
   Lo usan TODAS las recetas: es el ejemplo de átomo compartido. Trae el título, el botón «✕ desarmar» y una nota honesta.
   No guarda nada: al desarmar, el nodo se va del chat y con él todo lo que tenía adentro. */
function _supEsc(s){ return String(s == null ? '' : s).replace(/[&<>"]/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]; }); }
return {
  crear: function(props){
    props = props || {};
    const nodo = document.createElement('div');
    nodo.className = 'msg nube-herramienta';
    nodo.setAttribute('data-herramienta', String(props.id || ''));
    nodo.innerHTML = '<div class="av mav">◈</div><div class="bubble" style="min-width:240px;max-width:520px;">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;">'
      + '<b>' + _supEsc(props.titulo || 'Herramienta') + '</b>'
      + '<button type="button" data-nube="cerrar" title="Desarmar: suelto las piezas y libero la memoria" style="cursor:pointer;background:transparent;border:1px solid currentColor;color:inherit;border-radius:6px;padding:2px 8px;font:inherit;font-size:12px;opacity:.8;">✕ desarmar</button></div>'
      + '<div data-nube="cuerpo" style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;"></div>'
      + '<div style="font-size:11px;opacity:.55;margin-top:10px;">' + _supEsc(props.nota || '') + '</div></div>';
    const cerrar = nodo.querySelector('[data-nube="cerrar"]');
    return {
      nodo: nodo,
      cuerpo: nodo.querySelector('[data-nube="cuerpo"]'),
      alCerrar: function(fn){ cerrar.addEventListener('click', fn); }
    };
  }
};
};
if (typeof window !== 'undefined' && typeof window.__atomoNubeLlega === 'function') window.__atomoNubeLlega("superficie", "1.0", fabrica);
else if (typeof module !== 'undefined' && module.exports) module.exports = fabrica;
})();
