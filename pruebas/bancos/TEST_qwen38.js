/* TEST_qwen38.js — amarra el arreglo v39-qwen38 (PLATAFORMA) / v59-qwen38 (MIRROR), 24/09/2026.
   POR QUÉ EXISTE: Groq retiró qwen/qwen3.6-27b el 14/09/2026 y lo reemplazó por qwen/qwen3.8-27b.
   En las dos apps qwen3.6 era el ÚNICO modelo de visión (📷 quedó roto) y en MIRROR era además el
   principal. Este banco EJECUTA las piezas reales (migración, arranque, lista de a dónde caer) para
   que nadie vuelva a dejar un modelo muerto como valor vivo sin que salte. */
const fs=require('fs'), path=require('path'), vm=require('vm');
const BASE=path.join(__dirname,'..');
let ok=0,bad=0;
function t(m,c,x){ if(c){ok++;} else {bad++; console.log('  ❌ '+m+(x!==undefined?'  → '+x:''));} }
function grabFunc(H,name){ const i=H.indexOf('function '+name+'('); if(i<0) return ''; let d=0,k=H.indexOf('{',i); for(let p=k;p<H.length;p++){const c=H[p]; if(c==='{')d++; else if(c==='}'){d--; if(d===0) return H.slice(i,p+1);}} return ''; }
function grabBlock(H,start){ const i=H.indexOf(start); if(i<0) return ''; let d=0,k=H.indexOf('{',i); for(let p=k;p<H.length;p++){const c=H[p]; if(c==='{')d++; else if(c==='}'){d--; if(d===0) return H.slice(i,p+2);}} return ''; }
function sinComentarios(s){ return s.replace(/\/\*[\s\S]*?\*\//g,'').split('\n').map(l=>l.replace(/(^|[^:'"\\])\/\/.*$/,'$1')).join('\n'); }
const MUERTO="'qwen/qwen3.6-27b'", NUEVO='qwen/qwen3.8-27b';

// ━━━ PLATAFORMA ━━━
{
  const H=fs.readFileSync(path.join(BASE,'PLATAFORMA','index.html'),'utf8');
  const vivo=sinComentarios(H).split('\n').filter(l=>l.indexOf(MUERTO)>=0 && !/^\s*'qwen\/qwen3\.6-27b'\s*:/.test(l));
  t('PLAT: qwen3.6 no aparece como valor vivo (solo como clave de MODELOS_APAGADOS)', vivo.length===0, vivo.join(' | ').slice(0,200));
  t('PLAT: modeloVision = qwen3.8', /modeloVision:\s*'qwen\/qwen3\.8-27b'/.test(H));
  t('PLAT: la visión tiene lista de a dónde caer', /modelosVision:\s*\['qwen\/qwen3\.8-27b'\]/.test(H));
  t('PLAT: respaldo desde Cerebras → gpt-oss-120b (producción)', /CONFIG\.modeloRespaldo='openai\/gpt-oss-120b'; \} \/\/ v38-motor/.test(H));
  // el regex de la curita de qwen agarra al sucesor (si no, qwen3.8 pintaría el <think> en el chat)
  const reQ=(H.match(/const esQwenRazonador = (\/[^;]+\/i)\.test/)||[])[1];
  t('PLAT: la curita de razonamiento de qwen reconoce qwen3.8', !!reQ && eval(reQ).test(NUEVO), reQ);
  // migración REAL
  const mapa=grabBlock(H,'const MODELOS_APAGADOS = {'), fn=grabFunc(H,'migrarModelosApagados');
  t('PLAT: extraje la tabla y la migración', mapa.length>50 && fn.length>50);
  const ctx={window:{}}; vm.createContext(ctx); vm.runInContext(mapa.replace('const MODELOS_APAGADOS','var MODELOS_APAGADOS')+'\n'+fn, ctx);
  let r=vm.runInContext("migrarModelosApagados({modeloPrincipal:'qwen/qwen3.6-27b',modeloRespaldo:'qwen/qwen3.6-27b',modeloVision:'qwen/qwen3.6-27b',appName:'ATIS'})",ctx);
  t('PLAT·vivo: config con qwen3.6 en los 3 slots → los 3 a qwen3.8', r.modeloPrincipal===NUEVO&&r.modeloRespaldo===NUEVO&&r.modeloVision===NUEVO, JSON.stringify(r));
  t('PLAT·vivo: no pisa el resto de la config', r.appName==='ATIS');
  t('PLAT·vivo: deja anotados los 3 cambios para avisar', ctx.window._migracionModelos && ctx.window._migracionModelos.length===3);
  ctx.window={}; r=vm.runInContext("migrarModelosApagados({modeloVision:'meta-llama/llama-4-scout-17b-16e-instruct'})",ctx);
  t('PLAT·vivo: llama-4-scout ya no cae en qwen3.6 (muerto) sino en qwen3.8', r.modeloVision===NUEVO, r.modeloVision);
  ctx.window={}; r=vm.runInContext("migrarModelosApagados({modeloPrincipal:'openai/gpt-oss-120b',modeloVision:'qwen/qwen3.8-27b'})",ctx);
  t('PLAT·vivo: una config sana no se toca ni se avisa', r.modeloPrincipal==='openai/gpt-oss-120b' && r.modeloVision===NUEVO && !ctx.window._migracionModelos);
  // cadena de saltos y círculo (tabla inyectada: prueba la LÓGICA, no los datos)
  const c2={window:{}}; vm.createContext(c2);
  vm.runInContext("var MODELOS_APAGADOS={a:'b',b:'c',x:'y',y:'x'};\n"+fn, c2);
  r=vm.runInContext("migrarModelosApagados({modeloPrincipal:'a'})",c2);
  t('PLAT·lógica: sigue la cadena a→b→c (no se queda en otro muerto)', r.modeloPrincipal==='c', r.modeloPrincipal);
  let colgo=false; try { r=vm.runInContext("migrarModelosApagados({modeloPrincipal:'x'})",c2,{timeout:1000}); } catch(e){ colgo=true; }
  t('PLAT·lógica: un círculo en la tabla NO cuelga el arranque', !colgo);
  // ningún valor de la tabla apunta a una clave de la tabla (sin saltos innecesarios)
  vm.runInContext("globalThis.__malos=Object.keys(MODELOS_APAGADOS).filter(function(k){return MODELOS_APAGADOS[MODELOS_APAGADOS[k]];});",ctx);
  t('PLAT: ningún reemplazo de la tabla es otro modelo muerto', ctx.__malos.length===0, JSON.stringify(ctx.__malos));
}

// ━━━ MIRROR ━━━ ([repo] se saltea si no está MIRROR/index.html)
if (fs.existsSync(path.join(BASE,'MIRROR','index.html'))) {
  const H=fs.readFileSync(path.join(BASE,'MIRROR','index.html'),'utf8');
  const vivo=sinComentarios(H).split('\n').filter(l=>l.indexOf(MUERTO)>=0 && !/const MODELOS_MUERTOS_GROQ/.test(l));
  t('MIRROR: qwen3.6 no aparece como valor vivo (solo en MODELOS_MUERTOS_GROQ)', vivo.length===0, vivo.join(' | ').slice(0,200));
  const def=(H.match(/const MODELO_GROQ_DEFECTO = '([^']+)'/)||[])[1];
  const alt=(H.match(/const MODELOS_ALT_GROQ = \[([^\]]*)\]/)||[])[1]||'';
  t('MIRROR: principal por defecto = gpt-oss-120b (producción)', def==='openai/gpt-oss-120b', def);
  t('MIRROR: coherencia default == primero de la lista', alt.trim().startsWith("'"+def+"'"), alt);
  t('MIRROR: qwen3.8 está de respaldo en la lista', alt.indexOf("'"+NUEVO+"'")>0, alt);
  t('MIRROR: la curita de gpt-oss sigue (si no, devuelve vacío)', /const esRazonador = \/gpt-oss\/i\.test\(modelo \|\| ''\);/.test(H) && /if \(esCerebras \|\| esRazonador\)/.test(H));
  const reQ=(H.match(/const esQwenRazonador = (\/[^;]+\/i)\.test/)||[])[1];
  t('MIRROR: la curita de qwen reconoce qwen3.8 (visión)', !!reQ && eval(reQ).test(NUEVO), reQ);
  const L=n=>{ const i=H.indexOf(n); return H.slice(i, H.indexOf('\n',i)); };
  // arranque REAL: un navegador que recordaba qwen3.6 (el blindaje o un ajuste viejo)
  const hasta=(ini)=>{ const i=H.indexOf(ini); return i<0?'':H.slice(i, H.indexOf('})();',i)+5); };
  const iifeG=hasta('let MODELO_GROQ = (function(){'), iifeV=hasta('let MODELO_VISION = (function(){');
  function arranque(guardado){
    const st={}; if(guardado){ st.mirror_modelo_groq=guardado; st.mirror_modelo_vision=guardado; }
    const c={localStorage:{getItem:k=>k in st?st[k]:null,setItem:(k,v)=>{st[k]=String(v)},removeItem:k=>{delete st[k]}}}; vm.createContext(c);
    vm.runInContext([L('const MODELOS_MUERTOS_GROQ'),L('const MODELO_GROQ_DEFECTO'),iifeG.replace('let MODELO_GROQ','var MODELO_GROQ'),iifeV.replace('let MODELO_VISION','var MODELO_VISION')].join('\n'),c);
    return {g:c.MODELO_GROQ, v:c.MODELO_VISION, st};
  }
  let a=arranque('qwen/qwen3.6-27b');
  t('MIRROR·vivo: si recordaba qwen3.6, arranca con gpt-oss-120b', a.g==='openai/gpt-oss-120b', a.g);
  t('MIRROR·vivo: y la visión arranca con qwen3.8', a.v===NUEVO, a.v);
  t('MIRROR·vivo: y borra lo recordado muerto (no lo arrastra)', !('mirror_modelo_groq' in a.st) && !('mirror_modelo_vision' in a.st), JSON.stringify(a.st));
  a=arranque(null);
  t('MIRROR·vivo: navegador nuevo → gpt-oss-120b + visión qwen3.8', a.g==='openai/gpt-oss-120b' && a.v===NUEVO, JSON.stringify(a));
  a=arranque('openai/gpt-oss-20b');
  t('MIRROR·vivo: un modelo recordado VIGENTE se respeta', a.g==='openai/gpt-oss-20b');
  // lista de a dónde caer de la visión
  const c3={}; vm.createContext(c3);
  vm.runInContext([L('const MODELOS_ALT_GROQ'),L('const MODELOS_ALT_CEREBRAS'),L('const MODELOS_ALT_VISION_GROQ'),grabFunc(H,'modelosAlternativosMirror')].join('\n')+"\nglobalThis.__a=modelosAlternativosMirror('/groq','qwen/qwen3.6-27b','vision'); globalThis.__b=modelosAlternativosMirror('/groq','qwen/qwen3.8-27b','vision'); globalThis.__c=modelosAlternativosMirror('/groq','openai/gpt-oss-120b','principal');",c3);
  t('MIRROR·vivo: visión con qwen3.6 muerto → cae a qwen3.8', JSON.stringify(c3.__a)==='["qwen/qwen3.8-27b"]', JSON.stringify(c3.__a));
  t('MIRROR·vivo: si muere qwen3.8 NO cae en un modelo ciego (lista vacía → aviso honesto)', c3.__b.length===0, JSON.stringify(c3.__b));
  t('MIRROR·vivo: texto con gpt-oss-120b muerto → qwen3.8 y gpt-oss-20b', JSON.stringify(c3.__c)==='["qwen/qwen3.8-27b","openai/gpt-oss-20b"]', JSON.stringify(c3.__c));
}
console.log('\n'+(bad===0?'✅ TODO VERDE — '+ok+' pruebas pasan (las dos muletas)':'❌ '+bad+' fallos de '+(ok+bad)));
process.exit(bad?1:0);
