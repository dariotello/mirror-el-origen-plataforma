/* ☁ ÁTOMO DE LA NUBE «calcular» v1.0 — GENERADO por armar.js desde nube/atomos/calcular/codigo.js. NO SE EDITA A MANO.
   Lo trae el cargador del núcleo (organos/cargador) cuando un pedido lo necesita, y lo suelta al terminar. */
(function(){
var fabrica = function(){
/* ☁ ÁTOMO LÓGICO «calcular» (v40-nube, 23/11/2026) — hace la cuenta con el CÓDIGO, no con el modelo (que se equivoca en
   aritmética). Sin eval: un analizador chico que entiende + − × ÷ ^ % y paréntesis, con coma o punto decimal.
   Si la cuenta no se entiende, lo dice: no adivina. */
function _calcTokens(s){
  s = String(s || '').replace(/×|x(?=\s*[\d(])/gi, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/\s+/g, '');
  const out = []; let i = 0;
  while (i < s.length){
    const c = s[i];
    if (/[\d.,]/.test(c)){ let j = i; while (j < s.length && /[\d.,]/.test(s[j])) j++; const n = s.slice(i, j).replace(',', '.'); if (!/^\d*\.?\d+$|^\d+\.$/.test(n)) throw new Error('número raro «' + s.slice(i, j) + '»'); out.push(+n); i = j; continue; }
    if ('+-*/^()%'.indexOf(c) >= 0){ out.push(c); i++; continue; }
    throw new Error('no entiendo «' + c + '»');
  }
  return out;
}
function _calcular(expr){
  const tk = _calcTokens(expr); let p = 0;
  if (!tk.length) throw new Error('no hay cuenta');
  const ver = function(){ return tk[p]; }, toma = function(){ return tk[p++]; };
  function prim(){
    const t = toma();
    if (t === '-') return -prim();
    if (t === '+') return prim();
    if (t === '('){ const v = suma(); if (toma() !== ')') throw new Error('falta cerrar un paréntesis'); return v; }
    if (typeof t === 'number'){ if (ver() === '%'){ toma(); return t / 100; } return t; }
    throw new Error('la cuenta está incompleta');
  }
  function pot(){ const b = prim(); if (ver() === '^'){ toma(); return Math.pow(b, pot()); } return b; }
  function prod(){ let v = pot(); while (ver() === '*' || ver() === '/'){ const o = toma(), d = pot(); if (o === '/' && d === 0) throw new Error('no se puede dividir por cero'); v = o === '*' ? v * d : v / d; } return v; }
  function suma(){ let v = prod(); while (ver() === '+' || ver() === '-'){ const o = toma(), d = prod(); v = o === '+' ? v + d : v - d; } return v; }
  const v = suma();
  if (p < tk.length) throw new Error('sobra algo al final');
  if (!isFinite(v)) throw new Error('el resultado no es un número finito');
  return Math.round(v * 1e10) / 1e10;
}
return {
  ejecutar: function(expr){
    try { const v = _calcular(expr); return '= ' + String(v).replace('.', ','); }
    catch(e){ return 'No entiendo esa cuenta (' + e.message + '). Probá así: (3+4)*2'; }
  },
  calcular: _calcular
};
};
if (typeof window !== 'undefined' && typeof window.__atomoNubeLlega === 'function') window.__atomoNubeLlega("calcular", "1.0", fabrica);
else if (typeof module !== 'undefined' && module.exports) module.exports = fabrica;
})();
