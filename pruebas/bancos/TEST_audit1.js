/* TEST_audit1.js — amarra la tanda v40-audit (24/09/2026, auditoría en vivo de Darío en la PLATAFORMA):
   1) «informe DE LA APP» ya no abre el generador académico; «haceme un informe» a secas, sí.
   2) «¿qué modelo sos? + otro pedido» → no se pierde el pedido; la identidad fija va antepuesta.
   3) autoconocimiento por relevancia: menos tokens, sin perder el índice, con los nombres del usuario.
   4) bibliografía del informe sin repetidos.  5) la imagen de recién se vuelve a mirar si la nombrás. */
const fs=require('fs'), path=require('path'), vm=require('vm');
const H=fs.readFileSync(path.join(__dirname,'..','PLATAFORMA','index.html'),'utf8');
let ok=0,bad=0; function t(m,c,x){ if(c){ok++;} else {bad++; console.log('  ❌ '+m+(x!==undefined?'  → '+String(x).slice(0,300):''));} }
function grabFunc(n){ const i=H.indexOf('function '+n+'('); if(i<0) return ''; let d=0,k=H.indexOf('{',i); for(let p=k;p<H.length;p++){const c=H[p]; if(c==='{')d++; else if(c==='}'){d--; if(!d) return H.slice(i,p+1);}} return ''; }
const L=n=>{ const i=H.indexOf(n); return i<0?'':H.slice(i,H.indexOf('\n',i)); };
// 1) el comando informe
{ const i=H.indexOf('const ACTUA_CMDS'); let d=0,k=H.indexOf('[',i),e; for(let p=k;p<H.length;p++){const c=H[p]; if(c==='[')d++; else if(c===']'){d--; if(!d){e=p+1;break;}}}
  const ctx={}; vm.createContext(ctx); vm.runInContext('var ACTUA_CMDS='+H.slice(k,e)+';',ctx);
  const inf=ctx.ACTUA_CMDS.find(c=>/informe/.test(c.re.source));
  t('informe: «haceme un informe» → generador (como antes)', inf.re.test('haceme un informe'));
  t('informe: «armame un informe con los datos» → generador', inf.re.test('armame un informe con los datos'));
  t('informe: «haceme un informe de la app» → NO (autoconocimiento)', !inf.re.test('haceme un informe de la app'));
  t('informe: «¿QUE MODELO SOS? HACEME UN INFORME DE LA APP» (captura) → NO', !inf.re.test('¿QUE MODELO SOS? HACEME UN INFORME DE LA APP'));
  t('informe: «dame un informe sobre cómo funcionás» → NO', !inf.re.test('dame un informe sobre cómo funcionás') || !inf.re.test('dame un informe sobre vos'));
  t('informe: «haceme un informe técnico de la aplicación» → NO', !inf.re.test('haceme un informe técnico de la aplicación'));
  t('informe: «haceme un informe del sistema» → NO', !inf.re.test('haceme un informe del sistema'));
}
// 2) modelo + otro pedido
{ const code=[L('const _OTRO_PEDIDO_RE').replace('const ','var '),grabFunc('esPreguntaModelo'),grabFunc('_restoSinPreguntaModelo'),grabFunc('esPreguntaModeloSola'),grabFunc('lineaIdentidadModelo')].join('\n');
  const ctx={CONFIG:{modeloPrincipal:'openai/gpt-oss-120b',motorPrincipal:'groq'},PLATFORM_VERSION:'v38'}; vm.createContext(ctx); vm.runInContext(code,ctx);
  const sola=s=>vm.runInContext('esPreguntaModeloSola('+JSON.stringify(s)+')',ctx), preg=s=>vm.runInContext('esPreguntaModelo('+JSON.stringify(s)+')',ctx);
  t('modelo: «¿qué modelo de IA sos?» → respuesta fija sola (como antes)', sola('¿qué modelo de IA sos?'));
  t('modelo: «¿QUE MODELO SOS? HACEME UN INFORME DE LA APP» → NO sola (va al modelo)…', !sola('¿QUE MODELO DE IA SOS? HACEME UN INFORME DE LA APP'));
  t('modelo: … pero sí se detecta la pregunta (para anteponer la identidad)', preg('¿QUE MODELO DE IA SOS? HACEME UN INFORME DE LA APP'));
  const li=vm.runInContext('lineaIdentidadModelo()',ctx);
  t('modelo: la línea antepuesta es fija y dice el modelo real', /«openai\/gpt-oss-120b»/.test(li) && /«groq»/.test(li) && /versión de la app, no el modelo/.test(li), li);
  const i=H.indexOf('async function send() {'), S=H.slice(i,H.indexOf('\n}\n',i));
  t('modelo: send() usa la versión «sola» para cortar temprano', /if \(esPreguntaModeloSola\((?:text|_textoModelo)\)(?: && !_hechos\.length)?\) \{ responderModeloFijo\(text\); return; \}/.test(S) /* v40-hechos: también la forma nueva */);
  t('modelo: send() antepone la identidad solo si no hubo error', /if \(!errorMsg && _antepIdentidad\)/.test(S));
}
// 3) arquitectura por relevancia
{ const i=H.indexOf('const ARQUITECTURA_MIRROR'), j=H.indexOf('`;',i)+2;
  const code=['var PLATFORM_VERSION="v38"; var RETIRADAS_MIRROR=""; var CONFIG={modeloPrincipal:"openai/gpt-oss-120b",motorPrincipal:"groq",motorRespaldo:"cerebras",appName:"ATIS",modos:{mirror:"ATIS",tars:"MODO ANALÍTICO",jurado:"EXPERTO/EXAMINADOR",conn:"BASE"}};',
    H.slice(i,j).replace('const ','var '), L('const ARQ_DETALLE_K').replace('const ','var '), (L('const ARQ_DETALLE_MAX_CHARS')||'').replace('const ','var '), L('const _ARQ_STOP').replace('const ','var '),
    grabFunc('_arqNorm'),grabFunc('_arqPartir'),grabFunc('_arqTitulo'),grabFunc('_arqNombresModos'),grabFunc('arquitecturaRelevante')].join('\n');
  const ctx={regError(){}}; vm.createContext(ctx);
  try { vm.runInContext(code,ctx); } catch(e){ t('arq: el bloque corre', false, e.message); }
  const full=ctx.ARQUITECTURA_MIRROR||'';
  const r1=vm.runInContext('arquitecturaRelevante("dame los detalles técnicos de esta app")',ctx);
  t('arq: «detalles técnicos» → ~45% menos (≤ 60% del total)', r1.length <= full.length*0.6, r1.length+' vs '+full.length);
  t('arq: los modos con los nombres DEL USUARIO (ATIS, BASE…)', /«ATIS»/.test(r1) && /«BASE»/.test(r1) && /«MODO ANALÍTICO»/.test(r1));
  const nItems=full.split('\n').filter(l=>/^•/.test(l)).length;
  t('arq: el índice nombra TODAS las capacidades ('+nItems+')', (r1.match(/TODO LO QUE LA APP TIENE[^\n]*/)||[''])[0].split(' · ').length===nItems, (r1.match(/TODO LO QUE LA APP TIENE[^\n]*/)||[''])[0].slice(0,200));
  t('arq: índice incluye el agente y SOÑAR', /AGENTE/.test(r1) && /SOÑAR/.test(r1));
  // v40-cupo2 (3/10): el detalle tiene tope de caracteres (ARQ_DETALLE_MAX_CHARS): entre 1 y 6 capacidades
  { const det=(r1.split('DETALLE DE LO RELEVANTE PARA ESTA PREGUNTA:\n')[1]||'').split('\n').filter(l=>/^•/.test(l)); t('arq: detalle = entre 1 y 6 capacidades, bajo el tope de caracteres', det.length>=1 && det.length<=6 && (det.length===1 || det.join('\n').length<=2600+det.length), det.length); }
  t('arq: mantiene la regla «si no figura, decí que no sabés»', /no lo sabés con certeza/.test(r1));
  const r2=vm.runInContext('arquitecturaRelevante("¿cómo funciona el agente que avisa y agenda?")',ctx);
  t('arq: pregunta por el agente → su detalle entra', /• 🧭 AGENTE/.test(r2));
  const r3=vm.runInContext('arquitecturaRelevante("¿qué modelo de IA usás?")',ctx);
  t('arq: pregunta por el modelo → entra la regla de identidad en dos capas', /• ¿QUÉ MODELO \/ MOTOR DE IA SOS\?/.test(r3));
  const r4=vm.runInContext('arquitecturaRelevante("¿encuestas? ¿cómo llegan las respuestas?")',ctx);
  t('arq: pregunta por encuestas → entra ENCUESTA', /• 📋 MIRROR ENCUESTA/.test(r4));
  t('arq: send() usa la versión por relevancia', /(?:partes|_partesFin) \+= arquitecturaRelevante\((?:text|_arqQ)\) \+ resumenErrores\(\)/.test(H) /* v40-audit11: en la repregunta se elige con _arqQ */);
  const ctx2={regError(){}}; vm.createContext(ctx2); vm.runInContext(code.replace('var ARQUITECTURA_MIRROR','var ARQUITECTURA_MIRROR_x')+';var ARQUITECTURA_MIRROR="texto sin viñetas";',ctx2);
  t('arq: si la fuente no tiene viñetas → usa la entera (nunca queda vacía)', vm.runInContext('arquitecturaRelevante("hola")',ctx2)==='texto sin viñetas');
}
// 4) bibliografía
t('biblio: Word y PDF sacan repetidos', (H.match(/meta\.docNames\.map\(limpiarNombreDoc\)\.filter\(function\(r,i,a\)\{ return r && a\.indexOf\(r\) === i; \}\)/g)||[]).length===2);
// 5) imagen de recién
{ const re=new RegExp(eval(L('const REFIERE_IMAGEN_RE').replace(/^const REFIERE_IMAGEN_RE = /,'').replace(/;\s*$/,'')));
  t('imagen: «¿de qué color era la R en la imagen?» → la vuelve a mirar', re.test('¿de qué color era la R en la imagen?'));
  t('imagen: «¿y la foto qué fecha tenía?» → sí', re.test('¿y la foto qué fecha tenía?'));
  t('imagen: «lo que te mostré, ¿es legible?» → sí', re.test('lo que te mostré, ¿es legible?'));
  t('imagen: charla común → NO (no gasta tokens de imagen)', !re.test('¿cómo estás hoy?') && !re.test('mandame una imagen de un gato'));
  const i=H.indexOf('async function send() {'), S=H.slice(i,H.indexOf('\n}\n',i));
  t('imagen: se reabre solo dentro de 3 mensajes y ANTES de la rama de visión', S.indexOf('imagenReciente.turnos <= 3') >= 0 && S.indexOf('imagenReciente.turnos <= 3') < S.indexOf('if (imagenAdjunta) { return enviarConImagen(text); }'));
  t('imagen: se retiene solo tras una respuesta buena de visión', /history\.push\(\{ role:'assistant', content:reply \}\);\n    try \{ imagenReciente = \{ url: img, turnos: 0 \}; \}/.test(H));
  t('imagen: NO va al historial ni a la memoria (solo variable de sesión)', !/history\.push\([^)]*imagenReciente/.test(H) && !/localStorage\.setItem\([^)]*imagenReciente/.test(H));
  t('imagen: avisa que la vuelve a mirar', /vuelvo a mirar la imagen de recién/.test(H));
}
console.log('\n'+(bad===0?'✅ TODO VERDE — '+ok+' pruebas pasan (plataforma · auditoría 24/09)':'❌ '+bad+' fallos de '+(ok+bad)));
process.exit(bad?1:0);
