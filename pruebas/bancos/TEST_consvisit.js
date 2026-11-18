/* TEST_consvisit.js — amarra la tanda del 24/09/2026 en la PLATAFORMA (hallazgos en vivo de Darío):
   A) v39-consvisit: «Visit» abre SIEMPRE el constructor (la puerta), sin castigar al usuario diario.
   B) v39-consmodelo: el selector de modelo del constructor recuerda la elección (antes volvía a la 1ª).
   C) v39-modelsano: en respuestas sobre la app, «GPT-4» inventado se corrige a la salida y se avisa.
   E) sin links estáticos a archivos que no están en el deploy (404 rojos en la consola).
   Ejecuta las piezas REALES extraídas del HTML. */
const fs=require('fs'), path=require('path'), vm=require('vm');
const H=fs.readFileSync(path.join(__dirname,'..','PLATAFORMA','index.html'),'utf8');
let ok=0,bad=0; function t(m,c,x){ if(c){ok++;} else {bad++; console.log('  ❌ '+m+(x!==undefined?'  → '+x:''));} }
function grabFunc(n,from){ const i=H.indexOf(from||('function '+n+'(')); if(i<0) return ''; let d=0,k=H.indexOf('{',i); for(let p=k;p<H.length;p++){const c=H[p]; if(c==='{')d++; else if(c==='}'){d--; if(!d) return H.slice(i,p+1);}} return ''; }
const L=n=>{ const i=H.indexOf(n); return i<0?'':H.slice(i,H.indexOf('\n',i)); };

// ── E ──
t('E: no hay <link rel="manifest" href="manifest.json"> (404 en el deploy)', !/<link rel="manifest" href="manifest\.json">/.test(H));
t('E: no hay apple-touch-icon a icon-192.png (404)', !/<link rel="apple-touch-icon" href="icon-192\.png">/.test(H));
t('E: el manifest dinámico sigue (instalable)', /link\.href = 'data:application\/manifest\+json,'/.test(H));
t('A: la app instalada entra directo (start_url con ?app)', /start_url: location\.href\.split\('#'\)\[0\]\.split\('\?'\)\[0\] \+ '\?app'/.test(H));

