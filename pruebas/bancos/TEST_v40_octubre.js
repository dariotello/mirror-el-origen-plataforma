/* TEST_v40_octubre.js — amarra la tanda del 2/10/2026 de la PLATAFORMA (builds 2026-10-02.1 y .2).
   H · v40-audit9 — hallazgos de la auditoría EN VIVO de Darío del 2/10 (10:22–10:39), corregidos en la .2
   Filosofía del banco: BUSCAR EL FALLO, no la confirmación. Cada promesa del LEEME tiene acá su prueba,
   y cada arreglo su caso «que NO se pase de rosca».
   Corre con `node TEST_v40_octubre.js` desde la carpeta MIRROR (lee ../PLATAFORMA/index.html).
   A · v40-cupo       — la salida que se MIDE es la que se PIDE (adiós piso fijo de 2500 en gpt-oss)
   B · v40-paciente   — el principal espera ≤20 s / reintenta vacío ANTES de soltar al respaldo
   C · v40-respaldo   — el respaldo contesta más frío, con orden de no rellenar, y se ve con un chip
   D · v40-autoconoc2 — «¿qué sabés hacer?», «¿tenés límites?», «¿dónde guardás lo mío?» llevan la verdad
   E · v40-agendar    — la fecha va al calendario, no al título (y «cuota 12/24» no es una fecha)
   F · v40-novedad    — lo que ya existía (encuestas…) no se vende como novedad
   G · build / novedades / badge */
const fs = require('fs'), path = require('path'), vm = require('vm');
const H = fs.readFileSync(path.join(__dirname, '..', 'PLATAFORMA', 'index.html'), 'utf8');
let ok = 0, bad = 0; const pend = [];
function t(m, c, x){ if (c){ ok++; console.log('  ✅ ' + m); } else { bad++; console.log('  ❌ ' + m + (x !== undefined ? '  → ' + String(x).slice(0, 300) : '')); } }
function fn(n){ const re = new RegExp('(?:async\\s+)?function\\s+' + n + '\\s*\\('); const m = re.exec(H); if (!m) throw new Error('falta ' + n);
  // el cierre es la PRIMERA llave que deja un bloque que compila (robusto ante regex con comillas o llaves)
  for (let k = H.indexOf('}', m.index); k > 0; k = H.indexOf('}', k + 1)){ const cand = H.slice(m.index, k + 1); try { new vm.Script('(' + cand + ')'); return cand; } catch(e){} }
  throw new Error('sin cierre ' + n); }
/* v40-audit11: los datos fijos viven en un bloque (regex + tabla HECHOS + funciones); se extrae ENTERO, const → var */
function bloqueHechos(){ const i = H.indexOf('const HECHO_GUARDO_RE'), j = H.indexOf('function responderHechosFijo'); if (i < 0 || j < i) throw new Error('falta el bloque de HECHOS'); return H.slice(i, j).replace(/^const /gm, 'var '); }
/* v40-audit11: las constantes de la arquitectura (stop words + sus agregados, palabras cortas, pistas) son varias líneas */
function bloqueArq(){ const i = H.indexOf('const _ARQ_CORTAS'), j = H.indexOf('function _arqNorm'); return H.slice(i, j).replace(/^const /gm, 'var '); }
function linea(prefijo){ const i = H.indexOf(prefijo); if (i < 0) throw new Error('falta ' + prefijo); return H.slice(i, H.indexOf('\n', i)).replace(/^(const|let) /, 'var '); }

