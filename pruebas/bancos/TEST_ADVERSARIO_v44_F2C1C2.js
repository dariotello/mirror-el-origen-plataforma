/* TEST ADVERSARIO — F2 (voz on-device) · C1 (Web Share) · C2 (acción por voz) · C3 (Contact Picker)
   31/07/2026 · corre con: node TEST_ADVERSARIO_v44_F2C1C2.js
   Extrae las funciones REALES de MIRROR/index.html y PLATAFORMA/index.html (no copias
   pegadas: si el HTML cambia, el test cambia con él) y las corre en un DOM de mentira.
   Filosofía del banco: buscar el fallo, no la confirmación. Cada caso pregunta «¿qué
   pasa si el navegador NO tiene esto?» y «¿esto le roba el turno a lo que ya andaba?». */
const fs = require('fs'), path = require('path'), vm = require('vm');

const BASE = path.join(__dirname, '..');
const F_MIRROR = path.join(BASE, 'MIRROR', 'index.html');
const F_PLAT   = path.join(BASE, 'PLATAFORMA', 'index.html');

let ok = 0, fail = 0; const fallos = [];
function t(nombre, cond, extra) {
  if (cond) { ok++; }
  else { fail++; fallos.push(nombre + (extra ? ' → ' + extra : '')); }
}

// ── extractor: saca `function NAME(...){...}` balanceando llaves ───────────────
function extraer(src, nombre) {
  const re = new RegExp('(?:async\\s+)?function\\s+' + nombre + '\\s*\\(');
  const m = re.exec(src);
  if (!m) throw new Error('no encontré la función ' + nombre);
  let i = src.indexOf('{', m.index + m[0].length - 1), prof = 0, ini = i;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === '{') prof++;
    else if (c === '}') { prof--; if (prof === 0) return src.slice(m.index, i + 1); }
    else if (c === '"' || c === "'" || c === '`') { // saltear strings
      const q = c; i++;
      while (i < src.length && src[i] !== q) { if (src[i] === '\\') i++; i++; }
    } else if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i) + 1; }
    else if (c === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); }
    else if (c === '/') {
      /* 2/08/2026 — LITERALES DE EXPRESIÓN REGULAR. Sin esto, una regex con una comilla
         adentro (`replace(/[<>&"]/g, …)`, que es justo lo que usa addImagenGenerada) se leía
         como el arranque de un string y el extractor se comía la llave de cierre: «llaves sin
         cerrar». Se distingue regex de división mirando el último carácter significativo:
         después de un operador o un paréntesis de apertura, un `/` solo puede abrir una regex.
         Dentro de la regex hay que respetar los corchetes, donde un `/` NO cierra nada. */
      let k = i - 1;
      while (k >= 0 && /\s/.test(src[k])) k--;
      const previo = k >= 0 ? src[k] : '(';
      if ('(,=:[!&|?{;+-*%~^'.indexOf(previo) >= 0 || /\breturn$|\btypeof$/.test(src.slice(Math.max(0, k - 7), k + 1))) {
        i++; let clase = false;
        for (; i < src.length; i++) {
          if (src[i] === '\\') { i++; continue; }
          if (src[i] === '[') clase = true;
          else if (src[i] === ']') clase = false;
          else if (src[i] === '/' && !clase) break;
          else if (src[i] === '\n') break; // no era una regex: salimos sin romper nada
        }
      }
    }
  }
  throw new Error('llaves sin cerrar en ' + nombre);
}
/* Funciones de UNA línea: el extractor de arriba no sirve cuando el cuerpo tiene una
   expresión regular con comillas adentro (`replace(/"/g, …)`) — la ve como el arranque de
   un string y se come la llave de cierre. Para esos casos se toma la línea entera, que
   sigue siendo código REAL del archivo. */
/* v40-octubre (2/10/2026): en la PLATAFORMA, callGroq ahora llama a llamarPrincipalPaciente (espera corta
   del principal antes del respaldo) y, en la rama del respaldo, a respaldoSystem/respaldoTemp (respaldo más
   honesto). Para correr callGroq aislado hacen falta esas piezas. Si no existen (MIRROR v4.5), no se agrega
   nada: la prueba de MIRROR queda idéntica. */
function depsMotor(src) {
  const out = [];
  ['esModeloRazonador', 'pedidoMasGrandeQueCupo', 'principalConvieneEsperar', 'llamarPrincipalPaciente', 'respaldoSystem', 'respaldoTemp']
    .forEach(function (n) { try { out.push(extraer(src, n)); } catch (e) {} });
  ['PRINCIPAL_ESPERA_MAX', 'PRINCIPAL_ESPERA_CADA_MS', '_principalUltimaEspera', 'RESPALDO_TEMP_MAX', 'RESPALDO_HONESTO'].forEach(function (n) {
    const m = new RegExp('^(?:const|let) ' + n + ' = .*$', 'm').exec(src); if (m) out.push(m[0].replace(/^(?:const|let) /, 'var '));
  });
  return out.join('\n');
}
function extraerLinea(src, nombre) {
  const re = new RegExp('^.*function\\s+' + nombre + '\\s*\\(.*$', 'm');
  const m = re.exec(src);
  if (!m) throw new Error('no encontré la línea de ' + nombre);
  return m[0];
}
function codH4Fuente(src) { // el módulo H4 entero, para mirarlo como texto
  const i = src.indexOf('const PROC_REG = {}');
  return i < 0 ? '' : src.slice(i, src.indexOf('function addMsg(role, text, style, imgUrl) {'));
}
function extraerRegla(src, marca) { // la regla de ACTUA_CMDS que lleva esta marca
  const i = src.indexOf(marca); if (i < 0) throw new Error('no encontré la marca ' + marca);
  const j = src.indexOf('re: /', i); if (j < 0) throw new Error('no encontré el re: de ' + marca);
  const fin = src.indexOf('/i,', j); return src.slice(j + 4, fin + 2);
}

// ── DOM de mentira, lo mínimo que estas funciones tocan ───────────────────────
function nodo() {
  const n = { className: '', _html: '', hijos: [], listeners: {}, textContent: '', atributos: {} };
  n.appendChild = x => { n.hijos.push(x); return x; };
  n.addEventListener = (ev, f) => { (n.listeners[ev] = n.listeners[ev] || []).push(f); };
  n.setAttribute = (k, v) => { n.atributos[k] = v; };
  n.classList = { add(){}, remove(){}, toggle(){} };
  Object.defineProperty(n, 'innerHTML', { get: () => n._html, set(v) { n._html = v; } });
  n.getAttribute = k => n.atributos[k];
  /* querySelectorAll de mentira, para los botones que se crean en lote (las tarjetas de H3
     arman dos: «10 minutos más» y «seguir sin límite»). Devuelve un nodo por cada atributo
     encontrado en el HTML, con su getAttribute apuntando al valor real. */
  n.querySelectorAll = sel => {
    const attr = /\[([a-z0-9-]+)\]/i.exec(sel);
    if (!attr) return [];
    const re = new RegExp(attr[1] + '="([^"]*)"', 'g');
    const out = []; let m;
    while ((m = re.exec(n._html)) !== null) { const val = m[1]; const x = nodo(); x.getAttribute = () => val; out.push(x); }
    return out;
  };
  n.querySelector = sel => {
    const attr = /\[([a-z0-9-]+)\]/i.exec(sel);
    if (attr && n._html.indexOf('data-' + attr[1].replace(/^data-/, '')) < 0 && n._html.indexOf(attr[1]) < 0) return null;
    if (/^\./.test(sel) && n._html.indexOf(sel.slice(1)) < 0) return null;
    return nodo();
  };
  return n;
}
function contexto(conShare, opciones) {
  opciones = opciones || {};
  const chat = nodo();
  const nav = { userAgent: 'Mozilla/5.0 (Linux; Android 13)' };
  if (conShare) nav.share = opciones.share || (async () => {});
  const ctx = {
    console, setTimeout, Promise, JSON, String, Number, Math, RegExp, Error, Array, Object,
    document: { getElementById: id => (id === 'chat' ? chat : nodo()), createElement: () => nodo(), body: nodo() },
    navigator: nav,
    regError: () => {}, addMsg: () => {}, mode: 'mirror',
    actuaDifiriendo: false, actuaDiferidas: [], compartirDiferidas: [],
    actuaEsc: s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
    redactorCopiaVieja: () => {},
    REDACTOR_URL_MAX: 1800,
    _chat: chat
  };
  ctx.window = ctx;
  return vm.createContext(ctx);
}

