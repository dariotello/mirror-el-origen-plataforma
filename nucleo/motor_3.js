/* v39-modelfijo (20/09/2026) — RESPUESTA DETERMINÍSTICA AL "¿QUÉ MODELO SOS?" ──────────────
   Hallazgo en vivo de Darío: gpt-oss-120b (gratis) IGNORA la instrucción del prompt y confabula
   "GPT-4"/"MIRROR v38", contestando distinto cada vez y hasta NEGANDO el modelo real. La ruta de
   prompt se agotó; esto lo resuelve LOCAL, sin pasar por el modelo: la app arma una respuesta FIJA
   desde CONFIG (mismo patrón que la capa ACTÚA). Así NO puede confabular. Sólo dispara cuando la
   pregunta es por SU modelo/motor (2da persona: sos/usás/…), nunca en una consulta analítica de
   terceros ("¿qué modelo de IA usan las escuelas?"). */
/* v40-audit (24/09/2026): «¿qué modelo sos? haceme un informe de la app» son DOS pedidos. Si el
   texto trae algo más que la pregunta por el modelo, no se contesta SOLO el texto fijo (se perdía
   el informe): va al modelo como siempre y la app le ANTEPONE la línea de identidad fija. */
const _OTRO_PEDIDO_RE = /(informe|detall|expl[ií]c|cont[aá]me|describ|arm[aá]me|hac[eé]me|dame|resum|arquitectura|c[oó]mo\s+funcion|qu[eé]\s+(?:sab[eé]s|pod[eé]s)\s+hacer)/i;
/* v40-audit3 (25/09/2026) — «Estoy cansado, ¿cómo estás? ¿cuál es tu modelo?» (47 letras) entraba como
   pregunta SOLA por el tope de 60 caracteres y el «estoy cansado» quedaba sin respuesta. Ahora se saca
   la pregunta por el modelo y se mira lo que SOBRA: si queda algo más que un saludo, es charla + modelo. */
