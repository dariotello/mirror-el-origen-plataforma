/* TEST_pulido.js — amarra la tanda de pulidos v39 en la PLATAFORMA:
   A) imágenes honestas (Pollinations dejó de ser gratis), B) link ?constructor fuerza el asistente,
   C) autoconocimiento dice el MOTOR real (no "v38") y la voz honesta. MIRROR va aparte (congelado). */
const fs=require('fs'), path=require('path');
const H=fs.readFileSync(path.join(__dirname,'..','PLATAFORMA','index.html'),'utf8');
let ok=0,bad=0; function t(m,c,e){ if(c){ok++;console.log('  ✅ '+m);} else {bad++;console.log('  ❌ '+m+(e?'  → '+e:''));} }
console.log('\n━━━ PLATAFORMA · v39-pulido ━━━');
// A) imágenes
t('A: el modal NO dice más "Es gratis" para imágenes', !/✓ Es gratis: registrate/.test(H));
t('A: el modal declara que Pollinations es PAGO', /hoy es PAGO/.test(H) && /Pollinations dejó de ser gratis/.test(H));
t('A: el error 402 NO promete "tier gratis"', !/grant diario de tu tier gratis/.test(H));
t('A: el error 402 dice que es un servicio pago', /Pollinations es un servicio pago/.test(H));
// B) constructor link
t('B: existe window._forzarConstructor', /window\._forzarConstructor = function\(\)/.test(H));
// v39-consvisit (24/09): la condición creció (+ la puerta de Visit, ver TEST_consvisit.js); el forzado sigue adentro.
t('B: MIRROR_necesitaConfig usa el forzado', /MIRROR_necesitaConfig = \(!CONFIG\.configurado \|\| window\._forzarConstructor\(\)( \|\| !window\._abrirDirecto\(\))?\)/.test(H));
t('B: lanzarConstructorTrasBoot usa el forzado', /if \(!CONFIG\.configurado \|\| window\._forzarConstructor\(\)( \|\| !window\._abrirDirecto\(\))?\)\{/.test(H));
// B) — self-test de la regex del link (misma que el código)
const reCons = /[?&#]constructor(?=$|[=&])/i;
const casos = [['?constructor',true],['?constructor=1',true],['#constructor',true],['?foo=1&constructor',true],['?otracosa',false],['?constructorX',false],['',false]];
let regexOk=true, det='';
for(const [q,esp] of casos){ if(reCons.test(q)!==esp){ regexOk=false; det+=q+'→'+reCons.test(q)+'(esp '+esp+') '; } }
t('B: el ?constructor matchea bien (y no falsos positivos)', regexOk, det);
// C) autoconocimiento
t('C: el autoconocimiento nombra el MODELO real (interpola CONFIG.modeloPrincipal)', /modelo «\$\{CONFIG\.modeloPrincipal\}»/.test(H));
t('C: aclara versión-app ≠ modelo', H.indexOf('es la VERSIÓN de la app, no el modelo')>=0);
t('C: molde de DOS CAPAS (identidad + modelo por debajo)', H.indexOf('contestá SIEMPRE en DOS CAPAS')>=0 && H.indexOf('por debajo corro sobre ${CONFIG.modeloPrincipal} vía ${CONFIG.motorPrincipal}')>=0);
t('C: prohíbe confabular (GPT-4 / negar ser IA)', H.indexOf('PROHIBIDO')>=0 && H.indexOf('GPT-4')>=0);
t('C: la voz se declara Web Speech API (no servidor de la app)', /La VOZ usa la Web Speech API del navegador\/sistema operativo/.test(H));
t('C: prohíbe inventar que la voz "se procesa en un servidor de MIRROR"', /NUNCA inventes que la voz «se procesa en un servidor de MIRROR»/.test(H));
// C-DISPARADOR (v39-autofix): que las preguntas por el modelo/motor/voz DISPAREN el autoconocimiento
const mP = H.match(/const PREGUNTA_POR_APP = \/(.+?)\/i;/);
t('C-trigger: existe PREGUNTA_POR_APP', !!mP);
if (mP){
  const reApp = new RegExp(mP[1], 'i');
  const debe = ['que modelo de IA sos?','que motor de IAG, me refiero','por que tarda la voz?','cual es tu motor de IA?','que modelo usas?'];
  const noDebe = ['el modelo teorico de Latour','dar voz a los alumnos en la encuesta','analiza los datos de mis documentos','contame un chiste'];
  let d=true, dd=''; for(const q of debe){ if(!reApp.test(q)){ d=false; dd+='['+q+'] '; } }
  let n=true, nn=''; for(const q of noDebe){ if(reApp.test(q)){ n=false; nn+='['+q+'] '; } }
  t('C-trigger: DISPARA en preguntas por el modelo/motor/voz', d, dd);
  t('C-trigger: NO sobredispara en charla/análisis normal', n, nn);
}
// D-modelfijo (v39): respuesta DETERMINÍSTICA al "¿qué modelo sos?" (fuera del modelo)
const vmD=require('vm');
const mEPM = H.match(/function esPreguntaModelo\(text\)\{[\s\S]*?\n\}/);
t('D: existe esPreguntaModelo', !!mEPM);
if (mEPM){
  const sbD={String,RegExp,console}; vmD.createContext(sbD);
  vmD.runInContext(mEPM[0]+'\n;globalThis.__EPM=esPreguntaModelo;', sbD);
  const f=sbD.__EPM;
  const debe=['que modelo de IA sos?','que motor de IA utilizas en tu version v38','no usás gpt-oss-120b vía Groq?','QUERÍA PREGUNTARTE QUE MODELO DE IA SOS? DAME INFO DE VOS'];
  const noDebe=['que modelos teoricos usás para analizar los datos','que modelo de IA usan las escuelas de villa regina','escribime un mail a laura','contame un chiste','analizá los datos de mis documentos'];
  let d=true,dd=''; for(const q of debe){ if(!f(q)){d=false;dd+='['+q.slice(0,22)+'] ';} }
  let n=true,nn=''; for(const q of noDebe){ if(f(q)){n=false;nn+='['+q.slice(0,22)+'] ';} }
  t('D: DISPARA en la pregunta por SU modelo/motor', d, dd);
  t('D: NO dispara en análisis de terceros / comandos', n, nn);
}
// v40-audit (24/09): la intercepción pasó a esPreguntaModeloSola (si viene con otro pedido, va al modelo con la identidad antepuesta — ver TEST_audit1.js).
t('D: send() intercepta ANTES del modelo', H.indexOf('if (esPreguntaModelo(text)) { responderModeloFijo(text); return; }')>=0 || H.indexOf('if (esPreguntaModeloSola(text)) { responderModeloFijo(text); return; }')>=0 || H.indexOf('if (esPreguntaModeloSola(_textoModelo) && !_hechos.length) { responderModeloFijo(text); return; }')>=0); // v40-hechos
t('D: la respuesta fija sale de CONFIG y aclara versión≠modelo', H.indexOf("corro sobre el modelo «'+mp+'»")>=0 && H.indexOf('es la versión de la app, no el modelo')>=0);
console.log('\n'+(bad===0?'✅ TODO VERDE — '+ok+' pruebas pasan (plataforma)':'❌ '+bad+' fallos de '+(ok+bad)));
process.exit(bad?1:0);
