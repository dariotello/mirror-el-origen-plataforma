/* TEST_audit5.js — auditoría en vivo 25/09/2026 (tarde) + salto de badge v40 de la PLATAFORMA.
   (1) «no tiene solapa de cierre, no me deja salir» (selector de voz más alto que la pantalla);
   (2) «el modo fácil no emite voz» (voz Online de Edge que no suena y falla en silencio);
   (3) Esc cierra TODAS las capas; (4) badge v40 + build .4.
   La prueba en navegador real (Chromium, 59 casos) corre aparte; esto amarra el código. */
const fs=require('fs'), path=require('path'), vm=require('vm');
const H=fs.readFileSync(path.join(__dirname,'..','PLATAFORMA','index.html'),'utf8');
let ok=0,bad=0; function t(m,c,x){ if(c){ok++; console.log('  ✅ '+m);} else {bad++; console.log('  ❌ '+m+(x!==undefined?'  → '+String(x).slice(0,200):''));} }
console.log('━━━ (1) ningún modal más alto que la pantalla ━━━');
t('.modal tiene tope de alto (100vh y 100dvh) y scroll propio', /\.modal \{ max-height: calc\(100vh - 24px\); max-height: calc\(100dvh - 24px\); overflow-y: auto;/.test(H));
t('el selector de voz tiene ✕ arriba que llama a cerrarSelectorVoz()', /<div class="modal-overlay" id="voz-modal">\s*<div class="modal"[^>]*>\s*<button class="modal-x" onclick="cerrarSelectorVoz\(\)"/.test(H));
t('la lista de salidas de audio bajó a 14vh', /id="audio-salida-lista" class="voz-lista" style="max-height:14vh;"/.test(H));
t('sigue el «cerrar» de abajo (dos salidas)', /<button class="mbtn mbtn-cancel" onclick="cerrarSelectorVoz\(\)">cerrar<\/button>/.test(H));
console.log('━━━ (3) Esc cierra todas las capas, sin clicks a ciegas ━━━');
const i3=H.indexOf('v40-audit5 (25/09/2026) — NINGUNA CAPA SIN SALIDA'); const B3=H.slice(i3, H.indexOf('</script>', i3));
t('bloque presente', i3>0);
t('respeta lo que ya cerró la capa de accesibilidad (defaultPrevented)', /e\.key !== 'Escape' \|\| e\.defaultPrevented/.test(B3));
t('el PIN queda afuera', /el\.id !== 'pin-modal'/.test(B3));
t('busca el botón por TEXTO de cierre (nunca «cancel» = borrar todo)', /CIERRE_RE/.test(B3) && !/mbtn-cancel/.test(B3.replace(/\/\*[\s\S]*?\*\//g,'')));
const re=eval(/var CIERRE_RE = (\/.*\/i);/.exec(B3)[1]);
['cerrar','Cerrar','✕ cerrar','✕ Cerrar','✕','✕ salir','× cerrar'].forEach(x=>t('cierra con «'+x+'»', re.test(x)));
['volver a neutro','borrar todo','cancel','Entendido ▸','Guardar','cerrar sesión y borrar'].forEach(x=>t('NO toma «'+x+'» como cierre', !re.test(x)));
t('tocar el fondo cierra SOLO las de lectura', /FONDO_OK = \{ 'voz-modal':1, 'cumpli-modal':1, 'sem-modal':1, 'act-modal':1 \}/.test(B3));
console.log('━━━ (2) la voz que no suena se reemplaza sola y se avisa ━━━');
const gf=(name)=>{ const i=H.indexOf('function '+name+'('); let d=0,j=H.indexOf('{',i); for(let k=j;k<H.length;k++){ if(H[k]==='{')d++; else if(H[k]==='}'){ d--; if(!d) return H.slice(i,k+1);} } };
t('hablarCola escucha onstart (sabe si ARRANCÓ a sonar)', /u\.onstart = function\(\)\{ arranco = true;/.test(gf('hablarCola')));
t('onerror: interrupted/canceled/not-allowed NO marcan la voz como rota', /er !== 'interrupted' && er !== 'canceled' && er !== 'not-allowed' && rescatar/.test(gf('hablarCola')));
t('el vigía también rescata si nunca arrancó', /if \(!arranco && rescatar\('no arrancó'\)\) return;/.test(gf('hablarCola')));
t('elegirVozActual saltea las que fallaron (elegida y ranking)', /if\(v && !vozFallida\(v\)\) return v;/.test(gf('elegirVozActual')) && /\[\.\.\.vocesES\]\.filter\(x=>!vozFallida\(x\)\)/.test(gf('elegirVozActual')));
t('la elección guardada NO se borra (no toca localStorage al fallar)', !/localStorage/.test(gf('vozMarcarFalla')));
t('elegir a mano le da otra oportunidad', /delete _vozFallidas\[nombre\]/.test(gf('usarVoz')));
t('▶ probar informa si sonó o no', /u\.onstart=function\(\)\{ ok=true;/.test(gf('probarVoz')) && /no sonó/.test(gf('probarVoz')));
// simulación de vozLocalAlternativa y del aviso único
{ const ini=H.indexOf('const _vozFallidas = {};'), fin=H.indexOf('function elegirVozActual(');
  const voces=[{name:'Elena Online',lang:'es-AR',localService:false},{name:'Pablo',lang:'es-ES',localService:true},{name:'Zira',lang:'en-US',localService:true}];
  const msgs=[]; const ctx={ speechSynthesis:{getVoices:()=>voces}, document:{getElementById:()=>null}, addMsg:(r,x)=>msgs.push(x), regError:()=>{} };
  vm.createContext(ctx); vm.runInContext(H.slice(ini,fin).replace(/^const /gm,'var ').replace(/^let /gm,'var '), ctx);
  const alt=ctx.vozLocalAlternativa(voces[0]); t('reemplazo = voz LOCAL del mismo idioma', alt && alt.name==='Pablo', alt&&alt.name);
  ctx.vozMarcarFalla(voces[0],'synthesis-failed',alt); ctx.vozMarcarFalla(voces[0],'synthesis-failed',alt);
  t('avisa UNA sola vez, en criollo, nombrando las dos voces', msgs.length===1 && /Elena Online/.test(msgs[0]) && /Pablo/.test(msgs[0]) && /Online/.test(msgs[0]), msgs);
  t('queda marcada por la sesión', ctx.vozFallida(voces[0]) && !ctx.vozFallida(voces[1])); }
console.log('━━━ (5) fechas con nombre de mes («el 30 de septiembre») ━━━');
{ const ini=H.indexOf('function _tareaISO('), fin=H.indexOf('function _tareaNorm(');
  const ctx={}; vm.createContext(ctx);
  vm.runInContext('const _D=Date; Date=class extends _D{ constructor(...a){ if(a.length) super(...a); else super(2026,8,25,12,0,0); } static now(){ return new _D(2026,8,25,12).getTime(); } };\n'+H.slice(ini,fin), ctx);
  const F=x=>vm.runInContext('_tareaFecha('+JSON.stringify(x)+')',ctx);
  [['agendame pagar la luz el 30 de septiembre','2026-09-30'],['turno el 3 de octubre','2026-10-03'],['el 1° de noviembre','2026-11-01'],
   ['cumple de Ana el 3 de marzo','2027-03-03'],['vence el 8 de julio de 2021','2021-07-08'],['reunión 12 de setiembre del 2027','2027-09-12'],
   ['31 de febrero','' ],['el 30/09','2026-09-30'],['mañana a las 10','2026-09-26'],['el 5 de diciembre de 2026','2026-12-05'],['hoy','2026-09-25']]
   .forEach(([x,e])=>{ const r=F(x); t('«'+x+'» → '+(e||'(nada: no se inventa)'), r===e, r); });
}
console.log('━━━ (6) la entidad sabe qué trae SU versión (antes inventaba) ━━━');
{ const re=eval(/const PREGUNTA_POR_VERSION = (\/.*\/i);/.exec(H)[1]);
  ['COMO ESTAS MANIFIESTOS! QUE TIENE DE BUENA LA VERSION 40 DE MIRROR?','ALGUNA NOVEDAD?','POR QUE V40 ES MEJOR QUE LA v38?','SE ACTUALIZA SOLA?','¿qué hay de nuevo?','¿qué cambió?','¿qué trae de nuevo esta build?']
    .forEach(x=>t('dispara: «'+x+'»', re.test(x)));
  ['qué lindo día hace','contame un chiste','llamá a Juan','¿cómo se llama mi mascota?'].forEach(x=>t('NO dispara: «'+x+'»', !re.test(x)));
  const i=H.indexOf('function bloqueVersion('); let d=0,j=H.indexOf('{',i),k=j; for(;k<H.length;k++){ if(H[k]==='{')d++; else if(H[k]==='}'){ d--; if(!d) break; } }
  const ctx={ PLATFORM_VERSION:'v40', APP_BUILD:'2026-09-25.7', APP_NOVEDADES:JSON.parse(/const APP_NOVEDADES = (\[[^\n]*\]);/.exec(H)[1]) }; vm.createContext(ctx); vm.runInContext(H.slice(i,k+1),ctx);
  const b=vm.runInContext('bloqueVersion()',ctx);
  t('el bloque trae versión y build', /Versión: v40 · build 2026-09-25\.7/.test(b));
  // v40-cupo2 (3/10): el bloque ahora acorta cada novedad a ~200 caracteres (era el más pesado y el recorte se comía lo demás);
  // se amarra que estén TODAS, con su comienzo textual, y que las cortas vayan enteras
  t('el bloque trae TODAS las novedades (las cortas enteras; las largas con su comienzo textual)', ctx.APP_NOVEDADES.every(n=>n.length<=200 ? b.includes('- '+n) : b.includes('- '+n.slice(0,80))));
  t('dice que SÍ busca sola y avisa (antes lo negaba)', /SÍ BUSCA SOLA Y AVISA/.test(b) && /Actualizar ahora/.test(b));
  t('prohíbe inventar funciones/mejoras/seguridad', /NO inventes funciones, mejoras, cifras ni cambios de seguridad/.test(b));
  // v40-cupo2 (3/10): mismo comportamiento, ahora va al final del material y no viaja si la app ya contestó la versión con texto fijo
  t('se inyecta en el envío y se sostiene 2 repreguntas', /if \(PREGUNTA_POR_VERSION\.test\(text\)(?: && !_esDeseo)?\) _versionTurnos = 3;\s*if \(_versionTurnos > 0\)\{ if \(!_hechosVersion(?: && !_esDeseo)?(?: && _versionDirecta)?\) (?:_partesFin \+=|_bloqueVer =) bloqueVersion\(\); _versionTurnos--; \}/.test(H) && /_partesFin \+= _bloqueVer;/.test(H));
}
console.log('━━━ (7) la memoria envenenada no le gana a la verdad ━━━');
t('recuerdos sobre versiones quedan afuera SOLO en preguntas de versión', /recuerdosChunks\.filter\(r=>!r\.arch && !\(sinVersion && _RECUERDO_DE_VERSION\.test\(r\.text\|\|''\)\)\)/.test(H));
t('el envío pasa sinVersion cuando la pregunta (o la repregunta) es de versión', /getRecuerdosContext\(text, \{ sinVersion: _preguntaVersion \}\)/.test(H) && /_preguntaVersion = PREGUNTA_POR_VERSION\.test\(text\) \|\| _versionTurnos > 0/.test(H));
t('la fuente de verdad le gana a memoria e historial y pide corregirse', /ESTO LE GANA A TODO/.test(H) && /me corrijo/.test(H));
t('el historial restaurado: las respuestas viejas de la entidad sobre versiones no viajan en preguntas de versión', /_preguntaVersion && m && m\.role === 'assistant' && _RECUERDO_DE_VERSION\.test/.test(H));
t('lo que ya existía no se presenta como novedad', /NO es novedad de esta versión/.test(H));
t('no se borra nada de la Firebase del usuario (sin DELETE en el arreglo)', !/_RECUERDO_DE_VERSION[\s\S]{0,400}DELETE/.test(H));
console.log('━━━ (4) badge v40 + build .5 ━━━');
t('PLATFORM_VERSION = v40', /const PLATFORM_VERSION = 'v40';/.test(H));
// v40-octubre (2/10): la build sube en cada entrega; lo que se amarra es que NO retroceda de la .7 auditada
t('APP_BUILD ≥ 2026-09-25.7 (audit8 sobre la v40, nunca para atrás)', (function(){ const m=/const APP_BUILD = '([^']+)';/.exec(H); return !!m && m[1] >= '2026-09-25.7'; })());
const nov=JSON.parse(/const APP_NOVEDADES = (\[[^\n]*\]);/.exec(H)[1]);
t('1ª novedad: «✦ Generación v40…»', /^✦ Generación v40: tu MIRROR actúa en varios pasos, entiende por significado, te acompaña por voz y se actualiza solo\.$/.test(nov[0]));
t('el lector de ACTUALIZAR sigue leyendo build y novedades', /function actLeerBuild/.test(H) && nov.length>=5);
t('la regla del modelo cita la versión VIVA (no «v38» fija)', /quedarte solo en «MIRROR \$\{\(typeof PLATFORM_VERSION!=='undefined'\)\?PLATFORM_VERSION:'v40'\}»/.test(H));
t('no queda ningún «v38» visible fuera de comentarios/etiquetas de versión', !/[>«"']v38[<»"']/.test(H.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'')));
console.log(bad?`\n❌ ${bad} FALLAS — ${ok} OK`:`\n✅ TODO VERDE — ${ok} pruebas pasan (plataforma · audit5 + v40)`);
process.exit(bad?1:0);
