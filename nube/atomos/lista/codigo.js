/* ☁ ÁTOMO DE PANTALLA «lista» (v40-nube, 23/11/2026) — ítems que se agregan, se tachan (toque) y se quitan (✕).
   Métodos «agregar» y «vaciar». Lo escrito vive solo mientras la herramienta está armada. */
return {
  crear: function(props){
    props = props || {};
    const nodo = document.createElement('ul');
    nodo.style.cssText = 'flex:1 1 100%;margin:4px 0 0;padding-left:20px;font-size:15px;';
    function agregar(v){
      const s = String(v == null ? '' : v).trim(); if (!s) return;
      const li = document.createElement('li'); li.style.cursor = 'pointer';
      const tx = document.createElement('span'); tx.textContent = s;
      tx.addEventListener('click', function(){ tx.style.textDecoration = tx.style.textDecoration ? '' : 'line-through'; });
      const x = document.createElement('button'); x.type = 'button'; x.textContent = '✕'; x.title = 'quitar';
      x.style.cssText = 'margin-left:8px;cursor:pointer;background:transparent;border:0;color:inherit;opacity:.6;';
      x.addEventListener('click', function(){ li.remove(); });
      li.appendChild(tx); li.appendChild(x); nodo.appendChild(li);
    }
    return { nodo: nodo, agregar: agregar, vaciar: function(){ nodo.innerHTML = ''; } };
  }
};
