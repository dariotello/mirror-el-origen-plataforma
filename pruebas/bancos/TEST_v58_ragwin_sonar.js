/* TEST v58/v39 — RAG "usá la ventana" + SOÑAR (cruce local) + calidad del sueño (sonar3).
   Amarra las promesas en las DOS muletas: ejecuta el motor de sueño de verdad y verifica
   el guardrail de honestidad + los arreglos de calidad (stopwords, _sonFrag, triviales/errores). */
const fs = require('fs'), path = require('path'), vm = require('vm');
const BASE = path.join(__dirname, '..');
const FILES = { MIRROR: path.join(BASE,'MIRROR','index.html'), PLATAFORMA: path.join(BASE,'PLATAFORMA','index.html') };
// [repo] en el repo de la plataforma no está MIRROR/index.html: se prueba solo lo que existe
for (const _k of Object.keys(FILES)) if (!fs.existsSync(FILES[_k])) delete FILES[_k];
let ok=0, bad=0;
function t(label, cond, extra){ if(cond){ok++;} else {bad++; console.log('  ❌ '+label+(extra?'  → '+extra:''));} }
function grabFunc(H, name){ const i=H.indexOf('function '+name+'('); if(i<0) return ''; let d=0,k=H.indexOf('{',i); for(let p=k;p<H.length;p++){const c=H[p]; if(c==='{')d++; else if(c==='}'){d--; if(d===0) return H.slice(i,p+1);}} return ''; }
function grabLine(H, needle){ const i=H.indexOf(needle); if(i<0) return ''; const j=H.indexOf('\n',i); return H.slice(i, j<0?H.length:j); }

const RECUERDOS = [
  {id:'rA', arch:false, text:'me apasiona ensenar fisica a los pibes en la escuela', tf:{ensenar:1,fisica:1,escuela:1,pasion:1,pibes:1}},
  {id:'rB', arch:false, text:'ya no aguanto, estoy cansado de ensenar fisica',      tf:{ensenar:1,fisica:1,cansado:1}},
  {id:'rC', arch:false, text:'necesito mejorar como ensenar fisica',                tf:{ensenar:1,fisica:1,mejorar:1}},
  {id:'rD', arch:false, text:'me apasiona ensenar fisica a los pibes en la escuela', tf:{ensenar:1,fisica:1,escuela:1,pasion:1,pibes:1}},
  {id:'rE', arch:false, text:'me encanta cocinar pasta los domingos', tf:{cocinar:1,pasta:1,domingos:1}},
  {id:'rF', arch:false, text:'juego al futbol el fin de semana',       tf:{futbol:1,semana:1,juego:1}},
  {id:'rG', arch:false, text:'estoy muy bien con el proyecto de escuela', tf:{bien:1,proyecto:1,escuela:1}},
  {id:'rH', arch:false, text:'me siento bien y tranquilo con el proyecto', tf:{bien:1,tranquilo:1,proyecto:1}},
  {id:'rI', arch:false, text:'seguimos bien con el proyecto de fisica',   tf:{bien:1,proyecto:1,fisica:1}},
  {id:'rTRIV', arch:false, text:'buenas noches', tf:{noches:1}},
  {id:'rERR', arch:false, text:'USUARIO: armame un informe || ASISTENTE: No pude procesar la consulta. Reintenta.', tf:{armame:1,informe:1}},
];

