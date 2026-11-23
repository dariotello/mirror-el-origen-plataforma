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