function _restoSinPreguntaModelo(text){
  var t = ' ' + String(text||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[¿?¡!.,;:()«»"]/g,' ') + ' ';
  t = t.replace(/\b(que|cual)\s+(es\s+)?(tu|su)\s+(modelo|motor)(\s+de\s+(ia|iag|inteligencia\s+artificial|lenguaje))?\b/g, ' ')
       .replace(/\b(que|cual)\s+(modelo|motor)(\s+de\s+(ia|iag|inteligencia\s+artificial|lenguaje))?\s+(sos|eres|usas|utilizas|tenes|corres|funcionas|estas\s+usando)\b/g, ' ')
       .replace(/\b(tu|su)\s+(modelo|motor)\b/g, ' ')
       .replace(/\b(que|cual|q)\s+(ia|inteligencia\s+artificial|llm)\s+(sos|eres|usas|utilizas|tenes)\b|\bcon\s+que\s+(modelo|motor|ia)\s+(funcionas|andas|corres|trabajas)\b|^\s*(sos|eres)\s+(chat\s?gpt|gpt|llama|claude|gemini|copilot|deepseek)(\s+o\s+(chat\s?gpt|gpt|llama|claude|gemini|copilot|deepseek))?\b/g, ' ') // v40-modelo3
       .replace(/\b(hola|che|buenas|buen\s+dia|decime|contame|y|vos|a\s+ver|bueno|dale|ok)\b/g, ' ');
  return t.replace(/\s+/g, ' ').trim();
}
function esPreguntaModeloSola(text){ try { const _sv = (typeof sinVocativo === 'function') ? sinVocativo(text) : text; /* v40-vocativo: «MANIFIESTOS, SOS CHATGPT?» */ return esPreguntaModelo(text) && !_OTRO_PEDIDO_RE.test(String(text||'')) && _restoSinPreguntaModelo(_sv).split(' ').filter(Boolean).length < 2; } catch(e){ return false; } }
function lineaIdentidadModelo(){
  try {
    var mp = (typeof CONFIG!=='undefined' && CONFIG.modeloPrincipal) || '';
    var motp = (typeof CONFIG!=='undefined' && CONFIG.motorPrincipal) || '';
    if (!mp) return '';
    return 'Sobre mi modelo, de frente: por debajo corro sobre «' + mp + '»' + (motp ? ' a través de «' + motp + '»' : '') + ((typeof PLATFORM_VERSION!=='undefined') ? ' («' + PLATFORM_VERSION + '» es la versión de la app, no el modelo)' : '') + '.';
  } catch(e){ return ''; }
}
/* ══ v40-hechos (2/10/2026, 11:04 — auditoría en vivo de la .2) — LO QUE ES UN DATO, LO CONTESTA LA APP ══════════
   HALLAZGO: con las TRES preguntas juntas («¿dónde guardo lo mío?, ¿cuál es tu motor de respaldo?, ¿por qué la v5.0 es
   mejor que la v4.5?») el modelo RECIBIÓ la información real (citó hasta los títulos de los renglones) y aun así
   inventó: «almacenamiento local cifrado», «el respaldo guarda copias de seguridad en la nube», «la v5.0 incorpora…».
   Es la misma lección que «¿qué modelo sos?» (v39-modelfijo): cuando la respuesta es un DATO de la app, el prompt no
   alcanza con este modelo gratis. Ahora la app lo contesta SOLA, desde su configuración, sin pasar por el modelo:
     · dónde está lo tuyo · cuál es el motor de respaldo · versiones que no son la tuya.
   Si en el mismo mensaje hay algo más (charla, un pedido), eso sigue al modelo o al agente SIN esas preguntas, y lo
   que el modelo diga de esos temas se descarta (ya los contestó la app). Nada de esto toca TARS ni la memoria. */
/* ══ v40-hechos2 (3/10/2026 — auditoría en vivo COMPLETA de Darío sobre la .3) ═══════════════════════════════════
   Lo que la .3 contestó bien (dónde guardo + respaldo + v5.0 juntos) siguió fallando con OTRAS palabras para lo mismo:
   «¿qué es eso del CHIP de respaldo?» → «un módulo que guarda copias de seguridad» · «¿dónde la busco?» → «Configuración →
   Seguridad» (no existe) · «¿seguridad de la app?» → «solo vos tenés acceso» · «¿quién eres? ¿con quién estoy hablando?» →
   «estás hablando con ATIS» (al revés: ATIS es el perfil) · «¿cómo se maneja el modo fácil?» → botones de WhatsApp y mail
   (no existen). Cada DATO de la app vive ahora en UNA tabla (HECHOS): cómo se lo reconoce, qué se contesta (siempre
   desde la configuración real) y qué se le descarta al modelo si igual habla de eso. Sumar un dato = sumar un renglón. */
const HECHO_GUARDO_RE = /\bd[oó]nde\s+(?:(?:se\s+)?guard(?:[aá]s|o|amos|an?|[aá]s?te)|almacen[aá]s|(?:se\s+)?almacena[n]?|ten[eé]s|qued[aá]n?|est[aá]n?(?:\s+guardad[oa]s?)?|se\s+guarda[n]?|viven?)\s+(?:lo\s+m[ií]o|(?:todo\s+)?lo\s+que\s+(?:te\s+)?(?:cuento|digo|hablamos|escribo|subo)|mis\s+(?:datos|cosas|recuerdos|charlas|documentos|archivos|contactos|tareas)(?!\s+para\b)|la\s+(?:charla|memoria|info)|los\s+datos|todo\s+esto)|\bseguridad\s+de\s+(?:la\s+app|esta\s+app|mis\s+datos|lo\s+m[ií]o)|\b(?:es|son|est[aá]n?)\s+(?:segur[oa]s?|privad[oa]s?)\s+(?:la\s+app|esta\s+app|mis\s+datos|lo\s+que\s+te|usarte)|\bmis\s+datos\s+(?:son|est[aá]n)\s+(?:privad|segur|a\s+salvo)|\bprivacidad\s+(?:de|en)\s+(?:la\s+app|esta\s+app|mis\s+datos)|\bqui[eé]n\s+(?:ve|lee|tiene\s+acceso\s+a|se\s+entera\s+de)\s+(?:lo\s+que\s+te|mis\s+(?:datos|charlas|cosas|mensajes))/i;
const HECHO_RESPALDO_RE = /\b(?:motor|modelo|chip)\s+(?:de(?:l)?\s+)?respaldo|\bten[eé]s\s+(?:un\s+)?respaldo\b(?!\s+(?:de|para|que|del)\b)|\bqu[eé]\s+pasa\s+si\s+(?:se\s+cae|falla|no\s+anda|se\s+llena)\s+(?:groq|el\s+motor|la\s+ia|tu\s+motor)\b|\b(?:cu[aá]l|qu[eé])\s+(?:es|son)\s+(?:el|ese|tu|eso\s+del?)\s+(?:chip\s+(?:de(?:l)?\s+)?)?respaldo\b|↺/i;
const HECHO_IDENTIDAD_RE = /\bqui[eé]n\s+te\s+(?:hizo|cre[oó]|program[oó]|construy[oó]|invent[oó]|dise[nñ][oó])(?![a-záéíóúñ])|\bqui[eé]n\s+(?:sos|eres)\b(?!\s+(?:vos\s+|tu\s+|t[uú]\s+)?para\b)|\bcon\s+qui[eé]n\s+(?:estoy\s+)?habl(?:o|ando)\b(?!\s+(?:para|en|de|sobre|por)\b)|\bc[oó]mo\s+te\s+llam(?:[aá]s|as)\b|(?<!\bs[eé]\s)(?<!\bsab[eé]s?\s)\bqui[eé]n\s+soy(?:\s+yo)?\s*[?¿!.]*\s*$/i; // v40-1023: «A VECES NO SE QUIEN SOY» es otra cosa
const HECHO_MIVERSION_RE = /\b(?:qu[eé]|cu[aá]l)\s+ver(?:si|is|ci)[oó]n\s+(?:sos|eres|ten[eé]s|tiene[s]?|es\s+(?:esta|la\s+app)|us[aá]s|corr[eé]s)\b(?!\s+(?:de|del|para|en)\b)|\bcu[aá]l\s+es\s+tu\s+(?:ver(?:si|is|ci)[oó]n|build)\b|\ben\s+qu[eé]\s+ver(?:si|is|ci)[oó]n\s+(?:est[aá]s|and[aá]s)\b|\bqu[eé]\s+build\s+(?:sos|ten[eé]s|es\s+esta)\b|\best[aá]s\s+actualizad[ao]\s*[?¿!.]*\s*$|\bsos\s+la\s+[uú]ltima\s+ver(?:si|is|ci)[oó]n\b|\bcu[aá]les\s+son\s+tus\s+novedade?s?\b|\b(?:sos|eres|(?:esta\s+versi[oó]n|la\s+app|esta\s+app|la\s+v\s?\d{2})\s+es)\s+mejor\s+que\s+(?:las?|los?)\s+(?:anterior|vieja|otra|de\s+antes)|\bqu[eé]\s+(?:hay|trae[s]?|tiene[s]?|ten[eé]s)\s+de\s+(?:nuev|buen)\w*\s*(?:(?:la|esta|tu)\s+(?:app|versi[oó]n|v\s?\d{2})|v\s?\d{2})|^\s*[¿¡]?\s*(?:hola\W*)?qu[eé]\s+(?:hay|tra[eé]s|ten[eé]s)\s+de\s+nuev\w*\s*[?¿!.]*\s*$|\balguna\s+novedad\s*[?¿!.]*\s*$|\bqu[eé]\s+novedades\s+(?:hay|ten[eé]s|tra[eé]s|trae)\s*[?¿!.]*\s*$|\bqu[eé]\s+cambi[oó]\s+(?:en\s+(?:la\s+app|vos|esta\s+versi[oó]n)|con\s+la\s+actualizaci[oó]n)|\b(?:te|se)\s+actualiz[aá]s?\s+sol[ao]\b|\bpor\s+qu[eé]\s+(?:la\s+)?v\s?\d{2}\s+es\s+mejor/i;   // acotada: «¿qué cambió en la ley?» o «¿alguna novedad de Juan?» NO son preguntas por la versión
const HECHO_FACIL_RE = /\bmodo\s+f[aá]cil\b/i;
const HECHO_HORA_RE = /^\s*[¿¡]?\s*(?:che,?\s*)?(?:y\s+)?(?:(?:me\s+)?(?:dec[ií]s|dec[ií]me|sab[eé]s|ten[eé]s|pod[eé]s\s+decir(?:me)?|podr[ií]as\s+decir(?:me)?)\s+(?:la\s+hora|qu[eé]\s+hora\s+es|qu[eé]\s+d[ií]a\s+es(?:\s+hoy)?)|ten[eé]s\s+hora|(?:qu[eé]|q|k)\s+horas?\s+(?:es|ten[eé]s|son)|qu[eé]\s+d[ií]a\s+(?:es\s+)?(?:hoy|ma[nñ]ana)|qu[eé]\s+d[ií]a\s+es|qu[eé]\s+fecha\s+es(?:\s+hoy)?|a\s+qu[eé]\s+(?:d[ií]a|fecha)\s+estamos)(?:\s*,?\s*che)?\s*[?¿!.]*\s*$/i;   // v40-audit11: el modelo no tiene reloj · v40-hora2 (16/10, auditor 1): «q hora es», «decime la hora», «tenés hora?», «QUE HORA ES? Y QUE DIA» caían al modelo (que inventa: no le viaja la hora)
const HECHO_VOZ_RE = /\bcharla\s+por\s+voz\b|\bmanos\s+libres\b|\b(?:se|me)\s+corta(?:s)?\b.{0,30}\bhabl|\bcort[aá]s\b.{0,25}\bhabl|\b(?:c[oó]mo|para\s+qu[eé])\b.{0,30}\bhablame\b/i;
const HECHO_SIGNIF_RE = /\bmemoria\s+que\s+entiende\b|\bb[uú]squeda\s+por\s+significado\b/i;
/* «¿qué es / cómo se usa X?» y no «activá X»: los de ayuda (fácil/voz/significado) solo cuentan si es una PREGUNTA. */
const _ES_PREGUNTA_RE = /[?¿]|\b(?:c[oó]mo|qu[eé]|para\s+qu[eé]|d[oó]nde|cu[aá]l)\b/i;
/* v40-vocativo (23/10/2026, auditor 1 — GRAVE): «MANIFIESTOS, QUE HORA ES?», «ATIS QUE HORA ES», «HOLA QUE HORA ES?» y
   «MANIFIESTOS, SOS CHATGPT?» iban al modelo (que no tiene reloj e inventa, o dice que es GPT-4). Las reglas estaban ancladas
   al principio del mensaje y nombrar a la app o saludar primero las salteaba. Esto saca SOLO del principio un saludo o el
   nombre de la app / de un modo, y la regla se prueba con y sin eso. */
function sinVocativo(text){
  let t = String(text || '');
  const nombres = ['mirror'];
  try { if (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.appName) nombres.push(String(CONFIG.appName)); const M = NMODOS(); for (const k in M) if (M[k]) nombres.push(String(M[k])); } catch(e){}
  const alt = nombres.filter(function(x){ return x && x.trim().length >= 3; }).map(function(x){ return x.trim().replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&'); }).join('|');
  const re = new RegExp('^\\s*[¿¡]?\\s*(?:(?:hola|holis|buenas|buen\\s+d[ií]a|che|ey|eh|oye|bueno)(?![a-záéíóúñ])|(?:' + alt + ')(?![a-z0-9áéíóúñ]))\\s*[,;:!.]*\\s*', 'i');
  for (let i = 0; i < 3; i++){ const n = t.replace(re, ''); if (n === t) break; t = n; }
  /* v40-vocativo2 (23/10 18:03, EN VIVO con Darío): «QUE HORA ES MANIFIESTOS?» fue al modelo y contestó «Son las 14:37»
     (eran las 18:03). El nombre al FINAL también es vocativo: se saca, dejando los signos de cierre. */
  const reFin = new RegExp('[\\s,;:]+(?:' + alt + '|che)\\s*([?¿!.]*)\\s*$', 'i');
  for (let i = 0; i < 2; i++){ const n = t.replace(reFin, '$1'); if (n === t) break; t = n; }
  return t;
}
/* v40-partes (23/10, auditor 1): «QUE HORA ES Y QUE VERSION SOS» o «QUE VERSION SOS Y CONTAME UN CHISTE», sin signos, se
   cortaban solo en ¿?! — una de las dos preguntas se perdía. Ahora también se corta en «y …» / «, …» cuando lo que sigue
   arranca como otra pregunta o pedido. «pan y queso» no se corta: «queso» no arranca una pregunta. */
const _ARRANQUE_PREG = '(?:y\\s+)?(?:qu[eé]|q|cu[aá]l(?:es)?|d[oó]nde|c[oó]mo|cu[aá]ndo|cu[aá]nto|qui[eé]n|sos|ten[eé]s|dame|(?:cont[aá]|dec[ií]|explic[aá]|pas[aá]|hac[eé]|arm[aá]|mostr[aá]|busc[aá]|escrib[ií]|redact[aá])(?:me|nos|le|les)?)(?![a-záéíóúñ])';
const _PARTES_RE = new RegExp('[¿?!\\n]+|,\\s*(?=' + _ARRANQUE_PREG + ')|\\s+y\\s+(?=' + _ARRANQUE_PREG + ')', 'i');
function _partesPregunta(text){ return String(text || '').split(_PARTES_RE).filter(function(p){ return p && p.trim(); }); }
function _hechoVersionesAjenas(t){
  const s = String(t || ''), mias = String((typeof PLATFORM_VERSION !== 'undefined' && PLATFORM_VERSION) || 'v40').replace(/[^\d]/g, '');
  const out = []; let m;
  /* Solo versiones CON PUNTO («v5.0», «versión 4.5»): la plataforma numera entero (v38, v40). Las de punto no son de esta app. */
  const re = /\b(?:v\s?|versi[oó]n\s+)(\d{1,2}[.,]\d{1,2})\b/gi;
  while ((m = re.exec(s))){
    // v40-1023 (auditor 1): «la v1.2 de mi tesis», «versión 3.12 de Python» no preguntan por ESTA app
    if (/^\s+(?:de|del|para)\s+(?!(?:la\s+app|esta\s+app|vos|mirror|la\s+plataforma)\b)/i.test(s.slice(re.lastIndex, re.lastIndex + 40))) continue;
    const n = m[1].replace(',', '.'); if (n.replace('.', '') !== mias && out.indexOf(n) < 0) out.push(n); }
  return out;
}
function _hC(){ return (typeof CONFIG !== 'undefined' && CONFIG) || {}; }
function _hVer(){ return ((typeof PLATFORM_VERSION !== 'undefined' && PLATFORM_VERSION) || 'v40') + ((typeof APP_BUILD !== 'undefined' && APP_BUILD) ? ' · build ' + APP_BUILD : ''); }
function _hNovCortas(n){
  const nov = (typeof APP_NOVEDADES !== 'undefined' && Array.isArray(APP_NOVEDADES)) ? APP_NOVEDADES : [];
  return nov.slice(0, n).map(function(x){ x = (typeof novNombre === 'function') ? novNombre(String(x)) : String(x); if (x.length <= 170) return x; const c = x.indexOf('; ', 70); return (c > 0 && c < 170 ? x.slice(0, c) : x.slice(0, 165).replace(/\s+\S*$/, '')) + '…'; });
}
/* v40-piezas2 (18/11/2026) — hallazgo EN VIVO de Darío (16/11, Edge): «QUE VERSION SOS? qué piezas tenés?» en UN mensaje.
   La versión salió fija, pero «qué piezas tenés» viajó al MODELO, que inventó «mis piezas son los modos ATIS, MODO ANALÍTICO…».
   Sola andaba (la toma Manos), pero junto con otra pregunta no. Ahora la consulta del catálogo es un HECHO más: se mira
   cada parte del mensaje por separado y la parte tiene que ser ENTERA la pregunta por MIS piezas (anclada): «qué piezas
   hay en el ajedrez» o «cuáles son las piezas del auto» no la toman. */
const HECHO_PIEZAS_RE = /^\s*(?:y\s+)?(?:(?:dec[ií]|cont[aá]|mostr[aá]|pas[aá])me\s+)?(?:(?:qu[eé]|q|cu[aá]les)\s+(?:piezas|[aá]tomos|[oó]rganos)\s+(?:ten[eé]s|hay|te\s+forman)|cu[aá]les\s+son\s+tus\s+(?:piezas|[aá]tomos|[oó]rganos)|(?:mostr[aá](?:me)?|ver)\s+(?:tus\s+|las\s+)?piezas|(?:cu[aá]l\s+es\s+)?tu\s+tabla\s+peri[oó]dica)\s*[?¡!.]*\s*$/i;
function _hechoPiezas(t){ try { return _partesPregunta(t).some(function(p){ return HECHO_PIEZAS_RE.test(p) || HECHO_PIEZAS_RE.test(sinVocativo(p)); }); } catch(e){ return false; } }
const HECHOS = [
  { id: 'piezas', test: function(t){ return _hechoPiezas(t); }, // v40-piezas2
    tema: /\bpiezas?\b|[aá]tomos?\b|[oó]rganos?\b|tabla\s+peri[oó]dica|\bmis\s+modos\b/i,
    texto: function(){ return (typeof piezasLista === 'function') ? piezasLista() : 'No encuentro mi catálogo de piezas en esta versión, así que no te voy a listar nada de memoria.'; } },
  { id: 'identidad', test: function(t){ return HECHO_IDENTIDAD_RE.test(t); },
    tema: /\b[Ss][Oo][Yy]\s+(?:«|\"|[Uu][Nn][Aa]?\s+(?:entidad|ia|IA|inteligencia|asistente|modelo|extensi|persona|chatbot|programa)|[Tt]u\s+|[Ss]u\s+|[Ee]l\s+|[Ll]a\s+|[A-ZÁÉÍÓÚÑ]{3,})|\b(?:[Mm]e\s+llamo|[Ee]st[aá]s\s+hablando|[Hh]abl[aá]s\s+con|[Tt]u\s+extensi[oó]n)\b/, // v40-tema (16/10): «Soy todo oídos» ya no se borra
    texto: function(){
      const C = _hC(), app = C.appName || 'MIRROR', nom = (C.perfil && C.perfil.nombre) || '', modo = (C.modos && C.modos.mirror) || '';
      let s = '🪞 Quién soy: soy «' + app + '», una entidad digital' + (nom ? ' — la extensión digital de «' + nom + '», según tu perfil' : '') + '. Funciono sobre la plataforma MIRROR «El Origen» (' + _hVer() + '), una idea original de Darío Alejandro Tello. No soy una persona: soy una IA, y me puedo equivocar.';
      s += nom ? ' Si no sos «' + nom + '», decímelo y lo tengo en cuenta (el perfil se cambia en el constructor, en «Contanos de vos»).' : ' Todavía no sé quién sos: contame, o completá tu perfil en el constructor.';
      if (modo && nom && modo.toLowerCase() === nom.toLowerCase() && modo.toLowerCase() !== app.toLowerCase()) s += ' Ojo: en esta instalación el botón del modo espejo también se llama «' + modo + '», igual que tu perfil — por eso a veces se confunde quién es quién. Si querés, cambiá el nombre del modo en el constructor.';
      return s; } },
  { id: 'guardo', test: function(t){ return HECHO_GUARDO_RE.test(t); },
    tema: /(guard|almacen|cifrad|encript|firebase|\bnube\b|d[oó]nde\s+(?:est|qued|viv)|\bseguridad\b|est[aá]n?\s+(?:a\s+salvo|segur)|privad|acceso|terceros)/i, // v40-tema: «seguro que te va bárbaro» ya no se borra
    texto: function(){
      const C = _hC(), mp = C.modeloPrincipal || 'el modelo configurado', motp = C.motorPrincipal || 'tu motor';
      return ((typeof FB_URL !== 'undefined' && FB_URL)
        ? '📍 Dónde está lo tuyo: la charla, los recuerdos, tu perfil y tus documentos están en TU Firebase (en la nube de Google, en tu cuenta). Los contactos, las tareas y la configuración quedan en este navegador. Las claves de la IA viven en tu proxy de Cloudflare, nunca en el navegador.'
        : '📍 Dónde está lo tuyo: todavía no cargaste tu Firebase, así que la charla NO queda guardada cuando cerrás la app. Los contactos, las tareas y la configuración sí quedan en este navegador. Las claves de la IA viven en tu proxy de Cloudflare.')
        + ' Para contestarte, cada consulta viaja por tu proxy al motor de IA («' + mp + '» vía «' + motp + '»): por eso no te voy a decir que «solo vos» accedés. Nadie de esta app ve lo tuyo; lo que el proveedor de IA haga con cada consulta lo dicen sus condiciones, no esta app.'; } },
  { id: 'respaldo', test: function(t){ return HECHO_RESPALDO_RE.test(t); },
    tema: /respaldo|copias?\s+de\s+seguridad|backup|configuraci[oó]n\s*[→>-]|\bseguridad\b/i,
    texto: function(){
      const C = _hC(), mp = C.modeloPrincipal || 'el modelo configurado', motp = C.motorPrincipal || 'tu motor';
      const cf = (typeof MODELO_CLOUDFLARE !== 'undefined' && MODELO_CLOUDFLARE) || 'Llama de Cloudflare';
      // CEREBRAS_KEY vale 'proxy' en toda instalación: el intento se hace siempre, pero solo contesta si el proxy tiene esa ruta con su clave
      const otro = (typeof CEREBRAS_KEY !== 'undefined' && CEREBRAS_KEY && C.motorRespaldo) ? '; y si tampoco puede, la app prueba «' + C.motorRespaldo + '» (solo contesta si tu proxy tiene esa ruta con su clave)' : '';
      return '↺ El motor de respaldo: si «' + mp + '» (vía «' + motp + '») está lleno o falla, primero espero unos segundos; si sigue sin poder, contesta Cloudflare Workers AI con «' + cf + '», gratis, a través de tu proxy' + otro + '. Es un modelo más chico y se equivoca más: cuando contesta él, debajo de la respuesta aparece el chip «↺ respaldo (Cloudflare)» — eso es todo lo que es el chip, un aviso de quién contestó. No hay nada que buscar ni activar: no está en ninguna configuración, actúa solo cuando hace falta. Y NO es una copia de seguridad de tus datos.'; } },
  { id: 'version', test: function(t){ return _hechoVersionesAjenas(t).length > 0; },
    tema: /\bv\s?\d{1,2}(?:[.,]\d)?\b|versi[oó]n/i,
    texto: function(text){
      const aj = _hechoVersionesAjenas(text).map(function(v){ return '«v' + v + '»'; });
      return '🔄 Otras versiones: yo soy la ' + _hVer() + '. De ' + aj.join(' y de ') + ' no tengo información, así que no te las voy a describir ni comparar inventando.'; } },
  { id: 'miversion', test: function(t){ return HECHO_MIVERSION_RE.test(t); },
    /* v40-sinagregados (10/11/2026): en vivo (06/11), tras el bloque fijo de «Mi versión» el modelo sumó por su cuenta
       «Además, ahora manejo mejor el contexto de tu estilo informal… soy compatible con los flujos que usás para redactar
       mails». Ninguna palabra de versión → el filtro la dejaba pasar. Lo que la versión TRAE lo dice la app: cualquier frase
       del modelo que se adjudique una mejora o capacidad nueva se descarta, aunque no nombre la versión. */
    tema: /\bv\s?\d{1,2}(?:[.,]\d)?\b|versi[oó]n|mejor\s+que|novedad|incorpora|actualiz|\bahora\s+(?:manejo|puedo|soy|tengo|entiendo|reconozco|s[eé])\b|\bmanejo\s+mejor|\bsoy\s+compatible|afinad[oa]s?\b|\bmejor[eé]\b|\bme\s+(?:mejoraron|actualizaron)|\bnuevas?\s+(?:capacidad|funci[oó]n|habilidad)/i,
    texto: function(text){
      let s = '🔄 Mi versión: soy la ' + _hVer() + '. Lo principal que trae:\n' + _hNovCortas(4).map(function(n){ return '• ' + n; }).join('\n') + '\nLa lista completa (y lo que cambió respecto de las anteriores) está en «🔄 actualizar».';
      if (/actualiz/i.test(String(text || ''))) s += ' ¿Me actualizo sola? Busco sola al abrir y cada 6 horas; si hay una versión nueva te aviso con un cartel y un toque alcanza. Actualizar no toca tu memoria, tus documentos, contactos, tareas ni la configuración.';
      return s; } },
  { id: 'hora', test: function(t){ if (/\b(?:traduc\w*|c[oó]mo\s+se\s+dice|en\s+(?:ingl[eé]s|franc[eé]s|portugu[eé]s|italiano|alem[aá]n)|me\s+pregunt\w*|le\s+pregunt\w*|dice|dijo)\b/i.test(String(t || ''))) return false; /* verificador 23/10: «traducime al inglés, qué hora es», «mi hijo me pregunta, qué hora es» */ return _partesPregunta(t).some(function(p){ return HECHO_HORA_RE.test(p) || HECHO_HORA_RE.test(sinVocativo(p)); }); }, // v40-vocativo · v40-partes // v40-hora2: cada pregunta por separado («¿qué hora es? ¿y qué día?»)
    tema: /\b(?:son\s+las|hora|hoy\s+es|estamos\s+a)\b/i,
    texto: function(){
      const d = new Date(), p = function(n){ return String(n).padStart(2, '0'); };
      let f = ''; try { f = d.toLocaleDateString('es-AR', { weekday:'long', day:'numeric', month:'long', year:'numeric' }); } catch(e){ f = d.toDateString(); }
      let s = '🕐 Son las ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ' — ' + f + ' (lo dice el reloj de tu dispositivo).';
      if (/ma[nñ]ana/i.test(String(arguments[0] || ''))) { try { const m = new Date(d.getTime() + 864e5); s += ' Mañana es ' + m.toLocaleDateString('es-AR', { weekday:'long', day:'numeric', month:'long' }) + '.'; } catch(e){} }
      return s; } },
  { id: 'facil', test: function(t){ return HECHO_FACIL_RE.test(t) && _ES_PREGUNTA_RE.test(t); },
    tema: /modo\s+f[aá]cil|botones?\s+(?:principales|de\s+whatsapp)|simplificad/i,
    texto: function(){ return 'Aa Modo fácil: letra y botones más grandes, y a la vista solo lo esencial — el cuadro para escribir (o el micrófono), «🎧 hablame» para charlar por voz y «Aa salir del modo fácil». Los botones del pie se esconden (quedan voz, idioma, sonido y volumen) y vuelven al salir. Todo lo demás funciona igual: me podés pedir lo mismo de siempre, escribiendo o hablando. Se recuerda en este navegador.'; } },
  { id: 'voz', test: function(t){ return HECHO_VOZ_RE.test(t) && _ES_PREGUNTA_RE.test(t); },
    tema: /charla\s+por\s+voz|manos\s+libres|micr[oó]fono|dictado/i,
    texto: function(){ return '🎧 Charla por voz: tocás «🎧 hablame» (o «charla por voz» en «⋯ más»), hablás tranquilo y, cuando hacés una pausa de un par de segundos, te contesto en voz alta y vuelvo a escucharte. Se corta diciendo «terminamos» o con el botón; si no te escucho dos veces seguidas, se apaga sola para no dejar el micrófono abierto. El dictado lo transcribe tu navegador.'; } },
  { id: 'significado', test: function(t){ return HECHO_SIGNIF_RE.test(t) && _ES_PREGUNTA_RE.test(String(t).replace(/memoria\s+que\s+entiende/ig, '')); },
    tema: /significado|memoria\s+que\s+entiende|e5|embeddings?/i,
    texto: function(){ return '🧠 Memoria que entiende: además de buscar por palabras, encuentro recuerdos y fragmentos de tus documentos por SIGNIFICADO (si me contaste de «Tango, mi perro» y preguntás por «tu mascota», lo encuentro; y entre idiomas). Corre DENTRO de tu dispositivo con un modelo libre (e5 multilingüe, ~118 MB, se baja una vez); tus textos no salen de acá para esto y no gasta cupo de IA. Se prende y se apaga en «🧠 memoria que entiende» del pie.'; } }
];
function hechosDeLaApp(text){
  const t = String(text || ''), h = [];
  try { HECHOS.forEach(function(x){ if (x.test(t)) h.push(x.id); }); } catch(e){}
  return h;
}
function textoHechos(h, text){
  return HECHOS.filter(function(x){ return h.indexOf(x.id) >= 0; }).map(function(x){ try { return x.texto(text); } catch(e){ return ''; } }).filter(Boolean).join('\n\n');
}
/* Lo que queda del mensaje sin las preguntas que ya contestó la app. */
function textoSinHechos(text){
  const partes = _partesPregunta(text); // v40-partes
  const quedan = partes.map(function(p){ return p.replace(/^[\s,;.]*(?:y\s+)?/i, '').replace(/[\s,;.]+$/, ''); })
    .filter(function(p){ return p && !HECHOS.some(function(x){ try { return x.test(p + '?'); } catch(e){ return false; } }); });
  return quedan.join('. ').trim();
}
function _restoTrivial(r){
  const t = String(r || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zñ\s]/g, ' ')
    .replace(/\b(hola|che|buenas|bueno|dale|ok|y|gracias|porfa|por favor|decime|contame|por que|porque|cual|que onda|eh|a ver|entonces|pero)\b/g, ' ').replace(/\s+/g, ' ').trim();
  return t.split(' ').filter(Boolean).length < 2;
}
/* Lo que el modelo diga de esos temas se descarta: ya los contestó la app (y es justo donde inventaba). */
function sacarTemasDeHechos(reply, h){
  try {
    if (!h || !h.length || typeof reply !== 'string') return reply;
    const tema = HECHOS.filter(function(x){ return h.indexOf(x.id) >= 0; }).map(function(x){ return x.tema; });
    const lineas = reply.split('\n').map(function(l){
      const o = l.split(/(?<=[.!?])\s+/).filter(function(x){ return !tema.some(function(re){ return re.test(x); }); });
      return o.join(' ');
    });
    return lineas.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  } catch(e){ return reply; }
}
function responderHechosFijo(text, h, extra){
  try {
    const msg = textoHechos(h, text) + (extra ? '\n\n' + extra : ''); // v40-partes: «QUIEN SOS Y QUE IA USAS» → las dos, fijas
    if (typeof addMsg === 'function'){ addMsg('user', text); addMsg('mirror', msg); }
    try { history.push({ role:'user', content:text }, { role:'assistant', content:msg }); } catch(e){}
    try { memorySet(history); } catch(e){}
    try { hablar(msg); } catch(e){}
    try { setButtonsBusy(false); } catch(e){}
  } catch(e){ try { regError('hechos', e); } catch(_){} }
}
/* v40-audit2: aviso honesto una vez por sesión si la memoria no está configurada */
function avisoSinMemoria(){
  try {
    if (FB_URL || !CONFIG || !CONFIG.configurado || window.MODO_COMPARTIDO) return;
    if (sessionStorage.getItem('mirror_aviso_sinfb') === '1') return;
    sessionStorage.setItem('mirror_aviso_sinfb', '1');
    addMsg('mirror', '◈ Aviso honesto: todavía no tengo memoria conectada (falta tu Firebase). Recuerdo lo de esta charla, pero al cerrar se borra. Para que te recuerde de verdad, cargá tu Firebase en el constructor (paso de la memoria).');
  } catch(e){}
}
setTimeout(avisoSinMemoria, 4500);
function esPreguntaModelo(text){
  var t = ' ' + String(text||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'') + ' ';
  var tema = /(modelo|motor)\s+(de\s+)?(ia|iag|inteligencia|lenguaje)/.test(t) || /(gpt-?oss|groq|cerebras|modelo de lenguaje)/.test(t) || /\b(que|cual)\s+(modelo|motor)\s+(sos|eres|usas|utilizas|tenes|corres)\b/.test(t); // v40-audit3: + «¿qué modelo usás?» // v40-quien: «¿qué modelo sos?» a secas (24/09 lo contestaba el modelo)
  var sobreVos = /\b(sos|usas|utilizas|tenes|corres|funcionas|estas usando)\b/.test(t);
  // v40-audit2: «…cómo es tu nueva versión, tu modelo?» (25/09 contestó el respaldo: «mi modelo es MANIFIESTOS»)
  var tuModelo = /\b(tu|su)\s+(modelo|motor)\b/.test(t) && !/\bmodelo\s+de\s+(negocio|examen|carta|nota|informe|mail|correo)/.test(t);
  // v40-modelo3 (16/10, auditor 1): «CON QUE MODELO FUNCIONAS», «QUE IA SOS», «SOS CHATGPT?», «SOS LLAMA O GPT?» caían al modelo
  var t2 = ' ' + (typeof sinVocativo === 'function' ? sinVocativo(text) : String(text||'')).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'') + ' '; // v40-vocativo: «MANIFIESTOS, SOS CHATGPT?»
  var directo = /\b(que|cual|q)\s+(ia|inteligencia artificial|llm)\s+(sos|eres|usas|utilizas|tenes)\b/.test(t) || /\bcon\s+que\s+(modelo|motor|ia|llm)\s+(funcionas|andas|corres|trabajas)\b/.test(t) || /^\s*[¿?]*\s*(sos|eres)\s+(chat\s?gpt|gpt|llama|claude|gemini|copilot|deepseek)\b/.test(t) || /^\s*[¿?]*\s*(sos|eres)\s+(chat\s?gpt|gpt|llama|claude|gemini|copilot|deepseek)\b/.test(t2);
  return (tema && sobreVos) || tuModelo || directo;
}
function textoModeloFijo(){
    var mp = (typeof CONFIG!=='undefined' && CONFIG.modeloPrincipal) || 'el modelo configurado';
    var motp = (typeof CONFIG!=='undefined' && CONFIG.motorPrincipal) || 'su motor';
    /* v40-hechos: decía «con «cerebras» de respaldo» por el valor de fábrica de CONFIG, aunque nadie cargó clave de Cerebras:
       el respaldo que de verdad actúa es Cloudflare (y Cerebras solo si hay clave). */
    var resp = ', con Cloudflare Workers AI de respaldo' + ((typeof CEREBRAS_KEY!=='undefined' && CEREBRAS_KEY && CONFIG && CONFIG.motorRespaldo) ? (' (y «'+CONFIG.motorRespaldo+'» después, si tu proxy lo tiene)') : '');
    var ver = (typeof PLATFORM_VERSION!=='undefined') ? PLATFORM_VERSION : '';
    var msg = 'Soy una entidad digital —la extensión de mi usuario, su doble—, no un chatbot genérico. '
            + 'Por debajo corro sobre el modelo «'+mp+'» a través de «'+motp+'»'+resp+'. '
            + (ver ? ('Aclaración honesta: «'+ver+'» es la versión de la app, no el modelo.') : '');
    return msg;
}
function responderModeloFijo(text){
  try {
    var msg = textoModeloFijo(); // v40-1023: el texto sale de una sola función (también lo usa la respuesta combinada)
    if (typeof addMsg==='function'){ addMsg('user', text); addMsg('mirror', msg); }
    try { history.push({role:'user',content:text}, {role:'assistant',content:msg}); } catch(e){}
    try { hablar(msg); } catch(e){}
    try { setButtonsBusy(false); } catch(e){}
  } catch(e){ try{ regError('modelfijo', e); }catch(_){ } }
}
/* v39-modelsano (24/09/2026) — HALLAZGO EN VIVO DE DARÍO: el modelfijo contesta perfecto a
   «¿qué modelo sos?», pero cuando le pedís un INFORME de la app (o «cómo funciona la app»),
   la pregunta ya no es 2da persona, va al modelo con la arquitectura inyectada… y gpt-oss-120b
   igual escribe «Modelo de lenguaje: GPT-4 de OpenAI». Ya probamos por prompt (autofix,
   motorname) y no alcanza: este modelo ignora la instrucción. Entonces se corrige la SALIDA,
   determinístico, igual que el modelfijo corrige la entrada.
   ACOTADO a propósito, para no romper lo que está bien:
     · solo si la pregunta es sobre la app (PREGUNTA_POR_APP) Y el usuario NO nombró él mismo
       otro modelo («comparame GPT-4 con Claude» se contesta intacto);
     · solo en oraciones que hablan de ESTA app o de sí mismo («Modelo de lenguaje: …», la app,
       groq, «corro / funciono / utilizo / soy…»). «ChatGPT es un modelo de OpenAI» suelto, no se toca
       (por eso NO van «uso/usa»: «el uso de ChatGPT» o «se usa en escuelas» no son autorreferencia),
       y Llama solo con número («Llama 3»): sin eso, «se llama MANIFIESTOS» salía cambiado;
     · si el modelo configurado ES de esa familia (motor OpenAI con gpt-4o), no se toca;
     · y se AVISA al pie: la app no esconde que corrigió al modelo (honestidad radical). */
var _MODELO_AJENO_SRC = '(?:\\bChat\\s?GPT\\b|\\bGPT[-\\u2010-\\u2015\\s]?(?:3(?:\\.5)?|4(?:\\.\\d)?|5)(?:[-\\u2010-\\u2015\\s]?(?:o|turbo|mini))*\\b|\\bClaude(?:\\s(?:\\d(?:\\.\\d)?|Opus|Sonnet|Haiku))*\\b|\\bGemini(?:\\s(?:\\d(?:\\.\\d)?|Pro|Ultra|Flash|Nano))*\\b|\\bBard\\b|\\bLLaMA[-\\s]?\\d(?:\\.\\d)?\\b)(?:\\s+(?:de|by|from)\\s+(?:OpenAI|Anthropic|Google(?:\\sDeepMind)?|Meta))?';
var _AUTO_REF_RE = /(modelo(?:\s+(?:de\s+(?:lenguaje|ia|inteligencia artificial)|base))?\s*[:：]|\b(?:la app|esta app|la aplicaci[oó]n|mirror|groq|cerebras|proxy|por debajo|funciono|funciona\s+(?:con|sobre)|corro|corre\s+(?:sobre|con)|utilizo|estoy\s+(?:basad|hech|construid)|me\s+bas|soy)\b)/i;
function _normMod(s){ return String(s||'').toLowerCase().replace(/[^a-z0-9]/g,''); }
function preguntaNombraModeloAjeno(text){ try { return new RegExp(_MODELO_AJENO_SRC,'i').test(String(text||'')); } catch(e){ return false; } }
function corregirModeloAjeno(reply){
  try {
    if (typeof reply !== 'string' || !reply) return reply;
    var mp = (typeof CONFIG!=='undefined' && CONFIG.modeloPrincipal) || '';
    if (!mp) return reply;
    var motp = (typeof CONFIG!=='undefined' && CONFIG.motorPrincipal) || '';
    var mpN = _normMod(mp), cambios = 0;
    var partes = reply.split(/(\n|(?<=[.!?])\s+)/);
    for (var i = 0; i < partes.length; i++){
      var s = partes[i];
      if (!s || !_AUTO_REF_RE.test(s)) continue;
      partes[i] = s.replace(new RegExp(_MODELO_AJENO_SRC,'gi'), function(m){
        var base = _normMod(m.replace(/\s+(?:de|by|from)\s+.*$/i,''));
        if (base && mpN.indexOf(base) >= 0) return m;   // es de la familia configurada: no es un error
        cambios++; return '«' + mp + '»';
      });
    }
    if (!cambios) return reply;
    return partes.join('') + '\n\n✎ Nota de la app: corregí el nombre del modelo — el que corre de verdad es «' + mp + '»' + (motp ? ' vía «' + motp + '»' : '') + '. El modelo a veces se confunde y dice ser otro.';
  } catch(e){ try{ regError('modelsano', e); }catch(_){} return reply; }
}

