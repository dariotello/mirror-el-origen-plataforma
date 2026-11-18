/* TEST_recencia.js — amarra v39-recencia en la PLATAFORMA (el "gato viejo").
   Extrae tokenize + bm25Search + las consts REALES del HTML y las corre. Filosofía: buscar el fallo.
   (1) empate de relevancia → gana el RECIENTE; (2) NO override: viejo MUCHO más relevante sigue ganando;
   (3) peso 0 (documentos/panel/default) = orden BM25 puro, sin cambios. MIRROR va aparte (congelado). */
const fs=require('fs'), path=require('path'), vm=require('vm');
const H=fs.readFileSync(path.join(__dirname,'..','PLATAFORMA','index.html'),'utf8');
function grabFunc(H,name){ const i=H.indexOf('function '+name+'('); if(i<0) return ''; let d=0,k=H.indexOf('{',i); for(let p=k;p<H.length;p++){const c=H[p]; if(c==='{')d++; else if(c==='}'){d--; if(d===0) return H.slice(i,p+1);}} return ''; }
function grabLine(H,needle){ const i=H.indexOf(needle); if(i<0) return ''; const j=H.indexOf('\n',i); return H.slice(i, j<0?H.length:j); }
const bloque=[ grabLine(H,'const STOPWORDS_ES'), grabFunc(H,'normalizeText'), grabLine(H,'const RECENCIA_PESO_MEMORIA'), grabLine(H,'const RECENCIA_VIDA_MEDIA_MS'), grabFunc(H,'tokenize'), grabFunc(H,'bm25Search') ].join('\n');
const sb={Date,Math,Object,Set,String,Array,console,RegExp}; vm.createContext(sb);
const runner = bloque + `
;(function(){
  function mk(id,text,ageDays){ var t=tokenize(text); var tf={}; t.forEach(function(x){tf[x]=(tf[x]||0)+1;}); return {id:id,text:text,tf:tf,len:t.length,ts:Date.now()-ageDays*86400000}; }
  var q='fisica escuela';
  var viejoIgual=mk('VIEJO','me apasiona la fisica en la escuela con los pibes',60);
  var recienteIgual=mk('RECIENTE','me apasiona la fisica en la escuela con los pibes',0);
  var viejoFuerte=mk('VFUERTE','fisica fisica escuela escuela fisica escuela fisica clases fisica',60);
  var recienteFlojo=mk('RFLOJO','hoy comi una pizza rica en la escuela',0);
  globalThis.__peso=RECENCIA_PESO_MEMORIA; globalThis.__vida=RECENCIA_VIDA_MEDIA_MS;
  globalThis.__sin = bm25Search(q,[viejoIgual,recienteIgual],4,0).map(function(c){return c.id;});
  globalThis.__con = bm25Search(q,[viejoIgual,recienteIgual],4,RECENCIA_PESO_MEMORIA).map(function(c){return c.id;});
  globalThis.__noov= bm25Search(q,[viejoFuerte,recienteFlojo],4,RECENCIA_PESO_MEMORIA).map(function(c){return c.id;});
  globalThis.__def3= bm25Search(q,[viejoIgual,recienteIgual,viejoFuerte,recienteFlojo],4).map(function(c){return c.id;});
  globalThis.__def0= bm25Search(q,[viejoIgual,recienteIgual,viejoFuerte,recienteFlojo],4,0).map(function(c){return c.id;});
})();`;
vm.runInContext(runner, sb);
let ok=0,bad=0; function t(m,c,e){ if(c){ok++;console.log('  ✅ '+m);} else {bad++;console.log('  ❌ '+m+(e?'  → '+e:''));} }
console.log('\n━━━ PLATAFORMA · v39-recencia ━━━');
t('consts presentes y peso en rango (0<peso<=1)', typeof sb.__peso==='number' && sb.__peso>0 && sb.__peso<=1, 'peso='+sb.__peso);
t('vida media = 14 días', sb.__vida===14*24*60*60*1000, String(sb.__vida));
t('SIN recencia (peso 0): el viejo queda primero (orden BM25 puro)', sb.__sin[0]==='VIEJO', JSON.stringify(sb.__sin));
t('CON recencia: a igual relevancia gana el RECIENTE (gato viejo resuelto)', sb.__con[0]==='RECIENTE', JSON.stringify(sb.__con));
t('NO override: viejo MUCHO más relevante sigue ganando pese a la recencia', sb.__noov[0]==='VFUERTE', JSON.stringify(sb.__noov));
t('default (3 args) == peso 0 explícito: documentos/panel NO cambian', JSON.stringify(sb.__def3)===JSON.stringify(sb.__def0), JSON.stringify(sb.__def3)+' vs '+JSON.stringify(sb.__def0));
// que getRecuerdosContext (memoria) SÍ pase el peso, y el panel NO
t('getRecuerdosContext activa el empujón (pasa RECENCIA_PESO_MEMORIA)', /bm25Search\(query, recuerdosChunks\.filter\(r=>!r\.arch(?:\)| && [^\n]{0,120}?\)\)), 4, RECENCIA_PESO_MEMORIA\)/.test(H) /* v40-audit7: el filtro también saca recuerdos de versión en preguntas de versión */);
t('el panel de memoria NO usa recencia (queda en relevancia pura)', /bm25Search\(q, recuerdosChunks\.filter\(r=>!r\.arch\), 30\);/.test(H));
console.log('\n'+(bad===0?'✅ TODO VERDE — '+ok+' pruebas pasan (plataforma)':'❌ '+bad+' fallos de '+(ok+bad)));
process.exit(bad?1:0);