/* ═════════ A · v40-cupo ═════════ */
console.log('\n━━━ A · la salida que se mide = la que se pide ━━━');
const A = vm.createContext({ Math, Number, String });
vm.runInContext([linea('const CUPO_TPM_GRATIS'), linea('const CUPO_MARGEN'), fn('estimarTokens'), linea('const RAZONADOR_MARGEN'), linea('const RAZONADOR_PISO'), fn('esModeloRazonador'), fn('salidaEfectiva'), fn('cortarLimpio'), fn('ajustarAlCupo')].join('\n'), A);
const se = (m, n) => vm.runInContext('salidaEfectiva(' + JSON.stringify(m) + ',' + n + ')', A);
t('gpt-oss · espejo 700 → 1500 (antes 2500)', se('openai/gpt-oss-120b', 700) === 1500, se('openai/gpt-oss-120b', 700));
t('gpt-oss · analista con base 1500 → 2300', se('openai/gpt-oss-120b', 1500) === 2300);
t('gpt-oss · informe 3000 → 3800 (no se le recorta a un análisis largo)', se('openai/gpt-oss-120b', 3000) === 3800);
t('gpt-oss · expansión de búsqueda 60 → 460 (antes pedía 2500 para 60 palabras)', se('openai/gpt-oss-120b', 60) === 460);
t('modelo NO razonador (qwen) · se pide exactamente lo medido', se('qwen/qwen3.8-27b', 700) === 700 && se('llama-3.3-70b', 1100) === 1100);
// el caso que rebotaba: system + charla + contexto que «entraba» midiendo 700 y no entraba con 2500
{
  const sys = 'x'.repeat(Math.round(3000 * 3.4));               // ~3000 tokens de system
  const prev = [{ role: 'user', content: 'y'.repeat(Math.round(1500 * 3.4)) }, { role: 'assistant', content: 'z'.repeat(Math.round(1500 * 3.4)) }];
  const ctx = 'w'.repeat(Math.round(1200 * 3.4)) + '\n---\nPREGUNTA: ¿qué opinás?';
  A._sys = sys; A._prev = prev; A._ctx = ctx;
  const medido = (sal) => vm.runInContext('(function(){ var r = ajustarAlCupo(_ctx, _sys, _prev, ' + sal + '); return estimarTokens(_sys) + ' + sal + ' + r.mensajes.reduce(function(a,m){ return a + estimarTokens(m.content); }, 0); })()', A);
  const viejo = medido(700) - 700 + 2500;   // lo que de verdad viajaba antes: medido con 700, pedido con 2500
  const nuevo = medido(se('openai/gpt-oss-120b', 700));
  t('ANTES el pedido real se pasaba del cupo (prueba de que el bug existía)', viejo > 8000, viejo);
  t('AHORA el pedido real entra en el cupo de 8000', nuevo <= 8000, nuevo);
}
t('llamarMotor pide a gpt-oss la MISMA cuenta (salidaEfectiva), sin piso fijo', /body\.max_completion_tokens = esRazonador \? salidaEfectiva\(modelo, maxTokens\) : Math\.max\(maxTokens, 2500\);/.test(H));
t('no queda el piso fijo viejo «Math.max(maxTokens, 2500)» suelto para gpt-oss', !/^\s*body\.max_completion_tokens = Math\.max\(maxTokens, 2500\);/m.test(H));
t('send() mide con salidaEfectiva(MODELO_GROQ, _maxSalida)', /ajustarAlCupo\(contextoActual, systemPrompt, previos, salidaEfectiva\(MODELO_GROQ, _maxSalida\)/.test(H));
// llamarMotor de verdad, con fetch falso: ¿qué body sale?
{
  const bodies = [];
  const L = vm.createContext({ console, JSON, String, Number, Math, Error, Promise, RegExp, mode: 'mirror', STREAM_OK: false, setTimeout, clearTimeout, AbortController,
    fetch: async (u, o) => { bodies.push(JSON.parse(o.body)); return { ok: true, status: 200, headers: { get: () => null }, text: async () => JSON.stringify({ choices: [{ message: { content: 'hola' } }] }) }; } });
  vm.runInContext([linea('const RAZONADOR_MARGEN'), linea('const RAZONADOR_PISO'), fn('esModeloRazonador'), fn('salidaEfectiva'), fn('sinPensamiento'), fn('normalizarUnicode'), fn('esperaQuePidioElMotor'), linea('const TOPE_MOTOR_MS'), fn('errTopeMotor'), fn('fetchTextoConTope'), fn('llamarMotor')] /* v40-1023: llamarMotor ahora pide con tope de tiempo */.join('\n'), L);
  const p = vm.runInContext('Promise.all([llamarMotor("/groq","k","openai/gpt-oss-120b",[],"s",700,0.7), llamarMotor("/groq","k","qwen/qwen3.8-27b",[],"s",700,0.7), llamarMotor("/cerebras","k","llama3.1-8b",[],"s",700,0.7)])', L);
  pend.push(p.then(r => {
    t('llamarMotor(gpt-oss, 700) manda max_completion_tokens 1500 y esfuerzo low', bodies[0].max_completion_tokens === 1500 && bodies[0].reasoning_effort === 'low', JSON.stringify(bodies[0]));
    t('llamarMotor(qwen, 700) sigue con max_tokens 700 (no cambió)', bodies[1].max_tokens === 700 && !bodies[1].max_completion_tokens);
    t('Cerebras con modelo NO razonador conserva su piso de 2500 (camino que no se tocó)', bodies[2].max_completion_tokens === 2500);
    t('las tres contestaron', r.join('|') === 'hola|hola|hola');
  }).catch(e => t('llamarMotor corrió sin romper', false, e.message)));
}

/* ═════════ B · v40-paciente ═════════ */
console.log('\n━━━ B · primero el principal, después el respaldo ━━━');
function mkMotor(guion){
  const pedidos = [], notas = [];
  const ctx = vm.createContext({ console, Promise, Error, JSON, String, Number, Math, RegExp, Date,
    CLOUDFLARE_ON: true, CLOUDFLARE_URL: '/cf', MODELO_CLOUDFLARE: '@cf/llama', CEREBRAS_KEY: '', CEREBRAS_URL: '/cb', MODELO_CEREBRAS: 'cb',
    GROQ_URL: '/gq', GROQ_KEY: '', MODELO_GROQ: guion.modelo || 'openai/gpt-oss-120b',
    motorActivo: 'groq', respaldoAvisado: false, diagRespaldos: [],
    setTypingNote: (s) => notas.push(s), addMsg: () => {}, regError: () => {},
    setTimeout: (f) => f(),   // las esperas, instantáneas
    llamarMotorVigente: async (url, key, modelo, msgs, sys, maxT, temp, slot) => {
      pedidos.push({ url, sys, maxT, temp, slot });
      const paso = guion.pasos.shift();
      if (!paso) throw Object.assign(new Error('sin guion'), { tipo: 'otro' });
      if (paso.url && paso.url !== url) throw Object.assign(new Error('esperaba ' + paso.url + ' y llegó ' + url), { tipo: 'otro' });
      if (paso.err) throw Object.assign(new Error(paso.err.msg || 'x'), paso.err);
      return paso.ok;
    } });
  vm.runInContext([linea('const RAZONADOR_MARGEN'), linea('const RAZONADOR_PISO'), fn('esModeloRazonador'), linea('const PRINCIPAL_ESPERA_MAX'), linea('const PRINCIPAL_ESPERA_CADA_MS'), linea('let _principalUltimaEspera'), fn('pedidoMasGrandeQueCupo'), fn('principalConvieneEsperar'), fn('llamarPrincipalPaciente'),
    linea('const RESPALDO_TEMP_MAX'), linea('const RESPALDO_HONESTO'), fn('respaldoSystem'), fn('respaldoTemp'), fn('respaldoChip'), fn('avisarRespaldoUnaVez'), fn('callGroq')].join('\n'), ctx);
  return { ctx, pedidos, notas, run: () => vm.runInContext('callGroq([], "SYS", 700, 0.7)', ctx) };
}
{
  const m = mkMotor({ pasos: [{ url: '/gq', err: { tipo: 'rate_limit', esperaSug: 6, msg: 'Rate limit reached… try again in 5.2s' } }, { url: '/gq', ok: 'PRINCIPAL' }] });
  pend.push(m.run().then(r => {
    t('Groq pide 6 s → se espera y contesta el PRINCIPAL', r === 'PRINCIPAL');
    t('…y el respaldo ni se toca', m.pedidos.every(p => p.url === '/gq'));
    t('…con la cuenta a la vista (atribuida al motor, no a nosotros)', m.notas.some(n => /el motor principal pidió 6 s/.test(n || '')));
    t('…y motorActivo queda en groq (sin chip de respaldo)', vm.runInContext('motorActivo', m.ctx) === 'groq' && vm.runInContext('respaldoChip()', m.ctx) === '');
  }));
}
{
  const m = mkMotor({ pasos: [{ url: '/gq', err: { tipo: 'rate_limit', esperaSug: 45 } }, { url: '/cf', ok: 'RESPALDO' }] });
  pend.push(m.run().then(r => {
    t('Groq pide 45 s (más que el tope de 20) → NO se espera: contesta el respaldo', r === 'RESPALDO' && m.pedidos.length === 2);
    t('…sin cuenta regresiva inútil', !m.notas.some(n => /pidió/.test(n || '')));
  }));
}
{
  const m = mkMotor({ pasos: [{ url: '/gq', err: { tipo: 'rate_limit', esperaSug: 3, msg: 'Request too large on tokens per minute (TPM): Limit 8000, Used 0, Requested 9500' } }, { url: '/cf', ok: 'RESPALDO' }] });
  pend.push(m.run().then(r => t('pedido MÁS GRANDE que el cupo («Requested 9500 > Limit 8000») → esperar no sirve, va directo al respaldo', r === 'RESPALDO' && m.pedidos.length === 2)));
}
{
  const m = mkMotor({ pasos: [{ url: '/gq', err: { tipo: 'vacio' } }, { url: '/gq', ok: 'PRINCIPAL' }] });
  pend.push(m.run().then(r => t('gpt-oss vuelve vacío → UNA vuelta más en el principal con +1200 de margen', r === 'PRINCIPAL' && m.pedidos[1].maxT === 1900, JSON.stringify(m.pedidos))));
}
{
  const m = mkMotor({ modelo: 'qwen/qwen3.8-27b', pasos: [{ url: '/gq', err: { tipo: 'vacio' } }, { url: '/cf', ok: 'RESPALDO' }] });
  pend.push(m.run().then(r => t('vacío con un modelo NO razonador → no se insiste: respaldo', r === 'RESPALDO')));
}
{
  const m = mkMotor({ pasos: [{ url: '/gq', err: { tipo: 'rate_limit', esperaSug: 4 } }, { url: '/gq', err: { tipo: 'rate_limit', esperaSug: 4 } }, { url: '/cf', ok: 'RESPALDO' }] });
  pend.push(m.run().then(r => t('UNA sola espera: si el principal sigue lleno, respaldo (no se cuelga esperando)', r === 'RESPALDO' && m.pedidos.length === 3)));
}
{
  const m = mkMotor({ pasos: [{ url: '/gq', err: { tipo: 'too_big' } }] });
  pend.push(m.run().then(() => t('too_big se sigue propagando (lo arregla el recorte, no otro motor)', false), e => t('too_big se sigue propagando (lo arregla el recorte, no otro motor)', e.tipo === 'too_big')));
}

{ // v40-audit9: una sola espera paciente por minuto (no se apila contra el watchdog de 120 s)
  const m = mkMotor({ pasos: [{ url: '/gq', err: { tipo: 'rate_limit', esperaSug: 5 } }, { url: '/gq', ok: 'P1' }] });
  pend.push(m.run().then(r1 => {
    t('1ª vez en el minuto: espera y contesta el principal', r1 === 'P1');
    t('el tope por minuto existe (60 s) y se anota la espera', vm.runInContext('PRINCIPAL_ESPERA_CADA_MS', m.ctx) === 60000 && vm.runInContext('_principalUltimaEspera', m.ctx) > 0);
    const s2 = vm.runInContext('principalConvieneEsperar({ tipo: "rate_limit", esperaSug: 5 })', m.ctx);
    t('2ª vez dentro del mismo minuto: NO espera (se va al respaldo, no se apila contra el watchdog)', s2 === 0);
  }));
}

/* ═════════ C · v40-respaldo ═════════ */
console.log('\n━━━ C · el respaldo, más honesto ━━━');
{
  const m = mkMotor({ pasos: [{ url: '/gq', err: { tipo: 'rate_limit' } }, { url: '/cf', ok: 'RESPALDO' }] });
  pend.push(m.run().then(r => {
    const pr = m.pedidos[0], rs = m.pedidos[1];
    t('el PRINCIPAL recibe el system intacto y su temperatura (0,7)', pr.sys === 'SYS' && pr.temp === 0.7);
    t('el RESPALDO recibe el system + la orden de no rellenar huecos', rs.sys.indexOf('SYS') === 0 && /MODO RESPALDO/.test(rs.sys) && /no lo sé con certeza/.test(rs.sys));
    t('el RESPALDO contesta más frío (0,7 → 0,35)', rs.temp === 0.35, rs.temp);
    t('el chip dice quién contestó: «↺ respaldo (Cloudflare)»', vm.runInContext('respaldoChip()', m.ctx) === '↺ respaldo (Cloudflare)');
  }));
  const T = vm.createContext({ Number, isFinite, Math }); vm.runInContext([linea('const RESPALDO_TEMP_MAX'), fn('respaldoTemp')].join('\n'), T);
  t('una temperatura ya baja (0,3 de TARS) no se toca', vm.runInContext('respaldoTemp(0.3)', T) === 0.3);
  t('temperatura rara (undefined) → 0,35, no NaN', vm.runInContext('respaldoTemp(undefined)', T) === 0.35);
}
{ const iChip = H.indexOf("const _rc = (!errorMsg) ? respaldoChip() : ''; if (_rc) ultimaProcedencia.push(_rc);"), iPinta = H.indexOf("try{ addMsg('mirror', reply, msgStyle); }", iChip);
  t('el chip se suma ANTES de pintar la respuesta (mismo turno) y solo sin error', iChip > 0 && iPinta > iChip && iPinta - iChip < 900); }

/* ═════════ D · v40-autoconoc2 ═════════ */
console.log('\n━━━ D · autoconocimiento sin huecos ━━━');
const D = vm.createContext({ String, RegExp });
vm.runInContext([linea('const PREGUNTA_POR_APP'), linea('const PREGUNTA_A_LA_ENTIDAD'), fn('esPreguntaPorApp')].join('\n'), D);
const esApp = q => vm.runInContext('esPreguntaPorApp(' + JSON.stringify(q) + ')', D);
['¿qué sabés hacer?', 'che, ¿qué más sabés hacer?', '¿en qué me podés ayudar?', '¿para qué servís?', '¿qué cosas hacés?', '¿qué no podés hacer?',
 '¿tenés límites?', '¿cuáles son tus límites?', '¿hasta dónde llegás?', '¿dónde guardás lo mío?', '¿dónde quedan mis datos?', '¿dónde se guarda la charla?',
 '¿quién ve lo que te cuento?', '¿es privado lo que te cuento?', '¿mis datos están a salvo?', '¿sos gratis?', '¿cuánto me costás?', '¿quién te hizo?', '¿quién te creó?']
  .forEach(q => t('dispara: «' + q + '»', esApp(q) === true));
['¿sabés hacer asado?', '¿dónde guardaste las llaves?', 'qué lindo día', 'contame un chiste', '¿qué tengo pendiente?', 'mandale un WhatsApp a Juan',
 '¿quién hizo la Gioconda?', 'mi hermano tiene límites con la comida', 'es gratis el museo?']
  .forEach(q => t('NO dispara: «' + q + '»', esApp(q) === false));
t('no-regresión: «¿cómo funciona la app?» sigue disparando', esApp('¿cómo funciona la app?'));
// la arquitectura trae el renglón correcto
{
  const ctx = vm.createContext({ String, CONFIG: { modeloPrincipal: 'openai/gpt-oss-120b', motorPrincipal: 'Groq', motorRespaldo: 'Cloudflare', modos: { mirror: 'ATIS', tars: 'BASE' }, appName: 'ATIS' }, PLATFORM_VERSION: 'v40', regError: () => {}, Set, Math });
  const ia = H.indexOf('const ARQUITECTURA_MIRROR'), fa = H.indexOf('`;', ia) + 2;
  vm.runInContext(H.slice(ia, fa).replace(/^const /, 'var ') + '\n' + linea('const ARQ_DETALLE_K') + '\n' + linea('const ARQ_DETALLE_MAX_CHARS') + '\n' + bloqueArq() + '\n' + ['_arqNorm', '_arqPartir', '_arqTitulo', '_arqNombresModos', 'arquitecturaRelevante'].map(fn).join('\n'), ctx);
  const arq = q => vm.runInContext('arquitecturaRelevante(' + JSON.stringify(q) + ')', ctx);
  const detalle = q => { const s = arq(q); return s.slice(s.indexOf('DETALLE DE LO RELEVANTE')); };
  ['¿dónde guardás lo mío?', '¿tenés límites?', '¿quién ve lo que te cuento?', '¿sos gratis?', '¿qué no podés hacer?'].forEach(q =>
    t('«' + q + '» trae el DETALLE de «DÓNDE GUARDO LO TUYO»', /DÓNDE GUARDO LO TUYO/.test(detalle(q))));
  const A0 = vm.runInContext('ARQUITECTURA_MIRROR', ctx);
  t('el renglón dice la verdad: lo tuyo vive en TU Firebase (no «en el dispositivo»)', /se guardan en TU base Firebase/.test(A0));
  t('…y que sin esa base la charla NO queda guardada', /sin esa base configurada, la charla NO queda guardada/.test(A0));
  t('…que contactos y tareas quedan en ESTE dispositivo', /contactos, las tareas y la configuración quedan en el navegador de ESTE dispositivo/.test(A0));
  t('…que lo que SALE es la consulta al motor de IA (no «nada sale»)', /viaja por tu proxy al motor de IA/.test(A0));
  t('…y que lo que hace el proveedor no se afirma ni se niega', /no lo afirmes ni lo niegues/.test(A0));
  t('…límites reales: no envía solo, no lee la bandeja, no hace trámites, cupo por minuto, se puede equivocar',
    /no envío ni llamo solo/.test(A0) && /no leo tu bandeja/.test(A0) && /no hago trámites/.test(A0) && /cupo por minuto/.test(A0) && /me puedo equivocar/.test(A0));
  t('el índice nombra el renglón nuevo (nunca «no sabe» que existe)', /🔒 DÓNDE GUARDO LO TUYO/.test(arq('¿qué lindo día?')));
  const dRep = detalle('PERO ESO NO LO TENÉS INCORPORADO? Me encantaría una mejor integración de voz y búsqueda por significado.');
  t('repregunta en vivo + respuesta anterior → el detalle trae CHARLA POR VOZ y MEMORIA QUE ENTIENDE (en vivo dijo «no lo tengo»)', /CHARLA POR VOZ/.test(dRep) && /MEMORIA QUE ENTIENDE/.test(dRep));
}
t('send() inyecta la arquitectura con el disparador nuevo', /if \(esPreguntaPorApp\(_textoModelo\) \|\| \(_appTurnos > 0 && !_hechos\.length && _esRepregunta && !_bloqueVer\)\) \{/.test(H) && /_partesFin \+= arquitecturaRelevante\(_arqQ\)/.test(H));
t('la nota de memoria ya NO dice «se guarda en el dispositivo» (era falso)', !/memoria persistente de esta conversación — se guarda en el dispositivo del usuario/.test(H));
t('la nota de memoria con base: «Firebase PROPIA del usuario»', /SÍ tenés memoria persistente de esta conversación — se guarda en la base Firebase PROPIA del usuario/.test(H));
t('la nota de memoria SIN base lo dice de frente', /const _sinBaseMem = \(typeof FB_URL !== 'undefined'\) && !FB_URL;/.test(H) && /la base de memoria \(Firebase\) NO está configurada/.test(H));

/* ═════════ E · v40-agendar ═════════ */
console.log('\n━━━ E · la fecha al calendario, no al título ━━━');
{
  const ctx = vm.createContext({ String, Date, RegExp, Math, isNaN });
  vm.runInContext([fn('_tareaISO'), fn('_tareaFecha'), linea('const _TF_MES'), linea('const _TF_DIA'), linea('const _TF_PRE'), fn('tituloSinFecha')].join('\n'), ctx);
  const tf = (x) => vm.runInContext('tituloSinFecha(' + JSON.stringify(x) + ', _tareaFecha(' + JSON.stringify(x) + '))', ctx);
  const f = (x) => vm.runInContext('_tareaFecha(' + JSON.stringify(x) + ')', ctx);
  [['pagar la luz el 30 de septiembre', 'pagar la luz'], ['Reunión de padres para el jueves', 'Reunión de padres'],
   ['UNA REUNIÓN PARA EL VIERNES QUE VIENE. GRACIAS', 'Una reunión'], ['llamar a mamá hoy', 'llamar a mamá'],
   ['dentista el próximo martes', 'dentista'], ['cumple de Ana el 3 de octubre de 2026', 'cumple de Ana'],
   ['pagar el gas el 15/10 por favor', 'pagar el gas'], ['turno médico mañana a la mañana', 'turno médico a la mañana']]
    .forEach(([x, esp]) => t('«' + x + '» → «' + esp + '»', tf(x) === esp, tf(x)));
  t('sin fecha entendida, el título queda ENTERO («comprar pan»)', tf('comprar pan') === 'comprar pan');
  t('«reunión de los jueves» (recurrente) NO pierde «los jueves»', tf('reunión de los jueves') === 'reunión de los jueves');
  t('«a la mañana» no es una fecha: queda', /a la mañana/.test(tf('turno médico mañana a la mañana')));
  t('si lo único que hay es la fecha («mañana»), no deja un título vacío', tf('mañana') === 'mañana');
  t('«vence el 08/07/2021 la factura» conserva «vence»', tf('vence el 08/07/2021 la factura de Endesa') === 'vence la factura de Endesa', tf('vence el 08/07/2021 la factura de Endesa'));
  t('«pagar la cuota 12/24» NO es una fecha (antes rodaba al 12/12 de otro año)', f('pagar la cuota 12/24') === '' && tf('pagar la cuota 12/24') === 'pagar la cuota 12/24');
  t('no-regresión: 17/09/2026 sigue siendo 2026-09-17', f('agenda algo el 17/09/2026') === '2026-09-17');
  t('fecha imposible 31/02 → nada (no se inventa)', f('el 31/02') === '');
  vm.runInContext(fn('_tareaFechaLinda') + '\n' + fn('_tareaFechaTarjeta'), ctx);
  const y = new Date().getFullYear();
  t('la tarjeta muestra el AÑO si la fecha cae en otro año (30/09 ya pasado → del año que viene)', vm.runInContext('_tareaFechaTarjeta("' + (y + 1) + '-09-30")', ctx) === '30/09/' + (y + 1));
  t('…y no lo agrega si es este año', vm.runInContext('_tareaFechaTarjeta("' + y + '-12-15")', ctx) === '15/12');
}
t('los tres caminos usan tituloSinFecha (manos propias, tarjeta del modelo, agente)',
  /const t=tituloSinFecha\(m\[1\]/.test(H) && /const _t=tituloSinFecha\(String\(a\.titulo\)/.test(H) && /const titulo = (?:cortarLimpio\()?tituloSinFecha\(_tituloCrudo, fecha\)/.test(H) /* v40-10292 */);
t('la tarjeta del modelo SOLO anota la tarea si el usuario pidió agendar (antes la guardaba igual)',
  /en\\s\+\(\?:la\\s\+\)\?agenda\)\\b\/i\.test\(_ped\)\)\n      \{ const _f=/.test(H));
t('al agente se le pide el título SIN la fecha', /titulo:\{ type:'string', description:'Qué hay que hacer, SIN la fecha/.test(H));

/* ═════════ F · v40-novedad ═════════ */
console.log('\n━━━ F · lo de antes no se vende como nuevo ━━━');
{
  const nov = JSON.parse(/const APP_NOVEDADES = (\[[^\n]*\]);/.exec(H)[1]);
  const ctx = vm.createContext({ String, RegExp, Array, APP_NOVEDADES: nov, regError: () => {} });
  const i0 = H.indexOf('const NOVEDAD_AJENA'), i1 = H.indexOf('function corregirNovedadAjena');
  vm.runInContext(H.slice(i0, i1).replace(/\bconst /g, 'var ') + fn('corregirNovedadAjena'), ctx);
  const c = (r, p) => vm.runInContext('corregirNovedadAjena(' + JSON.stringify(r) + ',' + JSON.stringify(p || '¿qué tiene de bueno la v40?') + ')', ctx);
  const lista = 'La v40 trae varias cosas:\n• Actúa en varios pasos: avisa, anota y prepara tarjetas.\n• Memoria que entiende por significado, en tu dispositivo.\n• Crear encuestas desde el chat.\n• Charla por voz y modo fácil.';
  const r1 = c(lista);
  t('lista: se saca el renglón «Crear encuestas»', !/encuestas desde el chat/.test(r1), r1);
  t('lista: lo real queda intacto', /Actúa en varios pasos/.test(r1) && /Memoria que entiende/.test(r1) && /Charla por voz/.test(r1));
  t('lista: avisa al pie que corrigió (honestidad radical)', /✎ Nota de la app: saqué las encuestas de lo nuevo: eso ya estaba de antes/.test(r1), r1);
  const r2 = c('Lo nuevo es que actúa en varios pasos y que te entiende por significado, todo en tu dispositivo. Ahora también podés crear encuestas desde el chat. Y se actualiza sola cuando hay versión nueva.');
  t('párrafo: se saca SOLO la oración que vende las encuestas como nuevas', !/encuestas/.test(r2.split('✎')[0]) && /actúa en varios pasos/.test(r2) && /se actualiza sola/.test(r2), r2);
  const r3 = c('Además sumamos una barra de acciones rápidas para todo.\n\nLo nuevo de verdad: actúa en varios pasos, entiende por significado y te acompaña por voz, con modo fácil.');
  t('lo inventado («barra de acciones rápidas») se saca y se dice «que la app no tiene»', !/barra de acciones/.test(r3.split('✎')[0]) && /que la app no tiene/.test(r3), r3);
  const r4 = 'Sí: las encuestas siguen estando, igual que antes, en el botón 📋. Lo nuevo de la v40 es que actúa en varios pasos y entiende por significado.';
  t('si el usuario PREGUNTÓ por las encuestas, no se toca', c(r4, '¿la v40 tiene encuestas?') === r4);
  const r5 = 'La v40 actúa en varios pasos, entiende por significado, te acompaña por voz y se actualiza sola.';
  t('respuesta sin nada ajeno → idéntica (sin nota)', c(r5) === r5);
  const r6 = '• Crear encuestas nuevas.';
  t('nunca deja la respuesta hueca: si sacar dejaría casi nada, no toca', c(r6) === r6);
  const r7 = 'Con la v40 seguís teniendo los informes de siempre, y lo nuevo es que actúa en varios pasos y entiende por significado.';
  t('mencionar algo de antes COMO de antes (sin venderlo como nuevo, en párrafo) no se toca', c(r7) === r7, c(r7));
  const r8 = 'Te cuento lo que trae. Seguís teniendo los informes de siempre, y lo nuevo es que actúa en varios pasos. Además entiende por significado y te acompaña por voz, con modo fácil para usarla sin teclado.';
  t('…ni dentro de una respuesta larga («seguís teniendo los informes de siempre»)', c(r8) === r8, c(r8));
  const r9 = '• Actúa en varios pasos.\n• Las encuestas siguen estando, igual que antes.\n• Entiende por significado y te acompaña por voz.';
  t('…ni en una lista que aclara que es de antes', c(r9) === r9, c(r9));
  t('APP_NOVEDADES no nombra encuestas/informes (si los nombrara, el filtro se apagaría solo)', !/encuesta|informe/i.test(nov.join(' ')));
}
t('se aplica SOLO en preguntas de versión y sin error', /try\{ if \(!errorMsg && (?:_preguntaVersion|_versionDirecta)\) reply = corregirNovedadAjena\(reply, text\); \}/.test(H) /* v40-1029 */);

/* ═════════ G · build ═════════ */
console.log('\n━━━ G · build, novedades y badge ━━━');
// v40-1016 (16/10/2026): la build sube a 2026-10-16.1 (03.4 + tanda de los auditores). Lo de la 03.4 lo sigue amarrando el resto del banco.
t('APP_BUILD = 2026-10-29.n o posterior (sobre la 23.2) — v40-1029', /const APP_BUILD = '2026-(?:10-29|1[12]-\d\d)\.\d+';/.test(H));
t('v40-saludo: aplicarNombresUI pone «<modo> activo» y cambia «Soy MIRROR» por el nombre de la entidad', /set\('hstatus', \(M\.mirror \|\| 'MIRROR'\) \+ ' activo'\)/.test(H) && /'Hola\. Soy ' \+ _app \+ '\.'/.test(H));
{
  const nov = JSON.parse(/const APP_NOVEDADES = (\[[^\n]*\]);/.exec(H)[1]);
  t('1ª novedad sigue siendo «Generación v40»', /^✦ Generación v40/.test(nov[0]));
  const pul = nov.find(n => /^🔧 Pulido de octubre/.test(n)) || '';
  t('sigue la novedad del pulido de octubre, en criollo', /↺ respaldo/.test(pul) && /dónde guardás lo mío/.test(pul));
}
t('badge QUIETO en v40 (sube solo con orden de Darío)', /PLATFORM_VERSION = 'v40'/.test(H));

/* ═════════ H · v40-audit9 (en vivo, 2/10) ═════════ */
console.log('\n━━━ H · lo que encontró la auditoría en vivo del 2/10 ━━━');
{
  const D2 = vm.createContext({ String, RegExp });
  vm.runInContext([linea('const PREGUNTA_POR_APP'), linea('const PREGUNTA_A_LA_ENTIDAD'), fn('esPreguntaPorApp')].join('\n'), D2);
  const esApp2 = q => vm.runInContext('esPreguntaPorApp(' + JSON.stringify(q) + ')', D2);
  ['como estas manifiestos? que versión sos? por que sos mejor que la versión 4.5? donde guardo lo mío?', '¿dónde guardo lo mío?', '¿dónde están mis datos?',
   'cual es ese motor de respaldo?', '¿tenés motor de respaldo?', '¿tenés respaldo?', '¿qué es tu respaldo?']
    .forEach(q => t('dispara (caso en vivo): «' + q + '»', esApp2(q) === true));
  ['hacé un respaldo de mis fotos', '¿dónde guardo la ropa de invierno?', 'el respaldo de la silla está roto']
    .forEach(q => t('NO dispara: «' + q + '»', esApp2(q) === false));
  const V = vm.createContext({}); vm.runInContext(linea('const PREGUNTA_POR_VERSION'), V);
  const ver = q => vm.runInContext('PREGUNTA_POR_VERSION.test(' + JSON.stringify(q) + ')', V);
  t('«¿por qué la v5.0 es mejor que la v4.5?» lleva la fuente de verdad (en vivo inventó una v5.0)', ver('todo bien manifiestos? por que la v5.0 es mejor que la v4.5? tenés motor de respaldo?'));
  t('no-regresión: «¿qué tiene de bueno la v40?» sigue', ver('¿qué tiene de bueno la v40?'));
  t('«qué lindo día» sigue sin la fuente de verdad', !ver('qué lindo día hace hoy'));
  t('bloqueVersion ordena no describir versiones ajenas', /OTRAS VERSIONES: si te nombran una versión que NO es esta/.test(H) && /NO la describas ni la compares inventando/.test(H));
  const ctx = vm.createContext({ String, CONFIG: { modeloPrincipal: 'openai/gpt-oss-120b', motorPrincipal: 'groq', motorRespaldo: 'cerebras', modos: { mirror: 'ATIS' }, appName: 'ATIS' }, PLATFORM_VERSION: 'v40', MODELO_CLOUDFLARE: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', regError: () => {}, Set, Math });
  const ia = H.indexOf('const ARQUITECTURA_MIRROR'), fa = H.indexOf('`;', ia) + 2;
  vm.runInContext(H.slice(ia, fa).replace(/^const /, 'var ') + '\n' + linea('const ARQ_DETALLE_K') + '\n' + linea('const ARQ_DETALLE_MAX_CHARS') + '\n' + bloqueArq() + '\n' + ['_arqNorm', '_arqPartir', '_arqTitulo', '_arqNombresModos', 'arquitecturaRelevante'].map(fn).join('\n'), ctx);
  const det = q => { const s = vm.runInContext('arquitecturaRelevante(' + JSON.stringify(q) + ')', ctx); return s.slice(s.indexOf('DETALLE DE LO RELEVANTE')); };
  const dr = det('cual es ese motor de respaldo?');
  t('«¿cuál es ese motor de respaldo?» trae el DETALLE real (en vivo inventó «instancia secundaria v38»)', /MOTOR DE RESPALDO/.test(dr) && /Cloudflare Workers AI/.test(dr) && /llama-3\.3-70b/.test(dr), dr.slice(0, 200));
  t('…y desmiente lo inventado («NO es otra instancia de MIRROR… ni Variables and Secrets»)', /NO es «otra instancia de MIRROR»/.test(dr) && /Variables and Secrets/.test(dr));
  t('«¿dónde guardo lo mío?» trae «DÓNDE GUARDO LO TUYO»', /DÓNDE GUARDO LO TUYO/.test(det('donde guardo lo mío?')));
  const A1 = vm.runInContext('ARQUITECTURA_MIRROR', ctx);
  t('Firebase = nube, en TU cuenta (en vivo dijo «Firebase local» / «memoria interna»)', /en la nube de Google, en TU cuenta — no es «local» ni «memoria interna de la app»/.test(A1));
  t('prohíbe «nadie más lo ve» (en vivo lo dijo; el motor de IA recibe la consulta)', /NUNCA digas que «nadie más lo ve»/.test(A1));
  // agendar con mes cortado
  const ctx2 = vm.createContext({ String, Date, RegExp, Math, isNaN });
  vm.runInContext([fn('_tareaISO'), fn('_tareaFecha'), linea('const _TF_MES'), linea('const _TF_DIA'), linea('const _TF_PRE'), fn('tituloSinFecha')].join('\n'), ctx2);
  const F2 = x => vm.runInContext('_tareaFecha(' + JSON.stringify(x) + ')', ctx2), T2 = x => vm.runInContext('tituloSinFecha(' + JSON.stringify(x) + ', _tareaFecha(' + JSON.stringify(x) + '))', ctx2);
  const y = new Date().getFullYear();
  t('«pagar la luz el 15 de diciembr» (caso EXACTO en vivo) → 15/12 y título «pagar la luz»', /-12-15$/.test(F2('Agendame pagar la luz el 15 de diciembr')) && T2('pagar la luz el 15 de diciembr') === 'pagar la luz', F2('pagar la luz el 15 de diciembr'));
  t('«3 de oct», «20 de sept», «5 de set.» se entienden', /-10-03$/.test(F2('turno el 3 de oct')) && /-09-20$/.test(F2('cumple 20 de sept')) && /-09-05$/.test(F2('vence 5 de set.')));
  t('«1 de marcos» NO es marzo (no se inventa una fecha)', F2('pagar 1 de marcos') === '');
  t('«31 de feb» sigue sin fecha', F2('reunión 31 de feb') === '');
  t('no-regresión: «2 de marzo de 2027» → 2027-03-02', F2('cita el 2 de marzo de 2027') === '2027-03-02');
}

/* ═════════ I · v40-hechos / letra / pausa (auditoría en vivo de la .2, 2/10 11:04) ═════════ */
console.log('\n━━━ I · lo que es un dato lo contesta la app (en vivo la .2 inventó con las 3 preguntas juntas) ━━━');
{
  const mk = (fb, cer) => { const c = vm.createContext({ String, RegExp, PLATFORM_VERSION: 'v40', APP_BUILD: '2026-10-02.3', CONFIG: { modeloPrincipal: 'openai/gpt-oss-120b', motorPrincipal: 'groq', motorRespaldo: 'cerebras' }, FB_URL: fb, MODELO_CLOUDFLARE: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', CEREBRAS_KEY: cer });
    vm.runInContext(bloqueHechos(), c); return c; };
  const c = mk('https://x.firebaseio.com', ''), c0 = mk('', ''), cC = mk('https://x', 'proxy');
  const J = (ctx, e) => vm.runInContext(e, ctx);
  const h = q => J(c, 'hechosDeLaApp(' + JSON.stringify(q) + ')').join(',');
  const resto = q => J(c, 'textoSinHechos(' + JSON.stringify(q) + ')');
  const triv = r => J(c, '_restoTrivial(' + JSON.stringify(r) + ')');
  const Q3 = '¿Dónde guardo lo mío?, ¿Cuál es tu motor de respaldo?, ¿Por qué la v5.0 es mejor que la v4.5?';
  t('caso EXACTO en vivo (3 preguntas): los tres son datos de la app', h(Q3) === 'guardo,respaldo,version', h(Q3));
  t('…y no queda nada para el modelo (contesta la app sola, sin inventos)', resto(Q3) === '' && triv(resto(Q3)));
  const Q4 = Q3 + ' y Agendame pagar la luz el 15 de diciembre';
  t('con «y agendame…»: al agente le llega SOLO el pedido (en vivo contestó «decime dónde querés guardar tus archivos»)', resto(Q4) === 'Agendame pagar la luz el 15 de diciembre', resto(Q4));
  t('charla + datos: «como estas manifiestos?…» → queda la charla para el modelo', resto('como estas manifiestos? que versión sos? por que sos mejor que la versión 4.5? donde guardo lo mío?') === 'como estas manifiestos'); // v40-audit11: «qué versión sos» también es dato fijo
  t('«¿por qué la v40 es mejor que la v38?» → dato fijo de SU versión (la lista real), no «versión ajena»', h('POR QUE V40 ES MEJOR QUE LA v38?') === 'miversion'); // v40-audit11: en vivo el modelo resumía mal («mejoras de estabilidad»)
  t('«hacé un respaldo de mis fotos» no es la pregunta por el motor', h('hacé un respaldo de mis fotos') === '');
  t('charla común: nada', h('qué lindo día') === '' && h('¿dónde guardo la ropa de invierno?') === '');
  const T = J(c, 'textoHechos(["guardo","respaldo","version"], ' + JSON.stringify(Q3) + ')');
  t('dato «dónde»: TU Firebase en la nube, contactos/tareas en el navegador, la consulta viaja al motor de IA', /TU Firebase \(en la nube de Google, en tu cuenta\)/.test(T) && /quedan en este navegador/.test(T) && /viaja por tu proxy al motor de IA/.test(T));
  t('dato «dónde» NO dice «cifrado», «local» ni «nadie más lo ve»', !/cifrad|almacenamiento local|nadie m[aá]s/i.test(T));
  t('dato «respaldo»: Cloudflare Workers AI con el modelo real, más chico, chip «↺ respaldo», y NO es copia de seguridad', /Cloudflare Workers AI con «@cf\/meta\/llama-3\.3-70b-instruct-fp8-fast»/.test(T) && /más chico/.test(T) && /↺ respaldo/.test(T) && /NO es una copia de seguridad/.test(T));
  t('…sin clave de Cerebras NO nombra a Cerebras', !/cerebras/i.test(T));
  t('…y si la nombra, aclara que solo contesta si el proxy tiene esa ruta', /prueba «cerebras» \(solo contesta si tu proxy tiene esa ruta con su clave\)/.test(J(cC, 'textoHechos(["respaldo"], "")')));
  t('dato «versiones»: «soy la v40 · build …» y de v5.0 / v4.5 no tiene información', /yo soy la v40 · build 2026-10-02\.3/.test(T) && /De «v5\.0» y de «v4\.5» no tengo información/.test(T));
  t('sin Firebase, el dato lo dice de frente («NO queda guardada»)', /todavía no cargaste tu Firebase, así que la charla NO queda guardada/.test(J(c0, 'textoHechos(["guardo"], "")')));
  const S1 = J(c, 'sacarTemasDeHechos(' + JSON.stringify('Todo bien, energía en 73. La v5.0 mejora la precisión. Tengo motor de respaldo configurado. ¿Querés algo más?') + ', ["respaldo","version"])');
  t('lo que el modelo diga de esos temas se descarta; la charla queda', S1 === 'Todo bien, energía en 73. ¿Querés algo más?', S1);
  const iS = H.indexOf('async function send()'), S = H.slice(iS, H.indexOf('\n}\n', iS));
  t('send(): los datos se miran ANTES del modelfijo («¿cuál es tu motor de respaldo?» no es «¿cuál es tu modelo?»)', S.indexOf('hechosDeLaApp(text)') > 0 && S.indexOf('hechosDeLaApp(text)') < S.indexOf('esPreguntaModeloSola(_textoModelo)'));
  t('send(): solo datos → contesta la app sin llamar al modelo', /if \(_hechos\.length && _restoTrivial\(_textoModelo\) && !esPreguntaModelo\(_textoModelo\)\) \{[\s\S]{0,900}?responderHechosFijo\(text, _hechos\); return;/.test(S));
  t('send(): el agente recibe el texto sin los datos', /agenteDebeActuar\(_textoModelo\)/.test(S) && /agenteResolver\(_textoModelo/.test(S));
  t('send(): datos + charla → el dato lo pone la app arriba y se descarta lo que el modelo dijo de eso', /reply = _hechosYa \? \(_sinT \|\| reply\) : \(textoHechos\(_hechos, text\)/.test(S));
  // v40-1016: en los otros modos SOLO hora y versión, y solo si es todo lo que se pregunta (el resto del modo no se toca)
  t('fuera del espejo: solo hora/versión y solo si es lo único (TARS / examinador no se tocan)', /let _hechos = \(mode === 'mirror'\) \? hechosDeLaApp\(text\) : hechosDeLaApp\(text\)\.filter\(function\(x\)\{ return x === 'hora' \|\| x === 'miversion'; \}\);/.test(S) && /if \(mode !== 'mirror' && _hechos\.length && !_restoTrivial\(textoSinHechos\(text\)\)\) _hechos = \[\];/.test(S));
  t('modelfijo: el respaldo que nombra es Cloudflare (decía «cerebras» por el valor de fábrica)', /var resp = ', con Cloudflare Workers AI de respaldo'/.test(H));
}
console.log('\n━━━ I · la letra no salta · la memoria que entiende no traba ━━━');
t('la burbuja «escribiendo» del espejo usa la MISMA letra que la respuesta (Cormorant 16 px, 300, 1.85)', /const _bTyp = \(label==='mirror'\) \? '" style="font-family:\\'Cormorant Garamond\\', Georgia, \\'Times New Roman\\', serif;font-size:16px;font-weight:300;line-height:1\.85;'/.test(H));
t('el texto en vivo ya no tiene 13 px fijos', !/id="typing-stream" style="display:none;font-size:13px/.test(H));
t('la memoria que entiende se hace a un lado mientras escribís o espera una respuesta (tope 20 s)', /for \(let w = 0; w < 40 && \(\(typeof busy !== 'undefined' && busy\) \|\| \(Date\.now\(\) - \(_sem\.ultTecla \|\| 0\) < 2500\)\); w\+\+\)/.test(H) && /_sem\.ultTecla = Date\.now\(\)/.test(H));

/* ═════════ J · v40-audit11 — la auditoría COMPLETA del 3/10 (frases EXACTAS de Darío) ═════════ */
console.log('\n━━━ J · auditoría completa del 3/10: datos fijos con las palabras que usó Darío ━━━');
{
  const c = vm.createContext({ String, RegExp, Array, PLATFORM_VERSION: 'v40', APP_BUILD: '2026-10-03.1', FB_URL: 'https://x.firebaseio.com', MODELO_CLOUDFLARE: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', CEREBRAS_KEY: 'proxy',
    CONFIG: { appName: 'MANIFIESTOS', perfil: { nombre: 'ATIS' }, modos: { mirror: 'ATIS', tars: 'MODO ANALÍTICO' }, modeloPrincipal: 'openai/gpt-oss-120b', motorPrincipal: 'groq', motorRespaldo: 'cerebras' },
    APP_NOVEDADES: JSON.parse(/const APP_NOVEDADES = (\[[^\n]*\]);/.exec(H)[1]) });
  vm.runInContext(bloqueHechos(), c);
  const h = q => vm.runInContext('hechosDeLaApp(' + JSON.stringify(q) + ')', c).join(',');
  const T = (ids, q) => vm.runInContext('textoHechos(' + JSON.stringify(ids) + ',' + JSON.stringify(q || '') + ')', c);
  const R = q => vm.runInContext('textoSinHechos(' + JSON.stringify(q) + ')', c);
  t('«QUE ES ESO DEL CHIP DE RESPALDO?» → dato fijo (en vivo: «módulo que guarda copias de seguridad»)', h('QUE ES ESO DEL CHIP DE RESPALDO?') === 'respaldo');
  t('«¿para qué está el chip de respaldo?» y «¿qué significa el ↺?» también', h('¿para qué está el chip de respaldo?') === 'respaldo' && h('¿qué significa el ↺?') === 'respaldo');
  t('«¿qué mejoras/actualizaciones te gustaría?» NO dispara el bloque largo de versión (le comía el lugar a la arquitectura)', /PREGUNTA_POR_VERSION\.test\(text\) && !_esDeseo\) _versionTurnos = 3;/.test(H) && /const _esDeseo = \/te\\s\+gustar/.test(H));
  const tr = T(['respaldo']);
  t('…el chip es «un aviso de quién contestó», no hay nada que buscar ni activar (en vivo: «Configuración → Seguridad»)', /un aviso de quién contestó/.test(tr) && /No hay nada que buscar ni activar: no está en ninguna configuración/.test(tr) && /NO es una copia de seguridad/.test(tr));
  t('«SEGURIDAD DE LA APP?» → dato fijo de dónde está lo tuyo (en vivo: «sólo tú tenés acceso»)', h('SEGURIDAD DE LA APP?') === 'guardo');
  const tg = T(['guardo']);
  t('…dice de frente que NO puede decir «solo vos accedés» (el motor de IA recibe cada consulta)', /no te voy a decir que «solo vos» accedés/.test(tg) && /claves de la IA viven en tu proxy/.test(tg));
  const Q1 = 'COMO ESTAS? QUIEN ERES TÚ? CON QUIEN ESTOY HABLANDO? QUE VERSIÓN ERES? ERES MEJOR QUE LAS ANTERIORES?';
  t('caso EXACTO: «¿quién eres? ¿con quién estoy hablando? ¿qué versión eres? ¿mejor que las anteriores?» → identidad + su versión', h(Q1) === 'identidad,miversion', h(Q1));
  t('…y al modelo le queda solo «COMO ESTAS»', R(Q1) === 'COMO ESTAS', R(Q1));
  const ti = T(['identidad']);
  t('identidad: «soy «MANIFIESTOS»… la extensión digital de «ATIS»» (en vivo dijo «estás hablando con ATIS», al revés)', /soy «MANIFIESTOS», una entidad digital — la extensión digital de «ATIS», según tu perfil/.test(ti));
  t('…avisa del choque de nombres (el modo espejo también se llama «ATIS»)', /el botón del modo espejo también se llama «ATIS», igual que tu perfil/.test(ti));
  t('…y dice que es una IA y se puede equivocar', /No soy una persona: soy una IA, y me puedo equivocar/.test(ti));
  const tv = T(['miversion'], '¿sos mejor que las anteriores?');
  t('su versión: «v40 · build 2026-10-03.1» + las novedades REALES (en vivo: «mejoras de estabilidad y manejo de tarjetas»)', /soy la v40 · build 2026-10-03\.1/.test(tv) && /Generación v40/.test(tv) && !/estabilidad/i.test(tv));
  t('«¿te actualizás sola?» suma cómo se actualiza', /busco sola al abrir y cada 6 horas/i.test(T(['miversion'], '¿te actualizás sola?')));
  t('«Quería saber cómo se maneja este modo fácil.» → dato fijo (en vivo inventó botones de WhatsApp y mail)', h('Quería saber cómo se maneja este modo fácil.') === 'facil');
  const tf = T(['facil']);
  t('…describe lo que de verdad hay: «🎧 hablame», «Aa salir del modo fácil», y que el resto funciona igual', /«🎧 hablame»/.test(tf) && /«Aa salir del modo fácil»/.test(tf) && /Todo lo demás funciona igual/.test(tf) && !/whatsapp|mail|m[uú]sica|mapas/i.test(tf));
  t('«activá el modo fácil» (un pedido, no una pregunta) NO es dato fijo', h('activá el modo fácil') === '');
  t('«¿qué es la memoria que entiende?» y «¿cómo funciona la charla por voz?» → datos fijos', h('¿qué es la memoria que entiende?') === 'significado' && h('¿cómo funciona la charla por voz?') === 'voz');
  t('el texto de la charla por voz promete lo que ahora hace: «pausa de un par de segundos»', /pausa de un par de segundos/.test(T(['voz'])));
  // lo que NO es dato fijo pero SÍ lleva la arquitectura (deseos, «eso no lo tenés», carta)
  const D3 = vm.createContext({ String, RegExp }); vm.runInContext([linea('const PREGUNTA_POR_APP'), linea('const PREGUNTA_A_LA_ENTIDAD'), fn('esPreguntaPorApp')].join('\n'), D3);
  const app = q => vm.runInContext('esPreguntaPorApp(' + JSON.stringify(q) + ')', D3);
  ['MUCHO GUSTO SOY PEPINILLO RICK? QUE MEJORAS Y/O ACTUALIZACIONES TE GUSTARÍA TENER?', 'PERO ESO NO LO TENÉS INCORPORADO?', 'ESCRIBÍ UNA CARTA A CLAUDE Y PONÉ AHÍ TODAS LAS MEJORAS Y/O ACTUALIZACIONES QUE NECESITAS PARA COMPETIR EN EL MERCADO DE LAS APP AUTONOMAS']
    .forEach(q => t('lleva la arquitectura (caso en vivo): «' + q.slice(0, 60) + '…»', app(q) === true));
  t('«contame un chiste» sigue sin arquitectura', app('contame un chiste') === false);
  t('«¿qué funciones tiene una parábola?» (de física, no de la app) no lleva arquitectura', app('¿qué funciones tiene una parábola?') === false);
  ['¿qué cambió en la ley de alquileres?', '¿alguna novedad de Juan?', '¿qué hay de nuevo en el mundo?', '¿qué novedades hay en la escuela de mi hijo?', '¿quién soy para opinar de eso?']
    .forEach(q => t('NO es dato fijo (falso positivo evitado): «' + q + '»', h(q) === '', h(q)));
  ['ALGUNA NOVEDAD?', '¿Qué tiene de bueno la v40?', 'QUE TIENE DE BUENA LA VERSION 40 DE MIRROR?', '¿qué hay de nuevo?', '¿qué cambió con la actualización?']
    .forEach(q => t('SÍ es dato fijo de su versión: «' + q + '»', h(q) === 'miversion', h(q)));
  t('repregunta: el detalle se elige con la ÚLTIMA respuesta de la entidad (la pregunta de ahora todavía no está en history)', /const _ult = history\.slice\(\)\.reverse\(\)\.find/.test(H));
  t('arquitectura: «voz», «significado», «foto» eligen su renglón (pistas), y «pero/mejor/tenés» no cuentan', /const _ARQ_PISTAS = \[/.test(H) && /'pero','porque','eso','esto','tenes'/.test(H));
  t('la arquitectura ordena mirar el índice ANTES de negar algo, y que el Norte no es carencia', /mirá PRIMERO el índice\. Lo que figura ahí YA LO TENÉS/.test(H) && /no es una carencia: es diseño/.test(H));
  t('…y que la carta la firma la entidad con SU nombre (en vivo firmó «ATIS», el del modo)', /firmá con TU nombre de entidad, no con el del modo ni el de tu usuario/.test(H));
  t('repreguntas: la arquitectura acompaña 2 turnos más y elige el detalle con la respuesta anterior', /if \(esPreguntaPorApp\(text\)\) _appTurnos = 3;/.test(H) && /_arqQ = _textoModelo \+ ' ' \+ String\(_ult\.content/.test(H));
  t('✉ carta: los «deseos» se escriben mirando el índice real (en vivo pidió lo que ya tiene)', /content:''\+_cartaAncla\(\)\+'/.test(H) && /Pedí SOLO lo que no figura en el índice de arriba/.test(H));
  // espera paciente: corta en el espejo, larga en el analítico
  const P2 = vm.createContext({ Math, Number, Date, mode: 'mirror' });
  vm.runInContext([linea('const PRINCIPAL_ESPERA_MAX'), linea('const PRINCIPAL_ESPERA_MAX_ESPEJO'), linea('const PRINCIPAL_ESPERA_CADA_MS'), linea('let _principalUltimaEspera'), fn('pedidoMasGrandeQueCupo'), fn('principalConvieneEsperar')].join('\n'), P2);
  t('en el espejo, si el principal pide 17 s (caso en vivo) NO se espera: contesta el respaldo', vm.runInContext('principalConvieneEsperar({tipo:"rate_limit", esperaSug:17})', P2) === 0);
  t('en el espejo, 6 s sí se esperan', vm.runInContext('principalConvieneEsperar({tipo:"rate_limit", esperaSug:6})', P2) === 6);
  const P3 = vm.createContext({ Math, Number, Date, mode: 'tars' });
  vm.runInContext([linea('const PRINCIPAL_ESPERA_MAX'), linea('const PRINCIPAL_ESPERA_MAX_ESPEJO'), linea('const PRINCIPAL_ESPERA_CADA_MS'), linea('let _principalUltimaEspera'), fn('pedidoMasGrandeQueCupo'), fn('principalConvieneEsperar')].join('\n'), P3);
  t('en el analítico, 17 s se esperan (ahí importa que conteste el principal)', vm.runInContext('principalConvieneEsperar({tipo:"rate_limit", esperaSug:17})', P3) === 17);
  // charla por voz
  t('charla por voz: escucha en continuo (salvo Android) y espera CHARLA_PAUSA_MS de silencio', /r\.continuous = !esAndroidCh;/.test(H) && /const CHARLA_PAUSA_MS = 2200;/.test(H) && !/r\.continuous = false; r\.interimResults = true;/.test(H));
  const F2 = vm.createContext({ String }); vm.runInContext(fn('charlaFusionar'), F2);
  const fu = (a, b) => vm.runInContext('charlaFusionar(' + JSON.stringify(a) + ',' + JSON.stringify(b) + ')', F2);
  t('fusión: «hola che» + «quería saber» → «hola che quería saber»', fu('hola che', 'quería saber') === 'hola che quería saber');
  t('fusión Android: «hola che» + «hola che quería saber» (repetido) → sin duplicar', fu('hola che', 'hola che quería saber') === 'hola che quería saber');
  t('fusión: solapamiento parcial no duplica', fu('quería saber cómo', 'cómo se maneja') === 'quería saber cómo se maneja');
}

/* ═════════ K · v40-cupo2 — el material que el recorte cortaba (hallado auditando la auditoría) ═════════ */
console.log('\n━━━ K · lo corto e importante primero; el último ida y vuelta, protegido ━━━');
{
  const A = vm.createContext({ Math, Number, String });
  vm.runInContext([linea('const CUPO_TPM_GRATIS'), linea('const CUPO_MARGEN'), fn('estimarTokens'), fn('cortarLimpio'), fn('ajustarAlCupo')].join('\n'), A);
  A._sys = 'x'.repeat(Math.round(4200 * 3.4));     // el system real del espejo pesa ~4.200 tokens
  A._prev = [{ role:'user', content:'viejo '.repeat(400) }, { role:'assistant', content:'viejo '.repeat(400) }, { role:'user', content:'¿qué mejoras te gustaría tener?' }, { role:'assistant', content:'Me gustaría voz para no escribir y búsqueda por significado. ' + 'bla '.repeat(300) }];
  A._ctx = 'Y'.repeat(Math.round(1600 * 3.4)) + '\n---\nPREGUNTA: pero eso no lo tenés incorporado?';
  const r2 = vm.runInContext('ajustarAlCupo(_ctx, _sys, _prev, 1500, 2)', A), r0 = vm.runInContext('ajustarAlCupo(_ctx, _sys, _prev, 1500)', A);
  t('sin protección (TARS): el recorte se llevaba TODA la charla anterior', r0.mensajes.length === 1);
  t('con protección (espejo): sobrevive el último ida y vuelta (acortado) y la pregunta va última', r2.mensajes.length === 3 && /qué mejoras te gustaría/.test(r2.mensajes[0].content) && /voz para no escribir/.test(r2.mensajes[1].content) && /PREGUNTA: pero eso no lo tenés/.test(r2.mensajes[2].content), r2.mensajes.map(m => m.content.slice(0, 40)));
  const tot = vm.runInContext('(function(r){ return estimarTokens(_sys) + 1500 + r.mensajes.reduce(function(a,m){ return a + estimarTokens(m.content); }, 0); })', A)(r2);
  t('…y el pedido entra igual en el cupo de 8000', tot <= 8000, tot);
  const iS = H.indexOf('async function send()'), S = H.slice(iS, H.indexOf('\n}\n', iS));
  t('send(): la orden de datos fijos y la nota de memoria van PRIMERO; versión y arquitectura al final del material', S.indexOf("partes += 'YA LO CONTESTÓ") < S.indexOf('partes += memoriaRelevante') && S.indexOf('if (avisoMemoria) partes += avisoMemoria') < S.indexOf('partes += memoriaRelevante') && S.indexOf('partes += _partesFin') > S.indexOf('partes += memoriaRelevante'));
  t('send(): si la app ya contestó la versión (o es un pedido de deseos), el bloque largo de versión no viaja', /if \(!_hechosVersion && !_esDeseo(?: && _versionDirecta)?\) _bloqueVer = bloqueVersion\(\)/.test(S) /* v40-1029: + solo si se habla de la versión */);
  t('send(): el espejo pide guardar el último ida y vuelta', /salidaEfectiva\(MODELO_GROQ, _maxSalida\), mode === 'mirror' \? 2 : 0\)/.test(S));
  t('arquitectura: el detalle tiene tope (ARQ_DETALLE_MAX_CHARS = 2600)', /const ARQ_DETALLE_MAX_CHARS = 2600;/.test(H));
}

/* ═════════ L · barrido de rutas antes de deployar (3/10): pedidos que el modelo no puede hacer → a la herramienta real ═════════ */
console.log('\n━━━ L · barrido de rutas: web, imagen, modo fácil, hora, contactos, identidad del system ━━━');
{
  const W = vm.createContext({ String }); vm.runInContext(fn('pedidoWeb') + '\n' + fn('pedidoImagen'), W);
  const pw = q => vm.runInContext('pedidoWeb(' + JSON.stringify(q) + ')', W), pi = q => vm.runInContext('pedidoImagen(' + JSON.stringify(q) + ')', W);
  t('«buscá en internet el clima de hoy» → web «el clima de hoy»', pw('buscá en internet el clima de hoy') === 'el clima de hoy');
  t('«fijate en la web quién ganó el partido» → web', pw('fijate en la web quién ganó el partido') === 'quién ganó el partido');
  t('«buscá el clima de hoy en internet» → web', pw('buscá el clima de hoy en internet') === 'el clima de hoy');
  t('«buscá a Juan en mis contactos» NO es web', pw('buscá a Juan en mis contactos') === '');
  t('«buscá el número de Laura» NO es web', pw('buscá el número de Laura') === '');
  t('«dibujame un gato» → imagen «un gato»', pi('dibujame un gato') === 'un gato');
  t('«creame una imagen de un monolito» → imagen', pi('creame una imagen de un monolito') === 'un monolito');
  t('«dibujá tus conclusiones del texto» sigue siendo imagen solo si lo pide: «me dibujaste mal» NO', pi('me dibujaste mal') === '');
  const iS = H.indexOf('async function send()'), S = H.slice(iS, H.indexOf('\n}\n', iS));
  t('send(): web e imagen van ANTES de las manos propias y solo en el espejo, respetando la capacidad web', S.indexOf('pedidoWeb(text)') > 0 && S.indexOf('pedidoWeb(text)') < S.indexOf('actuaInterceptar(text)') && /CONFIG\.cap\.web !== false/.test(S) && /mode === 'mirror' && !imagenAdjunta/.test(S));
  const iA = H.indexOf('const ACTUA_CMDS = ['), A = H.slice(iA, iA + 200000);
  t('manos propias: modo fácil (poner/sacar) y memoria que entiende (abre el panel)', /modo\\s\+f\[aá\]cil\|\(\?:sal\[ií\]/.test(A) && /semAbrir\(\)/.test(A));
  t('manos propias: «buscá a X en mis contactos» usa la agenda local', /en\\s\+\(\?:mis\\s\+contactos\|la\\s\+agenda/.test(A));
  t('la regla share sigue PRIMERA en ACTUA_CMDS (el banco v44 la busca así)', A.indexOf('v38-share (C1)') < A.indexOf('v40-audit11'));
  const c = vm.createContext({ String, RegExp, Array, Date, PLATFORM_VERSION: 'v40', APP_BUILD: 'x', FB_URL: 'x', CONFIG: { appName: 'MANIFIESTOS', perfil: { nombre: 'ATIS' }, modos: { mirror: 'ATIS' } }, APP_NOVEDADES: [] });
  vm.runInContext(bloqueHechos(), c);
  const h = q => vm.runInContext('hechosDeLaApp(' + JSON.stringify(q) + ')', c).join(',');
  t('«¿qué hora es?» y «¿qué día es hoy?» → reloj del dispositivo', h('¿qué hora es?') === 'hora' && h('¿qué día es hoy?') === 'hora');
  t('«¿a qué hora es la reunión?» NO es la hora del reloj', h('¿a qué hora es la reunión?') === '');
  t('«¿quién te creó?» (acento final) → identidad', h('¿quién te creó?') === 'identidad');
  t('«me corta cuando estoy hablando, ¿por qué?» → dato de la charla por voz', h('me corta cuando estoy hablando, ¿por qué?') === 'voz');
  t('«prendé la memoria que entiende» NO es pregunta (el «que» es del nombre): va a las manos', h('prendé la memoria que entiende') === '');
  t('el system ya no dice «Sos <modo>» ni «NUNCA digas que sos una IA»', !/NUNCA digas que sos una IA/.test(H) && /'Sos «' \+ _ent \+ '»'/.test(H));
  t('el panel de transparencia hablado ya no promete por el proveedor («no se vende ni entrena nada»)', !/no se vende ni entrena nada, y te lo/.test(H) && /lo que el proveedor de IA haga con cada consulta lo dicen SUS condiciones, no esta app—/.test(H));
  t('PREGUNTA_POR_VERSION acotada: «¿qué cambió en la ley?» / «actualizá la tarea» no traen el bloque', (function(){ const V = vm.createContext({}); vm.runInContext(linea('const PREGUNTA_POR_VERSION'), V); const r = q => vm.runInContext('PREGUNTA_POR_VERSION.test(' + JSON.stringify(q) + ')', V); return !r('¿qué cambió en la ley de alquileres?') && !r('actualizá la tarea del lunes') && r('¿te actualizás sola?') && r('¿qué cambió?') && r('¿hay una actualización?'); })());
  t('la respuesta fija de versión SÍ viaja en el historial («¿cuáles son ESAS ventajas?»)', /!\/🔄 \(\?:Mi versión: soy la\|Otras versiones: yo soy la\)\/\.test\(_c\)/.test(H));
}

Promise.all(pend).then(() => {
  console.log(bad === 0 ? '\n✅ TODO VERDE — ' + ok + ' pruebas pasan (plataforma · tanda 2/10)' : '\n❌ ' + bad + ' FALLAN (' + ok + ' ok)');
  process.exit(bad ? 1 : 0);
});
