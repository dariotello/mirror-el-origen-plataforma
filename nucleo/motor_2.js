// --- Groq ---
// v0.8: extrae los TEMAS de la sesión (conceptos tratados), no el chat literal.
function temasDeLaSesion(){
  const items = construirContenidoInforme();
  // Tomamos las consultas del usuario como "ejes temáticos" que se fueron construyendo.
  const consultas = items.filter(m=>m.role==='user').map(m=>m.text);
  if (!consultas.length) return '';
  return consultas.map((c,i)=>(i+1)+'. '+c).join('\n');
}

// v0.8: búsqueda web bajo demanda para el informe (solo si la bibliografía no alcanza).
async function buscarWebParaInforme(query){
  try {
    const res = await fetch(TAVILY_URL,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+TAVILY_KEY},body:JSON.stringify({query,max_results:4,search_depth:'basic'})});
    if (!res.ok) { try { regError('web (informe)', await webCausaDe(res)); } catch(_){} return ''; } // 429 u otro: el informe sigue sin web, no rompe nada
    const data = await res.json();
    const results = data.results||[];
    if (!results.length) return '';
    return results.map((r,i)=>(i+1)+'. '+r.title+': '+(r.content||'').substring(0,300)).join('\n');
  } catch(e){ return ''; }
}

// v0.9: mensaje claro según el tipo de error.
/* v38-honest (5/08/2026): el 2o parámetro es OPCIONAL y trae lo que dijo el motor. Solo se
   muestra cuando NO se pudo identificar la causa. Antes, un error desconocido salía como
   «No pude procesar la consulta» y ahí se terminaba: ni el usuario ni el que da soporte
   podían saber qué pasó. Ahora, si no se sabe, se dice y se muestra el original — que es la
   única forma de que después se pueda arreglar. Las llamadas viejas siguen andando igual. */
/* v41-diag (23/08/2026) — QUÉ PASÓ CON CADA RESPALDO, EN CRIOLLO.
   Lo llena callGroq y lo lee el cartel de error. Vive en memoria de sesión nomás: es
   diagnóstico del momento, no algo que haya que guardar en ningún lado. */
let diagRespaldos = [];
function diagRespaldoUno(d){
  const nom = d.id==='cloudflare' ? 'Cloudflare' : (d.id==='cerebras' ? 'el respaldo configurado' : d.id);
  /* El 404 es EL caso que había que nombrar: significa que esa ruta no existe en el proxy, y
     es lo único que el administrador puede arreglar en dos minutos. Decir «error 404» no le
     sirve a nadie; decir «esa ruta no está en tu proxy» sí. */
  if (d.status === 404 || /\b404\b/.test(d.msg)) return nom + ': esa ruta no está en tu proxy';
  if (/Falta el secret/i.test(d.msg))            return nom + ': falta su clave en el proxy';
  if (d.tipo === 'pago_requerido')               return nom + ': pide pago';
  if (d.tipo === 'credencial')                   return nom + ': la clave no autoriza';
  if (d.tipo === 'rate_limit')                   return nom + ': también saturado';
  if (d.tipo === 'cupo_excedido')                return nom + ': cupo por minuto excedido';
  if (d.tipo === 'config' || d.tipo === 'red')   return nom + ': no llegué a contestarlo';
  if (d.tipo === 'caido')                        return nom + ': con un error de su lado'; // v40-caido
  return nom + ': ' + (d.tipo || 'falló');
}
function diagRespaldosTexto(){
  try {
    if (!diagRespaldos || !diagRespaldos.length) return '';
    return ' Lo que probé: ' + diagRespaldos.map(diagRespaldoUno).join(' · ') + '.';
  } catch(e){ return ''; }
}
function mensajeError(tipo, detalle){
  if (tipo === 'otro' || !tipo) {
    const d = String(detalle || '').trim().slice(0, 300);
    /* v38-cerebras (9/08/2026): auditoría en vivo de Darío. El cartel «Falta el secret
       CEREBRAS_KEY en el proxy» asustaba: salía como un «algo falló y no sé qué», cuando en
       realidad es una config CONOCIDA (el motor de respaldo sin clave cargada). Se dice claro
       y sin alarmar, separando al USUARIO FINAL (esperá y reintentá) del que ADMINISTRA la app
       (cargá la clave en el proxy). No es un bug de la app: el motor principal no contestó esta
       vez (suele ser el cupo por minuto) y el respaldo todavía no está configurado. */
    if (/Falta el secret/i.test(d)) {
      const esResp = /CEREBRAS/i.test(d);
      return esResp
        /* v41-cloudflare: el texto viejo mandaba a «cargar la clave del respaldo», y con
           Cerebras cobrando desde el 17/08 esa salida cuesta plata. Ahora se nombra primero la
           gratis: agregar la ruta /cloudflare al Worker, que no lleva ninguna clave. */
        ? '⚠️ El motor principal no contestó esta vez (suele ser el cupo de tokens por minuto del plan gratis) y ningún motor de respaldo pudo tomar la posta.' + diagRespaldosTexto() + ' Esperá un momento y reintentá. Si administrás esta app: la salida gratis es agregarle a tu proxy la ruta /cloudflare (Workers AI, sin clave ni tarjeta — está explicada en el LEEME del paquete); la otra es cargar la clave de un motor pago en Settings → Variables and Secrets.'
        : '⚠️ Falta configurar una clave en tu proxy. Si administrás esta app, cargala en Settings → Variables and Secrets; si no, avisale a quien la configuró. Mientras tanto, reintentá en un momento.';
    }
    return d
      ? '⚠️ Algo falló y no sé bien qué. Esto es lo que contestó el motor, tal cual: «' + d + '». Reintentá en un momento; si se repite, guardá ese texto.'
      : '⚠️ No pude procesar la consulta. Reintentá en un momento.';
  }
  return mensajeErrorConocido(tipo);
}
function mensajeErrorConocido(tipo){
  if (tipo === 'rate_limit') {
    return CEREBRAS_KEY
      ? '⚠️ Los motores están saturados en este momento. Esperá unos minutos y reintentá.'
      /* v41-cloudflare: este cartel invitaba a activar el respaldo de Cerebras diciendo que
         era gratis. Dejó de serlo el 17/08/2026, cuando Cerebras cerró su tier libre.
         Prometer gratis algo que cobra es justo lo que este proyecto no hace, así que ahora
         la salida que se ofrece primero es la que de verdad no cuesta nada: la ruta del
         Worker. (El banco exige que la promesa vieja no vuelva a aparecer en ningún lado.) */
      : '⚠️ Tu motor principal está saturado (límite del plan gratis agotado).' + diagRespaldosTexto() + ' Esperá unos minutos o probá más temprano. Si administrás esta app, el respaldo gratis se activa agregándole a tu proxy la ruta /cloudflare (Workers AI: sin clave, sin tarjeta) — está en el LEEME del paquete.';
  }
  if (tipo === 'too_big') return '⚠️ La consulta es demasiado grande (muchos datos + PDFs juntos). Probá una pregunta más específica o sobre menos documentos a la vez.';
  /* v38-cupo: el cupo por minuto no es lo mismo que una consulta grande, y decirlo importa:
     el que cree que su pregunta era mala la achica al pedo. El modelo la habría contestado
     perfecto; el que dijo que no fue el plan gratis del proveedor. */
  if (tipo === 'cupo_excedido') return '⚠️ Esto no es culpa de tu pregunta: tu motor tiene un límite de tokens por minuto en el plan gratis (en Groq son 8.000, contando lo que se manda y lo que contesta), y esta consulta pedía más. Esperá un minuto y reintentá igual, o preguntá sobre menos documentos a la vez. Si configurás un motor de respaldo en CONEX, estas consultas salen por ahí y no te frenan.';
  if (tipo === 'vacio') return '⚠️ El motor respondió vacío (suele pasar con consultas muy pesadas). Probá una pregunta más acotada o reintentá en un momento.';
  /* v39-pago (21/08/2026): el 402 y el 401/403 se dicen de frente y NO se mandan a reintentar
     (ninguno se arregla esperando). En la plataforma cada uno configura su propio motor, así
     que se lo manda a revisar SU proveedor/clave en CONEX, sin asumir cuál usa. */
  if (tipo === 'pago_requerido') return '⚠️ Tu motor pide pago (código 402): su plan gratuito se terminó o te quedaste sin créditos. No es un problema de tu consulta y no se arregla reintentando. Revisá tu proveedor en CONEX: cargá saldo, o pasá a otro motor con tier gratis.';
  if (tipo === 'credencial') return '⚠️ Tu motor rechazó la clave (código 401/403): falta o no autoriza. Esto no se arregla reintentando. Revisá la clave en CONEX (o, si administrás el proxy, que esté cargada ahí).';
  if (tipo === 'red') return '⚠️ Falló la conexión. Revisá tu internet y reintentá.';
  if (tipo === 'timeout') return '⏱ El motor de IA tardó demasiado en contestar y corté la espera para no dejarte colgado.' + diagRespaldosTexto() + ' Reintentá en un momento; si pasa seguido, puede ser tu conexión o el proveedor.'; // v40-tope
  if (tipo === 'caido') return '⚠️ El motor de IA no está contestando bien en este momento (un error de su lado, no de tu consulta ni de tu configuración).' + diagRespaldosTexto() + ' Esperá un momento y reintentá.'; // v40-caido
  if (tipo === 'config') return '⚠️ No pude conectar con tu motor de IA. Revisá en CONEX que tu proxy y tu clave estén bien configurados (y que tu proxy esté publicado).';
  if (tipo === 'modelo_caduco' || tipo === 'modelo_caduco_sin_reemplazo') return '⚠️ Tu modelo configurado ya no está disponible en tu motor. Elegí otro en CONEX (para visión, en ajustes avanzados).';
  return '⚠️ No pude procesar la consulta. Reintentá en un momento.';
}

// v0.7: recorta el contexto RAG a los primeros N fragmentos (para reintento liviano).
function recortarRag(ragContext, n){
  if (!ragContext) return '';
  const bloques = ragContext.split('\n\n=== ');
  if (bloques.length <= 1) return ragContext;
  const primeros = [bloques[0], ...bloques.slice(1, n).map(b=>'=== '+b)];
  return primeros.join('\n\n');
}

// v0.9: llamada genérica a un motor (Groq o Cerebras, ambos compatibles OpenAI).
// ════ v35-stream (Etapa 7) — STREAMING TOKEN A TOKEN ════
// La respuesta se pinta a medida que nace, dentro de la burbuja "escribiendo".
// 100% ADITIVO con fallback: si el proxy no pasa el SSE (proxy viejo), si el motor no
// streamea o si CUALQUIER cosa falla, se marca la sesión como no-streaming y el camino
// clásico sigue intacto. El pipeline final (limpieza, addMsg, chips, informe) no cambia.
let STREAM_OK = true; // se apaga solo ante la primera incompatibilidad (evita dobles requests repetidos)
/* v40-tope (23/10/2026, auditor 4 · pendiente nº 4 del 16/10): los pedidos al motor NO tenían tope de tiempo. Con Groq
   colgado se veían 2 minutos de puntitos, NUNCA se probaba el respaldo, y la respuesta tardía se metía después en la
   charla siguiente (debajo de otra pregunta, y la voz la leía). Ahora cada pedido tiene su tope; al vencer, el error es
   «timeout» y la cadena de respaldo sigue sola, como con cualquier caída. Los números dejan margen: gpt-oss en Groq
   contesta en segundos, y el respaldo de Cloudflare (más lento) entra holgado. */