for (const [nombre, file] of Object.entries(FILES)){
  console.log('\n━━━ '+nombre+' ━━━');
  const H = fs.readFileSync(file,'utf8');

  // ── RAG "usá la ventana" ──
  t('RAG: el recorte mágico a 1200 chars ya NO está', H.indexOf("+') ===\\n'+c.text.slice(0, 1200)") < 0);
  t('RAG: constante RAG_CAP_BIBLIO usada en el fragmento', /RAG_CAP_BIBLIO\s*=\s*\d{4}/.test(H) && H.indexOf('c.text.slice(0, RAG_CAP_BIBLIO)') > 0);
  t('RAG: umbral doc-completo subió de 1500', Number((H.match(/RAG_DOCCOMPLETO_PALABRAS\s*=\s*(\d+)/)||[])[1]) > 1500);
  t('RAG: tope doc-completo subió de 9000', Number((H.match(/RAG_CAP_DOCCOMPLETO\s*=\s*(\d+)/)||[])[1]) > 9000);
  t('ROUTER: guarda evalInstrumento', /const evalInstrumento = .*consignas/.test(H));
  t('ROUTER: no dispara con instrumento ni doc de sesión', H.indexOf('preguntaPorDatos && !evalInstrumento && !haySesion') > 0);
  // ── SOÑAR wiring ──
  t('SOÑAR: motor local presente', /function soniarCruzar/.test(H) && /function soniarTexto/.test(H) && /function getSuenoContext/.test(H));
  t('SOÑAR: sueña sola al arrancar', /setTimeout\(soniarSiCorresponde/.test(H));
  t('SOÑAR: botón "lo que crucé"', /soniarMostrar\(\)/.test(H) && /lo que crucé/.test(H));
  t('SOÑAR3: consts de calidad presentes', /_SON_STOP/.test(H) && /_SON_TRIVIAL/.test(H) && /_SON_ERROR/.test(H));

  // ── ejecutar el motor de verdad ──
  const partes = [
    grabLine(H,'const STOPWORDS_ES'), grabLine(H,'const _SIM_ANDAMIAJE'),
    grabLine(H,'const _SON_NEG'), grabLine(H,'const _SON_STOP'), grabLine(H,'const _SON_TRIVIAL'), grabLine(H,'const _SON_ERROR'),
    grabFunc(H,'_moldeTokens'), grabFunc(H,'_simTokens'), grabFunc(H,'_simRec'), grabFunc(H,'_sonFrag'),
    grabFunc(H,'soniarCruzar'), grabFunc(H,'soniarTexto'), grabFunc(H,'soniarUltimo'), grabFunc(H,'soniarGuardar'), grabFunc(H,'getSuenoContext'),
  ];
  t('SOÑAR: NO llama a ningún modelo (sin fetch/callGroq)', partes.join('\n').indexOf('fetch(')<0 && partes.join('\n').indexOf('callGroq')<0);
  const bloque = partes.join('\n');
  const sandbox = { Date, Object, Set, Math, console, RECUERDOS, cebDueno:()=>'Fulano', regError:()=>{},
                    localStorage:{ _d:{}, getItem(k){return this._d[k]||null;}, setItem(k,v){this._d[k]=String(v);} } };
  vm.createContext(sandbox);
  vm.runInContext(bloque + '\n;globalThis.__C=soniarCruzar(RECUERDOS); globalThis.__T=soniarTexto(__C);'
    + 'globalThis.__FRAG=_sonFrag({text:"[2026-09-09] USUARIO: hola que tal || ASISTENTE: todo bien y vos"});'
    + 'globalThis.__G0=getSuenoContext("hola, como andas");'
    + 'localStorage.setItem("mirror_sueno", __T); globalThis.__G1=getSuenoContext("che, ¿soñaste algo?");', sandbox);
  const C = sandbox.__C, T = sandbox.__T;
  t('SOÑAR·motor: cuenta 9 recuerdos (excluye trivial + error)', C.n === 9, 'n='+C.n);
  t('SOÑAR·motor: detecta PATRONES (ensenar/fisica)', C.patrones.length >= 1 && C.patrones.some(p=>p.tema==='ensenar'||p.tema==='fisica'));
  t('SOÑAR3·calidad: «bien» (muletilla) NO aparece como patrón', !C.patrones.some(p=>p.tema==='bien'), JSON.stringify(C.patrones.map(p=>p.tema)));
  t('SOÑAR·motor: detecta CONEXIÓN', C.conexiones.length >= 1, 'con='+C.conexiones.length);
  t('SOÑAR·motor: detecta TENSIÓN (polaridad distinta)', C.tensiones.length >= 1, 'ten='+C.tensiones.length);
  t('SOÑAR·motor: detecta REPETICIÓN', C.repeticiones.length >= 1, 'rep='+C.repeticiones.length);
  t('SOÑAR3·_sonFrag: corta la respuesta del asistente', sandbox.__FRAG === 'hola que tal', JSON.stringify(sandbox.__FRAG));
  t('SOÑAR·honestidad: aclara que NO es un sueño de verdad', /no es un sueño de verdad/i.test(T));
  t('SOÑAR·honestidad: NO sintió nada / es un programa', /sent[íi] nada/i.test(T) && /programa/i.test(T));
  t('SOÑAR·honestidad: nada viaja (cómputo local)', /sin mandar nada/i.test(T));
  t('SOÑAR·chat: NO inyecta en pregunta cualquiera', sandbox.__G0 === '');
  t('SOÑAR·chat: SÍ inyecta si preguntan "¿soñaste?"', sandbox.__G1.indexOf('sueño LOCAL') > 0);
}
console.log('\n'+(bad===0 ? '✅ TODO VERDE — '+ok+' pruebas pasan (las dos muletas)' : '❌ '+bad+' fallos de '+(ok+bad)));
process.exit(bad===0?0:1);