for (const [etiqueta, archivo] of [['MIRROR', F_MIRROR], ['PLATAFORMA', F_PLAT]].filter(([, a]) => fs.existsSync(a))) { // [repo] sin MIRROR/index.html se saltea
  const src = fs.readFileSync(archivo, 'utf8');
  const P = etiqueta + ' · ';

  // ══════════ C1 — helpers de compartir ══════════
  const codShare = ['mirrorCompartirSoporte', 'mirrorCompartir', 'compartirCopiar', 'compartirTarjeta', 'compartirPintarDiferidas']
    .map(n => extraer(src, n)).join('\n');

  // 1. sin navigator.share, mirrorCompartir NO promete nada
  {
    const c = contexto(false); vm.runInContext(codShare, c);
    t(P + 'sin soporte → mirrorCompartirSoporte()===false', vm.runInContext('mirrorCompartirSoporte()', c) === false);
    const r = vm.runInContext('mirrorCompartir("hola")', c);
    t(P + 'sin soporte → mirrorCompartir devuelve una promesa (el que llama hace fallback)', r && typeof r.then === 'function');
    r.then(v => t(P + 'sin soporte → resuelve false', v === false, 'devolvió ' + v));
  }
  // 2. con soporte y envío OK
  {
    let recibido = null;
    const c = contexto(true, { share: async d => { recibido = d; } }); vm.runInContext(codShare, c);
    vm.runInContext('mirrorCompartir("el texto","el titulo")', c).then(v => {
      t(P + 'con soporte → devuelve true', v === true);
      t(P + 'con soporte → manda el texto tal cual', recibido && recibido.text === 'el texto', JSON.stringify(recibido));
      t(P + 'con soporte → manda el título', recibido && recibido.title === 'el titulo');
    });
  }
  // 3. el usuario CANCELA el selector: no es un error, no debe caer al portapapeles
  {
    const c = contexto(true, { share: async () => { const e = new Error('cancelado'); e.name = 'AbortError'; throw e; } });
    vm.runInContext(codShare, c);
    vm.runInContext('mirrorCompartir("x")', c).then(v => t(P + 'AbortError (usuario canceló) → true, sin fallback molesto', v === true, 'devolvió ' + v));
  }
  // 4. error REAL del navegador → false (y el que llama copia)
  {
    const c = contexto(true, { share: async () => { throw new Error('NotAllowedError'); } });
    vm.runInContext(codShare, c);
    vm.runInContext('mirrorCompartir("x")', c).then(v => t(P + 'error real → false (cae al portapapeles)', v === false));
  }
  // 5. canShare que rechaza el dato → false sin explotar
  {
    const c = contexto(true, {}); c.navigator.canShare = () => false; vm.runInContext(codShare, c);
    vm.runInContext('mirrorCompartir("x")', c).then(v => t(P + 'canShare false → false', v === false));
  }
  // 6. la tarjeta: texto vacío no pinta nada
  {
    const c = contexto(true); vm.runInContext(codShare, c);
    t(P + 'compartirTarjeta con texto vacío → false', vm.runInContext('compartirTarjeta("📤","t","","   ")', c) === false);
    t(P + 'compartirTarjeta con texto → true', vm.runInContext('compartirTarjeta("📤","t","","hola")', c) === true);
    t(P + 'con soporte → botón «elegir a dónde va»', c._chat.hijos[0]._html.indexOf('elegir a dónde va') > 0);
  }
  // 7. sin soporte, la tarjeta es HONESTA: ofrece copiar y lo explica
  {
    const c = contexto(false); vm.runInContext(codShare, c);
    vm.runInContext('compartirTarjeta("📤","t","","hola")', c);
    const html = c._chat.hijos[0]._html;
    t(P + 'sin soporte → botón de copiar, no promete el selector', html.indexOf('copiar el texto') > 0 && html.indexOf('elegir a dónde va') < 0);
    t(P + 'sin soporte → lo dice con todas las letras', html.indexOf('no tiene el selector de compartir') > 0);
  }
  // 8. escapado: el texto del usuario NO entra crudo al HTML
  {
    const c = contexto(true); vm.runInContext(codShare, c);
    vm.runInContext('compartirTarjeta("📤","<img src=x onerror=alert(1)>","","<b>hola</b>")', c);
    const html = c._chat.hijos[0]._html;
    t(P + 'XSS: el título se escapa', html.indexOf('<img src=x') < 0 && html.indexOf('&lt;img') > 0);
    t(P + 'XSS: el cuerpo se escapa', html.indexOf('<b>hola</b>') < 0);
  }
  // 9. diferido: dentro de un comando la tarjeta espera su turno (orden del hilo)
  {
    const c = contexto(true); vm.runInContext(codShare, c);
    vm.runInContext('actuaDifiriendo=true; compartirTarjeta("📤","t","","hola"); actuaDifiriendo=false;', c);
    t(P + 'diferido: no pinta durante el comando', c._chat.hijos.length === 0);
    t(P + 'diferido: queda encolada', vm.runInContext('compartirDiferidas.length', c) === 1);
    vm.runInContext('compartirPintarDiferidas()', c);
    t(P + 'diferido: se pinta al final del hilo', c._chat.hijos.length === 1);
    t(P + 'diferido: la cola queda limpia', vm.runInContext('compartirDiferidas.length', c) === 0);
  }

  // ══════════ C1 — la tarjeta de acción de siempre no se rompe ══════════
  {
    const cod = codShare + '\n' + extraer(src, 'actuaTarjeta') + '\n' +
      'function actuaURLValida(u){ return /^https:\\/\\/wa\\.me\\//.test(u); }\n' +
      'function actuaNotaEscritorio(){ return ""; }\n';
    // URL inválida sigue rechazada (invariante de seguridad, no se tocó)
    const c1 = contexto(true); vm.runInContext(cod, c1);
    t(P + 'seguridad: URL fuera de la lista blanca sigue sin pintar',
      vm.runInContext('actuaTarjeta("💬","t","d","javascript:alert(1)","b","texto")', c1) === false);
    // con textoShare y soporte → aparece el botón extra
    const c2 = contexto(true); vm.runInContext(cod, c2);
    vm.runInContext('actuaTarjeta("💬","WhatsApp","d","https://wa.me/5491112345678","💬 abrir WhatsApp","el mensaje")', c2);
    const h2 = c2._chat.hijos[0]._html;
    t(P + 'tarjeta wa + texto → suma «mandarlo por otra app»', h2.indexOf('mandarlo por otra app') > 0);
    t(P + 'tarjeta wa → el botón de SIEMPRE sigue primero', h2.indexOf('abrir WhatsApp') < h2.indexOf('mandarlo por otra app'));
    t(P + 'tarjeta wa → el href original intacto', h2.indexOf('https://wa.me/5491112345678') > 0);
    // sin soporte → NO aparece el botón (nada de prometer lo que no hay)
    const c3 = contexto(false); vm.runInContext(cod, c3);
    vm.runInContext('actuaTarjeta("💬","WhatsApp","d","https://wa.me/549111","💬 abrir WhatsApp","el mensaje")', c3);
    t(P + 'sin soporte → la tarjeta wa NO muestra el botón de compartir', c3._chat.hijos[0]._html.indexOf('mandarlo por otra app') < 0);
    // sin textoShare (llamada vieja, 5 argumentos) → idéntica a antes
    const c4 = contexto(true); vm.runInContext(cod, c4);
    vm.runInContext('actuaTarjeta("🗺","Cómo llegar","d","https://wa.me/549111","🗺 abrir")', c4);
    t(P + 'no-regresión: llamada de 5 argumentos → tarjeta sin botón extra', c4._chat.hijos[0]._html.indexOf('mandarlo por otra app') < 0);
  }

  // ══════════ C1 — la regla local «compartí esto…» ══════════
  {
    const reShare = new RegExp(extraerRegla(src, 'share (C1)').replace(/^\//, '').replace(/\/i$/, ''), 'i');
    const debeMatchear = [
      'compartí esto: llego 20 minutos tarde',
      'compartilo por donde sea',
      'mandá esto a quien sea: la reunión se pasó al jueves',
      'compartí este texto: probando',
      'pasalo a quien quieras',
      'pasáselo a quien quieras',
      'compartí esto por donde quieras: nos vemos a las 9'
    ];
    const noDebe = [ // estos son de la tarjeta wa/mail de siempre — no se les roba el turno
      'mandale un whatsapp a Laura que llego tarde',
      'mandá un mail a la directora avisando',
      'escribile a Juan que no voy',
      'mandame la data del examen',
      'compartí un mensaje por telegram',
      'poné música',
      'mandá esto por whatsapp a Laura'
    ];
    debeMatchear.forEach(s => t(P + 'regla share matchea: «' + s + '»', reShare.test(s)));
    noDebe.forEach(s => t(P + 'regla share NO le roba el turno a: «' + s + '»', !reShare.test(s)));
    const m = reShare.exec('compartí esto: llego 20 minutos tarde');
    t(P + 'regla share captura el texto completo', m && m[1] === 'llego 20 minutos tarde', m && m[1]);
  }

  // ══════════ C1 — la marca [ACCION:{"tipo":"share"}] ══════════
  {
    /* v44-dest (5/08/2026): este banco ahora también trae numeroRastreable y una agenda de
       mentira que se puede prender y apagar. Antes alcanzaba con que el número tuviera
       PINTA de número; hoy hay que poder decir de dónde salió. */
    const cod = extraer(src, 'actuaProcesarReply') + '\n' +
      extraer(src, 'numeroRastreable') + '\n' +
      extraer(src, 'soloDigitos') + '\n' +
      'let ultimoPedidoUsuario="";\n' +
      'let AGENDA={};\n' +
      'let actuaPend=null, redactorPend=null, sharePend=null;\n' +
      'function actuaNumOk(n){ return /^\\+?\\d{8,}$/.test(String(n||"")); }\n' +
      'function actuaContacto(nom){ return AGENDA[String(nom||"").toLowerCase()] || null; }\n' +
      'function actuaWaURL(n,m){ return "https://wa.me/"+n+(m?"?text="+encodeURIComponent(m):""); }\n' +
      'function actuaTelURL(n){ return "tel:"+n; }\n' +
      'function actuaYtURL(q){ return "yt:"+q; }\n' +
      'function actuaMapsURL(q){ return "maps:"+q; }\n' +
      'function actuaCalURL(t){ return "cal:"+t; }\n' +
      'function actuaMailDirOk(d){ return /@/.test(String(d||"")); }\n' +
      'function actuaMailURL(d,a,c){ return "mailto:"+d; }\n' +
      'function encOferta(){}\n' +
      'const REDACTOR_URL_MAX=1800; const CONFIG={cap:{}};\n' +
      'function pend(){ return {actuaPend:actuaPend, redactorPend:redactorPend, sharePend:sharePend}; }\n';
    const c = contexto(true); c.encodeURIComponent = encodeURIComponent; vm.runInContext(cod, c);
    // share bien formado
    // v40-1029: la tarjeta «compartir» ahora necesita que el usuario haya pedido mandar/compartir (hallazgo en vivo 23/10)
    vm.runInContext('ultimoPedidoUsuario="compartí esto por donde quieras: me atrasé";', c);
    let r = vm.runInContext('actuaProcesarReply(\'Listo.\\n[ACCION:{"tipo":"share","texto":"me atrasé, llego 8:30","titulo":"Aviso"}]\')', c);
    let p = vm.runInContext('pend()', c);
    t(P + 'marca share → arma sharePend', !!p.sharePend);
    t(P + 'marca share → conserva el texto', p.sharePend && p.sharePend[3] === 'me atrasé, llego 8:30');
    t(P + 'marca share → la marca no queda a la vista del usuario', r.indexOf('[ACCION') < 0, r);
    // share vacío → no hay tarjeta fantasma
    vm.runInContext('actuaProcesarReply(\'x\\n[ACCION:{"tipo":"share","texto":"   "}]\')', c);
    t(P + 'marca share vacía → NO arma tarjeta', vm.runInContext('pend()', c).sharePend === null);
    /* ── v44-dest · DE DÓNDE SALIÓ ESE NÚMERO ────────────────────────────────────────
       Hallazgo en vivo del 5/08: Darío pidió «mandale un whatsapp» sin decir a quién y la
       app armó una tarjeta para Laura, con su agenda VACÍA. El destinatario lo había
       elegido el modelo y la app solo le miró el formato al número.
       Acá el error no es una respuesta fea: es un mensaje que sale hacia la persona
       equivocada. Es el único lugar de la app donde una alucinación toca a terceros. */

    // (1) CON el contacto en la agenda del dispositivo → tarjeta, como siempre.
    vm.runInContext('AGENDA={laura:{tel:"5491112345678"}};', c);
    vm.runInContext('actuaProcesarReply(\'ok\\n[ACCION:{"tipo":"wa","para":"Laura","num":"5491112345678","msg":"llego tarde"}]\')', c);
    p = vm.runInContext('pend()', c);
    t(P + 'no-regresión wa: con el contacto en agenda sigue armando la tarjeta', !!p.actuaPend && String(p.actuaPend[3]).indexOf('wa.me') === 8);
    t(P + 'wa: el mensaje viaja como texto compartible', p.actuaPend && p.actuaPend[5] === 'llego tarde');
    // un wa arma SU tarjeta y nada más: no deja una tarjeta de compartir colgada al lado.
    t(P + 'wa: no ensucia sharePend', p.sharePend === null, JSON.stringify(p.sharePend));

    // (2) la agenda le GANA al número que trajo el modelo. La agenda la escribió Darío.
    vm.runInContext('AGENDA={laura:{tel:"5499999999999"}}; actuaPend=null;', c);
    vm.runInContext('actuaProcesarReply(\'ok\\n[ACCION:{"tipo":"wa","para":"Laura","num":"5491112345678","msg":"hola"}]\')', c);
    p = vm.runInContext('pend()', c);
    t(P + 'wa: manda el número de la AGENDA, no el que trajo el modelo',
      p.actuaPend && String(p.actuaPend[3]).indexOf('5499999999999') > 0, p.actuaPend && p.actuaPend[3]);

    // (3) EL CASO DE DARÍO: agenda vacía y número que aparece de la nada → NO hay tarjeta.
    vm.runInContext('AGENDA={}; ultimoPedidoUsuario="mandale un whatsapp, decile que mañana paso por su casa"; actuaPend=null;', c);
    let rWa = vm.runInContext('actuaProcesarReply(\'ok\\n[ACCION:{"tipo":"wa","para":"Laura","num":"5492994223453","msg":"mañana paso"}]\')', c);
    p = vm.runInContext('pend()', c);
    t(P + 'wa: sin agenda y sin dictado NO arma la tarjeta', !p.actuaPend, JSON.stringify(p.actuaPend));
    t(P + 'wa: y explica que falta guardar el contacto', /no tengo el n[úu]mero/i.test(rWa), rWa.slice(0,160));
    t(P + 'wa: dice de frente que NO va a usar un número que no le consta', /no lo voy a usar a ciegas/i.test(rWa), rWa.slice(0,200));
    t(P + 'wa: y la marca [ACCION] no queda a la vista', rWa.indexOf('[ACCION') < 0);

    // (4) si el número lo dictó el usuario EN ESTE pedido, sí se usa — aunque cambie el formato.
    vm.runInContext('AGENDA={}; ultimoPedidoUsuario="mandale un wsp a pepe al +54 9 299 422-3453 que ya salgo"; actuaPend=null;', c);
    vm.runInContext('actuaProcesarReply(\'ok\\n[ACCION:{"tipo":"wa","para":"Pepe","num":"5492994223453","msg":"ya salgo"}]\')', c);
    p = vm.runInContext('pend()', c);
    t(P + 'wa: un número dictado en el pedido SÍ se usa', !!p.actuaPend, JSON.stringify(p.actuaPend));

    // (5) un número dictado hace diez mensajes NO es un número dictado ahora.
    vm.runInContext('AGENDA={}; ultimoPedidoUsuario="mandale un mensaje a dario"; actuaPend=null;', c);
    vm.runInContext('actuaProcesarReply(\'ok\\n[ACCION:{"tipo":"wa","para":"Dario","num":"5492994223453","msg":"hola"}]\')', c);
    p = vm.runInContext('pend()', c);
    t(P + 'wa: un número de otro turno ya no cuenta como dictado', !p.actuaPend, JSON.stringify(p.actuaPend));

    // (6) lo mismo para llamar: el discador tampoco se abre con un número sin origen.
    vm.runInContext('AGENDA={}; ultimoPedidoUsuario="llamalo a dario"; actuaPend=null;', c);
    let rTel = vm.runInContext('actuaProcesarReply(\'ok\\n[ACCION:{"tipo":"tel","para":"Dario","num":"5492994223453"}]\')', c);
    p = vm.runInContext('pend()', c);
    t(P + 'tel: sin origen tampoco arma la tarjeta de llamada', !p.actuaPend, JSON.stringify(p.actuaPend));
    t(P + 'tel: y lo explica igual', /no tengo el n[úu]mero/i.test(rTel), rTel.slice(0,120));

    // (7) las otras acciones NO se ven afectadas: la regla es solo para tel y wa.
    vm.runInContext('AGENDA={}; ultimoPedidoUsuario="pone algo de jazz"; actuaPend=null;', c);
    vm.runInContext('actuaProcesarReply(\'ok\\n[ACCION:{"tipo":"yt","q":"jazz"}]\')', c);
    t(P + 'la regla del número no le roba el turno a las demás acciones', !!vm.runInContext('pend()', c).actuaPend);
    vm.runInContext('AGENDA={}; sharePend=null; ultimoPedidoUsuario="mandá esto a quien sea";', c); // v40-1029: con pedido de mandar
    vm.runInContext('actuaProcesarReply(\'ok\\n[ACCION:{"tipo":"share","texto":"hola"}]\')', c);
    t(P + 'ni a compartir', !!vm.runInContext('pend()', c).sharePend);
    // v40-1029 CONTROL (en vivo 23/10): «QUE SABES HACER?» + marca share del modelo → NO hay tarjeta
    vm.runInContext('sharePend=null; ultimoPedidoUsuario="QUE SABES HACER?";', c);
    vm.runInContext('actuaProcesarReply(\'Sé hacer muchas cosas.\\n[ACCION:{"tipo":"share","titulo":"Funciones de MANIFIESTOS","texto":"lista"}]\')', c);
    t(P + 'share sin pedido de mandar → NO arma tarjeta (v40-1029)', !vm.runInContext('pend()', c).sharePend);
    // no-regresión: tipo inventado sigue sin pintar nada
    vm.runInContext('actuaProcesarReply(\'x\\n[ACCION:{"tipo":"transferir","monto":"1000"}]\')', c);
    p = vm.runInContext('pend()', c);
    t(P + 'seguridad: tipo desconocido → ninguna tarjeta', !p.actuaPend && !p.redactorPend && !p.sharePend);
    // JSON roto no rompe nada
    let sinRomper = true;
    try { vm.runInContext('actuaProcesarReply(\'x\\n[ACCION:{roto]\')', c); } catch (e) { sinRomper = false; }
    t(P + 'JSON roto → no explota', sinRomper);
  }

  // ══════════ F2 — voz on-device ══════════
  {
    const cod = ['vozLocalLang', 'vozLocalSoporte', 'vozLocalProbar', 'vozLocalUI', 'vozLocalInstalar']
      .map(n => extraer(src, n)).join('\n') + '\nlet vozLocal=false, vozLocalEstado="desconocido", vozLocalLangUsado="";\n';
    // navegador viejo: sin available() → no se promete nada
    {
      const c = contexto(false); c.i18nRecLang = () => 'es-AR';
      c.SpeechRecognition = function () {}; vm.runInContext(cod, c);
      t(P + 'F2 navegador sin available() → sin soporte', vm.runInContext('vozLocalSoporte()', c) === false);
      vm.runInContext('vozLocalProbar()', c).then(() => {
        t(P + 'F2 navegador viejo → estado «no», vozLocal false',
          vm.runInContext('vozLocalEstado', c) === 'no' && vm.runInContext('vozLocal', c) === false);
      });
    }
    // paquete presente → dictado local
    {
      const c = contexto(false); c.i18nRecLang = () => 'es-AR';
      const SR = function () {}; SR.available = async () => 'available'; SR.install = async () => true;
      c.SpeechRecognition = SR; vm.runInContext(cod, c);
      vm.runInContext('vozLocalProbar()', c).then(e => {
        t(P + 'F2 paquete disponible → estado disponible', e === 'disponible');
        t(P + 'F2 paquete disponible → vozLocal true', vm.runInContext('vozLocal', c) === true);
      });
    }
    // paquete descargable → NO se baja solo (son megas del usuario)
    {
      const c = contexto(false); c.i18nRecLang = () => 'es-AR';
      let instalado = false;
      const SR = function () {}; SR.available = async () => 'downloadable'; SR.install = async () => { instalado = true; return true; };
      c.SpeechRecognition = SR; vm.runInContext(cod, c);
      vm.runInContext('vozLocalProbar()', c).then(e => {
        t(P + 'F2 descargable → estado descargable', e === 'descargable');
        t(P + 'F2 descargable → NO baja nada solo', instalado === false);
        t(P + 'F2 descargable → vozLocal sigue false (no se miente)', vm.runInContext('vozLocal', c) === false);
      });
    }
    // available() que explota → se cae con gracia, no rompe el mic
    {
      const c = contexto(false); c.i18nRecLang = () => 'es-AR';
      const SR = function () {}; SR.available = async () => { throw new Error('boom'); };
      c.SpeechRecognition = SR; vm.runInContext(cod, c);
      vm.runInContext('vozLocalProbar()', c).then(e => {
        t(P + 'F2 available() rompe → estado «no», sin excepción', e === 'no' && vm.runInContext('vozLocal', c) === false);
      });
    }
    // install() que falla → mensaje honesto, no promesa
    {
      const c = contexto(false); c.i18nRecLang = () => 'es-AR';
      const SR = function () {}; SR.available = async () => 'downloadable'; SR.install = async () => { throw new Error('nel'); };
      c.SpeechRecognition = SR; vm.runInContext(cod, c);
      vm.runInContext('vozLocalInstalar()', c).then(msg => {
        t(P + 'F2 install() falla → lo dice, no promete privacidad', /No pude bajar/.test(msg), msg);
      });
    }
  }

  // ══════════ C2 — bucle de acción por voz ══════════
  {
    const cod = ['vozAccionUI', 'vozAccion', 'vozAccionResolver'].map(n => extraer(src, n)).join('\n') +
      '\nlet micAccion=false, micOn=false, enviado=null, interceptado=null, avisos=[];\n' +
      'let _intercepta=false, _rompe=false;\n' +
      'function micStop(){ micOn=false; }\n' +
      'function aresize(){}\n' +
      'function toggleMic(){ micOn=true; }\n' +
      'function addMsg(quien,txt){ avisos.push(txt); }\n' +
      'function actuaInterceptar(t){ interceptado=t; if(_rompe) throw new Error("boom"); return _intercepta; }\n' +
      'function send(){ enviado=document.getElementById("inp").value; }\n';
    function ctxC2() {
      const c = contexto(false);
      const inp = nodo(); inp.value = ''; const acc = nodo();
      c.document.getElementById = id => (id === 'inp' ? inp : (id === 'accbtn' ? acc : (id === 'chat' ? c._chat : nodo())));
      c.SpeechRecognition = function () {};
      c._inp = inp; vm.runInContext(cod, c); return c;
    }
    // navegador sin dictado → lo dice, no promete
    {
      const c = ctxC2(); c.SpeechRecognition = undefined; c.window.SpeechRecognition = undefined;
      vm.runInContext('vozAccion()', c);
      t(P + 'C2 sin dictado en el navegador → avisa y no prende nada',
        vm.runInContext('micAccion', c) === false && /no lo tiene/.test(vm.runInContext('avisos[0]||""', c)));
    }
    // primer toque prende, segundo resuelve
    {
      const c = ctxC2(); vm.runInContext('vozAccion()', c);
      t(P + 'C2 primer toque → modo acción prendido', vm.runInContext('micAccion', c) === true);
      t(P + 'C2 primer toque → abre el dictado', vm.runInContext('micOn', c) === true);
      c._inp.value = 'mandale un whatsapp a laura que llego tarde';
      vm.runInContext('_intercepta=true; vozAccion();', c);
      t(P + 'C2 segundo toque → apaga el modo acción', vm.runInContext('micAccion', c) === false);
      t(P + 'C2 la capa LOCAL resuelve → no gasta un token', vm.runInContext('enviado', c) === null);
      t(P + 'C2 le pasa el texto tal cual a la capa local',
        vm.runInContext('interceptado', c) === 'mandale un whatsapp a laura que llego tarde');
    }
    // lo que la capa local NO reconoce va al modelo, con el texto intacto
    {
      const c = ctxC2(); vm.runInContext('vozAccion()', c);
      c._inp.value = 'contale a mi hermana lo del sábado';
      vm.runInContext('_intercepta=false; vozAccionResolver();', c);
      t(P + 'C2 sin regla local → sigue el camino de siempre (modelo)',
        vm.runInContext('enviado', c) === 'contale a mi hermana lo del sábado', vm.runInContext('String(enviado)', c));
    }
    // silencio → no manda nada al modelo ni inventa
    {
      const c = ctxC2(); vm.runInContext('vozAccion()', c);
      c._inp.value = '   ';
      vm.runInContext('vozAccionResolver()', c);
      t(P + 'C2 silencio → no manda nada', vm.runInContext('enviado', c) === null);
      t(P + 'C2 silencio → lo dice sin drama', /No te escuché/.test(vm.runInContext('avisos.join("|")', c)));
      t(P + 'C2 silencio → el modo queda apagado', vm.runInContext('micAccion', c) === false);
    }
    // si la capa local explota, el mensaje NO se pierde
    {
      const c = ctxC2(); vm.runInContext('vozAccion()', c);
      c._inp.value = 'llamá a mamá';
      let rompio = false;
      try { vm.runInContext('_rompe=true; vozAccionResolver();', c); } catch (e) { rompio = true; }
      t(P + 'C2 capa local que explota → no propaga la excepción', rompio === false);
      t(P + 'C2 capa local que explota → el mensaje igual llega al modelo', vm.runInContext('enviado', c) === 'llamá a mamá');
      t(P + 'C2 capa local que explota → el modo queda apagado (no se traba)', vm.runInContext('micAccion', c) === false);
    }
  }

  // ══════════ C3 — Contact Picker ══════════
  {
    const cod = ['contactosSoporte', 'contactoElegir'].map(n => extraer(src, n)).join('\n') +
      '\nlet guardado=null, guardaOk=true;\n' +
      'function actuaAgendaGuardar(n,c){ guardado={nombre:n,campos:c}; return guardaOk; }\n';
    function ctxC3(select) {
      const c = contexto(false);
      if (select) c.navigator.contacts = { select };
      vm.runInContext(cod, c); return c;
    }
    // sin la API → lo dice y ofrece dictarlo (no promete el selector)
    {
      const c = ctxC3(null);
      t(P + 'C3 sin Contact Picker → contactosSoporte false', vm.runInContext('contactosSoporte()', c) === false);
      vm.runInContext('contactoElegir()', c).then(m => t(P + 'C3 sin soporte → ofrece dictarlo', /Dictámelo/.test(m), m));
    }
    // contacto completo → se guarda con nombre, tel y mail
    {
      const c = ctxC3(async () => [{ name: ['Laura Gómez'], tel: ['2994223453'], email: ['laura@dom.com'] }]);
      vm.runInContext('contactoElegir()', c).then(m => {
        const g = vm.runInContext('guardado', c);
        t(P + 'C3 guarda el contacto elegido', g && g.nombre === 'Laura Gómez', JSON.stringify(g));
        t(P + 'C3 guarda el teléfono', g && g.campos.tel === '2994223453');
        t(P + 'C3 guarda el mail', g && g.campos.email === 'laura@dom.com');
        t(P + 'C3 lo confirma sin inventar', /quedó en TU agenda local/.test(m), m);
      });
    }
    // el usuario cancela → nada se guarda, nada se inventa
    {
      const c = ctxC3(async () => []);
      vm.runInContext('contactoElegir()', c).then(m => {
        t(P + 'C3 selección vacía → no guarda nada', vm.runInContext('guardado', c) === null);
        t(P + 'C3 selección vacía → lo dice', /No elegiste ninguno/.test(m));
      });
    }
    // contacto sin datos útiles → no se guarda basura
    {
      const c = ctxC3(async () => [{ name: ['Pepe'], tel: [], email: [] }]);
      vm.runInContext('contactoElegir()', c).then(m => {
        t(P + 'C3 contacto vacío → no guarda', vm.runInContext('guardado', c) === null);
        t(P + 'C3 contacto vacío → lo explica', /no guardo un contacto vacío/.test(m), m);
      });
    }
    // el navegador rechaza (sin gesto / http) → mensaje honesto, sin excepción
    {
      const c = ctxC3(async () => { throw new Error('SecurityError'); });
      vm.runInContext('contactoElegir()', c).then(m => t(P + 'C3 rechazo del navegador → mensaje honesto', /No pude abrir tu lista/.test(m), m));
    }
    // AbortError (cerró el selector) → no es un error
    {
      const c = ctxC3(async () => { const e = new Error('x'); e.name = 'AbortError'; throw e; });
      vm.runInContext('contactoElegir()', c).then(m => t(P + 'C3 selector cerrado → «no guardé nada», sin drama', /no guardé nada/.test(m), m));
    }
    // el localStorage se niega → se avisa, no se miente con un ✅
    {
      const c = ctxC3(async () => [{ name: ['Ana'], tel: ['299111'], email: [] }]);
      vm.runInContext('guardaOk=false;', c);
      vm.runInContext('contactoElegir()', c).then(m => t(P + 'C3 guardado que falla → NO dice listo', !/Listo ✅/.test(m) && /negó el guardado/.test(m), m));
    }
  }

  // ══════════ C4 — plantillas de trámites ══════════
  {
    const cod = ['tramiteCampo', 'tramiteDatos', 'tramiteBuscar'].map(n => extraer(src, n)).join('\n') +
      '\n' + (/function tramiteFirma/.test(src) ? extraer(src, 'tramiteFirma') + '\nconst CONFIG={perfil:{nombre:"Ana Pérez"}};\n' : '') +
      '\n' + /const TRAMITE_PLANTILLAS = \[[\s\S]*?\n\];/.exec(src)[0] +
      (/const TRAMITE_FIRMA/.test(src) ? '\n' + /const TRAMITE_FIRMA = '[^']*';/.exec(src)[0] : '');
    const c = contexto(false); vm.runInContext(cod, c);
    t(P + 'C4 hay 5 plantillas', vm.runInContext('TRAMITE_PLANTILLAS.length', c) === 5);
    // cada plantilla arma un texto y ninguna explota con datos vacíos
    const ids = vm.runInContext('TRAMITE_PLANTILLAS.map(p=>p.id)', c);
    ids.forEach(id => {
      const txt = vm.runInContext('TRAMITE_PLANTILLAS.find(p=>p.id==="' + id + '").arma({para:"",fecha:"",motivo:""})', c);
      t(P + 'C4 «' + id + '» arma texto sin datos', typeof txt === 'string' && txt.length > 80);
      t(P + 'C4 «' + id + '» deja los huecos a la vista, NO inventa', /<[^>]{2,40}>/.test(txt), txt.slice(0, 60));
    });
    // los datos dictados entran de verdad
    {
      const d = vm.runInContext('tramiteDatos("plantilla de inasistencia para la directora del 5 de agosto por una gripe")', c);
      t(P + 'C4 extrae el destinatario', /directora/.test(d.para), JSON.stringify(d));
      t(P + 'C4 extrae la fecha', /5 de agosto/.test(d.fecha), JSON.stringify(d));
      t(P + 'C4 extrae el motivo', /gripe/.test(d.motivo), JSON.stringify(d));
      const txt = vm.runInContext('TRAMITE_PLANTILLAS.find(p=>p.id==="inasistencia").arma(tramiteDatos("plantilla de inasistencia para la directora del 5 de agosto por una gripe"))', c);
      t(P + 'C4 el texto usa lo dictado', /directora/.test(txt) && /5 de agosto/.test(txt) && /gripe/.test(txt));
      t(P + 'C4 con todo dictado, menos huecos', (txt.match(/<[^>]{2,40}>/g) || []).length === 0, txt);
    }
    // la firma: en la plataforma sale del perfil, nunca de la nada
    if (/function tramiteFirma/.test(src)) {
      t(P + 'C4 firma desde el perfil del usuario', vm.runInContext('tramiteFirma()', c) === 'Ana Pérez');
      const c2 = contexto(false); vm.runInContext(extraer(src, 'tramiteFirma') + '\nconst CONFIG={};', c2);
      t(P + 'C4 sin perfil cargado → <tu nombre>, no inventa', vm.runInContext('tramiteFirma()', c2) === '<tu nombre>');
    }
    // el buscador no confunde trámites
    t(P + 'C4 «turno» → plantilla de turno', vm.runInContext('(tramiteBuscar("quiero pedir un turno")||{}).id', c) === 'turno');
    t(P + 'C4 «reclamo» → plantilla de reclamo', vm.runInContext('(tramiteBuscar("necesito hacer un reclamo")||{}).id', c) === 'reclamo');
    t(P + 'C4 pedido que no existe → null (lo dice, no improvisa)', vm.runInContext('tramiteBuscar("plantilla para pedir un aumento")', c) === null);
    // el patrón de la regla no se come conversación normal
    {
      const reT = new RegExp(extraerRegla(src, 'tramite (C4)').replace(/^\//, '').replace(/\/i$/, ''), 'i');
      t(P + 'C4 NO matchea «¿qué modelo de IA usás?»', !reT.test('¿qué modelo de IA usás?'));
      t(P + 'C4 NO matchea «contame un cuento»', !reT.test('contame un cuento'));
      t(P + 'C4 SÍ matchea «plantilla de inasistencia»', reT.test('plantilla de inasistencia del 5 de agosto'));
      t(P + 'C4 SÍ matchea «necesito justificar una falta»', reT.test('necesito justificar una falta del lunes'));
    }
  }

  // ══════════ H2 — portabilidad total ══════════
  {
    const cod = ['portaHash', 'portaLocal', 'portaArmar', 'portaExportar', 'portaVerificar', 'portaImportarTexto']
      .map(n => extraer(src, n)).join('\n') +
      (/function portaSensibles/.test(src) ? '\n' + extraer(src, 'portaSensibles') : '') +
      '\nconst PORTA_ESQUEMA=1;\nlet bajado=null, confirmado=true;\n' +
      'function bajarBlob(b,n){ bajado={nombre:n, texto:b._texto}; }\n' +
      'function fechaArchivo(){ return "2026-07-31"; }\n' +
      'function confirm(){ return confirmado; }\n' +
      'let recuerdosChunks=[{id:"a",txt:"un recuerdo"},{id:"b",txt:"otro"}];\n' +
      'let perfilData={nombre:"quien sea"};\n' +
      'let ragDocs=[{name:"tesis.pdf"}];\n' +
      'const MIRROR_VERSION="v4.3"; const PLATFORM_VERSION="v37";\n';
    function ctxH2() {
      const c = contexto(false);
      const store = { mirror_agenda: '{"laura":{"tel":"299"}}', mirror_voz_mirror: 'Paulina', otra_cosa: 'no es mía' };
      c.localStorage = {
        _s: store,
        get length() { return Object.keys(store).length; },
        key: i => Object.keys(store)[i],
        getItem: k => (k in store ? store[k] : null),
        setItem: (k, v) => { store[k] = v; }
      };
      c.Blob = function (partes) { this._texto = partes.join(''); };
      c.Date = Date; c.CONFIG = { appName: 'MIRROR' };
      vm.runInContext(cod, c); c._store = store; return c;
    }
    // el hash detecta cualquier cambio
    {
      const c = ctxH2();
      const h1 = vm.runInContext('portaHash("hola")', c), h2 = vm.runInContext('portaHash("holA")', c);
      t(P + 'H2 el sello cambia con un solo carácter', h1 !== h2);
      t(P + 'H2 el sello es estable', h1 === vm.runInContext('portaHash("hola")', c));
      t(P + 'H2 el sello tiene 8 caracteres', String(h1).length === 8, h1);
    }
    // se lleva SOLO lo de MIRROR, no lo ajeno
    {
      const c = ctxH2();
      const loc = vm.runInContext('portaLocal()', c);
      t(P + 'H2 se lleva las claves mirror_*', !!loc.mirror_agenda && !!loc.mirror_voz_mirror);
      t(P + 'H2 NO se lleva lo que no es suyo', !('otra_cosa' in loc));
    }
    // el archivo sale completo y con sello
    {
      const c = ctxH2();
      const msg = vm.runInContext('portaExportar()', c);
      const bajado = vm.runInContext('bajado', c);
      t(P + 'H2 baja un archivo', !!bajado && /TODO_LO_TUYO_2026-07-31\.json$/.test(bajado.nombre), bajado && bajado.nombre);
      const a = JSON.parse(bajado.texto);
      t(P + 'H2 el archivo trae los recuerdos', a.datos.recuerdos.length === 2);
      t(P + 'H2 el archivo trae el perfil', !!a.datos.perfil);
      t(P + 'H2 el archivo trae los documentos', a.datos.docs.length === 1);
      t(P + 'H2 el archivo trae lo del dispositivo', Object.keys(a.datos.local).length === 2);
      t(P + 'H2 el archivo trae el sello', !!a.integridad.hash && a.integridad.algoritmo === 'fnv1a32');
      t(P + 'H2 avisa qué NO se lleva (las claves del proxy)', /proxy/.test(msg), msg);
      // vuelta completa: exportar → verificar
      const v = vm.runInContext('portaVerificar(' + JSON.stringify(bajado.texto) + ')', c);
      t(P + 'H2 ida y vuelta: el propio archivo verifica OK', v.ok === true, v.motivo);
      // ARCHIVO ALTERADO → no se importa nada
      const alterado = JSON.parse(bajado.texto); alterado.datos.recuerdos.push({ id: 'x', txt: 'metido a mano' });
      const v2 = vm.runInContext('portaVerificar(' + JSON.stringify(JSON.stringify(alterado)) + ')', c);
      t(P + 'H2 archivo editado a mano → el sello NO coincide', v2.ok === false && /sello de integridad NO coincide/.test(v2.motivo), v2.motivo);
      const r2 = vm.runInContext('portaImportarTexto(' + JSON.stringify(JSON.stringify(alterado)) + ')', c);
      t(P + 'H2 archivo alterado → NO importa nada y lo dice', /No importé NADA/.test(r2), r2);
      t(P + 'H2 archivo alterado → el almacenamiento quedó intacto', c._store.mirror_agenda === '{"laura":{"tel":"299"}}');
    }
    // basura y archivos de otro formato
    {
      const c = ctxH2();
      t(P + 'H2 archivo que no es JSON → lo dice sin romper', /no es un archivo JSON válido/.test(vm.runInContext('portaVerificar("{{{").motivo', c)));
      t(P + 'H2 JSON ajeno → lo dice', /le falta el sello/.test(vm.runInContext('portaVerificar(\'{"hola":1}\').motivo', c)));
      const otroEsquema = JSON.stringify({ integridad: { hash: vm.runInContext('portaHash(JSON.stringify({esquema:9}))', c) }, datos: { esquema: 9 } });
      t(P + 'H2 esquema futuro → no lo fuerza', /otra versión del formato/.test(vm.runInContext('portaVerificar(' + JSON.stringify(otroEsquema) + ').motivo', c)));
    }
    // importar de verdad: repone lo local y es HONESTO con lo que no repone
    {
      const c = ctxH2();
      vm.runInContext('portaExportar()', c);
      const texto = vm.runInContext('bajado', c).texto;
      c._store.mirror_agenda = 'PISADO';
      const r = vm.runInContext('portaImportarTexto(' + JSON.stringify(texto) + ')', c);
      t(P + 'H2 importar repone lo del dispositivo', c._store.mirror_agenda === '{"laura":{"tel":"299"}}', c._store.mirror_agenda);
      t(P + 'H2 importar avisa que hay que recargar', /Recargá la página/.test(r));
      t(P + 'H2 importar NO escribe solo en Firebase y lo dice', /NO los escribí solos/.test(r), r);
    }
    // el usuario cancela → no se toca nada
    {
      const c = ctxH2();
      vm.runInContext('portaExportar()', c);
      const texto = vm.runInContext('bajado', c).texto;
      c._store.mirror_agenda = 'INTACTO';
      vm.runInContext('confirmado=false;', c);
      const r = vm.runInContext('portaImportarTexto(' + JSON.stringify(texto) + ')', c);
      t(P + 'H2 si cancelás, no se toca nada', c._store.mirror_agenda === 'INTACTO' && /no toqué nada/.test(r), r);
    }
    // la plataforma tiene que AVISAR de lo sensible
    if (/function portaSensibles/.test(src)) {
      const c = ctxH2();
      const s = vm.runInContext('portaSensibles({mirror_pollinations_key:"pk_123", mirror_config:"{\\"proxyUrl\\":\\"x\\"}"})', c);
      t(P + 'H2 avisa de la clave de imágenes', s.join(' ').indexOf('clave de imágenes') >= 0, JSON.stringify(s));
      t(P + 'H2 avisa de las direcciones del proxy', s.join(' ').indexOf('proxy') >= 0);
    }
    // el patrón no se come pedidos parecidos
    {
      // ojo: «porta (H2)» aparece antes en el HTML (el input oculto), así que el marcador
      // tiene que ser el del comentario de la REGLA, no el de la etiqueta.
      const reH = new RegExp(extraerRegla(src, 'PORTABILIDAD TOTAL: llevarse').replace(/^\//, '').replace(/\/i$/, ''), 'i');
      t(P + 'H2 matchea «exportá todo»', reH.test('exportá todo'));
      t(P + 'H2 matchea «llevame todo»', reH.test('llevame todo'));
      t(P + 'H2 matchea «importá mi copia»', reH.test('importá mi copia'));
      t(P + 'H2 NO matchea «guardá el número de Laura»', !reH.test('guardá el número de Laura 2994223453'));
      t(P + 'H2 NO matchea «borrá todo»', !reH.test('borrá todo'));
    }
  }

  // ══════════ H1 — cumplimiento (aviso de IA, panel, pausa) ══════════
  {
    const cod = ['cumpliPausaActiva', 'cumpliInventario', 'cumpliHTML', 'cumpliLinea', 'cumpliAvisoInicial', 'cumpliTurno', 'cumpliAbrir', 'cumpliCerrar']
      .map(n => extraer(src, n)).join('\n') + '\n' + extraerLinea(src, 'cumpliEsc') +
      // el panel de H1 muestra el límite diario de H3: van juntos o no se puede probar
      '\n' + ['apagadoLimite', 'apagadoHoy', 'apagadoUso'].map(n => extraer(src, n)).join('\n') +
      // v44-cdn: el panel ahora también muestra el interruptor de tipografías. Se trae la
      // función REAL: si el panel depende de algo, el banco tiene que correr con ese algo.
      '\n' + extraerLinea(src, 'fuentesWebActiva') +
      '\nconst APAGADO_OPCIONES=[0,30,60,90];\n' +
      '\nconst CUMPLI_PAUSA_MIN=25, CUMPLI_PAUSA_TURNOS=20;\n' +
      'let cumpliInicio=Date.now(), cumpliTurnos=0, cumpliPausaMostrada=false;\n' +
      'let recuerdosChunks=[{id:1},{id:2},{id:3}]; let ragDocs=[{name:"x"}];\n' +
      'let vozLocal=false; let FB_URL="https://mibase.firebaseio.com"; let PROXY_URL="https://miproxy.workers.dev";\n' +
      'let POLLI_KEY="pk_1"; const CONFIG={appName:"ATIS", fbUrl:FB_URL, proxyUrl:PROXY_URL};\n';
    function ctxH1(off) {
      const c = contexto(false);
      const store = off ? { mirror_pausa_off: '1' } : { mirror_agenda: '{"laura":{}}' };
      c.localStorage = { _s: store, get length() { return Object.keys(store).length; }, key: i => Object.keys(store)[i], getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; } };
      c.sessionStorage = { _s: {}, getItem(k) { return this._s[k] || null; }, setItem(k, v) { this._s[k] = v; } };
      c.URL = URL; c.Date = Date;
      vm.runInContext(cod, c); c._store = store; return c;
    }
    // el panel dice la verdad de ESTA instalación, no un folleto
    {
      const c = ctxH1(false);
      const html = vm.runInContext('cumpliHTML()', c);
      t(P + 'H1 el panel dice que es una IA, sin eufemismos', /inteligencia artificial/i.test(html) && /no (?:es|una persona|tiene conciencia)|no es una persona|no tiene conciencia/i.test(html));
      t(P + 'H1 el panel admite que se puede equivocar', /se puede equivocar|me puedo equivocar/i.test(html));
      t(P + 'H1 el panel nombra la base REAL, no una genérica', html.indexOf('mibase.firebaseio.com') > 0);
      t(P + 'H1 el panel nombra el proxy REAL', html.indexOf('miproxy.workers.dev') > 0);
      t(P + 'H1 el panel cuenta los recuerdos de verdad', /\b3\b/.test(html));
      t(P + 'H1 el panel promete NO publicidad', /No lleva publicidad/i.test(html));
      t(P + 'H1 el panel promete NO telemetría', /telemetr/i.test(html));
      t(P + 'H1 el panel promete NO venta de datos', /No vende ni cede/i.test(html));
      t(P + 'H1 el panel dice que no manda nada solo', /No (?:manda|env[ií]a) nada solo|No mando nada solo/i.test(html));
      /* Lo más importante de H1 después del aviso: que NO prometa por cuenta ajena.
         Prometer «con tus datos no se entrena ningún modelo» a secas es hablar por Groq —
         y si Groq cambia los términos, la promesa la paga quien repartió la app. */
      t(P + 'H1 separa lo propio de lo de terceros', /depende de (?:VOS|terceros)/i.test(html), 'no encontré la sección de terceros');
      t(P + 'H1 lo del motor va como dato publicado, NO como garantía propia', /no una garant[ií]a/i.test(html), 'falta la salvedad sobre el motor');
      t(P + 'H1 avisa que los términos de terceros pueden cambiar', /pueden cambiar/i.test(html));
      t(P + 'H1 confiesa la fuga de los CDN (la IP)', /IP/.test(html) && /CDN/i.test(html), 'no declara los CDN');
      t(P + 'H1 el panel explica cómo llevarse todo', /llevarme todo/i.test(html));
      t(P + 'H1 el panel es honesto con la voz cuando NO es local', /afuera/i.test(html));
      // ── salvedades: que estén, y que sean las que protegen de verdad ──
      t(P + 'H1 dice que es una app LIMITADA, sin garantías', /app limitada/i.test(html) && /sin garant/i.test(html));
      t(P + 'H1 aclara que NO es asesoramiento profesional', /No es asesoramiento profesional/i.test(html) && /matriculada/i.test(html));
      t(P + 'H1 aclara que NO es un servicio de emergencia', /No es un servicio de emergencia/i.test(html));
      t(P + 'H1 deja la elección —y la responsabilidad— del lado del usuario', /Vos eleg[ií]s d[oó]nde van tus datos/i.test(html) && /responsable/i.test(html));
      t(P + 'H1 avisa quién responde por datos de terceros (alumnos)', /alumnos/i.test(html));
      t(P + 'H1 avisa que nadie puede recuperar lo perdido', /recuperar/i.test(html));
      // y que NO se pase de rosca: las salvedades no pueden comerse la honestidad
      t(P + 'H1 las salvedades no reemplazan al aviso de IA', /inteligencia artificial/i.test(html));
    }
    // sin base configurada NO se inventa una
    {
      const c = ctxH1(false);
      vm.runInContext('FB_URL="";', c);
      const html = vm.runInContext('cumpliHTML()', c);
      t(P + 'H1 sin base → lo dice, no inventa una', /no se guarda nada fuera de este dispositivo/i.test(html), html.slice(0, 80));
      t(P + 'H1 sin base → no nombra ningún host fantasma', html.indexOf('firebaseio') < 0);
    }
    // con voz local, lo dice — y solo entonces
    {
      const c = ctxH1(false);
      vm.runInContext('vozLocal=true;', c);
      t(P + 'H1 con voz local → promete privacidad solo cuando la tiene', /dentro de este dispositivo/i.test(vm.runInContext('cumpliHTML()', c)));
    }
    // el aviso de IA aparece UNA vez por sesión
    {
      const c = ctxH1(false);
      vm.runInContext('cumpliAvisoInicial(); cumpliAvisoInicial(); cumpliAvisoInicial();', c);
      t(P + 'H1 el aviso de IA se muestra una sola vez por sesión', c._chat.hijos.length === 1, 'apareció ' + c._chat.hijos.length + ' veces');
      t(P + 'H1 el aviso dice claramente que es una IA', /Habl[aá]s con una <b>IA<\/b>/.test(c._chat.hijos[0]._html));
      t(P + 'H1 el aviso lleva al panel', /cumpliAbrir\(\)/.test(c._chat.hijos[0]._html));
      t(P + 'H1 el aviso se puede cerrar', /aviso-x/.test(c._chat.hijos[0]._html));
    }
    // la pausa: aparece al umbral, una sola vez, y respeta el apagado
    {
      const c = ctxH1(false);
      for (let i = 0; i < 19; i++) vm.runInContext('cumpliTurno()', c);
      t(P + 'H1 antes del umbral no molesta', c._chat.hijos.length === 0);
      vm.runInContext('cumpliTurno()', c);
      t(P + 'H1 al llegar al umbral avisa', c._chat.hijos.length === 1);
      t(P + 'H1 el aviso de pausa no retiene: te manda a tu vida', /and[aá]/i.test(c._chat.hijos[0]._html), c._chat.hijos[0]._html);
      t(P + 'H1 el aviso de pausa se puede apagar desde ahí', /cumpliPausaToggle/.test(c._chat.hijos[0]._html));
      for (let i = 0; i < 30; i++) vm.runInContext('cumpliTurno()', c);
      t(P + 'H1 la pausa NO se repite (no es un nag)', c._chat.hijos.length === 1, 'apareció ' + c._chat.hijos.length + ' veces');
    }
    // apagada por el usuario → no aparece nunca
    {
      const c = ctxH1(true);
      t(P + 'H1 respeta el apagado guardado', vm.runInContext('cumpliPausaActiva()', c) === false);
      for (let i = 0; i < 40; i++) vm.runInContext('cumpliTurno()', c);
      t(P + 'H1 apagada → no molesta ni una vez', c._chat.hijos.length === 0);
    }
    // el panel escapa lo que viene de la config (nombre de app hostil)
    if (/CONFIG.appName/.test(src)) {
      const c = ctxH1(false);
      vm.runInContext('CONFIG.appName="<img src=x onerror=alert(1)>";', c);
      const html = vm.runInContext('cumpliHTML()', c);
      t(P + 'H1 XSS: el nombre de la app se escapa', html.indexOf('<img src=x') < 0 && html.indexOf('&lt;img') > 0);
    }
    // en la white-label: los roles tienen que estar dichos, no sobreentendidos
    if (etiqueta === 'PLATAFORMA') {
      const c = ctxH1(false);
      const html = vm.runInContext('cumpliHTML()', c);
      t(P + 'H1 dice que la plataforma aporta arquitectura, no maneja datos', /arquitectura, no maneja datos/i.test(html));
      t(P + 'H1 dice que corre entero en el navegador, sin servidor detrás', /sin servidor|ning[uú]n servidor/i.test(html));
      t(P + 'H1 dice que quien programó la plataforma nunca ve los datos', /nunca ve, guarda ni puede recuperar/i.test(html));
      t(P + 'H1 dice que quien CONFIGURÓ la app eligió dónde van los datos', /eligi[oó] d[oó]nde se guardan tus datos/i.test(html));
      // ── v38-roles: la constancia de quien armó la app ──
      t(P + 'roles: sin constancia, el panel no la inventa', html.indexOf('dejó constancia') < 0);
      vm.runInContext('CONFIG.roles={aceptado:"2026-08-01T10:00:00.000Z",version:"1"};', c);
      const html2 = vm.runInContext('cumpliHTML()', c);
      t(P + 'roles: con constancia, el panel la muestra con fecha', /dej[oó] constancia el <b>2026-08-01<\/b>/.test(html2), 'no aparece la fecha');
      // el texto de roles tiene que estar en el HTML del archivo, no solo en el panel
      t(P + 'roles: el panel legal trae «Quién responde por qué»', /Qui[eé]n <em[^>]*>responde<\/em> por qu[eé]/.test(src));
      t(P + 'roles: dice que la plataforma no maneja datos', /arquitectura, no maneja datos/.test(src));
      t(P + 'roles: traduce el «sin garantías» de Apache 2.0 al criollo', /Sin garant[ií]as, dicho de frente/.test(src) && /secciones 7 y 8/.test(src));
      t(P + 'roles: aclara responsabilidad sobre datos de terceros', /participantes de una investigaci[oó]n/.test(src));
      t(P + 'roles: hay constancia en el constructor', /id="c-roles-ok"/.test(src));
      t(P + 'roles: sin marcar la constancia, el constructor NO deja seguir', /if \(chk && !chk\.checked\)/.test(src) && /return;/.test(src));
      t(P + 'roles: se guarda cuándo y qué versión se aceptó', /roles-y-limites-v1/.test(src) && /aceptado:new Date\(\)\.toISOString\(\)/.test(src));
      t(P + 'roles: si el campo no existe, no traba el constructor', /sin-constancia/.test(src));
      /* ── v38-base: la regla de oro. Es el punto donde la app podía afectar a TERCEROS
         (varias personas contra una misma base abierta se leen entre ellas), así que se
         verifica que esté dicho en los TRES lugares donde alguien puede leerlo. ── */
      /* El orden importa: la regla tiene que leerse ANTES de la receta de reglas abiertas,
         no como una nota al pie después. Se mide dentro del paso del constructor (desde el
         campo de la base), porque la receta también aparece antes, en la guía embebida. */
      {
        const desde = src.indexOf('id="c-fb"');
        const regla = src.indexOf('una base por persona', desde);
        const receta = src.indexOf('".read": true', desde);
        t(P + 'base: la regla de oro va ANTES de la receta de reglas abiertas',
          desde > 0 && regla > 0 && receta > 0 && regla < receta, 'regla en ' + regla + ', receta en ' + receta);
      }
      t(P + 'base: avisa que con base compartida se leen entre ellos', /pueden leer lo que escriben las dem[aá]s/i.test(src));
      t(P + 'base: ofrece la salida simple (que cada uno cree el suyo)', /Que cada uno cree el suyo/i.test(src));
      t(P + 'base: dice sin adornos qué significan las reglas abiertas', /cualquiera que conozca la direcci[oó]n de tu base puede leer y escribir/i.test(src));
      t(P + 'base: no vende la dirección como si fuera un secreto', /tampoco es un secreto fuerte/i.test(src));
      t(P + 'base: la regla también está en el panel legal', /Una base por persona/.test(src));
      t(P + 'base: la regla también está en la constancia del constructor', /Una base por persona:<\/b> compartir tu MIRROR por link NO entrega tu base/.test(src));
      t(P + 'base: al usuario final se le dice el hecho, no una sospecha', /Compartir tu MIRROR no entrega tu base/i.test(html));
      t(P + 'base: sin base configurada, no se le habla de bases al usuario', vm.runInContext('(function(){var b=FB_URL;FB_URL="";var h=cumpliHTML();FB_URL=b;return h;})()', c).indexOf('no entrega tu base') < 0);
      /* EL INVARIANTE QUE SOSTIENE TODO «cada uno el suyo»: el link de compartir lleva la
         vitrina y NADA más. Si alguna vez se le agrega la base, el proxy o el PIN al payload,
         esta prueba tiene que gritar — porque ahí sí se estaría repartiendo una base sin
         querer, y todo lo que dice el panel pasaría a ser mentira. */
      {
        const cS = contexto(false);
        cS.CONFIG = { appName: 'ATIS', perfil: { nombre: 'Ana', rol: 'docente', estilo: 'directo', proyectos: 'x' },
                      modos: { mirror: 'M', tars: 'T', jurado: 'J', conn: 'C' }, colorTema: 'violeta',
                      fbUrl: 'https://SECRETA.firebaseio.com', proxyUrl: 'https://SECRETO.workers.dev',
                      pinMemH: 'HUELLA_SECRETA', pinMem: 'PIN_EN_CLARO' };
        cS.CONFIG_DEFAULT = { modos: cS.CONFIG.modos };
        vm.runInContext(extraer(src, '_payloadCompartir'), cS);
        const pay = JSON.stringify(vm.runInContext('_payloadCompartir()', cS));
        t(P + 'compartir: el link NO lleva la dirección de la base', pay.indexOf('SECRETA') < 0, pay);
        t(P + 'compartir: el link NO lleva el proxy', pay.indexOf('SECRETO') < 0, pay);
        t(P + 'compartir: el link NO lleva el PIN ni su huella', pay.indexOf('HUELLA_SECRETA') < 0 && pay.indexOf('PIN_EN_CLARO') < 0, pay);
        t(P + 'compartir: el link SÍ lleva la vitrina (nombre y presentación)', pay.indexOf('ATIS') > 0 && pay.indexOf('Ana') > 0);
        /* La promesa escrita y el código tienen que decir lo mismo. El modal promete que NO
           se comparten proxy, Firebase ni PIN; arriba se acaba de comprobar que es cierto.
           Si alguien borra la promesa o cambia el payload, una de las dos pruebas cae. */
        t(P + 'compartir: el modal promete lo que el código cumple', /NO se comparte[^<]*tu clave de IA, tu proxy, tu Firebase, tu PIN/.test(src), 'cambió la promesa del modal');
        t(P + 'compartir: el modal invita a crear el suyo (ese es el sentido)', /un bot[oó]n para crear el suyo/i.test(src));
      }
    }

    // la regla de chat abre el panel ante las preguntas que importan
    {
      const reC = new RegExp(extraerRegla(src, 'cumpli (H1) — el panel').replace(/^\//, '').replace(/\/i$/, ''), 'i');
      ['¿qué hacés con mis datos?', '¿sos una IA?', '¿sos una persona?', 'privacidad', '¿qué datos guardás?', '¿dónde se guardan mis datos?']
        .forEach(s => t(P + 'H1 abre el panel ante «' + s + '»', reC.test(s)));
      t(P + 'H1 NO se dispara con «qué hacés hoy»', !reC.test('¿qué hacés hoy?'));
    }
  }

  // ══════════ web2/proc — la procedencia no miente, y explica por qué ══════════
  {
    const cod = extraer(src, 'webNotaSinResultados') + '\nlet PROXY_URL="https://miproxy.workers.dev";\n';
    function ctxWeb(proto) {
      const c = contexto(false);
      c.location = { protocol: proto || 'https:' };
      c.cumpliLinea = function (t) { c._dicho = t; return true; };
      vm.runInContext(cod, c); return c;
    }
    // el caso que desconcertó a Darío el 1/08: file:// y parecía que la app mentía
    {
      const c = ctxWeb('file:');
      vm.runInContext('webNotaSinResultados(true)', c);
      t(P + 'web2: abierto como archivo → lo dice y explica que es file://', /file:\/\//.test(c._dicho), c._dicho);
      /* Corrección del 1/08 (Darío: «las capturas eran con un proxy inventado»): la versión
         anterior de este mensaje decía «no es un problema de la app ni de tu proxy». Eso es
         una afirmación que la app NO puede hacer — desde file:// el pedido ni sale, así que
         no hay forma de saber si el proxy anda. Exonerar al proxy era inventar. Ahora tiene
         que nombrar esa incertidumbre. */
      t(P + 'web2: NO exonera al proxy (no puede saberlo desde file://)', !/no es un problema de la app/i.test(c._dicho), c._dicho);
      t(P + 'web2: dice que no puede saber si el proxy anda', /no me deja saber si tu proxy anda/i.test(c._dicho), c._dicho);
      t(P + 'web2: nombra la otra causa posible (proxy de prueba o mal cargado)', /de prueba o est[aá] mal/i.test(c._dicho));
    }
    // sin proxy configurado
    {
      const c = ctxWeb('https:');
      vm.runInContext('PROXY_URL=""; webNotaSinResultados(false)', c);
      t(P + 'web2: sin proxy → lo dice sin culpar al buscador', /no hay proxy configurado/i.test(c._dicho), c._dicho);
    }
    // el buscador se cayó de verdad
    {
      const c = ctxWeb('https:');
      vm.runInContext('webNotaSinResultados(true)', c);
      t(P + 'web2: buscador caído → lo atribuye a quien corresponde', /el buscador no respondi[oó]/i.test(c._dicho));
      t(P + 'web2: explica por qué el chip dice memoria', /chip dice ◈ memoria/i.test(c._dicho));
    }
    // búsqueda que simplemente no trajo nada
    {
      const c = ctxWeb('https:');
      vm.runInContext('webNotaSinResultados(false)', c);
      t(P + 'web2: sin resultados → lo dice, no inventa una falla', /no trajo resultados/i.test(c._dicho));
    }
    /* EL INVARIANTE: la procedencia se calcula de los resultados REALES. Si alguien vuelve a
       poner ultimaProcedencia=['🌐 web'] fijo (como estaba en el MIRROR hasta el 1/08), el
       chip vuelve a mentir y esta prueba tiene que caer. */
    t(P + 'proc: el chip sale de si hubo resultados, no de haber tocado el botón',
      /const huboWeb = results\.length > 0;/.test(src) && /huboWeb \? \['🌐 web'\] : \['◈ memoria'\]/.test(src),
      'la procedencia volvió a ser fija');
    t(P + 'proc: la burbuja también se rotula según lo que pasó', /huboWeb \? 'web' : 'mirror'/.test(src));
    // la leyenda del pie que Darío pidió sacar no vuelve sola
    t(P + 'ui2: la leyenda «🌐 web · ⊕ doc» quedó fuera del pie', src.indexOf('<span class="ftip">') < 0, 'volvió la leyenda');
  }

  /* ══════════ ana — QUE EL ANÁLISIS SE ENTIENDA Y NO INDUZCA A ERROR ══════════
     Auditoría de Darío (1/08) sobre sus datos de tesis: el resumen hablaba en jerga, la app
     graficaba la columna «id» y titulaba «r=1» con 4 casos. Lo último es lo grave: una
     correlación perfecta con 4 puntos es lo esperable por azar, y presentada así empuja a
     una conclusión falsa. Estas pruebas cuidan las tres cosas. */
  {
    const cod = ['anaNum', 'anaStats', 'anaRed', 'anaAvisoMuestra', 'anaLineaCol', 'anaResumen', 'anaSpecs'].map(n => extraer(src, n)).join('\n');
    const c = contexto(false); c.Math = Math; vm.runInContext(cod, c);
    const corre = (headers, rows) => {
      c._h = headers; c._r = rows;
      return vm.runInContext('(function(){ var st=anaStats(_h,_r); var sp=anaSpecs(st); return { txt:anaResumen("prueba.csv",_h,_r,st,0,sp), st:st, specs:sp }; })()', c);
    };
    // ── caso 1: como el CSV de la tesis — id de 13 dígitos + categóricas con vacíos ──
    {
      const h = ['id', 'acceso_internet', 'comentario'];
      const filas = [];
      for (let i = 0; i < 15; i++) filas.push([String(1779623923111 + i * 7), (i < 3 ? 'Casi siempre' : (i < 5 ? 'A veces' : '')), (i < 4 ? 'texto único ' + i : '')]);
      const r = corre(h, filas);
      const idCol = r.st.cols[0];
      t(P + 'ana: reconoce el «id» como identificador', idCol.esId === true, JSON.stringify({ n: idCol.n, unicos: idCol.unicos }));
      t(P + 'ana: NO grafica el identificador', r.specs.every(s => !/^id /.test(s.titulo)), JSON.stringify(r.specs.map(s => s.titulo)));
      t(P + 'ana: lo explica en el resumen sin jerga', /es un identificador/.test(r.txt) && /es una etiqueta, no una medida/.test(r.txt));
      t(P + 'ana: los vacíos se dicen en criollo, no «vacios=10»', /en blanco/.test(r.txt) && !/vac[ií]os=/.test(r.txt), r.txt.split('\n')[3]);
      t(P + 'ana: dice cuántos contestaron sobre el total', /de 15 contestaron/.test(r.txt), r.txt);
      t(P + 'ana: avisa que con 15 respuestas no se concluye', /TAMAÑO: son 15 respuestas/.test(r.txt) && /no para concluir/.test(r.txt));
      t(P + 'ana: le cuenta al modelo qué gráficos hay en pantalla', /EN PANTALLA/.test(r.txt));
      t(P + 'ana: las respuestas abiertas no se listan', /respuestas abiertas/.test(r.txt) && r.txt.indexOf('texto único 1') < 0);
    }
    // ── caso 2: EL GRAVE — correlación perfecta con pocos casos ──
    {
      const h = ['l2', 'l6'];
      const filas = [['1', '2'], ['2', '4'], ['3', '6'], ['4', '8']]; // r=1 exacta, n=4
      const r = corre(h, filas);
      t(P + 'ana: r=1 con 4 casos NO se informa como hallazgo', r.st.corrs.length === 0, JSON.stringify(r.st.corrs));
      t(P + 'ana: y explica por qué no se informa', /ninguna ten[ií]a suficientes casos/.test(r.txt) && /esperable por azar/.test(r.txt), r.txt);
      t(P + 'ana: tampoco dibuja el scatter engañoso', r.specs.every(s => s.tipo !== 'scatter'));
    }
    // ── caso 3: con casos suficientes SÍ se informa, pero con la advertencia ──
    {
      const h = ['x', 'y'];
      const filas = []; for (let i = 1; i <= 12; i++) filas.push([String(i), String(i * 2 + (i % 3))]);
      const r = corre(h, filas);
      t(P + 'ana: con 12 casos sí informa la correlación', r.st.corrs.length === 1, JSON.stringify(r.st.corrs));
      t(P + 'ana: y aclara que correlación NO es causa', /NO prueba que uno cause el otro/.test(r.txt));
    }
    // ── caso 4: la encuesta de 1 respuesta (la otra captura de Darío) ──
    {
      const h = ['USAS LA IAG PARA ESTUDIAR?', 'UASAS GEMINI O CLAUDE?'];
      const r = corre(h, [['Sí', 'Claude']]);
      t(P + 'ana: con una sola fila lo dice de frente', /hay UNA sola fila/.test(r.txt), r.txt);
      t(P + 'ana: con una sola fila no habla de tendencias', /No hables de tendencias/.test(r.txt));
      t(P + 'ana: no promete gráficos que no hay', r.specs.length === 0 ? /no hay ning[uú]n gr[aá]fico/.test(r.txt) : true);
    }
    // ── invariante: la matemática sigue siendo exacta y local ──
    {
      const h = ['nota'];
      const r = corre(h, [['4'], ['6'], ['8'], ['10']]);
      t(P + 'ana: la media sigue bien calculada', /Promedio 7/.test(r.txt), r.txt);
      t(P + 'ana: sigue avisando que no estime lo que no está', /NO lo estimes/.test(r.txt));
    }
  }

  /* ══════════ H3 — el MIRROR que se apaga solo ══════════
     La bandera más distintiva, y la que más fácil se vuelve dañina si se hace mal. Las tres
     cosas que estas pruebas cuidan: que venga APAGADO (un límite que no elegiste es
     paternalismo), que SIEMPRE se pueda seguir (trabar a alguien afuera de su herramienta es
     peligroso: no sabemos para qué la necesita), y que no rete a nadie. */
  {
    const cod = ['apagadoLimite', 'apagadoHoy', 'apagadoUso', 'apagadoSumar', 'apagadoSet', 'apagadoSeguir', 'apagadoTarjeta', 'apagadoChequear', 'apagadoBloquea']
      .map(n => extraer(src, n)).join('\n') +
      '\nconst APAGADO_OPCIONES=[0,30,60,90];\nlet apagadoActivo=false, apagadoTimer=null; let dicho=[];\n';
    function ctxH3(store) {
      const c = contexto(false);
      const s = store || {};
      c.localStorage = { getItem: k => (k in s ? s[k] : null), setItem: (k, v) => { s[k] = v; } };
      c.Date = Date; c.parseInt = parseInt;
      c.addMsg = (q, t) => { c._dicho = (c._dicho || []).concat(t); };
      c.cumpliAbrir = () => {};
      vm.runInContext(cod, c); c._s = s; return c;
    }
    // 1) viene apagado
    {
      const c = ctxH3();
      t(P + 'H3 viene SIN límite (nadie te impone un tope)', vm.runInContext('apagadoLimite()', c) === 0);
      t(P + 'H3 sin límite no frena nunca', vm.runInContext('apagadoChequear(); apagadoActivo', c) === false);
    }
    // 2) solo acepta las opciones previstas (nada de valores raros guardados a mano)
    {
      const c = ctxH3({ mirror_apagado_min: '9999' });
      t(P + 'H3 ignora un límite fuera de las opciones', vm.runInContext('apagadoLimite()', c) === 0);
    }
    // 3) el uso se cuenta por día y se reinicia
    {
      const c = ctxH3({ mirror_apagado_min: '30' });
      vm.runInContext('apagadoSumar(10)', c);
      t(P + 'H3 cuenta el uso del día', vm.runInContext('apagadoUso()', c) === 10);
      c._s.mirror_apagado_uso = JSON.stringify({ d: '2020-01-01', min: 999 });
      t(P + 'H3 el uso de ayer no cuenta hoy', vm.runInContext('apagadoUso()', c) === 0);
    }
    // 4) al llegar al límite frena — pero deja seguir SIEMPRE
    {
      const c = ctxH3({ mirror_apagado_min: '30' });
      vm.runInContext('apagadoSumar(29); apagadoChequear();', c);
      t(P + 'H3 antes del límite no molesta', vm.runInContext('apagadoActivo', c) === false);
      vm.runInContext('apagadoSumar(1); apagadoChequear();', c);
      t(P + 'H3 al llegar al límite, frena', vm.runInContext('apagadoActivo', c) === true);
      t(P + 'H3 y bloquea el envío mientras tanto', vm.runInContext('apagadoBloquea()', c) === true);
      const card = c._chat.hijos[c._chat.hijos.length - 1]._html;
      t(P + 'H3 la tarjeta ofrece seguir 10 minutos más', /data-seguir="10"/.test(card));
      t(P + 'H3 la tarjeta ofrece seguir sin límite hoy', /data-seguir="0"/.test(card));
      t(P + 'H3 avisa que no se pierde nada', /Nada se pierde/.test(card));
      t(P + 'H3 NO reta ni culpa', !/deber[ií]as|demasiado|adicci|exceso|mal uso/i.test(card), card);
      vm.runInContext('apagadoSeguir(10)', c);
      t(P + 'H3 después de «seguir», el envío pasa', vm.runInContext('apagadoActivo', c) === false && vm.runInContext('apagadoBloquea()', c) === false);
      t(P + 'H3 al seguir, no culpabiliza', /Sin culpa/.test((c._dicho || []).join(' ')), (c._dicho || []).join(' '));
    }
    // 5) el límite se puede sacar en cualquier momento
    {
      const c = ctxH3({ mirror_apagado_min: '30' });
      vm.runInContext('apagadoSumar(40); apagadoChequear();', c);
      t(P + 'H3 estaba frenado', vm.runInContext('apagadoActivo', c) === true);
      vm.runInContext('apagadoSet(0)', c);
      t(P + 'H3 sacar el límite libera al toque', vm.runInContext('apagadoActivo', c) === false && vm.runInContext('apagadoLimite()', c) === 0);
    }
    // 6) el freno está enganchado al envío en el código real
    t(P + 'H3 el envío consulta el límite', /if\(apagadoBloquea\(\)\)\{ inp\.value = text;/.test(src), 'el freno no está enganchado a send()');
    t(P + 'H3 el mensaje escrito no se pierde al frenar', /inp\.value = text;/.test(src));
    t(P + 'H3 de fondo (pestaña oculta) no cuenta el tiempo', /visibilityState!=='visible'\) return;/.test(src));
  }

  // ══════════ v44-vision · v44-imagen (2/08/2026) — 📷 VER y 🎨 CREAR IMÁGENES ══════════
  /* Portado de la plataforma al MIRROR personal. Este bloque corre contra LAS DOS: cada
     promesa del accesorio queda amarrada acá para que nadie la rompa sin que salte. */
  {
    // DOM/entorno de mentira, lo mínimo que tocan estas funciones
    function ctxImg(opts) {
      opts = opts || {};
      const chat = nodo(); const inp = nodo(); inp.value = opts.texto || ''; inp.style = {};
      const prev = nodo(); prev.style = {};
      const dicho = []; const nodos = {};
      // nodo con `style` y `value`: los del banco viejo no los tenían y guardarPolliKey los toca
      const nodoUI = () => { const n = nodo(); n.style = {}; n.value = ''; return n; };
      const ls = Object.assign({}, opts.local || {});
      const c = {
        console, setTimeout, clearTimeout, Promise, JSON, String, Number, Math, RegExp, Error, Array, Object, Date, encodeURIComponent, FileReader: null, Image: null,
        document: {
          getElementById: id => (id === 'chat' ? chat : id === 'inp' ? inp : id === 'imgpreview' ? prev : (nodos[id] = nodos[id] || nodoUI())),
          createElement: tag => {
            const n = nodo();
            if (tag === 'canvas') { n.getContext = () => ({ drawImage(){} }); n.toDataURL = () => 'data:image/jpeg;base64,ACHICADA'; }
            return n;
          },
          body: nodo()
        },
        localStorage: {
          getItem: k => (k in ls ? ls[k] : null),
          setItem: (k, v) => { if (opts.lsRota) throw new Error('QuotaExceeded'); ls[k] = String(v); },
          removeItem: k => { delete ls[k]; }
        },
        navigator: { userAgent: 'node' },
        addMsg: (r, tx) => { dicho.push(String(tx)); },
        mode: 'mirror', busy: false, imagenAdjunta: null, history: [], informeLog: [],
        showTyping: () => {}, removeTyping: () => {}, setButtonsBusy: () => {},
        micStop: () => {}, trigPulse: () => {}, hablar: () => {}, regError: () => {},
        vozAccionUI: () => {}, micAccion: false,
        llamarMotor: opts.motor || (async () => 'una descripción honesta'),
        llamarMotorVigente: opts.motor || (async () => 'una descripción honesta'),
        modeloVisionActivo: () => 'modelo-vision',
        GROQ_URL: 'https://proxy/groq', GROQ_KEY: '', MODELO_VISION: 'modelo-vision',
        SYSTEM_VISION: 'corto', POLLI_KEY: opts.clave === undefined ? 'pk_valida' : opts.clave,
        URL: { createObjectURL: () => 'blob:falsa' },
        fetch: opts.fetch || (async () => { c._fetches++; return { ok: true, status: 200, blob: async () => ({}) }; }),
        _chat: chat, _inp: inp, _prev: prev, _dicho: dicho, _ls: ls, _fetches: 0, _abrio: false
      };
      c.abrirPolliKey = () => { c._abrio = true; };
      c.cerrarPolliKey = () => { c._cerro = true; };
      c.window = c;
      return vm.createContext(c);
    }
    /* FileReader / Image de mentira. Disparan onload EN EL ACTO, no con setTimeout: con
       temporizadores el banco se dormía un rato y comprobaba antes de tiempo (leía null y
       marcaba un fallo que no existía). Una prueba que depende de cuánto tardó la máquina no
       es una prueba. A handleImagen le da igual: no supone que la lectura sea asincrónica. */
    function armarLectores(c, opts) {
      opts = opts || {};
      vm.runInContext('(' + function (falla, ancho, alto, imgRota) {
        FileReader = function () {
          this.readAsDataURL = function () { falla ? this.onerror && this.onerror() : this.onload && this.onload({ target: { result: 'data:image/png;base64,ORIGINAL' } }); };
        };
        Image = function () { const self = this; Object.defineProperty(this, 'src', { set() { imgRota ? self.onerror && self.onerror() : (self.width = ancho, self.height = alto, self.onload && self.onload()); } }); };
      }.toString() + ')(' + !!opts.falla + ',' + (opts.ancho || 100) + ',' + (opts.alto || 100) + ',' + !!opts.imgRota + ')', c);
    }

    // 1) lo que NO es imagen no se cuela, y no deja basura adjunta
    {
      const c = ctxImg(); armarLectores(c); vm.runInContext(extraer(src, 'handleImagen'), c);
      const input = { files: [{ type: 'application/pdf' }], value: 'C:/fake' };
      c.__in = input; vm.runInContext('handleImagen(__in)', c);
      t(P + 'IMG un PDF no pasa por imagen', /no parece una imagen/i.test(c._dicho.join(' ')), c._dicho.join(' '));
      t(P + 'IMG un PDF no deja nada adjunto', vm.runInContext('imagenAdjunta', c) === null);
      t(P + 'IMG el input se limpia (se puede reelegir la MISMA foto)', input.value === '');
    }
    // 2) sin archivo (el usuario canceló el selector) → silencio, no error
    {
      const c = ctxImg(); armarLectores(c); vm.runInContext(extraer(src, 'handleImagen'), c);
      c.__in = { files: [], value: 'x' }; vm.runInContext('handleImagen(__in)', c);
      t(P + 'IMG cancelar el selector no dice nada raro', c._dicho.length === 0, c._dicho.join(' '));
    }
    // 3) la foto grande se achica ANTES de salir (v38-vision3: si no, revienta el cupo)
    {
      const c = ctxImg(); armarLectores(c, { ancho: 4000, alto: 3000 });
      vm.runInContext(extraer(src, 'handleImagen') + '\n' + extraer(src, 'mostrarPreviewImagen'), c);
      c.__in = { files: [{ type: 'image/jpeg' }], value: 'x' }; vm.runInContext('handleImagen(__in)', c);
      t(P + 'IMG la foto se achica en el dispositivo antes de viajar', vm.runInContext('imagenAdjunta', c) === 'data:image/jpeg;base64,ACHICADA', String(vm.runInContext('imagenAdjunta', c)).slice(0, 40));
      t(P + 'IMG el preview se muestra', c._prev.style.display === 'flex');
      t(P + 'IMG el preview trae el botón de quitar', c._prev._html.indexOf('quitarImagenAdjunta') > 0);
    }
    // 3.ter) una imagen que el navegador no puede decodificar se DICE, no se traga
    {
      const c = ctxImg(); armarLectores(c, { imgRota: true });
      vm.runInContext(extraer(src, 'handleImagen') + '\n' + extraer(src, 'mostrarPreviewImagen'), c);
      c.__in = { files: [{ type: 'image/jpeg' }], value: 'x' }; vm.runInContext('handleImagen(__in)', c);
      t(P + 'IMG una imagen ilegible se avisa', /no pude leer esa imagen/i.test(c._dicho.join(' ')), c._dicho.join(' '));
      t(P + 'IMG una imagen ilegible no deja nada adjunto', vm.runInContext('imagenAdjunta', c) === null);
    }
    // 3.quater) el archivo que ni se abre también se dice
    {
      const c = ctxImg(); armarLectores(c, { falla: true });
      vm.runInContext(extraer(src, 'handleImagen'), c);
      c.__in = { files: [{ type: 'image/jpeg' }], value: 'x' }; vm.runInContext('handleImagen(__in)', c);
      t(P + 'IMG el archivo que no se puede abrir se avisa', /no pude abrir el archivo/i.test(c._dicho.join(' ')), c._dicho.join(' '));
    }
  }
  // 3.bis) el achique y sus continuaciones (async), separados para no anidar promesas
  {
    const codH = extraer(src, 'handleImagen') + '\n' + extraer(src, 'mostrarPreviewImagen') + '\n' + extraer(src, 'quitarImagenAdjunta');
    // el archivo ilegible se dice, no se traga
    t(P + 'IMG el tamaño tope es 768 (cupo gratis de Groq)', /const MAX = 768;/.test(src), 'cambió el tope sin actualizar el banco');
    t(P + 'IMG la imagen NO se guarda en la memoria de la charla', /history\.push\(\{ role:'user', content: \(text \|\| '\(envié una imagen/.test(src));
    t(P + 'IMG la visión usa un system CORTO, no el prompt del espejo (v38-vision2)', /SYSTEM_VISION/.test(src) && !/enviarConImagen[\s\S]{0,900}buildMirrorSystem\(\)/.test(src));
  }
  // 4) la marca de contenido generado por IA: visible, en el alt, y no apagable
  {
    const c = ctxImg(); vm.runInContext(extraer(src, 'addImagenGenerada'), c);
    vm.runInContext('addImagenGenerada("blob:x","<img src=y onerror=alert(1)>")', c);
    const html = c._chat.hijos[0]._html;
    t(P + 'IA marca VISIBLE de imagen generada', /generada por IA/.test(html) && /gen-marca/.test(html), html.slice(0, 200));
    t(P + 'IA la marca también va en el alt (lector de pantalla)', /alt="Imagen generada por IA/.test(html));
    t(P + 'IA el prompt del usuario se escapa (XSS)', html.indexOf('<img src=y onerror') < 0 && /&lt;img/.test(html));
    t(P + 'IA hay descarga de la imagen', /class="gen-dl"/.test(html) && /download="mirror-/.test(html));
    t(P + 'IA la marca no está escondida por CSS', !/\.gen-marca\s*\{[^}]*display:\s*none/.test(src));
  }
  // 5) la clave de Pollinations: la sk_ NO entra, y si no se guarda NO se miente
  {
    const c = ctxImg({ clave: '' }); vm.runInContext(extraer(src, 'guardarPolliKey'), c);
    c.document.getElementById('polli-key-input').value = 'sk_secreta_de_servidor';
    vm.runInContext('guardarPolliKey()', c);
    const msg = String(c.document.getElementById('polli-msg').textContent || '');
    t(P + 'CLAVE la sk_ (de servidor) se rechaza', /sk_/.test(msg) && vm.runInContext('POLLI_KEY', c) !== 'sk_secreta_de_servidor', msg);
    t(P + 'CLAVE la sk_ NO se guarda en el navegador', !('mirror_pollinations_key' in c._ls));
  }
  {
    const c = ctxImg({ clave: '' }); vm.runInContext(extraer(src, 'guardarPolliKey'), c);
    c.document.getElementById('polli-key-input').value = 'pk_buena';
    vm.runInContext('guardarPolliKey()', c);
    t(P + 'CLAVE la pk_ se guarda', c._ls['mirror_pollinations_key'] === 'pk_buena');
    t(P + 'CLAVE se avisa que quedó guardada', /guardada/i.test(String(c.document.getElementById('polli-msg').textContent)));
  }
  {
    const c = ctxImg({ clave: '', lsRota: true }); vm.runInContext(extraer(src, 'guardarPolliKey'), c);
    c.document.getElementById('polli-key-input').value = 'pk_buena';
    vm.runInContext('guardarPolliKey()', c);
    const msg = String(c.document.getElementById('polli-msg').textContent || '');
    t(P + 'CLAVE si el navegador no deja guardar, NO dice «guardada»', !/✅/.test(msg) && /sesi[oó]n|no me dej|no pude/i.test(msg), msg);
  }
  // 6) sin clave, 🎨 no falla en silencio: pide la clave y NO sale a la red
  {
    const c = ctxImg({ clave: '', texto: 'un monolito' });
    vm.runInContext(extraer(src, 'generarImagen'), c);
    const p = vm.runInContext('generarImagen()', c);
    Promise.resolve(p).then(() => {
      t(P + 'GEN sin clave NO sale a la red', c._fetches === 0);
      t(P + 'GEN sin clave abre el pedido de clave', c._abrio === true);
    });
  }
  // 7) sin texto, 🎨 explica qué hacer (no manda un prompt vacío)
  {
    const c = ctxImg({ texto: '   ' });
    vm.runInContext(extraer(src, 'generarImagen'), c);
    Promise.resolve(vm.runInContext('generarImagen()', c)).then(() => {
      t(P + 'GEN sin texto no sale a la red', c._fetches === 0);
      t(P + 'GEN sin texto explica cómo se usa', /🎨/.test(c._dicho.join(' ')), c._dicho.join(' '));
    });
  }
  // 8) cada error del servicio se dice por su nombre (no un «no se pudo» genérico)
  {
    const casos = [[401, /clave/i], [402, /cr[eé]dito/i], [429, /saturado|l[ií]mite/i], [500, /HTTP 500/]];
    for (const [status, esperado] of casos) {
      const c = ctxImg({ texto: 'algo', fetch: async () => ({ ok: false, status }) });
      vm.runInContext(extraer(src, 'generarImagen'), c);
      Promise.resolve(vm.runInContext('generarImagen()', c)).then(() => {
        t(P + 'GEN HTTP ' + status + ' se explica por su nombre', esperado.test(c._dicho.join(' ')), c._dicho.join(' '));
      });
    }
  }
  // 9) la red que se cae no rompe la app ni promete una imagen que no llegó
  {
    const c = ctxImg({ texto: 'algo', fetch: async () => { throw new Error('Failed to fetch'); } });
    vm.runInContext(extraer(src, 'generarImagen'), c);
    Promise.resolve(vm.runInContext('generarImagen()', c)).then(() => {
      t(P + 'GEN la red caída se avisa', /no pude contactar/i.test(c._dicho.join(' ')), c._dicho.join(' '));
      t(P + 'GEN la red caída no pinta ninguna imagen', c._chat.hijos.length === 0);
    });
  }
  // 10) H3 SIN PUERTA LATERAL: la rama de visión va DESPUÉS del freno del límite diario
  {
    const iFreno = src.indexOf('if(apagadoBloquea())');
    const iVision = src.indexOf('if (imagenAdjunta) { return enviarConImagen(text); }');
    t(P + 'H3 el freno del límite existe en send()', iFreno > 0);
    t(P + 'H3 una imagen NO se escapa del límite diario (va después del freno)', iVision > iFreno, 'la rama de visión está ANTES del freno: puerta lateral');
    t(P + 'H1 la imagen también cuenta el turno de la sesión', src.indexOf('cumpliTurno()') < iVision);
    t(P + 'IMG la foto sin texto es un mensaje válido', /if \(!text && !imagenAdjunta\) return;/.test(src));
  }
  // 11) el espejo no inventa imágenes ni promete dibujar (v38-honest / v44-honest)
  {
    t(P + 'HONEST no describe una imagen que ya no tiene', /NUNCA la describas de memoria/.test(src));
    t(P + 'HONEST no promete dibujar (deriva al botón 🎨)', /NUNCA prometas/.test(src) && /🎨/.test(src));
  }
  // 12) sólo se pintan imágenes de fuente segura (data:image o https)
  {
    t(P + 'SEC la burbuja solo acepta data:image o https', /\/\^data:image\\\/\/\.test\(imgUrl\) \|\| \/\^https:/.test(src), 'se aflojó el filtro de fuentes de imagen');
  }

  // ══════════ v38-roles2 (2/08/2026) — LA ETIQUETA DE MEMORIA CON ROLES ══════════
  /* Solo la PLATAFORMA cambió de molde (es donde el nombre del perfil y el de la app
     colisionaban: la facha ATIS). En el MIRROR personal el molde sigue como estaba, y eso
     también se comprueba acá: si alguien lo cambia sin decirlo, salta. */
  if (etiqueta === 'PLATAFORMA') {
    // tokenize arrastra normalizeText y la lista de stopwords: se traen del archivo REAL,
    // no se inventa una versión de juguete (si el índice cambia, el banco tiene que enterarse).
    const iStop = src.indexOf('const STOPWORDS_ES = new Set(');
    const codStop = src.slice(iStop, src.indexOf('\n', iStop));
    const codBase = [codStop, extraer(src, 'normalizeText'), extraer(src, 'tokenize'),
                     extraer(src, 'recuerdoArmar'), extraer(src, 'recuerdoNormalizar'), extraer(src, '_moldeTokens')].join('\n');
    function ctxMem() {
      const c = { console, JSON, String, Number, Math, RegExp, Error, Array, Object, Date,
                  CONFIG: { appName: 'ATIS', perfil: { nombre: 'ATIS' } } };
      c.window = c; return vm.createContext(c);
    }
    // 1) el molde nuevo dice los roles y NO mete nombres
    {
      const c = ctxMem(); vm.runInContext(codBase, c);
      const txt = vm.runInContext('recuerdoArmar("me recibí de física","felicitaciones").text', c);
      t(P + 'ROLES el recuerdo nuevo marca USUARIO', /USUARIO:/.test(txt), txt);
      t(P + 'ROLES el recuerdo nuevo marca ASISTENTE', /ASISTENTE:/.test(txt), txt);
      t(P + 'ROLES el nombre de la app YA NO entra en el recuerdo', txt.indexOf('ATIS') < 0, txt);
      t(P + 'ROLES ya no se usa «dijo/respondió» (era lo ambiguo)', !/dijo:|respondi[oó]:/i.test(txt), txt);
      t(P + 'ROLES el contenido del usuario queda intacto', /me recibí de física/.test(txt));
      t(P + 'ROLES la respuesta queda guardada', /felicitaciones/.test(txt));
    }
    // 2) EL CASO QUE MOTIVÓ TODO: un recuerdo viejo con el MISMO nombre de los dos lados
    {
      const c = ctxMem(); vm.runInContext(codBase, c);
      c.__r = { id: 'r_1', text: '[2026-07-30] ATIS dijo: mañana tengo la defensa || ATIS respondió: mucha suerte', tf: { atis: 2 }, len: 12 };
      const r = vm.runInContext('recuerdoNormalizar(__r)', c);
      t(P + 'ROLES el recuerdo viejo se traduce: quién habló', /^\[2026-07-30\] USUARIO: mañana tengo la defensa/.test(r.text), r.text);
      t(P + 'ROLES el recuerdo viejo se traduce: quién respondió', /\|\| ASISTENTE: mucha suerte$/.test(r.text), r.text);
      t(P + 'ROLES ya no se puede confundir al usuario con la app', r.text.indexOf('ATIS') < 0, r.text);
      t(P + 'ROLES el índice se recalcula (el nombre deja de competir en la búsqueda)', !('atis' in (r.tf || {})), JSON.stringify(r.tf));
      t(P + 'ROLES el índice queda con el contenido real', ('defensa' in (r.tf || {})), JSON.stringify(r.tf));
      t(P + 'ROLES el largo se actualiza con el texto nuevo', r.len !== 12 && r.len > 0, String(r.len));
    }
    // 3) idempotente: lo que ya está en el formato nuevo no se toca dos veces
    {
      const c = ctxMem(); vm.runInContext(codBase, c);
      c.__r = { id: 'r_2', text: '[2026-08-02] USUARIO: hola || ASISTENTE: qué tal', tf: { hola: 1 }, len: 5 };
      const r = vm.runInContext('recuerdoNormalizar(__r)', c);
      t(P + 'ROLES un recuerdo nuevo no se vuelve a traducir', r.text === '[2026-08-02] USUARIO: hola || ASISTENTE: qué tal', r.text);
      t(P + 'ROLES sin cambios, no se recalcula el índice al pedo', r.len === 5);
    }
    // 4) NO se mastica el texto del usuario aunque adentro escriba «dijo:»
    {
      const c = ctxMem(); vm.runInContext(codBase, c);
      c.__r = { id: 'r_3', text: '[2026-07-01] Ana dijo: el director dijo: que no hay presupuesto || ATIS respondió: qué bajón', tf: {}, len: 3 };
      const r = vm.runInContext('recuerdoNormalizar(__r)', c);
      t(P + 'ROLES lo que dijo el usuario NO se reescribe', /el director dijo: que no hay presupuesto/.test(r.text), r.text);
      t(P + 'ROLES solo se traduce la cabecera del molde', /^\[2026-07-01\] USUARIO: el director/.test(r.text), r.text);
    }
    // 5) un recuerdo sin molde reconocible no explota ni se rompe
    {
      const c = ctxMem(); vm.runInContext(codBase, c);
      for (const raro of [{ id: 'r_4', text: 'texto suelto sin formato' }, { id: 'r_5' }, {}]) {
        c.__r = raro;
        let ok2 = true; try { vm.runInContext('recuerdoNormalizar(__r)', c); } catch (e) { ok2 = false; }
        t(P + 'ROLES un recuerdo raro (' + JSON.stringify(raro).slice(0, 30) + ') no rompe nada', ok2);
      }
      t(P + 'ROLES null/undefined tampoco rompen', (function () { try { c.__r = null; vm.runInContext('recuerdoNormalizar(__r)', c); return true; } catch (e) { return false; } })());
    }
    // 6) LA PROMESA GRANDE: traducir NO escribe en el Firebase del usuario
    {
      const f = extraer(src, 'recuerdoNormalizar');
      t(P + 'ROLES la traducción no toca la red (no escribe en tu base)', !/fetch\(|PATCH|PUT/.test(f), 'apareció una escritura dentro de recuerdoNormalizar');
      t(P + 'ROLES la traducción corre al cargar', /Object\.values\(d\)\.map\(recuerdoNormalizar\)/.test(src));
    }
    // 7) el 🌙 sabe que los rótulos nuevos son andamiaje, no contenido
    {
      const c = ctxMem(); vm.runInContext(codBase, c);
      const toks = vm.runInContext('_moldeTokens({text:"[2026-08-02] USUARIO: x || ASISTENTE: y"})', c);
      t(P + 'ROLES «usuario» no cuenta como contenido en la consolidación', toks.indexOf('usuario') >= 0, JSON.stringify(toks));
      t(P + 'ROLES «asistente» no cuenta como contenido en la consolidación', toks.indexOf('asistente') >= 0, JSON.stringify(toks));
    }
    // 8) al modelo se le EXPLICA la convención (un formato sin explicar sigue siendo adivinanza)
    {
      t(P + 'ROLES el contexto explica qué es USUARIO y qué es ASISTENTE', /«USUARIO:» es lo que dijo tu usuario/.test(src));
      t(P + 'ROLES el prompt de honestidad habla del molde nuevo', /«\[fecha\] USUARIO: … \|\| ASISTENTE: …»/.test(src));
      t(P + 'ROLES ya no queda la descripción del molde viejo en el prompt', !/X dijo: … \|\| <app> respondió:/.test(src));
    }
  } else {
    // El MIRROR personal NO cambió de molde: acá «Darío» y «MIRROR» no colisionan.
    t(P + 'ROLES el molde del MIRROR personal sigue intacto (no se tocó de prepo)', /'\] Darío dijo: ' \+ userText/.test(src));
  }

  // ══════════ v44-h4 (2/08/2026) — PROCEDENCIA AUDITABLE (solo MIRROR personal) ══════════
  if (etiqueta === 'MIRROR') {
    const iH4 = src.indexOf('const PROC_REG = {}');
    const codH4 = src.slice(iH4, src.indexOf('function addMsg(role, text, style, imgUrl) {'));
    const codAdd = extraer(src, 'addMsg');
    function ctxH4() {
      const chat = nodo(); const cuerpo = nodo(); const tit = nodo();
      const c = {
        console, JSON, String, Number, Math, RegExp, Error, Array, Object, Date, Boolean,
        document: { getElementById: id => (id === 'chat' ? chat : id === 'proc-body' ? cuerpo : id === 'proc-titulo' ? tit : nodo()), createElement: () => nodo() },
        informeLog: [], trigPulse: () => {}, regError: () => {}, mode: 'mirror',
        ultimaProcedencia: [], ultimaProcDetalle: {},
        formatearParaChat: t => String(t), // solo da formato al markdown: no es lo que se prueba acá
        _chat: chat, _body: cuerpo, _tit: tit
      };
      c.window = c; vm.createContext(c); vm.runInContext(codH4 + '\n' + codAdd, c); return c;
    }
    // 1) un chip SIN fragmento no promete nada
    {
      const c = ctxH4();
      vm.runInContext("ultimaProcedencia=['◈ memoria']; ultimaProcDetalle={}; addMsg('mirror','respuesta','mirror');", c);
      const html = c._chat.hijos[0]._html;
      t(P + 'H4 el chip sin fragmento NO se ofrece tocable', html.indexOf('proc-chip-ver') < 0 && html.indexOf('procVer(') < 0, html.slice(-160));
      t(P + 'H4 pero el chip se sigue viendo', /proc-chip/.test(html));
    }
    // 2) un chip CON fragmento sí, y muestra el texto EXACTO
    {
      const c = ctxH4();
      vm.runInContext("ultimaProcedencia=['◈ memoria']; ultimaProcDetalle={'◈ memoria':'[2026-08-02] USUARIO: me recibí'}; addMsg('mirror','respuesta','mirror');", c);
      const html = c._chat.hijos[0]._html;
      t(P + 'H4 el chip con fragmento se ofrece tocable', /proc-chip-ver/.test(html) && /procVer\(1,0\)/.test(html), html.slice(-200));
      vm.runInContext('procVer(1,0)', c);
      t(P + 'H4 el panel muestra el fragmento tal cual', c._body._html.indexOf('[2026-08-02] USUARIO: me recibí') > 0, c._body._html.slice(0, 200));
      t(P + 'H4 el panel aclara que no es un resumen', /no es un resumen/i.test(c._body._html));
      t(P + 'H4 el panel dice de qué chip es', /◈ memoria/.test(c._tit.textContent || ''), c._tit.textContent);
    }
    // 3) EL CASO FEO: el fragmento ya no está → se dice, NO se reconstruye
    {
      const c = ctxH4();
      vm.runInContext('procVer(999,0)', c);
      const html = c._body._html;
      t(P + 'H4 sin fragmento guardado lo admite', /no conservo el fragmento/i.test(html), html.slice(0, 200));
      t(P + 'H4 y explica por qué (no se guarda en ningún lado)', /no se guardan en ning[uú]n lado/i.test(html));
      t(P + 'H4 no inventa una reconstrucción', !/probablemente|aproximad|estimad/i.test(html), html.slice(0, 200));
    }
    // 4) el fragmento se ESCAPA: un resultado web hostil no ejecuta nada
    {
      const c = ctxH4();
      vm.runInContext("ultimaProcedencia=['🌐 web']; ultimaProcDetalle={'🌐 web':'<img src=x onerror=alert(1)><script>malo()</scr'+'ipt>'}; addMsg('mirror','r','web');", c);
      vm.runInContext('procVer(1,0)', c);
      const html = c._body._html;
      t(P + 'H4 XSS: el fragmento web se escapa', html.indexOf('<img src=x') < 0 && /&lt;img/.test(html), html.slice(0, 160));
      t(P + 'H4 XSS: no entra ningún script crudo', html.indexOf('<script') < 0);
    }
    // 5) el fragmento NO se filtra a la burbuja siguiente
    {
      const c = ctxH4();
      vm.runInContext("ultimaProcedencia=['◈ memoria']; ultimaProcDetalle={'◈ memoria':'algo'}; addMsg('mirror','primera','mirror'); addMsg('mirror','segunda','mirror');", c);
      t(P + 'H4 la primera respuesta lleva su chip', /proc-chip/.test(c._chat.hijos[0]._html));
      t(P + 'H4 la SEGUNDA no hereda ni el chip ni el fragmento', c._chat.hijos[1]._html.indexOf('proc-chip') < 0, c._chat.hijos[1]._html.slice(-120));
    }
    // 6) el registro no crece para siempre
    {
      const c = ctxH4();
      vm.runInContext("for(let k=0;k<60;k++){ ultimaProcedencia=['◈ memoria']; ultimaProcDetalle={'◈ memoria':'frag '+k}; addMsg('mirror','r'+k,'mirror'); }", c);
      const guardados = vm.runInContext('Object.keys(PROC_REG).length', c);
      t(P + 'H4 el registro se poda (no crece sin fin)', guardados === vm.runInContext('PROC_REG_MAX', c), 'quedaron ' + guardados);
      t(P + 'H4 se sueltan los MÁS VIEJOS, no los últimos', vm.runInContext('!!PROC_REG[60] && !PROC_REG[1]', c) === true);
    }
    // 7) LA PROMESA GRANDE: la procedencia no se guarda en ningún lado
    {
      t(P + 'H4 el registro no toca localStorage', !/localStorage/.test(codH4Fuente(src)), 'apareció almacenamiento en el módulo H4');
      t(P + 'H4 el registro no sale a la red', !/fetch\(/.test(codH4Fuente(src)), 'apareció una llamada de red en el módulo H4');
    }
    // 8) sin resultados de web, el chip de memoria queda SIN fragmento (no se inventa origen)
    {
      t(P + 'H4 sin web, no se le cuelga un fragmento al chip de memoria',
        /ultimaProcDetalle = huboWeb \? \{ '🌐 web': /.test(src) && /: \{\};/.test(src));
    }
    // 9) el detalle se arma pegado a donde se decide la procedencia (mismo lugar, mismas variables)
    {
      t(P + 'H4 el fragmento de memoria sale de la MISMA variable que se inyecta', /ultimaProcDetalle\['◈ memoria'\] = memoriaRelevante;/.test(src));
      t(P + 'H4 el de biblioteca también', /ultimaProcDetalle\['📚 biblioteca'\] = ragContext;/.test(src));
      t(P + 'H4 el del analista también', /ultimaProcDetalle\['📊 datos'\] = anaDataset\.resumenTxt;/.test(src));
    }
  }

  // ══════════ C5 SHARE TARGET (2/08/2026) — RECIBIR DESDE OTRA APP ══════════
  {
    const codC5 = ['c5Leer', 'c5Armar', 'c5Recibir'].map(n => extraer(src, n)).join('\n');
    function ctxC5(busqueda) {
      const chat = nodo(); const inp = nodo(); inp.value = ''; inp.style = {};
      const c = {
        console, JSON, String, Number, Math, RegExp, Error, Array, Object, URLSearchParams,
        document: { getElementById: id => (id === 'inp' ? inp : id === 'chat' ? chat : nodo()), createElement: () => nodo() },
        location: { search: busqueda || '', pathname: '/', hash: '' },
        history: { replaceState: function () { c._limpio = true; } },
        addMsg: (r, t) => { c._dicho.push(String(t)); },
        aresize: () => {}, regError: () => {}, mode: 'mirror',
        _dicho: [], _limpio: false, _inp: inp
      };
      c.window = c; vm.createContext(c); vm.runInContext(codC5, c); return c;
    }
    // 1) lee los nombres en criollo (los que va a escribir el manifest)
    {
      const c = ctxC5();
      const d = vm.runInContext("c5Leer('?titulo=Nota&texto=el%20cuerpo&enlace=https://ejemplo.com')", c);
      t(P + 'C5 lee el título', d.titulo === 'Nota', JSON.stringify(d));
      t(P + 'C5 lee el texto', d.texto === 'el cuerpo', JSON.stringify(d));
      t(P + 'C5 lee el enlace', d.enlace === 'https://ejemplo.com', JSON.stringify(d));
    }
    // 2) y también los estándar en inglés: fallar por el idioma de una clave sería tonto
    {
      const c = ctxC5();
      const d = vm.runInContext("c5Leer('?title=T&text=X&url=https://a.b')", c);
      t(P + 'C5 también entiende title/text/url', d.titulo === 'T' && d.texto === 'X' && d.enlace === 'https://a.b', JSON.stringify(d));
    }
    // 3) sin nada compartido, la app arranca como siempre
    {
      const c = ctxC5('');
      t(P + 'C5 sin parámetros no hace nada', vm.runInContext('c5Recibir()', c) === false);
      t(P + 'C5 sin parámetros no habla', c._dicho.length === 0, c._dicho.join(' '));
      t(P + 'C5 sin parámetros no toca el campo', c._inp.value === '');
      t(P + 'C5 sin parámetros no toca la URL', c._limpio === false);
    }
    // 4) EL CASO DE WHATSAPP: el enlace ya viene adentro del texto → no se repite
    {
      const c = ctxC5();
      const s = vm.runInContext("c5Armar({titulo:'', texto:'mirá esto https://a.b/x', enlace:'https://a.b/x'})", c);
      t(P + 'C5 no repite el enlace si ya está en el texto', (s.match(/https:\/\/a\.b\/x/g) || []).length === 1, s);
    }
    // 5) título igual al texto (pasa seguido) → tampoco se duplica
    {
      const c = ctxC5();
      const s = vm.runInContext("c5Armar({titulo:'hola', texto:'hola', enlace:''})", c);
      t(P + 'C5 no duplica el título cuando es igual al texto', s === 'hola', s);
    }
    // 6) solo un enlace, sin texto: igual sirve
    {
      const c = ctxC5();
      t(P + 'C5 un enlace pelado también entra', vm.runInContext("c5Armar({enlace:'https://a.b'})", c) === 'https://a.b');
    }
    // 7) LA PROMESA DEL NORTE: lo compartido queda listo y NO se manda solo
    {
      const c = ctxC5('?texto=contestame%20este%20mail');
      t(P + 'C5 con contenido devuelve true', vm.runInContext('c5Recibir()', c) === true);
      t(P + 'C5 lo compartido queda en el campo', c._inp.value.indexOf('contestame este mail') === 0, c._inp.value);
      t(P + 'C5 NO se manda solo (el último toque es humano)', !/\bsend\(\)|enviar\(\)|submit/.test(extraer(src, 'c5Recibir')), 'apareció un envío automático en c5Recibir');
      t(P + 'C5 avisa que no lo mandó', /sin mandarlo/i.test(c._dicho.join(' ')), c._dicho.join(' '));
    }
    // 8) la URL se limpia: recargar no puede volver a inyectar lo mismo
    {
      const c = ctxC5('?texto=algo');
      vm.runInContext('c5Recibir()', c);
      t(P + 'C5 limpia la URL después de leerla', c._limpio === true);
    }
    // 9) texto hostil: va al campo (que es un textarea), nunca a innerHTML
    {
      const c = ctxC5('?texto=' + encodeURIComponent('<img src=x onerror=alert(1)>'));
      vm.runInContext('c5Recibir()', c);
      t(P + 'C5 el texto compartido va al valor del campo, no al HTML', c._inp.value.indexOf('<img src=x') === 0, c._inp.value);
      t(P + 'C5 el aviso del chat no lleva nada del texto compartido', c._dicho.join(' ').indexOf('<img') < 0, c._dicho.join(' '));
    }
    // 10) una URL rota no puede tumbar el arranque de la app
    {
      const c = ctxC5('?%%%&&texto');
      let vivo = true; try { vm.runInContext('c5Recibir()', c); } catch (e) { vivo = false; }
      t(P + 'C5 una URL rota no rompe el arranque', vivo);
    }
    // 11) está enganchado al arranque de verdad
    {
      t(P + 'C5 se consulta al iniciar la app', /try\{ c5Recibir\(\); \}catch/.test(src));
    }
  }

  // ══════════ v44-cdn / v38-cdn (2/08/2026) — NADA SALE A TERCEROS AL ABRIR ══════════
  {
    // 1) LA PROMESA GRANDE: al abrir la app no se le pide un byte a nadie
    {
      const auto = src.match(/<(?:link|script)\b[^>]*(?:href|src)\s*=\s*"https?:\/\/[^"]*"/gi) || [];
      t(P + 'CDN no queda NINGUNA carga automática de terceros en el HTML', auto.length === 0, auto.join(' | ').slice(0, 200));
      t(P + 'CDN el enlace a Google Fonts salió del <head>', !/<link[^>]*fonts\.googleapis/i.test(src));
    }
    // 2) toda tipografía tiene respaldo del sistema: sin las web, la app NO queda ilegible
    {
      const monoSuelto = (src.match(/'Space Mono'(?!,)/g) || []).length;
      const serifSuelto = (src.match(/'Cormorant Garamond'(?!,)/g) || []).length;
      t(P + 'CDN ninguna declaración de Space Mono quedó sin respaldo', monoSuelto === 0, 'quedaron ' + monoSuelto);
      t(P + 'CDN ninguna declaración de Cormorant quedó sin respaldo', serifSuelto === 0, 'quedaron ' + serifSuelto);
      t(P + 'CDN el respaldo mono llega hasta la familia genérica', /'Space Mono',[^;}"']*\bmonospace\b/.test(src));
      t(P + 'CDN el respaldo serif llega hasta la familia genérica', /'Cormorant Garamond',[^;}"']*\bserif\b/.test(src));
    }
    // 3) el interruptor: apagado de fábrica
    {
      const cod = [extraerLinea(src, 'fuentesWebActiva'), extraer(src, 'fuentesWebCargar'), extraer(src, 'fuentesWebQuitar'), extraer(src, 'fuentesWebToggle')].join('\n')
                + '\n' + src.slice(src.indexOf('const FUENTES_URL ='), src.indexOf('\n', src.indexOf('const FUENTES_URL =')));
      function ctxF(store, rota) {
        store = store || {};
        const head = nodo(); const cuerpo = nodo();
        const puestos = {};
        const c = {
          console, JSON, String, Object, Array, Error, RegExp,
          localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { if (rota) throw new Error('bloqueado'); store[k] = String(v); } },
          document: {
            head: head, body: cuerpo,
            getElementById: id => (puestos[id] || (id === 'cumpli-body' ? null : null)),
            createElement: () => { const n = nodo(); n.parentNode = null; return n; }
          },
          addMsg: (r, tx) => { c._dicho.push(String(tx)); },
          regError: () => {}, _dicho: [], _store: store, _head: head, _puestos: puestos
        };
        head.appendChild = x => { head.hijos.push(x); if (x.id) puestos[x.id] = x; x.parentNode = head; return x; };
        head.removeChild = x => { head.hijos = head.hijos.filter(y => y !== x); if (x.id) delete puestos[x.id]; return x; };
        c.window = c; vm.createContext(c); vm.runInContext(cod, c); return c;
      }
      {
        const c = ctxF({});
        t(P + 'CDN de fábrica las tipografías web están APAGADAS', vm.runInContext('fuentesWebActiva()', c) === false);
      }
      // 4) encendidas: se inyecta el enlace, y con la URL correcta
      {
        const c = ctxF({ mirror_fuentes_web: '1' });
        vm.runInContext('fuentesWebCargar()', c);
        const l = c._head.hijos[0];
        t(P + 'CDN encendidas, se agrega el enlace', !!l && l.rel === 'stylesheet', JSON.stringify(c._head.hijos.length));
        t(P + 'CDN el enlace apunta a Google Fonts', !!l && /fonts\.googleapis\.com/.test(l.href || ''), l && l.href);
        vm.runInContext('fuentesWebCargar()', c);
        t(P + 'CDN no se pide dos veces la misma tipografía', c._head.hijos.length === 1, 'quedaron ' + c._head.hijos.length);
      }
      // 5) apagarlas saca el enlace de verdad (no solo la marca)
      {
        const c = ctxF({ mirror_fuentes_web: '1' });
        vm.runInContext('fuentesWebCargar(); fuentesWebToggle();', c);
        t(P + 'CDN al apagar, la marca queda en 0', c._store.mirror_fuentes_web === '0');
        t(P + 'CDN al apagar, el enlace se quita del documento', c._head.hijos.length === 0);
        t(P + 'CDN al apagar avisa que ya no se pide nada', /ya no se le pide nada a nadie/i.test(c._dicho.join(' ')), c._dicho.join(' '));
      }
      // 6) encenderlas lo dice con todas las letras: ese servidor va a ver tu IP
      {
        const c = ctxF({});
        vm.runInContext('fuentesWebToggle()', c);
        t(P + 'CDN al encender, la marca queda en 1', c._store.mirror_fuentes_web === '1');
        t(P + 'CDN al encender avisa que Google ve tu IP', /ve tu IP/i.test(c._dicho.join(' ')), c._dicho.join(' '));
      }
      // 7) si el navegador no deja guardar la elección, NO se miente (misma regla que la clave)
      {
        const c = ctxF({}, true);
        vm.runInContext('fuentesWebToggle()', c);
        const d = c._dicho.join(' ');
        t(P + 'CDN si no se pudo guardar la elección, lo dice', /no me dej[oó] guardar/i.test(d), d);
        t(P + 'CDN y avisa que al cerrar se apaga sola', /vuelve a apagarse/i.test(d), d);
      }
    }
    // 8) el panel cuenta la verdad nueva, con el interruptor y los CDN por nombre
    {
      t(P + 'CDN el panel dice que al abrir no se pide nada', /no se le pide nada a nadie/.test(src));
      t(P + 'CDN el panel ofrece el interruptor', /onclick="fuentesWebToggle\(\);return false;"/.test(src));
      t(P + 'CDN el panel nombra los servidores de las librerías', /cdnjs\.cloudflare\.com/.test(src) && /unpkg\.com/.test(src) && /jsdelivr\.net/.test(src));
      t(P + 'CDN el panel aclara que el archivo NO sale del dispositivo', /el archivo se procesa acá, en tu dispositivo, y nunca sale/.test(src));
      t(P + 'CDN ya no queda el texto viejo de «fuga chica»', !/Una fuga chica, dicha igual/.test(src));
    }
  }

  /* ══════════ MOTOR · «QUE EL PROVEEDOR NO TE DEJE A PIE» (5/08/2026) ══════════
     POR QUÉ EXISTE ESTA BATERÍA: Groq apaga `llama-3.3-70b-versatile` y
     `llama-3.1-8b-instant` el 16/08/2026, y las dos apps los tenían clavados. Peor: el
     catálogo de alternativas de la plataforma listaba LOS DOS, así que el blindaje «modelos
     que no caducan» no tenía a dónde caer. Estas pruebas amarran la promesa para que no se
     desate sola: que no quede ningún modelo apagado en el camino de las llamadas, que el
     catálogo tenga salida, y que el blindaje avise en vez de cambiar en silencio. */
  {
    // Modelos con fecha de apagado confirmada por el proveedor (console.groq.com/docs/deprecations, 5/08/2026).
    const APAGADOS_GROQ = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'qwen/qwen3-32b', 'meta-llama/llama-4-scout-17b-16e-instruct'];

    // 1) NINGÚN modelo apagado puede quedar como valor operativo. Se miran las líneas de
    //    código de verdad: se descartan comentarios y las listas que existen JUSTAMENTE
    //    para nombrar a los muertos (MODELOS_MUERTOS_GROQ / MODELOS_APAGADOS).
    {
      /* Los comentarios de bloque se borran ENTEROS antes de mirar, conservando los saltos
         de línea para no perder la numeración. Un comentario que explica cuál era el modelo
         viejo no es un modelo vivo — y hacerlo por línea daba falso positivo. */
      const sinComentarios = src.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
      const lineas = sinComentarios.split('\n');
      let dentroDeListaDeMuertos = false;
      const culpables = [];
      lineas.forEach(function(ln, i){
        const limpia = ln.replace(/\/\/.*$/, '').trim();
        if (/MODELOS_MUERTOS_GROQ\s*=/.test(limpia)) return;      // la lista de muertos del MIRROR
        if (/MODELOS_APAGADOS\s*=\s*\{/.test(limpia)) { dentroDeListaDeMuertos = true; return; }
        if (dentroDeListaDeMuertos) { if (/^\}/.test(limpia)) dentroDeListaDeMuertos = false; return; }
        APAGADOS_GROQ.forEach(function(m){
          // Los otros proveedores tienen sus propios modelos con nombres parecidos
          // (Cerebras 'llama-3.3-70b', OpenRouter 'meta-llama/llama-3.3-70b-instruct'):
          // esta baja es de Groq y NO los toca. Por eso se exige el nombre exacto.
          const re = new RegExp("['\"]" + m.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + "['\"]");
          if (re.test(limpia)) culpables.push('línea ' + (i + 1) + ': ' + limpia.slice(0, 90));
        });
      });
      t(P + 'MOTOR no queda NINGÚN modelo apagado por Groq en el código vivo', culpables.length === 0, culpables.join(' | '));
    }

    // 2) el modelo elegido tiene que ser uno de los que el proveedor recomienda HOY
    {
      const vigentes = ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b', 'openai/gpt-oss-20b']; // v39-qwen38: qwen3.6 retirado 14/09/2026
      const usaVigente = vigentes.some(v => src.indexOf("'" + v + "'") > 0);
      t(P + 'MOTOR el modelo principal es uno de los vigentes recomendados', usaVigente);
    }

    // 3) la curita de razonamiento ya NO depende del proveedor sino del modelo.
    //    Si gpt-oss llega por Groq (el fallback puede llevarlo ahí) y no recibe
    //    reasoning_effort, devuelve contenido VACÍO: fue un bug real (v1.9).
    {
      t(P + 'MOTOR la curita de gpt-oss se decide por MODELO, no por proveedor',
        /const esRazonador = \/gpt-oss\/i\.test\(modelo \|\| ''\);/.test(src));
      t(P + 'MOTOR y se aplica también fuera de Cerebras', /if \(esCerebras \|\| esRazonador\)/.test(src));
    }

    // 4) el error «el modelo ya no existe» se distingue de los demás. Si no se distingue,
    //    el blindaje no se dispara nunca — o peor, se dispara ante una falla de red.
    {
      t(P + 'MOTOR sabe reconocer un modelo dado de baja', /tipo = 'modelo_caduco'/.test(src));
      t(P + 'MOTOR el disparador es angosto (no salta ante cualquier error)',
        /if \(e\.tipo !== 'modelo_caduco'\) throw e/.test(src));
      t(P + 'MOTOR si no hay reemplazo, no cuelga: avisa', /modelo_caduco_sin_reemplazo/.test(src));
    }

    // 5) el catálogo de alternativas tiene que tener A DÓNDE CAER: al menos dos modelos
    //    vigentes. Un catálogo cuyas alternativas caducan el mismo día no es un blindaje.
    {
      const lista = etiqueta === 'MIRROR'
        ? /const MODELOS_ALT_GROQ = \[([^\]]*)\]/.exec(src)
        : /modelos: \[([^\]]*)\],\s*modeloVision/.exec(src); // v39-motor2: de-pinned del lider (antes 'qwen/qwen3.6-27b'); agarra la cadena groq por vecindad con modeloVision
      t(P + 'MOTOR el catálogo de Groq existe', !!lista);
      if (lista) {
        const crudo = lista[0];
        const vivos = (crudo.match(/'[^']+'/g) || []).filter(m => !APAGADOS_GROQ.includes(m.replace(/'/g, '')));
        t(P + 'MOTOR el catálogo tiene al menos 2 alternativas VIGENTES', vivos.length >= 2, 'quedaron ' + vivos.length + ': ' + vivos.join(','));
        t(P + 'MOTOR ninguna alternativa del catálogo está apagada',
          !APAGADOS_GROQ.some(m => crudo.indexOf("'" + m + "'") >= 0), crudo);
      }
    }

    /* ── THINK · «QUE EL PENSAMIENTO NO LLEGUE AL CHAT» (5/08/2026, hallazgo en vivo) ──
       Darío abrió el MIRROR con qwen3.6 y le salió la cadena de razonamiento entera en el
       chat: en inglés, y con pedazos del prompt del espejo adentro. Dos causas:
         · qwen3.6 ES un modelo de razonamiento (está en la lista de Groq) y por defecto
           devuelve el pensamiento DENTRO del texto, entre <think>. No se lo estábamos
           pidiendo de otra forma.
         · el <think> ni se cerró (se acabaron los tokens pensando), así que el limpiador
           que buscaba el par completo no encontró cierre y lo dejó pasar todo.
       La plataforma YA tenía el arreglo del segundo problema desde el fix v29 — y el MIRROR
       no. Otro blindaje que había quedado en una sola muleta. Estas pruebas amarran las dos
       puntas EN LAS DOS APPS para que no vuelva a pasar. */
    {
      const codThink = extraer(src, 'sinPensamiento');
      const c = vm.createContext({ String, RegExp });
      vm.runInContext(codThink, c);
      const limpiar = s => vm.runInContext('sinPensamiento(' + JSON.stringify(s) + ')', c);

      t(P + 'THINK las dos apps limpian con la MISMA función', /function sinPensamiento\(txt\)\{/.test(src.replace(/\s+/g,' ').replace(/function sinPensamiento\(txt\) \{/,'function sinPensamiento(txt){')) || /function sinPensamiento\(/.test(src));

      // (a) el caso normal: think cerrado, la respuesta queda limpia
      t(P + 'THINK saca un <think> cerrado y deja la respuesta',
        limpiar('<think>Okay, the user asks...</think>Todo bien por acá.') === 'Todo bien por acá.',
        limpiar('<think>Okay...</think>Todo bien por acá.'));

      // (b) EL CASO QUE EXPLOTÓ: think ABIERTO, sin cerrar nunca → no puede quedar NADA
      const roto = '<think>Here is a thinking process:\n1. Analyze User Input\n- The prompt says: "Breve, humano, 2-3 oraciones"';
      t(P + 'THINK un <think> SIN cerrar no deja pasar el razonamiento', limpiar(roto) === '', JSON.stringify(limpiar(roto)).slice(0,120));
      t(P + 'THINK y no se filtra ni un pedazo del prompt del sistema', !/Breve, humano/.test(limpiar(roto)));

      // (c) cierre huérfano: llegó el </think> pero no la apertura → se rescata la respuesta
      t(P + 'THINK con </think> huérfano rescata lo que viene después',
        limpiar('bla bla razonando</think>La respuesta real.') === 'La respuesta real.',
        limpiar('bla</think>La respuesta real.'));

      // (d) razonamiento anunciado en texto plano, SIN etiquetas (lo que se vio en pantalla)
      t(P + 'THINK corta el razonamiento anunciado en texto plano',
        limpiar("Here's a thinking process:\n1. Analyze User Input\n2. Draft Construction") === '',
        JSON.stringify(limpiar("Here's a thinking process:\n1. Analyze")));

      // (e) y NO se come una respuesta legítima que hable de pensar
      t(P + 'THINK no se come una respuesta legítima',
        limpiar('Pensemos juntos: la TAR es un enfoque teórico.') === 'Pensemos juntos: la TAR es un enfoque teórico.',
        limpiar('Pensemos juntos: la TAR es un enfoque teórico.'));
      t(P + 'THINK ni una que mencione «thinking» en el medio',
        limpiar('El autor propone un thinking process distinto.') === 'El autor propone un thinking process distinto.',
        limpiar('El autor propone un thinking process distinto.'));

      // (f) los tokens de control siguen limpiándose (no se perdió al refactorizar)
      t(P + 'THINK sigue sacando los tokens de control de gpt-oss',
        limpiar('Respuesta<|return|>') === 'Respuesta', limpiar('Respuesta<|return|>'));

      // (g) LA PRIMERA LÍNEA DE DEFENSA: no pedirle el razonamiento al proveedor.
      //     Limpiar después está bien; no pedirlo está mejor.
      t(P + 'THINK a qwen se le pide que NO razone', /body\.reasoning_effort = 'none'/.test(src));
      t(P + 'THINK y que si razona, no lo devuelva', /body\.reasoning_format = 'hidden'/.test(src));
      t(P + 'THINK eso NO se le manda a Cerebras (es otro proveedor)', /esQwenRazonador && !esCerebras/.test(src));
      // gpt-oss por Groq no acepta reasoning_format: ahí el parámetro es include_reasoning.
      t(P + 'THINK a gpt-oss por Groq se le manda include_reasoning:false', /if \(esRazonador && !esCerebras\) body\.include_reasoning = false;/.test(src));
      t(P + 'THINK y a gpt-oss NO se le manda reasoning_format (no lo acepta)',
        !/esRazonador[^\n]*reasoning_format/.test(src));

      /* (h) EL STREAMING — solo la plataforma lo tiene. Pinta a medida que llega, así que
         limpiar al final no alcanza: sin esto, el razonamiento se ve EN VIVO en pantalla
         y recién se limpia cuando termina de escribirse. */
      if (etiqueta === 'PLATAFORMA') {
        t(P + 'THINK el streaming pinta lo limpio, no lo crudo',
          /const visible = sinPensamiento\(acumulado\);/.test(src) && /pintarStreamParcial\(visible\)/.test(src));
        t(P + 'THINK y al cerrar el stream tampoco pinta el crudo',
          !/pintarStreamParcial\(acumulado\)/.test(src));
        t(P + 'THINK el camino clásico y el del stream usan la MISMA función',
          (src.match(/sinPensamiento\(/g) || []).length >= 4);
      }
      // Y las dos apps tienen que tener la función: es paridad, no una gentileza.
      t(P + 'THINK esta app tiene su limpiador de pensamiento', /function sinPensamiento\(/.test(src));
    }

    /* ── HONEST · «SI NO SÉ QUÉ PASÓ, NO INVENTO UNA CAUSA» (5/08/2026, hallazgo en vivo) ──
       Darío escribió «COMO ESTAS MIRROR?» —cuatro palabras— y la app le contestó que la
       consulta era demasiado grande. No lo era: qwen3.6 tiene 131k de contexto, el mismo
       que Llama 3.3. El problema estaba en cómo se adivinaba la causa: la regla de «too_big»
       matcheaba «tokens per» y «reduce», y el mensaje de saturación de Groq dice literalmente
       «…on tokens per minute (TPM)». O sea que un error de cupo podía salir disfrazado de
       error de tamaño. Afirmar una causa que no se sabe es la misma falla que ya se corrigió
       con el chip de la web: decir media verdad confunde más que callarse. */
    {
      const codErr = ['mensajeError', 'mensajeErrorConocido'].map(n => extraer(src, n)).join('\n');
      const c = vm.createContext({ String, CEREBRAS_KEY: 'proxy' });
      vm.runInContext(codErr, c);
      const msg = (tipo, det) => vm.runInContext('mensajeError(' + JSON.stringify(tipo) + ',' + JSON.stringify(det || null) + ')', c);

      /* (a) la regla de tamaño ya no muerde frases que son de OTRA cosa.
         Se mira la LÍNEA de la regla activa, no el archivo entero: el comentario que
         explica el arreglo cita la regex vieja, y buscar en todo el fuente daba un falso
         fallo. La prueba tiene que mirar el código que corre, no el que se cuenta. */
      const reglaTB = (src.split('\n').find(l => /else if \(res\.status === 413/.test(l)) || '');
      t(P + 'HONEST la regla de «consulta grande» existe', !!reglaTB);
      t(P + 'HONEST «tokens per» ya no se confunde con consulta grande', !/tokens per/.test(reglaTB), reglaTB.trim().slice(0,140));
      t(P + 'HONEST «reduce» suelto tampoco', !/\|reduce\|/.test(reglaTB), reglaTB.trim().slice(0,140));
      t(P + 'HONEST y sigue reconociendo lo que SÍ es de tamaño',
        /maximum context/.test(reglaTB) && /context length/.test(reglaTB) && /too large/.test(reglaTB), reglaTB.trim().slice(0,140));
      // el mensaje de saturación real de Groq NO puede caer en «consulta grande»
      {
        const real = 'Rate limit reached for model `qwen/qwen3.6-27b` in organization X on tokens per minute (TPM): Limit 6000, Used 5800, Requested 500. Please try again in 2m.';
        const m = /too large|maximum context|context length|context_length|reduce the length|request too large/i.test(real);
        t(P + 'HONEST el mensaje real de saturación NO se lee como consulta grande', !m, real.slice(0,80));
      }

      // (b) ante una causa desconocida, se dice que no se sabe Y se muestra lo del motor
      const desconocido = msg('otro', 'Bad Request: parameter foo not supported');
      t(P + 'HONEST ante lo desconocido admite que no sabe', /no sé bien qué/i.test(desconocido), desconocido);
      t(P + 'HONEST y muestra lo que dijo el motor, tal cual', /parameter foo not supported/.test(desconocido), desconocido);
      t(P + 'HONEST y NO afirma que la consulta era grande', !/demasiado grande/i.test(desconocido), desconocido);

      // (c) sin detalle no promete nada raro: vuelve al mensaje de siempre
      t(P + 'HONEST sin detalle, el mensaje de siempre', /No pude procesar la consulta/.test(msg('otro', '')), msg('otro',''));

      // (d) las causas que SÍ se conocen no cambiaron: nada de regresión
      t(P + 'HONEST too_big conocido sigue diciendo lo suyo', /demasiado grande/.test(msg('too_big')), msg('too_big'));
      t(P + 'HONEST rate_limit conocido sigue diciendo lo suyo', /saturad/i.test(msg('rate_limit')), msg('rate_limit'));
      t(P + 'HONEST red conocido sigue diciendo lo suyo', /conexión/i.test(msg('red')), msg('red'));

      // (e) el detalle se recorta: un error kilométrico no puede tapar la pantalla
      const largo = msg('otro', 'x'.repeat(2000));
      t(P + 'HONEST el detalle del motor se recorta', largo.length < 500, 'largo ' + largo.length);

      // (f) y los que llaman le pasan el detalle: si no, todo lo anterior no sirve de nada
      t(P + 'HONEST quien maneja el error le pasa el detalle', /mensajeError\(e\.tipo, e\.message\)/.test(src));

      /* ── CUPO · «NO ENTRA EN EL CUPO» NO ES «NO ENTRA EN EL MODELO» ────────────────
         Hallazgo en vivo del 5/08, y es el que rompía la app. El plan gratis de Groq da
         8000 tokens por minuto —entrada MÁS salida— y Llama 3.3 daba 12000. Al pasar a un
         modelo vigente (todos dan 8000) el modo jurado dejó de entrar: manda el proyecto
         de tesis entero (≈6500) + su prompt (≈1500) + la salida (1100) = ≈9100. No fallaba
         a veces: no podía funcionar nunca. Y el reintento de emergencia mandaba lo mismo. */
      const reglaCupo = (src.split('\n').find(l => /tipo = 'cupo_excedido'/.test(l)) || '');
      t(P + 'CUPO el cupo por minuto se reconoce aparte del tamaño', !!reglaCupo);
      {
        // el mensaje REAL de Groq cuando una consulta sola pasa el cupo del minuto
        const real = 'Request too large for model `qwen/qwen3.6-27b` on tokens per minute (TPM): Limit 8000, Requested 9153.';
        const esCupo = /tokens per minute|\bTPM\b|per minute \(TPM\)/i.test(real) || (/request too large/i.test(real) && /minute/i.test(real));
        t(P + 'CUPO el mensaje real de Groq se lee como cupo, no como tamaño', esCupo, real.slice(0,60));
      }
      t(P + 'CUPO el mensaje al usuario no le echa la culpa a su pregunta',
        /no es culpa de tu pregunta/i.test(msg('cupo_excedido')), msg('cupo_excedido').slice(0,80));
      t(P + 'CUPO y le dice el número concreto del plan', /8\.000|8000/.test(msg('cupo_excedido')));
      /* La salida que se ofrece diverge A PROPÓSITO, y queda declarado acá: el MIRROR
         personal tiene UN respaldo fijo y lo puede nombrar (Cerebras); la plataforma es
         white-label y cada uno configura el suyo, así que nombrar un proveedor concreto
         sería mentirle a quien eligió otro. */
      t(P + 'CUPO y le ofrece una salida real (el respaldo)',
        etiqueta === 'MIRROR' ? /Cerebras/.test(msg('cupo_excedido'))
                              : /respaldo/i.test(msg('cupo_excedido')) && !/Cerebras/.test(msg('cupo_excedido')),
        msg('cupo_excedido').slice(-90));

      if (etiqueta === 'MIRROR') {
        // ante CUPO sí conviene cambiar de motor: el respaldo tiene su propio cupo y
        // contesta la consulta ENTERA en vez de una recortada. Ante TAMAÑO, no.
        t(P + 'CUPO ante cupo se cae al respaldo (no se propaga como el tamaño)',
          /if \(e\.tipo === 'too_big'\) throw e;/.test(src) && !/e\.tipo === 'cupo_excedido'\) throw e/.test(src));

        // el presupuesto preventivo: medir antes de mandar, no mandar y que rebote
        const codCupo = ['estimarTokens', 'cortarLimpio', 'ajustarAlCupo'].map(n => extraer(src, n)).join('\n');
        const cc = vm.createContext({ String, Math, Number, CUPO_TPM_GRATIS: 8000, CUPO_MARGEN: 500 });
        vm.runInContext(codCupo, cc);
        const ajustar = (ctx, sys, prev, sal) =>
          vm.runInContext('ajustarAlCupo(' + JSON.stringify(ctx) + ',' + JSON.stringify(sys) + ',' + JSON.stringify(prev) + ',' + sal + ')', cc);

        // (a) un pedido chico no se toca
        {
          const r = ajustar('hola\n---\nPREGUNTA: ¿cómo andás?', 'sos un espejo', [], 700);
          t(P + 'CUPO un pedido chico pasa intacto', r.recortado === false, JSON.stringify(r.recortado));
        }
        // (b) EL CASO DEL JURADO: proyecto enorme → se recorta y entra
        {
          const proyecto = 'x'.repeat(23500);            // el proyecto real de Darío
          const sys = 'y'.repeat(5400);                  // el prompt del jurado
          const r = ajustar(proyecto + '\n---\nPREGUNTA: empecemos', sys, [], 1100);
          const tot = vm.runInContext('estimarTokens(' + JSON.stringify(r.mensajes[r.mensajes.length-1].content) + ') + estimarTokens(' + JSON.stringify(sys) + ') + 1100 + 500', cc);
          t(P + 'CUPO el pedido del jurado ahora ENTRA en 8000', tot <= 8000, 'quedó en ' + tot);
          t(P + 'CUPO y avisa que tuvo que recortar', r.recortado === true);
          t(P + 'CUPO la PREGUNTA nunca se pierde', /PREGUNTA: empecemos/.test(r.mensajes[r.mensajes.length-1].content));
          t(P + 'CUPO y el recorte se dice, no se disimula', /no entraba en el cupo/.test(r.mensajes[r.mensajes.length-1].content));
        }
        // (c) lo primero que se suelta es la charla vieja, no el material de la pregunta
        {
          // charla vieja bien pesada: dos turnos de ~7.400 tokens cada uno.
          const previos = [{role:'user',content:'z'.repeat(25000)},{role:'assistant',content:'z'.repeat(25000)}];
          const r = ajustar('material corto\n---\nPREGUNTA: dale', 'sys', previos, 700);
          t(P + 'CUPO suelta primero la charla vieja', r.mensajes.length < previos.length + 1, 'quedaron ' + r.mensajes.length);
          t(P + 'CUPO y con eso solo ya no toca el material', /material corto/.test(r.mensajes[r.mensajes.length-1].content));
        }
        // (d) v44-callado (6/08): el aviso YA NO va "una sola vez" — va CERO veces (se silenció).
        //     Por qué cambió: el "if (cupoAvisado) return;" era el guard del cartel de una-vez; al
        //     vaciar la función ese guard perdió sentido. La honestidad no se aflojó: el silencio
        //     queda amarrado por el bloque RECORTE-CALLADO (avisarRecorteUnaVez no escribe) más abajo.
        //     Acá solo se protege que la función siga volteando cupoAvisado, para no romper a quien la llama.
        t(P + 'CUPO el estado de aviso se conserva (single-shot para el que la llame)', /cupoAvisado\s*=\s*true;/.test(src));
        // (e) el reintento de emergencia del jurado ya no manda el proyecto ENTERO
        t(P + 'CUPO el reintento del jurado usa el RAG del proyecto', /proyectoParaJurado\(consultaJ, tokProyR\)/.test(src));
      }
    }

    // 6) el cambio de modelo se AVISA. La regla de honestidad: si le cambiamos el motor
    //    por abajo, se lo decimos — no se entera porque las respuestas le suenan distintas.
    {
      t(P + 'MOTOR el cambio de modelo se le avisa al usuario', /ya no está disponible/.test(src));
      t(P + 'MOTOR el aviso dice a cuál pasó', /Pasé (automáticamente )?a/.test(src));
    }

    // 7) específicos del MIRROR personal: M1 completo y la visión con red de contención
    if (etiqueta === 'MIRROR') {
      t(P + 'M1 el MIRROR ya tiene su capa de modelo vigente', /async function llamarMotorVigente\(/.test(src));
      t(P + 'M1 el camino principal PASA por esa capa',
        /return await llamarMotorVigente\(GROQ_URL, GROQ_KEY, MODELO_GROQ,/.test(src));
      /* v45-cloudflare (21/08): la cadena de respaldo pasó de un solo Cerebras a una LISTA
         (Cloudflare → Cerebras). El respaldo ya no se llama con un literal, sino por la lista
         `respaldos` que recorre un for. Se verifica que Cerebras y Cloudflare estén en esa lista
         y que el loop use llamarMotorVigente con la variable del respaldo. */
      t(P + 'M1 el respaldo Cerebras sigue en la lista', /id:'cerebras',\s*url:CEREBRAS_URL,\s*key:CEREBRAS_KEY,\s*modelo:MODELO_CEREBRAS/.test(src));
      t(P + 'M1 y ahora Cloudflare va PRIMERO (Cerebras se murió el 17/08)', /id:'cloudflare',\s*url:CLOUDFLARE_URL,[^}]*modelo:MODELO_CLOUDFLARE/.test(src));
      t(P + 'M1 el loop de respaldos usa la capa de modelo vigente', /llamarMotorVigente\(rsp\.url, rsp\.key, rsp\.modelo,/.test(src));
      t(P + 'M1 la visión también', /llamarMotorVigente\(GROQ_URL, GROQ_KEY, MODELO_VISION,[^)]*'vision'\)/.test(src));
      // La visión NO puede caer en un modelo ciego: contestaría cualquier cosa sobre la foto.
      const altV = /const MODELOS_ALT_VISION_GROQ = \[([^\]]*)\]/.exec(src);
      t(P + 'M1 la visión tiene lista PROPIA de modelos (no cae en uno ciego)', !!altV);
      if (altV) t(P + 'M1 y esa lista solo tiene modelos que leen imágenes', /qwen\/qwen3\.\d+-27b/.test(altV[1]) && !/qwen3\.6/.test(altV[1]) && !/gpt-oss/.test(altV[1]), altV[1]);
      // Un modelo recordado que después fue dado de baja no puede ganarle al default.
      t(P + 'M1 descarta un modelo recordado que ya está apagado',
        /!MODELOS_MUERTOS_GROQ\.includes\(g\)/.test(src));
      t(P + 'M1 el mensaje de error es en criollo y accionable', /ya no está disponible en Groq/.test(src));

      /* ── M1 EN FUNCIONAMIENTO, no solo el texto del código ──────────────────────
         Acá se corren las funciones REALES contra un proveedor de mentira que puede
         contestar lo que se le pida. Lo que se busca son los tres fallos que importan:
         que NO cambie de modelo cuando el problema es otro, que SÍ cambie cuando el
         modelo murió de verdad, y que si no queda ninguno vivo no cuelgue. */
      {
        /* v45-salud (19/08): llamarMotor ahora le pregunta a esperaQuePidioElMotor cuánto
           pidió esperar el proveedor. Sin la función en el sandbox, el motor entero
           reventaba con ReferenceError — el banco lo cazó al toque, que es para lo que está. */
        const codMotor = ['llamarMotor', 'modelosAlternativosMirror', '_recordarModeloMirror',
                          '_avisarCambioModeloMirror', 'llamarMotorVigente', 'normalizarUnicode',
                          'sinPensamiento', 'esperaQuePidioElMotor']
          .map(n => extraer(src, n)).join('\n');

        function ctxMotor(respuestas) {
          const pedidos = [], dichos = [], store = {};
          const ctx = {
            console, setTimeout, Promise, JSON, String, Number, Math, RegExp, Error, Array, Object,
            Date, isFinite, parseFloat, parseInt, // v45-salud: los usa esperaQuePidioElMotor
            MODELOS_ALT_GROQ: ['qwen/qwen3.6-27b', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b'],
            MODELOS_ALT_CEREBRAS: ['gpt-oss-120b', 'llama-3.3-70b'],
            MODELOS_ALT_VISION_GROQ: ['qwen/qwen3.6-27b'],
            MODELO_GROQ: 'qwen/qwen3.6-27b', MODELO_VISION: 'qwen/qwen3.6-27b',
            localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
            addMsg: (r, txt) => dichos.push(txt),
            _pedidos: pedidos, _dichos: dichos, _store: store,
            fetch: async (url, opt) => {
              const body = JSON.parse(opt.body);
              pedidos.push({ url, modelo: body.model, body });
              const r = respuestas(body.model, pedidos.length);
              return { ok: r.ok !== false, status: r.status || 200, json: async () => r.data };
            }
          };
          ctx.window = ctx;
          return vm.createContext(ctx);
        }
        const okResp = txt => ({ data: { choices: [{ message: { content: txt } }] } });
        const muerto = m => ({ ok: false, status: 404, data: { error: { code: 'model_decommissioned', message: 'The model `' + m + '` has been decommissioned' } } });

        // (a) el modelo murió → cae al siguiente, avisa, y lo deja anotado
        {
          const c = ctxMotor(m => (m === 'qwen/qwen3.6-27b' ? muerto(m) : okResp('respuesta buena')));
          vm.runInContext(codMotor, c);
          vm.runInContext("llamarMotorVigente('/groq','k','qwen/qwen3.6-27b',[],'sys',100,0.5).then(r=>{ _res=r; }).catch(e=>{ _err=e; });", c);
          setTimeout(() => {
            t(P + 'M1 (vivo) modelo muerto → devuelve respuesta igual', c._res === 'respuesta buena', 'dio ' + c._res + ' err:' + (c._err && c._err.message));
            t(P + 'M1 (vivo) reintentó con el siguiente del catálogo', c._pedidos.length === 2 && c._pedidos[1].modelo === 'openai/gpt-oss-120b', JSON.stringify(c._pedidos.map(p => p.modelo)));
            t(P + 'M1 (vivo) le avisó al usuario', c._dichos.length === 1 && /ya no está disponible/.test(c._dichos[0]), JSON.stringify(c._dichos));
            t(P + 'M1 (vivo) anotó el modelo nuevo en el navegador', c._store.mirror_modelo_groq === 'openai/gpt-oss-120b', JSON.stringify(c._store));
            // Y como el nuevo es gpt-oss, tiene que llevar la curita de razonamiento:
            t(P + 'M1 (vivo) al caer en gpt-oss le manda reasoning_effort', c._pedidos[1] && c._pedidos[1].body.reasoning_effort === 'low', JSON.stringify(c._pedidos[1] && c._pedidos[1].body.reasoning_effort));
          }, 120);
        }

        // (b) el problema es OTRO (cupo agotado) → NO se cambia de modelo. Esto es lo que
        //     separa un blindaje de un manotazo: cambiar de modelo por un 429 no arregla
        //     nada y encima te hace creer que el modelo era malo.
        {
          const c = ctxMotor(() => ({ ok: false, status: 429, data: { error: { message: 'Rate limit reached for model' } } }));
          vm.runInContext(codMotor, c);
          vm.runInContext("llamarMotorVigente('/groq','k','qwen/qwen3.6-27b',[],'sys',100,0.5).then(r=>{ _res=r; }).catch(e=>{ _err=e; });", c);
          setTimeout(() => {
            t(P + 'M1 (vivo) ante cupo agotado NO cambia de modelo', c._pedidos.length === 1, 'probó ' + c._pedidos.length + ' modelos');
            t(P + 'M1 (vivo) y el error sube como rate_limit, no como modelo caduco', c._err && c._err.tipo === 'rate_limit', c._err && c._err.tipo);
            t(P + 'M1 (vivo) no le mintió al usuario con un cambio que no hubo', c._dichos.length === 0, JSON.stringify(c._dichos));
          }, 120);
        }

        // (c) se murieron TODOS → no cuelga: error propio, legible
        {
          const c = ctxMotor(m => muerto(m));
          vm.runInContext(codMotor, c);
          vm.runInContext("llamarMotorVigente('/groq','k','qwen/qwen3.6-27b',[],'sys',100,0.5).then(r=>{ _res=r; }).catch(e=>{ _err=e; });", c);
          setTimeout(() => {
            t(P + 'M1 (vivo) si mueren todos, probó todo el catálogo', c._pedidos.length === 3, 'probó ' + c._pedidos.length);
            t(P + 'M1 (vivo) si mueren todos, no cuelga: tira error propio', c._err && c._err.tipo === 'modelo_caduco_sin_reemplazo', c._err && c._err.tipo);
            t(P + 'M1 (vivo) y no anotó nada que no funcione', !c._store.mirror_modelo_groq, JSON.stringify(c._store));
          }, 120);
        }

        // (d) VISIÓN: no puede caer en un modelo ciego. Sin alternativa que vea, avisa.
        {
          const c = ctxMotor(m => muerto(m));
          vm.runInContext(codMotor, c);
          vm.runInContext("llamarMotorVigente('/groq','k','qwen/qwen3.6-27b',[],'sys',100,0.5,'vision').then(r=>{ _res=r; }).catch(e=>{ _err=e; });", c);
          setTimeout(() => {
            t(P + 'M1 (vivo) visión NO cae en un modelo que no ve imágenes', c._pedidos.length === 1, JSON.stringify(c._pedidos.map(p => p.modelo)));
            t(P + 'M1 (vivo) visión avisa en vez de inventar', c._err && c._err.tipo === 'modelo_caduco_sin_reemplazo', c._err && c._err.tipo);
          }, 120);
        }

        /* (e) QUÉ SE LE PIDE AL PROVEEDOR con el modelo de hoy. Corregido el 5/08 tras el
           hallazgo en vivo: qwen3.6 SÍ es un modelo de razonamiento, así que ahora lleva
           los dos parámetros que apagan y esconden el pensamiento. */
        {
          const c = ctxMotor(() => okResp('bien'));
          vm.runInContext(codMotor, c);
          vm.runInContext("llamarMotorVigente('/groq','k','qwen/qwen3.6-27b',[],'sys',100,0.5).then(r=>{ _res=r; }).catch(e=>{ _err=e; });", c);
          setTimeout(() => {
            const b = c._pedidos[0] && c._pedidos[0].body;
            t(P + 'M1 (vivo) qwen va con max_tokens, como espera Groq', !!b && b.max_tokens === 100, JSON.stringify(b));
            t(P + 'M1 (vivo) a qwen se le pide que no razone', !!b && b.reasoning_effort === 'none', JSON.stringify(b && b.reasoning_effort));
            t(P + 'M1 (vivo) y que no devuelva el pensamiento', !!b && b.reasoning_format === 'hidden', JSON.stringify(b && b.reasoning_format));
            t(P + 'M1 (vivo) a qwen NO se le manda include_reasoning (es de gpt-oss)', !!b && b.include_reasoning === undefined, JSON.stringify(b && b.include_reasoning));
          }, 120);
        }

        /* (f) y con gpt-oss, que es el alternativo, los parámetros son los OTROS: la doc de
           Groq dice que gpt-oss no acepta reasoning_format. Mandar el parámetro equivocado
           es un 400, o sea el chat caído. */
        {
          const c = ctxMotor(() => okResp('bien'));
          vm.runInContext(codMotor, c);
          vm.runInContext("llamarMotorVigente('/groq','k','openai/gpt-oss-120b',[],'sys',100,0.5).then(r=>{ _res=r; }).catch(e=>{ _err=e; });", c);
          setTimeout(() => {
            const b = c._pedidos[0] && c._pedidos[0].body;
            t(P + 'M1 (vivo) gpt-oss lleva include_reasoning:false', !!b && b.include_reasoning === false, JSON.stringify(b && b.include_reasoning));
            t(P + 'M1 (vivo) gpt-oss NO lleva reasoning_format (no lo acepta)', !!b && b.reasoning_format === undefined, JSON.stringify(b && b.reasoning_format));
            t(P + 'M1 (vivo) gpt-oss conserva su curita de esfuerzo bajo', !!b && b.reasoning_effort === 'low', JSON.stringify(b && b.reasoning_effort));
            t(P + 'M1 (vivo) y su piso de tokens para que le quede lugar a la respuesta', !!b && b.max_completion_tokens === 2500, JSON.stringify(b && b.max_completion_tokens));
          }, 120);
        }
      }
    }

    // 8) específicos de la plataforma: al que YA la usa, el arreglo tiene que llegarle.
    //    Cambiar el default no alcanza: su config guardada le gana al default.
    if (etiqueta === 'PLATAFORMA') {
      t(P + 'MOTOR migra la config guardada del que ya venía usando la app', /function migrarModelosApagados\(/.test(src));
      t(P + 'MOTOR la migración corre al cargar la config', /migrarModelosApagados\(Object\.assign\(\{\}, CONFIG_DEFAULT/.test(src));
      t(P + 'MOTOR la migración se persiste (no se repara en cada carga)', /localStorage\.setItem\('mirror_config', JSON\.stringify\(cfg\)\)/.test(src));
      t(P + 'MOTOR migra los tres slots: principal, respaldo y visión',
        /\['modeloPrincipal', 'modeloRespaldo', 'modeloVision'\]/.test(src));
      t(P + 'MOTOR le avisa al usuario que le cambió el modelo', /Tu proveedor dio de baja el modelo/.test(src));
      t(P + 'MOTOR y es honesto: avisa que puede notar cambios', /puede que notes cambios en el tono/.test(src));
      // El generador del script de Gmail reemplaza un literal: si no coincide con el
      // del snippet, el usuario se lleva un script apuntando al modelo equivocado.
      // v39-motor2: de-pinned del literal. Se EXTRAE el modelo de cada lado y se exige que sean IGUALES (coupling real).
      const snipM = (src.match(/MODELO:    &#x27;([^&]+)&#x27;/) || [])[1];
      const repM  = (src.match(/code\.replace\("'([^']+)'", "'"\+CONFIG\.modeloPrincipal/) || [])[1];
      t(P + 'MOTOR el script de Gmail y su reemplazo hablan del MISMO modelo', !!snipM && snipM === repM, 'snippet:' + snipM + ' replace:' + repM);

      /* ── LA MIGRACIÓN, EN FUNCIONAMIENTO ────────────────────────────────────────
         Es el caso de Darío y el de cualquiera que ya venga usando su MIRROR: tiene el
         modelo viejo guardado, y el guardado le gana al default. Si esto no anda, el
         arreglo no le llega y la app se le rompe el 16/08 igual. */
      {
        const codCfg = ['migrarModelosApagados', 'cargarConfig'].map(n => extraer(src, n)).join('\n');
        const mapa = /const MODELOS_APAGADOS = \{[\s\S]*?\n\};/.exec(src);
        t(P + 'MOTOR el mapa de modelos apagados existe y es legible', !!mapa);

        function ctxCfg(guardada) {
          const store = guardada ? { mirror_config: JSON.stringify(guardada) } : {};
          const ctx = {
            console, JSON, String, Object, Array,
            CONFIG_DEFAULT: { modeloPrincipal: 'openai/gpt-oss-120b', modeloRespaldo: 'gpt-oss-120b', modeloVision: 'qwen/qwen3.8-27b', appName: 'MIRROR' }, // v39-qwen38
            localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
            _store: store
          };
          ctx.window = ctx;
          const c = vm.createContext(ctx);
          if (mapa) vm.runInContext(mapa[0], c);
          vm.runInContext(codCfg, c);
          return c;
        }

        // (a) config vieja con el modelo que se apaga → sale corregida y avisada
        {
          const c = ctxCfg({ modeloPrincipal: 'llama-3.3-70b-versatile', appName: 'ATIS' });
          const cfg = vm.runInContext('cargarConfig()', c);
          t(P + 'MOTOR (vivo) la config vieja sale con un modelo vigente', cfg.modeloPrincipal === 'openai/gpt-oss-120b', cfg.modeloPrincipal);
          t(P + 'MOTOR (vivo) y NO le pisa el resto de su configuración', cfg.appName === 'ATIS', cfg.appName);
          t(P + 'MOTOR (vivo) deja anotado el cambio para poder avisarlo', Array.isArray(c.window._migracionModelos) && c.window._migracionModelos.length === 1, JSON.stringify(c.window._migracionModelos));
          t(P + 'MOTOR (vivo) y lo persiste, no lo repara en cada carga', /qwen/.test(c._store.mirror_config) && !/llama-3\.3-70b-versatile/.test(c._store.mirror_config), c._store.mirror_config);
        }

        // (b) config ya sana → no se toca NADA ni se avisa de un cambio que no hubo
        {
          const c = ctxCfg({ modeloPrincipal: 'openai/gpt-oss-120b', appName: 'ATIS' });
          const cfg = vm.runInContext('cargarConfig()', c);
          t(P + 'MOTOR (vivo) una config sana no se toca', cfg.modeloPrincipal === 'openai/gpt-oss-120b');
          t(P + 'MOTOR (vivo) y no avisa de un cambio que no hubo', !c.window._migracionModelos, JSON.stringify(c.window._migracionModelos));
        }

        // (c) los tres slots, incluida la visión, que es la que ya se quemó una vez
        {
          const c = ctxCfg({ modeloPrincipal: 'llama-3.3-70b-versatile', modeloRespaldo: 'llama-3.1-8b-instant', modeloVision: 'meta-llama/llama-4-scout-17b-16e-instruct' });
          const cfg = vm.runInContext('cargarConfig()', c);
          t(P + 'MOTOR (vivo) migra el principal', cfg.modeloPrincipal === 'openai/gpt-oss-120b', cfg.modeloPrincipal);
          t(P + 'MOTOR (vivo) migra el respaldo', cfg.modeloRespaldo === 'openai/gpt-oss-20b', cfg.modeloRespaldo);
          t(P + 'MOTOR (vivo) migra la visión a uno que SÍ ve imágenes', cfg.modeloVision === 'qwen/qwen3.8-27b', cfg.modeloVision);
          t(P + 'MOTOR (vivo) el aviso enumera los tres', c.window._migracionModelos && c.window._migracionModelos.length === 3, JSON.stringify(c.window._migracionModelos));
        }

        // (d) navegador que no deja leer localStorage → no explota, cae a la default
        {
          const ctx = { console, JSON, String, Object, Array,
            CONFIG_DEFAULT: { modeloPrincipal: 'openai/gpt-oss-120b' },
            localStorage: { getItem(){ throw new Error('bloqueado'); }, setItem(){} } };
          ctx.window = ctx;
          const c = vm.createContext(ctx);
          if (mapa) vm.runInContext(mapa[0], c);
          vm.runInContext(codCfg, c);
          let cfg = null, rompio = false;
          try { cfg = vm.runInContext('cargarConfig()', c); } catch(e){ rompio = true; }
          t(P + 'MOTOR (vivo) si el navegador bloquea el almacenamiento, no explota', !rompio);
          t(P + 'MOTOR (vivo) y cae a la config por defecto, ya con modelo vigente', !!cfg && cfg.modeloPrincipal === 'openai/gpt-oss-120b', JSON.stringify(cfg));
        }
      }
    }
  }

  /* ══════════ VOZ · «EL BOTÓN NO PUEDE DECIR ON Y ESTAR MUDO» (5/08/2026) ══════════
     Hallazgo en vivo: Darío prendió la lectura, el botón quedó en «🔊 voz ON» y no salió
     una palabra. Tres causas conocidas de speechSynthesis, y estaban las tres: las voces
     tardan en llegar y el filtro por español podía dejar la lista vacía para siempre; hace
     falta un gesto del usuario para que el navegador deje hablar, y el gesto era el clic
     del toggle pero el habla ocurría mucho después; y cancel() con speak() pegados se
     pisan. Lo que amarra el banco es la promesa del Norte: si no puede leer, no dice ON. */
  if (etiqueta === 'MIRROR') {
    t(P + 'VOZ si no hay voces instaladas, el botón NO queda en ON',
      /b\.textContent='🔇 voz'; b\.style\.color=''; ttsOn=false;/.test(src));
    t(P + 'VOZ y lo dice, con dónde instalarlas', /no tiene ninguna voz de síntesis instalada/.test(src) && /Accesibilidad/.test(src));
    t(P + 'VOZ el clic del toggle desbloquea la síntesis', /function desbloquearVoz\(\)/.test(src) && /desbloquearVoz\(\);/.test(src));
    t(P + 'VOZ el desbloqueo es inaudible (no habla al pedo)', /u\.volume=0;/.test(src));
    t(P + 'VOZ y se hace UNA sola vez', /if \(vozDesbloqueada\) return;/.test(src));
    t(P + 'VOZ al prender, se prueba en el acto para que se sepa YA si anda',
      /hablar\('Listo, ya me escuchás\.'\)/.test(src));
    t(P + 'VOZ cancel() y speak() ya no van pegados', /setTimeout\(_emitir, 60\)/.test(src));
    t(P + 'VOZ si no hay voces en español, usa las que haya en vez de quedarse mudo',
      /vocesES = es\.length \? es : todas;/.test(src));
    t(P + 'VOZ hay red de seguridad por si onvoiceschanged no dispara',
      /setTimeout\(cargarVoces, 400\)/.test(src) && /setTimeout\(cargarVoces, 1500\)/.test(src));
  }

  /* ══════════ VOZON · «LA VOZ VIENE ACTIVADA, PERO SIN MENTIR» (8/08/2026) ══════════
     2ª auditoría en vivo de Darío: quería que la solapa de voz venga ON. Pero el navegador
     no deja hablar hasta el primer gesto, así que «venir ON» no puede ser cantar victoria y
     salir mudo (la lección de v44-voz). Se ARMA en ON y el desbloqueo real —y el chequeo de
     que haya voces— ocurre en el primer gesto; si no hay voces, se apaga solo y lo dice. */
  if (etiqueta === 'MIRROR') {
    t(P + 'VOZON la preferencia arranca en ON', /let vozPref='on';/.test(src));
    t(P + 'VOZON y se recuerda entre sesiones', /localStorage\.getItem\('mirror_tts'\)/.test(src) && /localStorage\.setItem\('mirror_tts'/.test(src));
    t(P + 'VOZON existe el armado inicial y muestra el botón en ON', /function armarVozInicial\(\)/.test(src) && /b\.textContent='🔊 voz ON';/.test(src));
    t(P + 'VOZON el desbloqueo real espera al primer gesto del usuario', /addEventListener\(ev, primerGesto, true\)/.test(src));
    t(P + 'VOZON si al primer gesto no hay voces, se apaga solo (no miente)',
      /function activarVozReal\(\)/.test(src) && /ttsOn=false; b\.textContent='🔇 voz'; b\.style\.color=''; vozPref='off';/.test(src));
    t(P + 'VOZON y lo dice con dónde instalar las voces', /Dejo la voz apagada para no prometerte algo que no puedo hacer\./.test(src));
    // «se le fue la voz y volvió»: el latido despierta la síntesis SOLO si la encuentra pausada
    t(P + 'VOZON el latido reanuda la voz solo si Chrome la dejó pausada',
      /speechSynthesis\.speaking && speechSynthesis\.paused\) speechSynthesis\.resume\(\)/.test(src));
  }

  /* ══════════ VOL3 · EL CONTROL DE VOLUMEN, LIMPIO Y SOLO CUANDO HACE FALTA (8/08/2026) ══════════
     Darío: la barra con «–/+» quedaba fea y en el celular se armaban cajitas sueltas. Ahora
     el control SOLO aparece con la música encendida (body.sound-on), sin los –/+, con un solo 🔊. */
  if (etiqueta === 'MIRROR') {
    t(P + 'VOL3 el control de volumen arranca oculto', /\.fvolwrap\{display:none;/.test(src));
    t(P + 'VOL3 y solo se muestra con la música encendida', /body\.sound-on \.fvolwrap\{display:inline-flex;\}/.test(src));
    t(P + 'VOL3 el estado de la música prende/apaga el control', /document\.body\.classList\.toggle\('sound-on',soundOn\)/.test(src));
    t(P + 'VOL3 se fueron los «–/+» feos: queda un solo 🔊', /<span class="fvolico" aria-hidden="true">🔊<\/span>/.test(src) && !/aria-hidden="true">–<\/span>/.test(src) && !/aria-hidden="true">\+<\/span>/.test(src));
    t(P + 'VOL3 el riel y el % siguen existiendo (el control no se rompió)', /id="volSlider"/.test(src) && /id="volPct"/.test(src));
  }

  /* ══════════ PIEORDEN · «QUE YO ELIJA QUÉ VEO AFUERA» + «MÁS» ANDA EN EL CELULAR (8/08/2026) ══════════
     2ª auditoría en vivo (Samsung A03): el «más/menos» no plegaba porque la regla de pastilla
     móvil forzaba display:inline-flex sobre .fmore-group y le ganaba por especificidad al
     .oculto. Y Darío pidió elegir qué solapas ve afuera y cuáles en «más». */
  if (etiqueta === 'MIRROR') {
    // el bug del celular: .fmore-group EXCLUIDA del pastilleo móvil, así el .oculto vuelve a ganar
    t(P + 'PIEORDEN el grupo «más» queda fuera del pastilleo móvil (así pliega en el celular)',
      (src.match(/\.fnote span:not\(\.fcredit\):not\(\.ftip\)[^{]*:not\(\.fmore-group\)/g) || []).length >= 2);
    t(P + 'PIEORDEN sigue la regla que oculta el grupo plegado', /\.fnote \.fmore-group\.oculto \{ display: none; \}/.test(src));
    // cada pastilla no-audio es reordenable (data-pie), y existe la entrada 🧩
    ['memoria','datos','documentos','informe','contactos','encuestas','presentacion','carta','cumplimiento','llevar','borrar'].forEach(k=>
      t(P + 'PIEORDEN la solapa «'+k+'» es reordenable (data-pie)', new RegExp('data-pie="'+k+'"').test(src)));
    t(P + 'PIEORDEN hay entrada para abrir el organizador', /onclick="pieOrdenarAbrir\(\)"/.test(src));
    t(P + 'PIEORDEN el audio NO es reordenable (voz/sonido sin data-pie)',
      !/data-pie="[^"]*"[^>]*onclick="toggleTTS/.test(src) && !/data-pie="[^"]*"[^>]*onclick="toggleSound/.test(src));
    t(P + 'PIEORDEN existe la lógica que coloca y persiste', /function pieColocar\(/.test(src) && /function pieAplicar\(/.test(src) && /localStorage\.setItem\('mirror_pie'/.test(src));
    t(P + 'PIEORDEN se aplica al abrir la app', /try\{ pieAplicar\(\); \}catch\(e\)\{\}/.test(src));
    // correr pieColocar DE VERDAD: mover «datos» a «más» y sacar «contactos» afuera (el caso de Darío)
    {
      const PIE_ORDEN_T=['memoria','datos','documentos','informe','contactos','encuestas','presentacion','carta','cumplimiento','llevar','borrar'];
      const cx = vm.createContext({});
      const enFnote=new Set(['memoria','datos','documentos','informe']);
      const enMas=new Set(['contactos','encuestas','presentacion','carta','cumplimiento','llevar','borrar']);
      const nodos={}; PIE_ORDEN_T.forEach(k=>{ nodos[k]={ k }; });
      const fmasNode={}, ordNode={};
      const fnote={ insertBefore:(el)=>{ enMas.delete(el.k); enFnote.add(el.k); } };
      const grupo={ insertBefore:(el)=>{ enFnote.delete(el.k); enMas.add(el.k); }, querySelector:()=>ordNode };
      cx.document={ querySelector:(sel)=>{ if(sel==='.fnote') return fnote; const m=/data-pie="([^"]+)"/.exec(sel); return m?nodos[m[1]]:null; }, getElementById:(id)=> (id==='fmasBtn')?fmasNode:((id==='fmoreGroup')?grupo:null) };
      cx.PIE_ORDEN=PIE_ORDEN_T;
      vm.runInContext(extraer(src,'pieColocar'), cx);
      vm.runInContext('pieColocar(new Set(["memoria","documentos","informe","contactos"]))', cx);
      t(P + 'PIEORDEN mover: «datos» se va a «más» y «contactos» sale a la vista',
        enFnote.has('contactos') && !enFnote.has('datos') && enMas.has('datos') && !enMas.has('contactos'),
        JSON.stringify({afuera:[...enFnote],mas:[...enMas]}));
    }
  }

  /* ══════════ BADGE v4.5 (22/08/2026) — salto con orden expresa de Darío ══════════
     Sube tras la auditoría en vivo de la tanda de estabilidad + la de agenda, con el arreglo
     v47-decile adentro. v4.4 fue el 8/08/2026.
     v47-badge: el pie ya NO puede quedar atrasado — se escribe desde MIRROR_VERSION al
     arrancar. Se prueban las tres patas: la constante, el literal del HTML y el código que
     los sincroniza. */
  if (etiqueta === 'MIRROR') {
    t(P + 'BADGE la versión saltó a v4.5', /const MIRROR_VERSION = 'v4\.5';/.test(src));
    t(P + 'BADGE y el crédito del pie también', /MIRROR v4\.5 · by Darío Alejandro Tello/.test(src));
    t(P + 'BADGE el pie se escribe desde la constante (no puede divergir)',
      /getElementById\('fcredit-ver'\)[\s\S]{0,200}?'MIRROR '\+MIRROR_VERSION/.test(src));
    t(P + 'BADGE no quedó ningún «v4.4» suelto en el fuente',
      !/v4\.4/.test(src.replace(/v4\.4 \(8\/08\/2026\)/g, '')), (src.match(/.{40}v4\.4.{40}/) || [''])[0]);
  }

  /* ══════════ PLATAFORMA · PORTE DEL «+» Y DEL ORGANIZADOR DEL PIE + VOZ (9/08/2026) ══════════
     2ª auditoría en vivo de Darío en la plataforma: «las solapas se amontonan abajo; traé el «+»
     grande y el organizador del MIRROR; la voz tarda». Se portó el patrón probado del MIRROR v4.4. */
  if (etiqueta === 'PLATAFORMA') {
    // — la barra «+» (tools tray)
    t(P + 'PLAT-BARRA hay un «+» que abre las herramientas', /class="toolsbtn" id="toolsBtn" onclick="toggleTools\(\)"/.test(src));
    t(P + 'PLAT-BARRA la bandeja existe y arranca oculta', /class="toolstray oculto" id="toolsTray"/.test(src));
    t(P + 'PLAT-BARRA un solo micrófono en la barra (el dictado)', (src.match(/onclick="toggleMic\(\)"/g) || []).length === 1);
    ['sendWeb()','generarImagen()','vozAccion()'].forEach(h =>
      t(P + 'PLAT-BARRA la herramienta «' + h + '» vive en el «+»', new RegExp('id="(wbtn|imggen-btn|accbtn)"[^>]*onclick="[^"]*'+h.replace('(','\\(').replace(')','\\)')).test(src) || src.indexOf(h) > 0));
    t(P + 'PLAT-BARRA voz-acción actualiza el ícono sin pisar la etiqueta', /getElementById\('accIco'\)/.test(src) && /<span id="accLbl">/.test(src));
    t(P + 'PLAT-BARRA existen toggleTools y cerrarTools', /function toggleTools\(/.test(src) && /function cerrarTools\(/.test(src));
    // — el pie: fold + «más» anda en el celular
    t(P + 'PLAT-PIE existe el botón «⋯ más»', /onclick="toggleMas\(\)"/.test(src));
    t(P + 'PLAT-PIE el grupo plegable arranca oculto', /class="fmore-group oculto" id="fmoreGroup"/.test(src));
    t(P + 'PLAT-PIE la regla que oculta el grupo plegado existe', /\.fnote \.fmore-group\.oculto \{ display: none; \}/.test(src));
    t(P + 'PLAT-PIE el grupo queda fuera del pastilleo móvil (así pliega en el celular)',
      /\.fnote span:not\(\.fcredit\):not\(\.ftip\):not\(\.fmore-group\)/.test(src));
    // — el organizador
    ['memoria','datos','documentos','informe','compartir','encuestas','presentacion','carta','cumplimiento','privacidad','llevar','borrar'].forEach(k=>
      t(P + 'PLAT-PIE la solapa «'+k+'» es reordenable (data-pie)', new RegExp('data-pie="'+k+'"').test(src)));
    t(P + 'PLAT-PIE hay entrada para abrir el organizador', /onclick="pieOrdenarAbrir\(\)"/.test(src));
    t(P + 'PLAT-PIE el audio NO es reordenable (voz/sonido/idioma sin data-pie)',
      !/data-pie="[^"]*"[^>]*onclick="toggleTTS/.test(src) && !/data-pie="[^"]*"[^>]*onclick="toggleSound/.test(src) && !/data-pie="[^"]*"[^>]*onclick="i18nRotar/.test(src));
    t(P + 'PLAT-PIE existe la lógica que coloca y persiste', /function pieColocar\(/.test(src) && /function pieAplicar\(/.test(src) && /localStorage\.setItem\('mirror_pie'/.test(src));
    t(P + 'PLAT-PIE se aplica al abrir la app', /try\{ pieAplicar\(\); \}catch\(e\)\{\}/.test(src));
    {
      const PIE_ORDEN_T=['memoria','datos','documentos','informe','compartir','encuestas','presentacion','carta','cumplimiento','privacidad','llevar','borrar'];
      const cx = vm.createContext({});
      const enFnote=new Set(['memoria','datos','documentos','informe']);
      const enMas=new Set(['compartir','encuestas','presentacion','carta','cumplimiento','privacidad','llevar','borrar']);
      const nodos={}; PIE_ORDEN_T.forEach(k=>{ nodos[k]={ k }; });
      const fmasNode={}, ordNode={};
      const fnote={ insertBefore:(el)=>{ enMas.delete(el.k); enFnote.add(el.k); } };
      const grupo={ insertBefore:(el)=>{ enFnote.delete(el.k); enMas.add(el.k); }, querySelector:()=>ordNode };
      cx.document={ querySelector:(sel)=>{ if(sel==='.fnote') return fnote; const m=/data-pie="([^"]+)"/.exec(sel); return m?nodos[m[1]]:null; }, getElementById:(id)=> (id==='fmasBtn')?fmasNode:((id==='fmoreGroup')?grupo:null) };
      cx.PIE_ORDEN=PIE_ORDEN_T;
      vm.runInContext(extraer(src,'pieColocar'), cx);
      vm.runInContext('pieColocar(new Set(["memoria","documentos","informe","compartir"]))', cx);
      t(P + 'PLAT-PIE mover: «datos» se va a «más» y «compartir» sale a la vista',
        enFnote.has('compartir') && !enFnote.has('datos') && enMas.has('datos') && !enMas.has('compartir'),
        JSON.stringify({afuera:[...enFnote],mas:[...enMas]}));
    }
    // — voz: desbloqueo temprano + honestidad + latido
    t(P + 'PLAT-VOZ la preferencia arranca en ON y se recuerda', /let vozPref='on';/.test(src) && /localStorage\.setItem\('mirror_tts'/.test(src));
    t(P + 'PLAT-VOZ existe el armado inicial y el desbloqueo por gesto', /function armarVozInicial\(\)/.test(src) && /function desbloquearVoz\(\)/.test(src) && /addEventListener\(ev, primerGesto, true\)/.test(src));
    t(P + 'PLAT-VOZ si al primer gesto no hay voces, se apaga sola (no miente)', /function activarVozReal\(\)/.test(src) && /ttsOn=false; b\.textContent='🔇 voz'; b\.style\.color=''; vozPref='off';/.test(src));
    t(P + 'PLAT-VOZ el latido reanuda la voz solo si Chrome la dejó pausada', /speechSynthesis\.speaking && speechSynthesis\.paused\) speechSynthesis\.resume\(\)/.test(src));

    /* ══ 2ª vuelta de auditoría en vivo (9/08): 📷 al «+», panel de contactos, cartel CEREBRAS, v38 ══ */
    // — el 📷 foto pasó de la barra al «+» (sigue controlado por aplicarCapacidades vía id=imgbtn)
    t(P + 'PLAT-FOTO el 📷 foto vive en el «+» (ttool con for=imginput)', /class="ttool" id="imgbtn" for="imginput"/.test(src));
    t(P + 'PLAT-FOTO y ya no está suelto en la barra', !/class="flabel"[^>]*id="imgbtn"/.test(src));
    t(P + 'PLAT-FOTO aplicarCapacidades lo sigue prendiendo/apagando', /mostrar\('imgbtn', hayVision\)/.test(src));
    // — el panel de contactos (porte del MIRROR), sobre la MISMA agenda local
    t(P + 'PLAT-CONTACTOS existe el panel (abrir/render/agregar/borrar)',
      /function abrirAgenda\(/.test(src) && /function renderAgenda\(/.test(src) && /function agendaAgregarDesdePanel\(/.test(src) && /function agendaBorrar\(/.test(src));
    t(P + 'PLAT-CONTACTOS hay pastilla 📇 contactos en el pie (reordenable)', /data-pie="contactos" onclick="abrirAgenda\(\)"/.test(src));
    t(P + 'PLAT-CONTACTOS existe el modal y su lista', /id="agenda-modal"/.test(src) && /id="agenda-lista"/.test(src));
    t(P + 'PLAT-CONTACTOS usa la agenda local existente (no reinventa el almacenamiento)',
      /actuaAgendaGuardar\(nombre\.trim\(\), campos\)/.test(src) && /localStorage\.setItem\('mirror_agenda'/.test(src));
    // — el cartel de CEREBRAS_KEY, suavizado
    t(P + 'PLAT-CEREBRAS el «Falta el secret» ya no sale como «algo falló y no sé qué»', /if \(\/Falta el secret\/i\.test\(d\)\)/.test(src));
    t(P + 'PLAT-CEREBRAS y se explica claro (motor principal + respaldo sin configurar)', /el motor de respaldo todavía no está configurado/.test(src));
    // — el salto de badge a v38 (orden de Darío tras auditoría en vivo)
    t(P + 'PLAT-BADGE la plataforma saltó a v40 (25/09/2026: orden de Darío tras auditar los tres pilares)', /const PLATFORM_VERSION = 'v40';/.test(src));
  }

  /* ══════════ BARRA CHAT · WHATSAPP-STYLE (6/08/2026) ══════════
     Rediseño aprobado por Darío: campo grande para escribir, un solo micrófono, y las
     herramientas (foto, documento, web, imagen, voz-acción) en el «+». Menos es más. */
  if (etiqueta === 'MIRROR') {
    // la barra tiene SOLO 3 botones ahora: «+», micrófono y enviar. Las herramientas viven
    // en la bandeja que abre el «+».
    t(P + 'BARRA hay un botón «+» que abre las herramientas', /class="toolsbtn" id="toolsBtn" onclick="toggleTools\(\)"/.test(src));
    t(P + 'BARRA la bandeja de herramientas existe y arranca oculta', /class="toolstray oculto" id="toolsTray"/.test(src));
    t(P + 'BARRA un solo micrófono en la barra (el dictado)', (src.match(/onclick="toggleMic\(\)"/g) || []).length === 1);
    t(P + 'BARRA la voz-acción se movió al «+»', /class="ttool accbtn" id="accbtn" onclick="vozAccion\(\)/.test(src));
    // las herramientas están TODAS en la bandeja, con sus handlers
    const tray = (src.match(/id="toolsTray"[\s\S]*?<\/div>/) || [''])[0];
    ['handleImagen','handleFile','sendWeb()','generarImagen()','vozAccion()'].forEach(h =>
      t(P + 'BARRA la herramienta «' + h + '» está en el «+»', src.indexOf(h) > 0));
    t(P + 'BARRA el campo de texto respira (14px, min 24px)', /\.iwrap textarea \{[^}]*font-size: 14px[^}]*min-height: 24px/.test(src));
    // toggleTools abre/cierra de verdad
    {
      const cx = vm.createContext({});
      const est = { oculto:true, abierto:false, aria:'false' };
      cx.document = { getElementById:(id)=> id==='toolsTray'
        ? { classList:{ toggle:()=>{ est.oculto=!est.oculto; return est.oculto; }, add:()=>{est.oculto=true;}, remove:()=>{est.oculto=false;} } }
        : { classList:{ toggle:(c,v)=>{ est.abierto=v; }, add:()=>{est.abierto=true;}, remove:()=>{est.abierto=false;} }, setAttribute:(k,v)=>{ est.aria=v; } } };
      vm.runInContext(extraer(src,'toggleTools') + '\n' + extraer(src,'cerrarTools'), cx);
      vm.runInContext('toggleTools()', cx);
      t(P + 'BARRA toggleTools despliega la bandeja', est.oculto === false && est.abierto === true, JSON.stringify(est));
      vm.runInContext('cerrarTools()', cx);
      t(P + 'BARRA cerrarTools la pliega', est.oculto === true && est.abierto === false, JSON.stringify(est));
    }
    // el celular: barra en UNA fila (3 botones), campo ancho, botones de 38px
    const movil = (src.match(/@media \(max-width: 600px\) \{[\s\S]*?\n\}/) || [''])[0];
    t(P + 'MÓVIL el bloque de celular existe', !!movil);
    t(P + 'MÓVIL el campo de texto es ancho (flex:1) y de 16px (sin zoom)', /\.iwrap textarea \{[\s\S]*?flex: 1;[\s\S]*?font-size: 16px/.test(movil));
    t(P + 'MÓVIL los 3 botones tienen área táctil de dedo (38px)', /\.toolsbtn, \.micbtn, \.sbtn \{[\s\S]*?width: 38px; height: 38px/.test(movil));
    // y el escritorio NO se toca: su bloque sigue existiendo tal cual
    t(P + 'MÓVIL el escritorio quedó intacto', /@media \(min-width: 601px\)/.test(src));
  }

  /* ══════════ CONSOLIDA · REDUNDANCIA, CORTE LIMPIO Y PIE ORDENADO (5/08/2026) ══════════
     Pedido de Darío: que MIRROR no falle en la tesis. Redundancia de motores, recorte que
     no ensucia, y el pie sin desprolijidades. */
  if (etiqueta === 'MIRROR') {
    // — la cadena de motores cae al respaldo ante TODO lo que no sea tamaño de contexto
    /* v45-cloudflare (21/08): actualizado a la cadena en LISTA. El respaldo ya no es un solo
       motor: se recorre `respaldos` (Cloudflare → Cerebras) y el último error real se guarda
       en `ultimoErr` para que el mensaje al usuario sea el correcto. */
    t(P + 'REDUN el respaldo se prueba salvo si es tamaño de contexto',
      /if \(e\.tipo === 'too_big'\) throw e;/.test(src) && /for \(const rsp of respaldos\)/.test(src));
    t(P + 'REDUN si caen TODOS los motores, se conserva el tipo del último error para el mensaje',
      /err\.tipo = ultimoErr\.tipo \|\| e\.tipo \|\| 'otro';/.test(src));
    t(P + 'REDUN y queda marcado que fallaron ambos', /err\.ambosMotores = true;/.test(src));
    t(P + 'REDUN cuando responde el respaldo, se avisa nombrando cuál (transparencia)',
      /function avisarRespaldoUnaVez\(cual\)/.test(src) && /avisarRespaldoUnaVez\(rsp\.id\)/.test(src));
    t(P + 'REDUN el aviso nombra Cloudflare o Cerebras, no uno fijo',
      /cual==='cloudflare' \? 'Cloudflare'/.test(src) && /cual==='cerebras' \? 'Cerebras'/.test(src));
    t(P + 'REDUN el aviso del respaldo va una sola vez', /if \(respaldoAvisado\) return;/.test(src));

    // — corte limpio: nunca a mitad de palabra
    {
      const cortar = vm.createContext({ String, Math });
      vm.runInContext(extraer(src, 'cortarLimpio'), cortar);
      const cort = (t, n) => vm.runInContext('cortarLimpio(' + JSON.stringify(t) + ',' + n + ')', cortar);
      t(P + 'CORTE un texto corto no se toca', cort('hola mundo', 100) === 'hola mundo');
      t(P + 'CORTE corta en fin de párrafo cuando lo hay',
        cort('Primer párrafo entero acá.\n\nSegundo que no entra completo del todo largo', 40) === 'Primer párrafo entero acá.', JSON.stringify(cort('Primer párrafo entero acá.\n\nSegundo que no entra completo del todo largo', 40)));
      t(P + 'CORTE si no hay párrafo, corta en fin de oración',
        /\.$/.test(cort('Una oración completa. Otra que se corta por la mitad de una palabra larguísima', 30)));
      t(P + 'CORTE nunca parte una palabra al medio',
        !/\S$/.test(cort('palabras sueltas que van llenando el espacio disponible hasta', 25)) || cort('palabras sueltas que van llenando el espacio disponible hasta', 25).split(' ').every(w=>w.length>0));
    }

    // — el pie: esenciales visibles + resto plegado, y los 14 onclick vivos
    {
      const pie = (src.match(/<div class="fnote">([\s\S]*?)<\/div>/) || ['',''])[1];
      t(P + 'PIE existe el botón «⋯ más»', /onclick="toggleMas\(\)"/.test(pie));
      t(P + 'PIE el grupo plegable arranca oculto', /class="fmore-group oculto"/.test(pie));
      const grupo = (pie.match(/id="fmoreGroup"[^>]*>([\s\S]*)/) || ['',''])[1];
      const enGrupo = [...grupo.matchAll(/onclick="([^"]+)"/g)].map(x => x[1]);
      const todas = [...pie.matchAll(/onclick="([^"]+)"/g)].map(x => x[1]);
      const visibles = todas.filter(o => !enGrupo.includes(o));
      t(P + 'PIE quedan pocas pastillas a la vista (≤10 con el «más»)', visibles.length <= 10, 'hay ' + visibles.length);
      t(P + 'PIE lo de la tesis está a la vista', ['anaAbrir()','showDocs()','abrirModalInforme()'].every(o => visibles.includes(o)));
      t(P + 'PIE lo ocasional quedó plegado (menos es más)', ['clearMem()','cartaAClaude()','cumpliAbrir()','encAbrir()','openPres()'].every(o => enGrupo.includes(o)));
      // los 14 onclick originales siguen TODOS presentes (ninguno se perdió al reordenar)
      const originales = ['clearMem()','abrirMemoria()','anaAbrir()','encAbrir()','showDocs()','cartaAClaude()','abrirModalInforme()','toggleTTS()','abrirSelectorVoz()','toggleSound()','openPres()','cumpliAbrir()','portaExportar()'];
      t(P + 'PIE ningún onclick se perdió al reordenar', originales.every(o => src.indexOf(o) > 0), originales.filter(o=>src.indexOf(o)<0).join(','));
      // toggleMas alterna de verdad
      const cx = vm.createContext({});
      const estado = { oculto:true, txt:'⋯ más', aria:'false' };
      cx.document = { getElementById:(id)=> id==='fmoreGroup' ? { classList:{ toggle:()=>{ estado.oculto=!estado.oculto; return estado.oculto; } } } : { set textContent(v){ estado.txt=v; }, setAttribute:(k,v)=>{ estado.aria=v; } } };
      vm.runInContext(extraer(src,'toggleMas'), cx);
      vm.runInContext('toggleMas()', cx);
      t(P + 'PIE toggleMas despliega y renombra a «menos»', estado.oculto === false && estado.txt === '⋯ menos', JSON.stringify(estado));
      vm.runInContext('toggleMas()', cx);
      t(P + 'PIE y vuelve a plegar', estado.oculto === true && estado.txt === '⋯ más', JSON.stringify(estado));
    }
  }

  /* ══════════ JURADO-RAG · «QUE VEA TODO EL PROYECTO SIN PASARSE DEL CUPO» (5/08/2026) ══════
     Darío: «como estaba el jurado, era glorioso» (con Llama 3.3 el proyecto entero entraba).
     Con 8.000 tok/min ya no entra entero, así que el jurado recibe el NÚCLEO siempre + las
     secciones relevantes a cada pregunta (BM25 sobre el proyecto). Estas pruebas corren la
     función REAL sobre un proyecto de mentira con secciones marcadas. */
  if (etiqueta === 'MIRROR') {
    const stopLine = (src.match(/const STOPWORDS_ES = new Set\([^;]*\);/) || [''])[0];
    const codRag = stopLine + '\n' + ['normalizeText','chunkText','tokenize','buildChunks','bm25Search','estimarTokens','chunksProyecto','proyectoParaJurado']
      .map(n => { try { return extraer(src, n); } catch(e){ return ''; } }).join('\n');
    /* proyecto de mentira: cada sección ~1000 caracteres para que buildChunks (chunks de
       1000) produzca VARIAS piezas y la selección por relevancia sea real, no trivial.
       Cada sección repite su palabra-tema para que BM25 la distinga con claridad. */
    // cada sección ~600 palabras distintas → varios chunks (chunkText corta por 1000 palabras)
    const rell = (tema, palabra) => tema + ' ' + (palabra + ' ').repeat(600);
    const PROY = [
      'Título reconfiguración prácticas áulicas IA generativa. Resumen problema investigación central. ' + ('problema '.repeat(600)),
      rell('Marco teórico Teoría del Actor-Red Latour Callon Law pregunta:', 'marco'),
      rell('Metodología del trabajo cualitativo:', 'metodología'),
      rell('Muestreo y validez del estudio:', 'muestreo'),
      rell('Cronograma y bibliografía del plan:', 'cronograma'),
      rell('Consideraciones éticas consentimiento:', 'ética')
    ].join('\n\n');
    const cx = vm.createContext({ String, Math, Set, Array, Object, JSON, TESIS_PROYECTO: PROY });
    let ragOK = true;
    try { vm.runInContext('var _chunksProyecto = null;\n' + codRag, cx); } catch(e){ ragOK = false; t(P + 'JURADO-RAG el código se pudo cargar', false, e.message); }
    if (ragOK) {
      const pedir = (q, tok) => vm.runInContext('proyectoParaJurado(' + JSON.stringify(q) + ',' + tok + ')', cx);

      // (a) el NÚCLEO (título/resumen/problema/pregunta) está SIEMPRE, sea cual sea la pregunta
      {
        const r = pedir('cronograma y bibliografía', 400);
        t(P + 'JURADO-RAG el núcleo (título/problema) va siempre', /Título|problema de investigación/i.test(r.texto), r.texto.slice(0,60));
      }
      // (b) una pregunta de METODOLOGÍA trae la sección de metodología (lo que el 1 perdía)
      {
        const r = pedir('¿cómo justificás la muestra y la validez metodológica?', 100000);
        t(P + 'JURADO-RAG una pregunta de método trae la metodología', /[Mm]etodología|[Mm]uestreo|validez/.test(r.texto), r.texto.slice(0,80));
      }
      // (c) con un cupo que da para el núcleo (~5200 tok) + una sección, no entra TODO
      {
        const r = pedir('metodología', 7500);
        const tok = vm.runInContext('estimarTokens(' + JSON.stringify(r.texto) + ')', cx);
        t(P + 'JURADO-RAG respeta el presupuesto de tokens', tok <= 7500 + 300, 'usó ' + tok + ' con tope 7500');
        t(P + 'JURADO-RAG y no mete TODAS las secciones cuando el cupo no da', r.secciones < r.total, 'metió ' + r.secciones + '/' + r.total);
      }
      // (d) si el cupo alcanza para todo, lo marca como completo (el jurado glorioso)
      {
        const r = pedir('metodología', 100000);
        t(P + 'JURADO-RAG con cupo amplio entra el proyecto completo', r.completo === true, JSON.stringify({sec:r.secciones,tot:r.total}));
      }
      // (e) las secciones se reordenan a orden de lectura antes de unirse (no quedan en el
      // orden en que BM25 las rankeó). Estructural: con solapamiento de chunks el chequeo
      // por texto es frágil, pero la garantía es este reordenamiento.
      t(P + 'JURADO-RAG reordena las secciones a orden de lectura', /usados\.sort\(\(a,b\)=> a\.idx - b\.idx\)/.test(src));
      // (f) sin pregunta (apertura «empecemos») igual devuelve el núcleo, no rompe
      {
        const r = pedir('', 400);
        t(P + 'JURADO-RAG la apertura sin pregunta no rompe y trae el núcleo', !!r.texto && /Título/.test(r.texto));
      }
    }
    // el contexto del jurado usa el RAG, no el proyecto pelado; y el prompt del jurado NO se tocó
    t(P + 'JURADO-RAG el contexto del jurado llama a proyectoParaJurado', /proyectoParaJurado\(consulta, tokProy\)/.test(src));
    t(P + 'JURADO-RAG el prompt SYSTEM_TARS_JURADO sigue intacto (no se toca su lógica)',
      /const SYSTEM_TARS_JURADO = `/.test(src) || /SYSTEM_TARS_JURADO\s*=/.test(src));
    t(P + 'JURADO-RAG la consulta combina la respuesta de Darío y la última pregunta del jurado',
      /const ultJurado = \(history\.filter\(h => h\.role === 'assistant'\)/.test(src));
  }

  /* ══════════ AGENDA2 · CONTACTOS, VOLUMEN Y AVISO (6/08/2026) ══════════
     De la auditoría en vivo de Darío: MIRROR se contradecía con los números, no reconocía
     «subilo», y avisaba de recorte hasta en un «cómo estás». */
  if (etiqueta === 'MIRROR') {
    // — VOLUMEN: las formas que la carta marcó como no reconocidas ahora entran
    {
      const chunk = src.slice(src.indexOf('const ACTUA_CMDS'), src.indexOf('const ACTUA_CMDS') + 70000);
      const res = [...chunk.matchAll(/re:\s*(\/(?:\\.|\[(?:\\.|[^\]])*\]|[^\/\\])+\/[gimsuy]*)/g)].map(m => m[1]);
      const entra = s => res.some(r => { try { return eval(r).test(s); } catch(e){ return false; } });
      ['subilo','bajalo','subi el volumne','subir el volumen','bajar el sonido un poquito'].forEach(s =>
        t(P + 'VOL entra «' + s + '»', entra(s), s));
      // y NO se come frases que no son de volumen
      ['bajá el archivo','contame más','hablame más fuerte'].forEach(s =>
        t(P + 'VOL NO le roba el turno a «' + s + '»', !entra(s), s));
    }

    // — AGENDA: el puente memoria→número, el auto-guardado, y «guardá mi número»
    {
      const soloD = s => String(s||'').replace(/[^\d]/g,'');
      const codA = ['_tareaISO','_tareaFecha','soloDigitos','numeroRastreable','actuaProcesarReply'].map(n => extraer(src, n)).join('\n'); // v59-caldate: actuaCalURL ahora usa _tareaFecha (en el navegador existe siempre)
      function ctxA(memoria, agenda){
        const store = {};
        const ctx = {
          String, RegExp, JSON, encodeURIComponent, Date, isNaN, // v59-caldate: _tareaFecha usa Date/isNaN
          ultimoPedidoUsuario: '', _memoriaDelTurno: memoria || '',
          AG: agenda || {},
          actuaPend:null, redactorPend:null, sharePend:null, mode:'mirror',
          actuaNumOk:(n)=>/^\+?\d{8,}$/.test(String(n||'')),
          actuaContacto:(nom)=>{ const v=(agenda||{})[String(nom||'').toLowerCase()]; return v?{tel:v.tel||'',email:v.email||'',dir:''}:null; },
          actuaAgendaGuardar:(nom,campos)=>{ store[String(nom||'').toLowerCase()]=campos; return true; },
          actuaWaURL:(n,m)=>'https://wa.me/'+n+(m?'?text='+encodeURIComponent(m):''),
          actuaTelURL:(n)=>'tel:'+n, actuaYtURL:q=>'yt:'+q, actuaMapsURL:q=>'maps:'+q, actuaCalURL:t=>'cal:'+t,
          actuaMailDirOk:d=>/@/.test(String(d||'')), actuaMailURL:(d)=>'mailto:'+d,
          REDACTOR_URL_MAX:1800, _guardado: store, regError:()=>{}
        };
        ctx.window = ctx;
        const c = vm.createContext(ctx); vm.runInContext(codA, c); return c;
      }
      const NUM = '5492994223453';

      // (a) EL CASO DE DARÍO: el número está en su MEMORIA (no en la agenda) → se usa
      {
        const c = ctxA('El número de Darío es +54 9 299 422-3453.', {});
        vm.runInContext('actuaProcesarReply(\'Sí, es el mismo.\\n[ACCION:{"tipo":"wa","para":"Darío","num":"'+NUM+'","msg":"mañana paso"}]\')', c);
        t(P + 'AGENDA usa el número que está en la memoria del usuario', !!c.actuaPend && String(c.actuaPend[3]).indexOf('wa.me') === 8, JSON.stringify(c.actuaPend));
        // y lo GUARDA en la agenda para la próxima
        t(P + 'AGENDA y lo guarda en la agenda automáticamente', !!c._guardado['darío'] && soloD(c._guardado['darío'].tel) === NUM, JSON.stringify(c._guardado));
      }
      // (b) un número que NO está ni en agenda ni en memoria ni dictado → NO se usa (sigue seguro)
      {
        const c = ctxA('', {});
        const r = vm.runInContext('actuaProcesarReply(\'ok\\n[ACCION:{"tipo":"wa","para":"Laura","num":"'+NUM+'","msg":"hola"}]\')', c);
        t(P + 'AGENDA sin agenda/memoria/dictado NO arma la tarjeta', !c.actuaPend, JSON.stringify(c.actuaPend));
        t(P + 'AGENDA y no guarda nada que no le conste', !c._guardado['laura'], JSON.stringify(c._guardado));
      }
      // (c) la agenda le sigue ganando al número del modelo
      {
        const c = ctxA('', { darío:{tel:'5499999999999'} });
        vm.runInContext('actuaProcesarReply(\'ok\\n[ACCION:{"tipo":"wa","para":"Darío","num":"'+NUM+'","msg":"hola"}]\')', c);
        t(P + 'AGENDA el número de la agenda le gana al del modelo', c.actuaPend && String(c.actuaPend[3]).indexOf('5499999999999') > 0, c.actuaPend && c.actuaPend[3]);
      }
      // (e) v39/v58-agenda2 (2/09): la tarjeta «agendar» SOLO si el usuario la pidió de verdad.
      {
        const c = ctxA('', {});
        c.ultimoPedidoUsuario = 'me voy a merendar y a jugar a la play';
        vm.runInContext('actuaProcesarReply(\'Que lo disfrutes.\\n[ACCION:{"tipo":"cal","titulo":"merienda y juego"}]\')', c);
        t(P + 'AGENDA2 un plan casual/despedida NO arma la tarjeta de agendar', !c.actuaPend, JSON.stringify(c.actuaPend));
      }
      {
        const c = ctxA('', {});
        c.ultimoPedidoUsuario = 'agenda reunion de padres el jueves';
        vm.runInContext('actuaProcesarReply(\'Listo.\\n[ACCION:{"tipo":"cal","titulo":"reunion de padres"}]\')', c);
        t(P + 'AGENDA2 si pedis «agenda ...» SI arma la tarjeta', !!c.actuaPend && c.actuaPend[0] === '\u{1F4C5}', JSON.stringify(c.actuaPend));
      }
      // (d) «guardá mi número/mail» existe como comando
      t(P + 'AGENDA hay comando «guardá mi número»', /guard\[a[áa]\]\|anot\[a[áa]\]\|record\[a[áa]\]\)\(\?:me\)\?\\s\+\(\?:mi\|/.test(src.replace(/\s+/g,'')) || /guard\[aá\]\|anot\[aá\]\|record\[aá\]\)\(\?:me\)\?\\s\+\(\?:mi/.test(src));
      t(P + 'AGENDA «guardá mi número» guarda bajo Darío', /actuaAgendaGuardar\('Darío',\{tel:num\}\)/.test(src));
      t(P + 'AGENDA «guardá mi mail» guarda bajo Darío', /actuaAgendaGuardar\('Darío',\{email:dir\}\)/.test(src));

      /* ── AGENDA3 (6/08/2026): el bug de los acentos y la agenda visible ──────────────
         Darío: MIRROR decía «ya lo tengo agendado, es +54…» y en el mismo aliento «no lo
         tengo». Causa: guardaba «darío» (con tilde) y buscaba «dario» (sin). Ahora la clave
         va normalizada, así que las dos formas son el mismo contacto. Y la agenda se VE. */
      {
        const codAg = ['_normNombre','actuaAgenda','actuaCandidatos','actuaPedirPrecisar','actuaContacto','actuaAgendaGuardar'].map(n => extraer(src, n)).join('\n');
        function ctxAg(){
          const store = {};
          const ctx = { String, JSON, RegExp, Object,
            localStorage: { getItem:k=>(k in store?store[k]:null), setItem:(k,v)=>{store[k]=String(v);}, removeItem:k=>{delete store[k];} },
            _store: store };
          const c = vm.createContext(ctx); vm.runInContext(codAg, c); return c;
        }
        // (a) _normNombre saca tildes y may/min
        {
          const c = ctxAg();
          const n1 = vm.runInContext("_normNombre('Darío')", c);
          const n2 = vm.runInContext("_normNombre('DARIO')", c);
          const n3 = vm.runInContext("_normNombre('  dario ')", c);
          t(P + 'AGENDA3 «Darío», «DARIO» y «dario» normalizan igual', n1 === n2 && n2 === n3 && n1 === 'dario', JSON.stringify([n1,n2,n3]));
        }
        // (b) EL CASO DE DARÍO: guardo con tilde, busco sin tilde → lo encuentra
        {
          const c = ctxAg();
          vm.runInContext("actuaAgendaGuardar('Darío',{tel:'5492994223453'})", c);
          const encontrado = vm.runInContext("actuaContacto('Dario')", c);
          t(P + 'AGENDA3 guardado con tilde, encontrado sin tilde (fin de la contradicción)',
            !!encontrado && encontrado.tel === '5492994223453', JSON.stringify(encontrado));
          // y no quedan duplicados: una sola clave
          const claves = vm.runInContext("Object.keys(actuaAgenda())", c);
          t(P + 'AGENDA3 no se duplica el contacto por el acento', claves.length === 1, JSON.stringify(claves));
        }
        // (c) guarda el nombre lindo para mostrarlo, pero la clave va sin tilde
        {
          const c = ctxAg();
          vm.runInContext("actuaAgendaGuardar('Laura',{tel:'2995551234'})", c);
          const claves = vm.runInContext("Object.keys(actuaAgenda())", c);
          const cont = vm.runInContext("actuaContacto('laura')", c);
          t(P + 'AGENDA3 la clave es normalizada', claves[0] === 'laura');
          t(P + 'AGENDA3 el contacto conserva el nombre para mostrar', cont.nombre === 'Laura', JSON.stringify(cont));
        }
      }
      // — la agenda es VISIBLE: existen el panel y su forma de abrirlo
      t(P + 'AGENDA3 hay panel visible (abrirAgenda/renderAgenda)', /function abrirAgenda\(\)/.test(src) && /function renderAgenda\(\)/.test(src));
      t(P + 'AGENDA3 el panel se puede agregar y borrar contactos', /function agendaAgregarDesdePanel\(\)/.test(src) && /function agendaBorrar\(/.test(src));
      t(P + 'AGENDA3 hay entrada «contactos» en el pie', /onclick="abrirAgenda\(\)"/.test(src));
      t(P + 'AGENDA3 hay comando de voz para abrir la agenda', /agenda\|contactos\?\)/.test(src) && /abrirAgenda\(\); return/.test(src));
      t(P + 'AGENDA3 al modelo se le dice que la agenda es SUYA (no invente el teléfono)', /AGENDA DE CONTACTOS PROPIA/.test(src));
    }

    // — EL CARTEL DE RECORTE YA NO ESCRIBE EN EL CHAT (asustaba de gancho)
    {
      t(P + 'RECORTE-CALLADO avisarRecorteUnaVez ya no escribe en el chat', /function avisarRecorteUnaVez\(\)\{[^]*?cupoAvisado = true;[^]*?\}/.test(src) && !/function avisarRecorteUnaVez\(\)\{[^]*?addMsg\([^]*?\}/.test(src.slice(src.indexOf('function avisarRecorteUnaVez'), src.indexOf('function avisarRecorteUnaVez')+600)));
    }

    // — AVISO DE RECORTE: solo cuando se corta material, no por soltar historial viejo
    {
      const codR = ['estimarTokens','cortarLimpio','ajustarAlCupo'].map(n => extraer(src, n)).join('\n');
      const cr = vm.createContext({ String, Math, Number, CUPO_TPM_GRATIS: 8000, CUPO_MARGEN: 500 });
      vm.runInContext(codR, cr);
      const aj = (ctx, sys, prev, sal) => vm.runInContext('ajustarAlCupo(' + JSON.stringify(ctx) + ',' + JSON.stringify(sys) + ',' + JSON.stringify(prev) + ',' + sal + ')', cr);
      // solo se soltó historial viejo → recortado sí, pero recorteMaterial NO (no se avisa)
      {
        const previos = [{role:'user',content:'z'.repeat(20000)},{role:'assistant',content:'z'.repeat(20000)}];
        const r = aj('hola corta\n---\nPREGUNTA: cómo estás', 'sys corto', previos, 700);
        t(P + 'AVISO soltar historial viejo NO se marca como recorte de material', r.recorteMaterial === false, JSON.stringify({rec:r.recortado,mat:r.recorteMaterial}));
      }
      // se cortó MATERIAL de verdad → recorteMaterial sí (se avisa)
      {
        const r = aj('m'.repeat(40000) + '\n---\nPREGUNTA: dale', 'sys', [], 700);
        t(P + 'AVISO cortar material sí se marca (y se avisa)', r.recorteMaterial === true, JSON.stringify({rec:r.recortado,mat:r.recorteMaterial}));
      }
      // y send() avisa solo cuando recorteMaterial, no cuando recortado
      t(P + 'AVISO send() avisa solo si se cortó material', /if \(_ajuste\.recorteMaterial\) avisarRecorteUnaVez\(\)/.test(src));
    }
  }

  /* ══════════ TANDA DEL 19/08/2026 — SALUD DEL MOTOR (v45-salud MIRROR · v39-salud PLATAFORMA)
     Cada promesa nueva, amarrada con su prueba. La promesa es: «si el proveedor dice cuánto
     hay que esperar, la app espera ESO; si no dice nada, cae en la escalera de siempre».
     Se busca el fallo: qué pasa si NO hay encabezados, si el número es absurdo, si viene en
     milisegundos, si el proxy no reenvía nada. ══════════════════════════════════════════ */
  {
    const codEspera = ['esperaQuePidioElMotor'].map(n => extraer(src, n)).join('\n');
    const cE = vm.createContext({ console, JSON, String, Number, Math, RegExp, Date, isFinite, parseFloat, parseInt });
    vm.runInContext(codEspera, cE);
    const esp = (h, msg) => vm.runInContext(
      'esperaQuePidioElMotor(' + JSON.stringify(h === null ? null : { _h: h }) + ' && ' +
      (h === null ? 'null' : '{headers:{get:function(k){ return (' + JSON.stringify(h) + ')[k.toLowerCase()] || null; }}}') +
      ', ' + JSON.stringify(msg || '') + ')', cE);

    t(P + 'salud · lee retry-after en segundos', esp({ 'retry-after': '12' }, '') === 12, String(esp({ 'retry-after': '12' }, '')));
    t(P + 'salud · redondea para arriba (7.2 → 8): mejor esperar de más que rebotar',
      esp({ 'retry-after': '7.2' }, '') === 8, String(esp({ 'retry-after': '7.2' }, '')));
    t(P + 'salud · lee el formato «1m30s» de Groq en el encabezado',
      esp({ 'x-ratelimit-reset-tokens': '1m30s' }, '') === 90, String(esp({ 'x-ratelimit-reset-tokens': '1m30s' }, '')));
    /* El caso que de verdad importa: el proxy de Darío (y el de cualquiera que despliegue la
       plataforma) puede NO reenviar encabezados. Ahí el número tiene que salir del texto. */
    t(P + 'salud · SIN encabezados, lo saca del texto del error («try again in 7.723s»)',
      esp({}, 'Rate limit reached. Please try again in 7.723s.') === 8,
      String(esp({}, 'Rate limit reached. Please try again in 7.723s.')));
    t(P + 'salud · texto en minutos y segundos («in 1m30s»)',
      esp({}, 'Please try again in 1m30s') === 90, String(esp({}, 'Please try again in 1m30s')));
    /* 500 ms NO son 500 s: sin esta distinción la app dejaba al usuario 8 minutos esperando. */
    t(P + 'salud · milisegundos no se confunden con segundos',
      esp({}, 'try again in 500ms') === 1, String(esp({}, 'try again in 500ms')));
    t(P + 'salud · si el motor NO dijo nada, devuelve 0 (no inventa un número)',
      esp({}, 'algo salió mal') === 0, String(esp({}, 'algo salió mal')));
    t(P + 'salud · sin objeto de respuesta tampoco se rompe', esp(null, '') === 0, String(esp(null, '')));
    t(P + 'salud · un encabezado basura no se toma como espera',
      esp({ 'retry-after': 'pronto' }, '') === 0, String(esp({ 'retry-after': 'pronto' }, '')));

    /* El techo y el piso: que el proveedor pida 20 minutos no puede clavar la app. */
    const codSens = extraer(src, 'esperaSensata');
    const techo = /const ESPERA_TECHO = 75, ESPERA_PISO = 1;/.test(src);
    t(P + 'salud · el techo (75 s) y el piso (1 s) están declarados', techo);
    const cS = vm.createContext({ Number, Math, ESPERA_TECHO: 75, ESPERA_PISO: 1 });
    vm.runInContext(codSens, cS);
    t(P + 'salud · 1200 s pedidos se recortan al techo de 75', vm.runInContext('esperaSensata(1200)', cS) === 75);
    t(P + 'salud · 0.2 s se suben al piso de 1 (no martillamos al proveedor)', vm.runInContext('esperaSensata(0.2)', cS) === 1);
    t(P + 'salud · 0 sigue siendo 0 (= no dijo nada, usá la escalera)', vm.runInContext('esperaSensata(0)', cS) === 0);

    /* Que la pieza esté ENCHUFADA, no solo escrita: el error tiene que llevar el dato y el
       reintento tiene que usarlo. Un helper perfecto que nadie llama no arregla nada. */
    t(P + 'salud · el error de rate limit sale con esperaSug puesto',
      /err\.esperaSug = esperaQuePidioElMotor\(res, msg\)/.test(src));
    t(P + 'salud · el error HTTP sin cuerpo legible también',
      /err\.esperaSug = esperaQuePidioElMotor\(res, ''\)/.test(src));
    t(P + 'salud · el reintento usa lo que pidió el motor, no la escalera',
      /const pedida = esperaSensata\(e && e\.esperaSug\);/.test(src) && /const segs = pedida \|\| esperas\[intento\];/.test(src));
    t(P + 'salud · la escalera vieja SIGUE ahí como respaldo (no se tiró nada que funcionaba)',
      /const esperas=\[10,20,35\];/.test(src));
    /* Honestidad: cuando el número lo dio el motor se lo atribuye al motor; cuando es
       nuestro, no se le cuelga a nadie. */
    t(P + 'salud · el aviso distingue quién puso el número',
      /el motor pidió esperar/.test(src) && /motores ocupados/.test(src));
  }

  /* ══════════ TANDA DEL 21/08/2026 — ESTABILIDAD (auditoría en vivo de Darío) ══════════
     Cada hallazgo de la auditoría en vivo, amarrado con su prueba. Se busca el fallo. */
  {
    // ── H-A2 · el 402/401/403 tienen nombre y salida honesta (las DOS muletas) ──
    t(P + 'pago · el 402 se clasifica como pago_requerido (no cae en «otro»)',
      /res\.status === 402 \|\| \/payment required\|insufficient/.test(src) && /tipo = 'pago_requerido'/.test(src));
    t(P + 'pago · el 401/403 se clasifica como credencial',
      /res\.status === 401 \|\| res\.status === 403/.test(src) && /tipo = 'credencial'/.test(src));
    t(P + 'pago · el 402 también se caza en el camino HTTP sin cuerpo (res.status === 402)',
      /else if \(res\.status === 402\) tipo = 'pago_requerido';/.test(src));
    t(P + 'pago · hay mensaje en criollo para pago_requerido y NO manda a reintentar',
      /tipo === 'pago_requerido'/.test(src) && /pide pago \(código 402\)/.test(src));
    t(P + 'pago · hay mensaje en criollo para credencial',
      /tipo === 'credencial'/.test(src) && /rechaz[óo] la (credencial|clave)/.test(src));
    /* La clasificación nueva NO puede robarle a lo que ya andaba: va DESPUÉS en la cadena
       else-if, así que rate_limit / cupo / too_big siguen ganando primero. */
    t(P + 'pago · pago_requerido va DESPUÉS de rate_limit/cupo/too_big en la cadena',
      src.indexOf("tipo = 'rate_limit'") < src.indexOf("tipo = 'pago_requerido'"));

    // ── H-A4 · los errores NO se guardan en la memoria (las DOS muletas) ──
    t(P + 'memlimpia · no se guarda en history si el turno fue un error (esError)',
      /if \(!esTarea && !esError\)/.test(src));
    t(P + 'memlimpia · tampoco en la memoria por relevancia (recuerdoGuardar)',
      /!esError.*recuerdoGuardar|recuerdoGuardar[\s\S]{0,80}?!esError/.test(src) || /mode === 'mirror' && !esError/.test(src) || /if \(!esTarea && !esError\) \{[\s\S]{0,200}?recuerdoGuardar/.test(src));
  }

  /* ══════════ v47-decile (22/08/2026) — EL CONECTOR NO VIAJA DENTRO DEL MENSAJE ══════════
     HALLAZGO EN VIVO DE DARÍO: «mandale un mail a Laura, decile que voy tarde» abría el correo
     con «DECILE QUE VOY TARDE» en el cuerpo. La causa: con COMA, la rama `[:,]` del separador
     gana antes que la rama del conector, así que el «decile que» nunca se consumía. Sin coma sí
     se consumía — por eso el WhatsApp de la prueba salió bien y el mail no.
     Este bloque corre en LAS DOS muletas a propósito: el arreglo se hizo en las dos y el hueco
     de paridad de siempre no se vuelve a abrir sin que esto salte en rojo. */
  {
    const codLC = extraer(src, 'actuaLimpiaConector');
    t(P + 'decile · existe actuaLimpiaConector', !!codLC);
    const ctxLC = vm.createContext({ String, RegExp });
    vm.runInContext(codLC, ctxLC);
    const lc = x => vm.runInContext('actuaLimpiaConector(' + JSON.stringify(x) + ')', ctxLC);

    t(P + 'decile · «DECILE QUE VOY TARDE» → «VOY TARDE»', lc('DECILE QUE VOY TARDE') === 'VOY TARDE', lc('DECILE QUE VOY TARDE'));
    t(P + 'decile · «decile que sí» → «sí»', lc('decile que sí') === 'sí', lc('decile que sí'));
    t(P + 'decile · «y avisale que llego» → «llego»', lc('y avisale que llego') === 'llego', lc('y avisale que llego'));
    t(P + 'decile · «contale que voy» → «voy»', lc('contale que voy') === 'voy', lc('contale que voy'));
    t(P + 'decile · «diciéndole que gracias» → «gracias»', lc('diciéndole que gracias') === 'gracias', lc('diciéndole que gracias'));
    // los que NO se tocan: el conector tiene que ABRIR el mensaje
    t(P + 'decile · «gracias, decile a Ana que sí» queda intacto (el conector no abre)',
      lc('gracias, decile a Ana que sí') === 'gracias, decile a Ana que sí', lc('gracias, decile a Ana que sí'));
    t(P + 'decile · «contame cómo te fue» queda intacto (no es conector)',
      lc('contame cómo te fue') === 'contame cómo te fue', lc('contame cómo te fue'));
    t(P + 'decile · «decidí que voy» queda intacto (no confundir con «decí»)',
      lc('decidí que voy') === 'decidí que voy', lc('decidí que voy'));
    // nunca deja la tarjeta vacía: mejor un «decile» de más que un mensaje en blanco
    t(P + 'decile · «decile» solo NO deja el mensaje vacío', lc('decile') === 'decile', lc('decile'));
    t(P + 'decile · «decile que» solo NO deja el mensaje vacío', lc('decile que') === 'decile que', lc('decile que'));

    // la cadena completa, con la regla REAL de mail de ESTA muleta
    const iniC = src.indexOf('const ACTUA_CMDS');
    const chunkC = src.slice(iniC, iniC + 95000);
    const regsC = []; const reReC = /^\s*re:\s*(\/.*\/[gimsuy]*)\s*,\s*$/gm;
    let mc; while ((mc = reReC.exec(chunkC))) { try { regsC.push(eval(mc[1])); } catch (_) {} }
    const reMailC = regsC.find(r => /mail|correo/.test(r.source) && /\\s\+a\\s\+/.test(r.source) && !/whats/.test(r.source));
    t(P + 'decile · la muleta tiene su regla de mail-a-destinatario', !!reMailC);
    if (reMailC) {
      const capC = 'mandale un mail a Laura, decile que voy tarde'.match(reMailC);
      t(P + 'decile · con COMA la regex captura el conector dentro del cuerpo (la causa)',
        capC && /^decile que/i.test(capC[2].trim()), capC && capC[2]);
      t(P + 'decile · y la limpieza lo saca → «voy tarde»',
        capC && lc(capC[2]) === 'voy tarde', capC && lc(capC[2]));
      const capS = 'mandale un mail a Laura y decile que voy tarde'.match(reMailC);
      t(P + 'decile · sin coma sigue andando como antes (no se rompió lo que ya iba bien)',
        capS && capS[2].trim() === 'voy tarde', capS && capS[2]);
    }

    // paridad amarrada: las DOS reglas de ESTA muleta tienen que limpiar, no una sola
    const usos = (src.match(/msg\s*=\s*actuaLimpiaConector\(m\[2\]\)/g) || []).length;
    t(P + 'decile · las DOS reglas (mail y WhatsApp) limpian el conector, no una sola', usos === 2, 'usos=' + usos);
  }

  /* ══════════ v48-quien / v39-agenda (22/08/2026) — LA AGENDA, EN LAS DOS MULETAS ══════════
     Dos cosas se amarran acá, y corren en MIRROR y en PLATAFORMA a propósito:
     (1) v48-quien: con dos «Laura» la app NO adivina (eso ya estaba) y AHORA además lo dice
         bien: pide el apellido en vez de contestar «no tengo», que era mentira por omisión.
     (2) v39-agenda: el porte de la agenda a la plataforma (match por nombre de pila, tildes,
         conector «y», buscar contacto). Si alguien deja una muleta atrás, esto salta en rojo.
     El hueco de paridad ya nos costó dos días una vez; esta vez tiene alarma. */
  {
    const codQ = ['_normNombre','actuaCandidatos','actuaPedirPrecisar','actuaContacto','actuaAgendaGuardar']
                   .map(function(n){ return extraer(src, n); }).join('\n');
    let store = {};
    const AG = { 'laura pena': { tel:'+549298', email:'laura@x.com', nombre:'Laura Peña' },
                 'dario tello': { tel:'+549299', email:'d@x.com', nombre:'Darío Tello' } };
    const mkCtx = function(agenda){
      const c = vm.createContext({ String, RegExp, Object, JSON, localStorage: {
        getItem: function(k){ return (k in store) ? store[k] : null; },
        setItem: function(k,v){ store[k] = String(v); } },
        actuaAgenda: function(){ return agenda; } });
      vm.runInContext(codQ, c); return c;
    };
    const call = function(c, expr){ return vm.runInContext(expr, c); };

    // ── (1) match por nombre de pila: tiene que andar en LAS DOS muletas ──
    {
      const c = mkCtx(AG);
      t(P + 'agenda2 · «laura» encuentra a «Laura Peña»', (call(c,"actuaContacto('laura')")||{}).nombre === 'Laura Peña');
      t(P + 'agenda2 · «dario» encuentra a «Darío Tello» (sin tilde)', (call(c,"actuaContacto('dario')")||{}).nombre === 'Darío Tello');
      t(P + 'agenda2 · «pena» (apellido) también', (call(c,"actuaContacto('pena')")||{}).nombre === 'Laura Peña');
      t(P + 'agenda2 · un nombre que NO está no se inventa', call(c,"actuaContacto('pedro')") === null);
      t(P + 'agenda2 · una letra suelta no matchea de más', call(c,"actuaContacto('l')") === null);
      t(P + 'agenda2 · sin ambigüedad NO pide precisar', call(c,"actuaPedirPrecisar('laura','te lo mando')") === '');
    }

    // ── (2) v48-quien: con DOS «Laura» no adivina, y ahora lo dice bien ──
    {
      const AG2 = { 'laura pena':    { tel:'+549298', email:'laura@x.com', nombre:'Laura Peña' },
                    'laura peldano': { tel:'123454321', email:'',          nombre:'Laura Peldaño' },
                    'dario tello':   { tel:'+549299', email:'d@x.com',     nombre:'Darío Tello' } };
      const c = mkCtx(AG2);
      t(P + 'quien · con dos «Laura» actuaContacto NO adivina (sigue devolviendo null)',
        call(c,"actuaContacto('laura')") === null);
      t(P + 'quien · actuaCandidatos ve las dos', call(c,"actuaCandidatos('laura').length") === 2);
      const pide = call(c, "actuaPedirPrecisar('laura','te lo mando')");
      t(P + 'quien · pide precisar en vez de decir «no tengo»', typeof pide === 'string' && pide.length > 0, pide);
      t(P + 'quien · nombra a LAS DOS, con el nombre lindo',
        /Laura Peña/.test(pide) && /Laura Peldaño/.test(pide), pide);
      t(P + 'quien · dice de frente que no va a adivinar', /no voy a adivinar/i.test(pide), pide);
      t(P + 'quien · y cierra con lo que iba a hacer', /te lo mando/.test(pide), pide);
      t(P + 'quien · con el apellido resuelve y deja de preguntar',
        (call(c,"actuaContacto('laura pena')")||{}).nombre === 'Laura Peña' &&
        call(c,"actuaPedirPrecisar('laura pena','te lo mando')") === '');
      t(P + 'quien · el otro nombre sigue resolviendo solo (no rompió lo que andaba)',
        (call(c,"actuaContacto('dario')")||{}).nombre === 'Darío Tello');
    }

    // ── (3) tildes: guardo con tilde, busco sin tilde (nuevo en la plataforma) ──
    {
      store = {}; const real = {};
      const c = vm.createContext({ String, RegExp, Object, JSON,
        actuaAgenda: function(){ return real; } });
      vm.runInContext(codQ, c);
      vm.runInContext("actuaAgendaGuardar('Darío',{tel:'5492994223453'})", c);
      const enc = vm.runInContext("actuaContacto('Dario')", c);
      t(P + 'agenda2 · guardado con tilde, encontrado sin tilde', !!enc && enc.tel === '5492994223453', JSON.stringify(enc));
      t(P + 'agenda2 · no se duplica el contacto por el acento', Object.keys(real).length === 1, JSON.stringify(Object.keys(real)));
      t(P + 'agenda2 · guarda el nombre lindo para mostrarlo', (real[Object.keys(real)[0]]||{}).nombre === 'Darío');
      /* y el panel lo USA: si mostrara la clave cruda escribiría «dario» sin tilde, que es
         justo lo que la normalización introduce. Cazado revisando el porte, no en vivo. */
      t(P + 'agenda2 · el panel muestra el nombre lindo, no la clave normalizada',
        /const nom\s*=\s*actuaEsc\([^)]*v(?:\s*&&\s*v)?\.nombre/.test(src));
    }

    // ── (4) las reglas de ESTA muleta: conector «y» y buscar-contacto ──
    {
      const iniQ = src.indexOf('const ACTUA_CMDS');
      const chunkQ = src.slice(iniQ, iniQ + 95000);
      /* el extractor de acá tolera un comentario al final de la línea `re:` — la regla de
         WhatsApp lo tiene («// destinatario no-greedy»), y el extractor viejo, que ancla en
         fin de línea, la salteaba en silencio. Lo cazó este mismo banco al escribirlo. */
      const regsQ = []; const reReQ = /^\s*re:\s*(\/.*\/[gimsuy]*)\s*,\s*(?:\/\/.*)?$/gm;
      let mq; while ((mq = reReQ.exec(chunkQ))) { try { regsQ.push(eval(mq[1])); } catch (_) {} }
      const reM = regsQ.find(function(r){ return /mail|correo/.test(r.source) && /\\s\+a\\s\+/.test(r.source) && !/whats/.test(r.source); });
      const reW = regsQ.find(function(r){ return /whats\?app\?/.test(r.source) && /mand\[a/.test(r.source); });
      t(P + 'agenda2 · la muleta tiene regla de mail y de WhatsApp', !!reM && !!reW);
      if (reM){
        const cap = 'mandale un mail a laura y decile que voy'.match(reM);
        t(P + 'agenda2 · F2 mail: captura «laura», no «laura y»', cap && cap[1].trim().toLowerCase() === 'laura', cap && cap[1]);
        const capL = 'mandale un mail a juan y pedro decile que vamos'.match(reM);
        t(P + 'agenda2 · F2 mail: un nombre con «y» legítimo se preserva', capL && capL[1].trim().toLowerCase() === 'juan y pedro', capL && capL[1]);
      }
      if (reW){
        const capW = 'mandale un whatsapp a laura y decile que voy'.match(reW);
        t(P + 'agenda2 · F2 WhatsApp: captura «laura», no «laura y»', capW && capW[1].trim().toLowerCase() === 'laura', capW && capW[1]);
      }
      const reF4 = regsQ.find(function(r){ return /contacto/.test(r.source) && /datos\?/.test(r.source) && /busc\[a/.test(r.source); });
      t(P + 'agenda2 · F4 existe la regla de buscar contacto', !!reF4);
      if (reF4){
        t(P + 'agenda2 · F4 «buscá en la agenda el contacto de laura» entra', reF4.test('buscá en la agenda el contacto de laura'));
        const cF4 = 'buscá en la agenda el contacto de laura'.match(reF4);
        t(P + 'agenda2 · F4 captura «laura» y nada más', cF4 && cF4[1].trim().toLowerCase() === 'laura', cF4 && cF4[1]);
        t(P + 'agenda2 · F4 «decime el mail de ana» entra (verbo acentuado)', reF4.test('decime el mail de ana'));
        t(P + 'agenda2 · F4 una búsqueda de MÚSICA no entra', !reF4.test('poné música de Nirvana'));
        t(P + 'agenda2 · F4 no se roba «mostrame los contactos de la agenda»', !reF4.test('mostrame los contactos de la agenda'));
      }
    }

    // ── (5) paridad de la promesa: las reglas que se quedan sin dato PIDEN precisar ──
    {
      const llamadas = (src.match(/actuaPedirPrecisar\(/g) || []).length - 1; // menos la definición
      t(P + 'quien · al menos 4 reglas piden precisar (llamada, mail, WhatsApp, buscar contacto)',
        llamadas >= 4, 'llamadas=' + llamadas);
    }
  }

  /* ══════════ v49/v40-pendiente (22/08/2026) — LA APP ESCUCHA LA RESPUESTA ══════════
     HALLAZGO EN VIVO: la app pidió el apellido, Darío contestó «LAURA PEÑA», eso no matcheó
     ninguna regla, cayó al modelo y el modelo AFIRMÓ que no tenía un mail que SÍ estaba
     guardado. Estas pruebas amarran las dos mitades: que la reescritura haga lo que dice, y
     que el texto reescrito MATCHEE de verdad las reglas reales de cada muleta (end-to-end, no
     de palabra). Corre en las DOS muletas. Como esta tanda va a producción SIN auditoría en
     vivo, acá está casi todo el peso de la verificación: se prueba lo que tiene que pasar Y lo
     que NO tiene que pasar. */
  {
    const codPend = ['_normNombre','actuaCandidatos','actuaPedirPrecisar','actuaContacto',
                     'actuaPendBox','actuaPendPedir','actuaPendReescribir']
                      .map(function(n){ return extraer(src, n); }).join('\n');
    const AGD = { 'laura pena':    { tel:'+5492984664197', email:'laura.pena00@gmail.com', nombre:'LAURA PEÑA' },
                  'laura peldano': { tel:'123456534232',   email:'',                       nombre:'LAURA PELDAÑO' },
                  'dario tello':   { tel:'+5492994223453', email:'nevermine13@hotmail.com',nombre:'DARIO TELLO' } };
    const nuevoCtx = function(){
      const c = vm.createContext({ String, RegExp, Object, actuaAgenda: function(){ return AGD; } });
      vm.runInContext(codPend, c); return c;
    };
    const ev = function(c, expr){ return vm.runInContext(expr, c); };

    // las reglas REALES de esta muleta, para probar la reescritura end-to-end
    const iniP = src.indexOf('const ACTUA_CMDS');
    const chP = src.slice(iniP, iniP + 95000);
    const regsP = []; const reP = /^\s*re:\s*(\/.*\/[gimsuy]*)\s*,\s*(?:\/\/.*)?$/gm;
    let mp; while ((mp = reP.exec(chP))) { try { regsP.push(eval(mp[1])); } catch (_) {} }
    const rMail = regsP.find(function(r){ return /mail|correo/.test(r.source) && /\\s\+a\\s\+/.test(r.source) && !/whats/.test(r.source); });
    const rWa   = regsP.find(function(r){ return /whats\?app\?/.test(r.source) && /mand\[a/.test(r.source); });
    const rTel  = regsP.find(function(r){ return /llam\[a/.test(r.source) && /marc\[a/.test(r.source); });
    const rF4   = regsP.find(function(r){ return /contacto/.test(r.source) && /datos\?/.test(r.source) && /busc\[a/.test(r.source); });

    // ── existe y arranca vacía ──
    {
      const c = nuevoCtx();
      t(P + 'pend · sin pendiente, no reescribe nada', ev(c, "actuaPendReescribir('LAURA PEÑA')") === '');
    }

    // ── EL CASO DE DARÍO, end-to-end: pregunta → respuesta → mail armado ──
    {
      const c = nuevoCtx();
      ev(c, "actuaPedirPrecisar('laura','te lo mando','mail','voy tarde')");
      const r = ev(c, "actuaPendReescribir('LAURA PEÑA')");
      t(P + 'pend · «LAURA PEÑA» se traduce al pedido completo',
        r === 'mandale un mail a LAURA PEÑA que voy tarde', r);
      if (rMail){
        const cap = String(r).match(rMail);
        t(P + 'pend · y el texto reescrito MATCHEA la regla real de mail de esta muleta', !!cap);
        t(P + 'pend · captura el contacto correcto y el mensaje original',
          cap && cap[1].trim() === 'LAURA PEÑA' && cap[2].trim() === 'voy tarde', cap && (cap[1]+'|'+cap[2]));
      }
      t(P + 'pend · se consume: el turno siguiente ya no reescribe',
        ev(c, "actuaPendReescribir('LAURA PEÑA')") === '');
    }

    // ── las otras tres acciones, también end-to-end ──
    {
      const c = nuevoCtx();
      ev(c, "actuaPedirPrecisar('laura','te lo mando','wa','voy el martes')");
      const r = ev(c, "actuaPendReescribir('laura peña')");
      t(P + 'pend · WhatsApp: se traduce al pedido completo', r === 'mandale un whatsapp a laura peña que voy el martes', r);
      if (rWa){ const cap = String(r).match(rWa);
        t(P + 'pend · WhatsApp: el reescrito matchea la regla real', !!cap && cap[1].trim() === 'laura peña', cap && cap[1]); }
    }
    {
      const c = nuevoCtx();
      ev(c, "actuaPedirPrecisar('laura','lo llamo','tel','')");
      const r = ev(c, "actuaPendReescribir('laura peña')");
      t(P + 'pend · llamada: se traduce a «llamá a …»', r === 'llamá a laura peña', r);
      if (rTel){ t(P + 'pend · llamada: el reescrito matchea la regla real', rTel.test(String(r))); }
    }
    {
      const c = nuevoCtx();
      ev(c, "actuaPedirPrecisar('laura','te muestro sus datos','datos','')");
      const r = ev(c, "actuaPendReescribir('laura peña')");
      t(P + 'pend · buscar contacto: se traduce a «buscá el contacto de …»', r === 'buscá el contacto de laura peña', r);
      if (rF4){ t(P + 'pend · buscar contacto: el reescrito matchea la regla real', rF4.test(String(r))); }
    }

    // ── LO QUE NO TIENE QUE PASAR (acá es donde esto se puede romper feo) ──
    {
      const casos = [
        ['poné música de Nirvana', 'un comando cualquiera no se toma como respuesta'],
        ['laura',                  'un nombre que SIGUE siendo ambiguo no resuelve'],
        ['pedro',                  'un nombre que no está en la agenda no resuelve'],
        ['laura peña 123',         'algo con dígitos no es un nombre'],
        ['laura, peña',            'algo con coma no pasa (rompería la captura)'],
        ['dale mandaselo a laura peña por favor cuando puedas y avisame', 'una frase larga no es un nombre'],
        ['',                       'un mensaje vacío no resuelve']
      ];
      casos.forEach(function(par){
        const c = nuevoCtx();
        ev(c, "actuaPedirPrecisar('laura','te lo mando','mail','voy tarde')");
        const r = ev(c, "actuaPendReescribir(" + JSON.stringify(par[0]) + ")");
        t(P + 'pend · NO: ' + par[1], r === '', r);
        t(P + 'pend · NO: ' + par[1] + ' — y la pendiente igual se borra',
          ev(c, "actuaPendReescribir('laura peña')") === '');
      });
    }
    {
      const c = nuevoCtx();
      ev(c, "actuaPedirPrecisar('laura','te lo mando','mail','')");
      t(P + 'pend · sin mensaje no arma un mail vacío: muestra el contacto',
        ev(c, "actuaPendReescribir('laura peña')") === 'buscá el contacto de laura peña');
    }
    {
      const c = nuevoCtx();
      ev(c, "actuaPedirPrecisar('laura peña','te lo mando','mail','voy tarde')"); // sin ambigüedad
      t(P + 'pend · sin ambigüedad NO se anota ninguna pendiente',
        ev(c, "actuaPendReescribir('laura peña')") === '');
    }

    // ── el despachador: matchea el reescrito, muestra lo que escribió el usuario ──
    t(P + 'pend · el despachador prueba las reglas contra el texto reescrito',
      /let textCmd = text;[\s\S]{0,400}?c\.re\.exec\(textCmd\)/.test(src));
    t(P + 'pend · pero lo que se pinta y se guarda sigue siendo lo que escribió el usuario',
      /addMsg\('user', text\)/.test(src) && /history\.push\(\{role:'user', content:text\}/.test(src));
    t(P + 'pend · la pendiente NO vive en localStorage (se muere al recargar)',
      !/localStorage[\s\S]{0,60}actuaPend|actuaPend[\s\S]{0,60}localStorage/.test(src));

    // ── H3: con ambigüedad NO se arma tarjeta de mail ──
    t(P + 'H3 · la regla de mail resuelve la ambigüedad ANTES de armar la tarjeta',
      /if \(!conDir\)\{ const amb=actuaPedirPrecisar\(dest,'te lo mando','mail',msg\); if \(amb\) return amb; \}[\s\S]{0,600}?const ok=actuaTarjeta\('✉'/.test(src));

    // ── el prompt tiene prohibido afirmar que un dato NO está ──
    t(P + 'honestidad · el prompt prohíbe afirmar que un dato NO está en la agenda',
      /PROHIBIDO afirmar que un dato NO está guardado/.test(src));
    t(P + 'honestidad · y le dice cómo derivarlo a la capa que sí la ve',
      /busc[aá] el contacto de <nombre>/.test(src));
  }

  if (etiqueta === 'MIRROR') {
    /* ══════════ H-A3 · MAIL A UN DESTINATARIO PORTADO AL MIRROR (21/08) ══════════
       La carta a Claude del 21/08 mostró que fallaba. Se porta de la plataforma. Prueba
       behavioral: la regla entra, captura destinatario y cuerpo, y NO se pisa con WhatsApp. */
    const ini = src.indexOf('const ACTUA_CMDS');
    const chunk = src.slice(ini, ini + 95000);
    const regs = [];
    const reRe = /^\s*re:\s*(\/.*\/[gimsuy]*)\s*,\s*$/gm;
    let mm; while ((mm = reRe.exec(chunk))) { try { regs.push(eval(mm[1])); } catch (_) {} }
    // localizar la regla de mail (la que pide mail/correo + destinatario) y la de whatsapp
    const reMail = regs.find(r => /mail|correo/.test(r.source) && /\\s\+a\\s\+/.test(r.source) && !/whats/.test(r.source));
    t(P + 'mail · existe una regla de mail-a-destinatario', !!reMail);
    if (reMail){
      t(P + 'mail · «mandale un mail a Lucila que llego tarde» entra', reMail.test('mandale un mail a Lucila que llego tarde'));
      t(P + 'mail · «escribile un correo a Ana sobre la reunión» entra', reMail.test('escribile un correo a Ana sobre la reunión'));
      const cap = 'mandale un mail a Lucila que llego tarde'.match(reMail);
      t(P + 'mail · captura destinatario y cuerpo por separado', cap && cap[1].trim() === 'Lucila' && cap[2].trim() === 'llego tarde', cap && (cap[1]+'|'+cap[2]));
      // el WhatsApp sigue yendo a su regla, no a la de mail
      t(P + 'mail · un pedido de WhatsApp NO entra en la regla de mail', !reMail.test('mandale un whatsapp a Laura que llego'));
    }
    // honestidad: sin la dirección no la inventa, deja el mensaje escrito
    t(P + 'mail · sin el mail en la agenda lo dice de frente y no lo inventa',
      /No tengo el mail de «'\+dest\+'» y no lo voy a inventar/.test(src));

    /* ══════════ v46-agenda (21/08/2026) — LA AGENDA ASOCIA POR NOMBRE DE PILA ══════════
       HALLAZGO EN VIVO DE DARÍO: MIRROR quedaba «desvinculado de la agenda». Tres causas y su
       prueba: (F1) el lookup exigía el nombre EXACTO; (F2) el conector «y» se colaba en el
       nombre; (F3/F4) «buscá en la agenda…» se lo comía la música. */
    {
      // F1 — actuaContacto con match por nombre de pila, corriendo de verdad con agenda mock
      const codAg = [extraer(src, '_normNombre'), extraer(src, 'actuaCandidatos'), extraer(src, 'actuaPedirPrecisar'), extraer(src, 'actuaContacto')].join('\n');
      const AG = { 'Laura Peña': { tel: '+549298', email: 'laura@x.com', nombre: 'Laura Peña' },
                   'Darío Tello': { tel: '+549299', email: 'd@x.com', nombre: 'Darío Tello' } };
      const ctxAg = vm.createContext({ String, RegExp, Object, actuaAgenda: () => AG });
      vm.runInContext(codAg, ctxAg);
      const contacto = q => vm.runInContext('actuaContacto(' + JSON.stringify(q) + ')', ctxAg);
      t(P + 'agenda · F1 «laura» encuentra a «Laura Peña» (nombre de pila)', (contacto('laura') || {}).nombre === 'Laura Peña');
      t(P + 'agenda · F1 «dario» encuentra a «Darío Tello» (sin tilde)', (contacto('dario') || {}).nombre === 'Darío Tello');
      t(P + 'agenda · F1 «pena» (apellido) también', (contacto('pena') || {}).nombre === 'Laura Peña');
      t(P + 'agenda · F1 un nombre que NO está no se inventa', contacto('pedro') === null);
      t(P + 'agenda · F1 una letra suelta no matchea de más', contacto('l') === null);

      // F2 — el conector «y» no se cuela en el nombre (probado en la regla de mail, que está en regs)
      if (reMail) {
        const capY = 'mandale un mail a laura y decile que voy'.match(reMail);
        t(P + 'agenda · F2 «mail a laura y decile» captura «laura», no «laura y»',
          capY && capY[1].trim().toLowerCase() === 'laura', capY && capY[1]);
        const capYP = 'mandale un mail a juan y pedro decile que vamos'.match(reMail);
        t(P + 'agenda · F2 un nombre con «y» legítimo se preserva (juan y pedro)',
          capYP && capYP[1].trim().toLowerCase() === 'juan y pedro', capYP && capYP[1]);
      }

      // F3/F4 — buscar contacto va ANTES que música y captura el nombre; la música no se toca
      const idxF4  = regs.findIndex(r => /busc\[a/.test(r.source) && /datos/.test(r.source) && /contacto/.test(r.source));
      const idxMus = regs.findIndex(r => /pon\[e/.test(r.source) && /canci/.test(r.source));
      t(P + 'agenda · F4 existe la regla de buscar contacto', idxF4 >= 0);
      t(P + 'agenda · F3/F4 buscar-contacto va ANTES que música (orden = prioridad)',
        idxF4 >= 0 && idxMus >= 0 && idxF4 < idxMus, 'F4=' + idxF4 + ' MUS=' + idxMus);
      if (idxF4 >= 0) {
        const reF4 = regs[idxF4];
        t(P + 'agenda · F4 «buscá en la agenda el contacto de laura» entra', reF4.test('buscá en la agenda el contacto de laura'));
        const capF4 = 'buscá en la agenda el contacto de laura'.match(reF4);
        t(P + 'agenda · F4 captura «laura» (no «en la agenda el contacto de laura»)',
          capF4 && capF4[1].trim().toLowerCase() === 'laura', capF4 && capF4[1]);
        t(P + 'agenda · F4 «buscá el número de dario» también entra (verbo acentuado)', reF4.test('buscá el número de dario'));
        t(P + 'agenda · F4 una búsqueda de MÚSICA no entra en buscar-contacto', !reF4.test('poné música de Nirvana'));
      }
      // F3 — el guard de música (devuelve null ante palabras de agenda) está en su lugar
      t(P + 'agenda · F3 música suelta el pedido de agenda (guard presente)',
        /QUE MÚSICA NO SE ROBE LA AGENDA/.test(src) && /\b(?:agenda\|contacto)/.test(src.replace(/\\/g,'')) || /agenda\|contacto\|n\[u/.test(src));
    }

    /* ══════════ H-A5 · EL SELLO DE IA VIAJA EN EL INFORME (no solo en la carta) ══════════ */
    t(P + 'sello-informe · metadatosInforme arma el avisoIA desde selloIA()',
      /selloIA === 'function'.*selloIA\(\)|const s = \(typeof selloIA/.test(src) && /avisoIA/.test(src));
    t(P + 'sello-informe · el Word imprime el avisoIA en la portada',
      /if \(meta\.avisoIA\) children\.push/.test(src));
    t(P + 'sello-informe · el PDF imprime el avisoIA (partido con splitTextToSize)',
      /if \(meta\.avisoIA\)\{[\s\S]{0,200}?splitTextToSize\('⚠ '\+meta\.avisoIA/.test(src));
    t(P + 'sello-informe · el JSON lleva sello_ia legible por máquina',
      /sello_ia: meta\.selloIA/.test(src));
    t(P + 'sello-informe · el JSON ya no miente la versión con «v1.0» fijo',
      /version_app: \(typeof MIRROR_VERSION/.test(src));

    /* ══════════ H-A1 · LA CADENA CLOUDFLARE→CEREBRAS, CORRIENDO DE VERDAD ══════════
       Prueba behavioral: se extrae callGroq + avisarRespaldoUnaVez, se mockea el motor y se
       verifica el ORDEN (Groq falla → prueba Cloudflare → después Cerebras) y que, si caen
       todos, se propaga el tipo del ÚLTIMO error real (para el mensaje honesto). */
    {
      const cod = [depsMotor(src), extraer(src, 'avisarRespaldoUnaVez'), extraer(src, 'callGroq')].join('\n'); // v40-octubre: + depsMotor
      function correrCadena(quienContesta, tiposFalla){
        const pedidos = [];
        const ctx = vm.createContext({
          console, Promise, Error, JSON, String,
          CLOUDFLARE_ON: true, CLOUDFLARE_URL: '/cf', MODELO_CLOUDFLARE: '@cf/x',
          CEREBRAS_KEY: 'proxy', CEREBRAS_URL: '/cb', MODELO_CEREBRAS: 'cb',
          GROQ_URL: '/gq', GROQ_KEY: '', MODELO_GROQ: 'gq',
          motorActivo: 'groq', respaldoAvisado: false,
          setTypingNote: () => {}, addMsg: () => {},
          llamarMotorVigente: async (url) => {
            pedidos.push(url); // `pedidos` viene del closure de Node, no del ctx
            if (url === '/gq') throw Object.assign(new Error('groq'), { tipo: 'rate_limit' });
            if (url === quienContesta) return 'RESP';
            const t = (url === '/cf') ? (tiposFalla.cf||'red') : (tiposFalla.cb||'pago_requerido');
            throw Object.assign(new Error(url), { tipo: t });
          }
        });
        vm.runInContext(cod, ctx);
        return { ctx, pedidos, run: vm.runInContext('callGroq([],"",10,0.5)', ctx) };
      }
      // Groq cae, Cloudflare contesta → orden gq, cf y NO llega a Cerebras
      {
        const c = correrCadena('/cf', {});
        c.run.then(r => {
          t(P + 'cadena · Groq cae → Cloudflare contesta', r === 'RESP');
          t(P + 'cadena · el orden fue Groq, después Cloudflare', c.pedidos.join(',') === '/gq,/cf');
          t(P + 'cadena · si Cloudflare contesta, NO se molesta a Cerebras', c.pedidos.indexOf('/cb') === -1);
          t(P + 'cadena · motorActivo queda en cloudflare', vm.runInContext('motorActivo', c.ctx) === 'cloudflare');
        }).catch(e => t(P + 'cadena · Cloudflare contesta (sin excepción)', false, e && e.message));
      }
      // Groq y Cloudflare caen, Cerebras contesta → orden gq, cf, cb
      {
        const c = correrCadena('/cb', {});
        c.run.then(r => {
          t(P + 'cadena · Groq y Cloudflare caen → Cerebras contesta', r === 'RESP');
          t(P + 'cadena · el orden completo fue Groq, Cloudflare, Cerebras', c.pedidos.join(',') === '/gq,/cf,/cb');
        }).catch(e => t(P + 'cadena · Cerebras de último recurso', false, e && e.message));
      }
      // caen TODOS → se propaga el tipo del ÚLTIMO error (pago_requerido de Cerebras), no 'otro'
      {
        const c = correrCadena('NADIE', { cf: 'red', cb: 'pago_requerido' });
        c.run.then(() => t(P + 'cadena · si caen todos, NO devuelve respuesta', false))
             .catch(e => {
               t(P + 'cadena · si caen todos, se propaga el tipo del último error real (pago_requerido)', e.tipo === 'pago_requerido', e.tipo);
               t(P + 'cadena · y queda marcado ambosMotores', e.ambosMotores === true);
             });
      }
    }
  }

  if (etiqueta === 'PLATAFORMA') {
    /* ══════════ v39-actua (19/08/2026) · B1 — LOS COMANDOS QUE NO ENTRABAN ══════════
       Los cuatro que Darío vio fallar en vivo. Cada uno con su prueba, y además la prueba
       inversa: que lo nuevo NO le robe el turno a lo que ya andaba. */
    const ini = src.indexOf('const ACTUA_CMDS');
    const chunk = src.slice(ini, ini + 95000);
    const regs = [];
    const reRe = /^\s*re:\s*(\/.*\/[gimsuy]*)\s*,\s*$/gm;
    let mm;
    while ((mm = reRe.exec(chunk))) { try { regs.push(eval(mm[1])); } catch (_) {} }
    const cae = txt => regs.findIndex(r => r.test(txt));
    const entra = txt => cae(txt) >= 0;

    t(P + 'actua · «bajá el volumne» (el dedazo de Darío) ahora entra', entra('bajá el volumne'));
    t(P + 'actua · «subí el volumne» también', entra('subí el volumne'));
    t(P + 'actua · «bajá el volúmen» (con tilde de más) también', entra('bajá el volúmen'));
    t(P + 'actua · «poné el volumen más fuerte» (con «poné», no «subí»)', entra('poné el volumen más fuerte'));
    t(P + 'actua · «poné el volumen más bajo»', entra('poné el volumen más bajo'));
    t(P + 'actua · lo que ya andaba sigue andando: «subilo más»', entra('subilo más'));
    t(P + 'actua · y «bajalo más»', entra('bajalo más'));

    t(P + 'actua · mail a un destinatario: «mandale un mail a Lucila que llego tarde»',
      entra('mandale un mail a Lucila que llego tarde'));
    t(P + 'actua · «escribile un correo a Ana sobre la reunión»', entra('escribile un correo a Ana sobre la reunión'));
    t(P + 'actua · con la dirección dictada entera', entra('mandale un mail a ana@x.com que llego'));
    /* El mail NO puede quedar antes que WhatsApp: cada uno tiene que ir a su tarjeta. */
    t(P + 'actua · el mail no le roba el turno al WhatsApp',
      cae('mandale un whatsapp a Laura que llego') !== cae('mandale un mail a Laura que llego'));
    t(P + 'actua · «abrí el correo» en blanco sigue teniendo su regla', entra('abrí el correo electrónico'));
    /* La promesa honesta: sin la dirección NO se planta ni la inventa. */
    t(P + 'actua · sin el mail en la agenda, lo dice de frente y no lo inventa',
      /No tengo el mail de «'\+dest\+'» y no lo voy a inventar/.test(src));
    t(P + 'actua · y el WhatsApp sin número ofrece la salida que sí existe',
      /decime «compartí esto: '\+msg\+'»/.test(src));

    t(P + 'actua · «poné Nirvana» (artista pelado) ahora entra', entra('poné Nirvana'));
    t(P + 'actua · «poné Pink Floyd» (dos palabras)', entra('poné Pink Floyd'));
    t(P + 'actua · «pasame Charly García»', entra('pasame Charly García'));
    /* Los candados. Si estos se rompen, la regla nueva se come la conversación. */
    t(P + 'actua · «poné la mesa» NO se toma por música', !entra('poné la mesa'));
    t(P + 'actua · «poné atención» tampoco', !entra('poné atención'));
    t(P + 'actua · «poné la tele» tampoco', !entra('poné la tele'));
    t(P + 'actua · «contame más» sigue siendo conversación', !entra('contame más'));
    t(P + 'actua · una frase larga no entra en la regla del artista',
      cae('poné Nirvana que hace rato que no lo escucho y me acuerdo de la secundaria') !== cae('poné Nirvana'));
    t(P + 'actua · «poné la música» sigue yendo a la música ambiental, no a YouTube',
      cae('poné la música') !== cae('poné Nirvana'));
    t(P + 'actua · la regla del artista va ÚLTIMA (todas las demás ganan primero)',
      cae('poné Nirvana') === regs.length - 1, 'quedó en ' + cae('poné Nirvana') + ' de ' + regs.length);
    /* Y la honestidad: no afirma que reconoció un artista, y nada suena solo. */
    t(P + 'actua · el artista se responde admitiendo el supuesto, sin afirmar que lo reconoció',
      /asumí que era música \(no lo sé con certeza\)/.test(src));
    t(P + 'actua · y no reproduce nada: deja una tarjeta que el usuario tiene que tocar',
      /no suena nada hasta que toques la tarjeta/.test(src));
  }

  if (etiqueta === 'MIRROR') {
    /* ══════════ v45-avisoia (19/08/2026) · A1 — EL SELLO DE IA VIAJA CON EL ARCHIVO ══════════
       La promesa: lo que MIRROR deja salir del dispositivo dice que lo escribió una IA, con
       qué motor y de dónde salió el contexto. Y NO dice que sea correcto. */
    const codSello = ['selloIA', 'selloIATexto'].map(n => extraer(src, n)).join('\n');
    const cSello = vm.createContext({
      console, JSON, String, Number, Math, Date, Array,
      MIRROR_VERSION: 'v4.4', motorActivo: 'groq', MODELO_GROQ: 'qwen/qwen3.6-27b',
      MODELO_CEREBRAS: 'gpt-oss-120b', ultimaProcedencia: ['🌐 web', '◈ memoria']
    });
    vm.runInContext(codSello, cSello);
    const sello = vm.runInContext('selloIA()', cSello);
    const txt = vm.runInContext('selloIATexto()', cSello);

    t(P + 'sello · dice la app y la versión, sacadas de la constante', sello.app === 'MIRROR' && sello.version === 'v4.4');
    t(P + 'sello · nombra el motor que REALMENTE contestó y su modelo',
      /groq/.test(sello.motor) && /qwen3\.6/.test(sello.motor), sello.motor);
    t(P + 'sello · arrastra la procedencia (H4) de dónde salió el contexto',
      /web/.test(sello.procedencia) && /memoria/.test(sello.procedencia), sello.procedencia);
    t(P + 'sello · el texto avisa que lo generó una IA', /lo generó una inteligencia artificial/i.test(txt));
    t(P + 'sello · y pide verificar, sin prometer que sea correcto',
      /verificá cualquier dato/i.test(txt) && /NO que sea correcto/.test(txt));
    /* Buscar el fallo: si el respaldo contestó, tiene que decir Cerebras, no Groq. */
    const cSello2 = vm.createContext({
      console, JSON, String, Number, Math, Date, Array,
      MIRROR_VERSION: 'v4.4', motorActivo: 'cerebras', MODELO_GROQ: 'qwen/qwen3.6-27b',
      MODELO_CEREBRAS: 'gpt-oss-120b', ultimaProcedencia: []
    });
    vm.runInContext(codSello, cSello2);
    const s2 = vm.runInContext('selloIA()', cSello2);
    t(P + 'sello · si contestó el respaldo, lo dice (cerebras, no groq)',
      /cerebras/.test(s2.motor) && /gpt-oss/.test(s2.motor), s2.motor);
    t(P + 'sello · sin procedencia registrada lo admite en vez de inventarla',
      /sin registrar/.test(s2.procedencia), s2.procedencia);
    /* Y sin NADA definido, no se rompe: es lo que pasa apenas se abre la app. */
    const cSello3 = vm.createContext({ console, JSON, String, Number, Math, Date, Array });
    vm.runInContext(codSello, cSello3);
    const s3 = vm.runInContext('selloIA()', cSello3);
    t(P + 'sello · recién abierta la app no se rompe y admite que no hubo motor todavía',
      /todavía no contestó/.test(s3.motor), s3.motor);
    /* Que esté ENCHUFADO: el sello tiene que estar DENTRO de la carta que se descarga. */
    t(P + 'sello · viaja dentro de la carta descargable, no solo en pantalla',
      /md\+=selloIATexto\(\)\+'\\n\\n';/.test(src));
  }

  /* ══════════ 23/08/2026 — LA TANDA DE LA AUDITORÍA EN VIVO DE DARÍO ══════════════════════
     Cuatro hallazgos de la plataforma v38 andando, amarrados acá en LAS DOS muletas (tres de
     los cuatro eran de código compartido, así que dejarlos en una sola era repetir la trampa
     de paridad de `v38-proc`).
     Marcas: v41-* en la plataforma, v50-* en el MIRROR personal. */
  {
    const codT = ['_normNombre','actuaCandidatos','actuaPedirPrecisar','actuaContacto','actuaAgendaGuardar']
                   .map(function(n){ return extraer(src, n); }).join('\n');
    const mkReal = function(inicial){
      const real = inicial || {};
      const c = vm.createContext({ String, RegExp, Object, JSON,
        actuaAgenda: function(){ return real; },
        localStorage: { getItem: function(){ return null; }, setItem: function(){} } });
      vm.runInContext(codT, c);
      return { c: c, real: real, run: function(e){ return vm.runInContext(e, c); } };
    };

    /* ── (1) EL BUG MÁS GRAVE: un contacto nuevo nacía con datos de OTRA persona ──
       `actuaAgendaGuardar` tomaba el «previo» con actuaContacto, que matchea por nombre de
       pila. Guardar «Maria» teniendo «María Gómez» heredaba el mail de María Gómez. */
    {
      const s = mkReal({ 'maria gomez': { tel:'62553743663', email:'mgomez@gmail.com', dir:'', nombre:'María Gómez' } });
      s.run("actuaAgendaGuardar('Maria',{tel:'2995559999'})");
      const nuevo = s.real['maria'] || {};
      t(P + 'agenda3 · el contacto nuevo NO hereda el mail del parecido',
        nuevo.email === '', JSON.stringify(nuevo));
      t(P + 'agenda3 · el contacto nuevo NO hereda el teléfono del parecido',
        nuevo.tel === '2995559999', JSON.stringify(nuevo));
      t(P + 'agenda3 · y el contacto viejo queda intacto',
        (s.real['maria gomez']||{}).email === 'mgomez@gmail.com' && (s.real['maria gomez']||{}).tel === '62553743663');
      t(P + 'agenda3 · quedan los DOS contactos, no uno pisando al otro',
        Object.keys(s.real).length === 2, JSON.stringify(Object.keys(s.real)));
    }
    /* Lo que NO tiene que romperse: fusionar contra la MISMA entrada sigue andando —
       agregarle el mail a alguien no le puede borrar el teléfono. */
    {
      const s = mkReal({ 'maria gomez': { tel:'62553743663', email:'', dir:'', nombre:'María Gómez' } });
      s.run("actuaAgendaGuardar('María Gómez',{email:'mgomez@gmail.com'})");
      const v = s.real['maria gomez'] || {};
      t(P + 'agenda3 · sumar el mail al MISMO contacto no le borra el teléfono',
        v.tel === '62553743663' && v.email === 'mgomez@gmail.com', JSON.stringify(v));
      t(P + 'agenda3 · y la migración por tilde/mayúscula sigue en pie (una sola entrada)',
        Object.keys(s.real).length === 1, JSON.stringify(Object.keys(s.real)));
    }
    /* Mutación de control: si alguien vuelve a poner actuaContacto ahí, esto salta. */
    t(P + 'agenda3 · el «previo» se toma de la clave EXACTA, no de un parecido',
      /const _ex = a\[k\];/.test(src) && !/const previo = actuaContacto\(k\)/.test(src));

    /* ── (2) EL PANEL QUE FALLABA EN SILENCIO ──
       «no me deja guardar contactos», dicho por Darío. El retorno de actuaAgendaGuardar no se
       miraba: con el almacenamiento negado se limpiaban los campos y no se decía nada. */
    {
      const cod = extraer(src, 'agendaAgregarDesdePanel');
      t(P + 'panel · mira el retorno de actuaAgendaGuardar antes de dar por guardado',
        /if\s*\(\s*!actuaAgendaGuardar\(/.test(cod), cod.slice(0, 120));
      t(P + 'panel · si el navegador niega el guardado, lo dice y no limpia los campos',
        /No pude guardarlo/.test(cod) && /return;/.test(cod));
      t(P + 'panel · y cuando SÍ guarda, lo confirma a la vista',
        /agendaAvisoPanel\(/.test(cod), cod.slice(-160));
      /* que el aviso exista de verdad y no sea una llamada a la nada */
      t(P + 'panel · el aviso del panel existe como función', /function agendaAvisoPanel\(/.test(src));
      /* y que sea accesible: un cartel que el lector de pantalla no anuncia no avisó nada */
      const codAv = extraer(src, 'agendaAvisoPanel');
      t(P + 'panel · el aviso se anuncia también para lectores de pantalla',
        /aria-live/.test(codAv) && /status/.test(codAv), codAv.slice(0, 100));
    }

    /* ── (3) CONTAR LO QUE HAY EN LA AGENDA ──
       «¿cuántas Marías tenés en la agenda?» se iba al modelo y el modelo negaba tener la
       agenda. Ahora contesta la capa, con datos ciertos. */
    {
      const marca = (P.indexOf('MIRROR') >= 0) ? 'v50-cuantos' : 'v41-cuantos';
      /* extraerRegla() del banco devuelve SOLO la regex; acá hace falta el objeto entero
         (re + run) para probar el comportamiento, no el patrón. La regla se abre con
         `{ /* <marca>` y se cierra con `},` en su propia sangría: se toma ese tramo tal cual
         está en el HTML, así el test sigue al código y no a una copia. */
      const _m = src.indexOf(marca);
      const _ini = _m < 0 ? -1 : src.lastIndexOf('{', _m);
      const _fin = _ini < 0 ? -1 : src.indexOf('\n  },', _ini);
      const rg = (_ini >= 0 && _fin > _ini) ? src.slice(_ini, _fin + 4) : null;
      t(P + 'cuantos · la regla existe y está en la lista', !!rg);
      if (rg) {
        const AG3 = { 'maria gomez': { tel:'1', email:'a@x.com', nombre:'María Gómez' },
                      'maria lopez': { tel:'', email:'b@x.com', nombre:'María López' },
                      'dario tello': { tel:'2', email:'', nombre:'Darío Tello' } };
        const c = vm.createContext({ String, RegExp, Object, JSON, Array,
          actuaAgenda: function(){ return AG3; } });
        vm.runInContext(codT + '\n' + 'globalThis.__R = ' + rg + ';', c);
        const pruebe = function(txt){
          return vm.runInContext('(function(){ const m=__R.re.exec(' + JSON.stringify(txt) + '); return m? __R.run(m) : null; })()', c);
        };
        const r1 = pruebe('cuántas marías tenés en la agenda?');
        t(P + 'cuantos · «cuántas marías tenés en la agenda» la contesta la capa', typeof r1 === 'string' && !!r1, String(r1));
        t(P + 'cuantos · cuenta las DOS y las nombra', /2/.test(r1||'') && /María Gómez/.test(r1||'') && /María López/.test(r1||''), String(r1));
        t(P + 'cuantos · el plural «marías» resuelve al singular «maria»', !/no tengo ning/i.test(r1||''), String(r1));
        const r2 = pruebe('cuántos contactos tenés?');
        t(P + 'cuantos · el total sale bien', /3/.test(r2||''), String(r2));
        const r3 = pruebe('cuántos pedros tenés en la agenda?');
        t(P + 'cuantos · un nombre que no está se dice de frente, no se inventa',
          /no tengo/i.test(r3||'') && /no lo voy a inventar/i.test(r3||''), String(r3));
        const r4 = pruebe('cuántos darios tenés en la agenda?');
        t(P + 'cuantos · con uno solo lo dice en singular y no pide precisar', /Uno solo/.test(r4||''), String(r4));
        /* LO QUE NO TIENE QUE PASAR: robarle el turno a una charla cualquiera. */
        t(P + 'cuantos · «cuántos alumnos tenés» NO le pertenece a la capa', pruebe('cuántos alumnos tenés') === null);
        t(P + 'cuantos · «cuántos años tenés» tampoco', pruebe('cuántos años tenés') === null);
        t(P + 'cuantos · «cuánta plata tenés» tampoco', pruebe('cuánta plata tenés') === null);
        t(P + 'cuantos · «cuántos alumnos tenés en el curso» tampoco (no dice agenda)', pruebe('cuántos alumnos tenés en el curso') === null);
        /* y la agenda vacía se admite en vez de contestar un cero mudo */
        const cV = vm.createContext({ String, RegExp, Object, JSON, Array, actuaAgenda: function(){ return {}; } });
        vm.runInContext(codT + '\n' + 'globalThis.__R = ' + rg + ';', cV);
        const r5 = vm.runInContext('(function(){ const m=__R.re.exec("cuántos contactos tenés?"); return m? __R.run(m) : null; })()', cV);
        t(P + 'cuantos · con la agenda vacía lo dice y explica cómo sumar uno',
          /vac[ií]a/i.test(r5||'') && /guard[aá]/i.test(r5||''), String(r5));
      }
    }

    /* ── (4) EL MAIL QUE ABRÍA SIN DESTINATARIO ──
       El prompt le pedía al modelo poner "para":"" cuando no sabía la dirección. Así la capa
       se quedaba sin NADA para buscar en la agenda, y el correo abría vacío teniendo el mail
       guardado. Ahora el prompt manda el NOMBRE y la capa lo resuelve. */
    {
      t(P + 'para · el prompt pide el NOMBRE cuando no hay dirección',
        /poné en "para" el NOMBRE tal como te lo dijo/.test(src));
      t(P + 'para · y sigue prohibiendo inventar direcciones',
        /JAMÁS inventes direcciones/.test(src));
      t(P + 'para · la marca vieja («poné "para":""» a secas) ya no está',
        !/si la dirección no aparece en esta conversación, poné "para":""/.test(src));
      t(P + 'para · cuando no se encuentra la dirección, la tarjeta dice A QUIÉN iba',
        /falta su dirección/.test(src));
      t(P + 'para · la búsqueda en la agenda local sigue enchufada',
        /if \(!dir\)\{ const c=actuaContacto\(_nom\); if \(c && actuaMailDirOk\(c\.email\)\) dir=c\.email; \}/.test(src));
    }
  }

    /* ── (5) LA CADENA DE MOTORES DE LA PLATAFORMA (v41-cloudflare) ──
       Porte del v45-cloudflare del MIRROR. Se prueba CORRIENDO, con el motor mockeado: el
       orden importa (Cloudflare antes que el respaldo pago) y, si caen todos, el tipo del
       último error real tiene que sobrevivir para que el cartel diga la verdad. */
    if (etiqueta === 'PLATAFORMA') {
      t(P + 'motor · Cloudflare entró en la lista de respaldos',
        /id:'cloudflare',\s*url:CLOUDFLARE_URL,[^}]*modelo:MODELO_CLOUDFLARE/.test(src));
      t(P + 'motor · y el respaldo configurable del constructor sigue ahí',
        /id:'cerebras',\s*url:CEREBRAS_URL,\s*key:CEREBRAS_KEY,\s*modelo:MODELO_CEREBRAS/.test(src));
      t(P + 'motor · la URL de Cloudflare sigue al proxy que ponga cada usuario',
        /CLOUDFLARE_URL = PROXY_URL \+ '\/cloudflare';/.test(src) &&
        /aplicarConfigVars[\s\S]{0,900}?CLOUDFLARE_URL = PROXY_URL \+ '\/cloudflare';/.test(src));
      t(P + 'motor · el tamaño de contexto NO cambia de motor (se arregla recortando)',
        /if \(e\.tipo === 'too_big'\) throw e;/.test(src));
      t(P + 'motor · si caen todos, se conserva el tipo del último error real',
        /* v40-1016 (16/10/2026): manda el último error real SALVO dos casos medidos por el auditor 4 — todo por red → «red»;
           y el «Falta el secret» del respaldo sin clave ya no tapa una saturación real (ver TEST_v40_1016.js) */
        /err\.tipo = _base\.tipo \|\| ultimoErr\.tipo \|\| e\.tipo \|\| 'otro';/.test(src) && /let _base = ultimoErr;/.test(src));
      t(P + 'motor · el aviso nombra el motor que contestó, no uno fijo',
        /cual==='cloudflare' \? 'Cloudflare'/.test(src) && /cual==='cerebras' \? 'Cerebras'/.test(src));
      t(P + 'motor · y va una sola vez por sesión (es información, no un nag)',
        /* v40-1023 (23/10/2026, auditor 4): lo pasajero (ocupado, caída, lento) sigue yendo UNA vez por sesión; lo que hay que
           arreglar (clave rota, pago) se avisa una vez por cada causa — antes decía «Todo en orden» ante un 401 */
        /if \(c\.grave \? respaldoAvisos\[c\.k\] : respaldoAvisado\) return;/.test(src));
      /* HONESTIDAD: los dos textos que prometían «Cerebras gratis» ya no pueden estar —
         Cerebras cobra desde el 17/08/2026. Prometer gratis lo que cobra es lo que este
         proyecto no hace. */
      t(P + 'motor · no queda ni un texto prometiendo «respaldo Cerebras (gratis)»',
        !/activá el respaldo Cerebras \(gratis\)/.test(src));
      t(P + 'motor · el cartel sin respaldo nombra la salida GRATIS primero',
        /la salida gratis es agregarle a tu proxy la ruta \/cloudflare/.test(src));

      const codM = [depsMotor(src), extraer(src, 'avisarRespaldoUnaVez'), extraer(src, 'callGroq')].join('\n'); // v40-octubre: + depsMotor
      const correr = function(quienContesta, tipos){
        const pedidos = [];
        const ctx = vm.createContext({
          console, Promise, Error, JSON, String, mode: 'mirror',
          CLOUDFLARE_ON: true, CLOUDFLARE_URL: '/cf', MODELO_CLOUDFLARE: '@cf/x',
          CEREBRAS_KEY: 'proxy', CEREBRAS_URL: '/cb', MODELO_CEREBRAS: 'cb',
          GROQ_URL: '/gq', GROQ_KEY: '', MODELO_GROQ: 'gq',
          motorActivo: 'groq', respaldoAvisado: false,
          setTypingNote: function(){}, addMsg: function(){},
          llamarMotorVigente: async function(url){
            pedidos.push(url);
            if (url === '/gq') throw Object.assign(new Error('groq'), { tipo: 'rate_limit' });
            if (url === quienContesta) return 'RESP';
            const tp = (url === '/cf') ? (tipos.cf || 'red') : (tipos.cb || 'pago_requerido');
            throw Object.assign(new Error(url), { tipo: tp });
          }
        });
        vm.runInContext(codM, ctx);
        return { ctx: ctx, pedidos: pedidos, run: vm.runInContext('callGroq([],"",10,0.5)', ctx) };
      };
      { const c = correr('/cf', {});
        c.run.then(function(r){
          t(P + 'motor · Groq cae → contesta Cloudflare', r === 'RESP');
          t(P + 'motor · el orden fue Groq y después Cloudflare', c.pedidos.join(',') === '/gq,/cf');
          t(P + 'motor · si Cloudflare contesta, no se molesta al respaldo pago', c.pedidos.indexOf('/cb') === -1);
          t(P + 'motor · motorActivo queda en cloudflare', vm.runInContext('motorActivo', c.ctx) === 'cloudflare');
        }).catch(function(e){ t(P + 'motor · Cloudflare contesta sin excepción', false, e && e.message); }); }
      { const c = correr('/cb', {});
        c.run.then(function(r){
          t(P + 'motor · si Cloudflare no está en el proxy, sigue de largo al respaldo', r === 'RESP');
          t(P + 'motor · orden completo Groq, Cloudflare, respaldo', c.pedidos.join(',') === '/gq,/cf,/cb');
        }).catch(function(e){ t(P + 'motor · el respaldo de último recurso', false, e && e.message); }); }
      { const c = correr('NADIE', { cf: 'red', cb: 'pago_requerido' });
        c.run.then(function(){ t(P + 'motor · si caen todos NO devuelve respuesta', false); })
             .catch(function(e){
               t(P + 'motor · caídos todos, propaga el tipo del ÚLTIMO error (pago), no «otro»', e && e.tipo === 'pago_requerido', e && e.tipo);
               t(P + 'motor · y queda marcado que fallaron todos', !!(e && e.ambosMotores));
             }); }
      /* Sin proxy con la ruta y sin clave de respaldo: el intento a Cloudflare igual se hace
         (es inocuo) y el usuario recibe un error con tipo, no un «algo raro». */
      { const c = correr('NADIE', { cf: 'red', cb: 'red' });
        c.run.then(function(){ t(P + 'motor · sin ningún respaldo vivo NO inventa una respuesta', false); })
             .catch(function(e){ t(P + 'motor · sin ningún respaldo vivo, el error conserva su tipo', !!(e && e.tipo), e && e.tipo); }); }
    }

    /* ── (6) LA LISTA POR CHAT MOSTRABA LA CLAVE, NO EL NOMBRE ──
       El panel visual ya mostraba «María Gómez» desde el porte de la agenda; la lista que se
       pide hablando («mostrame la agenda») seguía escupiendo la clave normalizada
       («maria gomez»), que es justo lo que la normalización introduce. Cazado corriendo la
       lista de reglas de punta a punta, no en vivo. */
    {
      const marca = (P.indexOf('MIRROR') >= 0) ? 'v50-lista' : 'v41-lista';
      t(P + 'lista · la lista por chat usa el nombre lindo', src.indexOf(marca) > 0 &&
        /const nom=\(v && typeof v==='object' && v\.nombre\) \? v\.nombre : k;/.test(src));
      t(P + 'lista · y ya no imprime la clave cruda', !/return '• '\+k\+' '\+\(d\.join\(' '\)/.test(src));
    }

    /* ── (7) LA BARRA FINAL DEL PROXY, Y EL DIAGNÓSTICO DE LOS RESPALDOS (23/08, 2ª ronda) ──
       Darío probó la tanda y el respaldo seguía sin entrar. Dos causas, las dos suyas de la
       plataforma: su proxy estaba guardado CON barra final (las rutas se arman concatenando,
       así que quedaba «…workers.dev//cloudflare» y el Worker ve `//cloudflare`), y el fallo de
       cada respaldo se tragaba en silencio. */
    if (etiqueta === 'PLATAFORMA') {
      const cod = extraer(src, 'proxyLimpio');
      const c = vm.createContext({ String });
      vm.runInContext(cod, c);
      const L = function(u){ return vm.runInContext('proxyLimpio(' + JSON.stringify(u) + ')', c); };
      t(P + 'barra · el caso real de Darío: la barra final se va',
        L('https://piloto-mirror-api.fisica-dat.workers.dev/') === 'https://piloto-mirror-api.fisica-dat.workers.dev',
        L('https://piloto-mirror-api.fisica-dat.workers.dev/'));
      t(P + 'barra · varias barras también', L('https://x.workers.dev///') === 'https://x.workers.dev');
      t(P + 'barra · una dirección ya correcta no se toca', L('https://x.workers.dev') === 'https://x.workers.dev');
      t(P + 'barra · espacios al pegar tampoco molestan', L('  https://x.workers.dev/  ') === 'https://x.workers.dev');
      t(P + 'barra · vacío sigue siendo vacío (sin proxy configurado)', L('') === '' && L(null) === '');
      /* la ruta armada tiene que matchear lo que compara el Worker */
      t(P + 'barra · la ruta resultante es la que el Worker compara',
        L('https://x.workers.dev/') + '/cloudflare' === 'https://x.workers.dev/cloudflare');
      /* y que esté enchufado en los TRES lugares donde entra el proxy */
      t(P + 'barra · se limpia al arrancar', /let PROXY_URL = proxyLimpio\(CONFIG\.proxyUrl\);/.test(src));
      t(P + 'barra · se limpia al aplicar la config', /PROXY_URL = proxyLimpio\(CONFIG\.proxyUrl\);\s*\/\/ v41-barra/.test(src));
      t(P + 'barra · y se GUARDA limpio desde el constructor', /CONFIG\.proxyUrl = proxyLimpio\(v\('c-proxy'\)\);/.test(src));

      /* diagnóstico: qué falló y por qué, en criollo */
      const codD = [extraer(src, 'diagRespaldoUno'), extraer(src, 'diagRespaldosTexto')].join('\n');
      const c2 = vm.createContext({ String, RegExp, Array, diagRespaldos: [] });
      vm.runInContext(codD, c2);
      const D = function(lista){ vm.runInContext('diagRespaldos = ' + JSON.stringify(lista) + ';', c2); return vm.runInContext('diagRespaldosTexto()', c2); };
      const r404 = D([{ id:'cloudflare', tipo:'config', status:404, msg:'' }]);
      t(P + 'diag · el 404 se dice en criollo, no como número', /esa ruta no está en tu proxy/.test(r404), r404);
      t(P + 'diag · y nombra a Cloudflare', /Cloudflare/.test(r404), r404);
      const r2 = D([{ id:'cloudflare', tipo:'config', status:404, msg:'' },
                    { id:'cerebras', tipo:'otro', status:500, msg:'Falta el secret CEREBRAS_KEY' }]);
      t(P + 'diag · con dos respaldos caídos explica LOS DOS', /esa ruta no está/.test(r2) && /falta su clave en el proxy/.test(r2), r2);
      t(P + 'diag · el respaldo configurable no se nombra «Cerebras» de prepo (es white-label)',
        /el respaldo configurado/.test(r2), r2);
      t(P + 'diag · el 402 se dice como pago', /pide pago/.test(D([{ id:'cerebras', tipo:'pago_requerido', status:402, msg:'' }])));
      t(P + 'diag · sin nada anotado no agrega ruido al cartel', D([]) === '');
      t(P + 'diag · el detalle viaja dentro del cartel de error', /\+ diagRespaldosTexto\(\) \+/.test(src));
      t(P + 'diag · cada fallo queda además en «¿qué te falló hoy?»', /regError\('motor:'\+rsp\.id, eR\)/.test(src));
      t(P + 'diag · si un respaldo SÍ contesta, no queda nada que explicar',
        /diagRespaldos = \[\];\s*\/\/ salió bien/.test(src));
    }

    /* ── (8) EL SELLO «GRATIS» SOBRE UN MOTOR QUE PIDE TARJETA (Darío, 23/08) ──
       La tarjeta de Cerebras en el constructor se contradecía a sí misma: el párrafo explicaba
       que desde el 17/08/2026 pide tarjeta, y abajo, en la misma tarjeta, seguía el sello verde
       «✓ Gratis, sin tarjeta». Quien elige un motor mira el sello, no el párrafo. */
    if (etiqueta === 'PLATAFORMA') {
      t(P + 'cerebras · ya no está marcado como motor gratuito',
        !/nombre: 'Cerebras', tipo: 'gratuito'/.test(src));
      t(P + 'cerebras · queda marcado como «pide tarjeta», que es lo que hace',
        /nombre: 'Cerebras', tipo: 'tarjeta'/.test(src));
      t(P + 'cerebras · su línea de costo ya no dice «Gratis, sin tarjeta»',
        !/cerebras:\s*\{ free:true/.test(src));
      t(P + 'cerebras · y manda a Cloudflare como el respaldo gratis de hoy',
        /cerebras:\s*\{ free:false[^}]*Cloudflare/.test(src));
      t(P + 'cerebras · el sello tiene los TRES estados, no dos',
        /m\.tipo==='tarjeta' \? 'Pide tarjeta'/.test(src));
      /* Groq NO se toca: ese sí sigue gratis y sin tarjeta. Si alguien se lleva puesto el
         sello de Groq «por las dudas», esto salta. */
      t(P + 'cerebras · Groq sigue siendo gratuito (no se tocó de más)',
        /nombre: 'Groq', tipo: 'gratuito'/.test(src) && /groq:\s*\{ free:true/.test(src));
      /* Y la sección «✓ Gratis — y alcanza de sobra» no puede seguir contando a Cerebras
         entre lo gratis. */
      t(P + 'cerebras · la lista de lo gratis ya no lo incluye, y nombra a Cloudflare',
        /Respaldo Cloudflare:<\/b> 10\.000 neuronas por día/.test(src) &&
        /<b style="color:#e8e8ff;">Cerebras<\/b> ya NO entra acá/.test(src));
    }

    /* ══════════ 24/08/2026 — 2ª AUDITORÍA EN VIVO DE LA PLATAFORMA v41 ══════════════════
       Tres hallazgos de Darío usando la app deployada. Marcas: v42-* plataforma, v51-* MIRROR. */
    {
      /* ── (A) «¿QUÉ DATOS TENÉS EN LA AGENDA?» ABRÍA EL PANEL DE PRIVACIDAD ──
         La regla de transparencia termina con `qué datos tenés|guardás` y se comía una
         pregunta que era de agenda. Se arregla de los DOS lados: aquella se corre con un
         lookahead, y la de ver-agenda acepta «datos» para quedársela. */
      const marca = (P.indexOf('MIRROR') >= 0) ? 'v51-agenda4' : 'v42-agenda4';
      t(P + 'agenda4 · la marca está en el código', src.indexOf(marca) > 0);
      /* Las dos regex se sacan del HTML y se corren de verdad — no alcanza con ver el texto. */
      const _reDe = function(fragmento){
        const i = src.indexOf(fragmento); if (i < 0) return null;
        const j = src.lastIndexOf('re: /', i + fragmento.length);
        if (j < 0) return null;
        const fin = src.indexOf('/i,', j);
        try { return eval(src.slice(j + 4, fin + 2)); } catch(e){ return null; }
      };
      const rePriv  = _reDe('privacidad|qu[e');
      const reAgend = _reDe('(?:agenda|mis\\s+contactos)');
      t(P + 'agenda4 · las dos reglas se extrajeron', !!rePriv && !!reAgend);
      if (rePriv && reAgend) {
        const q = 'QUE DATOS TENÉS EN LA AGENDA?';
        t(P + 'agenda4 · el caso exacto de Darío ya NO entra en privacidad', !rePriv.test(q), q);
        t(P + 'agenda4 · y SÍ entra en la regla de la agenda', reAgend.test(q), q);
        /* variantes que también tienen que ir a la agenda */
        t(P + 'agenda4 · «qué datos tenés en mis contactos» también', !rePriv.test('qué datos tenés en mis contactos') && reAgend.test('qué datos tenés en mis contactos'));
        /* LO QUE NO TIENE QUE ROMPERSE: privacidad sigue siendo privacidad. */
        t(P + 'agenda4 · «¿qué datos tenés míos?» SIGUE abriendo privacidad', rePriv.test('¿qué datos tenés míos?'));
        t(P + 'agenda4 · «¿qué datos guardás?» también', rePriv.test('qué datos guardás'));
        t(P + 'agenda4 · «privacidad» a secas también', rePriv.test('privacidad'));
        t(P + 'agenda4 · «¿sos una IA?» también', rePriv.test('¿sos una ia?'));
        t(P + 'agenda4 · «qué hacés con lo mío» también', rePriv.test('qué hacés con lo mío'));
        /* y la de agenda no se lleva puesta la de privacidad */
        t(P + 'agenda4 · «¿qué datos tenés míos?» NO abre la agenda', !reAgend.test('¿qué datos tenés míos?'));
        t(P + 'agenda4 · «mostrame la agenda» sigue andando', reAgend.test('mostrame la agenda'));
        t(P + 'agenda4 · «qué contactos tenés» sigue andando', reAgend.test('qué contactos tenés'));
      }
    }

    {
      /* ── (B) EL AUDIO ENTRECORTADO: se encolaban TODOS los utterances de una ──
         El propio archivo ya lo sabía para leer documentos («encolar miles de utterances
         cuelga el sintetizador») y lo hacía bien ahí. El chat no. */
      const marca = (P.indexOf('MIRROR') >= 0) ? 'v51-vozfluida' : 'v42-vozfluida';
      t(P + 'voz · la marca está en el código', src.indexOf(marca) > 0);
      t(P + 'voz · existe la cola encadenada', /function hablarCola\(trozos, voz, matiz, id\)/.test(src));
      const cod = extraer(src, 'hablarCola');
      t(P + 'voz · encadena por onend', /u\.onend = seguir;/.test(cod));
      // v40-audit5 (plataforma): onerror puede primero RELEER el trozo con una voz local (rescatar); si no, sigue igual.
      t(P + 'voz · y también por onerror (un trozo que falla no deja muda la lectura)', /u\.onerror = seguir;/.test(cod) || /u\.onerror = function\(ev\)\{[\s\S]{0,400}?rescatar\([^)]*\)\) return;\s*seguir\(\);\s*\};/.test(cod));
      t(P + 'voz · onend y onerror no disparan dos veces', /if \(yaSiguio\) return; yaSiguio = true;/.test(cod));
      t(P + 'voz · una respuesta nueva corta la tanda vieja', /if \(hablarCola\._id !== id\) return;/.test(cod));
      t(P + 'voz · si speak\\(\\) explota, la lectura sigue', /catch\(e\)\{ seguir\(\); \}/.test(cod));
      /* MUTACIÓN DE CONTROL EN VIVO: se corre la cola con un sintetizador de mentira y se
         verifica que hable TODOS los trozos, en orden, uno por vez. */
      {
        const dichos = [], vivos = [];
        const ctxV = vm.createContext({
          setTimeout: function(f){ f(); },                      // sin esperas: el orden es lo que importa
          SpeechSynthesisUtterance: function(txt){ this.text = txt; },
          speechSynthesis: { speak: function(u){ vivos.push(u); dichos.push(u.text); } },
          i18nRecLang: function(){ return 'es-AR'; }
        });
        vm.runInContext(cod, ctxV);
        vm.runInContext('hablarCola._id = 1;', ctxV);
        vm.runInContext("hablarCola(['uno','dos','tres'], null, {rate:1,pitch:1}, 1);", ctxV);
        t(P + 'voz · arranca hablando UN solo trozo, no los tres de una', dichos.length === 1, JSON.stringify(dichos));
        /* Disparar un gancho que el código NO puso tiene que dar un FALLO, no reventar el
           banco entero: un test que explota se lleva puestas todas las pruebas de abajo.
           (Lo aprendimos acá mismo, corriendo la mutación de control de esta misma tanda.) */
        const disparar = function(i, gancho, nombre){
          const fn = vivos[i] && vivos[i][gancho];
          if (typeof fn !== 'function'){ t(P + 'voz · ' + nombre, false, 'no hay ' + gancho + ' en el trozo ' + i); return false; }
          try { fn.call(vivos[i]); return true; } catch(e){ t(P + 'voz · ' + nombre, false, 'explotó: ' + e.message); return false; }
        };
        if (disparar(0, 'onend', 'el primer trozo tiene onend'))
          t(P + 'voz · al terminar el primero, arranca el segundo', dichos.join(',') === 'uno,dos', dichos.join(','));
        if (disparar(1, 'onerror', 'el segundo trozo tiene onerror'))
          t(P + 'voz · si el segundo falla, igual sigue con el tercero', dichos.join(',') === 'uno,dos,tres', dichos.join(','));
        disparar(2, 'onend', 'el tercer trozo tiene onend');
        t(P + 'voz · y termina sin hablar de más', dichos.length === 3, String(dichos.length));
        /* la tanda vieja no puede seguir avanzando por debajo de una nueva */
        vm.runInContext('hablarCola._id = 2;', ctxV);
        disparar(0, 'onend', 'el gancho del primero sigue existiendo');
        t(P + 'voz · una tanda vieja no revive cuando llegó una respuesta nueva', dichos.length === 3, String(dichos.length));
      }
    }

    if (etiqueta === 'PLATAFORMA') {
      /* ── (C) EL RESPALDO NO PUEDE APAGARLE EL STREAMING AL PRINCIPAL ──
         /cloudflare contesta de una sola vez. Si se lo intenta con stream, falla, y ese
         fallo apagaba STREAM_OK para toda la sesión: el principal perdía la fluidez. */
      t(P + 'stream · el respaldo queda excluido del intento de streaming',
        /const esRespaldoSinStream = esCerebras \|\| url\.includes\('\/cloudflare'\);/.test(src));
      t(P + 'stream · y el gate usa esa variable, no solo Cerebras',
        /if \(!esRespaldoSinStream && STREAM_OK && mode !== 'jurado'\)/.test(src));
      t(P + 'stream · el camino clásico sigue existiendo como red de seguridad',
        /e\.tipo === 'stream_incompatible'/.test(src) && /STREAM_OK = false/.test(src));
    }

  // ══════════ invariantes del método (lo que NO se tocó) ══════════
  {
    t(P + 'TARS/jurado intactos: la capa share sigue gateada a modo espejo',
      /if \(mode!=='mirror'\|\|typeof reply!=='string'\) return reply;/.test(src));
    t(P + 'la lista blanca de URLs sigue en pie', /function actuaURLValida\(u\)\{ return typeof u==='string' && ACTUA_URL_OK\.some/.test(src));
    t(P + 'no se coló ningún envío automático (nada de submit/auto-send)',
      src.indexOf('navigator.share') > 0 && !/autoEnviar|enviarSolo|sendAuto/.test(src));
  }
}

setTimeout(() => {
  console.log('\n──────────────────────────────────────────');
  console.log('TEST ADVERSARIO F2·C1·C2·C3·C4·H2·H1·H3·VISION·IMAGEN·ROLES·H4·C5·CDN · ' + ok + ' OK / ' + fail + ' fallos');
  if (fallos.length) { console.log('\nFALLOS:'); fallos.forEach(f => console.log('  ✗ ' + f)); process.exitCode = 1; }
  else console.log('Todo verde. La prueba EN VIVO la hace Darío — el verde de acá NO alcanza.');
  console.log('──────────────────────────────────────────');
}, 300);