const TOPE_MOTOR_MS = 45000, TOPE_STREAM_MS = 30000;
function errTopeMotor(ms){ const e = new Error('El motor no contestó en ' + Math.round(ms/1000) + ' s'); e.tipo = 'timeout'; return e; }
async function fetchTextoConTope(url, opts, ms){
  // el tope cubre la conexión Y la lectura del cuerpo: un proxy que manda encabezados y se planta también cuenta
  const ac = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  let vencio = false; const t = setTimeout(function(){ vencio = true; try { ac && ac.abort(); } catch(_){} }, ms);
  try {
    const res = await fetch(url, ac ? Object.assign({}, opts, { signal: ac.signal }) : opts);
    const raw = (await res.text()).trim();
    if (vencio) throw errTopeMotor(ms);
    return { res: res, raw: raw };
  } catch(e){ if (vencio || (e && e.name === 'AbortError')) throw errTopeMotor(ms); throw e; }
  finally { clearTimeout(t); }
}
function pintarStreamParcial(txt){
  try {
    const el = document.getElementById('typing-stream');
    if (!el) return;
    const dots = document.getElementById('typing-dots');
    if (dots) dots.style.display = 'none'; // llegó texto: los puntitos ceden el lugar
    el.style.display = 'block';
    el.innerHTML = formatearParaChat(txt);
    const chat = document.getElementById('chat');
    if (chat) chat.scrollTop = chat.scrollHeight;
  } catch(e){}
}
async function llamarMotorStream(url, key, body){
  const b = Object.assign({}, body, { stream: true });
  // v40-tope: tope para que llegue la respuesta y, después, tope de SILENCIO entre pedazos (se renueva con cada pedazo)
  const ac = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  let vencio = false, tTope = null;
  const armarTope = function(){ if (tTope) clearTimeout(tTope); tTope = setTimeout(function(){ vencio = true; try { ac && ac.abort(); } catch(_){} }, TOPE_STREAM_MS); };
  armarTope();
  let res;
  try {
    res = await fetch(url, Object.assign({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify(b)
    }, ac ? { signal: ac.signal } : {}));
  } catch(e){ clearTimeout(tTope); if (vencio || (e && e.name === 'AbortError')) throw errTopeMotor(TOPE_STREAM_MS); throw e; }
  const ctype = (res.headers.get('content-type')||'').toLowerCase();
  /* v40-tope (23/10, auditor 4): un 429/401/5xx NO es «el proxy no sabe hacer streaming». Antes apagaba el streaming para
     TODA la sesión y además repetía el pedido al instante por el camino clásico (dos golpes seguidos a un cupo lleno).
     Ahora la respuesta de error se le pasa tal cual al camino clásico, que la lee como siempre, sin pedir de nuevo. */
  if (!res.ok && [400, 404, 415, 422].indexOf(res.status) >= 0){ clearTimeout(tTope); const e = new Error('el motor rechazó el streaming (' + res.status + ')'); e.tipo = 'stream_incompatible'; throw e; } // verificador 23/10: eso SÍ es «sin streaming»
  if (!res.ok){ clearTimeout(tTope); return { __resNoOk: res, __tope: function(){ vencio = true; try { ac && ac.abort(); } catch(_){} } }; }
  // Si NO llegó SSE (proxy viejo que bufferea, JSON plano), no es streaming:
  // avisamos con tipo especial y el camino clásico se hace cargo (una sola vez por sesión).
  if (ctype.indexOf('text/event-stream') === -1 || !res.body){
    clearTimeout(tTope);
    const e = new Error('sin SSE ('+res.status+' '+ctype+')'); e.tipo = 'stream_incompatible'; throw e;
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '', acumulado = '', ultimaPintada = 0;
  for(;;){
    let lectura;
    try { lectura = await reader.read(); }
    catch(e){ clearTimeout(tTope); if (vencio || (e && e.name === 'AbortError')) throw errTopeMotor(TOPE_STREAM_MS); throw e; }
    const { done, value } = lectura;
    if (done) break;
    armarTope(); // llegó un pedazo: el silencio se cuenta de nuevo
    buf += dec.decode(value, { stream: true });
    const lineas = buf.split('\n');
    buf = lineas.pop(); // la última puede venir cortada
    for (const l of lineas){
      const linea = l.trim();
      if (!linea.startsWith('data:')) continue;
      const payload = linea.slice(5).trim();
      if (payload === '[DONE]') continue;
      try {
        const j = JSON.parse(payload);
        const delta = j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content;
        if (delta) acumulado += delta;
      } catch(_){}
    }
    /* v38-think (5/08/2026): pintar como máximo ~8 veces por segundo (no recargar el DOM)
       — y NUNCA pintar el pensamiento. El camino clásico limpia <think> al final, pero el
       streaming pinta a medida que llega: sin esto, el razonamiento de un modelo pensante
       aparece en vivo en pantalla y recién se limpia cuando termina. Mientras el <think>
       está abierto, `sinPensamiento` devuelve vacío y no se pinta nada — que es lo correcto:
       que parezca que está pensando, no que muestre cómo piensa. */
    const ahora = Date.now();
    const visible = sinPensamiento(acumulado);
    if (visible && (ahora - ultimaPintada) > 120){ pintarStreamParcial(visible); ultimaPintada = ahora; }
  }
  clearTimeout(tTope);
  const visibleFinal = sinPensamiento(acumulado);
  if (visibleFinal) pintarStreamParcial(visibleFinal);
  return acumulado;
}

/* v38-think (5/08/2026): saca el bloque de razonamiento de un texto. Una sola función para
   que el camino clásico y el de streaming limpien EXACTAMENTE igual — antes cada uno tenía
   su copia y una de las dos se iba a quedar atrás (es la historia de v38-proc y de v29).
   Si el <think> está abierto y sin cerrar, devuelve vacío a propósito. */
function sinPensamiento(txt){
  let c = String(txt || '');
  c = c.replace(/<\|[^|]*\|>/g, '');
  c = c.replace(/<think>[\s\S]*?<\/think>/gi, '');
  if (/<think>/i.test(c)) {
    const partes = c.split(/<\/think>/i);
    c = (partes.length > 1 ? partes[partes.length-1] : c.replace(/<think>[\s\S]*$/i, ''));
  }
  /* Y el caso simétrico, que el banco encontró: un </think> SUELTO, sin apertura (pasa si
     el proveedor recorta el arranque). Todo lo que venga antes de ese cierre es cocina. */
  else if (/<\/think>/i.test(c)) { const p = c.split(/<\/think>/i); c = p[p.length-1]; }
  // algunos modelos anuncian el razonamiento en texto plano, sin etiqueta ninguna.
  // Solo se corta si está AL PRINCIPIO: en el medio podría ser parte de la respuesta.
  c = c.replace(/^\s*(?:here'?s?\s+(?:a|my)\s+(?:thinking|thought)\s+process|let me think(?:\s+step[- ]by[- ]step)?|thinking process:|reasoning:)\s*:?[\s\S]*$/i, '');
  return c.trim();
}

/* ══ v39-salud (19/08/2026) · B3 — CUÁNTO HAY QUE ESPERAR DE VERDAD ════════════
   Hermano del v45-salud del MIRROR personal, construido y probado acá por separado: las dos
   muletas no se dan por idénticas nunca (lección repetida del proyecto).
   POR QUÉ EXISTE: cuando el motor decía «estás al límite», la app esperaba 10, 20 y 35
   segundos —números elegidos a ojo en v2.4/v3.0— teniendo al proveedor diciendo el número
   real. A veces esperaba de más (el cupo ya se había liberado) y a veces de menos (volvía a
   rebotar y quemaba un reintento).
   El proveedor lo dice de dos maneras, y se leen LAS DOS:
     · el encabezado `retry-after` (segundos), que es el estándar HTTP;
     · y el texto del error: «Please try again in 7.723s» / «in 1m30s».
   Las dos porque en la plataforma NO se puede dar por hecho nada del proxy: cada uno que
   despliega esta app pone el suyo, y muchos proxies devuelven solo el cuerpo sin encabezados.
   El texto del error sí llega siempre, porque es el JSON que la app ya lee.
   HONESTIDAD: si el motor no dijo nada, devuelve 0 y se cae en la escalera de siempre. No se
   inventa un número ni se le atribuye al proveedor algo que no dijo. */
function esperaQuePidioElMotor(res, msg){
  try{
    const h = res && res.headers && typeof res.headers.get==='function'
      ? (res.headers.get('retry-after') || res.headers.get('x-ratelimit-reset-tokens') || '') : '';
    if (h){
      /* v45/v39-salud · BUG QUE CAZÓ EL BANCO (19/08): esto decía `parseFloat(h)` a secas, y
         parseFloat('1m30s') devuelve 1 — se comía el formato «1m30s» de Groq y contestaba
         «esperá 1 segundo» cuando el proveedor había pedido 90. Ahora la vía numérica exige
         que el encabezado sea SOLO un número; cualquier otra forma sigue de largo hasta el
         lector de «1m30s» de más abajo. */
      const bruto = String(h).trim();
      const n = /^[\d.]+$/.test(bruto) ? parseFloat(bruto) : NaN;
      if (isFinite(n) && n > 0) return Math.ceil(n);
      const t = Date.parse(h);
      if (isFinite(t)) { const s = Math.ceil((t - Date.now())/1000); if (s > 0) return s; }
      const f = /(?:(\d+)m)?\s*([\d.]+)s/i.exec(String(h));
      if (f) { const s = Math.ceil((parseInt(f[1]||0,10)*60) + parseFloat(f[2]||0)); if (s>0) return s; }
    }
  }catch(_){}
  try{
    const m = /try again in\s+(?:(\d+)m)?\s*([\d.]+)\s*(s|ms|seconds?|segundos?)/i.exec(String(msg||''));
    if (m){
      let s = (parseInt(m[1]||0,10)*60) + parseFloat(m[2]||0);
      if (/^ms$/i.test(m[3])) s = s/1000;   // milisegundos: no confundir 500 ms con 500 s
      s = Math.ceil(s);
      if (s > 0) return s;
    }
  }catch(_){}
  return 0;
}
/* Techo y piso del respeto: si el proveedor pidiera 20 minutos no dejamos la app clavada, y
   si pidiera 0,2 s esperamos 1 s igual para no martillarlo. El techo es 75 s porque las
   cuotas POR MINUTO se liberan dentro de esa ventana. */
const ESPERA_TECHO = 75, ESPERA_PISO = 1;
function esperaSensata(s){ const n = Math.ceil(Number(s)||0); return n<=0 ? 0 : Math.min(ESPERA_TECHO, Math.max(ESPERA_PISO, n)); }

async function llamarMotor(url, key, modelo, messages, systemPrompt, maxTokens, temp){
  // Cerebras usa 'max_completion_tokens'; Groq usa 'max_tokens'. Mandamos el correcto.
  const esCerebras = url.includes('cerebras');
  /* v42-stream (24/08/2026) — EL RESPALDO NO PUEDE APAGARLE EL STREAMING AL PRINCIPAL.
     La ruta /cloudflare contesta de una sola vez (Workers AI no devuelve SSE en formato
     OpenAI, y traducirlo sería reescribir el stream adentro del proxy). Sin esta línea, la
     primera vez que Groq se satura y contesta el respaldo, el intento de streaming falla,
     `STREAM_OK` se apaga PARA TODA LA SESIÓN y el principal pierde la fluidez aunque él sí
     sepa hacer streaming. Un respaldo que degrada al titular no es un respaldo.
     Se lo excluye del intento igual que a Cerebras, por el mismo motivo. */
  const esRespaldoSinStream = esCerebras || url.includes('/cloudflare');
  /* v38-motor: la curita de razonamiento se decidía por PROVEEDOR. Alcanzaba mientras
     gpt-oss viviera solo en Cerebras. Ahora gpt-oss está en el catálogo de Groq (el
     blindaje de caducidad puede caer ahí), así que la condición correcta es por MODELO. */
  const esRazonador = /gpt-oss/i.test(modelo || '');
  /* ── v38-think (5/08/2026) — QUE EL PENSAMIENTO NO VAYA AL CHAT ───────────────────
     qwen3.6 TAMBIÉN es modelo de razonamiento (está en la lista de Groq junto a gpt-oss)
     y su formato por defecto es `raw`: mete la cadena de pensamiento dentro del texto,
     entre <think>…</think>. Salió a la luz el 5/08 en el MIRROR personal de Darío, donde
     se pintó el razonamiento entero en inglés. Acá el limpiador ya estaba (fix v29), pero
     limpiar después es la segunda línea de defensa: la primera es no pedirlo.
     Los dos parámetros están documentados por Groq para este modelo. */
  const esQwenRazonador = /qwen3\.6|qwen3-|qwen\/qwen3/i.test(modelo || '');
  const body = { model: modelo, messages: [{role:'system',content:systemPrompt},...messages], temperature: temp };
  if (esQwenRazonador && !esCerebras) {
    body.reasoning_effort = 'none';    // que no razone: es lo que más se parece a Llama 3.3
    body.reasoning_format = 'hidden';  // y si igual razona, que no lo devuelva
  }
  /* gpt-oss por Groq NO acepta reasoning_format (lo dice la doc): ahí el parámetro es
     include_reasoning. Cerebras es otro proveedor y queda como estaba, que funcionaba. */
  if (esRazonador && !esCerebras) body.include_reasoning = false;
  if (esCerebras || esRazonador) {
    // v1.9: gpt-oss-120b es un modelo de RAZONAMIENTO. Si no le bajamos el esfuerzo de
    // razonar y no le damos margen de tokens, en consultas pesadas se gasta todo el
    // presupuesto "pensando" y devuelve content VACÍO (era la causa del bug). Con
    // reasoning_effort:'low' + un piso de tokens, siempre le queda lugar para la respuesta.
    body.reasoning_effort = 'low';
    // v40-cupo: gpt-oss pide lo que de verdad se midió (salidaEfectiva); el piso viejo de 2500 queda
    // solo para un modelo NO razonador en Cerebras, donde nunca se midió de otra forma.
    body.max_completion_tokens = esRazonador ? salidaEfectiva(modelo, maxTokens) : Math.max(maxTokens, 2500);
  } else {
    body.max_tokens = maxTokens;
  }
  // v35-stream (Etapa 7): primero intentamos SSE (solo motor principal no-Cerebras y si la
  // sesión no demostró ser incompatible). Fallo o vacío → cae al camino clásico de siempre.
  let _resNoOk = null; // v40-tope: error HTTP que llegó por el intento de streaming (se lee abajo, sin pedir de nuevo)
  if (!esRespaldoSinStream && STREAM_OK && mode !== 'jurado'){ // v36-stream-gate (Etapa 0 Ciclo 2, decisión Darío 09/07): el veredicto del jurado cae ENTERO, con peso de sentencia; MIRROR y TARS piensan en vivo
    try {
      let c = await llamarMotorStream(url, key, body);
      if (c && c.__resNoOk) { _resNoOk = c.__resNoOk; c = ''; }
      // v38-think: MISMO limpiador que el camino clásico, y ahora es literalmente el mismo
      // (una función, no una copia). Había tres copias de esto y bastaba con que alguien
      // mejorara una para que las otras dos quedaran atrás.
      c = sinPensamiento(c);
      c = c.replace(/^\(?\s*no further output\s*\.?\)?$/gim,'').trim();
      c = c.replace(/\s*\(?\bno further output\b\.?\)?\s*$/i,'').trim();
      c = normalizarUnicode(c).trim();
      if (c) return c;
      // streaming "anduvo" pero quedó vacío → que el camino clásico y la capa multi-motor decidan
    } catch(e) {
      if (e && e.tipo === 'timeout') throw e; // v40-tope: el motor se colgó → que siga la cadena de respaldo (no reintentar el mismo)
      if (e && e.tipo === 'stream_incompatible') { STREAM_OK = false; console.warn('[MIRROR·stream] proxy/motor sin SSE — sigo en modo clásico esta sesión'); }
      else { regError('streaming', e); }
      // en cualquier caso: seguimos al camino clásico sin romper nada
    }
  }
  let res, _raw;
  if (_resNoOk) {
    res = _resNoOk;
    const _t = setTimeout(function(){ try { _resNoOk.body && _resNoOk.body.cancel && _resNoOk.body.cancel(); } catch(_){} }, TOPE_STREAM_MS);
    try { _raw = (await res.text()).trim(); } catch(_){ _raw = ''; } finally { clearTimeout(_t); }
  } else {
    const _r = await fetchTextoConTope(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify(body)
    }, TOPE_MOTOR_MS);
    res = _r.res; _raw = _r.raw;
  }
  // v28: parseo protegido. Si el proxy devuelve algo que NO es JSON (vacío, error de
  // Cloudflare, body cortado), antes explotaba con «Unexpected end of JSON input» o se
  // confundía con «respondió vacío». Un motor OpenAI-compatible SIEMPRE devuelve JSON;
  // un body vacío o no-JSON = problema de conexión/proxy. Damos un mensaje claro.
  let data;
  /* v40-caido (16/10, auditor 4): un 500/502/503 vacío o con HTML (el proveedor caído un rato) se le presentaba al usuario
     como «revisá en CONEX tu proxy y tu clave» — lo mandaba a tocar una configuración que estaba bien. */
  const _errConfig = () => { if (res.status >= 500 || res.status === 429) { const e2 = new Error('El motor respondió con un error de su lado (código ' + res.status + ').'); e2.tipo = res.status === 429 ? 'rate_limit' : 'caido'; e2.status = res.status; return e2; } const e = new Error('No pude conectar con tu motor de IA. Revisá en CONEX que tu proxy y tu clave estén bien configurados (y que tu proxy esté publicado).'); e.tipo = 'config'; e.status = res.status; return e; };
  if (!_raw) throw _errConfig();
  try { data = JSON.parse(_raw); } catch(_) { throw _errConfig(); }
  if (data.error) {
    const msg = (data.error.message || JSON.stringify(data.error));
    const cod = ((data.error.code || data.error.type || '') + '').toLowerCase();
    let tipo = 'otro';
    // v30 — «modelos que no caducan»: un modelo dado de baja / inexistente se detecta acá
    // para poder caer al siguiente VIGENTE del mismo motor (ver llamarMotorVigente).
    if (/model[_-]?(decommission|not[_-]?found|not[_-]?exist|deprecat)/.test(cod) ||
        (/\bmodel\b/i.test(msg) && /(decommission|deprecat|no longer (available|supported)|has been (removed|retired|discontinued|shut ?down)|does not exist|not found|invalid model)/i.test(msg))) tipo = 'modelo_caduco';
    else if (res.status === 429 || /rate limit|too many|quota|capacity|limit reached/i.test(msg)) tipo = 'rate_limit';
    /* v38-honest (5/08/2026) — POR QUÉ SE ANGOSTÓ ESTA REGLA.
       «tokens per» y «reduce» eran un colador: el mensaje de saturación de Groq dice
       literalmente «…on tokens per minute (TPM)», y muchos errores del proveedor traen la
       palabra «reduce». Con eso, la app afirmaba «tu consulta es demasiado grande» ante
       fallos que no tenían nada que ver con el tamaño. Visto en vivo el 5/08 en el MIRROR
       personal: cuatro palabras y le contestó que la consulta era demasiado grande.
       Ahora solo entra lo que habla inequívocamente de tamaño de contexto. */
    /* v38-cupo (5/08/2026) — «NO ENTRA EN EL CUPO» NO ES «NO ENTRA EN EL MODELO».
       Portado del MIRROR personal el mismo día. Los planes gratuitos limitan tokens POR
       MINUTO (entrada más salida): si una sola consulta lo pasa, la rechazan entera aunque
       el modelo pudiera contestarla perfecto. Eso NO es un problema de tamaño y no se
       arregla recortando: se arregla esperando, o saliendo por el motor de respaldo, que
       tiene su propio cupo. Distinguirlo importa porque las salidas son distintas.
       (En el MIRROR personal, además, se mide el pedido antes de mandarlo. Acá NO se hace:
       el cupo depende del proveedor que cada uno configure en CONEX, y poner un número
       fijo sería inventar un límite que quizá no es el suyo.) */
    else if (/tokens per minute|\bTPM\b|per minute \(TPM\)/i.test(msg) || (/request too large/i.test(msg) && /minute/i.test(msg))) tipo = 'cupo_excedido';
    else if (res.status === 413 || /too large|maximum context|context length|context_length|reduce the length|request too large/i.test(msg)) tipo = 'too_big';
    /* v39-pago (21/08/2026) — EL 402 TIENE NOMBRE. Hermano del v45-pago del MIRROR personal,
       verificado acá por separado. Un proveedor que pasa a pago (402) o una clave que no
       autoriza (401/403) NO se arregla esperando ni reintentando. En la plataforma esto
       importa más todavía: cada uno que despliega configura SU motor en CONEX, así que el
       mensaje tiene que mandarlo a revisar SU proveedor/clave, no asumir Cerebras. */
    else if (res.status === 402 || /payment required|insufficient (credit|balance|funds)|billing|add a payment|out of credits/i.test(msg)) tipo = 'pago_requerido';
    else if (res.status === 401 || res.status === 403 || /invalid api key|unauthorized|forbidden|authentication|no autorizad/i.test(msg)) tipo = 'credencial';
    const err = new Error(msg); err.tipo = tipo; err.status = res.status; err.modelo = modelo;
    err.esperaSug = esperaQuePidioElMotor(res, msg); // v39-salud: cuánto pidió esperar el proveedor (0 = no dijo nada)
    throw err;
  }
  // Respuesta de error HTTP sin objeto data.error legible (p.ej. 500/502/503 del proveedor):
  // la tratamos como fallo para que la capa multi-motor caiga a Cerebras en vez de devolver null.
  if (!res.ok) {
    let tipo = 'otro';
    if (res.status === 429) tipo = 'rate_limit';
    else if (res.status === 413) tipo = 'too_big';
    else if (res.status === 402) tipo = 'pago_requerido';           // v39-pago
    else if (res.status === 401 || res.status === 403) tipo = 'credencial'; // v39-pago
    const err = new Error('El motor respondió con estado '+res.status); err.tipo = tipo; err.status = res.status;
    err.esperaSug = esperaQuePidioElMotor(res, ''); // v39-salud: acá no hay cuerpo legible; queda el encabezado
    throw err;
  }
  // v1.9: extraemos el contenido, limpiamos tokens de control que algunos proveedores de
  // gpt-oss dejan filtrar (p.ej. <|return|>) para que no aparezcan ante el jurado, y si el
  // motor respondió 200 pero con content VACÍO NO devolvemos null en silencio: lanzamos un
  // error legible para que la capa multi-motor reaccione y el usuario vea un mensaje claro.
  let contenido = data.choices?.[0]?.message?.content || '';
  contenido = contenido.replace(/<\|[^|]*\|>/g, '').trim();
  // v3.4 — artefactos de razonamiento del motor de respaldo (gpt-oss) que se colaban como
  // respuesta real (visto en producción: MIRROR contestó "No further output"). Los
  // limpiamos; si la respuesta ERA solo eso, queda vacía y la capa multi-motor reintenta.
  // v29 + v38-think — modelos «pensantes» (qwen3.6, gpt-oss) abren <think> y, si se quedan
  // sin tokens, no lo cierran: el razonamiento crudo se colaba en pantalla. Toda esa lógica
  // vive ahora en sinPensamiento(), compartida con el camino de streaming.
  contenido = sinPensamiento(contenido);
  contenido = contenido.replace(/^\(?\s*no further output\s*\.?\)?$/gim,'').trim();
  contenido = contenido.replace(/\s*\(?\bno further output\b\.?\)?\s*$/i,'').trim();
  // v3.5: normalización Unicode de la salida de AMBOS motores (Groq y respaldo Cerebras),
  // así el texto llega limpio a chat, voz, Word y PDF sin caracteres invisibles.
  contenido = normalizarUnicode(contenido).trim();
  if (!contenido) {
    const err = new Error('El motor respondió 200 pero sin contenido (presupuesto de tokens agotado en razonamiento).');
    err.tipo = 'vacio'; err.status = res.status; throw err;
  }
  return contenido;
}

// v0.9: capa multi-motor. Prueba Groq; si falla por lo que sea, cae a Cerebras.
// Mantiene el nombre callGroq para no tocar el resto del código.
// ════ v30 — «MODELOS QUE NO CADUCAN» ════════════════════════════════════════
// Un modelo puede ser dado de baja por el proveedor de un día para el otro (le pasó a la
// visión: Llama-4-Scout deprecado en 5 días). Antes eso = error críptico y chat roto. Ahora:
// si una llamada falla porque el modelo ya no existe, caemos SOLO al siguiente modelo VIGENTE
// del MISMO motor (catálogo MOTORES), reintentamos, lo recordamos en CONFIG y avisamos claro.
// Si no hay alternativa, mensaje accionable hacia CONEX (nunca cuelga). REACTIVO y aislado:
// solo se dispara ante el tipo de error 'modelo_caduco'; cualquier otro error sube intacto.
function _motorKeyDeUrl(url){
  const ruta = (url || '').split('/').filter(Boolean).pop();
  for (const k in MOTORES){ if (MOTORES[k].ruta === ruta) return k; }
  return null;
}
// slot: 'principal' | 'respaldo' usan el catálogo de chat; 'vision' usa modelosVision (si existe).
function modelosAlternativos(url, modeloMuerto, slot){
  const k = _motorKeyDeUrl(url);
  if (!k || !MOTORES[k]) return [];
  const lista = (slot === 'vision') ? (MOTORES[k].modelosVision || []) : (MOTORES[k].modelos || []);
  return Array.isArray(lista) ? lista.filter(m => m && m !== modeloMuerto) : [];
}
function _avisarCambioModelo(de, a){
  try { addMsg('mirror', '🔄 Tu modelo «' + de + '» ya no está disponible en tu motor. Pasé automáticamente a «' + a + '», que sí está vigente. Lo recordé; podés cambiarlo cuando quieras en CONEX.', 'mirror'); } catch(_){}
}
function _persistirModelo(slot, nuevo){
  try {
    if (slot === 'principal') CONFIG.modeloPrincipal = nuevo;
    else if (slot === 'respaldo') CONFIG.modeloRespaldo = nuevo;
    else if (slot === 'vision') CONFIG.modeloVision = nuevo;
    guardarConfig(CONFIG); aplicarConfigVars();
  } catch(_){}
}
// Llama a un motor y, si el modelo está caduco, reintenta con el siguiente VIGENTE del catálogo.
async function llamarMotorVigente(url, key, modelo, messages, systemPrompt, maxTokens, temp, slot){
  try {
    return await llamarMotor(url, key, modelo, messages, systemPrompt, maxTokens, temp);
  } catch(e){
    if (e.tipo !== 'modelo_caduco') throw e;  // cualquier otro error: lo maneja la capa de arriba
    const candidatos = modelosAlternativos(url, modelo, slot);
    for (const alt of candidatos){
      try {
        const r = await llamarMotor(url, key, alt, messages, systemPrompt, maxTokens, temp);
        _persistirModelo(slot, alt); _avisarCambioModelo(modelo, alt);
        return r;
      } catch(e2){ if (e2.tipo !== 'modelo_caduco') throw e2; /* el alt también murió: probamos el próximo */ }
    }
    const donde = (slot === 'vision') ? 'el modelo de visión en CONEX (ajustes avanzados)' : 'otro modelo en CONEX';
    const err = new Error('Tu modelo «' + modelo + '» ya no está disponible y no encontré un reemplazo vigente automático. Elegí ' + donde + '.');
    err.tipo = 'modelo_caduco_sin_reemplazo'; throw err;
  }
}

/* ══ v40-paciente (2/10/2026) — PRIMERO EL PRINCIPAL, DESPUÉS EL RESPALDO ══════════════════════
   El respaldo (Llama en Cloudflare) es más chico y se equivoca más. Antes, ante CUALQUIER «ocupado»
   del principal se saltaba al respaldo en el acto, aunque el motor hubiera dicho «probá en 6 s».
   Ahora: (a) si el principal pide una espera CORTA (≤ PRINCIPAL_ESPERA_MAX s) por el cupo del minuto,
   se espera eso —con la cuenta a la vista— y se le da UNA oportunidad más; (b) si gpt-oss contestó
   vacío (se le fue el margen pensando), UNA vez más con más margen. Si igual no sale, sigue la
   cadena de respaldo de siempre. Un pedido que solo ya es más grande que el cupo («Requested» >
   «Limit») NO se espera: esperar no lo arregla. */
const PRINCIPAL_ESPERA_MAX = 20;
const PRINCIPAL_ESPERA_MAX_ESPEJO = 8;
/* v40-audit9: UNA espera paciente por minuto. Con los dos motores saturados, la escalera de callGroqResiliente (10/20/35 s)
   + hasta 20 s de espera en cada intento podía pasar los 120 s del watchdog (lo vio la auditoría independiente del 2/10). */
const PRINCIPAL_ESPERA_CADA_MS = 60000;
let _principalUltimaEspera = 0;
function pedidoMasGrandeQueCupo(msg){
  const m = /Limit\s*(\d+)[^\d]+(?:Used\s*\d+[^\d]+)?Requested\s*(\d+)/i.exec(String(msg || ''));
  return !!(m && Number(m[2]) > Number(m[1]));
}
function principalConvieneEsperar(e){
  if (!e || !(e.tipo === 'rate_limit' || e.tipo === 'cupo_excedido')) return 0;
  if (pedidoMasGrandeQueCupo(e.message)) return 0;
  const s = Math.ceil(Number(e.esperaSug) || 0);
  /* v40-audit11 (3/10, en vivo): en una charla común (y peor en la charla por voz) 17 s mirando «⏳ espero» es mucho: el
     respaldo ya es más honesto y se ve con su chip. En el espejo se espera hasta 8 s; en el analítico/examinador, hasta 20. */
  const _tope = (typeof mode !== 'undefined' && mode === 'mirror') ? PRINCIPAL_ESPERA_MAX_ESPEJO : PRINCIPAL_ESPERA_MAX;
  if (!(s > 0 && s <= _tope)) return 0;
  if (Date.now() - _principalUltimaEspera < PRINCIPAL_ESPERA_CADA_MS) return 0;   // ya se esperó en este minuto: no se apila
  _principalUltimaEspera = Date.now();
  return s;
}
async function llamarPrincipalPaciente(messages, systemPrompt, maxTokens, temp){
  try {
    return await llamarMotorVigente(GROQ_URL, GROQ_KEY, MODELO_GROQ, messages, systemPrompt, maxTokens, temp, 'principal');
  } catch(e){
    const s = principalConvieneEsperar(e);
    if (s){
      try { if (busy) setButtonsBusy(true); } catch(_){} // v40-tope
      for (let k = s; k > 0; k--){
        try { setTypingNote('⏳ el motor principal pidió ' + s + ' s para liberar el cupo del minuto — espero así contesta él (' + k + ' s)'); } catch(_){}
        await new Promise(function(r){ setTimeout(r, 1000); });
      }
      try { setTypingNote(''); } catch(_){}
      return await llamarMotorVigente(GROQ_URL, GROQ_KEY, MODELO_GROQ, messages, systemPrompt, maxTokens, temp, 'principal');
    }
    if (e && e.tipo === 'vacio' && esModeloRazonador(MODELO_GROQ)){
      return await llamarMotorVigente(GROQ_URL, GROQ_KEY, MODELO_GROQ, messages, systemPrompt, Number(maxTokens || 0) + 1200, temp, 'principal');
    }
    throw e;
  }
}
async function callGroq(messages, systemPrompt, maxTokens, temp) {
  // Motor 1: Groq (rápido) — v40-paciente: con una espera corta o un reintento antes de soltarlo
  try {
    motorActivo = 'groq';
    return await llamarPrincipalPaciente(messages, systemPrompt, maxTokens, temp);
  } catch(e) {
    // Si el problema es que la consulta es muy grande, reducir contexto no se arregla
    // cambiando de motor — propagamos para que el reintento liviano actúe.
    if (e.tipo === 'too_big') throw e;
    /* v38-cupo: el CUPO por minuto sí se arregla cambiando de motor, y es la mejor salida:
       el respaldo tiene su propio cupo, así que contesta la consulta ENTERA en vez de una
       recortada. Antes esto caía en el mismo saco que 'too_big' y se propagaba, o sea que
       se degradaba la respuesta habiendo un respaldo sano al lado sin usar. */
    /* v41-cloudflare (23/08/2026): la cadena de respaldo pasó de UN motor a una LISTA. Se
       prueba en orden y el primero que conteste, gana; cada intento va en su propio try/catch,
       así un fallo (incluido el 404 de un proxy que todavía no tiene la ruta) no rompe nada y
       simplemente pasa al siguiente. Si NINGUNO contesta se propaga el ÚLTIMO error real con
       su tipo, para que el cartel sea el correcto (pago, cupo, credencial) y no un «algo falló
       y no sé qué».
       ORDEN = PRIORIDAD: Cloudflare primero (gratis, sin clave, mismo Worker) y después el
       respaldo que el constructor haya configurado en CONEX, que puede costar plata. */
    const respaldos = [];
    /* v40-escalon (23/10/2026 · radar del 2/10, pedido de Darío: «competente para trabajos complejos con API gratis»): cuando el
       gpt-oss-120b se queda sin cupo del minuto, antes de bajar al Llama chico de Cloudflare se prueba el gpt-oss-20b del MISMO
       Groq: el cupo gratis de Groq es POR MODELO (tiene el suyo) y razona mucho mejor que el respaldo. Solo ante saturación o una
       falla rápida del proveedor; NO ante clave rota o pago (sería la misma clave) ni ante un cuelgue (no se suma otra espera). */
    if (typeof escalonGroqVale === 'function' && escalonGroqVale(e)) respaldos.push({ id:'groq-20b', url:GROQ_URL, key:GROQ_KEY, modelo:MODELO_ESCALON_GROQ });
    if (CLOUDFLARE_ON) respaldos.push({ id:'cloudflare', url:CLOUDFLARE_URL, key:'proxy',      modelo:MODELO_CLOUDFLARE });
    if (CEREBRAS_KEY)  respaldos.push({ id:'cerebras',   url:CEREBRAS_URL,  key:CEREBRAS_KEY,  modelo:MODELO_CEREBRAS });
    let ultimoErr = e;
    /* v41-diag (23/08/2026): antes el fallo de cada respaldo se tragaba en silencio y el
       usuario solo veía el error del ÚLTIMO. Con dos respaldos eso es información perdida:
       no había forma de saber si Cloudflare devolvió 404 (la ruta no está en ese proxy) o si
       falló por otra cosa, salvo abriendo la consola del navegador. Ahora cada intento queda
       anotado y el cartel lo dice en criollo. Misma regla de siempre: si no se pudo, decir
       por qué. */
    diagRespaldos = [];
    for (const rsp of respaldos) {
      try { if (typeof busy !== 'undefined' && busy) setButtonsBusy(true); } catch(_){} // verificador 23/10: la cadena larga (30 + 45 + 45 s) no puede chocar con el reloj de 2 min
      console.warn('Groq falló ('+(e.tipo||'?')+') → probando '+rsp.id);
      try {
        // v40-respaldo: el respaldo contesta más frío y con la orden de no rellenar huecos (RESPALDO_HONESTO)
        const r = await llamarMotorVigente(rsp.url, rsp.key, rsp.modelo, messages, respaldoSystem(systemPrompt), maxTokens, respaldoTemp(temp), 'respaldo');
        motorActivo = rsp.id;
        try { avisarRespaldoUnaVez(rsp.id, e); } catch(_){}   // transparencia: qué red de seguridad actuó
        diagRespaldos = [];   // salió bien: no hay nada que explicar
        return r;
      } catch(eR){
        ultimoErr = eR;
        diagRespaldos.push({ id: rsp.id, tipo: (eR && eR.tipo) || 'otro', status: (eR && eR.status) || 0, msg: String((eR && eR.message) || '') });
        try { regError('motor:'+rsp.id, eR); } catch(_){}   // queda en «¿qué te falló hoy?»
      }
    }
    if (respaldos.length) {
      /* v40-sinred / v40-cartel (16/10, auditor 4): (a) sin internet el usuario leía «Algo falló y no sé bien qué… «Failed
         to fetch»» (y la voz lo leía en inglés): si TODOS los intentos fallaron por red, es «falló la conexión»;
         (b) en la instalación de fábrica el último intento es el respaldo sin clave («Falta el secret»), que tapaba la causa
         real: si el principal o Cloudflare estaban SATURADOS, manda ése (así corre la espera paciente de
         callGroqResiliente y el cartel no dice «agregá /cloudflare» cuando /cloudflare ya contestó). */
      const _esRed = function(x){ return !!x && (x.tipo === 'red' || (!x.tipo && !x.status && /failed to fetch|networkerror|load failed|network request failed|fetch failed/i.test(String(x.message || '')))); };
      const _todos = [e].concat(diagRespaldos.map(function(d){ return { tipo: d.tipo === 'otro' ? '' : d.tipo, status: d.status, message: d.msg }; }));
      const _sinSecret = _todos.filter(function(x){ return !/Falta el secret/i.test(String(x.message || '')); });
      const _ultSecret = /Falta el secret/i.test(String((ultimoErr && ultimoErr.message) || ''));
      const _dSat = diagRespaldos.find(function(d){ return d.tipo === 'rate_limit'; });
      const _sat = (e && e.tipo === 'rate_limit') ? e : (_dSat ? { tipo:'rate_limit', message:_dSat.msg } : null);
      let _base = ultimoErr;
      if (_todos.every(_esRed) || (typeof navigator !== 'undefined' && navigator.onLine === false)) _base = { tipo:'red', message:'sin conexión' };
      else if (_ultSecret && _sat) _base = _sat;
      else if (_ultSecret && _sinSecret.length && _sinSecret.every(_esRed)) _base = { tipo:'red', message:'sin conexión' };
      const err = new Error(_base.message || ultimoErr.message);
      if (_base.esperaSug) err.esperaSug = _base.esperaSug;
      err.tipo = _base.tipo || ultimoErr.tipo || e.tipo || 'otro';
      err.ambosMotores = true;
      throw err;
    }
    if (e.tipo) throw e;
    const err = new Error(e.message); err.tipo = 'red'; throw err;
  }
}
let motorActivo = 'groq'; // para mostrar qué motor respondió, si hace falta
/* ══ v40-respaldo (2/10/2026) — EL MOTOR DE RESPALDO, MÁS HONESTO (backlog 25/09, punto 2) ══════════
   HALLAZGO EN VIVO (25/09, 19:33): las novedades inventadas («barra de acciones rápidas», «cifrado
   actualizado») salieron cuando contestaba el respaldo — un modelo más chico que, ante un hueco,
   completa con lo que suena bien. ARREGLO, solo cuando contesta el respaldo:
   (1) temperatura recortada (≤ 0,35): menos creatividad, menos relleno;
   (2) una orden corta al final del system: lo que no está en el contexto, «no lo sé con certeza»;
   (3) la respuesta lleva el chip «↺ respaldo» — el usuario sabe que contestó la red de seguridad.
   El principal no cambia en nada: esto vive SOLO en la rama del respaldo. */
const RESPALDO_TEMP_MAX = 0.35;
const RESPALDO_HONESTO = '\n\n=== MODO RESPALDO (honestidad reforzada) ===\nAhora contestás como MOTOR DE RESPALDO (un modelo más chico que el principal). Regla dura: afirmá SOLO lo que está escrito en este system o en el contexto del mensaje, o conocimiento general seguro. Sobre esta app, su versión, tus funciones, el usuario, sus datos, su memoria o sus documentos: si no está escrito acá, decí «eso no lo sé con certeza» y no lo completes. No inventes funciones, nombres, cifras, fechas ni citas. Mejor corto y cierto que largo y dudoso.';
function respaldoSystem(sp){ return String(sp || '') + RESPALDO_HONESTO; }
function respaldoTemp(t){ const n = Number(t); return isFinite(n) ? Math.min(n, RESPALDO_TEMP_MAX) : RESPALDO_TEMP_MAX; }
function respaldoChip(){
  if (!motorActivo || motorActivo === 'groq') return '';
  if (typeof nombreRespaldo !== 'function') return '↺ respaldo (' + (motorActivo === 'cloudflare' ? 'Cloudflare' : (motorActivo === 'cerebras' ? 'Cerebras' : motorActivo)) + ')';
  return '↺ respaldo (' + nombreRespaldo(motorActivo) + ')';
}
const MODELO_ESCALON_GROQ = 'openai/gpt-oss-20b';
function escalonGroqVale(e){
  try {
    const t = (e && e.tipo) || '';
    if (!(t === 'rate_limit' || t === 'cupo_excedido' || t === 'caido' || t === 'vacio')) return false;
    if (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.motorPrincipal && CONFIG.motorPrincipal !== 'groq') return false;
    if (typeof GROQ_URL === 'undefined' || !GROQ_URL) return false; // la clave la pone el proxy (GROQ_KEY va vacía a propósito)
    return String(MODELO_GROQ || '') !== MODELO_ESCALON_GROQ;
  } catch(_){ return false; }
}
function nombreRespaldo(id){ return id === 'cloudflare' ? 'Cloudflare' : (id === 'cerebras' ? 'Cerebras' : (id === 'groq-20b' ? 'Groq · gpt-oss-20b' : (id || 'de respaldo'))); }
/* v41-cloudflare: el aviso nombra el motor que REALMENTE salió a la cancha. Decir «Cerebras»
   cuando contestó Cloudflare sería la misma deshonestidad chica que el sello vino a evitar.
   Una vez por sesión: es información, no un nag. */
let respaldoAvisado = false;
/* v40-respaldo-causa (23/10, auditor 4): decía «estaba ocupado… Todo en orden» ante CUALQUIER falla. Con la clave de Groq
   rota (401) o pidiendo pago (402) todas las respuestas salían del modelo chico y nadie se enteraba de que había que
   arreglar algo. Ahora dice la causa real; las que no se arreglan solas se avisan aunque ya se haya avisado otra cosa. */
const respaldoAvisos = {};
function respaldoCausa(e){
  const t = (e && e.tipo) || '', st = (e && e.status) || 0;
  if (t === 'credencial' || st === 401 || st === 403) return { k:'clave', grave:true, txt:'rechazó la clave (código ' + (st||'401/403') + '). Esto NO se arregla solo: si administrás esta app, revisá la clave de Groq en tu proxy' };
  if (t === 'pago_requerido' || st === 402) return { k:'pago', grave:true, txt:'pide pago (código 402). Esto NO se arregla solo: revisá tu cuenta del proveedor' };
  if (t === 'modelo_caduco' || t === 'modelo_caduco_sin_reemplazo') return { k:'modelo', grave:true, txt:'no tiene disponible el modelo configurado. Si administrás esta app, elegí otro en CONEX' };
  if (t === 'rate_limit' || t === 'cupo_excedido' || st === 429) return { k:'ocupado', grave:false, txt:'estaba ocupado (el cupo por minuto del plan gratis)' };
  if (t === 'timeout') return { k:'lento', grave:false, txt:'tardó demasiado en contestar' };
  if (t === 'caido' || st >= 500) return { k:'caido', grave:false, txt:'tuvo una falla de su lado' + (st ? ' (código ' + st + ')' : '') };
  if (t === 'red') return { k:'red', grave:false, txt:'no se pudo alcanzar' };
  return { k:'otro', grave:false, txt:'no contestó' };
}
function avisarRespaldoUnaVez(cual, causa){
  const c = respaldoCausa(causa);
  // lo pasajero se avisa una vez por sesión (es información, no un nag); lo que hay que arreglar, una vez por cada causa
  if (c.grave ? respaldoAvisos[c.k] : respaldoAvisado) return;
  respaldoAvisos[c.k] = true; if (!c.grave) respaldoAvisado = true;
  const nombre = cual==='cloudflare' ? 'Cloudflare' : (cual==='cerebras' ? 'Cerebras' : (cual==='groq-20b' ? 'Groq · gpt-oss-20b, un modelo más chico del mismo Groq, con su propio cupo' : 'de respaldo'));
  try { setTypingNote && setTypingNote(''); } catch(_){}
  const cola = c.grave ? '' : ' Para eso está el respaldo. Si pasa seguido, esperá un minuto entre consultas pesadas.';
  const _pp = ultimaProcedencia, _pr = ultimaProcRecuerdos; ultimaProcedencia = []; ultimaProcRecuerdos = []; // v40-recusados: los chips son de la respuesta, no del aviso
  try { addMsg('mirror', (c.grave ? '⚠️' : 'ℹ️') + ' El motor principal ' + c.txt + ', así que esta respuesta la trajo el motor de respaldo (' + nombre + ').' + cola, mode); } catch(_){}
  ultimaProcedencia = _pp; ultimaProcRecuerdos = _pr;
}

// --- Memoria ---
async function clearMem() {
  /* v37-sec (V36-10) — SIN PIN CONFIGURADO, EL BORRADO NO PUEDE PASARSE CON ENTER.
     Detectado el 25/07 y dejado sin tocar a propósito hasta tener el OK: si el
     usuario nunca puso PIN, `pinOk` comparaba '' contra '' y APRETAR ENTER EN EL
     PROMPT VACÍO BORRABA LA MEMORIA. No era una regresión — venía de antes — pero
     es un botón de borrar sin puerta.
     Ahora: con PIN, manda el PIN. Sin PIN, hay que escribir BORRAR a propósito. */
  const hayPin = !!(PIN_MEM_H || PIN_MEM);
  if (!hayPin) {
    const c = prompt('No tenés PIN configurado, así que te lo pregunto derecho: esto borra la CHARLA guardada (los últimos mensajes) y no se puede deshacer. Tus recuerdos y documentos se borran aparte, desde «◈ mi memoria».\n\nEscribí BORRAR para confirmar (o cancelá).');
    if (c === null) return;
    if (String(c).trim().toUpperCase() !== 'BORRAR') { alert('No borré nada. Para confirmar hay que escribir BORRAR.'); return; }
  } else {
    const pin = prompt('PIN de seguridad:');
    if (pin === null) return; // canceló: no es un error, no hay por qué retarlo
    if (!(await pinOk(pin, PIN_MEM_H, PIN_MEM))) { alert('PIN incorrecto.'); return; } // v37-sec (V36-1c)
  }
  const _r = await memoryClear();
  history = [];
  try { invUltimoInforme = null; } catch(e){} // v40-1029 (verificador): charla borrada = informe olvidado
  document.getElementById('chat').innerHTML = '';
  /* v40-borrar (16/10, auditor 4 — GRAVE): decía «Memoria borrada. Empezamos de cero.» pero solo se borraba la charla
     (memory.json): los recuerdos seguían viajando al modelo. Ahora dice exactamente qué borró y qué no. */
  const _msgB = (_r === 'ok') ? 'Borré la charla guardada. Ojo: tus recuerdos de largo plazo y tus documentos siguen ahí — si también los querés borrar, hacelo desde «◈ mi memoria».'
    : (_r === 'sinfb') ? 'Borré la charla de esta pantalla. No hay una base Firebase conectada, así que no había nada guardado afuera.'
    : 'Borré la charla de esta pantalla, pero NO pude borrarla de tu Firebase (' + String(_r||'').replace('fallo:','') + '). Probá de nuevo en un rato.';
  addMsg('mirror', _msgB, mode);
}

// --- Envío principal ---
// v1.5: ¿MIRROR está redactando en nombre de su usuario (contestar un mail/WhatsApp/mensaje)?
// Esos borradores son tareas puntuales: NO se guardan en memoria, para que no contaminen
// las respuestas futuras (era lo que hacía repetir respuestas inventadas).
function esRedaccionEnNombre(text){
  const p = normalizeText(text||'');
  return /(contest|respond|redact)\w*\s+(este|el|ese|un|mi)?\s*(correo|email|mail|mensaje|whatsapp|wsp|wpp|texto|carta|nota)/.test(p)
      || /\b(contestame|respondeme|redactame|escribime)\b/.test(p)
      || /(redact|escrib)\w*\s+(la\s+)?(respuesta|contestacion)/.test(p);
}

// ════ v26 — PALANCA E: captura, compresión y envío de imágenes ════
function handleImagen(input){
  const file = input.files && input.files[0];
  input.value = ''; // permite re-elegir la misma foto
  if (!file) return;
  if (!/^image\//.test(file.type)){ addMsg(mode, '⚠ Eso no parece una imagen.', mode); return; }
  const reader = new FileReader();
  reader.onload = (e)=>{
    const img = new Image();
    img.onload = ()=>{
      // v38-vision3 (30/07/2026) — IMAGEN MÁS CHICA PARA EL LÍMITE DE 8000 TPM DEL TIER GRATIS.
      // A 1280px la imagen tokenizaba en ~2500 tokens y una sola petición pedía ~7500 de los
      // 8000 tok/min → al reintentar se apilaban y rebotaba con «rate limit». A 768px baja a
      // ~1000 tokens (la mitad larga): sigue legible para describir/leer, y la petición entra
      // holgada bajo el límite. Para lectura fina de exámenes (v38) se podrá subir con motor de pago.
      const MAX = 768;
      let w = img.width, h = img.height;
      if (w > MAX || h > MAX){ if (w >= h){ h = Math.round(h*MAX/w); w = MAX; } else { w = Math.round(w*MAX/h); h = MAX; } }
      try {
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        imagenAdjunta = c.toDataURL('image/jpeg', 0.82);
      } catch(err){ imagenAdjunta = e.target.result; } // fallback: original
      mostrarPreviewImagen(imagenAdjunta);
    };
    img.onerror = ()=>{ addMsg(mode, '⚠ No pude leer esa imagen. Probá con otra.', mode); };
    img.src = e.target.result;
  };
  reader.onerror = ()=>{ addMsg(mode, '⚠ No pude abrir el archivo.', mode); };
  reader.readAsDataURL(file);
}
function mostrarPreviewImagen(url){
  const p = document.getElementById('imgpreview'); if(!p) return;
  p.innerHTML = '<img src="'+url+'" alt="imagen adjunta"><span>Imagen lista. Escribí qué querés saber (o mandala así) y tu MIRROR la va a ver.</span><button onclick="quitarImagenAdjunta()" title="Quitar la imagen">✕</button>';
  p.style.display = 'flex';
}
function quitarImagenAdjunta(){
  imagenAdjunta = null;
  const p = document.getElementById('imgpreview'); if(p){ p.style.display='none'; p.innerHTML=''; }
}
/* v38-vision2 (30/07/2026) — PROMPT CORTO Y HONESTO PARA LA VISIÓN.
   Chico a propósito: el prompt completo del espejo rompía el límite de 8000 TPM del tier
   gratis de Groq (ver enviarConImagen). Además arregla el «desvaría / no es directa» que
   marcó Darío: le pide describir sin preámbulos ni rodeos. */
const SYSTEM_VISION = 'Sos el módulo de visión de MIRROR. Describí la imagen con precisión, en español (o el idioma en que te escriban). Si hay texto en la imagen, transcribilo tal cual. Sé DIRECTO y concreto: sin preámbulos, sin rodeos, sin cerrar con «¿querés que…?». HONESTIDAD: contá solo lo que REALMENTE se ve; si algo está borroso, cortado o no se distingue, decílo en vez de inventarlo.';

async function enviarConImagen(text){
  const modeloV = modeloVisionActivo();
  if (!modeloV){ quitarImagenAdjunta(); return; } // el botón no debería estar visible sin visión
  const img = imagenAdjunta;
  const prompt = text || 'Mirá esta imagen y describímela con detalle. Si hay texto en ella, transcribilo tal cual.';
  const inp = document.getElementById('inp'); inp.value = ''; inp.style.height = 'auto';
  if (typeof trigPulse === 'function') trigPulse();
  if (window.speechSynthesis) speechSynthesis.cancel();
  if (typeof micStop === 'function') micStop();
  setButtonsBusy(true);
  addMsg('user', text || '', false, img);   // burbuja con la imagen que mandó
  quitarImagenAdjunta();
  // En history guardamos solo texto (la imagen NO, para no inflar la memoria con megas).
  history.push({ role:'user', content: (text || '(envié una imagen para que la veas)') });
  const estilo = mode==='jurado' ? 'jurado' : (mode==='tars' ? 'tars' : mode);
  showTyping(estilo);
  if (imagenReapertura) { try { setTypingNote('📎 vuelvo a mirar la imagen de recién'); } catch(e){} imagenReapertura = false; } // v40-audit
  /* v38-vision2 (30/07/2026) — PROMPT CORTO PARA LA VISIÓN (arregla el «Request too large»).
     Bug que metí yo: pasarle a la visión el prompt COMPLETO del espejo (~5000 tokens) + la
     imagen + 8000 de salida pedía ~13800 tokens y reventaba el límite de 8000 TPM del tier
     gratis de Groq. Describir una imagen NO necesita todo el sistema del espejo (carácter,
     memoria, identidad, honestidad extendida): necesita una instrucción corta y honesta.
     Con este system chico, la petición entra sobrada en 8000 TPM y queda lugar para que el
     modelo pensante razone Y responda. Directo, sin vueltas (pedido de Darío en la auditoría). */
  const systemPrompt = SYSTEM_VISION;
  const messages = [{ role:'user', content:[ {type:'text', text:prompt}, {type:'image_url', image_url:{ url:img }} ] }];
  let reply = null, errorMsg = null;
  try {
    // Llamada DIRECTA al modelo de visión del motor activo (sin fallback a Cerebras, que no ve imágenes).
    // v29: 2500 tokens (no 900). El modelo de visión qwen es «pensante»: con poco margen se
    // queda sin espacio para cerrar el razonamiento y dar la respuesta. Con aire, piensa y responde.
    // v38-vision (30/07/2026): en la auditoría en vivo devolvió «200 sin contenido (tokens agotados
    // en razonamiento)» describiendo un logo — 2500 le quedó JUSTO. qwen/qwen3.6-27b es el modelo de
    // visión VIGENTE de Groq (Llama-4-Scout se deprecó el 17/06/2026 → Groq recomienda este), así que
    // NO se cambia de modelo: se le da 3x de aire para que el razonamiento cierre Y quede lugar para
    // la respuesta. v38-vision2/3: system corto (~100 tok) + imagen a 768px (~1000 tok) = input
    // ~1100. Con 4000 de salida, la petición total es ~5100 — entra holgada bajo el límite de
    // 8000 tok/min y le deja al modelo pensante margen para razonar Y responder. (v38-vision había
    // dejado 8000, que rompía el TPM; luego 5000 quedaba justo al reintentar. 4000 + imagen chica
    // es el punto donde una imagen por minuto entra tranquila en el tier gratis.)
    reply = await llamarMotorVigente(GROQ_URL, GROQ_KEY, modeloV, messages, systemPrompt, 4000, 0.5, 'vision');
  } catch(e){ errorMsg = (e && e.message) ? e.message : 'el motor de visión no respondió'; }
  removeTyping();
  if (reply){
    addMsg(mode, reply, estilo);
    history.push({ role:'assistant', content:reply });
    try { imagenReciente = { url: img, turnos: 0 }; } catch(e){} // v40-audit: la retiene para 3 mensajes
    try { hablar(reply); } catch(e){}
  } else {
    const m = errorMsg ? ('⚠ '+errorMsg) : '⚠ No pude leer la imagen. Reintentá en un momento o probá con una más liviana.';
    addMsg(mode, m, estilo);
  }
  setButtonsBusy(false);
}

// ════ v27 — PALANCA B: GENERACIÓN DE IMÁGENES (Pollinations, clave pk_ del usuario) ════
function abrirPolliKey(){ const i=document.getElementById('polli-key-input'); if(i) i.value=POLLI_KEY||''; const m=document.getElementById('polli-msg'); if(m) m.textContent=''; const g=document.getElementById('polli-ov'); if(g){ g.style.display='block'; g.scrollTop=0; } }
function cerrarPolliKey(){ const g=document.getElementById('polli-ov'); if(g) g.style.display='none'; }
function guardarPolliKey(){
  const i=document.getElementById('polli-key-input'), m=document.getElementById('polli-msg');
  const v=(i && i.value || '').trim();
  if(!v){ if(m) m.textContent='Pegá tu clave pk_ primero.'; return; }
  if(!/^pk_/.test(v)){ if(m){ m.style.color='#e7b3b3'; m.textContent='Ojo: la clave del navegador empieza con pk_. La sk_ no va acá.'; } return; }
  POLLI_KEY=v;
  /* v38-clave (2/08/2026) — NO DECIR «GUARDADA» SI NO SE GUARDÓ. Lo encontró el banco al
     portar el accesorio al MIRROR: el catch se tragaba el error de localStorage (modo privado,
     cuota llena, almacenamiento bloqueado) y la app confirmaba igual. El usuario cerraba el
     navegador convencido de tener la clave puesta y volvía a un botón que no anda. Es la misma
     regla que la capa ACTÚA: «listo ✅» solo si se hizo de verdad. */
  let guardo=true;
  try{ localStorage.setItem('mirror_pollinations_key', v); }catch(e){ guardo=false; }
  if(m){
    m.style.color = guardo ? '#4ade80' : '#e7b3b3';
    m.textContent = guardo ? '✅ Clave guardada. Ya podés crear imágenes con 🎨.'
                           : '⚠ La clave quedó activa para esta sesión, pero el navegador no me dejó guardarla. Al cerrar se pierde.';
  }
  if (guardo) setTimeout(cerrarPolliKey, 900);
}
async function generarImagen(){
  if (busy) return;
  const inp = document.getElementById('inp');
  const prompt = inp.value.trim();
  if (!prompt){ addMsg('mirror','Escribí qué imagen querés crear y tocá 🎨 (ej.: "un monolito negro flotando sobre un mar de nubes, estilo cinematográfico").', mode); return; }
  if (!POLLI_KEY){ abrirPolliKey(); return; } // sin clave: pedimos la pk_ (no fallamos en silencio)
  inp.value=''; inp.style.height='auto';
  if (window.speechSynthesis) speechSynthesis.cancel();
  if (typeof micStop==='function') micStop();
  setButtonsBusy(true);
  addMsg('user','🎨 '+prompt, false);
  showTyping(mode==='tars'?'tars':mode);
  try {
    const url = 'https://gen.pollinations.ai/image/' + encodeURIComponent(prompt) + '?model=flux&nologo=true';
    const res = await fetch(url, { headers: { 'Authorization': 'Bearer ' + POLLI_KEY } });
    if (!res.ok){
      let msg = 'No se pudo crear la imagen (HTTP '+res.status+').';
      if (res.status===401 || res.status===403) msg = 'La clave de Pollinations no es válida o no tiene permiso. Revisá tu pk_.';
      else if (res.status===402) msg = 'Tu cuenta de Pollinations se quedó sin créditos (Pollen). Pollinations es un servicio pago: cargá créditos en tu cuenta para seguir generando.';
      else if (res.status===429) msg = 'Pollinations está saturado o llegaste al límite de tu tier. Probá en un rato.';
      removeTyping(); addMsg('mirror','⚠ '+msg, mode);
      setButtonsBusy(false); return;
    }
    const blob = await res.blob();
    /* v40-imagen (16/10, auditor 2): si el servicio contestaba 200 con una página de error (HTML), se mostraba igual como
       «imagen generada por IA» — una imagen rota con el sello. Solo se muestra si de verdad llegó una imagen. */
    if (!blob || !/^image\//i.test(blob.type || '') || blob.size < 100){
      removeTyping(); addMsg('mirror','⚠ Pollinations contestó, pero no me mandó una imagen (llegó «'+String((blob&&blob.type)||'nada').slice(0,40)+'»). Probá de nuevo en un rato.', mode);
      setButtonsBusy(false); return;
    }
    const objUrl = URL.createObjectURL(blob);
    removeTyping();
    addImagenGenerada(objUrl, prompt);
  } catch(e){
    removeTyping();
    addMsg('mirror','⚠ No pude contactar a Pollinations para crear la imagen ('+(e&&e.message?e.message:'error de red')+').', mode);
  }
  setButtonsBusy(false);
}
function addImagenGenerada(objUrl, prompt){
  const chat = document.getElementById('chat');
  const div = document.createElement('div');
  div.className = 'msg';
  const safe = String(prompt).replace(/[<>&"]/g, c=>({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;' }[c]));
  const fname = 'mirror-' + Date.now() + '.jpg';
  div.innerHTML = '<div class="av mav">◈</div><div class="bubble">'
    + '<img class="gen-img" src="'+objUrl+'" alt="Imagen generada por IA: '+safe+'">'
    /* v38-cumpli (H1): marca VISIBLE de contenido sintético — Art. 50 del EU AI Act, exigible
       desde el 2/08/2026. La marca legible por máquina (metadatos/watermark) tiene plazo
       hasta el 2/12/2026 y NO está hecha: no se finge que sí. */
    + '<span class="gen-marca">🎨 imagen generada por IA — no es una foto de algo real</span>'
    + '<a class="gen-dl" href="'+objUrl+'" download="'+fname+'">⬇ descargar</a>'
    + '</div>';
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
  if (typeof informeLog !== 'undefined') informeLog.push({ role:'mirror', text:'[imagen generada: '+prompt+']', style:'', ts:new Date().toISOString() });
}

// ══════════ v36-encuesta (Etapa 12 Ciclo 2) — MIRROR ENCUESTA: FORMULARIOS SIN GOOGLE ══════════
// Crea encuestas como archivos HTML AUTOCONTENIDOS (estética El Origen): las respuestas viajan
// por REST a una rama NUEVA de TU Firebase (encuestas/<id>/respuestas — POST con id propio:
// jamás se pisan entre sí). La base tesis-villa-regina y la app Netlify NO se tocan (§1.5).
// HONESTIDAD: MIRROR genera el archivo; publicarlo (Pages/Netlify, gratis) lo hacés vos.
// ⚠ La URL de tu Firebase viaja dentro del formulario (inevitable para recibir respuestas):
//   asegurar la base con reglas es la Etapa 8 (pendiente, gate propio — queda dicho).
// Círculo completo: crear → recolectar → botón 📊 manda las respuestas al ANALISTA (Etapa 11).
let encPrefill = null;
function encEsc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function encParsePreguntas(txt){
  return String(txt).split('\n').map(function(l){ return l.trim(); }).filter(function(l){ return l; }).map(function(l){
    const m = l.match(/^(.*?)\(([^()]*\|[^()]*)\)\s*$/);
    if (m) return { t: m[1].trim(), ops: m[2].split('|').map(function(o){ return o.trim(); }).filter(function(o){ return o; }) };
    return { t: l, ops: null };
  });
}
/* v40-xssenc (23/10/2026, auditor 2 — GRAVE): los ids de las encuestas son CLAVES de tu Firebase y entraban crudos en
   onclick="encBajar('…')". Firebase deja guardar claves con comillas y < >: quien tuviera la dirección de tu base (va dentro de
   cada formulario) podía dejar una encuesta trampa que corría código al abrir 📋 encuestas. Y el formulario re-descargado
   tomaba de la base A DÓNDE mandar las respuestas. Ahora: solo ids con letras, números, _ y -; las respuestas van siempre a
   TU base actual. */
const ENC_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
function encIdOk(id){ return ENC_ID_RE.test(String(id == null ? '' : id)); }
function encFormHTML(def){
  if (!encIdOk(def && def.id)) throw new Error('id de encuesta inválido');
  const P = def.preguntas.map(function(q,i){
    const nom = 'q'+i;
    const campo = (q.ops && q.ops.length >= 2)
      ? q.ops.map(function(o){ return '<label class="op"><input type="radio" name="'+nom+'" value="'+encEsc(o)+'"> '+encEsc(o)+'</label>'; }).join('')
      : '<textarea name="'+nom+'" rows="3" placeholder="Tu respuesta…"></textarea>';
    return '<div class="preg"><div class="pt">'+(i+1)+'. '+encEsc(q.t)+'</div>'+campo+'</div>';
  }).join('\n');
  const fb = String((typeof FB_URL !== 'undefined' && FB_URL) || def.fb || '').replace(/["\\<>'`\s]/g,''); // v40-xssenc: a TU base, no a la que diga la definición
  return '<!DOCTYPE html>\n<html lang="'+encTextos().lang+'"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">\n<title>'+encEsc(def.titulo)+'</title>\n<style>\nbody{background:#050508;color:#e8e2d6;font-family:Georgia,serif;max-width:560px;margin:0 auto;padding:28px 18px;line-height:1.7}\nh1{font-size:20px;font-weight:400;letter-spacing:0.04em;border-bottom:1px solid #333;padding-bottom:12px}\n.preg{margin:22px 0}.pt{font-size:14px;margin-bottom:8px}\ntextarea{width:100%;background:rgba(255,255,255,0.04);color:#e8e2d6;border:1px solid #333;border-radius:3px;padding:9px;font:13px Georgia,serif;box-sizing:border-box}\n.op{display:block;font-size:13.5px;margin:5px 0;cursor:pointer}\nbutton{background:transparent;color:#e8e2d6;border:1px solid #e8e2d6;border-radius:3px;padding:10px 26px;font:12px monospace;letter-spacing:0.1em;cursor:pointer;margin-top:14px}\nbutton:hover{background:#e8e2d6;color:#000}\n#gracias,#error{display:none;margin-top:18px;font-size:14px}\n.pie{font-size:10px;opacity:0.45;margin-top:34px;font-family:monospace}\n</style></head><body>\n<h1>'+encEsc(def.titulo)+'</h1>\n<form id="f" onsubmit="return enviar(event)">\n'+P+'\n<button type="submit">'+encEsc(encTextos().enviar)+'</button>\n</form>\n<div id="gracias">'+encEsc(encTextos().gracias)+'</div>\n<div id="error">'+encEsc(encTextos().error)+'</div>\n<div class="pie">'+encEsc(encTextos().pie)+'</div>\n<script>\nasync function enviar(ev){ ev.preventDefault();\n  const f = document.getElementById("f"); const r = {};\n  for (const el of f.elements){ if (!el.name) continue; if (el.type === "radio"){ if (el.checked) r[el.name] = el.value; } else r[el.name] = el.value; }\n  try{\n    const res = await fetch("'+fb+'/encuestas/'+def.id+'/respuestas.json", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ ts: Date.now(), r: r }) });\n    if (!res.ok) throw new Error(res.status);\n    f.style.display = "none"; document.getElementById("gracias").style.display = "block";\n  }catch(e){ document.getElementById("error").style.display = "block"; }\n  return false;\n}\n<\/script></body></html>';
}
function encDescargar(nombre, contenido, mime){
  const a = document.createElement('a');
  a.download = nombre; a.href = 'data:'+(mime||'text/html')+';charset=utf-8,'+encodeURIComponent(contenido);
  document.body.appendChild(a); a.click(); a.remove();
}
async function encCrear(titulo, pregTxt){
  if (!FB_URL){ alert('Para crear encuestas hace falta tu Firebase configurado (ahí llegan las respuestas).'); return false; }
  titulo = String(titulo||'').trim(); const preguntas = encParsePreguntas(pregTxt);
  if (!titulo || !preguntas.length){ alert('Falta el título o las preguntas (una por línea).'); return false; }
  const id = 'e_'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
  const def = { id: id, titulo: titulo, preguntas: preguntas, ts: Date.now(), fb: String(FB_URL).replace(/["\\]/g,'') };
  try{ await fbFetch(FB_URL+'/encuestas/'+id+'/def.json', { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(def) }); }
  catch(e){ try{ regError('encuesta:def', e); }catch(_){ } alert('Firebase no respondió al guardar la definición — probá de nuevo.'); return false; }
  encDescargar('encuesta_'+id+'.html', encFormHTML(def));
  addMsg('mirror','Encuesta creada ✅ — se descargó «encuesta_'+id+'.html». Subilo a tu hosting (Pages/Netlify, gratis) o compartilo directo; las respuestas caen en TU Firebase y las ves en «📋 encuestas». Publicarlo corre por tu cuenta: yo genero, vos decidís dónde vive.');
  encRender();
  return true;
}
async function encListar(){
  if (!FB_URL) return null;
  try{ const res = await fbFetch(FB_URL+'/encuestas.json'); const d = await res.json(); return d && typeof d === 'object' ? d : {}; }
  catch(e){ return {}; }
}
/* v37-dato (V36-2): fecha/hora de una respuesta en ISO 8601 con huso horario.
   Formato no ambiguo y a la vez legible: 2026-07-25T14:32:10-03:00.
   Para el análisis de campo el huso importa: sin él, una respuesta de las 23:30
   podría leerse como del día siguiente. */
function encFechaISO(ts){
  if (ts === null || ts === undefined || ts === '') return '';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '';
  const p = function(n){ return String(n).padStart(2,'0'); };
  const off = -d.getTimezoneOffset();
  const sg = off >= 0 ? '+' : '-';
  return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'T'+
         p(d.getHours())+':'+p(d.getMinutes())+':'+p(d.getSeconds())+
         sg+p(Math.floor(Math.abs(off)/60))+':'+p(Math.abs(off)%60);
}

/* v37-dato (V36-2): el CSV perdía la fecha de cada respuesta. El dato SÍ estaba
   en Firebase (el formulario guarda `ts`), lo descartaba este exportador — o sea
   que en cada exportación se tiraba un dato metodológico.
   `conFecha` es opt-in a propósito: el archivo que baja el usuario la lleva, pero
   lo que va al ANALISTA no, porque una columna de fechas le genera un gráfico de
   "distribución" que es ruido visual (lo mismo que pasa con la columna id). */
/* v37-i18n (V36-5a): el formulario público salía SIEMPRE en español, aunque el
   MIRROR estuviera en inglés o portugués. Quien responde la encuesta no tiene por
   qué leer español: es la cara pública de la app. Los textos siguen el idioma
   elegido en el constructor. */
function encTextos(){
  var idi = 'es';
  try { idi = (CONFIG && CONFIG.idioma) || 'es'; } catch(e){}
  var T = {
    es: { lang:'es', enviar:'enviar respuestas', gracias:'✅ Gracias — tu respuesta quedó guardada.',
          error:'⚠ No se pudo enviar (¿sin conexión?). Probá de nuevo en un rato — lo que escribiste sigue acá.',
          pie:'MIRROR ENCUESTA · las respuestas van a la base de quien creó este formulario · sin cookies, sin rastreo' },
    en: { lang:'en', enviar:'submit answers', gracias:'✅ Thank you — your answer was saved.',
          error:'⚠ Could not send (offline?). Try again in a moment — what you wrote is still here.',
          pie:'MIRROR SURVEY · answers go to the database of whoever created this form · no cookies, no tracking' },
    pt: { lang:'pt', enviar:'enviar respostas', gracias:'✅ Obrigado — sua resposta foi salva.',
          error:'⚠ Não foi possível enviar (sem conexão?). Tente de novo em instantes — o que você escreveu continua aqui.',
          pie:'MIRROR PESQUISA · as respostas vão para a base de quem criou este formulário · sem cookies, sem rastreamento' }
  };
  return T[idi] || T.es;
}

function encCSV(def, respuestas, conFecha){
  const esc = function(v){ v = String(v == null ? '' : v); return /[",\n;]/.test(v) ? '"'+v.replace(/"/g,'""')+'"' : v; };
  const cab = def.preguntas.map(function(q){ return esc(q.t); });
  if (conFecha) cab.unshift('fecha_hora');
  const filas = [cab.join(',')];
  Object.keys(respuestas || {}).sort().forEach(function(k){
    const reg = respuestas[k] || {};
    const r = reg.r || {};
    const fila = def.preguntas.map(function(q,i){ return esc(r['q'+i]); });
    if (conFecha) fila.unshift(esc(encFechaISO(reg.ts)));
    filas.push(fila.join(','));
  });
  return filas.join('\n');
}
async function encRender(){
  const cont = document.getElementById('enc-lista'); if (!cont) return;
  if (!FB_URL){ cont.innerHTML = '<div style="font-size:11px;opacity:0.6;padding:8px;">Sin Firebase configurado no hay dónde recibir respuestas — configuralo y volvé.</div>'; return; }
  cont.innerHTML = '<div style="font-size:11px;opacity:0.6;padding:8px;">Cargando…</div>';
  const encs = await encListar();
  const ids = Object.keys(encs || {});
  if (!ids.length){ cont.innerHTML = '<div style="font-size:11px;opacity:0.6;padding:8px;">Todavía no hay encuestas. Cargá título y preguntas arriba, o pedila por chat: «armame una encuesta sobre…».</div>'; return; }
  cont.innerHTML = ids.map(function(id){
    const e = encs[id] || {}; const def = e.def; if (!def) return '';
    if (!encIdOk(id)) return '<div class="voz-item"><div class="voz-nombre" style="white-space:normal;opacity:.7;">⚠ Hay una encuesta con un nombre raro en tu base («'+encEsc(String(id).slice(0,40))+'»). No la abro desde acá: no la creó esta app. Si no la reconocés, borrala desde la consola de Firebase.</div></div>'; // v40-xssenc
    const n = e.respuestas ? Object.keys(e.respuestas).length : 0;
    return '<div class="voz-item"><div class="voz-nombre" style="white-space:normal;">'+encEsc(def.titulo)+' <em>('+n+' resp.)</em></div>'+
      '<div class="voz-acciones">'+
      '<button onclick="encBajar(\''+id+'\')" title="Descargar el HTML del formulario">⬇</button>'+
      '<button onclick="encVer(\''+id+'\')" title="Ver las respuestas">ver</button>'+
      '<button onclick="encExportCSV(\''+id+'\')" title="Exportar respuestas como CSV">CSV</button>'+
      (typeof anaAnalizar === 'function' ? '<button onclick="encAnalizar(\''+id+'\')" title="Mandar las respuestas al analista">📊</button>' : '')+
      '<button onclick="encBorrar(\''+id+'\')" title="Borrar encuesta y respuestas">✕</button>'+
      '</div></div>';
  }).join('');
}
async function encGet(id){ const encs = await encListar(); return (encs && encs[id]) || null; }
async function encBajar(id){ if (!encIdOk(id)) return; const e = await encGet(id); if (!e || !e.def){ alert('No encontré esa encuesta.'); return; } encDescargar('encuesta_'+id+'.html', encFormHTML(Object.assign({}, e.def, { id: id }))); } // v40-xssenc: el id es la clave validada
async function encVer(id){
  const e = await encGet(id); if (!e || !e.def) return;
  const cont = document.getElementById('enc-lista'); const rs = e.respuestas || {};
  const ks = Object.keys(rs).sort();
  cont.innerHTML = '<div style="font-size:11px;opacity:0.8;padding:4px 8px;">'+encEsc(e.def.titulo)+' — '+ks.length+' respuesta(s) <button class="mbtn mbtn-cancel" style="font-size:10px;padding:2px 8px;margin-left:8px;" onclick="encRender()">◂ volver</button></div>'+
    (ks.length ? ks.map(function(k,ri){
      const r = (rs[k] && rs[k].r) || {}; // v40-1023 (auditor 2): una respuesta null en la base trababa el panel en «Cargando»
      return '<div class="voz-item"><div class="voz-nombre" style="white-space:normal;font-size:10.5px;line-height:1.5;">#'+(ri+1)+' · '+e.def.preguntas.map(function(q,i){ return '<em>'+encEsc(q.t)+':</em> '+encEsc(r['q'+i]||'—'); }).join(' · ')+'</div></div>';
    }).join('') : '<div style="font-size:11px;opacity:0.6;padding:8px;">Sin respuestas todavía.</div>');
}
async function encExportCSV(id){ const e = await encGet(id); if (!e || !e.def) return; encDescargar('respuestas_'+id+'.csv', encCSV(e.def, e.respuestas, true), 'text/csv'); } // v37-dato (V36-2): con fecha_hora
async function encAnalizar(id){ const e = await encGet(id); if (!e || !e.def) return; const n = e.respuestas ? Object.keys(e.respuestas).length : 0; if (!n){ alert('Sin respuestas para analizar todavía.'); return; } encCerrar(); anaAnalizar('encuesta: '+e.def.titulo, encCSV(e.def, e.respuestas)); }
async function encBorrar(id){
  if (!confirm('¿Borrar la encuesta y TODAS sus respuestas? No hay vuelta atrás (exportá el CSV antes si las querés).')) return;
  try{ await fbFetch(FB_URL+'/encuestas/'+id+'.json', { method:'PUT', headers:{'Content-Type':'application/json'}, body:'null' }); }catch(e){ try{ regError('encuesta:borrar', e); }catch(_){ } }
  encRender();
}
function encAbrir(){
  if (typeof CONFIG !== 'undefined' && CONFIG.cap && CONFIG.cap.encuesta === false){ addMsg('mirror','Las encuestas están apagadas en las capacidades del constructor.'); return; }
  if (encPrefill){ const t = document.getElementById('enc-titulo'), p = document.getElementById('enc-preguntas'); if (t) t.value = encPrefill.titulo || ''; if (p) p.value = (encPrefill.preguntas || []).join('\n'); encPrefill = null; }
  document.getElementById('enc-modal').classList.add('visible');
  encRender();
}
function encCerrar(){ document.getElementById('enc-modal').classList.remove('visible'); }
function encCrearClick(){ const t = document.getElementById('enc-titulo').value, p = document.getElementById('enc-preguntas').value; encCrear(t, p).then(function(ok){ if (ok){ document.getElementById('enc-titulo').value=''; document.getElementById('enc-preguntas').value=''; } }); }
function encOferta(a){ // el modelo propuso una encuesta vía [ACCION] — tarjeta que abre el creador PRE-CARGADO (un toque, control humano)
  encPrefill = { titulo: String(a.titulo||'').slice(0,120), preguntas: (a.preguntas||[]).slice(0,15).map(function(q){ return String(q).slice(0,200); }) };
  const chat = document.getElementById('chat'); if (!chat) return;
  const div = document.createElement('div'); div.className = 'msg';
  div.innerHTML = '<div class="av mav" style="opacity:0;"></div><div class="actua-card"><div class="actua-tit">📋 Encuesta propuesta: '+encEsc(encPrefill.titulo)+'</div><div class="actua-det">'+encPrefill.preguntas.length+' pregunta(s) lista(s) — revisalas y creá el formulario con un toque.</div><button class="actua-btn" onclick="encAbrir()">📋 revisar y crear</button></div>';
  chat.appendChild(div); chat.scrollTop = chat.scrollHeight;
}

// ══════════ v36-analista (Etapa 11 Ciclo 2) — MIRROR ANALISTA: DATOS SIN EXCEL ══════════
// Pegás o subís un CSV y la app lo analiza ACÁ, en tu dispositivo:
// · La MATEMÁTICA la calcula JavaScript — el modelo JAMÁS recalcula ni ve filas crudas:
//   recibe SOLO el resumen ya calculado (números exactos) y lo interpreta. Cero alucinación
//   numérica, cero datos personales viajando al proxy.
// · Gráficos con Chart.js (multi-CDN bajo demanda, mismo patrón que docx). Sin CDN → resumen igual.
// 100% ADITIVO: capa nueva; RAG, tesis y prompts intactos.
let anaDataset = null;
function anaEsc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function anaNum(v){ // acepta "1.234,56" (es-AR), "1,234.56" (US), "7,5", "42", "$ 1.200", "15%"
  if (v == null) return null;
  let s = String(v).trim().replace(/[%$\s]/g,'');
  if (!s || !/\d/.test(s) || !/^[-+]?[\d.,]+$/.test(s)) return null;
  const pc = s.lastIndexOf(','), pd = s.lastIndexOf('.');
  if (pc >= 0 && pd >= 0){ s = pc > pd ? s.replace(/\./g,'').replace(',','.') : s.replace(/,/g,''); }
  else if (pc >= 0){
    const comas = s.match(/,/g);
    if (comas.length > 1) s = s.replace(/,/g,'');
    else { const dec = s.slice(pc+1); s = dec.length === 3 ? s.replace(',','') : s.replace(',','.'); }
  }
  const n = parseFloat(s); return isNaN(n) ? null : n;
}
function anaParseCSV(txt){
  txt = String(txt).replace(/^﻿/,'').replace(/\r\n?/g,'\n');
  const linea1 = (txt.split('\n')[0] || '');
  let delim = ',', mejor = -1;
  [',',';','\t','|'].forEach(function(d){ const c = linea1.split(d).length; if (c > mejor){ mejor = c; delim = d; } });
  const filas = []; let fila = [], campo = '', dentro = false;
  for (let i = 0; i < txt.length; i++){
    const ch = txt[i];
    if (dentro){ if (ch === '"'){ if (txt[i+1] === '"'){ campo += '"'; i++; } else dentro = false; } else campo += ch; }
    else if (ch === '"') dentro = true;
    else if (ch === delim){ fila.push(campo); campo = ''; }
    else if (ch === '\n'){ fila.push(campo); campo = ''; if (fila.some(function(c){ return c.trim() !== ''; })) filas.push(fila); fila = []; }
    else campo += ch;
  }
  if (campo !== '' || fila.length){ fila.push(campo); if (fila.some(function(c){ return c.trim() !== ''; })) filas.push(fila); }
  if (filas.length < 2) return { error: 'Necesito al menos una fila de encabezados y una de datos.' };
  if (filas.length > 100001) return { error: 'Más de 100.000 filas es demasiado para el navegador — recortá el archivo y lo vemos por partes. Honestidad ante todo.' };
  const headers = filas[0].map(function(hh,i){ return String(hh).trim() || ('col_'+(i+1)); });
  let irregulares = 0;
  const rows = filas.slice(1).map(function(r){ if (r.length !== headers.length) irregulares++; return headers.map(function(_,i){ return r[i] !== undefined ? String(r[i]).trim() : ''; }); });
  return { headers: headers, rows: rows, delim: delim, irregulares: irregulares };
}
function anaStats(headers, rows){
  const cols = headers.map(function(nombre, ci){
    const crudos = rows.map(function(r){ return r[ci]; });
    const noVacios = crudos.filter(function(v){ return v !== '' && v != null; });
    const nums = noVacios.map(anaNum).filter(function(v){ return v !== null; });
    const col = { nombre: nombre, nulos: rows.length - noVacios.length };
    if (noVacios.length > 0 && nums.length / noVacios.length >= 0.7){
      col.tipo = 'numérica';
      const s = nums.slice().sort(function(a,b){ return a-b; }); const n = s.length;
      const media = s.reduce(function(a,b){ return a+b; }, 0) / n;
      const q = function(p){ const pos=(n-1)*p, lo=Math.floor(pos), hi=Math.ceil(pos); return s[lo]+(s[hi]-s[lo])*(pos-lo); };
      col.n=n; col.min=s[0]; col.max=s[n-1]; col.media=media; col.mediana=q(0.5); col.q1=q(0.25); col.q3=q(0.75);
      col.desvio = n>1 ? Math.sqrt(s.reduce(function(a,b){ return a+(b-media)*(b-media); },0)/(n-1)) : 0;
      col._vals = crudos.map(anaNum);
      /* v38-ana (1/08/2026) — IDENTIFICADORES NUMÉRICOS. Hallazgo de la auditoría de Darío
         sobre sus datos de tesis: la app graficaba la columna «id» (marcas de tiempo de 13
         dígitos) como si fuera una variable, con un eje ilegible, y además la metía en las
         correlaciones. El filtro de identificadores existía… pero solo para las columnas de
         texto. Un id no es un dato: es una etiqueta. No se grafica ni se correlaciona. */
      col.unicos = (function(){ const set={}; nums.forEach(function(v){ set[v]=1; }); return Object.keys(set).length; })();
      col.esId = (col.unicos === n && n >= 4) &&
                 (/^(id|ids|uid|uuid|ts|timestamp|marca[_ ]?temporal|fecha|hora|codigo|c[oó]digo|dni|legajo|nro|n[uú]mero|orden|fila|row)$/i.test(String(nombre).trim())
                  || Math.abs(col.min) >= 1e9); // 1e9 en adelante son epochs o números de serie, no medidas
    } else {
      col.tipo = 'categórica'; const f = {};
      noVacios.forEach(function(v){ f[v]=(f[v]||0)+1; });
      col.n = noVacios.length; col.unicos = Object.keys(f).length;
      col.top = Object.keys(f).map(function(k){ return [k,f[k]]; }).sort(function(a,b){ return b[1]-a[1]; }).slice(0,8);
    }
    return col;
  });
  /* v38-ana: los identificadores quedan afuera de las correlaciones. Correlacionar un «id»
     con cualquier cosa da números que parecen hallazgos y no significan nada. */
  const numCols = cols.filter(function(c){ return c.tipo === 'numérica' && !c.esId; });
  const corrs = []; let corrsDescartadas = 0;
  for (let i=0;i<numCols.length;i++) for (let j=i+1;j<numCols.length;j++){
    const A=numCols[i]._vals, B=numCols[j]._vals, xs=[], ys=[];
    for (let k=0;k<A.length;k++) if (A[k]!==null && B[k]!==null){ xs.push(A[k]); ys.push(B[k]); }
    const n=xs.length;
    /* v38-ana — EL MÍNIMO DE CASOS. Lo que disparó este fix: con 4 casos la app informaba
       «r=1, correlación perfecta» como titular. Con 4 puntos una correlación perfecta es lo
       ESPERABLE por azar, no un hallazgo — y en una tesis eso induce a una conclusión falsa.
       Debajo de 8 casos no se informa: se cuenta cuántas se descartaron y se dice por qué.
       Antes el corte era n<3, que en la práctica no filtraba nada. */
    if (n<8){ if(n>=3) corrsDescartadas++; continue; }
    const mx=xs.reduce(function(a,b){return a+b;},0)/n, my=ys.reduce(function(a,b){return a+b;},0)/n;
    let num=0, dx=0, dy=0;
    for (let k=0;k<n;k++){ num+=(xs[k]-mx)*(ys[k]-my); dx+=(xs[k]-mx)*(xs[k]-mx); dy+=(ys[k]-my)*(ys[k]-my); }
    if (dx>0 && dy>0) corrs.push({ a:numCols[i].nombre, b:numCols[j].nombre, r:num/Math.sqrt(dx*dy), n:n });
  }
  corrs.sort(function(x,y){ return Math.abs(y.r)-Math.abs(x.r); });
  return { cols: cols, corrs: corrs.slice(0,3), corrsDescartadas: corrsDescartadas };
}
function anaRed(x){ return Math.abs(x)>=100 ? Math.round(x*10)/10 : Math.round(x*1000)/1000; }
/* v38-ana (1/08/2026) — EL RESUMEN SE ESCRIBE EN CRIOLLO.
   Auditoría de Darío: «¿vos creés que alguien puede llegar a entender este análisis?».
   Tenía razón: decía «cat, 2 valores, vacios=10», que es jerga de planilla, no una frase.
   El resumen lo lee UNA PERSONA (va tal cual a la tarjeta en pantalla) y además lo lee el
   modelo. Si está en jerga, la persona no entiende y el modelo repite jerga.
   Regla nueva: cada línea tiene que poder leerse en voz alta y entenderse. */
function anaAvisoMuestra(N){
  if (N<=1) return '⚠ TAMAÑO: hay UNA sola fila. No hay nada que promediar ni comparar — esto sirve para ver que el dato llegó bien, nada más. No hables de tendencias ni de porcentajes.';
  if (N<10) return '⚠ TAMAÑO: son solo '+N+' respuestas. Alcanza para mirar qué contestó cada quien, NO para sacar conclusiones ni hablar de tendencias. Decilo si te preguntan por patrones.';
  if (N<30) return '⚠ TAMAÑO: son '+N+' respuestas. Sirve para ver tendencias gruesas, no para concluir: acá un porcentaje se mueve varios puntos con una sola respuesta más.';
  return '';
}
function anaLineaCol(c, N){
  const nom = c.nombre;
  if (c.tipo === 'numérica'){
    if (c.esId) return '• '+nom+' — es un identificador (cada fila tiene el suyo). No se analiza ni se grafica: es una etiqueta, no una medida.';
    const enBlanco = c.nulos ? ' ('+c.nulos+' en blanco)' : '';
    return '• '+nom+' — '+c.n+' valor'+(c.n===1?'':'es')+enBlanco+'. Promedio '+anaRed(c.media)+'; la mitad queda por debajo de '+anaRed(c.mediana)+'; va de '+anaRed(c.min)+' a '+anaRed(c.max)+'. [cuartiles Q1 '+anaRed(c.q1)+' y Q3 '+anaRed(c.q3)+', desvío '+anaRed(c.desvio)+']';
  }
  if (c.unicos >= c.n * 0.9 && c.n >= 3)
    return '• '+nom+' — respuestas abiertas: '+c.n+' respuestas, todas distintas. No se listan (son textuales y podrían identificar a quien contestó).';
  const reps = c.top.filter(function(t){ return t[1] >= 2; }).slice(0,5);
  const contestaron = c.n===0 ? 'nadie contestó' : (c.n+' de '+N+' contestaron'+(c.nulos?(' — '+c.nulos+' en blanco'):''));
  if (!reps.length){
    if (c.n<=1) return '• '+nom+' — '+contestaron+'. Con una sola respuesta no hay nada que resumir todavía.';
    return '• '+nom+' — '+contestaron+', y ninguna respuesta se repite. No se listan (son textuales).';
  }
  return '• '+nom+' — '+contestaron+': '+reps.map(function(t){ return '«'+t[0]+'» '+t[1]; }).join(', ')+'.';
}
function anaResumen(nombre, headers, rows, st, irregulares, specs){
  const N = rows.length;
  const L = ['=== ANÁLISIS DE DATOS 📊 (calculado LOCALMENTE por la app — números EXACTOS: NO los recalcules, NO inventes otros; tu tarea es INTERPRETARLOS y explicarlos en criollo, sin jerga) ==='];
  L.push('Dataset: '+nombre+' — '+N+' fila'+(N===1?'':'s')+' × '+headers.length+' columna'+(headers.length===1?'':'s')+(irregulares?(' ('+irregulares+' filas irregulares normalizadas)'):'')+(N>50000?' (dataset grande: análisis completo, gráficos muestreados)':''));
  const aviso = anaAvisoMuestra(N); if (aviso) L.push(aviso);
  st.cols.forEach(function(c){ L.push(anaLineaCol(c, N)); });
  if (st.corrs.length){
    L.push('Relaciones entre columnas numéricas (correlación de Pearson): '+st.corrs.map(function(c){ return c.a+' ↔ '+c.b+' r='+(Math.round(c.r*100)/100)+' con '+c.n+' casos'; }).join(' · '));
    L.push('⚠ CÓMO LEER ESTO: «r» solo dice si dos números suben y bajan juntos. NO prueba que uno cause el otro, y con pocos casos aparecen coincidencias por puro azar. Nunca lo presentes como una causa.');
  } else if (st.corrsDescartadas){
    L.push('Correlaciones: se calcularon, pero ninguna tenía suficientes casos (mínimo 8), así que NO se informan. Con menos casos que eso, una correlación «perfecta» es lo esperable por azar y engaña más de lo que ayuda.');
  }
  /* v38-ana: qué hay EN PANTALLA. Sin esto, el modelo respondía «no hay gráfico explícito»
     cuando el usuario estaba mirando el gráfico — el hallazgo más desconcertante de la
     auditoría. El modelo no ve la pantalla; hay que contarle qué está viendo la persona. */
  if (specs && specs.length){
    L.push('EN PANTALLA, debajo de este resumen, la persona está viendo '+specs.length+' gráfico'+(specs.length===1?'':'s')+': '+specs.map(function(s,i){ return (i+1)+') '+s.titulo+' — '+(s.tipo==='bar'?'barras: cuántas veces se repite cada respuesta':(s.tipo==='hist'?'distribución: cómo se reparten los valores':'dispersión: un punto por caso, para ver si hay relación')); }).join(' · '));
    L.push('Podés hablar de esos gráficos: los está viendo. Describí lo que muestran usando los números de arriba — y NO menciones ningún gráfico que no esté en esa lista.');
  } else {
    L.push('EN PANTALLA no hay ningún gráfico (no había columnas que valiera la pena graficar). Si preguntan por un gráfico, decilo así, de frente.');
  }
  L.push('(Fin del análisis local. Si piden un cálculo que NO figura acá, decí honestamente que no está calculado — NO lo estimes.)');
  return L.join('\n');
}
function anaSpecs(st){
  const specs = [];
  const numC = st.cols.filter(function(c){ return c.tipo==='numérica' && !c.esId; }); // v38-ana: el «id» no se grafica
  const catC = st.cols.filter(function(c){ return c.tipo==='categórica' && c.unicos>1 && c.unicos<=30; });
  const catOK = catC.filter(function(c){ return c.top.length && c.top[0][1] >= 2 && c.unicos < c.n * 0.9; }); // privacidad: identificadores y valores únicos no se grafican
  if (catOK.length){ const c=catOK[0]; const reps=c.top.filter(function(t){ return t[1]>=2; }); specs.push({ tipo:'bar', titulo:c.nombre+' (frecuencias)', labels:reps.map(function(t){return t[0];}), data:reps.map(function(t){return t[1];}) }); }
  if (numC.length){ const c=numC[0]; const nb=8, w=(c.max-c.min)/nb || 1; const bins=[]; for(let i=0;i<nb;i++) bins.push(0);
    c._vals.forEach(function(v){ if (v!==null){ let b=Math.min(nb-1, Math.floor((v-c.min)/w)); if (b<0) b=0; bins[b]++; } });
    specs.push({ tipo:'hist', titulo:c.nombre+' (distribución)', labels:bins.map(function(_,i){ return anaRed(c.min+i*w)+'–'+anaRed(c.min+(i+1)*w); }), data:bins }); }
  if (st.corrs.length){ const cr=st.corrs[0];
    const A=st.cols.find(function(c){return c.nombre===cr.a;}), B=st.cols.find(function(c){return c.nombre===cr.b;});
    const pts=[]; for (let k=0;k<A._vals.length && pts.length<200;k++) if (A._vals[k]!==null && B._vals[k]!==null) pts.push({x:A._vals[k], y:B._vals[k]});
    specs.push({ tipo:'scatter', titulo:cr.a+' vs '+cr.b+' (r='+(Math.round(cr.r*100)/100)+')', puntos:pts }); }
  return specs;
}
async function anaChartLib(){
  if (window.Chart) return true;
  const CDNS = ['https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js','https://unpkg.com/chart.js@4.4.1/dist/chart.umd.js','https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js'];
  for (const u of CDNS){ try{ await new Promise(function(res,rej){ const s=document.createElement('script'); s.src=u; s.onload=res; s.onerror=rej; document.head.appendChild(s); }); if (window.Chart) return true; }catch(e){} }
  return false;
}
async function anaRender(){
  const ds = anaDataset; if (!ds) return;
  const chat = document.getElementById('chat');
  const div = document.createElement('div'); div.className = 'msg';
  let html = '<div class="av mav" style="opacity:0;"></div><div class="ana-card"><div class="ana-tit">📊 '+anaEsc(ds.nombre)+' — '+ds.nFilas+' filas × '+ds.nCols+' columnas</div>';
  html += '<div class="ana-res">'+anaEsc(ds.resumenHumano)+'</div>';
  ds.specs.forEach(function(s,i){ html += '<div class="ana-chart"><canvas id="ana-c'+ds.uid+'_'+i+'" width="340" height="190"></canvas></div>'; });
  html += '<div class="ana-acciones"><button class="mbtn mbtn-perm" onclick="anaPNG()" aria-label="Descargar el primer gráfico como PNG">⬇ PNG</button><button class="mbtn mbtn-cancel" onclick="anaQuitar()" aria-label="Quitar los datos cargados">✕ quitar datos</button></div></div>';
  div.innerHTML = html; chat.appendChild(div); chat.scrollTop = chat.scrollHeight;
  const hayLib = await anaChartLib();
  if (!hayLib){ const nota=document.createElement('div'); nota.style.cssText='font-size:10px;opacity:0.6;padding:2px 8px;'; nota.textContent='(sin gráficos: los CDN no respondieron — los números del resumen están igual, que es lo que importa)'; div.querySelector('.ana-card').appendChild(nota); return; }
  ds.specs.forEach(function(s,i){
    const cv = document.getElementById('ana-c'+ds.uid+'_'+i); if (!cv) return;
    const base = { responsive:false, plugins:{ legend:{display:false}, title:{display:true, text:s.titulo, color:'#e8e2d6', font:{size:11}} }, scales:{ x:{ticks:{color:'#999',font:{size:9}}}, y:{ticks:{color:'#999',font:{size:9}}} } };
    const cfg = s.tipo==='scatter'
      ? { type:'scatter', data:{ datasets:[{ data:s.puntos, backgroundColor:'rgba(232,226,214,0.7)' }] }, options:base }
      : { type:'bar', data:{ labels:s.labels, datasets:[{ data:s.data, backgroundColor:'rgba(232,226,214,0.55)', borderColor:'#e8e2d6', borderWidth:1 }] }, options:base };
    try{ new Chart(cv.getContext('2d'), cfg); }catch(e){ try{ regError('analista:chart', e); }catch(_){} }
  });
}
function anaAnalizar(nombre, txt){
  try{
    const p = anaParseCSV(txt);
    if (p.error){ addMsg('mirror','📊 '+p.error); return false; }
    const st = anaStats(p.headers, p.rows);
    // v38-ana: los gráficos se arman ANTES del resumen, porque el resumen ahora cuenta qué
    // hay en pantalla. Sin este orden, el modelo no sabe qué está mirando la persona.
    const specs = anaSpecs(st);
    const resumenTxt = anaResumen(nombre, p.headers, p.rows, st, p.irregulares, specs);
    anaDataset = { nombre:nombre, nFilas:p.rows.length, nCols:p.headers.length, resumenTxt:resumenTxt, resumenHumano:resumenTxt.split('\n').slice(1,-1).join('\n'), specs:specs, uid:Date.now().toString(36) };
    anaRender();
    addMsg('mirror','Datos analizados acá, en tu dispositivo 📊 — los números ya están calculados; preguntame y los interpreto. Cuando termines: «✕ quitar datos».');
    return true;
  }catch(e){ try{ regError('analista', e); }catch(_){} addMsg('mirror','📊 Algo se rompió analizando ese archivo — quedó en mi diagnóstico. Probá con otro formato.'); return false; }
}
function anaAbrir(){
  if (typeof CONFIG !== 'undefined' && CONFIG.cap && CONFIG.cap.analista === false){ addMsg('mirror','El análisis de datos está apagado en las capacidades del constructor.'); return; }
  document.getElementById('ana-modal').classList.add('visible');
}
function anaCerrar(){ document.getElementById('ana-modal').classList.remove('visible'); }
function anaArchivo(ev){ const f=ev.target.files[0]; if (!f) return; const r=new FileReader(); r.onload=function(){ if (anaAnalizar(f.name, r.result)) anaCerrar(); }; r.readAsText(f); ev.target.value=''; }
function anaAnalizarClick(){ const t=document.getElementById('ana-texto').value; if (!t.trim()){ alert('Pegá un CSV o elegí un archivo.'); return; } if (anaAnalizar('datos pegados', t)){ document.getElementById('ana-texto').value=''; anaCerrar(); } }
function anaPNG(){ try{ const ds=anaDataset; if (!ds) return; const cv=document.getElementById('ana-c'+ds.uid+'_0'); if (!cv){ alert('No hay gráfico para exportar.'); return; } const a=document.createElement('a'); a.download='mirror_analisis.png'; a.href=cv.toDataURL('image/png'); a.click(); }catch(e){ try{ regError('analista:png', e); }catch(_){} } }
function anaQuitar(){ anaDataset = null; addMsg('mirror','Listo, solté los datos ✅ — no queda nada cargado.'); }