// ── A: la puerta ──
{
  const ini=H.indexOf('  window._abrirDirecto = function(){'), fin=H.indexOf('  if (CONFIG.configurado){ aplicarNombresUI(); aplicarCapacidades(); }', ini);
  t('A: extraje el bloque de arranque', ini>0 && fin>ini);
  if (!(ini>0 && fin>ini)) { console.log('\n❌ '+(bad)+' fallos — sin el bloque de arranque v39-consvisit'); process.exit(1); }
  const bloque=H.slice(ini,fin);
  const forz=L('  window._forzarConstructor = function()');
  function correr({configurado, search='', hash='', ses=null, compartido=null, ssRompe=false}){
    const st={}; if(ses) st.mirror_sesion_entro=ses;
    const el={}; const get=id=>(el[id]=el[id]||{style:{},classList:{_s:new Set(),add(c){this._s.add(c)},remove(c){this._s.delete(c)},contains(c){return this._s.has(c)}},textContent:''});
    const ctx={ CONFIG:{configurado, appName:'ATIS'}, location:{search,hash}, window:{},
      sessionStorage: ssRompe ? {getItem(){throw new Error('bloq')},setItem(){throw new Error('bloq')}} : {getItem:k=>k in st?st[k]:null,setItem:(k,v)=>{st[k]=String(v)}},
      document:{getElementById:get}, pintarConstructor(){}, _pasos:[], _prefill:0, regError(){} };
    ctx.window=ctx; ctx.consGo=n=>ctx._pasos.push(n); ctx.prefill=()=>{ctx._prefill++;};
    if (compartido) ctx.MODO_COMPARTIDO=compartido;
    vm.createContext(ctx); vm.runInContext(forz+'\n'+bloque+'\nlanzarConstructorTrasBoot();', ctx);
    return { nec: ctx.MIRROR_necesitaConfig, abierto: get('cons-ov').classList.contains('show'), volver: get('cons-volver').style.display, nom: get('cons-volver-nom').textContent, prefill: ctx._prefill, paso: ctx._pasos[0] };
  }
  let r=correr({configurado:false});
  t('A: navegador nuevo → constructor, paso 0, sin cartel de «ya tenés»', r.nec && r.abierto && r.paso===0 && r.volver==='none', JSON.stringify(r));
  r=correr({configurado:true});
  t('A: YA armado + Visit (pestaña nueva) → la puerta igual se abre (pedido de Darío)', r.nec && r.abierto && r.paso===0, JSON.stringify(r));
  t('A: … con el botón «Entrar a mi MIRROR» y su nombre', r.volver==='block' && r.nom==='«ATIS»', JSON.stringify(r));
  t('A: … y precarga lo suyo para ajustar (no arranca en blanco)', r.prefill===1);
  r=correr({configurado:true, ses:'1'});
  t('A: recargar en la MISMA pestaña después de entrar → directo a la app', !r.nec && !r.abierto, JSON.stringify(r));
  r=correr({configurado:true, search:'?app'});
  t('A: ?app (app instalada) → directo a la app', !r.nec && !r.abierto);
  r=correr({configurado:true, ses:'1', search:'?constructor'});
  t('A: ?constructor gana siempre (link de demo) …', r.nec && r.abierto);
  t('A: … y NO precarga lo del dueño (demo desde cero)', r.prefill===0);
  r=correr({configurado:true, compartido:{x:1}});
  t('A: link compartido (#m=) → NUNCA el constructor (solo-lectura)', !r.nec && !r.abierto);
  let rompio=false; try{ r=correr({configurado:true, ssRompe:true}); }catch(e){ rompio=true; }
  t('A: navegador que bloquea el almacenamiento → no explota y muestra la puerta', !rompio && r.abierto);
  t('A: Entrar y «Soy técnico» dejan la marca de sesión', /window\.consEnter = function\(\)\{[^\n]*sessionStorage\.setItem\('mirror_sesion_entro','1'\)/.test(H) && /window\.consSkip = function\(\)\{[^\n]*sessionStorage\.setItem\('mirror_sesion_entro','1'\)/.test(H));
  t('A: la frase nueva está traducida (en/pt)', /I18N_DICT\["Ya tenés tu MIRROR armado en este navegador:"\]=\{"en":/.test(H));
}

// ── B: selector de modelo ──
{
  const fn=grabFunc('renderMotores');
  t('B: extraje renderMotores', fn.length>100);
  function mkDom(){
    const els={};
    const mkSel=()=>({ _opts:[], _v:'', set innerHTML(x){ this._opts=[]; this._v=''; }, get innerHTML(){return ''},
      appendChild(o){ this._opts.push(o); if(this._opts.length===1) this._v=o.value; },
      get value(){ return this._v; }, set value(v){ if(this._opts.some(o=>o.value===v)) this._v=v; } });
    const gen=()=>({ innerHTML:'', appendChild(){}, style:{} });
    return { els, getElementById:id=>(els[id]=els[id]||(id==='c-modelo'?mkSel():gen())), createElement:()=>({ className:'', innerHTML:'', value:'', textContent:'', onclick:null }) };
  }
  const MOT={ groq:{nombre:'Groq',tipo:'gratuito',desc:'',comoClave:'',modelos:['openai/gpt-oss-120b','qwen/qwen3.8-27b','openai/gpt-oss-20b']},
              openai:{nombre:'OpenAI',tipo:'premium',desc:'',comoClave:'',modelos:['gpt-4o-mini','gpt-4o']} };
  const doc=mkDom();
  const ctx={ document:doc, MOTORES:MOT, CONFIG:{motorPrincipal:'groq', modeloPrincipal:'openai/gpt-oss-120b'}, costoLinea:()=>'' };
  vm.createContext(ctx);
  vm.runInContext("var motorSel='groq'; var modeloSelCons=null;\n"+fn, ctx);
  vm.runInContext('renderMotores()',ctx);
  const sel=doc.els['c-modelo'];
  t('B: de entrada muestra el guardado', sel.value==='openai/gpt-oss-120b', sel.value);
  sel.value='qwen/qwen3.8-27b'; sel.onchange();
  vm.runInContext('renderMotores()',ctx);   // = volver al paso 2 / tocar la tarjeta del motor
  t('B: elegís qwen3.8, se rearma la lista → SIGUE qwen3.8 (el bug de Darío)', sel.value==='qwen/qwen3.8-27b', sel.value);
  vm.runInContext("motorSel='openai'; renderMotores()",ctx);
  t('B: cambiar a otro motor → su primer modelo (no arrastra uno que no existe ahí)', sel.value==='gpt-4o-mini', sel.value);
  vm.runInContext("motorSel='groq'; renderMotores()",ctx);
  t('B: volver a Groq → recupera la elección qwen3.8', sel.value==='qwen/qwen3.8-27b', sel.value);
  const ctx2={ document:mkDom(), MOTORES:MOT, CONFIG:{motorPrincipal:'groq', modeloPrincipal:'qwen/qwen3.8-27b'}, costoLinea:()=>'' };
  vm.createContext(ctx2); vm.runInContext("var motorSel='groq'; var modeloSelCons=null;\n"+fn+"\nrenderMotores();", ctx2);
  t('B: reabrir el constructor con qwen3.8 guardado → muestra qwen3.8 (no te lo pisa)', ctx2.document.els['c-modelo'].value==='qwen/qwen3.8-27b');
  t('B: las opciones de la lista se leen en Windows (fondo oscuro)', /\.cons-sel option\{background:#0d0d1c;color:#eaeaff;\}/.test(H));
}

// ── C: el nombre del modelo en respuestas sobre la app ──
{
  const code=[L('var _MODELO_AJENO_SRC'),L('var _AUTO_REF_RE'),L('const PREGUNTA_POR_APP').replace('const ','var '),grabFunc('_normMod'),grabFunc('preguntaNombraModeloAjeno'),grabFunc('corregirModeloAjeno')].join('\n');
  const ctx={CONFIG:{modeloPrincipal:'openai/gpt-oss-120b',motorPrincipal:'groq'},regError(){}}; vm.createContext(ctx); vm.runInContext(code,ctx);
  const gate=q=>ctx.PREGUNTA_POR_APP.test(q)&&!ctx.preguntaNombraModeloAjeno(q);
  const fix=r=>ctx.corregirModeloAjeno(r);
  // el caso REAL de la captura de Darío (24/09, 17:49)
  const REAL='La app funciona con la versión v38 de MIRROR y su entidad digital se llama MANIFIESTOS.\n• Modelo de lenguaje: GPT-4 de OpenAI, integrado en la arquitectura de la app para generar respuestas y redactar mensajes.\n• Infraestructura: se ejecuta sobre la plataforma groq con soporte de cerebras.';
  let r=fix(REAL);
  t('C: captura real → «GPT-4 de OpenAI» pasa a ser el modelo real', /Modelo de lenguaje: «openai\/gpt-oss-120b», integrado/.test(r) && !/GPT-4/.test(r), r);
  t('C: … y lo avisa al pie (no se esconde)', /Nota de la app: corregí el nombre del modelo/.test(r));
  t('C: … sin tocar «se llama MANIFIESTOS» (Llama sin número no es un modelo)', /se llama MANIFIESTOS/.test(r));
  r=fix('• Modelo de lenguaje: GPT‑4 de OpenAI, accesado vía la API de groq.');
  t('C: con guion no-separable (GPT‑4, como escribe gpt-oss) también', /«openai\/gpt-oss-120b»/.test(r) && !/GPT/.test(r.split('\n')[0]), r);
  t('C: gate: «hacé un informe de la app» → sí corrige', gate('hacé un informe de la app'));
  t('C: gate: «compará GPT-4 con Claude» → NO (lo nombró el usuario)', !gate('compará GPT-4 con Claude en la app'));
  t('C: gate: charla común → NO', !gate('hola, cómo andás'));
  const NEUTRA='ChatGPT es un modelo de lenguaje desarrollado por OpenAI y se usa mucho en escuelas. Claude es otro.';
  t('C: tercero suelto («ChatGPT es un modelo… se usa») → intacto', fix(NEUTRA)===NEUTRA, fix(NEUTRA));
  const SANA='Por debajo corro sobre «openai/gpt-oss-120b» vía groq.';
  t('C: respuesta ya correcta → intacta, sin nota', fix(SANA)===SANA);
  ctx.CONFIG.modeloPrincipal='gpt-4o'; ctx.CONFIG.motorPrincipal='openai';
  t('C: si el configurado ES gpt-4o, «corro sobre GPT-4o» es verdad → intacto', fix('Corro sobre GPT-4o.')==='Corro sobre GPT-4o.');
  ctx.CONFIG.modeloPrincipal='';
  t('C: sin modelo configurado → no inventa nada', fix('Uso GPT-4.')==='Uso GPT-4.');
  t('C: cableado en send(): después de actua, antes de pintar, solo sin error', /reply = actuaProcesarReply\(reply\);[^\n]*\n  try\{ if \(!errorMsg && (?:PREGUNTA_POR_APP\.test|esPreguntaPorApp)\(text\) && !preguntaNombraModeloAjeno\(text\)\) reply = corregirModeloAjeno\(reply\); \}/.test(H));
}
console.log('\n'+(bad===0?'✅ TODO VERDE — '+ok+' pruebas pasan (plataforma)':'❌ '+bad+' fallos de '+(ok+bad)));
process.exit(bad?1:0);
